(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (ArrayBuffer.isView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (ArrayBuffer.isView(buf)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
(function (process,global,Buffer){

/**
 * y-webrtc3 - 
 * @version v2.4.0
 * @license MIT
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ywebrtc = factory());
}(this, (function () { 'use strict';

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	/**
	 * Parses an URI
	 *
	 * @author Steven Levithan <stevenlevithan.com> (MIT license)
	 * @api private
	 */

	var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

	var parts = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'];

	var parseuri = function parseuri(str) {
	    var src = str,
	        b = str.indexOf('['),
	        e = str.indexOf(']');

	    if (b != -1 && e != -1) {
	        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
	    }

	    var m = re.exec(str || ''),
	        uri = {},
	        i = 14;

	    while (i--) {
	        uri[parts[i]] = m[i] || '';
	    }

	    if (b != -1 && e != -1) {
	        uri.source = src;
	        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
	        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
	        uri.ipv6uri = true;
	    }

	    return uri;
	};

	var parseuri$1 = /*#__PURE__*/Object.freeze({
		default: parseuri,
		__moduleExports: parseuri
	});

	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
	  return typeof obj;
	} : function (obj) {
	  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	};

	var classCallCheck = function (instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	};

	var createClass = function () {
	  function defineProperties(target, props) {
	    for (var i = 0; i < props.length; i++) {
	      var descriptor = props[i];
	      descriptor.enumerable = descriptor.enumerable || false;
	      descriptor.configurable = true;
	      if ("value" in descriptor) descriptor.writable = true;
	      Object.defineProperty(target, descriptor.key, descriptor);
	    }
	  }

	  return function (Constructor, protoProps, staticProps) {
	    if (protoProps) defineProperties(Constructor.prototype, protoProps);
	    if (staticProps) defineProperties(Constructor, staticProps);
	    return Constructor;
	  };
	}();

	var inherits = function (subClass, superClass) {
	  if (typeof superClass !== "function" && superClass !== null) {
	    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
	  }

	  subClass.prototype = Object.create(superClass && superClass.prototype, {
	    constructor: {
	      value: subClass,
	      enumerable: false,
	      writable: true,
	      configurable: true
	    }
	  });
	  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	};

	var possibleConstructorReturn = function (self, call) {
	  if (!self) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }

	  return call && (typeof call === "object" || typeof call === "function") ? call : self;
	};

	/**
	 * Helpers.
	 */

	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;

	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */

	var ms = function ms(val, options) {
	  options = options || {};
	  var type = typeof val === 'undefined' ? 'undefined' : _typeof(val);
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isNaN(val) === false) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
	};

	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */

	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}

	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtShort(ms) {
	  if (ms >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (ms >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (ms >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (ms >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}

	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */

	function fmtLong(ms) {
	  return plural(ms, d, 'day') || plural(ms, h, 'hour') || plural(ms, m, 'minute') || plural(ms, s, 'second') || ms + ' ms';
	}

	/**
	 * Pluralization helper.
	 */

	function plural(ms, n, name) {
	  if (ms < n) {
	    return;
	  }
	  if (ms < n * 1.5) {
	    return Math.floor(ms / n) + ' ' + name;
	  }
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}

	var ms$1 = /*#__PURE__*/Object.freeze({
		default: ms,
		__moduleExports: ms
	});

	var require$$0 = ( ms$1 && ms ) || ms$1;

	var debug = createCommonjsModule(function (module, exports) {
	  /**
	   * This is the common logic for both the Node.js and web browser
	   * implementations of `debug()`.
	   *
	   * Expose `debug()` as the module.
	   */

	  exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
	  exports.coerce = coerce;
	  exports.disable = disable;
	  exports.enable = enable;
	  exports.enabled = enabled;
	  exports.humanize = require$$0;

	  /**
	   * Active `debug` instances.
	   */
	  exports.instances = [];

	  /**
	   * The currently active debug mode names, and names to skip.
	   */

	  exports.names = [];
	  exports.skips = [];

	  /**
	   * Map of special "%n" handling functions, for the debug "format" argument.
	   *
	   * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	   */

	  exports.formatters = {};

	  /**
	   * Select a color.
	   * @param {String} namespace
	   * @return {Number}
	   * @api private
	   */

	  function selectColor(namespace) {
	    var hash = 0,
	        i;

	    for (i in namespace) {
	      hash = (hash << 5) - hash + namespace.charCodeAt(i);
	      hash |= 0; // Convert to 32bit integer
	    }

	    return exports.colors[Math.abs(hash) % exports.colors.length];
	  }

	  /**
	   * Create a debugger with the given `namespace`.
	   *
	   * @param {String} namespace
	   * @return {Function}
	   * @api public
	   */

	  function createDebug(namespace) {

	    var prevTime;

	    function debug() {
	      // disabled?
	      if (!debug.enabled) return;

	      var self = debug;

	      // set `diff` timestamp
	      var curr = +new Date();
	      var ms = curr - (prevTime || curr);
	      self.diff = ms;
	      self.prev = prevTime;
	      self.curr = curr;
	      prevTime = curr;

	      // turn the `arguments` into a proper Array
	      var args = new Array(arguments.length);
	      for (var i = 0; i < args.length; i++) {
	        args[i] = arguments[i];
	      }

	      args[0] = exports.coerce(args[0]);

	      if ('string' !== typeof args[0]) {
	        // anything else let's inspect with %O
	        args.unshift('%O');
	      }

	      // apply any `formatters` transformations
	      var index = 0;
	      args[0] = args[0].replace(/%([a-zA-Z%])/g, function (match, format) {
	        // if we encounter an escaped % then don't increase the array index
	        if (match === '%%') return match;
	        index++;
	        var formatter = exports.formatters[format];
	        if ('function' === typeof formatter) {
	          var val = args[index];
	          match = formatter.call(self, val);

	          // now we need to remove `args[index]` since it's inlined in the `format`
	          args.splice(index, 1);
	          index--;
	        }
	        return match;
	      });

	      // apply env-specific formatting (colors, etc.)
	      exports.formatArgs.call(self, args);

	      var logFn = debug.log || exports.log || console.log.bind(console);
	      logFn.apply(self, args);
	    }

	    debug.namespace = namespace;
	    debug.enabled = exports.enabled(namespace);
	    debug.useColors = exports.useColors();
	    debug.color = selectColor(namespace);
	    debug.destroy = destroy;

	    // env-specific initialization logic for debug instances
	    if ('function' === typeof exports.init) {
	      exports.init(debug);
	    }

	    exports.instances.push(debug);

	    return debug;
	  }

	  function destroy() {
	    var index = exports.instances.indexOf(this);
	    if (index !== -1) {
	      exports.instances.splice(index, 1);
	      return true;
	    } else {
	      return false;
	    }
	  }

	  /**
	   * Enables a debug mode by namespaces. This can include modes
	   * separated by a colon and wildcards.
	   *
	   * @param {String} namespaces
	   * @api public
	   */

	  function enable(namespaces) {
	    exports.save(namespaces);

	    exports.names = [];
	    exports.skips = [];

	    var i;
	    var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
	    var len = split.length;

	    for (i = 0; i < len; i++) {
	      if (!split[i]) continue; // ignore empty strings
	      namespaces = split[i].replace(/\*/g, '.*?');
	      if (namespaces[0] === '-') {
	        exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
	      } else {
	        exports.names.push(new RegExp('^' + namespaces + '$'));
	      }
	    }

	    for (i = 0; i < exports.instances.length; i++) {
	      var instance = exports.instances[i];
	      instance.enabled = exports.enabled(instance.namespace);
	    }
	  }

	  /**
	   * Disable debug output.
	   *
	   * @api public
	   */

	  function disable() {
	    exports.enable('');
	  }

	  /**
	   * Returns true if the given mode name is enabled, false otherwise.
	   *
	   * @param {String} name
	   * @return {Boolean}
	   * @api public
	   */

	  function enabled(name) {
	    if (name[name.length - 1] === '*') {
	      return true;
	    }
	    var i, len;
	    for (i = 0, len = exports.skips.length; i < len; i++) {
	      if (exports.skips[i].test(name)) {
	        return false;
	      }
	    }
	    for (i = 0, len = exports.names.length; i < len; i++) {
	      if (exports.names[i].test(name)) {
	        return true;
	      }
	    }
	    return false;
	  }

	  /**
	   * Coerce `val`.
	   *
	   * @param {Mixed} val
	   * @return {Mixed}
	   * @api private
	   */

	  function coerce(val) {
	    if (val instanceof Error) return val.stack || val.message;
	    return val;
	  }
	});
	var debug_1 = debug.coerce;
	var debug_2 = debug.disable;
	var debug_3 = debug.enable;
	var debug_4 = debug.enabled;
	var debug_5 = debug.humanize;
	var debug_6 = debug.instances;
	var debug_7 = debug.names;
	var debug_8 = debug.skips;
	var debug_9 = debug.formatters;

	var debug$1 = /*#__PURE__*/Object.freeze({
		default: debug,
		__moduleExports: debug,
		coerce: debug_1,
		disable: debug_2,
		enable: debug_3,
		enabled: debug_4,
		humanize: debug_5,
		instances: debug_6,
		names: debug_7,
		skips: debug_8,
		formatters: debug_9
	});

	var require$$0$1 = ( debug$1 && debug ) || debug$1;

	var browser = createCommonjsModule(function (module, exports) {
	  /**
	   * This is the web browser implementation of `debug()`.
	   *
	   * Expose `debug()` as the module.
	   */

	  exports = module.exports = require$$0$1;
	  exports.log = log;
	  exports.formatArgs = formatArgs;
	  exports.save = save;
	  exports.load = load;
	  exports.useColors = useColors;
	  exports.storage = 'undefined' != typeof chrome && 'undefined' != typeof chrome.storage ? chrome.storage.local : localstorage();

	  /**
	   * Colors.
	   */

	  exports.colors = ['#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC', '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF', '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC', '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF', '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC', '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033', '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366', '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933', '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC', '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF', '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'];

	  /**
	   * Currently only WebKit-based Web Inspectors, Firefox >= v31,
	   * and the Firebug extension (any Firefox version) are known
	   * to support "%c" CSS customizations.
	   *
	   * TODO: add a `localStorage` variable to explicitly enable/disable colors
	   */

	  function useColors() {
	    // NB: In an Electron preload script, document will be defined but not fully
	    // initialized. Since we know we're in Chrome, we'll just detect this case
	    // explicitly
	    if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
	      return true;
	    }

	    // Internet Explorer and Edge do not support colors.
	    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
	      return false;
	    }

	    // is webkit? http://stackoverflow.com/a/16459606/376773
	    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	    return typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance ||
	    // is firebug? http://stackoverflow.com/a/398120/376773
	    typeof window !== 'undefined' && window.console && (window.console.firebug || window.console.exception && window.console.table) ||
	    // is firefox >= v31?
	    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
	    typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 ||
	    // double check webkit in userAgent just in case we are in a worker
	    typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
	  }

	  /**
	   * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	   */

	  exports.formatters.j = function (v) {
	    try {
	      return JSON.stringify(v);
	    } catch (err) {
	      return '[UnexpectedJSONParseError]: ' + err.message;
	    }
	  };

	  /**
	   * Colorize log arguments if enabled.
	   *
	   * @api public
	   */

	  function formatArgs(args) {
	    var useColors = this.useColors;

	    args[0] = (useColors ? '%c' : '') + this.namespace + (useColors ? ' %c' : ' ') + args[0] + (useColors ? '%c ' : ' ') + '+' + exports.humanize(this.diff);

	    if (!useColors) return;

	    var c = 'color: ' + this.color;
	    args.splice(1, 0, c, 'color: inherit');

	    // the final "%c" is somewhat tricky, because there could be other
	    // arguments passed either before or after the %c, so we need to
	    // figure out the correct index to insert the CSS into
	    var index = 0;
	    var lastC = 0;
	    args[0].replace(/%[a-zA-Z%]/g, function (match) {
	      if ('%%' === match) return;
	      index++;
	      if ('%c' === match) {
	        // we only are interested in the *last* %c
	        // (the user may have provided their own)
	        lastC = index;
	      }
	    });

	    args.splice(lastC, 0, c);
	  }

	  /**
	   * Invokes `console.log()` when available.
	   * No-op when `console.log` is not a "function".
	   *
	   * @api public
	   */

	  function log() {
	    // this hackery is required for IE8/9, where
	    // the `console.log` function doesn't have 'apply'
	    return 'object' === (typeof console === 'undefined' ? 'undefined' : _typeof(console)) && console.log && Function.prototype.apply.call(console.log, console, arguments);
	  }

	  /**
	   * Save `namespaces`.
	   *
	   * @param {String} namespaces
	   * @api private
	   */

	  function save(namespaces) {
	    try {
	      if (null == namespaces) {
	        exports.storage.removeItem('debug');
	      } else {
	        exports.storage.debug = namespaces;
	      }
	    } catch (e) {}
	  }

	  /**
	   * Load `namespaces`.
	   *
	   * @return {String} returns the previously persisted debug modes
	   * @api private
	   */

	  function load() {
	    var r;
	    try {
	      r = exports.storage.debug;
	    } catch (e) {}

	    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	    if (!r && typeof process !== 'undefined' && 'env' in process) {
	      r = process.env.DEBUG;
	    }

	    return r;
	  }

	  /**
	   * Enable namespaces listed in `localStorage.debug` initially.
	   */

	  exports.enable(load());

	  /**
	   * Localstorage attempts to return the localstorage.
	   *
	   * This is necessary because safari throws
	   * when a user disables cookies/localstorage
	   * and you attempt to access it.
	   *
	   * @return {LocalStorage}
	   * @api private
	   */

	  function localstorage() {
	    try {
	      return window.localStorage;
	    } catch (e) {}
	  }
	});
	var browser_1 = browser.log;
	var browser_2 = browser.formatArgs;
	var browser_3 = browser.save;
	var browser_4 = browser.load;
	var browser_5 = browser.useColors;
	var browser_6 = browser.storage;
	var browser_7 = browser.colors;

	var browser$1 = /*#__PURE__*/Object.freeze({
		default: browser,
		__moduleExports: browser,
		log: browser_1,
		formatArgs: browser_2,
		save: browser_3,
		load: browser_4,
		useColors: browser_5,
		storage: browser_6,
		colors: browser_7
	});

	var parseuri$2 = ( parseuri$1 && parseuri ) || parseuri$1;

	var require$$0$2 = ( browser$1 && browser ) || browser$1;

	/**
	 * Module dependencies.
	 */

	var debug$2 = require$$0$2('socket.io-client:url');

	/**
	 * Module exports.
	 */

	var url_1 = url;

	/**
	 * URL parser.
	 *
	 * @param {String} url
	 * @param {Object} An object meant to mimic window.location.
	 *                 Defaults to window.location.
	 * @api public
	 */

	function url(uri, loc) {
	  var obj = uri;

	  // default to window.location
	  loc = loc || commonjsGlobal.location;
	  if (null == uri) uri = loc.protocol + '//' + loc.host;

	  // relative path support
	  if ('string' === typeof uri) {
	    if ('/' === uri.charAt(0)) {
	      if ('/' === uri.charAt(1)) {
	        uri = loc.protocol + uri;
	      } else {
	        uri = loc.host + uri;
	      }
	    }

	    if (!/^(https?|wss?):\/\//.test(uri)) {
	      debug$2('protocol-less url %s', uri);
	      if ('undefined' !== typeof loc) {
	        uri = loc.protocol + '//' + uri;
	      } else {
	        uri = 'https://' + uri;
	      }
	    }

	    // parse
	    debug$2('parse %s', uri);
	    obj = parseuri$2(uri);
	  }

	  // make sure we treat `localhost:80` and `localhost` equally
	  if (!obj.port) {
	    if (/^(http|ws)$/.test(obj.protocol)) {
	      obj.port = '80';
	    } else if (/^(http|ws)s$/.test(obj.protocol)) {
	      obj.port = '443';
	    }
	  }

	  obj.path = obj.path || '/';

	  var ipv6 = obj.host.indexOf(':') !== -1;
	  var host = ipv6 ? '[' + obj.host + ']' : obj.host;

	  // define unique id
	  obj.id = obj.protocol + '://' + host + ':' + obj.port;
	  // define href
	  obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : ':' + obj.port);

	  return obj;
	}

	var url$1 = /*#__PURE__*/Object.freeze({
		default: url_1,
		__moduleExports: url_1
	});

	var componentEmitter = createCommonjsModule(function (module) {
	  /**
	   * Expose `Emitter`.
	   */

	  {
	    module.exports = Emitter;
	  }

	  /**
	   * Initialize a new `Emitter`.
	   *
	   * @api public
	   */

	  function Emitter(obj) {
	    if (obj) return mixin(obj);
	  }
	  /**
	   * Mixin the emitter properties.
	   *
	   * @param {Object} obj
	   * @return {Object}
	   * @api private
	   */

	  function mixin(obj) {
	    for (var key in Emitter.prototype) {
	      obj[key] = Emitter.prototype[key];
	    }
	    return obj;
	  }

	  /**
	   * Listen on the given `event` with `fn`.
	   *
	   * @param {String} event
	   * @param {Function} fn
	   * @return {Emitter}
	   * @api public
	   */

	  Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
	    this._callbacks = this._callbacks || {};
	    (this._callbacks['$' + event] = this._callbacks['$' + event] || []).push(fn);
	    return this;
	  };

	  /**
	   * Adds an `event` listener that will be invoked a single
	   * time then automatically removed.
	   *
	   * @param {String} event
	   * @param {Function} fn
	   * @return {Emitter}
	   * @api public
	   */

	  Emitter.prototype.once = function (event, fn) {
	    function on() {
	      this.off(event, on);
	      fn.apply(this, arguments);
	    }

	    on.fn = fn;
	    this.on(event, on);
	    return this;
	  };

	  /**
	   * Remove the given callback for `event` or all
	   * registered callbacks.
	   *
	   * @param {String} event
	   * @param {Function} fn
	   * @return {Emitter}
	   * @api public
	   */

	  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
	    this._callbacks = this._callbacks || {};

	    // all
	    if (0 == arguments.length) {
	      this._callbacks = {};
	      return this;
	    }

	    // specific event
	    var callbacks = this._callbacks['$' + event];
	    if (!callbacks) return this;

	    // remove all handlers
	    if (1 == arguments.length) {
	      delete this._callbacks['$' + event];
	      return this;
	    }

	    // remove specific handler
	    var cb;
	    for (var i = 0; i < callbacks.length; i++) {
	      cb = callbacks[i];
	      if (cb === fn || cb.fn === fn) {
	        callbacks.splice(i, 1);
	        break;
	      }
	    }
	    return this;
	  };

	  /**
	   * Emit `event` with the given args.
	   *
	   * @param {String} event
	   * @param {Mixed} ...
	   * @return {Emitter}
	   */

	  Emitter.prototype.emit = function (event) {
	    this._callbacks = this._callbacks || {};
	    var args = [].slice.call(arguments, 1),
	        callbacks = this._callbacks['$' + event];

	    if (callbacks) {
	      callbacks = callbacks.slice(0);
	      for (var i = 0, len = callbacks.length; i < len; ++i) {
	        callbacks[i].apply(this, args);
	      }
	    }

	    return this;
	  };

	  /**
	   * Return array of callbacks for `event`.
	   *
	   * @param {String} event
	   * @return {Array}
	   * @api public
	   */

	  Emitter.prototype.listeners = function (event) {
	    this._callbacks = this._callbacks || {};
	    return this._callbacks['$' + event] || [];
	  };

	  /**
	   * Check if this emitter has `event` handlers.
	   *
	   * @param {String} event
	   * @return {Boolean}
	   * @api public
	   */

	  Emitter.prototype.hasListeners = function (event) {
	    return !!this.listeners(event).length;
	  };
	});

	var componentEmitter$1 = /*#__PURE__*/Object.freeze({
		default: componentEmitter,
		__moduleExports: componentEmitter
	});

	var toString = {}.toString;

	var isarray = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};

	var isarray$1 = /*#__PURE__*/Object.freeze({
		default: isarray,
		__moduleExports: isarray
	});

	var isBuffer = isBuf;

	var withNativeBuffer = typeof commonjsGlobal.Buffer === 'function' && typeof commonjsGlobal.Buffer.isBuffer === 'function';
	var withNativeArrayBuffer = typeof commonjsGlobal.ArrayBuffer === 'function';

	var isView = function () {
	  if (withNativeArrayBuffer && typeof commonjsGlobal.ArrayBuffer.isView === 'function') {
	    return commonjsGlobal.ArrayBuffer.isView;
	  } else {
	    return function (obj) {
	      return obj.buffer instanceof commonjsGlobal.ArrayBuffer;
	    };
	  }
	}();

	/**
	 * Returns true if obj is a buffer or an arraybuffer.
	 *
	 * @api private
	 */

	function isBuf(obj) {
	  return withNativeBuffer && commonjsGlobal.Buffer.isBuffer(obj) || withNativeArrayBuffer && (obj instanceof commonjsGlobal.ArrayBuffer || isView(obj));
	}

	var isBuffer$1 = /*#__PURE__*/Object.freeze({
		default: isBuffer,
		__moduleExports: isBuffer
	});

	var isArray = ( isarray$1 && isarray ) || isarray$1;

	var isBuf$1 = ( isBuffer$1 && isBuffer ) || isBuffer$1;

	/*global Blob,File*/

	/**
	 * Module requirements
	 */

	var toString$1 = Object.prototype.toString;
	var withNativeBlob = typeof commonjsGlobal.Blob === 'function' || toString$1.call(commonjsGlobal.Blob) === '[object BlobConstructor]';
	var withNativeFile = typeof commonjsGlobal.File === 'function' || toString$1.call(commonjsGlobal.File) === '[object FileConstructor]';

	/**
	 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
	 * Anything with blobs or files should be fed through removeBlobs before coming
	 * here.
	 *
	 * @param {Object} packet - socket.io event packet
	 * @return {Object} with deconstructed packet and list of buffers
	 * @api public
	 */

	var deconstructPacket = function deconstructPacket(packet) {
	  var buffers = [];
	  var packetData = packet.data;
	  var pack = packet;
	  pack.data = _deconstructPacket(packetData, buffers);
	  pack.attachments = buffers.length; // number of binary 'attachments'
	  return { packet: pack, buffers: buffers };
	};

	function _deconstructPacket(data, buffers) {
	  if (!data) return data;

	  if (isBuf$1(data)) {
	    var placeholder = { _placeholder: true, num: buffers.length };
	    buffers.push(data);
	    return placeholder;
	  } else if (isArray(data)) {
	    var newData = new Array(data.length);
	    for (var i = 0; i < data.length; i++) {
	      newData[i] = _deconstructPacket(data[i], buffers);
	    }
	    return newData;
	  } else if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' && !(data instanceof Date)) {
	    var newData = {};
	    for (var key in data) {
	      newData[key] = _deconstructPacket(data[key], buffers);
	    }
	    return newData;
	  }
	  return data;
	}

	/**
	 * Reconstructs a binary packet from its placeholder packet and buffers
	 *
	 * @param {Object} packet - event packet with placeholders
	 * @param {Array} buffers - binary buffers to put in placeholder positions
	 * @return {Object} reconstructed packet
	 * @api public
	 */

	var reconstructPacket = function reconstructPacket(packet, buffers) {
	  packet.data = _reconstructPacket(packet.data, buffers);
	  packet.attachments = undefined; // no longer useful
	  return packet;
	};

	function _reconstructPacket(data, buffers) {
	  if (!data) return data;

	  if (data && data._placeholder) {
	    return buffers[data.num]; // appropriate buffer (should be natural order anyway)
	  } else if (isArray(data)) {
	    for (var i = 0; i < data.length; i++) {
	      data[i] = _reconstructPacket(data[i], buffers);
	    }
	  } else if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
	    for (var key in data) {
	      data[key] = _reconstructPacket(data[key], buffers);
	    }
	  }

	  return data;
	}

	/**
	 * Asynchronously removes Blobs or Files from data via
	 * FileReader's readAsArrayBuffer method. Used before encoding
	 * data as msgpack. Calls callback with the blobless data.
	 *
	 * @param {Object} data
	 * @param {Function} callback
	 * @api private
	 */

	var removeBlobs = function removeBlobs(data, callback) {
	  function _removeBlobs(obj, curKey, containingObject) {
	    if (!obj) return obj;

	    // convert any blob
	    if (withNativeBlob && obj instanceof Blob || withNativeFile && obj instanceof File) {
	      pendingBlobs++;

	      // async filereader
	      var fileReader = new FileReader();
	      fileReader.onload = function () {
	        // this.result == arraybuffer
	        if (containingObject) {
	          containingObject[curKey] = this.result;
	        } else {
	          bloblessData = this.result;
	        }

	        // if nothing pending its callback time
	        if (! --pendingBlobs) {
	          callback(bloblessData);
	        }
	      };

	      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
	    } else if (isArray(obj)) {
	      // handle array
	      for (var i = 0; i < obj.length; i++) {
	        _removeBlobs(obj[i], i, obj);
	      }
	    } else if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && !isBuf$1(obj)) {
	      // and object
	      for (var key in obj) {
	        _removeBlobs(obj[key], key, obj);
	      }
	    }
	  }

	  var pendingBlobs = 0;
	  var bloblessData = data;
	  _removeBlobs(bloblessData);
	  if (!pendingBlobs) {
	    callback(bloblessData);
	  }
	};

	var binary = {
	  deconstructPacket: deconstructPacket,
	  reconstructPacket: reconstructPacket,
	  removeBlobs: removeBlobs
	};

	var binary$1 = /*#__PURE__*/Object.freeze({
		default: binary,
		__moduleExports: binary,
		deconstructPacket: deconstructPacket,
		reconstructPacket: reconstructPacket,
		removeBlobs: removeBlobs
	});

	var Emitter = ( componentEmitter$1 && componentEmitter ) || componentEmitter$1;

	var binary$2 = ( binary$1 && binary ) || binary$1;

	var socket_ioParser = createCommonjsModule(function (module, exports) {
	  /**
	   * Module dependencies.
	   */

	  var debug = require$$0$2('socket.io-parser');

	  /**
	   * Protocol version.
	   *
	   * @api public
	   */

	  exports.protocol = 4;

	  /**
	   * Packet types.
	   *
	   * @api public
	   */

	  exports.types = ['CONNECT', 'DISCONNECT', 'EVENT', 'ACK', 'ERROR', 'BINARY_EVENT', 'BINARY_ACK'];

	  /**
	   * Packet type `connect`.
	   *
	   * @api public
	   */

	  exports.CONNECT = 0;

	  /**
	   * Packet type `disconnect`.
	   *
	   * @api public
	   */

	  exports.DISCONNECT = 1;

	  /**
	   * Packet type `event`.
	   *
	   * @api public
	   */

	  exports.EVENT = 2;

	  /**
	   * Packet type `ack`.
	   *
	   * @api public
	   */

	  exports.ACK = 3;

	  /**
	   * Packet type `error`.
	   *
	   * @api public
	   */

	  exports.ERROR = 4;

	  /**
	   * Packet type 'binary event'
	   *
	   * @api public
	   */

	  exports.BINARY_EVENT = 5;

	  /**
	   * Packet type `binary ack`. For acks with binary arguments.
	   *
	   * @api public
	   */

	  exports.BINARY_ACK = 6;

	  /**
	   * Encoder constructor.
	   *
	   * @api public
	   */

	  exports.Encoder = Encoder;

	  /**
	   * Decoder constructor.
	   *
	   * @api public
	   */

	  exports.Decoder = Decoder;

	  /**
	   * A socket.io Encoder instance
	   *
	   * @api public
	   */

	  function Encoder() {}

	  var ERROR_PACKET = exports.ERROR + '"encode error"';

	  /**
	   * Encode a packet as a single string if non-binary, or as a
	   * buffer sequence, depending on packet type.
	   *
	   * @param {Object} obj - packet object
	   * @param {Function} callback - function to handle encodings (likely engine.write)
	   * @return Calls callback with Array of encodings
	   * @api public
	   */

	  Encoder.prototype.encode = function (obj, callback) {
	    debug('encoding packet %j', obj);

	    if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
	      encodeAsBinary(obj, callback);
	    } else {
	      var encoding = encodeAsString(obj);
	      callback([encoding]);
	    }
	  };

	  /**
	   * Encode packet as string.
	   *
	   * @param {Object} packet
	   * @return {String} encoded
	   * @api private
	   */

	  function encodeAsString(obj) {

	    // first is type
	    var str = '' + obj.type;

	    // attachments if we have them
	    if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
	      str += obj.attachments + '-';
	    }

	    // if we have a namespace other than `/`
	    // we append it followed by a comma `,`
	    if (obj.nsp && '/' !== obj.nsp) {
	      str += obj.nsp + ',';
	    }

	    // immediately followed by the id
	    if (null != obj.id) {
	      str += obj.id;
	    }

	    // json data
	    if (null != obj.data) {
	      var payload = tryStringify(obj.data);
	      if (payload !== false) {
	        str += payload;
	      } else {
	        return ERROR_PACKET;
	      }
	    }

	    debug('encoded %j as %s', obj, str);
	    return str;
	  }

	  function tryStringify(str) {
	    try {
	      return JSON.stringify(str);
	    } catch (e) {
	      return false;
	    }
	  }

	  /**
	   * Encode packet as 'buffer sequence' by removing blobs, and
	   * deconstructing packet into object with placeholders and
	   * a list of buffers.
	   *
	   * @param {Object} packet
	   * @return {Buffer} encoded
	   * @api private
	   */

	  function encodeAsBinary(obj, callback) {

	    function writeEncoding(bloblessData) {
	      var deconstruction = binary$2.deconstructPacket(bloblessData);
	      var pack = encodeAsString(deconstruction.packet);
	      var buffers = deconstruction.buffers;

	      buffers.unshift(pack); // add packet info to beginning of data list
	      callback(buffers); // write all the buffers
	    }

	    binary$2.removeBlobs(obj, writeEncoding);
	  }

	  /**
	   * A socket.io Decoder instance
	   *
	   * @return {Object} decoder
	   * @api public
	   */

	  function Decoder() {
	    this.reconstructor = null;
	  }

	  /**
	   * Mix in `Emitter` with Decoder.
	   */

	  Emitter(Decoder.prototype);

	  /**
	   * Decodes an ecoded packet string into packet JSON.
	   *
	   * @param {String} obj - encoded packet
	   * @return {Object} packet
	   * @api public
	   */

	  Decoder.prototype.add = function (obj) {
	    var packet;
	    if (typeof obj === 'string') {
	      packet = decodeString(obj);
	      if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) {
	        // binary packet's json
	        this.reconstructor = new BinaryReconstructor(packet);

	        // no attachments, labeled binary but no binary data to follow
	        if (this.reconstructor.reconPack.attachments === 0) {
	          this.emit('decoded', packet);
	        }
	      } else {
	        // non-binary full packet
	        this.emit('decoded', packet);
	      }
	    } else if (isBuf$1(obj) || obj.base64) {
	      // raw binary data
	      if (!this.reconstructor) {
	        throw new Error('got binary data when not reconstructing a packet');
	      } else {
	        packet = this.reconstructor.takeBinaryData(obj);
	        if (packet) {
	          // received final buffer
	          this.reconstructor = null;
	          this.emit('decoded', packet);
	        }
	      }
	    } else {
	      throw new Error('Unknown type: ' + obj);
	    }
	  };

	  /**
	   * Decode a packet String (JSON data)
	   *
	   * @param {String} str
	   * @return {Object} packet
	   * @api private
	   */

	  function decodeString(str) {
	    var i = 0;
	    // look up type
	    var p = {
	      type: Number(str.charAt(0))
	    };

	    if (null == exports.types[p.type]) {
	      return error('unknown packet type ' + p.type);
	    }

	    // look up attachments if type binary
	    if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
	      var buf = '';
	      while (str.charAt(++i) !== '-') {
	        buf += str.charAt(i);
	        if (i == str.length) break;
	      }
	      if (buf != Number(buf) || str.charAt(i) !== '-') {
	        throw new Error('Illegal attachments');
	      }
	      p.attachments = Number(buf);
	    }

	    // look up namespace (if any)
	    if ('/' === str.charAt(i + 1)) {
	      p.nsp = '';
	      while (++i) {
	        var c = str.charAt(i);
	        if (',' === c) break;
	        p.nsp += c;
	        if (i === str.length) break;
	      }
	    } else {
	      p.nsp = '/';
	    }

	    // look up id
	    var next = str.charAt(i + 1);
	    if ('' !== next && Number(next) == next) {
	      p.id = '';
	      while (++i) {
	        var c = str.charAt(i);
	        if (null == c || Number(c) != c) {
	          --i;
	          break;
	        }
	        p.id += str.charAt(i);
	        if (i === str.length) break;
	      }
	      p.id = Number(p.id);
	    }

	    // look up json data
	    if (str.charAt(++i)) {
	      var payload = tryParse(str.substr(i));
	      var isPayloadValid = payload !== false && (p.type === exports.ERROR || isArray(payload));
	      if (isPayloadValid) {
	        p.data = payload;
	      } else {
	        return error('invalid payload');
	      }
	    }

	    debug('decoded %s as %j', str, p);
	    return p;
	  }

	  function tryParse(str) {
	    try {
	      return JSON.parse(str);
	    } catch (e) {
	      return false;
	    }
	  }

	  /**
	   * Deallocates a parser's resources
	   *
	   * @api public
	   */

	  Decoder.prototype.destroy = function () {
	    if (this.reconstructor) {
	      this.reconstructor.finishedReconstruction();
	    }
	  };

	  /**
	   * A manager of a binary event's 'buffer sequence'. Should
	   * be constructed whenever a packet of type BINARY_EVENT is
	   * decoded.
	   *
	   * @param {Object} packet
	   * @return {BinaryReconstructor} initialized reconstructor
	   * @api private
	   */

	  function BinaryReconstructor(packet) {
	    this.reconPack = packet;
	    this.buffers = [];
	  }

	  /**
	   * Method to be called when binary data received from connection
	   * after a BINARY_EVENT packet.
	   *
	   * @param {Buffer | ArrayBuffer} binData - the raw binary data received
	   * @return {null | Object} returns null if more binary data is expected or
	   *   a reconstructed packet object if all buffers have been received.
	   * @api private
	   */

	  BinaryReconstructor.prototype.takeBinaryData = function (binData) {
	    this.buffers.push(binData);
	    if (this.buffers.length === this.reconPack.attachments) {
	      // done with buffer list
	      var packet = binary$2.reconstructPacket(this.reconPack, this.buffers);
	      this.finishedReconstruction();
	      return packet;
	    }
	    return null;
	  };

	  /**
	   * Cleans up binary packet reconstruction variables.
	   *
	   * @api private
	   */

	  BinaryReconstructor.prototype.finishedReconstruction = function () {
	    this.reconPack = null;
	    this.buffers = [];
	  };

	  function error(msg) {
	    return {
	      type: exports.ERROR,
	      data: 'parser error: ' + msg
	    };
	  }
	});
	var socket_ioParser_1 = socket_ioParser.protocol;
	var socket_ioParser_2 = socket_ioParser.types;
	var socket_ioParser_3 = socket_ioParser.CONNECT;
	var socket_ioParser_4 = socket_ioParser.DISCONNECT;
	var socket_ioParser_5 = socket_ioParser.EVENT;
	var socket_ioParser_6 = socket_ioParser.ACK;
	var socket_ioParser_7 = socket_ioParser.ERROR;
	var socket_ioParser_8 = socket_ioParser.BINARY_EVENT;
	var socket_ioParser_9 = socket_ioParser.BINARY_ACK;
	var socket_ioParser_10 = socket_ioParser.Encoder;
	var socket_ioParser_11 = socket_ioParser.Decoder;

	var socket_ioParser$1 = /*#__PURE__*/Object.freeze({
		default: socket_ioParser,
		__moduleExports: socket_ioParser,
		protocol: socket_ioParser_1,
		types: socket_ioParser_2,
		CONNECT: socket_ioParser_3,
		DISCONNECT: socket_ioParser_4,
		EVENT: socket_ioParser_5,
		ACK: socket_ioParser_6,
		ERROR: socket_ioParser_7,
		BINARY_EVENT: socket_ioParser_8,
		BINARY_ACK: socket_ioParser_9,
		Encoder: socket_ioParser_10,
		Decoder: socket_ioParser_11
	});

	var hasCors = createCommonjsModule(function (module) {
	  /**
	   * Module exports.
	   *
	   * Logic borrowed from Modernizr:
	   *
	   *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
	   */

	  try {
	    module.exports = typeof XMLHttpRequest !== 'undefined' && 'withCredentials' in new XMLHttpRequest();
	  } catch (err) {
	    // if XMLHttp support is disabled in IE then it will throw
	    // when trying to create
	    module.exports = false;
	  }
	});

	var hasCors$1 = /*#__PURE__*/Object.freeze({
		default: hasCors,
		__moduleExports: hasCors
	});

	var hasCORS = ( hasCors$1 && hasCors ) || hasCors$1;

	// browser shim for xmlhttprequest module


	var xmlhttprequest = function xmlhttprequest(opts) {
	  var xdomain = opts.xdomain;

	  // scheme must be same when usign XDomainRequest
	  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
	  var xscheme = opts.xscheme;

	  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
	  // https://github.com/Automattic/engine.io-client/pull/217
	  var enablesXDR = opts.enablesXDR;

	  // XMLHttpRequest can be disabled on IE
	  try {
	    if ('undefined' !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
	      return new XMLHttpRequest();
	    }
	  } catch (e) {}

	  // Use XDomainRequest for IE8 if enablesXDR is true
	  // because loading bar keeps flashing when using jsonp-polling
	  // https://github.com/yujiosaka/socke.io-ie8-loading-example
	  try {
	    if ('undefined' !== typeof XDomainRequest && !xscheme && enablesXDR) {
	      return new XDomainRequest();
	    }
	  } catch (e) {}

	  if (!xdomain) {
	    try {
	      return new commonjsGlobal[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
	    } catch (e) {}
	  }
	};

	var xmlhttprequest$1 = /*#__PURE__*/Object.freeze({
		default: xmlhttprequest,
		__moduleExports: xmlhttprequest
	});

	/**
	 * Gets the keys for an object.
	 *
	 * @return {Array} keys
	 * @api private
	 */

	var keys = Object.keys || function keys(obj) {
	  var arr = [];
	  var has = Object.prototype.hasOwnProperty;

	  for (var i in obj) {
	    if (has.call(obj, i)) {
	      arr.push(i);
	    }
	  }
	  return arr;
	};

	var keys$1 = /*#__PURE__*/Object.freeze({
		default: keys,
		__moduleExports: keys
	});

	/* global Blob File */

	/*
	 * Module requirements.
	 */

	var toString$2 = Object.prototype.toString;
	var withNativeBlob$1 = typeof Blob === 'function' || typeof Blob !== 'undefined' && toString$2.call(Blob) === '[object BlobConstructor]';
	var withNativeFile$1 = typeof File === 'function' || typeof File !== 'undefined' && toString$2.call(File) === '[object FileConstructor]';

	/**
	 * Module exports.
	 */

	var hasBinary2 = hasBinary;

	/**
	 * Checks for binary data.
	 *
	 * Supports Buffer, ArrayBuffer, Blob and File.
	 *
	 * @param {Object} anything
	 * @api public
	 */

	function hasBinary(obj) {
	  if (!obj || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') {
	    return false;
	  }

	  if (isArray(obj)) {
	    for (var i = 0, l = obj.length; i < l; i++) {
	      if (hasBinary(obj[i])) {
	        return true;
	      }
	    }
	    return false;
	  }

	  if (typeof Buffer === 'function' && Buffer.isBuffer && Buffer.isBuffer(obj) || typeof ArrayBuffer === 'function' && obj instanceof ArrayBuffer || withNativeBlob$1 && obj instanceof Blob || withNativeFile$1 && obj instanceof File) {
	    return true;
	  }

	  // see: https://github.com/Automattic/has-binary/pull/4
	  if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
	    return hasBinary(obj.toJSON(), true);
	  }

	  for (var key in obj) {
	    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
	      return true;
	    }
	  }

	  return false;
	}

	var hasBinary2$1 = /*#__PURE__*/Object.freeze({
		default: hasBinary2,
		__moduleExports: hasBinary2
	});

	/**
	 * An abstraction for slicing an arraybuffer even when
	 * ArrayBuffer.prototype.slice is not supported
	 *
	 * @api public
	 */

	var arraybuffer_slice = function arraybuffer_slice(arraybuffer, start, end) {
	  var bytes = arraybuffer.byteLength;
	  start = start || 0;
	  end = end || bytes;

	  if (arraybuffer.slice) {
	    return arraybuffer.slice(start, end);
	  }

	  if (start < 0) {
	    start += bytes;
	  }
	  if (end < 0) {
	    end += bytes;
	  }
	  if (end > bytes) {
	    end = bytes;
	  }

	  if (start >= bytes || start >= end || bytes === 0) {
	    return new ArrayBuffer(0);
	  }

	  var abv = new Uint8Array(arraybuffer);
	  var result = new Uint8Array(end - start);
	  for (var i = start, ii = 0; i < end; i++, ii++) {
	    result[ii] = abv[i];
	  }
	  return result.buffer;
	};

	var arraybuffer_slice$1 = /*#__PURE__*/Object.freeze({
		default: arraybuffer_slice,
		__moduleExports: arraybuffer_slice
	});

	var after_1 = after;

	function after(count, callback, err_cb) {
	    var bail = false;
	    err_cb = err_cb || noop;
	    proxy.count = count;

	    return count === 0 ? callback() : proxy;

	    function proxy(err, result) {
	        if (proxy.count <= 0) {
	            throw new Error('after called too many times');
	        }
	        --proxy.count;

	        // after first error, rest are passed to err_cb
	        if (err) {
	            bail = true;
	            callback(err);
	            // future error callbacks will go to error handler
	            callback = err_cb;
	        } else if (proxy.count === 0 && !bail) {
	            callback(null, result);
	        }
	    }
	}

	function noop() {}

	var after$1 = /*#__PURE__*/Object.freeze({
		default: after_1,
		__moduleExports: after_1
	});

	var utf8 = createCommonjsModule(function (module, exports) {
	(function (root) {

			// Detect free variables `exports`
			var freeExports = exports;

			// Detect free variable `module`
			var freeModule = module && module.exports == freeExports && module;

			// Detect free variable `global`, from Node.js or Browserified code,
			// and use it as `root`
			var freeGlobal = _typeof(commonjsGlobal) == 'object' && commonjsGlobal;
			if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
				root = freeGlobal;
			}

			/*--------------------------------------------------------------------------*/

			var stringFromCharCode = String.fromCharCode;

			// Taken from https://mths.be/punycode
			function ucs2decode(string) {
				var output = [];
				var counter = 0;
				var length = string.length;
				var value;
				var extra;
				while (counter < length) {
					value = string.charCodeAt(counter++);
					if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
						// high surrogate, and there is a next character
						extra = string.charCodeAt(counter++);
						if ((extra & 0xFC00) == 0xDC00) {
							// low surrogate
							output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
						} else {
							// unmatched surrogate; only append this code unit, in case the next
							// code unit is the high surrogate of a surrogate pair
							output.push(value);
							counter--;
						}
					} else {
						output.push(value);
					}
				}
				return output;
			}

			// Taken from https://mths.be/punycode
			function ucs2encode(array) {
				var length = array.length;
				var index = -1;
				var value;
				var output = '';
				while (++index < length) {
					value = array[index];
					if (value > 0xFFFF) {
						value -= 0x10000;
						output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
						value = 0xDC00 | value & 0x3FF;
					}
					output += stringFromCharCode(value);
				}
				return output;
			}

			function checkScalarValue(codePoint, strict) {
				if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
					if (strict) {
						throw Error('Lone surrogate U+' + codePoint.toString(16).toUpperCase() + ' is not a scalar value');
					}
					return false;
				}
				return true;
			}
			/*--------------------------------------------------------------------------*/

			function createByte(codePoint, shift) {
				return stringFromCharCode(codePoint >> shift & 0x3F | 0x80);
			}

			function encodeCodePoint(codePoint, strict) {
				if ((codePoint & 0xFFFFFF80) == 0) {
					// 1-byte sequence
					return stringFromCharCode(codePoint);
				}
				var symbol = '';
				if ((codePoint & 0xFFFFF800) == 0) {
					// 2-byte sequence
					symbol = stringFromCharCode(codePoint >> 6 & 0x1F | 0xC0);
				} else if ((codePoint & 0xFFFF0000) == 0) {
					// 3-byte sequence
					if (!checkScalarValue(codePoint, strict)) {
						codePoint = 0xFFFD;
					}
					symbol = stringFromCharCode(codePoint >> 12 & 0x0F | 0xE0);
					symbol += createByte(codePoint, 6);
				} else if ((codePoint & 0xFFE00000) == 0) {
					// 4-byte sequence
					symbol = stringFromCharCode(codePoint >> 18 & 0x07 | 0xF0);
					symbol += createByte(codePoint, 12);
					symbol += createByte(codePoint, 6);
				}
				symbol += stringFromCharCode(codePoint & 0x3F | 0x80);
				return symbol;
			}

			function utf8encode(string, opts) {
				opts = opts || {};
				var strict = false !== opts.strict;

				var codePoints = ucs2decode(string);
				var length = codePoints.length;
				var index = -1;
				var codePoint;
				var byteString = '';
				while (++index < length) {
					codePoint = codePoints[index];
					byteString += encodeCodePoint(codePoint, strict);
				}
				return byteString;
			}

			/*--------------------------------------------------------------------------*/

			function readContinuationByte() {
				if (byteIndex >= byteCount) {
					throw Error('Invalid byte index');
				}

				var continuationByte = byteArray[byteIndex] & 0xFF;
				byteIndex++;

				if ((continuationByte & 0xC0) == 0x80) {
					return continuationByte & 0x3F;
				}

				// If we end up here, it’s not a continuation byte
				throw Error('Invalid continuation byte');
			}

			function decodeSymbol(strict) {
				var byte1;
				var byte2;
				var byte3;
				var byte4;
				var codePoint;

				if (byteIndex > byteCount) {
					throw Error('Invalid byte index');
				}

				if (byteIndex == byteCount) {
					return false;
				}

				// Read first byte
				byte1 = byteArray[byteIndex] & 0xFF;
				byteIndex++;

				// 1-byte sequence (no continuation bytes)
				if ((byte1 & 0x80) == 0) {
					return byte1;
				}

				// 2-byte sequence
				if ((byte1 & 0xE0) == 0xC0) {
					byte2 = readContinuationByte();
					codePoint = (byte1 & 0x1F) << 6 | byte2;
					if (codePoint >= 0x80) {
						return codePoint;
					} else {
						throw Error('Invalid continuation byte');
					}
				}

				// 3-byte sequence (may include unpaired surrogates)
				if ((byte1 & 0xF0) == 0xE0) {
					byte2 = readContinuationByte();
					byte3 = readContinuationByte();
					codePoint = (byte1 & 0x0F) << 12 | byte2 << 6 | byte3;
					if (codePoint >= 0x0800) {
						return checkScalarValue(codePoint, strict) ? codePoint : 0xFFFD;
					} else {
						throw Error('Invalid continuation byte');
					}
				}

				// 4-byte sequence
				if ((byte1 & 0xF8) == 0xF0) {
					byte2 = readContinuationByte();
					byte3 = readContinuationByte();
					byte4 = readContinuationByte();
					codePoint = (byte1 & 0x07) << 0x12 | byte2 << 0x0C | byte3 << 0x06 | byte4;
					if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
						return codePoint;
					}
				}

				throw Error('Invalid UTF-8 detected');
			}

			var byteArray;
			var byteCount;
			var byteIndex;
			function utf8decode(byteString, opts) {
				opts = opts || {};
				var strict = false !== opts.strict;

				byteArray = ucs2decode(byteString);
				byteCount = byteArray.length;
				byteIndex = 0;
				var codePoints = [];
				var tmp;
				while ((tmp = decodeSymbol(strict)) !== false) {
					codePoints.push(tmp);
				}
				return ucs2encode(codePoints);
			}

			/*--------------------------------------------------------------------------*/

			var utf8 = {
				'version': '2.1.2',
				'encode': utf8encode,
				'decode': utf8decode
			};

			// Some AMD build optimizers, like r.js, check for specific condition patterns
			// like the following:
			if (typeof undefined == 'function' && _typeof(undefined.amd) == 'object' && undefined.amd) {
				undefined(function () {
					return utf8;
				});
			} else if (freeExports && !freeExports.nodeType) {
				if (freeModule) {
					// in Node.js or RingoJS v0.8.0+
					freeModule.exports = utf8;
				} else {
					// in Narwhal or RingoJS v0.7.0-
					var object = {};
					var hasOwnProperty = object.hasOwnProperty;
					for (var key in utf8) {
						hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
					}
				}
			} else {
				// in Rhino or a web browser
				root.utf8 = utf8;
			}
		})(commonjsGlobal);
	});

	var utf8$1 = /*#__PURE__*/Object.freeze({
		default: utf8,
		__moduleExports: utf8
	});

	var base64Arraybuffer = createCommonjsModule(function (module, exports) {
	  /*
	   * base64-arraybuffer
	   * https://github.com/niklasvh/base64-arraybuffer
	   *
	   * Copyright (c) 2012 Niklas von Hertzen
	   * Licensed under the MIT license.
	   */
	  (function () {

	    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

	    // Use a lookup table to find the index.
	    var lookup = new Uint8Array(256);
	    for (var i = 0; i < chars.length; i++) {
	      lookup[chars.charCodeAt(i)] = i;
	    }

	    exports.encode = function (arraybuffer) {
	      var bytes = new Uint8Array(arraybuffer),
	          i,
	          len = bytes.length,
	          base64 = "";

	      for (i = 0; i < len; i += 3) {
	        base64 += chars[bytes[i] >> 2];
	        base64 += chars[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
	        base64 += chars[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
	        base64 += chars[bytes[i + 2] & 63];
	      }

	      if (len % 3 === 2) {
	        base64 = base64.substring(0, base64.length - 1) + "=";
	      } else if (len % 3 === 1) {
	        base64 = base64.substring(0, base64.length - 2) + "==";
	      }

	      return base64;
	    };

	    exports.decode = function (base64) {
	      var bufferLength = base64.length * 0.75,
	          len = base64.length,
	          i,
	          p = 0,
	          encoded1,
	          encoded2,
	          encoded3,
	          encoded4;

	      if (base64[base64.length - 1] === "=") {
	        bufferLength--;
	        if (base64[base64.length - 2] === "=") {
	          bufferLength--;
	        }
	      }

	      var arraybuffer = new ArrayBuffer(bufferLength),
	          bytes = new Uint8Array(arraybuffer);

	      for (i = 0; i < len; i += 4) {
	        encoded1 = lookup[base64.charCodeAt(i)];
	        encoded2 = lookup[base64.charCodeAt(i + 1)];
	        encoded3 = lookup[base64.charCodeAt(i + 2)];
	        encoded4 = lookup[base64.charCodeAt(i + 3)];

	        bytes[p++] = encoded1 << 2 | encoded2 >> 4;
	        bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
	        bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
	      }

	      return arraybuffer;
	    };
	  })();
	});
	var base64Arraybuffer_1 = base64Arraybuffer.encode;
	var base64Arraybuffer_2 = base64Arraybuffer.decode;

	var base64Arraybuffer$1 = /*#__PURE__*/Object.freeze({
		default: base64Arraybuffer,
		__moduleExports: base64Arraybuffer,
		encode: base64Arraybuffer_1,
		decode: base64Arraybuffer_2
	});

	/**
	 * Create a blob builder even when vendor prefixes exist
	 */

	var BlobBuilder = commonjsGlobal.BlobBuilder || commonjsGlobal.WebKitBlobBuilder || commonjsGlobal.MSBlobBuilder || commonjsGlobal.MozBlobBuilder;

	/**
	 * Check if Blob constructor is supported
	 */

	var blobSupported = function () {
	  try {
	    var a = new Blob(['hi']);
	    return a.size === 2;
	  } catch (e) {
	    return false;
	  }
	}();

	/**
	 * Check if Blob constructor supports ArrayBufferViews
	 * Fails in Safari 6, so we need to map to ArrayBuffers there.
	 */

	var blobSupportsArrayBufferView = blobSupported && function () {
	  try {
	    var b = new Blob([new Uint8Array([1, 2])]);
	    return b.size === 2;
	  } catch (e) {
	    return false;
	  }
	}();

	/**
	 * Check if BlobBuilder is supported
	 */

	var blobBuilderSupported = BlobBuilder && BlobBuilder.prototype.append && BlobBuilder.prototype.getBlob;

	/**
	 * Helper function that maps ArrayBufferViews to ArrayBuffers
	 * Used by BlobBuilder constructor and old browsers that didn't
	 * support it in the Blob constructor.
	 */

	function mapArrayBufferViews(ary) {
	  for (var i = 0; i < ary.length; i++) {
	    var chunk = ary[i];
	    if (chunk.buffer instanceof ArrayBuffer) {
	      var buf = chunk.buffer;

	      // if this is a subarray, make a copy so we only
	      // include the subarray region from the underlying buffer
	      if (chunk.byteLength !== buf.byteLength) {
	        var copy = new Uint8Array(chunk.byteLength);
	        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
	        buf = copy.buffer;
	      }

	      ary[i] = buf;
	    }
	  }
	}

	function BlobBuilderConstructor(ary, options) {
	  options = options || {};

	  var bb = new BlobBuilder();
	  mapArrayBufferViews(ary);

	  for (var i = 0; i < ary.length; i++) {
	    bb.append(ary[i]);
	  }

	  return options.type ? bb.getBlob(options.type) : bb.getBlob();
	}
	function BlobConstructor(ary, options) {
	  mapArrayBufferViews(ary);
	  return new Blob(ary, options || {});
	}
	var blob = function () {
	  if (blobSupported) {
	    return blobSupportsArrayBufferView ? commonjsGlobal.Blob : BlobConstructor;
	  } else if (blobBuilderSupported) {
	    return BlobBuilderConstructor;
	  } else {
	    return undefined;
	  }
	}();

	var blob$1 = /*#__PURE__*/Object.freeze({
		default: blob,
		__moduleExports: blob
	});

	var keys$2 = ( keys$1 && keys ) || keys$1;

	var hasBinary$1 = ( hasBinary2$1 && hasBinary2 ) || hasBinary2$1;

	var sliceBuffer = ( arraybuffer_slice$1 && arraybuffer_slice ) || arraybuffer_slice$1;

	var after$2 = ( after$1 && after_1 ) || after$1;

	var utf8$2 = ( utf8$1 && utf8 ) || utf8$1;

	var require$$0$3 = ( base64Arraybuffer$1 && base64Arraybuffer ) || base64Arraybuffer$1;

	var Blob$1 = ( blob$1 && blob ) || blob$1;

	var browser$2 = createCommonjsModule(function (module, exports) {
	  /**
	   * Module dependencies.
	   */

	  var base64encoder;
	  if (commonjsGlobal && commonjsGlobal.ArrayBuffer) {
	    base64encoder = require$$0$3;
	  }

	  /**
	   * Check if we are running an android browser. That requires us to use
	   * ArrayBuffer with polling transports...
	   *
	   * http://ghinda.net/jpeg-blob-ajax-android/
	   */

	  var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

	  /**
	   * Check if we are running in PhantomJS.
	   * Uploading a Blob with PhantomJS does not work correctly, as reported here:
	   * https://github.com/ariya/phantomjs/issues/11395
	   * @type boolean
	   */
	  var isPhantomJS = typeof navigator !== 'undefined' && /PhantomJS/i.test(navigator.userAgent);

	  /**
	   * When true, avoids using Blobs to encode payloads.
	   * @type boolean
	   */
	  var dontSendBlobs = isAndroid || isPhantomJS;

	  /**
	   * Current protocol version.
	   */

	  exports.protocol = 3;

	  /**
	   * Packet types.
	   */

	  var packets = exports.packets = {
	    open: 0 // non-ws
	    , close: 1 // non-ws
	    , ping: 2,
	    pong: 3,
	    message: 4,
	    upgrade: 5,
	    noop: 6
	  };

	  var packetslist = keys$2(packets);

	  /**
	   * Premade error packet.
	   */

	  var err = { type: 'error', data: 'parser error' };

	  /**
	   * Create a blob api even for blob builder when vendor prefixes exist
	   */

	  /**
	   * Encodes a packet.
	   *
	   *     <packet type id> [ <data> ]
	   *
	   * Example:
	   *
	   *     5hello world
	   *     3
	   *     4
	   *
	   * Binary is encoded in an identical principle
	   *
	   * @api private
	   */

	  exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
	    if (typeof supportsBinary === 'function') {
	      callback = supportsBinary;
	      supportsBinary = false;
	    }

	    if (typeof utf8encode === 'function') {
	      callback = utf8encode;
	      utf8encode = null;
	    }

	    var data = packet.data === undefined ? undefined : packet.data.buffer || packet.data;

	    if (commonjsGlobal.ArrayBuffer && data instanceof ArrayBuffer) {
	      return encodeArrayBuffer(packet, supportsBinary, callback);
	    } else if (Blob$1 && data instanceof commonjsGlobal.Blob) {
	      return encodeBlob(packet, supportsBinary, callback);
	    }

	    // might be an object with { base64: true, data: dataAsBase64String }
	    if (data && data.base64) {
	      return encodeBase64Object(packet, callback);
	    }

	    // Sending data as a utf-8 string
	    var encoded = packets[packet.type];

	    // data fragment is optional
	    if (undefined !== packet.data) {
	      encoded += utf8encode ? utf8$2.encode(String(packet.data), { strict: false }) : String(packet.data);
	    }

	    return callback('' + encoded);
	  };

	  function encodeBase64Object(packet, callback) {
	    // packet data is an object { base64: true, data: dataAsBase64String }
	    var message = 'b' + exports.packets[packet.type] + packet.data.data;
	    return callback(message);
	  }

	  /**
	   * Encode packet helpers for binary types
	   */

	  function encodeArrayBuffer(packet, supportsBinary, callback) {
	    if (!supportsBinary) {
	      return exports.encodeBase64Packet(packet, callback);
	    }

	    var data = packet.data;
	    var contentArray = new Uint8Array(data);
	    var resultBuffer = new Uint8Array(1 + data.byteLength);

	    resultBuffer[0] = packets[packet.type];
	    for (var i = 0; i < contentArray.length; i++) {
	      resultBuffer[i + 1] = contentArray[i];
	    }

	    return callback(resultBuffer.buffer);
	  }

	  function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
	    if (!supportsBinary) {
	      return exports.encodeBase64Packet(packet, callback);
	    }

	    var fr = new FileReader();
	    fr.onload = function () {
	      packet.data = fr.result;
	      exports.encodePacket(packet, supportsBinary, true, callback);
	    };
	    return fr.readAsArrayBuffer(packet.data);
	  }

	  function encodeBlob(packet, supportsBinary, callback) {
	    if (!supportsBinary) {
	      return exports.encodeBase64Packet(packet, callback);
	    }

	    if (dontSendBlobs) {
	      return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
	    }

	    var length = new Uint8Array(1);
	    length[0] = packets[packet.type];
	    var blob = new Blob$1([length.buffer, packet.data]);

	    return callback(blob);
	  }

	  /**
	   * Encodes a packet with binary data in a base64 string
	   *
	   * @param {Object} packet, has `type` and `data`
	   * @return {String} base64 encoded message
	   */

	  exports.encodeBase64Packet = function (packet, callback) {
	    var message = 'b' + exports.packets[packet.type];
	    if (Blob$1 && packet.data instanceof commonjsGlobal.Blob) {
	      var fr = new FileReader();
	      fr.onload = function () {
	        var b64 = fr.result.split(',')[1];
	        callback(message + b64);
	      };
	      return fr.readAsDataURL(packet.data);
	    }

	    var b64data;
	    try {
	      b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
	    } catch (e) {
	      // iPhone Safari doesn't let you apply with typed arrays
	      var typed = new Uint8Array(packet.data);
	      var basic = new Array(typed.length);
	      for (var i = 0; i < typed.length; i++) {
	        basic[i] = typed[i];
	      }
	      b64data = String.fromCharCode.apply(null, basic);
	    }
	    message += commonjsGlobal.btoa(b64data);
	    return callback(message);
	  };

	  /**
	   * Decodes a packet. Changes format to Blob if requested.
	   *
	   * @return {Object} with `type` and `data` (if any)
	   * @api private
	   */

	  exports.decodePacket = function (data, binaryType, utf8decode) {
	    if (data === undefined) {
	      return err;
	    }
	    // String data
	    if (typeof data === 'string') {
	      if (data.charAt(0) === 'b') {
	        return exports.decodeBase64Packet(data.substr(1), binaryType);
	      }

	      if (utf8decode) {
	        data = tryDecode(data);
	        if (data === false) {
	          return err;
	        }
	      }
	      var type = data.charAt(0);

	      if (Number(type) != type || !packetslist[type]) {
	        return err;
	      }

	      if (data.length > 1) {
	        return { type: packetslist[type], data: data.substring(1) };
	      } else {
	        return { type: packetslist[type] };
	      }
	    }

	    var asArray = new Uint8Array(data);
	    var type = asArray[0];
	    var rest = sliceBuffer(data, 1);
	    if (Blob$1 && binaryType === 'blob') {
	      rest = new Blob$1([rest]);
	    }
	    return { type: packetslist[type], data: rest };
	  };

	  function tryDecode(data) {
	    try {
	      data = utf8$2.decode(data, { strict: false });
	    } catch (e) {
	      return false;
	    }
	    return data;
	  }

	  /**
	   * Decodes a packet encoded in a base64 string
	   *
	   * @param {String} base64 encoded message
	   * @return {Object} with `type` and `data` (if any)
	   */

	  exports.decodeBase64Packet = function (msg, binaryType) {
	    var type = packetslist[msg.charAt(0)];
	    if (!base64encoder) {
	      return { type: type, data: { base64: true, data: msg.substr(1) } };
	    }

	    var data = base64encoder.decode(msg.substr(1));

	    if (binaryType === 'blob' && Blob$1) {
	      data = new Blob$1([data]);
	    }

	    return { type: type, data: data };
	  };

	  /**
	   * Encodes multiple messages (payload).
	   *
	   *     <length>:data
	   *
	   * Example:
	   *
	   *     11:hello world2:hi
	   *
	   * If any contents are binary, they will be encoded as base64 strings. Base64
	   * encoded strings are marked with a b before the length specifier
	   *
	   * @param {Array} packets
	   * @api private
	   */

	  exports.encodePayload = function (packets, supportsBinary, callback) {
	    if (typeof supportsBinary === 'function') {
	      callback = supportsBinary;
	      supportsBinary = null;
	    }

	    var isBinary = hasBinary$1(packets);

	    if (supportsBinary && isBinary) {
	      if (Blob$1 && !dontSendBlobs) {
	        return exports.encodePayloadAsBlob(packets, callback);
	      }

	      return exports.encodePayloadAsArrayBuffer(packets, callback);
	    }

	    if (!packets.length) {
	      return callback('0:');
	    }

	    function setLengthHeader(message) {
	      return message.length + ':' + message;
	    }

	    function encodeOne(packet, doneCallback) {
	      exports.encodePacket(packet, !isBinary ? false : supportsBinary, false, function (message) {
	        doneCallback(null, setLengthHeader(message));
	      });
	    }

	    map(packets, encodeOne, function (err, results) {
	      return callback(results.join(''));
	    });
	  };

	  /**
	   * Async array map using after
	   */

	  function map(ary, each, done) {
	    var result = new Array(ary.length);
	    var next = after$2(ary.length, done);

	    var eachWithIndex = function eachWithIndex(i, el, cb) {
	      each(el, function (error, msg) {
	        result[i] = msg;
	        cb(error, result);
	      });
	    };

	    for (var i = 0; i < ary.length; i++) {
	      eachWithIndex(i, ary[i], next);
	    }
	  }

	  /*
	   * Decodes data when a payload is maybe expected. Possible binary contents are
	   * decoded from their base64 representation
	   *
	   * @param {String} data, callback method
	   * @api public
	   */

	  exports.decodePayload = function (data, binaryType, callback) {
	    if (typeof data !== 'string') {
	      return exports.decodePayloadAsBinary(data, binaryType, callback);
	    }

	    if (typeof binaryType === 'function') {
	      callback = binaryType;
	      binaryType = null;
	    }

	    var packet;
	    if (data === '') {
	      // parser error - ignoring payload
	      return callback(err, 0, 1);
	    }

	    var length = '',
	        n,
	        msg;

	    for (var i = 0, l = data.length; i < l; i++) {
	      var chr = data.charAt(i);

	      if (chr !== ':') {
	        length += chr;
	        continue;
	      }

	      if (length === '' || length != (n = Number(length))) {
	        // parser error - ignoring payload
	        return callback(err, 0, 1);
	      }

	      msg = data.substr(i + 1, n);

	      if (length != msg.length) {
	        // parser error - ignoring payload
	        return callback(err, 0, 1);
	      }

	      if (msg.length) {
	        packet = exports.decodePacket(msg, binaryType, false);

	        if (err.type === packet.type && err.data === packet.data) {
	          // parser error in individual packet - ignoring payload
	          return callback(err, 0, 1);
	        }

	        var ret = callback(packet, i + n, l);
	        if (false === ret) return;
	      }

	      // advance cursor
	      i += n;
	      length = '';
	    }

	    if (length !== '') {
	      // parser error - ignoring payload
	      return callback(err, 0, 1);
	    }
	  };

	  /**
	   * Encodes multiple messages (payload) as binary.
	   *
	   * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
	   * 255><data>
	   *
	   * Example:
	   * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
	   *
	   * @param {Array} packets
	   * @return {ArrayBuffer} encoded payload
	   * @api private
	   */

	  exports.encodePayloadAsArrayBuffer = function (packets, callback) {
	    if (!packets.length) {
	      return callback(new ArrayBuffer(0));
	    }

	    function encodeOne(packet, doneCallback) {
	      exports.encodePacket(packet, true, true, function (data) {
	        return doneCallback(null, data);
	      });
	    }

	    map(packets, encodeOne, function (err, encodedPackets) {
	      var totalLength = encodedPackets.reduce(function (acc, p) {
	        var len;
	        if (typeof p === 'string') {
	          len = p.length;
	        } else {
	          len = p.byteLength;
	        }
	        return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
	      }, 0);

	      var resultArray = new Uint8Array(totalLength);

	      var bufferIndex = 0;
	      encodedPackets.forEach(function (p) {
	        var isString = typeof p === 'string';
	        var ab = p;
	        if (isString) {
	          var view = new Uint8Array(p.length);
	          for (var i = 0; i < p.length; i++) {
	            view[i] = p.charCodeAt(i);
	          }
	          ab = view.buffer;
	        }

	        if (isString) {
	          // not true binary
	          resultArray[bufferIndex++] = 0;
	        } else {
	          // true binary
	          resultArray[bufferIndex++] = 1;
	        }

	        var lenStr = ab.byteLength.toString();
	        for (var i = 0; i < lenStr.length; i++) {
	          resultArray[bufferIndex++] = parseInt(lenStr[i]);
	        }
	        resultArray[bufferIndex++] = 255;

	        var view = new Uint8Array(ab);
	        for (var i = 0; i < view.length; i++) {
	          resultArray[bufferIndex++] = view[i];
	        }
	      });

	      return callback(resultArray.buffer);
	    });
	  };

	  /**
	   * Encode as Blob
	   */

	  exports.encodePayloadAsBlob = function (packets, callback) {
	    function encodeOne(packet, doneCallback) {
	      exports.encodePacket(packet, true, true, function (encoded) {
	        var binaryIdentifier = new Uint8Array(1);
	        binaryIdentifier[0] = 1;
	        if (typeof encoded === 'string') {
	          var view = new Uint8Array(encoded.length);
	          for (var i = 0; i < encoded.length; i++) {
	            view[i] = encoded.charCodeAt(i);
	          }
	          encoded = view.buffer;
	          binaryIdentifier[0] = 0;
	        }

	        var len = encoded instanceof ArrayBuffer ? encoded.byteLength : encoded.size;

	        var lenStr = len.toString();
	        var lengthAry = new Uint8Array(lenStr.length + 1);
	        for (var i = 0; i < lenStr.length; i++) {
	          lengthAry[i] = parseInt(lenStr[i]);
	        }
	        lengthAry[lenStr.length] = 255;

	        if (Blob$1) {
	          var blob = new Blob$1([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
	          doneCallback(null, blob);
	        }
	      });
	    }

	    map(packets, encodeOne, function (err, results) {
	      return callback(new Blob$1(results));
	    });
	  };

	  /*
	   * Decodes data when a payload is maybe expected. Strings are decoded by
	   * interpreting each byte as a key code for entries marked to start with 0. See
	   * description of encodePayloadAsBinary
	   *
	   * @param {ArrayBuffer} data, callback method
	   * @api public
	   */

	  exports.decodePayloadAsBinary = function (data, binaryType, callback) {
	    if (typeof binaryType === 'function') {
	      callback = binaryType;
	      binaryType = null;
	    }

	    var bufferTail = data;
	    var buffers = [];

	    while (bufferTail.byteLength > 0) {
	      var tailArray = new Uint8Array(bufferTail);
	      var isString = tailArray[0] === 0;
	      var msgLength = '';

	      for (var i = 1;; i++) {
	        if (tailArray[i] === 255) break;

	        // 310 = char length of Number.MAX_VALUE
	        if (msgLength.length > 310) {
	          return callback(err, 0, 1);
	        }

	        msgLength += tailArray[i];
	      }

	      bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
	      msgLength = parseInt(msgLength);

	      var msg = sliceBuffer(bufferTail, 0, msgLength);
	      if (isString) {
	        try {
	          msg = String.fromCharCode.apply(null, new Uint8Array(msg));
	        } catch (e) {
	          // iPhone Safari doesn't let you apply to typed arrays
	          var typed = new Uint8Array(msg);
	          msg = '';
	          for (var i = 0; i < typed.length; i++) {
	            msg += String.fromCharCode(typed[i]);
	          }
	        }
	      }

	      buffers.push(msg);
	      bufferTail = sliceBuffer(bufferTail, msgLength);
	    }

	    var total = buffers.length;
	    buffers.forEach(function (buffer, i) {
	      callback(exports.decodePacket(buffer, binaryType, true), i, total);
	    });
	  };
	});
	var browser_1$1 = browser$2.protocol;
	var browser_2$1 = browser$2.packets;
	var browser_3$1 = browser$2.encodePacket;
	var browser_4$1 = browser$2.encodeBase64Packet;
	var browser_5$1 = browser$2.decodePacket;
	var browser_6$1 = browser$2.decodeBase64Packet;
	var browser_7$1 = browser$2.encodePayload;
	var browser_8 = browser$2.decodePayload;
	var browser_9 = browser$2.encodePayloadAsArrayBuffer;
	var browser_10 = browser$2.encodePayloadAsBlob;
	var browser_11 = browser$2.decodePayloadAsBinary;

	var browser$3 = /*#__PURE__*/Object.freeze({
		default: browser$2,
		__moduleExports: browser$2,
		protocol: browser_1$1,
		packets: browser_2$1,
		encodePacket: browser_3$1,
		encodeBase64Packet: browser_4$1,
		decodePacket: browser_5$1,
		decodeBase64Packet: browser_6$1,
		encodePayload: browser_7$1,
		decodePayload: browser_8,
		encodePayloadAsArrayBuffer: browser_9,
		encodePayloadAsBlob: browser_10,
		decodePayloadAsBinary: browser_11
	});

	var parser = ( browser$3 && browser$2 ) || browser$3;

	/**
	 * Module dependencies.
	 */

	/**
	 * Module exports.
	 */

	var transport = Transport;

	/**
	 * Transport abstract constructor.
	 *
	 * @param {Object} options.
	 * @api private
	 */

	function Transport(opts) {
	  this.path = opts.path;
	  this.hostname = opts.hostname;
	  this.port = opts.port;
	  this.secure = opts.secure;
	  this.query = opts.query;
	  this.timestampParam = opts.timestampParam;
	  this.timestampRequests = opts.timestampRequests;
	  this.readyState = '';
	  this.agent = opts.agent || false;
	  this.socket = opts.socket;
	  this.enablesXDR = opts.enablesXDR;

	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;
	  this.forceNode = opts.forceNode;

	  // other options for Node.js client
	  this.extraHeaders = opts.extraHeaders;
	  this.localAddress = opts.localAddress;
	}

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Transport.prototype);

	/**
	 * Emits an error.
	 *
	 * @param {String} str
	 * @return {Transport} for chaining
	 * @api public
	 */

	Transport.prototype.onError = function (msg, desc) {
	  var err = new Error(msg);
	  err.type = 'TransportError';
	  err.description = desc;
	  this.emit('error', err);
	  return this;
	};

	/**
	 * Opens the transport.
	 *
	 * @api public
	 */

	Transport.prototype.open = function () {
	  if ('closed' === this.readyState || '' === this.readyState) {
	    this.readyState = 'opening';
	    this.doOpen();
	  }

	  return this;
	};

	/**
	 * Closes the transport.
	 *
	 * @api private
	 */

	Transport.prototype.close = function () {
	  if ('opening' === this.readyState || 'open' === this.readyState) {
	    this.doClose();
	    this.onClose();
	  }

	  return this;
	};

	/**
	 * Sends multiple packets.
	 *
	 * @param {Array} packets
	 * @api private
	 */

	Transport.prototype.send = function (packets) {
	  if ('open' === this.readyState) {
	    this.write(packets);
	  } else {
	    throw new Error('Transport not open');
	  }
	};

	/**
	 * Called upon open
	 *
	 * @api private
	 */

	Transport.prototype.onOpen = function () {
	  this.readyState = 'open';
	  this.writable = true;
	  this.emit('open');
	};

	/**
	 * Called with data.
	 *
	 * @param {String} data
	 * @api private
	 */

	Transport.prototype.onData = function (data) {
	  var packet = parser.decodePacket(data, this.socket.binaryType);
	  this.onPacket(packet);
	};

	/**
	 * Called with a decoded packet.
	 */

	Transport.prototype.onPacket = function (packet) {
	  this.emit('packet', packet);
	};

	/**
	 * Called upon close.
	 *
	 * @api private
	 */

	Transport.prototype.onClose = function () {
	  this.readyState = 'closed';
	  this.emit('close');
	};

	var transport$1 = /*#__PURE__*/Object.freeze({
		default: transport,
		__moduleExports: transport
	});

	/**
	 * Compiles a querystring
	 * Returns string representation of the object
	 *
	 * @param {Object}
	 * @api private
	 */

	var encode = function encode(obj) {
	  var str = '';

	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      if (str.length) str += '&';
	      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
	    }
	  }

	  return str;
	};

	/**
	 * Parses a simple querystring into an object
	 *
	 * @param {String} qs
	 * @api private
	 */

	var decode = function decode(qs) {
	  var qry = {};
	  var pairs = qs.split('&');
	  for (var i = 0, l = pairs.length; i < l; i++) {
	    var pair = pairs[i].split('=');
	    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
	  }
	  return qry;
	};

	var parseqs = {
	  encode: encode,
	  decode: decode
	};

	var parseqs$1 = /*#__PURE__*/Object.freeze({
		default: parseqs,
		__moduleExports: parseqs,
		encode: encode,
		decode: decode
	});

	var componentInherit = function componentInherit(a, b) {
	  var fn = function fn() {};
	  fn.prototype = b.prototype;
	  a.prototype = new fn();
	  a.prototype.constructor = a;
	};

	var componentInherit$1 = /*#__PURE__*/Object.freeze({
		default: componentInherit,
		__moduleExports: componentInherit
	});

	var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''),
	    length = 64,
	    map = {},
	    seed = 0,
	    i = 0,
	    prev;

	/**
	 * Return a string representing the specified number.
	 *
	 * @param {Number} num The number to convert.
	 * @returns {String} The string representation of the number.
	 * @api public
	 */
	function encode$1(num) {
	  var encoded = '';

	  do {
	    encoded = alphabet[num % length] + encoded;
	    num = Math.floor(num / length);
	  } while (num > 0);

	  return encoded;
	}

	/**
	 * Return the integer value specified by the given string.
	 *
	 * @param {String} str The string to convert.
	 * @returns {Number} The integer value represented by the string.
	 * @api public
	 */
	function decode$1(str) {
	  var decoded = 0;

	  for (i = 0; i < str.length; i++) {
	    decoded = decoded * length + map[str.charAt(i)];
	  }

	  return decoded;
	}

	/**
	 * Yeast: A tiny growing id generator.
	 *
	 * @returns {String} A unique id.
	 * @api public
	 */
	function yeast() {
	  var now = encode$1(+new Date());

	  if (now !== prev) return seed = 0, prev = now;
	  return now + '.' + encode$1(seed++);
	}

	//
	// Map each character to its index.
	//
	for (; i < length; i++) {
	  map[alphabet[i]] = i;
	} //
	// Expose the `yeast`, `encode` and `decode` functions.
	//
	yeast.encode = encode$1;
	yeast.decode = decode$1;
	var yeast_1 = yeast;

	var yeast$1 = /*#__PURE__*/Object.freeze({
		default: yeast_1,
		__moduleExports: yeast_1
	});

	var Transport$1 = ( transport$1 && transport ) || transport$1;

	var parseqs$2 = ( parseqs$1 && parseqs ) || parseqs$1;

	var inherit = ( componentInherit$1 && componentInherit ) || componentInherit$1;

	var yeast$2 = ( yeast$1 && yeast_1 ) || yeast$1;

	var require$$1 = ( xmlhttprequest$1 && xmlhttprequest ) || xmlhttprequest$1;

	/**
	 * Module dependencies.
	 */

	var debug$3 = require$$0$2('engine.io-client:polling');

	/**
	 * Module exports.
	 */

	var polling = Polling;

	/**
	 * Is XHR2 supported?
	 */

	var hasXHR2 = function () {
	  var XMLHttpRequest = require$$1;
	  var xhr = new XMLHttpRequest({ xdomain: false });
	  return null != xhr.responseType;
	}();

	/**
	 * Polling interface.
	 *
	 * @param {Object} opts
	 * @api private
	 */

	function Polling(opts) {
	  var forceBase64 = opts && opts.forceBase64;
	  if (!hasXHR2 || forceBase64) {
	    this.supportsBinary = false;
	  }
	  Transport$1.call(this, opts);
	}

	/**
	 * Inherits from Transport.
	 */

	inherit(Polling, Transport$1);

	/**
	 * Transport name.
	 */

	Polling.prototype.name = 'polling';

	/**
	 * Opens the socket (triggers polling). We write a PING message to determine
	 * when the transport is open.
	 *
	 * @api private
	 */

	Polling.prototype.doOpen = function () {
	  this.poll();
	};

	/**
	 * Pauses polling.
	 *
	 * @param {Function} callback upon buffers are flushed and transport is paused
	 * @api private
	 */

	Polling.prototype.pause = function (onPause) {
	  var self = this;

	  this.readyState = 'pausing';

	  function pause() {
	    debug$3('paused');
	    self.readyState = 'paused';
	    onPause();
	  }

	  if (this.polling || !this.writable) {
	    var total = 0;

	    if (this.polling) {
	      debug$3('we are currently polling - waiting to pause');
	      total++;
	      this.once('pollComplete', function () {
	        debug$3('pre-pause polling complete');
	        --total || pause();
	      });
	    }

	    if (!this.writable) {
	      debug$3('we are currently writing - waiting to pause');
	      total++;
	      this.once('drain', function () {
	        debug$3('pre-pause writing complete');
	        --total || pause();
	      });
	    }
	  } else {
	    pause();
	  }
	};

	/**
	 * Starts polling cycle.
	 *
	 * @api public
	 */

	Polling.prototype.poll = function () {
	  debug$3('polling');
	  this.polling = true;
	  this.doPoll();
	  this.emit('poll');
	};

	/**
	 * Overloads onData to detect payloads.
	 *
	 * @api private
	 */

	Polling.prototype.onData = function (data) {
	  var self = this;
	  debug$3('polling got data %s', data);
	  var callback = function callback(packet, index, total) {
	    // if its the first message we consider the transport open
	    if ('opening' === self.readyState) {
	      self.onOpen();
	    }

	    // if its a close packet, we close the ongoing requests
	    if ('close' === packet.type) {
	      self.onClose();
	      return false;
	    }

	    // otherwise bypass onData and handle the message
	    self.onPacket(packet);
	  };

	  // decode payload
	  parser.decodePayload(data, this.socket.binaryType, callback);

	  // if an event did not trigger closing
	  if ('closed' !== this.readyState) {
	    // if we got data we're not polling
	    this.polling = false;
	    this.emit('pollComplete');

	    if ('open' === this.readyState) {
	      this.poll();
	    } else {
	      debug$3('ignoring poll - transport state "%s"', this.readyState);
	    }
	  }
	};

	/**
	 * For polling, send a close packet.
	 *
	 * @api private
	 */

	Polling.prototype.doClose = function () {
	  var self = this;

	  function close() {
	    debug$3('writing close packet');
	    self.write([{ type: 'close' }]);
	  }

	  if ('open' === this.readyState) {
	    debug$3('transport open - closing');
	    close();
	  } else {
	    // in case we're trying to close while
	    // handshaking is in progress (GH-164)
	    debug$3('transport not open - deferring close');
	    this.once('open', close);
	  }
	};

	/**
	 * Writes a packets payload.
	 *
	 * @param {Array} data packets
	 * @param {Function} drain callback
	 * @api private
	 */

	Polling.prototype.write = function (packets) {
	  var self = this;
	  this.writable = false;
	  var callbackfn = function callbackfn() {
	    self.writable = true;
	    self.emit('drain');
	  };

	  parser.encodePayload(packets, this.supportsBinary, function (data) {
	    self.doWrite(data, callbackfn);
	  });
	};

	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */

	Polling.prototype.uri = function () {
	  var query = this.query || {};
	  var schema = this.secure ? 'https' : 'http';
	  var port = '';

	  // cache busting is forced
	  if (false !== this.timestampRequests) {
	    query[this.timestampParam] = yeast$2();
	  }

	  if (!this.supportsBinary && !query.sid) {
	    query.b64 = 1;
	  }

	  query = parseqs$2.encode(query);

	  // avoid port if default for schema
	  if (this.port && ('https' === schema && Number(this.port) !== 443 || 'http' === schema && Number(this.port) !== 80)) {
	    port = ':' + this.port;
	  }

	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }

	  var ipv6 = this.hostname.indexOf(':') !== -1;
	  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
	};

	var polling$1 = /*#__PURE__*/Object.freeze({
		default: polling,
		__moduleExports: polling
	});

	var Polling$1 = ( polling$1 && polling ) || polling$1;

	/**
	 * Module requirements.
	 */

	var debug$4 = require$$0$2('engine.io-client:polling-xhr');

	/**
	 * Module exports.
	 */

	var pollingXhr = XHR;
	var Request_1 = Request;

	/**
	 * Empty function
	 */

	function empty() {}

	/**
	 * XHR Polling constructor.
	 *
	 * @param {Object} opts
	 * @api public
	 */

	function XHR(opts) {
	  Polling$1.call(this, opts);
	  this.requestTimeout = opts.requestTimeout;
	  this.extraHeaders = opts.extraHeaders;

	  if (commonjsGlobal.location) {
	    var isSSL = 'https:' === location.protocol;
	    var port = location.port;

	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }

	    this.xd = opts.hostname !== commonjsGlobal.location.hostname || port !== opts.port;
	    this.xs = opts.secure !== isSSL;
	  }
	}

	/**
	 * Inherits from Polling.
	 */

	inherit(XHR, Polling$1);

	/**
	 * XHR supports binary
	 */

	XHR.prototype.supportsBinary = true;

	/**
	 * Creates a request.
	 *
	 * @param {String} method
	 * @api private
	 */

	XHR.prototype.request = function (opts) {
	  opts = opts || {};
	  opts.uri = this.uri();
	  opts.xd = this.xd;
	  opts.xs = this.xs;
	  opts.agent = this.agent || false;
	  opts.supportsBinary = this.supportsBinary;
	  opts.enablesXDR = this.enablesXDR;

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;
	  opts.requestTimeout = this.requestTimeout;

	  // other options for Node.js client
	  opts.extraHeaders = this.extraHeaders;

	  return new Request(opts);
	};

	/**
	 * Sends data.
	 *
	 * @param {String} data to send.
	 * @param {Function} called upon flush.
	 * @api private
	 */

	XHR.prototype.doWrite = function (data, fn) {
	  var isBinary = typeof data !== 'string' && data !== undefined;
	  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
	  var self = this;
	  req.on('success', fn);
	  req.on('error', function (err) {
	    self.onError('xhr post error', err);
	  });
	  this.sendXhr = req;
	};

	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */

	XHR.prototype.doPoll = function () {
	  debug$4('xhr poll');
	  var req = this.request();
	  var self = this;
	  req.on('data', function (data) {
	    self.onData(data);
	  });
	  req.on('error', function (err) {
	    self.onError('xhr poll error', err);
	  });
	  this.pollXhr = req;
	};

	/**
	 * Request constructor
	 *
	 * @param {Object} options
	 * @api public
	 */

	function Request(opts) {
	  this.method = opts.method || 'GET';
	  this.uri = opts.uri;
	  this.xd = !!opts.xd;
	  this.xs = !!opts.xs;
	  this.async = false !== opts.async;
	  this.data = undefined !== opts.data ? opts.data : null;
	  this.agent = opts.agent;
	  this.isBinary = opts.isBinary;
	  this.supportsBinary = opts.supportsBinary;
	  this.enablesXDR = opts.enablesXDR;
	  this.requestTimeout = opts.requestTimeout;

	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;

	  // other options for Node.js client
	  this.extraHeaders = opts.extraHeaders;

	  this.create();
	}

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Request.prototype);

	/**
	 * Creates the XHR object and sends the request.
	 *
	 * @api private
	 */

	Request.prototype.create = function () {
	  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;

	  var xhr = this.xhr = new require$$1(opts);
	  var self = this;

	  try {
	    debug$4('xhr open %s: %s', this.method, this.uri);
	    xhr.open(this.method, this.uri, this.async);
	    try {
	      if (this.extraHeaders) {
	        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
	        for (var i in this.extraHeaders) {
	          if (this.extraHeaders.hasOwnProperty(i)) {
	            xhr.setRequestHeader(i, this.extraHeaders[i]);
	          }
	        }
	      }
	    } catch (e) {}

	    if ('POST' === this.method) {
	      try {
	        if (this.isBinary) {
	          xhr.setRequestHeader('Content-type', 'application/octet-stream');
	        } else {
	          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
	        }
	      } catch (e) {}
	    }

	    try {
	      xhr.setRequestHeader('Accept', '*/*');
	    } catch (e) {}

	    // ie6 check
	    if ('withCredentials' in xhr) {
	      xhr.withCredentials = true;
	    }

	    if (this.requestTimeout) {
	      xhr.timeout = this.requestTimeout;
	    }

	    if (this.hasXDR()) {
	      xhr.onload = function () {
	        self.onLoad();
	      };
	      xhr.onerror = function () {
	        self.onError(xhr.responseText);
	      };
	    } else {
	      xhr.onreadystatechange = function () {
	        if (xhr.readyState === 2) {
	          try {
	            var contentType = xhr.getResponseHeader('Content-Type');
	            if (self.supportsBinary && contentType === 'application/octet-stream') {
	              xhr.responseType = 'arraybuffer';
	            }
	          } catch (e) {}
	        }
	        if (4 !== xhr.readyState) return;
	        if (200 === xhr.status || 1223 === xhr.status) {
	          self.onLoad();
	        } else {
	          // make sure the `error` event handler that's user-set
	          // does not throw in the same tick and gets caught here
	          setTimeout(function () {
	            self.onError(xhr.status);
	          }, 0);
	        }
	      };
	    }

	    debug$4('xhr data %s', this.data);
	    xhr.send(this.data);
	  } catch (e) {
	    // Need to defer since .create() is called directly fhrom the constructor
	    // and thus the 'error' event can only be only bound *after* this exception
	    // occurs.  Therefore, also, we cannot throw here at all.
	    setTimeout(function () {
	      self.onError(e);
	    }, 0);
	    return;
	  }

	  if (commonjsGlobal.document) {
	    this.index = Request.requestsCount++;
	    Request.requests[this.index] = this;
	  }
	};

	/**
	 * Called upon successful response.
	 *
	 * @api private
	 */

	Request.prototype.onSuccess = function () {
	  this.emit('success');
	  this.cleanup();
	};

	/**
	 * Called if we have data.
	 *
	 * @api private
	 */

	Request.prototype.onData = function (data) {
	  this.emit('data', data);
	  this.onSuccess();
	};

	/**
	 * Called upon error.
	 *
	 * @api private
	 */

	Request.prototype.onError = function (err) {
	  this.emit('error', err);
	  this.cleanup(true);
	};

	/**
	 * Cleans up house.
	 *
	 * @api private
	 */

	Request.prototype.cleanup = function (fromError) {
	  if ('undefined' === typeof this.xhr || null === this.xhr) {
	    return;
	  }
	  // xmlhttprequest
	  if (this.hasXDR()) {
	    this.xhr.onload = this.xhr.onerror = empty;
	  } else {
	    this.xhr.onreadystatechange = empty;
	  }

	  if (fromError) {
	    try {
	      this.xhr.abort();
	    } catch (e) {}
	  }

	  if (commonjsGlobal.document) {
	    delete Request.requests[this.index];
	  }

	  this.xhr = null;
	};

	/**
	 * Called upon load.
	 *
	 * @api private
	 */

	Request.prototype.onLoad = function () {
	  var data;
	  try {
	    var contentType;
	    try {
	      contentType = this.xhr.getResponseHeader('Content-Type');
	    } catch (e) {}
	    if (contentType === 'application/octet-stream') {
	      data = this.xhr.response || this.xhr.responseText;
	    } else {
	      data = this.xhr.responseText;
	    }
	  } catch (e) {
	    this.onError(e);
	  }
	  if (null != data) {
	    this.onData(data);
	  }
	};

	/**
	 * Check if it has XDomainRequest.
	 *
	 * @api private
	 */

	Request.prototype.hasXDR = function () {
	  return 'undefined' !== typeof commonjsGlobal.XDomainRequest && !this.xs && this.enablesXDR;
	};

	/**
	 * Aborts the request.
	 *
	 * @api public
	 */

	Request.prototype.abort = function () {
	  this.cleanup();
	};

	/**
	 * Aborts pending requests when unloading the window. This is needed to prevent
	 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
	 * emitted.
	 */

	Request.requestsCount = 0;
	Request.requests = {};

	if (commonjsGlobal.document) {
	  if (commonjsGlobal.attachEvent) {
	    commonjsGlobal.attachEvent('onunload', unloadHandler);
	  } else if (commonjsGlobal.addEventListener) {
	    commonjsGlobal.addEventListener('beforeunload', unloadHandler, false);
	  }
	}

	function unloadHandler() {
	  for (var i in Request.requests) {
	    if (Request.requests.hasOwnProperty(i)) {
	      Request.requests[i].abort();
	    }
	  }
	}
	pollingXhr.Request = Request_1;

	var pollingXhr$1 = /*#__PURE__*/Object.freeze({
		default: pollingXhr,
		__moduleExports: pollingXhr,
		Request: Request_1
	});

	/**
	 * Module requirements.
	 */

	/**
	 * Module exports.
	 */

	var pollingJsonp = JSONPPolling;

	/**
	 * Cached regular expressions.
	 */

	var rNewline = /\n/g;
	var rEscapedNewline = /\\n/g;

	/**
	 * Global JSONP callbacks.
	 */

	var callbacks;

	/**
	 * Noop.
	 */

	function empty$1() {}

	/**
	 * JSONP Polling constructor.
	 *
	 * @param {Object} opts.
	 * @api public
	 */

	function JSONPPolling(opts) {
	  Polling$1.call(this, opts);

	  this.query = this.query || {};

	  // define global callbacks array if not present
	  // we do this here (lazily) to avoid unneeded global pollution
	  if (!callbacks) {
	    // we need to consider multiple engines in the same page
	    if (!commonjsGlobal.___eio) commonjsGlobal.___eio = [];
	    callbacks = commonjsGlobal.___eio;
	  }

	  // callback identifier
	  this.index = callbacks.length;

	  // add callback to jsonp global
	  var self = this;
	  callbacks.push(function (msg) {
	    self.onData(msg);
	  });

	  // append to query string
	  this.query.j = this.index;

	  // prevent spurious errors from being emitted when the window is unloaded
	  if (commonjsGlobal.document && commonjsGlobal.addEventListener) {
	    commonjsGlobal.addEventListener('beforeunload', function () {
	      if (self.script) self.script.onerror = empty$1;
	    }, false);
	  }
	}

	/**
	 * Inherits from Polling.
	 */

	inherit(JSONPPolling, Polling$1);

	/*
	 * JSONP only supports binary as base64 encoded strings
	 */

	JSONPPolling.prototype.supportsBinary = false;

	/**
	 * Closes the socket.
	 *
	 * @api private
	 */

	JSONPPolling.prototype.doClose = function () {
	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }

	  if (this.form) {
	    this.form.parentNode.removeChild(this.form);
	    this.form = null;
	    this.iframe = null;
	  }

	  Polling$1.prototype.doClose.call(this);
	};

	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */

	JSONPPolling.prototype.doPoll = function () {
	  var self = this;
	  var script = document.createElement('script');

	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }

	  script.async = true;
	  script.src = this.uri();
	  script.onerror = function (e) {
	    self.onError('jsonp poll error', e);
	  };

	  var insertAt = document.getElementsByTagName('script')[0];
	  if (insertAt) {
	    insertAt.parentNode.insertBefore(script, insertAt);
	  } else {
	    (document.head || document.body).appendChild(script);
	  }
	  this.script = script;

	  var isUAgecko = 'undefined' !== typeof navigator && /gecko/i.test(navigator.userAgent);

	  if (isUAgecko) {
	    setTimeout(function () {
	      var iframe = document.createElement('iframe');
	      document.body.appendChild(iframe);
	      document.body.removeChild(iframe);
	    }, 100);
	  }
	};

	/**
	 * Writes with a hidden iframe.
	 *
	 * @param {String} data to send
	 * @param {Function} called upon flush.
	 * @api private
	 */

	JSONPPolling.prototype.doWrite = function (data, fn) {
	  var self = this;

	  if (!this.form) {
	    var form = document.createElement('form');
	    var area = document.createElement('textarea');
	    var id = this.iframeId = 'eio_iframe_' + this.index;
	    var iframe;

	    form.className = 'socketio';
	    form.style.position = 'absolute';
	    form.style.top = '-1000px';
	    form.style.left = '-1000px';
	    form.target = id;
	    form.method = 'POST';
	    form.setAttribute('accept-charset', 'utf-8');
	    area.name = 'd';
	    form.appendChild(area);
	    document.body.appendChild(form);

	    this.form = form;
	    this.area = area;
	  }

	  this.form.action = this.uri();

	  function complete() {
	    initIframe();
	    fn();
	  }

	  function initIframe() {
	    if (self.iframe) {
	      try {
	        self.form.removeChild(self.iframe);
	      } catch (e) {
	        self.onError('jsonp polling iframe removal error', e);
	      }
	    }

	    try {
	      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
	      var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
	      iframe = document.createElement(html);
	    } catch (e) {
	      iframe = document.createElement('iframe');
	      iframe.name = self.iframeId;
	      iframe.src = 'javascript:0';
	    }

	    iframe.id = self.iframeId;

	    self.form.appendChild(iframe);
	    self.iframe = iframe;
	  }

	  initIframe();

	  // escape \n to prevent it from being converted into \r\n by some UAs
	  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
	  data = data.replace(rEscapedNewline, '\\\n');
	  this.area.value = data.replace(rNewline, '\\n');

	  try {
	    this.form.submit();
	  } catch (e) {}

	  if (this.iframe.attachEvent) {
	    this.iframe.onreadystatechange = function () {
	      if (self.iframe.readyState === 'complete') {
	        complete();
	      }
	    };
	  } else {
	    this.iframe.onload = complete;
	  }
	};

	var pollingJsonp$1 = /*#__PURE__*/Object.freeze({
		default: pollingJsonp,
		__moduleExports: pollingJsonp
	});

	var empty$2 = {};

	var empty$3 = /*#__PURE__*/Object.freeze({
		default: empty$2
	});

	var require$$1$1 = ( empty$3 && empty$2 ) || empty$3;

	/**
	 * Module dependencies.
	 */

	var debug$5 = require$$0$2('engine.io-client:websocket');
	var BrowserWebSocket = commonjsGlobal.WebSocket || commonjsGlobal.MozWebSocket;
	var NodeWebSocket;
	if (typeof window === 'undefined') {
	  try {
	    NodeWebSocket = require$$1$1;
	  } catch (e) {}
	}

	/**
	 * Get either the `WebSocket` or `MozWebSocket` globals
	 * in the browser or try to resolve WebSocket-compatible
	 * interface exposed by `ws` for Node-like environment.
	 */

	var WebSocket = BrowserWebSocket;
	if (!WebSocket && typeof window === 'undefined') {
	  WebSocket = NodeWebSocket;
	}

	/**
	 * Module exports.
	 */

	var websocket = WS;

	/**
	 * WebSocket transport constructor.
	 *
	 * @api {Object} connection options
	 * @api public
	 */

	function WS(opts) {
	  var forceBase64 = opts && opts.forceBase64;
	  if (forceBase64) {
	    this.supportsBinary = false;
	  }
	  this.perMessageDeflate = opts.perMessageDeflate;
	  this.usingBrowserWebSocket = BrowserWebSocket && !opts.forceNode;
	  this.protocols = opts.protocols;
	  if (!this.usingBrowserWebSocket) {
	    WebSocket = NodeWebSocket;
	  }
	  Transport$1.call(this, opts);
	}

	/**
	 * Inherits from Transport.
	 */

	inherit(WS, Transport$1);

	/**
	 * Transport name.
	 *
	 * @api public
	 */

	WS.prototype.name = 'websocket';

	/*
	 * WebSockets support binary
	 */

	WS.prototype.supportsBinary = true;

	/**
	 * Opens socket.
	 *
	 * @api private
	 */

	WS.prototype.doOpen = function () {
	  if (!this.check()) {
	    // let probe timeout
	    return;
	  }

	  var uri = this.uri();
	  var protocols = this.protocols;
	  var opts = {
	    agent: this.agent,
	    perMessageDeflate: this.perMessageDeflate
	  };

	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;
	  if (this.extraHeaders) {
	    opts.headers = this.extraHeaders;
	  }
	  if (this.localAddress) {
	    opts.localAddress = this.localAddress;
	  }

	  try {
	    this.ws = this.usingBrowserWebSocket ? protocols ? new WebSocket(uri, protocols) : new WebSocket(uri) : new WebSocket(uri, protocols, opts);
	  } catch (err) {
	    return this.emit('error', err);
	  }

	  if (this.ws.binaryType === undefined) {
	    this.supportsBinary = false;
	  }

	  if (this.ws.supports && this.ws.supports.binary) {
	    this.supportsBinary = true;
	    this.ws.binaryType = 'nodebuffer';
	  } else {
	    this.ws.binaryType = 'arraybuffer';
	  }

	  this.addEventListeners();
	};

	/**
	 * Adds event listeners to the socket
	 *
	 * @api private
	 */

	WS.prototype.addEventListeners = function () {
	  var self = this;

	  this.ws.onopen = function () {
	    self.onOpen();
	  };
	  this.ws.onclose = function () {
	    self.onClose();
	  };
	  this.ws.onmessage = function (ev) {
	    self.onData(ev.data);
	  };
	  this.ws.onerror = function (e) {
	    self.onError('websocket error', e);
	  };
	};

	/**
	 * Writes data to socket.
	 *
	 * @param {Array} array of packets.
	 * @api private
	 */

	WS.prototype.write = function (packets) {
	  var self = this;
	  this.writable = false;

	  // encodePacket efficient as it uses WS framing
	  // no need for encodePayload
	  var total = packets.length;
	  for (var i = 0, l = total; i < l; i++) {
	    (function (packet) {
	      parser.encodePacket(packet, self.supportsBinary, function (data) {
	        if (!self.usingBrowserWebSocket) {
	          // always create a new object (GH-437)
	          var opts = {};
	          if (packet.options) {
	            opts.compress = packet.options.compress;
	          }

	          if (self.perMessageDeflate) {
	            var len = 'string' === typeof data ? commonjsGlobal.Buffer.byteLength(data) : data.length;
	            if (len < self.perMessageDeflate.threshold) {
	              opts.compress = false;
	            }
	          }
	        }

	        // Sometimes the websocket has already been closed but the browser didn't
	        // have a chance of informing us about it yet, in that case send will
	        // throw an error
	        try {
	          if (self.usingBrowserWebSocket) {
	            // TypeError is thrown when passing the second argument on Safari
	            self.ws.send(data);
	          } else {
	            self.ws.send(data, opts);
	          }
	        } catch (e) {
	          debug$5('websocket closed before onclose event');
	        }

	        --total || done();
	      });
	    })(packets[i]);
	  }

	  function done() {
	    self.emit('flush');

	    // fake drain
	    // defer to next tick to allow Socket to clear writeBuffer
	    setTimeout(function () {
	      self.writable = true;
	      self.emit('drain');
	    }, 0);
	  }
	};

	/**
	 * Called upon close
	 *
	 * @api private
	 */

	WS.prototype.onClose = function () {
	  Transport$1.prototype.onClose.call(this);
	};

	/**
	 * Closes socket.
	 *
	 * @api private
	 */

	WS.prototype.doClose = function () {
	  if (typeof this.ws !== 'undefined') {
	    this.ws.close();
	  }
	};

	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */

	WS.prototype.uri = function () {
	  var query = this.query || {};
	  var schema = this.secure ? 'wss' : 'ws';
	  var port = '';

	  // avoid port if default for schema
	  if (this.port && ('wss' === schema && Number(this.port) !== 443 || 'ws' === schema && Number(this.port) !== 80)) {
	    port = ':' + this.port;
	  }

	  // append timestamp to URI
	  if (this.timestampRequests) {
	    query[this.timestampParam] = yeast$2();
	  }

	  // communicate binary support capabilities
	  if (!this.supportsBinary) {
	    query.b64 = 1;
	  }

	  query = parseqs$2.encode(query);

	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }

	  var ipv6 = this.hostname.indexOf(':') !== -1;
	  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
	};

	/**
	 * Feature detection for WebSocket.
	 *
	 * @return {Boolean} whether this transport is available.
	 * @api public
	 */

	WS.prototype.check = function () {
	  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
	};

	var websocket$1 = /*#__PURE__*/Object.freeze({
		default: websocket,
		__moduleExports: websocket
	});

	var XHR$1 = ( pollingXhr$1 && pollingXhr ) || pollingXhr$1;

	var JSONP = ( pollingJsonp$1 && pollingJsonp ) || pollingJsonp$1;

	var websocket$2 = ( websocket$1 && websocket ) || websocket$1;

	/**
	 * Module dependencies
	 */

	/**
	 * Export transports.
	 */

	var polling_1 = polling$2;
	var websocket_1 = websocket$2;

	/**
	 * Polling transport polymorphic constructor.
	 * Decides on xhr vs jsonp based on feature detection.
	 *
	 * @api private
	 */

	function polling$2(opts) {
	  var xhr;
	  var xd = false;
	  var xs = false;
	  var jsonp = false !== opts.jsonp;

	  if (commonjsGlobal.location) {
	    var isSSL = 'https:' === location.protocol;
	    var port = location.port;

	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }

	    xd = opts.hostname !== location.hostname || port !== opts.port;
	    xs = opts.secure !== isSSL;
	  }

	  opts.xdomain = xd;
	  opts.xscheme = xs;
	  xhr = new require$$1(opts);

	  if ('open' in xhr && !opts.forceJSONP) {
	    return new XHR$1(opts);
	  } else {
	    if (!jsonp) throw new Error('JSONP disabled');
	    return new JSONP(opts);
	  }
	}

	var transports = {
	  polling: polling_1,
	  websocket: websocket_1
	};

	var transports$1 = /*#__PURE__*/Object.freeze({
		default: transports,
		__moduleExports: transports,
		polling: polling_1,
		websocket: websocket_1
	});

	var indexOf = [].indexOf;

	var indexof = function indexof(arr, obj) {
	  if (indexOf) return arr.indexOf(obj);
	  for (var i = 0; i < arr.length; ++i) {
	    if (arr[i] === obj) return i;
	  }
	  return -1;
	};

	var indexof$1 = /*#__PURE__*/Object.freeze({
		default: indexof,
		__moduleExports: indexof
	});

	var transports$2 = ( transports$1 && transports ) || transports$1;

	var index = ( indexof$1 && indexof ) || indexof$1;

	/**
	 * Module dependencies.
	 */

	var debug$6 = require$$0$2('engine.io-client:socket');

	/**
	 * Module exports.
	 */

	var socket = Socket;

	/**
	 * Socket constructor.
	 *
	 * @param {String|Object} uri or options
	 * @param {Object} options
	 * @api public
	 */

	function Socket(uri, opts) {
	  if (!(this instanceof Socket)) return new Socket(uri, opts);

	  opts = opts || {};

	  if (uri && 'object' === (typeof uri === 'undefined' ? 'undefined' : _typeof(uri))) {
	    opts = uri;
	    uri = null;
	  }

	  if (uri) {
	    uri = parseuri$2(uri);
	    opts.hostname = uri.host;
	    opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
	    opts.port = uri.port;
	    if (uri.query) opts.query = uri.query;
	  } else if (opts.host) {
	    opts.hostname = parseuri$2(opts.host).host;
	  }

	  this.secure = null != opts.secure ? opts.secure : commonjsGlobal.location && 'https:' === location.protocol;

	  if (opts.hostname && !opts.port) {
	    // if no port is specified manually, use the protocol default
	    opts.port = this.secure ? '443' : '80';
	  }

	  this.agent = opts.agent || false;
	  this.hostname = opts.hostname || (commonjsGlobal.location ? location.hostname : 'localhost');
	  this.port = opts.port || (commonjsGlobal.location && location.port ? location.port : this.secure ? 443 : 80);
	  this.query = opts.query || {};
	  if ('string' === typeof this.query) this.query = parseqs$2.decode(this.query);
	  this.upgrade = false !== opts.upgrade;
	  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
	  this.forceJSONP = !!opts.forceJSONP;
	  this.jsonp = false !== opts.jsonp;
	  this.forceBase64 = !!opts.forceBase64;
	  this.enablesXDR = !!opts.enablesXDR;
	  this.timestampParam = opts.timestampParam || 't';
	  this.timestampRequests = opts.timestampRequests;
	  this.transports = opts.transports || ['polling', 'websocket'];
	  this.transportOptions = opts.transportOptions || {};
	  this.readyState = '';
	  this.writeBuffer = [];
	  this.prevBufferLen = 0;
	  this.policyPort = opts.policyPort || 843;
	  this.rememberUpgrade = opts.rememberUpgrade || false;
	  this.binaryType = null;
	  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
	  this.perMessageDeflate = false !== opts.perMessageDeflate ? opts.perMessageDeflate || {} : false;

	  if (true === this.perMessageDeflate) this.perMessageDeflate = {};
	  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
	    this.perMessageDeflate.threshold = 1024;
	  }

	  // SSL options for Node.js client
	  this.pfx = opts.pfx || null;
	  this.key = opts.key || null;
	  this.passphrase = opts.passphrase || null;
	  this.cert = opts.cert || null;
	  this.ca = opts.ca || null;
	  this.ciphers = opts.ciphers || null;
	  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;
	  this.forceNode = !!opts.forceNode;

	  // other options for Node.js client
	  var freeGlobal = _typeof(commonjsGlobal) === 'object' && commonjsGlobal;
	  if (freeGlobal.global === freeGlobal) {
	    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
	      this.extraHeaders = opts.extraHeaders;
	    }

	    if (opts.localAddress) {
	      this.localAddress = opts.localAddress;
	    }
	  }

	  // set on handshake
	  this.id = null;
	  this.upgrades = null;
	  this.pingInterval = null;
	  this.pingTimeout = null;

	  // set on heartbeat
	  this.pingIntervalTimer = null;
	  this.pingTimeoutTimer = null;

	  this.open();
	}

	Socket.priorWebsocketSuccess = false;

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Socket.prototype);

	/**
	 * Protocol version.
	 *
	 * @api public
	 */

	Socket.protocol = parser.protocol; // this is an int

	/**
	 * Expose deps for legacy compatibility
	 * and standalone browser access.
	 */

	Socket.Socket = Socket;
	Socket.Transport = Transport$1;
	Socket.transports = transports$2;
	Socket.parser = parser;

	/**
	 * Creates transport of the given type.
	 *
	 * @param {String} transport name
	 * @return {Transport}
	 * @api private
	 */

	Socket.prototype.createTransport = function (name) {
	  debug$6('creating transport "%s"', name);
	  var query = clone(this.query);

	  // append engine.io protocol identifier
	  query.EIO = parser.protocol;

	  // transport name
	  query.transport = name;

	  // per-transport options
	  var options = this.transportOptions[name] || {};

	  // session id if we already have one
	  if (this.id) query.sid = this.id;

	  var transport = new transports$2[name]({
	    query: query,
	    socket: this,
	    agent: options.agent || this.agent,
	    hostname: options.hostname || this.hostname,
	    port: options.port || this.port,
	    secure: options.secure || this.secure,
	    path: options.path || this.path,
	    forceJSONP: options.forceJSONP || this.forceJSONP,
	    jsonp: options.jsonp || this.jsonp,
	    forceBase64: options.forceBase64 || this.forceBase64,
	    enablesXDR: options.enablesXDR || this.enablesXDR,
	    timestampRequests: options.timestampRequests || this.timestampRequests,
	    timestampParam: options.timestampParam || this.timestampParam,
	    policyPort: options.policyPort || this.policyPort,
	    pfx: options.pfx || this.pfx,
	    key: options.key || this.key,
	    passphrase: options.passphrase || this.passphrase,
	    cert: options.cert || this.cert,
	    ca: options.ca || this.ca,
	    ciphers: options.ciphers || this.ciphers,
	    rejectUnauthorized: options.rejectUnauthorized || this.rejectUnauthorized,
	    perMessageDeflate: options.perMessageDeflate || this.perMessageDeflate,
	    extraHeaders: options.extraHeaders || this.extraHeaders,
	    forceNode: options.forceNode || this.forceNode,
	    localAddress: options.localAddress || this.localAddress,
	    requestTimeout: options.requestTimeout || this.requestTimeout,
	    protocols: options.protocols || void 0
	  });

	  return transport;
	};

	function clone(obj) {
	  var o = {};
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      o[i] = obj[i];
	    }
	  }
	  return o;
	}

	/**
	 * Initializes transport to use and starts probe.
	 *
	 * @api private
	 */
	Socket.prototype.open = function () {
	  var transport;
	  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
	    transport = 'websocket';
	  } else if (0 === this.transports.length) {
	    // Emit error on next tick so it can be listened to
	    var self = this;
	    setTimeout(function () {
	      self.emit('error', 'No transports available');
	    }, 0);
	    return;
	  } else {
	    transport = this.transports[0];
	  }
	  this.readyState = 'opening';

	  // Retry with the next transport if the transport is disabled (jsonp: false)
	  try {
	    transport = this.createTransport(transport);
	  } catch (e) {
	    this.transports.shift();
	    this.open();
	    return;
	  }

	  transport.open();
	  this.setTransport(transport);
	};

	/**
	 * Sets the current transport. Disables the existing one (if any).
	 *
	 * @api private
	 */

	Socket.prototype.setTransport = function (transport) {
	  debug$6('setting transport %s', transport.name);
	  var self = this;

	  if (this.transport) {
	    debug$6('clearing existing transport %s', this.transport.name);
	    this.transport.removeAllListeners();
	  }

	  // set up transport
	  this.transport = transport;

	  // set up transport listeners
	  transport.on('drain', function () {
	    self.onDrain();
	  }).on('packet', function (packet) {
	    self.onPacket(packet);
	  }).on('error', function (e) {
	    self.onError(e);
	  }).on('close', function () {
	    self.onClose('transport close');
	  });
	};

	/**
	 * Probes a transport.
	 *
	 * @param {String} transport name
	 * @api private
	 */

	Socket.prototype.probe = function (name) {
	  debug$6('probing transport "%s"', name);
	  var transport = this.createTransport(name, { probe: 1 });
	  var failed = false;
	  var self = this;

	  Socket.priorWebsocketSuccess = false;

	  function onTransportOpen() {
	    if (self.onlyBinaryUpgrades) {
	      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
	      failed = failed || upgradeLosesBinary;
	    }
	    if (failed) return;

	    debug$6('probe transport "%s" opened', name);
	    transport.send([{ type: 'ping', data: 'probe' }]);
	    transport.once('packet', function (msg) {
	      if (failed) return;
	      if ('pong' === msg.type && 'probe' === msg.data) {
	        debug$6('probe transport "%s" pong', name);
	        self.upgrading = true;
	        self.emit('upgrading', transport);
	        if (!transport) return;
	        Socket.priorWebsocketSuccess = 'websocket' === transport.name;

	        debug$6('pausing current transport "%s"', self.transport.name);
	        self.transport.pause(function () {
	          if (failed) return;
	          if ('closed' === self.readyState) return;
	          debug$6('changing transport and sending upgrade packet');

	          cleanup();

	          self.setTransport(transport);
	          transport.send([{ type: 'upgrade' }]);
	          self.emit('upgrade', transport);
	          transport = null;
	          self.upgrading = false;
	          self.flush();
	        });
	      } else {
	        debug$6('probe transport "%s" failed', name);
	        var err = new Error('probe error');
	        err.transport = transport.name;
	        self.emit('upgradeError', err);
	      }
	    });
	  }

	  function freezeTransport() {
	    if (failed) return;

	    // Any callback called by transport should be ignored since now
	    failed = true;

	    cleanup();

	    transport.close();
	    transport = null;
	  }

	  // Handle any error that happens while probing
	  function onerror(err) {
	    var error = new Error('probe error: ' + err);
	    error.transport = transport.name;

	    freezeTransport();

	    debug$6('probe transport "%s" failed because of error: %s', name, err);

	    self.emit('upgradeError', error);
	  }

	  function onTransportClose() {
	    onerror('transport closed');
	  }

	  // When the socket is closed while we're probing
	  function onclose() {
	    onerror('socket closed');
	  }

	  // When the socket is upgraded while we're probing
	  function onupgrade(to) {
	    if (transport && to.name !== transport.name) {
	      debug$6('"%s" works - aborting "%s"', to.name, transport.name);
	      freezeTransport();
	    }
	  }

	  // Remove all listeners on the transport and on self
	  function cleanup() {
	    transport.removeListener('open', onTransportOpen);
	    transport.removeListener('error', onerror);
	    transport.removeListener('close', onTransportClose);
	    self.removeListener('close', onclose);
	    self.removeListener('upgrading', onupgrade);
	  }

	  transport.once('open', onTransportOpen);
	  transport.once('error', onerror);
	  transport.once('close', onTransportClose);

	  this.once('close', onclose);
	  this.once('upgrading', onupgrade);

	  transport.open();
	};

	/**
	 * Called when connection is deemed open.
	 *
	 * @api public
	 */

	Socket.prototype.onOpen = function () {
	  debug$6('socket open');
	  this.readyState = 'open';
	  Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
	  this.emit('open');
	  this.flush();

	  // we check for `readyState` in case an `open`
	  // listener already closed the socket
	  if ('open' === this.readyState && this.upgrade && this.transport.pause) {
	    debug$6('starting upgrade probes');
	    for (var i = 0, l = this.upgrades.length; i < l; i++) {
	      this.probe(this.upgrades[i]);
	    }
	  }
	};

	/**
	 * Handles a packet.
	 *
	 * @api private
	 */

	Socket.prototype.onPacket = function (packet) {
	  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
	    debug$6('socket receive: type "%s", data "%s"', packet.type, packet.data);

	    this.emit('packet', packet);

	    // Socket is live - any packet counts
	    this.emit('heartbeat');

	    switch (packet.type) {
	      case 'open':
	        this.onHandshake(JSON.parse(packet.data));
	        break;

	      case 'pong':
	        this.setPing();
	        this.emit('pong');
	        break;

	      case 'error':
	        var err = new Error('server error');
	        err.code = packet.data;
	        this.onError(err);
	        break;

	      case 'message':
	        this.emit('data', packet.data);
	        this.emit('message', packet.data);
	        break;
	    }
	  } else {
	    debug$6('packet received with socket readyState "%s"', this.readyState);
	  }
	};

	/**
	 * Called upon handshake completion.
	 *
	 * @param {Object} handshake obj
	 * @api private
	 */

	Socket.prototype.onHandshake = function (data) {
	  this.emit('handshake', data);
	  this.id = data.sid;
	  this.transport.query.sid = data.sid;
	  this.upgrades = this.filterUpgrades(data.upgrades);
	  this.pingInterval = data.pingInterval;
	  this.pingTimeout = data.pingTimeout;
	  this.onOpen();
	  // In case open handler closes socket
	  if ('closed' === this.readyState) return;
	  this.setPing();

	  // Prolong liveness of socket on heartbeat
	  this.removeListener('heartbeat', this.onHeartbeat);
	  this.on('heartbeat', this.onHeartbeat);
	};

	/**
	 * Resets ping timeout.
	 *
	 * @api private
	 */

	Socket.prototype.onHeartbeat = function (timeout) {
	  clearTimeout(this.pingTimeoutTimer);
	  var self = this;
	  self.pingTimeoutTimer = setTimeout(function () {
	    if ('closed' === self.readyState) return;
	    self.onClose('ping timeout');
	  }, timeout || self.pingInterval + self.pingTimeout);
	};

	/**
	 * Pings server every `this.pingInterval` and expects response
	 * within `this.pingTimeout` or closes connection.
	 *
	 * @api private
	 */

	Socket.prototype.setPing = function () {
	  var self = this;
	  clearTimeout(self.pingIntervalTimer);
	  self.pingIntervalTimer = setTimeout(function () {
	    debug$6('writing ping packet - expecting pong within %sms', self.pingTimeout);
	    self.ping();
	    self.onHeartbeat(self.pingTimeout);
	  }, self.pingInterval);
	};

	/**
	* Sends a ping packet.
	*
	* @api private
	*/

	Socket.prototype.ping = function () {
	  var self = this;
	  this.sendPacket('ping', function () {
	    self.emit('ping');
	  });
	};

	/**
	 * Called on `drain` event
	 *
	 * @api private
	 */

	Socket.prototype.onDrain = function () {
	  this.writeBuffer.splice(0, this.prevBufferLen);

	  // setting prevBufferLen = 0 is very important
	  // for example, when upgrading, upgrade packet is sent over,
	  // and a nonzero prevBufferLen could cause problems on `drain`
	  this.prevBufferLen = 0;

	  if (0 === this.writeBuffer.length) {
	    this.emit('drain');
	  } else {
	    this.flush();
	  }
	};

	/**
	 * Flush write buffers.
	 *
	 * @api private
	 */

	Socket.prototype.flush = function () {
	  if ('closed' !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
	    debug$6('flushing %d packets in socket', this.writeBuffer.length);
	    this.transport.send(this.writeBuffer);
	    // keep track of current length of writeBuffer
	    // splice writeBuffer and callbackBuffer on `drain`
	    this.prevBufferLen = this.writeBuffer.length;
	    this.emit('flush');
	  }
	};

	/**
	 * Sends a message.
	 *
	 * @param {String} message.
	 * @param {Function} callback function.
	 * @param {Object} options.
	 * @return {Socket} for chaining.
	 * @api public
	 */

	Socket.prototype.write = Socket.prototype.send = function (msg, options, fn) {
	  this.sendPacket('message', msg, options, fn);
	  return this;
	};

	/**
	 * Sends a packet.
	 *
	 * @param {String} packet type.
	 * @param {String} data.
	 * @param {Object} options.
	 * @param {Function} callback function.
	 * @api private
	 */

	Socket.prototype.sendPacket = function (type, data, options, fn) {
	  if ('function' === typeof data) {
	    fn = data;
	    data = undefined;
	  }

	  if ('function' === typeof options) {
	    fn = options;
	    options = null;
	  }

	  if ('closing' === this.readyState || 'closed' === this.readyState) {
	    return;
	  }

	  options = options || {};
	  options.compress = false !== options.compress;

	  var packet = {
	    type: type,
	    data: data,
	    options: options
	  };
	  this.emit('packetCreate', packet);
	  this.writeBuffer.push(packet);
	  if (fn) this.once('flush', fn);
	  this.flush();
	};

	/**
	 * Closes the connection.
	 *
	 * @api private
	 */

	Socket.prototype.close = function () {
	  if ('opening' === this.readyState || 'open' === this.readyState) {
	    this.readyState = 'closing';

	    var self = this;

	    if (this.writeBuffer.length) {
	      this.once('drain', function () {
	        if (this.upgrading) {
	          waitForUpgrade();
	        } else {
	          close();
	        }
	      });
	    } else if (this.upgrading) {
	      waitForUpgrade();
	    } else {
	      close();
	    }
	  }

	  function close() {
	    self.onClose('forced close');
	    debug$6('socket closing - telling transport to close');
	    self.transport.close();
	  }

	  function cleanupAndClose() {
	    self.removeListener('upgrade', cleanupAndClose);
	    self.removeListener('upgradeError', cleanupAndClose);
	    close();
	  }

	  function waitForUpgrade() {
	    // wait for upgrade to finish since we can't send packets while pausing a transport
	    self.once('upgrade', cleanupAndClose);
	    self.once('upgradeError', cleanupAndClose);
	  }

	  return this;
	};

	/**
	 * Called upon transport error
	 *
	 * @api private
	 */

	Socket.prototype.onError = function (err) {
	  debug$6('socket error %j', err);
	  Socket.priorWebsocketSuccess = false;
	  this.emit('error', err);
	  this.onClose('transport error', err);
	};

	/**
	 * Called upon transport close.
	 *
	 * @api private
	 */

	Socket.prototype.onClose = function (reason, desc) {
	  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
	    debug$6('socket close with reason: "%s"', reason);
	    var self = this;

	    // clear timers
	    clearTimeout(this.pingIntervalTimer);
	    clearTimeout(this.pingTimeoutTimer);

	    // stop event from firing again for transport
	    this.transport.removeAllListeners('close');

	    // ensure transport won't stay open
	    this.transport.close();

	    // ignore further transport communication
	    this.transport.removeAllListeners();

	    // set ready state
	    this.readyState = 'closed';

	    // clear session id
	    this.id = null;

	    // emit close event
	    this.emit('close', reason, desc);

	    // clean buffers after, so users can still
	    // grab the buffers on `close` event
	    self.writeBuffer = [];
	    self.prevBufferLen = 0;
	  }
	};

	/**
	 * Filters upgrades, returning only those matching client transports.
	 *
	 * @param {Array} server upgrades
	 * @api private
	 *
	 */

	Socket.prototype.filterUpgrades = function (upgrades) {
	  var filteredUpgrades = [];
	  for (var i = 0, j = upgrades.length; i < j; i++) {
	    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
	  }
	  return filteredUpgrades;
	};

	var socket$1 = /*#__PURE__*/Object.freeze({
		default: socket,
		__moduleExports: socket
	});

	var require$$0$4 = ( socket$1 && socket ) || socket$1;

	var lib = require$$0$4;

	/**
	 * Exports parser
	 *
	 * @api public
	 *
	 */
	var parser$1 = parser;
	lib.parser = parser$1;

	var lib$1 = /*#__PURE__*/Object.freeze({
		default: lib,
		__moduleExports: lib,
		parser: parser$1
	});

	var toArray_1 = toArray$1;

	function toArray$1(list, index) {
	    var array = [];

	    index = index || 0;

	    for (var i = index || 0; i < list.length; i++) {
	        array[i - index] = list[i];
	    }

	    return array;
	}

	var toArray$2 = /*#__PURE__*/Object.freeze({
		default: toArray_1,
		__moduleExports: toArray_1
	});

	/**
	 * Module exports.
	 */

	var on_1 = on;

	/**
	 * Helper for subscriptions.
	 *
	 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
	 * @param {String} event name
	 * @param {Function} callback
	 * @api public
	 */

	function on(obj, ev, fn) {
	  obj.on(ev, fn);
	  return {
	    destroy: function destroy() {
	      obj.removeListener(ev, fn);
	    }
	  };
	}

	var on$1 = /*#__PURE__*/Object.freeze({
		default: on_1,
		__moduleExports: on_1
	});

	/**
	 * Slice reference.
	 */

	var slice = [].slice;

	/**
	 * Bind `obj` to `fn`.
	 *
	 * @param {Object} obj
	 * @param {Function|String} fn or string
	 * @return {Function}
	 * @api public
	 */

	var componentBind = function componentBind(obj, fn) {
	  if ('string' == typeof fn) fn = obj[fn];
	  if ('function' != typeof fn) throw new Error('bind() requires a function');
	  var args = slice.call(arguments, 2);
	  return function () {
	    return fn.apply(obj, args.concat(slice.call(arguments)));
	  };
	};

	var componentBind$1 = /*#__PURE__*/Object.freeze({
		default: componentBind,
		__moduleExports: componentBind
	});

	var parser$2 = ( socket_ioParser$1 && socket_ioParser ) || socket_ioParser$1;

	var toArray$3 = ( toArray$2 && toArray_1 ) || toArray$2;

	var on$2 = ( on$1 && on_1 ) || on$1;

	var bind = ( componentBind$1 && componentBind ) || componentBind$1;

	var socket$2 = createCommonjsModule(function (module, exports) {
	  /**
	   * Module dependencies.
	   */

	  var debug = require$$0$2('socket.io-client:socket');

	  /**
	   * Module exports.
	   */

	  module.exports = exports = Socket;

	  /**
	   * Internal events (blacklisted).
	   * These events can't be emitted by the user.
	   *
	   * @api private
	   */

	  var events = {
	    connect: 1,
	    connect_error: 1,
	    connect_timeout: 1,
	    connecting: 1,
	    disconnect: 1,
	    error: 1,
	    reconnect: 1,
	    reconnect_attempt: 1,
	    reconnect_failed: 1,
	    reconnect_error: 1,
	    reconnecting: 1,
	    ping: 1,
	    pong: 1
	  };

	  /**
	   * Shortcut to `Emitter#emit`.
	   */

	  var emit = Emitter.prototype.emit;

	  /**
	   * `Socket` constructor.
	   *
	   * @api public
	   */

	  function Socket(io, nsp, opts) {
	    this.io = io;
	    this.nsp = nsp;
	    this.json = this; // compat
	    this.ids = 0;
	    this.acks = {};
	    this.receiveBuffer = [];
	    this.sendBuffer = [];
	    this.connected = false;
	    this.disconnected = true;
	    this.flags = {};
	    if (opts && opts.query) {
	      this.query = opts.query;
	    }
	    if (this.io.autoConnect) this.open();
	  }

	  /**
	   * Mix in `Emitter`.
	   */

	  Emitter(Socket.prototype);

	  /**
	   * Subscribe to open, close and packet events
	   *
	   * @api private
	   */

	  Socket.prototype.subEvents = function () {
	    if (this.subs) return;

	    var io = this.io;
	    this.subs = [on$2(io, 'open', bind(this, 'onopen')), on$2(io, 'packet', bind(this, 'onpacket')), on$2(io, 'close', bind(this, 'onclose'))];
	  };

	  /**
	   * "Opens" the socket.
	   *
	   * @api public
	   */

	  Socket.prototype.open = Socket.prototype.connect = function () {
	    if (this.connected) return this;

	    this.subEvents();
	    this.io.open(); // ensure open
	    if ('open' === this.io.readyState) this.onopen();
	    this.emit('connecting');
	    return this;
	  };

	  /**
	   * Sends a `message` event.
	   *
	   * @return {Socket} self
	   * @api public
	   */

	  Socket.prototype.send = function () {
	    var args = toArray$3(arguments);
	    args.unshift('message');
	    this.emit.apply(this, args);
	    return this;
	  };

	  /**
	   * Override `emit`.
	   * If the event is in `events`, it's emitted normally.
	   *
	   * @param {String} event name
	   * @return {Socket} self
	   * @api public
	   */

	  Socket.prototype.emit = function (ev) {
	    if (events.hasOwnProperty(ev)) {
	      emit.apply(this, arguments);
	      return this;
	    }

	    var args = toArray$3(arguments);
	    var packet = {
	      type: (this.flags.binary !== undefined ? this.flags.binary : hasBinary$1(args)) ? parser$2.BINARY_EVENT : parser$2.EVENT,
	      data: args
	    };

	    packet.options = {};
	    packet.options.compress = !this.flags || false !== this.flags.compress;

	    // event ack callback
	    if ('function' === typeof args[args.length - 1]) {
	      debug('emitting packet with ack id %d', this.ids);
	      this.acks[this.ids] = args.pop();
	      packet.id = this.ids++;
	    }

	    if (this.connected) {
	      this.packet(packet);
	    } else {
	      this.sendBuffer.push(packet);
	    }

	    this.flags = {};

	    return this;
	  };

	  /**
	   * Sends a packet.
	   *
	   * @param {Object} packet
	   * @api private
	   */

	  Socket.prototype.packet = function (packet) {
	    packet.nsp = this.nsp;
	    this.io.packet(packet);
	  };

	  /**
	   * Called upon engine `open`.
	   *
	   * @api private
	   */

	  Socket.prototype.onopen = function () {
	    debug('transport is open - connecting');

	    // write connect packet if necessary
	    if ('/' !== this.nsp) {
	      if (this.query) {
	        var query = _typeof(this.query) === 'object' ? parseqs$2.encode(this.query) : this.query;
	        debug('sending connect packet with query %s', query);
	        this.packet({ type: parser$2.CONNECT, query: query });
	      } else {
	        this.packet({ type: parser$2.CONNECT });
	      }
	    }
	  };

	  /**
	   * Called upon engine `close`.
	   *
	   * @param {String} reason
	   * @api private
	   */

	  Socket.prototype.onclose = function (reason) {
	    debug('close (%s)', reason);
	    this.connected = false;
	    this.disconnected = true;
	    delete this.id;
	    this.emit('disconnect', reason);
	  };

	  /**
	   * Called with socket packet.
	   *
	   * @param {Object} packet
	   * @api private
	   */

	  Socket.prototype.onpacket = function (packet) {
	    var sameNamespace = packet.nsp === this.nsp;
	    var rootNamespaceError = packet.type === parser$2.ERROR && packet.nsp === '/';

	    if (!sameNamespace && !rootNamespaceError) return;

	    switch (packet.type) {
	      case parser$2.CONNECT:
	        this.onconnect();
	        break;

	      case parser$2.EVENT:
	        this.onevent(packet);
	        break;

	      case parser$2.BINARY_EVENT:
	        this.onevent(packet);
	        break;

	      case parser$2.ACK:
	        this.onack(packet);
	        break;

	      case parser$2.BINARY_ACK:
	        this.onack(packet);
	        break;

	      case parser$2.DISCONNECT:
	        this.ondisconnect();
	        break;

	      case parser$2.ERROR:
	        this.emit('error', packet.data);
	        break;
	    }
	  };

	  /**
	   * Called upon a server event.
	   *
	   * @param {Object} packet
	   * @api private
	   */

	  Socket.prototype.onevent = function (packet) {
	    var args = packet.data || [];
	    debug('emitting event %j', args);

	    if (null != packet.id) {
	      debug('attaching ack callback to event');
	      args.push(this.ack(packet.id));
	    }

	    if (this.connected) {
	      emit.apply(this, args);
	    } else {
	      this.receiveBuffer.push(args);
	    }
	  };

	  /**
	   * Produces an ack callback to emit with an event.
	   *
	   * @api private
	   */

	  Socket.prototype.ack = function (id) {
	    var self = this;
	    var sent = false;
	    return function () {
	      // prevent double callbacks
	      if (sent) return;
	      sent = true;
	      var args = toArray$3(arguments);
	      debug('sending ack %j', args);

	      self.packet({
	        type: hasBinary$1(args) ? parser$2.BINARY_ACK : parser$2.ACK,
	        id: id,
	        data: args
	      });
	    };
	  };

	  /**
	   * Called upon a server acknowlegement.
	   *
	   * @param {Object} packet
	   * @api private
	   */

	  Socket.prototype.onack = function (packet) {
	    var ack = this.acks[packet.id];
	    if ('function' === typeof ack) {
	      debug('calling ack %s with %j', packet.id, packet.data);
	      ack.apply(this, packet.data);
	      delete this.acks[packet.id];
	    } else {
	      debug('bad ack %s', packet.id);
	    }
	  };

	  /**
	   * Called upon server connect.
	   *
	   * @api private
	   */

	  Socket.prototype.onconnect = function () {
	    this.connected = true;
	    this.disconnected = false;
	    this.emit('connect');
	    this.emitBuffered();
	  };

	  /**
	   * Emit buffered events (received and emitted).
	   *
	   * @api private
	   */

	  Socket.prototype.emitBuffered = function () {
	    var i;
	    for (i = 0; i < this.receiveBuffer.length; i++) {
	      emit.apply(this, this.receiveBuffer[i]);
	    }
	    this.receiveBuffer = [];

	    for (i = 0; i < this.sendBuffer.length; i++) {
	      this.packet(this.sendBuffer[i]);
	    }
	    this.sendBuffer = [];
	  };

	  /**
	   * Called upon server disconnect.
	   *
	   * @api private
	   */

	  Socket.prototype.ondisconnect = function () {
	    debug('server disconnect (%s)', this.nsp);
	    this.destroy();
	    this.onclose('io server disconnect');
	  };

	  /**
	   * Called upon forced client/server side disconnections,
	   * this method ensures the manager stops tracking us and
	   * that reconnections don't get triggered for this.
	   *
	   * @api private.
	   */

	  Socket.prototype.destroy = function () {
	    if (this.subs) {
	      // clean subscriptions to avoid reconnections
	      for (var i = 0; i < this.subs.length; i++) {
	        this.subs[i].destroy();
	      }
	      this.subs = null;
	    }

	    this.io.destroy(this);
	  };

	  /**
	   * Disconnects the socket manually.
	   *
	   * @return {Socket} self
	   * @api public
	   */

	  Socket.prototype.close = Socket.prototype.disconnect = function () {
	    if (this.connected) {
	      debug('performing disconnect (%s)', this.nsp);
	      this.packet({ type: parser$2.DISCONNECT });
	    }

	    // remove socket from pool
	    this.destroy();

	    if (this.connected) {
	      // fire events
	      this.onclose('io client disconnect');
	    }
	    return this;
	  };

	  /**
	   * Sets the compress flag.
	   *
	   * @param {Boolean} if `true`, compresses the sending data
	   * @return {Socket} self
	   * @api public
	   */

	  Socket.prototype.compress = function (compress) {
	    this.flags.compress = compress;
	    return this;
	  };

	  /**
	   * Sets the binary flag
	   *
	   * @param {Boolean} whether the emitted data contains binary
	   * @return {Socket} self
	   * @api public
	   */

	  Socket.prototype.binary = function (binary) {
	    this.flags.binary = binary;
	    return this;
	  };
	});

	var socket$3 = /*#__PURE__*/Object.freeze({
		default: socket$2,
		__moduleExports: socket$2
	});

	/**
	 * Expose `Backoff`.
	 */

	var backo2 = Backoff;

	/**
	 * Initialize backoff timer with `opts`.
	 *
	 * - `min` initial timeout in milliseconds [100]
	 * - `max` max timeout [10000]
	 * - `jitter` [0]
	 * - `factor` [2]
	 *
	 * @param {Object} opts
	 * @api public
	 */

	function Backoff(opts) {
	  opts = opts || {};
	  this.ms = opts.min || 100;
	  this.max = opts.max || 10000;
	  this.factor = opts.factor || 2;
	  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
	  this.attempts = 0;
	}

	/**
	 * Return the backoff duration.
	 *
	 * @return {Number}
	 * @api public
	 */

	Backoff.prototype.duration = function () {
	  var ms = this.ms * Math.pow(this.factor, this.attempts++);
	  if (this.jitter) {
	    var rand = Math.random();
	    var deviation = Math.floor(rand * this.jitter * ms);
	    ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
	  }
	  return Math.min(ms, this.max) | 0;
	};

	/**
	 * Reset the number of attempts.
	 *
	 * @api public
	 */

	Backoff.prototype.reset = function () {
	  this.attempts = 0;
	};

	/**
	 * Set the minimum duration
	 *
	 * @api public
	 */

	Backoff.prototype.setMin = function (min) {
	  this.ms = min;
	};

	/**
	 * Set the maximum duration
	 *
	 * @api public
	 */

	Backoff.prototype.setMax = function (max) {
	  this.max = max;
	};

	/**
	 * Set the jitter
	 *
	 * @api public
	 */

	Backoff.prototype.setJitter = function (jitter) {
	  this.jitter = jitter;
	};

	var backo2$1 = /*#__PURE__*/Object.freeze({
		default: backo2,
		__moduleExports: backo2
	});

	var eio = ( lib$1 && lib ) || lib$1;

	var Socket$1 = ( socket$3 && socket$2 ) || socket$3;

	var Backoff$1 = ( backo2$1 && backo2 ) || backo2$1;

	/**
	 * Module dependencies.
	 */

	var debug$7 = require$$0$2('socket.io-client:manager');

	/**
	 * IE6+ hasOwnProperty
	 */

	var has = Object.prototype.hasOwnProperty;

	/**
	 * Module exports
	 */

	var manager = Manager;

	/**
	 * `Manager` constructor.
	 *
	 * @param {String} engine instance or engine uri/opts
	 * @param {Object} options
	 * @api public
	 */

	function Manager(uri, opts) {
	  if (!(this instanceof Manager)) return new Manager(uri, opts);
	  if (uri && 'object' === (typeof uri === 'undefined' ? 'undefined' : _typeof(uri))) {
	    opts = uri;
	    uri = undefined;
	  }
	  opts = opts || {};

	  opts.path = opts.path || '/socket.io';
	  this.nsps = {};
	  this.subs = [];
	  this.opts = opts;
	  this.reconnection(opts.reconnection !== false);
	  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
	  this.reconnectionDelay(opts.reconnectionDelay || 1000);
	  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
	  this.randomizationFactor(opts.randomizationFactor || 0.5);
	  this.backoff = new Backoff$1({
	    min: this.reconnectionDelay(),
	    max: this.reconnectionDelayMax(),
	    jitter: this.randomizationFactor()
	  });
	  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
	  this.readyState = 'closed';
	  this.uri = uri;
	  this.connecting = [];
	  this.lastPing = null;
	  this.encoding = false;
	  this.packetBuffer = [];
	  var _parser = opts.parser || parser$2;
	  this.encoder = new _parser.Encoder();
	  this.decoder = new _parser.Decoder();
	  this.autoConnect = opts.autoConnect !== false;
	  if (this.autoConnect) this.open();
	}

	/**
	 * Propagate given event to sockets and emit on `this`
	 *
	 * @api private
	 */

	Manager.prototype.emitAll = function () {
	  this.emit.apply(this, arguments);
	  for (var nsp in this.nsps) {
	    if (has.call(this.nsps, nsp)) {
	      this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
	    }
	  }
	};

	/**
	 * Update `socket.id` of all sockets
	 *
	 * @api private
	 */

	Manager.prototype.updateSocketIds = function () {
	  for (var nsp in this.nsps) {
	    if (has.call(this.nsps, nsp)) {
	      this.nsps[nsp].id = this.generateId(nsp);
	    }
	  }
	};

	/**
	 * generate `socket.id` for the given `nsp`
	 *
	 * @param {String} nsp
	 * @return {String}
	 * @api private
	 */

	Manager.prototype.generateId = function (nsp) {
	  return (nsp === '/' ? '' : nsp + '#') + this.engine.id;
	};

	/**
	 * Mix in `Emitter`.
	 */

	Emitter(Manager.prototype);

	/**
	 * Sets the `reconnection` config.
	 *
	 * @param {Boolean} true/false if it should automatically reconnect
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnection = function (v) {
	  if (!arguments.length) return this._reconnection;
	  this._reconnection = !!v;
	  return this;
	};

	/**
	 * Sets the reconnection attempts config.
	 *
	 * @param {Number} max reconnection attempts before giving up
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionAttempts = function (v) {
	  if (!arguments.length) return this._reconnectionAttempts;
	  this._reconnectionAttempts = v;
	  return this;
	};

	/**
	 * Sets the delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionDelay = function (v) {
	  if (!arguments.length) return this._reconnectionDelay;
	  this._reconnectionDelay = v;
	  this.backoff && this.backoff.setMin(v);
	  return this;
	};

	Manager.prototype.randomizationFactor = function (v) {
	  if (!arguments.length) return this._randomizationFactor;
	  this._randomizationFactor = v;
	  this.backoff && this.backoff.setJitter(v);
	  return this;
	};

	/**
	 * Sets the maximum delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.reconnectionDelayMax = function (v) {
	  if (!arguments.length) return this._reconnectionDelayMax;
	  this._reconnectionDelayMax = v;
	  this.backoff && this.backoff.setMax(v);
	  return this;
	};

	/**
	 * Sets the connection timeout. `false` to disable
	 *
	 * @return {Manager} self or value
	 * @api public
	 */

	Manager.prototype.timeout = function (v) {
	  if (!arguments.length) return this._timeout;
	  this._timeout = v;
	  return this;
	};

	/**
	 * Starts trying to reconnect if reconnection is enabled and we have not
	 * started reconnecting yet
	 *
	 * @api private
	 */

	Manager.prototype.maybeReconnectOnOpen = function () {
	  // Only try to reconnect if it's the first time we're connecting
	  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
	    // keeps reconnection from firing twice for the same reconnection loop
	    this.reconnect();
	  }
	};

	/**
	 * Sets the current transport `socket`.
	 *
	 * @param {Function} optional, callback
	 * @return {Manager} self
	 * @api public
	 */

	Manager.prototype.open = Manager.prototype.connect = function (fn, opts) {
	  debug$7('readyState %s', this.readyState);
	  if (~this.readyState.indexOf('open')) return this;

	  debug$7('opening %s', this.uri);
	  this.engine = eio(this.uri, this.opts);
	  var socket = this.engine;
	  var self = this;
	  this.readyState = 'opening';
	  this.skipReconnect = false;

	  // emit `open`
	  var openSub = on$2(socket, 'open', function () {
	    self.onopen();
	    fn && fn();
	  });

	  // emit `connect_error`
	  var errorSub = on$2(socket, 'error', function (data) {
	    debug$7('connect_error');
	    self.cleanup();
	    self.readyState = 'closed';
	    self.emitAll('connect_error', data);
	    if (fn) {
	      var err = new Error('Connection error');
	      err.data = data;
	      fn(err);
	    } else {
	      // Only do this if there is no fn to handle the error
	      self.maybeReconnectOnOpen();
	    }
	  });

	  // emit `connect_timeout`
	  if (false !== this._timeout) {
	    var timeout = this._timeout;
	    debug$7('connect attempt will timeout after %d', timeout);

	    // set timer
	    var timer = setTimeout(function () {
	      debug$7('connect attempt timed out after %d', timeout);
	      openSub.destroy();
	      socket.close();
	      socket.emit('error', 'timeout');
	      self.emitAll('connect_timeout', timeout);
	    }, timeout);

	    this.subs.push({
	      destroy: function destroy() {
	        clearTimeout(timer);
	      }
	    });
	  }

	  this.subs.push(openSub);
	  this.subs.push(errorSub);

	  return this;
	};

	/**
	 * Called upon transport open.
	 *
	 * @api private
	 */

	Manager.prototype.onopen = function () {
	  debug$7('open');

	  // clear old subs
	  this.cleanup();

	  // mark as open
	  this.readyState = 'open';
	  this.emit('open');

	  // add new subs
	  var socket = this.engine;
	  this.subs.push(on$2(socket, 'data', bind(this, 'ondata')));
	  this.subs.push(on$2(socket, 'ping', bind(this, 'onping')));
	  this.subs.push(on$2(socket, 'pong', bind(this, 'onpong')));
	  this.subs.push(on$2(socket, 'error', bind(this, 'onerror')));
	  this.subs.push(on$2(socket, 'close', bind(this, 'onclose')));
	  this.subs.push(on$2(this.decoder, 'decoded', bind(this, 'ondecoded')));
	};

	/**
	 * Called upon a ping.
	 *
	 * @api private
	 */

	Manager.prototype.onping = function () {
	  this.lastPing = new Date();
	  this.emitAll('ping');
	};

	/**
	 * Called upon a packet.
	 *
	 * @api private
	 */

	Manager.prototype.onpong = function () {
	  this.emitAll('pong', new Date() - this.lastPing);
	};

	/**
	 * Called with data.
	 *
	 * @api private
	 */

	Manager.prototype.ondata = function (data) {
	  this.decoder.add(data);
	};

	/**
	 * Called when parser fully decodes a packet.
	 *
	 * @api private
	 */

	Manager.prototype.ondecoded = function (packet) {
	  this.emit('packet', packet);
	};

	/**
	 * Called upon socket error.
	 *
	 * @api private
	 */

	Manager.prototype.onerror = function (err) {
	  debug$7('error', err);
	  this.emitAll('error', err);
	};

	/**
	 * Creates a new socket for the given `nsp`.
	 *
	 * @return {Socket}
	 * @api public
	 */

	Manager.prototype.socket = function (nsp, opts) {
	  var socket = this.nsps[nsp];
	  if (!socket) {
	    socket = new Socket$1(this, nsp, opts);
	    this.nsps[nsp] = socket;
	    var self = this;
	    socket.on('connecting', onConnecting);
	    socket.on('connect', function () {
	      socket.id = self.generateId(nsp);
	    });

	    if (this.autoConnect) {
	      // manually call here since connecting event is fired before listening
	      onConnecting();
	    }
	  }

	  function onConnecting() {
	    if (!~index(self.connecting, socket)) {
	      self.connecting.push(socket);
	    }
	  }

	  return socket;
	};

	/**
	 * Called upon a socket close.
	 *
	 * @param {Socket} socket
	 */

	Manager.prototype.destroy = function (socket) {
	  var index$$1 = index(this.connecting, socket);
	  if (~index$$1) this.connecting.splice(index$$1, 1);
	  if (this.connecting.length) return;

	  this.close();
	};

	/**
	 * Writes a packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */

	Manager.prototype.packet = function (packet) {
	  debug$7('writing packet %j', packet);
	  var self = this;
	  if (packet.query && packet.type === 0) packet.nsp += '?' + packet.query;

	  if (!self.encoding) {
	    // encode, then write to engine with result
	    self.encoding = true;
	    this.encoder.encode(packet, function (encodedPackets) {
	      for (var i = 0; i < encodedPackets.length; i++) {
	        self.engine.write(encodedPackets[i], packet.options);
	      }
	      self.encoding = false;
	      self.processPacketQueue();
	    });
	  } else {
	    // add packet to the queue
	    self.packetBuffer.push(packet);
	  }
	};

	/**
	 * If packet buffer is non-empty, begins encoding the
	 * next packet in line.
	 *
	 * @api private
	 */

	Manager.prototype.processPacketQueue = function () {
	  if (this.packetBuffer.length > 0 && !this.encoding) {
	    var pack = this.packetBuffer.shift();
	    this.packet(pack);
	  }
	};

	/**
	 * Clean up transport subscriptions and packet buffer.
	 *
	 * @api private
	 */

	Manager.prototype.cleanup = function () {
	  debug$7('cleanup');

	  var subsLength = this.subs.length;
	  for (var i = 0; i < subsLength; i++) {
	    var sub = this.subs.shift();
	    sub.destroy();
	  }

	  this.packetBuffer = [];
	  this.encoding = false;
	  this.lastPing = null;

	  this.decoder.destroy();
	};

	/**
	 * Close the current socket.
	 *
	 * @api private
	 */

	Manager.prototype.close = Manager.prototype.disconnect = function () {
	  debug$7('disconnect');
	  this.skipReconnect = true;
	  this.reconnecting = false;
	  if ('opening' === this.readyState) {
	    // `onclose` will not fire because
	    // an open event never happened
	    this.cleanup();
	  }
	  this.backoff.reset();
	  this.readyState = 'closed';
	  if (this.engine) this.engine.close();
	};

	/**
	 * Called upon engine close.
	 *
	 * @api private
	 */

	Manager.prototype.onclose = function (reason) {
	  debug$7('onclose');

	  this.cleanup();
	  this.backoff.reset();
	  this.readyState = 'closed';
	  this.emit('close', reason);

	  if (this._reconnection && !this.skipReconnect) {
	    this.reconnect();
	  }
	};

	/**
	 * Attempt a reconnection.
	 *
	 * @api private
	 */

	Manager.prototype.reconnect = function () {
	  if (this.reconnecting || this.skipReconnect) return this;

	  var self = this;

	  if (this.backoff.attempts >= this._reconnectionAttempts) {
	    debug$7('reconnect failed');
	    this.backoff.reset();
	    this.emitAll('reconnect_failed');
	    this.reconnecting = false;
	  } else {
	    var delay = this.backoff.duration();
	    debug$7('will wait %dms before reconnect attempt', delay);

	    this.reconnecting = true;
	    var timer = setTimeout(function () {
	      if (self.skipReconnect) return;

	      debug$7('attempting reconnect');
	      self.emitAll('reconnect_attempt', self.backoff.attempts);
	      self.emitAll('reconnecting', self.backoff.attempts);

	      // check again for the case socket closed in above events
	      if (self.skipReconnect) return;

	      self.open(function (err) {
	        if (err) {
	          debug$7('reconnect attempt error');
	          self.reconnecting = false;
	          self.reconnect();
	          self.emitAll('reconnect_error', err.data);
	        } else {
	          debug$7('reconnect success');
	          self.onreconnect();
	        }
	      });
	    }, delay);

	    this.subs.push({
	      destroy: function destroy() {
	        clearTimeout(timer);
	      }
	    });
	  }
	};

	/**
	 * Called upon successful reconnect.
	 *
	 * @api private
	 */

	Manager.prototype.onreconnect = function () {
	  var attempt = this.backoff.attempts;
	  this.reconnecting = false;
	  this.backoff.reset();
	  this.updateSocketIds();
	  this.emitAll('reconnect', attempt);
	};

	var manager$1 = /*#__PURE__*/Object.freeze({
		default: manager,
		__moduleExports: manager
	});

	var url$2 = ( url$1 && url_1 ) || url$1;

	var Manager$1 = ( manager$1 && manager ) || manager$1;

	var lib$2 = createCommonjsModule(function (module, exports) {
	  /**
	   * Module dependencies.
	   */

	  var debug = require$$0$2('socket.io-client');

	  /**
	   * Module exports.
	   */

	  module.exports = exports = lookup;

	  /**
	   * Managers cache.
	   */

	  var cache = exports.managers = {};

	  /**
	   * Looks up an existing `Manager` for multiplexing.
	   * If the user summons:
	   *
	   *   `io('http://localhost/a');`
	   *   `io('http://localhost/b');`
	   *
	   * We reuse the existing instance based on same scheme/port/host,
	   * and we initialize sockets for each namespace.
	   *
	   * @api public
	   */

	  function lookup(uri, opts) {
	    if ((typeof uri === 'undefined' ? 'undefined' : _typeof(uri)) === 'object') {
	      opts = uri;
	      uri = undefined;
	    }

	    opts = opts || {};

	    var parsed = url$2(uri);
	    var source = parsed.source;
	    var id = parsed.id;
	    var path = parsed.path;
	    var sameNamespace = cache[id] && path in cache[id].nsps;
	    var newConnection = opts.forceNew || opts['force new connection'] || false === opts.multiplex || sameNamespace;

	    var io;

	    if (newConnection) {
	      debug('ignoring socket cache for %s', source);
	      io = Manager$1(source, opts);
	    } else {
	      if (!cache[id]) {
	        debug('new io instance for %s', source);
	        cache[id] = Manager$1(source, opts);
	      }
	      io = cache[id];
	    }
	    if (parsed.query && !opts.query) {
	      opts.query = parsed.query;
	    }
	    return io.socket(parsed.path, opts);
	  }

	  /**
	   * Protocol version.
	   *
	   * @api public
	   */

	  exports.protocol = parser$2.protocol;

	  /**
	   * `connect`.
	   *
	   * @param {String} uri
	   * @api public
	   */

	  exports.connect = lookup;

	  /**
	   * Expose constructors for standalone build.
	   *
	   * @api public
	   */

	  exports.Manager = Manager$1;
	  exports.Socket = Socket$1;
	});
	var lib_1 = lib$2.managers;
	var lib_2 = lib$2.protocol;
	var lib_3 = lib$2.connect;
	var lib_4 = lib$2.Manager;
	var lib_5 = lib$2.Socket;

	function extend(Y) {
	    var Connector = function (_Y$AbstractConnector) {
	        inherits(Connector, _Y$AbstractConnector);

	        function Connector(y, options) {
	            classCallCheck(this, Connector);

	            if (options === undefined) {
	                throw new Error('Options must not be undefined!');
	            }
	            options.preferUntransformed = true;
	            options.generateUserId = options.generateUserId || false;
	            if (options.initSync !== false) {
	                options.initSync = true;
	            }

	            var _this = possibleConstructorReturn(this, (Connector.__proto__ || Object.getPrototypeOf(Connector)).call(this, y, options));

	            _this._sentSync = false;
	            _this.options = options;
	            options.url = options.url || 'https://yjs.dbis.rwth-aachen.de:5072';
	            var socket = options.socket || lib$2(options.url, options.options);
	            _this.socket = socket;
	            var self = _this;

	            /****************** start minimal webrtc **********************/
	            var signaling_socket = socket;
	            var ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "turn:try.refactored.ai:3478", username: "test99", credential: "test" }];
	            var dcs = {};
	            _this.dcs = dcs;
	            _this.sdcs = dcs;
	            var peers = {};
	            var peer_media_elements = {};
	            var sockets;
	            _this.sockets = sockets;

	            function receiveData(ywebrtc, peer_id) {
	                var buf, count;
	                return function onmessage(event) {
	                    if (typeof event.data === 'string') {
	                        buf = new Uint8Array(parseInt(event.data));
	                        count = 0;
	                        return;
	                    }
	                    var data = new Uint8Array(event.data);
	                    buf.set(data, count);
	                    count += data.byteLength;
	                    if (count === buf.byteLength) {
	                        ywebrtc.receiveMessage(peer_id, buf);
	                    }
	                };
	            }

	            function init(ywebrtc) {
	                signaling_socket.on('connect', function () {
	                    join_chat_channel(ywebrtc.options.room, { 'whatever-you-want-here': 'stuff' });
	                });

	                signaling_socket.on('sockets', function (sockets) {
	                    window.sockets = sockets;
	                });

	                signaling_socket.on('disconnect', function () {
	                    /* Tear down all of our peer connections and remove all the
	                     * media divs when we disconnect */
	                    for (peer_id in peer_media_elements) {
	                        peer_media_elements[peer_id].remove();
	                    }
	                    for (peer_id in peers) {
	                        peers[peer_id].close();
	                    }

	                    peers = {};
	                    peer_media_elements = {};
	                });

	                function join_chat_channel(channel, userdata) {
	                    signaling_socket.emit('join', { "channel": channel, "userdata": userdata });
	                    ywebrtc.userID = signaling_socket.id;
	                }

	                signaling_socket.on('addPeer', function (config) {
	                    var peer_id = config.peer_id;

	                    if (peer_id in peers) {
	                        /* This could happen if the user joins multiple channels where the other peer is also in. */
	                        return;
	                    }

	                    var peer_connection = new RTCPeerConnection({ "iceServers": ICE_SERVERS });
	                    peers[peer_id] = peer_connection;

	                    var dataChannel = peer_connection.createDataChannel('data');
	                    var syncDataChannel = peer_connection.createDataChannel('sync_data');

	                    dataChannel.binaryType = 'arraybuffer';
	                    syncDataChannel.binaryType = 'arraybuffer';

	                    ywebrtc.dcs[peer_id] = dataChannel;
	                    ywebrtc.sdcs[peer_id] = syncDataChannel;

	                    ywebrtc.userJoined(peer_id, 'master');

	                    dataChannel.onmessage = receiveData(ywebrtc, peer_id);
	                    syncDataChannel.onmessage = function (e) {
	                        ywebrtc.receivebuffer(peer_id, e.data);
	                    };

	                    peer_connection.onicecandidate = function (event) {
	                        if (event.candidate) {
	                            signaling_socket.emit('relayICECandidate', {
	                                'peer_id': peer_id,
	                                'ice_candidate': {
	                                    'sdpMLineIndex': event.candidate.sdpMLineIndex,
	                                    'candidate': event.candidate.candidate
	                                }
	                            });
	                        }
	                    };

	                    if (config.should_create_offer) {
	                        peer_connection.createOffer(function (local_description) {
	                            peer_connection.setLocalDescription(local_description, function () {
	                                signaling_socket.emit('relaySessionDescription', { 'peer_id': peer_id, 'session_description': local_description });
	                            }, function () {
	                                Alert("Offer setLocalDescription failed!");
	                            });
	                        }, function (error) {
	                            console.log("Error sending offer: ", error);
	                        });
	                    }
	                });

	                /** 
	                 * Peers exchange session descriptions which contains information
	                 * about their audio / video settings and that sort of stuff. First
	                 * the 'offerer' sends a description to the 'answerer' (with type
	                 * "offer"), then the answerer sends one back (with type "answer").  
	                 */
	                signaling_socket.on('sessionDescription', function (config) {
	                    var peer_id = config.peer_id;
	                    var peer = peers[peer_id];

	                    peer.ondatachannel = function (event) {
	                        var dataChannel = event.channel;
	                        dataChannel.binaryType = 'arraybuffer';
	                        if (dataChannel.label == 'sync_data') {
	                            dataChannel.onmessage = receiveData(ywebrtc, peer_id);
	                        } else {
	                            dataChannel.onmessage = function (e) {
	                                ywebrtc.receivebuffer(peer_id, e.data);
	                            };
	                        }
	                    };

	                    var remote_description = config.session_description;

	                    var desc = new RTCSessionDescription(remote_description);
	                    var stuff = peer.setRemoteDescription(desc, function () {
	                        if (remote_description.type == "offer") {
	                            peer.createAnswer(function (local_description) {
	                                peer.setLocalDescription(local_description, function () {
	                                    signaling_socket.emit('relaySessionDescription', { 'peer_id': peer_id, 'session_description': local_description });
	                                }, function () {
	                                    Alert("Answer setLocalDescription failed!");
	                                });
	                            }, function (error) {
	                                console.log("Error creating answer: ", error);
	                            });
	                        }
	                    }, function (error) {
	                        console.log("setRemoteDescription error: ", error);
	                    });
	                });

	                signaling_socket.on('iceCandidate', function (config) {
	                    var peer = peers[config.peer_id];
	                    var ice_candidate = config.ice_candidate;
	                    peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
	                });

	                signaling_socket.on('removePeer', function (config) {
	                    var peer_id = config.peer_id;
	                    ywebrtc.userLeft(peer_id);
	                    if (peer_id in peer_media_elements) {
	                        peer_media_elements[peer_id].remove();
	                    }
	                    if (peer_id in peers) {
	                        peers[peer_id].close();
	                    }

	                    delete peers[peer_id];
	                    delete peer_media_elements[config.peer_id];
	                });
	            }
	            init(self);
	            /************************ end minimal_webrtc ****************************/
	            return _this;
	        }

	        createClass(Connector, [{
	            key: 'disconnect',
	            value: function disconnect() {}
	        }, {
	            key: 'destroy',
	            value: function destroy() {}
	        }, {
	            key: 'reconnect',
	            value: function reconnect() {}
	        }, {
	            key: 'send',
	            value: function send(uid, message) {
	                console.log('$$$$$$$$$$$$$$$$ syncing...... $$$$$$$$$$$$$$$$$');
	                function send2(dataChannel, data2) {
	                    if (dataChannel.readyState === 'open') {
	                        var CHUNK_LEN = 64000;
	                        var len = data2.byteLength;
	                        var n = len / CHUNK_LEN | 0;
	                        dataChannel.send(len);
	                        // split the photo and send in chunks of about 64KB
	                        for (var i = 0; i < n; i++) {
	                            var start = i * CHUNK_LEN,
	                                end = (i + 1) * CHUNK_LEN;
	                            dataChannel.send(data2.subarray(start, end));
	                        }
	                        // send the reminder, if any
	                        if (len % CHUNK_LEN) {
	                            dataChannel.send(data2.subarray(n * CHUNK_LEN));
	                        }
	                    } else {
	                        setTimeout(send2, 500, dataChannel, data2);
	                    }
	                }
	                send2(this.sdcs[uid], new Uint8Array(message));
	            }
	        }, {
	            key: 'broadcast',
	            value: function broadcast(message) {
	                for (var peer_id in this.dcs) {
	                    var send2 = function send2(dataChannel, data2) {
	                        if (dataChannel.readyState === 'open') {
	                            var CHUNK_LEN = 64000;
	                            var len = data2.byteLength;
	                            var n = len / CHUNK_LEN | 0;
	                            dataChannel.send(len);
	                            // split the photo and send in chunks of about 64KB
	                            for (var i = 0; i < n; i++) {
	                                var start = i * CHUNK_LEN,
	                                    end = (i + 1) * CHUNK_LEN;
	                                dataChannel.send(data2.subarray(start, end));
	                            }
	                            // send the reminder, if any
	                            if (len % CHUNK_LEN) {
	                                dataChannel.send(data2.subarray(n * CHUNK_LEN));
	                            }
	                        } else {
	                            console.log('Errrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', peer_id);
	                        }
	                    };

	                    send2(this.dcs[peer_id], new Uint8Array(message));
	                }
	            }
	        }, {
	            key: 'isDisconnected',
	            value: function isDisconnected() {
	                return this.socket.disconnected;
	            }
	        }]);
	        return Connector;
	    }(Y.AbstractConnector);

	    Connector.io = lib$2;
	    Y['webrtc'] = Connector;
	}

	if (typeof Y !== 'undefined') {
	    extend(Y); // eslint-disable-line
	}

	return extend;

})));


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)

},{"_process":4,"buffer":2}],6:[function(require,module,exports){
(function (process,Buffer){
/**
 * yjs - A framework for real-time p2p shared editing on any data
 * @version v13.0.0-62
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.Y=e()}(this,function(){"use strict";function t(t,e,n,r){if(null===e)t.root=n,n._parent=null;else if(e.left===r)e.left=n;else{if(e.right!==r)throw new Error("The elements are wrongly connected!");e.right=n}}function e(t,e){var n=e._id;if(void 0===n)e._integrate(t);else{if(t.ss.getState(n.user)>n.clock)return;!t.gcEnabled||e.constructor===Lt||e._parent.constructor!==Lt&&!1===e._parent._deleted?e._integrate(t):e._gc(t);var r=t._missingStructs.get(n.user);if(null!=r)for(var i=n.clock,o=i+e._length;i<o;i++){var a=r.get(i);void 0!==a&&(a.forEach(function(e){if(0===--e.missing){var n=e.decoder,r=n.pos,i=e.struct._fromBinary(t,n);n.pos=r,0===i.length&&t._readyToIntegrate.push(e.struct)}}),r.delete(i))}}}function n(t,e,n){for(var r=e.readUint32(),i=0;i<r;i++){var o=e.readVarUint(),a=q(o),s=new a,l=s._fromBinary(t,e),u="  "+s._logString();l.length>0&&(u+=" .. missing: "+l.map(p).join(", ")),n.push(u)}}function r(t,n){for(var r=n.readUint32(),i=0;i<r;i++){var o=n.readVarUint(),a=q(o),s=new a,l=n.pos,u=s._fromBinary(t,n);if(0===u.length)for(;null!=s;)e(t,s),s=t._readyToIntegrate.shift();else{var c=new Vt(n.uint8arr);c.pos=l;for(var h=new Mt(c,u,s),f=t._missingStructs,d=u.length-1;d>=0;d--){var _=u[d];f.has(_.user)||f.set(_.user,new Map);var v=f.get(_.user);v.has(_.clock)||v.set(_.clock,[]);(v=v.get(_.clock)).push(h)}}}}function i(t){for(var e=new Map,n=t.readUint32(),r=0;r<n;r++){var i=t.readVarUint(),o=t.readVarUint();e.set(i,o)}return e}function o(t,e){var n=e.pos,r=0;e.writeUint32(0);var i=!0,o=!1,a=void 0;try{for(var s,l=t.ss.state[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=xt(s.value,2),c=u[0],h=u[1];e.writeVarUint(c),e.writeVarUint(h),r++}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}e.setUint32(n,r)}function a(t,e){var n=null,r=void 0,i=void 0,o=0,a=e.pos;e.writeUint32(0),t.ds.iterate(null,null,function(t){var a=t._id.user,s=t._id.clock,l=t.len,u=t.gc;n!==a&&(o++,null!==n&&e.setUint32(i,r),n=a,e.writeVarUint(a),i=e.pos,e.writeUint32(0),r=0),e.writeVarUint(s),e.writeVarUint(l),e.writeUint8(u?1:0),r++}),null!==n&&e.setUint32(i,r),e.setUint32(a,o)}function s(t,e){for(var n=e.readUint32(),r=0;r<n;r++)!function(n){for(var r=e.readVarUint(),i=[],o=e.readUint32(),a=0;a<o;a++){var s=e.readVarUint(),l=e.readVarUint(),u=1===e.readUint8();i.push([s,l,u])}if(o>0){var c=0,h=i[c],f=[];t.ds.iterate(new Pt(r,0),new Pt(r,Number.MAX_VALUE),function(t){for(;null!=h;){var e=0;if(t._id.clock+t.len<=h[0])break;h[0]<t._id.clock?(e=Math.min(t._id.clock-h[0],h[1]),f.push([r,h[0],e])):(e=t._id.clock+t.len-h[0],h[2]&&!t.gc&&f.push([r,h[0],Math.min(e,h[1])])),h[1]<=e?h=i[++c]:(h[0]=h[0]+e,h[1]=h[1]-e)}});for(var d=f.length-1;d>=0;d--){var _=f[d];g(t,_[0],_[1],_[2],!0)}for(;c<i.length;c++)h=i[c],g(t,r,h[0],h[1],!0)}}()}function l(t,e,n){var r=e.readVarString(),i=e.readVarUint();n.push('  - auth: "'+r+'"'),n.push("  - protocolVersion: "+i);for(var o=[],a=e.readUint32(),s=0;s<a;s++){var l=e.readVarUint(),u=e.readVarUint();o.push("("+l+":"+u+")")}n.push("  == SS: "+o.join(","))}function u(t,e){var n=new Ct;n.writeVarString(t.y.room),n.writeVarString("sync step 1"),n.writeVarString(t.authInfo||""),n.writeVarUint(t.protocolVersion),o(t.y,n),t.send(e,n.createBuffer())}function c(t,e,n){var r=e.pos;e.writeUint32(0);var i=0,o=!0,a=!1,s=void 0;try{for(var l,u=t.ss.state.keys()[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=l.value,h=n.get(c)||0;if(c!==qt){var f=new Pt(c,h),d=t.os.findPrev(f),_=null===d?null:d._id;if(null!==_&&_.user===c&&_.clock+d._length>h){d._clonePartial(h-_.clock)._toBinary(e),i++}t.os.iterate(f,new Pt(c,Number.MAX_VALUE),function(t){t._toBinary(e),i++})}}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}e.setUint32(r,i)}function h(t,e,n,r,o){var s=t.readVarUint();s!==n.connector.protocolVersion&&(console.warn("You tried to sync with a Yjs instance that has a different protocol version\n      (You: "+s+", Client: "+s+").\n      "),n.destroy()),e.writeVarString("sync step 2"),e.writeVarString(n.connector.authInfo||""),c(n,e,i(t)),a(n,e),n.connector.send(r.uid,e.createBuffer()),r.receivedSyncStep2=!0,"slave"===n.connector.role&&u(n.connector,o)}function f(t,e,r){r.push("     - auth: "+e.readVarString()),r.push("  == OS:"),n(t,e,r),r.push("  == DS:");for(var i=e.readUint32(),o=0;o<i;o++){var a=e.readVarUint();r.push("    User: "+a+": ");for(var s=e.readUint32(),l=0;l<s;l++){var u=e.readVarUint(),c=e.readVarUint(),h=1===e.readUint8();r.push("["+u+", "+c+", "+h+"]")}}}function d(t,e,n,i,o){r(n,t),s(n,t),n.connector._setSyncedWith(o)}function _(t){var e=xt(t,2),r=e[0],i=e[1],o=new Vt(i);o.readVarString();var a=o.readVarString(),s=[];return s.push("\n === "+a+" ==="),"update"===a?n(r,o,s):"sync step 1"===a?l(r,o,s):"sync step 2"===a?f(r,o,s):s.push("-- Unknown message type - probably an encoding issue!!!"),s.join("\n")}function v(t){var e=new Vt(t);return e.readVarString(),e.readVarString()}function p(t){if(null!==t&&null!=t._id&&(t=t._id),null===t)return"()";if(t instanceof Pt)return"("+t.user+","+t.clock+")";if(t instanceof $t)return"("+t.name+","+t.type+")";if(t.constructor===Y)return"y";throw new Error("This is not a valid ID!")}function y(t,e,n){var r=null!==e._left?e._left._lastId:null,i=null!==e._origin?e._origin._lastId:null;return t+"(id:"+p(e._id)+",left:"+p(r)+",origin:"+p(i)+",right:"+p(e._right)+",parent:"+p(e._parent)+",parentSub:"+e._parentSub+(void 0!==n?" - "+n:"")+")"}function g(t,e,n,r,i){var o=null!==t.connector&&t.connector._forwardAppliedStructs,a=t.os.getItemCleanStart(new Pt(e,n));if(null!==a){a._deleted||(a._splitAt(t,r),a._delete(t,o,!0));var s=a._length;if(r-=s,n+=s,r>0)for(var l=t.os.findNode(new Pt(e,n));null!==l&&null!==l.val&&r>0&&l.val._id.equals(new Pt(e,n));){var u=l.val;u._deleted||(u._splitAt(t,r),u._delete(t,o,i));var c=u._length;r-=c,n+=c,l=l.next()}}}function m(t,e,n){if(e!==t&&!e._deleted&&!t._transaction.newTypes.has(e)){var r=t._transaction.changedTypes,i=r.get(e);void 0===i&&(i=new Set,r.set(e,i)),i.add(n)}}function k(t,e,n,r){var i=e._id;n._id=new Pt(i.user,i.clock+r),n._origin=e,n._left=e,n._right=e._right,null!==n._right&&(n._right._left=n),n._right_origin=e._right_origin,e._right=n,n._parent=e._parent,n._parentSub=e._parentSub,n._deleted=e._deleted;var o=new Set;o.add(e);for(var a=n._right;null!==a&&o.has(a._origin);)a._origin===e&&(a._origin=n),o.add(a),a=a._right;t.os.put(n),t._transaction.newTypes.has(e)?t._transaction.newTypes.add(n):t._transaction.deletedStructs.has(e)&&t._transaction.deletedStructs.add(n)}function b(t,e){var n=void 0;do{n=e._right,e._right=null,e._right_origin=null,e._origin=e._left,e._integrate(t),e=n}while(null!==n)}function w(t,e){for(;null!==e;)e._delete(t,!1,!0),e._gc(t),e=e._right}function S(t,e,n,r,i){t._origin=r,t._left=r,t._right=i,t._right_origin=i,t._parent=e,null!==n?t._integrate(n):null===r?e._start=t:r._right=t}function O(t,e,n,r,i){for(;null!==r&&i>0;){switch(r.constructor){case Ht:case ItemString:if(i<=(r._deleted?0:r._length-1))return r=r._splitAt(e._y,i),n=r._left,[n,r,t];!1===r._deleted&&(i-=r._length);break;case Jt:!1===r._deleted&&B(t,r)}n=r,r=r._right}return[n,r,t]}function E(t,e){return O(new Map,t,null,t._start,e)}function U(t,e,n,r,i){for(;null!==r&&(!0===r._deleted||r.constructor===Jt&&i.get(r.key)===r.value);)!1===r._deleted&&i.delete(r.key),n=r,r=r._right;var o=!0,a=!1,s=void 0;try{for(var l,u=i[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=xt(l.value,2),h=c[0],f=c[1],d=new Jt;d.key=h,d.value=f,S(d,e,t,n,r),n=d}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}return[n,r]}function B(t,e){var n=e.value,r=e.key;null===n?t.delete(r):t.set(r,n)}function T(t,e,n,r){for(;;){if(null===e)break;if(!0===e._deleted);else{if(e.constructor!==Jt||(r[e.key]||null)!==e.value)break;B(n,e)}t=e,e=e._right}return[t,e]}function A(t,e,n,r,i,o){var a=new Map;for(var s in i){var l=i[s],u=o.get(s);if(u!==l){a.set(s,u||null);var c=new Jt;c.key=s,c.value=l,S(c,e,t,n,r),n=c}}return[n,r,a]}function x(t,e,n,r,i,o,a){var s=!0,l=!1,u=void 0;try{for(var c,h=o[Symbol.iterator]();!(s=(c=h.next()).done);s=!0){var f=xt(c.value,1),d=f[0];void 0===a[d]&&(a[d]=null)}}catch(t){l=!0,u=t}finally{try{!s&&h.return&&h.return()}finally{if(l)throw u}}var _=T(r,i,o,a),v=xt(_,2);r=v[0],i=v[1];var p=void 0,y=A(t,n,r,i,a,o),g=xt(y,3);r=g[0],i=g[1],p=g[2];var m=void 0;return e.constructor===String?(m=new ItemString,m._content=e):(m=new Ht,m.embed=e),S(m,n,t,r,i),r=m,U(t,n,r,i,p)}function I(t,e,n,r,i,o,a){var s=T(r,i,o,a),l=xt(s,2);r=l[0],i=l[1];var u=void 0,c=A(t,n,r,i,a,o),h=xt(c,3);for(r=h[0],i=h[1],u=h[2];e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Jt:var f=a[i.key];void 0!==f&&(f===i.value?u.delete(i.key):u.set(i.key,i.value),i._delete(t)),B(o,i);break;case Ht:case ItemString:i._splitAt(t,e),e-=i._length}r=i,i=i._right}return U(t,n,r,i,u)}function D(t,e,n,r,i,o){for(;e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Jt:B(o,i);break;case Ht:case ItemString:i._splitAt(t,e),e-=i._length,i._delete(t)}r=i,i=i._right}return[r,i]}function P(t,e){for(e=e._parent;null!==e;){if(e===t)return!0;e=e._parent}return!1}function j(t,e){return e}function N(t,e){for(var n=new Map,r=t.attributes.length-1;r>=0;r--){var i=t.attributes[r];n.set(i.name,i.value)}return e(t.nodeName,n)}function V(t,e,n){if(P(e.type,n)){var r=n.nodeName,i=new Map;if(void 0!==n.getAttributes){var o=n.getAttributes();for(var a in o)i.set(a,o[a])}var s=e.filter(r,new Map(i));null===s?n._delete(t):i.forEach(function(t,e){!1===s.has(e)&&n.removeAttribute(e)})}}function L(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:document,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:j,i=arguments[4],o=void 0;switch(t.nodeType){case e.ELEMENT_NODE:var a=null,s=void 0;if(t.hasAttribute("data-yjs-hook")&&(a=t.getAttribute("data-yjs-hook"),void 0===(s=n[a])&&(console.error('Unknown hook "'+a+'". Deleting yjsHook dataset property.'),t.removeAttribute("data-yjs-hook"),a=null)),null===a){var l=N(t,r);null===l?o=!1:(o=new YXmlElement(t.nodeName),l.forEach(function(t,e){o.setAttribute(e,t)}),o.insert(0,J(t.childNodes,document,n,r,i)))}else o=new YXmlHook(a),s.fillType(t,o);break;case e.TEXT_NODE:o=new YXmlText,o.insert(0,t.nodeValue);break;default:throw new Error("Can't transform this node type to a YXml type!")}return R(i,t,o),o}function M(t){for(;null!==t&&t._deleted;)t=t._right;return t}function C(t,e,n){t.domToType.delete(e),t.typeToDom.delete(n)}function R(t,e,n){void 0!==t&&(t.domToType.set(e,n),t.typeToDom.set(n,e))}function W(t,e,n){if(void 0!==t){var r=t.domToType.get(e);void 0!==r&&(C(t,e,r),R(t,n,r))}}function H(t,e,n,r,i){var o=J(n,r,i.opts.hooks,i.filter,i);return t.insertAfter(e,o)}function J(t,e,n,r,i){var o=[],a=!0,s=!1,l=void 0;try{for(var u,c=t[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=L(h,e,n,r,i);!1!==f&&o.push(f)}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}return o}function z(t,e,n,r,i){var o=H(t,e,[n],r,i);return o.length>0?o[0]:e}function F(t,e,n){for(;e!==n;){var r=e;e=e.nextSibling,t.removeChild(r)}}function X(t,e){Ft.set(t,e),Xt.set(e,t)}function q(t){return Ft.get(t)}function $(t){return Xt.get(t)}function G(){if("undefined"!=typeof crypto&&null!=crypto.getRandomValue){var t=new Uint32Array(1);return crypto.getRandomValues(t),t[0]}if("undefined"!=typeof crypto&&null!=crypto.randomBytes){var e=crypto.randomBytes(4);return new Uint32Array(e.buffer)[0]}return Math.ceil(4294967295*Math.random())}function Z(t,e){for(var n=t._start;null!==n;){if(!1===n._deleted){if(n._length>e)return[n._id.user,n._id.clock+e];e-=n._length}n=n._right}return["endof",t._id.user,t._id.clock||null,t._id.name||null,t._id.type||null]}function Q(t,e){if("endof"===e[0]){var n=void 0;n=null===e[3]?new Pt(e[1],e[2]):new $t(e[3],e[4]);for(var r=t.os.get(n);null!==r._redone;)r=r._redone;return null===r||r.constructor===Lt?null:{type:r,offset:r.length}}for(var i=0,o=t.os.findNodeWithUpperBound(new Pt(e[0],e[1])).val,a=e[1]-o._id.clock;null!==o._redone;)o=o._redone;var s=o._parent;if(o.constructor===Lt||s._deleted)return null;for(o._deleted||(i=a),o=o._left;null!==o;)o._deleted||(i+=o._length),o=o._left;return{type:s,offset:i}}function K(){var t=!0;return function(e){if(t){t=!1;try{e()}catch(t){console.error(t)}t=!0}}}function tt(t){var e=getSelection(),n=e.baseNode,r=e.baseOffset,i=e.extentNode,o=e.extentOffset,a=t.domToType.get(n),s=t.domToType.get(i);return void 0!==a&&void 0!==s?{from:Z(a,r),to:Z(s,o)}:null}function et(t,e){e&&(te=ee(t))}function nt(t,e){null!==te&&e&&t.restoreSelection(te)}function rt(t){if(null!==t){var e=getSelection().anchorNode;if(null!=e){e.nodeType===document.TEXT_NODE&&(e=e.parentElement);return{elem:e,top:e.getBoundingClientRect().top}}for(var n=t.children,r=0;r<n.length;r++){var i=n[r],o=i.getBoundingClientRect();if(o.top>=0)return{elem:i,top:o.top}}}return null}function it(t,e){if(null!==e){var n=e.elem,r=e.top,i=n.getBoundingClientRect().top,o=t.scrollTop+i-r;o>=0&&(t.scrollTop=o)}}function ot(t){var e=this;this._mutualExclude(function(){var n=rt(e.scrollingElement);t.forEach(function(t){var n=t.target,r=e.typeToDom.get(n);if(void 0!==r&&!1!==r)if(n.constructor===YXmlText)r.nodeValue=n.toString();else if(void 0!==t.attributesChanged&&(t.attributesChanged.forEach(function(t){var e=n.getAttribute(t);void 0===e?r.removeAttribute(t):r.setAttribute(t,e)}),t.childListChanged&&n.constructor!==YXmlHook)){var i=r.firstChild;n.forEach(function(t){var n=e.typeToDom.get(t);switch(n){case void 0:var o=t.toDom(e.opts.document,e.opts.hooks,e);r.insertBefore(o,i);break;case!1:break;default:F(r,i,n),i=n.nextSibling}}),F(r,i,null)}}),it(e.scrollingElement,n)})}function at(t,e){for(var n=0,r=0;n<t.length&&n<e.length&&t[n]===e[n];)n++;if(n!==t.length||n!==e.length)for(;r+n<t.length&&r+n<e.length&&t[t.length-r-1]===e[e.length-r-1];)r++;return{pos:n,remove:t.length-n-r,insert:e.slice(n,e.length-r)}}function st(t,e,n,r){if(null!=n&&!1!==n&&n.constructor!==YXmlHook){for(var i=n._y,o=new Set,a=e.childNodes.length-1;a>=0;a--){var s=t.domToType.get(e.childNodes[a]);void 0!==s&&!1!==s&&o.add(s)}n.forEach(function(e){!1===o.has(e)&&(e._delete(i),C(t,t.typeToDom.get(e),e))});for(var l=e.childNodes,u=l.length,c=null,h=M(n._start),f=0;f<u;f++){var d=l[f],_=t.domToType.get(d);if(void 0!==_){if(!1===_)continue;null!==h?h!==_?(_._parent!==n?C(t,d,_):(C(t,d,_),_._delete(i)),c=z(n,c,d,r,t)):(c=h,h=M(h._right)):c=z(n,c,d,r,t)}else c=z(n,c,d,r,t)}}}function lt(t,e){var n=this;this._mutualExclude(function(){n.type._y.transact(function(){var r=new Set;t.forEach(function(t){var e=t.target,i=n.domToType.get(e);if(void 0===i){var o=e,a=void 0;do{o=o.parentElement,a=n.domToType.get(o)}while(void 0===a&&null!==o);return void(!1!==a&&void 0!==a&&a.constructor!==YXmlHook&&r.add(o))}if(!1!==i&&i.constructor!==YXmlHook)switch(t.type){case"characterData":var s=at(i.toString(),e.nodeValue);i.delete(s.pos,s.remove),i.insert(s.pos,s.insert);break;case"attributes":if(i.constructor===YXmlFragment)break;var l=t.attributeName,u=e.getAttribute(l),c=new Map;c.set(l,u),i.constructor!==YXmlFragment&&n.filter(e.nodeName,c).size>0&&i.getAttribute(l)!==u&&(null==u?i.removeAttribute(l):i.setAttribute(l,u));break;case"childList":r.add(t.target)}});var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=s.value,c=n.domToType.get(u);st(n,u,c,e)}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}})})}function ut(t,e,n){var r=!1,i=void 0;return t.transact(function(){for(;!r&&n.length>0;)!function(){i=n.pop(),null!==i.fromState&&(t.os.getItemCleanStart(i.fromState),t.os.getItemCleanEnd(i.toState),t.os.iterate(i.fromState,i.toState,function(n){for(;n._deleted&&null!==n._redone;)n=n._redone;!1===n._deleted&&P(e,n)&&(r=!0,n._delete(t))}));var o=new Set,a=!0,s=!1,l=void 0;try{for(var u,c=i.deletedStructs[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=h.from,d=new Pt(f.user,f.clock+h.len-1);t.os.getItemCleanStart(f),t.os.getItemCleanEnd(d),t.os.iterate(f,d,function(n){P(e,n)&&n._parent!==t&&(n._id.user!==t.userID||null===i.fromState||n._id.clock<i.fromState.clock||n._id.clock>i.toState.clock)&&o.add(n)})}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}o.forEach(function(e){var n=e._redo(t,o);r=r||n})}()}),r&&i.bindingInfos.forEach(function(t,e){e._restoreUndoStackInfo(t)}),r}function ct(t,e){return e={exports:{}},t(e,e.exports),e.exports}function ht(t){if(t=String(t),!(t.length>100)){var e=/^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);if(e){var n=parseFloat(e[1]);switch((e[2]||"ms").toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return n*ue;case"days":case"day":case"d":return n*le;case"hours":case"hour":case"hrs":case"hr":case"h":return n*se;case"minutes":case"minute":case"mins":case"min":case"m":return n*ae;case"seconds":case"second":case"secs":case"sec":case"s":return n*oe;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return n;default:return}}}}function ft(t){return t>=le?Math.round(t/le)+"d":t>=se?Math.round(t/se)+"h":t>=ae?Math.round(t/ae)+"m":t>=oe?Math.round(t/oe)+"s":t+"ms"}function dt(t){return _t(t,le,"day")||_t(t,se,"hour")||_t(t,ae,"minute")||_t(t,oe,"second")||t+" ms"}function _t(t,e,n){if(!(t<e))return t<1.5*e?Math.floor(t/e)+" "+n:Math.ceil(t/e)+" "+n+"s"}function vt(t,e){t.transact(function(){r(t,e),s(t,e)})}function pt(t){var e=new Ct;return c(t,e,new Map),a(t,e),e}function yt(){var t=new Ct;return t.writeUint32(0),{len:0,buffer:t}}function gt(){var t=this;this._mutualExclude(function(){var e=t.target,n=t.type,r=Z(n,e.selectionStart),i=Z(n,e.selectionEnd);e.value=n.toString();var o=Q(n._y,r),a=Q(n._y,i);e.setSelectionRange(o,a)})}function mt(){var t=this;this._mutualExclude(function(){var e=at(t.type.toString(),t.target.value);t.type.delete(e.pos,e.remove),t.type.insert(e.pos,e.insert)})}function kt(t){var e=this.target;e.update("yjs"),this._mutualExclude(function(){e.updateContents(t.delta,"yjs"),e.update("yjs")})}function bt(t){var e=this;this._mutualExclude(function(){e.type.applyDelta(t.ops)})}function wt(t){var e=this;this._mutualExclude(function(){for(var n=e.target,r=t.delta,i=0,o=n.posFromIndex(i),a=0;a<r.length;a++){var s=r[a];s.retain?(i=s.retain,o=n.posFromIndex(i)):s.insert?n.replaceRange(s.insert,o,o):s.delete&&n.replaceRange("",o,n.posFromIndex(i+s.delete))}})}function St(t,e){var n=this;this._mutualExclude(function(){for(var r=0;r<e.length;r++){var i=e[r],o=t.indexFromPos(i.from);if(i.removed.length>0){for(var a=0,s=0;s<i.removed.length;s++)a+=i.removed[s].length;a+=i.removed.length-1,n.type.delete(o,a)}n.type.insert(o,i.text.join("\n"))}})}var Ot="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Et=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},Ut=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),Bt=function t(e,n,r){null===e&&(e=Function.prototype);var i=Object.getOwnPropertyDescriptor(e,n);if(void 0===i){var o=Object.getPrototypeOf(e);return null===o?void 0:t(o,n,r)}if("value"in i)return i.value;var a=i.get;if(void 0!==a)return a.call(r)},Tt=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},At=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e},xt=function(){function t(t,e){var n=[],r=!0,i=!1,o=void 0;try{for(var a,s=t[Symbol.iterator]();!(r=(a=s.next()).done)&&(n.push(a.value),!e||n.length!==e);r=!0);}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}return n}return function(e,n){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,n);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),It=function(){function e(t){Et(this,e),this.val=t,this.color=!0,this._left=null,this._right=null,this._parent=null}return Ut(e,[{key:"isRed",value:function(){return this.color}},{key:"isBlack",value:function(){return!this.color}},{key:"redden",value:function(){return this.color=!0,this}},{key:"blacken",value:function(){return this.color=!1,this}},{key:"rotateLeft",value:function(e){var n=this.parent,r=this.right,i=this.right.left;r.left=this,this.right=i,t(e,n,r,this)}},{key:"next",value:function(){if(null!==this.right){for(var t=this.right;null!==t.left;)t=t.left;return t}for(var e=this;null!==e.parent&&e!==e.parent.left;)e=e.parent;return e.parent}},{key:"prev",value:function(){if(null!==this.left){for(var t=this.left;null!==t.right;)t=t.right;return t}for(var e=this;null!==e.parent&&e!==e.parent.right;)e=e.parent;return e.parent}},{key:"rotateRight",value:function(e){var n=this.parent,r=this.left,i=this.left.right;r.right=this,this.left=i,t(e,n,r,this)}},{key:"getUncle",value:function(){return this.parent===this.parent.parent.left?this.parent.parent.right:this.parent.parent.left}},{key:"grandparent",get:function(){return this.parent.parent}},{key:"parent",get:function(){return this._parent}},{key:"sibling",get:function(){return this===this.parent.left?this.parent.right:this.parent.left}},{key:"left",get:function(){return this._left},set:function(t){null!==t&&(t._parent=this),this._left=t}},{key:"right",get:function(){return this._right},set:function(t){null!==t&&(t._parent=this),this._right=t}}]),e}(),Dt=function(){function t(){Et(this,t),this.root=null,this.length=0}return Ut(t,[{key:"findNext",value:function(t){var e=t.clone();return e.clock+=1,this.findWithLowerBound(e)}},{key:"findPrev",value:function(t){var e=t.clone();return e.clock-=1,this.findWithUpperBound(e)}},{key:"findNodeWithLowerBound",value:function(t){var e=this.root;if(null===e)return null;for(;;)if(null===t||t.lessThan(e.val._id)&&null!==e.left)e=e.left;else{if(null===t||!e.val._id.lessThan(t))return e;if(null===e.right)return e.next();e=e.right}}},{key:"findNodeWithUpperBound",value:function(t){if(void 0===t)throw new Error("You must define from!");var e=this.root;if(null===e)return null;for(;;)if(null!==t&&!e.val._id.lessThan(t)||null===e.right){if(null===t||!t.lessThan(e.val._id))return e;if(null===e.left)return e.prev();e=e.left}else e=e.right}},{key:"findSmallestNode",value:function(){for(var t=this.root;null!=t&&null!=t.left;)t=t.left;return t}},{key:"findWithLowerBound",value:function(t){var e=this.findNodeWithLowerBound(t);return null==e?null:e.val}},{key:"findWithUpperBound",value:function(t){var e=this.findNodeWithUpperBound(t);return null==e?null:e.val}},{key:"iterate",value:function(t,e,n){var r;for(r=null===t?this.findSmallestNode():this.findNodeWithLowerBound(t);null!==r&&(null===e||r.val._id.lessThan(e)||r.val._id.equals(e));)n(r.val),r=r.next()}},{key:"find",value:function(t){var e=this.findNode(t);return null!==e?e.val:null}},{key:"findNode",value:function(t){var e=this.root;if(null===e)return null;for(;;){if(null===e)return null;if(t.lessThan(e.val._id))e=e.left;else{if(!e.val._id.lessThan(t))return e;e=e.right}}}},{key:"delete",value:function(t){var e=this.findNode(t);if(null!=e){if(this.length--,null!==e.left&&null!==e.right){for(var n=e.left;null!==n.right;)n=n.right;e.val=n.val,e=n}var r,i=e.left||e.right;if(null===i?(r=!0,i=new It(null),i.blacken(),e.right=i):r=!1,null===e.parent)return void(r?this.root=null:(this.root=i,i.blacken(),i._parent=null));if(e.parent.left===e)e.parent.left=i;else{if(e.parent.right!==e)throw new Error("Impossible!");e.parent.right=i}if(e.isBlack()&&(i.isRed()?i.blacken():this._fixDelete(i)),this.root.blacken(),r)if(i.parent.left===i)i.parent.left=null;else{if(i.parent.right!==i)throw new Error("Impossible #3");i.parent.right=null}}}},{key:"_fixDelete",value:function(t){function e(t){return null===t||t.isBlack()}function n(t){return null!==t&&t.isRed()}if(null!==t.parent){var r=t.sibling;if(n(r)){if(t.parent.redden(),r.blacken(),t===t.parent.left)t.parent.rotateLeft(this);else{if(t!==t.parent.right)throw new Error("Impossible #2");t.parent.rotateRight(this)}r=t.sibling}t.parent.isBlack()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),this._fixDelete(t.parent)):t.parent.isRed()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),t.parent.blacken()):(t===t.parent.left&&r.isBlack()&&n(r.left)&&e(r.right)?(r.redden(),r.left.blacken(),r.rotateRight(this),r=t.sibling):t===t.parent.right&&r.isBlack()&&n(r.right)&&e(r.left)&&(r.redden(),r.right.blacken(),r.rotateLeft(this),r=t.sibling),r.color=t.parent.color,t.parent.blacken(),t===t.parent.left?(r.right.blacken(),t.parent.rotateLeft(this)):(r.left.blacken(),t.parent.rotateRight(this)))}}},{key:"put",value:function(t){var e=new It(t);if(null!==this.root){for(var n=this.root;;)if(e.val._id.lessThan(n.val._id)){if(null===n.left){n.left=e;break}n=n.left}else{if(!n.val._id.lessThan(e.val._id))return n.val=e.val,n;if(null===n.right){n.right=e;break}n=n.right}this._fixInsert(e)}else this.root=e;return this.length++,this.root.blacken(),e}},{key:"_fixInsert",value:function(t){if(null===t.parent)return void t.blacken();if(!t.parent.isBlack()){var e=t.getUncle();null!==e&&e.isRed()?(t.parent.blacken(),e.blacken(),t.grandparent.redden(),this._fixInsert(t.grandparent)):(t===t.parent.right&&t.parent===t.grandparent.left?(t.parent.rotateLeft(this),t=t.left):t===t.parent.left&&t.parent===t.grandparent.right&&(t.parent.rotateRight(this),t=t.right),t.parent.blacken(),t.grandparent.redden(),t===t.parent.left?t.grandparent.rotateRight(this):t.grandparent.rotateLeft(this))}}}]),t}(),Pt=function(){function t(e,n){Et(this,t),this.user=e,this.clock=n}return Ut(t,[{key:"clone",value:function(){return new t(this.user,this.clock)}},{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.clock===this.clock}},{key:"lessThan",value:function(e){return e.constructor===t&&(this.user<e.user||this.user===e.user&&this.clock<e.clock)}}]),t}(),jt=function(){function t(e,n,r){Et(this,t),this._id=e,this.len=n,this.gc=r}return Ut(t,[{key:"clone",value:function(){return new t(this._id,this.len,this.gc)}}]),t}(),Nt=function(t){function e(){return Et(this,e),At(this,(e.__proto__||Object.getPrototypeOf(e)).apply(this,arguments))}return Tt(e,t),Ut(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){t.push({user:e._id.user,clock:e._id.clock,len:e.len,gc:e.gc})}),console.table(t)}},{key:"isDeleted",value:function(t){var e=this.findWithUpperBound(t);return null!==e&&e._id.user===t.user&&t.clock<e._id.clock+e.len}},{key:"mark",value:function(t,e,n){if(0!==e){var r=this.findWithUpperBound(new Pt(t.user,t.clock-1));null!==r&&r._id.user===t.user&&r._id.clock<t.clock&&t.clock<r._id.clock+r.len&&(t.clock+e<r._id.clock+r.len&&this.put(new jt(new Pt(t.user,t.clock+e),r._id.clock+r.len-t.clock-e,r.gc)),r.len=t.clock-r._id.clock);var i=new Pt(t.user,t.clock+e-1),o=this.findWithUpperBound(i);if(null!==o&&o._id.user===t.user&&o._id.clock<t.clock+e&&t.clock<=o._id.clock&&t.clock+e<o._id.clock+o.len){var a=t.clock+e-o._id.clock;o._id=new Pt(o._id.user,o._id.clock+a),o.len-=a}var s=[];this.iterate(t,i,function(t){s.push(t._id)});for(var l=s.length-1;l>=0;l--)this.delete(s[l]);var u=new jt(t,e,n);null!==r&&r._id.user===t.user&&r._id.clock+r.len===t.clock&&r.gc===n&&(r.len+=e,u=r);var c=this.find(new Pt(t.user,t.clock+e));null!==c&&c._id.user===t.user&&t.clock+e===c._id.clock&&n===c.gc&&(u.len+=c.len,this.delete(c._id)),r!==u&&this.put(u)}}},{key:"markDeleted",value:function(t,e){this.mark(t,e,!1)}}]),e}(Dt),Vt=function(){function t(e){if(Et(this,t),e instanceof ArrayBuffer)this.uint8arr=new Uint8Array(e);else{if(!(e instanceof Uint8Array||"undefined"!=typeof Buffer&&e instanceof Buffer))throw new Error("Expected an ArrayBuffer or Uint8Array!");this.uint8arr=e}this.pos=0}return Ut(t,[{key:"clone",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.pos,n=new t(this.uint8arr);return n.pos=e,n}},{key:"skip8",value:function(){this.pos++}},{key:"readUint8",value:function(){return this.uint8arr[this.pos++]}},{key:"readUint32",value:function(){var t=this.uint8arr[this.pos]+(this.uint8arr[this.pos+1]<<8)+(this.uint8arr[this.pos+2]<<16)+(this.uint8arr[this.pos+3]<<24);return this.pos+=4,t}},{key:"peekUint8",value:function(){return this.uint8arr[this.pos]}},{key:"readVarUint",value:function(){for(var t=0,e=0;;){var n=this.uint8arr[this.pos++];if(t|=(127&n)<<e,e+=7,n<128)return t>>>0;if(e>35)throw new Error("Integer out of range!")}}},{key:"readVarString",value:function(){for(var t=this.readVarUint(),e=new Array(t),n=0;n<t;n++)e[n]=this.uint8arr[this.pos++];var r=e.map(function(t){return String.fromCodePoint(t)}).join("");return decodeURIComponent(escape(r))}},{key:"peekVarString",value:function(){var t=this.pos,e=this.readVarString();return this.pos=t,e}},{key:"readID",value:function(){var t=this.readVarUint();if(t===qt){var e=new $t(this.readVarString(),null);return e.type=this.readVarUint(),e}return new Pt(t,this.readVarUint())}},{key:"length",get:function(){return this.uint8arr.length}}]),t}(),Lt=function(){function t(){Et(this,t),this._id=null,this._length=0}return Ut(t,[{key:"_integrate",value:function(e){var n=this._id,r=e.ss.getState(n.user);n.clock===r&&e.ss.setState(n.user,n.clock+this._length),e.ds.mark(this._id,this._length,!0);var i=e.os.put(this),o=i.prev().val;null!==o&&o.constructor===t&&o._id.user===i.val._id.user&&o._id.clock+o._length===i.val._id.clock&&(o._length+=i.val._length,e.os.delete(i.val._id),i=o),i.val&&(i=i.val);var a=e.os.findNext(i._id);null!==a&&a.constructor===t&&a._id.user===i._id.user&&a._id.clock===i._id.clock+i._length&&(i._length+=a._length,e.os.delete(a._id)),n.user!==qt&&(null===e.connector||!e.connector._forwardAppliedStructs&&n.user!==e.userID||e.connector.broadcastStruct(this),null!==e.persistence&&e.persistence.saveStruct(e,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._id),t.writeVarUint(this._length)}},{key:"_fromBinary",value:function(t,e){var n=e.readID();this._id=n,this._length=e.readVarUint();var r=[];return t.ss.getState(n.user)<n.clock&&r.push(new Pt(n.user,n.clock-1)),r}},{key:"_splitAt",value:function(){return this}},{key:"_clonePartial",value:function(e){var n=new t;return n._id=new Pt(this._id.user,this._id.clock+e),n._length=this._length-e,n}},{key:"_deleted",get:function(){return!0}}]),t}(),Mt=function t(e,n,r){Et(this,t),this.decoder=e,this.missing=n.length,this.struct=r},Ct=function(){function t(){Et(this,t),this.data=[]}return Ut(t,[{key:"createBuffer",value:function(){return Uint8Array.from(this.data).buffer}},{key:"writeUint8",value:function(t){this.data.push(255&t)}},{key:"setUint8",value:function(t,e){this.data[t]=255&e}},{key:"writeUint16",value:function(t){this.data.push(255&t,t>>>8&255)}},{key:"setUint16",value:function(t,e){this.data[t]=255&e,this.data[t+1]=e>>>8&255}},{key:"writeUint32",value:function(t){for(var e=0;e<4;e++)this.data.push(255&t),t>>>=8}},{key:"setUint32",value:function(t,e){for(var n=0;n<4;n++)this.data[t+n]=255&e,e>>>=8}},{key:"writeVarUint",value:function(t){for(;t>=128;)this.data.push(128|127&t),t>>>=7;this.data.push(127&t)}},{key:"writeVarString",value:function(t){
var e=unescape(encodeURIComponent(t)),n=e.split("").map(function(t){return t.codePointAt()}),r=n.length;this.writeVarUint(r);for(var i=0;i<r;i++)this.data.push(n[i])}},{key:"writeID",value:function(t){var e=t.user;this.writeVarUint(e),e!==qt?this.writeVarUint(t.clock):(this.writeVarString(t.name),this.writeVarUint(t.type))}},{key:"length",get:function(){return this.data.length}},{key:"pos",get:function(){return this.data.length}}]),t}(),Delete=function(){function Delete(){Et(this,Delete),this._target=null,this._length=null}return Ut(Delete,[{key:"_fromBinary",value:function(t,e){var n=e.readID();return this._targetID=n,this._length=e.readVarUint(),null===t.os.getItem(n)?[n]:[]}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._targetID),t.writeVarUint(this._length)}},{key:"_integrate",value:function(t){if(arguments.length>1&&void 0!==arguments[1]&&arguments[1])null!==t.connector&&t.connector.broadcastStruct(this);else{var e=this._targetID;g(t,e.user,e.clock,this._length,!1)}null!==t.persistence&&t.persistence.saveStruct(t,this)}},{key:"_logString",value:function(){return"Delete - target: "+p(this._targetID)+", len: "+this._length}}]),Delete}(),Rt=function t(e){Et(this,t),this.y=e,this.newTypes=new Set,this.changedTypes=new Map,this.deletedStructs=new Set,this.beforeState=new Map,this.changedParentTypes=new Map},Item=function(){function Item(){Et(this,Item),this._id=null,this._origin=null,this._left=null,this._right=null,this._right_origin=null,this._parent=null,this._parentSub=null,this._deleted=!1,this._redone=null}return Ut(Item,[{key:"_copy",value:function(){return new this.constructor}},{key:"_redo",value:function(t,e){if(null!==this._redone)return this._redone;var n=this._copy(),r=this._left,i=this,o=this._parent;if(!(!0!==o._deleted||null!==o._redone||e.has(o)&&o._redo(t,e)))return!1;if(null!==o._redone){for(o=o._redone;null!==r;){if(null!==r._redone&&r._redone._parent===o){r=r._redone;break}r=r._left}for(;null!==i;)null!==i._redone&&i._redone._parent===o&&(i=i._redone),i=i._right}return n._origin=r,n._left=r,n._right=i,n._right_origin=i,n._parent=o,n._parentSub=this._parentSub,n._integrate(t),this._redone=n,!0}},{key:"_splitAt",value:function(t,e){return 0===e?this:this._right}},{key:"_delete",value:function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];if(!this._deleted){this._deleted=!0,t.ds.mark(this._id,this._length,!1);var n=new Delete;n._targetID=this._id,n._length=this._length,e?n._integrate(t,!0):null!==t.persistence&&t.persistence.saveStruct(t,n),m(t,this._parent,this._parentSub),t._transaction.deletedStructs.add(this)}}},{key:"_gcChildren",value:function(t){}},{key:"_gc",value:function(t){var e=new Lt;e._id=this._id,e._length=this._length,t.os.delete(this._id),e._integrate(t)}},{key:"_beforeChange",value:function(){}},{key:"_integrate",value:function(t){t._transaction.newTypes.add(this);var e=this._parent,n=this._id,r=null===n?t.userID:n.user,i=t.ss.getState(r);if(null===n)this._id=t.ss.getNextID(this._length);else if(n.user===qt);else{if(n.clock<i)return[];if(n.clock!==i)throw new Error("Can not apply yet!");t.ss.setState(n.user,i+this._length)}e._deleted||t._transaction.changedTypes.has(e)||t._transaction.newTypes.has(e)||this._parent._beforeChange();var o=void 0;o=null!==this._left?this._left._right:null!==this._parentSub?this._parent._map.get(this._parentSub)||null:this._parent._start;for(var a=new Set,s=new Set;null!==o&&o!==this._right;){if(s.add(o),a.add(o),this._origin===o._origin)o._id.user<this._id.user&&(this._left=o,a.clear());else{if(!s.has(o._origin))break;a.has(o._origin)||(this._left=o,a.clear())}o=o._right}var l=this._parentSub;if(null===this._left){var u=void 0;if(null!==l){var c=e._map;u=c.get(l)||null,c.set(l,this)}else u=e._start,e._start=this;this._right=u,null!==u&&(u._left=this)}else{var h=this._left,f=h._right;this._right=f,h._right=this,null!==f&&(f._left=this)}e._deleted&&this._delete(t,!1),t.os.put(this),m(t,e,l),this._id.user!==qt&&(null===t.connector||!t.connector._forwardAppliedStructs&&this._id.user!==t.userID||t.connector.broadcastStruct(this),null!==t.persistence&&t.persistence.saveStruct(t,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor));var e=0;null!==this._origin&&(e+=1),null!==this._right_origin&&(e+=4),null!==this._parentSub&&(e+=8),t.writeUint8(e),t.writeID(this._id),1&e&&t.writeID(this._origin._lastId),4&e&&t.writeID(this._right_origin._id),0==(5&e)&&t.writeID(this._parent._id),8&e&&t.writeVarString(JSON.stringify(this._parentSub))}},{key:"_fromBinary",value:function(t,e){var n=[],r=e.readUint8(),i=e.readID();if(this._id=i,1&r){var o=e.readID(),a=t.os.getItemCleanEnd(o);null===a?n.push(o):(this._origin=a,this._left=this._origin)}if(4&r){var s=e.readID(),l=t.os.getItemCleanStart(s);null===l?n.push(s):(this._right=l,this._right_origin=l)}if(0==(5&r)){var u=e.readID();if(null===this._parent){var c=void 0;c=u.constructor===$t?t.os.get(u):t.os.getItem(u),null===c?n.push(u):this._parent=c}}else null===this._parent&&(null!==this._origin?this._origin.constructor===Lt?this._parent=this._origin:this._parent=this._origin._parent:null!==this._right_origin&&(this._right_origin.constructor===Lt?this._parent=this._right_origin:this._parent=this._right_origin._parent));return 8&r&&(this._parentSub=JSON.parse(e.readVarString())),t.ss.getState(i.user)<i.clock&&n.push(new Pt(i.user,i.clock-1)),n}},{key:"_lastId",get:function(){return new Pt(this._id.user,this._id.clock+this._length-1)}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!0}}]),Item}(),Wt=function(){function t(){Et(this,t),this.eventListeners=[]}return Ut(t,[{key:"destroy",value:function(){this.eventListeners=null}},{key:"addEventListener",value:function(t){this.eventListeners.push(t)}},{key:"removeEventListener",value:function(t){this.eventListeners=this.eventListeners.filter(function(e){return t!==e})}},{key:"removeAllEventListeners",value:function(){this.eventListeners=[]}},{key:"callEventListeners",value:function(t,e){for(var n=0;n<this.eventListeners.length;n++)try{(0,this.eventListeners[n])(e)}catch(t){console.error(t)}}}]),t}(),Type=function(t){function Type(){Et(this,Type);var t=At(this,(Type.__proto__||Object.getPrototypeOf(Type)).call(this));return t._map=new Map,t._start=null,t._y=null,t._eventHandler=new Wt,t._deepEventHandler=new Wt,t}return Tt(Type,t),Ut(Type,[{key:"getPathTo",value:function(t){if(t===this)return[];for(var e=[],n=this._y;t!==this&&t!==n;){var r=t._parent;if(null!==t._parentSub)e.unshift(t._parentSub);else{var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=xt(s.value,2),c=u[0];if(u[1]===t){e.unshift(c);break}}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}}t=r}if(t!==this)throw new Error("The type is not a child of this node");return e}},{key:"_callEventHandler",value:function(t,e){var n=t.changedParentTypes;this._eventHandler.callEventListeners(t,e);for(var r=this;r!==this._y;){var i=n.get(r);void 0===i&&(i=[],n.set(r,i)),i.push(e),r=r._parent}}},{key:"_transact",value:function(t){var e=this._y;null!==e?e.transact(t):t(e)}},{key:"observe",value:function(t){this._eventHandler.addEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserve",value:function(t){this._eventHandler.removeEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_integrate",value:function(t){Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_integrate",this).call(this,t),this._y=t;var e=this._start;null!==e&&(this._start=null,b(t,e));var n=this._map;this._map=new Map;var r=!0,i=!1,o=void 0;try{for(var a,s=n.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){b(t,a.value)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}}},{key:"_gcChildren",value:function(t){w(t,this._start),this._start=null,this._map.forEach(function(e){w(t,e)}),this._map=new Map}},{key:"_gc",value:function(t){this._gcChildren(t),Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_gc",this).call(this,t)}},{key:"_delete",value:function(t,e,n){void 0!==n&&t.gcEnabled||(n=!1===t._hasUndoManager&&t.gcEnabled),Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_delete",this).call(this,t,e,n),t._transaction.changedTypes.delete(this);var r=!0,i=!1,o=void 0;try{for(var a,s=this._map.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){var l=a.value;l instanceof Item&&!l._deleted&&l._delete(t,!1,n)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}for(var u=this._start;null!==u;)u._deleted||u._delete(t,!1,n),u=u._right;n&&this._gcChildren(t)}}]),Type}(Item),ItemJSON=function(t){function ItemJSON(){Et(this,ItemJSON);var t=At(this,(ItemJSON.__proto__||Object.getPrototypeOf(ItemJSON)).call(this));return t._content=null,t}return Tt(ItemJSON,t),Ut(ItemJSON,[{key:"_copy",value:function(){var t=Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_fromBinary",this).call(this,t,e),r=e.readVarUint();this._content=new Array(r);for(var i=0;i<r;i++){var o=e.readVarString(),a=void 0;a="undefined"===o?void 0:JSON.parse(o),this._content[i]=a}return n}},{key:"_toBinary",value:function(t){Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_toBinary",this).call(this,t);var e=this._content.length;t.writeVarUint(e);for(var n=0;n<e;n++){var r=void 0,i=this._content[n];r=void 0===i?"undefined":JSON.stringify(i),t.writeVarString(r)}}},{key:"_logString",value:function(){return y("ItemJSON",this,"content:"+JSON.stringify(this._content))}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemJSON;return n._content=this._content.splice(e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemJSON}(Item),ItemString=function(t){function ItemString(){Et(this,ItemString);var t=At(this,(ItemString.__proto__||Object.getPrototypeOf(ItemString)).call(this));return t._content=null,t}return Tt(ItemString,t),Ut(ItemString,[{key:"_copy",value:function(){var t=Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_fromBinary",this).call(this,t,e);return this._content=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_toBinary",this).call(this,t),t.writeVarString(this._content)}},{key:"_logString",value:function(){return y("ItemString",this,'content:"'+this._content+'"')}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemString;return n._content=this._content.slice(e),this._content=this._content.slice(0,e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemString}(Item),YEvent=function(){function YEvent(t){Et(this,YEvent),this.target=t,this.currentTarget=t}return Ut(YEvent,[{key:"path",get:function(){return this.currentTarget.getPathTo(this.target)}}]),YEvent}(),YArrayEvent=function(t){function YArrayEvent(t,e,n){Et(this,YArrayEvent);var r=At(this,(YArrayEvent.__proto__||Object.getPrototypeOf(YArrayEvent)).call(this,t));return r.remote=e,r._transaction=n,r._addedElements=null,r._removedElements=null,r}return Tt(YArrayEvent,t),Ut(YArrayEvent,[{key:"addedElements",get:function(){if(null===this._addedElements){var t=this.target,e=this._transaction,n=new Set;e.newTypes.forEach(function(r){r._parent!==t||e.deletedStructs.has(r)||n.add(r)}),this._addedElements=n}return this._addedElements}},{key:"removedElements",get:function(){if(null===this._removedElements){var t=this.target,e=this._transaction,n=new Set;e.deletedStructs.forEach(function(r){r._parent!==t||e.newTypes.has(r)||n.add(r)}),this._removedElements=n}return this._removedElements}}]),YArrayEvent}(YEvent),YArray=function(t){function YArray(){return Et(this,YArray),At(this,(YArray.__proto__||Object.getPrototypeOf(YArray)).apply(this,arguments))}return Tt(YArray,t),Ut(YArray,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YArrayEvent(this,n,t))}},{key:"get",value:function(t){for(var e=this._start;null!==e;){if(!e._deleted&&e._countable){if(t<e._length)return e.constructor===ItemJSON||e.constructor===ItemString?e._content[t]:e;t-=e._length}e=e._right}}},{key:"toArray",value:function(){return this.map(function(t){return t})}},{key:"toJSON",value:function(){return this.map(function(t){return t instanceof Type?null!==t.toJSON?t.toJSON():t.toString():t})}},{key:"map",value:function(t){var e=this,n=[];return this.forEach(function(r,i){n.push(t(r,i,e))}),n}},{key:"forEach",value:function(t){for(var e=0,n=this._start;null!==n;){if(!n._deleted&&n._countable)if(n instanceof Type)t(n,e++,this);else for(var r=n._content,i=r.length,o=0;o<i;o++)e++,t(r[o],e,this);n=n._right}}},{key:Symbol.iterator,value:function(){return{next:function(){for(;null!==this._item&&(this._item._deleted||this._item._length<=this._itemElement);)this._item=this._item._right,this._itemElement=0;if(null===this._item)return{done:!0};var t=void 0;return t=this._item instanceof Type?this._item:this._item._content[this._itemElement++],{value:t,done:!1}},_item:this._start,_itemElement:0,_count:0}}},{key:"delete",value:function(t){var e=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1;if(this._y.transact(function(){for(var r=e._start,i=0;null!==r&&n>0;){if(!r._deleted&&r._countable)if(i<=t&&t<i+r._length){var o=t-i;r=r._splitAt(e._y,o),r._splitAt(e._y,n),n-=r._length,r._delete(e._y),i+=o}else i+=r._length;r=r._right}}),n>0)throw new Error("Delete exceeds the range of the YArray")}},{key:"insertAfter",value:function(t,e){var n=this;return this._transact(function(r){var i=void 0;i=null===t?n._start:t._right;for(var o=null,a=0;a<e.length;a++){var s=e[a];"function"==typeof s&&(s=new s),s instanceof Type?(null!==o&&(null!==r&&o._integrate(r),t=o,o=null),s._origin=t,s._left=t,s._right=i,s._right_origin=i,s._parent=n,null!==r?s._integrate(r):null===t?n._start=s:t._right=s,t=s):(null===o&&(o=new ItemJSON,o._origin=t,o._left=t,o._right=i,o._right_origin=i,o._parent=n,o._content=[]),o._content.push(s))}null!==o&&(null!==r?o._integrate(r):null===o._left&&(n._start=o))}),e}},{key:"insert",value:function(t,e){var n=this;this._transact(function(){for(var r=null,i=n._start,o=0,a=n._y;null!==i;){var s=i._deleted?0:i._length-1;if(o<=t&&t<=o+s){var l=t-o;i=i._splitAt(a,l),r=i._left,o+=l;break}i._deleted||(o+=i._length),r=i,i=i._right}if(t>o)throw new Error("Index exceeds array range!");n.insertAfter(r,e)})}},{key:"push",value:function(t){for(var e=this._start,n=null;null!==e;)e._deleted||(n=e),e=e._right;this.insertAfter(n,t)}},{key:"_logString",value:function(){return y("YArray",this,"start:"+p(this._start)+'"')}},{key:"length",get:function(){for(var t=0,e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._length),e=e._right;return t}}]),YArray}(Type),YMapEvent=function(t){function YMapEvent(t,e,n){Et(this,YMapEvent);var r=At(this,(YMapEvent.__proto__||Object.getPrototypeOf(YMapEvent)).call(this,t));return r.keysChanged=e,r.remote=n,r}return Tt(YMapEvent,t),YMapEvent}(YEvent),YMap=function(t){function YMap(){return Et(this,YMap),At(this,(YMap.__proto__||Object.getPrototypeOf(YMap)).apply(this,arguments))}return Tt(YMap,t),Ut(YMap,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YMapEvent(this,e,n))}},{key:"toJSON",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];if(!l._deleted){var u=void 0;u=l instanceof Type?void 0!==l.toJSON?l.toJSON():l.toString():l._content[0],t[s]=u}}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"keys",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0];a[1]._deleted||t.push(s)}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"delete",value:function(t){var e=this;this._transact(function(n){var r=e._map.get(t);null!==n&&void 0!==r&&r._delete(n)})}},{key:"set",value:function(t,e){var n=this;return this._transact(function(r){var i=n._map.get(t)||null;if(null!==i){if(i.constructor===ItemJSON&&!i._deleted&&i._content[0]===e)return e;null!==r&&i._delete(r)}var o=void 0;"function"==typeof e?(o=new e,e=o):e instanceof Item?o=e:(o=new ItemJSON,o._content=[e]),o._right=i,o._right_origin=i,o._parent=n,o._parentSub=t,null!==r?o._integrate(r):n._map.set(t,o)}),e}},{key:"get",value:function(t){var e=this._map.get(t);if(void 0!==e&&!e._deleted)return e instanceof Type?e:e._content[e._content.length-1]}},{key:"has",value:function(t){var e=this._map.get(t);return void 0!==e&&!e._deleted}},{key:"_logString",value:function(){return y("YMap",this,"mapSize:"+this._map.size)}}]),YMap}(Type),Ht=function(t){function e(){Et(this,e);var t=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.embed=null,t}return Tt(e,t),Ut(e,[{key:"_copy",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.embed=this.embed,r}},{key:"_fromBinary",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.embed=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(JSON.stringify(this.embed))}},{key:"_logString",value:function(){return y("ItemEmbed",this,"embed:"+JSON.stringify(this.embed))}},{key:"_length",get:function(){return 1}}]),e}(Item),Jt=function(t){function e(){Et(this,e);var t=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.key=null,t.value=null,t}return Tt(e,t),Ut(e,[{key:"_copy",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.key=this.key,r.value=this.value,r}},{key:"_fromBinary",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.key=n.readVarString(),this.value=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.key),t.writeVarString(JSON.stringify(this.value))}},{key:"_logString",value:function(){return y("ItemFormat",this,"key:"+JSON.stringify(this.key)+",value:"+JSON.stringify(this.value))}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!1}}]),e}(Item),zt=function(t){function e(t,n,r){Et(this,e);var i=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n,r));return i._delta=null,i}return Tt(e,t),Ut(e,[{key:"delta",get:function(){var t=this;if(null===this._delta){var e=this.target._y;e.transact(function(){var n=t.target._start,r=[],i=t.addedElements,o=t.removedElements;t._delta=r;for(var a=null,s={},l=new Map,u=new Map,c="",h=0,f=0,d=function(){if(null!==a){var t=void 0;switch(a){case"delete":t={delete:f},f=0;break;case"insert":if(t={insert:c},l.size>0){t.attributes={};var e=!0,n=!1,i=void 0;try{for(var o,u=l[Symbol.iterator]();!(e=(o=u.next()).done);e=!0){var d=xt(o.value,2),_=d[0],v=d[1];null!==v&&(t.attributes[_]=v)}}catch(t){n=!0,i=t}finally{try{!e&&u.return&&u.return()}finally{if(n)throw i}}}c="";break;case"retain":if(t={retain:h},Object.keys(s).length>0){t.attributes={};for(var _ in s)t.attributes[_]=s[_]}h=0}r.push(t),a=null}};null!==n;){switch(n.constructor){case Ht:i.has(n)?(d(),a="insert",c=n.embed,d()):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=1):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=1);break;case ItemString:i.has(n)?("insert"!==a&&(d(),a="insert"),c+=n._content):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=n._length):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=n._length);break;case Jt:if(i.has(n)){(l.get(n.key)||null)!==n.value?("retain"===a&&d(),n.value===(u.get(n.key)||null)?delete s[n.key]:s[n.key]=n.value):n._delete(e)}else if(o.has(n)){u.set(n.key,n.value);var _=l.get(n.key)||null;_!==n.value&&("retain"===a&&d(),s[n.key]=_)}else if(!1===n._deleted){u.set(n.key,n.value);var v=s[n.key];void 0!==v&&(v!==n.value?("retain"===a&&d(),null===n.value?s[n.key]=n.value:delete s[n.key]):n._delete(e))}!1===n._deleted&&("insert"===a&&d(),B(l,n))}n=n._right}for(d();t._delta.length>0;){var p=t._delta[t._delta.length-1];if(void 0===p.retain||void 0!==p.attributes)break;t._delta.pop()}})}return this._delta}}]),e}(YArrayEvent),YText=function(t){function YText(t){Et(this,YText);var e=At(this,(YText.__proto__||Object.getPrototypeOf(YText)).call(this));if("string"==typeof t){var n=new ItemString;n._parent=e,n._content=t,e._start=n}return e}return Tt(YText,t),Ut(YText,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new zt(this,n,t))}},{key:"toString",value:function(){for(var t="",e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._content),e=e._right;return t}},{key:"applyDelta",value:function(t){var e=this;this._transact(function(n){for(var r=null,i=e._start,o=new Map,a=0;a<t.length;a++){var s=t[a];if(void 0!==s.insert){var l=x(n,s.insert,e,r,i,o,s.attributes||{}),u=xt(l,2);r=u[0],i=u[1]}else if(void 0!==s.retain){var c=I(n,s.retain,e,r,i,o,s.attributes||{}),h=xt(c,2);r=h[0],i=h[1]}else if(void 0!==s.delete){var f=D(n,s.delete,e,r,i,o),d=xt(f,2);r=d[0],i=d[1]}}})}},{key:"toDelta",value:function(){function t(){if(r.length>0){var t={},i=!1,o=!0,a=!1,s=void 0;try{for(var l,u=n[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=xt(l.value,2),h=c[0],f=c[1];i=!0,t[h]=f}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}var d={insert:r};i&&(d.attributes=t),e.push(d),r=""}}for(var e=[],n=new Map,r="",i=this._start;null!==i;){if(!i._deleted)switch(i.constructor){case ItemString:r+=i._content;break;case Jt:t(),B(n,i)}i=i._right}return t(),e}},{key:"insert",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};e.length<=0||this._transact(function(i){var o=E(n,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"insertEmbed",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(e.constructor!==Object)throw new Error("Embed must be an Object");this._transact(function(i){var o=E(n,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"delete",value:function(t,e){var n=this;0!==e&&this._transact(function(r){var i=E(n,t),o=xt(i,3),a=o[0],s=o[1],l=o[2];D(r,e,n,a,s,l)})}},{key:"format",value:function(t,e,n){var r=this;this._transact(function(i){var o=E(r,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];null!==l&&I(i,e,r,s,l,u,n)})}},{key:"_logString",value:function(){return y("YText",this)}}]),YText}(YArray),YXmlHook=function(t){function YXmlHook(t){Et(this,YXmlHook);var e=At(this,(YXmlHook.__proto__||Object.getPrototypeOf(YXmlHook)).call(this));return e.hookName=null,void 0!==t&&(e.hookName=t),e}return Tt(YXmlHook,t),Ut(YXmlHook,[{key:"_copy",value:function(){var t=Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_copy",this).call(this);return t.hookName=this.hookName,t}},{key:"toDom",value:function(){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},e=arguments[2],n=t[this.hookName],r=void 0;return r=void 0!==n?n.createDom(this):document.createElement(this.hookName),r.setAttribute("data-yjs-hook",this.hookName),R(e,r,this),r}},{key:"_fromBinary",value:function(t,e){var n=Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_fromBinary",this).call(this,t,e);return this.hookName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.hookName)}},{key:"_integrate",value:function(t){if(null===this.hookName)throw new Error("hookName must be defined!");Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_integrate",this).call(this,t)}}]),YXmlHook}(YMap),Yt=function(){function t(e,n){Et(this,t),this._filter=n||function(){return!0},this._root=e,this._currentNode=e,this._firstCall=!0}return Ut(t,[{key:Symbol.iterator,value:function(){return this}},{key:"next",value:function(){var t=this._currentNode;if(this._firstCall&&(this._firstCall=!1,!t._deleted&&this._filter(t)))return{value:t,done:!1};do{if(t._deleted||t.constructor!==YXmlFragment._YXmlElement&&t.constructor!==YXmlFragment||null===t._start){for(;t!==this._root;){if(null!==t._right){t=t._right;break}t=t._parent}t===this._root&&(t=null)}else t=t._start;if(t===this._root)break}while(null!==t&&(t._deleted||!this._filter(t)));return this._currentNode=t,null===t?{done:!0}:{value:t,done:!1}}}]),t}(),YXmlEvent=function(t){function YXmlEvent(t,e,n,r){Et(this,YXmlEvent);var i=At(this,(YXmlEvent.__proto__||Object.getPrototypeOf(YXmlEvent)).call(this,t));return i._transaction=r,i.childListChanged=!1,i.attributesChanged=new Set,i.remote=n,e.forEach(function(t){null===t?i.childListChanged=!0:i.attributesChanged.add(t)}),i}return Tt(YXmlEvent,t),YXmlEvent}(YEvent),YXmlFragment=function(t){function YXmlFragment(){return Et(this,YXmlFragment),At(this,(YXmlFragment.__proto__||Object.getPrototypeOf(YXmlFragment)).apply(this,arguments))}return Tt(YXmlFragment,t),Ut(YXmlFragment,[{key:"createTreeWalker",value:function(t){return new Yt(this,t)}},{key:"querySelector",value:function(t){t=t.toUpperCase();var e=new Yt(this,function(e){return e.nodeName===t}),n=e.next();return n.done?null:n.value}},{key:"querySelectorAll",value:function(t){return t=t.toUpperCase(),Array.from(new Yt(this,function(e){return e.nodeName===t}))}},{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YXmlEvent(this,e,n,t))}},{key:"toString",value:function(){return this.map(function(t){return t.toString()}).join("")}},{key:"_delete",value:function(t,e,n){Bt(YXmlFragment.prototype.__proto__||Object.getPrototypeOf(YXmlFragment.prototype),"_delete",this).call(this,t,e,n)}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createDocumentFragment();return R(n,r,this),this.forEach(function(i){r.insertBefore(i.toDom(t,e,n),null)}),r}},{key:"_logString",value:function(){return y("YXml",this)}}]),YXmlFragment}(YArray),YXmlElement=function(t){function YXmlElement(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"UNDEFINED";Et(this,YXmlElement);var e=At(this,(YXmlElement.__proto__||Object.getPrototypeOf(YXmlElement)).call(this));return e.nodeName=t.toUpperCase(),e}return Tt(YXmlElement,t),Ut(YXmlElement,[{key:"_copy",value:function(){var t=Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_copy",this).call(this);return t.nodeName=this.nodeName,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_fromBinary",this).call(this,t,e);return this.nodeName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.nodeName)}},{key:"_integrate",value:function(t){if(null===this.nodeName)throw new Error("nodeName must be defined!");Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_integrate",this).call(this,t)}},{key:"toString",value:function(){var t=this.getAttributes(),e=[],n=[];for(var r in t)n.push(r);n.sort();for(var i=n.length,o=0;o<i;o++){var a=n[o];e.push(a+'="'+t[a]+'"')}var s=this.nodeName.toLocaleLowerCase();return"<"+s+(e.length>0?" "+e.join(" "):"")+">"+Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"toString",this).call(this)+"</"+s+">"}},{key:"removeAttribute",value:function(t){return YMap.prototype.delete.call(this,t)}},{key:"setAttribute",value:function(t,e){return YMap.prototype.set.call(this,t,e)}},{key:"getAttribute",value:function(t){return YMap.prototype.get.call(this,t)}},{key:"getAttributes",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];l._deleted||(t[s]=l._content[0])}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createElement(this.nodeName),i=this.getAttributes();for(var o in i)r.setAttribute(o,i[o]);return this.forEach(function(i){r.appendChild(i.toDom(t,e,n))}),R(n,r,this),r}}]),YXmlElement}(YXmlFragment);YXmlFragment._YXmlElement=YXmlElement;var YXmlText=function(t){function YXmlText(){return Et(this,YXmlText),At(this,(YXmlText.__proto__||Object.getPrototypeOf(YXmlText)).apply(this,arguments))}return Tt(YXmlText,t),Ut(YXmlText,[{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments[2],n=t.createTextNode(this.toString());return R(e,n,this),n}},{key:"_delete",value:function(t,e,n){Bt(YXmlText.prototype.__proto__||Object.getPrototypeOf(YXmlText.prototype),"_delete",this).call(this,t,e,n)}}]),YXmlText}(YText),Ft=new Map,Xt=new Map;X(0,ItemJSON),X(1,ItemString),X(10,Jt),X(11,Ht),X(2,Delete),X(3,YArray),X(4,YMap),X(5,YText),X(6,YXmlFragment),X(7,YXmlElement),X(8,YXmlText),X(9,YXmlHook),X(12,Lt);var qt=16777215,$t=function(){function t(e,n){Et(this,t),this.user=qt,this.name=e,this.type=$(n)}return Ut(t,[{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.name===this.name&&t.type===this.type}},{key:"lessThan",value:function(e){return e.constructor!==t||(this.user<e.user||this.user===e.user&&(this.name<e.name||this.name===e.name&&this.type<e.type))}}]),t}(),Gt=function(t){function e(t){Et(this,e);var n=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return n.y=t,n}return Tt(e,t),Ut(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){e.constructor===Lt?t.push({id:p(e),content:e._length,deleted:"GC"}):t.push({id:p(e),origin:p(null===e._origin?null:e._origin._lastId),left:p(null===e._left?null:e._left._lastId),right:p(e._right),right_origin:p(e._right_origin),parent:p(e._parent),parentSub:e._parentSub,deleted:e._deleted,content:JSON.stringify(e._content)})}),console.table(t)}},{key:"get",value:function(t){var e=this.find(t);if(null===e&&t instanceof $t){var n=q(t.type),r=this.y;e=new n,e._id=t,e._parent=r,r.transact(function(){e._integrate(r)}),this.put(e)}return e}},{key:"getItem",value:function(t){var e=this.findWithUpperBound(t);if(null===e)return null;var n=e._id;return t.user===n.user&&t.clock<n.clock+e._length?e:null}},{key:"getItemCleanStart",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock===t.clock?e:e._splitAt(this.y,t.clock-n.clock)}},{key:"getItemCleanEnd",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock+e._length-1===t.clock?e:(e._splitAt(this.y,t.clock-n.clock+1),e)}}]),e}(Dt),Zt=function(){function t(e){Et(this,t),this.y=e,this.state=new Map}return Ut(t,[{key:"logTable",value:function(){var t=[],e=!0,n=!1,r=void 0;try{
for(var i,o=this.state[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];t.push({user:s,state:l})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}console.table(t)}},{key:"getNextID",value:function(t){var e=this.y.userID,n=this.getState(e);return this.setState(e,n+t),new Pt(e,n)}},{key:"updateRemoteState",value:function(t){for(var e=t._id.user,n=this.state.get(e);null!==t&&t._id.clock===n;)n+=t._length,t=this.y.os.get(new Pt(e,n));this.state.set(e,n)}},{key:"getState",value:function(t){var e=this.state.get(t);return null==e?0:e}},{key:"setState",value:function(t,e){var n=this.y._transaction.beforeState;n.has(t)||n.set(t,this.getState(t)),this.state.set(t,e)}}]),t}(),Qt=function(){function t(){Et(this,t),this._eventListener=new Map,this._stateListener=new Map}return Ut(t,[{key:"_getListener",value:function(t){var e=this._eventListener.get(t);return void 0===e&&(e={once:new Set,on:new Set},this._eventListener.set(t,e)),e}},{key:"once",value:function(t,e){this._getListener(t).once.add(e)}},{key:"on",value:function(t,e){this._getListener(t).on.add(e)}},{key:"_initStateListener",value:function(t){var e=this._stateListener.get(t);return void 0===e&&(e={},e.promise=new Promise(function(t){e.resolve=t}),this._stateListener.set(t,e)),e}},{key:"when",value:function(t){return this._initStateListener(t).promise}},{key:"off",value:function(t,e){if(null==t||null==e)throw new Error("You must specify event name and function!");var n=this._eventListener.get(t);void 0!==n&&(n.on.delete(e),n.once.delete(e))}},{key:"emit",value:function(t){for(var e=arguments.length,n=Array(e>1?e-1:0),r=1;r<e;r++)n[r-1]=arguments[r];this._initStateListener(t).resolve();var i=this._eventListener.get(t);void 0!==i?(i.on.forEach(function(t){return t.apply(null,n)}),i.once.forEach(function(t){return t.apply(null,n)}),i.once=new Set):"error"===t&&console.error(n[0])}},{key:"destroy",value:function(){this._eventListener=null}}]),t}(),Kt=function(){function t(e,n){Et(this,t),this.type=e,this.target=n,this._mutualExclude=K()}return Ut(t,[{key:"destroy",value:function(){this.type=null,this.target=null}}]),t}(),te=null,ee="undefined"!=typeof getSelection?tt:function(){return null},ne=function(t){function e(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};Et(this,e);var i=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));i.opts=r,r.document=r.document||document,r.hooks=r.hooks||{},i.scrollingElement=r.scrollingElement||null,i.domToType=new Map,i.typeToDom=new Map,i.filter=r.filter||j,n.innerHTML="",t.forEach(function(t){n.insertBefore(t.toDom(r.document,r.hooks,i),null)}),i._typeObserver=ot.bind(i),i._domObserver=function(t){lt.call(i,t,r.document)},t.observeDeep(i._typeObserver),i._mutationObserver=new MutationObserver(i._domObserver),i._mutationObserver.observe(n,{childList:!0,attributes:!0,characterData:!0,subtree:!0}),i._currentSel=null,document.addEventListener("selectionchange",function(){i._currentSel=ee(i)});var o=t._y;return i.y=o,i._beforeTransactionHandler=function(t,e,n){i._domObserver(i._mutationObserver.takeRecords()),i._mutualExclude(function(){et(i,n)})},o.on("beforeTransaction",i._beforeTransactionHandler),i._afterTransactionHandler=function(t,e,n){i._mutualExclude(function(){nt(i,n)}),e.deletedStructs.forEach(function(t){var e=i.typeToDom.get(t);void 0!==e&&C(i,e,t)})},o.on("afterTransaction",i._afterTransactionHandler),i._beforeObserverCallsHandler=function(t,e){e.changedTypes.forEach(function(e,n){(e.size>1||1===e.size&&!1===e.has(null))&&V(t,i,n)}),e.newTypes.forEach(function(e){V(t,i,e)})},o.on("beforeObserverCalls",i._beforeObserverCallsHandler),R(i,n,t),i}return Tt(e,t),Ut(e,[{key:"setFilter",value:function(t){this.filter=t}},{key:"_getUndoStackInfo",value:function(){return this.getSelection()}},{key:"_restoreUndoStackInfo",value:function(t){this.restoreSelection(t)}},{key:"getSelection",value:function(){return this._currentSel}},{key:"restoreSelection",value:function(t){if(null!==t){var e=t.to,n=t.from,r=!1,i=getSelection(),o=i.baseNode,a=i.baseOffset,s=i.extentNode,l=i.extentOffset;if(null!==n){var u=Q(this.y,n);if(null!==u){var c=this.typeToDom.get(u.type),h=u.offset;c===o&&h===a||(o=c,a=h,r=!0)}}if(null!==e){var f=Q(this.y,e);if(null!==f){var d=this.typeToDom.get(f.type),_=f.offset;d===s&&_===l||(s=d,l=_,r=!0)}}r&&i.setBaseAndExtent(o,a,s,l)}}},{key:"destroy",value:function(){this.domToType=null,this.typeToDom=null,this.type.unobserveDeep(this._typeObserver),this._mutationObserver.disconnect();var t=this.type._y;t.off("beforeTransaction",this._beforeTransactionHandler),t.off("beforeObserverCalls",this._beforeObserverCallsHandler),t.off("afterTransaction",this._afterTransactionHandler),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),Y=function(t){function Y(t,e,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{};Et(this,Y);var i=At(this,(Y.__proto__||Object.getPrototypeOf(Y)).call(this));i.gcEnabled=r.gc||!1,i.room=t,null!=e&&(e.connector.room=t),i._contentReady=!1,i._opts=e,"number"!=typeof e.userID?i.userID=G():i.userID=e.userID,i.share={},i.ds=new Nt(i),i.os=new Gt(i),i.ss=new Zt(i),i._missingStructs=new Map,i._readyToIntegrate=[],i._transaction=null,i.connector=null,i.connected=!1;var o=function(){null!=e&&(i.connector=new Y[e.connector.name](i,e.connector),i.connected=!0,i.emit("connectorReady"))};return i.persistence=null,null!=n?(i.persistence=n,n._init(i).then(o)):o(),i._parent=null,i._hasUndoManager=!1,i}return Tt(Y,t),Ut(Y,[{key:"_setContentReady",value:function(){this._contentReady||(this._contentReady=!0,this.emit("content"))}},{key:"whenContentReady",value:function(){var t=this;return this._contentReady?Promise.resolve():new Promise(function(e){t.once("content",e)})}},{key:"_beforeChange",value:function(){}},{key:"transact",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=null===this._transaction;n&&(this._transaction=new Rt(this),this.emit("beforeTransaction",this,this._transaction,e));try{t(this)}catch(t){console.error(t)}if(n){this.emit("beforeObserverCalls",this,this._transaction,e);var r=this._transaction;this._transaction=null,r.changedTypes.forEach(function(t,n){n._deleted||n._callObserver(r,t,e)}),r.changedParentTypes.forEach(function(t,e){e._deleted||(t=t.filter(function(t){return!t.target._deleted}),t.forEach(function(t){t.currentTarget=e}),e._deepEventHandler.callEventListeners(r,t))}),this.emit("afterTransaction",this,r,e)}}},{key:"define",value:function(t,e){var n=new $t(t,e),r=this.os.get(n);if(void 0===this.share[t])this.share[t]=r;else if(this.share[t]!==r)throw new Error("Type is already defined with a different constructor");return r}},{key:"get",value:function(t){return this.share[t]}},{key:"disconnect",value:function(){return this.connected?(this.connected=!1,this.connector.disconnect()):Promise.resolve()}},{key:"reconnect",value:function(){return this.connected?Promise.resolve():(this.connected=!0,this.connector.reconnect())}},{key:"destroy",value:function(){Bt(Y.prototype.__proto__||Object.getPrototypeOf(Y.prototype),"destroy",this).call(this),this.share=null,null!=this.connector&&(null!=this.connector.destroy?this.connector.destroy():this.connector.disconnect()),null!==this.persistence&&(this.persistence.deinit(this),this.persistence=null),this.os=null,this.ds=null,this.ss=null}},{key:"_start",get:function(){return null},set:function(t){return null}}]),Y}(Qt);Y.extend=function(){for(var t=0;t<arguments.length;t++){var e=arguments[t];if("function"!=typeof e)throw new Error("Expected a function!");e(Y)}};var re=function t(e,n,r){var i=this;Et(this,t),this.created=new Date;var o=n.beforeState;o.has(e.userID)?(this.toState=new Pt(e.userID,e.ss.getState(e.userID)-1),this.fromState=new Pt(e.userID,o.get(e.userID))):(this.toState=null,this.fromState=null),this.deletedStructs=new Set,n.deletedStructs.forEach(function(t){i.deletedStructs.add({from:t._id,len:t._length})}),this.bindingInfos=r},ie=function(){function t(e){var n=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};Et(this,t),this.options=r,this._bindings=new Set(r.bindings),r.captureTimeout=null==r.captureTimeout?500:r.captureTimeout,this._undoBuffer=[],this._redoBuffer=[],this._scope=e,this._undoing=!1,this._redoing=!1,this._lastTransactionWasUndo=!1;var i=e._y;this.y=i,i._hasUndoManager=!0;var o=void 0;i.on("beforeTransaction",function(t,e,r){r||(o=new Map,n._bindings.forEach(function(t){o.set(t,t._getUndoStackInfo())}))}),i.on("afterTransaction",function(t,i,a){if(!a&&i.changedParentTypes.has(e)){var s=new re(t,i,o);if(n._undoing)n._lastTransactionWasUndo=!0,n._redoBuffer.push(s);else{var l=n._undoBuffer.length>0?n._undoBuffer[n._undoBuffer.length-1]:null;!1===n._redoing&&!1===n._lastTransactionWasUndo&&null!==l&&(r.captureTimeout<0||s.created-l.created<=r.captureTimeout)?(l.created=s.created,null!==s.toState&&(l.toState=s.toState,null===l.fromState&&(l.fromState=s.fromState)),s.deletedStructs.forEach(l.deletedStructs.add,l.deletedStructs)):(n._lastTransactionWasUndo=!1,n._undoBuffer.push(s)),n._redoing||(n._redoBuffer=[])}}})}return Ut(t,[{key:"flushChanges",value:function(){this._lastTransactionWasUndo=!0}},{key:"undo",value:function(){this._undoing=!0;var t=ut(this.y,this._scope,this._undoBuffer);return this._undoing=!1,t}},{key:"redo",value:function(){this._redoing=!0;var t=ut(this.y,this._scope,this._redoBuffer);return this._redoing=!1,t}}]),t}(),oe=1e3,ae=60*oe,se=60*ae,le=24*se,ue=365.25*le,ce=function(t,e){e=e||{};var n=void 0===t?"undefined":Ot(t);if("string"===n&&t.length>0)return ht(t);if("number"===n&&!1===isNaN(t))return e.long?dt(t):ft(t);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(t))},he=ct(function(t,e){function n(t){var n,r=0;for(n in t)r=(r<<5)-r+t.charCodeAt(n),r|=0;return e.colors[Math.abs(r)%e.colors.length]}function r(t){function r(){if(r.enabled){var t=r,n=+new Date,i=n-(l||n);t.diff=i,t.prev=l,t.curr=n,l=n;for(var o=new Array(arguments.length),a=0;a<o.length;a++)o[a]=arguments[a];o[0]=e.coerce(o[0]),"string"!=typeof o[0]&&o.unshift("%O");var s=0;o[0]=o[0].replace(/%([a-zA-Z%])/g,function(n,r){if("%%"===n)return n;s++;var i=e.formatters[r];if("function"==typeof i){var a=o[s];n=i.call(t,a),o.splice(s,1),s--}return n}),e.formatArgs.call(t,o);(r.log||e.log||console.log.bind(console)).apply(t,o)}}return r.namespace=t,r.enabled=e.enabled(t),r.useColors=e.useColors(),r.color=n(t),"function"==typeof e.init&&e.init(r),r}function i(t){e.save(t),e.names=[],e.skips=[];for(var n=("string"==typeof t?t:"").split(/[\s,]+/),r=n.length,i=0;i<r;i++)n[i]&&(t=n[i].replace(/\*/g,".*?"),"-"===t[0]?e.skips.push(new RegExp("^"+t.substr(1)+"$")):e.names.push(new RegExp("^"+t+"$")))}function o(){e.enable("")}function a(t){var n,r;for(n=0,r=e.skips.length;n<r;n++)if(e.skips[n].test(t))return!1;for(n=0,r=e.names.length;n<r;n++)if(e.names[n].test(t))return!0;return!1}function s(t){return t instanceof Error?t.stack||t.message:t}e=t.exports=r.debug=r.default=r,e.coerce=s,e.disable=o,e.enable=i,e.enabled=a,e.humanize=ce,e.names=[],e.skips=[],e.formatters={};var l}),fe=(he.coerce,he.disable,he.enable,he.enabled,he.humanize,he.names,he.skips,he.formatters,ct(function(t,e){function n(){return!("undefined"==typeof window||!window.process||"renderer"!==window.process.type)||("undefined"!=typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"undefined"!=typeof window&&window.console&&(window.console.firebug||window.console.exception&&window.console.table)||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))}function r(t){var n=this.useColors;if(t[0]=(n?"%c":"")+this.namespace+(n?" %c":" ")+t[0]+(n?"%c ":" ")+"+"+e.humanize(this.diff),n){var r="color: "+this.color;t.splice(1,0,r,"color: inherit");var i=0,o=0;t[0].replace(/%[a-zA-Z%]/g,function(t){"%%"!==t&&(i++,"%c"===t&&(o=i))}),t.splice(o,0,r)}}function i(){return"object"===("undefined"==typeof console?"undefined":Ot(console))&&console.log&&Function.prototype.apply.call(console.log,console,arguments)}function o(t){try{null==t?e.storage.removeItem("debug"):e.storage.debug=t}catch(t){}}function a(){var t;try{t=e.storage.debug}catch(t){}return!t&&"undefined"!=typeof process&&"env"in process&&(t=process.env.DEBUG),t}e=t.exports=he,e.log=i,e.formatArgs=r,e.save=o,e.load=a,e.useColors=n,e.storage="undefined"!=typeof chrome&&void 0!==chrome.storage?chrome.storage.local:function(){try{return window.localStorage}catch(t){}}(),e.colors=["lightseagreen","forestgreen","goldenrod","dodgerblue","darkorchid","crimson"],e.formatters.j=function(t){try{return JSON.stringify(t)}catch(t){return"[UnexpectedJSONParseError]: "+t.message}},e.enable(a())})),de=(fe.log,fe.formatArgs,fe.save,fe.load,fe.useColors,fe.storage,fe.colors,function(){function t(e,n){if(Et(this,t),this.y=e,this.opts=n,null==n.role||"master"===n.role)this.role="master";else{if("slave"!==n.role)throw new Error("Role must be either 'master' or 'slave'!");this.role="slave"}this.log=fe("y:connector"),this.logMessage=fe("y:connector-message"),this._forwardAppliedStructs=n.forwardAppliedOperations||!1,this.role=n.role,this.connections=new Map,this.isSynced=!1,this.userEventListeners=[],this.whenSyncedListeners=[],this.currentSyncTarget=null,this.debug=!0===n.debug,this.broadcastBuffer=new Ct,this.broadcastBufferSize=0,this.protocolVersion=11,this.authInfo=n.auth||null,this.checkAuth=n.checkAuth||function(){return Promise.resolve("write")},null==n.maxBufferLength?this.maxBufferLength=-1:this.maxBufferLength=n.maxBufferLength}return Ut(t,[{key:"reconnect",value:function(){this.log("reconnecting..")}},{key:"disconnect",value:function(){return this.log("discronnecting.."),this.connections=new Map,this.isSynced=!1,this.currentSyncTarget=null,this.whenSyncedListeners=[],Promise.resolve()}},{key:"onUserEvent",value:function(t){this.userEventListeners.push(t)}},{key:"removeUserEventListener",value:function(t){this.userEventListeners=this.userEventListeners.filter(function(e){return t!==e})}},{key:"userLeft",value:function(t){if(this.connections.has(t)){this.log("%s: User left %s",this.y.userID,t),this.connections.delete(t),this._setSyncedWith(null);var e=!0,n=!1,r=void 0;try{for(var i,o=this.userEventListeners[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){(0,i.value)({action:"userLeft",user:t})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}}}},{key:"userJoined",value:function(t,e,n){if(null==e)throw new Error("You must specify the role of the joined user!");if(this.connections.has(t))throw new Error("This user already joined!");this.log("%s: User joined %s",this.y.userID,t),this.connections.set(t,{uid:t,isSynced:!1,role:e,processAfterAuth:[],processAfterSync:[],auth:n||null,receivedSyncStep2:!1});var r={};r.promise=new Promise(function(t){r.resolve=t}),this.connections.get(t).syncStep2=r;var i=!0,o=!1,a=void 0;try{for(var s,l=this.userEventListeners[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){(0,s.value)({action:"userJoined",user:t,role:e})}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}this._syncWithUser(t)}},{key:"whenSynced",value:function(t){this.isSynced?t():this.whenSyncedListeners.push(t)}},{key:"_syncWithUser",value:function(t){"slave"!==this.role&&u(this,t)}},{key:"_fireIsSyncedListeners",value:function(){if(!this.isSynced){this.isSynced=!0;var t=!0,e=!1,n=void 0;try{for(var r,i=this.whenSyncedListeners[Symbol.iterator]();!(t=(r=i.next()).done);t=!0){(0,r.value)()}}catch(t){e=!0,n=t}finally{try{!t&&i.return&&i.return()}finally{if(e)throw n}}this.whenSyncedListeners=[],this.y._setContentReady(),this.y.emit("synced")}}},{key:"send",value:function(t,e){var n=this.y;if(!(e instanceof ArrayBuffer||e instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s to User%s: Send '%y'",n.userID,t,e),this.logMessage("User%s to User%s: Send %Y",n.userID,t,[n,e])}},{key:"broadcast",value:function(t){var e=this.y;if(!(t instanceof ArrayBuffer||t instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s: Broadcast '%y'",e.userID,t),this.logMessage("User%s: Broadcast: %Y",e.userID,[e,t])}},{key:"broadcastStruct",value:function(t){var e=this,n=0===this.broadcastBuffer.length;if(n&&(this.broadcastBuffer.writeVarString(this.y.room),this.broadcastBuffer.writeVarString("update"),this.broadcastBufferSize=0,this.broadcastBufferSizePos=this.broadcastBuffer.pos,this.broadcastBuffer.writeUint32(0)),this.broadcastBufferSize++,t._toBinary(this.broadcastBuffer),this.maxBufferLength>0&&this.broadcastBuffer.length>this.maxBufferLength){var r=this.broadcastBuffer;r.setUint32(this.broadcastBufferSizePos,this.broadcastBufferSize),this.broadcastBuffer=new Ct,this.whenRemoteResponsive().then(function(){e.broadcast(r.createBuffer())})}else n&&setTimeout(function(){if(e.broadcastBuffer.length>0){var t=e.broadcastBuffer;t.setUint32(e.broadcastBufferSizePos,e.broadcastBufferSize),e.broadcast(t.createBuffer()),e.broadcastBuffer=new Ct}},0)}},{key:"whenRemoteResponsive",value:function(){return new Promise(function(t){setTimeout(t,100)})}},{key:"receiveMessage",value:function(t,e,n){var r=this,i=this.y,o=i.userID;if(n=n||!1,!(e instanceof ArrayBuffer||e instanceof Uint8Array))return Promise.reject(new Error("Expected Message to be an ArrayBuffer or Uint8Array!"));if(t===o)return Promise.resolve();var a=new Vt(e),s=new Ct,l=a.readVarString();s.writeVarString(l);var u=a.readVarString(),c=this.connections.get(t);if(this.log("User%s from User%s: Receive '%s'",o,t,u),this.logMessage("User%s from User%s: Receive %Y",o,t,[i,e]),null==c&&!n)throw new Error("Received message from unknown peer!");if("sync step 1"===u||"sync step 2"===u){var h=a.readVarUint();if(null==c.auth)return c.processAfterAuth.push([u,c,a,s,t]),this.checkAuth(h,i,t).then(function(t){null==c.auth&&(c.auth=t,i.emit("userAuthenticated",{user:c.uid,auth:t}));var e=c.processAfterAuth;c.processAfterAuth=[],e.forEach(function(t){return r.computeMessage(t[0],t[1],t[2],t[3],t[4])})})}!n&&null==c.auth||"update"===u&&!c.isSynced?c.processAfterSync.push([u,c,a,s,t,!1]):this.computeMessage(u,c,a,s,t,n)}},{key:"computeMessage",value:function(t,e,n,i,o,a){if("sync step 1"!==t||"write"!==e.auth&&"read"!==e.auth){var s=this.y;s.transact(function(){if("sync step 2"===t&&"write"===e.auth)d(n,i,s,e,o);else{if("update"!==t||!a&&"write"!==e.auth)throw new Error("Unable to receive message");r(s,n)}},!0)}else h(n,i,this.y,e,o)}},{key:"_setSyncedWith",value:function(t){var e=this;if(null!=t){var n=this.connections.get(t);n.isSynced=!0;var r=n.processAfterSync;n.processAfterSync=[],r.forEach(function(t){e.computeMessage(t[0],t[1],t[2],t[3],t[4])})}var i=Array.from(this.connections.values());i.length>0&&i.every(function(t){return t.isSynced})&&this._fireIsSyncedListeners()}}]),t}()),_e=function(){function t(e){Et(this,t),this.opts=e,this.ys=new Map}return Ut(t,[{key:"_init",value:function(t){var e=this,n=this.ys.get(t);return void 0===n?(n=yt(),n.mutualExclude=K(),this.ys.set(t,n),this.init(t).then(function(){return t.on("afterTransaction",function(t,n){var r=e.ys.get(t);if(r.len>0){r.buffer.setUint32(0,r.len),e.saveUpdate(t,r.buffer.createBuffer(),n);var i=yt();for(var o in i)r[o]=i[o]}}),e.retrieve(t)}).then(function(){return Promise.resolve(n)})):Promise.resolve(n)}},{key:"deinit",value:function(t){this.ys.delete(t),t.persistence=null}},{key:"destroy",value:function(){this.ys=null}},{key:"removePersistedData",value:function(t){var e=this,n=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];this.ys.forEach(function(r,i){i.room===t&&(n?i.destroy():e.deinit(i))})}},{key:"saveUpdate",value:function(t){}},{key:"saveStruct",value:function(t,e){var n=this.ys.get(t);void 0!==n&&n.mutualExclude(function(){e._toBinary(n.buffer),n.len++})}},{key:"retrieve",value:function(t,e,n){var i=this.ys.get(t);void 0!==i&&i.mutualExclude(function(){t.transact(function(){if(null!=e&&vt(t,new Vt(new Uint8Array(e))),null!=n)for(var i=0;i<n.length;i++)r(t,new Vt(new Uint8Array(n[i])))}),t.emit("persistenceReady")})}},{key:"persist",value:function(t){return pt(t).createBuffer()}}]),t}(),ve=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.value=t.toString(),r._typeObserver=gt.bind(r),r._domObserver=mt.bind(r),t.observe(r._typeObserver),n.addEventListener("input",r._domObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._domObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),pe=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setContents(t.toDelta(),"yjs"),r._typeObserver=kt.bind(r),r._quillObserver=bt.bind(r),t.observe(r._typeObserver),n.on("text-change",r._quillObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.off("text-change",this._quillObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),ye=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setValue(t.toString()),r._typeObserver=wt.bind(r),r._codeMirrorObserver=St.bind(r),t.observe(r._typeObserver),n.on("changes",r._codeMirrorObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._codeMirrorObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt);return Y.AbstractConnector=de,Y.AbstractPersistence=_e,Y.Array=YArray,Y.Map=YMap,Y.Text=YText,Y.XmlElement=YXmlElement,Y.XmlFragment=YXmlFragment,Y.XmlText=YXmlText,Y.XmlHook=YXmlHook,Y.TextareaBinding=ve,Y.QuillBinding=pe,Y.DomBinding=ne,Y.CodeMirrorBinding=ye,ne.domToType=L,ne.domsToTypes=J,ne.switchAssociation=W,Y.utils={BinaryDecoder:Vt,UndoManager:ie,getRelativePosition:Z,fromRelativePosition:Q,registerStruct:X,integrateRemoteStructs:r,toBinary:pt,fromBinary:vt},Y.debug=fe,fe.formatters.Y=_,fe.formatters.y=v,Y});


}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":4,"buffer":2}],7:[function(require,module,exports){
var Y = require('yjs');
window.Y = Y;
require('y-webrtc3')(Y);

let y = new Y('ynotebook', {
    connector: {
        name: 'webrtc',
        room: 'dinesh',
        url: 'http://finwin.io:1256'
    }
});
window.y = y;

for (var id in shared_elements) {
    var codemirror = shared_elements[id]['codemirror'];
    var output = shared_elements[id]['output'];
    new Y.CodeMirrorBinding(y.define('codemirror'+id, Y.Text), codemirror);
    new Y.DomBinding(y.define('xml'+id, Y.XmlFragment), output);
}

window.resolve_ymap = true;
var ymap = y.define('ymap', Y.Map);
ymap.observe(function (e) {
    exec_ymap();
    if (window.resolve_ymap) {
        window.resolve_ymap = false;
        exec_ymap();
    }
});
window.ymap = ymap;

function exec_ymap() {
    if (typeof Jupyter !== 'undefined' && typeof Jupyter.notebook !== 'undefined') {
        var keys = ymap.keys();
        for (var index in keys) {
            var id = keys[index];
            set_cell(id, ymap.get(id)['index'], ymap.get(id)['active']);
        }
    } else {
        setTimeout(exec_ymap, 0);
    }
}

window.get_inactive_cell = function (type) {
    var cells = Jupyter.notebook.get_cells();
    for (var i=0; i<cells.length; i++) {
        if (cells[i].cell_type === type && cells[i].metadata.active === false) {
            return cells[i];
        }
    }
}

window.get_cell = function (id) {
    var cells = Jupyter.notebook.get_cells();
    for (var i=0; i<cells.length; i++) {
        if (cells[i].metadata.id === id) {
            return cells[i];
        }
    }
}

window.set_cell = function (id, index, active) {
    function set_element(element, index) {
        var to = $('#notebook-container');
        if (index === 0) {
            to.prepend(element);
        } else {
            to.children().eq(index-1).after(element);
        }
    }

    var cell = get_cell(parseInt(id));
    set_element(cell.element, index);
    if (active) {
        cell.metadata.active = true;
        cell.element.removeClass('hidden');
        cell.focus_cell();
    } else {
        cell.element.addClass('hidden');
        cell.set_text('');
        if (cell.cell_type === 'code') {
            cell.output_area.clear_output();
        }
        cell.metadata.active = false;
    }
}

},{"y-webrtc3":5,"yjs":6}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMveS13ZWJydGMuanMiLCJub2RlX21vZHVsZXMveWpzL3kuanMiLCJzcmMvYXBwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbnZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5mb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxufVxuXG4vLyBTdXBwb3J0IGRlY29kaW5nIFVSTC1zYWZlIGJhc2U2NCBzdHJpbmdzLCBhcyBOb2RlLmpzIGRvZXMuXG4vLyBTZWU6IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jhc2U2NCNVUkxfYXBwbGljYXRpb25zXG5yZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbnJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG5mdW5jdGlvbiBnZXRMZW5zIChiNjQpIHtcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gVHJpbSBvZmYgZXh0cmEgYnl0ZXMgYWZ0ZXIgcGxhY2Vob2xkZXIgYnl0ZXMgYXJlIGZvdW5kXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JlYXRnYW1taXQvYmFzZTY0LWpzL2lzc3Vlcy80MlxuICB2YXIgdmFsaWRMZW4gPSBiNjQuaW5kZXhPZignPScpXG4gIGlmICh2YWxpZExlbiA9PT0gLTEpIHZhbGlkTGVuID0gbGVuXG5cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IHZhbGlkTGVuID09PSBsZW5cbiAgICA/IDBcbiAgICA6IDQgLSAodmFsaWRMZW4gJSA0KVxuXG4gIHJldHVybiBbdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbl1cbn1cblxuLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChiNjQpIHtcbiAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NClcbiAgdmFyIHZhbGlkTGVuID0gbGVuc1swXVxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXVxuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gX2J5dGVMZW5ndGggKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikge1xuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cblxuICB2YXIgYXJyID0gbmV3IEFycihfYnl0ZUxlbmd0aChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pKVxuXG4gIHZhciBjdXJCeXRlID0gMFxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgdmFyIGxlbiA9IHBsYWNlSG9sZGVyc0xlbiA+IDBcbiAgICA/IHZhbGlkTGVuIC0gNFxuICAgIDogdmFsaWRMZW5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8XG4gICAgICByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMikge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDEpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPVxuICAgICAgKCh1aW50OFtpXSA8PCAxNikgJiAweEZGMDAwMCkgK1xuICAgICAgKCh1aW50OFtpICsgMV0gPDwgOCkgJiAweEZGMDApICtcbiAgICAgICh1aW50OFtpICsgMl0gJiAweEZGKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKFxuICAgICAgdWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKVxuICAgICkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgbG9va3VwW3RtcCA+PiAyXSArXG4gICAgICBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdICtcbiAgICAgICc9PSdcbiAgICApXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArIHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMTBdICtcbiAgICAgIGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXSArXG4gICAgICAnPSdcbiAgICApXG4gIH1cblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGh0dHBzOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuXG52YXIgS19NQVhfTEVOR1RIID0gMHg3ZmZmZmZmZlxuZXhwb3J0cy5rTWF4TGVuZ3RoID0gS19NQVhfTEVOR1RIXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFByaW50IHdhcm5pbmcgYW5kIHJlY29tbWVuZCB1c2luZyBgYnVmZmVyYCB2NC54IHdoaWNoIGhhcyBhbiBPYmplY3RcbiAqICAgICAgICAgICAgICAgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIFdlIHJlcG9ydCB0aGF0IHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGlmIHRoZSBhcmUgbm90IHN1YmNsYXNzYWJsZVxuICogdXNpbmcgX19wcm90b19fLiBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YFxuICogKFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4KS4gSUUgMTAgbGFja3Mgc3VwcG9ydFxuICogZm9yIF9fcHJvdG9fXyBhbmQgaGFzIGEgYnVnZ3kgdHlwZWQgYXJyYXkgaW1wbGVtZW50YXRpb24uXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5pZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBjb25zb2xlLmVycm9yID09PSAnZnVuY3Rpb24nKSB7XG4gIGNvbnNvbGUuZXJyb3IoXG4gICAgJ1RoaXMgYnJvd3NlciBsYWNrcyB0eXBlZCBhcnJheSAoVWludDhBcnJheSkgc3VwcG9ydCB3aGljaCBpcyByZXF1aXJlZCBieSAnICtcbiAgICAnYGJ1ZmZlcmAgdjUueC4gVXNlIGBidWZmZXJgIHY0LnggaWYgeW91IHJlcXVpcmUgb2xkIGJyb3dzZXIgc3VwcG9ydC4nXG4gIClcbn1cblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICAvLyBDYW4gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWQ/XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLl9fcHJvdG9fXyA9IHtfX3Byb3RvX186IFVpbnQ4QXJyYXkucHJvdG90eXBlLCBmb286IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH19XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDJcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAncGFyZW50Jywge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5idWZmZXJcbiAgfVxufSlcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlci5wcm90b3R5cGUsICdvZmZzZXQnLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ5dGVPZmZzZXRcbiAgfVxufSlcblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKGxlbmd0aCA+IEtfTUFYX0xFTkdUSCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgYnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGJ1ZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0lmIGVuY29kaW5nIGlzIHNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJ1xuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NVbnNhZmUoYXJnKVxuICB9XG4gIHJldHVybiBmcm9tKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIHdyaXRhYmxlOiBmYWxzZVxuICB9KVxufVxuXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxuZnVuY3Rpb24gZnJvbSAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cblxuICBpZiAoaXNBcnJheUJ1ZmZlcih2YWx1ZSkgfHwgKHZhbHVlICYmIGlzQXJyYXlCdWZmZXIodmFsdWUuYnVmZmVyKSkpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KVxuICB9XG5cbiAgcmV0dXJuIGZyb21PYmplY3QodmFsdWUpXG59XG5cbi8qKlxuICogRnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdG8gQnVmZmVyKGFyZywgZW5jb2RpbmcpIGJ1dCB0aHJvd3MgYSBUeXBlRXJyb3JcbiAqIGlmIHZhbHVlIGlzIGEgbnVtYmVyLlxuICogQnVmZmVyLmZyb20oc3RyWywgZW5jb2RpbmddKVxuICogQnVmZmVyLmZyb20oYXJyYXkpXG4gKiBCdWZmZXIuZnJvbShidWZmZXIpXG4gKiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlclssIGJ5dGVPZmZzZXRbLCBsZW5ndGhdXSlcbiAqKi9cbkJ1ZmZlci5mcm9tID0gZnVuY3Rpb24gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGZyb20odmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuLy8gTm90ZTogQ2hhbmdlIHByb3RvdHlwZSAqYWZ0ZXIqIEJ1ZmZlci5mcm9tIGlzIGRlZmluZWQgdG8gd29ya2Fyb3VuZCBDaHJvbWUgYnVnOlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC8xNDhcbkJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbkJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG5cbmZ1bmN0aW9uIGFzc2VydFNpemUgKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSBudW1iZXInKVxuICB9IGVsc2UgaWYgKHNpemUgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIG5lZ2F0aXZlJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcihzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2Moc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlIChzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbn1cblxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIEJ1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIFNsb3dCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbmd0aClcblxuICB2YXIgYWN0dWFsID0gYnVmLndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG5cbiAgaWYgKGFjdHVhbCAhPT0gbGVuZ3RoKSB7XG4gICAgLy8gV3JpdGluZyBhIGhleCBzdHJpbmcsIGZvciBleGFtcGxlLCB0aGF0IGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycyB3aWxsXG4gICAgLy8gY2F1c2UgZXZlcnl0aGluZyBhZnRlciB0aGUgZmlyc3QgaW52YWxpZCBjaGFyYWN0ZXIgdG8gYmUgaWdub3JlZC4gKGUuZy5cbiAgICAvLyAnYWJ4eGNkJyB3aWxsIGJlIHRyZWF0ZWQgYXMgJ2FiJylcbiAgICBidWYgPSBidWYuc2xpY2UoMCwgYWN0dWFsKVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlIChhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgYnVmW2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJvZmZzZXRcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcImxlbmd0aFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICB2YXIgYnVmXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbilcblxuICAgIGlmIChidWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYnVmXG4gICAgfVxuXG4gICAgb2JqLmNvcHkoYnVmLCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIGJ1ZlxuICB9XG5cbiAgaWYgKG9iaikge1xuICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcob2JqKSB8fCAnbGVuZ3RoJyBpbiBvYmopIHtcbiAgICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgbnVtYmVySXNOYU4ob2JqLmxlbmd0aCkpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcigwKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqKVxuICAgIH1cblxuICAgIGlmIChvYmoudHlwZSA9PT0gJ0J1ZmZlcicgJiYgQXJyYXkuaXNBcnJheShvYmouZGF0YSkpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iai5kYXRhKVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIG9uZSBvZiB0eXBlIHN0cmluZywgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQXJyYXksIG9yIEFycmF5LWxpa2UgT2JqZWN0LicpXG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBLX01BWF9MRU5HVEhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIEtfTUFYX0xFTkdUSC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuIGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlciA9PT0gdHJ1ZVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhidWYpKSB7XG4gICAgICBidWYgPSBCdWZmZXIuZnJvbShidWYpXG4gICAgfVxuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gICAgfVxuICAgIGJ1Zi5jb3B5KGJ1ZmZlciwgcG9zKVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gIH1cbiAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhzdHJpbmcpIHx8IGlzQXJyYXlCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoaXMgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCAoYW5kIHRoZSBgaXMtYnVmZmVyYCBucG0gcGFja2FnZSlcbi8vIHRvIGRldGVjdCBhIEJ1ZmZlciBpbnN0YW5jZS4gSXQncyBub3QgcG9zc2libGUgdG8gdXNlIGBpbnN0YW5jZW9mIEJ1ZmZlcmBcbi8vIHJlbGlhYmx5IGluIGEgYnJvd3NlcmlmeSBjb250ZXh0IGJlY2F1c2UgdGhlcmUgY291bGQgYmUgbXVsdGlwbGUgZGlmZmVyZW50XG4vLyBjb3BpZXMgb2YgdGhlICdidWZmZXInIHBhY2thZ2UgaW4gdXNlLiBUaGlzIG1ldGhvZCB3b3JrcyBldmVuIGZvciBCdWZmZXJcbi8vIGluc3RhbmNlcyB0aGF0IHdlcmUgY3JlYXRlZCBmcm9tIGFub3RoZXIgY29weSBvZiB0aGUgYGJ1ZmZlcmAgcGFja2FnZS5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvaXNzdWVzLzE1NFxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwNjQgPSBmdW5jdGlvbiBzd2FwNjQgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDggIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDY0LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDgpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyA3KVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyA2KVxuICAgIHN3YXAodGhpcywgaSArIDIsIGkgKyA1KVxuICAgIHN3YXAodGhpcywgaSArIDMsIGkgKyA0KVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0xvY2FsZVN0cmluZyA9IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmdcblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgIC8vIENvZXJjZSB0byBOdW1iZXIuXG4gIGlmIChudW1iZXJJc05hTihieXRlT2Zmc2V0KSkge1xuICAgIC8vIGJ5dGVPZmZzZXQ6IGl0IGl0J3MgdW5kZWZpbmVkLCBudWxsLCBOYU4sIFwiZm9vXCIsIGV0Yywgc2VhcmNoIHdob2xlIGJ1ZmZlclxuICAgIGJ5dGVPZmZzZXQgPSBkaXIgPyAwIDogKGJ1ZmZlci5sZW5ndGggLSAxKVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXQ6IG5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCArIGJ5dGVPZmZzZXRcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgIGlmIChkaXIpIHJldHVybiAtMVxuICAgIGVsc2UgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggLSAxXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICBpZiAoZGlyKSBieXRlT2Zmc2V0ID0gMFxuICAgIGVsc2UgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmFsXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICAvLyBGaW5hbGx5LCBzZWFyY2ggZWl0aGVyIGluZGV4T2YgKGlmIGRpciBpcyB0cnVlKSBvciBsYXN0SW5kZXhPZlxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChkaXIpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggIT09IC0xKSBpIC09IGkgLSBmb3VuZEluZGV4XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYnl0ZU9mZnNldCArIHZhbExlbmd0aCA+IGFyckxlbmd0aCkgYnl0ZU9mZnNldCA9IGFyckxlbmd0aCAtIHZhbExlbmd0aFxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgZm91bmQgPSB0cnVlXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbExlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChyZWFkKGFyciwgaSArIGopICE9PSByZWFkKHZhbCwgaikpIHtcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZvdW5kKSByZXR1cm4gaVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgdHJ1ZSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uIGxhc3RJbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBmYWxzZSlcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChudW1iZXJJc05hTihwYXJzZWQpKSByZXR1cm4gaVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gbGF0aW4xV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCA+Pj4gMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gbGF0aW4xU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIChieXRlc1tpICsgMV0gKiAyNTYpKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsICg4ICogYnl0ZUxlbmd0aCkgLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdhcmd1bWVudCBzaG91bGQgYmUgYSBCdWZmZXInKVxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiB0eXBlb2YgVWludDhBcnJheS5wcm90b3R5cGUuY29weVdpdGhpbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8vIFVzZSBidWlsdC1pbiB3aGVuIGF2YWlsYWJsZSwgbWlzc2luZyBmcm9tIElFMTFcbiAgICB0aGlzLmNvcHlXaXRoaW4odGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpXG4gIH0gZWxzZSBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKHZhciBpID0gbGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBVc2FnZTpcbi8vICAgIGJ1ZmZlci5maWxsKG51bWJlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoYnVmZmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChzdHJpbmdbLCBvZmZzZXRbLCBlbmRdXVssIGVuY29kaW5nXSlcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbCwgc3RhcnQsIGVuZCwgZW5jb2RpbmcpIHtcbiAgLy8gSGFuZGxlIHN0cmluZyBjYXNlczpcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gc3RhcnRcbiAgICAgIHN0YXJ0ID0gMFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuZFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9XG4gICAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5jb2RpbmcgbXVzdCBiZSBhIHN0cmluZycpXG4gICAgfVxuICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHZhciBjb2RlID0gdmFsLmNoYXJDb2RlQXQoMClcbiAgICAgIGlmICgoZW5jb2RpbmcgPT09ICd1dGY4JyAmJiBjb2RlIDwgMTI4KSB8fFxuICAgICAgICAgIGVuY29kaW5nID09PSAnbGF0aW4xJykge1xuICAgICAgICAvLyBGYXN0IHBhdGg6IElmIGB2YWxgIGZpdHMgaW50byBhIHNpbmdsZSBieXRlLCB1c2UgdGhhdCBudW1lcmljIHZhbHVlLlxuICAgICAgICB2YWwgPSBjb2RlXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMjU1XG4gIH1cblxuICAvLyBJbnZhbGlkIHJhbmdlcyBhcmUgbm90IHNldCB0byBhIGRlZmF1bHQsIHNvIGNhbiByYW5nZSBjaGVjayBlYXJseS5cbiAgaWYgKHN0YXJ0IDwgMCB8fCB0aGlzLmxlbmd0aCA8IHN0YXJ0IHx8IHRoaXMubGVuZ3RoIDwgZW5kKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghdmFsKSB2YWwgPSAwXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgdGhpc1tpXSA9IHZhbFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuaXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogbmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBpZiAobGVuID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgdmFsdWUgXCInICsgdmFsICtcbiAgICAgICAgJ1wiIGlzIGludmFsaWQgZm9yIGFyZ3VtZW50IFwidmFsdWVcIicpXG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teKy8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgdGFrZXMgZXF1YWwgc2lnbnMgYXMgZW5kIG9mIHRoZSBCYXNlNjQgZW5jb2RpbmdcbiAgc3RyID0gc3RyLnNwbGl0KCc9JylbMF1cbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0ci50cmltKCkucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG4vLyBBcnJheUJ1ZmZlcnMgZnJvbSBhbm90aGVyIGNvbnRleHQgKGkuZS4gYW4gaWZyYW1lKSBkbyBub3QgcGFzcyB0aGUgYGluc3RhbmNlb2ZgIGNoZWNrXG4vLyBidXQgdGhleSBzaG91bGQgYmUgdHJlYXRlZCBhcyB2YWxpZC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMTY2XG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyIChvYmopIHtcbiAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIEFycmF5QnVmZmVyIHx8XG4gICAgKG9iaiAhPSBudWxsICYmIG9iai5jb25zdHJ1Y3RvciAhPSBudWxsICYmIG9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSAnQXJyYXlCdWZmZXInICYmXG4gICAgICB0eXBlb2Ygb2JqLmJ5dGVMZW5ndGggPT09ICdudW1iZXInKVxufVxuXG5mdW5jdGlvbiBudW1iZXJJc05hTiAob2JqKSB7XG4gIHJldHVybiBvYmogIT09IG9iaiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSAoZSAqIDI1NikgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSAobSAqIDI1NikgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gKG5CeXRlcyAqIDgpIC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICgodmFsdWUgKiBjKSAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIlxuLyoqXG4gKiB5LXdlYnJ0YzMgLSBcbiAqIEB2ZXJzaW9uIHYyLjQuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLnl3ZWJydGMgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cblx0dmFyIGNvbW1vbmpzR2xvYmFsID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB7fTtcblxuXHRmdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgbW9kdWxlKSB7XG5cdFx0cmV0dXJuIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfSwgZm4obW9kdWxlLCBtb2R1bGUuZXhwb3J0cyksIG1vZHVsZS5leHBvcnRzO1xuXHR9XG5cblx0LyoqXHJcblx0ICogUGFyc2VzIGFuIFVSSVxyXG5cdCAqXHJcblx0ICogQGF1dGhvciBTdGV2ZW4gTGV2aXRoYW4gPHN0ZXZlbmxldml0aGFuLmNvbT4gKE1JVCBsaWNlbnNlKVxyXG5cdCAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAqL1xuXG5cdHZhciByZSA9IC9eKD86KD8hW146QF0rOlteOkBcXC9dKkApKGh0dHB8aHR0cHN8d3N8d3NzKTpcXC9cXC8pPygoPzooKFteOkBdKikoPzo6KFteOkBdKikpPyk/QCk/KCg/OlthLWYwLTldezAsNH06KXsyLDd9W2EtZjAtOV17MCw0fXxbXjpcXC8/I10qKSg/OjooXFxkKikpPykoKChcXC8oPzpbXj8jXSg/IVtePyNcXC9dKlxcLltePyNcXC8uXSsoPzpbPyNdfCQpKSkqXFwvPyk/KFtePyNcXC9dKikpKD86XFw/KFteI10qKSk/KD86IyguKikpPykvO1xuXG5cdHZhciBwYXJ0cyA9IFsnc291cmNlJywgJ3Byb3RvY29sJywgJ2F1dGhvcml0eScsICd1c2VySW5mbycsICd1c2VyJywgJ3Bhc3N3b3JkJywgJ2hvc3QnLCAncG9ydCcsICdyZWxhdGl2ZScsICdwYXRoJywgJ2RpcmVjdG9yeScsICdmaWxlJywgJ3F1ZXJ5JywgJ2FuY2hvciddO1xuXG5cdHZhciBwYXJzZXVyaSA9IGZ1bmN0aW9uIHBhcnNldXJpKHN0cikge1xuXHQgICAgdmFyIHNyYyA9IHN0cixcblx0ICAgICAgICBiID0gc3RyLmluZGV4T2YoJ1snKSxcblx0ICAgICAgICBlID0gc3RyLmluZGV4T2YoJ10nKTtcblxuXHQgICAgaWYgKGIgIT0gLTEgJiYgZSAhPSAtMSkge1xuXHQgICAgICAgIHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgYikgKyBzdHIuc3Vic3RyaW5nKGIsIGUpLnJlcGxhY2UoLzovZywgJzsnKSArIHN0ci5zdWJzdHJpbmcoZSwgc3RyLmxlbmd0aCk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBtID0gcmUuZXhlYyhzdHIgfHwgJycpLFxuXHQgICAgICAgIHVyaSA9IHt9LFxuXHQgICAgICAgIGkgPSAxNDtcblxuXHQgICAgd2hpbGUgKGktLSkge1xuXHQgICAgICAgIHVyaVtwYXJ0c1tpXV0gPSBtW2ldIHx8ICcnO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoYiAhPSAtMSAmJiBlICE9IC0xKSB7XG5cdCAgICAgICAgdXJpLnNvdXJjZSA9IHNyYztcblx0ICAgICAgICB1cmkuaG9zdCA9IHVyaS5ob3N0LnN1YnN0cmluZygxLCB1cmkuaG9zdC5sZW5ndGggLSAxKS5yZXBsYWNlKC87L2csICc6Jyk7XG5cdCAgICAgICAgdXJpLmF1dGhvcml0eSA9IHVyaS5hdXRob3JpdHkucmVwbGFjZSgnWycsICcnKS5yZXBsYWNlKCddJywgJycpLnJlcGxhY2UoLzsvZywgJzonKTtcblx0ICAgICAgICB1cmkuaXB2NnVyaSA9IHRydWU7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB1cmk7XG5cdH07XG5cblx0dmFyIHBhcnNldXJpJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcGFyc2V1cmksXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwYXJzZXVyaVxuXHR9KTtcblxuXHR2YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikge1xuXHQgIHJldHVybiB0eXBlb2Ygb2JqO1xuXHR9IDogZnVuY3Rpb24gKG9iaikge1xuXHQgIHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sICYmIG9iaiAhPT0gU3ltYm9sLnByb3RvdHlwZSA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqO1xuXHR9O1xuXG5cdHZhciBjbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcblx0ICBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTtcblx0ICB9XG5cdH07XG5cblx0dmFyIGNyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldO1xuXHQgICAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG5cdCAgICAgIGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTtcblx0ICAgICAgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTtcblx0ICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG5cdCAgICBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuXHQgICAgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7XG5cdCAgICByZXR1cm4gQ29uc3RydWN0b3I7XG5cdCAgfTtcblx0fSgpO1xuXG5cdHZhciBpbmhlcml0cyA9IGZ1bmN0aW9uIChzdWJDbGFzcywgc3VwZXJDbGFzcykge1xuXHQgIGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gXCJmdW5jdGlvblwiICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiICsgdHlwZW9mIHN1cGVyQ2xhc3MpO1xuXHQgIH1cblxuXHQgIHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwge1xuXHQgICAgY29uc3RydWN0b3I6IHtcblx0ICAgICAgdmFsdWU6IHN1YkNsYXNzLFxuXHQgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcblx0ICAgICAgd3JpdGFibGU6IHRydWUsXG5cdCAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHQgICAgfVxuXHQgIH0pO1xuXHQgIGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzcztcblx0fTtcblxuXHR2YXIgcG9zc2libGVDb25zdHJ1Y3RvclJldHVybiA9IGZ1bmN0aW9uIChzZWxmLCBjYWxsKSB7XG5cdCAgaWYgKCFzZWxmKSB7XG5cdCAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGNhbGwgJiYgKHR5cGVvZiBjYWxsID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBjYWxsID09PSBcImZ1bmN0aW9uXCIpID8gY2FsbCA6IHNlbGY7XG5cdH07XG5cblx0LyoqXG5cdCAqIEhlbHBlcnMuXG5cdCAqL1xuXG5cdHZhciBzID0gMTAwMDtcblx0dmFyIG0gPSBzICogNjA7XG5cdHZhciBoID0gbSAqIDYwO1xuXHR2YXIgZCA9IGggKiAyNDtcblx0dmFyIHkgPSBkICogMzY1LjI1O1xuXG5cdC8qKlxuXHQgKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuXHQgKlxuXHQgKiBPcHRpb25zOlxuXHQgKlxuXHQgKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcblx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuXHQgKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcblx0ICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIG1zID0gZnVuY3Rpb24gbXModmFsLCBvcHRpb25zKSB7XG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdCAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih2YWwpO1xuXHQgIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuXHQgICAgcmV0dXJuIHBhcnNlKHZhbCk7XG5cdCAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTih2YWwpID09PSBmYWxzZSkge1xuXHQgICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG5cdCAgfVxuXHQgIHRocm93IG5ldyBFcnJvcigndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICsgSlNPTi5zdHJpbmdpZnkodmFsKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0clxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBwYXJzZShzdHIpIHtcblx0ICBzdHIgPSBTdHJpbmcoc3RyKTtcblx0ICBpZiAoc3RyLmxlbmd0aCA+IDEwMCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG5cdCAgaWYgKCFtYXRjaCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuXHQgIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG5cdCAgc3dpdGNoICh0eXBlKSB7XG5cdCAgICBjYXNlICd5ZWFycyc6XG5cdCAgICBjYXNlICd5ZWFyJzpcblx0ICAgIGNhc2UgJ3lycyc6XG5cdCAgICBjYXNlICd5cic6XG5cdCAgICBjYXNlICd5Jzpcblx0ICAgICAgcmV0dXJuIG4gKiB5O1xuXHQgICAgY2FzZSAnZGF5cyc6XG5cdCAgICBjYXNlICdkYXknOlxuXHQgICAgY2FzZSAnZCc6XG5cdCAgICAgIHJldHVybiBuICogZDtcblx0ICAgIGNhc2UgJ2hvdXJzJzpcblx0ICAgIGNhc2UgJ2hvdXInOlxuXHQgICAgY2FzZSAnaHJzJzpcblx0ICAgIGNhc2UgJ2hyJzpcblx0ICAgIGNhc2UgJ2gnOlxuXHQgICAgICByZXR1cm4gbiAqIGg7XG5cdCAgICBjYXNlICdtaW51dGVzJzpcblx0ICAgIGNhc2UgJ21pbnV0ZSc6XG5cdCAgICBjYXNlICdtaW5zJzpcblx0ICAgIGNhc2UgJ21pbic6XG5cdCAgICBjYXNlICdtJzpcblx0ICAgICAgcmV0dXJuIG4gKiBtO1xuXHQgICAgY2FzZSAnc2Vjb25kcyc6XG5cdCAgICBjYXNlICdzZWNvbmQnOlxuXHQgICAgY2FzZSAnc2Vjcyc6XG5cdCAgICBjYXNlICdzZWMnOlxuXHQgICAgY2FzZSAncyc6XG5cdCAgICAgIHJldHVybiBuICogcztcblx0ICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG5cdCAgICBjYXNlICdtaWxsaXNlY29uZCc6XG5cdCAgICBjYXNlICdtc2Vjcyc6XG5cdCAgICBjYXNlICdtc2VjJzpcblx0ICAgIGNhc2UgJ21zJzpcblx0ICAgICAgcmV0dXJuIG47XG5cdCAgICBkZWZhdWx0OlxuXHQgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXHQgIH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBmbXRTaG9ydChtcykge1xuXHQgIGlmIChtcyA+PSBkKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuXHQgIH1cblx0ICBpZiAobXMgPj0gaCkge1xuXHQgICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcblx0ICB9XG5cdCAgaWYgKG1zID49IG0pIHtcblx0ICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG5cdCAgfVxuXHQgIGlmIChtcyA+PSBzKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuXHQgIH1cblx0ICByZXR1cm4gbXMgKyAnbXMnO1xuXHR9XG5cblx0LyoqXG5cdCAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbXNcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gZm10TG9uZyhtcykge1xuXHQgIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKSB8fCBwbHVyYWwobXMsIGgsICdob3VyJykgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJykgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJykgfHwgbXMgKyAnIG1zJztcblx0fVxuXG5cdC8qKlxuXHQgKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cblx0ICovXG5cblx0ZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG5cdCAgaWYgKG1zIDwgbikge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICBpZiAobXMgPCBuICogMS41KSB7XG5cdCAgICByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcblx0ICB9XG5cdCAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcblx0fVxuXG5cdHZhciBtcyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IG1zLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogbXNcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDAgPSAoIG1zJDEgJiYgbXMgKSB8fCBtcyQxO1xuXG5cdHZhciBkZWJ1ZyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG5cdCAgICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cblx0ICAgKlxuXHQgICAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZURlYnVnLmRlYnVnID0gY3JlYXRlRGVidWdbJ2RlZmF1bHQnXSA9IGNyZWF0ZURlYnVnO1xuXHQgIGV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuXHQgIGV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5cdCAgZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5cdCAgZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcblx0ICBleHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSQkMDtcblxuXHQgIC8qKlxuXHQgICAqIEFjdGl2ZSBgZGVidWdgIGluc3RhbmNlcy5cblx0ICAgKi9cblx0ICBleHBvcnRzLmluc3RhbmNlcyA9IFtdO1xuXG5cdCAgLyoqXG5cdCAgICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLm5hbWVzID0gW107XG5cdCAgZXhwb3J0cy5za2lwcyA9IFtdO1xuXG5cdCAgLyoqXG5cdCAgICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuXHQgICAqXG5cdCAgICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXIgb3IgdXBwZXItY2FzZSBsZXR0ZXIsIGkuZS4gXCJuXCIgYW5kIFwiTlwiLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cblx0ICAvKipcblx0ICAgKiBTZWxlY3QgYSBjb2xvci5cblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG5cdCAgICogQHJldHVybiB7TnVtYmVyfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gc2VsZWN0Q29sb3IobmFtZXNwYWNlKSB7XG5cdCAgICB2YXIgaGFzaCA9IDAsXG5cdCAgICAgICAgaTtcblxuXHQgICAgZm9yIChpIGluIG5hbWVzcGFjZSkge1xuXHQgICAgICBoYXNoID0gKGhhc2ggPDwgNSkgLSBoYXNoICsgbmFtZXNwYWNlLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgIGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBleHBvcnRzLmNvbG9yc1tNYXRoLmFicyhoYXNoKSAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG5cdCAgICogQHJldHVybiB7RnVuY3Rpb259XG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGNyZWF0ZURlYnVnKG5hbWVzcGFjZSkge1xuXG5cdCAgICB2YXIgcHJldlRpbWU7XG5cblx0ICAgIGZ1bmN0aW9uIGRlYnVnKCkge1xuXHQgICAgICAvLyBkaXNhYmxlZD9cblx0ICAgICAgaWYgKCFkZWJ1Zy5lbmFibGVkKSByZXR1cm47XG5cblx0ICAgICAgdmFyIHNlbGYgPSBkZWJ1ZztcblxuXHQgICAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuXHQgICAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuXHQgICAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuXHQgICAgICBzZWxmLmRpZmYgPSBtcztcblx0ICAgICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG5cdCAgICAgIHNlbGYuY3VyciA9IGN1cnI7XG5cdCAgICAgIHByZXZUaW1lID0gY3VycjtcblxuXHQgICAgICAvLyB0dXJuIHRoZSBgYXJndW1lbnRzYCBpbnRvIGEgcHJvcGVyIEFycmF5XG5cdCAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpO1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuXHQgICAgICB9XG5cblx0ICAgICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG5cdCAgICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcblx0ICAgICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlT1xuXHQgICAgICAgIGFyZ3MudW5zaGlmdCgnJU8nKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG5cdCAgICAgIHZhciBpbmRleCA9IDA7XG5cdCAgICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLCBmdW5jdGlvbiAobWF0Y2gsIGZvcm1hdCkge1xuXHQgICAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcblx0ICAgICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcblx0ICAgICAgICBpbmRleCsrO1xuXHQgICAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcblx0ICAgICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuXHQgICAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuXHQgICAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG5cdCAgICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG5cdCAgICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG5cdCAgICAgICAgICBpbmRleC0tO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByZXR1cm4gbWF0Y2g7XG5cdCAgICAgIH0pO1xuXG5cdCAgICAgIC8vIGFwcGx5IGVudi1zcGVjaWZpYyBmb3JtYXR0aW5nIChjb2xvcnMsIGV0Yy4pXG5cdCAgICAgIGV4cG9ydHMuZm9ybWF0QXJncy5jYWxsKHNlbGYsIGFyZ3MpO1xuXG5cdCAgICAgIHZhciBsb2dGbiA9IGRlYnVnLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuXHQgICAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcblx0ICAgIH1cblxuXHQgICAgZGVidWcubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXHQgICAgZGVidWcuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpO1xuXHQgICAgZGVidWcudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcblx0ICAgIGRlYnVnLmNvbG9yID0gc2VsZWN0Q29sb3IobmFtZXNwYWNlKTtcblx0ICAgIGRlYnVnLmRlc3Ryb3kgPSBkZXN0cm95O1xuXG5cdCAgICAvLyBlbnYtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGRlYnVnIGluc3RhbmNlc1xuXHQgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmluaXQpIHtcblx0ICAgICAgZXhwb3J0cy5pbml0KGRlYnVnKTtcblx0ICAgIH1cblxuXHQgICAgZXhwb3J0cy5pbnN0YW5jZXMucHVzaChkZWJ1Zyk7XG5cblx0ICAgIHJldHVybiBkZWJ1Zztcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBkZXN0cm95KCkge1xuXHQgICAgdmFyIGluZGV4ID0gZXhwb3J0cy5pbnN0YW5jZXMuaW5kZXhPZih0aGlzKTtcblx0ICAgIGlmIChpbmRleCAhPT0gLTEpIHtcblx0ICAgICAgZXhwb3J0cy5pbnN0YW5jZXMuc3BsaWNlKGluZGV4LCAxKTtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuXHQgICAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuXHQgICAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG5cdCAgICBleHBvcnRzLm5hbWVzID0gW107XG5cdCAgICBleHBvcnRzLnNraXBzID0gW107XG5cblx0ICAgIHZhciBpO1xuXHQgICAgdmFyIHNwbGl0ID0gKHR5cGVvZiBuYW1lc3BhY2VzID09PSAnc3RyaW5nJyA/IG5hbWVzcGFjZXMgOiAnJykuc3BsaXQoL1tcXHMsXSsvKTtcblx0ICAgIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3Ncblx0ICAgICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG5cdCAgICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcblx0ICAgICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgZXhwb3J0cy5pbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgdmFyIGluc3RhbmNlID0gZXhwb3J0cy5pbnN0YW5jZXNbaV07XG5cdCAgICAgIGluc3RhbmNlLmVuYWJsZWQgPSBleHBvcnRzLmVuYWJsZWQoaW5zdGFuY2UubmFtZXNwYWNlKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBkaXNhYmxlKCkge1xuXHQgICAgZXhwb3J0cy5lbmFibGUoJycpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG5cdCAgICogQHJldHVybiB7Qm9vbGVhbn1cblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG5cdCAgICBpZiAobmFtZVtuYW1lLmxlbmd0aCAtIDFdID09PSAnKicpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cdCAgICB2YXIgaSwgbGVuO1xuXHQgICAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIENvZXJjZSBgdmFsYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuXHQgICAqIEByZXR1cm4ge01peGVkfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuXHQgICAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuXHQgICAgcmV0dXJuIHZhbDtcblx0ICB9XG5cdH0pO1xuXHR2YXIgZGVidWdfMSA9IGRlYnVnLmNvZXJjZTtcblx0dmFyIGRlYnVnXzIgPSBkZWJ1Zy5kaXNhYmxlO1xuXHR2YXIgZGVidWdfMyA9IGRlYnVnLmVuYWJsZTtcblx0dmFyIGRlYnVnXzQgPSBkZWJ1Zy5lbmFibGVkO1xuXHR2YXIgZGVidWdfNSA9IGRlYnVnLmh1bWFuaXplO1xuXHR2YXIgZGVidWdfNiA9IGRlYnVnLmluc3RhbmNlcztcblx0dmFyIGRlYnVnXzcgPSBkZWJ1Zy5uYW1lcztcblx0dmFyIGRlYnVnXzggPSBkZWJ1Zy5za2lwcztcblx0dmFyIGRlYnVnXzkgPSBkZWJ1Zy5mb3JtYXR0ZXJzO1xuXG5cdHZhciBkZWJ1ZyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGRlYnVnLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogZGVidWcsXG5cdFx0Y29lcmNlOiBkZWJ1Z18xLFxuXHRcdGRpc2FibGU6IGRlYnVnXzIsXG5cdFx0ZW5hYmxlOiBkZWJ1Z18zLFxuXHRcdGVuYWJsZWQ6IGRlYnVnXzQsXG5cdFx0aHVtYW5pemU6IGRlYnVnXzUsXG5cdFx0aW5zdGFuY2VzOiBkZWJ1Z182LFxuXHRcdG5hbWVzOiBkZWJ1Z183LFxuXHRcdHNraXBzOiBkZWJ1Z184LFxuXHRcdGZvcm1hdHRlcnM6IGRlYnVnXzlcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDAkMSA9ICggZGVidWckMSAmJiBkZWJ1ZyApIHx8IGRlYnVnJDE7XG5cblx0dmFyIGJyb3dzZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuXHQgICAqXG5cdCAgICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSQkMCQxO1xuXHQgIGV4cG9ydHMubG9nID0gbG9nO1xuXHQgIGV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5cdCAgZXhwb3J0cy5zYXZlID0gc2F2ZTtcblx0ICBleHBvcnRzLmxvYWQgPSBsb2FkO1xuXHQgIGV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuXHQgIGV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlID8gY2hyb21lLnN0b3JhZ2UubG9jYWwgOiBsb2NhbHN0b3JhZ2UoKTtcblxuXHQgIC8qKlxuXHQgICAqIENvbG9ycy5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuY29sb3JzID0gWycjMDAwMENDJywgJyMwMDAwRkYnLCAnIzAwMzNDQycsICcjMDAzM0ZGJywgJyMwMDY2Q0MnLCAnIzAwNjZGRicsICcjMDA5OUNDJywgJyMwMDk5RkYnLCAnIzAwQ0MwMCcsICcjMDBDQzMzJywgJyMwMENDNjYnLCAnIzAwQ0M5OScsICcjMDBDQ0NDJywgJyMwMENDRkYnLCAnIzMzMDBDQycsICcjMzMwMEZGJywgJyMzMzMzQ0MnLCAnIzMzMzNGRicsICcjMzM2NkNDJywgJyMzMzY2RkYnLCAnIzMzOTlDQycsICcjMzM5OUZGJywgJyMzM0NDMDAnLCAnIzMzQ0MzMycsICcjMzNDQzY2JywgJyMzM0NDOTknLCAnIzMzQ0NDQycsICcjMzNDQ0ZGJywgJyM2NjAwQ0MnLCAnIzY2MDBGRicsICcjNjYzM0NDJywgJyM2NjMzRkYnLCAnIzY2Q0MwMCcsICcjNjZDQzMzJywgJyM5OTAwQ0MnLCAnIzk5MDBGRicsICcjOTkzM0NDJywgJyM5OTMzRkYnLCAnIzk5Q0MwMCcsICcjOTlDQzMzJywgJyNDQzAwMDAnLCAnI0NDMDAzMycsICcjQ0MwMDY2JywgJyNDQzAwOTknLCAnI0NDMDBDQycsICcjQ0MwMEZGJywgJyNDQzMzMDAnLCAnI0NDMzMzMycsICcjQ0MzMzY2JywgJyNDQzMzOTknLCAnI0NDMzNDQycsICcjQ0MzM0ZGJywgJyNDQzY2MDAnLCAnI0NDNjYzMycsICcjQ0M5OTAwJywgJyNDQzk5MzMnLCAnI0NDQ0MwMCcsICcjQ0NDQzMzJywgJyNGRjAwMDAnLCAnI0ZGMDAzMycsICcjRkYwMDY2JywgJyNGRjAwOTknLCAnI0ZGMDBDQycsICcjRkYwMEZGJywgJyNGRjMzMDAnLCAnI0ZGMzMzMycsICcjRkYzMzY2JywgJyNGRjMzOTknLCAnI0ZGMzNDQycsICcjRkYzM0ZGJywgJyNGRjY2MDAnLCAnI0ZGNjYzMycsICcjRkY5OTAwJywgJyNGRjk5MzMnLCAnI0ZGQ0MwMCcsICcjRkZDQzMzJ107XG5cblx0ICAvKipcblx0ICAgKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuXHQgICAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuXHQgICAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cblx0ICAgKlxuXHQgICAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG5cdCAgICAvLyBOQjogSW4gYW4gRWxlY3Ryb24gcHJlbG9hZCBzY3JpcHQsIGRvY3VtZW50IHdpbGwgYmUgZGVmaW5lZCBidXQgbm90IGZ1bGx5XG5cdCAgICAvLyBpbml0aWFsaXplZC4gU2luY2Ugd2Uga25vdyB3ZSdyZSBpbiBDaHJvbWUsIHdlJ2xsIGp1c3QgZGV0ZWN0IHRoaXMgY2FzZVxuXHQgICAgLy8gZXhwbGljaXRseVxuXHQgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGUgPT09ICdyZW5kZXJlcicpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIC8vIEludGVybmV0IEV4cGxvcmVyIGFuZCBFZGdlIGRvIG5vdCBzdXBwb3J0IGNvbG9ycy5cblx0ICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvKGVkZ2V8dHJpZGVudClcXC8oXFxkKykvKSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG5cdCAgICAvLyBkb2N1bWVudCBpcyB1bmRlZmluZWQgaW4gcmVhY3QtbmF0aXZlOiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QtbmF0aXZlL3B1bGwvMTYzMlxuXHQgICAgcmV0dXJuIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuV2Via2l0QXBwZWFyYW5jZSB8fFxuXHQgICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuXHQgICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmNvbnNvbGUgJiYgKHdpbmRvdy5jb25zb2xlLmZpcmVidWcgfHwgd2luZG93LmNvbnNvbGUuZXhjZXB0aW9uICYmIHdpbmRvdy5jb25zb2xlLnRhYmxlKSB8fFxuXHQgICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG5cdCAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcblx0ICAgIHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEgfHxcblx0ICAgIC8vIGRvdWJsZSBjaGVjayB3ZWJraXQgaW4gdXNlckFnZW50IGp1c3QgaW4gY2FzZSB3ZSBhcmUgaW4gYSB3b3JrZXJcblx0ICAgIHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24gKHYpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcblx0ICAgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgICByZXR1cm4gJ1tVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiAnICsgZXJyLm1lc3NhZ2U7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBmb3JtYXRBcmdzKGFyZ3MpIHtcblx0ICAgIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuXHQgICAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpICsgdGhpcy5uYW1lc3BhY2UgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpICsgYXJnc1swXSArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJykgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cblx0ICAgIGlmICghdXNlQ29sb3JzKSByZXR1cm47XG5cblx0ICAgIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcblx0ICAgIGFyZ3Muc3BsaWNlKDEsIDAsIGMsICdjb2xvcjogaW5oZXJpdCcpO1xuXG5cdCAgICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuXHQgICAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuXHQgICAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG5cdCAgICB2YXIgaW5kZXggPSAwO1xuXHQgICAgdmFyIGxhc3RDID0gMDtcblx0ICAgIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLCBmdW5jdGlvbiAobWF0Y2gpIHtcblx0ICAgICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG5cdCAgICAgIGluZGV4Kys7XG5cdCAgICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuXHQgICAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuXHQgICAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG5cdCAgICAgICAgbGFzdEMgPSBpbmRleDtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cblx0ICAgIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cblx0ICAgKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGxvZygpIHtcblx0ICAgIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG5cdCAgICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuXHQgICAgcmV0dXJuICdvYmplY3QnID09PSAodHlwZW9mIGNvbnNvbGUgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNvbnNvbGUpKSAmJiBjb25zb2xlLmxvZyAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBTYXZlIGBuYW1lc3BhY2VzYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcblx0ICAgICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuXHQgICAgICB9XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIExvYWQgYG5hbWVzcGFjZXNgLlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9hZCgpIHtcblx0ICAgIHZhciByO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1Zztcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICAgIC8vIElmIGRlYnVnIGlzbid0IHNldCBpbiBMUywgYW5kIHdlJ3JlIGluIEVsZWN0cm9uLCB0cnkgdG8gbG9hZCAkREVCVUdcblx0ICAgIGlmICghciAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgJ2VudicgaW4gcHJvY2Vzcykge1xuXHQgICAgICByID0gcHJvY2Vzcy5lbnYuREVCVUc7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiByO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG5cdCAgLyoqXG5cdCAgICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuXHQgICAqXG5cdCAgICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG5cdCAgICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2Vcblx0ICAgKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCkge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblx0fSk7XG5cdHZhciBicm93c2VyXzEgPSBicm93c2VyLmxvZztcblx0dmFyIGJyb3dzZXJfMiA9IGJyb3dzZXIuZm9ybWF0QXJncztcblx0dmFyIGJyb3dzZXJfMyA9IGJyb3dzZXIuc2F2ZTtcblx0dmFyIGJyb3dzZXJfNCA9IGJyb3dzZXIubG9hZDtcblx0dmFyIGJyb3dzZXJfNSA9IGJyb3dzZXIudXNlQ29sb3JzO1xuXHR2YXIgYnJvd3Nlcl82ID0gYnJvd3Nlci5zdG9yYWdlO1xuXHR2YXIgYnJvd3Nlcl83ID0gYnJvd3Nlci5jb2xvcnM7XG5cblx0dmFyIGJyb3dzZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBicm93c2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYnJvd3Nlcixcblx0XHRsb2c6IGJyb3dzZXJfMSxcblx0XHRmb3JtYXRBcmdzOiBicm93c2VyXzIsXG5cdFx0c2F2ZTogYnJvd3Nlcl8zLFxuXHRcdGxvYWQ6IGJyb3dzZXJfNCxcblx0XHR1c2VDb2xvcnM6IGJyb3dzZXJfNSxcblx0XHRzdG9yYWdlOiBicm93c2VyXzYsXG5cdFx0Y29sb3JzOiBicm93c2VyXzdcblx0fSk7XG5cblx0dmFyIHBhcnNldXJpJDIgPSAoIHBhcnNldXJpJDEgJiYgcGFyc2V1cmkgKSB8fCBwYXJzZXVyaSQxO1xuXG5cdHZhciByZXF1aXJlJCQwJDIgPSAoIGJyb3dzZXIkMSAmJiBicm93c2VyICkgfHwgYnJvd3NlciQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckMiA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudDp1cmwnKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB1cmxfMSA9IHVybDtcblxuXHQvKipcblx0ICogVVJMIHBhcnNlci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHVybFxuXHQgKiBAcGFyYW0ge09iamVjdH0gQW4gb2JqZWN0IG1lYW50IHRvIG1pbWljIHdpbmRvdy5sb2NhdGlvbi5cblx0ICogICAgICAgICAgICAgICAgIERlZmF1bHRzIHRvIHdpbmRvdy5sb2NhdGlvbi5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gdXJsKHVyaSwgbG9jKSB7XG5cdCAgdmFyIG9iaiA9IHVyaTtcblxuXHQgIC8vIGRlZmF1bHQgdG8gd2luZG93LmxvY2F0aW9uXG5cdCAgbG9jID0gbG9jIHx8IGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uO1xuXHQgIGlmIChudWxsID09IHVyaSkgdXJpID0gbG9jLnByb3RvY29sICsgJy8vJyArIGxvYy5ob3N0O1xuXG5cdCAgLy8gcmVsYXRpdmUgcGF0aCBzdXBwb3J0XG5cdCAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgdXJpKSB7XG5cdCAgICBpZiAoJy8nID09PSB1cmkuY2hhckF0KDApKSB7XG5cdCAgICAgIGlmICgnLycgPT09IHVyaS5jaGFyQXQoMSkpIHtcblx0ICAgICAgICB1cmkgPSBsb2MucHJvdG9jb2wgKyB1cmk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdXJpID0gbG9jLmhvc3QgKyB1cmk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgaWYgKCEvXihodHRwcz98d3NzPyk6XFwvXFwvLy50ZXN0KHVyaSkpIHtcblx0ICAgICAgZGVidWckMigncHJvdG9jb2wtbGVzcyB1cmwgJXMnLCB1cmkpO1xuXHQgICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBsb2MpIHtcblx0ICAgICAgICB1cmkgPSBsb2MucHJvdG9jb2wgKyAnLy8nICsgdXJpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHVyaSA9ICdodHRwczovLycgKyB1cmk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgLy8gcGFyc2Vcblx0ICAgIGRlYnVnJDIoJ3BhcnNlICVzJywgdXJpKTtcblx0ICAgIG9iaiA9IHBhcnNldXJpJDIodXJpKTtcblx0ICB9XG5cblx0ICAvLyBtYWtlIHN1cmUgd2UgdHJlYXQgYGxvY2FsaG9zdDo4MGAgYW5kIGBsb2NhbGhvc3RgIGVxdWFsbHlcblx0ICBpZiAoIW9iai5wb3J0KSB7XG5cdCAgICBpZiAoL14oaHR0cHx3cykkLy50ZXN0KG9iai5wcm90b2NvbCkpIHtcblx0ICAgICAgb2JqLnBvcnQgPSAnODAnO1xuXHQgICAgfSBlbHNlIGlmICgvXihodHRwfHdzKXMkLy50ZXN0KG9iai5wcm90b2NvbCkpIHtcblx0ICAgICAgb2JqLnBvcnQgPSAnNDQzJztcblx0ICAgIH1cblx0ICB9XG5cblx0ICBvYmoucGF0aCA9IG9iai5wYXRoIHx8ICcvJztcblxuXHQgIHZhciBpcHY2ID0gb2JqLmhvc3QuaW5kZXhPZignOicpICE9PSAtMTtcblx0ICB2YXIgaG9zdCA9IGlwdjYgPyAnWycgKyBvYmouaG9zdCArICddJyA6IG9iai5ob3N0O1xuXG5cdCAgLy8gZGVmaW5lIHVuaXF1ZSBpZFxuXHQgIG9iai5pZCA9IG9iai5wcm90b2NvbCArICc6Ly8nICsgaG9zdCArICc6JyArIG9iai5wb3J0O1xuXHQgIC8vIGRlZmluZSBocmVmXG5cdCAgb2JqLmhyZWYgPSBvYmoucHJvdG9jb2wgKyAnOi8vJyArIGhvc3QgKyAobG9jICYmIGxvYy5wb3J0ID09PSBvYmoucG9ydCA/ICcnIDogJzonICsgb2JqLnBvcnQpO1xuXG5cdCAgcmV0dXJuIG9iajtcblx0fVxuXG5cdHZhciB1cmwkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB1cmxfMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHVybF8xXG5cdH0pO1xuXG5cdHZhciBjb21wb25lbnRFbWl0dGVyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgIC8qKlxyXG5cdCAgICogRXhwb3NlIGBFbWl0dGVyYC5cclxuXHQgICAqL1xuXG5cdCAge1xuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyO1xuXHQgIH1cblxuXHQgIC8qKlxyXG5cdCAgICogSW5pdGlhbGl6ZSBhIG5ldyBgRW1pdHRlcmAuXHJcblx0ICAgKlxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcblx0ICAgIGlmIChvYmopIHJldHVybiBtaXhpbihvYmopO1xuXHQgIH1cblx0ICAvKipcclxuXHQgICAqIE1peGluIHRoZSBlbWl0dGVyIHByb3BlcnRpZXMuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG5cdCAgICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAgICogQGFwaSBwcml2YXRlXHJcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIG1peGluKG9iaikge1xuXHQgICAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XG5cdCAgICAgIG9ialtrZXldID0gRW1pdHRlci5wcm90b3R5cGVba2V5XTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBvYmo7XG5cdCAgfVxuXG5cdCAgLyoqXHJcblx0ICAgKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEVtaXR0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdCAgICAodGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW10pLnB1c2goZm4pO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXHJcblx0ICAgKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuXHQgICAgZnVuY3Rpb24gb24oKSB7XG5cdCAgICAgIHRoaXMub2ZmKGV2ZW50LCBvbik7XG5cdCAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdCAgICB9XG5cblx0ICAgIG9uLmZuID0gZm47XG5cdCAgICB0aGlzLm9uKGV2ZW50LCBvbik7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxyXG5cdCAgICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAgICogQHJldHVybiB7RW1pdHRlcn1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblxuXHQgICAgLy8gYWxsXG5cdCAgICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH1cblxuXHQgICAgLy8gc3BlY2lmaWMgZXZlbnRcblx0ICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXHQgICAgaWYgKCFjYWxsYmFja3MpIHJldHVybiB0aGlzO1xuXG5cdCAgICAvLyByZW1vdmUgYWxsIGhhbmRsZXJzXG5cdCAgICBpZiAoMSA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG5cdCAgICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH1cblxuXHQgICAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcblx0ICAgIHZhciBjYjtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGNiID0gY2FsbGJhY2tzW2ldO1xuXHQgICAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xuXHQgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaSwgMSk7XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIEVtaXQgYGV2ZW50YCB3aXRoIHRoZSBnaXZlbiBhcmdzLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtNaXhlZH0gLi4uXHJcblx0ICAgKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdCAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcblx0ICAgICAgICBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXG5cdCAgICBpZiAoY2FsbGJhY2tzKSB7XG5cdCAgICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcblx0ICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuXHQgICAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBSZXR1cm4gYXJyYXkgb2YgY2FsbGJhY2tzIGZvciBgZXZlbnRgLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHJldHVybiB7QXJyYXl9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0ICAgIHJldHVybiB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEByZXR1cm4ge0Jvb2xlYW59XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIHJldHVybiAhIXRoaXMubGlzdGVuZXJzKGV2ZW50KS5sZW5ndGg7XG5cdCAgfTtcblx0fSk7XG5cblx0dmFyIGNvbXBvbmVudEVtaXR0ZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBjb21wb25lbnRFbWl0dGVyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogY29tcG9uZW50RW1pdHRlclxuXHR9KTtcblxuXHR2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxuXHR2YXIgaXNhcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuXHQgIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcblx0fTtcblxuXHR2YXIgaXNhcnJheSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGlzYXJyYXksXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBpc2FycmF5XG5cdH0pO1xuXG5cdHZhciBpc0J1ZmZlciA9IGlzQnVmO1xuXG5cdHZhciB3aXRoTmF0aXZlQnVmZmVyID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgY29tbW9uanNHbG9iYWwuQnVmZmVyLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nO1xuXHR2YXIgd2l0aE5hdGl2ZUFycmF5QnVmZmVyID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyID09PSAnZnVuY3Rpb24nO1xuXG5cdHZhciBpc1ZpZXcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJiB0eXBlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIuaXNWaWV3ID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICByZXR1cm4gY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIuaXNWaWV3O1xuXHQgIH0gZWxzZSB7XG5cdCAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuXHQgICAgICByZXR1cm4gb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyO1xuXHQgICAgfTtcblx0ICB9XG5cdH0oKTtcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIG9iaiBpcyBhIGJ1ZmZlciBvciBhbiBhcnJheWJ1ZmZlci5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGlzQnVmKG9iaikge1xuXHQgIHJldHVybiB3aXRoTmF0aXZlQnVmZmVyICYmIGNvbW1vbmpzR2xvYmFsLkJ1ZmZlci5pc0J1ZmZlcihvYmopIHx8IHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJiAob2JqIGluc3RhbmNlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIgfHwgaXNWaWV3KG9iaikpO1xuXHR9XG5cblx0dmFyIGlzQnVmZmVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaXNCdWZmZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBpc0J1ZmZlclxuXHR9KTtcblxuXHR2YXIgaXNBcnJheSA9ICggaXNhcnJheSQxICYmIGlzYXJyYXkgKSB8fCBpc2FycmF5JDE7XG5cblx0dmFyIGlzQnVmJDEgPSAoIGlzQnVmZmVyJDEgJiYgaXNCdWZmZXIgKSB8fCBpc0J1ZmZlciQxO1xuXG5cdC8qZ2xvYmFsIEJsb2IsRmlsZSovXG5cblx0LyoqXG5cdCAqIE1vZHVsZSByZXF1aXJlbWVudHNcblx0ICovXG5cblx0dmFyIHRvU3RyaW5nJDEgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgd2l0aE5hdGl2ZUJsb2IgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuQmxvYiA9PT0gJ2Z1bmN0aW9uJyB8fCB0b1N0cmluZyQxLmNhbGwoY29tbW9uanNHbG9iYWwuQmxvYikgPT09ICdbb2JqZWN0IEJsb2JDb25zdHJ1Y3Rvcl0nO1xuXHR2YXIgd2l0aE5hdGl2ZUZpbGUgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuRmlsZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0b1N0cmluZyQxLmNhbGwoY29tbW9uanNHbG9iYWwuRmlsZSkgPT09ICdbb2JqZWN0IEZpbGVDb25zdHJ1Y3Rvcl0nO1xuXG5cdC8qKlxuXHQgKiBSZXBsYWNlcyBldmVyeSBCdWZmZXIgfCBBcnJheUJ1ZmZlciBpbiBwYWNrZXQgd2l0aCBhIG51bWJlcmVkIHBsYWNlaG9sZGVyLlxuXHQgKiBBbnl0aGluZyB3aXRoIGJsb2JzIG9yIGZpbGVzIHNob3VsZCBiZSBmZWQgdGhyb3VnaCByZW1vdmVCbG9icyBiZWZvcmUgY29taW5nXG5cdCAqIGhlcmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQgLSBzb2NrZXQuaW8gZXZlbnQgcGFja2V0XG5cdCAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBkZWNvbnN0cnVjdGVkIHBhY2tldCBhbmQgbGlzdCBvZiBidWZmZXJzXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBkZWNvbnN0cnVjdFBhY2tldCA9IGZ1bmN0aW9uIGRlY29uc3RydWN0UGFja2V0KHBhY2tldCkge1xuXHQgIHZhciBidWZmZXJzID0gW107XG5cdCAgdmFyIHBhY2tldERhdGEgPSBwYWNrZXQuZGF0YTtcblx0ICB2YXIgcGFjayA9IHBhY2tldDtcblx0ICBwYWNrLmRhdGEgPSBfZGVjb25zdHJ1Y3RQYWNrZXQocGFja2V0RGF0YSwgYnVmZmVycyk7XG5cdCAgcGFjay5hdHRhY2htZW50cyA9IGJ1ZmZlcnMubGVuZ3RoOyAvLyBudW1iZXIgb2YgYmluYXJ5ICdhdHRhY2htZW50cydcblx0ICByZXR1cm4geyBwYWNrZXQ6IHBhY2ssIGJ1ZmZlcnM6IGJ1ZmZlcnMgfTtcblx0fTtcblxuXHRmdW5jdGlvbiBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YSwgYnVmZmVycykge1xuXHQgIGlmICghZGF0YSkgcmV0dXJuIGRhdGE7XG5cblx0ICBpZiAoaXNCdWYkMShkYXRhKSkge1xuXHQgICAgdmFyIHBsYWNlaG9sZGVyID0geyBfcGxhY2Vob2xkZXI6IHRydWUsIG51bTogYnVmZmVycy5sZW5ndGggfTtcblx0ICAgIGJ1ZmZlcnMucHVzaChkYXRhKTtcblx0ICAgIHJldHVybiBwbGFjZWhvbGRlcjtcblx0ICB9IGVsc2UgaWYgKGlzQXJyYXkoZGF0YSkpIHtcblx0ICAgIHZhciBuZXdEYXRhID0gbmV3IEFycmF5KGRhdGEubGVuZ3RoKTtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHQgICAgICBuZXdEYXRhW2ldID0gX2RlY29uc3RydWN0UGFja2V0KGRhdGFbaV0sIGJ1ZmZlcnMpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG5ld0RhdGE7XG5cdCAgfSBlbHNlIGlmICgodHlwZW9mIGRhdGEgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGRhdGEpKSA9PT0gJ29iamVjdCcgJiYgIShkYXRhIGluc3RhbmNlb2YgRGF0ZSkpIHtcblx0ICAgIHZhciBuZXdEYXRhID0ge307XG5cdCAgICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuXHQgICAgICBuZXdEYXRhW2tleV0gPSBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtrZXldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBuZXdEYXRhO1xuXHQgIH1cblx0ICByZXR1cm4gZGF0YTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWNvbnN0cnVjdHMgYSBiaW5hcnkgcGFja2V0IGZyb20gaXRzIHBsYWNlaG9sZGVyIHBhY2tldCBhbmQgYnVmZmVyc1xuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0IC0gZXZlbnQgcGFja2V0IHdpdGggcGxhY2Vob2xkZXJzXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGJ1ZmZlcnMgLSBiaW5hcnkgYnVmZmVycyB0byBwdXQgaW4gcGxhY2Vob2xkZXIgcG9zaXRpb25zXG5cdCAqIEByZXR1cm4ge09iamVjdH0gcmVjb25zdHJ1Y3RlZCBwYWNrZXRcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIHJlY29uc3RydWN0UGFja2V0ID0gZnVuY3Rpb24gcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LCBidWZmZXJzKSB7XG5cdCAgcGFja2V0LmRhdGEgPSBfcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LmRhdGEsIGJ1ZmZlcnMpO1xuXHQgIHBhY2tldC5hdHRhY2htZW50cyA9IHVuZGVmaW5lZDsgLy8gbm8gbG9uZ2VyIHVzZWZ1bFxuXHQgIHJldHVybiBwYWNrZXQ7XG5cdH07XG5cblx0ZnVuY3Rpb24gX3JlY29uc3RydWN0UGFja2V0KGRhdGEsIGJ1ZmZlcnMpIHtcblx0ICBpZiAoIWRhdGEpIHJldHVybiBkYXRhO1xuXG5cdCAgaWYgKGRhdGEgJiYgZGF0YS5fcGxhY2Vob2xkZXIpIHtcblx0ICAgIHJldHVybiBidWZmZXJzW2RhdGEubnVtXTsgLy8gYXBwcm9wcmlhdGUgYnVmZmVyIChzaG91bGQgYmUgbmF0dXJhbCBvcmRlciBhbnl3YXkpXG5cdCAgfSBlbHNlIGlmIChpc0FycmF5KGRhdGEpKSB7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgZGF0YVtpXSA9IF9yZWNvbnN0cnVjdFBhY2tldChkYXRhW2ldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICB9IGVsc2UgaWYgKCh0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoZGF0YSkpID09PSAnb2JqZWN0Jykge1xuXHQgICAgZm9yICh2YXIga2V5IGluIGRhdGEpIHtcblx0ICAgICAgZGF0YVtrZXldID0gX3JlY29uc3RydWN0UGFja2V0KGRhdGFba2V5XSwgYnVmZmVycyk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGRhdGE7XG5cdH1cblxuXHQvKipcblx0ICogQXN5bmNocm9ub3VzbHkgcmVtb3ZlcyBCbG9icyBvciBGaWxlcyBmcm9tIGRhdGEgdmlhXG5cdCAqIEZpbGVSZWFkZXIncyByZWFkQXNBcnJheUJ1ZmZlciBtZXRob2QuIFVzZWQgYmVmb3JlIGVuY29kaW5nXG5cdCAqIGRhdGEgYXMgbXNncGFjay4gQ2FsbHMgY2FsbGJhY2sgd2l0aCB0aGUgYmxvYmxlc3MgZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdHZhciByZW1vdmVCbG9icyA9IGZ1bmN0aW9uIHJlbW92ZUJsb2JzKGRhdGEsIGNhbGxiYWNrKSB7XG5cdCAgZnVuY3Rpb24gX3JlbW92ZUJsb2JzKG9iaiwgY3VyS2V5LCBjb250YWluaW5nT2JqZWN0KSB7XG5cdCAgICBpZiAoIW9iaikgcmV0dXJuIG9iajtcblxuXHQgICAgLy8gY29udmVydCBhbnkgYmxvYlxuXHQgICAgaWYgKHdpdGhOYXRpdmVCbG9iICYmIG9iaiBpbnN0YW5jZW9mIEJsb2IgfHwgd2l0aE5hdGl2ZUZpbGUgJiYgb2JqIGluc3RhbmNlb2YgRmlsZSkge1xuXHQgICAgICBwZW5kaW5nQmxvYnMrKztcblxuXHQgICAgICAvLyBhc3luYyBmaWxlcmVhZGVyXG5cdCAgICAgIHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgICAgZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgLy8gdGhpcy5yZXN1bHQgPT0gYXJyYXlidWZmZXJcblx0ICAgICAgICBpZiAoY29udGFpbmluZ09iamVjdCkge1xuXHQgICAgICAgICAgY29udGFpbmluZ09iamVjdFtjdXJLZXldID0gdGhpcy5yZXN1bHQ7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGJsb2JsZXNzRGF0YSA9IHRoaXMucmVzdWx0O1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIC8vIGlmIG5vdGhpbmcgcGVuZGluZyBpdHMgY2FsbGJhY2sgdGltZVxuXHQgICAgICAgIGlmICghIC0tcGVuZGluZ0Jsb2JzKSB7XG5cdCAgICAgICAgICBjYWxsYmFjayhibG9ibGVzc0RhdGEpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblxuXHQgICAgICBmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKG9iaik7IC8vIGJsb2IgLT4gYXJyYXlidWZmZXJcblx0ICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmopKSB7XG5cdCAgICAgIC8vIGhhbmRsZSBhcnJheVxuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIF9yZW1vdmVCbG9icyhvYmpbaV0sIGksIG9iaik7XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKG9iaikpID09PSAnb2JqZWN0JyAmJiAhaXNCdWYkMShvYmopKSB7XG5cdCAgICAgIC8vIGFuZCBvYmplY3Rcblx0ICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuXHQgICAgICAgIF9yZW1vdmVCbG9icyhvYmpba2V5XSwga2V5LCBvYmopO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgdmFyIHBlbmRpbmdCbG9icyA9IDA7XG5cdCAgdmFyIGJsb2JsZXNzRGF0YSA9IGRhdGE7XG5cdCAgX3JlbW92ZUJsb2JzKGJsb2JsZXNzRGF0YSk7XG5cdCAgaWYgKCFwZW5kaW5nQmxvYnMpIHtcblx0ICAgIGNhbGxiYWNrKGJsb2JsZXNzRGF0YSk7XG5cdCAgfVxuXHR9O1xuXG5cdHZhciBiaW5hcnkgPSB7XG5cdCAgZGVjb25zdHJ1Y3RQYWNrZXQ6IGRlY29uc3RydWN0UGFja2V0LFxuXHQgIHJlY29uc3RydWN0UGFja2V0OiByZWNvbnN0cnVjdFBhY2tldCxcblx0ICByZW1vdmVCbG9iczogcmVtb3ZlQmxvYnNcblx0fTtcblxuXHR2YXIgYmluYXJ5JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmluYXJ5LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmluYXJ5LFxuXHRcdGRlY29uc3RydWN0UGFja2V0OiBkZWNvbnN0cnVjdFBhY2tldCxcblx0XHRyZWNvbnN0cnVjdFBhY2tldDogcmVjb25zdHJ1Y3RQYWNrZXQsXG5cdFx0cmVtb3ZlQmxvYnM6IHJlbW92ZUJsb2JzXG5cdH0pO1xuXG5cdHZhciBFbWl0dGVyID0gKCBjb21wb25lbnRFbWl0dGVyJDEgJiYgY29tcG9uZW50RW1pdHRlciApIHx8IGNvbXBvbmVudEVtaXR0ZXIkMTtcblxuXHR2YXIgYmluYXJ5JDIgPSAoIGJpbmFyeSQxICYmIGJpbmFyeSApIHx8IGJpbmFyeSQxO1xuXG5cdHZhciBzb2NrZXRfaW9QYXJzZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBkZWJ1ZyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLXBhcnNlcicpO1xuXG5cdCAgLyoqXG5cdCAgICogUHJvdG9jb2wgdmVyc2lvbi5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnByb3RvY29sID0gNDtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnR5cGVzID0gWydDT05ORUNUJywgJ0RJU0NPTk5FQ1QnLCAnRVZFTlQnLCAnQUNLJywgJ0VSUk9SJywgJ0JJTkFSWV9FVkVOVCcsICdCSU5BUllfQUNLJ107XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgY29ubmVjdGAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5DT05ORUNUID0gMDtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBkaXNjb25uZWN0YC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkRJU0NPTk5FQ1QgPSAxO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGV2ZW50YC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkVWRU5UID0gMjtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBhY2tgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQUNLID0gMztcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBlcnJvcmAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5FUlJPUiA9IDQ7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSAnYmluYXJ5IGV2ZW50J1xuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQklOQVJZX0VWRU5UID0gNTtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBiaW5hcnkgYWNrYC4gRm9yIGFja3Mgd2l0aCBiaW5hcnkgYXJndW1lbnRzLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQklOQVJZX0FDSyA9IDY7XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVyIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRW5jb2RlciA9IEVuY29kZXI7XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVyIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRGVjb2RlciA9IERlY29kZXI7XG5cblx0ICAvKipcblx0ICAgKiBBIHNvY2tldC5pbyBFbmNvZGVyIGluc3RhbmNlXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gRW5jb2RlcigpIHt9XG5cblx0ICB2YXIgRVJST1JfUEFDS0VUID0gZXhwb3J0cy5FUlJPUiArICdcImVuY29kZSBlcnJvclwiJztcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBhIHBhY2tldCBhcyBhIHNpbmdsZSBzdHJpbmcgaWYgbm9uLWJpbmFyeSwgb3IgYXMgYVxuXHQgICAqIGJ1ZmZlciBzZXF1ZW5jZSwgZGVwZW5kaW5nIG9uIHBhY2tldCB0eXBlLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIHBhY2tldCBvYmplY3Rcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIGZ1bmN0aW9uIHRvIGhhbmRsZSBlbmNvZGluZ3MgKGxpa2VseSBlbmdpbmUud3JpdGUpXG5cdCAgICogQHJldHVybiBDYWxscyBjYWxsYmFjayB3aXRoIEFycmF5IG9mIGVuY29kaW5nc1xuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBFbmNvZGVyLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuXHQgICAgZGVidWcoJ2VuY29kaW5nIHBhY2tldCAlaicsIG9iaik7XG5cblx0ICAgIGlmIChleHBvcnRzLkJJTkFSWV9FVkVOVCA9PT0gb2JqLnR5cGUgfHwgZXhwb3J0cy5CSU5BUllfQUNLID09PSBvYmoudHlwZSkge1xuXHQgICAgICBlbmNvZGVBc0JpbmFyeShvYmosIGNhbGxiYWNrKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHZhciBlbmNvZGluZyA9IGVuY29kZUFzU3RyaW5nKG9iaik7XG5cdCAgICAgIGNhbGxiYWNrKFtlbmNvZGluZ10pO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgcGFja2V0IGFzIHN0cmluZy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUFzU3RyaW5nKG9iaikge1xuXG5cdCAgICAvLyBmaXJzdCBpcyB0eXBlXG5cdCAgICB2YXIgc3RyID0gJycgKyBvYmoudHlwZTtcblxuXHQgICAgLy8gYXR0YWNobWVudHMgaWYgd2UgaGF2ZSB0aGVtXG5cdCAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IG9iai50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gb2JqLnR5cGUpIHtcblx0ICAgICAgc3RyICs9IG9iai5hdHRhY2htZW50cyArICctJztcblx0ICAgIH1cblxuXHQgICAgLy8gaWYgd2UgaGF2ZSBhIG5hbWVzcGFjZSBvdGhlciB0aGFuIGAvYFxuXHQgICAgLy8gd2UgYXBwZW5kIGl0IGZvbGxvd2VkIGJ5IGEgY29tbWEgYCxgXG5cdCAgICBpZiAob2JqLm5zcCAmJiAnLycgIT09IG9iai5uc3ApIHtcblx0ICAgICAgc3RyICs9IG9iai5uc3AgKyAnLCc7XG5cdCAgICB9XG5cblx0ICAgIC8vIGltbWVkaWF0ZWx5IGZvbGxvd2VkIGJ5IHRoZSBpZFxuXHQgICAgaWYgKG51bGwgIT0gb2JqLmlkKSB7XG5cdCAgICAgIHN0ciArPSBvYmouaWQ7XG5cdCAgICB9XG5cblx0ICAgIC8vIGpzb24gZGF0YVxuXHQgICAgaWYgKG51bGwgIT0gb2JqLmRhdGEpIHtcblx0ICAgICAgdmFyIHBheWxvYWQgPSB0cnlTdHJpbmdpZnkob2JqLmRhdGEpO1xuXHQgICAgICBpZiAocGF5bG9hZCAhPT0gZmFsc2UpIHtcblx0ICAgICAgICBzdHIgKz0gcGF5bG9hZDtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gRVJST1JfUEFDS0VUO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGRlYnVnKCdlbmNvZGVkICVqIGFzICVzJywgb2JqLCBzdHIpO1xuXHQgICAgcmV0dXJuIHN0cjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0cnlTdHJpbmdpZnkoc3RyKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBwYWNrZXQgYXMgJ2J1ZmZlciBzZXF1ZW5jZScgYnkgcmVtb3ZpbmcgYmxvYnMsIGFuZFxuXHQgICAqIGRlY29uc3RydWN0aW5nIHBhY2tldCBpbnRvIG9iamVjdCB3aXRoIHBsYWNlaG9sZGVycyBhbmRcblx0ICAgKiBhIGxpc3Qgb2YgYnVmZmVycy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtCdWZmZXJ9IGVuY29kZWRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUFzQmluYXJ5KG9iaiwgY2FsbGJhY2spIHtcblxuXHQgICAgZnVuY3Rpb24gd3JpdGVFbmNvZGluZyhibG9ibGVzc0RhdGEpIHtcblx0ICAgICAgdmFyIGRlY29uc3RydWN0aW9uID0gYmluYXJ5JDIuZGVjb25zdHJ1Y3RQYWNrZXQoYmxvYmxlc3NEYXRhKTtcblx0ICAgICAgdmFyIHBhY2sgPSBlbmNvZGVBc1N0cmluZyhkZWNvbnN0cnVjdGlvbi5wYWNrZXQpO1xuXHQgICAgICB2YXIgYnVmZmVycyA9IGRlY29uc3RydWN0aW9uLmJ1ZmZlcnM7XG5cblx0ICAgICAgYnVmZmVycy51bnNoaWZ0KHBhY2spOyAvLyBhZGQgcGFja2V0IGluZm8gdG8gYmVnaW5uaW5nIG9mIGRhdGEgbGlzdFxuXHQgICAgICBjYWxsYmFjayhidWZmZXJzKTsgLy8gd3JpdGUgYWxsIHRoZSBidWZmZXJzXG5cdCAgICB9XG5cblx0ICAgIGJpbmFyeSQyLnJlbW92ZUJsb2JzKG9iaiwgd3JpdGVFbmNvZGluZyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQSBzb2NrZXQuaW8gRGVjb2RlciBpbnN0YW5jZVxuXHQgICAqXG5cdCAgICogQHJldHVybiB7T2JqZWN0fSBkZWNvZGVyXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIERlY29kZXIoKSB7XG5cdCAgICB0aGlzLnJlY29uc3RydWN0b3IgPSBudWxsO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1peCBpbiBgRW1pdHRlcmAgd2l0aCBEZWNvZGVyLlxuXHQgICAqL1xuXG5cdCAgRW1pdHRlcihEZWNvZGVyLnByb3RvdHlwZSk7XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVzIGFuIGVjb2RlZCBwYWNrZXQgc3RyaW5nIGludG8gcGFja2V0IEpTT04uXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gb2JqIC0gZW5jb2RlZCBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBEZWNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICB2YXIgcGFja2V0O1xuXHQgICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIHBhY2tldCA9IGRlY29kZVN0cmluZyhvYmopO1xuXHQgICAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IHBhY2tldC50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gcGFja2V0LnR5cGUpIHtcblx0ICAgICAgICAvLyBiaW5hcnkgcGFja2V0J3MganNvblxuXHQgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG5ldyBCaW5hcnlSZWNvbnN0cnVjdG9yKHBhY2tldCk7XG5cblx0ICAgICAgICAvLyBubyBhdHRhY2htZW50cywgbGFiZWxlZCBiaW5hcnkgYnV0IG5vIGJpbmFyeSBkYXRhIHRvIGZvbGxvd1xuXHQgICAgICAgIGlmICh0aGlzLnJlY29uc3RydWN0b3IucmVjb25QYWNrLmF0dGFjaG1lbnRzID09PSAwKSB7XG5cdCAgICAgICAgICB0aGlzLmVtaXQoJ2RlY29kZWQnLCBwYWNrZXQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAvLyBub24tYmluYXJ5IGZ1bGwgcGFja2V0XG5cdCAgICAgICAgdGhpcy5lbWl0KCdkZWNvZGVkJywgcGFja2V0KTtcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIGlmIChpc0J1ZiQxKG9iaikgfHwgb2JqLmJhc2U2NCkge1xuXHQgICAgICAvLyByYXcgYmluYXJ5IGRhdGFcblx0ICAgICAgaWYgKCF0aGlzLnJlY29uc3RydWN0b3IpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dvdCBiaW5hcnkgZGF0YSB3aGVuIG5vdCByZWNvbnN0cnVjdGluZyBhIHBhY2tldCcpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHBhY2tldCA9IHRoaXMucmVjb25zdHJ1Y3Rvci50YWtlQmluYXJ5RGF0YShvYmopO1xuXHQgICAgICAgIGlmIChwYWNrZXQpIHtcblx0ICAgICAgICAgIC8vIHJlY2VpdmVkIGZpbmFsIGJ1ZmZlclxuXHQgICAgICAgICAgdGhpcy5yZWNvbnN0cnVjdG9yID0gbnVsbDtcblx0ICAgICAgICAgIHRoaXMuZW1pdCgnZGVjb2RlZCcsIHBhY2tldCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gdHlwZTogJyArIG9iaik7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIERlY29kZSBhIHBhY2tldCBTdHJpbmcgKEpTT04gZGF0YSlcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZGVjb2RlU3RyaW5nKHN0cikge1xuXHQgICAgdmFyIGkgPSAwO1xuXHQgICAgLy8gbG9vayB1cCB0eXBlXG5cdCAgICB2YXIgcCA9IHtcblx0ICAgICAgdHlwZTogTnVtYmVyKHN0ci5jaGFyQXQoMCkpXG5cdCAgICB9O1xuXG5cdCAgICBpZiAobnVsbCA9PSBleHBvcnRzLnR5cGVzW3AudHlwZV0pIHtcblx0ICAgICAgcmV0dXJuIGVycm9yKCd1bmtub3duIHBhY2tldCB0eXBlICcgKyBwLnR5cGUpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIGF0dGFjaG1lbnRzIGlmIHR5cGUgYmluYXJ5XG5cdCAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IHAudHlwZSB8fCBleHBvcnRzLkJJTkFSWV9BQ0sgPT09IHAudHlwZSkge1xuXHQgICAgICB2YXIgYnVmID0gJyc7XG5cdCAgICAgIHdoaWxlIChzdHIuY2hhckF0KCsraSkgIT09ICctJykge1xuXHQgICAgICAgIGJ1ZiArPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmIChpID09IHN0ci5sZW5ndGgpIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICAgIGlmIChidWYgIT0gTnVtYmVyKGJ1ZikgfHwgc3RyLmNoYXJBdChpKSAhPT0gJy0nKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGF0dGFjaG1lbnRzJyk7XG5cdCAgICAgIH1cblx0ICAgICAgcC5hdHRhY2htZW50cyA9IE51bWJlcihidWYpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIG5hbWVzcGFjZSAoaWYgYW55KVxuXHQgICAgaWYgKCcvJyA9PT0gc3RyLmNoYXJBdChpICsgMSkpIHtcblx0ICAgICAgcC5uc3AgPSAnJztcblx0ICAgICAgd2hpbGUgKCsraSkge1xuXHQgICAgICAgIHZhciBjID0gc3RyLmNoYXJBdChpKTtcblx0ICAgICAgICBpZiAoJywnID09PSBjKSBicmVhaztcblx0ICAgICAgICBwLm5zcCArPSBjO1xuXHQgICAgICAgIGlmIChpID09PSBzdHIubGVuZ3RoKSBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgcC5uc3AgPSAnLyc7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAgaWRcblx0ICAgIHZhciBuZXh0ID0gc3RyLmNoYXJBdChpICsgMSk7XG5cdCAgICBpZiAoJycgIT09IG5leHQgJiYgTnVtYmVyKG5leHQpID09IG5leHQpIHtcblx0ICAgICAgcC5pZCA9ICcnO1xuXHQgICAgICB3aGlsZSAoKytpKSB7XG5cdCAgICAgICAgdmFyIGMgPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmIChudWxsID09IGMgfHwgTnVtYmVyKGMpICE9IGMpIHtcblx0ICAgICAgICAgIC0taTtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgIH1cblx0ICAgICAgICBwLmlkICs9IHN0ci5jaGFyQXQoaSk7XG5cdCAgICAgICAgaWYgKGkgPT09IHN0ci5sZW5ndGgpIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICAgIHAuaWQgPSBOdW1iZXIocC5pZCk7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAganNvbiBkYXRhXG5cdCAgICBpZiAoc3RyLmNoYXJBdCgrK2kpKSB7XG5cdCAgICAgIHZhciBwYXlsb2FkID0gdHJ5UGFyc2Uoc3RyLnN1YnN0cihpKSk7XG5cdCAgICAgIHZhciBpc1BheWxvYWRWYWxpZCA9IHBheWxvYWQgIT09IGZhbHNlICYmIChwLnR5cGUgPT09IGV4cG9ydHMuRVJST1IgfHwgaXNBcnJheShwYXlsb2FkKSk7XG5cdCAgICAgIGlmIChpc1BheWxvYWRWYWxpZCkge1xuXHQgICAgICAgIHAuZGF0YSA9IHBheWxvYWQ7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIGVycm9yKCdpbnZhbGlkIHBheWxvYWQnKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBkZWJ1ZygnZGVjb2RlZCAlcyBhcyAlaicsIHN0ciwgcCk7XG5cdCAgICByZXR1cm4gcDtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0cnlQYXJzZShzdHIpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBKU09OLnBhcnNlKHN0cik7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEZWFsbG9jYXRlcyBhIHBhcnNlcidzIHJlc291cmNlc1xuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIERlY29kZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5yZWNvbnN0cnVjdG9yKSB7XG5cdCAgICAgIHRoaXMucmVjb25zdHJ1Y3Rvci5maW5pc2hlZFJlY29uc3RydWN0aW9uKCk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEEgbWFuYWdlciBvZiBhIGJpbmFyeSBldmVudCdzICdidWZmZXIgc2VxdWVuY2UnLiBTaG91bGRcblx0ICAgKiBiZSBjb25zdHJ1Y3RlZCB3aGVuZXZlciBhIHBhY2tldCBvZiB0eXBlIEJJTkFSWV9FVkVOVCBpc1xuXHQgICAqIGRlY29kZWQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQHJldHVybiB7QmluYXJ5UmVjb25zdHJ1Y3Rvcn0gaW5pdGlhbGl6ZWQgcmVjb25zdHJ1Y3RvclxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gQmluYXJ5UmVjb25zdHJ1Y3RvcihwYWNrZXQpIHtcblx0ICAgIHRoaXMucmVjb25QYWNrID0gcGFja2V0O1xuXHQgICAgdGhpcy5idWZmZXJzID0gW107XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWV0aG9kIHRvIGJlIGNhbGxlZCB3aGVuIGJpbmFyeSBkYXRhIHJlY2VpdmVkIGZyb20gY29ubmVjdGlvblxuXHQgICAqIGFmdGVyIGEgQklOQVJZX0VWRU5UIHBhY2tldC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QnVmZmVyIHwgQXJyYXlCdWZmZXJ9IGJpbkRhdGEgLSB0aGUgcmF3IGJpbmFyeSBkYXRhIHJlY2VpdmVkXG5cdCAgICogQHJldHVybiB7bnVsbCB8IE9iamVjdH0gcmV0dXJucyBudWxsIGlmIG1vcmUgYmluYXJ5IGRhdGEgaXMgZXhwZWN0ZWQgb3Jcblx0ICAgKiAgIGEgcmVjb25zdHJ1Y3RlZCBwYWNrZXQgb2JqZWN0IGlmIGFsbCBidWZmZXJzIGhhdmUgYmVlbiByZWNlaXZlZC5cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIEJpbmFyeVJlY29uc3RydWN0b3IucHJvdG90eXBlLnRha2VCaW5hcnlEYXRhID0gZnVuY3Rpb24gKGJpbkRhdGEpIHtcblx0ICAgIHRoaXMuYnVmZmVycy5wdXNoKGJpbkRhdGEpO1xuXHQgICAgaWYgKHRoaXMuYnVmZmVycy5sZW5ndGggPT09IHRoaXMucmVjb25QYWNrLmF0dGFjaG1lbnRzKSB7XG5cdCAgICAgIC8vIGRvbmUgd2l0aCBidWZmZXIgbGlzdFxuXHQgICAgICB2YXIgcGFja2V0ID0gYmluYXJ5JDIucmVjb25zdHJ1Y3RQYWNrZXQodGhpcy5yZWNvblBhY2ssIHRoaXMuYnVmZmVycyk7XG5cdCAgICAgIHRoaXMuZmluaXNoZWRSZWNvbnN0cnVjdGlvbigpO1xuXHQgICAgICByZXR1cm4gcGFja2V0O1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG51bGw7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENsZWFucyB1cCBiaW5hcnkgcGFja2V0IHJlY29uc3RydWN0aW9uIHZhcmlhYmxlcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgQmluYXJ5UmVjb25zdHJ1Y3Rvci5wcm90b3R5cGUuZmluaXNoZWRSZWNvbnN0cnVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHRoaXMucmVjb25QYWNrID0gbnVsbDtcblx0ICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiBlcnJvcihtc2cpIHtcblx0ICAgIHJldHVybiB7XG5cdCAgICAgIHR5cGU6IGV4cG9ydHMuRVJST1IsXG5cdCAgICAgIGRhdGE6ICdwYXJzZXIgZXJyb3I6ICcgKyBtc2dcblx0ICAgIH07XG5cdCAgfVxuXHR9KTtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8xID0gc29ja2V0X2lvUGFyc2VyLnByb3RvY29sO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzIgPSBzb2NrZXRfaW9QYXJzZXIudHlwZXM7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMyA9IHNvY2tldF9pb1BhcnNlci5DT05ORUNUO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzQgPSBzb2NrZXRfaW9QYXJzZXIuRElTQ09OTkVDVDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl81ID0gc29ja2V0X2lvUGFyc2VyLkVWRU5UO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzYgPSBzb2NrZXRfaW9QYXJzZXIuQUNLO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzcgPSBzb2NrZXRfaW9QYXJzZXIuRVJST1I7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfOCA9IHNvY2tldF9pb1BhcnNlci5CSU5BUllfRVZFTlQ7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfOSA9IHNvY2tldF9pb1BhcnNlci5CSU5BUllfQUNLO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzEwID0gc29ja2V0X2lvUGFyc2VyLkVuY29kZXI7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMTEgPSBzb2NrZXRfaW9QYXJzZXIuRGVjb2RlcjtcblxuXHR2YXIgc29ja2V0X2lvUGFyc2VyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogc29ja2V0X2lvUGFyc2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogc29ja2V0X2lvUGFyc2VyLFxuXHRcdHByb3RvY29sOiBzb2NrZXRfaW9QYXJzZXJfMSxcblx0XHR0eXBlczogc29ja2V0X2lvUGFyc2VyXzIsXG5cdFx0Q09OTkVDVDogc29ja2V0X2lvUGFyc2VyXzMsXG5cdFx0RElTQ09OTkVDVDogc29ja2V0X2lvUGFyc2VyXzQsXG5cdFx0RVZFTlQ6IHNvY2tldF9pb1BhcnNlcl81LFxuXHRcdEFDSzogc29ja2V0X2lvUGFyc2VyXzYsXG5cdFx0RVJST1I6IHNvY2tldF9pb1BhcnNlcl83LFxuXHRcdEJJTkFSWV9FVkVOVDogc29ja2V0X2lvUGFyc2VyXzgsXG5cdFx0QklOQVJZX0FDSzogc29ja2V0X2lvUGFyc2VyXzksXG5cdFx0RW5jb2Rlcjogc29ja2V0X2lvUGFyc2VyXzEwLFxuXHRcdERlY29kZXI6IHNvY2tldF9pb1BhcnNlcl8xMVxuXHR9KTtcblxuXHR2YXIgaGFzQ29ycyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICAgKlxuXHQgICAqIExvZ2ljIGJvcnJvd2VkIGZyb20gTW9kZXJuaXpyOlxuXHQgICAqXG5cdCAgICogICAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb2Rlcm5penIvTW9kZXJuaXpyL2Jsb2IvbWFzdGVyL2ZlYXR1cmUtZGV0ZWN0cy9jb3JzLmpzXG5cdCAgICovXG5cblx0ICB0cnkge1xuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnICYmICd3aXRoQ3JlZGVudGlhbHMnIGluIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHQgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgLy8gaWYgWE1MSHR0cCBzdXBwb3J0IGlzIGRpc2FibGVkIGluIElFIHRoZW4gaXQgd2lsbCB0aHJvd1xuXHQgICAgLy8gd2hlbiB0cnlpbmcgdG8gY3JlYXRlXG5cdCAgICBtb2R1bGUuZXhwb3J0cyA9IGZhbHNlO1xuXHQgIH1cblx0fSk7XG5cblx0dmFyIGhhc0NvcnMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBoYXNDb3JzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaGFzQ29yc1xuXHR9KTtcblxuXHR2YXIgaGFzQ09SUyA9ICggaGFzQ29ycyQxICYmIGhhc0NvcnMgKSB8fCBoYXNDb3JzJDE7XG5cblx0Ly8gYnJvd3NlciBzaGltIGZvciB4bWxodHRwcmVxdWVzdCBtb2R1bGVcblxuXG5cdHZhciB4bWxodHRwcmVxdWVzdCA9IGZ1bmN0aW9uIHhtbGh0dHByZXF1ZXN0KG9wdHMpIHtcblx0ICB2YXIgeGRvbWFpbiA9IG9wdHMueGRvbWFpbjtcblxuXHQgIC8vIHNjaGVtZSBtdXN0IGJlIHNhbWUgd2hlbiB1c2lnbiBYRG9tYWluUmVxdWVzdFxuXHQgIC8vIGh0dHA6Ly9ibG9ncy5tc2RuLmNvbS9iL2llaW50ZXJuYWxzL2FyY2hpdmUvMjAxMC8wNS8xMy94ZG9tYWlucmVxdWVzdC1yZXN0cmljdGlvbnMtbGltaXRhdGlvbnMtYW5kLXdvcmthcm91bmRzLmFzcHhcblx0ICB2YXIgeHNjaGVtZSA9IG9wdHMueHNjaGVtZTtcblxuXHQgIC8vIFhEb21haW5SZXF1ZXN0IGhhcyBhIGZsb3cgb2Ygbm90IHNlbmRpbmcgY29va2llLCB0aGVyZWZvcmUgaXQgc2hvdWxkIGJlIGRpc2FibGVkIGFzIGEgZGVmYXVsdC5cblx0ICAvLyBodHRwczovL2dpdGh1Yi5jb20vQXV0b21hdHRpYy9lbmdpbmUuaW8tY2xpZW50L3B1bGwvMjE3XG5cdCAgdmFyIGVuYWJsZXNYRFIgPSBvcHRzLmVuYWJsZXNYRFI7XG5cblx0ICAvLyBYTUxIdHRwUmVxdWVzdCBjYW4gYmUgZGlzYWJsZWQgb24gSUVcblx0ICB0cnkge1xuXHQgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgJiYgKCF4ZG9tYWluIHx8IGhhc0NPUlMpKSB7XG5cdCAgICAgIHJldHVybiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0ICAgIH1cblx0ICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgLy8gVXNlIFhEb21haW5SZXF1ZXN0IGZvciBJRTggaWYgZW5hYmxlc1hEUiBpcyB0cnVlXG5cdCAgLy8gYmVjYXVzZSBsb2FkaW5nIGJhciBrZWVwcyBmbGFzaGluZyB3aGVuIHVzaW5nIGpzb25wLXBvbGxpbmdcblx0ICAvLyBodHRwczovL2dpdGh1Yi5jb20veXVqaW9zYWthL3NvY2tlLmlvLWllOC1sb2FkaW5nLWV4YW1wbGVcblx0ICB0cnkge1xuXHQgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgWERvbWFpblJlcXVlc3QgJiYgIXhzY2hlbWUgJiYgZW5hYmxlc1hEUikge1xuXHQgICAgICByZXR1cm4gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG5cdCAgICB9XG5cdCAgfSBjYXRjaCAoZSkge31cblxuXHQgIGlmICgheGRvbWFpbikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIG5ldyBjb21tb25qc0dsb2JhbFtbJ0FjdGl2ZSddLmNvbmNhdCgnT2JqZWN0Jykuam9pbignWCcpXSgnTWljcm9zb2Z0LlhNTEhUVFAnKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgfVxuXHR9O1xuXG5cdHZhciB4bWxodHRwcmVxdWVzdCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHhtbGh0dHByZXF1ZXN0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogeG1saHR0cHJlcXVlc3Rcblx0fSk7XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGtleXMgZm9yIGFuIG9iamVjdC5cblx0ICpcblx0ICogQHJldHVybiB7QXJyYXl9IGtleXNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdHZhciBrZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ga2V5cyhvYmopIHtcblx0ICB2YXIgYXJyID0gW107XG5cdCAgdmFyIGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cblx0ICBmb3IgKHZhciBpIGluIG9iaikge1xuXHQgICAgaWYgKGhhcy5jYWxsKG9iaiwgaSkpIHtcblx0ICAgICAgYXJyLnB1c2goaSk7XG5cdCAgICB9XG5cdCAgfVxuXHQgIHJldHVybiBhcnI7XG5cdH07XG5cblx0dmFyIGtleXMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBrZXlzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czoga2V5c1xuXHR9KTtcblxuXHQvKiBnbG9iYWwgQmxvYiBGaWxlICovXG5cblx0Lypcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50cy5cblx0ICovXG5cblx0dmFyIHRvU3RyaW5nJDIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgd2l0aE5hdGl2ZUJsb2IkMSA9IHR5cGVvZiBCbG9iID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyAmJiB0b1N0cmluZyQyLmNhbGwoQmxvYikgPT09ICdbb2JqZWN0IEJsb2JDb25zdHJ1Y3Rvcl0nO1xuXHR2YXIgd2l0aE5hdGl2ZUZpbGUkMSA9IHR5cGVvZiBGaWxlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBGaWxlICE9PSAndW5kZWZpbmVkJyAmJiB0b1N0cmluZyQyLmNhbGwoRmlsZSkgPT09ICdbb2JqZWN0IEZpbGVDb25zdHJ1Y3Rvcl0nO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIGhhc0JpbmFyeTIgPSBoYXNCaW5hcnk7XG5cblx0LyoqXG5cdCAqIENoZWNrcyBmb3IgYmluYXJ5IGRhdGEuXG5cdCAqXG5cdCAqIFN1cHBvcnRzIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEJsb2IgYW5kIEZpbGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBhbnl0aGluZ1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBoYXNCaW5hcnkob2JqKSB7XG5cdCAgaWYgKCFvYmogfHwgKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKG9iaikpICE9PSAnb2JqZWN0Jykge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmIChpc0FycmF5KG9iaikpIHtcblx0ICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICBpZiAoaGFzQmluYXJ5KG9ialtpXSkpIHtcblx0ICAgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmICh0eXBlb2YgQnVmZmVyID09PSAnZnVuY3Rpb24nICYmIEJ1ZmZlci5pc0J1ZmZlciAmJiBCdWZmZXIuaXNCdWZmZXIob2JqKSB8fCB0eXBlb2YgQXJyYXlCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHwgd2l0aE5hdGl2ZUJsb2IkMSAmJiBvYmogaW5zdGFuY2VvZiBCbG9iIHx8IHdpdGhOYXRpdmVGaWxlJDEgJiYgb2JqIGluc3RhbmNlb2YgRmlsZSkge1xuXHQgICAgcmV0dXJuIHRydWU7XG5cdCAgfVxuXG5cdCAgLy8gc2VlOiBodHRwczovL2dpdGh1Yi5jb20vQXV0b21hdHRpYy9oYXMtYmluYXJ5L3B1bGwvNFxuXHQgIGlmIChvYmoudG9KU09OICYmIHR5cGVvZiBvYmoudG9KU09OID09PSAnZnVuY3Rpb24nICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0ICAgIHJldHVybiBoYXNCaW5hcnkob2JqLnRvSlNPTigpLCB0cnVlKTtcblx0ICB9XG5cblx0ICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG5cdCAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSAmJiBoYXNCaW5hcnkob2JqW2tleV0pKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNCaW5hcnkyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaGFzQmluYXJ5Mixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGhhc0JpbmFyeTJcblx0fSk7XG5cblx0LyoqXG5cdCAqIEFuIGFic3RyYWN0aW9uIGZvciBzbGljaW5nIGFuIGFycmF5YnVmZmVyIGV2ZW4gd2hlblxuXHQgKiBBcnJheUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgaXMgbm90IHN1cHBvcnRlZFxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgYXJyYXlidWZmZXJfc2xpY2UgPSBmdW5jdGlvbiBhcnJheWJ1ZmZlcl9zbGljZShhcnJheWJ1ZmZlciwgc3RhcnQsIGVuZCkge1xuXHQgIHZhciBieXRlcyA9IGFycmF5YnVmZmVyLmJ5dGVMZW5ndGg7XG5cdCAgc3RhcnQgPSBzdGFydCB8fCAwO1xuXHQgIGVuZCA9IGVuZCB8fCBieXRlcztcblxuXHQgIGlmIChhcnJheWJ1ZmZlci5zbGljZSkge1xuXHQgICAgcmV0dXJuIGFycmF5YnVmZmVyLnNsaWNlKHN0YXJ0LCBlbmQpO1xuXHQgIH1cblxuXHQgIGlmIChzdGFydCA8IDApIHtcblx0ICAgIHN0YXJ0ICs9IGJ5dGVzO1xuXHQgIH1cblx0ICBpZiAoZW5kIDwgMCkge1xuXHQgICAgZW5kICs9IGJ5dGVzO1xuXHQgIH1cblx0ICBpZiAoZW5kID4gYnl0ZXMpIHtcblx0ICAgIGVuZCA9IGJ5dGVzO1xuXHQgIH1cblxuXHQgIGlmIChzdGFydCA+PSBieXRlcyB8fCBzdGFydCA+PSBlbmQgfHwgYnl0ZXMgPT09IDApIHtcblx0ICAgIHJldHVybiBuZXcgQXJyYXlCdWZmZXIoMCk7XG5cdCAgfVxuXG5cdCAgdmFyIGFidiA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKTtcblx0ICB2YXIgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoZW5kIC0gc3RhcnQpO1xuXHQgIGZvciAodmFyIGkgPSBzdGFydCwgaWkgPSAwOyBpIDwgZW5kOyBpKyssIGlpKyspIHtcblx0ICAgIHJlc3VsdFtpaV0gPSBhYnZbaV07XG5cdCAgfVxuXHQgIHJldHVybiByZXN1bHQuYnVmZmVyO1xuXHR9O1xuXG5cdHZhciBhcnJheWJ1ZmZlcl9zbGljZSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGFycmF5YnVmZmVyX3NsaWNlLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYXJyYXlidWZmZXJfc2xpY2Vcblx0fSk7XG5cblx0dmFyIGFmdGVyXzEgPSBhZnRlcjtcblxuXHRmdW5jdGlvbiBhZnRlcihjb3VudCwgY2FsbGJhY2ssIGVycl9jYikge1xuXHQgICAgdmFyIGJhaWwgPSBmYWxzZTtcblx0ICAgIGVycl9jYiA9IGVycl9jYiB8fCBub29wO1xuXHQgICAgcHJveHkuY291bnQgPSBjb3VudDtcblxuXHQgICAgcmV0dXJuIGNvdW50ID09PSAwID8gY2FsbGJhY2soKSA6IHByb3h5O1xuXG5cdCAgICBmdW5jdGlvbiBwcm94eShlcnIsIHJlc3VsdCkge1xuXHQgICAgICAgIGlmIChwcm94eS5jb3VudCA8PSAwKSB7XG5cdCAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYWZ0ZXIgY2FsbGVkIHRvbyBtYW55IHRpbWVzJyk7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIC0tcHJveHkuY291bnQ7XG5cblx0ICAgICAgICAvLyBhZnRlciBmaXJzdCBlcnJvciwgcmVzdCBhcmUgcGFzc2VkIHRvIGVycl9jYlxuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgICAgYmFpbCA9IHRydWU7XG5cdCAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cdCAgICAgICAgICAgIC8vIGZ1dHVyZSBlcnJvciBjYWxsYmFja3Mgd2lsbCBnbyB0byBlcnJvciBoYW5kbGVyXG5cdCAgICAgICAgICAgIGNhbGxiYWNrID0gZXJyX2NiO1xuXHQgICAgICAgIH0gZWxzZSBpZiAocHJveHkuY291bnQgPT09IDAgJiYgIWJhaWwpIHtcblx0ICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcblx0ICAgICAgICB9XG5cdCAgICB9XG5cdH1cblxuXHRmdW5jdGlvbiBub29wKCkge31cblxuXHR2YXIgYWZ0ZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBhZnRlcl8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYWZ0ZXJfMVxuXHR9KTtcblxuXHR2YXIgdXRmOCA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0KGZ1bmN0aW9uIChyb290KSB7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlcyBgZXhwb3J0c2Bcblx0XHRcdHZhciBmcmVlRXhwb3J0cyA9IGV4cG9ydHM7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgXG5cdFx0XHR2YXIgZnJlZU1vZHVsZSA9IG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgLCBmcm9tIE5vZGUuanMgb3IgQnJvd3NlcmlmaWVkIGNvZGUsXG5cdFx0XHQvLyBhbmQgdXNlIGl0IGFzIGByb290YFxuXHRcdFx0dmFyIGZyZWVHbG9iYWwgPSBfdHlwZW9mKGNvbW1vbmpzR2xvYmFsKSA9PSAnb2JqZWN0JyAmJiBjb21tb25qc0dsb2JhbDtcblx0XHRcdGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkge1xuXHRcdFx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0XHRcdH1cblxuXHRcdFx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0XHRcdHZhciBzdHJpbmdGcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuXG5cdFx0XHQvLyBUYWtlbiBmcm9tIGh0dHBzOi8vbXRocy5iZS9wdW55Y29kZVxuXHRcdFx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHRcdFx0dmFyIG91dHB1dCA9IFtdO1xuXHRcdFx0XHR2YXIgY291bnRlciA9IDA7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoO1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdHZhciBleHRyYTtcblx0XHRcdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHtcblx0XHRcdFx0XHRcdFx0Ly8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRha2VuIGZyb20gaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlXG5cdFx0XHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0XHRcdHZhciBpbmRleCA9IC0xO1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdFx0d2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGFycmF5W2luZGV4XTtcblx0XHRcdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gY2hlY2tTY2FsYXJWYWx1ZShjb2RlUG9pbnQsIHN0cmljdCkge1xuXHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4RDgwMCAmJiBjb2RlUG9pbnQgPD0gMHhERkZGKSB7XG5cdFx0XHRcdFx0aWYgKHN0cmljdCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0xvbmUgc3Vycm9nYXRlIFUrJyArIGNvZGVQb2ludC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSArICcgaXMgbm90IGEgc2NhbGFyIHZhbHVlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHRmdW5jdGlvbiBjcmVhdGVCeXRlKGNvZGVQb2ludCwgc2hpZnQpIHtcblx0XHRcdFx0cmV0dXJuIHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gc2hpZnQgJiAweDNGIHwgMHg4MCk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGVuY29kZUNvZGVQb2ludChjb2RlUG9pbnQsIHN0cmljdCkge1xuXHRcdFx0XHRpZiAoKGNvZGVQb2ludCAmIDB4RkZGRkZGODApID09IDApIHtcblx0XHRcdFx0XHQvLyAxLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHN5bWJvbCA9ICcnO1xuXHRcdFx0XHRpZiAoKGNvZGVQb2ludCAmIDB4RkZGRkY4MDApID09IDApIHtcblx0XHRcdFx0XHQvLyAyLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRzeW1ib2wgPSBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ID4+IDYgJiAweDFGIHwgMHhDMCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGNvZGVQb2ludCAmIDB4RkZGRjAwMDApID09IDApIHtcblx0XHRcdFx0XHQvLyAzLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRpZiAoIWNoZWNrU2NhbGFyVmFsdWUoY29kZVBvaW50LCBzdHJpY3QpKSB7XG5cdFx0XHRcdFx0XHRjb2RlUG9pbnQgPSAweEZGRkQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN5bWJvbCA9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gMTIgJiAweDBGIHwgMHhFMCk7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCA2KTtcblx0XHRcdFx0fSBlbHNlIGlmICgoY29kZVBvaW50ICYgMHhGRkUwMDAwMCkgPT0gMCkge1xuXHRcdFx0XHRcdC8vIDQtYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRcdHN5bWJvbCA9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gMTggJiAweDA3IHwgMHhGMCk7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCAxMik7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCA2KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzeW1ib2wgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCAmIDB4M0YgfCAweDgwKTtcblx0XHRcdFx0cmV0dXJuIHN5bWJvbDtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gdXRmOGVuY29kZShzdHJpbmcsIG9wdHMpIHtcblx0XHRcdFx0b3B0cyA9IG9wdHMgfHwge307XG5cdFx0XHRcdHZhciBzdHJpY3QgPSBmYWxzZSAhPT0gb3B0cy5zdHJpY3Q7XG5cblx0XHRcdFx0dmFyIGNvZGVQb2ludHMgPSB1Y3MyZGVjb2RlKHN0cmluZyk7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBjb2RlUG9pbnRzLmxlbmd0aDtcblx0XHRcdFx0dmFyIGluZGV4ID0gLTE7XG5cdFx0XHRcdHZhciBjb2RlUG9pbnQ7XG5cdFx0XHRcdHZhciBieXRlU3RyaW5nID0gJyc7XG5cdFx0XHRcdHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gY29kZVBvaW50c1tpbmRleF07XG5cdFx0XHRcdFx0Ynl0ZVN0cmluZyArPSBlbmNvZGVDb2RlUG9pbnQoY29kZVBvaW50LCBzdHJpY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBieXRlU3RyaW5nO1xuXHRcdFx0fVxuXG5cdFx0XHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHRcdFx0ZnVuY3Rpb24gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKSB7XG5cdFx0XHRcdGlmIChieXRlSW5kZXggPj0gYnl0ZUNvdW50KSB7XG5cdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgYnl0ZSBpbmRleCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGNvbnRpbnVhdGlvbkJ5dGUgPSBieXRlQXJyYXlbYnl0ZUluZGV4XSAmIDB4RkY7XG5cdFx0XHRcdGJ5dGVJbmRleCsrO1xuXG5cdFx0XHRcdGlmICgoY29udGludWF0aW9uQnl0ZSAmIDB4QzApID09IDB4ODApIHtcblx0XHRcdFx0XHRyZXR1cm4gY29udGludWF0aW9uQnl0ZSAmIDB4M0Y7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiB3ZSBlbmQgdXAgaGVyZSwgaXTigJlzIG5vdCBhIGNvbnRpbnVhdGlvbiBieXRlXG5cdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlJyk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGRlY29kZVN5bWJvbChzdHJpY3QpIHtcblx0XHRcdFx0dmFyIGJ5dGUxO1xuXHRcdFx0XHR2YXIgYnl0ZTI7XG5cdFx0XHRcdHZhciBieXRlMztcblx0XHRcdFx0dmFyIGJ5dGU0O1xuXHRcdFx0XHR2YXIgY29kZVBvaW50O1xuXG5cdFx0XHRcdGlmIChieXRlSW5kZXggPiBieXRlQ291bnQpIHtcblx0XHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBieXRlIGluZGV4Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYnl0ZUluZGV4ID09IGJ5dGVDb3VudCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlYWQgZmlyc3QgYnl0ZVxuXHRcdFx0XHRieXRlMSA9IGJ5dGVBcnJheVtieXRlSW5kZXhdICYgMHhGRjtcblx0XHRcdFx0Ynl0ZUluZGV4Kys7XG5cblx0XHRcdFx0Ly8gMS1ieXRlIHNlcXVlbmNlIChubyBjb250aW51YXRpb24gYnl0ZXMpXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweDgwKSA9PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGJ5dGUxO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gMi1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweEUwKSA9PSAweEMwKSB7XG5cdFx0XHRcdFx0Ynl0ZTIgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGNvZGVQb2ludCA9IChieXRlMSAmIDB4MUYpIDw8IDYgfCBieXRlMjtcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4ODApIHtcblx0XHRcdFx0XHRcdHJldHVybiBjb2RlUG9pbnQ7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gMy1ieXRlIHNlcXVlbmNlIChtYXkgaW5jbHVkZSB1bnBhaXJlZCBzdXJyb2dhdGVzKVxuXHRcdFx0XHRpZiAoKGJ5dGUxICYgMHhGMCkgPT0gMHhFMCkge1xuXHRcdFx0XHRcdGJ5dGUyID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRieXRlMyA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gKGJ5dGUxICYgMHgwRikgPDwgMTIgfCBieXRlMiA8PCA2IHwgYnl0ZTM7XG5cdFx0XHRcdFx0aWYgKGNvZGVQb2ludCA+PSAweDA4MDApIHtcblx0XHRcdFx0XHRcdHJldHVybiBjaGVja1NjYWxhclZhbHVlKGNvZGVQb2ludCwgc3RyaWN0KSA/IGNvZGVQb2ludCA6IDB4RkZGRDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgY29udGludWF0aW9uIGJ5dGUnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyA0LWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0aWYgKChieXRlMSAmIDB4RjgpID09IDB4RjApIHtcblx0XHRcdFx0XHRieXRlMiA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Ynl0ZTMgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGJ5dGU0ID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRjb2RlUG9pbnQgPSAoYnl0ZTEgJiAweDA3KSA8PCAweDEyIHwgYnl0ZTIgPDwgMHgwQyB8IGJ5dGUzIDw8IDB4MDYgfCBieXRlNDtcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4MDEwMDAwICYmIGNvZGVQb2ludCA8PSAweDEwRkZGRikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNvZGVQb2ludDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBVVEYtOCBkZXRlY3RlZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgYnl0ZUFycmF5O1xuXHRcdFx0dmFyIGJ5dGVDb3VudDtcblx0XHRcdHZhciBieXRlSW5kZXg7XG5cdFx0XHRmdW5jdGlvbiB1dGY4ZGVjb2RlKGJ5dGVTdHJpbmcsIG9wdHMpIHtcblx0XHRcdFx0b3B0cyA9IG9wdHMgfHwge307XG5cdFx0XHRcdHZhciBzdHJpY3QgPSBmYWxzZSAhPT0gb3B0cy5zdHJpY3Q7XG5cblx0XHRcdFx0Ynl0ZUFycmF5ID0gdWNzMmRlY29kZShieXRlU3RyaW5nKTtcblx0XHRcdFx0Ynl0ZUNvdW50ID0gYnl0ZUFycmF5Lmxlbmd0aDtcblx0XHRcdFx0Ynl0ZUluZGV4ID0gMDtcblx0XHRcdFx0dmFyIGNvZGVQb2ludHMgPSBbXTtcblx0XHRcdFx0dmFyIHRtcDtcblx0XHRcdFx0d2hpbGUgKCh0bXAgPSBkZWNvZGVTeW1ib2woc3RyaWN0KSkgIT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0Y29kZVBvaW50cy5wdXNoKHRtcCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVjczJlbmNvZGUoY29kZVBvaW50cyk7XG5cdFx0XHR9XG5cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHR2YXIgdXRmOCA9IHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4xLjInLFxuXHRcdFx0XHQnZW5jb2RlJzogdXRmOGVuY29kZSxcblx0XHRcdFx0J2RlY29kZSc6IHV0ZjhkZWNvZGVcblx0XHRcdH07XG5cblx0XHRcdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHRcdFx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRcdFx0aWYgKHR5cGVvZiB1bmRlZmluZWQgPT0gJ2Z1bmN0aW9uJyAmJiBfdHlwZW9mKHVuZGVmaW5lZC5hbWQpID09ICdvYmplY3QnICYmIHVuZGVmaW5lZC5hbWQpIHtcblx0XHRcdFx0dW5kZWZpbmVkKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXRmODtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdFx0XHRpZiAoZnJlZU1vZHVsZSkge1xuXHRcdFx0XHRcdC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gdXRmODtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0XHRcdHZhciBvYmplY3QgPSB7fTtcblx0XHRcdFx0XHR2YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3QuaGFzT3duUHJvcGVydHk7XG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIHV0ZjgpIHtcblx0XHRcdFx0XHRcdGhhc093blByb3BlcnR5LmNhbGwodXRmOCwga2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHV0Zjhba2V5XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0XHRcdHJvb3QudXRmOCA9IHV0Zjg7XG5cdFx0XHR9XG5cdFx0fSkoY29tbW9uanNHbG9iYWwpO1xuXHR9KTtcblxuXHR2YXIgdXRmOCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHV0ZjgsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB1dGY4XG5cdH0pO1xuXG5cdHZhciBiYXNlNjRBcnJheWJ1ZmZlciA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKlxuXHQgICAqIGJhc2U2NC1hcnJheWJ1ZmZlclxuXHQgICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9iYXNlNjQtYXJyYXlidWZmZXJcblx0ICAgKlxuXHQgICAqIENvcHlyaWdodCAoYykgMjAxMiBOaWtsYXMgdm9uIEhlcnR6ZW5cblx0ICAgKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cdCAgICovXG5cdCAgKGZ1bmN0aW9uICgpIHtcblxuXHQgICAgdmFyIGNoYXJzID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvXCI7XG5cblx0ICAgIC8vIFVzZSBhIGxvb2t1cCB0YWJsZSB0byBmaW5kIHRoZSBpbmRleC5cblx0ICAgIHZhciBsb29rdXAgPSBuZXcgVWludDhBcnJheSgyNTYpO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFycy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBsb29rdXBbY2hhcnMuY2hhckNvZGVBdChpKV0gPSBpO1xuXHQgICAgfVxuXG5cdCAgICBleHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uIChhcnJheWJ1ZmZlcikge1xuXHQgICAgICB2YXIgYnl0ZXMgPSBuZXcgVWludDhBcnJheShhcnJheWJ1ZmZlciksXG5cdCAgICAgICAgICBpLFxuXHQgICAgICAgICAgbGVuID0gYnl0ZXMubGVuZ3RoLFxuXHQgICAgICAgICAgYmFzZTY0ID0gXCJcIjtcblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDMpIHtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaV0gPj4gMl07XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpXSAmIDMpIDw8IDQgfCBieXRlc1tpICsgMV0gPj4gNF07XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpICsgMV0gJiAxNSkgPDwgMiB8IGJ5dGVzW2kgKyAyXSA+PiA2XTtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaSArIDJdICYgNjNdO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGxlbiAlIDMgPT09IDIpIHtcblx0ICAgICAgICBiYXNlNjQgPSBiYXNlNjQuc3Vic3RyaW5nKDAsIGJhc2U2NC5sZW5ndGggLSAxKSArIFwiPVwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGxlbiAlIDMgPT09IDEpIHtcblx0ICAgICAgICBiYXNlNjQgPSBiYXNlNjQuc3Vic3RyaW5nKDAsIGJhc2U2NC5sZW5ndGggLSAyKSArIFwiPT1cIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBiYXNlNjQ7XG5cdCAgICB9O1xuXG5cdCAgICBleHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIChiYXNlNjQpIHtcblx0ICAgICAgdmFyIGJ1ZmZlckxlbmd0aCA9IGJhc2U2NC5sZW5ndGggKiAwLjc1LFxuXHQgICAgICAgICAgbGVuID0gYmFzZTY0Lmxlbmd0aCxcblx0ICAgICAgICAgIGksXG5cdCAgICAgICAgICBwID0gMCxcblx0ICAgICAgICAgIGVuY29kZWQxLFxuXHQgICAgICAgICAgZW5jb2RlZDIsXG5cdCAgICAgICAgICBlbmNvZGVkMyxcblx0ICAgICAgICAgIGVuY29kZWQ0O1xuXG5cdCAgICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDFdID09PSBcIj1cIikge1xuXHQgICAgICAgIGJ1ZmZlckxlbmd0aC0tO1xuXHQgICAgICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDJdID09PSBcIj1cIikge1xuXHQgICAgICAgICAgYnVmZmVyTGVuZ3RoLS07XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIGFycmF5YnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlckxlbmd0aCksXG5cdCAgICAgICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKTtcblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcblx0ICAgICAgICBlbmNvZGVkMSA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpKV07XG5cdCAgICAgICAgZW5jb2RlZDIgPSBsb29rdXBbYmFzZTY0LmNoYXJDb2RlQXQoaSArIDEpXTtcblx0ICAgICAgICBlbmNvZGVkMyA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpICsgMildO1xuXHQgICAgICAgIGVuY29kZWQ0ID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAzKV07XG5cblx0ICAgICAgICBieXRlc1twKytdID0gZW5jb2RlZDEgPDwgMiB8IGVuY29kZWQyID4+IDQ7XG5cdCAgICAgICAgYnl0ZXNbcCsrXSA9IChlbmNvZGVkMiAmIDE1KSA8PCA0IHwgZW5jb2RlZDMgPj4gMjtcblx0ICAgICAgICBieXRlc1twKytdID0gKGVuY29kZWQzICYgMykgPDwgNiB8IGVuY29kZWQ0ICYgNjM7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gYXJyYXlidWZmZXI7XG5cdCAgICB9O1xuXHQgIH0pKCk7XG5cdH0pO1xuXHR2YXIgYmFzZTY0QXJyYXlidWZmZXJfMSA9IGJhc2U2NEFycmF5YnVmZmVyLmVuY29kZTtcblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyXzIgPSBiYXNlNjRBcnJheWJ1ZmZlci5kZWNvZGU7XG5cblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmFzZTY0QXJyYXlidWZmZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBiYXNlNjRBcnJheWJ1ZmZlcixcblx0XHRlbmNvZGU6IGJhc2U2NEFycmF5YnVmZmVyXzEsXG5cdFx0ZGVjb2RlOiBiYXNlNjRBcnJheWJ1ZmZlcl8yXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBibG9iIGJ1aWxkZXIgZXZlbiB3aGVuIHZlbmRvciBwcmVmaXhlcyBleGlzdFxuXHQgKi9cblxuXHR2YXIgQmxvYkJ1aWxkZXIgPSBjb21tb25qc0dsb2JhbC5CbG9iQnVpbGRlciB8fCBjb21tb25qc0dsb2JhbC5XZWJLaXRCbG9iQnVpbGRlciB8fCBjb21tb25qc0dsb2JhbC5NU0Jsb2JCdWlsZGVyIHx8IGNvbW1vbmpzR2xvYmFsLk1vekJsb2JCdWlsZGVyO1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBCbG9iIGNvbnN0cnVjdG9yIGlzIHN1cHBvcnRlZFxuXHQgKi9cblxuXHR2YXIgYmxvYlN1cHBvcnRlZCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0cnkge1xuXHQgICAgdmFyIGEgPSBuZXcgQmxvYihbJ2hpJ10pO1xuXHQgICAgcmV0dXJuIGEuc2l6ZSA9PT0gMjtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXHR9KCk7XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIEJsb2IgY29uc3RydWN0b3Igc3VwcG9ydHMgQXJyYXlCdWZmZXJWaWV3c1xuXHQgKiBGYWlscyBpbiBTYWZhcmkgNiwgc28gd2UgbmVlZCB0byBtYXAgdG8gQXJyYXlCdWZmZXJzIHRoZXJlLlxuXHQgKi9cblxuXHR2YXIgYmxvYlN1cHBvcnRzQXJyYXlCdWZmZXJWaWV3ID0gYmxvYlN1cHBvcnRlZCAmJiBmdW5jdGlvbiAoKSB7XG5cdCAgdHJ5IHtcblx0ICAgIHZhciBiID0gbmV3IEJsb2IoW25ldyBVaW50OEFycmF5KFsxLCAyXSldKTtcblx0ICAgIHJldHVybiBiLnNpemUgPT09IDI7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBCbG9iQnVpbGRlciBpcyBzdXBwb3J0ZWRcblx0ICovXG5cblx0dmFyIGJsb2JCdWlsZGVyU3VwcG9ydGVkID0gQmxvYkJ1aWxkZXIgJiYgQmxvYkJ1aWxkZXIucHJvdG90eXBlLmFwcGVuZCAmJiBCbG9iQnVpbGRlci5wcm90b3R5cGUuZ2V0QmxvYjtcblxuXHQvKipcblx0ICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgbWFwcyBBcnJheUJ1ZmZlclZpZXdzIHRvIEFycmF5QnVmZmVyc1xuXHQgKiBVc2VkIGJ5IEJsb2JCdWlsZGVyIGNvbnN0cnVjdG9yIGFuZCBvbGQgYnJvd3NlcnMgdGhhdCBkaWRuJ3Rcblx0ICogc3VwcG9ydCBpdCBpbiB0aGUgQmxvYiBjb25zdHJ1Y3Rvci5cblx0ICovXG5cblx0ZnVuY3Rpb24gbWFwQXJyYXlCdWZmZXJWaWV3cyhhcnkpIHtcblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuXHQgICAgdmFyIGNodW5rID0gYXJ5W2ldO1xuXHQgICAgaWYgKGNodW5rLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG5cdCAgICAgIHZhciBidWYgPSBjaHVuay5idWZmZXI7XG5cblx0ICAgICAgLy8gaWYgdGhpcyBpcyBhIHN1YmFycmF5LCBtYWtlIGEgY29weSBzbyB3ZSBvbmx5XG5cdCAgICAgIC8vIGluY2x1ZGUgdGhlIHN1YmFycmF5IHJlZ2lvbiBmcm9tIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlclxuXHQgICAgICBpZiAoY2h1bmsuYnl0ZUxlbmd0aCAhPT0gYnVmLmJ5dGVMZW5ndGgpIHtcblx0ICAgICAgICB2YXIgY29weSA9IG5ldyBVaW50OEFycmF5KGNodW5rLmJ5dGVMZW5ndGgpO1xuXHQgICAgICAgIGNvcHkuc2V0KG5ldyBVaW50OEFycmF5KGJ1ZiwgY2h1bmsuYnl0ZU9mZnNldCwgY2h1bmsuYnl0ZUxlbmd0aCkpO1xuXHQgICAgICAgIGJ1ZiA9IGNvcHkuYnVmZmVyO1xuXHQgICAgICB9XG5cblx0ICAgICAgYXJ5W2ldID0gYnVmO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIEJsb2JCdWlsZGVyQ29uc3RydWN0b3IoYXJ5LCBvcHRpb25zKSB7XG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cblx0ICB2YXIgYmIgPSBuZXcgQmxvYkJ1aWxkZXIoKTtcblx0ICBtYXBBcnJheUJ1ZmZlclZpZXdzKGFyeSk7XG5cblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuXHQgICAgYmIuYXBwZW5kKGFyeVtpXSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIG9wdGlvbnMudHlwZSA/IGJiLmdldEJsb2Iob3B0aW9ucy50eXBlKSA6IGJiLmdldEJsb2IoKTtcblx0fVxuXHRmdW5jdGlvbiBCbG9iQ29uc3RydWN0b3IoYXJ5LCBvcHRpb25zKSB7XG5cdCAgbWFwQXJyYXlCdWZmZXJWaWV3cyhhcnkpO1xuXHQgIHJldHVybiBuZXcgQmxvYihhcnksIG9wdGlvbnMgfHwge30pO1xuXHR9XG5cdHZhciBibG9iID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmIChibG9iU3VwcG9ydGVkKSB7XG5cdCAgICByZXR1cm4gYmxvYlN1cHBvcnRzQXJyYXlCdWZmZXJWaWV3ID8gY29tbW9uanNHbG9iYWwuQmxvYiA6IEJsb2JDb25zdHJ1Y3Rvcjtcblx0ICB9IGVsc2UgaWYgKGJsb2JCdWlsZGVyU3VwcG9ydGVkKSB7XG5cdCAgICByZXR1cm4gQmxvYkJ1aWxkZXJDb25zdHJ1Y3Rvcjtcblx0ICB9IGVsc2Uge1xuXHQgICAgcmV0dXJuIHVuZGVmaW5lZDtcblx0ICB9XG5cdH0oKTtcblxuXHR2YXIgYmxvYiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJsb2IsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBibG9iXG5cdH0pO1xuXG5cdHZhciBrZXlzJDIgPSAoIGtleXMkMSAmJiBrZXlzICkgfHwga2V5cyQxO1xuXG5cdHZhciBoYXNCaW5hcnkkMSA9ICggaGFzQmluYXJ5MiQxICYmIGhhc0JpbmFyeTIgKSB8fCBoYXNCaW5hcnkyJDE7XG5cblx0dmFyIHNsaWNlQnVmZmVyID0gKCBhcnJheWJ1ZmZlcl9zbGljZSQxICYmIGFycmF5YnVmZmVyX3NsaWNlICkgfHwgYXJyYXlidWZmZXJfc2xpY2UkMTtcblxuXHR2YXIgYWZ0ZXIkMiA9ICggYWZ0ZXIkMSAmJiBhZnRlcl8xICkgfHwgYWZ0ZXIkMTtcblxuXHR2YXIgdXRmOCQyID0gKCB1dGY4JDEgJiYgdXRmOCApIHx8IHV0ZjgkMTtcblxuXHR2YXIgcmVxdWlyZSQkMCQzID0gKCBiYXNlNjRBcnJheWJ1ZmZlciQxICYmIGJhc2U2NEFycmF5YnVmZmVyICkgfHwgYmFzZTY0QXJyYXlidWZmZXIkMTtcblxuXHR2YXIgQmxvYiQxID0gKCBibG9iJDEgJiYgYmxvYiApIHx8IGJsb2IkMTtcblxuXHR2YXIgYnJvd3NlciQyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgYmFzZTY0ZW5jb2Rlcjtcblx0ICBpZiAoY29tbW9uanNHbG9iYWwgJiYgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIpIHtcblx0ICAgIGJhc2U2NGVuY29kZXIgPSByZXF1aXJlJCQwJDM7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQ2hlY2sgaWYgd2UgYXJlIHJ1bm5pbmcgYW4gYW5kcm9pZCBicm93c2VyLiBUaGF0IHJlcXVpcmVzIHVzIHRvIHVzZVxuXHQgICAqIEFycmF5QnVmZmVyIHdpdGggcG9sbGluZyB0cmFuc3BvcnRzLi4uXG5cdCAgICpcblx0ICAgKiBodHRwOi8vZ2hpbmRhLm5ldC9qcGVnLWJsb2ItYWpheC1hbmRyb2lkL1xuXHQgICAqL1xuXG5cdCAgdmFyIGlzQW5kcm9pZCA9IHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIC9BbmRyb2lkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXHQgIC8qKlxuXHQgICAqIENoZWNrIGlmIHdlIGFyZSBydW5uaW5nIGluIFBoYW50b21KUy5cblx0ICAgKiBVcGxvYWRpbmcgYSBCbG9iIHdpdGggUGhhbnRvbUpTIGRvZXMgbm90IHdvcmsgY29ycmVjdGx5LCBhcyByZXBvcnRlZCBoZXJlOlxuXHQgICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9hcml5YS9waGFudG9tanMvaXNzdWVzLzExMzk1XG5cdCAgICogQHR5cGUgYm9vbGVhblxuXHQgICAqL1xuXHQgIHZhciBpc1BoYW50b21KUyA9IHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIC9QaGFudG9tSlMvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cdCAgLyoqXG5cdCAgICogV2hlbiB0cnVlLCBhdm9pZHMgdXNpbmcgQmxvYnMgdG8gZW5jb2RlIHBheWxvYWRzLlxuXHQgICAqIEB0eXBlIGJvb2xlYW5cblx0ICAgKi9cblx0ICB2YXIgZG9udFNlbmRCbG9icyA9IGlzQW5kcm9pZCB8fCBpc1BoYW50b21KUztcblxuXHQgIC8qKlxuXHQgICAqIEN1cnJlbnQgcHJvdG9jb2wgdmVyc2lvbi5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMucHJvdG9jb2wgPSAzO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIHBhY2tldHMgPSBleHBvcnRzLnBhY2tldHMgPSB7XG5cdCAgICBvcGVuOiAwIC8vIG5vbi13c1xuXHQgICAgLCBjbG9zZTogMSAvLyBub24td3Ncblx0ICAgICwgcGluZzogMixcblx0ICAgIHBvbmc6IDMsXG5cdCAgICBtZXNzYWdlOiA0LFxuXHQgICAgdXBncmFkZTogNSxcblx0ICAgIG5vb3A6IDZcblx0ICB9O1xuXG5cdCAgdmFyIHBhY2tldHNsaXN0ID0ga2V5cyQyKHBhY2tldHMpO1xuXG5cdCAgLyoqXG5cdCAgICogUHJlbWFkZSBlcnJvciBwYWNrZXQuXG5cdCAgICovXG5cblx0ICB2YXIgZXJyID0geyB0eXBlOiAnZXJyb3InLCBkYXRhOiAncGFyc2VyIGVycm9yJyB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ3JlYXRlIGEgYmxvYiBhcGkgZXZlbiBmb3IgYmxvYiBidWlsZGVyIHdoZW4gdmVuZG9yIHByZWZpeGVzIGV4aXN0XG5cdCAgICovXG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIGEgcGFja2V0LlxuXHQgICAqXG5cdCAgICogICAgIDxwYWNrZXQgdHlwZSBpZD4gWyA8ZGF0YT4gXVxuXHQgICAqXG5cdCAgICogRXhhbXBsZTpcblx0ICAgKlxuXHQgICAqICAgICA1aGVsbG8gd29ybGRcblx0ICAgKiAgICAgM1xuXHQgICAqICAgICA0XG5cdCAgICpcblx0ICAgKiBCaW5hcnkgaXMgZW5jb2RlZCBpbiBhbiBpZGVudGljYWwgcHJpbmNpcGxlXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIHV0ZjhlbmNvZGUsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIHN1cHBvcnRzQmluYXJ5ID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gc3VwcG9ydHNCaW5hcnk7XG5cdCAgICAgIHN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2YgdXRmOGVuY29kZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IHV0ZjhlbmNvZGU7XG5cdCAgICAgIHV0ZjhlbmNvZGUgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZGF0YSA9IHBhY2tldC5kYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBwYWNrZXQuZGF0YS5idWZmZXIgfHwgcGFja2V0LmRhdGE7XG5cblx0ICAgIGlmIChjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlciAmJiBkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcblx0ICAgICAgcmV0dXJuIGVuY29kZUFycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKTtcblx0ICAgIH0gZWxzZSBpZiAoQmxvYiQxICYmIGRhdGEgaW5zdGFuY2VvZiBjb21tb25qc0dsb2JhbC5CbG9iKSB7XG5cdCAgICAgIHJldHVybiBlbmNvZGVCbG9iKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgLy8gbWlnaHQgYmUgYW4gb2JqZWN0IHdpdGggeyBiYXNlNjQ6IHRydWUsIGRhdGE6IGRhdGFBc0Jhc2U2NFN0cmluZyB9XG5cdCAgICBpZiAoZGF0YSAmJiBkYXRhLmJhc2U2NCkge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQmFzZTY0T2JqZWN0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICAvLyBTZW5kaW5nIGRhdGEgYXMgYSB1dGYtOCBzdHJpbmdcblx0ICAgIHZhciBlbmNvZGVkID0gcGFja2V0c1twYWNrZXQudHlwZV07XG5cblx0ICAgIC8vIGRhdGEgZnJhZ21lbnQgaXMgb3B0aW9uYWxcblx0ICAgIGlmICh1bmRlZmluZWQgIT09IHBhY2tldC5kYXRhKSB7XG5cdCAgICAgIGVuY29kZWQgKz0gdXRmOGVuY29kZSA/IHV0ZjgkMi5lbmNvZGUoU3RyaW5nKHBhY2tldC5kYXRhKSwgeyBzdHJpY3Q6IGZhbHNlIH0pIDogU3RyaW5nKHBhY2tldC5kYXRhKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKCcnICsgZW5jb2RlZCk7XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJhc2U2NE9iamVjdChwYWNrZXQsIGNhbGxiYWNrKSB7XG5cdCAgICAvLyBwYWNrZXQgZGF0YSBpcyBhbiBvYmplY3QgeyBiYXNlNjQ6IHRydWUsIGRhdGE6IGRhdGFBc0Jhc2U2NFN0cmluZyB9XG5cdCAgICB2YXIgbWVzc2FnZSA9ICdiJyArIGV4cG9ydHMucGFja2V0c1twYWNrZXQudHlwZV0gKyBwYWNrZXQuZGF0YS5kYXRhO1xuXHQgICAgcmV0dXJuIGNhbGxiYWNrKG1lc3NhZ2UpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBwYWNrZXQgaGVscGVycyBmb3IgYmluYXJ5IHR5cGVzXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmNvZGVBcnJheUJ1ZmZlcihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjaykge1xuXHQgICAgaWYgKCFzdXBwb3J0c0JpbmFyeSkge1xuXHQgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQocGFja2V0LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBkYXRhID0gcGFja2V0LmRhdGE7XG5cdCAgICB2YXIgY29udGVudEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG5cdCAgICB2YXIgcmVzdWx0QnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMSArIGRhdGEuYnl0ZUxlbmd0aCk7XG5cblx0ICAgIHJlc3VsdEJ1ZmZlclswXSA9IHBhY2tldHNbcGFja2V0LnR5cGVdO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb250ZW50QXJyYXkubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgcmVzdWx0QnVmZmVyW2kgKyAxXSA9IGNvbnRlbnRBcnJheVtpXTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKHJlc3VsdEJ1ZmZlci5idWZmZXIpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJsb2JBc0FycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZUJhc2U2NFBhY2tldChwYWNrZXQsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgIGZyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgcGFja2V0LmRhdGEgPSBmci5yZXN1bHQ7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIHRydWUsIGNhbGxiYWNrKTtcblx0ICAgIH07XG5cdCAgICByZXR1cm4gZnIucmVhZEFzQXJyYXlCdWZmZXIocGFja2V0LmRhdGEpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJsb2IocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICghc3VwcG9ydHNCaW5hcnkpIHtcblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlQmFzZTY0UGFja2V0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoZG9udFNlbmRCbG9icykge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQmxvYkFzQXJyYXlCdWZmZXIocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgbGVuZ3RoID0gbmV3IFVpbnQ4QXJyYXkoMSk7XG5cdCAgICBsZW5ndGhbMF0gPSBwYWNrZXRzW3BhY2tldC50eXBlXTtcblx0ICAgIHZhciBibG9iID0gbmV3IEJsb2IkMShbbGVuZ3RoLmJ1ZmZlciwgcGFja2V0LmRhdGFdKTtcblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKGJsb2IpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXMgYSBwYWNrZXQgd2l0aCBiaW5hcnkgZGF0YSBpbiBhIGJhc2U2NCBzdHJpbmdcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQsIGhhcyBgdHlwZWAgYW5kIGBkYXRhYFxuXHQgICAqIEByZXR1cm4ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgbWVzc2FnZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0LCBjYWxsYmFjaykge1xuXHQgICAgdmFyIG1lc3NhZ2UgPSAnYicgKyBleHBvcnRzLnBhY2tldHNbcGFja2V0LnR5cGVdO1xuXHQgICAgaWYgKEJsb2IkMSAmJiBwYWNrZXQuZGF0YSBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkJsb2IpIHtcblx0ICAgICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgICAgZnIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHZhciBiNjQgPSBmci5yZXN1bHQuc3BsaXQoJywnKVsxXTtcblx0ICAgICAgICBjYWxsYmFjayhtZXNzYWdlICsgYjY0KTtcblx0ICAgICAgfTtcblx0ICAgICAgcmV0dXJuIGZyLnJlYWRBc0RhdGFVUkwocGFja2V0LmRhdGEpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgYjY0ZGF0YTtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGI2NGRhdGEgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KHBhY2tldC5kYXRhKSk7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIC8vIGlQaG9uZSBTYWZhcmkgZG9lc24ndCBsZXQgeW91IGFwcGx5IHdpdGggdHlwZWQgYXJyYXlzXG5cdCAgICAgIHZhciB0eXBlZCA9IG5ldyBVaW50OEFycmF5KHBhY2tldC5kYXRhKTtcblx0ICAgICAgdmFyIGJhc2ljID0gbmV3IEFycmF5KHR5cGVkLmxlbmd0aCk7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZWQubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBiYXNpY1tpXSA9IHR5cGVkW2ldO1xuXHQgICAgICB9XG5cdCAgICAgIGI2NGRhdGEgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGJhc2ljKTtcblx0ICAgIH1cblx0ICAgIG1lc3NhZ2UgKz0gY29tbW9uanNHbG9iYWwuYnRvYShiNjRkYXRhKTtcblx0ICAgIHJldHVybiBjYWxsYmFjayhtZXNzYWdlKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlcyBhIHBhY2tldC4gQ2hhbmdlcyBmb3JtYXQgdG8gQmxvYiBpZiByZXF1ZXN0ZWQuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHdpdGggYHR5cGVgIGFuZCBgZGF0YWAgKGlmIGFueSlcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZGVjb2RlUGFja2V0ID0gZnVuY3Rpb24gKGRhdGEsIGJpbmFyeVR5cGUsIHV0ZjhkZWNvZGUpIHtcblx0ICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgcmV0dXJuIGVycjtcblx0ICAgIH1cblx0ICAgIC8vIFN0cmluZyBkYXRhXG5cdCAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIGlmIChkYXRhLmNoYXJBdCgwKSA9PT0gJ2InKSB7XG5cdCAgICAgICAgcmV0dXJuIGV4cG9ydHMuZGVjb2RlQmFzZTY0UGFja2V0KGRhdGEuc3Vic3RyKDEpLCBiaW5hcnlUeXBlKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmICh1dGY4ZGVjb2RlKSB7XG5cdCAgICAgICAgZGF0YSA9IHRyeURlY29kZShkYXRhKTtcblx0ICAgICAgICBpZiAoZGF0YSA9PT0gZmFsc2UpIHtcblx0ICAgICAgICAgIHJldHVybiBlcnI7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICAgIHZhciB0eXBlID0gZGF0YS5jaGFyQXQoMCk7XG5cblx0ICAgICAgaWYgKE51bWJlcih0eXBlKSAhPSB0eXBlIHx8ICFwYWNrZXRzbGlzdFt0eXBlXSkge1xuXHQgICAgICAgIHJldHVybiBlcnI7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoZGF0YS5sZW5ndGggPiAxKSB7XG5cdCAgICAgICAgcmV0dXJuIHsgdHlwZTogcGFja2V0c2xpc3RbdHlwZV0sIGRhdGE6IGRhdGEuc3Vic3RyaW5nKDEpIH07XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIHsgdHlwZTogcGFja2V0c2xpc3RbdHlwZV0gfTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB2YXIgYXNBcnJheSA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuXHQgICAgdmFyIHR5cGUgPSBhc0FycmF5WzBdO1xuXHQgICAgdmFyIHJlc3QgPSBzbGljZUJ1ZmZlcihkYXRhLCAxKTtcblx0ICAgIGlmIChCbG9iJDEgJiYgYmluYXJ5VHlwZSA9PT0gJ2Jsb2InKSB7XG5cdCAgICAgIHJlc3QgPSBuZXcgQmxvYiQxKFtyZXN0XSk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4geyB0eXBlOiBwYWNrZXRzbGlzdFt0eXBlXSwgZGF0YTogcmVzdCB9O1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiB0cnlEZWNvZGUoZGF0YSkge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgZGF0YSA9IHV0ZjgkMi5kZWNvZGUoZGF0YSwgeyBzdHJpY3Q6IGZhbHNlIH0pO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gZGF0YTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVzIGEgcGFja2V0IGVuY29kZWQgaW4gYSBiYXNlNjQgc3RyaW5nXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgbWVzc2FnZVxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBgdHlwZWAgYW5kIGBkYXRhYCAoaWYgYW55KVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVCYXNlNjRQYWNrZXQgPSBmdW5jdGlvbiAobXNnLCBiaW5hcnlUeXBlKSB7XG5cdCAgICB2YXIgdHlwZSA9IHBhY2tldHNsaXN0W21zZy5jaGFyQXQoMCldO1xuXHQgICAgaWYgKCFiYXNlNjRlbmNvZGVyKSB7XG5cdCAgICAgIHJldHVybiB7IHR5cGU6IHR5cGUsIGRhdGE6IHsgYmFzZTY0OiB0cnVlLCBkYXRhOiBtc2cuc3Vic3RyKDEpIH0gfTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGRhdGEgPSBiYXNlNjRlbmNvZGVyLmRlY29kZShtc2cuc3Vic3RyKDEpKTtcblxuXHQgICAgaWYgKGJpbmFyeVR5cGUgPT09ICdibG9iJyAmJiBCbG9iJDEpIHtcblx0ICAgICAgZGF0YSA9IG5ldyBCbG9iJDEoW2RhdGFdKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHsgdHlwZTogdHlwZSwgZGF0YTogZGF0YSB9O1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIG11bHRpcGxlIG1lc3NhZ2VzIChwYXlsb2FkKS5cblx0ICAgKlxuXHQgICAqICAgICA8bGVuZ3RoPjpkYXRhXG5cdCAgICpcblx0ICAgKiBFeGFtcGxlOlxuXHQgICAqXG5cdCAgICogICAgIDExOmhlbGxvIHdvcmxkMjpoaVxuXHQgICAqXG5cdCAgICogSWYgYW55IGNvbnRlbnRzIGFyZSBiaW5hcnksIHRoZXkgd2lsbCBiZSBlbmNvZGVkIGFzIGJhc2U2NCBzdHJpbmdzLiBCYXNlNjRcblx0ICAgKiBlbmNvZGVkIHN0cmluZ3MgYXJlIG1hcmtlZCB3aXRoIGEgYiBiZWZvcmUgdGhlIGxlbmd0aCBzcGVjaWZpZXJcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGF5bG9hZCA9IGZ1bmN0aW9uIChwYWNrZXRzLCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICh0eXBlb2Ygc3VwcG9ydHNCaW5hcnkgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSBzdXBwb3J0c0JpbmFyeTtcblx0ICAgICAgc3VwcG9ydHNCaW5hcnkgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgaXNCaW5hcnkgPSBoYXNCaW5hcnkkMShwYWNrZXRzKTtcblxuXHQgICAgaWYgKHN1cHBvcnRzQmluYXJ5ICYmIGlzQmluYXJ5KSB7XG5cdCAgICAgIGlmIChCbG9iJDEgJiYgIWRvbnRTZW5kQmxvYnMpIHtcblx0ICAgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVQYXlsb2FkQXNCbG9iKHBhY2tldHMsIGNhbGxiYWNrKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyKHBhY2tldHMsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFwYWNrZXRzLmxlbmd0aCkge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2soJzA6Jyk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHNldExlbmd0aEhlYWRlcihtZXNzYWdlKSB7XG5cdCAgICAgIHJldHVybiBtZXNzYWdlLmxlbmd0aCArICc6JyArIG1lc3NhZ2U7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGVuY29kZU9uZShwYWNrZXQsIGRvbmVDYWxsYmFjaykge1xuXHQgICAgICBleHBvcnRzLmVuY29kZVBhY2tldChwYWNrZXQsICFpc0JpbmFyeSA/IGZhbHNlIDogc3VwcG9ydHNCaW5hcnksIGZhbHNlLCBmdW5jdGlvbiAobWVzc2FnZSkge1xuXHQgICAgICAgIGRvbmVDYWxsYmFjayhudWxsLCBzZXRMZW5ndGhIZWFkZXIobWVzc2FnZSkpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgbWFwKHBhY2tldHMsIGVuY29kZU9uZSwgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2socmVzdWx0cy5qb2luKCcnKSk7XG5cdCAgICB9KTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQXN5bmMgYXJyYXkgbWFwIHVzaW5nIGFmdGVyXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBtYXAoYXJ5LCBlYWNoLCBkb25lKSB7XG5cdCAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KGFyeS5sZW5ndGgpO1xuXHQgICAgdmFyIG5leHQgPSBhZnRlciQyKGFyeS5sZW5ndGgsIGRvbmUpO1xuXG5cdCAgICB2YXIgZWFjaFdpdGhJbmRleCA9IGZ1bmN0aW9uIGVhY2hXaXRoSW5kZXgoaSwgZWwsIGNiKSB7XG5cdCAgICAgIGVhY2goZWwsIGZ1bmN0aW9uIChlcnJvciwgbXNnKSB7XG5cdCAgICAgICAgcmVzdWx0W2ldID0gbXNnO1xuXHQgICAgICAgIGNiKGVycm9yLCByZXN1bHQpO1xuXHQgICAgICB9KTtcblx0ICAgIH07XG5cblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJ5Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGVhY2hXaXRoSW5kZXgoaSwgYXJ5W2ldLCBuZXh0KTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKlxuXHQgICAqIERlY29kZXMgZGF0YSB3aGVuIGEgcGF5bG9hZCBpcyBtYXliZSBleHBlY3RlZC4gUG9zc2libGUgYmluYXJ5IGNvbnRlbnRzIGFyZVxuXHQgICAqIGRlY29kZWQgZnJvbSB0aGVpciBiYXNlNjQgcmVwcmVzZW50YXRpb25cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhLCBjYWxsYmFjayBtZXRob2Rcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVQYXlsb2FkID0gZnVuY3Rpb24gKGRhdGEsIGJpbmFyeVR5cGUsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmRlY29kZVBheWxvYWRBc0JpbmFyeShkYXRhLCBiaW5hcnlUeXBlLCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2YgYmluYXJ5VHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IGJpbmFyeVR5cGU7XG5cdCAgICAgIGJpbmFyeVR5cGUgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgcGFja2V0O1xuXHQgICAgaWYgKGRhdGEgPT09ICcnKSB7XG5cdCAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBsZW5ndGggPSAnJyxcblx0ICAgICAgICBuLFxuXHQgICAgICAgIG1zZztcblxuXHQgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICB2YXIgY2hyID0gZGF0YS5jaGFyQXQoaSk7XG5cblx0ICAgICAgaWYgKGNociAhPT0gJzonKSB7XG5cdCAgICAgICAgbGVuZ3RoICs9IGNocjtcblx0ICAgICAgICBjb250aW51ZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChsZW5ndGggPT09ICcnIHx8IGxlbmd0aCAhPSAobiA9IE51bWJlcihsZW5ndGgpKSkge1xuXHQgICAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIG1zZyA9IGRhdGEuc3Vic3RyKGkgKyAxLCBuKTtcblxuXHQgICAgICBpZiAobGVuZ3RoICE9IG1zZy5sZW5ndGgpIHtcblx0ICAgICAgICAvLyBwYXJzZXIgZXJyb3IgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobXNnLmxlbmd0aCkge1xuXHQgICAgICAgIHBhY2tldCA9IGV4cG9ydHMuZGVjb2RlUGFja2V0KG1zZywgYmluYXJ5VHlwZSwgZmFsc2UpO1xuXG5cdCAgICAgICAgaWYgKGVyci50eXBlID09PSBwYWNrZXQudHlwZSAmJiBlcnIuZGF0YSA9PT0gcGFja2V0LmRhdGEpIHtcblx0ICAgICAgICAgIC8vIHBhcnNlciBlcnJvciBpbiBpbmRpdmlkdWFsIHBhY2tldCAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHZhciByZXQgPSBjYWxsYmFjayhwYWNrZXQsIGkgKyBuLCBsKTtcblx0ICAgICAgICBpZiAoZmFsc2UgPT09IHJldCkgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgLy8gYWR2YW5jZSBjdXJzb3Jcblx0ICAgICAgaSArPSBuO1xuXHQgICAgICBsZW5ndGggPSAnJztcblx0ICAgIH1cblxuXHQgICAgaWYgKGxlbmd0aCAhPT0gJycpIHtcblx0ICAgICAgLy8gcGFyc2VyIGVycm9yIC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlcyBtdWx0aXBsZSBtZXNzYWdlcyAocGF5bG9hZCkgYXMgYmluYXJ5LlxuXHQgICAqXG5cdCAgICogPDEgPSBiaW5hcnksIDAgPSBzdHJpbmc+PG51bWJlciBmcm9tIDAtOT48bnVtYmVyIGZyb20gMC05PlsuLi5dPG51bWJlclxuXHQgICAqIDI1NT48ZGF0YT5cblx0ICAgKlxuXHQgICAqIEV4YW1wbGU6XG5cdCAgICogMSAzIDI1NSAxIDIgMywgaWYgdGhlIGJpbmFyeSBjb250ZW50cyBhcmUgaW50ZXJwcmV0ZWQgYXMgOCBiaXQgaW50ZWdlcnNcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcblx0ICAgKiBAcmV0dXJuIHtBcnJheUJ1ZmZlcn0gZW5jb2RlZCBwYXlsb2FkXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKHBhY2tldHMsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXBhY2tldHMubGVuZ3RoKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgQXJyYXlCdWZmZXIoMCkpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBlbmNvZGVPbmUocGFja2V0LCBkb25lQ2FsbGJhY2spIHtcblx0ICAgICAgZXhwb3J0cy5lbmNvZGVQYWNrZXQocGFja2V0LCB0cnVlLCB0cnVlLCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgICAgIHJldHVybiBkb25lQ2FsbGJhY2sobnVsbCwgZGF0YSk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBtYXAocGFja2V0cywgZW5jb2RlT25lLCBmdW5jdGlvbiAoZXJyLCBlbmNvZGVkUGFja2V0cykge1xuXHQgICAgICB2YXIgdG90YWxMZW5ndGggPSBlbmNvZGVkUGFja2V0cy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgcCkge1xuXHQgICAgICAgIHZhciBsZW47XG5cdCAgICAgICAgaWYgKHR5cGVvZiBwID09PSAnc3RyaW5nJykge1xuXHQgICAgICAgICAgbGVuID0gcC5sZW5ndGg7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGxlbiA9IHAuYnl0ZUxlbmd0aDtcblx0ICAgICAgICB9XG5cdCAgICAgICAgcmV0dXJuIGFjYyArIGxlbi50b1N0cmluZygpLmxlbmd0aCArIGxlbiArIDI7IC8vIHN0cmluZy9iaW5hcnkgaWRlbnRpZmllciArIHNlcGFyYXRvciA9IDJcblx0ICAgICAgfSwgMCk7XG5cblx0ICAgICAgdmFyIHJlc3VsdEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkodG90YWxMZW5ndGgpO1xuXG5cdCAgICAgIHZhciBidWZmZXJJbmRleCA9IDA7XG5cdCAgICAgIGVuY29kZWRQYWNrZXRzLmZvckVhY2goZnVuY3Rpb24gKHApIHtcblx0ICAgICAgICB2YXIgaXNTdHJpbmcgPSB0eXBlb2YgcCA9PT0gJ3N0cmluZyc7XG5cdCAgICAgICAgdmFyIGFiID0gcDtcblx0ICAgICAgICBpZiAoaXNTdHJpbmcpIHtcblx0ICAgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkocC5sZW5ndGgpO1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZpZXdbaV0gPSBwLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICBhYiA9IHZpZXcuYnVmZmVyO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChpc1N0cmluZykge1xuXHQgICAgICAgICAgLy8gbm90IHRydWUgYmluYXJ5XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDA7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIC8vIHRydWUgYmluYXJ5XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDE7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdmFyIGxlblN0ciA9IGFiLmJ5dGVMZW5ndGgudG9TdHJpbmcoKTtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlblN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSBwYXJzZUludChsZW5TdHJbaV0pO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDI1NTtcblxuXHQgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYWIpO1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSB2aWV3W2ldO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlc3VsdEFycmF5LmJ1ZmZlcik7XG5cdCAgICB9KTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIGFzIEJsb2Jcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGF5bG9hZEFzQmxvYiA9IGZ1bmN0aW9uIChwYWNrZXRzLCBjYWxsYmFjaykge1xuXHQgICAgZnVuY3Rpb24gZW5jb2RlT25lKHBhY2tldCwgZG9uZUNhbGxiYWNrKSB7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgdHJ1ZSwgdHJ1ZSwgZnVuY3Rpb24gKGVuY29kZWQpIHtcblx0ICAgICAgICB2YXIgYmluYXJ5SWRlbnRpZmllciA9IG5ldyBVaW50OEFycmF5KDEpO1xuXHQgICAgICAgIGJpbmFyeUlkZW50aWZpZXJbMF0gPSAxO1xuXHQgICAgICAgIGlmICh0eXBlb2YgZW5jb2RlZCA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoZW5jb2RlZC5sZW5ndGgpO1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbmNvZGVkLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZpZXdbaV0gPSBlbmNvZGVkLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICBlbmNvZGVkID0gdmlldy5idWZmZXI7XG5cdCAgICAgICAgICBiaW5hcnlJZGVudGlmaWVyWzBdID0gMDtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2YXIgbGVuID0gZW5jb2RlZCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID8gZW5jb2RlZC5ieXRlTGVuZ3RoIDogZW5jb2RlZC5zaXplO1xuXG5cdCAgICAgICAgdmFyIGxlblN0ciA9IGxlbi50b1N0cmluZygpO1xuXHQgICAgICAgIHZhciBsZW5ndGhBcnkgPSBuZXcgVWludDhBcnJheShsZW5TdHIubGVuZ3RoICsgMSk7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5TdHIubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIGxlbmd0aEFyeVtpXSA9IHBhcnNlSW50KGxlblN0cltpXSk7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIGxlbmd0aEFyeVtsZW5TdHIubGVuZ3RoXSA9IDI1NTtcblxuXHQgICAgICAgIGlmIChCbG9iJDEpIHtcblx0ICAgICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IkMShbYmluYXJ5SWRlbnRpZmllci5idWZmZXIsIGxlbmd0aEFyeS5idWZmZXIsIGVuY29kZWRdKTtcblx0ICAgICAgICAgIGRvbmVDYWxsYmFjayhudWxsLCBibG9iKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBtYXAocGFja2V0cywgZW5jb2RlT25lLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgQmxvYiQxKHJlc3VsdHMpKTtcblx0ICAgIH0pO1xuXHQgIH07XG5cblx0ICAvKlxuXHQgICAqIERlY29kZXMgZGF0YSB3aGVuIGEgcGF5bG9hZCBpcyBtYXliZSBleHBlY3RlZC4gU3RyaW5ncyBhcmUgZGVjb2RlZCBieVxuXHQgICAqIGludGVycHJldGluZyBlYWNoIGJ5dGUgYXMgYSBrZXkgY29kZSBmb3IgZW50cmllcyBtYXJrZWQgdG8gc3RhcnQgd2l0aCAwLiBTZWVcblx0ICAgKiBkZXNjcmlwdGlvbiBvZiBlbmNvZGVQYXlsb2FkQXNCaW5hcnlcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IGRhdGEsIGNhbGxiYWNrIG1ldGhvZFxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmRlY29kZVBheWxvYWRBc0JpbmFyeSA9IGZ1bmN0aW9uIChkYXRhLCBiaW5hcnlUeXBlLCBjYWxsYmFjaykge1xuXHQgICAgaWYgKHR5cGVvZiBiaW5hcnlUeXBlID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gYmluYXJ5VHlwZTtcblx0ICAgICAgYmluYXJ5VHlwZSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHZhciBidWZmZXJUYWlsID0gZGF0YTtcblx0ICAgIHZhciBidWZmZXJzID0gW107XG5cblx0ICAgIHdoaWxlIChidWZmZXJUYWlsLmJ5dGVMZW5ndGggPiAwKSB7XG5cdCAgICAgIHZhciB0YWlsQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJUYWlsKTtcblx0ICAgICAgdmFyIGlzU3RyaW5nID0gdGFpbEFycmF5WzBdID09PSAwO1xuXHQgICAgICB2YXIgbXNnTGVuZ3RoID0gJyc7XG5cblx0ICAgICAgZm9yICh2YXIgaSA9IDE7OyBpKyspIHtcblx0ICAgICAgICBpZiAodGFpbEFycmF5W2ldID09PSAyNTUpIGJyZWFrO1xuXG5cdCAgICAgICAgLy8gMzEwID0gY2hhciBsZW5ndGggb2YgTnVtYmVyLk1BWF9WQUxVRVxuXHQgICAgICAgIGlmIChtc2dMZW5ndGgubGVuZ3RoID4gMzEwKSB7XG5cdCAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBtc2dMZW5ndGggKz0gdGFpbEFycmF5W2ldO1xuXHQgICAgICB9XG5cblx0ICAgICAgYnVmZmVyVGFpbCA9IHNsaWNlQnVmZmVyKGJ1ZmZlclRhaWwsIDIgKyBtc2dMZW5ndGgubGVuZ3RoKTtcblx0ICAgICAgbXNnTGVuZ3RoID0gcGFyc2VJbnQobXNnTGVuZ3RoKTtcblxuXHQgICAgICB2YXIgbXNnID0gc2xpY2VCdWZmZXIoYnVmZmVyVGFpbCwgMCwgbXNnTGVuZ3RoKTtcblx0ICAgICAgaWYgKGlzU3RyaW5nKSB7XG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIG1zZyA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkobXNnKSk7XG5cdCAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgLy8gaVBob25lIFNhZmFyaSBkb2Vzbid0IGxldCB5b3UgYXBwbHkgdG8gdHlwZWQgYXJyYXlzXG5cdCAgICAgICAgICB2YXIgdHlwZWQgPSBuZXcgVWludDhBcnJheShtc2cpO1xuXHQgICAgICAgICAgbXNnID0gJyc7XG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGVkLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIG1zZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHR5cGVkW2ldKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBidWZmZXJzLnB1c2gobXNnKTtcblx0ICAgICAgYnVmZmVyVGFpbCA9IHNsaWNlQnVmZmVyKGJ1ZmZlclRhaWwsIG1zZ0xlbmd0aCk7XG5cdCAgICB9XG5cblx0ICAgIHZhciB0b3RhbCA9IGJ1ZmZlcnMubGVuZ3RoO1xuXHQgICAgYnVmZmVycy5mb3JFYWNoKGZ1bmN0aW9uIChidWZmZXIsIGkpIHtcblx0ICAgICAgY2FsbGJhY2soZXhwb3J0cy5kZWNvZGVQYWNrZXQoYnVmZmVyLCBiaW5hcnlUeXBlLCB0cnVlKSwgaSwgdG90YWwpO1xuXHQgICAgfSk7XG5cdCAgfTtcblx0fSk7XG5cdHZhciBicm93c2VyXzEkMSA9IGJyb3dzZXIkMi5wcm90b2NvbDtcblx0dmFyIGJyb3dzZXJfMiQxID0gYnJvd3NlciQyLnBhY2tldHM7XG5cdHZhciBicm93c2VyXzMkMSA9IGJyb3dzZXIkMi5lbmNvZGVQYWNrZXQ7XG5cdHZhciBicm93c2VyXzQkMSA9IGJyb3dzZXIkMi5lbmNvZGVCYXNlNjRQYWNrZXQ7XG5cdHZhciBicm93c2VyXzUkMSA9IGJyb3dzZXIkMi5kZWNvZGVQYWNrZXQ7XG5cdHZhciBicm93c2VyXzYkMSA9IGJyb3dzZXIkMi5kZWNvZGVCYXNlNjRQYWNrZXQ7XG5cdHZhciBicm93c2VyXzckMSA9IGJyb3dzZXIkMi5lbmNvZGVQYXlsb2FkO1xuXHR2YXIgYnJvd3Nlcl84ID0gYnJvd3NlciQyLmRlY29kZVBheWxvYWQ7XG5cdHZhciBicm93c2VyXzkgPSBicm93c2VyJDIuZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXI7XG5cdHZhciBicm93c2VyXzEwID0gYnJvd3NlciQyLmVuY29kZVBheWxvYWRBc0Jsb2I7XG5cdHZhciBicm93c2VyXzExID0gYnJvd3NlciQyLmRlY29kZVBheWxvYWRBc0JpbmFyeTtcblxuXHR2YXIgYnJvd3NlciQzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJyb3dzZXIkMixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJyb3dzZXIkMixcblx0XHRwcm90b2NvbDogYnJvd3Nlcl8xJDEsXG5cdFx0cGFja2V0czogYnJvd3Nlcl8yJDEsXG5cdFx0ZW5jb2RlUGFja2V0OiBicm93c2VyXzMkMSxcblx0XHRlbmNvZGVCYXNlNjRQYWNrZXQ6IGJyb3dzZXJfNCQxLFxuXHRcdGRlY29kZVBhY2tldDogYnJvd3Nlcl81JDEsXG5cdFx0ZGVjb2RlQmFzZTY0UGFja2V0OiBicm93c2VyXzYkMSxcblx0XHRlbmNvZGVQYXlsb2FkOiBicm93c2VyXzckMSxcblx0XHRkZWNvZGVQYXlsb2FkOiBicm93c2VyXzgsXG5cdFx0ZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXI6IGJyb3dzZXJfOSxcblx0XHRlbmNvZGVQYXlsb2FkQXNCbG9iOiBicm93c2VyXzEwLFxuXHRcdGRlY29kZVBheWxvYWRBc0JpbmFyeTogYnJvd3Nlcl8xMVxuXHR9KTtcblxuXHR2YXIgcGFyc2VyID0gKCBicm93c2VyJDMgJiYgYnJvd3NlciQyICkgfHwgYnJvd3NlciQzO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB0cmFuc3BvcnQgPSBUcmFuc3BvcnQ7XG5cblx0LyoqXG5cdCAqIFRyYW5zcG9ydCBhYnN0cmFjdCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBUcmFuc3BvcnQob3B0cykge1xuXHQgIHRoaXMucGF0aCA9IG9wdHMucGF0aDtcblx0ICB0aGlzLmhvc3RuYW1lID0gb3B0cy5ob3N0bmFtZTtcblx0ICB0aGlzLnBvcnQgPSBvcHRzLnBvcnQ7XG5cdCAgdGhpcy5zZWN1cmUgPSBvcHRzLnNlY3VyZTtcblx0ICB0aGlzLnF1ZXJ5ID0gb3B0cy5xdWVyeTtcblx0ICB0aGlzLnRpbWVzdGFtcFBhcmFtID0gb3B0cy50aW1lc3RhbXBQYXJhbTtcblx0ICB0aGlzLnRpbWVzdGFtcFJlcXVlc3RzID0gb3B0cy50aW1lc3RhbXBSZXF1ZXN0cztcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnJztcblx0ICB0aGlzLmFnZW50ID0gb3B0cy5hZ2VudCB8fCBmYWxzZTtcblx0ICB0aGlzLnNvY2tldCA9IG9wdHMuc29ja2V0O1xuXHQgIHRoaXMuZW5hYmxlc1hEUiA9IG9wdHMuZW5hYmxlc1hEUjtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMucGZ4ID0gb3B0cy5wZng7XG5cdCAgdGhpcy5rZXkgPSBvcHRzLmtleTtcblx0ICB0aGlzLnBhc3NwaHJhc2UgPSBvcHRzLnBhc3NwaHJhc2U7XG5cdCAgdGhpcy5jZXJ0ID0gb3B0cy5jZXJ0O1xuXHQgIHRoaXMuY2EgPSBvcHRzLmNhO1xuXHQgIHRoaXMuY2lwaGVycyA9IG9wdHMuY2lwaGVycztcblx0ICB0aGlzLnJlamVjdFVuYXV0aG9yaXplZCA9IG9wdHMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIHRoaXMuZm9yY2VOb2RlID0gb3B0cy5mb3JjZU5vZGU7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cdCAgdGhpcy5sb2NhbEFkZHJlc3MgPSBvcHRzLmxvY2FsQWRkcmVzcztcblx0fVxuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKFRyYW5zcG9ydC5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBFbWl0cyBhbiBlcnJvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0clxuXHQgKiBAcmV0dXJuIHtUcmFuc3BvcnR9IGZvciBjaGFpbmluZ1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbiAobXNnLCBkZXNjKSB7XG5cdCAgdmFyIGVyciA9IG5ldyBFcnJvcihtc2cpO1xuXHQgIGVyci50eXBlID0gJ1RyYW5zcG9ydEVycm9yJztcblx0ICBlcnIuZGVzY3JpcHRpb24gPSBkZXNjO1xuXHQgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBPcGVucyB0aGUgdHJhbnNwb3J0LlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdjbG9zZWQnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW5pbmcnO1xuXHQgICAgdGhpcy5kb09wZW4oKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSB0cmFuc3BvcnQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy5kb0Nsb3NlKCk7XG5cdCAgICB0aGlzLm9uQ2xvc2UoKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgbXVsdGlwbGUgcGFja2V0cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gcGFja2V0c1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKHBhY2tldHMpIHtcblx0ICBpZiAoJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHRoaXMud3JpdGUocGFja2V0cyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRocm93IG5ldyBFcnJvcignVHJhbnNwb3J0IG5vdCBvcGVuJyk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBvcGVuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgdGhpcy53cml0YWJsZSA9IHRydWU7XG5cdCAgdGhpcy5lbWl0KCdvcGVuJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aXRoIGRhdGEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdmFyIHBhY2tldCA9IHBhcnNlci5kZWNvZGVQYWNrZXQoZGF0YSwgdGhpcy5zb2NrZXQuYmluYXJ5VHlwZSk7XG5cdCAgdGhpcy5vblBhY2tldChwYWNrZXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2l0aCBhIGRlY29kZWQgcGFja2V0LlxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIHRoaXMuZW1pdCgncGFja2V0JywgcGFja2V0KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gY2xvc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy5lbWl0KCdjbG9zZScpO1xuXHR9O1xuXG5cdHZhciB0cmFuc3BvcnQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0cmFuc3BvcnQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB0cmFuc3BvcnRcblx0fSk7XG5cblx0LyoqXHJcblx0ICogQ29tcGlsZXMgYSBxdWVyeXN0cmluZ1xyXG5cdCAqIFJldHVybnMgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3RcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fVxyXG5cdCAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAqL1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbiBlbmNvZGUob2JqKSB7XG5cdCAgdmFyIHN0ciA9ICcnO1xuXG5cdCAgZm9yICh2YXIgaSBpbiBvYmopIHtcblx0ICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgaWYgKHN0ci5sZW5ndGgpIHN0ciArPSAnJic7XG5cdCAgICAgIHN0ciArPSBlbmNvZGVVUklDb21wb25lbnQoaSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQob2JqW2ldKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gc3RyO1xuXHR9O1xuXG5cdC8qKlxyXG5cdCAqIFBhcnNlcyBhIHNpbXBsZSBxdWVyeXN0cmluZyBpbnRvIGFuIG9iamVjdFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IHFzXHJcblx0ICogQGFwaSBwcml2YXRlXHJcblx0ICovXG5cblx0dmFyIGRlY29kZSA9IGZ1bmN0aW9uIGRlY29kZShxcykge1xuXHQgIHZhciBxcnkgPSB7fTtcblx0ICB2YXIgcGFpcnMgPSBxcy5zcGxpdCgnJicpO1xuXHQgIGZvciAodmFyIGkgPSAwLCBsID0gcGFpcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICB2YXIgcGFpciA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG5cdCAgICBxcnlbZGVjb2RlVVJJQ29tcG9uZW50KHBhaXJbMF0pXSA9IGRlY29kZVVSSUNvbXBvbmVudChwYWlyWzFdKTtcblx0ICB9XG5cdCAgcmV0dXJuIHFyeTtcblx0fTtcblxuXHR2YXIgcGFyc2VxcyA9IHtcblx0ICBlbmNvZGU6IGVuY29kZSxcblx0ICBkZWNvZGU6IGRlY29kZVxuXHR9O1xuXG5cdHZhciBwYXJzZXFzJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcGFyc2Vxcyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBhcnNlcXMsXG5cdFx0ZW5jb2RlOiBlbmNvZGUsXG5cdFx0ZGVjb2RlOiBkZWNvZGVcblx0fSk7XG5cblx0dmFyIGNvbXBvbmVudEluaGVyaXQgPSBmdW5jdGlvbiBjb21wb25lbnRJbmhlcml0KGEsIGIpIHtcblx0ICB2YXIgZm4gPSBmdW5jdGlvbiBmbigpIHt9O1xuXHQgIGZuLnByb3RvdHlwZSA9IGIucHJvdG90eXBlO1xuXHQgIGEucHJvdG90eXBlID0gbmV3IGZuKCk7XG5cdCAgYS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBhO1xuXHR9O1xuXG5cdHZhciBjb21wb25lbnRJbmhlcml0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogY29tcG9uZW50SW5oZXJpdCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGNvbXBvbmVudEluaGVyaXRcblx0fSk7XG5cblx0dmFyIGFscGhhYmV0ID0gJzAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6LV8nLnNwbGl0KCcnKSxcblx0ICAgIGxlbmd0aCA9IDY0LFxuXHQgICAgbWFwID0ge30sXG5cdCAgICBzZWVkID0gMCxcblx0ICAgIGkgPSAwLFxuXHQgICAgcHJldjtcblxuXHQvKipcblx0ICogUmV0dXJuIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgc3BlY2lmaWVkIG51bWJlci5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG51bSBUaGUgbnVtYmVyIHRvIGNvbnZlcnQuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG51bWJlci5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZSQxKG51bSkge1xuXHQgIHZhciBlbmNvZGVkID0gJyc7XG5cblx0ICBkbyB7XG5cdCAgICBlbmNvZGVkID0gYWxwaGFiZXRbbnVtICUgbGVuZ3RoXSArIGVuY29kZWQ7XG5cdCAgICBudW0gPSBNYXRoLmZsb29yKG51bSAvIGxlbmd0aCk7XG5cdCAgfSB3aGlsZSAobnVtID4gMCk7XG5cblx0ICByZXR1cm4gZW5jb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGludGVnZXIgdmFsdWUgc3BlY2lmaWVkIGJ5IHRoZSBnaXZlbiBzdHJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIHN0cmluZyB0byBjb252ZXJ0LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgaW50ZWdlciB2YWx1ZSByZXByZXNlbnRlZCBieSB0aGUgc3RyaW5nLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlJDEoc3RyKSB7XG5cdCAgdmFyIGRlY29kZWQgPSAwO1xuXG5cdCAgZm9yIChpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgZGVjb2RlZCA9IGRlY29kZWQgKiBsZW5ndGggKyBtYXBbc3RyLmNoYXJBdChpKV07XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGRlY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogWWVhc3Q6IEEgdGlueSBncm93aW5nIGlkIGdlbmVyYXRvci5cblx0ICpcblx0ICogQHJldHVybnMge1N0cmluZ30gQSB1bmlxdWUgaWQuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiB5ZWFzdCgpIHtcblx0ICB2YXIgbm93ID0gZW5jb2RlJDEoK25ldyBEYXRlKCkpO1xuXG5cdCAgaWYgKG5vdyAhPT0gcHJldikgcmV0dXJuIHNlZWQgPSAwLCBwcmV2ID0gbm93O1xuXHQgIHJldHVybiBub3cgKyAnLicgKyBlbmNvZGUkMShzZWVkKyspO1xuXHR9XG5cblx0Ly9cblx0Ly8gTWFwIGVhY2ggY2hhcmFjdGVyIHRvIGl0cyBpbmRleC5cblx0Ly9cblx0Zm9yICg7IGkgPCBsZW5ndGg7IGkrKykge1xuXHQgIG1hcFthbHBoYWJldFtpXV0gPSBpO1xuXHR9IC8vXG5cdC8vIEV4cG9zZSB0aGUgYHllYXN0YCwgYGVuY29kZWAgYW5kIGBkZWNvZGVgIGZ1bmN0aW9ucy5cblx0Ly9cblx0eWVhc3QuZW5jb2RlID0gZW5jb2RlJDE7XG5cdHllYXN0LmRlY29kZSA9IGRlY29kZSQxO1xuXHR2YXIgeWVhc3RfMSA9IHllYXN0O1xuXG5cdHZhciB5ZWFzdCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHllYXN0XzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB5ZWFzdF8xXG5cdH0pO1xuXG5cdHZhciBUcmFuc3BvcnQkMSA9ICggdHJhbnNwb3J0JDEgJiYgdHJhbnNwb3J0ICkgfHwgdHJhbnNwb3J0JDE7XG5cblx0dmFyIHBhcnNlcXMkMiA9ICggcGFyc2VxcyQxICYmIHBhcnNlcXMgKSB8fCBwYXJzZXFzJDE7XG5cblx0dmFyIGluaGVyaXQgPSAoIGNvbXBvbmVudEluaGVyaXQkMSAmJiBjb21wb25lbnRJbmhlcml0ICkgfHwgY29tcG9uZW50SW5oZXJpdCQxO1xuXG5cdHZhciB5ZWFzdCQyID0gKCB5ZWFzdCQxICYmIHllYXN0XzEgKSB8fCB5ZWFzdCQxO1xuXG5cdHZhciByZXF1aXJlJCQxID0gKCB4bWxodHRwcmVxdWVzdCQxICYmIHhtbGh0dHByZXF1ZXN0ICkgfHwgeG1saHR0cHJlcXVlc3QkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDMgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6cG9sbGluZycpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmcgPSBQb2xsaW5nO1xuXG5cdC8qKlxuXHQgKiBJcyBYSFIyIHN1cHBvcnRlZD9cblx0ICovXG5cblx0dmFyIGhhc1hIUjIgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIFhNTEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSQkMTtcblx0ICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KHsgeGRvbWFpbjogZmFsc2UgfSk7XG5cdCAgcmV0dXJuIG51bGwgIT0geGhyLnJlc3BvbnNlVHlwZTtcblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBQb2xsaW5nIGludGVyZmFjZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdHNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFBvbGxpbmcob3B0cykge1xuXHQgIHZhciBmb3JjZUJhc2U2NCA9IG9wdHMgJiYgb3B0cy5mb3JjZUJhc2U2NDtcblx0ICBpZiAoIWhhc1hIUjIgfHwgZm9yY2VCYXNlNjQpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICB9XG5cdCAgVHJhbnNwb3J0JDEuY2FsbCh0aGlzLCBvcHRzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0cyBmcm9tIFRyYW5zcG9ydC5cblx0ICovXG5cblx0aW5oZXJpdChQb2xsaW5nLCBUcmFuc3BvcnQkMSk7XG5cblx0LyoqXG5cdCAqIFRyYW5zcG9ydCBuYW1lLlxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5uYW1lID0gJ3BvbGxpbmcnO1xuXG5cdC8qKlxuXHQgKiBPcGVucyB0aGUgc29ja2V0ICh0cmlnZ2VycyBwb2xsaW5nKS4gV2Ugd3JpdGUgYSBQSU5HIG1lc3NhZ2UgdG8gZGV0ZXJtaW5lXG5cdCAqIHdoZW4gdGhlIHRyYW5zcG9ydCBpcyBvcGVuLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUuZG9PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMucG9sbCgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQYXVzZXMgcG9sbGluZy5cblx0ICpcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdXBvbiBidWZmZXJzIGFyZSBmbHVzaGVkIGFuZCB0cmFuc3BvcnQgaXMgcGF1c2VkXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uIChvblBhdXNlKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ3BhdXNpbmcnO1xuXG5cdCAgZnVuY3Rpb24gcGF1c2UoKSB7XG5cdCAgICBkZWJ1ZyQzKCdwYXVzZWQnKTtcblx0ICAgIHNlbGYucmVhZHlTdGF0ZSA9ICdwYXVzZWQnO1xuXHQgICAgb25QYXVzZSgpO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLnBvbGxpbmcgfHwgIXRoaXMud3JpdGFibGUpIHtcblx0ICAgIHZhciB0b3RhbCA9IDA7XG5cblx0ICAgIGlmICh0aGlzLnBvbGxpbmcpIHtcblx0ICAgICAgZGVidWckMygnd2UgYXJlIGN1cnJlbnRseSBwb2xsaW5nIC0gd2FpdGluZyB0byBwYXVzZScpO1xuXHQgICAgICB0b3RhbCsrO1xuXHQgICAgICB0aGlzLm9uY2UoJ3BvbGxDb21wbGV0ZScsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBkZWJ1ZyQzKCdwcmUtcGF1c2UgcG9sbGluZyBjb21wbGV0ZScpO1xuXHQgICAgICAgIC0tdG90YWwgfHwgcGF1c2UoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIGlmICghdGhpcy53cml0YWJsZSkge1xuXHQgICAgICBkZWJ1ZyQzKCd3ZSBhcmUgY3VycmVudGx5IHdyaXRpbmcgLSB3YWl0aW5nIHRvIHBhdXNlJyk7XG5cdCAgICAgIHRvdGFsKys7XG5cdCAgICAgIHRoaXMub25jZSgnZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgZGVidWckMygncHJlLXBhdXNlIHdyaXRpbmcgY29tcGxldGUnKTtcblx0ICAgICAgICAtLXRvdGFsIHx8IHBhdXNlKCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0gZWxzZSB7XG5cdCAgICBwYXVzZSgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogU3RhcnRzIHBvbGxpbmcgY3ljbGUuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLnBvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckMygncG9sbGluZycpO1xuXHQgIHRoaXMucG9sbGluZyA9IHRydWU7XG5cdCAgdGhpcy5kb1BvbGwoKTtcblx0ICB0aGlzLmVtaXQoJ3BvbGwnKTtcblx0fTtcblxuXHQvKipcblx0ICogT3ZlcmxvYWRzIG9uRGF0YSB0byBkZXRlY3QgcGF5bG9hZHMuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBkZWJ1ZyQzKCdwb2xsaW5nIGdvdCBkYXRhICVzJywgZGF0YSk7XG5cdCAgdmFyIGNhbGxiYWNrID0gZnVuY3Rpb24gY2FsbGJhY2socGFja2V0LCBpbmRleCwgdG90YWwpIHtcblx0ICAgIC8vIGlmIGl0cyB0aGUgZmlyc3QgbWVzc2FnZSB3ZSBjb25zaWRlciB0aGUgdHJhbnNwb3J0IG9wZW5cblx0ICAgIGlmICgnb3BlbmluZycgPT09IHNlbGYucmVhZHlTdGF0ZSkge1xuXHQgICAgICBzZWxmLm9uT3BlbigpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBpZiBpdHMgYSBjbG9zZSBwYWNrZXQsIHdlIGNsb3NlIHRoZSBvbmdvaW5nIHJlcXVlc3RzXG5cdCAgICBpZiAoJ2Nsb3NlJyA9PT0gcGFja2V0LnR5cGUpIHtcblx0ICAgICAgc2VsZi5vbkNsb3NlKCk7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgLy8gb3RoZXJ3aXNlIGJ5cGFzcyBvbkRhdGEgYW5kIGhhbmRsZSB0aGUgbWVzc2FnZVxuXHQgICAgc2VsZi5vblBhY2tldChwYWNrZXQpO1xuXHQgIH07XG5cblx0ICAvLyBkZWNvZGUgcGF5bG9hZFxuXHQgIHBhcnNlci5kZWNvZGVQYXlsb2FkKGRhdGEsIHRoaXMuc29ja2V0LmJpbmFyeVR5cGUsIGNhbGxiYWNrKTtcblxuXHQgIC8vIGlmIGFuIGV2ZW50IGRpZCBub3QgdHJpZ2dlciBjbG9zaW5nXG5cdCAgaWYgKCdjbG9zZWQnICE9PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIC8vIGlmIHdlIGdvdCBkYXRhIHdlJ3JlIG5vdCBwb2xsaW5nXG5cdCAgICB0aGlzLnBvbGxpbmcgPSBmYWxzZTtcblx0ICAgIHRoaXMuZW1pdCgncG9sbENvbXBsZXRlJyk7XG5cblx0ICAgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgICB0aGlzLnBvbGwoKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGRlYnVnJDMoJ2lnbm9yaW5nIHBvbGwgLSB0cmFuc3BvcnQgc3RhdGUgXCIlc1wiJywgdGhpcy5yZWFkeVN0YXRlKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEZvciBwb2xsaW5nLCBzZW5kIGEgY2xvc2UgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUuZG9DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBmdW5jdGlvbiBjbG9zZSgpIHtcblx0ICAgIGRlYnVnJDMoJ3dyaXRpbmcgY2xvc2UgcGFja2V0Jyk7XG5cdCAgICBzZWxmLndyaXRlKFt7IHR5cGU6ICdjbG9zZScgfV0pO1xuXHQgIH1cblxuXHQgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgZGVidWckMygndHJhbnNwb3J0IG9wZW4gLSBjbG9zaW5nJyk7XG5cdCAgICBjbG9zZSgpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAvLyBpbiBjYXNlIHdlJ3JlIHRyeWluZyB0byBjbG9zZSB3aGlsZVxuXHQgICAgLy8gaGFuZHNoYWtpbmcgaXMgaW4gcHJvZ3Jlc3MgKEdILTE2NClcblx0ICAgIGRlYnVnJDMoJ3RyYW5zcG9ydCBub3Qgb3BlbiAtIGRlZmVycmluZyBjbG9zZScpO1xuXHQgICAgdGhpcy5vbmNlKCdvcGVuJywgY2xvc2UpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogV3JpdGVzIGEgcGFja2V0cyBwYXlsb2FkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fSBkYXRhIHBhY2tldHNcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gZHJhaW4gY2FsbGJhY2tcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHBhY2tldHMpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXHQgIHZhciBjYWxsYmFja2ZuID0gZnVuY3Rpb24gY2FsbGJhY2tmbigpIHtcblx0ICAgIHNlbGYud3JpdGFibGUgPSB0cnVlO1xuXHQgICAgc2VsZi5lbWl0KCdkcmFpbicpO1xuXHQgIH07XG5cblx0ICBwYXJzZXIuZW5jb2RlUGF5bG9hZChwYWNrZXRzLCB0aGlzLnN1cHBvcnRzQmluYXJ5LCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgc2VsZi5kb1dyaXRlKGRhdGEsIGNhbGxiYWNrZm4pO1xuXHQgIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgdXJpIGZvciBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUudXJpID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBxdWVyeSA9IHRoaXMucXVlcnkgfHwge307XG5cdCAgdmFyIHNjaGVtYSA9IHRoaXMuc2VjdXJlID8gJ2h0dHBzJyA6ICdodHRwJztcblx0ICB2YXIgcG9ydCA9ICcnO1xuXG5cdCAgLy8gY2FjaGUgYnVzdGluZyBpcyBmb3JjZWRcblx0ICBpZiAoZmFsc2UgIT09IHRoaXMudGltZXN0YW1wUmVxdWVzdHMpIHtcblx0ICAgIHF1ZXJ5W3RoaXMudGltZXN0YW1wUGFyYW1dID0geWVhc3QkMigpO1xuXHQgIH1cblxuXHQgIGlmICghdGhpcy5zdXBwb3J0c0JpbmFyeSAmJiAhcXVlcnkuc2lkKSB7XG5cdCAgICBxdWVyeS5iNjQgPSAxO1xuXHQgIH1cblxuXHQgIHF1ZXJ5ID0gcGFyc2VxcyQyLmVuY29kZShxdWVyeSk7XG5cblx0ICAvLyBhdm9pZCBwb3J0IGlmIGRlZmF1bHQgZm9yIHNjaGVtYVxuXHQgIGlmICh0aGlzLnBvcnQgJiYgKCdodHRwcycgPT09IHNjaGVtYSAmJiBOdW1iZXIodGhpcy5wb3J0KSAhPT0gNDQzIHx8ICdodHRwJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA4MCkpIHtcblx0ICAgIHBvcnQgPSAnOicgKyB0aGlzLnBvcnQ7XG5cdCAgfVxuXG5cdCAgLy8gcHJlcGVuZCA/IHRvIHF1ZXJ5XG5cdCAgaWYgKHF1ZXJ5Lmxlbmd0aCkge1xuXHQgICAgcXVlcnkgPSAnPycgKyBxdWVyeTtcblx0ICB9XG5cblx0ICB2YXIgaXB2NiA9IHRoaXMuaG9zdG5hbWUuaW5kZXhPZignOicpICE9PSAtMTtcblx0ICByZXR1cm4gc2NoZW1hICsgJzovLycgKyAoaXB2NiA/ICdbJyArIHRoaXMuaG9zdG5hbWUgKyAnXScgOiB0aGlzLmhvc3RuYW1lKSArIHBvcnQgKyB0aGlzLnBhdGggKyBxdWVyeTtcblx0fTtcblxuXHR2YXIgcG9sbGluZyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmcsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwb2xsaW5nXG5cdH0pO1xuXG5cdHZhciBQb2xsaW5nJDEgPSAoIHBvbGxpbmckMSAmJiBwb2xsaW5nICkgfHwgcG9sbGluZyQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgcmVxdWlyZW1lbnRzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNCA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDpwb2xsaW5nLXhocicpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmdYaHIgPSBYSFI7XG5cdHZhciBSZXF1ZXN0XzEgPSBSZXF1ZXN0O1xuXG5cdC8qKlxuXHQgKiBFbXB0eSBmdW5jdGlvblxuXHQgKi9cblxuXHRmdW5jdGlvbiBlbXB0eSgpIHt9XG5cblx0LyoqXG5cdCAqIFhIUiBQb2xsaW5nIGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBYSFIob3B0cykge1xuXHQgIFBvbGxpbmckMS5jYWxsKHRoaXMsIG9wdHMpO1xuXHQgIHRoaXMucmVxdWVzdFRpbWVvdXQgPSBvcHRzLnJlcXVlc3RUaW1lb3V0O1xuXHQgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwubG9jYXRpb24pIHtcblx0ICAgIHZhciBpc1NTTCA9ICdodHRwczonID09PSBsb2NhdGlvbi5wcm90b2NvbDtcblx0ICAgIHZhciBwb3J0ID0gbG9jYXRpb24ucG9ydDtcblxuXHQgICAgLy8gc29tZSB1c2VyIGFnZW50cyBoYXZlIGVtcHR5IGBsb2NhdGlvbi5wb3J0YFxuXHQgICAgaWYgKCFwb3J0KSB7XG5cdCAgICAgIHBvcnQgPSBpc1NTTCA/IDQ0MyA6IDgwO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLnhkID0gb3B0cy5ob3N0bmFtZSAhPT0gY29tbW9uanNHbG9iYWwubG9jYXRpb24uaG9zdG5hbWUgfHwgcG9ydCAhPT0gb3B0cy5wb3J0O1xuXHQgICAgdGhpcy54cyA9IG9wdHMuc2VjdXJlICE9PSBpc1NTTDtcblx0ICB9XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBQb2xsaW5nLlxuXHQgKi9cblxuXHRpbmhlcml0KFhIUiwgUG9sbGluZyQxKTtcblxuXHQvKipcblx0ICogWEhSIHN1cHBvcnRzIGJpbmFyeVxuXHQgKi9cblxuXHRYSFIucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5ID0gdHJ1ZTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2Rcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uIChvcHRzKSB7XG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cdCAgb3B0cy51cmkgPSB0aGlzLnVyaSgpO1xuXHQgIG9wdHMueGQgPSB0aGlzLnhkO1xuXHQgIG9wdHMueHMgPSB0aGlzLnhzO1xuXHQgIG9wdHMuYWdlbnQgPSB0aGlzLmFnZW50IHx8IGZhbHNlO1xuXHQgIG9wdHMuc3VwcG9ydHNCaW5hcnkgPSB0aGlzLnN1cHBvcnRzQmluYXJ5O1xuXHQgIG9wdHMuZW5hYmxlc1hEUiA9IHRoaXMuZW5hYmxlc1hEUjtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIG9wdHMucGZ4ID0gdGhpcy5wZng7XG5cdCAgb3B0cy5rZXkgPSB0aGlzLmtleTtcblx0ICBvcHRzLnBhc3NwaHJhc2UgPSB0aGlzLnBhc3NwaHJhc2U7XG5cdCAgb3B0cy5jZXJ0ID0gdGhpcy5jZXJ0O1xuXHQgIG9wdHMuY2EgPSB0aGlzLmNhO1xuXHQgIG9wdHMuY2lwaGVycyA9IHRoaXMuY2lwaGVycztcblx0ICBvcHRzLnJlamVjdFVuYXV0aG9yaXplZCA9IHRoaXMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIG9wdHMucmVxdWVzdFRpbWVvdXQgPSB0aGlzLnJlcXVlc3RUaW1lb3V0O1xuXG5cdCAgLy8gb3RoZXIgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLmV4dHJhSGVhZGVycyA9IHRoaXMuZXh0cmFIZWFkZXJzO1xuXG5cdCAgcmV0dXJuIG5ldyBSZXF1ZXN0KG9wdHMpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGF0YSB0byBzZW5kLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsZWQgdXBvbiBmbHVzaC5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUuZG9Xcml0ZSA9IGZ1bmN0aW9uIChkYXRhLCBmbikge1xuXHQgIHZhciBpc0JpbmFyeSA9IHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJyAmJiBkYXRhICE9PSB1bmRlZmluZWQ7XG5cdCAgdmFyIHJlcSA9IHRoaXMucmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCBkYXRhOiBkYXRhLCBpc0JpbmFyeTogaXNCaW5hcnkgfSk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHJlcS5vbignc3VjY2VzcycsIGZuKTtcblx0ICByZXEub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVycikge1xuXHQgICAgc2VsZi5vbkVycm9yKCd4aHIgcG9zdCBlcnJvcicsIGVycik7XG5cdCAgfSk7XG5cdCAgdGhpcy5zZW5kWGhyID0gcmVxO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgYSBwb2xsIGN5Y2xlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0WEhSLnByb3RvdHlwZS5kb1BvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNCgneGhyIHBvbGwnKTtcblx0ICB2YXIgcmVxID0gdGhpcy5yZXF1ZXN0KCk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHJlcS5vbignZGF0YScsIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICBzZWxmLm9uRGF0YShkYXRhKTtcblx0ICB9KTtcblx0ICByZXEub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVycikge1xuXHQgICAgc2VsZi5vbkVycm9yKCd4aHIgcG9sbCBlcnJvcicsIGVycik7XG5cdCAgfSk7XG5cdCAgdGhpcy5wb2xsWGhyID0gcmVxO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGNvbnN0cnVjdG9yXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFJlcXVlc3Qob3B0cykge1xuXHQgIHRoaXMubWV0aG9kID0gb3B0cy5tZXRob2QgfHwgJ0dFVCc7XG5cdCAgdGhpcy51cmkgPSBvcHRzLnVyaTtcblx0ICB0aGlzLnhkID0gISFvcHRzLnhkO1xuXHQgIHRoaXMueHMgPSAhIW9wdHMueHM7XG5cdCAgdGhpcy5hc3luYyA9IGZhbHNlICE9PSBvcHRzLmFzeW5jO1xuXHQgIHRoaXMuZGF0YSA9IHVuZGVmaW5lZCAhPT0gb3B0cy5kYXRhID8gb3B0cy5kYXRhIDogbnVsbDtcblx0ICB0aGlzLmFnZW50ID0gb3B0cy5hZ2VudDtcblx0ICB0aGlzLmlzQmluYXJ5ID0gb3B0cy5pc0JpbmFyeTtcblx0ICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gb3B0cy5zdXBwb3J0c0JpbmFyeTtcblx0ICB0aGlzLmVuYWJsZXNYRFIgPSBvcHRzLmVuYWJsZXNYRFI7XG5cdCAgdGhpcy5yZXF1ZXN0VGltZW91dCA9IG9wdHMucmVxdWVzdFRpbWVvdXQ7XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLnBmeCA9IG9wdHMucGZ4O1xuXHQgIHRoaXMua2V5ID0gb3B0cy5rZXk7XG5cdCAgdGhpcy5wYXNzcGhyYXNlID0gb3B0cy5wYXNzcGhyYXNlO1xuXHQgIHRoaXMuY2VydCA9IG9wdHMuY2VydDtcblx0ICB0aGlzLmNhID0gb3B0cy5jYTtcblx0ICB0aGlzLmNpcGhlcnMgPSBvcHRzLmNpcGhlcnM7XG5cdCAgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQgPSBvcHRzLnJlamVjdFVuYXV0aG9yaXplZDtcblxuXHQgIC8vIG90aGVyIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5leHRyYUhlYWRlcnMgPSBvcHRzLmV4dHJhSGVhZGVycztcblxuXHQgIHRoaXMuY3JlYXRlKCk7XG5cdH1cblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihSZXF1ZXN0LnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdGhlIFhIUiBvYmplY3QgYW5kIHNlbmRzIHRoZSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBvcHRzID0geyBhZ2VudDogdGhpcy5hZ2VudCwgeGRvbWFpbjogdGhpcy54ZCwgeHNjaGVtZTogdGhpcy54cywgZW5hYmxlc1hEUjogdGhpcy5lbmFibGVzWERSIH07XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLnBmeCA9IHRoaXMucGZ4O1xuXHQgIG9wdHMua2V5ID0gdGhpcy5rZXk7XG5cdCAgb3B0cy5wYXNzcGhyYXNlID0gdGhpcy5wYXNzcGhyYXNlO1xuXHQgIG9wdHMuY2VydCA9IHRoaXMuY2VydDtcblx0ICBvcHRzLmNhID0gdGhpcy5jYTtcblx0ICBvcHRzLmNpcGhlcnMgPSB0aGlzLmNpcGhlcnM7XG5cdCAgb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPSB0aGlzLnJlamVjdFVuYXV0aG9yaXplZDtcblxuXHQgIHZhciB4aHIgPSB0aGlzLnhociA9IG5ldyByZXF1aXJlJCQxKG9wdHMpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIHRyeSB7XG5cdCAgICBkZWJ1ZyQ0KCd4aHIgb3BlbiAlczogJXMnLCB0aGlzLm1ldGhvZCwgdGhpcy51cmkpO1xuXHQgICAgeGhyLm9wZW4odGhpcy5tZXRob2QsIHRoaXMudXJpLCB0aGlzLmFzeW5jKTtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGlmICh0aGlzLmV4dHJhSGVhZGVycykge1xuXHQgICAgICAgIHhoci5zZXREaXNhYmxlSGVhZGVyQ2hlY2sgJiYgeGhyLnNldERpc2FibGVIZWFkZXJDaGVjayh0cnVlKTtcblx0ICAgICAgICBmb3IgKHZhciBpIGluIHRoaXMuZXh0cmFIZWFkZXJzKSB7XG5cdCAgICAgICAgICBpZiAodGhpcy5leHRyYUhlYWRlcnMuaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoaSwgdGhpcy5leHRyYUhlYWRlcnNbaV0pO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSBjYXRjaCAoZSkge31cblxuXHQgICAgaWYgKCdQT1NUJyA9PT0gdGhpcy5tZXRob2QpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBpZiAodGhpcy5pc0JpbmFyeSkge1xuXHQgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgICB9XG5cblx0ICAgIHRyeSB7XG5cdCAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnKi8qJyk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgICAvLyBpZTYgY2hlY2tcblx0ICAgIGlmICgnd2l0aENyZWRlbnRpYWxzJyBpbiB4aHIpIHtcblx0ICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLnJlcXVlc3RUaW1lb3V0KSB7XG5cdCAgICAgIHhoci50aW1lb3V0ID0gdGhpcy5yZXF1ZXN0VGltZW91dDtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRoaXMuaGFzWERSKCkpIHtcblx0ICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBzZWxmLm9uTG9hZCgpO1xuXHQgICAgICB9O1xuXHQgICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBzZWxmLm9uRXJyb3IoeGhyLnJlc3BvbnNlVGV4dCk7XG5cdCAgICAgIH07XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gMikge1xuXHQgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKTtcblx0ICAgICAgICAgICAgaWYgKHNlbGYuc3VwcG9ydHNCaW5hcnkgJiYgY29udGVudFR5cGUgPT09ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKSB7XG5cdCAgICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgICAgICAgfVxuXHQgICAgICAgIGlmICg0ICE9PSB4aHIucmVhZHlTdGF0ZSkgcmV0dXJuO1xuXHQgICAgICAgIGlmICgyMDAgPT09IHhoci5zdGF0dXMgfHwgMTIyMyA9PT0geGhyLnN0YXR1cykge1xuXHQgICAgICAgICAgc2VsZi5vbkxvYWQoKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgLy8gbWFrZSBzdXJlIHRoZSBgZXJyb3JgIGV2ZW50IGhhbmRsZXIgdGhhdCdzIHVzZXItc2V0XG5cdCAgICAgICAgICAvLyBkb2VzIG5vdCB0aHJvdyBpbiB0aGUgc2FtZSB0aWNrIGFuZCBnZXRzIGNhdWdodCBoZXJlXG5cdCAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgc2VsZi5vbkVycm9yKHhoci5zdGF0dXMpO1xuXHQgICAgICAgICAgfSwgMCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICBkZWJ1ZyQ0KCd4aHIgZGF0YSAlcycsIHRoaXMuZGF0YSk7XG5cdCAgICB4aHIuc2VuZCh0aGlzLmRhdGEpO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIC8vIE5lZWQgdG8gZGVmZXIgc2luY2UgLmNyZWF0ZSgpIGlzIGNhbGxlZCBkaXJlY3RseSBmaHJvbSB0aGUgY29uc3RydWN0b3Jcblx0ICAgIC8vIGFuZCB0aHVzIHRoZSAnZXJyb3InIGV2ZW50IGNhbiBvbmx5IGJlIG9ubHkgYm91bmQgKmFmdGVyKiB0aGlzIGV4Y2VwdGlvblxuXHQgICAgLy8gb2NjdXJzLiAgVGhlcmVmb3JlLCBhbHNvLCB3ZSBjYW5ub3QgdGhyb3cgaGVyZSBhdCBhbGwuXG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi5vbkVycm9yKGUpO1xuXHQgICAgfSwgMCk7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmRvY3VtZW50KSB7XG5cdCAgICB0aGlzLmluZGV4ID0gUmVxdWVzdC5yZXF1ZXN0c0NvdW50Kys7XG5cdCAgICBSZXF1ZXN0LnJlcXVlc3RzW3RoaXMuaW5kZXhdID0gdGhpcztcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHN1Y2Nlc3NmdWwgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vblN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5lbWl0KCdzdWNjZXNzJyk7XG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCBpZiB3ZSBoYXZlIGRhdGEuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHRoaXMuZW1pdCgnZGF0YScsIGRhdGEpO1xuXHQgIHRoaXMub25TdWNjZXNzKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGVycm9yLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblx0ICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLmNsZWFudXAodHJ1ZSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsZWFucyB1cCBob3VzZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLmNsZWFudXAgPSBmdW5jdGlvbiAoZnJvbUVycm9yKSB7XG5cdCAgaWYgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGhpcy54aHIgfHwgbnVsbCA9PT0gdGhpcy54aHIpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cdCAgLy8geG1saHR0cHJlcXVlc3Rcblx0ICBpZiAodGhpcy5oYXNYRFIoKSkge1xuXHQgICAgdGhpcy54aHIub25sb2FkID0gdGhpcy54aHIub25lcnJvciA9IGVtcHR5O1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLnhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbXB0eTtcblx0ICB9XG5cblx0ICBpZiAoZnJvbUVycm9yKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICB0aGlzLnhoci5hYm9ydCgpO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICB9XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQpIHtcblx0ICAgIGRlbGV0ZSBSZXF1ZXN0LnJlcXVlc3RzW3RoaXMuaW5kZXhdO1xuXHQgIH1cblxuXHQgIHRoaXMueGhyID0gbnVsbDtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gbG9hZC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLm9uTG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgZGF0YTtcblx0ICB0cnkge1xuXHQgICAgdmFyIGNvbnRlbnRUeXBlO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgY29udGVudFR5cGUgPSB0aGlzLnhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1UeXBlJyk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgICAgaWYgKGNvbnRlbnRUeXBlID09PSAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJykge1xuXHQgICAgICBkYXRhID0gdGhpcy54aHIucmVzcG9uc2UgfHwgdGhpcy54aHIucmVzcG9uc2VUZXh0O1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgZGF0YSA9IHRoaXMueGhyLnJlc3BvbnNlVGV4dDtcblx0ICAgIH1cblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICB0aGlzLm9uRXJyb3IoZSk7XG5cdCAgfVxuXHQgIGlmIChudWxsICE9IGRhdGEpIHtcblx0ICAgIHRoaXMub25EYXRhKGRhdGEpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgaXQgaGFzIFhEb21haW5SZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuaGFzWERSID0gZnVuY3Rpb24gKCkge1xuXHQgIHJldHVybiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLlhEb21haW5SZXF1ZXN0ICYmICF0aGlzLnhzICYmIHRoaXMuZW5hYmxlc1hEUjtcblx0fTtcblxuXHQvKipcblx0ICogQWJvcnRzIHRoZSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmNsZWFudXAoKTtcblx0fTtcblxuXHQvKipcblx0ICogQWJvcnRzIHBlbmRpbmcgcmVxdWVzdHMgd2hlbiB1bmxvYWRpbmcgdGhlIHdpbmRvdy4gVGhpcyBpcyBuZWVkZWQgdG8gcHJldmVudFxuXHQgKiBtZW1vcnkgbGVha3MgKGUuZy4gd2hlbiB1c2luZyBJRSkgYW5kIHRvIGVuc3VyZSB0aGF0IG5vIHNwdXJpb3VzIGVycm9yIGlzXG5cdCAqIGVtaXR0ZWQuXG5cdCAqL1xuXG5cdFJlcXVlc3QucmVxdWVzdHNDb3VudCA9IDA7XG5cdFJlcXVlc3QucmVxdWVzdHMgPSB7fTtcblxuXHRpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQpIHtcblx0ICBpZiAoY29tbW9uanNHbG9iYWwuYXR0YWNoRXZlbnQpIHtcblx0ICAgIGNvbW1vbmpzR2xvYmFsLmF0dGFjaEV2ZW50KCdvbnVubG9hZCcsIHVubG9hZEhhbmRsZXIpO1xuXHQgIH0gZWxzZSBpZiAoY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHQgICAgY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgdW5sb2FkSGFuZGxlciwgZmFsc2UpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIHVubG9hZEhhbmRsZXIoKSB7XG5cdCAgZm9yICh2YXIgaSBpbiBSZXF1ZXN0LnJlcXVlc3RzKSB7XG5cdCAgICBpZiAoUmVxdWVzdC5yZXF1ZXN0cy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHQgICAgICBSZXF1ZXN0LnJlcXVlc3RzW2ldLmFib3J0KCk7XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cdHBvbGxpbmdYaHIuUmVxdWVzdCA9IFJlcXVlc3RfMTtcblxuXHR2YXIgcG9sbGluZ1hociQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmdYaHIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwb2xsaW5nWGhyLFxuXHRcdFJlcXVlc3Q6IFJlcXVlc3RfMVxuXHR9KTtcblxuXHQvKipcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50cy5cblx0ICovXG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgcG9sbGluZ0pzb25wID0gSlNPTlBQb2xsaW5nO1xuXG5cdC8qKlxuXHQgKiBDYWNoZWQgcmVndWxhciBleHByZXNzaW9ucy5cblx0ICovXG5cblx0dmFyIHJOZXdsaW5lID0gL1xcbi9nO1xuXHR2YXIgckVzY2FwZWROZXdsaW5lID0gL1xcXFxuL2c7XG5cblx0LyoqXG5cdCAqIEdsb2JhbCBKU09OUCBjYWxsYmFja3MuXG5cdCAqL1xuXG5cdHZhciBjYWxsYmFja3M7XG5cblx0LyoqXG5cdCAqIE5vb3AuXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGVtcHR5JDEoKSB7fVxuXG5cdC8qKlxuXHQgKiBKU09OUCBQb2xsaW5nIGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0cy5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gSlNPTlBQb2xsaW5nKG9wdHMpIHtcblx0ICBQb2xsaW5nJDEuY2FsbCh0aGlzLCBvcHRzKTtcblxuXHQgIHRoaXMucXVlcnkgPSB0aGlzLnF1ZXJ5IHx8IHt9O1xuXG5cdCAgLy8gZGVmaW5lIGdsb2JhbCBjYWxsYmFja3MgYXJyYXkgaWYgbm90IHByZXNlbnRcblx0ICAvLyB3ZSBkbyB0aGlzIGhlcmUgKGxhemlseSkgdG8gYXZvaWQgdW5uZWVkZWQgZ2xvYmFsIHBvbGx1dGlvblxuXHQgIGlmICghY2FsbGJhY2tzKSB7XG5cdCAgICAvLyB3ZSBuZWVkIHRvIGNvbnNpZGVyIG11bHRpcGxlIGVuZ2luZXMgaW4gdGhlIHNhbWUgcGFnZVxuXHQgICAgaWYgKCFjb21tb25qc0dsb2JhbC5fX19laW8pIGNvbW1vbmpzR2xvYmFsLl9fX2VpbyA9IFtdO1xuXHQgICAgY2FsbGJhY2tzID0gY29tbW9uanNHbG9iYWwuX19fZWlvO1xuXHQgIH1cblxuXHQgIC8vIGNhbGxiYWNrIGlkZW50aWZpZXJcblx0ICB0aGlzLmluZGV4ID0gY2FsbGJhY2tzLmxlbmd0aDtcblxuXHQgIC8vIGFkZCBjYWxsYmFjayB0byBqc29ucCBnbG9iYWxcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgY2FsbGJhY2tzLnB1c2goZnVuY3Rpb24gKG1zZykge1xuXHQgICAgc2VsZi5vbkRhdGEobXNnKTtcblx0ICB9KTtcblxuXHQgIC8vIGFwcGVuZCB0byBxdWVyeSBzdHJpbmdcblx0ICB0aGlzLnF1ZXJ5LmogPSB0aGlzLmluZGV4O1xuXG5cdCAgLy8gcHJldmVudCBzcHVyaW91cyBlcnJvcnMgZnJvbSBiZWluZyBlbWl0dGVkIHdoZW4gdGhlIHdpbmRvdyBpcyB1bmxvYWRlZFxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5kb2N1bWVudCAmJiBjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG5cdCAgICBjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmIChzZWxmLnNjcmlwdCkgc2VsZi5zY3JpcHQub25lcnJvciA9IGVtcHR5JDE7XG5cdCAgICB9LCBmYWxzZSk7XG5cdCAgfVxuXHR9XG5cblx0LyoqXG5cdCAqIEluaGVyaXRzIGZyb20gUG9sbGluZy5cblx0ICovXG5cblx0aW5oZXJpdChKU09OUFBvbGxpbmcsIFBvbGxpbmckMSk7XG5cblx0Lypcblx0ICogSlNPTlAgb25seSBzdXBwb3J0cyBiaW5hcnkgYXMgYmFzZTY0IGVuY29kZWQgc3RyaW5nc1xuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIENsb3NlcyB0aGUgc29ja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0SlNPTlBQb2xsaW5nLnByb3RvdHlwZS5kb0Nsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnNjcmlwdCkge1xuXHQgICAgdGhpcy5zY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLnNjcmlwdCk7XG5cdCAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cdCAgfVxuXG5cdCAgaWYgKHRoaXMuZm9ybSkge1xuXHQgICAgdGhpcy5mb3JtLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5mb3JtKTtcblx0ICAgIHRoaXMuZm9ybSA9IG51bGw7XG5cdCAgICB0aGlzLmlmcmFtZSA9IG51bGw7XG5cdCAgfVxuXG5cdCAgUG9sbGluZyQxLnByb3RvdHlwZS5kb0Nsb3NlLmNhbGwodGhpcyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyBhIHBvbGwgY3ljbGUuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLmRvUG9sbCA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXG5cdCAgaWYgKHRoaXMuc2NyaXB0KSB7XG5cdCAgICB0aGlzLnNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuc2NyaXB0KTtcblx0ICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblx0ICB9XG5cblx0ICBzY3JpcHQuYXN5bmMgPSB0cnVlO1xuXHQgIHNjcmlwdC5zcmMgPSB0aGlzLnVyaSgpO1xuXHQgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgIHNlbGYub25FcnJvcignanNvbnAgcG9sbCBlcnJvcicsIGUpO1xuXHQgIH07XG5cblx0ICB2YXIgaW5zZXJ0QXQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylbMF07XG5cdCAgaWYgKGluc2VydEF0KSB7XG5cdCAgICBpbnNlcnRBdC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShzY3JpcHQsIGluc2VydEF0KTtcblx0ICB9IGVsc2Uge1xuXHQgICAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuYm9keSkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblx0ICB9XG5cdCAgdGhpcy5zY3JpcHQgPSBzY3JpcHQ7XG5cblx0ICB2YXIgaXNVQWdlY2tvID0gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBuYXZpZ2F0b3IgJiYgL2dlY2tvL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXHQgIGlmIChpc1VBZ2Vja28pIHtcblx0ICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICB2YXIgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG5cdCAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcblx0ICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuXHQgICAgfSwgMTAwKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyB3aXRoIGEgaGlkZGVuIGlmcmFtZS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGEgdG8gc2VuZFxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsZWQgdXBvbiBmbHVzaC5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdEpTT05QUG9sbGluZy5wcm90b3R5cGUuZG9Xcml0ZSA9IGZ1bmN0aW9uIChkYXRhLCBmbikge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGlmICghdGhpcy5mb3JtKSB7XG5cdCAgICB2YXIgZm9ybSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zvcm0nKTtcblx0ICAgIHZhciBhcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcblx0ICAgIHZhciBpZCA9IHRoaXMuaWZyYW1lSWQgPSAnZWlvX2lmcmFtZV8nICsgdGhpcy5pbmRleDtcblx0ICAgIHZhciBpZnJhbWU7XG5cblx0ICAgIGZvcm0uY2xhc3NOYW1lID0gJ3NvY2tldGlvJztcblx0ICAgIGZvcm0uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHQgICAgZm9ybS5zdHlsZS50b3AgPSAnLTEwMDBweCc7XG5cdCAgICBmb3JtLnN0eWxlLmxlZnQgPSAnLTEwMDBweCc7XG5cdCAgICBmb3JtLnRhcmdldCA9IGlkO1xuXHQgICAgZm9ybS5tZXRob2QgPSAnUE9TVCc7XG5cdCAgICBmb3JtLnNldEF0dHJpYnV0ZSgnYWNjZXB0LWNoYXJzZXQnLCAndXRmLTgnKTtcblx0ICAgIGFyZWEubmFtZSA9ICdkJztcblx0ICAgIGZvcm0uYXBwZW5kQ2hpbGQoYXJlYSk7XG5cdCAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGZvcm0pO1xuXG5cdCAgICB0aGlzLmZvcm0gPSBmb3JtO1xuXHQgICAgdGhpcy5hcmVhID0gYXJlYTtcblx0ICB9XG5cblx0ICB0aGlzLmZvcm0uYWN0aW9uID0gdGhpcy51cmkoKTtcblxuXHQgIGZ1bmN0aW9uIGNvbXBsZXRlKCkge1xuXHQgICAgaW5pdElmcmFtZSgpO1xuXHQgICAgZm4oKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpbml0SWZyYW1lKCkge1xuXHQgICAgaWYgKHNlbGYuaWZyYW1lKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgc2VsZi5mb3JtLnJlbW92ZUNoaWxkKHNlbGYuaWZyYW1lKTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIHNlbGYub25FcnJvcignanNvbnAgcG9sbGluZyBpZnJhbWUgcmVtb3ZhbCBlcnJvcicsIGUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHRyeSB7XG5cdCAgICAgIC8vIGllNiBkeW5hbWljIGlmcmFtZXMgd2l0aCB0YXJnZXQ9XCJcIiBzdXBwb3J0ICh0aGFua3MgQ2hyaXMgTGFtYmFjaGVyKVxuXHQgICAgICB2YXIgaHRtbCA9ICc8aWZyYW1lIHNyYz1cImphdmFzY3JpcHQ6MFwiIG5hbWU9XCInICsgc2VsZi5pZnJhbWVJZCArICdcIj4nO1xuXHQgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGh0bWwpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcblx0ICAgICAgaWZyYW1lLm5hbWUgPSBzZWxmLmlmcmFtZUlkO1xuXHQgICAgICBpZnJhbWUuc3JjID0gJ2phdmFzY3JpcHQ6MCc7XG5cdCAgICB9XG5cblx0ICAgIGlmcmFtZS5pZCA9IHNlbGYuaWZyYW1lSWQ7XG5cblx0ICAgIHNlbGYuZm9ybS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuXHQgICAgc2VsZi5pZnJhbWUgPSBpZnJhbWU7XG5cdCAgfVxuXG5cdCAgaW5pdElmcmFtZSgpO1xuXG5cdCAgLy8gZXNjYXBlIFxcbiB0byBwcmV2ZW50IGl0IGZyb20gYmVpbmcgY29udmVydGVkIGludG8gXFxyXFxuIGJ5IHNvbWUgVUFzXG5cdCAgLy8gZG91YmxlIGVzY2FwaW5nIGlzIHJlcXVpcmVkIGZvciBlc2NhcGVkIG5ldyBsaW5lcyBiZWNhdXNlIHVuZXNjYXBpbmcgb2YgbmV3IGxpbmVzIGNhbiBiZSBkb25lIHNhZmVseSBvbiBzZXJ2ZXItc2lkZVxuXHQgIGRhdGEgPSBkYXRhLnJlcGxhY2UockVzY2FwZWROZXdsaW5lLCAnXFxcXFxcbicpO1xuXHQgIHRoaXMuYXJlYS52YWx1ZSA9IGRhdGEucmVwbGFjZShyTmV3bGluZSwgJ1xcXFxuJyk7XG5cblx0ICB0cnkge1xuXHQgICAgdGhpcy5mb3JtLnN1Ym1pdCgpO1xuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICBpZiAodGhpcy5pZnJhbWUuYXR0YWNoRXZlbnQpIHtcblx0ICAgIHRoaXMuaWZyYW1lLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHNlbGYuaWZyYW1lLnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScpIHtcblx0ICAgICAgICBjb21wbGV0ZSgpO1xuXHQgICAgICB9XG5cdCAgICB9O1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLmlmcmFtZS5vbmxvYWQgPSBjb21wbGV0ZTtcblx0ICB9XG5cdH07XG5cblx0dmFyIHBvbGxpbmdKc29ucCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmdKc29ucCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBvbGxpbmdKc29ucFxuXHR9KTtcblxuXHR2YXIgZW1wdHkkMiA9IHt9O1xuXG5cdHZhciBlbXB0eSQzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGVtcHR5JDJcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDEkMSA9ICggZW1wdHkkMyAmJiBlbXB0eSQyICkgfHwgZW1wdHkkMztcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDUgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6d2Vic29ja2V0Jyk7XG5cdHZhciBCcm93c2VyV2ViU29ja2V0ID0gY29tbW9uanNHbG9iYWwuV2ViU29ja2V0IHx8IGNvbW1vbmpzR2xvYmFsLk1veldlYlNvY2tldDtcblx0dmFyIE5vZGVXZWJTb2NrZXQ7XG5cdGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuXHQgIHRyeSB7XG5cdCAgICBOb2RlV2ViU29ja2V0ID0gcmVxdWlyZSQkMSQxO1xuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGVpdGhlciB0aGUgYFdlYlNvY2tldGAgb3IgYE1veldlYlNvY2tldGAgZ2xvYmFsc1xuXHQgKiBpbiB0aGUgYnJvd3NlciBvciB0cnkgdG8gcmVzb2x2ZSBXZWJTb2NrZXQtY29tcGF0aWJsZVxuXHQgKiBpbnRlcmZhY2UgZXhwb3NlZCBieSBgd3NgIGZvciBOb2RlLWxpa2UgZW52aXJvbm1lbnQuXG5cdCAqL1xuXG5cdHZhciBXZWJTb2NrZXQgPSBCcm93c2VyV2ViU29ja2V0O1xuXHRpZiAoIVdlYlNvY2tldCAmJiB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuXHQgIFdlYlNvY2tldCA9IE5vZGVXZWJTb2NrZXQ7XG5cdH1cblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB3ZWJzb2NrZXQgPSBXUztcblxuXHQvKipcblx0ICogV2ViU29ja2V0IHRyYW5zcG9ydCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQGFwaSB7T2JqZWN0fSBjb25uZWN0aW9uIG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gV1Mob3B0cykge1xuXHQgIHZhciBmb3JjZUJhc2U2NCA9IG9wdHMgJiYgb3B0cy5mb3JjZUJhc2U2NDtcblx0ICBpZiAoZm9yY2VCYXNlNjQpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICB9XG5cdCAgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSA9IG9wdHMucGVyTWVzc2FnZURlZmxhdGU7XG5cdCAgdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQgPSBCcm93c2VyV2ViU29ja2V0ICYmICFvcHRzLmZvcmNlTm9kZTtcblx0ICB0aGlzLnByb3RvY29scyA9IG9wdHMucHJvdG9jb2xzO1xuXHQgIGlmICghdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgIFdlYlNvY2tldCA9IE5vZGVXZWJTb2NrZXQ7XG5cdCAgfVxuXHQgIFRyYW5zcG9ydCQxLmNhbGwodGhpcywgb3B0cyk7XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBUcmFuc3BvcnQuXG5cdCAqL1xuXG5cdGluaGVyaXQoV1MsIFRyYW5zcG9ydCQxKTtcblxuXHQvKipcblx0ICogVHJhbnNwb3J0IG5hbWUuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5uYW1lID0gJ3dlYnNvY2tldCc7XG5cblx0Lypcblx0ICogV2ViU29ja2V0cyBzdXBwb3J0IGJpbmFyeVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuc3VwcG9ydHNCaW5hcnkgPSB0cnVlO1xuXG5cdC8qKlxuXHQgKiBPcGVucyBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuZG9PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICghdGhpcy5jaGVjaygpKSB7XG5cdCAgICAvLyBsZXQgcHJvYmUgdGltZW91dFxuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciB1cmkgPSB0aGlzLnVyaSgpO1xuXHQgIHZhciBwcm90b2NvbHMgPSB0aGlzLnByb3RvY29scztcblx0ICB2YXIgb3B0cyA9IHtcblx0ICAgIGFnZW50OiB0aGlzLmFnZW50LFxuXHQgICAgcGVyTWVzc2FnZURlZmxhdGU6IHRoaXMucGVyTWVzc2FnZURlZmxhdGVcblx0ICB9O1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgb3B0cy5wZnggPSB0aGlzLnBmeDtcblx0ICBvcHRzLmtleSA9IHRoaXMua2V5O1xuXHQgIG9wdHMucGFzc3BocmFzZSA9IHRoaXMucGFzc3BocmFzZTtcblx0ICBvcHRzLmNlcnQgPSB0aGlzLmNlcnQ7XG5cdCAgb3B0cy5jYSA9IHRoaXMuY2E7XG5cdCAgb3B0cy5jaXBoZXJzID0gdGhpcy5jaXBoZXJzO1xuXHQgIG9wdHMucmVqZWN0VW5hdXRob3JpemVkID0gdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cdCAgaWYgKHRoaXMuZXh0cmFIZWFkZXJzKSB7XG5cdCAgICBvcHRzLmhlYWRlcnMgPSB0aGlzLmV4dHJhSGVhZGVycztcblx0ICB9XG5cdCAgaWYgKHRoaXMubG9jYWxBZGRyZXNzKSB7XG5cdCAgICBvcHRzLmxvY2FsQWRkcmVzcyA9IHRoaXMubG9jYWxBZGRyZXNzO1xuXHQgIH1cblxuXHQgIHRyeSB7XG5cdCAgICB0aGlzLndzID0gdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQgPyBwcm90b2NvbHMgPyBuZXcgV2ViU29ja2V0KHVyaSwgcHJvdG9jb2xzKSA6IG5ldyBXZWJTb2NrZXQodXJpKSA6IG5ldyBXZWJTb2NrZXQodXJpLCBwcm90b2NvbHMsIG9wdHMpO1xuXHQgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLndzLmJpbmFyeVR5cGUgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLndzLnN1cHBvcnRzICYmIHRoaXMud3Muc3VwcG9ydHMuYmluYXJ5KSB7XG5cdCAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gdHJ1ZTtcblx0ICAgIHRoaXMud3MuYmluYXJ5VHlwZSA9ICdub2RlYnVmZmVyJztcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhpcy53cy5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0ICB9XG5cblx0ICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBzb2NrZXRcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVycyA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICB0aGlzLndzLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25PcGVuKCk7XG5cdCAgfTtcblx0ICB0aGlzLndzLm9uY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uQ2xvc2UoKTtcblx0ICB9O1xuXHQgIHRoaXMud3Mub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2KSB7XG5cdCAgICBzZWxmLm9uRGF0YShldi5kYXRhKTtcblx0ICB9O1xuXHQgIHRoaXMud3Mub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoJ3dlYnNvY2tldCBlcnJvcicsIGUpO1xuXHQgIH07XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyBkYXRhIHRvIHNvY2tldC5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgb2YgcGFja2V0cy5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChwYWNrZXRzKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcblxuXHQgIC8vIGVuY29kZVBhY2tldCBlZmZpY2llbnQgYXMgaXQgdXNlcyBXUyBmcmFtaW5nXG5cdCAgLy8gbm8gbmVlZCBmb3IgZW5jb2RlUGF5bG9hZFxuXHQgIHZhciB0b3RhbCA9IHBhY2tldHMubGVuZ3RoO1xuXHQgIGZvciAodmFyIGkgPSAwLCBsID0gdG90YWw7IGkgPCBsOyBpKyspIHtcblx0ICAgIChmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICAgIHBhcnNlci5lbmNvZGVQYWNrZXQocGFja2V0LCBzZWxmLnN1cHBvcnRzQmluYXJ5LCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgICAgIGlmICghc2VsZi51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgICAgICAgIC8vIGFsd2F5cyBjcmVhdGUgYSBuZXcgb2JqZWN0IChHSC00MzcpXG5cdCAgICAgICAgICB2YXIgb3B0cyA9IHt9O1xuXHQgICAgICAgICAgaWYgKHBhY2tldC5vcHRpb25zKSB7XG5cdCAgICAgICAgICAgIG9wdHMuY29tcHJlc3MgPSBwYWNrZXQub3B0aW9ucy5jb21wcmVzcztcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgaWYgKHNlbGYucGVyTWVzc2FnZURlZmxhdGUpIHtcblx0ICAgICAgICAgICAgdmFyIGxlbiA9ICdzdHJpbmcnID09PSB0eXBlb2YgZGF0YSA/IGNvbW1vbmpzR2xvYmFsLkJ1ZmZlci5ieXRlTGVuZ3RoKGRhdGEpIDogZGF0YS5sZW5ndGg7XG5cdCAgICAgICAgICAgIGlmIChsZW4gPCBzZWxmLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZCkge1xuXHQgICAgICAgICAgICAgIG9wdHMuY29tcHJlc3MgPSBmYWxzZTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIC8vIFNvbWV0aW1lcyB0aGUgd2Vic29ja2V0IGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ1dCB0aGUgYnJvd3NlciBkaWRuJ3Rcblx0ICAgICAgICAvLyBoYXZlIGEgY2hhbmNlIG9mIGluZm9ybWluZyB1cyBhYm91dCBpdCB5ZXQsIGluIHRoYXQgY2FzZSBzZW5kIHdpbGxcblx0ICAgICAgICAvLyB0aHJvdyBhbiBlcnJvclxuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICBpZiAoc2VsZi51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgICAgICAgICAgLy8gVHlwZUVycm9yIGlzIHRocm93biB3aGVuIHBhc3NpbmcgdGhlIHNlY29uZCBhcmd1bWVudCBvbiBTYWZhcmlcblx0ICAgICAgICAgICAgc2VsZi53cy5zZW5kKGRhdGEpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgc2VsZi53cy5zZW5kKGRhdGEsIG9wdHMpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgIGRlYnVnJDUoJ3dlYnNvY2tldCBjbG9zZWQgYmVmb3JlIG9uY2xvc2UgZXZlbnQnKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICAtLXRvdGFsIHx8IGRvbmUoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9KShwYWNrZXRzW2ldKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBkb25lKCkge1xuXHQgICAgc2VsZi5lbWl0KCdmbHVzaCcpO1xuXG5cdCAgICAvLyBmYWtlIGRyYWluXG5cdCAgICAvLyBkZWZlciB0byBuZXh0IHRpY2sgdG8gYWxsb3cgU29ja2V0IHRvIGNsZWFyIHdyaXRlQnVmZmVyXG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi53cml0YWJsZSA9IHRydWU7XG5cdCAgICAgIHNlbGYuZW1pdCgnZHJhaW4nKTtcblx0ICAgIH0sIDApO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gY2xvc2Vcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5vbkNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIFRyYW5zcG9ydCQxLnByb3RvdHlwZS5vbkNsb3NlLmNhbGwodGhpcyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlcyBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuZG9DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodHlwZW9mIHRoaXMud3MgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICB0aGlzLndzLmNsb3NlKCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgdXJpIGZvciBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLnVyaSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJ5IHx8IHt9O1xuXHQgIHZhciBzY2hlbWEgPSB0aGlzLnNlY3VyZSA/ICd3c3MnIDogJ3dzJztcblx0ICB2YXIgcG9ydCA9ICcnO1xuXG5cdCAgLy8gYXZvaWQgcG9ydCBpZiBkZWZhdWx0IGZvciBzY2hlbWFcblx0ICBpZiAodGhpcy5wb3J0ICYmICgnd3NzJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA0NDMgfHwgJ3dzJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA4MCkpIHtcblx0ICAgIHBvcnQgPSAnOicgKyB0aGlzLnBvcnQ7XG5cdCAgfVxuXG5cdCAgLy8gYXBwZW5kIHRpbWVzdGFtcCB0byBVUklcblx0ICBpZiAodGhpcy50aW1lc3RhbXBSZXF1ZXN0cykge1xuXHQgICAgcXVlcnlbdGhpcy50aW1lc3RhbXBQYXJhbV0gPSB5ZWFzdCQyKCk7XG5cdCAgfVxuXG5cdCAgLy8gY29tbXVuaWNhdGUgYmluYXJ5IHN1cHBvcnQgY2FwYWJpbGl0aWVzXG5cdCAgaWYgKCF0aGlzLnN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICBxdWVyeS5iNjQgPSAxO1xuXHQgIH1cblxuXHQgIHF1ZXJ5ID0gcGFyc2VxcyQyLmVuY29kZShxdWVyeSk7XG5cblx0ICAvLyBwcmVwZW5kID8gdG8gcXVlcnlcblx0ICBpZiAocXVlcnkubGVuZ3RoKSB7XG5cdCAgICBxdWVyeSA9ICc/JyArIHF1ZXJ5O1xuXHQgIH1cblxuXHQgIHZhciBpcHY2ID0gdGhpcy5ob3N0bmFtZS5pbmRleE9mKCc6JykgIT09IC0xO1xuXHQgIHJldHVybiBzY2hlbWEgKyAnOi8vJyArIChpcHY2ID8gJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyA6IHRoaXMuaG9zdG5hbWUpICsgcG9ydCArIHRoaXMucGF0aCArIHF1ZXJ5O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBGZWF0dXJlIGRldGVjdGlvbiBmb3IgV2ViU29ja2V0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB3aGV0aGVyIHRoaXMgdHJhbnNwb3J0IGlzIGF2YWlsYWJsZS5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0V1MucHJvdG90eXBlLmNoZWNrID0gZnVuY3Rpb24gKCkge1xuXHQgIHJldHVybiAhIVdlYlNvY2tldCAmJiAhKCdfX2luaXRpYWxpemUnIGluIFdlYlNvY2tldCAmJiB0aGlzLm5hbWUgPT09IFdTLnByb3RvdHlwZS5uYW1lKTtcblx0fTtcblxuXHR2YXIgd2Vic29ja2V0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogd2Vic29ja2V0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogd2Vic29ja2V0XG5cdH0pO1xuXG5cdHZhciBYSFIkMSA9ICggcG9sbGluZ1hociQxICYmIHBvbGxpbmdYaHIgKSB8fCBwb2xsaW5nWGhyJDE7XG5cblx0dmFyIEpTT05QID0gKCBwb2xsaW5nSnNvbnAkMSAmJiBwb2xsaW5nSnNvbnAgKSB8fCBwb2xsaW5nSnNvbnAkMTtcblxuXHR2YXIgd2Vic29ja2V0JDIgPSAoIHdlYnNvY2tldCQxICYmIHdlYnNvY2tldCApIHx8IHdlYnNvY2tldCQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzXG5cdCAqL1xuXG5cdC8qKlxuXHQgKiBFeHBvcnQgdHJhbnNwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmdfMSA9IHBvbGxpbmckMjtcblx0dmFyIHdlYnNvY2tldF8xID0gd2Vic29ja2V0JDI7XG5cblx0LyoqXG5cdCAqIFBvbGxpbmcgdHJhbnNwb3J0IHBvbHltb3JwaGljIGNvbnN0cnVjdG9yLlxuXHQgKiBEZWNpZGVzIG9uIHhociB2cyBqc29ucCBiYXNlZCBvbiBmZWF0dXJlIGRldGVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIHBvbGxpbmckMihvcHRzKSB7XG5cdCAgdmFyIHhocjtcblx0ICB2YXIgeGQgPSBmYWxzZTtcblx0ICB2YXIgeHMgPSBmYWxzZTtcblx0ICB2YXIganNvbnAgPSBmYWxzZSAhPT0gb3B0cy5qc29ucDtcblxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5sb2NhdGlvbikge1xuXHQgICAgdmFyIGlzU1NMID0gJ2h0dHBzOicgPT09IGxvY2F0aW9uLnByb3RvY29sO1xuXHQgICAgdmFyIHBvcnQgPSBsb2NhdGlvbi5wb3J0O1xuXG5cdCAgICAvLyBzb21lIHVzZXIgYWdlbnRzIGhhdmUgZW1wdHkgYGxvY2F0aW9uLnBvcnRgXG5cdCAgICBpZiAoIXBvcnQpIHtcblx0ICAgICAgcG9ydCA9IGlzU1NMID8gNDQzIDogODA7XG5cdCAgICB9XG5cblx0ICAgIHhkID0gb3B0cy5ob3N0bmFtZSAhPT0gbG9jYXRpb24uaG9zdG5hbWUgfHwgcG9ydCAhPT0gb3B0cy5wb3J0O1xuXHQgICAgeHMgPSBvcHRzLnNlY3VyZSAhPT0gaXNTU0w7XG5cdCAgfVxuXG5cdCAgb3B0cy54ZG9tYWluID0geGQ7XG5cdCAgb3B0cy54c2NoZW1lID0geHM7XG5cdCAgeGhyID0gbmV3IHJlcXVpcmUkJDEob3B0cyk7XG5cblx0ICBpZiAoJ29wZW4nIGluIHhociAmJiAhb3B0cy5mb3JjZUpTT05QKSB7XG5cdCAgICByZXR1cm4gbmV3IFhIUiQxKG9wdHMpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBpZiAoIWpzb25wKSB0aHJvdyBuZXcgRXJyb3IoJ0pTT05QIGRpc2FibGVkJyk7XG5cdCAgICByZXR1cm4gbmV3IEpTT05QKG9wdHMpO1xuXHQgIH1cblx0fVxuXG5cdHZhciB0cmFuc3BvcnRzID0ge1xuXHQgIHBvbGxpbmc6IHBvbGxpbmdfMSxcblx0ICB3ZWJzb2NrZXQ6IHdlYnNvY2tldF8xXG5cdH07XG5cblx0dmFyIHRyYW5zcG9ydHMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0cmFuc3BvcnRzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdHJhbnNwb3J0cyxcblx0XHRwb2xsaW5nOiBwb2xsaW5nXzEsXG5cdFx0d2Vic29ja2V0OiB3ZWJzb2NrZXRfMVxuXHR9KTtcblxuXHR2YXIgaW5kZXhPZiA9IFtdLmluZGV4T2Y7XG5cblx0dmFyIGluZGV4b2YgPSBmdW5jdGlvbiBpbmRleG9mKGFyciwgb2JqKSB7XG5cdCAgaWYgKGluZGV4T2YpIHJldHVybiBhcnIuaW5kZXhPZihvYmopO1xuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgKytpKSB7XG5cdCAgICBpZiAoYXJyW2ldID09PSBvYmopIHJldHVybiBpO1xuXHQgIH1cblx0ICByZXR1cm4gLTE7XG5cdH07XG5cblx0dmFyIGluZGV4b2YkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBpbmRleG9mLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaW5kZXhvZlxuXHR9KTtcblxuXHR2YXIgdHJhbnNwb3J0cyQyID0gKCB0cmFuc3BvcnRzJDEgJiYgdHJhbnNwb3J0cyApIHx8IHRyYW5zcG9ydHMkMTtcblxuXHR2YXIgaW5kZXggPSAoIGluZGV4b2YkMSAmJiBpbmRleG9mICkgfHwgaW5kZXhvZiQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNiA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDpzb2NrZXQnKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBzb2NrZXQgPSBTb2NrZXQ7XG5cblx0LyoqXG5cdCAqIFNvY2tldCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSB1cmkgb3Igb3B0aW9uc1xuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBTb2NrZXQodXJpLCBvcHRzKSB7XG5cdCAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNvY2tldCkpIHJldHVybiBuZXcgU29ja2V0KHVyaSwgb3B0cyk7XG5cblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblxuXHQgIGlmICh1cmkgJiYgJ29iamVjdCcgPT09ICh0eXBlb2YgdXJpID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih1cmkpKSkge1xuXHQgICAgb3B0cyA9IHVyaTtcblx0ICAgIHVyaSA9IG51bGw7XG5cdCAgfVxuXG5cdCAgaWYgKHVyaSkge1xuXHQgICAgdXJpID0gcGFyc2V1cmkkMih1cmkpO1xuXHQgICAgb3B0cy5ob3N0bmFtZSA9IHVyaS5ob3N0O1xuXHQgICAgb3B0cy5zZWN1cmUgPSB1cmkucHJvdG9jb2wgPT09ICdodHRwcycgfHwgdXJpLnByb3RvY29sID09PSAnd3NzJztcblx0ICAgIG9wdHMucG9ydCA9IHVyaS5wb3J0O1xuXHQgICAgaWYgKHVyaS5xdWVyeSkgb3B0cy5xdWVyeSA9IHVyaS5xdWVyeTtcblx0ICB9IGVsc2UgaWYgKG9wdHMuaG9zdCkge1xuXHQgICAgb3B0cy5ob3N0bmFtZSA9IHBhcnNldXJpJDIob3B0cy5ob3N0KS5ob3N0O1xuXHQgIH1cblxuXHQgIHRoaXMuc2VjdXJlID0gbnVsbCAhPSBvcHRzLnNlY3VyZSA/IG9wdHMuc2VjdXJlIDogY29tbW9uanNHbG9iYWwubG9jYXRpb24gJiYgJ2h0dHBzOicgPT09IGxvY2F0aW9uLnByb3RvY29sO1xuXG5cdCAgaWYgKG9wdHMuaG9zdG5hbWUgJiYgIW9wdHMucG9ydCkge1xuXHQgICAgLy8gaWYgbm8gcG9ydCBpcyBzcGVjaWZpZWQgbWFudWFsbHksIHVzZSB0aGUgcHJvdG9jb2wgZGVmYXVsdFxuXHQgICAgb3B0cy5wb3J0ID0gdGhpcy5zZWN1cmUgPyAnNDQzJyA6ICc4MCc7XG5cdCAgfVxuXG5cdCAgdGhpcy5hZ2VudCA9IG9wdHMuYWdlbnQgfHwgZmFsc2U7XG5cdCAgdGhpcy5ob3N0bmFtZSA9IG9wdHMuaG9zdG5hbWUgfHwgKGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uID8gbG9jYXRpb24uaG9zdG5hbWUgOiAnbG9jYWxob3N0Jyk7XG5cdCAgdGhpcy5wb3J0ID0gb3B0cy5wb3J0IHx8IChjb21tb25qc0dsb2JhbC5sb2NhdGlvbiAmJiBsb2NhdGlvbi5wb3J0ID8gbG9jYXRpb24ucG9ydCA6IHRoaXMuc2VjdXJlID8gNDQzIDogODApO1xuXHQgIHRoaXMucXVlcnkgPSBvcHRzLnF1ZXJ5IHx8IHt9O1xuXHQgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHRoaXMucXVlcnkpIHRoaXMucXVlcnkgPSBwYXJzZXFzJDIuZGVjb2RlKHRoaXMucXVlcnkpO1xuXHQgIHRoaXMudXBncmFkZSA9IGZhbHNlICE9PSBvcHRzLnVwZ3JhZGU7XG5cdCAgdGhpcy5wYXRoID0gKG9wdHMucGF0aCB8fCAnL2VuZ2luZS5pbycpLnJlcGxhY2UoL1xcLyQvLCAnJykgKyAnLyc7XG5cdCAgdGhpcy5mb3JjZUpTT05QID0gISFvcHRzLmZvcmNlSlNPTlA7XG5cdCAgdGhpcy5qc29ucCA9IGZhbHNlICE9PSBvcHRzLmpzb25wO1xuXHQgIHRoaXMuZm9yY2VCYXNlNjQgPSAhIW9wdHMuZm9yY2VCYXNlNjQ7XG5cdCAgdGhpcy5lbmFibGVzWERSID0gISFvcHRzLmVuYWJsZXNYRFI7XG5cdCAgdGhpcy50aW1lc3RhbXBQYXJhbSA9IG9wdHMudGltZXN0YW1wUGFyYW0gfHwgJ3QnO1xuXHQgIHRoaXMudGltZXN0YW1wUmVxdWVzdHMgPSBvcHRzLnRpbWVzdGFtcFJlcXVlc3RzO1xuXHQgIHRoaXMudHJhbnNwb3J0cyA9IG9wdHMudHJhbnNwb3J0cyB8fCBbJ3BvbGxpbmcnLCAnd2Vic29ja2V0J107XG5cdCAgdGhpcy50cmFuc3BvcnRPcHRpb25zID0gb3B0cy50cmFuc3BvcnRPcHRpb25zIHx8IHt9O1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICcnO1xuXHQgIHRoaXMud3JpdGVCdWZmZXIgPSBbXTtcblx0ICB0aGlzLnByZXZCdWZmZXJMZW4gPSAwO1xuXHQgIHRoaXMucG9saWN5UG9ydCA9IG9wdHMucG9saWN5UG9ydCB8fCA4NDM7XG5cdCAgdGhpcy5yZW1lbWJlclVwZ3JhZGUgPSBvcHRzLnJlbWVtYmVyVXBncmFkZSB8fCBmYWxzZTtcblx0ICB0aGlzLmJpbmFyeVR5cGUgPSBudWxsO1xuXHQgIHRoaXMub25seUJpbmFyeVVwZ3JhZGVzID0gb3B0cy5vbmx5QmluYXJ5VXBncmFkZXM7XG5cdCAgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSA9IGZhbHNlICE9PSBvcHRzLnBlck1lc3NhZ2VEZWZsYXRlID8gb3B0cy5wZXJNZXNzYWdlRGVmbGF0ZSB8fCB7fSA6IGZhbHNlO1xuXG5cdCAgaWYgKHRydWUgPT09IHRoaXMucGVyTWVzc2FnZURlZmxhdGUpIHRoaXMucGVyTWVzc2FnZURlZmxhdGUgPSB7fTtcblx0ICBpZiAodGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSAmJiBudWxsID09IHRoaXMucGVyTWVzc2FnZURlZmxhdGUudGhyZXNob2xkKSB7XG5cdCAgICB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZCA9IDEwMjQ7XG5cdCAgfVxuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5wZnggPSBvcHRzLnBmeCB8fCBudWxsO1xuXHQgIHRoaXMua2V5ID0gb3B0cy5rZXkgfHwgbnVsbDtcblx0ICB0aGlzLnBhc3NwaHJhc2UgPSBvcHRzLnBhc3NwaHJhc2UgfHwgbnVsbDtcblx0ICB0aGlzLmNlcnQgPSBvcHRzLmNlcnQgfHwgbnVsbDtcblx0ICB0aGlzLmNhID0gb3B0cy5jYSB8fCBudWxsO1xuXHQgIHRoaXMuY2lwaGVycyA9IG9wdHMuY2lwaGVycyB8fCBudWxsO1xuXHQgIHRoaXMucmVqZWN0VW5hdXRob3JpemVkID0gb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRzLnJlamVjdFVuYXV0aG9yaXplZDtcblx0ICB0aGlzLmZvcmNlTm9kZSA9ICEhb3B0cy5mb3JjZU5vZGU7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHZhciBmcmVlR2xvYmFsID0gX3R5cGVvZihjb21tb25qc0dsb2JhbCkgPT09ICdvYmplY3QnICYmIGNvbW1vbmpzR2xvYmFsO1xuXHQgIGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCkge1xuXHQgICAgaWYgKG9wdHMuZXh0cmFIZWFkZXJzICYmIE9iamVjdC5rZXlzKG9wdHMuZXh0cmFIZWFkZXJzKS5sZW5ndGggPiAwKSB7XG5cdCAgICAgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cdCAgICB9XG5cblx0ICAgIGlmIChvcHRzLmxvY2FsQWRkcmVzcykge1xuXHQgICAgICB0aGlzLmxvY2FsQWRkcmVzcyA9IG9wdHMubG9jYWxBZGRyZXNzO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8vIHNldCBvbiBoYW5kc2hha2Vcblx0ICB0aGlzLmlkID0gbnVsbDtcblx0ICB0aGlzLnVwZ3JhZGVzID0gbnVsbDtcblx0ICB0aGlzLnBpbmdJbnRlcnZhbCA9IG51bGw7XG5cdCAgdGhpcy5waW5nVGltZW91dCA9IG51bGw7XG5cblx0ICAvLyBzZXQgb24gaGVhcnRiZWF0XG5cdCAgdGhpcy5waW5nSW50ZXJ2YWxUaW1lciA9IG51bGw7XG5cdCAgdGhpcy5waW5nVGltZW91dFRpbWVyID0gbnVsbDtcblxuXHQgIHRoaXMub3BlbigpO1xuXHR9XG5cblx0U29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKFNvY2tldC5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBQcm90b2NvbCB2ZXJzaW9uLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRTb2NrZXQucHJvdG9jb2wgPSBwYXJzZXIucHJvdG9jb2w7IC8vIHRoaXMgaXMgYW4gaW50XG5cblx0LyoqXG5cdCAqIEV4cG9zZSBkZXBzIGZvciBsZWdhY3kgY29tcGF0aWJpbGl0eVxuXHQgKiBhbmQgc3RhbmRhbG9uZSBicm93c2VyIGFjY2Vzcy5cblx0ICovXG5cblx0U29ja2V0LlNvY2tldCA9IFNvY2tldDtcblx0U29ja2V0LlRyYW5zcG9ydCA9IFRyYW5zcG9ydCQxO1xuXHRTb2NrZXQudHJhbnNwb3J0cyA9IHRyYW5zcG9ydHMkMjtcblx0U29ja2V0LnBhcnNlciA9IHBhcnNlcjtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0cmFuc3BvcnQgb2YgdGhlIGdpdmVuIHR5cGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0cmFuc3BvcnQgbmFtZVxuXHQgKiBAcmV0dXJuIHtUcmFuc3BvcnR9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmNyZWF0ZVRyYW5zcG9ydCA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdCAgZGVidWckNignY3JlYXRpbmcgdHJhbnNwb3J0IFwiJXNcIicsIG5hbWUpO1xuXHQgIHZhciBxdWVyeSA9IGNsb25lKHRoaXMucXVlcnkpO1xuXG5cdCAgLy8gYXBwZW5kIGVuZ2luZS5pbyBwcm90b2NvbCBpZGVudGlmaWVyXG5cdCAgcXVlcnkuRUlPID0gcGFyc2VyLnByb3RvY29sO1xuXG5cdCAgLy8gdHJhbnNwb3J0IG5hbWVcblx0ICBxdWVyeS50cmFuc3BvcnQgPSBuYW1lO1xuXG5cdCAgLy8gcGVyLXRyYW5zcG9ydCBvcHRpb25zXG5cdCAgdmFyIG9wdGlvbnMgPSB0aGlzLnRyYW5zcG9ydE9wdGlvbnNbbmFtZV0gfHwge307XG5cblx0ICAvLyBzZXNzaW9uIGlkIGlmIHdlIGFscmVhZHkgaGF2ZSBvbmVcblx0ICBpZiAodGhpcy5pZCkgcXVlcnkuc2lkID0gdGhpcy5pZDtcblxuXHQgIHZhciB0cmFuc3BvcnQgPSBuZXcgdHJhbnNwb3J0cyQyW25hbWVdKHtcblx0ICAgIHF1ZXJ5OiBxdWVyeSxcblx0ICAgIHNvY2tldDogdGhpcyxcblx0ICAgIGFnZW50OiBvcHRpb25zLmFnZW50IHx8IHRoaXMuYWdlbnQsXG5cdCAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0bmFtZSB8fCB0aGlzLmhvc3RuYW1lLFxuXHQgICAgcG9ydDogb3B0aW9ucy5wb3J0IHx8IHRoaXMucG9ydCxcblx0ICAgIHNlY3VyZTogb3B0aW9ucy5zZWN1cmUgfHwgdGhpcy5zZWN1cmUsXG5cdCAgICBwYXRoOiBvcHRpb25zLnBhdGggfHwgdGhpcy5wYXRoLFxuXHQgICAgZm9yY2VKU09OUDogb3B0aW9ucy5mb3JjZUpTT05QIHx8IHRoaXMuZm9yY2VKU09OUCxcblx0ICAgIGpzb25wOiBvcHRpb25zLmpzb25wIHx8IHRoaXMuanNvbnAsXG5cdCAgICBmb3JjZUJhc2U2NDogb3B0aW9ucy5mb3JjZUJhc2U2NCB8fCB0aGlzLmZvcmNlQmFzZTY0LFxuXHQgICAgZW5hYmxlc1hEUjogb3B0aW9ucy5lbmFibGVzWERSIHx8IHRoaXMuZW5hYmxlc1hEUixcblx0ICAgIHRpbWVzdGFtcFJlcXVlc3RzOiBvcHRpb25zLnRpbWVzdGFtcFJlcXVlc3RzIHx8IHRoaXMudGltZXN0YW1wUmVxdWVzdHMsXG5cdCAgICB0aW1lc3RhbXBQYXJhbTogb3B0aW9ucy50aW1lc3RhbXBQYXJhbSB8fCB0aGlzLnRpbWVzdGFtcFBhcmFtLFxuXHQgICAgcG9saWN5UG9ydDogb3B0aW9ucy5wb2xpY3lQb3J0IHx8IHRoaXMucG9saWN5UG9ydCxcblx0ICAgIHBmeDogb3B0aW9ucy5wZnggfHwgdGhpcy5wZngsXG5cdCAgICBrZXk6IG9wdGlvbnMua2V5IHx8IHRoaXMua2V5LFxuXHQgICAgcGFzc3BocmFzZTogb3B0aW9ucy5wYXNzcGhyYXNlIHx8IHRoaXMucGFzc3BocmFzZSxcblx0ICAgIGNlcnQ6IG9wdGlvbnMuY2VydCB8fCB0aGlzLmNlcnQsXG5cdCAgICBjYTogb3B0aW9ucy5jYSB8fCB0aGlzLmNhLFxuXHQgICAgY2lwaGVyczogb3B0aW9ucy5jaXBoZXJzIHx8IHRoaXMuY2lwaGVycyxcblx0ICAgIHJlamVjdFVuYXV0aG9yaXplZDogb3B0aW9ucy5yZWplY3RVbmF1dGhvcml6ZWQgfHwgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQsXG5cdCAgICBwZXJNZXNzYWdlRGVmbGF0ZTogb3B0aW9ucy5wZXJNZXNzYWdlRGVmbGF0ZSB8fCB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLFxuXHQgICAgZXh0cmFIZWFkZXJzOiBvcHRpb25zLmV4dHJhSGVhZGVycyB8fCB0aGlzLmV4dHJhSGVhZGVycyxcblx0ICAgIGZvcmNlTm9kZTogb3B0aW9ucy5mb3JjZU5vZGUgfHwgdGhpcy5mb3JjZU5vZGUsXG5cdCAgICBsb2NhbEFkZHJlc3M6IG9wdGlvbnMubG9jYWxBZGRyZXNzIHx8IHRoaXMubG9jYWxBZGRyZXNzLFxuXHQgICAgcmVxdWVzdFRpbWVvdXQ6IG9wdGlvbnMucmVxdWVzdFRpbWVvdXQgfHwgdGhpcy5yZXF1ZXN0VGltZW91dCxcblx0ICAgIHByb3RvY29sczogb3B0aW9ucy5wcm90b2NvbHMgfHwgdm9pZCAwXG5cdCAgfSk7XG5cblx0ICByZXR1cm4gdHJhbnNwb3J0O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIGNsb25lKG9iaikge1xuXHQgIHZhciBvID0ge307XG5cdCAgZm9yICh2YXIgaSBpbiBvYmopIHtcblx0ICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgb1tpXSA9IG9ialtpXTtcblx0ICAgIH1cblx0ICB9XG5cdCAgcmV0dXJuIG87XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZXMgdHJhbnNwb3J0IHRvIHVzZSBhbmQgc3RhcnRzIHByb2JlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cdFNvY2tldC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgdHJhbnNwb3J0O1xuXHQgIGlmICh0aGlzLnJlbWVtYmVyVXBncmFkZSAmJiBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzICYmIHRoaXMudHJhbnNwb3J0cy5pbmRleE9mKCd3ZWJzb2NrZXQnKSAhPT0gLTEpIHtcblx0ICAgIHRyYW5zcG9ydCA9ICd3ZWJzb2NrZXQnO1xuXHQgIH0gZWxzZSBpZiAoMCA9PT0gdGhpcy50cmFuc3BvcnRzLmxlbmd0aCkge1xuXHQgICAgLy8gRW1pdCBlcnJvciBvbiBuZXh0IHRpY2sgc28gaXQgY2FuIGJlIGxpc3RlbmVkIHRvXG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi5lbWl0KCdlcnJvcicsICdObyB0cmFuc3BvcnRzIGF2YWlsYWJsZScpO1xuXHQgICAgfSwgMCk7XG5cdCAgICByZXR1cm47XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRyYW5zcG9ydCA9IHRoaXMudHJhbnNwb3J0c1swXTtcblx0ICB9XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW5pbmcnO1xuXG5cdCAgLy8gUmV0cnkgd2l0aCB0aGUgbmV4dCB0cmFuc3BvcnQgaWYgdGhlIHRyYW5zcG9ydCBpcyBkaXNhYmxlZCAoanNvbnA6IGZhbHNlKVxuXHQgIHRyeSB7XG5cdCAgICB0cmFuc3BvcnQgPSB0aGlzLmNyZWF0ZVRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHRoaXMudHJhbnNwb3J0cy5zaGlmdCgpO1xuXHQgICAgdGhpcy5vcGVuKCk7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdHJhbnNwb3J0Lm9wZW4oKTtcblx0ICB0aGlzLnNldFRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjdXJyZW50IHRyYW5zcG9ydC4gRGlzYWJsZXMgdGhlIGV4aXN0aW5nIG9uZSAoaWYgYW55KS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2V0VHJhbnNwb3J0ID0gZnVuY3Rpb24gKHRyYW5zcG9ydCkge1xuXHQgIGRlYnVnJDYoJ3NldHRpbmcgdHJhbnNwb3J0ICVzJywgdHJhbnNwb3J0Lm5hbWUpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGlmICh0aGlzLnRyYW5zcG9ydCkge1xuXHQgICAgZGVidWckNignY2xlYXJpbmcgZXhpc3RpbmcgdHJhbnNwb3J0ICVzJywgdGhpcy50cmFuc3BvcnQubmFtZSk7XG5cdCAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcblx0ICB9XG5cblx0ICAvLyBzZXQgdXAgdHJhbnNwb3J0XG5cdCAgdGhpcy50cmFuc3BvcnQgPSB0cmFuc3BvcnQ7XG5cblx0ICAvLyBzZXQgdXAgdHJhbnNwb3J0IGxpc3RlbmVyc1xuXHQgIHRyYW5zcG9ydC5vbignZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uRHJhaW4oKTtcblx0ICB9KS5vbigncGFja2V0JywgZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgc2VsZi5vblBhY2tldChwYWNrZXQpO1xuXHQgIH0pLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoZSk7XG5cdCAgfSkub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbkNsb3NlKCd0cmFuc3BvcnQgY2xvc2UnKTtcblx0ICB9KTtcblx0fTtcblxuXHQvKipcblx0ICogUHJvYmVzIGEgdHJhbnNwb3J0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHJhbnNwb3J0IG5hbWVcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUucHJvYmUgPSBmdW5jdGlvbiAobmFtZSkge1xuXHQgIGRlYnVnJDYoJ3Byb2JpbmcgdHJhbnNwb3J0IFwiJXNcIicsIG5hbWUpO1xuXHQgIHZhciB0cmFuc3BvcnQgPSB0aGlzLmNyZWF0ZVRyYW5zcG9ydChuYW1lLCB7IHByb2JlOiAxIH0pO1xuXHQgIHZhciBmYWlsZWQgPSBmYWxzZTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gZmFsc2U7XG5cblx0ICBmdW5jdGlvbiBvblRyYW5zcG9ydE9wZW4oKSB7XG5cdCAgICBpZiAoc2VsZi5vbmx5QmluYXJ5VXBncmFkZXMpIHtcblx0ICAgICAgdmFyIHVwZ3JhZGVMb3Nlc0JpbmFyeSA9ICF0aGlzLnN1cHBvcnRzQmluYXJ5ICYmIHNlbGYudHJhbnNwb3J0LnN1cHBvcnRzQmluYXJ5O1xuXHQgICAgICBmYWlsZWQgPSBmYWlsZWQgfHwgdXBncmFkZUxvc2VzQmluYXJ5O1xuXHQgICAgfVxuXHQgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXG5cdCAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIG9wZW5lZCcsIG5hbWUpO1xuXHQgICAgdHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogJ3BpbmcnLCBkYXRhOiAncHJvYmUnIH1dKTtcblx0ICAgIHRyYW5zcG9ydC5vbmNlKCdwYWNrZXQnLCBmdW5jdGlvbiAobXNnKSB7XG5cdCAgICAgIGlmIChmYWlsZWQpIHJldHVybjtcblx0ICAgICAgaWYgKCdwb25nJyA9PT0gbXNnLnR5cGUgJiYgJ3Byb2JlJyA9PT0gbXNnLmRhdGEpIHtcblx0ICAgICAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIHBvbmcnLCBuYW1lKTtcblx0ICAgICAgICBzZWxmLnVwZ3JhZGluZyA9IHRydWU7XG5cdCAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRpbmcnLCB0cmFuc3BvcnQpO1xuXHQgICAgICAgIGlmICghdHJhbnNwb3J0KSByZXR1cm47XG5cdCAgICAgICAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9ICd3ZWJzb2NrZXQnID09PSB0cmFuc3BvcnQubmFtZTtcblxuXHQgICAgICAgIGRlYnVnJDYoJ3BhdXNpbmcgY3VycmVudCB0cmFuc3BvcnQgXCIlc1wiJywgc2VsZi50cmFuc3BvcnQubmFtZSk7XG5cdCAgICAgICAgc2VsZi50cmFuc3BvcnQucGF1c2UoZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXHQgICAgICAgICAgaWYgKCdjbG9zZWQnID09PSBzZWxmLnJlYWR5U3RhdGUpIHJldHVybjtcblx0ICAgICAgICAgIGRlYnVnJDYoJ2NoYW5naW5nIHRyYW5zcG9ydCBhbmQgc2VuZGluZyB1cGdyYWRlIHBhY2tldCcpO1xuXG5cdCAgICAgICAgICBjbGVhbnVwKCk7XG5cblx0ICAgICAgICAgIHNlbGYuc2V0VHJhbnNwb3J0KHRyYW5zcG9ydCk7XG5cdCAgICAgICAgICB0cmFuc3BvcnQuc2VuZChbeyB0eXBlOiAndXBncmFkZScgfV0pO1xuXHQgICAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRlJywgdHJhbnNwb3J0KTtcblx0ICAgICAgICAgIHRyYW5zcG9ydCA9IG51bGw7XG5cdCAgICAgICAgICBzZWxmLnVwZ3JhZGluZyA9IGZhbHNlO1xuXHQgICAgICAgICAgc2VsZi5mbHVzaCgpO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGRlYnVnJDYoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgZmFpbGVkJywgbmFtZSk7XG5cdCAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcigncHJvYmUgZXJyb3InKTtcblx0ICAgICAgICBlcnIudHJhbnNwb3J0ID0gdHJhbnNwb3J0Lm5hbWU7XG5cdCAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRlRXJyb3InLCBlcnIpO1xuXHQgICAgICB9XG5cdCAgICB9KTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBmcmVlemVUcmFuc3BvcnQoKSB7XG5cdCAgICBpZiAoZmFpbGVkKSByZXR1cm47XG5cblx0ICAgIC8vIEFueSBjYWxsYmFjayBjYWxsZWQgYnkgdHJhbnNwb3J0IHNob3VsZCBiZSBpZ25vcmVkIHNpbmNlIG5vd1xuXHQgICAgZmFpbGVkID0gdHJ1ZTtcblxuXHQgICAgY2xlYW51cCgpO1xuXG5cdCAgICB0cmFuc3BvcnQuY2xvc2UoKTtcblx0ICAgIHRyYW5zcG9ydCA9IG51bGw7XG5cdCAgfVxuXG5cdCAgLy8gSGFuZGxlIGFueSBlcnJvciB0aGF0IGhhcHBlbnMgd2hpbGUgcHJvYmluZ1xuXHQgIGZ1bmN0aW9uIG9uZXJyb3IoZXJyKSB7XG5cdCAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ3Byb2JlIGVycm9yOiAnICsgZXJyKTtcblx0ICAgIGVycm9yLnRyYW5zcG9ydCA9IHRyYW5zcG9ydC5uYW1lO1xuXG5cdCAgICBmcmVlemVUcmFuc3BvcnQoKTtcblxuXHQgICAgZGVidWckNigncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBmYWlsZWQgYmVjYXVzZSBvZiBlcnJvcjogJXMnLCBuYW1lLCBlcnIpO1xuXG5cdCAgICBzZWxmLmVtaXQoJ3VwZ3JhZGVFcnJvcicsIGVycm9yKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBvblRyYW5zcG9ydENsb3NlKCkge1xuXHQgICAgb25lcnJvcigndHJhbnNwb3J0IGNsb3NlZCcpO1xuXHQgIH1cblxuXHQgIC8vIFdoZW4gdGhlIHNvY2tldCBpcyBjbG9zZWQgd2hpbGUgd2UncmUgcHJvYmluZ1xuXHQgIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG5cdCAgICBvbmVycm9yKCdzb2NrZXQgY2xvc2VkJyk7XG5cdCAgfVxuXG5cdCAgLy8gV2hlbiB0aGUgc29ja2V0IGlzIHVwZ3JhZGVkIHdoaWxlIHdlJ3JlIHByb2Jpbmdcblx0ICBmdW5jdGlvbiBvbnVwZ3JhZGUodG8pIHtcblx0ICAgIGlmICh0cmFuc3BvcnQgJiYgdG8ubmFtZSAhPT0gdHJhbnNwb3J0Lm5hbWUpIHtcblx0ICAgICAgZGVidWckNignXCIlc1wiIHdvcmtzIC0gYWJvcnRpbmcgXCIlc1wiJywgdG8ubmFtZSwgdHJhbnNwb3J0Lm5hbWUpO1xuXHQgICAgICBmcmVlemVUcmFuc3BvcnQoKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvLyBSZW1vdmUgYWxsIGxpc3RlbmVycyBvbiB0aGUgdHJhbnNwb3J0IGFuZCBvbiBzZWxmXG5cdCAgZnVuY3Rpb24gY2xlYW51cCgpIHtcblx0ICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcignb3BlbicsIG9uVHJhbnNwb3J0T3Blbik7XG5cdCAgICB0cmFuc3BvcnQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cdCAgICB0cmFuc3BvcnQucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25UcmFuc3BvcnRDbG9zZSk7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcigndXBncmFkaW5nJywgb251cGdyYWRlKTtcblx0ICB9XG5cblx0ICB0cmFuc3BvcnQub25jZSgnb3BlbicsIG9uVHJhbnNwb3J0T3Blbik7XG5cdCAgdHJhbnNwb3J0Lm9uY2UoJ2Vycm9yJywgb25lcnJvcik7XG5cdCAgdHJhbnNwb3J0Lm9uY2UoJ2Nsb3NlJywgb25UcmFuc3BvcnRDbG9zZSk7XG5cblx0ICB0aGlzLm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG5cdCAgdGhpcy5vbmNlKCd1cGdyYWRpbmcnLCBvbnVwZ3JhZGUpO1xuXG5cdCAgdHJhbnNwb3J0Lm9wZW4oKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gY29ubmVjdGlvbiBpcyBkZWVtZWQgb3Blbi5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbk9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNignc29ja2V0IG9wZW4nKTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9ICd3ZWJzb2NrZXQnID09PSB0aGlzLnRyYW5zcG9ydC5uYW1lO1xuXHQgIHRoaXMuZW1pdCgnb3BlbicpO1xuXHQgIHRoaXMuZmx1c2goKTtcblxuXHQgIC8vIHdlIGNoZWNrIGZvciBgcmVhZHlTdGF0ZWAgaW4gY2FzZSBhbiBgb3BlbmBcblx0ICAvLyBsaXN0ZW5lciBhbHJlYWR5IGNsb3NlZCB0aGUgc29ja2V0XG5cdCAgaWYgKCdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlICYmIHRoaXMudXBncmFkZSAmJiB0aGlzLnRyYW5zcG9ydC5wYXVzZSkge1xuXHQgICAgZGVidWckNignc3RhcnRpbmcgdXBncmFkZSBwcm9iZXMnKTtcblx0ICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy51cGdyYWRlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgICAgdGhpcy5wcm9iZSh0aGlzLnVwZ3JhZGVzW2ldKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEhhbmRsZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnY2xvc2luZycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgZGVidWckNignc29ja2V0IHJlY2VpdmU6IHR5cGUgXCIlc1wiLCBkYXRhIFwiJXNcIicsIHBhY2tldC50eXBlLCBwYWNrZXQuZGF0YSk7XG5cblx0ICAgIHRoaXMuZW1pdCgncGFja2V0JywgcGFja2V0KTtcblxuXHQgICAgLy8gU29ja2V0IGlzIGxpdmUgLSBhbnkgcGFja2V0IGNvdW50c1xuXHQgICAgdGhpcy5lbWl0KCdoZWFydGJlYXQnKTtcblxuXHQgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuXHQgICAgICBjYXNlICdvcGVuJzpcblx0ICAgICAgICB0aGlzLm9uSGFuZHNoYWtlKEpTT04ucGFyc2UocGFja2V0LmRhdGEpKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdwb25nJzpcblx0ICAgICAgICB0aGlzLnNldFBpbmcoKTtcblx0ICAgICAgICB0aGlzLmVtaXQoJ3BvbmcnKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdlcnJvcic6XG5cdCAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignc2VydmVyIGVycm9yJyk7XG5cdCAgICAgICAgZXJyLmNvZGUgPSBwYWNrZXQuZGF0YTtcblx0ICAgICAgICB0aGlzLm9uRXJyb3IoZXJyKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdtZXNzYWdlJzpcblx0ICAgICAgICB0aGlzLmVtaXQoJ2RhdGEnLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgcGFja2V0LmRhdGEpO1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgfVxuXHQgIH0gZWxzZSB7XG5cdCAgICBkZWJ1ZyQ2KCdwYWNrZXQgcmVjZWl2ZWQgd2l0aCBzb2NrZXQgcmVhZHlTdGF0ZSBcIiVzXCInLCB0aGlzLnJlYWR5U3RhdGUpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gaGFuZHNoYWtlIGNvbXBsZXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBoYW5kc2hha2Ugb2JqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uSGFuZHNoYWtlID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB0aGlzLmVtaXQoJ2hhbmRzaGFrZScsIGRhdGEpO1xuXHQgIHRoaXMuaWQgPSBkYXRhLnNpZDtcblx0ICB0aGlzLnRyYW5zcG9ydC5xdWVyeS5zaWQgPSBkYXRhLnNpZDtcblx0ICB0aGlzLnVwZ3JhZGVzID0gdGhpcy5maWx0ZXJVcGdyYWRlcyhkYXRhLnVwZ3JhZGVzKTtcblx0ICB0aGlzLnBpbmdJbnRlcnZhbCA9IGRhdGEucGluZ0ludGVydmFsO1xuXHQgIHRoaXMucGluZ1RpbWVvdXQgPSBkYXRhLnBpbmdUaW1lb3V0O1xuXHQgIHRoaXMub25PcGVuKCk7XG5cdCAgLy8gSW4gY2FzZSBvcGVuIGhhbmRsZXIgY2xvc2VzIHNvY2tldFxuXHQgIGlmICgnY2xvc2VkJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgdGhpcy5zZXRQaW5nKCk7XG5cblx0ICAvLyBQcm9sb25nIGxpdmVuZXNzIG9mIHNvY2tldCBvbiBoZWFydGJlYXRcblx0ICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdoZWFydGJlYXQnLCB0aGlzLm9uSGVhcnRiZWF0KTtcblx0ICB0aGlzLm9uKCdoZWFydGJlYXQnLCB0aGlzLm9uSGVhcnRiZWF0KTtcblx0fTtcblxuXHQvKipcblx0ICogUmVzZXRzIHBpbmcgdGltZW91dC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25IZWFydGJlYXQgPSBmdW5jdGlvbiAodGltZW91dCkge1xuXHQgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0VGltZXIpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBzZWxmLnBpbmdUaW1lb3V0VGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICgnY2xvc2VkJyA9PT0gc2VsZi5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgICBzZWxmLm9uQ2xvc2UoJ3BpbmcgdGltZW91dCcpO1xuXHQgIH0sIHRpbWVvdXQgfHwgc2VsZi5waW5nSW50ZXJ2YWwgKyBzZWxmLnBpbmdUaW1lb3V0KTtcblx0fTtcblxuXHQvKipcblx0ICogUGluZ3Mgc2VydmVyIGV2ZXJ5IGB0aGlzLnBpbmdJbnRlcnZhbGAgYW5kIGV4cGVjdHMgcmVzcG9uc2Vcblx0ICogd2l0aGluIGB0aGlzLnBpbmdUaW1lb3V0YCBvciBjbG9zZXMgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2V0UGluZyA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgY2xlYXJUaW1lb3V0KHNlbGYucGluZ0ludGVydmFsVGltZXIpO1xuXHQgIHNlbGYucGluZ0ludGVydmFsVGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnJDYoJ3dyaXRpbmcgcGluZyBwYWNrZXQgLSBleHBlY3RpbmcgcG9uZyB3aXRoaW4gJXNtcycsIHNlbGYucGluZ1RpbWVvdXQpO1xuXHQgICAgc2VsZi5waW5nKCk7XG5cdCAgICBzZWxmLm9uSGVhcnRiZWF0KHNlbGYucGluZ1RpbWVvdXQpO1xuXHQgIH0sIHNlbGYucGluZ0ludGVydmFsKTtcblx0fTtcblxuXHQvKipcblx0KiBTZW5kcyBhIHBpbmcgcGFja2V0LlxuXHQqXG5cdCogQGFwaSBwcml2YXRlXG5cdCovXG5cblx0U29ja2V0LnByb3RvdHlwZS5waW5nID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLnNlbmRQYWNrZXQoJ3BpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLmVtaXQoJ3BpbmcnKTtcblx0ICB9KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIG9uIGBkcmFpbmAgZXZlbnRcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25EcmFpbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLndyaXRlQnVmZmVyLnNwbGljZSgwLCB0aGlzLnByZXZCdWZmZXJMZW4pO1xuXG5cdCAgLy8gc2V0dGluZyBwcmV2QnVmZmVyTGVuID0gMCBpcyB2ZXJ5IGltcG9ydGFudFxuXHQgIC8vIGZvciBleGFtcGxlLCB3aGVuIHVwZ3JhZGluZywgdXBncmFkZSBwYWNrZXQgaXMgc2VudCBvdmVyLFxuXHQgIC8vIGFuZCBhIG5vbnplcm8gcHJldkJ1ZmZlckxlbiBjb3VsZCBjYXVzZSBwcm9ibGVtcyBvbiBgZHJhaW5gXG5cdCAgdGhpcy5wcmV2QnVmZmVyTGVuID0gMDtcblxuXHQgIGlmICgwID09PSB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCkge1xuXHQgICAgdGhpcy5lbWl0KCdkcmFpbicpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLmZsdXNoKCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBGbHVzaCB3cml0ZSBidWZmZXJzLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoJ2Nsb3NlZCcgIT09IHRoaXMucmVhZHlTdGF0ZSAmJiB0aGlzLnRyYW5zcG9ydC53cml0YWJsZSAmJiAhdGhpcy51cGdyYWRpbmcgJiYgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcblx0ICAgIGRlYnVnJDYoJ2ZsdXNoaW5nICVkIHBhY2tldHMgaW4gc29ja2V0JywgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpO1xuXHQgICAgdGhpcy50cmFuc3BvcnQuc2VuZCh0aGlzLndyaXRlQnVmZmVyKTtcblx0ICAgIC8vIGtlZXAgdHJhY2sgb2YgY3VycmVudCBsZW5ndGggb2Ygd3JpdGVCdWZmZXJcblx0ICAgIC8vIHNwbGljZSB3cml0ZUJ1ZmZlciBhbmQgY2FsbGJhY2tCdWZmZXIgb24gYGRyYWluYFxuXHQgICAgdGhpcy5wcmV2QnVmZmVyTGVuID0gdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGg7XG5cdCAgICB0aGlzLmVtaXQoJ2ZsdXNoJyk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBhIG1lc3NhZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG5cdCAqIEByZXR1cm4ge1NvY2tldH0gZm9yIGNoYWluaW5nLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLndyaXRlID0gU29ja2V0LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG1zZywgb3B0aW9ucywgZm4pIHtcblx0ICB0aGlzLnNlbmRQYWNrZXQoJ21lc3NhZ2UnLCBtc2csIG9wdGlvbnMsIGZuKTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBwYWNrZXQgdHlwZS5cblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGEuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2VuZFBhY2tldCA9IGZ1bmN0aW9uICh0eXBlLCBkYXRhLCBvcHRpb25zLCBmbikge1xuXHQgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZGF0YSkge1xuXHQgICAgZm4gPSBkYXRhO1xuXHQgICAgZGF0YSA9IHVuZGVmaW5lZDtcblx0ICB9XG5cblx0ICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMpIHtcblx0ICAgIGZuID0gb3B0aW9ucztcblx0ICAgIG9wdGlvbnMgPSBudWxsO1xuXHQgIH1cblxuXHQgIGlmICgnY2xvc2luZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnY2xvc2VkJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdCAgb3B0aW9ucy5jb21wcmVzcyA9IGZhbHNlICE9PSBvcHRpb25zLmNvbXByZXNzO1xuXG5cdCAgdmFyIHBhY2tldCA9IHtcblx0ICAgIHR5cGU6IHR5cGUsXG5cdCAgICBkYXRhOiBkYXRhLFxuXHQgICAgb3B0aW9uczogb3B0aW9uc1xuXHQgIH07XG5cdCAgdGhpcy5lbWl0KCdwYWNrZXRDcmVhdGUnLCBwYWNrZXQpO1xuXHQgIHRoaXMud3JpdGVCdWZmZXIucHVzaChwYWNrZXQpO1xuXHQgIGlmIChmbikgdGhpcy5vbmNlKCdmbHVzaCcsIGZuKTtcblx0ICB0aGlzLmZsdXNoKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlcyB0aGUgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2luZyc7XG5cblx0ICAgIHZhciBzZWxmID0gdGhpcztcblxuXHQgICAgaWYgKHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMub25jZSgnZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKHRoaXMudXBncmFkaW5nKSB7XG5cdCAgICAgICAgICB3YWl0Rm9yVXBncmFkZSgpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBjbG9zZSgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9IGVsc2UgaWYgKHRoaXMudXBncmFkaW5nKSB7XG5cdCAgICAgIHdhaXRGb3JVcGdyYWRlKCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBjbG9zZSgpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGNsb3NlKCkge1xuXHQgICAgc2VsZi5vbkNsb3NlKCdmb3JjZWQgY2xvc2UnKTtcblx0ICAgIGRlYnVnJDYoJ3NvY2tldCBjbG9zaW5nIC0gdGVsbGluZyB0cmFuc3BvcnQgdG8gY2xvc2UnKTtcblx0ICAgIHNlbGYudHJhbnNwb3J0LmNsb3NlKCk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gY2xlYW51cEFuZENsb3NlKCkge1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcigndXBncmFkZScsIGNsZWFudXBBbmRDbG9zZSk7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCd1cGdyYWRlRXJyb3InLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgICAgY2xvc2UoKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB3YWl0Rm9yVXBncmFkZSgpIHtcblx0ICAgIC8vIHdhaXQgZm9yIHVwZ3JhZGUgdG8gZmluaXNoIHNpbmNlIHdlIGNhbid0IHNlbmQgcGFja2V0cyB3aGlsZSBwYXVzaW5nIGEgdHJhbnNwb3J0XG5cdCAgICBzZWxmLm9uY2UoJ3VwZ3JhZGUnLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgICAgc2VsZi5vbmNlKCd1cGdyYWRlRXJyb3InLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgIH1cblxuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiB0cmFuc3BvcnQgZXJyb3Jcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblx0ICBkZWJ1ZyQ2KCdzb2NrZXQgZXJyb3IgJWonLCBlcnIpO1xuXHQgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSBmYWxzZTtcblx0ICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLm9uQ2xvc2UoJ3RyYW5zcG9ydCBlcnJvcicsIGVycik7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBjbG9zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uIChyZWFzb24sIGRlc2MpIHtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ2Nsb3NpbmcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIGRlYnVnJDYoJ3NvY2tldCBjbG9zZSB3aXRoIHJlYXNvbjogXCIlc1wiJywgcmVhc29uKTtcblx0ICAgIHZhciBzZWxmID0gdGhpcztcblxuXHQgICAgLy8gY2xlYXIgdGltZXJzXG5cdCAgICBjbGVhclRpbWVvdXQodGhpcy5waW5nSW50ZXJ2YWxUaW1lcik7XG5cdCAgICBjbGVhclRpbWVvdXQodGhpcy5waW5nVGltZW91dFRpbWVyKTtcblxuXHQgICAgLy8gc3RvcCBldmVudCBmcm9tIGZpcmluZyBhZ2FpbiBmb3IgdHJhbnNwb3J0XG5cdCAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2Nsb3NlJyk7XG5cblx0ICAgIC8vIGVuc3VyZSB0cmFuc3BvcnQgd29uJ3Qgc3RheSBvcGVuXG5cdCAgICB0aGlzLnRyYW5zcG9ydC5jbG9zZSgpO1xuXG5cdCAgICAvLyBpZ25vcmUgZnVydGhlciB0cmFuc3BvcnQgY29tbXVuaWNhdGlvblxuXHQgICAgdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cblx0ICAgIC8vIHNldCByZWFkeSBzdGF0ZVxuXHQgICAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cblx0ICAgIC8vIGNsZWFyIHNlc3Npb24gaWRcblx0ICAgIHRoaXMuaWQgPSBudWxsO1xuXG5cdCAgICAvLyBlbWl0IGNsb3NlIGV2ZW50XG5cdCAgICB0aGlzLmVtaXQoJ2Nsb3NlJywgcmVhc29uLCBkZXNjKTtcblxuXHQgICAgLy8gY2xlYW4gYnVmZmVycyBhZnRlciwgc28gdXNlcnMgY2FuIHN0aWxsXG5cdCAgICAvLyBncmFiIHRoZSBidWZmZXJzIG9uIGBjbG9zZWAgZXZlbnRcblx0ICAgIHNlbGYud3JpdGVCdWZmZXIgPSBbXTtcblx0ICAgIHNlbGYucHJldkJ1ZmZlckxlbiA9IDA7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBGaWx0ZXJzIHVwZ3JhZGVzLCByZXR1cm5pbmcgb25seSB0aG9zZSBtYXRjaGluZyBjbGllbnQgdHJhbnNwb3J0cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gc2VydmVyIHVwZ3JhZGVzXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKlxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmZpbHRlclVwZ3JhZGVzID0gZnVuY3Rpb24gKHVwZ3JhZGVzKSB7XG5cdCAgdmFyIGZpbHRlcmVkVXBncmFkZXMgPSBbXTtcblx0ICBmb3IgKHZhciBpID0gMCwgaiA9IHVwZ3JhZGVzLmxlbmd0aDsgaSA8IGo7IGkrKykge1xuXHQgICAgaWYgKH5pbmRleCh0aGlzLnRyYW5zcG9ydHMsIHVwZ3JhZGVzW2ldKSkgZmlsdGVyZWRVcGdyYWRlcy5wdXNoKHVwZ3JhZGVzW2ldKTtcblx0ICB9XG5cdCAgcmV0dXJuIGZpbHRlcmVkVXBncmFkZXM7XG5cdH07XG5cblx0dmFyIHNvY2tldCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHNvY2tldCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHNvY2tldFxuXHR9KTtcblxuXHR2YXIgcmVxdWlyZSQkMCQ0ID0gKCBzb2NrZXQkMSAmJiBzb2NrZXQgKSB8fCBzb2NrZXQkMTtcblxuXHR2YXIgbGliID0gcmVxdWlyZSQkMCQ0O1xuXG5cdC8qKlxuXHQgKiBFeHBvcnRzIHBhcnNlclxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKlxuXHQgKi9cblx0dmFyIHBhcnNlciQxID0gcGFyc2VyO1xuXHRsaWIucGFyc2VyID0gcGFyc2VyJDE7XG5cblx0dmFyIGxpYiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGxpYixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGxpYixcblx0XHRwYXJzZXI6IHBhcnNlciQxXG5cdH0pO1xuXG5cdHZhciB0b0FycmF5XzEgPSB0b0FycmF5JDE7XG5cblx0ZnVuY3Rpb24gdG9BcnJheSQxKGxpc3QsIGluZGV4KSB7XG5cdCAgICB2YXIgYXJyYXkgPSBbXTtcblxuXHQgICAgaW5kZXggPSBpbmRleCB8fCAwO1xuXG5cdCAgICBmb3IgKHZhciBpID0gaW5kZXggfHwgMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBhcnJheVtpIC0gaW5kZXhdID0gbGlzdFtpXTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGFycmF5O1xuXHR9XG5cblx0dmFyIHRvQXJyYXkkMiA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0b0FycmF5XzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB0b0FycmF5XzFcblx0fSk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgb25fMSA9IG9uO1xuXG5cdC8qKlxuXHQgKiBIZWxwZXIgZm9yIHN1YnNjcmlwdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fEV2ZW50RW1pdHRlcn0gb2JqIHdpdGggYEVtaXR0ZXJgIG1peGluIG9yIGBFdmVudEVtaXR0ZXJgXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBuYW1lXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIG9uKG9iaiwgZXYsIGZuKSB7XG5cdCAgb2JqLm9uKGV2LCBmbik7XG5cdCAgcmV0dXJuIHtcblx0ICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICAgIG9iai5yZW1vdmVMaXN0ZW5lcihldiwgZm4pO1xuXHQgICAgfVxuXHQgIH07XG5cdH1cblxuXHR2YXIgb24kMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBvbl8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogb25fMVxuXHR9KTtcblxuXHQvKipcblx0ICogU2xpY2UgcmVmZXJlbmNlLlxuXHQgKi9cblxuXHR2YXIgc2xpY2UgPSBbXS5zbGljZTtcblxuXHQvKipcblx0ICogQmluZCBgb2JqYCB0byBgZm5gLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBmbiBvciBzdHJpbmdcblx0ICogQHJldHVybiB7RnVuY3Rpb259XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBjb21wb25lbnRCaW5kID0gZnVuY3Rpb24gY29tcG9uZW50QmluZChvYmosIGZuKSB7XG5cdCAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiBmbikgZm4gPSBvYmpbZm5dO1xuXHQgIGlmICgnZnVuY3Rpb24nICE9IHR5cGVvZiBmbikgdGhyb3cgbmV3IEVycm9yKCdiaW5kKCkgcmVxdWlyZXMgYSBmdW5jdGlvbicpO1xuXHQgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXHQgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICByZXR1cm4gZm4uYXBwbHkob2JqLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcblx0ICB9O1xuXHR9O1xuXG5cdHZhciBjb21wb25lbnRCaW5kJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogY29tcG9uZW50QmluZCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGNvbXBvbmVudEJpbmRcblx0fSk7XG5cblx0dmFyIHBhcnNlciQyID0gKCBzb2NrZXRfaW9QYXJzZXIkMSAmJiBzb2NrZXRfaW9QYXJzZXIgKSB8fCBzb2NrZXRfaW9QYXJzZXIkMTtcblxuXHR2YXIgdG9BcnJheSQzID0gKCB0b0FycmF5JDIgJiYgdG9BcnJheV8xICkgfHwgdG9BcnJheSQyO1xuXG5cdHZhciBvbiQyID0gKCBvbiQxICYmIG9uXzEgKSB8fCBvbiQxO1xuXG5cdHZhciBiaW5kID0gKCBjb21wb25lbnRCaW5kJDEgJiYgY29tcG9uZW50QmluZCApIHx8IGNvbXBvbmVudEJpbmQkMTtcblxuXHR2YXIgc29ja2V0JDIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBkZWJ1ZyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudDpzb2NrZXQnKTtcblxuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBleHBvcnRzLlxuXHQgICAqL1xuXG5cdCAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gU29ja2V0O1xuXG5cdCAgLyoqXG5cdCAgICogSW50ZXJuYWwgZXZlbnRzIChibGFja2xpc3RlZCkuXG5cdCAgICogVGhlc2UgZXZlbnRzIGNhbid0IGJlIGVtaXR0ZWQgYnkgdGhlIHVzZXIuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIHZhciBldmVudHMgPSB7XG5cdCAgICBjb25uZWN0OiAxLFxuXHQgICAgY29ubmVjdF9lcnJvcjogMSxcblx0ICAgIGNvbm5lY3RfdGltZW91dDogMSxcblx0ICAgIGNvbm5lY3Rpbmc6IDEsXG5cdCAgICBkaXNjb25uZWN0OiAxLFxuXHQgICAgZXJyb3I6IDEsXG5cdCAgICByZWNvbm5lY3Q6IDEsXG5cdCAgICByZWNvbm5lY3RfYXR0ZW1wdDogMSxcblx0ICAgIHJlY29ubmVjdF9mYWlsZWQ6IDEsXG5cdCAgICByZWNvbm5lY3RfZXJyb3I6IDEsXG5cdCAgICByZWNvbm5lY3Rpbmc6IDEsXG5cdCAgICBwaW5nOiAxLFxuXHQgICAgcG9uZzogMVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTaG9ydGN1dCB0byBgRW1pdHRlciNlbWl0YC5cblx0ICAgKi9cblxuXHQgIHZhciBlbWl0ID0gRW1pdHRlci5wcm90b3R5cGUuZW1pdDtcblxuXHQgIC8qKlxuXHQgICAqIGBTb2NrZXRgIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIFNvY2tldChpbywgbnNwLCBvcHRzKSB7XG5cdCAgICB0aGlzLmlvID0gaW87XG5cdCAgICB0aGlzLm5zcCA9IG5zcDtcblx0ICAgIHRoaXMuanNvbiA9IHRoaXM7IC8vIGNvbXBhdFxuXHQgICAgdGhpcy5pZHMgPSAwO1xuXHQgICAgdGhpcy5hY2tzID0ge307XG5cdCAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcblx0ICAgIHRoaXMuc2VuZEJ1ZmZlciA9IFtdO1xuXHQgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcblx0ICAgIHRoaXMuZGlzY29ubmVjdGVkID0gdHJ1ZTtcblx0ICAgIHRoaXMuZmxhZ3MgPSB7fTtcblx0ICAgIGlmIChvcHRzICYmIG9wdHMucXVlcnkpIHtcblx0ICAgICAgdGhpcy5xdWVyeSA9IG9wdHMucXVlcnk7XG5cdCAgICB9XG5cdCAgICBpZiAodGhpcy5pby5hdXRvQ29ubmVjdCkgdGhpcy5vcGVuKCk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIoU29ja2V0LnByb3RvdHlwZSk7XG5cblx0ICAvKipcblx0ICAgKiBTdWJzY3JpYmUgdG8gb3BlbiwgY2xvc2UgYW5kIHBhY2tldCBldmVudHNcblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5zdWJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5zdWJzKSByZXR1cm47XG5cblx0ICAgIHZhciBpbyA9IHRoaXMuaW87XG5cdCAgICB0aGlzLnN1YnMgPSBbb24kMihpbywgJ29wZW4nLCBiaW5kKHRoaXMsICdvbm9wZW4nKSksIG9uJDIoaW8sICdwYWNrZXQnLCBiaW5kKHRoaXMsICdvbnBhY2tldCcpKSwgb24kMihpbywgJ2Nsb3NlJywgYmluZCh0aGlzLCAnb25jbG9zZScpKV07XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFwiT3BlbnNcIiB0aGUgc29ja2V0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub3BlbiA9IFNvY2tldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkgcmV0dXJuIHRoaXM7XG5cblx0ICAgIHRoaXMuc3ViRXZlbnRzKCk7XG5cdCAgICB0aGlzLmlvLm9wZW4oKTsgLy8gZW5zdXJlIG9wZW5cblx0ICAgIGlmICgnb3BlbicgPT09IHRoaXMuaW8ucmVhZHlTdGF0ZSkgdGhpcy5vbm9wZW4oKTtcblx0ICAgIHRoaXMuZW1pdCgnY29ubmVjdGluZycpO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNlbmRzIGEgYG1lc3NhZ2VgIGV2ZW50LlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciBhcmdzID0gdG9BcnJheSQzKGFyZ3VtZW50cyk7XG5cdCAgICBhcmdzLnVuc2hpZnQoJ21lc3NhZ2UnKTtcblx0ICAgIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBhcmdzKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBPdmVycmlkZSBgZW1pdGAuXG5cdCAgICogSWYgdGhlIGV2ZW50IGlzIGluIGBldmVudHNgLCBpdCdzIGVtaXR0ZWQgbm9ybWFsbHkuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgbmFtZVxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoZXYpIHtcblx0ICAgIGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoZXYpKSB7XG5cdCAgICAgIGVtaXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0ICAgICAgcmV0dXJuIHRoaXM7XG5cdCAgICB9XG5cblx0ICAgIHZhciBhcmdzID0gdG9BcnJheSQzKGFyZ3VtZW50cyk7XG5cdCAgICB2YXIgcGFja2V0ID0ge1xuXHQgICAgICB0eXBlOiAodGhpcy5mbGFncy5iaW5hcnkgIT09IHVuZGVmaW5lZCA/IHRoaXMuZmxhZ3MuYmluYXJ5IDogaGFzQmluYXJ5JDEoYXJncykpID8gcGFyc2VyJDIuQklOQVJZX0VWRU5UIDogcGFyc2VyJDIuRVZFTlQsXG5cdCAgICAgIGRhdGE6IGFyZ3Ncblx0ICAgIH07XG5cblx0ICAgIHBhY2tldC5vcHRpb25zID0ge307XG5cdCAgICBwYWNrZXQub3B0aW9ucy5jb21wcmVzcyA9ICF0aGlzLmZsYWdzIHx8IGZhbHNlICE9PSB0aGlzLmZsYWdzLmNvbXByZXNzO1xuXG5cdCAgICAvLyBldmVudCBhY2sgY2FsbGJhY2tcblx0ICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdKSB7XG5cdCAgICAgIGRlYnVnKCdlbWl0dGluZyBwYWNrZXQgd2l0aCBhY2sgaWQgJWQnLCB0aGlzLmlkcyk7XG5cdCAgICAgIHRoaXMuYWNrc1t0aGlzLmlkc10gPSBhcmdzLnBvcCgpO1xuXHQgICAgICBwYWNrZXQuaWQgPSB0aGlzLmlkcysrO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgdGhpcy5wYWNrZXQocGFja2V0KTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRoaXMuc2VuZEJ1ZmZlci5wdXNoKHBhY2tldCk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuZmxhZ3MgPSB7fTtcblxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNlbmRzIGEgcGFja2V0LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5wYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICBwYWNrZXQubnNwID0gdGhpcy5uc3A7XG5cdCAgICB0aGlzLmlvLnBhY2tldChwYWNrZXQpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBlbmdpbmUgYG9wZW5gLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnKCd0cmFuc3BvcnQgaXMgb3BlbiAtIGNvbm5lY3RpbmcnKTtcblxuXHQgICAgLy8gd3JpdGUgY29ubmVjdCBwYWNrZXQgaWYgbmVjZXNzYXJ5XG5cdCAgICBpZiAoJy8nICE9PSB0aGlzLm5zcCkge1xuXHQgICAgICBpZiAodGhpcy5xdWVyeSkge1xuXHQgICAgICAgIHZhciBxdWVyeSA9IF90eXBlb2YodGhpcy5xdWVyeSkgPT09ICdvYmplY3QnID8gcGFyc2VxcyQyLmVuY29kZSh0aGlzLnF1ZXJ5KSA6IHRoaXMucXVlcnk7XG5cdCAgICAgICAgZGVidWcoJ3NlbmRpbmcgY29ubmVjdCBwYWNrZXQgd2l0aCBxdWVyeSAlcycsIHF1ZXJ5KTtcblx0ICAgICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IHBhcnNlciQyLkNPTk5FQ1QsIHF1ZXJ5OiBxdWVyeSB9KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IHBhcnNlciQyLkNPTk5FQ1QgfSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gZW5naW5lIGBjbG9zZWAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICBkZWJ1ZygnY2xvc2UgKCVzKScsIHJlYXNvbik7XG5cdCAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuXHQgICAgdGhpcy5kaXNjb25uZWN0ZWQgPSB0cnVlO1xuXHQgICAgZGVsZXRlIHRoaXMuaWQ7XG5cdCAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3QnLCByZWFzb24pO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgd2l0aCBzb2NrZXQgcGFja2V0LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbnBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHZhciBzYW1lTmFtZXNwYWNlID0gcGFja2V0Lm5zcCA9PT0gdGhpcy5uc3A7XG5cdCAgICB2YXIgcm9vdE5hbWVzcGFjZUVycm9yID0gcGFja2V0LnR5cGUgPT09IHBhcnNlciQyLkVSUk9SICYmIHBhY2tldC5uc3AgPT09ICcvJztcblxuXHQgICAgaWYgKCFzYW1lTmFtZXNwYWNlICYmICFyb290TmFtZXNwYWNlRXJyb3IpIHJldHVybjtcblxuXHQgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuXHQgICAgICBjYXNlIHBhcnNlciQyLkNPTk5FQ1Q6XG5cdCAgICAgICAgdGhpcy5vbmNvbm5lY3QoKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkVWRU5UOlxuXHQgICAgICAgIHRoaXMub25ldmVudChwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQklOQVJZX0VWRU5UOlxuXHQgICAgICAgIHRoaXMub25ldmVudChwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQUNLOlxuXHQgICAgICAgIHRoaXMub25hY2socGFja2V0KTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkJJTkFSWV9BQ0s6XG5cdCAgICAgICAgdGhpcy5vbmFjayhwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuRElTQ09OTkVDVDpcblx0ICAgICAgICB0aGlzLm9uZGlzY29ubmVjdCgpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuRVJST1I6XG5cdCAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgICBicmVhaztcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgZXZlbnQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uZXZlbnQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICB2YXIgYXJncyA9IHBhY2tldC5kYXRhIHx8IFtdO1xuXHQgICAgZGVidWcoJ2VtaXR0aW5nIGV2ZW50ICVqJywgYXJncyk7XG5cblx0ICAgIGlmIChudWxsICE9IHBhY2tldC5pZCkge1xuXHQgICAgICBkZWJ1ZygnYXR0YWNoaW5nIGFjayBjYWxsYmFjayB0byBldmVudCcpO1xuXHQgICAgICBhcmdzLnB1c2godGhpcy5hY2socGFja2V0LmlkKSk7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICBlbWl0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGhpcy5yZWNlaXZlQnVmZmVyLnB1c2goYXJncyk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFByb2R1Y2VzIGFuIGFjayBjYWxsYmFjayB0byBlbWl0IHdpdGggYW4gZXZlbnQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuYWNrID0gZnVuY3Rpb24gKGlkKSB7XG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgICB2YXIgc2VudCA9IGZhbHNlO1xuXHQgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgLy8gcHJldmVudCBkb3VibGUgY2FsbGJhY2tzXG5cdCAgICAgIGlmIChzZW50KSByZXR1cm47XG5cdCAgICAgIHNlbnQgPSB0cnVlO1xuXHQgICAgICB2YXIgYXJncyA9IHRvQXJyYXkkMyhhcmd1bWVudHMpO1xuXHQgICAgICBkZWJ1Zygnc2VuZGluZyBhY2sgJWonLCBhcmdzKTtcblxuXHQgICAgICBzZWxmLnBhY2tldCh7XG5cdCAgICAgICAgdHlwZTogaGFzQmluYXJ5JDEoYXJncykgPyBwYXJzZXIkMi5CSU5BUllfQUNLIDogcGFyc2VyJDIuQUNLLFxuXHQgICAgICAgIGlkOiBpZCxcblx0ICAgICAgICBkYXRhOiBhcmdzXG5cdCAgICAgIH0pO1xuXHQgICAgfTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgYWNrbm93bGVnZW1lbnQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uYWNrID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgdmFyIGFjayA9IHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuXHQgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBhY2spIHtcblx0ICAgICAgZGVidWcoJ2NhbGxpbmcgYWNrICVzIHdpdGggJWonLCBwYWNrZXQuaWQsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgYWNrLmFwcGx5KHRoaXMsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgZGVsZXRlIHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgZGVidWcoJ2JhZCBhY2sgJXMnLCBwYWNrZXQuaWQpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBzZXJ2ZXIgY29ubmVjdC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG5cdCAgICB0aGlzLmRpc2Nvbm5lY3RlZCA9IGZhbHNlO1xuXHQgICAgdGhpcy5lbWl0KCdjb25uZWN0Jyk7XG5cdCAgICB0aGlzLmVtaXRCdWZmZXJlZCgpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbWl0IGJ1ZmZlcmVkIGV2ZW50cyAocmVjZWl2ZWQgYW5kIGVtaXR0ZWQpLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmVtaXRCdWZmZXJlZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciBpO1xuXHQgICAgZm9yIChpID0gMDsgaSA8IHRoaXMucmVjZWl2ZUJ1ZmZlci5sZW5ndGg7IGkrKykge1xuXHQgICAgICBlbWl0LmFwcGx5KHRoaXMsIHRoaXMucmVjZWl2ZUJ1ZmZlcltpXSk7XG5cdCAgICB9XG5cdCAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuc2VuZEJ1ZmZlci5sZW5ndGg7IGkrKykge1xuXHQgICAgICB0aGlzLnBhY2tldCh0aGlzLnNlbmRCdWZmZXJbaV0pO1xuXHQgICAgfVxuXHQgICAgdGhpcy5zZW5kQnVmZmVyID0gW107XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIHNlcnZlciBkaXNjb25uZWN0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnKCdzZXJ2ZXIgZGlzY29ubmVjdCAoJXMpJywgdGhpcy5uc3ApO1xuXHQgICAgdGhpcy5kZXN0cm95KCk7XG5cdCAgICB0aGlzLm9uY2xvc2UoJ2lvIHNlcnZlciBkaXNjb25uZWN0Jyk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGZvcmNlZCBjbGllbnQvc2VydmVyIHNpZGUgZGlzY29ubmVjdGlvbnMsXG5cdCAgICogdGhpcyBtZXRob2QgZW5zdXJlcyB0aGUgbWFuYWdlciBzdG9wcyB0cmFja2luZyB1cyBhbmRcblx0ICAgKiB0aGF0IHJlY29ubmVjdGlvbnMgZG9uJ3QgZ2V0IHRyaWdnZXJlZCBmb3IgdGhpcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZS5cblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLnN1YnMpIHtcblx0ICAgICAgLy8gY2xlYW4gc3Vic2NyaXB0aW9ucyB0byBhdm9pZCByZWNvbm5lY3Rpb25zXG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdWJzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgdGhpcy5zdWJzW2ldLmRlc3Ryb3koKTtcblx0ICAgICAgfVxuXHQgICAgICB0aGlzLnN1YnMgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmlvLmRlc3Ryb3kodGhpcyk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIERpc2Nvbm5lY3RzIHRoZSBzb2NrZXQgbWFudWFsbHkuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5jbG9zZSA9IFNvY2tldC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICBkZWJ1ZygncGVyZm9ybWluZyBkaXNjb25uZWN0ICglcyknLCB0aGlzLm5zcCk7XG5cdCAgICAgIHRoaXMucGFja2V0KHsgdHlwZTogcGFyc2VyJDIuRElTQ09OTkVDVCB9KTtcblx0ICAgIH1cblxuXHQgICAgLy8gcmVtb3ZlIHNvY2tldCBmcm9tIHBvb2xcblx0ICAgIHRoaXMuZGVzdHJveSgpO1xuXG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgLy8gZmlyZSBldmVudHNcblx0ICAgICAgdGhpcy5vbmNsb3NlKCdpbyBjbGllbnQgZGlzY29ubmVjdCcpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNldHMgdGhlIGNvbXByZXNzIGZsYWcuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlmIGB0cnVlYCwgY29tcHJlc3NlcyB0aGUgc2VuZGluZyBkYXRhXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuY29tcHJlc3MgPSBmdW5jdGlvbiAoY29tcHJlc3MpIHtcblx0ICAgIHRoaXMuZmxhZ3MuY29tcHJlc3MgPSBjb21wcmVzcztcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTZXRzIHRoZSBiaW5hcnkgZmxhZ1xuXHQgICAqXG5cdCAgICogQHBhcmFtIHtCb29sZWFufSB3aGV0aGVyIHRoZSBlbWl0dGVkIGRhdGEgY29udGFpbnMgYmluYXJ5XG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuYmluYXJ5ID0gZnVuY3Rpb24gKGJpbmFyeSkge1xuXHQgICAgdGhpcy5mbGFncy5iaW5hcnkgPSBiaW5hcnk7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXHR9KTtcblxuXHR2YXIgc29ja2V0JDMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogc29ja2V0JDIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBzb2NrZXQkMlxuXHR9KTtcblxuXHQvKipcblx0ICogRXhwb3NlIGBCYWNrb2ZmYC5cblx0ICovXG5cblx0dmFyIGJhY2tvMiA9IEJhY2tvZmY7XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgYmFja29mZiB0aW1lciB3aXRoIGBvcHRzYC5cblx0ICpcblx0ICogLSBgbWluYCBpbml0aWFsIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIFsxMDBdXG5cdCAqIC0gYG1heGAgbWF4IHRpbWVvdXQgWzEwMDAwXVxuXHQgKiAtIGBqaXR0ZXJgIFswXVxuXHQgKiAtIGBmYWN0b3JgIFsyXVxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBCYWNrb2ZmKG9wdHMpIHtcblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblx0ICB0aGlzLm1zID0gb3B0cy5taW4gfHwgMTAwO1xuXHQgIHRoaXMubWF4ID0gb3B0cy5tYXggfHwgMTAwMDA7XG5cdCAgdGhpcy5mYWN0b3IgPSBvcHRzLmZhY3RvciB8fCAyO1xuXHQgIHRoaXMuaml0dGVyID0gb3B0cy5qaXR0ZXIgPiAwICYmIG9wdHMuaml0dGVyIDw9IDEgPyBvcHRzLmppdHRlciA6IDA7XG5cdCAgdGhpcy5hdHRlbXB0cyA9IDA7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBiYWNrb2ZmIGR1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLmR1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBtcyA9IHRoaXMubXMgKiBNYXRoLnBvdyh0aGlzLmZhY3RvciwgdGhpcy5hdHRlbXB0cysrKTtcblx0ICBpZiAodGhpcy5qaXR0ZXIpIHtcblx0ICAgIHZhciByYW5kID0gTWF0aC5yYW5kb20oKTtcblx0ICAgIHZhciBkZXZpYXRpb24gPSBNYXRoLmZsb29yKHJhbmQgKiB0aGlzLmppdHRlciAqIG1zKTtcblx0ICAgIG1zID0gKE1hdGguZmxvb3IocmFuZCAqIDEwKSAmIDEpID09IDAgPyBtcyAtIGRldmlhdGlvbiA6IG1zICsgZGV2aWF0aW9uO1xuXHQgIH1cblx0ICByZXR1cm4gTWF0aC5taW4obXMsIHRoaXMubWF4KSB8IDA7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRoZSBudW1iZXIgb2YgYXR0ZW1wdHMuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuYXR0ZW1wdHMgPSAwO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIG1pbmltdW0gZHVyYXRpb25cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUuc2V0TWluID0gZnVuY3Rpb24gKG1pbikge1xuXHQgIHRoaXMubXMgPSBtaW47XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgbWF4aW11bSBkdXJhdGlvblxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5zZXRNYXggPSBmdW5jdGlvbiAobWF4KSB7XG5cdCAgdGhpcy5tYXggPSBtYXg7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgaml0dGVyXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnNldEppdHRlciA9IGZ1bmN0aW9uIChqaXR0ZXIpIHtcblx0ICB0aGlzLmppdHRlciA9IGppdHRlcjtcblx0fTtcblxuXHR2YXIgYmFja28yJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmFja28yLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmFja28yXG5cdH0pO1xuXG5cdHZhciBlaW8gPSAoIGxpYiQxICYmIGxpYiApIHx8IGxpYiQxO1xuXG5cdHZhciBTb2NrZXQkMSA9ICggc29ja2V0JDMgJiYgc29ja2V0JDIgKSB8fCBzb2NrZXQkMztcblxuXHR2YXIgQmFja29mZiQxID0gKCBiYWNrbzIkMSAmJiBiYWNrbzIgKSB8fCBiYWNrbzIkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQ6bWFuYWdlcicpO1xuXG5cdC8qKlxuXHQgKiBJRTYrIGhhc093blByb3BlcnR5XG5cdCAqL1xuXG5cdHZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0c1xuXHQgKi9cblxuXHR2YXIgbWFuYWdlciA9IE1hbmFnZXI7XG5cblx0LyoqXG5cdCAqIGBNYW5hZ2VyYCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGVuZ2luZSBpbnN0YW5jZSBvciBlbmdpbmUgdXJpL29wdHNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gTWFuYWdlcih1cmksIG9wdHMpIHtcblx0ICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTWFuYWdlcikpIHJldHVybiBuZXcgTWFuYWdlcih1cmksIG9wdHMpO1xuXHQgIGlmICh1cmkgJiYgJ29iamVjdCcgPT09ICh0eXBlb2YgdXJpID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih1cmkpKSkge1xuXHQgICAgb3B0cyA9IHVyaTtcblx0ICAgIHVyaSA9IHVuZGVmaW5lZDtcblx0ICB9XG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cblx0ICBvcHRzLnBhdGggPSBvcHRzLnBhdGggfHwgJy9zb2NrZXQuaW8nO1xuXHQgIHRoaXMubnNwcyA9IHt9O1xuXHQgIHRoaXMuc3VicyA9IFtdO1xuXHQgIHRoaXMub3B0cyA9IG9wdHM7XG5cdCAgdGhpcy5yZWNvbm5lY3Rpb24ob3B0cy5yZWNvbm5lY3Rpb24gIT09IGZhbHNlKTtcblx0ICB0aGlzLnJlY29ubmVjdGlvbkF0dGVtcHRzKG9wdHMucmVjb25uZWN0aW9uQXR0ZW1wdHMgfHwgSW5maW5pdHkpO1xuXHQgIHRoaXMucmVjb25uZWN0aW9uRGVsYXkob3B0cy5yZWNvbm5lY3Rpb25EZWxheSB8fCAxMDAwKTtcblx0ICB0aGlzLnJlY29ubmVjdGlvbkRlbGF5TWF4KG9wdHMucmVjb25uZWN0aW9uRGVsYXlNYXggfHwgNTAwMCk7XG5cdCAgdGhpcy5yYW5kb21pemF0aW9uRmFjdG9yKG9wdHMucmFuZG9taXphdGlvbkZhY3RvciB8fCAwLjUpO1xuXHQgIHRoaXMuYmFja29mZiA9IG5ldyBCYWNrb2ZmJDEoe1xuXHQgICAgbWluOiB0aGlzLnJlY29ubmVjdGlvbkRlbGF5KCksXG5cdCAgICBtYXg6IHRoaXMucmVjb25uZWN0aW9uRGVsYXlNYXgoKSxcblx0ICAgIGppdHRlcjogdGhpcy5yYW5kb21pemF0aW9uRmFjdG9yKClcblx0ICB9KTtcblx0ICB0aGlzLnRpbWVvdXQobnVsbCA9PSBvcHRzLnRpbWVvdXQgPyAyMDAwMCA6IG9wdHMudGltZW91dCk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy51cmkgPSB1cmk7XG5cdCAgdGhpcy5jb25uZWN0aW5nID0gW107XG5cdCAgdGhpcy5sYXN0UGluZyA9IG51bGw7XG5cdCAgdGhpcy5lbmNvZGluZyA9IGZhbHNlO1xuXHQgIHRoaXMucGFja2V0QnVmZmVyID0gW107XG5cdCAgdmFyIF9wYXJzZXIgPSBvcHRzLnBhcnNlciB8fCBwYXJzZXIkMjtcblx0ICB0aGlzLmVuY29kZXIgPSBuZXcgX3BhcnNlci5FbmNvZGVyKCk7XG5cdCAgdGhpcy5kZWNvZGVyID0gbmV3IF9wYXJzZXIuRGVjb2RlcigpO1xuXHQgIHRoaXMuYXV0b0Nvbm5lY3QgPSBvcHRzLmF1dG9Db25uZWN0ICE9PSBmYWxzZTtcblx0ICBpZiAodGhpcy5hdXRvQ29ubmVjdCkgdGhpcy5vcGVuKCk7XG5cdH1cblxuXHQvKipcblx0ICogUHJvcGFnYXRlIGdpdmVuIGV2ZW50IHRvIHNvY2tldHMgYW5kIGVtaXQgb24gYHRoaXNgXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5lbWl0QWxsID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHQgIGZvciAodmFyIG5zcCBpbiB0aGlzLm5zcHMpIHtcblx0ICAgIGlmIChoYXMuY2FsbCh0aGlzLm5zcHMsIG5zcCkpIHtcblx0ICAgICAgdGhpcy5uc3BzW25zcF0uZW1pdC5hcHBseSh0aGlzLm5zcHNbbnNwXSwgYXJndW1lbnRzKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFVwZGF0ZSBgc29ja2V0LmlkYCBvZiBhbGwgc29ja2V0c1xuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUudXBkYXRlU29ja2V0SWRzID0gZnVuY3Rpb24gKCkge1xuXHQgIGZvciAodmFyIG5zcCBpbiB0aGlzLm5zcHMpIHtcblx0ICAgIGlmIChoYXMuY2FsbCh0aGlzLm5zcHMsIG5zcCkpIHtcblx0ICAgICAgdGhpcy5uc3BzW25zcF0uaWQgPSB0aGlzLmdlbmVyYXRlSWQobnNwKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIGdlbmVyYXRlIGBzb2NrZXQuaWRgIGZvciB0aGUgZ2l2ZW4gYG5zcGBcblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5zcFxuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5nZW5lcmF0ZUlkID0gZnVuY3Rpb24gKG5zcCkge1xuXHQgIHJldHVybiAobnNwID09PSAnLycgPyAnJyA6IG5zcCArICcjJykgKyB0aGlzLmVuZ2luZS5pZDtcblx0fTtcblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihNYW5hZ2VyLnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGByZWNvbm5lY3Rpb25gIGNvbmZpZy5cblx0ICpcblx0ICogQHBhcmFtIHtCb29sZWFufSB0cnVlL2ZhbHNlIGlmIGl0IHNob3VsZCBhdXRvbWF0aWNhbGx5IHJlY29ubmVjdFxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbiA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uO1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbiA9ICEhdjtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgcmVjb25uZWN0aW9uIGF0dGVtcHRzIGNvbmZpZy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG1heCByZWNvbm5lY3Rpb24gYXR0ZW1wdHMgYmVmb3JlIGdpdmluZyB1cFxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbkF0dGVtcHRzID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cztcblx0ICB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cyA9IHY7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGRlbGF5IGJldHdlZW4gcmVjb25uZWN0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uRGVsYXkgPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5O1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5ID0gdjtcblx0ICB0aGlzLmJhY2tvZmYgJiYgdGhpcy5iYWNrb2ZmLnNldE1pbih2KTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yYW5kb21pemF0aW9uRmFjdG9yID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yYW5kb21pemF0aW9uRmFjdG9yO1xuXHQgIHRoaXMuX3JhbmRvbWl6YXRpb25GYWN0b3IgPSB2O1xuXHQgIHRoaXMuYmFja29mZiAmJiB0aGlzLmJhY2tvZmYuc2V0Sml0dGVyKHYpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBtYXhpbXVtIGRlbGF5IGJldHdlZW4gcmVjb25uZWN0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uRGVsYXlNYXggPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4O1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4ID0gdjtcblx0ICB0aGlzLmJhY2tvZmYgJiYgdGhpcy5iYWNrb2ZmLnNldE1heCh2KTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY29ubmVjdGlvbiB0aW1lb3V0LiBgZmFsc2VgIHRvIGRpc2FibGVcblx0ICpcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS50aW1lb3V0ID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl90aW1lb3V0O1xuXHQgIHRoaXMuX3RpbWVvdXQgPSB2O1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgdHJ5aW5nIHRvIHJlY29ubmVjdCBpZiByZWNvbm5lY3Rpb24gaXMgZW5hYmxlZCBhbmQgd2UgaGF2ZSBub3Rcblx0ICogc3RhcnRlZCByZWNvbm5lY3RpbmcgeWV0XG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5tYXliZVJlY29ubmVjdE9uT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAvLyBPbmx5IHRyeSB0byByZWNvbm5lY3QgaWYgaXQncyB0aGUgZmlyc3QgdGltZSB3ZSdyZSBjb25uZWN0aW5nXG5cdCAgaWYgKCF0aGlzLnJlY29ubmVjdGluZyAmJiB0aGlzLl9yZWNvbm5lY3Rpb24gJiYgdGhpcy5iYWNrb2ZmLmF0dGVtcHRzID09PSAwKSB7XG5cdCAgICAvLyBrZWVwcyByZWNvbm5lY3Rpb24gZnJvbSBmaXJpbmcgdHdpY2UgZm9yIHRoZSBzYW1lIHJlY29ubmVjdGlvbiBsb29wXG5cdCAgICB0aGlzLnJlY29ubmVjdCgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY3VycmVudCB0cmFuc3BvcnQgYHNvY2tldGAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbmFsLCBjYWxsYmFja1xuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9wZW4gPSBNYW5hZ2VyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24gKGZuLCBvcHRzKSB7XG5cdCAgZGVidWckNygncmVhZHlTdGF0ZSAlcycsIHRoaXMucmVhZHlTdGF0ZSk7XG5cdCAgaWYgKH50aGlzLnJlYWR5U3RhdGUuaW5kZXhPZignb3BlbicpKSByZXR1cm4gdGhpcztcblxuXHQgIGRlYnVnJDcoJ29wZW5pbmcgJXMnLCB0aGlzLnVyaSk7XG5cdCAgdGhpcy5lbmdpbmUgPSBlaW8odGhpcy51cmksIHRoaXMub3B0cyk7XG5cdCAgdmFyIHNvY2tldCA9IHRoaXMuZW5naW5lO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3BlbmluZyc7XG5cdCAgdGhpcy5za2lwUmVjb25uZWN0ID0gZmFsc2U7XG5cblx0ICAvLyBlbWl0IGBvcGVuYFxuXHQgIHZhciBvcGVuU3ViID0gb24kMihzb2NrZXQsICdvcGVuJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbm9wZW4oKTtcblx0ICAgIGZuICYmIGZuKCk7XG5cdCAgfSk7XG5cblx0ICAvLyBlbWl0IGBjb25uZWN0X2Vycm9yYFxuXHQgIHZhciBlcnJvclN1YiA9IG9uJDIoc29ja2V0LCAnZXJyb3InLCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgZGVidWckNygnY29ubmVjdF9lcnJvcicpO1xuXHQgICAgc2VsZi5jbGVhbnVwKCk7XG5cdCAgICBzZWxmLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICAgIHNlbGYuZW1pdEFsbCgnY29ubmVjdF9lcnJvcicsIGRhdGEpO1xuXHQgICAgaWYgKGZuKSB7XG5cdCAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gZXJyb3InKTtcblx0ICAgICAgZXJyLmRhdGEgPSBkYXRhO1xuXHQgICAgICBmbihlcnIpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgLy8gT25seSBkbyB0aGlzIGlmIHRoZXJlIGlzIG5vIGZuIHRvIGhhbmRsZSB0aGUgZXJyb3Jcblx0ICAgICAgc2VsZi5tYXliZVJlY29ubmVjdE9uT3BlbigpO1xuXHQgICAgfVxuXHQgIH0pO1xuXG5cdCAgLy8gZW1pdCBgY29ubmVjdF90aW1lb3V0YFxuXHQgIGlmIChmYWxzZSAhPT0gdGhpcy5fdGltZW91dCkge1xuXHQgICAgdmFyIHRpbWVvdXQgPSB0aGlzLl90aW1lb3V0O1xuXHQgICAgZGVidWckNygnY29ubmVjdCBhdHRlbXB0IHdpbGwgdGltZW91dCBhZnRlciAlZCcsIHRpbWVvdXQpO1xuXG5cdCAgICAvLyBzZXQgdGltZXJcblx0ICAgIHZhciB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBkZWJ1ZyQ3KCdjb25uZWN0IGF0dGVtcHQgdGltZWQgb3V0IGFmdGVyICVkJywgdGltZW91dCk7XG5cdCAgICAgIG9wZW5TdWIuZGVzdHJveSgpO1xuXHQgICAgICBzb2NrZXQuY2xvc2UoKTtcblx0ICAgICAgc29ja2V0LmVtaXQoJ2Vycm9yJywgJ3RpbWVvdXQnKTtcblx0ICAgICAgc2VsZi5lbWl0QWxsKCdjb25uZWN0X3RpbWVvdXQnLCB0aW1lb3V0KTtcblx0ICAgIH0sIHRpbWVvdXQpO1xuXG5cdCAgICB0aGlzLnN1YnMucHVzaCh7XG5cdCAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cdCAgfVxuXG5cdCAgdGhpcy5zdWJzLnB1c2gob3BlblN1Yik7XG5cdCAgdGhpcy5zdWJzLnB1c2goZXJyb3JTdWIpO1xuXG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBvcGVuLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDcoJ29wZW4nKTtcblxuXHQgIC8vIGNsZWFyIG9sZCBzdWJzXG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cblx0ICAvLyBtYXJrIGFzIG9wZW5cblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgdGhpcy5lbWl0KCdvcGVuJyk7XG5cblx0ICAvLyBhZGQgbmV3IHN1YnNcblx0ICB2YXIgc29ja2V0ID0gdGhpcy5lbmdpbmU7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdkYXRhJywgYmluZCh0aGlzLCAnb25kYXRhJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ3BpbmcnLCBiaW5kKHRoaXMsICdvbnBpbmcnKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAncG9uZycsIGJpbmQodGhpcywgJ29ucG9uZycpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdlcnJvcicsIGJpbmQodGhpcywgJ29uZXJyb3InKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAnY2xvc2UnLCBiaW5kKHRoaXMsICdvbmNsb3NlJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHRoaXMuZGVjb2RlciwgJ2RlY29kZWQnLCBiaW5kKHRoaXMsICdvbmRlY29kZWQnKSkpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBhIHBpbmcuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbnBpbmcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5sYXN0UGluZyA9IG5ldyBEYXRlKCk7XG5cdCAgdGhpcy5lbWl0QWxsKCdwaW5nJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25wb25nID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuZW1pdEFsbCgncG9uZycsIG5ldyBEYXRlKCkgLSB0aGlzLmxhc3RQaW5nKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdpdGggZGF0YS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uZGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdGhpcy5kZWNvZGVyLmFkZChkYXRhKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gcGFyc2VyIGZ1bGx5IGRlY29kZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmRlY29kZWQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgdGhpcy5lbWl0KCdwYWNrZXQnLCBwYWNrZXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBzb2NrZXQgZXJyb3IuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXHQgIGRlYnVnJDcoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLmVtaXRBbGwoJ2Vycm9yJywgZXJyKTtcblx0fTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBzb2NrZXQgZm9yIHRoZSBnaXZlbiBgbnNwYC5cblx0ICpcblx0ICogQHJldHVybiB7U29ja2V0fVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXQgPSBmdW5jdGlvbiAobnNwLCBvcHRzKSB7XG5cdCAgdmFyIHNvY2tldCA9IHRoaXMubnNwc1tuc3BdO1xuXHQgIGlmICghc29ja2V0KSB7XG5cdCAgICBzb2NrZXQgPSBuZXcgU29ja2V0JDEodGhpcywgbnNwLCBvcHRzKTtcblx0ICAgIHRoaXMubnNwc1tuc3BdID0gc29ja2V0O1xuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgICAgc29ja2V0Lm9uKCdjb25uZWN0aW5nJywgb25Db25uZWN0aW5nKTtcblx0ICAgIHNvY2tldC5vbignY29ubmVjdCcsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc29ja2V0LmlkID0gc2VsZi5nZW5lcmF0ZUlkKG5zcCk7XG5cdCAgICB9KTtcblxuXHQgICAgaWYgKHRoaXMuYXV0b0Nvbm5lY3QpIHtcblx0ICAgICAgLy8gbWFudWFsbHkgY2FsbCBoZXJlIHNpbmNlIGNvbm5lY3RpbmcgZXZlbnQgaXMgZmlyZWQgYmVmb3JlIGxpc3RlbmluZ1xuXHQgICAgICBvbkNvbm5lY3RpbmcoKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBvbkNvbm5lY3RpbmcoKSB7XG5cdCAgICBpZiAoIX5pbmRleChzZWxmLmNvbm5lY3RpbmcsIHNvY2tldCkpIHtcblx0ICAgICAgc2VsZi5jb25uZWN0aW5nLnB1c2goc29ja2V0KTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gc29ja2V0O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBhIHNvY2tldCBjbG9zZS5cblx0ICpcblx0ICogQHBhcmFtIHtTb2NrZXR9IHNvY2tldFxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKHNvY2tldCkge1xuXHQgIHZhciBpbmRleCQkMSA9IGluZGV4KHRoaXMuY29ubmVjdGluZywgc29ja2V0KTtcblx0ICBpZiAofmluZGV4JCQxKSB0aGlzLmNvbm5lY3Rpbmcuc3BsaWNlKGluZGV4JCQxLCAxKTtcblx0ICBpZiAodGhpcy5jb25uZWN0aW5nLmxlbmd0aCkgcmV0dXJuO1xuXG5cdCAgdGhpcy5jbG9zZSgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBXcml0ZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICBkZWJ1ZyQ3KCd3cml0aW5nIHBhY2tldCAlaicsIHBhY2tldCk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIGlmIChwYWNrZXQucXVlcnkgJiYgcGFja2V0LnR5cGUgPT09IDApIHBhY2tldC5uc3AgKz0gJz8nICsgcGFja2V0LnF1ZXJ5O1xuXG5cdCAgaWYgKCFzZWxmLmVuY29kaW5nKSB7XG5cdCAgICAvLyBlbmNvZGUsIHRoZW4gd3JpdGUgdG8gZW5naW5lIHdpdGggcmVzdWx0XG5cdCAgICBzZWxmLmVuY29kaW5nID0gdHJ1ZTtcblx0ICAgIHRoaXMuZW5jb2Rlci5lbmNvZGUocGFja2V0LCBmdW5jdGlvbiAoZW5jb2RlZFBhY2tldHMpIHtcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbmNvZGVkUGFja2V0cy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIHNlbGYuZW5naW5lLndyaXRlKGVuY29kZWRQYWNrZXRzW2ldLCBwYWNrZXQub3B0aW9ucyk7XG5cdCAgICAgIH1cblx0ICAgICAgc2VsZi5lbmNvZGluZyA9IGZhbHNlO1xuXHQgICAgICBzZWxmLnByb2Nlc3NQYWNrZXRRdWV1ZSgpO1xuXHQgICAgfSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIC8vIGFkZCBwYWNrZXQgdG8gdGhlIHF1ZXVlXG5cdCAgICBzZWxmLnBhY2tldEJ1ZmZlci5wdXNoKHBhY2tldCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBJZiBwYWNrZXQgYnVmZmVyIGlzIG5vbi1lbXB0eSwgYmVnaW5zIGVuY29kaW5nIHRoZVxuXHQgKiBuZXh0IHBhY2tldCBpbiBsaW5lLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucHJvY2Vzc1BhY2tldFF1ZXVlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnBhY2tldEJ1ZmZlci5sZW5ndGggPiAwICYmICF0aGlzLmVuY29kaW5nKSB7XG5cdCAgICB2YXIgcGFjayA9IHRoaXMucGFja2V0QnVmZmVyLnNoaWZ0KCk7XG5cdCAgICB0aGlzLnBhY2tldChwYWNrKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENsZWFuIHVwIHRyYW5zcG9ydCBzdWJzY3JpcHRpb25zIGFuZCBwYWNrZXQgYnVmZmVyLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuY2xlYW51cCA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ3KCdjbGVhbnVwJyk7XG5cblx0ICB2YXIgc3Vic0xlbmd0aCA9IHRoaXMuc3Vicy5sZW5ndGg7XG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzTGVuZ3RoOyBpKyspIHtcblx0ICAgIHZhciBzdWIgPSB0aGlzLnN1YnMuc2hpZnQoKTtcblx0ICAgIHN1Yi5kZXN0cm95KCk7XG5cdCAgfVxuXG5cdCAgdGhpcy5wYWNrZXRCdWZmZXIgPSBbXTtcblx0ICB0aGlzLmVuY29kaW5nID0gZmFsc2U7XG5cdCAgdGhpcy5sYXN0UGluZyA9IG51bGw7XG5cblx0ICB0aGlzLmRlY29kZXIuZGVzdHJveSgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbG9zZSB0aGUgY3VycmVudCBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5jbG9zZSA9IE1hbmFnZXIucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNygnZGlzY29ubmVjdCcpO1xuXHQgIHRoaXMuc2tpcFJlY29ubmVjdCA9IHRydWU7XG5cdCAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIC8vIGBvbmNsb3NlYCB3aWxsIG5vdCBmaXJlIGJlY2F1c2Vcblx0ICAgIC8vIGFuIG9wZW4gZXZlbnQgbmV2ZXIgaGFwcGVuZWRcblx0ICAgIHRoaXMuY2xlYW51cCgpO1xuXHQgIH1cblx0ICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICBpZiAodGhpcy5lbmdpbmUpIHRoaXMuZW5naW5lLmNsb3NlKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGVuZ2luZSBjbG9zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgZGVidWckNygnb25jbG9zZScpO1xuXG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cdCAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy5lbWl0KCdjbG9zZScsIHJlYXNvbik7XG5cblx0ICBpZiAodGhpcy5fcmVjb25uZWN0aW9uICYmICF0aGlzLnNraXBSZWNvbm5lY3QpIHtcblx0ICAgIHRoaXMucmVjb25uZWN0KCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBBdHRlbXB0IGEgcmVjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnJlY29ubmVjdGluZyB8fCB0aGlzLnNraXBSZWNvbm5lY3QpIHJldHVybiB0aGlzO1xuXG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgaWYgKHRoaXMuYmFja29mZi5hdHRlbXB0cyA+PSB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cykge1xuXHQgICAgZGVidWckNygncmVjb25uZWN0IGZhaWxlZCcpO1xuXHQgICAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgICB0aGlzLmVtaXRBbGwoJ3JlY29ubmVjdF9mYWlsZWQnKTtcblx0ICAgIHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2U7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHZhciBkZWxheSA9IHRoaXMuYmFja29mZi5kdXJhdGlvbigpO1xuXHQgICAgZGVidWckNygnd2lsbCB3YWl0ICVkbXMgYmVmb3JlIHJlY29ubmVjdCBhdHRlbXB0JywgZGVsYXkpO1xuXG5cdCAgICB0aGlzLnJlY29ubmVjdGluZyA9IHRydWU7XG5cdCAgICB2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHNlbGYuc2tpcFJlY29ubmVjdCkgcmV0dXJuO1xuXG5cdCAgICAgIGRlYnVnJDcoJ2F0dGVtcHRpbmcgcmVjb25uZWN0Jyk7XG5cdCAgICAgIHNlbGYuZW1pdEFsbCgncmVjb25uZWN0X2F0dGVtcHQnLCBzZWxmLmJhY2tvZmYuYXR0ZW1wdHMpO1xuXHQgICAgICBzZWxmLmVtaXRBbGwoJ3JlY29ubmVjdGluZycsIHNlbGYuYmFja29mZi5hdHRlbXB0cyk7XG5cblx0ICAgICAgLy8gY2hlY2sgYWdhaW4gZm9yIHRoZSBjYXNlIHNvY2tldCBjbG9zZWQgaW4gYWJvdmUgZXZlbnRzXG5cdCAgICAgIGlmIChzZWxmLnNraXBSZWNvbm5lY3QpIHJldHVybjtcblxuXHQgICAgICBzZWxmLm9wZW4oZnVuY3Rpb24gKGVycikge1xuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgIGRlYnVnJDcoJ3JlY29ubmVjdCBhdHRlbXB0IGVycm9yJyk7XG5cdCAgICAgICAgICBzZWxmLnJlY29ubmVjdGluZyA9IGZhbHNlO1xuXHQgICAgICAgICAgc2VsZi5yZWNvbm5lY3QoKTtcblx0ICAgICAgICAgIHNlbGYuZW1pdEFsbCgncmVjb25uZWN0X2Vycm9yJywgZXJyLmRhdGEpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBkZWJ1ZyQ3KCdyZWNvbm5lY3Qgc3VjY2VzcycpO1xuXHQgICAgICAgICAgc2VsZi5vbnJlY29ubmVjdCgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9LCBkZWxheSk7XG5cblx0ICAgIHRoaXMuc3Vicy5wdXNoKHtcblx0ICAgICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0ICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuXHQgICAgICB9XG5cdCAgICB9KTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHN1Y2Nlc3NmdWwgcmVjb25uZWN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25yZWNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIGF0dGVtcHQgPSB0aGlzLmJhY2tvZmYuYXR0ZW1wdHM7XG5cdCAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICB0aGlzLnVwZGF0ZVNvY2tldElkcygpO1xuXHQgIHRoaXMuZW1pdEFsbCgncmVjb25uZWN0JywgYXR0ZW1wdCk7XG5cdH07XG5cblx0dmFyIG1hbmFnZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBtYW5hZ2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogbWFuYWdlclxuXHR9KTtcblxuXHR2YXIgdXJsJDIgPSAoIHVybCQxICYmIHVybF8xICkgfHwgdXJsJDE7XG5cblx0dmFyIE1hbmFnZXIkMSA9ICggbWFuYWdlciQxICYmIG1hbmFnZXIgKSB8fCBtYW5hZ2VyJDE7XG5cblx0dmFyIGxpYiQyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgZGVidWcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQnKTtcblxuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBleHBvcnRzLlxuXHQgICAqL1xuXG5cdCAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gbG9va3VwO1xuXG5cdCAgLyoqXG5cdCAgICogTWFuYWdlcnMgY2FjaGUuXG5cdCAgICovXG5cblx0ICB2YXIgY2FjaGUgPSBleHBvcnRzLm1hbmFnZXJzID0ge307XG5cblx0ICAvKipcblx0ICAgKiBMb29rcyB1cCBhbiBleGlzdGluZyBgTWFuYWdlcmAgZm9yIG11bHRpcGxleGluZy5cblx0ICAgKiBJZiB0aGUgdXNlciBzdW1tb25zOlxuXHQgICAqXG5cdCAgICogICBgaW8oJ2h0dHA6Ly9sb2NhbGhvc3QvYScpO2Bcblx0ICAgKiAgIGBpbygnaHR0cDovL2xvY2FsaG9zdC9iJyk7YFxuXHQgICAqXG5cdCAgICogV2UgcmV1c2UgdGhlIGV4aXN0aW5nIGluc3RhbmNlIGJhc2VkIG9uIHNhbWUgc2NoZW1lL3BvcnQvaG9zdCxcblx0ICAgKiBhbmQgd2UgaW5pdGlhbGl6ZSBzb2NrZXRzIGZvciBlYWNoIG5hbWVzcGFjZS5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBsb29rdXAodXJpLCBvcHRzKSB7XG5cdCAgICBpZiAoKHR5cGVvZiB1cmkgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHVyaSkpID09PSAnb2JqZWN0Jykge1xuXHQgICAgICBvcHRzID0gdXJpO1xuXHQgICAgICB1cmkgPSB1bmRlZmluZWQ7XG5cdCAgICB9XG5cblx0ICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdCAgICB2YXIgcGFyc2VkID0gdXJsJDIodXJpKTtcblx0ICAgIHZhciBzb3VyY2UgPSBwYXJzZWQuc291cmNlO1xuXHQgICAgdmFyIGlkID0gcGFyc2VkLmlkO1xuXHQgICAgdmFyIHBhdGggPSBwYXJzZWQucGF0aDtcblx0ICAgIHZhciBzYW1lTmFtZXNwYWNlID0gY2FjaGVbaWRdICYmIHBhdGggaW4gY2FjaGVbaWRdLm5zcHM7XG5cdCAgICB2YXIgbmV3Q29ubmVjdGlvbiA9IG9wdHMuZm9yY2VOZXcgfHwgb3B0c1snZm9yY2UgbmV3IGNvbm5lY3Rpb24nXSB8fCBmYWxzZSA9PT0gb3B0cy5tdWx0aXBsZXggfHwgc2FtZU5hbWVzcGFjZTtcblxuXHQgICAgdmFyIGlvO1xuXG5cdCAgICBpZiAobmV3Q29ubmVjdGlvbikge1xuXHQgICAgICBkZWJ1ZygnaWdub3Jpbmcgc29ja2V0IGNhY2hlIGZvciAlcycsIHNvdXJjZSk7XG5cdCAgICAgIGlvID0gTWFuYWdlciQxKHNvdXJjZSwgb3B0cyk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBpZiAoIWNhY2hlW2lkXSkge1xuXHQgICAgICAgIGRlYnVnKCduZXcgaW8gaW5zdGFuY2UgZm9yICVzJywgc291cmNlKTtcblx0ICAgICAgICBjYWNoZVtpZF0gPSBNYW5hZ2VyJDEoc291cmNlLCBvcHRzKTtcblx0ICAgICAgfVxuXHQgICAgICBpbyA9IGNhY2hlW2lkXTtcblx0ICAgIH1cblx0ICAgIGlmIChwYXJzZWQucXVlcnkgJiYgIW9wdHMucXVlcnkpIHtcblx0ICAgICAgb3B0cy5xdWVyeSA9IHBhcnNlZC5xdWVyeTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBpby5zb2NrZXQocGFyc2VkLnBhdGgsIG9wdHMpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIFByb3RvY29sIHZlcnNpb24uXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5wcm90b2NvbCA9IHBhcnNlciQyLnByb3RvY29sO1xuXG5cdCAgLyoqXG5cdCAgICogYGNvbm5lY3RgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IHVyaVxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmNvbm5lY3QgPSBsb29rdXA7XG5cblx0ICAvKipcblx0ICAgKiBFeHBvc2UgY29uc3RydWN0b3JzIGZvciBzdGFuZGFsb25lIGJ1aWxkLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuTWFuYWdlciA9IE1hbmFnZXIkMTtcblx0ICBleHBvcnRzLlNvY2tldCA9IFNvY2tldCQxO1xuXHR9KTtcblx0dmFyIGxpYl8xID0gbGliJDIubWFuYWdlcnM7XG5cdHZhciBsaWJfMiA9IGxpYiQyLnByb3RvY29sO1xuXHR2YXIgbGliXzMgPSBsaWIkMi5jb25uZWN0O1xuXHR2YXIgbGliXzQgPSBsaWIkMi5NYW5hZ2VyO1xuXHR2YXIgbGliXzUgPSBsaWIkMi5Tb2NrZXQ7XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKFkpIHtcblx0ICAgIHZhciBDb25uZWN0b3IgPSBmdW5jdGlvbiAoX1kkQWJzdHJhY3RDb25uZWN0b3IpIHtcblx0ICAgICAgICBpbmhlcml0cyhDb25uZWN0b3IsIF9ZJEFic3RyYWN0Q29ubmVjdG9yKTtcblxuXHQgICAgICAgIGZ1bmN0aW9uIENvbm5lY3Rvcih5LCBvcHRpb25zKSB7XG5cdCAgICAgICAgICAgIGNsYXNzQ2FsbENoZWNrKHRoaXMsIENvbm5lY3Rvcik7XG5cblx0ICAgICAgICAgICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcHRpb25zIG11c3Qgbm90IGJlIHVuZGVmaW5lZCEnKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICBvcHRpb25zLnByZWZlclVudHJhbnNmb3JtZWQgPSB0cnVlO1xuXHQgICAgICAgICAgICBvcHRpb25zLmdlbmVyYXRlVXNlcklkID0gb3B0aW9ucy5nZW5lcmF0ZVVzZXJJZCB8fCBmYWxzZTtcblx0ICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW5pdFN5bmMgIT09IGZhbHNlKSB7XG5cdCAgICAgICAgICAgICAgICBvcHRpb25zLmluaXRTeW5jID0gdHJ1ZTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHZhciBfdGhpcyA9IHBvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgKENvbm5lY3Rvci5fX3Byb3RvX18gfHwgT2JqZWN0LmdldFByb3RvdHlwZU9mKENvbm5lY3RvcikpLmNhbGwodGhpcywgeSwgb3B0aW9ucykpO1xuXG5cdCAgICAgICAgICAgIF90aGlzLl9zZW50U3luYyA9IGZhbHNlO1xuXHQgICAgICAgICAgICBfdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0ICAgICAgICAgICAgb3B0aW9ucy51cmwgPSBvcHRpb25zLnVybCB8fCAnaHR0cHM6Ly95anMuZGJpcy5yd3RoLWFhY2hlbi5kZTo1MDcyJztcblx0ICAgICAgICAgICAgdmFyIHNvY2tldCA9IG9wdGlvbnMuc29ja2V0IHx8IGxpYiQyKG9wdGlvbnMudXJsLCBvcHRpb25zLm9wdGlvbnMpO1xuXHQgICAgICAgICAgICBfdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG5cdCAgICAgICAgICAgIHZhciBzZWxmID0gX3RoaXM7XG5cblx0ICAgICAgICAgICAgLyoqKioqKioqKioqKioqKioqKiBzdGFydCBtaW5pbWFsIHdlYnJ0YyAqKioqKioqKioqKioqKioqKioqKioqL1xuXHQgICAgICAgICAgICB2YXIgc2lnbmFsaW5nX3NvY2tldCA9IHNvY2tldDtcblx0ICAgICAgICAgICAgdmFyIElDRV9TRVJWRVJTID0gW3sgdXJsczogXCJzdHVuOnN0dW4ubC5nb29nbGUuY29tOjE5MzAyXCIgfSwgeyB1cmxzOiBcInR1cm46dHJ5LnJlZmFjdG9yZWQuYWk6MzQ3OFwiLCB1c2VybmFtZTogXCJ0ZXN0OTlcIiwgY3JlZGVudGlhbDogXCJ0ZXN0XCIgfV07XG5cdCAgICAgICAgICAgIHZhciBkY3MgPSB7fTtcblx0ICAgICAgICAgICAgX3RoaXMuZGNzID0gZGNzO1xuXHQgICAgICAgICAgICBfdGhpcy5zZGNzID0gZGNzO1xuXHQgICAgICAgICAgICB2YXIgcGVlcnMgPSB7fTtcblx0ICAgICAgICAgICAgdmFyIHBlZXJfbWVkaWFfZWxlbWVudHMgPSB7fTtcblx0ICAgICAgICAgICAgdmFyIHNvY2tldHM7XG5cdCAgICAgICAgICAgIF90aGlzLnNvY2tldHMgPSBzb2NrZXRzO1xuXG5cdCAgICAgICAgICAgIGZ1bmN0aW9uIHJlY2VpdmVEYXRhKHl3ZWJydGMsIHBlZXJfaWQpIHtcblx0ICAgICAgICAgICAgICAgIHZhciBidWYsIGNvdW50O1xuXHQgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG9ubWVzc2FnZShldmVudCkge1xuXHQgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZXZlbnQuZGF0YSA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkocGFyc2VJbnQoZXZlbnQuZGF0YSkpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBjb3VudCA9IDA7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBuZXcgVWludDhBcnJheShldmVudC5kYXRhKTtcblx0ICAgICAgICAgICAgICAgICAgICBidWYuc2V0KGRhdGEsIGNvdW50KTtcblx0ICAgICAgICAgICAgICAgICAgICBjb3VudCArPSBkYXRhLmJ5dGVMZW5ndGg7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50ID09PSBidWYuYnl0ZUxlbmd0aCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnJlY2VpdmVNZXNzYWdlKHBlZXJfaWQsIGJ1Zik7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIGZ1bmN0aW9uIGluaXQoeXdlYnJ0Yykge1xuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignY29ubmVjdCcsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICBqb2luX2NoYXRfY2hhbm5lbCh5d2VicnRjLm9wdGlvbnMucm9vbSwgeyAnd2hhdGV2ZXIteW91LXdhbnQtaGVyZSc6ICdzdHVmZicgfSk7XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignc29ja2V0cycsIGZ1bmN0aW9uIChzb2NrZXRzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgd2luZG93LnNvY2tldHMgPSBzb2NrZXRzO1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgLyogVGVhciBkb3duIGFsbCBvZiBvdXIgcGVlciBjb25uZWN0aW9ucyBhbmQgcmVtb3ZlIGFsbCB0aGVcblx0ICAgICAgICAgICAgICAgICAgICAgKiBtZWRpYSBkaXZzIHdoZW4gd2UgZGlzY29ubmVjdCAqL1xuXHQgICAgICAgICAgICAgICAgICAgIGZvciAocGVlcl9pZCBpbiBwZWVyX21lZGlhX2VsZW1lbnRzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHNbcGVlcl9pZF0ucmVtb3ZlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIGZvciAocGVlcl9pZCBpbiBwZWVycykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyc1twZWVyX2lkXS5jbG9zZSgpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICAgIHBlZXJzID0ge307XG5cdCAgICAgICAgICAgICAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50cyA9IHt9O1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGpvaW5fY2hhdF9jaGFubmVsKGNoYW5uZWwsIHVzZXJkYXRhKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdqb2luJywgeyBcImNoYW5uZWxcIjogY2hhbm5lbCwgXCJ1c2VyZGF0YVwiOiB1c2VyZGF0YSB9KTtcblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnVzZXJJRCA9IHNpZ25hbGluZ19zb2NrZXQuaWQ7XG5cdCAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2FkZFBlZXInLCBmdW5jdGlvbiAoY29uZmlnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcblxuXHQgICAgICAgICAgICAgICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIC8qIFRoaXMgY291bGQgaGFwcGVuIGlmIHRoZSB1c2VyIGpvaW5zIG11bHRpcGxlIGNoYW5uZWxzIHdoZXJlIHRoZSBvdGhlciBwZWVyIGlzIGFsc28gaW4uICovXG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlcl9jb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKHsgXCJpY2VTZXJ2ZXJzXCI6IElDRV9TRVJWRVJTIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdID0gcGVlcl9jb25uZWN0aW9uO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGFDaGFubmVsID0gcGVlcl9jb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKCdkYXRhJyk7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHN5bmNEYXRhQ2hhbm5lbCA9IHBlZXJfY29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgnc3luY19kYXRhJyk7XG5cblx0ICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0ICAgICAgICAgICAgICAgICAgICBzeW5jRGF0YUNoYW5uZWwuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLmRjc1twZWVyX2lkXSA9IGRhdGFDaGFubmVsO1xuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMuc2Rjc1twZWVyX2lkXSA9IHN5bmNEYXRhQ2hhbm5lbDtcblxuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMudXNlckpvaW5lZChwZWVyX2lkLCAnbWFzdGVyJyk7XG5cblx0ICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSByZWNlaXZlRGF0YSh5d2VicnRjLCBwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICBzeW5jRGF0YUNoYW5uZWwub25tZXNzYWdlID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlYnVmZmVyKHBlZXJfaWQsIGUuZGF0YSk7XG5cdCAgICAgICAgICAgICAgICAgICAgfTtcblxuXHQgICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnQuY2FuZGlkYXRlKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5SUNFQ2FuZGlkYXRlJywge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdwZWVyX2lkJzogcGVlcl9pZCxcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnaWNlX2NhbmRpZGF0ZSc6IHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NkcE1MaW5lSW5kZXgnOiBldmVudC5jYW5kaWRhdGUuc2RwTUxpbmVJbmRleCxcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NhbmRpZGF0ZSc6IGV2ZW50LmNhbmRpZGF0ZS5jYW5kaWRhdGVcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLnNob3VsZF9jcmVhdGVfb2ZmZXIpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcl9jb25uZWN0aW9uLmNyZWF0ZU9mZmVyKGZ1bmN0aW9uIChsb2NhbF9kZXNjcmlwdGlvbikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlcl9jb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24obG9jYWxfZGVzY3JpcHRpb24sIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5U2Vzc2lvbkRlc2NyaXB0aW9uJywgeyAncGVlcl9pZCc6IHBlZXJfaWQsICdzZXNzaW9uX2Rlc2NyaXB0aW9uJzogbG9jYWxfZGVzY3JpcHRpb24gfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWxlcnQoXCJPZmZlciBzZXRMb2NhbERlc2NyaXB0aW9uIGZhaWxlZCFcIik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVycm9yIHNlbmRpbmcgb2ZmZXI6IFwiLCBlcnJvcik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICAvKiogXG5cdCAgICAgICAgICAgICAgICAgKiBQZWVycyBleGNoYW5nZSBzZXNzaW9uIGRlc2NyaXB0aW9ucyB3aGljaCBjb250YWlucyBpbmZvcm1hdGlvblxuXHQgICAgICAgICAgICAgICAgICogYWJvdXQgdGhlaXIgYXVkaW8gLyB2aWRlbyBzZXR0aW5ncyBhbmQgdGhhdCBzb3J0IG9mIHN0dWZmLiBGaXJzdFxuXHQgICAgICAgICAgICAgICAgICogdGhlICdvZmZlcmVyJyBzZW5kcyBhIGRlc2NyaXB0aW9uIHRvIHRoZSAnYW5zd2VyZXInICh3aXRoIHR5cGVcblx0ICAgICAgICAgICAgICAgICAqIFwib2ZmZXJcIiksIHRoZW4gdGhlIGFuc3dlcmVyIHNlbmRzIG9uZSBiYWNrICh3aXRoIHR5cGUgXCJhbnN3ZXJcIikuICBcblx0ICAgICAgICAgICAgICAgICAqL1xuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignc2Vzc2lvbkRlc2NyaXB0aW9uJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXIgPSBwZWVyc1twZWVyX2lkXTtcblxuXHQgICAgICAgICAgICAgICAgICAgIHBlZXIub25kYXRhY2hhbm5lbCA9IGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YUNoYW5uZWwgPSBldmVudC5jaGFubmVsO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFDaGFubmVsLmxhYmVsID09ICdzeW5jX2RhdGEnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSByZWNlaXZlRGF0YSh5d2VicnRjLCBwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlYnVmZmVyKHBlZXJfaWQsIGUuZGF0YSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgfTtcblxuXHQgICAgICAgICAgICAgICAgICAgIHZhciByZW1vdGVfZGVzY3JpcHRpb24gPSBjb25maWcuc2Vzc2lvbl9kZXNjcmlwdGlvbjtcblxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBkZXNjID0gbmV3IFJUQ1Nlc3Npb25EZXNjcmlwdGlvbihyZW1vdGVfZGVzY3JpcHRpb24pO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBzdHVmZiA9IHBlZXIuc2V0UmVtb3RlRGVzY3JpcHRpb24oZGVzYywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3RlX2Rlc2NyaXB0aW9uLnR5cGUgPT0gXCJvZmZlclwiKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWVyLmNyZWF0ZUFuc3dlcihmdW5jdGlvbiAobG9jYWxfZGVzY3JpcHRpb24pIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWVyLnNldExvY2FsRGVzY3JpcHRpb24obG9jYWxfZGVzY3JpcHRpb24sIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheVNlc3Npb25EZXNjcmlwdGlvbicsIHsgJ3BlZXJfaWQnOiBwZWVyX2lkLCAnc2Vzc2lvbl9kZXNjcmlwdGlvbic6IGxvY2FsX2Rlc2NyaXB0aW9uIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWxlcnQoXCJBbnN3ZXIgc2V0TG9jYWxEZXNjcmlwdGlvbiBmYWlsZWQhXCIpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBjcmVhdGluZyBhbnN3ZXI6IFwiLCBlcnJvcik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNldFJlbW90ZURlc2NyaXB0aW9uIGVycm9yOiBcIiwgZXJyb3IpO1xuXHQgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2ljZUNhbmRpZGF0ZScsIGZ1bmN0aW9uIChjb25maWcpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlciA9IHBlZXJzW2NvbmZpZy5wZWVyX2lkXTtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgaWNlX2NhbmRpZGF0ZSA9IGNvbmZpZy5pY2VfY2FuZGlkYXRlO1xuXHQgICAgICAgICAgICAgICAgICAgIHBlZXIuYWRkSWNlQ2FuZGlkYXRlKG5ldyBSVENJY2VDYW5kaWRhdGUoaWNlX2NhbmRpZGF0ZSkpO1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3JlbW92ZVBlZXInLCBmdW5jdGlvbiAoY29uZmlnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnVzZXJMZWZ0KHBlZXJfaWQpO1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJfbWVkaWFfZWxlbWVudHMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50c1twZWVyX2lkXS5yZW1vdmUoKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcnMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0uY2xvc2UoKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgICBkZWxldGUgcGVlcnNbcGVlcl9pZF07XG5cdCAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHBlZXJfbWVkaWFfZWxlbWVudHNbY29uZmlnLnBlZXJfaWRdO1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgaW5pdChzZWxmKTtcblx0ICAgICAgICAgICAgLyoqKioqKioqKioqKioqKioqKioqKioqKiBlbmQgbWluaW1hbF93ZWJydGMgKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblx0ICAgICAgICAgICAgcmV0dXJuIF90aGlzO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGNyZWF0ZUNsYXNzKENvbm5lY3RvciwgW3tcblx0ICAgICAgICAgICAga2V5OiAnZGlzY29ubmVjdCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNjb25uZWN0KCkge31cblx0ICAgICAgICB9LCB7XG5cdCAgICAgICAgICAgIGtleTogJ2Rlc3Ryb3knLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZGVzdHJveSgpIHt9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdyZWNvbm5lY3QnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gcmVjb25uZWN0KCkge31cblx0ICAgICAgICB9LCB7XG5cdCAgICAgICAgICAgIGtleTogJ3NlbmQnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gc2VuZCh1aWQsIG1lc3NhZ2UpIHtcblx0ICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCckJCQkJCQkJCQkJCQkJCQkIHN5bmNpbmcuLi4uLi4gJCQkJCQkJCQkJCQkJCQkJCQnKTtcblx0ICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHNlbmQyKGRhdGFDaGFubmVsLCBkYXRhMikge1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhQ2hhbm5lbC5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIENIVU5LX0xFTiA9IDY0MDAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGVuID0gZGF0YTIuYnl0ZUxlbmd0aDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG4gPSBsZW4gLyBDSFVOS19MRU4gfCAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGxlbik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNwbGl0IHRoZSBwaG90byBhbmQgc2VuZCBpbiBjaHVua3Mgb2YgYWJvdXQgNjRLQlxuXHQgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0YXJ0ID0gaSAqIENIVU5LX0xFTixcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQgPSAoaSArIDEpICogQ0hVTktfTEVOO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShzdGFydCwgZW5kKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCB0aGUgcmVtaW5kZXIsIGlmIGFueVxuXHQgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVuICUgQ0hVTktfTEVOKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGRhdGEyLnN1YmFycmF5KG4gKiBDSFVOS19MRU4pKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoc2VuZDIsIDUwMCwgZGF0YUNoYW5uZWwsIGRhdGEyKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICBzZW5kMih0aGlzLnNkY3NbdWlkXSwgbmV3IFVpbnQ4QXJyYXkobWVzc2FnZSkpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdicm9hZGNhc3QnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gYnJvYWRjYXN0KG1lc3NhZ2UpIHtcblx0ICAgICAgICAgICAgICAgIGZvciAodmFyIHBlZXJfaWQgaW4gdGhpcy5kY3MpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgc2VuZDIgPSBmdW5jdGlvbiBzZW5kMihkYXRhQ2hhbm5lbCwgZGF0YTIpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFDaGFubmVsLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIENIVU5LX0xFTiA9IDY0MDAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxlbiA9IGRhdGEyLmJ5dGVMZW5ndGg7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbiA9IGxlbiAvIENIVU5LX0xFTiB8IDA7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGxlbik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzcGxpdCB0aGUgcGhvdG8gYW5kIHNlbmQgaW4gY2h1bmtzIG9mIGFib3V0IDY0S0Jcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0YXJ0ID0gaSAqIENIVU5LX0xFTixcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kID0gKGkgKyAxKSAqIENIVU5LX0xFTjtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGRhdGEyLnN1YmFycmF5KHN0YXJ0LCBlbmQpKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgdGhlIHJlbWluZGVyLCBpZiBhbnlcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZW4gJSBDSFVOS19MRU4pIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGRhdGEyLnN1YmFycmF5KG4gKiBDSFVOS19MRU4pKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycicsIHBlZXJfaWQpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgfTtcblxuXHQgICAgICAgICAgICAgICAgICAgIHNlbmQyKHRoaXMuZGNzW3BlZXJfaWRdLCBuZXcgVWludDhBcnJheShtZXNzYWdlKSk7XG5cdCAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICB9LCB7XG5cdCAgICAgICAgICAgIGtleTogJ2lzRGlzY29ubmVjdGVkJyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGlzRGlzY29ubmVjdGVkKCkge1xuXHQgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc29ja2V0LmRpc2Nvbm5lY3RlZDtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgIH1dKTtcblx0ICAgICAgICByZXR1cm4gQ29ubmVjdG9yO1xuXHQgICAgfShZLkFic3RyYWN0Q29ubmVjdG9yKTtcblxuXHQgICAgQ29ubmVjdG9yLmlvID0gbGliJDI7XG5cdCAgICBZWyd3ZWJydGMnXSA9IENvbm5lY3Rvcjtcblx0fVxuXG5cdGlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0ICAgIGV4dGVuZChZKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHR9XG5cblx0cmV0dXJuIGV4dGVuZDtcblxufSkpKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXktd2VicnRjLmpzLm1hcFxuIiwiLyoqXG4gKiB5anMgLSBBIGZyYW1ld29yayBmb3IgcmVhbC10aW1lIHAycCBzaGFyZWQgZWRpdGluZyBvbiBhbnkgZGF0YVxuICogQHZlcnNpb24gdjEzLjAuMC02MlxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbiFmdW5jdGlvbih0LGUpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPWUoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKGUpOnQuWT1lKCl9KHRoaXMsZnVuY3Rpb24oKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiB0KHQsZSxuLHIpe2lmKG51bGw9PT1lKXQucm9vdD1uLG4uX3BhcmVudD1udWxsO2Vsc2UgaWYoZS5sZWZ0PT09cillLmxlZnQ9bjtlbHNle2lmKGUucmlnaHQhPT1yKXRocm93IG5ldyBFcnJvcihcIlRoZSBlbGVtZW50cyBhcmUgd3JvbmdseSBjb25uZWN0ZWQhXCIpO2UucmlnaHQ9bn19ZnVuY3Rpb24gZSh0LGUpe3ZhciBuPWUuX2lkO2lmKHZvaWQgMD09PW4pZS5faW50ZWdyYXRlKHQpO2Vsc2V7aWYodC5zcy5nZXRTdGF0ZShuLnVzZXIpPm4uY2xvY2spcmV0dXJuOyF0LmdjRW5hYmxlZHx8ZS5jb25zdHJ1Y3Rvcj09PUx0fHxlLl9wYXJlbnQuY29uc3RydWN0b3IhPT1MdCYmITE9PT1lLl9wYXJlbnQuX2RlbGV0ZWQ/ZS5faW50ZWdyYXRlKHQpOmUuX2djKHQpO3ZhciByPXQuX21pc3NpbmdTdHJ1Y3RzLmdldChuLnVzZXIpO2lmKG51bGwhPXIpZm9yKHZhciBpPW4uY2xvY2ssbz1pK2UuX2xlbmd0aDtpPG87aSsrKXt2YXIgYT1yLmdldChpKTt2b2lkIDAhPT1hJiYoYS5mb3JFYWNoKGZ1bmN0aW9uKGUpe2lmKDA9PT0tLWUubWlzc2luZyl7dmFyIG49ZS5kZWNvZGVyLHI9bi5wb3MsaT1lLnN0cnVjdC5fZnJvbUJpbmFyeSh0LG4pO24ucG9zPXIsMD09PWkubGVuZ3RoJiZ0Ll9yZWFkeVRvSW50ZWdyYXRlLnB1c2goZS5zdHJ1Y3QpfX0pLHIuZGVsZXRlKGkpKX19fWZ1bmN0aW9uIG4odCxlLG4pe2Zvcih2YXIgcj1lLnJlYWRVaW50MzIoKSxpPTA7aTxyO2krKyl7dmFyIG89ZS5yZWFkVmFyVWludCgpLGE9cShvKSxzPW5ldyBhLGw9cy5fZnJvbUJpbmFyeSh0LGUpLHU9XCIgIFwiK3MuX2xvZ1N0cmluZygpO2wubGVuZ3RoPjAmJih1Kz1cIiAuLiBtaXNzaW5nOiBcIitsLm1hcChwKS5qb2luKFwiLCBcIikpLG4ucHVzaCh1KX19ZnVuY3Rpb24gcih0LG4pe2Zvcih2YXIgcj1uLnJlYWRVaW50MzIoKSxpPTA7aTxyO2krKyl7dmFyIG89bi5yZWFkVmFyVWludCgpLGE9cShvKSxzPW5ldyBhLGw9bi5wb3MsdT1zLl9mcm9tQmluYXJ5KHQsbik7aWYoMD09PXUubGVuZ3RoKWZvcig7bnVsbCE9czspZSh0LHMpLHM9dC5fcmVhZHlUb0ludGVncmF0ZS5zaGlmdCgpO2Vsc2V7dmFyIGM9bmV3IFZ0KG4udWludDhhcnIpO2MucG9zPWw7Zm9yKHZhciBoPW5ldyBNdChjLHUscyksZj10Ll9taXNzaW5nU3RydWN0cyxkPXUubGVuZ3RoLTE7ZD49MDtkLS0pe3ZhciBfPXVbZF07Zi5oYXMoXy51c2VyKXx8Zi5zZXQoXy51c2VyLG5ldyBNYXApO3ZhciB2PWYuZ2V0KF8udXNlcik7di5oYXMoXy5jbG9jayl8fHYuc2V0KF8uY2xvY2ssW10pOyh2PXYuZ2V0KF8uY2xvY2spKS5wdXNoKGgpfX19fWZ1bmN0aW9uIGkodCl7Zm9yKHZhciBlPW5ldyBNYXAsbj10LnJlYWRVaW50MzIoKSxyPTA7cjxuO3IrKyl7dmFyIGk9dC5yZWFkVmFyVWludCgpLG89dC5yZWFkVmFyVWludCgpO2Uuc2V0KGksbyl9cmV0dXJuIGV9ZnVuY3Rpb24gbyh0LGUpe3ZhciBuPWUucG9zLHI9MDtlLndyaXRlVWludDMyKDApO3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXQuc3Muc3RhdGVbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9eHQocy52YWx1ZSwyKSxjPXVbMF0saD11WzFdO2Uud3JpdGVWYXJVaW50KGMpLGUud3JpdGVWYXJVaW50KGgpLHIrK319Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX1lLnNldFVpbnQzMihuLHIpfWZ1bmN0aW9uIGEodCxlKXt2YXIgbj1udWxsLHI9dm9pZCAwLGk9dm9pZCAwLG89MCxhPWUucG9zO2Uud3JpdGVVaW50MzIoMCksdC5kcy5pdGVyYXRlKG51bGwsbnVsbCxmdW5jdGlvbih0KXt2YXIgYT10Ll9pZC51c2VyLHM9dC5faWQuY2xvY2ssbD10Lmxlbix1PXQuZ2M7biE9PWEmJihvKyssbnVsbCE9PW4mJmUuc2V0VWludDMyKGksciksbj1hLGUud3JpdGVWYXJVaW50KGEpLGk9ZS5wb3MsZS53cml0ZVVpbnQzMigwKSxyPTApLGUud3JpdGVWYXJVaW50KHMpLGUud3JpdGVWYXJVaW50KGwpLGUud3JpdGVVaW50OCh1PzE6MCkscisrfSksbnVsbCE9PW4mJmUuc2V0VWludDMyKGksciksZS5zZXRVaW50MzIoYSxvKX1mdW5jdGlvbiBzKHQsZSl7Zm9yKHZhciBuPWUucmVhZFVpbnQzMigpLHI9MDtyPG47cisrKSFmdW5jdGlvbihuKXtmb3IodmFyIHI9ZS5yZWFkVmFyVWludCgpLGk9W10sbz1lLnJlYWRVaW50MzIoKSxhPTA7YTxvO2ErKyl7dmFyIHM9ZS5yZWFkVmFyVWludCgpLGw9ZS5yZWFkVmFyVWludCgpLHU9MT09PWUucmVhZFVpbnQ4KCk7aS5wdXNoKFtzLGwsdV0pfWlmKG8+MCl7dmFyIGM9MCxoPWlbY10sZj1bXTt0LmRzLml0ZXJhdGUobmV3IFB0KHIsMCksbmV3IFB0KHIsTnVtYmVyLk1BWF9WQUxVRSksZnVuY3Rpb24odCl7Zm9yKDtudWxsIT1oOyl7dmFyIGU9MDtpZih0Ll9pZC5jbG9jayt0Lmxlbjw9aFswXSlicmVhaztoWzBdPHQuX2lkLmNsb2NrPyhlPU1hdGgubWluKHQuX2lkLmNsb2NrLWhbMF0saFsxXSksZi5wdXNoKFtyLGhbMF0sZV0pKTooZT10Ll9pZC5jbG9jayt0Lmxlbi1oWzBdLGhbMl0mJiF0LmdjJiZmLnB1c2goW3IsaFswXSxNYXRoLm1pbihlLGhbMV0pXSkpLGhbMV08PWU/aD1pWysrY106KGhbMF09aFswXStlLGhbMV09aFsxXS1lKX19KTtmb3IodmFyIGQ9Zi5sZW5ndGgtMTtkPj0wO2QtLSl7dmFyIF89ZltkXTtnKHQsX1swXSxfWzFdLF9bMl0sITApfWZvcig7YzxpLmxlbmd0aDtjKyspaD1pW2NdLGcodCxyLGhbMF0saFsxXSwhMCl9fSgpfWZ1bmN0aW9uIGwodCxlLG4pe3ZhciByPWUucmVhZFZhclN0cmluZygpLGk9ZS5yZWFkVmFyVWludCgpO24ucHVzaCgnICAtIGF1dGg6IFwiJytyKydcIicpLG4ucHVzaChcIiAgLSBwcm90b2NvbFZlcnNpb246IFwiK2kpO2Zvcih2YXIgbz1bXSxhPWUucmVhZFVpbnQzMigpLHM9MDtzPGE7cysrKXt2YXIgbD1lLnJlYWRWYXJVaW50KCksdT1lLnJlYWRWYXJVaW50KCk7by5wdXNoKFwiKFwiK2wrXCI6XCIrdStcIilcIil9bi5wdXNoKFwiICA9PSBTUzogXCIrby5qb2luKFwiLFwiKSl9ZnVuY3Rpb24gdSh0LGUpe3ZhciBuPW5ldyBDdDtuLndyaXRlVmFyU3RyaW5nKHQueS5yb29tKSxuLndyaXRlVmFyU3RyaW5nKFwic3luYyBzdGVwIDFcIiksbi53cml0ZVZhclN0cmluZyh0LmF1dGhJbmZvfHxcIlwiKSxuLndyaXRlVmFyVWludCh0LnByb3RvY29sVmVyc2lvbiksbyh0LnksbiksdC5zZW5kKGUsbi5jcmVhdGVCdWZmZXIoKSl9ZnVuY3Rpb24gYyh0LGUsbil7dmFyIHI9ZS5wb3M7ZS53cml0ZVVpbnQzMigwKTt2YXIgaT0wLG89ITAsYT0hMSxzPXZvaWQgMDt0cnl7Zm9yKHZhciBsLHU9dC5zcy5zdGF0ZS5rZXlzKClbU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9bC52YWx1ZSxoPW4uZ2V0KGMpfHwwO2lmKGMhPT1xdCl7dmFyIGY9bmV3IFB0KGMsaCksZD10Lm9zLmZpbmRQcmV2KGYpLF89bnVsbD09PWQ/bnVsbDpkLl9pZDtpZihudWxsIT09XyYmXy51c2VyPT09YyYmXy5jbG9jaytkLl9sZW5ndGg+aCl7ZC5fY2xvbmVQYXJ0aWFsKGgtXy5jbG9jaykuX3RvQmluYXJ5KGUpLGkrK310Lm9zLml0ZXJhdGUoZixuZXcgUHQoYyxOdW1iZXIuTUFYX1ZBTFVFKSxmdW5jdGlvbih0KXt0Ll90b0JpbmFyeShlKSxpKyt9KX19fWNhdGNoKHQpe2E9ITAscz10fWZpbmFsbHl7dHJ5eyFvJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKGEpdGhyb3cgc319ZS5zZXRVaW50MzIocixpKX1mdW5jdGlvbiBoKHQsZSxuLHIsbyl7dmFyIHM9dC5yZWFkVmFyVWludCgpO3MhPT1uLmNvbm5lY3Rvci5wcm90b2NvbFZlcnNpb24mJihjb25zb2xlLndhcm4oXCJZb3UgdHJpZWQgdG8gc3luYyB3aXRoIGEgWWpzIGluc3RhbmNlIHRoYXQgaGFzIGEgZGlmZmVyZW50IHByb3RvY29sIHZlcnNpb25cXG4gICAgICAoWW91OiBcIitzK1wiLCBDbGllbnQ6IFwiK3MrXCIpLlxcbiAgICAgIFwiKSxuLmRlc3Ryb3koKSksZS53cml0ZVZhclN0cmluZyhcInN5bmMgc3RlcCAyXCIpLGUud3JpdGVWYXJTdHJpbmcobi5jb25uZWN0b3IuYXV0aEluZm98fFwiXCIpLGMobixlLGkodCkpLGEobixlKSxuLmNvbm5lY3Rvci5zZW5kKHIudWlkLGUuY3JlYXRlQnVmZmVyKCkpLHIucmVjZWl2ZWRTeW5jU3RlcDI9ITAsXCJzbGF2ZVwiPT09bi5jb25uZWN0b3Iucm9sZSYmdShuLmNvbm5lY3RvcixvKX1mdW5jdGlvbiBmKHQsZSxyKXtyLnB1c2goXCIgICAgIC0gYXV0aDogXCIrZS5yZWFkVmFyU3RyaW5nKCkpLHIucHVzaChcIiAgPT0gT1M6XCIpLG4odCxlLHIpLHIucHVzaChcIiAgPT0gRFM6XCIpO2Zvcih2YXIgaT1lLnJlYWRVaW50MzIoKSxvPTA7bzxpO28rKyl7dmFyIGE9ZS5yZWFkVmFyVWludCgpO3IucHVzaChcIiAgICBVc2VyOiBcIithK1wiOiBcIik7Zm9yKHZhciBzPWUucmVhZFVpbnQzMigpLGw9MDtsPHM7bCsrKXt2YXIgdT1lLnJlYWRWYXJVaW50KCksYz1lLnJlYWRWYXJVaW50KCksaD0xPT09ZS5yZWFkVWludDgoKTtyLnB1c2goXCJbXCIrdStcIiwgXCIrYytcIiwgXCIraCtcIl1cIil9fX1mdW5jdGlvbiBkKHQsZSxuLGksbyl7cihuLHQpLHMobix0KSxuLmNvbm5lY3Rvci5fc2V0U3luY2VkV2l0aChvKX1mdW5jdGlvbiBfKHQpe3ZhciBlPXh0KHQsMikscj1lWzBdLGk9ZVsxXSxvPW5ldyBWdChpKTtvLnJlYWRWYXJTdHJpbmcoKTt2YXIgYT1vLnJlYWRWYXJTdHJpbmcoKSxzPVtdO3JldHVybiBzLnB1c2goXCJcXG4gPT09IFwiK2ErXCIgPT09XCIpLFwidXBkYXRlXCI9PT1hP24ocixvLHMpOlwic3luYyBzdGVwIDFcIj09PWE/bChyLG8scyk6XCJzeW5jIHN0ZXAgMlwiPT09YT9mKHIsbyxzKTpzLnB1c2goXCItLSBVbmtub3duIG1lc3NhZ2UgdHlwZSAtIHByb2JhYmx5IGFuIGVuY29kaW5nIGlzc3VlISEhXCIpLHMuam9pbihcIlxcblwiKX1mdW5jdGlvbiB2KHQpe3ZhciBlPW5ldyBWdCh0KTtyZXR1cm4gZS5yZWFkVmFyU3RyaW5nKCksZS5yZWFkVmFyU3RyaW5nKCl9ZnVuY3Rpb24gcCh0KXtpZihudWxsIT09dCYmbnVsbCE9dC5faWQmJih0PXQuX2lkKSxudWxsPT09dClyZXR1cm5cIigpXCI7aWYodCBpbnN0YW5jZW9mIFB0KXJldHVyblwiKFwiK3QudXNlcitcIixcIit0LmNsb2NrK1wiKVwiO2lmKHQgaW5zdGFuY2VvZiAkdClyZXR1cm5cIihcIit0Lm5hbWUrXCIsXCIrdC50eXBlK1wiKVwiO2lmKHQuY29uc3RydWN0b3I9PT1ZKXJldHVyblwieVwiO3Rocm93IG5ldyBFcnJvcihcIlRoaXMgaXMgbm90IGEgdmFsaWQgSUQhXCIpfWZ1bmN0aW9uIHkodCxlLG4pe3ZhciByPW51bGwhPT1lLl9sZWZ0P2UuX2xlZnQuX2xhc3RJZDpudWxsLGk9bnVsbCE9PWUuX29yaWdpbj9lLl9vcmlnaW4uX2xhc3RJZDpudWxsO3JldHVybiB0K1wiKGlkOlwiK3AoZS5faWQpK1wiLGxlZnQ6XCIrcChyKStcIixvcmlnaW46XCIrcChpKStcIixyaWdodDpcIitwKGUuX3JpZ2h0KStcIixwYXJlbnQ6XCIrcChlLl9wYXJlbnQpK1wiLHBhcmVudFN1YjpcIitlLl9wYXJlbnRTdWIrKHZvaWQgMCE9PW4/XCIgLSBcIituOlwiXCIpK1wiKVwifWZ1bmN0aW9uIGcodCxlLG4scixpKXt2YXIgbz1udWxsIT09dC5jb25uZWN0b3ImJnQuY29ubmVjdG9yLl9mb3J3YXJkQXBwbGllZFN0cnVjdHMsYT10Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KG5ldyBQdChlLG4pKTtpZihudWxsIT09YSl7YS5fZGVsZXRlZHx8KGEuX3NwbGl0QXQodCxyKSxhLl9kZWxldGUodCxvLCEwKSk7dmFyIHM9YS5fbGVuZ3RoO2lmKHItPXMsbis9cyxyPjApZm9yKHZhciBsPXQub3MuZmluZE5vZGUobmV3IFB0KGUsbikpO251bGwhPT1sJiZudWxsIT09bC52YWwmJnI+MCYmbC52YWwuX2lkLmVxdWFscyhuZXcgUHQoZSxuKSk7KXt2YXIgdT1sLnZhbDt1Ll9kZWxldGVkfHwodS5fc3BsaXRBdCh0LHIpLHUuX2RlbGV0ZSh0LG8saSkpO3ZhciBjPXUuX2xlbmd0aDtyLT1jLG4rPWMsbD1sLm5leHQoKX19fWZ1bmN0aW9uIG0odCxlLG4pe2lmKGUhPT10JiYhZS5fZGVsZXRlZCYmIXQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKSl7dmFyIHI9dC5fdHJhbnNhY3Rpb24uY2hhbmdlZFR5cGVzLGk9ci5nZXQoZSk7dm9pZCAwPT09aSYmKGk9bmV3IFNldCxyLnNldChlLGkpKSxpLmFkZChuKX19ZnVuY3Rpb24gayh0LGUsbixyKXt2YXIgaT1lLl9pZDtuLl9pZD1uZXcgUHQoaS51c2VyLGkuY2xvY2srciksbi5fb3JpZ2luPWUsbi5fbGVmdD1lLG4uX3JpZ2h0PWUuX3JpZ2h0LG51bGwhPT1uLl9yaWdodCYmKG4uX3JpZ2h0Ll9sZWZ0PW4pLG4uX3JpZ2h0X29yaWdpbj1lLl9yaWdodF9vcmlnaW4sZS5fcmlnaHQ9bixuLl9wYXJlbnQ9ZS5fcGFyZW50LG4uX3BhcmVudFN1Yj1lLl9wYXJlbnRTdWIsbi5fZGVsZXRlZD1lLl9kZWxldGVkO3ZhciBvPW5ldyBTZXQ7by5hZGQoZSk7Zm9yKHZhciBhPW4uX3JpZ2h0O251bGwhPT1hJiZvLmhhcyhhLl9vcmlnaW4pOylhLl9vcmlnaW49PT1lJiYoYS5fb3JpZ2luPW4pLG8uYWRkKGEpLGE9YS5fcmlnaHQ7dC5vcy5wdXQobiksdC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuaGFzKGUpP3QuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmFkZChuKTp0Ll90cmFuc2FjdGlvbi5kZWxldGVkU3RydWN0cy5oYXMoZSkmJnQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmFkZChuKX1mdW5jdGlvbiBiKHQsZSl7dmFyIG49dm9pZCAwO2Rve249ZS5fcmlnaHQsZS5fcmlnaHQ9bnVsbCxlLl9yaWdodF9vcmlnaW49bnVsbCxlLl9vcmlnaW49ZS5fbGVmdCxlLl9pbnRlZ3JhdGUodCksZT1ufXdoaWxlKG51bGwhPT1uKX1mdW5jdGlvbiB3KHQsZSl7Zm9yKDtudWxsIT09ZTspZS5fZGVsZXRlKHQsITEsITApLGUuX2djKHQpLGU9ZS5fcmlnaHR9ZnVuY3Rpb24gUyh0LGUsbixyLGkpe3QuX29yaWdpbj1yLHQuX2xlZnQ9cix0Ll9yaWdodD1pLHQuX3JpZ2h0X29yaWdpbj1pLHQuX3BhcmVudD1lLG51bGwhPT1uP3QuX2ludGVncmF0ZShuKTpudWxsPT09cj9lLl9zdGFydD10OnIuX3JpZ2h0PXR9ZnVuY3Rpb24gTyh0LGUsbixyLGkpe2Zvcig7bnVsbCE9PXImJmk+MDspe3N3aXRjaChyLmNvbnN0cnVjdG9yKXtjYXNlIEh0OmNhc2UgSXRlbVN0cmluZzppZihpPD0oci5fZGVsZXRlZD8wOnIuX2xlbmd0aC0xKSlyZXR1cm4gcj1yLl9zcGxpdEF0KGUuX3ksaSksbj1yLl9sZWZ0LFtuLHIsdF07ITE9PT1yLl9kZWxldGVkJiYoaS09ci5fbGVuZ3RoKTticmVhaztjYXNlIEp0OiExPT09ci5fZGVsZXRlZCYmQih0LHIpfW49cixyPXIuX3JpZ2h0fXJldHVybltuLHIsdF19ZnVuY3Rpb24gRSh0LGUpe3JldHVybiBPKG5ldyBNYXAsdCxudWxsLHQuX3N0YXJ0LGUpfWZ1bmN0aW9uIFUodCxlLG4scixpKXtmb3IoO251bGwhPT1yJiYoITA9PT1yLl9kZWxldGVkfHxyLmNvbnN0cnVjdG9yPT09SnQmJmkuZ2V0KHIua2V5KT09PXIudmFsdWUpOykhMT09PXIuX2RlbGV0ZWQmJmkuZGVsZXRlKHIua2V5KSxuPXIscj1yLl9yaWdodDt2YXIgbz0hMCxhPSExLHM9dm9pZCAwO3RyeXtmb3IodmFyIGwsdT1pW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPXh0KGwudmFsdWUsMiksaD1jWzBdLGY9Y1sxXSxkPW5ldyBKdDtkLmtleT1oLGQudmFsdWU9ZixTKGQsZSx0LG4sciksbj1kfX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fXJldHVybltuLHJdfWZ1bmN0aW9uIEIodCxlKXt2YXIgbj1lLnZhbHVlLHI9ZS5rZXk7bnVsbD09PW4/dC5kZWxldGUocik6dC5zZXQocixuKX1mdW5jdGlvbiBUKHQsZSxuLHIpe2Zvcig7Oyl7aWYobnVsbD09PWUpYnJlYWs7aWYoITA9PT1lLl9kZWxldGVkKTtlbHNle2lmKGUuY29uc3RydWN0b3IhPT1KdHx8KHJbZS5rZXldfHxudWxsKSE9PWUudmFsdWUpYnJlYWs7QihuLGUpfXQ9ZSxlPWUuX3JpZ2h0fXJldHVyblt0LGVdfWZ1bmN0aW9uIEEodCxlLG4scixpLG8pe3ZhciBhPW5ldyBNYXA7Zm9yKHZhciBzIGluIGkpe3ZhciBsPWlbc10sdT1vLmdldChzKTtpZih1IT09bCl7YS5zZXQocyx1fHxudWxsKTt2YXIgYz1uZXcgSnQ7Yy5rZXk9cyxjLnZhbHVlPWwsUyhjLGUsdCxuLHIpLG49Y319cmV0dXJuW24scixhXX1mdW5jdGlvbiB4KHQsZSxuLHIsaSxvLGEpe3ZhciBzPSEwLGw9ITEsdT12b2lkIDA7dHJ5e2Zvcih2YXIgYyxoPW9bU3ltYm9sLml0ZXJhdG9yXSgpOyEocz0oYz1oLm5leHQoKSkuZG9uZSk7cz0hMCl7dmFyIGY9eHQoYy52YWx1ZSwxKSxkPWZbMF07dm9pZCAwPT09YVtkXSYmKGFbZF09bnVsbCl9fWNhdGNoKHQpe2w9ITAsdT10fWZpbmFsbHl7dHJ5eyFzJiZoLnJldHVybiYmaC5yZXR1cm4oKX1maW5hbGx5e2lmKGwpdGhyb3cgdX19dmFyIF89VChyLGksbyxhKSx2PXh0KF8sMik7cj12WzBdLGk9dlsxXTt2YXIgcD12b2lkIDAseT1BKHQsbixyLGksYSxvKSxnPXh0KHksMyk7cj1nWzBdLGk9Z1sxXSxwPWdbMl07dmFyIG09dm9pZCAwO3JldHVybiBlLmNvbnN0cnVjdG9yPT09U3RyaW5nPyhtPW5ldyBJdGVtU3RyaW5nLG0uX2NvbnRlbnQ9ZSk6KG09bmV3IEh0LG0uZW1iZWQ9ZSksUyhtLG4sdCxyLGkpLHI9bSxVKHQsbixyLGkscCl9ZnVuY3Rpb24gSSh0LGUsbixyLGksbyxhKXt2YXIgcz1UKHIsaSxvLGEpLGw9eHQocywyKTtyPWxbMF0saT1sWzFdO3ZhciB1PXZvaWQgMCxjPUEodCxuLHIsaSxhLG8pLGg9eHQoYywzKTtmb3Iocj1oWzBdLGk9aFsxXSx1PWhbMl07ZT4wJiZudWxsIT09aTspe2lmKCExPT09aS5fZGVsZXRlZClzd2l0Y2goaS5jb25zdHJ1Y3Rvcil7Y2FzZSBKdDp2YXIgZj1hW2kua2V5XTt2b2lkIDAhPT1mJiYoZj09PWkudmFsdWU/dS5kZWxldGUoaS5rZXkpOnUuc2V0KGkua2V5LGkudmFsdWUpLGkuX2RlbGV0ZSh0KSksQihvLGkpO2JyZWFrO2Nhc2UgSHQ6Y2FzZSBJdGVtU3RyaW5nOmkuX3NwbGl0QXQodCxlKSxlLT1pLl9sZW5ndGh9cj1pLGk9aS5fcmlnaHR9cmV0dXJuIFUodCxuLHIsaSx1KX1mdW5jdGlvbiBEKHQsZSxuLHIsaSxvKXtmb3IoO2U+MCYmbnVsbCE9PWk7KXtpZighMT09PWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgSnQ6QihvLGkpO2JyZWFrO2Nhc2UgSHQ6Y2FzZSBJdGVtU3RyaW5nOmkuX3NwbGl0QXQodCxlKSxlLT1pLl9sZW5ndGgsaS5fZGVsZXRlKHQpfXI9aSxpPWkuX3JpZ2h0fXJldHVybltyLGldfWZ1bmN0aW9uIFAodCxlKXtmb3IoZT1lLl9wYXJlbnQ7bnVsbCE9PWU7KXtpZihlPT09dClyZXR1cm4hMDtlPWUuX3BhcmVudH1yZXR1cm4hMX1mdW5jdGlvbiBqKHQsZSl7cmV0dXJuIGV9ZnVuY3Rpb24gTih0LGUpe2Zvcih2YXIgbj1uZXcgTWFwLHI9dC5hdHRyaWJ1dGVzLmxlbmd0aC0xO3I+PTA7ci0tKXt2YXIgaT10LmF0dHJpYnV0ZXNbcl07bi5zZXQoaS5uYW1lLGkudmFsdWUpfXJldHVybiBlKHQubm9kZU5hbWUsbil9ZnVuY3Rpb24gVih0LGUsbil7aWYoUChlLnR5cGUsbikpe3ZhciByPW4ubm9kZU5hbWUsaT1uZXcgTWFwO2lmKHZvaWQgMCE9PW4uZ2V0QXR0cmlidXRlcyl7dmFyIG89bi5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBhIGluIG8paS5zZXQoYSxvW2FdKX12YXIgcz1lLmZpbHRlcihyLG5ldyBNYXAoaSkpO251bGw9PT1zP24uX2RlbGV0ZSh0KTppLmZvckVhY2goZnVuY3Rpb24odCxlKXshMT09PXMuaGFzKGUpJiZuLnJlbW92ZUF0dHJpYnV0ZShlKX0pfX1mdW5jdGlvbiBMKHQpe3ZhciBlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTpkb2N1bWVudCxuPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fSxyPWFyZ3VtZW50cy5sZW5ndGg+MyYmdm9pZCAwIT09YXJndW1lbnRzWzNdP2FyZ3VtZW50c1szXTpqLGk9YXJndW1lbnRzWzRdLG89dm9pZCAwO3N3aXRjaCh0Lm5vZGVUeXBlKXtjYXNlIGUuRUxFTUVOVF9OT0RFOnZhciBhPW51bGwscz12b2lkIDA7aWYodC5oYXNBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpJiYoYT10LmdldEF0dHJpYnV0ZShcImRhdGEteWpzLWhvb2tcIiksdm9pZCAwPT09KHM9blthXSkmJihjb25zb2xlLmVycm9yKCdVbmtub3duIGhvb2sgXCInK2ErJ1wiLiBEZWxldGluZyB5anNIb29rIGRhdGFzZXQgcHJvcGVydHkuJyksdC5yZW1vdmVBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpLGE9bnVsbCkpLG51bGw9PT1hKXt2YXIgbD1OKHQscik7bnVsbD09PWw/bz0hMToobz1uZXcgWVhtbEVsZW1lbnQodC5ub2RlTmFtZSksbC5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7by5zZXRBdHRyaWJ1dGUoZSx0KX0pLG8uaW5zZXJ0KDAsSih0LmNoaWxkTm9kZXMsZG9jdW1lbnQsbixyLGkpKSl9ZWxzZSBvPW5ldyBZWG1sSG9vayhhKSxzLmZpbGxUeXBlKHQsbyk7YnJlYWs7Y2FzZSBlLlRFWFRfTk9ERTpvPW5ldyBZWG1sVGV4dCxvLmluc2VydCgwLHQubm9kZVZhbHVlKTticmVhaztkZWZhdWx0OnRocm93IG5ldyBFcnJvcihcIkNhbid0IHRyYW5zZm9ybSB0aGlzIG5vZGUgdHlwZSB0byBhIFlYbWwgdHlwZSFcIil9cmV0dXJuIFIoaSx0LG8pLG99ZnVuY3Rpb24gTSh0KXtmb3IoO251bGwhPT10JiZ0Ll9kZWxldGVkOyl0PXQuX3JpZ2h0O3JldHVybiB0fWZ1bmN0aW9uIEModCxlLG4pe3QuZG9tVG9UeXBlLmRlbGV0ZShlKSx0LnR5cGVUb0RvbS5kZWxldGUobil9ZnVuY3Rpb24gUih0LGUsbil7dm9pZCAwIT09dCYmKHQuZG9tVG9UeXBlLnNldChlLG4pLHQudHlwZVRvRG9tLnNldChuLGUpKX1mdW5jdGlvbiBXKHQsZSxuKXtpZih2b2lkIDAhPT10KXt2YXIgcj10LmRvbVRvVHlwZS5nZXQoZSk7dm9pZCAwIT09ciYmKEModCxlLHIpLFIodCxuLHIpKX19ZnVuY3Rpb24gSCh0LGUsbixyLGkpe3ZhciBvPUoobixyLGkub3B0cy5ob29rcyxpLmZpbHRlcixpKTtyZXR1cm4gdC5pbnNlcnRBZnRlcihlLG8pfWZ1bmN0aW9uIEoodCxlLG4scixpKXt2YXIgbz1bXSxhPSEwLHM9ITEsbD12b2lkIDA7dHJ5e2Zvcih2YXIgdSxjPXRbU3ltYm9sLml0ZXJhdG9yXSgpOyEoYT0odT1jLm5leHQoKSkuZG9uZSk7YT0hMCl7dmFyIGg9dS52YWx1ZSxmPUwoaCxlLG4scixpKTshMSE9PWYmJm8ucHVzaChmKX19Y2F0Y2godCl7cz0hMCxsPXR9ZmluYWxseXt0cnl7IWEmJmMucmV0dXJuJiZjLnJldHVybigpfWZpbmFsbHl7aWYocyl0aHJvdyBsfX1yZXR1cm4gb31mdW5jdGlvbiB6KHQsZSxuLHIsaSl7dmFyIG89SCh0LGUsW25dLHIsaSk7cmV0dXJuIG8ubGVuZ3RoPjA/b1swXTplfWZ1bmN0aW9uIEYodCxlLG4pe2Zvcig7ZSE9PW47KXt2YXIgcj1lO2U9ZS5uZXh0U2libGluZyx0LnJlbW92ZUNoaWxkKHIpfX1mdW5jdGlvbiBYKHQsZSl7RnQuc2V0KHQsZSksWHQuc2V0KGUsdCl9ZnVuY3Rpb24gcSh0KXtyZXR1cm4gRnQuZ2V0KHQpfWZ1bmN0aW9uICQodCl7cmV0dXJuIFh0LmdldCh0KX1mdW5jdGlvbiBHKCl7aWYoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNyeXB0byYmbnVsbCE9Y3J5cHRvLmdldFJhbmRvbVZhbHVlKXt2YXIgdD1uZXcgVWludDMyQXJyYXkoMSk7cmV0dXJuIGNyeXB0by5nZXRSYW5kb21WYWx1ZXModCksdFswXX1pZihcInVuZGVmaW5lZFwiIT10eXBlb2YgY3J5cHRvJiZudWxsIT1jcnlwdG8ucmFuZG9tQnl0ZXMpe3ZhciBlPWNyeXB0by5yYW5kb21CeXRlcyg0KTtyZXR1cm4gbmV3IFVpbnQzMkFycmF5KGUuYnVmZmVyKVswXX1yZXR1cm4gTWF0aC5jZWlsKDQyOTQ5NjcyOTUqTWF0aC5yYW5kb20oKSl9ZnVuY3Rpb24gWih0LGUpe2Zvcih2YXIgbj10Ll9zdGFydDtudWxsIT09bjspe2lmKCExPT09bi5fZGVsZXRlZCl7aWYobi5fbGVuZ3RoPmUpcmV0dXJuW24uX2lkLnVzZXIsbi5faWQuY2xvY2srZV07ZS09bi5fbGVuZ3RofW49bi5fcmlnaHR9cmV0dXJuW1wiZW5kb2ZcIix0Ll9pZC51c2VyLHQuX2lkLmNsb2NrfHxudWxsLHQuX2lkLm5hbWV8fG51bGwsdC5faWQudHlwZXx8bnVsbF19ZnVuY3Rpb24gUSh0LGUpe2lmKFwiZW5kb2ZcIj09PWVbMF0pe3ZhciBuPXZvaWQgMDtuPW51bGw9PT1lWzNdP25ldyBQdChlWzFdLGVbMl0pOm5ldyAkdChlWzNdLGVbNF0pO2Zvcih2YXIgcj10Lm9zLmdldChuKTtudWxsIT09ci5fcmVkb25lOylyPXIuX3JlZG9uZTtyZXR1cm4gbnVsbD09PXJ8fHIuY29uc3RydWN0b3I9PT1MdD9udWxsOnt0eXBlOnIsb2Zmc2V0OnIubGVuZ3RofX1mb3IodmFyIGk9MCxvPXQub3MuZmluZE5vZGVXaXRoVXBwZXJCb3VuZChuZXcgUHQoZVswXSxlWzFdKSkudmFsLGE9ZVsxXS1vLl9pZC5jbG9jaztudWxsIT09by5fcmVkb25lOylvPW8uX3JlZG9uZTt2YXIgcz1vLl9wYXJlbnQ7aWYoby5jb25zdHJ1Y3Rvcj09PUx0fHxzLl9kZWxldGVkKXJldHVybiBudWxsO2ZvcihvLl9kZWxldGVkfHwoaT1hKSxvPW8uX2xlZnQ7bnVsbCE9PW87KW8uX2RlbGV0ZWR8fChpKz1vLl9sZW5ndGgpLG89by5fbGVmdDtyZXR1cm57dHlwZTpzLG9mZnNldDppfX1mdW5jdGlvbiBLKCl7dmFyIHQ9ITA7cmV0dXJuIGZ1bmN0aW9uKGUpe2lmKHQpe3Q9ITE7dHJ5e2UoKX1jYXRjaCh0KXtjb25zb2xlLmVycm9yKHQpfXQ9ITB9fX1mdW5jdGlvbiB0dCh0KXt2YXIgZT1nZXRTZWxlY3Rpb24oKSxuPWUuYmFzZU5vZGUscj1lLmJhc2VPZmZzZXQsaT1lLmV4dGVudE5vZGUsbz1lLmV4dGVudE9mZnNldCxhPXQuZG9tVG9UeXBlLmdldChuKSxzPXQuZG9tVG9UeXBlLmdldChpKTtyZXR1cm4gdm9pZCAwIT09YSYmdm9pZCAwIT09cz97ZnJvbTpaKGEsciksdG86WihzLG8pfTpudWxsfWZ1bmN0aW9uIGV0KHQsZSl7ZSYmKHRlPWVlKHQpKX1mdW5jdGlvbiBudCh0LGUpe251bGwhPT10ZSYmZSYmdC5yZXN0b3JlU2VsZWN0aW9uKHRlKX1mdW5jdGlvbiBydCh0KXtpZihudWxsIT09dCl7dmFyIGU9Z2V0U2VsZWN0aW9uKCkuYW5jaG9yTm9kZTtpZihudWxsIT1lKXtlLm5vZGVUeXBlPT09ZG9jdW1lbnQuVEVYVF9OT0RFJiYoZT1lLnBhcmVudEVsZW1lbnQpO3JldHVybntlbGVtOmUsdG9wOmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wfX1mb3IodmFyIG49dC5jaGlsZHJlbixyPTA7cjxuLmxlbmd0aDtyKyspe3ZhciBpPW5bcl0sbz1pLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO2lmKG8udG9wPj0wKXJldHVybntlbGVtOmksdG9wOm8udG9wfX19cmV0dXJuIG51bGx9ZnVuY3Rpb24gaXQodCxlKXtpZihudWxsIT09ZSl7dmFyIG49ZS5lbGVtLHI9ZS50b3AsaT1uLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCxvPXQuc2Nyb2xsVG9wK2ktcjtvPj0wJiYodC5zY3JvbGxUb3A9byl9fWZ1bmN0aW9uIG90KHQpe3ZhciBlPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe3ZhciBuPXJ0KGUuc2Nyb2xsaW5nRWxlbWVudCk7dC5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBuPXQudGFyZ2V0LHI9ZS50eXBlVG9Eb20uZ2V0KG4pO2lmKHZvaWQgMCE9PXImJiExIT09cilpZihuLmNvbnN0cnVjdG9yPT09WVhtbFRleHQpci5ub2RlVmFsdWU9bi50b1N0cmluZygpO2Vsc2UgaWYodm9pZCAwIT09dC5hdHRyaWJ1dGVzQ2hhbmdlZCYmKHQuYXR0cmlidXRlc0NoYW5nZWQuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgZT1uLmdldEF0dHJpYnV0ZSh0KTt2b2lkIDA9PT1lP3IucmVtb3ZlQXR0cmlidXRlKHQpOnIuc2V0QXR0cmlidXRlKHQsZSl9KSx0LmNoaWxkTGlzdENoYW5nZWQmJm4uY29uc3RydWN0b3IhPT1ZWG1sSG9vaykpe3ZhciBpPXIuZmlyc3RDaGlsZDtuLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIG49ZS50eXBlVG9Eb20uZ2V0KHQpO3N3aXRjaChuKXtjYXNlIHZvaWQgMDp2YXIgbz10LnRvRG9tKGUub3B0cy5kb2N1bWVudCxlLm9wdHMuaG9va3MsZSk7ci5pbnNlcnRCZWZvcmUobyxpKTticmVhaztjYXNlITE6YnJlYWs7ZGVmYXVsdDpGKHIsaSxuKSxpPW4ubmV4dFNpYmxpbmd9fSksRihyLGksbnVsbCl9fSksaXQoZS5zY3JvbGxpbmdFbGVtZW50LG4pfSl9ZnVuY3Rpb24gYXQodCxlKXtmb3IodmFyIG49MCxyPTA7bjx0Lmxlbmd0aCYmbjxlLmxlbmd0aCYmdFtuXT09PWVbbl07KW4rKztpZihuIT09dC5sZW5ndGh8fG4hPT1lLmxlbmd0aClmb3IoO3Irbjx0Lmxlbmd0aCYmcituPGUubGVuZ3RoJiZ0W3QubGVuZ3RoLXItMV09PT1lW2UubGVuZ3RoLXItMV07KXIrKztyZXR1cm57cG9zOm4scmVtb3ZlOnQubGVuZ3RoLW4tcixpbnNlcnQ6ZS5zbGljZShuLGUubGVuZ3RoLXIpfX1mdW5jdGlvbiBzdCh0LGUsbixyKXtpZihudWxsIT1uJiYhMSE9PW4mJm4uY29uc3RydWN0b3IhPT1ZWG1sSG9vayl7Zm9yKHZhciBpPW4uX3ksbz1uZXcgU2V0LGE9ZS5jaGlsZE5vZGVzLmxlbmd0aC0xO2E+PTA7YS0tKXt2YXIgcz10LmRvbVRvVHlwZS5nZXQoZS5jaGlsZE5vZGVzW2FdKTt2b2lkIDAhPT1zJiYhMSE9PXMmJm8uYWRkKHMpfW4uZm9yRWFjaChmdW5jdGlvbihlKXshMT09PW8uaGFzKGUpJiYoZS5fZGVsZXRlKGkpLEModCx0LnR5cGVUb0RvbS5nZXQoZSksZSkpfSk7Zm9yKHZhciBsPWUuY2hpbGROb2Rlcyx1PWwubGVuZ3RoLGM9bnVsbCxoPU0obi5fc3RhcnQpLGY9MDtmPHU7ZisrKXt2YXIgZD1sW2ZdLF89dC5kb21Ub1R5cGUuZ2V0KGQpO2lmKHZvaWQgMCE9PV8pe2lmKCExPT09Xyljb250aW51ZTtudWxsIT09aD9oIT09Xz8oXy5fcGFyZW50IT09bj9DKHQsZCxfKTooQyh0LGQsXyksXy5fZGVsZXRlKGkpKSxjPXoobixjLGQscix0KSk6KGM9aCxoPU0oaC5fcmlnaHQpKTpjPXoobixjLGQscix0KX1lbHNlIGM9eihuLGMsZCxyLHQpfX19ZnVuY3Rpb24gbHQodCxlKXt2YXIgbj10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtuLnR5cGUuX3kudHJhbnNhY3QoZnVuY3Rpb24oKXt2YXIgcj1uZXcgU2V0O3QuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgZT10LnRhcmdldCxpPW4uZG9tVG9UeXBlLmdldChlKTtpZih2b2lkIDA9PT1pKXt2YXIgbz1lLGE9dm9pZCAwO2Rve289by5wYXJlbnRFbGVtZW50LGE9bi5kb21Ub1R5cGUuZ2V0KG8pfXdoaWxlKHZvaWQgMD09PWEmJm51bGwhPT1vKTtyZXR1cm4gdm9pZCghMSE9PWEmJnZvaWQgMCE9PWEmJmEuY29uc3RydWN0b3IhPT1ZWG1sSG9vayYmci5hZGQobykpfWlmKCExIT09aSYmaS5jb25zdHJ1Y3RvciE9PVlYbWxIb29rKXN3aXRjaCh0LnR5cGUpe2Nhc2VcImNoYXJhY3RlckRhdGFcIjp2YXIgcz1hdChpLnRvU3RyaW5nKCksZS5ub2RlVmFsdWUpO2kuZGVsZXRlKHMucG9zLHMucmVtb3ZlKSxpLmluc2VydChzLnBvcyxzLmluc2VydCk7YnJlYWs7Y2FzZVwiYXR0cmlidXRlc1wiOmlmKGkuY29uc3RydWN0b3I9PT1ZWG1sRnJhZ21lbnQpYnJlYWs7dmFyIGw9dC5hdHRyaWJ1dGVOYW1lLHU9ZS5nZXRBdHRyaWJ1dGUobCksYz1uZXcgTWFwO2Muc2V0KGwsdSksaS5jb25zdHJ1Y3RvciE9PVlYbWxGcmFnbWVudCYmbi5maWx0ZXIoZS5ub2RlTmFtZSxjKS5zaXplPjAmJmkuZ2V0QXR0cmlidXRlKGwpIT09dSYmKG51bGw9PXU/aS5yZW1vdmVBdHRyaWJ1dGUobCk6aS5zZXRBdHRyaWJ1dGUobCx1KSk7YnJlYWs7Y2FzZVwiY2hpbGRMaXN0XCI6ci5hZGQodC50YXJnZXQpfX0pO3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXJbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9cy52YWx1ZSxjPW4uZG9tVG9UeXBlLmdldCh1KTtzdChuLHUsYyxlKX19Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX19KX0pfWZ1bmN0aW9uIHV0KHQsZSxuKXt2YXIgcj0hMSxpPXZvaWQgMDtyZXR1cm4gdC50cmFuc2FjdChmdW5jdGlvbigpe2Zvcig7IXImJm4ubGVuZ3RoPjA7KSFmdW5jdGlvbigpe2k9bi5wb3AoKSxudWxsIT09aS5mcm9tU3RhdGUmJih0Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KGkuZnJvbVN0YXRlKSx0Lm9zLmdldEl0ZW1DbGVhbkVuZChpLnRvU3RhdGUpLHQub3MuaXRlcmF0ZShpLmZyb21TdGF0ZSxpLnRvU3RhdGUsZnVuY3Rpb24obil7Zm9yKDtuLl9kZWxldGVkJiZudWxsIT09bi5fcmVkb25lOyluPW4uX3JlZG9uZTshMT09PW4uX2RlbGV0ZWQmJlAoZSxuKSYmKHI9ITAsbi5fZGVsZXRlKHQpKX0pKTt2YXIgbz1uZXcgU2V0LGE9ITAscz0hMSxsPXZvaWQgMDt0cnl7Zm9yKHZhciB1LGM9aS5kZWxldGVkU3RydWN0c1tTeW1ib2wuaXRlcmF0b3JdKCk7IShhPSh1PWMubmV4dCgpKS5kb25lKTthPSEwKXt2YXIgaD11LnZhbHVlLGY9aC5mcm9tLGQ9bmV3IFB0KGYudXNlcixmLmNsb2NrK2gubGVuLTEpO3Qub3MuZ2V0SXRlbUNsZWFuU3RhcnQoZiksdC5vcy5nZXRJdGVtQ2xlYW5FbmQoZCksdC5vcy5pdGVyYXRlKGYsZCxmdW5jdGlvbihuKXtQKGUsbikmJm4uX3BhcmVudCE9PXQmJihuLl9pZC51c2VyIT09dC51c2VySUR8fG51bGw9PT1pLmZyb21TdGF0ZXx8bi5faWQuY2xvY2s8aS5mcm9tU3RhdGUuY2xvY2t8fG4uX2lkLmNsb2NrPmkudG9TdGF0ZS5jbG9jaykmJm8uYWRkKG4pfSl9fWNhdGNoKHQpe3M9ITAsbD10fWZpbmFsbHl7dHJ5eyFhJiZjLnJldHVybiYmYy5yZXR1cm4oKX1maW5hbGx5e2lmKHMpdGhyb3cgbH19by5mb3JFYWNoKGZ1bmN0aW9uKGUpe3ZhciBuPWUuX3JlZG8odCxvKTtyPXJ8fG59KX0oKX0pLHImJmkuYmluZGluZ0luZm9zLmZvckVhY2goZnVuY3Rpb24odCxlKXtlLl9yZXN0b3JlVW5kb1N0YWNrSW5mbyh0KX0pLHJ9ZnVuY3Rpb24gY3QodCxlKXtyZXR1cm4gZT17ZXhwb3J0czp7fX0sdChlLGUuZXhwb3J0cyksZS5leHBvcnRzfWZ1bmN0aW9uIGh0KHQpe2lmKHQ9U3RyaW5nKHQpLCEodC5sZW5ndGg+MTAwKSl7dmFyIGU9L14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyh0KTtpZihlKXt2YXIgbj1wYXJzZUZsb2F0KGVbMV0pO3N3aXRjaCgoZVsyXXx8XCJtc1wiKS50b0xvd2VyQ2FzZSgpKXtjYXNlXCJ5ZWFyc1wiOmNhc2VcInllYXJcIjpjYXNlXCJ5cnNcIjpjYXNlXCJ5clwiOmNhc2VcInlcIjpyZXR1cm4gbip1ZTtjYXNlXCJkYXlzXCI6Y2FzZVwiZGF5XCI6Y2FzZVwiZFwiOnJldHVybiBuKmxlO2Nhc2VcImhvdXJzXCI6Y2FzZVwiaG91clwiOmNhc2VcImhyc1wiOmNhc2VcImhyXCI6Y2FzZVwiaFwiOnJldHVybiBuKnNlO2Nhc2VcIm1pbnV0ZXNcIjpjYXNlXCJtaW51dGVcIjpjYXNlXCJtaW5zXCI6Y2FzZVwibWluXCI6Y2FzZVwibVwiOnJldHVybiBuKmFlO2Nhc2VcInNlY29uZHNcIjpjYXNlXCJzZWNvbmRcIjpjYXNlXCJzZWNzXCI6Y2FzZVwic2VjXCI6Y2FzZVwic1wiOnJldHVybiBuKm9lO2Nhc2VcIm1pbGxpc2Vjb25kc1wiOmNhc2VcIm1pbGxpc2Vjb25kXCI6Y2FzZVwibXNlY3NcIjpjYXNlXCJtc2VjXCI6Y2FzZVwibXNcIjpyZXR1cm4gbjtkZWZhdWx0OnJldHVybn19fX1mdW5jdGlvbiBmdCh0KXtyZXR1cm4gdD49bGU/TWF0aC5yb3VuZCh0L2xlKStcImRcIjp0Pj1zZT9NYXRoLnJvdW5kKHQvc2UpK1wiaFwiOnQ+PWFlP01hdGgucm91bmQodC9hZSkrXCJtXCI6dD49b2U/TWF0aC5yb3VuZCh0L29lKStcInNcIjp0K1wibXNcIn1mdW5jdGlvbiBkdCh0KXtyZXR1cm4gX3QodCxsZSxcImRheVwiKXx8X3QodCxzZSxcImhvdXJcIil8fF90KHQsYWUsXCJtaW51dGVcIil8fF90KHQsb2UsXCJzZWNvbmRcIil8fHQrXCIgbXNcIn1mdW5jdGlvbiBfdCh0LGUsbil7aWYoISh0PGUpKXJldHVybiB0PDEuNSplP01hdGguZmxvb3IodC9lKStcIiBcIituOk1hdGguY2VpbCh0L2UpK1wiIFwiK24rXCJzXCJ9ZnVuY3Rpb24gdnQodCxlKXt0LnRyYW5zYWN0KGZ1bmN0aW9uKCl7cih0LGUpLHModCxlKX0pfWZ1bmN0aW9uIHB0KHQpe3ZhciBlPW5ldyBDdDtyZXR1cm4gYyh0LGUsbmV3IE1hcCksYSh0LGUpLGV9ZnVuY3Rpb24geXQoKXt2YXIgdD1uZXcgQ3Q7cmV0dXJuIHQud3JpdGVVaW50MzIoMCkse2xlbjowLGJ1ZmZlcjp0fX1mdW5jdGlvbiBndCgpe3ZhciB0PXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe3ZhciBlPXQudGFyZ2V0LG49dC50eXBlLHI9WihuLGUuc2VsZWN0aW9uU3RhcnQpLGk9WihuLGUuc2VsZWN0aW9uRW5kKTtlLnZhbHVlPW4udG9TdHJpbmcoKTt2YXIgbz1RKG4uX3ksciksYT1RKG4uX3ksaSk7ZS5zZXRTZWxlY3Rpb25SYW5nZShvLGEpfSl9ZnVuY3Rpb24gbXQoKXt2YXIgdD10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgZT1hdCh0LnR5cGUudG9TdHJpbmcoKSx0LnRhcmdldC52YWx1ZSk7dC50eXBlLmRlbGV0ZShlLnBvcyxlLnJlbW92ZSksdC50eXBlLmluc2VydChlLnBvcyxlLmluc2VydCl9KX1mdW5jdGlvbiBrdCh0KXt2YXIgZT10aGlzLnRhcmdldDtlLnVwZGF0ZShcInlqc1wiKSx0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7ZS51cGRhdGVDb250ZW50cyh0LmRlbHRhLFwieWpzXCIpLGUudXBkYXRlKFwieWpzXCIpfSl9ZnVuY3Rpb24gYnQodCl7dmFyIGU9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7ZS50eXBlLmFwcGx5RGVsdGEodC5vcHMpfSl9ZnVuY3Rpb24gd3QodCl7dmFyIGU9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7Zm9yKHZhciBuPWUudGFyZ2V0LHI9dC5kZWx0YSxpPTAsbz1uLnBvc0Zyb21JbmRleChpKSxhPTA7YTxyLmxlbmd0aDthKyspe3ZhciBzPXJbYV07cy5yZXRhaW4/KGk9cy5yZXRhaW4sbz1uLnBvc0Zyb21JbmRleChpKSk6cy5pbnNlcnQ/bi5yZXBsYWNlUmFuZ2Uocy5pbnNlcnQsbyxvKTpzLmRlbGV0ZSYmbi5yZXBsYWNlUmFuZ2UoXCJcIixvLG4ucG9zRnJvbUluZGV4KGkrcy5kZWxldGUpKX19KX1mdW5jdGlvbiBTdCh0LGUpe3ZhciBuPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2Zvcih2YXIgcj0wO3I8ZS5sZW5ndGg7cisrKXt2YXIgaT1lW3JdLG89dC5pbmRleEZyb21Qb3MoaS5mcm9tKTtpZihpLnJlbW92ZWQubGVuZ3RoPjApe2Zvcih2YXIgYT0wLHM9MDtzPGkucmVtb3ZlZC5sZW5ndGg7cysrKWErPWkucmVtb3ZlZFtzXS5sZW5ndGg7YSs9aS5yZW1vdmVkLmxlbmd0aC0xLG4udHlwZS5kZWxldGUobyxhKX1uLnR5cGUuaW5zZXJ0KG8saS50ZXh0LmpvaW4oXCJcXG5cIikpfX0pfXZhciBPdD1cImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJlwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wuaXRlcmF0b3I/ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0fTpmdW5jdGlvbih0KXtyZXR1cm4gdCYmXCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZ0LmNvbnN0cnVjdG9yPT09U3ltYm9sJiZ0IT09U3ltYm9sLnByb3RvdHlwZT9cInN5bWJvbFwiOnR5cGVvZiB0fSxFdD1mdW5jdGlvbih0LGUpe2lmKCEodCBpbnN0YW5jZW9mIGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIil9LFV0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCh0LGUpe2Zvcih2YXIgbj0wO248ZS5sZW5ndGg7bisrKXt2YXIgcj1lW25dO3IuZW51bWVyYWJsZT1yLmVudW1lcmFibGV8fCExLHIuY29uZmlndXJhYmxlPSEwLFwidmFsdWVcImluIHImJihyLndyaXRhYmxlPSEwKSxPYmplY3QuZGVmaW5lUHJvcGVydHkodCxyLmtleSxyKX19cmV0dXJuIGZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gbiYmdChlLnByb3RvdHlwZSxuKSxyJiZ0KGUsciksZX19KCksQnQ9ZnVuY3Rpb24gdChlLG4scil7bnVsbD09PWUmJihlPUZ1bmN0aW9uLnByb3RvdHlwZSk7dmFyIGk9T2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihlLG4pO2lmKHZvaWQgMD09PWkpe3ZhciBvPU9iamVjdC5nZXRQcm90b3R5cGVPZihlKTtyZXR1cm4gbnVsbD09PW8/dm9pZCAwOnQobyxuLHIpfWlmKFwidmFsdWVcImluIGkpcmV0dXJuIGkudmFsdWU7dmFyIGE9aS5nZXQ7aWYodm9pZCAwIT09YSlyZXR1cm4gYS5jYWxsKHIpfSxUdD1mdW5jdGlvbih0LGUpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUmJm51bGwhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiBlKTt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGUmJmUucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6dCxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSxlJiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZih0LGUpOnQuX19wcm90b19fPWUpfSxBdD1mdW5jdGlvbih0LGUpe2lmKCF0KXRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTtyZXR1cm4hZXx8XCJvYmplY3RcIiE9dHlwZW9mIGUmJlwiZnVuY3Rpb25cIiE9dHlwZW9mIGU/dDplfSx4dD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQodCxlKXt2YXIgbj1bXSxyPSEwLGk9ITEsbz12b2lkIDA7dHJ5e2Zvcih2YXIgYSxzPXRbU3ltYm9sLml0ZXJhdG9yXSgpOyEocj0oYT1zLm5leHQoKSkuZG9uZSkmJihuLnB1c2goYS52YWx1ZSksIWV8fG4ubGVuZ3RoIT09ZSk7cj0hMCk7fWNhdGNoKHQpe2k9ITAsbz10fWZpbmFsbHl7dHJ5eyFyJiZzLnJldHVybiYmcy5yZXR1cm4oKX1maW5hbGx5e2lmKGkpdGhyb3cgb319cmV0dXJuIG59cmV0dXJuIGZ1bmN0aW9uKGUsbil7aWYoQXJyYXkuaXNBcnJheShlKSlyZXR1cm4gZTtpZihTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGUpKXJldHVybiB0KGUsbik7dGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2VcIil9fSgpLEl0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0KXtFdCh0aGlzLGUpLHRoaXMudmFsPXQsdGhpcy5jb2xvcj0hMCx0aGlzLl9sZWZ0PW51bGwsdGhpcy5fcmlnaHQ9bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbH1yZXR1cm4gVXQoZSxbe2tleTpcImlzUmVkXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb2xvcn19LHtrZXk6XCJpc0JsYWNrXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5jb2xvcn19LHtrZXk6XCJyZWRkZW5cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbG9yPSEwLHRoaXN9fSx7a2V5OlwiYmxhY2tlblwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3I9ITEsdGhpc319LHtrZXk6XCJyb3RhdGVMZWZ0XCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5wYXJlbnQscj10aGlzLnJpZ2h0LGk9dGhpcy5yaWdodC5sZWZ0O3IubGVmdD10aGlzLHRoaXMucmlnaHQ9aSx0KGUsbixyLHRoaXMpfX0se2tleTpcIm5leHRcIix2YWx1ZTpmdW5jdGlvbigpe2lmKG51bGwhPT10aGlzLnJpZ2h0KXtmb3IodmFyIHQ9dGhpcy5yaWdodDtudWxsIT09dC5sZWZ0Oyl0PXQubGVmdDtyZXR1cm4gdH1mb3IodmFyIGU9dGhpcztudWxsIT09ZS5wYXJlbnQmJmUhPT1lLnBhcmVudC5sZWZ0OyllPWUucGFyZW50O3JldHVybiBlLnBhcmVudH19LHtrZXk6XCJwcmV2XCIsdmFsdWU6ZnVuY3Rpb24oKXtpZihudWxsIT09dGhpcy5sZWZ0KXtmb3IodmFyIHQ9dGhpcy5sZWZ0O251bGwhPT10LnJpZ2h0Oyl0PXQucmlnaHQ7cmV0dXJuIHR9Zm9yKHZhciBlPXRoaXM7bnVsbCE9PWUucGFyZW50JiZlIT09ZS5wYXJlbnQucmlnaHQ7KWU9ZS5wYXJlbnQ7cmV0dXJuIGUucGFyZW50fX0se2tleTpcInJvdGF0ZVJpZ2h0XCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5wYXJlbnQscj10aGlzLmxlZnQsaT10aGlzLmxlZnQucmlnaHQ7ci5yaWdodD10aGlzLHRoaXMubGVmdD1pLHQoZSxuLHIsdGhpcyl9fSx7a2V5OlwiZ2V0VW5jbGVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudD09PXRoaXMucGFyZW50LnBhcmVudC5sZWZ0P3RoaXMucGFyZW50LnBhcmVudC5yaWdodDp0aGlzLnBhcmVudC5wYXJlbnQubGVmdH19LHtrZXk6XCJncmFuZHBhcmVudFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudC5wYXJlbnR9fSx7a2V5OlwicGFyZW50XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX3BhcmVudH19LHtrZXk6XCJzaWJsaW5nXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXM9PT10aGlzLnBhcmVudC5sZWZ0P3RoaXMucGFyZW50LnJpZ2h0OnRoaXMucGFyZW50LmxlZnR9fSx7a2V5OlwibGVmdFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9sZWZ0fSxzZXQ6ZnVuY3Rpb24odCl7bnVsbCE9PXQmJih0Ll9wYXJlbnQ9dGhpcyksdGhpcy5fbGVmdD10fX0se2tleTpcInJpZ2h0XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX3JpZ2h0fSxzZXQ6ZnVuY3Rpb24odCl7bnVsbCE9PXQmJih0Ll9wYXJlbnQ9dGhpcyksdGhpcy5fcmlnaHQ9dH19XSksZX0oKSxEdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtFdCh0aGlzLHQpLHRoaXMucm9vdD1udWxsLHRoaXMubGVuZ3RoPTB9cmV0dXJuIFV0KHQsW3trZXk6XCJmaW5kTmV4dFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQuY2xvbmUoKTtyZXR1cm4gZS5jbG9jays9MSx0aGlzLmZpbmRXaXRoTG93ZXJCb3VuZChlKX19LHtrZXk6XCJmaW5kUHJldlwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQuY2xvbmUoKTtyZXR1cm4gZS5jbG9jay09MSx0aGlzLmZpbmRXaXRoVXBwZXJCb3VuZChlKX19LHtrZXk6XCJmaW5kTm9kZVdpdGhMb3dlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5yb290O2lmKG51bGw9PT1lKXJldHVybiBudWxsO2Zvcig7OylpZihudWxsPT09dHx8dC5sZXNzVGhhbihlLnZhbC5faWQpJiZudWxsIT09ZS5sZWZ0KWU9ZS5sZWZ0O2Vsc2V7aWYobnVsbD09PXR8fCFlLnZhbC5faWQubGVzc1RoYW4odCkpcmV0dXJuIGU7aWYobnVsbD09PWUucmlnaHQpcmV0dXJuIGUubmV4dCgpO2U9ZS5yaWdodH19fSx7a2V5OlwiZmluZE5vZGVXaXRoVXBwZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHZvaWQgMD09PXQpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3QgZGVmaW5lIGZyb20hXCIpO3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspaWYobnVsbCE9PXQmJiFlLnZhbC5faWQubGVzc1RoYW4odCl8fG51bGw9PT1lLnJpZ2h0KXtpZihudWxsPT09dHx8IXQubGVzc1RoYW4oZS52YWwuX2lkKSlyZXR1cm4gZTtpZihudWxsPT09ZS5sZWZ0KXJldHVybiBlLnByZXYoKTtlPWUubGVmdH1lbHNlIGU9ZS5yaWdodH19LHtrZXk6XCJmaW5kU21hbGxlc3ROb2RlXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9dGhpcy5yb290O251bGwhPXQmJm51bGwhPXQubGVmdDspdD10LmxlZnQ7cmV0dXJuIHR9fSx7a2V5OlwiZmluZFdpdGhMb3dlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKHQpO3JldHVybiBudWxsPT1lP251bGw6ZS52YWx9fSx7a2V5OlwiZmluZFdpdGhVcHBlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZVdpdGhVcHBlckJvdW5kKHQpO3JldHVybiBudWxsPT1lP251bGw6ZS52YWx9fSx7a2V5OlwiaXRlcmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgcjtmb3Iocj1udWxsPT09dD90aGlzLmZpbmRTbWFsbGVzdE5vZGUoKTp0aGlzLmZpbmROb2RlV2l0aExvd2VyQm91bmQodCk7bnVsbCE9PXImJihudWxsPT09ZXx8ci52YWwuX2lkLmxlc3NUaGFuKGUpfHxyLnZhbC5faWQuZXF1YWxzKGUpKTspbihyLnZhbCkscj1yLm5leHQoKX19LHtrZXk6XCJmaW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZSh0KTtyZXR1cm4gbnVsbCE9PWU/ZS52YWw6bnVsbH19LHtrZXk6XCJmaW5kTm9kZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspe2lmKG51bGw9PT1lKXJldHVybiBudWxsO2lmKHQubGVzc1RoYW4oZS52YWwuX2lkKSllPWUubGVmdDtlbHNle2lmKCFlLnZhbC5faWQubGVzc1RoYW4odCkpcmV0dXJuIGU7ZT1lLnJpZ2h0fX19fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZSh0KTtpZihudWxsIT1lKXtpZih0aGlzLmxlbmd0aC0tLG51bGwhPT1lLmxlZnQmJm51bGwhPT1lLnJpZ2h0KXtmb3IodmFyIG49ZS5sZWZ0O251bGwhPT1uLnJpZ2h0OyluPW4ucmlnaHQ7ZS52YWw9bi52YWwsZT1ufXZhciByLGk9ZS5sZWZ0fHxlLnJpZ2h0O2lmKG51bGw9PT1pPyhyPSEwLGk9bmV3IEl0KG51bGwpLGkuYmxhY2tlbigpLGUucmlnaHQ9aSk6cj0hMSxudWxsPT09ZS5wYXJlbnQpcmV0dXJuIHZvaWQocj90aGlzLnJvb3Q9bnVsbDoodGhpcy5yb290PWksaS5ibGFja2VuKCksaS5fcGFyZW50PW51bGwpKTtpZihlLnBhcmVudC5sZWZ0PT09ZSllLnBhcmVudC5sZWZ0PWk7ZWxzZXtpZihlLnBhcmVudC5yaWdodCE9PWUpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSFcIik7ZS5wYXJlbnQucmlnaHQ9aX1pZihlLmlzQmxhY2soKSYmKGkuaXNSZWQoKT9pLmJsYWNrZW4oKTp0aGlzLl9maXhEZWxldGUoaSkpLHRoaXMucm9vdC5ibGFja2VuKCkscilpZihpLnBhcmVudC5sZWZ0PT09aSlpLnBhcmVudC5sZWZ0PW51bGw7ZWxzZXtpZihpLnBhcmVudC5yaWdodCE9PWkpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSAjM1wiKTtpLnBhcmVudC5yaWdodD1udWxsfX19fSx7a2V5OlwiX2ZpeERlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCl7cmV0dXJuIG51bGw9PT10fHx0LmlzQmxhY2soKX1mdW5jdGlvbiBuKHQpe3JldHVybiBudWxsIT09dCYmdC5pc1JlZCgpfWlmKG51bGwhPT10LnBhcmVudCl7dmFyIHI9dC5zaWJsaW5nO2lmKG4ocikpe2lmKHQucGFyZW50LnJlZGRlbigpLHIuYmxhY2tlbigpLHQ9PT10LnBhcmVudC5sZWZ0KXQucGFyZW50LnJvdGF0ZUxlZnQodGhpcyk7ZWxzZXtpZih0IT09dC5wYXJlbnQucmlnaHQpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSAjMlwiKTt0LnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKX1yPXQuc2libGluZ310LnBhcmVudC5pc0JsYWNrKCkmJnIuaXNCbGFjaygpJiZlKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksdGhpcy5fZml4RGVsZXRlKHQucGFyZW50KSk6dC5wYXJlbnQuaXNSZWQoKSYmci5pc0JsYWNrKCkmJmUoci5sZWZ0KSYmZShyLnJpZ2h0KT8oci5yZWRkZW4oKSx0LnBhcmVudC5ibGFja2VuKCkpOih0PT09dC5wYXJlbnQubGVmdCYmci5pc0JsYWNrKCkmJm4oci5sZWZ0KSYmZShyLnJpZ2h0KT8oci5yZWRkZW4oKSxyLmxlZnQuYmxhY2tlbigpLHIucm90YXRlUmlnaHQodGhpcykscj10LnNpYmxpbmcpOnQ9PT10LnBhcmVudC5yaWdodCYmci5pc0JsYWNrKCkmJm4oci5yaWdodCkmJmUoci5sZWZ0KSYmKHIucmVkZGVuKCksci5yaWdodC5ibGFja2VuKCksci5yb3RhdGVMZWZ0KHRoaXMpLHI9dC5zaWJsaW5nKSxyLmNvbG9yPXQucGFyZW50LmNvbG9yLHQucGFyZW50LmJsYWNrZW4oKSx0PT09dC5wYXJlbnQubGVmdD8oci5yaWdodC5ibGFja2VuKCksdC5wYXJlbnQucm90YXRlTGVmdCh0aGlzKSk6KHIubGVmdC5ibGFja2VuKCksdC5wYXJlbnQucm90YXRlUmlnaHQodGhpcykpKX19fSx7a2V5OlwicHV0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9bmV3IEl0KHQpO2lmKG51bGwhPT10aGlzLnJvb3Qpe2Zvcih2YXIgbj10aGlzLnJvb3Q7OylpZihlLnZhbC5faWQubGVzc1RoYW4obi52YWwuX2lkKSl7aWYobnVsbD09PW4ubGVmdCl7bi5sZWZ0PWU7YnJlYWt9bj1uLmxlZnR9ZWxzZXtpZighbi52YWwuX2lkLmxlc3NUaGFuKGUudmFsLl9pZCkpcmV0dXJuIG4udmFsPWUudmFsLG47aWYobnVsbD09PW4ucmlnaHQpe24ucmlnaHQ9ZTticmVha31uPW4ucmlnaHR9dGhpcy5fZml4SW5zZXJ0KGUpfWVsc2UgdGhpcy5yb290PWU7cmV0dXJuIHRoaXMubGVuZ3RoKyssdGhpcy5yb290LmJsYWNrZW4oKSxlfX0se2tleTpcIl9maXhJbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsPT09dC5wYXJlbnQpcmV0dXJuIHZvaWQgdC5ibGFja2VuKCk7aWYoIXQucGFyZW50LmlzQmxhY2soKSl7dmFyIGU9dC5nZXRVbmNsZSgpO251bGwhPT1lJiZlLmlzUmVkKCk/KHQucGFyZW50LmJsYWNrZW4oKSxlLmJsYWNrZW4oKSx0LmdyYW5kcGFyZW50LnJlZGRlbigpLHRoaXMuX2ZpeEluc2VydCh0LmdyYW5kcGFyZW50KSk6KHQ9PT10LnBhcmVudC5yaWdodCYmdC5wYXJlbnQ9PT10LmdyYW5kcGFyZW50LmxlZnQ/KHQucGFyZW50LnJvdGF0ZUxlZnQodGhpcyksdD10LmxlZnQpOnQ9PT10LnBhcmVudC5sZWZ0JiZ0LnBhcmVudD09PXQuZ3JhbmRwYXJlbnQucmlnaHQmJih0LnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKSx0PXQucmlnaHQpLHQucGFyZW50LmJsYWNrZW4oKSx0LmdyYW5kcGFyZW50LnJlZGRlbigpLHQ9PT10LnBhcmVudC5sZWZ0P3QuZ3JhbmRwYXJlbnQucm90YXRlUmlnaHQodGhpcyk6dC5ncmFuZHBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpKX19fV0pLHR9KCksUHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7RXQodGhpcyx0KSx0aGlzLnVzZXI9ZSx0aGlzLmNsb2NrPW59cmV0dXJuIFV0KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0KHRoaXMudXNlcix0aGlzLmNsb2NrKX19LHtrZXk6XCJlcXVhbHNcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQudXNlcj09PXRoaXMudXNlciYmdC5jbG9jaz09PXRoaXMuY2xvY2t9fSx7a2V5OlwibGVzc1RoYW5cIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PXQmJih0aGlzLnVzZXI8ZS51c2VyfHx0aGlzLnVzZXI9PT1lLnVzZXImJnRoaXMuY2xvY2s8ZS5jbG9jayl9fV0pLHR9KCksanQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbixyKXtFdCh0aGlzLHQpLHRoaXMuX2lkPWUsdGhpcy5sZW49bix0aGlzLmdjPXJ9cmV0dXJuIFV0KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0KHRoaXMuX2lkLHRoaXMubGVuLHRoaXMuZ2MpfX1dKSx0fSgpLE50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtyZXR1cm4gRXQodGhpcyxlKSxBdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJsb2dUYWJsZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9W107dGhpcy5pdGVyYXRlKG51bGwsbnVsbCxmdW5jdGlvbihlKXt0LnB1c2goe3VzZXI6ZS5faWQudXNlcixjbG9jazplLl9pZC5jbG9jayxsZW46ZS5sZW4sZ2M6ZS5nY30pfSksY29uc29sZS50YWJsZSh0KX19LHtrZXk6XCJpc0RlbGV0ZWRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmRXaXRoVXBwZXJCb3VuZCh0KTtyZXR1cm4gbnVsbCE9PWUmJmUuX2lkLnVzZXI9PT10LnVzZXImJnQuY2xvY2s8ZS5faWQuY2xvY2srZS5sZW59fSx7a2V5OlwibWFya1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtpZigwIT09ZSl7dmFyIHI9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQobmV3IFB0KHQudXNlcix0LmNsb2NrLTEpKTtudWxsIT09ciYmci5faWQudXNlcj09PXQudXNlciYmci5faWQuY2xvY2s8dC5jbG9jayYmdC5jbG9jazxyLl9pZC5jbG9jaytyLmxlbiYmKHQuY2xvY2srZTxyLl9pZC5jbG9jaytyLmxlbiYmdGhpcy5wdXQobmV3IGp0KG5ldyBQdCh0LnVzZXIsdC5jbG9jaytlKSxyLl9pZC5jbG9jaytyLmxlbi10LmNsb2NrLWUsci5nYykpLHIubGVuPXQuY2xvY2stci5faWQuY2xvY2spO3ZhciBpPW5ldyBQdCh0LnVzZXIsdC5jbG9jaytlLTEpLG89dGhpcy5maW5kV2l0aFVwcGVyQm91bmQoaSk7aWYobnVsbCE9PW8mJm8uX2lkLnVzZXI9PT10LnVzZXImJm8uX2lkLmNsb2NrPHQuY2xvY2srZSYmdC5jbG9jazw9by5faWQuY2xvY2smJnQuY2xvY2srZTxvLl9pZC5jbG9jaytvLmxlbil7dmFyIGE9dC5jbG9jaytlLW8uX2lkLmNsb2NrO28uX2lkPW5ldyBQdChvLl9pZC51c2VyLG8uX2lkLmNsb2NrK2EpLG8ubGVuLT1hfXZhciBzPVtdO3RoaXMuaXRlcmF0ZSh0LGksZnVuY3Rpb24odCl7cy5wdXNoKHQuX2lkKX0pO2Zvcih2YXIgbD1zLmxlbmd0aC0xO2w+PTA7bC0tKXRoaXMuZGVsZXRlKHNbbF0pO3ZhciB1PW5ldyBqdCh0LGUsbik7bnVsbCE9PXImJnIuX2lkLnVzZXI9PT10LnVzZXImJnIuX2lkLmNsb2NrK3IubGVuPT09dC5jbG9jayYmci5nYz09PW4mJihyLmxlbis9ZSx1PXIpO3ZhciBjPXRoaXMuZmluZChuZXcgUHQodC51c2VyLHQuY2xvY2srZSkpO251bGwhPT1jJiZjLl9pZC51c2VyPT09dC51c2VyJiZ0LmNsb2NrK2U9PT1jLl9pZC5jbG9jayYmbj09PWMuZ2MmJih1Lmxlbis9Yy5sZW4sdGhpcy5kZWxldGUoYy5faWQpKSxyIT09dSYmdGhpcy5wdXQodSl9fX0se2tleTpcIm1hcmtEZWxldGVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLm1hcmsodCxlLCExKX19XSksZX0oRHQpLFZ0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtpZihFdCh0aGlzLHQpLGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcil0aGlzLnVpbnQ4YXJyPW5ldyBVaW50OEFycmF5KGUpO2Vsc2V7aWYoIShlIGluc3RhbmNlb2YgVWludDhBcnJheXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIEJ1ZmZlciYmZSBpbnN0YW5jZW9mIEJ1ZmZlcikpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSFcIik7dGhpcy51aW50OGFycj1lfXRoaXMucG9zPTB9cmV0dXJuIFV0KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOnRoaXMucG9zLG49bmV3IHQodGhpcy51aW50OGFycik7cmV0dXJuIG4ucG9zPWUsbn19LHtrZXk6XCJza2lwOFwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5wb3MrK319LHtrZXk6XCJyZWFkVWludDhcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdfX0se2tleTpcInJlYWRVaW50MzJcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMudWludDhhcnJbdGhpcy5wb3NdKyh0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKzFdPDw4KSsodGhpcy51aW50OGFyclt0aGlzLnBvcysyXTw8MTYpKyh0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKzNdPDwyNCk7cmV0dXJuIHRoaXMucG9zKz00LHR9fSx7a2V5OlwicGVla1VpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyclt0aGlzLnBvc119fSx7a2V5OlwicmVhZFZhclVpbnRcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD0wLGU9MDs7KXt2YXIgbj10aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdO2lmKHR8PSgxMjcmbik8PGUsZSs9NyxuPDEyOClyZXR1cm4gdD4+PjA7aWYoZT4zNSl0aHJvdyBuZXcgRXJyb3IoXCJJbnRlZ2VyIG91dCBvZiByYW5nZSFcIil9fX0se2tleTpcInJlYWRWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD10aGlzLnJlYWRWYXJVaW50KCksZT1uZXcgQXJyYXkodCksbj0wO248dDtuKyspZVtuXT10aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdO3ZhciByPWUubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBTdHJpbmcuZnJvbUNvZGVQb2ludCh0KX0pLmpvaW4oXCJcIik7cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUocikpfX0se2tleTpcInBlZWtWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMucG9zLGU9dGhpcy5yZWFkVmFyU3RyaW5nKCk7cmV0dXJuIHRoaXMucG9zPXQsZX19LHtrZXk6XCJyZWFkSURcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMucmVhZFZhclVpbnQoKTtpZih0PT09cXQpe3ZhciBlPW5ldyAkdCh0aGlzLnJlYWRWYXJTdHJpbmcoKSxudWxsKTtyZXR1cm4gZS50eXBlPXRoaXMucmVhZFZhclVpbnQoKSxlfXJldHVybiBuZXcgUHQodCx0aGlzLnJlYWRWYXJVaW50KCkpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVpbnQ4YXJyLmxlbmd0aH19XSksdH0oKSxMdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtFdCh0aGlzLHQpLHRoaXMuX2lkPW51bGwsdGhpcy5fbGVuZ3RoPTB9cmV0dXJuIFV0KHQsW3trZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5faWQscj1lLnNzLmdldFN0YXRlKG4udXNlcik7bi5jbG9jaz09PXImJmUuc3Muc2V0U3RhdGUobi51c2VyLG4uY2xvY2srdGhpcy5fbGVuZ3RoKSxlLmRzLm1hcmsodGhpcy5faWQsdGhpcy5fbGVuZ3RoLCEwKTt2YXIgaT1lLm9zLnB1dCh0aGlzKSxvPWkucHJldigpLnZhbDtudWxsIT09byYmby5jb25zdHJ1Y3Rvcj09PXQmJm8uX2lkLnVzZXI9PT1pLnZhbC5faWQudXNlciYmby5faWQuY2xvY2srby5fbGVuZ3RoPT09aS52YWwuX2lkLmNsb2NrJiYoby5fbGVuZ3RoKz1pLnZhbC5fbGVuZ3RoLGUub3MuZGVsZXRlKGkudmFsLl9pZCksaT1vKSxpLnZhbCYmKGk9aS52YWwpO3ZhciBhPWUub3MuZmluZE5leHQoaS5faWQpO251bGwhPT1hJiZhLmNvbnN0cnVjdG9yPT09dCYmYS5faWQudXNlcj09PWkuX2lkLnVzZXImJmEuX2lkLmNsb2NrPT09aS5faWQuY2xvY2sraS5fbGVuZ3RoJiYoaS5fbGVuZ3RoKz1hLl9sZW5ndGgsZS5vcy5kZWxldGUoYS5faWQpKSxuLnVzZXIhPT1xdCYmKG51bGw9PT1lLmNvbm5lY3Rvcnx8IWUuY29ubmVjdG9yLl9mb3J3YXJkQXBwbGllZFN0cnVjdHMmJm4udXNlciE9PWUudXNlcklEfHxlLmNvbm5lY3Rvci5icm9hZGNhc3RTdHJ1Y3QodGhpcyksbnVsbCE9PWUucGVyc2lzdGVuY2UmJmUucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdChlLHRoaXMpKX19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXt0LndyaXRlVWludDgoJCh0aGlzLmNvbnN0cnVjdG9yKSksdC53cml0ZUlEKHRoaXMuX2lkKSx0LndyaXRlVmFyVWludCh0aGlzLl9sZW5ndGgpfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1lLnJlYWRJRCgpO3RoaXMuX2lkPW4sdGhpcy5fbGVuZ3RoPWUucmVhZFZhclVpbnQoKTt2YXIgcj1bXTtyZXR1cm4gdC5zcy5nZXRTdGF0ZShuLnVzZXIpPG4uY2xvY2smJnIucHVzaChuZXcgUHQobi51c2VyLG4uY2xvY2stMSkpLHJ9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzfX0se2tleTpcIl9jbG9uZVBhcnRpYWxcIix2YWx1ZTpmdW5jdGlvbihlKXt2YXIgbj1uZXcgdDtyZXR1cm4gbi5faWQ9bmV3IFB0KHRoaXMuX2lkLnVzZXIsdGhpcy5faWQuY2xvY2srZSksbi5fbGVuZ3RoPXRoaXMuX2xlbmd0aC1lLG59fSx7a2V5OlwiX2RlbGV0ZWRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4hMH19XSksdH0oKSxNdD1mdW5jdGlvbiB0KGUsbixyKXtFdCh0aGlzLHQpLHRoaXMuZGVjb2Rlcj1lLHRoaXMubWlzc2luZz1uLmxlbmd0aCx0aGlzLnN0cnVjdD1yfSxDdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtFdCh0aGlzLHQpLHRoaXMuZGF0YT1bXX1yZXR1cm4gVXQodCxbe2tleTpcImNyZWF0ZUJ1ZmZlclwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIFVpbnQ4QXJyYXkuZnJvbSh0aGlzLmRhdGEpLmJ1ZmZlcn19LHtrZXk6XCJ3cml0ZVVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5kYXRhLnB1c2goMjU1JnQpfX0se2tleTpcInNldFVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLmRhdGFbdF09MjU1JmV9fSx7a2V5Olwid3JpdGVVaW50MTZcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmRhdGEucHVzaCgyNTUmdCx0Pj4+OCYyNTUpfX0se2tleTpcInNldFVpbnQxNlwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5kYXRhW3RdPTI1NSZlLHRoaXMuZGF0YVt0KzFdPWU+Pj44JjI1NX19LHtrZXk6XCJ3cml0ZVVpbnQzMlwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wO2U8NDtlKyspdGhpcy5kYXRhLnB1c2goMjU1JnQpLHQ+Pj49OH19LHtrZXk6XCJzZXRVaW50MzJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2Zvcih2YXIgbj0wO248NDtuKyspdGhpcy5kYXRhW3Qrbl09MjU1JmUsZT4+Pj04fX0se2tleTpcIndyaXRlVmFyVWludFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcig7dD49MTI4Oyl0aGlzLmRhdGEucHVzaCgxMjh8MTI3JnQpLHQ+Pj49Nzt0aGlzLmRhdGEucHVzaCgxMjcmdCl9fSx7a2V5Olwid3JpdGVWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbih0KXtcbnZhciBlPXVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0KSksbj1lLnNwbGl0KFwiXCIpLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdC5jb2RlUG9pbnRBdCgpfSkscj1uLmxlbmd0aDt0aGlzLndyaXRlVmFyVWludChyKTtmb3IodmFyIGk9MDtpPHI7aSsrKXRoaXMuZGF0YS5wdXNoKG5baV0pfX0se2tleTpcIndyaXRlSURcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10LnVzZXI7dGhpcy53cml0ZVZhclVpbnQoZSksZSE9PXF0P3RoaXMud3JpdGVWYXJVaW50KHQuY2xvY2spOih0aGlzLndyaXRlVmFyU3RyaW5nKHQubmFtZSksdGhpcy53cml0ZVZhclVpbnQodC50eXBlKSl9fSx7a2V5OlwibGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGF0YS5sZW5ndGh9fSx7a2V5OlwicG9zXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZGF0YS5sZW5ndGh9fV0pLHR9KCksRGVsZXRlPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gRGVsZXRlKCl7RXQodGhpcyxEZWxldGUpLHRoaXMuX3RhcmdldD1udWxsLHRoaXMuX2xlbmd0aD1udWxsfXJldHVybiBVdChEZWxldGUsW3trZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49ZS5yZWFkSUQoKTtyZXR1cm4gdGhpcy5fdGFyZ2V0SUQ9bix0aGlzLl9sZW5ndGg9ZS5yZWFkVmFyVWludCgpLG51bGw9PT10Lm9zLmdldEl0ZW0obik/W25dOltdfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKSx0LndyaXRlSUQodGhpcy5fdGFyZ2V0SUQpLHQud3JpdGVWYXJVaW50KHRoaXMuX2xlbmd0aCl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdJiZhcmd1bWVudHNbMV0pbnVsbCE9PXQuY29ubmVjdG9yJiZ0LmNvbm5lY3Rvci5icm9hZGNhc3RTdHJ1Y3QodGhpcyk7ZWxzZXt2YXIgZT10aGlzLl90YXJnZXRJRDtnKHQsZS51c2VyLGUuY2xvY2ssdGhpcy5fbGVuZ3RoLCExKX1udWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsdGhpcyl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuXCJEZWxldGUgLSB0YXJnZXQ6IFwiK3AodGhpcy5fdGFyZ2V0SUQpK1wiLCBsZW46IFwiK3RoaXMuX2xlbmd0aH19XSksRGVsZXRlfSgpLFJ0PWZ1bmN0aW9uIHQoZSl7RXQodGhpcyx0KSx0aGlzLnk9ZSx0aGlzLm5ld1R5cGVzPW5ldyBTZXQsdGhpcy5jaGFuZ2VkVHlwZXM9bmV3IE1hcCx0aGlzLmRlbGV0ZWRTdHJ1Y3RzPW5ldyBTZXQsdGhpcy5iZWZvcmVTdGF0ZT1uZXcgTWFwLHRoaXMuY2hhbmdlZFBhcmVudFR5cGVzPW5ldyBNYXB9LEl0ZW09ZnVuY3Rpb24oKXtmdW5jdGlvbiBJdGVtKCl7RXQodGhpcyxJdGVtKSx0aGlzLl9pZD1udWxsLHRoaXMuX29yaWdpbj1udWxsLHRoaXMuX2xlZnQ9bnVsbCx0aGlzLl9yaWdodD1udWxsLHRoaXMuX3JpZ2h0X29yaWdpbj1udWxsLHRoaXMuX3BhcmVudD1udWxsLHRoaXMuX3BhcmVudFN1Yj1udWxsLHRoaXMuX2RlbGV0ZWQ9ITEsdGhpcy5fcmVkb25lPW51bGx9cmV0dXJuIFV0KEl0ZW0sW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yfX0se2tleTpcIl9yZWRvXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZihudWxsIT09dGhpcy5fcmVkb25lKXJldHVybiB0aGlzLl9yZWRvbmU7dmFyIG49dGhpcy5fY29weSgpLHI9dGhpcy5fbGVmdCxpPXRoaXMsbz10aGlzLl9wYXJlbnQ7aWYoISghMCE9PW8uX2RlbGV0ZWR8fG51bGwhPT1vLl9yZWRvbmV8fGUuaGFzKG8pJiZvLl9yZWRvKHQsZSkpKXJldHVybiExO2lmKG51bGwhPT1vLl9yZWRvbmUpe2ZvcihvPW8uX3JlZG9uZTtudWxsIT09cjspe2lmKG51bGwhPT1yLl9yZWRvbmUmJnIuX3JlZG9uZS5fcGFyZW50PT09byl7cj1yLl9yZWRvbmU7YnJlYWt9cj1yLl9sZWZ0fWZvcig7bnVsbCE9PWk7KW51bGwhPT1pLl9yZWRvbmUmJmkuX3JlZG9uZS5fcGFyZW50PT09byYmKGk9aS5fcmVkb25lKSxpPWkuX3JpZ2h0fXJldHVybiBuLl9vcmlnaW49cixuLl9sZWZ0PXIsbi5fcmlnaHQ9aSxuLl9yaWdodF9vcmlnaW49aSxuLl9wYXJlbnQ9byxuLl9wYXJlbnRTdWI9dGhpcy5fcGFyZW50U3ViLG4uX2ludGVncmF0ZSh0KSx0aGlzLl9yZWRvbmU9biwhMH19LHtrZXk6XCJfc3BsaXRBdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7cmV0dXJuIDA9PT1lP3RoaXM6dGhpcy5fcmlnaHR9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPSEoYXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0pfHxhcmd1bWVudHNbMV07aWYoIXRoaXMuX2RlbGV0ZWQpe3RoaXMuX2RlbGV0ZWQ9ITAsdC5kcy5tYXJrKHRoaXMuX2lkLHRoaXMuX2xlbmd0aCwhMSk7dmFyIG49bmV3IERlbGV0ZTtuLl90YXJnZXRJRD10aGlzLl9pZCxuLl9sZW5ndGg9dGhpcy5fbGVuZ3RoLGU/bi5faW50ZWdyYXRlKHQsITApOm51bGwhPT10LnBlcnNpc3RlbmNlJiZ0LnBlcnNpc3RlbmNlLnNhdmVTdHJ1Y3QodCxuKSxtKHQsdGhpcy5fcGFyZW50LHRoaXMuX3BhcmVudFN1YiksdC5fdHJhbnNhY3Rpb24uZGVsZXRlZFN0cnVjdHMuYWRkKHRoaXMpfX19LHtrZXk6XCJfZ2NDaGlsZHJlblwiLHZhbHVlOmZ1bmN0aW9uKHQpe319LHtrZXk6XCJfZ2NcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT1uZXcgTHQ7ZS5faWQ9dGhpcy5faWQsZS5fbGVuZ3RoPXRoaXMuX2xlbmd0aCx0Lm9zLmRlbGV0ZSh0aGlzLl9pZCksZS5faW50ZWdyYXRlKHQpfX0se2tleTpcIl9iZWZvcmVDaGFuZ2VcIix2YWx1ZTpmdW5jdGlvbigpe319LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuYWRkKHRoaXMpO3ZhciBlPXRoaXMuX3BhcmVudCxuPXRoaXMuX2lkLHI9bnVsbD09PW4/dC51c2VySUQ6bi51c2VyLGk9dC5zcy5nZXRTdGF0ZShyKTtpZihudWxsPT09bil0aGlzLl9pZD10LnNzLmdldE5leHRJRCh0aGlzLl9sZW5ndGgpO2Vsc2UgaWYobi51c2VyPT09cXQpO2Vsc2V7aWYobi5jbG9jazxpKXJldHVybltdO2lmKG4uY2xvY2shPT1pKXRocm93IG5ldyBFcnJvcihcIkNhbiBub3QgYXBwbHkgeWV0IVwiKTt0LnNzLnNldFN0YXRlKG4udXNlcixpK3RoaXMuX2xlbmd0aCl9ZS5fZGVsZXRlZHx8dC5fdHJhbnNhY3Rpb24uY2hhbmdlZFR5cGVzLmhhcyhlKXx8dC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuaGFzKGUpfHx0aGlzLl9wYXJlbnQuX2JlZm9yZUNoYW5nZSgpO3ZhciBvPXZvaWQgMDtvPW51bGwhPT10aGlzLl9sZWZ0P3RoaXMuX2xlZnQuX3JpZ2h0Om51bGwhPT10aGlzLl9wYXJlbnRTdWI/dGhpcy5fcGFyZW50Ll9tYXAuZ2V0KHRoaXMuX3BhcmVudFN1Yil8fG51bGw6dGhpcy5fcGFyZW50Ll9zdGFydDtmb3IodmFyIGE9bmV3IFNldCxzPW5ldyBTZXQ7bnVsbCE9PW8mJm8hPT10aGlzLl9yaWdodDspe2lmKHMuYWRkKG8pLGEuYWRkKG8pLHRoaXMuX29yaWdpbj09PW8uX29yaWdpbilvLl9pZC51c2VyPHRoaXMuX2lkLnVzZXImJih0aGlzLl9sZWZ0PW8sYS5jbGVhcigpKTtlbHNle2lmKCFzLmhhcyhvLl9vcmlnaW4pKWJyZWFrO2EuaGFzKG8uX29yaWdpbil8fCh0aGlzLl9sZWZ0PW8sYS5jbGVhcigpKX1vPW8uX3JpZ2h0fXZhciBsPXRoaXMuX3BhcmVudFN1YjtpZihudWxsPT09dGhpcy5fbGVmdCl7dmFyIHU9dm9pZCAwO2lmKG51bGwhPT1sKXt2YXIgYz1lLl9tYXA7dT1jLmdldChsKXx8bnVsbCxjLnNldChsLHRoaXMpfWVsc2UgdT1lLl9zdGFydCxlLl9zdGFydD10aGlzO3RoaXMuX3JpZ2h0PXUsbnVsbCE9PXUmJih1Ll9sZWZ0PXRoaXMpfWVsc2V7dmFyIGg9dGhpcy5fbGVmdCxmPWguX3JpZ2h0O3RoaXMuX3JpZ2h0PWYsaC5fcmlnaHQ9dGhpcyxudWxsIT09ZiYmKGYuX2xlZnQ9dGhpcyl9ZS5fZGVsZXRlZCYmdGhpcy5fZGVsZXRlKHQsITEpLHQub3MucHV0KHRoaXMpLG0odCxlLGwpLHRoaXMuX2lkLnVzZXIhPT1xdCYmKG51bGw9PT10LmNvbm5lY3Rvcnx8IXQuY29ubmVjdG9yLl9mb3J3YXJkQXBwbGllZFN0cnVjdHMmJnRoaXMuX2lkLnVzZXIhPT10LnVzZXJJRHx8dC5jb25uZWN0b3IuYnJvYWRjYXN0U3RydWN0KHRoaXMpLG51bGwhPT10LnBlcnNpc3RlbmNlJiZ0LnBlcnNpc3RlbmNlLnNhdmVTdHJ1Y3QodCx0aGlzKSl9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7dC53cml0ZVVpbnQ4KCQodGhpcy5jb25zdHJ1Y3RvcikpO3ZhciBlPTA7bnVsbCE9PXRoaXMuX29yaWdpbiYmKGUrPTEpLG51bGwhPT10aGlzLl9yaWdodF9vcmlnaW4mJihlKz00KSxudWxsIT09dGhpcy5fcGFyZW50U3ViJiYoZSs9OCksdC53cml0ZVVpbnQ4KGUpLHQud3JpdGVJRCh0aGlzLl9pZCksMSZlJiZ0LndyaXRlSUQodGhpcy5fb3JpZ2luLl9sYXN0SWQpLDQmZSYmdC53cml0ZUlEKHRoaXMuX3JpZ2h0X29yaWdpbi5faWQpLDA9PSg1JmUpJiZ0LndyaXRlSUQodGhpcy5fcGFyZW50Ll9pZCksOCZlJiZ0LndyaXRlVmFyU3RyaW5nKEpTT04uc3RyaW5naWZ5KHRoaXMuX3BhcmVudFN1YikpfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1bXSxyPWUucmVhZFVpbnQ4KCksaT1lLnJlYWRJRCgpO2lmKHRoaXMuX2lkPWksMSZyKXt2YXIgbz1lLnJlYWRJRCgpLGE9dC5vcy5nZXRJdGVtQ2xlYW5FbmQobyk7bnVsbD09PWE/bi5wdXNoKG8pOih0aGlzLl9vcmlnaW49YSx0aGlzLl9sZWZ0PXRoaXMuX29yaWdpbil9aWYoNCZyKXt2YXIgcz1lLnJlYWRJRCgpLGw9dC5vcy5nZXRJdGVtQ2xlYW5TdGFydChzKTtudWxsPT09bD9uLnB1c2gocyk6KHRoaXMuX3JpZ2h0PWwsdGhpcy5fcmlnaHRfb3JpZ2luPWwpfWlmKDA9PSg1JnIpKXt2YXIgdT1lLnJlYWRJRCgpO2lmKG51bGw9PT10aGlzLl9wYXJlbnQpe3ZhciBjPXZvaWQgMDtjPXUuY29uc3RydWN0b3I9PT0kdD90Lm9zLmdldCh1KTp0Lm9zLmdldEl0ZW0odSksbnVsbD09PWM/bi5wdXNoKHUpOnRoaXMuX3BhcmVudD1jfX1lbHNlIG51bGw9PT10aGlzLl9wYXJlbnQmJihudWxsIT09dGhpcy5fb3JpZ2luP3RoaXMuX29yaWdpbi5jb25zdHJ1Y3Rvcj09PUx0P3RoaXMuX3BhcmVudD10aGlzLl9vcmlnaW46dGhpcy5fcGFyZW50PXRoaXMuX29yaWdpbi5fcGFyZW50Om51bGwhPT10aGlzLl9yaWdodF9vcmlnaW4mJih0aGlzLl9yaWdodF9vcmlnaW4uY29uc3RydWN0b3I9PT1MdD90aGlzLl9wYXJlbnQ9dGhpcy5fcmlnaHRfb3JpZ2luOnRoaXMuX3BhcmVudD10aGlzLl9yaWdodF9vcmlnaW4uX3BhcmVudCkpO3JldHVybiA4JnImJih0aGlzLl9wYXJlbnRTdWI9SlNPTi5wYXJzZShlLnJlYWRWYXJTdHJpbmcoKSkpLHQuc3MuZ2V0U3RhdGUoaS51c2VyKTxpLmNsb2NrJiZuLnB1c2gobmV3IFB0KGkudXNlcixpLmNsb2NrLTEpKSxufX0se2tleTpcIl9sYXN0SWRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFB0KHRoaXMuX2lkLnVzZXIsdGhpcy5faWQuY2xvY2srdGhpcy5fbGVuZ3RoLTEpfX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gMX19LHtrZXk6XCJfY291bnRhYmxlXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITB9fV0pLEl0ZW19KCksV3Q9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLmV2ZW50TGlzdGVuZXJzPVtdfXJldHVybiBVdCh0LFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5ldmVudExpc3RlbmVycz1udWxsfX0se2tleTpcImFkZEV2ZW50TGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmV2ZW50TGlzdGVuZXJzLnB1c2godCl9fSx7a2V5OlwicmVtb3ZlRXZlbnRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZXZlbnRMaXN0ZW5lcnM9dGhpcy5ldmVudExpc3RlbmVycy5maWx0ZXIoZnVuY3Rpb24oZSl7cmV0dXJuIHQhPT1lfSl9fSx7a2V5OlwicmVtb3ZlQWxsRXZlbnRMaXN0ZW5lcnNcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZXZlbnRMaXN0ZW5lcnM9W119fSx7a2V5OlwiY2FsbEV2ZW50TGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtmb3IodmFyIG49MDtuPHRoaXMuZXZlbnRMaXN0ZW5lcnMubGVuZ3RoO24rKyl0cnl7KDAsdGhpcy5ldmVudExpc3RlbmVyc1tuXSkoZSl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX19fV0pLHR9KCksVHlwZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBUeXBlKCl7RXQodGhpcyxUeXBlKTt2YXIgdD1BdCh0aGlzLChUeXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUpKS5jYWxsKHRoaXMpKTtyZXR1cm4gdC5fbWFwPW5ldyBNYXAsdC5fc3RhcnQ9bnVsbCx0Ll95PW51bGwsdC5fZXZlbnRIYW5kbGVyPW5ldyBXdCx0Ll9kZWVwRXZlbnRIYW5kbGVyPW5ldyBXdCx0fXJldHVybiBUdChUeXBlLHQpLFV0KFR5cGUsW3trZXk6XCJnZXRQYXRoVG9cIix2YWx1ZTpmdW5jdGlvbih0KXtpZih0PT09dGhpcylyZXR1cm5bXTtmb3IodmFyIGU9W10sbj10aGlzLl95O3QhPT10aGlzJiZ0IT09bjspe3ZhciByPXQuX3BhcmVudDtpZihudWxsIT09dC5fcGFyZW50U3ViKWUudW5zaGlmdCh0Ll9wYXJlbnRTdWIpO2Vsc2V7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9cltTeW1ib2wuaXRlcmF0b3JdKCk7IShpPShzPWwubmV4dCgpKS5kb25lKTtpPSEwKXt2YXIgdT14dChzLnZhbHVlLDIpLGM9dVswXTtpZih1WzFdPT09dCl7ZS51bnNoaWZ0KGMpO2JyZWFrfX19Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX19dD1yfWlmKHQhPT10aGlzKXRocm93IG5ldyBFcnJvcihcIlRoZSB0eXBlIGlzIG5vdCBhIGNoaWxkIG9mIHRoaXMgbm9kZVwiKTtyZXR1cm4gZX19LHtrZXk6XCJfY2FsbEV2ZW50SGFuZGxlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dC5jaGFuZ2VkUGFyZW50VHlwZXM7dGhpcy5fZXZlbnRIYW5kbGVyLmNhbGxFdmVudExpc3RlbmVycyh0LGUpO2Zvcih2YXIgcj10aGlzO3IhPT10aGlzLl95Oyl7dmFyIGk9bi5nZXQocik7dm9pZCAwPT09aSYmKGk9W10sbi5zZXQocixpKSksaS5wdXNoKGUpLHI9ci5fcGFyZW50fX19LHtrZXk6XCJfdHJhbnNhY3RcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl95O251bGwhPT1lP2UudHJhbnNhY3QodCk6dChlKX19LHtrZXk6XCJvYnNlcnZlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIodCl9fSx7a2V5Olwib2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwidW5vYnNlcnZlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwidW5vYnNlcnZlRGVlcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2RlZXBFdmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoVHlwZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoVHlwZS5wcm90b3R5cGUpLFwiX2ludGVncmF0ZVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0aGlzLl95PXQ7dmFyIGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWUmJih0aGlzLl9zdGFydD1udWxsLGIodCxlKSk7dmFyIG49dGhpcy5fbWFwO3RoaXMuX21hcD1uZXcgTWFwO3ZhciByPSEwLGk9ITEsbz12b2lkIDA7dHJ5e2Zvcih2YXIgYSxzPW4udmFsdWVzKClbU3ltYm9sLml0ZXJhdG9yXSgpOyEocj0oYT1zLm5leHQoKSkuZG9uZSk7cj0hMCl7Yih0LGEudmFsdWUpfX1jYXRjaCh0KXtpPSEwLG89dH1maW5hbGx5e3RyeXshciYmcy5yZXR1cm4mJnMucmV0dXJuKCl9ZmluYWxseXtpZihpKXRocm93IG99fX19LHtrZXk6XCJfZ2NDaGlsZHJlblwiLHZhbHVlOmZ1bmN0aW9uKHQpe3codCx0aGlzLl9zdGFydCksdGhpcy5fc3RhcnQ9bnVsbCx0aGlzLl9tYXAuZm9yRWFjaChmdW5jdGlvbihlKXt3KHQsZSl9KSx0aGlzLl9tYXA9bmV3IE1hcH19LHtrZXk6XCJfZ2NcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9nY0NoaWxkcmVuKHQpLEJ0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9nY1wiLHRoaXMpLmNhbGwodGhpcyx0KX19LHtrZXk6XCJfZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3ZvaWQgMCE9PW4mJnQuZ2NFbmFibGVkfHwobj0hMT09PXQuX2hhc1VuZG9NYW5hZ2VyJiZ0LmdjRW5hYmxlZCksQnQoVHlwZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoVHlwZS5wcm90b3R5cGUpLFwiX2RlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LGUsbiksdC5fdHJhbnNhY3Rpb24uY2hhbmdlZFR5cGVzLmRlbGV0ZSh0aGlzKTt2YXIgcj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz10aGlzLl9tYXAudmFsdWVzKClbU3ltYm9sLml0ZXJhdG9yXSgpOyEocj0oYT1zLm5leHQoKSkuZG9uZSk7cj0hMCl7dmFyIGw9YS52YWx1ZTtsIGluc3RhbmNlb2YgSXRlbSYmIWwuX2RlbGV0ZWQmJmwuX2RlbGV0ZSh0LCExLG4pfX1jYXRjaCh0KXtpPSEwLG89dH1maW5hbGx5e3RyeXshciYmcy5yZXR1cm4mJnMucmV0dXJuKCl9ZmluYWxseXtpZihpKXRocm93IG99fWZvcih2YXIgdT10aGlzLl9zdGFydDtudWxsIT09dTspdS5fZGVsZXRlZHx8dS5fZGVsZXRlKHQsITEsbiksdT11Ll9yaWdodDtuJiZ0aGlzLl9nY0NoaWxkcmVuKHQpfX1dKSxUeXBlfShJdGVtKSxJdGVtSlNPTj1mdW5jdGlvbih0KXtmdW5jdGlvbiBJdGVtSlNPTigpe0V0KHRoaXMsSXRlbUpTT04pO3ZhciB0PUF0KHRoaXMsKEl0ZW1KU09OLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX2NvbnRlbnQ9bnVsbCx0fXJldHVybiBUdChJdGVtSlNPTix0KSxVdChJdGVtSlNPTixbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1CdChJdGVtSlNPTi5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04ucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5fY29udGVudD10aGlzLl9jb250ZW50LHR9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPUJ0KEl0ZW1KU09OLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTi5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKSxyPWUucmVhZFZhclVpbnQoKTt0aGlzLl9jb250ZW50PW5ldyBBcnJheShyKTtmb3IodmFyIGk9MDtpPHI7aSsrKXt2YXIgbz1lLnJlYWRWYXJTdHJpbmcoKSxhPXZvaWQgMDthPVwidW5kZWZpbmVkXCI9PT1vP3ZvaWQgMDpKU09OLnBhcnNlKG8pLHRoaXMuX2NvbnRlbnRbaV09YX1yZXR1cm4gbn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtCdChJdGVtSlNPTi5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04ucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KTt2YXIgZT10aGlzLl9jb250ZW50Lmxlbmd0aDt0LndyaXRlVmFyVWludChlKTtmb3IodmFyIG49MDtuPGU7bisrKXt2YXIgcj12b2lkIDAsaT10aGlzLl9jb250ZW50W25dO3I9dm9pZCAwPT09aT9cInVuZGVmaW5lZFwiOkpTT04uc3RyaW5naWZ5KGkpLHQud3JpdGVWYXJTdHJpbmcocil9fX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbUpTT05cIix0aGlzLFwiY29udGVudDpcIitKU09OLnN0cmluZ2lmeSh0aGlzLl9jb250ZW50KSl9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKDA9PT1lKXJldHVybiB0aGlzO2lmKGU+PXRoaXMuX2xlbmd0aClyZXR1cm4gdGhpcy5fcmlnaHQ7dmFyIG49bmV3IEl0ZW1KU09OO3JldHVybiBuLl9jb250ZW50PXRoaXMuX2NvbnRlbnQuc3BsaWNlKGUpLGsodCx0aGlzLG4sZSksbn19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2NvbnRlbnQubGVuZ3RofX1dKSxJdGVtSlNPTn0oSXRlbSksSXRlbVN0cmluZz1mdW5jdGlvbih0KXtmdW5jdGlvbiBJdGVtU3RyaW5nKCl7RXQodGhpcyxJdGVtU3RyaW5nKTt2YXIgdD1BdCh0aGlzLChJdGVtU3RyaW5nLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcpKS5jYWxsKHRoaXMpKTtyZXR1cm4gdC5fY29udGVudD1udWxsLHR9cmV0dXJuIFR0KEl0ZW1TdHJpbmcsdCksVXQoSXRlbVN0cmluZyxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1CdChJdGVtU3RyaW5nLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQuX2NvbnRlbnQ9dGhpcy5fY29udGVudCx0fX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1CdChJdGVtU3RyaW5nLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpO3JldHVybiB0aGlzLl9jb250ZW50PWUucmVhZFZhclN0cmluZygpLG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5fY29udGVudCl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtU3RyaW5nXCIsdGhpcywnY29udGVudDpcIicrdGhpcy5fY29udGVudCsnXCInKX19LHtrZXk6XCJfc3BsaXRBdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7aWYoMD09PWUpcmV0dXJuIHRoaXM7aWYoZT49dGhpcy5fbGVuZ3RoKXJldHVybiB0aGlzLl9yaWdodDt2YXIgbj1uZXcgSXRlbVN0cmluZztyZXR1cm4gbi5fY29udGVudD10aGlzLl9jb250ZW50LnNsaWNlKGUpLHRoaXMuX2NvbnRlbnQ9dGhpcy5fY29udGVudC5zbGljZSgwLGUpLGsodCx0aGlzLG4sZSksbn19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2NvbnRlbnQubGVuZ3RofX1dKSxJdGVtU3RyaW5nfShJdGVtKSxZRXZlbnQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBZRXZlbnQodCl7RXQodGhpcyxZRXZlbnQpLHRoaXMudGFyZ2V0PXQsdGhpcy5jdXJyZW50VGFyZ2V0PXR9cmV0dXJuIFV0KFlFdmVudCxbe2tleTpcInBhdGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jdXJyZW50VGFyZ2V0LmdldFBhdGhUbyh0aGlzLnRhcmdldCl9fV0pLFlFdmVudH0oKSxZQXJyYXlFdmVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZQXJyYXlFdmVudCh0LGUsbil7RXQodGhpcyxZQXJyYXlFdmVudCk7dmFyIHI9QXQodGhpcywoWUFycmF5RXZlbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWUFycmF5RXZlbnQpKS5jYWxsKHRoaXMsdCkpO3JldHVybiByLnJlbW90ZT1lLHIuX3RyYW5zYWN0aW9uPW4sci5fYWRkZWRFbGVtZW50cz1udWxsLHIuX3JlbW92ZWRFbGVtZW50cz1udWxsLHJ9cmV0dXJuIFR0KFlBcnJheUV2ZW50LHQpLFV0KFlBcnJheUV2ZW50LFt7a2V5OlwiYWRkZWRFbGVtZW50c1wiLGdldDpmdW5jdGlvbigpe2lmKG51bGw9PT10aGlzLl9hZGRlZEVsZW1lbnRzKXt2YXIgdD10aGlzLnRhcmdldCxlPXRoaXMuX3RyYW5zYWN0aW9uLG49bmV3IFNldDtlLm5ld1R5cGVzLmZvckVhY2goZnVuY3Rpb24ocil7ci5fcGFyZW50IT09dHx8ZS5kZWxldGVkU3RydWN0cy5oYXMocil8fG4uYWRkKHIpfSksdGhpcy5fYWRkZWRFbGVtZW50cz1ufXJldHVybiB0aGlzLl9hZGRlZEVsZW1lbnRzfX0se2tleTpcInJlbW92ZWRFbGVtZW50c1wiLGdldDpmdW5jdGlvbigpe2lmKG51bGw9PT10aGlzLl9yZW1vdmVkRWxlbWVudHMpe3ZhciB0PXRoaXMudGFyZ2V0LGU9dGhpcy5fdHJhbnNhY3Rpb24sbj1uZXcgU2V0O2UuZGVsZXRlZFN0cnVjdHMuZm9yRWFjaChmdW5jdGlvbihyKXtyLl9wYXJlbnQhPT10fHxlLm5ld1R5cGVzLmhhcyhyKXx8bi5hZGQocil9KSx0aGlzLl9yZW1vdmVkRWxlbWVudHM9bn1yZXR1cm4gdGhpcy5fcmVtb3ZlZEVsZW1lbnRzfX1dKSxZQXJyYXlFdmVudH0oWUV2ZW50KSxZQXJyYXk9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWUFycmF5KCl7cmV0dXJuIEV0KHRoaXMsWUFycmF5KSxBdCh0aGlzLChZQXJyYXkuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWUFycmF5KSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gVHQoWUFycmF5LHQpLFV0KFlBcnJheSxbe2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBZQXJyYXlFdmVudCh0aGlzLG4sdCkpfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT10aGlzLl9zdGFydDtudWxsIT09ZTspe2lmKCFlLl9kZWxldGVkJiZlLl9jb3VudGFibGUpe2lmKHQ8ZS5fbGVuZ3RoKXJldHVybiBlLmNvbnN0cnVjdG9yPT09SXRlbUpTT058fGUuY29uc3RydWN0b3I9PT1JdGVtU3RyaW5nP2UuX2NvbnRlbnRbdF06ZTt0LT1lLl9sZW5ndGh9ZT1lLl9yaWdodH19fSx7a2V5OlwidG9BcnJheVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0fSl9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBUeXBlP251bGwhPT10LnRvSlNPTj90LnRvSlNPTigpOnQudG9TdHJpbmcoKTp0fSl9fSx7a2V5OlwibWFwXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPVtdO3JldHVybiB0aGlzLmZvckVhY2goZnVuY3Rpb24ocixpKXtuLnB1c2godChyLGksZSkpfSksbn19LHtrZXk6XCJmb3JFYWNoXCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPTAsbj10aGlzLl9zdGFydDtudWxsIT09bjspe2lmKCFuLl9kZWxldGVkJiZuLl9jb3VudGFibGUpaWYobiBpbnN0YW5jZW9mIFR5cGUpdChuLGUrKyx0aGlzKTtlbHNlIGZvcih2YXIgcj1uLl9jb250ZW50LGk9ci5sZW5ndGgsbz0wO288aTtvKyspZSsrLHQocltvXSxlLHRoaXMpO249bi5fcmlnaHR9fX0se2tleTpTeW1ib2wuaXRlcmF0b3IsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm57bmV4dDpmdW5jdGlvbigpe2Zvcig7bnVsbCE9PXRoaXMuX2l0ZW0mJih0aGlzLl9pdGVtLl9kZWxldGVkfHx0aGlzLl9pdGVtLl9sZW5ndGg8PXRoaXMuX2l0ZW1FbGVtZW50KTspdGhpcy5faXRlbT10aGlzLl9pdGVtLl9yaWdodCx0aGlzLl9pdGVtRWxlbWVudD0wO2lmKG51bGw9PT10aGlzLl9pdGVtKXJldHVybntkb25lOiEwfTt2YXIgdD12b2lkIDA7cmV0dXJuIHQ9dGhpcy5faXRlbSBpbnN0YW5jZW9mIFR5cGU/dGhpcy5faXRlbTp0aGlzLl9pdGVtLl9jb250ZW50W3RoaXMuX2l0ZW1FbGVtZW50KytdLHt2YWx1ZTp0LGRvbmU6ITF9fSxfaXRlbTp0aGlzLl9zdGFydCxfaXRlbUVsZW1lbnQ6MCxfY291bnQ6MH19fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXToxO2lmKHRoaXMuX3kudHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IodmFyIHI9ZS5fc3RhcnQsaT0wO251bGwhPT1yJiZuPjA7KXtpZighci5fZGVsZXRlZCYmci5fY291bnRhYmxlKWlmKGk8PXQmJnQ8aStyLl9sZW5ndGgpe3ZhciBvPXQtaTtyPXIuX3NwbGl0QXQoZS5feSxvKSxyLl9zcGxpdEF0KGUuX3ksbiksbi09ci5fbGVuZ3RoLHIuX2RlbGV0ZShlLl95KSxpKz1vfWVsc2UgaSs9ci5fbGVuZ3RoO3I9ci5fcmlnaHR9fSksbj4wKXRocm93IG5ldyBFcnJvcihcIkRlbGV0ZSBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgWUFycmF5XCIpfX0se2tleTpcImluc2VydEFmdGVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzO3JldHVybiB0aGlzLl90cmFuc2FjdChmdW5jdGlvbihyKXt2YXIgaT12b2lkIDA7aT1udWxsPT09dD9uLl9zdGFydDp0Ll9yaWdodDtmb3IodmFyIG89bnVsbCxhPTA7YTxlLmxlbmd0aDthKyspe3ZhciBzPWVbYV07XCJmdW5jdGlvblwiPT10eXBlb2YgcyYmKHM9bmV3IHMpLHMgaW5zdGFuY2VvZiBUeXBlPyhudWxsIT09byYmKG51bGwhPT1yJiZvLl9pbnRlZ3JhdGUociksdD1vLG89bnVsbCkscy5fb3JpZ2luPXQscy5fbGVmdD10LHMuX3JpZ2h0PWkscy5fcmlnaHRfb3JpZ2luPWkscy5fcGFyZW50PW4sbnVsbCE9PXI/cy5faW50ZWdyYXRlKHIpOm51bGw9PT10P24uX3N0YXJ0PXM6dC5fcmlnaHQ9cyx0PXMpOihudWxsPT09byYmKG89bmV3IEl0ZW1KU09OLG8uX29yaWdpbj10LG8uX2xlZnQ9dCxvLl9yaWdodD1pLG8uX3JpZ2h0X29yaWdpbj1pLG8uX3BhcmVudD1uLG8uX2NvbnRlbnQ9W10pLG8uX2NvbnRlbnQucHVzaChzKSl9bnVsbCE9PW8mJihudWxsIT09cj9vLl9pbnRlZ3JhdGUocik6bnVsbD09PW8uX2xlZnQmJihuLl9zdGFydD1vKSl9KSxlfX0se2tleTpcImluc2VydFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbigpe2Zvcih2YXIgcj1udWxsLGk9bi5fc3RhcnQsbz0wLGE9bi5feTtudWxsIT09aTspe3ZhciBzPWkuX2RlbGV0ZWQ/MDppLl9sZW5ndGgtMTtpZihvPD10JiZ0PD1vK3Mpe3ZhciBsPXQtbztpPWkuX3NwbGl0QXQoYSxsKSxyPWkuX2xlZnQsbys9bDticmVha31pLl9kZWxldGVkfHwobys9aS5fbGVuZ3RoKSxyPWksaT1pLl9yaWdodH1pZih0Pm8pdGhyb3cgbmV3IEVycm9yKFwiSW5kZXggZXhjZWVkcyBhcnJheSByYW5nZSFcIik7bi5pbnNlcnRBZnRlcihyLGUpfSl9fSx7a2V5OlwicHVzaFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT10aGlzLl9zdGFydCxuPW51bGw7bnVsbCE9PWU7KWUuX2RlbGV0ZWR8fChuPWUpLGU9ZS5fcmlnaHQ7dGhpcy5pbnNlcnRBZnRlcihuLHQpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWUFycmF5XCIsdGhpcyxcInN0YXJ0OlwiK3AodGhpcy5fc3RhcnQpKydcIicpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe2Zvcih2YXIgdD0wLGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KSFlLl9kZWxldGVkJiZlLl9jb3VudGFibGUmJih0Kz1lLl9sZW5ndGgpLGU9ZS5fcmlnaHQ7cmV0dXJuIHR9fV0pLFlBcnJheX0oVHlwZSksWU1hcEV2ZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlNYXBFdmVudCh0LGUsbil7RXQodGhpcyxZTWFwRXZlbnQpO3ZhciByPUF0KHRoaXMsKFlNYXBFdmVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZTWFwRXZlbnQpKS5jYWxsKHRoaXMsdCkpO3JldHVybiByLmtleXNDaGFuZ2VkPWUsci5yZW1vdGU9bixyfXJldHVybiBUdChZTWFwRXZlbnQsdCksWU1hcEV2ZW50fShZRXZlbnQpLFlNYXA9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWU1hcCgpe3JldHVybiBFdCh0aGlzLFlNYXApLEF0KHRoaXMsKFlNYXAuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWU1hcCkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KFlNYXAsdCksVXQoWU1hcCxbe2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBZTWFwRXZlbnQodGhpcyxlLG4pKX19LHtrZXk6XCJ0b0pTT05cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXt9LGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPXh0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTtpZighbC5fZGVsZXRlZCl7dmFyIHU9dm9pZCAwO3U9bCBpbnN0YW5jZW9mIFR5cGU/dm9pZCAwIT09bC50b0pTT04/bC50b0pTT04oKTpsLnRvU3RyaW5nKCk6bC5fY29udGVudFswXSx0W3NdPXV9fX1jYXRjaCh0KXtuPSEwLHI9dH1maW5hbGx5e3RyeXshZSYmby5yZXR1cm4mJm8ucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IHJ9fXJldHVybiB0fX0se2tleTpcImtleXNcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdLGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPXh0KGkudmFsdWUsMikscz1hWzBdO2FbMV0uX2RlbGV0ZWR8fHQucHVzaChzKX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKG4pe3ZhciByPWUuX21hcC5nZXQodCk7bnVsbCE9PW4mJnZvaWQgMCE9PXImJnIuX2RlbGV0ZShuKX0pfX0se2tleTpcInNldFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcztyZXR1cm4gdGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24ocil7dmFyIGk9bi5fbWFwLmdldCh0KXx8bnVsbDtpZihudWxsIT09aSl7aWYoaS5jb25zdHJ1Y3Rvcj09PUl0ZW1KU09OJiYhaS5fZGVsZXRlZCYmaS5fY29udGVudFswXT09PWUpcmV0dXJuIGU7bnVsbCE9PXImJmkuX2RlbGV0ZShyKX12YXIgbz12b2lkIDA7XCJmdW5jdGlvblwiPT10eXBlb2YgZT8obz1uZXcgZSxlPW8pOmUgaW5zdGFuY2VvZiBJdGVtP289ZToobz1uZXcgSXRlbUpTT04sby5fY29udGVudD1bZV0pLG8uX3JpZ2h0PWksby5fcmlnaHRfb3JpZ2luPWksby5fcGFyZW50PW4sby5fcGFyZW50U3ViPXQsbnVsbCE9PXI/by5faW50ZWdyYXRlKHIpOm4uX21hcC5zZXQodCxvKX0pLGV9fSx7a2V5OlwiZ2V0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fbWFwLmdldCh0KTtpZih2b2lkIDAhPT1lJiYhZS5fZGVsZXRlZClyZXR1cm4gZSBpbnN0YW5jZW9mIFR5cGU/ZTplLl9jb250ZW50W2UuX2NvbnRlbnQubGVuZ3RoLTFdfX0se2tleTpcImhhc1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX21hcC5nZXQodCk7cmV0dXJuIHZvaWQgMCE9PWUmJiFlLl9kZWxldGVkfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWU1hcFwiLHRoaXMsXCJtYXBTaXplOlwiK3RoaXMuX21hcC5zaXplKX19XSksWU1hcH0oVHlwZSksSHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSgpe0V0KHRoaXMsZSk7dmFyIHQ9QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuZW1iZWQ9bnVsbCx0fXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gci5lbWJlZD10aGlzLmVtYmVkLHJ9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHRoaXMuZW1iZWQ9SlNPTi5wYXJzZShuLnJlYWRWYXJTdHJpbmcoKSkscn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLmVtYmVkKSl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtRW1iZWRcIix0aGlzLFwiZW1iZWQ6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy5lbWJlZCkpfX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gMX19XSksZX0oSXRlbSksSnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSgpe0V0KHRoaXMsZSk7dmFyIHQ9QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQua2V5PW51bGwsdC52YWx1ZT1udWxsLHR9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1CdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiByLmtleT10aGlzLmtleSxyLnZhbHVlPXRoaXMudmFsdWUscn19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gdGhpcy5rZXk9bi5yZWFkVmFyU3RyaW5nKCksdGhpcy52YWx1ZT1KU09OLnBhcnNlKG4ucmVhZFZhclN0cmluZygpKSxyfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMua2V5KSx0LndyaXRlVmFyU3RyaW5nKEpTT04uc3RyaW5naWZ5KHRoaXMudmFsdWUpKX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1Gb3JtYXRcIix0aGlzLFwia2V5OlwiK0pTT04uc3RyaW5naWZ5KHRoaXMua2V5KStcIix2YWx1ZTpcIitKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlKSl9fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiAxfX0se2tleTpcIl9jb3VudGFibGVcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4hMX19XSksZX0oSXRlbSksenQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0LG4scil7RXQodGhpcyxlKTt2YXIgaT1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuLHIpKTtyZXR1cm4gaS5fZGVsdGE9bnVsbCxpfXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJkZWx0YVwiLGdldDpmdW5jdGlvbigpe3ZhciB0PXRoaXM7aWYobnVsbD09PXRoaXMuX2RlbHRhKXt2YXIgZT10aGlzLnRhcmdldC5feTtlLnRyYW5zYWN0KGZ1bmN0aW9uKCl7dmFyIG49dC50YXJnZXQuX3N0YXJ0LHI9W10saT10LmFkZGVkRWxlbWVudHMsbz10LnJlbW92ZWRFbGVtZW50czt0Ll9kZWx0YT1yO2Zvcih2YXIgYT1udWxsLHM9e30sbD1uZXcgTWFwLHU9bmV3IE1hcCxjPVwiXCIsaD0wLGY9MCxkPWZ1bmN0aW9uKCl7aWYobnVsbCE9PWEpe3ZhciB0PXZvaWQgMDtzd2l0Y2goYSl7Y2FzZVwiZGVsZXRlXCI6dD17ZGVsZXRlOmZ9LGY9MDticmVhaztjYXNlXCJpbnNlcnRcIjppZih0PXtpbnNlcnQ6Y30sbC5zaXplPjApe3QuYXR0cmlidXRlcz17fTt2YXIgZT0hMCxuPSExLGk9dm9pZCAwO3RyeXtmb3IodmFyIG8sdT1sW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KG89dS5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBkPXh0KG8udmFsdWUsMiksXz1kWzBdLHY9ZFsxXTtudWxsIT09diYmKHQuYXR0cmlidXRlc1tfXT12KX19Y2F0Y2godCl7bj0hMCxpPXR9ZmluYWxseXt0cnl7IWUmJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyBpfX19Yz1cIlwiO2JyZWFrO2Nhc2VcInJldGFpblwiOmlmKHQ9e3JldGFpbjpofSxPYmplY3Qua2V5cyhzKS5sZW5ndGg+MCl7dC5hdHRyaWJ1dGVzPXt9O2Zvcih2YXIgXyBpbiBzKXQuYXR0cmlidXRlc1tfXT1zW19dfWg9MH1yLnB1c2godCksYT1udWxsfX07bnVsbCE9PW47KXtzd2l0Y2gobi5jb25zdHJ1Y3Rvcil7Y2FzZSBIdDppLmhhcyhuKT8oZCgpLGE9XCJpbnNlcnRcIixjPW4uZW1iZWQsZCgpKTpvLmhhcyhuKT8oXCJkZWxldGVcIiE9PWEmJihkKCksYT1cImRlbGV0ZVwiKSxmKz0xKTohMT09PW4uX2RlbGV0ZWQmJihcInJldGFpblwiIT09YSYmKGQoKSxhPVwicmV0YWluXCIpLGgrPTEpO2JyZWFrO2Nhc2UgSXRlbVN0cmluZzppLmhhcyhuKT8oXCJpbnNlcnRcIiE9PWEmJihkKCksYT1cImluc2VydFwiKSxjKz1uLl9jb250ZW50KTpvLmhhcyhuKT8oXCJkZWxldGVcIiE9PWEmJihkKCksYT1cImRlbGV0ZVwiKSxmKz1uLl9sZW5ndGgpOiExPT09bi5fZGVsZXRlZCYmKFwicmV0YWluXCIhPT1hJiYoZCgpLGE9XCJyZXRhaW5cIiksaCs9bi5fbGVuZ3RoKTticmVhaztjYXNlIEp0OmlmKGkuaGFzKG4pKXsobC5nZXQobi5rZXkpfHxudWxsKSE9PW4udmFsdWU/KFwicmV0YWluXCI9PT1hJiZkKCksbi52YWx1ZT09PSh1LmdldChuLmtleSl8fG51bGwpP2RlbGV0ZSBzW24ua2V5XTpzW24ua2V5XT1uLnZhbHVlKTpuLl9kZWxldGUoZSl9ZWxzZSBpZihvLmhhcyhuKSl7dS5zZXQobi5rZXksbi52YWx1ZSk7dmFyIF89bC5nZXQobi5rZXkpfHxudWxsO18hPT1uLnZhbHVlJiYoXCJyZXRhaW5cIj09PWEmJmQoKSxzW24ua2V5XT1fKX1lbHNlIGlmKCExPT09bi5fZGVsZXRlZCl7dS5zZXQobi5rZXksbi52YWx1ZSk7dmFyIHY9c1tuLmtleV07dm9pZCAwIT09diYmKHYhPT1uLnZhbHVlPyhcInJldGFpblwiPT09YSYmZCgpLG51bGw9PT1uLnZhbHVlP3Nbbi5rZXldPW4udmFsdWU6ZGVsZXRlIHNbbi5rZXldKTpuLl9kZWxldGUoZSkpfSExPT09bi5fZGVsZXRlZCYmKFwiaW5zZXJ0XCI9PT1hJiZkKCksQihsLG4pKX1uPW4uX3JpZ2h0fWZvcihkKCk7dC5fZGVsdGEubGVuZ3RoPjA7KXt2YXIgcD10Ll9kZWx0YVt0Ll9kZWx0YS5sZW5ndGgtMV07aWYodm9pZCAwPT09cC5yZXRhaW58fHZvaWQgMCE9PXAuYXR0cmlidXRlcylicmVhazt0Ll9kZWx0YS5wb3AoKX19KX1yZXR1cm4gdGhpcy5fZGVsdGF9fV0pLGV9KFlBcnJheUV2ZW50KSxZVGV4dD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZVGV4dCh0KXtFdCh0aGlzLFlUZXh0KTt2YXIgZT1BdCh0aGlzLChZVGV4dC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZVGV4dCkpLmNhbGwodGhpcykpO2lmKFwic3RyaW5nXCI9PXR5cGVvZiB0KXt2YXIgbj1uZXcgSXRlbVN0cmluZztuLl9wYXJlbnQ9ZSxuLl9jb250ZW50PXQsZS5fc3RhcnQ9bn1yZXR1cm4gZX1yZXR1cm4gVHQoWVRleHQsdCksVXQoWVRleHQsW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgenQodGhpcyxuLHQpKX19LHtrZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PVwiXCIsZT10aGlzLl9zdGFydDtudWxsIT09ZTspIWUuX2RlbGV0ZWQmJmUuX2NvdW50YWJsZSYmKHQrPWUuX2NvbnRlbnQpLGU9ZS5fcmlnaHQ7cmV0dXJuIHR9fSx7a2V5OlwiYXBwbHlEZWx0YVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24obil7Zm9yKHZhciByPW51bGwsaT1lLl9zdGFydCxvPW5ldyBNYXAsYT0wO2E8dC5sZW5ndGg7YSsrKXt2YXIgcz10W2FdO2lmKHZvaWQgMCE9PXMuaW5zZXJ0KXt2YXIgbD14KG4scy5pbnNlcnQsZSxyLGksbyxzLmF0dHJpYnV0ZXN8fHt9KSx1PXh0KGwsMik7cj11WzBdLGk9dVsxXX1lbHNlIGlmKHZvaWQgMCE9PXMucmV0YWluKXt2YXIgYz1JKG4scy5yZXRhaW4sZSxyLGksbyxzLmF0dHJpYnV0ZXN8fHt9KSxoPXh0KGMsMik7cj1oWzBdLGk9aFsxXX1lbHNlIGlmKHZvaWQgMCE9PXMuZGVsZXRlKXt2YXIgZj1EKG4scy5kZWxldGUsZSxyLGksbyksZD14dChmLDIpO3I9ZFswXSxpPWRbMV19fX0pfX0se2tleTpcInRvRGVsdGFcIix2YWx1ZTpmdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtpZihyLmxlbmd0aD4wKXt2YXIgdD17fSxpPSExLG89ITAsYT0hMSxzPXZvaWQgMDt0cnl7Zm9yKHZhciBsLHU9bltTeW1ib2wuaXRlcmF0b3JdKCk7IShvPShsPXUubmV4dCgpKS5kb25lKTtvPSEwKXt2YXIgYz14dChsLnZhbHVlLDIpLGg9Y1swXSxmPWNbMV07aT0hMCx0W2hdPWZ9fWNhdGNoKHQpe2E9ITAscz10fWZpbmFsbHl7dHJ5eyFvJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKGEpdGhyb3cgc319dmFyIGQ9e2luc2VydDpyfTtpJiYoZC5hdHRyaWJ1dGVzPXQpLGUucHVzaChkKSxyPVwiXCJ9fWZvcih2YXIgZT1bXSxuPW5ldyBNYXAscj1cIlwiLGk9dGhpcy5fc3RhcnQ7bnVsbCE9PWk7KXtpZighaS5fZGVsZXRlZClzd2l0Y2goaS5jb25zdHJ1Y3Rvcil7Y2FzZSBJdGVtU3RyaW5nOnIrPWkuX2NvbnRlbnQ7YnJlYWs7Y2FzZSBKdDp0KCksQihuLGkpfWk9aS5fcmlnaHR9cmV0dXJuIHQoKSxlfX0se2tleTpcImluc2VydFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcyxyPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fTtlLmxlbmd0aDw9MHx8dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShuLHQpLGE9eHQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTt4KGksZSxuLHMsbCx1LHIpfSl9fSx7a2V5OlwiaW5zZXJ0RW1iZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307aWYoZS5jb25zdHJ1Y3RvciE9PU9iamVjdCl0aHJvdyBuZXcgRXJyb3IoXCJFbWJlZCBtdXN0IGJlIGFuIE9iamVjdFwiKTt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihpKXt2YXIgbz1FKG4sdCksYT14dChvLDMpLHM9YVswXSxsPWFbMV0sdT1hWzJdO3goaSxlLG4scyxsLHUscil9KX19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7MCE9PWUmJnRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKHIpe3ZhciBpPUUobix0KSxvPXh0KGksMyksYT1vWzBdLHM9b1sxXSxsPW9bMl07RChyLGUsbixhLHMsbCl9KX19LHtrZXk6XCJmb3JtYXRcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI9dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihpKXt2YXIgbz1FKHIsdCksYT14dChvLDMpLHM9YVswXSxsPWFbMV0sdT1hWzJdO251bGwhPT1sJiZJKGksZSxyLHMsbCx1LG4pfSl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJZVGV4dFwiLHRoaXMpfX1dKSxZVGV4dH0oWUFycmF5KSxZWG1sSG9vaz1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sSG9vayh0KXtFdCh0aGlzLFlYbWxIb29rKTt2YXIgZT1BdCh0aGlzLChZWG1sSG9vay5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vaykpLmNhbGwodGhpcykpO3JldHVybiBlLmhvb2tOYW1lPW51bGwsdm9pZCAwIT09dCYmKGUuaG9va05hbWU9dCksZX1yZXR1cm4gVHQoWVhtbEhvb2ssdCksVXQoWVhtbEhvb2ssW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9QnQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQuaG9va05hbWU9dGhpcy5ob29rTmFtZSx0fX0se2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e30sZT1hcmd1bWVudHNbMl0sbj10W3RoaXMuaG9va05hbWVdLHI9dm9pZCAwO3JldHVybiByPXZvaWQgMCE9PW4/bi5jcmVhdGVEb20odGhpcyk6ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLmhvb2tOYW1lKSxyLnNldEF0dHJpYnV0ZShcImRhdGEteWpzLWhvb2tcIix0aGlzLmhvb2tOYW1lKSxSKGUscix0aGlzKSxyfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1CdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSk7cmV0dXJuIHRoaXMuaG9va05hbWU9ZS5yZWFkVmFyU3RyaW5nKCksbn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtCdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMuaG9va05hbWUpfX0se2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsPT09dGhpcy5ob29rTmFtZSl0aHJvdyBuZXcgRXJyb3IoXCJob29rTmFtZSBtdXN0IGJlIGRlZmluZWQhXCIpO0J0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX2ludGVncmF0ZVwiLHRoaXMpLmNhbGwodGhpcyx0KX19XSksWVhtbEhvb2t9KFlNYXApLFl0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe0V0KHRoaXMsdCksdGhpcy5fZmlsdGVyPW58fGZ1bmN0aW9uKCl7cmV0dXJuITB9LHRoaXMuX3Jvb3Q9ZSx0aGlzLl9jdXJyZW50Tm9kZT1lLHRoaXMuX2ZpcnN0Q2FsbD0hMH1yZXR1cm4gVXQodCxbe2tleTpTeW1ib2wuaXRlcmF0b3IsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpc319LHtrZXk6XCJuZXh0XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLl9jdXJyZW50Tm9kZTtpZih0aGlzLl9maXJzdENhbGwmJih0aGlzLl9maXJzdENhbGw9ITEsIXQuX2RlbGV0ZWQmJnRoaXMuX2ZpbHRlcih0KSkpcmV0dXJue3ZhbHVlOnQsZG9uZTohMX07ZG97aWYodC5fZGVsZXRlZHx8dC5jb25zdHJ1Y3RvciE9PVlYbWxGcmFnbWVudC5fWVhtbEVsZW1lbnQmJnQuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnR8fG51bGw9PT10Ll9zdGFydCl7Zm9yKDt0IT09dGhpcy5fcm9vdDspe2lmKG51bGwhPT10Ll9yaWdodCl7dD10Ll9yaWdodDticmVha310PXQuX3BhcmVudH10PT09dGhpcy5fcm9vdCYmKHQ9bnVsbCl9ZWxzZSB0PXQuX3N0YXJ0O2lmKHQ9PT10aGlzLl9yb290KWJyZWFrfXdoaWxlKG51bGwhPT10JiYodC5fZGVsZXRlZHx8IXRoaXMuX2ZpbHRlcih0KSkpO3JldHVybiB0aGlzLl9jdXJyZW50Tm9kZT10LG51bGw9PT10P3tkb25lOiEwfTp7dmFsdWU6dCxkb25lOiExfX19XSksdH0oKSxZWG1sRXZlbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEV2ZW50KHQsZSxuLHIpe0V0KHRoaXMsWVhtbEV2ZW50KTt2YXIgaT1BdCh0aGlzLChZWG1sRXZlbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gaS5fdHJhbnNhY3Rpb249cixpLmNoaWxkTGlzdENoYW5nZWQ9ITEsaS5hdHRyaWJ1dGVzQ2hhbmdlZD1uZXcgU2V0LGkucmVtb3RlPW4sZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe251bGw9PT10P2kuY2hpbGRMaXN0Q2hhbmdlZD0hMDppLmF0dHJpYnV0ZXNDaGFuZ2VkLmFkZCh0KX0pLGl9cmV0dXJuIFR0KFlYbWxFdmVudCx0KSxZWG1sRXZlbnR9KFlFdmVudCksWVhtbEZyYWdtZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxGcmFnbWVudCgpe3JldHVybiBFdCh0aGlzLFlYbWxGcmFnbWVudCksQXQodGhpcywoWVhtbEZyYWdtZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxGcmFnbWVudCkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KFlYbWxGcmFnbWVudCx0KSxVdChZWG1sRnJhZ21lbnQsW3trZXk6XCJjcmVhdGVUcmVlV2Fsa2VyXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIG5ldyBZdCh0aGlzLHQpfX0se2tleTpcInF1ZXJ5U2VsZWN0b3JcIix2YWx1ZTpmdW5jdGlvbih0KXt0PXQudG9VcHBlckNhc2UoKTt2YXIgZT1uZXcgWXQodGhpcyxmdW5jdGlvbihlKXtyZXR1cm4gZS5ub2RlTmFtZT09PXR9KSxuPWUubmV4dCgpO3JldHVybiBuLmRvbmU/bnVsbDpuLnZhbHVlfX0se2tleTpcInF1ZXJ5U2VsZWN0b3JBbGxcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdD10LnRvVXBwZXJDYXNlKCksQXJyYXkuZnJvbShuZXcgWXQodGhpcyxmdW5jdGlvbihlKXtyZXR1cm4gZS5ub2RlTmFtZT09PXR9KSl9fSx7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IFlYbWxFdmVudCh0aGlzLGUsbix0KSl9fSx7a2V5OlwidG9TdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdC50b1N0cmluZygpfSkuam9pbihcIlwiKX19LHtrZXk6XCJfZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe0J0KFlYbWxGcmFnbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEZyYWdtZW50LnByb3RvdHlwZSksXCJfZGVsZXRlXCIsdGhpcykuY2FsbCh0aGlzLHQsZSxuKX19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOmRvY3VtZW50LGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LG49YXJndW1lbnRzWzJdLHI9dC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7cmV0dXJuIFIobixyLHRoaXMpLHRoaXMuZm9yRWFjaChmdW5jdGlvbihpKXtyLmluc2VydEJlZm9yZShpLnRvRG9tKHQsZSxuKSxudWxsKX0pLHJ9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJZWG1sXCIsdGhpcyl9fV0pLFlYbWxGcmFnbWVudH0oWUFycmF5KSxZWG1sRWxlbWVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sRWxlbWVudCgpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpcIlVOREVGSU5FRFwiO0V0KHRoaXMsWVhtbEVsZW1lbnQpO3ZhciBlPUF0KHRoaXMsKFlYbWxFbGVtZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50KSkuY2FsbCh0aGlzKSk7cmV0dXJuIGUubm9kZU5hbWU9dC50b1VwcGVyQ2FzZSgpLGV9cmV0dXJuIFR0KFlYbWxFbGVtZW50LHQpLFV0KFlYbWxFbGVtZW50LFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PUJ0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Lm5vZGVOYW1lPXRoaXMubm9kZU5hbWUsdH19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49QnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpO3JldHVybiB0aGlzLm5vZGVOYW1lPWUucmVhZFZhclN0cmluZygpLG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLm5vZGVOYW1lKX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXRoaXMubm9kZU5hbWUpdGhyb3cgbmV3IEVycm9yKFwibm9kZU5hbWUgbXVzdCBiZSBkZWZpbmVkIVwiKTtCdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCl9fSx7a2V5OlwidG9TdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMuZ2V0QXR0cmlidXRlcygpLGU9W10sbj1bXTtmb3IodmFyIHIgaW4gdCluLnB1c2gocik7bi5zb3J0KCk7Zm9yKHZhciBpPW4ubGVuZ3RoLG89MDtvPGk7bysrKXt2YXIgYT1uW29dO2UucHVzaChhKyc9XCInK3RbYV0rJ1wiJyl9dmFyIHM9dGhpcy5ub2RlTmFtZS50b0xvY2FsZUxvd2VyQ2FzZSgpO3JldHVyblwiPFwiK3MrKGUubGVuZ3RoPjA/XCIgXCIrZS5qb2luKFwiIFwiKTpcIlwiKStcIj5cIitCdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcInRvU3RyaW5nXCIsdGhpcykuY2FsbCh0aGlzKStcIjwvXCIrcytcIj5cIn19LHtrZXk6XCJyZW1vdmVBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gWU1hcC5wcm90b3R5cGUuZGVsZXRlLmNhbGwodGhpcyx0KX19LHtrZXk6XCJzZXRBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3JldHVybiBZTWFwLnByb3RvdHlwZS5zZXQuY2FsbCh0aGlzLHQsZSl9fSx7a2V5OlwiZ2V0QXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIFlNYXAucHJvdG90eXBlLmdldC5jYWxsKHRoaXMsdCl9fSx7a2V5OlwiZ2V0QXR0cmlidXRlc1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9e30sZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLl9tYXBbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7dmFyIGE9eHQoaS52YWx1ZSwyKSxzPWFbMF0sbD1hWzFdO2wuX2RlbGV0ZWR8fCh0W3NdPWwuX2NvbnRlbnRbMF0pfX1jYXRjaCh0KXtuPSEwLHI9dH1maW5hbGx5e3RyeXshZSYmby5yZXR1cm4mJm8ucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IHJ9fXJldHVybiB0fX0se2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06ZG9jdW1lbnQsZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e30sbj1hcmd1bWVudHNbMl0scj10LmNyZWF0ZUVsZW1lbnQodGhpcy5ub2RlTmFtZSksaT10aGlzLmdldEF0dHJpYnV0ZXMoKTtmb3IodmFyIG8gaW4gaSlyLnNldEF0dHJpYnV0ZShvLGlbb10pO3JldHVybiB0aGlzLmZvckVhY2goZnVuY3Rpb24oaSl7ci5hcHBlbmRDaGlsZChpLnRvRG9tKHQsZSxuKSl9KSxSKG4scix0aGlzKSxyfX1dKSxZWG1sRWxlbWVudH0oWVhtbEZyYWdtZW50KTtZWG1sRnJhZ21lbnQuX1lYbWxFbGVtZW50PVlYbWxFbGVtZW50O3ZhciBZWG1sVGV4dD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sVGV4dCgpe3JldHVybiBFdCh0aGlzLFlYbWxUZXh0KSxBdCh0aGlzLChZWG1sVGV4dC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sVGV4dCkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KFlYbWxUZXh0LHQpLFV0KFlYbWxUZXh0LFt7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpkb2N1bWVudCxlPWFyZ3VtZW50c1syXSxuPXQuY3JlYXRlVGV4dE5vZGUodGhpcy50b1N0cmluZygpKTtyZXR1cm4gUihlLG4sdGhpcyksbn19LHtrZXk6XCJfZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe0J0KFlYbWxUZXh0LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sVGV4dC5wcm90b3R5cGUpLFwiX2RlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LGUsbil9fV0pLFlYbWxUZXh0fShZVGV4dCksRnQ9bmV3IE1hcCxYdD1uZXcgTWFwO1goMCxJdGVtSlNPTiksWCgxLEl0ZW1TdHJpbmcpLFgoMTAsSnQpLFgoMTEsSHQpLFgoMixEZWxldGUpLFgoMyxZQXJyYXkpLFgoNCxZTWFwKSxYKDUsWVRleHQpLFgoNixZWG1sRnJhZ21lbnQpLFgoNyxZWG1sRWxlbWVudCksWCg4LFlYbWxUZXh0KSxYKDksWVhtbEhvb2spLFgoMTIsTHQpO3ZhciBxdD0xNjc3NzIxNSwkdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtFdCh0aGlzLHQpLHRoaXMudXNlcj1xdCx0aGlzLm5hbWU9ZSx0aGlzLnR5cGU9JChuKX1yZXR1cm4gVXQodCxbe2tleTpcImVxdWFsc1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBudWxsIT09dCYmdC51c2VyPT09dGhpcy51c2VyJiZ0Lm5hbWU9PT10aGlzLm5hbWUmJnQudHlwZT09PXRoaXMudHlwZX19LHtrZXk6XCJsZXNzVGhhblwiLHZhbHVlOmZ1bmN0aW9uKGUpe3JldHVybiBlLmNvbnN0cnVjdG9yIT09dHx8KHRoaXMudXNlcjxlLnVzZXJ8fHRoaXMudXNlcj09PWUudXNlciYmKHRoaXMubmFtZTxlLm5hbWV8fHRoaXMubmFtZT09PWUubmFtZSYmdGhpcy50eXBlPGUudHlwZSkpfX1dKSx0fSgpLEd0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCl7RXQodGhpcyxlKTt2YXIgbj1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMpKTtyZXR1cm4gbi55PXQsbn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwibG9nVGFibGVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdO3RoaXMuaXRlcmF0ZShudWxsLG51bGwsZnVuY3Rpb24oZSl7ZS5jb25zdHJ1Y3Rvcj09PUx0P3QucHVzaCh7aWQ6cChlKSxjb250ZW50OmUuX2xlbmd0aCxkZWxldGVkOlwiR0NcIn0pOnQucHVzaCh7aWQ6cChlKSxvcmlnaW46cChudWxsPT09ZS5fb3JpZ2luP251bGw6ZS5fb3JpZ2luLl9sYXN0SWQpLGxlZnQ6cChudWxsPT09ZS5fbGVmdD9udWxsOmUuX2xlZnQuX2xhc3RJZCkscmlnaHQ6cChlLl9yaWdodCkscmlnaHRfb3JpZ2luOnAoZS5fcmlnaHRfb3JpZ2luKSxwYXJlbnQ6cChlLl9wYXJlbnQpLHBhcmVudFN1YjplLl9wYXJlbnRTdWIsZGVsZXRlZDplLl9kZWxldGVkLGNvbnRlbnQ6SlNPTi5zdHJpbmdpZnkoZS5fY29udGVudCl9KX0pLGNvbnNvbGUudGFibGUodCl9fSx7a2V5OlwiZ2V0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kKHQpO2lmKG51bGw9PT1lJiZ0IGluc3RhbmNlb2YgJHQpe3ZhciBuPXEodC50eXBlKSxyPXRoaXMueTtlPW5ldyBuLGUuX2lkPXQsZS5fcGFyZW50PXIsci50cmFuc2FjdChmdW5jdGlvbigpe2UuX2ludGVncmF0ZShyKX0pLHRoaXMucHV0KGUpfXJldHVybiBlfX0se2tleTpcImdldEl0ZW1cIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmRXaXRoVXBwZXJCb3VuZCh0KTtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDt2YXIgbj1lLl9pZDtyZXR1cm4gdC51c2VyPT09bi51c2VyJiZ0LmNsb2NrPG4uY2xvY2srZS5fbGVuZ3RoP2U6bnVsbH19LHtrZXk6XCJnZXRJdGVtQ2xlYW5TdGFydFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZ2V0SXRlbSh0KTtpZihudWxsPT09ZXx8MT09PWUuX2xlbmd0aClyZXR1cm4gZTt2YXIgbj1lLl9pZDtyZXR1cm4gbi5jbG9jaz09PXQuY2xvY2s/ZTplLl9zcGxpdEF0KHRoaXMueSx0LmNsb2NrLW4uY2xvY2spfX0se2tleTpcImdldEl0ZW1DbGVhbkVuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZ2V0SXRlbSh0KTtpZihudWxsPT09ZXx8MT09PWUuX2xlbmd0aClyZXR1cm4gZTt2YXIgbj1lLl9pZDtyZXR1cm4gbi5jbG9jaytlLl9sZW5ndGgtMT09PXQuY2xvY2s/ZTooZS5fc3BsaXRBdCh0aGlzLnksdC5jbG9jay1uLmNsb2NrKzEpLGUpfX1dKSxlfShEdCksWnQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe0V0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5zdGF0ZT1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwibG9nVGFibGVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdLGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7XG5mb3IodmFyIGksbz10aGlzLnN0YXRlW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPXh0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTt0LnB1c2goe3VzZXI6cyxzdGF0ZTpsfSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19Y29uc29sZS50YWJsZSh0KX19LHtrZXk6XCJnZXROZXh0SURcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnkudXNlcklELG49dGhpcy5nZXRTdGF0ZShlKTtyZXR1cm4gdGhpcy5zZXRTdGF0ZShlLG4rdCksbmV3IFB0KGUsbil9fSx7a2V5OlwidXBkYXRlUmVtb3RlU3RhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dC5faWQudXNlcixuPXRoaXMuc3RhdGUuZ2V0KGUpO251bGwhPT10JiZ0Ll9pZC5jbG9jaz09PW47KW4rPXQuX2xlbmd0aCx0PXRoaXMueS5vcy5nZXQobmV3IFB0KGUsbikpO3RoaXMuc3RhdGUuc2V0KGUsbil9fSx7a2V5OlwiZ2V0U3RhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnN0YXRlLmdldCh0KTtyZXR1cm4gbnVsbD09ZT8wOmV9fSx7a2V5Olwic2V0U3RhdGVcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueS5fdHJhbnNhY3Rpb24uYmVmb3JlU3RhdGU7bi5oYXModCl8fG4uc2V0KHQsdGhpcy5nZXRTdGF0ZSh0KSksdGhpcy5zdGF0ZS5zZXQodCxlKX19XSksdH0oKSxRdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtFdCh0aGlzLHQpLHRoaXMuX2V2ZW50TGlzdGVuZXI9bmV3IE1hcCx0aGlzLl9zdGF0ZUxpc3RlbmVyPW5ldyBNYXB9cmV0dXJuIFV0KHQsW3trZXk6XCJfZ2V0TGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9ldmVudExpc3RlbmVyLmdldCh0KTtyZXR1cm4gdm9pZCAwPT09ZSYmKGU9e29uY2U6bmV3IFNldCxvbjpuZXcgU2V0fSx0aGlzLl9ldmVudExpc3RlbmVyLnNldCh0LGUpKSxlfX0se2tleTpcIm9uY2VcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMuX2dldExpc3RlbmVyKHQpLm9uY2UuYWRkKGUpfX0se2tleTpcIm9uXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLl9nZXRMaXN0ZW5lcih0KS5vbi5hZGQoZSl9fSx7a2V5OlwiX2luaXRTdGF0ZUxpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fc3RhdGVMaXN0ZW5lci5nZXQodCk7cmV0dXJuIHZvaWQgMD09PWUmJihlPXt9LGUucHJvbWlzZT1uZXcgUHJvbWlzZShmdW5jdGlvbih0KXtlLnJlc29sdmU9dH0pLHRoaXMuX3N0YXRlTGlzdGVuZXIuc2V0KHQsZSkpLGV9fSx7a2V5Olwid2hlblwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLl9pbml0U3RhdGVMaXN0ZW5lcih0KS5wcm9taXNlfX0se2tleTpcIm9mZlwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7aWYobnVsbD09dHx8bnVsbD09ZSl0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBzcGVjaWZ5IGV2ZW50IG5hbWUgYW5kIGZ1bmN0aW9uIVwiKTt2YXIgbj10aGlzLl9ldmVudExpc3RlbmVyLmdldCh0KTt2b2lkIDAhPT1uJiYobi5vbi5kZWxldGUoZSksbi5vbmNlLmRlbGV0ZShlKSl9fSx7a2V5OlwiZW1pdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT1hcmd1bWVudHMubGVuZ3RoLG49QXJyYXkoZT4xP2UtMTowKSxyPTE7cjxlO3IrKyluW3ItMV09YXJndW1lbnRzW3JdO3RoaXMuX2luaXRTdGF0ZUxpc3RlbmVyKHQpLnJlc29sdmUoKTt2YXIgaT10aGlzLl9ldmVudExpc3RlbmVyLmdldCh0KTt2b2lkIDAhPT1pPyhpLm9uLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIHQuYXBwbHkobnVsbCxuKX0pLGkub25jZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiB0LmFwcGx5KG51bGwsbil9KSxpLm9uY2U9bmV3IFNldCk6XCJlcnJvclwiPT09dCYmY29uc29sZS5lcnJvcihuWzBdKX19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl9ldmVudExpc3RlbmVyPW51bGx9fV0pLHR9KCksS3Q9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7RXQodGhpcyx0KSx0aGlzLnR5cGU9ZSx0aGlzLnRhcmdldD1uLHRoaXMuX211dHVhbEV4Y2x1ZGU9SygpfXJldHVybiBVdCh0LFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlPW51bGwsdGhpcy50YXJnZXQ9bnVsbH19XSksdH0oKSx0ZT1udWxsLGVlPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBnZXRTZWxlY3Rpb24/dHQ6ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH0sbmU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0LG4pe3ZhciByPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fTtFdCh0aGlzLGUpO3ZhciBpPUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtpLm9wdHM9cixyLmRvY3VtZW50PXIuZG9jdW1lbnR8fGRvY3VtZW50LHIuaG9va3M9ci5ob29rc3x8e30saS5zY3JvbGxpbmdFbGVtZW50PXIuc2Nyb2xsaW5nRWxlbWVudHx8bnVsbCxpLmRvbVRvVHlwZT1uZXcgTWFwLGkudHlwZVRvRG9tPW5ldyBNYXAsaS5maWx0ZXI9ci5maWx0ZXJ8fGosbi5pbm5lckhUTUw9XCJcIix0LmZvckVhY2goZnVuY3Rpb24odCl7bi5pbnNlcnRCZWZvcmUodC50b0RvbShyLmRvY3VtZW50LHIuaG9va3MsaSksbnVsbCl9KSxpLl90eXBlT2JzZXJ2ZXI9b3QuYmluZChpKSxpLl9kb21PYnNlcnZlcj1mdW5jdGlvbih0KXtsdC5jYWxsKGksdCxyLmRvY3VtZW50KX0sdC5vYnNlcnZlRGVlcChpLl90eXBlT2JzZXJ2ZXIpLGkuX211dGF0aW9uT2JzZXJ2ZXI9bmV3IE11dGF0aW9uT2JzZXJ2ZXIoaS5fZG9tT2JzZXJ2ZXIpLGkuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShuLHtjaGlsZExpc3Q6ITAsYXR0cmlidXRlczohMCxjaGFyYWN0ZXJEYXRhOiEwLHN1YnRyZWU6ITB9KSxpLl9jdXJyZW50U2VsPW51bGwsZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInNlbGVjdGlvbmNoYW5nZVwiLGZ1bmN0aW9uKCl7aS5fY3VycmVudFNlbD1lZShpKX0pO3ZhciBvPXQuX3k7cmV0dXJuIGkueT1vLGkuX2JlZm9yZVRyYW5zYWN0aW9uSGFuZGxlcj1mdW5jdGlvbih0LGUsbil7aS5fZG9tT2JzZXJ2ZXIoaS5fbXV0YXRpb25PYnNlcnZlci50YWtlUmVjb3JkcygpKSxpLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7ZXQoaSxuKX0pfSxvLm9uKFwiYmVmb3JlVHJhbnNhY3Rpb25cIixpLl9iZWZvcmVUcmFuc2FjdGlvbkhhbmRsZXIpLGkuX2FmdGVyVHJhbnNhY3Rpb25IYW5kbGVyPWZ1bmN0aW9uKHQsZSxuKXtpLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7bnQoaSxuKX0pLGUuZGVsZXRlZFN0cnVjdHMuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgZT1pLnR5cGVUb0RvbS5nZXQodCk7dm9pZCAwIT09ZSYmQyhpLGUsdCl9KX0sby5vbihcImFmdGVyVHJhbnNhY3Rpb25cIixpLl9hZnRlclRyYW5zYWN0aW9uSGFuZGxlciksaS5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXI9ZnVuY3Rpb24odCxlKXtlLmNoYW5nZWRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKGUsbil7KGUuc2l6ZT4xfHwxPT09ZS5zaXplJiYhMT09PWUuaGFzKG51bGwpKSYmVih0LGksbil9KSxlLm5ld1R5cGVzLmZvckVhY2goZnVuY3Rpb24oZSl7Vih0LGksZSl9KX0sby5vbihcImJlZm9yZU9ic2VydmVyQ2FsbHNcIixpLl9iZWZvcmVPYnNlcnZlckNhbGxzSGFuZGxlciksUihpLG4sdCksaX1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5Olwic2V0RmlsdGVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5maWx0ZXI9dH19LHtrZXk6XCJfZ2V0VW5kb1N0YWNrSW5mb1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZ2V0U2VsZWN0aW9uKCl9fSx7a2V5OlwiX3Jlc3RvcmVVbmRvU3RhY2tJbmZvXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5yZXN0b3JlU2VsZWN0aW9uKHQpfX0se2tleTpcImdldFNlbGVjdGlvblwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2N1cnJlbnRTZWx9fSx7a2V5OlwicmVzdG9yZVNlbGVjdGlvblwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGwhPT10KXt2YXIgZT10LnRvLG49dC5mcm9tLHI9ITEsaT1nZXRTZWxlY3Rpb24oKSxvPWkuYmFzZU5vZGUsYT1pLmJhc2VPZmZzZXQscz1pLmV4dGVudE5vZGUsbD1pLmV4dGVudE9mZnNldDtpZihudWxsIT09bil7dmFyIHU9USh0aGlzLnksbik7aWYobnVsbCE9PXUpe3ZhciBjPXRoaXMudHlwZVRvRG9tLmdldCh1LnR5cGUpLGg9dS5vZmZzZXQ7Yz09PW8mJmg9PT1hfHwobz1jLGE9aCxyPSEwKX19aWYobnVsbCE9PWUpe3ZhciBmPVEodGhpcy55LGUpO2lmKG51bGwhPT1mKXt2YXIgZD10aGlzLnR5cGVUb0RvbS5nZXQoZi50eXBlKSxfPWYub2Zmc2V0O2Q9PT1zJiZfPT09bHx8KHM9ZCxsPV8scj0hMCl9fXImJmkuc2V0QmFzZUFuZEV4dGVudChvLGEscyxsKX19fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5kb21Ub1R5cGU9bnVsbCx0aGlzLnR5cGVUb0RvbT1udWxsLHRoaXMudHlwZS51bm9ic2VydmVEZWVwKHRoaXMuX3R5cGVPYnNlcnZlciksdGhpcy5fbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KCk7dmFyIHQ9dGhpcy50eXBlLl95O3Qub2ZmKFwiYmVmb3JlVHJhbnNhY3Rpb25cIix0aGlzLl9iZWZvcmVUcmFuc2FjdGlvbkhhbmRsZXIpLHQub2ZmKFwiYmVmb3JlT2JzZXJ2ZXJDYWxsc1wiLHRoaXMuX2JlZm9yZU9ic2VydmVyQ2FsbHNIYW5kbGVyKSx0Lm9mZihcImFmdGVyVHJhbnNhY3Rpb25cIix0aGlzLl9hZnRlclRyYW5zYWN0aW9uSGFuZGxlciksQnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KEt0KSxZPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFkodCxlLG4pe3ZhciByPWFyZ3VtZW50cy5sZW5ndGg+MyYmdm9pZCAwIT09YXJndW1lbnRzWzNdP2FyZ3VtZW50c1szXTp7fTtFdCh0aGlzLFkpO3ZhciBpPUF0KHRoaXMsKFkuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWSkpLmNhbGwodGhpcykpO2kuZ2NFbmFibGVkPXIuZ2N8fCExLGkucm9vbT10LG51bGwhPWUmJihlLmNvbm5lY3Rvci5yb29tPXQpLGkuX2NvbnRlbnRSZWFkeT0hMSxpLl9vcHRzPWUsXCJudW1iZXJcIiE9dHlwZW9mIGUudXNlcklEP2kudXNlcklEPUcoKTppLnVzZXJJRD1lLnVzZXJJRCxpLnNoYXJlPXt9LGkuZHM9bmV3IE50KGkpLGkub3M9bmV3IEd0KGkpLGkuc3M9bmV3IFp0KGkpLGkuX21pc3NpbmdTdHJ1Y3RzPW5ldyBNYXAsaS5fcmVhZHlUb0ludGVncmF0ZT1bXSxpLl90cmFuc2FjdGlvbj1udWxsLGkuY29ubmVjdG9yPW51bGwsaS5jb25uZWN0ZWQ9ITE7dmFyIG89ZnVuY3Rpb24oKXtudWxsIT1lJiYoaS5jb25uZWN0b3I9bmV3IFlbZS5jb25uZWN0b3IubmFtZV0oaSxlLmNvbm5lY3RvciksaS5jb25uZWN0ZWQ9ITAsaS5lbWl0KFwiY29ubmVjdG9yUmVhZHlcIikpfTtyZXR1cm4gaS5wZXJzaXN0ZW5jZT1udWxsLG51bGwhPW4/KGkucGVyc2lzdGVuY2U9bixuLl9pbml0KGkpLnRoZW4obykpOm8oKSxpLl9wYXJlbnQ9bnVsbCxpLl9oYXNVbmRvTWFuYWdlcj0hMSxpfXJldHVybiBUdChZLHQpLFV0KFksW3trZXk6XCJfc2V0Q29udGVudFJlYWR5XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl9jb250ZW50UmVhZHl8fCh0aGlzLl9jb250ZW50UmVhZHk9ITAsdGhpcy5lbWl0KFwiY29udGVudFwiKSl9fSx7a2V5Olwid2hlbkNvbnRlbnRSZWFkeVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcztyZXR1cm4gdGhpcy5fY29udGVudFJlYWR5P1Byb21pc2UucmVzb2x2ZSgpOm5ldyBQcm9taXNlKGZ1bmN0aW9uKGUpe3Qub25jZShcImNvbnRlbnRcIixlKX0pfX0se2tleTpcIl9iZWZvcmVDaGFuZ2VcIix2YWx1ZTpmdW5jdGlvbigpe319LHtrZXk6XCJ0cmFuc2FjdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdJiZhcmd1bWVudHNbMV0sbj1udWxsPT09dGhpcy5fdHJhbnNhY3Rpb247biYmKHRoaXMuX3RyYW5zYWN0aW9uPW5ldyBSdCh0aGlzKSx0aGlzLmVtaXQoXCJiZWZvcmVUcmFuc2FjdGlvblwiLHRoaXMsdGhpcy5fdHJhbnNhY3Rpb24sZSkpO3RyeXt0KHRoaXMpfWNhdGNoKHQpe2NvbnNvbGUuZXJyb3IodCl9aWYobil7dGhpcy5lbWl0KFwiYmVmb3JlT2JzZXJ2ZXJDYWxsc1wiLHRoaXMsdGhpcy5fdHJhbnNhY3Rpb24sZSk7dmFyIHI9dGhpcy5fdHJhbnNhY3Rpb247dGhpcy5fdHJhbnNhY3Rpb249bnVsbCxyLmNoYW5nZWRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHQsbil7bi5fZGVsZXRlZHx8bi5fY2FsbE9ic2VydmVyKHIsdCxlKX0pLHIuY2hhbmdlZFBhcmVudFR5cGVzLmZvckVhY2goZnVuY3Rpb24odCxlKXtlLl9kZWxldGVkfHwodD10LmZpbHRlcihmdW5jdGlvbih0KXtyZXR1cm4hdC50YXJnZXQuX2RlbGV0ZWR9KSx0LmZvckVhY2goZnVuY3Rpb24odCl7dC5jdXJyZW50VGFyZ2V0PWV9KSxlLl9kZWVwRXZlbnRIYW5kbGVyLmNhbGxFdmVudExpc3RlbmVycyhyLHQpKX0pLHRoaXMuZW1pdChcImFmdGVyVHJhbnNhY3Rpb25cIix0aGlzLHIsZSl9fX0se2tleTpcImRlZmluZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49bmV3ICR0KHQsZSkscj10aGlzLm9zLmdldChuKTtpZih2b2lkIDA9PT10aGlzLnNoYXJlW3RdKXRoaXMuc2hhcmVbdF09cjtlbHNlIGlmKHRoaXMuc2hhcmVbdF0hPT1yKXRocm93IG5ldyBFcnJvcihcIlR5cGUgaXMgYWxyZWFkeSBkZWZpbmVkIHdpdGggYSBkaWZmZXJlbnQgY29uc3RydWN0b3JcIik7cmV0dXJuIHJ9fSx7a2V5OlwiZ2V0XCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMuc2hhcmVbdF19fSx7a2V5OlwiZGlzY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29ubmVjdGVkPyh0aGlzLmNvbm5lY3RlZD0hMSx0aGlzLmNvbm5lY3Rvci5kaXNjb25uZWN0KCkpOlByb21pc2UucmVzb2x2ZSgpfX0se2tleTpcInJlY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29ubmVjdGVkP1Byb21pc2UucmVzb2x2ZSgpOih0aGlzLmNvbm5lY3RlZD0hMCx0aGlzLmNvbm5lY3Rvci5yZWNvbm5lY3QoKSl9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7QnQoWS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyksdGhpcy5zaGFyZT1udWxsLG51bGwhPXRoaXMuY29ubmVjdG9yJiYobnVsbCE9dGhpcy5jb25uZWN0b3IuZGVzdHJveT90aGlzLmNvbm5lY3Rvci5kZXN0cm95KCk6dGhpcy5jb25uZWN0b3IuZGlzY29ubmVjdCgpKSxudWxsIT09dGhpcy5wZXJzaXN0ZW5jZSYmKHRoaXMucGVyc2lzdGVuY2UuZGVpbml0KHRoaXMpLHRoaXMucGVyc2lzdGVuY2U9bnVsbCksdGhpcy5vcz1udWxsLHRoaXMuZHM9bnVsbCx0aGlzLnNzPW51bGx9fSx7a2V5OlwiX3N0YXJ0XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9LHNldDpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbH19XSksWX0oUXQpO1kuZXh0ZW5kPWZ1bmN0aW9uKCl7Zm9yKHZhciB0PTA7dDxhcmd1bWVudHMubGVuZ3RoO3QrKyl7dmFyIGU9YXJndW1lbnRzW3RdO2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYSBmdW5jdGlvbiFcIik7ZShZKX19O3ZhciByZT1mdW5jdGlvbiB0KGUsbixyKXt2YXIgaT10aGlzO0V0KHRoaXMsdCksdGhpcy5jcmVhdGVkPW5ldyBEYXRlO3ZhciBvPW4uYmVmb3JlU3RhdGU7by5oYXMoZS51c2VySUQpPyh0aGlzLnRvU3RhdGU9bmV3IFB0KGUudXNlcklELGUuc3MuZ2V0U3RhdGUoZS51c2VySUQpLTEpLHRoaXMuZnJvbVN0YXRlPW5ldyBQdChlLnVzZXJJRCxvLmdldChlLnVzZXJJRCkpKToodGhpcy50b1N0YXRlPW51bGwsdGhpcy5mcm9tU3RhdGU9bnVsbCksdGhpcy5kZWxldGVkU3RydWN0cz1uZXcgU2V0LG4uZGVsZXRlZFN0cnVjdHMuZm9yRWFjaChmdW5jdGlvbih0KXtpLmRlbGV0ZWRTdHJ1Y3RzLmFkZCh7ZnJvbTp0Ll9pZCxsZW46dC5fbGVuZ3RofSl9KSx0aGlzLmJpbmRpbmdJbmZvcz1yfSxpZT1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSl7dmFyIG49dGhpcyxyPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fTtFdCh0aGlzLHQpLHRoaXMub3B0aW9ucz1yLHRoaXMuX2JpbmRpbmdzPW5ldyBTZXQoci5iaW5kaW5ncyksci5jYXB0dXJlVGltZW91dD1udWxsPT1yLmNhcHR1cmVUaW1lb3V0PzUwMDpyLmNhcHR1cmVUaW1lb3V0LHRoaXMuX3VuZG9CdWZmZXI9W10sdGhpcy5fcmVkb0J1ZmZlcj1bXSx0aGlzLl9zY29wZT1lLHRoaXMuX3VuZG9pbmc9ITEsdGhpcy5fcmVkb2luZz0hMSx0aGlzLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSExO3ZhciBpPWUuX3k7dGhpcy55PWksaS5faGFzVW5kb01hbmFnZXI9ITA7dmFyIG89dm9pZCAwO2kub24oXCJiZWZvcmVUcmFuc2FjdGlvblwiLGZ1bmN0aW9uKHQsZSxyKXtyfHwobz1uZXcgTWFwLG4uX2JpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24odCl7by5zZXQodCx0Ll9nZXRVbmRvU3RhY2tJbmZvKCkpfSkpfSksaS5vbihcImFmdGVyVHJhbnNhY3Rpb25cIixmdW5jdGlvbih0LGksYSl7aWYoIWEmJmkuY2hhbmdlZFBhcmVudFR5cGVzLmhhcyhlKSl7dmFyIHM9bmV3IHJlKHQsaSxvKTtpZihuLl91bmRvaW5nKW4uX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITAsbi5fcmVkb0J1ZmZlci5wdXNoKHMpO2Vsc2V7dmFyIGw9bi5fdW5kb0J1ZmZlci5sZW5ndGg+MD9uLl91bmRvQnVmZmVyW24uX3VuZG9CdWZmZXIubGVuZ3RoLTFdOm51bGw7ITE9PT1uLl9yZWRvaW5nJiYhMT09PW4uX2xhc3RUcmFuc2FjdGlvbldhc1VuZG8mJm51bGwhPT1sJiYoci5jYXB0dXJlVGltZW91dDwwfHxzLmNyZWF0ZWQtbC5jcmVhdGVkPD1yLmNhcHR1cmVUaW1lb3V0KT8obC5jcmVhdGVkPXMuY3JlYXRlZCxudWxsIT09cy50b1N0YXRlJiYobC50b1N0YXRlPXMudG9TdGF0ZSxudWxsPT09bC5mcm9tU3RhdGUmJihsLmZyb21TdGF0ZT1zLmZyb21TdGF0ZSkpLHMuZGVsZXRlZFN0cnVjdHMuZm9yRWFjaChsLmRlbGV0ZWRTdHJ1Y3RzLmFkZCxsLmRlbGV0ZWRTdHJ1Y3RzKSk6KG4uX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITEsbi5fdW5kb0J1ZmZlci5wdXNoKHMpKSxuLl9yZWRvaW5nfHwobi5fcmVkb0J1ZmZlcj1bXSl9fX0pfXJldHVybiBVdCh0LFt7a2V5OlwiZmx1c2hDaGFuZ2VzXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSEwfX0se2tleTpcInVuZG9cIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX3VuZG9pbmc9ITA7dmFyIHQ9dXQodGhpcy55LHRoaXMuX3Njb3BlLHRoaXMuX3VuZG9CdWZmZXIpO3JldHVybiB0aGlzLl91bmRvaW5nPSExLHR9fSx7a2V5OlwicmVkb1wiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fcmVkb2luZz0hMDt2YXIgdD11dCh0aGlzLnksdGhpcy5fc2NvcGUsdGhpcy5fcmVkb0J1ZmZlcik7cmV0dXJuIHRoaXMuX3JlZG9pbmc9ITEsdH19XSksdH0oKSxvZT0xZTMsYWU9NjAqb2Usc2U9NjAqYWUsbGU9MjQqc2UsdWU9MzY1LjI1KmxlLGNlPWZ1bmN0aW9uKHQsZSl7ZT1lfHx7fTt2YXIgbj12b2lkIDA9PT10P1widW5kZWZpbmVkXCI6T3QodCk7aWYoXCJzdHJpbmdcIj09PW4mJnQubGVuZ3RoPjApcmV0dXJuIGh0KHQpO2lmKFwibnVtYmVyXCI9PT1uJiYhMT09PWlzTmFOKHQpKXJldHVybiBlLmxvbmc/ZHQodCk6ZnQodCk7dGhyb3cgbmV3IEVycm9yKFwidmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD1cIitKU09OLnN0cmluZ2lmeSh0KSl9LGhlPWN0KGZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXt2YXIgbixyPTA7Zm9yKG4gaW4gdClyPShyPDw1KS1yK3QuY2hhckNvZGVBdChuKSxyfD0wO3JldHVybiBlLmNvbG9yc1tNYXRoLmFicyhyKSVlLmNvbG9ycy5sZW5ndGhdfWZ1bmN0aW9uIHIodCl7ZnVuY3Rpb24gcigpe2lmKHIuZW5hYmxlZCl7dmFyIHQ9cixuPStuZXcgRGF0ZSxpPW4tKGx8fG4pO3QuZGlmZj1pLHQucHJldj1sLHQuY3Vycj1uLGw9bjtmb3IodmFyIG89bmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpLGE9MDthPG8ubGVuZ3RoO2ErKylvW2FdPWFyZ3VtZW50c1thXTtvWzBdPWUuY29lcmNlKG9bMF0pLFwic3RyaW5nXCIhPXR5cGVvZiBvWzBdJiZvLnVuc2hpZnQoXCIlT1wiKTt2YXIgcz0wO29bMF09b1swXS5yZXBsYWNlKC8lKFthLXpBLVolXSkvZyxmdW5jdGlvbihuLHIpe2lmKFwiJSVcIj09PW4pcmV0dXJuIG47cysrO3ZhciBpPWUuZm9ybWF0dGVyc1tyXTtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBpKXt2YXIgYT1vW3NdO249aS5jYWxsKHQsYSksby5zcGxpY2UocywxKSxzLS19cmV0dXJuIG59KSxlLmZvcm1hdEFyZ3MuY2FsbCh0LG8pOyhyLmxvZ3x8ZS5sb2d8fGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSkpLmFwcGx5KHQsbyl9fXJldHVybiByLm5hbWVzcGFjZT10LHIuZW5hYmxlZD1lLmVuYWJsZWQodCksci51c2VDb2xvcnM9ZS51c2VDb2xvcnMoKSxyLmNvbG9yPW4odCksXCJmdW5jdGlvblwiPT10eXBlb2YgZS5pbml0JiZlLmluaXQocikscn1mdW5jdGlvbiBpKHQpe2Uuc2F2ZSh0KSxlLm5hbWVzPVtdLGUuc2tpcHM9W107Zm9yKHZhciBuPShcInN0cmluZ1wiPT10eXBlb2YgdD90OlwiXCIpLnNwbGl0KC9bXFxzLF0rLykscj1uLmxlbmd0aCxpPTA7aTxyO2krKyluW2ldJiYodD1uW2ldLnJlcGxhY2UoL1xcKi9nLFwiLio/XCIpLFwiLVwiPT09dFswXT9lLnNraXBzLnB1c2gobmV3IFJlZ0V4cChcIl5cIit0LnN1YnN0cigxKStcIiRcIikpOmUubmFtZXMucHVzaChuZXcgUmVnRXhwKFwiXlwiK3QrXCIkXCIpKSl9ZnVuY3Rpb24gbygpe2UuZW5hYmxlKFwiXCIpfWZ1bmN0aW9uIGEodCl7dmFyIG4scjtmb3Iobj0wLHI9ZS5za2lwcy5sZW5ndGg7bjxyO24rKylpZihlLnNraXBzW25dLnRlc3QodCkpcmV0dXJuITE7Zm9yKG49MCxyPWUubmFtZXMubGVuZ3RoO248cjtuKyspaWYoZS5uYW1lc1tuXS50ZXN0KHQpKXJldHVybiEwO3JldHVybiExfWZ1bmN0aW9uIHModCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBFcnJvcj90LnN0YWNrfHx0Lm1lc3NhZ2U6dH1lPXQuZXhwb3J0cz1yLmRlYnVnPXIuZGVmYXVsdD1yLGUuY29lcmNlPXMsZS5kaXNhYmxlPW8sZS5lbmFibGU9aSxlLmVuYWJsZWQ9YSxlLmh1bWFuaXplPWNlLGUubmFtZXM9W10sZS5za2lwcz1bXSxlLmZvcm1hdHRlcnM9e307dmFyIGx9KSxmZT0oaGUuY29lcmNlLGhlLmRpc2FibGUsaGUuZW5hYmxlLGhlLmVuYWJsZWQsaGUuaHVtYW5pemUsaGUubmFtZXMsaGUuc2tpcHMsaGUuZm9ybWF0dGVycyxjdChmdW5jdGlvbih0LGUpe2Z1bmN0aW9uIG4oKXtyZXR1cm4hKFwidW5kZWZpbmVkXCI9PXR5cGVvZiB3aW5kb3d8fCF3aW5kb3cucHJvY2Vzc3x8XCJyZW5kZXJlclwiIT09d2luZG93LnByb2Nlc3MudHlwZSl8fChcInVuZGVmaW5lZFwiIT10eXBlb2YgZG9jdW1lbnQmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudCYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlJiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuV2Via2l0QXBwZWFyYW5jZXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdyYmd2luZG93LmNvbnNvbGUmJih3aW5kb3cuY29uc29sZS5maXJlYnVnfHx3aW5kb3cuY29uc29sZS5leGNlcHRpb24mJndpbmRvdy5jb25zb2xlLnRhYmxlKXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmbmF2aWdhdG9yLnVzZXJBZ2VudCYmbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykmJnBhcnNlSW50KFJlZ0V4cC4kMSwxMCk+PTMxfHxcInVuZGVmaW5lZFwiIT10eXBlb2YgbmF2aWdhdG9yJiZuYXZpZ2F0b3IudXNlckFnZW50JiZuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2FwcGxld2Via2l0XFwvKFxcZCspLykpfWZ1bmN0aW9uIHIodCl7dmFyIG49dGhpcy51c2VDb2xvcnM7aWYodFswXT0obj9cIiVjXCI6XCJcIikrdGhpcy5uYW1lc3BhY2UrKG4/XCIgJWNcIjpcIiBcIikrdFswXSsobj9cIiVjIFwiOlwiIFwiKStcIitcIitlLmh1bWFuaXplKHRoaXMuZGlmZiksbil7dmFyIHI9XCJjb2xvcjogXCIrdGhpcy5jb2xvcjt0LnNwbGljZSgxLDAscixcImNvbG9yOiBpbmhlcml0XCIpO3ZhciBpPTAsbz0wO3RbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLGZ1bmN0aW9uKHQpe1wiJSVcIiE9PXQmJihpKyssXCIlY1wiPT09dCYmKG89aSkpfSksdC5zcGxpY2UobywwLHIpfX1mdW5jdGlvbiBpKCl7cmV0dXJuXCJvYmplY3RcIj09PShcInVuZGVmaW5lZFwiPT10eXBlb2YgY29uc29sZT9cInVuZGVmaW5lZFwiOk90KGNvbnNvbGUpKSYmY29uc29sZS5sb2cmJkZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLGNvbnNvbGUsYXJndW1lbnRzKX1mdW5jdGlvbiBvKHQpe3RyeXtudWxsPT10P2Uuc3RvcmFnZS5yZW1vdmVJdGVtKFwiZGVidWdcIik6ZS5zdG9yYWdlLmRlYnVnPXR9Y2F0Y2godCl7fX1mdW5jdGlvbiBhKCl7dmFyIHQ7dHJ5e3Q9ZS5zdG9yYWdlLmRlYnVnfWNhdGNoKHQpe31yZXR1cm4hdCYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIHByb2Nlc3MmJlwiZW52XCJpbiBwcm9jZXNzJiYodD1wcm9jZXNzLmVudi5ERUJVRyksdH1lPXQuZXhwb3J0cz1oZSxlLmxvZz1pLGUuZm9ybWF0QXJncz1yLGUuc2F2ZT1vLGUubG9hZD1hLGUudXNlQ29sb3JzPW4sZS5zdG9yYWdlPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBjaHJvbWUmJnZvaWQgMCE9PWNocm9tZS5zdG9yYWdlP2Nocm9tZS5zdG9yYWdlLmxvY2FsOmZ1bmN0aW9uKCl7dHJ5e3JldHVybiB3aW5kb3cubG9jYWxTdG9yYWdlfWNhdGNoKHQpe319KCksZS5jb2xvcnM9W1wibGlnaHRzZWFncmVlblwiLFwiZm9yZXN0Z3JlZW5cIixcImdvbGRlbnJvZFwiLFwiZG9kZ2VyYmx1ZVwiLFwiZGFya29yY2hpZFwiLFwiY3JpbXNvblwiXSxlLmZvcm1hdHRlcnMuaj1mdW5jdGlvbih0KXt0cnl7cmV0dXJuIEpTT04uc3RyaW5naWZ5KHQpfWNhdGNoKHQpe3JldHVyblwiW1VuZXhwZWN0ZWRKU09OUGFyc2VFcnJvcl06IFwiK3QubWVzc2FnZX19LGUuZW5hYmxlKGEoKSl9KSksZGU9KGZlLmxvZyxmZS5mb3JtYXRBcmdzLGZlLnNhdmUsZmUubG9hZCxmZS51c2VDb2xvcnMsZmUuc3RvcmFnZSxmZS5jb2xvcnMsZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7aWYoRXQodGhpcyx0KSx0aGlzLnk9ZSx0aGlzLm9wdHM9bixudWxsPT1uLnJvbGV8fFwibWFzdGVyXCI9PT1uLnJvbGUpdGhpcy5yb2xlPVwibWFzdGVyXCI7ZWxzZXtpZihcInNsYXZlXCIhPT1uLnJvbGUpdGhyb3cgbmV3IEVycm9yKFwiUm9sZSBtdXN0IGJlIGVpdGhlciAnbWFzdGVyJyBvciAnc2xhdmUnIVwiKTt0aGlzLnJvbGU9XCJzbGF2ZVwifXRoaXMubG9nPWZlKFwieTpjb25uZWN0b3JcIiksdGhpcy5sb2dNZXNzYWdlPWZlKFwieTpjb25uZWN0b3ItbWVzc2FnZVwiKSx0aGlzLl9mb3J3YXJkQXBwbGllZFN0cnVjdHM9bi5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnN8fCExLHRoaXMucm9sZT1uLnJvbGUsdGhpcy5jb25uZWN0aW9ucz1uZXcgTWFwLHRoaXMuaXNTeW5jZWQ9ITEsdGhpcy51c2VyRXZlbnRMaXN0ZW5lcnM9W10sdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLHRoaXMuY3VycmVudFN5bmNUYXJnZXQ9bnVsbCx0aGlzLmRlYnVnPSEwPT09bi5kZWJ1Zyx0aGlzLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgQ3QsdGhpcy5icm9hZGNhc3RCdWZmZXJTaXplPTAsdGhpcy5wcm90b2NvbFZlcnNpb249MTEsdGhpcy5hdXRoSW5mbz1uLmF1dGh8fG51bGwsdGhpcy5jaGVja0F1dGg9bi5jaGVja0F1dGh8fGZ1bmN0aW9uKCl7cmV0dXJuIFByb21pc2UucmVzb2x2ZShcIndyaXRlXCIpfSxudWxsPT1uLm1heEJ1ZmZlckxlbmd0aD90aGlzLm1heEJ1ZmZlckxlbmd0aD0tMTp0aGlzLm1heEJ1ZmZlckxlbmd0aD1uLm1heEJ1ZmZlckxlbmd0aH1yZXR1cm4gVXQodCxbe2tleTpcInJlY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5sb2coXCJyZWNvbm5lY3RpbmcuLlwiKX19LHtrZXk6XCJkaXNjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5sb2coXCJkaXNjcm9ubmVjdGluZy4uXCIpLHRoaXMuY29ubmVjdGlvbnM9bmV3IE1hcCx0aGlzLmlzU3luY2VkPSExLHRoaXMuY3VycmVudFN5bmNUYXJnZXQ9bnVsbCx0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnM9W10sUHJvbWlzZS5yZXNvbHZlKCl9fSx7a2V5Olwib25Vc2VyRXZlbnRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnVzZXJFdmVudExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcInJlbW92ZVVzZXJFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnM9dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiB0IT09ZX0pfX0se2tleTpcInVzZXJMZWZ0XCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodGhpcy5jb25uZWN0aW9ucy5oYXModCkpe3RoaXMubG9nKFwiJXM6IFVzZXIgbGVmdCAlc1wiLHRoaXMueS51c2VySUQsdCksdGhpcy5jb25uZWN0aW9ucy5kZWxldGUodCksdGhpcy5fc2V0U3luY2VkV2l0aChudWxsKTt2YXIgZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLnVzZXJFdmVudExpc3RlbmVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXsoMCxpLnZhbHVlKSh7YWN0aW9uOlwidXNlckxlZnRcIix1c2VyOnR9KX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX19fX0se2tleTpcInVzZXJKb2luZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7aWYobnVsbD09ZSl0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciFcIik7aWYodGhpcy5jb25uZWN0aW9ucy5oYXModCkpdGhyb3cgbmV3IEVycm9yKFwiVGhpcyB1c2VyIGFscmVhZHkgam9pbmVkIVwiKTt0aGlzLmxvZyhcIiVzOiBVc2VyIGpvaW5lZCAlc1wiLHRoaXMueS51c2VySUQsdCksdGhpcy5jb25uZWN0aW9ucy5zZXQodCx7dWlkOnQsaXNTeW5jZWQ6ITEscm9sZTplLHByb2Nlc3NBZnRlckF1dGg6W10scHJvY2Vzc0FmdGVyU3luYzpbXSxhdXRoOm58fG51bGwscmVjZWl2ZWRTeW5jU3RlcDI6ITF9KTt2YXIgcj17fTtyLnByb21pc2U9bmV3IFByb21pc2UoZnVuY3Rpb24odCl7ci5yZXNvbHZlPXR9KSx0aGlzLmNvbm5lY3Rpb25zLmdldCh0KS5zeW5jU3RlcDI9cjt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD10aGlzLnVzZXJFdmVudExpc3RlbmVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IShpPShzPWwubmV4dCgpKS5kb25lKTtpPSEwKXsoMCxzLnZhbHVlKSh7YWN0aW9uOlwidXNlckpvaW5lZFwiLHVzZXI6dCxyb2xlOmV9KX19Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX10aGlzLl9zeW5jV2l0aFVzZXIodCl9fSx7a2V5Olwid2hlblN5bmNlZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuaXNTeW5jZWQ/dCgpOnRoaXMud2hlblN5bmNlZExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcIl9zeW5jV2l0aFVzZXJcIix2YWx1ZTpmdW5jdGlvbih0KXtcInNsYXZlXCIhPT10aGlzLnJvbGUmJnUodGhpcyx0KX19LHtrZXk6XCJfZmlyZUlzU3luY2VkTGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24oKXtpZighdGhpcy5pc1N5bmNlZCl7dGhpcy5pc1N5bmNlZD0hMDt2YXIgdD0hMCxlPSExLG49dm9pZCAwO3RyeXtmb3IodmFyIHIsaT10aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEodD0ocj1pLm5leHQoKSkuZG9uZSk7dD0hMCl7KDAsci52YWx1ZSkoKX19Y2F0Y2godCl7ZT0hMCxuPXR9ZmluYWxseXt0cnl7IXQmJmkucmV0dXJuJiZpLnJldHVybigpfWZpbmFsbHl7aWYoZSl0aHJvdyBufX10aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnM9W10sdGhpcy55Ll9zZXRDb250ZW50UmVhZHkoKSx0aGlzLnkuZW1pdChcInN5bmNlZFwiKX19fSx7a2V5Olwic2VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55O2lmKCEoZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyfHxlIGluc3RhbmNlb2YgVWludDhBcnJheSkpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IC0gZG9uJ3QgdXNlIHRoaXMgbWV0aG9kIHRvIHNlbmQgY3VzdG9tIG1lc3NhZ2VzXCIpO3RoaXMubG9nKFwiVXNlciVzIHRvIFVzZXIlczogU2VuZCAnJXknXCIsbi51c2VySUQsdCxlKSx0aGlzLmxvZ01lc3NhZ2UoXCJVc2VyJXMgdG8gVXNlciVzOiBTZW5kICVZXCIsbi51c2VySUQsdCxbbixlXSl9fSx7a2V5OlwiYnJvYWRjYXN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy55O2lmKCEodCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyfHx0IGluc3RhbmNlb2YgVWludDhBcnJheSkpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IC0gZG9uJ3QgdXNlIHRoaXMgbWV0aG9kIHRvIHNlbmQgY3VzdG9tIG1lc3NhZ2VzXCIpO3RoaXMubG9nKFwiVXNlciVzOiBCcm9hZGNhc3QgJyV5J1wiLGUudXNlcklELHQpLHRoaXMubG9nTWVzc2FnZShcIlVzZXIlczogQnJvYWRjYXN0OiAlWVwiLGUudXNlcklELFtlLHRdKX19LHtrZXk6XCJicm9hZGNhc3RTdHJ1Y3RcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49MD09PXRoaXMuYnJvYWRjYXN0QnVmZmVyLmxlbmd0aDtpZihuJiYodGhpcy5icm9hZGNhc3RCdWZmZXIud3JpdGVWYXJTdHJpbmcodGhpcy55LnJvb20pLHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVmFyU3RyaW5nKFwidXBkYXRlXCIpLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZT0wLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcz10aGlzLmJyb2FkY2FzdEJ1ZmZlci5wb3MsdGhpcy5icm9hZGNhc3RCdWZmZXIud3JpdGVVaW50MzIoMCkpLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZSsrLHQuX3RvQmluYXJ5KHRoaXMuYnJvYWRjYXN0QnVmZmVyKSx0aGlzLm1heEJ1ZmZlckxlbmd0aD4wJiZ0aGlzLmJyb2FkY2FzdEJ1ZmZlci5sZW5ndGg+dGhpcy5tYXhCdWZmZXJMZW5ndGgpe3ZhciByPXRoaXMuYnJvYWRjYXN0QnVmZmVyO3Iuc2V0VWludDMyKHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcyx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemUpLHRoaXMuYnJvYWRjYXN0QnVmZmVyPW5ldyBDdCx0aGlzLndoZW5SZW1vdGVSZXNwb25zaXZlKCkudGhlbihmdW5jdGlvbigpe2UuYnJvYWRjYXN0KHIuY3JlYXRlQnVmZmVyKCkpfSl9ZWxzZSBuJiZzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7aWYoZS5icm9hZGNhc3RCdWZmZXIubGVuZ3RoPjApe3ZhciB0PWUuYnJvYWRjYXN0QnVmZmVyO3Quc2V0VWludDMyKGUuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcyxlLmJyb2FkY2FzdEJ1ZmZlclNpemUpLGUuYnJvYWRjYXN0KHQuY3JlYXRlQnVmZmVyKCkpLGUuYnJvYWRjYXN0QnVmZmVyPW5ldyBDdH19LDApfX0se2tleTpcIndoZW5SZW1vdGVSZXNwb25zaXZlXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24odCl7c2V0VGltZW91dCh0LDEwMCl9KX19LHtrZXk6XCJyZWNlaXZlTWVzc2FnZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgcj10aGlzLGk9dGhpcy55LG89aS51c2VySUQ7aWYobj1ufHwhMSwhKGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJFeHBlY3RlZCBNZXNzYWdlIHRvIGJlIGFuIEFycmF5QnVmZmVyIG9yIFVpbnQ4QXJyYXkhXCIpKTtpZih0PT09bylyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7dmFyIGE9bmV3IFZ0KGUpLHM9bmV3IEN0LGw9YS5yZWFkVmFyU3RyaW5nKCk7cy53cml0ZVZhclN0cmluZyhsKTt2YXIgdT1hLnJlYWRWYXJTdHJpbmcoKSxjPXRoaXMuY29ubmVjdGlvbnMuZ2V0KHQpO2lmKHRoaXMubG9nKFwiVXNlciVzIGZyb20gVXNlciVzOiBSZWNlaXZlICclcydcIixvLHQsdSksdGhpcy5sb2dNZXNzYWdlKFwiVXNlciVzIGZyb20gVXNlciVzOiBSZWNlaXZlICVZXCIsbyx0LFtpLGVdKSxudWxsPT1jJiYhbil0aHJvdyBuZXcgRXJyb3IoXCJSZWNlaXZlZCBtZXNzYWdlIGZyb20gdW5rbm93biBwZWVyIVwiKTtpZihcInN5bmMgc3RlcCAxXCI9PT11fHxcInN5bmMgc3RlcCAyXCI9PT11KXt2YXIgaD1hLnJlYWRWYXJVaW50KCk7aWYobnVsbD09Yy5hdXRoKXJldHVybiBjLnByb2Nlc3NBZnRlckF1dGgucHVzaChbdSxjLGEscyx0XSksdGhpcy5jaGVja0F1dGgoaCxpLHQpLnRoZW4oZnVuY3Rpb24odCl7bnVsbD09Yy5hdXRoJiYoYy5hdXRoPXQsaS5lbWl0KFwidXNlckF1dGhlbnRpY2F0ZWRcIix7dXNlcjpjLnVpZCxhdXRoOnR9KSk7dmFyIGU9Yy5wcm9jZXNzQWZ0ZXJBdXRoO2MucHJvY2Vzc0FmdGVyQXV0aD1bXSxlLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIHIuY29tcHV0ZU1lc3NhZ2UodFswXSx0WzFdLHRbMl0sdFszXSx0WzRdKX0pfSl9IW4mJm51bGw9PWMuYXV0aHx8XCJ1cGRhdGVcIj09PXUmJiFjLmlzU3luY2VkP2MucHJvY2Vzc0FmdGVyU3luYy5wdXNoKFt1LGMsYSxzLHQsITFdKTp0aGlzLmNvbXB1dGVNZXNzYWdlKHUsYyxhLHMsdCxuKX19LHtrZXk6XCJjb21wdXRlTWVzc2FnZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuLGksbyxhKXtpZihcInN5bmMgc3RlcCAxXCIhPT10fHxcIndyaXRlXCIhPT1lLmF1dGgmJlwicmVhZFwiIT09ZS5hdXRoKXt2YXIgcz10aGlzLnk7cy50cmFuc2FjdChmdW5jdGlvbigpe2lmKFwic3luYyBzdGVwIDJcIj09PXQmJlwid3JpdGVcIj09PWUuYXV0aClkKG4saSxzLGUsbyk7ZWxzZXtpZihcInVwZGF0ZVwiIT09dHx8IWEmJlwid3JpdGVcIiE9PWUuYXV0aCl0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmVjZWl2ZSBtZXNzYWdlXCIpO3IocyxuKX19LCEwKX1lbHNlIGgobixpLHRoaXMueSxlLG8pfX0se2tleTpcIl9zZXRTeW5jZWRXaXRoXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcztpZihudWxsIT10KXt2YXIgbj10aGlzLmNvbm5lY3Rpb25zLmdldCh0KTtuLmlzU3luY2VkPSEwO3ZhciByPW4ucHJvY2Vzc0FmdGVyU3luYztuLnByb2Nlc3NBZnRlclN5bmM9W10sci5mb3JFYWNoKGZ1bmN0aW9uKHQpe2UuY29tcHV0ZU1lc3NhZ2UodFswXSx0WzFdLHRbMl0sdFszXSx0WzRdKX0pfXZhciBpPUFycmF5LmZyb20odGhpcy5jb25uZWN0aW9ucy52YWx1ZXMoKSk7aS5sZW5ndGg+MCYmaS5ldmVyeShmdW5jdGlvbih0KXtyZXR1cm4gdC5pc1N5bmNlZH0pJiZ0aGlzLl9maXJlSXNTeW5jZWRMaXN0ZW5lcnMoKX19XSksdH0oKSksX2U9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe0V0KHRoaXMsdCksdGhpcy5vcHRzPWUsdGhpcy55cz1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwiX2luaXRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49dGhpcy55cy5nZXQodCk7cmV0dXJuIHZvaWQgMD09PW4/KG49eXQoKSxuLm11dHVhbEV4Y2x1ZGU9SygpLHRoaXMueXMuc2V0KHQsbiksdGhpcy5pbml0KHQpLnRoZW4oZnVuY3Rpb24oKXtyZXR1cm4gdC5vbihcImFmdGVyVHJhbnNhY3Rpb25cIixmdW5jdGlvbih0LG4pe3ZhciByPWUueXMuZ2V0KHQpO2lmKHIubGVuPjApe3IuYnVmZmVyLnNldFVpbnQzMigwLHIubGVuKSxlLnNhdmVVcGRhdGUodCxyLmJ1ZmZlci5jcmVhdGVCdWZmZXIoKSxuKTt2YXIgaT15dCgpO2Zvcih2YXIgbyBpbiBpKXJbb109aVtvXX19KSxlLnJldHJpZXZlKHQpfSkudGhlbihmdW5jdGlvbigpe3JldHVybiBQcm9taXNlLnJlc29sdmUobil9KSk6UHJvbWlzZS5yZXNvbHZlKG4pfX0se2tleTpcImRlaW5pdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMueXMuZGVsZXRlKHQpLHQucGVyc2lzdGVuY2U9bnVsbH19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnlzPW51bGx9fSx7a2V5OlwicmVtb3ZlUGVyc2lzdGVkRGF0YVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj0hKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdKXx8YXJndW1lbnRzWzFdO3RoaXMueXMuZm9yRWFjaChmdW5jdGlvbihyLGkpe2kucm9vbT09PXQmJihuP2kuZGVzdHJveSgpOmUuZGVpbml0KGkpKX0pfX0se2tleTpcInNhdmVVcGRhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXt9fSx7a2V5Olwic2F2ZVN0cnVjdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55cy5nZXQodCk7dm9pZCAwIT09biYmbi5tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7ZS5fdG9CaW5hcnkobi5idWZmZXIpLG4ubGVuKyt9KX19LHtrZXk6XCJyZXRyaWV2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgaT10aGlzLnlzLmdldCh0KTt2b2lkIDAhPT1pJiZpLm11dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt0LnRyYW5zYWN0KGZ1bmN0aW9uKCl7aWYobnVsbCE9ZSYmdnQodCxuZXcgVnQobmV3IFVpbnQ4QXJyYXkoZSkpKSxudWxsIT1uKWZvcih2YXIgaT0wO2k8bi5sZW5ndGg7aSsrKXIodCxuZXcgVnQobmV3IFVpbnQ4QXJyYXkobltpXSkpKX0pLHQuZW1pdChcInBlcnNpc3RlbmNlUmVhZHlcIil9KX19LHtrZXk6XCJwZXJzaXN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHB0KHQpLmNyZWF0ZUJ1ZmZlcigpfX1dKSx0fSgpLHZlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXtFdCh0aGlzLGUpO3ZhciByPUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtyZXR1cm4gbi52YWx1ZT10LnRvU3RyaW5nKCksci5fdHlwZU9ic2VydmVyPWd0LmJpbmQociksci5fZG9tT2JzZXJ2ZXI9bXQuYmluZChyKSx0Lm9ic2VydmUoci5fdHlwZU9ic2VydmVyKSxuLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLHIuX2RvbU9ic2VydmVyKSxyfXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnR5cGUudW5vYnNlcnZlKHRoaXMuX3R5cGVPYnNlcnZlciksdGhpcy50YXJnZXQudW5vYnNlcnZlKHRoaXMuX2RvbU9ic2VydmVyKSxCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0oS3QpLHBlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXtFdCh0aGlzLGUpO3ZhciByPUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtyZXR1cm4gbi5zZXRDb250ZW50cyh0LnRvRGVsdGEoKSxcInlqc1wiKSxyLl90eXBlT2JzZXJ2ZXI9a3QuYmluZChyKSxyLl9xdWlsbE9ic2VydmVyPWJ0LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5vbihcInRleHQtY2hhbmdlXCIsci5fcXVpbGxPYnNlcnZlcikscn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0Lm9mZihcInRleHQtY2hhbmdlXCIsdGhpcy5fcXVpbGxPYnNlcnZlciksQnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KEt0KSx5ZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7RXQodGhpcyxlKTt2YXIgcj1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4uc2V0VmFsdWUodC50b1N0cmluZygpKSxyLl90eXBlT2JzZXJ2ZXI9d3QuYmluZChyKSxyLl9jb2RlTWlycm9yT2JzZXJ2ZXI9U3QuYmluZChyKSx0Lm9ic2VydmUoci5fdHlwZU9ic2VydmVyKSxuLm9uKFwiY2hhbmdlc1wiLHIuX2NvZGVNaXJyb3JPYnNlcnZlcikscn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0LnVub2JzZXJ2ZSh0aGlzLl9jb2RlTWlycm9yT2JzZXJ2ZXIpLEJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShLdCk7cmV0dXJuIFkuQWJzdHJhY3RDb25uZWN0b3I9ZGUsWS5BYnN0cmFjdFBlcnNpc3RlbmNlPV9lLFkuQXJyYXk9WUFycmF5LFkuTWFwPVlNYXAsWS5UZXh0PVlUZXh0LFkuWG1sRWxlbWVudD1ZWG1sRWxlbWVudCxZLlhtbEZyYWdtZW50PVlYbWxGcmFnbWVudCxZLlhtbFRleHQ9WVhtbFRleHQsWS5YbWxIb29rPVlYbWxIb29rLFkuVGV4dGFyZWFCaW5kaW5nPXZlLFkuUXVpbGxCaW5kaW5nPXBlLFkuRG9tQmluZGluZz1uZSxZLkNvZGVNaXJyb3JCaW5kaW5nPXllLG5lLmRvbVRvVHlwZT1MLG5lLmRvbXNUb1R5cGVzPUosbmUuc3dpdGNoQXNzb2NpYXRpb249VyxZLnV0aWxzPXtCaW5hcnlEZWNvZGVyOlZ0LFVuZG9NYW5hZ2VyOmllLGdldFJlbGF0aXZlUG9zaXRpb246Wixmcm9tUmVsYXRpdmVQb3NpdGlvbjpRLHJlZ2lzdGVyU3RydWN0OlgsaW50ZWdyYXRlUmVtb3RlU3RydWN0czpyLHRvQmluYXJ5OnB0LGZyb21CaW5hcnk6dnR9LFkuZGVidWc9ZmUsZmUuZm9ybWF0dGVycy5ZPV8sZmUuZm9ybWF0dGVycy55PXYsWX0pO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eS5qcy5tYXBcbiIsInZhciBZID0gcmVxdWlyZSgneWpzJyk7XG53aW5kb3cuWSA9IFk7XG5yZXF1aXJlKCd5LXdlYnJ0YzMnKShZKTtcblxubGV0IHkgPSBuZXcgWSgneW5vdGVib29rJywge1xuICAgIGNvbm5lY3Rvcjoge1xuICAgICAgICBuYW1lOiAnd2VicnRjJyxcbiAgICAgICAgcm9vbTogJ2RpbmVzaCcsXG4gICAgICAgIHVybDogJ2h0dHA6Ly9maW53aW4uaW86MTI1NidcbiAgICB9XG59KTtcbndpbmRvdy55ID0geTtcblxuZm9yICh2YXIgaWQgaW4gc2hhcmVkX2VsZW1lbnRzKSB7XG4gICAgdmFyIGNvZGVtaXJyb3IgPSBzaGFyZWRfZWxlbWVudHNbaWRdWydjb2RlbWlycm9yJ107XG4gICAgdmFyIG91dHB1dCA9IHNoYXJlZF9lbGVtZW50c1tpZF1bJ291dHB1dCddO1xuICAgIG5ldyBZLkNvZGVNaXJyb3JCaW5kaW5nKHkuZGVmaW5lKCdjb2RlbWlycm9yJytpZCwgWS5UZXh0KSwgY29kZW1pcnJvcik7XG4gICAgbmV3IFkuRG9tQmluZGluZyh5LmRlZmluZSgneG1sJytpZCwgWS5YbWxGcmFnbWVudCksIG91dHB1dCk7XG59XG5cbndpbmRvdy5yZXNvbHZlX3ltYXAgPSB0cnVlO1xudmFyIHltYXAgPSB5LmRlZmluZSgneW1hcCcsIFkuTWFwKTtcbnltYXAub2JzZXJ2ZShmdW5jdGlvbiAoZSkge1xuICAgIGV4ZWNfeW1hcCgpO1xuICAgIGlmICh3aW5kb3cucmVzb2x2ZV95bWFwKSB7XG4gICAgICAgIHdpbmRvdy5yZXNvbHZlX3ltYXAgPSBmYWxzZTtcbiAgICAgICAgZXhlY195bWFwKCk7XG4gICAgfVxufSk7XG53aW5kb3cueW1hcCA9IHltYXA7XG5cbmZ1bmN0aW9uIGV4ZWNfeW1hcCgpIHtcbiAgICBpZiAodHlwZW9mIEp1cHl0ZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBKdXB5dGVyLm5vdGVib29rICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIga2V5cyA9IHltYXAua2V5cygpO1xuICAgICAgICBmb3IgKHZhciBpbmRleCBpbiBrZXlzKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBrZXlzW2luZGV4XTtcbiAgICAgICAgICAgIHNldF9jZWxsKGlkLCB5bWFwLmdldChpZClbJ2luZGV4J10sIHltYXAuZ2V0KGlkKVsnYWN0aXZlJ10pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0VGltZW91dChleGVjX3ltYXAsIDApO1xuICAgIH1cbn1cblxud2luZG93LmdldF9pbmFjdGl2ZV9jZWxsID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgY2VsbHMgPSBKdXB5dGVyLm5vdGVib29rLmdldF9jZWxscygpO1xuICAgIGZvciAodmFyIGk9MDsgaTxjZWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoY2VsbHNbaV0uY2VsbF90eXBlID09PSB0eXBlICYmIGNlbGxzW2ldLm1ldGFkYXRhLmFjdGl2ZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBjZWxsc1tpXTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxud2luZG93LmdldF9jZWxsID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIGNlbGxzID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKTtcbiAgICBmb3IgKHZhciBpPTA7IGk8Y2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGNlbGxzW2ldLm1ldGFkYXRhLmlkID09PSBpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNlbGxzW2ldO1xuICAgICAgICB9XG4gICAgfVxufVxuXG53aW5kb3cuc2V0X2NlbGwgPSBmdW5jdGlvbiAoaWQsIGluZGV4LCBhY3RpdmUpIHtcbiAgICBmdW5jdGlvbiBzZXRfZWxlbWVudChlbGVtZW50LCBpbmRleCkge1xuICAgICAgICB2YXIgdG8gPSAkKCcjbm90ZWJvb2stY29udGFpbmVyJyk7XG4gICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgdG8ucHJlcGVuZChlbGVtZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvLmNoaWxkcmVuKCkuZXEoaW5kZXgtMSkuYWZ0ZXIoZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgY2VsbCA9IGdldF9jZWxsKHBhcnNlSW50KGlkKSk7XG4gICAgc2V0X2VsZW1lbnQoY2VsbC5lbGVtZW50LCBpbmRleCk7XG4gICAgaWYgKGFjdGl2ZSkge1xuICAgICAgICBjZWxsLm1ldGFkYXRhLmFjdGl2ZSA9IHRydWU7XG4gICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIGNlbGwuZm9jdXNfY2VsbCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNlbGwuZWxlbWVudC5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIGNlbGwuc2V0X3RleHQoJycpO1xuICAgICAgICBpZiAoY2VsbC5jZWxsX3R5cGUgPT09ICdjb2RlJykge1xuICAgICAgICAgICAgY2VsbC5vdXRwdXRfYXJlYS5jbGVhcl9vdXRwdXQoKTtcbiAgICAgICAgfVxuICAgICAgICBjZWxsLm1ldGFkYXRhLmFjdGl2ZSA9IGZhbHNlO1xuICAgIH1cbn1cbiJdfQ==

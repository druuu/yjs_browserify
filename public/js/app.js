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

var notebook_name = document.getElementsByTagName('body')[0].getAttribute('data-notebook-name');
var y = new Y(notebook_name, {
    connector: {
        name: 'webrtc',
        room: notebook_name,
        url: 'http://finwin.io:1256'
    }
});
window.y = y;

function start_ybindings() {
    if (typeof window.shared_elements_available !== 'undefined') {
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
    } else {
        setTimeout(start_ybindings, 0);
    }
}
start_ybindings();

},{"y-webrtc3":5,"yjs":6}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMveS13ZWJydGMuanMiLCJub2RlX21vZHVsZXMveWpzL3kuanMiLCJzcmMvYXBwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG52YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgbG9va3VwW2ldID0gY29kZVtpXVxuICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbn1cblxuLy8gU3VwcG9ydCBkZWNvZGluZyBVUkwtc2FmZSBiYXNlNjQgc3RyaW5ncywgYXMgTm9kZS5qcyBkb2VzLlxuLy8gU2VlOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYXNlNjQjVVJMX2FwcGxpY2F0aW9uc1xucmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG5yZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcblxuZnVuY3Rpb24gZ2V0TGVucyAoYjY0KSB7XG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIFRyaW0gb2ZmIGV4dHJhIGJ5dGVzIGFmdGVyIHBsYWNlaG9sZGVyIGJ5dGVzIGFyZSBmb3VuZFxuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iZWF0Z2FtbWl0L2Jhc2U2NC1qcy9pc3N1ZXMvNDJcbiAgdmFyIHZhbGlkTGVuID0gYjY0LmluZGV4T2YoJz0nKVxuICBpZiAodmFsaWRMZW4gPT09IC0xKSB2YWxpZExlbiA9IGxlblxuXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSB2YWxpZExlbiA9PT0gbGVuXG4gICAgPyAwXG4gICAgOiA0IC0gKHZhbGlkTGVuICUgNClcblxuICByZXR1cm4gW3ZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW5dXG59XG5cbi8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoYjY0KSB7XG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIF9ieXRlTGVuZ3RoIChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pIHtcbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVucyA9IGdldExlbnMoYjY0KVxuICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdXG5cbiAgdmFyIGFyciA9IG5ldyBBcnIoX2J5dGVMZW5ndGgoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSlcblxuICB2YXIgY3VyQnl0ZSA9IDBcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIHZhciBsZW4gPSBwbGFjZUhvbGRlcnNMZW4gPiAwXG4gICAgPyB2YWxpZExlbiAtIDRcbiAgICA6IHZhbGlkTGVuXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfFxuICAgICAgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDIpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAxKSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID1cbiAgICAgICgodWludDhbaV0gPDwgMTYpICYgMHhGRjAwMDApICtcbiAgICAgICgodWludDhbaSArIDFdIDw8IDgpICYgMHhGRjAwKSArXG4gICAgICAodWludDhbaSArIDJdICYgMHhGRilcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayhcbiAgICAgIHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aClcbiAgICApKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXSArXG4gICAgICAnPT0nXG4gICAgKVxuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyB1aW50OFtsZW4gLSAxXVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBsb29rdXBbdG1wID4+IDEwXSArXG4gICAgICBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdICtcbiAgICAgIGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl0gK1xuICAgICAgJz0nXG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcblxudmFyIEtfTUFYX0xFTkdUSCA9IDB4N2ZmZmZmZmZcbmV4cG9ydHMua01heExlbmd0aCA9IEtfTUFYX0xFTkdUSFxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBQcmludCB3YXJuaW5nIGFuZCByZWNvbW1lbmQgdXNpbmcgYGJ1ZmZlcmAgdjQueCB3aGljaCBoYXMgYW4gT2JqZWN0XG4gKiAgICAgICAgICAgICAgIGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBXZSByZXBvcnQgdGhhdCB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBpZiB0aGUgYXJlIG5vdCBzdWJjbGFzc2FibGVcbiAqIHVzaW5nIF9fcHJvdG9fXy4gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWBcbiAqIChTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOCkuIElFIDEwIGxhY2tzIHN1cHBvcnRcbiAqIGZvciBfX3Byb3RvX18gYW5kIGhhcyBhIGJ1Z2d5IHR5cGVkIGFycmF5IGltcGxlbWVudGF0aW9uLlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICBjb25zb2xlLmVycm9yKFxuICAgICdUaGlzIGJyb3dzZXIgbGFja3MgdHlwZWQgYXJyYXkgKFVpbnQ4QXJyYXkpIHN1cHBvcnQgd2hpY2ggaXMgcmVxdWlyZWQgYnkgJyArXG4gICAgJ2BidWZmZXJgIHY1LnguIFVzZSBgYnVmZmVyYCB2NC54IGlmIHlvdSByZXF1aXJlIG9sZCBicm93c2VyIHN1cHBvcnQuJ1xuICApXG59XG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgLy8gQ2FuIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkP1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5fX3Byb3RvX18gPSB7X19wcm90b19fOiBVaW50OEFycmF5LnByb3RvdHlwZSwgZm9vOiBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9fVxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLnByb3RvdHlwZSwgJ3BhcmVudCcsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyXG4gIH1cbn0pXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAnb2Zmc2V0Jywge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5ieXRlT2Zmc2V0XG4gIH1cbn0pXG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1ZmZlciAobGVuZ3RoKSB7XG4gIGlmIChsZW5ndGggPiBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCB0eXBlZCBhcnJheSBsZW5ndGgnKVxuICB9XG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIHZhciBidWYgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuXG5mdW5jdGlvbiBCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdJZiBlbmNvZGluZyBpcyBzcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZydcbiAgICAgIClcbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jVW5zYWZlKGFyZylcbiAgfVxuICByZXR1cm4gZnJvbShhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuLy8gRml4IHN1YmFycmF5KCkgaW4gRVMyMDE2LiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvOTdcbmlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuc3BlY2llcyAmJlxuICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgIHZhbHVlOiBudWxsLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICB3cml0YWJsZTogZmFsc2VcbiAgfSlcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbmZ1bmN0aW9uIGZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKGlzQXJyYXlCdWZmZXIodmFsdWUpIHx8ICh2YWx1ZSAmJiBpc0FycmF5QnVmZmVyKHZhbHVlLmJ1ZmZlcikpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIHJldHVybiBmcm9tT2JqZWN0KHZhbHVlKVxufVxuXG4vKipcbiAqIEZ1bmN0aW9uYWxseSBlcXVpdmFsZW50IHRvIEJ1ZmZlcihhcmcsIGVuY29kaW5nKSBidXQgdGhyb3dzIGEgVHlwZUVycm9yXG4gKiBpZiB2YWx1ZSBpcyBhIG51bWJlci5cbiAqIEJ1ZmZlci5mcm9tKHN0clssIGVuY29kaW5nXSlcbiAqIEJ1ZmZlci5mcm9tKGFycmF5KVxuICogQnVmZmVyLmZyb20oYnVmZmVyKVxuICogQnVmZmVyLmZyb20oYXJyYXlCdWZmZXJbLCBieXRlT2Zmc2V0WywgbGVuZ3RoXV0pXG4gKiovXG5CdWZmZXIuZnJvbSA9IGZ1bmN0aW9uICh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBmcm9tKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIE5vdGU6IENoYW5nZSBwcm90b3R5cGUgKmFmdGVyKiBCdWZmZXIuZnJvbSBpcyBkZWZpbmVkIHRvIHdvcmthcm91bmQgQ2hyb21lIGJ1Zzpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL3B1bGwvMTQ4XG5CdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG5CdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuXG5mdW5jdGlvbiBhc3NlcnRTaXplIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgbnVtYmVyJylcbiAgfSBlbHNlIGlmIChzaXplIDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBuZWdhdGl2ZScpXG4gIH1cbn1cblxuZnVuY3Rpb24gYWxsb2MgKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgaWYgKHNpemUgPD0gMCkge1xuICAgIHJldHVybiBjcmVhdGVCdWZmZXIoc2l6ZSlcbiAgfVxuICBpZiAoZmlsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gT25seSBwYXkgYXR0ZW50aW9uIHRvIGVuY29kaW5nIGlmIGl0J3MgYSBzdHJpbmcuIFRoaXNcbiAgICAvLyBwcmV2ZW50cyBhY2NpZGVudGFsbHkgc2VuZGluZyBpbiBhIG51bWJlciB0aGF0IHdvdWxkXG4gICAgLy8gYmUgaW50ZXJwcmV0dGVkIGFzIGEgc3RhcnQgb2Zmc2V0LlxuICAgIHJldHVybiB0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnXG4gICAgICA/IGNyZWF0ZUJ1ZmZlcihzaXplKS5maWxsKGZpbGwsIGVuY29kaW5nKVxuICAgICAgOiBjcmVhdGVCdWZmZXIoc2l6ZSkuZmlsbChmaWxsKVxuICB9XG4gIHJldHVybiBjcmVhdGVCdWZmZXIoc2l6ZSlcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IGZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiBhbGxvYyhzaXplWywgZmlsbFssIGVuY29kaW5nXV0pXG4gKiovXG5CdWZmZXIuYWxsb2MgPSBmdW5jdGlvbiAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGFsbG9jKHNpemUsIGZpbGwsIGVuY29kaW5nKVxufVxuXG5mdW5jdGlvbiBhbGxvY1Vuc2FmZSAoc2l6ZSkge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIHJldHVybiBjcmVhdGVCdWZmZXIoc2l6ZSA8IDAgPyAwIDogY2hlY2tlZChzaXplKSB8IDApXG59XG5cbi8qKlxuICogRXF1aXZhbGVudCB0byBCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqICovXG5CdWZmZXIuYWxsb2NVbnNhZmUgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUoc2l6ZSlcbn1cbi8qKlxuICogRXF1aXZhbGVudCB0byBTbG93QnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUoc2l6ZSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gIH1cblxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW5ndGgpXG5cbiAgdmFyIGFjdHVhbCA9IGJ1Zi53cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuXG4gIGlmIChhY3R1YWwgIT09IGxlbmd0aCkge1xuICAgIC8vIFdyaXRpbmcgYSBoZXggc3RyaW5nLCBmb3IgZXhhbXBsZSwgdGhhdCBjb250YWlucyBpbnZhbGlkIGNoYXJhY3RlcnMgd2lsbFxuICAgIC8vIGNhdXNlIGV2ZXJ5dGhpbmcgYWZ0ZXIgdGhlIGZpcnN0IGludmFsaWQgY2hhcmFjdGVyIHRvIGJlIGlnbm9yZWQuIChlLmcuXG4gICAgLy8gJ2FieHhjZCcgd2lsbCBiZSB0cmVhdGVkIGFzICdhYicpXG4gICAgYnVmID0gYnVmLnNsaWNlKDAsIGFjdHVhbClcbiAgfVxuXG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAoYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCA8IDAgPyAwIDogY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIGJ1ZltpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wib2Zmc2V0XCIgaXMgb3V0c2lkZSBvZiBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJsZW5ndGhcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgdmFyIGJ1ZlxuICBpZiAoYnl0ZU9mZnNldCA9PT0gdW5kZWZpbmVkICYmIGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldClcbiAgfSBlbHNlIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKVxuICB9XG5cbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgYnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0IChvYmopIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmopKSB7XG4gICAgdmFyIGxlbiA9IGNoZWNrZWQob2JqLmxlbmd0aCkgfCAwXG4gICAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW4pXG5cbiAgICBpZiAoYnVmLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGJ1ZlxuICAgIH1cblxuICAgIG9iai5jb3B5KGJ1ZiwgMCwgMCwgbGVuKVxuICAgIHJldHVybiBidWZcbiAgfVxuXG4gIGlmIChvYmopIHtcbiAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KG9iaikgfHwgJ2xlbmd0aCcgaW4gb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggIT09ICdudW1iZXInIHx8IG51bWJlcklzTmFOKG9iai5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIoMClcbiAgICAgIH1cbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iailcbiAgICB9XG5cbiAgICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIEFycmF5LmlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZShvYmouZGF0YSlcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCBvciBBcnJheS1saWtlIE9iamVjdC4nKVxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwgS19NQVhfTEVOR1RIYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IEtfTUFYX0xFTkdUSCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBLX01BWF9MRU5HVEgudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAobGVuZ3RoKSB7XG4gIGlmICgrbGVuZ3RoICE9IGxlbmd0aCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxuICAgIGxlbmd0aCA9IDBcbiAgfVxuICByZXR1cm4gQnVmZmVyLmFsbG9jKCtsZW5ndGgpXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiBiICE9IG51bGwgJiYgYi5faXNCdWZmZXIgPT09IHRydWVcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnbGF0aW4xJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYygwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgYnVmID0gbGlzdFtpXVxuICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoYnVmKSkge1xuICAgICAgYnVmID0gQnVmZmVyLmZyb20oYnVmKVxuICAgIH1cbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICAgIH1cbiAgICBidWYuY29weShidWZmZXIsIHBvcylcbiAgICBwb3MgKz0gYnVmLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZmZXJcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG4gIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcoc3RyaW5nKSB8fCBpc0FycmF5QnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmJ5dGVMZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICBzdHJpbmcgPSAnJyArIHN0cmluZ1xuICB9XG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgLy8gTm8gbmVlZCB0byB2ZXJpZnkgdGhhdCBcInRoaXMubGVuZ3RoIDw9IE1BWF9VSU5UMzJcIiBzaW5jZSBpdCdzIGEgcmVhZC1vbmx5XG4gIC8vIHByb3BlcnR5IG9mIGEgdHlwZWQgYXJyYXkuXG5cbiAgLy8gVGhpcyBiZWhhdmVzIG5laXRoZXIgbGlrZSBTdHJpbmcgbm9yIFVpbnQ4QXJyYXkgaW4gdGhhdCB3ZSBzZXQgc3RhcnQvZW5kXG4gIC8vIHRvIHRoZWlyIHVwcGVyL2xvd2VyIGJvdW5kcyBpZiB0aGUgdmFsdWUgcGFzc2VkIGlzIG91dCBvZiByYW5nZS5cbiAgLy8gdW5kZWZpbmVkIGlzIGhhbmRsZWQgc3BlY2lhbGx5IGFzIHBlciBFQ01BLTI2MiA2dGggRWRpdGlvbixcbiAgLy8gU2VjdGlvbiAxMy4zLjMuNyBSdW50aW1lIFNlbWFudGljczogS2V5ZWRCaW5kaW5nSW5pdGlhbGl6YXRpb24uXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIC8vIFJldHVybiBlYXJseSBpZiBzdGFydCA+IHRoaXMubGVuZ3RoLiBEb25lIGhlcmUgdG8gcHJldmVudCBwb3RlbnRpYWwgdWludDMyXG4gIC8vIGNvZXJjaW9uIGZhaWwgYmVsb3cuXG4gIGlmIChzdGFydCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKGVuZCA8PSAwKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICAvLyBGb3JjZSBjb2Vyc2lvbiB0byB1aW50MzIuIFRoaXMgd2lsbCBhbHNvIGNvZXJjZSBmYWxzZXkvTmFOIHZhbHVlcyB0byAwLlxuICBlbmQgPj4+PSAwXG4gIHN0YXJ0ID4+Pj0gMFxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGlzIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgKGFuZCB0aGUgYGlzLWJ1ZmZlcmAgbnBtIHBhY2thZ2UpXG4vLyB0byBkZXRlY3QgYSBCdWZmZXIgaW5zdGFuY2UuIEl0J3Mgbm90IHBvc3NpYmxlIHRvIHVzZSBgaW5zdGFuY2VvZiBCdWZmZXJgXG4vLyByZWxpYWJseSBpbiBhIGJyb3dzZXJpZnkgY29udGV4dCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG11bHRpcGxlIGRpZmZlcmVudFxuLy8gY29waWVzIG9mIHRoZSAnYnVmZmVyJyBwYWNrYWdlIGluIHVzZS4gVGhpcyBtZXRob2Qgd29ya3MgZXZlbiBmb3IgQnVmZmVyXG4vLyBpbnN0YW5jZXMgdGhhdCB3ZXJlIGNyZWF0ZWQgZnJvbSBhbm90aGVyIGNvcHkgb2YgdGhlIGBidWZmZXJgIHBhY2thZ2UuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNTRcbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5mdW5jdGlvbiBzd2FwIChiLCBuLCBtKSB7XG4gIHZhciBpID0gYltuXVxuICBiW25dID0gYlttXVxuICBiW21dID0gaVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAxNiA9IGZ1bmN0aW9uIHN3YXAxNiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgMiAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMTYtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDEpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMzIgPSBmdW5jdGlvbiBzd2FwMzIgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDMyLWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAzKVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyAyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDY0ID0gZnVuY3Rpb24gc3dhcDY0ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA4ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA2NC1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA4KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgNylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgNilcbiAgICBzd2FwKHRoaXMsIGkgKyAyLCBpICsgNSlcbiAgICBzd2FwKHRoaXMsIGkgKyAzLCBpICsgNClcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9Mb2NhbGVTdHJpbmcgPSBCdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nXG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlICh0YXJnZXQsIHN0YXJ0LCBlbmQsIHRoaXNTdGFydCwgdGhpc0VuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIH1cblxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuZCA9IHRhcmdldCA/IHRhcmdldC5sZW5ndGggOiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc1N0YXJ0ID0gMFxuICB9XG4gIGlmICh0aGlzRW5kID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzRW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChzdGFydCA8IDAgfHwgZW5kID4gdGFyZ2V0Lmxlbmd0aCB8fCB0aGlzU3RhcnQgPCAwIHx8IHRoaXNFbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kICYmIHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kKSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cbiAgaWYgKHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAxXG4gIH1cblxuICBzdGFydCA+Pj49IDBcbiAgZW5kID4+Pj0gMFxuICB0aGlzU3RhcnQgPj4+PSAwXG4gIHRoaXNFbmQgPj4+PSAwXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCkgcmV0dXJuIDBcblxuICB2YXIgeCA9IHRoaXNFbmQgLSB0aGlzU3RhcnRcbiAgdmFyIHkgPSBlbmQgLSBzdGFydFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcblxuICB2YXIgdGhpc0NvcHkgPSB0aGlzLnNsaWNlKHRoaXNTdGFydCwgdGhpc0VuZClcbiAgdmFyIHRhcmdldENvcHkgPSB0YXJnZXQuc2xpY2Uoc3RhcnQsIGVuZClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKHRoaXNDb3B5W2ldICE9PSB0YXJnZXRDb3B5W2ldKSB7XG4gICAgICB4ID0gdGhpc0NvcHlbaV1cbiAgICAgIHkgPSB0YXJnZXRDb3B5W2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuLy8gRmluZHMgZWl0aGVyIHRoZSBmaXJzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPj0gYGJ5dGVPZmZzZXRgLFxuLy8gT1IgdGhlIGxhc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0IDw9IGBieXRlT2Zmc2V0YC5cbi8vXG4vLyBBcmd1bWVudHM6XG4vLyAtIGJ1ZmZlciAtIGEgQnVmZmVyIHRvIHNlYXJjaFxuLy8gLSB2YWwgLSBhIHN0cmluZywgQnVmZmVyLCBvciBudW1iZXJcbi8vIC0gYnl0ZU9mZnNldCAtIGFuIGluZGV4IGludG8gYGJ1ZmZlcmA7IHdpbGwgYmUgY2xhbXBlZCB0byBhbiBpbnQzMlxuLy8gLSBlbmNvZGluZyAtIGFuIG9wdGlvbmFsIGVuY29kaW5nLCByZWxldmFudCBpcyB2YWwgaXMgYSBzdHJpbmdcbi8vIC0gZGlyIC0gdHJ1ZSBmb3IgaW5kZXhPZiwgZmFsc2UgZm9yIGxhc3RJbmRleE9mXG5mdW5jdGlvbiBiaWRpcmVjdGlvbmFsSW5kZXhPZiAoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgLy8gRW1wdHkgYnVmZmVyIG1lYW5zIG5vIG1hdGNoXG4gIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldFxuICBpZiAodHlwZW9mIGJ5dGVPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBieXRlT2Zmc2V0XG4gICAgYnl0ZU9mZnNldCA9IDBcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikge1xuICAgIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSB7XG4gICAgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIH1cbiAgYnl0ZU9mZnNldCA9ICtieXRlT2Zmc2V0ICAvLyBDb2VyY2UgdG8gTnVtYmVyLlxuICBpZiAobnVtYmVySXNOYU4oYnl0ZU9mZnNldCkpIHtcbiAgICAvLyBieXRlT2Zmc2V0OiBpdCBpdCdzIHVuZGVmaW5lZCwgbnVsbCwgTmFOLCBcImZvb1wiLCBldGMsIHNlYXJjaCB3aG9sZSBidWZmZXJcbiAgICBieXRlT2Zmc2V0ID0gZGlyID8gMCA6IChidWZmZXIubGVuZ3RoIC0gMSlcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0OiBuZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggKyBieXRlT2Zmc2V0XG4gIGlmIChieXRlT2Zmc2V0ID49IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICBpZiAoZGlyKSByZXR1cm4gLTFcbiAgICBlbHNlIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoIC0gMVxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAwKSB7XG4gICAgaWYgKGRpcikgYnl0ZU9mZnNldCA9IDBcbiAgICBlbHNlIHJldHVybiAtMVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIHZhbFxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWwgPSBCdWZmZXIuZnJvbSh2YWwsIGVuY29kaW5nKVxuICB9XG5cbiAgLy8gRmluYWxseSwgc2VhcmNoIGVpdGhlciBpbmRleE9mIChpZiBkaXIgaXMgdHJ1ZSkgb3IgbGFzdEluZGV4T2ZcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgLy8gU3BlY2lhbCBjYXNlOiBsb29raW5nIGZvciBlbXB0eSBzdHJpbmcvYnVmZmVyIGFsd2F5cyBmYWlsc1xuICAgIGlmICh2YWwubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gLTFcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDB4RkYgLy8gU2VhcmNoIGZvciBhIGJ5dGUgdmFsdWUgWzAtMjU1XVxuICAgIGlmICh0eXBlb2YgVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKGRpcikge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmxhc3RJbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCBbIHZhbCBdLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICB2YXIgaW5kZXhTaXplID0gMVxuICB2YXIgYXJyTGVuZ3RoID0gYXJyLmxlbmd0aFxuICB2YXIgdmFsTGVuZ3RoID0gdmFsLmxlbmd0aFxuXG4gIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSBTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICBpZiAoZW5jb2RpbmcgPT09ICd1Y3MyJyB8fCBlbmNvZGluZyA9PT0gJ3Vjcy0yJyB8fFxuICAgICAgICBlbmNvZGluZyA9PT0gJ3V0ZjE2bGUnIHx8IGVuY29kaW5nID09PSAndXRmLTE2bGUnKSB7XG4gICAgICBpZiAoYXJyLmxlbmd0aCA8IDIgfHwgdmFsLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgcmV0dXJuIC0xXG4gICAgICB9XG4gICAgICBpbmRleFNpemUgPSAyXG4gICAgICBhcnJMZW5ndGggLz0gMlxuICAgICAgdmFsTGVuZ3RoIC89IDJcbiAgICAgIGJ5dGVPZmZzZXQgLz0gMlxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGJ1ZiwgaSkge1xuICAgIGlmIChpbmRleFNpemUgPT09IDEpIHtcbiAgICAgIHJldHVybiBidWZbaV1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGJ1Zi5yZWFkVUludDE2QkUoaSAqIGluZGV4U2l6ZSlcbiAgICB9XG4gIH1cblxuICB2YXIgaVxuICBpZiAoZGlyKSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPCBhcnJMZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHJlYWQoYXJyLCBpKSA9PT0gcmVhZCh2YWwsIGZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4KSkge1xuICAgICAgICBpZiAoZm91bmRJbmRleCA9PT0gLTEpIGZvdW5kSW5kZXggPSBpXG4gICAgICAgIGlmIChpIC0gZm91bmRJbmRleCArIDEgPT09IHZhbExlbmd0aCkgcmV0dXJuIGZvdW5kSW5kZXggKiBpbmRleFNpemVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ICE9PSAtMSkgaSAtPSBpIC0gZm91bmRJbmRleFxuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJ5dGVPZmZzZXQgKyB2YWxMZW5ndGggPiBhcnJMZW5ndGgpIGJ5dGVPZmZzZXQgPSBhcnJMZW5ndGggLSB2YWxMZW5ndGhcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpID49IDA7IGktLSkge1xuICAgICAgdmFyIGZvdW5kID0gdHJ1ZVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCB2YWxMZW5ndGg7IGorKykge1xuICAgICAgICBpZiAocmVhZChhcnIsIGkgKyBqKSAhPT0gcmVhZCh2YWwsIGopKSB7XG4gICAgICAgICAgZm91bmQgPSBmYWxzZVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmNsdWRlcyA9IGZ1bmN0aW9uIGluY2x1ZGVzICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiB0aGlzLmluZGV4T2YodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykgIT09IC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIHRydWUpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUubGFzdEluZGV4T2YgPSBmdW5jdGlvbiBsYXN0SW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZmFsc2UpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAobnVtYmVySXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGxhdGluMVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggPj4+IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdCdWZmZXIud3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0WywgbGVuZ3RoXSkgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZCdcbiAgICApXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGxhdGluMVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyAoYnl0ZXNbaSArIDFdICogMjU2KSlcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiYnVmZmVyXCIgYXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsICg4ICogYnl0ZUxlbmd0aCkgLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpIC0gMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCAoOCAqIGJ5dGVMZW5ndGgpIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSArIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYXJndW1lbnQgc2hvdWxkIGJlIGEgQnVmZmVyJylcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgdHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmNvcHlXaXRoaW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBVc2UgYnVpbHQtaW4gd2hlbiBhdmFpbGFibGUsIG1pc3NpbmcgZnJvbSBJRTExXG4gICAgdGhpcy5jb3B5V2l0aGluKHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKVxuICB9IGVsc2UgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yICh2YXIgaSA9IGxlbiAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gVXNhZ2U6XG4vLyAgICBidWZmZXIuZmlsbChudW1iZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKGJ1ZmZlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoc3RyaW5nWywgb2Zmc2V0WywgZW5kXV1bLCBlbmNvZGluZ10pXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWwsIHN0YXJ0LCBlbmQsIGVuY29kaW5nKSB7XG4gIC8vIEhhbmRsZSBzdHJpbmcgY2FzZXM6XG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IHN0YXJ0XG4gICAgICBzdGFydCA9IDBcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZW5kID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBlbmRcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfVxuICAgIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuY29kaW5nIG11c3QgYmUgYSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJyAmJiAhQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgfVxuICAgIGlmICh2YWwubGVuZ3RoID09PSAxKSB7XG4gICAgICB2YXIgY29kZSA9IHZhbC5jaGFyQ29kZUF0KDApXG4gICAgICBpZiAoKGVuY29kaW5nID09PSAndXRmOCcgJiYgY29kZSA8IDEyOCkgfHxcbiAgICAgICAgICBlbmNvZGluZyA9PT0gJ2xhdGluMScpIHtcbiAgICAgICAgLy8gRmFzdCBwYXRoOiBJZiBgdmFsYCBmaXRzIGludG8gYSBzaW5nbGUgYnl0ZSwgdXNlIHRoYXQgbnVtZXJpYyB2YWx1ZS5cbiAgICAgICAgdmFsID0gY29kZVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIHZhbCA9IHZhbCAmIDI1NVxuICB9XG5cbiAgLy8gSW52YWxpZCByYW5nZXMgYXJlIG5vdCBzZXQgdG8gYSBkZWZhdWx0LCBzbyBjYW4gcmFuZ2UgY2hlY2sgZWFybHkuXG4gIGlmIChzdGFydCA8IDAgfHwgdGhpcy5sZW5ndGggPCBzdGFydCB8fCB0aGlzLmxlbmd0aCA8IGVuZCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdPdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBzdGFydCA9IHN0YXJ0ID4+PiAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5sZW5ndGggOiBlbmQgPj4+IDBcblxuICBpZiAoIXZhbCkgdmFsID0gMFxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICAgIHRoaXNbaV0gPSB2YWxcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gQnVmZmVyLmlzQnVmZmVyKHZhbClcbiAgICAgID8gdmFsXG4gICAgICA6IG5ldyBCdWZmZXIodmFsLCBlbmNvZGluZylcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIHZhbHVlIFwiJyArIHZhbCArXG4gICAgICAgICdcIiBpcyBpbnZhbGlkIGZvciBhcmd1bWVudCBcInZhbHVlXCInKVxuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgZW5kIC0gc3RhcnQ7ICsraSkge1xuICAgICAgdGhpc1tpICsgc3RhcnRdID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXisvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHRha2VzIGVxdWFsIHNpZ25zIGFzIGVuZCBvZiB0aGUgQmFzZTY0IGVuY29kaW5nXG4gIHN0ciA9IHN0ci5zcGxpdCgnPScpWzBdXG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHIudHJpbSgpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuLy8gQXJyYXlCdWZmZXJzIGZyb20gYW5vdGhlciBjb250ZXh0IChpLmUuIGFuIGlmcmFtZSkgZG8gbm90IHBhc3MgdGhlIGBpbnN0YW5jZW9mYCBjaGVja1xuLy8gYnV0IHRoZXkgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgdmFsaWQuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvaXNzdWVzLzE2NlxuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlciAob2JqKSB7XG4gIHJldHVybiBvYmogaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fFxuICAgIChvYmogIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IgIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gJ0FycmF5QnVmZmVyJyAmJlxuICAgICAgdHlwZW9mIG9iai5ieXRlTGVuZ3RoID09PSAnbnVtYmVyJylcbn1cblxuZnVuY3Rpb24gbnVtYmVySXNOYU4gKG9iaikge1xuICByZXR1cm4gb2JqICE9PSBvYmogLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1zZWxmLWNvbXBhcmVcbn1cbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gKG5CeXRlcyAqIDgpIC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gKGUgKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gKG0gKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAoKHZhbHVlICogYykgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJcbi8qKlxuICogeS13ZWJydGMzIC0gXG4gKiBAdmVyc2lvbiB2Mi40LjBcbiAqIEBsaWNlbnNlIE1JVFxuICovXG5cbihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG5cdHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcblx0dHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcblx0KGdsb2JhbC55d2VicnRjID0gZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjb21tb25qc0dsb2JhbCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgPyBzZWxmIDoge307XG5cblx0ZnVuY3Rpb24gY3JlYXRlQ29tbW9uanNNb2R1bGUoZm4sIG1vZHVsZSkge1xuXHRcdHJldHVybiBtb2R1bGUgPSB7IGV4cG9ydHM6IHt9IH0sIGZuKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMpLCBtb2R1bGUuZXhwb3J0cztcblx0fVxuXG5cdC8qKlxyXG5cdCAqIFBhcnNlcyBhbiBVUklcclxuXHQgKlxyXG5cdCAqIEBhdXRob3IgU3RldmVuIExldml0aGFuIDxzdGV2ZW5sZXZpdGhhbi5jb20+IChNSVQgbGljZW5zZSlcclxuXHQgKiBAYXBpIHByaXZhdGVcclxuXHQgKi9cblxuXHR2YXIgcmUgPSAvXig/Oig/IVteOkBdKzpbXjpAXFwvXSpAKShodHRwfGh0dHBzfHdzfHdzcyk6XFwvXFwvKT8oKD86KChbXjpAXSopKD86OihbXjpAXSopKT8pP0ApPygoPzpbYS1mMC05XXswLDR9Oil7Miw3fVthLWYwLTldezAsNH18W146XFwvPyNdKikoPzo6KFxcZCopKT8pKCgoXFwvKD86W14/I10oPyFbXj8jXFwvXSpcXC5bXj8jXFwvLl0rKD86Wz8jXXwkKSkpKlxcLz8pPyhbXj8jXFwvXSopKSg/OlxcPyhbXiNdKikpPyg/OiMoLiopKT8pLztcblxuXHR2YXIgcGFydHMgPSBbJ3NvdXJjZScsICdwcm90b2NvbCcsICdhdXRob3JpdHknLCAndXNlckluZm8nLCAndXNlcicsICdwYXNzd29yZCcsICdob3N0JywgJ3BvcnQnLCAncmVsYXRpdmUnLCAncGF0aCcsICdkaXJlY3RvcnknLCAnZmlsZScsICdxdWVyeScsICdhbmNob3InXTtcblxuXHR2YXIgcGFyc2V1cmkgPSBmdW5jdGlvbiBwYXJzZXVyaShzdHIpIHtcblx0ICAgIHZhciBzcmMgPSBzdHIsXG5cdCAgICAgICAgYiA9IHN0ci5pbmRleE9mKCdbJyksXG5cdCAgICAgICAgZSA9IHN0ci5pbmRleE9mKCddJyk7XG5cblx0ICAgIGlmIChiICE9IC0xICYmIGUgIT0gLTEpIHtcblx0ICAgICAgICBzdHIgPSBzdHIuc3Vic3RyaW5nKDAsIGIpICsgc3RyLnN1YnN0cmluZyhiLCBlKS5yZXBsYWNlKC86L2csICc7JykgKyBzdHIuc3Vic3RyaW5nKGUsIHN0ci5sZW5ndGgpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgbSA9IHJlLmV4ZWMoc3RyIHx8ICcnKSxcblx0ICAgICAgICB1cmkgPSB7fSxcblx0ICAgICAgICBpID0gMTQ7XG5cblx0ICAgIHdoaWxlIChpLS0pIHtcblx0ICAgICAgICB1cmlbcGFydHNbaV1dID0gbVtpXSB8fCAnJztcblx0ICAgIH1cblxuXHQgICAgaWYgKGIgIT0gLTEgJiYgZSAhPSAtMSkge1xuXHQgICAgICAgIHVyaS5zb3VyY2UgPSBzcmM7XG5cdCAgICAgICAgdXJpLmhvc3QgPSB1cmkuaG9zdC5zdWJzdHJpbmcoMSwgdXJpLmhvc3QubGVuZ3RoIC0gMSkucmVwbGFjZSgvOy9nLCAnOicpO1xuXHQgICAgICAgIHVyaS5hdXRob3JpdHkgPSB1cmkuYXV0aG9yaXR5LnJlcGxhY2UoJ1snLCAnJykucmVwbGFjZSgnXScsICcnKS5yZXBsYWNlKC87L2csICc6Jyk7XG5cdCAgICAgICAgdXJpLmlwdjZ1cmkgPSB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdXJpO1xuXHR9O1xuXG5cdHZhciBwYXJzZXVyaSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBhcnNldXJpLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogcGFyc2V1cmlcblx0fSk7XG5cblx0dmFyIF90eXBlb2YgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IGZ1bmN0aW9uIChvYmopIHtcblx0ICByZXR1cm4gdHlwZW9mIG9iajtcblx0fSA6IGZ1bmN0aW9uIChvYmopIHtcblx0ICByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajtcblx0fTtcblxuXHR2YXIgY2xhc3NDYWxsQ2hlY2sgPSBmdW5jdGlvbiAoaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7XG5cdCAgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7XG5cdCAgfVxuXHR9O1xuXG5cdHZhciBjcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHtcblx0ICBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTtcblx0ICAgICAgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlO1xuXHQgICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG5cdCAgICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG5cdCAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuXHQgICAgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcblx0ICAgIGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpO1xuXHQgICAgcmV0dXJuIENvbnN0cnVjdG9yO1xuXHQgIH07XG5cdH0oKTtcblxuXHR2YXIgaW5oZXJpdHMgPSBmdW5jdGlvbiAoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHtcblx0ICBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09IFwiZnVuY3Rpb25cIiAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCBcIiArIHR5cGVvZiBzdXBlckNsYXNzKTtcblx0ICB9XG5cblx0ICBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHtcblx0ICAgIGNvbnN0cnVjdG9yOiB7XG5cdCAgICAgIHZhbHVlOiBzdWJDbGFzcyxcblx0ICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG5cdCAgICAgIHdyaXRhYmxlOiB0cnVlLFxuXHQgICAgICBjb25maWd1cmFibGU6IHRydWVcblx0ICAgIH1cblx0ICB9KTtcblx0ICBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7XG5cdH07XG5cblx0dmFyIHBvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4gPSBmdW5jdGlvbiAoc2VsZiwgY2FsbCkge1xuXHQgIGlmICghc2VsZikge1xuXHQgICAgdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO1xuXHQgIH1cblxuXHQgIHJldHVybiBjYWxsICYmICh0eXBlb2YgY2FsbCA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgY2FsbCA9PT0gXCJmdW5jdGlvblwiKSA/IGNhbGwgOiBzZWxmO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBIZWxwZXJzLlxuXHQgKi9cblxuXHR2YXIgcyA9IDEwMDA7XG5cdHZhciBtID0gcyAqIDYwO1xuXHR2YXIgaCA9IG0gKiA2MDtcblx0dmFyIGQgPSBoICogMjQ7XG5cdHZhciB5ID0gZCAqIDM2NS4yNTtcblxuXHQvKipcblx0ICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cblx0ICpcblx0ICogT3B0aW9uczpcblx0ICpcblx0ICogIC0gYGxvbmdgIHZlcmJvc2UgZm9ybWF0dGluZyBbZmFsc2VdXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cblx0ICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIHZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgbnVtYmVyXG5cdCAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBtcyA9IGZ1bmN0aW9uIG1zKHZhbCwgb3B0aW9ucykge1xuXHQgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHQgIHZhciB0eXBlID0gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodmFsKTtcblx0ICBpZiAodHlwZSA9PT0gJ3N0cmluZycgJiYgdmFsLmxlbmd0aCA+IDApIHtcblx0ICAgIHJldHVybiBwYXJzZSh2YWwpO1xuXHQgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgaXNOYU4odmFsKSA9PT0gZmFsc2UpIHtcblx0ICAgIHJldHVybiBvcHRpb25zLmxvbmcgPyBmbXRMb25nKHZhbCkgOiBmbXRTaG9ydCh2YWwpO1xuXHQgIH1cblx0ICB0aHJvdyBuZXcgRXJyb3IoJ3ZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgdmFsaWQgbnVtYmVyLiB2YWw9JyArIEpTT04uc3RyaW5naWZ5KHZhbCkpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcblx0ICogQHJldHVybiB7TnVtYmVyfVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG5cdCAgc3RyID0gU3RyaW5nKHN0cik7XG5cdCAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cdCAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhzdHIpO1xuXHQgIGlmICghbWF0Y2gpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cdCAgdmFyIG4gPSBwYXJzZUZsb2F0KG1hdGNoWzFdKTtcblx0ICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuXHQgIHN3aXRjaCAodHlwZSkge1xuXHQgICAgY2FzZSAneWVhcnMnOlxuXHQgICAgY2FzZSAneWVhcic6XG5cdCAgICBjYXNlICd5cnMnOlxuXHQgICAgY2FzZSAneXInOlxuXHQgICAgY2FzZSAneSc6XG5cdCAgICAgIHJldHVybiBuICogeTtcblx0ICAgIGNhc2UgJ2RheXMnOlxuXHQgICAgY2FzZSAnZGF5Jzpcblx0ICAgIGNhc2UgJ2QnOlxuXHQgICAgICByZXR1cm4gbiAqIGQ7XG5cdCAgICBjYXNlICdob3Vycyc6XG5cdCAgICBjYXNlICdob3VyJzpcblx0ICAgIGNhc2UgJ2hycyc6XG5cdCAgICBjYXNlICdocic6XG5cdCAgICBjYXNlICdoJzpcblx0ICAgICAgcmV0dXJuIG4gKiBoO1xuXHQgICAgY2FzZSAnbWludXRlcyc6XG5cdCAgICBjYXNlICdtaW51dGUnOlxuXHQgICAgY2FzZSAnbWlucyc6XG5cdCAgICBjYXNlICdtaW4nOlxuXHQgICAgY2FzZSAnbSc6XG5cdCAgICAgIHJldHVybiBuICogbTtcblx0ICAgIGNhc2UgJ3NlY29uZHMnOlxuXHQgICAgY2FzZSAnc2Vjb25kJzpcblx0ICAgIGNhc2UgJ3NlY3MnOlxuXHQgICAgY2FzZSAnc2VjJzpcblx0ICAgIGNhc2UgJ3MnOlxuXHQgICAgICByZXR1cm4gbiAqIHM7XG5cdCAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuXHQgICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuXHQgICAgY2FzZSAnbXNlY3MnOlxuXHQgICAgY2FzZSAnbXNlYyc6XG5cdCAgICBjYXNlICdtcyc6XG5cdCAgICAgIHJldHVybiBuO1xuXHQgICAgZGVmYXVsdDpcblx0ICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblx0ICB9XG5cdH1cblxuXHQvKipcblx0ICogU2hvcnQgZm9ybWF0IGZvciBgbXNgLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbXNcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gZm10U2hvcnQobXMpIHtcblx0ICBpZiAobXMgPj0gZCkge1xuXHQgICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcblx0ICB9XG5cdCAgaWYgKG1zID49IGgpIHtcblx0ICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG5cdCAgfVxuXHQgIGlmIChtcyA+PSBtKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuXHQgIH1cblx0ICBpZiAobXMgPj0gcykge1xuXHQgICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcblx0ICB9XG5cdCAgcmV0dXJuIG1zICsgJ21zJztcblx0fVxuXG5cdC8qKlxuXHQgKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG1zXG5cdCAqIEByZXR1cm4ge1N0cmluZ31cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGZtdExvbmcobXMpIHtcblx0ICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JykgfHwgcGx1cmFsKG1zLCBoLCAnaG91cicpIHx8IHBsdXJhbChtcywgbSwgJ21pbnV0ZScpIHx8IHBsdXJhbChtcywgcywgJ3NlY29uZCcpIHx8IG1zICsgJyBtcyc7XG5cdH1cblxuXHQvKipcblx0ICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIHBsdXJhbChtcywgbiwgbmFtZSkge1xuXHQgIGlmIChtcyA8IG4pIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cdCAgaWYgKG1zIDwgbiAqIDEuNSkge1xuXHQgICAgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG5cdCAgfVxuXHQgIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG5cdH1cblxuXHR2YXIgbXMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBtcyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IG1zXG5cdH0pO1xuXG5cdHZhciByZXF1aXJlJCQwID0gKCBtcyQxICYmIG1zICkgfHwgbXMkMTtcblxuXHR2YXIgZGVidWcgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuXHQgICAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG5cdCAgICpcblx0ICAgKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG5cdCAgICovXG5cblx0ICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWJ1Zy5kZWJ1ZyA9IGNyZWF0ZURlYnVnWydkZWZhdWx0J10gPSBjcmVhdGVEZWJ1Zztcblx0ICBleHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcblx0ICBleHBvcnRzLmRpc2FibGUgPSBkaXNhYmxlO1xuXHQgIGV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuXHQgIGV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdCAgZXhwb3J0cy5odW1hbml6ZSA9IHJlcXVpcmUkJDA7XG5cblx0ICAvKipcblx0ICAgKiBBY3RpdmUgYGRlYnVnYCBpbnN0YW5jZXMuXG5cdCAgICovXG5cdCAgZXhwb3J0cy5pbnN0YW5jZXMgPSBbXTtcblxuXHQgIC8qKlxuXHQgICAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5uYW1lcyA9IFtdO1xuXHQgIGV4cG9ydHMuc2tpcHMgPSBbXTtcblxuXHQgIC8qKlxuXHQgICAqIE1hcCBvZiBzcGVjaWFsIFwiJW5cIiBoYW5kbGluZyBmdW5jdGlvbnMsIGZvciB0aGUgZGVidWcgXCJmb3JtYXRcIiBhcmd1bWVudC5cblx0ICAgKlxuXHQgICAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyIG9yIHVwcGVyLWNhc2UgbGV0dGVyLCBpLmUuIFwiblwiIGFuZCBcIk5cIi5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG5cdCAgLyoqXG5cdCAgICogU2VsZWN0IGEgY29sb3IuXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuXHQgICAqIEByZXR1cm4ge051bWJlcn1cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIHNlbGVjdENvbG9yKG5hbWVzcGFjZSkge1xuXHQgICAgdmFyIGhhc2ggPSAwLFxuXHQgICAgICAgIGk7XG5cblx0ICAgIGZvciAoaSBpbiBuYW1lc3BhY2UpIHtcblx0ICAgICAgaGFzaCA9IChoYXNoIDw8IDUpIC0gaGFzaCArIG5hbWVzcGFjZS5jaGFyQ29kZUF0KGkpO1xuXHQgICAgICBoYXNoIHw9IDA7IC8vIENvbnZlcnQgdG8gMzJiaXQgaW50ZWdlclxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbTWF0aC5hYnMoaGFzaCkgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuXHQgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBjcmVhdGVEZWJ1ZyhuYW1lc3BhY2UpIHtcblxuXHQgICAgdmFyIHByZXZUaW1lO1xuXG5cdCAgICBmdW5jdGlvbiBkZWJ1ZygpIHtcblx0ICAgICAgLy8gZGlzYWJsZWQ/XG5cdCAgICAgIGlmICghZGVidWcuZW5hYmxlZCkgcmV0dXJuO1xuXG5cdCAgICAgIHZhciBzZWxmID0gZGVidWc7XG5cblx0ICAgICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcblx0ICAgICAgdmFyIGN1cnIgPSArbmV3IERhdGUoKTtcblx0ICAgICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcblx0ICAgICAgc2VsZi5kaWZmID0gbXM7XG5cdCAgICAgIHNlbGYucHJldiA9IHByZXZUaW1lO1xuXHQgICAgICBzZWxmLmN1cnIgPSBjdXJyO1xuXHQgICAgICBwcmV2VGltZSA9IGN1cnI7XG5cblx0ICAgICAgLy8gdHVybiB0aGUgYGFyZ3VtZW50c2AgaW50byBhIHByb3BlciBBcnJheVxuXHQgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuXHQgICAgICBpZiAoJ3N0cmluZycgIT09IHR5cGVvZiBhcmdzWzBdKSB7XG5cdCAgICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJU9cblx0ICAgICAgICBhcmdzLnVuc2hpZnQoJyVPJyk7XG5cdCAgICAgIH1cblxuXHQgICAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuXHQgICAgICB2YXIgaW5kZXggPSAwO1xuXHQgICAgICBhcmdzWzBdID0gYXJnc1swXS5yZXBsYWNlKC8lKFthLXpBLVolXSkvZywgZnVuY3Rpb24gKG1hdGNoLCBmb3JtYXQpIHtcblx0ICAgICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG5cdCAgICAgICAgaWYgKG1hdGNoID09PSAnJSUnKSByZXR1cm4gbWF0Y2g7XG5cdCAgICAgICAgaW5kZXgrKztcblx0ICAgICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG5cdCAgICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmb3JtYXR0ZXIpIHtcblx0ICAgICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcblx0ICAgICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuXHQgICAgICAgICAgLy8gbm93IHdlIG5lZWQgdG8gcmVtb3ZlIGBhcmdzW2luZGV4XWAgc2luY2UgaXQncyBpbmxpbmVkIGluIHRoZSBgZm9ybWF0YFxuXHQgICAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuXHQgICAgICAgICAgaW5kZXgtLTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgcmV0dXJuIG1hdGNoO1xuXHQgICAgICB9KTtcblxuXHQgICAgICAvLyBhcHBseSBlbnYtc3BlY2lmaWMgZm9ybWF0dGluZyAoY29sb3JzLCBldGMuKVxuXHQgICAgICBleHBvcnRzLmZvcm1hdEFyZ3MuY2FsbChzZWxmLCBhcmdzKTtcblxuXHQgICAgICB2YXIgbG9nRm4gPSBkZWJ1Zy5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcblx0ICAgICAgbG9nRm4uYXBwbHkoc2VsZiwgYXJncyk7XG5cdCAgICB9XG5cblx0ICAgIGRlYnVnLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcblx0ICAgIGRlYnVnLmVuYWJsZWQgPSBleHBvcnRzLmVuYWJsZWQobmFtZXNwYWNlKTtcblx0ICAgIGRlYnVnLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG5cdCAgICBkZWJ1Zy5jb2xvciA9IHNlbGVjdENvbG9yKG5hbWVzcGFjZSk7XG5cdCAgICBkZWJ1Zy5kZXN0cm95ID0gZGVzdHJveTtcblxuXHQgICAgLy8gZW52LXNwZWNpZmljIGluaXRpYWxpemF0aW9uIGxvZ2ljIGZvciBkZWJ1ZyBpbnN0YW5jZXNcblx0ICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZXhwb3J0cy5pbml0KSB7XG5cdCAgICAgIGV4cG9ydHMuaW5pdChkZWJ1Zyk7XG5cdCAgICB9XG5cblx0ICAgIGV4cG9ydHMuaW5zdGFuY2VzLnB1c2goZGVidWcpO1xuXG5cdCAgICByZXR1cm4gZGVidWc7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0ICAgIHZhciBpbmRleCA9IGV4cG9ydHMuaW5zdGFuY2VzLmluZGV4T2YodGhpcyk7XG5cdCAgICBpZiAoaW5kZXggIT09IC0xKSB7XG5cdCAgICAgIGV4cG9ydHMuaW5zdGFuY2VzLnNwbGljZShpbmRleCwgMSk7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcblx0ICAgKiBzZXBhcmF0ZWQgYnkgYSBjb2xvbiBhbmQgd2lsZGNhcmRzLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcblx0ICAgIGV4cG9ydHMuc2F2ZShuYW1lc3BhY2VzKTtcblxuXHQgICAgZXhwb3J0cy5uYW1lcyA9IFtdO1xuXHQgICAgZXhwb3J0cy5za2lwcyA9IFtdO1xuXG5cdCAgICB2YXIgaTtcblx0ICAgIHZhciBzcGxpdCA9ICh0eXBlb2YgbmFtZXNwYWNlcyA9PT0gJ3N0cmluZycgPyBuYW1lc3BhY2VzIDogJycpLnNwbGl0KC9bXFxzLF0rLyk7XG5cdCAgICB2YXIgbGVuID0gc3BsaXQubGVuZ3RoO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0ICAgICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG5cdCAgICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuXHQgICAgICBpZiAobmFtZXNwYWNlc1swXSA9PT0gJy0nKSB7XG5cdCAgICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBleHBvcnRzLm5hbWVzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzICsgJyQnKSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZm9yIChpID0gMDsgaSA8IGV4cG9ydHMuaW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIHZhciBpbnN0YW5jZSA9IGV4cG9ydHMuaW5zdGFuY2VzW2ldO1xuXHQgICAgICBpbnN0YW5jZS5lbmFibGVkID0gZXhwb3J0cy5lbmFibGVkKGluc3RhbmNlLm5hbWVzcGFjZSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRGlzYWJsZSBkZWJ1ZyBvdXRwdXQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZGlzYWJsZSgpIHtcblx0ICAgIGV4cG9ydHMuZW5hYmxlKCcnKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuXHQgICAqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuXHQgICAgaWYgKG5hbWVbbmFtZS5sZW5ndGggLSAxXSA9PT0gJyonKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXHQgICAgdmFyIGksIGxlbjtcblx0ICAgIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0ICAgICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuXHQgICAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5uYW1lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG5cdCAgICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBDb2VyY2UgYHZhbGAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge01peGVkfSB2YWxcblx0ICAgKiBAcmV0dXJuIHtNaXhlZH1cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcblx0ICAgIGlmICh2YWwgaW5zdGFuY2VvZiBFcnJvcikgcmV0dXJuIHZhbC5zdGFjayB8fCB2YWwubWVzc2FnZTtcblx0ICAgIHJldHVybiB2YWw7XG5cdCAgfVxuXHR9KTtcblx0dmFyIGRlYnVnXzEgPSBkZWJ1Zy5jb2VyY2U7XG5cdHZhciBkZWJ1Z18yID0gZGVidWcuZGlzYWJsZTtcblx0dmFyIGRlYnVnXzMgPSBkZWJ1Zy5lbmFibGU7XG5cdHZhciBkZWJ1Z180ID0gZGVidWcuZW5hYmxlZDtcblx0dmFyIGRlYnVnXzUgPSBkZWJ1Zy5odW1hbml6ZTtcblx0dmFyIGRlYnVnXzYgPSBkZWJ1Zy5pbnN0YW5jZXM7XG5cdHZhciBkZWJ1Z183ID0gZGVidWcubmFtZXM7XG5cdHZhciBkZWJ1Z184ID0gZGVidWcuc2tpcHM7XG5cdHZhciBkZWJ1Z185ID0gZGVidWcuZm9ybWF0dGVycztcblxuXHR2YXIgZGVidWckMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBkZWJ1Zyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGRlYnVnLFxuXHRcdGNvZXJjZTogZGVidWdfMSxcblx0XHRkaXNhYmxlOiBkZWJ1Z18yLFxuXHRcdGVuYWJsZTogZGVidWdfMyxcblx0XHRlbmFibGVkOiBkZWJ1Z180LFxuXHRcdGh1bWFuaXplOiBkZWJ1Z181LFxuXHRcdGluc3RhbmNlczogZGVidWdfNixcblx0XHRuYW1lczogZGVidWdfNyxcblx0XHRza2lwczogZGVidWdfOCxcblx0XHRmb3JtYXR0ZXJzOiBkZWJ1Z185XG5cdH0pO1xuXG5cdHZhciByZXF1aXJlJCQwJDEgPSAoIGRlYnVnJDEgJiYgZGVidWcgKSB8fCBkZWJ1ZyQxO1xuXG5cdHZhciBicm93c2VyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cblx0ICAgKlxuXHQgICAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUkJDAkMTtcblx0ICBleHBvcnRzLmxvZyA9IGxvZztcblx0ICBleHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuXHQgIGV4cG9ydHMuc2F2ZSA9IHNhdmU7XG5cdCAgZXhwb3J0cy5sb2FkID0gbG9hZDtcblx0ICBleHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcblx0ICBleHBvcnRzLnN0b3JhZ2UgPSAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lICYmICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUuc3RvcmFnZSA/IGNocm9tZS5zdG9yYWdlLmxvY2FsIDogbG9jYWxzdG9yYWdlKCk7XG5cblx0ICAvKipcblx0ICAgKiBDb2xvcnMuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmNvbG9ycyA9IFsnIzAwMDBDQycsICcjMDAwMEZGJywgJyMwMDMzQ0MnLCAnIzAwMzNGRicsICcjMDA2NkNDJywgJyMwMDY2RkYnLCAnIzAwOTlDQycsICcjMDA5OUZGJywgJyMwMENDMDAnLCAnIzAwQ0MzMycsICcjMDBDQzY2JywgJyMwMENDOTknLCAnIzAwQ0NDQycsICcjMDBDQ0ZGJywgJyMzMzAwQ0MnLCAnIzMzMDBGRicsICcjMzMzM0NDJywgJyMzMzMzRkYnLCAnIzMzNjZDQycsICcjMzM2NkZGJywgJyMzMzk5Q0MnLCAnIzMzOTlGRicsICcjMzNDQzAwJywgJyMzM0NDMzMnLCAnIzMzQ0M2NicsICcjMzNDQzk5JywgJyMzM0NDQ0MnLCAnIzMzQ0NGRicsICcjNjYwMENDJywgJyM2NjAwRkYnLCAnIzY2MzNDQycsICcjNjYzM0ZGJywgJyM2NkNDMDAnLCAnIzY2Q0MzMycsICcjOTkwMENDJywgJyM5OTAwRkYnLCAnIzk5MzNDQycsICcjOTkzM0ZGJywgJyM5OUNDMDAnLCAnIzk5Q0MzMycsICcjQ0MwMDAwJywgJyNDQzAwMzMnLCAnI0NDMDA2NicsICcjQ0MwMDk5JywgJyNDQzAwQ0MnLCAnI0NDMDBGRicsICcjQ0MzMzAwJywgJyNDQzMzMzMnLCAnI0NDMzM2NicsICcjQ0MzMzk5JywgJyNDQzMzQ0MnLCAnI0NDMzNGRicsICcjQ0M2NjAwJywgJyNDQzY2MzMnLCAnI0NDOTkwMCcsICcjQ0M5OTMzJywgJyNDQ0NDMDAnLCAnI0NDQ0MzMycsICcjRkYwMDAwJywgJyNGRjAwMzMnLCAnI0ZGMDA2NicsICcjRkYwMDk5JywgJyNGRjAwQ0MnLCAnI0ZGMDBGRicsICcjRkYzMzAwJywgJyNGRjMzMzMnLCAnI0ZGMzM2NicsICcjRkYzMzk5JywgJyNGRjMzQ0MnLCAnI0ZGMzNGRicsICcjRkY2NjAwJywgJyNGRjY2MzMnLCAnI0ZGOTkwMCcsICcjRkY5OTMzJywgJyNGRkNDMDAnLCAnI0ZGQ0MzMyddO1xuXG5cdCAgLyoqXG5cdCAgICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcblx0ICAgKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cblx0ICAgKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG5cdCAgICpcblx0ICAgKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuXHQgICAgLy8gTkI6IEluIGFuIEVsZWN0cm9uIHByZWxvYWQgc2NyaXB0LCBkb2N1bWVudCB3aWxsIGJlIGRlZmluZWQgYnV0IG5vdCBmdWxseVxuXHQgICAgLy8gaW5pdGlhbGl6ZWQuIFNpbmNlIHdlIGtub3cgd2UncmUgaW4gQ2hyb21lLCB3ZSdsbCBqdXN0IGRldGVjdCB0aGlzIGNhc2Vcblx0ICAgIC8vIGV4cGxpY2l0bHlcblx0ICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucHJvY2VzcyAmJiB3aW5kb3cucHJvY2Vzcy50eXBlID09PSAncmVuZGVyZXInKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICAvLyBJbnRlcm5ldCBFeHBsb3JlciBhbmQgRWRnZSBkbyBub3Qgc3VwcG9ydCBjb2xvcnMuXG5cdCAgICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goLyhlZGdlfHRyaWRlbnQpXFwvKFxcZCspLykpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICAvLyBpcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuXHQgICAgLy8gZG9jdW1lbnQgaXMgdW5kZWZpbmVkIGluIHJlYWN0LW5hdGl2ZTogaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0LW5hdGl2ZS9wdWxsLzE2MzJcblx0ICAgIHJldHVybiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2UgfHxcblx0ICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcblx0ICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5jb25zb2xlICYmICh3aW5kb3cuY29uc29sZS5maXJlYnVnIHx8IHdpbmRvdy5jb25zb2xlLmV4Y2VwdGlvbiAmJiB3aW5kb3cuY29uc29sZS50YWJsZSkgfHxcblx0ICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuXHQgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG5cdCAgICB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxIHx8XG5cdCAgICAvLyBkb3VibGUgY2hlY2sgd2Via2l0IGluIHVzZXJBZ2VudCBqdXN0IGluIGNhc2Ugd2UgYXJlIGluIGEgd29ya2VyXG5cdCAgICB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvYXBwbGV3ZWJraXRcXC8oXFxkKykvKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBNYXAgJWogdG8gYEpTT04uc3RyaW5naWZ5KClgLCBzaW5jZSBubyBXZWIgSW5zcGVjdG9ycyBkbyB0aGF0IGJ5IGRlZmF1bHQuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG5cdCAgICB9IGNhdGNoIChlcnIpIHtcblx0ICAgICAgcmV0dXJuICdbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogJyArIGVyci5tZXNzYWdlO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDb2xvcml6ZSBsb2cgYXJndW1lbnRzIGlmIGVuYWJsZWQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZm9ybWF0QXJncyhhcmdzKSB7XG5cdCAgICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cblx0ICAgIGFyZ3NbMF0gPSAodXNlQ29sb3JzID8gJyVjJyA6ICcnKSArIHRoaXMubmFtZXNwYWNlICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKSArIGFyZ3NbMF0gKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG5cdCAgICBpZiAoIXVzZUNvbG9ycykgcmV0dXJuO1xuXG5cdCAgICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG5cdCAgICBhcmdzLnNwbGljZSgxLCAwLCBjLCAnY29sb3I6IGluaGVyaXQnKTtcblxuXHQgICAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcblx0ICAgIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cblx0ICAgIC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuXHQgICAgdmFyIGluZGV4ID0gMDtcblx0ICAgIHZhciBsYXN0QyA9IDA7XG5cdCAgICBhcmdzWzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZywgZnVuY3Rpb24gKG1hdGNoKSB7XG5cdCAgICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuXHQgICAgICBpbmRleCsrO1xuXHQgICAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcblx0ICAgICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcblx0ICAgICAgICAvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuXHQgICAgICAgIGxhc3RDID0gaW5kZXg7XG5cdCAgICAgIH1cblx0ICAgIH0pO1xuXG5cdCAgICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG5cdCAgICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBsb2coKSB7XG5cdCAgICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuXHQgICAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcblx0ICAgIHJldHVybiAnb2JqZWN0JyA9PT0gKHR5cGVvZiBjb25zb2xlID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihjb25zb2xlKSkgJiYgY29uc29sZS5sb2cgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogU2F2ZSBgbmFtZXNwYWNlc2AuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICBpZiAobnVsbCA9PSBuYW1lc3BhY2VzKSB7XG5cdCAgICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgZXhwb3J0cy5zdG9yYWdlLmRlYnVnID0gbmFtZXNwYWNlcztcblx0ICAgICAgfVxuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBMb2FkIGBuYW1lc3BhY2VzYC5cblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGxvYWQoKSB7XG5cdCAgICB2YXIgcjtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHIgPSBleHBvcnRzLnN0b3JhZ2UuZGVidWc7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgICAvLyBJZiBkZWJ1ZyBpc24ndCBzZXQgaW4gTFMsIGFuZCB3ZSdyZSBpbiBFbGVjdHJvbiwgdHJ5IHRvIGxvYWQgJERFQlVHXG5cdCAgICBpZiAoIXIgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmICdlbnYnIGluIHByb2Nlc3MpIHtcblx0ICAgICAgciA9IHByb2Nlc3MuZW52LkRFQlVHO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gcjtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBFbmFibGUgbmFtZXNwYWNlcyBsaXN0ZWQgaW4gYGxvY2FsU3RvcmFnZS5kZWJ1Z2AgaW5pdGlhbGx5LlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuXHQgIC8qKlxuXHQgICAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cblx0ICAgKlxuXHQgICAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugc2FmYXJpIHRocm93c1xuXHQgICAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG5cdCAgICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiB3aW5kb3cubG9jYWxTdG9yYWdlO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICB9XG5cdH0pO1xuXHR2YXIgYnJvd3Nlcl8xID0gYnJvd3Nlci5sb2c7XG5cdHZhciBicm93c2VyXzIgPSBicm93c2VyLmZvcm1hdEFyZ3M7XG5cdHZhciBicm93c2VyXzMgPSBicm93c2VyLnNhdmU7XG5cdHZhciBicm93c2VyXzQgPSBicm93c2VyLmxvYWQ7XG5cdHZhciBicm93c2VyXzUgPSBicm93c2VyLnVzZUNvbG9ycztcblx0dmFyIGJyb3dzZXJfNiA9IGJyb3dzZXIuc3RvcmFnZTtcblx0dmFyIGJyb3dzZXJfNyA9IGJyb3dzZXIuY29sb3JzO1xuXG5cdHZhciBicm93c2VyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYnJvd3Nlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJyb3dzZXIsXG5cdFx0bG9nOiBicm93c2VyXzEsXG5cdFx0Zm9ybWF0QXJnczogYnJvd3Nlcl8yLFxuXHRcdHNhdmU6IGJyb3dzZXJfMyxcblx0XHRsb2FkOiBicm93c2VyXzQsXG5cdFx0dXNlQ29sb3JzOiBicm93c2VyXzUsXG5cdFx0c3RvcmFnZTogYnJvd3Nlcl82LFxuXHRcdGNvbG9yczogYnJvd3Nlcl83XG5cdH0pO1xuXG5cdHZhciBwYXJzZXVyaSQyID0gKCBwYXJzZXVyaSQxICYmIHBhcnNldXJpICkgfHwgcGFyc2V1cmkkMTtcblxuXHR2YXIgcmVxdWlyZSQkMCQyID0gKCBicm93c2VyJDEgJiYgYnJvd3NlciApIHx8IGJyb3dzZXIkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDIgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQ6dXJsJyk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgdXJsXzEgPSB1cmw7XG5cblx0LyoqXG5cdCAqIFVSTCBwYXJzZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB1cmxcblx0ICogQHBhcmFtIHtPYmplY3R9IEFuIG9iamVjdCBtZWFudCB0byBtaW1pYyB3aW5kb3cubG9jYXRpb24uXG5cdCAqICAgICAgICAgICAgICAgICBEZWZhdWx0cyB0byB3aW5kb3cubG9jYXRpb24uXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIHVybCh1cmksIGxvYykge1xuXHQgIHZhciBvYmogPSB1cmk7XG5cblx0ICAvLyBkZWZhdWx0IHRvIHdpbmRvdy5sb2NhdGlvblxuXHQgIGxvYyA9IGxvYyB8fCBjb21tb25qc0dsb2JhbC5sb2NhdGlvbjtcblx0ICBpZiAobnVsbCA9PSB1cmkpIHVyaSA9IGxvYy5wcm90b2NvbCArICcvLycgKyBsb2MuaG9zdDtcblxuXHQgIC8vIHJlbGF0aXZlIHBhdGggc3VwcG9ydFxuXHQgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHVyaSkge1xuXHQgICAgaWYgKCcvJyA9PT0gdXJpLmNoYXJBdCgwKSkge1xuXHQgICAgICBpZiAoJy8nID09PSB1cmkuY2hhckF0KDEpKSB7XG5cdCAgICAgICAgdXJpID0gbG9jLnByb3RvY29sICsgdXJpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHVyaSA9IGxvYy5ob3N0ICsgdXJpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGlmICghL14oaHR0cHM/fHdzcz8pOlxcL1xcLy8udGVzdCh1cmkpKSB7XG5cdCAgICAgIGRlYnVnJDIoJ3Byb3RvY29sLWxlc3MgdXJsICVzJywgdXJpKTtcblx0ICAgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgbG9jKSB7XG5cdCAgICAgICAgdXJpID0gbG9jLnByb3RvY29sICsgJy8vJyArIHVyaTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB1cmkgPSAnaHR0cHM6Ly8nICsgdXJpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIC8vIHBhcnNlXG5cdCAgICBkZWJ1ZyQyKCdwYXJzZSAlcycsIHVyaSk7XG5cdCAgICBvYmogPSBwYXJzZXVyaSQyKHVyaSk7XG5cdCAgfVxuXG5cdCAgLy8gbWFrZSBzdXJlIHdlIHRyZWF0IGBsb2NhbGhvc3Q6ODBgIGFuZCBgbG9jYWxob3N0YCBlcXVhbGx5XG5cdCAgaWYgKCFvYmoucG9ydCkge1xuXHQgICAgaWYgKC9eKGh0dHB8d3MpJC8udGVzdChvYmoucHJvdG9jb2wpKSB7XG5cdCAgICAgIG9iai5wb3J0ID0gJzgwJztcblx0ICAgIH0gZWxzZSBpZiAoL14oaHR0cHx3cylzJC8udGVzdChvYmoucHJvdG9jb2wpKSB7XG5cdCAgICAgIG9iai5wb3J0ID0gJzQ0Myc7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgb2JqLnBhdGggPSBvYmoucGF0aCB8fCAnLyc7XG5cblx0ICB2YXIgaXB2NiA9IG9iai5ob3N0LmluZGV4T2YoJzonKSAhPT0gLTE7XG5cdCAgdmFyIGhvc3QgPSBpcHY2ID8gJ1snICsgb2JqLmhvc3QgKyAnXScgOiBvYmouaG9zdDtcblxuXHQgIC8vIGRlZmluZSB1bmlxdWUgaWRcblx0ICBvYmouaWQgPSBvYmoucHJvdG9jb2wgKyAnOi8vJyArIGhvc3QgKyAnOicgKyBvYmoucG9ydDtcblx0ICAvLyBkZWZpbmUgaHJlZlxuXHQgIG9iai5ocmVmID0gb2JqLnByb3RvY29sICsgJzovLycgKyBob3N0ICsgKGxvYyAmJiBsb2MucG9ydCA9PT0gb2JqLnBvcnQgPyAnJyA6ICc6JyArIG9iai5wb3J0KTtcblxuXHQgIHJldHVybiBvYmo7XG5cdH1cblxuXHR2YXIgdXJsJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogdXJsXzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB1cmxfMVxuXHR9KTtcblxuXHR2YXIgY29tcG9uZW50RW1pdHRlciA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAvKipcclxuXHQgICAqIEV4cG9zZSBgRW1pdHRlcmAuXHJcblx0ICAgKi9cblxuXHQgIHtcblx0ICAgIG1vZHVsZS5leHBvcnRzID0gRW1pdHRlcjtcblx0ICB9XG5cblx0ICAvKipcclxuXHQgICAqIEluaXRpYWxpemUgYSBuZXcgYEVtaXR0ZXJgLlxyXG5cdCAgICpcclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIEVtaXR0ZXIob2JqKSB7XG5cdCAgICBpZiAob2JqKSByZXR1cm4gbWl4aW4ob2JqKTtcblx0ICB9XG5cdCAgLyoqXHJcblx0ICAgKiBNaXhpbiB0aGUgZW1pdHRlciBwcm9wZXJ0aWVzLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcclxuXHQgICAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgICAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBtaXhpbihvYmopIHtcblx0ICAgIGZvciAodmFyIGtleSBpbiBFbWl0dGVyLnByb3RvdHlwZSkge1xuXHQgICAgICBvYmpba2V5XSA9IEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG5cdCAgICB9XG5cdCAgICByZXR1cm4gb2JqO1xuXHQgIH1cblxuXHQgIC8qKlxyXG5cdCAgICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcblx0ICAgKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUub24gPSBFbWl0dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuXHQgICAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXHQgICAgKHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdKS5wdXNoKGZuKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxyXG5cdCAgICogdGltZSB0aGVuIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZC5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcblx0ICAgKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0ICAgIGZ1bmN0aW9uIG9uKCkge1xuXHQgICAgICB0aGlzLm9mZihldmVudCwgb24pO1xuXHQgICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHQgICAgfVxuXG5cdCAgICBvbi5mbiA9IGZuO1xuXHQgICAgdGhpcy5vbihldmVudCwgb24pO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogUmVtb3ZlIHRoZSBnaXZlbiBjYWxsYmFjayBmb3IgYGV2ZW50YCBvciBhbGxcclxuXHQgICAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cblx0ICAgIC8vIGFsbFxuXHQgICAgaWYgKDAgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuXHQgICAgICB0aGlzLl9jYWxsYmFja3MgPSB7fTtcblx0ICAgICAgcmV0dXJuIHRoaXM7XG5cdCAgICB9XG5cblx0ICAgIC8vIHNwZWNpZmljIGV2ZW50XG5cdCAgICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcblx0ICAgIGlmICghY2FsbGJhY2tzKSByZXR1cm4gdGhpcztcblxuXHQgICAgLy8gcmVtb3ZlIGFsbCBoYW5kbGVyc1xuXHQgICAgaWYgKDEgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuXHQgICAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcblx0ICAgICAgcmV0dXJuIHRoaXM7XG5cdCAgICB9XG5cblx0ICAgIC8vIHJlbW92ZSBzcGVjaWZpYyBoYW5kbGVyXG5cdCAgICB2YXIgY2I7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBjYiA9IGNhbGxiYWNrc1tpXTtcblx0ICAgICAgaWYgKGNiID09PSBmbiB8fCBjYi5mbiA9PT0gZm4pIHtcblx0ICAgICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBFbWl0IGBldmVudGAgd2l0aCB0aGUgZ2l2ZW4gYXJncy5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEBwYXJhbSB7TWl4ZWR9IC4uLlxyXG5cdCAgICogQHJldHVybiB7RW1pdHRlcn1cclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXHQgICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG5cdCAgICAgICAgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcblxuXHQgICAgaWYgKGNhbGxiYWNrcykge1xuXHQgICAgICBjYWxsYmFja3MgPSBjYWxsYmFja3Muc2xpY2UoMCk7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjYWxsYmFja3MubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcblx0ICAgICAgICBjYWxsYmFja3NbaV0uYXBwbHkodGhpcywgYXJncyk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogUmV0dXJuIGFycmF5IG9mIGNhbGxiYWNrcyBmb3IgYGV2ZW50YC5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEByZXR1cm4ge0FycmF5fVxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdCAgICByZXR1cm4gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSB8fCBbXTtcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBDaGVjayBpZiB0aGlzIGVtaXR0ZXIgaGFzIGBldmVudGAgaGFuZGxlcnMuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcmV0dXJuIHtCb29sZWFufVxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUuaGFzTGlzdGVuZXJzID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICByZXR1cm4gISF0aGlzLmxpc3RlbmVycyhldmVudCkubGVuZ3RoO1xuXHQgIH07XG5cdH0pO1xuXG5cdHZhciBjb21wb25lbnRFbWl0dGVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogY29tcG9uZW50RW1pdHRlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGNvbXBvbmVudEVtaXR0ZXJcblx0fSk7XG5cblx0dmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cblx0dmFyIGlzYXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcblx0ICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG5cdH07XG5cblx0dmFyIGlzYXJyYXkkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBpc2FycmF5LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaXNhcnJheVxuXHR9KTtcblxuXHR2YXIgaXNCdWZmZXIgPSBpc0J1ZjtcblxuXHR2YXIgd2l0aE5hdGl2ZUJ1ZmZlciA9IHR5cGVvZiBjb21tb25qc0dsb2JhbC5CdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkJ1ZmZlci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJztcblx0dmFyIHdpdGhOYXRpdmVBcnJheUJ1ZmZlciA9IHR5cGVvZiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJztcblxuXHR2YXIgaXNWaWV3ID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh3aXRoTmF0aXZlQXJyYXlCdWZmZXIgJiYgdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyLmlzVmlldyA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgcmV0dXJuIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyLmlzVmlldztcblx0ICB9IGVsc2Uge1xuXHQgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmopIHtcblx0ICAgICAgcmV0dXJuIG9iai5idWZmZXIgaW5zdGFuY2VvZiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlcjtcblx0ICAgIH07XG5cdCAgfVxuXHR9KCk7XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiBvYmogaXMgYSBidWZmZXIgb3IgYW4gYXJyYXlidWZmZXIuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBpc0J1ZihvYmopIHtcblx0ICByZXR1cm4gd2l0aE5hdGl2ZUJ1ZmZlciAmJiBjb21tb25qc0dsb2JhbC5CdWZmZXIuaXNCdWZmZXIob2JqKSB8fCB3aXRoTmF0aXZlQXJyYXlCdWZmZXIgJiYgKG9iaiBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyIHx8IGlzVmlldyhvYmopKTtcblx0fVxuXG5cdHZhciBpc0J1ZmZlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGlzQnVmZmVyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaXNCdWZmZXJcblx0fSk7XG5cblx0dmFyIGlzQXJyYXkgPSAoIGlzYXJyYXkkMSAmJiBpc2FycmF5ICkgfHwgaXNhcnJheSQxO1xuXG5cdHZhciBpc0J1ZiQxID0gKCBpc0J1ZmZlciQxICYmIGlzQnVmZmVyICkgfHwgaXNCdWZmZXIkMTtcblxuXHQvKmdsb2JhbCBCbG9iLEZpbGUqL1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgcmVxdWlyZW1lbnRzXG5cdCAqL1xuXG5cdHZhciB0b1N0cmluZyQxID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblx0dmFyIHdpdGhOYXRpdmVCbG9iID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkJsb2IgPT09ICdmdW5jdGlvbicgfHwgdG9TdHJpbmckMS5jYWxsKGNvbW1vbmpzR2xvYmFsLkJsb2IpID09PSAnW29iamVjdCBCbG9iQ29uc3RydWN0b3JdJztcblx0dmFyIHdpdGhOYXRpdmVGaWxlID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkZpbGUgPT09ICdmdW5jdGlvbicgfHwgdG9TdHJpbmckMS5jYWxsKGNvbW1vbmpzR2xvYmFsLkZpbGUpID09PSAnW29iamVjdCBGaWxlQ29uc3RydWN0b3JdJztcblxuXHQvKipcblx0ICogUmVwbGFjZXMgZXZlcnkgQnVmZmVyIHwgQXJyYXlCdWZmZXIgaW4gcGFja2V0IHdpdGggYSBudW1iZXJlZCBwbGFjZWhvbGRlci5cblx0ICogQW55dGhpbmcgd2l0aCBibG9icyBvciBmaWxlcyBzaG91bGQgYmUgZmVkIHRocm91Z2ggcmVtb3ZlQmxvYnMgYmVmb3JlIGNvbWluZ1xuXHQgKiBoZXJlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0IC0gc29ja2V0LmlvIGV2ZW50IHBhY2tldFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IHdpdGggZGVjb25zdHJ1Y3RlZCBwYWNrZXQgYW5kIGxpc3Qgb2YgYnVmZmVyc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgZGVjb25zdHJ1Y3RQYWNrZXQgPSBmdW5jdGlvbiBkZWNvbnN0cnVjdFBhY2tldChwYWNrZXQpIHtcblx0ICB2YXIgYnVmZmVycyA9IFtdO1xuXHQgIHZhciBwYWNrZXREYXRhID0gcGFja2V0LmRhdGE7XG5cdCAgdmFyIHBhY2sgPSBwYWNrZXQ7XG5cdCAgcGFjay5kYXRhID0gX2RlY29uc3RydWN0UGFja2V0KHBhY2tldERhdGEsIGJ1ZmZlcnMpO1xuXHQgIHBhY2suYXR0YWNobWVudHMgPSBidWZmZXJzLmxlbmd0aDsgLy8gbnVtYmVyIG9mIGJpbmFyeSAnYXR0YWNobWVudHMnXG5cdCAgcmV0dXJuIHsgcGFja2V0OiBwYWNrLCBidWZmZXJzOiBidWZmZXJzIH07XG5cdH07XG5cblx0ZnVuY3Rpb24gX2RlY29uc3RydWN0UGFja2V0KGRhdGEsIGJ1ZmZlcnMpIHtcblx0ICBpZiAoIWRhdGEpIHJldHVybiBkYXRhO1xuXG5cdCAgaWYgKGlzQnVmJDEoZGF0YSkpIHtcblx0ICAgIHZhciBwbGFjZWhvbGRlciA9IHsgX3BsYWNlaG9sZGVyOiB0cnVlLCBudW06IGJ1ZmZlcnMubGVuZ3RoIH07XG5cdCAgICBidWZmZXJzLnB1c2goZGF0YSk7XG5cdCAgICByZXR1cm4gcGxhY2Vob2xkZXI7XG5cdCAgfSBlbHNlIGlmIChpc0FycmF5KGRhdGEpKSB7XG5cdCAgICB2YXIgbmV3RGF0YSA9IG5ldyBBcnJheShkYXRhLmxlbmd0aCk7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgbmV3RGF0YVtpXSA9IF9kZWNvbnN0cnVjdFBhY2tldChkYXRhW2ldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBuZXdEYXRhO1xuXHQgIH0gZWxzZSBpZiAoKHR5cGVvZiBkYXRhID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihkYXRhKSkgPT09ICdvYmplY3QnICYmICEoZGF0YSBpbnN0YW5jZW9mIERhdGUpKSB7XG5cdCAgICB2YXIgbmV3RGF0YSA9IHt9O1xuXHQgICAgZm9yICh2YXIga2V5IGluIGRhdGEpIHtcblx0ICAgICAgbmV3RGF0YVtrZXldID0gX2RlY29uc3RydWN0UGFja2V0KGRhdGFba2V5XSwgYnVmZmVycyk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gbmV3RGF0YTtcblx0ICB9XG5cdCAgcmV0dXJuIGRhdGE7XG5cdH1cblxuXHQvKipcblx0ICogUmVjb25zdHJ1Y3RzIGEgYmluYXJ5IHBhY2tldCBmcm9tIGl0cyBwbGFjZWhvbGRlciBwYWNrZXQgYW5kIGJ1ZmZlcnNcblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHBhY2tldCAtIGV2ZW50IHBhY2tldCB3aXRoIHBsYWNlaG9sZGVyc1xuXHQgKiBAcGFyYW0ge0FycmF5fSBidWZmZXJzIC0gYmluYXJ5IGJ1ZmZlcnMgdG8gcHV0IGluIHBsYWNlaG9sZGVyIHBvc2l0aW9uc1xuXHQgKiBAcmV0dXJuIHtPYmplY3R9IHJlY29uc3RydWN0ZWQgcGFja2V0XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciByZWNvbnN0cnVjdFBhY2tldCA9IGZ1bmN0aW9uIHJlY29uc3RydWN0UGFja2V0KHBhY2tldCwgYnVmZmVycykge1xuXHQgIHBhY2tldC5kYXRhID0gX3JlY29uc3RydWN0UGFja2V0KHBhY2tldC5kYXRhLCBidWZmZXJzKTtcblx0ICBwYWNrZXQuYXR0YWNobWVudHMgPSB1bmRlZmluZWQ7IC8vIG5vIGxvbmdlciB1c2VmdWxcblx0ICByZXR1cm4gcGFja2V0O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIF9yZWNvbnN0cnVjdFBhY2tldChkYXRhLCBidWZmZXJzKSB7XG5cdCAgaWYgKCFkYXRhKSByZXR1cm4gZGF0YTtcblxuXHQgIGlmIChkYXRhICYmIGRhdGEuX3BsYWNlaG9sZGVyKSB7XG5cdCAgICByZXR1cm4gYnVmZmVyc1tkYXRhLm51bV07IC8vIGFwcHJvcHJpYXRlIGJ1ZmZlciAoc2hvdWxkIGJlIG5hdHVyYWwgb3JkZXIgYW55d2F5KVxuXHQgIH0gZWxzZSBpZiAoaXNBcnJheShkYXRhKSkge1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGRhdGFbaV0gPSBfcmVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtpXSwgYnVmZmVycyk7XG5cdCAgICB9XG5cdCAgfSBlbHNlIGlmICgodHlwZW9mIGRhdGEgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGRhdGEpKSA9PT0gJ29iamVjdCcpIHtcblx0ICAgIGZvciAodmFyIGtleSBpbiBkYXRhKSB7XG5cdCAgICAgIGRhdGFba2V5XSA9IF9yZWNvbnN0cnVjdFBhY2tldChkYXRhW2tleV0sIGJ1ZmZlcnMpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBkYXRhO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFzeW5jaHJvbm91c2x5IHJlbW92ZXMgQmxvYnMgb3IgRmlsZXMgZnJvbSBkYXRhIHZpYVxuXHQgKiBGaWxlUmVhZGVyJ3MgcmVhZEFzQXJyYXlCdWZmZXIgbWV0aG9kLiBVc2VkIGJlZm9yZSBlbmNvZGluZ1xuXHQgKiBkYXRhIGFzIG1zZ3BhY2suIENhbGxzIGNhbGxiYWNrIHdpdGggdGhlIGJsb2JsZXNzIGRhdGEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHR2YXIgcmVtb3ZlQmxvYnMgPSBmdW5jdGlvbiByZW1vdmVCbG9icyhkYXRhLCBjYWxsYmFjaykge1xuXHQgIGZ1bmN0aW9uIF9yZW1vdmVCbG9icyhvYmosIGN1cktleSwgY29udGFpbmluZ09iamVjdCkge1xuXHQgICAgaWYgKCFvYmopIHJldHVybiBvYmo7XG5cblx0ICAgIC8vIGNvbnZlcnQgYW55IGJsb2Jcblx0ICAgIGlmICh3aXRoTmF0aXZlQmxvYiAmJiBvYmogaW5zdGFuY2VvZiBCbG9iIHx8IHdpdGhOYXRpdmVGaWxlICYmIG9iaiBpbnN0YW5jZW9mIEZpbGUpIHtcblx0ICAgICAgcGVuZGluZ0Jsb2JzKys7XG5cblx0ICAgICAgLy8gYXN5bmMgZmlsZXJlYWRlclxuXHQgICAgICB2YXIgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdCAgICAgIGZpbGVSZWFkZXIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIC8vIHRoaXMucmVzdWx0ID09IGFycmF5YnVmZmVyXG5cdCAgICAgICAgaWYgKGNvbnRhaW5pbmdPYmplY3QpIHtcblx0ICAgICAgICAgIGNvbnRhaW5pbmdPYmplY3RbY3VyS2V5XSA9IHRoaXMucmVzdWx0O1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBibG9ibGVzc0RhdGEgPSB0aGlzLnJlc3VsdDtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICAvLyBpZiBub3RoaW5nIHBlbmRpbmcgaXRzIGNhbGxiYWNrIHRpbWVcblx0ICAgICAgICBpZiAoISAtLXBlbmRpbmdCbG9icykge1xuXHQgICAgICAgICAgY2FsbGJhY2soYmxvYmxlc3NEYXRhKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cblx0ICAgICAgZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihvYmopOyAvLyBibG9iIC0+IGFycmF5YnVmZmVyXG5cdCAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqKSkge1xuXHQgICAgICAvLyBoYW5kbGUgYXJyYXlcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBfcmVtb3ZlQmxvYnMob2JqW2ldLCBpLCBvYmopO1xuXHQgICAgICB9XG5cdCAgICB9IGVsc2UgaWYgKCh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihvYmopKSA9PT0gJ29iamVjdCcgJiYgIWlzQnVmJDEob2JqKSkge1xuXHQgICAgICAvLyBhbmQgb2JqZWN0XG5cdCAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcblx0ICAgICAgICBfcmVtb3ZlQmxvYnMob2JqW2tleV0sIGtleSwgb2JqKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH1cblxuXHQgIHZhciBwZW5kaW5nQmxvYnMgPSAwO1xuXHQgIHZhciBibG9ibGVzc0RhdGEgPSBkYXRhO1xuXHQgIF9yZW1vdmVCbG9icyhibG9ibGVzc0RhdGEpO1xuXHQgIGlmICghcGVuZGluZ0Jsb2JzKSB7XG5cdCAgICBjYWxsYmFjayhibG9ibGVzc0RhdGEpO1xuXHQgIH1cblx0fTtcblxuXHR2YXIgYmluYXJ5ID0ge1xuXHQgIGRlY29uc3RydWN0UGFja2V0OiBkZWNvbnN0cnVjdFBhY2tldCxcblx0ICByZWNvbnN0cnVjdFBhY2tldDogcmVjb25zdHJ1Y3RQYWNrZXQsXG5cdCAgcmVtb3ZlQmxvYnM6IHJlbW92ZUJsb2JzXG5cdH07XG5cblx0dmFyIGJpbmFyeSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJpbmFyeSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJpbmFyeSxcblx0XHRkZWNvbnN0cnVjdFBhY2tldDogZGVjb25zdHJ1Y3RQYWNrZXQsXG5cdFx0cmVjb25zdHJ1Y3RQYWNrZXQ6IHJlY29uc3RydWN0UGFja2V0LFxuXHRcdHJlbW92ZUJsb2JzOiByZW1vdmVCbG9ic1xuXHR9KTtcblxuXHR2YXIgRW1pdHRlciA9ICggY29tcG9uZW50RW1pdHRlciQxICYmIGNvbXBvbmVudEVtaXR0ZXIgKSB8fCBjb21wb25lbnRFbWl0dGVyJDE7XG5cblx0dmFyIGJpbmFyeSQyID0gKCBiaW5hcnkkMSAmJiBiaW5hcnkgKSB8fCBiaW5hcnkkMTtcblxuXHR2YXIgc29ja2V0X2lvUGFyc2VyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgZGVidWcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1wYXJzZXInKTtcblxuXHQgIC8qKlxuXHQgICAqIFByb3RvY29sIHZlcnNpb24uXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5wcm90b2NvbCA9IDQ7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZXMuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy50eXBlcyA9IFsnQ09OTkVDVCcsICdESVNDT05ORUNUJywgJ0VWRU5UJywgJ0FDSycsICdFUlJPUicsICdCSU5BUllfRVZFTlQnLCAnQklOQVJZX0FDSyddO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGNvbm5lY3RgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQ09OTkVDVCA9IDA7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgZGlzY29ubmVjdGAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5ESVNDT05ORUNUID0gMTtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBldmVudGAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5FVkVOVCA9IDI7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgYWNrYC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkFDSyA9IDM7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgZXJyb3JgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRVJST1IgPSA0O1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgJ2JpbmFyeSBldmVudCdcblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkJJTkFSWV9FVkVOVCA9IDU7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgYmluYXJ5IGFja2AuIEZvciBhY2tzIHdpdGggYmluYXJ5IGFyZ3VtZW50cy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkJJTkFSWV9BQ0sgPSA2O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlciBjb25zdHJ1Y3Rvci5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkVuY29kZXIgPSBFbmNvZGVyO1xuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlciBjb25zdHJ1Y3Rvci5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkRlY29kZXIgPSBEZWNvZGVyO1xuXG5cdCAgLyoqXG5cdCAgICogQSBzb2NrZXQuaW8gRW5jb2RlciBpbnN0YW5jZVxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIEVuY29kZXIoKSB7fVxuXG5cdCAgdmFyIEVSUk9SX1BBQ0tFVCA9IGV4cG9ydHMuRVJST1IgKyAnXCJlbmNvZGUgZXJyb3JcIic7XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgYSBwYWNrZXQgYXMgYSBzaW5nbGUgc3RyaW5nIGlmIG5vbi1iaW5hcnksIG9yIGFzIGFcblx0ICAgKiBidWZmZXIgc2VxdWVuY2UsIGRlcGVuZGluZyBvbiBwYWNrZXQgdHlwZS5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBwYWNrZXQgb2JqZWN0XG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBmdW5jdGlvbiB0byBoYW5kbGUgZW5jb2RpbmdzIChsaWtlbHkgZW5naW5lLndyaXRlKVxuXHQgICAqIEByZXR1cm4gQ2FsbHMgY2FsbGJhY2sgd2l0aCBBcnJheSBvZiBlbmNvZGluZ3Ncblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgRW5jb2Rlci5wcm90b3R5cGUuZW5jb2RlID0gZnVuY3Rpb24gKG9iaiwgY2FsbGJhY2spIHtcblx0ICAgIGRlYnVnKCdlbmNvZGluZyBwYWNrZXQgJWonLCBvYmopO1xuXG5cdCAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IG9iai50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gb2JqLnR5cGUpIHtcblx0ICAgICAgZW5jb2RlQXNCaW5hcnkob2JqLCBjYWxsYmFjayk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB2YXIgZW5jb2RpbmcgPSBlbmNvZGVBc1N0cmluZyhvYmopO1xuXHQgICAgICBjYWxsYmFjayhbZW5jb2RpbmddKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIHBhY2tldCBhcyBzdHJpbmcuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQHJldHVybiB7U3RyaW5nfSBlbmNvZGVkXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmNvZGVBc1N0cmluZyhvYmopIHtcblxuXHQgICAgLy8gZmlyc3QgaXMgdHlwZVxuXHQgICAgdmFyIHN0ciA9ICcnICsgb2JqLnR5cGU7XG5cblx0ICAgIC8vIGF0dGFjaG1lbnRzIGlmIHdlIGhhdmUgdGhlbVxuXHQgICAgaWYgKGV4cG9ydHMuQklOQVJZX0VWRU5UID09PSBvYmoudHlwZSB8fCBleHBvcnRzLkJJTkFSWV9BQ0sgPT09IG9iai50eXBlKSB7XG5cdCAgICAgIHN0ciArPSBvYmouYXR0YWNobWVudHMgKyAnLSc7XG5cdCAgICB9XG5cblx0ICAgIC8vIGlmIHdlIGhhdmUgYSBuYW1lc3BhY2Ugb3RoZXIgdGhhbiBgL2Bcblx0ICAgIC8vIHdlIGFwcGVuZCBpdCBmb2xsb3dlZCBieSBhIGNvbW1hIGAsYFxuXHQgICAgaWYgKG9iai5uc3AgJiYgJy8nICE9PSBvYmoubnNwKSB7XG5cdCAgICAgIHN0ciArPSBvYmoubnNwICsgJywnO1xuXHQgICAgfVxuXG5cdCAgICAvLyBpbW1lZGlhdGVseSBmb2xsb3dlZCBieSB0aGUgaWRcblx0ICAgIGlmIChudWxsICE9IG9iai5pZCkge1xuXHQgICAgICBzdHIgKz0gb2JqLmlkO1xuXHQgICAgfVxuXG5cdCAgICAvLyBqc29uIGRhdGFcblx0ICAgIGlmIChudWxsICE9IG9iai5kYXRhKSB7XG5cdCAgICAgIHZhciBwYXlsb2FkID0gdHJ5U3RyaW5naWZ5KG9iai5kYXRhKTtcblx0ICAgICAgaWYgKHBheWxvYWQgIT09IGZhbHNlKSB7XG5cdCAgICAgICAgc3RyICs9IHBheWxvYWQ7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIEVSUk9SX1BBQ0tFVDtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBkZWJ1ZygnZW5jb2RlZCAlaiBhcyAlcycsIG9iaiwgc3RyKTtcblx0ICAgIHJldHVybiBzdHI7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdHJ5U3RyaW5naWZ5KHN0cikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHN0cik7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgcGFja2V0IGFzICdidWZmZXIgc2VxdWVuY2UnIGJ5IHJlbW92aW5nIGJsb2JzLCBhbmRcblx0ICAgKiBkZWNvbnN0cnVjdGluZyBwYWNrZXQgaW50byBvYmplY3Qgd2l0aCBwbGFjZWhvbGRlcnMgYW5kXG5cdCAgICogYSBsaXN0IG9mIGJ1ZmZlcnMuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQHJldHVybiB7QnVmZmVyfSBlbmNvZGVkXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmNvZGVBc0JpbmFyeShvYmosIGNhbGxiYWNrKSB7XG5cblx0ICAgIGZ1bmN0aW9uIHdyaXRlRW5jb2RpbmcoYmxvYmxlc3NEYXRhKSB7XG5cdCAgICAgIHZhciBkZWNvbnN0cnVjdGlvbiA9IGJpbmFyeSQyLmRlY29uc3RydWN0UGFja2V0KGJsb2JsZXNzRGF0YSk7XG5cdCAgICAgIHZhciBwYWNrID0gZW5jb2RlQXNTdHJpbmcoZGVjb25zdHJ1Y3Rpb24ucGFja2V0KTtcblx0ICAgICAgdmFyIGJ1ZmZlcnMgPSBkZWNvbnN0cnVjdGlvbi5idWZmZXJzO1xuXG5cdCAgICAgIGJ1ZmZlcnMudW5zaGlmdChwYWNrKTsgLy8gYWRkIHBhY2tldCBpbmZvIHRvIGJlZ2lubmluZyBvZiBkYXRhIGxpc3Rcblx0ICAgICAgY2FsbGJhY2soYnVmZmVycyk7IC8vIHdyaXRlIGFsbCB0aGUgYnVmZmVyc1xuXHQgICAgfVxuXG5cdCAgICBiaW5hcnkkMi5yZW1vdmVCbG9icyhvYmosIHdyaXRlRW5jb2RpbmcpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEEgc29ja2V0LmlvIERlY29kZXIgaW5zdGFuY2Vcblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gZGVjb2RlclxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBEZWNvZGVyKCkge1xuXHQgICAgdGhpcy5yZWNvbnN0cnVjdG9yID0gbnVsbDtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBNaXggaW4gYEVtaXR0ZXJgIHdpdGggRGVjb2Rlci5cblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIoRGVjb2Rlci5wcm90b3R5cGUpO1xuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlcyBhbiBlY29kZWQgcGFja2V0IHN0cmluZyBpbnRvIHBhY2tldCBKU09OLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG9iaiAtIGVuY29kZWQgcGFja2V0XG5cdCAgICogQHJldHVybiB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgRGVjb2Rlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKG9iaikge1xuXHQgICAgdmFyIHBhY2tldDtcblx0ICAgIGlmICh0eXBlb2Ygb2JqID09PSAnc3RyaW5nJykge1xuXHQgICAgICBwYWNrZXQgPSBkZWNvZGVTdHJpbmcob2JqKTtcblx0ICAgICAgaWYgKGV4cG9ydHMuQklOQVJZX0VWRU5UID09PSBwYWNrZXQudHlwZSB8fCBleHBvcnRzLkJJTkFSWV9BQ0sgPT09IHBhY2tldC50eXBlKSB7XG5cdCAgICAgICAgLy8gYmluYXJ5IHBhY2tldCdzIGpzb25cblx0ICAgICAgICB0aGlzLnJlY29uc3RydWN0b3IgPSBuZXcgQmluYXJ5UmVjb25zdHJ1Y3RvcihwYWNrZXQpO1xuXG5cdCAgICAgICAgLy8gbm8gYXR0YWNobWVudHMsIGxhYmVsZWQgYmluYXJ5IGJ1dCBubyBiaW5hcnkgZGF0YSB0byBmb2xsb3dcblx0ICAgICAgICBpZiAodGhpcy5yZWNvbnN0cnVjdG9yLnJlY29uUGFjay5hdHRhY2htZW50cyA9PT0gMCkge1xuXHQgICAgICAgICAgdGhpcy5lbWl0KCdkZWNvZGVkJywgcGFja2V0KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgLy8gbm9uLWJpbmFyeSBmdWxsIHBhY2tldFxuXHQgICAgICAgIHRoaXMuZW1pdCgnZGVjb2RlZCcsIHBhY2tldCk7XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSBpZiAoaXNCdWYkMShvYmopIHx8IG9iai5iYXNlNjQpIHtcblx0ICAgICAgLy8gcmF3IGJpbmFyeSBkYXRhXG5cdCAgICAgIGlmICghdGhpcy5yZWNvbnN0cnVjdG9yKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdnb3QgYmluYXJ5IGRhdGEgd2hlbiBub3QgcmVjb25zdHJ1Y3RpbmcgYSBwYWNrZXQnKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBwYWNrZXQgPSB0aGlzLnJlY29uc3RydWN0b3IudGFrZUJpbmFyeURhdGEob2JqKTtcblx0ICAgICAgICBpZiAocGFja2V0KSB7XG5cdCAgICAgICAgICAvLyByZWNlaXZlZCBmaW5hbCBidWZmZXJcblx0ICAgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG51bGw7XG5cdCAgICAgICAgICB0aGlzLmVtaXQoJ2RlY29kZWQnLCBwYWNrZXQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHR5cGU6ICcgKyBvYmopO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGUgYSBwYWNrZXQgU3RyaW5nIChKU09OIGRhdGEpXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyXG5cdCAgICogQHJldHVybiB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGRlY29kZVN0cmluZyhzdHIpIHtcblx0ICAgIHZhciBpID0gMDtcblx0ICAgIC8vIGxvb2sgdXAgdHlwZVxuXHQgICAgdmFyIHAgPSB7XG5cdCAgICAgIHR5cGU6IE51bWJlcihzdHIuY2hhckF0KDApKVxuXHQgICAgfTtcblxuXHQgICAgaWYgKG51bGwgPT0gZXhwb3J0cy50eXBlc1twLnR5cGVdKSB7XG5cdCAgICAgIHJldHVybiBlcnJvcigndW5rbm93biBwYWNrZXQgdHlwZSAnICsgcC50eXBlKTtcblx0ICAgIH1cblxuXHQgICAgLy8gbG9vayB1cCBhdHRhY2htZW50cyBpZiB0eXBlIGJpbmFyeVxuXHQgICAgaWYgKGV4cG9ydHMuQklOQVJZX0VWRU5UID09PSBwLnR5cGUgfHwgZXhwb3J0cy5CSU5BUllfQUNLID09PSBwLnR5cGUpIHtcblx0ICAgICAgdmFyIGJ1ZiA9ICcnO1xuXHQgICAgICB3aGlsZSAoc3RyLmNoYXJBdCgrK2kpICE9PSAnLScpIHtcblx0ICAgICAgICBidWYgKz0gc3RyLmNoYXJBdChpKTtcblx0ICAgICAgICBpZiAoaSA9PSBzdHIubGVuZ3RoKSBicmVhaztcblx0ICAgICAgfVxuXHQgICAgICBpZiAoYnVmICE9IE51bWJlcihidWYpIHx8IHN0ci5jaGFyQXQoaSkgIT09ICctJykge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBhdHRhY2htZW50cycpO1xuXHQgICAgICB9XG5cdCAgICAgIHAuYXR0YWNobWVudHMgPSBOdW1iZXIoYnVmKTtcblx0ICAgIH1cblxuXHQgICAgLy8gbG9vayB1cCBuYW1lc3BhY2UgKGlmIGFueSlcblx0ICAgIGlmICgnLycgPT09IHN0ci5jaGFyQXQoaSArIDEpKSB7XG5cdCAgICAgIHAubnNwID0gJyc7XG5cdCAgICAgIHdoaWxlICgrK2kpIHtcblx0ICAgICAgICB2YXIgYyA9IHN0ci5jaGFyQXQoaSk7XG5cdCAgICAgICAgaWYgKCcsJyA9PT0gYykgYnJlYWs7XG5cdCAgICAgICAgcC5uc3AgKz0gYztcblx0ICAgICAgICBpZiAoaSA9PT0gc3RyLmxlbmd0aCkgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHAubnNwID0gJy8nO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIGlkXG5cdCAgICB2YXIgbmV4dCA9IHN0ci5jaGFyQXQoaSArIDEpO1xuXHQgICAgaWYgKCcnICE9PSBuZXh0ICYmIE51bWJlcihuZXh0KSA9PSBuZXh0KSB7XG5cdCAgICAgIHAuaWQgPSAnJztcblx0ICAgICAgd2hpbGUgKCsraSkge1xuXHQgICAgICAgIHZhciBjID0gc3RyLmNoYXJBdChpKTtcblx0ICAgICAgICBpZiAobnVsbCA9PSBjIHx8IE51bWJlcihjKSAhPSBjKSB7XG5cdCAgICAgICAgICAtLWk7XG5cdCAgICAgICAgICBicmVhaztcblx0ICAgICAgICB9XG5cdCAgICAgICAgcC5pZCArPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmIChpID09PSBzdHIubGVuZ3RoKSBicmVhaztcblx0ICAgICAgfVxuXHQgICAgICBwLmlkID0gTnVtYmVyKHAuaWQpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIGpzb24gZGF0YVxuXHQgICAgaWYgKHN0ci5jaGFyQXQoKytpKSkge1xuXHQgICAgICB2YXIgcGF5bG9hZCA9IHRyeVBhcnNlKHN0ci5zdWJzdHIoaSkpO1xuXHQgICAgICB2YXIgaXNQYXlsb2FkVmFsaWQgPSBwYXlsb2FkICE9PSBmYWxzZSAmJiAocC50eXBlID09PSBleHBvcnRzLkVSUk9SIHx8IGlzQXJyYXkocGF5bG9hZCkpO1xuXHQgICAgICBpZiAoaXNQYXlsb2FkVmFsaWQpIHtcblx0ICAgICAgICBwLmRhdGEgPSBwYXlsb2FkO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBlcnJvcignaW52YWxpZCBwYXlsb2FkJyk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZGVidWcoJ2RlY29kZWQgJXMgYXMgJWonLCBzdHIsIHApO1xuXHQgICAgcmV0dXJuIHA7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gdHJ5UGFyc2Uoc3RyKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gSlNPTi5wYXJzZShzdHIpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRGVhbGxvY2F0ZXMgYSBwYXJzZXIncyByZXNvdXJjZXNcblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBEZWNvZGVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKHRoaXMucmVjb25zdHJ1Y3Rvcikge1xuXHQgICAgICB0aGlzLnJlY29uc3RydWN0b3IuZmluaXNoZWRSZWNvbnN0cnVjdGlvbigpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBBIG1hbmFnZXIgb2YgYSBiaW5hcnkgZXZlbnQncyAnYnVmZmVyIHNlcXVlbmNlJy4gU2hvdWxkXG5cdCAgICogYmUgY29uc3RydWN0ZWQgd2hlbmV2ZXIgYSBwYWNrZXQgb2YgdHlwZSBCSU5BUllfRVZFTlQgaXNcblx0ICAgKiBkZWNvZGVkLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEByZXR1cm4ge0JpbmFyeVJlY29uc3RydWN0b3J9IGluaXRpYWxpemVkIHJlY29uc3RydWN0b3Jcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIEJpbmFyeVJlY29uc3RydWN0b3IocGFja2V0KSB7XG5cdCAgICB0aGlzLnJlY29uUGFjayA9IHBhY2tldDtcblx0ICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1ldGhvZCB0byBiZSBjYWxsZWQgd2hlbiBiaW5hcnkgZGF0YSByZWNlaXZlZCBmcm9tIGNvbm5lY3Rpb25cblx0ICAgKiBhZnRlciBhIEJJTkFSWV9FVkVOVCBwYWNrZXQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0J1ZmZlciB8IEFycmF5QnVmZmVyfSBiaW5EYXRhIC0gdGhlIHJhdyBiaW5hcnkgZGF0YSByZWNlaXZlZFxuXHQgICAqIEByZXR1cm4ge251bGwgfCBPYmplY3R9IHJldHVybnMgbnVsbCBpZiBtb3JlIGJpbmFyeSBkYXRhIGlzIGV4cGVjdGVkIG9yXG5cdCAgICogICBhIHJlY29uc3RydWN0ZWQgcGFja2V0IG9iamVjdCBpZiBhbGwgYnVmZmVycyBoYXZlIGJlZW4gcmVjZWl2ZWQuXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBCaW5hcnlSZWNvbnN0cnVjdG9yLnByb3RvdHlwZS50YWtlQmluYXJ5RGF0YSA9IGZ1bmN0aW9uIChiaW5EYXRhKSB7XG5cdCAgICB0aGlzLmJ1ZmZlcnMucHVzaChiaW5EYXRhKTtcblx0ICAgIGlmICh0aGlzLmJ1ZmZlcnMubGVuZ3RoID09PSB0aGlzLnJlY29uUGFjay5hdHRhY2htZW50cykge1xuXHQgICAgICAvLyBkb25lIHdpdGggYnVmZmVyIGxpc3Rcblx0ICAgICAgdmFyIHBhY2tldCA9IGJpbmFyeSQyLnJlY29uc3RydWN0UGFja2V0KHRoaXMucmVjb25QYWNrLCB0aGlzLmJ1ZmZlcnMpO1xuXHQgICAgICB0aGlzLmZpbmlzaGVkUmVjb25zdHJ1Y3Rpb24oKTtcblx0ICAgICAgcmV0dXJuIHBhY2tldDtcblx0ICAgIH1cblx0ICAgIHJldHVybiBudWxsO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDbGVhbnMgdXAgYmluYXJ5IHBhY2tldCByZWNvbnN0cnVjdGlvbiB2YXJpYWJsZXMuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIEJpbmFyeVJlY29uc3RydWN0b3IucHJvdG90eXBlLmZpbmlzaGVkUmVjb25zdHJ1Y3Rpb24gPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB0aGlzLnJlY29uUGFjayA9IG51bGw7XG5cdCAgICB0aGlzLmJ1ZmZlcnMgPSBbXTtcblx0ICB9O1xuXG5cdCAgZnVuY3Rpb24gZXJyb3IobXNnKSB7XG5cdCAgICByZXR1cm4ge1xuXHQgICAgICB0eXBlOiBleHBvcnRzLkVSUk9SLFxuXHQgICAgICBkYXRhOiAncGFyc2VyIGVycm9yOiAnICsgbXNnXG5cdCAgICB9O1xuXHQgIH1cblx0fSk7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMSA9IHNvY2tldF9pb1BhcnNlci5wcm90b2NvbDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8yID0gc29ja2V0X2lvUGFyc2VyLnR5cGVzO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzMgPSBzb2NrZXRfaW9QYXJzZXIuQ09OTkVDVDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl80ID0gc29ja2V0X2lvUGFyc2VyLkRJU0NPTk5FQ1Q7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfNSA9IHNvY2tldF9pb1BhcnNlci5FVkVOVDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl82ID0gc29ja2V0X2lvUGFyc2VyLkFDSztcblx0dmFyIHNvY2tldF9pb1BhcnNlcl83ID0gc29ja2V0X2lvUGFyc2VyLkVSUk9SO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzggPSBzb2NrZXRfaW9QYXJzZXIuQklOQVJZX0VWRU5UO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzkgPSBzb2NrZXRfaW9QYXJzZXIuQklOQVJZX0FDSztcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8xMCA9IHNvY2tldF9pb1BhcnNlci5FbmNvZGVyO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzExID0gc29ja2V0X2lvUGFyc2VyLkRlY29kZXI7XG5cblx0dmFyIHNvY2tldF9pb1BhcnNlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHNvY2tldF9pb1BhcnNlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IHNvY2tldF9pb1BhcnNlcixcblx0XHRwcm90b2NvbDogc29ja2V0X2lvUGFyc2VyXzEsXG5cdFx0dHlwZXM6IHNvY2tldF9pb1BhcnNlcl8yLFxuXHRcdENPTk5FQ1Q6IHNvY2tldF9pb1BhcnNlcl8zLFxuXHRcdERJU0NPTk5FQ1Q6IHNvY2tldF9pb1BhcnNlcl80LFxuXHRcdEVWRU5UOiBzb2NrZXRfaW9QYXJzZXJfNSxcblx0XHRBQ0s6IHNvY2tldF9pb1BhcnNlcl82LFxuXHRcdEVSUk9SOiBzb2NrZXRfaW9QYXJzZXJfNyxcblx0XHRCSU5BUllfRVZFTlQ6IHNvY2tldF9pb1BhcnNlcl84LFxuXHRcdEJJTkFSWV9BQ0s6IHNvY2tldF9pb1BhcnNlcl85LFxuXHRcdEVuY29kZXI6IHNvY2tldF9pb1BhcnNlcl8xMCxcblx0XHREZWNvZGVyOiBzb2NrZXRfaW9QYXJzZXJfMTFcblx0fSk7XG5cblx0dmFyIGhhc0NvcnMgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGV4cG9ydHMuXG5cdCAgICpcblx0ICAgKiBMb2dpYyBib3Jyb3dlZCBmcm9tIE1vZGVybml6cjpcblx0ICAgKlxuXHQgICAqICAgLSBodHRwczovL2dpdGh1Yi5jb20vTW9kZXJuaXpyL01vZGVybml6ci9ibG9iL21hc3Rlci9mZWF0dXJlLWRldGVjdHMvY29ycy5qc1xuXHQgICAqL1xuXG5cdCAgdHJ5IHtcblx0ICAgIG1vZHVsZS5leHBvcnRzID0gdHlwZW9mIFhNTEh0dHBSZXF1ZXN0ICE9PSAndW5kZWZpbmVkJyAmJiAnd2l0aENyZWRlbnRpYWxzJyBpbiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0ICB9IGNhdGNoIChlcnIpIHtcblx0ICAgIC8vIGlmIFhNTEh0dHAgc3VwcG9ydCBpcyBkaXNhYmxlZCBpbiBJRSB0aGVuIGl0IHdpbGwgdGhyb3dcblx0ICAgIC8vIHdoZW4gdHJ5aW5nIHRvIGNyZWF0ZVxuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWxzZTtcblx0ICB9XG5cdH0pO1xuXG5cdHZhciBoYXNDb3JzJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaGFzQ29ycyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGhhc0NvcnNcblx0fSk7XG5cblx0dmFyIGhhc0NPUlMgPSAoIGhhc0NvcnMkMSAmJiBoYXNDb3JzICkgfHwgaGFzQ29ycyQxO1xuXG5cdC8vIGJyb3dzZXIgc2hpbSBmb3IgeG1saHR0cHJlcXVlc3QgbW9kdWxlXG5cblxuXHR2YXIgeG1saHR0cHJlcXVlc3QgPSBmdW5jdGlvbiB4bWxodHRwcmVxdWVzdChvcHRzKSB7XG5cdCAgdmFyIHhkb21haW4gPSBvcHRzLnhkb21haW47XG5cblx0ICAvLyBzY2hlbWUgbXVzdCBiZSBzYW1lIHdoZW4gdXNpZ24gWERvbWFpblJlcXVlc3Rcblx0ICAvLyBodHRwOi8vYmxvZ3MubXNkbi5jb20vYi9pZWludGVybmFscy9hcmNoaXZlLzIwMTAvMDUvMTMveGRvbWFpbnJlcXVlc3QtcmVzdHJpY3Rpb25zLWxpbWl0YXRpb25zLWFuZC13b3JrYXJvdW5kcy5hc3B4XG5cdCAgdmFyIHhzY2hlbWUgPSBvcHRzLnhzY2hlbWU7XG5cblx0ICAvLyBYRG9tYWluUmVxdWVzdCBoYXMgYSBmbG93IG9mIG5vdCBzZW5kaW5nIGNvb2tpZSwgdGhlcmVmb3JlIGl0IHNob3VsZCBiZSBkaXNhYmxlZCBhcyBhIGRlZmF1bHQuXG5cdCAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0F1dG9tYXR0aWMvZW5naW5lLmlvLWNsaWVudC9wdWxsLzIxN1xuXHQgIHZhciBlbmFibGVzWERSID0gb3B0cy5lbmFibGVzWERSO1xuXG5cdCAgLy8gWE1MSHR0cFJlcXVlc3QgY2FuIGJlIGRpc2FibGVkIG9uIElFXG5cdCAgdHJ5IHtcblx0ICAgIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIFhNTEh0dHBSZXF1ZXN0ICYmICgheGRvbWFpbiB8fCBoYXNDT1JTKSkge1xuXHQgICAgICByZXR1cm4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdCAgICB9XG5cdCAgfSBjYXRjaCAoZSkge31cblxuXHQgIC8vIFVzZSBYRG9tYWluUmVxdWVzdCBmb3IgSUU4IGlmIGVuYWJsZXNYRFIgaXMgdHJ1ZVxuXHQgIC8vIGJlY2F1c2UgbG9hZGluZyBiYXIga2VlcHMgZmxhc2hpbmcgd2hlbiB1c2luZyBqc29ucC1wb2xsaW5nXG5cdCAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3l1amlvc2FrYS9zb2NrZS5pby1pZTgtbG9hZGluZy1leGFtcGxlXG5cdCAgdHJ5IHtcblx0ICAgIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIFhEb21haW5SZXF1ZXN0ICYmICF4c2NoZW1lICYmIGVuYWJsZXNYRFIpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuXHQgICAgfVxuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICBpZiAoIXhkb21haW4pIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBuZXcgY29tbW9uanNHbG9iYWxbWydBY3RpdmUnXS5jb25jYXQoJ09iamVjdCcpLmpvaW4oJ1gnKV0oJ01pY3Jvc29mdC5YTUxIVFRQJyk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblx0fTtcblxuXHR2YXIgeG1saHR0cHJlcXVlc3QkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB4bWxodHRwcmVxdWVzdCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHhtbGh0dHByZXF1ZXN0XG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBrZXlzIGZvciBhbiBvYmplY3QuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0FycmF5fSBrZXlzXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHR2YXIga2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIGtleXMob2JqKSB7XG5cdCAgdmFyIGFyciA9IFtdO1xuXHQgIHZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cdCAgZm9yICh2YXIgaSBpbiBvYmopIHtcblx0ICAgIGlmIChoYXMuY2FsbChvYmosIGkpKSB7XG5cdCAgICAgIGFyci5wdXNoKGkpO1xuXHQgICAgfVxuXHQgIH1cblx0ICByZXR1cm4gYXJyO1xuXHR9O1xuXG5cdHZhciBrZXlzJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDoga2V5cyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGtleXNcblx0fSk7XG5cblx0LyogZ2xvYmFsIEJsb2IgRmlsZSAqL1xuXG5cdC8qXG5cdCAqIE1vZHVsZSByZXF1aXJlbWVudHMuXG5cdCAqL1xuXG5cdHZhciB0b1N0cmluZyQyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblx0dmFyIHdpdGhOYXRpdmVCbG9iJDEgPSB0eXBlb2YgQmxvYiA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcgJiYgdG9TdHJpbmckMi5jYWxsKEJsb2IpID09PSAnW29iamVjdCBCbG9iQ29uc3RydWN0b3JdJztcblx0dmFyIHdpdGhOYXRpdmVGaWxlJDEgPSB0eXBlb2YgRmlsZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgRmlsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdG9TdHJpbmckMi5jYWxsKEZpbGUpID09PSAnW29iamVjdCBGaWxlQ29uc3RydWN0b3JdJztcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBoYXNCaW5hcnkyID0gaGFzQmluYXJ5O1xuXG5cdC8qKlxuXHQgKiBDaGVja3MgZm9yIGJpbmFyeSBkYXRhLlxuXHQgKlxuXHQgKiBTdXBwb3J0cyBCdWZmZXIsIEFycmF5QnVmZmVyLCBCbG9iIGFuZCBGaWxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW55dGhpbmdcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gaGFzQmluYXJ5KG9iaikge1xuXHQgIGlmICghb2JqIHx8ICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihvYmopKSAhPT0gJ29iamVjdCcpIHtcblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICBpZiAoaXNBcnJheShvYmopKSB7XG5cdCAgICBmb3IgKHZhciBpID0gMCwgbCA9IG9iai5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgICAgaWYgKGhhc0JpbmFyeShvYmpbaV0pKSB7XG5cdCAgICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cblx0ICBpZiAodHlwZW9mIEJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBCdWZmZXIuaXNCdWZmZXIgJiYgQnVmZmVyLmlzQnVmZmVyKG9iaikgfHwgdHlwZW9mIEFycmF5QnVmZmVyID09PSAnZnVuY3Rpb24nICYmIG9iaiBpbnN0YW5jZW9mIEFycmF5QnVmZmVyIHx8IHdpdGhOYXRpdmVCbG9iJDEgJiYgb2JqIGluc3RhbmNlb2YgQmxvYiB8fCB3aXRoTmF0aXZlRmlsZSQxICYmIG9iaiBpbnN0YW5jZW9mIEZpbGUpIHtcblx0ICAgIHJldHVybiB0cnVlO1xuXHQgIH1cblxuXHQgIC8vIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL0F1dG9tYXR0aWMvaGFzLWJpbmFyeS9wdWxsLzRcblx0ICBpZiAob2JqLnRvSlNPTiAmJiB0eXBlb2Ygb2JqLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyAmJiBhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG5cdCAgICByZXR1cm4gaGFzQmluYXJ5KG9iai50b0pTT04oKSwgdHJ1ZSk7XG5cdCAgfVxuXG5cdCAgZm9yICh2YXIga2V5IGluIG9iaikge1xuXHQgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkgJiYgaGFzQmluYXJ5KG9ialtrZXldKSkge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gZmFsc2U7XG5cdH1cblxuXHR2YXIgaGFzQmluYXJ5MiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGhhc0JpbmFyeTIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBoYXNCaW5hcnkyXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBBbiBhYnN0cmFjdGlvbiBmb3Igc2xpY2luZyBhbiBhcnJheWJ1ZmZlciBldmVuIHdoZW5cblx0ICogQXJyYXlCdWZmZXIucHJvdG90eXBlLnNsaWNlIGlzIG5vdCBzdXBwb3J0ZWRcblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIGFycmF5YnVmZmVyX3NsaWNlID0gZnVuY3Rpb24gYXJyYXlidWZmZXJfc2xpY2UoYXJyYXlidWZmZXIsIHN0YXJ0LCBlbmQpIHtcblx0ICB2YXIgYnl0ZXMgPSBhcnJheWJ1ZmZlci5ieXRlTGVuZ3RoO1xuXHQgIHN0YXJ0ID0gc3RhcnQgfHwgMDtcblx0ICBlbmQgPSBlbmQgfHwgYnl0ZXM7XG5cblx0ICBpZiAoYXJyYXlidWZmZXIuc2xpY2UpIHtcblx0ICAgIHJldHVybiBhcnJheWJ1ZmZlci5zbGljZShzdGFydCwgZW5kKTtcblx0ICB9XG5cblx0ICBpZiAoc3RhcnQgPCAwKSB7XG5cdCAgICBzdGFydCArPSBieXRlcztcblx0ICB9XG5cdCAgaWYgKGVuZCA8IDApIHtcblx0ICAgIGVuZCArPSBieXRlcztcblx0ICB9XG5cdCAgaWYgKGVuZCA+IGJ5dGVzKSB7XG5cdCAgICBlbmQgPSBieXRlcztcblx0ICB9XG5cblx0ICBpZiAoc3RhcnQgPj0gYnl0ZXMgfHwgc3RhcnQgPj0gZW5kIHx8IGJ5dGVzID09PSAwKSB7XG5cdCAgICByZXR1cm4gbmV3IEFycmF5QnVmZmVyKDApO1xuXHQgIH1cblxuXHQgIHZhciBhYnYgPSBuZXcgVWludDhBcnJheShhcnJheWJ1ZmZlcik7XG5cdCAgdmFyIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGVuZCAtIHN0YXJ0KTtcblx0ICBmb3IgKHZhciBpID0gc3RhcnQsIGlpID0gMDsgaSA8IGVuZDsgaSsrLCBpaSsrKSB7XG5cdCAgICByZXN1bHRbaWldID0gYWJ2W2ldO1xuXHQgIH1cblx0ICByZXR1cm4gcmVzdWx0LmJ1ZmZlcjtcblx0fTtcblxuXHR2YXIgYXJyYXlidWZmZXJfc2xpY2UkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBhcnJheWJ1ZmZlcl9zbGljZSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGFycmF5YnVmZmVyX3NsaWNlXG5cdH0pO1xuXG5cdHZhciBhZnRlcl8xID0gYWZ0ZXI7XG5cblx0ZnVuY3Rpb24gYWZ0ZXIoY291bnQsIGNhbGxiYWNrLCBlcnJfY2IpIHtcblx0ICAgIHZhciBiYWlsID0gZmFsc2U7XG5cdCAgICBlcnJfY2IgPSBlcnJfY2IgfHwgbm9vcDtcblx0ICAgIHByb3h5LmNvdW50ID0gY291bnQ7XG5cblx0ICAgIHJldHVybiBjb3VudCA9PT0gMCA/IGNhbGxiYWNrKCkgOiBwcm94eTtcblxuXHQgICAgZnVuY3Rpb24gcHJveHkoZXJyLCByZXN1bHQpIHtcblx0ICAgICAgICBpZiAocHJveHkuY291bnQgPD0gMCkge1xuXHQgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FmdGVyIGNhbGxlZCB0b28gbWFueSB0aW1lcycpO1xuXHQgICAgICAgIH1cblx0ICAgICAgICAtLXByb3h5LmNvdW50O1xuXG5cdCAgICAgICAgLy8gYWZ0ZXIgZmlyc3QgZXJyb3IsIHJlc3QgYXJlIHBhc3NlZCB0byBlcnJfY2Jcblx0ICAgICAgICBpZiAoZXJyKSB7XG5cdCAgICAgICAgICAgIGJhaWwgPSB0cnVlO1xuXHQgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuXHQgICAgICAgICAgICAvLyBmdXR1cmUgZXJyb3IgY2FsbGJhY2tzIHdpbGwgZ28gdG8gZXJyb3IgaGFuZGxlclxuXHQgICAgICAgICAgICBjYWxsYmFjayA9IGVycl9jYjtcblx0ICAgICAgICB9IGVsc2UgaWYgKHByb3h5LmNvdW50ID09PSAwICYmICFiYWlsKSB7XG5cdCAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG5cdCAgICAgICAgfVxuXHQgICAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gbm9vcCgpIHt9XG5cblx0dmFyIGFmdGVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYWZ0ZXJfMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGFmdGVyXzFcblx0fSk7XG5cblx0dmFyIHV0ZjggPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdChmdW5jdGlvbiAocm9vdCkge1xuXG5cdFx0XHQvLyBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgYGV4cG9ydHNgXG5cdFx0XHR2YXIgZnJlZUV4cG9ydHMgPSBleHBvcnRzO1xuXG5cdFx0XHQvLyBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYFxuXHRcdFx0dmFyIGZyZWVNb2R1bGUgPSBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMgJiYgbW9kdWxlO1xuXG5cdFx0XHQvLyBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCwgZnJvbSBOb2RlLmpzIG9yIEJyb3dzZXJpZmllZCBjb2RlLFxuXHRcdFx0Ly8gYW5kIHVzZSBpdCBhcyBgcm9vdGBcblx0XHRcdHZhciBmcmVlR2xvYmFsID0gX3R5cGVvZihjb21tb25qc0dsb2JhbCkgPT0gJ29iamVjdCcgJiYgY29tbW9uanNHbG9iYWw7XG5cdFx0XHRpZiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHwgZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwpIHtcblx0XHRcdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdFx0XHR9XG5cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHR2YXIgc3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZTtcblxuXHRcdFx0Ly8gVGFrZW4gZnJvbSBodHRwczovL210aHMuYmUvcHVueWNvZGVcblx0XHRcdGZ1bmN0aW9uIHVjczJkZWNvZGUoc3RyaW5nKSB7XG5cdFx0XHRcdHZhciBvdXRwdXQgPSBbXTtcblx0XHRcdFx0dmFyIGNvdW50ZXIgPSAwO1xuXHRcdFx0XHR2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aDtcblx0XHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0XHR2YXIgZXh0cmE7XG5cdFx0XHRcdHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0XHRcdC8vIGhpZ2ggc3Vycm9nYXRlLCBhbmQgdGhlcmUgaXMgYSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7XG5cdFx0XHRcdFx0XHRcdC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0XHRcdC8vIGNvZGUgdW5pdCBpcyB0aGUgaGlnaCBzdXJyb2dhdGUgb2YgYSBzdXJyb2dhdGUgcGFpclxuXHRcdFx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUYWtlbiBmcm9tIGh0dHBzOi8vbXRocy5iZS9wdW55Y29kZVxuXHRcdFx0ZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheSkge1xuXHRcdFx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdFx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHRcdFx0dmFyIHZhbHVlO1xuXHRcdFx0XHR2YXIgb3V0cHV0ID0gJyc7XG5cdFx0XHRcdHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSBhcnJheVtpbmRleF07XG5cdFx0XHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGNoZWNrU2NhbGFyVmFsdWUoY29kZVBvaW50LCBzdHJpY3QpIHtcblx0XHRcdFx0aWYgKGNvZGVQb2ludCA+PSAweEQ4MDAgJiYgY29kZVBvaW50IDw9IDB4REZGRikge1xuXHRcdFx0XHRcdGlmIChzdHJpY3QpIHtcblx0XHRcdFx0XHRcdHRocm93IEVycm9yKCdMb25lIHN1cnJvZ2F0ZSBVKycgKyBjb2RlUG9pbnQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkgKyAnIGlzIG5vdCBhIHNjYWxhciB2YWx1ZScpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHRcdFx0ZnVuY3Rpb24gY3JlYXRlQnl0ZShjb2RlUG9pbnQsIHNoaWZ0KSB7XG5cdFx0XHRcdHJldHVybiBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ID4+IHNoaWZ0ICYgMHgzRiB8IDB4ODApO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBlbmNvZGVDb2RlUG9pbnQoY29kZVBvaW50LCBzdHJpY3QpIHtcblx0XHRcdFx0aWYgKChjb2RlUG9pbnQgJiAweEZGRkZGRjgwKSA9PSAwKSB7XG5cdFx0XHRcdFx0Ly8gMS1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdFx0cmV0dXJuIHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBzeW1ib2wgPSAnJztcblx0XHRcdFx0aWYgKChjb2RlUG9pbnQgJiAweEZGRkZGODAwKSA9PSAwKSB7XG5cdFx0XHRcdFx0Ly8gMi1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdFx0c3ltYm9sID0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCA+PiA2ICYgMHgxRiB8IDB4QzApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKChjb2RlUG9pbnQgJiAweEZGRkYwMDAwKSA9PSAwKSB7XG5cdFx0XHRcdFx0Ly8gMy1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdFx0aWYgKCFjaGVja1NjYWxhclZhbHVlKGNvZGVQb2ludCwgc3RyaWN0KSkge1xuXHRcdFx0XHRcdFx0Y29kZVBvaW50ID0gMHhGRkZEO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzeW1ib2wgPSBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ID4+IDEyICYgMHgwRiB8IDB4RTApO1xuXHRcdFx0XHRcdHN5bWJvbCArPSBjcmVhdGVCeXRlKGNvZGVQb2ludCwgNik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGNvZGVQb2ludCAmIDB4RkZFMDAwMDApID09IDApIHtcblx0XHRcdFx0XHQvLyA0LWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRzeW1ib2wgPSBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ID4+IDE4ICYgMHgwNyB8IDB4RjApO1xuXHRcdFx0XHRcdHN5bWJvbCArPSBjcmVhdGVCeXRlKGNvZGVQb2ludCwgMTIpO1xuXHRcdFx0XHRcdHN5bWJvbCArPSBjcmVhdGVCeXRlKGNvZGVQb2ludCwgNik7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3ltYm9sICs9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgJiAweDNGIHwgMHg4MCk7XG5cdFx0XHRcdHJldHVybiBzeW1ib2w7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIHV0ZjhlbmNvZGUoc3RyaW5nLCBvcHRzKSB7XG5cdFx0XHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXHRcdFx0XHR2YXIgc3RyaWN0ID0gZmFsc2UgIT09IG9wdHMuc3RyaWN0O1xuXG5cdFx0XHRcdHZhciBjb2RlUG9pbnRzID0gdWNzMmRlY29kZShzdHJpbmcpO1xuXHRcdFx0XHR2YXIgbGVuZ3RoID0gY29kZVBvaW50cy5sZW5ndGg7XG5cdFx0XHRcdHZhciBpbmRleCA9IC0xO1xuXHRcdFx0XHR2YXIgY29kZVBvaW50O1xuXHRcdFx0XHR2YXIgYnl0ZVN0cmluZyA9ICcnO1xuXHRcdFx0XHR3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuXHRcdFx0XHRcdGNvZGVQb2ludCA9IGNvZGVQb2ludHNbaW5kZXhdO1xuXHRcdFx0XHRcdGJ5dGVTdHJpbmcgKz0gZW5jb2RlQ29kZVBvaW50KGNvZGVQb2ludCwgc3RyaWN0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gYnl0ZVN0cmluZztcblx0XHRcdH1cblxuXHRcdFx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0XHRcdGZ1bmN0aW9uIHJlYWRDb250aW51YXRpb25CeXRlKCkge1xuXHRcdFx0XHRpZiAoYnl0ZUluZGV4ID49IGJ5dGVDb3VudCkge1xuXHRcdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGJ5dGUgaW5kZXgnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciBjb250aW51YXRpb25CeXRlID0gYnl0ZUFycmF5W2J5dGVJbmRleF0gJiAweEZGO1xuXHRcdFx0XHRieXRlSW5kZXgrKztcblxuXHRcdFx0XHRpZiAoKGNvbnRpbnVhdGlvbkJ5dGUgJiAweEMwKSA9PSAweDgwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbnRpbnVhdGlvbkJ5dGUgJiAweDNGO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgd2UgZW5kIHVwIGhlcmUsIGl04oCZcyBub3QgYSBjb250aW51YXRpb24gYnl0ZVxuXHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBjb250aW51YXRpb24gYnl0ZScpO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBkZWNvZGVTeW1ib2woc3RyaWN0KSB7XG5cdFx0XHRcdHZhciBieXRlMTtcblx0XHRcdFx0dmFyIGJ5dGUyO1xuXHRcdFx0XHR2YXIgYnl0ZTM7XG5cdFx0XHRcdHZhciBieXRlNDtcblx0XHRcdFx0dmFyIGNvZGVQb2ludDtcblxuXHRcdFx0XHRpZiAoYnl0ZUluZGV4ID4gYnl0ZUNvdW50KSB7XG5cdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgYnl0ZSBpbmRleCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGJ5dGVJbmRleCA9PSBieXRlQ291bnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZWFkIGZpcnN0IGJ5dGVcblx0XHRcdFx0Ynl0ZTEgPSBieXRlQXJyYXlbYnl0ZUluZGV4XSAmIDB4RkY7XG5cdFx0XHRcdGJ5dGVJbmRleCsrO1xuXG5cdFx0XHRcdC8vIDEtYnl0ZSBzZXF1ZW5jZSAobm8gY29udGludWF0aW9uIGJ5dGVzKVxuXHRcdFx0XHRpZiAoKGJ5dGUxICYgMHg4MCkgPT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiBieXRlMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIDItYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRpZiAoKGJ5dGUxICYgMHhFMCkgPT0gMHhDMCkge1xuXHRcdFx0XHRcdGJ5dGUyID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRjb2RlUG9pbnQgPSAoYnl0ZTEgJiAweDFGKSA8PCA2IHwgYnl0ZTI7XG5cdFx0XHRcdFx0aWYgKGNvZGVQb2ludCA+PSAweDgwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY29kZVBvaW50O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBjb250aW51YXRpb24gYnl0ZScpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIDMtYnl0ZSBzZXF1ZW5jZSAobWF5IGluY2x1ZGUgdW5wYWlyZWQgc3Vycm9nYXRlcylcblx0XHRcdFx0aWYgKChieXRlMSAmIDB4RjApID09IDB4RTApIHtcblx0XHRcdFx0XHRieXRlMiA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Ynl0ZTMgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGNvZGVQb2ludCA9IChieXRlMSAmIDB4MEYpIDw8IDEyIHwgYnl0ZTIgPDwgNiB8IGJ5dGUzO1xuXHRcdFx0XHRcdGlmIChjb2RlUG9pbnQgPj0gMHgwODAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY2hlY2tTY2FsYXJWYWx1ZShjb2RlUG9pbnQsIHN0cmljdCkgPyBjb2RlUG9pbnQgOiAweEZGRkQ7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gNC1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweEY4KSA9PSAweEYwKSB7XG5cdFx0XHRcdFx0Ynl0ZTIgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGJ5dGUzID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRieXRlNCA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gKGJ5dGUxICYgMHgwNykgPDwgMHgxMiB8IGJ5dGUyIDw8IDB4MEMgfCBieXRlMyA8PCAweDA2IHwgYnl0ZTQ7XG5cdFx0XHRcdFx0aWYgKGNvZGVQb2ludCA+PSAweDAxMDAwMCAmJiBjb2RlUG9pbnQgPD0gMHgxMEZGRkYpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjb2RlUG9pbnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgVVRGLTggZGV0ZWN0ZWQnKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGJ5dGVBcnJheTtcblx0XHRcdHZhciBieXRlQ291bnQ7XG5cdFx0XHR2YXIgYnl0ZUluZGV4O1xuXHRcdFx0ZnVuY3Rpb24gdXRmOGRlY29kZShieXRlU3RyaW5nLCBvcHRzKSB7XG5cdFx0XHRcdG9wdHMgPSBvcHRzIHx8IHt9O1xuXHRcdFx0XHR2YXIgc3RyaWN0ID0gZmFsc2UgIT09IG9wdHMuc3RyaWN0O1xuXG5cdFx0XHRcdGJ5dGVBcnJheSA9IHVjczJkZWNvZGUoYnl0ZVN0cmluZyk7XG5cdFx0XHRcdGJ5dGVDb3VudCA9IGJ5dGVBcnJheS5sZW5ndGg7XG5cdFx0XHRcdGJ5dGVJbmRleCA9IDA7XG5cdFx0XHRcdHZhciBjb2RlUG9pbnRzID0gW107XG5cdFx0XHRcdHZhciB0bXA7XG5cdFx0XHRcdHdoaWxlICgodG1wID0gZGVjb2RlU3ltYm9sKHN0cmljdCkpICE9PSBmYWxzZSkge1xuXHRcdFx0XHRcdGNvZGVQb2ludHMucHVzaCh0bXApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1Y3MyZW5jb2RlKGNvZGVQb2ludHMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHRcdFx0dmFyIHV0ZjggPSB7XG5cdFx0XHRcdCd2ZXJzaW9uJzogJzIuMS4yJyxcblx0XHRcdFx0J2VuY29kZSc6IHV0ZjhlbmNvZGUsXG5cdFx0XHRcdCdkZWNvZGUnOiB1dGY4ZGVjb2RlXG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0XHRcdC8vIGxpa2UgdGhlIGZvbGxvd2luZzpcblx0XHRcdGlmICh0eXBlb2YgdW5kZWZpbmVkID09ICdmdW5jdGlvbicgJiYgX3R5cGVvZih1bmRlZmluZWQuYW1kKSA9PSAnb2JqZWN0JyAmJiB1bmRlZmluZWQuYW1kKSB7XG5cdFx0XHRcdHVuZGVmaW5lZChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHV0Zjg7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiAhZnJlZUV4cG9ydHMubm9kZVR5cGUpIHtcblx0XHRcdFx0aWYgKGZyZWVNb2R1bGUpIHtcblx0XHRcdFx0XHQvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlMgdjAuOC4wK1xuXHRcdFx0XHRcdGZyZWVNb2R1bGUuZXhwb3J0cyA9IHV0Zjg7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cblx0XHRcdFx0XHR2YXIgb2JqZWN0ID0ge307XG5cdFx0XHRcdFx0dmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0Lmhhc093blByb3BlcnR5O1xuXHRcdFx0XHRcdGZvciAodmFyIGtleSBpbiB1dGY4KSB7XG5cdFx0XHRcdFx0XHRoYXNPd25Qcm9wZXJ0eS5jYWxsKHV0ZjgsIGtleSkgJiYgKGZyZWVFeHBvcnRzW2tleV0gPSB1dGY4W2tleV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdFx0XHRyb290LnV0ZjggPSB1dGY4O1xuXHRcdFx0fVxuXHRcdH0pKGNvbW1vbmpzR2xvYmFsKTtcblx0fSk7XG5cblx0dmFyIHV0ZjgkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB1dGY4LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdXRmOFxuXHR9KTtcblxuXHR2YXIgYmFzZTY0QXJyYXlidWZmZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLypcblx0ICAgKiBiYXNlNjQtYXJyYXlidWZmZXJcblx0ICAgKiBodHRwczovL2dpdGh1Yi5jb20vbmlrbGFzdmgvYmFzZTY0LWFycmF5YnVmZmVyXG5cdCAgICpcblx0ICAgKiBDb3B5cmlnaHQgKGMpIDIwMTIgTmlrbGFzIHZvbiBIZXJ0emVuXG5cdCAgICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXHQgICAqL1xuXHQgIChmdW5jdGlvbiAoKSB7XG5cblx0ICAgIHZhciBjaGFycyA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiO1xuXG5cdCAgICAvLyBVc2UgYSBsb29rdXAgdGFibGUgdG8gZmluZCB0aGUgaW5kZXguXG5cdCAgICB2YXIgbG9va3VwID0gbmV3IFVpbnQ4QXJyYXkoMjU2KTtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhcnMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgbG9va3VwW2NoYXJzLmNoYXJDb2RlQXQoaSldID0gaTtcblx0ICAgIH1cblxuXHQgICAgZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbiAoYXJyYXlidWZmZXIpIHtcblx0ICAgICAgdmFyIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlidWZmZXIpLFxuXHQgICAgICAgICAgaSxcblx0ICAgICAgICAgIGxlbiA9IGJ5dGVzLmxlbmd0aCxcblx0ICAgICAgICAgIGJhc2U2NCA9IFwiXCI7XG5cblx0ICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSArPSAzKSB7XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzW2J5dGVzW2ldID4+IDJdO1xuXHQgICAgICAgIGJhc2U2NCArPSBjaGFyc1soYnl0ZXNbaV0gJiAzKSA8PCA0IHwgYnl0ZXNbaSArIDFdID4+IDRdO1xuXHQgICAgICAgIGJhc2U2NCArPSBjaGFyc1soYnl0ZXNbaSArIDFdICYgMTUpIDw8IDIgfCBieXRlc1tpICsgMl0gPj4gNl07XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzW2J5dGVzW2kgKyAyXSAmIDYzXTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChsZW4gJSAzID09PSAyKSB7XG5cdCAgICAgICAgYmFzZTY0ID0gYmFzZTY0LnN1YnN0cmluZygwLCBiYXNlNjQubGVuZ3RoIC0gMSkgKyBcIj1cIjtcblx0ICAgICAgfSBlbHNlIGlmIChsZW4gJSAzID09PSAxKSB7XG5cdCAgICAgICAgYmFzZTY0ID0gYmFzZTY0LnN1YnN0cmluZygwLCBiYXNlNjQubGVuZ3RoIC0gMikgKyBcIj09XCI7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gYmFzZTY0O1xuXHQgICAgfTtcblxuXHQgICAgZXhwb3J0cy5kZWNvZGUgPSBmdW5jdGlvbiAoYmFzZTY0KSB7XG5cdCAgICAgIHZhciBidWZmZXJMZW5ndGggPSBiYXNlNjQubGVuZ3RoICogMC43NSxcblx0ICAgICAgICAgIGxlbiA9IGJhc2U2NC5sZW5ndGgsXG5cdCAgICAgICAgICBpLFxuXHQgICAgICAgICAgcCA9IDAsXG5cdCAgICAgICAgICBlbmNvZGVkMSxcblx0ICAgICAgICAgIGVuY29kZWQyLFxuXHQgICAgICAgICAgZW5jb2RlZDMsXG5cdCAgICAgICAgICBlbmNvZGVkNDtcblxuXHQgICAgICBpZiAoYmFzZTY0W2Jhc2U2NC5sZW5ndGggLSAxXSA9PT0gXCI9XCIpIHtcblx0ICAgICAgICBidWZmZXJMZW5ndGgtLTtcblx0ICAgICAgICBpZiAoYmFzZTY0W2Jhc2U2NC5sZW5ndGggLSAyXSA9PT0gXCI9XCIpIHtcblx0ICAgICAgICAgIGJ1ZmZlckxlbmd0aC0tO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIHZhciBhcnJheWJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXJMZW5ndGgpLFxuXHQgICAgICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShhcnJheWJ1ZmZlcik7XG5cblx0ICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG5cdCAgICAgICAgZW5jb2RlZDEgPSBsb29rdXBbYmFzZTY0LmNoYXJDb2RlQXQoaSldO1xuXHQgICAgICAgIGVuY29kZWQyID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAxKV07XG5cdCAgICAgICAgZW5jb2RlZDMgPSBsb29rdXBbYmFzZTY0LmNoYXJDb2RlQXQoaSArIDIpXTtcblx0ICAgICAgICBlbmNvZGVkNCA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpICsgMyldO1xuXG5cdCAgICAgICAgYnl0ZXNbcCsrXSA9IGVuY29kZWQxIDw8IDIgfCBlbmNvZGVkMiA+PiA0O1xuXHQgICAgICAgIGJ5dGVzW3ArK10gPSAoZW5jb2RlZDIgJiAxNSkgPDwgNCB8IGVuY29kZWQzID4+IDI7XG5cdCAgICAgICAgYnl0ZXNbcCsrXSA9IChlbmNvZGVkMyAmIDMpIDw8IDYgfCBlbmNvZGVkNCAmIDYzO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGFycmF5YnVmZmVyO1xuXHQgICAgfTtcblx0ICB9KSgpO1xuXHR9KTtcblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyXzEgPSBiYXNlNjRBcnJheWJ1ZmZlci5lbmNvZGU7XG5cdHZhciBiYXNlNjRBcnJheWJ1ZmZlcl8yID0gYmFzZTY0QXJyYXlidWZmZXIuZGVjb2RlO1xuXG5cdHZhciBiYXNlNjRBcnJheWJ1ZmZlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJhc2U2NEFycmF5YnVmZmVyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmFzZTY0QXJyYXlidWZmZXIsXG5cdFx0ZW5jb2RlOiBiYXNlNjRBcnJheWJ1ZmZlcl8xLFxuXHRcdGRlY29kZTogYmFzZTY0QXJyYXlidWZmZXJfMlxuXHR9KTtcblxuXHQvKipcblx0ICogQ3JlYXRlIGEgYmxvYiBidWlsZGVyIGV2ZW4gd2hlbiB2ZW5kb3IgcHJlZml4ZXMgZXhpc3Rcblx0ICovXG5cblx0dmFyIEJsb2JCdWlsZGVyID0gY29tbW9uanNHbG9iYWwuQmxvYkJ1aWxkZXIgfHwgY29tbW9uanNHbG9iYWwuV2ViS2l0QmxvYkJ1aWxkZXIgfHwgY29tbW9uanNHbG9iYWwuTVNCbG9iQnVpbGRlciB8fCBjb21tb25qc0dsb2JhbC5Nb3pCbG9iQnVpbGRlcjtcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgQmxvYiBjb25zdHJ1Y3RvciBpcyBzdXBwb3J0ZWRcblx0ICovXG5cblx0dmFyIGJsb2JTdXBwb3J0ZWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdHJ5IHtcblx0ICAgIHZhciBhID0gbmV3IEJsb2IoWydoaSddKTtcblx0ICAgIHJldHVybiBhLnNpemUgPT09IDI7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBCbG9iIGNvbnN0cnVjdG9yIHN1cHBvcnRzIEFycmF5QnVmZmVyVmlld3Ncblx0ICogRmFpbHMgaW4gU2FmYXJpIDYsIHNvIHdlIG5lZWQgdG8gbWFwIHRvIEFycmF5QnVmZmVycyB0aGVyZS5cblx0ICovXG5cblx0dmFyIGJsb2JTdXBwb3J0c0FycmF5QnVmZmVyVmlldyA9IGJsb2JTdXBwb3J0ZWQgJiYgZnVuY3Rpb24gKCkge1xuXHQgIHRyeSB7XG5cdCAgICB2YXIgYiA9IG5ldyBCbG9iKFtuZXcgVWludDhBcnJheShbMSwgMl0pXSk7XG5cdCAgICByZXR1cm4gYi5zaXplID09PSAyO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cdH0oKTtcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgQmxvYkJ1aWxkZXIgaXMgc3VwcG9ydGVkXG5cdCAqL1xuXG5cdHZhciBibG9iQnVpbGRlclN1cHBvcnRlZCA9IEJsb2JCdWlsZGVyICYmIEJsb2JCdWlsZGVyLnByb3RvdHlwZS5hcHBlbmQgJiYgQmxvYkJ1aWxkZXIucHJvdG90eXBlLmdldEJsb2I7XG5cblx0LyoqXG5cdCAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IG1hcHMgQXJyYXlCdWZmZXJWaWV3cyB0byBBcnJheUJ1ZmZlcnNcblx0ICogVXNlZCBieSBCbG9iQnVpbGRlciBjb25zdHJ1Y3RvciBhbmQgb2xkIGJyb3dzZXJzIHRoYXQgZGlkbid0XG5cdCAqIHN1cHBvcnQgaXQgaW4gdGhlIEJsb2IgY29uc3RydWN0b3IuXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIG1hcEFycmF5QnVmZmVyVmlld3MoYXJ5KSB7XG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnkubGVuZ3RoOyBpKyspIHtcblx0ICAgIHZhciBjaHVuayA9IGFyeVtpXTtcblx0ICAgIGlmIChjaHVuay5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuXHQgICAgICB2YXIgYnVmID0gY2h1bmsuYnVmZmVyO1xuXG5cdCAgICAgIC8vIGlmIHRoaXMgaXMgYSBzdWJhcnJheSwgbWFrZSBhIGNvcHkgc28gd2Ugb25seVxuXHQgICAgICAvLyBpbmNsdWRlIHRoZSBzdWJhcnJheSByZWdpb24gZnJvbSB0aGUgdW5kZXJseWluZyBidWZmZXJcblx0ICAgICAgaWYgKGNodW5rLmJ5dGVMZW5ndGggIT09IGJ1Zi5ieXRlTGVuZ3RoKSB7XG5cdCAgICAgICAgdmFyIGNvcHkgPSBuZXcgVWludDhBcnJheShjaHVuay5ieXRlTGVuZ3RoKTtcblx0ICAgICAgICBjb3B5LnNldChuZXcgVWludDhBcnJheShidWYsIGNodW5rLmJ5dGVPZmZzZXQsIGNodW5rLmJ5dGVMZW5ndGgpKTtcblx0ICAgICAgICBidWYgPSBjb3B5LmJ1ZmZlcjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGFyeVtpXSA9IGJ1Zjtcblx0ICAgIH1cblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiBCbG9iQnVpbGRlckNvbnN0cnVjdG9yKGFyeSwgb3B0aW9ucykge1xuXHQgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG5cdCAgdmFyIGJiID0gbmV3IEJsb2JCdWlsZGVyKCk7XG5cdCAgbWFwQXJyYXlCdWZmZXJWaWV3cyhhcnkpO1xuXG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnkubGVuZ3RoOyBpKyspIHtcblx0ICAgIGJiLmFwcGVuZChhcnlbaV0pO1xuXHQgIH1cblxuXHQgIHJldHVybiBvcHRpb25zLnR5cGUgPyBiYi5nZXRCbG9iKG9wdGlvbnMudHlwZSkgOiBiYi5nZXRCbG9iKCk7XG5cdH1cblx0ZnVuY3Rpb24gQmxvYkNvbnN0cnVjdG9yKGFyeSwgb3B0aW9ucykge1xuXHQgIG1hcEFycmF5QnVmZmVyVmlld3MoYXJ5KTtcblx0ICByZXR1cm4gbmV3IEJsb2IoYXJ5LCBvcHRpb25zIHx8IHt9KTtcblx0fVxuXHR2YXIgYmxvYiA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoYmxvYlN1cHBvcnRlZCkge1xuXHQgICAgcmV0dXJuIGJsb2JTdXBwb3J0c0FycmF5QnVmZmVyVmlldyA/IGNvbW1vbmpzR2xvYmFsLkJsb2IgOiBCbG9iQ29uc3RydWN0b3I7XG5cdCAgfSBlbHNlIGlmIChibG9iQnVpbGRlclN1cHBvcnRlZCkge1xuXHQgICAgcmV0dXJuIEJsb2JCdWlsZGVyQ29uc3RydWN0b3I7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHJldHVybiB1bmRlZmluZWQ7XG5cdCAgfVxuXHR9KCk7XG5cblx0dmFyIGJsb2IkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBibG9iLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmxvYlxuXHR9KTtcblxuXHR2YXIga2V5cyQyID0gKCBrZXlzJDEgJiYga2V5cyApIHx8IGtleXMkMTtcblxuXHR2YXIgaGFzQmluYXJ5JDEgPSAoIGhhc0JpbmFyeTIkMSAmJiBoYXNCaW5hcnkyICkgfHwgaGFzQmluYXJ5MiQxO1xuXG5cdHZhciBzbGljZUJ1ZmZlciA9ICggYXJyYXlidWZmZXJfc2xpY2UkMSAmJiBhcnJheWJ1ZmZlcl9zbGljZSApIHx8IGFycmF5YnVmZmVyX3NsaWNlJDE7XG5cblx0dmFyIGFmdGVyJDIgPSAoIGFmdGVyJDEgJiYgYWZ0ZXJfMSApIHx8IGFmdGVyJDE7XG5cblx0dmFyIHV0ZjgkMiA9ICggdXRmOCQxICYmIHV0ZjggKSB8fCB1dGY4JDE7XG5cblx0dmFyIHJlcXVpcmUkJDAkMyA9ICggYmFzZTY0QXJyYXlidWZmZXIkMSAmJiBiYXNlNjRBcnJheWJ1ZmZlciApIHx8IGJhc2U2NEFycmF5YnVmZmVyJDE7XG5cblx0dmFyIEJsb2IkMSA9ICggYmxvYiQxICYmIGJsb2IgKSB8fCBibG9iJDE7XG5cblx0dmFyIGJyb3dzZXIkMiA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIGJhc2U2NGVuY29kZXI7XG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsICYmIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyKSB7XG5cdCAgICBiYXNlNjRlbmNvZGVyID0gcmVxdWlyZSQkMCQzO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIENoZWNrIGlmIHdlIGFyZSBydW5uaW5nIGFuIGFuZHJvaWQgYnJvd3Nlci4gVGhhdCByZXF1aXJlcyB1cyB0byB1c2Vcblx0ICAgKiBBcnJheUJ1ZmZlciB3aXRoIHBvbGxpbmcgdHJhbnNwb3J0cy4uLlxuXHQgICAqXG5cdCAgICogaHR0cDovL2doaW5kYS5uZXQvanBlZy1ibG9iLWFqYXgtYW5kcm9pZC9cblx0ICAgKi9cblxuXHQgIHZhciBpc0FuZHJvaWQgPSB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAvQW5kcm9pZC9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cblx0ICAvKipcblx0ICAgKiBDaGVjayBpZiB3ZSBhcmUgcnVubmluZyBpbiBQaGFudG9tSlMuXG5cdCAgICogVXBsb2FkaW5nIGEgQmxvYiB3aXRoIFBoYW50b21KUyBkb2VzIG5vdCB3b3JrIGNvcnJlY3RseSwgYXMgcmVwb3J0ZWQgaGVyZTpcblx0ICAgKiBodHRwczovL2dpdGh1Yi5jb20vYXJpeWEvcGhhbnRvbWpzL2lzc3Vlcy8xMTM5NVxuXHQgICAqIEB0eXBlIGJvb2xlYW5cblx0ICAgKi9cblx0ICB2YXIgaXNQaGFudG9tSlMgPSB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAvUGhhbnRvbUpTL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXHQgIC8qKlxuXHQgICAqIFdoZW4gdHJ1ZSwgYXZvaWRzIHVzaW5nIEJsb2JzIHRvIGVuY29kZSBwYXlsb2Fkcy5cblx0ICAgKiBAdHlwZSBib29sZWFuXG5cdCAgICovXG5cdCAgdmFyIGRvbnRTZW5kQmxvYnMgPSBpc0FuZHJvaWQgfHwgaXNQaGFudG9tSlM7XG5cblx0ICAvKipcblx0ICAgKiBDdXJyZW50IHByb3RvY29sIHZlcnNpb24uXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnByb3RvY29sID0gMztcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlcy5cblx0ICAgKi9cblxuXHQgIHZhciBwYWNrZXRzID0gZXhwb3J0cy5wYWNrZXRzID0ge1xuXHQgICAgb3BlbjogMCAvLyBub24td3Ncblx0ICAgICwgY2xvc2U6IDEgLy8gbm9uLXdzXG5cdCAgICAsIHBpbmc6IDIsXG5cdCAgICBwb25nOiAzLFxuXHQgICAgbWVzc2FnZTogNCxcblx0ICAgIHVwZ3JhZGU6IDUsXG5cdCAgICBub29wOiA2XG5cdCAgfTtcblxuXHQgIHZhciBwYWNrZXRzbGlzdCA9IGtleXMkMihwYWNrZXRzKTtcblxuXHQgIC8qKlxuXHQgICAqIFByZW1hZGUgZXJyb3IgcGFja2V0LlxuXHQgICAqL1xuXG5cdCAgdmFyIGVyciA9IHsgdHlwZTogJ2Vycm9yJywgZGF0YTogJ3BhcnNlciBlcnJvcicgfTtcblxuXHQgIC8qKlxuXHQgICAqIENyZWF0ZSBhIGJsb2IgYXBpIGV2ZW4gZm9yIGJsb2IgYnVpbGRlciB3aGVuIHZlbmRvciBwcmVmaXhlcyBleGlzdFxuXHQgICAqL1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlcyBhIHBhY2tldC5cblx0ICAgKlxuXHQgICAqICAgICA8cGFja2V0IHR5cGUgaWQ+IFsgPGRhdGE+IF1cblx0ICAgKlxuXHQgICAqIEV4YW1wbGU6XG5cdCAgICpcblx0ICAgKiAgICAgNWhlbGxvIHdvcmxkXG5cdCAgICogICAgIDNcblx0ICAgKiAgICAgNFxuXHQgICAqXG5cdCAgICogQmluYXJ5IGlzIGVuY29kZWQgaW4gYW4gaWRlbnRpY2FsIHByaW5jaXBsZVxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZVBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCB1dGY4ZW5jb2RlLCBjYWxsYmFjaykge1xuXHQgICAgaWYgKHR5cGVvZiBzdXBwb3J0c0JpbmFyeSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IHN1cHBvcnRzQmluYXJ5O1xuXHQgICAgICBzdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodHlwZW9mIHV0ZjhlbmNvZGUgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSB1dGY4ZW5jb2RlO1xuXHQgICAgICB1dGY4ZW5jb2RlID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgdmFyIGRhdGEgPSBwYWNrZXQuZGF0YSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogcGFja2V0LmRhdGEuYnVmZmVyIHx8IHBhY2tldC5kYXRhO1xuXG5cdCAgICBpZiAoY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIgJiYgZGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG5cdCAgICAgIHJldHVybiBlbmNvZGVBcnJheUJ1ZmZlcihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjayk7XG5cdCAgICB9IGVsc2UgaWYgKEJsb2IkMSAmJiBkYXRhIGluc3RhbmNlb2YgY29tbW9uanNHbG9iYWwuQmxvYikge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQmxvYihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIC8vIG1pZ2h0IGJlIGFuIG9iamVjdCB3aXRoIHsgYmFzZTY0OiB0cnVlLCBkYXRhOiBkYXRhQXNCYXNlNjRTdHJpbmcgfVxuXHQgICAgaWYgKGRhdGEgJiYgZGF0YS5iYXNlNjQpIHtcblx0ICAgICAgcmV0dXJuIGVuY29kZUJhc2U2NE9iamVjdChwYWNrZXQsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgLy8gU2VuZGluZyBkYXRhIGFzIGEgdXRmLTggc3RyaW5nXG5cdCAgICB2YXIgZW5jb2RlZCA9IHBhY2tldHNbcGFja2V0LnR5cGVdO1xuXG5cdCAgICAvLyBkYXRhIGZyYWdtZW50IGlzIG9wdGlvbmFsXG5cdCAgICBpZiAodW5kZWZpbmVkICE9PSBwYWNrZXQuZGF0YSkge1xuXHQgICAgICBlbmNvZGVkICs9IHV0ZjhlbmNvZGUgPyB1dGY4JDIuZW5jb2RlKFN0cmluZyhwYWNrZXQuZGF0YSksIHsgc3RyaWN0OiBmYWxzZSB9KSA6IFN0cmluZyhwYWNrZXQuZGF0YSk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBjYWxsYmFjaygnJyArIGVuY29kZWQpO1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiBlbmNvZGVCYXNlNjRPYmplY3QocGFja2V0LCBjYWxsYmFjaykge1xuXHQgICAgLy8gcGFja2V0IGRhdGEgaXMgYW4gb2JqZWN0IHsgYmFzZTY0OiB0cnVlLCBkYXRhOiBkYXRhQXNCYXNlNjRTdHJpbmcgfVxuXHQgICAgdmFyIG1lc3NhZ2UgPSAnYicgKyBleHBvcnRzLnBhY2tldHNbcGFja2V0LnR5cGVdICsgcGFja2V0LmRhdGEuZGF0YTtcblx0ICAgIHJldHVybiBjYWxsYmFjayhtZXNzYWdlKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgcGFja2V0IGhlbHBlcnMgZm9yIGJpbmFyeSB0eXBlc1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQXJyYXlCdWZmZXIocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICghc3VwcG9ydHNCaW5hcnkpIHtcblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlQmFzZTY0UGFja2V0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZGF0YSA9IHBhY2tldC5kYXRhO1xuXHQgICAgdmFyIGNvbnRlbnRBcnJheSA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuXHQgICAgdmFyIHJlc3VsdEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KDEgKyBkYXRhLmJ5dGVMZW5ndGgpO1xuXG5cdCAgICByZXN1bHRCdWZmZXJbMF0gPSBwYWNrZXRzW3BhY2tldC50eXBlXTtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29udGVudEFycmF5Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIHJlc3VsdEJ1ZmZlcltpICsgMV0gPSBjb250ZW50QXJyYXlbaV07XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBjYWxsYmFjayhyZXN1bHRCdWZmZXIuYnVmZmVyKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBlbmNvZGVCbG9iQXNBcnJheUJ1ZmZlcihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjaykge1xuXHQgICAgaWYgKCFzdXBwb3J0c0JpbmFyeSkge1xuXHQgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQocGFja2V0LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdCAgICBmci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHBhY2tldC5kYXRhID0gZnIucmVzdWx0O1xuXHQgICAgICBleHBvcnRzLmVuY29kZVBhY2tldChwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCB0cnVlLCBjYWxsYmFjayk7XG5cdCAgICB9O1xuXHQgICAgcmV0dXJuIGZyLnJlYWRBc0FycmF5QnVmZmVyKHBhY2tldC5kYXRhKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBlbmNvZGVCbG9iKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZUJhc2U2NFBhY2tldChwYWNrZXQsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKGRvbnRTZW5kQmxvYnMpIHtcblx0ICAgICAgcmV0dXJuIGVuY29kZUJsb2JBc0FycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGxlbmd0aCA9IG5ldyBVaW50OEFycmF5KDEpO1xuXHQgICAgbGVuZ3RoWzBdID0gcGFja2V0c1twYWNrZXQudHlwZV07XG5cdCAgICB2YXIgYmxvYiA9IG5ldyBCbG9iJDEoW2xlbmd0aC5idWZmZXIsIHBhY2tldC5kYXRhXSk7XG5cblx0ICAgIHJldHVybiBjYWxsYmFjayhibG9iKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIGEgcGFja2V0IHdpdGggYmluYXJ5IGRhdGEgaW4gYSBiYXNlNjQgc3RyaW5nXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0LCBoYXMgYHR5cGVgIGFuZCBgZGF0YWBcblx0ICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIG1lc3NhZ2Vcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlQmFzZTY0UGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCwgY2FsbGJhY2spIHtcblx0ICAgIHZhciBtZXNzYWdlID0gJ2InICsgZXhwb3J0cy5wYWNrZXRzW3BhY2tldC50eXBlXTtcblx0ICAgIGlmIChCbG9iJDEgJiYgcGFja2V0LmRhdGEgaW5zdGFuY2VvZiBjb21tb25qc0dsb2JhbC5CbG9iKSB7XG5cdCAgICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cdCAgICAgIGZyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICB2YXIgYjY0ID0gZnIucmVzdWx0LnNwbGl0KCcsJylbMV07XG5cdCAgICAgICAgY2FsbGJhY2sobWVzc2FnZSArIGI2NCk7XG5cdCAgICAgIH07XG5cdCAgICAgIHJldHVybiBmci5yZWFkQXNEYXRhVVJMKHBhY2tldC5kYXRhKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGI2NGRhdGE7XG5cdCAgICB0cnkge1xuXHQgICAgICBiNjRkYXRhID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShwYWNrZXQuZGF0YSkpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAvLyBpUGhvbmUgU2FmYXJpIGRvZXNuJ3QgbGV0IHlvdSBhcHBseSB3aXRoIHR5cGVkIGFycmF5c1xuXHQgICAgICB2YXIgdHlwZWQgPSBuZXcgVWludDhBcnJheShwYWNrZXQuZGF0YSk7XG5cdCAgICAgIHZhciBiYXNpYyA9IG5ldyBBcnJheSh0eXBlZC5sZW5ndGgpO1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGVkLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgYmFzaWNbaV0gPSB0eXBlZFtpXTtcblx0ICAgICAgfVxuXHQgICAgICBiNjRkYXRhID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBiYXNpYyk7XG5cdCAgICB9XG5cdCAgICBtZXNzYWdlICs9IGNvbW1vbmpzR2xvYmFsLmJ0b2EoYjY0ZGF0YSk7XG5cdCAgICByZXR1cm4gY2FsbGJhY2sobWVzc2FnZSk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIERlY29kZXMgYSBwYWNrZXQuIENoYW5nZXMgZm9ybWF0IHRvIEJsb2IgaWYgcmVxdWVzdGVkLlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7T2JqZWN0fSB3aXRoIGB0eXBlYCBhbmQgYGRhdGFgIChpZiBhbnkpXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmRlY29kZVBhY2tldCA9IGZ1bmN0aW9uIChkYXRhLCBiaW5hcnlUeXBlLCB1dGY4ZGVjb2RlKSB7XG5cdCAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgIHJldHVybiBlcnI7XG5cdCAgICB9XG5cdCAgICAvLyBTdHJpbmcgZGF0YVxuXHQgICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuXHQgICAgICBpZiAoZGF0YS5jaGFyQXQoMCkgPT09ICdiJykge1xuXHQgICAgICAgIHJldHVybiBleHBvcnRzLmRlY29kZUJhc2U2NFBhY2tldChkYXRhLnN1YnN0cigxKSwgYmluYXJ5VHlwZSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAodXRmOGRlY29kZSkge1xuXHQgICAgICAgIGRhdGEgPSB0cnlEZWNvZGUoZGF0YSk7XG5cdCAgICAgICAgaWYgKGRhdGEgPT09IGZhbHNlKSB7XG5cdCAgICAgICAgICByZXR1cm4gZXJyO1xuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgICB2YXIgdHlwZSA9IGRhdGEuY2hhckF0KDApO1xuXG5cdCAgICAgIGlmIChOdW1iZXIodHlwZSkgIT0gdHlwZSB8fCAhcGFja2V0c2xpc3RbdHlwZV0pIHtcblx0ICAgICAgICByZXR1cm4gZXJyO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGRhdGEubGVuZ3RoID4gMSkge1xuXHQgICAgICAgIHJldHVybiB7IHR5cGU6IHBhY2tldHNsaXN0W3R5cGVdLCBkYXRhOiBkYXRhLnN1YnN0cmluZygxKSB9O1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiB7IHR5cGU6IHBhY2tldHNsaXN0W3R5cGVdIH07XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgdmFyIGFzQXJyYXkgPSBuZXcgVWludDhBcnJheShkYXRhKTtcblx0ICAgIHZhciB0eXBlID0gYXNBcnJheVswXTtcblx0ICAgIHZhciByZXN0ID0gc2xpY2VCdWZmZXIoZGF0YSwgMSk7XG5cdCAgICBpZiAoQmxvYiQxICYmIGJpbmFyeVR5cGUgPT09ICdibG9iJykge1xuXHQgICAgICByZXN0ID0gbmV3IEJsb2IkMShbcmVzdF0pO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIHsgdHlwZTogcGFja2V0c2xpc3RbdHlwZV0sIGRhdGE6IHJlc3QgfTtcblx0ICB9O1xuXG5cdCAgZnVuY3Rpb24gdHJ5RGVjb2RlKGRhdGEpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGRhdGEgPSB1dGY4JDIuZGVjb2RlKGRhdGEsIHsgc3RyaWN0OiBmYWxzZSB9KTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIGRhdGE7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlcyBhIHBhY2tldCBlbmNvZGVkIGluIGEgYmFzZTY0IHN0cmluZ1xuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIG1lc3NhZ2Vcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHdpdGggYHR5cGVgIGFuZCBgZGF0YWAgKGlmIGFueSlcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZGVjb2RlQmFzZTY0UGFja2V0ID0gZnVuY3Rpb24gKG1zZywgYmluYXJ5VHlwZSkge1xuXHQgICAgdmFyIHR5cGUgPSBwYWNrZXRzbGlzdFttc2cuY2hhckF0KDApXTtcblx0ICAgIGlmICghYmFzZTY0ZW5jb2Rlcikge1xuXHQgICAgICByZXR1cm4geyB0eXBlOiB0eXBlLCBkYXRhOiB7IGJhc2U2NDogdHJ1ZSwgZGF0YTogbXNnLnN1YnN0cigxKSB9IH07XG5cdCAgICB9XG5cblx0ICAgIHZhciBkYXRhID0gYmFzZTY0ZW5jb2Rlci5kZWNvZGUobXNnLnN1YnN0cigxKSk7XG5cblx0ICAgIGlmIChiaW5hcnlUeXBlID09PSAnYmxvYicgJiYgQmxvYiQxKSB7XG5cdCAgICAgIGRhdGEgPSBuZXcgQmxvYiQxKFtkYXRhXSk7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB7IHR5cGU6IHR5cGUsIGRhdGE6IGRhdGEgfTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlcyBtdWx0aXBsZSBtZXNzYWdlcyAocGF5bG9hZCkuXG5cdCAgICpcblx0ICAgKiAgICAgPGxlbmd0aD46ZGF0YVxuXHQgICAqXG5cdCAgICogRXhhbXBsZTpcblx0ICAgKlxuXHQgICAqICAgICAxMTpoZWxsbyB3b3JsZDI6aGlcblx0ICAgKlxuXHQgICAqIElmIGFueSBjb250ZW50cyBhcmUgYmluYXJ5LCB0aGV5IHdpbGwgYmUgZW5jb2RlZCBhcyBiYXNlNjQgc3RyaW5ncy4gQmFzZTY0XG5cdCAgICogZW5jb2RlZCBzdHJpbmdzIGFyZSBtYXJrZWQgd2l0aCBhIGIgYmVmb3JlIHRoZSBsZW5ndGggc3BlY2lmaWVyXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0FycmF5fSBwYWNrZXRzXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZVBheWxvYWQgPSBmdW5jdGlvbiAocGFja2V0cywgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIHN1cHBvcnRzQmluYXJ5ID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gc3VwcG9ydHNCaW5hcnk7XG5cdCAgICAgIHN1cHBvcnRzQmluYXJ5ID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgdmFyIGlzQmluYXJ5ID0gaGFzQmluYXJ5JDEocGFja2V0cyk7XG5cblx0ICAgIGlmIChzdXBwb3J0c0JpbmFyeSAmJiBpc0JpbmFyeSkge1xuXHQgICAgICBpZiAoQmxvYiQxICYmICFkb250U2VuZEJsb2JzKSB7XG5cdCAgICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlUGF5bG9hZEFzQmxvYihwYWNrZXRzLCBjYWxsYmFjayk7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVQYXlsb2FkQXNBcnJheUJ1ZmZlcihwYWNrZXRzLCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIGlmICghcGFja2V0cy5sZW5ndGgpIHtcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKCcwOicpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBzZXRMZW5ndGhIZWFkZXIobWVzc2FnZSkge1xuXHQgICAgICByZXR1cm4gbWVzc2FnZS5sZW5ndGggKyAnOicgKyBtZXNzYWdlO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBlbmNvZGVPbmUocGFja2V0LCBkb25lQ2FsbGJhY2spIHtcblx0ICAgICAgZXhwb3J0cy5lbmNvZGVQYWNrZXQocGFja2V0LCAhaXNCaW5hcnkgPyBmYWxzZSA6IHN1cHBvcnRzQmluYXJ5LCBmYWxzZSwgZnVuY3Rpb24gKG1lc3NhZ2UpIHtcblx0ICAgICAgICBkb25lQ2FsbGJhY2sobnVsbCwgc2V0TGVuZ3RoSGVhZGVyKG1lc3NhZ2UpKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIG1hcChwYWNrZXRzLCBlbmNvZGVPbmUsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlc3VsdHMuam9pbignJykpO1xuXHQgICAgfSk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEFzeW5jIGFycmF5IG1hcCB1c2luZyBhZnRlclxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbWFwKGFyeSwgZWFjaCwgZG9uZSkge1xuXHQgICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShhcnkubGVuZ3RoKTtcblx0ICAgIHZhciBuZXh0ID0gYWZ0ZXIkMihhcnkubGVuZ3RoLCBkb25lKTtcblxuXHQgICAgdmFyIGVhY2hXaXRoSW5kZXggPSBmdW5jdGlvbiBlYWNoV2l0aEluZGV4KGksIGVsLCBjYikge1xuXHQgICAgICBlYWNoKGVsLCBmdW5jdGlvbiAoZXJyb3IsIG1zZykge1xuXHQgICAgICAgIHJlc3VsdFtpXSA9IG1zZztcblx0ICAgICAgICBjYihlcnJvciwgcmVzdWx0KTtcblx0ICAgICAgfSk7XG5cdCAgICB9O1xuXG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuXHQgICAgICBlYWNoV2l0aEluZGV4KGksIGFyeVtpXSwgbmV4dCk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLypcblx0ICAgKiBEZWNvZGVzIGRhdGEgd2hlbiBhIHBheWxvYWQgaXMgbWF5YmUgZXhwZWN0ZWQuIFBvc3NpYmxlIGJpbmFyeSBjb250ZW50cyBhcmVcblx0ICAgKiBkZWNvZGVkIGZyb20gdGhlaXIgYmFzZTY0IHJlcHJlc2VudGF0aW9uXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZGF0YSwgY2FsbGJhY2sgbWV0aG9kXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZGVjb2RlUGF5bG9hZCA9IGZ1bmN0aW9uIChkYXRhLCBiaW5hcnlUeXBlLCBjYWxsYmFjaykge1xuXHQgICAgaWYgKHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJykge1xuXHQgICAgICByZXR1cm4gZXhwb3J0cy5kZWNvZGVQYXlsb2FkQXNCaW5hcnkoZGF0YSwgYmluYXJ5VHlwZSwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodHlwZW9mIGJpbmFyeVR5cGUgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSBiaW5hcnlUeXBlO1xuXHQgICAgICBiaW5hcnlUeXBlID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgdmFyIHBhY2tldDtcblx0ICAgIGlmIChkYXRhID09PSAnJykge1xuXHQgICAgICAvLyBwYXJzZXIgZXJyb3IgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgbGVuZ3RoID0gJycsXG5cdCAgICAgICAgbixcblx0ICAgICAgICBtc2c7XG5cblx0ICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgICAgdmFyIGNociA9IGRhdGEuY2hhckF0KGkpO1xuXG5cdCAgICAgIGlmIChjaHIgIT09ICc6Jykge1xuXHQgICAgICAgIGxlbmd0aCArPSBjaHI7XG5cdCAgICAgICAgY29udGludWU7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobGVuZ3RoID09PSAnJyB8fCBsZW5ndGggIT0gKG4gPSBOdW1iZXIobGVuZ3RoKSkpIHtcblx0ICAgICAgICAvLyBwYXJzZXIgZXJyb3IgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBtc2cgPSBkYXRhLnN1YnN0cihpICsgMSwgbik7XG5cblx0ICAgICAgaWYgKGxlbmd0aCAhPSBtc2cubGVuZ3RoKSB7XG5cdCAgICAgICAgLy8gcGFyc2VyIGVycm9yIC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKG1zZy5sZW5ndGgpIHtcblx0ICAgICAgICBwYWNrZXQgPSBleHBvcnRzLmRlY29kZVBhY2tldChtc2csIGJpbmFyeVR5cGUsIGZhbHNlKTtcblxuXHQgICAgICAgIGlmIChlcnIudHlwZSA9PT0gcGFja2V0LnR5cGUgJiYgZXJyLmRhdGEgPT09IHBhY2tldC5kYXRhKSB7XG5cdCAgICAgICAgICAvLyBwYXJzZXIgZXJyb3IgaW4gaW5kaXZpZHVhbCBwYWNrZXQgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2YXIgcmV0ID0gY2FsbGJhY2socGFja2V0LCBpICsgbiwgbCk7XG5cdCAgICAgICAgaWYgKGZhbHNlID09PSByZXQpIHJldHVybjtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIGFkdmFuY2UgY3Vyc29yXG5cdCAgICAgIGkgKz0gbjtcblx0ICAgICAgbGVuZ3RoID0gJyc7XG5cdCAgICB9XG5cblx0ICAgIGlmIChsZW5ndGggIT09ICcnKSB7XG5cdCAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXMgbXVsdGlwbGUgbWVzc2FnZXMgKHBheWxvYWQpIGFzIGJpbmFyeS5cblx0ICAgKlxuXHQgICAqIDwxID0gYmluYXJ5LCAwID0gc3RyaW5nPjxudW1iZXIgZnJvbSAwLTk+PG51bWJlciBmcm9tIDAtOT5bLi4uXTxudW1iZXJcblx0ICAgKiAyNTU+PGRhdGE+XG5cdCAgICpcblx0ICAgKiBFeGFtcGxlOlxuXHQgICAqIDEgMyAyNTUgMSAyIDMsIGlmIHRoZSBiaW5hcnkgY29udGVudHMgYXJlIGludGVycHJldGVkIGFzIDggYml0IGludGVnZXJzXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0FycmF5fSBwYWNrZXRzXG5cdCAgICogQHJldHVybiB7QXJyYXlCdWZmZXJ9IGVuY29kZWQgcGF5bG9hZFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVQYXlsb2FkQXNBcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIChwYWNrZXRzLCBjYWxsYmFjaykge1xuXHQgICAgaWYgKCFwYWNrZXRzLmxlbmd0aCkge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEFycmF5QnVmZmVyKDApKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gZW5jb2RlT25lKHBhY2tldCwgZG9uZUNhbGxiYWNrKSB7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgdHJ1ZSwgdHJ1ZSwgZnVuY3Rpb24gKGRhdGEpIHtcblx0ICAgICAgICByZXR1cm4gZG9uZUNhbGxiYWNrKG51bGwsIGRhdGEpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgbWFwKHBhY2tldHMsIGVuY29kZU9uZSwgZnVuY3Rpb24gKGVyciwgZW5jb2RlZFBhY2tldHMpIHtcblx0ICAgICAgdmFyIHRvdGFsTGVuZ3RoID0gZW5jb2RlZFBhY2tldHMucmVkdWNlKGZ1bmN0aW9uIChhY2MsIHApIHtcblx0ICAgICAgICB2YXIgbGVuO1xuXHQgICAgICAgIGlmICh0eXBlb2YgcCA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgICAgIGxlbiA9IHAubGVuZ3RoO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBsZW4gPSBwLmJ5dGVMZW5ndGg7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIHJldHVybiBhY2MgKyBsZW4udG9TdHJpbmcoKS5sZW5ndGggKyBsZW4gKyAyOyAvLyBzdHJpbmcvYmluYXJ5IGlkZW50aWZpZXIgKyBzZXBhcmF0b3IgPSAyXG5cdCAgICAgIH0sIDApO1xuXG5cdCAgICAgIHZhciByZXN1bHRBcnJheSA9IG5ldyBVaW50OEFycmF5KHRvdGFsTGVuZ3RoKTtcblxuXHQgICAgICB2YXIgYnVmZmVySW5kZXggPSAwO1xuXHQgICAgICBlbmNvZGVkUGFja2V0cy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG5cdCAgICAgICAgdmFyIGlzU3RyaW5nID0gdHlwZW9mIHAgPT09ICdzdHJpbmcnO1xuXHQgICAgICAgIHZhciBhYiA9IHA7XG5cdCAgICAgICAgaWYgKGlzU3RyaW5nKSB7XG5cdCAgICAgICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KHAubGVuZ3RoKTtcblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgICB2aWV3W2ldID0gcC5jaGFyQ29kZUF0KGkpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAgYWIgPSB2aWV3LmJ1ZmZlcjtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBpZiAoaXNTdHJpbmcpIHtcblx0ICAgICAgICAgIC8vIG5vdCB0cnVlIGJpbmFyeVxuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSAwO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAvLyB0cnVlIGJpbmFyeVxuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSAxO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHZhciBsZW5TdHIgPSBhYi5ieXRlTGVuZ3RoLnRvU3RyaW5nKCk7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5TdHIubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIHJlc3VsdEFycmF5W2J1ZmZlckluZGV4KytdID0gcGFyc2VJbnQobGVuU3RyW2ldKTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSAyNTU7XG5cblx0ICAgICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGFiKTtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpZXcubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIHJlc3VsdEFycmF5W2J1ZmZlckluZGV4KytdID0gdmlld1tpXTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhyZXN1bHRBcnJheS5idWZmZXIpO1xuXHQgICAgfSk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBhcyBCbG9iXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZVBheWxvYWRBc0Jsb2IgPSBmdW5jdGlvbiAocGFja2V0cywgY2FsbGJhY2spIHtcblx0ICAgIGZ1bmN0aW9uIGVuY29kZU9uZShwYWNrZXQsIGRvbmVDYWxsYmFjaykge1xuXHQgICAgICBleHBvcnRzLmVuY29kZVBhY2tldChwYWNrZXQsIHRydWUsIHRydWUsIGZ1bmN0aW9uIChlbmNvZGVkKSB7XG5cdCAgICAgICAgdmFyIGJpbmFyeUlkZW50aWZpZXIgPSBuZXcgVWludDhBcnJheSgxKTtcblx0ICAgICAgICBiaW5hcnlJZGVudGlmaWVyWzBdID0gMTtcblx0ICAgICAgICBpZiAodHlwZW9mIGVuY29kZWQgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGVuY29kZWQubGVuZ3RoKTtcblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW5jb2RlZC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgICB2aWV3W2ldID0gZW5jb2RlZC5jaGFyQ29kZUF0KGkpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgICAgZW5jb2RlZCA9IHZpZXcuYnVmZmVyO1xuXHQgICAgICAgICAgYmluYXJ5SWRlbnRpZmllclswXSA9IDA7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdmFyIGxlbiA9IGVuY29kZWQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciA/IGVuY29kZWQuYnl0ZUxlbmd0aCA6IGVuY29kZWQuc2l6ZTtcblxuXHQgICAgICAgIHZhciBsZW5TdHIgPSBsZW4udG9TdHJpbmcoKTtcblx0ICAgICAgICB2YXIgbGVuZ3RoQXJ5ID0gbmV3IFVpbnQ4QXJyYXkobGVuU3RyLmxlbmd0aCArIDEpO1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuU3RyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICBsZW5ndGhBcnlbaV0gPSBwYXJzZUludChsZW5TdHJbaV0pO1xuXHQgICAgICAgIH1cblx0ICAgICAgICBsZW5ndGhBcnlbbGVuU3RyLmxlbmd0aF0gPSAyNTU7XG5cblx0ICAgICAgICBpZiAoQmxvYiQxKSB7XG5cdCAgICAgICAgICB2YXIgYmxvYiA9IG5ldyBCbG9iJDEoW2JpbmFyeUlkZW50aWZpZXIuYnVmZmVyLCBsZW5ndGhBcnkuYnVmZmVyLCBlbmNvZGVkXSk7XG5cdCAgICAgICAgICBkb25lQ2FsbGJhY2sobnVsbCwgYmxvYik7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgbWFwKHBhY2tldHMsIGVuY29kZU9uZSwgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEJsb2IkMShyZXN1bHRzKSk7XG5cdCAgICB9KTtcblx0ICB9O1xuXG5cdCAgLypcblx0ICAgKiBEZWNvZGVzIGRhdGEgd2hlbiBhIHBheWxvYWQgaXMgbWF5YmUgZXhwZWN0ZWQuIFN0cmluZ3MgYXJlIGRlY29kZWQgYnlcblx0ICAgKiBpbnRlcnByZXRpbmcgZWFjaCBieXRlIGFzIGEga2V5IGNvZGUgZm9yIGVudHJpZXMgbWFya2VkIHRvIHN0YXJ0IHdpdGggMC4gU2VlXG5cdCAgICogZGVzY3JpcHRpb24gb2YgZW5jb2RlUGF5bG9hZEFzQmluYXJ5XG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBkYXRhLCBjYWxsYmFjayBtZXRob2Rcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVQYXlsb2FkQXNCaW5hcnkgPSBmdW5jdGlvbiAoZGF0YSwgYmluYXJ5VHlwZSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICh0eXBlb2YgYmluYXJ5VHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IGJpbmFyeVR5cGU7XG5cdCAgICAgIGJpbmFyeVR5cGUgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgYnVmZmVyVGFpbCA9IGRhdGE7XG5cdCAgICB2YXIgYnVmZmVycyA9IFtdO1xuXG5cdCAgICB3aGlsZSAoYnVmZmVyVGFpbC5ieXRlTGVuZ3RoID4gMCkge1xuXHQgICAgICB2YXIgdGFpbEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyVGFpbCk7XG5cdCAgICAgIHZhciBpc1N0cmluZyA9IHRhaWxBcnJheVswXSA9PT0gMDtcblx0ICAgICAgdmFyIG1zZ0xlbmd0aCA9ICcnO1xuXG5cdCAgICAgIGZvciAodmFyIGkgPSAxOzsgaSsrKSB7XG5cdCAgICAgICAgaWYgKHRhaWxBcnJheVtpXSA9PT0gMjU1KSBicmVhaztcblxuXHQgICAgICAgIC8vIDMxMCA9IGNoYXIgbGVuZ3RoIG9mIE51bWJlci5NQVhfVkFMVUVcblx0ICAgICAgICBpZiAobXNnTGVuZ3RoLmxlbmd0aCA+IDMxMCkge1xuXHQgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgbXNnTGVuZ3RoICs9IHRhaWxBcnJheVtpXTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGJ1ZmZlclRhaWwgPSBzbGljZUJ1ZmZlcihidWZmZXJUYWlsLCAyICsgbXNnTGVuZ3RoLmxlbmd0aCk7XG5cdCAgICAgIG1zZ0xlbmd0aCA9IHBhcnNlSW50KG1zZ0xlbmd0aCk7XG5cblx0ICAgICAgdmFyIG1zZyA9IHNsaWNlQnVmZmVyKGJ1ZmZlclRhaWwsIDAsIG1zZ0xlbmd0aCk7XG5cdCAgICAgIGlmIChpc1N0cmluZykge1xuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICBtc2cgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KG1zZykpO1xuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgIC8vIGlQaG9uZSBTYWZhcmkgZG9lc24ndCBsZXQgeW91IGFwcGx5IHRvIHR5cGVkIGFycmF5c1xuXHQgICAgICAgICAgdmFyIHR5cGVkID0gbmV3IFVpbnQ4QXJyYXkobXNnKTtcblx0ICAgICAgICAgIG1zZyA9ICcnO1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlZC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgICBtc2cgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh0eXBlZFtpXSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgYnVmZmVycy5wdXNoKG1zZyk7XG5cdCAgICAgIGJ1ZmZlclRhaWwgPSBzbGljZUJ1ZmZlcihidWZmZXJUYWlsLCBtc2dMZW5ndGgpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgdG90YWwgPSBidWZmZXJzLmxlbmd0aDtcblx0ICAgIGJ1ZmZlcnMuZm9yRWFjaChmdW5jdGlvbiAoYnVmZmVyLCBpKSB7XG5cdCAgICAgIGNhbGxiYWNrKGV4cG9ydHMuZGVjb2RlUGFja2V0KGJ1ZmZlciwgYmluYXJ5VHlwZSwgdHJ1ZSksIGksIHRvdGFsKTtcblx0ICAgIH0pO1xuXHQgIH07XG5cdH0pO1xuXHR2YXIgYnJvd3Nlcl8xJDEgPSBicm93c2VyJDIucHJvdG9jb2w7XG5cdHZhciBicm93c2VyXzIkMSA9IGJyb3dzZXIkMi5wYWNrZXRzO1xuXHR2YXIgYnJvd3Nlcl8zJDEgPSBicm93c2VyJDIuZW5jb2RlUGFja2V0O1xuXHR2YXIgYnJvd3Nlcl80JDEgPSBicm93c2VyJDIuZW5jb2RlQmFzZTY0UGFja2V0O1xuXHR2YXIgYnJvd3Nlcl81JDEgPSBicm93c2VyJDIuZGVjb2RlUGFja2V0O1xuXHR2YXIgYnJvd3Nlcl82JDEgPSBicm93c2VyJDIuZGVjb2RlQmFzZTY0UGFja2V0O1xuXHR2YXIgYnJvd3Nlcl83JDEgPSBicm93c2VyJDIuZW5jb2RlUGF5bG9hZDtcblx0dmFyIGJyb3dzZXJfOCA9IGJyb3dzZXIkMi5kZWNvZGVQYXlsb2FkO1xuXHR2YXIgYnJvd3Nlcl85ID0gYnJvd3NlciQyLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyO1xuXHR2YXIgYnJvd3Nlcl8xMCA9IGJyb3dzZXIkMi5lbmNvZGVQYXlsb2FkQXNCbG9iO1xuXHR2YXIgYnJvd3Nlcl8xMSA9IGJyb3dzZXIkMi5kZWNvZGVQYXlsb2FkQXNCaW5hcnk7XG5cblx0dmFyIGJyb3dzZXIkMyA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBicm93c2VyJDIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBicm93c2VyJDIsXG5cdFx0cHJvdG9jb2w6IGJyb3dzZXJfMSQxLFxuXHRcdHBhY2tldHM6IGJyb3dzZXJfMiQxLFxuXHRcdGVuY29kZVBhY2tldDogYnJvd3Nlcl8zJDEsXG5cdFx0ZW5jb2RlQmFzZTY0UGFja2V0OiBicm93c2VyXzQkMSxcblx0XHRkZWNvZGVQYWNrZXQ6IGJyb3dzZXJfNSQxLFxuXHRcdGRlY29kZUJhc2U2NFBhY2tldDogYnJvd3Nlcl82JDEsXG5cdFx0ZW5jb2RlUGF5bG9hZDogYnJvd3Nlcl83JDEsXG5cdFx0ZGVjb2RlUGF5bG9hZDogYnJvd3Nlcl84LFxuXHRcdGVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyOiBicm93c2VyXzksXG5cdFx0ZW5jb2RlUGF5bG9hZEFzQmxvYjogYnJvd3Nlcl8xMCxcblx0XHRkZWNvZGVQYXlsb2FkQXNCaW5hcnk6IGJyb3dzZXJfMTFcblx0fSk7XG5cblx0dmFyIHBhcnNlciA9ICggYnJvd3NlciQzICYmIGJyb3dzZXIkMiApIHx8IGJyb3dzZXIkMztcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgdHJhbnNwb3J0ID0gVHJhbnNwb3J0O1xuXG5cdC8qKlxuXHQgKiBUcmFuc3BvcnQgYWJzdHJhY3QgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gVHJhbnNwb3J0KG9wdHMpIHtcblx0ICB0aGlzLnBhdGggPSBvcHRzLnBhdGg7XG5cdCAgdGhpcy5ob3N0bmFtZSA9IG9wdHMuaG9zdG5hbWU7XG5cdCAgdGhpcy5wb3J0ID0gb3B0cy5wb3J0O1xuXHQgIHRoaXMuc2VjdXJlID0gb3B0cy5zZWN1cmU7XG5cdCAgdGhpcy5xdWVyeSA9IG9wdHMucXVlcnk7XG5cdCAgdGhpcy50aW1lc3RhbXBQYXJhbSA9IG9wdHMudGltZXN0YW1wUGFyYW07XG5cdCAgdGhpcy50aW1lc3RhbXBSZXF1ZXN0cyA9IG9wdHMudGltZXN0YW1wUmVxdWVzdHM7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJyc7XG5cdCAgdGhpcy5hZ2VudCA9IG9wdHMuYWdlbnQgfHwgZmFsc2U7XG5cdCAgdGhpcy5zb2NrZXQgPSBvcHRzLnNvY2tldDtcblx0ICB0aGlzLmVuYWJsZXNYRFIgPSBvcHRzLmVuYWJsZXNYRFI7XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLnBmeCA9IG9wdHMucGZ4O1xuXHQgIHRoaXMua2V5ID0gb3B0cy5rZXk7XG5cdCAgdGhpcy5wYXNzcGhyYXNlID0gb3B0cy5wYXNzcGhyYXNlO1xuXHQgIHRoaXMuY2VydCA9IG9wdHMuY2VydDtcblx0ICB0aGlzLmNhID0gb3B0cy5jYTtcblx0ICB0aGlzLmNpcGhlcnMgPSBvcHRzLmNpcGhlcnM7XG5cdCAgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQgPSBvcHRzLnJlamVjdFVuYXV0aG9yaXplZDtcblx0ICB0aGlzLmZvcmNlTm9kZSA9IG9wdHMuZm9yY2VOb2RlO1xuXG5cdCAgLy8gb3RoZXIgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLmV4dHJhSGVhZGVycyA9IG9wdHMuZXh0cmFIZWFkZXJzO1xuXHQgIHRoaXMubG9jYWxBZGRyZXNzID0gb3B0cy5sb2NhbEFkZHJlc3M7XG5cdH1cblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihUcmFuc3BvcnQucHJvdG90eXBlKTtcblxuXHQvKipcblx0ICogRW1pdHMgYW4gZXJyb3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcblx0ICogQHJldHVybiB7VHJhbnNwb3J0fSBmb3IgY2hhaW5pbmdcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24gKG1zZywgZGVzYykge1xuXHQgIHZhciBlcnIgPSBuZXcgRXJyb3IobXNnKTtcblx0ICBlcnIudHlwZSA9ICdUcmFuc3BvcnRFcnJvcic7XG5cdCAgZXJyLmRlc2NyaXB0aW9uID0gZGVzYztcblx0ICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogT3BlbnMgdGhlIHRyYW5zcG9ydC5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICgnY2xvc2VkJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuaW5nJztcblx0ICAgIHRoaXMuZG9PcGVuKCk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlcyB0aGUgdHJhbnNwb3J0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHRoaXMuZG9DbG9zZSgpO1xuXHQgICAgdGhpcy5vbkNsb3NlKCk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNlbmRzIG11bHRpcGxlIHBhY2tldHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uIChwYWNrZXRzKSB7XG5cdCAgaWYgKCdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICB0aGlzLndyaXRlKHBhY2tldHMpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aHJvdyBuZXcgRXJyb3IoJ1RyYW5zcG9ydCBub3Qgb3BlbicpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gb3BlblxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vbk9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW4nO1xuXHQgIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuXHQgIHRoaXMuZW1pdCgnb3BlbicpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2l0aCBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGF0YVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHZhciBwYWNrZXQgPSBwYXJzZXIuZGVjb2RlUGFja2V0KGRhdGEsIHRoaXMuc29ja2V0LmJpbmFyeVR5cGUpO1xuXHQgIHRoaXMub25QYWNrZXQocGFja2V0KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdpdGggYSBkZWNvZGVkIHBhY2tldC5cblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vblBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICB0aGlzLmVtaXQoJ3BhY2tldCcsIHBhY2tldCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGNsb3NlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5vbkNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXHQgIHRoaXMuZW1pdCgnY2xvc2UnKTtcblx0fTtcblxuXHR2YXIgdHJhbnNwb3J0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogdHJhbnNwb3J0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdHJhbnNwb3J0XG5cdH0pO1xuXG5cdC8qKlxyXG5cdCAqIENvbXBpbGVzIGEgcXVlcnlzdHJpbmdcclxuXHQgKiBSZXR1cm5zIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgb2JqZWN0XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH1cclxuXHQgKiBAYXBpIHByaXZhdGVcclxuXHQgKi9cblxuXHR2YXIgZW5jb2RlID0gZnVuY3Rpb24gZW5jb2RlKG9iaikge1xuXHQgIHZhciBzdHIgPSAnJztcblxuXHQgIGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdCAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGkpKSB7XG5cdCAgICAgIGlmIChzdHIubGVuZ3RoKSBzdHIgKz0gJyYnO1xuXHQgICAgICBzdHIgKz0gZW5jb2RlVVJJQ29tcG9uZW50KGkpICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KG9ialtpXSk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHN0cjtcblx0fTtcblxuXHQvKipcclxuXHQgKiBQYXJzZXMgYSBzaW1wbGUgcXVlcnlzdHJpbmcgaW50byBhbiBvYmplY3RcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBxc1xyXG5cdCAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAqL1xuXG5cdHZhciBkZWNvZGUgPSBmdW5jdGlvbiBkZWNvZGUocXMpIHtcblx0ICB2YXIgcXJ5ID0ge307XG5cdCAgdmFyIHBhaXJzID0gcXMuc3BsaXQoJyYnKTtcblx0ICBmb3IgKHZhciBpID0gMCwgbCA9IHBhaXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgdmFyIHBhaXIgPSBwYWlyc1tpXS5zcGxpdCgnPScpO1xuXHQgICAgcXJ5W2RlY29kZVVSSUNvbXBvbmVudChwYWlyWzBdKV0gPSBkZWNvZGVVUklDb21wb25lbnQocGFpclsxXSk7XG5cdCAgfVxuXHQgIHJldHVybiBxcnk7XG5cdH07XG5cblx0dmFyIHBhcnNlcXMgPSB7XG5cdCAgZW5jb2RlOiBlbmNvZGUsXG5cdCAgZGVjb2RlOiBkZWNvZGVcblx0fTtcblxuXHR2YXIgcGFyc2VxcyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBhcnNlcXMsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwYXJzZXFzLFxuXHRcdGVuY29kZTogZW5jb2RlLFxuXHRcdGRlY29kZTogZGVjb2RlXG5cdH0pO1xuXG5cdHZhciBjb21wb25lbnRJbmhlcml0ID0gZnVuY3Rpb24gY29tcG9uZW50SW5oZXJpdChhLCBiKSB7XG5cdCAgdmFyIGZuID0gZnVuY3Rpb24gZm4oKSB7fTtcblx0ICBmbi5wcm90b3R5cGUgPSBiLnByb3RvdHlwZTtcblx0ICBhLnByb3RvdHlwZSA9IG5ldyBmbigpO1xuXHQgIGEucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gYTtcblx0fTtcblxuXHR2YXIgY29tcG9uZW50SW5oZXJpdCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGNvbXBvbmVudEluaGVyaXQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBjb21wb25lbnRJbmhlcml0XG5cdH0pO1xuXG5cdHZhciBhbHBoYWJldCA9ICcwMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ei1fJy5zcGxpdCgnJyksXG5cdCAgICBsZW5ndGggPSA2NCxcblx0ICAgIG1hcCA9IHt9LFxuXHQgICAgc2VlZCA9IDAsXG5cdCAgICBpID0gMCxcblx0ICAgIHByZXY7XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIHNwZWNpZmllZCBudW1iZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBudW0gVGhlIG51bWJlciB0byBjb252ZXJ0LlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBudW1iZXIuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUkMShudW0pIHtcblx0ICB2YXIgZW5jb2RlZCA9ICcnO1xuXG5cdCAgZG8ge1xuXHQgICAgZW5jb2RlZCA9IGFscGhhYmV0W251bSAlIGxlbmd0aF0gKyBlbmNvZGVkO1xuXHQgICAgbnVtID0gTWF0aC5mbG9vcihudW0gLyBsZW5ndGgpO1xuXHQgIH0gd2hpbGUgKG51bSA+IDApO1xuXG5cdCAgcmV0dXJuIGVuY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBpbnRlZ2VyIHZhbHVlIHNwZWNpZmllZCBieSB0aGUgZ2l2ZW4gc3RyaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gY29udmVydC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGludGVnZXIgdmFsdWUgcmVwcmVzZW50ZWQgYnkgdGhlIHN0cmluZy5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZSQxKHN0cikge1xuXHQgIHZhciBkZWNvZGVkID0gMDtcblxuXHQgIGZvciAoaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcblx0ICAgIGRlY29kZWQgPSBkZWNvZGVkICogbGVuZ3RoICsgbWFwW3N0ci5jaGFyQXQoaSldO1xuXHQgIH1cblxuXHQgIHJldHVybiBkZWNvZGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFllYXN0OiBBIHRpbnkgZ3Jvd2luZyBpZCBnZW5lcmF0b3IuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IEEgdW5pcXVlIGlkLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblx0ZnVuY3Rpb24geWVhc3QoKSB7XG5cdCAgdmFyIG5vdyA9IGVuY29kZSQxKCtuZXcgRGF0ZSgpKTtcblxuXHQgIGlmIChub3cgIT09IHByZXYpIHJldHVybiBzZWVkID0gMCwgcHJldiA9IG5vdztcblx0ICByZXR1cm4gbm93ICsgJy4nICsgZW5jb2RlJDEoc2VlZCsrKTtcblx0fVxuXG5cdC8vXG5cdC8vIE1hcCBlYWNoIGNoYXJhY3RlciB0byBpdHMgaW5kZXguXG5cdC8vXG5cdGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0ICBtYXBbYWxwaGFiZXRbaV1dID0gaTtcblx0fSAvL1xuXHQvLyBFeHBvc2UgdGhlIGB5ZWFzdGAsIGBlbmNvZGVgIGFuZCBgZGVjb2RlYCBmdW5jdGlvbnMuXG5cdC8vXG5cdHllYXN0LmVuY29kZSA9IGVuY29kZSQxO1xuXHR5ZWFzdC5kZWNvZGUgPSBkZWNvZGUkMTtcblx0dmFyIHllYXN0XzEgPSB5ZWFzdDtcblxuXHR2YXIgeWVhc3QkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB5ZWFzdF8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogeWVhc3RfMVxuXHR9KTtcblxuXHR2YXIgVHJhbnNwb3J0JDEgPSAoIHRyYW5zcG9ydCQxICYmIHRyYW5zcG9ydCApIHx8IHRyYW5zcG9ydCQxO1xuXG5cdHZhciBwYXJzZXFzJDIgPSAoIHBhcnNlcXMkMSAmJiBwYXJzZXFzICkgfHwgcGFyc2VxcyQxO1xuXG5cdHZhciBpbmhlcml0ID0gKCBjb21wb25lbnRJbmhlcml0JDEgJiYgY29tcG9uZW50SW5oZXJpdCApIHx8IGNvbXBvbmVudEluaGVyaXQkMTtcblxuXHR2YXIgeWVhc3QkMiA9ICggeWVhc3QkMSAmJiB5ZWFzdF8xICkgfHwgeWVhc3QkMTtcblxuXHR2YXIgcmVxdWlyZSQkMSA9ICggeG1saHR0cHJlcXVlc3QkMSAmJiB4bWxodHRwcmVxdWVzdCApIHx8IHhtbGh0dHByZXF1ZXN0JDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQzID0gcmVxdWlyZSQkMCQyKCdlbmdpbmUuaW8tY2xpZW50OnBvbGxpbmcnKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBwb2xsaW5nID0gUG9sbGluZztcblxuXHQvKipcblx0ICogSXMgWEhSMiBzdXBwb3J0ZWQ/XG5cdCAqL1xuXG5cdHZhciBoYXNYSFIyID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBYTUxIdHRwUmVxdWVzdCA9IHJlcXVpcmUkJDE7XG5cdCAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCh7IHhkb21haW46IGZhbHNlIH0pO1xuXHQgIHJldHVybiBudWxsICE9IHhoci5yZXNwb25zZVR5cGU7XG5cdH0oKTtcblxuXHQvKipcblx0ICogUG9sbGluZyBpbnRlcmZhY2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBQb2xsaW5nKG9wdHMpIHtcblx0ICB2YXIgZm9yY2VCYXNlNjQgPSBvcHRzICYmIG9wdHMuZm9yY2VCYXNlNjQ7XG5cdCAgaWYgKCFoYXNYSFIyIHx8IGZvcmNlQmFzZTY0KSB7XG5cdCAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cdCAgfVxuXHQgIFRyYW5zcG9ydCQxLmNhbGwodGhpcywgb3B0cyk7XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBUcmFuc3BvcnQuXG5cdCAqL1xuXG5cdGluaGVyaXQoUG9sbGluZywgVHJhbnNwb3J0JDEpO1xuXG5cdC8qKlxuXHQgKiBUcmFuc3BvcnQgbmFtZS5cblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUubmFtZSA9ICdwb2xsaW5nJztcblxuXHQvKipcblx0ICogT3BlbnMgdGhlIHNvY2tldCAodHJpZ2dlcnMgcG9sbGluZykuIFdlIHdyaXRlIGEgUElORyBtZXNzYWdlIHRvIGRldGVybWluZVxuXHQgKiB3aGVuIHRoZSB0cmFuc3BvcnQgaXMgb3Blbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLmRvT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLnBvbGwoKTtcblx0fTtcblxuXHQvKipcblx0ICogUGF1c2VzIHBvbGxpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIHVwb24gYnVmZmVycyBhcmUgZmx1c2hlZCBhbmQgdHJhbnNwb3J0IGlzIHBhdXNlZFxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbiAob25QYXVzZSkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdwYXVzaW5nJztcblxuXHQgIGZ1bmN0aW9uIHBhdXNlKCkge1xuXHQgICAgZGVidWckMygncGF1c2VkJyk7XG5cdCAgICBzZWxmLnJlYWR5U3RhdGUgPSAncGF1c2VkJztcblx0ICAgIG9uUGF1c2UoKTtcblx0ICB9XG5cblx0ICBpZiAodGhpcy5wb2xsaW5nIHx8ICF0aGlzLndyaXRhYmxlKSB7XG5cdCAgICB2YXIgdG90YWwgPSAwO1xuXG5cdCAgICBpZiAodGhpcy5wb2xsaW5nKSB7XG5cdCAgICAgIGRlYnVnJDMoJ3dlIGFyZSBjdXJyZW50bHkgcG9sbGluZyAtIHdhaXRpbmcgdG8gcGF1c2UnKTtcblx0ICAgICAgdG90YWwrKztcblx0ICAgICAgdGhpcy5vbmNlKCdwb2xsQ29tcGxldGUnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgZGVidWckMygncHJlLXBhdXNlIHBvbGxpbmcgY29tcGxldGUnKTtcblx0ICAgICAgICAtLXRvdGFsIHx8IHBhdXNlKCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIXRoaXMud3JpdGFibGUpIHtcblx0ICAgICAgZGVidWckMygnd2UgYXJlIGN1cnJlbnRseSB3cml0aW5nIC0gd2FpdGluZyB0byBwYXVzZScpO1xuXHQgICAgICB0b3RhbCsrO1xuXHQgICAgICB0aGlzLm9uY2UoJ2RyYWluJywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGRlYnVnJDMoJ3ByZS1wYXVzZSB3cml0aW5nIGNvbXBsZXRlJyk7XG5cdCAgICAgICAgLS10b3RhbCB8fCBwYXVzZSgpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblx0ICB9IGVsc2Uge1xuXHQgICAgcGF1c2UoKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyBwb2xsaW5nIGN5Y2xlLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5wb2xsID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDMoJ3BvbGxpbmcnKTtcblx0ICB0aGlzLnBvbGxpbmcgPSB0cnVlO1xuXHQgIHRoaXMuZG9Qb2xsKCk7XG5cdCAgdGhpcy5lbWl0KCdwb2xsJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIE92ZXJsb2FkcyBvbkRhdGEgdG8gZGV0ZWN0IHBheWxvYWRzLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgZGVidWckMygncG9sbGluZyBnb3QgZGF0YSAlcycsIGRhdGEpO1xuXHQgIHZhciBjYWxsYmFjayA9IGZ1bmN0aW9uIGNhbGxiYWNrKHBhY2tldCwgaW5kZXgsIHRvdGFsKSB7XG5cdCAgICAvLyBpZiBpdHMgdGhlIGZpcnN0IG1lc3NhZ2Ugd2UgY29uc2lkZXIgdGhlIHRyYW5zcG9ydCBvcGVuXG5cdCAgICBpZiAoJ29wZW5pbmcnID09PSBzZWxmLnJlYWR5U3RhdGUpIHtcblx0ICAgICAgc2VsZi5vbk9wZW4oKTtcblx0ICAgIH1cblxuXHQgICAgLy8gaWYgaXRzIGEgY2xvc2UgcGFja2V0LCB3ZSBjbG9zZSB0aGUgb25nb2luZyByZXF1ZXN0c1xuXHQgICAgaWYgKCdjbG9zZScgPT09IHBhY2tldC50eXBlKSB7XG5cdCAgICAgIHNlbGYub25DbG9zZSgpO1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIC8vIG90aGVyd2lzZSBieXBhc3Mgb25EYXRhIGFuZCBoYW5kbGUgdGhlIG1lc3NhZ2Vcblx0ICAgIHNlbGYub25QYWNrZXQocGFja2V0KTtcblx0ICB9O1xuXG5cdCAgLy8gZGVjb2RlIHBheWxvYWRcblx0ICBwYXJzZXIuZGVjb2RlUGF5bG9hZChkYXRhLCB0aGlzLnNvY2tldC5iaW5hcnlUeXBlLCBjYWxsYmFjayk7XG5cblx0ICAvLyBpZiBhbiBldmVudCBkaWQgbm90IHRyaWdnZXIgY2xvc2luZ1xuXHQgIGlmICgnY2xvc2VkJyAhPT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICAvLyBpZiB3ZSBnb3QgZGF0YSB3ZSdyZSBub3QgcG9sbGluZ1xuXHQgICAgdGhpcy5wb2xsaW5nID0gZmFsc2U7XG5cdCAgICB0aGlzLmVtaXQoJ3BvbGxDb21wbGV0ZScpO1xuXG5cdCAgICBpZiAoJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgICAgdGhpcy5wb2xsKCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBkZWJ1ZyQzKCdpZ25vcmluZyBwb2xsIC0gdHJhbnNwb3J0IHN0YXRlIFwiJXNcIicsIHRoaXMucmVhZHlTdGF0ZSk7XG5cdCAgICB9XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBGb3IgcG9sbGluZywgc2VuZCBhIGNsb3NlIHBhY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLmRvQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgZnVuY3Rpb24gY2xvc2UoKSB7XG5cdCAgICBkZWJ1ZyQzKCd3cml0aW5nIGNsb3NlIHBhY2tldCcpO1xuXHQgICAgc2VsZi53cml0ZShbeyB0eXBlOiAnY2xvc2UnIH1dKTtcblx0ICB9XG5cblx0ICBpZiAoJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIGRlYnVnJDMoJ3RyYW5zcG9ydCBvcGVuIC0gY2xvc2luZycpO1xuXHQgICAgY2xvc2UoKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgLy8gaW4gY2FzZSB3ZSdyZSB0cnlpbmcgdG8gY2xvc2Ugd2hpbGVcblx0ICAgIC8vIGhhbmRzaGFraW5nIGlzIGluIHByb2dyZXNzIChHSC0xNjQpXG5cdCAgICBkZWJ1ZyQzKCd0cmFuc3BvcnQgbm90IG9wZW4gLSBkZWZlcnJpbmcgY2xvc2UnKTtcblx0ICAgIHRoaXMub25jZSgnb3BlbicsIGNsb3NlKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyBhIHBhY2tldHMgcGF5bG9hZC5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gZGF0YSBwYWNrZXRzXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGRyYWluIGNhbGxiYWNrXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChwYWNrZXRzKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcblx0ICB2YXIgY2FsbGJhY2tmbiA9IGZ1bmN0aW9uIGNhbGxiYWNrZm4oKSB7XG5cdCAgICBzZWxmLndyaXRhYmxlID0gdHJ1ZTtcblx0ICAgIHNlbGYuZW1pdCgnZHJhaW4nKTtcblx0ICB9O1xuXG5cdCAgcGFyc2VyLmVuY29kZVBheWxvYWQocGFja2V0cywgdGhpcy5zdXBwb3J0c0JpbmFyeSwgZnVuY3Rpb24gKGRhdGEpIHtcblx0ICAgIHNlbGYuZG9Xcml0ZShkYXRhLCBjYWxsYmFja2ZuKTtcblx0ICB9KTtcblx0fTtcblxuXHQvKipcblx0ICogR2VuZXJhdGVzIHVyaSBmb3IgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLnVyaSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJ5IHx8IHt9O1xuXHQgIHZhciBzY2hlbWEgPSB0aGlzLnNlY3VyZSA/ICdodHRwcycgOiAnaHR0cCc7XG5cdCAgdmFyIHBvcnQgPSAnJztcblxuXHQgIC8vIGNhY2hlIGJ1c3RpbmcgaXMgZm9yY2VkXG5cdCAgaWYgKGZhbHNlICE9PSB0aGlzLnRpbWVzdGFtcFJlcXVlc3RzKSB7XG5cdCAgICBxdWVyeVt0aGlzLnRpbWVzdGFtcFBhcmFtXSA9IHllYXN0JDIoKTtcblx0ICB9XG5cblx0ICBpZiAoIXRoaXMuc3VwcG9ydHNCaW5hcnkgJiYgIXF1ZXJ5LnNpZCkge1xuXHQgICAgcXVlcnkuYjY0ID0gMTtcblx0ICB9XG5cblx0ICBxdWVyeSA9IHBhcnNlcXMkMi5lbmNvZGUocXVlcnkpO1xuXG5cdCAgLy8gYXZvaWQgcG9ydCBpZiBkZWZhdWx0IGZvciBzY2hlbWFcblx0ICBpZiAodGhpcy5wb3J0ICYmICgnaHR0cHMnID09PSBzY2hlbWEgJiYgTnVtYmVyKHRoaXMucG9ydCkgIT09IDQ0MyB8fCAnaHR0cCcgPT09IHNjaGVtYSAmJiBOdW1iZXIodGhpcy5wb3J0KSAhPT0gODApKSB7XG5cdCAgICBwb3J0ID0gJzonICsgdGhpcy5wb3J0O1xuXHQgIH1cblxuXHQgIC8vIHByZXBlbmQgPyB0byBxdWVyeVxuXHQgIGlmIChxdWVyeS5sZW5ndGgpIHtcblx0ICAgIHF1ZXJ5ID0gJz8nICsgcXVlcnk7XG5cdCAgfVxuXG5cdCAgdmFyIGlwdjYgPSB0aGlzLmhvc3RuYW1lLmluZGV4T2YoJzonKSAhPT0gLTE7XG5cdCAgcmV0dXJuIHNjaGVtYSArICc6Ly8nICsgKGlwdjYgPyAnWycgKyB0aGlzLmhvc3RuYW1lICsgJ10nIDogdGhpcy5ob3N0bmFtZSkgKyBwb3J0ICsgdGhpcy5wYXRoICsgcXVlcnk7XG5cdH07XG5cblx0dmFyIHBvbGxpbmckMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBwb2xsaW5nLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogcG9sbGluZ1xuXHR9KTtcblxuXHR2YXIgUG9sbGluZyQxID0gKCBwb2xsaW5nJDEgJiYgcG9sbGluZyApIHx8IHBvbGxpbmckMTtcblxuXHQvKipcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50cy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDQgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6cG9sbGluZy14aHInKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBwb2xsaW5nWGhyID0gWEhSO1xuXHR2YXIgUmVxdWVzdF8xID0gUmVxdWVzdDtcblxuXHQvKipcblx0ICogRW1wdHkgZnVuY3Rpb25cblx0ICovXG5cblx0ZnVuY3Rpb24gZW1wdHkoKSB7fVxuXG5cdC8qKlxuXHQgKiBYSFIgUG9sbGluZyBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdHNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gWEhSKG9wdHMpIHtcblx0ICBQb2xsaW5nJDEuY2FsbCh0aGlzLCBvcHRzKTtcblx0ICB0aGlzLnJlcXVlc3RUaW1lb3V0ID0gb3B0cy5yZXF1ZXN0VGltZW91dDtcblx0ICB0aGlzLmV4dHJhSGVhZGVycyA9IG9wdHMuZXh0cmFIZWFkZXJzO1xuXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uKSB7XG5cdCAgICB2YXIgaXNTU0wgPSAnaHR0cHM6JyA9PT0gbG9jYXRpb24ucHJvdG9jb2w7XG5cdCAgICB2YXIgcG9ydCA9IGxvY2F0aW9uLnBvcnQ7XG5cblx0ICAgIC8vIHNvbWUgdXNlciBhZ2VudHMgaGF2ZSBlbXB0eSBgbG9jYXRpb24ucG9ydGBcblx0ICAgIGlmICghcG9ydCkge1xuXHQgICAgICBwb3J0ID0gaXNTU0wgPyA0NDMgOiA4MDtcblx0ICAgIH1cblxuXHQgICAgdGhpcy54ZCA9IG9wdHMuaG9zdG5hbWUgIT09IGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uLmhvc3RuYW1lIHx8IHBvcnQgIT09IG9wdHMucG9ydDtcblx0ICAgIHRoaXMueHMgPSBvcHRzLnNlY3VyZSAhPT0gaXNTU0w7XG5cdCAgfVxuXHR9XG5cblx0LyoqXG5cdCAqIEluaGVyaXRzIGZyb20gUG9sbGluZy5cblx0ICovXG5cblx0aW5oZXJpdChYSFIsIFBvbGxpbmckMSk7XG5cblx0LyoqXG5cdCAqIFhIUiBzdXBwb3J0cyBiaW5hcnlcblx0ICovXG5cblx0WEhSLnByb3RvdHlwZS5zdXBwb3J0c0JpbmFyeSA9IHRydWU7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRYSFIucHJvdG90eXBlLnJlcXVlc3QgPSBmdW5jdGlvbiAob3B0cykge1xuXHQgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXHQgIG9wdHMudXJpID0gdGhpcy51cmkoKTtcblx0ICBvcHRzLnhkID0gdGhpcy54ZDtcblx0ICBvcHRzLnhzID0gdGhpcy54cztcblx0ICBvcHRzLmFnZW50ID0gdGhpcy5hZ2VudCB8fCBmYWxzZTtcblx0ICBvcHRzLnN1cHBvcnRzQmluYXJ5ID0gdGhpcy5zdXBwb3J0c0JpbmFyeTtcblx0ICBvcHRzLmVuYWJsZXNYRFIgPSB0aGlzLmVuYWJsZXNYRFI7XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLnBmeCA9IHRoaXMucGZ4O1xuXHQgIG9wdHMua2V5ID0gdGhpcy5rZXk7XG5cdCAgb3B0cy5wYXNzcGhyYXNlID0gdGhpcy5wYXNzcGhyYXNlO1xuXHQgIG9wdHMuY2VydCA9IHRoaXMuY2VydDtcblx0ICBvcHRzLmNhID0gdGhpcy5jYTtcblx0ICBvcHRzLmNpcGhlcnMgPSB0aGlzLmNpcGhlcnM7XG5cdCAgb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPSB0aGlzLnJlamVjdFVuYXV0aG9yaXplZDtcblx0ICBvcHRzLnJlcXVlc3RUaW1lb3V0ID0gdGhpcy5yZXF1ZXN0VGltZW91dDtcblxuXHQgIC8vIG90aGVyIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgb3B0cy5leHRyYUhlYWRlcnMgPSB0aGlzLmV4dHJhSGVhZGVycztcblxuXHQgIHJldHVybiBuZXcgUmVxdWVzdChvcHRzKTtcblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGEgdG8gc2VuZC5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGVkIHVwb24gZmx1c2guXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRYSFIucHJvdG90eXBlLmRvV3JpdGUgPSBmdW5jdGlvbiAoZGF0YSwgZm4pIHtcblx0ICB2YXIgaXNCaW5hcnkgPSB0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycgJiYgZGF0YSAhPT0gdW5kZWZpbmVkO1xuXHQgIHZhciByZXEgPSB0aGlzLnJlcXVlc3QoeyBtZXRob2Q6ICdQT1NUJywgZGF0YTogZGF0YSwgaXNCaW5hcnk6IGlzQmluYXJ5IH0pO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICByZXEub24oJ3N1Y2Nlc3MnLCBmbik7XG5cdCAgcmVxLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHtcblx0ICAgIHNlbGYub25FcnJvcigneGhyIHBvc3QgZXJyb3InLCBlcnIpO1xuXHQgIH0pO1xuXHQgIHRoaXMuc2VuZFhociA9IHJlcTtcblx0fTtcblxuXHQvKipcblx0ICogU3RhcnRzIGEgcG9sbCBjeWNsZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUuZG9Qb2xsID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDQoJ3hociBwb2xsJyk7XG5cdCAgdmFyIHJlcSA9IHRoaXMucmVxdWVzdCgpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICByZXEub24oJ2RhdGEnLCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgc2VsZi5vbkRhdGEoZGF0YSk7XG5cdCAgfSk7XG5cdCAgcmVxLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHtcblx0ICAgIHNlbGYub25FcnJvcigneGhyIHBvbGwgZXJyb3InLCBlcnIpO1xuXHQgIH0pO1xuXHQgIHRoaXMucG9sbFhociA9IHJlcTtcblx0fTtcblxuXHQvKipcblx0ICogUmVxdWVzdCBjb25zdHJ1Y3RvclxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBSZXF1ZXN0KG9wdHMpIHtcblx0ICB0aGlzLm1ldGhvZCA9IG9wdHMubWV0aG9kIHx8ICdHRVQnO1xuXHQgIHRoaXMudXJpID0gb3B0cy51cmk7XG5cdCAgdGhpcy54ZCA9ICEhb3B0cy54ZDtcblx0ICB0aGlzLnhzID0gISFvcHRzLnhzO1xuXHQgIHRoaXMuYXN5bmMgPSBmYWxzZSAhPT0gb3B0cy5hc3luYztcblx0ICB0aGlzLmRhdGEgPSB1bmRlZmluZWQgIT09IG9wdHMuZGF0YSA/IG9wdHMuZGF0YSA6IG51bGw7XG5cdCAgdGhpcy5hZ2VudCA9IG9wdHMuYWdlbnQ7XG5cdCAgdGhpcy5pc0JpbmFyeSA9IG9wdHMuaXNCaW5hcnk7XG5cdCAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IG9wdHMuc3VwcG9ydHNCaW5hcnk7XG5cdCAgdGhpcy5lbmFibGVzWERSID0gb3B0cy5lbmFibGVzWERSO1xuXHQgIHRoaXMucmVxdWVzdFRpbWVvdXQgPSBvcHRzLnJlcXVlc3RUaW1lb3V0O1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5wZnggPSBvcHRzLnBmeDtcblx0ICB0aGlzLmtleSA9IG9wdHMua2V5O1xuXHQgIHRoaXMucGFzc3BocmFzZSA9IG9wdHMucGFzc3BocmFzZTtcblx0ICB0aGlzLmNlcnQgPSBvcHRzLmNlcnQ7XG5cdCAgdGhpcy5jYSA9IG9wdHMuY2E7XG5cdCAgdGhpcy5jaXBoZXJzID0gb3B0cy5jaXBoZXJzO1xuXHQgIHRoaXMucmVqZWN0VW5hdXRob3JpemVkID0gb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cblx0ICB0aGlzLmNyZWF0ZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1peCBpbiBgRW1pdHRlcmAuXG5cdCAqL1xuXG5cdEVtaXR0ZXIoUmVxdWVzdC5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIHRoZSBYSFIgb2JqZWN0IGFuZCBzZW5kcyB0aGUgcmVxdWVzdC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgb3B0cyA9IHsgYWdlbnQ6IHRoaXMuYWdlbnQsIHhkb21haW46IHRoaXMueGQsIHhzY2hlbWU6IHRoaXMueHMsIGVuYWJsZXNYRFI6IHRoaXMuZW5hYmxlc1hEUiB9O1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgb3B0cy5wZnggPSB0aGlzLnBmeDtcblx0ICBvcHRzLmtleSA9IHRoaXMua2V5O1xuXHQgIG9wdHMucGFzc3BocmFzZSA9IHRoaXMucGFzc3BocmFzZTtcblx0ICBvcHRzLmNlcnQgPSB0aGlzLmNlcnQ7XG5cdCAgb3B0cy5jYSA9IHRoaXMuY2E7XG5cdCAgb3B0cy5jaXBoZXJzID0gdGhpcy5jaXBoZXJzO1xuXHQgIG9wdHMucmVqZWN0VW5hdXRob3JpemVkID0gdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cblx0ICB2YXIgeGhyID0gdGhpcy54aHIgPSBuZXcgcmVxdWlyZSQkMShvcHRzKTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICB0cnkge1xuXHQgICAgZGVidWckNCgneGhyIG9wZW4gJXM6ICVzJywgdGhpcy5tZXRob2QsIHRoaXMudXJpKTtcblx0ICAgIHhoci5vcGVuKHRoaXMubWV0aG9kLCB0aGlzLnVyaSwgdGhpcy5hc3luYyk7XG5cdCAgICB0cnkge1xuXHQgICAgICBpZiAodGhpcy5leHRyYUhlYWRlcnMpIHtcblx0ICAgICAgICB4aHIuc2V0RGlzYWJsZUhlYWRlckNoZWNrICYmIHhoci5zZXREaXNhYmxlSGVhZGVyQ2hlY2sodHJ1ZSk7XG5cdCAgICAgICAgZm9yICh2YXIgaSBpbiB0aGlzLmV4dHJhSGVhZGVycykge1xuXHQgICAgICAgICAgaWYgKHRoaXMuZXh0cmFIZWFkZXJzLmhhc093blByb3BlcnR5KGkpKSB7XG5cdCAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGksIHRoaXMuZXh0cmFIZWFkZXJzW2ldKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICAgIGlmICgnUE9TVCcgPT09IHRoaXMubWV0aG9kKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgaWYgKHRoaXMuaXNCaW5hcnkpIHtcblx0ICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LXR5cGUnLCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LXR5cGUnLCAndGV4dC9wbGFpbjtjaGFyc2V0PVVURi04Jyk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9IGNhdGNoIChlKSB7fVxuXHQgICAgfVxuXG5cdCAgICB0cnkge1xuXHQgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJyovKicpO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblxuXHQgICAgLy8gaWU2IGNoZWNrXG5cdCAgICBpZiAoJ3dpdGhDcmVkZW50aWFscycgaW4geGhyKSB7XG5cdCAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGhpcy5yZXF1ZXN0VGltZW91dCkge1xuXHQgICAgICB4aHIudGltZW91dCA9IHRoaXMucmVxdWVzdFRpbWVvdXQ7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLmhhc1hEUigpKSB7XG5cdCAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgc2VsZi5vbkxvYWQoKTtcblx0ICAgICAgfTtcblx0ICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgc2VsZi5vbkVycm9yKHhoci5yZXNwb25zZVRleHQpO1xuXHQgICAgICB9O1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDIpIHtcblx0ICAgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICAgIHZhciBjb250ZW50VHlwZSA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1UeXBlJyk7XG5cdCAgICAgICAgICAgIGlmIChzZWxmLnN1cHBvcnRzQmluYXJ5ICYmIGNvbnRlbnRUeXBlID09PSAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJykge1xuXHQgICAgICAgICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuXHQgICAgICAgIH1cblx0ICAgICAgICBpZiAoNCAhPT0geGhyLnJlYWR5U3RhdGUpIHJldHVybjtcblx0ICAgICAgICBpZiAoMjAwID09PSB4aHIuc3RhdHVzIHx8IDEyMjMgPT09IHhoci5zdGF0dXMpIHtcblx0ICAgICAgICAgIHNlbGYub25Mb2FkKCk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgYGVycm9yYCBldmVudCBoYW5kbGVyIHRoYXQncyB1c2VyLXNldFxuXHQgICAgICAgICAgLy8gZG9lcyBub3QgdGhyb3cgaW4gdGhlIHNhbWUgdGljayBhbmQgZ2V0cyBjYXVnaHQgaGVyZVxuXHQgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgIHNlbGYub25FcnJvcih4aHIuc3RhdHVzKTtcblx0ICAgICAgICAgIH0sIDApO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblx0ICAgIH1cblxuXHQgICAgZGVidWckNCgneGhyIGRhdGEgJXMnLCB0aGlzLmRhdGEpO1xuXHQgICAgeGhyLnNlbmQodGhpcy5kYXRhKTtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICAvLyBOZWVkIHRvIGRlZmVyIHNpbmNlIC5jcmVhdGUoKSBpcyBjYWxsZWQgZGlyZWN0bHkgZmhyb20gdGhlIGNvbnN0cnVjdG9yXG5cdCAgICAvLyBhbmQgdGh1cyB0aGUgJ2Vycm9yJyBldmVudCBjYW4gb25seSBiZSBvbmx5IGJvdW5kICphZnRlciogdGhpcyBleGNlcHRpb25cblx0ICAgIC8vIG9jY3Vycy4gIFRoZXJlZm9yZSwgYWxzbywgd2UgY2Fubm90IHRocm93IGhlcmUgYXQgYWxsLlxuXHQgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHNlbGYub25FcnJvcihlKTtcblx0ICAgIH0sIDApO1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5kb2N1bWVudCkge1xuXHQgICAgdGhpcy5pbmRleCA9IFJlcXVlc3QucmVxdWVzdHNDb3VudCsrO1xuXHQgICAgUmVxdWVzdC5yZXF1ZXN0c1t0aGlzLmluZGV4XSA9IHRoaXM7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBzdWNjZXNzZnVsIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUub25TdWNjZXNzID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuZW1pdCgnc3VjY2VzcycpO1xuXHQgIHRoaXMuY2xlYW51cCgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgaWYgd2UgaGF2ZSBkYXRhLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB0aGlzLmVtaXQoJ2RhdGEnLCBkYXRhKTtcblx0ICB0aGlzLm9uU3VjY2VzcygpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBlcnJvci5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG5cdCAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG5cdCAgdGhpcy5jbGVhbnVwKHRydWUpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbGVhbnMgdXAgaG91c2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5jbGVhbnVwID0gZnVuY3Rpb24gKGZyb21FcnJvcikge1xuXHQgIGlmICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRoaXMueGhyIHx8IG51bGwgPT09IHRoaXMueGhyKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXHQgIC8vIHhtbGh0dHByZXF1ZXN0XG5cdCAgaWYgKHRoaXMuaGFzWERSKCkpIHtcblx0ICAgIHRoaXMueGhyLm9ubG9hZCA9IHRoaXMueGhyLm9uZXJyb3IgPSBlbXB0eTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhpcy54aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZW1wdHk7XG5cdCAgfVxuXG5cdCAgaWYgKGZyb21FcnJvcikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgdGhpcy54aHIuYWJvcnQoKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgfVxuXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmRvY3VtZW50KSB7XG5cdCAgICBkZWxldGUgUmVxdWVzdC5yZXF1ZXN0c1t0aGlzLmluZGV4XTtcblx0ICB9XG5cblx0ICB0aGlzLnhociA9IG51bGw7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGxvYWQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vbkxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIGRhdGE7XG5cdCAgdHJ5IHtcblx0ICAgIHZhciBjb250ZW50VHlwZTtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGNvbnRlbnRUeXBlID0gdGhpcy54aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NvbnRlbnQtVHlwZScpO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICAgIGlmIChjb250ZW50VHlwZSA9PT0gJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpIHtcblx0ICAgICAgZGF0YSA9IHRoaXMueGhyLnJlc3BvbnNlIHx8IHRoaXMueGhyLnJlc3BvbnNlVGV4dDtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGRhdGEgPSB0aGlzLnhoci5yZXNwb25zZVRleHQ7XG5cdCAgICB9XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgdGhpcy5vbkVycm9yKGUpO1xuXHQgIH1cblx0ICBpZiAobnVsbCAhPSBkYXRhKSB7XG5cdCAgICB0aGlzLm9uRGF0YShkYXRhKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIGl0IGhhcyBYRG9tYWluUmVxdWVzdC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLmhhc1hEUiA9IGZ1bmN0aW9uICgpIHtcblx0ICByZXR1cm4gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBjb21tb25qc0dsb2JhbC5YRG9tYWluUmVxdWVzdCAmJiAhdGhpcy54cyAmJiB0aGlzLmVuYWJsZXNYRFI7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFib3J0cyB0aGUgcmVxdWVzdC5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFib3J0cyBwZW5kaW5nIHJlcXVlc3RzIHdoZW4gdW5sb2FkaW5nIHRoZSB3aW5kb3cuIFRoaXMgaXMgbmVlZGVkIHRvIHByZXZlbnRcblx0ICogbWVtb3J5IGxlYWtzIChlLmcuIHdoZW4gdXNpbmcgSUUpIGFuZCB0byBlbnN1cmUgdGhhdCBubyBzcHVyaW91cyBlcnJvciBpc1xuXHQgKiBlbWl0dGVkLlxuXHQgKi9cblxuXHRSZXF1ZXN0LnJlcXVlc3RzQ291bnQgPSAwO1xuXHRSZXF1ZXN0LnJlcXVlc3RzID0ge307XG5cblx0aWYgKGNvbW1vbmpzR2xvYmFsLmRvY3VtZW50KSB7XG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmF0dGFjaEV2ZW50KSB7XG5cdCAgICBjb21tb25qc0dsb2JhbC5hdHRhY2hFdmVudCgnb251bmxvYWQnLCB1bmxvYWRIYW5kbGVyKTtcblx0ICB9IGVsc2UgaWYgKGNvbW1vbmpzR2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcblx0ICAgIGNvbW1vbmpzR2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIHVubG9hZEhhbmRsZXIsIGZhbHNlKTtcblx0ICB9XG5cdH1cblxuXHRmdW5jdGlvbiB1bmxvYWRIYW5kbGVyKCkge1xuXHQgIGZvciAodmFyIGkgaW4gUmVxdWVzdC5yZXF1ZXN0cykge1xuXHQgICAgaWYgKFJlcXVlc3QucmVxdWVzdHMuaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgUmVxdWVzdC5yZXF1ZXN0c1tpXS5hYm9ydCgpO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXHRwb2xsaW5nWGhyLlJlcXVlc3QgPSBSZXF1ZXN0XzE7XG5cblx0dmFyIHBvbGxpbmdYaHIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBwb2xsaW5nWGhyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogcG9sbGluZ1hocixcblx0XHRSZXF1ZXN0OiBSZXF1ZXN0XzFcblx0fSk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSByZXF1aXJlbWVudHMuXG5cdCAqL1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmdKc29ucCA9IEpTT05QUG9sbGluZztcblxuXHQvKipcblx0ICogQ2FjaGVkIHJlZ3VsYXIgZXhwcmVzc2lvbnMuXG5cdCAqL1xuXG5cdHZhciByTmV3bGluZSA9IC9cXG4vZztcblx0dmFyIHJFc2NhcGVkTmV3bGluZSA9IC9cXFxcbi9nO1xuXG5cdC8qKlxuXHQgKiBHbG9iYWwgSlNPTlAgY2FsbGJhY2tzLlxuXHQgKi9cblxuXHR2YXIgY2FsbGJhY2tzO1xuXG5cdC8qKlxuXHQgKiBOb29wLlxuXHQgKi9cblxuXHRmdW5jdGlvbiBlbXB0eSQxKCkge31cblxuXHQvKipcblx0ICogSlNPTlAgUG9sbGluZyBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdHMuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIEpTT05QUG9sbGluZyhvcHRzKSB7XG5cdCAgUG9sbGluZyQxLmNhbGwodGhpcywgb3B0cyk7XG5cblx0ICB0aGlzLnF1ZXJ5ID0gdGhpcy5xdWVyeSB8fCB7fTtcblxuXHQgIC8vIGRlZmluZSBnbG9iYWwgY2FsbGJhY2tzIGFycmF5IGlmIG5vdCBwcmVzZW50XG5cdCAgLy8gd2UgZG8gdGhpcyBoZXJlIChsYXppbHkpIHRvIGF2b2lkIHVubmVlZGVkIGdsb2JhbCBwb2xsdXRpb25cblx0ICBpZiAoIWNhbGxiYWNrcykge1xuXHQgICAgLy8gd2UgbmVlZCB0byBjb25zaWRlciBtdWx0aXBsZSBlbmdpbmVzIGluIHRoZSBzYW1lIHBhZ2Vcblx0ICAgIGlmICghY29tbW9uanNHbG9iYWwuX19fZWlvKSBjb21tb25qc0dsb2JhbC5fX19laW8gPSBbXTtcblx0ICAgIGNhbGxiYWNrcyA9IGNvbW1vbmpzR2xvYmFsLl9fX2Vpbztcblx0ICB9XG5cblx0ICAvLyBjYWxsYmFjayBpZGVudGlmaWVyXG5cdCAgdGhpcy5pbmRleCA9IGNhbGxiYWNrcy5sZW5ndGg7XG5cblx0ICAvLyBhZGQgY2FsbGJhY2sgdG8ganNvbnAgZ2xvYmFsXG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIGNhbGxiYWNrcy5wdXNoKGZ1bmN0aW9uIChtc2cpIHtcblx0ICAgIHNlbGYub25EYXRhKG1zZyk7XG5cdCAgfSk7XG5cblx0ICAvLyBhcHBlbmQgdG8gcXVlcnkgc3RyaW5nXG5cdCAgdGhpcy5xdWVyeS5qID0gdGhpcy5pbmRleDtcblxuXHQgIC8vIHByZXZlbnQgc3B1cmlvdXMgZXJyb3JzIGZyb20gYmVpbmcgZW1pdHRlZCB3aGVuIHRoZSB3aW5kb3cgaXMgdW5sb2FkZWRcblx0ICBpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQgJiYgY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHQgICAgY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgZnVuY3Rpb24gKCkge1xuXHQgICAgICBpZiAoc2VsZi5zY3JpcHQpIHNlbGYuc2NyaXB0Lm9uZXJyb3IgPSBlbXB0eSQxO1xuXHQgICAgfSwgZmFsc2UpO1xuXHQgIH1cblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0cyBmcm9tIFBvbGxpbmcuXG5cdCAqL1xuXG5cdGluaGVyaXQoSlNPTlBQb2xsaW5nLCBQb2xsaW5nJDEpO1xuXG5cdC8qXG5cdCAqIEpTT05QIG9ubHkgc3VwcG9ydHMgYmluYXJ5IGFzIGJhc2U2NCBlbmNvZGVkIHN0cmluZ3Ncblx0ICovXG5cblx0SlNPTlBQb2xsaW5nLnByb3RvdHlwZS5zdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBDbG9zZXMgdGhlIHNvY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdEpTT05QUG9sbGluZy5wcm90b3R5cGUuZG9DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodGhpcy5zY3JpcHQpIHtcblx0ICAgIHRoaXMuc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5zY3JpcHQpO1xuXHQgICAgdGhpcy5zY3JpcHQgPSBudWxsO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLmZvcm0pIHtcblx0ICAgIHRoaXMuZm9ybS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuZm9ybSk7XG5cdCAgICB0aGlzLmZvcm0gPSBudWxsO1xuXHQgICAgdGhpcy5pZnJhbWUgPSBudWxsO1xuXHQgIH1cblxuXHQgIFBvbGxpbmckMS5wcm90b3R5cGUuZG9DbG9zZS5jYWxsKHRoaXMpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgYSBwb2xsIGN5Y2xlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0SlNPTlBQb2xsaW5nLnByb3RvdHlwZS5kb1BvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcblxuXHQgIGlmICh0aGlzLnNjcmlwdCkge1xuXHQgICAgdGhpcy5zY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLnNjcmlwdCk7XG5cdCAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cdCAgfVxuXG5cdCAgc2NyaXB0LmFzeW5jID0gdHJ1ZTtcblx0ICBzY3JpcHQuc3JjID0gdGhpcy51cmkoKTtcblx0ICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoJ2pzb25wIHBvbGwgZXJyb3InLCBlKTtcblx0ICB9O1xuXG5cdCAgdmFyIGluc2VydEF0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdO1xuXHQgIGlmIChpbnNlcnRBdCkge1xuXHQgICAgaW5zZXJ0QXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoc2NyaXB0LCBpbnNlcnRBdCk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmJvZHkpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG5cdCAgfVxuXHQgIHRoaXMuc2NyaXB0ID0gc2NyaXB0O1xuXG5cdCAgdmFyIGlzVUFnZWNrbyA9ICd1bmRlZmluZWQnICE9PSB0eXBlb2YgbmF2aWdhdG9yICYmIC9nZWNrby9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cblx0ICBpZiAoaXNVQWdlY2tvKSB7XG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuXHQgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG5cdCAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcblx0ICAgIH0sIDEwMCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBXcml0ZXMgd2l0aCBhIGhpZGRlbiBpZnJhbWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhIHRvIHNlbmRcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGVkIHVwb24gZmx1c2guXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLmRvV3JpdGUgPSBmdW5jdGlvbiAoZGF0YSwgZm4pIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBpZiAoIXRoaXMuZm9ybSkge1xuXHQgICAgdmFyIGZvcm0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdmb3JtJyk7XG5cdCAgICB2YXIgYXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG5cdCAgICB2YXIgaWQgPSB0aGlzLmlmcmFtZUlkID0gJ2Vpb19pZnJhbWVfJyArIHRoaXMuaW5kZXg7XG5cdCAgICB2YXIgaWZyYW1lO1xuXG5cdCAgICBmb3JtLmNsYXNzTmFtZSA9ICdzb2NrZXRpbyc7XG5cdCAgICBmb3JtLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0ICAgIGZvcm0uc3R5bGUudG9wID0gJy0xMDAwcHgnO1xuXHQgICAgZm9ybS5zdHlsZS5sZWZ0ID0gJy0xMDAwcHgnO1xuXHQgICAgZm9ybS50YXJnZXQgPSBpZDtcblx0ICAgIGZvcm0ubWV0aG9kID0gJ1BPU1QnO1xuXHQgICAgZm9ybS5zZXRBdHRyaWJ1dGUoJ2FjY2VwdC1jaGFyc2V0JywgJ3V0Zi04Jyk7XG5cdCAgICBhcmVhLm5hbWUgPSAnZCc7XG5cdCAgICBmb3JtLmFwcGVuZENoaWxkKGFyZWEpO1xuXHQgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChmb3JtKTtcblxuXHQgICAgdGhpcy5mb3JtID0gZm9ybTtcblx0ICAgIHRoaXMuYXJlYSA9IGFyZWE7XG5cdCAgfVxuXG5cdCAgdGhpcy5mb3JtLmFjdGlvbiA9IHRoaXMudXJpKCk7XG5cblx0ICBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcblx0ICAgIGluaXRJZnJhbWUoKTtcblx0ICAgIGZuKCk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gaW5pdElmcmFtZSgpIHtcblx0ICAgIGlmIChzZWxmLmlmcmFtZSkge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIHNlbGYuZm9ybS5yZW1vdmVDaGlsZChzZWxmLmlmcmFtZSk7XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICBzZWxmLm9uRXJyb3IoJ2pzb25wIHBvbGxpbmcgaWZyYW1lIHJlbW92YWwgZXJyb3InLCBlKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB0cnkge1xuXHQgICAgICAvLyBpZTYgZHluYW1pYyBpZnJhbWVzIHdpdGggdGFyZ2V0PVwiXCIgc3VwcG9ydCAodGhhbmtzIENocmlzIExhbWJhY2hlcilcblx0ICAgICAgdmFyIGh0bWwgPSAnPGlmcmFtZSBzcmM9XCJqYXZhc2NyaXB0OjBcIiBuYW1lPVwiJyArIHNlbGYuaWZyYW1lSWQgKyAnXCI+Jztcblx0ICAgICAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChodG1sKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG5cdCAgICAgIGlmcmFtZS5uYW1lID0gc2VsZi5pZnJhbWVJZDtcblx0ICAgICAgaWZyYW1lLnNyYyA9ICdqYXZhc2NyaXB0OjAnO1xuXHQgICAgfVxuXG5cdCAgICBpZnJhbWUuaWQgPSBzZWxmLmlmcmFtZUlkO1xuXG5cdCAgICBzZWxmLmZvcm0uYXBwZW5kQ2hpbGQoaWZyYW1lKTtcblx0ICAgIHNlbGYuaWZyYW1lID0gaWZyYW1lO1xuXHQgIH1cblxuXHQgIGluaXRJZnJhbWUoKTtcblxuXHQgIC8vIGVzY2FwZSBcXG4gdG8gcHJldmVudCBpdCBmcm9tIGJlaW5nIGNvbnZlcnRlZCBpbnRvIFxcclxcbiBieSBzb21lIFVBc1xuXHQgIC8vIGRvdWJsZSBlc2NhcGluZyBpcyByZXF1aXJlZCBmb3IgZXNjYXBlZCBuZXcgbGluZXMgYmVjYXVzZSB1bmVzY2FwaW5nIG9mIG5ldyBsaW5lcyBjYW4gYmUgZG9uZSBzYWZlbHkgb24gc2VydmVyLXNpZGVcblx0ICBkYXRhID0gZGF0YS5yZXBsYWNlKHJFc2NhcGVkTmV3bGluZSwgJ1xcXFxcXG4nKTtcblx0ICB0aGlzLmFyZWEudmFsdWUgPSBkYXRhLnJlcGxhY2Uock5ld2xpbmUsICdcXFxcbicpO1xuXG5cdCAgdHJ5IHtcblx0ICAgIHRoaXMuZm9ybS5zdWJtaXQoKTtcblx0ICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgaWYgKHRoaXMuaWZyYW1lLmF0dGFjaEV2ZW50KSB7XG5cdCAgICB0aGlzLmlmcmFtZS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmIChzZWxmLmlmcmFtZS5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnKSB7XG5cdCAgICAgICAgY29tcGxldGUoKTtcblx0ICAgICAgfVxuXHQgICAgfTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhpcy5pZnJhbWUub25sb2FkID0gY29tcGxldGU7XG5cdCAgfVxuXHR9O1xuXG5cdHZhciBwb2xsaW5nSnNvbnAkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBwb2xsaW5nSnNvbnAsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwb2xsaW5nSnNvbnBcblx0fSk7XG5cblx0dmFyIGVtcHR5JDIgPSB7fTtcblxuXHR2YXIgZW1wdHkkMyA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBlbXB0eSQyXG5cdH0pO1xuXG5cdHZhciByZXF1aXJlJCQxJDEgPSAoIGVtcHR5JDMgJiYgZW1wdHkkMiApIHx8IGVtcHR5JDM7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQ1ID0gcmVxdWlyZSQkMCQyKCdlbmdpbmUuaW8tY2xpZW50OndlYnNvY2tldCcpO1xuXHR2YXIgQnJvd3NlcldlYlNvY2tldCA9IGNvbW1vbmpzR2xvYmFsLldlYlNvY2tldCB8fCBjb21tb25qc0dsb2JhbC5Nb3pXZWJTb2NrZXQ7XG5cdHZhciBOb2RlV2ViU29ja2V0O1xuXHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0ICB0cnkge1xuXHQgICAgTm9kZVdlYlNvY2tldCA9IHJlcXVpcmUkJDEkMTtcblx0ICB9IGNhdGNoIChlKSB7fVxuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBlaXRoZXIgdGhlIGBXZWJTb2NrZXRgIG9yIGBNb3pXZWJTb2NrZXRgIGdsb2JhbHNcblx0ICogaW4gdGhlIGJyb3dzZXIgb3IgdHJ5IHRvIHJlc29sdmUgV2ViU29ja2V0LWNvbXBhdGlibGVcblx0ICogaW50ZXJmYWNlIGV4cG9zZWQgYnkgYHdzYCBmb3IgTm9kZS1saWtlIGVudmlyb25tZW50LlxuXHQgKi9cblxuXHR2YXIgV2ViU29ja2V0ID0gQnJvd3NlcldlYlNvY2tldDtcblx0aWYgKCFXZWJTb2NrZXQgJiYgdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0ICBXZWJTb2NrZXQgPSBOb2RlV2ViU29ja2V0O1xuXHR9XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgd2Vic29ja2V0ID0gV1M7XG5cblx0LyoqXG5cdCAqIFdlYlNvY2tldCB0cmFuc3BvcnQgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBhcGkge09iamVjdH0gY29ubmVjdGlvbiBvcHRpb25zXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFdTKG9wdHMpIHtcblx0ICB2YXIgZm9yY2VCYXNlNjQgPSBvcHRzICYmIG9wdHMuZm9yY2VCYXNlNjQ7XG5cdCAgaWYgKGZvcmNlQmFzZTY0KSB7XG5cdCAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cdCAgfVxuXHQgIHRoaXMucGVyTWVzc2FnZURlZmxhdGUgPSBvcHRzLnBlck1lc3NhZ2VEZWZsYXRlO1xuXHQgIHRoaXMudXNpbmdCcm93c2VyV2ViU29ja2V0ID0gQnJvd3NlcldlYlNvY2tldCAmJiAhb3B0cy5mb3JjZU5vZGU7XG5cdCAgdGhpcy5wcm90b2NvbHMgPSBvcHRzLnByb3RvY29scztcblx0ICBpZiAoIXRoaXMudXNpbmdCcm93c2VyV2ViU29ja2V0KSB7XG5cdCAgICBXZWJTb2NrZXQgPSBOb2RlV2ViU29ja2V0O1xuXHQgIH1cblx0ICBUcmFuc3BvcnQkMS5jYWxsKHRoaXMsIG9wdHMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaGVyaXRzIGZyb20gVHJhbnNwb3J0LlxuXHQgKi9cblxuXHRpbmhlcml0KFdTLCBUcmFuc3BvcnQkMSk7XG5cblx0LyoqXG5cdCAqIFRyYW5zcG9ydCBuYW1lLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUubmFtZSA9ICd3ZWJzb2NrZXQnO1xuXG5cdC8qXG5cdCAqIFdlYlNvY2tldHMgc3VwcG9ydCBiaW5hcnlcblx0ICovXG5cblx0V1MucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5ID0gdHJ1ZTtcblxuXHQvKipcblx0ICogT3BlbnMgc29ja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLmRvT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoIXRoaXMuY2hlY2soKSkge1xuXHQgICAgLy8gbGV0IHByb2JlIHRpbWVvdXRcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB2YXIgdXJpID0gdGhpcy51cmkoKTtcblx0ICB2YXIgcHJvdG9jb2xzID0gdGhpcy5wcm90b2NvbHM7XG5cdCAgdmFyIG9wdHMgPSB7XG5cdCAgICBhZ2VudDogdGhpcy5hZ2VudCxcblx0ICAgIHBlck1lc3NhZ2VEZWZsYXRlOiB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlXG5cdCAgfTtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIG9wdHMucGZ4ID0gdGhpcy5wZng7XG5cdCAgb3B0cy5rZXkgPSB0aGlzLmtleTtcblx0ICBvcHRzLnBhc3NwaHJhc2UgPSB0aGlzLnBhc3NwaHJhc2U7XG5cdCAgb3B0cy5jZXJ0ID0gdGhpcy5jZXJ0O1xuXHQgIG9wdHMuY2EgPSB0aGlzLmNhO1xuXHQgIG9wdHMuY2lwaGVycyA9IHRoaXMuY2lwaGVycztcblx0ICBvcHRzLnJlamVjdFVuYXV0aG9yaXplZCA9IHRoaXMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIGlmICh0aGlzLmV4dHJhSGVhZGVycykge1xuXHQgICAgb3B0cy5oZWFkZXJzID0gdGhpcy5leHRyYUhlYWRlcnM7XG5cdCAgfVxuXHQgIGlmICh0aGlzLmxvY2FsQWRkcmVzcykge1xuXHQgICAgb3B0cy5sb2NhbEFkZHJlc3MgPSB0aGlzLmxvY2FsQWRkcmVzcztcblx0ICB9XG5cblx0ICB0cnkge1xuXHQgICAgdGhpcy53cyA9IHRoaXMudXNpbmdCcm93c2VyV2ViU29ja2V0ID8gcHJvdG9jb2xzID8gbmV3IFdlYlNvY2tldCh1cmksIHByb3RvY29scykgOiBuZXcgV2ViU29ja2V0KHVyaSkgOiBuZXcgV2ViU29ja2V0KHVyaSwgcHJvdG9jb2xzLCBvcHRzKTtcblx0ICB9IGNhdGNoIChlcnIpIHtcblx0ICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICB9XG5cblx0ICBpZiAodGhpcy53cy5iaW5hcnlUeXBlID09PSB1bmRlZmluZWQpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICB9XG5cblx0ICBpZiAodGhpcy53cy5zdXBwb3J0cyAmJiB0aGlzLndzLnN1cHBvcnRzLmJpbmFyeSkge1xuXHQgICAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IHRydWU7XG5cdCAgICB0aGlzLndzLmJpbmFyeVR5cGUgPSAnbm9kZWJ1ZmZlcic7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRoaXMud3MuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgfVxuXG5cdCAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBBZGRzIGV2ZW50IGxpc3RlbmVycyB0byB0aGUgc29ja2V0XG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcnMgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgdGhpcy53cy5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uT3BlbigpO1xuXHQgIH07XG5cdCAgdGhpcy53cy5vbmNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbkNsb3NlKCk7XG5cdCAgfTtcblx0ICB0aGlzLndzLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChldikge1xuXHQgICAgc2VsZi5vbkRhdGEoZXYuZGF0YSk7XG5cdCAgfTtcblx0ICB0aGlzLndzLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgc2VsZi5vbkVycm9yKCd3ZWJzb2NrZXQgZXJyb3InLCBlKTtcblx0ICB9O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBXcml0ZXMgZGF0YSB0byBzb2NrZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IG9mIHBhY2tldHMuXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAocGFja2V0cykge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cblx0ICAvLyBlbmNvZGVQYWNrZXQgZWZmaWNpZW50IGFzIGl0IHVzZXMgV1MgZnJhbWluZ1xuXHQgIC8vIG5vIG5lZWQgZm9yIGVuY29kZVBheWxvYWRcblx0ICB2YXIgdG90YWwgPSBwYWNrZXRzLmxlbmd0aDtcblx0ICBmb3IgKHZhciBpID0gMCwgbCA9IHRvdGFsOyBpIDwgbDsgaSsrKSB7XG5cdCAgICAoZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgICBwYXJzZXIuZW5jb2RlUGFja2V0KHBhY2tldCwgc2VsZi5zdXBwb3J0c0JpbmFyeSwgZnVuY3Rpb24gKGRhdGEpIHtcblx0ICAgICAgICBpZiAoIXNlbGYudXNpbmdCcm93c2VyV2ViU29ja2V0KSB7XG5cdCAgICAgICAgICAvLyBhbHdheXMgY3JlYXRlIGEgbmV3IG9iamVjdCAoR0gtNDM3KVxuXHQgICAgICAgICAgdmFyIG9wdHMgPSB7fTtcblx0ICAgICAgICAgIGlmIChwYWNrZXQub3B0aW9ucykge1xuXHQgICAgICAgICAgICBvcHRzLmNvbXByZXNzID0gcGFja2V0Lm9wdGlvbnMuY29tcHJlc3M7XG5cdCAgICAgICAgICB9XG5cblx0ICAgICAgICAgIGlmIChzZWxmLnBlck1lc3NhZ2VEZWZsYXRlKSB7XG5cdCAgICAgICAgICAgIHZhciBsZW4gPSAnc3RyaW5nJyA9PT0gdHlwZW9mIGRhdGEgPyBjb21tb25qc0dsb2JhbC5CdWZmZXIuYnl0ZUxlbmd0aChkYXRhKSA6IGRhdGEubGVuZ3RoO1xuXHQgICAgICAgICAgICBpZiAobGVuIDwgc2VsZi5wZXJNZXNzYWdlRGVmbGF0ZS50aHJlc2hvbGQpIHtcblx0ICAgICAgICAgICAgICBvcHRzLmNvbXByZXNzID0gZmFsc2U7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cblx0ICAgICAgICAvLyBTb21ldGltZXMgdGhlIHdlYnNvY2tldCBoYXMgYWxyZWFkeSBiZWVuIGNsb3NlZCBidXQgdGhlIGJyb3dzZXIgZGlkbid0XG5cdCAgICAgICAgLy8gaGF2ZSBhIGNoYW5jZSBvZiBpbmZvcm1pbmcgdXMgYWJvdXQgaXQgeWV0LCBpbiB0aGF0IGNhc2Ugc2VuZCB3aWxsXG5cdCAgICAgICAgLy8gdGhyb3cgYW4gZXJyb3Jcblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgaWYgKHNlbGYudXNpbmdCcm93c2VyV2ViU29ja2V0KSB7XG5cdCAgICAgICAgICAgIC8vIFR5cGVFcnJvciBpcyB0aHJvd24gd2hlbiBwYXNzaW5nIHRoZSBzZWNvbmQgYXJndW1lbnQgb24gU2FmYXJpXG5cdCAgICAgICAgICAgIHNlbGYud3Muc2VuZChkYXRhKTtcblx0ICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgIHNlbGYud3Muc2VuZChkYXRhLCBvcHRzKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgICBkZWJ1ZyQ1KCd3ZWJzb2NrZXQgY2xvc2VkIGJlZm9yZSBvbmNsb3NlIGV2ZW50Jyk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgLS10b3RhbCB8fCBkb25lKCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfSkocGFja2V0c1tpXSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZG9uZSgpIHtcblx0ICAgIHNlbGYuZW1pdCgnZmx1c2gnKTtcblxuXHQgICAgLy8gZmFrZSBkcmFpblxuXHQgICAgLy8gZGVmZXIgdG8gbmV4dCB0aWNrIHRvIGFsbG93IFNvY2tldCB0byBjbGVhciB3cml0ZUJ1ZmZlclxuXHQgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHNlbGYud3JpdGFibGUgPSB0cnVlO1xuXHQgICAgICBzZWxmLmVtaXQoJ2RyYWluJyk7XG5cdCAgICB9LCAwKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGNsb3NlXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBUcmFuc3BvcnQkMS5wcm90b3R5cGUub25DbG9zZS5jYWxsKHRoaXMpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbG9zZXMgc29ja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLmRvQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHR5cGVvZiB0aGlzLndzICE9PSAndW5kZWZpbmVkJykge1xuXHQgICAgdGhpcy53cy5jbG9zZSgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogR2VuZXJhdGVzIHVyaSBmb3IgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS51cmkgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyeSB8fCB7fTtcblx0ICB2YXIgc2NoZW1hID0gdGhpcy5zZWN1cmUgPyAnd3NzJyA6ICd3cyc7XG5cdCAgdmFyIHBvcnQgPSAnJztcblxuXHQgIC8vIGF2b2lkIHBvcnQgaWYgZGVmYXVsdCBmb3Igc2NoZW1hXG5cdCAgaWYgKHRoaXMucG9ydCAmJiAoJ3dzcycgPT09IHNjaGVtYSAmJiBOdW1iZXIodGhpcy5wb3J0KSAhPT0gNDQzIHx8ICd3cycgPT09IHNjaGVtYSAmJiBOdW1iZXIodGhpcy5wb3J0KSAhPT0gODApKSB7XG5cdCAgICBwb3J0ID0gJzonICsgdGhpcy5wb3J0O1xuXHQgIH1cblxuXHQgIC8vIGFwcGVuZCB0aW1lc3RhbXAgdG8gVVJJXG5cdCAgaWYgKHRoaXMudGltZXN0YW1wUmVxdWVzdHMpIHtcblx0ICAgIHF1ZXJ5W3RoaXMudGltZXN0YW1wUGFyYW1dID0geWVhc3QkMigpO1xuXHQgIH1cblxuXHQgIC8vIGNvbW11bmljYXRlIGJpbmFyeSBzdXBwb3J0IGNhcGFiaWxpdGllc1xuXHQgIGlmICghdGhpcy5zdXBwb3J0c0JpbmFyeSkge1xuXHQgICAgcXVlcnkuYjY0ID0gMTtcblx0ICB9XG5cblx0ICBxdWVyeSA9IHBhcnNlcXMkMi5lbmNvZGUocXVlcnkpO1xuXG5cdCAgLy8gcHJlcGVuZCA/IHRvIHF1ZXJ5XG5cdCAgaWYgKHF1ZXJ5Lmxlbmd0aCkge1xuXHQgICAgcXVlcnkgPSAnPycgKyBxdWVyeTtcblx0ICB9XG5cblx0ICB2YXIgaXB2NiA9IHRoaXMuaG9zdG5hbWUuaW5kZXhPZignOicpICE9PSAtMTtcblx0ICByZXR1cm4gc2NoZW1hICsgJzovLycgKyAoaXB2NiA/ICdbJyArIHRoaXMuaG9zdG5hbWUgKyAnXScgOiB0aGlzLmhvc3RuYW1lKSArIHBvcnQgKyB0aGlzLnBhdGggKyBxdWVyeTtcblx0fTtcblxuXHQvKipcblx0ICogRmVhdHVyZSBkZXRlY3Rpb24gZm9yIFdlYlNvY2tldC5cblx0ICpcblx0ICogQHJldHVybiB7Qm9vbGVhbn0gd2hldGhlciB0aGlzIHRyYW5zcG9ydCBpcyBhdmFpbGFibGUuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5jaGVjayA9IGZ1bmN0aW9uICgpIHtcblx0ICByZXR1cm4gISFXZWJTb2NrZXQgJiYgISgnX19pbml0aWFsaXplJyBpbiBXZWJTb2NrZXQgJiYgdGhpcy5uYW1lID09PSBXUy5wcm90b3R5cGUubmFtZSk7XG5cdH07XG5cblx0dmFyIHdlYnNvY2tldCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHdlYnNvY2tldCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHdlYnNvY2tldFxuXHR9KTtcblxuXHR2YXIgWEhSJDEgPSAoIHBvbGxpbmdYaHIkMSAmJiBwb2xsaW5nWGhyICkgfHwgcG9sbGluZ1hociQxO1xuXG5cdHZhciBKU09OUCA9ICggcG9sbGluZ0pzb25wJDEgJiYgcG9sbGluZ0pzb25wICkgfHwgcG9sbGluZ0pzb25wJDE7XG5cblx0dmFyIHdlYnNvY2tldCQyID0gKCB3ZWJzb2NrZXQkMSAmJiB3ZWJzb2NrZXQgKSB8fCB3ZWJzb2NrZXQkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llc1xuXHQgKi9cblxuXHQvKipcblx0ICogRXhwb3J0IHRyYW5zcG9ydHMuXG5cdCAqL1xuXG5cdHZhciBwb2xsaW5nXzEgPSBwb2xsaW5nJDI7XG5cdHZhciB3ZWJzb2NrZXRfMSA9IHdlYnNvY2tldCQyO1xuXG5cdC8qKlxuXHQgKiBQb2xsaW5nIHRyYW5zcG9ydCBwb2x5bW9ycGhpYyBjb25zdHJ1Y3Rvci5cblx0ICogRGVjaWRlcyBvbiB4aHIgdnMganNvbnAgYmFzZWQgb24gZmVhdHVyZSBkZXRlY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBwb2xsaW5nJDIob3B0cykge1xuXHQgIHZhciB4aHI7XG5cdCAgdmFyIHhkID0gZmFsc2U7XG5cdCAgdmFyIHhzID0gZmFsc2U7XG5cdCAgdmFyIGpzb25wID0gZmFsc2UgIT09IG9wdHMuanNvbnA7XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwubG9jYXRpb24pIHtcblx0ICAgIHZhciBpc1NTTCA9ICdodHRwczonID09PSBsb2NhdGlvbi5wcm90b2NvbDtcblx0ICAgIHZhciBwb3J0ID0gbG9jYXRpb24ucG9ydDtcblxuXHQgICAgLy8gc29tZSB1c2VyIGFnZW50cyBoYXZlIGVtcHR5IGBsb2NhdGlvbi5wb3J0YFxuXHQgICAgaWYgKCFwb3J0KSB7XG5cdCAgICAgIHBvcnQgPSBpc1NTTCA/IDQ0MyA6IDgwO1xuXHQgICAgfVxuXG5cdCAgICB4ZCA9IG9wdHMuaG9zdG5hbWUgIT09IGxvY2F0aW9uLmhvc3RuYW1lIHx8IHBvcnQgIT09IG9wdHMucG9ydDtcblx0ICAgIHhzID0gb3B0cy5zZWN1cmUgIT09IGlzU1NMO1xuXHQgIH1cblxuXHQgIG9wdHMueGRvbWFpbiA9IHhkO1xuXHQgIG9wdHMueHNjaGVtZSA9IHhzO1xuXHQgIHhociA9IG5ldyByZXF1aXJlJCQxKG9wdHMpO1xuXG5cdCAgaWYgKCdvcGVuJyBpbiB4aHIgJiYgIW9wdHMuZm9yY2VKU09OUCkge1xuXHQgICAgcmV0dXJuIG5ldyBYSFIkMShvcHRzKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgaWYgKCFqc29ucCkgdGhyb3cgbmV3IEVycm9yKCdKU09OUCBkaXNhYmxlZCcpO1xuXHQgICAgcmV0dXJuIG5ldyBKU09OUChvcHRzKTtcblx0ICB9XG5cdH1cblxuXHR2YXIgdHJhbnNwb3J0cyA9IHtcblx0ICBwb2xsaW5nOiBwb2xsaW5nXzEsXG5cdCAgd2Vic29ja2V0OiB3ZWJzb2NrZXRfMVxuXHR9O1xuXG5cdHZhciB0cmFuc3BvcnRzJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogdHJhbnNwb3J0cyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHRyYW5zcG9ydHMsXG5cdFx0cG9sbGluZzogcG9sbGluZ18xLFxuXHRcdHdlYnNvY2tldDogd2Vic29ja2V0XzFcblx0fSk7XG5cblx0dmFyIGluZGV4T2YgPSBbXS5pbmRleE9mO1xuXG5cdHZhciBpbmRleG9mID0gZnVuY3Rpb24gaW5kZXhvZihhcnIsIG9iaikge1xuXHQgIGlmIChpbmRleE9mKSByZXR1cm4gYXJyLmluZGV4T2Yob2JqKTtcblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7ICsraSkge1xuXHQgICAgaWYgKGFycltpXSA9PT0gb2JqKSByZXR1cm4gaTtcblx0ICB9XG5cdCAgcmV0dXJuIC0xO1xuXHR9O1xuXG5cdHZhciBpbmRleG9mJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaW5kZXhvZixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGluZGV4b2Zcblx0fSk7XG5cblx0dmFyIHRyYW5zcG9ydHMkMiA9ICggdHJhbnNwb3J0cyQxICYmIHRyYW5zcG9ydHMgKSB8fCB0cmFuc3BvcnRzJDE7XG5cblx0dmFyIGluZGV4ID0gKCBpbmRleG9mJDEgJiYgaW5kZXhvZiApIHx8IGluZGV4b2YkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDYgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6c29ja2V0Jyk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgc29ja2V0ID0gU29ja2V0O1xuXG5cdC8qKlxuXHQgKiBTb2NrZXQgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gdXJpIG9yIG9wdGlvbnNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gU29ja2V0KHVyaSwgb3B0cykge1xuXHQgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2NrZXQpKSByZXR1cm4gbmV3IFNvY2tldCh1cmksIG9wdHMpO1xuXG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cblx0ICBpZiAodXJpICYmICdvYmplY3QnID09PSAodHlwZW9mIHVyaSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodXJpKSkpIHtcblx0ICAgIG9wdHMgPSB1cmk7XG5cdCAgICB1cmkgPSBudWxsO1xuXHQgIH1cblxuXHQgIGlmICh1cmkpIHtcblx0ICAgIHVyaSA9IHBhcnNldXJpJDIodXJpKTtcblx0ICAgIG9wdHMuaG9zdG5hbWUgPSB1cmkuaG9zdDtcblx0ICAgIG9wdHMuc2VjdXJlID0gdXJpLnByb3RvY29sID09PSAnaHR0cHMnIHx8IHVyaS5wcm90b2NvbCA9PT0gJ3dzcyc7XG5cdCAgICBvcHRzLnBvcnQgPSB1cmkucG9ydDtcblx0ICAgIGlmICh1cmkucXVlcnkpIG9wdHMucXVlcnkgPSB1cmkucXVlcnk7XG5cdCAgfSBlbHNlIGlmIChvcHRzLmhvc3QpIHtcblx0ICAgIG9wdHMuaG9zdG5hbWUgPSBwYXJzZXVyaSQyKG9wdHMuaG9zdCkuaG9zdDtcblx0ICB9XG5cblx0ICB0aGlzLnNlY3VyZSA9IG51bGwgIT0gb3B0cy5zZWN1cmUgPyBvcHRzLnNlY3VyZSA6IGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uICYmICdodHRwczonID09PSBsb2NhdGlvbi5wcm90b2NvbDtcblxuXHQgIGlmIChvcHRzLmhvc3RuYW1lICYmICFvcHRzLnBvcnQpIHtcblx0ICAgIC8vIGlmIG5vIHBvcnQgaXMgc3BlY2lmaWVkIG1hbnVhbGx5LCB1c2UgdGhlIHByb3RvY29sIGRlZmF1bHRcblx0ICAgIG9wdHMucG9ydCA9IHRoaXMuc2VjdXJlID8gJzQ0MycgOiAnODAnO1xuXHQgIH1cblxuXHQgIHRoaXMuYWdlbnQgPSBvcHRzLmFnZW50IHx8IGZhbHNlO1xuXHQgIHRoaXMuaG9zdG5hbWUgPSBvcHRzLmhvc3RuYW1lIHx8IChjb21tb25qc0dsb2JhbC5sb2NhdGlvbiA/IGxvY2F0aW9uLmhvc3RuYW1lIDogJ2xvY2FsaG9zdCcpO1xuXHQgIHRoaXMucG9ydCA9IG9wdHMucG9ydCB8fCAoY29tbW9uanNHbG9iYWwubG9jYXRpb24gJiYgbG9jYXRpb24ucG9ydCA/IGxvY2F0aW9uLnBvcnQgOiB0aGlzLnNlY3VyZSA/IDQ0MyA6IDgwKTtcblx0ICB0aGlzLnF1ZXJ5ID0gb3B0cy5xdWVyeSB8fCB7fTtcblx0ICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB0aGlzLnF1ZXJ5KSB0aGlzLnF1ZXJ5ID0gcGFyc2VxcyQyLmRlY29kZSh0aGlzLnF1ZXJ5KTtcblx0ICB0aGlzLnVwZ3JhZGUgPSBmYWxzZSAhPT0gb3B0cy51cGdyYWRlO1xuXHQgIHRoaXMucGF0aCA9IChvcHRzLnBhdGggfHwgJy9lbmdpbmUuaW8nKS5yZXBsYWNlKC9cXC8kLywgJycpICsgJy8nO1xuXHQgIHRoaXMuZm9yY2VKU09OUCA9ICEhb3B0cy5mb3JjZUpTT05QO1xuXHQgIHRoaXMuanNvbnAgPSBmYWxzZSAhPT0gb3B0cy5qc29ucDtcblx0ICB0aGlzLmZvcmNlQmFzZTY0ID0gISFvcHRzLmZvcmNlQmFzZTY0O1xuXHQgIHRoaXMuZW5hYmxlc1hEUiA9ICEhb3B0cy5lbmFibGVzWERSO1xuXHQgIHRoaXMudGltZXN0YW1wUGFyYW0gPSBvcHRzLnRpbWVzdGFtcFBhcmFtIHx8ICd0Jztcblx0ICB0aGlzLnRpbWVzdGFtcFJlcXVlc3RzID0gb3B0cy50aW1lc3RhbXBSZXF1ZXN0cztcblx0ICB0aGlzLnRyYW5zcG9ydHMgPSBvcHRzLnRyYW5zcG9ydHMgfHwgWydwb2xsaW5nJywgJ3dlYnNvY2tldCddO1xuXHQgIHRoaXMudHJhbnNwb3J0T3B0aW9ucyA9IG9wdHMudHJhbnNwb3J0T3B0aW9ucyB8fCB7fTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnJztcblx0ICB0aGlzLndyaXRlQnVmZmVyID0gW107XG5cdCAgdGhpcy5wcmV2QnVmZmVyTGVuID0gMDtcblx0ICB0aGlzLnBvbGljeVBvcnQgPSBvcHRzLnBvbGljeVBvcnQgfHwgODQzO1xuXHQgIHRoaXMucmVtZW1iZXJVcGdyYWRlID0gb3B0cy5yZW1lbWJlclVwZ3JhZGUgfHwgZmFsc2U7XG5cdCAgdGhpcy5iaW5hcnlUeXBlID0gbnVsbDtcblx0ICB0aGlzLm9ubHlCaW5hcnlVcGdyYWRlcyA9IG9wdHMub25seUJpbmFyeVVwZ3JhZGVzO1xuXHQgIHRoaXMucGVyTWVzc2FnZURlZmxhdGUgPSBmYWxzZSAhPT0gb3B0cy5wZXJNZXNzYWdlRGVmbGF0ZSA/IG9wdHMucGVyTWVzc2FnZURlZmxhdGUgfHwge30gOiBmYWxzZTtcblxuXHQgIGlmICh0cnVlID09PSB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlKSB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlID0ge307XG5cdCAgaWYgKHRoaXMucGVyTWVzc2FnZURlZmxhdGUgJiYgbnVsbCA9PSB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZCkge1xuXHQgICAgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZS50aHJlc2hvbGQgPSAxMDI0O1xuXHQgIH1cblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMucGZ4ID0gb3B0cy5wZnggfHwgbnVsbDtcblx0ICB0aGlzLmtleSA9IG9wdHMua2V5IHx8IG51bGw7XG5cdCAgdGhpcy5wYXNzcGhyYXNlID0gb3B0cy5wYXNzcGhyYXNlIHx8IG51bGw7XG5cdCAgdGhpcy5jZXJ0ID0gb3B0cy5jZXJ0IHx8IG51bGw7XG5cdCAgdGhpcy5jYSA9IG9wdHMuY2EgfHwgbnVsbDtcblx0ICB0aGlzLmNpcGhlcnMgPSBvcHRzLmNpcGhlcnMgfHwgbnVsbDtcblx0ICB0aGlzLnJlamVjdFVuYXV0aG9yaXplZCA9IG9wdHMucmVqZWN0VW5hdXRob3JpemVkID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cdCAgdGhpcy5mb3JjZU5vZGUgPSAhIW9wdHMuZm9yY2VOb2RlO1xuXG5cdCAgLy8gb3RoZXIgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB2YXIgZnJlZUdsb2JhbCA9IF90eXBlb2YoY29tbW9uanNHbG9iYWwpID09PSAnb2JqZWN0JyAmJiBjb21tb25qc0dsb2JhbDtcblx0ICBpZiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwpIHtcblx0ICAgIGlmIChvcHRzLmV4dHJhSGVhZGVycyAmJiBPYmplY3Qua2V5cyhvcHRzLmV4dHJhSGVhZGVycykubGVuZ3RoID4gMCkge1xuXHQgICAgICB0aGlzLmV4dHJhSGVhZGVycyA9IG9wdHMuZXh0cmFIZWFkZXJzO1xuXHQgICAgfVxuXG5cdCAgICBpZiAob3B0cy5sb2NhbEFkZHJlc3MpIHtcblx0ICAgICAgdGhpcy5sb2NhbEFkZHJlc3MgPSBvcHRzLmxvY2FsQWRkcmVzcztcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvLyBzZXQgb24gaGFuZHNoYWtlXG5cdCAgdGhpcy5pZCA9IG51bGw7XG5cdCAgdGhpcy51cGdyYWRlcyA9IG51bGw7XG5cdCAgdGhpcy5waW5nSW50ZXJ2YWwgPSBudWxsO1xuXHQgIHRoaXMucGluZ1RpbWVvdXQgPSBudWxsO1xuXG5cdCAgLy8gc2V0IG9uIGhlYXJ0YmVhdFxuXHQgIHRoaXMucGluZ0ludGVydmFsVGltZXIgPSBudWxsO1xuXHQgIHRoaXMucGluZ1RpbWVvdXRUaW1lciA9IG51bGw7XG5cblx0ICB0aGlzLm9wZW4oKTtcblx0fVxuXG5cdFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSBmYWxzZTtcblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihTb2NrZXQucHJvdG90eXBlKTtcblxuXHQvKipcblx0ICogUHJvdG9jb2wgdmVyc2lvbi5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0U29ja2V0LnByb3RvY29sID0gcGFyc2VyLnByb3RvY29sOyAvLyB0aGlzIGlzIGFuIGludFxuXG5cdC8qKlxuXHQgKiBFeHBvc2UgZGVwcyBmb3IgbGVnYWN5IGNvbXBhdGliaWxpdHlcblx0ICogYW5kIHN0YW5kYWxvbmUgYnJvd3NlciBhY2Nlc3MuXG5cdCAqL1xuXG5cdFNvY2tldC5Tb2NrZXQgPSBTb2NrZXQ7XG5cdFNvY2tldC5UcmFuc3BvcnQgPSBUcmFuc3BvcnQkMTtcblx0U29ja2V0LnRyYW5zcG9ydHMgPSB0cmFuc3BvcnRzJDI7XG5cdFNvY2tldC5wYXJzZXIgPSBwYXJzZXI7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdHJhbnNwb3J0IG9mIHRoZSBnaXZlbiB0eXBlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHJhbnNwb3J0IG5hbWVcblx0ICogQHJldHVybiB7VHJhbnNwb3J0fVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5jcmVhdGVUcmFuc3BvcnQgPSBmdW5jdGlvbiAobmFtZSkge1xuXHQgIGRlYnVnJDYoJ2NyZWF0aW5nIHRyYW5zcG9ydCBcIiVzXCInLCBuYW1lKTtcblx0ICB2YXIgcXVlcnkgPSBjbG9uZSh0aGlzLnF1ZXJ5KTtcblxuXHQgIC8vIGFwcGVuZCBlbmdpbmUuaW8gcHJvdG9jb2wgaWRlbnRpZmllclxuXHQgIHF1ZXJ5LkVJTyA9IHBhcnNlci5wcm90b2NvbDtcblxuXHQgIC8vIHRyYW5zcG9ydCBuYW1lXG5cdCAgcXVlcnkudHJhbnNwb3J0ID0gbmFtZTtcblxuXHQgIC8vIHBlci10cmFuc3BvcnQgb3B0aW9uc1xuXHQgIHZhciBvcHRpb25zID0gdGhpcy50cmFuc3BvcnRPcHRpb25zW25hbWVdIHx8IHt9O1xuXG5cdCAgLy8gc2Vzc2lvbiBpZCBpZiB3ZSBhbHJlYWR5IGhhdmUgb25lXG5cdCAgaWYgKHRoaXMuaWQpIHF1ZXJ5LnNpZCA9IHRoaXMuaWQ7XG5cblx0ICB2YXIgdHJhbnNwb3J0ID0gbmV3IHRyYW5zcG9ydHMkMltuYW1lXSh7XG5cdCAgICBxdWVyeTogcXVlcnksXG5cdCAgICBzb2NrZXQ6IHRoaXMsXG5cdCAgICBhZ2VudDogb3B0aW9ucy5hZ2VudCB8fCB0aGlzLmFnZW50LFxuXHQgICAgaG9zdG5hbWU6IG9wdGlvbnMuaG9zdG5hbWUgfHwgdGhpcy5ob3N0bmFtZSxcblx0ICAgIHBvcnQ6IG9wdGlvbnMucG9ydCB8fCB0aGlzLnBvcnQsXG5cdCAgICBzZWN1cmU6IG9wdGlvbnMuc2VjdXJlIHx8IHRoaXMuc2VjdXJlLFxuXHQgICAgcGF0aDogb3B0aW9ucy5wYXRoIHx8IHRoaXMucGF0aCxcblx0ICAgIGZvcmNlSlNPTlA6IG9wdGlvbnMuZm9yY2VKU09OUCB8fCB0aGlzLmZvcmNlSlNPTlAsXG5cdCAgICBqc29ucDogb3B0aW9ucy5qc29ucCB8fCB0aGlzLmpzb25wLFxuXHQgICAgZm9yY2VCYXNlNjQ6IG9wdGlvbnMuZm9yY2VCYXNlNjQgfHwgdGhpcy5mb3JjZUJhc2U2NCxcblx0ICAgIGVuYWJsZXNYRFI6IG9wdGlvbnMuZW5hYmxlc1hEUiB8fCB0aGlzLmVuYWJsZXNYRFIsXG5cdCAgICB0aW1lc3RhbXBSZXF1ZXN0czogb3B0aW9ucy50aW1lc3RhbXBSZXF1ZXN0cyB8fCB0aGlzLnRpbWVzdGFtcFJlcXVlc3RzLFxuXHQgICAgdGltZXN0YW1wUGFyYW06IG9wdGlvbnMudGltZXN0YW1wUGFyYW0gfHwgdGhpcy50aW1lc3RhbXBQYXJhbSxcblx0ICAgIHBvbGljeVBvcnQ6IG9wdGlvbnMucG9saWN5UG9ydCB8fCB0aGlzLnBvbGljeVBvcnQsXG5cdCAgICBwZng6IG9wdGlvbnMucGZ4IHx8IHRoaXMucGZ4LFxuXHQgICAga2V5OiBvcHRpb25zLmtleSB8fCB0aGlzLmtleSxcblx0ICAgIHBhc3NwaHJhc2U6IG9wdGlvbnMucGFzc3BocmFzZSB8fCB0aGlzLnBhc3NwaHJhc2UsXG5cdCAgICBjZXJ0OiBvcHRpb25zLmNlcnQgfHwgdGhpcy5jZXJ0LFxuXHQgICAgY2E6IG9wdGlvbnMuY2EgfHwgdGhpcy5jYSxcblx0ICAgIGNpcGhlcnM6IG9wdGlvbnMuY2lwaGVycyB8fCB0aGlzLmNpcGhlcnMsXG5cdCAgICByZWplY3RVbmF1dGhvcml6ZWQ6IG9wdGlvbnMucmVqZWN0VW5hdXRob3JpemVkIHx8IHRoaXMucmVqZWN0VW5hdXRob3JpemVkLFxuXHQgICAgcGVyTWVzc2FnZURlZmxhdGU6IG9wdGlvbnMucGVyTWVzc2FnZURlZmxhdGUgfHwgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSxcblx0ICAgIGV4dHJhSGVhZGVyczogb3B0aW9ucy5leHRyYUhlYWRlcnMgfHwgdGhpcy5leHRyYUhlYWRlcnMsXG5cdCAgICBmb3JjZU5vZGU6IG9wdGlvbnMuZm9yY2VOb2RlIHx8IHRoaXMuZm9yY2VOb2RlLFxuXHQgICAgbG9jYWxBZGRyZXNzOiBvcHRpb25zLmxvY2FsQWRkcmVzcyB8fCB0aGlzLmxvY2FsQWRkcmVzcyxcblx0ICAgIHJlcXVlc3RUaW1lb3V0OiBvcHRpb25zLnJlcXVlc3RUaW1lb3V0IHx8IHRoaXMucmVxdWVzdFRpbWVvdXQsXG5cdCAgICBwcm90b2NvbHM6IG9wdGlvbnMucHJvdG9jb2xzIHx8IHZvaWQgMFxuXHQgIH0pO1xuXG5cdCAgcmV0dXJuIHRyYW5zcG9ydDtcblx0fTtcblxuXHRmdW5jdGlvbiBjbG9uZShvYmopIHtcblx0ICB2YXIgbyA9IHt9O1xuXHQgIGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdCAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGkpKSB7XG5cdCAgICAgIG9baV0gPSBvYmpbaV07XG5cdCAgICB9XG5cdCAgfVxuXHQgIHJldHVybiBvO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRyYW5zcG9ydCB0byB1c2UgYW5kIHN0YXJ0cyBwcm9iZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXHRTb2NrZXQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHRyYW5zcG9ydDtcblx0ICBpZiAodGhpcy5yZW1lbWJlclVwZ3JhZGUgJiYgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyAmJiB0aGlzLnRyYW5zcG9ydHMuaW5kZXhPZignd2Vic29ja2V0JykgIT09IC0xKSB7XG5cdCAgICB0cmFuc3BvcnQgPSAnd2Vic29ja2V0Jztcblx0ICB9IGVsc2UgaWYgKDAgPT09IHRoaXMudHJhbnNwb3J0cy5sZW5ndGgpIHtcblx0ICAgIC8vIEVtaXQgZXJyb3Igb24gbmV4dCB0aWNrIHNvIGl0IGNhbiBiZSBsaXN0ZW5lZCB0b1xuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHNlbGYuZW1pdCgnZXJyb3InLCAnTm8gdHJhbnNwb3J0cyBhdmFpbGFibGUnKTtcblx0ICAgIH0sIDApO1xuXHQgICAgcmV0dXJuO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0cmFuc3BvcnQgPSB0aGlzLnRyYW5zcG9ydHNbMF07XG5cdCAgfVxuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuaW5nJztcblxuXHQgIC8vIFJldHJ5IHdpdGggdGhlIG5leHQgdHJhbnNwb3J0IGlmIHRoZSB0cmFuc3BvcnQgaXMgZGlzYWJsZWQgKGpzb25wOiBmYWxzZSlcblx0ICB0cnkge1xuXHQgICAgdHJhbnNwb3J0ID0gdGhpcy5jcmVhdGVUcmFuc3BvcnQodHJhbnNwb3J0KTtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICB0aGlzLnRyYW5zcG9ydHMuc2hpZnQoKTtcblx0ICAgIHRoaXMub3BlbigpO1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHRyYW5zcG9ydC5vcGVuKCk7XG5cdCAgdGhpcy5zZXRUcmFuc3BvcnQodHJhbnNwb3J0KTtcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY3VycmVudCB0cmFuc3BvcnQuIERpc2FibGVzIHRoZSBleGlzdGluZyBvbmUgKGlmIGFueSkuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLnNldFRyYW5zcG9ydCA9IGZ1bmN0aW9uICh0cmFuc3BvcnQpIHtcblx0ICBkZWJ1ZyQ2KCdzZXR0aW5nIHRyYW5zcG9ydCAlcycsIHRyYW5zcG9ydC5uYW1lKTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBpZiAodGhpcy50cmFuc3BvcnQpIHtcblx0ICAgIGRlYnVnJDYoJ2NsZWFyaW5nIGV4aXN0aW5nIHRyYW5zcG9ydCAlcycsIHRoaXMudHJhbnNwb3J0Lm5hbWUpO1xuXHQgICAgdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cdCAgfVxuXG5cdCAgLy8gc2V0IHVwIHRyYW5zcG9ydFxuXHQgIHRoaXMudHJhbnNwb3J0ID0gdHJhbnNwb3J0O1xuXG5cdCAgLy8gc2V0IHVwIHRyYW5zcG9ydCBsaXN0ZW5lcnNcblx0ICB0cmFuc3BvcnQub24oJ2RyYWluJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbkRyYWluKCk7XG5cdCAgfSkub24oJ3BhY2tldCcsIGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHNlbGYub25QYWNrZXQocGFja2V0KTtcblx0ICB9KS5vbignZXJyb3InLCBmdW5jdGlvbiAoZSkge1xuXHQgICAgc2VsZi5vbkVycm9yKGUpO1xuXHQgIH0pLm9uKCdjbG9zZScsIGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25DbG9zZSgndHJhbnNwb3J0IGNsb3NlJyk7XG5cdCAgfSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFByb2JlcyBhIHRyYW5zcG9ydC5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHRyYW5zcG9ydCBuYW1lXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLnByb2JlID0gZnVuY3Rpb24gKG5hbWUpIHtcblx0ICBkZWJ1ZyQ2KCdwcm9iaW5nIHRyYW5zcG9ydCBcIiVzXCInLCBuYW1lKTtcblx0ICB2YXIgdHJhbnNwb3J0ID0gdGhpcy5jcmVhdGVUcmFuc3BvcnQobmFtZSwgeyBwcm9iZTogMSB9KTtcblx0ICB2YXIgZmFpbGVkID0gZmFsc2U7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9IGZhbHNlO1xuXG5cdCAgZnVuY3Rpb24gb25UcmFuc3BvcnRPcGVuKCkge1xuXHQgICAgaWYgKHNlbGYub25seUJpbmFyeVVwZ3JhZGVzKSB7XG5cdCAgICAgIHZhciB1cGdyYWRlTG9zZXNCaW5hcnkgPSAhdGhpcy5zdXBwb3J0c0JpbmFyeSAmJiBzZWxmLnRyYW5zcG9ydC5zdXBwb3J0c0JpbmFyeTtcblx0ICAgICAgZmFpbGVkID0gZmFpbGVkIHx8IHVwZ3JhZGVMb3Nlc0JpbmFyeTtcblx0ICAgIH1cblx0ICAgIGlmIChmYWlsZWQpIHJldHVybjtcblxuXHQgICAgZGVidWckNigncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBvcGVuZWQnLCBuYW1lKTtcblx0ICAgIHRyYW5zcG9ydC5zZW5kKFt7IHR5cGU6ICdwaW5nJywgZGF0YTogJ3Byb2JlJyB9XSk7XG5cdCAgICB0cmFuc3BvcnQub25jZSgncGFja2V0JywgZnVuY3Rpb24gKG1zZykge1xuXHQgICAgICBpZiAoZmFpbGVkKSByZXR1cm47XG5cdCAgICAgIGlmICgncG9uZycgPT09IG1zZy50eXBlICYmICdwcm9iZScgPT09IG1zZy5kYXRhKSB7XG5cdCAgICAgICAgZGVidWckNigncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBwb25nJywgbmFtZSk7XG5cdCAgICAgICAgc2VsZi51cGdyYWRpbmcgPSB0cnVlO1xuXHQgICAgICAgIHNlbGYuZW1pdCgndXBncmFkaW5nJywgdHJhbnNwb3J0KTtcblx0ICAgICAgICBpZiAoIXRyYW5zcG9ydCkgcmV0dXJuO1xuXHQgICAgICAgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSAnd2Vic29ja2V0JyA9PT0gdHJhbnNwb3J0Lm5hbWU7XG5cblx0ICAgICAgICBkZWJ1ZyQ2KCdwYXVzaW5nIGN1cnJlbnQgdHJhbnNwb3J0IFwiJXNcIicsIHNlbGYudHJhbnNwb3J0Lm5hbWUpO1xuXHQgICAgICAgIHNlbGYudHJhbnNwb3J0LnBhdXNlKGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgIGlmIChmYWlsZWQpIHJldHVybjtcblx0ICAgICAgICAgIGlmICgnY2xvc2VkJyA9PT0gc2VsZi5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgICAgICAgICBkZWJ1ZyQ2KCdjaGFuZ2luZyB0cmFuc3BvcnQgYW5kIHNlbmRpbmcgdXBncmFkZSBwYWNrZXQnKTtcblxuXHQgICAgICAgICAgY2xlYW51cCgpO1xuXG5cdCAgICAgICAgICBzZWxmLnNldFRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuXHQgICAgICAgICAgdHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogJ3VwZ3JhZGUnIH1dKTtcblx0ICAgICAgICAgIHNlbGYuZW1pdCgndXBncmFkZScsIHRyYW5zcG9ydCk7XG5cdCAgICAgICAgICB0cmFuc3BvcnQgPSBudWxsO1xuXHQgICAgICAgICAgc2VsZi51cGdyYWRpbmcgPSBmYWxzZTtcblx0ICAgICAgICAgIHNlbGYuZmx1c2goKTtcblx0ICAgICAgICB9KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIGZhaWxlZCcsIG5hbWUpO1xuXHQgICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ3Byb2JlIGVycm9yJyk7XG5cdCAgICAgICAgZXJyLnRyYW5zcG9ydCA9IHRyYW5zcG9ydC5uYW1lO1xuXHQgICAgICAgIHNlbGYuZW1pdCgndXBncmFkZUVycm9yJywgZXJyKTtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZnJlZXplVHJhbnNwb3J0KCkge1xuXHQgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXG5cdCAgICAvLyBBbnkgY2FsbGJhY2sgY2FsbGVkIGJ5IHRyYW5zcG9ydCBzaG91bGQgYmUgaWdub3JlZCBzaW5jZSBub3dcblx0ICAgIGZhaWxlZCA9IHRydWU7XG5cblx0ICAgIGNsZWFudXAoKTtcblxuXHQgICAgdHJhbnNwb3J0LmNsb3NlKCk7XG5cdCAgICB0cmFuc3BvcnQgPSBudWxsO1xuXHQgIH1cblxuXHQgIC8vIEhhbmRsZSBhbnkgZXJyb3IgdGhhdCBoYXBwZW5zIHdoaWxlIHByb2Jpbmdcblx0ICBmdW5jdGlvbiBvbmVycm9yKGVycikge1xuXHQgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdwcm9iZSBlcnJvcjogJyArIGVycik7XG5cdCAgICBlcnJvci50cmFuc3BvcnQgPSB0cmFuc3BvcnQubmFtZTtcblxuXHQgICAgZnJlZXplVHJhbnNwb3J0KCk7XG5cblx0ICAgIGRlYnVnJDYoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgZmFpbGVkIGJlY2F1c2Ugb2YgZXJyb3I6ICVzJywgbmFtZSwgZXJyKTtcblxuXHQgICAgc2VsZi5lbWl0KCd1cGdyYWRlRXJyb3InLCBlcnJvcik7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gb25UcmFuc3BvcnRDbG9zZSgpIHtcblx0ICAgIG9uZXJyb3IoJ3RyYW5zcG9ydCBjbG9zZWQnKTtcblx0ICB9XG5cblx0ICAvLyBXaGVuIHRoZSBzb2NrZXQgaXMgY2xvc2VkIHdoaWxlIHdlJ3JlIHByb2Jpbmdcblx0ICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuXHQgICAgb25lcnJvcignc29ja2V0IGNsb3NlZCcpO1xuXHQgIH1cblxuXHQgIC8vIFdoZW4gdGhlIHNvY2tldCBpcyB1cGdyYWRlZCB3aGlsZSB3ZSdyZSBwcm9iaW5nXG5cdCAgZnVuY3Rpb24gb251cGdyYWRlKHRvKSB7XG5cdCAgICBpZiAodHJhbnNwb3J0ICYmIHRvLm5hbWUgIT09IHRyYW5zcG9ydC5uYW1lKSB7XG5cdCAgICAgIGRlYnVnJDYoJ1wiJXNcIiB3b3JrcyAtIGFib3J0aW5nIFwiJXNcIicsIHRvLm5hbWUsIHRyYW5zcG9ydC5uYW1lKTtcblx0ICAgICAgZnJlZXplVHJhbnNwb3J0KCk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLy8gUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgb24gdGhlIHRyYW5zcG9ydCBhbmQgb24gc2VsZlxuXHQgIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG5cdCAgICB0cmFuc3BvcnQucmVtb3ZlTGlzdGVuZXIoJ29wZW4nLCBvblRyYW5zcG9ydE9wZW4pO1xuXHQgICAgdHJhbnNwb3J0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuXHQgICAgdHJhbnNwb3J0LnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uVHJhbnNwb3J0Q2xvc2UpO1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcblx0ICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ3VwZ3JhZGluZycsIG9udXBncmFkZSk7XG5cdCAgfVxuXG5cdCAgdHJhbnNwb3J0Lm9uY2UoJ29wZW4nLCBvblRyYW5zcG9ydE9wZW4pO1xuXHQgIHRyYW5zcG9ydC5vbmNlKCdlcnJvcicsIG9uZXJyb3IpO1xuXHQgIHRyYW5zcG9ydC5vbmNlKCdjbG9zZScsIG9uVHJhbnNwb3J0Q2xvc2UpO1xuXG5cdCAgdGhpcy5vbmNlKCdjbG9zZScsIG9uY2xvc2UpO1xuXHQgIHRoaXMub25jZSgndXBncmFkaW5nJywgb251cGdyYWRlKTtcblxuXHQgIHRyYW5zcG9ydC5vcGVuKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIGNvbm5lY3Rpb24gaXMgZGVlbWVkIG9wZW4uXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDYoJ3NvY2tldCBvcGVuJyk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW4nO1xuXHQgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSAnd2Vic29ja2V0JyA9PT0gdGhpcy50cmFuc3BvcnQubmFtZTtcblx0ICB0aGlzLmVtaXQoJ29wZW4nKTtcblx0ICB0aGlzLmZsdXNoKCk7XG5cblx0ICAvLyB3ZSBjaGVjayBmb3IgYHJlYWR5U3RhdGVgIGluIGNhc2UgYW4gYG9wZW5gXG5cdCAgLy8gbGlzdGVuZXIgYWxyZWFkeSBjbG9zZWQgdGhlIHNvY2tldFxuXHQgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSAmJiB0aGlzLnVwZ3JhZGUgJiYgdGhpcy50cmFuc3BvcnQucGF1c2UpIHtcblx0ICAgIGRlYnVnJDYoJ3N0YXJ0aW5nIHVwZ3JhZGUgcHJvYmVzJyk7XG5cdCAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMudXBncmFkZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICAgIHRoaXMucHJvYmUodGhpcy51cGdyYWRlc1tpXSk7XG5cdCAgICB9XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBIYW5kbGVzIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vblBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ2Nsb3NpbmcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIGRlYnVnJDYoJ3NvY2tldCByZWNlaXZlOiB0eXBlIFwiJXNcIiwgZGF0YSBcIiVzXCInLCBwYWNrZXQudHlwZSwgcGFja2V0LmRhdGEpO1xuXG5cdCAgICB0aGlzLmVtaXQoJ3BhY2tldCcsIHBhY2tldCk7XG5cblx0ICAgIC8vIFNvY2tldCBpcyBsaXZlIC0gYW55IHBhY2tldCBjb3VudHNcblx0ICAgIHRoaXMuZW1pdCgnaGVhcnRiZWF0Jyk7XG5cblx0ICAgIHN3aXRjaCAocGFja2V0LnR5cGUpIHtcblx0ICAgICAgY2FzZSAnb3Blbic6XG5cdCAgICAgICAgdGhpcy5vbkhhbmRzaGFrZShKU09OLnBhcnNlKHBhY2tldC5kYXRhKSk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSAncG9uZyc6XG5cdCAgICAgICAgdGhpcy5zZXRQaW5nKCk7XG5cdCAgICAgICAgdGhpcy5lbWl0KCdwb25nJyk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSAnZXJyb3InOlxuXHQgICAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ3NlcnZlciBlcnJvcicpO1xuXHQgICAgICAgIGVyci5jb2RlID0gcGFja2V0LmRhdGE7XG5cdCAgICAgICAgdGhpcy5vbkVycm9yKGVycik7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSAnbWVzc2FnZSc6XG5cdCAgICAgICAgdGhpcy5lbWl0KCdkYXRhJywgcGFja2V0LmRhdGEpO1xuXHQgICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgICBicmVhaztcblx0ICAgIH1cblx0ICB9IGVsc2Uge1xuXHQgICAgZGVidWckNigncGFja2V0IHJlY2VpdmVkIHdpdGggc29ja2V0IHJlYWR5U3RhdGUgXCIlc1wiJywgdGhpcy5yZWFkeVN0YXRlKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGhhbmRzaGFrZSBjb21wbGV0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gaGFuZHNoYWtlIG9ialxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbkhhbmRzaGFrZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdGhpcy5lbWl0KCdoYW5kc2hha2UnLCBkYXRhKTtcblx0ICB0aGlzLmlkID0gZGF0YS5zaWQ7XG5cdCAgdGhpcy50cmFuc3BvcnQucXVlcnkuc2lkID0gZGF0YS5zaWQ7XG5cdCAgdGhpcy51cGdyYWRlcyA9IHRoaXMuZmlsdGVyVXBncmFkZXMoZGF0YS51cGdyYWRlcyk7XG5cdCAgdGhpcy5waW5nSW50ZXJ2YWwgPSBkYXRhLnBpbmdJbnRlcnZhbDtcblx0ICB0aGlzLnBpbmdUaW1lb3V0ID0gZGF0YS5waW5nVGltZW91dDtcblx0ICB0aGlzLm9uT3BlbigpO1xuXHQgIC8vIEluIGNhc2Ugb3BlbiBoYW5kbGVyIGNsb3NlcyBzb2NrZXRcblx0ICBpZiAoJ2Nsb3NlZCcgPT09IHRoaXMucmVhZHlTdGF0ZSkgcmV0dXJuO1xuXHQgIHRoaXMuc2V0UGluZygpO1xuXG5cdCAgLy8gUHJvbG9uZyBsaXZlbmVzcyBvZiBzb2NrZXQgb24gaGVhcnRiZWF0XG5cdCAgdGhpcy5yZW1vdmVMaXN0ZW5lcignaGVhcnRiZWF0JywgdGhpcy5vbkhlYXJ0YmVhdCk7XG5cdCAgdGhpcy5vbignaGVhcnRiZWF0JywgdGhpcy5vbkhlYXJ0YmVhdCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlc2V0cyBwaW5nIHRpbWVvdXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uSGVhcnRiZWF0ID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcblx0ICBjbGVhclRpbWVvdXQodGhpcy5waW5nVGltZW91dFRpbWVyKTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgc2VsZi5waW5nVGltZW91dFRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAoJ2Nsb3NlZCcgPT09IHNlbGYucmVhZHlTdGF0ZSkgcmV0dXJuO1xuXHQgICAgc2VsZi5vbkNsb3NlKCdwaW5nIHRpbWVvdXQnKTtcblx0ICB9LCB0aW1lb3V0IHx8IHNlbGYucGluZ0ludGVydmFsICsgc2VsZi5waW5nVGltZW91dCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFBpbmdzIHNlcnZlciBldmVyeSBgdGhpcy5waW5nSW50ZXJ2YWxgIGFuZCBleHBlY3RzIHJlc3BvbnNlXG5cdCAqIHdpdGhpbiBgdGhpcy5waW5nVGltZW91dGAgb3IgY2xvc2VzIGNvbm5lY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLnNldFBpbmcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIGNsZWFyVGltZW91dChzZWxmLnBpbmdJbnRlcnZhbFRpbWVyKTtcblx0ICBzZWxmLnBpbmdJbnRlcnZhbFRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICBkZWJ1ZyQ2KCd3cml0aW5nIHBpbmcgcGFja2V0IC0gZXhwZWN0aW5nIHBvbmcgd2l0aGluICVzbXMnLCBzZWxmLnBpbmdUaW1lb3V0KTtcblx0ICAgIHNlbGYucGluZygpO1xuXHQgICAgc2VsZi5vbkhlYXJ0YmVhdChzZWxmLnBpbmdUaW1lb3V0KTtcblx0ICB9LCBzZWxmLnBpbmdJbnRlcnZhbCk7XG5cdH07XG5cblx0LyoqXG5cdCogU2VuZHMgYSBwaW5nIHBhY2tldC5cblx0KlxuXHQqIEBhcGkgcHJpdmF0ZVxuXHQqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUucGluZyA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdGhpcy5zZW5kUGFja2V0KCdwaW5nJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5lbWl0KCdwaW5nJyk7XG5cdCAgfSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCBvbiBgZHJhaW5gIGV2ZW50XG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uRHJhaW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy53cml0ZUJ1ZmZlci5zcGxpY2UoMCwgdGhpcy5wcmV2QnVmZmVyTGVuKTtcblxuXHQgIC8vIHNldHRpbmcgcHJldkJ1ZmZlckxlbiA9IDAgaXMgdmVyeSBpbXBvcnRhbnRcblx0ICAvLyBmb3IgZXhhbXBsZSwgd2hlbiB1cGdyYWRpbmcsIHVwZ3JhZGUgcGFja2V0IGlzIHNlbnQgb3Zlcixcblx0ICAvLyBhbmQgYSBub256ZXJvIHByZXZCdWZmZXJMZW4gY291bGQgY2F1c2UgcHJvYmxlbXMgb24gYGRyYWluYFxuXHQgIHRoaXMucHJldkJ1ZmZlckxlbiA9IDA7XG5cblx0ICBpZiAoMCA9PT0gdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcblx0ICAgIHRoaXMuZW1pdCgnZHJhaW4nKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhpcy5mbHVzaCgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogRmx1c2ggd3JpdGUgYnVmZmVycy5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuZmx1c2ggPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdjbG9zZWQnICE9PSB0aGlzLnJlYWR5U3RhdGUgJiYgdGhpcy50cmFuc3BvcnQud3JpdGFibGUgJiYgIXRoaXMudXBncmFkaW5nICYmIHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSB7XG5cdCAgICBkZWJ1ZyQ2KCdmbHVzaGluZyAlZCBwYWNrZXRzIGluIHNvY2tldCcsIHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKTtcblx0ICAgIHRoaXMudHJhbnNwb3J0LnNlbmQodGhpcy53cml0ZUJ1ZmZlcik7XG5cdCAgICAvLyBrZWVwIHRyYWNrIG9mIGN1cnJlbnQgbGVuZ3RoIG9mIHdyaXRlQnVmZmVyXG5cdCAgICAvLyBzcGxpY2Ugd3JpdGVCdWZmZXIgYW5kIGNhbGxiYWNrQnVmZmVyIG9uIGBkcmFpbmBcblx0ICAgIHRoaXMucHJldkJ1ZmZlckxlbiA9IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoO1xuXHQgICAgdGhpcy5lbWl0KCdmbHVzaCcpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgYSBtZXNzYWdlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZS5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgZnVuY3Rpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLlxuXHQgKiBAcmV0dXJuIHtTb2NrZXR9IGZvciBjaGFpbmluZy5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS53cml0ZSA9IFNvY2tldC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uIChtc2csIG9wdGlvbnMsIGZuKSB7XG5cdCAgdGhpcy5zZW5kUGFja2V0KCdtZXNzYWdlJywgbXNnLCBvcHRpb25zLCBmbik7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNlbmRzIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gcGFja2V0IHR5cGUuXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgZnVuY3Rpb24uXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLnNlbmRQYWNrZXQgPSBmdW5jdGlvbiAodHlwZSwgZGF0YSwgb3B0aW9ucywgZm4pIHtcblx0ICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRhdGEpIHtcblx0ICAgIGZuID0gZGF0YTtcblx0ICAgIGRhdGEgPSB1bmRlZmluZWQ7XG5cdCAgfVxuXG5cdCAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBvcHRpb25zKSB7XG5cdCAgICBmbiA9IG9wdGlvbnM7XG5cdCAgICBvcHRpb25zID0gbnVsbDtcblx0ICB9XG5cblx0ICBpZiAoJ2Nsb3NpbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ2Nsb3NlZCcgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHQgIG9wdGlvbnMuY29tcHJlc3MgPSBmYWxzZSAhPT0gb3B0aW9ucy5jb21wcmVzcztcblxuXHQgIHZhciBwYWNrZXQgPSB7XG5cdCAgICB0eXBlOiB0eXBlLFxuXHQgICAgZGF0YTogZGF0YSxcblx0ICAgIG9wdGlvbnM6IG9wdGlvbnNcblx0ICB9O1xuXHQgIHRoaXMuZW1pdCgncGFja2V0Q3JlYXRlJywgcGFja2V0KTtcblx0ICB0aGlzLndyaXRlQnVmZmVyLnB1c2gocGFja2V0KTtcblx0ICBpZiAoZm4pIHRoaXMub25jZSgnZmx1c2gnLCBmbik7XG5cdCAgdGhpcy5mbHVzaCgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbG9zZXMgdGhlIGNvbm5lY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NpbmcnO1xuXG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICAgIGlmICh0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCkge1xuXHQgICAgICB0aGlzLm9uY2UoJ2RyYWluJywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICh0aGlzLnVwZ3JhZGluZykge1xuXHQgICAgICAgICAgd2FpdEZvclVwZ3JhZGUoKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgY2xvc2UoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfSBlbHNlIGlmICh0aGlzLnVwZ3JhZGluZykge1xuXHQgICAgICB3YWl0Rm9yVXBncmFkZSgpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgY2xvc2UoKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBjbG9zZSgpIHtcblx0ICAgIHNlbGYub25DbG9zZSgnZm9yY2VkIGNsb3NlJyk7XG5cdCAgICBkZWJ1ZyQ2KCdzb2NrZXQgY2xvc2luZyAtIHRlbGxpbmcgdHJhbnNwb3J0IHRvIGNsb3NlJyk7XG5cdCAgICBzZWxmLnRyYW5zcG9ydC5jbG9zZSgpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGNsZWFudXBBbmRDbG9zZSgpIHtcblx0ICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ3VwZ3JhZGUnLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcigndXBncmFkZUVycm9yJywgY2xlYW51cEFuZENsb3NlKTtcblx0ICAgIGNsb3NlKCk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gd2FpdEZvclVwZ3JhZGUoKSB7XG5cdCAgICAvLyB3YWl0IGZvciB1cGdyYWRlIHRvIGZpbmlzaCBzaW5jZSB3ZSBjYW4ndCBzZW5kIHBhY2tldHMgd2hpbGUgcGF1c2luZyBhIHRyYW5zcG9ydFxuXHQgICAgc2VsZi5vbmNlKCd1cGdyYWRlJywgY2xlYW51cEFuZENsb3NlKTtcblx0ICAgIHNlbGYub25jZSgndXBncmFkZUVycm9yJywgY2xlYW51cEFuZENsb3NlKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gdHJhbnNwb3J0IGVycm9yXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG5cdCAgZGVidWckNignc29ja2V0IGVycm9yICVqJywgZXJyKTtcblx0ICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gZmFsc2U7XG5cdCAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG5cdCAgdGhpcy5vbkNsb3NlKCd0cmFuc3BvcnQgZXJyb3InLCBlcnIpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiB0cmFuc3BvcnQgY2xvc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uQ2xvc2UgPSBmdW5jdGlvbiAocmVhc29uLCBkZXNjKSB7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdjbG9zaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICBkZWJ1ZyQ2KCdzb2NrZXQgY2xvc2Ugd2l0aCByZWFzb246IFwiJXNcIicsIHJlYXNvbik7XG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICAgIC8vIGNsZWFyIHRpbWVyc1xuXHQgICAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ0ludGVydmFsVGltZXIpO1xuXHQgICAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXRUaW1lcik7XG5cblx0ICAgIC8vIHN0b3AgZXZlbnQgZnJvbSBmaXJpbmcgYWdhaW4gZm9yIHRyYW5zcG9ydFxuXHQgICAgdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCdjbG9zZScpO1xuXG5cdCAgICAvLyBlbnN1cmUgdHJhbnNwb3J0IHdvbid0IHN0YXkgb3BlblxuXHQgICAgdGhpcy50cmFuc3BvcnQuY2xvc2UoKTtcblxuXHQgICAgLy8gaWdub3JlIGZ1cnRoZXIgdHJhbnNwb3J0IGNvbW11bmljYXRpb25cblx0ICAgIHRoaXMudHJhbnNwb3J0LnJlbW92ZUFsbExpc3RlbmVycygpO1xuXG5cdCAgICAvLyBzZXQgcmVhZHkgc3RhdGVcblx0ICAgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXG5cdCAgICAvLyBjbGVhciBzZXNzaW9uIGlkXG5cdCAgICB0aGlzLmlkID0gbnVsbDtcblxuXHQgICAgLy8gZW1pdCBjbG9zZSBldmVudFxuXHQgICAgdGhpcy5lbWl0KCdjbG9zZScsIHJlYXNvbiwgZGVzYyk7XG5cblx0ICAgIC8vIGNsZWFuIGJ1ZmZlcnMgYWZ0ZXIsIHNvIHVzZXJzIGNhbiBzdGlsbFxuXHQgICAgLy8gZ3JhYiB0aGUgYnVmZmVycyBvbiBgY2xvc2VgIGV2ZW50XG5cdCAgICBzZWxmLndyaXRlQnVmZmVyID0gW107XG5cdCAgICBzZWxmLnByZXZCdWZmZXJMZW4gPSAwO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogRmlsdGVycyB1cGdyYWRlcywgcmV0dXJuaW5nIG9ubHkgdGhvc2UgbWF0Y2hpbmcgY2xpZW50IHRyYW5zcG9ydHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9IHNlcnZlciB1cGdyYWRlc1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICpcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5maWx0ZXJVcGdyYWRlcyA9IGZ1bmN0aW9uICh1cGdyYWRlcykge1xuXHQgIHZhciBmaWx0ZXJlZFVwZ3JhZGVzID0gW107XG5cdCAgZm9yICh2YXIgaSA9IDAsIGogPSB1cGdyYWRlcy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcblx0ICAgIGlmICh+aW5kZXgodGhpcy50cmFuc3BvcnRzLCB1cGdyYWRlc1tpXSkpIGZpbHRlcmVkVXBncmFkZXMucHVzaCh1cGdyYWRlc1tpXSk7XG5cdCAgfVxuXHQgIHJldHVybiBmaWx0ZXJlZFVwZ3JhZGVzO1xuXHR9O1xuXG5cdHZhciBzb2NrZXQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBzb2NrZXQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBzb2NrZXRcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDAkNCA9ICggc29ja2V0JDEgJiYgc29ja2V0ICkgfHwgc29ja2V0JDE7XG5cblx0dmFyIGxpYiA9IHJlcXVpcmUkJDAkNDtcblxuXHQvKipcblx0ICogRXhwb3J0cyBwYXJzZXJcblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICpcblx0ICovXG5cdHZhciBwYXJzZXIkMSA9IHBhcnNlcjtcblx0bGliLnBhcnNlciA9IHBhcnNlciQxO1xuXG5cdHZhciBsaWIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBsaWIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBsaWIsXG5cdFx0cGFyc2VyOiBwYXJzZXIkMVxuXHR9KTtcblxuXHR2YXIgdG9BcnJheV8xID0gdG9BcnJheSQxO1xuXG5cdGZ1bmN0aW9uIHRvQXJyYXkkMShsaXN0LCBpbmRleCkge1xuXHQgICAgdmFyIGFycmF5ID0gW107XG5cblx0ICAgIGluZGV4ID0gaW5kZXggfHwgMDtcblxuXHQgICAgZm9yICh2YXIgaSA9IGluZGV4IHx8IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgYXJyYXlbaSAtIGluZGV4XSA9IGxpc3RbaV07XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBhcnJheTtcblx0fVxuXG5cdHZhciB0b0FycmF5JDIgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogdG9BcnJheV8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdG9BcnJheV8xXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIG9uXzEgPSBvbjtcblxuXHQvKipcblx0ICogSGVscGVyIGZvciBzdWJzY3JpcHRpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdHxFdmVudEVtaXR0ZXJ9IG9iaiB3aXRoIGBFbWl0dGVyYCBtaXhpbiBvciBgRXZlbnRFbWl0dGVyYFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgbmFtZVxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBvbihvYmosIGV2LCBmbikge1xuXHQgIG9iai5vbihldiwgZm4pO1xuXHQgIHJldHVybiB7XG5cdCAgICBkZXN0cm95OiBmdW5jdGlvbiBkZXN0cm95KCkge1xuXHQgICAgICBvYmoucmVtb3ZlTGlzdGVuZXIoZXYsIGZuKTtcblx0ICAgIH1cblx0ICB9O1xuXHR9XG5cblx0dmFyIG9uJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogb25fMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IG9uXzFcblx0fSk7XG5cblx0LyoqXG5cdCAqIFNsaWNlIHJlZmVyZW5jZS5cblx0ICovXG5cblx0dmFyIHNsaWNlID0gW10uc2xpY2U7XG5cblx0LyoqXG5cdCAqIEJpbmQgYG9iamAgdG8gYGZuYC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9ialxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufFN0cmluZ30gZm4gb3Igc3RyaW5nXG5cdCAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgY29tcG9uZW50QmluZCA9IGZ1bmN0aW9uIGNvbXBvbmVudEJpbmQob2JqLCBmbikge1xuXHQgIGlmICgnc3RyaW5nJyA9PSB0eXBlb2YgZm4pIGZuID0gb2JqW2ZuXTtcblx0ICBpZiAoJ2Z1bmN0aW9uJyAhPSB0eXBlb2YgZm4pIHRocm93IG5ldyBFcnJvcignYmluZCgpIHJlcXVpcmVzIGEgZnVuY3Rpb24nKTtcblx0ICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcblx0ICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgcmV0dXJuIGZuLmFwcGx5KG9iaiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG5cdCAgfTtcblx0fTtcblxuXHR2YXIgY29tcG9uZW50QmluZCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGNvbXBvbmVudEJpbmQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBjb21wb25lbnRCaW5kXG5cdH0pO1xuXG5cdHZhciBwYXJzZXIkMiA9ICggc29ja2V0X2lvUGFyc2VyJDEgJiYgc29ja2V0X2lvUGFyc2VyICkgfHwgc29ja2V0X2lvUGFyc2VyJDE7XG5cblx0dmFyIHRvQXJyYXkkMyA9ICggdG9BcnJheSQyICYmIHRvQXJyYXlfMSApIHx8IHRvQXJyYXkkMjtcblxuXHR2YXIgb24kMiA9ICggb24kMSAmJiBvbl8xICkgfHwgb24kMTtcblxuXHR2YXIgYmluZCA9ICggY29tcG9uZW50QmluZCQxICYmIGNvbXBvbmVudEJpbmQgKSB8fCBjb21wb25lbnRCaW5kJDE7XG5cblx0dmFyIHNvY2tldCQyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgZGVidWcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQ6c29ja2V0Jyk7XG5cblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICAgKi9cblxuXHQgIG1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IFNvY2tldDtcblxuXHQgIC8qKlxuXHQgICAqIEludGVybmFsIGV2ZW50cyAoYmxhY2tsaXN0ZWQpLlxuXHQgICAqIFRoZXNlIGV2ZW50cyBjYW4ndCBiZSBlbWl0dGVkIGJ5IHRoZSB1c2VyLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICB2YXIgZXZlbnRzID0ge1xuXHQgICAgY29ubmVjdDogMSxcblx0ICAgIGNvbm5lY3RfZXJyb3I6IDEsXG5cdCAgICBjb25uZWN0X3RpbWVvdXQ6IDEsXG5cdCAgICBjb25uZWN0aW5nOiAxLFxuXHQgICAgZGlzY29ubmVjdDogMSxcblx0ICAgIGVycm9yOiAxLFxuXHQgICAgcmVjb25uZWN0OiAxLFxuXHQgICAgcmVjb25uZWN0X2F0dGVtcHQ6IDEsXG5cdCAgICByZWNvbm5lY3RfZmFpbGVkOiAxLFxuXHQgICAgcmVjb25uZWN0X2Vycm9yOiAxLFxuXHQgICAgcmVjb25uZWN0aW5nOiAxLFxuXHQgICAgcGluZzogMSxcblx0ICAgIHBvbmc6IDFcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogU2hvcnRjdXQgdG8gYEVtaXR0ZXIjZW1pdGAuXG5cdCAgICovXG5cblx0ICB2YXIgZW1pdCA9IEVtaXR0ZXIucHJvdG90eXBlLmVtaXQ7XG5cblx0ICAvKipcblx0ICAgKiBgU29ja2V0YCBjb25zdHJ1Y3Rvci5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBTb2NrZXQoaW8sIG5zcCwgb3B0cykge1xuXHQgICAgdGhpcy5pbyA9IGlvO1xuXHQgICAgdGhpcy5uc3AgPSBuc3A7XG5cdCAgICB0aGlzLmpzb24gPSB0aGlzOyAvLyBjb21wYXRcblx0ICAgIHRoaXMuaWRzID0gMDtcblx0ICAgIHRoaXMuYWNrcyA9IHt9O1xuXHQgICAgdGhpcy5yZWNlaXZlQnVmZmVyID0gW107XG5cdCAgICB0aGlzLnNlbmRCdWZmZXIgPSBbXTtcblx0ICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG5cdCAgICB0aGlzLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG5cdCAgICB0aGlzLmZsYWdzID0ge307XG5cdCAgICBpZiAob3B0cyAmJiBvcHRzLnF1ZXJ5KSB7XG5cdCAgICAgIHRoaXMucXVlcnkgPSBvcHRzLnF1ZXJ5O1xuXHQgICAgfVxuXHQgICAgaWYgKHRoaXMuaW8uYXV0b0Nvbm5lY3QpIHRoaXMub3BlbigpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1peCBpbiBgRW1pdHRlcmAuXG5cdCAgICovXG5cblx0ICBFbWl0dGVyKFNvY2tldC5wcm90b3R5cGUpO1xuXG5cdCAgLyoqXG5cdCAgICogU3Vic2NyaWJlIHRvIG9wZW4sIGNsb3NlIGFuZCBwYWNrZXQgZXZlbnRzXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuc3ViRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKHRoaXMuc3VicykgcmV0dXJuO1xuXG5cdCAgICB2YXIgaW8gPSB0aGlzLmlvO1xuXHQgICAgdGhpcy5zdWJzID0gW29uJDIoaW8sICdvcGVuJywgYmluZCh0aGlzLCAnb25vcGVuJykpLCBvbiQyKGlvLCAncGFja2V0JywgYmluZCh0aGlzLCAnb25wYWNrZXQnKSksIG9uJDIoaW8sICdjbG9zZScsIGJpbmQodGhpcywgJ29uY2xvc2UnKSldO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBcIk9wZW5zXCIgdGhlIHNvY2tldC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9wZW4gPSBTb2NrZXQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHJldHVybiB0aGlzO1xuXG5cdCAgICB0aGlzLnN1YkV2ZW50cygpO1xuXHQgICAgdGhpcy5pby5vcGVuKCk7IC8vIGVuc3VyZSBvcGVuXG5cdCAgICBpZiAoJ29wZW4nID09PSB0aGlzLmlvLnJlYWR5U3RhdGUpIHRoaXMub25vcGVuKCk7XG5cdCAgICB0aGlzLmVtaXQoJ2Nvbm5lY3RpbmcnKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTZW5kcyBhIGBtZXNzYWdlYCBldmVudC5cblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB2YXIgYXJncyA9IHRvQXJyYXkkMyhhcmd1bWVudHMpO1xuXHQgICAgYXJncy51bnNoaWZ0KCdtZXNzYWdlJyk7XG5cdCAgICB0aGlzLmVtaXQuYXBwbHkodGhpcywgYXJncyk7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogT3ZlcnJpZGUgYGVtaXRgLlxuXHQgICAqIElmIHRoZSBldmVudCBpcyBpbiBgZXZlbnRzYCwgaXQncyBlbWl0dGVkIG5vcm1hbGx5LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IG5hbWVcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gKGV2KSB7XG5cdCAgICBpZiAoZXZlbnRzLmhhc093blByb3BlcnR5KGV2KSkge1xuXHQgICAgICBlbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdCAgICAgIHJldHVybiB0aGlzO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgYXJncyA9IHRvQXJyYXkkMyhhcmd1bWVudHMpO1xuXHQgICAgdmFyIHBhY2tldCA9IHtcblx0ICAgICAgdHlwZTogKHRoaXMuZmxhZ3MuYmluYXJ5ICE9PSB1bmRlZmluZWQgPyB0aGlzLmZsYWdzLmJpbmFyeSA6IGhhc0JpbmFyeSQxKGFyZ3MpKSA/IHBhcnNlciQyLkJJTkFSWV9FVkVOVCA6IHBhcnNlciQyLkVWRU5ULFxuXHQgICAgICBkYXRhOiBhcmdzXG5cdCAgICB9O1xuXG5cdCAgICBwYWNrZXQub3B0aW9ucyA9IHt9O1xuXHQgICAgcGFja2V0Lm9wdGlvbnMuY29tcHJlc3MgPSAhdGhpcy5mbGFncyB8fCBmYWxzZSAhPT0gdGhpcy5mbGFncy5jb21wcmVzcztcblxuXHQgICAgLy8gZXZlbnQgYWNrIGNhbGxiYWNrXG5cdCAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSkge1xuXHQgICAgICBkZWJ1ZygnZW1pdHRpbmcgcGFja2V0IHdpdGggYWNrIGlkICVkJywgdGhpcy5pZHMpO1xuXHQgICAgICB0aGlzLmFja3NbdGhpcy5pZHNdID0gYXJncy5wb3AoKTtcblx0ICAgICAgcGFja2V0LmlkID0gdGhpcy5pZHMrKztcblx0ICAgIH1cblxuXHQgICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG5cdCAgICAgIHRoaXMucGFja2V0KHBhY2tldCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0aGlzLnNlbmRCdWZmZXIucHVzaChwYWNrZXQpO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmZsYWdzID0ge307XG5cblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTZW5kcyBhIHBhY2tldC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUucGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgcGFja2V0Lm5zcCA9IHRoaXMubnNwO1xuXHQgICAgdGhpcy5pby5wYWNrZXQocGFja2V0KTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gZW5naW5lIGBvcGVuYC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBkZWJ1ZygndHJhbnNwb3J0IGlzIG9wZW4gLSBjb25uZWN0aW5nJyk7XG5cblx0ICAgIC8vIHdyaXRlIGNvbm5lY3QgcGFja2V0IGlmIG5lY2Vzc2FyeVxuXHQgICAgaWYgKCcvJyAhPT0gdGhpcy5uc3ApIHtcblx0ICAgICAgaWYgKHRoaXMucXVlcnkpIHtcblx0ICAgICAgICB2YXIgcXVlcnkgPSBfdHlwZW9mKHRoaXMucXVlcnkpID09PSAnb2JqZWN0JyA/IHBhcnNlcXMkMi5lbmNvZGUodGhpcy5xdWVyeSkgOiB0aGlzLnF1ZXJ5O1xuXHQgICAgICAgIGRlYnVnKCdzZW5kaW5nIGNvbm5lY3QgcGFja2V0IHdpdGggcXVlcnkgJXMnLCBxdWVyeSk7XG5cdCAgICAgICAgdGhpcy5wYWNrZXQoeyB0eXBlOiBwYXJzZXIkMi5DT05ORUNULCBxdWVyeTogcXVlcnkgfSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdGhpcy5wYWNrZXQoeyB0eXBlOiBwYXJzZXIkMi5DT05ORUNUIH0pO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGVuZ2luZSBgY2xvc2VgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvblxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmNsb3NlID0gZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgICAgZGVidWcoJ2Nsb3NlICglcyknLCByZWFzb24pO1xuXHQgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcblx0ICAgIHRoaXMuZGlzY29ubmVjdGVkID0gdHJ1ZTtcblx0ICAgIGRlbGV0ZSB0aGlzLmlkO1xuXHQgICAgdGhpcy5lbWl0KCdkaXNjb25uZWN0JywgcmVhc29uKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHdpdGggc29ja2V0IHBhY2tldC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25wYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICB2YXIgc2FtZU5hbWVzcGFjZSA9IHBhY2tldC5uc3AgPT09IHRoaXMubnNwO1xuXHQgICAgdmFyIHJvb3ROYW1lc3BhY2VFcnJvciA9IHBhY2tldC50eXBlID09PSBwYXJzZXIkMi5FUlJPUiAmJiBwYWNrZXQubnNwID09PSAnLyc7XG5cblx0ICAgIGlmICghc2FtZU5hbWVzcGFjZSAmJiAhcm9vdE5hbWVzcGFjZUVycm9yKSByZXR1cm47XG5cblx0ICAgIHN3aXRjaCAocGFja2V0LnR5cGUpIHtcblx0ICAgICAgY2FzZSBwYXJzZXIkMi5DT05ORUNUOlxuXHQgICAgICAgIHRoaXMub25jb25uZWN0KCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5FVkVOVDpcblx0ICAgICAgICB0aGlzLm9uZXZlbnQocGFja2V0KTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkJJTkFSWV9FVkVOVDpcblx0ICAgICAgICB0aGlzLm9uZXZlbnQocGFja2V0KTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkFDSzpcblx0ICAgICAgICB0aGlzLm9uYWNrKHBhY2tldCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5CSU5BUllfQUNLOlxuXHQgICAgICAgIHRoaXMub25hY2socGFja2V0KTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkRJU0NPTk5FQ1Q6XG5cdCAgICAgICAgdGhpcy5vbmRpc2Nvbm5lY3QoKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkVSUk9SOlxuXHQgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGEgc2VydmVyIGV2ZW50LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmV2ZW50ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgdmFyIGFyZ3MgPSBwYWNrZXQuZGF0YSB8fCBbXTtcblx0ICAgIGRlYnVnKCdlbWl0dGluZyBldmVudCAlaicsIGFyZ3MpO1xuXG5cdCAgICBpZiAobnVsbCAhPSBwYWNrZXQuaWQpIHtcblx0ICAgICAgZGVidWcoJ2F0dGFjaGluZyBhY2sgY2FsbGJhY2sgdG8gZXZlbnQnKTtcblx0ICAgICAgYXJncy5wdXNoKHRoaXMuYWNrKHBhY2tldC5pZCkpO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgZW1pdC5hcHBseSh0aGlzLCBhcmdzKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRoaXMucmVjZWl2ZUJ1ZmZlci5wdXNoKGFyZ3MpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBQcm9kdWNlcyBhbiBhY2sgY2FsbGJhY2sgdG8gZW1pdCB3aXRoIGFuIGV2ZW50LlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmFjayA9IGZ1bmN0aW9uIChpZCkge1xuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgICAgdmFyIHNlbnQgPSBmYWxzZTtcblx0ICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIC8vIHByZXZlbnQgZG91YmxlIGNhbGxiYWNrc1xuXHQgICAgICBpZiAoc2VudCkgcmV0dXJuO1xuXHQgICAgICBzZW50ID0gdHJ1ZTtcblx0ICAgICAgdmFyIGFyZ3MgPSB0b0FycmF5JDMoYXJndW1lbnRzKTtcblx0ICAgICAgZGVidWcoJ3NlbmRpbmcgYWNrICVqJywgYXJncyk7XG5cblx0ICAgICAgc2VsZi5wYWNrZXQoe1xuXHQgICAgICAgIHR5cGU6IGhhc0JpbmFyeSQxKGFyZ3MpID8gcGFyc2VyJDIuQklOQVJZX0FDSyA6IHBhcnNlciQyLkFDSyxcblx0ICAgICAgICBpZDogaWQsXG5cdCAgICAgICAgZGF0YTogYXJnc1xuXHQgICAgICB9KTtcblx0ICAgIH07XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGEgc2VydmVyIGFja25vd2xlZ2VtZW50LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmFjayA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHZhciBhY2sgPSB0aGlzLmFja3NbcGFja2V0LmlkXTtcblx0ICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgYWNrKSB7XG5cdCAgICAgIGRlYnVnKCdjYWxsaW5nIGFjayAlcyB3aXRoICVqJywgcGFja2V0LmlkLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgIGFjay5hcHBseSh0aGlzLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgIGRlbGV0ZSB0aGlzLmFja3NbcGFja2V0LmlkXTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGRlYnVnKCdiYWQgYWNrICVzJywgcGFja2V0LmlkKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gc2VydmVyIGNvbm5lY3QuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25jb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgdGhpcy5jb25uZWN0ZWQgPSB0cnVlO1xuXHQgICAgdGhpcy5kaXNjb25uZWN0ZWQgPSBmYWxzZTtcblx0ICAgIHRoaXMuZW1pdCgnY29ubmVjdCcpO1xuXHQgICAgdGhpcy5lbWl0QnVmZmVyZWQoKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW1pdCBidWZmZXJlZCBldmVudHMgKHJlY2VpdmVkIGFuZCBlbWl0dGVkKS5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5lbWl0QnVmZmVyZWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB2YXIgaTtcblx0ICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnJlY2VpdmVCdWZmZXIubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgZW1pdC5hcHBseSh0aGlzLCB0aGlzLnJlY2VpdmVCdWZmZXJbaV0pO1xuXHQgICAgfVxuXHQgICAgdGhpcy5yZWNlaXZlQnVmZmVyID0gW107XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnNlbmRCdWZmZXIubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgdGhpcy5wYWNrZXQodGhpcy5zZW5kQnVmZmVyW2ldKTtcblx0ICAgIH1cblx0ICAgIHRoaXMuc2VuZEJ1ZmZlciA9IFtdO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBzZXJ2ZXIgZGlzY29ubmVjdC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBkZWJ1Zygnc2VydmVyIGRpc2Nvbm5lY3QgKCVzKScsIHRoaXMubnNwKTtcblx0ICAgIHRoaXMuZGVzdHJveSgpO1xuXHQgICAgdGhpcy5vbmNsb3NlKCdpbyBzZXJ2ZXIgZGlzY29ubmVjdCcpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBmb3JjZWQgY2xpZW50L3NlcnZlciBzaWRlIGRpc2Nvbm5lY3Rpb25zLFxuXHQgICAqIHRoaXMgbWV0aG9kIGVuc3VyZXMgdGhlIG1hbmFnZXIgc3RvcHMgdHJhY2tpbmcgdXMgYW5kXG5cdCAgICogdGhhdCByZWNvbm5lY3Rpb25zIGRvbid0IGdldCB0cmlnZ2VyZWQgZm9yIHRoaXMuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGUuXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5zdWJzKSB7XG5cdCAgICAgIC8vIGNsZWFuIHN1YnNjcmlwdGlvbnMgdG8gYXZvaWQgcmVjb25uZWN0aW9uc1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3Vicy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIHRoaXMuc3Vic1tpXS5kZXN0cm95KCk7XG5cdCAgICAgIH1cblx0ICAgICAgdGhpcy5zdWJzID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5pby5kZXN0cm95KHRoaXMpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBEaXNjb25uZWN0cyB0aGUgc29ja2V0IG1hbnVhbGx5LlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuY2xvc2UgPSBTb2NrZXQucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgZGVidWcoJ3BlcmZvcm1pbmcgZGlzY29ubmVjdCAoJXMpJywgdGhpcy5uc3ApO1xuXHQgICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IHBhcnNlciQyLkRJU0NPTk5FQ1QgfSk7XG5cdCAgICB9XG5cblx0ICAgIC8vIHJlbW92ZSBzb2NrZXQgZnJvbSBwb29sXG5cdCAgICB0aGlzLmRlc3Ryb3koKTtcblxuXHQgICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG5cdCAgICAgIC8vIGZpcmUgZXZlbnRzXG5cdCAgICAgIHRoaXMub25jbG9zZSgnaW8gY2xpZW50IGRpc2Nvbm5lY3QnKTtcblx0ICAgIH1cblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTZXRzIHRoZSBjb21wcmVzcyBmbGFnLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtCb29sZWFufSBpZiBgdHJ1ZWAsIGNvbXByZXNzZXMgdGhlIHNlbmRpbmcgZGF0YVxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmNvbXByZXNzID0gZnVuY3Rpb24gKGNvbXByZXNzKSB7XG5cdCAgICB0aGlzLmZsYWdzLmNvbXByZXNzID0gY29tcHJlc3M7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogU2V0cyB0aGUgYmluYXJ5IGZsYWdcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7Qm9vbGVhbn0gd2hldGhlciB0aGUgZW1pdHRlZCBkYXRhIGNvbnRhaW5zIGJpbmFyeVxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmJpbmFyeSA9IGZ1bmN0aW9uIChiaW5hcnkpIHtcblx0ICAgIHRoaXMuZmxhZ3MuYmluYXJ5ID0gYmluYXJ5O1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblx0fSk7XG5cblx0dmFyIHNvY2tldCQzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHNvY2tldCQyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogc29ja2V0JDJcblx0fSk7XG5cblx0LyoqXG5cdCAqIEV4cG9zZSBgQmFja29mZmAuXG5cdCAqL1xuXG5cdHZhciBiYWNrbzIgPSBCYWNrb2ZmO1xuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIGJhY2tvZmYgdGltZXIgd2l0aCBgb3B0c2AuXG5cdCAqXG5cdCAqIC0gYG1pbmAgaW5pdGlhbCB0aW1lb3V0IGluIG1pbGxpc2Vjb25kcyBbMTAwXVxuXHQgKiAtIGBtYXhgIG1heCB0aW1lb3V0IFsxMDAwMF1cblx0ICogLSBgaml0dGVyYCBbMF1cblx0ICogLSBgZmFjdG9yYCBbMl1cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdHNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gQmFja29mZihvcHRzKSB7XG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cdCAgdGhpcy5tcyA9IG9wdHMubWluIHx8IDEwMDtcblx0ICB0aGlzLm1heCA9IG9wdHMubWF4IHx8IDEwMDAwO1xuXHQgIHRoaXMuZmFjdG9yID0gb3B0cy5mYWN0b3IgfHwgMjtcblx0ICB0aGlzLmppdHRlciA9IG9wdHMuaml0dGVyID4gMCAmJiBvcHRzLmppdHRlciA8PSAxID8gb3B0cy5qaXR0ZXIgOiAwO1xuXHQgIHRoaXMuYXR0ZW1wdHMgPSAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgYmFja29mZiBkdXJhdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7TnVtYmVyfVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5kdXJhdGlvbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgbXMgPSB0aGlzLm1zICogTWF0aC5wb3codGhpcy5mYWN0b3IsIHRoaXMuYXR0ZW1wdHMrKyk7XG5cdCAgaWYgKHRoaXMuaml0dGVyKSB7XG5cdCAgICB2YXIgcmFuZCA9IE1hdGgucmFuZG9tKCk7XG5cdCAgICB2YXIgZGV2aWF0aW9uID0gTWF0aC5mbG9vcihyYW5kICogdGhpcy5qaXR0ZXIgKiBtcyk7XG5cdCAgICBtcyA9IChNYXRoLmZsb29yKHJhbmQgKiAxMCkgJiAxKSA9PSAwID8gbXMgLSBkZXZpYXRpb24gOiBtcyArIGRldmlhdGlvbjtcblx0ICB9XG5cdCAgcmV0dXJuIE1hdGgubWluKG1zLCB0aGlzLm1heCkgfCAwO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0aGUgbnVtYmVyIG9mIGF0dGVtcHRzLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmF0dGVtcHRzID0gMDtcblx0fTtcblxuXHQvKipcblx0ICogU2V0IHRoZSBtaW5pbXVtIGR1cmF0aW9uXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnNldE1pbiA9IGZ1bmN0aW9uIChtaW4pIHtcblx0ICB0aGlzLm1zID0gbWluO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIG1heGltdW0gZHVyYXRpb25cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUuc2V0TWF4ID0gZnVuY3Rpb24gKG1heCkge1xuXHQgIHRoaXMubWF4ID0gbWF4O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIGppdHRlclxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5zZXRKaXR0ZXIgPSBmdW5jdGlvbiAoaml0dGVyKSB7XG5cdCAgdGhpcy5qaXR0ZXIgPSBqaXR0ZXI7XG5cdH07XG5cblx0dmFyIGJhY2tvMiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJhY2tvMixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJhY2tvMlxuXHR9KTtcblxuXHR2YXIgZWlvID0gKCBsaWIkMSAmJiBsaWIgKSB8fCBsaWIkMTtcblxuXHR2YXIgU29ja2V0JDEgPSAoIHNvY2tldCQzICYmIHNvY2tldCQyICkgfHwgc29ja2V0JDM7XG5cblx0dmFyIEJhY2tvZmYkMSA9ICggYmFja28yJDEgJiYgYmFja28yICkgfHwgYmFja28yJDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQ3ID0gcmVxdWlyZSQkMCQyKCdzb2NrZXQuaW8tY2xpZW50Om1hbmFnZXInKTtcblxuXHQvKipcblx0ICogSUU2KyBoYXNPd25Qcm9wZXJ0eVxuXHQgKi9cblxuXHR2YXIgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHNcblx0ICovXG5cblx0dmFyIG1hbmFnZXIgPSBNYW5hZ2VyO1xuXG5cdC8qKlxuXHQgKiBgTWFuYWdlcmAgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBlbmdpbmUgaW5zdGFuY2Ugb3IgZW5naW5lIHVyaS9vcHRzXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIE1hbmFnZXIodXJpLCBvcHRzKSB7XG5cdCAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE1hbmFnZXIpKSByZXR1cm4gbmV3IE1hbmFnZXIodXJpLCBvcHRzKTtcblx0ICBpZiAodXJpICYmICdvYmplY3QnID09PSAodHlwZW9mIHVyaSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodXJpKSkpIHtcblx0ICAgIG9wdHMgPSB1cmk7XG5cdCAgICB1cmkgPSB1bmRlZmluZWQ7XG5cdCAgfVxuXHQgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdCAgb3B0cy5wYXRoID0gb3B0cy5wYXRoIHx8ICcvc29ja2V0LmlvJztcblx0ICB0aGlzLm5zcHMgPSB7fTtcblx0ICB0aGlzLnN1YnMgPSBbXTtcblx0ICB0aGlzLm9wdHMgPSBvcHRzO1xuXHQgIHRoaXMucmVjb25uZWN0aW9uKG9wdHMucmVjb25uZWN0aW9uICE9PSBmYWxzZSk7XG5cdCAgdGhpcy5yZWNvbm5lY3Rpb25BdHRlbXB0cyhvcHRzLnJlY29ubmVjdGlvbkF0dGVtcHRzIHx8IEluZmluaXR5KTtcblx0ICB0aGlzLnJlY29ubmVjdGlvbkRlbGF5KG9wdHMucmVjb25uZWN0aW9uRGVsYXkgfHwgMTAwMCk7XG5cdCAgdGhpcy5yZWNvbm5lY3Rpb25EZWxheU1heChvcHRzLnJlY29ubmVjdGlvbkRlbGF5TWF4IHx8IDUwMDApO1xuXHQgIHRoaXMucmFuZG9taXphdGlvbkZhY3RvcihvcHRzLnJhbmRvbWl6YXRpb25GYWN0b3IgfHwgMC41KTtcblx0ICB0aGlzLmJhY2tvZmYgPSBuZXcgQmFja29mZiQxKHtcblx0ICAgIG1pbjogdGhpcy5yZWNvbm5lY3Rpb25EZWxheSgpLFxuXHQgICAgbWF4OiB0aGlzLnJlY29ubmVjdGlvbkRlbGF5TWF4KCksXG5cdCAgICBqaXR0ZXI6IHRoaXMucmFuZG9taXphdGlvbkZhY3RvcigpXG5cdCAgfSk7XG5cdCAgdGhpcy50aW1lb3V0KG51bGwgPT0gb3B0cy50aW1lb3V0ID8gMjAwMDAgOiBvcHRzLnRpbWVvdXQpO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXHQgIHRoaXMudXJpID0gdXJpO1xuXHQgIHRoaXMuY29ubmVjdGluZyA9IFtdO1xuXHQgIHRoaXMubGFzdFBpbmcgPSBudWxsO1xuXHQgIHRoaXMuZW5jb2RpbmcgPSBmYWxzZTtcblx0ICB0aGlzLnBhY2tldEJ1ZmZlciA9IFtdO1xuXHQgIHZhciBfcGFyc2VyID0gb3B0cy5wYXJzZXIgfHwgcGFyc2VyJDI7XG5cdCAgdGhpcy5lbmNvZGVyID0gbmV3IF9wYXJzZXIuRW5jb2RlcigpO1xuXHQgIHRoaXMuZGVjb2RlciA9IG5ldyBfcGFyc2VyLkRlY29kZXIoKTtcblx0ICB0aGlzLmF1dG9Db25uZWN0ID0gb3B0cy5hdXRvQ29ubmVjdCAhPT0gZmFsc2U7XG5cdCAgaWYgKHRoaXMuYXV0b0Nvbm5lY3QpIHRoaXMub3BlbigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb3BhZ2F0ZSBnaXZlbiBldmVudCB0byBzb2NrZXRzIGFuZCBlbWl0IG9uIGB0aGlzYFxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuZW1pdEFsbCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmVtaXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0ICBmb3IgKHZhciBuc3AgaW4gdGhpcy5uc3BzKSB7XG5cdCAgICBpZiAoaGFzLmNhbGwodGhpcy5uc3BzLCBuc3ApKSB7XG5cdCAgICAgIHRoaXMubnNwc1tuc3BdLmVtaXQuYXBwbHkodGhpcy5uc3BzW25zcF0sIGFyZ3VtZW50cyk7XG5cdCAgICB9XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBVcGRhdGUgYHNvY2tldC5pZGAgb2YgYWxsIHNvY2tldHNcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnVwZGF0ZVNvY2tldElkcyA9IGZ1bmN0aW9uICgpIHtcblx0ICBmb3IgKHZhciBuc3AgaW4gdGhpcy5uc3BzKSB7XG5cdCAgICBpZiAoaGFzLmNhbGwodGhpcy5uc3BzLCBuc3ApKSB7XG5cdCAgICAgIHRoaXMubnNwc1tuc3BdLmlkID0gdGhpcy5nZW5lcmF0ZUlkKG5zcCk7XG5cdCAgICB9XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBnZW5lcmF0ZSBgc29ja2V0LmlkYCBmb3IgdGhlIGdpdmVuIGBuc3BgXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuc3Bcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuZ2VuZXJhdGVJZCA9IGZ1bmN0aW9uIChuc3ApIHtcblx0ICByZXR1cm4gKG5zcCA9PT0gJy8nID8gJycgOiBuc3AgKyAnIycpICsgdGhpcy5lbmdpbmUuaWQ7XG5cdH07XG5cblx0LyoqXG5cdCAqIE1peCBpbiBgRW1pdHRlcmAuXG5cdCAqL1xuXG5cdEVtaXR0ZXIoTWFuYWdlci5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBgcmVjb25uZWN0aW9uYCBjb25maWcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gdHJ1ZS9mYWxzZSBpZiBpdCBzaG91bGQgYXV0b21hdGljYWxseSByZWNvbm5lY3Rcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yZWNvbm5lY3Rpb24gPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbjtcblx0ICB0aGlzLl9yZWNvbm5lY3Rpb24gPSAhIXY7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHJlY29ubmVjdGlvbiBhdHRlbXB0cyBjb25maWcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBtYXggcmVjb25uZWN0aW9uIGF0dGVtcHRzIGJlZm9yZSBnaXZpbmcgdXBcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yZWNvbm5lY3Rpb25BdHRlbXB0cyA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uQXR0ZW1wdHM7XG5cdCAgdGhpcy5fcmVjb25uZWN0aW9uQXR0ZW1wdHMgPSB2O1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBkZWxheSBiZXR3ZWVuIHJlY29ubmVjdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbkRlbGF5ID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheTtcblx0ICB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheSA9IHY7XG5cdCAgdGhpcy5iYWNrb2ZmICYmIHRoaXMuYmFja29mZi5zZXRNaW4odik7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0TWFuYWdlci5wcm90b3R5cGUucmFuZG9taXphdGlvbkZhY3RvciA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmFuZG9taXphdGlvbkZhY3Rvcjtcblx0ICB0aGlzLl9yYW5kb21pemF0aW9uRmFjdG9yID0gdjtcblx0ICB0aGlzLmJhY2tvZmYgJiYgdGhpcy5iYWNrb2ZmLnNldEppdHRlcih2KTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgbWF4aW11bSBkZWxheSBiZXR3ZWVuIHJlY29ubmVjdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheVxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbkRlbGF5TWF4ID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheU1heDtcblx0ICB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheU1heCA9IHY7XG5cdCAgdGhpcy5iYWNrb2ZmICYmIHRoaXMuYmFja29mZi5zZXRNYXgodik7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGNvbm5lY3Rpb24gdGltZW91dC4gYGZhbHNlYCB0byBkaXNhYmxlXG5cdCAqXG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUudGltZW91dCA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fdGltZW91dDtcblx0ICB0aGlzLl90aW1lb3V0ID0gdjtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU3RhcnRzIHRyeWluZyB0byByZWNvbm5lY3QgaWYgcmVjb25uZWN0aW9uIGlzIGVuYWJsZWQgYW5kIHdlIGhhdmUgbm90XG5cdCAqIHN0YXJ0ZWQgcmVjb25uZWN0aW5nIHlldFxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUubWF5YmVSZWNvbm5lY3RPbk9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgLy8gT25seSB0cnkgdG8gcmVjb25uZWN0IGlmIGl0J3MgdGhlIGZpcnN0IHRpbWUgd2UncmUgY29ubmVjdGluZ1xuXHQgIGlmICghdGhpcy5yZWNvbm5lY3RpbmcgJiYgdGhpcy5fcmVjb25uZWN0aW9uICYmIHRoaXMuYmFja29mZi5hdHRlbXB0cyA9PT0gMCkge1xuXHQgICAgLy8ga2VlcHMgcmVjb25uZWN0aW9uIGZyb20gZmlyaW5nIHR3aWNlIGZvciB0aGUgc2FtZSByZWNvbm5lY3Rpb24gbG9vcFxuXHQgICAgdGhpcy5yZWNvbm5lY3QoKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGN1cnJlbnQgdHJhbnNwb3J0IGBzb2NrZXRgLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25hbCwgY2FsbGJhY2tcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vcGVuID0gTWFuYWdlci5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uIChmbiwgb3B0cykge1xuXHQgIGRlYnVnJDcoJ3JlYWR5U3RhdGUgJXMnLCB0aGlzLnJlYWR5U3RhdGUpO1xuXHQgIGlmICh+dGhpcy5yZWFkeVN0YXRlLmluZGV4T2YoJ29wZW4nKSkgcmV0dXJuIHRoaXM7XG5cblx0ICBkZWJ1ZyQ3KCdvcGVuaW5nICVzJywgdGhpcy51cmkpO1xuXHQgIHRoaXMuZW5naW5lID0gZWlvKHRoaXMudXJpLCB0aGlzLm9wdHMpO1xuXHQgIHZhciBzb2NrZXQgPSB0aGlzLmVuZ2luZTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW5pbmcnO1xuXHQgIHRoaXMuc2tpcFJlY29ubmVjdCA9IGZhbHNlO1xuXG5cdCAgLy8gZW1pdCBgb3BlbmBcblx0ICB2YXIgb3BlblN1YiA9IG9uJDIoc29ja2V0LCAnb3BlbicsIGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25vcGVuKCk7XG5cdCAgICBmbiAmJiBmbigpO1xuXHQgIH0pO1xuXG5cdCAgLy8gZW1pdCBgY29ubmVjdF9lcnJvcmBcblx0ICB2YXIgZXJyb3JTdWIgPSBvbiQyKHNvY2tldCwgJ2Vycm9yJywgZnVuY3Rpb24gKGRhdGEpIHtcblx0ICAgIGRlYnVnJDcoJ2Nvbm5lY3RfZXJyb3InKTtcblx0ICAgIHNlbGYuY2xlYW51cCgpO1xuXHQgICAgc2VsZi5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgICBzZWxmLmVtaXRBbGwoJ2Nvbm5lY3RfZXJyb3InLCBkYXRhKTtcblx0ICAgIGlmIChmbikge1xuXHQgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdDb25uZWN0aW9uIGVycm9yJyk7XG5cdCAgICAgIGVyci5kYXRhID0gZGF0YTtcblx0ICAgICAgZm4oZXJyKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIC8vIE9ubHkgZG8gdGhpcyBpZiB0aGVyZSBpcyBubyBmbiB0byBoYW5kbGUgdGhlIGVycm9yXG5cdCAgICAgIHNlbGYubWF5YmVSZWNvbm5lY3RPbk9wZW4oKTtcblx0ICAgIH1cblx0ICB9KTtcblxuXHQgIC8vIGVtaXQgYGNvbm5lY3RfdGltZW91dGBcblx0ICBpZiAoZmFsc2UgIT09IHRoaXMuX3RpbWVvdXQpIHtcblx0ICAgIHZhciB0aW1lb3V0ID0gdGhpcy5fdGltZW91dDtcblx0ICAgIGRlYnVnJDcoJ2Nvbm5lY3QgYXR0ZW1wdCB3aWxsIHRpbWVvdXQgYWZ0ZXIgJWQnLCB0aW1lb3V0KTtcblxuXHQgICAgLy8gc2V0IHRpbWVyXG5cdCAgICB2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgZGVidWckNygnY29ubmVjdCBhdHRlbXB0IHRpbWVkIG91dCBhZnRlciAlZCcsIHRpbWVvdXQpO1xuXHQgICAgICBvcGVuU3ViLmRlc3Ryb3koKTtcblx0ICAgICAgc29ja2V0LmNsb3NlKCk7XG5cdCAgICAgIHNvY2tldC5lbWl0KCdlcnJvcicsICd0aW1lb3V0Jyk7XG5cdCAgICAgIHNlbGYuZW1pdEFsbCgnY29ubmVjdF90aW1lb3V0JywgdGltZW91dCk7XG5cdCAgICB9LCB0aW1lb3V0KTtcblxuXHQgICAgdGhpcy5zdWJzLnB1c2goe1xuXHQgICAgICBkZXN0cm95OiBmdW5jdGlvbiBkZXN0cm95KCkge1xuXHQgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG5cdCAgICAgIH1cblx0ICAgIH0pO1xuXHQgIH1cblxuXHQgIHRoaXMuc3Vicy5wdXNoKG9wZW5TdWIpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKGVycm9yU3ViKTtcblxuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiB0cmFuc3BvcnQgb3Blbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ3KCdvcGVuJyk7XG5cblx0ICAvLyBjbGVhciBvbGQgc3Vic1xuXHQgIHRoaXMuY2xlYW51cCgpO1xuXG5cdCAgLy8gbWFyayBhcyBvcGVuXG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW4nO1xuXHQgIHRoaXMuZW1pdCgnb3BlbicpO1xuXG5cdCAgLy8gYWRkIG5ldyBzdWJzXG5cdCAgdmFyIHNvY2tldCA9IHRoaXMuZW5naW5lO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAnZGF0YScsIGJpbmQodGhpcywgJ29uZGF0YScpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdwaW5nJywgYmluZCh0aGlzLCAnb25waW5nJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ3BvbmcnLCBiaW5kKHRoaXMsICdvbnBvbmcnKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAnZXJyb3InLCBiaW5kKHRoaXMsICdvbmVycm9yJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ2Nsb3NlJywgYmluZCh0aGlzLCAnb25jbG9zZScpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMih0aGlzLmRlY29kZXIsICdkZWNvZGVkJywgYmluZCh0aGlzLCAnb25kZWNvZGVkJykpKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gYSBwaW5nLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25waW5nID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMubGFzdFBpbmcgPSBuZXcgRGF0ZSgpO1xuXHQgIHRoaXMuZW1pdEFsbCgncGluZycpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBhIHBhY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9ucG9uZyA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmVtaXRBbGwoJ3BvbmcnLCBuZXcgRGF0ZSgpIC0gdGhpcy5sYXN0UGluZyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aXRoIGRhdGEuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHRoaXMuZGVjb2Rlci5hZGQoZGF0YSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aGVuIHBhcnNlciBmdWxseSBkZWNvZGVzIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25kZWNvZGVkID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIHRoaXMuZW1pdCgncGFja2V0JywgcGFja2V0KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gc29ja2V0IGVycm9yLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25lcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblx0ICBkZWJ1ZyQ3KCdlcnJvcicsIGVycik7XG5cdCAgdGhpcy5lbWl0QWxsKCdlcnJvcicsIGVycik7XG5cdH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgc29ja2V0IGZvciB0aGUgZ2l2ZW4gYG5zcGAuXG5cdCAqXG5cdCAqIEByZXR1cm4ge1NvY2tldH1cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuc29ja2V0ID0gZnVuY3Rpb24gKG5zcCwgb3B0cykge1xuXHQgIHZhciBzb2NrZXQgPSB0aGlzLm5zcHNbbnNwXTtcblx0ICBpZiAoIXNvY2tldCkge1xuXHQgICAgc29ja2V0ID0gbmV3IFNvY2tldCQxKHRoaXMsIG5zcCwgb3B0cyk7XG5cdCAgICB0aGlzLm5zcHNbbnNwXSA9IHNvY2tldDtcblx0ICAgIHZhciBzZWxmID0gdGhpcztcblx0ICAgIHNvY2tldC5vbignY29ubmVjdGluZycsIG9uQ29ubmVjdGluZyk7XG5cdCAgICBzb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHNvY2tldC5pZCA9IHNlbGYuZ2VuZXJhdGVJZChuc3ApO1xuXHQgICAgfSk7XG5cblx0ICAgIGlmICh0aGlzLmF1dG9Db25uZWN0KSB7XG5cdCAgICAgIC8vIG1hbnVhbGx5IGNhbGwgaGVyZSBzaW5jZSBjb25uZWN0aW5nIGV2ZW50IGlzIGZpcmVkIGJlZm9yZSBsaXN0ZW5pbmdcblx0ICAgICAgb25Db25uZWN0aW5nKCk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gb25Db25uZWN0aW5nKCkge1xuXHQgICAgaWYgKCF+aW5kZXgoc2VsZi5jb25uZWN0aW5nLCBzb2NrZXQpKSB7XG5cdCAgICAgIHNlbGYuY29ubmVjdGluZy5wdXNoKHNvY2tldCk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHNvY2tldDtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gYSBzb2NrZXQgY2xvc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U29ja2V0fSBzb2NrZXRcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIChzb2NrZXQpIHtcblx0ICB2YXIgaW5kZXgkJDEgPSBpbmRleCh0aGlzLmNvbm5lY3RpbmcsIHNvY2tldCk7XG5cdCAgaWYgKH5pbmRleCQkMSkgdGhpcy5jb25uZWN0aW5nLnNwbGljZShpbmRleCQkMSwgMSk7XG5cdCAgaWYgKHRoaXMuY29ubmVjdGluZy5sZW5ndGgpIHJldHVybjtcblxuXHQgIHRoaXMuY2xvc2UoKTtcblx0fTtcblxuXHQvKipcblx0ICogV3JpdGVzIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5wYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgZGVidWckNygnd3JpdGluZyBwYWNrZXQgJWonLCBwYWNrZXQpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBpZiAocGFja2V0LnF1ZXJ5ICYmIHBhY2tldC50eXBlID09PSAwKSBwYWNrZXQubnNwICs9ICc/JyArIHBhY2tldC5xdWVyeTtcblxuXHQgIGlmICghc2VsZi5lbmNvZGluZykge1xuXHQgICAgLy8gZW5jb2RlLCB0aGVuIHdyaXRlIHRvIGVuZ2luZSB3aXRoIHJlc3VsdFxuXHQgICAgc2VsZi5lbmNvZGluZyA9IHRydWU7XG5cdCAgICB0aGlzLmVuY29kZXIuZW5jb2RlKHBhY2tldCwgZnVuY3Rpb24gKGVuY29kZWRQYWNrZXRzKSB7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW5jb2RlZFBhY2tldHMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBzZWxmLmVuZ2luZS53cml0ZShlbmNvZGVkUGFja2V0c1tpXSwgcGFja2V0Lm9wdGlvbnMpO1xuXHQgICAgICB9XG5cdCAgICAgIHNlbGYuZW5jb2RpbmcgPSBmYWxzZTtcblx0ICAgICAgc2VsZi5wcm9jZXNzUGFja2V0UXVldWUoKTtcblx0ICAgIH0pO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAvLyBhZGQgcGFja2V0IHRvIHRoZSBxdWV1ZVxuXHQgICAgc2VsZi5wYWNrZXRCdWZmZXIucHVzaChwYWNrZXQpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogSWYgcGFja2V0IGJ1ZmZlciBpcyBub24tZW1wdHksIGJlZ2lucyBlbmNvZGluZyB0aGVcblx0ICogbmV4dCBwYWNrZXQgaW4gbGluZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnByb2Nlc3NQYWNrZXRRdWV1ZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodGhpcy5wYWNrZXRCdWZmZXIubGVuZ3RoID4gMCAmJiAhdGhpcy5lbmNvZGluZykge1xuXHQgICAgdmFyIHBhY2sgPSB0aGlzLnBhY2tldEJ1ZmZlci5zaGlmdCgpO1xuXHQgICAgdGhpcy5wYWNrZXQocGFjayk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbGVhbiB1cCB0cmFuc3BvcnQgc3Vic2NyaXB0aW9ucyBhbmQgcGFja2V0IGJ1ZmZlci5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLmNsZWFudXAgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNygnY2xlYW51cCcpO1xuXG5cdCAgdmFyIHN1YnNMZW5ndGggPSB0aGlzLnN1YnMubGVuZ3RoO1xuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic0xlbmd0aDsgaSsrKSB7XG5cdCAgICB2YXIgc3ViID0gdGhpcy5zdWJzLnNoaWZ0KCk7XG5cdCAgICBzdWIuZGVzdHJveSgpO1xuXHQgIH1cblxuXHQgIHRoaXMucGFja2V0QnVmZmVyID0gW107XG5cdCAgdGhpcy5lbmNvZGluZyA9IGZhbHNlO1xuXHQgIHRoaXMubGFzdFBpbmcgPSBudWxsO1xuXG5cdCAgdGhpcy5kZWNvZGVyLmRlc3Ryb3koKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2xvc2UgdGhlIGN1cnJlbnQgc29ja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuY2xvc2UgPSBNYW5hZ2VyLnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDcoJ2Rpc2Nvbm5lY3QnKTtcblx0ICB0aGlzLnNraXBSZWNvbm5lY3QgPSB0cnVlO1xuXHQgIHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2U7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICAvLyBgb25jbG9zZWAgd2lsbCBub3QgZmlyZSBiZWNhdXNlXG5cdCAgICAvLyBhbiBvcGVuIGV2ZW50IG5ldmVyIGhhcHBlbmVkXG5cdCAgICB0aGlzLmNsZWFudXAoKTtcblx0ICB9XG5cdCAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgaWYgKHRoaXMuZW5naW5lKSB0aGlzLmVuZ2luZS5jbG9zZSgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBlbmdpbmUgY2xvc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmNsb3NlID0gZnVuY3Rpb24gKHJlYXNvbikge1xuXHQgIGRlYnVnJDcoJ29uY2xvc2UnKTtcblxuXHQgIHRoaXMuY2xlYW51cCgpO1xuXHQgIHRoaXMuYmFja29mZi5yZXNldCgpO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXHQgIHRoaXMuZW1pdCgnY2xvc2UnLCByZWFzb24pO1xuXG5cdCAgaWYgKHRoaXMuX3JlY29ubmVjdGlvbiAmJiAhdGhpcy5za2lwUmVjb25uZWN0KSB7XG5cdCAgICB0aGlzLnJlY29ubmVjdCgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQXR0ZW1wdCBhIHJlY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodGhpcy5yZWNvbm5lY3RpbmcgfHwgdGhpcy5za2lwUmVjb25uZWN0KSByZXR1cm4gdGhpcztcblxuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGlmICh0aGlzLmJhY2tvZmYuYXR0ZW1wdHMgPj0gdGhpcy5fcmVjb25uZWN0aW9uQXR0ZW1wdHMpIHtcblx0ICAgIGRlYnVnJDcoJ3JlY29ubmVjdCBmYWlsZWQnKTtcblx0ICAgIHRoaXMuYmFja29mZi5yZXNldCgpO1xuXHQgICAgdGhpcy5lbWl0QWxsKCdyZWNvbm5lY3RfZmFpbGVkJyk7XG5cdCAgICB0aGlzLnJlY29ubmVjdGluZyA9IGZhbHNlO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB2YXIgZGVsYXkgPSB0aGlzLmJhY2tvZmYuZHVyYXRpb24oKTtcblx0ICAgIGRlYnVnJDcoJ3dpbGwgd2FpdCAlZG1zIGJlZm9yZSByZWNvbm5lY3QgYXR0ZW1wdCcsIGRlbGF5KTtcblxuXHQgICAgdGhpcy5yZWNvbm5lY3RpbmcgPSB0cnVlO1xuXHQgICAgdmFyIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmIChzZWxmLnNraXBSZWNvbm5lY3QpIHJldHVybjtcblxuXHQgICAgICBkZWJ1ZyQ3KCdhdHRlbXB0aW5nIHJlY29ubmVjdCcpO1xuXHQgICAgICBzZWxmLmVtaXRBbGwoJ3JlY29ubmVjdF9hdHRlbXB0Jywgc2VsZi5iYWNrb2ZmLmF0dGVtcHRzKTtcblx0ICAgICAgc2VsZi5lbWl0QWxsKCdyZWNvbm5lY3RpbmcnLCBzZWxmLmJhY2tvZmYuYXR0ZW1wdHMpO1xuXG5cdCAgICAgIC8vIGNoZWNrIGFnYWluIGZvciB0aGUgY2FzZSBzb2NrZXQgY2xvc2VkIGluIGFib3ZlIGV2ZW50c1xuXHQgICAgICBpZiAoc2VsZi5za2lwUmVjb25uZWN0KSByZXR1cm47XG5cblx0ICAgICAgc2VsZi5vcGVuKGZ1bmN0aW9uIChlcnIpIHtcblx0ICAgICAgICBpZiAoZXJyKSB7XG5cdCAgICAgICAgICBkZWJ1ZyQ3KCdyZWNvbm5lY3QgYXR0ZW1wdCBlcnJvcicpO1xuXHQgICAgICAgICAgc2VsZi5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICAgICAgICAgIHNlbGYucmVjb25uZWN0KCk7XG5cdCAgICAgICAgICBzZWxmLmVtaXRBbGwoJ3JlY29ubmVjdF9lcnJvcicsIGVyci5kYXRhKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgZGVidWckNygncmVjb25uZWN0IHN1Y2Nlc3MnKTtcblx0ICAgICAgICAgIHNlbGYub25yZWNvbm5lY3QoKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfSwgZGVsYXkpO1xuXG5cdCAgICB0aGlzLnN1YnMucHVzaCh7XG5cdCAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBzdWNjZXNzZnVsIHJlY29ubmVjdC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9ucmVjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBhdHRlbXB0ID0gdGhpcy5iYWNrb2ZmLmF0dGVtcHRzO1xuXHQgIHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2U7XG5cdCAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgdGhpcy51cGRhdGVTb2NrZXRJZHMoKTtcblx0ICB0aGlzLmVtaXRBbGwoJ3JlY29ubmVjdCcsIGF0dGVtcHQpO1xuXHR9O1xuXG5cdHZhciBtYW5hZ2VyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogbWFuYWdlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IG1hbmFnZXJcblx0fSk7XG5cblx0dmFyIHVybCQyID0gKCB1cmwkMSAmJiB1cmxfMSApIHx8IHVybCQxO1xuXG5cdHZhciBNYW5hZ2VyJDEgPSAoIG1hbmFnZXIkMSAmJiBtYW5hZ2VyICkgfHwgbWFuYWdlciQxO1xuXG5cdHZhciBsaWIkMiA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIGRlYnVnID0gcmVxdWlyZSQkMCQyKCdzb2NrZXQuaW8tY2xpZW50Jyk7XG5cblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICAgKi9cblxuXHQgIG1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IGxvb2t1cDtcblxuXHQgIC8qKlxuXHQgICAqIE1hbmFnZXJzIGNhY2hlLlxuXHQgICAqL1xuXG5cdCAgdmFyIGNhY2hlID0gZXhwb3J0cy5tYW5hZ2VycyA9IHt9O1xuXG5cdCAgLyoqXG5cdCAgICogTG9va3MgdXAgYW4gZXhpc3RpbmcgYE1hbmFnZXJgIGZvciBtdWx0aXBsZXhpbmcuXG5cdCAgICogSWYgdGhlIHVzZXIgc3VtbW9uczpcblx0ICAgKlxuXHQgICAqICAgYGlvKCdodHRwOi8vbG9jYWxob3N0L2EnKTtgXG5cdCAgICogICBgaW8oJ2h0dHA6Ly9sb2NhbGhvc3QvYicpO2Bcblx0ICAgKlxuXHQgICAqIFdlIHJldXNlIHRoZSBleGlzdGluZyBpbnN0YW5jZSBiYXNlZCBvbiBzYW1lIHNjaGVtZS9wb3J0L2hvc3QsXG5cdCAgICogYW5kIHdlIGluaXRpYWxpemUgc29ja2V0cyBmb3IgZWFjaCBuYW1lc3BhY2UuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9va3VwKHVyaSwgb3B0cykge1xuXHQgICAgaWYgKCh0eXBlb2YgdXJpID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih1cmkpKSA9PT0gJ29iamVjdCcpIHtcblx0ICAgICAgb3B0cyA9IHVyaTtcblx0ICAgICAgdXJpID0gdW5kZWZpbmVkO1xuXHQgICAgfVxuXG5cdCAgICBvcHRzID0gb3B0cyB8fCB7fTtcblxuXHQgICAgdmFyIHBhcnNlZCA9IHVybCQyKHVyaSk7XG5cdCAgICB2YXIgc291cmNlID0gcGFyc2VkLnNvdXJjZTtcblx0ICAgIHZhciBpZCA9IHBhcnNlZC5pZDtcblx0ICAgIHZhciBwYXRoID0gcGFyc2VkLnBhdGg7XG5cdCAgICB2YXIgc2FtZU5hbWVzcGFjZSA9IGNhY2hlW2lkXSAmJiBwYXRoIGluIGNhY2hlW2lkXS5uc3BzO1xuXHQgICAgdmFyIG5ld0Nvbm5lY3Rpb24gPSBvcHRzLmZvcmNlTmV3IHx8IG9wdHNbJ2ZvcmNlIG5ldyBjb25uZWN0aW9uJ10gfHwgZmFsc2UgPT09IG9wdHMubXVsdGlwbGV4IHx8IHNhbWVOYW1lc3BhY2U7XG5cblx0ICAgIHZhciBpbztcblxuXHQgICAgaWYgKG5ld0Nvbm5lY3Rpb24pIHtcblx0ICAgICAgZGVidWcoJ2lnbm9yaW5nIHNvY2tldCBjYWNoZSBmb3IgJXMnLCBzb3VyY2UpO1xuXHQgICAgICBpbyA9IE1hbmFnZXIkMShzb3VyY2UsIG9wdHMpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgaWYgKCFjYWNoZVtpZF0pIHtcblx0ICAgICAgICBkZWJ1ZygnbmV3IGlvIGluc3RhbmNlIGZvciAlcycsIHNvdXJjZSk7XG5cdCAgICAgICAgY2FjaGVbaWRdID0gTWFuYWdlciQxKHNvdXJjZSwgb3B0cyk7XG5cdCAgICAgIH1cblx0ICAgICAgaW8gPSBjYWNoZVtpZF07XG5cdCAgICB9XG5cdCAgICBpZiAocGFyc2VkLnF1ZXJ5ICYmICFvcHRzLnF1ZXJ5KSB7XG5cdCAgICAgIG9wdHMucXVlcnkgPSBwYXJzZWQucXVlcnk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gaW8uc29ja2V0KHBhcnNlZC5wYXRoLCBvcHRzKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBQcm90b2NvbCB2ZXJzaW9uLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMucHJvdG9jb2wgPSBwYXJzZXIkMi5wcm90b2NvbDtcblxuXHQgIC8qKlxuXHQgICAqIGBjb25uZWN0YC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSB1cmlcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5jb25uZWN0ID0gbG9va3VwO1xuXG5cdCAgLyoqXG5cdCAgICogRXhwb3NlIGNvbnN0cnVjdG9ycyBmb3Igc3RhbmRhbG9uZSBidWlsZC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLk1hbmFnZXIgPSBNYW5hZ2VyJDE7XG5cdCAgZXhwb3J0cy5Tb2NrZXQgPSBTb2NrZXQkMTtcblx0fSk7XG5cdHZhciBsaWJfMSA9IGxpYiQyLm1hbmFnZXJzO1xuXHR2YXIgbGliXzIgPSBsaWIkMi5wcm90b2NvbDtcblx0dmFyIGxpYl8zID0gbGliJDIuY29ubmVjdDtcblx0dmFyIGxpYl80ID0gbGliJDIuTWFuYWdlcjtcblx0dmFyIGxpYl81ID0gbGliJDIuU29ja2V0O1xuXG5cdGZ1bmN0aW9uIGV4dGVuZChZKSB7XG5cdCAgICB2YXIgQ29ubmVjdG9yID0gZnVuY3Rpb24gKF9ZJEFic3RyYWN0Q29ubmVjdG9yKSB7XG5cdCAgICAgICAgaW5oZXJpdHMoQ29ubmVjdG9yLCBfWSRBYnN0cmFjdENvbm5lY3Rvcik7XG5cblx0ICAgICAgICBmdW5jdGlvbiBDb25uZWN0b3IoeSwgb3B0aW9ucykge1xuXHQgICAgICAgICAgICBjbGFzc0NhbGxDaGVjayh0aGlzLCBDb25uZWN0b3IpO1xuXG5cdCAgICAgICAgICAgIGlmIChvcHRpb25zID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignT3B0aW9ucyBtdXN0IG5vdCBiZSB1bmRlZmluZWQhJyk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgb3B0aW9ucy5wcmVmZXJVbnRyYW5zZm9ybWVkID0gdHJ1ZTtcblx0ICAgICAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZVVzZXJJZCA9IG9wdGlvbnMuZ2VuZXJhdGVVc2VySWQgfHwgZmFsc2U7XG5cdCAgICAgICAgICAgIGlmIChvcHRpb25zLmluaXRTeW5jICE9PSBmYWxzZSkge1xuXHQgICAgICAgICAgICAgICAgb3B0aW9ucy5pbml0U3luYyA9IHRydWU7XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICB2YXIgX3RoaXMgPSBwb3NzaWJsZUNvbnN0cnVjdG9yUmV0dXJuKHRoaXMsIChDb25uZWN0b3IuX19wcm90b19fIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZihDb25uZWN0b3IpKS5jYWxsKHRoaXMsIHksIG9wdGlvbnMpKTtcblxuXHQgICAgICAgICAgICBfdGhpcy5fc2VudFN5bmMgPSBmYWxzZTtcblx0ICAgICAgICAgICAgX3RoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdCAgICAgICAgICAgIG9wdGlvbnMudXJsID0gb3B0aW9ucy51cmwgfHwgJ2h0dHBzOi8veWpzLmRiaXMucnd0aC1hYWNoZW4uZGU6NTA3Mic7XG5cdCAgICAgICAgICAgIHZhciBzb2NrZXQgPSBvcHRpb25zLnNvY2tldCB8fCBsaWIkMihvcHRpb25zLnVybCwgb3B0aW9ucy5vcHRpb25zKTtcblx0ICAgICAgICAgICAgX3RoaXMuc29ja2V0ID0gc29ja2V0O1xuXHQgICAgICAgICAgICB2YXIgc2VsZiA9IF90aGlzO1xuXG5cdCAgICAgICAgICAgIC8qKioqKioqKioqKioqKioqKiogc3RhcnQgbWluaW1hbCB3ZWJydGMgKioqKioqKioqKioqKioqKioqKioqKi9cblx0ICAgICAgICAgICAgdmFyIHNpZ25hbGluZ19zb2NrZXQgPSBzb2NrZXQ7XG5cdCAgICAgICAgICAgIHZhciBJQ0VfU0VSVkVSUyA9IFt7IHVybHM6IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwiIH0sIHsgdXJsczogXCJ0dXJuOnRyeS5yZWZhY3RvcmVkLmFpOjM0NzhcIiwgdXNlcm5hbWU6IFwidGVzdDk5XCIsIGNyZWRlbnRpYWw6IFwidGVzdFwiIH1dO1xuXHQgICAgICAgICAgICB2YXIgZGNzID0ge307XG5cdCAgICAgICAgICAgIF90aGlzLmRjcyA9IGRjcztcblx0ICAgICAgICAgICAgX3RoaXMuc2RjcyA9IGRjcztcblx0ICAgICAgICAgICAgdmFyIHBlZXJzID0ge307XG5cdCAgICAgICAgICAgIHZhciBwZWVyX21lZGlhX2VsZW1lbnRzID0ge307XG5cdCAgICAgICAgICAgIHZhciBzb2NrZXRzO1xuXHQgICAgICAgICAgICBfdGhpcy5zb2NrZXRzID0gc29ja2V0cztcblxuXHQgICAgICAgICAgICBmdW5jdGlvbiByZWNlaXZlRGF0YSh5d2VicnRjLCBwZWVyX2lkKSB7XG5cdCAgICAgICAgICAgICAgICB2YXIgYnVmLCBjb3VudDtcblx0ICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBvbm1lc3NhZ2UoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGV2ZW50LmRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHBhcnNlSW50KGV2ZW50LmRhdGEpKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgY291bnQgPSAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuZGF0YSk7XG5cdCAgICAgICAgICAgICAgICAgICAgYnVmLnNldChkYXRhLCBjb3VudCk7XG5cdCAgICAgICAgICAgICAgICAgICAgY291bnQgKz0gZGF0YS5ieXRlTGVuZ3RoO1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA9PT0gYnVmLmJ5dGVMZW5ndGgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlTWVzc2FnZShwZWVyX2lkLCBidWYpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH07XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBmdW5jdGlvbiBpbml0KHl3ZWJydGMpIHtcblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgam9pbl9jaGF0X2NoYW5uZWwoeXdlYnJ0Yy5vcHRpb25zLnJvb20sIHsgJ3doYXRldmVyLXlvdS13YW50LWhlcmUnOiAnc3R1ZmYnIH0pO1xuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3NvY2tldHMnLCBmdW5jdGlvbiAoc29ja2V0cykge1xuXHQgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zb2NrZXRzID0gc29ja2V0cztcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgIC8qIFRlYXIgZG93biBhbGwgb2Ygb3VyIHBlZXIgY29ubmVjdGlvbnMgYW5kIHJlbW92ZSBhbGwgdGhlXG5cdCAgICAgICAgICAgICAgICAgICAgICogbWVkaWEgZGl2cyB3aGVuIHdlIGRpc2Nvbm5lY3QgKi9cblx0ICAgICAgICAgICAgICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcl9tZWRpYV9lbGVtZW50cykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzW3BlZXJfaWRdLnJlbW92ZSgpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcnMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0uY2xvc2UoKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVycyA9IHt9O1xuXHQgICAgICAgICAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHMgPSB7fTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBmdW5jdGlvbiBqb2luX2NoYXRfY2hhbm5lbChjaGFubmVsLCB1c2VyZGF0YSkge1xuXHQgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgnam9pbicsIHsgXCJjaGFubmVsXCI6IGNoYW5uZWwsIFwidXNlcmRhdGFcIjogdXNlcmRhdGEgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy51c2VySUQgPSBzaWduYWxpbmdfc29ja2V0LmlkO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdhZGRQZWVyJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cblx0ICAgICAgICAgICAgICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVycykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAvKiBUaGlzIGNvdWxkIGhhcHBlbiBpZiB0aGUgdXNlciBqb2lucyBtdWx0aXBsZSBjaGFubmVscyB3aGVyZSB0aGUgb3RoZXIgcGVlciBpcyBhbHNvIGluLiAqL1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXJfY29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbih7IFwiaWNlU2VydmVyc1wiOiBJQ0VfU0VSVkVSUyB9KTtcblx0ICAgICAgICAgICAgICAgICAgICBwZWVyc1twZWVyX2lkXSA9IHBlZXJfY29ubmVjdGlvbjtcblxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhQ2hhbm5lbCA9IHBlZXJfY29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgnZGF0YScpO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBzeW5jRGF0YUNoYW5uZWwgPSBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoJ3N5bmNfZGF0YScpO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgICAgICAgICAgc3luY0RhdGFDaGFubmVsLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5kY3NbcGVlcl9pZF0gPSBkYXRhQ2hhbm5lbDtcblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnNkY3NbcGVlcl9pZF0gPSBzeW5jRGF0YUNoYW5uZWw7XG5cblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnVzZXJKb2luZWQocGVlcl9pZCwgJ21hc3RlcicpO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gcmVjZWl2ZURhdGEoeXdlYnJ0YywgcGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgc3luY0RhdGFDaGFubmVsLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZWJ1ZmZlcihwZWVyX2lkLCBlLmRhdGEpO1xuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LmNhbmRpZGF0ZSkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheUlDRUNhbmRpZGF0ZScsIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncGVlcl9pZCc6IHBlZXJfaWQsXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2ljZV9jYW5kaWRhdGUnOiB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzZHBNTGluZUluZGV4JzogZXZlbnQuY2FuZGlkYXRlLnNkcE1MaW5lSW5kZXgsXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjYW5kaWRhdGUnOiBldmVudC5jYW5kaWRhdGUuY2FuZGlkYXRlXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5zaG91bGRfY3JlYXRlX29mZmVyKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5jcmVhdGVPZmZlcihmdW5jdGlvbiAobG9jYWxfZGVzY3JpcHRpb24pIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheVNlc3Npb25EZXNjcmlwdGlvbicsIHsgJ3BlZXJfaWQnOiBwZWVyX2lkLCAnc2Vzc2lvbl9kZXNjcmlwdGlvbic6IGxvY2FsX2Rlc2NyaXB0aW9uIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsZXJ0KFwiT2ZmZXIgc2V0TG9jYWxEZXNjcmlwdGlvbiBmYWlsZWQhXCIpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBzZW5kaW5nIG9mZmVyOiBcIiwgZXJyb3IpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgLyoqIFxuXHQgICAgICAgICAgICAgICAgICogUGVlcnMgZXhjaGFuZ2Ugc2Vzc2lvbiBkZXNjcmlwdGlvbnMgd2hpY2ggY29udGFpbnMgaW5mb3JtYXRpb25cblx0ICAgICAgICAgICAgICAgICAqIGFib3V0IHRoZWlyIGF1ZGlvIC8gdmlkZW8gc2V0dGluZ3MgYW5kIHRoYXQgc29ydCBvZiBzdHVmZi4gRmlyc3Rcblx0ICAgICAgICAgICAgICAgICAqIHRoZSAnb2ZmZXJlcicgc2VuZHMgYSBkZXNjcmlwdGlvbiB0byB0aGUgJ2Fuc3dlcmVyJyAod2l0aCB0eXBlXG5cdCAgICAgICAgICAgICAgICAgKiBcIm9mZmVyXCIpLCB0aGVuIHRoZSBhbnN3ZXJlciBzZW5kcyBvbmUgYmFjayAod2l0aCB0eXBlIFwiYW5zd2VyXCIpLiAgXG5cdCAgICAgICAgICAgICAgICAgKi9cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3Nlc3Npb25EZXNjcmlwdGlvbicsIGZ1bmN0aW9uIChjb25maWcpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyID0gcGVlcnNbcGVlcl9pZF07XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVyLm9uZGF0YWNoYW5uZWwgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGFDaGFubmVsID0gZXZlbnQuY2hhbm5lbDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhQ2hhbm5lbC5sYWJlbCA9PSAnc3luY19kYXRhJykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gcmVjZWl2ZURhdGEoeXdlYnJ0YywgcGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZWJ1ZmZlcihwZWVyX2lkLCBlLmRhdGEpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlX2Rlc2NyaXB0aW9uID0gY29uZmlnLnNlc3Npb25fZGVzY3JpcHRpb247XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgZGVzYyA9IG5ldyBSVENTZXNzaW9uRGVzY3JpcHRpb24ocmVtb3RlX2Rlc2NyaXB0aW9uKTtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgc3R1ZmYgPSBwZWVyLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2MsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW90ZV9kZXNjcmlwdGlvbi50eXBlID09IFwib2ZmZXJcIikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlci5jcmVhdGVBbnN3ZXIoZnVuY3Rpb24gKGxvY2FsX2Rlc2NyaXB0aW9uKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlci5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlTZXNzaW9uRGVzY3JpcHRpb24nLCB7ICdwZWVyX2lkJzogcGVlcl9pZCwgJ3Nlc3Npb25fZGVzY3JpcHRpb24nOiBsb2NhbF9kZXNjcmlwdGlvbiB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsZXJ0KFwiQW5zd2VyIHNldExvY2FsRGVzY3JpcHRpb24gZmFpbGVkIVwiKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3IgY3JlYXRpbmcgYW5zd2VyOiBcIiwgZXJyb3IpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZXRSZW1vdGVEZXNjcmlwdGlvbiBlcnJvcjogXCIsIGVycm9yKTtcblx0ICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdpY2VDYW5kaWRhdGUnLCBmdW5jdGlvbiAoY29uZmlnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXIgPSBwZWVyc1tjb25maWcucGVlcl9pZF07XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGljZV9jYW5kaWRhdGUgPSBjb25maWcuaWNlX2NhbmRpZGF0ZTtcblx0ICAgICAgICAgICAgICAgICAgICBwZWVyLmFkZEljZUNhbmRpZGF0ZShuZXcgUlRDSWNlQ2FuZGlkYXRlKGljZV9jYW5kaWRhdGUpKTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdyZW1vdmVQZWVyJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy51c2VyTGVmdChwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVyX21lZGlhX2VsZW1lbnRzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHNbcGVlcl9pZF0ucmVtb3ZlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdLmNsb3NlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHBlZXJzW3BlZXJfaWRdO1xuXHQgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBwZWVyX21lZGlhX2VsZW1lbnRzW2NvbmZpZy5wZWVyX2lkXTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIGluaXQoc2VsZik7XG5cdCAgICAgICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKiogZW5kIG1pbmltYWxfd2VicnRjICoqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cdCAgICAgICAgICAgIHJldHVybiBfdGhpcztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBjcmVhdGVDbGFzcyhDb25uZWN0b3IsIFt7XG5cdCAgICAgICAgICAgIGtleTogJ2Rpc2Nvbm5lY3QnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZGlzY29ubmVjdCgpIHt9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdkZXN0cm95Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7fVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAncmVjb25uZWN0Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHJlY29ubmVjdCgpIHt9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdzZW5kJyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHNlbmQodWlkLCBtZXNzYWdlKSB7XG5cdCAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnJCQkJCQkJCQkJCQkJCQkJCBzeW5jaW5nLi4uLi4uICQkJCQkJCQkJCQkJCQkJCQkJyk7XG5cdCAgICAgICAgICAgICAgICBmdW5jdGlvbiBzZW5kMihkYXRhQ2hhbm5lbCwgZGF0YTIpIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YUNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBDSFVOS19MRU4gPSA2NDAwMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxlbiA9IGRhdGEyLmJ5dGVMZW5ndGg7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gbGVuIC8gQ0hVTktfTEVOIHwgMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChsZW4pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAvLyBzcGxpdCB0aGUgcGhvdG8gYW5kIHNlbmQgaW4gY2h1bmtzIG9mIGFib3V0IDY0S0Jcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdGFydCA9IGkgKiBDSFVOS19MRU4sXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kID0gKGkgKyAxKSAqIENIVU5LX0xFTjtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQoZGF0YTIuc3ViYXJyYXkoc3RhcnQsIGVuZCkpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgdGhlIHJlbWluZGVyLCBpZiBhbnlcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbiAlIENIVU5LX0xFTikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShuICogQ0hVTktfTEVOKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHNlbmQyLCA1MDAsIGRhdGFDaGFubmVsLCBkYXRhMik7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgc2VuZDIodGhpcy5zZGNzW3VpZF0sIG5ldyBVaW50OEFycmF5KG1lc3NhZ2UpKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAnYnJvYWRjYXN0Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGJyb2FkY2FzdChtZXNzYWdlKSB7XG5cdCAgICAgICAgICAgICAgICBmb3IgKHZhciBwZWVyX2lkIGluIHRoaXMuZGNzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHNlbmQyID0gZnVuY3Rpb24gc2VuZDIoZGF0YUNoYW5uZWwsIGRhdGEyKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhQ2hhbm5lbC5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBDSFVOS19MRU4gPSA2NDAwMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhMi5ieXRlTGVuZ3RoO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG4gPSBsZW4gLyBDSFVOS19MRU4gfCAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChsZW4pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BsaXQgdGhlIHBob3RvIGFuZCBzZW5kIGluIGNodW5rcyBvZiBhYm91dCA2NEtCXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdGFydCA9IGkgKiBDSFVOS19MRU4sXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZCA9IChpICsgMSkgKiBDSFVOS19MRU47XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShzdGFydCwgZW5kKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIHRoZSByZW1pbmRlciwgaWYgYW55XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVuICUgQ0hVTktfTEVOKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShuICogQ0hVTktfTEVOKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnInLCBwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICBzZW5kMih0aGlzLmRjc1twZWVyX2lkXSwgbmV3IFVpbnQ4QXJyYXkobWVzc2FnZSkpO1xuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdpc0Rpc2Nvbm5lY3RlZCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBpc0Rpc2Nvbm5lY3RlZCgpIHtcblx0ICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnNvY2tldC5kaXNjb25uZWN0ZWQ7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICB9XSk7XG5cdCAgICAgICAgcmV0dXJuIENvbm5lY3Rvcjtcblx0ICAgIH0oWS5BYnN0cmFjdENvbm5lY3Rvcik7XG5cblx0ICAgIENvbm5lY3Rvci5pbyA9IGxpYiQyO1xuXHQgICAgWVsnd2VicnRjJ10gPSBDb25uZWN0b3I7XG5cdH1cblxuXHRpZiAodHlwZW9mIFkgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICBleHRlbmQoWSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0fVxuXG5cdHJldHVybiBleHRlbmQ7XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD15LXdlYnJ0Yy5qcy5tYXBcbiIsIi8qKlxuICogeWpzIC0gQSBmcmFtZXdvcmsgZm9yIHJlYWwtdGltZSBwMnAgc2hhcmVkIGVkaXRpbmcgb24gYW55IGRhdGFcbiAqIEB2ZXJzaW9uIHYxMy4wLjAtNjJcbiAqIEBsaWNlbnNlIE1JVFxuICovXG4hZnVuY3Rpb24odCxlKXtcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZT9tb2R1bGUuZXhwb3J0cz1lKCk6XCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShlKTp0Llk9ZSgpfSh0aGlzLGZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gdCh0LGUsbixyKXtpZihudWxsPT09ZSl0LnJvb3Q9bixuLl9wYXJlbnQ9bnVsbDtlbHNlIGlmKGUubGVmdD09PXIpZS5sZWZ0PW47ZWxzZXtpZihlLnJpZ2h0IT09cil0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZWxlbWVudHMgYXJlIHdyb25nbHkgY29ubmVjdGVkIVwiKTtlLnJpZ2h0PW59fWZ1bmN0aW9uIGUodCxlKXt2YXIgbj1lLl9pZDtpZih2b2lkIDA9PT1uKWUuX2ludGVncmF0ZSh0KTtlbHNle2lmKHQuc3MuZ2V0U3RhdGUobi51c2VyKT5uLmNsb2NrKXJldHVybjshdC5nY0VuYWJsZWR8fGUuY29uc3RydWN0b3I9PT1MdHx8ZS5fcGFyZW50LmNvbnN0cnVjdG9yIT09THQmJiExPT09ZS5fcGFyZW50Ll9kZWxldGVkP2UuX2ludGVncmF0ZSh0KTplLl9nYyh0KTt2YXIgcj10Ll9taXNzaW5nU3RydWN0cy5nZXQobi51c2VyKTtpZihudWxsIT1yKWZvcih2YXIgaT1uLmNsb2NrLG89aStlLl9sZW5ndGg7aTxvO2krKyl7dmFyIGE9ci5nZXQoaSk7dm9pZCAwIT09YSYmKGEuZm9yRWFjaChmdW5jdGlvbihlKXtpZigwPT09LS1lLm1pc3Npbmcpe3ZhciBuPWUuZGVjb2RlcixyPW4ucG9zLGk9ZS5zdHJ1Y3QuX2Zyb21CaW5hcnkodCxuKTtuLnBvcz1yLDA9PT1pLmxlbmd0aCYmdC5fcmVhZHlUb0ludGVncmF0ZS5wdXNoKGUuc3RydWN0KX19KSxyLmRlbGV0ZShpKSl9fX1mdW5jdGlvbiBuKHQsZSxuKXtmb3IodmFyIHI9ZS5yZWFkVWludDMyKCksaT0wO2k8cjtpKyspe3ZhciBvPWUucmVhZFZhclVpbnQoKSxhPXEobykscz1uZXcgYSxsPXMuX2Zyb21CaW5hcnkodCxlKSx1PVwiICBcIitzLl9sb2dTdHJpbmcoKTtsLmxlbmd0aD4wJiYodSs9XCIgLi4gbWlzc2luZzogXCIrbC5tYXAocCkuam9pbihcIiwgXCIpKSxuLnB1c2godSl9fWZ1bmN0aW9uIHIodCxuKXtmb3IodmFyIHI9bi5yZWFkVWludDMyKCksaT0wO2k8cjtpKyspe3ZhciBvPW4ucmVhZFZhclVpbnQoKSxhPXEobykscz1uZXcgYSxsPW4ucG9zLHU9cy5fZnJvbUJpbmFyeSh0LG4pO2lmKDA9PT11Lmxlbmd0aClmb3IoO251bGwhPXM7KWUodCxzKSxzPXQuX3JlYWR5VG9JbnRlZ3JhdGUuc2hpZnQoKTtlbHNle3ZhciBjPW5ldyBWdChuLnVpbnQ4YXJyKTtjLnBvcz1sO2Zvcih2YXIgaD1uZXcgTXQoYyx1LHMpLGY9dC5fbWlzc2luZ1N0cnVjdHMsZD11Lmxlbmd0aC0xO2Q+PTA7ZC0tKXt2YXIgXz11W2RdO2YuaGFzKF8udXNlcil8fGYuc2V0KF8udXNlcixuZXcgTWFwKTt2YXIgdj1mLmdldChfLnVzZXIpO3YuaGFzKF8uY2xvY2spfHx2LnNldChfLmNsb2NrLFtdKTsodj12LmdldChfLmNsb2NrKSkucHVzaChoKX19fX1mdW5jdGlvbiBpKHQpe2Zvcih2YXIgZT1uZXcgTWFwLG49dC5yZWFkVWludDMyKCkscj0wO3I8bjtyKyspe3ZhciBpPXQucmVhZFZhclVpbnQoKSxvPXQucmVhZFZhclVpbnQoKTtlLnNldChpLG8pfXJldHVybiBlfWZ1bmN0aW9uIG8odCxlKXt2YXIgbj1lLnBvcyxyPTA7ZS53cml0ZVVpbnQzMigwKTt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD10LnNzLnN0YXRlW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PXh0KHMudmFsdWUsMiksYz11WzBdLGg9dVsxXTtlLndyaXRlVmFyVWludChjKSxlLndyaXRlVmFyVWludChoKSxyKyt9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19ZS5zZXRVaW50MzIobixyKX1mdW5jdGlvbiBhKHQsZSl7dmFyIG49bnVsbCxyPXZvaWQgMCxpPXZvaWQgMCxvPTAsYT1lLnBvcztlLndyaXRlVWludDMyKDApLHQuZHMuaXRlcmF0ZShudWxsLG51bGwsZnVuY3Rpb24odCl7dmFyIGE9dC5faWQudXNlcixzPXQuX2lkLmNsb2NrLGw9dC5sZW4sdT10LmdjO24hPT1hJiYobysrLG51bGwhPT1uJiZlLnNldFVpbnQzMihpLHIpLG49YSxlLndyaXRlVmFyVWludChhKSxpPWUucG9zLGUud3JpdGVVaW50MzIoMCkscj0wKSxlLndyaXRlVmFyVWludChzKSxlLndyaXRlVmFyVWludChsKSxlLndyaXRlVWludDgodT8xOjApLHIrK30pLG51bGwhPT1uJiZlLnNldFVpbnQzMihpLHIpLGUuc2V0VWludDMyKGEsbyl9ZnVuY3Rpb24gcyh0LGUpe2Zvcih2YXIgbj1lLnJlYWRVaW50MzIoKSxyPTA7cjxuO3IrKykhZnVuY3Rpb24obil7Zm9yKHZhciByPWUucmVhZFZhclVpbnQoKSxpPVtdLG89ZS5yZWFkVWludDMyKCksYT0wO2E8bzthKyspe3ZhciBzPWUucmVhZFZhclVpbnQoKSxsPWUucmVhZFZhclVpbnQoKSx1PTE9PT1lLnJlYWRVaW50OCgpO2kucHVzaChbcyxsLHVdKX1pZihvPjApe3ZhciBjPTAsaD1pW2NdLGY9W107dC5kcy5pdGVyYXRlKG5ldyBQdChyLDApLG5ldyBQdChyLE51bWJlci5NQVhfVkFMVUUpLGZ1bmN0aW9uKHQpe2Zvcig7bnVsbCE9aDspe3ZhciBlPTA7aWYodC5faWQuY2xvY2srdC5sZW48PWhbMF0pYnJlYWs7aFswXTx0Ll9pZC5jbG9jaz8oZT1NYXRoLm1pbih0Ll9pZC5jbG9jay1oWzBdLGhbMV0pLGYucHVzaChbcixoWzBdLGVdKSk6KGU9dC5faWQuY2xvY2srdC5sZW4taFswXSxoWzJdJiYhdC5nYyYmZi5wdXNoKFtyLGhbMF0sTWF0aC5taW4oZSxoWzFdKV0pKSxoWzFdPD1lP2g9aVsrK2NdOihoWzBdPWhbMF0rZSxoWzFdPWhbMV0tZSl9fSk7Zm9yKHZhciBkPWYubGVuZ3RoLTE7ZD49MDtkLS0pe3ZhciBfPWZbZF07Zyh0LF9bMF0sX1sxXSxfWzJdLCEwKX1mb3IoO2M8aS5sZW5ndGg7YysrKWg9aVtjXSxnKHQscixoWzBdLGhbMV0sITApfX0oKX1mdW5jdGlvbiBsKHQsZSxuKXt2YXIgcj1lLnJlYWRWYXJTdHJpbmcoKSxpPWUucmVhZFZhclVpbnQoKTtuLnB1c2goJyAgLSBhdXRoOiBcIicrcisnXCInKSxuLnB1c2goXCIgIC0gcHJvdG9jb2xWZXJzaW9uOiBcIitpKTtmb3IodmFyIG89W10sYT1lLnJlYWRVaW50MzIoKSxzPTA7czxhO3MrKyl7dmFyIGw9ZS5yZWFkVmFyVWludCgpLHU9ZS5yZWFkVmFyVWludCgpO28ucHVzaChcIihcIitsK1wiOlwiK3UrXCIpXCIpfW4ucHVzaChcIiAgPT0gU1M6IFwiK28uam9pbihcIixcIikpfWZ1bmN0aW9uIHUodCxlKXt2YXIgbj1uZXcgQ3Q7bi53cml0ZVZhclN0cmluZyh0Lnkucm9vbSksbi53cml0ZVZhclN0cmluZyhcInN5bmMgc3RlcCAxXCIpLG4ud3JpdGVWYXJTdHJpbmcodC5hdXRoSW5mb3x8XCJcIiksbi53cml0ZVZhclVpbnQodC5wcm90b2NvbFZlcnNpb24pLG8odC55LG4pLHQuc2VuZChlLG4uY3JlYXRlQnVmZmVyKCkpfWZ1bmN0aW9uIGModCxlLG4pe3ZhciByPWUucG9zO2Uud3JpdGVVaW50MzIoMCk7dmFyIGk9MCxvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PXQuc3Muc3RhdGUua2V5cygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPWwudmFsdWUsaD1uLmdldChjKXx8MDtpZihjIT09cXQpe3ZhciBmPW5ldyBQdChjLGgpLGQ9dC5vcy5maW5kUHJldihmKSxfPW51bGw9PT1kP251bGw6ZC5faWQ7aWYobnVsbCE9PV8mJl8udXNlcj09PWMmJl8uY2xvY2srZC5fbGVuZ3RoPmgpe2QuX2Nsb25lUGFydGlhbChoLV8uY2xvY2spLl90b0JpbmFyeShlKSxpKyt9dC5vcy5pdGVyYXRlKGYsbmV3IFB0KGMsTnVtYmVyLk1BWF9WQUxVRSksZnVuY3Rpb24odCl7dC5fdG9CaW5hcnkoZSksaSsrfSl9fX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fWUuc2V0VWludDMyKHIsaSl9ZnVuY3Rpb24gaCh0LGUsbixyLG8pe3ZhciBzPXQucmVhZFZhclVpbnQoKTtzIT09bi5jb25uZWN0b3IucHJvdG9jb2xWZXJzaW9uJiYoY29uc29sZS53YXJuKFwiWW91IHRyaWVkIHRvIHN5bmMgd2l0aCBhIFlqcyBpbnN0YW5jZSB0aGF0IGhhcyBhIGRpZmZlcmVudCBwcm90b2NvbCB2ZXJzaW9uXFxuICAgICAgKFlvdTogXCIrcytcIiwgQ2xpZW50OiBcIitzK1wiKS5cXG4gICAgICBcIiksbi5kZXN0cm95KCkpLGUud3JpdGVWYXJTdHJpbmcoXCJzeW5jIHN0ZXAgMlwiKSxlLndyaXRlVmFyU3RyaW5nKG4uY29ubmVjdG9yLmF1dGhJbmZvfHxcIlwiKSxjKG4sZSxpKHQpKSxhKG4sZSksbi5jb25uZWN0b3Iuc2VuZChyLnVpZCxlLmNyZWF0ZUJ1ZmZlcigpKSxyLnJlY2VpdmVkU3luY1N0ZXAyPSEwLFwic2xhdmVcIj09PW4uY29ubmVjdG9yLnJvbGUmJnUobi5jb25uZWN0b3Isbyl9ZnVuY3Rpb24gZih0LGUscil7ci5wdXNoKFwiICAgICAtIGF1dGg6IFwiK2UucmVhZFZhclN0cmluZygpKSxyLnB1c2goXCIgID09IE9TOlwiKSxuKHQsZSxyKSxyLnB1c2goXCIgID09IERTOlwiKTtmb3IodmFyIGk9ZS5yZWFkVWludDMyKCksbz0wO288aTtvKyspe3ZhciBhPWUucmVhZFZhclVpbnQoKTtyLnB1c2goXCIgICAgVXNlcjogXCIrYStcIjogXCIpO2Zvcih2YXIgcz1lLnJlYWRVaW50MzIoKSxsPTA7bDxzO2wrKyl7dmFyIHU9ZS5yZWFkVmFyVWludCgpLGM9ZS5yZWFkVmFyVWludCgpLGg9MT09PWUucmVhZFVpbnQ4KCk7ci5wdXNoKFwiW1wiK3UrXCIsIFwiK2MrXCIsIFwiK2grXCJdXCIpfX19ZnVuY3Rpb24gZCh0LGUsbixpLG8pe3Iobix0KSxzKG4sdCksbi5jb25uZWN0b3IuX3NldFN5bmNlZFdpdGgobyl9ZnVuY3Rpb24gXyh0KXt2YXIgZT14dCh0LDIpLHI9ZVswXSxpPWVbMV0sbz1uZXcgVnQoaSk7by5yZWFkVmFyU3RyaW5nKCk7dmFyIGE9by5yZWFkVmFyU3RyaW5nKCkscz1bXTtyZXR1cm4gcy5wdXNoKFwiXFxuID09PSBcIithK1wiID09PVwiKSxcInVwZGF0ZVwiPT09YT9uKHIsbyxzKTpcInN5bmMgc3RlcCAxXCI9PT1hP2wocixvLHMpOlwic3luYyBzdGVwIDJcIj09PWE/ZihyLG8scyk6cy5wdXNoKFwiLS0gVW5rbm93biBtZXNzYWdlIHR5cGUgLSBwcm9iYWJseSBhbiBlbmNvZGluZyBpc3N1ZSEhIVwiKSxzLmpvaW4oXCJcXG5cIil9ZnVuY3Rpb24gdih0KXt2YXIgZT1uZXcgVnQodCk7cmV0dXJuIGUucmVhZFZhclN0cmluZygpLGUucmVhZFZhclN0cmluZygpfWZ1bmN0aW9uIHAodCl7aWYobnVsbCE9PXQmJm51bGwhPXQuX2lkJiYodD10Ll9pZCksbnVsbD09PXQpcmV0dXJuXCIoKVwiO2lmKHQgaW5zdGFuY2VvZiBQdClyZXR1cm5cIihcIit0LnVzZXIrXCIsXCIrdC5jbG9jaytcIilcIjtpZih0IGluc3RhbmNlb2YgJHQpcmV0dXJuXCIoXCIrdC5uYW1lK1wiLFwiK3QudHlwZStcIilcIjtpZih0LmNvbnN0cnVjdG9yPT09WSlyZXR1cm5cInlcIjt0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGlzIG5vdCBhIHZhbGlkIElEIVwiKX1mdW5jdGlvbiB5KHQsZSxuKXt2YXIgcj1udWxsIT09ZS5fbGVmdD9lLl9sZWZ0Ll9sYXN0SWQ6bnVsbCxpPW51bGwhPT1lLl9vcmlnaW4/ZS5fb3JpZ2luLl9sYXN0SWQ6bnVsbDtyZXR1cm4gdCtcIihpZDpcIitwKGUuX2lkKStcIixsZWZ0OlwiK3AocikrXCIsb3JpZ2luOlwiK3AoaSkrXCIscmlnaHQ6XCIrcChlLl9yaWdodCkrXCIscGFyZW50OlwiK3AoZS5fcGFyZW50KStcIixwYXJlbnRTdWI6XCIrZS5fcGFyZW50U3ViKyh2b2lkIDAhPT1uP1wiIC0gXCIrbjpcIlwiKStcIilcIn1mdW5jdGlvbiBnKHQsZSxuLHIsaSl7dmFyIG89bnVsbCE9PXQuY29ubmVjdG9yJiZ0LmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzLGE9dC5vcy5nZXRJdGVtQ2xlYW5TdGFydChuZXcgUHQoZSxuKSk7aWYobnVsbCE9PWEpe2EuX2RlbGV0ZWR8fChhLl9zcGxpdEF0KHQsciksYS5fZGVsZXRlKHQsbywhMCkpO3ZhciBzPWEuX2xlbmd0aDtpZihyLT1zLG4rPXMscj4wKWZvcih2YXIgbD10Lm9zLmZpbmROb2RlKG5ldyBQdChlLG4pKTtudWxsIT09bCYmbnVsbCE9PWwudmFsJiZyPjAmJmwudmFsLl9pZC5lcXVhbHMobmV3IFB0KGUsbikpOyl7dmFyIHU9bC52YWw7dS5fZGVsZXRlZHx8KHUuX3NwbGl0QXQodCxyKSx1Ll9kZWxldGUodCxvLGkpKTt2YXIgYz11Ll9sZW5ndGg7ci09YyxuKz1jLGw9bC5uZXh0KCl9fX1mdW5jdGlvbiBtKHQsZSxuKXtpZihlIT09dCYmIWUuX2RlbGV0ZWQmJiF0Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5oYXMoZSkpe3ZhciByPXQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcyxpPXIuZ2V0KGUpO3ZvaWQgMD09PWkmJihpPW5ldyBTZXQsci5zZXQoZSxpKSksaS5hZGQobil9fWZ1bmN0aW9uIGsodCxlLG4scil7dmFyIGk9ZS5faWQ7bi5faWQ9bmV3IFB0KGkudXNlcixpLmNsb2NrK3IpLG4uX29yaWdpbj1lLG4uX2xlZnQ9ZSxuLl9yaWdodD1lLl9yaWdodCxudWxsIT09bi5fcmlnaHQmJihuLl9yaWdodC5fbGVmdD1uKSxuLl9yaWdodF9vcmlnaW49ZS5fcmlnaHRfb3JpZ2luLGUuX3JpZ2h0PW4sbi5fcGFyZW50PWUuX3BhcmVudCxuLl9wYXJlbnRTdWI9ZS5fcGFyZW50U3ViLG4uX2RlbGV0ZWQ9ZS5fZGVsZXRlZDt2YXIgbz1uZXcgU2V0O28uYWRkKGUpO2Zvcih2YXIgYT1uLl9yaWdodDtudWxsIT09YSYmby5oYXMoYS5fb3JpZ2luKTspYS5fb3JpZ2luPT09ZSYmKGEuX29yaWdpbj1uKSxvLmFkZChhKSxhPWEuX3JpZ2h0O3Qub3MucHV0KG4pLHQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKT90Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5hZGQobik6dC5fdHJhbnNhY3Rpb24uZGVsZXRlZFN0cnVjdHMuaGFzKGUpJiZ0Ll90cmFuc2FjdGlvbi5kZWxldGVkU3RydWN0cy5hZGQobil9ZnVuY3Rpb24gYih0LGUpe3ZhciBuPXZvaWQgMDtkb3tuPWUuX3JpZ2h0LGUuX3JpZ2h0PW51bGwsZS5fcmlnaHRfb3JpZ2luPW51bGwsZS5fb3JpZ2luPWUuX2xlZnQsZS5faW50ZWdyYXRlKHQpLGU9bn13aGlsZShudWxsIT09bil9ZnVuY3Rpb24gdyh0LGUpe2Zvcig7bnVsbCE9PWU7KWUuX2RlbGV0ZSh0LCExLCEwKSxlLl9nYyh0KSxlPWUuX3JpZ2h0fWZ1bmN0aW9uIFModCxlLG4scixpKXt0Ll9vcmlnaW49cix0Ll9sZWZ0PXIsdC5fcmlnaHQ9aSx0Ll9yaWdodF9vcmlnaW49aSx0Ll9wYXJlbnQ9ZSxudWxsIT09bj90Ll9pbnRlZ3JhdGUobik6bnVsbD09PXI/ZS5fc3RhcnQ9dDpyLl9yaWdodD10fWZ1bmN0aW9uIE8odCxlLG4scixpKXtmb3IoO251bGwhPT1yJiZpPjA7KXtzd2l0Y2goci5jb25zdHJ1Y3Rvcil7Y2FzZSBIdDpjYXNlIEl0ZW1TdHJpbmc6aWYoaTw9KHIuX2RlbGV0ZWQ/MDpyLl9sZW5ndGgtMSkpcmV0dXJuIHI9ci5fc3BsaXRBdChlLl95LGkpLG49ci5fbGVmdCxbbixyLHRdOyExPT09ci5fZGVsZXRlZCYmKGktPXIuX2xlbmd0aCk7YnJlYWs7Y2FzZSBKdDohMT09PXIuX2RlbGV0ZWQmJkIodCxyKX1uPXIscj1yLl9yaWdodH1yZXR1cm5bbixyLHRdfWZ1bmN0aW9uIEUodCxlKXtyZXR1cm4gTyhuZXcgTWFwLHQsbnVsbCx0Ll9zdGFydCxlKX1mdW5jdGlvbiBVKHQsZSxuLHIsaSl7Zm9yKDtudWxsIT09ciYmKCEwPT09ci5fZGVsZXRlZHx8ci5jb25zdHJ1Y3Rvcj09PUp0JiZpLmdldChyLmtleSk9PT1yLnZhbHVlKTspITE9PT1yLl9kZWxldGVkJiZpLmRlbGV0ZShyLmtleSksbj1yLHI9ci5fcmlnaHQ7dmFyIG89ITAsYT0hMSxzPXZvaWQgMDt0cnl7Zm9yKHZhciBsLHU9aVtTeW1ib2wuaXRlcmF0b3JdKCk7IShvPShsPXUubmV4dCgpKS5kb25lKTtvPSEwKXt2YXIgYz14dChsLnZhbHVlLDIpLGg9Y1swXSxmPWNbMV0sZD1uZXcgSnQ7ZC5rZXk9aCxkLnZhbHVlPWYsUyhkLGUsdCxuLHIpLG49ZH19Y2F0Y2godCl7YT0hMCxzPXR9ZmluYWxseXt0cnl7IW8mJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYoYSl0aHJvdyBzfX1yZXR1cm5bbixyXX1mdW5jdGlvbiBCKHQsZSl7dmFyIG49ZS52YWx1ZSxyPWUua2V5O251bGw9PT1uP3QuZGVsZXRlKHIpOnQuc2V0KHIsbil9ZnVuY3Rpb24gVCh0LGUsbixyKXtmb3IoOzspe2lmKG51bGw9PT1lKWJyZWFrO2lmKCEwPT09ZS5fZGVsZXRlZCk7ZWxzZXtpZihlLmNvbnN0cnVjdG9yIT09SnR8fChyW2Uua2V5XXx8bnVsbCkhPT1lLnZhbHVlKWJyZWFrO0IobixlKX10PWUsZT1lLl9yaWdodH1yZXR1cm5bdCxlXX1mdW5jdGlvbiBBKHQsZSxuLHIsaSxvKXt2YXIgYT1uZXcgTWFwO2Zvcih2YXIgcyBpbiBpKXt2YXIgbD1pW3NdLHU9by5nZXQocyk7aWYodSE9PWwpe2Euc2V0KHMsdXx8bnVsbCk7dmFyIGM9bmV3IEp0O2Mua2V5PXMsYy52YWx1ZT1sLFMoYyxlLHQsbixyKSxuPWN9fXJldHVybltuLHIsYV19ZnVuY3Rpb24geCh0LGUsbixyLGksbyxhKXt2YXIgcz0hMCxsPSExLHU9dm9pZCAwO3RyeXtmb3IodmFyIGMsaD1vW1N5bWJvbC5pdGVyYXRvcl0oKTshKHM9KGM9aC5uZXh0KCkpLmRvbmUpO3M9ITApe3ZhciBmPXh0KGMudmFsdWUsMSksZD1mWzBdO3ZvaWQgMD09PWFbZF0mJihhW2RdPW51bGwpfX1jYXRjaCh0KXtsPSEwLHU9dH1maW5hbGx5e3RyeXshcyYmaC5yZXR1cm4mJmgucmV0dXJuKCl9ZmluYWxseXtpZihsKXRocm93IHV9fXZhciBfPVQocixpLG8sYSksdj14dChfLDIpO3I9dlswXSxpPXZbMV07dmFyIHA9dm9pZCAwLHk9QSh0LG4scixpLGEsbyksZz14dCh5LDMpO3I9Z1swXSxpPWdbMV0scD1nWzJdO3ZhciBtPXZvaWQgMDtyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PVN0cmluZz8obT1uZXcgSXRlbVN0cmluZyxtLl9jb250ZW50PWUpOihtPW5ldyBIdCxtLmVtYmVkPWUpLFMobSxuLHQscixpKSxyPW0sVSh0LG4scixpLHApfWZ1bmN0aW9uIEkodCxlLG4scixpLG8sYSl7dmFyIHM9VChyLGksbyxhKSxsPXh0KHMsMik7cj1sWzBdLGk9bFsxXTt2YXIgdT12b2lkIDAsYz1BKHQsbixyLGksYSxvKSxoPXh0KGMsMyk7Zm9yKHI9aFswXSxpPWhbMV0sdT1oWzJdO2U+MCYmbnVsbCE9PWk7KXtpZighMT09PWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgSnQ6dmFyIGY9YVtpLmtleV07dm9pZCAwIT09ZiYmKGY9PT1pLnZhbHVlP3UuZGVsZXRlKGkua2V5KTp1LnNldChpLmtleSxpLnZhbHVlKSxpLl9kZWxldGUodCkpLEIobyxpKTticmVhaztjYXNlIEh0OmNhc2UgSXRlbVN0cmluZzppLl9zcGxpdEF0KHQsZSksZS09aS5fbGVuZ3RofXI9aSxpPWkuX3JpZ2h0fXJldHVybiBVKHQsbixyLGksdSl9ZnVuY3Rpb24gRCh0LGUsbixyLGksbyl7Zm9yKDtlPjAmJm51bGwhPT1pOyl7aWYoITE9PT1pLl9kZWxldGVkKXN3aXRjaChpLmNvbnN0cnVjdG9yKXtjYXNlIEp0OkIobyxpKTticmVhaztjYXNlIEh0OmNhc2UgSXRlbVN0cmluZzppLl9zcGxpdEF0KHQsZSksZS09aS5fbGVuZ3RoLGkuX2RlbGV0ZSh0KX1yPWksaT1pLl9yaWdodH1yZXR1cm5bcixpXX1mdW5jdGlvbiBQKHQsZSl7Zm9yKGU9ZS5fcGFyZW50O251bGwhPT1lOyl7aWYoZT09PXQpcmV0dXJuITA7ZT1lLl9wYXJlbnR9cmV0dXJuITF9ZnVuY3Rpb24gaih0LGUpe3JldHVybiBlfWZ1bmN0aW9uIE4odCxlKXtmb3IodmFyIG49bmV3IE1hcCxyPXQuYXR0cmlidXRlcy5sZW5ndGgtMTtyPj0wO3ItLSl7dmFyIGk9dC5hdHRyaWJ1dGVzW3JdO24uc2V0KGkubmFtZSxpLnZhbHVlKX1yZXR1cm4gZSh0Lm5vZGVOYW1lLG4pfWZ1bmN0aW9uIFYodCxlLG4pe2lmKFAoZS50eXBlLG4pKXt2YXIgcj1uLm5vZGVOYW1lLGk9bmV3IE1hcDtpZih2b2lkIDAhPT1uLmdldEF0dHJpYnV0ZXMpe3ZhciBvPW4uZ2V0QXR0cmlidXRlcygpO2Zvcih2YXIgYSBpbiBvKWkuc2V0KGEsb1thXSl9dmFyIHM9ZS5maWx0ZXIocixuZXcgTWFwKGkpKTtudWxsPT09cz9uLl9kZWxldGUodCk6aS5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ITE9PT1zLmhhcyhlKSYmbi5yZW1vdmVBdHRyaWJ1dGUoZSl9KX19ZnVuY3Rpb24gTCh0KXt2YXIgZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06ZG9jdW1lbnQsbj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e30scj1hcmd1bWVudHMubGVuZ3RoPjMmJnZvaWQgMCE9PWFyZ3VtZW50c1szXT9hcmd1bWVudHNbM106aixpPWFyZ3VtZW50c1s0XSxvPXZvaWQgMDtzd2l0Y2godC5ub2RlVHlwZSl7Y2FzZSBlLkVMRU1FTlRfTk9ERTp2YXIgYT1udWxsLHM9dm9pZCAwO2lmKHQuaGFzQXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiKSYmKGE9dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpLHZvaWQgMD09PShzPW5bYV0pJiYoY29uc29sZS5lcnJvcignVW5rbm93biBob29rIFwiJythKydcIi4gRGVsZXRpbmcgeWpzSG9vayBkYXRhc2V0IHByb3BlcnR5LicpLHQucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiKSxhPW51bGwpKSxudWxsPT09YSl7dmFyIGw9Tih0LHIpO251bGw9PT1sP289ITE6KG89bmV3IFlYbWxFbGVtZW50KHQubm9kZU5hbWUpLGwuZm9yRWFjaChmdW5jdGlvbih0LGUpe28uc2V0QXR0cmlidXRlKGUsdCl9KSxvLmluc2VydCgwLEoodC5jaGlsZE5vZGVzLGRvY3VtZW50LG4scixpKSkpfWVsc2Ugbz1uZXcgWVhtbEhvb2soYSkscy5maWxsVHlwZSh0LG8pO2JyZWFrO2Nhc2UgZS5URVhUX05PREU6bz1uZXcgWVhtbFRleHQsby5pbnNlcnQoMCx0Lm5vZGVWYWx1ZSk7YnJlYWs7ZGVmYXVsdDp0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCB0cmFuc2Zvcm0gdGhpcyBub2RlIHR5cGUgdG8gYSBZWG1sIHR5cGUhXCIpfXJldHVybiBSKGksdCxvKSxvfWZ1bmN0aW9uIE0odCl7Zm9yKDtudWxsIT09dCYmdC5fZGVsZXRlZDspdD10Ll9yaWdodDtyZXR1cm4gdH1mdW5jdGlvbiBDKHQsZSxuKXt0LmRvbVRvVHlwZS5kZWxldGUoZSksdC50eXBlVG9Eb20uZGVsZXRlKG4pfWZ1bmN0aW9uIFIodCxlLG4pe3ZvaWQgMCE9PXQmJih0LmRvbVRvVHlwZS5zZXQoZSxuKSx0LnR5cGVUb0RvbS5zZXQobixlKSl9ZnVuY3Rpb24gVyh0LGUsbil7aWYodm9pZCAwIT09dCl7dmFyIHI9dC5kb21Ub1R5cGUuZ2V0KGUpO3ZvaWQgMCE9PXImJihDKHQsZSxyKSxSKHQsbixyKSl9fWZ1bmN0aW9uIEgodCxlLG4scixpKXt2YXIgbz1KKG4scixpLm9wdHMuaG9va3MsaS5maWx0ZXIsaSk7cmV0dXJuIHQuaW5zZXJ0QWZ0ZXIoZSxvKX1mdW5jdGlvbiBKKHQsZSxuLHIsaSl7dmFyIG89W10sYT0hMCxzPSExLGw9dm9pZCAwO3RyeXtmb3IodmFyIHUsYz10W1N5bWJvbC5pdGVyYXRvcl0oKTshKGE9KHU9Yy5uZXh0KCkpLmRvbmUpO2E9ITApe3ZhciBoPXUudmFsdWUsZj1MKGgsZSxuLHIsaSk7ITEhPT1mJiZvLnB1c2goZil9fWNhdGNoKHQpe3M9ITAsbD10fWZpbmFsbHl7dHJ5eyFhJiZjLnJldHVybiYmYy5yZXR1cm4oKX1maW5hbGx5e2lmKHMpdGhyb3cgbH19cmV0dXJuIG99ZnVuY3Rpb24geih0LGUsbixyLGkpe3ZhciBvPUgodCxlLFtuXSxyLGkpO3JldHVybiBvLmxlbmd0aD4wP29bMF06ZX1mdW5jdGlvbiBGKHQsZSxuKXtmb3IoO2UhPT1uOyl7dmFyIHI9ZTtlPWUubmV4dFNpYmxpbmcsdC5yZW1vdmVDaGlsZChyKX19ZnVuY3Rpb24gWCh0LGUpe0Z0LnNldCh0LGUpLFh0LnNldChlLHQpfWZ1bmN0aW9uIHEodCl7cmV0dXJuIEZ0LmdldCh0KX1mdW5jdGlvbiAkKHQpe3JldHVybiBYdC5nZXQodCl9ZnVuY3Rpb24gRygpe2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBjcnlwdG8mJm51bGwhPWNyeXB0by5nZXRSYW5kb21WYWx1ZSl7dmFyIHQ9bmV3IFVpbnQzMkFycmF5KDEpO3JldHVybiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHQpLHRbMF19aWYoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNyeXB0byYmbnVsbCE9Y3J5cHRvLnJhbmRvbUJ5dGVzKXt2YXIgZT1jcnlwdG8ucmFuZG9tQnl0ZXMoNCk7cmV0dXJuIG5ldyBVaW50MzJBcnJheShlLmJ1ZmZlcilbMF19cmV0dXJuIE1hdGguY2VpbCg0Mjk0OTY3Mjk1Kk1hdGgucmFuZG9tKCkpfWZ1bmN0aW9uIFoodCxlKXtmb3IodmFyIG49dC5fc3RhcnQ7bnVsbCE9PW47KXtpZighMT09PW4uX2RlbGV0ZWQpe2lmKG4uX2xlbmd0aD5lKXJldHVybltuLl9pZC51c2VyLG4uX2lkLmNsb2NrK2VdO2UtPW4uX2xlbmd0aH1uPW4uX3JpZ2h0fXJldHVybltcImVuZG9mXCIsdC5faWQudXNlcix0Ll9pZC5jbG9ja3x8bnVsbCx0Ll9pZC5uYW1lfHxudWxsLHQuX2lkLnR5cGV8fG51bGxdfWZ1bmN0aW9uIFEodCxlKXtpZihcImVuZG9mXCI9PT1lWzBdKXt2YXIgbj12b2lkIDA7bj1udWxsPT09ZVszXT9uZXcgUHQoZVsxXSxlWzJdKTpuZXcgJHQoZVszXSxlWzRdKTtmb3IodmFyIHI9dC5vcy5nZXQobik7bnVsbCE9PXIuX3JlZG9uZTspcj1yLl9yZWRvbmU7cmV0dXJuIG51bGw9PT1yfHxyLmNvbnN0cnVjdG9yPT09THQ/bnVsbDp7dHlwZTpyLG9mZnNldDpyLmxlbmd0aH19Zm9yKHZhciBpPTAsbz10Lm9zLmZpbmROb2RlV2l0aFVwcGVyQm91bmQobmV3IFB0KGVbMF0sZVsxXSkpLnZhbCxhPWVbMV0tby5faWQuY2xvY2s7bnVsbCE9PW8uX3JlZG9uZTspbz1vLl9yZWRvbmU7dmFyIHM9by5fcGFyZW50O2lmKG8uY29uc3RydWN0b3I9PT1MdHx8cy5fZGVsZXRlZClyZXR1cm4gbnVsbDtmb3Ioby5fZGVsZXRlZHx8KGk9YSksbz1vLl9sZWZ0O251bGwhPT1vOylvLl9kZWxldGVkfHwoaSs9by5fbGVuZ3RoKSxvPW8uX2xlZnQ7cmV0dXJue3R5cGU6cyxvZmZzZXQ6aX19ZnVuY3Rpb24gSygpe3ZhciB0PSEwO3JldHVybiBmdW5jdGlvbihlKXtpZih0KXt0PSExO3RyeXtlKCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX10PSEwfX19ZnVuY3Rpb24gdHQodCl7dmFyIGU9Z2V0U2VsZWN0aW9uKCksbj1lLmJhc2VOb2RlLHI9ZS5iYXNlT2Zmc2V0LGk9ZS5leHRlbnROb2RlLG89ZS5leHRlbnRPZmZzZXQsYT10LmRvbVRvVHlwZS5nZXQobikscz10LmRvbVRvVHlwZS5nZXQoaSk7cmV0dXJuIHZvaWQgMCE9PWEmJnZvaWQgMCE9PXM/e2Zyb206WihhLHIpLHRvOloocyxvKX06bnVsbH1mdW5jdGlvbiBldCh0LGUpe2UmJih0ZT1lZSh0KSl9ZnVuY3Rpb24gbnQodCxlKXtudWxsIT09dGUmJmUmJnQucmVzdG9yZVNlbGVjdGlvbih0ZSl9ZnVuY3Rpb24gcnQodCl7aWYobnVsbCE9PXQpe3ZhciBlPWdldFNlbGVjdGlvbigpLmFuY2hvck5vZGU7aWYobnVsbCE9ZSl7ZS5ub2RlVHlwZT09PWRvY3VtZW50LlRFWFRfTk9ERSYmKGU9ZS5wYXJlbnRFbGVtZW50KTtyZXR1cm57ZWxlbTplLHRvcDplLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcH19Zm9yKHZhciBuPXQuY2hpbGRyZW4scj0wO3I8bi5sZW5ndGg7cisrKXt2YXIgaT1uW3JdLG89aS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtpZihvLnRvcD49MClyZXR1cm57ZWxlbTppLHRvcDpvLnRvcH19fXJldHVybiBudWxsfWZ1bmN0aW9uIGl0KHQsZSl7aWYobnVsbCE9PWUpe3ZhciBuPWUuZWxlbSxyPWUudG9wLGk9bi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3Asbz10LnNjcm9sbFRvcCtpLXI7bz49MCYmKHQuc2Nyb2xsVG9wPW8pfX1mdW5jdGlvbiBvdCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgbj1ydChlLnNjcm9sbGluZ0VsZW1lbnQpO3QuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgbj10LnRhcmdldCxyPWUudHlwZVRvRG9tLmdldChuKTtpZih2b2lkIDAhPT1yJiYhMSE9PXIpaWYobi5jb25zdHJ1Y3Rvcj09PVlYbWxUZXh0KXIubm9kZVZhbHVlPW4udG9TdHJpbmcoKTtlbHNlIGlmKHZvaWQgMCE9PXQuYXR0cmlidXRlc0NoYW5nZWQmJih0LmF0dHJpYnV0ZXNDaGFuZ2VkLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9bi5nZXRBdHRyaWJ1dGUodCk7dm9pZCAwPT09ZT9yLnJlbW92ZUF0dHJpYnV0ZSh0KTpyLnNldEF0dHJpYnV0ZSh0LGUpfSksdC5jaGlsZExpc3RDaGFuZ2VkJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spKXt2YXIgaT1yLmZpcnN0Q2hpbGQ7bi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBuPWUudHlwZVRvRG9tLmdldCh0KTtzd2l0Y2gobil7Y2FzZSB2b2lkIDA6dmFyIG89dC50b0RvbShlLm9wdHMuZG9jdW1lbnQsZS5vcHRzLmhvb2tzLGUpO3IuaW5zZXJ0QmVmb3JlKG8saSk7YnJlYWs7Y2FzZSExOmJyZWFrO2RlZmF1bHQ6RihyLGksbiksaT1uLm5leHRTaWJsaW5nfX0pLEYocixpLG51bGwpfX0pLGl0KGUuc2Nyb2xsaW5nRWxlbWVudCxuKX0pfWZ1bmN0aW9uIGF0KHQsZSl7Zm9yKHZhciBuPTAscj0wO248dC5sZW5ndGgmJm48ZS5sZW5ndGgmJnRbbl09PT1lW25dOyluKys7aWYobiE9PXQubGVuZ3RofHxuIT09ZS5sZW5ndGgpZm9yKDtyK248dC5sZW5ndGgmJnIrbjxlLmxlbmd0aCYmdFt0Lmxlbmd0aC1yLTFdPT09ZVtlLmxlbmd0aC1yLTFdOylyKys7cmV0dXJue3BvczpuLHJlbW92ZTp0Lmxlbmd0aC1uLXIsaW5zZXJ0OmUuc2xpY2UobixlLmxlbmd0aC1yKX19ZnVuY3Rpb24gc3QodCxlLG4scil7aWYobnVsbCE9biYmITEhPT1uJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spe2Zvcih2YXIgaT1uLl95LG89bmV3IFNldCxhPWUuY2hpbGROb2Rlcy5sZW5ndGgtMTthPj0wO2EtLSl7dmFyIHM9dC5kb21Ub1R5cGUuZ2V0KGUuY2hpbGROb2Rlc1thXSk7dm9pZCAwIT09cyYmITEhPT1zJiZvLmFkZChzKX1uLmZvckVhY2goZnVuY3Rpb24oZSl7ITE9PT1vLmhhcyhlKSYmKGUuX2RlbGV0ZShpKSxDKHQsdC50eXBlVG9Eb20uZ2V0KGUpLGUpKX0pO2Zvcih2YXIgbD1lLmNoaWxkTm9kZXMsdT1sLmxlbmd0aCxjPW51bGwsaD1NKG4uX3N0YXJ0KSxmPTA7Zjx1O2YrKyl7dmFyIGQ9bFtmXSxfPXQuZG9tVG9UeXBlLmdldChkKTtpZih2b2lkIDAhPT1fKXtpZighMT09PV8pY29udGludWU7bnVsbCE9PWg/aCE9PV8/KF8uX3BhcmVudCE9PW4/Qyh0LGQsXyk6KEModCxkLF8pLF8uX2RlbGV0ZShpKSksYz16KG4sYyxkLHIsdCkpOihjPWgsaD1NKGguX3JpZ2h0KSk6Yz16KG4sYyxkLHIsdCl9ZWxzZSBjPXoobixjLGQscix0KX19fWZ1bmN0aW9uIGx0KHQsZSl7dmFyIG49dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7bi50eXBlLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7dmFyIHI9bmV3IFNldDt0LmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9dC50YXJnZXQsaT1uLmRvbVRvVHlwZS5nZXQoZSk7aWYodm9pZCAwPT09aSl7dmFyIG89ZSxhPXZvaWQgMDtkb3tvPW8ucGFyZW50RWxlbWVudCxhPW4uZG9tVG9UeXBlLmdldChvKX13aGlsZSh2b2lkIDA9PT1hJiZudWxsIT09byk7cmV0dXJuIHZvaWQoITEhPT1hJiZ2b2lkIDAhPT1hJiZhLmNvbnN0cnVjdG9yIT09WVhtbEhvb2smJnIuYWRkKG8pKX1pZighMSE9PWkmJmkuY29uc3RydWN0b3IhPT1ZWG1sSG9vaylzd2l0Y2godC50eXBlKXtjYXNlXCJjaGFyYWN0ZXJEYXRhXCI6dmFyIHM9YXQoaS50b1N0cmluZygpLGUubm9kZVZhbHVlKTtpLmRlbGV0ZShzLnBvcyxzLnJlbW92ZSksaS5pbnNlcnQocy5wb3Mscy5pbnNlcnQpO2JyZWFrO2Nhc2VcImF0dHJpYnV0ZXNcIjppZihpLmNvbnN0cnVjdG9yPT09WVhtbEZyYWdtZW50KWJyZWFrO3ZhciBsPXQuYXR0cmlidXRlTmFtZSx1PWUuZ2V0QXR0cmlidXRlKGwpLGM9bmV3IE1hcDtjLnNldChsLHUpLGkuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQmJm4uZmlsdGVyKGUubm9kZU5hbWUsYykuc2l6ZT4wJiZpLmdldEF0dHJpYnV0ZShsKSE9PXUmJihudWxsPT11P2kucmVtb3ZlQXR0cmlidXRlKGwpOmkuc2V0QXR0cmlidXRlKGwsdSkpO2JyZWFrO2Nhc2VcImNoaWxkTGlzdFwiOnIuYWRkKHQudGFyZ2V0KX19KTt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD1yW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PXMudmFsdWUsYz1uLmRvbVRvVHlwZS5nZXQodSk7c3Qobix1LGMsZSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fSl9KX1mdW5jdGlvbiB1dCh0LGUsbil7dmFyIHI9ITEsaT12b2lkIDA7cmV0dXJuIHQudHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IoOyFyJiZuLmxlbmd0aD4wOykhZnVuY3Rpb24oKXtpPW4ucG9wKCksbnVsbCE9PWkuZnJvbVN0YXRlJiYodC5vcy5nZXRJdGVtQ2xlYW5TdGFydChpLmZyb21TdGF0ZSksdC5vcy5nZXRJdGVtQ2xlYW5FbmQoaS50b1N0YXRlKSx0Lm9zLml0ZXJhdGUoaS5mcm9tU3RhdGUsaS50b1N0YXRlLGZ1bmN0aW9uKG4pe2Zvcig7bi5fZGVsZXRlZCYmbnVsbCE9PW4uX3JlZG9uZTspbj1uLl9yZWRvbmU7ITE9PT1uLl9kZWxldGVkJiZQKGUsbikmJihyPSEwLG4uX2RlbGV0ZSh0KSl9KSk7dmFyIG89bmV3IFNldCxhPSEwLHM9ITEsbD12b2lkIDA7dHJ5e2Zvcih2YXIgdSxjPWkuZGVsZXRlZFN0cnVjdHNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoYT0odT1jLm5leHQoKSkuZG9uZSk7YT0hMCl7dmFyIGg9dS52YWx1ZSxmPWguZnJvbSxkPW5ldyBQdChmLnVzZXIsZi5jbG9jaytoLmxlbi0xKTt0Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KGYpLHQub3MuZ2V0SXRlbUNsZWFuRW5kKGQpLHQub3MuaXRlcmF0ZShmLGQsZnVuY3Rpb24obil7UChlLG4pJiZuLl9wYXJlbnQhPT10JiYobi5faWQudXNlciE9PXQudXNlcklEfHxudWxsPT09aS5mcm9tU3RhdGV8fG4uX2lkLmNsb2NrPGkuZnJvbVN0YXRlLmNsb2NrfHxuLl9pZC5jbG9jaz5pLnRvU3RhdGUuY2xvY2spJiZvLmFkZChuKX0pfX1jYXRjaCh0KXtzPSEwLGw9dH1maW5hbGx5e3RyeXshYSYmYy5yZXR1cm4mJmMucmV0dXJuKCl9ZmluYWxseXtpZihzKXRocm93IGx9fW8uZm9yRWFjaChmdW5jdGlvbihlKXt2YXIgbj1lLl9yZWRvKHQsbyk7cj1yfHxufSl9KCl9KSxyJiZpLmJpbmRpbmdJbmZvcy5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ZS5fcmVzdG9yZVVuZG9TdGFja0luZm8odCl9KSxyfWZ1bmN0aW9uIGN0KHQsZSl7cmV0dXJuIGU9e2V4cG9ydHM6e319LHQoZSxlLmV4cG9ydHMpLGUuZXhwb3J0c31mdW5jdGlvbiBodCh0KXtpZih0PVN0cmluZyh0KSwhKHQubGVuZ3RoPjEwMCkpe3ZhciBlPS9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWModCk7aWYoZSl7dmFyIG49cGFyc2VGbG9hdChlWzFdKTtzd2l0Y2goKGVbMl18fFwibXNcIikudG9Mb3dlckNhc2UoKSl7Y2FzZVwieWVhcnNcIjpjYXNlXCJ5ZWFyXCI6Y2FzZVwieXJzXCI6Y2FzZVwieXJcIjpjYXNlXCJ5XCI6cmV0dXJuIG4qdWU7Y2FzZVwiZGF5c1wiOmNhc2VcImRheVwiOmNhc2VcImRcIjpyZXR1cm4gbipsZTtjYXNlXCJob3Vyc1wiOmNhc2VcImhvdXJcIjpjYXNlXCJocnNcIjpjYXNlXCJoclwiOmNhc2VcImhcIjpyZXR1cm4gbipzZTtjYXNlXCJtaW51dGVzXCI6Y2FzZVwibWludXRlXCI6Y2FzZVwibWluc1wiOmNhc2VcIm1pblwiOmNhc2VcIm1cIjpyZXR1cm4gbiphZTtjYXNlXCJzZWNvbmRzXCI6Y2FzZVwic2Vjb25kXCI6Y2FzZVwic2Vjc1wiOmNhc2VcInNlY1wiOmNhc2VcInNcIjpyZXR1cm4gbipvZTtjYXNlXCJtaWxsaXNlY29uZHNcIjpjYXNlXCJtaWxsaXNlY29uZFwiOmNhc2VcIm1zZWNzXCI6Y2FzZVwibXNlY1wiOmNhc2VcIm1zXCI6cmV0dXJuIG47ZGVmYXVsdDpyZXR1cm59fX19ZnVuY3Rpb24gZnQodCl7cmV0dXJuIHQ+PWxlP01hdGgucm91bmQodC9sZSkrXCJkXCI6dD49c2U/TWF0aC5yb3VuZCh0L3NlKStcImhcIjp0Pj1hZT9NYXRoLnJvdW5kKHQvYWUpK1wibVwiOnQ+PW9lP01hdGgucm91bmQodC9vZSkrXCJzXCI6dCtcIm1zXCJ9ZnVuY3Rpb24gZHQodCl7cmV0dXJuIF90KHQsbGUsXCJkYXlcIil8fF90KHQsc2UsXCJob3VyXCIpfHxfdCh0LGFlLFwibWludXRlXCIpfHxfdCh0LG9lLFwic2Vjb25kXCIpfHx0K1wiIG1zXCJ9ZnVuY3Rpb24gX3QodCxlLG4pe2lmKCEodDxlKSlyZXR1cm4gdDwxLjUqZT9NYXRoLmZsb29yKHQvZSkrXCIgXCIrbjpNYXRoLmNlaWwodC9lKStcIiBcIituK1wic1wifWZ1bmN0aW9uIHZ0KHQsZSl7dC50cmFuc2FjdChmdW5jdGlvbigpe3IodCxlKSxzKHQsZSl9KX1mdW5jdGlvbiBwdCh0KXt2YXIgZT1uZXcgQ3Q7cmV0dXJuIGModCxlLG5ldyBNYXApLGEodCxlKSxlfWZ1bmN0aW9uIHl0KCl7dmFyIHQ9bmV3IEN0O3JldHVybiB0LndyaXRlVWludDMyKDApLHtsZW46MCxidWZmZXI6dH19ZnVuY3Rpb24gZ3QoKXt2YXIgdD10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgZT10LnRhcmdldCxuPXQudHlwZSxyPVoobixlLnNlbGVjdGlvblN0YXJ0KSxpPVoobixlLnNlbGVjdGlvbkVuZCk7ZS52YWx1ZT1uLnRvU3RyaW5nKCk7dmFyIG89UShuLl95LHIpLGE9UShuLl95LGkpO2Uuc2V0U2VsZWN0aW9uUmFuZ2UobyxhKX0pfWZ1bmN0aW9uIG10KCl7dmFyIHQ9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIGU9YXQodC50eXBlLnRvU3RyaW5nKCksdC50YXJnZXQudmFsdWUpO3QudHlwZS5kZWxldGUoZS5wb3MsZS5yZW1vdmUpLHQudHlwZS5pbnNlcnQoZS5wb3MsZS5pbnNlcnQpfSl9ZnVuY3Rpb24ga3QodCl7dmFyIGU9dGhpcy50YXJnZXQ7ZS51cGRhdGUoXCJ5anNcIiksdGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UudXBkYXRlQ29udGVudHModC5kZWx0YSxcInlqc1wiKSxlLnVwZGF0ZShcInlqc1wiKX0pfWZ1bmN0aW9uIGJ0KHQpe3ZhciBlPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UudHlwZS5hcHBseURlbHRhKHQub3BzKX0pfWZ1bmN0aW9uIHd0KHQpe3ZhciBlPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2Zvcih2YXIgbj1lLnRhcmdldCxyPXQuZGVsdGEsaT0wLG89bi5wb3NGcm9tSW5kZXgoaSksYT0wO2E8ci5sZW5ndGg7YSsrKXt2YXIgcz1yW2FdO3MucmV0YWluPyhpPXMucmV0YWluLG89bi5wb3NGcm9tSW5kZXgoaSkpOnMuaW5zZXJ0P24ucmVwbGFjZVJhbmdlKHMuaW5zZXJ0LG8sbyk6cy5kZWxldGUmJm4ucmVwbGFjZVJhbmdlKFwiXCIsbyxuLnBvc0Zyb21JbmRleChpK3MuZGVsZXRlKSl9fSl9ZnVuY3Rpb24gU3QodCxlKXt2YXIgbj10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtmb3IodmFyIHI9MDtyPGUubGVuZ3RoO3IrKyl7dmFyIGk9ZVtyXSxvPXQuaW5kZXhGcm9tUG9zKGkuZnJvbSk7aWYoaS5yZW1vdmVkLmxlbmd0aD4wKXtmb3IodmFyIGE9MCxzPTA7czxpLnJlbW92ZWQubGVuZ3RoO3MrKylhKz1pLnJlbW92ZWRbc10ubGVuZ3RoO2ErPWkucmVtb3ZlZC5sZW5ndGgtMSxuLnR5cGUuZGVsZXRlKG8sYSl9bi50eXBlLmluc2VydChvLGkudGV4dC5qb2luKFwiXFxuXCIpKX19KX12YXIgT3Q9XCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLml0ZXJhdG9yP2Z1bmN0aW9uKHQpe3JldHVybiB0eXBlb2YgdH06ZnVuY3Rpb24odCl7cmV0dXJuIHQmJlwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmdC5jb25zdHJ1Y3Rvcj09PVN5bWJvbCYmdCE9PVN5bWJvbC5wcm90b3R5cGU/XCJzeW1ib2xcIjp0eXBlb2YgdH0sRXQ9ZnVuY3Rpb24odCxlKXtpZighKHQgaW5zdGFuY2VvZiBlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpfSxVdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQodCxlKXtmb3IodmFyIG49MDtuPGUubGVuZ3RoO24rKyl7dmFyIHI9ZVtuXTtyLmVudW1lcmFibGU9ci5lbnVtZXJhYmxlfHwhMSxyLmNvbmZpZ3VyYWJsZT0hMCxcInZhbHVlXCJpbiByJiYoci53cml0YWJsZT0hMCksT2JqZWN0LmRlZmluZVByb3BlcnR5KHQsci5rZXkscil9fXJldHVybiBmdW5jdGlvbihlLG4scil7cmV0dXJuIG4mJnQoZS5wcm90b3R5cGUsbiksciYmdChlLHIpLGV9fSgpLEJ0PWZ1bmN0aW9uIHQoZSxuLHIpe251bGw9PT1lJiYoZT1GdW5jdGlvbi5wcm90b3R5cGUpO3ZhciBpPU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZSxuKTtpZih2b2lkIDA9PT1pKXt2YXIgbz1PYmplY3QuZ2V0UHJvdG90eXBlT2YoZSk7cmV0dXJuIG51bGw9PT1vP3ZvaWQgMDp0KG8sbixyKX1pZihcInZhbHVlXCJpbiBpKXJldHVybiBpLnZhbHVlO3ZhciBhPWkuZ2V0O2lmKHZvaWQgMCE9PWEpcmV0dXJuIGEuY2FsbChyKX0sVHQ9ZnVuY3Rpb24odCxlKXtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBlJiZudWxsIT09ZSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCBcIit0eXBlb2YgZSk7dC5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShlJiZlLnByb3RvdHlwZSx7Y29uc3RydWN0b3I6e3ZhbHVlOnQsZW51bWVyYWJsZTohMSx3cml0YWJsZTohMCxjb25maWd1cmFibGU6ITB9fSksZSYmKE9iamVjdC5zZXRQcm90b3R5cGVPZj9PYmplY3Quc2V0UHJvdG90eXBlT2YodCxlKTp0Ll9fcHJvdG9fXz1lKX0sQXQ9ZnVuY3Rpb24odCxlKXtpZighdCl0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7cmV0dXJuIWV8fFwib2JqZWN0XCIhPXR5cGVvZiBlJiZcImZ1bmN0aW9uXCIhPXR5cGVvZiBlP3Q6ZX0seHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7dmFyIG49W10scj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz10W1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpJiYobi5wdXNoKGEudmFsdWUpLCFlfHxuLmxlbmd0aCE9PWUpO3I9ITApO31jYXRjaCh0KXtpPSEwLG89dH1maW5hbGx5e3RyeXshciYmcy5yZXR1cm4mJnMucmV0dXJuKCl9ZmluYWxseXtpZihpKXRocm93IG99fXJldHVybiBufXJldHVybiBmdW5jdGlvbihlLG4pe2lmKEFycmF5LmlzQXJyYXkoZSkpcmV0dXJuIGU7aWYoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChlKSlyZXR1cm4gdChlLG4pO3Rocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlXCIpfX0oKSxJdD1mdW5jdGlvbigpe2Z1bmN0aW9uIGUodCl7RXQodGhpcyxlKSx0aGlzLnZhbD10LHRoaXMuY29sb3I9ITAsdGhpcy5fbGVmdD1udWxsLHRoaXMuX3JpZ2h0PW51bGwsdGhpcy5fcGFyZW50PW51bGx9cmV0dXJuIFV0KGUsW3trZXk6XCJpc1JlZFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3J9fSx7a2V5OlwiaXNCbGFja1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIXRoaXMuY29sb3J9fSx7a2V5OlwicmVkZGVuXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb2xvcj0hMCx0aGlzfX0se2tleTpcImJsYWNrZW5cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbG9yPSExLHRoaXN9fSx7a2V5Olwicm90YXRlTGVmdFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMucGFyZW50LHI9dGhpcy5yaWdodCxpPXRoaXMucmlnaHQubGVmdDtyLmxlZnQ9dGhpcyx0aGlzLnJpZ2h0PWksdChlLG4scix0aGlzKX19LHtrZXk6XCJuZXh0XCIsdmFsdWU6ZnVuY3Rpb24oKXtpZihudWxsIT09dGhpcy5yaWdodCl7Zm9yKHZhciB0PXRoaXMucmlnaHQ7bnVsbCE9PXQubGVmdDspdD10LmxlZnQ7cmV0dXJuIHR9Zm9yKHZhciBlPXRoaXM7bnVsbCE9PWUucGFyZW50JiZlIT09ZS5wYXJlbnQubGVmdDspZT1lLnBhcmVudDtyZXR1cm4gZS5wYXJlbnR9fSx7a2V5OlwicHJldlwiLHZhbHVlOmZ1bmN0aW9uKCl7aWYobnVsbCE9PXRoaXMubGVmdCl7Zm9yKHZhciB0PXRoaXMubGVmdDtudWxsIT09dC5yaWdodDspdD10LnJpZ2h0O3JldHVybiB0fWZvcih2YXIgZT10aGlzO251bGwhPT1lLnBhcmVudCYmZSE9PWUucGFyZW50LnJpZ2h0OyllPWUucGFyZW50O3JldHVybiBlLnBhcmVudH19LHtrZXk6XCJyb3RhdGVSaWdodFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMucGFyZW50LHI9dGhpcy5sZWZ0LGk9dGhpcy5sZWZ0LnJpZ2h0O3IucmlnaHQ9dGhpcyx0aGlzLmxlZnQ9aSx0KGUsbixyLHRoaXMpfX0se2tleTpcImdldFVuY2xlXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wYXJlbnQ9PT10aGlzLnBhcmVudC5wYXJlbnQubGVmdD90aGlzLnBhcmVudC5wYXJlbnQucmlnaHQ6dGhpcy5wYXJlbnQucGFyZW50LmxlZnR9fSx7a2V5OlwiZ3JhbmRwYXJlbnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wYXJlbnQucGFyZW50fX0se2tleTpcInBhcmVudFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9wYXJlbnR9fSx7a2V5Olwic2libGluZ1wiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzPT09dGhpcy5wYXJlbnQubGVmdD90aGlzLnBhcmVudC5yaWdodDp0aGlzLnBhcmVudC5sZWZ0fX0se2tleTpcImxlZnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fbGVmdH0sc2V0OmZ1bmN0aW9uKHQpe251bGwhPT10JiYodC5fcGFyZW50PXRoaXMpLHRoaXMuX2xlZnQ9dH19LHtrZXk6XCJyaWdodFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9yaWdodH0sc2V0OmZ1bmN0aW9uKHQpe251bGwhPT10JiYodC5fcGFyZW50PXRoaXMpLHRoaXMuX3JpZ2h0PXR9fV0pLGV9KCksRHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLnJvb3Q9bnVsbCx0aGlzLmxlbmd0aD0wfXJldHVybiBVdCh0LFt7a2V5OlwiZmluZE5leHRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10LmNsb25lKCk7cmV0dXJuIGUuY2xvY2srPTEsdGhpcy5maW5kV2l0aExvd2VyQm91bmQoZSl9fSx7a2V5OlwiZmluZFByZXZcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10LmNsb25lKCk7cmV0dXJuIGUuY2xvY2stPTEsdGhpcy5maW5kV2l0aFVwcGVyQm91bmQoZSl9fSx7a2V5OlwiZmluZE5vZGVXaXRoTG93ZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspaWYobnVsbD09PXR8fHQubGVzc1RoYW4oZS52YWwuX2lkKSYmbnVsbCE9PWUubGVmdCllPWUubGVmdDtlbHNle2lmKG51bGw9PT10fHwhZS52YWwuX2lkLmxlc3NUaGFuKHQpKXJldHVybiBlO2lmKG51bGw9PT1lLnJpZ2h0KXJldHVybiBlLm5leHQoKTtlPWUucmlnaHR9fX0se2tleTpcImZpbmROb2RlV2l0aFVwcGVyQm91bmRcIix2YWx1ZTpmdW5jdGlvbih0KXtpZih2b2lkIDA9PT10KXRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IGRlZmluZSBmcm9tIVwiKTt2YXIgZT10aGlzLnJvb3Q7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7Zm9yKDs7KWlmKG51bGwhPT10JiYhZS52YWwuX2lkLmxlc3NUaGFuKHQpfHxudWxsPT09ZS5yaWdodCl7aWYobnVsbD09PXR8fCF0Lmxlc3NUaGFuKGUudmFsLl9pZCkpcmV0dXJuIGU7aWYobnVsbD09PWUubGVmdClyZXR1cm4gZS5wcmV2KCk7ZT1lLmxlZnR9ZWxzZSBlPWUucmlnaHR9fSx7a2V5OlwiZmluZFNtYWxsZXN0Tm9kZVwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMucm9vdDtudWxsIT10JiZudWxsIT10LmxlZnQ7KXQ9dC5sZWZ0O3JldHVybiB0fX0se2tleTpcImZpbmRXaXRoTG93ZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZCh0KTtyZXR1cm4gbnVsbD09ZT9udWxsOmUudmFsfX0se2tleTpcImZpbmRXaXRoVXBwZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGVXaXRoVXBwZXJCb3VuZCh0KTtyZXR1cm4gbnVsbD09ZT9udWxsOmUudmFsfX0se2tleTpcIml0ZXJhdGVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI7Zm9yKHI9bnVsbD09PXQ/dGhpcy5maW5kU21hbGxlc3ROb2RlKCk6dGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKHQpO251bGwhPT1yJiYobnVsbD09PWV8fHIudmFsLl9pZC5sZXNzVGhhbihlKXx8ci52YWwuX2lkLmVxdWFscyhlKSk7KW4oci52YWwpLHI9ci5uZXh0KCl9fSx7a2V5OlwiZmluZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGUodCk7cmV0dXJuIG51bGwhPT1lP2UudmFsOm51bGx9fSx7a2V5OlwiZmluZE5vZGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnJvb3Q7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7Zm9yKDs7KXtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtpZih0Lmxlc3NUaGFuKGUudmFsLl9pZCkpZT1lLmxlZnQ7ZWxzZXtpZighZS52YWwuX2lkLmxlc3NUaGFuKHQpKXJldHVybiBlO2U9ZS5yaWdodH19fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGUodCk7aWYobnVsbCE9ZSl7aWYodGhpcy5sZW5ndGgtLSxudWxsIT09ZS5sZWZ0JiZudWxsIT09ZS5yaWdodCl7Zm9yKHZhciBuPWUubGVmdDtudWxsIT09bi5yaWdodDspbj1uLnJpZ2h0O2UudmFsPW4udmFsLGU9bn12YXIgcixpPWUubGVmdHx8ZS5yaWdodDtpZihudWxsPT09aT8ocj0hMCxpPW5ldyBJdChudWxsKSxpLmJsYWNrZW4oKSxlLnJpZ2h0PWkpOnI9ITEsbnVsbD09PWUucGFyZW50KXJldHVybiB2b2lkKHI/dGhpcy5yb290PW51bGw6KHRoaXMucm9vdD1pLGkuYmxhY2tlbigpLGkuX3BhcmVudD1udWxsKSk7aWYoZS5wYXJlbnQubGVmdD09PWUpZS5wYXJlbnQubGVmdD1pO2Vsc2V7aWYoZS5wYXJlbnQucmlnaHQhPT1lKXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUhXCIpO2UucGFyZW50LnJpZ2h0PWl9aWYoZS5pc0JsYWNrKCkmJihpLmlzUmVkKCk/aS5ibGFja2VuKCk6dGhpcy5fZml4RGVsZXRlKGkpKSx0aGlzLnJvb3QuYmxhY2tlbigpLHIpaWYoaS5wYXJlbnQubGVmdD09PWkpaS5wYXJlbnQubGVmdD1udWxsO2Vsc2V7aWYoaS5wYXJlbnQucmlnaHQhPT1pKXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgIzNcIik7aS5wYXJlbnQucmlnaHQ9bnVsbH19fX0se2tleTpcIl9maXhEZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQpe3JldHVybiBudWxsPT09dHx8dC5pc0JsYWNrKCl9ZnVuY3Rpb24gbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQuaXNSZWQoKX1pZihudWxsIT09dC5wYXJlbnQpe3ZhciByPXQuc2libGluZztpZihuKHIpKXtpZih0LnBhcmVudC5yZWRkZW4oKSxyLmJsYWNrZW4oKSx0PT09dC5wYXJlbnQubGVmdCl0LnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpO2Vsc2V7aWYodCE9PXQucGFyZW50LnJpZ2h0KXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgIzJcIik7dC5wYXJlbnQucm90YXRlUmlnaHQodGhpcyl9cj10LnNpYmxpbmd9dC5wYXJlbnQuaXNCbGFjaygpJiZyLmlzQmxhY2soKSYmZShyLmxlZnQpJiZlKHIucmlnaHQpPyhyLnJlZGRlbigpLHRoaXMuX2ZpeERlbGV0ZSh0LnBhcmVudCkpOnQucGFyZW50LmlzUmVkKCkmJnIuaXNCbGFjaygpJiZlKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksdC5wYXJlbnQuYmxhY2tlbigpKToodD09PXQucGFyZW50LmxlZnQmJnIuaXNCbGFjaygpJiZuKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksci5sZWZ0LmJsYWNrZW4oKSxyLnJvdGF0ZVJpZ2h0KHRoaXMpLHI9dC5zaWJsaW5nKTp0PT09dC5wYXJlbnQucmlnaHQmJnIuaXNCbGFjaygpJiZuKHIucmlnaHQpJiZlKHIubGVmdCkmJihyLnJlZGRlbigpLHIucmlnaHQuYmxhY2tlbigpLHIucm90YXRlTGVmdCh0aGlzKSxyPXQuc2libGluZyksci5jb2xvcj10LnBhcmVudC5jb2xvcix0LnBhcmVudC5ibGFja2VuKCksdD09PXQucGFyZW50LmxlZnQ/KHIucmlnaHQuYmxhY2tlbigpLHQucGFyZW50LnJvdGF0ZUxlZnQodGhpcykpOihyLmxlZnQuYmxhY2tlbigpLHQucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpKSl9fX0se2tleTpcInB1dFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBJdCh0KTtpZihudWxsIT09dGhpcy5yb290KXtmb3IodmFyIG49dGhpcy5yb290OzspaWYoZS52YWwuX2lkLmxlc3NUaGFuKG4udmFsLl9pZCkpe2lmKG51bGw9PT1uLmxlZnQpe24ubGVmdD1lO2JyZWFrfW49bi5sZWZ0fWVsc2V7aWYoIW4udmFsLl9pZC5sZXNzVGhhbihlLnZhbC5faWQpKXJldHVybiBuLnZhbD1lLnZhbCxuO2lmKG51bGw9PT1uLnJpZ2h0KXtuLnJpZ2h0PWU7YnJlYWt9bj1uLnJpZ2h0fXRoaXMuX2ZpeEluc2VydChlKX1lbHNlIHRoaXMucm9vdD1lO3JldHVybiB0aGlzLmxlbmd0aCsrLHRoaXMucm9vdC5ibGFja2VuKCksZX19LHtrZXk6XCJfZml4SW5zZXJ0XCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXQucGFyZW50KXJldHVybiB2b2lkIHQuYmxhY2tlbigpO2lmKCF0LnBhcmVudC5pc0JsYWNrKCkpe3ZhciBlPXQuZ2V0VW5jbGUoKTtudWxsIT09ZSYmZS5pc1JlZCgpPyh0LnBhcmVudC5ibGFja2VuKCksZS5ibGFja2VuKCksdC5ncmFuZHBhcmVudC5yZWRkZW4oKSx0aGlzLl9maXhJbnNlcnQodC5ncmFuZHBhcmVudCkpOih0PT09dC5wYXJlbnQucmlnaHQmJnQucGFyZW50PT09dC5ncmFuZHBhcmVudC5sZWZ0Pyh0LnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpLHQ9dC5sZWZ0KTp0PT09dC5wYXJlbnQubGVmdCYmdC5wYXJlbnQ9PT10LmdyYW5kcGFyZW50LnJpZ2h0JiYodC5wYXJlbnQucm90YXRlUmlnaHQodGhpcyksdD10LnJpZ2h0KSx0LnBhcmVudC5ibGFja2VuKCksdC5ncmFuZHBhcmVudC5yZWRkZW4oKSx0PT09dC5wYXJlbnQubGVmdD90LmdyYW5kcGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpOnQuZ3JhbmRwYXJlbnQucm90YXRlTGVmdCh0aGlzKSl9fX1dKSx0fSgpLFB0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe0V0KHRoaXMsdCksdGhpcy51c2VyPWUsdGhpcy5jbG9jaz1ufXJldHVybiBVdCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdCh0aGlzLnVzZXIsdGhpcy5jbG9jayl9fSx7a2V5OlwiZXF1YWxzXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIG51bGwhPT10JiZ0LnVzZXI9PT10aGlzLnVzZXImJnQuY2xvY2s9PT10aGlzLmNsb2NrfX0se2tleTpcImxlc3NUaGFuXCIsdmFsdWU6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuY29uc3RydWN0b3I9PT10JiYodGhpcy51c2VyPGUudXNlcnx8dGhpcy51c2VyPT09ZS51c2VyJiZ0aGlzLmNsb2NrPGUuY2xvY2spfX1dKSx0fSgpLGp0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4scil7RXQodGhpcyx0KSx0aGlzLl9pZD1lLHRoaXMubGVuPW4sdGhpcy5nYz1yfXJldHVybiBVdCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdCh0aGlzLl9pZCx0aGlzLmxlbix0aGlzLmdjKX19XSksdH0oKSxOdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cmV0dXJuIEV0KHRoaXMsZSksQXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwibG9nVGFibGVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdO3RoaXMuaXRlcmF0ZShudWxsLG51bGwsZnVuY3Rpb24oZSl7dC5wdXNoKHt1c2VyOmUuX2lkLnVzZXIsY2xvY2s6ZS5faWQuY2xvY2ssbGVuOmUubGVuLGdjOmUuZ2N9KX0pLGNvbnNvbGUudGFibGUodCl9fSx7a2V5OlwiaXNEZWxldGVkXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQodCk7cmV0dXJuIG51bGwhPT1lJiZlLl9pZC51c2VyPT09dC51c2VyJiZ0LmNsb2NrPGUuX2lkLmNsb2NrK2UubGVufX0se2tleTpcIm1hcmtcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7aWYoMCE9PWUpe3ZhciByPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKG5ldyBQdCh0LnVzZXIsdC5jbG9jay0xKSk7bnVsbCE9PXImJnIuX2lkLnVzZXI9PT10LnVzZXImJnIuX2lkLmNsb2NrPHQuY2xvY2smJnQuY2xvY2s8ci5faWQuY2xvY2srci5sZW4mJih0LmNsb2NrK2U8ci5faWQuY2xvY2srci5sZW4mJnRoaXMucHV0KG5ldyBqdChuZXcgUHQodC51c2VyLHQuY2xvY2srZSksci5faWQuY2xvY2srci5sZW4tdC5jbG9jay1lLHIuZ2MpKSxyLmxlbj10LmNsb2NrLXIuX2lkLmNsb2NrKTt2YXIgaT1uZXcgUHQodC51c2VyLHQuY2xvY2srZS0xKSxvPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKGkpO2lmKG51bGwhPT1vJiZvLl9pZC51c2VyPT09dC51c2VyJiZvLl9pZC5jbG9jazx0LmNsb2NrK2UmJnQuY2xvY2s8PW8uX2lkLmNsb2NrJiZ0LmNsb2NrK2U8by5faWQuY2xvY2srby5sZW4pe3ZhciBhPXQuY2xvY2srZS1vLl9pZC5jbG9jaztvLl9pZD1uZXcgUHQoby5faWQudXNlcixvLl9pZC5jbG9jaythKSxvLmxlbi09YX12YXIgcz1bXTt0aGlzLml0ZXJhdGUodCxpLGZ1bmN0aW9uKHQpe3MucHVzaCh0Ll9pZCl9KTtmb3IodmFyIGw9cy5sZW5ndGgtMTtsPj0wO2wtLSl0aGlzLmRlbGV0ZShzW2xdKTt2YXIgdT1uZXcganQodCxlLG4pO251bGwhPT1yJiZyLl9pZC51c2VyPT09dC51c2VyJiZyLl9pZC5jbG9jaytyLmxlbj09PXQuY2xvY2smJnIuZ2M9PT1uJiYoci5sZW4rPWUsdT1yKTt2YXIgYz10aGlzLmZpbmQobmV3IFB0KHQudXNlcix0LmNsb2NrK2UpKTtudWxsIT09YyYmYy5faWQudXNlcj09PXQudXNlciYmdC5jbG9jaytlPT09Yy5faWQuY2xvY2smJm49PT1jLmdjJiYodS5sZW4rPWMubGVuLHRoaXMuZGVsZXRlKGMuX2lkKSksciE9PXUmJnRoaXMucHV0KHUpfX19LHtrZXk6XCJtYXJrRGVsZXRlZFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5tYXJrKHQsZSwhMSl9fV0pLGV9KER0KSxWdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSl7aWYoRXQodGhpcyx0KSxlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpdGhpcy51aW50OGFycj1uZXcgVWludDhBcnJheShlKTtlbHNle2lmKCEoZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBCdWZmZXImJmUgaW5zdGFuY2VvZiBCdWZmZXIpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGFuIEFycmF5QnVmZmVyIG9yIFVpbnQ4QXJyYXkhXCIpO3RoaXMudWludDhhcnI9ZX10aGlzLnBvcz0wfXJldHVybiBVdCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciBlPWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTp0aGlzLnBvcyxuPW5ldyB0KHRoaXMudWludDhhcnIpO3JldHVybiBuLnBvcz1lLG59fSx7a2V5Olwic2tpcDhcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMucG9zKyt9fSx7a2V5OlwicmVhZFVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyclt0aGlzLnBvcysrXX19LHtrZXk6XCJyZWFkVWludDMyXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnVpbnQ4YXJyW3RoaXMucG9zXSsodGhpcy51aW50OGFyclt0aGlzLnBvcysxXTw8OCkrKHRoaXMudWludDhhcnJbdGhpcy5wb3MrMl08PDE2KSsodGhpcy51aW50OGFyclt0aGlzLnBvcyszXTw8MjQpO3JldHVybiB0aGlzLnBvcys9NCx0fX0se2tleTpcInBlZWtVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudWludDhhcnJbdGhpcy5wb3NdfX0se2tleTpcInJlYWRWYXJVaW50XCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MCxlPTA7Oyl7dmFyIG49dGhpcy51aW50OGFyclt0aGlzLnBvcysrXTtpZih0fD0oMTI3Jm4pPDxlLGUrPTcsbjwxMjgpcmV0dXJuIHQ+Pj4wO2lmKGU+MzUpdGhyb3cgbmV3IEVycm9yKFwiSW50ZWdlciBvdXQgb2YgcmFuZ2UhXCIpfX19LHtrZXk6XCJyZWFkVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9dGhpcy5yZWFkVmFyVWludCgpLGU9bmV3IEFycmF5KHQpLG49MDtuPHQ7bisrKWVbbl09dGhpcy51aW50OGFyclt0aGlzLnBvcysrXTt2YXIgcj1lLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQodCl9KS5qb2luKFwiXCIpO3JldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHIpKX19LHtrZXk6XCJwZWVrVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnBvcyxlPXRoaXMucmVhZFZhclN0cmluZygpO3JldHVybiB0aGlzLnBvcz10LGV9fSx7a2V5OlwicmVhZElEXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnJlYWRWYXJVaW50KCk7aWYodD09PXF0KXt2YXIgZT1uZXcgJHQodGhpcy5yZWFkVmFyU3RyaW5nKCksbnVsbCk7cmV0dXJuIGUudHlwZT10aGlzLnJlYWRWYXJVaW50KCksZX1yZXR1cm4gbmV3IFB0KHQsdGhpcy5yZWFkVmFyVWludCgpKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyci5sZW5ndGh9fV0pLHR9KCksTHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLl9pZD1udWxsLHRoaXMuX2xlbmd0aD0wfXJldHVybiBVdCh0LFt7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMuX2lkLHI9ZS5zcy5nZXRTdGF0ZShuLnVzZXIpO24uY2xvY2s9PT1yJiZlLnNzLnNldFN0YXRlKG4udXNlcixuLmNsb2NrK3RoaXMuX2xlbmd0aCksZS5kcy5tYXJrKHRoaXMuX2lkLHRoaXMuX2xlbmd0aCwhMCk7dmFyIGk9ZS5vcy5wdXQodGhpcyksbz1pLnByZXYoKS52YWw7bnVsbCE9PW8mJm8uY29uc3RydWN0b3I9PT10JiZvLl9pZC51c2VyPT09aS52YWwuX2lkLnVzZXImJm8uX2lkLmNsb2NrK28uX2xlbmd0aD09PWkudmFsLl9pZC5jbG9jayYmKG8uX2xlbmd0aCs9aS52YWwuX2xlbmd0aCxlLm9zLmRlbGV0ZShpLnZhbC5faWQpLGk9byksaS52YWwmJihpPWkudmFsKTt2YXIgYT1lLm9zLmZpbmROZXh0KGkuX2lkKTtudWxsIT09YSYmYS5jb25zdHJ1Y3Rvcj09PXQmJmEuX2lkLnVzZXI9PT1pLl9pZC51c2VyJiZhLl9pZC5jbG9jaz09PWkuX2lkLmNsb2NrK2kuX2xlbmd0aCYmKGkuX2xlbmd0aCs9YS5fbGVuZ3RoLGUub3MuZGVsZXRlKGEuX2lkKSksbi51c2VyIT09cXQmJihudWxsPT09ZS5jb25uZWN0b3J8fCFlLmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzJiZuLnVzZXIhPT1lLnVzZXJJRHx8ZS5jb25uZWN0b3IuYnJvYWRjYXN0U3RydWN0KHRoaXMpLG51bGwhPT1lLnBlcnNpc3RlbmNlJiZlLnBlcnNpc3RlbmNlLnNhdmVTdHJ1Y3QoZSx0aGlzKSl9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7dC53cml0ZVVpbnQ4KCQodGhpcy5jb25zdHJ1Y3RvcikpLHQud3JpdGVJRCh0aGlzLl9pZCksdC53cml0ZVZhclVpbnQodGhpcy5fbGVuZ3RoKX19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49ZS5yZWFkSUQoKTt0aGlzLl9pZD1uLHRoaXMuX2xlbmd0aD1lLnJlYWRWYXJVaW50KCk7dmFyIHI9W107cmV0dXJuIHQuc3MuZ2V0U3RhdGUobi51c2VyKTxuLmNsb2NrJiZyLnB1c2gobmV3IFB0KG4udXNlcixuLmNsb2NrLTEpKSxyfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpc319LHtrZXk6XCJfY2xvbmVQYXJ0aWFsXCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49bmV3IHQ7cmV0dXJuIG4uX2lkPW5ldyBQdCh0aGlzLl9pZC51c2VyLHRoaXMuX2lkLmNsb2NrK2UpLG4uX2xlbmd0aD10aGlzLl9sZW5ndGgtZSxufX0se2tleTpcIl9kZWxldGVkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITB9fV0pLHR9KCksTXQ9ZnVuY3Rpb24gdChlLG4scil7RXQodGhpcyx0KSx0aGlzLmRlY29kZXI9ZSx0aGlzLm1pc3Npbmc9bi5sZW5ndGgsdGhpcy5zdHJ1Y3Q9cn0sQ3Q9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLmRhdGE9W119cmV0dXJuIFV0KHQsW3trZXk6XCJjcmVhdGVCdWZmZXJcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBVaW50OEFycmF5LmZyb20odGhpcy5kYXRhKS5idWZmZXJ9fSx7a2V5Olwid3JpdGVVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZGF0YS5wdXNoKDI1NSZ0KX19LHtrZXk6XCJzZXRVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5kYXRhW3RdPTI1NSZlfX0se2tleTpcIndyaXRlVWludDE2XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5kYXRhLnB1c2goMjU1JnQsdD4+PjgmMjU1KX19LHtrZXk6XCJzZXRVaW50MTZcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMuZGF0YVt0XT0yNTUmZSx0aGlzLmRhdGFbdCsxXT1lPj4+OCYyNTV9fSx7a2V5Olwid3JpdGVVaW50MzJcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9MDtlPDQ7ZSsrKXRoaXMuZGF0YS5wdXNoKDI1NSZ0KSx0Pj4+PTh9fSx7a2V5Olwic2V0VWludDMyXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtmb3IodmFyIG49MDtuPDQ7bisrKXRoaXMuZGF0YVt0K25dPTI1NSZlLGU+Pj49OH19LHtrZXk6XCJ3cml0ZVZhclVpbnRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IoO3Q+PTEyODspdGhpcy5kYXRhLnB1c2goMTI4fDEyNyZ0KSx0Pj4+PTc7dGhpcy5kYXRhLnB1c2goMTI3JnQpfX0se2tleTpcIndyaXRlVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24odCl7XG52YXIgZT11bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQodCkpLG49ZS5zcGxpdChcIlwiKS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQuY29kZVBvaW50QXQoKX0pLHI9bi5sZW5ndGg7dGhpcy53cml0ZVZhclVpbnQocik7Zm9yKHZhciBpPTA7aTxyO2krKyl0aGlzLmRhdGEucHVzaChuW2ldKX19LHtrZXk6XCJ3cml0ZUlEXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dC51c2VyO3RoaXMud3JpdGVWYXJVaW50KGUpLGUhPT1xdD90aGlzLndyaXRlVmFyVWludCh0LmNsb2NrKToodGhpcy53cml0ZVZhclN0cmluZyh0Lm5hbWUpLHRoaXMud3JpdGVWYXJVaW50KHQudHlwZSkpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRhdGEubGVuZ3RofX0se2tleTpcInBvc1wiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRhdGEubGVuZ3RofX1dKSx0fSgpLERlbGV0ZT1mdW5jdGlvbigpe2Z1bmN0aW9uIERlbGV0ZSgpe0V0KHRoaXMsRGVsZXRlKSx0aGlzLl90YXJnZXQ9bnVsbCx0aGlzLl9sZW5ndGg9bnVsbH1yZXR1cm4gVXQoRGVsZXRlLFt7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPWUucmVhZElEKCk7cmV0dXJuIHRoaXMuX3RhcmdldElEPW4sdGhpcy5fbGVuZ3RoPWUucmVhZFZhclVpbnQoKSxudWxsPT09dC5vcy5nZXRJdGVtKG4pP1tuXTpbXX19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXt0LndyaXRlVWludDgoJCh0aGlzLmNvbnN0cnVjdG9yKSksdC53cml0ZUlEKHRoaXMuX3RhcmdldElEKSx0LndyaXRlVmFyVWludCh0aGlzLl9sZW5ndGgpfX0se2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSYmYXJndW1lbnRzWzFdKW51bGwhPT10LmNvbm5lY3RvciYmdC5jb25uZWN0b3IuYnJvYWRjYXN0U3RydWN0KHRoaXMpO2Vsc2V7dmFyIGU9dGhpcy5fdGFyZ2V0SUQ7Zyh0LGUudXNlcixlLmNsb2NrLHRoaXMuX2xlbmd0aCwhMSl9bnVsbCE9PXQucGVyc2lzdGVuY2UmJnQucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdCh0LHRoaXMpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVyblwiRGVsZXRlIC0gdGFyZ2V0OiBcIitwKHRoaXMuX3RhcmdldElEKStcIiwgbGVuOiBcIit0aGlzLl9sZW5ndGh9fV0pLERlbGV0ZX0oKSxSdD1mdW5jdGlvbiB0KGUpe0V0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5uZXdUeXBlcz1uZXcgU2V0LHRoaXMuY2hhbmdlZFR5cGVzPW5ldyBNYXAsdGhpcy5kZWxldGVkU3RydWN0cz1uZXcgU2V0LHRoaXMuYmVmb3JlU3RhdGU9bmV3IE1hcCx0aGlzLmNoYW5nZWRQYXJlbnRUeXBlcz1uZXcgTWFwfSxJdGVtPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gSXRlbSgpe0V0KHRoaXMsSXRlbSksdGhpcy5faWQ9bnVsbCx0aGlzLl9vcmlnaW49bnVsbCx0aGlzLl9sZWZ0PW51bGwsdGhpcy5fcmlnaHQ9bnVsbCx0aGlzLl9yaWdodF9vcmlnaW49bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbCx0aGlzLl9wYXJlbnRTdWI9bnVsbCx0aGlzLl9kZWxldGVkPSExLHRoaXMuX3JlZG9uZT1udWxsfXJldHVybiBVdChJdGVtLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcn19LHtrZXk6XCJfcmVkb1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7aWYobnVsbCE9PXRoaXMuX3JlZG9uZSlyZXR1cm4gdGhpcy5fcmVkb25lO3ZhciBuPXRoaXMuX2NvcHkoKSxyPXRoaXMuX2xlZnQsaT10aGlzLG89dGhpcy5fcGFyZW50O2lmKCEoITAhPT1vLl9kZWxldGVkfHxudWxsIT09by5fcmVkb25lfHxlLmhhcyhvKSYmby5fcmVkbyh0LGUpKSlyZXR1cm4hMTtpZihudWxsIT09by5fcmVkb25lKXtmb3Iobz1vLl9yZWRvbmU7bnVsbCE9PXI7KXtpZihudWxsIT09ci5fcmVkb25lJiZyLl9yZWRvbmUuX3BhcmVudD09PW8pe3I9ci5fcmVkb25lO2JyZWFrfXI9ci5fbGVmdH1mb3IoO251bGwhPT1pOyludWxsIT09aS5fcmVkb25lJiZpLl9yZWRvbmUuX3BhcmVudD09PW8mJihpPWkuX3JlZG9uZSksaT1pLl9yaWdodH1yZXR1cm4gbi5fb3JpZ2luPXIsbi5fbGVmdD1yLG4uX3JpZ2h0PWksbi5fcmlnaHRfb3JpZ2luPWksbi5fcGFyZW50PW8sbi5fcGFyZW50U3ViPXRoaXMuX3BhcmVudFN1YixuLl9pbnRlZ3JhdGUodCksdGhpcy5fcmVkb25lPW4sITB9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3JldHVybiAwPT09ZT90aGlzOnRoaXMuX3JpZ2h0fX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT0hKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdKXx8YXJndW1lbnRzWzFdO2lmKCF0aGlzLl9kZWxldGVkKXt0aGlzLl9kZWxldGVkPSEwLHQuZHMubWFyayh0aGlzLl9pZCx0aGlzLl9sZW5ndGgsITEpO3ZhciBuPW5ldyBEZWxldGU7bi5fdGFyZ2V0SUQ9dGhpcy5faWQsbi5fbGVuZ3RoPXRoaXMuX2xlbmd0aCxlP24uX2ludGVncmF0ZSh0LCEwKTpudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsbiksbSh0LHRoaXMuX3BhcmVudCx0aGlzLl9wYXJlbnRTdWIpLHQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmFkZCh0aGlzKX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9bmV3IEx0O2UuX2lkPXRoaXMuX2lkLGUuX2xlbmd0aD10aGlzLl9sZW5ndGgsdC5vcy5kZWxldGUodGhpcy5faWQpLGUuX2ludGVncmF0ZSh0KX19LHtrZXk6XCJfYmVmb3JlQ2hhbmdlXCIsdmFsdWU6ZnVuY3Rpb24oKXt9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3QuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmFkZCh0aGlzKTt2YXIgZT10aGlzLl9wYXJlbnQsbj10aGlzLl9pZCxyPW51bGw9PT1uP3QudXNlcklEOm4udXNlcixpPXQuc3MuZ2V0U3RhdGUocik7aWYobnVsbD09PW4pdGhpcy5faWQ9dC5zcy5nZXROZXh0SUQodGhpcy5fbGVuZ3RoKTtlbHNlIGlmKG4udXNlcj09PXF0KTtlbHNle2lmKG4uY2xvY2s8aSlyZXR1cm5bXTtpZihuLmNsb2NrIT09aSl0aHJvdyBuZXcgRXJyb3IoXCJDYW4gbm90IGFwcGx5IHlldCFcIik7dC5zcy5zZXRTdGF0ZShuLnVzZXIsaSt0aGlzLl9sZW5ndGgpfWUuX2RlbGV0ZWR8fHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5oYXMoZSl8fHQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKXx8dGhpcy5fcGFyZW50Ll9iZWZvcmVDaGFuZ2UoKTt2YXIgbz12b2lkIDA7bz1udWxsIT09dGhpcy5fbGVmdD90aGlzLl9sZWZ0Ll9yaWdodDpudWxsIT09dGhpcy5fcGFyZW50U3ViP3RoaXMuX3BhcmVudC5fbWFwLmdldCh0aGlzLl9wYXJlbnRTdWIpfHxudWxsOnRoaXMuX3BhcmVudC5fc3RhcnQ7Zm9yKHZhciBhPW5ldyBTZXQscz1uZXcgU2V0O251bGwhPT1vJiZvIT09dGhpcy5fcmlnaHQ7KXtpZihzLmFkZChvKSxhLmFkZChvKSx0aGlzLl9vcmlnaW49PT1vLl9vcmlnaW4pby5faWQudXNlcjx0aGlzLl9pZC51c2VyJiYodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSk7ZWxzZXtpZighcy5oYXMoby5fb3JpZ2luKSlicmVhazthLmhhcyhvLl9vcmlnaW4pfHwodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSl9bz1vLl9yaWdodH12YXIgbD10aGlzLl9wYXJlbnRTdWI7aWYobnVsbD09PXRoaXMuX2xlZnQpe3ZhciB1PXZvaWQgMDtpZihudWxsIT09bCl7dmFyIGM9ZS5fbWFwO3U9Yy5nZXQobCl8fG51bGwsYy5zZXQobCx0aGlzKX1lbHNlIHU9ZS5fc3RhcnQsZS5fc3RhcnQ9dGhpczt0aGlzLl9yaWdodD11LG51bGwhPT11JiYodS5fbGVmdD10aGlzKX1lbHNle3ZhciBoPXRoaXMuX2xlZnQsZj1oLl9yaWdodDt0aGlzLl9yaWdodD1mLGguX3JpZ2h0PXRoaXMsbnVsbCE9PWYmJihmLl9sZWZ0PXRoaXMpfWUuX2RlbGV0ZWQmJnRoaXMuX2RlbGV0ZSh0LCExKSx0Lm9zLnB1dCh0aGlzKSxtKHQsZSxsKSx0aGlzLl9pZC51c2VyIT09cXQmJihudWxsPT09dC5jb25uZWN0b3J8fCF0LmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzJiZ0aGlzLl9pZC51c2VyIT09dC51c2VySUR8fHQuY29ubmVjdG9yLmJyb2FkY2FzdFN0cnVjdCh0aGlzKSxudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsdGhpcykpfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKTt2YXIgZT0wO251bGwhPT10aGlzLl9vcmlnaW4mJihlKz0xKSxudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYoZSs9NCksbnVsbCE9PXRoaXMuX3BhcmVudFN1YiYmKGUrPTgpLHQud3JpdGVVaW50OChlKSx0LndyaXRlSUQodGhpcy5faWQpLDEmZSYmdC53cml0ZUlEKHRoaXMuX29yaWdpbi5fbGFzdElkKSw0JmUmJnQud3JpdGVJRCh0aGlzLl9yaWdodF9vcmlnaW4uX2lkKSwwPT0oNSZlKSYmdC53cml0ZUlEKHRoaXMuX3BhcmVudC5faWQpLDgmZSYmdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLl9wYXJlbnRTdWIpKX19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49W10scj1lLnJlYWRVaW50OCgpLGk9ZS5yZWFkSUQoKTtpZih0aGlzLl9pZD1pLDEmcil7dmFyIG89ZS5yZWFkSUQoKSxhPXQub3MuZ2V0SXRlbUNsZWFuRW5kKG8pO251bGw9PT1hP24ucHVzaChvKToodGhpcy5fb3JpZ2luPWEsdGhpcy5fbGVmdD10aGlzLl9vcmlnaW4pfWlmKDQmcil7dmFyIHM9ZS5yZWFkSUQoKSxsPXQub3MuZ2V0SXRlbUNsZWFuU3RhcnQocyk7bnVsbD09PWw/bi5wdXNoKHMpOih0aGlzLl9yaWdodD1sLHRoaXMuX3JpZ2h0X29yaWdpbj1sKX1pZigwPT0oNSZyKSl7dmFyIHU9ZS5yZWFkSUQoKTtpZihudWxsPT09dGhpcy5fcGFyZW50KXt2YXIgYz12b2lkIDA7Yz11LmNvbnN0cnVjdG9yPT09JHQ/dC5vcy5nZXQodSk6dC5vcy5nZXRJdGVtKHUpLG51bGw9PT1jP24ucHVzaCh1KTp0aGlzLl9wYXJlbnQ9Y319ZWxzZSBudWxsPT09dGhpcy5fcGFyZW50JiYobnVsbCE9PXRoaXMuX29yaWdpbj90aGlzLl9vcmlnaW4uY29uc3RydWN0b3I9PT1MdD90aGlzLl9wYXJlbnQ9dGhpcy5fb3JpZ2luOnRoaXMuX3BhcmVudD10aGlzLl9vcmlnaW4uX3BhcmVudDpudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYodGhpcy5fcmlnaHRfb3JpZ2luLmNvbnN0cnVjdG9yPT09THQ/dGhpcy5fcGFyZW50PXRoaXMuX3JpZ2h0X29yaWdpbjp0aGlzLl9wYXJlbnQ9dGhpcy5fcmlnaHRfb3JpZ2luLl9wYXJlbnQpKTtyZXR1cm4gOCZyJiYodGhpcy5fcGFyZW50U3ViPUpTT04ucGFyc2UoZS5yZWFkVmFyU3RyaW5nKCkpKSx0LnNzLmdldFN0YXRlKGkudXNlcik8aS5jbG9jayYmbi5wdXNoKG5ldyBQdChpLnVzZXIsaS5jbG9jay0xKSksbn19LHtrZXk6XCJfbGFzdElkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBQdCh0aGlzLl9pZC51c2VyLHRoaXMuX2lkLmNsb2NrK3RoaXMuX2xlbmd0aC0xKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fSx7a2V5OlwiX2NvdW50YWJsZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiEwfX1dKSxJdGVtfSgpLFd0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe0V0KHRoaXMsdCksdGhpcy5ldmVudExpc3RlbmVycz1bXX1yZXR1cm4gVXQodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZXZlbnRMaXN0ZW5lcnM9bnVsbH19LHtrZXk6XCJhZGRFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5ldmVudExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcInJlbW92ZUV2ZW50TGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmV2ZW50TGlzdGVuZXJzPXRoaXMuZXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiB0IT09ZX0pfX0se2tleTpcInJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50TGlzdGVuZXJzPVtdfX0se2tleTpcImNhbGxFdmVudExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7Zm9yKHZhciBuPTA7bjx0aGlzLmV2ZW50TGlzdGVuZXJzLmxlbmd0aDtuKyspdHJ5eygwLHRoaXMuZXZlbnRMaXN0ZW5lcnNbbl0pKGUpfWNhdGNoKHQpe2NvbnNvbGUuZXJyb3IodCl9fX1dKSx0fSgpLFR5cGU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gVHlwZSgpe0V0KHRoaXMsVHlwZSk7dmFyIHQ9QXQodGhpcywoVHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX21hcD1uZXcgTWFwLHQuX3N0YXJ0PW51bGwsdC5feT1udWxsLHQuX2V2ZW50SGFuZGxlcj1uZXcgV3QsdC5fZGVlcEV2ZW50SGFuZGxlcj1uZXcgV3QsdH1yZXR1cm4gVHQoVHlwZSx0KSxVdChUeXBlLFt7a2V5OlwiZ2V0UGF0aFRvXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodD09PXRoaXMpcmV0dXJuW107Zm9yKHZhciBlPVtdLG49dGhpcy5feTt0IT09dGhpcyYmdCE9PW47KXt2YXIgcj10Ll9wYXJlbnQ7aWYobnVsbCE9PXQuX3BhcmVudFN1YillLnVuc2hpZnQodC5fcGFyZW50U3ViKTtlbHNle3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXJbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9eHQocy52YWx1ZSwyKSxjPXVbMF07aWYodVsxXT09PXQpe2UudW5zaGlmdChjKTticmVha319fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fXQ9cn1pZih0IT09dGhpcyl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgdHlwZSBpcyBub3QgYSBjaGlsZCBvZiB0aGlzIG5vZGVcIik7cmV0dXJuIGV9fSx7a2V5OlwiX2NhbGxFdmVudEhhbmRsZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXQuY2hhbmdlZFBhcmVudFR5cGVzO3RoaXMuX2V2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnModCxlKTtmb3IodmFyIHI9dGhpcztyIT09dGhpcy5feTspe3ZhciBpPW4uZ2V0KHIpO3ZvaWQgMD09PWkmJihpPVtdLG4uc2V0KHIsaSkpLGkucHVzaChlKSxyPXIuX3BhcmVudH19fSx7a2V5OlwiX3RyYW5zYWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5feTtudWxsIT09ZT9lLnRyYW5zYWN0KHQpOnQoZSl9fSx7a2V5Olwib2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcIm9ic2VydmVEZWVwXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZGVlcEV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCksdGhpcy5feT10O3ZhciBlPXRoaXMuX3N0YXJ0O251bGwhPT1lJiYodGhpcy5fc3RhcnQ9bnVsbCxiKHQsZSkpO3ZhciBuPXRoaXMuX21hcDt0aGlzLl9tYXA9bmV3IE1hcDt2YXIgcj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz1uLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe2IodCxhLnZhbHVlKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt3KHQsdGhpcy5fc3RhcnQpLHRoaXMuX3N0YXJ0PW51bGwsdGhpcy5fbWFwLmZvckVhY2goZnVuY3Rpb24oZSl7dyh0LGUpfSksdGhpcy5fbWFwPW5ldyBNYXB9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZ2NDaGlsZHJlbih0KSxCdChUeXBlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlLnByb3RvdHlwZSksXCJfZ2NcIix0aGlzKS5jYWxsKHRoaXMsdCl9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2b2lkIDAhPT1uJiZ0LmdjRW5hYmxlZHx8KG49ITE9PT10Ll9oYXNVbmRvTWFuYWdlciYmdC5nY0VuYWJsZWQpLEJ0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pLHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5kZWxldGUodGhpcyk7dmFyIHI9ITAsaT0hMSxvPXZvaWQgMDt0cnl7Zm9yKHZhciBhLHM9dGhpcy5fbWFwLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe3ZhciBsPWEudmFsdWU7bCBpbnN0YW5jZW9mIEl0ZW0mJiFsLl9kZWxldGVkJiZsLl9kZWxldGUodCwhMSxuKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX1mb3IodmFyIHU9dGhpcy5fc3RhcnQ7bnVsbCE9PXU7KXUuX2RlbGV0ZWR8fHUuX2RlbGV0ZSh0LCExLG4pLHU9dS5fcmlnaHQ7biYmdGhpcy5fZ2NDaGlsZHJlbih0KX19XSksVHlwZX0oSXRlbSksSXRlbUpTT049ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbUpTT04oKXtFdCh0aGlzLEl0ZW1KU09OKTt2YXIgdD1BdCh0aGlzLChJdGVtSlNPTi5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTikpLmNhbGwodGhpcykpO3JldHVybiB0Ll9jb250ZW50PW51bGwsdH1yZXR1cm4gVHQoSXRlbUpTT04sdCksVXQoSXRlbUpTT04sW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9QnQoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQuX2NvbnRlbnQ9dGhpcy5fY29udGVudCx0fX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1CdChJdGVtSlNPTi5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04ucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSkscj1lLnJlYWRWYXJVaW50KCk7dGhpcy5fY29udGVudD1uZXcgQXJyYXkocik7Zm9yKHZhciBpPTA7aTxyO2krKyl7dmFyIG89ZS5yZWFkVmFyU3RyaW5nKCksYT12b2lkIDA7YT1cInVuZGVmaW5lZFwiPT09bz92b2lkIDA6SlNPTi5wYXJzZShvKSx0aGlzLl9jb250ZW50W2ldPWF9cmV0dXJuIG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCk7dmFyIGU9dGhpcy5fY29udGVudC5sZW5ndGg7dC53cml0ZVZhclVpbnQoZSk7Zm9yKHZhciBuPTA7bjxlO24rKyl7dmFyIHI9dm9pZCAwLGk9dGhpcy5fY29udGVudFtuXTtyPXZvaWQgMD09PWk/XCJ1bmRlZmluZWRcIjpKU09OLnN0cmluZ2lmeShpKSx0LndyaXRlVmFyU3RyaW5nKHIpfX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1KU09OXCIsdGhpcyxcImNvbnRlbnQ6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy5fY29udGVudCkpfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZigwPT09ZSlyZXR1cm4gdGhpcztpZihlPj10aGlzLl9sZW5ndGgpcmV0dXJuIHRoaXMuX3JpZ2h0O3ZhciBuPW5ldyBJdGVtSlNPTjtyZXR1cm4gbi5fY29udGVudD10aGlzLl9jb250ZW50LnNwbGljZShlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbUpTT059KEl0ZW0pLEl0ZW1TdHJpbmc9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbVN0cmluZygpe0V0KHRoaXMsSXRlbVN0cmluZyk7dmFyIHQ9QXQodGhpcywoSXRlbVN0cmluZy5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX2NvbnRlbnQ9bnVsbCx0fXJldHVybiBUdChJdGVtU3RyaW5nLHQpLFV0KEl0ZW1TdHJpbmcsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9QnQoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Ll9jb250ZW50PXRoaXMuX2NvbnRlbnQsdH19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49QnQoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5fY29udGVudD1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KEl0ZW1TdHJpbmcucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMuX2NvbnRlbnQpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbVN0cmluZ1wiLHRoaXMsJ2NvbnRlbnQ6XCInK3RoaXMuX2NvbnRlbnQrJ1wiJyl9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKDA9PT1lKXJldHVybiB0aGlzO2lmKGU+PXRoaXMuX2xlbmd0aClyZXR1cm4gdGhpcy5fcmlnaHQ7dmFyIG49bmV3IEl0ZW1TdHJpbmc7cmV0dXJuIG4uX2NvbnRlbnQ9dGhpcy5fY29udGVudC5zbGljZShlKSx0aGlzLl9jb250ZW50PXRoaXMuX2NvbnRlbnQuc2xpY2UoMCxlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbVN0cmluZ30oSXRlbSksWUV2ZW50PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gWUV2ZW50KHQpe0V0KHRoaXMsWUV2ZW50KSx0aGlzLnRhcmdldD10LHRoaXMuY3VycmVudFRhcmdldD10fXJldHVybiBVdChZRXZlbnQsW3trZXk6XCJwYXRoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY3VycmVudFRhcmdldC5nZXRQYXRoVG8odGhpcy50YXJnZXQpfX1dKSxZRXZlbnR9KCksWUFycmF5RXZlbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWUFycmF5RXZlbnQodCxlLG4pe0V0KHRoaXMsWUFycmF5RXZlbnQpO3ZhciByPUF0KHRoaXMsKFlBcnJheUV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheUV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5yZW1vdGU9ZSxyLl90cmFuc2FjdGlvbj1uLHIuX2FkZGVkRWxlbWVudHM9bnVsbCxyLl9yZW1vdmVkRWxlbWVudHM9bnVsbCxyfXJldHVybiBUdChZQXJyYXlFdmVudCx0KSxVdChZQXJyYXlFdmVudCxbe2tleTpcImFkZGVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fYWRkZWRFbGVtZW50cyl7dmFyIHQ9dGhpcy50YXJnZXQsZT10aGlzLl90cmFuc2FjdGlvbixuPW5ldyBTZXQ7ZS5uZXdUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHIpe3IuX3BhcmVudCE9PXR8fGUuZGVsZXRlZFN0cnVjdHMuaGFzKHIpfHxuLmFkZChyKX0pLHRoaXMuX2FkZGVkRWxlbWVudHM9bn1yZXR1cm4gdGhpcy5fYWRkZWRFbGVtZW50c319LHtrZXk6XCJyZW1vdmVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fcmVtb3ZlZEVsZW1lbnRzKXt2YXIgdD10aGlzLnRhcmdldCxlPXRoaXMuX3RyYW5zYWN0aW9uLG49bmV3IFNldDtlLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24ocil7ci5fcGFyZW50IT09dHx8ZS5uZXdUeXBlcy5oYXMocil8fG4uYWRkKHIpfSksdGhpcy5fcmVtb3ZlZEVsZW1lbnRzPW59cmV0dXJuIHRoaXMuX3JlbW92ZWRFbGVtZW50c319XSksWUFycmF5RXZlbnR9KFlFdmVudCksWUFycmF5PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlBcnJheSgpe3JldHVybiBFdCh0aGlzLFlBcnJheSksQXQodGhpcywoWUFycmF5Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheSkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KFlBcnJheSx0KSxVdChZQXJyYXksW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWUFycmF5RXZlbnQodGhpcyxuLHQpKX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KXtpZighZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlKXtpZih0PGUuX2xlbmd0aClyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PUl0ZW1KU09OfHxlLmNvbnN0cnVjdG9yPT09SXRlbVN0cmluZz9lLl9jb250ZW50W3RdOmU7dC09ZS5fbGVuZ3RofWU9ZS5fcmlnaHR9fX0se2tleTpcInRvQXJyYXlcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdH0pfX0se2tleTpcInRvSlNPTlwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0IGluc3RhbmNlb2YgVHlwZT9udWxsIT09dC50b0pTT04/dC50b0pTT04oKTp0LnRvU3RyaW5nKCk6dH0pfX0se2tleTpcIm1hcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1bXTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHIsaSl7bi5wdXNoKHQocixpLGUpKX0pLG59fSx7a2V5OlwiZm9yRWFjaFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wLG49dGhpcy5fc3RhcnQ7bnVsbCE9PW47KXtpZighbi5fZGVsZXRlZCYmbi5fY291bnRhYmxlKWlmKG4gaW5zdGFuY2VvZiBUeXBlKXQobixlKyssdGhpcyk7ZWxzZSBmb3IodmFyIHI9bi5fY29udGVudCxpPXIubGVuZ3RoLG89MDtvPGk7bysrKWUrKyx0KHJbb10sZSx0aGlzKTtuPW4uX3JpZ2h0fX19LHtrZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJue25leHQ6ZnVuY3Rpb24oKXtmb3IoO251bGwhPT10aGlzLl9pdGVtJiYodGhpcy5faXRlbS5fZGVsZXRlZHx8dGhpcy5faXRlbS5fbGVuZ3RoPD10aGlzLl9pdGVtRWxlbWVudCk7KXRoaXMuX2l0ZW09dGhpcy5faXRlbS5fcmlnaHQsdGhpcy5faXRlbUVsZW1lbnQ9MDtpZihudWxsPT09dGhpcy5faXRlbSlyZXR1cm57ZG9uZTohMH07dmFyIHQ9dm9pZCAwO3JldHVybiB0PXRoaXMuX2l0ZW0gaW5zdGFuY2VvZiBUeXBlP3RoaXMuX2l0ZW06dGhpcy5faXRlbS5fY29udGVudFt0aGlzLl9pdGVtRWxlbWVudCsrXSx7dmFsdWU6dCxkb25lOiExfX0sX2l0ZW06dGhpcy5fc3RhcnQsX2l0ZW1FbGVtZW50OjAsX2NvdW50OjB9fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06MTtpZih0aGlzLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7Zm9yKHZhciByPWUuX3N0YXJ0LGk9MDtudWxsIT09ciYmbj4wOyl7aWYoIXIuX2RlbGV0ZWQmJnIuX2NvdW50YWJsZSlpZihpPD10JiZ0PGkrci5fbGVuZ3RoKXt2YXIgbz10LWk7cj1yLl9zcGxpdEF0KGUuX3ksbyksci5fc3BsaXRBdChlLl95LG4pLG4tPXIuX2xlbmd0aCxyLl9kZWxldGUoZS5feSksaSs9b31lbHNlIGkrPXIuX2xlbmd0aDtyPXIuX3JpZ2h0fX0pLG4+MCl0aHJvdyBuZXcgRXJyb3IoXCJEZWxldGUgZXhjZWVkcyB0aGUgcmFuZ2Ugb2YgdGhlIFlBcnJheVwiKX19LHtrZXk6XCJpbnNlcnRBZnRlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcztyZXR1cm4gdGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24ocil7dmFyIGk9dm9pZCAwO2k9bnVsbD09PXQ/bi5fc3RhcnQ6dC5fcmlnaHQ7Zm9yKHZhciBvPW51bGwsYT0wO2E8ZS5sZW5ndGg7YSsrKXt2YXIgcz1lW2FdO1wiZnVuY3Rpb25cIj09dHlwZW9mIHMmJihzPW5ldyBzKSxzIGluc3RhbmNlb2YgVHlwZT8obnVsbCE9PW8mJihudWxsIT09ciYmby5faW50ZWdyYXRlKHIpLHQ9byxvPW51bGwpLHMuX29yaWdpbj10LHMuX2xlZnQ9dCxzLl9yaWdodD1pLHMuX3JpZ2h0X29yaWdpbj1pLHMuX3BhcmVudD1uLG51bGwhPT1yP3MuX2ludGVncmF0ZShyKTpudWxsPT09dD9uLl9zdGFydD1zOnQuX3JpZ2h0PXMsdD1zKToobnVsbD09PW8mJihvPW5ldyBJdGVtSlNPTixvLl9vcmlnaW49dCxvLl9sZWZ0PXQsby5fcmlnaHQ9aSxvLl9yaWdodF9vcmlnaW49aSxvLl9wYXJlbnQ9bixvLl9jb250ZW50PVtdKSxvLl9jb250ZW50LnB1c2gocykpfW51bGwhPT1vJiYobnVsbCE9PXI/by5faW50ZWdyYXRlKHIpOm51bGw9PT1vLl9sZWZ0JiYobi5fc3RhcnQ9bykpfSksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IodmFyIHI9bnVsbCxpPW4uX3N0YXJ0LG89MCxhPW4uX3k7bnVsbCE9PWk7KXt2YXIgcz1pLl9kZWxldGVkPzA6aS5fbGVuZ3RoLTE7aWYobzw9dCYmdDw9bytzKXt2YXIgbD10LW87aT1pLl9zcGxpdEF0KGEsbCkscj1pLl9sZWZ0LG8rPWw7YnJlYWt9aS5fZGVsZXRlZHx8KG8rPWkuX2xlbmd0aCkscj1pLGk9aS5fcmlnaHR9aWYodD5vKXRocm93IG5ldyBFcnJvcihcIkluZGV4IGV4Y2VlZHMgYXJyYXkgcmFuZ2UhXCIpO24uaW5zZXJ0QWZ0ZXIocixlKX0pfX0se2tleTpcInB1c2hcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQsbj1udWxsO251bGwhPT1lOyllLl9kZWxldGVkfHwobj1lKSxlPWUuX3JpZ2h0O3RoaXMuaW5zZXJ0QWZ0ZXIobix0KX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllBcnJheVwiLHRoaXMsXCJzdGFydDpcIitwKHRoaXMuX3N0YXJ0KSsnXCInKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MCxlPXRoaXMuX3N0YXJ0O251bGwhPT1lOykhZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlJiYodCs9ZS5fbGVuZ3RoKSxlPWUuX3JpZ2h0O3JldHVybiB0fX1dKSxZQXJyYXl9KFR5cGUpLFlNYXBFdmVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZTWFwRXZlbnQodCxlLG4pe0V0KHRoaXMsWU1hcEV2ZW50KTt2YXIgcj1BdCh0aGlzLChZTWFwRXZlbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWU1hcEV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5rZXlzQ2hhbmdlZD1lLHIucmVtb3RlPW4scn1yZXR1cm4gVHQoWU1hcEV2ZW50LHQpLFlNYXBFdmVudH0oWUV2ZW50KSxZTWFwPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlNYXAoKXtyZXR1cm4gRXQodGhpcyxZTWFwKSxBdCh0aGlzLChZTWFwLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlNYXApKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZTWFwLHQpLFV0KFlNYXAsW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWU1hcEV2ZW50KHRoaXMsZSxuKSl9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD17fSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07aWYoIWwuX2RlbGV0ZWQpe3ZhciB1PXZvaWQgMDt1PWwgaW5zdGFuY2VvZiBUeXBlP3ZvaWQgMCE9PWwudG9KU09OP2wudG9KU09OKCk6bC50b1N0cmluZygpOmwuX2NvbnRlbnRbMF0sdFtzXT11fX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJrZXlzXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXTthWzFdLl9kZWxldGVkfHx0LnB1c2gocyl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19cmV0dXJuIHR9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihuKXt2YXIgcj1lLl9tYXAuZ2V0KHQpO251bGwhPT1uJiZ2b2lkIDAhPT1yJiZyLl9kZWxldGUobil9KX19LHtrZXk6XCJzZXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7cmV0dXJuIHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKHIpe3ZhciBpPW4uX21hcC5nZXQodCl8fG51bGw7aWYobnVsbCE9PWkpe2lmKGkuY29uc3RydWN0b3I9PT1JdGVtSlNPTiYmIWkuX2RlbGV0ZWQmJmkuX2NvbnRlbnRbMF09PT1lKXJldHVybiBlO251bGwhPT1yJiZpLl9kZWxldGUocil9dmFyIG89dm9pZCAwO1wiZnVuY3Rpb25cIj09dHlwZW9mIGU/KG89bmV3IGUsZT1vKTplIGluc3RhbmNlb2YgSXRlbT9vPWU6KG89bmV3IEl0ZW1KU09OLG8uX2NvbnRlbnQ9W2VdKSxvLl9yaWdodD1pLG8uX3JpZ2h0X29yaWdpbj1pLG8uX3BhcmVudD1uLG8uX3BhcmVudFN1Yj10LG51bGwhPT1yP28uX2ludGVncmF0ZShyKTpuLl9tYXAuc2V0KHQsbyl9KSxlfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX21hcC5nZXQodCk7aWYodm9pZCAwIT09ZSYmIWUuX2RlbGV0ZWQpcmV0dXJuIGUgaW5zdGFuY2VvZiBUeXBlP2U6ZS5fY29udGVudFtlLl9jb250ZW50Lmxlbmd0aC0xXX19LHtrZXk6XCJoYXNcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9tYXAuZ2V0KHQpO3JldHVybiB2b2lkIDAhPT1lJiYhZS5fZGVsZXRlZH19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllNYXBcIix0aGlzLFwibWFwU2l6ZTpcIit0aGlzLl9tYXAuc2l6ZSl9fV0pLFlNYXB9KFR5cGUpLEh0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtFdCh0aGlzLGUpO3ZhciB0PUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmVtYmVkPW51bGwsdH1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHIuZW1iZWQ9dGhpcy5lbWJlZCxyfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1CdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiB0aGlzLmVtYmVkPUpTT04ucGFyc2Uobi5yZWFkVmFyU3RyaW5nKCkpLHJ9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcoSlNPTi5zdHJpbmdpZnkodGhpcy5lbWJlZCkpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbUVtYmVkXCIsdGhpcyxcImVtYmVkOlwiK0pTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWQpKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fV0pLGV9KEl0ZW0pLEp0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtFdCh0aGlzLGUpO3ZhciB0PUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmtleT1udWxsLHQudmFsdWU9bnVsbCx0fXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gci5rZXk9dGhpcy5rZXksci52YWx1ZT10aGlzLnZhbHVlLHJ9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHRoaXMua2V5PW4ucmVhZFZhclN0cmluZygpLHRoaXMudmFsdWU9SlNPTi5wYXJzZShuLnJlYWRWYXJTdHJpbmcoKSkscn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmtleSksdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlKSl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtRm9ybWF0XCIsdGhpcyxcImtleTpcIitKU09OLnN0cmluZ2lmeSh0aGlzLmtleSkrXCIsdmFsdWU6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZSkpfX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gMX19LHtrZXk6XCJfY291bnRhYmxlXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITF9fV0pLGV9KEl0ZW0pLHp0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuLHIpe0V0KHRoaXMsZSk7dmFyIGk9QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzLHQsbixyKSk7cmV0dXJuIGkuX2RlbHRhPW51bGwsaX1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVsdGFcIixnZXQ6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO2lmKG51bGw9PT10aGlzLl9kZWx0YSl7dmFyIGU9dGhpcy50YXJnZXQuX3k7ZS50cmFuc2FjdChmdW5jdGlvbigpe3ZhciBuPXQudGFyZ2V0Ll9zdGFydCxyPVtdLGk9dC5hZGRlZEVsZW1lbnRzLG89dC5yZW1vdmVkRWxlbWVudHM7dC5fZGVsdGE9cjtmb3IodmFyIGE9bnVsbCxzPXt9LGw9bmV3IE1hcCx1PW5ldyBNYXAsYz1cIlwiLGg9MCxmPTAsZD1mdW5jdGlvbigpe2lmKG51bGwhPT1hKXt2YXIgdD12b2lkIDA7c3dpdGNoKGEpe2Nhc2VcImRlbGV0ZVwiOnQ9e2RlbGV0ZTpmfSxmPTA7YnJlYWs7Y2FzZVwiaW5zZXJ0XCI6aWYodD17aW5zZXJ0OmN9LGwuc2l6ZT4wKXt0LmF0dHJpYnV0ZXM9e307dmFyIGU9ITAsbj0hMSxpPXZvaWQgMDt0cnl7Zm9yKHZhciBvLHU9bFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShvPXUubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgZD14dChvLnZhbHVlLDIpLF89ZFswXSx2PWRbMV07bnVsbCE9PXYmJih0LmF0dHJpYnV0ZXNbX109dil9fWNhdGNoKHQpe249ITAsaT10fWZpbmFsbHl7dHJ5eyFlJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgaX19fWM9XCJcIjticmVhaztjYXNlXCJyZXRhaW5cIjppZih0PXtyZXRhaW46aH0sT2JqZWN0LmtleXMocykubGVuZ3RoPjApe3QuYXR0cmlidXRlcz17fTtmb3IodmFyIF8gaW4gcyl0LmF0dHJpYnV0ZXNbX109c1tfXX1oPTB9ci5wdXNoKHQpLGE9bnVsbH19O251bGwhPT1uOyl7c3dpdGNoKG4uY29uc3RydWN0b3Ipe2Nhc2UgSHQ6aS5oYXMobik/KGQoKSxhPVwiaW5zZXJ0XCIsYz1uLmVtYmVkLGQoKSk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9MSk6ITE9PT1uLl9kZWxldGVkJiYoXCJyZXRhaW5cIiE9PWEmJihkKCksYT1cInJldGFpblwiKSxoKz0xKTticmVhaztjYXNlIEl0ZW1TdHJpbmc6aS5oYXMobik/KFwiaW5zZXJ0XCIhPT1hJiYoZCgpLGE9XCJpbnNlcnRcIiksYys9bi5fY29udGVudCk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9bi5fbGVuZ3RoKTohMT09PW4uX2RlbGV0ZWQmJihcInJldGFpblwiIT09YSYmKGQoKSxhPVwicmV0YWluXCIpLGgrPW4uX2xlbmd0aCk7YnJlYWs7Y2FzZSBKdDppZihpLmhhcyhuKSl7KGwuZ2V0KG4ua2V5KXx8bnVsbCkhPT1uLnZhbHVlPyhcInJldGFpblwiPT09YSYmZCgpLG4udmFsdWU9PT0odS5nZXQobi5rZXkpfHxudWxsKT9kZWxldGUgc1tuLmtleV06c1tuLmtleV09bi52YWx1ZSk6bi5fZGVsZXRlKGUpfWVsc2UgaWYoby5oYXMobikpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciBfPWwuZ2V0KG4ua2V5KXx8bnVsbDtfIT09bi52YWx1ZSYmKFwicmV0YWluXCI9PT1hJiZkKCksc1tuLmtleV09Xyl9ZWxzZSBpZighMT09PW4uX2RlbGV0ZWQpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciB2PXNbbi5rZXldO3ZvaWQgMCE9PXYmJih2IT09bi52YWx1ZT8oXCJyZXRhaW5cIj09PWEmJmQoKSxudWxsPT09bi52YWx1ZT9zW24ua2V5XT1uLnZhbHVlOmRlbGV0ZSBzW24ua2V5XSk6bi5fZGVsZXRlKGUpKX0hMT09PW4uX2RlbGV0ZWQmJihcImluc2VydFwiPT09YSYmZCgpLEIobCxuKSl9bj1uLl9yaWdodH1mb3IoZCgpO3QuX2RlbHRhLmxlbmd0aD4wOyl7dmFyIHA9dC5fZGVsdGFbdC5fZGVsdGEubGVuZ3RoLTFdO2lmKHZvaWQgMD09PXAucmV0YWlufHx2b2lkIDAhPT1wLmF0dHJpYnV0ZXMpYnJlYWs7dC5fZGVsdGEucG9wKCl9fSl9cmV0dXJuIHRoaXMuX2RlbHRhfX1dKSxlfShZQXJyYXlFdmVudCksWVRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVRleHQodCl7RXQodGhpcyxZVGV4dCk7dmFyIGU9QXQodGhpcywoWVRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVRleHQpKS5jYWxsKHRoaXMpKTtpZihcInN0cmluZ1wiPT10eXBlb2YgdCl7dmFyIG49bmV3IEl0ZW1TdHJpbmc7bi5fcGFyZW50PWUsbi5fY29udGVudD10LGUuX3N0YXJ0PW59cmV0dXJuIGV9cmV0dXJuIFR0KFlUZXh0LHQpLFV0KFlUZXh0LFt7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IHp0KHRoaXMsbix0KSl9fSx7a2V5OlwidG9TdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD1cIlwiLGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KSFlLl9kZWxldGVkJiZlLl9jb3VudGFibGUmJih0Kz1lLl9jb250ZW50KSxlPWUuX3JpZ2h0O3JldHVybiB0fX0se2tleTpcImFwcGx5RGVsdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKG4pe2Zvcih2YXIgcj1udWxsLGk9ZS5fc3RhcnQsbz1uZXcgTWFwLGE9MDthPHQubGVuZ3RoO2ErKyl7dmFyIHM9dFthXTtpZih2b2lkIDAhPT1zLmluc2VydCl7dmFyIGw9eChuLHMuaW5zZXJ0LGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksdT14dChsLDIpO3I9dVswXSxpPXVbMV19ZWxzZSBpZih2b2lkIDAhPT1zLnJldGFpbil7dmFyIGM9SShuLHMucmV0YWluLGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksaD14dChjLDIpO3I9aFswXSxpPWhbMV19ZWxzZSBpZih2b2lkIDAhPT1zLmRlbGV0ZSl7dmFyIGY9RChuLHMuZGVsZXRlLGUscixpLG8pLGQ9eHQoZiwyKTtyPWRbMF0saT1kWzFdfX19KX19LHtrZXk6XCJ0b0RlbHRhXCIsdmFsdWU6ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7aWYoci5sZW5ndGg+MCl7dmFyIHQ9e30saT0hMSxvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PW5bU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9eHQobC52YWx1ZSwyKSxoPWNbMF0sZj1jWzFdO2k9ITAsdFtoXT1mfX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fXZhciBkPXtpbnNlcnQ6cn07aSYmKGQuYXR0cmlidXRlcz10KSxlLnB1c2goZCkscj1cIlwifX1mb3IodmFyIGU9W10sbj1uZXcgTWFwLHI9XCJcIixpPXRoaXMuX3N0YXJ0O251bGwhPT1pOyl7aWYoIWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgSXRlbVN0cmluZzpyKz1pLl9jb250ZW50O2JyZWFrO2Nhc2UgSnQ6dCgpLEIobixpKX1pPWkuX3JpZ2h0fXJldHVybiB0KCksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307ZS5sZW5ndGg8PTB8fHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKGkpe3ZhciBvPUUobix0KSxhPXh0KG8sMykscz1hWzBdLGw9YVsxXSx1PWFbMl07eChpLGUsbixzLGwsdSxyKX0pfX0se2tleTpcImluc2VydEVtYmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLHI9YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9O2lmKGUuY29uc3RydWN0b3IhPT1PYmplY3QpdGhyb3cgbmV3IEVycm9yKFwiRW1iZWQgbXVzdCBiZSBhbiBPYmplY3RcIik7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShuLHQpLGE9eHQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTt4KGksZSxuLHMsbCx1LHIpfSl9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzOzAhPT1lJiZ0aGlzLl90cmFuc2FjdChmdW5jdGlvbihyKXt2YXIgaT1FKG4sdCksbz14dChpLDMpLGE9b1swXSxzPW9bMV0sbD1vWzJdO0QocixlLG4sYSxzLGwpfSl9fSx7a2V5OlwiZm9ybWF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3ZhciByPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShyLHQpLGE9eHQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTtudWxsIT09bCYmSShpLGUscixzLGwsdSxuKX0pfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVRleHRcIix0aGlzKX19XSksWVRleHR9KFlBcnJheSksWVhtbEhvb2s9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEhvb2sodCl7RXQodGhpcyxZWG1sSG9vayk7dmFyIGU9QXQodGhpcywoWVhtbEhvb2suX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2spKS5jYWxsKHRoaXMpKTtyZXR1cm4gZS5ob29rTmFtZT1udWxsLHZvaWQgMCE9PXQmJihlLmhvb2tOYW1lPXQpLGV9cmV0dXJuIFR0KFlYbWxIb29rLHQpLFV0KFlYbWxIb29rLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PUJ0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Lmhvb2tOYW1lPXRoaXMuaG9va05hbWUsdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LGU9YXJndW1lbnRzWzJdLG49dFt0aGlzLmhvb2tOYW1lXSxyPXZvaWQgMDtyZXR1cm4gcj12b2lkIDAhPT1uP24uY3JlYXRlRG9tKHRoaXMpOmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGhpcy5ob29rTmFtZSksci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIsdGhpcy5ob29rTmFtZSksUihlLHIsdGhpcykscn19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49QnQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpO3JldHVybiB0aGlzLmhvb2tOYW1lPWUucmVhZFZhclN0cmluZygpLG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmhvb2tOYW1lKX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXRoaXMuaG9va05hbWUpdGhyb3cgbmV3IEVycm9yKFwiaG9va05hbWUgbXVzdCBiZSBkZWZpbmVkIVwiKTtCdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCl9fV0pLFlYbWxIb29rfShZTWFwKSxZdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtFdCh0aGlzLHQpLHRoaXMuX2ZpbHRlcj1ufHxmdW5jdGlvbigpe3JldHVybiEwfSx0aGlzLl9yb290PWUsdGhpcy5fY3VycmVudE5vZGU9ZSx0aGlzLl9maXJzdENhbGw9ITB9cmV0dXJuIFV0KHQsW3trZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9fSx7a2V5OlwibmV4dFwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5fY3VycmVudE5vZGU7aWYodGhpcy5fZmlyc3RDYWxsJiYodGhpcy5fZmlyc3RDYWxsPSExLCF0Ll9kZWxldGVkJiZ0aGlzLl9maWx0ZXIodCkpKXJldHVybnt2YWx1ZTp0LGRvbmU6ITF9O2Rve2lmKHQuX2RlbGV0ZWR8fHQuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQuX1lYbWxFbGVtZW50JiZ0LmNvbnN0cnVjdG9yIT09WVhtbEZyYWdtZW50fHxudWxsPT09dC5fc3RhcnQpe2Zvcig7dCE9PXRoaXMuX3Jvb3Q7KXtpZihudWxsIT09dC5fcmlnaHQpe3Q9dC5fcmlnaHQ7YnJlYWt9dD10Ll9wYXJlbnR9dD09PXRoaXMuX3Jvb3QmJih0PW51bGwpfWVsc2UgdD10Ll9zdGFydDtpZih0PT09dGhpcy5fcm9vdClicmVha313aGlsZShudWxsIT09dCYmKHQuX2RlbGV0ZWR8fCF0aGlzLl9maWx0ZXIodCkpKTtyZXR1cm4gdGhpcy5fY3VycmVudE5vZGU9dCxudWxsPT09dD97ZG9uZTohMH06e3ZhbHVlOnQsZG9uZTohMX19fV0pLHR9KCksWVhtbEV2ZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxFdmVudCh0LGUsbixyKXtFdCh0aGlzLFlYbWxFdmVudCk7dmFyIGk9QXQodGhpcywoWVhtbEV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFdmVudCkpLmNhbGwodGhpcyx0KSk7cmV0dXJuIGkuX3RyYW5zYWN0aW9uPXIsaS5jaGlsZExpc3RDaGFuZ2VkPSExLGkuYXR0cmlidXRlc0NoYW5nZWQ9bmV3IFNldCxpLnJlbW90ZT1uLGUuZm9yRWFjaChmdW5jdGlvbih0KXtudWxsPT09dD9pLmNoaWxkTGlzdENoYW5nZWQ9ITA6aS5hdHRyaWJ1dGVzQ2hhbmdlZC5hZGQodCl9KSxpfXJldHVybiBUdChZWG1sRXZlbnQsdCksWVhtbEV2ZW50fShZRXZlbnQpLFlYbWxGcmFnbWVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sRnJhZ21lbnQoKXtyZXR1cm4gRXQodGhpcyxZWG1sRnJhZ21lbnQpLEF0KHRoaXMsKFlYbWxGcmFnbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRnJhZ21lbnQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZWG1sRnJhZ21lbnQsdCksVXQoWVhtbEZyYWdtZW50LFt7a2V5OlwiY3JlYXRlVHJlZVdhbGtlclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBuZXcgWXQodGhpcyx0KX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yXCIsdmFsdWU6ZnVuY3Rpb24odCl7dD10LnRvVXBwZXJDYXNlKCk7dmFyIGU9bmV3IFl0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSksbj1lLm5leHQoKTtyZXR1cm4gbi5kb25lP251bGw6bi52YWx1ZX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yQWxsXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHQ9dC50b1VwcGVyQ2FzZSgpLEFycmF5LmZyb20obmV3IFl0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSkpfX0se2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBZWG1sRXZlbnQodGhpcyxlLG4sdCkpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQudG9TdHJpbmcoKX0pLmpvaW4oXCJcIil9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtCdChZWG1sRnJhZ21lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxGcmFnbWVudC5wcm90b3R5cGUpLFwiX2RlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LGUsbil9fSx7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpkb2N1bWVudCxlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fSxuPWFyZ3VtZW50c1syXSxyPXQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO3JldHVybiBSKG4scix0aGlzKSx0aGlzLmZvckVhY2goZnVuY3Rpb24oaSl7ci5pbnNlcnRCZWZvcmUoaS50b0RvbSh0LGUsbiksbnVsbCl9KSxyfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVhtbFwiLHRoaXMpfX1dKSxZWG1sRnJhZ21lbnR9KFlBcnJheSksWVhtbEVsZW1lbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEVsZW1lbnQoKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06XCJVTkRFRklORURcIjtFdCh0aGlzLFlYbWxFbGVtZW50KTt2YXIgZT1BdCh0aGlzLChZWG1sRWxlbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudCkpLmNhbGwodGhpcykpO3JldHVybiBlLm5vZGVOYW1lPXQudG9VcHBlckNhc2UoKSxlfXJldHVybiBUdChZWG1sRWxlbWVudCx0KSxVdChZWG1sRWxlbWVudCxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1CdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5ub2RlTmFtZT10aGlzLm5vZGVOYW1lLHR9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPUJ0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5ub2RlTmFtZT1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5ub2RlTmFtZSl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGw9PT10aGlzLm5vZGVOYW1lKXRocm93IG5ldyBFcnJvcihcIm5vZGVOYW1lIG11c3QgYmUgZGVmaW5lZCFcIik7QnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfaW50ZWdyYXRlXCIsdGhpcykuY2FsbCh0aGlzLHQpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLmdldEF0dHJpYnV0ZXMoKSxlPVtdLG49W107Zm9yKHZhciByIGluIHQpbi5wdXNoKHIpO24uc29ydCgpO2Zvcih2YXIgaT1uLmxlbmd0aCxvPTA7bzxpO28rKyl7dmFyIGE9bltvXTtlLnB1c2goYSsnPVwiJyt0W2FdKydcIicpfXZhciBzPXRoaXMubm9kZU5hbWUudG9Mb2NhbGVMb3dlckNhc2UoKTtyZXR1cm5cIjxcIitzKyhlLmxlbmd0aD4wP1wiIFwiK2Uuam9pbihcIiBcIik6XCJcIikrXCI+XCIrQnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJ0b1N0cmluZ1wiLHRoaXMpLmNhbGwodGhpcykrXCI8L1wiK3MrXCI+XCJ9fSx7a2V5OlwicmVtb3ZlQXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIFlNYXAucHJvdG90eXBlLmRlbGV0ZS5jYWxsKHRoaXMsdCl9fSx7a2V5Olwic2V0QXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtyZXR1cm4gWU1hcC5wcm90b3R5cGUuc2V0LmNhbGwodGhpcyx0LGUpfX0se2tleTpcImdldEF0dHJpYnV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBZTWFwLnByb3RvdHlwZS5nZXQuY2FsbCh0aGlzLHQpfX0se2tleTpcImdldEF0dHJpYnV0ZXNcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXt9LGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPXh0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTtsLl9kZWxldGVkfHwodFtzXT1sLl9jb250ZW50WzBdKX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOmRvY3VtZW50LGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LG49YXJndW1lbnRzWzJdLHI9dC5jcmVhdGVFbGVtZW50KHRoaXMubm9kZU5hbWUpLGk9dGhpcy5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBvIGluIGkpci5zZXRBdHRyaWJ1dGUobyxpW29dKTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe3IuYXBwZW5kQ2hpbGQoaS50b0RvbSh0LGUsbikpfSksUihuLHIsdGhpcykscn19XSksWVhtbEVsZW1lbnR9KFlYbWxGcmFnbWVudCk7WVhtbEZyYWdtZW50Ll9ZWG1sRWxlbWVudD1ZWG1sRWxlbWVudDt2YXIgWVhtbFRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbFRleHQoKXtyZXR1cm4gRXQodGhpcyxZWG1sVGV4dCksQXQodGhpcywoWVhtbFRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZWG1sVGV4dCx0KSxVdChZWG1sVGV4dCxbe2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06ZG9jdW1lbnQsZT1hcmd1bWVudHNbMl0sbj10LmNyZWF0ZVRleHROb2RlKHRoaXMudG9TdHJpbmcoKSk7cmV0dXJuIFIoZSxuLHRoaXMpLG59fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtCdChZWG1sVGV4dC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pfX1dKSxZWG1sVGV4dH0oWVRleHQpLEZ0PW5ldyBNYXAsWHQ9bmV3IE1hcDtYKDAsSXRlbUpTT04pLFgoMSxJdGVtU3RyaW5nKSxYKDEwLEp0KSxYKDExLEh0KSxYKDIsRGVsZXRlKSxYKDMsWUFycmF5KSxYKDQsWU1hcCksWCg1LFlUZXh0KSxYKDYsWVhtbEZyYWdtZW50KSxYKDcsWVhtbEVsZW1lbnQpLFgoOCxZWG1sVGV4dCksWCg5LFlYbWxIb29rKSxYKDEyLEx0KTt2YXIgcXQ9MTY3NzcyMTUsJHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7RXQodGhpcyx0KSx0aGlzLnVzZXI9cXQsdGhpcy5uYW1lPWUsdGhpcy50eXBlPSQobil9cmV0dXJuIFV0KHQsW3trZXk6XCJlcXVhbHNcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQudXNlcj09PXRoaXMudXNlciYmdC5uYW1lPT09dGhpcy5uYW1lJiZ0LnR5cGU9PT10aGlzLnR5cGV9fSx7a2V5OlwibGVzc1RoYW5cIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5jb25zdHJ1Y3RvciE9PXR8fCh0aGlzLnVzZXI8ZS51c2VyfHx0aGlzLnVzZXI9PT1lLnVzZXImJih0aGlzLm5hbWU8ZS5uYW1lfHx0aGlzLm5hbWU9PT1lLm5hbWUmJnRoaXMudHlwZTxlLnR5cGUpKX19XSksdH0oKSxHdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQpe0V0KHRoaXMsZSk7dmFyIG49QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIG4ueT10LG59cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXTt0aGlzLml0ZXJhdGUobnVsbCxudWxsLGZ1bmN0aW9uKGUpe2UuY29uc3RydWN0b3I9PT1MdD90LnB1c2goe2lkOnAoZSksY29udGVudDplLl9sZW5ndGgsZGVsZXRlZDpcIkdDXCJ9KTp0LnB1c2goe2lkOnAoZSksb3JpZ2luOnAobnVsbD09PWUuX29yaWdpbj9udWxsOmUuX29yaWdpbi5fbGFzdElkKSxsZWZ0OnAobnVsbD09PWUuX2xlZnQ/bnVsbDplLl9sZWZ0Ll9sYXN0SWQpLHJpZ2h0OnAoZS5fcmlnaHQpLHJpZ2h0X29yaWdpbjpwKGUuX3JpZ2h0X29yaWdpbikscGFyZW50OnAoZS5fcGFyZW50KSxwYXJlbnRTdWI6ZS5fcGFyZW50U3ViLGRlbGV0ZWQ6ZS5fZGVsZXRlZCxjb250ZW50OkpTT04uc3RyaW5naWZ5KGUuX2NvbnRlbnQpfSl9KSxjb25zb2xlLnRhYmxlKHQpfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZCh0KTtpZihudWxsPT09ZSYmdCBpbnN0YW5jZW9mICR0KXt2YXIgbj1xKHQudHlwZSkscj10aGlzLnk7ZT1uZXcgbixlLl9pZD10LGUuX3BhcmVudD1yLHIudHJhbnNhY3QoZnVuY3Rpb24oKXtlLl9pbnRlZ3JhdGUocil9KSx0aGlzLnB1dChlKX1yZXR1cm4gZX19LHtrZXk6XCJnZXRJdGVtXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQodCk7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7dmFyIG49ZS5faWQ7cmV0dXJuIHQudXNlcj09PW4udXNlciYmdC5jbG9jazxuLmNsb2NrK2UuX2xlbmd0aD9lOm51bGx9fSx7a2V5OlwiZ2V0SXRlbUNsZWFuU3RhcnRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2s9PT10LmNsb2NrP2U6ZS5fc3BsaXRBdCh0aGlzLnksdC5jbG9jay1uLmNsb2NrKX19LHtrZXk6XCJnZXRJdGVtQ2xlYW5FbmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2srZS5fbGVuZ3RoLTE9PT10LmNsb2NrP2U6KGUuX3NwbGl0QXQodGhpcy55LHQuY2xvY2stbi5jbG9jaysxKSxlKX19XSksZX0oRHQpLFp0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtFdCh0aGlzLHQpLHRoaXMueT1lLHRoaXMuc3RhdGU9bmV3IE1hcH1yZXR1cm4gVXQodCxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e1xuZm9yKHZhciBpLG89dGhpcy5zdGF0ZVtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07dC5wdXNoKHt1c2VyOnMsc3RhdGU6bH0pfX1jYXRjaCh0KXtuPSEwLHI9dH1maW5hbGx5e3RyeXshZSYmby5yZXR1cm4mJm8ucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IHJ9fWNvbnNvbGUudGFibGUodCl9fSx7a2V5OlwiZ2V0TmV4dElEXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy55LnVzZXJJRCxuPXRoaXMuZ2V0U3RhdGUoZSk7cmV0dXJuIHRoaXMuc2V0U3RhdGUoZSxuK3QpLG5ldyBQdChlLG4pfX0se2tleTpcInVwZGF0ZVJlbW90ZVN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPXQuX2lkLnVzZXIsbj10aGlzLnN0YXRlLmdldChlKTtudWxsIT09dCYmdC5faWQuY2xvY2s9PT1uOyluKz10Ll9sZW5ndGgsdD10aGlzLnkub3MuZ2V0KG5ldyBQdChlLG4pKTt0aGlzLnN0YXRlLnNldChlLG4pfX0se2tleTpcImdldFN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5zdGF0ZS5nZXQodCk7cmV0dXJuIG51bGw9PWU/MDplfX0se2tleTpcInNldFN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLnkuX3RyYW5zYWN0aW9uLmJlZm9yZVN0YXRlO24uaGFzKHQpfHxuLnNldCh0LHRoaXMuZ2V0U3RhdGUodCkpLHRoaXMuc3RhdGUuc2V0KHQsZSl9fV0pLHR9KCksUXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLl9ldmVudExpc3RlbmVyPW5ldyBNYXAsdGhpcy5fc3RhdGVMaXN0ZW5lcj1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwiX2dldExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7cmV0dXJuIHZvaWQgMD09PWUmJihlPXtvbmNlOm5ldyBTZXQsb246bmV3IFNldH0sdGhpcy5fZXZlbnRMaXN0ZW5lci5zZXQodCxlKSksZX19LHtrZXk6XCJvbmNlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLl9nZXRMaXN0ZW5lcih0KS5vbmNlLmFkZChlKX19LHtrZXk6XCJvblwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5fZ2V0TGlzdGVuZXIodCkub24uYWRkKGUpfX0se2tleTpcIl9pbml0U3RhdGVMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX3N0YXRlTGlzdGVuZXIuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1lJiYoZT17fSxlLnByb21pc2U9bmV3IFByb21pc2UoZnVuY3Rpb24odCl7ZS5yZXNvbHZlPXR9KSx0aGlzLl9zdGF0ZUxpc3RlbmVyLnNldCh0LGUpKSxlfX0se2tleTpcIndoZW5cIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5faW5pdFN0YXRlTGlzdGVuZXIodCkucHJvbWlzZX19LHtrZXk6XCJvZmZcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKG51bGw9PXR8fG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSBldmVudCBuYW1lIGFuZCBmdW5jdGlvbiFcIik7dmFyIG49dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09biYmKG4ub24uZGVsZXRlKGUpLG4ub25jZS5kZWxldGUoZSkpfX0se2tleTpcImVtaXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9YXJndW1lbnRzLmxlbmd0aCxuPUFycmF5KGU+MT9lLTE6MCkscj0xO3I8ZTtyKyspbltyLTFdPWFyZ3VtZW50c1tyXTt0aGlzLl9pbml0U3RhdGVMaXN0ZW5lcih0KS5yZXNvbHZlKCk7dmFyIGk9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09aT8oaS5vbi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiB0LmFwcGx5KG51bGwsbil9KSxpLm9uY2UuZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gdC5hcHBseShudWxsLG4pfSksaS5vbmNlPW5ldyBTZXQpOlwiZXJyb3JcIj09PXQmJmNvbnNvbGUuZXJyb3IoblswXSl9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fZXZlbnRMaXN0ZW5lcj1udWxsfX1dKSx0fSgpLEt0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe0V0KHRoaXMsdCksdGhpcy50eXBlPWUsdGhpcy50YXJnZXQ9bix0aGlzLl9tdXR1YWxFeGNsdWRlPUsoKX1yZXR1cm4gVXQodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZT1udWxsLHRoaXMudGFyZ2V0PW51bGx9fV0pLHR9KCksdGU9bnVsbCxlZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgZ2V0U2VsZWN0aW9uP3R0OmZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9LG5lPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXt2YXIgcj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307RXQodGhpcyxlKTt2YXIgaT1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7aS5vcHRzPXIsci5kb2N1bWVudD1yLmRvY3VtZW50fHxkb2N1bWVudCxyLmhvb2tzPXIuaG9va3N8fHt9LGkuc2Nyb2xsaW5nRWxlbWVudD1yLnNjcm9sbGluZ0VsZW1lbnR8fG51bGwsaS5kb21Ub1R5cGU9bmV3IE1hcCxpLnR5cGVUb0RvbT1uZXcgTWFwLGkuZmlsdGVyPXIuZmlsdGVyfHxqLG4uaW5uZXJIVE1MPVwiXCIsdC5mb3JFYWNoKGZ1bmN0aW9uKHQpe24uaW5zZXJ0QmVmb3JlKHQudG9Eb20oci5kb2N1bWVudCxyLmhvb2tzLGkpLG51bGwpfSksaS5fdHlwZU9ic2VydmVyPW90LmJpbmQoaSksaS5fZG9tT2JzZXJ2ZXI9ZnVuY3Rpb24odCl7bHQuY2FsbChpLHQsci5kb2N1bWVudCl9LHQub2JzZXJ2ZURlZXAoaS5fdHlwZU9ic2VydmVyKSxpLl9tdXRhdGlvbk9ic2VydmVyPW5ldyBNdXRhdGlvbk9ic2VydmVyKGkuX2RvbU9ic2VydmVyKSxpLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUobix7Y2hpbGRMaXN0OiEwLGF0dHJpYnV0ZXM6ITAsY2hhcmFjdGVyRGF0YTohMCxzdWJ0cmVlOiEwfSksaS5fY3VycmVudFNlbD1udWxsLGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJzZWxlY3Rpb25jaGFuZ2VcIixmdW5jdGlvbigpe2kuX2N1cnJlbnRTZWw9ZWUoaSl9KTt2YXIgbz10Ll95O3JldHVybiBpLnk9byxpLl9iZWZvcmVUcmFuc2FjdGlvbkhhbmRsZXI9ZnVuY3Rpb24odCxlLG4pe2kuX2RvbU9ic2VydmVyKGkuX211dGF0aW9uT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSksaS5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2V0KGksbil9KX0sby5vbihcImJlZm9yZVRyYW5zYWN0aW9uXCIsaS5fYmVmb3JlVHJhbnNhY3Rpb25IYW5kbGVyKSxpLl9hZnRlclRyYW5zYWN0aW9uSGFuZGxlcj1mdW5jdGlvbih0LGUsbil7aS5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe250KGksbil9KSxlLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9aS50eXBlVG9Eb20uZ2V0KHQpO3ZvaWQgMCE9PWUmJkMoaSxlLHQpfSl9LG8ub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsaS5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXIpLGkuX2JlZm9yZU9ic2VydmVyQ2FsbHNIYW5kbGVyPWZ1bmN0aW9uKHQsZSl7ZS5jaGFuZ2VkVHlwZXMuZm9yRWFjaChmdW5jdGlvbihlLG4peyhlLnNpemU+MXx8MT09PWUuc2l6ZSYmITE9PT1lLmhhcyhudWxsKSkmJlYodCxpLG4pfSksZS5uZXdUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKGUpe1YodCxpLGUpfSl9LG8ub24oXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsaS5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXIpLFIoaSxuLHQpLGl9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcInNldEZpbHRlclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZmlsdGVyPXR9fSx7a2V5OlwiX2dldFVuZG9TdGFja0luZm9cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmdldFNlbGVjdGlvbigpfX0se2tleTpcIl9yZXN0b3JlVW5kb1N0YWNrSW5mb1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMucmVzdG9yZVNlbGVjdGlvbih0KX19LHtrZXk6XCJnZXRTZWxlY3Rpb25cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jdXJyZW50U2VsfX0se2tleTpcInJlc3RvcmVTZWxlY3Rpb25cIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsIT09dCl7dmFyIGU9dC50byxuPXQuZnJvbSxyPSExLGk9Z2V0U2VsZWN0aW9uKCksbz1pLmJhc2VOb2RlLGE9aS5iYXNlT2Zmc2V0LHM9aS5leHRlbnROb2RlLGw9aS5leHRlbnRPZmZzZXQ7aWYobnVsbCE9PW4pe3ZhciB1PVEodGhpcy55LG4pO2lmKG51bGwhPT11KXt2YXIgYz10aGlzLnR5cGVUb0RvbS5nZXQodS50eXBlKSxoPXUub2Zmc2V0O2M9PT1vJiZoPT09YXx8KG89YyxhPWgscj0hMCl9fWlmKG51bGwhPT1lKXt2YXIgZj1RKHRoaXMueSxlKTtpZihudWxsIT09Zil7dmFyIGQ9dGhpcy50eXBlVG9Eb20uZ2V0KGYudHlwZSksXz1mLm9mZnNldDtkPT09cyYmXz09PWx8fChzPWQsbD1fLHI9ITApfX1yJiZpLnNldEJhc2VBbmRFeHRlbnQobyxhLHMsbCl9fX0se2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZG9tVG9UeXBlPW51bGwsdGhpcy50eXBlVG9Eb209bnVsbCx0aGlzLnR5cGUudW5vYnNlcnZlRGVlcCh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO3ZhciB0PXRoaXMudHlwZS5feTt0Lm9mZihcImJlZm9yZVRyYW5zYWN0aW9uXCIsdGhpcy5fYmVmb3JlVHJhbnNhY3Rpb25IYW5kbGVyKSx0Lm9mZihcImJlZm9yZU9ic2VydmVyQ2FsbHNcIix0aGlzLl9iZWZvcmVPYnNlcnZlckNhbGxzSGFuZGxlciksdC5vZmYoXCJhZnRlclRyYW5zYWN0aW9uXCIsdGhpcy5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXIpLEJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShLdCksWT1mdW5jdGlvbih0KXtmdW5jdGlvbiBZKHQsZSxuKXt2YXIgcj1hcmd1bWVudHMubGVuZ3RoPjMmJnZvaWQgMCE9PWFyZ3VtZW50c1szXT9hcmd1bWVudHNbM106e307RXQodGhpcyxZKTt2YXIgaT1BdCh0aGlzLChZLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFkpKS5jYWxsKHRoaXMpKTtpLmdjRW5hYmxlZD1yLmdjfHwhMSxpLnJvb209dCxudWxsIT1lJiYoZS5jb25uZWN0b3Iucm9vbT10KSxpLl9jb250ZW50UmVhZHk9ITEsaS5fb3B0cz1lLFwibnVtYmVyXCIhPXR5cGVvZiBlLnVzZXJJRD9pLnVzZXJJRD1HKCk6aS51c2VySUQ9ZS51c2VySUQsaS5zaGFyZT17fSxpLmRzPW5ldyBOdChpKSxpLm9zPW5ldyBHdChpKSxpLnNzPW5ldyBadChpKSxpLl9taXNzaW5nU3RydWN0cz1uZXcgTWFwLGkuX3JlYWR5VG9JbnRlZ3JhdGU9W10saS5fdHJhbnNhY3Rpb249bnVsbCxpLmNvbm5lY3Rvcj1udWxsLGkuY29ubmVjdGVkPSExO3ZhciBvPWZ1bmN0aW9uKCl7bnVsbCE9ZSYmKGkuY29ubmVjdG9yPW5ldyBZW2UuY29ubmVjdG9yLm5hbWVdKGksZS5jb25uZWN0b3IpLGkuY29ubmVjdGVkPSEwLGkuZW1pdChcImNvbm5lY3RvclJlYWR5XCIpKX07cmV0dXJuIGkucGVyc2lzdGVuY2U9bnVsbCxudWxsIT1uPyhpLnBlcnNpc3RlbmNlPW4sbi5faW5pdChpKS50aGVuKG8pKTpvKCksaS5fcGFyZW50PW51bGwsaS5faGFzVW5kb01hbmFnZXI9ITEsaX1yZXR1cm4gVHQoWSx0KSxVdChZLFt7a2V5OlwiX3NldENvbnRlbnRSZWFkeVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fY29udGVudFJlYWR5fHwodGhpcy5fY29udGVudFJlYWR5PSEwLHRoaXMuZW1pdChcImNvbnRlbnRcIikpfX0se2tleTpcIndoZW5Db250ZW50UmVhZHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXM7cmV0dXJuIHRoaXMuX2NvbnRlbnRSZWFkeT9Qcm9taXNlLnJlc29sdmUoKTpuZXcgUHJvbWlzZShmdW5jdGlvbihlKXt0Lm9uY2UoXCJjb250ZW50XCIsZSl9KX19LHtrZXk6XCJfYmVmb3JlQ2hhbmdlXCIsdmFsdWU6ZnVuY3Rpb24oKXt9fSx7a2V5OlwidHJhbnNhY3RcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSYmYXJndW1lbnRzWzFdLG49bnVsbD09PXRoaXMuX3RyYW5zYWN0aW9uO24mJih0aGlzLl90cmFuc2FjdGlvbj1uZXcgUnQodGhpcyksdGhpcy5lbWl0KFwiYmVmb3JlVHJhbnNhY3Rpb25cIix0aGlzLHRoaXMuX3RyYW5zYWN0aW9uLGUpKTt0cnl7dCh0aGlzKX1jYXRjaCh0KXtjb25zb2xlLmVycm9yKHQpfWlmKG4pe3RoaXMuZW1pdChcImJlZm9yZU9ic2VydmVyQ2FsbHNcIix0aGlzLHRoaXMuX3RyYW5zYWN0aW9uLGUpO3ZhciByPXRoaXMuX3RyYW5zYWN0aW9uO3RoaXMuX3RyYW5zYWN0aW9uPW51bGwsci5jaGFuZ2VkVHlwZXMuZm9yRWFjaChmdW5jdGlvbih0LG4pe24uX2RlbGV0ZWR8fG4uX2NhbGxPYnNlcnZlcihyLHQsZSl9KSxyLmNoYW5nZWRQYXJlbnRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ZS5fZGVsZXRlZHx8KHQ9dC5maWx0ZXIoZnVuY3Rpb24odCl7cmV0dXJuIXQudGFyZ2V0Ll9kZWxldGVkfSksdC5mb3JFYWNoKGZ1bmN0aW9uKHQpe3QuY3VycmVudFRhcmdldD1lfSksZS5fZGVlcEV2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMocix0KSl9KSx0aGlzLmVtaXQoXCJhZnRlclRyYW5zYWN0aW9uXCIsdGhpcyxyLGUpfX19LHtrZXk6XCJkZWZpbmVcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPW5ldyAkdCh0LGUpLHI9dGhpcy5vcy5nZXQobik7aWYodm9pZCAwPT09dGhpcy5zaGFyZVt0XSl0aGlzLnNoYXJlW3RdPXI7ZWxzZSBpZih0aGlzLnNoYXJlW3RdIT09cil0aHJvdyBuZXcgRXJyb3IoXCJUeXBlIGlzIGFscmVhZHkgZGVmaW5lZCB3aXRoIGEgZGlmZmVyZW50IGNvbnN0cnVjdG9yXCIpO3JldHVybiByfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLnNoYXJlW3RdfX0se2tleTpcImRpc2Nvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbm5lY3RlZD8odGhpcy5jb25uZWN0ZWQ9ITEsdGhpcy5jb25uZWN0b3IuZGlzY29ubmVjdCgpKTpQcm9taXNlLnJlc29sdmUoKX19LHtrZXk6XCJyZWNvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbm5lY3RlZD9Qcm9taXNlLnJlc29sdmUoKToodGhpcy5jb25uZWN0ZWQ9ITAsdGhpcy5jb25uZWN0b3IucmVjb25uZWN0KCkpfX0se2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe0J0KFkucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFkucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpLHRoaXMuc2hhcmU9bnVsbCxudWxsIT10aGlzLmNvbm5lY3RvciYmKG51bGwhPXRoaXMuY29ubmVjdG9yLmRlc3Ryb3k/dGhpcy5jb25uZWN0b3IuZGVzdHJveSgpOnRoaXMuY29ubmVjdG9yLmRpc2Nvbm5lY3QoKSksbnVsbCE9PXRoaXMucGVyc2lzdGVuY2UmJih0aGlzLnBlcnNpc3RlbmNlLmRlaW5pdCh0aGlzKSx0aGlzLnBlcnNpc3RlbmNlPW51bGwpLHRoaXMub3M9bnVsbCx0aGlzLmRzPW51bGwsdGhpcy5zcz1udWxsfX0se2tleTpcIl9zdGFydFwiLGdldDpmdW5jdGlvbigpe3JldHVybiBudWxsfSxzZXQ6ZnVuY3Rpb24odCl7cmV0dXJuIG51bGx9fV0pLFl9KFF0KTtZLmV4dGVuZD1mdW5jdGlvbigpe2Zvcih2YXIgdD0wO3Q8YXJndW1lbnRzLmxlbmd0aDt0Kyspe3ZhciBlPWFyZ3VtZW50c1t0XTtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBlKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGEgZnVuY3Rpb24hXCIpO2UoWSl9fTt2YXIgcmU9ZnVuY3Rpb24gdChlLG4scil7dmFyIGk9dGhpcztFdCh0aGlzLHQpLHRoaXMuY3JlYXRlZD1uZXcgRGF0ZTt2YXIgbz1uLmJlZm9yZVN0YXRlO28uaGFzKGUudXNlcklEKT8odGhpcy50b1N0YXRlPW5ldyBQdChlLnVzZXJJRCxlLnNzLmdldFN0YXRlKGUudXNlcklEKS0xKSx0aGlzLmZyb21TdGF0ZT1uZXcgUHQoZS51c2VySUQsby5nZXQoZS51c2VySUQpKSk6KHRoaXMudG9TdGF0ZT1udWxsLHRoaXMuZnJvbVN0YXRlPW51bGwpLHRoaXMuZGVsZXRlZFN0cnVjdHM9bmV3IFNldCxuLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24odCl7aS5kZWxldGVkU3RydWN0cy5hZGQoe2Zyb206dC5faWQsbGVuOnQuX2xlbmd0aH0pfSksdGhpcy5iaW5kaW5nSW5mb3M9cn0saWU9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e307RXQodGhpcyx0KSx0aGlzLm9wdGlvbnM9cix0aGlzLl9iaW5kaW5ncz1uZXcgU2V0KHIuYmluZGluZ3MpLHIuY2FwdHVyZVRpbWVvdXQ9bnVsbD09ci5jYXB0dXJlVGltZW91dD81MDA6ci5jYXB0dXJlVGltZW91dCx0aGlzLl91bmRvQnVmZmVyPVtdLHRoaXMuX3JlZG9CdWZmZXI9W10sdGhpcy5fc2NvcGU9ZSx0aGlzLl91bmRvaW5nPSExLHRoaXMuX3JlZG9pbmc9ITEsdGhpcy5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMTt2YXIgaT1lLl95O3RoaXMueT1pLGkuX2hhc1VuZG9NYW5hZ2VyPSEwO3ZhciBvPXZvaWQgMDtpLm9uKFwiYmVmb3JlVHJhbnNhY3Rpb25cIixmdW5jdGlvbih0LGUscil7cnx8KG89bmV3IE1hcCxuLl9iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKHQpe28uc2V0KHQsdC5fZ2V0VW5kb1N0YWNrSW5mbygpKX0pKX0pLGkub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxpLGEpe2lmKCFhJiZpLmNoYW5nZWRQYXJlbnRUeXBlcy5oYXMoZSkpe3ZhciBzPW5ldyByZSh0LGksbyk7aWYobi5fdW5kb2luZyluLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSEwLG4uX3JlZG9CdWZmZXIucHVzaChzKTtlbHNle3ZhciBsPW4uX3VuZG9CdWZmZXIubGVuZ3RoPjA/bi5fdW5kb0J1ZmZlcltuLl91bmRvQnVmZmVyLmxlbmd0aC0xXTpudWxsOyExPT09bi5fcmVkb2luZyYmITE9PT1uLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvJiZudWxsIT09bCYmKHIuY2FwdHVyZVRpbWVvdXQ8MHx8cy5jcmVhdGVkLWwuY3JlYXRlZDw9ci5jYXB0dXJlVGltZW91dCk/KGwuY3JlYXRlZD1zLmNyZWF0ZWQsbnVsbCE9PXMudG9TdGF0ZSYmKGwudG9TdGF0ZT1zLnRvU3RhdGUsbnVsbD09PWwuZnJvbVN0YXRlJiYobC5mcm9tU3RhdGU9cy5mcm9tU3RhdGUpKSxzLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2gobC5kZWxldGVkU3RydWN0cy5hZGQsbC5kZWxldGVkU3RydWN0cykpOihuLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSExLG4uX3VuZG9CdWZmZXIucHVzaChzKSksbi5fcmVkb2luZ3x8KG4uX3JlZG9CdWZmZXI9W10pfX19KX1yZXR1cm4gVXQodCxbe2tleTpcImZsdXNoQ2hhbmdlc1wiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMH19LHtrZXk6XCJ1bmRvXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl91bmRvaW5nPSEwO3ZhciB0PXV0KHRoaXMueSx0aGlzLl9zY29wZSx0aGlzLl91bmRvQnVmZmVyKTtyZXR1cm4gdGhpcy5fdW5kb2luZz0hMSx0fX0se2tleTpcInJlZG9cIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX3JlZG9pbmc9ITA7dmFyIHQ9dXQodGhpcy55LHRoaXMuX3Njb3BlLHRoaXMuX3JlZG9CdWZmZXIpO3JldHVybiB0aGlzLl9yZWRvaW5nPSExLHR9fV0pLHR9KCksb2U9MWUzLGFlPTYwKm9lLHNlPTYwKmFlLGxlPTI0KnNlLHVlPTM2NS4yNSpsZSxjZT1mdW5jdGlvbih0LGUpe2U9ZXx8e307dmFyIG49dm9pZCAwPT09dD9cInVuZGVmaW5lZFwiOk90KHQpO2lmKFwic3RyaW5nXCI9PT1uJiZ0Lmxlbmd0aD4wKXJldHVybiBodCh0KTtpZihcIm51bWJlclwiPT09biYmITE9PT1pc05hTih0KSlyZXR1cm4gZS5sb25nP2R0KHQpOmZ0KHQpO3Rocm93IG5ldyBFcnJvcihcInZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgdmFsaWQgbnVtYmVyLiB2YWw9XCIrSlNPTi5zdHJpbmdpZnkodCkpfSxoZT1jdChmdW5jdGlvbih0LGUpe2Z1bmN0aW9uIG4odCl7dmFyIG4scj0wO2ZvcihuIGluIHQpcj0ocjw8NSktcit0LmNoYXJDb2RlQXQobikscnw9MDtyZXR1cm4gZS5jb2xvcnNbTWF0aC5hYnMociklZS5jb2xvcnMubGVuZ3RoXX1mdW5jdGlvbiByKHQpe2Z1bmN0aW9uIHIoKXtpZihyLmVuYWJsZWQpe3ZhciB0PXIsbj0rbmV3IERhdGUsaT1uLShsfHxuKTt0LmRpZmY9aSx0LnByZXY9bCx0LmN1cnI9bixsPW47Zm9yKHZhciBvPW5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKSxhPTA7YTxvLmxlbmd0aDthKyspb1thXT1hcmd1bWVudHNbYV07b1swXT1lLmNvZXJjZShvWzBdKSxcInN0cmluZ1wiIT10eXBlb2Ygb1swXSYmby51bnNoaWZ0KFwiJU9cIik7dmFyIHM9MDtvWzBdPW9bMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csZnVuY3Rpb24obixyKXtpZihcIiUlXCI9PT1uKXJldHVybiBuO3MrKzt2YXIgaT1lLmZvcm1hdHRlcnNbcl07aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgaSl7dmFyIGE9b1tzXTtuPWkuY2FsbCh0LGEpLG8uc3BsaWNlKHMsMSkscy0tfXJldHVybiBufSksZS5mb3JtYXRBcmdzLmNhbGwodCxvKTsoci5sb2d8fGUubG9nfHxjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpKS5hcHBseSh0LG8pfX1yZXR1cm4gci5uYW1lc3BhY2U9dCxyLmVuYWJsZWQ9ZS5lbmFibGVkKHQpLHIudXNlQ29sb3JzPWUudXNlQ29sb3JzKCksci5jb2xvcj1uKHQpLFwiZnVuY3Rpb25cIj09dHlwZW9mIGUuaW5pdCYmZS5pbml0KHIpLHJ9ZnVuY3Rpb24gaSh0KXtlLnNhdmUodCksZS5uYW1lcz1bXSxlLnNraXBzPVtdO2Zvcih2YXIgbj0oXCJzdHJpbmdcIj09dHlwZW9mIHQ/dDpcIlwiKS5zcGxpdCgvW1xccyxdKy8pLHI9bi5sZW5ndGgsaT0wO2k8cjtpKyspbltpXSYmKHQ9bltpXS5yZXBsYWNlKC9cXCovZyxcIi4qP1wiKSxcIi1cIj09PXRbMF0/ZS5za2lwcy5wdXNoKG5ldyBSZWdFeHAoXCJeXCIrdC5zdWJzdHIoMSkrXCIkXCIpKTplLm5hbWVzLnB1c2gobmV3IFJlZ0V4cChcIl5cIit0K1wiJFwiKSkpfWZ1bmN0aW9uIG8oKXtlLmVuYWJsZShcIlwiKX1mdW5jdGlvbiBhKHQpe3ZhciBuLHI7Zm9yKG49MCxyPWUuc2tpcHMubGVuZ3RoO248cjtuKyspaWYoZS5za2lwc1tuXS50ZXN0KHQpKXJldHVybiExO2ZvcihuPTAscj1lLm5hbWVzLmxlbmd0aDtuPHI7bisrKWlmKGUubmFtZXNbbl0udGVzdCh0KSlyZXR1cm4hMDtyZXR1cm4hMX1mdW5jdGlvbiBzKHQpe3JldHVybiB0IGluc3RhbmNlb2YgRXJyb3I/dC5zdGFja3x8dC5tZXNzYWdlOnR9ZT10LmV4cG9ydHM9ci5kZWJ1Zz1yLmRlZmF1bHQ9cixlLmNvZXJjZT1zLGUuZGlzYWJsZT1vLGUuZW5hYmxlPWksZS5lbmFibGVkPWEsZS5odW1hbml6ZT1jZSxlLm5hbWVzPVtdLGUuc2tpcHM9W10sZS5mb3JtYXR0ZXJzPXt9O3ZhciBsfSksZmU9KGhlLmNvZXJjZSxoZS5kaXNhYmxlLGhlLmVuYWJsZSxoZS5lbmFibGVkLGhlLmh1bWFuaXplLGhlLm5hbWVzLGhlLnNraXBzLGhlLmZvcm1hdHRlcnMsY3QoZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7cmV0dXJuIShcInVuZGVmaW5lZFwiPT10eXBlb2Ygd2luZG93fHwhd2luZG93LnByb2Nlc3N8fFwicmVuZGVyZXJcIiE9PXdpbmRvdy5wcm9jZXNzLnR5cGUpfHwoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGRvY3VtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2V8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3cmJndpbmRvdy5jb25zb2xlJiYod2luZG93LmNvbnNvbGUuZmlyZWJ1Z3x8d2luZG93LmNvbnNvbGUuZXhjZXB0aW9uJiZ3aW5kb3cuY29uc29sZS50YWJsZSl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQmJm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pJiZwYXJzZUludChSZWdFeHAuJDEsMTApPj0zMXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmbmF2aWdhdG9yLnVzZXJBZ2VudCYmbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKX1mdW5jdGlvbiByKHQpe3ZhciBuPXRoaXMudXNlQ29sb3JzO2lmKHRbMF09KG4/XCIlY1wiOlwiXCIpK3RoaXMubmFtZXNwYWNlKyhuP1wiICVjXCI6XCIgXCIpK3RbMF0rKG4/XCIlYyBcIjpcIiBcIikrXCIrXCIrZS5odW1hbml6ZSh0aGlzLmRpZmYpLG4pe3ZhciByPVwiY29sb3I6IFwiK3RoaXMuY29sb3I7dC5zcGxpY2UoMSwwLHIsXCJjb2xvcjogaW5oZXJpdFwiKTt2YXIgaT0wLG89MDt0WzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZyxmdW5jdGlvbih0KXtcIiUlXCIhPT10JiYoaSsrLFwiJWNcIj09PXQmJihvPWkpKX0pLHQuc3BsaWNlKG8sMCxyKX19ZnVuY3Rpb24gaSgpe3JldHVyblwib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIGNvbnNvbGU/XCJ1bmRlZmluZWRcIjpPdChjb25zb2xlKSkmJmNvbnNvbGUubG9nJiZGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZyxjb25zb2xlLGFyZ3VtZW50cyl9ZnVuY3Rpb24gbyh0KXt0cnl7bnVsbD09dD9lLnN0b3JhZ2UucmVtb3ZlSXRlbShcImRlYnVnXCIpOmUuc3RvcmFnZS5kZWJ1Zz10fWNhdGNoKHQpe319ZnVuY3Rpb24gYSgpe3ZhciB0O3RyeXt0PWUuc3RvcmFnZS5kZWJ1Z31jYXRjaCh0KXt9cmV0dXJuIXQmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBwcm9jZXNzJiZcImVudlwiaW4gcHJvY2VzcyYmKHQ9cHJvY2Vzcy5lbnYuREVCVUcpLHR9ZT10LmV4cG9ydHM9aGUsZS5sb2c9aSxlLmZvcm1hdEFyZ3M9cixlLnNhdmU9byxlLmxvYWQ9YSxlLnVzZUNvbG9ycz1uLGUuc3RvcmFnZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgY2hyb21lJiZ2b2lkIDAhPT1jaHJvbWUuc3RvcmFnZT9jaHJvbWUuc3RvcmFnZS5sb2NhbDpmdW5jdGlvbigpe3RyeXtyZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZX1jYXRjaCh0KXt9fSgpLGUuY29sb3JzPVtcImxpZ2h0c2VhZ3JlZW5cIixcImZvcmVzdGdyZWVuXCIsXCJnb2xkZW5yb2RcIixcImRvZGdlcmJsdWVcIixcImRhcmtvcmNoaWRcIixcImNyaW1zb25cIl0sZS5mb3JtYXR0ZXJzLmo9ZnVuY3Rpb24odCl7dHJ5e3JldHVybiBKU09OLnN0cmluZ2lmeSh0KX1jYXRjaCh0KXtyZXR1cm5cIltVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiBcIit0Lm1lc3NhZ2V9fSxlLmVuYWJsZShhKCkpfSkpLGRlPShmZS5sb2csZmUuZm9ybWF0QXJncyxmZS5zYXZlLGZlLmxvYWQsZmUudXNlQ29sb3JzLGZlLnN0b3JhZ2UsZmUuY29sb3JzLGZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe2lmKEV0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5vcHRzPW4sbnVsbD09bi5yb2xlfHxcIm1hc3RlclwiPT09bi5yb2xlKXRoaXMucm9sZT1cIm1hc3RlclwiO2Vsc2V7aWYoXCJzbGF2ZVwiIT09bi5yb2xlKXRocm93IG5ldyBFcnJvcihcIlJvbGUgbXVzdCBiZSBlaXRoZXIgJ21hc3Rlcicgb3IgJ3NsYXZlJyFcIik7dGhpcy5yb2xlPVwic2xhdmVcIn10aGlzLmxvZz1mZShcInk6Y29ubmVjdG9yXCIpLHRoaXMubG9nTWVzc2FnZT1mZShcInk6Y29ubmVjdG9yLW1lc3NhZ2VcIiksdGhpcy5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzPW4uZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zfHwhMSx0aGlzLnJvbGU9bi5yb2xlLHRoaXMuY29ubmVjdGlvbnM9bmV3IE1hcCx0aGlzLmlzU3luY2VkPSExLHRoaXMudXNlckV2ZW50TGlzdGVuZXJzPVtdLHRoaXMud2hlblN5bmNlZExpc3RlbmVycz1bXSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy5kZWJ1Zz0hMD09PW4uZGVidWcsdGhpcy5icm9hZGNhc3RCdWZmZXI9bmV3IEN0LHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZT0wLHRoaXMucHJvdG9jb2xWZXJzaW9uPTExLHRoaXMuYXV0aEluZm89bi5hdXRofHxudWxsLHRoaXMuY2hlY2tBdXRoPW4uY2hlY2tBdXRofHxmdW5jdGlvbigpe3JldHVybiBQcm9taXNlLnJlc29sdmUoXCJ3cml0ZVwiKX0sbnVsbD09bi5tYXhCdWZmZXJMZW5ndGg/dGhpcy5tYXhCdWZmZXJMZW5ndGg9LTE6dGhpcy5tYXhCdWZmZXJMZW5ndGg9bi5tYXhCdWZmZXJMZW5ndGh9cmV0dXJuIFV0KHQsW3trZXk6XCJyZWNvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMubG9nKFwicmVjb25uZWN0aW5nLi5cIil9fSx7a2V5OlwiZGlzY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubG9nKFwiZGlzY3Jvbm5lY3RpbmcuLlwiKSx0aGlzLmNvbm5lY3Rpb25zPW5ldyBNYXAsdGhpcy5pc1N5bmNlZD0hMSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLFByb21pc2UucmVzb2x2ZSgpfX0se2tleTpcIm9uVXNlckV2ZW50XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJyZW1vdmVVc2VyRXZlbnRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMudXNlckV2ZW50TGlzdGVuZXJzPXRoaXMudXNlckV2ZW50TGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm4gdCE9PWV9KX19LHtrZXk6XCJ1c2VyTGVmdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXt0aGlzLmxvZyhcIiVzOiBVc2VyIGxlZnQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuZGVsZXRlKHQpLHRoaXMuX3NldFN5bmNlZFdpdGgobnVsbCk7dmFyIGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7KDAsaS52YWx1ZSkoe2FjdGlvbjpcInVzZXJMZWZ0XCIsdXNlcjp0fSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19fX19LHtrZXk6XCJ1c2VySm9pbmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe2lmKG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhXCIpO2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXRocm93IG5ldyBFcnJvcihcIlRoaXMgdXNlciBhbHJlYWR5IGpvaW5lZCFcIik7dGhpcy5sb2coXCIlczogVXNlciBqb2luZWQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuc2V0KHQse3VpZDp0LGlzU3luY2VkOiExLHJvbGU6ZSxwcm9jZXNzQWZ0ZXJBdXRoOltdLHByb2Nlc3NBZnRlclN5bmM6W10sYXV0aDpufHxudWxsLHJlY2VpdmVkU3luY1N0ZXAyOiExfSk7dmFyIHI9e307ci5wcm9taXNlPW5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3IucmVzb2x2ZT10fSksdGhpcy5jb25uZWN0aW9ucy5nZXQodCkuc3luY1N0ZXAyPXI7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7KDAscy52YWx1ZSkoe2FjdGlvbjpcInVzZXJKb2luZWRcIix1c2VyOnQscm9sZTplfSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19dGhpcy5fc3luY1dpdGhVc2VyKHQpfX0se2tleTpcIndoZW5TeW5jZWRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmlzU3luY2VkP3QoKTp0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJfc3luY1dpdGhVc2VyXCIsdmFsdWU6ZnVuY3Rpb24odCl7XCJzbGF2ZVwiIT09dGhpcy5yb2xlJiZ1KHRoaXMsdCl9fSx7a2V5OlwiX2ZpcmVJc1N5bmNlZExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKCl7aWYoIXRoaXMuaXNTeW5jZWQpe3RoaXMuaXNTeW5jZWQ9ITA7dmFyIHQ9ITAsZT0hMSxuPXZvaWQgMDt0cnl7Zm9yKHZhciByLGk9dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzW1N5bWJvbC5pdGVyYXRvcl0oKTshKHQ9KHI9aS5uZXh0KCkpLmRvbmUpO3Q9ITApeygwLHIudmFsdWUpKCl9fWNhdGNoKHQpe2U9ITAsbj10fWZpbmFsbHl7dHJ5eyF0JiZpLnJldHVybiYmaS5yZXR1cm4oKX1maW5hbGx5e2lmKGUpdGhyb3cgbn19dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLHRoaXMueS5fc2V0Q29udGVudFJlYWR5KCksdGhpcy55LmVtaXQoXCJzeW5jZWRcIil9fX0se2tleTpcInNlbmRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueTtpZighKGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlcyB0byBVc2VyJXM6IFNlbmQgJyV5J1wiLG4udXNlcklELHQsZSksdGhpcy5sb2dNZXNzYWdlKFwiVXNlciVzIHRvIFVzZXIlczogU2VuZCAlWVwiLG4udXNlcklELHQsW24sZV0pfX0se2tleTpcImJyb2FkY2FzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMueTtpZighKHQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8dCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlczogQnJvYWRjYXN0ICcleSdcIixlLnVzZXJJRCx0KSx0aGlzLmxvZ01lc3NhZ2UoXCJVc2VyJXM6IEJyb2FkY2FzdDogJVlcIixlLnVzZXJJRCxbZSx0XSl9fSx7a2V5OlwiYnJvYWRjYXN0U3RydWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPTA9PT10aGlzLmJyb2FkY2FzdEJ1ZmZlci5sZW5ndGg7aWYobiYmKHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVmFyU3RyaW5nKHRoaXMueS5yb29tKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlci53cml0ZVZhclN0cmluZyhcInVwZGF0ZVwiKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemU9MCx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3M9dGhpcy5icm9hZGNhc3RCdWZmZXIucG9zLHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVWludDMyKDApKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemUrKyx0Ll90b0JpbmFyeSh0aGlzLmJyb2FkY2FzdEJ1ZmZlciksdGhpcy5tYXhCdWZmZXJMZW5ndGg+MCYmdGhpcy5icm9hZGNhc3RCdWZmZXIubGVuZ3RoPnRoaXMubWF4QnVmZmVyTGVuZ3RoKXt2YXIgcj10aGlzLmJyb2FkY2FzdEJ1ZmZlcjtyLnNldFVpbnQzMih0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsdGhpcy5icm9hZGNhc3RCdWZmZXJTaXplKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgQ3QsdGhpcy53aGVuUmVtb3RlUmVzcG9uc2l2ZSgpLnRoZW4oZnVuY3Rpb24oKXtlLmJyb2FkY2FzdChyLmNyZWF0ZUJ1ZmZlcigpKX0pfWVsc2UgbiYmc2V0VGltZW91dChmdW5jdGlvbigpe2lmKGUuYnJvYWRjYXN0QnVmZmVyLmxlbmd0aD4wKXt2YXIgdD1lLmJyb2FkY2FzdEJ1ZmZlcjt0LnNldFVpbnQzMihlLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsZS5icm9hZGNhc3RCdWZmZXJTaXplKSxlLmJyb2FkY2FzdCh0LmNyZWF0ZUJ1ZmZlcigpKSxlLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgQ3R9fSwwKX19LHtrZXk6XCJ3aGVuUmVtb3RlUmVzcG9uc2l2ZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3NldFRpbWVvdXQodCwxMDApfSl9fSx7a2V5OlwicmVjZWl2ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI9dGhpcyxpPXRoaXMueSxvPWkudXNlcklEO2lmKG49bnx8ITEsIShlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXJ8fGUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSlyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IVwiKSk7aWYodD09PW8pcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO3ZhciBhPW5ldyBWdChlKSxzPW5ldyBDdCxsPWEucmVhZFZhclN0cmluZygpO3Mud3JpdGVWYXJTdHJpbmcobCk7dmFyIHU9YS5yZWFkVmFyU3RyaW5nKCksYz10aGlzLmNvbm5lY3Rpb25zLmdldCh0KTtpZih0aGlzLmxvZyhcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAnJXMnXCIsbyx0LHUpLHRoaXMubG9nTWVzc2FnZShcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAlWVwiLG8sdCxbaSxlXSksbnVsbD09YyYmIW4pdGhyb3cgbmV3IEVycm9yKFwiUmVjZWl2ZWQgbWVzc2FnZSBmcm9tIHVua25vd24gcGVlciFcIik7aWYoXCJzeW5jIHN0ZXAgMVwiPT09dXx8XCJzeW5jIHN0ZXAgMlwiPT09dSl7dmFyIGg9YS5yZWFkVmFyVWludCgpO2lmKG51bGw9PWMuYXV0aClyZXR1cm4gYy5wcm9jZXNzQWZ0ZXJBdXRoLnB1c2goW3UsYyxhLHMsdF0pLHRoaXMuY2hlY2tBdXRoKGgsaSx0KS50aGVuKGZ1bmN0aW9uKHQpe251bGw9PWMuYXV0aCYmKGMuYXV0aD10LGkuZW1pdChcInVzZXJBdXRoZW50aWNhdGVkXCIse3VzZXI6Yy51aWQsYXV0aDp0fSkpO3ZhciBlPWMucHJvY2Vzc0FmdGVyQXV0aDtjLnByb2Nlc3NBZnRlckF1dGg9W10sZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiByLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX0pfSFuJiZudWxsPT1jLmF1dGh8fFwidXBkYXRlXCI9PT11JiYhYy5pc1N5bmNlZD9jLnByb2Nlc3NBZnRlclN5bmMucHVzaChbdSxjLGEscyx0LCExXSk6dGhpcy5jb21wdXRlTWVzc2FnZSh1LGMsYSxzLHQsbil9fSx7a2V5OlwiY29tcHV0ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbixpLG8sYSl7aWYoXCJzeW5jIHN0ZXAgMVwiIT09dHx8XCJ3cml0ZVwiIT09ZS5hdXRoJiZcInJlYWRcIiE9PWUuYXV0aCl7dmFyIHM9dGhpcy55O3MudHJhbnNhY3QoZnVuY3Rpb24oKXtpZihcInN5bmMgc3RlcCAyXCI9PT10JiZcIndyaXRlXCI9PT1lLmF1dGgpZChuLGkscyxlLG8pO2Vsc2V7aWYoXCJ1cGRhdGVcIiE9PXR8fCFhJiZcIndyaXRlXCIhPT1lLmF1dGgpdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJlY2VpdmUgbWVzc2FnZVwiKTtyKHMsbil9fSwhMCl9ZWxzZSBoKG4saSx0aGlzLnksZSxvKX19LHtrZXk6XCJfc2V0U3luY2VkV2l0aFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7aWYobnVsbCE9dCl7dmFyIG49dGhpcy5jb25uZWN0aW9ucy5nZXQodCk7bi5pc1N5bmNlZD0hMDt2YXIgcj1uLnByb2Nlc3NBZnRlclN5bmM7bi5wcm9jZXNzQWZ0ZXJTeW5jPVtdLHIuZm9yRWFjaChmdW5jdGlvbih0KXtlLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX12YXIgaT1BcnJheS5mcm9tKHRoaXMuY29ubmVjdGlvbnMudmFsdWVzKCkpO2kubGVuZ3RoPjAmJmkuZXZlcnkoZnVuY3Rpb24odCl7cmV0dXJuIHQuaXNTeW5jZWR9KSYmdGhpcy5fZmlyZUlzU3luY2VkTGlzdGVuZXJzKCl9fV0pLHR9KCkpLF9lPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtFdCh0aGlzLHQpLHRoaXMub3B0cz1lLHRoaXMueXM9bmV3IE1hcH1yZXR1cm4gVXQodCxbe2tleTpcIl9pbml0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPXRoaXMueXMuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1uPyhuPXl0KCksbi5tdXR1YWxFeGNsdWRlPUsoKSx0aGlzLnlzLnNldCh0LG4pLHRoaXMuaW5pdCh0KS50aGVuKGZ1bmN0aW9uKCl7cmV0dXJuIHQub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxuKXt2YXIgcj1lLnlzLmdldCh0KTtpZihyLmxlbj4wKXtyLmJ1ZmZlci5zZXRVaW50MzIoMCxyLmxlbiksZS5zYXZlVXBkYXRlKHQsci5idWZmZXIuY3JlYXRlQnVmZmVyKCksbik7dmFyIGk9eXQoKTtmb3IodmFyIG8gaW4gaSlyW29dPWlbb119fSksZS5yZXRyaWV2ZSh0KX0pLnRoZW4oZnVuY3Rpb24oKXtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG4pfSkpOlByb21pc2UucmVzb2x2ZShuKX19LHtrZXk6XCJkZWluaXRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnlzLmRlbGV0ZSh0KSx0LnBlcnNpc3RlbmNlPW51bGx9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy55cz1udWxsfX0se2tleTpcInJlbW92ZVBlcnNpc3RlZERhdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49IShhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSl8fGFyZ3VtZW50c1sxXTt0aGlzLnlzLmZvckVhY2goZnVuY3Rpb24ocixpKXtpLnJvb209PT10JiYobj9pLmRlc3Ryb3koKTplLmRlaW5pdChpKSl9KX19LHtrZXk6XCJzYXZlVXBkYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7fX0se2tleTpcInNhdmVTdHJ1Y3RcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueXMuZ2V0KHQpO3ZvaWQgMCE9PW4mJm4ubXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UuX3RvQmluYXJ5KG4uYnVmZmVyKSxuLmxlbisrfSl9fSx7a2V5OlwicmV0cmlldmVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIGk9dGhpcy55cy5nZXQodCk7dm9pZCAwIT09aSYmaS5tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dC50cmFuc2FjdChmdW5jdGlvbigpe2lmKG51bGwhPWUmJnZ0KHQsbmV3IFZ0KG5ldyBVaW50OEFycmF5KGUpKSksbnVsbCE9bilmb3IodmFyIGk9MDtpPG4ubGVuZ3RoO2krKylyKHQsbmV3IFZ0KG5ldyBVaW50OEFycmF5KG5baV0pKSl9KSx0LmVtaXQoXCJwZXJzaXN0ZW5jZVJlYWR5XCIpfSl9fSx7a2V5OlwicGVyc2lzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBwdCh0KS5jcmVhdGVCdWZmZXIoKX19XSksdH0oKSx2ZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7RXQodGhpcyxlKTt2YXIgcj1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4udmFsdWU9dC50b1N0cmluZygpLHIuX3R5cGVPYnNlcnZlcj1ndC5iaW5kKHIpLHIuX2RvbU9ic2VydmVyPW10LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIixyLl9kb21PYnNlcnZlcikscn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0LnVub2JzZXJ2ZSh0aGlzLl9kb21PYnNlcnZlciksQnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KEt0KSxwZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7RXQodGhpcyxlKTt2YXIgcj1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4uc2V0Q29udGVudHModC50b0RlbHRhKCksXCJ5anNcIiksci5fdHlwZU9ic2VydmVyPWt0LmJpbmQociksci5fcXVpbGxPYnNlcnZlcj1idC5iaW5kKHIpLHQub2JzZXJ2ZShyLl90eXBlT2JzZXJ2ZXIpLG4ub24oXCJ0ZXh0LWNoYW5nZVwiLHIuX3F1aWxsT2JzZXJ2ZXIpLHJ9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZS51bm9ic2VydmUodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLnRhcmdldC5vZmYoXCJ0ZXh0LWNoYW5nZVwiLHRoaXMuX3F1aWxsT2JzZXJ2ZXIpLEJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShLdCkseWU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0LG4pe0V0KHRoaXMsZSk7dmFyIHI9QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzLHQsbikpO3JldHVybiBuLnNldFZhbHVlKHQudG9TdHJpbmcoKSksci5fdHlwZU9ic2VydmVyPXd0LmJpbmQociksci5fY29kZU1pcnJvck9ic2VydmVyPVN0LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5vbihcImNoYW5nZXNcIixyLl9jb2RlTWlycm9yT2JzZXJ2ZXIpLHJ9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZS51bm9ic2VydmUodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLnRhcmdldC51bm9ic2VydmUodGhpcy5fY29kZU1pcnJvck9ic2VydmVyKSxCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0oS3QpO3JldHVybiBZLkFic3RyYWN0Q29ubmVjdG9yPWRlLFkuQWJzdHJhY3RQZXJzaXN0ZW5jZT1fZSxZLkFycmF5PVlBcnJheSxZLk1hcD1ZTWFwLFkuVGV4dD1ZVGV4dCxZLlhtbEVsZW1lbnQ9WVhtbEVsZW1lbnQsWS5YbWxGcmFnbWVudD1ZWG1sRnJhZ21lbnQsWS5YbWxUZXh0PVlYbWxUZXh0LFkuWG1sSG9vaz1ZWG1sSG9vayxZLlRleHRhcmVhQmluZGluZz12ZSxZLlF1aWxsQmluZGluZz1wZSxZLkRvbUJpbmRpbmc9bmUsWS5Db2RlTWlycm9yQmluZGluZz15ZSxuZS5kb21Ub1R5cGU9TCxuZS5kb21zVG9UeXBlcz1KLG5lLnN3aXRjaEFzc29jaWF0aW9uPVcsWS51dGlscz17QmluYXJ5RGVjb2RlcjpWdCxVbmRvTWFuYWdlcjppZSxnZXRSZWxhdGl2ZVBvc2l0aW9uOlosZnJvbVJlbGF0aXZlUG9zaXRpb246USxyZWdpc3RlclN0cnVjdDpYLGludGVncmF0ZVJlbW90ZVN0cnVjdHM6cix0b0JpbmFyeTpwdCxmcm9tQmluYXJ5OnZ0fSxZLmRlYnVnPWZlLGZlLmZvcm1hdHRlcnMuWT1fLGZlLmZvcm1hdHRlcnMueT12LFl9KTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXkuanMubWFwXG4iLCJ2YXIgWSA9IHJlcXVpcmUoJ3lqcycpO1xud2luZG93LlkgPSBZO1xucmVxdWlyZSgneS13ZWJydGMzJykoWSk7XG5cbnZhciBub3RlYm9va19uYW1lID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2JvZHknKVswXS5nZXRBdHRyaWJ1dGUoJ2RhdGEtbm90ZWJvb2stbmFtZScpO1xudmFyIHkgPSBuZXcgWShub3RlYm9va19uYW1lLCB7XG4gICAgY29ubmVjdG9yOiB7XG4gICAgICAgIG5hbWU6ICd3ZWJydGMnLFxuICAgICAgICByb29tOiBub3RlYm9va19uYW1lLFxuICAgICAgICB1cmw6ICdodHRwOi8vZmlud2luLmlvOjEyNTYnXG4gICAgfVxufSk7XG53aW5kb3cueSA9IHk7XG5cbmZ1bmN0aW9uIHN0YXJ0X3liaW5kaW5ncygpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNfYXZhaWxhYmxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBmb3IgKHZhciBpZCBpbiBzaGFyZWRfZWxlbWVudHMpIHtcbiAgICAgICAgICAgIHZhciBjb2RlbWlycm9yID0gc2hhcmVkX2VsZW1lbnRzW2lkXVsnY29kZW1pcnJvciddO1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IHNoYXJlZF9lbGVtZW50c1tpZF1bJ291dHB1dCddO1xuICAgICAgICAgICAgbmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3InK2lkLCBZLlRleHQpLCBjb2RlbWlycm9yKTtcbiAgICAgICAgICAgIG5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbCcraWQsIFkuWG1sRnJhZ21lbnQpLCBvdXRwdXQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cucmVzb2x2ZV95bWFwID0gdHJ1ZTtcbiAgICAgICAgdmFyIHltYXAgPSB5LmRlZmluZSgneW1hcCcsIFkuTWFwKTtcbiAgICAgICAgeW1hcC5vYnNlcnZlKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBleGVjX3ltYXAoKTtcbiAgICAgICAgICAgIGlmICh3aW5kb3cucmVzb2x2ZV95bWFwKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnJlc29sdmVfeW1hcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGV4ZWNfeW1hcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgd2luZG93LnltYXAgPSB5bWFwO1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZXhlY195bWFwKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBKdXB5dGVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgSnVweXRlci5ub3RlYm9vayAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IHltYXAua2V5cygpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGluZGV4IGluIGtleXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0ga2V5c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIHNldF9jZWxsKGlkLCB5bWFwLmdldChpZClbJ2luZGV4J10sIHltYXAuZ2V0KGlkKVsnYWN0aXZlJ10pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChleGVjX3ltYXAsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cuZ2V0X2luYWN0aXZlX2NlbGwgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIGNlbGxzID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxjZWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjZWxsc1tpXS5jZWxsX3R5cGUgPT09IHR5cGUgJiYgY2VsbHNbaV0ubWV0YWRhdGEuYWN0aXZlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2VsbHNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cuZ2V0X2NlbGwgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgIHZhciBjZWxscyA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGxzKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8Y2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2VsbHNbaV0ubWV0YWRhdGEuaWQgPT09IGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjZWxsc1tpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdpbmRvdy5zZXRfY2VsbCA9IGZ1bmN0aW9uIChpZCwgaW5kZXgsIGFjdGl2ZSkge1xuICAgICAgICAgICAgZnVuY3Rpb24gc2V0X2VsZW1lbnQoZWxlbWVudCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdG8gPSAkKCcjbm90ZWJvb2stY29udGFpbmVyJyk7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvLnByZXBlbmQoZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdG8uY2hpbGRyZW4oKS5lcShpbmRleC0xKS5hZnRlcihlbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIGNlbGwgPSBnZXRfY2VsbChwYXJzZUludChpZCkpO1xuICAgICAgICAgICAgc2V0X2VsZW1lbnQoY2VsbC5lbGVtZW50LCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YS5hY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5mb2N1c19jZWxsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5zZXRfdGV4dCgnJyk7XG4gICAgICAgICAgICAgICAgaWYgKGNlbGwuY2VsbF90eXBlID09PSAnY29kZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5vdXRwdXRfYXJlYS5jbGVhcl9vdXRwdXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YS5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQoc3RhcnRfeWJpbmRpbmdzLCAwKTtcbiAgICB9XG59XG5zdGFydF95YmluZGluZ3MoKTtcbiJdfQ==

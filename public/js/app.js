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
/**
 * y-array2 - Array Type for Yjs
 * @version v1.5.0
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.yArray=e()}(this,function(){"use strict";function t(t){t.utils.yarrayEventHandler=function(e){var n=this;if("Insert"===e.struct){if(this._content.some(function(n){return t.utils.compareIds(n.id,e.id)}))return;var r=void 0;if(null===e.left)r=0;else if((r=1+this._content.findIndex(function(n){return t.utils.compareIds(n.id,e.left)}))<=0)throw new Error("Unexpected operation!");var i,o;if(e.hasOwnProperty("opContent")){this._content.splice(r,0,{id:e.id,type:e.opContent}),o=1;var s=this.os.getType(e.opContent);s._parent=this._model,i=[s]}else{var l=e.content.map(function(t,n){return{id:[e.id[0],e.id[1]+n],val:t}});l.length<3e4?this._content.splice.apply(this._content,[r,0].concat(l)):this._content=this._content.slice(0,r).concat(l).concat(this._content.slice(r)),i=e.content,o=e.content.length}t.utils.bubbleEvent(this,{type:"insert",object:this,index:r,values:i,length:o})}else{if("Delete"!==e.struct)throw new Error("Unexpected struct!");for(var a=0;a<this._content.length&&e.length>0;a++){var u=this._content[a];if(t.utils.inDeletionRange(e,u.id)){var c;for(c=1;c<e.length&&a+c<this._content.length&&t.utils.inDeletionRange(e,this._content[a+c].id);c++);u=this._content[a+c-1],e.length-=u.id[1]-e.target[1]+1,e.target=[u.id[0],u.id[1]+1];var h=this._content.splice(a,c),f=h.map(function(t){return null!=t.val?t.val:n.os.getType(t.type)});t.utils.bubbleEvent(this,{type:"delete",object:this,index:a,values:f,_content:h,length:c})}}}};var o=function(o){function s(n,r,o){e(this,s);var l=i(this,(s.__proto__||Object.getPrototypeOf(s)).call(this));return l.os=n,l._model=r,l._content=o,l._parent=null,l._deepEventHandler=new t.utils.EventListenerHandler,l.eventHandler=new t.utils.EventHandler(t.utils.yarrayEventHandler.bind(l)),l}return r(s,o),n(s,[{key:"_getPathToChild",value:function(e){return this._content.findIndex(function(n){return null!=n.type&&t.utils.compareIds(n.type,e)})}},{key:"_destroy",value:function(){this.eventHandler.destroy(),this.eventHandler=null,this._content=null,this._model=null,this._parent=null,this.os=null}},{key:"toJSON",value:function(){var t=this;return this._content.map(function(e){if(null!=e.type){var n=t.os.getType(e.type);return null!=n.toJSON?n.toJSON():null!=n.toString?n.toString():void 0}return e.val})}},{key:"get",value:function(t){if(null==t||"number"!=typeof t)throw new Error("pos must be a number!");if(!(t>=this._content.length))return null==this._content[t].type?this._content[t].val:this.os.getType(this._content[t].type)}},{key:"toArray",value:function(){var t=this;return this._content.map(function(e,n){return null!=e.type?t.os.getType(e.type):e.val})}},{key:"push",value:function(t){return this.insert(this._content.length,t)}},{key:"insert",value:function(e,n){if("number"!=typeof e)throw new Error("pos must be a number!");if(!Array.isArray(n))throw new Error("contents must be an Array of objects!");if(0!==n.length){if(e>this._content.length||e<0)throw new Error("This position exceeds the range of the array!");for(var r=0===e?null:this._content[e-1].id,i=[],o=r,s=0;s<n.length;){for(var l,a={left:o,origin:o,parent:this._model,struct:"Insert"},u=[];s<n.length;){var c=n[s++];if(l=t.utils.isTypeDefinition(c)){if(u.length>0){s--;break}break}u.push(c)}if(u.length>0)a.content=u,a.id=this.os.getNextOpId(u.length);else{var h=this.os.getNextOpId(1);this.os.createType(l,h),a.opContent=h,a.id=this.os.getNextOpId(1)}i.push(a),o=a.id}var f=this.eventHandler;this.os.requestTransaction(function(){var t;if(null!=r){t=this.getInsertionCleanEnd(r).right}else t=this.getOperation(i[0].parent).start;for(var e=0;e<i.length;e++){i[e].right=t}f.awaitOps(this,this.applyCreatedOperations,[i])}),f.awaitAndPrematurelyCall(i)}}},{key:"delete",value:function(e,n){if(null==n&&(n=1),"number"!=typeof n)throw new Error("length must be a number!");if("number"!=typeof e)throw new Error("pos must be a number!");if(e+n>this._content.length||e<0||n<0)throw new Error("The deletion range exceeds the range of the array!");if(0!==n){for(var r,i=this.eventHandler,o=[],s=0;s<n;s+=r){var l=this._content[e+s].id;for(r=1;s+r<n&&t.utils.compareIds(this._content[e+s+r].id,[l[0],l[1]+r]);r++);o.push({target:l,struct:"Delete",length:r})}this.os.requestTransaction(function(){i.awaitOps(this,this.applyCreatedOperations,[o])}),i.awaitAndPrematurelyCall(o)}}},{key:"observe",value:function(t){this.eventHandler.addEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserve",value:function(t){this.eventHandler.removeEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_changed",value:function(t,e){if(!e.deleted){if("Insert"===e.struct){for(var n,r=e.left;null!=r&&(n=t.getInsertion(r),n.deleted);)r=n.left;e.left=r,null!=e.opContent&&t.store.initType.call(t,e.opContent)}this.eventHandler.receivedOp(e)}}},{key:"length",get:function(){return this._content.length}}]),s}(t.utils.CustomType);t.extend("Array",new t.utils.CustomTypeDefinition({name:"Array",class:o,struct:"List",initType:function(e,n){var r=[],i=[];t.Struct.List.map.call(this,n,function(t){t.hasOwnProperty("opContent")?(r.push({id:t.id,type:t.opContent}),i.push(t.opContent)):t.content.forEach(function(e,n){r.push({id:[t.id[0],t.id[1]+n],val:t.content[n]})})});for(var s=0;s<i.length;s++){this.store.initType.call(this,i[s])._parent=n.id}return new o(e,n.id,r)},createType:function(t,e){return new o(t,e.id,[])}}))}var e=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},n=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),r=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},i=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e};return"undefined"!=typeof Y&&t(Y),t});


},{}],6:[function(require,module,exports){
/**
 * y-map2 - Map Type for Yjs
 * @version v1.5.0
 * @license MIT
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):e.yMap=t()}(this,function(){"use strict";function e(e){var r=function(r){function s(n,o,r,u){t(this,s);var l=i(this,(s.__proto__||Object.getPrototypeOf(s)).call(this));return l._model=o.id,l._parent=null,l._deepEventHandler=new e.utils.EventListenerHandler,l.os=n,l.map=e.utils.copyObject(o.map),l.contents=r,l.opContents=u,l.eventHandler=new e.utils.EventHandler(function(t){var n,o="Delete"===t.struct?t.key:t.parentSub;if(n=null!=l.opContents[o]?l.os.getType(l.opContents[o]):l.contents[o],"Insert"===t.struct){if(null===t.left&&!e.utils.compareIds(t.id,l.map[o])){var i;null!=t.opContent?(i=l.os.getType(t.opContent),i._parent=l._model,delete l.contents[o],t.deleted?delete l.opContents[o]:l.opContents[o]=t.opContent):(i=t.content[0],delete l.opContents[o],t.deleted?delete l.contents[o]:l.contents[o]=t.content[0]),l.map[o]=t.id,void 0===n?e.utils.bubbleEvent(l,{name:o,object:l,type:"add",value:i}):e.utils.bubbleEvent(l,{name:o,object:l,oldValue:n,type:"update",value:i})}}else{if("Delete"!==t.struct)throw new Error("Unexpected Operation!");e.utils.compareIds(l.map[o],t.target)&&(delete l.opContents[o],delete l.contents[o],e.utils.bubbleEvent(l,{name:o,object:l,oldValue:n,type:"delete"}))}}),l}return o(s,r),n(s,[{key:"_getPathToChild",value:function(t){var n=this;return Object.keys(this.opContents).find(function(o){return e.utils.compareIds(n.opContents[o],t)})}},{key:"_destroy",value:function(){this.eventHandler.destroy(),this.eventHandler=null,this.contents=null,this.opContents=null,this._model=null,this._parent=null,this.os=null,this.map=null}},{key:"toJSON",value:function(){var e={};for(var t in this.contents)e[t]=this.contents[t];for(var n in this.opContents){var o=this.os.getType(this.opContents[n]);null!=o.toJSON?e[n]=o.toJSON():null!=o.toString&&(e[n]=o.toString())}return e}},{key:"get",value:function(e){if(null==e||"string"!=typeof e)throw new Error("You must specify a key (as string)!");return null==this.opContents[e]?this.contents[e]:this.os.getType(this.opContents[e])}},{key:"keys",value:function(){return Object.keys(this.contents).concat(Object.keys(this.opContents))}},{key:"keysPrimitives",value:function(){return Object.keys(this.contents)}},{key:"keysTypes",value:function(){return Object.keys(this.opContents)}},{key:"getPrimitive",value:function(t){if(null==t)return e.utils.copyObject(this.contents);if("string"!=typeof t)throw new Error("Key is expected to be a string!");return this.contents[t]}},{key:"getType",value:function(e){if(null==e||"string"!=typeof e)throw new Error("You must specify a key (as string)!");return null!=this.opContents[e]?this.os.getType(this.opContents[e]):null}},{key:"delete",value:function(t){var n=this.map[t];if(null!=n){var o={target:n,struct:"Delete"},i=this.eventHandler,r=e.utils.copyObject(o);r.key=t,this.os.requestTransaction(function(){i.awaitOps(this,this.applyCreatedOperations,[[o]])}),i.awaitAndPrematurelyCall([r])}}},{key:"set",value:function(t,n){var o=this.map[t]||null,i={id:this.os.getNextOpId(1),left:null,right:o,origin:null,parent:this._model,parentSub:t,struct:"Insert"},r=this.eventHandler,s=e.utils.isTypeDefinition(n);if(!1!==s){var u=this.os.createType(s);return i.opContent=u._model,this.os.requestTransaction(function(){r.awaitOps(this,this.applyCreatedOperations,[[i]])}),r.awaitAndPrematurelyCall([i]),u}return i.content=[n],this.os.requestTransaction(function(){r.awaitOps(this,this.applyCreatedOperations,[[i]])}),r.awaitAndPrematurelyCall([i]),n}},{key:"observe",value:function(e){this.eventHandler.addEventListener(e)}},{key:"observeDeep",value:function(e){this._deepEventHandler.addEventListener(e)}},{key:"unobserve",value:function(e){this.eventHandler.removeEventListener(e)}},{key:"unobserveDeep",value:function(e){this._deepEventHandler.removeEventListener(e)}},{key:"observePath",value:function(t,n){function o(e){e.name===i&&n(r.get(i))}var i,r=this;if(t.length<1)return n(this),function(){};if(1===t.length)return i=t[0],n(r.get(i)),this.observe(o),function(){r.unobserve(n)};var u,l=function(){var o=r.get(t[0]);o instanceof s||(o=r.set(t[0],e.Map)),u=o.observePath(t.slice(1),n)},a=function(e){e.name===t[0]&&(null!=u&&u(),"add"!==e.type&&"update"!==e.type||l())};return r.observe(a),l(),function(){null!=u&&u(),r.unobserve(a)}}},{key:"_changed",value:function(e,t){if("Delete"===t.struct){if(null==t.key){var n=e.getOperation(t.target);t.key=n.parentSub}}else null!=t.opContent&&e.store.initType.call(e,t.opContent);this.eventHandler.receivedOp(t)}}]),s}(e.utils.CustomType);e.extend("Map",new e.utils.CustomTypeDefinition({name:"Map",class:r,struct:"Map",initType:function(e,t){var n={},o={},i=t.map;for(var s in i){var u=this.getOperation(i[s]);if(!u.deleted)if(null!=u.opContent){o[s]=u.opContent;var l=this.store.initType.call(this,u.opContent);l._parent=t.id}else n[s]=u.content[0]}return new r(e,t,n,o)},createType:function(e,t){return new r(e,t,{},{})}}))}var t=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")},n=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o)}}return function(t,n,o){return n&&e(t.prototype,n),o&&e(t,o),t}}(),o=function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)},i=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t};return"undefined"!=typeof Y&&e(Y),e});


},{}],7:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  require('./RedBlackTree.js')(Y)
  class Transaction extends Y.Transaction {
    constructor (store) {
      super(store)
      this.store = store
      this.ss = store.ss
      this.os = store.os
      this.ds = store.ds
    }
  }
  var Store = Y.utils.RBTree
  var BufferedStore = Y.utils.createSmallLookupBuffer(Store)

  class Database extends Y.AbstractDatabase {
    constructor (y, opts) {
      super(y, opts)
      this.os = new BufferedStore()
      this.ds = new Store()
      this.ss = new BufferedStore()
    }
    logTable () {
      var self = this
      self.requestTransaction(function * () {
        console.log('User: ', this.store.y.connector.userId, "==============================") // eslint-disable-line
        console.log("State Set (SS):", yield* this.getStateSet()) // eslint-disable-line
        console.log("Operation Store (OS):") // eslint-disable-line
        yield* this.os.logTable() // eslint-disable-line
        console.log("Deletion Store (DS):") //eslint-disable-line
        yield* this.ds.logTable() // eslint-disable-line
        if (this.store.gc1.length > 0 || this.store.gc2.length > 0) {
          console.warn('GC1|2 not empty!', this.store.gc1, this.store.gc2)
        }
        if (JSON.stringify(this.store.listenersById) !== '{}') {
          console.warn('listenersById not empty!')
        }
        if (JSON.stringify(this.store.listenersByIdExecuteNow) !== '[]') {
          console.warn('listenersByIdExecuteNow not empty!')
        }
        if (this.store.transactionInProgress) {
          console.warn('Transaction still in progress!')
        }
      }, true)
    }
    transact (makeGen) {
      var t = new Transaction(this)
      while (makeGen !== null) {
        var gen = makeGen.call(t)
        var res = gen.next()
        while (!res.done) {
          res = gen.next(res.value)
        }
        makeGen = this.getNextRequest()
      }
    }
    * destroy () {
      yield* super.destroy()
      delete this.os
      delete this.ss
      delete this.ds
    }
  }
  Y.extend('memory', Database)
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{"./RedBlackTree.js":8}],8:[function(require,module,exports){
'use strict'

/*
  This file contains a not so fancy implemantion of a Red Black Tree.
*/
module.exports = function (Y) {
  class N {
    // A created node is always red!
    constructor (val) {
      this.val = val
      this.color = true
      this._left = null
      this._right = null
      this._parent = null
      if (val.id === null) {
        throw new Error('You must define id!')
      }
    }
    isRed () { return this.color }
    isBlack () { return !this.color }
    redden () { this.color = true; return this }
    blacken () { this.color = false; return this }
    get grandparent () {
      return this.parent.parent
    }
    get parent () {
      return this._parent
    }
    get sibling () {
      return (this === this.parent.left)
        ? this.parent.right : this.parent.left
    }
    get left () {
      return this._left
    }
    get right () {
      return this._right
    }
    set left (n) {
      if (n !== null) {
        n._parent = this
      }
      this._left = n
    }
    set right (n) {
      if (n !== null) {
        n._parent = this
      }
      this._right = n
    }
    rotateLeft (tree) {
      var parent = this.parent
      var newParent = this.right
      var newRight = this.right.left
      newParent.left = this
      this.right = newRight
      if (parent === null) {
        tree.root = newParent
        newParent._parent = null
      } else if (parent.left === this) {
        parent.left = newParent
      } else if (parent.right === this) {
        parent.right = newParent
      } else {
        throw new Error('The elements are wrongly connected!')
      }
    }
    next () {
      if (this.right !== null) {
        // search the most left node in the right tree
        var o = this.right
        while (o.left !== null) {
          o = o.left
        }
        return o
      } else {
        var p = this
        while (p.parent !== null && p !== p.parent.left) {
          p = p.parent
        }
        return p.parent
      }
    }
    prev () {
      if (this.left !== null) {
        // search the most right node in the left tree
        var o = this.left
        while (o.right !== null) {
          o = o.right
        }
        return o
      } else {
        var p = this
        while (p.parent !== null && p !== p.parent.right) {
          p = p.parent
        }
        return p.parent
      }
    }
    rotateRight (tree) {
      var parent = this.parent
      var newParent = this.left
      var newLeft = this.left.right
      newParent.right = this
      this.left = newLeft
      if (parent === null) {
        tree.root = newParent
        newParent._parent = null
      } else if (parent.left === this) {
        parent.left = newParent
      } else if (parent.right === this) {
        parent.right = newParent
      } else {
        throw new Error('The elements are wrongly connected!')
      }
    }
    getUncle () {
      // we can assume that grandparent exists when this is called!
      if (this.parent === this.parent.parent.left) {
        return this.parent.parent.right
      } else {
        return this.parent.parent.left
      }
    }
  }

  class RBTree {
    constructor () {
      this.root = null
      this.length = 0
    }
    * findNext (id) {
      return yield* this.findWithLowerBound([id[0], id[1] + 1])
    }
    * findPrev (id) {
      return yield* this.findWithUpperBound([id[0], id[1] - 1])
    }
    findNodeWithLowerBound (from) {
      if (from === void 0) {
        throw new Error('You must define from!')
      }
      var o = this.root
      if (o === null) {
        return null
      } else {
        while (true) {
          if ((from === null || Y.utils.smaller(from, o.val.id)) && o.left !== null) {
            // o is included in the bound
            // try to find an element that is closer to the bound
            o = o.left
          } else if (from !== null && Y.utils.smaller(o.val.id, from)) {
            // o is not within the bound, maybe one of the right elements is..
            if (o.right !== null) {
              o = o.right
            } else {
              // there is no right element. Search for the next bigger element,
              // this should be within the bounds
              return o.next()
            }
          } else {
            return o
          }
        }
      }
    }
    findNodeWithUpperBound (to) {
      if (to === void 0) {
        throw new Error('You must define from!')
      }
      var o = this.root
      if (o === null) {
        return null
      } else {
        while (true) {
          if ((to === null || Y.utils.smaller(o.val.id, to)) && o.right !== null) {
            // o is included in the bound
            // try to find an element that is closer to the bound
            o = o.right
          } else if (to !== null && Y.utils.smaller(to, o.val.id)) {
            // o is not within the bound, maybe one of the left elements is..
            if (o.left !== null) {
              o = o.left
            } else {
              // there is no left element. Search for the prev smaller element,
              // this should be within the bounds
              return o.prev()
            }
          } else {
            return o
          }
        }
      }
    }
    findSmallestNode () {
      var o = this.root
      while (o != null && o.left != null) {
        o = o.left
      }
      return o
    }
    * findWithLowerBound (from) {
      var n = this.findNodeWithLowerBound(from)
      return n == null ? null : n.val
    }
    * findWithUpperBound (to) {
      var n = this.findNodeWithUpperBound(to)
      return n == null ? null : n.val
    }
    * iterate (t, from, to, f) {
      var o
      if (from === null) {
        o = this.findSmallestNode()
      } else {
        o = this.findNodeWithLowerBound(from)
      }
      while (o !== null && (to === null || Y.utils.smaller(o.val.id, to) || Y.utils.compareIds(o.val.id, to))) {
        yield* f.call(t, o.val)
        o = o.next()
      }
      return true
    }
    * logTable (from, to, filter) {
      if (filter == null) {
        filter = function () {
          return true
        }
      }
      if (from == null) { from = null }
      if (to == null) { to = null }
      var os = []
      yield* this.iterate(this, from, to, function * (o) {
        if (filter(o)) {
          var o_ = {}
          for (var key in o) {
            if (typeof o[key] === 'object') {
              o_[key] = JSON.stringify(o[key])
            } else {
              o_[key] = o[key]
            }
          }
          os.push(o_)
        }
      })
      if (console.table != null) {
        console.table(os)
      }
    }
    * find (id) {
      var n
      return (n = this.findNode(id)) ? n.val : null
    }
    findNode (id) {
      if (id == null || id.constructor !== Array) {
        throw new Error('Expect id to be an array!')
      }
      var o = this.root
      if (o === null) {
        return false
      } else {
        while (true) {
          if (o === null) {
            return false
          }
          if (Y.utils.smaller(id, o.val.id)) {
            o = o.left
          } else if (Y.utils.smaller(o.val.id, id)) {
            o = o.right
          } else {
            return o
          }
        }
      }
    }
    * delete (id) {
      if (id == null || id.constructor !== Array) {
        throw new Error('id is expected to be an Array!')
      }
      var d = this.findNode(id)
      if (d == null) {
        // throw new Error('Element does not exist!')
        return
      }
      this.length--
      if (d.left !== null && d.right !== null) {
        // switch d with the greates element in the left subtree.
        // o should have at most one child.
        var o = d.left
        // find
        while (o.right !== null) {
          o = o.right
        }
        // switch
        d.val = o.val
        d = o
      }
      // d has at most one child
      // let n be the node that replaces d
      var isFakeChild
      var child = d.left || d.right
      if (child === null) {
        isFakeChild = true
        child = new N({id: 0})
        child.blacken()
        d.right = child
      } else {
        isFakeChild = false
      }

      if (d.parent === null) {
        if (!isFakeChild) {
          this.root = child
          child.blacken()
          child._parent = null
        } else {
          this.root = null
        }
        return
      } else if (d.parent.left === d) {
        d.parent.left = child
      } else if (d.parent.right === d) {
        d.parent.right = child
      } else {
        throw new Error('Impossible!')
      }
      if (d.isBlack()) {
        if (child.isRed()) {
          child.blacken()
        } else {
          this._fixDelete(child)
        }
      }
      this.root.blacken()
      if (isFakeChild) {
        if (child.parent.left === child) {
          child.parent.left = null
        } else if (child.parent.right === child) {
          child.parent.right = null
        } else {
          throw new Error('Impossible #3')
        }
      }
    }
    _fixDelete (n) {
      function isBlack (node) {
        return node !== null ? node.isBlack() : true
      }
      function isRed (node) {
        return node !== null ? node.isRed() : false
      }
      if (n.parent === null) {
        // this can only be called after the first iteration of fixDelete.
        return
      }
      // d was already replaced by the child
      // d is not the root
      // d and child are black
      var sibling = n.sibling
      if (isRed(sibling)) {
        // make sibling the grandfather
        n.parent.redden()
        sibling.blacken()
        if (n === n.parent.left) {
          n.parent.rotateLeft(this)
        } else if (n === n.parent.right) {
          n.parent.rotateRight(this)
        } else {
          throw new Error('Impossible #2')
        }
        sibling = n.sibling
      }
      // parent, sibling, and children of n are black
      if (n.parent.isBlack() &&
        sibling.isBlack() &&
        isBlack(sibling.left) &&
        isBlack(sibling.right)
      ) {
        sibling.redden()
        this._fixDelete(n.parent)
      } else if (n.parent.isRed() &&
        sibling.isBlack() &&
        isBlack(sibling.left) &&
        isBlack(sibling.right)
      ) {
        sibling.redden()
        n.parent.blacken()
      } else {
        if (n === n.parent.left &&
          sibling.isBlack() &&
          isRed(sibling.left) &&
          isBlack(sibling.right)
        ) {
          sibling.redden()
          sibling.left.blacken()
          sibling.rotateRight(this)
          sibling = n.sibling
        } else if (n === n.parent.right &&
          sibling.isBlack() &&
          isRed(sibling.right) &&
          isBlack(sibling.left)
        ) {
          sibling.redden()
          sibling.right.blacken()
          sibling.rotateLeft(this)
          sibling = n.sibling
        }
        sibling.color = n.parent.color
        n.parent.blacken()
        if (n === n.parent.left) {
          sibling.right.blacken()
          n.parent.rotateLeft(this)
        } else {
          sibling.left.blacken()
          n.parent.rotateRight(this)
        }
      }
    }
    * put (v) {
      if (v == null || v.id == null || v.id.constructor !== Array) {
        throw new Error('v is expected to have an id property which is an Array!')
      }
      var node = new N(v)
      if (this.root !== null) {
        var p = this.root // p abbrev. parent
        while (true) {
          if (Y.utils.smaller(node.val.id, p.val.id)) {
            if (p.left === null) {
              p.left = node
              break
            } else {
              p = p.left
            }
          } else if (Y.utils.smaller(p.val.id, node.val.id)) {
            if (p.right === null) {
              p.right = node
              break
            } else {
              p = p.right
            }
          } else {
            p.val = node.val
            return p
          }
        }
        this._fixInsert(node)
      } else {
        this.root = node
      }
      this.length++
      this.root.blacken()
      return node
    }
    _fixInsert (n) {
      if (n.parent === null) {
        n.blacken()
        return
      } else if (n.parent.isBlack()) {
        return
      }
      var uncle = n.getUncle()
      if (uncle !== null && uncle.isRed()) {
        // Note: parent: red, uncle: red
        n.parent.blacken()
        uncle.blacken()
        n.grandparent.redden()
        this._fixInsert(n.grandparent)
      } else {
        // Note: parent: red, uncle: black or null
        // Now we transform the tree in such a way that
        // either of these holds:
        //   1) grandparent.left.isRed
        //     and grandparent.left.left.isRed
        //   2) grandparent.right.isRed
        //     and grandparent.right.right.isRed
        if (n === n.parent.right && n.parent === n.grandparent.left) {
          n.parent.rotateLeft(this)
          // Since we rotated and want to use the previous
          // cases, we need to set n in such a way that
          // n.parent.isRed again
          n = n.left
        } else if (n === n.parent.left && n.parent === n.grandparent.right) {
          n.parent.rotateRight(this)
          // see above
          n = n.right
        }
        // Case 1) or 2) hold from here on.
        // Now traverse grandparent, make parent a black node
        // on the highest level which holds two red nodes.
        n.parent.blacken()
        n.grandparent.redden()
        if (n === n.parent.left) {
          // Case 1
          n.grandparent.rotateRight(this)
        } else {
          // Case 2
          n.grandparent.rotateLeft(this)
        }
      }
    }
    * flush () {}
  }

  Y.utils.RBTree = RBTree
}

},{}],9:[function(require,module,exports){
/**
 * y-text2 - Text Type for Yjs
 * @version v1.6.0
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.yText=e()}(this,function(){"use strict";function t(t,n,r){if(t==n)return t?[[d,t]]:[];(r<0||t.length<r)&&(r=null);var s=i(t,n),a=t.substring(0,s);t=t.substring(s),n=n.substring(s),s=o(t,n);var c=t.substring(t.length-s);t=t.substring(0,t.length-s),n=n.substring(0,n.length-s);var f=e(t,n);return a&&f.unshift([d,a]),c&&f.push([d,c]),l(f),null!=r&&(f=u(f,r)),f}function e(e,r){var i;if(!e)return[[g,r]];if(!r)return[[h,e]];var o=e.length>r.length?e:r,l=e.length>r.length?r:e,a=o.indexOf(l);if(-1!=a)return i=[[g,o.substring(0,a)],[d,l],[g,o.substring(a+l.length)]],e.length>r.length&&(i[0][0]=i[2][0]=h),i;if(1==l.length)return[[h,e],[g,r]];var u=s(e,r);if(u){var c=u[0],f=u[1],v=u[2],p=u[3],b=u[4],y=t(c,v),m=t(f,p);return y.concat([[d,b]],m)}return n(e,r)}function n(t,e){for(var n=t.length,i=e.length,o=Math.ceil((n+i)/2),s=o,l=2*o,a=new Array(l),u=new Array(l),c=0;c<l;c++)a[c]=-1,u[c]=-1;a[s+1]=0,u[s+1]=0;for(var f=n-i,d=f%2!=0,v=0,p=0,b=0,y=0,m=0;m<o;m++){for(var x=-m+v;x<=m-p;x+=2){var _,w=s+x;_=x==-m||x!=m&&a[w-1]<a[w+1]?a[w+1]:a[w-1]+1;for(var M=_-x;_<n&&M<i&&t.charAt(_)==e.charAt(M);)_++,M++;if(a[w]=_,_>n)p+=2;else if(M>i)v+=2;else if(d){var k=s+f-x;if(k>=0&&k<l&&-1!=u[k]){var C=n-u[k];if(_>=C)return r(t,e,_,M)}}}for(var O=-m+b;O<=m-y;O+=2){var C,k=s+O;C=O==-m||O!=m&&u[k-1]<u[k+1]?u[k+1]:u[k-1]+1;for(var A=C-O;C<n&&A<i&&t.charAt(n-C-1)==e.charAt(i-A-1);)C++,A++;if(u[k]=C,C>n)y+=2;else if(A>i)b+=2;else if(!d){var w=s+f-O;if(w>=0&&w<l&&-1!=a[w]){var _=a[w],M=s+_-w;if(C=n-C,_>=C)return r(t,e,_,M)}}}}return[[h,t],[g,e]]}function r(e,n,r,i){var o=e.substring(0,r),s=n.substring(0,i),l=e.substring(r),a=n.substring(i),u=t(o,s),c=t(l,a);return u.concat(c)}function i(t,e){if(!t||!e||t.charAt(0)!=e.charAt(0))return 0;for(var n=0,r=Math.min(t.length,e.length),i=r,o=0;n<i;)t.substring(o,i)==e.substring(o,i)?(n=i,o=n):r=i,i=Math.floor((r-n)/2+n);return i}function o(t,e){if(!t||!e||t.charAt(t.length-1)!=e.charAt(e.length-1))return 0;for(var n=0,r=Math.min(t.length,e.length),i=r,o=0;n<i;)t.substring(t.length-i,t.length-o)==e.substring(e.length-i,e.length-o)?(n=i,o=n):r=i,i=Math.floor((r-n)/2+n);return i}function s(t,e){function n(t,e,n){for(var r,s,l,a,u=t.substring(n,n+Math.floor(t.length/4)),c=-1,f="";-1!=(c=e.indexOf(u,c+1));){var h=i(t.substring(n),e.substring(c)),g=o(t.substring(0,n),e.substring(0,c));f.length<g+h&&(f=e.substring(c-g,c)+e.substring(c,c+h),r=t.substring(0,n-g),s=t.substring(n+h),l=e.substring(0,c-g),a=e.substring(c+h))}return 2*f.length>=t.length?[r,s,l,a,f]:null}var r=t.length>e.length?t:e,s=t.length>e.length?e:t;if(r.length<4||2*s.length<r.length)return null;var l,a=n(r,s,Math.ceil(r.length/4)),u=n(r,s,Math.ceil(r.length/2));if(!a&&!u)return null;l=u?a&&a[4].length>u[4].length?a:u:a;var c,f,h,g;return t.length>e.length?(c=l[0],f=l[1],h=l[2],g=l[3]):(h=l[0],g=l[1],c=l[2],f=l[3]),[c,f,h,g,l[4]]}function l(t){t.push([d,""]);for(var e,n=0,r=0,s=0,a="",u="";n<t.length;)switch(t[n][0]){case g:s++,u+=t[n][1],n++;break;case h:r++,a+=t[n][1],n++;break;case d:r+s>1?(0!==r&&0!==s&&(e=i(u,a),0!==e&&(n-r-s>0&&t[n-r-s-1][0]==d?t[n-r-s-1][1]+=u.substring(0,e):(t.splice(0,0,[d,u.substring(0,e)]),n++),u=u.substring(e),a=a.substring(e)),0!==(e=o(u,a))&&(t[n][1]=u.substring(u.length-e)+t[n][1],u=u.substring(0,u.length-e),a=a.substring(0,a.length-e))),0===r?t.splice(n-s,r+s,[g,u]):0===s?t.splice(n-r,r+s,[h,a]):t.splice(n-r-s,r+s,[h,a],[g,u]),n=n-r-s+(r?1:0)+(s?1:0)+1):0!==n&&t[n-1][0]==d?(t[n-1][1]+=t[n][1],t.splice(n,1)):n++,s=0,r=0,a="",u=""}""===t[t.length-1][1]&&t.pop();var c=!1;for(n=1;n<t.length-1;)t[n-1][0]==d&&t[n+1][0]==d&&(t[n][1].substring(t[n][1].length-t[n-1][1].length)==t[n-1][1]?(t[n][1]=t[n-1][1]+t[n][1].substring(0,t[n][1].length-t[n-1][1].length),t[n+1][1]=t[n-1][1]+t[n+1][1],t.splice(n-1,1),c=!0):t[n][1].substring(0,t[n+1][1].length)==t[n+1][1]&&(t[n-1][1]+=t[n+1][1],t[n][1]=t[n][1].substring(t[n+1][1].length)+t[n+1][1],t.splice(n+1,1),c=!0)),n++;c&&l(t)}function a(t,e){if(0===e)return[d,t];for(var n=0,r=0;r<t.length;r++){var i=t[r];if(i[0]===h||i[0]===d){var o=n+i[1].length;if(e===o)return[r+1,t];if(e<o){t=t.slice();var s=e-n,l=[i[0],i[1].slice(0,s)],a=[i[0],i[1].slice(s)];return t.splice(r,1,l,a),[r+1,t]}n=o}}throw new Error("cursor_pos is out of bounds!")}function u(t,e){var n=a(t,e),r=n[1],i=n[0],o=r[i],s=r[i+1];if(null==o)return t;if(o[0]!==d)return t;if(null!=s&&o[1]+s[1]===s[1]+o[1])return r.splice(i,2,s,o),c(r,i,2);if(null!=s&&0===s[1].indexOf(o[1])){r.splice(i,2,[s[0],o[1]],[0,o[1]]);var l=s[1].slice(o[1].length);return l.length>0&&r.splice(i+2,0,[s[0],l]),c(r,i,3)}return t}function c(t,e,n){for(var r=e+n-1;r>=0&&r>=e-1;r--)if(r+1<t.length){var i=t[r],o=t[r+1];i[0]===o[1]&&t.splice(r,2,[i[0],i[1]+o[1]])}return t}function f(t){t.requestModules(["Array"]).then(function(){var e=function(t){function e(t,n,r,i){b(this,e);var o=_(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n,r));return o.textfields=[],o.aceInstances=[],o.codeMirrorInstances=[],o.monacoInstances=[],null!=i&&"_"!==n[0]&&"string"==typeof i&&o.insert(0,i),o}return x(e,t),y(e,[{key:"toString",value:function(){return this._content.map(function(t){return t.val}).join("")}},{key:"toJSON",value:function(){return this.toString()}},{key:"insert",value:function(t,n){for(var r=n.split(""),i=0;i<r.length;i++)/[\uD800-\uDFFF]/.test(r[i])&&(r[i]=r[i]+r[i+1],r[i+1]="",i++);m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"insert",this).call(this,t,r)}},{key:"delete",value:function(t,n){if(null==n&&(n=1),"number"!=typeof n)throw new Error("length must be a number!");if("number"!=typeof t)throw new Error("pos must be a number!");if(t+n>this._content.length||t<0||n<0)throw new Error("The deletion range exceeds the range of the array!");if(0!==n)if(this._content.length>t+n&&""===this._content[t+n].val&&2===this._content[t+n-1].val.length){var r=this._content[t+n-1].val[0];m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"delete",this).call(this,t,n+1),m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"insert",this).call(this,t,[r])}else if(t>0&&""===this._content[t].val&&2===this._content[t-1].val.length){var i=this._content[t-1].val[1];m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"delete",this).call(this,t-1,n+1),m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"insert",this).call(this,t-1,[i])}else m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"delete",this).call(this,t,n)}},{key:"unbindAll",value:function(){this.unbindTextareaAll(),this.unbindAceAll(),this.unbindCodeMirrorAll(),this.unbindMonacoAll()}},{key:"unbindMonaco",value:function(t){var e=this.monacoInstances.findIndex(function(e){return e.editor===t});if(e>=0){var n=this.monacoInstances[e];this.unobserve(n.yCallback),n.disposeBinding(),this.monacoInstances.splice(e,1)}}},{key:"unbindMonacoAll",value:function(){for(var t=this.monacoInstances.length-1;t>=0;t--)this.unbindMonaco(this.monacoInstances[t].editor)}},{key:"bindMonaco",value:function(t,e){function n(t){if(s){s=!1;try{t()}catch(t){throw s=!0,new Error(t)}s=!0}}function r(t){n(function(){for(var e=0,n=1;n<t.range.startLineNumber;e++)"\n"===o._content[e].val&&n++;var r=e+t.range.startColumn-1;t.rangeLength>0&&o.delete(r,t.rangeLength),o.insert(r,t.text)})}function i(e){n(function(){var n,r,i=t.model.getPositionAt(e.index);"insert"===e.type?(n=i,r=e.values.join("")):"delete"===e.type&&(n=t.model.modifyPosition(i,e.length),r="");var o={startLineNumber:i.lineNumber,startColumn:i.column,endLineNumber:n.lineNumber,endColumn:n.column},s={major:w.major,minor:w.minor++};t.executeEdits("Yjs",[{id:s,range:o,text:r,forceMoveMarkers:!0}])})}var o=this;e=e||{};var s=!0;t.setValue(this.toString());var l=t.onDidChangeModelContent(r).dispose;this.observe(i),this.monacoInstances.push({editor:t,yCallback:i,monacoCallback:r,disposeBinding:l})}},{key:"unbindCodeMirror",value:function(t){var e=this.codeMirrorInstances.findIndex(function(e){return e.editor===t});if(e>=0){var n=this.codeMirrorInstances[e];this.unobserve(n.yCallback),n.editor.off("changes",n.codeMirrorCallback),this.codeMirrorInstances.splice(e,1)}}},{key:"unbindCodeMirrorAll",value:function(){for(var t=this.codeMirrorInstances.length-1;t>=0;t--)this.unbindCodeMirror(this.codeMirrorInstances[t].editor)}},{key:"bindCodeMirror",value:function(t,e){function n(t){if(s){s=!1;try{t()}catch(t){throw s=!0,new Error(t)}s=!0}}function r(e,r){n(function(){for(var e=0;e<r.length;e++){var n=r[e],i=t.indexFromPos(n.from);if(n.removed.length>0){for(var s=0,l=0;l<n.removed.length;l++)s+=n.removed[l].length;s+=n.removed.length-1,o.delete(i,s)}o.insert(i,n.text.join("\n"))}})}function i(e){n(function(){var n=t.posFromIndex(e.index);if("insert"===e.type){var r=n;t.replaceRange(e.values.join(""),n,r)}else if("delete"===e.type){var i=t.posFromIndex(e.index+e.length);t.replaceRange("",n,i)}})}var o=this;e=e||{};var s=!0;t.setValue(this.toString()),t.on("changes",r),this.observe(i),this.codeMirrorInstances.push({editor:t,yCallback:i,codeMirrorCallback:r})}},{key:"unbindAce",value:function(t){var e=this.aceInstances.findIndex(function(e){return e.editor===t});if(e>=0){var n=this.aceInstances[e];this.unobserve(n.yCallback),n.editor.off("change",n.aceCallback),this.aceInstances.splice(e,1)}}},{key:"unbindAceAll",value:function(){for(var t=this.aceInstances.length-1;t>=0;t--)this.unbindAce(this.aceInstances[t].editor)}},{key:"bindAce",value:function(t,e){function n(t){if(s){s=!1;try{t()}catch(t){throw s=!0,new Error(t)}s=!0}}function r(e){n(function(){var n,r,i=t.getSession().getDocument();"insert"===e.action?(n=i.positionToIndex(e.start,0),o.insert(n,e.lines.join("\n"))):"remove"===e.action&&(n=i.positionToIndex(e.start,0),r=e.lines.join("\n").length,o.delete(n,r))})}function i(e){var r=t.getSession().getDocument();n(function(){if("insert"===e.type){var t=r.indexToPosition(e.index,0);r.insert(t,e.values.join(""))}else if("delete"===e.type){var n=r.indexToPosition(e.index,0),i=r.indexToPosition(e.index+e.length,0),o=new u(n.row,n.column,i.row,i.column);r.remove(o)}})}var o=this;e=e||{};var s=!0;t.setValue(this.toString()),t.on("change",r),t.selection.clearSelection();var l;l="undefined"!=typeof ace&&null==e.aceClass?ace:e.aceClass;var a=e.aceRequire||l.require,u=a("ace/range").Range;this.observe(i),this.aceInstances.push({editor:t,yCallback:i,aceCallback:r})}},{key:"bind",value:function(){var t=arguments[0];t instanceof Element?this.bindTextarea.apply(this,arguments):null!=t&&null!=t.session&&null!=t.getSession&&null!=t.setValue?this.bindAce.apply(this,arguments):null!=t&&null!=t.posFromIndex&&null!=t.replaceRange?this.bindCodeMirror.apply(this,arguments):null!=t&&null!=t.onDidChangeModelContent?this.bindMonaco.apply(this,arguments):console.error("Cannot bind, unsupported editor!")}},{key:"unbindTextarea",value:function(t){var e=this.textfields.findIndex(function(e){return e.editor===t});if(e>=0){var n=this.textfields[e];this.unobserve(n.yCallback);n.editor.removeEventListener("input",n.eventListener),this.textfields.splice(e,1)}}},{key:"unbindTextareaAll",value:function(){for(var t=this.textfields.length-1;t>=0;t--)this.unbindTextarea(this.textfields[t].editor)}},{key:"bindTextarea",value:function(t,e){function n(t){if(o){o=!1;try{t()}catch(t){throw o=!0,new Error(t)}o=!0}}function r(t){n(function(){var e,n;if("insert"===t.type){e=t.index,n=function(t){return t<=e?t:t+=1};var r=l(n);a(r)}else"delete"===t.type&&(e=t.index,n=function(t){return t<e?t:t-=1},r=l(n),a(r))})}e=e||window,null==e.getSelection&&(e=window);for(var i=0;i<this.textfields.length;i++)if(this.textfields[i].editor===t)return;var o=!0,s=this;t.value=this.toString();var l,a,u,c;null!=t.selectionStart&&null!=t.setSelectionRange?(l=function(e){var n=t.selectionStart,r=t.selectionEnd;return null!=e&&(n=e(n),r=e(r)),{left:n,right:r}},a=function(e){u(s.toString()),t.setSelectionRange(e.left,e.right)},u=function(e){t.value=e},c=function(){return t.value}):(l=function(n){var r={},i=e.getSelection(),o=t.textContent.length;r.left=Math.min(i.anchorOffset,o),r.right=Math.min(i.focusOffset,o),null!=n&&(r.left=n(r.left),r.right=n(r.right));var s=i.focusNode;return s===t||s===t.childNodes[0]?r.isReal=!0:r.isReal=!1,r},a=function(n){u(s.toString());var r=t.childNodes[0];if(n.isReal&&null!=r){n.left<0&&(n.left=0),n.right=Math.max(n.left,n.right),n.right>r.length&&(n.right=r.length),n.left=Math.min(n.left,n.right);var i=document.createRange();i.setStart(r,n.left),i.setEnd(r,n.right);var o=e.getSelection();o.removeAllRanges(),o.addRange(i)}},u=function(e){t.innerText=e},c=function(){return t.innerText}),u(this.toString()),this.observe(r);var f=function(){n(function(){for(var t=l(function(t){return t}),e=s.toString(),n=c(),r=p(e,n,t.left),i=0,o=0;o<r.length;o++){var a=r[o];0===a[0]?i+=a[1].length:-1===a[0]?s.delete(i,a[1].length):(s.insert(i,a[1]),i+=a[1].length)}})};t.addEventListener("input",f),this.textfields.push({editor:t,yCallback:r,eventListener:f})}},{key:"_destroy",value:function(){this.unbindAll(),this.textfields=null,this.aceInstances=null,m(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_destroy",this).call(this)}}]),e}(t.Array.typeDefinition.class);t.extend("Text",new t.utils.CustomTypeDefinition({name:"Text",class:e,struct:"List",parseArguments:function(t){return"string"==typeof t?[this,t]:[this,null]},initType:function(n,r){var i=[];return t.Struct.List.map.call(this,r,function(t){if(t.hasOwnProperty("opContent"))throw new Error("Text must not contain types!");t.content.forEach(function(e,n){i.push({id:[t.id[0],t.id[1]+n],val:t.content[n]})})}),new e(n,r.id,i)},createType:function(t,n,r){return new e(t,n.id,[],r)}}))})}var h=-1,g=1,d=0,v=t;v.INSERT=g,v.DELETE=h,v.EQUAL=d;var p=v,b=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},y=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),m=function t(e,n,r){null===e&&(e=Function.prototype);var i=Object.getOwnPropertyDescriptor(e,n);if(void 0===i){var o=Object.getPrototypeOf(e);return null===o?void 0:t(o,n,r)}if("value"in i)return i.value;var s=i.get;if(void 0!==s)return s.call(r)},x=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},_=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e},w={major:0,minor:0};return"undefined"!=typeof Y&&f(Y),f});


},{}],10:[function(require,module,exports){
function extend (Y) {

var USE_AUDIO = true;
var USE_VIDEO = true;
var DEFAULT_CHANNEL = 'some-global-channel-name';
var MUTE_AUDIO_BY_DEFAULT = false;
var signaling_server_url = 'http://finwin.io:1256';

var ICE_SERVERS = [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "turn:try.refactored.ai:3478", username: "test99", credential: "test"}
];


var dcs = {};
var signaling_socket = null;   /* our socket.io connection to our webserver */
var local_media_stream = null; /* our own microphone / webcam */
var peers = {};                /* keep track of our peer connections, indexed by peer_id (aka socket.io id) */
var peer_media_elements = {};  /* keep track of our <video>/<audio> tags, indexed by peer_id */
var is_first = 'unknown';

function init(ywebrtc) {
    signaling_socket = io.connect(signaling_server_url);

    signaling_socket.on('connect', function() {
        join_chat_channel(DEFAULT_CHANNEL, {'whatever-you-want-here': 'stuff'});
    });

    signaling_socket.on('sockets', function (sockets) {
        if (sockets === 0) {
            is_first = true;
        }
        else {
            is_first = false;
        }
    });

    signaling_socket.on('disconnect', function() {
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
        signaling_socket.emit('join', {"channel": channel, "userdata": userdata});
        ywebrtc.setUserId(signaling_socket.id);
        function load_notebook2(file_name) {
            if (typeof Jupyter !== 'undefined'){
                if (Jupyter.notebook) {
                    if (file_name === 'Untitled.ipynb') {
                        Jupyter.notebook.load_notebook(file_name);
                    } else {
                        Jupyter.notebook.load_notebook2(file_name);
                    }
                }
                else {
                    setTimeout(load_notebook2, 500, file_name);
                }
            }
            else {
                setTimeout(load_notebook2, 500, file_name);
            }
        }
        function initialize_data() {
            if (is_first === true) {
                load_notebook2('Untitled.ipynb');
            } else if (is_first === false) {
                load_notebook2('template.ipynb');
            } else {
                setTimeout(initialize_data, 500);
            }
        }
        initialize_data();
    }
    function part_chat_channel(channel) {
        signaling_socket.emit('part', channel);
    }


    signaling_socket.on('addPeer', function(config) {
        var peer_id = config.peer_id;

        ywebrtc.userJoined(peer_id, 'master');

        if (peer_id in peers) {
            /* This could happen if the user joins multiple channels where the other peer is also in. */
            return;
        }

        var peer_connection = new RTCPeerConnection({"iceServers": ICE_SERVERS});
        peers[peer_id] = peer_connection;
        var dataChannel = peer_connection.createDataChannel('data');
        dcs[peer_id] = dataChannel;
        dataChannel.onmessage = function(e) {
            console.log(e);
            ywebrtc.receiveMessage(peer_id, JSON.parse(e.data));
        };

        peer_connection.onicecandidate = function(event) {
            if (event.candidate) {
                signaling_socket.emit('relayICECandidate', {
                    'peer_id': peer_id, 
                    'ice_candidate': {
                        'sdpMLineIndex': event.candidate.sdpMLineIndex,
                        'candidate': event.candidate.candidate
                    }
                });
            }
        }

        if (config.should_create_offer) {
            peer_connection.createOffer(
                function (local_description) { 
                    peer_connection.setLocalDescription(local_description,
                        function() { 
                            signaling_socket.emit('relaySessionDescription', 
                                {'peer_id': peer_id, 'session_description': local_description});
                        },
                        function() { Alert("Offer setLocalDescription failed!"); }
                    );
                },
                function (error) {
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
    signaling_socket.on('sessionDescription', function(config) {
        var peer_id = config.peer_id;
        var peer = peers[peer_id];

        peer.ondatachannel = function (event) {
            var dataChannel = event.channel;
            dataChannel.onmessage = function(e) {
                console.log(e);
                ywebrtc.receiveMessage(peer_id, JSON.parse(e.data));
            };
        };

        var remote_description = config.session_description;

        var desc = new RTCSessionDescription(remote_description);
        var stuff = peer.setRemoteDescription(desc, 
            function() {
                if (remote_description.type == "offer") {
                    peer.createAnswer(
                        function(local_description) {
                            peer.setLocalDescription(local_description,
                                function() { 
                                    signaling_socket.emit('relaySessionDescription', 
                                        {'peer_id': peer_id, 'session_description': local_description});
                                },
                                function() { Alert("Answer setLocalDescription failed!"); }
                            );
                        },
                        function(error) {
                            console.log("Error creating answer: ", error);
                        });
                }
            },
            function(error) {
                console.log("setRemoteDescription error: ", error);
            }
        );

    });

    signaling_socket.on('iceCandidate', function(config) {
        var peer = peers[config.peer_id];
        var ice_candidate = config.ice_candidate;
        peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
    });


    signaling_socket.on('removePeer', function(config) {
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


  class WebRTC extends Y.AbstractConnector {
    constructor (y, options) {
      if (options === undefined) {
        throw new Error('Options must not be undefined!')
      }
      if (options.room == null) {
        throw new Error('You must define a room name!')
      }
      options.role = 'slave'
      super(y, options)
      this.webrtcOptions = {
        url: options.url,
        room: options.room
      }
      var ywebrtc = this;
      init(ywebrtc);
      var swr = signaling_socket;
      this.swr = swr;
    }
    disconnect () {
      console.log('implement disconnect of channel');
      super.disconnect()
    }
    reconnect () {
      console.log('implement reconnect of channel');
      super.reconnect()
    }
    send (uid, message) {
        var self = this
        var send = function () {
            var dc = dcs[uid];
            if (dc.readyState === 'open') {
                dc.send(JSON.stringify(message));
            }
            else {
                setTimeout(send, 500)
            }
        }
        // try to send the message
        send()
    }
    broadcast (message) {
        for (var peer_id in dcs) {
            var dc = dcs[peer_id];
            if (dc.readyState === 'open') {
                dc.send(JSON.stringify(message));
            }
            else {
                console.log('Errrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', peer_id);
            }
        }
    }
    isDisconnected () {
      return false
    }
  }
  Y.extend('webrtc', WebRTC)
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}],11:[function(require,module,exports){
/**
 * y-xml2 - Xml Type for Yjs
 * @version v1.5.0
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.yXml=e()}(this,function(){"use strict";function t(t,n,r){if(t==n)return t?[[x,t]]:[];(r<0||t.length<r)&&(r=null);var l=o(t,n),u=t.substring(0,l);t=t.substring(l),n=n.substring(l),l=i(t,n);var c=t.substring(t.length-l);t=t.substring(0,t.length-l),n=n.substring(0,n.length-l);var h=e(t,n);return u&&h.unshift([x,u]),c&&h.push([x,c]),s(h),null!=r&&(h=a(h,r)),h}function e(e,r){var o;if(!e)return[[D,r]];if(!r)return[[O,e]];var i=e.length>r.length?e:r,s=e.length>r.length?r:e,u=i.indexOf(s);if(-1!=u)return o=[[D,i.substring(0,u)],[x,s],[D,i.substring(u+s.length)]],e.length>r.length&&(o[0][0]=o[2][0]=O),o;if(1==s.length)return[[O,e],[D,r]];var a=l(e,r);if(a){var c=a[0],h=a[1],d=a[2],f=a[3],p=a[4],m=t(c,d),v=t(h,f);return m.concat([[x,p]],v)}return n(e,r)}function n(t,e){for(var n=t.length,o=e.length,i=Math.ceil((n+o)/2),l=i,s=2*i,u=new Array(s),a=new Array(s),c=0;c<s;c++)u[c]=-1,a[c]=-1;u[l+1]=0,a[l+1]=0;for(var h=n-o,d=h%2!=0,f=0,p=0,m=0,v=0,y=0;y<i;y++){for(var _=-y+f;_<=y-p;_+=2){var g,b=l+_;g=_==-y||_!=y&&u[b-1]<u[b+1]?u[b+1]:u[b-1]+1;for(var E=g-_;g<n&&E<o&&t.charAt(g)==e.charAt(E);)g++,E++;if(u[b]=g,g>n)p+=2;else if(E>o)f+=2;else if(d){var x=l+h-_;if(x>=0&&x<s&&-1!=a[x]){var w=n-a[x];if(g>=w)return r(t,e,g,E)}}}for(var k=-y+m;k<=y-v;k+=2){var w,x=l+k;w=k==-y||k!=y&&a[x-1]<a[x+1]?a[x+1]:a[x-1]+1;for(var T=w-k;w<n&&T<o&&t.charAt(n-w-1)==e.charAt(o-T-1);)w++,T++;if(a[x]=w,w>n)v+=2;else if(T>o)m+=2;else if(!d){var b=l+h-k;if(b>=0&&b<s&&-1!=u[b]){var g=u[b],E=l+g-b;if(w=n-w,g>=w)return r(t,e,g,E)}}}}return[[O,t],[D,e]]}function r(e,n,r,o){var i=e.substring(0,r),l=n.substring(0,o),s=e.substring(r),u=n.substring(o),a=t(i,l),c=t(s,u);return a.concat(c)}function o(t,e){if(!t||!e||t.charAt(0)!=e.charAt(0))return 0;for(var n=0,r=Math.min(t.length,e.length),o=r,i=0;n<o;)t.substring(i,o)==e.substring(i,o)?(n=o,i=n):r=o,o=Math.floor((r-n)/2+n);return o}function i(t,e){if(!t||!e||t.charAt(t.length-1)!=e.charAt(e.length-1))return 0;for(var n=0,r=Math.min(t.length,e.length),o=r,i=0;n<o;)t.substring(t.length-o,t.length-i)==e.substring(e.length-o,e.length-i)?(n=o,i=n):r=o,o=Math.floor((r-n)/2+n);return o}function l(t,e){function n(t,e,n){for(var r,l,s,u,a=t.substring(n,n+Math.floor(t.length/4)),c=-1,h="";-1!=(c=e.indexOf(a,c+1));){var d=o(t.substring(n),e.substring(c)),f=i(t.substring(0,n),e.substring(0,c));h.length<f+d&&(h=e.substring(c-f,c)+e.substring(c,c+d),r=t.substring(0,n-f),l=t.substring(n+d),s=e.substring(0,c-f),u=e.substring(c+d))}return 2*h.length>=t.length?[r,l,s,u,h]:null}var r=t.length>e.length?t:e,l=t.length>e.length?e:t;if(r.length<4||2*l.length<r.length)return null;var s,u=n(r,l,Math.ceil(r.length/4)),a=n(r,l,Math.ceil(r.length/2));if(!u&&!a)return null;s=a?u&&u[4].length>a[4].length?u:a:u;var c,h,d,f;return t.length>e.length?(c=s[0],h=s[1],d=s[2],f=s[3]):(d=s[0],f=s[1],c=s[2],h=s[3]),[c,h,d,f,s[4]]}function s(t){t.push([x,""]);for(var e,n=0,r=0,l=0,u="",a="";n<t.length;)switch(t[n][0]){case D:l++,a+=t[n][1],n++;break;case O:r++,u+=t[n][1],n++;break;case x:r+l>1?(0!==r&&0!==l&&(e=o(a,u),0!==e&&(n-r-l>0&&t[n-r-l-1][0]==x?t[n-r-l-1][1]+=a.substring(0,e):(t.splice(0,0,[x,a.substring(0,e)]),n++),a=a.substring(e),u=u.substring(e)),0!==(e=i(a,u))&&(t[n][1]=a.substring(a.length-e)+t[n][1],a=a.substring(0,a.length-e),u=u.substring(0,u.length-e))),0===r?t.splice(n-l,r+l,[D,a]):0===l?t.splice(n-r,r+l,[O,u]):t.splice(n-r-l,r+l,[O,u],[D,a]),n=n-r-l+(r?1:0)+(l?1:0)+1):0!==n&&t[n-1][0]==x?(t[n-1][1]+=t[n][1],t.splice(n,1)):n++,l=0,r=0,u="",a=""}""===t[t.length-1][1]&&t.pop();var c=!1;for(n=1;n<t.length-1;)t[n-1][0]==x&&t[n+1][0]==x&&(t[n][1].substring(t[n][1].length-t[n-1][1].length)==t[n-1][1]?(t[n][1]=t[n-1][1]+t[n][1].substring(0,t[n][1].length-t[n-1][1].length),t[n+1][1]=t[n-1][1]+t[n+1][1],t.splice(n-1,1),c=!0):t[n][1].substring(0,t[n+1][1].length)==t[n+1][1]&&(t[n-1][1]+=t[n+1][1],t[n][1]=t[n][1].substring(t[n+1][1].length)+t[n+1][1],t.splice(n+1,1),c=!0)),n++;c&&s(t)}function u(t,e){if(0===e)return[x,t];for(var n=0,r=0;r<t.length;r++){var o=t[r];if(o[0]===O||o[0]===x){var i=n+o[1].length;if(e===i)return[r+1,t];if(e<i){t=t.slice();var l=e-n,s=[o[0],o[1].slice(0,l)],u=[o[0],o[1].slice(l)];return t.splice(r,1,s,u),[r+1,t]}n=i}}throw new Error("cursor_pos is out of bounds!")}function a(t,e){var n=u(t,e),r=n[1],o=n[0],i=r[o],l=r[o+1];if(null==i)return t;if(i[0]!==x)return t;if(null!=l&&i[1]+l[1]===l[1]+i[1])return r.splice(o,2,l,i),c(r,o,2);if(null!=l&&0===l[1].indexOf(i[1])){r.splice(o,2,[l[0],i[1]],[0,i[1]]);var s=l[1].slice(i[1].length);return s.length>0&&r.splice(o+2,0,[l[0],s]),c(r,o,3)}return t}function c(t,e,n){for(var r=e+n-1;r>=0&&r>=e-1;r--)if(r+1<t.length){var o=t[r],i=t[r+1];o[0]===i[1]&&t.splice(r,2,[o[0],o[1]+i[1]])}return t}function h(t){t.observe(function(e){null!=t.dom&&t._mutualExclude(function(){var n=d(t._scrollElement);if("attributeChanged"===e.type)t.dom.setAttribute(e.name,e.value);else if("attributeRemoved"===e.type)t.dom.removeAttribute(e.name);else if("childInserted"===e.type||"insert"===e.type)for(var r=e.values,o=r.length-1;o>=0;o--){var i=r[o];i.setDomFilter(t._domFilter),i.enableSmartScrolling(t._scrollElement);var l=i.getDom(),s=null,u=null;t._content.length>e.index+o+1&&(u=t.get(e.index+o+1).getDom()),t.dom.insertBefore(l,u),null===n||(null!==n.anchor?l.contains(n.anchor)||n.anchor.contains(l)||(s=n):f(l).top<=0&&(s=n)),p(t._scrollElement,s)}else if("childRemoved"===e.type||"delete"===e.type)for(var a=e.values.length-1;a>=0;a--){var c=e.values[a].dom,h=null;null===n||(null!==n.anchor?c.contains(n.anchor)||n.anchor.contains(c)||(h=n):f(c).top<=0&&(h=n)),c.remove(),p(t._scrollElement,h)}})})}function d(t){if(null==t)return null;var e=document.getSelection().anchorNode;if(null!=e){var n=f(e).top;if(n>=0&&n<=document.documentElement.clientHeight)return{anchor:e,top:n}}return{anchor:null,scrollTop:t.scrollTop,scrollHeight:t.scrollHeight}}function f(t){if(null!=t.getBoundingClientRect)return t.getBoundingClientRect();if(null==t.parentNode){document.createElement("span").appendChild(t)}var e=document.createRange();return e.selectNode(t),e.getBoundingClientRect()}function p(t,e){null!==t&&null!==e&&(null===e.anchor?t.scrollTop===e.scrollTop&&(t.scrollTop+=t.scrollHeight-e.scrollHeight):t.scrollTop+=f(e.anchor).top-e.top)}function m(t,e){return e}function v(t){for(var e=new Set(Array.prototype.map.call(t.dom.childNodes,function(t){return t.__yxml}).filter(function(t){return void 0!==t})),n=t._content.length-1;n>=0;n--){var r=t.get(n);e.has(r)||t.delete(n,1)}for(var o=t.dom.childNodes,i=o.length,l=0,s=0;l<i;l++){(function(e,n){var r=o[e];if(null!=r.__yxml){if(!1===r.__yxml)return"continue";if(n<t.length){if(t.get(n)!==r.__yxml){var i=t._content.findIndex(function(t){return t.type[0]===r.__yxml._model[0]&&t.type[1]===r.__yxml._model[1]});i<0?r.__yxml=null:t.delete(i,1),n+=t.insertDomElements(n,[r])}else n++}else n+=t.insertDomElements(n,[r])}else n+=t.insertDomElements(n,[r]);s=n})(l,s)}}function y(t,e){return t.index<=e?"delete"===t.type?e-Math.min(e-t.index,t.length):e+1:e}function _(t,e,n){t.requestModules(["Array"]).then(function(){var r=function(t){function r(t,e,n,o){T(this,r);var i=S(this,(r.__proto__||Object.getPrototypeOf(r)).call(this,t,e,n));null!=o&&null!=o.content&&"_"!==e[0]&&i.insert(0,o.content),i.dom=null,i._domObserver=null,i._domObserverListener=null,i._scrollElement=null,null!=o&&null!=o.dom&&i._setDom(o.dom);var l=!0;return i._mutualExcluse=function(t){if(l){l=!1;try{t()}catch(t){console.error(t)}i._domObserver.takeRecords(),l=!0}},i.observe(function(t){null!=i.dom&&i._mutualExcluse(function(){var e=null,n=!1,r=null,o=null,l=null,s=null;"undefined"!=typeof getSelection&&(e=getSelection(),e.anchorNode===i.dom&&(r=e.anchorNode,o=y(t,e.anchorOffset),n=!0),e.focusNode===i.dom&&(l=e.focusNode,s=y(t,e.focusOffset),n=!0));var u=d(i._scrollElement),a=void 0;a=null!==u&&(null!==u.anchor||f(i.dom).top<=0)?u:null,i.dom.nodeValue=i.toString(),p(i._scrollElement,a),n&&e.setBaseAndExtent(r||e.anchorNode,o||e.anchorOffset,l||e.focusNode,s||e.focusOffset)})}),i}return L(r,t),A(r,[{key:"setDomFilter",value:function(){}},{key:"enableSmartScrolling",value:function(t){this._scrollElement=t}},{key:"_setDom",value:function(t){var e=this;null!=this.dom&&this._unbindFromDom(),null!=t.__yxml&&t.__yxml._unbindFromDom(),null!=n&&(this.dom=t,t.__yxml=this,this._domObserverListener=function(){e._mutualExcluse(function(){for(var t=k(e.toString(),e.dom.nodeValue),n=0,r=0;r<t.length;r++){var o=t[r];0===o[0]?n+=o[1].length:-1===o[0]?e.delete(n,o[1].length):(e.insert(n,o[1]),n+=o[1].length)}})},this._domObserver=new n(this._domObserverListener),this._domObserver.observe(this.dom,{characterData:!0}))}},{key:"getDom",value:function(){if(null==this.dom){var t=e.createTextNode(this.toString());return null!==n&&this._setDom(t),t}return this.dom}},{key:"toString",value:function(){return this._content.map(function(t){return t.val}).join("")}},{key:"insert",value:function(t,e){C(r.prototype.__proto__||Object.getPrototypeOf(r.prototype),"insert",this).call(this,t,e.split(""))}},{key:"_changed",value:function(t,e){null!=this._domObserver&&this._domObserverListener(this._domObserver.takeRecords()),C(r.prototype.__proto__||Object.getPrototypeOf(r.prototype),"_changed",this).call(this,t,e)}},{key:"_unbindFromDom",value:function(){null!=this._domObserver&&(this._domObserver.disconnect(),this._domObserver=null),null!=this.dom&&(this.dom.__yxml=null,this.dom=null)}},{key:"_destroy",value:function(){null!=this._eventListenerHandler&&this._eventListenerHandler.destroy(),this._unbindFromDom(),C(r.prototype.__proto__||Object.getPrototypeOf(r.prototype),"_destroy",this).call(this)}}]),r}(t.Array.typeDefinition.class);t.extend("XmlText",new t.utils.CustomTypeDefinition({name:"XmlText",class:r,struct:"List",parseArguments:function(t){return"string"==typeof t?[this,{content:t}]:t.nodeType===e.TEXT_NODE?[this,{content:t.nodeValue,dom:t}]:[this,{}]},initType:function(e,n,o){var i=[];return t.Struct.List.map.call(this,n,function(t){if(t.hasOwnProperty("opContent"))throw new Error("Text must not contain types!");t.content.forEach(function(e,n){i.push({id:[t.id[0],t.id[1]+n],val:t.content[n]})})}),new r(e,n.id,i,{},o||{})},createType:function(t,e,n){return new r(t,e.id,[],n||{})}}))})}function g(t,e,n){t.requestModules(["Array"]).then(function(){var e=function(e){function r(t,e,n,o){T(this,r);var i=S(this,(r.__proto__||Object.getPrototypeOf(r)).call(this,t,e,n));i.dom=null,i._domObserver=null,i._domObserverListener=null,i._domFilter=m,i._scrollElement=null;var l=!0;return i._mutualExclude=function(t){if(l){l=!1;try{t()}catch(t){console.error(t)}i._domObserver.takeRecords(),l=!0}},h(i),i}return L(r,e),A(r,[{key:"setDomFilter",value:function(){return t.XmlElement.typeDefinition.class.prototype.setDomFilter.apply(this,arguments)}},{key:"enableSmartScrolling",value:function(){return t.XmlElement.typeDefinition.class.prototype.enableSmartScrolling.apply(this,arguments)}},{key:"insertDomElements",value:function(){return t.XmlElement.typeDefinition.class.prototype.insertDomElements.apply(this,arguments)}},{key:"bindToDom",value:function(t){var e=this;if(null!=this.dom&&this._unbindFromDom(),null!=t.__yxml&&t.__yxml._unbindFromDom(),null==n)throw new Error("Not able to bind to a DOM element, because MutationObserver is not available!");t.innerHTML="";for(var r=0;r<this._content.length;r++)t.insertBefore(this.get(r).getDom(),null);this.dom=t,t.__yxml=this,this._domObserverListener=function(){e._mutualExclude(function(){return v(e)})},this._domObserver=new n(this._domObserverListener),this._domObserver.takeRecords(),this._domObserver.observe(this.dom,{childList:!0})}},{key:"toString",value:function(){var t=this;return this._content.map(function(e){return t.os.getType(e.type).toString()}).join("")}},{key:"_changed",value:function(t,e){null!=this._domObserver&&this._domObserverListener(this._domObserver.takeRecords()),C(r.prototype.__proto__||Object.getPrototypeOf(r.prototype),"_changed",this).call(this,t,e)}},{key:"_unbindFromDom",value:function(){null!=this._domObserver&&(this._domObserver.disconnect(),this._domObserver=null),null!=this.dom&&(this.dom.__yxml=null,this.dom=null)}},{key:"_destroy",value:function(){null!=this._eventListenerHandler&&this._eventListenerHandler.destroy(),this._unbindFromDom(),C(r.prototype.__proto__||Object.getPrototypeOf(r.prototype),"_destroy",this).call(this)}}]),r}(t.Array.typeDefinition.class);t.extend("XmlFragment",new t.utils.CustomTypeDefinition({name:"XmlFragment",class:e,struct:"List",initType:function(n,r){var o=[],i=[];t.Struct.List.map.call(this,r,function(t){t.hasOwnProperty("opContent")?(o.push({id:t.id,type:t.opContent}),i.push(t.opContent)):t.content.forEach(function(e,n){o.push({id:[t.id[0],t.id[1]+n],val:t.content[n]})})});for(var l=0;l<i.length;l++){this.store.initType.call(this,i[l])._parent=r.id}return new e(n,r.id,o)},createType:function(t,n){return new e(t,n.id,[])}}))})}function b(t,e,n){function r(e){var n=this;if("Insert"===e.struct){if(this._content.some(function(n){return t.utils.compareIds(n.id,e.id)}))return;var r=void 0;if(null===e.left)r=0;else if((r=1+this._content.findIndex(function(n){return t.utils.compareIds(n.id,e.left)}))<=0)throw new Error("Unexpected operation!");var o,i;if(e.hasOwnProperty("opContent")){this._content.splice(r,0,{id:e.id,type:e.opContent}),i=1;var l=this.os.getType(e.opContent);l._parent=this._model,o=[l]}else{var s=e.content.map(function(t,n){return{id:[e.id[0],e.id[1]+n],val:t}});s.length<3e4?this._content.splice.apply(this._content,[r,0].concat(s)):this._content=this._content.slice(0,r).concat(s).concat(this._content.slice(r)),o=e.content,i=e.content.length}t.utils.bubbleEvent(this,{type:"insert",object:this,index:r,values:o,length:i})}else{if("Delete"!==e.struct)throw new Error("Unexpected struct!");for(var u=0;u<this._content.length&&e.length>0;u++){var a=this._content[u];if(t.utils.inDeletionRange(e,a.id)){var c;for(c=1;c<e.length&&u+c<this._content.length&&t.utils.inDeletionRange(e,this._content[u+c].id);c++);a=this._content[u+c-1],e.length-=a.id[1]-e.target[1]+1,e.target=[a.id[0],a.id[1]+1];var h=this._content.splice(u,c),d=h.map(function(t){return null!=t.val?t.val:n.os.getType(t.type)});t.utils.bubbleEvent(this,{type:"delete",object:this,index:u,values:d,_content:h,length:c})}}}}function o(e){var n,r="Delete"===e.struct?e.key:e.parentSub;if(n=null!=this.opContents[r]?this.os.getType(this.opContents[r]):this.contents[r],"Insert"===e.struct){if(null===e.left&&!t.utils.compareIds(e.id,this.map[r])){var o;null!=e.opContent?(o=this.os.getType(e.opContent),o._parent=this._model,delete this.contents[r],e.deleted?delete this.opContents[r]:this.opContents[r]=e.opContent):(o=e.content[0],delete this.opContents[r],e.deleted?delete this.contents[r]:this.contents[r]=e.content[0]),this.map[r]=e.id,void 0===n?t.utils.bubbleEvent(this,{name:r,object:this,type:"add",value:o}):t.utils.bubbleEvent(this,{name:r,object:this,oldValue:n,type:"update",value:o})}}else{if("Delete"!==e.struct)throw new Error("Unexpected Operation!");t.utils.compareIds(this.map[r],e.target)&&(delete this.opContents[r],delete this.contents[r],t.utils.bubbleEvent(this,{name:r,object:this,oldValue:n,type:"delete"}))}}var i=function(i){function l(e,n,i,s,u,a,c){T(this,l);var d=S(this,(l.__proto__||Object.getPrototypeOf(l)).call(this));d._os=e,d.os=e,d._model=n.id,d._parent=null,d.map=t.utils.copyObject(n.map),d.contents=s,d.opContents=u,d._content=i,d.nodeName=n.nodeName;var f=o.bind(d),p=r.bind(d),m=new t.utils.EventHandler(function(t){void 0!==t.parentSub||void 0!==t.key?f(t):p(t)});d.eventHandler=m,d._deepEventHandler=new t.utils.EventListenerHandler,d._eventListenerHandler=m,d._domObserver=null,d._scrollElement=null,d.dom=null,d._domFilter=c,null!=a&&d._setDom(a);var v=!0;return d._mutualExclude=function(t){if(v){v=!1;try{t()}catch(t){console.error(t)}d._domObserver.takeRecords(),v=!0}},h(d),d}return L(l,i),A(l,[{key:"enableSmartScrolling",value:function(t){this._scrollElement=t;for(var e=this._content.length,n=0;n<e;n++)this.get(n).enableSmartScrolling(t)}},{key:"setDomFilter",value:function(t){this._domFilter=t;for(var e=this._content.length,n=0;n<e;n++)this.get(n).setDomFilter(t)}},{key:"toString",value:function(){var t=this,e=this.nodeName.toLowerCase(),n=this._content.map(function(e){return t.os.getType(e.type).toString()}).join("");return 0===n.length?"<"+e+"/>":"<"+e+">"+n+"</"+e+">"}},{key:"_getPathToChild",value:function(e){return this._content.findIndex(function(n){return null!=n.type&&t.utils.compareIds(n.type,e)})}},{key:"_unbindFromDom",value:function(){null!=this._domObserver&&(this._domObserver.disconnect(),this._domObserver=null),null!=this.dom&&(this.dom.__yxml=null,this.dom=null)}},{key:"_destroy",value:function(){this._unbindFromDom(),null!=this._eventListenerHandler&&(this._eventListenerHandler.destroy(),this._eventListenerHandler=null),this.nodeName=null,this._content=null,this.contents=null,this.opContents=null,this.map=null}},{key:"insertDomElements",value:function(n,r){var o=this,i=[];r.forEach(function(n){if(null!=n.__yxml&&!1!==n.__yxml&&n.__yxml._unbindFromDom(),null!==o._domFilter(n,[])){var r=void 0;if(n.nodeType===e.TEXT_NODE)r=t.XmlText(n);else{if(n.nodeType!==e.ELEMENT_NODE)throw new Error("Unsupported node!");r=t.XmlElement(n,o._domFilter)}i.push(r)}else n.__yxml=!1}),this.insert(n,i);for(var l=i.length,s=n;s<n+l;s++){var u=this.get(s);u.setDomFilter(this._domFilter),u.enableSmartScrolling(this._scrollElement)}return l}},{key:"insert",value:function(e,n){if(!Array.isArray(n))throw new Error("Expected an Array of content!");for(var r=0;r<n.length;r++){var o=n[r],i=t.utils.isTypeDefinition(o);if(null==i||"XmlElement"!==i[0].name&&"XmlText"!==i[0].name)throw new Error("Expected Y.Xml type or String!")}t.Array.typeDefinition.class.prototype.insert.call(this,e,n)}},{key:"delete",value:function(){return t.Array.typeDefinition.class.prototype.delete.apply(this,arguments)}},{key:"get",value:function(){return t.Array.typeDefinition.class.prototype.get.apply(this,arguments)}},{key:"removeAttribute",value:function(){return t.Map.typeDefinition.class.prototype.delete.apply(this,arguments)}},{key:"setAttribute",value:function(){return t.Map.typeDefinition.class.prototype.set.apply(this,arguments)}},{key:"getAttribute",value:function(){return t.Map.typeDefinition.class.prototype.get.apply(this,arguments)}},{key:"getAttributes",value:function(){var e=this,n=t.Map.typeDefinition.class.prototype.keys.apply(this),r={};return n.forEach(function(n){var o=t.Map.typeDefinition.class.prototype.get.call(e,n);null!=o&&(r[n]=o)}),r}},{key:"_bindToDom",value:function(t){var e=this;return this._domObserverListener=function(t){e._mutualExclude(function(){var n=!1;t.forEach(function(t){if("attributes"===t.type){var r=t.attributeName;if(e._domFilter(e.dom,[r]).length>0){var o=t.target.getAttribute(r);e.getAttribute(r)!==o&&(null==o?e.removeAttribute(r):e.setAttribute(r,o))}}else"childList"===t.type&&(n=!0)}),n&&v(e)})},this._domObserver=new n(this._domObserverListener),this._domObserver.observe(t,{attributes:!0,childList:!0}),t}},{key:"_setDom",value:function(t){if(null!=this.dom)throw new Error("Only call this method if you know what you are doing ;)");if(null!=t.__yxml)throw new Error("Already bound to an YXml type");t.__yxml=this;for(var e=[],r=0;r<t.attributes.length;r++)e.push(t.attributes[r].name);e=this._domFilter(t,e);for(var o=0;o<e.length;o++){var i=e[o],l=t.getAttribute(i);this.setAttribute(i,l)}return this.insertDomElements(0,Array.prototype.slice.call(t.childNodes)),null!=n&&(this.dom=this._bindToDom(t)),t}},{key:"getDom",value:function(){var t=this.dom;if(null==t){t=e.createElement(this.nodeName),t.__yxml=this;var r=this.getAttributes();for(var o in r)t.setAttribute(o,r[o]);for(var i=0;i<this._content.length;i++){var l=this._content[i],s=this.os.getType(l.type);t.appendChild(s.getDom())}null!==n&&(this.dom=this._bindToDom(t))}return t}},{key:"observe",value:function(t){function e(e){if("insert"===e.type)t({type:"childInserted",index:e.index,values:e.values});else if("delete"===e.type)t(void 0!==e.index?{type:"childRemoved",index:e.index,values:e.values,_content:e._content}:{type:"attributeRemoved",name:e.name});else{if("update"!==e.type&&"add"!==e.type)throw new Error("Unexpected event");t({type:"attributeChanged",name:e.name,value:e.value})}}return this._eventListenerHandler.addEventListener(e),e}},{key:"unobserve",value:function(t){this._eventListenerHandler.removeEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_changed",value:function(e,n){null!=this._domObserver&&this._domObserverListener(this._domObserver.takeRecords()),void 0!==n.parentSub||void 0!==n.targetParent?t.Map.typeDefinition.class.prototype._changed.apply(this,arguments):t.Array.typeDefinition.class.prototype._changed.apply(this,arguments)}},{key:"length",get:function(){return this._content.length}}]),l}(t.utils.CustomType);t.extend("XmlElement",new t.utils.CustomTypeDefinition({name:"XmlElement",class:i,struct:"Xml",parseArguments:function(t,n){var r=void 0;if(r="function"==typeof n?n:m,"string"==typeof t)return[this,{nodeName:t.toUpperCase(),dom:null,domFilter:r}];if(t.nodeType===e.ELEMENT_NODE)return[this,{nodeName:t.nodeName,dom:t,domFilter:r}];throw new Error("Y.XmlElement requires an argument which is a string!")},initType:function(e,n,r){var o=[],l=[];t.Struct.Xml.map.call(this,n,function(t){t.hasOwnProperty("opContent")?(o.push({id:t.id,type:t.opContent}),l.push(t.opContent)):t.content.forEach(function(e,n){o.push({id:[t.id[0],t.id[1]+n],val:t.content[n]})})});for(var s=0;s<l.length;s++){this.store.initType.call(this,l[s],r)._parent=n.id}var u={},a={},c=n.map;for(var h in c){var d=this.getOperation(c[h]);d.deleted||(null!=d.opContent?(a[h]=d.opContent,this.store.initType.call(this,d.opContent)):u[h]=d.content[0])}return new i(e,n,o,u,a,null!=r?r.dom:null,null!=r?r.domFilter:m)},createType:function(t,e,n){return new i(t,e,[],{},{},n.dom,n.domFilter)}}))}function E(t,e,n){null==e&&"undefined"!=typeof document&&(e=document),n="undefined"!=typeof MutationObserver?MutationObserver:null,b(t,e,n),_(t,e,n),g(t,e,n)}var O=-1,D=1,x=0,w=t;w.INSERT=D,w.DELETE=O,w.EQUAL=x;var k=w,T=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},A=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),C=function t(e,n,r){null===e&&(e=Function.prototype);var o=Object.getOwnPropertyDescriptor(e,n);if(void 0===o){var i=Object.getPrototypeOf(e);return null===i?void 0:t(i,n,r)}if("value"in o)return o.value;var l=o.get;if(void 0!==l)return l.call(r)},L=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},S=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e};return"undefined"!=typeof Y&&E(Y),E});


},{}],12:[function(require,module,exports){
(function (process,Buffer){
/**
 * yjs2 - A framework for real-time p2p shared editing on any data
 * @version v1.3.0
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.Y=e()}(this,function(){"use strict";function t(t,e,n,r){if(null===e)t.root=n,n._parent=null;else if(e.left===r)e.left=n;else{if(e.right!==r)throw new Error("The elements are wrongly connected!");e.right=n}}function e(t,e){var n=e._id;if(void 0===n)e._integrate(t);else{if(t.ss.getState(n.user)>n.clock)return;!t.gcEnabled||e.constructor===xt||e._parent.constructor!==xt&&!1===e._parent._deleted?e._integrate(t):e._gc(t);var r=t._missingStructs.get(n.user);if(null!=r)for(var i=n.clock,o=i+e._length;i<o;i++){var a=r.get(i);void 0!==a&&(a.forEach(function(e){if(0===--e.missing){var n=e.decoder,r=n.pos,i=e.struct._fromBinary(t,n);n.pos=r,0===i.length&&t._readyToIntegrate.push(e.struct)}}),r.delete(i))}}}function n(t,e,n){for(var r=e.readUint32(),i=0;i<r;i++){var o=e.readVarUint(),a=F(o),s=new a,l=s._fromBinary(t,e),u="  "+s._logString();l.length>0&&(u+=" .. missing: "+l.map(p).join(", ")),n.push(u)}}function r(t,n){for(var r=n.readUint32(),i=0;i<r;i++){var o=n.readVarUint(),a=F(o),s=new a,l=n.pos,u=s._fromBinary(t,n);if(0===u.length)for(;null!=s;)e(t,s),s=t._readyToIntegrate.shift();else{var c=new Nt(n.uint8arr);c.pos=l;for(var h=new It(c,u,s),f=t._missingStructs,d=u.length-1;d>=0;d--){var _=u[d];f.has(_.user)||f.set(_.user,new Map);var v=f.get(_.user);v.has(_.clock)||v.set(_.clock,[]);(v=v.get(_.clock)).push(h)}}}}function i(t){for(var e=new Map,n=t.readUint32(),r=0;r<n;r++){var i=t.readVarUint(),o=t.readVarUint();e.set(i,o)}return e}function o(t,e){var n=e.pos,r=0;e.writeUint32(0);var i=!0,o=!1,a=void 0;try{for(var s,l=t.ss.state[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=Ut(s.value,2),c=u[0],h=u[1];e.writeVarUint(c),e.writeVarUint(h),r++}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}e.setUint32(n,r)}function a(t,e){var n=null,r=void 0,i=void 0,o=0,a=e.pos;e.writeUint32(0),t.ds.iterate(null,null,function(t){var a=t._id.user,s=t._id.clock,l=t.len,u=t.gc;n!==a&&(o++,null!==n&&e.setUint32(i,r),n=a,e.writeVarUint(a),i=e.pos,e.writeUint32(0),r=0),e.writeVarUint(s),e.writeVarUint(l),e.writeUint8(u?1:0),r++}),null!==n&&e.setUint32(i,r),e.setUint32(a,o)}function s(t,e){for(var n=e.readUint32(),r=0;r<n;r++)!function(n){for(var r=e.readVarUint(),i=[],o=e.readUint32(),a=0;a<o;a++){var s=e.readVarUint(),l=e.readVarUint(),u=1===e.readUint8();i.push([s,l,u])}if(o>0){var c=0,h=i[c],f=[];t.ds.iterate(new At(r,0),new At(r,Number.MAX_VALUE),function(t){for(;null!=h;){var e=0;if(t._id.clock+t.len<=h[0])break;h[0]<t._id.clock?(e=Math.min(t._id.clock-h[0],h[1]),f.push([r,h[0],e])):(e=t._id.clock+t.len-h[0],h[2]&&!t.gc&&f.push([r,h[0],Math.min(e,h[1])])),h[1]<=e?h=i[++c]:(h[0]=h[0]+e,h[1]=h[1]-e)}});for(var d=f.length-1;d>=0;d--){var _=f[d];g(t,_[0],_[1],_[2],!0)}for(;c<i.length;c++)h=i[c],g(t,r,h[0],h[1],!0)}}()}function l(t,e,n){var r=e.readVarString(),i=e.readVarUint();n.push('  - auth: "'+r+'"'),n.push("  - protocolVersion: "+i);for(var o=[],a=e.readUint32(),s=0;s<a;s++){var l=e.readVarUint(),u=e.readVarUint();o.push("("+l+":"+u+")")}n.push("  == SS: "+o.join(","))}function u(t,e){var n=new jt;n.writeVarString(t.y.room),n.writeVarString("sync step 1"),n.writeVarString(t.authInfo||""),n.writeVarUint(t.protocolVersion),o(t.y,n),t.send(e,n.createBuffer())}function c(t,e,n){var r=e.pos;e.writeUint32(0);var i=0,o=!0,a=!1,s=void 0;try{for(var l,u=t.ss.state.keys()[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=l.value,h=n.get(c)||0;if(c!==Yt){var f=new At(c,h),d=t.os.findPrev(f),_=null===d?null:d._id;if(null!==_&&_.user===c&&_.clock+d._length>h){d._clonePartial(h-_.clock)._toBinary(e),i++}t.os.iterate(f,new At(c,Number.MAX_VALUE),function(t){t._toBinary(e),i++})}}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}e.setUint32(r,i)}function h(t,e,n,r,o){var s=t.readVarUint();s!==n.connector.protocolVersion&&(console.warn("You tried to sync with a Yjs instance that has a different protocol version\n      (You: "+s+", Client: "+s+").\n      "),n.destroy()),e.writeVarString("sync step 2"),e.writeVarString(n.connector.authInfo||""),c(n,e,i(t)),a(n,e),n.connector.send(r.uid,e.createBuffer()),r.receivedSyncStep2=!0,"slave"===n.connector.role&&u(n.connector,o)}function f(t,e,r){r.push("     - auth: "+e.readVarString()),r.push("  == OS:"),n(t,e,r),r.push("  == DS:");for(var i=e.readUint32(),o=0;o<i;o++){var a=e.readVarUint();r.push("    User: "+a+": ");for(var s=e.readUint32(),l=0;l<s;l++){var u=e.readVarUint(),c=e.readVarUint(),h=1===e.readUint8();r.push("["+u+", "+c+", "+h+"]")}}}function d(t,e,n,i,o){r(n,t),s(n,t),n.connector._setSyncedWith(o)}function _(t){var e=Ut(t,2),r=e[0],i=e[1],o=new Nt(i);o.readVarString();var a=o.readVarString(),s=[];return s.push("\n === "+a+" ==="),"update"===a?n(r,o,s):"sync step 1"===a?l(r,o,s):"sync step 2"===a?f(r,o,s):s.push("-- Unknown message type - probably an encoding issue!!!"),s.join("\n")}function v(t){var e=new Nt(t);return e.readVarString(),e.readVarString()}function p(t){if(null!==t&&null!=t._id&&(t=t._id),null===t)return"()";if(t instanceof At)return"("+t.user+","+t.clock+")";if(t instanceof zt)return"("+t.name+","+t.type+")";if(t.constructor===Y)return"y";throw new Error("This is not a valid ID!")}function y(t,e,n){var r=null!==e._left?e._left._lastId:null,i=null!==e._origin?e._origin._lastId:null;return t+"(id:"+p(e._id)+",left:"+p(r)+",origin:"+p(i)+",right:"+p(e._right)+",parent:"+p(e._parent)+",parentSub:"+e._parentSub+(void 0!==n?" - "+n:"")+")"}function g(t,e,n,r,i){var o=null!==t.connector&&t.connector._forwardAppliedStructs,a=t.os.getItemCleanStart(new At(e,n));if(null!==a){a._deleted||(a._splitAt(t,r),a._delete(t,o,!0));var s=a._length;if(r-=s,n+=s,r>0)for(var l=t.os.findNode(new At(e,n));null!==l&&null!==l.val&&r>0&&l.val._id.equals(new At(e,n));){var u=l.val;u._deleted||(u._splitAt(t,r),u._delete(t,o,i));var c=u._length;r-=c,n+=c,l=l.next()}}}function m(t,e,n){if(e!==t&&!e._deleted&&!t._transaction.newTypes.has(e)){var r=t._transaction.changedTypes,i=r.get(e);void 0===i&&(i=new Set,r.set(e,i)),i.add(n)}}function k(t,e,n,r){var i=e._id;n._id=new At(i.user,i.clock+r),n._origin=e,n._left=e,n._right=e._right,null!==n._right&&(n._right._left=n),n._right_origin=e._right_origin,e._right=n,n._parent=e._parent,n._parentSub=e._parentSub,n._deleted=e._deleted;var o=new Set;o.add(e);for(var a=n._right;null!==a&&o.has(a._origin);)a._origin===e&&(a._origin=n),o.add(a),a=a._right;t.os.put(n),t._transaction.newTypes.has(e)?t._transaction.newTypes.add(n):t._transaction.deletedStructs.has(e)&&t._transaction.deletedStructs.add(n)}function b(t,e){var n=void 0;do{n=e._right,e._right=null,e._right_origin=null,e._origin=e._left,e._integrate(t),e=n}while(null!==n)}function w(t,e){for(;null!==e;)e._delete(t,!1,!0),e._gc(t),e=e._right}function S(t,e,n,r,i){t._origin=r,t._left=r,t._right=i,t._right_origin=i,t._parent=e,null!==n?t._integrate(n):null===r?e._start=t:r._right=t}function O(t,e,n,r,i){for(;null!==r&&i>0;){switch(r.constructor){case Ct:case ItemString:if(i<=(r._deleted?0:r._length-1))return r=r._splitAt(e._y,i),n=r._left,[n,r,t];!1===r._deleted&&(i-=r._length);break;case Mt:!1===r._deleted&&B(t,r)}n=r,r=r._right}return[n,r,t]}function E(t,e){return O(new Map,t,null,t._start,e)}function U(t,e,n,r,i){for(;null!==r&&(!0===r._deleted||r.constructor===Mt&&i.get(r.key)===r.value);)!1===r._deleted&&i.delete(r.key),n=r,r=r._right;var o=!0,a=!1,s=void 0;try{for(var l,u=i[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=Ut(l.value,2),h=c[0],f=c[1],d=new Mt;d.key=h,d.value=f,S(d,e,t,n,r),n=d}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}return[n,r]}function B(t,e){var n=e.value,r=e.key;null===n?t.delete(r):t.set(r,n)}function T(t,e,n,r){for(;;){if(null===e)break;if(!0===e._deleted);else{if(e.constructor!==Mt||(r[e.key]||null)!==e.value)break;B(n,e)}t=e,e=e._right}return[t,e]}function A(t,e,n,r,i,o){var a=new Map;for(var s in i){var l=i[s],u=o.get(s);if(u!==l){a.set(s,u||null);var c=new Mt;c.key=s,c.value=l,S(c,e,t,n,r),n=c}}return[n,r,a]}function D(t,e,n,r,i,o,a){var s=!0,l=!1,u=void 0;try{for(var c,h=o[Symbol.iterator]();!(s=(c=h.next()).done);s=!0){var f=Ut(c.value,1),d=f[0];void 0===a[d]&&(a[d]=null)}}catch(t){l=!0,u=t}finally{try{!s&&h.return&&h.return()}finally{if(l)throw u}}var _=T(r,i,o,a),v=Ut(_,2);r=v[0],i=v[1];var p=void 0,y=A(t,n,r,i,a,o),g=Ut(y,3);r=g[0],i=g[1],p=g[2];var m=void 0;return e.constructor===String?(m=new ItemString,m._content=e):(m=new Ct,m.embed=e),S(m,n,t,r,i),r=m,U(t,n,r,i,p)}function P(t,e,n,r,i,o,a){var s=T(r,i,o,a),l=Ut(s,2);r=l[0],i=l[1];var u=void 0,c=A(t,n,r,i,a,o),h=Ut(c,3);for(r=h[0],i=h[1],u=h[2];e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Mt:var f=a[i.key];void 0!==f&&(f===i.value?u.delete(i.key):u.set(i.key,i.value),i._delete(t)),B(o,i);break;case Ct:case ItemString:i._splitAt(t,e),e-=i._length}r=i,i=i._right}return U(t,n,r,i,u)}function N(t,e,n,r,i,o){for(;e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Mt:B(o,i);break;case Ct:case ItemString:i._splitAt(t,e),e-=i._length,i._delete(t)}r=i,i=i._right}return[r,i]}function x(t,e){for(e=e._parent;null!==e;){if(e===t)return!0;e=e._parent}return!1}function I(t,e){return e}function j(t,e){for(var n=new Map,r=t.attributes.length-1;r>=0;r--){var i=t.attributes[r];n.set(i.name,i.value)}return e(t.nodeName,n)}function V(t,e,n){if(x(e.type,n)){var r=n.nodeName,i=new Map;if(void 0!==n.getAttributes){var o=n.getAttributes();for(var a in o)i.set(a,o[a])}var s=e.filter(r,new Map(i));null===s?n._delete(t):i.forEach(function(t,e){!1===s.has(e)&&n.removeAttribute(e)})}}function L(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:document,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:I,i=arguments[4],o=void 0;switch(t.nodeType){case e.ELEMENT_NODE:var a=null,s=void 0;if(t.hasAttribute("data-yjs-hook")&&(a=t.getAttribute("data-yjs-hook"),void 0===(s=n[a])&&(console.error('Unknown hook "'+a+'". Deleting yjsHook dataset property.'),t.removeAttribute("data-yjs-hook"),a=null)),null===a){var l=j(t,r);null===l?o=!1:(o=new YXmlElement(t.nodeName),l.forEach(function(t,e){o.setAttribute(e,t)}),o.insert(0,W(t.childNodes,document,n,r,i)))}else o=new YXmlHook(a),s.fillType(t,o);break;case e.TEXT_NODE:o=new YXmlText,o.insert(0,t.nodeValue);break;default:throw new Error("Can't transform this node type to a YXml type!")}return R(i,t,o),o}function C(t){for(;null!==t&&t._deleted;)t=t._right;return t}function M(t,e,n){t.domToType.delete(e),t.typeToDom.delete(n)}function R(t,e,n){void 0!==t&&(t.domToType.set(e,n),t.typeToDom.set(n,e))}function H(t,e,n){if(void 0!==t){var r=t.domToType.get(e);void 0!==r&&(M(t,e,r),R(t,n,r))}}function J(t,e,n,r,i){var o=W(n,r,i.opts.hooks,i.filter,i);return t.insertAfter(e,o)}function W(t,e,n,r,i){var o=[],a=!0,s=!1,l=void 0;try{for(var u,c=t[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=L(h,e,n,r,i);!1!==f&&o.push(f)}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}return o}function z(t,e,n,r,i){var o=J(t,e,[n],r,i);return o.length>0?o[0]:e}function X(t,e,n){for(;e!==n;){var r=e;e=e.nextSibling,t.removeChild(r)}}function q(t,e){Jt.set(t,e),Wt.set(e,t)}function F(t){return Jt.get(t)}function $(t){return Wt.get(t)}function G(){if("undefined"!=typeof crypto&&null!=crypto.getRandomValue){var t=new Uint32Array(1);return crypto.getRandomValues(t),t[0]}if("undefined"!=typeof crypto&&null!=crypto.randomBytes){var e=crypto.randomBytes(4);return new Uint32Array(e.buffer)[0]}return Math.ceil(4294967295*Math.random())}function Z(){var t=!0;return function(e){if(t){t=!1;try{e()}catch(t){console.error(t)}t=!0}}}function Q(t,e){for(var n=t._start;null!==n;){if(!1===n._deleted){if(n._length>e)return[n._id.user,n._id.clock+e];e-=n._length}n=n._right}return["endof",t._id.user,t._id.clock||null,t._id.name||null,t._id.type||null]}function K(t,e){if("endof"===e[0]){var n=void 0;n=null===e[3]?new At(e[1],e[2]):new zt(e[3],e[4]);var r=t.os.get(n);return null===r||r.constructor===xt?null:{type:r,offset:r.length}}var i=0,o=t.os.findNodeWithUpperBound(new At(e[0],e[1])).val,a=o._parent;if(o.constructor===xt||a._deleted)return null;for(o._deleted||(i=e[1]-o._id.clock),o=o._left;null!==o;)o._deleted||(i+=o._length),o=o._left;return{type:a,offset:i}}function tt(t,e,n,r){if(null!==Zt&&r){var i=Zt.to,o=Zt.from,a=Zt.fromY,s=Zt.toY,l=!1,u=Gt.anchorNode,c=Gt.anchorOffset,h=Gt.focusNode,f=Gt.focusOffset;if(null!==o){var d=K(a,o);if(null!==d){var _=e.typeToDom.get(d.type),v=d.offset;_===u&&v===c||(u=_,c=v,l=!0)}}if(null!==i){var p=K(s,i);if(null!==p){var y=e.typeToDom.get(p.type),g=p.offset;y===h&&g===f||(h=y,f=g,l=!0)}}l&&Gt.setBaseAndExtent(u,c,h,f)}}function et(t){if(null!==t){var e=getSelection().anchorNode;if(null!=e){e.nodeType===document.TEXT_NODE&&(e=e.parentElement);return{elem:e,top:e.getBoundingClientRect().top}}for(var n=t.children,r=0;r<n.length;r++){var i=n[r],o=i.getBoundingClientRect();if(o.top>=0)return{elem:i,top:o.top}}}return null}function nt(t,e){if(null!==e){var n=e.elem,r=e.top,i=n.getBoundingClientRect().top,o=t.scrollTop+i-r;o>=0&&(t.scrollTop=o)}}function rt(t){var e=this;this._mutualExclude(function(){var n=et(e.scrollingElement);t.forEach(function(t){var n=t.target,r=e.typeToDom.get(n);if(void 0!==r&&!1!==r)if(n.constructor===YXmlText)r.nodeValue=n.toString();else if(void 0!==t.attributesChanged&&(t.attributesChanged.forEach(function(t){var e=n.getAttribute(t);void 0===e?r.removeAttribute(t):r.setAttribute(t,e)}),t.childListChanged&&n.constructor!==YXmlHook)){var i=r.firstChild;n.forEach(function(t){var n=e.typeToDom.get(t);switch(n){case void 0:var o=t.toDom(e.opts.document,e.opts.hooks,e);r.insertBefore(o,i);break;case!1:break;default:X(r,i,n),i=n.nextSibling}}),X(r,i,null)}}),nt(e.scrollingElement,n)})}function it(t,e){for(var n=0,r=0;n<t.length&&n<e.length&&t[n]===e[n];)n++;if(n!==t.length||n!==e.length)for(;r+n<t.length&&r+n<e.length&&t[t.length-r-1]===e[e.length-r-1];)r++;return{pos:n,remove:t.length-n-r,insert:e.slice(n,e.length-r)}}function ot(t,e,n,r){if(null!=n&&!1!==n&&n.constructor!==YXmlHook){for(var i=n._y,o=new Set,a=e.childNodes.length-1;a>=0;a--){var s=t.domToType.get(e.childNodes[a]);void 0!==s&&!1!==s&&o.add(s)}n.forEach(function(e){!1===o.has(e)&&(e._delete(i),M(t,t.typeToDom.get(e),e))});for(var l=e.childNodes,u=l.length,c=null,h=C(n._start),f=0;f<u;f++){var d=l[f],_=t.domToType.get(d);if(void 0!==_){if(!1===_)continue;null!==h?h!==_?(_._parent!==n?M(t,d,_):(M(t,d,_),_._delete(i)),c=z(n,c,d,r,t)):(c=h,h=C(h._right)):c=z(n,c,d,r,t)}else c=z(n,c,d,r,t)}}}function at(t,e){var n=this;this._mutualExclude(function(){n.type._y.transact(function(){var r=new Set;t.forEach(function(t){var e=t.target,i=n.domToType.get(e);if(void 0===i){var o=e,a=void 0;do{o=o.parentElement,a=n.domToType.get(o)}while(void 0===a&&null!==o);return void(!1!==a&&void 0!==a&&a.constructor!==YXmlHook&&r.add(o))}if(!1!==i&&i.constructor!==YXmlHook)switch(t.type){case"characterData":var s=it(i.toString(),e.nodeValue);i.delete(s.pos,s.remove),i.insert(s.pos,s.insert);break;case"attributes":if(i.constructor===YXmlFragment)break;var l=t.attributeName,u=e.getAttribute(l),c=new Map;c.set(l,u),i.constructor!==YXmlFragment&&n.filter(e.nodeName,c).size>0&&i.getAttribute(l)!==u&&(null==u?i.removeAttribute(l):i.setAttribute(l,u));break;case"childList":r.add(t.target)}});var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=s.value,c=n.domToType.get(u);ot(n,u,c,e)}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}})})}function st(t,e,n){var r=!1;return t.transact(function(){for(;!r&&n.length>0;){var i=n.pop();null!==i.fromState&&(t.os.getItemCleanStart(i.fromState),t.os.getItemCleanEnd(i.toState),t.os.iterate(i.fromState,i.toState,function(n){for(;n._deleted&&null!==n._redone;)n=n._redone;!1===n._deleted&&x(e,n)&&(r=!0,n._delete(t))}));var o=!0,a=!1,s=void 0;try{for(var l,u=i.deletedStructs[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=l.value;x(e,c)&&c._parent!==t&&(c._id.user!==t.userID||null===i.fromState||c._id.clock<i.fromState.clock||c._id.clock>i.toState.clock)&&(r=!0,c._redo(t))}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}}}),r}function lt(t,e){return e={exports:{}},t(e,e.exports),e.exports}function ut(t){if(t=String(t),!(t.length>100)){var e=/^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);if(e){var n=parseFloat(e[1]);switch((e[2]||"ms").toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return n*ae;case"days":case"day":case"d":return n*oe;case"hours":case"hour":case"hrs":case"hr":case"h":return n*ie;case"minutes":case"minute":case"mins":case"min":case"m":return n*re;case"seconds":case"second":case"secs":case"sec":case"s":return n*ne;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return n;default:return}}}}function ct(t){return t>=oe?Math.round(t/oe)+"d":t>=ie?Math.round(t/ie)+"h":t>=re?Math.round(t/re)+"m":t>=ne?Math.round(t/ne)+"s":t+"ms"}function ht(t){return ft(t,oe,"day")||ft(t,ie,"hour")||ft(t,re,"minute")||ft(t,ne,"second")||t+" ms"}function ft(t,e,n){if(!(t<e))return t<1.5*e?Math.floor(t/e)+" "+n:Math.ceil(t/e)+" "+n+"s"}function dt(t,e){t.transact(function(){r(t,e),s(t,e)})}function _t(t){var e=new jt;return c(t,e,new Map),a(t,e),e}function vt(){var t=new jt;return t.writeUint32(0),{len:0,buffer:t}}function pt(){var t=this;this._mutualExclude(function(){var e=t.target,n=t.type,r=Q(n,e.selectionStart),i=Q(n,e.selectionEnd);e.value=n.toString();var o=K(n._y,r),a=K(n._y,i);e.setSelectionRange(o,a)})}function yt(){var t=this;this._mutualExclude(function(){var e=it(t.type.toString(),t.target.value);t.type.delete(e.pos,e.remove),t.type.insert(e.pos,e.insert)})}function gt(t){var e=this.target;e.update("yjs"),this._mutualExclude(function(){e.updateContents(t.delta,"yjs"),e.update("yjs")})}function mt(t){var e=this;this._mutualExclude(function(){e.type.applyDelta(t.ops)})}var kt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},bt=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},wt=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),St=function t(e,n,r){null===e&&(e=Function.prototype);var i=Object.getOwnPropertyDescriptor(e,n);if(void 0===i){var o=Object.getPrototypeOf(e);return null===o?void 0:t(o,n,r)}if("value"in i)return i.value;var a=i.get;if(void 0!==a)return a.call(r)},Ot=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},Et=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e},Ut=function(){function t(t,e){var n=[],r=!0,i=!1,o=void 0;try{for(var a,s=t[Symbol.iterator]();!(r=(a=s.next()).done)&&(n.push(a.value),!e||n.length!==e);r=!0);}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}return n}return function(e,n){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,n);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),Bt=function(){function e(t){bt(this,e),this.val=t,this.color=!0,this._left=null,this._right=null,this._parent=null}return wt(e,[{key:"isRed",value:function(){return this.color}},{key:"isBlack",value:function(){return!this.color}},{key:"redden",value:function(){return this.color=!0,this}},{key:"blacken",value:function(){return this.color=!1,this}},{key:"rotateLeft",value:function(e){var n=this.parent,r=this.right,i=this.right.left;r.left=this,this.right=i,t(e,n,r,this)}},{key:"next",value:function(){if(null!==this.right){for(var t=this.right;null!==t.left;)t=t.left;return t}for(var e=this;null!==e.parent&&e!==e.parent.left;)e=e.parent;return e.parent}},{key:"prev",value:function(){if(null!==this.left){for(var t=this.left;null!==t.right;)t=t.right;return t}for(var e=this;null!==e.parent&&e!==e.parent.right;)e=e.parent;return e.parent}},{key:"rotateRight",value:function(e){var n=this.parent,r=this.left,i=this.left.right;r.right=this,this.left=i,t(e,n,r,this)}},{key:"getUncle",value:function(){return this.parent===this.parent.parent.left?this.parent.parent.right:this.parent.parent.left}},{key:"grandparent",get:function(){return this.parent.parent}},{key:"parent",get:function(){return this._parent}},{key:"sibling",get:function(){return this===this.parent.left?this.parent.right:this.parent.left}},{key:"left",get:function(){return this._left},set:function(t){null!==t&&(t._parent=this),this._left=t}},{key:"right",get:function(){return this._right},set:function(t){null!==t&&(t._parent=this),this._right=t}}]),e}(),Tt=function(){function t(){bt(this,t),this.root=null,this.length=0}return wt(t,[{key:"findNext",value:function(t){var e=t.clone();return e.clock+=1,this.findWithLowerBound(e)}},{key:"findPrev",value:function(t){var e=t.clone();return e.clock-=1,this.findWithUpperBound(e)}},{key:"findNodeWithLowerBound",value:function(t){var e=this.root;if(null===e)return null;for(;;)if(null===t||t.lessThan(e.val._id)&&null!==e.left)e=e.left;else{if(null===t||!e.val._id.lessThan(t))return e;if(null===e.right)return e.next();e=e.right}}},{key:"findNodeWithUpperBound",value:function(t){if(void 0===t)throw new Error("You must define from!");var e=this.root;if(null===e)return null;for(;;)if(null!==t&&!e.val._id.lessThan(t)||null===e.right){if(null===t||!t.lessThan(e.val._id))return e;if(null===e.left)return e.prev();e=e.left}else e=e.right}},{key:"findSmallestNode",value:function(){for(var t=this.root;null!=t&&null!=t.left;)t=t.left;return t}},{key:"findWithLowerBound",value:function(t){var e=this.findNodeWithLowerBound(t);return null==e?null:e.val}},{key:"findWithUpperBound",value:function(t){var e=this.findNodeWithUpperBound(t);return null==e?null:e.val}},{key:"iterate",value:function(t,e,n){var r;for(r=null===t?this.findSmallestNode():this.findNodeWithLowerBound(t);null!==r&&(null===e||r.val._id.lessThan(e)||r.val._id.equals(e));)n(r.val),r=r.next()}},{key:"find",value:function(t){var e=this.findNode(t);return null!==e?e.val:null}},{key:"findNode",value:function(t){var e=this.root;if(null===e)return null;for(;;){if(null===e)return null;if(t.lessThan(e.val._id))e=e.left;else{if(!e.val._id.lessThan(t))return e;e=e.right}}}},{key:"delete",value:function(t){var e=this.findNode(t);if(null!=e){if(this.length--,null!==e.left&&null!==e.right){for(var n=e.left;null!==n.right;)n=n.right;e.val=n.val,e=n}var r,i=e.left||e.right;if(null===i?(r=!0,i=new Bt(null),i.blacken(),e.right=i):r=!1,null===e.parent)return void(r?this.root=null:(this.root=i,i.blacken(),i._parent=null));if(e.parent.left===e)e.parent.left=i;else{if(e.parent.right!==e)throw new Error("Impossible!");e.parent.right=i}if(e.isBlack()&&(i.isRed()?i.blacken():this._fixDelete(i)),this.root.blacken(),r)if(i.parent.left===i)i.parent.left=null;else{if(i.parent.right!==i)throw new Error("Impossible #3");i.parent.right=null}}}},{key:"_fixDelete",value:function(t){function e(t){return null===t||t.isBlack()}function n(t){return null!==t&&t.isRed()}if(null!==t.parent){var r=t.sibling;if(n(r)){if(t.parent.redden(),r.blacken(),t===t.parent.left)t.parent.rotateLeft(this);else{if(t!==t.parent.right)throw new Error("Impossible #2");t.parent.rotateRight(this)}r=t.sibling}t.parent.isBlack()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),this._fixDelete(t.parent)):t.parent.isRed()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),t.parent.blacken()):(t===t.parent.left&&r.isBlack()&&n(r.left)&&e(r.right)?(r.redden(),r.left.blacken(),r.rotateRight(this),r=t.sibling):t===t.parent.right&&r.isBlack()&&n(r.right)&&e(r.left)&&(r.redden(),r.right.blacken(),r.rotateLeft(this),r=t.sibling),r.color=t.parent.color,t.parent.blacken(),t===t.parent.left?(r.right.blacken(),t.parent.rotateLeft(this)):(r.left.blacken(),t.parent.rotateRight(this)))}}},{key:"put",value:function(t){var e=new Bt(t);if(null!==this.root){for(var n=this.root;;)if(e.val._id.lessThan(n.val._id)){if(null===n.left){n.left=e;break}n=n.left}else{if(!n.val._id.lessThan(e.val._id))return n.val=e.val,n;if(null===n.right){n.right=e;break}n=n.right}this._fixInsert(e)}else this.root=e;return this.length++,this.root.blacken(),e}},{key:"_fixInsert",value:function(t){if(null===t.parent)return void t.blacken();if(!t.parent.isBlack()){var e=t.getUncle();null!==e&&e.isRed()?(t.parent.blacken(),e.blacken(),t.grandparent.redden(),this._fixInsert(t.grandparent)):(t===t.parent.right&&t.parent===t.grandparent.left?(t.parent.rotateLeft(this),t=t.left):t===t.parent.left&&t.parent===t.grandparent.right&&(t.parent.rotateRight(this),t=t.right),t.parent.blacken(),t.grandparent.redden(),t===t.parent.left?t.grandparent.rotateRight(this):t.grandparent.rotateLeft(this))}}}]),t}(),At=function(){function t(e,n){bt(this,t),this.user=e,this.clock=n}return wt(t,[{key:"clone",value:function(){return new t(this.user,this.clock)}},{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.clock===this.clock}},{key:"lessThan",value:function(e){return e.constructor===t&&(this.user<e.user||this.user===e.user&&this.clock<e.clock)}}]),t}(),Dt=function(){function t(e,n,r){bt(this,t),this._id=e,this.len=n,this.gc=r}return wt(t,[{key:"clone",value:function(){return new t(this._id,this.len,this.gc)}}]),t}(),Pt=function(t){function e(){return bt(this,e),Et(this,(e.__proto__||Object.getPrototypeOf(e)).apply(this,arguments))}return Ot(e,t),wt(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){t.push({user:e._id.user,clock:e._id.clock,len:e.len,gc:e.gc})}),console.table(t)}},{key:"isDeleted",value:function(t){var e=this.findWithUpperBound(t);return null!==e&&e._id.user===t.user&&t.clock<e._id.clock+e.len}},{key:"mark",value:function(t,e,n){if(0!==e){var r=this.findWithUpperBound(new At(t.user,t.clock-1));null!==r&&r._id.user===t.user&&r._id.clock<t.clock&&t.clock<r._id.clock+r.len&&(t.clock+e<r._id.clock+r.len&&this.put(new Dt(new At(t.user,t.clock+e),r._id.clock+r.len-t.clock-e,r.gc)),r.len=t.clock-r._id.clock);var i=new At(t.user,t.clock+e-1),o=this.findWithUpperBound(i);if(null!==o&&o._id.user===t.user&&o._id.clock<t.clock+e&&t.clock<=o._id.clock&&t.clock+e<o._id.clock+o.len){var a=t.clock+e-o._id.clock;o._id=new At(o._id.user,o._id.clock+a),o.len-=a}var s=[];this.iterate(t,i,function(t){s.push(t._id)});for(var l=s.length-1;l>=0;l--)this.delete(s[l]);var u=new Dt(t,e,n);null!==r&&r._id.user===t.user&&r._id.clock+r.len===t.clock&&r.gc===n&&(r.len+=e,u=r);var c=this.find(new At(t.user,t.clock+e));null!==c&&c._id.user===t.user&&t.clock+e===c._id.clock&&n===c.gc&&(u.len+=c.len,this.delete(c._id)),r!==u&&this.put(u)}}},{key:"markDeleted",value:function(t,e){this.mark(t,e,!1)}}]),e}(Tt),Nt=function(){function t(e){if(bt(this,t),e instanceof ArrayBuffer)this.uint8arr=new Uint8Array(e);else{if(!(e instanceof Uint8Array||"undefined"!=typeof Buffer&&e instanceof Buffer))throw new Error("Expected an ArrayBuffer or Uint8Array!");this.uint8arr=e}this.pos=0}return wt(t,[{key:"clone",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.pos,n=new t(this.uint8arr);return n.pos=e,n}},{key:"skip8",value:function(){this.pos++}},{key:"readUint8",value:function(){return this.uint8arr[this.pos++]}},{key:"readUint32",value:function(){var t=this.uint8arr[this.pos]+(this.uint8arr[this.pos+1]<<8)+(this.uint8arr[this.pos+2]<<16)+(this.uint8arr[this.pos+3]<<24);return this.pos+=4,t}},{key:"peekUint8",value:function(){return this.uint8arr[this.pos]}},{key:"readVarUint",value:function(){for(var t=0,e=0;;){var n=this.uint8arr[this.pos++];if(t|=(127&n)<<e,e+=7,n<128)return t>>>0;if(e>35)throw new Error("Integer out of range!")}}},{key:"readVarString",value:function(){for(var t=this.readVarUint(),e=new Array(t),n=0;n<t;n++)e[n]=this.uint8arr[this.pos++];var r=e.map(function(t){return String.fromCodePoint(t)}).join("");return decodeURIComponent(escape(r))}},{key:"peekVarString",value:function(){var t=this.pos,e=this.readVarString();return this.pos=t,e}},{key:"readID",value:function(){var t=this.readVarUint();if(t===Yt){var e=new zt(this.readVarString(),null);return e.type=this.readVarUint(),e}return new At(t,this.readVarUint())}},{key:"length",get:function(){return this.uint8arr.length}}]),t}(),xt=function(){function t(){bt(this,t),this._id=null,this._length=0}return wt(t,[{key:"_integrate",value:function(e){var n=this._id,r=e.ss.getState(n.user);n.clock===r&&e.ss.setState(n.user,n.clock+this._length),e.ds.mark(this._id,this._length,!0);var i=e.os.put(this),o=i.prev().val;null!==o&&o.constructor===t&&o._id.user===i.val._id.user&&o._id.clock+o._length===i.val._id.clock&&(o._length+=i.val._length,e.os.delete(i.val._id),i=o),i.val&&(i=i.val);var a=e.os.findNext(i._id);null!==a&&a.constructor===t&&a._id.user===i._id.user&&a._id.clock===i._id.clock+i._length&&(i._length+=a._length,e.os.delete(a._id)),n.user!==Yt&&(null===e.connector||!e.connector._forwardAppliedStructs&&n.user!==e.userID||e.connector.broadcastStruct(this),null!==e.persistence&&e.persistence.saveStruct(e,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._id),t.writeVarUint(this._length)}},{key:"_fromBinary",value:function(t,e){var n=e.readID();this._id=n,this._length=e.readVarUint();var r=[];return t.ss.getState(n.user)<n.clock&&r.push(new At(n.user,n.clock-1)),r}},{key:"_splitAt",value:function(){return this}},{key:"_clonePartial",value:function(e){var n=new t;return n._id=new At(this._id.user,this._id.clock+e),n._length=this._length-e,n}},{key:"_deleted",get:function(){return!0}}]),t}(),It=function t(e,n,r){bt(this,t),this.decoder=e,this.missing=n.length,this.struct=r},jt=function(){function t(){bt(this,t),this.data=[]}return wt(t,[{key:"createBuffer",value:function(){return Uint8Array.from(this.data).buffer}},{key:"writeUint8",value:function(t){this.data.push(255&t)}},{key:"setUint8",value:function(t,e){this.data[t]=255&e}},{key:"writeUint16",value:function(t){this.data.push(255&t,t>>>8&255)}},{key:"setUint16",value:function(t,e){this.data[t]=255&e,this.data[t+1]=e>>>8&255}},{key:"writeUint32",value:function(t){for(var e=0;e<4;e++)this.data.push(255&t),t>>>=8}},{key:"setUint32",value:function(t,e){for(var n=0;n<4;n++)this.data[t+n]=255&e,e>>>=8}},{key:"writeVarUint",value:function(t){for(;t>=128;)this.data.push(128|127&t),t>>>=7;this.data.push(127&t)}},{key:"writeVarString",value:function(t){var e=unescape(encodeURIComponent(t)),n=e.split("").map(function(t){return t.codePointAt()}),r=n.length;this.writeVarUint(r);for(var i=0;i<r;i++)this.data.push(n[i])}},{key:"writeID",value:function(t){var e=t.user;this.writeVarUint(e),e!==Yt?this.writeVarUint(t.clock):(this.writeVarString(t.name),this.writeVarUint(t.type))}},{key:"length",get:function(){return this.data.length}},{key:"pos",get:function(){return this.data.length}}]),t}(),Delete=function(){function Delete(){bt(this,Delete),this._target=null,this._length=null}return wt(Delete,[{key:"_fromBinary",value:function(t,e){var n=e.readID();return this._targetID=n,this._length=e.readVarUint(),null===t.os.getItem(n)?[n]:[]}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._targetID),t.writeVarUint(this._length)}},{
key:"_integrate",value:function(t){if(arguments.length>1&&void 0!==arguments[1]&&arguments[1])null!==t.connector&&t.connector.broadcastStruct(this);else{var e=this._targetID;g(t,e.user,e.clock,this._length,!1)}null!==t.persistence&&t.persistence.saveStruct(t,this)}},{key:"_logString",value:function(){return"Delete - target: "+p(this._targetID)+", len: "+this._length}}]),Delete}(),Vt=function t(e){bt(this,t),this.y=e,this.newTypes=new Set,this.changedTypes=new Map,this.deletedStructs=new Set,this.beforeState=new Map,this.changedParentTypes=new Map},Item=function(){function Item(){bt(this,Item),this._id=null,this._origin=null,this._left=null,this._right=null,this._right_origin=null,this._parent=null,this._parentSub=null,this._deleted=!1,this._redone=null}return wt(Item,[{key:"_copy",value:function(){return new this.constructor}},{key:"_redo",value:function(t){if(null!==this._redone)return this._redone;var e=this._copy(),n=this._left,r=this,i=this._parent;if(!0===i._deleted&&null===i._redone&&i._redo(t),null!==i._redone){for(i=i._redone;null!==n;){if(null!==n._redone&&n._redone._parent===i){n=n._redone;break}n=n._left}for(;null!==r;)null!==r._redone&&r._redone._parent===i&&(r=r._redone),r=r._right}return e._origin=n,e._left=n,e._right=r,e._right_origin=r,e._parent=i,e._parentSub=this._parentSub,e._integrate(t),this._redone=e,e}},{key:"_splitAt",value:function(t,e){return 0===e?this:this._right}},{key:"_delete",value:function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];if(!this._deleted){this._deleted=!0,t.ds.mark(this._id,this._length,!1);var n=new Delete;n._targetID=this._id,n._length=this._length,e?n._integrate(t,!0):null!==t.persistence&&t.persistence.saveStruct(t,n),m(t,this._parent,this._parentSub),t._transaction.deletedStructs.add(this)}}},{key:"_gcChildren",value:function(t){}},{key:"_gc",value:function(t){var e=new xt;e._id=this._id,e._length=this._length,t.os.delete(this._id),e._integrate(t)}},{key:"_beforeChange",value:function(){}},{key:"_integrate",value:function(t){t._transaction.newTypes.add(this);var e=this._parent,n=this._id,r=null===n?t.userID:n.user,i=t.ss.getState(r);if(null===n)this._id=t.ss.getNextID(this._length);else if(n.user===Yt);else{if(n.clock<i)return[];if(n.clock!==i)throw new Error("Can not apply yet!");t.ss.setState(n.user,i+this._length)}e._deleted||t._transaction.changedTypes.has(e)||t._transaction.newTypes.has(e)||this._parent._beforeChange();var o=void 0;o=null!==this._left?this._left._right:null!==this._parentSub?this._parent._map.get(this._parentSub)||null:this._parent._start;for(var a=new Set,s=new Set;null!==o&&o!==this._right;){if(s.add(o),a.add(o),this._origin===o._origin)o._id.user<this._id.user&&(this._left=o,a.clear());else{if(!s.has(o._origin))break;a.has(o._origin)||(this._left=o,a.clear())}o=o._right}var l=this._parentSub;if(null===this._left){var u=void 0;if(null!==l){var c=e._map;u=c.get(l)||null,c.set(l,this)}else u=e._start,e._start=this;this._right=u,null!==u&&(u._left=this)}else{var h=this._left,f=h._right;this._right=f,h._right=this,null!==f&&(f._left=this)}e._deleted&&this._delete(t,!1),t.os.put(this),m(t,e,l),this._id.user!==Yt&&(null===t.connector||!t.connector._forwardAppliedStructs&&this._id.user!==t.userID||t.connector.broadcastStruct(this),null!==t.persistence&&t.persistence.saveStruct(t,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor));var e=0;null!==this._origin&&(e+=1),null!==this._right_origin&&(e+=4),null!==this._parentSub&&(e+=8),t.writeUint8(e),t.writeID(this._id),1&e&&t.writeID(this._origin._lastId),4&e&&t.writeID(this._right_origin._id),0==(5&e)&&t.writeID(this._parent._id),8&e&&t.writeVarString(JSON.stringify(this._parentSub))}},{key:"_fromBinary",value:function(t,e){var n=[],r=e.readUint8(),i=e.readID();if(this._id=i,1&r){var o=e.readID(),a=t.os.getItemCleanEnd(o);null===a?n.push(o):(this._origin=a,this._left=this._origin)}if(4&r){var s=e.readID(),l=t.os.getItemCleanStart(s);null===l?n.push(s):(this._right=l,this._right_origin=l)}if(0==(5&r)){var u=e.readID();if(null===this._parent){var c=void 0;c=u.constructor===zt?t.os.get(u):t.os.getItem(u),null===c?n.push(u):this._parent=c}}else null===this._parent&&(null!==this._origin?this._origin.constructor===xt?this._parent=this._origin:this._parent=this._origin._parent:null!==this._right_origin&&(this._right_origin.constructor===xt?this._parent=this._right_origin:this._parent=this._right_origin._parent));return 8&r&&(this._parentSub=JSON.parse(e.readVarString())),t.ss.getState(i.user)<i.clock&&n.push(new At(i.user,i.clock-1)),n}},{key:"_lastId",get:function(){return new At(this._id.user,this._id.clock+this._length-1)}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!0}}]),Item}(),Lt=function(){function t(){bt(this,t),this.eventListeners=[]}return wt(t,[{key:"destroy",value:function(){this.eventListeners=null}},{key:"addEventListener",value:function(t){this.eventListeners.push(t)}},{key:"removeEventListener",value:function(t){this.eventListeners=this.eventListeners.filter(function(e){return t!==e})}},{key:"removeAllEventListeners",value:function(){this.eventListeners=[]}},{key:"callEventListeners",value:function(t,e){for(var n=0;n<this.eventListeners.length;n++)try{(0,this.eventListeners[n])(e)}catch(t){console.error(t)}}}]),t}(),Type=function(t){function Type(){bt(this,Type);var t=Et(this,(Type.__proto__||Object.getPrototypeOf(Type)).call(this));return t._map=new Map,t._start=null,t._y=null,t._eventHandler=new Lt,t._deepEventHandler=new Lt,t}return Ot(Type,t),wt(Type,[{key:"getPathTo",value:function(t){if(t===this)return[];for(var e=[],n=this._y;t!==this&&t!==n;){var r=t._parent;if(null!==t._parentSub)e.unshift(t._parentSub);else{var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=Ut(s.value,2),c=u[0];if(u[1]===t){e.unshift(c);break}}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}}t=r}if(t!==this)throw new Error("The type is not a child of this node");return e}},{key:"_callEventHandler",value:function(t,e){var n=t.changedParentTypes;this._eventHandler.callEventListeners(t,e);for(var r=this;r!==this._y;){var i=n.get(r);void 0===i&&(i=[],n.set(r,i)),i.push(e),r=r._parent}}},{key:"_transact",value:function(t){var e=this._y;null!==e?e.transact(t):t(e)}},{key:"observe",value:function(t){this._eventHandler.addEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserve",value:function(t){this._eventHandler.removeEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_integrate",value:function(t){St(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_integrate",this).call(this,t),this._y=t;var e=this._start;null!==e&&(this._start=null,b(t,e));var n=this._map;this._map=new Map;var r=!0,i=!1,o=void 0;try{for(var a,s=n.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){b(t,a.value)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}}},{key:"_gcChildren",value:function(t){w(t,this._start),this._start=null,this._map.forEach(function(e){w(t,e)}),this._map=new Map}},{key:"_gc",value:function(t){this._gcChildren(t),St(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_gc",this).call(this,t)}},{key:"_delete",value:function(t,e,n){void 0!==n&&t.gcEnabled||(n=!1===t._hasUndoManager&&t.gcEnabled),St(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_delete",this).call(this,t,e,n),t._transaction.changedTypes.delete(this);var r=!0,i=!1,o=void 0;try{for(var a,s=this._map.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){var l=a.value;l instanceof Item&&!l._deleted&&l._delete(t,!1,n)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}for(var u=this._start;null!==u;)u._deleted||u._delete(t,!1,n),u=u._right;n&&this._gcChildren(t)}}]),Type}(Item),ItemJSON=function(t){function ItemJSON(){bt(this,ItemJSON);var t=Et(this,(ItemJSON.__proto__||Object.getPrototypeOf(ItemJSON)).call(this));return t._content=null,t}return Ot(ItemJSON,t),wt(ItemJSON,[{key:"_copy",value:function(){var t=St(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=St(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_fromBinary",this).call(this,t,e),r=e.readVarUint();this._content=new Array(r);for(var i=0;i<r;i++){var o=e.readVarString(),a=void 0;a="undefined"===o?void 0:JSON.parse(o),this._content[i]=a}return n}},{key:"_toBinary",value:function(t){St(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_toBinary",this).call(this,t);var e=this._content.length;t.writeVarUint(e);for(var n=0;n<e;n++){var r=void 0,i=this._content[n];r=void 0===i?"undefined":JSON.stringify(i),t.writeVarString(r)}}},{key:"_logString",value:function(){return y("ItemJSON",this,"content:"+JSON.stringify(this._content))}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemJSON;return n._content=this._content.splice(e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemJSON}(Item),ItemString=function(t){function ItemString(){bt(this,ItemString);var t=Et(this,(ItemString.__proto__||Object.getPrototypeOf(ItemString)).call(this));return t._content=null,t}return Ot(ItemString,t),wt(ItemString,[{key:"_copy",value:function(){var t=St(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=St(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_fromBinary",this).call(this,t,e);return this._content=e.readVarString(),n}},{key:"_toBinary",value:function(t){St(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_toBinary",this).call(this,t),t.writeVarString(this._content)}},{key:"_logString",value:function(){return y("ItemString",this,'content:"'+this._content+'"')}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemString;return n._content=this._content.slice(e),this._content=this._content.slice(0,e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemString}(Item),YEvent=function(){function YEvent(t){bt(this,YEvent),this.target=t,this.currentTarget=t}return wt(YEvent,[{key:"path",get:function(){return this.currentTarget.getPathTo(this.target)}}]),YEvent}(),YArrayEvent=function(t){function YArrayEvent(t,e,n){bt(this,YArrayEvent);var r=Et(this,(YArrayEvent.__proto__||Object.getPrototypeOf(YArrayEvent)).call(this,t));return r.remote=e,r._transaction=n,r._addedElements=null,r._removedElements=null,r}return Ot(YArrayEvent,t),wt(YArrayEvent,[{key:"addedElements",get:function(){if(null===this._addedElements){var t=this.target,e=this._transaction,n=new Set;e.newTypes.forEach(function(r){r._parent!==t||e.deletedStructs.has(r)||n.add(r)}),this._addedElements=n}return this._addedElements}},{key:"removedElements",get:function(){if(null===this._removedElements){var t=this.target,e=this._transaction,n=new Set;e.deletedStructs.forEach(function(r){r._parent!==t||e.newTypes.has(r)||n.add(r)}),this._removedElements=n}return this._removedElements}}]),YArrayEvent}(YEvent),YArray=function(t){function YArray(){return bt(this,YArray),Et(this,(YArray.__proto__||Object.getPrototypeOf(YArray)).apply(this,arguments))}return Ot(YArray,t),wt(YArray,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YArrayEvent(this,n,t))}},{key:"get",value:function(t){for(var e=this._start;null!==e;){if(!e._deleted&&e._countable){if(t<e._length)return e.constructor===ItemJSON||e.constructor===ItemString?e._content[t]:e;t-=e._length}e=e._right}}},{key:"toArray",value:function(){return this.map(function(t){return t})}},{key:"toJSON",value:function(){return this.map(function(t){return t instanceof Type?null!==t.toJSON?t.toJSON():t.toString():t})}},{key:"map",value:function(t){var e=this,n=[];return this.forEach(function(r,i){n.push(t(r,i,e))}),n}},{key:"forEach",value:function(t){for(var e=0,n=this._start;null!==n;){if(!n._deleted&&n._countable)if(n instanceof Type)t(n,e++,this);else for(var r=n._content,i=r.length,o=0;o<i;o++)e++,t(r[o],e,this);n=n._right}}},{key:Symbol.iterator,value:function(){return{next:function(){for(;null!==this._item&&(this._item._deleted||this._item._length<=this._itemElement);)this._item=this._item._right,this._itemElement=0;if(null===this._item)return{done:!0};var t=void 0;return t=this._item instanceof Type?this._item:this._item._content[this._itemElement++],{value:t,done:!1}},_item:this._start,_itemElement:0,_count:0}}},{key:"delete",value:function(t){var e=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1;if(this._y.transact(function(){for(var r=e._start,i=0;null!==r&&n>0;){if(!r._deleted&&r._countable)if(i<=t&&t<i+r._length){var o=t-i;r=r._splitAt(e._y,o),r._splitAt(e._y,n),n-=r._length,r._delete(e._y),i+=o}else i+=r._length;r=r._right}}),n>0)throw new Error("Delete exceeds the range of the YArray")}},{key:"insertAfter",value:function(t,e){var n=this;return this._transact(function(r){var i=void 0;i=null===t?n._start:t._right;for(var o=null,a=0;a<e.length;a++){var s=e[a];"function"==typeof s&&(s=new s),s instanceof Type?(null!==o&&(null!==r&&o._integrate(r),t=o,o=null),s._origin=t,s._left=t,s._right=i,s._right_origin=i,s._parent=n,null!==r?s._integrate(r):null===t?n._start=s:t._right=s,t=s):(null===o&&(o=new ItemJSON,o._origin=t,o._left=t,o._right=i,o._right_origin=i,o._parent=n,o._content=[]),o._content.push(s))}null!==o&&(null!==r?o._integrate(r):null===o._left&&(n._start=o))}),e}},{key:"insert",value:function(t,e){var n=this;this._transact(function(){for(var r=null,i=n._start,o=0,a=n._y;null!==i;){var s=i._deleted?0:i._length-1;if(o<=t&&t<=o+s){var l=t-o;i=i._splitAt(a,l),r=i._left,o+=l;break}i._deleted||(o+=i._length),r=i,i=i._right}if(t>o)throw new Error("Index exceeds array range!");n.insertAfter(r,e)})}},{key:"push",value:function(t){for(var e=this._start,n=null;null!==e;)e._deleted||(n=e),e=e._right;this.insertAfter(n,t)}},{key:"_logString",value:function(){return y("YArray",this,"start:"+p(this._start)+'"')}},{key:"length",get:function(){for(var t=0,e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._length),e=e._right;return t}}]),YArray}(Type),YMapEvent=function(t){function YMapEvent(t,e,n){bt(this,YMapEvent);var r=Et(this,(YMapEvent.__proto__||Object.getPrototypeOf(YMapEvent)).call(this,t));return r.keysChanged=e,r.remote=n,r}return Ot(YMapEvent,t),YMapEvent}(YEvent),YMap=function(t){function YMap(){return bt(this,YMap),Et(this,(YMap.__proto__||Object.getPrototypeOf(YMap)).apply(this,arguments))}return Ot(YMap,t),wt(YMap,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YMapEvent(this,e,n))}},{key:"toJSON",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Ut(i.value,2),s=a[0],l=a[1];if(!l._deleted){var u=void 0;u=l instanceof Type?void 0!==l.toJSON?l.toJSON():l.toString():l._content[0],t[s]=u}}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"keys",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Ut(i.value,2),s=a[0];a[1]._deleted||t.push(s)}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"delete",value:function(t){var e=this;this._transact(function(n){var r=e._map.get(t);null!==n&&void 0!==r&&r._delete(n)})}},{key:"set",value:function(t,e){var n=this;return this._transact(function(r){var i=n._map.get(t)||null;if(null!==i){if(i.constructor===ItemJSON&&!i._deleted&&i._content[0]===e)return e;null!==r&&i._delete(r)}var o=void 0;"function"==typeof e?(o=new e,e=o):e instanceof Item?o=e:(o=new ItemJSON,o._content=[e]),o._right=i,o._right_origin=i,o._parent=n,o._parentSub=t,null!==r?o._integrate(r):n._map.set(t,o)}),e}},{key:"get",value:function(t){var e=this._map.get(t);if(void 0!==e&&!e._deleted)return e instanceof Type?e:e._content[e._content.length-1]}},{key:"has",value:function(t){var e=this._map.get(t);return void 0!==e&&!e._deleted}},{key:"_logString",value:function(){return y("YMap",this,"mapSize:"+this._map.size)}}]),YMap}(Type),Ct=function(t){function e(){bt(this,e);var t=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.embed=null,t}return Ot(e,t),wt(e,[{key:"_copy",value:function(t,n){var r=St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.embed=this.embed,r}},{key:"_fromBinary",value:function(t,n){var r=St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.embed=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(JSON.stringify(this.embed))}},{key:"_logString",value:function(){return y("ItemEmbed",this,"embed:"+JSON.stringify(this.embed))}},{key:"_length",get:function(){return 1}}]),e}(Item),Mt=function(t){function e(){bt(this,e);var t=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.key=null,t.value=null,t}return Ot(e,t),wt(e,[{key:"_copy",value:function(t,n){var r=St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.key=this.key,r.value=this.value,r}},{key:"_fromBinary",value:function(t,n){var r=St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.key=n.readVarString(),this.value=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.key),t.writeVarString(JSON.stringify(this.value))}},{key:"_logString",value:function(){return y("ItemFormat",this,"key:"+JSON.stringify(this.key)+",value:"+JSON.stringify(this.value))}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!1}}]),e}(Item),Rt=function(t){function e(t,n,r){bt(this,e);var i=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n,r));return i._delta=null,i}return Ot(e,t),wt(e,[{key:"delta",get:function(){var t=this;if(null===this._delta){var e=this.target._y;e.transact(function(){var n=t.target._start,r=[],i=t.addedElements,o=t.removedElements;t._delta=r;for(var a=null,s={},l=new Map,u=new Map,c="",h=0,f=0,d=function(){if(null!==a){var t=void 0;switch(a){case"delete":t={delete:f},f=0;break;case"insert":if(t={insert:c},l.size>0){t.attributes={};var e=!0,n=!1,i=void 0;try{for(var o,u=l[Symbol.iterator]();!(e=(o=u.next()).done);e=!0){var d=Ut(o.value,2),_=d[0],v=d[1];null!==v&&(t.attributes[_]=v)}}catch(t){n=!0,i=t}finally{try{!e&&u.return&&u.return()}finally{if(n)throw i}}}c="";break;case"retain":if(t={retain:h},Object.keys(s).length>0){t.attributes={};for(var _ in s)t.attributes[_]=s[_]}h=0}r.push(t),a=null}};null!==n;){switch(n.constructor){case Ct:i.has(n)?(d(),a="insert",c=n.embed,d()):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=1):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=1);break;case ItemString:i.has(n)?("insert"!==a&&(d(),a="insert"),c+=n._content):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=n._length):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=n._length);break;case Mt:if(i.has(n)){(l.get(n.key)||null)!==n.value?("retain"===a&&d(),n.value===(u.get(n.key)||null)?delete s[n.key]:s[n.key]=n.value):n._delete(e)}else if(o.has(n)){u.set(n.key,n.value);var _=l.get(n.key)||null;_!==n.value&&("retain"===a&&d(),s[n.key]=_)}else if(!1===n._deleted){u.set(n.key,n.value);var v=s[n.key];void 0!==v&&(v!==n.value?("retain"===a&&d(),null===n.value?s[n.key]=n.value:delete s[n.key]):n._delete(e))}!1===n._deleted&&("insert"===a&&d(),B(l,n))}n=n._right}for(d();t._delta.length>0;){var p=t._delta[t._delta.length-1];if(void 0===p.retain||void 0!==p.attributes)break;t._delta.pop()}})}return this._delta}}]),e}(YArrayEvent),YText=function(t){function YText(t){bt(this,YText);var e=Et(this,(YText.__proto__||Object.getPrototypeOf(YText)).call(this));if("string"==typeof t){var n=new ItemString;n._parent=e,n._content=t,e._start=n}return e}return Ot(YText,t),wt(YText,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new Rt(this,n,t))}},{key:"toString",value:function(){for(var t="",e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._content),e=e._right;return t}},{key:"applyDelta",value:function(t){var e=this;this._transact(function(n){for(var r=null,i=e._start,o=new Map,a=0;a<t.length;a++){var s=t[a];if(void 0!==s.insert){var l=D(n,s.insert,e,r,i,o,s.attributes||{}),u=Ut(l,2);r=u[0],i=u[1]}else if(void 0!==s.retain){var c=P(n,s.retain,e,r,i,o,s.attributes||{}),h=Ut(c,2);r=h[0],i=h[1]}else if(void 0!==s.delete){var f=N(n,s.delete,e,r,i,o),d=Ut(f,2);r=d[0],i=d[1]}}})}},{key:"toDelta",value:function(){function t(){if(r.length>0){var t={},i=!1,o=!0,a=!1,s=void 0;try{for(var l,u=n[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=Ut(l.value,2),h=c[0],f=c[1];i=!0,t[h]=f}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}var d={insert:r};i&&(d.attributes=t),e.push(d),r=""}}for(var e=[],n=new Map,r="",i=this._start;null!==i;){if(!i._deleted)switch(i.constructor){case ItemString:r+=i._content;break;case Mt:t(),B(n,i)}i=i._right}return t(),e}},{key:"insert",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};e.length<=0||this._transact(function(i){var o=E(n,t),a=Ut(o,3),s=a[0],l=a[1],u=a[2];D(i,e,n,s,l,u,r)})}},{key:"insertEmbed",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(e.constructor!==Object)throw new Error("Embed must be an Object");this._transact(function(i){var o=E(n,t),a=Ut(o,3),s=a[0],l=a[1],u=a[2];D(i,e,n,s,l,u,r)})}},{key:"delete",value:function(t,e){var n=this;0!==e&&this._transact(function(r){var i=E(n,t),o=Ut(i,3),a=o[0],s=o[1],l=o[2];N(r,e,n,a,s,l)})}},{key:"format",value:function(t,e,n){var r=this;this._transact(function(i){var o=E(r,t),a=Ut(o,3),s=a[0],l=a[1],u=a[2];null!==l&&P(i,e,r,s,l,u,n)})}},{key:"_logString",value:function(){return y("YText",this)}}]),YText}(YArray),YXmlHook=function(t){function YXmlHook(t){bt(this,YXmlHook);var e=Et(this,(YXmlHook.__proto__||Object.getPrototypeOf(YXmlHook)).call(this));return e.hookName=null,void 0!==t&&(e.hookName=t),e}return Ot(YXmlHook,t),wt(YXmlHook,[{key:"_copy",value:function(){var t=St(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_copy",this).call(this);return t.hookName=this.hookName,t}},{key:"toDom",value:function(){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},e=arguments[2],n=t[this.hookName],r=void 0;return r=void 0!==n?n.createDom(this):document.createElement(this.hookName),r.setAttribute("data-yjs-hook",this.hookName),R(e,r,this),r}},{key:"_fromBinary",value:function(t,e){var n=St(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_fromBinary",this).call(this,t,e);return this.hookName=e.readVarString(),n}},{key:"_toBinary",value:function(t){St(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.hookName)}},{key:"_integrate",value:function(t){if(null===this.hookName)throw new Error("hookName must be defined!");St(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_integrate",this).call(this,t)}}]),YXmlHook}(YMap),Ht=function(){function t(e,n){bt(this,t),this._filter=n||function(){return!0},this._root=e,this._currentNode=e,this._firstCall=!0}return wt(t,[{key:Symbol.iterator,value:function(){return this}},{key:"next",value:function(){var t=this._currentNode;if(this._firstCall&&(this._firstCall=!1,!t._deleted&&this._filter(t)))return{value:t,done:!1};do{if(t._deleted||t.constructor!==YXmlFragment._YXmlElement&&t.constructor!==YXmlFragment||null===t._start){for(;t!==this._root;){if(null!==t._right){t=t._right;break}t=t._parent}t===this._root&&(t=null)}else t=t._start;if(t===this._root)break}while(null!==t&&(t._deleted||!this._filter(t)));return this._currentNode=t,null===t?{done:!0}:{value:t,done:!1}}}]),t}(),YXmlEvent=function(t){function YXmlEvent(t,e,n,r){bt(this,YXmlEvent);var i=Et(this,(YXmlEvent.__proto__||Object.getPrototypeOf(YXmlEvent)).call(this,t));return i._transaction=r,i.childListChanged=!1,i.attributesChanged=new Set,i.remote=n,e.forEach(function(t){null===t?i.childListChanged=!0:i.attributesChanged.add(t)}),i}return Ot(YXmlEvent,t),YXmlEvent}(YEvent),YXmlFragment=function(t){function YXmlFragment(){return bt(this,YXmlFragment),Et(this,(YXmlFragment.__proto__||Object.getPrototypeOf(YXmlFragment)).apply(this,arguments))}return Ot(YXmlFragment,t),wt(YXmlFragment,[{key:"createTreeWalker",value:function(t){return new Ht(this,t)}},{key:"querySelector",value:function(t){t=t.toUpperCase();var e=new Ht(this,function(e){return e.nodeName===t}),n=e.next();return n.done?null:n.value}},{key:"querySelectorAll",value:function(t){return t=t.toUpperCase(),Array.from(new Ht(this,function(e){return e.nodeName===t}))}},{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YXmlEvent(this,e,n,t))}},{key:"toString",value:function(){return this.map(function(t){return t.toString()}).join("")}},{key:"_delete",value:function(t,e,n){St(YXmlFragment.prototype.__proto__||Object.getPrototypeOf(YXmlFragment.prototype),"_delete",this).call(this,t,e,n)}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createDocumentFragment();return R(n,r,this),this.forEach(function(i){r.insertBefore(i.toDom(t,e,n),null)}),r}},{key:"_logString",value:function(){return y("YXml",this)}}]),YXmlFragment}(YArray),YXmlElement=function(t){function YXmlElement(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"UNDEFINED";bt(this,YXmlElement);var e=Et(this,(YXmlElement.__proto__||Object.getPrototypeOf(YXmlElement)).call(this));return e.nodeName=t.toUpperCase(),e}return Ot(YXmlElement,t),wt(YXmlElement,[{key:"_copy",value:function(){var t=St(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_copy",this).call(this);return t.nodeName=this.nodeName,t}},{key:"_fromBinary",value:function(t,e){var n=St(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_fromBinary",this).call(this,t,e);return this.nodeName=e.readVarString(),n}},{key:"_toBinary",value:function(t){St(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.nodeName)}},{key:"_integrate",value:function(t){if(null===this.nodeName)throw new Error("nodeName must be defined!");St(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_integrate",this).call(this,t)}},{key:"toString",value:function(){var t=this.getAttributes(),e=[],n=[];for(var r in t)n.push(r);n.sort();for(var i=n.length,o=0;o<i;o++){var a=n[o];e.push(a+'="'+t[a]+'"')}var s=this.nodeName.toLocaleLowerCase();return"<"+s+(e.length>0?" "+e.join(" "):"")+">"+St(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"toString",this).call(this)+"</"+s+">"}},{key:"removeAttribute",value:function(t){return YMap.prototype.delete.call(this,t)}},{key:"setAttribute",value:function(t,e){return YMap.prototype.set.call(this,t,e)}},{key:"getAttribute",value:function(t){return YMap.prototype.get.call(this,t)}},{key:"getAttributes",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Ut(i.value,2),s=a[0],l=a[1];l._deleted||(t[s]=l._content[0])}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createElement(this.nodeName),i=this.getAttributes();for(var o in i)r.setAttribute(o,i[o]);return this.forEach(function(i){r.appendChild(i.toDom(t,e,n))}),R(n,r,this),r}}]),YXmlElement}(YXmlFragment);YXmlFragment._YXmlElement=YXmlElement;var YXmlText=function(t){function YXmlText(){return bt(this,YXmlText),Et(this,(YXmlText.__proto__||Object.getPrototypeOf(YXmlText)).apply(this,arguments))}return Ot(YXmlText,t),wt(YXmlText,[{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments[2],n=t.createTextNode(this.toString());return R(e,n,this),n}},{key:"_delete",value:function(t,e,n){St(YXmlText.prototype.__proto__||Object.getPrototypeOf(YXmlText.prototype),"_delete",this).call(this,t,e,n)}}]),YXmlText}(YText),Jt=new Map,Wt=new Map;q(0,ItemJSON),q(1,ItemString),q(10,Mt),q(11,Ct),q(2,Delete),q(3,YArray),q(4,YMap),q(5,YText),q(6,YXmlFragment),q(7,YXmlElement),q(8,YXmlText),q(9,YXmlHook),q(12,xt);var Yt=16777215,zt=function(){function t(e,n){bt(this,t),this.user=Yt,this.name=e,this.type=$(n)}return wt(t,[{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.name===this.name&&t.type===this.type}},{key:"lessThan",value:function(e){return e.constructor!==t||(this.user<e.user||this.user===e.user&&(this.name<e.name||this.name===e.name&&this.type<e.type))}}]),t}(),Xt=function(t){function e(t){bt(this,e);var n=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return n.y=t,n}return Ot(e,t),wt(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){e.constructor===xt?t.push({id:p(e),content:e._length,deleted:"GC"}):t.push({id:p(e),origin:p(null===e._origin?null:e._origin._lastId),left:p(null===e._left?null:e._left._lastId),right:p(e._right),right_origin:p(e._right_origin),parent:p(e._parent),parentSub:e._parentSub,deleted:e._deleted,content:JSON.stringify(e._content)})}),console.table(t)}},{key:"get",value:function(t){var e=this.find(t);if(null===e&&t instanceof zt){var n=F(t.type),r=this.y;e=new n,e._id=t,e._parent=r,r.transact(function(){e._integrate(r)}),this.put(e)}return e}},{key:"getItem",value:function(t){var e=this.findWithUpperBound(t);if(null===e)return null;var n=e._id;return t.user===n.user&&t.clock<n.clock+e._length?e:null}},{key:"getItemCleanStart",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock===t.clock?e:e._splitAt(this.y,t.clock-n.clock)}},{key:"getItemCleanEnd",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock+e._length-1===t.clock?e:(e._splitAt(this.y,t.clock-n.clock+1),e)}}]),e}(Tt),qt=function(){function t(e){bt(this,t),this.y=e,this.state=new Map}return wt(t,[{key:"logTable",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this.state[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Ut(i.value,2),s=a[0],l=a[1];t.push({user:s,state:l})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}console.table(t)}},{key:"getNextID",value:function(t){var e=this.y.userID,n=this.getState(e);return this.setState(e,n+t),new At(e,n)}},{key:"updateRemoteState",value:function(t){for(var e=t._id.user,n=this.state.get(e);null!==t&&t._id.clock===n;)n+=t._length,t=this.y.os.get(new At(e,n));this.state.set(e,n)}},{key:"getState",value:function(t){var e=this.state.get(t);return null==e?0:e}},{key:"setState",value:function(t,e){var n=this.y._transaction.beforeState;n.has(t)||n.set(t,this.getState(t)),this.state.set(t,e)}}]),t}(),Ft=function(){function t(){bt(this,t),this._eventListener=new Map,this._stateListener=new Map}return wt(t,[{
key:"_getListener",value:function(t){var e=this._eventListener.get(t);return void 0===e&&(e={once:new Set,on:new Set},this._eventListener.set(t,e)),e}},{key:"once",value:function(t,e){this._getListener(t).once.add(e)}},{key:"on",value:function(t,e){this._getListener(t).on.add(e)}},{key:"_initStateListener",value:function(t){var e=this._stateListener.get(t);return void 0===e&&(e={},e.promise=new Promise(function(t){e.resolve=t}),this._stateListener.set(t,e)),e}},{key:"when",value:function(t){return this._initStateListener(t).promise}},{key:"off",value:function(t,e){if(null==t||null==e)throw new Error("You must specify event name and function!");var n=this._eventListener.get(t);void 0!==n&&(n.on.delete(e),n.once.delete(e))}},{key:"emit",value:function(t){for(var e=arguments.length,n=Array(e>1?e-1:0),r=1;r<e;r++)n[r-1]=arguments[r];this._initStateListener(t).resolve();var i=this._eventListener.get(t);void 0!==i?(i.on.forEach(function(t){return t.apply(null,n)}),i.once.forEach(function(t){return t.apply(null,n)}),i.once=new Set):"error"===t&&console.error(n[0])}},{key:"destroy",value:function(){this._eventListener=null}}]),t}(),$t=function(){function t(e,n){bt(this,t),this.type=e,this.target=n,this._mutualExclude=Z()}return wt(t,[{key:"destroy",value:function(){this.type=null,this.target=null}}]),t}(),Gt=null,Zt=null,Qt=void 0;Qt="undefined"!=typeof getSelection?function(t,e,n,r){if(r){Zt={from:null,to:null,fromY:null,toY:null},Gt=getSelection();var i=Gt.anchorNode,o=e.domToType.get(i);null!==i&&void 0!==o&&(Zt.from=Q(o,Gt.anchorOffset),Zt.fromY=o._y);var a=Gt.focusNode,s=e.domToType.get(a);null!==a&&void 0!==s&&(Zt.to=Q(s,Gt.focusOffset),Zt.toY=s._y)}}:function(){};var Kt=function(t){function e(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};bt(this,e);var i=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));i.opts=r,r.document=r.document||document,r.hooks=r.hooks||{},i.scrollingElement=r.scrollingElement||null,i.domToType=new Map,i.typeToDom=new Map,i.filter=r.filter||I,n.innerHTML="",t.forEach(function(t){n.insertBefore(t.toDom(r.document,r.hooks,i),null)}),i._typeObserver=rt.bind(i),i._domObserver=function(t){at.call(i,t,r.document)},t.observeDeep(i._typeObserver),i._mutationObserver=new MutationObserver(i._domObserver),i._mutationObserver.observe(n,{childList:!0,attributes:!0,characterData:!0,subtree:!0});var o=t._y;return i._beforeTransactionHandler=function(t,e,n){i._domObserver(i._mutationObserver.takeRecords()),Qt(t,i,e,n)},o.on("beforeTransaction",i._beforeTransactionHandler),i._afterTransactionHandler=function(t,e,n){tt(t,i,e,n),e.deletedStructs.forEach(function(t){var e=i.typeToDom.get(t);void 0!==e&&M(i,e,t)})},o.on("afterTransaction",i._afterTransactionHandler),i._beforeObserverCallsHandler=function(t,e){e.changedTypes.forEach(function(e,n){(e.size>1||1===e.size&&!1===e.has(null))&&V(t,i,n)}),e.newTypes.forEach(function(e){V(t,i,e)})},o.on("beforeObserverCalls",i._beforeObserverCallsHandler),R(i,n,t),i}return Ot(e,t),wt(e,[{key:"setFilter",value:function(t){this.filter=t}},{key:"destroy",value:function(){this.domToType=null,this.typeToDom=null,this.type.unobserveDeep(this._typeObserver),this._mutationObserver.disconnect();var t=this.type._y;t.off("beforeTransaction",this._beforeTransactionHandler),t.off("beforeObserverCalls",this._beforeObserverCallsHandler),t.off("afterTransaction",this._afterTransactionHandler),St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}($t),Y=function(t){function Y(t,e,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{};bt(this,Y);var i=Et(this,(Y.__proto__||Object.getPrototypeOf(Y)).call(this));i.gcEnabled=r.gc||!1,i.room=t,null!=e&&(e.connector.room=t),i._contentReady=!1,i._opts=e,"number"!=typeof e.userID?i.userID=G():i.userID=e.userID,i.share={},i.ds=new Pt(i),i.os=new Xt(i),i.ss=new qt(i),i._missingStructs=new Map,i._readyToIntegrate=[],i._transaction=null,i.connector=null,i.connected=!1;var o=function(){null!=e&&(i.connector=new Y[e.connector.name](i,e.connector),i.connected=!0,i.emit("connectorReady"))};return i.persistence=null,null!=n?(i.persistence=n,n._init(i).then(o)):o(),i._parent=null,i._hasUndoManager=!1,i}return Ot(Y,t),wt(Y,[{key:"_setContentReady",value:function(){this._contentReady||(this._contentReady=!0,this.emit("content"))}},{key:"whenContentReady",value:function(){var t=this;return this._contentReady?Promise.resolve():new Promise(function(e){t.once("content",e)})}},{key:"_beforeChange",value:function(){}},{key:"transact",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=null===this._transaction;n&&(this._transaction=new Vt(this),this.emit("beforeTransaction",this,this._transaction,e));try{t(this)}catch(t){console.error(t)}if(n){this.emit("beforeObserverCalls",this,this._transaction,e);var r=this._transaction;this._transaction=null,r.changedTypes.forEach(function(t,n){n._deleted||n._callObserver(r,t,e)}),r.changedParentTypes.forEach(function(t,e){e._deleted||(t=t.filter(function(t){return!t.target._deleted}),t.forEach(function(t){t.currentTarget=e}),e._deepEventHandler.callEventListeners(r,t))}),this.emit("afterTransaction",this,r,e)}}},{key:"define",value:function(t,e){var n=new zt(t,e),r=this.os.get(n);if(void 0===this.share[t])this.share[t]=r;else if(this.share[t]!==r)throw new Error("Type is already defined with a different constructor");return r}},{key:"get",value:function(t){return this.share[t]}},{key:"disconnect",value:function(){return this.connected?(this.connected=!1,this.connector.disconnect()):Promise.resolve()}},{key:"reconnect",value:function(){return this.connected?Promise.resolve():(this.connected=!0,this.connector.reconnect())}},{key:"destroy",value:function(){St(Y.prototype.__proto__||Object.getPrototypeOf(Y.prototype),"destroy",this).call(this),this.share=null,null!=this.connector&&(null!=this.connector.destroy?this.connector.destroy():this.connector.disconnect()),null!==this.persistence&&(this.persistence.deinit(this),this.persistence=null),this.os=null,this.ds=null,this.ss=null}},{key:"_start",get:function(){return null},set:function(t){return null}}]),Y}(Ft);Y.extend=function(){for(var t=0;t<arguments.length;t++){var e=arguments[t];if("function"!=typeof e)throw new Error("Expected a function!");e(Y)}};var te=function t(e,n){bt(this,t),this.created=new Date;var r=n.beforeState;r.has(e.userID)?(this.toState=new At(e.userID,e.ss.getState(e.userID)-1),this.fromState=new At(e.userID,r.get(e.userID))):(this.toState=null,this.fromState=null),this.deletedStructs=n.deletedStructs},ee=function(){function t(e){var n=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};bt(this,t),this.options=r,r.captureTimeout=null==r.captureTimeout?500:r.captureTimeout,this._undoBuffer=[],this._redoBuffer=[],this._scope=e,this._undoing=!1,this._redoing=!1,this._lastTransactionWasUndo=!1;var i=e._y;this.y=i,i._hasUndoManager=!0,i.on("afterTransaction",function(t,i,o){if(!o&&i.changedParentTypes.has(e)){var a=new te(t,i);if(n._undoing)n._lastTransactionWasUndo=!0,n._redoBuffer.push(a);else{var s=n._undoBuffer.length>0?n._undoBuffer[n._undoBuffer.length-1]:null;!1===n._redoing&&!1===n._lastTransactionWasUndo&&null!==s&&a.created-s.created<=r.captureTimeout?(s.created=a.created,null!==a.toState&&(s.toState=a.toState,null===s.fromState&&(s.fromState=a.fromState)),a.deletedStructs.forEach(s.deletedStructs.add,s.deletedStructs)):(n._lastTransactionWasUndo=!1,n._undoBuffer.push(a)),n._redoing||(n._redoBuffer=[])}}})}return wt(t,[{key:"undo",value:function(){this._undoing=!0;var t=st(this.y,this._scope,this._undoBuffer);return this._undoing=!1,t}},{key:"redo",value:function(){this._redoing=!0;var t=st(this.y,this._scope,this._redoBuffer);return this._redoing=!1,t}}]),t}(),ne=1e3,re=60*ne,ie=60*re,oe=24*ie,ae=365.25*oe,se=function(t,e){e=e||{};var n=void 0===t?"undefined":kt(t);if("string"===n&&t.length>0)return ut(t);if("number"===n&&!1===isNaN(t))return e.long?ht(t):ct(t);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(t))},le=lt(function(t,e){function n(t){var n,r=0;for(n in t)r=(r<<5)-r+t.charCodeAt(n),r|=0;return e.colors[Math.abs(r)%e.colors.length]}function r(t){function r(){if(r.enabled){var t=r,n=+new Date,i=n-(l||n);t.diff=i,t.prev=l,t.curr=n,l=n;for(var o=new Array(arguments.length),a=0;a<o.length;a++)o[a]=arguments[a];o[0]=e.coerce(o[0]),"string"!=typeof o[0]&&o.unshift("%O");var s=0;o[0]=o[0].replace(/%([a-zA-Z%])/g,function(n,r){if("%%"===n)return n;s++;var i=e.formatters[r];if("function"==typeof i){var a=o[s];n=i.call(t,a),o.splice(s,1),s--}return n}),e.formatArgs.call(t,o);(r.log||e.log||console.log.bind(console)).apply(t,o)}}return r.namespace=t,r.enabled=e.enabled(t),r.useColors=e.useColors(),r.color=n(t),"function"==typeof e.init&&e.init(r),r}function i(t){e.save(t),e.names=[],e.skips=[];for(var n=("string"==typeof t?t:"").split(/[\s,]+/),r=n.length,i=0;i<r;i++)n[i]&&(t=n[i].replace(/\*/g,".*?"),"-"===t[0]?e.skips.push(new RegExp("^"+t.substr(1)+"$")):e.names.push(new RegExp("^"+t+"$")))}function o(){e.enable("")}function a(t){var n,r;for(n=0,r=e.skips.length;n<r;n++)if(e.skips[n].test(t))return!1;for(n=0,r=e.names.length;n<r;n++)if(e.names[n].test(t))return!0;return!1}function s(t){return t instanceof Error?t.stack||t.message:t}e=t.exports=r.debug=r.default=r,e.coerce=s,e.disable=o,e.enable=i,e.enabled=a,e.humanize=se,e.names=[],e.skips=[],e.formatters={};var l}),ue=(le.coerce,le.disable,le.enable,le.enabled,le.humanize,le.names,le.skips,le.formatters,lt(function(t,e){function n(){return!("undefined"==typeof window||!window.process||"renderer"!==window.process.type)||("undefined"!=typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"undefined"!=typeof window&&window.console&&(window.console.firebug||window.console.exception&&window.console.table)||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))}function r(t){var n=this.useColors;if(t[0]=(n?"%c":"")+this.namespace+(n?" %c":" ")+t[0]+(n?"%c ":" ")+"+"+e.humanize(this.diff),n){var r="color: "+this.color;t.splice(1,0,r,"color: inherit");var i=0,o=0;t[0].replace(/%[a-zA-Z%]/g,function(t){"%%"!==t&&(i++,"%c"===t&&(o=i))}),t.splice(o,0,r)}}function i(){return"object"===("undefined"==typeof console?"undefined":kt(console))&&console.log&&Function.prototype.apply.call(console.log,console,arguments)}function o(t){try{null==t?e.storage.removeItem("debug"):e.storage.debug=t}catch(t){}}function a(){var t;try{t=e.storage.debug}catch(t){}return!t&&"undefined"!=typeof process&&"env"in process&&(t=process.env.DEBUG),t}e=t.exports=le,e.log=i,e.formatArgs=r,e.save=o,e.load=a,e.useColors=n,e.storage="undefined"!=typeof chrome&&void 0!==chrome.storage?chrome.storage.local:function(){try{return window.localStorage}catch(t){}}(),e.colors=["lightseagreen","forestgreen","goldenrod","dodgerblue","darkorchid","crimson"],e.formatters.j=function(t){try{return JSON.stringify(t)}catch(t){return"[UnexpectedJSONParseError]: "+t.message}},e.enable(a())})),ce=(ue.log,ue.formatArgs,ue.save,ue.load,ue.useColors,ue.storage,ue.colors,function(){function t(e,n){if(bt(this,t),this.y=e,this.opts=n,null==n.role||"master"===n.role)this.role="master";else{if("slave"!==n.role)throw new Error("Role must be either 'master' or 'slave'!");this.role="slave"}this.log=ue("y:connector"),this.logMessage=ue("y:connector-message"),this._forwardAppliedStructs=n.forwardAppliedOperations||!1,this.role=n.role,this.connections=new Map,this.isSynced=!1,this.userEventListeners=[],this.whenSyncedListeners=[],this.currentSyncTarget=null,this.debug=!0===n.debug,this.broadcastBuffer=new jt,this.broadcastBufferSize=0,this.protocolVersion=11,this.authInfo=n.auth||null,this.checkAuth=n.checkAuth||function(){return Promise.resolve("write")},null==n.maxBufferLength?this.maxBufferLength=-1:this.maxBufferLength=n.maxBufferLength}return wt(t,[{key:"reconnect",value:function(){this.log("reconnecting..")}},{key:"disconnect",value:function(){return this.log("discronnecting.."),this.connections=new Map,this.isSynced=!1,this.currentSyncTarget=null,this.whenSyncedListeners=[],Promise.resolve()}},{key:"onUserEvent",value:function(t){this.userEventListeners.push(t)}},{key:"removeUserEventListener",value:function(t){this.userEventListeners=this.userEventListeners.filter(function(e){return t!==e})}},{key:"userLeft",value:function(t){if(this.connections.has(t)){this.log("%s: User left %s",this.y.userID,t),this.connections.delete(t),this._setSyncedWith(null);var e=!0,n=!1,r=void 0;try{for(var i,o=this.userEventListeners[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){(0,i.value)({action:"userLeft",user:t})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}}}},{key:"userJoined",value:function(t,e,n){if(null==e)throw new Error("You must specify the role of the joined user!");if(this.connections.has(t))throw new Error("This user already joined!");this.log("%s: User joined %s",this.y.userID,t),this.connections.set(t,{uid:t,isSynced:!1,role:e,processAfterAuth:[],processAfterSync:[],auth:n||null,receivedSyncStep2:!1});var r={};r.promise=new Promise(function(t){r.resolve=t}),this.connections.get(t).syncStep2=r;var i=!0,o=!1,a=void 0;try{for(var s,l=this.userEventListeners[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){(0,s.value)({action:"userJoined",user:t,role:e})}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}this._syncWithUser(t)}},{key:"whenSynced",value:function(t){this.isSynced?t():this.whenSyncedListeners.push(t)}},{key:"_syncWithUser",value:function(t){"slave"!==this.role&&u(this,t)}},{key:"_fireIsSyncedListeners",value:function(){if(!this.isSynced){this.isSynced=!0;var t=!0,e=!1,n=void 0;try{for(var r,i=this.whenSyncedListeners[Symbol.iterator]();!(t=(r=i.next()).done);t=!0){(0,r.value)()}}catch(t){e=!0,n=t}finally{try{!t&&i.return&&i.return()}finally{if(e)throw n}}this.whenSyncedListeners=[],this.y._setContentReady(),this.y.emit("synced")}}},{key:"send",value:function(t,e){var n=this.y;if(!(e instanceof ArrayBuffer||e instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s to User%s: Send '%y'",n.userID,t,e),this.logMessage("User%s to User%s: Send %Y",n.userID,t,[n,e])}},{key:"broadcast",value:function(t){var e=this.y;if(!(t instanceof ArrayBuffer||t instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s: Broadcast '%y'",e.userID,t),this.logMessage("User%s: Broadcast: %Y",e.userID,[e,t])}},{key:"broadcastStruct",value:function(t){var e=this,n=0===this.broadcastBuffer.length;if(n&&(this.broadcastBuffer.writeVarString(this.y.room),this.broadcastBuffer.writeVarString("update"),this.broadcastBufferSize=0,this.broadcastBufferSizePos=this.broadcastBuffer.pos,this.broadcastBuffer.writeUint32(0)),this.broadcastBufferSize++,t._toBinary(this.broadcastBuffer),this.maxBufferLength>0&&this.broadcastBuffer.length>this.maxBufferLength){var r=this.broadcastBuffer;r.setUint32(this.broadcastBufferSizePos,this.broadcastBufferSize),this.broadcastBuffer=new jt,this.whenRemoteResponsive().then(function(){e.broadcast(r.createBuffer())})}else n&&setTimeout(function(){if(e.broadcastBuffer.length>0){var t=e.broadcastBuffer;t.setUint32(e.broadcastBufferSizePos,e.broadcastBufferSize),e.broadcast(t.createBuffer()),e.broadcastBuffer=new jt}},0)}},{key:"whenRemoteResponsive",value:function(){return new Promise(function(t){setTimeout(t,100)})}},{key:"receiveMessage",value:function(t,e,n){var r=this,i=this.y,o=i.userID;if(n=n||!1,!(e instanceof ArrayBuffer||e instanceof Uint8Array))return Promise.reject(new Error("Expected Message to be an ArrayBuffer or Uint8Array!"));if(t===o)return Promise.resolve();var a=new Nt(e),s=new jt,l=a.readVarString();s.writeVarString(l);var u=a.readVarString(),c=this.connections.get(t);if(this.log("User%s from User%s: Receive '%s'",o,t,u),this.logMessage("User%s from User%s: Receive %Y",o,t,[i,e]),null==c&&!n)throw new Error("Received message from unknown peer!");if("sync step 1"===u||"sync step 2"===u){var h=a.readVarUint();if(null==c.auth)return c.processAfterAuth.push([u,c,a,s,t]),this.checkAuth(h,i,t).then(function(t){null==c.auth&&(c.auth=t,i.emit("userAuthenticated",{user:c.uid,auth:t}));var e=c.processAfterAuth;c.processAfterAuth=[],e.forEach(function(t){return r.computeMessage(t[0],t[1],t[2],t[3],t[4])})})}!n&&null==c.auth||"update"===u&&!c.isSynced?c.processAfterSync.push([u,c,a,s,t,!1]):this.computeMessage(u,c,a,s,t,n)}},{key:"computeMessage",value:function(t,e,n,i,o,a){if("sync step 1"!==t||"write"!==e.auth&&"read"!==e.auth){var s=this.y;s.transact(function(){if("sync step 2"===t&&"write"===e.auth)d(n,i,s,e,o);else{if("update"!==t||!a&&"write"!==e.auth)throw new Error("Unable to receive message");r(s,n)}},!0)}else h(n,i,this.y,e,o)}},{key:"_setSyncedWith",value:function(t){var e=this;if(null!=t){var n=this.connections.get(t);n.isSynced=!0;var r=n.processAfterSync;n.processAfterSync=[],r.forEach(function(t){e.computeMessage(t[0],t[1],t[2],t[3],t[4])})}var i=Array.from(this.connections.values());i.length>0&&i.every(function(t){return t.isSynced})&&this._fireIsSyncedListeners()}}]),t}()),he=function(){function t(e){bt(this,t),this.opts=e,this.ys=new Map}return wt(t,[{key:"_init",value:function(t){var e=this,n=this.ys.get(t);return void 0===n?(n=vt(),n.mutualExclude=Z(),this.ys.set(t,n),this.init(t).then(function(){return t.on("afterTransaction",function(t,n){var r=e.ys.get(t);if(r.len>0){r.buffer.setUint32(0,r.len),e.saveUpdate(t,r.buffer.createBuffer(),n);var i=vt();for(var o in i)r[o]=i[o]}}),e.retrieve(t)}).then(function(){return Promise.resolve(n)})):Promise.resolve(n)}},{key:"deinit",value:function(t){this.ys.delete(t),t.persistence=null}},{key:"destroy",value:function(){this.ys=null}},{key:"removePersistedData",value:function(t){var e=this,n=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];this.ys.forEach(function(r,i){i.room===t&&(n?i.destroy():e.deinit(i))})}},{key:"saveUpdate",value:function(t){}},{key:"saveStruct",value:function(t,e){var n=this.ys.get(t);void 0!==n&&n.mutualExclude(function(){e._toBinary(n.buffer),n.len++})}},{key:"retrieve",value:function(t,e,n){var i=this.ys.get(t);void 0!==i&&i.mutualExclude(function(){t.transact(function(){if(null!=e&&dt(t,new Nt(new Uint8Array(e))),null!=n)for(var i=0;i<n.length;i++)r(t,new Nt(new Uint8Array(n[i])))}),t.emit("persistenceReady")})}},{key:"persist",value:function(t){return _t(t).createBuffer()}}]),t}(),fe=function(t){function e(t,n){bt(this,e);var r=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.value=t.toString(),r._typeObserver=pt.bind(r),r._domObserver=yt.bind(r),t.observe(r._typeObserver),n.addEventListener("input",r._domObserver),r}return Ot(e,t),wt(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._domObserver),St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}($t),de=function(t){function e(t,n){bt(this,e);var r=Et(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setContents(t.toDelta(),"yjs"),r._typeObserver=gt.bind(r),r._quillObserver=mt.bind(r),t.observe(r._typeObserver),n.on("text-change",r._quillObserver),r}return Ot(e,t),wt(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.off("text-change",this._quillObserver),St(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}($t);return Y.AbstractConnector=ce,Y.AbstractPersistence=he,Y.Array=YArray,Y.Map=YMap,Y.Text=YText,Y.XmlElement=YXmlElement,Y.XmlFragment=YXmlFragment,Y.XmlText=YXmlText,Y.XmlHook=YXmlHook,Y.TextareaBinding=fe,Y.QuillBinding=de,Y.DomBinding=Kt,Kt.domToType=L,Kt.domsToTypes=W,Kt.switchAssociation=H,Y.utils={BinaryDecoder:Nt,UndoManager:ee,getRelativePosition:Q,fromRelativePosition:K,registerStruct:q,integrateRemoteStructs:r,toBinary:_t,fromBinary:dt},Y.debug=ue,ue.formatters.Y=_,ue.formatters.y=v,Y});


}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":4,"buffer":2}],13:[function(require,module,exports){
const Y = require('yjs2');
require('y-memory')(Y);
require('y-webrtc3')(Y);
require('y-array2')(Y);
require('y-map2')(Y);
require('y-text2')(Y);
require('y-xml2')(Y);

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'webrtc',
    //name: 'websockets-client',
    room: 'room',
    url: 'http://finwin.io:1256'
  },
  share: {
    codemirror: 'Text',
    codemirror2: 'Text',
    codemirror3: 'Text',
    codemirror4: 'Text',
    codemirror5: 'Text',
    codemirror6: 'Text',
    codemirror7: 'Text',
    codemirror8: 'Text',
    codemirror9: 'Text',
    codemirror10: 'Text',
    xml: 'Xml',
    xml2: 'Xml',
    xml3: 'Xml',
    xml4: 'Xml',
    xml5: 'Xml',
    xml6: 'Xml',
    xml7: 'Xml',
    xml8: 'Xml',
    xml9: 'Xml',
    xml10: 'Xml'
  }
}).then(function (y) {
    console.log('############');
    window.yXml = y;
    y.share.codemirror.bind(window.shared_elements['codemirror']);
    y.share.codemirror2.bind(window.shared_elements['codemirror2']);
    y.share.codemirror3.bind(window.shared_elements['codemirror3']);
    y.share.codemirror4.bind(window.shared_elements['codemirror4']);
    y.share.codemirror5.bind(window.shared_elements['codemirror5']);
    y.share.codemirror6.bind(window.shared_elements['codemirror6']);
    y.share.codemirror7.bind(window.shared_elements['codemirror7']);
    y.share.codemirror8.bind(window.shared_elements['codemirror8']);
    y.share.codemirror9.bind(window.shared_elements['codemirror9']);
    y.share.codemirror10.bind(window.shared_elements['codemirror10']);
    y.share.xml._bindToDom(window.shared_elements['xml']);
    y.share.xml2._bindToDom(window.shared_elements['xml2']);
    y.share.xml3._bindToDom(window.shared_elements['xml3']);
    y.share.xml4._bindToDom(window.shared_elements['xml4']);
    y.share.xml5._bindToDom(window.shared_elements['xml5']);
    y.share.xml6._bindToDom(window.shared_elements['xml6']);
    y.share.xml7._bindToDom(window.shared_elements['xml7']);
    y.share.xml8._bindToDom(window.shared_elements['xml8']);
    y.share.xml9._bindToDom(window.shared_elements['xml9']);
    y.share.xml10._bindToDom(window.shared_elements['xml10']);
})

},{"y-array2":5,"y-map2":6,"y-memory":7,"y-text2":9,"y-webrtc3":10,"y-xml2":11,"yjs2":12}]},{},[13])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy95LWFycmF5Mi95LWFycmF5LmpzIiwibm9kZV9tb2R1bGVzL3ktbWFwMi95LW1hcC5qcyIsIm5vZGVfbW9kdWxlcy95LW1lbW9yeS9zcmMvTWVtb3J5LmpzIiwibm9kZV9tb2R1bGVzL3ktbWVtb3J5L3NyYy9SZWRCbGFja1RyZWUuanMiLCJub2RlX21vZHVsZXMveS10ZXh0Mi95LXRleHQuanMiLCJub2RlX21vZHVsZXMveS13ZWJydGMzL3NyYy9XZWJSVEMuanMiLCJub2RlX21vZHVsZXMveS14bWwyL3kteG1sLmpzIiwibm9kZV9tb2R1bGVzL3lqczIveS5qcyIsInNyYy9hcHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxudmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbmZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG59XG5cbi8vIFN1cHBvcnQgZGVjb2RpbmcgVVJMLXNhZmUgYmFzZTY0IHN0cmluZ3MsIGFzIE5vZGUuanMgZG9lcy5cbi8vIFNlZTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmFzZTY0I1VSTF9hcHBsaWNhdGlvbnNcbnJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxucmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG5cbmZ1bmN0aW9uIGdldExlbnMgKGI2NCkge1xuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyBUcmltIG9mZiBleHRyYSBieXRlcyBhZnRlciBwbGFjZWhvbGRlciBieXRlcyBhcmUgZm91bmRcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmVhdGdhbW1pdC9iYXNlNjQtanMvaXNzdWVzLzQyXG4gIHZhciB2YWxpZExlbiA9IGI2NC5pbmRleE9mKCc9JylcbiAgaWYgKHZhbGlkTGVuID09PSAtMSkgdmFsaWRMZW4gPSBsZW5cblxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gdmFsaWRMZW4gPT09IGxlblxuICAgID8gMFxuICAgIDogNCAtICh2YWxpZExlbiAlIDQpXG5cbiAgcmV0dXJuIFt2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuXVxufVxuXG4vLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKGI2NCkge1xuICB2YXIgbGVucyA9IGdldExlbnMoYjY0KVxuICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdXG4gIHJldHVybiAoKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0KSAtIHBsYWNlSG9sZGVyc0xlblxufVxuXG5mdW5jdGlvbiBfYnl0ZUxlbmd0aCAoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSB7XG4gIHJldHVybiAoKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0KSAtIHBsYWNlSG9sZGVyc0xlblxufVxuXG5mdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NClcbiAgdmFyIHZhbGlkTGVuID0gbGVuc1swXVxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXVxuXG4gIHZhciBhcnIgPSBuZXcgQXJyKF9ieXRlTGVuZ3RoKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikpXG5cbiAgdmFyIGN1ckJ5dGUgPSAwXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICB2YXIgbGVuID0gcGxhY2VIb2xkZXJzTGVuID4gMFxuICAgID8gdmFsaWRMZW4gLSA0XG4gICAgOiB2YWxpZExlblxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHxcbiAgICAgIHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAyKSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMSkge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArXG4gICAgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9XG4gICAgICAoKHVpbnQ4W2ldIDw8IDE2KSAmIDB4RkYwMDAwKSArXG4gICAgICAoKHVpbnQ4W2kgKyAxXSA8PCA4KSAmIDB4RkYwMCkgK1xuICAgICAgKHVpbnQ4W2kgKyAyXSAmIDB4RkYpXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsoXG4gICAgICB1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpXG4gICAgKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBsb29rdXBbdG1wID4+IDJdICtcbiAgICAgIGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl0gK1xuICAgICAgJz09J1xuICAgIClcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgdWludDhbbGVuIC0gMV1cbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgbG9va3VwW3RtcCA+PiAxMF0gK1xuICAgICAgbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXSArXG4gICAgICBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdICtcbiAgICAgICc9J1xuICAgIClcbiAgfVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8aHR0cHM6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbnZhciBLX01BWF9MRU5HVEggPSAweDdmZmZmZmZmXG5leHBvcnRzLmtNYXhMZW5ndGggPSBLX01BWF9MRU5HVEhcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgUHJpbnQgd2FybmluZyBhbmQgcmVjb21tZW5kIHVzaW5nIGBidWZmZXJgIHY0Lnggd2hpY2ggaGFzIGFuIE9iamVjdFxuICogICAgICAgICAgICAgICBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogV2UgcmVwb3J0IHRoYXQgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0eXBlZCBhcnJheXMgaWYgdGhlIGFyZSBub3Qgc3ViY2xhc3NhYmxlXG4gKiB1c2luZyBfX3Byb3RvX18uIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgXG4gKiAoU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzgpLiBJRSAxMCBsYWNrcyBzdXBwb3J0XG4gKiBmb3IgX19wcm90b19fIGFuZCBoYXMgYSBidWdneSB0eXBlZCBhcnJheSBpbXBsZW1lbnRhdGlvbi5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgY29uc29sZS5lcnJvcihcbiAgICAnVGhpcyBicm93c2VyIGxhY2tzIHR5cGVkIGFycmF5IChVaW50OEFycmF5KSBzdXBwb3J0IHdoaWNoIGlzIHJlcXVpcmVkIGJ5ICcgK1xuICAgICdgYnVmZmVyYCB2NS54LiBVc2UgYGJ1ZmZlcmAgdjQueCBpZiB5b3UgcmVxdWlyZSBvbGQgYnJvd3NlciBzdXBwb3J0LidcbiAgKVxufVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIC8vIENhbiB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZD9cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuX19wcm90b19fID0ge19fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfX1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MlxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlci5wcm90b3R5cGUsICdwYXJlbnQnLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ1ZmZlclxuICB9XG59KVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLnByb3RvdHlwZSwgJ29mZnNldCcsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnl0ZU9mZnNldFxuICB9XG59KVxuXG5mdW5jdGlvbiBjcmVhdGVCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAobGVuZ3RoID4gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgdHlwZWQgYXJyYXkgbGVuZ3RoJylcbiAgfVxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZnVuY3Rpb24gQnVmZmVyIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZ09yT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnSWYgZW5jb2RpbmcgaXMgc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcnXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZShhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20oYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG5pZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICB2YWx1ZTogbnVsbCxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgd3JpdGFibGU6IGZhbHNlXG4gIH0pXG59XG5cbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG5mdW5jdGlvbiBmcm9tICh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIGEgbnVtYmVyJylcbiAgfVxuXG4gIGlmIChpc0FycmF5QnVmZmVyKHZhbHVlKSB8fCAodmFsdWUgJiYgaXNBcnJheUJ1ZmZlcih2YWx1ZS5idWZmZXIpKSkge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIoc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuXG4gIHZhciBhY3R1YWwgPSBidWYud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIGJ1ZiA9IGJ1Zi5zbGljZSgwLCBhY3R1YWwpXG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICBidWZbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyIChhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmIChieXRlT2Zmc2V0IDwgMCB8fCBhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcIm9mZnNldFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQgKyAobGVuZ3RoIHx8IDApKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wibGVuZ3RoXCIgaXMgb3V0c2lkZSBvZiBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIHZhciBidWZcbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQpXG4gIH0gZWxzZSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAob2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuKVxuXG4gICAgaWYgKGJ1Zi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBidWZcbiAgICB9XG5cbiAgICBvYmouY29weShidWYsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gYnVmXG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhvYmopIHx8ICdsZW5ndGgnIGluIG9iaikge1xuICAgICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBudW1iZXJJc05hTihvYmoubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVmZmVyKDApXG4gICAgICB9XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZShvYmopXG4gICAgfVxuXG4gICAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBBcnJheS5pc0FycmF5KG9iai5kYXRhKSkge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqLmRhdGEpXG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgQXJyYXktbGlrZSBPYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IEtfTUFYX0xFTkdUSGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsgS19NQVhfTEVOR1RILnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyID09PSB0cnVlXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBCdWZmZXIuYWxsb2MoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGJ1ZiA9IGxpc3RbaV1cbiAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGJ1ZikpIHtcbiAgICAgIGJ1ZiA9IEJ1ZmZlci5mcm9tKGJ1ZilcbiAgICB9XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgaXNBcnJheUJ1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhpcyBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIChhbmQgdGhlIGBpcy1idWZmZXJgIG5wbSBwYWNrYWdlKVxuLy8gdG8gZGV0ZWN0IGEgQnVmZmVyIGluc3RhbmNlLiBJdCdzIG5vdCBwb3NzaWJsZSB0byB1c2UgYGluc3RhbmNlb2YgQnVmZmVyYFxuLy8gcmVsaWFibHkgaW4gYSBicm93c2VyaWZ5IGNvbnRleHQgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBtdWx0aXBsZSBkaWZmZXJlbnRcbi8vIGNvcGllcyBvZiB0aGUgJ2J1ZmZlcicgcGFja2FnZSBpbiB1c2UuIFRoaXMgbWV0aG9kIHdvcmtzIGV2ZW4gZm9yIEJ1ZmZlclxuLy8gaW5zdGFuY2VzIHRoYXQgd2VyZSBjcmVhdGVkIGZyb20gYW5vdGhlciBjb3B5IG9mIHRoZSBgYnVmZmVyYCBwYWNrYWdlLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMTU0XG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXA2NCA9IGZ1bmN0aW9uIHN3YXA2NCAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgOCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gOCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDcpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDYpXG4gICAgc3dhcCh0aGlzLCBpICsgMiwgaSArIDUpXG4gICAgc3dhcCh0aGlzLCBpICsgMywgaSArIDQpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvTG9jYWxlU3RyaW5nID0gQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZ1xuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAodGFyZ2V0LCBzdGFydCwgZW5kLCB0aGlzU3RhcnQsIHRoaXNFbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbi8vIEZpbmRzIGVpdGhlciB0aGUgZmlyc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0ID49IGBieXRlT2Zmc2V0YCxcbi8vIE9SIHRoZSBsYXN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA8PSBgYnl0ZU9mZnNldGAuXG4vL1xuLy8gQXJndW1lbnRzOlxuLy8gLSBidWZmZXIgLSBhIEJ1ZmZlciB0byBzZWFyY2hcbi8vIC0gdmFsIC0gYSBzdHJpbmcsIEJ1ZmZlciwgb3IgbnVtYmVyXG4vLyAtIGJ5dGVPZmZzZXQgLSBhbiBpbmRleCBpbnRvIGBidWZmZXJgOyB3aWxsIGJlIGNsYW1wZWQgdG8gYW4gaW50MzJcbi8vIC0gZW5jb2RpbmcgLSBhbiBvcHRpb25hbCBlbmNvZGluZywgcmVsZXZhbnQgaXMgdmFsIGlzIGEgc3RyaW5nXG4vLyAtIGRpciAtIHRydWUgZm9yIGluZGV4T2YsIGZhbHNlIGZvciBsYXN0SW5kZXhPZlxuZnVuY3Rpb24gYmlkaXJlY3Rpb25hbEluZGV4T2YgKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIC8vIEVtcHR5IGJ1ZmZlciBtZWFucyBubyBtYXRjaFxuICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXRcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPSArYnl0ZU9mZnNldCAgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKG51bWJlcklzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKG51bWJlcklzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBsYXRpbjFXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoID4+PiAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgKGJ5dGVzW2kgKyAxXSAqIDI1NikpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCAoOCAqIGJ5dGVMZW5ndGgpIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2FyZ3VtZW50IHNob3VsZCBiZSBhIEJ1ZmZlcicpXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5jb3B5V2l0aGluID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gVXNlIGJ1aWx0LWluIHdoZW4gYXZhaWxhYmxlLCBtaXNzaW5nIGZyb20gSUUxMVxuICAgIHRoaXMuY29weVdpdGhpbih0YXJnZXRTdGFydCwgc3RhcnQsIGVuZClcbiAgfSBlbHNlIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAodmFyIGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKChlbmNvZGluZyA9PT0gJ3V0ZjgnICYmIGNvZGUgPCAxMjgpIHx8XG4gICAgICAgICAgZW5jb2RpbmcgPT09ICdsYXRpbjEnKSB7XG4gICAgICAgIC8vIEZhc3QgcGF0aDogSWYgYHZhbGAgZml0cyBpbnRvIGEgc2luZ2xlIGJ5dGUsIHVzZSB0aGF0IG51bWVyaWMgdmFsdWUuXG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiBuZXcgQnVmZmVyKHZhbCwgZW5jb2RpbmcpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSB2YWx1ZSBcIicgKyB2YWwgK1xuICAgICAgICAnXCIgaXMgaW52YWxpZCBmb3IgYXJndW1lbnQgXCJ2YWx1ZVwiJylcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyArK2kpIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSB0YWtlcyBlcXVhbCBzaWducyBhcyBlbmQgb2YgdGhlIEJhc2U2NCBlbmNvZGluZ1xuICBzdHIgPSBzdHIuc3BsaXQoJz0nKVswXVxuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyLnRyaW0oKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbi8vIEFycmF5QnVmZmVycyBmcm9tIGFub3RoZXIgY29udGV4dCAoaS5lLiBhbiBpZnJhbWUpIGRvIG5vdCBwYXNzIHRoZSBgaW5zdGFuY2VvZmAgY2hlY2tcbi8vIGJ1dCB0aGV5IHNob3VsZCBiZSB0cmVhdGVkIGFzIHZhbGlkLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNjZcbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIgKG9iaikge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHxcbiAgICAob2JqICE9IG51bGwgJiYgb2JqLmNvbnN0cnVjdG9yICE9IG51bGwgJiYgb2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdBcnJheUJ1ZmZlcicgJiZcbiAgICAgIHR5cGVvZiBvYmouYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpXG59XG5cbmZ1bmN0aW9uIG51bWJlcklzTmFOIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPT0gb2JqIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IChlICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IChtICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKCh2YWx1ZSAqIGMpIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyoqXG4gKiB5LWFycmF5MiAtIEFycmF5IFR5cGUgZm9yIFlqc1xuICogQHZlcnNpb24gdjEuNS4wXG4gKiBAbGljZW5zZSBNSVRcbiAqL1xuIWZ1bmN0aW9uKHQsZSl7XCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGU/bW9kdWxlLmV4cG9ydHM9ZSgpOlwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZD9kZWZpbmUoZSk6dC55QXJyYXk9ZSgpfSh0aGlzLGZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gdCh0KXt0LnV0aWxzLnlhcnJheUV2ZW50SGFuZGxlcj1mdW5jdGlvbihlKXt2YXIgbj10aGlzO2lmKFwiSW5zZXJ0XCI9PT1lLnN0cnVjdCl7aWYodGhpcy5fY29udGVudC5zb21lKGZ1bmN0aW9uKG4pe3JldHVybiB0LnV0aWxzLmNvbXBhcmVJZHMobi5pZCxlLmlkKX0pKXJldHVybjt2YXIgcj12b2lkIDA7aWYobnVsbD09PWUubGVmdClyPTA7ZWxzZSBpZigocj0xK3RoaXMuX2NvbnRlbnQuZmluZEluZGV4KGZ1bmN0aW9uKG4pe3JldHVybiB0LnV0aWxzLmNvbXBhcmVJZHMobi5pZCxlLmxlZnQpfSkpPD0wKXRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb3BlcmF0aW9uIVwiKTt2YXIgaSxvO2lmKGUuaGFzT3duUHJvcGVydHkoXCJvcENvbnRlbnRcIikpe3RoaXMuX2NvbnRlbnQuc3BsaWNlKHIsMCx7aWQ6ZS5pZCx0eXBlOmUub3BDb250ZW50fSksbz0xO3ZhciBzPXRoaXMub3MuZ2V0VHlwZShlLm9wQ29udGVudCk7cy5fcGFyZW50PXRoaXMuX21vZGVsLGk9W3NdfWVsc2V7dmFyIGw9ZS5jb250ZW50Lm1hcChmdW5jdGlvbih0LG4pe3JldHVybntpZDpbZS5pZFswXSxlLmlkWzFdK25dLHZhbDp0fX0pO2wubGVuZ3RoPDNlND90aGlzLl9jb250ZW50LnNwbGljZS5hcHBseSh0aGlzLl9jb250ZW50LFtyLDBdLmNvbmNhdChsKSk6dGhpcy5fY29udGVudD10aGlzLl9jb250ZW50LnNsaWNlKDAscikuY29uY2F0KGwpLmNvbmNhdCh0aGlzLl9jb250ZW50LnNsaWNlKHIpKSxpPWUuY29udGVudCxvPWUuY29udGVudC5sZW5ndGh9dC51dGlscy5idWJibGVFdmVudCh0aGlzLHt0eXBlOlwiaW5zZXJ0XCIsb2JqZWN0OnRoaXMsaW5kZXg6cix2YWx1ZXM6aSxsZW5ndGg6b30pfWVsc2V7aWYoXCJEZWxldGVcIiE9PWUuc3RydWN0KXRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgc3RydWN0IVwiKTtmb3IodmFyIGE9MDthPHRoaXMuX2NvbnRlbnQubGVuZ3RoJiZlLmxlbmd0aD4wO2ErKyl7dmFyIHU9dGhpcy5fY29udGVudFthXTtpZih0LnV0aWxzLmluRGVsZXRpb25SYW5nZShlLHUuaWQpKXt2YXIgYztmb3IoYz0xO2M8ZS5sZW5ndGgmJmErYzx0aGlzLl9jb250ZW50Lmxlbmd0aCYmdC51dGlscy5pbkRlbGV0aW9uUmFuZ2UoZSx0aGlzLl9jb250ZW50W2ErY10uaWQpO2MrKyk7dT10aGlzLl9jb250ZW50W2ErYy0xXSxlLmxlbmd0aC09dS5pZFsxXS1lLnRhcmdldFsxXSsxLGUudGFyZ2V0PVt1LmlkWzBdLHUuaWRbMV0rMV07dmFyIGg9dGhpcy5fY29udGVudC5zcGxpY2UoYSxjKSxmPWgubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBudWxsIT10LnZhbD90LnZhbDpuLm9zLmdldFR5cGUodC50eXBlKX0pO3QudXRpbHMuYnViYmxlRXZlbnQodGhpcyx7dHlwZTpcImRlbGV0ZVwiLG9iamVjdDp0aGlzLGluZGV4OmEsdmFsdWVzOmYsX2NvbnRlbnQ6aCxsZW5ndGg6Y30pfX19fTt2YXIgbz1mdW5jdGlvbihvKXtmdW5jdGlvbiBzKG4scixvKXtlKHRoaXMscyk7dmFyIGw9aSh0aGlzLChzLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKHMpKS5jYWxsKHRoaXMpKTtyZXR1cm4gbC5vcz1uLGwuX21vZGVsPXIsbC5fY29udGVudD1vLGwuX3BhcmVudD1udWxsLGwuX2RlZXBFdmVudEhhbmRsZXI9bmV3IHQudXRpbHMuRXZlbnRMaXN0ZW5lckhhbmRsZXIsbC5ldmVudEhhbmRsZXI9bmV3IHQudXRpbHMuRXZlbnRIYW5kbGVyKHQudXRpbHMueWFycmF5RXZlbnRIYW5kbGVyLmJpbmQobCkpLGx9cmV0dXJuIHIocyxvKSxuKHMsW3trZXk6XCJfZ2V0UGF0aFRvQ2hpbGRcIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5fY29udGVudC5maW5kSW5kZXgoZnVuY3Rpb24obil7cmV0dXJuIG51bGwhPW4udHlwZSYmdC51dGlscy5jb21wYXJlSWRzKG4udHlwZSxlKX0pfX0se2tleTpcIl9kZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50SGFuZGxlci5kZXN0cm95KCksdGhpcy5ldmVudEhhbmRsZXI9bnVsbCx0aGlzLl9jb250ZW50PW51bGwsdGhpcy5fbW9kZWw9bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbCx0aGlzLm9zPW51bGx9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO3JldHVybiB0aGlzLl9jb250ZW50Lm1hcChmdW5jdGlvbihlKXtpZihudWxsIT1lLnR5cGUpe3ZhciBuPXQub3MuZ2V0VHlwZShlLnR5cGUpO3JldHVybiBudWxsIT1uLnRvSlNPTj9uLnRvSlNPTigpOm51bGwhPW4udG9TdHJpbmc/bi50b1N0cmluZygpOnZvaWQgMH1yZXR1cm4gZS52YWx9KX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsPT10fHxcIm51bWJlclwiIT10eXBlb2YgdCl0aHJvdyBuZXcgRXJyb3IoXCJwb3MgbXVzdCBiZSBhIG51bWJlciFcIik7aWYoISh0Pj10aGlzLl9jb250ZW50Lmxlbmd0aCkpcmV0dXJuIG51bGw9PXRoaXMuX2NvbnRlbnRbdF0udHlwZT90aGlzLl9jb250ZW50W3RdLnZhbDp0aGlzLm9zLmdldFR5cGUodGhpcy5fY29udGVudFt0XS50eXBlKX19LHtrZXk6XCJ0b0FycmF5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO3JldHVybiB0aGlzLl9jb250ZW50Lm1hcChmdW5jdGlvbihlLG4pe3JldHVybiBudWxsIT1lLnR5cGU/dC5vcy5nZXRUeXBlKGUudHlwZSk6ZS52YWx9KX19LHtrZXk6XCJwdXNoXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMuaW5zZXJ0KHRoaXMuX2NvbnRlbnQubGVuZ3RoLHQpfX0se2tleTpcImluc2VydFwiLHZhbHVlOmZ1bmN0aW9uKGUsbil7aWYoXCJudW1iZXJcIiE9dHlwZW9mIGUpdGhyb3cgbmV3IEVycm9yKFwicG9zIG11c3QgYmUgYSBudW1iZXIhXCIpO2lmKCFBcnJheS5pc0FycmF5KG4pKXRocm93IG5ldyBFcnJvcihcImNvbnRlbnRzIG11c3QgYmUgYW4gQXJyYXkgb2Ygb2JqZWN0cyFcIik7aWYoMCE9PW4ubGVuZ3RoKXtpZihlPnRoaXMuX2NvbnRlbnQubGVuZ3RofHxlPDApdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBwb3NpdGlvbiBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgYXJyYXkhXCIpO2Zvcih2YXIgcj0wPT09ZT9udWxsOnRoaXMuX2NvbnRlbnRbZS0xXS5pZCxpPVtdLG89cixzPTA7czxuLmxlbmd0aDspe2Zvcih2YXIgbCxhPXtsZWZ0Om8sb3JpZ2luOm8scGFyZW50OnRoaXMuX21vZGVsLHN0cnVjdDpcIkluc2VydFwifSx1PVtdO3M8bi5sZW5ndGg7KXt2YXIgYz1uW3MrK107aWYobD10LnV0aWxzLmlzVHlwZURlZmluaXRpb24oYykpe2lmKHUubGVuZ3RoPjApe3MtLTticmVha31icmVha311LnB1c2goYyl9aWYodS5sZW5ndGg+MClhLmNvbnRlbnQ9dSxhLmlkPXRoaXMub3MuZ2V0TmV4dE9wSWQodS5sZW5ndGgpO2Vsc2V7dmFyIGg9dGhpcy5vcy5nZXROZXh0T3BJZCgxKTt0aGlzLm9zLmNyZWF0ZVR5cGUobCxoKSxhLm9wQ29udGVudD1oLGEuaWQ9dGhpcy5vcy5nZXROZXh0T3BJZCgxKX1pLnB1c2goYSksbz1hLmlkfXZhciBmPXRoaXMuZXZlbnRIYW5kbGVyO3RoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uKCl7dmFyIHQ7aWYobnVsbCE9cil7dD10aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKHIpLnJpZ2h0fWVsc2UgdD10aGlzLmdldE9wZXJhdGlvbihpWzBdLnBhcmVudCkuc3RhcnQ7Zm9yKHZhciBlPTA7ZTxpLmxlbmd0aDtlKyspe2lbZV0ucmlnaHQ9dH1mLmF3YWl0T3BzKHRoaXMsdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLFtpXSl9KSxmLmF3YWl0QW5kUHJlbWF0dXJlbHlDYWxsKGkpfX19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbihlLG4pe2lmKG51bGw9PW4mJihuPTEpLFwibnVtYmVyXCIhPXR5cGVvZiBuKXRocm93IG5ldyBFcnJvcihcImxlbmd0aCBtdXN0IGJlIGEgbnVtYmVyIVwiKTtpZihcIm51bWJlclwiIT10eXBlb2YgZSl0aHJvdyBuZXcgRXJyb3IoXCJwb3MgbXVzdCBiZSBhIG51bWJlciFcIik7aWYoZStuPnRoaXMuX2NvbnRlbnQubGVuZ3RofHxlPDB8fG48MCl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZGVsZXRpb24gcmFuZ2UgZXhjZWVkcyB0aGUgcmFuZ2Ugb2YgdGhlIGFycmF5IVwiKTtpZigwIT09bil7Zm9yKHZhciByLGk9dGhpcy5ldmVudEhhbmRsZXIsbz1bXSxzPTA7czxuO3MrPXIpe3ZhciBsPXRoaXMuX2NvbnRlbnRbZStzXS5pZDtmb3Iocj0xO3MrcjxuJiZ0LnV0aWxzLmNvbXBhcmVJZHModGhpcy5fY29udGVudFtlK3Mrcl0uaWQsW2xbMF0sbFsxXStyXSk7cisrKTtvLnB1c2goe3RhcmdldDpsLHN0cnVjdDpcIkRlbGV0ZVwiLGxlbmd0aDpyfSl9dGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24oKXtpLmF3YWl0T3BzKHRoaXMsdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLFtvXSl9KSxpLmF3YWl0QW5kUHJlbWF0dXJlbHlDYWxsKG8pfX19LHtrZXk6XCJvYnNlcnZlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5ldmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJvYnNlcnZlRGVlcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2RlZXBFdmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJ1bm9ic2VydmVcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmV2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwiX2NoYW5nZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKCFlLmRlbGV0ZWQpe2lmKFwiSW5zZXJ0XCI9PT1lLnN0cnVjdCl7Zm9yKHZhciBuLHI9ZS5sZWZ0O251bGwhPXImJihuPXQuZ2V0SW5zZXJ0aW9uKHIpLG4uZGVsZXRlZCk7KXI9bi5sZWZ0O2UubGVmdD1yLG51bGwhPWUub3BDb250ZW50JiZ0LnN0b3JlLmluaXRUeXBlLmNhbGwodCxlLm9wQ29udGVudCl9dGhpcy5ldmVudEhhbmRsZXIucmVjZWl2ZWRPcChlKX19fSx7a2V5OlwibGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2NvbnRlbnQubGVuZ3RofX1dKSxzfSh0LnV0aWxzLkN1c3RvbVR5cGUpO3QuZXh0ZW5kKFwiQXJyYXlcIixuZXcgdC51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbih7bmFtZTpcIkFycmF5XCIsY2xhc3M6byxzdHJ1Y3Q6XCJMaXN0XCIsaW5pdFR5cGU6ZnVuY3Rpb24oZSxuKXt2YXIgcj1bXSxpPVtdO3QuU3RydWN0Lkxpc3QubWFwLmNhbGwodGhpcyxuLGZ1bmN0aW9uKHQpe3QuaGFzT3duUHJvcGVydHkoXCJvcENvbnRlbnRcIik/KHIucHVzaCh7aWQ6dC5pZCx0eXBlOnQub3BDb250ZW50fSksaS5wdXNoKHQub3BDb250ZW50KSk6dC5jb250ZW50LmZvckVhY2goZnVuY3Rpb24oZSxuKXtyLnB1c2goe2lkOlt0LmlkWzBdLHQuaWRbMV0rbl0sdmFsOnQuY29udGVudFtuXX0pfSl9KTtmb3IodmFyIHM9MDtzPGkubGVuZ3RoO3MrKyl7dGhpcy5zdG9yZS5pbml0VHlwZS5jYWxsKHRoaXMsaVtzXSkuX3BhcmVudD1uLmlkfXJldHVybiBuZXcgbyhlLG4uaWQscil9LGNyZWF0ZVR5cGU6ZnVuY3Rpb24odCxlKXtyZXR1cm4gbmV3IG8odCxlLmlkLFtdKX19KSl9dmFyIGU9ZnVuY3Rpb24odCxlKXtpZighKHQgaW5zdGFuY2VvZiBlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpfSxuPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCh0LGUpe2Zvcih2YXIgbj0wO248ZS5sZW5ndGg7bisrKXt2YXIgcj1lW25dO3IuZW51bWVyYWJsZT1yLmVudW1lcmFibGV8fCExLHIuY29uZmlndXJhYmxlPSEwLFwidmFsdWVcImluIHImJihyLndyaXRhYmxlPSEwKSxPYmplY3QuZGVmaW5lUHJvcGVydHkodCxyLmtleSxyKX19cmV0dXJuIGZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gbiYmdChlLnByb3RvdHlwZSxuKSxyJiZ0KGUsciksZX19KCkscj1mdW5jdGlvbih0LGUpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUmJm51bGwhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiBlKTt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGUmJmUucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6dCxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSxlJiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZih0LGUpOnQuX19wcm90b19fPWUpfSxpPWZ1bmN0aW9uKHQsZSl7aWYoIXQpdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO3JldHVybiFlfHxcIm9iamVjdFwiIT10eXBlb2YgZSYmXCJmdW5jdGlvblwiIT10eXBlb2YgZT90OmV9O3JldHVyblwidW5kZWZpbmVkXCIhPXR5cGVvZiBZJiZ0KFkpLHR9KTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXktYXJyYXkuanMubWFwXG4iLCIvKipcbiAqIHktbWFwMiAtIE1hcCBUeXBlIGZvciBZanNcbiAqIEB2ZXJzaW9uIHYxLjUuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbiFmdW5jdGlvbihlLHQpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPXQoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKHQpOmUueU1hcD10KCl9KHRoaXMsZnVuY3Rpb24oKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBlKGUpe3ZhciByPWZ1bmN0aW9uKHIpe2Z1bmN0aW9uIHMobixvLHIsdSl7dCh0aGlzLHMpO3ZhciBsPWkodGhpcywocy5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihzKSkuY2FsbCh0aGlzKSk7cmV0dXJuIGwuX21vZGVsPW8uaWQsbC5fcGFyZW50PW51bGwsbC5fZGVlcEV2ZW50SGFuZGxlcj1uZXcgZS51dGlscy5FdmVudExpc3RlbmVySGFuZGxlcixsLm9zPW4sbC5tYXA9ZS51dGlscy5jb3B5T2JqZWN0KG8ubWFwKSxsLmNvbnRlbnRzPXIsbC5vcENvbnRlbnRzPXUsbC5ldmVudEhhbmRsZXI9bmV3IGUudXRpbHMuRXZlbnRIYW5kbGVyKGZ1bmN0aW9uKHQpe3ZhciBuLG89XCJEZWxldGVcIj09PXQuc3RydWN0P3Qua2V5OnQucGFyZW50U3ViO2lmKG49bnVsbCE9bC5vcENvbnRlbnRzW29dP2wub3MuZ2V0VHlwZShsLm9wQ29udGVudHNbb10pOmwuY29udGVudHNbb10sXCJJbnNlcnRcIj09PXQuc3RydWN0KXtpZihudWxsPT09dC5sZWZ0JiYhZS51dGlscy5jb21wYXJlSWRzKHQuaWQsbC5tYXBbb10pKXt2YXIgaTtudWxsIT10Lm9wQ29udGVudD8oaT1sLm9zLmdldFR5cGUodC5vcENvbnRlbnQpLGkuX3BhcmVudD1sLl9tb2RlbCxkZWxldGUgbC5jb250ZW50c1tvXSx0LmRlbGV0ZWQ/ZGVsZXRlIGwub3BDb250ZW50c1tvXTpsLm9wQ29udGVudHNbb109dC5vcENvbnRlbnQpOihpPXQuY29udGVudFswXSxkZWxldGUgbC5vcENvbnRlbnRzW29dLHQuZGVsZXRlZD9kZWxldGUgbC5jb250ZW50c1tvXTpsLmNvbnRlbnRzW29dPXQuY29udGVudFswXSksbC5tYXBbb109dC5pZCx2b2lkIDA9PT1uP2UudXRpbHMuYnViYmxlRXZlbnQobCx7bmFtZTpvLG9iamVjdDpsLHR5cGU6XCJhZGRcIix2YWx1ZTppfSk6ZS51dGlscy5idWJibGVFdmVudChsLHtuYW1lOm8sb2JqZWN0Omwsb2xkVmFsdWU6bix0eXBlOlwidXBkYXRlXCIsdmFsdWU6aX0pfX1lbHNle2lmKFwiRGVsZXRlXCIhPT10LnN0cnVjdCl0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIE9wZXJhdGlvbiFcIik7ZS51dGlscy5jb21wYXJlSWRzKGwubWFwW29dLHQudGFyZ2V0KSYmKGRlbGV0ZSBsLm9wQ29udGVudHNbb10sZGVsZXRlIGwuY29udGVudHNbb10sZS51dGlscy5idWJibGVFdmVudChsLHtuYW1lOm8sb2JqZWN0Omwsb2xkVmFsdWU6bix0eXBlOlwiZGVsZXRlXCJ9KSl9fSksbH1yZXR1cm4gbyhzLHIpLG4ocyxbe2tleTpcIl9nZXRQYXRoVG9DaGlsZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBuPXRoaXM7cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMub3BDb250ZW50cykuZmluZChmdW5jdGlvbihvKXtyZXR1cm4gZS51dGlscy5jb21wYXJlSWRzKG4ub3BDb250ZW50c1tvXSx0KX0pfX0se2tleTpcIl9kZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50SGFuZGxlci5kZXN0cm95KCksdGhpcy5ldmVudEhhbmRsZXI9bnVsbCx0aGlzLmNvbnRlbnRzPW51bGwsdGhpcy5vcENvbnRlbnRzPW51bGwsdGhpcy5fbW9kZWw9bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbCx0aGlzLm9zPW51bGwsdGhpcy5tYXA9bnVsbH19LHtrZXk6XCJ0b0pTT05cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciBlPXt9O2Zvcih2YXIgdCBpbiB0aGlzLmNvbnRlbnRzKWVbdF09dGhpcy5jb250ZW50c1t0XTtmb3IodmFyIG4gaW4gdGhpcy5vcENvbnRlbnRzKXt2YXIgbz10aGlzLm9zLmdldFR5cGUodGhpcy5vcENvbnRlbnRzW25dKTtudWxsIT1vLnRvSlNPTj9lW25dPW8udG9KU09OKCk6bnVsbCE9by50b1N0cmluZyYmKGVbbl09by50b1N0cmluZygpKX1yZXR1cm4gZX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbihlKXtpZihudWxsPT1lfHxcInN0cmluZ1wiIT10eXBlb2YgZSl0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBzcGVjaWZ5IGEga2V5IChhcyBzdHJpbmcpIVwiKTtyZXR1cm4gbnVsbD09dGhpcy5vcENvbnRlbnRzW2VdP3RoaXMuY29udGVudHNbZV06dGhpcy5vcy5nZXRUeXBlKHRoaXMub3BDb250ZW50c1tlXSl9fSx7a2V5Olwia2V5c1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29udGVudHMpLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLm9wQ29udGVudHMpKX19LHtrZXk6XCJrZXlzUHJpbWl0aXZlc1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29udGVudHMpfX0se2tleTpcImtleXNUeXBlc1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMub3BDb250ZW50cyl9fSx7a2V5OlwiZ2V0UHJpbWl0aXZlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09dClyZXR1cm4gZS51dGlscy5jb3B5T2JqZWN0KHRoaXMuY29udGVudHMpO2lmKFwic3RyaW5nXCIhPXR5cGVvZiB0KXRocm93IG5ldyBFcnJvcihcIktleSBpcyBleHBlY3RlZCB0byBiZSBhIHN0cmluZyFcIik7cmV0dXJuIHRoaXMuY29udGVudHNbdF19fSx7a2V5OlwiZ2V0VHlwZVwiLHZhbHVlOmZ1bmN0aW9uKGUpe2lmKG51bGw9PWV8fFwic3RyaW5nXCIhPXR5cGVvZiBlKXRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHNwZWNpZnkgYSBrZXkgKGFzIHN0cmluZykhXCIpO3JldHVybiBudWxsIT10aGlzLm9wQ29udGVudHNbZV0/dGhpcy5vcy5nZXRUeXBlKHRoaXMub3BDb250ZW50c1tlXSk6bnVsbH19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgbj10aGlzLm1hcFt0XTtpZihudWxsIT1uKXt2YXIgbz17dGFyZ2V0Om4sc3RydWN0OlwiRGVsZXRlXCJ9LGk9dGhpcy5ldmVudEhhbmRsZXIscj1lLnV0aWxzLmNvcHlPYmplY3Qobyk7ci5rZXk9dCx0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbigpe2kuYXdhaXRPcHModGhpcyx0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsW1tvXV0pfSksaS5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChbcl0pfX19LHtrZXk6XCJzZXRcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciBvPXRoaXMubWFwW3RdfHxudWxsLGk9e2lkOnRoaXMub3MuZ2V0TmV4dE9wSWQoMSksbGVmdDpudWxsLHJpZ2h0Om8sb3JpZ2luOm51bGwscGFyZW50OnRoaXMuX21vZGVsLHBhcmVudFN1Yjp0LHN0cnVjdDpcIkluc2VydFwifSxyPXRoaXMuZXZlbnRIYW5kbGVyLHM9ZS51dGlscy5pc1R5cGVEZWZpbml0aW9uKG4pO2lmKCExIT09cyl7dmFyIHU9dGhpcy5vcy5jcmVhdGVUeXBlKHMpO3JldHVybiBpLm9wQ29udGVudD11Ll9tb2RlbCx0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbigpe3IuYXdhaXRPcHModGhpcyx0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsW1tpXV0pfSksci5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChbaV0pLHV9cmV0dXJuIGkuY29udGVudD1bbl0sdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24oKXtyLmF3YWl0T3BzKHRoaXMsdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLFtbaV1dKX0pLHIuYXdhaXRBbmRQcmVtYXR1cmVseUNhbGwoW2ldKSxufX0se2tleTpcIm9ic2VydmVcIix2YWx1ZTpmdW5jdGlvbihlKXt0aGlzLmV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGUpfX0se2tleTpcIm9ic2VydmVEZWVwXCIsdmFsdWU6ZnVuY3Rpb24oZSl7dGhpcy5fZGVlcEV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGUpfX0se2tleTpcInVub2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKGUpe3RoaXMuZXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSl9fSx7a2V5OlwidW5vYnNlcnZlRGVlcFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3RoaXMuX2RlZXBFdmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihlKX19LHtrZXk6XCJvYnNlcnZlUGF0aFwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7ZnVuY3Rpb24gbyhlKXtlLm5hbWU9PT1pJiZuKHIuZ2V0KGkpKX12YXIgaSxyPXRoaXM7aWYodC5sZW5ndGg8MSlyZXR1cm4gbih0aGlzKSxmdW5jdGlvbigpe307aWYoMT09PXQubGVuZ3RoKXJldHVybiBpPXRbMF0sbihyLmdldChpKSksdGhpcy5vYnNlcnZlKG8pLGZ1bmN0aW9uKCl7ci51bm9ic2VydmUobil9O3ZhciB1LGw9ZnVuY3Rpb24oKXt2YXIgbz1yLmdldCh0WzBdKTtvIGluc3RhbmNlb2Ygc3x8KG89ci5zZXQodFswXSxlLk1hcCkpLHU9by5vYnNlcnZlUGF0aCh0LnNsaWNlKDEpLG4pfSxhPWZ1bmN0aW9uKGUpe2UubmFtZT09PXRbMF0mJihudWxsIT11JiZ1KCksXCJhZGRcIiE9PWUudHlwZSYmXCJ1cGRhdGVcIiE9PWUudHlwZXx8bCgpKX07cmV0dXJuIHIub2JzZXJ2ZShhKSxsKCksZnVuY3Rpb24oKXtudWxsIT11JiZ1KCksci51bm9ic2VydmUoYSl9fX0se2tleTpcIl9jaGFuZ2VkXCIsdmFsdWU6ZnVuY3Rpb24oZSx0KXtpZihcIkRlbGV0ZVwiPT09dC5zdHJ1Y3Qpe2lmKG51bGw9PXQua2V5KXt2YXIgbj1lLmdldE9wZXJhdGlvbih0LnRhcmdldCk7dC5rZXk9bi5wYXJlbnRTdWJ9fWVsc2UgbnVsbCE9dC5vcENvbnRlbnQmJmUuc3RvcmUuaW5pdFR5cGUuY2FsbChlLHQub3BDb250ZW50KTt0aGlzLmV2ZW50SGFuZGxlci5yZWNlaXZlZE9wKHQpfX1dKSxzfShlLnV0aWxzLkN1c3RvbVR5cGUpO2UuZXh0ZW5kKFwiTWFwXCIsbmV3IGUudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe25hbWU6XCJNYXBcIixjbGFzczpyLHN0cnVjdDpcIk1hcFwiLGluaXRUeXBlOmZ1bmN0aW9uKGUsdCl7dmFyIG49e30sbz17fSxpPXQubWFwO2Zvcih2YXIgcyBpbiBpKXt2YXIgdT10aGlzLmdldE9wZXJhdGlvbihpW3NdKTtpZighdS5kZWxldGVkKWlmKG51bGwhPXUub3BDb250ZW50KXtvW3NdPXUub3BDb250ZW50O3ZhciBsPXRoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLHUub3BDb250ZW50KTtsLl9wYXJlbnQ9dC5pZH1lbHNlIG5bc109dS5jb250ZW50WzBdfXJldHVybiBuZXcgcihlLHQsbixvKX0sY3JlYXRlVHlwZTpmdW5jdGlvbihlLHQpe3JldHVybiBuZXcgcihlLHQse30se30pfX0pKX12YXIgdD1mdW5jdGlvbihlLHQpe2lmKCEoZSBpbnN0YW5jZW9mIHQpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIil9LG49ZnVuY3Rpb24oKXtmdW5jdGlvbiBlKGUsdCl7Zm9yKHZhciBuPTA7bjx0Lmxlbmd0aDtuKyspe3ZhciBvPXRbbl07by5lbnVtZXJhYmxlPW8uZW51bWVyYWJsZXx8ITEsby5jb25maWd1cmFibGU9ITAsXCJ2YWx1ZVwiaW4gbyYmKG8ud3JpdGFibGU9ITApLE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlLG8ua2V5LG8pfX1yZXR1cm4gZnVuY3Rpb24odCxuLG8pe3JldHVybiBuJiZlKHQucHJvdG90eXBlLG4pLG8mJmUodCxvKSx0fX0oKSxvPWZ1bmN0aW9uKGUsdCl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgdCYmbnVsbCE9PXQpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIrdHlwZW9mIHQpO2UucHJvdG90eXBlPU9iamVjdC5jcmVhdGUodCYmdC5wcm90b3R5cGUse2NvbnN0cnVjdG9yOnt2YWx1ZTplLGVudW1lcmFibGU6ITEsd3JpdGFibGU6ITAsY29uZmlndXJhYmxlOiEwfX0pLHQmJihPYmplY3Quc2V0UHJvdG90eXBlT2Y/T2JqZWN0LnNldFByb3RvdHlwZU9mKGUsdCk6ZS5fX3Byb3RvX189dCl9LGk9ZnVuY3Rpb24oZSx0KXtpZighZSl0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7cmV0dXJuIXR8fFwib2JqZWN0XCIhPXR5cGVvZiB0JiZcImZ1bmN0aW9uXCIhPXR5cGVvZiB0P2U6dH07cmV0dXJuXCJ1bmRlZmluZWRcIiE9dHlwZW9mIFkmJmUoWSksZX0pO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eS1tYXAuanMubWFwXG4iLCIvKiBnbG9iYWwgWSAqL1xuJ3VzZSBzdHJpY3QnXG5cbmZ1bmN0aW9uIGV4dGVuZCAoWSkge1xuICByZXF1aXJlKCcuL1JlZEJsYWNrVHJlZS5qcycpKFkpXG4gIGNsYXNzIFRyYW5zYWN0aW9uIGV4dGVuZHMgWS5UcmFuc2FjdGlvbiB7XG4gICAgY29uc3RydWN0b3IgKHN0b3JlKSB7XG4gICAgICBzdXBlcihzdG9yZSlcbiAgICAgIHRoaXMuc3RvcmUgPSBzdG9yZVxuICAgICAgdGhpcy5zcyA9IHN0b3JlLnNzXG4gICAgICB0aGlzLm9zID0gc3RvcmUub3NcbiAgICAgIHRoaXMuZHMgPSBzdG9yZS5kc1xuICAgIH1cbiAgfVxuICB2YXIgU3RvcmUgPSBZLnV0aWxzLlJCVHJlZVxuICB2YXIgQnVmZmVyZWRTdG9yZSA9IFkudXRpbHMuY3JlYXRlU21hbGxMb29rdXBCdWZmZXIoU3RvcmUpXG5cbiAgY2xhc3MgRGF0YWJhc2UgZXh0ZW5kcyBZLkFic3RyYWN0RGF0YWJhc2Uge1xuICAgIGNvbnN0cnVjdG9yICh5LCBvcHRzKSB7XG4gICAgICBzdXBlcih5LCBvcHRzKVxuICAgICAgdGhpcy5vcyA9IG5ldyBCdWZmZXJlZFN0b3JlKClcbiAgICAgIHRoaXMuZHMgPSBuZXcgU3RvcmUoKVxuICAgICAgdGhpcy5zcyA9IG5ldyBCdWZmZXJlZFN0b3JlKClcbiAgICB9XG4gICAgbG9nVGFibGUgKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICBzZWxmLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1VzZXI6ICcsIHRoaXMuc3RvcmUueS5jb25uZWN0b3IudXNlcklkLCBcIj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVwiKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU3RhdGUgU2V0IChTUyk6XCIsIHlpZWxkKiB0aGlzLmdldFN0YXRlU2V0KCkpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgY29uc29sZS5sb2coXCJPcGVyYXRpb24gU3RvcmUgKE9TKTpcIikgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICB5aWVsZCogdGhpcy5vcy5sb2dUYWJsZSgpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgY29uc29sZS5sb2coXCJEZWxldGlvbiBTdG9yZSAoRFMpOlwiKSAvL2VzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgeWllbGQqIHRoaXMuZHMubG9nVGFibGUoKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGlmICh0aGlzLnN0b3JlLmdjMS5sZW5ndGggPiAwIHx8IHRoaXMuc3RvcmUuZ2MyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ0dDMXwyIG5vdCBlbXB0eSEnLCB0aGlzLnN0b3JlLmdjMSwgdGhpcy5zdG9yZS5nYzIpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKEpTT04uc3RyaW5naWZ5KHRoaXMuc3RvcmUubGlzdGVuZXJzQnlJZCkgIT09ICd7fScpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ2xpc3RlbmVyc0J5SWQgbm90IGVtcHR5IScpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKEpTT04uc3RyaW5naWZ5KHRoaXMuc3RvcmUubGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3cpICE9PSAnW10nKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdsaXN0ZW5lcnNCeUlkRXhlY3V0ZU5vdyBub3QgZW1wdHkhJylcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdG9yZS50cmFuc2FjdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1RyYW5zYWN0aW9uIHN0aWxsIGluIHByb2dyZXNzIScpXG4gICAgICAgIH1cbiAgICAgIH0sIHRydWUpXG4gICAgfVxuICAgIHRyYW5zYWN0IChtYWtlR2VuKSB7XG4gICAgICB2YXIgdCA9IG5ldyBUcmFuc2FjdGlvbih0aGlzKVxuICAgICAgd2hpbGUgKG1ha2VHZW4gIT09IG51bGwpIHtcbiAgICAgICAgdmFyIGdlbiA9IG1ha2VHZW4uY2FsbCh0KVxuICAgICAgICB2YXIgcmVzID0gZ2VuLm5leHQoKVxuICAgICAgICB3aGlsZSAoIXJlcy5kb25lKSB7XG4gICAgICAgICAgcmVzID0gZ2VuLm5leHQocmVzLnZhbHVlKVxuICAgICAgICB9XG4gICAgICAgIG1ha2VHZW4gPSB0aGlzLmdldE5leHRSZXF1ZXN0KClcbiAgICAgIH1cbiAgICB9XG4gICAgKiBkZXN0cm95ICgpIHtcbiAgICAgIHlpZWxkKiBzdXBlci5kZXN0cm95KClcbiAgICAgIGRlbGV0ZSB0aGlzLm9zXG4gICAgICBkZWxldGUgdGhpcy5zc1xuICAgICAgZGVsZXRlIHRoaXMuZHNcbiAgICB9XG4gIH1cbiAgWS5leHRlbmQoJ21lbW9yeScsIERhdGFiYXNlKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuaWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuICBleHRlbmQoWSlcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG4vKlxuICBUaGlzIGZpbGUgY29udGFpbnMgYSBub3Qgc28gZmFuY3kgaW1wbGVtYW50aW9uIG9mIGEgUmVkIEJsYWNrIFRyZWUuXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoWSkge1xuICBjbGFzcyBOIHtcbiAgICAvLyBBIGNyZWF0ZWQgbm9kZSBpcyBhbHdheXMgcmVkIVxuICAgIGNvbnN0cnVjdG9yICh2YWwpIHtcbiAgICAgIHRoaXMudmFsID0gdmFsXG4gICAgICB0aGlzLmNvbG9yID0gdHJ1ZVxuICAgICAgdGhpcy5fbGVmdCA9IG51bGxcbiAgICAgIHRoaXMuX3JpZ2h0ID0gbnVsbFxuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbFxuICAgICAgaWYgKHZhbC5pZCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBpZCEnKVxuICAgICAgfVxuICAgIH1cbiAgICBpc1JlZCAoKSB7IHJldHVybiB0aGlzLmNvbG9yIH1cbiAgICBpc0JsYWNrICgpIHsgcmV0dXJuICF0aGlzLmNvbG9yIH1cbiAgICByZWRkZW4gKCkgeyB0aGlzLmNvbG9yID0gdHJ1ZTsgcmV0dXJuIHRoaXMgfVxuICAgIGJsYWNrZW4gKCkgeyB0aGlzLmNvbG9yID0gZmFsc2U7IHJldHVybiB0aGlzIH1cbiAgICBnZXQgZ3JhbmRwYXJlbnQgKCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50LnBhcmVudFxuICAgIH1cbiAgICBnZXQgcGFyZW50ICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9wYXJlbnRcbiAgICB9XG4gICAgZ2V0IHNpYmxpbmcgKCkge1xuICAgICAgcmV0dXJuICh0aGlzID09PSB0aGlzLnBhcmVudC5sZWZ0KVxuICAgICAgICA/IHRoaXMucGFyZW50LnJpZ2h0IDogdGhpcy5wYXJlbnQubGVmdFxuICAgIH1cbiAgICBnZXQgbGVmdCAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbGVmdFxuICAgIH1cbiAgICBnZXQgcmlnaHQgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3JpZ2h0XG4gICAgfVxuICAgIHNldCBsZWZ0IChuKSB7XG4gICAgICBpZiAobiAhPT0gbnVsbCkge1xuICAgICAgICBuLl9wYXJlbnQgPSB0aGlzXG4gICAgICB9XG4gICAgICB0aGlzLl9sZWZ0ID0gblxuICAgIH1cbiAgICBzZXQgcmlnaHQgKG4pIHtcbiAgICAgIGlmIChuICE9PSBudWxsKSB7XG4gICAgICAgIG4uX3BhcmVudCA9IHRoaXNcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JpZ2h0ID0gblxuICAgIH1cbiAgICByb3RhdGVMZWZ0ICh0cmVlKSB7XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnRcbiAgICAgIHZhciBuZXdQYXJlbnQgPSB0aGlzLnJpZ2h0XG4gICAgICB2YXIgbmV3UmlnaHQgPSB0aGlzLnJpZ2h0LmxlZnRcbiAgICAgIG5ld1BhcmVudC5sZWZ0ID0gdGhpc1xuICAgICAgdGhpcy5yaWdodCA9IG5ld1JpZ2h0XG4gICAgICBpZiAocGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgIHRyZWUucm9vdCA9IG5ld1BhcmVudFxuICAgICAgICBuZXdQYXJlbnQuX3BhcmVudCA9IG51bGxcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50LmxlZnQgPT09IHRoaXMpIHtcbiAgICAgICAgcGFyZW50LmxlZnQgPSBuZXdQYXJlbnRcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50LnJpZ2h0ID09PSB0aGlzKSB7XG4gICAgICAgIHBhcmVudC5yaWdodCA9IG5ld1BhcmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgZWxlbWVudHMgYXJlIHdyb25nbHkgY29ubmVjdGVkIScpXG4gICAgICB9XG4gICAgfVxuICAgIG5leHQgKCkge1xuICAgICAgaWYgKHRoaXMucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gc2VhcmNoIHRoZSBtb3N0IGxlZnQgbm9kZSBpbiB0aGUgcmlnaHQgdHJlZVxuICAgICAgICB2YXIgbyA9IHRoaXMucmlnaHRcbiAgICAgICAgd2hpbGUgKG8ubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzXG4gICAgICAgIHdoaWxlIChwLnBhcmVudCAhPT0gbnVsbCAmJiBwICE9PSBwLnBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgcCA9IHAucGFyZW50XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHAucGFyZW50XG4gICAgICB9XG4gICAgfVxuICAgIHByZXYgKCkge1xuICAgICAgaWYgKHRoaXMubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBzZWFyY2ggdGhlIG1vc3QgcmlnaHQgbm9kZSBpbiB0aGUgbGVmdCB0cmVlXG4gICAgICAgIHZhciBvID0gdGhpcy5sZWZ0XG4gICAgICAgIHdoaWxlIChvLnJpZ2h0ICE9PSBudWxsKSB7XG4gICAgICAgICAgbyA9IG8ucmlnaHRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzXG4gICAgICAgIHdoaWxlIChwLnBhcmVudCAhPT0gbnVsbCAmJiBwICE9PSBwLnBhcmVudC5yaWdodCkge1xuICAgICAgICAgIHAgPSBwLnBhcmVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwLnBhcmVudFxuICAgICAgfVxuICAgIH1cbiAgICByb3RhdGVSaWdodCAodHJlZSkge1xuICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50XG4gICAgICB2YXIgbmV3UGFyZW50ID0gdGhpcy5sZWZ0XG4gICAgICB2YXIgbmV3TGVmdCA9IHRoaXMubGVmdC5yaWdodFxuICAgICAgbmV3UGFyZW50LnJpZ2h0ID0gdGhpc1xuICAgICAgdGhpcy5sZWZ0ID0gbmV3TGVmdFxuICAgICAgaWYgKHBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICB0cmVlLnJvb3QgPSBuZXdQYXJlbnRcbiAgICAgICAgbmV3UGFyZW50Ll9wYXJlbnQgPSBudWxsXG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5sZWZ0ID09PSB0aGlzKSB7XG4gICAgICAgIHBhcmVudC5sZWZ0ID0gbmV3UGFyZW50XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5yaWdodCA9PT0gdGhpcykge1xuICAgICAgICBwYXJlbnQucmlnaHQgPSBuZXdQYXJlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGVsZW1lbnRzIGFyZSB3cm9uZ2x5IGNvbm5lY3RlZCEnKVxuICAgICAgfVxuICAgIH1cbiAgICBnZXRVbmNsZSAoKSB7XG4gICAgICAvLyB3ZSBjYW4gYXNzdW1lIHRoYXQgZ3JhbmRwYXJlbnQgZXhpc3RzIHdoZW4gdGhpcyBpcyBjYWxsZWQhXG4gICAgICBpZiAodGhpcy5wYXJlbnQgPT09IHRoaXMucGFyZW50LnBhcmVudC5sZWZ0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5wYXJlbnQucmlnaHRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5wYXJlbnQubGVmdFxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNsYXNzIFJCVHJlZSB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5yb290ID0gbnVsbFxuICAgICAgdGhpcy5sZW5ndGggPSAwXG4gICAgfVxuICAgICogZmluZE5leHQgKGlkKSB7XG4gICAgICByZXR1cm4geWllbGQqIHRoaXMuZmluZFdpdGhMb3dlckJvdW5kKFtpZFswXSwgaWRbMV0gKyAxXSlcbiAgICB9XG4gICAgKiBmaW5kUHJldiAoaWQpIHtcbiAgICAgIHJldHVybiB5aWVsZCogdGhpcy5maW5kV2l0aFVwcGVyQm91bmQoW2lkWzBdLCBpZFsxXSAtIDFdKVxuICAgIH1cbiAgICBmaW5kTm9kZVdpdGhMb3dlckJvdW5kIChmcm9tKSB7XG4gICAgICBpZiAoZnJvbSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgZGVmaW5lIGZyb20hJylcbiAgICAgIH1cbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICBpZiAobyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBpZiAoKGZyb20gPT09IG51bGwgfHwgWS51dGlscy5zbWFsbGVyKGZyb20sIG8udmFsLmlkKSkgJiYgby5sZWZ0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBvIGlzIGluY2x1ZGVkIGluIHRoZSBib3VuZFxuICAgICAgICAgICAgLy8gdHJ5IHRvIGZpbmQgYW4gZWxlbWVudCB0aGF0IGlzIGNsb3NlciB0byB0aGUgYm91bmRcbiAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICB9IGVsc2UgaWYgKGZyb20gIT09IG51bGwgJiYgWS51dGlscy5zbWFsbGVyKG8udmFsLmlkLCBmcm9tKSkge1xuICAgICAgICAgICAgLy8gbyBpcyBub3Qgd2l0aGluIHRoZSBib3VuZCwgbWF5YmUgb25lIG9mIHRoZSByaWdodCBlbGVtZW50cyBpcy4uXG4gICAgICAgICAgICBpZiAoby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gcmlnaHQgZWxlbWVudC4gU2VhcmNoIGZvciB0aGUgbmV4dCBiaWdnZXIgZWxlbWVudCxcbiAgICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYmUgd2l0aGluIHRoZSBib3VuZHNcbiAgICAgICAgICAgICAgcmV0dXJuIG8ubmV4dCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBvXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZpbmROb2RlV2l0aFVwcGVyQm91bmQgKHRvKSB7XG4gICAgICBpZiAodG8gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBmcm9tIScpXG4gICAgICB9XG4gICAgICB2YXIgbyA9IHRoaXMucm9vdFxuICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKCh0byA9PT0gbnVsbCB8fCBZLnV0aWxzLnNtYWxsZXIoby52YWwuaWQsIHRvKSkgJiYgby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gbyBpcyBpbmNsdWRlZCBpbiB0aGUgYm91bmRcbiAgICAgICAgICAgIC8vIHRyeSB0byBmaW5kIGFuIGVsZW1lbnQgdGhhdCBpcyBjbG9zZXIgdG8gdGhlIGJvdW5kXG4gICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgIH0gZWxzZSBpZiAodG8gIT09IG51bGwgJiYgWS51dGlscy5zbWFsbGVyKHRvLCBvLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIC8vIG8gaXMgbm90IHdpdGhpbiB0aGUgYm91bmQsIG1heWJlIG9uZSBvZiB0aGUgbGVmdCBlbGVtZW50cyBpcy4uXG4gICAgICAgICAgICBpZiAoby5sZWZ0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIGxlZnQgZWxlbWVudC4gU2VhcmNoIGZvciB0aGUgcHJldiBzbWFsbGVyIGVsZW1lbnQsXG4gICAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGJlIHdpdGhpbiB0aGUgYm91bmRzXG4gICAgICAgICAgICAgIHJldHVybiBvLnByZXYoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmaW5kU21hbGxlc3ROb2RlICgpIHtcbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICB3aGlsZSAobyAhPSBudWxsICYmIG8ubGVmdCAhPSBudWxsKSB7XG4gICAgICAgIG8gPSBvLmxlZnRcbiAgICAgIH1cbiAgICAgIHJldHVybiBvXG4gICAgfVxuICAgICogZmluZFdpdGhMb3dlckJvdW5kIChmcm9tKSB7XG4gICAgICB2YXIgbiA9IHRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZChmcm9tKVxuICAgICAgcmV0dXJuIG4gPT0gbnVsbCA/IG51bGwgOiBuLnZhbFxuICAgIH1cbiAgICAqIGZpbmRXaXRoVXBwZXJCb3VuZCAodG8pIHtcbiAgICAgIHZhciBuID0gdGhpcy5maW5kTm9kZVdpdGhVcHBlckJvdW5kKHRvKVxuICAgICAgcmV0dXJuIG4gPT0gbnVsbCA/IG51bGwgOiBuLnZhbFxuICAgIH1cbiAgICAqIGl0ZXJhdGUgKHQsIGZyb20sIHRvLCBmKSB7XG4gICAgICB2YXIgb1xuICAgICAgaWYgKGZyb20gPT09IG51bGwpIHtcbiAgICAgICAgbyA9IHRoaXMuZmluZFNtYWxsZXN0Tm9kZSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvID0gdGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKGZyb20pXG4gICAgICB9XG4gICAgICB3aGlsZSAobyAhPT0gbnVsbCAmJiAodG8gPT09IG51bGwgfHwgWS51dGlscy5zbWFsbGVyKG8udmFsLmlkLCB0bykgfHwgWS51dGlscy5jb21wYXJlSWRzKG8udmFsLmlkLCB0bykpKSB7XG4gICAgICAgIHlpZWxkKiBmLmNhbGwodCwgby52YWwpXG4gICAgICAgIG8gPSBvLm5leHQoKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgKiBsb2dUYWJsZSAoZnJvbSwgdG8sIGZpbHRlcikge1xuICAgICAgaWYgKGZpbHRlciA9PSBudWxsKSB7XG4gICAgICAgIGZpbHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZnJvbSA9PSBudWxsKSB7IGZyb20gPSBudWxsIH1cbiAgICAgIGlmICh0byA9PSBudWxsKSB7IHRvID0gbnVsbCB9XG4gICAgICB2YXIgb3MgPSBbXVxuICAgICAgeWllbGQqIHRoaXMuaXRlcmF0ZSh0aGlzLCBmcm9tLCB0bywgZnVuY3Rpb24gKiAobykge1xuICAgICAgICBpZiAoZmlsdGVyKG8pKSB7XG4gICAgICAgICAgdmFyIG9fID0ge31cbiAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIG9fW2tleV0gPSBKU09OLnN0cmluZ2lmeShvW2tleV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvX1trZXldID0gb1trZXldXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG9zLnB1c2gob18pXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICBpZiAoY29uc29sZS50YWJsZSAhPSBudWxsKSB7XG4gICAgICAgIGNvbnNvbGUudGFibGUob3MpXG4gICAgICB9XG4gICAgfVxuICAgICogZmluZCAoaWQpIHtcbiAgICAgIHZhciBuXG4gICAgICByZXR1cm4gKG4gPSB0aGlzLmZpbmROb2RlKGlkKSkgPyBuLnZhbCA6IG51bGxcbiAgICB9XG4gICAgZmluZE5vZGUgKGlkKSB7XG4gICAgICBpZiAoaWQgPT0gbnVsbCB8fCBpZC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgaWQgdG8gYmUgYW4gYXJyYXkhJylcbiAgICAgIH1cbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICBpZiAobyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoWS51dGlscy5zbWFsbGVyKGlkLCBvLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICB9IGVsc2UgaWYgKFkudXRpbHMuc21hbGxlcihvLnZhbC5pZCwgaWQpKSB7XG4gICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGRlbGV0ZSAoaWQpIHtcbiAgICAgIGlmIChpZCA9PSBudWxsIHx8IGlkLmNvbnN0cnVjdG9yICE9PSBBcnJheSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lkIGlzIGV4cGVjdGVkIHRvIGJlIGFuIEFycmF5IScpXG4gICAgICB9XG4gICAgICB2YXIgZCA9IHRoaXMuZmluZE5vZGUoaWQpXG4gICAgICBpZiAoZCA9PSBudWxsKSB7XG4gICAgICAgIC8vIHRocm93IG5ldyBFcnJvcignRWxlbWVudCBkb2VzIG5vdCBleGlzdCEnKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHRoaXMubGVuZ3RoLS1cbiAgICAgIGlmIChkLmxlZnQgIT09IG51bGwgJiYgZC5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBzd2l0Y2ggZCB3aXRoIHRoZSBncmVhdGVzIGVsZW1lbnQgaW4gdGhlIGxlZnQgc3VidHJlZS5cbiAgICAgICAgLy8gbyBzaG91bGQgaGF2ZSBhdCBtb3N0IG9uZSBjaGlsZC5cbiAgICAgICAgdmFyIG8gPSBkLmxlZnRcbiAgICAgICAgLy8gZmluZFxuICAgICAgICB3aGlsZSAoby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgIG8gPSBvLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3dpdGNoXG4gICAgICAgIGQudmFsID0gby52YWxcbiAgICAgICAgZCA9IG9cbiAgICAgIH1cbiAgICAgIC8vIGQgaGFzIGF0IG1vc3Qgb25lIGNoaWxkXG4gICAgICAvLyBsZXQgbiBiZSB0aGUgbm9kZSB0aGF0IHJlcGxhY2VzIGRcbiAgICAgIHZhciBpc0Zha2VDaGlsZFxuICAgICAgdmFyIGNoaWxkID0gZC5sZWZ0IHx8IGQucmlnaHRcbiAgICAgIGlmIChjaGlsZCA9PT0gbnVsbCkge1xuICAgICAgICBpc0Zha2VDaGlsZCA9IHRydWVcbiAgICAgICAgY2hpbGQgPSBuZXcgTih7aWQ6IDB9KVxuICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgZC5yaWdodCA9IGNoaWxkXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpc0Zha2VDaGlsZCA9IGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGlmIChkLnBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoIWlzRmFrZUNoaWxkKSB7XG4gICAgICAgICAgdGhpcy5yb290ID0gY2hpbGRcbiAgICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgICBjaGlsZC5fcGFyZW50ID0gbnVsbFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucm9vdCA9IG51bGxcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH0gZWxzZSBpZiAoZC5wYXJlbnQubGVmdCA9PT0gZCkge1xuICAgICAgICBkLnBhcmVudC5sZWZ0ID0gY2hpbGRcbiAgICAgIH0gZWxzZSBpZiAoZC5wYXJlbnQucmlnaHQgPT09IGQpIHtcbiAgICAgICAgZC5wYXJlbnQucmlnaHQgPSBjaGlsZFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbXBvc3NpYmxlIScpXG4gICAgICB9XG4gICAgICBpZiAoZC5pc0JsYWNrKCkpIHtcbiAgICAgICAgaWYgKGNoaWxkLmlzUmVkKCkpIHtcbiAgICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9maXhEZWxldGUoY2hpbGQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMucm9vdC5ibGFja2VuKClcbiAgICAgIGlmIChpc0Zha2VDaGlsZCkge1xuICAgICAgICBpZiAoY2hpbGQucGFyZW50LmxlZnQgPT09IGNoaWxkKSB7XG4gICAgICAgICAgY2hpbGQucGFyZW50LmxlZnQgPSBudWxsXG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQucGFyZW50LnJpZ2h0ID09PSBjaGlsZCkge1xuICAgICAgICAgIGNoaWxkLnBhcmVudC5yaWdodCA9IG51bGxcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ltcG9zc2libGUgIzMnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIF9maXhEZWxldGUgKG4pIHtcbiAgICAgIGZ1bmN0aW9uIGlzQmxhY2sgKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUgIT09IG51bGwgPyBub2RlLmlzQmxhY2soKSA6IHRydWVcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGlzUmVkIChub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlICE9PSBudWxsID8gbm9kZS5pc1JlZCgpIDogZmFsc2VcbiAgICAgIH1cbiAgICAgIGlmIChuLnBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAvLyB0aGlzIGNhbiBvbmx5IGJlIGNhbGxlZCBhZnRlciB0aGUgZmlyc3QgaXRlcmF0aW9uIG9mIGZpeERlbGV0ZS5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBkIHdhcyBhbHJlYWR5IHJlcGxhY2VkIGJ5IHRoZSBjaGlsZFxuICAgICAgLy8gZCBpcyBub3QgdGhlIHJvb3RcbiAgICAgIC8vIGQgYW5kIGNoaWxkIGFyZSBibGFja1xuICAgICAgdmFyIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgIGlmIChpc1JlZChzaWJsaW5nKSkge1xuICAgICAgICAvLyBtYWtlIHNpYmxpbmcgdGhlIGdyYW5kZmF0aGVyXG4gICAgICAgIG4ucGFyZW50LnJlZGRlbigpXG4gICAgICAgIHNpYmxpbmcuYmxhY2tlbigpXG4gICAgICAgIGlmIChuID09PSBuLnBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlTGVmdCh0aGlzKVxuICAgICAgICB9IGVsc2UgaWYgKG4gPT09IG4ucGFyZW50LnJpZ2h0KSB7XG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ltcG9zc2libGUgIzInKVxuICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgIH1cbiAgICAgIC8vIHBhcmVudCwgc2libGluZywgYW5kIGNoaWxkcmVuIG9mIG4gYXJlIGJsYWNrXG4gICAgICBpZiAobi5wYXJlbnQuaXNCbGFjaygpICYmXG4gICAgICAgIHNpYmxpbmcuaXNCbGFjaygpICYmXG4gICAgICAgIGlzQmxhY2soc2libGluZy5sZWZ0KSAmJlxuICAgICAgICBpc0JsYWNrKHNpYmxpbmcucmlnaHQpXG4gICAgICApIHtcbiAgICAgICAgc2libGluZy5yZWRkZW4oKVxuICAgICAgICB0aGlzLl9maXhEZWxldGUobi5wYXJlbnQpXG4gICAgICB9IGVsc2UgaWYgKG4ucGFyZW50LmlzUmVkKCkgJiZcbiAgICAgICAgc2libGluZy5pc0JsYWNrKCkgJiZcbiAgICAgICAgaXNCbGFjayhzaWJsaW5nLmxlZnQpICYmXG4gICAgICAgIGlzQmxhY2soc2libGluZy5yaWdodClcbiAgICAgICkge1xuICAgICAgICBzaWJsaW5nLnJlZGRlbigpXG4gICAgICAgIG4ucGFyZW50LmJsYWNrZW4oKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQgJiZcbiAgICAgICAgICBzaWJsaW5nLmlzQmxhY2soKSAmJlxuICAgICAgICAgIGlzUmVkKHNpYmxpbmcubGVmdCkgJiZcbiAgICAgICAgICBpc0JsYWNrKHNpYmxpbmcucmlnaHQpXG4gICAgICAgICkge1xuICAgICAgICAgIHNpYmxpbmcucmVkZGVuKClcbiAgICAgICAgICBzaWJsaW5nLmxlZnQuYmxhY2tlbigpXG4gICAgICAgICAgc2libGluZy5yb3RhdGVSaWdodCh0aGlzKVxuICAgICAgICAgIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgICAgfSBlbHNlIGlmIChuID09PSBuLnBhcmVudC5yaWdodCAmJlxuICAgICAgICAgIHNpYmxpbmcuaXNCbGFjaygpICYmXG4gICAgICAgICAgaXNSZWQoc2libGluZy5yaWdodCkgJiZcbiAgICAgICAgICBpc0JsYWNrKHNpYmxpbmcubGVmdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2libGluZy5yZWRkZW4oKVxuICAgICAgICAgIHNpYmxpbmcucmlnaHQuYmxhY2tlbigpXG4gICAgICAgICAgc2libGluZy5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgICAgc2libGluZyA9IG4uc2libGluZ1xuICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcuY29sb3IgPSBuLnBhcmVudC5jb2xvclxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQpIHtcbiAgICAgICAgICBzaWJsaW5nLnJpZ2h0LmJsYWNrZW4oKVxuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZUxlZnQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzaWJsaW5nLmxlZnQuYmxhY2tlbigpXG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIHB1dCAodikge1xuICAgICAgaWYgKHYgPT0gbnVsbCB8fCB2LmlkID09IG51bGwgfHwgdi5pZC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd2IGlzIGV4cGVjdGVkIHRvIGhhdmUgYW4gaWQgcHJvcGVydHkgd2hpY2ggaXMgYW4gQXJyYXkhJylcbiAgICAgIH1cbiAgICAgIHZhciBub2RlID0gbmV3IE4odilcbiAgICAgIGlmICh0aGlzLnJvb3QgIT09IG51bGwpIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzLnJvb3QgLy8gcCBhYmJyZXYuIHBhcmVudFxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGlmIChZLnV0aWxzLnNtYWxsZXIobm9kZS52YWwuaWQsIHAudmFsLmlkKSkge1xuICAgICAgICAgICAgaWYgKHAubGVmdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBwLmxlZnQgPSBub2RlXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwID0gcC5sZWZ0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChZLnV0aWxzLnNtYWxsZXIocC52YWwuaWQsIG5vZGUudmFsLmlkKSkge1xuICAgICAgICAgICAgaWYgKHAucmlnaHQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgcC5yaWdodCA9IG5vZGVcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHAgPSBwLnJpZ2h0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHAudmFsID0gbm9kZS52YWxcbiAgICAgICAgICAgIHJldHVybiBwXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2ZpeEluc2VydChub2RlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gbm9kZVxuICAgICAgfVxuICAgICAgdGhpcy5sZW5ndGgrK1xuICAgICAgdGhpcy5yb290LmJsYWNrZW4oKVxuICAgICAgcmV0dXJuIG5vZGVcbiAgICB9XG4gICAgX2ZpeEluc2VydCAobikge1xuICAgICAgaWYgKG4ucGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgIG4uYmxhY2tlbigpXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIGlmIChuLnBhcmVudC5pc0JsYWNrKCkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICB2YXIgdW5jbGUgPSBuLmdldFVuY2xlKClcbiAgICAgIGlmICh1bmNsZSAhPT0gbnVsbCAmJiB1bmNsZS5pc1JlZCgpKSB7XG4gICAgICAgIC8vIE5vdGU6IHBhcmVudDogcmVkLCB1bmNsZTogcmVkXG4gICAgICAgIG4ucGFyZW50LmJsYWNrZW4oKVxuICAgICAgICB1bmNsZS5ibGFja2VuKClcbiAgICAgICAgbi5ncmFuZHBhcmVudC5yZWRkZW4oKVxuICAgICAgICB0aGlzLl9maXhJbnNlcnQobi5ncmFuZHBhcmVudClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vdGU6IHBhcmVudDogcmVkLCB1bmNsZTogYmxhY2sgb3IgbnVsbFxuICAgICAgICAvLyBOb3cgd2UgdHJhbnNmb3JtIHRoZSB0cmVlIGluIHN1Y2ggYSB3YXkgdGhhdFxuICAgICAgICAvLyBlaXRoZXIgb2YgdGhlc2UgaG9sZHM6XG4gICAgICAgIC8vICAgMSkgZ3JhbmRwYXJlbnQubGVmdC5pc1JlZFxuICAgICAgICAvLyAgICAgYW5kIGdyYW5kcGFyZW50LmxlZnQubGVmdC5pc1JlZFxuICAgICAgICAvLyAgIDIpIGdyYW5kcGFyZW50LnJpZ2h0LmlzUmVkXG4gICAgICAgIC8vICAgICBhbmQgZ3JhbmRwYXJlbnQucmlnaHQucmlnaHQuaXNSZWRcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LnJpZ2h0ICYmIG4ucGFyZW50ID09PSBuLmdyYW5kcGFyZW50LmxlZnQpIHtcbiAgICAgICAgICBuLnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgICAgLy8gU2luY2Ugd2Ugcm90YXRlZCBhbmQgd2FudCB0byB1c2UgdGhlIHByZXZpb3VzXG4gICAgICAgICAgLy8gY2FzZXMsIHdlIG5lZWQgdG8gc2V0IG4gaW4gc3VjaCBhIHdheSB0aGF0XG4gICAgICAgICAgLy8gbi5wYXJlbnQuaXNSZWQgYWdhaW5cbiAgICAgICAgICBuID0gbi5sZWZ0XG4gICAgICAgIH0gZWxzZSBpZiAobiA9PT0gbi5wYXJlbnQubGVmdCAmJiBuLnBhcmVudCA9PT0gbi5ncmFuZHBhcmVudC5yaWdodCkge1xuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpXG4gICAgICAgICAgLy8gc2VlIGFib3ZlXG4gICAgICAgICAgbiA9IG4ucmlnaHRcbiAgICAgICAgfVxuICAgICAgICAvLyBDYXNlIDEpIG9yIDIpIGhvbGQgZnJvbSBoZXJlIG9uLlxuICAgICAgICAvLyBOb3cgdHJhdmVyc2UgZ3JhbmRwYXJlbnQsIG1ha2UgcGFyZW50IGEgYmxhY2sgbm9kZVxuICAgICAgICAvLyBvbiB0aGUgaGlnaGVzdCBsZXZlbCB3aGljaCBob2xkcyB0d28gcmVkIG5vZGVzLlxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgICAgbi5ncmFuZHBhcmVudC5yZWRkZW4oKVxuICAgICAgICBpZiAobiA9PT0gbi5wYXJlbnQubGVmdCkge1xuICAgICAgICAgIC8vIENhc2UgMVxuICAgICAgICAgIG4uZ3JhbmRwYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDYXNlIDJcbiAgICAgICAgICBuLmdyYW5kcGFyZW50LnJvdGF0ZUxlZnQodGhpcylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGZsdXNoICgpIHt9XG4gIH1cblxuICBZLnV0aWxzLlJCVHJlZSA9IFJCVHJlZVxufVxuIiwiLyoqXG4gKiB5LXRleHQyIC0gVGV4dCBUeXBlIGZvciBZanNcbiAqIEB2ZXJzaW9uIHYxLjYuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbiFmdW5jdGlvbih0LGUpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPWUoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKGUpOnQueVRleHQ9ZSgpfSh0aGlzLGZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gdCh0LG4scil7aWYodD09bilyZXR1cm4gdD9bW2QsdF1dOltdOyhyPDB8fHQubGVuZ3RoPHIpJiYocj1udWxsKTt2YXIgcz1pKHQsbiksYT10LnN1YnN0cmluZygwLHMpO3Q9dC5zdWJzdHJpbmcocyksbj1uLnN1YnN0cmluZyhzKSxzPW8odCxuKTt2YXIgYz10LnN1YnN0cmluZyh0Lmxlbmd0aC1zKTt0PXQuc3Vic3RyaW5nKDAsdC5sZW5ndGgtcyksbj1uLnN1YnN0cmluZygwLG4ubGVuZ3RoLXMpO3ZhciBmPWUodCxuKTtyZXR1cm4gYSYmZi51bnNoaWZ0KFtkLGFdKSxjJiZmLnB1c2goW2QsY10pLGwoZiksbnVsbCE9ciYmKGY9dShmLHIpKSxmfWZ1bmN0aW9uIGUoZSxyKXt2YXIgaTtpZighZSlyZXR1cm5bW2cscl1dO2lmKCFyKXJldHVybltbaCxlXV07dmFyIG89ZS5sZW5ndGg+ci5sZW5ndGg/ZTpyLGw9ZS5sZW5ndGg+ci5sZW5ndGg/cjplLGE9by5pbmRleE9mKGwpO2lmKC0xIT1hKXJldHVybiBpPVtbZyxvLnN1YnN0cmluZygwLGEpXSxbZCxsXSxbZyxvLnN1YnN0cmluZyhhK2wubGVuZ3RoKV1dLGUubGVuZ3RoPnIubGVuZ3RoJiYoaVswXVswXT1pWzJdWzBdPWgpLGk7aWYoMT09bC5sZW5ndGgpcmV0dXJuW1toLGVdLFtnLHJdXTt2YXIgdT1zKGUscik7aWYodSl7dmFyIGM9dVswXSxmPXVbMV0sdj11WzJdLHA9dVszXSxiPXVbNF0seT10KGMsdiksbT10KGYscCk7cmV0dXJuIHkuY29uY2F0KFtbZCxiXV0sbSl9cmV0dXJuIG4oZSxyKX1mdW5jdGlvbiBuKHQsZSl7Zm9yKHZhciBuPXQubGVuZ3RoLGk9ZS5sZW5ndGgsbz1NYXRoLmNlaWwoKG4raSkvMikscz1vLGw9MipvLGE9bmV3IEFycmF5KGwpLHU9bmV3IEFycmF5KGwpLGM9MDtjPGw7YysrKWFbY109LTEsdVtjXT0tMTthW3MrMV09MCx1W3MrMV09MDtmb3IodmFyIGY9bi1pLGQ9ZiUyIT0wLHY9MCxwPTAsYj0wLHk9MCxtPTA7bTxvO20rKyl7Zm9yKHZhciB4PS1tK3Y7eDw9bS1wO3grPTIpe3ZhciBfLHc9cyt4O189eD09LW18fHghPW0mJmFbdy0xXTxhW3crMV0/YVt3KzFdOmFbdy0xXSsxO2Zvcih2YXIgTT1fLXg7XzxuJiZNPGkmJnQuY2hhckF0KF8pPT1lLmNoYXJBdChNKTspXysrLE0rKztpZihhW3ddPV8sXz5uKXArPTI7ZWxzZSBpZihNPmkpdis9MjtlbHNlIGlmKGQpe3ZhciBrPXMrZi14O2lmKGs+PTAmJms8bCYmLTEhPXVba10pe3ZhciBDPW4tdVtrXTtpZihfPj1DKXJldHVybiByKHQsZSxfLE0pfX19Zm9yKHZhciBPPS1tK2I7Tzw9bS15O08rPTIpe3ZhciBDLGs9cytPO0M9Tz09LW18fE8hPW0mJnVbay0xXTx1W2srMV0/dVtrKzFdOnVbay0xXSsxO2Zvcih2YXIgQT1DLU87QzxuJiZBPGkmJnQuY2hhckF0KG4tQy0xKT09ZS5jaGFyQXQoaS1BLTEpOylDKyssQSsrO2lmKHVba109QyxDPm4peSs9MjtlbHNlIGlmKEE+aSliKz0yO2Vsc2UgaWYoIWQpe3ZhciB3PXMrZi1PO2lmKHc+PTAmJnc8bCYmLTEhPWFbd10pe3ZhciBfPWFbd10sTT1zK18tdztpZihDPW4tQyxfPj1DKXJldHVybiByKHQsZSxfLE0pfX19fXJldHVybltbaCx0XSxbZyxlXV19ZnVuY3Rpb24gcihlLG4scixpKXt2YXIgbz1lLnN1YnN0cmluZygwLHIpLHM9bi5zdWJzdHJpbmcoMCxpKSxsPWUuc3Vic3RyaW5nKHIpLGE9bi5zdWJzdHJpbmcoaSksdT10KG8scyksYz10KGwsYSk7cmV0dXJuIHUuY29uY2F0KGMpfWZ1bmN0aW9uIGkodCxlKXtpZighdHx8IWV8fHQuY2hhckF0KDApIT1lLmNoYXJBdCgwKSlyZXR1cm4gMDtmb3IodmFyIG49MCxyPU1hdGgubWluKHQubGVuZ3RoLGUubGVuZ3RoKSxpPXIsbz0wO248aTspdC5zdWJzdHJpbmcobyxpKT09ZS5zdWJzdHJpbmcobyxpKT8obj1pLG89bik6cj1pLGk9TWF0aC5mbG9vcigoci1uKS8yK24pO3JldHVybiBpfWZ1bmN0aW9uIG8odCxlKXtpZighdHx8IWV8fHQuY2hhckF0KHQubGVuZ3RoLTEpIT1lLmNoYXJBdChlLmxlbmd0aC0xKSlyZXR1cm4gMDtmb3IodmFyIG49MCxyPU1hdGgubWluKHQubGVuZ3RoLGUubGVuZ3RoKSxpPXIsbz0wO248aTspdC5zdWJzdHJpbmcodC5sZW5ndGgtaSx0Lmxlbmd0aC1vKT09ZS5zdWJzdHJpbmcoZS5sZW5ndGgtaSxlLmxlbmd0aC1vKT8obj1pLG89bik6cj1pLGk9TWF0aC5mbG9vcigoci1uKS8yK24pO3JldHVybiBpfWZ1bmN0aW9uIHModCxlKXtmdW5jdGlvbiBuKHQsZSxuKXtmb3IodmFyIHIscyxsLGEsdT10LnN1YnN0cmluZyhuLG4rTWF0aC5mbG9vcih0Lmxlbmd0aC80KSksYz0tMSxmPVwiXCI7LTEhPShjPWUuaW5kZXhPZih1LGMrMSkpOyl7dmFyIGg9aSh0LnN1YnN0cmluZyhuKSxlLnN1YnN0cmluZyhjKSksZz1vKHQuc3Vic3RyaW5nKDAsbiksZS5zdWJzdHJpbmcoMCxjKSk7Zi5sZW5ndGg8ZytoJiYoZj1lLnN1YnN0cmluZyhjLWcsYykrZS5zdWJzdHJpbmcoYyxjK2gpLHI9dC5zdWJzdHJpbmcoMCxuLWcpLHM9dC5zdWJzdHJpbmcobitoKSxsPWUuc3Vic3RyaW5nKDAsYy1nKSxhPWUuc3Vic3RyaW5nKGMraCkpfXJldHVybiAyKmYubGVuZ3RoPj10Lmxlbmd0aD9bcixzLGwsYSxmXTpudWxsfXZhciByPXQubGVuZ3RoPmUubGVuZ3RoP3Q6ZSxzPXQubGVuZ3RoPmUubGVuZ3RoP2U6dDtpZihyLmxlbmd0aDw0fHwyKnMubGVuZ3RoPHIubGVuZ3RoKXJldHVybiBudWxsO3ZhciBsLGE9bihyLHMsTWF0aC5jZWlsKHIubGVuZ3RoLzQpKSx1PW4ocixzLE1hdGguY2VpbChyLmxlbmd0aC8yKSk7aWYoIWEmJiF1KXJldHVybiBudWxsO2w9dT9hJiZhWzRdLmxlbmd0aD51WzRdLmxlbmd0aD9hOnU6YTt2YXIgYyxmLGgsZztyZXR1cm4gdC5sZW5ndGg+ZS5sZW5ndGg/KGM9bFswXSxmPWxbMV0saD1sWzJdLGc9bFszXSk6KGg9bFswXSxnPWxbMV0sYz1sWzJdLGY9bFszXSksW2MsZixoLGcsbFs0XV19ZnVuY3Rpb24gbCh0KXt0LnB1c2goW2QsXCJcIl0pO2Zvcih2YXIgZSxuPTAscj0wLHM9MCxhPVwiXCIsdT1cIlwiO248dC5sZW5ndGg7KXN3aXRjaCh0W25dWzBdKXtjYXNlIGc6cysrLHUrPXRbbl1bMV0sbisrO2JyZWFrO2Nhc2UgaDpyKyssYSs9dFtuXVsxXSxuKys7YnJlYWs7Y2FzZSBkOnIrcz4xPygwIT09ciYmMCE9PXMmJihlPWkodSxhKSwwIT09ZSYmKG4tci1zPjAmJnRbbi1yLXMtMV1bMF09PWQ/dFtuLXItcy0xXVsxXSs9dS5zdWJzdHJpbmcoMCxlKToodC5zcGxpY2UoMCwwLFtkLHUuc3Vic3RyaW5nKDAsZSldKSxuKyspLHU9dS5zdWJzdHJpbmcoZSksYT1hLnN1YnN0cmluZyhlKSksMCE9PShlPW8odSxhKSkmJih0W25dWzFdPXUuc3Vic3RyaW5nKHUubGVuZ3RoLWUpK3Rbbl1bMV0sdT11LnN1YnN0cmluZygwLHUubGVuZ3RoLWUpLGE9YS5zdWJzdHJpbmcoMCxhLmxlbmd0aC1lKSkpLDA9PT1yP3Quc3BsaWNlKG4tcyxyK3MsW2csdV0pOjA9PT1zP3Quc3BsaWNlKG4tcixyK3MsW2gsYV0pOnQuc3BsaWNlKG4tci1zLHIrcyxbaCxhXSxbZyx1XSksbj1uLXItcysocj8xOjApKyhzPzE6MCkrMSk6MCE9PW4mJnRbbi0xXVswXT09ZD8odFtuLTFdWzFdKz10W25dWzFdLHQuc3BsaWNlKG4sMSkpOm4rKyxzPTAscj0wLGE9XCJcIix1PVwiXCJ9XCJcIj09PXRbdC5sZW5ndGgtMV1bMV0mJnQucG9wKCk7dmFyIGM9ITE7Zm9yKG49MTtuPHQubGVuZ3RoLTE7KXRbbi0xXVswXT09ZCYmdFtuKzFdWzBdPT1kJiYodFtuXVsxXS5zdWJzdHJpbmcodFtuXVsxXS5sZW5ndGgtdFtuLTFdWzFdLmxlbmd0aCk9PXRbbi0xXVsxXT8odFtuXVsxXT10W24tMV1bMV0rdFtuXVsxXS5zdWJzdHJpbmcoMCx0W25dWzFdLmxlbmd0aC10W24tMV1bMV0ubGVuZ3RoKSx0W24rMV1bMV09dFtuLTFdWzFdK3RbbisxXVsxXSx0LnNwbGljZShuLTEsMSksYz0hMCk6dFtuXVsxXS5zdWJzdHJpbmcoMCx0W24rMV1bMV0ubGVuZ3RoKT09dFtuKzFdWzFdJiYodFtuLTFdWzFdKz10W24rMV1bMV0sdFtuXVsxXT10W25dWzFdLnN1YnN0cmluZyh0W24rMV1bMV0ubGVuZ3RoKSt0W24rMV1bMV0sdC5zcGxpY2UobisxLDEpLGM9ITApKSxuKys7YyYmbCh0KX1mdW5jdGlvbiBhKHQsZSl7aWYoMD09PWUpcmV0dXJuW2QsdF07Zm9yKHZhciBuPTAscj0wO3I8dC5sZW5ndGg7cisrKXt2YXIgaT10W3JdO2lmKGlbMF09PT1ofHxpWzBdPT09ZCl7dmFyIG89bitpWzFdLmxlbmd0aDtpZihlPT09bylyZXR1cm5bcisxLHRdO2lmKGU8byl7dD10LnNsaWNlKCk7dmFyIHM9ZS1uLGw9W2lbMF0saVsxXS5zbGljZSgwLHMpXSxhPVtpWzBdLGlbMV0uc2xpY2UocyldO3JldHVybiB0LnNwbGljZShyLDEsbCxhKSxbcisxLHRdfW49b319dGhyb3cgbmV3IEVycm9yKFwiY3Vyc29yX3BvcyBpcyBvdXQgb2YgYm91bmRzIVwiKX1mdW5jdGlvbiB1KHQsZSl7dmFyIG49YSh0LGUpLHI9blsxXSxpPW5bMF0sbz1yW2ldLHM9cltpKzFdO2lmKG51bGw9PW8pcmV0dXJuIHQ7aWYob1swXSE9PWQpcmV0dXJuIHQ7aWYobnVsbCE9cyYmb1sxXStzWzFdPT09c1sxXStvWzFdKXJldHVybiByLnNwbGljZShpLDIscyxvKSxjKHIsaSwyKTtpZihudWxsIT1zJiYwPT09c1sxXS5pbmRleE9mKG9bMV0pKXtyLnNwbGljZShpLDIsW3NbMF0sb1sxXV0sWzAsb1sxXV0pO3ZhciBsPXNbMV0uc2xpY2Uob1sxXS5sZW5ndGgpO3JldHVybiBsLmxlbmd0aD4wJiZyLnNwbGljZShpKzIsMCxbc1swXSxsXSksYyhyLGksMyl9cmV0dXJuIHR9ZnVuY3Rpb24gYyh0LGUsbil7Zm9yKHZhciByPWUrbi0xO3I+PTAmJnI+PWUtMTtyLS0paWYocisxPHQubGVuZ3RoKXt2YXIgaT10W3JdLG89dFtyKzFdO2lbMF09PT1vWzFdJiZ0LnNwbGljZShyLDIsW2lbMF0saVsxXStvWzFdXSl9cmV0dXJuIHR9ZnVuY3Rpb24gZih0KXt0LnJlcXVlc3RNb2R1bGVzKFtcIkFycmF5XCJdKS50aGVuKGZ1bmN0aW9uKCl7dmFyIGU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0LG4scixpKXtiKHRoaXMsZSk7dmFyIG89Xyh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuLHIpKTtyZXR1cm4gby50ZXh0ZmllbGRzPVtdLG8uYWNlSW5zdGFuY2VzPVtdLG8uY29kZU1pcnJvckluc3RhbmNlcz1bXSxvLm1vbmFjb0luc3RhbmNlcz1bXSxudWxsIT1pJiZcIl9cIiE9PW5bMF0mJlwic3RyaW5nXCI9PXR5cGVvZiBpJiZvLmluc2VydCgwLGkpLG99cmV0dXJuIHgoZSx0KSx5KGUsW3trZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2NvbnRlbnQubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0LnZhbH0pLmpvaW4oXCJcIil9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy50b1N0cmluZygpfX0se2tleTpcImluc2VydFwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7Zm9yKHZhciByPW4uc3BsaXQoXCJcIiksaT0wO2k8ci5sZW5ndGg7aSsrKS9bXFx1RDgwMC1cXHVERkZGXS8udGVzdChyW2ldKSYmKHJbaV09cltpXStyW2krMV0scltpKzFdPVwiXCIsaSsrKTttKGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImluc2VydFwiLHRoaXMpLmNhbGwodGhpcyx0LHIpfX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7aWYobnVsbD09biYmKG49MSksXCJudW1iZXJcIiE9dHlwZW9mIG4pdGhyb3cgbmV3IEVycm9yKFwibGVuZ3RoIG11c3QgYmUgYSBudW1iZXIhXCIpO2lmKFwibnVtYmVyXCIhPXR5cGVvZiB0KXRocm93IG5ldyBFcnJvcihcInBvcyBtdXN0IGJlIGEgbnVtYmVyIVwiKTtpZih0K24+dGhpcy5fY29udGVudC5sZW5ndGh8fHQ8MHx8bjwwKXRocm93IG5ldyBFcnJvcihcIlRoZSBkZWxldGlvbiByYW5nZSBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgYXJyYXkhXCIpO2lmKDAhPT1uKWlmKHRoaXMuX2NvbnRlbnQubGVuZ3RoPnQrbiYmXCJcIj09PXRoaXMuX2NvbnRlbnRbdCtuXS52YWwmJjI9PT10aGlzLl9jb250ZW50W3Qrbi0xXS52YWwubGVuZ3RoKXt2YXIgcj10aGlzLl9jb250ZW50W3Qrbi0xXS52YWxbMF07bShlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxuKzEpLG0oZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiaW5zZXJ0XCIsdGhpcykuY2FsbCh0aGlzLHQsW3JdKX1lbHNlIGlmKHQ+MCYmXCJcIj09PXRoaXMuX2NvbnRlbnRbdF0udmFsJiYyPT09dGhpcy5fY29udGVudFt0LTFdLnZhbC5sZW5ndGgpe3ZhciBpPXRoaXMuX2NvbnRlbnRbdC0xXS52YWxbMV07bShlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdC0xLG4rMSksbShlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJpbnNlcnRcIix0aGlzKS5jYWxsKHRoaXMsdC0xLFtpXSl9ZWxzZSBtKGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pfX0se2tleTpcInVuYmluZEFsbFwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy51bmJpbmRUZXh0YXJlYUFsbCgpLHRoaXMudW5iaW5kQWNlQWxsKCksdGhpcy51bmJpbmRDb2RlTWlycm9yQWxsKCksdGhpcy51bmJpbmRNb25hY29BbGwoKX19LHtrZXk6XCJ1bmJpbmRNb25hY29cIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLm1vbmFjb0luc3RhbmNlcy5maW5kSW5kZXgoZnVuY3Rpb24oZSl7cmV0dXJuIGUuZWRpdG9yPT09dH0pO2lmKGU+PTApe3ZhciBuPXRoaXMubW9uYWNvSW5zdGFuY2VzW2VdO3RoaXMudW5vYnNlcnZlKG4ueUNhbGxiYWNrKSxuLmRpc3Bvc2VCaW5kaW5nKCksdGhpcy5tb25hY29JbnN0YW5jZXMuc3BsaWNlKGUsMSl9fX0se2tleTpcInVuYmluZE1vbmFjb0FsbFwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMubW9uYWNvSW5zdGFuY2VzLmxlbmd0aC0xO3Q+PTA7dC0tKXRoaXMudW5iaW5kTW9uYWNvKHRoaXMubW9uYWNvSW5zdGFuY2VzW3RdLmVkaXRvcil9fSx7a2V5OlwiYmluZE1vbmFjb1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXtpZihzKXtzPSExO3RyeXt0KCl9Y2F0Y2godCl7dGhyb3cgcz0hMCxuZXcgRXJyb3IodCl9cz0hMH19ZnVuY3Rpb24gcih0KXtuKGZ1bmN0aW9uKCl7Zm9yKHZhciBlPTAsbj0xO248dC5yYW5nZS5zdGFydExpbmVOdW1iZXI7ZSsrKVwiXFxuXCI9PT1vLl9jb250ZW50W2VdLnZhbCYmbisrO3ZhciByPWUrdC5yYW5nZS5zdGFydENvbHVtbi0xO3QucmFuZ2VMZW5ndGg+MCYmby5kZWxldGUocix0LnJhbmdlTGVuZ3RoKSxvLmluc2VydChyLHQudGV4dCl9KX1mdW5jdGlvbiBpKGUpe24oZnVuY3Rpb24oKXt2YXIgbixyLGk9dC5tb2RlbC5nZXRQb3NpdGlvbkF0KGUuaW5kZXgpO1wiaW5zZXJ0XCI9PT1lLnR5cGU/KG49aSxyPWUudmFsdWVzLmpvaW4oXCJcIikpOlwiZGVsZXRlXCI9PT1lLnR5cGUmJihuPXQubW9kZWwubW9kaWZ5UG9zaXRpb24oaSxlLmxlbmd0aCkscj1cIlwiKTt2YXIgbz17c3RhcnRMaW5lTnVtYmVyOmkubGluZU51bWJlcixzdGFydENvbHVtbjppLmNvbHVtbixlbmRMaW5lTnVtYmVyOm4ubGluZU51bWJlcixlbmRDb2x1bW46bi5jb2x1bW59LHM9e21ham9yOncubWFqb3IsbWlub3I6dy5taW5vcisrfTt0LmV4ZWN1dGVFZGl0cyhcIllqc1wiLFt7aWQ6cyxyYW5nZTpvLHRleHQ6cixmb3JjZU1vdmVNYXJrZXJzOiEwfV0pfSl9dmFyIG89dGhpcztlPWV8fHt9O3ZhciBzPSEwO3Quc2V0VmFsdWUodGhpcy50b1N0cmluZygpKTt2YXIgbD10Lm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KHIpLmRpc3Bvc2U7dGhpcy5vYnNlcnZlKGkpLHRoaXMubW9uYWNvSW5zdGFuY2VzLnB1c2goe2VkaXRvcjp0LHlDYWxsYmFjazppLG1vbmFjb0NhbGxiYWNrOnIsZGlzcG9zZUJpbmRpbmc6bH0pfX0se2tleTpcInVuYmluZENvZGVNaXJyb3JcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXMuZmluZEluZGV4KGZ1bmN0aW9uKGUpe3JldHVybiBlLmVkaXRvcj09PXR9KTtpZihlPj0wKXt2YXIgbj10aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXNbZV07dGhpcy51bm9ic2VydmUobi55Q2FsbGJhY2spLG4uZWRpdG9yLm9mZihcImNoYW5nZXNcIixuLmNvZGVNaXJyb3JDYWxsYmFjayksdGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzLnNwbGljZShlLDEpfX19LHtrZXk6XCJ1bmJpbmRDb2RlTWlycm9yQWxsXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9dGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzLmxlbmd0aC0xO3Q+PTA7dC0tKXRoaXMudW5iaW5kQ29kZU1pcnJvcih0aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXNbdF0uZWRpdG9yKX19LHtrZXk6XCJiaW5kQ29kZU1pcnJvclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXtpZihzKXtzPSExO3RyeXt0KCl9Y2F0Y2godCl7dGhyb3cgcz0hMCxuZXcgRXJyb3IodCl9cz0hMH19ZnVuY3Rpb24gcihlLHIpe24oZnVuY3Rpb24oKXtmb3IodmFyIGU9MDtlPHIubGVuZ3RoO2UrKyl7dmFyIG49cltlXSxpPXQuaW5kZXhGcm9tUG9zKG4uZnJvbSk7aWYobi5yZW1vdmVkLmxlbmd0aD4wKXtmb3IodmFyIHM9MCxsPTA7bDxuLnJlbW92ZWQubGVuZ3RoO2wrKylzKz1uLnJlbW92ZWRbbF0ubGVuZ3RoO3MrPW4ucmVtb3ZlZC5sZW5ndGgtMSxvLmRlbGV0ZShpLHMpfW8uaW5zZXJ0KGksbi50ZXh0LmpvaW4oXCJcXG5cIikpfX0pfWZ1bmN0aW9uIGkoZSl7bihmdW5jdGlvbigpe3ZhciBuPXQucG9zRnJvbUluZGV4KGUuaW5kZXgpO2lmKFwiaW5zZXJ0XCI9PT1lLnR5cGUpe3ZhciByPW47dC5yZXBsYWNlUmFuZ2UoZS52YWx1ZXMuam9pbihcIlwiKSxuLHIpfWVsc2UgaWYoXCJkZWxldGVcIj09PWUudHlwZSl7dmFyIGk9dC5wb3NGcm9tSW5kZXgoZS5pbmRleCtlLmxlbmd0aCk7dC5yZXBsYWNlUmFuZ2UoXCJcIixuLGkpfX0pfXZhciBvPXRoaXM7ZT1lfHx7fTt2YXIgcz0hMDt0LnNldFZhbHVlKHRoaXMudG9TdHJpbmcoKSksdC5vbihcImNoYW5nZXNcIixyKSx0aGlzLm9ic2VydmUoaSksdGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzLnB1c2goe2VkaXRvcjp0LHlDYWxsYmFjazppLGNvZGVNaXJyb3JDYWxsYmFjazpyfSl9fSx7a2V5OlwidW5iaW5kQWNlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5hY2VJbnN0YW5jZXMuZmluZEluZGV4KGZ1bmN0aW9uKGUpe3JldHVybiBlLmVkaXRvcj09PXR9KTtpZihlPj0wKXt2YXIgbj10aGlzLmFjZUluc3RhbmNlc1tlXTt0aGlzLnVub2JzZXJ2ZShuLnlDYWxsYmFjayksbi5lZGl0b3Iub2ZmKFwiY2hhbmdlXCIsbi5hY2VDYWxsYmFjayksdGhpcy5hY2VJbnN0YW5jZXMuc3BsaWNlKGUsMSl9fX0se2tleTpcInVuYmluZEFjZUFsbFwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMuYWNlSW5zdGFuY2VzLmxlbmd0aC0xO3Q+PTA7dC0tKXRoaXMudW5iaW5kQWNlKHRoaXMuYWNlSW5zdGFuY2VzW3RdLmVkaXRvcil9fSx7a2V5OlwiYmluZEFjZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXtpZihzKXtzPSExO3RyeXt0KCl9Y2F0Y2godCl7dGhyb3cgcz0hMCxuZXcgRXJyb3IodCl9cz0hMH19ZnVuY3Rpb24gcihlKXtuKGZ1bmN0aW9uKCl7dmFyIG4scixpPXQuZ2V0U2Vzc2lvbigpLmdldERvY3VtZW50KCk7XCJpbnNlcnRcIj09PWUuYWN0aW9uPyhuPWkucG9zaXRpb25Ub0luZGV4KGUuc3RhcnQsMCksby5pbnNlcnQobixlLmxpbmVzLmpvaW4oXCJcXG5cIikpKTpcInJlbW92ZVwiPT09ZS5hY3Rpb24mJihuPWkucG9zaXRpb25Ub0luZGV4KGUuc3RhcnQsMCkscj1lLmxpbmVzLmpvaW4oXCJcXG5cIikubGVuZ3RoLG8uZGVsZXRlKG4scikpfSl9ZnVuY3Rpb24gaShlKXt2YXIgcj10LmdldFNlc3Npb24oKS5nZXREb2N1bWVudCgpO24oZnVuY3Rpb24oKXtpZihcImluc2VydFwiPT09ZS50eXBlKXt2YXIgdD1yLmluZGV4VG9Qb3NpdGlvbihlLmluZGV4LDApO3IuaW5zZXJ0KHQsZS52YWx1ZXMuam9pbihcIlwiKSl9ZWxzZSBpZihcImRlbGV0ZVwiPT09ZS50eXBlKXt2YXIgbj1yLmluZGV4VG9Qb3NpdGlvbihlLmluZGV4LDApLGk9ci5pbmRleFRvUG9zaXRpb24oZS5pbmRleCtlLmxlbmd0aCwwKSxvPW5ldyB1KG4ucm93LG4uY29sdW1uLGkucm93LGkuY29sdW1uKTtyLnJlbW92ZShvKX19KX12YXIgbz10aGlzO2U9ZXx8e307dmFyIHM9ITA7dC5zZXRWYWx1ZSh0aGlzLnRvU3RyaW5nKCkpLHQub24oXCJjaGFuZ2VcIixyKSx0LnNlbGVjdGlvbi5jbGVhclNlbGVjdGlvbigpO3ZhciBsO2w9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGFjZSYmbnVsbD09ZS5hY2VDbGFzcz9hY2U6ZS5hY2VDbGFzczt2YXIgYT1lLmFjZVJlcXVpcmV8fGwucmVxdWlyZSx1PWEoXCJhY2UvcmFuZ2VcIikuUmFuZ2U7dGhpcy5vYnNlcnZlKGkpLHRoaXMuYWNlSW5zdGFuY2VzLnB1c2goe2VkaXRvcjp0LHlDYWxsYmFjazppLGFjZUNhbGxiYWNrOnJ9KX19LHtrZXk6XCJiaW5kXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHNbMF07dCBpbnN0YW5jZW9mIEVsZW1lbnQ/dGhpcy5iaW5kVGV4dGFyZWEuYXBwbHkodGhpcyxhcmd1bWVudHMpOm51bGwhPXQmJm51bGwhPXQuc2Vzc2lvbiYmbnVsbCE9dC5nZXRTZXNzaW9uJiZudWxsIT10LnNldFZhbHVlP3RoaXMuYmluZEFjZS5hcHBseSh0aGlzLGFyZ3VtZW50cyk6bnVsbCE9dCYmbnVsbCE9dC5wb3NGcm9tSW5kZXgmJm51bGwhPXQucmVwbGFjZVJhbmdlP3RoaXMuYmluZENvZGVNaXJyb3IuYXBwbHkodGhpcyxhcmd1bWVudHMpOm51bGwhPXQmJm51bGwhPXQub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQ/dGhpcy5iaW5kTW9uYWNvLmFwcGx5KHRoaXMsYXJndW1lbnRzKTpjb25zb2xlLmVycm9yKFwiQ2Fubm90IGJpbmQsIHVuc3VwcG9ydGVkIGVkaXRvciFcIil9fSx7a2V5OlwidW5iaW5kVGV4dGFyZWFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnRleHRmaWVsZHMuZmluZEluZGV4KGZ1bmN0aW9uKGUpe3JldHVybiBlLmVkaXRvcj09PXR9KTtpZihlPj0wKXt2YXIgbj10aGlzLnRleHRmaWVsZHNbZV07dGhpcy51bm9ic2VydmUobi55Q2FsbGJhY2spO24uZWRpdG9yLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLG4uZXZlbnRMaXN0ZW5lciksdGhpcy50ZXh0ZmllbGRzLnNwbGljZShlLDEpfX19LHtrZXk6XCJ1bmJpbmRUZXh0YXJlYUFsbFwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMudGV4dGZpZWxkcy5sZW5ndGgtMTt0Pj0wO3QtLSl0aGlzLnVuYmluZFRleHRhcmVhKHRoaXMudGV4dGZpZWxkc1t0XS5lZGl0b3IpfX0se2tleTpcImJpbmRUZXh0YXJlYVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXtpZihvKXtvPSExO3RyeXt0KCl9Y2F0Y2godCl7dGhyb3cgbz0hMCxuZXcgRXJyb3IodCl9bz0hMH19ZnVuY3Rpb24gcih0KXtuKGZ1bmN0aW9uKCl7dmFyIGUsbjtpZihcImluc2VydFwiPT09dC50eXBlKXtlPXQuaW5kZXgsbj1mdW5jdGlvbih0KXtyZXR1cm4gdDw9ZT90OnQrPTF9O3ZhciByPWwobik7YShyKX1lbHNlXCJkZWxldGVcIj09PXQudHlwZSYmKGU9dC5pbmRleCxuPWZ1bmN0aW9uKHQpe3JldHVybiB0PGU/dDp0LT0xfSxyPWwobiksYShyKSl9KX1lPWV8fHdpbmRvdyxudWxsPT1lLmdldFNlbGVjdGlvbiYmKGU9d2luZG93KTtmb3IodmFyIGk9MDtpPHRoaXMudGV4dGZpZWxkcy5sZW5ndGg7aSsrKWlmKHRoaXMudGV4dGZpZWxkc1tpXS5lZGl0b3I9PT10KXJldHVybjt2YXIgbz0hMCxzPXRoaXM7dC52YWx1ZT10aGlzLnRvU3RyaW5nKCk7dmFyIGwsYSx1LGM7bnVsbCE9dC5zZWxlY3Rpb25TdGFydCYmbnVsbCE9dC5zZXRTZWxlY3Rpb25SYW5nZT8obD1mdW5jdGlvbihlKXt2YXIgbj10LnNlbGVjdGlvblN0YXJ0LHI9dC5zZWxlY3Rpb25FbmQ7cmV0dXJuIG51bGwhPWUmJihuPWUobikscj1lKHIpKSx7bGVmdDpuLHJpZ2h0OnJ9fSxhPWZ1bmN0aW9uKGUpe3Uocy50b1N0cmluZygpKSx0LnNldFNlbGVjdGlvblJhbmdlKGUubGVmdCxlLnJpZ2h0KX0sdT1mdW5jdGlvbihlKXt0LnZhbHVlPWV9LGM9ZnVuY3Rpb24oKXtyZXR1cm4gdC52YWx1ZX0pOihsPWZ1bmN0aW9uKG4pe3ZhciByPXt9LGk9ZS5nZXRTZWxlY3Rpb24oKSxvPXQudGV4dENvbnRlbnQubGVuZ3RoO3IubGVmdD1NYXRoLm1pbihpLmFuY2hvck9mZnNldCxvKSxyLnJpZ2h0PU1hdGgubWluKGkuZm9jdXNPZmZzZXQsbyksbnVsbCE9biYmKHIubGVmdD1uKHIubGVmdCksci5yaWdodD1uKHIucmlnaHQpKTt2YXIgcz1pLmZvY3VzTm9kZTtyZXR1cm4gcz09PXR8fHM9PT10LmNoaWxkTm9kZXNbMF0/ci5pc1JlYWw9ITA6ci5pc1JlYWw9ITEscn0sYT1mdW5jdGlvbihuKXt1KHMudG9TdHJpbmcoKSk7dmFyIHI9dC5jaGlsZE5vZGVzWzBdO2lmKG4uaXNSZWFsJiZudWxsIT1yKXtuLmxlZnQ8MCYmKG4ubGVmdD0wKSxuLnJpZ2h0PU1hdGgubWF4KG4ubGVmdCxuLnJpZ2h0KSxuLnJpZ2h0PnIubGVuZ3RoJiYobi5yaWdodD1yLmxlbmd0aCksbi5sZWZ0PU1hdGgubWluKG4ubGVmdCxuLnJpZ2h0KTt2YXIgaT1kb2N1bWVudC5jcmVhdGVSYW5nZSgpO2kuc2V0U3RhcnQocixuLmxlZnQpLGkuc2V0RW5kKHIsbi5yaWdodCk7dmFyIG89ZS5nZXRTZWxlY3Rpb24oKTtvLnJlbW92ZUFsbFJhbmdlcygpLG8uYWRkUmFuZ2UoaSl9fSx1PWZ1bmN0aW9uKGUpe3QuaW5uZXJUZXh0PWV9LGM9ZnVuY3Rpb24oKXtyZXR1cm4gdC5pbm5lclRleHR9KSx1KHRoaXMudG9TdHJpbmcoKSksdGhpcy5vYnNlcnZlKHIpO3ZhciBmPWZ1bmN0aW9uKCl7bihmdW5jdGlvbigpe2Zvcih2YXIgdD1sKGZ1bmN0aW9uKHQpe3JldHVybiB0fSksZT1zLnRvU3RyaW5nKCksbj1jKCkscj1wKGUsbix0LmxlZnQpLGk9MCxvPTA7bzxyLmxlbmd0aDtvKyspe3ZhciBhPXJbb107MD09PWFbMF0/aSs9YVsxXS5sZW5ndGg6LTE9PT1hWzBdP3MuZGVsZXRlKGksYVsxXS5sZW5ndGgpOihzLmluc2VydChpLGFbMV0pLGkrPWFbMV0ubGVuZ3RoKX19KX07dC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIixmKSx0aGlzLnRleHRmaWVsZHMucHVzaCh7ZWRpdG9yOnQseUNhbGxiYWNrOnIsZXZlbnRMaXN0ZW5lcjpmfSl9fSx7a2V5OlwiX2Rlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudW5iaW5kQWxsKCksdGhpcy50ZXh0ZmllbGRzPW51bGwsdGhpcy5hY2VJbnN0YW5jZXM9bnVsbCxtKGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9kZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0odC5BcnJheS50eXBlRGVmaW5pdGlvbi5jbGFzcyk7dC5leHRlbmQoXCJUZXh0XCIsbmV3IHQudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe25hbWU6XCJUZXh0XCIsY2xhc3M6ZSxzdHJ1Y3Q6XCJMaXN0XCIscGFyc2VBcmd1bWVudHM6ZnVuY3Rpb24odCl7cmV0dXJuXCJzdHJpbmdcIj09dHlwZW9mIHQ/W3RoaXMsdF06W3RoaXMsbnVsbF19LGluaXRUeXBlOmZ1bmN0aW9uKG4scil7dmFyIGk9W107cmV0dXJuIHQuU3RydWN0Lkxpc3QubWFwLmNhbGwodGhpcyxyLGZ1bmN0aW9uKHQpe2lmKHQuaGFzT3duUHJvcGVydHkoXCJvcENvbnRlbnRcIikpdGhyb3cgbmV3IEVycm9yKFwiVGV4dCBtdXN0IG5vdCBjb250YWluIHR5cGVzIVwiKTt0LmNvbnRlbnQuZm9yRWFjaChmdW5jdGlvbihlLG4pe2kucHVzaCh7aWQ6W3QuaWRbMF0sdC5pZFsxXStuXSx2YWw6dC5jb250ZW50W25dfSl9KX0pLG5ldyBlKG4sci5pZCxpKX0sY3JlYXRlVHlwZTpmdW5jdGlvbih0LG4scil7cmV0dXJuIG5ldyBlKHQsbi5pZCxbXSxyKX19KSl9KX12YXIgaD0tMSxnPTEsZD0wLHY9dDt2LklOU0VSVD1nLHYuREVMRVRFPWgsdi5FUVVBTD1kO3ZhciBwPXYsYj1mdW5jdGlvbih0LGUpe2lmKCEodCBpbnN0YW5jZW9mIGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIil9LHk9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7Zm9yKHZhciBuPTA7bjxlLmxlbmd0aDtuKyspe3ZhciByPWVbbl07ci5lbnVtZXJhYmxlPXIuZW51bWVyYWJsZXx8ITEsci5jb25maWd1cmFibGU9ITAsXCJ2YWx1ZVwiaW4gciYmKHIud3JpdGFibGU9ITApLE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0LHIua2V5LHIpfX1yZXR1cm4gZnVuY3Rpb24oZSxuLHIpe3JldHVybiBuJiZ0KGUucHJvdG90eXBlLG4pLHImJnQoZSxyKSxlfX0oKSxtPWZ1bmN0aW9uIHQoZSxuLHIpe251bGw9PT1lJiYoZT1GdW5jdGlvbi5wcm90b3R5cGUpO3ZhciBpPU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZSxuKTtpZih2b2lkIDA9PT1pKXt2YXIgbz1PYmplY3QuZ2V0UHJvdG90eXBlT2YoZSk7cmV0dXJuIG51bGw9PT1vP3ZvaWQgMDp0KG8sbixyKX1pZihcInZhbHVlXCJpbiBpKXJldHVybiBpLnZhbHVlO3ZhciBzPWkuZ2V0O2lmKHZvaWQgMCE9PXMpcmV0dXJuIHMuY2FsbChyKX0seD1mdW5jdGlvbih0LGUpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUmJm51bGwhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiBlKTt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGUmJmUucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6dCxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSxlJiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZih0LGUpOnQuX19wcm90b19fPWUpfSxfPWZ1bmN0aW9uKHQsZSl7aWYoIXQpdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO3JldHVybiFlfHxcIm9iamVjdFwiIT10eXBlb2YgZSYmXCJmdW5jdGlvblwiIT10eXBlb2YgZT90OmV9LHc9e21ham9yOjAsbWlub3I6MH07cmV0dXJuXCJ1bmRlZmluZWRcIiE9dHlwZW9mIFkmJmYoWSksZn0pO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eS10ZXh0LmpzLm1hcFxuIiwiZnVuY3Rpb24gZXh0ZW5kIChZKSB7XG5cbnZhciBVU0VfQVVESU8gPSB0cnVlO1xudmFyIFVTRV9WSURFTyA9IHRydWU7XG52YXIgREVGQVVMVF9DSEFOTkVMID0gJ3NvbWUtZ2xvYmFsLWNoYW5uZWwtbmFtZSc7XG52YXIgTVVURV9BVURJT19CWV9ERUZBVUxUID0gZmFsc2U7XG52YXIgc2lnbmFsaW5nX3NlcnZlcl91cmwgPSAnaHR0cDovL2Zpbndpbi5pbzoxMjU2JztcblxudmFyIElDRV9TRVJWRVJTID0gW1xuICAgIHt1cmxzOiBcInN0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDJcIn0sXG4gICAge3VybHM6IFwidHVybjp0cnkucmVmYWN0b3JlZC5haTozNDc4XCIsIHVzZXJuYW1lOiBcInRlc3Q5OVwiLCBjcmVkZW50aWFsOiBcInRlc3RcIn1cbl07XG5cblxudmFyIGRjcyA9IHt9O1xudmFyIHNpZ25hbGluZ19zb2NrZXQgPSBudWxsOyAgIC8qIG91ciBzb2NrZXQuaW8gY29ubmVjdGlvbiB0byBvdXIgd2Vic2VydmVyICovXG52YXIgbG9jYWxfbWVkaWFfc3RyZWFtID0gbnVsbDsgLyogb3VyIG93biBtaWNyb3Bob25lIC8gd2ViY2FtICovXG52YXIgcGVlcnMgPSB7fTsgICAgICAgICAgICAgICAgLyoga2VlcCB0cmFjayBvZiBvdXIgcGVlciBjb25uZWN0aW9ucywgaW5kZXhlZCBieSBwZWVyX2lkIChha2Egc29ja2V0LmlvIGlkKSAqL1xudmFyIHBlZXJfbWVkaWFfZWxlbWVudHMgPSB7fTsgIC8qIGtlZXAgdHJhY2sgb2Ygb3VyIDx2aWRlbz4vPGF1ZGlvPiB0YWdzLCBpbmRleGVkIGJ5IHBlZXJfaWQgKi9cbnZhciBpc19maXJzdCA9ICd1bmtub3duJztcblxuZnVuY3Rpb24gaW5pdCh5d2VicnRjKSB7XG4gICAgc2lnbmFsaW5nX3NvY2tldCA9IGlvLmNvbm5lY3Qoc2lnbmFsaW5nX3NlcnZlcl91cmwpO1xuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignY29ubmVjdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBqb2luX2NoYXRfY2hhbm5lbChERUZBVUxUX0NIQU5ORUwsIHsnd2hhdGV2ZXIteW91LXdhbnQtaGVyZSc6ICdzdHVmZid9KTtcbiAgICB9KTtcblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3NvY2tldHMnLCBmdW5jdGlvbiAoc29ja2V0cykge1xuICAgICAgICBpZiAoc29ja2V0cyA9PT0gMCkge1xuICAgICAgICAgICAgaXNfZmlyc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaXNfZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignZGlzY29ubmVjdCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAvKiBUZWFyIGRvd24gYWxsIG9mIG91ciBwZWVyIGNvbm5lY3Rpb25zIGFuZCByZW1vdmUgYWxsIHRoZVxuICAgICAgICAgKiBtZWRpYSBkaXZzIHdoZW4gd2UgZGlzY29ubmVjdCAqL1xuICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcl9tZWRpYV9lbGVtZW50cykge1xuICAgICAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50c1twZWVyX2lkXS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcnMpIHtcbiAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdLmNsb3NlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBwZWVycyA9IHt9O1xuICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzID0ge307XG4gICAgfSk7XG4gICAgZnVuY3Rpb24gam9pbl9jaGF0X2NoYW5uZWwoY2hhbm5lbCwgdXNlcmRhdGEpIHtcbiAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdqb2luJywge1wiY2hhbm5lbFwiOiBjaGFubmVsLCBcInVzZXJkYXRhXCI6IHVzZXJkYXRhfSk7XG4gICAgICAgIHl3ZWJydGMuc2V0VXNlcklkKHNpZ25hbGluZ19zb2NrZXQuaWQpO1xuICAgICAgICBmdW5jdGlvbiBsb2FkX25vdGVib29rMihmaWxlX25hbWUpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgSnVweXRlciAhPT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgICAgICAgICAgIGlmIChKdXB5dGVyLm5vdGVib29rKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWxlX25hbWUgPT09ICdVbnRpdGxlZC5pcHluYicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2subG9hZF9ub3RlYm9vayhmaWxlX25hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgSnVweXRlci5ub3RlYm9vay5sb2FkX25vdGVib29rMihmaWxlX25hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRfbm90ZWJvb2syLCA1MDAsIGZpbGVfbmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChsb2FkX25vdGVib29rMiwgNTAwLCBmaWxlX25hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGluaXRpYWxpemVfZGF0YSgpIHtcbiAgICAgICAgICAgIGlmIChpc19maXJzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGxvYWRfbm90ZWJvb2syKCdVbnRpdGxlZC5pcHluYicpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc19maXJzdCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBsb2FkX25vdGVib29rMigndGVtcGxhdGUuaXB5bmInKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChpbml0aWFsaXplX2RhdGEsIDUwMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaW5pdGlhbGl6ZV9kYXRhKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnRfY2hhdF9jaGFubmVsKGNoYW5uZWwpIHtcbiAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdwYXJ0JywgY2hhbm5lbCk7XG4gICAgfVxuXG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdhZGRQZWVyJywgZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cbiAgICAgICAgeXdlYnJ0Yy51c2VySm9pbmVkKHBlZXJfaWQsICdtYXN0ZXInKTtcblxuICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVycykge1xuICAgICAgICAgICAgLyogVGhpcyBjb3VsZCBoYXBwZW4gaWYgdGhlIHVzZXIgam9pbnMgbXVsdGlwbGUgY2hhbm5lbHMgd2hlcmUgdGhlIG90aGVyIHBlZXIgaXMgYWxzbyBpbi4gKi9cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwZWVyX2Nvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oe1wiaWNlU2VydmVyc1wiOiBJQ0VfU0VSVkVSU30pO1xuICAgICAgICBwZWVyc1twZWVyX2lkXSA9IHBlZXJfY29ubmVjdGlvbjtcbiAgICAgICAgdmFyIGRhdGFDaGFubmVsID0gcGVlcl9jb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKCdkYXRhJyk7XG4gICAgICAgIGRjc1twZWVyX2lkXSA9IGRhdGFDaGFubmVsO1xuICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZU1lc3NhZ2UocGVlcl9pZCwgSlNPTi5wYXJzZShlLmRhdGEpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwZWVyX2Nvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmNhbmRpZGF0ZSkge1xuICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlJQ0VDYW5kaWRhdGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICdwZWVyX2lkJzogcGVlcl9pZCwgXG4gICAgICAgICAgICAgICAgICAgICdpY2VfY2FuZGlkYXRlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3NkcE1MaW5lSW5kZXgnOiBldmVudC5jYW5kaWRhdGUuc2RwTUxpbmVJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjYW5kaWRhdGUnOiBldmVudC5jYW5kaWRhdGUuY2FuZGlkYXRlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcuc2hvdWxkX2NyZWF0ZV9vZmZlcikge1xuICAgICAgICAgICAgcGVlcl9jb25uZWN0aW9uLmNyZWF0ZU9mZmVyKFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChsb2NhbF9kZXNjcmlwdGlvbikgeyBcbiAgICAgICAgICAgICAgICAgICAgcGVlcl9jb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24obG9jYWxfZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheVNlc3Npb25EZXNjcmlwdGlvbicsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J3BlZXJfaWQnOiBwZWVyX2lkLCAnc2Vzc2lvbl9kZXNjcmlwdGlvbic6IGxvY2FsX2Rlc2NyaXB0aW9ufSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7IEFsZXJ0KFwiT2ZmZXIgc2V0TG9jYWxEZXNjcmlwdGlvbiBmYWlsZWQhXCIpOyB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBzZW5kaW5nIG9mZmVyOiBcIiwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIC8qKiBcbiAgICAgKiBQZWVycyBleGNoYW5nZSBzZXNzaW9uIGRlc2NyaXB0aW9ucyB3aGljaCBjb250YWlucyBpbmZvcm1hdGlvblxuICAgICAqIGFib3V0IHRoZWlyIGF1ZGlvIC8gdmlkZW8gc2V0dGluZ3MgYW5kIHRoYXQgc29ydCBvZiBzdHVmZi4gRmlyc3RcbiAgICAgKiB0aGUgJ29mZmVyZXInIHNlbmRzIGEgZGVzY3JpcHRpb24gdG8gdGhlICdhbnN3ZXJlcicgKHdpdGggdHlwZVxuICAgICAqIFwib2ZmZXJcIiksIHRoZW4gdGhlIGFuc3dlcmVyIHNlbmRzIG9uZSBiYWNrICh3aXRoIHR5cGUgXCJhbnN3ZXJcIikuICBcbiAgICAgKi9cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdzZXNzaW9uRGVzY3JpcHRpb24nLCBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcbiAgICAgICAgdmFyIHBlZXIgPSBwZWVyc1twZWVyX2lkXTtcblxuICAgICAgICBwZWVyLm9uZGF0YWNoYW5uZWwgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhQ2hhbm5lbCA9IGV2ZW50LmNoYW5uZWw7XG4gICAgICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlTWVzc2FnZShwZWVyX2lkLCBKU09OLnBhcnNlKGUuZGF0YSkpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgcmVtb3RlX2Rlc2NyaXB0aW9uID0gY29uZmlnLnNlc3Npb25fZGVzY3JpcHRpb247XG5cbiAgICAgICAgdmFyIGRlc2MgPSBuZXcgUlRDU2Vzc2lvbkRlc2NyaXB0aW9uKHJlbW90ZV9kZXNjcmlwdGlvbik7XG4gICAgICAgIHZhciBzdHVmZiA9IHBlZXIuc2V0UmVtb3RlRGVzY3JpcHRpb24oZGVzYywgXG4gICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVtb3RlX2Rlc2NyaXB0aW9uLnR5cGUgPT0gXCJvZmZlclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZXIuY3JlYXRlQW5zd2VyKFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24obG9jYWxfZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWVyLnNldExvY2FsRGVzY3JpcHRpb24obG9jYWxfZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlTZXNzaW9uRGVzY3JpcHRpb24nLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J3BlZXJfaWQnOiBwZWVyX2lkLCAnc2Vzc2lvbl9kZXNjcmlwdGlvbic6IGxvY2FsX2Rlc2NyaXB0aW9ufSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkgeyBBbGVydChcIkFuc3dlciBzZXRMb2NhbERlc2NyaXB0aW9uIGZhaWxlZCFcIik7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBjcmVhdGluZyBhbnN3ZXI6IFwiLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInNldFJlbW90ZURlc2NyaXB0aW9uIGVycm9yOiBcIiwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgfSk7XG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdpY2VDYW5kaWRhdGUnLCBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdmFyIHBlZXIgPSBwZWVyc1tjb25maWcucGVlcl9pZF07XG4gICAgICAgIHZhciBpY2VfY2FuZGlkYXRlID0gY29uZmlnLmljZV9jYW5kaWRhdGU7XG4gICAgICAgIHBlZXIuYWRkSWNlQ2FuZGlkYXRlKG5ldyBSVENJY2VDYW5kaWRhdGUoaWNlX2NhbmRpZGF0ZSkpO1xuICAgIH0pO1xuXG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdyZW1vdmVQZWVyJywgZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG4gICAgICAgIHl3ZWJydGMudXNlckxlZnQocGVlcl9pZCk7XG4gICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJfbWVkaWFfZWxlbWVudHMpIHtcbiAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHNbcGVlcl9pZF0ucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcnMpIHtcbiAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdLmNsb3NlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgcGVlcnNbcGVlcl9pZF07XG4gICAgICAgIGRlbGV0ZSBwZWVyX21lZGlhX2VsZW1lbnRzW2NvbmZpZy5wZWVyX2lkXTtcbiAgICB9KTtcbn1cblxuXG4gIGNsYXNzIFdlYlJUQyBleHRlbmRzIFkuQWJzdHJhY3RDb25uZWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yICh5LCBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT3B0aW9ucyBtdXN0IG5vdCBiZSB1bmRlZmluZWQhJylcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLnJvb20gPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBhIHJvb20gbmFtZSEnKVxuICAgICAgfVxuICAgICAgb3B0aW9ucy5yb2xlID0gJ3NsYXZlJ1xuICAgICAgc3VwZXIoeSwgb3B0aW9ucylcbiAgICAgIHRoaXMud2VicnRjT3B0aW9ucyA9IHtcbiAgICAgICAgdXJsOiBvcHRpb25zLnVybCxcbiAgICAgICAgcm9vbTogb3B0aW9ucy5yb29tXG4gICAgICB9XG4gICAgICB2YXIgeXdlYnJ0YyA9IHRoaXM7XG4gICAgICBpbml0KHl3ZWJydGMpO1xuICAgICAgdmFyIHN3ciA9IHNpZ25hbGluZ19zb2NrZXQ7XG4gICAgICB0aGlzLnN3ciA9IHN3cjtcbiAgICB9XG4gICAgZGlzY29ubmVjdCAoKSB7XG4gICAgICBjb25zb2xlLmxvZygnaW1wbGVtZW50IGRpc2Nvbm5lY3Qgb2YgY2hhbm5lbCcpO1xuICAgICAgc3VwZXIuZGlzY29ubmVjdCgpXG4gICAgfVxuICAgIHJlY29ubmVjdCAoKSB7XG4gICAgICBjb25zb2xlLmxvZygnaW1wbGVtZW50IHJlY29ubmVjdCBvZiBjaGFubmVsJyk7XG4gICAgICBzdXBlci5yZWNvbm5lY3QoKVxuICAgIH1cbiAgICBzZW5kICh1aWQsIG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIHZhciBzZW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGRjID0gZGNzW3VpZF07XG4gICAgICAgICAgICBpZiAoZGMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgICAgICAgICAgZGMuc2VuZChKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHNlbmQsIDUwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0cnkgdG8gc2VuZCB0aGUgbWVzc2FnZVxuICAgICAgICBzZW5kKClcbiAgICB9XG4gICAgYnJvYWRjYXN0IChtZXNzYWdlKSB7XG4gICAgICAgIGZvciAodmFyIHBlZXJfaWQgaW4gZGNzKSB7XG4gICAgICAgICAgICB2YXIgZGMgPSBkY3NbcGVlcl9pZF07XG4gICAgICAgICAgICBpZiAoZGMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgICAgICAgICAgZGMuc2VuZChKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnInLCBwZWVyX2lkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpc0Rpc2Nvbm5lY3RlZCAoKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbiAgWS5leHRlbmQoJ3dlYnJ0YycsIFdlYlJUQylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCIvKipcbiAqIHkteG1sMiAtIFhtbCBUeXBlIGZvciBZanNcbiAqIEB2ZXJzaW9uIHYxLjUuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbiFmdW5jdGlvbih0LGUpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPWUoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKGUpOnQueVhtbD1lKCl9KHRoaXMsZnVuY3Rpb24oKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiB0KHQsbixyKXtpZih0PT1uKXJldHVybiB0P1tbeCx0XV06W107KHI8MHx8dC5sZW5ndGg8cikmJihyPW51bGwpO3ZhciBsPW8odCxuKSx1PXQuc3Vic3RyaW5nKDAsbCk7dD10LnN1YnN0cmluZyhsKSxuPW4uc3Vic3RyaW5nKGwpLGw9aSh0LG4pO3ZhciBjPXQuc3Vic3RyaW5nKHQubGVuZ3RoLWwpO3Q9dC5zdWJzdHJpbmcoMCx0Lmxlbmd0aC1sKSxuPW4uc3Vic3RyaW5nKDAsbi5sZW5ndGgtbCk7dmFyIGg9ZSh0LG4pO3JldHVybiB1JiZoLnVuc2hpZnQoW3gsdV0pLGMmJmgucHVzaChbeCxjXSkscyhoKSxudWxsIT1yJiYoaD1hKGgscikpLGh9ZnVuY3Rpb24gZShlLHIpe3ZhciBvO2lmKCFlKXJldHVybltbRCxyXV07aWYoIXIpcmV0dXJuW1tPLGVdXTt2YXIgaT1lLmxlbmd0aD5yLmxlbmd0aD9lOnIscz1lLmxlbmd0aD5yLmxlbmd0aD9yOmUsdT1pLmluZGV4T2Yocyk7aWYoLTEhPXUpcmV0dXJuIG89W1tELGkuc3Vic3RyaW5nKDAsdSldLFt4LHNdLFtELGkuc3Vic3RyaW5nKHUrcy5sZW5ndGgpXV0sZS5sZW5ndGg+ci5sZW5ndGgmJihvWzBdWzBdPW9bMl1bMF09TyksbztpZigxPT1zLmxlbmd0aClyZXR1cm5bW08sZV0sW0Qscl1dO3ZhciBhPWwoZSxyKTtpZihhKXt2YXIgYz1hWzBdLGg9YVsxXSxkPWFbMl0sZj1hWzNdLHA9YVs0XSxtPXQoYyxkKSx2PXQoaCxmKTtyZXR1cm4gbS5jb25jYXQoW1t4LHBdXSx2KX1yZXR1cm4gbihlLHIpfWZ1bmN0aW9uIG4odCxlKXtmb3IodmFyIG49dC5sZW5ndGgsbz1lLmxlbmd0aCxpPU1hdGguY2VpbCgobitvKS8yKSxsPWkscz0yKmksdT1uZXcgQXJyYXkocyksYT1uZXcgQXJyYXkocyksYz0wO2M8cztjKyspdVtjXT0tMSxhW2NdPS0xO3VbbCsxXT0wLGFbbCsxXT0wO2Zvcih2YXIgaD1uLW8sZD1oJTIhPTAsZj0wLHA9MCxtPTAsdj0wLHk9MDt5PGk7eSsrKXtmb3IodmFyIF89LXkrZjtfPD15LXA7Xys9Mil7dmFyIGcsYj1sK187Zz1fPT0teXx8XyE9eSYmdVtiLTFdPHVbYisxXT91W2IrMV06dVtiLTFdKzE7Zm9yKHZhciBFPWctXztnPG4mJkU8byYmdC5jaGFyQXQoZyk9PWUuY2hhckF0KEUpOylnKyssRSsrO2lmKHVbYl09ZyxnPm4pcCs9MjtlbHNlIGlmKEU+bylmKz0yO2Vsc2UgaWYoZCl7dmFyIHg9bCtoLV87aWYoeD49MCYmeDxzJiYtMSE9YVt4XSl7dmFyIHc9bi1hW3hdO2lmKGc+PXcpcmV0dXJuIHIodCxlLGcsRSl9fX1mb3IodmFyIGs9LXkrbTtrPD15LXY7ays9Mil7dmFyIHcseD1sK2s7dz1rPT0teXx8ayE9eSYmYVt4LTFdPGFbeCsxXT9hW3grMV06YVt4LTFdKzE7Zm9yKHZhciBUPXctazt3PG4mJlQ8byYmdC5jaGFyQXQobi13LTEpPT1lLmNoYXJBdChvLVQtMSk7KXcrKyxUKys7aWYoYVt4XT13LHc+bil2Kz0yO2Vsc2UgaWYoVD5vKW0rPTI7ZWxzZSBpZighZCl7dmFyIGI9bCtoLWs7aWYoYj49MCYmYjxzJiYtMSE9dVtiXSl7dmFyIGc9dVtiXSxFPWwrZy1iO2lmKHc9bi13LGc+PXcpcmV0dXJuIHIodCxlLGcsRSl9fX19cmV0dXJuW1tPLHRdLFtELGVdXX1mdW5jdGlvbiByKGUsbixyLG8pe3ZhciBpPWUuc3Vic3RyaW5nKDAsciksbD1uLnN1YnN0cmluZygwLG8pLHM9ZS5zdWJzdHJpbmcociksdT1uLnN1YnN0cmluZyhvKSxhPXQoaSxsKSxjPXQocyx1KTtyZXR1cm4gYS5jb25jYXQoYyl9ZnVuY3Rpb24gbyh0LGUpe2lmKCF0fHwhZXx8dC5jaGFyQXQoMCkhPWUuY2hhckF0KDApKXJldHVybiAwO2Zvcih2YXIgbj0wLHI9TWF0aC5taW4odC5sZW5ndGgsZS5sZW5ndGgpLG89cixpPTA7bjxvOyl0LnN1YnN0cmluZyhpLG8pPT1lLnN1YnN0cmluZyhpLG8pPyhuPW8saT1uKTpyPW8sbz1NYXRoLmZsb29yKChyLW4pLzIrbik7cmV0dXJuIG99ZnVuY3Rpb24gaSh0LGUpe2lmKCF0fHwhZXx8dC5jaGFyQXQodC5sZW5ndGgtMSkhPWUuY2hhckF0KGUubGVuZ3RoLTEpKXJldHVybiAwO2Zvcih2YXIgbj0wLHI9TWF0aC5taW4odC5sZW5ndGgsZS5sZW5ndGgpLG89cixpPTA7bjxvOyl0LnN1YnN0cmluZyh0Lmxlbmd0aC1vLHQubGVuZ3RoLWkpPT1lLnN1YnN0cmluZyhlLmxlbmd0aC1vLGUubGVuZ3RoLWkpPyhuPW8saT1uKTpyPW8sbz1NYXRoLmZsb29yKChyLW4pLzIrbik7cmV0dXJuIG99ZnVuY3Rpb24gbCh0LGUpe2Z1bmN0aW9uIG4odCxlLG4pe2Zvcih2YXIgcixsLHMsdSxhPXQuc3Vic3RyaW5nKG4sbitNYXRoLmZsb29yKHQubGVuZ3RoLzQpKSxjPS0xLGg9XCJcIjstMSE9KGM9ZS5pbmRleE9mKGEsYysxKSk7KXt2YXIgZD1vKHQuc3Vic3RyaW5nKG4pLGUuc3Vic3RyaW5nKGMpKSxmPWkodC5zdWJzdHJpbmcoMCxuKSxlLnN1YnN0cmluZygwLGMpKTtoLmxlbmd0aDxmK2QmJihoPWUuc3Vic3RyaW5nKGMtZixjKStlLnN1YnN0cmluZyhjLGMrZCkscj10LnN1YnN0cmluZygwLG4tZiksbD10LnN1YnN0cmluZyhuK2QpLHM9ZS5zdWJzdHJpbmcoMCxjLWYpLHU9ZS5zdWJzdHJpbmcoYytkKSl9cmV0dXJuIDIqaC5sZW5ndGg+PXQubGVuZ3RoP1tyLGwscyx1LGhdOm51bGx9dmFyIHI9dC5sZW5ndGg+ZS5sZW5ndGg/dDplLGw9dC5sZW5ndGg+ZS5sZW5ndGg/ZTp0O2lmKHIubGVuZ3RoPDR8fDIqbC5sZW5ndGg8ci5sZW5ndGgpcmV0dXJuIG51bGw7dmFyIHMsdT1uKHIsbCxNYXRoLmNlaWwoci5sZW5ndGgvNCkpLGE9bihyLGwsTWF0aC5jZWlsKHIubGVuZ3RoLzIpKTtpZighdSYmIWEpcmV0dXJuIG51bGw7cz1hP3UmJnVbNF0ubGVuZ3RoPmFbNF0ubGVuZ3RoP3U6YTp1O3ZhciBjLGgsZCxmO3JldHVybiB0Lmxlbmd0aD5lLmxlbmd0aD8oYz1zWzBdLGg9c1sxXSxkPXNbMl0sZj1zWzNdKTooZD1zWzBdLGY9c1sxXSxjPXNbMl0saD1zWzNdKSxbYyxoLGQsZixzWzRdXX1mdW5jdGlvbiBzKHQpe3QucHVzaChbeCxcIlwiXSk7Zm9yKHZhciBlLG49MCxyPTAsbD0wLHU9XCJcIixhPVwiXCI7bjx0Lmxlbmd0aDspc3dpdGNoKHRbbl1bMF0pe2Nhc2UgRDpsKyssYSs9dFtuXVsxXSxuKys7YnJlYWs7Y2FzZSBPOnIrKyx1Kz10W25dWzFdLG4rKzticmVhaztjYXNlIHg6citsPjE/KDAhPT1yJiYwIT09bCYmKGU9byhhLHUpLDAhPT1lJiYobi1yLWw+MCYmdFtuLXItbC0xXVswXT09eD90W24tci1sLTFdWzFdKz1hLnN1YnN0cmluZygwLGUpOih0LnNwbGljZSgwLDAsW3gsYS5zdWJzdHJpbmcoMCxlKV0pLG4rKyksYT1hLnN1YnN0cmluZyhlKSx1PXUuc3Vic3RyaW5nKGUpKSwwIT09KGU9aShhLHUpKSYmKHRbbl1bMV09YS5zdWJzdHJpbmcoYS5sZW5ndGgtZSkrdFtuXVsxXSxhPWEuc3Vic3RyaW5nKDAsYS5sZW5ndGgtZSksdT11LnN1YnN0cmluZygwLHUubGVuZ3RoLWUpKSksMD09PXI/dC5zcGxpY2Uobi1sLHIrbCxbRCxhXSk6MD09PWw/dC5zcGxpY2Uobi1yLHIrbCxbTyx1XSk6dC5zcGxpY2Uobi1yLWwscitsLFtPLHVdLFtELGFdKSxuPW4tci1sKyhyPzE6MCkrKGw/MTowKSsxKTowIT09biYmdFtuLTFdWzBdPT14Pyh0W24tMV1bMV0rPXRbbl1bMV0sdC5zcGxpY2UobiwxKSk6bisrLGw9MCxyPTAsdT1cIlwiLGE9XCJcIn1cIlwiPT09dFt0Lmxlbmd0aC0xXVsxXSYmdC5wb3AoKTt2YXIgYz0hMTtmb3Iobj0xO248dC5sZW5ndGgtMTspdFtuLTFdWzBdPT14JiZ0W24rMV1bMF09PXgmJih0W25dWzFdLnN1YnN0cmluZyh0W25dWzFdLmxlbmd0aC10W24tMV1bMV0ubGVuZ3RoKT09dFtuLTFdWzFdPyh0W25dWzFdPXRbbi0xXVsxXSt0W25dWzFdLnN1YnN0cmluZygwLHRbbl1bMV0ubGVuZ3RoLXRbbi0xXVsxXS5sZW5ndGgpLHRbbisxXVsxXT10W24tMV1bMV0rdFtuKzFdWzFdLHQuc3BsaWNlKG4tMSwxKSxjPSEwKTp0W25dWzFdLnN1YnN0cmluZygwLHRbbisxXVsxXS5sZW5ndGgpPT10W24rMV1bMV0mJih0W24tMV1bMV0rPXRbbisxXVsxXSx0W25dWzFdPXRbbl1bMV0uc3Vic3RyaW5nKHRbbisxXVsxXS5sZW5ndGgpK3RbbisxXVsxXSx0LnNwbGljZShuKzEsMSksYz0hMCkpLG4rKztjJiZzKHQpfWZ1bmN0aW9uIHUodCxlKXtpZigwPT09ZSlyZXR1cm5beCx0XTtmb3IodmFyIG49MCxyPTA7cjx0Lmxlbmd0aDtyKyspe3ZhciBvPXRbcl07aWYob1swXT09PU98fG9bMF09PT14KXt2YXIgaT1uK29bMV0ubGVuZ3RoO2lmKGU9PT1pKXJldHVybltyKzEsdF07aWYoZTxpKXt0PXQuc2xpY2UoKTt2YXIgbD1lLW4scz1bb1swXSxvWzFdLnNsaWNlKDAsbCldLHU9W29bMF0sb1sxXS5zbGljZShsKV07cmV0dXJuIHQuc3BsaWNlKHIsMSxzLHUpLFtyKzEsdF19bj1pfX10aHJvdyBuZXcgRXJyb3IoXCJjdXJzb3JfcG9zIGlzIG91dCBvZiBib3VuZHMhXCIpfWZ1bmN0aW9uIGEodCxlKXt2YXIgbj11KHQsZSkscj1uWzFdLG89blswXSxpPXJbb10sbD1yW28rMV07aWYobnVsbD09aSlyZXR1cm4gdDtpZihpWzBdIT09eClyZXR1cm4gdDtpZihudWxsIT1sJiZpWzFdK2xbMV09PT1sWzFdK2lbMV0pcmV0dXJuIHIuc3BsaWNlKG8sMixsLGkpLGMocixvLDIpO2lmKG51bGwhPWwmJjA9PT1sWzFdLmluZGV4T2YoaVsxXSkpe3Iuc3BsaWNlKG8sMixbbFswXSxpWzFdXSxbMCxpWzFdXSk7dmFyIHM9bFsxXS5zbGljZShpWzFdLmxlbmd0aCk7cmV0dXJuIHMubGVuZ3RoPjAmJnIuc3BsaWNlKG8rMiwwLFtsWzBdLHNdKSxjKHIsbywzKX1yZXR1cm4gdH1mdW5jdGlvbiBjKHQsZSxuKXtmb3IodmFyIHI9ZStuLTE7cj49MCYmcj49ZS0xO3ItLSlpZihyKzE8dC5sZW5ndGgpe3ZhciBvPXRbcl0saT10W3IrMV07b1swXT09PWlbMV0mJnQuc3BsaWNlKHIsMixbb1swXSxvWzFdK2lbMV1dKX1yZXR1cm4gdH1mdW5jdGlvbiBoKHQpe3Qub2JzZXJ2ZShmdW5jdGlvbihlKXtudWxsIT10LmRvbSYmdC5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe3ZhciBuPWQodC5fc2Nyb2xsRWxlbWVudCk7aWYoXCJhdHRyaWJ1dGVDaGFuZ2VkXCI9PT1lLnR5cGUpdC5kb20uc2V0QXR0cmlidXRlKGUubmFtZSxlLnZhbHVlKTtlbHNlIGlmKFwiYXR0cmlidXRlUmVtb3ZlZFwiPT09ZS50eXBlKXQuZG9tLnJlbW92ZUF0dHJpYnV0ZShlLm5hbWUpO2Vsc2UgaWYoXCJjaGlsZEluc2VydGVkXCI9PT1lLnR5cGV8fFwiaW5zZXJ0XCI9PT1lLnR5cGUpZm9yKHZhciByPWUudmFsdWVzLG89ci5sZW5ndGgtMTtvPj0wO28tLSl7dmFyIGk9cltvXTtpLnNldERvbUZpbHRlcih0Ll9kb21GaWx0ZXIpLGkuZW5hYmxlU21hcnRTY3JvbGxpbmcodC5fc2Nyb2xsRWxlbWVudCk7dmFyIGw9aS5nZXREb20oKSxzPW51bGwsdT1udWxsO3QuX2NvbnRlbnQubGVuZ3RoPmUuaW5kZXgrbysxJiYodT10LmdldChlLmluZGV4K28rMSkuZ2V0RG9tKCkpLHQuZG9tLmluc2VydEJlZm9yZShsLHUpLG51bGw9PT1ufHwobnVsbCE9PW4uYW5jaG9yP2wuY29udGFpbnMobi5hbmNob3IpfHxuLmFuY2hvci5jb250YWlucyhsKXx8KHM9bik6ZihsKS50b3A8PTAmJihzPW4pKSxwKHQuX3Njcm9sbEVsZW1lbnQscyl9ZWxzZSBpZihcImNoaWxkUmVtb3ZlZFwiPT09ZS50eXBlfHxcImRlbGV0ZVwiPT09ZS50eXBlKWZvcih2YXIgYT1lLnZhbHVlcy5sZW5ndGgtMTthPj0wO2EtLSl7dmFyIGM9ZS52YWx1ZXNbYV0uZG9tLGg9bnVsbDtudWxsPT09bnx8KG51bGwhPT1uLmFuY2hvcj9jLmNvbnRhaW5zKG4uYW5jaG9yKXx8bi5hbmNob3IuY29udGFpbnMoYyl8fChoPW4pOmYoYykudG9wPD0wJiYoaD1uKSksYy5yZW1vdmUoKSxwKHQuX3Njcm9sbEVsZW1lbnQsaCl9fSl9KX1mdW5jdGlvbiBkKHQpe2lmKG51bGw9PXQpcmV0dXJuIG51bGw7dmFyIGU9ZG9jdW1lbnQuZ2V0U2VsZWN0aW9uKCkuYW5jaG9yTm9kZTtpZihudWxsIT1lKXt2YXIgbj1mKGUpLnRvcDtpZihuPj0wJiZuPD1kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KXJldHVybnthbmNob3I6ZSx0b3A6bn19cmV0dXJue2FuY2hvcjpudWxsLHNjcm9sbFRvcDp0LnNjcm9sbFRvcCxzY3JvbGxIZWlnaHQ6dC5zY3JvbGxIZWlnaHR9fWZ1bmN0aW9uIGYodCl7aWYobnVsbCE9dC5nZXRCb3VuZGluZ0NsaWVudFJlY3QpcmV0dXJuIHQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7aWYobnVsbD09dC5wYXJlbnROb2RlKXtkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKS5hcHBlbmRDaGlsZCh0KX12YXIgZT1kb2N1bWVudC5jcmVhdGVSYW5nZSgpO3JldHVybiBlLnNlbGVjdE5vZGUodCksZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKX1mdW5jdGlvbiBwKHQsZSl7bnVsbCE9PXQmJm51bGwhPT1lJiYobnVsbD09PWUuYW5jaG9yP3Quc2Nyb2xsVG9wPT09ZS5zY3JvbGxUb3AmJih0LnNjcm9sbFRvcCs9dC5zY3JvbGxIZWlnaHQtZS5zY3JvbGxIZWlnaHQpOnQuc2Nyb2xsVG9wKz1mKGUuYW5jaG9yKS50b3AtZS50b3ApfWZ1bmN0aW9uIG0odCxlKXtyZXR1cm4gZX1mdW5jdGlvbiB2KHQpe2Zvcih2YXIgZT1uZXcgU2V0KEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh0LmRvbS5jaGlsZE5vZGVzLGZ1bmN0aW9uKHQpe3JldHVybiB0Ll9feXhtbH0pLmZpbHRlcihmdW5jdGlvbih0KXtyZXR1cm4gdm9pZCAwIT09dH0pKSxuPXQuX2NvbnRlbnQubGVuZ3RoLTE7bj49MDtuLS0pe3ZhciByPXQuZ2V0KG4pO2UuaGFzKHIpfHx0LmRlbGV0ZShuLDEpfWZvcih2YXIgbz10LmRvbS5jaGlsZE5vZGVzLGk9by5sZW5ndGgsbD0wLHM9MDtsPGk7bCsrKXsoZnVuY3Rpb24oZSxuKXt2YXIgcj1vW2VdO2lmKG51bGwhPXIuX195eG1sKXtpZighMT09PXIuX195eG1sKXJldHVyblwiY29udGludWVcIjtpZihuPHQubGVuZ3RoKXtpZih0LmdldChuKSE9PXIuX195eG1sKXt2YXIgaT10Ll9jb250ZW50LmZpbmRJbmRleChmdW5jdGlvbih0KXtyZXR1cm4gdC50eXBlWzBdPT09ci5fX3l4bWwuX21vZGVsWzBdJiZ0LnR5cGVbMV09PT1yLl9feXhtbC5fbW9kZWxbMV19KTtpPDA/ci5fX3l4bWw9bnVsbDp0LmRlbGV0ZShpLDEpLG4rPXQuaW5zZXJ0RG9tRWxlbWVudHMobixbcl0pfWVsc2UgbisrfWVsc2Ugbis9dC5pbnNlcnREb21FbGVtZW50cyhuLFtyXSl9ZWxzZSBuKz10Lmluc2VydERvbUVsZW1lbnRzKG4sW3JdKTtzPW59KShsLHMpfX1mdW5jdGlvbiB5KHQsZSl7cmV0dXJuIHQuaW5kZXg8PWU/XCJkZWxldGVcIj09PXQudHlwZT9lLU1hdGgubWluKGUtdC5pbmRleCx0Lmxlbmd0aCk6ZSsxOmV9ZnVuY3Rpb24gXyh0LGUsbil7dC5yZXF1ZXN0TW9kdWxlcyhbXCJBcnJheVwiXSkudGhlbihmdW5jdGlvbigpe3ZhciByPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIHIodCxlLG4sbyl7VCh0aGlzLHIpO3ZhciBpPVModGhpcywoci5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihyKSkuY2FsbCh0aGlzLHQsZSxuKSk7bnVsbCE9byYmbnVsbCE9by5jb250ZW50JiZcIl9cIiE9PWVbMF0mJmkuaW5zZXJ0KDAsby5jb250ZW50KSxpLmRvbT1udWxsLGkuX2RvbU9ic2VydmVyPW51bGwsaS5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcj1udWxsLGkuX3Njcm9sbEVsZW1lbnQ9bnVsbCxudWxsIT1vJiZudWxsIT1vLmRvbSYmaS5fc2V0RG9tKG8uZG9tKTt2YXIgbD0hMDtyZXR1cm4gaS5fbXV0dWFsRXhjbHVzZT1mdW5jdGlvbih0KXtpZihsKXtsPSExO3RyeXt0KCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX1pLl9kb21PYnNlcnZlci50YWtlUmVjb3JkcygpLGw9ITB9fSxpLm9ic2VydmUoZnVuY3Rpb24odCl7bnVsbCE9aS5kb20mJmkuX211dHVhbEV4Y2x1c2UoZnVuY3Rpb24oKXt2YXIgZT1udWxsLG49ITEscj1udWxsLG89bnVsbCxsPW51bGwscz1udWxsO1widW5kZWZpbmVkXCIhPXR5cGVvZiBnZXRTZWxlY3Rpb24mJihlPWdldFNlbGVjdGlvbigpLGUuYW5jaG9yTm9kZT09PWkuZG9tJiYocj1lLmFuY2hvck5vZGUsbz15KHQsZS5hbmNob3JPZmZzZXQpLG49ITApLGUuZm9jdXNOb2RlPT09aS5kb20mJihsPWUuZm9jdXNOb2RlLHM9eSh0LGUuZm9jdXNPZmZzZXQpLG49ITApKTt2YXIgdT1kKGkuX3Njcm9sbEVsZW1lbnQpLGE9dm9pZCAwO2E9bnVsbCE9PXUmJihudWxsIT09dS5hbmNob3J8fGYoaS5kb20pLnRvcDw9MCk/dTpudWxsLGkuZG9tLm5vZGVWYWx1ZT1pLnRvU3RyaW5nKCkscChpLl9zY3JvbGxFbGVtZW50LGEpLG4mJmUuc2V0QmFzZUFuZEV4dGVudChyfHxlLmFuY2hvck5vZGUsb3x8ZS5hbmNob3JPZmZzZXQsbHx8ZS5mb2N1c05vZGUsc3x8ZS5mb2N1c09mZnNldCl9KX0pLGl9cmV0dXJuIEwocix0KSxBKHIsW3trZXk6XCJzZXREb21GaWx0ZXJcIix2YWx1ZTpmdW5jdGlvbigpe319LHtrZXk6XCJlbmFibGVTbWFydFNjcm9sbGluZ1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX3Njcm9sbEVsZW1lbnQ9dH19LHtrZXk6XCJfc2V0RG9tXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcztudWxsIT10aGlzLmRvbSYmdGhpcy5fdW5iaW5kRnJvbURvbSgpLG51bGwhPXQuX195eG1sJiZ0Ll9feXhtbC5fdW5iaW5kRnJvbURvbSgpLG51bGwhPW4mJih0aGlzLmRvbT10LHQuX195eG1sPXRoaXMsdGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcj1mdW5jdGlvbigpe2UuX211dHVhbEV4Y2x1c2UoZnVuY3Rpb24oKXtmb3IodmFyIHQ9ayhlLnRvU3RyaW5nKCksZS5kb20ubm9kZVZhbHVlKSxuPTAscj0wO3I8dC5sZW5ndGg7cisrKXt2YXIgbz10W3JdOzA9PT1vWzBdP24rPW9bMV0ubGVuZ3RoOi0xPT09b1swXT9lLmRlbGV0ZShuLG9bMV0ubGVuZ3RoKTooZS5pbnNlcnQobixvWzFdKSxuKz1vWzFdLmxlbmd0aCl9fSl9LHRoaXMuX2RvbU9ic2VydmVyPW5ldyBuKHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIpLHRoaXMuX2RvbU9ic2VydmVyLm9ic2VydmUodGhpcy5kb20se2NoYXJhY3RlckRhdGE6ITB9KSl9fSx7a2V5OlwiZ2V0RG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXtpZihudWxsPT10aGlzLmRvbSl7dmFyIHQ9ZS5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRvU3RyaW5nKCkpO3JldHVybiBudWxsIT09biYmdGhpcy5fc2V0RG9tKHQpLHR9cmV0dXJuIHRoaXMuZG9tfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY29udGVudC5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQudmFsfSkuam9pbihcIlwiKX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe0Moci5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2Yoci5wcm90b3R5cGUpLFwiaW5zZXJ0XCIsdGhpcykuY2FsbCh0aGlzLHQsZS5zcGxpdChcIlwiKSl9fSx7a2V5OlwiX2NoYW5nZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe251bGwhPXRoaXMuX2RvbU9ic2VydmVyJiZ0aGlzLl9kb21PYnNlcnZlckxpc3RlbmVyKHRoaXMuX2RvbU9ic2VydmVyLnRha2VSZWNvcmRzKCkpLEMoci5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2Yoci5wcm90b3R5cGUpLFwiX2NoYW5nZWRcIix0aGlzKS5jYWxsKHRoaXMsdCxlKX19LHtrZXk6XCJfdW5iaW5kRnJvbURvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7bnVsbCE9dGhpcy5fZG9tT2JzZXJ2ZXImJih0aGlzLl9kb21PYnNlcnZlci5kaXNjb25uZWN0KCksdGhpcy5fZG9tT2JzZXJ2ZXI9bnVsbCksbnVsbCE9dGhpcy5kb20mJih0aGlzLmRvbS5fX3l4bWw9bnVsbCx0aGlzLmRvbT1udWxsKX19LHtrZXk6XCJfZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7bnVsbCE9dGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXImJnRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLmRlc3Ryb3koKSx0aGlzLl91bmJpbmRGcm9tRG9tKCksQyhyLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihyLnByb3RvdHlwZSksXCJfZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLHJ9KHQuQXJyYXkudHlwZURlZmluaXRpb24uY2xhc3MpO3QuZXh0ZW5kKFwiWG1sVGV4dFwiLG5ldyB0LnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKHtuYW1lOlwiWG1sVGV4dFwiLGNsYXNzOnIsc3RydWN0OlwiTGlzdFwiLHBhcnNlQXJndW1lbnRzOmZ1bmN0aW9uKHQpe3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiB0P1t0aGlzLHtjb250ZW50OnR9XTp0Lm5vZGVUeXBlPT09ZS5URVhUX05PREU/W3RoaXMse2NvbnRlbnQ6dC5ub2RlVmFsdWUsZG9tOnR9XTpbdGhpcyx7fV19LGluaXRUeXBlOmZ1bmN0aW9uKGUsbixvKXt2YXIgaT1bXTtyZXR1cm4gdC5TdHJ1Y3QuTGlzdC5tYXAuY2FsbCh0aGlzLG4sZnVuY3Rpb24odCl7aWYodC5oYXNPd25Qcm9wZXJ0eShcIm9wQ29udGVudFwiKSl0aHJvdyBuZXcgRXJyb3IoXCJUZXh0IG11c3Qgbm90IGNvbnRhaW4gdHlwZXMhXCIpO3QuY29udGVudC5mb3JFYWNoKGZ1bmN0aW9uKGUsbil7aS5wdXNoKHtpZDpbdC5pZFswXSx0LmlkWzFdK25dLHZhbDp0LmNvbnRlbnRbbl19KX0pfSksbmV3IHIoZSxuLmlkLGkse30sb3x8e30pfSxjcmVhdGVUeXBlOmZ1bmN0aW9uKHQsZSxuKXtyZXR1cm4gbmV3IHIodCxlLmlkLFtdLG58fHt9KX19KSl9KX1mdW5jdGlvbiBnKHQsZSxuKXt0LnJlcXVlc3RNb2R1bGVzKFtcIkFycmF5XCJdKS50aGVuKGZ1bmN0aW9uKCl7dmFyIGU9ZnVuY3Rpb24oZSl7ZnVuY3Rpb24gcih0LGUsbixvKXtUKHRoaXMscik7dmFyIGk9Uyh0aGlzLChyLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKHIpKS5jYWxsKHRoaXMsdCxlLG4pKTtpLmRvbT1udWxsLGkuX2RvbU9ic2VydmVyPW51bGwsaS5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcj1udWxsLGkuX2RvbUZpbHRlcj1tLGkuX3Njcm9sbEVsZW1lbnQ9bnVsbDt2YXIgbD0hMDtyZXR1cm4gaS5fbXV0dWFsRXhjbHVkZT1mdW5jdGlvbih0KXtpZihsKXtsPSExO3RyeXt0KCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX1pLl9kb21PYnNlcnZlci50YWtlUmVjb3JkcygpLGw9ITB9fSxoKGkpLGl9cmV0dXJuIEwocixlKSxBKHIsW3trZXk6XCJzZXREb21GaWx0ZXJcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0LlhtbEVsZW1lbnQudHlwZURlZmluaXRpb24uY2xhc3MucHJvdG90eXBlLnNldERvbUZpbHRlci5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fSx7a2V5OlwiZW5hYmxlU21hcnRTY3JvbGxpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0LlhtbEVsZW1lbnQudHlwZURlZmluaXRpb24uY2xhc3MucHJvdG90eXBlLmVuYWJsZVNtYXJ0U2Nyb2xsaW5nLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19LHtrZXk6XCJpbnNlcnREb21FbGVtZW50c1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHQuWG1sRWxlbWVudC50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuaW5zZXJ0RG9tRWxlbWVudHMuYXBwbHkodGhpcyxhcmd1bWVudHMpfX0se2tleTpcImJpbmRUb0RvbVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7aWYobnVsbCE9dGhpcy5kb20mJnRoaXMuX3VuYmluZEZyb21Eb20oKSxudWxsIT10Ll9feXhtbCYmdC5fX3l4bWwuX3VuYmluZEZyb21Eb20oKSxudWxsPT1uKXRocm93IG5ldyBFcnJvcihcIk5vdCBhYmxlIHRvIGJpbmQgdG8gYSBET00gZWxlbWVudCwgYmVjYXVzZSBNdXRhdGlvbk9ic2VydmVyIGlzIG5vdCBhdmFpbGFibGUhXCIpO3QuaW5uZXJIVE1MPVwiXCI7Zm9yKHZhciByPTA7cjx0aGlzLl9jb250ZW50Lmxlbmd0aDtyKyspdC5pbnNlcnRCZWZvcmUodGhpcy5nZXQocikuZ2V0RG9tKCksbnVsbCk7dGhpcy5kb209dCx0Ll9feXhtbD10aGlzLHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXI9ZnVuY3Rpb24oKXtlLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7cmV0dXJuIHYoZSl9KX0sdGhpcy5fZG9tT2JzZXJ2ZXI9bmV3IG4odGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lciksdGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSx0aGlzLl9kb21PYnNlcnZlci5vYnNlcnZlKHRoaXMuZG9tLHtjaGlsZExpc3Q6ITB9KX19LHtrZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcztyZXR1cm4gdGhpcy5fY29udGVudC5tYXAoZnVuY3Rpb24oZSl7cmV0dXJuIHQub3MuZ2V0VHlwZShlLnR5cGUpLnRvU3RyaW5nKCl9KS5qb2luKFwiXCIpfX0se2tleTpcIl9jaGFuZ2VkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtudWxsIT10aGlzLl9kb21PYnNlcnZlciYmdGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcih0aGlzLl9kb21PYnNlcnZlci50YWtlUmVjb3JkcygpKSxDKHIucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKHIucHJvdG90eXBlKSxcIl9jaGFuZ2VkXCIsdGhpcykuY2FsbCh0aGlzLHQsZSl9fSx7a2V5OlwiX3VuYmluZEZyb21Eb21cIix2YWx1ZTpmdW5jdGlvbigpe251bGwhPXRoaXMuX2RvbU9ic2VydmVyJiYodGhpcy5fZG9tT2JzZXJ2ZXIuZGlzY29ubmVjdCgpLHRoaXMuX2RvbU9ic2VydmVyPW51bGwpLG51bGwhPXRoaXMuZG9tJiYodGhpcy5kb20uX195eG1sPW51bGwsdGhpcy5kb209bnVsbCl9fSx7a2V5OlwiX2Rlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe251bGwhPXRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyJiZ0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5kZXN0cm95KCksdGhpcy5fdW5iaW5kRnJvbURvbSgpLEMoci5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2Yoci5wcm90b3R5cGUpLFwiX2Rlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxyfSh0LkFycmF5LnR5cGVEZWZpbml0aW9uLmNsYXNzKTt0LmV4dGVuZChcIlhtbEZyYWdtZW50XCIsbmV3IHQudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe25hbWU6XCJYbWxGcmFnbWVudFwiLGNsYXNzOmUsc3RydWN0OlwiTGlzdFwiLGluaXRUeXBlOmZ1bmN0aW9uKG4scil7dmFyIG89W10saT1bXTt0LlN0cnVjdC5MaXN0Lm1hcC5jYWxsKHRoaXMscixmdW5jdGlvbih0KXt0Lmhhc093blByb3BlcnR5KFwib3BDb250ZW50XCIpPyhvLnB1c2goe2lkOnQuaWQsdHlwZTp0Lm9wQ29udGVudH0pLGkucHVzaCh0Lm9wQ29udGVudCkpOnQuY29udGVudC5mb3JFYWNoKGZ1bmN0aW9uKGUsbil7by5wdXNoKHtpZDpbdC5pZFswXSx0LmlkWzFdK25dLHZhbDp0LmNvbnRlbnRbbl19KX0pfSk7Zm9yKHZhciBsPTA7bDxpLmxlbmd0aDtsKyspe3RoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLGlbbF0pLl9wYXJlbnQ9ci5pZH1yZXR1cm4gbmV3IGUobixyLmlkLG8pfSxjcmVhdGVUeXBlOmZ1bmN0aW9uKHQsbil7cmV0dXJuIG5ldyBlKHQsbi5pZCxbXSl9fSkpfSl9ZnVuY3Rpb24gYih0LGUsbil7ZnVuY3Rpb24gcihlKXt2YXIgbj10aGlzO2lmKFwiSW5zZXJ0XCI9PT1lLnN0cnVjdCl7aWYodGhpcy5fY29udGVudC5zb21lKGZ1bmN0aW9uKG4pe3JldHVybiB0LnV0aWxzLmNvbXBhcmVJZHMobi5pZCxlLmlkKX0pKXJldHVybjt2YXIgcj12b2lkIDA7aWYobnVsbD09PWUubGVmdClyPTA7ZWxzZSBpZigocj0xK3RoaXMuX2NvbnRlbnQuZmluZEluZGV4KGZ1bmN0aW9uKG4pe3JldHVybiB0LnV0aWxzLmNvbXBhcmVJZHMobi5pZCxlLmxlZnQpfSkpPD0wKXRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb3BlcmF0aW9uIVwiKTt2YXIgbyxpO2lmKGUuaGFzT3duUHJvcGVydHkoXCJvcENvbnRlbnRcIikpe3RoaXMuX2NvbnRlbnQuc3BsaWNlKHIsMCx7aWQ6ZS5pZCx0eXBlOmUub3BDb250ZW50fSksaT0xO3ZhciBsPXRoaXMub3MuZ2V0VHlwZShlLm9wQ29udGVudCk7bC5fcGFyZW50PXRoaXMuX21vZGVsLG89W2xdfWVsc2V7dmFyIHM9ZS5jb250ZW50Lm1hcChmdW5jdGlvbih0LG4pe3JldHVybntpZDpbZS5pZFswXSxlLmlkWzFdK25dLHZhbDp0fX0pO3MubGVuZ3RoPDNlND90aGlzLl9jb250ZW50LnNwbGljZS5hcHBseSh0aGlzLl9jb250ZW50LFtyLDBdLmNvbmNhdChzKSk6dGhpcy5fY29udGVudD10aGlzLl9jb250ZW50LnNsaWNlKDAscikuY29uY2F0KHMpLmNvbmNhdCh0aGlzLl9jb250ZW50LnNsaWNlKHIpKSxvPWUuY29udGVudCxpPWUuY29udGVudC5sZW5ndGh9dC51dGlscy5idWJibGVFdmVudCh0aGlzLHt0eXBlOlwiaW5zZXJ0XCIsb2JqZWN0OnRoaXMsaW5kZXg6cix2YWx1ZXM6byxsZW5ndGg6aX0pfWVsc2V7aWYoXCJEZWxldGVcIiE9PWUuc3RydWN0KXRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgc3RydWN0IVwiKTtmb3IodmFyIHU9MDt1PHRoaXMuX2NvbnRlbnQubGVuZ3RoJiZlLmxlbmd0aD4wO3UrKyl7dmFyIGE9dGhpcy5fY29udGVudFt1XTtpZih0LnV0aWxzLmluRGVsZXRpb25SYW5nZShlLGEuaWQpKXt2YXIgYztmb3IoYz0xO2M8ZS5sZW5ndGgmJnUrYzx0aGlzLl9jb250ZW50Lmxlbmd0aCYmdC51dGlscy5pbkRlbGV0aW9uUmFuZ2UoZSx0aGlzLl9jb250ZW50W3UrY10uaWQpO2MrKyk7YT10aGlzLl9jb250ZW50W3UrYy0xXSxlLmxlbmd0aC09YS5pZFsxXS1lLnRhcmdldFsxXSsxLGUudGFyZ2V0PVthLmlkWzBdLGEuaWRbMV0rMV07dmFyIGg9dGhpcy5fY29udGVudC5zcGxpY2UodSxjKSxkPWgubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBudWxsIT10LnZhbD90LnZhbDpuLm9zLmdldFR5cGUodC50eXBlKX0pO3QudXRpbHMuYnViYmxlRXZlbnQodGhpcyx7dHlwZTpcImRlbGV0ZVwiLG9iamVjdDp0aGlzLGluZGV4OnUsdmFsdWVzOmQsX2NvbnRlbnQ6aCxsZW5ndGg6Y30pfX19fWZ1bmN0aW9uIG8oZSl7dmFyIG4scj1cIkRlbGV0ZVwiPT09ZS5zdHJ1Y3Q/ZS5rZXk6ZS5wYXJlbnRTdWI7aWYobj1udWxsIT10aGlzLm9wQ29udGVudHNbcl0/dGhpcy5vcy5nZXRUeXBlKHRoaXMub3BDb250ZW50c1tyXSk6dGhpcy5jb250ZW50c1tyXSxcIkluc2VydFwiPT09ZS5zdHJ1Y3Qpe2lmKG51bGw9PT1lLmxlZnQmJiF0LnV0aWxzLmNvbXBhcmVJZHMoZS5pZCx0aGlzLm1hcFtyXSkpe3ZhciBvO251bGwhPWUub3BDb250ZW50PyhvPXRoaXMub3MuZ2V0VHlwZShlLm9wQ29udGVudCksby5fcGFyZW50PXRoaXMuX21vZGVsLGRlbGV0ZSB0aGlzLmNvbnRlbnRzW3JdLGUuZGVsZXRlZD9kZWxldGUgdGhpcy5vcENvbnRlbnRzW3JdOnRoaXMub3BDb250ZW50c1tyXT1lLm9wQ29udGVudCk6KG89ZS5jb250ZW50WzBdLGRlbGV0ZSB0aGlzLm9wQ29udGVudHNbcl0sZS5kZWxldGVkP2RlbGV0ZSB0aGlzLmNvbnRlbnRzW3JdOnRoaXMuY29udGVudHNbcl09ZS5jb250ZW50WzBdKSx0aGlzLm1hcFtyXT1lLmlkLHZvaWQgMD09PW4/dC51dGlscy5idWJibGVFdmVudCh0aGlzLHtuYW1lOnIsb2JqZWN0OnRoaXMsdHlwZTpcImFkZFwiLHZhbHVlOm99KTp0LnV0aWxzLmJ1YmJsZUV2ZW50KHRoaXMse25hbWU6cixvYmplY3Q6dGhpcyxvbGRWYWx1ZTpuLHR5cGU6XCJ1cGRhdGVcIix2YWx1ZTpvfSl9fWVsc2V7aWYoXCJEZWxldGVcIiE9PWUuc3RydWN0KXRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgT3BlcmF0aW9uIVwiKTt0LnV0aWxzLmNvbXBhcmVJZHModGhpcy5tYXBbcl0sZS50YXJnZXQpJiYoZGVsZXRlIHRoaXMub3BDb250ZW50c1tyXSxkZWxldGUgdGhpcy5jb250ZW50c1tyXSx0LnV0aWxzLmJ1YmJsZUV2ZW50KHRoaXMse25hbWU6cixvYmplY3Q6dGhpcyxvbGRWYWx1ZTpuLHR5cGU6XCJkZWxldGVcIn0pKX19dmFyIGk9ZnVuY3Rpb24oaSl7ZnVuY3Rpb24gbChlLG4saSxzLHUsYSxjKXtUKHRoaXMsbCk7dmFyIGQ9Uyh0aGlzLChsLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGwpKS5jYWxsKHRoaXMpKTtkLl9vcz1lLGQub3M9ZSxkLl9tb2RlbD1uLmlkLGQuX3BhcmVudD1udWxsLGQubWFwPXQudXRpbHMuY29weU9iamVjdChuLm1hcCksZC5jb250ZW50cz1zLGQub3BDb250ZW50cz11LGQuX2NvbnRlbnQ9aSxkLm5vZGVOYW1lPW4ubm9kZU5hbWU7dmFyIGY9by5iaW5kKGQpLHA9ci5iaW5kKGQpLG09bmV3IHQudXRpbHMuRXZlbnRIYW5kbGVyKGZ1bmN0aW9uKHQpe3ZvaWQgMCE9PXQucGFyZW50U3VifHx2b2lkIDAhPT10LmtleT9mKHQpOnAodCl9KTtkLmV2ZW50SGFuZGxlcj1tLGQuX2RlZXBFdmVudEhhbmRsZXI9bmV3IHQudXRpbHMuRXZlbnRMaXN0ZW5lckhhbmRsZXIsZC5fZXZlbnRMaXN0ZW5lckhhbmRsZXI9bSxkLl9kb21PYnNlcnZlcj1udWxsLGQuX3Njcm9sbEVsZW1lbnQ9bnVsbCxkLmRvbT1udWxsLGQuX2RvbUZpbHRlcj1jLG51bGwhPWEmJmQuX3NldERvbShhKTt2YXIgdj0hMDtyZXR1cm4gZC5fbXV0dWFsRXhjbHVkZT1mdW5jdGlvbih0KXtpZih2KXt2PSExO3RyeXt0KCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX1kLl9kb21PYnNlcnZlci50YWtlUmVjb3JkcygpLHY9ITB9fSxoKGQpLGR9cmV0dXJuIEwobCxpKSxBKGwsW3trZXk6XCJlbmFibGVTbWFydFNjcm9sbGluZ1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX3Njcm9sbEVsZW1lbnQ9dDtmb3IodmFyIGU9dGhpcy5fY29udGVudC5sZW5ndGgsbj0wO248ZTtuKyspdGhpcy5nZXQobikuZW5hYmxlU21hcnRTY3JvbGxpbmcodCl9fSx7a2V5Olwic2V0RG9tRmlsdGVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZG9tRmlsdGVyPXQ7Zm9yKHZhciBlPXRoaXMuX2NvbnRlbnQubGVuZ3RoLG49MDtuPGU7bisrKXRoaXMuZ2V0KG4pLnNldERvbUZpbHRlcih0KX19LHtrZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcyxlPXRoaXMubm9kZU5hbWUudG9Mb3dlckNhc2UoKSxuPXRoaXMuX2NvbnRlbnQubWFwKGZ1bmN0aW9uKGUpe3JldHVybiB0Lm9zLmdldFR5cGUoZS50eXBlKS50b1N0cmluZygpfSkuam9pbihcIlwiKTtyZXR1cm4gMD09PW4ubGVuZ3RoP1wiPFwiK2UrXCIvPlwiOlwiPFwiK2UrXCI+XCIrbitcIjwvXCIrZStcIj5cIn19LHtrZXk6XCJfZ2V0UGF0aFRvQ2hpbGRcIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5fY29udGVudC5maW5kSW5kZXgoZnVuY3Rpb24obil7cmV0dXJuIG51bGwhPW4udHlwZSYmdC51dGlscy5jb21wYXJlSWRzKG4udHlwZSxlKX0pfX0se2tleTpcIl91bmJpbmRGcm9tRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXtudWxsIT10aGlzLl9kb21PYnNlcnZlciYmKHRoaXMuX2RvbU9ic2VydmVyLmRpc2Nvbm5lY3QoKSx0aGlzLl9kb21PYnNlcnZlcj1udWxsKSxudWxsIT10aGlzLmRvbSYmKHRoaXMuZG9tLl9feXhtbD1udWxsLHRoaXMuZG9tPW51bGwpfX0se2tleTpcIl9kZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl91bmJpbmRGcm9tRG9tKCksbnVsbCE9dGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXImJih0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5kZXN0cm95KCksdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXI9bnVsbCksdGhpcy5ub2RlTmFtZT1udWxsLHRoaXMuX2NvbnRlbnQ9bnVsbCx0aGlzLmNvbnRlbnRzPW51bGwsdGhpcy5vcENvbnRlbnRzPW51bGwsdGhpcy5tYXA9bnVsbH19LHtrZXk6XCJpbnNlcnREb21FbGVtZW50c1wiLHZhbHVlOmZ1bmN0aW9uKG4scil7dmFyIG89dGhpcyxpPVtdO3IuZm9yRWFjaChmdW5jdGlvbihuKXtpZihudWxsIT1uLl9feXhtbCYmITEhPT1uLl9feXhtbCYmbi5fX3l4bWwuX3VuYmluZEZyb21Eb20oKSxudWxsIT09by5fZG9tRmlsdGVyKG4sW10pKXt2YXIgcj12b2lkIDA7aWYobi5ub2RlVHlwZT09PWUuVEVYVF9OT0RFKXI9dC5YbWxUZXh0KG4pO2Vsc2V7aWYobi5ub2RlVHlwZSE9PWUuRUxFTUVOVF9OT0RFKXRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIG5vZGUhXCIpO3I9dC5YbWxFbGVtZW50KG4sby5fZG9tRmlsdGVyKX1pLnB1c2gocil9ZWxzZSBuLl9feXhtbD0hMX0pLHRoaXMuaW5zZXJ0KG4saSk7Zm9yKHZhciBsPWkubGVuZ3RoLHM9bjtzPG4rbDtzKyspe3ZhciB1PXRoaXMuZ2V0KHMpO3Uuc2V0RG9tRmlsdGVyKHRoaXMuX2RvbUZpbHRlciksdS5lbmFibGVTbWFydFNjcm9sbGluZyh0aGlzLl9zY3JvbGxFbGVtZW50KX1yZXR1cm4gbH19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbihlLG4pe2lmKCFBcnJheS5pc0FycmF5KG4pKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGFuIEFycmF5IG9mIGNvbnRlbnQhXCIpO2Zvcih2YXIgcj0wO3I8bi5sZW5ndGg7cisrKXt2YXIgbz1uW3JdLGk9dC51dGlscy5pc1R5cGVEZWZpbml0aW9uKG8pO2lmKG51bGw9PWl8fFwiWG1sRWxlbWVudFwiIT09aVswXS5uYW1lJiZcIlhtbFRleHRcIiE9PWlbMF0ubmFtZSl0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBZLlhtbCB0eXBlIG9yIFN0cmluZyFcIil9dC5BcnJheS50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuaW5zZXJ0LmNhbGwodGhpcyxlLG4pfX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHQuQXJyYXkudHlwZURlZmluaXRpb24uY2xhc3MucHJvdG90eXBlLmRlbGV0ZS5hcHBseSh0aGlzLGFyZ3VtZW50cyl9fSx7a2V5OlwiZ2V0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdC5BcnJheS50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuZ2V0LmFwcGx5KHRoaXMsYXJndW1lbnRzKX19LHtrZXk6XCJyZW1vdmVBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0Lk1hcC50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuZGVsZXRlLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19LHtrZXk6XCJzZXRBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0Lk1hcC50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuc2V0LmFwcGx5KHRoaXMsYXJndW1lbnRzKX19LHtrZXk6XCJnZXRBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0Lk1hcC50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuZ2V0LmFwcGx5KHRoaXMsYXJndW1lbnRzKX19LHtrZXk6XCJnZXRBdHRyaWJ1dGVzXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgZT10aGlzLG49dC5NYXAudHlwZURlZmluaXRpb24uY2xhc3MucHJvdG90eXBlLmtleXMuYXBwbHkodGhpcykscj17fTtyZXR1cm4gbi5mb3JFYWNoKGZ1bmN0aW9uKG4pe3ZhciBvPXQuTWFwLnR5cGVEZWZpbml0aW9uLmNsYXNzLnByb3RvdHlwZS5nZXQuY2FsbChlLG4pO251bGwhPW8mJihyW25dPW8pfSkscn19LHtrZXk6XCJfYmluZFRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcztyZXR1cm4gdGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcj1mdW5jdGlvbih0KXtlLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIG49ITE7dC5mb3JFYWNoKGZ1bmN0aW9uKHQpe2lmKFwiYXR0cmlidXRlc1wiPT09dC50eXBlKXt2YXIgcj10LmF0dHJpYnV0ZU5hbWU7aWYoZS5fZG9tRmlsdGVyKGUuZG9tLFtyXSkubGVuZ3RoPjApe3ZhciBvPXQudGFyZ2V0LmdldEF0dHJpYnV0ZShyKTtlLmdldEF0dHJpYnV0ZShyKSE9PW8mJihudWxsPT1vP2UucmVtb3ZlQXR0cmlidXRlKHIpOmUuc2V0QXR0cmlidXRlKHIsbykpfX1lbHNlXCJjaGlsZExpc3RcIj09PXQudHlwZSYmKG49ITApfSksbiYmdihlKX0pfSx0aGlzLl9kb21PYnNlcnZlcj1uZXcgbih0aGlzLl9kb21PYnNlcnZlckxpc3RlbmVyKSx0aGlzLl9kb21PYnNlcnZlci5vYnNlcnZlKHQse2F0dHJpYnV0ZXM6ITAsY2hpbGRMaXN0OiEwfSksdH19LHtrZXk6XCJfc2V0RG9tXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbCE9dGhpcy5kb20pdGhyb3cgbmV3IEVycm9yKFwiT25seSBjYWxsIHRoaXMgbWV0aG9kIGlmIHlvdSBrbm93IHdoYXQgeW91IGFyZSBkb2luZyA7KVwiKTtpZihudWxsIT10Ll9feXhtbCl0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IGJvdW5kIHRvIGFuIFlYbWwgdHlwZVwiKTt0Ll9feXhtbD10aGlzO2Zvcih2YXIgZT1bXSxyPTA7cjx0LmF0dHJpYnV0ZXMubGVuZ3RoO3IrKyllLnB1c2godC5hdHRyaWJ1dGVzW3JdLm5hbWUpO2U9dGhpcy5fZG9tRmlsdGVyKHQsZSk7Zm9yKHZhciBvPTA7bzxlLmxlbmd0aDtvKyspe3ZhciBpPWVbb10sbD10LmdldEF0dHJpYnV0ZShpKTt0aGlzLnNldEF0dHJpYnV0ZShpLGwpfXJldHVybiB0aGlzLmluc2VydERvbUVsZW1lbnRzKDAsQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodC5jaGlsZE5vZGVzKSksbnVsbCE9biYmKHRoaXMuZG9tPXRoaXMuX2JpbmRUb0RvbSh0KSksdH19LHtrZXk6XCJnZXREb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMuZG9tO2lmKG51bGw9PXQpe3Q9ZS5jcmVhdGVFbGVtZW50KHRoaXMubm9kZU5hbWUpLHQuX195eG1sPXRoaXM7dmFyIHI9dGhpcy5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBvIGluIHIpdC5zZXRBdHRyaWJ1dGUobyxyW29dKTtmb3IodmFyIGk9MDtpPHRoaXMuX2NvbnRlbnQubGVuZ3RoO2krKyl7dmFyIGw9dGhpcy5fY29udGVudFtpXSxzPXRoaXMub3MuZ2V0VHlwZShsLnR5cGUpO3QuYXBwZW5kQ2hpbGQocy5nZXREb20oKSl9bnVsbCE9PW4mJih0aGlzLmRvbT10aGlzLl9iaW5kVG9Eb20odCkpfXJldHVybiB0fX0se2tleTpcIm9ic2VydmVcIix2YWx1ZTpmdW5jdGlvbih0KXtmdW5jdGlvbiBlKGUpe2lmKFwiaW5zZXJ0XCI9PT1lLnR5cGUpdCh7dHlwZTpcImNoaWxkSW5zZXJ0ZWRcIixpbmRleDplLmluZGV4LHZhbHVlczplLnZhbHVlc30pO2Vsc2UgaWYoXCJkZWxldGVcIj09PWUudHlwZSl0KHZvaWQgMCE9PWUuaW5kZXg/e3R5cGU6XCJjaGlsZFJlbW92ZWRcIixpbmRleDplLmluZGV4LHZhbHVlczplLnZhbHVlcyxfY29udGVudDplLl9jb250ZW50fTp7dHlwZTpcImF0dHJpYnV0ZVJlbW92ZWRcIixuYW1lOmUubmFtZX0pO2Vsc2V7aWYoXCJ1cGRhdGVcIiE9PWUudHlwZSYmXCJhZGRcIiE9PWUudHlwZSl0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGV2ZW50XCIpO3Qoe3R5cGU6XCJhdHRyaWJ1dGVDaGFuZ2VkXCIsbmFtZTplLm5hbWUsdmFsdWU6ZS52YWx1ZX0pfX1yZXR1cm4gdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcihlKSxlfX0se2tleTpcInVub2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5Olwib2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwidW5vYnNlcnZlRGVlcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2RlZXBFdmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJfY2hhbmdlZFwiLHZhbHVlOmZ1bmN0aW9uKGUsbil7bnVsbCE9dGhpcy5fZG9tT2JzZXJ2ZXImJnRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIodGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSksdm9pZCAwIT09bi5wYXJlbnRTdWJ8fHZvaWQgMCE9PW4udGFyZ2V0UGFyZW50P3QuTWFwLnR5cGVEZWZpbml0aW9uLmNsYXNzLnByb3RvdHlwZS5fY2hhbmdlZC5hcHBseSh0aGlzLGFyZ3VtZW50cyk6dC5BcnJheS50eXBlRGVmaW5pdGlvbi5jbGFzcy5wcm90b3R5cGUuX2NoYW5nZWQuYXBwbHkodGhpcyxhcmd1bWVudHMpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksbH0odC51dGlscy5DdXN0b21UeXBlKTt0LmV4dGVuZChcIlhtbEVsZW1lbnRcIixuZXcgdC51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbih7bmFtZTpcIlhtbEVsZW1lbnRcIixjbGFzczppLHN0cnVjdDpcIlhtbFwiLHBhcnNlQXJndW1lbnRzOmZ1bmN0aW9uKHQsbil7dmFyIHI9dm9pZCAwO2lmKHI9XCJmdW5jdGlvblwiPT10eXBlb2Ygbj9uOm0sXCJzdHJpbmdcIj09dHlwZW9mIHQpcmV0dXJuW3RoaXMse25vZGVOYW1lOnQudG9VcHBlckNhc2UoKSxkb206bnVsbCxkb21GaWx0ZXI6cn1dO2lmKHQubm9kZVR5cGU9PT1lLkVMRU1FTlRfTk9ERSlyZXR1cm5bdGhpcyx7bm9kZU5hbWU6dC5ub2RlTmFtZSxkb206dCxkb21GaWx0ZXI6cn1dO3Rocm93IG5ldyBFcnJvcihcIlkuWG1sRWxlbWVudCByZXF1aXJlcyBhbiBhcmd1bWVudCB3aGljaCBpcyBhIHN0cmluZyFcIil9LGluaXRUeXBlOmZ1bmN0aW9uKGUsbixyKXt2YXIgbz1bXSxsPVtdO3QuU3RydWN0LlhtbC5tYXAuY2FsbCh0aGlzLG4sZnVuY3Rpb24odCl7dC5oYXNPd25Qcm9wZXJ0eShcIm9wQ29udGVudFwiKT8oby5wdXNoKHtpZDp0LmlkLHR5cGU6dC5vcENvbnRlbnR9KSxsLnB1c2godC5vcENvbnRlbnQpKTp0LmNvbnRlbnQuZm9yRWFjaChmdW5jdGlvbihlLG4pe28ucHVzaCh7aWQ6W3QuaWRbMF0sdC5pZFsxXStuXSx2YWw6dC5jb250ZW50W25dfSl9KX0pO2Zvcih2YXIgcz0wO3M8bC5sZW5ndGg7cysrKXt0aGlzLnN0b3JlLmluaXRUeXBlLmNhbGwodGhpcyxsW3NdLHIpLl9wYXJlbnQ9bi5pZH12YXIgdT17fSxhPXt9LGM9bi5tYXA7Zm9yKHZhciBoIGluIGMpe3ZhciBkPXRoaXMuZ2V0T3BlcmF0aW9uKGNbaF0pO2QuZGVsZXRlZHx8KG51bGwhPWQub3BDb250ZW50PyhhW2hdPWQub3BDb250ZW50LHRoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLGQub3BDb250ZW50KSk6dVtoXT1kLmNvbnRlbnRbMF0pfXJldHVybiBuZXcgaShlLG4sbyx1LGEsbnVsbCE9cj9yLmRvbTpudWxsLG51bGwhPXI/ci5kb21GaWx0ZXI6bSl9LGNyZWF0ZVR5cGU6ZnVuY3Rpb24odCxlLG4pe3JldHVybiBuZXcgaSh0LGUsW10se30se30sbi5kb20sbi5kb21GaWx0ZXIpfX0pKX1mdW5jdGlvbiBFKHQsZSxuKXtudWxsPT1lJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgZG9jdW1lbnQmJihlPWRvY3VtZW50KSxuPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBNdXRhdGlvbk9ic2VydmVyP011dGF0aW9uT2JzZXJ2ZXI6bnVsbCxiKHQsZSxuKSxfKHQsZSxuKSxnKHQsZSxuKX12YXIgTz0tMSxEPTEseD0wLHc9dDt3LklOU0VSVD1ELHcuREVMRVRFPU8sdy5FUVVBTD14O3ZhciBrPXcsVD1mdW5jdGlvbih0LGUpe2lmKCEodCBpbnN0YW5jZW9mIGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIil9LEE9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7Zm9yKHZhciBuPTA7bjxlLmxlbmd0aDtuKyspe3ZhciByPWVbbl07ci5lbnVtZXJhYmxlPXIuZW51bWVyYWJsZXx8ITEsci5jb25maWd1cmFibGU9ITAsXCJ2YWx1ZVwiaW4gciYmKHIud3JpdGFibGU9ITApLE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0LHIua2V5LHIpfX1yZXR1cm4gZnVuY3Rpb24oZSxuLHIpe3JldHVybiBuJiZ0KGUucHJvdG90eXBlLG4pLHImJnQoZSxyKSxlfX0oKSxDPWZ1bmN0aW9uIHQoZSxuLHIpe251bGw9PT1lJiYoZT1GdW5jdGlvbi5wcm90b3R5cGUpO3ZhciBvPU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZSxuKTtpZih2b2lkIDA9PT1vKXt2YXIgaT1PYmplY3QuZ2V0UHJvdG90eXBlT2YoZSk7cmV0dXJuIG51bGw9PT1pP3ZvaWQgMDp0KGksbixyKX1pZihcInZhbHVlXCJpbiBvKXJldHVybiBvLnZhbHVlO3ZhciBsPW8uZ2V0O2lmKHZvaWQgMCE9PWwpcmV0dXJuIGwuY2FsbChyKX0sTD1mdW5jdGlvbih0LGUpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUmJm51bGwhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiBlKTt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGUmJmUucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6dCxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSxlJiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZih0LGUpOnQuX19wcm90b19fPWUpfSxTPWZ1bmN0aW9uKHQsZSl7aWYoIXQpdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO3JldHVybiFlfHxcIm9iamVjdFwiIT10eXBlb2YgZSYmXCJmdW5jdGlvblwiIT10eXBlb2YgZT90OmV9O3JldHVyblwidW5kZWZpbmVkXCIhPXR5cGVvZiBZJiZFKFkpLEV9KTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXkteG1sLmpzLm1hcFxuIiwiLyoqXG4gKiB5anMyIC0gQSBmcmFtZXdvcmsgZm9yIHJlYWwtdGltZSBwMnAgc2hhcmVkIGVkaXRpbmcgb24gYW55IGRhdGFcbiAqIEB2ZXJzaW9uIHYxLjMuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbiFmdW5jdGlvbih0LGUpe1wib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPWUoKTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKGUpOnQuWT1lKCl9KHRoaXMsZnVuY3Rpb24oKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiB0KHQsZSxuLHIpe2lmKG51bGw9PT1lKXQucm9vdD1uLG4uX3BhcmVudD1udWxsO2Vsc2UgaWYoZS5sZWZ0PT09cillLmxlZnQ9bjtlbHNle2lmKGUucmlnaHQhPT1yKXRocm93IG5ldyBFcnJvcihcIlRoZSBlbGVtZW50cyBhcmUgd3JvbmdseSBjb25uZWN0ZWQhXCIpO2UucmlnaHQ9bn19ZnVuY3Rpb24gZSh0LGUpe3ZhciBuPWUuX2lkO2lmKHZvaWQgMD09PW4pZS5faW50ZWdyYXRlKHQpO2Vsc2V7aWYodC5zcy5nZXRTdGF0ZShuLnVzZXIpPm4uY2xvY2spcmV0dXJuOyF0LmdjRW5hYmxlZHx8ZS5jb25zdHJ1Y3Rvcj09PXh0fHxlLl9wYXJlbnQuY29uc3RydWN0b3IhPT14dCYmITE9PT1lLl9wYXJlbnQuX2RlbGV0ZWQ/ZS5faW50ZWdyYXRlKHQpOmUuX2djKHQpO3ZhciByPXQuX21pc3NpbmdTdHJ1Y3RzLmdldChuLnVzZXIpO2lmKG51bGwhPXIpZm9yKHZhciBpPW4uY2xvY2ssbz1pK2UuX2xlbmd0aDtpPG87aSsrKXt2YXIgYT1yLmdldChpKTt2b2lkIDAhPT1hJiYoYS5mb3JFYWNoKGZ1bmN0aW9uKGUpe2lmKDA9PT0tLWUubWlzc2luZyl7dmFyIG49ZS5kZWNvZGVyLHI9bi5wb3MsaT1lLnN0cnVjdC5fZnJvbUJpbmFyeSh0LG4pO24ucG9zPXIsMD09PWkubGVuZ3RoJiZ0Ll9yZWFkeVRvSW50ZWdyYXRlLnB1c2goZS5zdHJ1Y3QpfX0pLHIuZGVsZXRlKGkpKX19fWZ1bmN0aW9uIG4odCxlLG4pe2Zvcih2YXIgcj1lLnJlYWRVaW50MzIoKSxpPTA7aTxyO2krKyl7dmFyIG89ZS5yZWFkVmFyVWludCgpLGE9RihvKSxzPW5ldyBhLGw9cy5fZnJvbUJpbmFyeSh0LGUpLHU9XCIgIFwiK3MuX2xvZ1N0cmluZygpO2wubGVuZ3RoPjAmJih1Kz1cIiAuLiBtaXNzaW5nOiBcIitsLm1hcChwKS5qb2luKFwiLCBcIikpLG4ucHVzaCh1KX19ZnVuY3Rpb24gcih0LG4pe2Zvcih2YXIgcj1uLnJlYWRVaW50MzIoKSxpPTA7aTxyO2krKyl7dmFyIG89bi5yZWFkVmFyVWludCgpLGE9RihvKSxzPW5ldyBhLGw9bi5wb3MsdT1zLl9mcm9tQmluYXJ5KHQsbik7aWYoMD09PXUubGVuZ3RoKWZvcig7bnVsbCE9czspZSh0LHMpLHM9dC5fcmVhZHlUb0ludGVncmF0ZS5zaGlmdCgpO2Vsc2V7dmFyIGM9bmV3IE50KG4udWludDhhcnIpO2MucG9zPWw7Zm9yKHZhciBoPW5ldyBJdChjLHUscyksZj10Ll9taXNzaW5nU3RydWN0cyxkPXUubGVuZ3RoLTE7ZD49MDtkLS0pe3ZhciBfPXVbZF07Zi5oYXMoXy51c2VyKXx8Zi5zZXQoXy51c2VyLG5ldyBNYXApO3ZhciB2PWYuZ2V0KF8udXNlcik7di5oYXMoXy5jbG9jayl8fHYuc2V0KF8uY2xvY2ssW10pOyh2PXYuZ2V0KF8uY2xvY2spKS5wdXNoKGgpfX19fWZ1bmN0aW9uIGkodCl7Zm9yKHZhciBlPW5ldyBNYXAsbj10LnJlYWRVaW50MzIoKSxyPTA7cjxuO3IrKyl7dmFyIGk9dC5yZWFkVmFyVWludCgpLG89dC5yZWFkVmFyVWludCgpO2Uuc2V0KGksbyl9cmV0dXJuIGV9ZnVuY3Rpb24gbyh0LGUpe3ZhciBuPWUucG9zLHI9MDtlLndyaXRlVWludDMyKDApO3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXQuc3Muc3RhdGVbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9VXQocy52YWx1ZSwyKSxjPXVbMF0saD11WzFdO2Uud3JpdGVWYXJVaW50KGMpLGUud3JpdGVWYXJVaW50KGgpLHIrK319Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX1lLnNldFVpbnQzMihuLHIpfWZ1bmN0aW9uIGEodCxlKXt2YXIgbj1udWxsLHI9dm9pZCAwLGk9dm9pZCAwLG89MCxhPWUucG9zO2Uud3JpdGVVaW50MzIoMCksdC5kcy5pdGVyYXRlKG51bGwsbnVsbCxmdW5jdGlvbih0KXt2YXIgYT10Ll9pZC51c2VyLHM9dC5faWQuY2xvY2ssbD10Lmxlbix1PXQuZ2M7biE9PWEmJihvKyssbnVsbCE9PW4mJmUuc2V0VWludDMyKGksciksbj1hLGUud3JpdGVWYXJVaW50KGEpLGk9ZS5wb3MsZS53cml0ZVVpbnQzMigwKSxyPTApLGUud3JpdGVWYXJVaW50KHMpLGUud3JpdGVWYXJVaW50KGwpLGUud3JpdGVVaW50OCh1PzE6MCkscisrfSksbnVsbCE9PW4mJmUuc2V0VWludDMyKGksciksZS5zZXRVaW50MzIoYSxvKX1mdW5jdGlvbiBzKHQsZSl7Zm9yKHZhciBuPWUucmVhZFVpbnQzMigpLHI9MDtyPG47cisrKSFmdW5jdGlvbihuKXtmb3IodmFyIHI9ZS5yZWFkVmFyVWludCgpLGk9W10sbz1lLnJlYWRVaW50MzIoKSxhPTA7YTxvO2ErKyl7dmFyIHM9ZS5yZWFkVmFyVWludCgpLGw9ZS5yZWFkVmFyVWludCgpLHU9MT09PWUucmVhZFVpbnQ4KCk7aS5wdXNoKFtzLGwsdV0pfWlmKG8+MCl7dmFyIGM9MCxoPWlbY10sZj1bXTt0LmRzLml0ZXJhdGUobmV3IEF0KHIsMCksbmV3IEF0KHIsTnVtYmVyLk1BWF9WQUxVRSksZnVuY3Rpb24odCl7Zm9yKDtudWxsIT1oOyl7dmFyIGU9MDtpZih0Ll9pZC5jbG9jayt0Lmxlbjw9aFswXSlicmVhaztoWzBdPHQuX2lkLmNsb2NrPyhlPU1hdGgubWluKHQuX2lkLmNsb2NrLWhbMF0saFsxXSksZi5wdXNoKFtyLGhbMF0sZV0pKTooZT10Ll9pZC5jbG9jayt0Lmxlbi1oWzBdLGhbMl0mJiF0LmdjJiZmLnB1c2goW3IsaFswXSxNYXRoLm1pbihlLGhbMV0pXSkpLGhbMV08PWU/aD1pWysrY106KGhbMF09aFswXStlLGhbMV09aFsxXS1lKX19KTtmb3IodmFyIGQ9Zi5sZW5ndGgtMTtkPj0wO2QtLSl7dmFyIF89ZltkXTtnKHQsX1swXSxfWzFdLF9bMl0sITApfWZvcig7YzxpLmxlbmd0aDtjKyspaD1pW2NdLGcodCxyLGhbMF0saFsxXSwhMCl9fSgpfWZ1bmN0aW9uIGwodCxlLG4pe3ZhciByPWUucmVhZFZhclN0cmluZygpLGk9ZS5yZWFkVmFyVWludCgpO24ucHVzaCgnICAtIGF1dGg6IFwiJytyKydcIicpLG4ucHVzaChcIiAgLSBwcm90b2NvbFZlcnNpb246IFwiK2kpO2Zvcih2YXIgbz1bXSxhPWUucmVhZFVpbnQzMigpLHM9MDtzPGE7cysrKXt2YXIgbD1lLnJlYWRWYXJVaW50KCksdT1lLnJlYWRWYXJVaW50KCk7by5wdXNoKFwiKFwiK2wrXCI6XCIrdStcIilcIil9bi5wdXNoKFwiICA9PSBTUzogXCIrby5qb2luKFwiLFwiKSl9ZnVuY3Rpb24gdSh0LGUpe3ZhciBuPW5ldyBqdDtuLndyaXRlVmFyU3RyaW5nKHQueS5yb29tKSxuLndyaXRlVmFyU3RyaW5nKFwic3luYyBzdGVwIDFcIiksbi53cml0ZVZhclN0cmluZyh0LmF1dGhJbmZvfHxcIlwiKSxuLndyaXRlVmFyVWludCh0LnByb3RvY29sVmVyc2lvbiksbyh0LnksbiksdC5zZW5kKGUsbi5jcmVhdGVCdWZmZXIoKSl9ZnVuY3Rpb24gYyh0LGUsbil7dmFyIHI9ZS5wb3M7ZS53cml0ZVVpbnQzMigwKTt2YXIgaT0wLG89ITAsYT0hMSxzPXZvaWQgMDt0cnl7Zm9yKHZhciBsLHU9dC5zcy5zdGF0ZS5rZXlzKClbU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9bC52YWx1ZSxoPW4uZ2V0KGMpfHwwO2lmKGMhPT1ZdCl7dmFyIGY9bmV3IEF0KGMsaCksZD10Lm9zLmZpbmRQcmV2KGYpLF89bnVsbD09PWQ/bnVsbDpkLl9pZDtpZihudWxsIT09XyYmXy51c2VyPT09YyYmXy5jbG9jaytkLl9sZW5ndGg+aCl7ZC5fY2xvbmVQYXJ0aWFsKGgtXy5jbG9jaykuX3RvQmluYXJ5KGUpLGkrK310Lm9zLml0ZXJhdGUoZixuZXcgQXQoYyxOdW1iZXIuTUFYX1ZBTFVFKSxmdW5jdGlvbih0KXt0Ll90b0JpbmFyeShlKSxpKyt9KX19fWNhdGNoKHQpe2E9ITAscz10fWZpbmFsbHl7dHJ5eyFvJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKGEpdGhyb3cgc319ZS5zZXRVaW50MzIocixpKX1mdW5jdGlvbiBoKHQsZSxuLHIsbyl7dmFyIHM9dC5yZWFkVmFyVWludCgpO3MhPT1uLmNvbm5lY3Rvci5wcm90b2NvbFZlcnNpb24mJihjb25zb2xlLndhcm4oXCJZb3UgdHJpZWQgdG8gc3luYyB3aXRoIGEgWWpzIGluc3RhbmNlIHRoYXQgaGFzIGEgZGlmZmVyZW50IHByb3RvY29sIHZlcnNpb25cXG4gICAgICAoWW91OiBcIitzK1wiLCBDbGllbnQ6IFwiK3MrXCIpLlxcbiAgICAgIFwiKSxuLmRlc3Ryb3koKSksZS53cml0ZVZhclN0cmluZyhcInN5bmMgc3RlcCAyXCIpLGUud3JpdGVWYXJTdHJpbmcobi5jb25uZWN0b3IuYXV0aEluZm98fFwiXCIpLGMobixlLGkodCkpLGEobixlKSxuLmNvbm5lY3Rvci5zZW5kKHIudWlkLGUuY3JlYXRlQnVmZmVyKCkpLHIucmVjZWl2ZWRTeW5jU3RlcDI9ITAsXCJzbGF2ZVwiPT09bi5jb25uZWN0b3Iucm9sZSYmdShuLmNvbm5lY3RvcixvKX1mdW5jdGlvbiBmKHQsZSxyKXtyLnB1c2goXCIgICAgIC0gYXV0aDogXCIrZS5yZWFkVmFyU3RyaW5nKCkpLHIucHVzaChcIiAgPT0gT1M6XCIpLG4odCxlLHIpLHIucHVzaChcIiAgPT0gRFM6XCIpO2Zvcih2YXIgaT1lLnJlYWRVaW50MzIoKSxvPTA7bzxpO28rKyl7dmFyIGE9ZS5yZWFkVmFyVWludCgpO3IucHVzaChcIiAgICBVc2VyOiBcIithK1wiOiBcIik7Zm9yKHZhciBzPWUucmVhZFVpbnQzMigpLGw9MDtsPHM7bCsrKXt2YXIgdT1lLnJlYWRWYXJVaW50KCksYz1lLnJlYWRWYXJVaW50KCksaD0xPT09ZS5yZWFkVWludDgoKTtyLnB1c2goXCJbXCIrdStcIiwgXCIrYytcIiwgXCIraCtcIl1cIil9fX1mdW5jdGlvbiBkKHQsZSxuLGksbyl7cihuLHQpLHMobix0KSxuLmNvbm5lY3Rvci5fc2V0U3luY2VkV2l0aChvKX1mdW5jdGlvbiBfKHQpe3ZhciBlPVV0KHQsMikscj1lWzBdLGk9ZVsxXSxvPW5ldyBOdChpKTtvLnJlYWRWYXJTdHJpbmcoKTt2YXIgYT1vLnJlYWRWYXJTdHJpbmcoKSxzPVtdO3JldHVybiBzLnB1c2goXCJcXG4gPT09IFwiK2ErXCIgPT09XCIpLFwidXBkYXRlXCI9PT1hP24ocixvLHMpOlwic3luYyBzdGVwIDFcIj09PWE/bChyLG8scyk6XCJzeW5jIHN0ZXAgMlwiPT09YT9mKHIsbyxzKTpzLnB1c2goXCItLSBVbmtub3duIG1lc3NhZ2UgdHlwZSAtIHByb2JhYmx5IGFuIGVuY29kaW5nIGlzc3VlISEhXCIpLHMuam9pbihcIlxcblwiKX1mdW5jdGlvbiB2KHQpe3ZhciBlPW5ldyBOdCh0KTtyZXR1cm4gZS5yZWFkVmFyU3RyaW5nKCksZS5yZWFkVmFyU3RyaW5nKCl9ZnVuY3Rpb24gcCh0KXtpZihudWxsIT09dCYmbnVsbCE9dC5faWQmJih0PXQuX2lkKSxudWxsPT09dClyZXR1cm5cIigpXCI7aWYodCBpbnN0YW5jZW9mIEF0KXJldHVyblwiKFwiK3QudXNlcitcIixcIit0LmNsb2NrK1wiKVwiO2lmKHQgaW5zdGFuY2VvZiB6dClyZXR1cm5cIihcIit0Lm5hbWUrXCIsXCIrdC50eXBlK1wiKVwiO2lmKHQuY29uc3RydWN0b3I9PT1ZKXJldHVyblwieVwiO3Rocm93IG5ldyBFcnJvcihcIlRoaXMgaXMgbm90IGEgdmFsaWQgSUQhXCIpfWZ1bmN0aW9uIHkodCxlLG4pe3ZhciByPW51bGwhPT1lLl9sZWZ0P2UuX2xlZnQuX2xhc3RJZDpudWxsLGk9bnVsbCE9PWUuX29yaWdpbj9lLl9vcmlnaW4uX2xhc3RJZDpudWxsO3JldHVybiB0K1wiKGlkOlwiK3AoZS5faWQpK1wiLGxlZnQ6XCIrcChyKStcIixvcmlnaW46XCIrcChpKStcIixyaWdodDpcIitwKGUuX3JpZ2h0KStcIixwYXJlbnQ6XCIrcChlLl9wYXJlbnQpK1wiLHBhcmVudFN1YjpcIitlLl9wYXJlbnRTdWIrKHZvaWQgMCE9PW4/XCIgLSBcIituOlwiXCIpK1wiKVwifWZ1bmN0aW9uIGcodCxlLG4scixpKXt2YXIgbz1udWxsIT09dC5jb25uZWN0b3ImJnQuY29ubmVjdG9yLl9mb3J3YXJkQXBwbGllZFN0cnVjdHMsYT10Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KG5ldyBBdChlLG4pKTtpZihudWxsIT09YSl7YS5fZGVsZXRlZHx8KGEuX3NwbGl0QXQodCxyKSxhLl9kZWxldGUodCxvLCEwKSk7dmFyIHM9YS5fbGVuZ3RoO2lmKHItPXMsbis9cyxyPjApZm9yKHZhciBsPXQub3MuZmluZE5vZGUobmV3IEF0KGUsbikpO251bGwhPT1sJiZudWxsIT09bC52YWwmJnI+MCYmbC52YWwuX2lkLmVxdWFscyhuZXcgQXQoZSxuKSk7KXt2YXIgdT1sLnZhbDt1Ll9kZWxldGVkfHwodS5fc3BsaXRBdCh0LHIpLHUuX2RlbGV0ZSh0LG8saSkpO3ZhciBjPXUuX2xlbmd0aDtyLT1jLG4rPWMsbD1sLm5leHQoKX19fWZ1bmN0aW9uIG0odCxlLG4pe2lmKGUhPT10JiYhZS5fZGVsZXRlZCYmIXQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKSl7dmFyIHI9dC5fdHJhbnNhY3Rpb24uY2hhbmdlZFR5cGVzLGk9ci5nZXQoZSk7dm9pZCAwPT09aSYmKGk9bmV3IFNldCxyLnNldChlLGkpKSxpLmFkZChuKX19ZnVuY3Rpb24gayh0LGUsbixyKXt2YXIgaT1lLl9pZDtuLl9pZD1uZXcgQXQoaS51c2VyLGkuY2xvY2srciksbi5fb3JpZ2luPWUsbi5fbGVmdD1lLG4uX3JpZ2h0PWUuX3JpZ2h0LG51bGwhPT1uLl9yaWdodCYmKG4uX3JpZ2h0Ll9sZWZ0PW4pLG4uX3JpZ2h0X29yaWdpbj1lLl9yaWdodF9vcmlnaW4sZS5fcmlnaHQ9bixuLl9wYXJlbnQ9ZS5fcGFyZW50LG4uX3BhcmVudFN1Yj1lLl9wYXJlbnRTdWIsbi5fZGVsZXRlZD1lLl9kZWxldGVkO3ZhciBvPW5ldyBTZXQ7by5hZGQoZSk7Zm9yKHZhciBhPW4uX3JpZ2h0O251bGwhPT1hJiZvLmhhcyhhLl9vcmlnaW4pOylhLl9vcmlnaW49PT1lJiYoYS5fb3JpZ2luPW4pLG8uYWRkKGEpLGE9YS5fcmlnaHQ7dC5vcy5wdXQobiksdC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuaGFzKGUpP3QuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmFkZChuKTp0Ll90cmFuc2FjdGlvbi5kZWxldGVkU3RydWN0cy5oYXMoZSkmJnQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmFkZChuKX1mdW5jdGlvbiBiKHQsZSl7dmFyIG49dm9pZCAwO2Rve249ZS5fcmlnaHQsZS5fcmlnaHQ9bnVsbCxlLl9yaWdodF9vcmlnaW49bnVsbCxlLl9vcmlnaW49ZS5fbGVmdCxlLl9pbnRlZ3JhdGUodCksZT1ufXdoaWxlKG51bGwhPT1uKX1mdW5jdGlvbiB3KHQsZSl7Zm9yKDtudWxsIT09ZTspZS5fZGVsZXRlKHQsITEsITApLGUuX2djKHQpLGU9ZS5fcmlnaHR9ZnVuY3Rpb24gUyh0LGUsbixyLGkpe3QuX29yaWdpbj1yLHQuX2xlZnQ9cix0Ll9yaWdodD1pLHQuX3JpZ2h0X29yaWdpbj1pLHQuX3BhcmVudD1lLG51bGwhPT1uP3QuX2ludGVncmF0ZShuKTpudWxsPT09cj9lLl9zdGFydD10OnIuX3JpZ2h0PXR9ZnVuY3Rpb24gTyh0LGUsbixyLGkpe2Zvcig7bnVsbCE9PXImJmk+MDspe3N3aXRjaChyLmNvbnN0cnVjdG9yKXtjYXNlIEN0OmNhc2UgSXRlbVN0cmluZzppZihpPD0oci5fZGVsZXRlZD8wOnIuX2xlbmd0aC0xKSlyZXR1cm4gcj1yLl9zcGxpdEF0KGUuX3ksaSksbj1yLl9sZWZ0LFtuLHIsdF07ITE9PT1yLl9kZWxldGVkJiYoaS09ci5fbGVuZ3RoKTticmVhaztjYXNlIE10OiExPT09ci5fZGVsZXRlZCYmQih0LHIpfW49cixyPXIuX3JpZ2h0fXJldHVybltuLHIsdF19ZnVuY3Rpb24gRSh0LGUpe3JldHVybiBPKG5ldyBNYXAsdCxudWxsLHQuX3N0YXJ0LGUpfWZ1bmN0aW9uIFUodCxlLG4scixpKXtmb3IoO251bGwhPT1yJiYoITA9PT1yLl9kZWxldGVkfHxyLmNvbnN0cnVjdG9yPT09TXQmJmkuZ2V0KHIua2V5KT09PXIudmFsdWUpOykhMT09PXIuX2RlbGV0ZWQmJmkuZGVsZXRlKHIua2V5KSxuPXIscj1yLl9yaWdodDt2YXIgbz0hMCxhPSExLHM9dm9pZCAwO3RyeXtmb3IodmFyIGwsdT1pW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPVV0KGwudmFsdWUsMiksaD1jWzBdLGY9Y1sxXSxkPW5ldyBNdDtkLmtleT1oLGQudmFsdWU9ZixTKGQsZSx0LG4sciksbj1kfX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fXJldHVybltuLHJdfWZ1bmN0aW9uIEIodCxlKXt2YXIgbj1lLnZhbHVlLHI9ZS5rZXk7bnVsbD09PW4/dC5kZWxldGUocik6dC5zZXQocixuKX1mdW5jdGlvbiBUKHQsZSxuLHIpe2Zvcig7Oyl7aWYobnVsbD09PWUpYnJlYWs7aWYoITA9PT1lLl9kZWxldGVkKTtlbHNle2lmKGUuY29uc3RydWN0b3IhPT1NdHx8KHJbZS5rZXldfHxudWxsKSE9PWUudmFsdWUpYnJlYWs7QihuLGUpfXQ9ZSxlPWUuX3JpZ2h0fXJldHVyblt0LGVdfWZ1bmN0aW9uIEEodCxlLG4scixpLG8pe3ZhciBhPW5ldyBNYXA7Zm9yKHZhciBzIGluIGkpe3ZhciBsPWlbc10sdT1vLmdldChzKTtpZih1IT09bCl7YS5zZXQocyx1fHxudWxsKTt2YXIgYz1uZXcgTXQ7Yy5rZXk9cyxjLnZhbHVlPWwsUyhjLGUsdCxuLHIpLG49Y319cmV0dXJuW24scixhXX1mdW5jdGlvbiBEKHQsZSxuLHIsaSxvLGEpe3ZhciBzPSEwLGw9ITEsdT12b2lkIDA7dHJ5e2Zvcih2YXIgYyxoPW9bU3ltYm9sLml0ZXJhdG9yXSgpOyEocz0oYz1oLm5leHQoKSkuZG9uZSk7cz0hMCl7dmFyIGY9VXQoYy52YWx1ZSwxKSxkPWZbMF07dm9pZCAwPT09YVtkXSYmKGFbZF09bnVsbCl9fWNhdGNoKHQpe2w9ITAsdT10fWZpbmFsbHl7dHJ5eyFzJiZoLnJldHVybiYmaC5yZXR1cm4oKX1maW5hbGx5e2lmKGwpdGhyb3cgdX19dmFyIF89VChyLGksbyxhKSx2PVV0KF8sMik7cj12WzBdLGk9dlsxXTt2YXIgcD12b2lkIDAseT1BKHQsbixyLGksYSxvKSxnPVV0KHksMyk7cj1nWzBdLGk9Z1sxXSxwPWdbMl07dmFyIG09dm9pZCAwO3JldHVybiBlLmNvbnN0cnVjdG9yPT09U3RyaW5nPyhtPW5ldyBJdGVtU3RyaW5nLG0uX2NvbnRlbnQ9ZSk6KG09bmV3IEN0LG0uZW1iZWQ9ZSksUyhtLG4sdCxyLGkpLHI9bSxVKHQsbixyLGkscCl9ZnVuY3Rpb24gUCh0LGUsbixyLGksbyxhKXt2YXIgcz1UKHIsaSxvLGEpLGw9VXQocywyKTtyPWxbMF0saT1sWzFdO3ZhciB1PXZvaWQgMCxjPUEodCxuLHIsaSxhLG8pLGg9VXQoYywzKTtmb3Iocj1oWzBdLGk9aFsxXSx1PWhbMl07ZT4wJiZudWxsIT09aTspe2lmKCExPT09aS5fZGVsZXRlZClzd2l0Y2goaS5jb25zdHJ1Y3Rvcil7Y2FzZSBNdDp2YXIgZj1hW2kua2V5XTt2b2lkIDAhPT1mJiYoZj09PWkudmFsdWU/dS5kZWxldGUoaS5rZXkpOnUuc2V0KGkua2V5LGkudmFsdWUpLGkuX2RlbGV0ZSh0KSksQihvLGkpO2JyZWFrO2Nhc2UgQ3Q6Y2FzZSBJdGVtU3RyaW5nOmkuX3NwbGl0QXQodCxlKSxlLT1pLl9sZW5ndGh9cj1pLGk9aS5fcmlnaHR9cmV0dXJuIFUodCxuLHIsaSx1KX1mdW5jdGlvbiBOKHQsZSxuLHIsaSxvKXtmb3IoO2U+MCYmbnVsbCE9PWk7KXtpZighMT09PWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgTXQ6QihvLGkpO2JyZWFrO2Nhc2UgQ3Q6Y2FzZSBJdGVtU3RyaW5nOmkuX3NwbGl0QXQodCxlKSxlLT1pLl9sZW5ndGgsaS5fZGVsZXRlKHQpfXI9aSxpPWkuX3JpZ2h0fXJldHVybltyLGldfWZ1bmN0aW9uIHgodCxlKXtmb3IoZT1lLl9wYXJlbnQ7bnVsbCE9PWU7KXtpZihlPT09dClyZXR1cm4hMDtlPWUuX3BhcmVudH1yZXR1cm4hMX1mdW5jdGlvbiBJKHQsZSl7cmV0dXJuIGV9ZnVuY3Rpb24gaih0LGUpe2Zvcih2YXIgbj1uZXcgTWFwLHI9dC5hdHRyaWJ1dGVzLmxlbmd0aC0xO3I+PTA7ci0tKXt2YXIgaT10LmF0dHJpYnV0ZXNbcl07bi5zZXQoaS5uYW1lLGkudmFsdWUpfXJldHVybiBlKHQubm9kZU5hbWUsbil9ZnVuY3Rpb24gVih0LGUsbil7aWYoeChlLnR5cGUsbikpe3ZhciByPW4ubm9kZU5hbWUsaT1uZXcgTWFwO2lmKHZvaWQgMCE9PW4uZ2V0QXR0cmlidXRlcyl7dmFyIG89bi5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBhIGluIG8paS5zZXQoYSxvW2FdKX12YXIgcz1lLmZpbHRlcihyLG5ldyBNYXAoaSkpO251bGw9PT1zP24uX2RlbGV0ZSh0KTppLmZvckVhY2goZnVuY3Rpb24odCxlKXshMT09PXMuaGFzKGUpJiZuLnJlbW92ZUF0dHJpYnV0ZShlKX0pfX1mdW5jdGlvbiBMKHQpe3ZhciBlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTpkb2N1bWVudCxuPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fSxyPWFyZ3VtZW50cy5sZW5ndGg+MyYmdm9pZCAwIT09YXJndW1lbnRzWzNdP2FyZ3VtZW50c1szXTpJLGk9YXJndW1lbnRzWzRdLG89dm9pZCAwO3N3aXRjaCh0Lm5vZGVUeXBlKXtjYXNlIGUuRUxFTUVOVF9OT0RFOnZhciBhPW51bGwscz12b2lkIDA7aWYodC5oYXNBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpJiYoYT10LmdldEF0dHJpYnV0ZShcImRhdGEteWpzLWhvb2tcIiksdm9pZCAwPT09KHM9blthXSkmJihjb25zb2xlLmVycm9yKCdVbmtub3duIGhvb2sgXCInK2ErJ1wiLiBEZWxldGluZyB5anNIb29rIGRhdGFzZXQgcHJvcGVydHkuJyksdC5yZW1vdmVBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpLGE9bnVsbCkpLG51bGw9PT1hKXt2YXIgbD1qKHQscik7bnVsbD09PWw/bz0hMToobz1uZXcgWVhtbEVsZW1lbnQodC5ub2RlTmFtZSksbC5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7by5zZXRBdHRyaWJ1dGUoZSx0KX0pLG8uaW5zZXJ0KDAsVyh0LmNoaWxkTm9kZXMsZG9jdW1lbnQsbixyLGkpKSl9ZWxzZSBvPW5ldyBZWG1sSG9vayhhKSxzLmZpbGxUeXBlKHQsbyk7YnJlYWs7Y2FzZSBlLlRFWFRfTk9ERTpvPW5ldyBZWG1sVGV4dCxvLmluc2VydCgwLHQubm9kZVZhbHVlKTticmVhaztkZWZhdWx0OnRocm93IG5ldyBFcnJvcihcIkNhbid0IHRyYW5zZm9ybSB0aGlzIG5vZGUgdHlwZSB0byBhIFlYbWwgdHlwZSFcIil9cmV0dXJuIFIoaSx0LG8pLG99ZnVuY3Rpb24gQyh0KXtmb3IoO251bGwhPT10JiZ0Ll9kZWxldGVkOyl0PXQuX3JpZ2h0O3JldHVybiB0fWZ1bmN0aW9uIE0odCxlLG4pe3QuZG9tVG9UeXBlLmRlbGV0ZShlKSx0LnR5cGVUb0RvbS5kZWxldGUobil9ZnVuY3Rpb24gUih0LGUsbil7dm9pZCAwIT09dCYmKHQuZG9tVG9UeXBlLnNldChlLG4pLHQudHlwZVRvRG9tLnNldChuLGUpKX1mdW5jdGlvbiBIKHQsZSxuKXtpZih2b2lkIDAhPT10KXt2YXIgcj10LmRvbVRvVHlwZS5nZXQoZSk7dm9pZCAwIT09ciYmKE0odCxlLHIpLFIodCxuLHIpKX19ZnVuY3Rpb24gSih0LGUsbixyLGkpe3ZhciBvPVcobixyLGkub3B0cy5ob29rcyxpLmZpbHRlcixpKTtyZXR1cm4gdC5pbnNlcnRBZnRlcihlLG8pfWZ1bmN0aW9uIFcodCxlLG4scixpKXt2YXIgbz1bXSxhPSEwLHM9ITEsbD12b2lkIDA7dHJ5e2Zvcih2YXIgdSxjPXRbU3ltYm9sLml0ZXJhdG9yXSgpOyEoYT0odT1jLm5leHQoKSkuZG9uZSk7YT0hMCl7dmFyIGg9dS52YWx1ZSxmPUwoaCxlLG4scixpKTshMSE9PWYmJm8ucHVzaChmKX19Y2F0Y2godCl7cz0hMCxsPXR9ZmluYWxseXt0cnl7IWEmJmMucmV0dXJuJiZjLnJldHVybigpfWZpbmFsbHl7aWYocyl0aHJvdyBsfX1yZXR1cm4gb31mdW5jdGlvbiB6KHQsZSxuLHIsaSl7dmFyIG89Sih0LGUsW25dLHIsaSk7cmV0dXJuIG8ubGVuZ3RoPjA/b1swXTplfWZ1bmN0aW9uIFgodCxlLG4pe2Zvcig7ZSE9PW47KXt2YXIgcj1lO2U9ZS5uZXh0U2libGluZyx0LnJlbW92ZUNoaWxkKHIpfX1mdW5jdGlvbiBxKHQsZSl7SnQuc2V0KHQsZSksV3Quc2V0KGUsdCl9ZnVuY3Rpb24gRih0KXtyZXR1cm4gSnQuZ2V0KHQpfWZ1bmN0aW9uICQodCl7cmV0dXJuIFd0LmdldCh0KX1mdW5jdGlvbiBHKCl7aWYoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNyeXB0byYmbnVsbCE9Y3J5cHRvLmdldFJhbmRvbVZhbHVlKXt2YXIgdD1uZXcgVWludDMyQXJyYXkoMSk7cmV0dXJuIGNyeXB0by5nZXRSYW5kb21WYWx1ZXModCksdFswXX1pZihcInVuZGVmaW5lZFwiIT10eXBlb2YgY3J5cHRvJiZudWxsIT1jcnlwdG8ucmFuZG9tQnl0ZXMpe3ZhciBlPWNyeXB0by5yYW5kb21CeXRlcyg0KTtyZXR1cm4gbmV3IFVpbnQzMkFycmF5KGUuYnVmZmVyKVswXX1yZXR1cm4gTWF0aC5jZWlsKDQyOTQ5NjcyOTUqTWF0aC5yYW5kb20oKSl9ZnVuY3Rpb24gWigpe3ZhciB0PSEwO3JldHVybiBmdW5jdGlvbihlKXtpZih0KXt0PSExO3RyeXtlKCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX10PSEwfX19ZnVuY3Rpb24gUSh0LGUpe2Zvcih2YXIgbj10Ll9zdGFydDtudWxsIT09bjspe2lmKCExPT09bi5fZGVsZXRlZCl7aWYobi5fbGVuZ3RoPmUpcmV0dXJuW24uX2lkLnVzZXIsbi5faWQuY2xvY2srZV07ZS09bi5fbGVuZ3RofW49bi5fcmlnaHR9cmV0dXJuW1wiZW5kb2ZcIix0Ll9pZC51c2VyLHQuX2lkLmNsb2NrfHxudWxsLHQuX2lkLm5hbWV8fG51bGwsdC5faWQudHlwZXx8bnVsbF19ZnVuY3Rpb24gSyh0LGUpe2lmKFwiZW5kb2ZcIj09PWVbMF0pe3ZhciBuPXZvaWQgMDtuPW51bGw9PT1lWzNdP25ldyBBdChlWzFdLGVbMl0pOm5ldyB6dChlWzNdLGVbNF0pO3ZhciByPXQub3MuZ2V0KG4pO3JldHVybiBudWxsPT09cnx8ci5jb25zdHJ1Y3Rvcj09PXh0P251bGw6e3R5cGU6cixvZmZzZXQ6ci5sZW5ndGh9fXZhciBpPTAsbz10Lm9zLmZpbmROb2RlV2l0aFVwcGVyQm91bmQobmV3IEF0KGVbMF0sZVsxXSkpLnZhbCxhPW8uX3BhcmVudDtpZihvLmNvbnN0cnVjdG9yPT09eHR8fGEuX2RlbGV0ZWQpcmV0dXJuIG51bGw7Zm9yKG8uX2RlbGV0ZWR8fChpPWVbMV0tby5faWQuY2xvY2spLG89by5fbGVmdDtudWxsIT09bzspby5fZGVsZXRlZHx8KGkrPW8uX2xlbmd0aCksbz1vLl9sZWZ0O3JldHVybnt0eXBlOmEsb2Zmc2V0Oml9fWZ1bmN0aW9uIHR0KHQsZSxuLHIpe2lmKG51bGwhPT1adCYmcil7dmFyIGk9WnQudG8sbz1adC5mcm9tLGE9WnQuZnJvbVkscz1adC50b1ksbD0hMSx1PUd0LmFuY2hvck5vZGUsYz1HdC5hbmNob3JPZmZzZXQsaD1HdC5mb2N1c05vZGUsZj1HdC5mb2N1c09mZnNldDtpZihudWxsIT09byl7dmFyIGQ9SyhhLG8pO2lmKG51bGwhPT1kKXt2YXIgXz1lLnR5cGVUb0RvbS5nZXQoZC50eXBlKSx2PWQub2Zmc2V0O189PT11JiZ2PT09Y3x8KHU9XyxjPXYsbD0hMCl9fWlmKG51bGwhPT1pKXt2YXIgcD1LKHMsaSk7aWYobnVsbCE9PXApe3ZhciB5PWUudHlwZVRvRG9tLmdldChwLnR5cGUpLGc9cC5vZmZzZXQ7eT09PWgmJmc9PT1mfHwoaD15LGY9ZyxsPSEwKX19bCYmR3Quc2V0QmFzZUFuZEV4dGVudCh1LGMsaCxmKX19ZnVuY3Rpb24gZXQodCl7aWYobnVsbCE9PXQpe3ZhciBlPWdldFNlbGVjdGlvbigpLmFuY2hvck5vZGU7aWYobnVsbCE9ZSl7ZS5ub2RlVHlwZT09PWRvY3VtZW50LlRFWFRfTk9ERSYmKGU9ZS5wYXJlbnRFbGVtZW50KTtyZXR1cm57ZWxlbTplLHRvcDplLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcH19Zm9yKHZhciBuPXQuY2hpbGRyZW4scj0wO3I8bi5sZW5ndGg7cisrKXt2YXIgaT1uW3JdLG89aS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtpZihvLnRvcD49MClyZXR1cm57ZWxlbTppLHRvcDpvLnRvcH19fXJldHVybiBudWxsfWZ1bmN0aW9uIG50KHQsZSl7aWYobnVsbCE9PWUpe3ZhciBuPWUuZWxlbSxyPWUudG9wLGk9bi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3Asbz10LnNjcm9sbFRvcCtpLXI7bz49MCYmKHQuc2Nyb2xsVG9wPW8pfX1mdW5jdGlvbiBydCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgbj1ldChlLnNjcm9sbGluZ0VsZW1lbnQpO3QuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgbj10LnRhcmdldCxyPWUudHlwZVRvRG9tLmdldChuKTtpZih2b2lkIDAhPT1yJiYhMSE9PXIpaWYobi5jb25zdHJ1Y3Rvcj09PVlYbWxUZXh0KXIubm9kZVZhbHVlPW4udG9TdHJpbmcoKTtlbHNlIGlmKHZvaWQgMCE9PXQuYXR0cmlidXRlc0NoYW5nZWQmJih0LmF0dHJpYnV0ZXNDaGFuZ2VkLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9bi5nZXRBdHRyaWJ1dGUodCk7dm9pZCAwPT09ZT9yLnJlbW92ZUF0dHJpYnV0ZSh0KTpyLnNldEF0dHJpYnV0ZSh0LGUpfSksdC5jaGlsZExpc3RDaGFuZ2VkJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spKXt2YXIgaT1yLmZpcnN0Q2hpbGQ7bi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBuPWUudHlwZVRvRG9tLmdldCh0KTtzd2l0Y2gobil7Y2FzZSB2b2lkIDA6dmFyIG89dC50b0RvbShlLm9wdHMuZG9jdW1lbnQsZS5vcHRzLmhvb2tzLGUpO3IuaW5zZXJ0QmVmb3JlKG8saSk7YnJlYWs7Y2FzZSExOmJyZWFrO2RlZmF1bHQ6WChyLGksbiksaT1uLm5leHRTaWJsaW5nfX0pLFgocixpLG51bGwpfX0pLG50KGUuc2Nyb2xsaW5nRWxlbWVudCxuKX0pfWZ1bmN0aW9uIGl0KHQsZSl7Zm9yKHZhciBuPTAscj0wO248dC5sZW5ndGgmJm48ZS5sZW5ndGgmJnRbbl09PT1lW25dOyluKys7aWYobiE9PXQubGVuZ3RofHxuIT09ZS5sZW5ndGgpZm9yKDtyK248dC5sZW5ndGgmJnIrbjxlLmxlbmd0aCYmdFt0Lmxlbmd0aC1yLTFdPT09ZVtlLmxlbmd0aC1yLTFdOylyKys7cmV0dXJue3BvczpuLHJlbW92ZTp0Lmxlbmd0aC1uLXIsaW5zZXJ0OmUuc2xpY2UobixlLmxlbmd0aC1yKX19ZnVuY3Rpb24gb3QodCxlLG4scil7aWYobnVsbCE9biYmITEhPT1uJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spe2Zvcih2YXIgaT1uLl95LG89bmV3IFNldCxhPWUuY2hpbGROb2Rlcy5sZW5ndGgtMTthPj0wO2EtLSl7dmFyIHM9dC5kb21Ub1R5cGUuZ2V0KGUuY2hpbGROb2Rlc1thXSk7dm9pZCAwIT09cyYmITEhPT1zJiZvLmFkZChzKX1uLmZvckVhY2goZnVuY3Rpb24oZSl7ITE9PT1vLmhhcyhlKSYmKGUuX2RlbGV0ZShpKSxNKHQsdC50eXBlVG9Eb20uZ2V0KGUpLGUpKX0pO2Zvcih2YXIgbD1lLmNoaWxkTm9kZXMsdT1sLmxlbmd0aCxjPW51bGwsaD1DKG4uX3N0YXJ0KSxmPTA7Zjx1O2YrKyl7dmFyIGQ9bFtmXSxfPXQuZG9tVG9UeXBlLmdldChkKTtpZih2b2lkIDAhPT1fKXtpZighMT09PV8pY29udGludWU7bnVsbCE9PWg/aCE9PV8/KF8uX3BhcmVudCE9PW4/TSh0LGQsXyk6KE0odCxkLF8pLF8uX2RlbGV0ZShpKSksYz16KG4sYyxkLHIsdCkpOihjPWgsaD1DKGguX3JpZ2h0KSk6Yz16KG4sYyxkLHIsdCl9ZWxzZSBjPXoobixjLGQscix0KX19fWZ1bmN0aW9uIGF0KHQsZSl7dmFyIG49dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7bi50eXBlLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7dmFyIHI9bmV3IFNldDt0LmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9dC50YXJnZXQsaT1uLmRvbVRvVHlwZS5nZXQoZSk7aWYodm9pZCAwPT09aSl7dmFyIG89ZSxhPXZvaWQgMDtkb3tvPW8ucGFyZW50RWxlbWVudCxhPW4uZG9tVG9UeXBlLmdldChvKX13aGlsZSh2b2lkIDA9PT1hJiZudWxsIT09byk7cmV0dXJuIHZvaWQoITEhPT1hJiZ2b2lkIDAhPT1hJiZhLmNvbnN0cnVjdG9yIT09WVhtbEhvb2smJnIuYWRkKG8pKX1pZighMSE9PWkmJmkuY29uc3RydWN0b3IhPT1ZWG1sSG9vaylzd2l0Y2godC50eXBlKXtjYXNlXCJjaGFyYWN0ZXJEYXRhXCI6dmFyIHM9aXQoaS50b1N0cmluZygpLGUubm9kZVZhbHVlKTtpLmRlbGV0ZShzLnBvcyxzLnJlbW92ZSksaS5pbnNlcnQocy5wb3Mscy5pbnNlcnQpO2JyZWFrO2Nhc2VcImF0dHJpYnV0ZXNcIjppZihpLmNvbnN0cnVjdG9yPT09WVhtbEZyYWdtZW50KWJyZWFrO3ZhciBsPXQuYXR0cmlidXRlTmFtZSx1PWUuZ2V0QXR0cmlidXRlKGwpLGM9bmV3IE1hcDtjLnNldChsLHUpLGkuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQmJm4uZmlsdGVyKGUubm9kZU5hbWUsYykuc2l6ZT4wJiZpLmdldEF0dHJpYnV0ZShsKSE9PXUmJihudWxsPT11P2kucmVtb3ZlQXR0cmlidXRlKGwpOmkuc2V0QXR0cmlidXRlKGwsdSkpO2JyZWFrO2Nhc2VcImNoaWxkTGlzdFwiOnIuYWRkKHQudGFyZ2V0KX19KTt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD1yW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PXMudmFsdWUsYz1uLmRvbVRvVHlwZS5nZXQodSk7b3Qobix1LGMsZSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fSl9KX1mdW5jdGlvbiBzdCh0LGUsbil7dmFyIHI9ITE7cmV0dXJuIHQudHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IoOyFyJiZuLmxlbmd0aD4wOyl7dmFyIGk9bi5wb3AoKTtudWxsIT09aS5mcm9tU3RhdGUmJih0Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KGkuZnJvbVN0YXRlKSx0Lm9zLmdldEl0ZW1DbGVhbkVuZChpLnRvU3RhdGUpLHQub3MuaXRlcmF0ZShpLmZyb21TdGF0ZSxpLnRvU3RhdGUsZnVuY3Rpb24obil7Zm9yKDtuLl9kZWxldGVkJiZudWxsIT09bi5fcmVkb25lOyluPW4uX3JlZG9uZTshMT09PW4uX2RlbGV0ZWQmJngoZSxuKSYmKHI9ITAsbi5fZGVsZXRlKHQpKX0pKTt2YXIgbz0hMCxhPSExLHM9dm9pZCAwO3RyeXtmb3IodmFyIGwsdT1pLmRlbGV0ZWRTdHJ1Y3RzW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPWwudmFsdWU7eChlLGMpJiZjLl9wYXJlbnQhPT10JiYoYy5faWQudXNlciE9PXQudXNlcklEfHxudWxsPT09aS5mcm9tU3RhdGV8fGMuX2lkLmNsb2NrPGkuZnJvbVN0YXRlLmNsb2NrfHxjLl9pZC5jbG9jaz5pLnRvU3RhdGUuY2xvY2spJiYocj0hMCxjLl9yZWRvKHQpKX19Y2F0Y2godCl7YT0hMCxzPXR9ZmluYWxseXt0cnl7IW8mJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYoYSl0aHJvdyBzfX19fSkscn1mdW5jdGlvbiBsdCh0LGUpe3JldHVybiBlPXtleHBvcnRzOnt9fSx0KGUsZS5leHBvcnRzKSxlLmV4cG9ydHN9ZnVuY3Rpb24gdXQodCl7aWYodD1TdHJpbmcodCksISh0Lmxlbmd0aD4xMDApKXt2YXIgZT0vXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHQpO2lmKGUpe3ZhciBuPXBhcnNlRmxvYXQoZVsxXSk7c3dpdGNoKChlWzJdfHxcIm1zXCIpLnRvTG93ZXJDYXNlKCkpe2Nhc2VcInllYXJzXCI6Y2FzZVwieWVhclwiOmNhc2VcInlyc1wiOmNhc2VcInlyXCI6Y2FzZVwieVwiOnJldHVybiBuKmFlO2Nhc2VcImRheXNcIjpjYXNlXCJkYXlcIjpjYXNlXCJkXCI6cmV0dXJuIG4qb2U7Y2FzZVwiaG91cnNcIjpjYXNlXCJob3VyXCI6Y2FzZVwiaHJzXCI6Y2FzZVwiaHJcIjpjYXNlXCJoXCI6cmV0dXJuIG4qaWU7Y2FzZVwibWludXRlc1wiOmNhc2VcIm1pbnV0ZVwiOmNhc2VcIm1pbnNcIjpjYXNlXCJtaW5cIjpjYXNlXCJtXCI6cmV0dXJuIG4qcmU7Y2FzZVwic2Vjb25kc1wiOmNhc2VcInNlY29uZFwiOmNhc2VcInNlY3NcIjpjYXNlXCJzZWNcIjpjYXNlXCJzXCI6cmV0dXJuIG4qbmU7Y2FzZVwibWlsbGlzZWNvbmRzXCI6Y2FzZVwibWlsbGlzZWNvbmRcIjpjYXNlXCJtc2Vjc1wiOmNhc2VcIm1zZWNcIjpjYXNlXCJtc1wiOnJldHVybiBuO2RlZmF1bHQ6cmV0dXJufX19fWZ1bmN0aW9uIGN0KHQpe3JldHVybiB0Pj1vZT9NYXRoLnJvdW5kKHQvb2UpK1wiZFwiOnQ+PWllP01hdGgucm91bmQodC9pZSkrXCJoXCI6dD49cmU/TWF0aC5yb3VuZCh0L3JlKStcIm1cIjp0Pj1uZT9NYXRoLnJvdW5kKHQvbmUpK1wic1wiOnQrXCJtc1wifWZ1bmN0aW9uIGh0KHQpe3JldHVybiBmdCh0LG9lLFwiZGF5XCIpfHxmdCh0LGllLFwiaG91clwiKXx8ZnQodCxyZSxcIm1pbnV0ZVwiKXx8ZnQodCxuZSxcInNlY29uZFwiKXx8dCtcIiBtc1wifWZ1bmN0aW9uIGZ0KHQsZSxuKXtpZighKHQ8ZSkpcmV0dXJuIHQ8MS41KmU/TWF0aC5mbG9vcih0L2UpK1wiIFwiK246TWF0aC5jZWlsKHQvZSkrXCIgXCIrbitcInNcIn1mdW5jdGlvbiBkdCh0LGUpe3QudHJhbnNhY3QoZnVuY3Rpb24oKXtyKHQsZSkscyh0LGUpfSl9ZnVuY3Rpb24gX3QodCl7dmFyIGU9bmV3IGp0O3JldHVybiBjKHQsZSxuZXcgTWFwKSxhKHQsZSksZX1mdW5jdGlvbiB2dCgpe3ZhciB0PW5ldyBqdDtyZXR1cm4gdC53cml0ZVVpbnQzMigwKSx7bGVuOjAsYnVmZmVyOnR9fWZ1bmN0aW9uIHB0KCl7dmFyIHQ9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIGU9dC50YXJnZXQsbj10LnR5cGUscj1RKG4sZS5zZWxlY3Rpb25TdGFydCksaT1RKG4sZS5zZWxlY3Rpb25FbmQpO2UudmFsdWU9bi50b1N0cmluZygpO3ZhciBvPUsobi5feSxyKSxhPUsobi5feSxpKTtlLnNldFNlbGVjdGlvblJhbmdlKG8sYSl9KX1mdW5jdGlvbiB5dCgpe3ZhciB0PXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe3ZhciBlPWl0KHQudHlwZS50b1N0cmluZygpLHQudGFyZ2V0LnZhbHVlKTt0LnR5cGUuZGVsZXRlKGUucG9zLGUucmVtb3ZlKSx0LnR5cGUuaW5zZXJ0KGUucG9zLGUuaW5zZXJ0KX0pfWZ1bmN0aW9uIGd0KHQpe3ZhciBlPXRoaXMudGFyZ2V0O2UudXBkYXRlKFwieWpzXCIpLHRoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtlLnVwZGF0ZUNvbnRlbnRzKHQuZGVsdGEsXCJ5anNcIiksZS51cGRhdGUoXCJ5anNcIil9KX1mdW5jdGlvbiBtdCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtlLnR5cGUuYXBwbHlEZWx0YSh0Lm9wcyl9KX12YXIga3Q9XCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLml0ZXJhdG9yP2Z1bmN0aW9uKHQpe3JldHVybiB0eXBlb2YgdH06ZnVuY3Rpb24odCl7cmV0dXJuIHQmJlwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmdC5jb25zdHJ1Y3Rvcj09PVN5bWJvbCYmdCE9PVN5bWJvbC5wcm90b3R5cGU/XCJzeW1ib2xcIjp0eXBlb2YgdH0sYnQ9ZnVuY3Rpb24odCxlKXtpZighKHQgaW5zdGFuY2VvZiBlKSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpfSx3dD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQodCxlKXtmb3IodmFyIG49MDtuPGUubGVuZ3RoO24rKyl7dmFyIHI9ZVtuXTtyLmVudW1lcmFibGU9ci5lbnVtZXJhYmxlfHwhMSxyLmNvbmZpZ3VyYWJsZT0hMCxcInZhbHVlXCJpbiByJiYoci53cml0YWJsZT0hMCksT2JqZWN0LmRlZmluZVByb3BlcnR5KHQsci5rZXkscil9fXJldHVybiBmdW5jdGlvbihlLG4scil7cmV0dXJuIG4mJnQoZS5wcm90b3R5cGUsbiksciYmdChlLHIpLGV9fSgpLFN0PWZ1bmN0aW9uIHQoZSxuLHIpe251bGw9PT1lJiYoZT1GdW5jdGlvbi5wcm90b3R5cGUpO3ZhciBpPU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZSxuKTtpZih2b2lkIDA9PT1pKXt2YXIgbz1PYmplY3QuZ2V0UHJvdG90eXBlT2YoZSk7cmV0dXJuIG51bGw9PT1vP3ZvaWQgMDp0KG8sbixyKX1pZihcInZhbHVlXCJpbiBpKXJldHVybiBpLnZhbHVlO3ZhciBhPWkuZ2V0O2lmKHZvaWQgMCE9PWEpcmV0dXJuIGEuY2FsbChyKX0sT3Q9ZnVuY3Rpb24odCxlKXtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBlJiZudWxsIT09ZSl0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCBcIit0eXBlb2YgZSk7dC5wcm90b3R5cGU9T2JqZWN0LmNyZWF0ZShlJiZlLnByb3RvdHlwZSx7Y29uc3RydWN0b3I6e3ZhbHVlOnQsZW51bWVyYWJsZTohMSx3cml0YWJsZTohMCxjb25maWd1cmFibGU6ITB9fSksZSYmKE9iamVjdC5zZXRQcm90b3R5cGVPZj9PYmplY3Quc2V0UHJvdG90eXBlT2YodCxlKTp0Ll9fcHJvdG9fXz1lKX0sRXQ9ZnVuY3Rpb24odCxlKXtpZighdCl0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7cmV0dXJuIWV8fFwib2JqZWN0XCIhPXR5cGVvZiBlJiZcImZ1bmN0aW9uXCIhPXR5cGVvZiBlP3Q6ZX0sVXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7dmFyIG49W10scj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz10W1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpJiYobi5wdXNoKGEudmFsdWUpLCFlfHxuLmxlbmd0aCE9PWUpO3I9ITApO31jYXRjaCh0KXtpPSEwLG89dH1maW5hbGx5e3RyeXshciYmcy5yZXR1cm4mJnMucmV0dXJuKCl9ZmluYWxseXtpZihpKXRocm93IG99fXJldHVybiBufXJldHVybiBmdW5jdGlvbihlLG4pe2lmKEFycmF5LmlzQXJyYXkoZSkpcmV0dXJuIGU7aWYoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChlKSlyZXR1cm4gdChlLG4pO3Rocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlXCIpfX0oKSxCdD1mdW5jdGlvbigpe2Z1bmN0aW9uIGUodCl7YnQodGhpcyxlKSx0aGlzLnZhbD10LHRoaXMuY29sb3I9ITAsdGhpcy5fbGVmdD1udWxsLHRoaXMuX3JpZ2h0PW51bGwsdGhpcy5fcGFyZW50PW51bGx9cmV0dXJuIHd0KGUsW3trZXk6XCJpc1JlZFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3J9fSx7a2V5OlwiaXNCbGFja1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIXRoaXMuY29sb3J9fSx7a2V5OlwicmVkZGVuXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb2xvcj0hMCx0aGlzfX0se2tleTpcImJsYWNrZW5cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbG9yPSExLHRoaXN9fSx7a2V5Olwicm90YXRlTGVmdFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMucGFyZW50LHI9dGhpcy5yaWdodCxpPXRoaXMucmlnaHQubGVmdDtyLmxlZnQ9dGhpcyx0aGlzLnJpZ2h0PWksdChlLG4scix0aGlzKX19LHtrZXk6XCJuZXh0XCIsdmFsdWU6ZnVuY3Rpb24oKXtpZihudWxsIT09dGhpcy5yaWdodCl7Zm9yKHZhciB0PXRoaXMucmlnaHQ7bnVsbCE9PXQubGVmdDspdD10LmxlZnQ7cmV0dXJuIHR9Zm9yKHZhciBlPXRoaXM7bnVsbCE9PWUucGFyZW50JiZlIT09ZS5wYXJlbnQubGVmdDspZT1lLnBhcmVudDtyZXR1cm4gZS5wYXJlbnR9fSx7a2V5OlwicHJldlwiLHZhbHVlOmZ1bmN0aW9uKCl7aWYobnVsbCE9PXRoaXMubGVmdCl7Zm9yKHZhciB0PXRoaXMubGVmdDtudWxsIT09dC5yaWdodDspdD10LnJpZ2h0O3JldHVybiB0fWZvcih2YXIgZT10aGlzO251bGwhPT1lLnBhcmVudCYmZSE9PWUucGFyZW50LnJpZ2h0OyllPWUucGFyZW50O3JldHVybiBlLnBhcmVudH19LHtrZXk6XCJyb3RhdGVSaWdodFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMucGFyZW50LHI9dGhpcy5sZWZ0LGk9dGhpcy5sZWZ0LnJpZ2h0O3IucmlnaHQ9dGhpcyx0aGlzLmxlZnQ9aSx0KGUsbixyLHRoaXMpfX0se2tleTpcImdldFVuY2xlXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wYXJlbnQ9PT10aGlzLnBhcmVudC5wYXJlbnQubGVmdD90aGlzLnBhcmVudC5wYXJlbnQucmlnaHQ6dGhpcy5wYXJlbnQucGFyZW50LmxlZnR9fSx7a2V5OlwiZ3JhbmRwYXJlbnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wYXJlbnQucGFyZW50fX0se2tleTpcInBhcmVudFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9wYXJlbnR9fSx7a2V5Olwic2libGluZ1wiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzPT09dGhpcy5wYXJlbnQubGVmdD90aGlzLnBhcmVudC5yaWdodDp0aGlzLnBhcmVudC5sZWZ0fX0se2tleTpcImxlZnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fbGVmdH0sc2V0OmZ1bmN0aW9uKHQpe251bGwhPT10JiYodC5fcGFyZW50PXRoaXMpLHRoaXMuX2xlZnQ9dH19LHtrZXk6XCJyaWdodFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9yaWdodH0sc2V0OmZ1bmN0aW9uKHQpe251bGwhPT10JiYodC5fcGFyZW50PXRoaXMpLHRoaXMuX3JpZ2h0PXR9fV0pLGV9KCksVHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7YnQodGhpcyx0KSx0aGlzLnJvb3Q9bnVsbCx0aGlzLmxlbmd0aD0wfXJldHVybiB3dCh0LFt7a2V5OlwiZmluZE5leHRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10LmNsb25lKCk7cmV0dXJuIGUuY2xvY2srPTEsdGhpcy5maW5kV2l0aExvd2VyQm91bmQoZSl9fSx7a2V5OlwiZmluZFByZXZcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10LmNsb25lKCk7cmV0dXJuIGUuY2xvY2stPTEsdGhpcy5maW5kV2l0aFVwcGVyQm91bmQoZSl9fSx7a2V5OlwiZmluZE5vZGVXaXRoTG93ZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspaWYobnVsbD09PXR8fHQubGVzc1RoYW4oZS52YWwuX2lkKSYmbnVsbCE9PWUubGVmdCllPWUubGVmdDtlbHNle2lmKG51bGw9PT10fHwhZS52YWwuX2lkLmxlc3NUaGFuKHQpKXJldHVybiBlO2lmKG51bGw9PT1lLnJpZ2h0KXJldHVybiBlLm5leHQoKTtlPWUucmlnaHR9fX0se2tleTpcImZpbmROb2RlV2l0aFVwcGVyQm91bmRcIix2YWx1ZTpmdW5jdGlvbih0KXtpZih2b2lkIDA9PT10KXRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IGRlZmluZSBmcm9tIVwiKTt2YXIgZT10aGlzLnJvb3Q7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7Zm9yKDs7KWlmKG51bGwhPT10JiYhZS52YWwuX2lkLmxlc3NUaGFuKHQpfHxudWxsPT09ZS5yaWdodCl7aWYobnVsbD09PXR8fCF0Lmxlc3NUaGFuKGUudmFsLl9pZCkpcmV0dXJuIGU7aWYobnVsbD09PWUubGVmdClyZXR1cm4gZS5wcmV2KCk7ZT1lLmxlZnR9ZWxzZSBlPWUucmlnaHR9fSx7a2V5OlwiZmluZFNtYWxsZXN0Tm9kZVwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMucm9vdDtudWxsIT10JiZudWxsIT10LmxlZnQ7KXQ9dC5sZWZ0O3JldHVybiB0fX0se2tleTpcImZpbmRXaXRoTG93ZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZCh0KTtyZXR1cm4gbnVsbD09ZT9udWxsOmUudmFsfX0se2tleTpcImZpbmRXaXRoVXBwZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGVXaXRoVXBwZXJCb3VuZCh0KTtyZXR1cm4gbnVsbD09ZT9udWxsOmUudmFsfX0se2tleTpcIml0ZXJhdGVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI7Zm9yKHI9bnVsbD09PXQ/dGhpcy5maW5kU21hbGxlc3ROb2RlKCk6dGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKHQpO251bGwhPT1yJiYobnVsbD09PWV8fHIudmFsLl9pZC5sZXNzVGhhbihlKXx8ci52YWwuX2lkLmVxdWFscyhlKSk7KW4oci52YWwpLHI9ci5uZXh0KCl9fSx7a2V5OlwiZmluZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGUodCk7cmV0dXJuIG51bGwhPT1lP2UudmFsOm51bGx9fSx7a2V5OlwiZmluZE5vZGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnJvb3Q7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7Zm9yKDs7KXtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtpZih0Lmxlc3NUaGFuKGUudmFsLl9pZCkpZT1lLmxlZnQ7ZWxzZXtpZighZS52YWwuX2lkLmxlc3NUaGFuKHQpKXJldHVybiBlO2U9ZS5yaWdodH19fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZE5vZGUodCk7aWYobnVsbCE9ZSl7aWYodGhpcy5sZW5ndGgtLSxudWxsIT09ZS5sZWZ0JiZudWxsIT09ZS5yaWdodCl7Zm9yKHZhciBuPWUubGVmdDtudWxsIT09bi5yaWdodDspbj1uLnJpZ2h0O2UudmFsPW4udmFsLGU9bn12YXIgcixpPWUubGVmdHx8ZS5yaWdodDtpZihudWxsPT09aT8ocj0hMCxpPW5ldyBCdChudWxsKSxpLmJsYWNrZW4oKSxlLnJpZ2h0PWkpOnI9ITEsbnVsbD09PWUucGFyZW50KXJldHVybiB2b2lkKHI/dGhpcy5yb290PW51bGw6KHRoaXMucm9vdD1pLGkuYmxhY2tlbigpLGkuX3BhcmVudD1udWxsKSk7aWYoZS5wYXJlbnQubGVmdD09PWUpZS5wYXJlbnQubGVmdD1pO2Vsc2V7aWYoZS5wYXJlbnQucmlnaHQhPT1lKXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUhXCIpO2UucGFyZW50LnJpZ2h0PWl9aWYoZS5pc0JsYWNrKCkmJihpLmlzUmVkKCk/aS5ibGFja2VuKCk6dGhpcy5fZml4RGVsZXRlKGkpKSx0aGlzLnJvb3QuYmxhY2tlbigpLHIpaWYoaS5wYXJlbnQubGVmdD09PWkpaS5wYXJlbnQubGVmdD1udWxsO2Vsc2V7aWYoaS5wYXJlbnQucmlnaHQhPT1pKXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgIzNcIik7aS5wYXJlbnQucmlnaHQ9bnVsbH19fX0se2tleTpcIl9maXhEZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQpe3JldHVybiBudWxsPT09dHx8dC5pc0JsYWNrKCl9ZnVuY3Rpb24gbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQuaXNSZWQoKX1pZihudWxsIT09dC5wYXJlbnQpe3ZhciByPXQuc2libGluZztpZihuKHIpKXtpZih0LnBhcmVudC5yZWRkZW4oKSxyLmJsYWNrZW4oKSx0PT09dC5wYXJlbnQubGVmdCl0LnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpO2Vsc2V7aWYodCE9PXQucGFyZW50LnJpZ2h0KXRocm93IG5ldyBFcnJvcihcIkltcG9zc2libGUgIzJcIik7dC5wYXJlbnQucm90YXRlUmlnaHQodGhpcyl9cj10LnNpYmxpbmd9dC5wYXJlbnQuaXNCbGFjaygpJiZyLmlzQmxhY2soKSYmZShyLmxlZnQpJiZlKHIucmlnaHQpPyhyLnJlZGRlbigpLHRoaXMuX2ZpeERlbGV0ZSh0LnBhcmVudCkpOnQucGFyZW50LmlzUmVkKCkmJnIuaXNCbGFjaygpJiZlKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksdC5wYXJlbnQuYmxhY2tlbigpKToodD09PXQucGFyZW50LmxlZnQmJnIuaXNCbGFjaygpJiZuKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksci5sZWZ0LmJsYWNrZW4oKSxyLnJvdGF0ZVJpZ2h0KHRoaXMpLHI9dC5zaWJsaW5nKTp0PT09dC5wYXJlbnQucmlnaHQmJnIuaXNCbGFjaygpJiZuKHIucmlnaHQpJiZlKHIubGVmdCkmJihyLnJlZGRlbigpLHIucmlnaHQuYmxhY2tlbigpLHIucm90YXRlTGVmdCh0aGlzKSxyPXQuc2libGluZyksci5jb2xvcj10LnBhcmVudC5jb2xvcix0LnBhcmVudC5ibGFja2VuKCksdD09PXQucGFyZW50LmxlZnQ/KHIucmlnaHQuYmxhY2tlbigpLHQucGFyZW50LnJvdGF0ZUxlZnQodGhpcykpOihyLmxlZnQuYmxhY2tlbigpLHQucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpKSl9fX0se2tleTpcInB1dFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBCdCh0KTtpZihudWxsIT09dGhpcy5yb290KXtmb3IodmFyIG49dGhpcy5yb290OzspaWYoZS52YWwuX2lkLmxlc3NUaGFuKG4udmFsLl9pZCkpe2lmKG51bGw9PT1uLmxlZnQpe24ubGVmdD1lO2JyZWFrfW49bi5sZWZ0fWVsc2V7aWYoIW4udmFsLl9pZC5sZXNzVGhhbihlLnZhbC5faWQpKXJldHVybiBuLnZhbD1lLnZhbCxuO2lmKG51bGw9PT1uLnJpZ2h0KXtuLnJpZ2h0PWU7YnJlYWt9bj1uLnJpZ2h0fXRoaXMuX2ZpeEluc2VydChlKX1lbHNlIHRoaXMucm9vdD1lO3JldHVybiB0aGlzLmxlbmd0aCsrLHRoaXMucm9vdC5ibGFja2VuKCksZX19LHtrZXk6XCJfZml4SW5zZXJ0XCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXQucGFyZW50KXJldHVybiB2b2lkIHQuYmxhY2tlbigpO2lmKCF0LnBhcmVudC5pc0JsYWNrKCkpe3ZhciBlPXQuZ2V0VW5jbGUoKTtudWxsIT09ZSYmZS5pc1JlZCgpPyh0LnBhcmVudC5ibGFja2VuKCksZS5ibGFja2VuKCksdC5ncmFuZHBhcmVudC5yZWRkZW4oKSx0aGlzLl9maXhJbnNlcnQodC5ncmFuZHBhcmVudCkpOih0PT09dC5wYXJlbnQucmlnaHQmJnQucGFyZW50PT09dC5ncmFuZHBhcmVudC5sZWZ0Pyh0LnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpLHQ9dC5sZWZ0KTp0PT09dC5wYXJlbnQubGVmdCYmdC5wYXJlbnQ9PT10LmdyYW5kcGFyZW50LnJpZ2h0JiYodC5wYXJlbnQucm90YXRlUmlnaHQodGhpcyksdD10LnJpZ2h0KSx0LnBhcmVudC5ibGFja2VuKCksdC5ncmFuZHBhcmVudC5yZWRkZW4oKSx0PT09dC5wYXJlbnQubGVmdD90LmdyYW5kcGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpOnQuZ3JhbmRwYXJlbnQucm90YXRlTGVmdCh0aGlzKSl9fX1dKSx0fSgpLEF0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe2J0KHRoaXMsdCksdGhpcy51c2VyPWUsdGhpcy5jbG9jaz1ufXJldHVybiB3dCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdCh0aGlzLnVzZXIsdGhpcy5jbG9jayl9fSx7a2V5OlwiZXF1YWxzXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIG51bGwhPT10JiZ0LnVzZXI9PT10aGlzLnVzZXImJnQuY2xvY2s9PT10aGlzLmNsb2NrfX0se2tleTpcImxlc3NUaGFuXCIsdmFsdWU6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuY29uc3RydWN0b3I9PT10JiYodGhpcy51c2VyPGUudXNlcnx8dGhpcy51c2VyPT09ZS51c2VyJiZ0aGlzLmNsb2NrPGUuY2xvY2spfX1dKSx0fSgpLER0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4scil7YnQodGhpcyx0KSx0aGlzLl9pZD1lLHRoaXMubGVuPW4sdGhpcy5nYz1yfXJldHVybiB3dCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdCh0aGlzLl9pZCx0aGlzLmxlbix0aGlzLmdjKX19XSksdH0oKSxQdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cmV0dXJuIGJ0KHRoaXMsZSksRXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gT3QoZSx0KSx3dChlLFt7a2V5OlwibG9nVGFibGVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdO3RoaXMuaXRlcmF0ZShudWxsLG51bGwsZnVuY3Rpb24oZSl7dC5wdXNoKHt1c2VyOmUuX2lkLnVzZXIsY2xvY2s6ZS5faWQuY2xvY2ssbGVuOmUubGVuLGdjOmUuZ2N9KX0pLGNvbnNvbGUudGFibGUodCl9fSx7a2V5OlwiaXNEZWxldGVkXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQodCk7cmV0dXJuIG51bGwhPT1lJiZlLl9pZC51c2VyPT09dC51c2VyJiZ0LmNsb2NrPGUuX2lkLmNsb2NrK2UubGVufX0se2tleTpcIm1hcmtcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7aWYoMCE9PWUpe3ZhciByPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKG5ldyBBdCh0LnVzZXIsdC5jbG9jay0xKSk7bnVsbCE9PXImJnIuX2lkLnVzZXI9PT10LnVzZXImJnIuX2lkLmNsb2NrPHQuY2xvY2smJnQuY2xvY2s8ci5faWQuY2xvY2srci5sZW4mJih0LmNsb2NrK2U8ci5faWQuY2xvY2srci5sZW4mJnRoaXMucHV0KG5ldyBEdChuZXcgQXQodC51c2VyLHQuY2xvY2srZSksci5faWQuY2xvY2srci5sZW4tdC5jbG9jay1lLHIuZ2MpKSxyLmxlbj10LmNsb2NrLXIuX2lkLmNsb2NrKTt2YXIgaT1uZXcgQXQodC51c2VyLHQuY2xvY2srZS0xKSxvPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKGkpO2lmKG51bGwhPT1vJiZvLl9pZC51c2VyPT09dC51c2VyJiZvLl9pZC5jbG9jazx0LmNsb2NrK2UmJnQuY2xvY2s8PW8uX2lkLmNsb2NrJiZ0LmNsb2NrK2U8by5faWQuY2xvY2srby5sZW4pe3ZhciBhPXQuY2xvY2srZS1vLl9pZC5jbG9jaztvLl9pZD1uZXcgQXQoby5faWQudXNlcixvLl9pZC5jbG9jaythKSxvLmxlbi09YX12YXIgcz1bXTt0aGlzLml0ZXJhdGUodCxpLGZ1bmN0aW9uKHQpe3MucHVzaCh0Ll9pZCl9KTtmb3IodmFyIGw9cy5sZW5ndGgtMTtsPj0wO2wtLSl0aGlzLmRlbGV0ZShzW2xdKTt2YXIgdT1uZXcgRHQodCxlLG4pO251bGwhPT1yJiZyLl9pZC51c2VyPT09dC51c2VyJiZyLl9pZC5jbG9jaytyLmxlbj09PXQuY2xvY2smJnIuZ2M9PT1uJiYoci5sZW4rPWUsdT1yKTt2YXIgYz10aGlzLmZpbmQobmV3IEF0KHQudXNlcix0LmNsb2NrK2UpKTtudWxsIT09YyYmYy5faWQudXNlcj09PXQudXNlciYmdC5jbG9jaytlPT09Yy5faWQuY2xvY2smJm49PT1jLmdjJiYodS5sZW4rPWMubGVuLHRoaXMuZGVsZXRlKGMuX2lkKSksciE9PXUmJnRoaXMucHV0KHUpfX19LHtrZXk6XCJtYXJrRGVsZXRlZFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5tYXJrKHQsZSwhMSl9fV0pLGV9KFR0KSxOdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSl7aWYoYnQodGhpcyx0KSxlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpdGhpcy51aW50OGFycj1uZXcgVWludDhBcnJheShlKTtlbHNle2lmKCEoZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBCdWZmZXImJmUgaW5zdGFuY2VvZiBCdWZmZXIpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGFuIEFycmF5QnVmZmVyIG9yIFVpbnQ4QXJyYXkhXCIpO3RoaXMudWludDhhcnI9ZX10aGlzLnBvcz0wfXJldHVybiB3dCh0LFt7a2V5OlwiY2xvbmVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciBlPWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTp0aGlzLnBvcyxuPW5ldyB0KHRoaXMudWludDhhcnIpO3JldHVybiBuLnBvcz1lLG59fSx7a2V5Olwic2tpcDhcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMucG9zKyt9fSx7a2V5OlwicmVhZFVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyclt0aGlzLnBvcysrXX19LHtrZXk6XCJyZWFkVWludDMyXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnVpbnQ4YXJyW3RoaXMucG9zXSsodGhpcy51aW50OGFyclt0aGlzLnBvcysxXTw8OCkrKHRoaXMudWludDhhcnJbdGhpcy5wb3MrMl08PDE2KSsodGhpcy51aW50OGFyclt0aGlzLnBvcyszXTw8MjQpO3JldHVybiB0aGlzLnBvcys9NCx0fX0se2tleTpcInBlZWtVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudWludDhhcnJbdGhpcy5wb3NdfX0se2tleTpcInJlYWRWYXJVaW50XCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MCxlPTA7Oyl7dmFyIG49dGhpcy51aW50OGFyclt0aGlzLnBvcysrXTtpZih0fD0oMTI3Jm4pPDxlLGUrPTcsbjwxMjgpcmV0dXJuIHQ+Pj4wO2lmKGU+MzUpdGhyb3cgbmV3IEVycm9yKFwiSW50ZWdlciBvdXQgb2YgcmFuZ2UhXCIpfX19LHtrZXk6XCJyZWFkVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9dGhpcy5yZWFkVmFyVWludCgpLGU9bmV3IEFycmF5KHQpLG49MDtuPHQ7bisrKWVbbl09dGhpcy51aW50OGFyclt0aGlzLnBvcysrXTt2YXIgcj1lLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQodCl9KS5qb2luKFwiXCIpO3JldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHIpKX19LHtrZXk6XCJwZWVrVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnBvcyxlPXRoaXMucmVhZFZhclN0cmluZygpO3JldHVybiB0aGlzLnBvcz10LGV9fSx7a2V5OlwicmVhZElEXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLnJlYWRWYXJVaW50KCk7aWYodD09PVl0KXt2YXIgZT1uZXcgenQodGhpcy5yZWFkVmFyU3RyaW5nKCksbnVsbCk7cmV0dXJuIGUudHlwZT10aGlzLnJlYWRWYXJVaW50KCksZX1yZXR1cm4gbmV3IEF0KHQsdGhpcy5yZWFkVmFyVWludCgpKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyci5sZW5ndGh9fV0pLHR9KCkseHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7YnQodGhpcyx0KSx0aGlzLl9pZD1udWxsLHRoaXMuX2xlbmd0aD0wfXJldHVybiB3dCh0LFt7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMuX2lkLHI9ZS5zcy5nZXRTdGF0ZShuLnVzZXIpO24uY2xvY2s9PT1yJiZlLnNzLnNldFN0YXRlKG4udXNlcixuLmNsb2NrK3RoaXMuX2xlbmd0aCksZS5kcy5tYXJrKHRoaXMuX2lkLHRoaXMuX2xlbmd0aCwhMCk7dmFyIGk9ZS5vcy5wdXQodGhpcyksbz1pLnByZXYoKS52YWw7bnVsbCE9PW8mJm8uY29uc3RydWN0b3I9PT10JiZvLl9pZC51c2VyPT09aS52YWwuX2lkLnVzZXImJm8uX2lkLmNsb2NrK28uX2xlbmd0aD09PWkudmFsLl9pZC5jbG9jayYmKG8uX2xlbmd0aCs9aS52YWwuX2xlbmd0aCxlLm9zLmRlbGV0ZShpLnZhbC5faWQpLGk9byksaS52YWwmJihpPWkudmFsKTt2YXIgYT1lLm9zLmZpbmROZXh0KGkuX2lkKTtudWxsIT09YSYmYS5jb25zdHJ1Y3Rvcj09PXQmJmEuX2lkLnVzZXI9PT1pLl9pZC51c2VyJiZhLl9pZC5jbG9jaz09PWkuX2lkLmNsb2NrK2kuX2xlbmd0aCYmKGkuX2xlbmd0aCs9YS5fbGVuZ3RoLGUub3MuZGVsZXRlKGEuX2lkKSksbi51c2VyIT09WXQmJihudWxsPT09ZS5jb25uZWN0b3J8fCFlLmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzJiZuLnVzZXIhPT1lLnVzZXJJRHx8ZS5jb25uZWN0b3IuYnJvYWRjYXN0U3RydWN0KHRoaXMpLG51bGwhPT1lLnBlcnNpc3RlbmNlJiZlLnBlcnNpc3RlbmNlLnNhdmVTdHJ1Y3QoZSx0aGlzKSl9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7dC53cml0ZVVpbnQ4KCQodGhpcy5jb25zdHJ1Y3RvcikpLHQud3JpdGVJRCh0aGlzLl9pZCksdC53cml0ZVZhclVpbnQodGhpcy5fbGVuZ3RoKX19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49ZS5yZWFkSUQoKTt0aGlzLl9pZD1uLHRoaXMuX2xlbmd0aD1lLnJlYWRWYXJVaW50KCk7dmFyIHI9W107cmV0dXJuIHQuc3MuZ2V0U3RhdGUobi51c2VyKTxuLmNsb2NrJiZyLnB1c2gobmV3IEF0KG4udXNlcixuLmNsb2NrLTEpKSxyfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpc319LHtrZXk6XCJfY2xvbmVQYXJ0aWFsXCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49bmV3IHQ7cmV0dXJuIG4uX2lkPW5ldyBBdCh0aGlzLl9pZC51c2VyLHRoaXMuX2lkLmNsb2NrK2UpLG4uX2xlbmd0aD10aGlzLl9sZW5ndGgtZSxufX0se2tleTpcIl9kZWxldGVkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITB9fV0pLHR9KCksSXQ9ZnVuY3Rpb24gdChlLG4scil7YnQodGhpcyx0KSx0aGlzLmRlY29kZXI9ZSx0aGlzLm1pc3Npbmc9bi5sZW5ndGgsdGhpcy5zdHJ1Y3Q9cn0sanQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7YnQodGhpcyx0KSx0aGlzLmRhdGE9W119cmV0dXJuIHd0KHQsW3trZXk6XCJjcmVhdGVCdWZmZXJcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBVaW50OEFycmF5LmZyb20odGhpcy5kYXRhKS5idWZmZXJ9fSx7a2V5Olwid3JpdGVVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZGF0YS5wdXNoKDI1NSZ0KX19LHtrZXk6XCJzZXRVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5kYXRhW3RdPTI1NSZlfX0se2tleTpcIndyaXRlVWludDE2XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5kYXRhLnB1c2goMjU1JnQsdD4+PjgmMjU1KX19LHtrZXk6XCJzZXRVaW50MTZcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMuZGF0YVt0XT0yNTUmZSx0aGlzLmRhdGFbdCsxXT1lPj4+OCYyNTV9fSx7a2V5Olwid3JpdGVVaW50MzJcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9MDtlPDQ7ZSsrKXRoaXMuZGF0YS5wdXNoKDI1NSZ0KSx0Pj4+PTh9fSx7a2V5Olwic2V0VWludDMyXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtmb3IodmFyIG49MDtuPDQ7bisrKXRoaXMuZGF0YVt0K25dPTI1NSZlLGU+Pj49OH19LHtrZXk6XCJ3cml0ZVZhclVpbnRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IoO3Q+PTEyODspdGhpcy5kYXRhLnB1c2goMTI4fDEyNyZ0KSx0Pj4+PTc7dGhpcy5kYXRhLnB1c2goMTI3JnQpfX0se2tleTpcIndyaXRlVmFyU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHQpKSxuPWUuc3BsaXQoXCJcIikubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0LmNvZGVQb2ludEF0KCl9KSxyPW4ubGVuZ3RoO3RoaXMud3JpdGVWYXJVaW50KHIpO2Zvcih2YXIgaT0wO2k8cjtpKyspdGhpcy5kYXRhLnB1c2gobltpXSl9fSx7a2V5Olwid3JpdGVJRFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQudXNlcjt0aGlzLndyaXRlVmFyVWludChlKSxlIT09WXQ/dGhpcy53cml0ZVZhclVpbnQodC5jbG9jayk6KHRoaXMud3JpdGVWYXJTdHJpbmcodC5uYW1lKSx0aGlzLndyaXRlVmFyVWludCh0LnR5cGUpKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kYXRhLmxlbmd0aH19LHtrZXk6XCJwb3NcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kYXRhLmxlbmd0aH19XSksdH0oKSxEZWxldGU9ZnVuY3Rpb24oKXtmdW5jdGlvbiBEZWxldGUoKXtidCh0aGlzLERlbGV0ZSksdGhpcy5fdGFyZ2V0PW51bGwsdGhpcy5fbGVuZ3RoPW51bGx9cmV0dXJuIHd0KERlbGV0ZSxbe2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1lLnJlYWRJRCgpO3JldHVybiB0aGlzLl90YXJnZXRJRD1uLHRoaXMuX2xlbmd0aD1lLnJlYWRWYXJVaW50KCksbnVsbD09PXQub3MuZ2V0SXRlbShuKT9bbl06W119fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7dC53cml0ZVVpbnQ4KCQodGhpcy5jb25zdHJ1Y3RvcikpLHQud3JpdGVJRCh0aGlzLl90YXJnZXRJRCksdC53cml0ZVZhclVpbnQodGhpcy5fbGVuZ3RoKX19LHtcbmtleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSYmYXJndW1lbnRzWzFdKW51bGwhPT10LmNvbm5lY3RvciYmdC5jb25uZWN0b3IuYnJvYWRjYXN0U3RydWN0KHRoaXMpO2Vsc2V7dmFyIGU9dGhpcy5fdGFyZ2V0SUQ7Zyh0LGUudXNlcixlLmNsb2NrLHRoaXMuX2xlbmd0aCwhMSl9bnVsbCE9PXQucGVyc2lzdGVuY2UmJnQucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdCh0LHRoaXMpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVyblwiRGVsZXRlIC0gdGFyZ2V0OiBcIitwKHRoaXMuX3RhcmdldElEKStcIiwgbGVuOiBcIit0aGlzLl9sZW5ndGh9fV0pLERlbGV0ZX0oKSxWdD1mdW5jdGlvbiB0KGUpe2J0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5uZXdUeXBlcz1uZXcgU2V0LHRoaXMuY2hhbmdlZFR5cGVzPW5ldyBNYXAsdGhpcy5kZWxldGVkU3RydWN0cz1uZXcgU2V0LHRoaXMuYmVmb3JlU3RhdGU9bmV3IE1hcCx0aGlzLmNoYW5nZWRQYXJlbnRUeXBlcz1uZXcgTWFwfSxJdGVtPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gSXRlbSgpe2J0KHRoaXMsSXRlbSksdGhpcy5faWQ9bnVsbCx0aGlzLl9vcmlnaW49bnVsbCx0aGlzLl9sZWZ0PW51bGwsdGhpcy5fcmlnaHQ9bnVsbCx0aGlzLl9yaWdodF9vcmlnaW49bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbCx0aGlzLl9wYXJlbnRTdWI9bnVsbCx0aGlzLl9kZWxldGVkPSExLHRoaXMuX3JlZG9uZT1udWxsfXJldHVybiB3dChJdGVtLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcn19LHtrZXk6XCJfcmVkb1wiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGwhPT10aGlzLl9yZWRvbmUpcmV0dXJuIHRoaXMuX3JlZG9uZTt2YXIgZT10aGlzLl9jb3B5KCksbj10aGlzLl9sZWZ0LHI9dGhpcyxpPXRoaXMuX3BhcmVudDtpZighMD09PWkuX2RlbGV0ZWQmJm51bGw9PT1pLl9yZWRvbmUmJmkuX3JlZG8odCksbnVsbCE9PWkuX3JlZG9uZSl7Zm9yKGk9aS5fcmVkb25lO251bGwhPT1uOyl7aWYobnVsbCE9PW4uX3JlZG9uZSYmbi5fcmVkb25lLl9wYXJlbnQ9PT1pKXtuPW4uX3JlZG9uZTticmVha31uPW4uX2xlZnR9Zm9yKDtudWxsIT09cjspbnVsbCE9PXIuX3JlZG9uZSYmci5fcmVkb25lLl9wYXJlbnQ9PT1pJiYocj1yLl9yZWRvbmUpLHI9ci5fcmlnaHR9cmV0dXJuIGUuX29yaWdpbj1uLGUuX2xlZnQ9bixlLl9yaWdodD1yLGUuX3JpZ2h0X29yaWdpbj1yLGUuX3BhcmVudD1pLGUuX3BhcmVudFN1Yj10aGlzLl9wYXJlbnRTdWIsZS5faW50ZWdyYXRlKHQpLHRoaXMuX3JlZG9uZT1lLGV9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3JldHVybiAwPT09ZT90aGlzOnRoaXMuX3JpZ2h0fX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT0hKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdKXx8YXJndW1lbnRzWzFdO2lmKCF0aGlzLl9kZWxldGVkKXt0aGlzLl9kZWxldGVkPSEwLHQuZHMubWFyayh0aGlzLl9pZCx0aGlzLl9sZW5ndGgsITEpO3ZhciBuPW5ldyBEZWxldGU7bi5fdGFyZ2V0SUQ9dGhpcy5faWQsbi5fbGVuZ3RoPXRoaXMuX2xlbmd0aCxlP24uX2ludGVncmF0ZSh0LCEwKTpudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsbiksbSh0LHRoaXMuX3BhcmVudCx0aGlzLl9wYXJlbnRTdWIpLHQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmFkZCh0aGlzKX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9bmV3IHh0O2UuX2lkPXRoaXMuX2lkLGUuX2xlbmd0aD10aGlzLl9sZW5ndGgsdC5vcy5kZWxldGUodGhpcy5faWQpLGUuX2ludGVncmF0ZSh0KX19LHtrZXk6XCJfYmVmb3JlQ2hhbmdlXCIsdmFsdWU6ZnVuY3Rpb24oKXt9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3QuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmFkZCh0aGlzKTt2YXIgZT10aGlzLl9wYXJlbnQsbj10aGlzLl9pZCxyPW51bGw9PT1uP3QudXNlcklEOm4udXNlcixpPXQuc3MuZ2V0U3RhdGUocik7aWYobnVsbD09PW4pdGhpcy5faWQ9dC5zcy5nZXROZXh0SUQodGhpcy5fbGVuZ3RoKTtlbHNlIGlmKG4udXNlcj09PVl0KTtlbHNle2lmKG4uY2xvY2s8aSlyZXR1cm5bXTtpZihuLmNsb2NrIT09aSl0aHJvdyBuZXcgRXJyb3IoXCJDYW4gbm90IGFwcGx5IHlldCFcIik7dC5zcy5zZXRTdGF0ZShuLnVzZXIsaSt0aGlzLl9sZW5ndGgpfWUuX2RlbGV0ZWR8fHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5oYXMoZSl8fHQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKXx8dGhpcy5fcGFyZW50Ll9iZWZvcmVDaGFuZ2UoKTt2YXIgbz12b2lkIDA7bz1udWxsIT09dGhpcy5fbGVmdD90aGlzLl9sZWZ0Ll9yaWdodDpudWxsIT09dGhpcy5fcGFyZW50U3ViP3RoaXMuX3BhcmVudC5fbWFwLmdldCh0aGlzLl9wYXJlbnRTdWIpfHxudWxsOnRoaXMuX3BhcmVudC5fc3RhcnQ7Zm9yKHZhciBhPW5ldyBTZXQscz1uZXcgU2V0O251bGwhPT1vJiZvIT09dGhpcy5fcmlnaHQ7KXtpZihzLmFkZChvKSxhLmFkZChvKSx0aGlzLl9vcmlnaW49PT1vLl9vcmlnaW4pby5faWQudXNlcjx0aGlzLl9pZC51c2VyJiYodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSk7ZWxzZXtpZighcy5oYXMoby5fb3JpZ2luKSlicmVhazthLmhhcyhvLl9vcmlnaW4pfHwodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSl9bz1vLl9yaWdodH12YXIgbD10aGlzLl9wYXJlbnRTdWI7aWYobnVsbD09PXRoaXMuX2xlZnQpe3ZhciB1PXZvaWQgMDtpZihudWxsIT09bCl7dmFyIGM9ZS5fbWFwO3U9Yy5nZXQobCl8fG51bGwsYy5zZXQobCx0aGlzKX1lbHNlIHU9ZS5fc3RhcnQsZS5fc3RhcnQ9dGhpczt0aGlzLl9yaWdodD11LG51bGwhPT11JiYodS5fbGVmdD10aGlzKX1lbHNle3ZhciBoPXRoaXMuX2xlZnQsZj1oLl9yaWdodDt0aGlzLl9yaWdodD1mLGguX3JpZ2h0PXRoaXMsbnVsbCE9PWYmJihmLl9sZWZ0PXRoaXMpfWUuX2RlbGV0ZWQmJnRoaXMuX2RlbGV0ZSh0LCExKSx0Lm9zLnB1dCh0aGlzKSxtKHQsZSxsKSx0aGlzLl9pZC51c2VyIT09WXQmJihudWxsPT09dC5jb25uZWN0b3J8fCF0LmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzJiZ0aGlzLl9pZC51c2VyIT09dC51c2VySUR8fHQuY29ubmVjdG9yLmJyb2FkY2FzdFN0cnVjdCh0aGlzKSxudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsdGhpcykpfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKTt2YXIgZT0wO251bGwhPT10aGlzLl9vcmlnaW4mJihlKz0xKSxudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYoZSs9NCksbnVsbCE9PXRoaXMuX3BhcmVudFN1YiYmKGUrPTgpLHQud3JpdGVVaW50OChlKSx0LndyaXRlSUQodGhpcy5faWQpLDEmZSYmdC53cml0ZUlEKHRoaXMuX29yaWdpbi5fbGFzdElkKSw0JmUmJnQud3JpdGVJRCh0aGlzLl9yaWdodF9vcmlnaW4uX2lkKSwwPT0oNSZlKSYmdC53cml0ZUlEKHRoaXMuX3BhcmVudC5faWQpLDgmZSYmdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLl9wYXJlbnRTdWIpKX19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49W10scj1lLnJlYWRVaW50OCgpLGk9ZS5yZWFkSUQoKTtpZih0aGlzLl9pZD1pLDEmcil7dmFyIG89ZS5yZWFkSUQoKSxhPXQub3MuZ2V0SXRlbUNsZWFuRW5kKG8pO251bGw9PT1hP24ucHVzaChvKToodGhpcy5fb3JpZ2luPWEsdGhpcy5fbGVmdD10aGlzLl9vcmlnaW4pfWlmKDQmcil7dmFyIHM9ZS5yZWFkSUQoKSxsPXQub3MuZ2V0SXRlbUNsZWFuU3RhcnQocyk7bnVsbD09PWw/bi5wdXNoKHMpOih0aGlzLl9yaWdodD1sLHRoaXMuX3JpZ2h0X29yaWdpbj1sKX1pZigwPT0oNSZyKSl7dmFyIHU9ZS5yZWFkSUQoKTtpZihudWxsPT09dGhpcy5fcGFyZW50KXt2YXIgYz12b2lkIDA7Yz11LmNvbnN0cnVjdG9yPT09enQ/dC5vcy5nZXQodSk6dC5vcy5nZXRJdGVtKHUpLG51bGw9PT1jP24ucHVzaCh1KTp0aGlzLl9wYXJlbnQ9Y319ZWxzZSBudWxsPT09dGhpcy5fcGFyZW50JiYobnVsbCE9PXRoaXMuX29yaWdpbj90aGlzLl9vcmlnaW4uY29uc3RydWN0b3I9PT14dD90aGlzLl9wYXJlbnQ9dGhpcy5fb3JpZ2luOnRoaXMuX3BhcmVudD10aGlzLl9vcmlnaW4uX3BhcmVudDpudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYodGhpcy5fcmlnaHRfb3JpZ2luLmNvbnN0cnVjdG9yPT09eHQ/dGhpcy5fcGFyZW50PXRoaXMuX3JpZ2h0X29yaWdpbjp0aGlzLl9wYXJlbnQ9dGhpcy5fcmlnaHRfb3JpZ2luLl9wYXJlbnQpKTtyZXR1cm4gOCZyJiYodGhpcy5fcGFyZW50U3ViPUpTT04ucGFyc2UoZS5yZWFkVmFyU3RyaW5nKCkpKSx0LnNzLmdldFN0YXRlKGkudXNlcik8aS5jbG9jayYmbi5wdXNoKG5ldyBBdChpLnVzZXIsaS5jbG9jay0xKSksbn19LHtrZXk6XCJfbGFzdElkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBBdCh0aGlzLl9pZC51c2VyLHRoaXMuX2lkLmNsb2NrK3RoaXMuX2xlbmd0aC0xKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fSx7a2V5OlwiX2NvdW50YWJsZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiEwfX1dKSxJdGVtfSgpLEx0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe2J0KHRoaXMsdCksdGhpcy5ldmVudExpc3RlbmVycz1bXX1yZXR1cm4gd3QodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZXZlbnRMaXN0ZW5lcnM9bnVsbH19LHtrZXk6XCJhZGRFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5ldmVudExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcInJlbW92ZUV2ZW50TGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmV2ZW50TGlzdGVuZXJzPXRoaXMuZXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiB0IT09ZX0pfX0se2tleTpcInJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50TGlzdGVuZXJzPVtdfX0se2tleTpcImNhbGxFdmVudExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7Zm9yKHZhciBuPTA7bjx0aGlzLmV2ZW50TGlzdGVuZXJzLmxlbmd0aDtuKyspdHJ5eygwLHRoaXMuZXZlbnRMaXN0ZW5lcnNbbl0pKGUpfWNhdGNoKHQpe2NvbnNvbGUuZXJyb3IodCl9fX1dKSx0fSgpLFR5cGU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gVHlwZSgpe2J0KHRoaXMsVHlwZSk7dmFyIHQ9RXQodGhpcywoVHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX21hcD1uZXcgTWFwLHQuX3N0YXJ0PW51bGwsdC5feT1udWxsLHQuX2V2ZW50SGFuZGxlcj1uZXcgTHQsdC5fZGVlcEV2ZW50SGFuZGxlcj1uZXcgTHQsdH1yZXR1cm4gT3QoVHlwZSx0KSx3dChUeXBlLFt7a2V5OlwiZ2V0UGF0aFRvXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodD09PXRoaXMpcmV0dXJuW107Zm9yKHZhciBlPVtdLG49dGhpcy5feTt0IT09dGhpcyYmdCE9PW47KXt2YXIgcj10Ll9wYXJlbnQ7aWYobnVsbCE9PXQuX3BhcmVudFN1YillLnVuc2hpZnQodC5fcGFyZW50U3ViKTtlbHNle3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXJbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9VXQocy52YWx1ZSwyKSxjPXVbMF07aWYodVsxXT09PXQpe2UudW5zaGlmdChjKTticmVha319fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fXQ9cn1pZih0IT09dGhpcyl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgdHlwZSBpcyBub3QgYSBjaGlsZCBvZiB0aGlzIG5vZGVcIik7cmV0dXJuIGV9fSx7a2V5OlwiX2NhbGxFdmVudEhhbmRsZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXQuY2hhbmdlZFBhcmVudFR5cGVzO3RoaXMuX2V2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnModCxlKTtmb3IodmFyIHI9dGhpcztyIT09dGhpcy5feTspe3ZhciBpPW4uZ2V0KHIpO3ZvaWQgMD09PWkmJihpPVtdLG4uc2V0KHIsaSkpLGkucHVzaChlKSxyPXIuX3BhcmVudH19fSx7a2V5OlwiX3RyYW5zYWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5feTtudWxsIT09ZT9lLnRyYW5zYWN0KHQpOnQoZSl9fSx7a2V5Olwib2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcIm9ic2VydmVEZWVwXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZGVlcEV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe1N0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCksdGhpcy5feT10O3ZhciBlPXRoaXMuX3N0YXJ0O251bGwhPT1lJiYodGhpcy5fc3RhcnQ9bnVsbCxiKHQsZSkpO3ZhciBuPXRoaXMuX21hcDt0aGlzLl9tYXA9bmV3IE1hcDt2YXIgcj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz1uLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe2IodCxhLnZhbHVlKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt3KHQsdGhpcy5fc3RhcnQpLHRoaXMuX3N0YXJ0PW51bGwsdGhpcy5fbWFwLmZvckVhY2goZnVuY3Rpb24oZSl7dyh0LGUpfSksdGhpcy5fbWFwPW5ldyBNYXB9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZ2NDaGlsZHJlbih0KSxTdChUeXBlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlLnByb3RvdHlwZSksXCJfZ2NcIix0aGlzKS5jYWxsKHRoaXMsdCl9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2b2lkIDAhPT1uJiZ0LmdjRW5hYmxlZHx8KG49ITE9PT10Ll9oYXNVbmRvTWFuYWdlciYmdC5nY0VuYWJsZWQpLFN0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pLHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5kZWxldGUodGhpcyk7dmFyIHI9ITAsaT0hMSxvPXZvaWQgMDt0cnl7Zm9yKHZhciBhLHM9dGhpcy5fbWFwLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe3ZhciBsPWEudmFsdWU7bCBpbnN0YW5jZW9mIEl0ZW0mJiFsLl9kZWxldGVkJiZsLl9kZWxldGUodCwhMSxuKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX1mb3IodmFyIHU9dGhpcy5fc3RhcnQ7bnVsbCE9PXU7KXUuX2RlbGV0ZWR8fHUuX2RlbGV0ZSh0LCExLG4pLHU9dS5fcmlnaHQ7biYmdGhpcy5fZ2NDaGlsZHJlbih0KX19XSksVHlwZX0oSXRlbSksSXRlbUpTT049ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbUpTT04oKXtidCh0aGlzLEl0ZW1KU09OKTt2YXIgdD1FdCh0aGlzLChJdGVtSlNPTi5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTikpLmNhbGwodGhpcykpO3JldHVybiB0Ll9jb250ZW50PW51bGwsdH1yZXR1cm4gT3QoSXRlbUpTT04sdCksd3QoSXRlbUpTT04sW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9U3QoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQuX2NvbnRlbnQ9dGhpcy5fY29udGVudCx0fX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1TdChJdGVtSlNPTi5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04ucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSkscj1lLnJlYWRWYXJVaW50KCk7dGhpcy5fY29udGVudD1uZXcgQXJyYXkocik7Zm9yKHZhciBpPTA7aTxyO2krKyl7dmFyIG89ZS5yZWFkVmFyU3RyaW5nKCksYT12b2lkIDA7YT1cInVuZGVmaW5lZFwiPT09bz92b2lkIDA6SlNPTi5wYXJzZShvKSx0aGlzLl9jb250ZW50W2ldPWF9cmV0dXJuIG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7U3QoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCk7dmFyIGU9dGhpcy5fY29udGVudC5sZW5ndGg7dC53cml0ZVZhclVpbnQoZSk7Zm9yKHZhciBuPTA7bjxlO24rKyl7dmFyIHI9dm9pZCAwLGk9dGhpcy5fY29udGVudFtuXTtyPXZvaWQgMD09PWk/XCJ1bmRlZmluZWRcIjpKU09OLnN0cmluZ2lmeShpKSx0LndyaXRlVmFyU3RyaW5nKHIpfX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1KU09OXCIsdGhpcyxcImNvbnRlbnQ6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy5fY29udGVudCkpfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZigwPT09ZSlyZXR1cm4gdGhpcztpZihlPj10aGlzLl9sZW5ndGgpcmV0dXJuIHRoaXMuX3JpZ2h0O3ZhciBuPW5ldyBJdGVtSlNPTjtyZXR1cm4gbi5fY29udGVudD10aGlzLl9jb250ZW50LnNwbGljZShlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbUpTT059KEl0ZW0pLEl0ZW1TdHJpbmc9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbVN0cmluZygpe2J0KHRoaXMsSXRlbVN0cmluZyk7dmFyIHQ9RXQodGhpcywoSXRlbVN0cmluZy5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX2NvbnRlbnQ9bnVsbCx0fXJldHVybiBPdChJdGVtU3RyaW5nLHQpLHd0KEl0ZW1TdHJpbmcsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9U3QoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Ll9jb250ZW50PXRoaXMuX2NvbnRlbnQsdH19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49U3QoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5fY29udGVudD1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe1N0KEl0ZW1TdHJpbmcucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMuX2NvbnRlbnQpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbVN0cmluZ1wiLHRoaXMsJ2NvbnRlbnQ6XCInK3RoaXMuX2NvbnRlbnQrJ1wiJyl9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKDA9PT1lKXJldHVybiB0aGlzO2lmKGU+PXRoaXMuX2xlbmd0aClyZXR1cm4gdGhpcy5fcmlnaHQ7dmFyIG49bmV3IEl0ZW1TdHJpbmc7cmV0dXJuIG4uX2NvbnRlbnQ9dGhpcy5fY29udGVudC5zbGljZShlKSx0aGlzLl9jb250ZW50PXRoaXMuX2NvbnRlbnQuc2xpY2UoMCxlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbVN0cmluZ30oSXRlbSksWUV2ZW50PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gWUV2ZW50KHQpe2J0KHRoaXMsWUV2ZW50KSx0aGlzLnRhcmdldD10LHRoaXMuY3VycmVudFRhcmdldD10fXJldHVybiB3dChZRXZlbnQsW3trZXk6XCJwYXRoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY3VycmVudFRhcmdldC5nZXRQYXRoVG8odGhpcy50YXJnZXQpfX1dKSxZRXZlbnR9KCksWUFycmF5RXZlbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWUFycmF5RXZlbnQodCxlLG4pe2J0KHRoaXMsWUFycmF5RXZlbnQpO3ZhciByPUV0KHRoaXMsKFlBcnJheUV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheUV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5yZW1vdGU9ZSxyLl90cmFuc2FjdGlvbj1uLHIuX2FkZGVkRWxlbWVudHM9bnVsbCxyLl9yZW1vdmVkRWxlbWVudHM9bnVsbCxyfXJldHVybiBPdChZQXJyYXlFdmVudCx0KSx3dChZQXJyYXlFdmVudCxbe2tleTpcImFkZGVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fYWRkZWRFbGVtZW50cyl7dmFyIHQ9dGhpcy50YXJnZXQsZT10aGlzLl90cmFuc2FjdGlvbixuPW5ldyBTZXQ7ZS5uZXdUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHIpe3IuX3BhcmVudCE9PXR8fGUuZGVsZXRlZFN0cnVjdHMuaGFzKHIpfHxuLmFkZChyKX0pLHRoaXMuX2FkZGVkRWxlbWVudHM9bn1yZXR1cm4gdGhpcy5fYWRkZWRFbGVtZW50c319LHtrZXk6XCJyZW1vdmVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fcmVtb3ZlZEVsZW1lbnRzKXt2YXIgdD10aGlzLnRhcmdldCxlPXRoaXMuX3RyYW5zYWN0aW9uLG49bmV3IFNldDtlLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24ocil7ci5fcGFyZW50IT09dHx8ZS5uZXdUeXBlcy5oYXMocil8fG4uYWRkKHIpfSksdGhpcy5fcmVtb3ZlZEVsZW1lbnRzPW59cmV0dXJuIHRoaXMuX3JlbW92ZWRFbGVtZW50c319XSksWUFycmF5RXZlbnR9KFlFdmVudCksWUFycmF5PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlBcnJheSgpe3JldHVybiBidCh0aGlzLFlBcnJheSksRXQodGhpcywoWUFycmF5Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheSkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIE90KFlBcnJheSx0KSx3dChZQXJyYXksW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWUFycmF5RXZlbnQodGhpcyxuLHQpKX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KXtpZighZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlKXtpZih0PGUuX2xlbmd0aClyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PUl0ZW1KU09OfHxlLmNvbnN0cnVjdG9yPT09SXRlbVN0cmluZz9lLl9jb250ZW50W3RdOmU7dC09ZS5fbGVuZ3RofWU9ZS5fcmlnaHR9fX0se2tleTpcInRvQXJyYXlcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdH0pfX0se2tleTpcInRvSlNPTlwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0IGluc3RhbmNlb2YgVHlwZT9udWxsIT09dC50b0pTT04/dC50b0pTT04oKTp0LnRvU3RyaW5nKCk6dH0pfX0se2tleTpcIm1hcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1bXTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHIsaSl7bi5wdXNoKHQocixpLGUpKX0pLG59fSx7a2V5OlwiZm9yRWFjaFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wLG49dGhpcy5fc3RhcnQ7bnVsbCE9PW47KXtpZighbi5fZGVsZXRlZCYmbi5fY291bnRhYmxlKWlmKG4gaW5zdGFuY2VvZiBUeXBlKXQobixlKyssdGhpcyk7ZWxzZSBmb3IodmFyIHI9bi5fY29udGVudCxpPXIubGVuZ3RoLG89MDtvPGk7bysrKWUrKyx0KHJbb10sZSx0aGlzKTtuPW4uX3JpZ2h0fX19LHtrZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJue25leHQ6ZnVuY3Rpb24oKXtmb3IoO251bGwhPT10aGlzLl9pdGVtJiYodGhpcy5faXRlbS5fZGVsZXRlZHx8dGhpcy5faXRlbS5fbGVuZ3RoPD10aGlzLl9pdGVtRWxlbWVudCk7KXRoaXMuX2l0ZW09dGhpcy5faXRlbS5fcmlnaHQsdGhpcy5faXRlbUVsZW1lbnQ9MDtpZihudWxsPT09dGhpcy5faXRlbSlyZXR1cm57ZG9uZTohMH07dmFyIHQ9dm9pZCAwO3JldHVybiB0PXRoaXMuX2l0ZW0gaW5zdGFuY2VvZiBUeXBlP3RoaXMuX2l0ZW06dGhpcy5faXRlbS5fY29udGVudFt0aGlzLl9pdGVtRWxlbWVudCsrXSx7dmFsdWU6dCxkb25lOiExfX0sX2l0ZW06dGhpcy5fc3RhcnQsX2l0ZW1FbGVtZW50OjAsX2NvdW50OjB9fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06MTtpZih0aGlzLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7Zm9yKHZhciByPWUuX3N0YXJ0LGk9MDtudWxsIT09ciYmbj4wOyl7aWYoIXIuX2RlbGV0ZWQmJnIuX2NvdW50YWJsZSlpZihpPD10JiZ0PGkrci5fbGVuZ3RoKXt2YXIgbz10LWk7cj1yLl9zcGxpdEF0KGUuX3ksbyksci5fc3BsaXRBdChlLl95LG4pLG4tPXIuX2xlbmd0aCxyLl9kZWxldGUoZS5feSksaSs9b31lbHNlIGkrPXIuX2xlbmd0aDtyPXIuX3JpZ2h0fX0pLG4+MCl0aHJvdyBuZXcgRXJyb3IoXCJEZWxldGUgZXhjZWVkcyB0aGUgcmFuZ2Ugb2YgdGhlIFlBcnJheVwiKX19LHtrZXk6XCJpbnNlcnRBZnRlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcztyZXR1cm4gdGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24ocil7dmFyIGk9dm9pZCAwO2k9bnVsbD09PXQ/bi5fc3RhcnQ6dC5fcmlnaHQ7Zm9yKHZhciBvPW51bGwsYT0wO2E8ZS5sZW5ndGg7YSsrKXt2YXIgcz1lW2FdO1wiZnVuY3Rpb25cIj09dHlwZW9mIHMmJihzPW5ldyBzKSxzIGluc3RhbmNlb2YgVHlwZT8obnVsbCE9PW8mJihudWxsIT09ciYmby5faW50ZWdyYXRlKHIpLHQ9byxvPW51bGwpLHMuX29yaWdpbj10LHMuX2xlZnQ9dCxzLl9yaWdodD1pLHMuX3JpZ2h0X29yaWdpbj1pLHMuX3BhcmVudD1uLG51bGwhPT1yP3MuX2ludGVncmF0ZShyKTpudWxsPT09dD9uLl9zdGFydD1zOnQuX3JpZ2h0PXMsdD1zKToobnVsbD09PW8mJihvPW5ldyBJdGVtSlNPTixvLl9vcmlnaW49dCxvLl9sZWZ0PXQsby5fcmlnaHQ9aSxvLl9yaWdodF9vcmlnaW49aSxvLl9wYXJlbnQ9bixvLl9jb250ZW50PVtdKSxvLl9jb250ZW50LnB1c2gocykpfW51bGwhPT1vJiYobnVsbCE9PXI/by5faW50ZWdyYXRlKHIpOm51bGw9PT1vLl9sZWZ0JiYobi5fc3RhcnQ9bykpfSksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IodmFyIHI9bnVsbCxpPW4uX3N0YXJ0LG89MCxhPW4uX3k7bnVsbCE9PWk7KXt2YXIgcz1pLl9kZWxldGVkPzA6aS5fbGVuZ3RoLTE7aWYobzw9dCYmdDw9bytzKXt2YXIgbD10LW87aT1pLl9zcGxpdEF0KGEsbCkscj1pLl9sZWZ0LG8rPWw7YnJlYWt9aS5fZGVsZXRlZHx8KG8rPWkuX2xlbmd0aCkscj1pLGk9aS5fcmlnaHR9aWYodD5vKXRocm93IG5ldyBFcnJvcihcIkluZGV4IGV4Y2VlZHMgYXJyYXkgcmFuZ2UhXCIpO24uaW5zZXJ0QWZ0ZXIocixlKX0pfX0se2tleTpcInB1c2hcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQsbj1udWxsO251bGwhPT1lOyllLl9kZWxldGVkfHwobj1lKSxlPWUuX3JpZ2h0O3RoaXMuaW5zZXJ0QWZ0ZXIobix0KX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllBcnJheVwiLHRoaXMsXCJzdGFydDpcIitwKHRoaXMuX3N0YXJ0KSsnXCInKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MCxlPXRoaXMuX3N0YXJ0O251bGwhPT1lOykhZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlJiYodCs9ZS5fbGVuZ3RoKSxlPWUuX3JpZ2h0O3JldHVybiB0fX1dKSxZQXJyYXl9KFR5cGUpLFlNYXBFdmVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZTWFwRXZlbnQodCxlLG4pe2J0KHRoaXMsWU1hcEV2ZW50KTt2YXIgcj1FdCh0aGlzLChZTWFwRXZlbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWU1hcEV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5rZXlzQ2hhbmdlZD1lLHIucmVtb3RlPW4scn1yZXR1cm4gT3QoWU1hcEV2ZW50LHQpLFlNYXBFdmVudH0oWUV2ZW50KSxZTWFwPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlNYXAoKXtyZXR1cm4gYnQodGhpcyxZTWFwKSxFdCh0aGlzLChZTWFwLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlNYXApKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBPdChZTWFwLHQpLHd0KFlNYXAsW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWU1hcEV2ZW50KHRoaXMsZSxuKSl9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD17fSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT1VdChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07aWYoIWwuX2RlbGV0ZWQpe3ZhciB1PXZvaWQgMDt1PWwgaW5zdGFuY2VvZiBUeXBlP3ZvaWQgMCE9PWwudG9KU09OP2wudG9KU09OKCk6bC50b1N0cmluZygpOmwuX2NvbnRlbnRbMF0sdFtzXT11fX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJrZXlzXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT1VdChpLnZhbHVlLDIpLHM9YVswXTthWzFdLl9kZWxldGVkfHx0LnB1c2gocyl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19cmV0dXJuIHR9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihuKXt2YXIgcj1lLl9tYXAuZ2V0KHQpO251bGwhPT1uJiZ2b2lkIDAhPT1yJiZyLl9kZWxldGUobil9KX19LHtrZXk6XCJzZXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7cmV0dXJuIHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKHIpe3ZhciBpPW4uX21hcC5nZXQodCl8fG51bGw7aWYobnVsbCE9PWkpe2lmKGkuY29uc3RydWN0b3I9PT1JdGVtSlNPTiYmIWkuX2RlbGV0ZWQmJmkuX2NvbnRlbnRbMF09PT1lKXJldHVybiBlO251bGwhPT1yJiZpLl9kZWxldGUocil9dmFyIG89dm9pZCAwO1wiZnVuY3Rpb25cIj09dHlwZW9mIGU/KG89bmV3IGUsZT1vKTplIGluc3RhbmNlb2YgSXRlbT9vPWU6KG89bmV3IEl0ZW1KU09OLG8uX2NvbnRlbnQ9W2VdKSxvLl9yaWdodD1pLG8uX3JpZ2h0X29yaWdpbj1pLG8uX3BhcmVudD1uLG8uX3BhcmVudFN1Yj10LG51bGwhPT1yP28uX2ludGVncmF0ZShyKTpuLl9tYXAuc2V0KHQsbyl9KSxlfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX21hcC5nZXQodCk7aWYodm9pZCAwIT09ZSYmIWUuX2RlbGV0ZWQpcmV0dXJuIGUgaW5zdGFuY2VvZiBUeXBlP2U6ZS5fY29udGVudFtlLl9jb250ZW50Lmxlbmd0aC0xXX19LHtrZXk6XCJoYXNcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9tYXAuZ2V0KHQpO3JldHVybiB2b2lkIDAhPT1lJiYhZS5fZGVsZXRlZH19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllNYXBcIix0aGlzLFwibWFwU2l6ZTpcIit0aGlzLl9tYXAuc2l6ZSl9fV0pLFlNYXB9KFR5cGUpLEN0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtidCh0aGlzLGUpO3ZhciB0PUV0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmVtYmVkPW51bGwsdH1yZXR1cm4gT3QoZSx0KSx3dChlLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPVN0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHIuZW1iZWQ9dGhpcy5lbWJlZCxyfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1TdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiB0aGlzLmVtYmVkPUpTT04ucGFyc2Uobi5yZWFkVmFyU3RyaW5nKCkpLHJ9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7U3QoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcoSlNPTi5zdHJpbmdpZnkodGhpcy5lbWJlZCkpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbUVtYmVkXCIsdGhpcyxcImVtYmVkOlwiK0pTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWQpKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fV0pLGV9KEl0ZW0pLE10PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtidCh0aGlzLGUpO3ZhciB0PUV0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmtleT1udWxsLHQudmFsdWU9bnVsbCx0fXJldHVybiBPdChlLHQpLHd0KGUsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9U3QoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gci5rZXk9dGhpcy5rZXksci52YWx1ZT10aGlzLnZhbHVlLHJ9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPVN0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHRoaXMua2V5PW4ucmVhZFZhclN0cmluZygpLHRoaXMudmFsdWU9SlNPTi5wYXJzZShuLnJlYWRWYXJTdHJpbmcoKSkscn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtTdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmtleSksdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlKSl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtRm9ybWF0XCIsdGhpcyxcImtleTpcIitKU09OLnN0cmluZ2lmeSh0aGlzLmtleSkrXCIsdmFsdWU6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZSkpfX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gMX19LHtrZXk6XCJfY291bnRhYmxlXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITF9fV0pLGV9KEl0ZW0pLFJ0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuLHIpe2J0KHRoaXMsZSk7dmFyIGk9RXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzLHQsbixyKSk7cmV0dXJuIGkuX2RlbHRhPW51bGwsaX1yZXR1cm4gT3QoZSx0KSx3dChlLFt7a2V5OlwiZGVsdGFcIixnZXQ6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO2lmKG51bGw9PT10aGlzLl9kZWx0YSl7dmFyIGU9dGhpcy50YXJnZXQuX3k7ZS50cmFuc2FjdChmdW5jdGlvbigpe3ZhciBuPXQudGFyZ2V0Ll9zdGFydCxyPVtdLGk9dC5hZGRlZEVsZW1lbnRzLG89dC5yZW1vdmVkRWxlbWVudHM7dC5fZGVsdGE9cjtmb3IodmFyIGE9bnVsbCxzPXt9LGw9bmV3IE1hcCx1PW5ldyBNYXAsYz1cIlwiLGg9MCxmPTAsZD1mdW5jdGlvbigpe2lmKG51bGwhPT1hKXt2YXIgdD12b2lkIDA7c3dpdGNoKGEpe2Nhc2VcImRlbGV0ZVwiOnQ9e2RlbGV0ZTpmfSxmPTA7YnJlYWs7Y2FzZVwiaW5zZXJ0XCI6aWYodD17aW5zZXJ0OmN9LGwuc2l6ZT4wKXt0LmF0dHJpYnV0ZXM9e307dmFyIGU9ITAsbj0hMSxpPXZvaWQgMDt0cnl7Zm9yKHZhciBvLHU9bFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShvPXUubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgZD1VdChvLnZhbHVlLDIpLF89ZFswXSx2PWRbMV07bnVsbCE9PXYmJih0LmF0dHJpYnV0ZXNbX109dil9fWNhdGNoKHQpe249ITAsaT10fWZpbmFsbHl7dHJ5eyFlJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgaX19fWM9XCJcIjticmVhaztjYXNlXCJyZXRhaW5cIjppZih0PXtyZXRhaW46aH0sT2JqZWN0LmtleXMocykubGVuZ3RoPjApe3QuYXR0cmlidXRlcz17fTtmb3IodmFyIF8gaW4gcyl0LmF0dHJpYnV0ZXNbX109c1tfXX1oPTB9ci5wdXNoKHQpLGE9bnVsbH19O251bGwhPT1uOyl7c3dpdGNoKG4uY29uc3RydWN0b3Ipe2Nhc2UgQ3Q6aS5oYXMobik/KGQoKSxhPVwiaW5zZXJ0XCIsYz1uLmVtYmVkLGQoKSk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9MSk6ITE9PT1uLl9kZWxldGVkJiYoXCJyZXRhaW5cIiE9PWEmJihkKCksYT1cInJldGFpblwiKSxoKz0xKTticmVhaztjYXNlIEl0ZW1TdHJpbmc6aS5oYXMobik/KFwiaW5zZXJ0XCIhPT1hJiYoZCgpLGE9XCJpbnNlcnRcIiksYys9bi5fY29udGVudCk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9bi5fbGVuZ3RoKTohMT09PW4uX2RlbGV0ZWQmJihcInJldGFpblwiIT09YSYmKGQoKSxhPVwicmV0YWluXCIpLGgrPW4uX2xlbmd0aCk7YnJlYWs7Y2FzZSBNdDppZihpLmhhcyhuKSl7KGwuZ2V0KG4ua2V5KXx8bnVsbCkhPT1uLnZhbHVlPyhcInJldGFpblwiPT09YSYmZCgpLG4udmFsdWU9PT0odS5nZXQobi5rZXkpfHxudWxsKT9kZWxldGUgc1tuLmtleV06c1tuLmtleV09bi52YWx1ZSk6bi5fZGVsZXRlKGUpfWVsc2UgaWYoby5oYXMobikpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciBfPWwuZ2V0KG4ua2V5KXx8bnVsbDtfIT09bi52YWx1ZSYmKFwicmV0YWluXCI9PT1hJiZkKCksc1tuLmtleV09Xyl9ZWxzZSBpZighMT09PW4uX2RlbGV0ZWQpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciB2PXNbbi5rZXldO3ZvaWQgMCE9PXYmJih2IT09bi52YWx1ZT8oXCJyZXRhaW5cIj09PWEmJmQoKSxudWxsPT09bi52YWx1ZT9zW24ua2V5XT1uLnZhbHVlOmRlbGV0ZSBzW24ua2V5XSk6bi5fZGVsZXRlKGUpKX0hMT09PW4uX2RlbGV0ZWQmJihcImluc2VydFwiPT09YSYmZCgpLEIobCxuKSl9bj1uLl9yaWdodH1mb3IoZCgpO3QuX2RlbHRhLmxlbmd0aD4wOyl7dmFyIHA9dC5fZGVsdGFbdC5fZGVsdGEubGVuZ3RoLTFdO2lmKHZvaWQgMD09PXAucmV0YWlufHx2b2lkIDAhPT1wLmF0dHJpYnV0ZXMpYnJlYWs7dC5fZGVsdGEucG9wKCl9fSl9cmV0dXJuIHRoaXMuX2RlbHRhfX1dKSxlfShZQXJyYXlFdmVudCksWVRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVRleHQodCl7YnQodGhpcyxZVGV4dCk7dmFyIGU9RXQodGhpcywoWVRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVRleHQpKS5jYWxsKHRoaXMpKTtpZihcInN0cmluZ1wiPT10eXBlb2YgdCl7dmFyIG49bmV3IEl0ZW1TdHJpbmc7bi5fcGFyZW50PWUsbi5fY29udGVudD10LGUuX3N0YXJ0PW59cmV0dXJuIGV9cmV0dXJuIE90KFlUZXh0LHQpLHd0KFlUZXh0LFt7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IFJ0KHRoaXMsbix0KSl9fSx7a2V5OlwidG9TdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD1cIlwiLGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KSFlLl9kZWxldGVkJiZlLl9jb3VudGFibGUmJih0Kz1lLl9jb250ZW50KSxlPWUuX3JpZ2h0O3JldHVybiB0fX0se2tleTpcImFwcGx5RGVsdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKG4pe2Zvcih2YXIgcj1udWxsLGk9ZS5fc3RhcnQsbz1uZXcgTWFwLGE9MDthPHQubGVuZ3RoO2ErKyl7dmFyIHM9dFthXTtpZih2b2lkIDAhPT1zLmluc2VydCl7dmFyIGw9RChuLHMuaW5zZXJ0LGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksdT1VdChsLDIpO3I9dVswXSxpPXVbMV19ZWxzZSBpZih2b2lkIDAhPT1zLnJldGFpbil7dmFyIGM9UChuLHMucmV0YWluLGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksaD1VdChjLDIpO3I9aFswXSxpPWhbMV19ZWxzZSBpZih2b2lkIDAhPT1zLmRlbGV0ZSl7dmFyIGY9TihuLHMuZGVsZXRlLGUscixpLG8pLGQ9VXQoZiwyKTtyPWRbMF0saT1kWzFdfX19KX19LHtrZXk6XCJ0b0RlbHRhXCIsdmFsdWU6ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7aWYoci5sZW5ndGg+MCl7dmFyIHQ9e30saT0hMSxvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PW5bU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9VXQobC52YWx1ZSwyKSxoPWNbMF0sZj1jWzFdO2k9ITAsdFtoXT1mfX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fXZhciBkPXtpbnNlcnQ6cn07aSYmKGQuYXR0cmlidXRlcz10KSxlLnB1c2goZCkscj1cIlwifX1mb3IodmFyIGU9W10sbj1uZXcgTWFwLHI9XCJcIixpPXRoaXMuX3N0YXJ0O251bGwhPT1pOyl7aWYoIWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgSXRlbVN0cmluZzpyKz1pLl9jb250ZW50O2JyZWFrO2Nhc2UgTXQ6dCgpLEIobixpKX1pPWkuX3JpZ2h0fXJldHVybiB0KCksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307ZS5sZW5ndGg8PTB8fHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKGkpe3ZhciBvPUUobix0KSxhPVV0KG8sMykscz1hWzBdLGw9YVsxXSx1PWFbMl07RChpLGUsbixzLGwsdSxyKX0pfX0se2tleTpcImluc2VydEVtYmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLHI9YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9O2lmKGUuY29uc3RydWN0b3IhPT1PYmplY3QpdGhyb3cgbmV3IEVycm9yKFwiRW1iZWQgbXVzdCBiZSBhbiBPYmplY3RcIik7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShuLHQpLGE9VXQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTtEKGksZSxuLHMsbCx1LHIpfSl9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzOzAhPT1lJiZ0aGlzLl90cmFuc2FjdChmdW5jdGlvbihyKXt2YXIgaT1FKG4sdCksbz1VdChpLDMpLGE9b1swXSxzPW9bMV0sbD1vWzJdO04ocixlLG4sYSxzLGwpfSl9fSx7a2V5OlwiZm9ybWF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3ZhciByPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShyLHQpLGE9VXQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTtudWxsIT09bCYmUChpLGUscixzLGwsdSxuKX0pfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVRleHRcIix0aGlzKX19XSksWVRleHR9KFlBcnJheSksWVhtbEhvb2s9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEhvb2sodCl7YnQodGhpcyxZWG1sSG9vayk7dmFyIGU9RXQodGhpcywoWVhtbEhvb2suX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2spKS5jYWxsKHRoaXMpKTtyZXR1cm4gZS5ob29rTmFtZT1udWxsLHZvaWQgMCE9PXQmJihlLmhvb2tOYW1lPXQpLGV9cmV0dXJuIE90KFlYbWxIb29rLHQpLHd0KFlYbWxIb29rLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVN0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Lmhvb2tOYW1lPXRoaXMuaG9va05hbWUsdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LGU9YXJndW1lbnRzWzJdLG49dFt0aGlzLmhvb2tOYW1lXSxyPXZvaWQgMDtyZXR1cm4gcj12b2lkIDAhPT1uP24uY3JlYXRlRG9tKHRoaXMpOmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGhpcy5ob29rTmFtZSksci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIsdGhpcy5ob29rTmFtZSksUihlLHIsdGhpcykscn19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49U3QoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpO3JldHVybiB0aGlzLmhvb2tOYW1lPWUucmVhZFZhclN0cmluZygpLG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7U3QoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmhvb2tOYW1lKX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXRoaXMuaG9va05hbWUpdGhyb3cgbmV3IEVycm9yKFwiaG9va05hbWUgbXVzdCBiZSBkZWZpbmVkIVwiKTtTdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCl9fV0pLFlYbWxIb29rfShZTWFwKSxIdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtidCh0aGlzLHQpLHRoaXMuX2ZpbHRlcj1ufHxmdW5jdGlvbigpe3JldHVybiEwfSx0aGlzLl9yb290PWUsdGhpcy5fY3VycmVudE5vZGU9ZSx0aGlzLl9maXJzdENhbGw9ITB9cmV0dXJuIHd0KHQsW3trZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9fSx7a2V5OlwibmV4dFwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5fY3VycmVudE5vZGU7aWYodGhpcy5fZmlyc3RDYWxsJiYodGhpcy5fZmlyc3RDYWxsPSExLCF0Ll9kZWxldGVkJiZ0aGlzLl9maWx0ZXIodCkpKXJldHVybnt2YWx1ZTp0LGRvbmU6ITF9O2Rve2lmKHQuX2RlbGV0ZWR8fHQuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQuX1lYbWxFbGVtZW50JiZ0LmNvbnN0cnVjdG9yIT09WVhtbEZyYWdtZW50fHxudWxsPT09dC5fc3RhcnQpe2Zvcig7dCE9PXRoaXMuX3Jvb3Q7KXtpZihudWxsIT09dC5fcmlnaHQpe3Q9dC5fcmlnaHQ7YnJlYWt9dD10Ll9wYXJlbnR9dD09PXRoaXMuX3Jvb3QmJih0PW51bGwpfWVsc2UgdD10Ll9zdGFydDtpZih0PT09dGhpcy5fcm9vdClicmVha313aGlsZShudWxsIT09dCYmKHQuX2RlbGV0ZWR8fCF0aGlzLl9maWx0ZXIodCkpKTtyZXR1cm4gdGhpcy5fY3VycmVudE5vZGU9dCxudWxsPT09dD97ZG9uZTohMH06e3ZhbHVlOnQsZG9uZTohMX19fV0pLHR9KCksWVhtbEV2ZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxFdmVudCh0LGUsbixyKXtidCh0aGlzLFlYbWxFdmVudCk7dmFyIGk9RXQodGhpcywoWVhtbEV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFdmVudCkpLmNhbGwodGhpcyx0KSk7cmV0dXJuIGkuX3RyYW5zYWN0aW9uPXIsaS5jaGlsZExpc3RDaGFuZ2VkPSExLGkuYXR0cmlidXRlc0NoYW5nZWQ9bmV3IFNldCxpLnJlbW90ZT1uLGUuZm9yRWFjaChmdW5jdGlvbih0KXtudWxsPT09dD9pLmNoaWxkTGlzdENoYW5nZWQ9ITA6aS5hdHRyaWJ1dGVzQ2hhbmdlZC5hZGQodCl9KSxpfXJldHVybiBPdChZWG1sRXZlbnQsdCksWVhtbEV2ZW50fShZRXZlbnQpLFlYbWxGcmFnbWVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sRnJhZ21lbnQoKXtyZXR1cm4gYnQodGhpcyxZWG1sRnJhZ21lbnQpLEV0KHRoaXMsKFlYbWxGcmFnbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRnJhZ21lbnQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBPdChZWG1sRnJhZ21lbnQsdCksd3QoWVhtbEZyYWdtZW50LFt7a2V5OlwiY3JlYXRlVHJlZVdhbGtlclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBuZXcgSHQodGhpcyx0KX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yXCIsdmFsdWU6ZnVuY3Rpb24odCl7dD10LnRvVXBwZXJDYXNlKCk7dmFyIGU9bmV3IEh0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSksbj1lLm5leHQoKTtyZXR1cm4gbi5kb25lP251bGw6bi52YWx1ZX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yQWxsXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHQ9dC50b1VwcGVyQ2FzZSgpLEFycmF5LmZyb20obmV3IEh0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSkpfX0se2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBZWG1sRXZlbnQodGhpcyxlLG4sdCkpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQudG9TdHJpbmcoKX0pLmpvaW4oXCJcIil9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtTdChZWG1sRnJhZ21lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxGcmFnbWVudC5wcm90b3R5cGUpLFwiX2RlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LGUsbil9fSx7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpkb2N1bWVudCxlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fSxuPWFyZ3VtZW50c1syXSxyPXQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO3JldHVybiBSKG4scix0aGlzKSx0aGlzLmZvckVhY2goZnVuY3Rpb24oaSl7ci5pbnNlcnRCZWZvcmUoaS50b0RvbSh0LGUsbiksbnVsbCl9KSxyfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVhtbFwiLHRoaXMpfX1dKSxZWG1sRnJhZ21lbnR9KFlBcnJheSksWVhtbEVsZW1lbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEVsZW1lbnQoKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06XCJVTkRFRklORURcIjtidCh0aGlzLFlYbWxFbGVtZW50KTt2YXIgZT1FdCh0aGlzLChZWG1sRWxlbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudCkpLmNhbGwodGhpcykpO3JldHVybiBlLm5vZGVOYW1lPXQudG9VcHBlckNhc2UoKSxlfXJldHVybiBPdChZWG1sRWxlbWVudCx0KSx3dChZWG1sRWxlbWVudCxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1TdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5ub2RlTmFtZT10aGlzLm5vZGVOYW1lLHR9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPVN0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5ub2RlTmFtZT1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe1N0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5ub2RlTmFtZSl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGw9PT10aGlzLm5vZGVOYW1lKXRocm93IG5ldyBFcnJvcihcIm5vZGVOYW1lIG11c3QgYmUgZGVmaW5lZCFcIik7U3QoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfaW50ZWdyYXRlXCIsdGhpcykuY2FsbCh0aGlzLHQpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLmdldEF0dHJpYnV0ZXMoKSxlPVtdLG49W107Zm9yKHZhciByIGluIHQpbi5wdXNoKHIpO24uc29ydCgpO2Zvcih2YXIgaT1uLmxlbmd0aCxvPTA7bzxpO28rKyl7dmFyIGE9bltvXTtlLnB1c2goYSsnPVwiJyt0W2FdKydcIicpfXZhciBzPXRoaXMubm9kZU5hbWUudG9Mb2NhbGVMb3dlckNhc2UoKTtyZXR1cm5cIjxcIitzKyhlLmxlbmd0aD4wP1wiIFwiK2Uuam9pbihcIiBcIik6XCJcIikrXCI+XCIrU3QoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJ0b1N0cmluZ1wiLHRoaXMpLmNhbGwodGhpcykrXCI8L1wiK3MrXCI+XCJ9fSx7a2V5OlwicmVtb3ZlQXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIFlNYXAucHJvdG90eXBlLmRlbGV0ZS5jYWxsKHRoaXMsdCl9fSx7a2V5Olwic2V0QXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtyZXR1cm4gWU1hcC5wcm90b3R5cGUuc2V0LmNhbGwodGhpcyx0LGUpfX0se2tleTpcImdldEF0dHJpYnV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBZTWFwLnByb3RvdHlwZS5nZXQuY2FsbCh0aGlzLHQpfX0se2tleTpcImdldEF0dHJpYnV0ZXNcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXt9LGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPVV0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTtsLl9kZWxldGVkfHwodFtzXT1sLl9jb250ZW50WzBdKX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOmRvY3VtZW50LGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LG49YXJndW1lbnRzWzJdLHI9dC5jcmVhdGVFbGVtZW50KHRoaXMubm9kZU5hbWUpLGk9dGhpcy5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBvIGluIGkpci5zZXRBdHRyaWJ1dGUobyxpW29dKTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe3IuYXBwZW5kQ2hpbGQoaS50b0RvbSh0LGUsbikpfSksUihuLHIsdGhpcykscn19XSksWVhtbEVsZW1lbnR9KFlYbWxGcmFnbWVudCk7WVhtbEZyYWdtZW50Ll9ZWG1sRWxlbWVudD1ZWG1sRWxlbWVudDt2YXIgWVhtbFRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbFRleHQoKXtyZXR1cm4gYnQodGhpcyxZWG1sVGV4dCksRXQodGhpcywoWVhtbFRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBPdChZWG1sVGV4dCx0KSx3dChZWG1sVGV4dCxbe2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06ZG9jdW1lbnQsZT1hcmd1bWVudHNbMl0sbj10LmNyZWF0ZVRleHROb2RlKHRoaXMudG9TdHJpbmcoKSk7cmV0dXJuIFIoZSxuLHRoaXMpLG59fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtTdChZWG1sVGV4dC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pfX1dKSxZWG1sVGV4dH0oWVRleHQpLEp0PW5ldyBNYXAsV3Q9bmV3IE1hcDtxKDAsSXRlbUpTT04pLHEoMSxJdGVtU3RyaW5nKSxxKDEwLE10KSxxKDExLEN0KSxxKDIsRGVsZXRlKSxxKDMsWUFycmF5KSxxKDQsWU1hcCkscSg1LFlUZXh0KSxxKDYsWVhtbEZyYWdtZW50KSxxKDcsWVhtbEVsZW1lbnQpLHEoOCxZWG1sVGV4dCkscSg5LFlYbWxIb29rKSxxKDEyLHh0KTt2YXIgWXQ9MTY3NzcyMTUsenQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7YnQodGhpcyx0KSx0aGlzLnVzZXI9WXQsdGhpcy5uYW1lPWUsdGhpcy50eXBlPSQobil9cmV0dXJuIHd0KHQsW3trZXk6XCJlcXVhbHNcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQudXNlcj09PXRoaXMudXNlciYmdC5uYW1lPT09dGhpcy5uYW1lJiZ0LnR5cGU9PT10aGlzLnR5cGV9fSx7a2V5OlwibGVzc1RoYW5cIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5jb25zdHJ1Y3RvciE9PXR8fCh0aGlzLnVzZXI8ZS51c2VyfHx0aGlzLnVzZXI9PT1lLnVzZXImJih0aGlzLm5hbWU8ZS5uYW1lfHx0aGlzLm5hbWU9PT1lLm5hbWUmJnRoaXMudHlwZTxlLnR5cGUpKX19XSksdH0oKSxYdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQpe2J0KHRoaXMsZSk7dmFyIG49RXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIG4ueT10LG59cmV0dXJuIE90KGUsdCksd3QoZSxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXTt0aGlzLml0ZXJhdGUobnVsbCxudWxsLGZ1bmN0aW9uKGUpe2UuY29uc3RydWN0b3I9PT14dD90LnB1c2goe2lkOnAoZSksY29udGVudDplLl9sZW5ndGgsZGVsZXRlZDpcIkdDXCJ9KTp0LnB1c2goe2lkOnAoZSksb3JpZ2luOnAobnVsbD09PWUuX29yaWdpbj9udWxsOmUuX29yaWdpbi5fbGFzdElkKSxsZWZ0OnAobnVsbD09PWUuX2xlZnQ/bnVsbDplLl9sZWZ0Ll9sYXN0SWQpLHJpZ2h0OnAoZS5fcmlnaHQpLHJpZ2h0X29yaWdpbjpwKGUuX3JpZ2h0X29yaWdpbikscGFyZW50OnAoZS5fcGFyZW50KSxwYXJlbnRTdWI6ZS5fcGFyZW50U3ViLGRlbGV0ZWQ6ZS5fZGVsZXRlZCxjb250ZW50OkpTT04uc3RyaW5naWZ5KGUuX2NvbnRlbnQpfSl9KSxjb25zb2xlLnRhYmxlKHQpfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZCh0KTtpZihudWxsPT09ZSYmdCBpbnN0YW5jZW9mIHp0KXt2YXIgbj1GKHQudHlwZSkscj10aGlzLnk7ZT1uZXcgbixlLl9pZD10LGUuX3BhcmVudD1yLHIudHJhbnNhY3QoZnVuY3Rpb24oKXtlLl9pbnRlZ3JhdGUocil9KSx0aGlzLnB1dChlKX1yZXR1cm4gZX19LHtrZXk6XCJnZXRJdGVtXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQodCk7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7dmFyIG49ZS5faWQ7cmV0dXJuIHQudXNlcj09PW4udXNlciYmdC5jbG9jazxuLmNsb2NrK2UuX2xlbmd0aD9lOm51bGx9fSx7a2V5OlwiZ2V0SXRlbUNsZWFuU3RhcnRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2s9PT10LmNsb2NrP2U6ZS5fc3BsaXRBdCh0aGlzLnksdC5jbG9jay1uLmNsb2NrKX19LHtrZXk6XCJnZXRJdGVtQ2xlYW5FbmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2srZS5fbGVuZ3RoLTE9PT10LmNsb2NrP2U6KGUuX3NwbGl0QXQodGhpcy55LHQuY2xvY2stbi5jbG9jaysxKSxlKX19XSksZX0oVHQpLHF0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtidCh0aGlzLHQpLHRoaXMueT1lLHRoaXMuc3RhdGU9bmV3IE1hcH1yZXR1cm4gd3QodCxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuc3RhdGVbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7dmFyIGE9VXQoaS52YWx1ZSwyKSxzPWFbMF0sbD1hWzFdO3QucHVzaCh7dXNlcjpzLHN0YXRlOmx9KX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1jb25zb2xlLnRhYmxlKHQpfX0se2tleTpcImdldE5leHRJRFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMueS51c2VySUQsbj10aGlzLmdldFN0YXRlKGUpO3JldHVybiB0aGlzLnNldFN0YXRlKGUsbit0KSxuZXcgQXQoZSxuKX19LHtrZXk6XCJ1cGRhdGVSZW1vdGVTdGF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT10Ll9pZC51c2VyLG49dGhpcy5zdGF0ZS5nZXQoZSk7bnVsbCE9PXQmJnQuX2lkLmNsb2NrPT09bjspbis9dC5fbGVuZ3RoLHQ9dGhpcy55Lm9zLmdldChuZXcgQXQoZSxuKSk7dGhpcy5zdGF0ZS5zZXQoZSxuKX19LHtrZXk6XCJnZXRTdGF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuc3RhdGUuZ2V0KHQpO3JldHVybiBudWxsPT1lPzA6ZX19LHtrZXk6XCJzZXRTdGF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55Ll90cmFuc2FjdGlvbi5iZWZvcmVTdGF0ZTtuLmhhcyh0KXx8bi5zZXQodCx0aGlzLmdldFN0YXRlKHQpKSx0aGlzLnN0YXRlLnNldCh0LGUpfX1dKSx0fSgpLEZ0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe2J0KHRoaXMsdCksdGhpcy5fZXZlbnRMaXN0ZW5lcj1uZXcgTWFwLHRoaXMuX3N0YXRlTGlzdGVuZXI9bmV3IE1hcH1yZXR1cm4gd3QodCxbe1xua2V5OlwiX2dldExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7cmV0dXJuIHZvaWQgMD09PWUmJihlPXtvbmNlOm5ldyBTZXQsb246bmV3IFNldH0sdGhpcy5fZXZlbnRMaXN0ZW5lci5zZXQodCxlKSksZX19LHtrZXk6XCJvbmNlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLl9nZXRMaXN0ZW5lcih0KS5vbmNlLmFkZChlKX19LHtrZXk6XCJvblwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5fZ2V0TGlzdGVuZXIodCkub24uYWRkKGUpfX0se2tleTpcIl9pbml0U3RhdGVMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX3N0YXRlTGlzdGVuZXIuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1lJiYoZT17fSxlLnByb21pc2U9bmV3IFByb21pc2UoZnVuY3Rpb24odCl7ZS5yZXNvbHZlPXR9KSx0aGlzLl9zdGF0ZUxpc3RlbmVyLnNldCh0LGUpKSxlfX0se2tleTpcIndoZW5cIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5faW5pdFN0YXRlTGlzdGVuZXIodCkucHJvbWlzZX19LHtrZXk6XCJvZmZcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKG51bGw9PXR8fG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSBldmVudCBuYW1lIGFuZCBmdW5jdGlvbiFcIik7dmFyIG49dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09biYmKG4ub24uZGVsZXRlKGUpLG4ub25jZS5kZWxldGUoZSkpfX0se2tleTpcImVtaXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9YXJndW1lbnRzLmxlbmd0aCxuPUFycmF5KGU+MT9lLTE6MCkscj0xO3I8ZTtyKyspbltyLTFdPWFyZ3VtZW50c1tyXTt0aGlzLl9pbml0U3RhdGVMaXN0ZW5lcih0KS5yZXNvbHZlKCk7dmFyIGk9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09aT8oaS5vbi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiB0LmFwcGx5KG51bGwsbil9KSxpLm9uY2UuZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gdC5hcHBseShudWxsLG4pfSksaS5vbmNlPW5ldyBTZXQpOlwiZXJyb3JcIj09PXQmJmNvbnNvbGUuZXJyb3IoblswXSl9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fZXZlbnRMaXN0ZW5lcj1udWxsfX1dKSx0fSgpLCR0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe2J0KHRoaXMsdCksdGhpcy50eXBlPWUsdGhpcy50YXJnZXQ9bix0aGlzLl9tdXR1YWxFeGNsdWRlPVooKX1yZXR1cm4gd3QodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZT1udWxsLHRoaXMudGFyZ2V0PW51bGx9fV0pLHR9KCksR3Q9bnVsbCxadD1udWxsLFF0PXZvaWQgMDtRdD1cInVuZGVmaW5lZFwiIT10eXBlb2YgZ2V0U2VsZWN0aW9uP2Z1bmN0aW9uKHQsZSxuLHIpe2lmKHIpe1p0PXtmcm9tOm51bGwsdG86bnVsbCxmcm9tWTpudWxsLHRvWTpudWxsfSxHdD1nZXRTZWxlY3Rpb24oKTt2YXIgaT1HdC5hbmNob3JOb2RlLG89ZS5kb21Ub1R5cGUuZ2V0KGkpO251bGwhPT1pJiZ2b2lkIDAhPT1vJiYoWnQuZnJvbT1RKG8sR3QuYW5jaG9yT2Zmc2V0KSxadC5mcm9tWT1vLl95KTt2YXIgYT1HdC5mb2N1c05vZGUscz1lLmRvbVRvVHlwZS5nZXQoYSk7bnVsbCE9PWEmJnZvaWQgMCE9PXMmJihadC50bz1RKHMsR3QuZm9jdXNPZmZzZXQpLFp0LnRvWT1zLl95KX19OmZ1bmN0aW9uKCl7fTt2YXIgS3Q9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0LG4pe3ZhciByPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fTtidCh0aGlzLGUpO3ZhciBpPUV0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtpLm9wdHM9cixyLmRvY3VtZW50PXIuZG9jdW1lbnR8fGRvY3VtZW50LHIuaG9va3M9ci5ob29rc3x8e30saS5zY3JvbGxpbmdFbGVtZW50PXIuc2Nyb2xsaW5nRWxlbWVudHx8bnVsbCxpLmRvbVRvVHlwZT1uZXcgTWFwLGkudHlwZVRvRG9tPW5ldyBNYXAsaS5maWx0ZXI9ci5maWx0ZXJ8fEksbi5pbm5lckhUTUw9XCJcIix0LmZvckVhY2goZnVuY3Rpb24odCl7bi5pbnNlcnRCZWZvcmUodC50b0RvbShyLmRvY3VtZW50LHIuaG9va3MsaSksbnVsbCl9KSxpLl90eXBlT2JzZXJ2ZXI9cnQuYmluZChpKSxpLl9kb21PYnNlcnZlcj1mdW5jdGlvbih0KXthdC5jYWxsKGksdCxyLmRvY3VtZW50KX0sdC5vYnNlcnZlRGVlcChpLl90eXBlT2JzZXJ2ZXIpLGkuX211dGF0aW9uT2JzZXJ2ZXI9bmV3IE11dGF0aW9uT2JzZXJ2ZXIoaS5fZG9tT2JzZXJ2ZXIpLGkuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShuLHtjaGlsZExpc3Q6ITAsYXR0cmlidXRlczohMCxjaGFyYWN0ZXJEYXRhOiEwLHN1YnRyZWU6ITB9KTt2YXIgbz10Ll95O3JldHVybiBpLl9iZWZvcmVUcmFuc2FjdGlvbkhhbmRsZXI9ZnVuY3Rpb24odCxlLG4pe2kuX2RvbU9ic2VydmVyKGkuX211dGF0aW9uT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSksUXQodCxpLGUsbil9LG8ub24oXCJiZWZvcmVUcmFuc2FjdGlvblwiLGkuX2JlZm9yZVRyYW5zYWN0aW9uSGFuZGxlciksaS5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXI9ZnVuY3Rpb24odCxlLG4pe3R0KHQsaSxlLG4pLGUuZGVsZXRlZFN0cnVjdHMuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgZT1pLnR5cGVUb0RvbS5nZXQodCk7dm9pZCAwIT09ZSYmTShpLGUsdCl9KX0sby5vbihcImFmdGVyVHJhbnNhY3Rpb25cIixpLl9hZnRlclRyYW5zYWN0aW9uSGFuZGxlciksaS5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXI9ZnVuY3Rpb24odCxlKXtlLmNoYW5nZWRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKGUsbil7KGUuc2l6ZT4xfHwxPT09ZS5zaXplJiYhMT09PWUuaGFzKG51bGwpKSYmVih0LGksbil9KSxlLm5ld1R5cGVzLmZvckVhY2goZnVuY3Rpb24oZSl7Vih0LGksZSl9KX0sby5vbihcImJlZm9yZU9ic2VydmVyQ2FsbHNcIixpLl9iZWZvcmVPYnNlcnZlckNhbGxzSGFuZGxlciksUihpLG4sdCksaX1yZXR1cm4gT3QoZSx0KSx3dChlLFt7a2V5Olwic2V0RmlsdGVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5maWx0ZXI9dH19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmRvbVRvVHlwZT1udWxsLHRoaXMudHlwZVRvRG9tPW51bGwsdGhpcy50eXBlLnVub2JzZXJ2ZURlZXAodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKTt2YXIgdD10aGlzLnR5cGUuX3k7dC5vZmYoXCJiZWZvcmVUcmFuc2FjdGlvblwiLHRoaXMuX2JlZm9yZVRyYW5zYWN0aW9uSGFuZGxlciksdC5vZmYoXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsdGhpcy5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXIpLHQub2ZmKFwiYWZ0ZXJUcmFuc2FjdGlvblwiLHRoaXMuX2FmdGVyVHJhbnNhY3Rpb25IYW5kbGVyKSxTdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0oJHQpLFk9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWSh0LGUsbil7dmFyIHI9YXJndW1lbnRzLmxlbmd0aD4zJiZ2b2lkIDAhPT1hcmd1bWVudHNbM10/YXJndW1lbnRzWzNdOnt9O2J0KHRoaXMsWSk7dmFyIGk9RXQodGhpcywoWS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZKSkuY2FsbCh0aGlzKSk7aS5nY0VuYWJsZWQ9ci5nY3x8ITEsaS5yb29tPXQsbnVsbCE9ZSYmKGUuY29ubmVjdG9yLnJvb209dCksaS5fY29udGVudFJlYWR5PSExLGkuX29wdHM9ZSxcIm51bWJlclwiIT10eXBlb2YgZS51c2VySUQ/aS51c2VySUQ9RygpOmkudXNlcklEPWUudXNlcklELGkuc2hhcmU9e30saS5kcz1uZXcgUHQoaSksaS5vcz1uZXcgWHQoaSksaS5zcz1uZXcgcXQoaSksaS5fbWlzc2luZ1N0cnVjdHM9bmV3IE1hcCxpLl9yZWFkeVRvSW50ZWdyYXRlPVtdLGkuX3RyYW5zYWN0aW9uPW51bGwsaS5jb25uZWN0b3I9bnVsbCxpLmNvbm5lY3RlZD0hMTt2YXIgbz1mdW5jdGlvbigpe251bGwhPWUmJihpLmNvbm5lY3Rvcj1uZXcgWVtlLmNvbm5lY3Rvci5uYW1lXShpLGUuY29ubmVjdG9yKSxpLmNvbm5lY3RlZD0hMCxpLmVtaXQoXCJjb25uZWN0b3JSZWFkeVwiKSl9O3JldHVybiBpLnBlcnNpc3RlbmNlPW51bGwsbnVsbCE9bj8oaS5wZXJzaXN0ZW5jZT1uLG4uX2luaXQoaSkudGhlbihvKSk6bygpLGkuX3BhcmVudD1udWxsLGkuX2hhc1VuZG9NYW5hZ2VyPSExLGl9cmV0dXJuIE90KFksdCksd3QoWSxbe2tleTpcIl9zZXRDb250ZW50UmVhZHlcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX2NvbnRlbnRSZWFkeXx8KHRoaXMuX2NvbnRlbnRSZWFkeT0hMCx0aGlzLmVtaXQoXCJjb250ZW50XCIpKX19LHtrZXk6XCJ3aGVuQ29udGVudFJlYWR5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO3JldHVybiB0aGlzLl9jb250ZW50UmVhZHk/UHJvbWlzZS5yZXNvbHZlKCk6bmV3IFByb21pc2UoZnVuY3Rpb24oZSl7dC5vbmNlKFwiY29udGVudFwiLGUpfSl9fSx7a2V5OlwiX2JlZm9yZUNoYW5nZVwiLHZhbHVlOmZ1bmN0aW9uKCl7fX0se2tleTpcInRyYW5zYWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0mJmFyZ3VtZW50c1sxXSxuPW51bGw9PT10aGlzLl90cmFuc2FjdGlvbjtuJiYodGhpcy5fdHJhbnNhY3Rpb249bmV3IFZ0KHRoaXMpLHRoaXMuZW1pdChcImJlZm9yZVRyYW5zYWN0aW9uXCIsdGhpcyx0aGlzLl90cmFuc2FjdGlvbixlKSk7dHJ5e3QodGhpcyl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX1pZihuKXt0aGlzLmVtaXQoXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsdGhpcyx0aGlzLl90cmFuc2FjdGlvbixlKTt2YXIgcj10aGlzLl90cmFuc2FjdGlvbjt0aGlzLl90cmFuc2FjdGlvbj1udWxsLHIuY2hhbmdlZFR5cGVzLmZvckVhY2goZnVuY3Rpb24odCxuKXtuLl9kZWxldGVkfHxuLl9jYWxsT2JzZXJ2ZXIocix0LGUpfSksci5jaGFuZ2VkUGFyZW50VHlwZXMuZm9yRWFjaChmdW5jdGlvbih0LGUpe2UuX2RlbGV0ZWR8fCh0PXQuZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiF0LnRhcmdldC5fZGVsZXRlZH0pLHQuZm9yRWFjaChmdW5jdGlvbih0KXt0LmN1cnJlbnRUYXJnZXQ9ZX0pLGUuX2RlZXBFdmVudEhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKHIsdCkpfSksdGhpcy5lbWl0KFwiYWZ0ZXJUcmFuc2FjdGlvblwiLHRoaXMscixlKX19fSx7a2V5OlwiZGVmaW5lXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1uZXcgenQodCxlKSxyPXRoaXMub3MuZ2V0KG4pO2lmKHZvaWQgMD09PXRoaXMuc2hhcmVbdF0pdGhpcy5zaGFyZVt0XT1yO2Vsc2UgaWYodGhpcy5zaGFyZVt0XSE9PXIpdGhyb3cgbmV3IEVycm9yKFwiVHlwZSBpcyBhbHJlYWR5IGRlZmluZWQgd2l0aCBhIGRpZmZlcmVudCBjb25zdHJ1Y3RvclwiKTtyZXR1cm4gcn19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5zaGFyZVt0XX19LHtrZXk6XCJkaXNjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb25uZWN0ZWQ/KHRoaXMuY29ubmVjdGVkPSExLHRoaXMuY29ubmVjdG9yLmRpc2Nvbm5lY3QoKSk6UHJvbWlzZS5yZXNvbHZlKCl9fSx7a2V5OlwicmVjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb25uZWN0ZWQ/UHJvbWlzZS5yZXNvbHZlKCk6KHRoaXMuY29ubmVjdGVkPSEwLHRoaXMuY29ubmVjdG9yLnJlY29ubmVjdCgpKX19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXtTdChZLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKSx0aGlzLnNoYXJlPW51bGwsbnVsbCE9dGhpcy5jb25uZWN0b3ImJihudWxsIT10aGlzLmNvbm5lY3Rvci5kZXN0cm95P3RoaXMuY29ubmVjdG9yLmRlc3Ryb3koKTp0aGlzLmNvbm5lY3Rvci5kaXNjb25uZWN0KCkpLG51bGwhPT10aGlzLnBlcnNpc3RlbmNlJiYodGhpcy5wZXJzaXN0ZW5jZS5kZWluaXQodGhpcyksdGhpcy5wZXJzaXN0ZW5jZT1udWxsKSx0aGlzLm9zPW51bGwsdGhpcy5kcz1udWxsLHRoaXMuc3M9bnVsbH19LHtrZXk6XCJfc3RhcnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uKHQpe3JldHVybiBudWxsfX1dKSxZfShGdCk7WS5leHRlbmQ9ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MDt0PGFyZ3VtZW50cy5sZW5ndGg7dCsrKXt2YXIgZT1hcmd1bWVudHNbdF07aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgZSl0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIGZ1bmN0aW9uIVwiKTtlKFkpfX07dmFyIHRlPWZ1bmN0aW9uIHQoZSxuKXtidCh0aGlzLHQpLHRoaXMuY3JlYXRlZD1uZXcgRGF0ZTt2YXIgcj1uLmJlZm9yZVN0YXRlO3IuaGFzKGUudXNlcklEKT8odGhpcy50b1N0YXRlPW5ldyBBdChlLnVzZXJJRCxlLnNzLmdldFN0YXRlKGUudXNlcklEKS0xKSx0aGlzLmZyb21TdGF0ZT1uZXcgQXQoZS51c2VySUQsci5nZXQoZS51c2VySUQpKSk6KHRoaXMudG9TdGF0ZT1udWxsLHRoaXMuZnJvbVN0YXRlPW51bGwpLHRoaXMuZGVsZXRlZFN0cnVjdHM9bi5kZWxldGVkU3RydWN0c30sZWU9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e307YnQodGhpcyx0KSx0aGlzLm9wdGlvbnM9cixyLmNhcHR1cmVUaW1lb3V0PW51bGw9PXIuY2FwdHVyZVRpbWVvdXQ/NTAwOnIuY2FwdHVyZVRpbWVvdXQsdGhpcy5fdW5kb0J1ZmZlcj1bXSx0aGlzLl9yZWRvQnVmZmVyPVtdLHRoaXMuX3Njb3BlPWUsdGhpcy5fdW5kb2luZz0hMSx0aGlzLl9yZWRvaW5nPSExLHRoaXMuX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITE7dmFyIGk9ZS5feTt0aGlzLnk9aSxpLl9oYXNVbmRvTWFuYWdlcj0hMCxpLm9uKFwiYWZ0ZXJUcmFuc2FjdGlvblwiLGZ1bmN0aW9uKHQsaSxvKXtpZighbyYmaS5jaGFuZ2VkUGFyZW50VHlwZXMuaGFzKGUpKXt2YXIgYT1uZXcgdGUodCxpKTtpZihuLl91bmRvaW5nKW4uX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITAsbi5fcmVkb0J1ZmZlci5wdXNoKGEpO2Vsc2V7dmFyIHM9bi5fdW5kb0J1ZmZlci5sZW5ndGg+MD9uLl91bmRvQnVmZmVyW24uX3VuZG9CdWZmZXIubGVuZ3RoLTFdOm51bGw7ITE9PT1uLl9yZWRvaW5nJiYhMT09PW4uX2xhc3RUcmFuc2FjdGlvbldhc1VuZG8mJm51bGwhPT1zJiZhLmNyZWF0ZWQtcy5jcmVhdGVkPD1yLmNhcHR1cmVUaW1lb3V0PyhzLmNyZWF0ZWQ9YS5jcmVhdGVkLG51bGwhPT1hLnRvU3RhdGUmJihzLnRvU3RhdGU9YS50b1N0YXRlLG51bGw9PT1zLmZyb21TdGF0ZSYmKHMuZnJvbVN0YXRlPWEuZnJvbVN0YXRlKSksYS5kZWxldGVkU3RydWN0cy5mb3JFYWNoKHMuZGVsZXRlZFN0cnVjdHMuYWRkLHMuZGVsZXRlZFN0cnVjdHMpKToobi5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMSxuLl91bmRvQnVmZmVyLnB1c2goYSkpLG4uX3JlZG9pbmd8fChuLl9yZWRvQnVmZmVyPVtdKX19fSl9cmV0dXJuIHd0KHQsW3trZXk6XCJ1bmRvXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl91bmRvaW5nPSEwO3ZhciB0PXN0KHRoaXMueSx0aGlzLl9zY29wZSx0aGlzLl91bmRvQnVmZmVyKTtyZXR1cm4gdGhpcy5fdW5kb2luZz0hMSx0fX0se2tleTpcInJlZG9cIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX3JlZG9pbmc9ITA7dmFyIHQ9c3QodGhpcy55LHRoaXMuX3Njb3BlLHRoaXMuX3JlZG9CdWZmZXIpO3JldHVybiB0aGlzLl9yZWRvaW5nPSExLHR9fV0pLHR9KCksbmU9MWUzLHJlPTYwKm5lLGllPTYwKnJlLG9lPTI0KmllLGFlPTM2NS4yNSpvZSxzZT1mdW5jdGlvbih0LGUpe2U9ZXx8e307dmFyIG49dm9pZCAwPT09dD9cInVuZGVmaW5lZFwiOmt0KHQpO2lmKFwic3RyaW5nXCI9PT1uJiZ0Lmxlbmd0aD4wKXJldHVybiB1dCh0KTtpZihcIm51bWJlclwiPT09biYmITE9PT1pc05hTih0KSlyZXR1cm4gZS5sb25nP2h0KHQpOmN0KHQpO3Rocm93IG5ldyBFcnJvcihcInZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgdmFsaWQgbnVtYmVyLiB2YWw9XCIrSlNPTi5zdHJpbmdpZnkodCkpfSxsZT1sdChmdW5jdGlvbih0LGUpe2Z1bmN0aW9uIG4odCl7dmFyIG4scj0wO2ZvcihuIGluIHQpcj0ocjw8NSktcit0LmNoYXJDb2RlQXQobikscnw9MDtyZXR1cm4gZS5jb2xvcnNbTWF0aC5hYnMociklZS5jb2xvcnMubGVuZ3RoXX1mdW5jdGlvbiByKHQpe2Z1bmN0aW9uIHIoKXtpZihyLmVuYWJsZWQpe3ZhciB0PXIsbj0rbmV3IERhdGUsaT1uLShsfHxuKTt0LmRpZmY9aSx0LnByZXY9bCx0LmN1cnI9bixsPW47Zm9yKHZhciBvPW5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKSxhPTA7YTxvLmxlbmd0aDthKyspb1thXT1hcmd1bWVudHNbYV07b1swXT1lLmNvZXJjZShvWzBdKSxcInN0cmluZ1wiIT10eXBlb2Ygb1swXSYmby51bnNoaWZ0KFwiJU9cIik7dmFyIHM9MDtvWzBdPW9bMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csZnVuY3Rpb24obixyKXtpZihcIiUlXCI9PT1uKXJldHVybiBuO3MrKzt2YXIgaT1lLmZvcm1hdHRlcnNbcl07aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgaSl7dmFyIGE9b1tzXTtuPWkuY2FsbCh0LGEpLG8uc3BsaWNlKHMsMSkscy0tfXJldHVybiBufSksZS5mb3JtYXRBcmdzLmNhbGwodCxvKTsoci5sb2d8fGUubG9nfHxjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpKS5hcHBseSh0LG8pfX1yZXR1cm4gci5uYW1lc3BhY2U9dCxyLmVuYWJsZWQ9ZS5lbmFibGVkKHQpLHIudXNlQ29sb3JzPWUudXNlQ29sb3JzKCksci5jb2xvcj1uKHQpLFwiZnVuY3Rpb25cIj09dHlwZW9mIGUuaW5pdCYmZS5pbml0KHIpLHJ9ZnVuY3Rpb24gaSh0KXtlLnNhdmUodCksZS5uYW1lcz1bXSxlLnNraXBzPVtdO2Zvcih2YXIgbj0oXCJzdHJpbmdcIj09dHlwZW9mIHQ/dDpcIlwiKS5zcGxpdCgvW1xccyxdKy8pLHI9bi5sZW5ndGgsaT0wO2k8cjtpKyspbltpXSYmKHQ9bltpXS5yZXBsYWNlKC9cXCovZyxcIi4qP1wiKSxcIi1cIj09PXRbMF0/ZS5za2lwcy5wdXNoKG5ldyBSZWdFeHAoXCJeXCIrdC5zdWJzdHIoMSkrXCIkXCIpKTplLm5hbWVzLnB1c2gobmV3IFJlZ0V4cChcIl5cIit0K1wiJFwiKSkpfWZ1bmN0aW9uIG8oKXtlLmVuYWJsZShcIlwiKX1mdW5jdGlvbiBhKHQpe3ZhciBuLHI7Zm9yKG49MCxyPWUuc2tpcHMubGVuZ3RoO248cjtuKyspaWYoZS5za2lwc1tuXS50ZXN0KHQpKXJldHVybiExO2ZvcihuPTAscj1lLm5hbWVzLmxlbmd0aDtuPHI7bisrKWlmKGUubmFtZXNbbl0udGVzdCh0KSlyZXR1cm4hMDtyZXR1cm4hMX1mdW5jdGlvbiBzKHQpe3JldHVybiB0IGluc3RhbmNlb2YgRXJyb3I/dC5zdGFja3x8dC5tZXNzYWdlOnR9ZT10LmV4cG9ydHM9ci5kZWJ1Zz1yLmRlZmF1bHQ9cixlLmNvZXJjZT1zLGUuZGlzYWJsZT1vLGUuZW5hYmxlPWksZS5lbmFibGVkPWEsZS5odW1hbml6ZT1zZSxlLm5hbWVzPVtdLGUuc2tpcHM9W10sZS5mb3JtYXR0ZXJzPXt9O3ZhciBsfSksdWU9KGxlLmNvZXJjZSxsZS5kaXNhYmxlLGxlLmVuYWJsZSxsZS5lbmFibGVkLGxlLmh1bWFuaXplLGxlLm5hbWVzLGxlLnNraXBzLGxlLmZvcm1hdHRlcnMsbHQoZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7cmV0dXJuIShcInVuZGVmaW5lZFwiPT10eXBlb2Ygd2luZG93fHwhd2luZG93LnByb2Nlc3N8fFwicmVuZGVyZXJcIiE9PXdpbmRvdy5wcm9jZXNzLnR5cGUpfHwoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGRvY3VtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2V8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3cmJndpbmRvdy5jb25zb2xlJiYod2luZG93LmNvbnNvbGUuZmlyZWJ1Z3x8d2luZG93LmNvbnNvbGUuZXhjZXB0aW9uJiZ3aW5kb3cuY29uc29sZS50YWJsZSl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQmJm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pJiZwYXJzZUludChSZWdFeHAuJDEsMTApPj0zMXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmbmF2aWdhdG9yLnVzZXJBZ2VudCYmbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKX1mdW5jdGlvbiByKHQpe3ZhciBuPXRoaXMudXNlQ29sb3JzO2lmKHRbMF09KG4/XCIlY1wiOlwiXCIpK3RoaXMubmFtZXNwYWNlKyhuP1wiICVjXCI6XCIgXCIpK3RbMF0rKG4/XCIlYyBcIjpcIiBcIikrXCIrXCIrZS5odW1hbml6ZSh0aGlzLmRpZmYpLG4pe3ZhciByPVwiY29sb3I6IFwiK3RoaXMuY29sb3I7dC5zcGxpY2UoMSwwLHIsXCJjb2xvcjogaW5oZXJpdFwiKTt2YXIgaT0wLG89MDt0WzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZyxmdW5jdGlvbih0KXtcIiUlXCIhPT10JiYoaSsrLFwiJWNcIj09PXQmJihvPWkpKX0pLHQuc3BsaWNlKG8sMCxyKX19ZnVuY3Rpb24gaSgpe3JldHVyblwib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIGNvbnNvbGU/XCJ1bmRlZmluZWRcIjprdChjb25zb2xlKSkmJmNvbnNvbGUubG9nJiZGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZyxjb25zb2xlLGFyZ3VtZW50cyl9ZnVuY3Rpb24gbyh0KXt0cnl7bnVsbD09dD9lLnN0b3JhZ2UucmVtb3ZlSXRlbShcImRlYnVnXCIpOmUuc3RvcmFnZS5kZWJ1Zz10fWNhdGNoKHQpe319ZnVuY3Rpb24gYSgpe3ZhciB0O3RyeXt0PWUuc3RvcmFnZS5kZWJ1Z31jYXRjaCh0KXt9cmV0dXJuIXQmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBwcm9jZXNzJiZcImVudlwiaW4gcHJvY2VzcyYmKHQ9cHJvY2Vzcy5lbnYuREVCVUcpLHR9ZT10LmV4cG9ydHM9bGUsZS5sb2c9aSxlLmZvcm1hdEFyZ3M9cixlLnNhdmU9byxlLmxvYWQ9YSxlLnVzZUNvbG9ycz1uLGUuc3RvcmFnZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgY2hyb21lJiZ2b2lkIDAhPT1jaHJvbWUuc3RvcmFnZT9jaHJvbWUuc3RvcmFnZS5sb2NhbDpmdW5jdGlvbigpe3RyeXtyZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZX1jYXRjaCh0KXt9fSgpLGUuY29sb3JzPVtcImxpZ2h0c2VhZ3JlZW5cIixcImZvcmVzdGdyZWVuXCIsXCJnb2xkZW5yb2RcIixcImRvZGdlcmJsdWVcIixcImRhcmtvcmNoaWRcIixcImNyaW1zb25cIl0sZS5mb3JtYXR0ZXJzLmo9ZnVuY3Rpb24odCl7dHJ5e3JldHVybiBKU09OLnN0cmluZ2lmeSh0KX1jYXRjaCh0KXtyZXR1cm5cIltVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiBcIit0Lm1lc3NhZ2V9fSxlLmVuYWJsZShhKCkpfSkpLGNlPSh1ZS5sb2csdWUuZm9ybWF0QXJncyx1ZS5zYXZlLHVlLmxvYWQsdWUudXNlQ29sb3JzLHVlLnN0b3JhZ2UsdWUuY29sb3JzLGZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe2lmKGJ0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5vcHRzPW4sbnVsbD09bi5yb2xlfHxcIm1hc3RlclwiPT09bi5yb2xlKXRoaXMucm9sZT1cIm1hc3RlclwiO2Vsc2V7aWYoXCJzbGF2ZVwiIT09bi5yb2xlKXRocm93IG5ldyBFcnJvcihcIlJvbGUgbXVzdCBiZSBlaXRoZXIgJ21hc3Rlcicgb3IgJ3NsYXZlJyFcIik7dGhpcy5yb2xlPVwic2xhdmVcIn10aGlzLmxvZz11ZShcInk6Y29ubmVjdG9yXCIpLHRoaXMubG9nTWVzc2FnZT11ZShcInk6Y29ubmVjdG9yLW1lc3NhZ2VcIiksdGhpcy5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzPW4uZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zfHwhMSx0aGlzLnJvbGU9bi5yb2xlLHRoaXMuY29ubmVjdGlvbnM9bmV3IE1hcCx0aGlzLmlzU3luY2VkPSExLHRoaXMudXNlckV2ZW50TGlzdGVuZXJzPVtdLHRoaXMud2hlblN5bmNlZExpc3RlbmVycz1bXSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy5kZWJ1Zz0hMD09PW4uZGVidWcsdGhpcy5icm9hZGNhc3RCdWZmZXI9bmV3IGp0LHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZT0wLHRoaXMucHJvdG9jb2xWZXJzaW9uPTExLHRoaXMuYXV0aEluZm89bi5hdXRofHxudWxsLHRoaXMuY2hlY2tBdXRoPW4uY2hlY2tBdXRofHxmdW5jdGlvbigpe3JldHVybiBQcm9taXNlLnJlc29sdmUoXCJ3cml0ZVwiKX0sbnVsbD09bi5tYXhCdWZmZXJMZW5ndGg/dGhpcy5tYXhCdWZmZXJMZW5ndGg9LTE6dGhpcy5tYXhCdWZmZXJMZW5ndGg9bi5tYXhCdWZmZXJMZW5ndGh9cmV0dXJuIHd0KHQsW3trZXk6XCJyZWNvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMubG9nKFwicmVjb25uZWN0aW5nLi5cIil9fSx7a2V5OlwiZGlzY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubG9nKFwiZGlzY3Jvbm5lY3RpbmcuLlwiKSx0aGlzLmNvbm5lY3Rpb25zPW5ldyBNYXAsdGhpcy5pc1N5bmNlZD0hMSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLFByb21pc2UucmVzb2x2ZSgpfX0se2tleTpcIm9uVXNlckV2ZW50XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJyZW1vdmVVc2VyRXZlbnRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMudXNlckV2ZW50TGlzdGVuZXJzPXRoaXMudXNlckV2ZW50TGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm4gdCE9PWV9KX19LHtrZXk6XCJ1c2VyTGVmdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXt0aGlzLmxvZyhcIiVzOiBVc2VyIGxlZnQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuZGVsZXRlKHQpLHRoaXMuX3NldFN5bmNlZFdpdGgobnVsbCk7dmFyIGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7KDAsaS52YWx1ZSkoe2FjdGlvbjpcInVzZXJMZWZ0XCIsdXNlcjp0fSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19fX19LHtrZXk6XCJ1c2VySm9pbmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe2lmKG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhXCIpO2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXRocm93IG5ldyBFcnJvcihcIlRoaXMgdXNlciBhbHJlYWR5IGpvaW5lZCFcIik7dGhpcy5sb2coXCIlczogVXNlciBqb2luZWQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuc2V0KHQse3VpZDp0LGlzU3luY2VkOiExLHJvbGU6ZSxwcm9jZXNzQWZ0ZXJBdXRoOltdLHByb2Nlc3NBZnRlclN5bmM6W10sYXV0aDpufHxudWxsLHJlY2VpdmVkU3luY1N0ZXAyOiExfSk7dmFyIHI9e307ci5wcm9taXNlPW5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3IucmVzb2x2ZT10fSksdGhpcy5jb25uZWN0aW9ucy5nZXQodCkuc3luY1N0ZXAyPXI7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7KDAscy52YWx1ZSkoe2FjdGlvbjpcInVzZXJKb2luZWRcIix1c2VyOnQscm9sZTplfSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19dGhpcy5fc3luY1dpdGhVc2VyKHQpfX0se2tleTpcIndoZW5TeW5jZWRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmlzU3luY2VkP3QoKTp0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJfc3luY1dpdGhVc2VyXCIsdmFsdWU6ZnVuY3Rpb24odCl7XCJzbGF2ZVwiIT09dGhpcy5yb2xlJiZ1KHRoaXMsdCl9fSx7a2V5OlwiX2ZpcmVJc1N5bmNlZExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKCl7aWYoIXRoaXMuaXNTeW5jZWQpe3RoaXMuaXNTeW5jZWQ9ITA7dmFyIHQ9ITAsZT0hMSxuPXZvaWQgMDt0cnl7Zm9yKHZhciByLGk9dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzW1N5bWJvbC5pdGVyYXRvcl0oKTshKHQ9KHI9aS5uZXh0KCkpLmRvbmUpO3Q9ITApeygwLHIudmFsdWUpKCl9fWNhdGNoKHQpe2U9ITAsbj10fWZpbmFsbHl7dHJ5eyF0JiZpLnJldHVybiYmaS5yZXR1cm4oKX1maW5hbGx5e2lmKGUpdGhyb3cgbn19dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLHRoaXMueS5fc2V0Q29udGVudFJlYWR5KCksdGhpcy55LmVtaXQoXCJzeW5jZWRcIil9fX0se2tleTpcInNlbmRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueTtpZighKGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlcyB0byBVc2VyJXM6IFNlbmQgJyV5J1wiLG4udXNlcklELHQsZSksdGhpcy5sb2dNZXNzYWdlKFwiVXNlciVzIHRvIFVzZXIlczogU2VuZCAlWVwiLG4udXNlcklELHQsW24sZV0pfX0se2tleTpcImJyb2FkY2FzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMueTtpZighKHQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8dCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlczogQnJvYWRjYXN0ICcleSdcIixlLnVzZXJJRCx0KSx0aGlzLmxvZ01lc3NhZ2UoXCJVc2VyJXM6IEJyb2FkY2FzdDogJVlcIixlLnVzZXJJRCxbZSx0XSl9fSx7a2V5OlwiYnJvYWRjYXN0U3RydWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPTA9PT10aGlzLmJyb2FkY2FzdEJ1ZmZlci5sZW5ndGg7aWYobiYmKHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVmFyU3RyaW5nKHRoaXMueS5yb29tKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlci53cml0ZVZhclN0cmluZyhcInVwZGF0ZVwiKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemU9MCx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3M9dGhpcy5icm9hZGNhc3RCdWZmZXIucG9zLHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVWludDMyKDApKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemUrKyx0Ll90b0JpbmFyeSh0aGlzLmJyb2FkY2FzdEJ1ZmZlciksdGhpcy5tYXhCdWZmZXJMZW5ndGg+MCYmdGhpcy5icm9hZGNhc3RCdWZmZXIubGVuZ3RoPnRoaXMubWF4QnVmZmVyTGVuZ3RoKXt2YXIgcj10aGlzLmJyb2FkY2FzdEJ1ZmZlcjtyLnNldFVpbnQzMih0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsdGhpcy5icm9hZGNhc3RCdWZmZXJTaXplKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlcj1uZXcganQsdGhpcy53aGVuUmVtb3RlUmVzcG9uc2l2ZSgpLnRoZW4oZnVuY3Rpb24oKXtlLmJyb2FkY2FzdChyLmNyZWF0ZUJ1ZmZlcigpKX0pfWVsc2UgbiYmc2V0VGltZW91dChmdW5jdGlvbigpe2lmKGUuYnJvYWRjYXN0QnVmZmVyLmxlbmd0aD4wKXt2YXIgdD1lLmJyb2FkY2FzdEJ1ZmZlcjt0LnNldFVpbnQzMihlLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsZS5icm9hZGNhc3RCdWZmZXJTaXplKSxlLmJyb2FkY2FzdCh0LmNyZWF0ZUJ1ZmZlcigpKSxlLmJyb2FkY2FzdEJ1ZmZlcj1uZXcganR9fSwwKX19LHtrZXk6XCJ3aGVuUmVtb3RlUmVzcG9uc2l2ZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3NldFRpbWVvdXQodCwxMDApfSl9fSx7a2V5OlwicmVjZWl2ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI9dGhpcyxpPXRoaXMueSxvPWkudXNlcklEO2lmKG49bnx8ITEsIShlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXJ8fGUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSlyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IVwiKSk7aWYodD09PW8pcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO3ZhciBhPW5ldyBOdChlKSxzPW5ldyBqdCxsPWEucmVhZFZhclN0cmluZygpO3Mud3JpdGVWYXJTdHJpbmcobCk7dmFyIHU9YS5yZWFkVmFyU3RyaW5nKCksYz10aGlzLmNvbm5lY3Rpb25zLmdldCh0KTtpZih0aGlzLmxvZyhcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAnJXMnXCIsbyx0LHUpLHRoaXMubG9nTWVzc2FnZShcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAlWVwiLG8sdCxbaSxlXSksbnVsbD09YyYmIW4pdGhyb3cgbmV3IEVycm9yKFwiUmVjZWl2ZWQgbWVzc2FnZSBmcm9tIHVua25vd24gcGVlciFcIik7aWYoXCJzeW5jIHN0ZXAgMVwiPT09dXx8XCJzeW5jIHN0ZXAgMlwiPT09dSl7dmFyIGg9YS5yZWFkVmFyVWludCgpO2lmKG51bGw9PWMuYXV0aClyZXR1cm4gYy5wcm9jZXNzQWZ0ZXJBdXRoLnB1c2goW3UsYyxhLHMsdF0pLHRoaXMuY2hlY2tBdXRoKGgsaSx0KS50aGVuKGZ1bmN0aW9uKHQpe251bGw9PWMuYXV0aCYmKGMuYXV0aD10LGkuZW1pdChcInVzZXJBdXRoZW50aWNhdGVkXCIse3VzZXI6Yy51aWQsYXV0aDp0fSkpO3ZhciBlPWMucHJvY2Vzc0FmdGVyQXV0aDtjLnByb2Nlc3NBZnRlckF1dGg9W10sZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiByLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX0pfSFuJiZudWxsPT1jLmF1dGh8fFwidXBkYXRlXCI9PT11JiYhYy5pc1N5bmNlZD9jLnByb2Nlc3NBZnRlclN5bmMucHVzaChbdSxjLGEscyx0LCExXSk6dGhpcy5jb21wdXRlTWVzc2FnZSh1LGMsYSxzLHQsbil9fSx7a2V5OlwiY29tcHV0ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbixpLG8sYSl7aWYoXCJzeW5jIHN0ZXAgMVwiIT09dHx8XCJ3cml0ZVwiIT09ZS5hdXRoJiZcInJlYWRcIiE9PWUuYXV0aCl7dmFyIHM9dGhpcy55O3MudHJhbnNhY3QoZnVuY3Rpb24oKXtpZihcInN5bmMgc3RlcCAyXCI9PT10JiZcIndyaXRlXCI9PT1lLmF1dGgpZChuLGkscyxlLG8pO2Vsc2V7aWYoXCJ1cGRhdGVcIiE9PXR8fCFhJiZcIndyaXRlXCIhPT1lLmF1dGgpdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJlY2VpdmUgbWVzc2FnZVwiKTtyKHMsbil9fSwhMCl9ZWxzZSBoKG4saSx0aGlzLnksZSxvKX19LHtrZXk6XCJfc2V0U3luY2VkV2l0aFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7aWYobnVsbCE9dCl7dmFyIG49dGhpcy5jb25uZWN0aW9ucy5nZXQodCk7bi5pc1N5bmNlZD0hMDt2YXIgcj1uLnByb2Nlc3NBZnRlclN5bmM7bi5wcm9jZXNzQWZ0ZXJTeW5jPVtdLHIuZm9yRWFjaChmdW5jdGlvbih0KXtlLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX12YXIgaT1BcnJheS5mcm9tKHRoaXMuY29ubmVjdGlvbnMudmFsdWVzKCkpO2kubGVuZ3RoPjAmJmkuZXZlcnkoZnVuY3Rpb24odCl7cmV0dXJuIHQuaXNTeW5jZWR9KSYmdGhpcy5fZmlyZUlzU3luY2VkTGlzdGVuZXJzKCl9fV0pLHR9KCkpLGhlPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtidCh0aGlzLHQpLHRoaXMub3B0cz1lLHRoaXMueXM9bmV3IE1hcH1yZXR1cm4gd3QodCxbe2tleTpcIl9pbml0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPXRoaXMueXMuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1uPyhuPXZ0KCksbi5tdXR1YWxFeGNsdWRlPVooKSx0aGlzLnlzLnNldCh0LG4pLHRoaXMuaW5pdCh0KS50aGVuKGZ1bmN0aW9uKCl7cmV0dXJuIHQub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxuKXt2YXIgcj1lLnlzLmdldCh0KTtpZihyLmxlbj4wKXtyLmJ1ZmZlci5zZXRVaW50MzIoMCxyLmxlbiksZS5zYXZlVXBkYXRlKHQsci5idWZmZXIuY3JlYXRlQnVmZmVyKCksbik7dmFyIGk9dnQoKTtmb3IodmFyIG8gaW4gaSlyW29dPWlbb119fSksZS5yZXRyaWV2ZSh0KX0pLnRoZW4oZnVuY3Rpb24oKXtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG4pfSkpOlByb21pc2UucmVzb2x2ZShuKX19LHtrZXk6XCJkZWluaXRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnlzLmRlbGV0ZSh0KSx0LnBlcnNpc3RlbmNlPW51bGx9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy55cz1udWxsfX0se2tleTpcInJlbW92ZVBlcnNpc3RlZERhdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49IShhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSl8fGFyZ3VtZW50c1sxXTt0aGlzLnlzLmZvckVhY2goZnVuY3Rpb24ocixpKXtpLnJvb209PT10JiYobj9pLmRlc3Ryb3koKTplLmRlaW5pdChpKSl9KX19LHtrZXk6XCJzYXZlVXBkYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7fX0se2tleTpcInNhdmVTdHJ1Y3RcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueXMuZ2V0KHQpO3ZvaWQgMCE9PW4mJm4ubXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UuX3RvQmluYXJ5KG4uYnVmZmVyKSxuLmxlbisrfSl9fSx7a2V5OlwicmV0cmlldmVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIGk9dGhpcy55cy5nZXQodCk7dm9pZCAwIT09aSYmaS5tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dC50cmFuc2FjdChmdW5jdGlvbigpe2lmKG51bGwhPWUmJmR0KHQsbmV3IE50KG5ldyBVaW50OEFycmF5KGUpKSksbnVsbCE9bilmb3IodmFyIGk9MDtpPG4ubGVuZ3RoO2krKylyKHQsbmV3IE50KG5ldyBVaW50OEFycmF5KG5baV0pKSl9KSx0LmVtaXQoXCJwZXJzaXN0ZW5jZVJlYWR5XCIpfSl9fSx7a2V5OlwicGVyc2lzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBfdCh0KS5jcmVhdGVCdWZmZXIoKX19XSksdH0oKSxmZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7YnQodGhpcyxlKTt2YXIgcj1FdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4udmFsdWU9dC50b1N0cmluZygpLHIuX3R5cGVPYnNlcnZlcj1wdC5iaW5kKHIpLHIuX2RvbU9ic2VydmVyPXl0LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIixyLl9kb21PYnNlcnZlcikscn1yZXR1cm4gT3QoZSx0KSx3dChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0LnVub2JzZXJ2ZSh0aGlzLl9kb21PYnNlcnZlciksU3QoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KCR0KSxkZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7YnQodGhpcyxlKTt2YXIgcj1FdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4uc2V0Q29udGVudHModC50b0RlbHRhKCksXCJ5anNcIiksci5fdHlwZU9ic2VydmVyPWd0LmJpbmQociksci5fcXVpbGxPYnNlcnZlcj1tdC5iaW5kKHIpLHQub2JzZXJ2ZShyLl90eXBlT2JzZXJ2ZXIpLG4ub24oXCJ0ZXh0LWNoYW5nZVwiLHIuX3F1aWxsT2JzZXJ2ZXIpLHJ9cmV0dXJuIE90KGUsdCksd3QoZSxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZS51bm9ic2VydmUodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLnRhcmdldC5vZmYoXCJ0ZXh0LWNoYW5nZVwiLHRoaXMuX3F1aWxsT2JzZXJ2ZXIpLFN0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfSgkdCk7cmV0dXJuIFkuQWJzdHJhY3RDb25uZWN0b3I9Y2UsWS5BYnN0cmFjdFBlcnNpc3RlbmNlPWhlLFkuQXJyYXk9WUFycmF5LFkuTWFwPVlNYXAsWS5UZXh0PVlUZXh0LFkuWG1sRWxlbWVudD1ZWG1sRWxlbWVudCxZLlhtbEZyYWdtZW50PVlYbWxGcmFnbWVudCxZLlhtbFRleHQ9WVhtbFRleHQsWS5YbWxIb29rPVlYbWxIb29rLFkuVGV4dGFyZWFCaW5kaW5nPWZlLFkuUXVpbGxCaW5kaW5nPWRlLFkuRG9tQmluZGluZz1LdCxLdC5kb21Ub1R5cGU9TCxLdC5kb21zVG9UeXBlcz1XLEt0LnN3aXRjaEFzc29jaWF0aW9uPUgsWS51dGlscz17QmluYXJ5RGVjb2RlcjpOdCxVbmRvTWFuYWdlcjplZSxnZXRSZWxhdGl2ZVBvc2l0aW9uOlEsZnJvbVJlbGF0aXZlUG9zaXRpb246SyxyZWdpc3RlclN0cnVjdDpxLGludGVncmF0ZVJlbW90ZVN0cnVjdHM6cix0b0JpbmFyeTpfdCxmcm9tQmluYXJ5OmR0fSxZLmRlYnVnPXVlLHVlLmZvcm1hdHRlcnMuWT1fLHVlLmZvcm1hdHRlcnMueT12LFl9KTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXkuanMubWFwXG4iLCJjb25zdCBZID0gcmVxdWlyZSgneWpzMicpO1xucmVxdWlyZSgneS1tZW1vcnknKShZKTtcbnJlcXVpcmUoJ3ktd2VicnRjMycpKFkpO1xucmVxdWlyZSgneS1hcnJheTInKShZKTtcbnJlcXVpcmUoJ3ktbWFwMicpKFkpO1xucmVxdWlyZSgneS10ZXh0MicpKFkpO1xucmVxdWlyZSgneS14bWwyJykoWSk7XG5cblkoe1xuICBkYjoge1xuICAgIG5hbWU6ICdtZW1vcnknXG4gIH0sXG4gIGNvbm5lY3Rvcjoge1xuICAgIG5hbWU6ICd3ZWJydGMnLFxuICAgIC8vbmFtZTogJ3dlYnNvY2tldHMtY2xpZW50JyxcbiAgICByb29tOiAncm9vbScsXG4gICAgdXJsOiAnaHR0cDovL2Zpbndpbi5pbzoxMjU2J1xuICB9LFxuICBzaGFyZToge1xuICAgIGNvZGVtaXJyb3I6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yMjogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3IzOiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjQ6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yNTogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I2OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjc6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yODogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I5OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjEwOiAnVGV4dCcsXG4gICAgeG1sOiAnWG1sJyxcbiAgICB4bWwyOiAnWG1sJyxcbiAgICB4bWwzOiAnWG1sJyxcbiAgICB4bWw0OiAnWG1sJyxcbiAgICB4bWw1OiAnWG1sJyxcbiAgICB4bWw2OiAnWG1sJyxcbiAgICB4bWw3OiAnWG1sJyxcbiAgICB4bWw4OiAnWG1sJyxcbiAgICB4bWw5OiAnWG1sJyxcbiAgICB4bWwxMDogJ1htbCdcbiAgfVxufSkudGhlbihmdW5jdGlvbiAoeSkge1xuICAgIGNvbnNvbGUubG9nKCcjIyMjIyMjIyMjIyMnKTtcbiAgICB3aW5kb3cueVhtbCA9IHk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yLmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvciddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3IyLmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjInXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yMy5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3IzJ10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjQuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yNCddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I1LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjUnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yNi5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I2J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjcuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yNyddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I4LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjgnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yOS5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I5J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjEwLmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjEwJ10pO1xuICAgIHkuc2hhcmUueG1sLl9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sJ10pO1xuICAgIHkuc2hhcmUueG1sMi5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDInXSk7XG4gICAgeS5zaGFyZS54bWwzLl9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sMyddKTtcbiAgICB5LnNoYXJlLnhtbDQuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw0J10pO1xuICAgIHkuc2hhcmUueG1sNS5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDUnXSk7XG4gICAgeS5zaGFyZS54bWw2Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNiddKTtcbiAgICB5LnNoYXJlLnhtbDcuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw3J10pO1xuICAgIHkuc2hhcmUueG1sOC5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDgnXSk7XG4gICAgeS5zaGFyZS54bWw5Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sOSddKTtcbiAgICB5LnNoYXJlLnhtbDEwLl9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sMTAnXSk7XG59KVxuIl19

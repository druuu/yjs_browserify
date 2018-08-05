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
 * @version v13.0.0-66
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.Y=e()}(this,function(){"use strict";function t(t,e,n,r){if(null===e)t.root=n,n._parent=null;else if(e.left===r)e.left=n;else{if(e.right!==r)throw new Error("The elements are wrongly connected!");e.right=n}}function e(t,e){var n=e._id;if(void 0===n)e._integrate(t);else{if(t.ss.getState(n.user)>n.clock)return;!t.gcEnabled||e.constructor===Lt||e._parent.constructor!==Lt&&!1===e._parent._deleted?e._integrate(t):e._gc(t);var r=t._missingStructs.get(n.user);if(null!=r)for(var i=n.clock,o=i+e._length;i<o;i++){var a=r.get(i);void 0!==a&&(a.forEach(function(e){if(0===--e.missing){var n=e.decoder,r=n.pos,i=e.struct._fromBinary(t,n);n.pos=r,0===i.length&&t._readyToIntegrate.push(e.struct)}}),r.delete(i))}}}function n(t,e,n){for(var r=e.readUint32(),i=0;i<r;i++){var o=e.readVarUint(),a=q(o),s=new a,l=s._fromBinary(t,e),u="  "+s._logString();l.length>0&&(u+=" .. missing: "+l.map(p).join(", ")),n.push(u)}}function r(t,n){for(var r=n.readUint32(),i=0;i<r;i++){var o=n.readVarUint(),a=q(o),s=new a,l=n.pos,u=s._fromBinary(t,n);if(0===u.length)for(;null!=s;)e(t,s),s=t._readyToIntegrate.shift();else{var c=new Vt(n.uint8arr);c.pos=l;for(var h=new Mt(c,u,s),f=t._missingStructs,d=u.length-1;d>=0;d--){var _=u[d];f.has(_.user)||f.set(_.user,new Map);var v=f.get(_.user);v.has(_.clock)||v.set(_.clock,[]);(v=v.get(_.clock)).push(h)}}}}function i(t){for(var e=new Map,n=t.readUint32(),r=0;r<n;r++){var i=t.readVarUint(),o=t.readVarUint();e.set(i,o)}return e}function o(t,e){var n=e.pos,r=0;e.writeUint32(0);var i=!0,o=!1,a=void 0;try{for(var s,l=t.ss.state[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=xt(s.value,2),c=u[0],h=u[1];e.writeVarUint(c),e.writeVarUint(h),r++}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}e.setUint32(n,r)}function a(t,e){var n=null,r=void 0,i=void 0,o=0,a=e.pos;e.writeUint32(0),t.ds.iterate(null,null,function(t){var a=t._id.user,s=t._id.clock,l=t.len,u=t.gc;n!==a&&(o++,null!==n&&e.setUint32(i,r),n=a,e.writeVarUint(a),i=e.pos,e.writeUint32(0),r=0),e.writeVarUint(s),e.writeVarUint(l),e.writeUint8(u?1:0),r++}),null!==n&&e.setUint32(i,r),e.setUint32(a,o)}function s(t,e){for(var n=e.readUint32(),r=0;r<n;r++)!function(n){for(var r=e.readVarUint(),i=[],o=e.readUint32(),a=0;a<o;a++){var s=e.readVarUint(),l=e.readVarUint(),u=1===e.readUint8();i.push([s,l,u])}if(o>0){var c=0,h=i[c],f=[];t.ds.iterate(new Pt(r,0),new Pt(r,Number.MAX_VALUE),function(t){for(;null!=h;){var e=0;if(t._id.clock+t.len<=h[0])break;h[0]<t._id.clock?(e=Math.min(t._id.clock-h[0],h[1]),f.push([r,h[0],e])):(e=t._id.clock+t.len-h[0],h[2]&&!t.gc&&f.push([r,h[0],Math.min(e,h[1])])),h[1]<=e?h=i[++c]:(h[0]=h[0]+e,h[1]=h[1]-e)}});for(var d=f.length-1;d>=0;d--){var _=f[d];g(t,_[0],_[1],_[2],!0)}for(;c<i.length;c++)h=i[c],g(t,r,h[0],h[1],!0)}}()}function l(t,e,n){var r=e.readVarString(),i=e.readVarUint();n.push('  - auth: "'+r+'"'),n.push("  - protocolVersion: "+i);for(var o=[],a=e.readUint32(),s=0;s<a;s++){var l=e.readVarUint(),u=e.readVarUint();o.push("("+l+":"+u+")")}n.push("  == SS: "+o.join(","))}function u(t,e){var n=new Ct;n.writeVarString(t.y.room),n.writeVarString("sync step 1"),n.writeVarString(t.authInfo||""),n.writeVarUint(t.protocolVersion),o(t.y,n),t.send(e,n.createBuffer())}function c(t,e,n){var r=e.pos;e.writeUint32(0);var i=0,o=!0,a=!1,s=void 0;try{for(var l,u=t.ss.state.keys()[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=l.value,h=n.get(c)||0;if(c!==qt){var f=new Pt(c,h),d=t.os.findPrev(f),_=null===d?null:d._id;if(null!==_&&_.user===c&&_.clock+d._length>h){d._clonePartial(h-_.clock)._toBinary(e),i++}t.os.iterate(f,new Pt(c,Number.MAX_VALUE),function(t){t._toBinary(e),i++})}}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}e.setUint32(r,i)}function h(t,e,n,r,o){var s=t.readVarUint();s!==n.connector.protocolVersion&&(console.warn("You tried to sync with a Yjs instance that has a different protocol version\n      (You: "+s+", Client: "+s+").\n      "),n.destroy()),e.writeVarString("sync step 2"),e.writeVarString(n.connector.authInfo||""),c(n,e,i(t)),a(n,e),n.connector.send(r.uid,e.createBuffer()),r.receivedSyncStep2=!0,"slave"===n.connector.role&&u(n.connector,o)}function f(t,e,r){r.push("     - auth: "+e.readVarString()),r.push("  == OS:"),n(t,e,r),r.push("  == DS:");for(var i=e.readUint32(),o=0;o<i;o++){var a=e.readVarUint();r.push("    User: "+a+": ");for(var s=e.readUint32(),l=0;l<s;l++){var u=e.readVarUint(),c=e.readVarUint(),h=1===e.readUint8();r.push("["+u+", "+c+", "+h+"]")}}}function d(t,e,n,i,o){r(n,t),s(n,t),n.connector._setSyncedWith(o)}function _(t){var e=xt(t,2),r=e[0],i=e[1],o=new Vt(i);o.readVarString();var a=o.readVarString(),s=[];return s.push("\n === "+a+" ==="),"update"===a?n(r,o,s):"sync step 1"===a?l(r,o,s):"sync step 2"===a?f(r,o,s):s.push("-- Unknown message type - probably an encoding issue!!!"),s.join("\n")}function v(t){var e=new Vt(t);return e.readVarString(),e.readVarString()}function p(t){if(null!==t&&null!=t._id&&(t=t._id),null===t)return"()";if(t instanceof Pt)return"("+t.user+","+t.clock+")";if(t instanceof $t)return"("+t.name+","+t.type+")";if(t.constructor===Y)return"y";throw new Error("This is not a valid ID!")}function y(t,e,n){var r=null!==e._left?e._left._lastId:null,i=null!==e._origin?e._origin._lastId:null;return t+"(id:"+p(e._id)+",left:"+p(r)+",origin:"+p(i)+",right:"+p(e._right)+",parent:"+p(e._parent)+",parentSub:"+e._parentSub+(void 0!==n?" - "+n:"")+")"}function g(t,e,n,r,i){var o=null!==t.connector&&t.connector._forwardAppliedStructs,a=t.os.getItemCleanStart(new Pt(e,n));if(null!==a){a._deleted||(a._splitAt(t,r),a._delete(t,o,!0));var s=a._length;if(r-=s,n+=s,r>0)for(var l=t.os.findNode(new Pt(e,n));null!==l&&null!==l.val&&r>0&&l.val._id.equals(new Pt(e,n));){var u=l.val;u._deleted||(u._splitAt(t,r),u._delete(t,o,i));var c=u._length;r-=c,n+=c,l=l.next()}}}function m(t,e,n){if(e!==t&&!e._deleted&&!t._transaction.newTypes.has(e)){var r=t._transaction.changedTypes,i=r.get(e);void 0===i&&(i=new Set,r.set(e,i)),i.add(n)}}function k(t,e,n,r){var i=e._id;n._id=new Pt(i.user,i.clock+r),n._origin=e,n._left=e,n._right=e._right,null!==n._right&&(n._right._left=n),n._right_origin=e._right_origin,e._right=n,n._parent=e._parent,n._parentSub=e._parentSub,n._deleted=e._deleted;var o=new Set;o.add(e);for(var a=n._right;null!==a&&o.has(a._origin);)a._origin===e&&(a._origin=n),o.add(a),a=a._right;t.os.put(n),t._transaction.newTypes.has(e)?t._transaction.newTypes.add(n):t._transaction.deletedStructs.has(e)&&t._transaction.deletedStructs.add(n)}function b(t,e){var n=void 0;do{n=e._right,e._right=null,e._right_origin=null,e._origin=e._left,e._integrate(t),e=n}while(null!==n)}function w(t,e){for(;null!==e;)e._delete(t,!1,!0),e._gc(t),e=e._right}function S(t,e,n,r,i){t._origin=r,t._left=r,t._right=i,t._right_origin=i,t._parent=e,null!==n?t._integrate(n):null===r?e._start=t:r._right=t}function O(t,e,n,r,i){for(;null!==r&&i>0;){switch(r.constructor){case Ht:case ItemString:if(i<=(r._deleted?0:r._length-1))return r=r._splitAt(e._y,i),n=r._left,[n,r,t];!1===r._deleted&&(i-=r._length);break;case Jt:!1===r._deleted&&B(t,r)}n=r,r=r._right}return[n,r,t]}function E(t,e){return O(new Map,t,null,t._start,e)}function U(t,e,n,r,i){for(;null!==r&&(!0===r._deleted||r.constructor===Jt&&i.get(r.key)===r.value);)!1===r._deleted&&i.delete(r.key),n=r,r=r._right;var o=!0,a=!1,s=void 0;try{for(var l,u=i[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=xt(l.value,2),h=c[0],f=c[1],d=new Jt;d.key=h,d.value=f,S(d,e,t,n,r),n=d}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}return[n,r]}function B(t,e){var n=e.value,r=e.key;null===n?t.delete(r):t.set(r,n)}function T(t,e,n,r){for(;;){if(null===e)break;if(!0===e._deleted);else{if(e.constructor!==Jt||(r[e.key]||null)!==e.value)break;B(n,e)}t=e,e=e._right}return[t,e]}function A(t,e,n,r,i,o){var a=new Map;for(var s in i){var l=i[s],u=o.get(s);if(u!==l){a.set(s,u||null);var c=new Jt;c.key=s,c.value=l,S(c,e,t,n,r),n=c}}return[n,r,a]}function x(t,e,n,r,i,o,a){var s=!0,l=!1,u=void 0;try{for(var c,h=o[Symbol.iterator]();!(s=(c=h.next()).done);s=!0){var f=xt(c.value,1),d=f[0];void 0===a[d]&&(a[d]=null)}}catch(t){l=!0,u=t}finally{try{!s&&h.return&&h.return()}finally{if(l)throw u}}var _=T(r,i,o,a),v=xt(_,2);r=v[0],i=v[1];var p=void 0,y=A(t,n,r,i,a,o),g=xt(y,3);r=g[0],i=g[1],p=g[2];var m=void 0;return e.constructor===String?(m=new ItemString,m._content=e):(m=new Ht,m.embed=e),S(m,n,t,r,i),r=m,U(t,n,r,i,p)}function I(t,e,n,r,i,o,a){var s=T(r,i,o,a),l=xt(s,2);r=l[0],i=l[1];var u=void 0,c=A(t,n,r,i,a,o),h=xt(c,3);for(r=h[0],i=h[1],u=h[2];e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Jt:var f=a[i.key];void 0!==f&&(f===i.value?u.delete(i.key):u.set(i.key,i.value),i._delete(t)),B(o,i);break;case Ht:case ItemString:i._splitAt(t,e),e-=i._length}r=i,i=i._right}return U(t,n,r,i,u)}function D(t,e,n,r,i,o){for(;e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Jt:B(o,i);break;case Ht:case ItemString:i._splitAt(t,e),e-=i._length,i._delete(t)}r=i,i=i._right}return[r,i]}function P(t,e){for(e=e._parent;null!==e;){if(e===t)return!0;e=e._parent}return!1}function j(t,e){return e}function N(t,e){for(var n=new Map,r=t.attributes.length-1;r>=0;r--){var i=t.attributes[r];n.set(i.name,i.value)}return e(t.nodeName,n)}function V(t,e,n){if(P(e.type,n)){var r=n.nodeName,i=new Map;if(void 0!==n.getAttributes){var o=n.getAttributes();for(var a in o)i.set(a,o[a])}var s=e.filter(r,new Map(i));null===s?n._delete(t):i.forEach(function(t,e){!1===s.has(e)&&n.removeAttribute(e)})}}function L(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:document,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:j,i=arguments[4],o=void 0;switch(t.nodeType){case e.ELEMENT_NODE:var a=null,s=void 0;if(t.hasAttribute("data-yjs-hook")&&(a=t.getAttribute("data-yjs-hook"),void 0===(s=n[a])&&(console.error('Unknown hook "'+a+'". Deleting yjsHook dataset property.'),t.removeAttribute("data-yjs-hook"),a=null)),null===a){var l=N(t,r);null===l?o=!1:(o=new YXmlElement(t.nodeName),l.forEach(function(t,e){o.setAttribute(e,t)}),o.insert(0,J(t.childNodes,document,n,r,i)))}else o=new YXmlHook(a),s.fillType(t,o);break;case e.TEXT_NODE:o=new YXmlText,o.insert(0,t.nodeValue);break;default:throw new Error("Can't transform this node type to a YXml type!")}return R(i,t,o),o}function M(t){for(;null!==t&&t._deleted;)t=t._right;return t}function C(t,e,n){t.domToType.delete(e),t.typeToDom.delete(n)}function R(t,e,n){void 0!==t&&(t.domToType.set(e,n),t.typeToDom.set(n,e))}function W(t,e,n){if(void 0!==t){var r=t.domToType.get(e);void 0!==r&&(C(t,e,r),R(t,n,r))}}function H(t,e,n,r,i){var o=J(n,r,i.opts.hooks,i.filter,i);return t.insertAfter(e,o)}function J(t,e,n,r,i){var o=[],a=!0,s=!1,l=void 0;try{for(var u,c=t[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=L(h,e,n,r,i);!1!==f&&o.push(f)}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}return o}function z(t,e,n,r,i){var o=H(t,e,[n],r,i);return o.length>0?o[0]:e}function F(t,e,n){for(;e!==n;){var r=e;e=e.nextSibling,t.removeChild(r)}}function X(t,e){Ft.set(t,e),Xt.set(e,t)}function q(t){return Ft.get(t)}function $(t){return Xt.get(t)}function G(){if("undefined"!=typeof crypto&&null!=crypto.getRandomValue){var t=new Uint32Array(1);return crypto.getRandomValues(t),t[0]}if("undefined"!=typeof crypto&&null!=crypto.randomBytes){var e=crypto.randomBytes(4);return new Uint32Array(e.buffer)[0]}return Math.ceil(4294967295*Math.random())}function Z(t,e){for(var n=t._start;null!==n;){if(!1===n._deleted){if(n._length>e)return[n._id.user,n._id.clock+e];e-=n._length}n=n._right}return["endof",t._id.user,t._id.clock||null,t._id.name||null,t._id.type||null]}function Q(t,e){if("endof"===e[0]){var n=void 0;n=null===e[3]?new Pt(e[1],e[2]):new $t(e[3],e[4]);for(var r=t.os.get(n);null!==r._redone;)r=r._redone;return null===r||r.constructor===Lt?null:{type:r,offset:r.length}}for(var i=0,o=t.os.findNodeWithUpperBound(new Pt(e[0],e[1])).val,a=e[1]-o._id.clock;null!==o._redone;)o=o._redone;var s=o._parent;if(o.constructor===Lt||s._deleted)return null;for(o._deleted||(i=a),o=o._left;null!==o;)o._deleted||(i+=o._length),o=o._left;return{type:s,offset:i}}function K(){var t=!0;return function(e){if(t){t=!1;try{e()}catch(t){console.error(t)}t=!0}}}function tt(t){var e=getSelection(),n=e.baseNode,r=e.baseOffset,i=e.extentNode,o=e.extentOffset,a=t.domToType.get(n),s=t.domToType.get(i);return void 0!==a&&void 0!==s?{from:Z(a,r),to:Z(s,o)}:null}function et(t){te=ee(t)}function nt(t){null!==te&&t.restoreSelection(te)}function rt(t){if(null!==t){var e=getSelection().anchorNode;if(null!=e){e.nodeType===document.TEXT_NODE&&(e=e.parentElement);return{elem:e,top:e.getBoundingClientRect().top}}for(var n=t.children,r=0;r<n.length;r++){var i=n[r],o=i.getBoundingClientRect();if(o.top>=0)return{elem:i,top:o.top}}}return null}function it(t,e){if(null!==e){var n=e.elem,r=e.top,i=n.getBoundingClientRect().top,o=t.scrollTop+i-r;o>=0&&(t.scrollTop=o)}}function ot(t){var e=this;this._mutualExclude(function(){var n=rt(e.scrollingElement);t.forEach(function(t){var n=t.target,r=e.typeToDom.get(n);if(void 0!==r&&!1!==r)if(n.constructor===YXmlText)r.nodeValue=n.toString();else if(void 0!==t.attributesChanged&&(t.attributesChanged.forEach(function(t){var e=n.getAttribute(t);void 0===e?r.removeAttribute(t):r.setAttribute(t,e)}),t.childListChanged&&n.constructor!==YXmlHook)){var i=r.firstChild;n.forEach(function(t){var n=e.typeToDom.get(t);switch(n){case void 0:var o=t.toDom(e.opts.document,e.opts.hooks,e);r.insertBefore(o,i);break;case!1:break;default:F(r,i,n),i=n.nextSibling}}),F(r,i,null)}}),it(e.scrollingElement,n)})}function at(t,e){for(var n=0,r=0;n<t.length&&n<e.length&&t[n]===e[n];)n++;if(n!==t.length||n!==e.length)for(;r+n<t.length&&r+n<e.length&&t[t.length-r-1]===e[e.length-r-1];)r++;return{pos:n,remove:t.length-n-r,insert:e.slice(n,e.length-r)}}function st(t,e,n,r){if(null!=n&&!1!==n&&n.constructor!==YXmlHook){for(var i=n._y,o=new Set,a=e.childNodes.length-1;a>=0;a--){var s=t.domToType.get(e.childNodes[a]);void 0!==s&&!1!==s&&o.add(s)}n.forEach(function(e){!1===o.has(e)&&(e._delete(i),C(t,t.typeToDom.get(e),e))});for(var l=e.childNodes,u=l.length,c=null,h=M(n._start),f=0;f<u;f++){var d=l[f],_=t.domToType.get(d);if(void 0!==_){if(!1===_)continue;null!==h?h!==_?(_._parent!==n?C(t,d,_):(C(t,d,_),_._delete(i)),c=z(n,c,d,r,t)):(c=h,h=M(h._right)):c=z(n,c,d,r,t)}else c=z(n,c,d,r,t)}}}function lt(t,e){var n=this;this._mutualExclude(function(){n.type._y.transact(function(){var r=new Set;t.forEach(function(t){var e=t.target,i=n.domToType.get(e);if(void 0===i){var o=e,a=void 0;do{o=o.parentElement,a=n.domToType.get(o)}while(void 0===a&&null!==o);return void(!1!==a&&void 0!==a&&a.constructor!==YXmlHook&&r.add(o))}if(!1!==i&&i.constructor!==YXmlHook)switch(t.type){case"characterData":var s=at(i.toString(),e.nodeValue);i.delete(s.pos,s.remove),i.insert(s.pos,s.insert);break;case"attributes":if(i.constructor===YXmlFragment)break;var l=t.attributeName,u=e.getAttribute(l),c=new Map;c.set(l,u),i.constructor!==YXmlFragment&&n.filter(e.nodeName,c).size>0&&i.getAttribute(l)!==u&&(null==u?i.removeAttribute(l):i.setAttribute(l,u));break;case"childList":r.add(t.target)}});var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=s.value,c=n.domToType.get(u);st(n,u,c,e)}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}})})}function ut(t,e,n){var r=!1,i=void 0;return t.transact(function(){for(;!r&&n.length>0;)!function(){i=n.pop(),null!==i.fromState&&(t.os.getItemCleanStart(i.fromState),t.os.getItemCleanEnd(i.toState),t.os.iterate(i.fromState,i.toState,function(n){for(;n._deleted&&null!==n._redone;)n=n._redone;!1===n._deleted&&P(e,n)&&(r=!0,n._delete(t))}));var o=new Set,a=!0,s=!1,l=void 0;try{for(var u,c=i.deletedStructs[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=h.from,d=new Pt(f.user,f.clock+h.len-1);t.os.getItemCleanStart(f),t.os.getItemCleanEnd(d),t.os.iterate(f,d,function(n){P(e,n)&&n._parent!==t&&(n._id.user!==t.userID||null===i.fromState||n._id.clock<i.fromState.clock||n._id.clock>i.toState.clock)&&o.add(n)})}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}o.forEach(function(e){var n=e._redo(t,o);r=r||n})}()}),r&&i.bindingInfos.forEach(function(t,e){e._restoreUndoStackInfo(t)}),r}function ct(t,e){return e={exports:{}},t(e,e.exports),e.exports}function ht(t){if(t=String(t),!(t.length>100)){var e=/^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);if(e){var n=parseFloat(e[1]);switch((e[2]||"ms").toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return n*ue;case"days":case"day":case"d":return n*le;case"hours":case"hour":case"hrs":case"hr":case"h":return n*se;case"minutes":case"minute":case"mins":case"min":case"m":return n*ae;case"seconds":case"second":case"secs":case"sec":case"s":return n*oe;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return n;default:return}}}}function ft(t){return t>=le?Math.round(t/le)+"d":t>=se?Math.round(t/se)+"h":t>=ae?Math.round(t/ae)+"m":t>=oe?Math.round(t/oe)+"s":t+"ms"}function dt(t){return _t(t,le,"day")||_t(t,se,"hour")||_t(t,ae,"minute")||_t(t,oe,"second")||t+" ms"}function _t(t,e,n){if(!(t<e))return t<1.5*e?Math.floor(t/e)+" "+n:Math.ceil(t/e)+" "+n+"s"}function vt(t,e){t.transact(function(){r(t,e),s(t,e)})}function pt(t){var e=new Ct;return c(t,e,new Map),a(t,e),e}function yt(){var t=new Ct;return t.writeUint32(0),{len:0,buffer:t}}function gt(){var t=this;this._mutualExclude(function(){var e=t.target,n=t.type,r=Z(n,e.selectionStart),i=Z(n,e.selectionEnd);e.value=n.toString();var o=Q(n._y,r),a=Q(n._y,i);e.setSelectionRange(o,a)})}function mt(){var t=this;this._mutualExclude(function(){var e=at(t.type.toString(),t.target.value);t.type.delete(e.pos,e.remove),t.type.insert(e.pos,e.insert)})}function kt(t){var e=this.target;e.update("yjs"),this._mutualExclude(function(){e.updateContents(t.delta,"yjs"),e.update("yjs")})}function bt(t){var e=this;this._mutualExclude(function(){e.type.applyDelta(t.ops)})}function wt(t){var e=this;this._mutualExclude(function(){for(var n=e.target,r=t.delta,i=0,o=n.posFromIndex(i),a=0;a<r.length;a++){var s=r[a];s.retain?(i=s.retain,o=n.posFromIndex(i)):s.insert?n.replaceRange(s.insert,o,o):s.delete&&n.replaceRange("",o,n.posFromIndex(i+s.delete))}})}function St(t,e){var n=this;this._mutualExclude(function(){for(var r=0;r<e.length;r++){var i=e[r],o=t.indexFromPos(i.from);if(i.removed.length>0){for(var a=0,s=0;s<i.removed.length;s++)a+=i.removed[s].length;a+=i.removed.length-1,n.type.delete(o,a)}n.type.insert(o,i.text.join("\n"))}})}var Ot="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Et=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},Ut=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),Bt=function t(e,n,r){null===e&&(e=Function.prototype);var i=Object.getOwnPropertyDescriptor(e,n);if(void 0===i){var o=Object.getPrototypeOf(e);return null===o?void 0:t(o,n,r)}if("value"in i)return i.value;var a=i.get;if(void 0!==a)return a.call(r)},Tt=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},At=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e},xt=function(){function t(t,e){var n=[],r=!0,i=!1,o=void 0;try{for(var a,s=t[Symbol.iterator]();!(r=(a=s.next()).done)&&(n.push(a.value),!e||n.length!==e);r=!0);}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}return n}return function(e,n){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,n);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),It=function(){function e(t){Et(this,e),this.val=t,this.color=!0,this._left=null,this._right=null,this._parent=null}return Ut(e,[{key:"isRed",value:function(){return this.color}},{key:"isBlack",value:function(){return!this.color}},{key:"redden",value:function(){return this.color=!0,this}},{key:"blacken",value:function(){return this.color=!1,this}},{key:"rotateLeft",value:function(e){var n=this.parent,r=this.right,i=this.right.left;r.left=this,this.right=i,t(e,n,r,this)}},{key:"next",value:function(){if(null!==this.right){for(var t=this.right;null!==t.left;)t=t.left;return t}for(var e=this;null!==e.parent&&e!==e.parent.left;)e=e.parent;return e.parent}},{key:"prev",value:function(){if(null!==this.left){for(var t=this.left;null!==t.right;)t=t.right;return t}for(var e=this;null!==e.parent&&e!==e.parent.right;)e=e.parent;return e.parent}},{key:"rotateRight",value:function(e){var n=this.parent,r=this.left,i=this.left.right;r.right=this,this.left=i,t(e,n,r,this)}},{key:"getUncle",value:function(){return this.parent===this.parent.parent.left?this.parent.parent.right:this.parent.parent.left}},{key:"grandparent",get:function(){return this.parent.parent}},{key:"parent",get:function(){return this._parent}},{key:"sibling",get:function(){return this===this.parent.left?this.parent.right:this.parent.left}},{key:"left",get:function(){return this._left},set:function(t){null!==t&&(t._parent=this),this._left=t}},{key:"right",get:function(){return this._right},set:function(t){null!==t&&(t._parent=this),this._right=t}}]),e}(),Dt=function(){function t(){Et(this,t),this.root=null,this.length=0}return Ut(t,[{key:"findNext",value:function(t){var e=t.clone();return e.clock+=1,this.findWithLowerBound(e)}},{key:"findPrev",value:function(t){var e=t.clone();return e.clock-=1,this.findWithUpperBound(e)}},{key:"findNodeWithLowerBound",value:function(t){var e=this.root;if(null===e)return null;for(;;)if(null===t||t.lessThan(e.val._id)&&null!==e.left)e=e.left;else{if(null===t||!e.val._id.lessThan(t))return e;if(null===e.right)return e.next();e=e.right}}},{key:"findNodeWithUpperBound",value:function(t){if(void 0===t)throw new Error("You must define from!");var e=this.root;if(null===e)return null;for(;;)if(null!==t&&!e.val._id.lessThan(t)||null===e.right){if(null===t||!t.lessThan(e.val._id))return e;if(null===e.left)return e.prev();e=e.left}else e=e.right}},{key:"findSmallestNode",value:function(){for(var t=this.root;null!=t&&null!=t.left;)t=t.left;return t}},{key:"findWithLowerBound",value:function(t){var e=this.findNodeWithLowerBound(t);return null==e?null:e.val}},{key:"findWithUpperBound",value:function(t){var e=this.findNodeWithUpperBound(t);return null==e?null:e.val}},{key:"iterate",value:function(t,e,n){var r;for(r=null===t?this.findSmallestNode():this.findNodeWithLowerBound(t);null!==r&&(null===e||r.val._id.lessThan(e)||r.val._id.equals(e));)n(r.val),r=r.next()}},{key:"find",value:function(t){var e=this.findNode(t);return null!==e?e.val:null}},{key:"findNode",value:function(t){var e=this.root;if(null===e)return null;for(;;){if(null===e)return null;if(t.lessThan(e.val._id))e=e.left;else{if(!e.val._id.lessThan(t))return e;e=e.right}}}},{key:"delete",value:function(t){var e=this.findNode(t);if(null!=e){if(this.length--,null!==e.left&&null!==e.right){for(var n=e.left;null!==n.right;)n=n.right;e.val=n.val,e=n}var r,i=e.left||e.right;if(null===i?(r=!0,i=new It(null),i.blacken(),e.right=i):r=!1,null===e.parent)return void(r?this.root=null:(this.root=i,i.blacken(),i._parent=null));if(e.parent.left===e)e.parent.left=i;else{if(e.parent.right!==e)throw new Error("Impossible!");e.parent.right=i}if(e.isBlack()&&(i.isRed()?i.blacken():this._fixDelete(i)),this.root.blacken(),r)if(i.parent.left===i)i.parent.left=null;else{if(i.parent.right!==i)throw new Error("Impossible #3");i.parent.right=null}}}},{key:"_fixDelete",value:function(t){function e(t){return null===t||t.isBlack()}function n(t){return null!==t&&t.isRed()}if(null!==t.parent){var r=t.sibling;if(n(r)){if(t.parent.redden(),r.blacken(),t===t.parent.left)t.parent.rotateLeft(this);else{if(t!==t.parent.right)throw new Error("Impossible #2");t.parent.rotateRight(this)}r=t.sibling}t.parent.isBlack()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),this._fixDelete(t.parent)):t.parent.isRed()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),t.parent.blacken()):(t===t.parent.left&&r.isBlack()&&n(r.left)&&e(r.right)?(r.redden(),r.left.blacken(),r.rotateRight(this),r=t.sibling):t===t.parent.right&&r.isBlack()&&n(r.right)&&e(r.left)&&(r.redden(),r.right.blacken(),r.rotateLeft(this),r=t.sibling),r.color=t.parent.color,t.parent.blacken(),t===t.parent.left?(r.right.blacken(),t.parent.rotateLeft(this)):(r.left.blacken(),t.parent.rotateRight(this)))}}},{key:"put",value:function(t){var e=new It(t);if(null!==this.root){for(var n=this.root;;)if(e.val._id.lessThan(n.val._id)){if(null===n.left){n.left=e;break}n=n.left}else{if(!n.val._id.lessThan(e.val._id))return n.val=e.val,n;if(null===n.right){n.right=e;break}n=n.right}this._fixInsert(e)}else this.root=e;return this.length++,this.root.blacken(),e}},{key:"_fixInsert",value:function(t){if(null===t.parent)return void t.blacken();if(!t.parent.isBlack()){var e=t.getUncle();null!==e&&e.isRed()?(t.parent.blacken(),e.blacken(),t.grandparent.redden(),this._fixInsert(t.grandparent)):(t===t.parent.right&&t.parent===t.grandparent.left?(t.parent.rotateLeft(this),t=t.left):t===t.parent.left&&t.parent===t.grandparent.right&&(t.parent.rotateRight(this),t=t.right),t.parent.blacken(),t.grandparent.redden(),t===t.parent.left?t.grandparent.rotateRight(this):t.grandparent.rotateLeft(this))}}}]),t}(),Pt=function(){function t(e,n){Et(this,t),this.user=e,this.clock=n}return Ut(t,[{key:"clone",value:function(){return new t(this.user,this.clock)}},{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.clock===this.clock}},{key:"lessThan",value:function(e){return e.constructor===t&&(this.user<e.user||this.user===e.user&&this.clock<e.clock)}}]),t}(),jt=function(){function t(e,n,r){Et(this,t),this._id=e,this.len=n,this.gc=r}return Ut(t,[{key:"clone",value:function(){return new t(this._id,this.len,this.gc)}}]),t}(),Nt=function(t){function e(){return Et(this,e),At(this,(e.__proto__||Object.getPrototypeOf(e)).apply(this,arguments))}return Tt(e,t),Ut(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){t.push({user:e._id.user,clock:e._id.clock,len:e.len,gc:e.gc})}),console.table(t)}},{key:"isDeleted",value:function(t){var e=this.findWithUpperBound(t);return null!==e&&e._id.user===t.user&&t.clock<e._id.clock+e.len}},{key:"mark",value:function(t,e,n){if(0!==e){var r=this.findWithUpperBound(new Pt(t.user,t.clock-1));null!==r&&r._id.user===t.user&&r._id.clock<t.clock&&t.clock<r._id.clock+r.len&&(t.clock+e<r._id.clock+r.len&&this.put(new jt(new Pt(t.user,t.clock+e),r._id.clock+r.len-t.clock-e,r.gc)),r.len=t.clock-r._id.clock);var i=new Pt(t.user,t.clock+e-1),o=this.findWithUpperBound(i);if(null!==o&&o._id.user===t.user&&o._id.clock<t.clock+e&&t.clock<=o._id.clock&&t.clock+e<o._id.clock+o.len){var a=t.clock+e-o._id.clock;o._id=new Pt(o._id.user,o._id.clock+a),o.len-=a}var s=[];this.iterate(t,i,function(t){s.push(t._id)});for(var l=s.length-1;l>=0;l--)this.delete(s[l]);var u=new jt(t,e,n);null!==r&&r._id.user===t.user&&r._id.clock+r.len===t.clock&&r.gc===n&&(r.len+=e,u=r);var c=this.find(new Pt(t.user,t.clock+e));null!==c&&c._id.user===t.user&&t.clock+e===c._id.clock&&n===c.gc&&(u.len+=c.len,this.delete(c._id)),r!==u&&this.put(u)}}},{key:"markDeleted",value:function(t,e){this.mark(t,e,!1)}}]),e}(Dt),Vt=function(){function t(e){if(Et(this,t),e instanceof ArrayBuffer)this.uint8arr=new Uint8Array(e);else{if(!(e instanceof Uint8Array||"undefined"!=typeof Buffer&&e instanceof Buffer))throw new Error("Expected an ArrayBuffer or Uint8Array!");this.uint8arr=e}this.pos=0}return Ut(t,[{key:"clone",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.pos,n=new t(this.uint8arr);return n.pos=e,n}},{key:"skip8",value:function(){this.pos++}},{key:"readUint8",value:function(){return this.uint8arr[this.pos++]}},{key:"readUint32",value:function(){var t=this.uint8arr[this.pos]+(this.uint8arr[this.pos+1]<<8)+(this.uint8arr[this.pos+2]<<16)+(this.uint8arr[this.pos+3]<<24);return this.pos+=4,t}},{key:"peekUint8",value:function(){return this.uint8arr[this.pos]}},{key:"readVarUint",value:function(){for(var t=0,e=0;;){var n=this.uint8arr[this.pos++];if(t|=(127&n)<<e,e+=7,n<128)return t>>>0;if(e>35)throw new Error("Integer out of range!")}}},{key:"readVarString",value:function(){for(var t=this.readVarUint(),e=new Array(t),n=0;n<t;n++)e[n]=this.uint8arr[this.pos++];var r=e.map(function(t){return String.fromCodePoint(t)}).join("");return decodeURIComponent(escape(r))}},{key:"peekVarString",value:function(){var t=this.pos,e=this.readVarString();return this.pos=t,e}},{key:"readID",value:function(){var t=this.readVarUint();if(t===qt){var e=new $t(this.readVarString(),null);return e.type=this.readVarUint(),e}return new Pt(t,this.readVarUint())}},{key:"length",get:function(){return this.uint8arr.length}}]),t}(),Lt=function(){function t(){Et(this,t),this._id=null,this._length=0}return Ut(t,[{key:"_integrate",value:function(e){var n=this._id,r=e.ss.getState(n.user);n.clock===r&&e.ss.setState(n.user,n.clock+this._length),e.ds.mark(this._id,this._length,!0);var i=e.os.put(this),o=i.prev().val;null!==o&&o.constructor===t&&o._id.user===i.val._id.user&&o._id.clock+o._length===i.val._id.clock&&(o._length+=i.val._length,e.os.delete(i.val._id),i=o),i.val&&(i=i.val);var a=e.os.findNext(i._id);null!==a&&a.constructor===t&&a._id.user===i._id.user&&a._id.clock===i._id.clock+i._length&&(i._length+=a._length,e.os.delete(a._id)),n.user!==qt&&(null===e.connector||!e.connector._forwardAppliedStructs&&n.user!==e.userID||e.connector.broadcastStruct(this),null!==e.persistence&&e.persistence.saveStruct(e,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._id),t.writeVarUint(this._length)}},{key:"_fromBinary",value:function(t,e){var n=e.readID();this._id=n,this._length=e.readVarUint();var r=[];return t.ss.getState(n.user)<n.clock&&r.push(new Pt(n.user,n.clock-1)),r}},{key:"_splitAt",value:function(){return this}},{key:"_clonePartial",value:function(e){var n=new t;return n._id=new Pt(this._id.user,this._id.clock+e),n._length=this._length-e,n}},{key:"_deleted",get:function(){return!0}}]),t}(),Mt=function t(e,n,r){Et(this,t),this.decoder=e,this.missing=n.length,this.struct=r},Ct=function(){function t(){Et(this,t),this.data=[]}return Ut(t,[{key:"createBuffer",value:function(){return Uint8Array.from(this.data).buffer}},{key:"writeUint8",value:function(t){this.data.push(255&t)}},{key:"setUint8",value:function(t,e){this.data[t]=255&e}},{key:"writeUint16",value:function(t){this.data.push(255&t,t>>>8&255)}},{key:"setUint16",value:function(t,e){this.data[t]=255&e,this.data[t+1]=e>>>8&255}},{key:"writeUint32",value:function(t){for(var e=0;e<4;e++)this.data.push(255&t),t>>>=8}},{key:"setUint32",value:function(t,e){for(var n=0;n<4;n++)this.data[t+n]=255&e,e>>>=8}},{key:"writeVarUint",value:function(t){for(;t>=128;)this.data.push(128|127&t),t>>>=7;this.data.push(127&t)}},{key:"writeVarString",value:function(t){
var e=unescape(encodeURIComponent(t)),n=e.split("").map(function(t){return t.codePointAt()}),r=n.length;this.writeVarUint(r);for(var i=0;i<r;i++)this.data.push(n[i])}},{key:"writeID",value:function(t){var e=t.user;this.writeVarUint(e),e!==qt?this.writeVarUint(t.clock):(this.writeVarString(t.name),this.writeVarUint(t.type))}},{key:"length",get:function(){return this.data.length}},{key:"pos",get:function(){return this.data.length}}]),t}(),Delete=function(){function Delete(){Et(this,Delete),this._target=null,this._length=null}return Ut(Delete,[{key:"_fromBinary",value:function(t,e){var n=e.readID();return this._targetID=n,this._length=e.readVarUint(),null===t.os.getItem(n)?[n]:[]}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._targetID),t.writeVarUint(this._length)}},{key:"_integrate",value:function(t){if(arguments.length>1&&void 0!==arguments[1]&&arguments[1])null!==t.connector&&t.connector.broadcastStruct(this);else{var e=this._targetID;g(t,e.user,e.clock,this._length,!1)}null!==t.persistence&&t.persistence.saveStruct(t,this)}},{key:"_logString",value:function(){return"Delete - target: "+p(this._targetID)+", len: "+this._length}}]),Delete}(),Rt=function t(e){Et(this,t),this.y=e,this.newTypes=new Set,this.changedTypes=new Map,this.deletedStructs=new Set,this.beforeState=new Map,this.changedParentTypes=new Map},Item=function(){function Item(){Et(this,Item),this._id=null,this._origin=null,this._left=null,this._right=null,this._right_origin=null,this._parent=null,this._parentSub=null,this._deleted=!1,this._redone=null}return Ut(Item,[{key:"_copy",value:function(){return new this.constructor}},{key:"_redo",value:function(t,e){if(null!==this._redone)return this._redone;var n=this._copy(),r=void 0,i=void 0;null===this._parentSub?(r=this._left,i=this):(r=null,i=this._parent._map.get(this._parentSub),i._delete(t));var o=this._parent;if(!(!0!==o._deleted||null!==o._redone||e.has(o)&&o._redo(t,e)))return!1;if(null!==o._redone){for(o=o._redone;null!==r;){if(null!==r._redone&&r._redone._parent===o){r=r._redone;break}r=r._left}for(;null!==i;)null!==i._redone&&i._redone._parent===o&&(i=i._redone),i=i._right}return n._origin=r,n._left=r,n._right=i,n._right_origin=i,n._parent=o,n._parentSub=this._parentSub,n._integrate(t),this._redone=n,!0}},{key:"_splitAt",value:function(t,e){return 0===e?this:this._right}},{key:"_delete",value:function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];if(!this._deleted){this._deleted=!0,t.ds.mark(this._id,this._length,!1);var n=new Delete;n._targetID=this._id,n._length=this._length,e?n._integrate(t,!0):null!==t.persistence&&t.persistence.saveStruct(t,n),m(t,this._parent,this._parentSub),t._transaction.deletedStructs.add(this)}}},{key:"_gcChildren",value:function(t){}},{key:"_gc",value:function(t){var e=new Lt;e._id=this._id,e._length=this._length,t.os.delete(this._id),e._integrate(t)}},{key:"_beforeChange",value:function(){}},{key:"_integrate",value:function(t){t._transaction.newTypes.add(this);var e=this._parent,n=this._id,r=null===n?t.userID:n.user,i=t.ss.getState(r);if(null===n)this._id=t.ss.getNextID(this._length);else if(n.user===qt);else{if(n.clock<i)return[];if(n.clock!==i)throw new Error("Can not apply yet!");t.ss.setState(n.user,i+this._length)}e._deleted||t._transaction.changedTypes.has(e)||t._transaction.newTypes.has(e)||this._parent._beforeChange();var o=void 0;o=null!==this._left?this._left._right:null!==this._parentSub?this._parent._map.get(this._parentSub)||null:this._parent._start;for(var a=new Set,s=new Set;null!==o&&o!==this._right;){if(s.add(o),a.add(o),this._origin===o._origin)o._id.user<this._id.user&&(this._left=o,a.clear());else{if(!s.has(o._origin))break;a.has(o._origin)||(this._left=o,a.clear())}o=o._right}var l=this._parentSub;if(null===this._left){var u=void 0;if(null!==l){var c=e._map;u=c.get(l)||null,c.set(l,this)}else u=e._start,e._start=this;this._right=u,null!==u&&(u._left=this)}else{var h=this._left,f=h._right;this._right=f,h._right=this,null!==f&&(f._left=this)}e._deleted&&this._delete(t,!1),t.os.put(this),m(t,e,l),this._id.user!==qt&&(null===t.connector||!t.connector._forwardAppliedStructs&&this._id.user!==t.userID||t.connector.broadcastStruct(this),null!==t.persistence&&t.persistence.saveStruct(t,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor));var e=0;null!==this._origin&&(e+=1),null!==this._right_origin&&(e+=4),null!==this._parentSub&&(e+=8),t.writeUint8(e),t.writeID(this._id),1&e&&t.writeID(this._origin._lastId),4&e&&t.writeID(this._right_origin._id),0==(5&e)&&t.writeID(this._parent._id),8&e&&t.writeVarString(JSON.stringify(this._parentSub))}},{key:"_fromBinary",value:function(t,e){var n=[],r=e.readUint8(),i=e.readID();if(this._id=i,1&r){var o=e.readID(),a=t.os.getItemCleanEnd(o);null===a?n.push(o):(this._origin=a,this._left=this._origin)}if(4&r){var s=e.readID(),l=t.os.getItemCleanStart(s);null===l?n.push(s):(this._right=l,this._right_origin=l)}if(0==(5&r)){var u=e.readID();if(null===this._parent){var c=void 0;c=u.constructor===$t?t.os.get(u):t.os.getItem(u),null===c?n.push(u):this._parent=c}}else null===this._parent&&(null!==this._origin?this._origin.constructor===Lt?this._parent=this._origin:this._parent=this._origin._parent:null!==this._right_origin&&(this._right_origin.constructor===Lt?this._parent=this._right_origin:this._parent=this._right_origin._parent));return 8&r&&(this._parentSub=JSON.parse(e.readVarString())),t.ss.getState(i.user)<i.clock&&n.push(new Pt(i.user,i.clock-1)),n}},{key:"_lastId",get:function(){return new Pt(this._id.user,this._id.clock+this._length-1)}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!0}}]),Item}(),Wt=function(){function t(){Et(this,t),this.eventListeners=[]}return Ut(t,[{key:"destroy",value:function(){this.eventListeners=null}},{key:"addEventListener",value:function(t){this.eventListeners.push(t)}},{key:"removeEventListener",value:function(t){this.eventListeners=this.eventListeners.filter(function(e){return t!==e})}},{key:"removeAllEventListeners",value:function(){this.eventListeners=[]}},{key:"callEventListeners",value:function(t,e){for(var n=0;n<this.eventListeners.length;n++)try{(0,this.eventListeners[n])(e)}catch(t){console.error(t)}}}]),t}(),Type=function(t){function Type(){Et(this,Type);var t=At(this,(Type.__proto__||Object.getPrototypeOf(Type)).call(this));return t._map=new Map,t._start=null,t._y=null,t._eventHandler=new Wt,t._deepEventHandler=new Wt,t}return Tt(Type,t),Ut(Type,[{key:"getPathTo",value:function(t){if(t===this)return[];for(var e=[],n=this._y;t!==this&&t!==n;){var r=t._parent;if(null!==t._parentSub)e.unshift(t._parentSub);else{var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=xt(s.value,2),c=u[0];if(u[1]===t){e.unshift(c);break}}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}}t=r}if(t!==this)throw new Error("The type is not a child of this node");return e}},{key:"_callEventHandler",value:function(t,e){var n=t.changedParentTypes;this._eventHandler.callEventListeners(t,e);for(var r=this;r!==this._y;){var i=n.get(r);void 0===i&&(i=[],n.set(r,i)),i.push(e),r=r._parent}}},{key:"_transact",value:function(t){var e=this._y;null!==e?e.transact(t):t(e)}},{key:"observe",value:function(t){this._eventHandler.addEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserve",value:function(t){this._eventHandler.removeEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_integrate",value:function(t){Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_integrate",this).call(this,t),this._y=t;var e=this._start;null!==e&&(this._start=null,b(t,e));var n=this._map;this._map=new Map;var r=!0,i=!1,o=void 0;try{for(var a,s=n.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){b(t,a.value)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}}},{key:"_gcChildren",value:function(t){w(t,this._start),this._start=null,this._map.forEach(function(e){w(t,e)}),this._map=new Map}},{key:"_gc",value:function(t){this._gcChildren(t),Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_gc",this).call(this,t)}},{key:"_delete",value:function(t,e,n){void 0!==n&&t.gcEnabled||(n=!1===t._hasUndoManager&&t.gcEnabled),Bt(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_delete",this).call(this,t,e,n),t._transaction.changedTypes.delete(this);var r=!0,i=!1,o=void 0;try{for(var a,s=this._map.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){var l=a.value;l instanceof Item&&!l._deleted&&l._delete(t,!1,n)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}for(var u=this._start;null!==u;)u._deleted||u._delete(t,!1,n),u=u._right;n&&this._gcChildren(t)}}]),Type}(Item),ItemJSON=function(t){function ItemJSON(){Et(this,ItemJSON);var t=At(this,(ItemJSON.__proto__||Object.getPrototypeOf(ItemJSON)).call(this));return t._content=null,t}return Tt(ItemJSON,t),Ut(ItemJSON,[{key:"_copy",value:function(){var t=Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_fromBinary",this).call(this,t,e),r=e.readVarUint();this._content=new Array(r);for(var i=0;i<r;i++){var o=e.readVarString(),a=void 0;a="undefined"===o?void 0:JSON.parse(o),this._content[i]=a}return n}},{key:"_toBinary",value:function(t){Bt(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_toBinary",this).call(this,t);var e=this._content.length;t.writeVarUint(e);for(var n=0;n<e;n++){var r=void 0,i=this._content[n];r=void 0===i?"undefined":JSON.stringify(i),t.writeVarString(r)}}},{key:"_logString",value:function(){return y("ItemJSON",this,"content:"+JSON.stringify(this._content))}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemJSON;return n._content=this._content.splice(e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemJSON}(Item),ItemString=function(t){function ItemString(){Et(this,ItemString);var t=At(this,(ItemString.__proto__||Object.getPrototypeOf(ItemString)).call(this));return t._content=null,t}return Tt(ItemString,t),Ut(ItemString,[{key:"_copy",value:function(){var t=Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_fromBinary",this).call(this,t,e);return this._content=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_toBinary",this).call(this,t),t.writeVarString(this._content)}},{key:"_logString",value:function(){return y("ItemString",this,'content:"'+this._content+'"')}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemString;return n._content=this._content.slice(e),this._content=this._content.slice(0,e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemString}(Item),YEvent=function(){function YEvent(t){Et(this,YEvent),this.target=t,this.currentTarget=t}return Ut(YEvent,[{key:"path",get:function(){return this.currentTarget.getPathTo(this.target)}}]),YEvent}(),YArrayEvent=function(t){function YArrayEvent(t,e,n){Et(this,YArrayEvent);var r=At(this,(YArrayEvent.__proto__||Object.getPrototypeOf(YArrayEvent)).call(this,t));return r.remote=e,r._transaction=n,r._addedElements=null,r._removedElements=null,r}return Tt(YArrayEvent,t),Ut(YArrayEvent,[{key:"addedElements",get:function(){if(null===this._addedElements){var t=this.target,e=this._transaction,n=new Set;e.newTypes.forEach(function(r){r._parent!==t||e.deletedStructs.has(r)||n.add(r)}),this._addedElements=n}return this._addedElements}},{key:"removedElements",get:function(){if(null===this._removedElements){var t=this.target,e=this._transaction,n=new Set;e.deletedStructs.forEach(function(r){r._parent!==t||e.newTypes.has(r)||n.add(r)}),this._removedElements=n}return this._removedElements}}]),YArrayEvent}(YEvent),YArray=function(t){function YArray(){return Et(this,YArray),At(this,(YArray.__proto__||Object.getPrototypeOf(YArray)).apply(this,arguments))}return Tt(YArray,t),Ut(YArray,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YArrayEvent(this,n,t))}},{key:"get",value:function(t){for(var e=this._start;null!==e;){if(!e._deleted&&e._countable){if(t<e._length)return e.constructor===ItemJSON||e.constructor===ItemString?e._content[t]:e;t-=e._length}e=e._right}}},{key:"toArray",value:function(){return this.map(function(t){return t})}},{key:"toJSON",value:function(){return this.map(function(t){return t instanceof Type?null!==t.toJSON?t.toJSON():t.toString():t})}},{key:"map",value:function(t){var e=this,n=[];return this.forEach(function(r,i){n.push(t(r,i,e))}),n}},{key:"forEach",value:function(t){for(var e=0,n=this._start;null!==n;){if(!n._deleted&&n._countable)if(n instanceof Type)t(n,e++,this);else for(var r=n._content,i=r.length,o=0;o<i;o++)e++,t(r[o],e,this);n=n._right}}},{key:Symbol.iterator,value:function(){return{next:function(){for(;null!==this._item&&(this._item._deleted||this._item._length<=this._itemElement);)this._item=this._item._right,this._itemElement=0;if(null===this._item)return{done:!0};var t=void 0;return t=this._item instanceof Type?this._item:this._item._content[this._itemElement++],{value:t,done:!1}},_item:this._start,_itemElement:0,_count:0}}},{key:"delete",value:function(t){var e=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1;if(this._y.transact(function(){for(var r=e._start,i=0;null!==r&&n>0;){if(!r._deleted&&r._countable)if(i<=t&&t<i+r._length){var o=t-i;r=r._splitAt(e._y,o),r._splitAt(e._y,n),n-=r._length,r._delete(e._y),i+=o}else i+=r._length;r=r._right}}),n>0)throw new Error("Delete exceeds the range of the YArray")}},{key:"insertAfter",value:function(t,e){var n=this;return this._transact(function(r){var i=void 0;i=null===t?n._start:t._right;for(var o=null,a=0;a<e.length;a++){var s=e[a];"function"==typeof s&&(s=new s),s instanceof Type?(null!==o&&(null!==r&&o._integrate(r),t=o,o=null),s._origin=t,s._left=t,s._right=i,s._right_origin=i,s._parent=n,null!==r?s._integrate(r):null===t?n._start=s:t._right=s,t=s):(null===o&&(o=new ItemJSON,o._origin=t,o._left=t,o._right=i,o._right_origin=i,o._parent=n,o._content=[]),o._content.push(s))}null!==o&&(null!==r?o._integrate(r):null===o._left&&(n._start=o))}),e}},{key:"insert",value:function(t,e){var n=this;this._transact(function(){for(var r=null,i=n._start,o=0,a=n._y;null!==i;){var s=i._deleted?0:i._length-1;if(o<=t&&t<=o+s){var l=t-o;i=i._splitAt(a,l),r=i._left,o+=l;break}i._deleted||(o+=i._length),r=i,i=i._right}if(t>o)throw new Error("Index exceeds array range!");n.insertAfter(r,e)})}},{key:"push",value:function(t){for(var e=this._start,n=null;null!==e;)e._deleted||(n=e),e=e._right;this.insertAfter(n,t)}},{key:"_logString",value:function(){return y("YArray",this,"start:"+p(this._start)+'"')}},{key:"length",get:function(){for(var t=0,e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._length),e=e._right;return t}}]),YArray}(Type),YMapEvent=function(t){function YMapEvent(t,e,n){Et(this,YMapEvent);var r=At(this,(YMapEvent.__proto__||Object.getPrototypeOf(YMapEvent)).call(this,t));return r.keysChanged=e,r.remote=n,r}return Tt(YMapEvent,t),YMapEvent}(YEvent),YMap=function(t){function YMap(){return Et(this,YMap),At(this,(YMap.__proto__||Object.getPrototypeOf(YMap)).apply(this,arguments))}return Tt(YMap,t),Ut(YMap,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YMapEvent(this,e,n))}},{key:"toJSON",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];if(!l._deleted){var u=void 0;u=l instanceof Type?void 0!==l.toJSON?l.toJSON():l.toString():l._content[0],t[s]=u}}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"keys",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0];a[1]._deleted||t.push(s)}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"delete",value:function(t){var e=this;this._transact(function(n){var r=e._map.get(t);null!==n&&void 0!==r&&r._delete(n)})}},{key:"set",value:function(t,e){var n=this;return this._transact(function(r){var i=n._map.get(t)||null;if(null!==i){if(i.constructor===ItemJSON&&!i._deleted&&i._content[0]===e)return e;null!==r&&i._delete(r)}var o=void 0;"function"==typeof e?(o=new e,e=o):e instanceof Item?o=e:(o=new ItemJSON,o._content=[e]),o._right=i,o._right_origin=i,o._parent=n,o._parentSub=t,null!==r?o._integrate(r):n._map.set(t,o)}),e}},{key:"get",value:function(t){var e=this._map.get(t);if(void 0!==e&&!e._deleted)return e instanceof Type?e:e._content[e._content.length-1]}},{key:"has",value:function(t){var e=this._map.get(t);return void 0!==e&&!e._deleted}},{key:"_logString",value:function(){return y("YMap",this,"mapSize:"+this._map.size)}}]),YMap}(Type),Ht=function(t){function e(){Et(this,e);var t=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.embed=null,t}return Tt(e,t),Ut(e,[{key:"_copy",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.embed=this.embed,r}},{key:"_fromBinary",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.embed=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(JSON.stringify(this.embed))}},{key:"_logString",value:function(){return y("ItemEmbed",this,"embed:"+JSON.stringify(this.embed))}},{key:"_length",get:function(){return 1}}]),e}(Item),Jt=function(t){function e(){Et(this,e);var t=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.key=null,t.value=null,t}return Tt(e,t),Ut(e,[{key:"_copy",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.key=this.key,r.value=this.value,r}},{key:"_fromBinary",value:function(t,n){var r=Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.key=n.readVarString(),this.value=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.key),t.writeVarString(JSON.stringify(this.value))}},{key:"_logString",value:function(){return y("ItemFormat",this,"key:"+JSON.stringify(this.key)+",value:"+JSON.stringify(this.value))}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!1}}]),e}(Item),zt=function(t){function e(t,n,r){Et(this,e);var i=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n,r));return i._delta=null,i}return Tt(e,t),Ut(e,[{key:"delta",get:function(){var t=this;if(null===this._delta){var e=this.target._y;e.transact(function(){var n=t.target._start,r=[],i=t.addedElements,o=t.removedElements;t._delta=r;for(var a=null,s={},l=new Map,u=new Map,c="",h=0,f=0,d=function(){if(null!==a){var t=void 0;switch(a){case"delete":t={delete:f},f=0;break;case"insert":if(t={insert:c},l.size>0){t.attributes={};var e=!0,n=!1,i=void 0;try{for(var o,u=l[Symbol.iterator]();!(e=(o=u.next()).done);e=!0){var d=xt(o.value,2),_=d[0],v=d[1];null!==v&&(t.attributes[_]=v)}}catch(t){n=!0,i=t}finally{try{!e&&u.return&&u.return()}finally{if(n)throw i}}}c="";break;case"retain":if(t={retain:h},Object.keys(s).length>0){t.attributes={};for(var _ in s)t.attributes[_]=s[_]}h=0}r.push(t),a=null}};null!==n;){switch(n.constructor){case Ht:i.has(n)?(d(),a="insert",c=n.embed,d()):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=1):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=1);break;case ItemString:i.has(n)?("insert"!==a&&(d(),a="insert"),c+=n._content):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=n._length):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=n._length);break;case Jt:if(i.has(n)){(l.get(n.key)||null)!==n.value?("retain"===a&&d(),n.value===(u.get(n.key)||null)?delete s[n.key]:s[n.key]=n.value):n._delete(e)}else if(o.has(n)){u.set(n.key,n.value);var _=l.get(n.key)||null;_!==n.value&&("retain"===a&&d(),s[n.key]=_)}else if(!1===n._deleted){u.set(n.key,n.value);var v=s[n.key];void 0!==v&&(v!==n.value?("retain"===a&&d(),null===n.value?s[n.key]=n.value:delete s[n.key]):n._delete(e))}!1===n._deleted&&("insert"===a&&d(),B(l,n))}n=n._right}for(d();t._delta.length>0;){var p=t._delta[t._delta.length-1];if(void 0===p.retain||void 0!==p.attributes)break;t._delta.pop()}})}return this._delta}}]),e}(YArrayEvent),YText=function(t){function YText(t){Et(this,YText);var e=At(this,(YText.__proto__||Object.getPrototypeOf(YText)).call(this));if("string"==typeof t){var n=new ItemString;n._parent=e,n._content=t,e._start=n}return e}return Tt(YText,t),Ut(YText,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new zt(this,n,t))}},{key:"toString",value:function(){for(var t="",e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._content),e=e._right;return t}},{key:"applyDelta",value:function(t){var e=this;this._transact(function(n){for(var r=null,i=e._start,o=new Map,a=0;a<t.length;a++){var s=t[a];if(void 0!==s.insert){var l=x(n,s.insert,e,r,i,o,s.attributes||{}),u=xt(l,2);r=u[0],i=u[1]}else if(void 0!==s.retain){var c=I(n,s.retain,e,r,i,o,s.attributes||{}),h=xt(c,2);r=h[0],i=h[1]}else if(void 0!==s.delete){var f=D(n,s.delete,e,r,i,o),d=xt(f,2);r=d[0],i=d[1]}}})}},{key:"toDelta",value:function(){function t(){if(r.length>0){var t={},i=!1,o=!0,a=!1,s=void 0;try{for(var l,u=n[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=xt(l.value,2),h=c[0],f=c[1];i=!0,t[h]=f}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}var d={insert:r};i&&(d.attributes=t),e.push(d),r=""}}for(var e=[],n=new Map,r="",i=this._start;null!==i;){if(!i._deleted)switch(i.constructor){case ItemString:r+=i._content;break;case Jt:t(),B(n,i)}i=i._right}return t(),e}},{key:"insert",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};e.length<=0||this._transact(function(i){var o=E(n,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"insertEmbed",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(e.constructor!==Object)throw new Error("Embed must be an Object");this._transact(function(i){var o=E(n,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"delete",value:function(t,e){var n=this;0!==e&&this._transact(function(r){var i=E(n,t),o=xt(i,3),a=o[0],s=o[1],l=o[2];D(r,e,n,a,s,l)})}},{key:"format",value:function(t,e,n){var r=this;this._transact(function(i){var o=E(r,t),a=xt(o,3),s=a[0],l=a[1],u=a[2];null!==l&&I(i,e,r,s,l,u,n)})}},{key:"_logString",value:function(){return y("YText",this)}}]),YText}(YArray),YXmlHook=function(t){function YXmlHook(t){Et(this,YXmlHook);var e=At(this,(YXmlHook.__proto__||Object.getPrototypeOf(YXmlHook)).call(this));return e.hookName=null,void 0!==t&&(e.hookName=t),e}return Tt(YXmlHook,t),Ut(YXmlHook,[{key:"_copy",value:function(){var t=Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_copy",this).call(this);return t.hookName=this.hookName,t}},{key:"toDom",value:function(){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},e=arguments[2],n=t[this.hookName],r=void 0;return r=void 0!==n?n.createDom(this):document.createElement(this.hookName),r.setAttribute("data-yjs-hook",this.hookName),R(e,r,this),r}},{key:"_fromBinary",value:function(t,e){var n=Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_fromBinary",this).call(this,t,e);return this.hookName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.hookName)}},{key:"_integrate",value:function(t){if(null===this.hookName)throw new Error("hookName must be defined!");Bt(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_integrate",this).call(this,t)}}]),YXmlHook}(YMap),Yt=function(){function t(e,n){Et(this,t),this._filter=n||function(){return!0},this._root=e,this._currentNode=e,this._firstCall=!0}return Ut(t,[{key:Symbol.iterator,value:function(){return this}},{key:"next",value:function(){var t=this._currentNode;if(this._firstCall&&(this._firstCall=!1,!t._deleted&&this._filter(t)))return{value:t,done:!1};do{if(t._deleted||t.constructor!==YXmlFragment._YXmlElement&&t.constructor!==YXmlFragment||null===t._start){for(;t!==this._root;){if(null!==t._right){t=t._right;break}t=t._parent}t===this._root&&(t=null)}else t=t._start;if(t===this._root)break}while(null!==t&&(t._deleted||!this._filter(t)));return this._currentNode=t,null===t?{done:!0}:{value:t,done:!1}}}]),t}(),YXmlEvent=function(t){function YXmlEvent(t,e,n,r){Et(this,YXmlEvent);var i=At(this,(YXmlEvent.__proto__||Object.getPrototypeOf(YXmlEvent)).call(this,t));return i._transaction=r,i.childListChanged=!1,i.attributesChanged=new Set,i.remote=n,e.forEach(function(t){null===t?i.childListChanged=!0:i.attributesChanged.add(t)}),i}return Tt(YXmlEvent,t),YXmlEvent}(YEvent),YXmlFragment=function(t){function YXmlFragment(){return Et(this,YXmlFragment),At(this,(YXmlFragment.__proto__||Object.getPrototypeOf(YXmlFragment)).apply(this,arguments))}return Tt(YXmlFragment,t),Ut(YXmlFragment,[{key:"createTreeWalker",value:function(t){return new Yt(this,t)}},{key:"querySelector",value:function(t){t=t.toUpperCase();var e=new Yt(this,function(e){return e.nodeName===t}),n=e.next();return n.done?null:n.value}},{key:"querySelectorAll",value:function(t){return t=t.toUpperCase(),Array.from(new Yt(this,function(e){return e.nodeName===t}))}},{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YXmlEvent(this,e,n,t))}},{key:"toString",value:function(){return this.map(function(t){return t.toString()}).join("")}},{key:"_delete",value:function(t,e,n){Bt(YXmlFragment.prototype.__proto__||Object.getPrototypeOf(YXmlFragment.prototype),"_delete",this).call(this,t,e,n)}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createDocumentFragment();return R(n,r,this),this.forEach(function(i){r.insertBefore(i.toDom(t,e,n),null)}),r}},{key:"_logString",value:function(){return y("YXml",this)}}]),YXmlFragment}(YArray),YXmlElement=function(t){function YXmlElement(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"UNDEFINED";Et(this,YXmlElement);var e=At(this,(YXmlElement.__proto__||Object.getPrototypeOf(YXmlElement)).call(this));return e.nodeName=t.toUpperCase(),e}return Tt(YXmlElement,t),Ut(YXmlElement,[{key:"_copy",value:function(){var t=Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_copy",this).call(this);return t.nodeName=this.nodeName,t}},{key:"_fromBinary",value:function(t,e){var n=Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_fromBinary",this).call(this,t,e);return this.nodeName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.nodeName)}},{key:"_integrate",value:function(t){if(null===this.nodeName)throw new Error("nodeName must be defined!");Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_integrate",this).call(this,t)}},{key:"toString",value:function(){var t=this.getAttributes(),e=[],n=[];for(var r in t)n.push(r);n.sort();for(var i=n.length,o=0;o<i;o++){var a=n[o];e.push(a+'="'+t[a]+'"')}var s=this.nodeName.toLocaleLowerCase();return"<"+s+(e.length>0?" "+e.join(" "):"")+">"+Bt(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"toString",this).call(this)+"</"+s+">"}},{key:"removeAttribute",value:function(t){return YMap.prototype.delete.call(this,t)}},{key:"setAttribute",value:function(t,e){return YMap.prototype.set.call(this,t,e)}},{key:"getAttribute",value:function(t){return YMap.prototype.get.call(this,t)}},{key:"getAttributes",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];l._deleted||(t[s]=l._content[0])}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createElement(this.nodeName),i=this.getAttributes();for(var o in i)r.setAttribute(o,i[o]);return this.forEach(function(i){r.appendChild(i.toDom(t,e,n))}),R(n,r,this),r}}]),YXmlElement}(YXmlFragment);YXmlFragment._YXmlElement=YXmlElement;var YXmlText=function(t){function YXmlText(){return Et(this,YXmlText),At(this,(YXmlText.__proto__||Object.getPrototypeOf(YXmlText)).apply(this,arguments))}return Tt(YXmlText,t),Ut(YXmlText,[{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments[2],n=t.createTextNode(this.toString());return R(e,n,this),n}},{key:"_delete",value:function(t,e,n){Bt(YXmlText.prototype.__proto__||Object.getPrototypeOf(YXmlText.prototype),"_delete",this).call(this,t,e,n)}}]),YXmlText}(YText),Ft=new Map,Xt=new Map;X(0,ItemJSON),X(1,ItemString),X(10,Jt),X(11,Ht),X(2,Delete),X(3,YArray),X(4,YMap),X(5,YText),X(6,YXmlFragment),X(7,YXmlElement),X(8,YXmlText),X(9,YXmlHook),X(12,Lt);var qt=16777215,$t=function(){function t(e,n){Et(this,t),this.user=qt,this.name=e,this.type=$(n)}return Ut(t,[{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.name===this.name&&t.type===this.type}},{key:"lessThan",value:function(e){return e.constructor!==t||(this.user<e.user||this.user===e.user&&(this.name<e.name||this.name===e.name&&this.type<e.type))}}]),t}(),Gt=function(t){function e(t){Et(this,e);var n=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return n.y=t,n}return Tt(e,t),Ut(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){e.constructor===Lt?t.push({id:p(e),content:e._length,deleted:"GC"}):t.push({id:p(e),origin:p(null===e._origin?null:e._origin._lastId),left:p(null===e._left?null:e._left._lastId),right:p(e._right),right_origin:p(e._right_origin),parent:p(e._parent),parentSub:e._parentSub,deleted:e._deleted,content:JSON.stringify(e._content)})}),console.table(t)}},{key:"get",value:function(t){var e=this.find(t);if(null===e&&t instanceof $t){var n=q(t.type),r=this.y;e=new n,e._id=t,e._parent=r,r.transact(function(){e._integrate(r)}),this.put(e)}return e}},{key:"getItem",value:function(t){var e=this.findWithUpperBound(t);if(null===e)return null;var n=e._id;return t.user===n.user&&t.clock<n.clock+e._length?e:null}},{key:"getItemCleanStart",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock===t.clock?e:e._splitAt(this.y,t.clock-n.clock)}},{key:"getItemCleanEnd",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock+e._length-1===t.clock?e:(e._splitAt(this.y,t.clock-n.clock+1),e)}}]),e}(Dt),Zt=function(){function t(e){Et(this,t),
this.y=e,this.state=new Map}return Ut(t,[{key:"logTable",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this.state[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=xt(i.value,2),s=a[0],l=a[1];t.push({user:s,state:l})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}console.table(t)}},{key:"getNextID",value:function(t){var e=this.y.userID,n=this.getState(e);return this.setState(e,n+t),new Pt(e,n)}},{key:"updateRemoteState",value:function(t){for(var e=t._id.user,n=this.state.get(e);null!==t&&t._id.clock===n;)n+=t._length,t=this.y.os.get(new Pt(e,n));this.state.set(e,n)}},{key:"getState",value:function(t){var e=this.state.get(t);return null==e?0:e}},{key:"setState",value:function(t,e){var n=this.y._transaction.beforeState;n.has(t)||n.set(t,this.getState(t)),this.state.set(t,e)}}]),t}(),Qt=function(){function t(){Et(this,t),this._eventListener=new Map,this._stateListener=new Map}return Ut(t,[{key:"_getListener",value:function(t){var e=this._eventListener.get(t);return void 0===e&&(e={once:new Set,on:new Set},this._eventListener.set(t,e)),e}},{key:"once",value:function(t,e){this._getListener(t).once.add(e)}},{key:"on",value:function(t,e){this._getListener(t).on.add(e)}},{key:"_initStateListener",value:function(t){var e=this._stateListener.get(t);return void 0===e&&(e={},e.promise=new Promise(function(t){e.resolve=t}),this._stateListener.set(t,e)),e}},{key:"when",value:function(t){return this._initStateListener(t).promise}},{key:"off",value:function(t,e){if(null==t||null==e)throw new Error("You must specify event name and function!");var n=this._eventListener.get(t);void 0!==n&&(n.on.delete(e),n.once.delete(e))}},{key:"emit",value:function(t){for(var e=arguments.length,n=Array(e>1?e-1:0),r=1;r<e;r++)n[r-1]=arguments[r];this._initStateListener(t).resolve();var i=this._eventListener.get(t);void 0!==i?(i.on.forEach(function(t){return t.apply(null,n)}),i.once.forEach(function(t){return t.apply(null,n)}),i.once=new Set):"error"===t&&console.error(n[0])}},{key:"destroy",value:function(){this._eventListener=null}}]),t}(),Kt=function(){function t(e,n){Et(this,t),this.type=e,this.target=n,this._mutualExclude=K()}return Ut(t,[{key:"destroy",value:function(){this.type=null,this.target=null}}]),t}(),te=null,ee="undefined"!=typeof getSelection?tt:function(){return null},ne=function(t){function e(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};Et(this,e);var i=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));i.opts=r,r.document=r.document||document,r.hooks=r.hooks||{},i.scrollingElement=r.scrollingElement||null,i.domToType=new Map,i.typeToDom=new Map,i.filter=r.filter||j,n.innerHTML="",t.forEach(function(t){n.insertBefore(t.toDom(r.document,r.hooks,i),null)}),i._typeObserver=ot.bind(i),i._domObserver=function(t){lt.call(i,t,r.document)},t.observeDeep(i._typeObserver),i._mutationObserver=new MutationObserver(i._domObserver),i._mutationObserver.observe(n,{childList:!0,attributes:!0,characterData:!0,subtree:!0}),i._currentSel=null,document.addEventListener("selectionchange",function(){i._currentSel=ee(i)});var o=t._y;return i.y=o,i._beforeTransactionHandler=function(t,e,n){i._domObserver(i._mutationObserver.takeRecords()),i._mutualExclude(function(){et(i,n)})},o.on("beforeTransaction",i._beforeTransactionHandler),i._afterTransactionHandler=function(t,e,n){i._mutualExclude(function(){nt(i,n)}),e.deletedStructs.forEach(function(t){var e=i.typeToDom.get(t);void 0!==e&&C(i,e,t)})},o.on("afterTransaction",i._afterTransactionHandler),i._beforeObserverCallsHandler=function(t,e){e.changedTypes.forEach(function(e,n){(e.size>1||1===e.size&&!1===e.has(null))&&V(t,i,n)}),e.newTypes.forEach(function(e){V(t,i,e)})},o.on("beforeObserverCalls",i._beforeObserverCallsHandler),R(i,n,t),i}return Tt(e,t),Ut(e,[{key:"setFilter",value:function(t){this.filter=t}},{key:"_getUndoStackInfo",value:function(){return this.getSelection()}},{key:"_restoreUndoStackInfo",value:function(t){this.restoreSelection(t)}},{key:"getSelection",value:function(){return this._currentSel}},{key:"restoreSelection",value:function(t){if(null!==t){var e=t.to,n=t.from,r=getSelection(),i=r.baseNode,o=r.baseOffset,a=r.extentNode,s=r.extentOffset;if(null!==n){var l=Q(this.y,n);if(null!==l){var u=this.typeToDom.get(l.type),c=l.offset;u===i&&c===o||(i=u,o=c)}}if(null!==e){var h=Q(this.y,e);if(null!==h){var f=this.typeToDom.get(h.type),d=h.offset;f===a&&d===s||(a=f,s=d)}}r.setBaseAndExtent(i,o,a,s)}}},{key:"destroy",value:function(){this.domToType=null,this.typeToDom=null,this.type.unobserveDeep(this._typeObserver),this._mutationObserver.disconnect();var t=this.type._y;t.off("beforeTransaction",this._beforeTransactionHandler),t.off("beforeObserverCalls",this._beforeObserverCallsHandler),t.off("afterTransaction",this._afterTransactionHandler),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),Y=function(t){function Y(t,e,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{};Et(this,Y);var i=At(this,(Y.__proto__||Object.getPrototypeOf(Y)).call(this));i.gcEnabled=r.gc||!1,i.room=t,null!=e&&(e.connector.room=t),i._contentReady=!1,i._opts=e,"number"!=typeof e.userID?i.userID=G():i.userID=e.userID,i.share={},i.ds=new Nt(i),i.os=new Gt(i),i.ss=new Zt(i),i._missingStructs=new Map,i._readyToIntegrate=[],i._transaction=null,i.connector=null,i.connected=!1;var o=function(){null!=e&&(i.connector=new Y[e.connector.name](i,e.connector),i.connected=!0,i.emit("connectorReady"))};return i.persistence=null,null!=n?(i.persistence=n,n._init(i).then(o)):o(),i._parent=null,i._hasUndoManager=!1,i}return Tt(Y,t),Ut(Y,[{key:"_setContentReady",value:function(){this._contentReady||(this._contentReady=!0,this.emit("content"))}},{key:"whenContentReady",value:function(){var t=this;return this._contentReady?Promise.resolve():new Promise(function(e){t.once("content",e)})}},{key:"_beforeChange",value:function(){}},{key:"transact",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=null===this._transaction;n&&(this._transaction=new Rt(this),this.emit("beforeTransaction",this,this._transaction,e));try{t(this)}catch(t){console.error(t)}if(n){this.emit("beforeObserverCalls",this,this._transaction,e);var r=this._transaction;this._transaction=null,r.changedTypes.forEach(function(t,n){n._deleted||n._callObserver(r,t,e)}),r.changedParentTypes.forEach(function(t,e){e._deleted||(t=t.filter(function(t){return!t.target._deleted}),t.forEach(function(t){t.currentTarget=e}),e._deepEventHandler.callEventListeners(r,t))}),this.emit("afterTransaction",this,r,e)}}},{key:"define",value:function(t,e){var n=new $t(t,e),r=this.os.get(n);if(void 0===this.share[t])this.share[t]=r;else if(this.share[t]!==r)throw new Error("Type is already defined with a different constructor");return r}},{key:"get",value:function(t){return this.share[t]}},{key:"disconnect",value:function(){return this.connected?(this.connected=!1,this.connector.disconnect()):Promise.resolve()}},{key:"reconnect",value:function(){return this.connected?Promise.resolve():(this.connected=!0,this.connector.reconnect())}},{key:"destroy",value:function(){Bt(Y.prototype.__proto__||Object.getPrototypeOf(Y.prototype),"destroy",this).call(this),this.share=null,null!=this.connector&&(null!=this.connector.destroy?this.connector.destroy():this.connector.disconnect()),null!==this.persistence&&(this.persistence.deinit(this),this.persistence=null),this.os=null,this.ds=null,this.ss=null}},{key:"_start",get:function(){return null},set:function(t){return null}}]),Y}(Qt);Y.extend=function(){for(var t=0;t<arguments.length;t++){var e=arguments[t];if("function"!=typeof e)throw new Error("Expected a function!");e(Y)}};var re=function t(e,n,r){var i=this;Et(this,t),this.created=new Date;var o=n.beforeState;o.has(e.userID)?(this.toState=new Pt(e.userID,e.ss.getState(e.userID)-1),this.fromState=new Pt(e.userID,o.get(e.userID))):(this.toState=null,this.fromState=null),this.deletedStructs=new Set,n.deletedStructs.forEach(function(t){i.deletedStructs.add({from:t._id,len:t._length})}),this.bindingInfos=r},ie=function(){function t(e){var n=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};Et(this,t),this.options=r,this._bindings=new Set(r.bindings),r.captureTimeout=null==r.captureTimeout?500:r.captureTimeout,this._undoBuffer=[],this._redoBuffer=[],this._scope=e,this._undoing=!1,this._redoing=!1,this._lastTransactionWasUndo=!1;var i=e._y;this.y=i,i._hasUndoManager=!0;var o=void 0;i.on("beforeTransaction",function(t,e,r){r||(o=new Map,n._bindings.forEach(function(t){o.set(t,t._getUndoStackInfo())}))}),i.on("afterTransaction",function(t,i,a){if(!a&&i.changedParentTypes.has(e)){var s=new re(t,i,o);if(n._undoing)n._lastTransactionWasUndo=!0,n._redoBuffer.push(s);else{var l=n._undoBuffer.length>0?n._undoBuffer[n._undoBuffer.length-1]:null;!1===n._redoing&&!1===n._lastTransactionWasUndo&&null!==l&&(r.captureTimeout<0||s.created-l.created<=r.captureTimeout)?(l.created=s.created,null!==s.toState&&(l.toState=s.toState,null===l.fromState&&(l.fromState=s.fromState)),s.deletedStructs.forEach(l.deletedStructs.add,l.deletedStructs)):(n._lastTransactionWasUndo=!1,n._undoBuffer.push(s)),n._redoing||(n._redoBuffer=[])}}})}return Ut(t,[{key:"flushChanges",value:function(){this._lastTransactionWasUndo=!0}},{key:"undo",value:function(){this._undoing=!0;var t=ut(this.y,this._scope,this._undoBuffer);return this._undoing=!1,t}},{key:"redo",value:function(){this._redoing=!0;var t=ut(this.y,this._scope,this._redoBuffer);return this._redoing=!1,t}}]),t}(),oe=1e3,ae=60*oe,se=60*ae,le=24*se,ue=365.25*le,ce=function(t,e){e=e||{};var n=void 0===t?"undefined":Ot(t);if("string"===n&&t.length>0)return ht(t);if("number"===n&&!1===isNaN(t))return e.long?dt(t):ft(t);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(t))},he=Object.freeze({default:ce,__moduleExports:ce}),fe=he&&ce||he,de=ct(function(t,e){function n(t){var n,r=0;for(n in t)r=(r<<5)-r+t.charCodeAt(n),r|=0;return e.colors[Math.abs(r)%e.colors.length]}function r(t){function r(){if(r.enabled){var t=r,n=+new Date,i=n-(l||n);t.diff=i,t.prev=l,t.curr=n,l=n;for(var o=new Array(arguments.length),a=0;a<o.length;a++)o[a]=arguments[a];o[0]=e.coerce(o[0]),"string"!=typeof o[0]&&o.unshift("%O");var s=0;o[0]=o[0].replace(/%([a-zA-Z%])/g,function(n,r){if("%%"===n)return n;s++;var i=e.formatters[r];if("function"==typeof i){var a=o[s];n=i.call(t,a),o.splice(s,1),s--}return n}),e.formatArgs.call(t,o);(r.log||e.log||console.log.bind(console)).apply(t,o)}}return r.namespace=t,r.enabled=e.enabled(t),r.useColors=e.useColors(),r.color=n(t),"function"==typeof e.init&&e.init(r),r}function i(t){e.save(t),e.names=[],e.skips=[];for(var n=("string"==typeof t?t:"").split(/[\s,]+/),r=n.length,i=0;i<r;i++)n[i]&&(t=n[i].replace(/\*/g,".*?"),"-"===t[0]?e.skips.push(new RegExp("^"+t.substr(1)+"$")):e.names.push(new RegExp("^"+t+"$")))}function o(){e.enable("")}function a(t){var n,r;for(n=0,r=e.skips.length;n<r;n++)if(e.skips[n].test(t))return!1;for(n=0,r=e.names.length;n<r;n++)if(e.names[n].test(t))return!0;return!1}function s(t){return t instanceof Error?t.stack||t.message:t}e=t.exports=r.debug=r.default=r,e.coerce=s,e.disable=o,e.enable=i,e.enabled=a,e.humanize=fe,e.names=[],e.skips=[],e.formatters={};var l}),_e=de.coerce,ve=de.disable,pe=de.enable,ye=de.enabled,ge=de.humanize,me=de.names,ke=de.skips,be=de.formatters,we=Object.freeze({default:de,__moduleExports:de,coerce:_e,disable:ve,enable:pe,enabled:ye,humanize:ge,names:me,skips:ke,formatters:be}),Se=we&&de||we,Oe=ct(function(t,e){function n(){return!("undefined"==typeof window||!window.process||"renderer"!==window.process.type)||("undefined"!=typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"undefined"!=typeof window&&window.console&&(window.console.firebug||window.console.exception&&window.console.table)||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))}function r(t){var n=this.useColors;if(t[0]=(n?"%c":"")+this.namespace+(n?" %c":" ")+t[0]+(n?"%c ":" ")+"+"+e.humanize(this.diff),n){var r="color: "+this.color;t.splice(1,0,r,"color: inherit");var i=0,o=0;t[0].replace(/%[a-zA-Z%]/g,function(t){"%%"!==t&&(i++,"%c"===t&&(o=i))}),t.splice(o,0,r)}}function i(){return"object"===("undefined"==typeof console?"undefined":Ot(console))&&console.log&&Function.prototype.apply.call(console.log,console,arguments)}function o(t){try{null==t?e.storage.removeItem("debug"):e.storage.debug=t}catch(t){}}function a(){var t;try{t=e.storage.debug}catch(t){}return!t&&"undefined"!=typeof process&&"env"in process&&(t=process.env.DEBUG),t}e=t.exports=Se,e.log=i,e.formatArgs=r,e.save=o,e.load=a,e.useColors=n,e.storage="undefined"!=typeof chrome&&void 0!==chrome.storage?chrome.storage.local:function(){try{return window.localStorage}catch(t){}}(),e.colors=["lightseagreen","forestgreen","goldenrod","dodgerblue","darkorchid","crimson"],e.formatters.j=function(t){try{return JSON.stringify(t)}catch(t){return"[UnexpectedJSONParseError]: "+t.message}},e.enable(a())}),Ee=(Oe.log,Oe.formatArgs,Oe.save,Oe.load,Oe.useColors,Oe.storage,Oe.colors,function(){function t(e,n){if(Et(this,t),this.y=e,this.opts=n,null==n.role||"master"===n.role)this.role="master";else{if("slave"!==n.role)throw new Error("Role must be either 'master' or 'slave'!");this.role="slave"}this.log=Oe("y:connector"),this.logMessage=Oe("y:connector-message"),this._forwardAppliedStructs=n.forwardAppliedOperations||!1,this.role=n.role,this.connections=new Map,this.isSynced=!1,this.userEventListeners=[],this.whenSyncedListeners=[],this.currentSyncTarget=null,this.debug=!0===n.debug,this.broadcastBuffer=new Ct,this.broadcastBufferSize=0,this.protocolVersion=11,this.authInfo=n.auth||null,this.checkAuth=n.checkAuth||function(){return Promise.resolve("write")},null==n.maxBufferLength?this.maxBufferLength=-1:this.maxBufferLength=n.maxBufferLength}return Ut(t,[{key:"reconnect",value:function(){this.log("reconnecting..")}},{key:"disconnect",value:function(){return this.log("discronnecting.."),this.connections=new Map,this.isSynced=!1,this.currentSyncTarget=null,this.whenSyncedListeners=[],Promise.resolve()}},{key:"onUserEvent",value:function(t){this.userEventListeners.push(t)}},{key:"removeUserEventListener",value:function(t){this.userEventListeners=this.userEventListeners.filter(function(e){return t!==e})}},{key:"userLeft",value:function(t){if(this.connections.has(t)){this.log("%s: User left %s",this.y.userID,t),this.connections.delete(t),this._setSyncedWith(null);var e=!0,n=!1,r=void 0;try{for(var i,o=this.userEventListeners[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){(0,i.value)({action:"userLeft",user:t})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}}}},{key:"userJoined",value:function(t,e,n){if(null==e)throw new Error("You must specify the role of the joined user!");if(this.connections.has(t))throw new Error("This user already joined!");this.log("%s: User joined %s",this.y.userID,t),this.connections.set(t,{uid:t,isSynced:!1,role:e,processAfterAuth:[],processAfterSync:[],auth:n||null,receivedSyncStep2:!1});var r={};r.promise=new Promise(function(t){r.resolve=t}),this.connections.get(t).syncStep2=r;var i=!0,o=!1,a=void 0;try{for(var s,l=this.userEventListeners[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){(0,s.value)({action:"userJoined",user:t,role:e})}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}this._syncWithUser(t)}},{key:"whenSynced",value:function(t){this.isSynced?t():this.whenSyncedListeners.push(t)}},{key:"_syncWithUser",value:function(t){"slave"!==this.role&&u(this,t)}},{key:"_fireIsSyncedListeners",value:function(){if(!this.isSynced){this.isSynced=!0;var t=!0,e=!1,n=void 0;try{for(var r,i=this.whenSyncedListeners[Symbol.iterator]();!(t=(r=i.next()).done);t=!0){(0,r.value)()}}catch(t){e=!0,n=t}finally{try{!t&&i.return&&i.return()}finally{if(e)throw n}}this.whenSyncedListeners=[],this.y._setContentReady(),this.y.emit("synced")}}},{key:"send",value:function(t,e){var n=this.y;if(!(e instanceof ArrayBuffer||e instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s to User%s: Send '%y'",n.userID,t,e),this.logMessage("User%s to User%s: Send %Y",n.userID,t,[n,e])}},{key:"broadcast",value:function(t){var e=this.y;if(!(t instanceof ArrayBuffer||t instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s: Broadcast '%y'",e.userID,t),this.logMessage("User%s: Broadcast: %Y",e.userID,[e,t])}},{key:"broadcastStruct",value:function(t){var e=this,n=0===this.broadcastBuffer.length;if(n&&(this.broadcastBuffer.writeVarString(this.y.room),this.broadcastBuffer.writeVarString("update"),this.broadcastBufferSize=0,this.broadcastBufferSizePos=this.broadcastBuffer.pos,this.broadcastBuffer.writeUint32(0)),this.broadcastBufferSize++,t._toBinary(this.broadcastBuffer),this.maxBufferLength>0&&this.broadcastBuffer.length>this.maxBufferLength){var r=this.broadcastBuffer;r.setUint32(this.broadcastBufferSizePos,this.broadcastBufferSize),this.broadcastBuffer=new Ct,this.whenRemoteResponsive().then(function(){e.broadcast(r.createBuffer())})}else n&&setTimeout(function(){if(e.broadcastBuffer.length>0){var t=e.broadcastBuffer;t.setUint32(e.broadcastBufferSizePos,e.broadcastBufferSize),e.broadcast(t.createBuffer()),e.broadcastBuffer=new Ct}},0)}},{key:"whenRemoteResponsive",value:function(){return new Promise(function(t){setTimeout(t,100)})}},{key:"receiveMessage",value:function(t,e,n){var r=this,i=this.y,o=i.userID;if(n=n||!1,!(e instanceof ArrayBuffer||e instanceof Uint8Array))return Promise.reject(new Error("Expected Message to be an ArrayBuffer or Uint8Array!"));if(t===o)return Promise.resolve();var a=new Vt(e),s=new Ct,l=a.readVarString();s.writeVarString(l);var u=a.readVarString(),c=this.connections.get(t);if(this.log("User%s from User%s: Receive '%s'",o,t,u),this.logMessage("User%s from User%s: Receive %Y",o,t,[i,e]),null==c&&!n)throw new Error("Received message from unknown peer!");if("sync step 1"===u||"sync step 2"===u){var h=a.readVarUint();if(null==c.auth)return c.processAfterAuth.push([u,c,a,s,t]),this.checkAuth(h,i,t).then(function(t){null==c.auth&&(c.auth=t,i.emit("userAuthenticated",{user:c.uid,auth:t}));var e=c.processAfterAuth;c.processAfterAuth=[],e.forEach(function(t){return r.computeMessage(t[0],t[1],t[2],t[3],t[4])})})}!n&&null==c.auth||"update"===u&&!c.isSynced?c.processAfterSync.push([u,c,a,s,t,!1]):this.computeMessage(u,c,a,s,t,n)}},{key:"computeMessage",value:function(t,e,n,i,o,a){if("sync step 1"!==t||"write"!==e.auth&&"read"!==e.auth){var s=this.y;s.transact(function(){if("sync step 2"===t&&"write"===e.auth)d(n,i,s,e,o);else{if("update"!==t||!a&&"write"!==e.auth)throw new Error("Unable to receive message");r(s,n)}},!0)}else h(n,i,this.y,e,o)}},{key:"_setSyncedWith",value:function(t){var e=this;if(null!=t){var n=this.connections.get(t);n.isSynced=!0;var r=n.processAfterSync;n.processAfterSync=[],r.forEach(function(t){e.computeMessage(t[0],t[1],t[2],t[3],t[4])})}var i=Array.from(this.connections.values());i.length>0&&i.every(function(t){return t.isSynced})&&this._fireIsSyncedListeners()}}]),t}()),Ue=function(){function t(e){Et(this,t),this.opts=e,this.ys=new Map}return Ut(t,[{key:"_init",value:function(t){var e=this,n=this.ys.get(t);return void 0===n?(n=yt(),n.mutualExclude=K(),this.ys.set(t,n),this.init(t).then(function(){return t.on("afterTransaction",function(t,n){var r=e.ys.get(t);if(r.len>0){r.buffer.setUint32(0,r.len),e.saveUpdate(t,r.buffer.createBuffer(),n);var i=yt();for(var o in i)r[o]=i[o]}}),e.retrieve(t)}).then(function(){return Promise.resolve(n)})):Promise.resolve(n)}},{key:"deinit",value:function(t){this.ys.delete(t),t.persistence=null}},{key:"destroy",value:function(){this.ys=null}},{key:"removePersistedData",value:function(t){var e=this,n=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];this.ys.forEach(function(r,i){i.room===t&&(n?i.destroy():e.deinit(i))})}},{key:"saveUpdate",value:function(t){}},{key:"saveStruct",value:function(t,e){var n=this.ys.get(t);void 0!==n&&n.mutualExclude(function(){e._toBinary(n.buffer),n.len++})}},{key:"retrieve",value:function(t,e,n){var i=this.ys.get(t);void 0!==i&&i.mutualExclude(function(){t.transact(function(){if(null!=e&&vt(t,new Vt(new Uint8Array(e))),null!=n)for(var i=0;i<n.length;i++)r(t,new Vt(new Uint8Array(n[i])))}),t.emit("persistenceReady")})}},{key:"persist",value:function(t){return pt(t).createBuffer()}}]),t}(),Be=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.value=t.toString(),r._typeObserver=gt.bind(r),r._domObserver=mt.bind(r),t.observe(r._typeObserver),n.addEventListener("input",r._domObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._domObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),Te=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setContents(t.toDelta(),"yjs"),r._typeObserver=kt.bind(r),r._quillObserver=bt.bind(r),t.observe(r._typeObserver),n.on("text-change",r._quillObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.off("text-change",this._quillObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt),Ae=function(t){function e(t,n){Et(this,e);var r=At(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setValue(t.toString()),r._typeObserver=wt.bind(r),r._codeMirrorObserver=St.bind(r),t.observe(r._typeObserver),n.on("changes",r._codeMirrorObserver),r}return Tt(e,t),Ut(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._codeMirrorObserver),Bt(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Kt);return Y.AbstractConnector=Ee,Y.AbstractPersistence=Ue,Y.Array=YArray,Y.Map=YMap,Y.Text=YText,Y.XmlElement=YXmlElement,Y.XmlFragment=YXmlFragment,Y.XmlText=YXmlText,Y.XmlHook=YXmlHook,Y.TextareaBinding=Be,Y.QuillBinding=Te,Y.DomBinding=ne,Y.CodeMirrorBinding=Ae,ne.domToType=L,ne.domsToTypes=J,ne.switchAssociation=W,Y.utils={BinaryDecoder:Vt,UndoManager:ie,getRelativePosition:Z,fromRelativePosition:Q,registerStruct:X,integrateRemoteStructs:r,toBinary:pt,fromBinary:vt},Y.debug=Oe,Oe.formatters.Y=_,Oe.formatters.y=v,Y});


}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":4,"buffer":2}],7:[function(require,module,exports){
var Y = require('yjs');
window.Y = Y;
require('y-webrtc3')(Y);

var yid = window.location.pathname.replace(/\//g, '__');
var y = new Y(yid, {
    connector: {
        name: 'webrtc',
        room: yid,
        url: 'https://finwin.io:1256'
    }
});
window.y = y;

function start_ybindings() {
    if (typeof window.shared_elements_available !== 'undefined'
        && typeof Jupyter !== 'undefined'
        && typeof Jupyter.notebook !== 'undefined'
        && Jupyter.notebook._fully_loaded) {

        for (var id in shared_elements) {
            var codemirror = shared_elements[id]['codemirror'];
            new Y.CodeMirrorBinding(y.define('codemirror'+id, Y.Text), codemirror);

            var output = shared_elements[id]['output'];
            new Y.DomBinding(y.define('xml'+id, Y.XmlFragment), output);
        }
        
        window.get_inactive_cell = function(type) {
            var cells = Jupyter.notebook.get_cells();
            for (var i=0; i<cells.length; i++) {
                if (
                    cells[i].element.find('.input_area').data('active') === 'no'
                    && cells[i].cell_type === type
                    ) {
                    return cells[i];
                }
            }
        }
        
        window.get_cell = function (id) {
            var cells = Jupyter.notebook.get_cells();
            for (var i=0; i<cells.length; i++) {
                if (cells[i].element.find('.input_area').data('id') === id) {
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
            if (parseInt(id) !== parseInt(index)) {
                set_element(cell.element, index);
            }
            if (active === 'yes') {
                cell.element.find('.input_area').data('active', 'yes');
                cell.element.removeClass('hidden');
                cell.focus_cell();
            } else {
                cell.element.addClass('hidden');
                cell.set_text('');
                if (cell.cell_type === 'code') {
                    cell.output_area.clear_output();
                }
                cell.element.find('.input_area').data('active', 'no');
            }

            if (cell.cell_type === 'markdown') {
                cell.unrender();
                cell.render();
            }
        }

        window.resolve_ymap = true;
        var ymap = y.define('ymap', Y.Map);
        ymap.observe(function (e) {
            for (let key of e.keysChanged) {
                set_cell(key, ymap.get(key)['index'], ymap.get(key)['active']);
            }
        });
        if (window.resolve_ymap) {
            window.resolve_ymap = false;
            exec_ymap();
        }
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
    } else {
        setTimeout(start_ybindings, 0);
    }
}
start_ybindings();

},{"y-webrtc3":5,"yjs":6}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMveS13ZWJydGMuanMiLCJub2RlX21vZHVsZXMveWpzL3kuanMiLCJzcmMveW5vdGVib29rLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0J1xuXG5leHBvcnRzLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5leHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXlcbmV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IGZyb21CeXRlQXJyYXlcblxudmFyIGxvb2t1cCA9IFtdXG52YXIgcmV2TG9va3VwID0gW11cbnZhciBBcnIgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcgPyBVaW50OEFycmF5IDogQXJyYXlcblxudmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbmZvciAodmFyIGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG59XG5cbi8vIFN1cHBvcnQgZGVjb2RpbmcgVVJMLXNhZmUgYmFzZTY0IHN0cmluZ3MsIGFzIE5vZGUuanMgZG9lcy5cbi8vIFNlZTogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmFzZTY0I1VSTF9hcHBsaWNhdGlvbnNcbnJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxucmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG5cbmZ1bmN0aW9uIGdldExlbnMgKGI2NCkge1xuICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuXG4gIGlmIChsZW4gJSA0ID4gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gIH1cblxuICAvLyBUcmltIG9mZiBleHRyYSBieXRlcyBhZnRlciBwbGFjZWhvbGRlciBieXRlcyBhcmUgZm91bmRcbiAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYmVhdGdhbW1pdC9iYXNlNjQtanMvaXNzdWVzLzQyXG4gIHZhciB2YWxpZExlbiA9IGI2NC5pbmRleE9mKCc9JylcbiAgaWYgKHZhbGlkTGVuID09PSAtMSkgdmFsaWRMZW4gPSBsZW5cblxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gdmFsaWRMZW4gPT09IGxlblxuICAgID8gMFxuICAgIDogNCAtICh2YWxpZExlbiAlIDQpXG5cbiAgcmV0dXJuIFt2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuXVxufVxuXG4vLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKGI2NCkge1xuICB2YXIgbGVucyA9IGdldExlbnMoYjY0KVxuICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdXG4gIHJldHVybiAoKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0KSAtIHBsYWNlSG9sZGVyc0xlblxufVxuXG5mdW5jdGlvbiBfYnl0ZUxlbmd0aCAoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSB7XG4gIHJldHVybiAoKHZhbGlkTGVuICsgcGxhY2VIb2xkZXJzTGVuKSAqIDMgLyA0KSAtIHBsYWNlSG9sZGVyc0xlblxufVxuXG5mdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NClcbiAgdmFyIHZhbGlkTGVuID0gbGVuc1swXVxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXVxuXG4gIHZhciBhcnIgPSBuZXcgQXJyKF9ieXRlTGVuZ3RoKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikpXG5cbiAgdmFyIGN1ckJ5dGUgPSAwXG5cbiAgLy8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuICB2YXIgbGVuID0gcGxhY2VIb2xkZXJzTGVuID4gMFxuICAgID8gdmFsaWRMZW4gLSA0XG4gICAgOiB2YWxpZExlblxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTgpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHxcbiAgICAgIHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMyldXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDE2KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAyKSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMSkge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxMCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtID4+IDYgJiAweDNGXSArXG4gICAgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9XG4gICAgICAoKHVpbnQ4W2ldIDw8IDE2KSAmIDB4RkYwMDAwKSArXG4gICAgICAoKHVpbnQ4W2kgKyAxXSA8PCA4KSAmIDB4RkYwMCkgK1xuICAgICAgKHVpbnQ4W2kgKyAyXSAmIDB4RkYpXG4gICAgb3V0cHV0LnB1c2godHJpcGxldFRvQmFzZTY0KHRtcCkpXG4gIH1cbiAgcmV0dXJuIG91dHB1dC5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBwYXJ0cyA9IFtdXG4gIHZhciBtYXhDaHVua0xlbmd0aCA9IDE2MzgzIC8vIG11c3QgYmUgbXVsdGlwbGUgb2YgM1xuXG4gIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgZm9yICh2YXIgaSA9IDAsIGxlbjIgPSBsZW4gLSBleHRyYUJ5dGVzOyBpIDwgbGVuMjsgaSArPSBtYXhDaHVua0xlbmd0aCkge1xuICAgIHBhcnRzLnB1c2goZW5jb2RlQ2h1bmsoXG4gICAgICB1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpXG4gICAgKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBsb29rdXBbdG1wID4+IDJdICtcbiAgICAgIGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl0gK1xuICAgICAgJz09J1xuICAgIClcbiAgfSBlbHNlIGlmIChleHRyYUJ5dGVzID09PSAyKSB7XG4gICAgdG1wID0gKHVpbnQ4W2xlbiAtIDJdIDw8IDgpICsgdWludDhbbGVuIC0gMV1cbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgbG9va3VwW3RtcCA+PiAxMF0gK1xuICAgICAgbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXSArXG4gICAgICBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdICtcbiAgICAgICc9J1xuICAgIClcbiAgfVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8aHR0cHM6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG4vKiBlc2xpbnQtZGlzYWJsZSBuby1wcm90byAqL1xuXG4ndXNlIHN0cmljdCdcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbnZhciBLX01BWF9MRU5HVEggPSAweDdmZmZmZmZmXG5leHBvcnRzLmtNYXhMZW5ndGggPSBLX01BWF9MRU5HVEhcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgUHJpbnQgd2FybmluZyBhbmQgcmVjb21tZW5kIHVzaW5nIGBidWZmZXJgIHY0Lnggd2hpY2ggaGFzIGFuIE9iamVjdFxuICogICAgICAgICAgICAgICBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogV2UgcmVwb3J0IHRoYXQgdGhlIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB0eXBlZCBhcnJheXMgaWYgdGhlIGFyZSBub3Qgc3ViY2xhc3NhYmxlXG4gKiB1c2luZyBfX3Byb3RvX18uIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgXG4gKiAoU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzgpLiBJRSAxMCBsYWNrcyBzdXBwb3J0XG4gKiBmb3IgX19wcm90b19fIGFuZCBoYXMgYSBidWdneSB0eXBlZCBhcnJheSBpbXBsZW1lbnRhdGlvbi5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbmlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgJiYgdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGNvbnNvbGUuZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgY29uc29sZS5lcnJvcihcbiAgICAnVGhpcyBicm93c2VyIGxhY2tzIHR5cGVkIGFycmF5IChVaW50OEFycmF5KSBzdXBwb3J0IHdoaWNoIGlzIHJlcXVpcmVkIGJ5ICcgK1xuICAgICdgYnVmZmVyYCB2NS54LiBVc2UgYGJ1ZmZlcmAgdjQueCBpZiB5b3UgcmVxdWlyZSBvbGQgYnJvd3NlciBzdXBwb3J0LidcbiAgKVxufVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIC8vIENhbiB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZD9cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuX19wcm90b19fID0ge19fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfX1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MlxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlci5wcm90b3R5cGUsICdwYXJlbnQnLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ1ZmZlclxuICB9XG59KVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLnByb3RvdHlwZSwgJ29mZnNldCcsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnl0ZU9mZnNldFxuICB9XG59KVxuXG5mdW5jdGlvbiBjcmVhdGVCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAobGVuZ3RoID4gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgdHlwZWQgYXJyYXkgbGVuZ3RoJylcbiAgfVxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZnVuY3Rpb24gQnVmZmVyIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZ09yT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnSWYgZW5jb2RpbmcgaXMgc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcnXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZShhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20oYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG5pZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICB2YWx1ZTogbnVsbCxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgd3JpdGFibGU6IGZhbHNlXG4gIH0pXG59XG5cbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG5mdW5jdGlvbiBmcm9tICh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIGEgbnVtYmVyJylcbiAgfVxuXG4gIGlmIChpc0FycmF5QnVmZmVyKHZhbHVlKSB8fCAodmFsdWUgJiYgaXNBcnJheUJ1ZmZlcih2YWx1ZS5idWZmZXIpKSkge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIoc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuXG4gIHZhciBhY3R1YWwgPSBidWYud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIGJ1ZiA9IGJ1Zi5zbGljZSgwLCBhY3R1YWwpXG4gIH1cblxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdmFyIGJ1ZiA9IGNyZWF0ZUJ1ZmZlcihsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICBidWZbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyIChhcnJheSwgYnl0ZU9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmIChieXRlT2Zmc2V0IDwgMCB8fCBhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcIm9mZnNldFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQgKyAobGVuZ3RoIHx8IDApKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wibGVuZ3RoXCIgaXMgb3V0c2lkZSBvZiBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIHZhciBidWZcbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5KVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQpXG4gIH0gZWxzZSB7XG4gICAgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAob2JqKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuKVxuXG4gICAgaWYgKGJ1Zi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBidWZcbiAgICB9XG5cbiAgICBvYmouY29weShidWYsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gYnVmXG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhvYmopIHx8ICdsZW5ndGgnIGluIG9iaikge1xuICAgICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBudW1iZXJJc05hTihvYmoubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVmZmVyKDApXG4gICAgICB9XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZShvYmopXG4gICAgfVxuXG4gICAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBBcnJheS5pc0FycmF5KG9iai5kYXRhKSkge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqLmRhdGEpXG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgQXJyYXktbGlrZSBPYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IEtfTUFYX0xFTkdUSGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsgS19NQVhfTEVOR1RILnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKGxlbmd0aCkge1xuICBpZiAoK2xlbmd0aCAhPSBsZW5ndGgpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBlcWVxZXFcbiAgICBsZW5ndGggPSAwXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5hbGxvYygrbGVuZ3RoKVxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyID09PSB0cnVlXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gTWF0aC5taW4oeCwgeSk7IGkgPCBsZW47ICsraSkge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSB7XG4gICAgICB4ID0gYVtpXVxuICAgICAgeSA9IGJbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBCdWZmZXIuYWxsb2MoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZShsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGJ1ZiA9IGxpc3RbaV1cbiAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGJ1ZikpIHtcbiAgICAgIGJ1ZiA9IEJ1ZmZlci5mcm9tKGJ1ZilcbiAgICB9XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgaXNBcnJheUJ1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5ieXRlTGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgc3RyaW5nID0gJycgKyBzdHJpbmdcbiAgfVxuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsYXRpbjFTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhpcyBwcm9wZXJ0eSBpcyB1c2VkIGJ5IGBCdWZmZXIuaXNCdWZmZXJgIChhbmQgdGhlIGBpcy1idWZmZXJgIG5wbSBwYWNrYWdlKVxuLy8gdG8gZGV0ZWN0IGEgQnVmZmVyIGluc3RhbmNlLiBJdCdzIG5vdCBwb3NzaWJsZSB0byB1c2UgYGluc3RhbmNlb2YgQnVmZmVyYFxuLy8gcmVsaWFibHkgaW4gYSBicm93c2VyaWZ5IGNvbnRleHQgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBtdWx0aXBsZSBkaWZmZXJlbnRcbi8vIGNvcGllcyBvZiB0aGUgJ2J1ZmZlcicgcGFja2FnZSBpbiB1c2UuIFRoaXMgbWV0aG9kIHdvcmtzIGV2ZW4gZm9yIEJ1ZmZlclxuLy8gaW5zdGFuY2VzIHRoYXQgd2VyZSBjcmVhdGVkIGZyb20gYW5vdGhlciBjb3B5IG9mIHRoZSBgYnVmZmVyYCBwYWNrYWdlLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMTU0XG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuZnVuY3Rpb24gc3dhcCAoYiwgbiwgbSkge1xuICB2YXIgaSA9IGJbbl1cbiAgYltuXSA9IGJbbV1cbiAgYlttXSA9IGlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMTYgPSBmdW5jdGlvbiBzd2FwMTYgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDIgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDE2LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAxKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDMyID0gZnVuY3Rpb24gc3dhcDMyICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAzMi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgMilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXA2NCA9IGZ1bmN0aW9uIHN3YXA2NCAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgOCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gOCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDcpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDYpXG4gICAgc3dhcCh0aGlzLCBpICsgMiwgaSArIDUpXG4gICAgc3dhcCh0aGlzLCBpICsgMywgaSArIDQpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvTG9jYWxlU3RyaW5nID0gQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZ1xuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAodGFyZ2V0LCBzdGFydCwgZW5kLCB0aGlzU3RhcnQsIHRoaXNFbmQpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbi8vIEZpbmRzIGVpdGhlciB0aGUgZmlyc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0ID49IGBieXRlT2Zmc2V0YCxcbi8vIE9SIHRoZSBsYXN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA8PSBgYnl0ZU9mZnNldGAuXG4vL1xuLy8gQXJndW1lbnRzOlxuLy8gLSBidWZmZXIgLSBhIEJ1ZmZlciB0byBzZWFyY2hcbi8vIC0gdmFsIC0gYSBzdHJpbmcsIEJ1ZmZlciwgb3IgbnVtYmVyXG4vLyAtIGJ5dGVPZmZzZXQgLSBhbiBpbmRleCBpbnRvIGBidWZmZXJgOyB3aWxsIGJlIGNsYW1wZWQgdG8gYW4gaW50MzJcbi8vIC0gZW5jb2RpbmcgLSBhbiBvcHRpb25hbCBlbmNvZGluZywgcmVsZXZhbnQgaXMgdmFsIGlzIGEgc3RyaW5nXG4vLyAtIGRpciAtIHRydWUgZm9yIGluZGV4T2YsIGZhbHNlIGZvciBsYXN0SW5kZXhPZlxuZnVuY3Rpb24gYmlkaXJlY3Rpb25hbEluZGV4T2YgKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIC8vIEVtcHR5IGJ1ZmZlciBtZWFucyBubyBtYXRjaFxuICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXRcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPSArYnl0ZU9mZnNldCAgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKG51bWJlcklzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKG51bWJlcklzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBsYXRpbjFXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoID4+PiAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgKGJ5dGVzW2kgKyAxXSAqIDI1NikpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCAoOCAqIGJ5dGVMZW5ndGgpIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2FyZ3VtZW50IHNob3VsZCBiZSBhIEJ1ZmZlcicpXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5jb3B5V2l0aGluID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gVXNlIGJ1aWx0LWluIHdoZW4gYXZhaWxhYmxlLCBtaXNzaW5nIGZyb20gSUUxMVxuICAgIHRoaXMuY29weVdpdGhpbih0YXJnZXRTdGFydCwgc3RhcnQsIGVuZClcbiAgfSBlbHNlIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAodmFyIGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKChlbmNvZGluZyA9PT0gJ3V0ZjgnICYmIGNvZGUgPCAxMjgpIHx8XG4gICAgICAgICAgZW5jb2RpbmcgPT09ICdsYXRpbjEnKSB7XG4gICAgICAgIC8vIEZhc3QgcGF0aDogSWYgYHZhbGAgZml0cyBpbnRvIGEgc2luZ2xlIGJ5dGUsIHVzZSB0aGF0IG51bWVyaWMgdmFsdWUuXG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiBuZXcgQnVmZmVyKHZhbCwgZW5jb2RpbmcpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSB2YWx1ZSBcIicgKyB2YWwgK1xuICAgICAgICAnXCIgaXMgaW52YWxpZCBmb3IgYXJndW1lbnQgXCJ2YWx1ZVwiJylcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGVuZCAtIHN0YXJ0OyArK2kpIHtcbiAgICAgIHRoaXNbaSArIHN0YXJ0XSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rLzAtOUEtWmEtei1fXS9nXG5cbmZ1bmN0aW9uIGJhc2U2NGNsZWFuIChzdHIpIHtcbiAgLy8gTm9kZSB0YWtlcyBlcXVhbCBzaWducyBhcyBlbmQgb2YgdGhlIEJhc2U2NCBlbmNvZGluZ1xuICBzdHIgPSBzdHIuc3BsaXQoJz0nKVswXVxuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyLnRyaW0oKS5yZXBsYWNlKElOVkFMSURfQkFTRTY0X1JFLCAnJylcbiAgLy8gTm9kZSBjb252ZXJ0cyBzdHJpbmdzIHdpdGggbGVuZ3RoIDwgMiB0byAnJ1xuICBpZiAoc3RyLmxlbmd0aCA8IDIpIHJldHVybiAnJ1xuICAvLyBOb2RlIGFsbG93cyBmb3Igbm9uLXBhZGRlZCBiYXNlNjQgc3RyaW5ncyAobWlzc2luZyB0cmFpbGluZyA9PT0pLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgd2hpbGUgKHN0ci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgc3RyID0gc3RyICsgJz0nXG4gIH1cbiAgcmV0dXJuIHN0clxufVxuXG5mdW5jdGlvbiB0b0hleCAobikge1xuICBpZiAobiA8IDE2KSByZXR1cm4gJzAnICsgbi50b1N0cmluZygxNilcbiAgcmV0dXJuIG4udG9TdHJpbmcoMTYpXG59XG5cbmZ1bmN0aW9uIHV0ZjhUb0J5dGVzIChzdHJpbmcsIHVuaXRzKSB7XG4gIHVuaXRzID0gdW5pdHMgfHwgSW5maW5pdHlcbiAgdmFyIGNvZGVQb2ludFxuICB2YXIgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgdmFyIGJ5dGVzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgY29kZVBvaW50ID0gc3RyaW5nLmNoYXJDb2RlQXQoaSlcblxuICAgIC8vIGlzIHN1cnJvZ2F0ZSBjb21wb25lbnRcbiAgICBpZiAoY29kZVBvaW50ID4gMHhEN0ZGICYmIGNvZGVQb2ludCA8IDB4RTAwMCkge1xuICAgICAgLy8gbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICghbGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgICAvLyBubyBsZWFkIHlldFxuICAgICAgICBpZiAoY29kZVBvaW50ID4gMHhEQkZGKSB7XG4gICAgICAgICAgLy8gdW5leHBlY3RlZCB0cmFpbFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaSArIDEgPT09IGxlbmd0aCkge1xuICAgICAgICAgIC8vIHVucGFpcmVkIGxlYWRcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgbGVhZFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgaWYgKGNvZGVQb2ludCA8IDB4REMwMCkge1xuICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyB2YWxpZCBzdXJyb2dhdGUgcGFpclxuICAgICAgY29kZVBvaW50ID0gKGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDApICsgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbi8vIEFycmF5QnVmZmVycyBmcm9tIGFub3RoZXIgY29udGV4dCAoaS5lLiBhbiBpZnJhbWUpIGRvIG5vdCBwYXNzIHRoZSBgaW5zdGFuY2VvZmAgY2hlY2tcbi8vIGJ1dCB0aGV5IHNob3VsZCBiZSB0cmVhdGVkIGFzIHZhbGlkLiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNjZcbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIgKG9iaikge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHxcbiAgICAob2JqICE9IG51bGwgJiYgb2JqLmNvbnN0cnVjdG9yICE9IG51bGwgJiYgb2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdBcnJheUJ1ZmZlcicgJiZcbiAgICAgIHR5cGVvZiBvYmouYnl0ZUxlbmd0aCA9PT0gJ251bWJlcicpXG59XG5cbmZ1bmN0aW9uIG51bWJlcklzTmFOIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPT0gb2JqIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IChlICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IChtICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKCh2YWx1ZSAqIGMpIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiXG4vKipcbiAqIHktd2VicnRjMyAtIFxuICogQHZlcnNpb24gdjIuNC4wXG4gKiBAbGljZW5zZSBNSVRcbiAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwueXdlYnJ0YyA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY29tbW9uanNHbG9iYWwgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHt9O1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZuLCBtb2R1bGUpIHtcblx0XHRyZXR1cm4gbW9kdWxlID0geyBleHBvcnRzOiB7fSB9LCBmbihtb2R1bGUsIG1vZHVsZS5leHBvcnRzKSwgbW9kdWxlLmV4cG9ydHM7XG5cdH1cblxuXHQvKipcclxuXHQgKiBQYXJzZXMgYW4gVVJJXHJcblx0ICpcclxuXHQgKiBAYXV0aG9yIFN0ZXZlbiBMZXZpdGhhbiA8c3RldmVubGV2aXRoYW4uY29tPiAoTUlUIGxpY2Vuc2UpXHJcblx0ICogQGFwaSBwcml2YXRlXHJcblx0ICovXG5cblx0dmFyIHJlID0gL14oPzooPyFbXjpAXSs6W146QFxcL10qQCkoaHR0cHxodHRwc3x3c3x3c3MpOlxcL1xcLyk/KCg/OigoW146QF0qKSg/OjooW146QF0qKSk/KT9AKT8oKD86W2EtZjAtOV17MCw0fTopezIsN31bYS1mMC05XXswLDR9fFteOlxcLz8jXSopKD86OihcXGQqKSk/KSgoKFxcLyg/OltePyNdKD8hW14/I1xcL10qXFwuW14/I1xcLy5dKyg/Ols/I118JCkpKSpcXC8/KT8oW14/I1xcL10qKSkoPzpcXD8oW14jXSopKT8oPzojKC4qKSk/KS87XG5cblx0dmFyIHBhcnRzID0gWydzb3VyY2UnLCAncHJvdG9jb2wnLCAnYXV0aG9yaXR5JywgJ3VzZXJJbmZvJywgJ3VzZXInLCAncGFzc3dvcmQnLCAnaG9zdCcsICdwb3J0JywgJ3JlbGF0aXZlJywgJ3BhdGgnLCAnZGlyZWN0b3J5JywgJ2ZpbGUnLCAncXVlcnknLCAnYW5jaG9yJ107XG5cblx0dmFyIHBhcnNldXJpID0gZnVuY3Rpb24gcGFyc2V1cmkoc3RyKSB7XG5cdCAgICB2YXIgc3JjID0gc3RyLFxuXHQgICAgICAgIGIgPSBzdHIuaW5kZXhPZignWycpLFxuXHQgICAgICAgIGUgPSBzdHIuaW5kZXhPZignXScpO1xuXG5cdCAgICBpZiAoYiAhPSAtMSAmJiBlICE9IC0xKSB7XG5cdCAgICAgICAgc3RyID0gc3RyLnN1YnN0cmluZygwLCBiKSArIHN0ci5zdWJzdHJpbmcoYiwgZSkucmVwbGFjZSgvOi9nLCAnOycpICsgc3RyLnN1YnN0cmluZyhlLCBzdHIubGVuZ3RoKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIG0gPSByZS5leGVjKHN0ciB8fCAnJyksXG5cdCAgICAgICAgdXJpID0ge30sXG5cdCAgICAgICAgaSA9IDE0O1xuXG5cdCAgICB3aGlsZSAoaS0tKSB7XG5cdCAgICAgICAgdXJpW3BhcnRzW2ldXSA9IG1baV0gfHwgJyc7XG5cdCAgICB9XG5cblx0ICAgIGlmIChiICE9IC0xICYmIGUgIT0gLTEpIHtcblx0ICAgICAgICB1cmkuc291cmNlID0gc3JjO1xuXHQgICAgICAgIHVyaS5ob3N0ID0gdXJpLmhvc3Quc3Vic3RyaW5nKDEsIHVyaS5ob3N0Lmxlbmd0aCAtIDEpLnJlcGxhY2UoLzsvZywgJzonKTtcblx0ICAgICAgICB1cmkuYXV0aG9yaXR5ID0gdXJpLmF1dGhvcml0eS5yZXBsYWNlKCdbJywgJycpLnJlcGxhY2UoJ10nLCAnJykucmVwbGFjZSgvOy9nLCAnOicpO1xuXHQgICAgICAgIHVyaS5pcHY2dXJpID0gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHVyaTtcblx0fTtcblxuXHR2YXIgcGFyc2V1cmkkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBwYXJzZXVyaSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBhcnNldXJpXG5cdH0pO1xuXG5cdHZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7XG5cdCAgcmV0dXJuIHR5cGVvZiBvYmo7XG5cdH0gOiBmdW5jdGlvbiAob2JqKSB7XG5cdCAgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgJiYgb2JqICE9PSBTeW1ib2wucHJvdG90eXBlID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7XG5cdH07XG5cblx0dmFyIGNsYXNzQ2FsbENoZWNrID0gZnVuY3Rpb24gKGluc3RhbmNlLCBDb25zdHJ1Y3Rvcikge1xuXHQgIGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7XG5cdCAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpO1xuXHQgIH1cblx0fTtcblxuXHR2YXIgY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07XG5cdCAgICAgIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTtcblx0ICAgICAgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlO1xuXHQgICAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuXHQgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHtcblx0ICAgIGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7XG5cdCAgICBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcblx0ICAgIHJldHVybiBDb25zdHJ1Y3Rvcjtcblx0ICB9O1xuXHR9KCk7XG5cblx0dmFyIGluaGVyaXRzID0gZnVuY3Rpb24gKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7XG5cdCAgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSBcImZ1bmN0aW9uXCIgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7XG5cdCAgfVxuXG5cdCAgc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7XG5cdCAgICBjb25zdHJ1Y3Rvcjoge1xuXHQgICAgICB2YWx1ZTogc3ViQ2xhc3MsXG5cdCAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuXHQgICAgICB3cml0YWJsZTogdHJ1ZSxcblx0ICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG5cdCAgICB9XG5cdCAgfSk7XG5cdCAgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzO1xuXHR9O1xuXG5cdHZhciBwb3NzaWJsZUNvbnN0cnVjdG9yUmV0dXJuID0gZnVuY3Rpb24gKHNlbGYsIGNhbGwpIHtcblx0ICBpZiAoIXNlbGYpIHtcblx0ICAgIHRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTtcblx0ICB9XG5cblx0ICByZXR1cm4gY2FsbCAmJiAodHlwZW9mIGNhbGwgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGNhbGwgPT09IFwiZnVuY3Rpb25cIikgPyBjYWxsIDogc2VsZjtcblx0fTtcblxuXHQvKipcblx0ICogSGVscGVycy5cblx0ICovXG5cblx0dmFyIHMgPSAxMDAwO1xuXHR2YXIgbSA9IHMgKiA2MDtcblx0dmFyIGggPSBtICogNjA7XG5cdHZhciBkID0gaCAqIDI0O1xuXHR2YXIgeSA9IGQgKiAzNjUuMjU7XG5cblx0LyoqXG5cdCAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG5cdCAqXG5cdCAqIE9wdGlvbnM6XG5cdCAqXG5cdCAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuXHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG5cdCAqIEB0aHJvd3Mge0Vycm9yfSB0aHJvdyBhbiBlcnJvciBpZiB2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIG51bWJlclxuXHQgKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgbXMgPSBmdW5jdGlvbiBtcyh2YWwsIG9wdGlvbnMpIHtcblx0ICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0ICB2YXIgdHlwZSA9IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHZhbCk7XG5cdCAgaWYgKHR5cGUgPT09ICdzdHJpbmcnICYmIHZhbC5sZW5ndGggPiAwKSB7XG5cdCAgICByZXR1cm4gcGFyc2UodmFsKTtcblx0ICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzTmFOKHZhbCkgPT09IGZhbHNlKSB7XG5cdCAgICByZXR1cm4gb3B0aW9ucy5sb25nID8gZm10TG9uZyh2YWwpIDogZm10U2hvcnQodmFsKTtcblx0ICB9XG5cdCAgdGhyb3cgbmV3IEVycm9yKCd2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIHZhbGlkIG51bWJlci4gdmFsPScgKyBKU09OLnN0cmluZ2lmeSh2YWwpKTtcblx0fTtcblxuXHQvKipcblx0ICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyXG5cdCAqIEByZXR1cm4ge051bWJlcn1cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIHBhcnNlKHN0cikge1xuXHQgIHN0ciA9IFN0cmluZyhzdHIpO1xuXHQgIGlmIChzdHIubGVuZ3RoID4gMTAwKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXHQgIHZhciBtYXRjaCA9IC9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWMoc3RyKTtcblx0ICBpZiAoIW1hdGNoKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXHQgIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG5cdCAgdmFyIHR5cGUgPSAobWF0Y2hbMl0gfHwgJ21zJykudG9Mb3dlckNhc2UoKTtcblx0ICBzd2l0Y2ggKHR5cGUpIHtcblx0ICAgIGNhc2UgJ3llYXJzJzpcblx0ICAgIGNhc2UgJ3llYXInOlxuXHQgICAgY2FzZSAneXJzJzpcblx0ICAgIGNhc2UgJ3lyJzpcblx0ICAgIGNhc2UgJ3knOlxuXHQgICAgICByZXR1cm4gbiAqIHk7XG5cdCAgICBjYXNlICdkYXlzJzpcblx0ICAgIGNhc2UgJ2RheSc6XG5cdCAgICBjYXNlICdkJzpcblx0ICAgICAgcmV0dXJuIG4gKiBkO1xuXHQgICAgY2FzZSAnaG91cnMnOlxuXHQgICAgY2FzZSAnaG91cic6XG5cdCAgICBjYXNlICdocnMnOlxuXHQgICAgY2FzZSAnaHInOlxuXHQgICAgY2FzZSAnaCc6XG5cdCAgICAgIHJldHVybiBuICogaDtcblx0ICAgIGNhc2UgJ21pbnV0ZXMnOlxuXHQgICAgY2FzZSAnbWludXRlJzpcblx0ICAgIGNhc2UgJ21pbnMnOlxuXHQgICAgY2FzZSAnbWluJzpcblx0ICAgIGNhc2UgJ20nOlxuXHQgICAgICByZXR1cm4gbiAqIG07XG5cdCAgICBjYXNlICdzZWNvbmRzJzpcblx0ICAgIGNhc2UgJ3NlY29uZCc6XG5cdCAgICBjYXNlICdzZWNzJzpcblx0ICAgIGNhc2UgJ3NlYyc6XG5cdCAgICBjYXNlICdzJzpcblx0ICAgICAgcmV0dXJuIG4gKiBzO1xuXHQgICAgY2FzZSAnbWlsbGlzZWNvbmRzJzpcblx0ICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcblx0ICAgIGNhc2UgJ21zZWNzJzpcblx0ICAgIGNhc2UgJ21zZWMnOlxuXHQgICAgY2FzZSAnbXMnOlxuXHQgICAgICByZXR1cm4gbjtcblx0ICAgIGRlZmF1bHQ6XG5cdCAgICAgIHJldHVybiB1bmRlZmluZWQ7XG5cdCAgfVxuXHR9XG5cblx0LyoqXG5cdCAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG1zXG5cdCAqIEByZXR1cm4ge1N0cmluZ31cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGZtdFNob3J0KG1zKSB7XG5cdCAgaWYgKG1zID49IGQpIHtcblx0ICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG5cdCAgfVxuXHQgIGlmIChtcyA+PSBoKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuXHQgIH1cblx0ICBpZiAobXMgPj0gbSkge1xuXHQgICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcblx0ICB9XG5cdCAgaWYgKG1zID49IHMpIHtcblx0ICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG5cdCAgfVxuXHQgIHJldHVybiBtcyArICdtcyc7XG5cdH1cblxuXHQvKipcblx0ICogTG9uZyBmb3JtYXQgZm9yIGBtc2AuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBmbXRMb25nKG1zKSB7XG5cdCAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpIHx8IHBsdXJhbChtcywgaCwgJ2hvdXInKSB8fCBwbHVyYWwobXMsIG0sICdtaW51dGUnKSB8fCBwbHVyYWwobXMsIHMsICdzZWNvbmQnKSB8fCBtcyArICcgbXMnO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBsdXJhbGl6YXRpb24gaGVscGVyLlxuXHQgKi9cblxuXHRmdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcblx0ICBpZiAobXMgPCBuKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXHQgIGlmIChtcyA8IG4gKiAxLjUpIHtcblx0ICAgIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuXHQgIH1cblx0ICByZXR1cm4gTWF0aC5jZWlsKG1zIC8gbikgKyAnICcgKyBuYW1lICsgJ3MnO1xuXHR9XG5cblx0dmFyIG1zJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogbXMsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBtc1xuXHR9KTtcblxuXHR2YXIgcmVxdWlyZSQkMCA9ICggbXMkMSAmJiBtcyApIHx8IG1zJDE7XG5cblx0dmFyIGRlYnVnID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcblx0ICAgKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuXHQgICAqXG5cdCAgICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVidWcuZGVidWcgPSBjcmVhdGVEZWJ1Z1snZGVmYXVsdCddID0gY3JlYXRlRGVidWc7XG5cdCAgZXhwb3J0cy5jb2VyY2UgPSBjb2VyY2U7XG5cdCAgZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcblx0ICBleHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcblx0ICBleHBvcnRzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHQgIGV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlJCQwO1xuXG5cdCAgLyoqXG5cdCAgICogQWN0aXZlIGBkZWJ1Z2AgaW5zdGFuY2VzLlxuXHQgICAqL1xuXHQgIGV4cG9ydHMuaW5zdGFuY2VzID0gW107XG5cblx0ICAvKipcblx0ICAgKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMubmFtZXMgPSBbXTtcblx0ICBleHBvcnRzLnNraXBzID0gW107XG5cblx0ICAvKipcblx0ICAgKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG5cdCAgICpcblx0ICAgKiBWYWxpZCBrZXkgbmFtZXMgYXJlIGEgc2luZ2xlLCBsb3dlciBvciB1cHBlci1jYXNlIGxldHRlciwgaS5lLiBcIm5cIiBhbmQgXCJOXCIuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuXHQgIC8qKlxuXHQgICAqIFNlbGVjdCBhIGNvbG9yLlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2Vcblx0ICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBzZWxlY3RDb2xvcihuYW1lc3BhY2UpIHtcblx0ICAgIHZhciBoYXNoID0gMCxcblx0ICAgICAgICBpO1xuXG5cdCAgICBmb3IgKGkgaW4gbmFtZXNwYWNlKSB7XG5cdCAgICAgIGhhc2ggPSAoaGFzaCA8PCA1KSAtIGhhc2ggKyBuYW1lc3BhY2UuY2hhckNvZGVBdChpKTtcblx0ICAgICAgaGFzaCB8PSAwOyAvLyBDb252ZXJ0IHRvIDMyYml0IGludGVnZXJcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW01hdGguYWJzKGhhc2gpICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2Vcblx0ICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gY3JlYXRlRGVidWcobmFtZXNwYWNlKSB7XG5cblx0ICAgIHZhciBwcmV2VGltZTtcblxuXHQgICAgZnVuY3Rpb24gZGVidWcoKSB7XG5cdCAgICAgIC8vIGRpc2FibGVkP1xuXHQgICAgICBpZiAoIWRlYnVnLmVuYWJsZWQpIHJldHVybjtcblxuXHQgICAgICB2YXIgc2VsZiA9IGRlYnVnO1xuXG5cdCAgICAgIC8vIHNldCBgZGlmZmAgdGltZXN0YW1wXG5cdCAgICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG5cdCAgICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG5cdCAgICAgIHNlbGYuZGlmZiA9IG1zO1xuXHQgICAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcblx0ICAgICAgc2VsZi5jdXJyID0gY3Vycjtcblx0ICAgICAgcHJldlRpbWUgPSBjdXJyO1xuXG5cdCAgICAgIC8vIHR1cm4gdGhlIGBhcmd1bWVudHNgIGludG8gYSBwcm9wZXIgQXJyYXlcblx0ICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG5cdCAgICAgIH1cblxuXHQgICAgICBhcmdzWzBdID0gZXhwb3J0cy5jb2VyY2UoYXJnc1swXSk7XG5cblx0ICAgICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuXHQgICAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVPXG5cdCAgICAgICAgYXJncy51bnNoaWZ0KCclTycpO1xuXHQgICAgICB9XG5cblx0ICAgICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcblx0ICAgICAgdmFyIGluZGV4ID0gMDtcblx0ICAgICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csIGZ1bmN0aW9uIChtYXRjaCwgZm9ybWF0KSB7XG5cdCAgICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGFuIGVzY2FwZWQgJSB0aGVuIGRvbid0IGluY3JlYXNlIHRoZSBhcnJheSBpbmRleFxuXHQgICAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuXHQgICAgICAgIGluZGV4Kys7XG5cdCAgICAgICAgdmFyIGZvcm1hdHRlciA9IGV4cG9ydHMuZm9ybWF0dGVyc1tmb3JtYXRdO1xuXHQgICAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG5cdCAgICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG5cdCAgICAgICAgICBtYXRjaCA9IGZvcm1hdHRlci5jYWxsKHNlbGYsIHZhbCk7XG5cblx0ICAgICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcblx0ICAgICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcblx0ICAgICAgICAgIGluZGV4LS07XG5cdCAgICAgICAgfVxuXHQgICAgICAgIHJldHVybiBtYXRjaDtcblx0ICAgICAgfSk7XG5cblx0ICAgICAgLy8gYXBwbHkgZW52LXNwZWNpZmljIGZvcm1hdHRpbmcgKGNvbG9ycywgZXRjLilcblx0ICAgICAgZXhwb3J0cy5mb3JtYXRBcmdzLmNhbGwoc2VsZiwgYXJncyk7XG5cblx0ICAgICAgdmFyIGxvZ0ZuID0gZGVidWcubG9nIHx8IGV4cG9ydHMubG9nIHx8IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG5cdCAgICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuXHQgICAgfVxuXG5cdCAgICBkZWJ1Zy5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG5cdCAgICBkZWJ1Zy5lbmFibGVkID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSk7XG5cdCAgICBkZWJ1Zy51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuXHQgICAgZGVidWcuY29sb3IgPSBzZWxlY3RDb2xvcihuYW1lc3BhY2UpO1xuXHQgICAgZGVidWcuZGVzdHJveSA9IGRlc3Ryb3k7XG5cblx0ICAgIC8vIGVudi1zcGVjaWZpYyBpbml0aWFsaXphdGlvbiBsb2dpYyBmb3IgZGVidWcgaW5zdGFuY2VzXG5cdCAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuaW5pdCkge1xuXHQgICAgICBleHBvcnRzLmluaXQoZGVidWcpO1xuXHQgICAgfVxuXG5cdCAgICBleHBvcnRzLmluc3RhbmNlcy5wdXNoKGRlYnVnKTtcblxuXHQgICAgcmV0dXJuIGRlYnVnO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICB2YXIgaW5kZXggPSBleHBvcnRzLmluc3RhbmNlcy5pbmRleE9mKHRoaXMpO1xuXHQgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuXHQgICAgICBleHBvcnRzLmluc3RhbmNlcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG5cdCAgICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuYWJsZShuYW1lc3BhY2VzKSB7XG5cdCAgICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cblx0ICAgIGV4cG9ydHMubmFtZXMgPSBbXTtcblx0ICAgIGV4cG9ydHMuc2tpcHMgPSBbXTtcblxuXHQgICAgdmFyIGk7XG5cdCAgICB2YXIgc3BsaXQgPSAodHlwZW9mIG5hbWVzcGFjZXMgPT09ICdzdHJpbmcnID8gbmFtZXNwYWNlcyA6ICcnKS5zcGxpdCgvW1xccyxdKy8pO1xuXHQgICAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuXHQgICAgICBuYW1lc3BhY2VzID0gc3BsaXRbaV0ucmVwbGFjZSgvXFwqL2csICcuKj8nKTtcblx0ICAgICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuXHQgICAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBleHBvcnRzLmluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICB2YXIgaW5zdGFuY2UgPSBleHBvcnRzLmluc3RhbmNlc1tpXTtcblx0ICAgICAgaW5zdGFuY2UuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChpbnN0YW5jZS5uYW1lc3BhY2UpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGRpc2FibGUoKSB7XG5cdCAgICBleHBvcnRzLmVuYWJsZSgnJyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBtb2RlIG5hbWUgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcblx0ICAgKiBAcmV0dXJuIHtCb29sZWFufVxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcblx0ICAgIGlmIChuYW1lW25hbWUubGVuZ3RoIC0gMV0gPT09ICcqJykge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblx0ICAgIHZhciBpLCBsZW47XG5cdCAgICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgIGlmIChleHBvcnRzLnNraXBzW2ldLnRlc3QobmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0ICAgICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuXHQgICAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQ29lcmNlIGB2YWxgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtNaXhlZH0gdmFsXG5cdCAgICogQHJldHVybiB7TWl4ZWR9XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBjb2VyY2UodmFsKSB7XG5cdCAgICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG5cdCAgICByZXR1cm4gdmFsO1xuXHQgIH1cblx0fSk7XG5cdHZhciBkZWJ1Z18xID0gZGVidWcuY29lcmNlO1xuXHR2YXIgZGVidWdfMiA9IGRlYnVnLmRpc2FibGU7XG5cdHZhciBkZWJ1Z18zID0gZGVidWcuZW5hYmxlO1xuXHR2YXIgZGVidWdfNCA9IGRlYnVnLmVuYWJsZWQ7XG5cdHZhciBkZWJ1Z181ID0gZGVidWcuaHVtYW5pemU7XG5cdHZhciBkZWJ1Z182ID0gZGVidWcuaW5zdGFuY2VzO1xuXHR2YXIgZGVidWdfNyA9IGRlYnVnLm5hbWVzO1xuXHR2YXIgZGVidWdfOCA9IGRlYnVnLnNraXBzO1xuXHR2YXIgZGVidWdfOSA9IGRlYnVnLmZvcm1hdHRlcnM7XG5cblx0dmFyIGRlYnVnJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogZGVidWcsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBkZWJ1Zyxcblx0XHRjb2VyY2U6IGRlYnVnXzEsXG5cdFx0ZGlzYWJsZTogZGVidWdfMixcblx0XHRlbmFibGU6IGRlYnVnXzMsXG5cdFx0ZW5hYmxlZDogZGVidWdfNCxcblx0XHRodW1hbml6ZTogZGVidWdfNSxcblx0XHRpbnN0YW5jZXM6IGRlYnVnXzYsXG5cdFx0bmFtZXM6IGRlYnVnXzcsXG5cdFx0c2tpcHM6IGRlYnVnXzgsXG5cdFx0Zm9ybWF0dGVyczogZGVidWdfOVxuXHR9KTtcblxuXHR2YXIgcmVxdWlyZSQkMCQxID0gKCBkZWJ1ZyQxICYmIGRlYnVnICkgfHwgZGVidWckMTtcblxuXHR2YXIgYnJvd3NlciA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBUaGlzIGlzIHRoZSB3ZWIgYnJvd3NlciBpbXBsZW1lbnRhdGlvbiBvZiBgZGVidWcoKWAuXG5cdCAgICpcblx0ICAgKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG5cdCAgICovXG5cblx0ICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlJCQwJDE7XG5cdCAgZXhwb3J0cy5sb2cgPSBsb2c7XG5cdCAgZXhwb3J0cy5mb3JtYXRBcmdzID0gZm9ybWF0QXJncztcblx0ICBleHBvcnRzLnNhdmUgPSBzYXZlO1xuXHQgIGV4cG9ydHMubG9hZCA9IGxvYWQ7XG5cdCAgZXhwb3J0cy51c2VDb2xvcnMgPSB1c2VDb2xvcnM7XG5cdCAgZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZSAmJiAndW5kZWZpbmVkJyAhPSB0eXBlb2YgY2hyb21lLnN0b3JhZ2UgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbCA6IGxvY2Fsc3RvcmFnZSgpO1xuXG5cdCAgLyoqXG5cdCAgICogQ29sb3JzLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5jb2xvcnMgPSBbJyMwMDAwQ0MnLCAnIzAwMDBGRicsICcjMDAzM0NDJywgJyMwMDMzRkYnLCAnIzAwNjZDQycsICcjMDA2NkZGJywgJyMwMDk5Q0MnLCAnIzAwOTlGRicsICcjMDBDQzAwJywgJyMwMENDMzMnLCAnIzAwQ0M2NicsICcjMDBDQzk5JywgJyMwMENDQ0MnLCAnIzAwQ0NGRicsICcjMzMwMENDJywgJyMzMzAwRkYnLCAnIzMzMzNDQycsICcjMzMzM0ZGJywgJyMzMzY2Q0MnLCAnIzMzNjZGRicsICcjMzM5OUNDJywgJyMzMzk5RkYnLCAnIzMzQ0MwMCcsICcjMzNDQzMzJywgJyMzM0NDNjYnLCAnIzMzQ0M5OScsICcjMzNDQ0NDJywgJyMzM0NDRkYnLCAnIzY2MDBDQycsICcjNjYwMEZGJywgJyM2NjMzQ0MnLCAnIzY2MzNGRicsICcjNjZDQzAwJywgJyM2NkNDMzMnLCAnIzk5MDBDQycsICcjOTkwMEZGJywgJyM5OTMzQ0MnLCAnIzk5MzNGRicsICcjOTlDQzAwJywgJyM5OUNDMzMnLCAnI0NDMDAwMCcsICcjQ0MwMDMzJywgJyNDQzAwNjYnLCAnI0NDMDA5OScsICcjQ0MwMENDJywgJyNDQzAwRkYnLCAnI0NDMzMwMCcsICcjQ0MzMzMzJywgJyNDQzMzNjYnLCAnI0NDMzM5OScsICcjQ0MzM0NDJywgJyNDQzMzRkYnLCAnI0NDNjYwMCcsICcjQ0M2NjMzJywgJyNDQzk5MDAnLCAnI0NDOTkzMycsICcjQ0NDQzAwJywgJyNDQ0NDMzMnLCAnI0ZGMDAwMCcsICcjRkYwMDMzJywgJyNGRjAwNjYnLCAnI0ZGMDA5OScsICcjRkYwMENDJywgJyNGRjAwRkYnLCAnI0ZGMzMwMCcsICcjRkYzMzMzJywgJyNGRjMzNjYnLCAnI0ZGMzM5OScsICcjRkYzM0NDJywgJyNGRjMzRkYnLCAnI0ZGNjYwMCcsICcjRkY2NjMzJywgJyNGRjk5MDAnLCAnI0ZGOTkzMycsICcjRkZDQzAwJywgJyNGRkNDMzMnXTtcblxuXHQgIC8qKlxuXHQgICAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG5cdCAgICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG5cdCAgICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuXHQgICAqXG5cdCAgICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIHVzZUNvbG9ycygpIHtcblx0ICAgIC8vIE5COiBJbiBhbiBFbGVjdHJvbiBwcmVsb2FkIHNjcmlwdCwgZG9jdW1lbnQgd2lsbCBiZSBkZWZpbmVkIGJ1dCBub3QgZnVsbHlcblx0ICAgIC8vIGluaXRpYWxpemVkLiBTaW5jZSB3ZSBrbm93IHdlJ3JlIGluIENocm9tZSwgd2UnbGwganVzdCBkZXRlY3QgdGhpcyBjYXNlXG5cdCAgICAvLyBleHBsaWNpdGx5XG5cdCAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnByb2Nlc3MgJiYgd2luZG93LnByb2Nlc3MudHlwZSA9PT0gJ3JlbmRlcmVyJykge1xuXHQgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgLy8gSW50ZXJuZXQgRXhwbG9yZXIgYW5kIEVkZ2UgZG8gbm90IHN1cHBvcnQgY29sb3JzLlxuXHQgICAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC8oZWRnZXx0cmlkZW50KVxcLyhcXGQrKS8pKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcblx0ICAgIC8vIGRvY3VtZW50IGlzIHVuZGVmaW5lZCBpbiByZWFjdC1uYXRpdmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC1uYXRpdmUvcHVsbC8xNjMyXG5cdCAgICByZXR1cm4gdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5XZWJraXRBcHBlYXJhbmNlIHx8XG5cdCAgICAvLyBpcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG5cdCAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuY29uc29sZSAmJiAod2luZG93LmNvbnNvbGUuZmlyZWJ1ZyB8fCB3aW5kb3cuY29uc29sZS5leGNlcHRpb24gJiYgd2luZG93LmNvbnNvbGUudGFibGUpIHx8XG5cdCAgICAvLyBpcyBmaXJlZm94ID49IHYzMT9cblx0ICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuXHQgICAgdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSAmJiBwYXJzZUludChSZWdFeHAuJDEsIDEwKSA+PSAzMSB8fFxuXHQgICAgLy8gZG91YmxlIGNoZWNrIHdlYmtpdCBpbiB1c2VyQWdlbnQganVzdCBpbiBjYXNlIHdlIGFyZSBpbiBhIHdvcmtlclxuXHQgICAgdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2FwcGxld2Via2l0XFwvKFxcZCspLyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbiAodikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xuXHQgICAgfSBjYXRjaCAoZXJyKSB7XG5cdCAgICAgIHJldHVybiAnW1VuZXhwZWN0ZWRKU09OUGFyc2VFcnJvcl06ICcgKyBlcnIubWVzc2FnZTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGZvcm1hdEFyZ3MoYXJncykge1xuXHQgICAgdmFyIHVzZUNvbG9ycyA9IHRoaXMudXNlQ29sb3JzO1xuXG5cdCAgICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJykgKyB0aGlzLm5hbWVzcGFjZSArICh1c2VDb2xvcnMgPyAnICVjJyA6ICcgJykgKyBhcmdzWzBdICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKSArICcrJyArIGV4cG9ydHMuaHVtYW5pemUodGhpcy5kaWZmKTtcblxuXHQgICAgaWYgKCF1c2VDb2xvcnMpIHJldHVybjtcblxuXHQgICAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuXHQgICAgYXJncy5zcGxpY2UoMSwgMCwgYywgJ2NvbG9yOiBpbmhlcml0Jyk7XG5cblx0ICAgIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG5cdCAgICAvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG5cdCAgICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cblx0ICAgIHZhciBpbmRleCA9IDA7XG5cdCAgICB2YXIgbGFzdEMgPSAwO1xuXHQgICAgYXJnc1swXS5yZXBsYWNlKC8lW2EtekEtWiVdL2csIGZ1bmN0aW9uIChtYXRjaCkge1xuXHQgICAgICBpZiAoJyUlJyA9PT0gbWF0Y2gpIHJldHVybjtcblx0ICAgICAgaW5kZXgrKztcblx0ICAgICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG5cdCAgICAgICAgLy8gd2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG5cdCAgICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcblx0ICAgICAgICBsYXN0QyA9IGluZGV4O1xuXHQgICAgICB9XG5cdCAgICB9KTtcblxuXHQgICAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuXHQgICAqIE5vLW9wIHdoZW4gYGNvbnNvbGUubG9nYCBpcyBub3QgYSBcImZ1bmN0aW9uXCIuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9nKCkge1xuXHQgICAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcblx0ICAgIC8vIHRoZSBgY29uc29sZS5sb2dgIGZ1bmN0aW9uIGRvZXNuJ3QgaGF2ZSAnYXBwbHknXG5cdCAgICByZXR1cm4gJ29iamVjdCcgPT09ICh0eXBlb2YgY29uc29sZSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoY29uc29sZSkpICYmIGNvbnNvbGUubG9nICYmIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGNvbnNvbGUubG9nLCBjb25zb2xlLCBhcmd1bWVudHMpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIFNhdmUgYG5hbWVzcGFjZXNgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuXHQgICAgICAgIGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG5cdCAgICAgIH1cblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTG9hZCBgbmFtZXNwYWNlc2AuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBsb2FkKCkge1xuXHQgICAgdmFyIHI7XG5cdCAgICB0cnkge1xuXHQgICAgICByID0gZXhwb3J0cy5zdG9yYWdlLmRlYnVnO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblxuXHQgICAgLy8gSWYgZGVidWcgaXNuJ3Qgc2V0IGluIExTLCBhbmQgd2UncmUgaW4gRWxlY3Ryb24sIHRyeSB0byBsb2FkICRERUJVR1xuXHQgICAgaWYgKCFyICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAnZW52JyBpbiBwcm9jZXNzKSB7XG5cdCAgICAgIHIgPSBwcm9jZXNzLmVudi5ERUJVRztcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHI7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5hYmxlKGxvYWQoKSk7XG5cblx0ICAvKipcblx0ICAgKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG5cdCAgICpcblx0ICAgKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3Ncblx0ICAgKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuXHQgICAqIGFuZCB5b3UgYXR0ZW1wdCB0byBhY2Nlc3MgaXQuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgfVxuXHR9KTtcblx0dmFyIGJyb3dzZXJfMSA9IGJyb3dzZXIubG9nO1xuXHR2YXIgYnJvd3Nlcl8yID0gYnJvd3Nlci5mb3JtYXRBcmdzO1xuXHR2YXIgYnJvd3Nlcl8zID0gYnJvd3Nlci5zYXZlO1xuXHR2YXIgYnJvd3Nlcl80ID0gYnJvd3Nlci5sb2FkO1xuXHR2YXIgYnJvd3Nlcl81ID0gYnJvd3Nlci51c2VDb2xvcnM7XG5cdHZhciBicm93c2VyXzYgPSBicm93c2VyLnN0b3JhZ2U7XG5cdHZhciBicm93c2VyXzcgPSBicm93c2VyLmNvbG9ycztcblxuXHR2YXIgYnJvd3NlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJyb3dzZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBicm93c2VyLFxuXHRcdGxvZzogYnJvd3Nlcl8xLFxuXHRcdGZvcm1hdEFyZ3M6IGJyb3dzZXJfMixcblx0XHRzYXZlOiBicm93c2VyXzMsXG5cdFx0bG9hZDogYnJvd3Nlcl80LFxuXHRcdHVzZUNvbG9yczogYnJvd3Nlcl81LFxuXHRcdHN0b3JhZ2U6IGJyb3dzZXJfNixcblx0XHRjb2xvcnM6IGJyb3dzZXJfN1xuXHR9KTtcblxuXHR2YXIgcGFyc2V1cmkkMiA9ICggcGFyc2V1cmkkMSAmJiBwYXJzZXVyaSApIHx8IHBhcnNldXJpJDE7XG5cblx0dmFyIHJlcXVpcmUkJDAkMiA9ICggYnJvd3NlciQxICYmIGJyb3dzZXIgKSB8fCBicm93c2VyJDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQyID0gcmVxdWlyZSQkMCQyKCdzb2NrZXQuaW8tY2xpZW50OnVybCcpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHVybF8xID0gdXJsO1xuXG5cdC8qKlxuXHQgKiBVUkwgcGFyc2VyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdXJsXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBBbiBvYmplY3QgbWVhbnQgdG8gbWltaWMgd2luZG93LmxvY2F0aW9uLlxuXHQgKiAgICAgICAgICAgICAgICAgRGVmYXVsdHMgdG8gd2luZG93LmxvY2F0aW9uLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiB1cmwodXJpLCBsb2MpIHtcblx0ICB2YXIgb2JqID0gdXJpO1xuXG5cdCAgLy8gZGVmYXVsdCB0byB3aW5kb3cubG9jYXRpb25cblx0ICBsb2MgPSBsb2MgfHwgY29tbW9uanNHbG9iYWwubG9jYXRpb247XG5cdCAgaWYgKG51bGwgPT0gdXJpKSB1cmkgPSBsb2MucHJvdG9jb2wgKyAnLy8nICsgbG9jLmhvc3Q7XG5cblx0ICAvLyByZWxhdGl2ZSBwYXRoIHN1cHBvcnRcblx0ICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiB1cmkpIHtcblx0ICAgIGlmICgnLycgPT09IHVyaS5jaGFyQXQoMCkpIHtcblx0ICAgICAgaWYgKCcvJyA9PT0gdXJpLmNoYXJBdCgxKSkge1xuXHQgICAgICAgIHVyaSA9IGxvYy5wcm90b2NvbCArIHVyaTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB1cmkgPSBsb2MuaG9zdCArIHVyaTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBpZiAoIS9eKGh0dHBzP3x3c3M/KTpcXC9cXC8vLnRlc3QodXJpKSkge1xuXHQgICAgICBkZWJ1ZyQyKCdwcm90b2NvbC1sZXNzIHVybCAlcycsIHVyaSk7XG5cdCAgICAgIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGxvYykge1xuXHQgICAgICAgIHVyaSA9IGxvYy5wcm90b2NvbCArICcvLycgKyB1cmk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdXJpID0gJ2h0dHBzOi8vJyArIHVyaTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICAvLyBwYXJzZVxuXHQgICAgZGVidWckMigncGFyc2UgJXMnLCB1cmkpO1xuXHQgICAgb2JqID0gcGFyc2V1cmkkMih1cmkpO1xuXHQgIH1cblxuXHQgIC8vIG1ha2Ugc3VyZSB3ZSB0cmVhdCBgbG9jYWxob3N0OjgwYCBhbmQgYGxvY2FsaG9zdGAgZXF1YWxseVxuXHQgIGlmICghb2JqLnBvcnQpIHtcblx0ICAgIGlmICgvXihodHRwfHdzKSQvLnRlc3Qob2JqLnByb3RvY29sKSkge1xuXHQgICAgICBvYmoucG9ydCA9ICc4MCc7XG5cdCAgICB9IGVsc2UgaWYgKC9eKGh0dHB8d3MpcyQvLnRlc3Qob2JqLnByb3RvY29sKSkge1xuXHQgICAgICBvYmoucG9ydCA9ICc0NDMnO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIG9iai5wYXRoID0gb2JqLnBhdGggfHwgJy8nO1xuXG5cdCAgdmFyIGlwdjYgPSBvYmouaG9zdC5pbmRleE9mKCc6JykgIT09IC0xO1xuXHQgIHZhciBob3N0ID0gaXB2NiA/ICdbJyArIG9iai5ob3N0ICsgJ10nIDogb2JqLmhvc3Q7XG5cblx0ICAvLyBkZWZpbmUgdW5pcXVlIGlkXG5cdCAgb2JqLmlkID0gb2JqLnByb3RvY29sICsgJzovLycgKyBob3N0ICsgJzonICsgb2JqLnBvcnQ7XG5cdCAgLy8gZGVmaW5lIGhyZWZcblx0ICBvYmouaHJlZiA9IG9iai5wcm90b2NvbCArICc6Ly8nICsgaG9zdCArIChsb2MgJiYgbG9jLnBvcnQgPT09IG9iai5wb3J0ID8gJycgOiAnOicgKyBvYmoucG9ydCk7XG5cblx0ICByZXR1cm4gb2JqO1xuXHR9XG5cblx0dmFyIHVybCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHVybF8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdXJsXzFcblx0fSk7XG5cblx0dmFyIGNvbXBvbmVudEVtaXR0ZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlKSB7XG5cdCAgLyoqXHJcblx0ICAgKiBFeHBvc2UgYEVtaXR0ZXJgLlxyXG5cdCAgICovXG5cblx0ICB7XG5cdCAgICBtb2R1bGUuZXhwb3J0cyA9IEVtaXR0ZXI7XG5cdCAgfVxuXG5cdCAgLyoqXHJcblx0ICAgKiBJbml0aWFsaXplIGEgbmV3IGBFbWl0dGVyYC5cclxuXHQgICAqXHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBFbWl0dGVyKG9iaikge1xuXHQgICAgaWYgKG9iaikgcmV0dXJuIG1peGluKG9iaik7XG5cdCAgfVxuXHQgIC8qKlxyXG5cdCAgICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gb2JqXHJcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICAgKiBAYXBpIHByaXZhdGVcclxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbWl4aW4ob2JqKSB7XG5cdCAgICBmb3IgKHZhciBrZXkgaW4gRW1pdHRlci5wcm90b3R5cGUpIHtcblx0ICAgICAgb2JqW2tleV0gPSBFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG9iajtcblx0ICB9XG5cblx0ICAvKipcclxuXHQgICAqIExpc3RlbiBvbiB0aGUgZ2l2ZW4gYGV2ZW50YCB3aXRoIGBmbmAuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAgICogQHJldHVybiB7RW1pdHRlcn1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRW1pdHRlci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0ICAgICh0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSB8fCBbXSkucHVzaChmbik7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBBZGRzIGFuIGBldmVudGAgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGludm9rZWQgYSBzaW5nbGVcclxuXHQgICAqIHRpbWUgdGhlbiBhdXRvbWF0aWNhbGx5IHJlbW92ZWQuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAgICogQHJldHVybiB7RW1pdHRlcn1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG5cdCAgICBmdW5jdGlvbiBvbigpIHtcblx0ICAgICAgdGhpcy5vZmYoZXZlbnQsIG9uKTtcblx0ICAgICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0ICAgIH1cblxuXHQgICAgb24uZm4gPSBmbjtcblx0ICAgIHRoaXMub24oZXZlbnQsIG9uKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIFJlbW92ZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGBldmVudGAgb3IgYWxsXHJcblx0ICAgKiByZWdpc3RlcmVkIGNhbGxiYWNrcy5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXHJcblx0ICAgKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgRW1pdHRlci5wcm90b3R5cGUub2ZmID0gRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuXHQgICAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXG5cdCAgICAvLyBhbGxcblx0ICAgIGlmICgwID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcblx0ICAgICAgdGhpcy5fY2FsbGJhY2tzID0ge307XG5cdCAgICAgIHJldHVybiB0aGlzO1xuXHQgICAgfVxuXG5cdCAgICAvLyBzcGVjaWZpYyBldmVudFxuXHQgICAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XG5cdCAgICBpZiAoIWNhbGxiYWNrcykgcmV0dXJuIHRoaXM7XG5cblx0ICAgIC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcblx0ICAgIGlmICgxID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcblx0ICAgICAgZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XG5cdCAgICAgIHJldHVybiB0aGlzO1xuXHQgICAgfVxuXG5cdCAgICAvLyByZW1vdmUgc3BlY2lmaWMgaGFuZGxlclxuXHQgICAgdmFyIGNiO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgY2IgPSBjYWxsYmFja3NbaV07XG5cdCAgICAgIGlmIChjYiA9PT0gZm4gfHwgY2IuZm4gPT09IGZuKSB7XG5cdCAgICAgICAgY2FsbGJhY2tzLnNwbGljZShpLCAxKTtcblx0ICAgICAgICBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogRW1pdCBgZXZlbnRgIHdpdGggdGhlIGdpdmVuIGFyZ3MuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcGFyYW0ge01peGVkfSAuLi5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0ICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuXHQgICAgICAgIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XG5cblx0ICAgIGlmIChjYWxsYmFja3MpIHtcblx0ICAgICAgY2FsbGJhY2tzID0gY2FsbGJhY2tzLnNsaWNlKDApO1xuXHQgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG5cdCAgICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcmV0dXJuIHtBcnJheX1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXHQgICAgcmV0dXJuIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW107XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogQ2hlY2sgaWYgdGhpcyBlbWl0dGVyIGhhcyBgZXZlbnRgIGhhbmRsZXJzLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHJldHVybiB7Qm9vbGVhbn1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLmhhc0xpc3RlbmVycyA9IGZ1bmN0aW9uIChldmVudCkge1xuXHQgICAgcmV0dXJuICEhdGhpcy5saXN0ZW5lcnMoZXZlbnQpLmxlbmd0aDtcblx0ICB9O1xuXHR9KTtcblxuXHR2YXIgY29tcG9uZW50RW1pdHRlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGNvbXBvbmVudEVtaXR0ZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBjb21wb25lbnRFbWl0dGVyXG5cdH0pO1xuXG5cdHZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5cdHZhciBpc2FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG5cdCAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xuXHR9O1xuXG5cdHZhciBpc2FycmF5JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaXNhcnJheSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGlzYXJyYXlcblx0fSk7XG5cblx0dmFyIGlzQnVmZmVyID0gaXNCdWY7XG5cblx0dmFyIHdpdGhOYXRpdmVCdWZmZXIgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuQnVmZmVyID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBjb21tb25qc0dsb2JhbC5CdWZmZXIuaXNCdWZmZXIgPT09ICdmdW5jdGlvbic7XG5cdHZhciB3aXRoTmF0aXZlQXJyYXlCdWZmZXIgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIgPT09ICdmdW5jdGlvbic7XG5cblx0dmFyIGlzVmlldyA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAod2l0aE5hdGl2ZUFycmF5QnVmZmVyICYmIHR5cGVvZiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlci5pc1ZpZXcgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgIHJldHVybiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlci5pc1ZpZXc7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICAgIHJldHVybiBvYmouYnVmZmVyIGluc3RhbmNlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXI7XG5cdCAgICB9O1xuXHQgIH1cblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgb2JqIGlzIGEgYnVmZmVyIG9yIGFuIGFycmF5YnVmZmVyLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gaXNCdWYob2JqKSB7XG5cdCAgcmV0dXJuIHdpdGhOYXRpdmVCdWZmZXIgJiYgY29tbW9uanNHbG9iYWwuQnVmZmVyLmlzQnVmZmVyKG9iaikgfHwgd2l0aE5hdGl2ZUFycmF5QnVmZmVyICYmIChvYmogaW5zdGFuY2VvZiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlciB8fCBpc1ZpZXcob2JqKSk7XG5cdH1cblxuXHR2YXIgaXNCdWZmZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBpc0J1ZmZlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGlzQnVmZmVyXG5cdH0pO1xuXG5cdHZhciBpc0FycmF5ID0gKCBpc2FycmF5JDEgJiYgaXNhcnJheSApIHx8IGlzYXJyYXkkMTtcblxuXHR2YXIgaXNCdWYkMSA9ICggaXNCdWZmZXIkMSAmJiBpc0J1ZmZlciApIHx8IGlzQnVmZmVyJDE7XG5cblx0LypnbG9iYWwgQmxvYixGaWxlKi9cblxuXHQvKipcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50c1xuXHQgKi9cblxuXHR2YXIgdG9TdHJpbmckMSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cdHZhciB3aXRoTmF0aXZlQmxvYiA9IHR5cGVvZiBjb21tb25qc0dsb2JhbC5CbG9iID09PSAnZnVuY3Rpb24nIHx8IHRvU3RyaW5nJDEuY2FsbChjb21tb25qc0dsb2JhbC5CbG9iKSA9PT0gJ1tvYmplY3QgQmxvYkNvbnN0cnVjdG9yXSc7XG5cdHZhciB3aXRoTmF0aXZlRmlsZSA9IHR5cGVvZiBjb21tb25qc0dsb2JhbC5GaWxlID09PSAnZnVuY3Rpb24nIHx8IHRvU3RyaW5nJDEuY2FsbChjb21tb25qc0dsb2JhbC5GaWxlKSA9PT0gJ1tvYmplY3QgRmlsZUNvbnN0cnVjdG9yXSc7XG5cblx0LyoqXG5cdCAqIFJlcGxhY2VzIGV2ZXJ5IEJ1ZmZlciB8IEFycmF5QnVmZmVyIGluIHBhY2tldCB3aXRoIGEgbnVtYmVyZWQgcGxhY2Vob2xkZXIuXG5cdCAqIEFueXRoaW5nIHdpdGggYmxvYnMgb3IgZmlsZXMgc2hvdWxkIGJlIGZlZCB0aHJvdWdoIHJlbW92ZUJsb2JzIGJlZm9yZSBjb21pbmdcblx0ICogaGVyZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHBhY2tldCAtIHNvY2tldC5pbyBldmVudCBwYWNrZXRcblx0ICogQHJldHVybiB7T2JqZWN0fSB3aXRoIGRlY29uc3RydWN0ZWQgcGFja2V0IGFuZCBsaXN0IG9mIGJ1ZmZlcnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIGRlY29uc3RydWN0UGFja2V0ID0gZnVuY3Rpb24gZGVjb25zdHJ1Y3RQYWNrZXQocGFja2V0KSB7XG5cdCAgdmFyIGJ1ZmZlcnMgPSBbXTtcblx0ICB2YXIgcGFja2V0RGF0YSA9IHBhY2tldC5kYXRhO1xuXHQgIHZhciBwYWNrID0gcGFja2V0O1xuXHQgIHBhY2suZGF0YSA9IF9kZWNvbnN0cnVjdFBhY2tldChwYWNrZXREYXRhLCBidWZmZXJzKTtcblx0ICBwYWNrLmF0dGFjaG1lbnRzID0gYnVmZmVycy5sZW5ndGg7IC8vIG51bWJlciBvZiBiaW5hcnkgJ2F0dGFjaG1lbnRzJ1xuXHQgIHJldHVybiB7IHBhY2tldDogcGFjaywgYnVmZmVyczogYnVmZmVycyB9O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIF9kZWNvbnN0cnVjdFBhY2tldChkYXRhLCBidWZmZXJzKSB7XG5cdCAgaWYgKCFkYXRhKSByZXR1cm4gZGF0YTtcblxuXHQgIGlmIChpc0J1ZiQxKGRhdGEpKSB7XG5cdCAgICB2YXIgcGxhY2Vob2xkZXIgPSB7IF9wbGFjZWhvbGRlcjogdHJ1ZSwgbnVtOiBidWZmZXJzLmxlbmd0aCB9O1xuXHQgICAgYnVmZmVycy5wdXNoKGRhdGEpO1xuXHQgICAgcmV0dXJuIHBsYWNlaG9sZGVyO1xuXHQgIH0gZWxzZSBpZiAoaXNBcnJheShkYXRhKSkge1xuXHQgICAgdmFyIG5ld0RhdGEgPSBuZXcgQXJyYXkoZGF0YS5sZW5ndGgpO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIG5ld0RhdGFbaV0gPSBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtpXSwgYnVmZmVycyk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gbmV3RGF0YTtcblx0ICB9IGVsc2UgaWYgKCh0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoZGF0YSkpID09PSAnb2JqZWN0JyAmJiAhKGRhdGEgaW5zdGFuY2VvZiBEYXRlKSkge1xuXHQgICAgdmFyIG5ld0RhdGEgPSB7fTtcblx0ICAgIGZvciAodmFyIGtleSBpbiBkYXRhKSB7XG5cdCAgICAgIG5ld0RhdGFba2V5XSA9IF9kZWNvbnN0cnVjdFBhY2tldChkYXRhW2tleV0sIGJ1ZmZlcnMpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG5ld0RhdGE7XG5cdCAgfVxuXHQgIHJldHVybiBkYXRhO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlY29uc3RydWN0cyBhIGJpbmFyeSBwYWNrZXQgZnJvbSBpdHMgcGxhY2Vob2xkZXIgcGFja2V0IGFuZCBidWZmZXJzXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQgLSBldmVudCBwYWNrZXQgd2l0aCBwbGFjZWhvbGRlcnNcblx0ICogQHBhcmFtIHtBcnJheX0gYnVmZmVycyAtIGJpbmFyeSBidWZmZXJzIHRvIHB1dCBpbiBwbGFjZWhvbGRlciBwb3NpdGlvbnNcblx0ICogQHJldHVybiB7T2JqZWN0fSByZWNvbnN0cnVjdGVkIHBhY2tldFxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgcmVjb25zdHJ1Y3RQYWNrZXQgPSBmdW5jdGlvbiByZWNvbnN0cnVjdFBhY2tldChwYWNrZXQsIGJ1ZmZlcnMpIHtcblx0ICBwYWNrZXQuZGF0YSA9IF9yZWNvbnN0cnVjdFBhY2tldChwYWNrZXQuZGF0YSwgYnVmZmVycyk7XG5cdCAgcGFja2V0LmF0dGFjaG1lbnRzID0gdW5kZWZpbmVkOyAvLyBubyBsb25nZXIgdXNlZnVsXG5cdCAgcmV0dXJuIHBhY2tldDtcblx0fTtcblxuXHRmdW5jdGlvbiBfcmVjb25zdHJ1Y3RQYWNrZXQoZGF0YSwgYnVmZmVycykge1xuXHQgIGlmICghZGF0YSkgcmV0dXJuIGRhdGE7XG5cblx0ICBpZiAoZGF0YSAmJiBkYXRhLl9wbGFjZWhvbGRlcikge1xuXHQgICAgcmV0dXJuIGJ1ZmZlcnNbZGF0YS5udW1dOyAvLyBhcHByb3ByaWF0ZSBidWZmZXIgKHNob3VsZCBiZSBuYXR1cmFsIG9yZGVyIGFueXdheSlcblx0ICB9IGVsc2UgaWYgKGlzQXJyYXkoZGF0YSkpIHtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHQgICAgICBkYXRhW2ldID0gX3JlY29uc3RydWN0UGFja2V0KGRhdGFbaV0sIGJ1ZmZlcnMpO1xuXHQgICAgfVxuXHQgIH0gZWxzZSBpZiAoKHR5cGVvZiBkYXRhID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihkYXRhKSkgPT09ICdvYmplY3QnKSB7XG5cdCAgICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuXHQgICAgICBkYXRhW2tleV0gPSBfcmVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtrZXldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gZGF0YTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBc3luY2hyb25vdXNseSByZW1vdmVzIEJsb2JzIG9yIEZpbGVzIGZyb20gZGF0YSB2aWFcblx0ICogRmlsZVJlYWRlcidzIHJlYWRBc0FycmF5QnVmZmVyIG1ldGhvZC4gVXNlZCBiZWZvcmUgZW5jb2Rpbmdcblx0ICogZGF0YSBhcyBtc2dwYWNrLiBDYWxscyBjYWxsYmFjayB3aXRoIHRoZSBibG9ibGVzcyBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0dmFyIHJlbW92ZUJsb2JzID0gZnVuY3Rpb24gcmVtb3ZlQmxvYnMoZGF0YSwgY2FsbGJhY2spIHtcblx0ICBmdW5jdGlvbiBfcmVtb3ZlQmxvYnMob2JqLCBjdXJLZXksIGNvbnRhaW5pbmdPYmplY3QpIHtcblx0ICAgIGlmICghb2JqKSByZXR1cm4gb2JqO1xuXG5cdCAgICAvLyBjb252ZXJ0IGFueSBibG9iXG5cdCAgICBpZiAod2l0aE5hdGl2ZUJsb2IgJiYgb2JqIGluc3RhbmNlb2YgQmxvYiB8fCB3aXRoTmF0aXZlRmlsZSAmJiBvYmogaW5zdGFuY2VvZiBGaWxlKSB7XG5cdCAgICAgIHBlbmRpbmdCbG9icysrO1xuXG5cdCAgICAgIC8vIGFzeW5jIGZpbGVyZWFkZXJcblx0ICAgICAgdmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXHQgICAgICBmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAvLyB0aGlzLnJlc3VsdCA9PSBhcnJheWJ1ZmZlclxuXHQgICAgICAgIGlmIChjb250YWluaW5nT2JqZWN0KSB7XG5cdCAgICAgICAgICBjb250YWluaW5nT2JqZWN0W2N1cktleV0gPSB0aGlzLnJlc3VsdDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgYmxvYmxlc3NEYXRhID0gdGhpcy5yZXN1bHQ7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgLy8gaWYgbm90aGluZyBwZW5kaW5nIGl0cyBjYWxsYmFjayB0aW1lXG5cdCAgICAgICAgaWYgKCEgLS1wZW5kaW5nQmxvYnMpIHtcblx0ICAgICAgICAgIGNhbGxiYWNrKGJsb2JsZXNzRGF0YSk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXG5cdCAgICAgIGZpbGVSZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIob2JqKTsgLy8gYmxvYiAtPiBhcnJheWJ1ZmZlclxuXHQgICAgfSBlbHNlIGlmIChpc0FycmF5KG9iaikpIHtcblx0ICAgICAgLy8gaGFuZGxlIGFycmF5XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgX3JlbW92ZUJsb2JzKG9ialtpXSwgaSwgb2JqKTtcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIGlmICgodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yob2JqKSkgPT09ICdvYmplY3QnICYmICFpc0J1ZiQxKG9iaikpIHtcblx0ICAgICAgLy8gYW5kIG9iamVjdFxuXHQgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG5cdCAgICAgICAgX3JlbW92ZUJsb2JzKG9ialtrZXldLCBrZXksIG9iaik7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9XG5cblx0ICB2YXIgcGVuZGluZ0Jsb2JzID0gMDtcblx0ICB2YXIgYmxvYmxlc3NEYXRhID0gZGF0YTtcblx0ICBfcmVtb3ZlQmxvYnMoYmxvYmxlc3NEYXRhKTtcblx0ICBpZiAoIXBlbmRpbmdCbG9icykge1xuXHQgICAgY2FsbGJhY2soYmxvYmxlc3NEYXRhKTtcblx0ICB9XG5cdH07XG5cblx0dmFyIGJpbmFyeSA9IHtcblx0ICBkZWNvbnN0cnVjdFBhY2tldDogZGVjb25zdHJ1Y3RQYWNrZXQsXG5cdCAgcmVjb25zdHJ1Y3RQYWNrZXQ6IHJlY29uc3RydWN0UGFja2V0LFxuXHQgIHJlbW92ZUJsb2JzOiByZW1vdmVCbG9ic1xuXHR9O1xuXG5cdHZhciBiaW5hcnkkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBiaW5hcnksXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBiaW5hcnksXG5cdFx0ZGVjb25zdHJ1Y3RQYWNrZXQ6IGRlY29uc3RydWN0UGFja2V0LFxuXHRcdHJlY29uc3RydWN0UGFja2V0OiByZWNvbnN0cnVjdFBhY2tldCxcblx0XHRyZW1vdmVCbG9iczogcmVtb3ZlQmxvYnNcblx0fSk7XG5cblx0dmFyIEVtaXR0ZXIgPSAoIGNvbXBvbmVudEVtaXR0ZXIkMSAmJiBjb21wb25lbnRFbWl0dGVyICkgfHwgY29tcG9uZW50RW1pdHRlciQxO1xuXG5cdHZhciBiaW5hcnkkMiA9ICggYmluYXJ5JDEgJiYgYmluYXJ5ICkgfHwgYmluYXJ5JDE7XG5cblx0dmFyIHNvY2tldF9pb1BhcnNlciA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIGRlYnVnID0gcmVxdWlyZSQkMCQyKCdzb2NrZXQuaW8tcGFyc2VyJyk7XG5cblx0ICAvKipcblx0ICAgKiBQcm90b2NvbCB2ZXJzaW9uLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMucHJvdG9jb2wgPSA0O1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGVzLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMudHlwZXMgPSBbJ0NPTk5FQ1QnLCAnRElTQ09OTkVDVCcsICdFVkVOVCcsICdBQ0snLCAnRVJST1InLCAnQklOQVJZX0VWRU5UJywgJ0JJTkFSWV9BQ0snXTtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBjb25uZWN0YC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkNPTk5FQ1QgPSAwO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGRpc2Nvbm5lY3RgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRElTQ09OTkVDVCA9IDE7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgZXZlbnRgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRVZFTlQgPSAyO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGFja2AuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5BQ0sgPSAzO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGVycm9yYC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkVSUk9SID0gNDtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlICdiaW5hcnkgZXZlbnQnXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5CSU5BUllfRVZFTlQgPSA1O1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGJpbmFyeSBhY2tgLiBGb3IgYWNrcyB3aXRoIGJpbmFyeSBhcmd1bWVudHMuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5CSU5BUllfQUNLID0gNjtcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXIgY29uc3RydWN0b3IuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5FbmNvZGVyID0gRW5jb2RlcjtcblxuXHQgIC8qKlxuXHQgICAqIERlY29kZXIgY29uc3RydWN0b3IuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5EZWNvZGVyID0gRGVjb2RlcjtcblxuXHQgIC8qKlxuXHQgICAqIEEgc29ja2V0LmlvIEVuY29kZXIgaW5zdGFuY2Vcblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBFbmNvZGVyKCkge31cblxuXHQgIHZhciBFUlJPUl9QQUNLRVQgPSBleHBvcnRzLkVSUk9SICsgJ1wiZW5jb2RlIGVycm9yXCInO1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIGEgcGFja2V0IGFzIGEgc2luZ2xlIHN0cmluZyBpZiBub24tYmluYXJ5LCBvciBhcyBhXG5cdCAgICogYnVmZmVyIHNlcXVlbmNlLCBkZXBlbmRpbmcgb24gcGFja2V0IHR5cGUuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIC0gcGFja2V0IG9iamVjdFxuXHQgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gZnVuY3Rpb24gdG8gaGFuZGxlIGVuY29kaW5ncyAobGlrZWx5IGVuZ2luZS53cml0ZSlcblx0ICAgKiBAcmV0dXJuIENhbGxzIGNhbGxiYWNrIHdpdGggQXJyYXkgb2YgZW5jb2RpbmdzXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIEVuY29kZXIucHJvdG90eXBlLmVuY29kZSA9IGZ1bmN0aW9uIChvYmosIGNhbGxiYWNrKSB7XG5cdCAgICBkZWJ1ZygnZW5jb2RpbmcgcGFja2V0ICVqJywgb2JqKTtcblxuXHQgICAgaWYgKGV4cG9ydHMuQklOQVJZX0VWRU5UID09PSBvYmoudHlwZSB8fCBleHBvcnRzLkJJTkFSWV9BQ0sgPT09IG9iai50eXBlKSB7XG5cdCAgICAgIGVuY29kZUFzQmluYXJ5KG9iaiwgY2FsbGJhY2spO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdmFyIGVuY29kaW5nID0gZW5jb2RlQXNTdHJpbmcob2JqKTtcblx0ICAgICAgY2FsbGJhY2soW2VuY29kaW5nXSk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBwYWNrZXQgYXMgc3RyaW5nLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEByZXR1cm4ge1N0cmluZ30gZW5jb2RlZFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQXNTdHJpbmcob2JqKSB7XG5cblx0ICAgIC8vIGZpcnN0IGlzIHR5cGVcblx0ICAgIHZhciBzdHIgPSAnJyArIG9iai50eXBlO1xuXG5cdCAgICAvLyBhdHRhY2htZW50cyBpZiB3ZSBoYXZlIHRoZW1cblx0ICAgIGlmIChleHBvcnRzLkJJTkFSWV9FVkVOVCA9PT0gb2JqLnR5cGUgfHwgZXhwb3J0cy5CSU5BUllfQUNLID09PSBvYmoudHlwZSkge1xuXHQgICAgICBzdHIgKz0gb2JqLmF0dGFjaG1lbnRzICsgJy0nO1xuXHQgICAgfVxuXG5cdCAgICAvLyBpZiB3ZSBoYXZlIGEgbmFtZXNwYWNlIG90aGVyIHRoYW4gYC9gXG5cdCAgICAvLyB3ZSBhcHBlbmQgaXQgZm9sbG93ZWQgYnkgYSBjb21tYSBgLGBcblx0ICAgIGlmIChvYmoubnNwICYmICcvJyAhPT0gb2JqLm5zcCkge1xuXHQgICAgICBzdHIgKz0gb2JqLm5zcCArICcsJztcblx0ICAgIH1cblxuXHQgICAgLy8gaW1tZWRpYXRlbHkgZm9sbG93ZWQgYnkgdGhlIGlkXG5cdCAgICBpZiAobnVsbCAhPSBvYmouaWQpIHtcblx0ICAgICAgc3RyICs9IG9iai5pZDtcblx0ICAgIH1cblxuXHQgICAgLy8ganNvbiBkYXRhXG5cdCAgICBpZiAobnVsbCAhPSBvYmouZGF0YSkge1xuXHQgICAgICB2YXIgcGF5bG9hZCA9IHRyeVN0cmluZ2lmeShvYmouZGF0YSk7XG5cdCAgICAgIGlmIChwYXlsb2FkICE9PSBmYWxzZSkge1xuXHQgICAgICAgIHN0ciArPSBwYXlsb2FkO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHJldHVybiBFUlJPUl9QQUNLRVQ7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgZGVidWcoJ2VuY29kZWQgJWogYXMgJXMnLCBvYmosIHN0cik7XG5cdCAgICByZXR1cm4gc3RyO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRyeVN0cmluZ2lmeShzdHIpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShzdHIpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIHBhY2tldCBhcyAnYnVmZmVyIHNlcXVlbmNlJyBieSByZW1vdmluZyBibG9icywgYW5kXG5cdCAgICogZGVjb25zdHJ1Y3RpbmcgcGFja2V0IGludG8gb2JqZWN0IHdpdGggcGxhY2Vob2xkZXJzIGFuZFxuXHQgICAqIGEgbGlzdCBvZiBidWZmZXJzLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEByZXR1cm4ge0J1ZmZlcn0gZW5jb2RlZFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQXNCaW5hcnkob2JqLCBjYWxsYmFjaykge1xuXG5cdCAgICBmdW5jdGlvbiB3cml0ZUVuY29kaW5nKGJsb2JsZXNzRGF0YSkge1xuXHQgICAgICB2YXIgZGVjb25zdHJ1Y3Rpb24gPSBiaW5hcnkkMi5kZWNvbnN0cnVjdFBhY2tldChibG9ibGVzc0RhdGEpO1xuXHQgICAgICB2YXIgcGFjayA9IGVuY29kZUFzU3RyaW5nKGRlY29uc3RydWN0aW9uLnBhY2tldCk7XG5cdCAgICAgIHZhciBidWZmZXJzID0gZGVjb25zdHJ1Y3Rpb24uYnVmZmVycztcblxuXHQgICAgICBidWZmZXJzLnVuc2hpZnQocGFjayk7IC8vIGFkZCBwYWNrZXQgaW5mbyB0byBiZWdpbm5pbmcgb2YgZGF0YSBsaXN0XG5cdCAgICAgIGNhbGxiYWNrKGJ1ZmZlcnMpOyAvLyB3cml0ZSBhbGwgdGhlIGJ1ZmZlcnNcblx0ICAgIH1cblxuXHQgICAgYmluYXJ5JDIucmVtb3ZlQmxvYnMob2JqLCB3cml0ZUVuY29kaW5nKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBBIHNvY2tldC5pbyBEZWNvZGVyIGluc3RhbmNlXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IGRlY29kZXJcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gRGVjb2RlcigpIHtcblx0ICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG51bGw7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWl4IGluIGBFbWl0dGVyYCB3aXRoIERlY29kZXIuXG5cdCAgICovXG5cblx0ICBFbWl0dGVyKERlY29kZXIucHJvdG90eXBlKTtcblxuXHQgIC8qKlxuXHQgICAqIERlY29kZXMgYW4gZWNvZGVkIHBhY2tldCBzdHJpbmcgaW50byBwYWNrZXQgSlNPTi5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBvYmogLSBlbmNvZGVkIHBhY2tldFxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIERlY29kZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChvYmopIHtcblx0ICAgIHZhciBwYWNrZXQ7XG5cdCAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgcGFja2V0ID0gZGVjb2RlU3RyaW5nKG9iaik7XG5cdCAgICAgIGlmIChleHBvcnRzLkJJTkFSWV9FVkVOVCA9PT0gcGFja2V0LnR5cGUgfHwgZXhwb3J0cy5CSU5BUllfQUNLID09PSBwYWNrZXQudHlwZSkge1xuXHQgICAgICAgIC8vIGJpbmFyeSBwYWNrZXQncyBqc29uXG5cdCAgICAgICAgdGhpcy5yZWNvbnN0cnVjdG9yID0gbmV3IEJpbmFyeVJlY29uc3RydWN0b3IocGFja2V0KTtcblxuXHQgICAgICAgIC8vIG5vIGF0dGFjaG1lbnRzLCBsYWJlbGVkIGJpbmFyeSBidXQgbm8gYmluYXJ5IGRhdGEgdG8gZm9sbG93XG5cdCAgICAgICAgaWYgKHRoaXMucmVjb25zdHJ1Y3Rvci5yZWNvblBhY2suYXR0YWNobWVudHMgPT09IDApIHtcblx0ICAgICAgICAgIHRoaXMuZW1pdCgnZGVjb2RlZCcsIHBhY2tldCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIC8vIG5vbi1iaW5hcnkgZnVsbCBwYWNrZXRcblx0ICAgICAgICB0aGlzLmVtaXQoJ2RlY29kZWQnLCBwYWNrZXQpO1xuXHQgICAgICB9XG5cdCAgICB9IGVsc2UgaWYgKGlzQnVmJDEob2JqKSB8fCBvYmouYmFzZTY0KSB7XG5cdCAgICAgIC8vIHJhdyBiaW5hcnkgZGF0YVxuXHQgICAgICBpZiAoIXRoaXMucmVjb25zdHJ1Y3Rvcikge1xuXHQgICAgICAgIHRocm93IG5ldyBFcnJvcignZ290IGJpbmFyeSBkYXRhIHdoZW4gbm90IHJlY29uc3RydWN0aW5nIGEgcGFja2V0Jyk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcGFja2V0ID0gdGhpcy5yZWNvbnN0cnVjdG9yLnRha2VCaW5hcnlEYXRhKG9iaik7XG5cdCAgICAgICAgaWYgKHBhY2tldCkge1xuXHQgICAgICAgICAgLy8gcmVjZWl2ZWQgZmluYWwgYnVmZmVyXG5cdCAgICAgICAgICB0aGlzLnJlY29uc3RydWN0b3IgPSBudWxsO1xuXHQgICAgICAgICAgdGhpcy5lbWl0KCdkZWNvZGVkJywgcGFja2V0KTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biB0eXBlOiAnICsgb2JqKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlIGEgcGFja2V0IFN0cmluZyAoSlNPTiBkYXRhKVxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IHN0clxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBkZWNvZGVTdHJpbmcoc3RyKSB7XG5cdCAgICB2YXIgaSA9IDA7XG5cdCAgICAvLyBsb29rIHVwIHR5cGVcblx0ICAgIHZhciBwID0ge1xuXHQgICAgICB0eXBlOiBOdW1iZXIoc3RyLmNoYXJBdCgwKSlcblx0ICAgIH07XG5cblx0ICAgIGlmIChudWxsID09IGV4cG9ydHMudHlwZXNbcC50eXBlXSkge1xuXHQgICAgICByZXR1cm4gZXJyb3IoJ3Vua25vd24gcGFja2V0IHR5cGUgJyArIHAudHlwZSk7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAgYXR0YWNobWVudHMgaWYgdHlwZSBiaW5hcnlcblx0ICAgIGlmIChleHBvcnRzLkJJTkFSWV9FVkVOVCA9PT0gcC50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gcC50eXBlKSB7XG5cdCAgICAgIHZhciBidWYgPSAnJztcblx0ICAgICAgd2hpbGUgKHN0ci5jaGFyQXQoKytpKSAhPT0gJy0nKSB7XG5cdCAgICAgICAgYnVmICs9IHN0ci5jaGFyQXQoaSk7XG5cdCAgICAgICAgaWYgKGkgPT0gc3RyLmxlbmd0aCkgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgICAgaWYgKGJ1ZiAhPSBOdW1iZXIoYnVmKSB8fCBzdHIuY2hhckF0KGkpICE9PSAnLScpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgYXR0YWNobWVudHMnKTtcblx0ICAgICAgfVxuXHQgICAgICBwLmF0dGFjaG1lbnRzID0gTnVtYmVyKGJ1Zik7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAgbmFtZXNwYWNlIChpZiBhbnkpXG5cdCAgICBpZiAoJy8nID09PSBzdHIuY2hhckF0KGkgKyAxKSkge1xuXHQgICAgICBwLm5zcCA9ICcnO1xuXHQgICAgICB3aGlsZSAoKytpKSB7XG5cdCAgICAgICAgdmFyIGMgPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmICgnLCcgPT09IGMpIGJyZWFrO1xuXHQgICAgICAgIHAubnNwICs9IGM7XG5cdCAgICAgICAgaWYgKGkgPT09IHN0ci5sZW5ndGgpIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBwLm5zcCA9ICcvJztcblx0ICAgIH1cblxuXHQgICAgLy8gbG9vayB1cCBpZFxuXHQgICAgdmFyIG5leHQgPSBzdHIuY2hhckF0KGkgKyAxKTtcblx0ICAgIGlmICgnJyAhPT0gbmV4dCAmJiBOdW1iZXIobmV4dCkgPT0gbmV4dCkge1xuXHQgICAgICBwLmlkID0gJyc7XG5cdCAgICAgIHdoaWxlICgrK2kpIHtcblx0ICAgICAgICB2YXIgYyA9IHN0ci5jaGFyQXQoaSk7XG5cdCAgICAgICAgaWYgKG51bGwgPT0gYyB8fCBOdW1iZXIoYykgIT0gYykge1xuXHQgICAgICAgICAgLS1pO1xuXHQgICAgICAgICAgYnJlYWs7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIHAuaWQgKz0gc3RyLmNoYXJBdChpKTtcblx0ICAgICAgICBpZiAoaSA9PT0gc3RyLmxlbmd0aCkgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgICAgcC5pZCA9IE51bWJlcihwLmlkKTtcblx0ICAgIH1cblxuXHQgICAgLy8gbG9vayB1cCBqc29uIGRhdGFcblx0ICAgIGlmIChzdHIuY2hhckF0KCsraSkpIHtcblx0ICAgICAgdmFyIHBheWxvYWQgPSB0cnlQYXJzZShzdHIuc3Vic3RyKGkpKTtcblx0ICAgICAgdmFyIGlzUGF5bG9hZFZhbGlkID0gcGF5bG9hZCAhPT0gZmFsc2UgJiYgKHAudHlwZSA9PT0gZXhwb3J0cy5FUlJPUiB8fCBpc0FycmF5KHBheWxvYWQpKTtcblx0ICAgICAgaWYgKGlzUGF5bG9hZFZhbGlkKSB7XG5cdCAgICAgICAgcC5kYXRhID0gcGF5bG9hZDtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gZXJyb3IoJ2ludmFsaWQgcGF5bG9hZCcpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGRlYnVnKCdkZWNvZGVkICVzIGFzICVqJywgc3RyLCBwKTtcblx0ICAgIHJldHVybiBwO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHRyeVBhcnNlKHN0cikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIERlYWxsb2NhdGVzIGEgcGFyc2VyJ3MgcmVzb3VyY2VzXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgRGVjb2Rlci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLnJlY29uc3RydWN0b3IpIHtcblx0ICAgICAgdGhpcy5yZWNvbnN0cnVjdG9yLmZpbmlzaGVkUmVjb25zdHJ1Y3Rpb24oKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQSBtYW5hZ2VyIG9mIGEgYmluYXJ5IGV2ZW50J3MgJ2J1ZmZlciBzZXF1ZW5jZScuIFNob3VsZFxuXHQgICAqIGJlIGNvbnN0cnVjdGVkIHdoZW5ldmVyIGEgcGFja2V0IG9mIHR5cGUgQklOQVJZX0VWRU5UIGlzXG5cdCAgICogZGVjb2RlZC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtCaW5hcnlSZWNvbnN0cnVjdG9yfSBpbml0aWFsaXplZCByZWNvbnN0cnVjdG9yXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBCaW5hcnlSZWNvbnN0cnVjdG9yKHBhY2tldCkge1xuXHQgICAgdGhpcy5yZWNvblBhY2sgPSBwYWNrZXQ7XG5cdCAgICB0aGlzLmJ1ZmZlcnMgPSBbXTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBNZXRob2QgdG8gYmUgY2FsbGVkIHdoZW4gYmluYXJ5IGRhdGEgcmVjZWl2ZWQgZnJvbSBjb25uZWN0aW9uXG5cdCAgICogYWZ0ZXIgYSBCSU5BUllfRVZFTlQgcGFja2V0LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtCdWZmZXIgfCBBcnJheUJ1ZmZlcn0gYmluRGF0YSAtIHRoZSByYXcgYmluYXJ5IGRhdGEgcmVjZWl2ZWRcblx0ICAgKiBAcmV0dXJuIHtudWxsIHwgT2JqZWN0fSByZXR1cm5zIG51bGwgaWYgbW9yZSBiaW5hcnkgZGF0YSBpcyBleHBlY3RlZCBvclxuXHQgICAqICAgYSByZWNvbnN0cnVjdGVkIHBhY2tldCBvYmplY3QgaWYgYWxsIGJ1ZmZlcnMgaGF2ZSBiZWVuIHJlY2VpdmVkLlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgQmluYXJ5UmVjb25zdHJ1Y3Rvci5wcm90b3R5cGUudGFrZUJpbmFyeURhdGEgPSBmdW5jdGlvbiAoYmluRGF0YSkge1xuXHQgICAgdGhpcy5idWZmZXJzLnB1c2goYmluRGF0YSk7XG5cdCAgICBpZiAodGhpcy5idWZmZXJzLmxlbmd0aCA9PT0gdGhpcy5yZWNvblBhY2suYXR0YWNobWVudHMpIHtcblx0ICAgICAgLy8gZG9uZSB3aXRoIGJ1ZmZlciBsaXN0XG5cdCAgICAgIHZhciBwYWNrZXQgPSBiaW5hcnkkMi5yZWNvbnN0cnVjdFBhY2tldCh0aGlzLnJlY29uUGFjaywgdGhpcy5idWZmZXJzKTtcblx0ICAgICAgdGhpcy5maW5pc2hlZFJlY29uc3RydWN0aW9uKCk7XG5cdCAgICAgIHJldHVybiBwYWNrZXQ7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gbnVsbDtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2xlYW5zIHVwIGJpbmFyeSBwYWNrZXQgcmVjb25zdHJ1Y3Rpb24gdmFyaWFibGVzLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBCaW5hcnlSZWNvbnN0cnVjdG9yLnByb3RvdHlwZS5maW5pc2hlZFJlY29uc3RydWN0aW9uID0gZnVuY3Rpb24gKCkge1xuXHQgICAgdGhpcy5yZWNvblBhY2sgPSBudWxsO1xuXHQgICAgdGhpcy5idWZmZXJzID0gW107XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIGVycm9yKG1zZykge1xuXHQgICAgcmV0dXJuIHtcblx0ICAgICAgdHlwZTogZXhwb3J0cy5FUlJPUixcblx0ICAgICAgZGF0YTogJ3BhcnNlciBlcnJvcjogJyArIG1zZ1xuXHQgICAgfTtcblx0ICB9XG5cdH0pO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzEgPSBzb2NrZXRfaW9QYXJzZXIucHJvdG9jb2w7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMiA9IHNvY2tldF9pb1BhcnNlci50eXBlcztcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8zID0gc29ja2V0X2lvUGFyc2VyLkNPTk5FQ1Q7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfNCA9IHNvY2tldF9pb1BhcnNlci5ESVNDT05ORUNUO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzUgPSBzb2NrZXRfaW9QYXJzZXIuRVZFTlQ7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfNiA9IHNvY2tldF9pb1BhcnNlci5BQ0s7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfNyA9IHNvY2tldF9pb1BhcnNlci5FUlJPUjtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl84ID0gc29ja2V0X2lvUGFyc2VyLkJJTkFSWV9FVkVOVDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl85ID0gc29ja2V0X2lvUGFyc2VyLkJJTkFSWV9BQ0s7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMTAgPSBzb2NrZXRfaW9QYXJzZXIuRW5jb2Rlcjtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8xMSA9IHNvY2tldF9pb1BhcnNlci5EZWNvZGVyO1xuXG5cdHZhciBzb2NrZXRfaW9QYXJzZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBzb2NrZXRfaW9QYXJzZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBzb2NrZXRfaW9QYXJzZXIsXG5cdFx0cHJvdG9jb2w6IHNvY2tldF9pb1BhcnNlcl8xLFxuXHRcdHR5cGVzOiBzb2NrZXRfaW9QYXJzZXJfMixcblx0XHRDT05ORUNUOiBzb2NrZXRfaW9QYXJzZXJfMyxcblx0XHRESVNDT05ORUNUOiBzb2NrZXRfaW9QYXJzZXJfNCxcblx0XHRFVkVOVDogc29ja2V0X2lvUGFyc2VyXzUsXG5cdFx0QUNLOiBzb2NrZXRfaW9QYXJzZXJfNixcblx0XHRFUlJPUjogc29ja2V0X2lvUGFyc2VyXzcsXG5cdFx0QklOQVJZX0VWRU5UOiBzb2NrZXRfaW9QYXJzZXJfOCxcblx0XHRCSU5BUllfQUNLOiBzb2NrZXRfaW9QYXJzZXJfOSxcblx0XHRFbmNvZGVyOiBzb2NrZXRfaW9QYXJzZXJfMTAsXG5cdFx0RGVjb2Rlcjogc29ja2V0X2lvUGFyc2VyXzExXG5cdH0pO1xuXG5cdHZhciBoYXNDb3JzID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBleHBvcnRzLlxuXHQgICAqXG5cdCAgICogTG9naWMgYm9ycm93ZWQgZnJvbSBNb2Rlcm5penI6XG5cdCAgICpcblx0ICAgKiAgIC0gaHR0cHM6Ly9naXRodWIuY29tL01vZGVybml6ci9Nb2Rlcm5penIvYmxvYi9tYXN0ZXIvZmVhdHVyZS1kZXRlY3RzL2NvcnMuanNcblx0ICAgKi9cblxuXHQgIHRyeSB7XG5cdCAgICBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcgJiYgJ3dpdGhDcmVkZW50aWFscycgaW4gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdCAgfSBjYXRjaCAoZXJyKSB7XG5cdCAgICAvLyBpZiBYTUxIdHRwIHN1cHBvcnQgaXMgZGlzYWJsZWQgaW4gSUUgdGhlbiBpdCB3aWxsIHRocm93XG5cdCAgICAvLyB3aGVuIHRyeWluZyB0byBjcmVhdGVcblx0ICAgIG1vZHVsZS5leHBvcnRzID0gZmFsc2U7XG5cdCAgfVxuXHR9KTtcblxuXHR2YXIgaGFzQ29ycyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGhhc0NvcnMsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBoYXNDb3JzXG5cdH0pO1xuXG5cdHZhciBoYXNDT1JTID0gKCBoYXNDb3JzJDEgJiYgaGFzQ29ycyApIHx8IGhhc0NvcnMkMTtcblxuXHQvLyBicm93c2VyIHNoaW0gZm9yIHhtbGh0dHByZXF1ZXN0IG1vZHVsZVxuXG5cblx0dmFyIHhtbGh0dHByZXF1ZXN0ID0gZnVuY3Rpb24geG1saHR0cHJlcXVlc3Qob3B0cykge1xuXHQgIHZhciB4ZG9tYWluID0gb3B0cy54ZG9tYWluO1xuXG5cdCAgLy8gc2NoZW1lIG11c3QgYmUgc2FtZSB3aGVuIHVzaWduIFhEb21haW5SZXF1ZXN0XG5cdCAgLy8gaHR0cDovL2Jsb2dzLm1zZG4uY29tL2IvaWVpbnRlcm5hbHMvYXJjaGl2ZS8yMDEwLzA1LzEzL3hkb21haW5yZXF1ZXN0LXJlc3RyaWN0aW9ucy1saW1pdGF0aW9ucy1hbmQtd29ya2Fyb3VuZHMuYXNweFxuXHQgIHZhciB4c2NoZW1lID0gb3B0cy54c2NoZW1lO1xuXG5cdCAgLy8gWERvbWFpblJlcXVlc3QgaGFzIGEgZmxvdyBvZiBub3Qgc2VuZGluZyBjb29raWUsIHRoZXJlZm9yZSBpdCBzaG91bGQgYmUgZGlzYWJsZWQgYXMgYSBkZWZhdWx0LlxuXHQgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9BdXRvbWF0dGljL2VuZ2luZS5pby1jbGllbnQvcHVsbC8yMTdcblx0ICB2YXIgZW5hYmxlc1hEUiA9IG9wdHMuZW5hYmxlc1hEUjtcblxuXHQgIC8vIFhNTEh0dHBSZXF1ZXN0IGNhbiBiZSBkaXNhYmxlZCBvbiBJRVxuXHQgIHRyeSB7XG5cdCAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAmJiAoIXhkb21haW4gfHwgaGFzQ09SUykpIHtcblx0ICAgICAgcmV0dXJuIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHQgICAgfVxuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICAvLyBVc2UgWERvbWFpblJlcXVlc3QgZm9yIElFOCBpZiBlbmFibGVzWERSIGlzIHRydWVcblx0ICAvLyBiZWNhdXNlIGxvYWRpbmcgYmFyIGtlZXBzIGZsYXNoaW5nIHdoZW4gdXNpbmcganNvbnAtcG9sbGluZ1xuXHQgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS95dWppb3Nha2Evc29ja2UuaW8taWU4LWxvYWRpbmctZXhhbXBsZVxuXHQgIHRyeSB7XG5cdCAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBYRG9tYWluUmVxdWVzdCAmJiAheHNjaGVtZSAmJiBlbmFibGVzWERSKSB7XG5cdCAgICAgIHJldHVybiBuZXcgWERvbWFpblJlcXVlc3QoKTtcblx0ICAgIH1cblx0ICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgaWYgKCF4ZG9tYWluKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gbmV3IGNvbW1vbmpzR2xvYmFsW1snQWN0aXZlJ10uY29uY2F0KCdPYmplY3QnKS5qb2luKCdYJyldKCdNaWNyb3NvZnQuWE1MSFRUUCcpO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICB9XG5cdH07XG5cblx0dmFyIHhtbGh0dHByZXF1ZXN0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogeG1saHR0cHJlcXVlc3QsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB4bWxodHRwcmVxdWVzdFxuXHR9KTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUga2V5cyBmb3IgYW4gb2JqZWN0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtBcnJheX0ga2V5c1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0dmFyIGtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiBrZXlzKG9iaikge1xuXHQgIHZhciBhcnIgPSBbXTtcblx0ICB2YXIgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuXHQgIGZvciAodmFyIGkgaW4gb2JqKSB7XG5cdCAgICBpZiAoaGFzLmNhbGwob2JqLCBpKSkge1xuXHQgICAgICBhcnIucHVzaChpKTtcblx0ICAgIH1cblx0ICB9XG5cdCAgcmV0dXJuIGFycjtcblx0fTtcblxuXHR2YXIga2V5cyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGtleXMsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBrZXlzXG5cdH0pO1xuXG5cdC8qIGdsb2JhbCBCbG9iIEZpbGUgKi9cblxuXHQvKlxuXHQgKiBNb2R1bGUgcmVxdWlyZW1lbnRzLlxuXHQgKi9cblxuXHR2YXIgdG9TdHJpbmckMiA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cdHZhciB3aXRoTmF0aXZlQmxvYiQxID0gdHlwZW9mIEJsb2IgPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIHRvU3RyaW5nJDIuY2FsbChCbG9iKSA9PT0gJ1tvYmplY3QgQmxvYkNvbnN0cnVjdG9yXSc7XG5cdHZhciB3aXRoTmF0aXZlRmlsZSQxID0gdHlwZW9mIEZpbGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIEZpbGUgIT09ICd1bmRlZmluZWQnICYmIHRvU3RyaW5nJDIuY2FsbChGaWxlKSA9PT0gJ1tvYmplY3QgRmlsZUNvbnN0cnVjdG9yXSc7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgaGFzQmluYXJ5MiA9IGhhc0JpbmFyeTtcblxuXHQvKipcblx0ICogQ2hlY2tzIGZvciBiaW5hcnkgZGF0YS5cblx0ICpcblx0ICogU3VwcG9ydHMgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQmxvYiBhbmQgRmlsZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGFueXRoaW5nXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGhhc0JpbmFyeShvYmopIHtcblx0ICBpZiAoIW9iaiB8fCAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yob2JqKSkgIT09ICdvYmplY3QnKSB7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgaWYgKGlzQXJyYXkob2JqKSkge1xuXHQgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBvYmoubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICAgIGlmIChoYXNCaW5hcnkob2JqW2ldKSkge1xuXHQgICAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXG5cdCAgaWYgKHR5cGVvZiBCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgQnVmZmVyLmlzQnVmZmVyICYmIEJ1ZmZlci5pc0J1ZmZlcihvYmopIHx8IHR5cGVvZiBBcnJheUJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBvYmogaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fCB3aXRoTmF0aXZlQmxvYiQxICYmIG9iaiBpbnN0YW5jZW9mIEJsb2IgfHwgd2l0aE5hdGl2ZUZpbGUkMSAmJiBvYmogaW5zdGFuY2VvZiBGaWxlKSB7XG5cdCAgICByZXR1cm4gdHJ1ZTtcblx0ICB9XG5cblx0ICAvLyBzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9BdXRvbWF0dGljL2hhcy1iaW5hcnkvcHVsbC80XG5cdCAgaWYgKG9iai50b0pTT04gJiYgdHlwZW9mIG9iai50b0pTT04gPT09ICdmdW5jdGlvbicgJiYgYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHQgICAgcmV0dXJuIGhhc0JpbmFyeShvYmoudG9KU09OKCksIHRydWUpO1xuXHQgIH1cblxuXHQgIGZvciAodmFyIGtleSBpbiBvYmopIHtcblx0ICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpICYmIGhhc0JpbmFyeShvYmpba2V5XSkpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGhhc0JpbmFyeTIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBoYXNCaW5hcnkyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaGFzQmluYXJ5MlxuXHR9KTtcblxuXHQvKipcblx0ICogQW4gYWJzdHJhY3Rpb24gZm9yIHNsaWNpbmcgYW4gYXJyYXlidWZmZXIgZXZlbiB3aGVuXG5cdCAqIEFycmF5QnVmZmVyLnByb3RvdHlwZS5zbGljZSBpcyBub3Qgc3VwcG9ydGVkXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBhcnJheWJ1ZmZlcl9zbGljZSA9IGZ1bmN0aW9uIGFycmF5YnVmZmVyX3NsaWNlKGFycmF5YnVmZmVyLCBzdGFydCwgZW5kKSB7XG5cdCAgdmFyIGJ5dGVzID0gYXJyYXlidWZmZXIuYnl0ZUxlbmd0aDtcblx0ICBzdGFydCA9IHN0YXJ0IHx8IDA7XG5cdCAgZW5kID0gZW5kIHx8IGJ5dGVzO1xuXG5cdCAgaWYgKGFycmF5YnVmZmVyLnNsaWNlKSB7XG5cdCAgICByZXR1cm4gYXJyYXlidWZmZXIuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cdCAgfVxuXG5cdCAgaWYgKHN0YXJ0IDwgMCkge1xuXHQgICAgc3RhcnQgKz0gYnl0ZXM7XG5cdCAgfVxuXHQgIGlmIChlbmQgPCAwKSB7XG5cdCAgICBlbmQgKz0gYnl0ZXM7XG5cdCAgfVxuXHQgIGlmIChlbmQgPiBieXRlcykge1xuXHQgICAgZW5kID0gYnl0ZXM7XG5cdCAgfVxuXG5cdCAgaWYgKHN0YXJ0ID49IGJ5dGVzIHx8IHN0YXJ0ID49IGVuZCB8fCBieXRlcyA9PT0gMCkge1xuXHQgICAgcmV0dXJuIG5ldyBBcnJheUJ1ZmZlcigwKTtcblx0ICB9XG5cblx0ICB2YXIgYWJ2ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlidWZmZXIpO1xuXHQgIHZhciByZXN1bHQgPSBuZXcgVWludDhBcnJheShlbmQgLSBzdGFydCk7XG5cdCAgZm9yICh2YXIgaSA9IHN0YXJ0LCBpaSA9IDA7IGkgPCBlbmQ7IGkrKywgaWkrKykge1xuXHQgICAgcmVzdWx0W2lpXSA9IGFidltpXTtcblx0ICB9XG5cdCAgcmV0dXJuIHJlc3VsdC5idWZmZXI7XG5cdH07XG5cblx0dmFyIGFycmF5YnVmZmVyX3NsaWNlJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYXJyYXlidWZmZXJfc2xpY2UsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBhcnJheWJ1ZmZlcl9zbGljZVxuXHR9KTtcblxuXHR2YXIgYWZ0ZXJfMSA9IGFmdGVyO1xuXG5cdGZ1bmN0aW9uIGFmdGVyKGNvdW50LCBjYWxsYmFjaywgZXJyX2NiKSB7XG5cdCAgICB2YXIgYmFpbCA9IGZhbHNlO1xuXHQgICAgZXJyX2NiID0gZXJyX2NiIHx8IG5vb3A7XG5cdCAgICBwcm94eS5jb3VudCA9IGNvdW50O1xuXG5cdCAgICByZXR1cm4gY291bnQgPT09IDAgPyBjYWxsYmFjaygpIDogcHJveHk7XG5cblx0ICAgIGZ1bmN0aW9uIHByb3h5KGVyciwgcmVzdWx0KSB7XG5cdCAgICAgICAgaWYgKHByb3h5LmNvdW50IDw9IDApIHtcblx0ICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZnRlciBjYWxsZWQgdG9vIG1hbnkgdGltZXMnKTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgLS1wcm94eS5jb3VudDtcblxuXHQgICAgICAgIC8vIGFmdGVyIGZpcnN0IGVycm9yLCByZXN0IGFyZSBwYXNzZWQgdG8gZXJyX2NiXG5cdCAgICAgICAgaWYgKGVycikge1xuXHQgICAgICAgICAgICBiYWlsID0gdHJ1ZTtcblx0ICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcblx0ICAgICAgICAgICAgLy8gZnV0dXJlIGVycm9yIGNhbGxiYWNrcyB3aWxsIGdvIHRvIGVycm9yIGhhbmRsZXJcblx0ICAgICAgICAgICAgY2FsbGJhY2sgPSBlcnJfY2I7XG5cdCAgICAgICAgfSBlbHNlIGlmIChwcm94eS5jb3VudCA9PT0gMCAmJiAhYmFpbCkge1xuXHQgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuXHQgICAgICAgIH1cblx0ICAgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5cdHZhciBhZnRlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGFmdGVyXzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBhZnRlcl8xXG5cdH0pO1xuXG5cdHZhciB1dGY4ID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQoZnVuY3Rpb24gKHJvb3QpIHtcblxuXHRcdFx0Ly8gRGV0ZWN0IGZyZWUgdmFyaWFibGVzIGBleHBvcnRzYFxuXHRcdFx0dmFyIGZyZWVFeHBvcnRzID0gZXhwb3J0cztcblxuXHRcdFx0Ly8gRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWBcblx0XHRcdHZhciBmcmVlTW9kdWxlID0gbW9kdWxlICYmIG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzICYmIG1vZHVsZTtcblxuXHRcdFx0Ly8gRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAsIGZyb20gTm9kZS5qcyBvciBCcm93c2VyaWZpZWQgY29kZSxcblx0XHRcdC8vIGFuZCB1c2UgaXQgYXMgYHJvb3RgXG5cdFx0XHR2YXIgZnJlZUdsb2JhbCA9IF90eXBlb2YoY29tbW9uanNHbG9iYWwpID09ICdvYmplY3QnICYmIGNvbW1vbmpzR2xvYmFsO1xuXHRcdFx0aWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSB7XG5cdFx0XHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHRcdFx0fVxuXG5cdFx0XHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHRcdFx0dmFyIHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGU7XG5cblx0XHRcdC8vIFRha2VuIGZyb20gaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlXG5cdFx0XHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdFx0XHR2YXIgb3V0cHV0ID0gW107XG5cdFx0XHRcdHZhciBjb3VudGVyID0gMDtcblx0XHRcdFx0dmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGg7XG5cdFx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdFx0dmFyIGV4dHJhO1xuXHRcdFx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0XHRpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0XHRcdGlmICgoZXh0cmEgJiAweEZDMDApID09IDB4REMwMCkge1xuXHRcdFx0XHRcdFx0XHQvLyBsb3cgc3Vycm9nYXRlXG5cdFx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvLyB1bm1hdGNoZWQgc3Vycm9nYXRlOyBvbmx5IGFwcGVuZCB0aGlzIGNvZGUgdW5pdCwgaW4gY2FzZSB0aGUgbmV4dFxuXHRcdFx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRjb3VudGVyLS07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVGFrZW4gZnJvbSBodHRwczovL210aHMuYmUvcHVueWNvZGVcblx0XHRcdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRcdFx0dmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblx0XHRcdFx0dmFyIGluZGV4ID0gLTE7XG5cdFx0XHRcdHZhciB2YWx1ZTtcblx0XHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0XHR3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuXHRcdFx0XHRcdHZhbHVlID0gYXJyYXlbaW5kZXhdO1xuXHRcdFx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHRcdFx0dmFsdWUgLT0gMHgxMDAwMDtcblx0XHRcdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBjaGVja1NjYWxhclZhbHVlKGNvZGVQb2ludCwgc3RyaWN0KSB7XG5cdFx0XHRcdGlmIChjb2RlUG9pbnQgPj0gMHhEODAwICYmIGNvZGVQb2ludCA8PSAweERGRkYpIHtcblx0XHRcdFx0XHRpZiAoc3RyaWN0KSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBFcnJvcignTG9uZSBzdXJyb2dhdGUgVSsnICsgY29kZVBvaW50LnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpICsgJyBpcyBub3QgYSBzY2FsYXIgdmFsdWUnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0XHRcdGZ1bmN0aW9uIGNyZWF0ZUJ5dGUoY29kZVBvaW50LCBzaGlmdCkge1xuXHRcdFx0XHRyZXR1cm4gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCA+PiBzaGlmdCAmIDB4M0YgfCAweDgwKTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gZW5jb2RlQ29kZVBvaW50KGNvZGVQb2ludCwgc3RyaWN0KSB7XG5cdFx0XHRcdGlmICgoY29kZVBvaW50ICYgMHhGRkZGRkY4MCkgPT0gMCkge1xuXHRcdFx0XHRcdC8vIDEtYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRcdHJldHVybiBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgc3ltYm9sID0gJyc7XG5cdFx0XHRcdGlmICgoY29kZVBvaW50ICYgMHhGRkZGRjgwMCkgPT0gMCkge1xuXHRcdFx0XHRcdC8vIDItYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRcdHN5bWJvbCA9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gNiAmIDB4MUYgfCAweEMwKTtcblx0XHRcdFx0fSBlbHNlIGlmICgoY29kZVBvaW50ICYgMHhGRkZGMDAwMCkgPT0gMCkge1xuXHRcdFx0XHRcdC8vIDMtYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRcdGlmICghY2hlY2tTY2FsYXJWYWx1ZShjb2RlUG9pbnQsIHN0cmljdCkpIHtcblx0XHRcdFx0XHRcdGNvZGVQb2ludCA9IDB4RkZGRDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c3ltYm9sID0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCA+PiAxMiAmIDB4MEYgfCAweEUwKTtcblx0XHRcdFx0XHRzeW1ib2wgKz0gY3JlYXRlQnl0ZShjb2RlUG9pbnQsIDYpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKChjb2RlUG9pbnQgJiAweEZGRTAwMDAwKSA9PSAwKSB7XG5cdFx0XHRcdFx0Ly8gNC1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdFx0c3ltYm9sID0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCA+PiAxOCAmIDB4MDcgfCAweEYwKTtcblx0XHRcdFx0XHRzeW1ib2wgKz0gY3JlYXRlQnl0ZShjb2RlUG9pbnQsIDEyKTtcblx0XHRcdFx0XHRzeW1ib2wgKz0gY3JlYXRlQnl0ZShjb2RlUG9pbnQsIDYpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN5bWJvbCArPSBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ICYgMHgzRiB8IDB4ODApO1xuXHRcdFx0XHRyZXR1cm4gc3ltYm9sO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiB1dGY4ZW5jb2RlKHN0cmluZywgb3B0cykge1xuXHRcdFx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblx0XHRcdFx0dmFyIHN0cmljdCA9IGZhbHNlICE9PSBvcHRzLnN0cmljdDtcblxuXHRcdFx0XHR2YXIgY29kZVBvaW50cyA9IHVjczJkZWNvZGUoc3RyaW5nKTtcblx0XHRcdFx0dmFyIGxlbmd0aCA9IGNvZGVQb2ludHMubGVuZ3RoO1xuXHRcdFx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHRcdFx0dmFyIGNvZGVQb2ludDtcblx0XHRcdFx0dmFyIGJ5dGVTdHJpbmcgPSAnJztcblx0XHRcdFx0d2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcblx0XHRcdFx0XHRjb2RlUG9pbnQgPSBjb2RlUG9pbnRzW2luZGV4XTtcblx0XHRcdFx0XHRieXRlU3RyaW5nICs9IGVuY29kZUNvZGVQb2ludChjb2RlUG9pbnQsIHN0cmljdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGJ5dGVTdHJpbmc7XG5cdFx0XHR9XG5cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHRmdW5jdGlvbiByZWFkQ29udGludWF0aW9uQnl0ZSgpIHtcblx0XHRcdFx0aWYgKGJ5dGVJbmRleCA+PSBieXRlQ291bnQpIHtcblx0XHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBieXRlIGluZGV4Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgY29udGludWF0aW9uQnl0ZSA9IGJ5dGVBcnJheVtieXRlSW5kZXhdICYgMHhGRjtcblx0XHRcdFx0Ynl0ZUluZGV4Kys7XG5cblx0XHRcdFx0aWYgKChjb250aW51YXRpb25CeXRlICYgMHhDMCkgPT0gMHg4MCkge1xuXHRcdFx0XHRcdHJldHVybiBjb250aW51YXRpb25CeXRlICYgMHgzRjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIHdlIGVuZCB1cCBoZXJlLCBpdOKAmXMgbm90IGEgY29udGludWF0aW9uIGJ5dGVcblx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgY29udGludWF0aW9uIGJ5dGUnKTtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gZGVjb2RlU3ltYm9sKHN0cmljdCkge1xuXHRcdFx0XHR2YXIgYnl0ZTE7XG5cdFx0XHRcdHZhciBieXRlMjtcblx0XHRcdFx0dmFyIGJ5dGUzO1xuXHRcdFx0XHR2YXIgYnl0ZTQ7XG5cdFx0XHRcdHZhciBjb2RlUG9pbnQ7XG5cblx0XHRcdFx0aWYgKGJ5dGVJbmRleCA+IGJ5dGVDb3VudCkge1xuXHRcdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGJ5dGUgaW5kZXgnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChieXRlSW5kZXggPT0gYnl0ZUNvdW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVhZCBmaXJzdCBieXRlXG5cdFx0XHRcdGJ5dGUxID0gYnl0ZUFycmF5W2J5dGVJbmRleF0gJiAweEZGO1xuXHRcdFx0XHRieXRlSW5kZXgrKztcblxuXHRcdFx0XHQvLyAxLWJ5dGUgc2VxdWVuY2UgKG5vIGNvbnRpbnVhdGlvbiBieXRlcylcblx0XHRcdFx0aWYgKChieXRlMSAmIDB4ODApID09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gYnl0ZTE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyAyLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0aWYgKChieXRlMSAmIDB4RTApID09IDB4QzApIHtcblx0XHRcdFx0XHRieXRlMiA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gKGJ5dGUxICYgMHgxRikgPDwgNiB8IGJ5dGUyO1xuXHRcdFx0XHRcdGlmIChjb2RlUG9pbnQgPj0gMHg4MCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNvZGVQb2ludDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgY29udGludWF0aW9uIGJ5dGUnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyAzLWJ5dGUgc2VxdWVuY2UgKG1heSBpbmNsdWRlIHVucGFpcmVkIHN1cnJvZ2F0ZXMpXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweEYwKSA9PSAweEUwKSB7XG5cdFx0XHRcdFx0Ynl0ZTIgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGJ5dGUzID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRjb2RlUG9pbnQgPSAoYnl0ZTEgJiAweDBGKSA8PCAxMiB8IGJ5dGUyIDw8IDYgfCBieXRlMztcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4MDgwMCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNoZWNrU2NhbGFyVmFsdWUoY29kZVBvaW50LCBzdHJpY3QpID8gY29kZVBvaW50IDogMHhGRkZEO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBjb250aW51YXRpb24gYnl0ZScpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIDQtYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRpZiAoKGJ5dGUxICYgMHhGOCkgPT0gMHhGMCkge1xuXHRcdFx0XHRcdGJ5dGUyID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRieXRlMyA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Ynl0ZTQgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGNvZGVQb2ludCA9IChieXRlMSAmIDB4MDcpIDw8IDB4MTIgfCBieXRlMiA8PCAweDBDIHwgYnl0ZTMgPDwgMHgwNiB8IGJ5dGU0O1xuXHRcdFx0XHRcdGlmIChjb2RlUG9pbnQgPj0gMHgwMTAwMDAgJiYgY29kZVBvaW50IDw9IDB4MTBGRkZGKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY29kZVBvaW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIFVURi04IGRldGVjdGVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBieXRlQXJyYXk7XG5cdFx0XHR2YXIgYnl0ZUNvdW50O1xuXHRcdFx0dmFyIGJ5dGVJbmRleDtcblx0XHRcdGZ1bmN0aW9uIHV0ZjhkZWNvZGUoYnl0ZVN0cmluZywgb3B0cykge1xuXHRcdFx0XHRvcHRzID0gb3B0cyB8fCB7fTtcblx0XHRcdFx0dmFyIHN0cmljdCA9IGZhbHNlICE9PSBvcHRzLnN0cmljdDtcblxuXHRcdFx0XHRieXRlQXJyYXkgPSB1Y3MyZGVjb2RlKGJ5dGVTdHJpbmcpO1xuXHRcdFx0XHRieXRlQ291bnQgPSBieXRlQXJyYXkubGVuZ3RoO1xuXHRcdFx0XHRieXRlSW5kZXggPSAwO1xuXHRcdFx0XHR2YXIgY29kZVBvaW50cyA9IFtdO1xuXHRcdFx0XHR2YXIgdG1wO1xuXHRcdFx0XHR3aGlsZSAoKHRtcCA9IGRlY29kZVN5bWJvbChzdHJpY3QpKSAhPT0gZmFsc2UpIHtcblx0XHRcdFx0XHRjb2RlUG9pbnRzLnB1c2godG1wKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdWNzMmVuY29kZShjb2RlUG9pbnRzKTtcblx0XHRcdH1cblxuXHRcdFx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0XHRcdHZhciB1dGY4ID0ge1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjEuMicsXG5cdFx0XHRcdCdlbmNvZGUnOiB1dGY4ZW5jb2RlLFxuXHRcdFx0XHQnZGVjb2RlJzogdXRmOGRlY29kZVxuXHRcdFx0fTtcblxuXHRcdFx0Ly8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zXG5cdFx0XHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdFx0XHRpZiAodHlwZW9mIHVuZGVmaW5lZCA9PSAnZnVuY3Rpb24nICYmIF90eXBlb2YodW5kZWZpbmVkLmFtZCkgPT0gJ29iamVjdCcgJiYgdW5kZWZpbmVkLmFtZCkge1xuXHRcdFx0XHR1bmRlZmluZWQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJldHVybiB1dGY4O1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgIWZyZWVFeHBvcnRzLm5vZGVUeXBlKSB7XG5cdFx0XHRcdGlmIChmcmVlTW9kdWxlKSB7XG5cdFx0XHRcdFx0Ly8gaW4gTm9kZS5qcyBvciBSaW5nb0pTIHYwLjguMCtcblx0XHRcdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSB1dGY4O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGluIE5hcndoYWwgb3IgUmluZ29KUyB2MC43LjAtXG5cdFx0XHRcdFx0dmFyIG9iamVjdCA9IHt9O1xuXHRcdFx0XHRcdHZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdC5oYXNPd25Qcm9wZXJ0eTtcblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gdXRmOCkge1xuXHRcdFx0XHRcdFx0aGFzT3duUHJvcGVydHkuY2FsbCh1dGY4LCBrZXkpICYmIChmcmVlRXhwb3J0c1trZXldID0gdXRmOFtrZXldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGluIFJoaW5vIG9yIGEgd2ViIGJyb3dzZXJcblx0XHRcdFx0cm9vdC51dGY4ID0gdXRmODtcblx0XHRcdH1cblx0XHR9KShjb21tb25qc0dsb2JhbCk7XG5cdH0pO1xuXG5cdHZhciB1dGY4JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogdXRmOCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHV0Zjhcblx0fSk7XG5cblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qXG5cdCAgICogYmFzZTY0LWFycmF5YnVmZmVyXG5cdCAgICogaHR0cHM6Ly9naXRodWIuY29tL25pa2xhc3ZoL2Jhc2U2NC1hcnJheWJ1ZmZlclxuXHQgICAqXG5cdCAgICogQ29weXJpZ2h0IChjKSAyMDEyIE5pa2xhcyB2b24gSGVydHplblxuXHQgICAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblx0ICAgKi9cblx0ICAoZnVuY3Rpb24gKCkge1xuXG5cdCAgICB2YXIgY2hhcnMgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky9cIjtcblxuXHQgICAgLy8gVXNlIGEgbG9va3VwIHRhYmxlIHRvIGZpbmQgdGhlIGluZGV4LlxuXHQgICAgdmFyIGxvb2t1cCA9IG5ldyBVaW50OEFycmF5KDI1Nik7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGxvb2t1cFtjaGFycy5jaGFyQ29kZUF0KGkpXSA9IGk7XG5cdCAgICB9XG5cblx0ICAgIGV4cG9ydHMuZW5jb2RlID0gZnVuY3Rpb24gKGFycmF5YnVmZmVyKSB7XG5cdCAgICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKSxcblx0ICAgICAgICAgIGksXG5cdCAgICAgICAgICBsZW4gPSBieXRlcy5sZW5ndGgsXG5cdCAgICAgICAgICBiYXNlNjQgPSBcIlwiO1xuXG5cdCAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gMykge1xuXHQgICAgICAgIGJhc2U2NCArPSBjaGFyc1tieXRlc1tpXSA+PiAyXTtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbKGJ5dGVzW2ldICYgMykgPDwgNCB8IGJ5dGVzW2kgKyAxXSA+PiA0XTtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbKGJ5dGVzW2kgKyAxXSAmIDE1KSA8PCAyIHwgYnl0ZXNbaSArIDJdID4+IDZdO1xuXHQgICAgICAgIGJhc2U2NCArPSBjaGFyc1tieXRlc1tpICsgMl0gJiA2M107XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobGVuICUgMyA9PT0gMikge1xuXHQgICAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDEpICsgXCI9XCI7XG5cdCAgICAgIH0gZWxzZSBpZiAobGVuICUgMyA9PT0gMSkge1xuXHQgICAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDIpICsgXCI9PVwiO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGJhc2U2NDtcblx0ICAgIH07XG5cblx0ICAgIGV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24gKGJhc2U2NCkge1xuXHQgICAgICB2YXIgYnVmZmVyTGVuZ3RoID0gYmFzZTY0Lmxlbmd0aCAqIDAuNzUsXG5cdCAgICAgICAgICBsZW4gPSBiYXNlNjQubGVuZ3RoLFxuXHQgICAgICAgICAgaSxcblx0ICAgICAgICAgIHAgPSAwLFxuXHQgICAgICAgICAgZW5jb2RlZDEsXG5cdCAgICAgICAgICBlbmNvZGVkMixcblx0ICAgICAgICAgIGVuY29kZWQzLFxuXHQgICAgICAgICAgZW5jb2RlZDQ7XG5cblx0ICAgICAgaWYgKGJhc2U2NFtiYXNlNjQubGVuZ3RoIC0gMV0gPT09IFwiPVwiKSB7XG5cdCAgICAgICAgYnVmZmVyTGVuZ3RoLS07XG5cdCAgICAgICAgaWYgKGJhc2U2NFtiYXNlNjQubGVuZ3RoIC0gMl0gPT09IFwiPVwiKSB7XG5cdCAgICAgICAgICBidWZmZXJMZW5ndGgtLTtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICB2YXIgYXJyYXlidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyTGVuZ3RoKSxcblx0ICAgICAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlidWZmZXIpO1xuXG5cdCAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuXHQgICAgICAgIGVuY29kZWQxID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkpXTtcblx0ICAgICAgICBlbmNvZGVkMiA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpICsgMSldO1xuXHQgICAgICAgIGVuY29kZWQzID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAyKV07XG5cdCAgICAgICAgZW5jb2RlZDQgPSBsb29rdXBbYmFzZTY0LmNoYXJDb2RlQXQoaSArIDMpXTtcblxuXHQgICAgICAgIGJ5dGVzW3ArK10gPSBlbmNvZGVkMSA8PCAyIHwgZW5jb2RlZDIgPj4gNDtcblx0ICAgICAgICBieXRlc1twKytdID0gKGVuY29kZWQyICYgMTUpIDw8IDQgfCBlbmNvZGVkMyA+PiAyO1xuXHQgICAgICAgIGJ5dGVzW3ArK10gPSAoZW5jb2RlZDMgJiAzKSA8PCA2IHwgZW5jb2RlZDQgJiA2Mztcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBhcnJheWJ1ZmZlcjtcblx0ICAgIH07XG5cdCAgfSkoKTtcblx0fSk7XG5cdHZhciBiYXNlNjRBcnJheWJ1ZmZlcl8xID0gYmFzZTY0QXJyYXlidWZmZXIuZW5jb2RlO1xuXHR2YXIgYmFzZTY0QXJyYXlidWZmZXJfMiA9IGJhc2U2NEFycmF5YnVmZmVyLmRlY29kZTtcblxuXHR2YXIgYmFzZTY0QXJyYXlidWZmZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBiYXNlNjRBcnJheWJ1ZmZlcixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJhc2U2NEFycmF5YnVmZmVyLFxuXHRcdGVuY29kZTogYmFzZTY0QXJyYXlidWZmZXJfMSxcblx0XHRkZWNvZGU6IGJhc2U2NEFycmF5YnVmZmVyXzJcblx0fSk7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIGJsb2IgYnVpbGRlciBldmVuIHdoZW4gdmVuZG9yIHByZWZpeGVzIGV4aXN0XG5cdCAqL1xuXG5cdHZhciBCbG9iQnVpbGRlciA9IGNvbW1vbmpzR2xvYmFsLkJsb2JCdWlsZGVyIHx8IGNvbW1vbmpzR2xvYmFsLldlYktpdEJsb2JCdWlsZGVyIHx8IGNvbW1vbmpzR2xvYmFsLk1TQmxvYkJ1aWxkZXIgfHwgY29tbW9uanNHbG9iYWwuTW96QmxvYkJ1aWxkZXI7XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIEJsb2IgY29uc3RydWN0b3IgaXMgc3VwcG9ydGVkXG5cdCAqL1xuXG5cdHZhciBibG9iU3VwcG9ydGVkID0gZnVuY3Rpb24gKCkge1xuXHQgIHRyeSB7XG5cdCAgICB2YXIgYSA9IG5ldyBCbG9iKFsnaGknXSk7XG5cdCAgICByZXR1cm4gYS5zaXplID09PSAyO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHJldHVybiBmYWxzZTtcblx0ICB9XG5cdH0oKTtcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgQmxvYiBjb25zdHJ1Y3RvciBzdXBwb3J0cyBBcnJheUJ1ZmZlclZpZXdzXG5cdCAqIEZhaWxzIGluIFNhZmFyaSA2LCBzbyB3ZSBuZWVkIHRvIG1hcCB0byBBcnJheUJ1ZmZlcnMgdGhlcmUuXG5cdCAqL1xuXG5cdHZhciBibG9iU3VwcG9ydHNBcnJheUJ1ZmZlclZpZXcgPSBibG9iU3VwcG9ydGVkICYmIGZ1bmN0aW9uICgpIHtcblx0ICB0cnkge1xuXHQgICAgdmFyIGIgPSBuZXcgQmxvYihbbmV3IFVpbnQ4QXJyYXkoWzEsIDJdKV0pO1xuXHQgICAgcmV0dXJuIGIuc2l6ZSA9PT0gMjtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXHR9KCk7XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIEJsb2JCdWlsZGVyIGlzIHN1cHBvcnRlZFxuXHQgKi9cblxuXHR2YXIgYmxvYkJ1aWxkZXJTdXBwb3J0ZWQgPSBCbG9iQnVpbGRlciAmJiBCbG9iQnVpbGRlci5wcm90b3R5cGUuYXBwZW5kICYmIEJsb2JCdWlsZGVyLnByb3RvdHlwZS5nZXRCbG9iO1xuXG5cdC8qKlxuXHQgKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCBtYXBzIEFycmF5QnVmZmVyVmlld3MgdG8gQXJyYXlCdWZmZXJzXG5cdCAqIFVzZWQgYnkgQmxvYkJ1aWxkZXIgY29uc3RydWN0b3IgYW5kIG9sZCBicm93c2VycyB0aGF0IGRpZG4ndFxuXHQgKiBzdXBwb3J0IGl0IGluIHRoZSBCbG9iIGNvbnN0cnVjdG9yLlxuXHQgKi9cblxuXHRmdW5jdGlvbiBtYXBBcnJheUJ1ZmZlclZpZXdzKGFyeSkge1xuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJ5Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICB2YXIgY2h1bmsgPSBhcnlbaV07XG5cdCAgICBpZiAoY2h1bmsuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcblx0ICAgICAgdmFyIGJ1ZiA9IGNodW5rLmJ1ZmZlcjtcblxuXHQgICAgICAvLyBpZiB0aGlzIGlzIGEgc3ViYXJyYXksIG1ha2UgYSBjb3B5IHNvIHdlIG9ubHlcblx0ICAgICAgLy8gaW5jbHVkZSB0aGUgc3ViYXJyYXkgcmVnaW9uIGZyb20gdGhlIHVuZGVybHlpbmcgYnVmZmVyXG5cdCAgICAgIGlmIChjaHVuay5ieXRlTGVuZ3RoICE9PSBidWYuYnl0ZUxlbmd0aCkge1xuXHQgICAgICAgIHZhciBjb3B5ID0gbmV3IFVpbnQ4QXJyYXkoY2h1bmsuYnl0ZUxlbmd0aCk7XG5cdCAgICAgICAgY29weS5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmLCBjaHVuay5ieXRlT2Zmc2V0LCBjaHVuay5ieXRlTGVuZ3RoKSk7XG5cdCAgICAgICAgYnVmID0gY29weS5idWZmZXI7XG5cdCAgICAgIH1cblxuXHQgICAgICBhcnlbaV0gPSBidWY7XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gQmxvYkJ1aWxkZXJDb25zdHJ1Y3RvcihhcnksIG9wdGlvbnMpIHtcblx0ICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuXHQgIHZhciBiYiA9IG5ldyBCbG9iQnVpbGRlcigpO1xuXHQgIG1hcEFycmF5QnVmZmVyVmlld3MoYXJ5KTtcblxuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJ5Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICBiYi5hcHBlbmQoYXJ5W2ldKTtcblx0ICB9XG5cblx0ICByZXR1cm4gb3B0aW9ucy50eXBlID8gYmIuZ2V0QmxvYihvcHRpb25zLnR5cGUpIDogYmIuZ2V0QmxvYigpO1xuXHR9XG5cdGZ1bmN0aW9uIEJsb2JDb25zdHJ1Y3RvcihhcnksIG9wdGlvbnMpIHtcblx0ICBtYXBBcnJheUJ1ZmZlclZpZXdzKGFyeSk7XG5cdCAgcmV0dXJuIG5ldyBCbG9iKGFyeSwgb3B0aW9ucyB8fCB7fSk7XG5cdH1cblx0dmFyIGJsb2IgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKGJsb2JTdXBwb3J0ZWQpIHtcblx0ICAgIHJldHVybiBibG9iU3VwcG9ydHNBcnJheUJ1ZmZlclZpZXcgPyBjb21tb25qc0dsb2JhbC5CbG9iIDogQmxvYkNvbnN0cnVjdG9yO1xuXHQgIH0gZWxzZSBpZiAoYmxvYkJ1aWxkZXJTdXBwb3J0ZWQpIHtcblx0ICAgIHJldHVybiBCbG9iQnVpbGRlckNvbnN0cnVjdG9yO1xuXHQgIH0gZWxzZSB7XG5cdCAgICByZXR1cm4gdW5kZWZpbmVkO1xuXHQgIH1cblx0fSgpO1xuXG5cdHZhciBibG9iJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmxvYixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJsb2Jcblx0fSk7XG5cblx0dmFyIGtleXMkMiA9ICgga2V5cyQxICYmIGtleXMgKSB8fCBrZXlzJDE7XG5cblx0dmFyIGhhc0JpbmFyeSQxID0gKCBoYXNCaW5hcnkyJDEgJiYgaGFzQmluYXJ5MiApIHx8IGhhc0JpbmFyeTIkMTtcblxuXHR2YXIgc2xpY2VCdWZmZXIgPSAoIGFycmF5YnVmZmVyX3NsaWNlJDEgJiYgYXJyYXlidWZmZXJfc2xpY2UgKSB8fCBhcnJheWJ1ZmZlcl9zbGljZSQxO1xuXG5cdHZhciBhZnRlciQyID0gKCBhZnRlciQxICYmIGFmdGVyXzEgKSB8fCBhZnRlciQxO1xuXG5cdHZhciB1dGY4JDIgPSAoIHV0ZjgkMSAmJiB1dGY4ICkgfHwgdXRmOCQxO1xuXG5cdHZhciByZXF1aXJlJCQwJDMgPSAoIGJhc2U2NEFycmF5YnVmZmVyJDEgJiYgYmFzZTY0QXJyYXlidWZmZXIgKSB8fCBiYXNlNjRBcnJheWJ1ZmZlciQxO1xuXG5cdHZhciBCbG9iJDEgPSAoIGJsb2IkMSAmJiBibG9iICkgfHwgYmxvYiQxO1xuXG5cdHZhciBicm93c2VyJDIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBiYXNlNjRlbmNvZGVyO1xuXHQgIGlmIChjb21tb25qc0dsb2JhbCAmJiBjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlcikge1xuXHQgICAgYmFzZTY0ZW5jb2RlciA9IHJlcXVpcmUkJDAkMztcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBDaGVjayBpZiB3ZSBhcmUgcnVubmluZyBhbiBhbmRyb2lkIGJyb3dzZXIuIFRoYXQgcmVxdWlyZXMgdXMgdG8gdXNlXG5cdCAgICogQXJyYXlCdWZmZXIgd2l0aCBwb2xsaW5nIHRyYW5zcG9ydHMuLi5cblx0ICAgKlxuXHQgICAqIGh0dHA6Ly9naGluZGEubmV0L2pwZWctYmxvYi1hamF4LWFuZHJvaWQvXG5cdCAgICovXG5cblx0ICB2YXIgaXNBbmRyb2lkID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgL0FuZHJvaWQvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cdCAgLyoqXG5cdCAgICogQ2hlY2sgaWYgd2UgYXJlIHJ1bm5pbmcgaW4gUGhhbnRvbUpTLlxuXHQgICAqIFVwbG9hZGluZyBhIEJsb2Igd2l0aCBQaGFudG9tSlMgZG9lcyBub3Qgd29yayBjb3JyZWN0bHksIGFzIHJlcG9ydGVkIGhlcmU6XG5cdCAgICogaHR0cHM6Ly9naXRodWIuY29tL2FyaXlhL3BoYW50b21qcy9pc3N1ZXMvMTEzOTVcblx0ICAgKiBAdHlwZSBib29sZWFuXG5cdCAgICovXG5cdCAgdmFyIGlzUGhhbnRvbUpTID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgL1BoYW50b21KUy9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cblx0ICAvKipcblx0ICAgKiBXaGVuIHRydWUsIGF2b2lkcyB1c2luZyBCbG9icyB0byBlbmNvZGUgcGF5bG9hZHMuXG5cdCAgICogQHR5cGUgYm9vbGVhblxuXHQgICAqL1xuXHQgIHZhciBkb250U2VuZEJsb2JzID0gaXNBbmRyb2lkIHx8IGlzUGhhbnRvbUpTO1xuXG5cdCAgLyoqXG5cdCAgICogQ3VycmVudCBwcm90b2NvbCB2ZXJzaW9uLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5wcm90b2NvbCA9IDM7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZXMuXG5cdCAgICovXG5cblx0ICB2YXIgcGFja2V0cyA9IGV4cG9ydHMucGFja2V0cyA9IHtcblx0ICAgIG9wZW46IDAgLy8gbm9uLXdzXG5cdCAgICAsIGNsb3NlOiAxIC8vIG5vbi13c1xuXHQgICAgLCBwaW5nOiAyLFxuXHQgICAgcG9uZzogMyxcblx0ICAgIG1lc3NhZ2U6IDQsXG5cdCAgICB1cGdyYWRlOiA1LFxuXHQgICAgbm9vcDogNlxuXHQgIH07XG5cblx0ICB2YXIgcGFja2V0c2xpc3QgPSBrZXlzJDIocGFja2V0cyk7XG5cblx0ICAvKipcblx0ICAgKiBQcmVtYWRlIGVycm9yIHBhY2tldC5cblx0ICAgKi9cblxuXHQgIHZhciBlcnIgPSB7IHR5cGU6ICdlcnJvcicsIGRhdGE6ICdwYXJzZXIgZXJyb3InIH07XG5cblx0ICAvKipcblx0ICAgKiBDcmVhdGUgYSBibG9iIGFwaSBldmVuIGZvciBibG9iIGJ1aWxkZXIgd2hlbiB2ZW5kb3IgcHJlZml4ZXMgZXhpc3Rcblx0ICAgKi9cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXMgYSBwYWNrZXQuXG5cdCAgICpcblx0ICAgKiAgICAgPHBhY2tldCB0eXBlIGlkPiBbIDxkYXRhPiBdXG5cdCAgICpcblx0ICAgKiBFeGFtcGxlOlxuXHQgICAqXG5cdCAgICogICAgIDVoZWxsbyB3b3JsZFxuXHQgICAqICAgICAzXG5cdCAgICogICAgIDRcblx0ICAgKlxuXHQgICAqIEJpbmFyeSBpcyBlbmNvZGVkIGluIGFuIGlkZW50aWNhbCBwcmluY2lwbGVcblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVQYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgdXRmOGVuY29kZSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICh0eXBlb2Ygc3VwcG9ydHNCaW5hcnkgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSBzdXBwb3J0c0JpbmFyeTtcblx0ICAgICAgc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHR5cGVvZiB1dGY4ZW5jb2RlID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gdXRmOGVuY29kZTtcblx0ICAgICAgdXRmOGVuY29kZSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHZhciBkYXRhID0gcGFja2V0LmRhdGEgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IHBhY2tldC5kYXRhLmJ1ZmZlciB8fCBwYWNrZXQuZGF0YTtcblxuXHQgICAgaWYgKGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyICYmIGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQXJyYXlCdWZmZXIocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spO1xuXHQgICAgfSBlbHNlIGlmIChCbG9iJDEgJiYgZGF0YSBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkJsb2IpIHtcblx0ICAgICAgcmV0dXJuIGVuY29kZUJsb2IocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICAvLyBtaWdodCBiZSBhbiBvYmplY3Qgd2l0aCB7IGJhc2U2NDogdHJ1ZSwgZGF0YTogZGF0YUFzQmFzZTY0U3RyaW5nIH1cblx0ICAgIGlmIChkYXRhICYmIGRhdGEuYmFzZTY0KSB7XG5cdCAgICAgIHJldHVybiBlbmNvZGVCYXNlNjRPYmplY3QocGFja2V0LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIC8vIFNlbmRpbmcgZGF0YSBhcyBhIHV0Zi04IHN0cmluZ1xuXHQgICAgdmFyIGVuY29kZWQgPSBwYWNrZXRzW3BhY2tldC50eXBlXTtcblxuXHQgICAgLy8gZGF0YSBmcmFnbWVudCBpcyBvcHRpb25hbFxuXHQgICAgaWYgKHVuZGVmaW5lZCAhPT0gcGFja2V0LmRhdGEpIHtcblx0ICAgICAgZW5jb2RlZCArPSB1dGY4ZW5jb2RlID8gdXRmOCQyLmVuY29kZShTdHJpbmcocGFja2V0LmRhdGEpLCB7IHN0cmljdDogZmFsc2UgfSkgOiBTdHJpbmcocGFja2V0LmRhdGEpO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gY2FsbGJhY2soJycgKyBlbmNvZGVkKTtcblx0ICB9O1xuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQmFzZTY0T2JqZWN0KHBhY2tldCwgY2FsbGJhY2spIHtcblx0ICAgIC8vIHBhY2tldCBkYXRhIGlzIGFuIG9iamVjdCB7IGJhc2U2NDogdHJ1ZSwgZGF0YTogZGF0YUFzQmFzZTY0U3RyaW5nIH1cblx0ICAgIHZhciBtZXNzYWdlID0gJ2InICsgZXhwb3J0cy5wYWNrZXRzW3BhY2tldC50eXBlXSArIHBhY2tldC5kYXRhLmRhdGE7XG5cdCAgICByZXR1cm4gY2FsbGJhY2sobWVzc2FnZSk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIHBhY2tldCBoZWxwZXJzIGZvciBiaW5hcnkgdHlwZXNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUFycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZUJhc2U2NFBhY2tldChwYWNrZXQsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGRhdGEgPSBwYWNrZXQuZGF0YTtcblx0ICAgIHZhciBjb250ZW50QXJyYXkgPSBuZXcgVWludDhBcnJheShkYXRhKTtcblx0ICAgIHZhciByZXN1bHRCdWZmZXIgPSBuZXcgVWludDhBcnJheSgxICsgZGF0YS5ieXRlTGVuZ3RoKTtcblxuXHQgICAgcmVzdWx0QnVmZmVyWzBdID0gcGFja2V0c1twYWNrZXQudHlwZV07XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRlbnRBcnJheS5sZW5ndGg7IGkrKykge1xuXHQgICAgICByZXN1bHRCdWZmZXJbaSArIDFdID0gY29udGVudEFycmF5W2ldO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gY2FsbGJhY2socmVzdWx0QnVmZmVyLmJ1ZmZlcik7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQmxvYkFzQXJyYXlCdWZmZXIocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICghc3VwcG9ydHNCaW5hcnkpIHtcblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlQmFzZTY0UGFja2V0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZnIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXHQgICAgZnIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICBwYWNrZXQuZGF0YSA9IGZyLnJlc3VsdDtcblx0ICAgICAgZXhwb3J0cy5lbmNvZGVQYWNrZXQocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgdHJ1ZSwgY2FsbGJhY2spO1xuXHQgICAgfTtcblx0ICAgIHJldHVybiBmci5yZWFkQXNBcnJheUJ1ZmZlcihwYWNrZXQuZGF0YSk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gZW5jb2RlQmxvYihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjaykge1xuXHQgICAgaWYgKCFzdXBwb3J0c0JpbmFyeSkge1xuXHQgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQocGFja2V0LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIGlmIChkb250U2VuZEJsb2JzKSB7XG5cdCAgICAgIHJldHVybiBlbmNvZGVCbG9iQXNBcnJheUJ1ZmZlcihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBsZW5ndGggPSBuZXcgVWludDhBcnJheSgxKTtcblx0ICAgIGxlbmd0aFswXSA9IHBhY2tldHNbcGFja2V0LnR5cGVdO1xuXHQgICAgdmFyIGJsb2IgPSBuZXcgQmxvYiQxKFtsZW5ndGguYnVmZmVyLCBwYWNrZXQuZGF0YV0pO1xuXG5cdCAgICByZXR1cm4gY2FsbGJhY2soYmxvYik7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlcyBhIHBhY2tldCB3aXRoIGJpbmFyeSBkYXRhIGluIGEgYmFzZTY0IHN0cmluZ1xuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldCwgaGFzIGB0eXBlYCBhbmQgYGRhdGFgXG5cdCAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBtZXNzYWdlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZUJhc2U2NFBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQsIGNhbGxiYWNrKSB7XG5cdCAgICB2YXIgbWVzc2FnZSA9ICdiJyArIGV4cG9ydHMucGFja2V0c1twYWNrZXQudHlwZV07XG5cdCAgICBpZiAoQmxvYiQxICYmIHBhY2tldC5kYXRhIGluc3RhbmNlb2YgY29tbW9uanNHbG9iYWwuQmxvYikge1xuXHQgICAgICB2YXIgZnIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXHQgICAgICBmci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgdmFyIGI2NCA9IGZyLnJlc3VsdC5zcGxpdCgnLCcpWzFdO1xuXHQgICAgICAgIGNhbGxiYWNrKG1lc3NhZ2UgKyBiNjQpO1xuXHQgICAgICB9O1xuXHQgICAgICByZXR1cm4gZnIucmVhZEFzRGF0YVVSTChwYWNrZXQuZGF0YSk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBiNjRkYXRhO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgYjY0ZGF0YSA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkocGFja2V0LmRhdGEpKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgLy8gaVBob25lIFNhZmFyaSBkb2Vzbid0IGxldCB5b3UgYXBwbHkgd2l0aCB0eXBlZCBhcnJheXNcblx0ICAgICAgdmFyIHR5cGVkID0gbmV3IFVpbnQ4QXJyYXkocGFja2V0LmRhdGEpO1xuXHQgICAgICB2YXIgYmFzaWMgPSBuZXcgQXJyYXkodHlwZWQubGVuZ3RoKTtcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlZC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIGJhc2ljW2ldID0gdHlwZWRbaV07XG5cdCAgICAgIH1cblx0ICAgICAgYjY0ZGF0YSA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYmFzaWMpO1xuXHQgICAgfVxuXHQgICAgbWVzc2FnZSArPSBjb21tb25qc0dsb2JhbC5idG9hKGI2NGRhdGEpO1xuXHQgICAgcmV0dXJuIGNhbGxiYWNrKG1lc3NhZ2UpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVzIGEgcGFja2V0LiBDaGFuZ2VzIGZvcm1hdCB0byBCbG9iIGlmIHJlcXVlc3RlZC5cblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBgdHlwZWAgYW5kIGBkYXRhYCAoaWYgYW55KVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVQYWNrZXQgPSBmdW5jdGlvbiAoZGF0YSwgYmluYXJ5VHlwZSwgdXRmOGRlY29kZSkge1xuXHQgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICByZXR1cm4gZXJyO1xuXHQgICAgfVxuXHQgICAgLy8gU3RyaW5nIGRhdGFcblx0ICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgaWYgKGRhdGEuY2hhckF0KDApID09PSAnYicpIHtcblx0ICAgICAgICByZXR1cm4gZXhwb3J0cy5kZWNvZGVCYXNlNjRQYWNrZXQoZGF0YS5zdWJzdHIoMSksIGJpbmFyeVR5cGUpO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKHV0ZjhkZWNvZGUpIHtcblx0ICAgICAgICBkYXRhID0gdHJ5RGVjb2RlKGRhdGEpO1xuXHQgICAgICAgIGlmIChkYXRhID09PSBmYWxzZSkge1xuXHQgICAgICAgICAgcmV0dXJuIGVycjtcblx0ICAgICAgICB9XG5cdCAgICAgIH1cblx0ICAgICAgdmFyIHR5cGUgPSBkYXRhLmNoYXJBdCgwKTtcblxuXHQgICAgICBpZiAoTnVtYmVyKHR5cGUpICE9IHR5cGUgfHwgIXBhY2tldHNsaXN0W3R5cGVdKSB7XG5cdCAgICAgICAgcmV0dXJuIGVycjtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChkYXRhLmxlbmd0aCA+IDEpIHtcblx0ICAgICAgICByZXR1cm4geyB0eXBlOiBwYWNrZXRzbGlzdFt0eXBlXSwgZGF0YTogZGF0YS5zdWJzdHJpbmcoMSkgfTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4geyB0eXBlOiBwYWNrZXRzbGlzdFt0eXBlXSB9O1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHZhciBhc0FycmF5ID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG5cdCAgICB2YXIgdHlwZSA9IGFzQXJyYXlbMF07XG5cdCAgICB2YXIgcmVzdCA9IHNsaWNlQnVmZmVyKGRhdGEsIDEpO1xuXHQgICAgaWYgKEJsb2IkMSAmJiBiaW5hcnlUeXBlID09PSAnYmxvYicpIHtcblx0ICAgICAgcmVzdCA9IG5ldyBCbG9iJDEoW3Jlc3RdKTtcblx0ICAgIH1cblx0ICAgIHJldHVybiB7IHR5cGU6IHBhY2tldHNsaXN0W3R5cGVdLCBkYXRhOiByZXN0IH07XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIHRyeURlY29kZShkYXRhKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICBkYXRhID0gdXRmOCQyLmRlY29kZShkYXRhLCB7IHN0cmljdDogZmFsc2UgfSk7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBkYXRhO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIERlY29kZXMgYSBwYWNrZXQgZW5jb2RlZCBpbiBhIGJhc2U2NCBzdHJpbmdcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBtZXNzYWdlXG5cdCAgICogQHJldHVybiB7T2JqZWN0fSB3aXRoIGB0eXBlYCBhbmQgYGRhdGFgIChpZiBhbnkpXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmRlY29kZUJhc2U2NFBhY2tldCA9IGZ1bmN0aW9uIChtc2csIGJpbmFyeVR5cGUpIHtcblx0ICAgIHZhciB0eXBlID0gcGFja2V0c2xpc3RbbXNnLmNoYXJBdCgwKV07XG5cdCAgICBpZiAoIWJhc2U2NGVuY29kZXIpIHtcblx0ICAgICAgcmV0dXJuIHsgdHlwZTogdHlwZSwgZGF0YTogeyBiYXNlNjQ6IHRydWUsIGRhdGE6IG1zZy5zdWJzdHIoMSkgfSB9O1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZGF0YSA9IGJhc2U2NGVuY29kZXIuZGVjb2RlKG1zZy5zdWJzdHIoMSkpO1xuXG5cdCAgICBpZiAoYmluYXJ5VHlwZSA9PT0gJ2Jsb2InICYmIEJsb2IkMSkge1xuXHQgICAgICBkYXRhID0gbmV3IEJsb2IkMShbZGF0YV0pO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4geyB0eXBlOiB0eXBlLCBkYXRhOiBkYXRhIH07XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXMgbXVsdGlwbGUgbWVzc2FnZXMgKHBheWxvYWQpLlxuXHQgICAqXG5cdCAgICogICAgIDxsZW5ndGg+OmRhdGFcblx0ICAgKlxuXHQgICAqIEV4YW1wbGU6XG5cdCAgICpcblx0ICAgKiAgICAgMTE6aGVsbG8gd29ybGQyOmhpXG5cdCAgICpcblx0ICAgKiBJZiBhbnkgY29udGVudHMgYXJlIGJpbmFyeSwgdGhleSB3aWxsIGJlIGVuY29kZWQgYXMgYmFzZTY0IHN0cmluZ3MuIEJhc2U2NFxuXHQgICAqIGVuY29kZWQgc3RyaW5ncyBhcmUgbWFya2VkIHdpdGggYSBiIGJlZm9yZSB0aGUgbGVuZ3RoIHNwZWNpZmllclxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtBcnJheX0gcGFja2V0c1xuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVQYXlsb2FkID0gZnVuY3Rpb24gKHBhY2tldHMsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjaykge1xuXHQgICAgaWYgKHR5cGVvZiBzdXBwb3J0c0JpbmFyeSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IHN1cHBvcnRzQmluYXJ5O1xuXHQgICAgICBzdXBwb3J0c0JpbmFyeSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHZhciBpc0JpbmFyeSA9IGhhc0JpbmFyeSQxKHBhY2tldHMpO1xuXG5cdCAgICBpZiAoc3VwcG9ydHNCaW5hcnkgJiYgaXNCaW5hcnkpIHtcblx0ICAgICAgaWYgKEJsb2IkMSAmJiAhZG9udFNlbmRCbG9icykge1xuXHQgICAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZVBheWxvYWRBc0Jsb2IocGFja2V0cywgY2FsbGJhY2spO1xuXHQgICAgICB9XG5cblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXIocGFja2V0cywgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoIXBhY2tldHMubGVuZ3RoKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjaygnMDonKTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gc2V0TGVuZ3RoSGVhZGVyKG1lc3NhZ2UpIHtcblx0ICAgICAgcmV0dXJuIG1lc3NhZ2UubGVuZ3RoICsgJzonICsgbWVzc2FnZTtcblx0ICAgIH1cblxuXHQgICAgZnVuY3Rpb24gZW5jb2RlT25lKHBhY2tldCwgZG9uZUNhbGxiYWNrKSB7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgIWlzQmluYXJ5ID8gZmFsc2UgOiBzdXBwb3J0c0JpbmFyeSwgZmFsc2UsIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG5cdCAgICAgICAgZG9uZUNhbGxiYWNrKG51bGwsIHNldExlbmd0aEhlYWRlcihtZXNzYWdlKSk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBtYXAocGFja2V0cywgZW5jb2RlT25lLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhyZXN1bHRzLmpvaW4oJycpKTtcblx0ICAgIH0pO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBBc3luYyBhcnJheSBtYXAgdXNpbmcgYWZ0ZXJcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIG1hcChhcnksIGVhY2gsIGRvbmUpIHtcblx0ICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkoYXJ5Lmxlbmd0aCk7XG5cdCAgICB2YXIgbmV4dCA9IGFmdGVyJDIoYXJ5Lmxlbmd0aCwgZG9uZSk7XG5cblx0ICAgIHZhciBlYWNoV2l0aEluZGV4ID0gZnVuY3Rpb24gZWFjaFdpdGhJbmRleChpLCBlbCwgY2IpIHtcblx0ICAgICAgZWFjaChlbCwgZnVuY3Rpb24gKGVycm9yLCBtc2cpIHtcblx0ICAgICAgICByZXN1bHRbaV0gPSBtc2c7XG5cdCAgICAgICAgY2IoZXJyb3IsIHJlc3VsdCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfTtcblxuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnkubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgZWFjaFdpdGhJbmRleChpLCBhcnlbaV0sIG5leHQpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qXG5cdCAgICogRGVjb2RlcyBkYXRhIHdoZW4gYSBwYXlsb2FkIGlzIG1heWJlIGV4cGVjdGVkLiBQb3NzaWJsZSBiaW5hcnkgY29udGVudHMgYXJlXG5cdCAgICogZGVjb2RlZCBmcm9tIHRoZWlyIGJhc2U2NCByZXByZXNlbnRhdGlvblxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGRhdGEsIGNhbGxiYWNrIG1ldGhvZFxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmRlY29kZVBheWxvYWQgPSBmdW5jdGlvbiAoZGF0YSwgYmluYXJ5VHlwZSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycpIHtcblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZGVjb2RlUGF5bG9hZEFzQmluYXJ5KGRhdGEsIGJpbmFyeVR5cGUsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHR5cGVvZiBiaW5hcnlUeXBlID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gYmluYXJ5VHlwZTtcblx0ICAgICAgYmluYXJ5VHlwZSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHZhciBwYWNrZXQ7XG5cdCAgICBpZiAoZGF0YSA9PT0gJycpIHtcblx0ICAgICAgLy8gcGFyc2VyIGVycm9yIC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGxlbmd0aCA9ICcnLFxuXHQgICAgICAgIG4sXG5cdCAgICAgICAgbXNnO1xuXG5cdCAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICAgIHZhciBjaHIgPSBkYXRhLmNoYXJBdChpKTtcblxuXHQgICAgICBpZiAoY2hyICE9PSAnOicpIHtcblx0ICAgICAgICBsZW5ndGggKz0gY2hyO1xuXHQgICAgICAgIGNvbnRpbnVlO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGxlbmd0aCA9PT0gJycgfHwgbGVuZ3RoICE9IChuID0gTnVtYmVyKGxlbmd0aCkpKSB7XG5cdCAgICAgICAgLy8gcGFyc2VyIGVycm9yIC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgICB9XG5cblx0ICAgICAgbXNnID0gZGF0YS5zdWJzdHIoaSArIDEsIG4pO1xuXG5cdCAgICAgIGlmIChsZW5ndGggIT0gbXNnLmxlbmd0aCkge1xuXHQgICAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChtc2cubGVuZ3RoKSB7XG5cdCAgICAgICAgcGFja2V0ID0gZXhwb3J0cy5kZWNvZGVQYWNrZXQobXNnLCBiaW5hcnlUeXBlLCBmYWxzZSk7XG5cblx0ICAgICAgICBpZiAoZXJyLnR5cGUgPT09IHBhY2tldC50eXBlICYmIGVyci5kYXRhID09PSBwYWNrZXQuZGF0YSkge1xuXHQgICAgICAgICAgLy8gcGFyc2VyIGVycm9yIGluIGluZGl2aWR1YWwgcGFja2V0IC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdmFyIHJldCA9IGNhbGxiYWNrKHBhY2tldCwgaSArIG4sIGwpO1xuXHQgICAgICAgIGlmIChmYWxzZSA9PT0gcmV0KSByZXR1cm47XG5cdCAgICAgIH1cblxuXHQgICAgICAvLyBhZHZhbmNlIGN1cnNvclxuXHQgICAgICBpICs9IG47XG5cdCAgICAgIGxlbmd0aCA9ICcnO1xuXHQgICAgfVxuXG5cdCAgICBpZiAobGVuZ3RoICE9PSAnJykge1xuXHQgICAgICAvLyBwYXJzZXIgZXJyb3IgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIG11bHRpcGxlIG1lc3NhZ2VzIChwYXlsb2FkKSBhcyBiaW5hcnkuXG5cdCAgICpcblx0ICAgKiA8MSA9IGJpbmFyeSwgMCA9IHN0cmluZz48bnVtYmVyIGZyb20gMC05PjxudW1iZXIgZnJvbSAwLTk+Wy4uLl08bnVtYmVyXG5cdCAgICogMjU1PjxkYXRhPlxuXHQgICAqXG5cdCAgICogRXhhbXBsZTpcblx0ICAgKiAxIDMgMjU1IDEgMiAzLCBpZiB0aGUgYmluYXJ5IGNvbnRlbnRzIGFyZSBpbnRlcnByZXRlZCBhcyA4IGJpdCBpbnRlZ2Vyc1xuXHQgICAqXG5cdCAgICogQHBhcmFtIHtBcnJheX0gcGFja2V0c1xuXHQgICAqIEByZXR1cm4ge0FycmF5QnVmZmVyfSBlbmNvZGVkIHBheWxvYWRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAocGFja2V0cywgY2FsbGJhY2spIHtcblx0ICAgIGlmICghcGFja2V0cy5sZW5ndGgpIHtcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBBcnJheUJ1ZmZlcigwKSk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGVuY29kZU9uZShwYWNrZXQsIGRvbmVDYWxsYmFjaykge1xuXHQgICAgICBleHBvcnRzLmVuY29kZVBhY2tldChwYWNrZXQsIHRydWUsIHRydWUsIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICAgICAgcmV0dXJuIGRvbmVDYWxsYmFjayhudWxsLCBkYXRhKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIG1hcChwYWNrZXRzLCBlbmNvZGVPbmUsIGZ1bmN0aW9uIChlcnIsIGVuY29kZWRQYWNrZXRzKSB7XG5cdCAgICAgIHZhciB0b3RhbExlbmd0aCA9IGVuY29kZWRQYWNrZXRzLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBwKSB7XG5cdCAgICAgICAgdmFyIGxlbjtcblx0ICAgICAgICBpZiAodHlwZW9mIHAgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgICAgICBsZW4gPSBwLmxlbmd0aDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgbGVuID0gcC5ieXRlTGVuZ3RoO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByZXR1cm4gYWNjICsgbGVuLnRvU3RyaW5nKCkubGVuZ3RoICsgbGVuICsgMjsgLy8gc3RyaW5nL2JpbmFyeSBpZGVudGlmaWVyICsgc2VwYXJhdG9yID0gMlxuXHQgICAgICB9LCAwKTtcblxuXHQgICAgICB2YXIgcmVzdWx0QXJyYXkgPSBuZXcgVWludDhBcnJheSh0b3RhbExlbmd0aCk7XG5cblx0ICAgICAgdmFyIGJ1ZmZlckluZGV4ID0gMDtcblx0ICAgICAgZW5jb2RlZFBhY2tldHMuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuXHQgICAgICAgIHZhciBpc1N0cmluZyA9IHR5cGVvZiBwID09PSAnc3RyaW5nJztcblx0ICAgICAgICB2YXIgYWIgPSBwO1xuXHQgICAgICAgIGlmIChpc1N0cmluZykge1xuXHQgICAgICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShwLmxlbmd0aCk7XG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHAubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgICAgdmlld1tpXSA9IHAuY2hhckNvZGVBdChpKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIGFiID0gdmlldy5idWZmZXI7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgaWYgKGlzU3RyaW5nKSB7XG5cdCAgICAgICAgICAvLyBub3QgdHJ1ZSBiaW5hcnlcblx0ICAgICAgICAgIHJlc3VsdEFycmF5W2J1ZmZlckluZGV4KytdID0gMDtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgLy8gdHJ1ZSBiaW5hcnlcblx0ICAgICAgICAgIHJlc3VsdEFycmF5W2J1ZmZlckluZGV4KytdID0gMTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2YXIgbGVuU3RyID0gYWIuYnl0ZUxlbmd0aC50b1N0cmluZygpO1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuU3RyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IHBhcnNlSW50KGxlblN0cltpXSk7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIHJlc3VsdEFycmF5W2J1ZmZlckluZGV4KytdID0gMjU1O1xuXG5cdCAgICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShhYik7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IHZpZXdbaV07XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblxuXHQgICAgICByZXR1cm4gY2FsbGJhY2socmVzdWx0QXJyYXkuYnVmZmVyKTtcblx0ICAgIH0pO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgYXMgQmxvYlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVQYXlsb2FkQXNCbG9iID0gZnVuY3Rpb24gKHBhY2tldHMsIGNhbGxiYWNrKSB7XG5cdCAgICBmdW5jdGlvbiBlbmNvZGVPbmUocGFja2V0LCBkb25lQ2FsbGJhY2spIHtcblx0ICAgICAgZXhwb3J0cy5lbmNvZGVQYWNrZXQocGFja2V0LCB0cnVlLCB0cnVlLCBmdW5jdGlvbiAoZW5jb2RlZCkge1xuXHQgICAgICAgIHZhciBiaW5hcnlJZGVudGlmaWVyID0gbmV3IFVpbnQ4QXJyYXkoMSk7XG5cdCAgICAgICAgYmluYXJ5SWRlbnRpZmllclswXSA9IDE7XG5cdCAgICAgICAgaWYgKHR5cGVvZiBlbmNvZGVkID09PSAnc3RyaW5nJykge1xuXHQgICAgICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShlbmNvZGVkLmxlbmd0aCk7XG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVuY29kZWQubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgICAgdmlld1tpXSA9IGVuY29kZWQuY2hhckNvZGVBdChpKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICAgIGVuY29kZWQgPSB2aWV3LmJ1ZmZlcjtcblx0ICAgICAgICAgIGJpbmFyeUlkZW50aWZpZXJbMF0gPSAwO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHZhciBsZW4gPSBlbmNvZGVkIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgPyBlbmNvZGVkLmJ5dGVMZW5ndGggOiBlbmNvZGVkLnNpemU7XG5cblx0ICAgICAgICB2YXIgbGVuU3RyID0gbGVuLnRvU3RyaW5nKCk7XG5cdCAgICAgICAgdmFyIGxlbmd0aEFyeSA9IG5ldyBVaW50OEFycmF5KGxlblN0ci5sZW5ndGggKyAxKTtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlblN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgbGVuZ3RoQXJ5W2ldID0gcGFyc2VJbnQobGVuU3RyW2ldKTtcblx0ICAgICAgICB9XG5cdCAgICAgICAgbGVuZ3RoQXJ5W2xlblN0ci5sZW5ndGhdID0gMjU1O1xuXG5cdCAgICAgICAgaWYgKEJsb2IkMSkge1xuXHQgICAgICAgICAgdmFyIGJsb2IgPSBuZXcgQmxvYiQxKFtiaW5hcnlJZGVudGlmaWVyLmJ1ZmZlciwgbGVuZ3RoQXJ5LmJ1ZmZlciwgZW5jb2RlZF0pO1xuXHQgICAgICAgICAgZG9uZUNhbGxiYWNrKG51bGwsIGJsb2IpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIG1hcChwYWNrZXRzLCBlbmNvZGVPbmUsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdHMpIHtcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBCbG9iJDEocmVzdWx0cykpO1xuXHQgICAgfSk7XG5cdCAgfTtcblxuXHQgIC8qXG5cdCAgICogRGVjb2RlcyBkYXRhIHdoZW4gYSBwYXlsb2FkIGlzIG1heWJlIGV4cGVjdGVkLiBTdHJpbmdzIGFyZSBkZWNvZGVkIGJ5XG5cdCAgICogaW50ZXJwcmV0aW5nIGVhY2ggYnl0ZSBhcyBhIGtleSBjb2RlIGZvciBlbnRyaWVzIG1hcmtlZCB0byBzdGFydCB3aXRoIDAuIFNlZVxuXHQgICAqIGRlc2NyaXB0aW9uIG9mIGVuY29kZVBheWxvYWRBc0JpbmFyeVxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gZGF0YSwgY2FsbGJhY2sgbWV0aG9kXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZGVjb2RlUGF5bG9hZEFzQmluYXJ5ID0gZnVuY3Rpb24gKGRhdGEsIGJpbmFyeVR5cGUsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIGJpbmFyeVR5cGUgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSBiaW5hcnlUeXBlO1xuXHQgICAgICBiaW5hcnlUeXBlID0gbnVsbDtcblx0ICAgIH1cblxuXHQgICAgdmFyIGJ1ZmZlclRhaWwgPSBkYXRhO1xuXHQgICAgdmFyIGJ1ZmZlcnMgPSBbXTtcblxuXHQgICAgd2hpbGUgKGJ1ZmZlclRhaWwuYnl0ZUxlbmd0aCA+IDApIHtcblx0ICAgICAgdmFyIHRhaWxBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlclRhaWwpO1xuXHQgICAgICB2YXIgaXNTdHJpbmcgPSB0YWlsQXJyYXlbMF0gPT09IDA7XG5cdCAgICAgIHZhciBtc2dMZW5ndGggPSAnJztcblxuXHQgICAgICBmb3IgKHZhciBpID0gMTs7IGkrKykge1xuXHQgICAgICAgIGlmICh0YWlsQXJyYXlbaV0gPT09IDI1NSkgYnJlYWs7XG5cblx0ICAgICAgICAvLyAzMTAgPSBjaGFyIGxlbmd0aCBvZiBOdW1iZXIuTUFYX1ZBTFVFXG5cdCAgICAgICAgaWYgKG1zZ0xlbmd0aC5sZW5ndGggPiAzMTApIHtcblx0ICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIG1zZ0xlbmd0aCArPSB0YWlsQXJyYXlbaV07XG5cdCAgICAgIH1cblxuXHQgICAgICBidWZmZXJUYWlsID0gc2xpY2VCdWZmZXIoYnVmZmVyVGFpbCwgMiArIG1zZ0xlbmd0aC5sZW5ndGgpO1xuXHQgICAgICBtc2dMZW5ndGggPSBwYXJzZUludChtc2dMZW5ndGgpO1xuXG5cdCAgICAgIHZhciBtc2cgPSBzbGljZUJ1ZmZlcihidWZmZXJUYWlsLCAwLCBtc2dMZW5ndGgpO1xuXHQgICAgICBpZiAoaXNTdHJpbmcpIHtcblx0ICAgICAgICB0cnkge1xuXHQgICAgICAgICAgbXNnID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBuZXcgVWludDhBcnJheShtc2cpKTtcblx0ICAgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgICAvLyBpUGhvbmUgU2FmYXJpIGRvZXNuJ3QgbGV0IHlvdSBhcHBseSB0byB0eXBlZCBhcnJheXNcblx0ICAgICAgICAgIHZhciB0eXBlZCA9IG5ldyBVaW50OEFycmF5KG1zZyk7XG5cdCAgICAgICAgICBtc2cgPSAnJztcblx0ICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZWQubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgICAgbXNnICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodHlwZWRbaV0pO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXG5cdCAgICAgIGJ1ZmZlcnMucHVzaChtc2cpO1xuXHQgICAgICBidWZmZXJUYWlsID0gc2xpY2VCdWZmZXIoYnVmZmVyVGFpbCwgbXNnTGVuZ3RoKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIHRvdGFsID0gYnVmZmVycy5sZW5ndGg7XG5cdCAgICBidWZmZXJzLmZvckVhY2goZnVuY3Rpb24gKGJ1ZmZlciwgaSkge1xuXHQgICAgICBjYWxsYmFjayhleHBvcnRzLmRlY29kZVBhY2tldChidWZmZXIsIGJpbmFyeVR5cGUsIHRydWUpLCBpLCB0b3RhbCk7XG5cdCAgICB9KTtcblx0ICB9O1xuXHR9KTtcblx0dmFyIGJyb3dzZXJfMSQxID0gYnJvd3NlciQyLnByb3RvY29sO1xuXHR2YXIgYnJvd3Nlcl8yJDEgPSBicm93c2VyJDIucGFja2V0cztcblx0dmFyIGJyb3dzZXJfMyQxID0gYnJvd3NlciQyLmVuY29kZVBhY2tldDtcblx0dmFyIGJyb3dzZXJfNCQxID0gYnJvd3NlciQyLmVuY29kZUJhc2U2NFBhY2tldDtcblx0dmFyIGJyb3dzZXJfNSQxID0gYnJvd3NlciQyLmRlY29kZVBhY2tldDtcblx0dmFyIGJyb3dzZXJfNiQxID0gYnJvd3NlciQyLmRlY29kZUJhc2U2NFBhY2tldDtcblx0dmFyIGJyb3dzZXJfNyQxID0gYnJvd3NlciQyLmVuY29kZVBheWxvYWQ7XG5cdHZhciBicm93c2VyXzggPSBicm93c2VyJDIuZGVjb2RlUGF5bG9hZDtcblx0dmFyIGJyb3dzZXJfOSA9IGJyb3dzZXIkMi5lbmNvZGVQYXlsb2FkQXNBcnJheUJ1ZmZlcjtcblx0dmFyIGJyb3dzZXJfMTAgPSBicm93c2VyJDIuZW5jb2RlUGF5bG9hZEFzQmxvYjtcblx0dmFyIGJyb3dzZXJfMTEgPSBicm93c2VyJDIuZGVjb2RlUGF5bG9hZEFzQmluYXJ5O1xuXG5cdHZhciBicm93c2VyJDMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYnJvd3NlciQyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYnJvd3NlciQyLFxuXHRcdHByb3RvY29sOiBicm93c2VyXzEkMSxcblx0XHRwYWNrZXRzOiBicm93c2VyXzIkMSxcblx0XHRlbmNvZGVQYWNrZXQ6IGJyb3dzZXJfMyQxLFxuXHRcdGVuY29kZUJhc2U2NFBhY2tldDogYnJvd3Nlcl80JDEsXG5cdFx0ZGVjb2RlUGFja2V0OiBicm93c2VyXzUkMSxcblx0XHRkZWNvZGVCYXNlNjRQYWNrZXQ6IGJyb3dzZXJfNiQxLFxuXHRcdGVuY29kZVBheWxvYWQ6IGJyb3dzZXJfNyQxLFxuXHRcdGRlY29kZVBheWxvYWQ6IGJyb3dzZXJfOCxcblx0XHRlbmNvZGVQYXlsb2FkQXNBcnJheUJ1ZmZlcjogYnJvd3Nlcl85LFxuXHRcdGVuY29kZVBheWxvYWRBc0Jsb2I6IGJyb3dzZXJfMTAsXG5cdFx0ZGVjb2RlUGF5bG9hZEFzQmluYXJ5OiBicm93c2VyXzExXG5cdH0pO1xuXG5cdHZhciBwYXJzZXIgPSAoIGJyb3dzZXIkMyAmJiBicm93c2VyJDIgKSB8fCBicm93c2VyJDM7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHRyYW5zcG9ydCA9IFRyYW5zcG9ydDtcblxuXHQvKipcblx0ICogVHJhbnNwb3J0IGFic3RyYWN0IGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFRyYW5zcG9ydChvcHRzKSB7XG5cdCAgdGhpcy5wYXRoID0gb3B0cy5wYXRoO1xuXHQgIHRoaXMuaG9zdG5hbWUgPSBvcHRzLmhvc3RuYW1lO1xuXHQgIHRoaXMucG9ydCA9IG9wdHMucG9ydDtcblx0ICB0aGlzLnNlY3VyZSA9IG9wdHMuc2VjdXJlO1xuXHQgIHRoaXMucXVlcnkgPSBvcHRzLnF1ZXJ5O1xuXHQgIHRoaXMudGltZXN0YW1wUGFyYW0gPSBvcHRzLnRpbWVzdGFtcFBhcmFtO1xuXHQgIHRoaXMudGltZXN0YW1wUmVxdWVzdHMgPSBvcHRzLnRpbWVzdGFtcFJlcXVlc3RzO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICcnO1xuXHQgIHRoaXMuYWdlbnQgPSBvcHRzLmFnZW50IHx8IGZhbHNlO1xuXHQgIHRoaXMuc29ja2V0ID0gb3B0cy5zb2NrZXQ7XG5cdCAgdGhpcy5lbmFibGVzWERSID0gb3B0cy5lbmFibGVzWERSO1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5wZnggPSBvcHRzLnBmeDtcblx0ICB0aGlzLmtleSA9IG9wdHMua2V5O1xuXHQgIHRoaXMucGFzc3BocmFzZSA9IG9wdHMucGFzc3BocmFzZTtcblx0ICB0aGlzLmNlcnQgPSBvcHRzLmNlcnQ7XG5cdCAgdGhpcy5jYSA9IG9wdHMuY2E7XG5cdCAgdGhpcy5jaXBoZXJzID0gb3B0cy5jaXBoZXJzO1xuXHQgIHRoaXMucmVqZWN0VW5hdXRob3JpemVkID0gb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cdCAgdGhpcy5mb3JjZU5vZGUgPSBvcHRzLmZvcmNlTm9kZTtcblxuXHQgIC8vIG90aGVyIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5leHRyYUhlYWRlcnMgPSBvcHRzLmV4dHJhSGVhZGVycztcblx0ICB0aGlzLmxvY2FsQWRkcmVzcyA9IG9wdHMubG9jYWxBZGRyZXNzO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1peCBpbiBgRW1pdHRlcmAuXG5cdCAqL1xuXG5cdEVtaXR0ZXIoVHJhbnNwb3J0LnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIEVtaXRzIGFuIGVycm9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyXG5cdCAqIEByZXR1cm4ge1RyYW5zcG9ydH0gZm9yIGNoYWluaW5nXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uIChtc2csIGRlc2MpIHtcblx0ICB2YXIgZXJyID0gbmV3IEVycm9yKG1zZyk7XG5cdCAgZXJyLnR5cGUgPSAnVHJhbnNwb3J0RXJyb3InO1xuXHQgIGVyci5kZXNjcmlwdGlvbiA9IGRlc2M7XG5cdCAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIE9wZW5zIHRoZSB0cmFuc3BvcnQuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoJ2Nsb3NlZCcgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICB0aGlzLnJlYWR5U3RhdGUgPSAnb3BlbmluZyc7XG5cdCAgICB0aGlzLmRvT3BlbigpO1xuXHQgIH1cblxuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbG9zZXMgdGhlIHRyYW5zcG9ydC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICB0aGlzLmRvQ2xvc2UoKTtcblx0ICAgIHRoaXMub25DbG9zZSgpO1xuXHQgIH1cblxuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBtdWx0aXBsZSBwYWNrZXRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fSBwYWNrZXRzXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAocGFja2V0cykge1xuXHQgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy53cml0ZShwYWNrZXRzKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhyb3cgbmV3IEVycm9yKCdUcmFuc3BvcnQgbm90IG9wZW4nKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIG9wZW5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub25PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuJztcblx0ICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblx0ICB0aGlzLmVtaXQoJ29wZW4nKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdpdGggZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGFcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB2YXIgcGFja2V0ID0gcGFyc2VyLmRlY29kZVBhY2tldChkYXRhLCB0aGlzLnNvY2tldC5iaW5hcnlUeXBlKTtcblx0ICB0aGlzLm9uUGFja2V0KHBhY2tldCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aXRoIGEgZGVjb2RlZCBwYWNrZXQuXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub25QYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgdGhpcy5lbWl0KCdwYWNrZXQnLCBwYWNrZXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBjbG9zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFRyYW5zcG9ydC5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG5cdH07XG5cblx0dmFyIHRyYW5zcG9ydCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHRyYW5zcG9ydCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHRyYW5zcG9ydFxuXHR9KTtcblxuXHQvKipcclxuXHQgKiBDb21waWxlcyBhIHF1ZXJ5c3RyaW5nXHJcblx0ICogUmV0dXJucyBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9XHJcblx0ICogQGFwaSBwcml2YXRlXHJcblx0ICovXG5cblx0dmFyIGVuY29kZSA9IGZ1bmN0aW9uIGVuY29kZShvYmopIHtcblx0ICB2YXIgc3RyID0gJyc7XG5cblx0ICBmb3IgKHZhciBpIGluIG9iaikge1xuXHQgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHQgICAgICBpZiAoc3RyLmxlbmd0aCkgc3RyICs9ICcmJztcblx0ICAgICAgc3RyICs9IGVuY29kZVVSSUNvbXBvbmVudChpKSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChvYmpbaV0pO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBzdHI7XG5cdH07XG5cblx0LyoqXHJcblx0ICogUGFyc2VzIGEgc2ltcGxlIHF1ZXJ5c3RyaW5nIGludG8gYW4gb2JqZWN0XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gcXNcclxuXHQgKiBAYXBpIHByaXZhdGVcclxuXHQgKi9cblxuXHR2YXIgZGVjb2RlID0gZnVuY3Rpb24gZGVjb2RlKHFzKSB7XG5cdCAgdmFyIHFyeSA9IHt9O1xuXHQgIHZhciBwYWlycyA9IHFzLnNwbGl0KCcmJyk7XG5cdCAgZm9yICh2YXIgaSA9IDAsIGwgPSBwYWlycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgIHZhciBwYWlyID0gcGFpcnNbaV0uc3BsaXQoJz0nKTtcblx0ICAgIHFyeVtkZWNvZGVVUklDb21wb25lbnQocGFpclswXSldID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhaXJbMV0pO1xuXHQgIH1cblx0ICByZXR1cm4gcXJ5O1xuXHR9O1xuXG5cdHZhciBwYXJzZXFzID0ge1xuXHQgIGVuY29kZTogZW5jb2RlLFxuXHQgIGRlY29kZTogZGVjb2RlXG5cdH07XG5cblx0dmFyIHBhcnNlcXMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBwYXJzZXFzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogcGFyc2Vxcyxcblx0XHRlbmNvZGU6IGVuY29kZSxcblx0XHRkZWNvZGU6IGRlY29kZVxuXHR9KTtcblxuXHR2YXIgY29tcG9uZW50SW5oZXJpdCA9IGZ1bmN0aW9uIGNvbXBvbmVudEluaGVyaXQoYSwgYikge1xuXHQgIHZhciBmbiA9IGZ1bmN0aW9uIGZuKCkge307XG5cdCAgZm4ucHJvdG90eXBlID0gYi5wcm90b3R5cGU7XG5cdCAgYS5wcm90b3R5cGUgPSBuZXcgZm4oKTtcblx0ICBhLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGE7XG5cdH07XG5cblx0dmFyIGNvbXBvbmVudEluaGVyaXQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBjb21wb25lbnRJbmhlcml0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogY29tcG9uZW50SW5oZXJpdFxuXHR9KTtcblxuXHR2YXIgYWxwaGFiZXQgPSAnMDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXotXycuc3BsaXQoJycpLFxuXHQgICAgbGVuZ3RoID0gNjQsXG5cdCAgICBtYXAgPSB7fSxcblx0ICAgIHNlZWQgPSAwLFxuXHQgICAgaSA9IDAsXG5cdCAgICBwcmV2O1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBzcGVjaWZpZWQgbnVtYmVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbnVtIFRoZSBudW1iZXIgdG8gY29udmVydC5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbnVtYmVyLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblx0ZnVuY3Rpb24gZW5jb2RlJDEobnVtKSB7XG5cdCAgdmFyIGVuY29kZWQgPSAnJztcblxuXHQgIGRvIHtcblx0ICAgIGVuY29kZWQgPSBhbHBoYWJldFtudW0gJSBsZW5ndGhdICsgZW5jb2RlZDtcblx0ICAgIG51bSA9IE1hdGguZmxvb3IobnVtIC8gbGVuZ3RoKTtcblx0ICB9IHdoaWxlIChudW0gPiAwKTtcblxuXHQgIHJldHVybiBlbmNvZGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgaW50ZWdlciB2YWx1ZSBzcGVjaWZpZWQgYnkgdGhlIGdpdmVuIHN0cmluZy5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIGNvbnZlcnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBpbnRlZ2VyIHZhbHVlIHJlcHJlc2VudGVkIGJ5IHRoZSBzdHJpbmcuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiBkZWNvZGUkMShzdHIpIHtcblx0ICB2YXIgZGVjb2RlZCA9IDA7XG5cblx0ICBmb3IgKGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICBkZWNvZGVkID0gZGVjb2RlZCAqIGxlbmd0aCArIG1hcFtzdHIuY2hhckF0KGkpXTtcblx0ICB9XG5cblx0ICByZXR1cm4gZGVjb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBZZWFzdDogQSB0aW55IGdyb3dpbmcgaWQgZ2VuZXJhdG9yLlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBBIHVuaXF1ZSBpZC5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cdGZ1bmN0aW9uIHllYXN0KCkge1xuXHQgIHZhciBub3cgPSBlbmNvZGUkMSgrbmV3IERhdGUoKSk7XG5cblx0ICBpZiAobm93ICE9PSBwcmV2KSByZXR1cm4gc2VlZCA9IDAsIHByZXYgPSBub3c7XG5cdCAgcmV0dXJuIG5vdyArICcuJyArIGVuY29kZSQxKHNlZWQrKyk7XG5cdH1cblxuXHQvL1xuXHQvLyBNYXAgZWFjaCBjaGFyYWN0ZXIgdG8gaXRzIGluZGV4LlxuXHQvL1xuXHRmb3IgKDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdCAgbWFwW2FscGhhYmV0W2ldXSA9IGk7XG5cdH0gLy9cblx0Ly8gRXhwb3NlIHRoZSBgeWVhc3RgLCBgZW5jb2RlYCBhbmQgYGRlY29kZWAgZnVuY3Rpb25zLlxuXHQvL1xuXHR5ZWFzdC5lbmNvZGUgPSBlbmNvZGUkMTtcblx0eWVhc3QuZGVjb2RlID0gZGVjb2RlJDE7XG5cdHZhciB5ZWFzdF8xID0geWVhc3Q7XG5cblx0dmFyIHllYXN0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogeWVhc3RfMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHllYXN0XzFcblx0fSk7XG5cblx0dmFyIFRyYW5zcG9ydCQxID0gKCB0cmFuc3BvcnQkMSAmJiB0cmFuc3BvcnQgKSB8fCB0cmFuc3BvcnQkMTtcblxuXHR2YXIgcGFyc2VxcyQyID0gKCBwYXJzZXFzJDEgJiYgcGFyc2VxcyApIHx8IHBhcnNlcXMkMTtcblxuXHR2YXIgaW5oZXJpdCA9ICggY29tcG9uZW50SW5oZXJpdCQxICYmIGNvbXBvbmVudEluaGVyaXQgKSB8fCBjb21wb25lbnRJbmhlcml0JDE7XG5cblx0dmFyIHllYXN0JDIgPSAoIHllYXN0JDEgJiYgeWVhc3RfMSApIHx8IHllYXN0JDE7XG5cblx0dmFyIHJlcXVpcmUkJDEgPSAoIHhtbGh0dHByZXF1ZXN0JDEgJiYgeG1saHR0cHJlcXVlc3QgKSB8fCB4bWxodHRwcmVxdWVzdCQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckMyA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDpwb2xsaW5nJyk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgcG9sbGluZyA9IFBvbGxpbmc7XG5cblx0LyoqXG5cdCAqIElzIFhIUjIgc3VwcG9ydGVkP1xuXHQgKi9cblxuXHR2YXIgaGFzWEhSMiA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgWE1MSHR0cFJlcXVlc3QgPSByZXF1aXJlJCQxO1xuXHQgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoeyB4ZG9tYWluOiBmYWxzZSB9KTtcblx0ICByZXR1cm4gbnVsbCAhPSB4aHIucmVzcG9uc2VUeXBlO1xuXHR9KCk7XG5cblx0LyoqXG5cdCAqIFBvbGxpbmcgaW50ZXJmYWNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gUG9sbGluZyhvcHRzKSB7XG5cdCAgdmFyIGZvcmNlQmFzZTY0ID0gb3B0cyAmJiBvcHRzLmZvcmNlQmFzZTY0O1xuXHQgIGlmICghaGFzWEhSMiB8fCBmb3JjZUJhc2U2NCkge1xuXHQgICAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXHQgIH1cblx0ICBUcmFuc3BvcnQkMS5jYWxsKHRoaXMsIG9wdHMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaGVyaXRzIGZyb20gVHJhbnNwb3J0LlxuXHQgKi9cblxuXHRpbmhlcml0KFBvbGxpbmcsIFRyYW5zcG9ydCQxKTtcblxuXHQvKipcblx0ICogVHJhbnNwb3J0IG5hbWUuXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLm5hbWUgPSAncG9sbGluZyc7XG5cblx0LyoqXG5cdCAqIE9wZW5zIHRoZSBzb2NrZXQgKHRyaWdnZXJzIHBvbGxpbmcpLiBXZSB3cml0ZSBhIFBJTkcgbWVzc2FnZSB0byBkZXRlcm1pbmVcblx0ICogd2hlbiB0aGUgdHJhbnNwb3J0IGlzIG9wZW4uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5kb09wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5wb2xsKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFBhdXNlcyBwb2xsaW5nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayB1cG9uIGJ1ZmZlcnMgYXJlIGZsdXNoZWQgYW5kIHRyYW5zcG9ydCBpcyBwYXVzZWRcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24gKG9uUGF1c2UpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAncGF1c2luZyc7XG5cblx0ICBmdW5jdGlvbiBwYXVzZSgpIHtcblx0ICAgIGRlYnVnJDMoJ3BhdXNlZCcpO1xuXHQgICAgc2VsZi5yZWFkeVN0YXRlID0gJ3BhdXNlZCc7XG5cdCAgICBvblBhdXNlKCk7XG5cdCAgfVxuXG5cdCAgaWYgKHRoaXMucG9sbGluZyB8fCAhdGhpcy53cml0YWJsZSkge1xuXHQgICAgdmFyIHRvdGFsID0gMDtcblxuXHQgICAgaWYgKHRoaXMucG9sbGluZykge1xuXHQgICAgICBkZWJ1ZyQzKCd3ZSBhcmUgY3VycmVudGx5IHBvbGxpbmcgLSB3YWl0aW5nIHRvIHBhdXNlJyk7XG5cdCAgICAgIHRvdGFsKys7XG5cdCAgICAgIHRoaXMub25jZSgncG9sbENvbXBsZXRlJywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGRlYnVnJDMoJ3ByZS1wYXVzZSBwb2xsaW5nIGNvbXBsZXRlJyk7XG5cdCAgICAgICAgLS10b3RhbCB8fCBwYXVzZSgpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCF0aGlzLndyaXRhYmxlKSB7XG5cdCAgICAgIGRlYnVnJDMoJ3dlIGFyZSBjdXJyZW50bHkgd3JpdGluZyAtIHdhaXRpbmcgdG8gcGF1c2UnKTtcblx0ICAgICAgdG90YWwrKztcblx0ICAgICAgdGhpcy5vbmNlKCdkcmFpbicsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBkZWJ1ZyQzKCdwcmUtcGF1c2Ugd3JpdGluZyBjb21wbGV0ZScpO1xuXHQgICAgICAgIC0tdG90YWwgfHwgcGF1c2UoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cdCAgfSBlbHNlIHtcblx0ICAgIHBhdXNlKCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgcG9sbGluZyBjeWNsZS5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUucG9sbCA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQzKCdwb2xsaW5nJyk7XG5cdCAgdGhpcy5wb2xsaW5nID0gdHJ1ZTtcblx0ICB0aGlzLmRvUG9sbCgpO1xuXHQgIHRoaXMuZW1pdCgncG9sbCcpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBPdmVybG9hZHMgb25EYXRhIHRvIGRldGVjdCBwYXlsb2Fkcy5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLm9uRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIGRlYnVnJDMoJ3BvbGxpbmcgZ290IGRhdGEgJXMnLCBkYXRhKTtcblx0ICB2YXIgY2FsbGJhY2sgPSBmdW5jdGlvbiBjYWxsYmFjayhwYWNrZXQsIGluZGV4LCB0b3RhbCkge1xuXHQgICAgLy8gaWYgaXRzIHRoZSBmaXJzdCBtZXNzYWdlIHdlIGNvbnNpZGVyIHRoZSB0cmFuc3BvcnQgb3BlblxuXHQgICAgaWYgKCdvcGVuaW5nJyA9PT0gc2VsZi5yZWFkeVN0YXRlKSB7XG5cdCAgICAgIHNlbGYub25PcGVuKCk7XG5cdCAgICB9XG5cblx0ICAgIC8vIGlmIGl0cyBhIGNsb3NlIHBhY2tldCwgd2UgY2xvc2UgdGhlIG9uZ29pbmcgcmVxdWVzdHNcblx0ICAgIGlmICgnY2xvc2UnID09PSBwYWNrZXQudHlwZSkge1xuXHQgICAgICBzZWxmLm9uQ2xvc2UoKTtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXG5cdCAgICAvLyBvdGhlcndpc2UgYnlwYXNzIG9uRGF0YSBhbmQgaGFuZGxlIHRoZSBtZXNzYWdlXG5cdCAgICBzZWxmLm9uUGFja2V0KHBhY2tldCk7XG5cdCAgfTtcblxuXHQgIC8vIGRlY29kZSBwYXlsb2FkXG5cdCAgcGFyc2VyLmRlY29kZVBheWxvYWQoZGF0YSwgdGhpcy5zb2NrZXQuYmluYXJ5VHlwZSwgY2FsbGJhY2spO1xuXG5cdCAgLy8gaWYgYW4gZXZlbnQgZGlkIG5vdCB0cmlnZ2VyIGNsb3Npbmdcblx0ICBpZiAoJ2Nsb3NlZCcgIT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgLy8gaWYgd2UgZ290IGRhdGEgd2UncmUgbm90IHBvbGxpbmdcblx0ICAgIHRoaXMucG9sbGluZyA9IGZhbHNlO1xuXHQgICAgdGhpcy5lbWl0KCdwb2xsQ29tcGxldGUnKTtcblxuXHQgICAgaWYgKCdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICAgIHRoaXMucG9sbCgpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgZGVidWckMygnaWdub3JpbmcgcG9sbCAtIHRyYW5zcG9ydCBzdGF0ZSBcIiVzXCInLCB0aGlzLnJlYWR5U3RhdGUpO1xuXHQgICAgfVxuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogRm9yIHBvbGxpbmcsIHNlbmQgYSBjbG9zZSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5kb0Nsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGZ1bmN0aW9uIGNsb3NlKCkge1xuXHQgICAgZGVidWckMygnd3JpdGluZyBjbG9zZSBwYWNrZXQnKTtcblx0ICAgIHNlbGYud3JpdGUoW3sgdHlwZTogJ2Nsb3NlJyB9XSk7XG5cdCAgfVxuXG5cdCAgaWYgKCdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICBkZWJ1ZyQzKCd0cmFuc3BvcnQgb3BlbiAtIGNsb3NpbmcnKTtcblx0ICAgIGNsb3NlKCk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIC8vIGluIGNhc2Ugd2UncmUgdHJ5aW5nIHRvIGNsb3NlIHdoaWxlXG5cdCAgICAvLyBoYW5kc2hha2luZyBpcyBpbiBwcm9ncmVzcyAoR0gtMTY0KVxuXHQgICAgZGVidWckMygndHJhbnNwb3J0IG5vdCBvcGVuIC0gZGVmZXJyaW5nIGNsb3NlJyk7XG5cdCAgICB0aGlzLm9uY2UoJ29wZW4nLCBjbG9zZSk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBXcml0ZXMgYSBwYWNrZXRzIHBheWxvYWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGRhdGEgcGFja2V0c1xuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBkcmFpbiBjYWxsYmFja1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAocGFja2V0cykge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cdCAgdmFyIGNhbGxiYWNrZm4gPSBmdW5jdGlvbiBjYWxsYmFja2ZuKCkge1xuXHQgICAgc2VsZi53cml0YWJsZSA9IHRydWU7XG5cdCAgICBzZWxmLmVtaXQoJ2RyYWluJyk7XG5cdCAgfTtcblxuXHQgIHBhcnNlci5lbmNvZGVQYXlsb2FkKHBhY2tldHMsIHRoaXMuc3VwcG9ydHNCaW5hcnksIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICBzZWxmLmRvV3JpdGUoZGF0YSwgY2FsbGJhY2tmbik7XG5cdCAgfSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdlbmVyYXRlcyB1cmkgZm9yIGNvbm5lY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS51cmkgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyeSB8fCB7fTtcblx0ICB2YXIgc2NoZW1hID0gdGhpcy5zZWN1cmUgPyAnaHR0cHMnIDogJ2h0dHAnO1xuXHQgIHZhciBwb3J0ID0gJyc7XG5cblx0ICAvLyBjYWNoZSBidXN0aW5nIGlzIGZvcmNlZFxuXHQgIGlmIChmYWxzZSAhPT0gdGhpcy50aW1lc3RhbXBSZXF1ZXN0cykge1xuXHQgICAgcXVlcnlbdGhpcy50aW1lc3RhbXBQYXJhbV0gPSB5ZWFzdCQyKCk7XG5cdCAgfVxuXG5cdCAgaWYgKCF0aGlzLnN1cHBvcnRzQmluYXJ5ICYmICFxdWVyeS5zaWQpIHtcblx0ICAgIHF1ZXJ5LmI2NCA9IDE7XG5cdCAgfVxuXG5cdCAgcXVlcnkgPSBwYXJzZXFzJDIuZW5jb2RlKHF1ZXJ5KTtcblxuXHQgIC8vIGF2b2lkIHBvcnQgaWYgZGVmYXVsdCBmb3Igc2NoZW1hXG5cdCAgaWYgKHRoaXMucG9ydCAmJiAoJ2h0dHBzJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA0NDMgfHwgJ2h0dHAnID09PSBzY2hlbWEgJiYgTnVtYmVyKHRoaXMucG9ydCkgIT09IDgwKSkge1xuXHQgICAgcG9ydCA9ICc6JyArIHRoaXMucG9ydDtcblx0ICB9XG5cblx0ICAvLyBwcmVwZW5kID8gdG8gcXVlcnlcblx0ICBpZiAocXVlcnkubGVuZ3RoKSB7XG5cdCAgICBxdWVyeSA9ICc/JyArIHF1ZXJ5O1xuXHQgIH1cblxuXHQgIHZhciBpcHY2ID0gdGhpcy5ob3N0bmFtZS5pbmRleE9mKCc6JykgIT09IC0xO1xuXHQgIHJldHVybiBzY2hlbWEgKyAnOi8vJyArIChpcHY2ID8gJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyA6IHRoaXMuaG9zdG5hbWUpICsgcG9ydCArIHRoaXMucGF0aCArIHF1ZXJ5O1xuXHR9O1xuXG5cdHZhciBwb2xsaW5nJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcG9sbGluZyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBvbGxpbmdcblx0fSk7XG5cblx0dmFyIFBvbGxpbmckMSA9ICggcG9sbGluZyQxICYmIHBvbGxpbmcgKSB8fCBwb2xsaW5nJDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSByZXF1aXJlbWVudHMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQ0ID0gcmVxdWlyZSQkMCQyKCdlbmdpbmUuaW8tY2xpZW50OnBvbGxpbmcteGhyJyk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgcG9sbGluZ1hociA9IFhIUjtcblx0dmFyIFJlcXVlc3RfMSA9IFJlcXVlc3Q7XG5cblx0LyoqXG5cdCAqIEVtcHR5IGZ1bmN0aW9uXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGVtcHR5KCkge31cblxuXHQvKipcblx0ICogWEhSIFBvbGxpbmcgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFhIUihvcHRzKSB7XG5cdCAgUG9sbGluZyQxLmNhbGwodGhpcywgb3B0cyk7XG5cdCAgdGhpcy5yZXF1ZXN0VGltZW91dCA9IG9wdHMucmVxdWVzdFRpbWVvdXQ7XG5cdCAgdGhpcy5leHRyYUhlYWRlcnMgPSBvcHRzLmV4dHJhSGVhZGVycztcblxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5sb2NhdGlvbikge1xuXHQgICAgdmFyIGlzU1NMID0gJ2h0dHBzOicgPT09IGxvY2F0aW9uLnByb3RvY29sO1xuXHQgICAgdmFyIHBvcnQgPSBsb2NhdGlvbi5wb3J0O1xuXG5cdCAgICAvLyBzb21lIHVzZXIgYWdlbnRzIGhhdmUgZW1wdHkgYGxvY2F0aW9uLnBvcnRgXG5cdCAgICBpZiAoIXBvcnQpIHtcblx0ICAgICAgcG9ydCA9IGlzU1NMID8gNDQzIDogODA7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMueGQgPSBvcHRzLmhvc3RuYW1lICE9PSBjb21tb25qc0dsb2JhbC5sb2NhdGlvbi5ob3N0bmFtZSB8fCBwb3J0ICE9PSBvcHRzLnBvcnQ7XG5cdCAgICB0aGlzLnhzID0gb3B0cy5zZWN1cmUgIT09IGlzU1NMO1xuXHQgIH1cblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0cyBmcm9tIFBvbGxpbmcuXG5cdCAqL1xuXG5cdGluaGVyaXQoWEhSLCBQb2xsaW5nJDEpO1xuXG5cdC8qKlxuXHQgKiBYSFIgc3VwcG9ydHMgYmluYXJ5XG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUuc3VwcG9ydHNCaW5hcnkgPSB0cnVlO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgcmVxdWVzdC5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZFxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0WEhSLnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdHMpIHtcblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblx0ICBvcHRzLnVyaSA9IHRoaXMudXJpKCk7XG5cdCAgb3B0cy54ZCA9IHRoaXMueGQ7XG5cdCAgb3B0cy54cyA9IHRoaXMueHM7XG5cdCAgb3B0cy5hZ2VudCA9IHRoaXMuYWdlbnQgfHwgZmFsc2U7XG5cdCAgb3B0cy5zdXBwb3J0c0JpbmFyeSA9IHRoaXMuc3VwcG9ydHNCaW5hcnk7XG5cdCAgb3B0cy5lbmFibGVzWERSID0gdGhpcy5lbmFibGVzWERSO1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgb3B0cy5wZnggPSB0aGlzLnBmeDtcblx0ICBvcHRzLmtleSA9IHRoaXMua2V5O1xuXHQgIG9wdHMucGFzc3BocmFzZSA9IHRoaXMucGFzc3BocmFzZTtcblx0ICBvcHRzLmNlcnQgPSB0aGlzLmNlcnQ7XG5cdCAgb3B0cy5jYSA9IHRoaXMuY2E7XG5cdCAgb3B0cy5jaXBoZXJzID0gdGhpcy5jaXBoZXJzO1xuXHQgIG9wdHMucmVqZWN0VW5hdXRob3JpemVkID0gdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cdCAgb3B0cy5yZXF1ZXN0VGltZW91dCA9IHRoaXMucmVxdWVzdFRpbWVvdXQ7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIG9wdHMuZXh0cmFIZWFkZXJzID0gdGhpcy5leHRyYUhlYWRlcnM7XG5cblx0ICByZXR1cm4gbmV3IFJlcXVlc3Qob3B0cyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNlbmRzIGRhdGEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhIHRvIHNlbmQuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxlZCB1cG9uIGZsdXNoLlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0WEhSLnByb3RvdHlwZS5kb1dyaXRlID0gZnVuY3Rpb24gKGRhdGEsIGZuKSB7XG5cdCAgdmFyIGlzQmluYXJ5ID0gdHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGRhdGEgIT09IHVuZGVmaW5lZDtcblx0ICB2YXIgcmVxID0gdGhpcy5yZXF1ZXN0KHsgbWV0aG9kOiAnUE9TVCcsIGRhdGE6IGRhdGEsIGlzQmluYXJ5OiBpc0JpbmFyeSB9KTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgcmVxLm9uKCdzdWNjZXNzJywgZm4pO1xuXHQgIHJlcS5vbignZXJyb3InLCBmdW5jdGlvbiAoZXJyKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoJ3hociBwb3N0IGVycm9yJywgZXJyKTtcblx0ICB9KTtcblx0ICB0aGlzLnNlbmRYaHIgPSByZXE7XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyBhIHBvbGwgY3ljbGUuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRYSFIucHJvdG90eXBlLmRvUG9sbCA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ0KCd4aHIgcG9sbCcpO1xuXHQgIHZhciByZXEgPSB0aGlzLnJlcXVlc3QoKTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgcmVxLm9uKCdkYXRhJywgZnVuY3Rpb24gKGRhdGEpIHtcblx0ICAgIHNlbGYub25EYXRhKGRhdGEpO1xuXHQgIH0pO1xuXHQgIHJlcS5vbignZXJyb3InLCBmdW5jdGlvbiAoZXJyKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoJ3hociBwb2xsIGVycm9yJywgZXJyKTtcblx0ICB9KTtcblx0ICB0aGlzLnBvbGxYaHIgPSByZXE7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlcXVlc3QgY29uc3RydWN0b3Jcblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gUmVxdWVzdChvcHRzKSB7XG5cdCAgdGhpcy5tZXRob2QgPSBvcHRzLm1ldGhvZCB8fCAnR0VUJztcblx0ICB0aGlzLnVyaSA9IG9wdHMudXJpO1xuXHQgIHRoaXMueGQgPSAhIW9wdHMueGQ7XG5cdCAgdGhpcy54cyA9ICEhb3B0cy54cztcblx0ICB0aGlzLmFzeW5jID0gZmFsc2UgIT09IG9wdHMuYXN5bmM7XG5cdCAgdGhpcy5kYXRhID0gdW5kZWZpbmVkICE9PSBvcHRzLmRhdGEgPyBvcHRzLmRhdGEgOiBudWxsO1xuXHQgIHRoaXMuYWdlbnQgPSBvcHRzLmFnZW50O1xuXHQgIHRoaXMuaXNCaW5hcnkgPSBvcHRzLmlzQmluYXJ5O1xuXHQgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBvcHRzLnN1cHBvcnRzQmluYXJ5O1xuXHQgIHRoaXMuZW5hYmxlc1hEUiA9IG9wdHMuZW5hYmxlc1hEUjtcblx0ICB0aGlzLnJlcXVlc3RUaW1lb3V0ID0gb3B0cy5yZXF1ZXN0VGltZW91dDtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMucGZ4ID0gb3B0cy5wZng7XG5cdCAgdGhpcy5rZXkgPSBvcHRzLmtleTtcblx0ICB0aGlzLnBhc3NwaHJhc2UgPSBvcHRzLnBhc3NwaHJhc2U7XG5cdCAgdGhpcy5jZXJ0ID0gb3B0cy5jZXJ0O1xuXHQgIHRoaXMuY2EgPSBvcHRzLmNhO1xuXHQgIHRoaXMuY2lwaGVycyA9IG9wdHMuY2lwaGVycztcblx0ICB0aGlzLnJlamVjdFVuYXV0aG9yaXplZCA9IG9wdHMucmVqZWN0VW5hdXRob3JpemVkO1xuXG5cdCAgLy8gb3RoZXIgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLmV4dHJhSGVhZGVycyA9IG9wdHMuZXh0cmFIZWFkZXJzO1xuXG5cdCAgdGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKFJlcXVlc3QucHJvdG90eXBlKTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0aGUgWEhSIG9iamVjdCBhbmQgc2VuZHMgdGhlIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIG9wdHMgPSB7IGFnZW50OiB0aGlzLmFnZW50LCB4ZG9tYWluOiB0aGlzLnhkLCB4c2NoZW1lOiB0aGlzLnhzLCBlbmFibGVzWERSOiB0aGlzLmVuYWJsZXNYRFIgfTtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIG9wdHMucGZ4ID0gdGhpcy5wZng7XG5cdCAgb3B0cy5rZXkgPSB0aGlzLmtleTtcblx0ICBvcHRzLnBhc3NwaHJhc2UgPSB0aGlzLnBhc3NwaHJhc2U7XG5cdCAgb3B0cy5jZXJ0ID0gdGhpcy5jZXJ0O1xuXHQgIG9wdHMuY2EgPSB0aGlzLmNhO1xuXHQgIG9wdHMuY2lwaGVycyA9IHRoaXMuY2lwaGVycztcblx0ICBvcHRzLnJlamVjdFVuYXV0aG9yaXplZCA9IHRoaXMucmVqZWN0VW5hdXRob3JpemVkO1xuXG5cdCAgdmFyIHhociA9IHRoaXMueGhyID0gbmV3IHJlcXVpcmUkJDEob3B0cyk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgdHJ5IHtcblx0ICAgIGRlYnVnJDQoJ3hociBvcGVuICVzOiAlcycsIHRoaXMubWV0aG9kLCB0aGlzLnVyaSk7XG5cdCAgICB4aHIub3Blbih0aGlzLm1ldGhvZCwgdGhpcy51cmksIHRoaXMuYXN5bmMpO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgaWYgKHRoaXMuZXh0cmFIZWFkZXJzKSB7XG5cdCAgICAgICAgeGhyLnNldERpc2FibGVIZWFkZXJDaGVjayAmJiB4aHIuc2V0RGlzYWJsZUhlYWRlckNoZWNrKHRydWUpO1xuXHQgICAgICAgIGZvciAodmFyIGkgaW4gdGhpcy5leHRyYUhlYWRlcnMpIHtcblx0ICAgICAgICAgIGlmICh0aGlzLmV4dHJhSGVhZGVycy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHQgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihpLCB0aGlzLmV4dHJhSGVhZGVyc1tpXSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgICBpZiAoJ1BPU1QnID09PSB0aGlzLm1ldGhvZCkge1xuXHQgICAgICB0cnkge1xuXHQgICAgICAgIGlmICh0aGlzLmlzQmluYXJ5KSB7XG5cdCAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC10eXBlJywgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC10eXBlJywgJ3RleHQvcGxhaW47Y2hhcnNldD1VVEYtOCcpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSBjYXRjaCAoZSkge31cblx0ICAgIH1cblxuXHQgICAgdHJ5IHtcblx0ICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICcqLyonKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICAgIC8vIGllNiBjaGVja1xuXHQgICAgaWYgKCd3aXRoQ3JlZGVudGlhbHMnIGluIHhocikge1xuXHQgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRoaXMucmVxdWVzdFRpbWVvdXQpIHtcblx0ICAgICAgeGhyLnRpbWVvdXQgPSB0aGlzLnJlcXVlc3RUaW1lb3V0O1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGhpcy5oYXNYRFIoKSkge1xuXHQgICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHNlbGYub25Mb2FkKCk7XG5cdCAgICAgIH07XG5cdCAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHNlbGYub25FcnJvcih4aHIucmVzcG9uc2VUZXh0KTtcblx0ICAgICAgfTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSAyKSB7XG5cdCAgICAgICAgICB0cnkge1xuXHQgICAgICAgICAgICB2YXIgY29udGVudFR5cGUgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NvbnRlbnQtVHlwZScpO1xuXHQgICAgICAgICAgICBpZiAoc2VsZi5zdXBwb3J0c0JpbmFyeSAmJiBjb250ZW50VHlwZSA9PT0gJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpIHtcblx0ICAgICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfSBjYXRjaCAoZSkge31cblx0ICAgICAgICB9XG5cdCAgICAgICAgaWYgKDQgIT09IHhoci5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgICAgICAgaWYgKDIwMCA9PT0geGhyLnN0YXR1cyB8fCAxMjIzID09PSB4aHIuc3RhdHVzKSB7XG5cdCAgICAgICAgICBzZWxmLm9uTG9hZCgpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhlIGBlcnJvcmAgZXZlbnQgaGFuZGxlciB0aGF0J3MgdXNlci1zZXRcblx0ICAgICAgICAgIC8vIGRvZXMgbm90IHRocm93IGluIHRoZSBzYW1lIHRpY2sgYW5kIGdldHMgY2F1Z2h0IGhlcmVcblx0ICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICBzZWxmLm9uRXJyb3IoeGhyLnN0YXR1cyk7XG5cdCAgICAgICAgICB9LCAwKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH07XG5cdCAgICB9XG5cblx0ICAgIGRlYnVnJDQoJ3hociBkYXRhICVzJywgdGhpcy5kYXRhKTtcblx0ICAgIHhoci5zZW5kKHRoaXMuZGF0YSk7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgLy8gTmVlZCB0byBkZWZlciBzaW5jZSAuY3JlYXRlKCkgaXMgY2FsbGVkIGRpcmVjdGx5IGZocm9tIHRoZSBjb25zdHJ1Y3RvclxuXHQgICAgLy8gYW5kIHRodXMgdGhlICdlcnJvcicgZXZlbnQgY2FuIG9ubHkgYmUgb25seSBib3VuZCAqYWZ0ZXIqIHRoaXMgZXhjZXB0aW9uXG5cdCAgICAvLyBvY2N1cnMuICBUaGVyZWZvcmUsIGFsc28sIHdlIGNhbm5vdCB0aHJvdyBoZXJlIGF0IGFsbC5cblx0ICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBzZWxmLm9uRXJyb3IoZSk7XG5cdCAgICB9LCAwKTtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQpIHtcblx0ICAgIHRoaXMuaW5kZXggPSBSZXF1ZXN0LnJlcXVlc3RzQ291bnQrKztcblx0ICAgIFJlcXVlc3QucmVxdWVzdHNbdGhpcy5pbmRleF0gPSB0aGlzO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gc3VjY2Vzc2Z1bCByZXNwb25zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLm9uU3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmVtaXQoJ3N1Y2Nlc3MnKTtcblx0ICB0aGlzLmNsZWFudXAoKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIGlmIHdlIGhhdmUgZGF0YS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLm9uRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdGhpcy5lbWl0KCdkYXRhJywgZGF0YSk7XG5cdCAgdGhpcy5vblN1Y2Nlc3MoKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gZXJyb3IuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXHQgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIHRoaXMuY2xlYW51cCh0cnVlKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2xlYW5zIHVwIGhvdXNlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuY2xlYW51cCA9IGZ1bmN0aW9uIChmcm9tRXJyb3IpIHtcblx0ICBpZiAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0aGlzLnhociB8fCBudWxsID09PSB0aGlzLnhocikge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICAvLyB4bWxodHRwcmVxdWVzdFxuXHQgIGlmICh0aGlzLmhhc1hEUigpKSB7XG5cdCAgICB0aGlzLnhoci5vbmxvYWQgPSB0aGlzLnhoci5vbmVycm9yID0gZW1wdHk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRoaXMueGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGVtcHR5O1xuXHQgIH1cblxuXHQgIGlmIChmcm9tRXJyb3IpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHRoaXMueGhyLmFib3J0KCk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5kb2N1bWVudCkge1xuXHQgICAgZGVsZXRlIFJlcXVlc3QucmVxdWVzdHNbdGhpcy5pbmRleF07XG5cdCAgfVxuXG5cdCAgdGhpcy54aHIgPSBudWxsO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBsb2FkLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUub25Mb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBkYXRhO1xuXHQgIHRyeSB7XG5cdCAgICB2YXIgY29udGVudFR5cGU7XG5cdCAgICB0cnkge1xuXHQgICAgICBjb250ZW50VHlwZSA9IHRoaXMueGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgICBpZiAoY29udGVudFR5cGUgPT09ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKSB7XG5cdCAgICAgIGRhdGEgPSB0aGlzLnhoci5yZXNwb25zZSB8fCB0aGlzLnhoci5yZXNwb25zZVRleHQ7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBkYXRhID0gdGhpcy54aHIucmVzcG9uc2VUZXh0O1xuXHQgICAgfVxuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHRoaXMub25FcnJvcihlKTtcblx0ICB9XG5cdCAgaWYgKG51bGwgIT0gZGF0YSkge1xuXHQgICAgdGhpcy5vbkRhdGEoZGF0YSk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBpdCBoYXMgWERvbWFpblJlcXVlc3QuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5oYXNYRFIgPSBmdW5jdGlvbiAoKSB7XG5cdCAgcmV0dXJuICd1bmRlZmluZWQnICE9PSB0eXBlb2YgY29tbW9uanNHbG9iYWwuWERvbWFpblJlcXVlc3QgJiYgIXRoaXMueHMgJiYgdGhpcy5lbmFibGVzWERSO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBBYm9ydHMgdGhlIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLmFib3J0ID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuY2xlYW51cCgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBBYm9ydHMgcGVuZGluZyByZXF1ZXN0cyB3aGVuIHVubG9hZGluZyB0aGUgd2luZG93LiBUaGlzIGlzIG5lZWRlZCB0byBwcmV2ZW50XG5cdCAqIG1lbW9yeSBsZWFrcyAoZS5nLiB3aGVuIHVzaW5nIElFKSBhbmQgdG8gZW5zdXJlIHRoYXQgbm8gc3B1cmlvdXMgZXJyb3IgaXNcblx0ICogZW1pdHRlZC5cblx0ICovXG5cblx0UmVxdWVzdC5yZXF1ZXN0c0NvdW50ID0gMDtcblx0UmVxdWVzdC5yZXF1ZXN0cyA9IHt9O1xuXG5cdGlmIChjb21tb25qc0dsb2JhbC5kb2N1bWVudCkge1xuXHQgIGlmIChjb21tb25qc0dsb2JhbC5hdHRhY2hFdmVudCkge1xuXHQgICAgY29tbW9uanNHbG9iYWwuYXR0YWNoRXZlbnQoJ29udW5sb2FkJywgdW5sb2FkSGFuZGxlcik7XG5cdCAgfSBlbHNlIGlmIChjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG5cdCAgICBjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCB1bmxvYWRIYW5kbGVyLCBmYWxzZSk7XG5cdCAgfVxuXHR9XG5cblx0ZnVuY3Rpb24gdW5sb2FkSGFuZGxlcigpIHtcblx0ICBmb3IgKHZhciBpIGluIFJlcXVlc3QucmVxdWVzdHMpIHtcblx0ICAgIGlmIChSZXF1ZXN0LnJlcXVlc3RzLmhhc093blByb3BlcnR5KGkpKSB7XG5cdCAgICAgIFJlcXVlc3QucmVxdWVzdHNbaV0uYWJvcnQoKTtcblx0ICAgIH1cblx0ICB9XG5cdH1cblx0cG9sbGluZ1hoci5SZXF1ZXN0ID0gUmVxdWVzdF8xO1xuXG5cdHZhciBwb2xsaW5nWGhyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcG9sbGluZ1hocixcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBvbGxpbmdYaHIsXG5cdFx0UmVxdWVzdDogUmVxdWVzdF8xXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgcmVxdWlyZW1lbnRzLlxuXHQgKi9cblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBwb2xsaW5nSnNvbnAgPSBKU09OUFBvbGxpbmc7XG5cblx0LyoqXG5cdCAqIENhY2hlZCByZWd1bGFyIGV4cHJlc3Npb25zLlxuXHQgKi9cblxuXHR2YXIgck5ld2xpbmUgPSAvXFxuL2c7XG5cdHZhciByRXNjYXBlZE5ld2xpbmUgPSAvXFxcXG4vZztcblxuXHQvKipcblx0ICogR2xvYmFsIEpTT05QIGNhbGxiYWNrcy5cblx0ICovXG5cblx0dmFyIGNhbGxiYWNrcztcblxuXHQvKipcblx0ICogTm9vcC5cblx0ICovXG5cblx0ZnVuY3Rpb24gZW1wdHkkMSgpIHt9XG5cblx0LyoqXG5cdCAqIEpTT05QIFBvbGxpbmcgY29uc3RydWN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBKU09OUFBvbGxpbmcob3B0cykge1xuXHQgIFBvbGxpbmckMS5jYWxsKHRoaXMsIG9wdHMpO1xuXG5cdCAgdGhpcy5xdWVyeSA9IHRoaXMucXVlcnkgfHwge307XG5cblx0ICAvLyBkZWZpbmUgZ2xvYmFsIGNhbGxiYWNrcyBhcnJheSBpZiBub3QgcHJlc2VudFxuXHQgIC8vIHdlIGRvIHRoaXMgaGVyZSAobGF6aWx5KSB0byBhdm9pZCB1bm5lZWRlZCBnbG9iYWwgcG9sbHV0aW9uXG5cdCAgaWYgKCFjYWxsYmFja3MpIHtcblx0ICAgIC8vIHdlIG5lZWQgdG8gY29uc2lkZXIgbXVsdGlwbGUgZW5naW5lcyBpbiB0aGUgc2FtZSBwYWdlXG5cdCAgICBpZiAoIWNvbW1vbmpzR2xvYmFsLl9fX2VpbykgY29tbW9uanNHbG9iYWwuX19fZWlvID0gW107XG5cdCAgICBjYWxsYmFja3MgPSBjb21tb25qc0dsb2JhbC5fX19laW87XG5cdCAgfVxuXG5cdCAgLy8gY2FsbGJhY2sgaWRlbnRpZmllclxuXHQgIHRoaXMuaW5kZXggPSBjYWxsYmFja3MubGVuZ3RoO1xuXG5cdCAgLy8gYWRkIGNhbGxiYWNrIHRvIGpzb25wIGdsb2JhbFxuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBjYWxsYmFja3MucHVzaChmdW5jdGlvbiAobXNnKSB7XG5cdCAgICBzZWxmLm9uRGF0YShtc2cpO1xuXHQgIH0pO1xuXG5cdCAgLy8gYXBwZW5kIHRvIHF1ZXJ5IHN0cmluZ1xuXHQgIHRoaXMucXVlcnkuaiA9IHRoaXMuaW5kZXg7XG5cblx0ICAvLyBwcmV2ZW50IHNwdXJpb3VzIGVycm9ycyBmcm9tIGJlaW5nIGVtaXR0ZWQgd2hlbiB0aGUgd2luZG93IGlzIHVubG9hZGVkXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmRvY3VtZW50ICYmIGNvbW1vbmpzR2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcblx0ICAgIGNvbW1vbmpzR2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHNlbGYuc2NyaXB0KSBzZWxmLnNjcmlwdC5vbmVycm9yID0gZW1wdHkkMTtcblx0ICAgIH0sIGZhbHNlKTtcblx0ICB9XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBQb2xsaW5nLlxuXHQgKi9cblxuXHRpbmhlcml0KEpTT05QUG9sbGluZywgUG9sbGluZyQxKTtcblxuXHQvKlxuXHQgKiBKU09OUCBvbmx5IHN1cHBvcnRzIGJpbmFyeSBhcyBiYXNlNjQgZW5jb2RlZCBzdHJpbmdzXG5cdCAqL1xuXG5cdEpTT05QUG9sbGluZy5wcm90b3R5cGUuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLmRvQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHRoaXMuc2NyaXB0KSB7XG5cdCAgICB0aGlzLnNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuc2NyaXB0KTtcblx0ICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblx0ICB9XG5cblx0ICBpZiAodGhpcy5mb3JtKSB7XG5cdCAgICB0aGlzLmZvcm0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmZvcm0pO1xuXHQgICAgdGhpcy5mb3JtID0gbnVsbDtcblx0ICAgIHRoaXMuaWZyYW1lID0gbnVsbDtcblx0ICB9XG5cblx0ICBQb2xsaW5nJDEucHJvdG90eXBlLmRvQ2xvc2UuY2FsbCh0aGlzKTtcblx0fTtcblxuXHQvKipcblx0ICogU3RhcnRzIGEgcG9sbCBjeWNsZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdEpTT05QUG9sbGluZy5wcm90b3R5cGUuZG9Qb2xsID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB2YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cblx0ICBpZiAodGhpcy5zY3JpcHQpIHtcblx0ICAgIHRoaXMuc2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5zY3JpcHQpO1xuXHQgICAgdGhpcy5zY3JpcHQgPSBudWxsO1xuXHQgIH1cblxuXHQgIHNjcmlwdC5hc3luYyA9IHRydWU7XG5cdCAgc2NyaXB0LnNyYyA9IHRoaXMudXJpKCk7XG5cdCAgc2NyaXB0Lm9uZXJyb3IgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgc2VsZi5vbkVycm9yKCdqc29ucCBwb2xsIGVycm9yJywgZSk7XG5cdCAgfTtcblxuXHQgIHZhciBpbnNlcnRBdCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXTtcblx0ICBpZiAoaW5zZXJ0QXQpIHtcblx0ICAgIGluc2VydEF0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHNjcmlwdCwgaW5zZXJ0QXQpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5ib2R5KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuXHQgIH1cblx0ICB0aGlzLnNjcmlwdCA9IHNjcmlwdDtcblxuXHQgIHZhciBpc1VBZ2Vja28gPSAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIG5hdmlnYXRvciAmJiAvZ2Vja28vaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cdCAgaWYgKGlzVUFnZWNrbykge1xuXHQgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIHZhciBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcblx0ICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuXHQgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlmcmFtZSk7XG5cdCAgICB9LCAxMDApO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogV3JpdGVzIHdpdGggYSBoaWRkZW4gaWZyYW1lLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGF0YSB0byBzZW5kXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxlZCB1cG9uIGZsdXNoLlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0SlNPTlBQb2xsaW5nLnByb3RvdHlwZS5kb1dyaXRlID0gZnVuY3Rpb24gKGRhdGEsIGZuKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgaWYgKCF0aGlzLmZvcm0pIHtcblx0ICAgIHZhciBmb3JtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZm9ybScpO1xuXHQgICAgdmFyIGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuXHQgICAgdmFyIGlkID0gdGhpcy5pZnJhbWVJZCA9ICdlaW9faWZyYW1lXycgKyB0aGlzLmluZGV4O1xuXHQgICAgdmFyIGlmcmFtZTtcblxuXHQgICAgZm9ybS5jbGFzc05hbWUgPSAnc29ja2V0aW8nO1xuXHQgICAgZm9ybS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdCAgICBmb3JtLnN0eWxlLnRvcCA9ICctMTAwMHB4Jztcblx0ICAgIGZvcm0uc3R5bGUubGVmdCA9ICctMTAwMHB4Jztcblx0ICAgIGZvcm0udGFyZ2V0ID0gaWQ7XG5cdCAgICBmb3JtLm1ldGhvZCA9ICdQT1NUJztcblx0ICAgIGZvcm0uc2V0QXR0cmlidXRlKCdhY2NlcHQtY2hhcnNldCcsICd1dGYtOCcpO1xuXHQgICAgYXJlYS5uYW1lID0gJ2QnO1xuXHQgICAgZm9ybS5hcHBlbmRDaGlsZChhcmVhKTtcblx0ICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZm9ybSk7XG5cblx0ICAgIHRoaXMuZm9ybSA9IGZvcm07XG5cdCAgICB0aGlzLmFyZWEgPSBhcmVhO1xuXHQgIH1cblxuXHQgIHRoaXMuZm9ybS5hY3Rpb24gPSB0aGlzLnVyaSgpO1xuXG5cdCAgZnVuY3Rpb24gY29tcGxldGUoKSB7XG5cdCAgICBpbml0SWZyYW1lKCk7XG5cdCAgICBmbigpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGluaXRJZnJhbWUoKSB7XG5cdCAgICBpZiAoc2VsZi5pZnJhbWUpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBzZWxmLmZvcm0ucmVtb3ZlQ2hpbGQoc2VsZi5pZnJhbWUpO1xuXHQgICAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgICAgc2VsZi5vbkVycm9yKCdqc29ucCBwb2xsaW5nIGlmcmFtZSByZW1vdmFsIGVycm9yJywgZSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgdHJ5IHtcblx0ICAgICAgLy8gaWU2IGR5bmFtaWMgaWZyYW1lcyB3aXRoIHRhcmdldD1cIlwiIHN1cHBvcnQgKHRoYW5rcyBDaHJpcyBMYW1iYWNoZXIpXG5cdCAgICAgIHZhciBodG1sID0gJzxpZnJhbWUgc3JjPVwiamF2YXNjcmlwdDowXCIgbmFtZT1cIicgKyBzZWxmLmlmcmFtZUlkICsgJ1wiPic7XG5cdCAgICAgIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoaHRtbCk7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuXHQgICAgICBpZnJhbWUubmFtZSA9IHNlbGYuaWZyYW1lSWQ7XG5cdCAgICAgIGlmcmFtZS5zcmMgPSAnamF2YXNjcmlwdDowJztcblx0ICAgIH1cblxuXHQgICAgaWZyYW1lLmlkID0gc2VsZi5pZnJhbWVJZDtcblxuXHQgICAgc2VsZi5mb3JtLmFwcGVuZENoaWxkKGlmcmFtZSk7XG5cdCAgICBzZWxmLmlmcmFtZSA9IGlmcmFtZTtcblx0ICB9XG5cblx0ICBpbml0SWZyYW1lKCk7XG5cblx0ICAvLyBlc2NhcGUgXFxuIHRvIHByZXZlbnQgaXQgZnJvbSBiZWluZyBjb252ZXJ0ZWQgaW50byBcXHJcXG4gYnkgc29tZSBVQXNcblx0ICAvLyBkb3VibGUgZXNjYXBpbmcgaXMgcmVxdWlyZWQgZm9yIGVzY2FwZWQgbmV3IGxpbmVzIGJlY2F1c2UgdW5lc2NhcGluZyBvZiBuZXcgbGluZXMgY2FuIGJlIGRvbmUgc2FmZWx5IG9uIHNlcnZlci1zaWRlXG5cdCAgZGF0YSA9IGRhdGEucmVwbGFjZShyRXNjYXBlZE5ld2xpbmUsICdcXFxcXFxuJyk7XG5cdCAgdGhpcy5hcmVhLnZhbHVlID0gZGF0YS5yZXBsYWNlKHJOZXdsaW5lLCAnXFxcXG4nKTtcblxuXHQgIHRyeSB7XG5cdCAgICB0aGlzLmZvcm0uc3VibWl0KCk7XG5cdCAgfSBjYXRjaCAoZSkge31cblxuXHQgIGlmICh0aGlzLmlmcmFtZS5hdHRhY2hFdmVudCkge1xuXHQgICAgdGhpcy5pZnJhbWUub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICBpZiAoc2VsZi5pZnJhbWUucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJykge1xuXHQgICAgICAgIGNvbXBsZXRlKCk7XG5cdCAgICAgIH1cblx0ICAgIH07XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRoaXMuaWZyYW1lLm9ubG9hZCA9IGNvbXBsZXRlO1xuXHQgIH1cblx0fTtcblxuXHR2YXIgcG9sbGluZ0pzb25wJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcG9sbGluZ0pzb25wLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogcG9sbGluZ0pzb25wXG5cdH0pO1xuXG5cdHZhciBlbXB0eSQyID0ge307XG5cblx0dmFyIGVtcHR5JDMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogZW1wdHkkMlxuXHR9KTtcblxuXHR2YXIgcmVxdWlyZSQkMSQxID0gKCBlbXB0eSQzICYmIGVtcHR5JDIgKSB8fCBlbXB0eSQzO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNSA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDp3ZWJzb2NrZXQnKTtcblx0dmFyIEJyb3dzZXJXZWJTb2NrZXQgPSBjb21tb25qc0dsb2JhbC5XZWJTb2NrZXQgfHwgY29tbW9uanNHbG9iYWwuTW96V2ViU29ja2V0O1xuXHR2YXIgTm9kZVdlYlNvY2tldDtcblx0aWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG5cdCAgdHJ5IHtcblx0ICAgIE5vZGVXZWJTb2NrZXQgPSByZXF1aXJlJCQxJDE7XG5cdCAgfSBjYXRjaCAoZSkge31cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgZWl0aGVyIHRoZSBgV2ViU29ja2V0YCBvciBgTW96V2ViU29ja2V0YCBnbG9iYWxzXG5cdCAqIGluIHRoZSBicm93c2VyIG9yIHRyeSB0byByZXNvbHZlIFdlYlNvY2tldC1jb21wYXRpYmxlXG5cdCAqIGludGVyZmFjZSBleHBvc2VkIGJ5IGB3c2AgZm9yIE5vZGUtbGlrZSBlbnZpcm9ubWVudC5cblx0ICovXG5cblx0dmFyIFdlYlNvY2tldCA9IEJyb3dzZXJXZWJTb2NrZXQ7XG5cdGlmICghV2ViU29ja2V0ICYmIHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG5cdCAgV2ViU29ja2V0ID0gTm9kZVdlYlNvY2tldDtcblx0fVxuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHdlYnNvY2tldCA9IFdTO1xuXG5cdC8qKlxuXHQgKiBXZWJTb2NrZXQgdHJhbnNwb3J0IGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAYXBpIHtPYmplY3R9IGNvbm5lY3Rpb24gb3B0aW9uc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBXUyhvcHRzKSB7XG5cdCAgdmFyIGZvcmNlQmFzZTY0ID0gb3B0cyAmJiBvcHRzLmZvcmNlQmFzZTY0O1xuXHQgIGlmIChmb3JjZUJhc2U2NCkge1xuXHQgICAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXHQgIH1cblx0ICB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlID0gb3B0cy5wZXJNZXNzYWdlRGVmbGF0ZTtcblx0ICB0aGlzLnVzaW5nQnJvd3NlcldlYlNvY2tldCA9IEJyb3dzZXJXZWJTb2NrZXQgJiYgIW9wdHMuZm9yY2VOb2RlO1xuXHQgIHRoaXMucHJvdG9jb2xzID0gb3B0cy5wcm90b2NvbHM7XG5cdCAgaWYgKCF0aGlzLnVzaW5nQnJvd3NlcldlYlNvY2tldCkge1xuXHQgICAgV2ViU29ja2V0ID0gTm9kZVdlYlNvY2tldDtcblx0ICB9XG5cdCAgVHJhbnNwb3J0JDEuY2FsbCh0aGlzLCBvcHRzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0cyBmcm9tIFRyYW5zcG9ydC5cblx0ICovXG5cblx0aW5oZXJpdChXUywgVHJhbnNwb3J0JDEpO1xuXG5cdC8qKlxuXHQgKiBUcmFuc3BvcnQgbmFtZS5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0V1MucHJvdG90eXBlLm5hbWUgPSAnd2Vic29ja2V0JztcblxuXHQvKlxuXHQgKiBXZWJTb2NrZXRzIHN1cHBvcnQgYmluYXJ5XG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5zdXBwb3J0c0JpbmFyeSA9IHRydWU7XG5cblx0LyoqXG5cdCAqIE9wZW5zIHNvY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5kb09wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCF0aGlzLmNoZWNrKCkpIHtcblx0ICAgIC8vIGxldCBwcm9iZSB0aW1lb3V0XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdmFyIHVyaSA9IHRoaXMudXJpKCk7XG5cdCAgdmFyIHByb3RvY29scyA9IHRoaXMucHJvdG9jb2xzO1xuXHQgIHZhciBvcHRzID0ge1xuXHQgICAgYWdlbnQ6IHRoaXMuYWdlbnQsXG5cdCAgICBwZXJNZXNzYWdlRGVmbGF0ZTogdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZVxuXHQgIH07XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLnBmeCA9IHRoaXMucGZ4O1xuXHQgIG9wdHMua2V5ID0gdGhpcy5rZXk7XG5cdCAgb3B0cy5wYXNzcGhyYXNlID0gdGhpcy5wYXNzcGhyYXNlO1xuXHQgIG9wdHMuY2VydCA9IHRoaXMuY2VydDtcblx0ICBvcHRzLmNhID0gdGhpcy5jYTtcblx0ICBvcHRzLmNpcGhlcnMgPSB0aGlzLmNpcGhlcnM7XG5cdCAgb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPSB0aGlzLnJlamVjdFVuYXV0aG9yaXplZDtcblx0ICBpZiAodGhpcy5leHRyYUhlYWRlcnMpIHtcblx0ICAgIG9wdHMuaGVhZGVycyA9IHRoaXMuZXh0cmFIZWFkZXJzO1xuXHQgIH1cblx0ICBpZiAodGhpcy5sb2NhbEFkZHJlc3MpIHtcblx0ICAgIG9wdHMubG9jYWxBZGRyZXNzID0gdGhpcy5sb2NhbEFkZHJlc3M7XG5cdCAgfVxuXG5cdCAgdHJ5IHtcblx0ICAgIHRoaXMud3MgPSB0aGlzLnVzaW5nQnJvd3NlcldlYlNvY2tldCA/IHByb3RvY29scyA/IG5ldyBXZWJTb2NrZXQodXJpLCBwcm90b2NvbHMpIDogbmV3IFdlYlNvY2tldCh1cmkpIDogbmV3IFdlYlNvY2tldCh1cmksIHByb3RvY29scywgb3B0cyk7XG5cdCAgfSBjYXRjaCAoZXJyKSB7XG5cdCAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG5cdCAgfVxuXG5cdCAgaWYgKHRoaXMud3MuYmluYXJ5VHlwZSA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cdCAgfVxuXG5cdCAgaWYgKHRoaXMud3Muc3VwcG9ydHMgJiYgdGhpcy53cy5zdXBwb3J0cy5iaW5hcnkpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSB0cnVlO1xuXHQgICAgdGhpcy53cy5iaW5hcnlUeXBlID0gJ25vZGVidWZmZXInO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLndzLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXHQgIH1cblxuXHQgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcblx0fTtcblxuXHQvKipcblx0ICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIHNvY2tldFxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXJzID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIHRoaXMud3Mub25vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbk9wZW4oKTtcblx0ICB9O1xuXHQgIHRoaXMud3Mub25jbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25DbG9zZSgpO1xuXHQgIH07XG5cdCAgdGhpcy53cy5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZXYpIHtcblx0ICAgIHNlbGYub25EYXRhKGV2LmRhdGEpO1xuXHQgIH07XG5cdCAgdGhpcy53cy5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgIHNlbGYub25FcnJvcignd2Vic29ja2V0IGVycm9yJywgZSk7XG5cdCAgfTtcblx0fTtcblxuXHQvKipcblx0ICogV3JpdGVzIGRhdGEgdG8gc29ja2V0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBvZiBwYWNrZXRzLlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHBhY2tldHMpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXG5cdCAgLy8gZW5jb2RlUGFja2V0IGVmZmljaWVudCBhcyBpdCB1c2VzIFdTIGZyYW1pbmdcblx0ICAvLyBubyBuZWVkIGZvciBlbmNvZGVQYXlsb2FkXG5cdCAgdmFyIHRvdGFsID0gcGFja2V0cy5sZW5ndGg7XG5cdCAgZm9yICh2YXIgaSA9IDAsIGwgPSB0b3RhbDsgaSA8IGw7IGkrKykge1xuXHQgICAgKGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgICAgcGFyc2VyLmVuY29kZVBhY2tldChwYWNrZXQsIHNlbGYuc3VwcG9ydHNCaW5hcnksIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICAgICAgaWYgKCFzZWxmLnVzaW5nQnJvd3NlcldlYlNvY2tldCkge1xuXHQgICAgICAgICAgLy8gYWx3YXlzIGNyZWF0ZSBhIG5ldyBvYmplY3QgKEdILTQzNylcblx0ICAgICAgICAgIHZhciBvcHRzID0ge307XG5cdCAgICAgICAgICBpZiAocGFja2V0Lm9wdGlvbnMpIHtcblx0ICAgICAgICAgICAgb3B0cy5jb21wcmVzcyA9IHBhY2tldC5vcHRpb25zLmNvbXByZXNzO1xuXHQgICAgICAgICAgfVxuXG5cdCAgICAgICAgICBpZiAoc2VsZi5wZXJNZXNzYWdlRGVmbGF0ZSkge1xuXHQgICAgICAgICAgICB2YXIgbGVuID0gJ3N0cmluZycgPT09IHR5cGVvZiBkYXRhID8gY29tbW9uanNHbG9iYWwuQnVmZmVyLmJ5dGVMZW5ndGgoZGF0YSkgOiBkYXRhLmxlbmd0aDtcblx0ICAgICAgICAgICAgaWYgKGxlbiA8IHNlbGYucGVyTWVzc2FnZURlZmxhdGUudGhyZXNob2xkKSB7XG5cdCAgICAgICAgICAgICAgb3B0cy5jb21wcmVzcyA9IGZhbHNlO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgLy8gU29tZXRpbWVzIHRoZSB3ZWJzb2NrZXQgaGFzIGFscmVhZHkgYmVlbiBjbG9zZWQgYnV0IHRoZSBicm93c2VyIGRpZG4ndFxuXHQgICAgICAgIC8vIGhhdmUgYSBjaGFuY2Ugb2YgaW5mb3JtaW5nIHVzIGFib3V0IGl0IHlldCwgaW4gdGhhdCBjYXNlIHNlbmQgd2lsbFxuXHQgICAgICAgIC8vIHRocm93IGFuIGVycm9yXG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIGlmIChzZWxmLnVzaW5nQnJvd3NlcldlYlNvY2tldCkge1xuXHQgICAgICAgICAgICAvLyBUeXBlRXJyb3IgaXMgdGhyb3duIHdoZW4gcGFzc2luZyB0aGUgc2Vjb25kIGFyZ3VtZW50IG9uIFNhZmFyaVxuXHQgICAgICAgICAgICBzZWxmLndzLnNlbmQoZGF0YSk7XG5cdCAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICBzZWxmLndzLnNlbmQoZGF0YSwgb3B0cyk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgZGVidWckNSgnd2Vic29ja2V0IGNsb3NlZCBiZWZvcmUgb25jbG9zZSBldmVudCcpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIC0tdG90YWwgfHwgZG9uZSgpO1xuXHQgICAgICB9KTtcblx0ICAgIH0pKHBhY2tldHNbaV0pO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGRvbmUoKSB7XG5cdCAgICBzZWxmLmVtaXQoJ2ZsdXNoJyk7XG5cblx0ICAgIC8vIGZha2UgZHJhaW5cblx0ICAgIC8vIGRlZmVyIHRvIG5leHQgdGljayB0byBhbGxvdyBTb2NrZXQgdG8gY2xlYXIgd3JpdGVCdWZmZXJcblx0ICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBzZWxmLndyaXRhYmxlID0gdHJ1ZTtcblx0ICAgICAgc2VsZi5lbWl0KCdkcmFpbicpO1xuXHQgICAgfSwgMCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBjbG9zZVxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLm9uQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgVHJhbnNwb3J0JDEucHJvdG90eXBlLm9uQ2xvc2UuY2FsbCh0aGlzKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2xvc2VzIHNvY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5kb0Nsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0eXBlb2YgdGhpcy53cyAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0ICAgIHRoaXMud3MuY2xvc2UoKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEdlbmVyYXRlcyB1cmkgZm9yIGNvbm5lY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUudXJpID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBxdWVyeSA9IHRoaXMucXVlcnkgfHwge307XG5cdCAgdmFyIHNjaGVtYSA9IHRoaXMuc2VjdXJlID8gJ3dzcycgOiAnd3MnO1xuXHQgIHZhciBwb3J0ID0gJyc7XG5cblx0ICAvLyBhdm9pZCBwb3J0IGlmIGRlZmF1bHQgZm9yIHNjaGVtYVxuXHQgIGlmICh0aGlzLnBvcnQgJiYgKCd3c3MnID09PSBzY2hlbWEgJiYgTnVtYmVyKHRoaXMucG9ydCkgIT09IDQ0MyB8fCAnd3MnID09PSBzY2hlbWEgJiYgTnVtYmVyKHRoaXMucG9ydCkgIT09IDgwKSkge1xuXHQgICAgcG9ydCA9ICc6JyArIHRoaXMucG9ydDtcblx0ICB9XG5cblx0ICAvLyBhcHBlbmQgdGltZXN0YW1wIHRvIFVSSVxuXHQgIGlmICh0aGlzLnRpbWVzdGFtcFJlcXVlc3RzKSB7XG5cdCAgICBxdWVyeVt0aGlzLnRpbWVzdGFtcFBhcmFtXSA9IHllYXN0JDIoKTtcblx0ICB9XG5cblx0ICAvLyBjb21tdW5pY2F0ZSBiaW5hcnkgc3VwcG9ydCBjYXBhYmlsaXRpZXNcblx0ICBpZiAoIXRoaXMuc3VwcG9ydHNCaW5hcnkpIHtcblx0ICAgIHF1ZXJ5LmI2NCA9IDE7XG5cdCAgfVxuXG5cdCAgcXVlcnkgPSBwYXJzZXFzJDIuZW5jb2RlKHF1ZXJ5KTtcblxuXHQgIC8vIHByZXBlbmQgPyB0byBxdWVyeVxuXHQgIGlmIChxdWVyeS5sZW5ndGgpIHtcblx0ICAgIHF1ZXJ5ID0gJz8nICsgcXVlcnk7XG5cdCAgfVxuXG5cdCAgdmFyIGlwdjYgPSB0aGlzLmhvc3RuYW1lLmluZGV4T2YoJzonKSAhPT0gLTE7XG5cdCAgcmV0dXJuIHNjaGVtYSArICc6Ly8nICsgKGlwdjYgPyAnWycgKyB0aGlzLmhvc3RuYW1lICsgJ10nIDogdGhpcy5ob3N0bmFtZSkgKyBwb3J0ICsgdGhpcy5wYXRoICsgcXVlcnk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEZlYXR1cmUgZGV0ZWN0aW9uIGZvciBXZWJTb2NrZXQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IHdoZXRoZXIgdGhpcyB0cmFuc3BvcnQgaXMgYXZhaWxhYmxlLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuY2hlY2sgPSBmdW5jdGlvbiAoKSB7XG5cdCAgcmV0dXJuICEhV2ViU29ja2V0ICYmICEoJ19faW5pdGlhbGl6ZScgaW4gV2ViU29ja2V0ICYmIHRoaXMubmFtZSA9PT0gV1MucHJvdG90eXBlLm5hbWUpO1xuXHR9O1xuXG5cdHZhciB3ZWJzb2NrZXQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB3ZWJzb2NrZXQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB3ZWJzb2NrZXRcblx0fSk7XG5cblx0dmFyIFhIUiQxID0gKCBwb2xsaW5nWGhyJDEgJiYgcG9sbGluZ1hociApIHx8IHBvbGxpbmdYaHIkMTtcblxuXHR2YXIgSlNPTlAgPSAoIHBvbGxpbmdKc29ucCQxICYmIHBvbGxpbmdKc29ucCApIHx8IHBvbGxpbmdKc29ucCQxO1xuXG5cdHZhciB3ZWJzb2NrZXQkMiA9ICggd2Vic29ja2V0JDEgJiYgd2Vic29ja2V0ICkgfHwgd2Vic29ja2V0JDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcblx0ICovXG5cblx0LyoqXG5cdCAqIEV4cG9ydCB0cmFuc3BvcnRzLlxuXHQgKi9cblxuXHR2YXIgcG9sbGluZ18xID0gcG9sbGluZyQyO1xuXHR2YXIgd2Vic29ja2V0XzEgPSB3ZWJzb2NrZXQkMjtcblxuXHQvKipcblx0ICogUG9sbGluZyB0cmFuc3BvcnQgcG9seW1vcnBoaWMgY29uc3RydWN0b3IuXG5cdCAqIERlY2lkZXMgb24geGhyIHZzIGpzb25wIGJhc2VkIG9uIGZlYXR1cmUgZGV0ZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gcG9sbGluZyQyKG9wdHMpIHtcblx0ICB2YXIgeGhyO1xuXHQgIHZhciB4ZCA9IGZhbHNlO1xuXHQgIHZhciB4cyA9IGZhbHNlO1xuXHQgIHZhciBqc29ucCA9IGZhbHNlICE9PSBvcHRzLmpzb25wO1xuXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uKSB7XG5cdCAgICB2YXIgaXNTU0wgPSAnaHR0cHM6JyA9PT0gbG9jYXRpb24ucHJvdG9jb2w7XG5cdCAgICB2YXIgcG9ydCA9IGxvY2F0aW9uLnBvcnQ7XG5cblx0ICAgIC8vIHNvbWUgdXNlciBhZ2VudHMgaGF2ZSBlbXB0eSBgbG9jYXRpb24ucG9ydGBcblx0ICAgIGlmICghcG9ydCkge1xuXHQgICAgICBwb3J0ID0gaXNTU0wgPyA0NDMgOiA4MDtcblx0ICAgIH1cblxuXHQgICAgeGQgPSBvcHRzLmhvc3RuYW1lICE9PSBsb2NhdGlvbi5ob3N0bmFtZSB8fCBwb3J0ICE9PSBvcHRzLnBvcnQ7XG5cdCAgICB4cyA9IG9wdHMuc2VjdXJlICE9PSBpc1NTTDtcblx0ICB9XG5cblx0ICBvcHRzLnhkb21haW4gPSB4ZDtcblx0ICBvcHRzLnhzY2hlbWUgPSB4cztcblx0ICB4aHIgPSBuZXcgcmVxdWlyZSQkMShvcHRzKTtcblxuXHQgIGlmICgnb3BlbicgaW4geGhyICYmICFvcHRzLmZvcmNlSlNPTlApIHtcblx0ICAgIHJldHVybiBuZXcgWEhSJDEob3B0cyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIGlmICghanNvbnApIHRocm93IG5ldyBFcnJvcignSlNPTlAgZGlzYWJsZWQnKTtcblx0ICAgIHJldHVybiBuZXcgSlNPTlAob3B0cyk7XG5cdCAgfVxuXHR9XG5cblx0dmFyIHRyYW5zcG9ydHMgPSB7XG5cdCAgcG9sbGluZzogcG9sbGluZ18xLFxuXHQgIHdlYnNvY2tldDogd2Vic29ja2V0XzFcblx0fTtcblxuXHR2YXIgdHJhbnNwb3J0cyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHRyYW5zcG9ydHMsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB0cmFuc3BvcnRzLFxuXHRcdHBvbGxpbmc6IHBvbGxpbmdfMSxcblx0XHR3ZWJzb2NrZXQ6IHdlYnNvY2tldF8xXG5cdH0pO1xuXG5cdHZhciBpbmRleE9mID0gW10uaW5kZXhPZjtcblxuXHR2YXIgaW5kZXhvZiA9IGZ1bmN0aW9uIGluZGV4b2YoYXJyLCBvYmopIHtcblx0ICBpZiAoaW5kZXhPZikgcmV0dXJuIGFyci5pbmRleE9mKG9iaik7XG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyArK2kpIHtcblx0ICAgIGlmIChhcnJbaV0gPT09IG9iaikgcmV0dXJuIGk7XG5cdCAgfVxuXHQgIHJldHVybiAtMTtcblx0fTtcblxuXHR2YXIgaW5kZXhvZiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGluZGV4b2YsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBpbmRleG9mXG5cdH0pO1xuXG5cdHZhciB0cmFuc3BvcnRzJDIgPSAoIHRyYW5zcG9ydHMkMSAmJiB0cmFuc3BvcnRzICkgfHwgdHJhbnNwb3J0cyQxO1xuXG5cdHZhciBpbmRleCA9ICggaW5kZXhvZiQxICYmIGluZGV4b2YgKSB8fCBpbmRleG9mJDE7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAqL1xuXG5cdHZhciBkZWJ1ZyQ2ID0gcmVxdWlyZSQkMCQyKCdlbmdpbmUuaW8tY2xpZW50OnNvY2tldCcpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHNvY2tldCA9IFNvY2tldDtcblxuXHQvKipcblx0ICogU29ja2V0IGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IHVyaSBvciBvcHRpb25zXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFNvY2tldCh1cmksIG9wdHMpIHtcblx0ICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU29ja2V0KSkgcmV0dXJuIG5ldyBTb2NrZXQodXJpLCBvcHRzKTtcblxuXHQgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdCAgaWYgKHVyaSAmJiAnb2JqZWN0JyA9PT0gKHR5cGVvZiB1cmkgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHVyaSkpKSB7XG5cdCAgICBvcHRzID0gdXJpO1xuXHQgICAgdXJpID0gbnVsbDtcblx0ICB9XG5cblx0ICBpZiAodXJpKSB7XG5cdCAgICB1cmkgPSBwYXJzZXVyaSQyKHVyaSk7XG5cdCAgICBvcHRzLmhvc3RuYW1lID0gdXJpLmhvc3Q7XG5cdCAgICBvcHRzLnNlY3VyZSA9IHVyaS5wcm90b2NvbCA9PT0gJ2h0dHBzJyB8fCB1cmkucHJvdG9jb2wgPT09ICd3c3MnO1xuXHQgICAgb3B0cy5wb3J0ID0gdXJpLnBvcnQ7XG5cdCAgICBpZiAodXJpLnF1ZXJ5KSBvcHRzLnF1ZXJ5ID0gdXJpLnF1ZXJ5O1xuXHQgIH0gZWxzZSBpZiAob3B0cy5ob3N0KSB7XG5cdCAgICBvcHRzLmhvc3RuYW1lID0gcGFyc2V1cmkkMihvcHRzLmhvc3QpLmhvc3Q7XG5cdCAgfVxuXG5cdCAgdGhpcy5zZWN1cmUgPSBudWxsICE9IG9wdHMuc2VjdXJlID8gb3B0cy5zZWN1cmUgOiBjb21tb25qc0dsb2JhbC5sb2NhdGlvbiAmJiAnaHR0cHM6JyA9PT0gbG9jYXRpb24ucHJvdG9jb2w7XG5cblx0ICBpZiAob3B0cy5ob3N0bmFtZSAmJiAhb3B0cy5wb3J0KSB7XG5cdCAgICAvLyBpZiBubyBwb3J0IGlzIHNwZWNpZmllZCBtYW51YWxseSwgdXNlIHRoZSBwcm90b2NvbCBkZWZhdWx0XG5cdCAgICBvcHRzLnBvcnQgPSB0aGlzLnNlY3VyZSA/ICc0NDMnIDogJzgwJztcblx0ICB9XG5cblx0ICB0aGlzLmFnZW50ID0gb3B0cy5hZ2VudCB8fCBmYWxzZTtcblx0ICB0aGlzLmhvc3RuYW1lID0gb3B0cy5ob3N0bmFtZSB8fCAoY29tbW9uanNHbG9iYWwubG9jYXRpb24gPyBsb2NhdGlvbi5ob3N0bmFtZSA6ICdsb2NhbGhvc3QnKTtcblx0ICB0aGlzLnBvcnQgPSBvcHRzLnBvcnQgfHwgKGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uICYmIGxvY2F0aW9uLnBvcnQgPyBsb2NhdGlvbi5wb3J0IDogdGhpcy5zZWN1cmUgPyA0NDMgOiA4MCk7XG5cdCAgdGhpcy5xdWVyeSA9IG9wdHMucXVlcnkgfHwge307XG5cdCAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgdGhpcy5xdWVyeSkgdGhpcy5xdWVyeSA9IHBhcnNlcXMkMi5kZWNvZGUodGhpcy5xdWVyeSk7XG5cdCAgdGhpcy51cGdyYWRlID0gZmFsc2UgIT09IG9wdHMudXBncmFkZTtcblx0ICB0aGlzLnBhdGggPSAob3B0cy5wYXRoIHx8ICcvZW5naW5lLmlvJykucmVwbGFjZSgvXFwvJC8sICcnKSArICcvJztcblx0ICB0aGlzLmZvcmNlSlNPTlAgPSAhIW9wdHMuZm9yY2VKU09OUDtcblx0ICB0aGlzLmpzb25wID0gZmFsc2UgIT09IG9wdHMuanNvbnA7XG5cdCAgdGhpcy5mb3JjZUJhc2U2NCA9ICEhb3B0cy5mb3JjZUJhc2U2NDtcblx0ICB0aGlzLmVuYWJsZXNYRFIgPSAhIW9wdHMuZW5hYmxlc1hEUjtcblx0ICB0aGlzLnRpbWVzdGFtcFBhcmFtID0gb3B0cy50aW1lc3RhbXBQYXJhbSB8fCAndCc7XG5cdCAgdGhpcy50aW1lc3RhbXBSZXF1ZXN0cyA9IG9wdHMudGltZXN0YW1wUmVxdWVzdHM7XG5cdCAgdGhpcy50cmFuc3BvcnRzID0gb3B0cy50cmFuc3BvcnRzIHx8IFsncG9sbGluZycsICd3ZWJzb2NrZXQnXTtcblx0ICB0aGlzLnRyYW5zcG9ydE9wdGlvbnMgPSBvcHRzLnRyYW5zcG9ydE9wdGlvbnMgfHwge307XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJyc7XG5cdCAgdGhpcy53cml0ZUJ1ZmZlciA9IFtdO1xuXHQgIHRoaXMucHJldkJ1ZmZlckxlbiA9IDA7XG5cdCAgdGhpcy5wb2xpY3lQb3J0ID0gb3B0cy5wb2xpY3lQb3J0IHx8IDg0Mztcblx0ICB0aGlzLnJlbWVtYmVyVXBncmFkZSA9IG9wdHMucmVtZW1iZXJVcGdyYWRlIHx8IGZhbHNlO1xuXHQgIHRoaXMuYmluYXJ5VHlwZSA9IG51bGw7XG5cdCAgdGhpcy5vbmx5QmluYXJ5VXBncmFkZXMgPSBvcHRzLm9ubHlCaW5hcnlVcGdyYWRlcztcblx0ICB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlID0gZmFsc2UgIT09IG9wdHMucGVyTWVzc2FnZURlZmxhdGUgPyBvcHRzLnBlck1lc3NhZ2VEZWZsYXRlIHx8IHt9IDogZmFsc2U7XG5cblx0ICBpZiAodHJ1ZSA9PT0gdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSkgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSA9IHt9O1xuXHQgIGlmICh0aGlzLnBlck1lc3NhZ2VEZWZsYXRlICYmIG51bGwgPT0gdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZS50aHJlc2hvbGQpIHtcblx0ICAgIHRoaXMucGVyTWVzc2FnZURlZmxhdGUudGhyZXNob2xkID0gMTAyNDtcblx0ICB9XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLnBmeCA9IG9wdHMucGZ4IHx8IG51bGw7XG5cdCAgdGhpcy5rZXkgPSBvcHRzLmtleSB8fCBudWxsO1xuXHQgIHRoaXMucGFzc3BocmFzZSA9IG9wdHMucGFzc3BocmFzZSB8fCBudWxsO1xuXHQgIHRoaXMuY2VydCA9IG9wdHMuY2VydCB8fCBudWxsO1xuXHQgIHRoaXMuY2EgPSBvcHRzLmNhIHx8IG51bGw7XG5cdCAgdGhpcy5jaXBoZXJzID0gb3B0cy5jaXBoZXJzIHx8IG51bGw7XG5cdCAgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQgPSBvcHRzLnJlamVjdFVuYXV0aG9yaXplZCA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IG9wdHMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIHRoaXMuZm9yY2VOb2RlID0gISFvcHRzLmZvcmNlTm9kZTtcblxuXHQgIC8vIG90aGVyIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdmFyIGZyZWVHbG9iYWwgPSBfdHlwZW9mKGNvbW1vbmpzR2xvYmFsKSA9PT0gJ29iamVjdCcgJiYgY29tbW9uanNHbG9iYWw7XG5cdCAgaWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsKSB7XG5cdCAgICBpZiAob3B0cy5leHRyYUhlYWRlcnMgJiYgT2JqZWN0LmtleXMob3B0cy5leHRyYUhlYWRlcnMpLmxlbmd0aCA+IDApIHtcblx0ICAgICAgdGhpcy5leHRyYUhlYWRlcnMgPSBvcHRzLmV4dHJhSGVhZGVycztcblx0ICAgIH1cblxuXHQgICAgaWYgKG9wdHMubG9jYWxBZGRyZXNzKSB7XG5cdCAgICAgIHRoaXMubG9jYWxBZGRyZXNzID0gb3B0cy5sb2NhbEFkZHJlc3M7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLy8gc2V0IG9uIGhhbmRzaGFrZVxuXHQgIHRoaXMuaWQgPSBudWxsO1xuXHQgIHRoaXMudXBncmFkZXMgPSBudWxsO1xuXHQgIHRoaXMucGluZ0ludGVydmFsID0gbnVsbDtcblx0ICB0aGlzLnBpbmdUaW1lb3V0ID0gbnVsbDtcblxuXHQgIC8vIHNldCBvbiBoZWFydGJlYXRcblx0ICB0aGlzLnBpbmdJbnRlcnZhbFRpbWVyID0gbnVsbDtcblx0ICB0aGlzLnBpbmdUaW1lb3V0VGltZXIgPSBudWxsO1xuXG5cdCAgdGhpcy5vcGVuKCk7XG5cdH1cblxuXHRTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIE1peCBpbiBgRW1pdHRlcmAuXG5cdCAqL1xuXG5cdEVtaXR0ZXIoU29ja2V0LnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIFByb3RvY29sIHZlcnNpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b2NvbCA9IHBhcnNlci5wcm90b2NvbDsgLy8gdGhpcyBpcyBhbiBpbnRcblxuXHQvKipcblx0ICogRXhwb3NlIGRlcHMgZm9yIGxlZ2FjeSBjb21wYXRpYmlsaXR5XG5cdCAqIGFuZCBzdGFuZGFsb25lIGJyb3dzZXIgYWNjZXNzLlxuXHQgKi9cblxuXHRTb2NrZXQuU29ja2V0ID0gU29ja2V0O1xuXHRTb2NrZXQuVHJhbnNwb3J0ID0gVHJhbnNwb3J0JDE7XG5cdFNvY2tldC50cmFuc3BvcnRzID0gdHJhbnNwb3J0cyQyO1xuXHRTb2NrZXQucGFyc2VyID0gcGFyc2VyO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIHRyYW5zcG9ydCBvZiB0aGUgZ2l2ZW4gdHlwZS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHRyYW5zcG9ydCBuYW1lXG5cdCAqIEByZXR1cm4ge1RyYW5zcG9ydH1cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuY3JlYXRlVHJhbnNwb3J0ID0gZnVuY3Rpb24gKG5hbWUpIHtcblx0ICBkZWJ1ZyQ2KCdjcmVhdGluZyB0cmFuc3BvcnQgXCIlc1wiJywgbmFtZSk7XG5cdCAgdmFyIHF1ZXJ5ID0gY2xvbmUodGhpcy5xdWVyeSk7XG5cblx0ICAvLyBhcHBlbmQgZW5naW5lLmlvIHByb3RvY29sIGlkZW50aWZpZXJcblx0ICBxdWVyeS5FSU8gPSBwYXJzZXIucHJvdG9jb2w7XG5cblx0ICAvLyB0cmFuc3BvcnQgbmFtZVxuXHQgIHF1ZXJ5LnRyYW5zcG9ydCA9IG5hbWU7XG5cblx0ICAvLyBwZXItdHJhbnNwb3J0IG9wdGlvbnNcblx0ICB2YXIgb3B0aW9ucyA9IHRoaXMudHJhbnNwb3J0T3B0aW9uc1tuYW1lXSB8fCB7fTtcblxuXHQgIC8vIHNlc3Npb24gaWQgaWYgd2UgYWxyZWFkeSBoYXZlIG9uZVxuXHQgIGlmICh0aGlzLmlkKSBxdWVyeS5zaWQgPSB0aGlzLmlkO1xuXG5cdCAgdmFyIHRyYW5zcG9ydCA9IG5ldyB0cmFuc3BvcnRzJDJbbmFtZV0oe1xuXHQgICAgcXVlcnk6IHF1ZXJ5LFxuXHQgICAgc29ja2V0OiB0aGlzLFxuXHQgICAgYWdlbnQ6IG9wdGlvbnMuYWdlbnQgfHwgdGhpcy5hZ2VudCxcblx0ICAgIGhvc3RuYW1lOiBvcHRpb25zLmhvc3RuYW1lIHx8IHRoaXMuaG9zdG5hbWUsXG5cdCAgICBwb3J0OiBvcHRpb25zLnBvcnQgfHwgdGhpcy5wb3J0LFxuXHQgICAgc2VjdXJlOiBvcHRpb25zLnNlY3VyZSB8fCB0aGlzLnNlY3VyZSxcblx0ICAgIHBhdGg6IG9wdGlvbnMucGF0aCB8fCB0aGlzLnBhdGgsXG5cdCAgICBmb3JjZUpTT05QOiBvcHRpb25zLmZvcmNlSlNPTlAgfHwgdGhpcy5mb3JjZUpTT05QLFxuXHQgICAganNvbnA6IG9wdGlvbnMuanNvbnAgfHwgdGhpcy5qc29ucCxcblx0ICAgIGZvcmNlQmFzZTY0OiBvcHRpb25zLmZvcmNlQmFzZTY0IHx8IHRoaXMuZm9yY2VCYXNlNjQsXG5cdCAgICBlbmFibGVzWERSOiBvcHRpb25zLmVuYWJsZXNYRFIgfHwgdGhpcy5lbmFibGVzWERSLFxuXHQgICAgdGltZXN0YW1wUmVxdWVzdHM6IG9wdGlvbnMudGltZXN0YW1wUmVxdWVzdHMgfHwgdGhpcy50aW1lc3RhbXBSZXF1ZXN0cyxcblx0ICAgIHRpbWVzdGFtcFBhcmFtOiBvcHRpb25zLnRpbWVzdGFtcFBhcmFtIHx8IHRoaXMudGltZXN0YW1wUGFyYW0sXG5cdCAgICBwb2xpY3lQb3J0OiBvcHRpb25zLnBvbGljeVBvcnQgfHwgdGhpcy5wb2xpY3lQb3J0LFxuXHQgICAgcGZ4OiBvcHRpb25zLnBmeCB8fCB0aGlzLnBmeCxcblx0ICAgIGtleTogb3B0aW9ucy5rZXkgfHwgdGhpcy5rZXksXG5cdCAgICBwYXNzcGhyYXNlOiBvcHRpb25zLnBhc3NwaHJhc2UgfHwgdGhpcy5wYXNzcGhyYXNlLFxuXHQgICAgY2VydDogb3B0aW9ucy5jZXJ0IHx8IHRoaXMuY2VydCxcblx0ICAgIGNhOiBvcHRpb25zLmNhIHx8IHRoaXMuY2EsXG5cdCAgICBjaXBoZXJzOiBvcHRpb25zLmNpcGhlcnMgfHwgdGhpcy5jaXBoZXJzLFxuXHQgICAgcmVqZWN0VW5hdXRob3JpemVkOiBvcHRpb25zLnJlamVjdFVuYXV0aG9yaXplZCB8fCB0aGlzLnJlamVjdFVuYXV0aG9yaXplZCxcblx0ICAgIHBlck1lc3NhZ2VEZWZsYXRlOiBvcHRpb25zLnBlck1lc3NhZ2VEZWZsYXRlIHx8IHRoaXMucGVyTWVzc2FnZURlZmxhdGUsXG5cdCAgICBleHRyYUhlYWRlcnM6IG9wdGlvbnMuZXh0cmFIZWFkZXJzIHx8IHRoaXMuZXh0cmFIZWFkZXJzLFxuXHQgICAgZm9yY2VOb2RlOiBvcHRpb25zLmZvcmNlTm9kZSB8fCB0aGlzLmZvcmNlTm9kZSxcblx0ICAgIGxvY2FsQWRkcmVzczogb3B0aW9ucy5sb2NhbEFkZHJlc3MgfHwgdGhpcy5sb2NhbEFkZHJlc3MsXG5cdCAgICByZXF1ZXN0VGltZW91dDogb3B0aW9ucy5yZXF1ZXN0VGltZW91dCB8fCB0aGlzLnJlcXVlc3RUaW1lb3V0LFxuXHQgICAgcHJvdG9jb2xzOiBvcHRpb25zLnByb3RvY29scyB8fCB2b2lkIDBcblx0ICB9KTtcblxuXHQgIHJldHVybiB0cmFuc3BvcnQ7XG5cdH07XG5cblx0ZnVuY3Rpb24gY2xvbmUob2JqKSB7XG5cdCAgdmFyIG8gPSB7fTtcblx0ICBmb3IgKHZhciBpIGluIG9iaikge1xuXHQgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHQgICAgICBvW2ldID0gb2JqW2ldO1xuXHQgICAgfVxuXHQgIH1cblx0ICByZXR1cm4gbztcblx0fVxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0cmFuc3BvcnQgdG8gdXNlIGFuZCBzdGFydHMgcHJvYmUuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblx0U29ja2V0LnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciB0cmFuc3BvcnQ7XG5cdCAgaWYgKHRoaXMucmVtZW1iZXJVcGdyYWRlICYmIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgJiYgdGhpcy50cmFuc3BvcnRzLmluZGV4T2YoJ3dlYnNvY2tldCcpICE9PSAtMSkge1xuXHQgICAgdHJhbnNwb3J0ID0gJ3dlYnNvY2tldCc7XG5cdCAgfSBlbHNlIGlmICgwID09PSB0aGlzLnRyYW5zcG9ydHMubGVuZ3RoKSB7XG5cdCAgICAvLyBFbWl0IGVycm9yIG9uIG5leHQgdGljayBzbyBpdCBjYW4gYmUgbGlzdGVuZWQgdG9cblx0ICAgIHZhciBzZWxmID0gdGhpcztcblx0ICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBzZWxmLmVtaXQoJ2Vycm9yJywgJ05vIHRyYW5zcG9ydHMgYXZhaWxhYmxlJyk7XG5cdCAgICB9LCAwKTtcblx0ICAgIHJldHVybjtcblx0ICB9IGVsc2Uge1xuXHQgICAgdHJhbnNwb3J0ID0gdGhpcy50cmFuc3BvcnRzWzBdO1xuXHQgIH1cblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3BlbmluZyc7XG5cblx0ICAvLyBSZXRyeSB3aXRoIHRoZSBuZXh0IHRyYW5zcG9ydCBpZiB0aGUgdHJhbnNwb3J0IGlzIGRpc2FibGVkIChqc29ucDogZmFsc2UpXG5cdCAgdHJ5IHtcblx0ICAgIHRyYW5zcG9ydCA9IHRoaXMuY3JlYXRlVHJhbnNwb3J0KHRyYW5zcG9ydCk7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgdGhpcy50cmFuc3BvcnRzLnNoaWZ0KCk7XG5cdCAgICB0aGlzLm9wZW4oKTtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICB0cmFuc3BvcnQub3BlbigpO1xuXHQgIHRoaXMuc2V0VHJhbnNwb3J0KHRyYW5zcG9ydCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGN1cnJlbnQgdHJhbnNwb3J0LiBEaXNhYmxlcyB0aGUgZXhpc3Rpbmcgb25lIChpZiBhbnkpLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5zZXRUcmFuc3BvcnQgPSBmdW5jdGlvbiAodHJhbnNwb3J0KSB7XG5cdCAgZGVidWckNignc2V0dGluZyB0cmFuc3BvcnQgJXMnLCB0cmFuc3BvcnQubmFtZSk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgaWYgKHRoaXMudHJhbnNwb3J0KSB7XG5cdCAgICBkZWJ1ZyQ2KCdjbGVhcmluZyBleGlzdGluZyB0cmFuc3BvcnQgJXMnLCB0aGlzLnRyYW5zcG9ydC5uYW1lKTtcblx0ICAgIHRoaXMudHJhbnNwb3J0LnJlbW92ZUFsbExpc3RlbmVycygpO1xuXHQgIH1cblxuXHQgIC8vIHNldCB1cCB0cmFuc3BvcnRcblx0ICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydDtcblxuXHQgIC8vIHNldCB1cCB0cmFuc3BvcnQgbGlzdGVuZXJzXG5cdCAgdHJhbnNwb3J0Lm9uKCdkcmFpbicsIGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25EcmFpbigpO1xuXHQgIH0pLm9uKCdwYWNrZXQnLCBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICBzZWxmLm9uUGFja2V0KHBhY2tldCk7XG5cdCAgfSkub24oJ2Vycm9yJywgZnVuY3Rpb24gKGUpIHtcblx0ICAgIHNlbGYub25FcnJvcihlKTtcblx0ICB9KS5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uQ2xvc2UoJ3RyYW5zcG9ydCBjbG9zZScpO1xuXHQgIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQcm9iZXMgYSB0cmFuc3BvcnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0cmFuc3BvcnQgbmFtZVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5wcm9iZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdCAgZGVidWckNigncHJvYmluZyB0cmFuc3BvcnQgXCIlc1wiJywgbmFtZSk7XG5cdCAgdmFyIHRyYW5zcG9ydCA9IHRoaXMuY3JlYXRlVHJhbnNwb3J0KG5hbWUsIHsgcHJvYmU6IDEgfSk7XG5cdCAgdmFyIGZhaWxlZCA9IGZhbHNlO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSBmYWxzZTtcblxuXHQgIGZ1bmN0aW9uIG9uVHJhbnNwb3J0T3BlbigpIHtcblx0ICAgIGlmIChzZWxmLm9ubHlCaW5hcnlVcGdyYWRlcykge1xuXHQgICAgICB2YXIgdXBncmFkZUxvc2VzQmluYXJ5ID0gIXRoaXMuc3VwcG9ydHNCaW5hcnkgJiYgc2VsZi50cmFuc3BvcnQuc3VwcG9ydHNCaW5hcnk7XG5cdCAgICAgIGZhaWxlZCA9IGZhaWxlZCB8fCB1cGdyYWRlTG9zZXNCaW5hcnk7XG5cdCAgICB9XG5cdCAgICBpZiAoZmFpbGVkKSByZXR1cm47XG5cblx0ICAgIGRlYnVnJDYoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgb3BlbmVkJywgbmFtZSk7XG5cdCAgICB0cmFuc3BvcnQuc2VuZChbeyB0eXBlOiAncGluZycsIGRhdGE6ICdwcm9iZScgfV0pO1xuXHQgICAgdHJhbnNwb3J0Lm9uY2UoJ3BhY2tldCcsIGZ1bmN0aW9uIChtc2cpIHtcblx0ICAgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXHQgICAgICBpZiAoJ3BvbmcnID09PSBtc2cudHlwZSAmJiAncHJvYmUnID09PSBtc2cuZGF0YSkge1xuXHQgICAgICAgIGRlYnVnJDYoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgcG9uZycsIG5hbWUpO1xuXHQgICAgICAgIHNlbGYudXBncmFkaW5nID0gdHJ1ZTtcblx0ICAgICAgICBzZWxmLmVtaXQoJ3VwZ3JhZGluZycsIHRyYW5zcG9ydCk7XG5cdCAgICAgICAgaWYgKCF0cmFuc3BvcnQpIHJldHVybjtcblx0ICAgICAgICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gJ3dlYnNvY2tldCcgPT09IHRyYW5zcG9ydC5uYW1lO1xuXG5cdCAgICAgICAgZGVidWckNigncGF1c2luZyBjdXJyZW50IHRyYW5zcG9ydCBcIiVzXCInLCBzZWxmLnRyYW5zcG9ydC5uYW1lKTtcblx0ICAgICAgICBzZWxmLnRyYW5zcG9ydC5wYXVzZShmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICBpZiAoZmFpbGVkKSByZXR1cm47XG5cdCAgICAgICAgICBpZiAoJ2Nsb3NlZCcgPT09IHNlbGYucmVhZHlTdGF0ZSkgcmV0dXJuO1xuXHQgICAgICAgICAgZGVidWckNignY2hhbmdpbmcgdHJhbnNwb3J0IGFuZCBzZW5kaW5nIHVwZ3JhZGUgcGFja2V0Jyk7XG5cblx0ICAgICAgICAgIGNsZWFudXAoKTtcblxuXHQgICAgICAgICAgc2VsZi5zZXRUcmFuc3BvcnQodHJhbnNwb3J0KTtcblx0ICAgICAgICAgIHRyYW5zcG9ydC5zZW5kKFt7IHR5cGU6ICd1cGdyYWRlJyB9XSk7XG5cdCAgICAgICAgICBzZWxmLmVtaXQoJ3VwZ3JhZGUnLCB0cmFuc3BvcnQpO1xuXHQgICAgICAgICAgdHJhbnNwb3J0ID0gbnVsbDtcblx0ICAgICAgICAgIHNlbGYudXBncmFkaW5nID0gZmFsc2U7XG5cdCAgICAgICAgICBzZWxmLmZsdXNoKCk7XG5cdCAgICAgICAgfSk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgZGVidWckNigncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBmYWlsZWQnLCBuYW1lKTtcblx0ICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdwcm9iZSBlcnJvcicpO1xuXHQgICAgICAgIGVyci50cmFuc3BvcnQgPSB0cmFuc3BvcnQubmFtZTtcblx0ICAgICAgICBzZWxmLmVtaXQoJ3VwZ3JhZGVFcnJvcicsIGVycik7XG5cdCAgICAgIH1cblx0ICAgIH0pO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGZyZWV6ZVRyYW5zcG9ydCgpIHtcblx0ICAgIGlmIChmYWlsZWQpIHJldHVybjtcblxuXHQgICAgLy8gQW55IGNhbGxiYWNrIGNhbGxlZCBieSB0cmFuc3BvcnQgc2hvdWxkIGJlIGlnbm9yZWQgc2luY2Ugbm93XG5cdCAgICBmYWlsZWQgPSB0cnVlO1xuXG5cdCAgICBjbGVhbnVwKCk7XG5cblx0ICAgIHRyYW5zcG9ydC5jbG9zZSgpO1xuXHQgICAgdHJhbnNwb3J0ID0gbnVsbDtcblx0ICB9XG5cblx0ICAvLyBIYW5kbGUgYW55IGVycm9yIHRoYXQgaGFwcGVucyB3aGlsZSBwcm9iaW5nXG5cdCAgZnVuY3Rpb24gb25lcnJvcihlcnIpIHtcblx0ICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcigncHJvYmUgZXJyb3I6ICcgKyBlcnIpO1xuXHQgICAgZXJyb3IudHJhbnNwb3J0ID0gdHJhbnNwb3J0Lm5hbWU7XG5cblx0ICAgIGZyZWV6ZVRyYW5zcG9ydCgpO1xuXG5cdCAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIGZhaWxlZCBiZWNhdXNlIG9mIGVycm9yOiAlcycsIG5hbWUsIGVycik7XG5cblx0ICAgIHNlbGYuZW1pdCgndXBncmFkZUVycm9yJywgZXJyb3IpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIG9uVHJhbnNwb3J0Q2xvc2UoKSB7XG5cdCAgICBvbmVycm9yKCd0cmFuc3BvcnQgY2xvc2VkJyk7XG5cdCAgfVxuXG5cdCAgLy8gV2hlbiB0aGUgc29ja2V0IGlzIGNsb3NlZCB3aGlsZSB3ZSdyZSBwcm9iaW5nXG5cdCAgZnVuY3Rpb24gb25jbG9zZSgpIHtcblx0ICAgIG9uZXJyb3IoJ3NvY2tldCBjbG9zZWQnKTtcblx0ICB9XG5cblx0ICAvLyBXaGVuIHRoZSBzb2NrZXQgaXMgdXBncmFkZWQgd2hpbGUgd2UncmUgcHJvYmluZ1xuXHQgIGZ1bmN0aW9uIG9udXBncmFkZSh0bykge1xuXHQgICAgaWYgKHRyYW5zcG9ydCAmJiB0by5uYW1lICE9PSB0cmFuc3BvcnQubmFtZSkge1xuXHQgICAgICBkZWJ1ZyQ2KCdcIiVzXCIgd29ya3MgLSBhYm9ydGluZyBcIiVzXCInLCB0by5uYW1lLCB0cmFuc3BvcnQubmFtZSk7XG5cdCAgICAgIGZyZWV6ZVRyYW5zcG9ydCgpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8vIFJlbW92ZSBhbGwgbGlzdGVuZXJzIG9uIHRoZSB0cmFuc3BvcnQgYW5kIG9uIHNlbGZcblx0ICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuXHQgICAgdHJhbnNwb3J0LnJlbW92ZUxpc3RlbmVyKCdvcGVuJywgb25UcmFuc3BvcnRPcGVuKTtcblx0ICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcblx0ICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvblRyYW5zcG9ydENsb3NlKTtcblx0ICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCd1cGdyYWRpbmcnLCBvbnVwZ3JhZGUpO1xuXHQgIH1cblxuXHQgIHRyYW5zcG9ydC5vbmNlKCdvcGVuJywgb25UcmFuc3BvcnRPcGVuKTtcblx0ICB0cmFuc3BvcnQub25jZSgnZXJyb3InLCBvbmVycm9yKTtcblx0ICB0cmFuc3BvcnQub25jZSgnY2xvc2UnLCBvblRyYW5zcG9ydENsb3NlKTtcblxuXHQgIHRoaXMub25jZSgnY2xvc2UnLCBvbmNsb3NlKTtcblx0ICB0aGlzLm9uY2UoJ3VwZ3JhZGluZycsIG9udXBncmFkZSk7XG5cblx0ICB0cmFuc3BvcnQub3BlbigpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiBjb25uZWN0aW9uIGlzIGRlZW1lZCBvcGVuLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ2KCdzb2NrZXQgb3BlbicpO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuJztcblx0ICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gJ3dlYnNvY2tldCcgPT09IHRoaXMudHJhbnNwb3J0Lm5hbWU7XG5cdCAgdGhpcy5lbWl0KCdvcGVuJyk7XG5cdCAgdGhpcy5mbHVzaCgpO1xuXG5cdCAgLy8gd2UgY2hlY2sgZm9yIGByZWFkeVN0YXRlYCBpbiBjYXNlIGFuIGBvcGVuYFxuXHQgIC8vIGxpc3RlbmVyIGFscmVhZHkgY2xvc2VkIHRoZSBzb2NrZXRcblx0ICBpZiAoJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUgJiYgdGhpcy51cGdyYWRlICYmIHRoaXMudHJhbnNwb3J0LnBhdXNlKSB7XG5cdCAgICBkZWJ1ZyQ2KCdzdGFydGluZyB1cGdyYWRlIHByb2JlcycpO1xuXHQgICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnVwZ3JhZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICB0aGlzLnByb2JlKHRoaXMudXBncmFkZXNbaV0pO1xuXHQgICAgfVxuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogSGFuZGxlcyBhIHBhY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25QYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdjbG9zaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICBkZWJ1ZyQ2KCdzb2NrZXQgcmVjZWl2ZTogdHlwZSBcIiVzXCIsIGRhdGEgXCIlc1wiJywgcGFja2V0LnR5cGUsIHBhY2tldC5kYXRhKTtcblxuXHQgICAgdGhpcy5lbWl0KCdwYWNrZXQnLCBwYWNrZXQpO1xuXG5cdCAgICAvLyBTb2NrZXQgaXMgbGl2ZSAtIGFueSBwYWNrZXQgY291bnRzXG5cdCAgICB0aGlzLmVtaXQoJ2hlYXJ0YmVhdCcpO1xuXG5cdCAgICBzd2l0Y2ggKHBhY2tldC50eXBlKSB7XG5cdCAgICAgIGNhc2UgJ29wZW4nOlxuXHQgICAgICAgIHRoaXMub25IYW5kc2hha2UoSlNPTi5wYXJzZShwYWNrZXQuZGF0YSkpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgJ3BvbmcnOlxuXHQgICAgICAgIHRoaXMuc2V0UGluZygpO1xuXHQgICAgICAgIHRoaXMuZW1pdCgncG9uZycpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgJ2Vycm9yJzpcblx0ICAgICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdzZXJ2ZXIgZXJyb3InKTtcblx0ICAgICAgICBlcnIuY29kZSA9IHBhY2tldC5kYXRhO1xuXHQgICAgICAgIHRoaXMub25FcnJvcihlcnIpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgJ21lc3NhZ2UnOlxuXHQgICAgICAgIHRoaXMuZW1pdCgnZGF0YScsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2UnLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICB9XG5cdCAgfSBlbHNlIHtcblx0ICAgIGRlYnVnJDYoJ3BhY2tldCByZWNlaXZlZCB3aXRoIHNvY2tldCByZWFkeVN0YXRlIFwiJXNcIicsIHRoaXMucmVhZHlTdGF0ZSk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBoYW5kc2hha2UgY29tcGxldGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGhhbmRzaGFrZSBvYmpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25IYW5kc2hha2UgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHRoaXMuZW1pdCgnaGFuZHNoYWtlJywgZGF0YSk7XG5cdCAgdGhpcy5pZCA9IGRhdGEuc2lkO1xuXHQgIHRoaXMudHJhbnNwb3J0LnF1ZXJ5LnNpZCA9IGRhdGEuc2lkO1xuXHQgIHRoaXMudXBncmFkZXMgPSB0aGlzLmZpbHRlclVwZ3JhZGVzKGRhdGEudXBncmFkZXMpO1xuXHQgIHRoaXMucGluZ0ludGVydmFsID0gZGF0YS5waW5nSW50ZXJ2YWw7XG5cdCAgdGhpcy5waW5nVGltZW91dCA9IGRhdGEucGluZ1RpbWVvdXQ7XG5cdCAgdGhpcy5vbk9wZW4oKTtcblx0ICAvLyBJbiBjYXNlIG9wZW4gaGFuZGxlciBjbG9zZXMgc29ja2V0XG5cdCAgaWYgKCdjbG9zZWQnID09PSB0aGlzLnJlYWR5U3RhdGUpIHJldHVybjtcblx0ICB0aGlzLnNldFBpbmcoKTtcblxuXHQgIC8vIFByb2xvbmcgbGl2ZW5lc3Mgb2Ygc29ja2V0IG9uIGhlYXJ0YmVhdFxuXHQgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2hlYXJ0YmVhdCcsIHRoaXMub25IZWFydGJlYXQpO1xuXHQgIHRoaXMub24oJ2hlYXJ0YmVhdCcsIHRoaXMub25IZWFydGJlYXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZXNldHMgcGluZyB0aW1lb3V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbkhlYXJ0YmVhdCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG5cdCAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXRUaW1lcik7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHNlbGYucGluZ1RpbWVvdXRUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKCdjbG9zZWQnID09PSBzZWxmLnJlYWR5U3RhdGUpIHJldHVybjtcblx0ICAgIHNlbGYub25DbG9zZSgncGluZyB0aW1lb3V0Jyk7XG5cdCAgfSwgdGltZW91dCB8fCBzZWxmLnBpbmdJbnRlcnZhbCArIHNlbGYucGluZ1RpbWVvdXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQaW5ncyBzZXJ2ZXIgZXZlcnkgYHRoaXMucGluZ0ludGVydmFsYCBhbmQgZXhwZWN0cyByZXNwb25zZVxuXHQgKiB3aXRoaW4gYHRoaXMucGluZ1RpbWVvdXRgIG9yIGNsb3NlcyBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5zZXRQaW5nID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBjbGVhclRpbWVvdXQoc2VsZi5waW5nSW50ZXJ2YWxUaW1lcik7XG5cdCAgc2VsZi5waW5nSW50ZXJ2YWxUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgZGVidWckNignd3JpdGluZyBwaW5nIHBhY2tldCAtIGV4cGVjdGluZyBwb25nIHdpdGhpbiAlc21zJywgc2VsZi5waW5nVGltZW91dCk7XG5cdCAgICBzZWxmLnBpbmcoKTtcblx0ICAgIHNlbGYub25IZWFydGJlYXQoc2VsZi5waW5nVGltZW91dCk7XG5cdCAgfSwgc2VsZi5waW5nSW50ZXJ2YWwpO1xuXHR9O1xuXG5cdC8qKlxuXHQqIFNlbmRzIGEgcGluZyBwYWNrZXQuXG5cdCpcblx0KiBAYXBpIHByaXZhdGVcblx0Ki9cblxuXHRTb2NrZXQucHJvdG90eXBlLnBpbmcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHRoaXMuc2VuZFBhY2tldCgncGluZycsIGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYuZW1pdCgncGluZycpO1xuXHQgIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgb24gYGRyYWluYCBldmVudFxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbkRyYWluID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMud3JpdGVCdWZmZXIuc3BsaWNlKDAsIHRoaXMucHJldkJ1ZmZlckxlbik7XG5cblx0ICAvLyBzZXR0aW5nIHByZXZCdWZmZXJMZW4gPSAwIGlzIHZlcnkgaW1wb3J0YW50XG5cdCAgLy8gZm9yIGV4YW1wbGUsIHdoZW4gdXBncmFkaW5nLCB1cGdyYWRlIHBhY2tldCBpcyBzZW50IG92ZXIsXG5cdCAgLy8gYW5kIGEgbm9uemVybyBwcmV2QnVmZmVyTGVuIGNvdWxkIGNhdXNlIHByb2JsZW1zIG9uIGBkcmFpbmBcblx0ICB0aGlzLnByZXZCdWZmZXJMZW4gPSAwO1xuXG5cdCAgaWYgKDAgPT09IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSB7XG5cdCAgICB0aGlzLmVtaXQoJ2RyYWluJyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRoaXMuZmx1c2goKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEZsdXNoIHdyaXRlIGJ1ZmZlcnMuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmZsdXNoID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICgnY2xvc2VkJyAhPT0gdGhpcy5yZWFkeVN0YXRlICYmIHRoaXMudHJhbnNwb3J0LndyaXRhYmxlICYmICF0aGlzLnVwZ3JhZGluZyAmJiB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCkge1xuXHQgICAgZGVidWckNignZmx1c2hpbmcgJWQgcGFja2V0cyBpbiBzb2NrZXQnLCB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCk7XG5cdCAgICB0aGlzLnRyYW5zcG9ydC5zZW5kKHRoaXMud3JpdGVCdWZmZXIpO1xuXHQgICAgLy8ga2VlcCB0cmFjayBvZiBjdXJyZW50IGxlbmd0aCBvZiB3cml0ZUJ1ZmZlclxuXHQgICAgLy8gc3BsaWNlIHdyaXRlQnVmZmVyIGFuZCBjYWxsYmFja0J1ZmZlciBvbiBgZHJhaW5gXG5cdCAgICB0aGlzLnByZXZCdWZmZXJMZW4gPSB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aDtcblx0ICAgIHRoaXMuZW1pdCgnZmx1c2gnKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFNlbmRzIGEgbWVzc2FnZS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2UuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5cblx0ICogQHJldHVybiB7U29ja2V0fSBmb3IgY2hhaW5pbmcuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUud3JpdGUgPSBTb2NrZXQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbiAobXNnLCBvcHRpb25zLCBmbikge1xuXHQgIHRoaXMuc2VuZFBhY2tldCgnbWVzc2FnZScsIG1zZywgb3B0aW9ucywgZm4pO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBhIHBhY2tldC5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHBhY2tldCB0eXBlLlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGF0YS5cblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5zZW5kUGFja2V0ID0gZnVuY3Rpb24gKHR5cGUsIGRhdGEsIG9wdGlvbnMsIGZuKSB7XG5cdCAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBkYXRhKSB7XG5cdCAgICBmbiA9IGRhdGE7XG5cdCAgICBkYXRhID0gdW5kZWZpbmVkO1xuXHQgIH1cblxuXHQgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2Ygb3B0aW9ucykge1xuXHQgICAgZm4gPSBvcHRpb25zO1xuXHQgICAgb3B0aW9ucyA9IG51bGw7XG5cdCAgfVxuXG5cdCAgaWYgKCdjbG9zaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdjbG9zZWQnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cblx0ICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblx0ICBvcHRpb25zLmNvbXByZXNzID0gZmFsc2UgIT09IG9wdGlvbnMuY29tcHJlc3M7XG5cblx0ICB2YXIgcGFja2V0ID0ge1xuXHQgICAgdHlwZTogdHlwZSxcblx0ICAgIGRhdGE6IGRhdGEsXG5cdCAgICBvcHRpb25zOiBvcHRpb25zXG5cdCAgfTtcblx0ICB0aGlzLmVtaXQoJ3BhY2tldENyZWF0ZScsIHBhY2tldCk7XG5cdCAgdGhpcy53cml0ZUJ1ZmZlci5wdXNoKHBhY2tldCk7XG5cdCAgaWYgKGZuKSB0aGlzLm9uY2UoJ2ZsdXNoJywgZm4pO1xuXHQgIHRoaXMuZmx1c2goKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zaW5nJztcblxuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgICBpZiAodGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcblx0ICAgICAgdGhpcy5vbmNlKCdkcmFpbicsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBpZiAodGhpcy51cGdyYWRpbmcpIHtcblx0ICAgICAgICAgIHdhaXRGb3JVcGdyYWRlKCk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGNsb3NlKCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH0gZWxzZSBpZiAodGhpcy51cGdyYWRpbmcpIHtcblx0ICAgICAgd2FpdEZvclVwZ3JhZGUoKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGNsb3NlKCk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gY2xvc2UoKSB7XG5cdCAgICBzZWxmLm9uQ2xvc2UoJ2ZvcmNlZCBjbG9zZScpO1xuXHQgICAgZGVidWckNignc29ja2V0IGNsb3NpbmcgLSB0ZWxsaW5nIHRyYW5zcG9ydCB0byBjbG9zZScpO1xuXHQgICAgc2VsZi50cmFuc3BvcnQuY2xvc2UoKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBjbGVhbnVwQW5kQ2xvc2UoKSB7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCd1cGdyYWRlJywgY2xlYW51cEFuZENsb3NlKTtcblx0ICAgIHNlbGYucmVtb3ZlTGlzdGVuZXIoJ3VwZ3JhZGVFcnJvcicsIGNsZWFudXBBbmRDbG9zZSk7XG5cdCAgICBjbG9zZSgpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIHdhaXRGb3JVcGdyYWRlKCkge1xuXHQgICAgLy8gd2FpdCBmb3IgdXBncmFkZSB0byBmaW5pc2ggc2luY2Ugd2UgY2FuJ3Qgc2VuZCBwYWNrZXRzIHdoaWxlIHBhdXNpbmcgYSB0cmFuc3BvcnRcblx0ICAgIHNlbGYub25jZSgndXBncmFkZScsIGNsZWFudXBBbmRDbG9zZSk7XG5cdCAgICBzZWxmLm9uY2UoJ3VwZ3JhZGVFcnJvcicsIGNsZWFudXBBbmRDbG9zZSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBlcnJvclxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbkVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXHQgIGRlYnVnJDYoJ3NvY2tldCBlcnJvciAlaicsIGVycik7XG5cdCAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9IGZhbHNlO1xuXHQgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIHRoaXMub25DbG9zZSgndHJhbnNwb3J0IGVycm9yJywgZXJyKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gdHJhbnNwb3J0IGNsb3NlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbkNsb3NlID0gZnVuY3Rpb24gKHJlYXNvbiwgZGVzYykge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnY2xvc2luZycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgZGVidWckNignc29ja2V0IGNsb3NlIHdpdGggcmVhc29uOiBcIiVzXCInLCByZWFzb24pO1xuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgICAvLyBjbGVhciB0aW1lcnNcblx0ICAgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdJbnRlcnZhbFRpbWVyKTtcblx0ICAgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0VGltZXIpO1xuXG5cdCAgICAvLyBzdG9wIGV2ZW50IGZyb20gZmlyaW5nIGFnYWluIGZvciB0cmFuc3BvcnRcblx0ICAgIHRoaXMudHJhbnNwb3J0LnJlbW92ZUFsbExpc3RlbmVycygnY2xvc2UnKTtcblxuXHQgICAgLy8gZW5zdXJlIHRyYW5zcG9ydCB3b24ndCBzdGF5IG9wZW5cblx0ICAgIHRoaXMudHJhbnNwb3J0LmNsb3NlKCk7XG5cblx0ICAgIC8vIGlnbm9yZSBmdXJ0aGVyIHRyYW5zcG9ydCBjb21tdW5pY2F0aW9uXG5cdCAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcblxuXHQgICAgLy8gc2V0IHJlYWR5IHN0YXRlXG5cdCAgICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblxuXHQgICAgLy8gY2xlYXIgc2Vzc2lvbiBpZFxuXHQgICAgdGhpcy5pZCA9IG51bGw7XG5cblx0ICAgIC8vIGVtaXQgY2xvc2UgZXZlbnRcblx0ICAgIHRoaXMuZW1pdCgnY2xvc2UnLCByZWFzb24sIGRlc2MpO1xuXG5cdCAgICAvLyBjbGVhbiBidWZmZXJzIGFmdGVyLCBzbyB1c2VycyBjYW4gc3RpbGxcblx0ICAgIC8vIGdyYWIgdGhlIGJ1ZmZlcnMgb24gYGNsb3NlYCBldmVudFxuXHQgICAgc2VsZi53cml0ZUJ1ZmZlciA9IFtdO1xuXHQgICAgc2VsZi5wcmV2QnVmZmVyTGVuID0gMDtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEZpbHRlcnMgdXBncmFkZXMsIHJldHVybmluZyBvbmx5IHRob3NlIG1hdGNoaW5nIGNsaWVudCB0cmFuc3BvcnRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fSBzZXJ2ZXIgdXBncmFkZXNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuZmlsdGVyVXBncmFkZXMgPSBmdW5jdGlvbiAodXBncmFkZXMpIHtcblx0ICB2YXIgZmlsdGVyZWRVcGdyYWRlcyA9IFtdO1xuXHQgIGZvciAodmFyIGkgPSAwLCBqID0gdXBncmFkZXMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG5cdCAgICBpZiAofmluZGV4KHRoaXMudHJhbnNwb3J0cywgdXBncmFkZXNbaV0pKSBmaWx0ZXJlZFVwZ3JhZGVzLnB1c2godXBncmFkZXNbaV0pO1xuXHQgIH1cblx0ICByZXR1cm4gZmlsdGVyZWRVcGdyYWRlcztcblx0fTtcblxuXHR2YXIgc29ja2V0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogc29ja2V0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogc29ja2V0XG5cdH0pO1xuXG5cdHZhciByZXF1aXJlJCQwJDQgPSAoIHNvY2tldCQxICYmIHNvY2tldCApIHx8IHNvY2tldCQxO1xuXG5cdHZhciBsaWIgPSByZXF1aXJlJCQwJDQ7XG5cblx0LyoqXG5cdCAqIEV4cG9ydHMgcGFyc2VyXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqXG5cdCAqL1xuXHR2YXIgcGFyc2VyJDEgPSBwYXJzZXI7XG5cdGxpYi5wYXJzZXIgPSBwYXJzZXIkMTtcblxuXHR2YXIgbGliJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogbGliLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogbGliLFxuXHRcdHBhcnNlcjogcGFyc2VyJDFcblx0fSk7XG5cblx0dmFyIHRvQXJyYXlfMSA9IHRvQXJyYXkkMTtcblxuXHRmdW5jdGlvbiB0b0FycmF5JDEobGlzdCwgaW5kZXgpIHtcblx0ICAgIHZhciBhcnJheSA9IFtdO1xuXG5cdCAgICBpbmRleCA9IGluZGV4IHx8IDA7XG5cblx0ICAgIGZvciAodmFyIGkgPSBpbmRleCB8fCAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIGFycmF5W2kgLSBpbmRleF0gPSBsaXN0W2ldO1xuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gYXJyYXk7XG5cdH1cblxuXHR2YXIgdG9BcnJheSQyID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHRvQXJyYXlfMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHRvQXJyYXlfMVxuXHR9KTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBvbl8xID0gb247XG5cblx0LyoqXG5cdCAqIEhlbHBlciBmb3Igc3Vic2NyaXB0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R8RXZlbnRFbWl0dGVyfSBvYmogd2l0aCBgRW1pdHRlcmAgbWl4aW4gb3IgYEV2ZW50RW1pdHRlcmBcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IG5hbWVcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gb24ob2JqLCBldiwgZm4pIHtcblx0ICBvYmoub24oZXYsIGZuKTtcblx0ICByZXR1cm4ge1xuXHQgICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0ICAgICAgb2JqLnJlbW92ZUxpc3RlbmVyKGV2LCBmbik7XG5cdCAgICB9XG5cdCAgfTtcblx0fVxuXG5cdHZhciBvbiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IG9uXzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBvbl8xXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBTbGljZSByZWZlcmVuY2UuXG5cdCAqL1xuXG5cdHZhciBzbGljZSA9IFtdLnNsaWNlO1xuXG5cdC8qKlxuXHQgKiBCaW5kIGBvYmpgIHRvIGBmbmAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcblx0ICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd9IGZuIG9yIHN0cmluZ1xuXHQgKiBAcmV0dXJuIHtGdW5jdGlvbn1cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIGNvbXBvbmVudEJpbmQgPSBmdW5jdGlvbiBjb21wb25lbnRCaW5kKG9iaiwgZm4pIHtcblx0ICBpZiAoJ3N0cmluZycgPT0gdHlwZW9mIGZuKSBmbiA9IG9ialtmbl07XG5cdCAgaWYgKCdmdW5jdGlvbicgIT0gdHlwZW9mIGZuKSB0aHJvdyBuZXcgRXJyb3IoJ2JpbmQoKSByZXF1aXJlcyBhIGZ1bmN0aW9uJyk7XG5cdCAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cdCAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgIHJldHVybiBmbi5hcHBseShvYmosIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuXHQgIH07XG5cdH07XG5cblx0dmFyIGNvbXBvbmVudEJpbmQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBjb21wb25lbnRCaW5kLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogY29tcG9uZW50QmluZFxuXHR9KTtcblxuXHR2YXIgcGFyc2VyJDIgPSAoIHNvY2tldF9pb1BhcnNlciQxICYmIHNvY2tldF9pb1BhcnNlciApIHx8IHNvY2tldF9pb1BhcnNlciQxO1xuXG5cdHZhciB0b0FycmF5JDMgPSAoIHRvQXJyYXkkMiAmJiB0b0FycmF5XzEgKSB8fCB0b0FycmF5JDI7XG5cblx0dmFyIG9uJDIgPSAoIG9uJDEgJiYgb25fMSApIHx8IG9uJDE7XG5cblx0dmFyIGJpbmQgPSAoIGNvbXBvbmVudEJpbmQkMSAmJiBjb21wb25lbnRCaW5kICkgfHwgY29tcG9uZW50QmluZCQxO1xuXG5cdHZhciBzb2NrZXQkMiA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIGRlYnVnID0gcmVxdWlyZSQkMCQyKCdzb2NrZXQuaW8tY2xpZW50OnNvY2tldCcpO1xuXG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGV4cG9ydHMuXG5cdCAgICovXG5cblx0ICBtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBTb2NrZXQ7XG5cblx0ICAvKipcblx0ICAgKiBJbnRlcm5hbCBldmVudHMgKGJsYWNrbGlzdGVkKS5cblx0ICAgKiBUaGVzZSBldmVudHMgY2FuJ3QgYmUgZW1pdHRlZCBieSB0aGUgdXNlci5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgdmFyIGV2ZW50cyA9IHtcblx0ICAgIGNvbm5lY3Q6IDEsXG5cdCAgICBjb25uZWN0X2Vycm9yOiAxLFxuXHQgICAgY29ubmVjdF90aW1lb3V0OiAxLFxuXHQgICAgY29ubmVjdGluZzogMSxcblx0ICAgIGRpc2Nvbm5lY3Q6IDEsXG5cdCAgICBlcnJvcjogMSxcblx0ICAgIHJlY29ubmVjdDogMSxcblx0ICAgIHJlY29ubmVjdF9hdHRlbXB0OiAxLFxuXHQgICAgcmVjb25uZWN0X2ZhaWxlZDogMSxcblx0ICAgIHJlY29ubmVjdF9lcnJvcjogMSxcblx0ICAgIHJlY29ubmVjdGluZzogMSxcblx0ICAgIHBpbmc6IDEsXG5cdCAgICBwb25nOiAxXG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNob3J0Y3V0IHRvIGBFbWl0dGVyI2VtaXRgLlxuXHQgICAqL1xuXG5cdCAgdmFyIGVtaXQgPSBFbWl0dGVyLnByb3RvdHlwZS5lbWl0O1xuXG5cdCAgLyoqXG5cdCAgICogYFNvY2tldGAgY29uc3RydWN0b3IuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gU29ja2V0KGlvLCBuc3AsIG9wdHMpIHtcblx0ICAgIHRoaXMuaW8gPSBpbztcblx0ICAgIHRoaXMubnNwID0gbnNwO1xuXHQgICAgdGhpcy5qc29uID0gdGhpczsgLy8gY29tcGF0XG5cdCAgICB0aGlzLmlkcyA9IDA7XG5cdCAgICB0aGlzLmFja3MgPSB7fTtcblx0ICAgIHRoaXMucmVjZWl2ZUJ1ZmZlciA9IFtdO1xuXHQgICAgdGhpcy5zZW5kQnVmZmVyID0gW107XG5cdCAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuXHQgICAgdGhpcy5kaXNjb25uZWN0ZWQgPSB0cnVlO1xuXHQgICAgdGhpcy5mbGFncyA9IHt9O1xuXHQgICAgaWYgKG9wdHMgJiYgb3B0cy5xdWVyeSkge1xuXHQgICAgICB0aGlzLnF1ZXJ5ID0gb3B0cy5xdWVyeTtcblx0ICAgIH1cblx0ICAgIGlmICh0aGlzLmlvLmF1dG9Db25uZWN0KSB0aGlzLm9wZW4oKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgICAqL1xuXG5cdCAgRW1pdHRlcihTb2NrZXQucHJvdG90eXBlKTtcblxuXHQgIC8qKlxuXHQgICAqIFN1YnNjcmliZSB0byBvcGVuLCBjbG9zZSBhbmQgcGFja2V0IGV2ZW50c1xuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLnN1YkV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLnN1YnMpIHJldHVybjtcblxuXHQgICAgdmFyIGlvID0gdGhpcy5pbztcblx0ICAgIHRoaXMuc3VicyA9IFtvbiQyKGlvLCAnb3BlbicsIGJpbmQodGhpcywgJ29ub3BlbicpKSwgb24kMihpbywgJ3BhY2tldCcsIGJpbmQodGhpcywgJ29ucGFja2V0JykpLCBvbiQyKGlvLCAnY2xvc2UnLCBiaW5kKHRoaXMsICdvbmNsb3NlJykpXTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogXCJPcGVuc1wiIHRoZSBzb2NrZXQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vcGVuID0gU29ja2V0LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKHRoaXMuY29ubmVjdGVkKSByZXR1cm4gdGhpcztcblxuXHQgICAgdGhpcy5zdWJFdmVudHMoKTtcblx0ICAgIHRoaXMuaW8ub3BlbigpOyAvLyBlbnN1cmUgb3BlblxuXHQgICAgaWYgKCdvcGVuJyA9PT0gdGhpcy5pby5yZWFkeVN0YXRlKSB0aGlzLm9ub3BlbigpO1xuXHQgICAgdGhpcy5lbWl0KCdjb25uZWN0aW5nJyk7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogU2VuZHMgYSBgbWVzc2FnZWAgZXZlbnQuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKCkge1xuXHQgICAgdmFyIGFyZ3MgPSB0b0FycmF5JDMoYXJndW1lbnRzKTtcblx0ICAgIGFyZ3MudW5zaGlmdCgnbWVzc2FnZScpO1xuXHQgICAgdGhpcy5lbWl0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIE92ZXJyaWRlIGBlbWl0YC5cblx0ICAgKiBJZiB0aGUgZXZlbnQgaXMgaW4gYGV2ZW50c2AsIGl0J3MgZW1pdHRlZCBub3JtYWxseS5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBuYW1lXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIChldikge1xuXHQgICAgaWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShldikpIHtcblx0ICAgICAgZW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH1cblxuXHQgICAgdmFyIGFyZ3MgPSB0b0FycmF5JDMoYXJndW1lbnRzKTtcblx0ICAgIHZhciBwYWNrZXQgPSB7XG5cdCAgICAgIHR5cGU6ICh0aGlzLmZsYWdzLmJpbmFyeSAhPT0gdW5kZWZpbmVkID8gdGhpcy5mbGFncy5iaW5hcnkgOiBoYXNCaW5hcnkkMShhcmdzKSkgPyBwYXJzZXIkMi5CSU5BUllfRVZFTlQgOiBwYXJzZXIkMi5FVkVOVCxcblx0ICAgICAgZGF0YTogYXJnc1xuXHQgICAgfTtcblxuXHQgICAgcGFja2V0Lm9wdGlvbnMgPSB7fTtcblx0ICAgIHBhY2tldC5vcHRpb25zLmNvbXByZXNzID0gIXRoaXMuZmxhZ3MgfHwgZmFsc2UgIT09IHRoaXMuZmxhZ3MuY29tcHJlc3M7XG5cblx0ICAgIC8vIGV2ZW50IGFjayBjYWxsYmFja1xuXHQgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0pIHtcblx0ICAgICAgZGVidWcoJ2VtaXR0aW5nIHBhY2tldCB3aXRoIGFjayBpZCAlZCcsIHRoaXMuaWRzKTtcblx0ICAgICAgdGhpcy5hY2tzW3RoaXMuaWRzXSA9IGFyZ3MucG9wKCk7XG5cdCAgICAgIHBhY2tldC5pZCA9IHRoaXMuaWRzKys7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICB0aGlzLnBhY2tldChwYWNrZXQpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGhpcy5zZW5kQnVmZmVyLnB1c2gocGFja2V0KTtcblx0ICAgIH1cblxuXHQgICAgdGhpcy5mbGFncyA9IHt9O1xuXG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogU2VuZHMgYSBwYWNrZXQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLnBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHBhY2tldC5uc3AgPSB0aGlzLm5zcDtcblx0ICAgIHRoaXMuaW8ucGFja2V0KHBhY2tldCk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGVuZ2luZSBgb3BlbmAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgICAgZGVidWcoJ3RyYW5zcG9ydCBpcyBvcGVuIC0gY29ubmVjdGluZycpO1xuXG5cdCAgICAvLyB3cml0ZSBjb25uZWN0IHBhY2tldCBpZiBuZWNlc3Nhcnlcblx0ICAgIGlmICgnLycgIT09IHRoaXMubnNwKSB7XG5cdCAgICAgIGlmICh0aGlzLnF1ZXJ5KSB7XG5cdCAgICAgICAgdmFyIHF1ZXJ5ID0gX3R5cGVvZih0aGlzLnF1ZXJ5KSA9PT0gJ29iamVjdCcgPyBwYXJzZXFzJDIuZW5jb2RlKHRoaXMucXVlcnkpIDogdGhpcy5xdWVyeTtcblx0ICAgICAgICBkZWJ1Zygnc2VuZGluZyBjb25uZWN0IHBhY2tldCB3aXRoIHF1ZXJ5ICVzJywgcXVlcnkpO1xuXHQgICAgICAgIHRoaXMucGFja2V0KHsgdHlwZTogcGFyc2VyJDIuQ09OTkVDVCwgcXVlcnk6IHF1ZXJ5IH0pO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHRoaXMucGFja2V0KHsgdHlwZTogcGFyc2VyJDIuQ09OTkVDVCB9KTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBlbmdpbmUgYGNsb3NlYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSByZWFzb25cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25jbG9zZSA9IGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICAgIGRlYnVnKCdjbG9zZSAoJXMpJywgcmVhc29uKTtcblx0ICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG5cdCAgICB0aGlzLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG5cdCAgICBkZWxldGUgdGhpcy5pZDtcblx0ICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdCcsIHJlYXNvbik7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB3aXRoIHNvY2tldCBwYWNrZXQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9ucGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgdmFyIHNhbWVOYW1lc3BhY2UgPSBwYWNrZXQubnNwID09PSB0aGlzLm5zcDtcblx0ICAgIHZhciByb290TmFtZXNwYWNlRXJyb3IgPSBwYWNrZXQudHlwZSA9PT0gcGFyc2VyJDIuRVJST1IgJiYgcGFja2V0Lm5zcCA9PT0gJy8nO1xuXG5cdCAgICBpZiAoIXNhbWVOYW1lc3BhY2UgJiYgIXJvb3ROYW1lc3BhY2VFcnJvcikgcmV0dXJuO1xuXG5cdCAgICBzd2l0Y2ggKHBhY2tldC50eXBlKSB7XG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQ09OTkVDVDpcblx0ICAgICAgICB0aGlzLm9uY29ubmVjdCgpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuRVZFTlQ6XG5cdCAgICAgICAgdGhpcy5vbmV2ZW50KHBhY2tldCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5CSU5BUllfRVZFTlQ6XG5cdCAgICAgICAgdGhpcy5vbmV2ZW50KHBhY2tldCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5BQ0s6XG5cdCAgICAgICAgdGhpcy5vbmFjayhwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQklOQVJZX0FDSzpcblx0ICAgICAgICB0aGlzLm9uYWNrKHBhY2tldCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5ESVNDT05ORUNUOlxuXHQgICAgICAgIHRoaXMub25kaXNjb25uZWN0KCk7XG5cdCAgICAgICAgYnJlYWs7XG5cblx0ICAgICAgY2FzZSBwYXJzZXIkMi5FUlJPUjpcblx0ICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgcGFja2V0LmRhdGEpO1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBhIHNlcnZlciBldmVudC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25ldmVudCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHZhciBhcmdzID0gcGFja2V0LmRhdGEgfHwgW107XG5cdCAgICBkZWJ1ZygnZW1pdHRpbmcgZXZlbnQgJWonLCBhcmdzKTtcblxuXHQgICAgaWYgKG51bGwgIT0gcGFja2V0LmlkKSB7XG5cdCAgICAgIGRlYnVnKCdhdHRhY2hpbmcgYWNrIGNhbGxiYWNrIHRvIGV2ZW50Jyk7XG5cdCAgICAgIGFyZ3MucHVzaCh0aGlzLmFjayhwYWNrZXQuaWQpKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG5cdCAgICAgIGVtaXQuYXBwbHkodGhpcywgYXJncyk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0aGlzLnJlY2VpdmVCdWZmZXIucHVzaChhcmdzKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogUHJvZHVjZXMgYW4gYWNrIGNhbGxiYWNrIHRvIGVtaXQgd2l0aCBhbiBldmVudC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5hY2sgPSBmdW5jdGlvbiAoaWQpIHtcblx0ICAgIHZhciBzZWxmID0gdGhpcztcblx0ICAgIHZhciBzZW50ID0gZmFsc2U7XG5cdCAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuXHQgICAgICAvLyBwcmV2ZW50IGRvdWJsZSBjYWxsYmFja3Ncblx0ICAgICAgaWYgKHNlbnQpIHJldHVybjtcblx0ICAgICAgc2VudCA9IHRydWU7XG5cdCAgICAgIHZhciBhcmdzID0gdG9BcnJheSQzKGFyZ3VtZW50cyk7XG5cdCAgICAgIGRlYnVnKCdzZW5kaW5nIGFjayAlaicsIGFyZ3MpO1xuXG5cdCAgICAgIHNlbGYucGFja2V0KHtcblx0ICAgICAgICB0eXBlOiBoYXNCaW5hcnkkMShhcmdzKSA/IHBhcnNlciQyLkJJTkFSWV9BQ0sgOiBwYXJzZXIkMi5BQ0ssXG5cdCAgICAgICAgaWQ6IGlkLFxuXHQgICAgICAgIGRhdGE6IGFyZ3Ncblx0ICAgICAgfSk7XG5cdCAgICB9O1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBhIHNlcnZlciBhY2tub3dsZWdlbWVudC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25hY2sgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICB2YXIgYWNrID0gdGhpcy5hY2tzW3BhY2tldC5pZF07XG5cdCAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFjaykge1xuXHQgICAgICBkZWJ1ZygnY2FsbGluZyBhY2sgJXMgd2l0aCAlaicsIHBhY2tldC5pZCwgcGFja2V0LmRhdGEpO1xuXHQgICAgICBhY2suYXBwbHkodGhpcywgcGFja2V0LmRhdGEpO1xuXHQgICAgICBkZWxldGUgdGhpcy5hY2tzW3BhY2tldC5pZF07XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBkZWJ1ZygnYmFkIGFjayAlcycsIHBhY2tldC5pZCk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIHNlcnZlciBjb25uZWN0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZTtcblx0ICAgIHRoaXMuZGlzY29ubmVjdGVkID0gZmFsc2U7XG5cdCAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnKTtcblx0ICAgIHRoaXMuZW1pdEJ1ZmZlcmVkKCk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEVtaXQgYnVmZmVyZWQgZXZlbnRzIChyZWNlaXZlZCBhbmQgZW1pdHRlZCkuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuZW1pdEJ1ZmZlcmVkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgdmFyIGk7XG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5yZWNlaXZlQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGVtaXQuYXBwbHkodGhpcywgdGhpcy5yZWNlaXZlQnVmZmVyW2ldKTtcblx0ICAgIH1cblx0ICAgIHRoaXMucmVjZWl2ZUJ1ZmZlciA9IFtdO1xuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5zZW5kQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIHRoaXMucGFja2V0KHRoaXMuc2VuZEJ1ZmZlcltpXSk7XG5cdCAgICB9XG5cdCAgICB0aGlzLnNlbmRCdWZmZXIgPSBbXTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gc2VydmVyIGRpc2Nvbm5lY3QuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub25kaXNjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgZGVidWcoJ3NlcnZlciBkaXNjb25uZWN0ICglcyknLCB0aGlzLm5zcCk7XG5cdCAgICB0aGlzLmRlc3Ryb3koKTtcblx0ICAgIHRoaXMub25jbG9zZSgnaW8gc2VydmVyIGRpc2Nvbm5lY3QnKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gZm9yY2VkIGNsaWVudC9zZXJ2ZXIgc2lkZSBkaXNjb25uZWN0aW9ucyxcblx0ICAgKiB0aGlzIG1ldGhvZCBlbnN1cmVzIHRoZSBtYW5hZ2VyIHN0b3BzIHRyYWNraW5nIHVzIGFuZFxuXHQgICAqIHRoYXQgcmVjb25uZWN0aW9ucyBkb24ndCBnZXQgdHJpZ2dlcmVkIGZvciB0aGlzLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlLlxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKHRoaXMuc3Vicykge1xuXHQgICAgICAvLyBjbGVhbiBzdWJzY3JpcHRpb25zIHRvIGF2b2lkIHJlY29ubmVjdGlvbnNcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnN1YnMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICB0aGlzLnN1YnNbaV0uZGVzdHJveSgpO1xuXHQgICAgICB9XG5cdCAgICAgIHRoaXMuc3VicyA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuaW8uZGVzdHJveSh0aGlzKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRGlzY29ubmVjdHMgdGhlIHNvY2tldCBtYW51YWxseS5cblx0ICAgKlxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmNsb3NlID0gU29ja2V0LnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG5cdCAgICAgIGRlYnVnKCdwZXJmb3JtaW5nIGRpc2Nvbm5lY3QgKCVzKScsIHRoaXMubnNwKTtcblx0ICAgICAgdGhpcy5wYWNrZXQoeyB0eXBlOiBwYXJzZXIkMi5ESVNDT05ORUNUIH0pO1xuXHQgICAgfVxuXG5cdCAgICAvLyByZW1vdmUgc29ja2V0IGZyb20gcG9vbFxuXHQgICAgdGhpcy5kZXN0cm95KCk7XG5cblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICAvLyBmaXJlIGV2ZW50c1xuXHQgICAgICB0aGlzLm9uY2xvc2UoJ2lvIGNsaWVudCBkaXNjb25uZWN0Jyk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogU2V0cyB0aGUgY29tcHJlc3MgZmxhZy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7Qm9vbGVhbn0gaWYgYHRydWVgLCBjb21wcmVzc2VzIHRoZSBzZW5kaW5nIGRhdGFcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5jb21wcmVzcyA9IGZ1bmN0aW9uIChjb21wcmVzcykge1xuXHQgICAgdGhpcy5mbGFncy5jb21wcmVzcyA9IGNvbXByZXNzO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNldHMgdGhlIGJpbmFyeSBmbGFnXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0Jvb2xlYW59IHdoZXRoZXIgdGhlIGVtaXR0ZWQgZGF0YSBjb250YWlucyBiaW5hcnlcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5iaW5hcnkgPSBmdW5jdGlvbiAoYmluYXJ5KSB7XG5cdCAgICB0aGlzLmZsYWdzLmJpbmFyeSA9IGJpbmFyeTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cdH0pO1xuXG5cdHZhciBzb2NrZXQkMyA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBzb2NrZXQkMixcblx0XHRfX21vZHVsZUV4cG9ydHM6IHNvY2tldCQyXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBFeHBvc2UgYEJhY2tvZmZgLlxuXHQgKi9cblxuXHR2YXIgYmFja28yID0gQmFja29mZjtcblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBiYWNrb2ZmIHRpbWVyIHdpdGggYG9wdHNgLlxuXHQgKlxuXHQgKiAtIGBtaW5gIGluaXRpYWwgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgWzEwMF1cblx0ICogLSBgbWF4YCBtYXggdGltZW91dCBbMTAwMDBdXG5cdCAqIC0gYGppdHRlcmAgWzBdXG5cdCAqIC0gYGZhY3RvcmAgWzJdXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIEJhY2tvZmYob3B0cykge1xuXHQgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXHQgIHRoaXMubXMgPSBvcHRzLm1pbiB8fCAxMDA7XG5cdCAgdGhpcy5tYXggPSBvcHRzLm1heCB8fCAxMDAwMDtcblx0ICB0aGlzLmZhY3RvciA9IG9wdHMuZmFjdG9yIHx8IDI7XG5cdCAgdGhpcy5qaXR0ZXIgPSBvcHRzLmppdHRlciA+IDAgJiYgb3B0cy5qaXR0ZXIgPD0gMSA/IG9wdHMuaml0dGVyIDogMDtcblx0ICB0aGlzLmF0dGVtcHRzID0gMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGJhY2tvZmYgZHVyYXRpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge051bWJlcn1cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUuZHVyYXRpb24gPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIG1zID0gdGhpcy5tcyAqIE1hdGgucG93KHRoaXMuZmFjdG9yLCB0aGlzLmF0dGVtcHRzKyspO1xuXHQgIGlmICh0aGlzLmppdHRlcikge1xuXHQgICAgdmFyIHJhbmQgPSBNYXRoLnJhbmRvbSgpO1xuXHQgICAgdmFyIGRldmlhdGlvbiA9IE1hdGguZmxvb3IocmFuZCAqIHRoaXMuaml0dGVyICogbXMpO1xuXHQgICAgbXMgPSAoTWF0aC5mbG9vcihyYW5kICogMTApICYgMSkgPT0gMCA/IG1zIC0gZGV2aWF0aW9uIDogbXMgKyBkZXZpYXRpb247XG5cdCAgfVxuXHQgIHJldHVybiBNYXRoLm1pbihtcywgdGhpcy5tYXgpIHwgMDtcblx0fTtcblxuXHQvKipcblx0ICogUmVzZXQgdGhlIG51bWJlciBvZiBhdHRlbXB0cy5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5hdHRlbXB0cyA9IDA7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgbWluaW11bSBkdXJhdGlvblxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5zZXRNaW4gPSBmdW5jdGlvbiAobWluKSB7XG5cdCAgdGhpcy5tcyA9IG1pbjtcblx0fTtcblxuXHQvKipcblx0ICogU2V0IHRoZSBtYXhpbXVtIGR1cmF0aW9uXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnNldE1heCA9IGZ1bmN0aW9uIChtYXgpIHtcblx0ICB0aGlzLm1heCA9IG1heDtcblx0fTtcblxuXHQvKipcblx0ICogU2V0IHRoZSBqaXR0ZXJcblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUuc2V0Sml0dGVyID0gZnVuY3Rpb24gKGppdHRlcikge1xuXHQgIHRoaXMuaml0dGVyID0gaml0dGVyO1xuXHR9O1xuXG5cdHZhciBiYWNrbzIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBiYWNrbzIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBiYWNrbzJcblx0fSk7XG5cblx0dmFyIGVpbyA9ICggbGliJDEgJiYgbGliICkgfHwgbGliJDE7XG5cblx0dmFyIFNvY2tldCQxID0gKCBzb2NrZXQkMyAmJiBzb2NrZXQkMiApIHx8IHNvY2tldCQzO1xuXG5cdHZhciBCYWNrb2ZmJDEgPSAoIGJhY2tvMiQxICYmIGJhY2tvMiApIHx8IGJhY2tvMiQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudDptYW5hZ2VyJyk7XG5cblx0LyoqXG5cdCAqIElFNisgaGFzT3duUHJvcGVydHlcblx0ICovXG5cblx0dmFyIGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzXG5cdCAqL1xuXG5cdHZhciBtYW5hZ2VyID0gTWFuYWdlcjtcblxuXHQvKipcblx0ICogYE1hbmFnZXJgIGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZW5naW5lIGluc3RhbmNlIG9yIGVuZ2luZSB1cmkvb3B0c1xuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBNYW5hZ2VyKHVyaSwgb3B0cykge1xuXHQgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBNYW5hZ2VyKSkgcmV0dXJuIG5ldyBNYW5hZ2VyKHVyaSwgb3B0cyk7XG5cdCAgaWYgKHVyaSAmJiAnb2JqZWN0JyA9PT0gKHR5cGVvZiB1cmkgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHVyaSkpKSB7XG5cdCAgICBvcHRzID0gdXJpO1xuXHQgICAgdXJpID0gdW5kZWZpbmVkO1xuXHQgIH1cblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblxuXHQgIG9wdHMucGF0aCA9IG9wdHMucGF0aCB8fCAnL3NvY2tldC5pbyc7XG5cdCAgdGhpcy5uc3BzID0ge307XG5cdCAgdGhpcy5zdWJzID0gW107XG5cdCAgdGhpcy5vcHRzID0gb3B0cztcblx0ICB0aGlzLnJlY29ubmVjdGlvbihvcHRzLnJlY29ubmVjdGlvbiAhPT0gZmFsc2UpO1xuXHQgIHRoaXMucmVjb25uZWN0aW9uQXR0ZW1wdHMob3B0cy5yZWNvbm5lY3Rpb25BdHRlbXB0cyB8fCBJbmZpbml0eSk7XG5cdCAgdGhpcy5yZWNvbm5lY3Rpb25EZWxheShvcHRzLnJlY29ubmVjdGlvbkRlbGF5IHx8IDEwMDApO1xuXHQgIHRoaXMucmVjb25uZWN0aW9uRGVsYXlNYXgob3B0cy5yZWNvbm5lY3Rpb25EZWxheU1heCB8fCA1MDAwKTtcblx0ICB0aGlzLnJhbmRvbWl6YXRpb25GYWN0b3Iob3B0cy5yYW5kb21pemF0aW9uRmFjdG9yIHx8IDAuNSk7XG5cdCAgdGhpcy5iYWNrb2ZmID0gbmV3IEJhY2tvZmYkMSh7XG5cdCAgICBtaW46IHRoaXMucmVjb25uZWN0aW9uRGVsYXkoKSxcblx0ICAgIG1heDogdGhpcy5yZWNvbm5lY3Rpb25EZWxheU1heCgpLFxuXHQgICAgaml0dGVyOiB0aGlzLnJhbmRvbWl6YXRpb25GYWN0b3IoKVxuXHQgIH0pO1xuXHQgIHRoaXMudGltZW91dChudWxsID09IG9wdHMudGltZW91dCA/IDIwMDAwIDogb3B0cy50aW1lb3V0KTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICB0aGlzLnVyaSA9IHVyaTtcblx0ICB0aGlzLmNvbm5lY3RpbmcgPSBbXTtcblx0ICB0aGlzLmxhc3RQaW5nID0gbnVsbDtcblx0ICB0aGlzLmVuY29kaW5nID0gZmFsc2U7XG5cdCAgdGhpcy5wYWNrZXRCdWZmZXIgPSBbXTtcblx0ICB2YXIgX3BhcnNlciA9IG9wdHMucGFyc2VyIHx8IHBhcnNlciQyO1xuXHQgIHRoaXMuZW5jb2RlciA9IG5ldyBfcGFyc2VyLkVuY29kZXIoKTtcblx0ICB0aGlzLmRlY29kZXIgPSBuZXcgX3BhcnNlci5EZWNvZGVyKCk7XG5cdCAgdGhpcy5hdXRvQ29ubmVjdCA9IG9wdHMuYXV0b0Nvbm5lY3QgIT09IGZhbHNlO1xuXHQgIGlmICh0aGlzLmF1dG9Db25uZWN0KSB0aGlzLm9wZW4oKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcm9wYWdhdGUgZ2l2ZW4gZXZlbnQgdG8gc29ja2V0cyBhbmQgZW1pdCBvbiBgdGhpc2Bcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLmVtaXRBbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5lbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdCAgZm9yICh2YXIgbnNwIGluIHRoaXMubnNwcykge1xuXHQgICAgaWYgKGhhcy5jYWxsKHRoaXMubnNwcywgbnNwKSkge1xuXHQgICAgICB0aGlzLm5zcHNbbnNwXS5lbWl0LmFwcGx5KHRoaXMubnNwc1tuc3BdLCBhcmd1bWVudHMpO1xuXHQgICAgfVxuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogVXBkYXRlIGBzb2NrZXQuaWRgIG9mIGFsbCBzb2NrZXRzXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS51cGRhdGVTb2NrZXRJZHMgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZm9yICh2YXIgbnNwIGluIHRoaXMubnNwcykge1xuXHQgICAgaWYgKGhhcy5jYWxsKHRoaXMubnNwcywgbnNwKSkge1xuXHQgICAgICB0aGlzLm5zcHNbbnNwXS5pZCA9IHRoaXMuZ2VuZXJhdGVJZChuc3ApO1xuXHQgICAgfVxuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogZ2VuZXJhdGUgYHNvY2tldC5pZGAgZm9yIHRoZSBnaXZlbiBgbnNwYFxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbnNwXG5cdCAqIEByZXR1cm4ge1N0cmluZ31cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLmdlbmVyYXRlSWQgPSBmdW5jdGlvbiAobnNwKSB7XG5cdCAgcmV0dXJuIChuc3AgPT09ICcvJyA/ICcnIDogbnNwICsgJyMnKSArIHRoaXMuZW5naW5lLmlkO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKE1hbmFnZXIucHJvdG90eXBlKTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgYHJlY29ubmVjdGlvbmAgY29uZmlnLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IHRydWUvZmFsc2UgaWYgaXQgc2hvdWxkIGF1dG9tYXRpY2FsbHkgcmVjb25uZWN0XG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb247XG5cdCAgdGhpcy5fcmVjb25uZWN0aW9uID0gISF2O1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSByZWNvbm5lY3Rpb24gYXR0ZW1wdHMgY29uZmlnLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbWF4IHJlY29ubmVjdGlvbiBhdHRlbXB0cyBiZWZvcmUgZ2l2aW5nIHVwXG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uQXR0ZW1wdHMgPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzO1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzID0gdjtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgZGVsYXkgYmV0d2VlbiByZWNvbm5lY3Rpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yZWNvbm5lY3Rpb25EZWxheSA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uRGVsYXk7XG5cdCAgdGhpcy5fcmVjb25uZWN0aW9uRGVsYXkgPSB2O1xuXHQgIHRoaXMuYmFja29mZiAmJiB0aGlzLmJhY2tvZmYuc2V0TWluKHYpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJhbmRvbWl6YXRpb25GYWN0b3IgPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JhbmRvbWl6YXRpb25GYWN0b3I7XG5cdCAgdGhpcy5fcmFuZG9taXphdGlvbkZhY3RvciA9IHY7XG5cdCAgdGhpcy5iYWNrb2ZmICYmIHRoaXMuYmFja29mZi5zZXRKaXR0ZXIodik7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIG1heGltdW0gZGVsYXkgYmV0d2VlbiByZWNvbm5lY3Rpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGVsYXlcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yZWNvbm5lY3Rpb25EZWxheU1heCA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uRGVsYXlNYXg7XG5cdCAgdGhpcy5fcmVjb25uZWN0aW9uRGVsYXlNYXggPSB2O1xuXHQgIHRoaXMuYmFja29mZiAmJiB0aGlzLmJhY2tvZmYuc2V0TWF4KHYpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjb25uZWN0aW9uIHRpbWVvdXQuIGBmYWxzZWAgdG8gZGlzYWJsZVxuXHQgKlxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnRpbWVvdXQgPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3RpbWVvdXQ7XG5cdCAgdGhpcy5fdGltZW91dCA9IHY7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyB0cnlpbmcgdG8gcmVjb25uZWN0IGlmIHJlY29ubmVjdGlvbiBpcyBlbmFibGVkIGFuZCB3ZSBoYXZlIG5vdFxuXHQgKiBzdGFydGVkIHJlY29ubmVjdGluZyB5ZXRcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm1heWJlUmVjb25uZWN0T25PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIC8vIE9ubHkgdHJ5IHRvIHJlY29ubmVjdCBpZiBpdCdzIHRoZSBmaXJzdCB0aW1lIHdlJ3JlIGNvbm5lY3Rpbmdcblx0ICBpZiAoIXRoaXMucmVjb25uZWN0aW5nICYmIHRoaXMuX3JlY29ubmVjdGlvbiAmJiB0aGlzLmJhY2tvZmYuYXR0ZW1wdHMgPT09IDApIHtcblx0ICAgIC8vIGtlZXBzIHJlY29ubmVjdGlvbiBmcm9tIGZpcmluZyB0d2ljZSBmb3IgdGhlIHNhbWUgcmVjb25uZWN0aW9uIGxvb3Bcblx0ICAgIHRoaXMucmVjb25uZWN0KCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjdXJyZW50IHRyYW5zcG9ydCBgc29ja2V0YC5cblx0ICpcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9uYWwsIGNhbGxiYWNrXG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGZcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub3BlbiA9IE1hbmFnZXIucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbiAoZm4sIG9wdHMpIHtcblx0ICBkZWJ1ZyQ3KCdyZWFkeVN0YXRlICVzJywgdGhpcy5yZWFkeVN0YXRlKTtcblx0ICBpZiAofnRoaXMucmVhZHlTdGF0ZS5pbmRleE9mKCdvcGVuJykpIHJldHVybiB0aGlzO1xuXG5cdCAgZGVidWckNygnb3BlbmluZyAlcycsIHRoaXMudXJpKTtcblx0ICB0aGlzLmVuZ2luZSA9IGVpbyh0aGlzLnVyaSwgdGhpcy5vcHRzKTtcblx0ICB2YXIgc29ja2V0ID0gdGhpcy5lbmdpbmU7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuaW5nJztcblx0ICB0aGlzLnNraXBSZWNvbm5lY3QgPSBmYWxzZTtcblxuXHQgIC8vIGVtaXQgYG9wZW5gXG5cdCAgdmFyIG9wZW5TdWIgPSBvbiQyKHNvY2tldCwgJ29wZW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9ub3BlbigpO1xuXHQgICAgZm4gJiYgZm4oKTtcblx0ICB9KTtcblxuXHQgIC8vIGVtaXQgYGNvbm5lY3RfZXJyb3JgXG5cdCAgdmFyIGVycm9yU3ViID0gb24kMihzb2NrZXQsICdlcnJvcicsIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICBkZWJ1ZyQ3KCdjb25uZWN0X2Vycm9yJyk7XG5cdCAgICBzZWxmLmNsZWFudXAoKTtcblx0ICAgIHNlbGYucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXHQgICAgc2VsZi5lbWl0QWxsKCdjb25uZWN0X2Vycm9yJywgZGF0YSk7XG5cdCAgICBpZiAoZm4pIHtcblx0ICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignQ29ubmVjdGlvbiBlcnJvcicpO1xuXHQgICAgICBlcnIuZGF0YSA9IGRhdGE7XG5cdCAgICAgIGZuKGVycik7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICAvLyBPbmx5IGRvIHRoaXMgaWYgdGhlcmUgaXMgbm8gZm4gdG8gaGFuZGxlIHRoZSBlcnJvclxuXHQgICAgICBzZWxmLm1heWJlUmVjb25uZWN0T25PcGVuKCk7XG5cdCAgICB9XG5cdCAgfSk7XG5cblx0ICAvLyBlbWl0IGBjb25uZWN0X3RpbWVvdXRgXG5cdCAgaWYgKGZhbHNlICE9PSB0aGlzLl90aW1lb3V0KSB7XG5cdCAgICB2YXIgdGltZW91dCA9IHRoaXMuX3RpbWVvdXQ7XG5cdCAgICBkZWJ1ZyQ3KCdjb25uZWN0IGF0dGVtcHQgd2lsbCB0aW1lb3V0IGFmdGVyICVkJywgdGltZW91dCk7XG5cblx0ICAgIC8vIHNldCB0aW1lclxuXHQgICAgdmFyIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGRlYnVnJDcoJ2Nvbm5lY3QgYXR0ZW1wdCB0aW1lZCBvdXQgYWZ0ZXIgJWQnLCB0aW1lb3V0KTtcblx0ICAgICAgb3BlblN1Yi5kZXN0cm95KCk7XG5cdCAgICAgIHNvY2tldC5jbG9zZSgpO1xuXHQgICAgICBzb2NrZXQuZW1pdCgnZXJyb3InLCAndGltZW91dCcpO1xuXHQgICAgICBzZWxmLmVtaXRBbGwoJ2Nvbm5lY3RfdGltZW91dCcsIHRpbWVvdXQpO1xuXHQgICAgfSwgdGltZW91dCk7XG5cblx0ICAgIHRoaXMuc3Vicy5wdXNoKHtcblx0ICAgICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0ICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuXHQgICAgICB9XG5cdCAgICB9KTtcblx0ICB9XG5cblx0ICB0aGlzLnN1YnMucHVzaChvcGVuU3ViKTtcblx0ICB0aGlzLnN1YnMucHVzaChlcnJvclN1Yik7XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gdHJhbnNwb3J0IG9wZW4uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNygnb3BlbicpO1xuXG5cdCAgLy8gY2xlYXIgb2xkIHN1YnNcblx0ICB0aGlzLmNsZWFudXAoKTtcblxuXHQgIC8vIG1hcmsgYXMgb3BlblxuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdvcGVuJztcblx0ICB0aGlzLmVtaXQoJ29wZW4nKTtcblxuXHQgIC8vIGFkZCBuZXcgc3Vic1xuXHQgIHZhciBzb2NrZXQgPSB0aGlzLmVuZ2luZTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ2RhdGEnLCBiaW5kKHRoaXMsICdvbmRhdGEnKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAncGluZycsIGJpbmQodGhpcywgJ29ucGluZycpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdwb25nJywgYmluZCh0aGlzLCAnb25wb25nJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ2Vycm9yJywgYmluZCh0aGlzLCAnb25lcnJvcicpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdjbG9zZScsIGJpbmQodGhpcywgJ29uY2xvc2UnKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIodGhpcy5kZWNvZGVyLCAnZGVjb2RlZCcsIGJpbmQodGhpcywgJ29uZGVjb2RlZCcpKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGEgcGluZy5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9ucGluZyA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmxhc3RQaW5nID0gbmV3IERhdGUoKTtcblx0ICB0aGlzLmVtaXRBbGwoJ3BpbmcnKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbnBvbmcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5lbWl0QWxsKCdwb25nJywgbmV3IERhdGUoKSAtIHRoaXMubGFzdFBpbmcpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2l0aCBkYXRhLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25kYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB0aGlzLmRlY29kZXIuYWRkKGRhdGEpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiBwYXJzZXIgZnVsbHkgZGVjb2RlcyBhIHBhY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uZGVjb2RlZCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICB0aGlzLmVtaXQoJ3BhY2tldCcsIHBhY2tldCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHNvY2tldCBlcnJvci5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uZXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG5cdCAgZGVidWckNygnZXJyb3InLCBlcnIpO1xuXHQgIHRoaXMuZW1pdEFsbCgnZXJyb3InLCBlcnIpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHNvY2tldCBmb3IgdGhlIGdpdmVuIGBuc3BgLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtTb2NrZXR9XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnNvY2tldCA9IGZ1bmN0aW9uIChuc3AsIG9wdHMpIHtcblx0ICB2YXIgc29ja2V0ID0gdGhpcy5uc3BzW25zcF07XG5cdCAgaWYgKCFzb2NrZXQpIHtcblx0ICAgIHNvY2tldCA9IG5ldyBTb2NrZXQkMSh0aGlzLCBuc3AsIG9wdHMpO1xuXHQgICAgdGhpcy5uc3BzW25zcF0gPSBzb2NrZXQ7XG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgICBzb2NrZXQub24oJ2Nvbm5lY3RpbmcnLCBvbkNvbm5lY3RpbmcpO1xuXHQgICAgc29ja2V0Lm9uKCdjb25uZWN0JywgZnVuY3Rpb24gKCkge1xuXHQgICAgICBzb2NrZXQuaWQgPSBzZWxmLmdlbmVyYXRlSWQobnNwKTtcblx0ICAgIH0pO1xuXG5cdCAgICBpZiAodGhpcy5hdXRvQ29ubmVjdCkge1xuXHQgICAgICAvLyBtYW51YWxseSBjYWxsIGhlcmUgc2luY2UgY29ubmVjdGluZyBldmVudCBpcyBmaXJlZCBiZWZvcmUgbGlzdGVuaW5nXG5cdCAgICAgIG9uQ29ubmVjdGluZygpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIG9uQ29ubmVjdGluZygpIHtcblx0ICAgIGlmICghfmluZGV4KHNlbGYuY29ubmVjdGluZywgc29ja2V0KSkge1xuXHQgICAgICBzZWxmLmNvbm5lY3RpbmcucHVzaChzb2NrZXQpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBzb2NrZXQ7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGEgc29ja2V0IGNsb3NlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1NvY2tldH0gc29ja2V0XG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoc29ja2V0KSB7XG5cdCAgdmFyIGluZGV4JCQxID0gaW5kZXgodGhpcy5jb25uZWN0aW5nLCBzb2NrZXQpO1xuXHQgIGlmICh+aW5kZXgkJDEpIHRoaXMuY29ubmVjdGluZy5zcGxpY2UoaW5kZXgkJDEsIDEpO1xuXHQgIGlmICh0aGlzLmNvbm5lY3RpbmcubGVuZ3RoKSByZXR1cm47XG5cblx0ICB0aGlzLmNsb3NlKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyBhIHBhY2tldC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIGRlYnVnJDcoJ3dyaXRpbmcgcGFja2V0ICVqJywgcGFja2V0KTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgaWYgKHBhY2tldC5xdWVyeSAmJiBwYWNrZXQudHlwZSA9PT0gMCkgcGFja2V0Lm5zcCArPSAnPycgKyBwYWNrZXQucXVlcnk7XG5cblx0ICBpZiAoIXNlbGYuZW5jb2RpbmcpIHtcblx0ICAgIC8vIGVuY29kZSwgdGhlbiB3cml0ZSB0byBlbmdpbmUgd2l0aCByZXN1bHRcblx0ICAgIHNlbGYuZW5jb2RpbmcgPSB0cnVlO1xuXHQgICAgdGhpcy5lbmNvZGVyLmVuY29kZShwYWNrZXQsIGZ1bmN0aW9uIChlbmNvZGVkUGFja2V0cykge1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVuY29kZWRQYWNrZXRzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgc2VsZi5lbmdpbmUud3JpdGUoZW5jb2RlZFBhY2tldHNbaV0sIHBhY2tldC5vcHRpb25zKTtcblx0ICAgICAgfVxuXHQgICAgICBzZWxmLmVuY29kaW5nID0gZmFsc2U7XG5cdCAgICAgIHNlbGYucHJvY2Vzc1BhY2tldFF1ZXVlKCk7XG5cdCAgICB9KTtcblx0ICB9IGVsc2Uge1xuXHQgICAgLy8gYWRkIHBhY2tldCB0byB0aGUgcXVldWVcblx0ICAgIHNlbGYucGFja2V0QnVmZmVyLnB1c2gocGFja2V0KTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIElmIHBhY2tldCBidWZmZXIgaXMgbm9uLWVtcHR5LCBiZWdpbnMgZW5jb2RpbmcgdGhlXG5cdCAqIG5leHQgcGFja2V0IGluIGxpbmUuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5wcm9jZXNzUGFja2V0UXVldWUgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHRoaXMucGFja2V0QnVmZmVyLmxlbmd0aCA+IDAgJiYgIXRoaXMuZW5jb2RpbmcpIHtcblx0ICAgIHZhciBwYWNrID0gdGhpcy5wYWNrZXRCdWZmZXIuc2hpZnQoKTtcblx0ICAgIHRoaXMucGFja2V0KHBhY2spO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2xlYW4gdXAgdHJhbnNwb3J0IHN1YnNjcmlwdGlvbnMgYW5kIHBhY2tldCBidWZmZXIuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5jbGVhbnVwID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDcoJ2NsZWFudXAnKTtcblxuXHQgIHZhciBzdWJzTGVuZ3RoID0gdGhpcy5zdWJzLmxlbmd0aDtcblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNMZW5ndGg7IGkrKykge1xuXHQgICAgdmFyIHN1YiA9IHRoaXMuc3Vicy5zaGlmdCgpO1xuXHQgICAgc3ViLmRlc3Ryb3koKTtcblx0ICB9XG5cblx0ICB0aGlzLnBhY2tldEJ1ZmZlciA9IFtdO1xuXHQgIHRoaXMuZW5jb2RpbmcgPSBmYWxzZTtcblx0ICB0aGlzLmxhc3RQaW5nID0gbnVsbDtcblxuXHQgIHRoaXMuZGVjb2Rlci5kZXN0cm95KCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlIHRoZSBjdXJyZW50IHNvY2tldC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLmNsb3NlID0gTWFuYWdlci5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ3KCdkaXNjb25uZWN0Jyk7XG5cdCAgdGhpcy5za2lwUmVjb25uZWN0ID0gdHJ1ZTtcblx0ICB0aGlzLnJlY29ubmVjdGluZyA9IGZhbHNlO1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgLy8gYG9uY2xvc2VgIHdpbGwgbm90IGZpcmUgYmVjYXVzZVxuXHQgICAgLy8gYW4gb3BlbiBldmVudCBuZXZlciBoYXBwZW5lZFxuXHQgICAgdGhpcy5jbGVhbnVwKCk7XG5cdCAgfVxuXHQgIHRoaXMuYmFja29mZi5yZXNldCgpO1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICdjbG9zZWQnO1xuXHQgIGlmICh0aGlzLmVuZ2luZSkgdGhpcy5lbmdpbmUuY2xvc2UoKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gZW5naW5lIGNsb3NlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25jbG9zZSA9IGZ1bmN0aW9uIChyZWFzb24pIHtcblx0ICBkZWJ1ZyQ3KCdvbmNsb3NlJyk7XG5cblx0ICB0aGlzLmNsZWFudXAoKTtcblx0ICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICB0aGlzLmVtaXQoJ2Nsb3NlJywgcmVhc29uKTtcblxuXHQgIGlmICh0aGlzLl9yZWNvbm5lY3Rpb24gJiYgIXRoaXMuc2tpcFJlY29ubmVjdCkge1xuXHQgICAgdGhpcy5yZWNvbm5lY3QoKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEF0dGVtcHQgYSByZWNvbm5lY3Rpb24uXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yZWNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHRoaXMucmVjb25uZWN0aW5nIHx8IHRoaXMuc2tpcFJlY29ubmVjdCkgcmV0dXJuIHRoaXM7XG5cblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBpZiAodGhpcy5iYWNrb2ZmLmF0dGVtcHRzID49IHRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzKSB7XG5cdCAgICBkZWJ1ZyQ3KCdyZWNvbm5lY3QgZmFpbGVkJyk7XG5cdCAgICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICAgIHRoaXMuZW1pdEFsbCgncmVjb25uZWN0X2ZhaWxlZCcpO1xuXHQgICAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICB9IGVsc2Uge1xuXHQgICAgdmFyIGRlbGF5ID0gdGhpcy5iYWNrb2ZmLmR1cmF0aW9uKCk7XG5cdCAgICBkZWJ1ZyQ3KCd3aWxsIHdhaXQgJWRtcyBiZWZvcmUgcmVjb25uZWN0IGF0dGVtcHQnLCBkZWxheSk7XG5cblx0ICAgIHRoaXMucmVjb25uZWN0aW5nID0gdHJ1ZTtcblx0ICAgIHZhciB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBpZiAoc2VsZi5za2lwUmVjb25uZWN0KSByZXR1cm47XG5cblx0ICAgICAgZGVidWckNygnYXR0ZW1wdGluZyByZWNvbm5lY3QnKTtcblx0ICAgICAgc2VsZi5lbWl0QWxsKCdyZWNvbm5lY3RfYXR0ZW1wdCcsIHNlbGYuYmFja29mZi5hdHRlbXB0cyk7XG5cdCAgICAgIHNlbGYuZW1pdEFsbCgncmVjb25uZWN0aW5nJywgc2VsZi5iYWNrb2ZmLmF0dGVtcHRzKTtcblxuXHQgICAgICAvLyBjaGVjayBhZ2FpbiBmb3IgdGhlIGNhc2Ugc29ja2V0IGNsb3NlZCBpbiBhYm92ZSBldmVudHNcblx0ICAgICAgaWYgKHNlbGYuc2tpcFJlY29ubmVjdCkgcmV0dXJuO1xuXG5cdCAgICAgIHNlbGYub3BlbihmdW5jdGlvbiAoZXJyKSB7XG5cdCAgICAgICAgaWYgKGVycikge1xuXHQgICAgICAgICAgZGVidWckNygncmVjb25uZWN0IGF0dGVtcHQgZXJyb3InKTtcblx0ICAgICAgICAgIHNlbGYucmVjb25uZWN0aW5nID0gZmFsc2U7XG5cdCAgICAgICAgICBzZWxmLnJlY29ubmVjdCgpO1xuXHQgICAgICAgICAgc2VsZi5lbWl0QWxsKCdyZWNvbm5lY3RfZXJyb3InLCBlcnIuZGF0YSk7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGRlYnVnJDcoJ3JlY29ubmVjdCBzdWNjZXNzJyk7XG5cdCAgICAgICAgICBzZWxmLm9ucmVjb25uZWN0KCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9KTtcblx0ICAgIH0sIGRlbGF5KTtcblxuXHQgICAgdGhpcy5zdWJzLnB1c2goe1xuXHQgICAgICBkZXN0cm95OiBmdW5jdGlvbiBkZXN0cm95KCkge1xuXHQgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG5cdCAgICAgIH1cblx0ICAgIH0pO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gc3VjY2Vzc2Z1bCByZWNvbm5lY3QuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbnJlY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgYXR0ZW1wdCA9IHRoaXMuYmFja29mZi5hdHRlbXB0cztcblx0ICB0aGlzLnJlY29ubmVjdGluZyA9IGZhbHNlO1xuXHQgIHRoaXMuYmFja29mZi5yZXNldCgpO1xuXHQgIHRoaXMudXBkYXRlU29ja2V0SWRzKCk7XG5cdCAgdGhpcy5lbWl0QWxsKCdyZWNvbm5lY3QnLCBhdHRlbXB0KTtcblx0fTtcblxuXHR2YXIgbWFuYWdlciQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IG1hbmFnZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBtYW5hZ2VyXG5cdH0pO1xuXG5cdHZhciB1cmwkMiA9ICggdXJsJDEgJiYgdXJsXzEgKSB8fCB1cmwkMTtcblxuXHR2YXIgTWFuYWdlciQxID0gKCBtYW5hZ2VyJDEgJiYgbWFuYWdlciApIHx8IG1hbmFnZXIkMTtcblxuXHR2YXIgbGliJDIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBkZWJ1ZyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudCcpO1xuXG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGV4cG9ydHMuXG5cdCAgICovXG5cblx0ICBtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBsb29rdXA7XG5cblx0ICAvKipcblx0ICAgKiBNYW5hZ2VycyBjYWNoZS5cblx0ICAgKi9cblxuXHQgIHZhciBjYWNoZSA9IGV4cG9ydHMubWFuYWdlcnMgPSB7fTtcblxuXHQgIC8qKlxuXHQgICAqIExvb2tzIHVwIGFuIGV4aXN0aW5nIGBNYW5hZ2VyYCBmb3IgbXVsdGlwbGV4aW5nLlxuXHQgICAqIElmIHRoZSB1c2VyIHN1bW1vbnM6XG5cdCAgICpcblx0ICAgKiAgIGBpbygnaHR0cDovL2xvY2FsaG9zdC9hJyk7YFxuXHQgICAqICAgYGlvKCdodHRwOi8vbG9jYWxob3N0L2InKTtgXG5cdCAgICpcblx0ICAgKiBXZSByZXVzZSB0aGUgZXhpc3RpbmcgaW5zdGFuY2UgYmFzZWQgb24gc2FtZSBzY2hlbWUvcG9ydC9ob3N0LFxuXHQgICAqIGFuZCB3ZSBpbml0aWFsaXplIHNvY2tldHMgZm9yIGVhY2ggbmFtZXNwYWNlLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGxvb2t1cCh1cmksIG9wdHMpIHtcblx0ICAgIGlmICgodHlwZW9mIHVyaSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodXJpKSkgPT09ICdvYmplY3QnKSB7XG5cdCAgICAgIG9wdHMgPSB1cmk7XG5cdCAgICAgIHVyaSA9IHVuZGVmaW5lZDtcblx0ICAgIH1cblxuXHQgICAgb3B0cyA9IG9wdHMgfHwge307XG5cblx0ICAgIHZhciBwYXJzZWQgPSB1cmwkMih1cmkpO1xuXHQgICAgdmFyIHNvdXJjZSA9IHBhcnNlZC5zb3VyY2U7XG5cdCAgICB2YXIgaWQgPSBwYXJzZWQuaWQ7XG5cdCAgICB2YXIgcGF0aCA9IHBhcnNlZC5wYXRoO1xuXHQgICAgdmFyIHNhbWVOYW1lc3BhY2UgPSBjYWNoZVtpZF0gJiYgcGF0aCBpbiBjYWNoZVtpZF0ubnNwcztcblx0ICAgIHZhciBuZXdDb25uZWN0aW9uID0gb3B0cy5mb3JjZU5ldyB8fCBvcHRzWydmb3JjZSBuZXcgY29ubmVjdGlvbiddIHx8IGZhbHNlID09PSBvcHRzLm11bHRpcGxleCB8fCBzYW1lTmFtZXNwYWNlO1xuXG5cdCAgICB2YXIgaW87XG5cblx0ICAgIGlmIChuZXdDb25uZWN0aW9uKSB7XG5cdCAgICAgIGRlYnVnKCdpZ25vcmluZyBzb2NrZXQgY2FjaGUgZm9yICVzJywgc291cmNlKTtcblx0ICAgICAgaW8gPSBNYW5hZ2VyJDEoc291cmNlLCBvcHRzKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGlmICghY2FjaGVbaWRdKSB7XG5cdCAgICAgICAgZGVidWcoJ25ldyBpbyBpbnN0YW5jZSBmb3IgJXMnLCBzb3VyY2UpO1xuXHQgICAgICAgIGNhY2hlW2lkXSA9IE1hbmFnZXIkMShzb3VyY2UsIG9wdHMpO1xuXHQgICAgICB9XG5cdCAgICAgIGlvID0gY2FjaGVbaWRdO1xuXHQgICAgfVxuXHQgICAgaWYgKHBhcnNlZC5xdWVyeSAmJiAhb3B0cy5xdWVyeSkge1xuXHQgICAgICBvcHRzLnF1ZXJ5ID0gcGFyc2VkLnF1ZXJ5O1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIGlvLnNvY2tldChwYXJzZWQucGF0aCwgb3B0cyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogUHJvdG9jb2wgdmVyc2lvbi5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnByb3RvY29sID0gcGFyc2VyJDIucHJvdG9jb2w7XG5cblx0ICAvKipcblx0ICAgKiBgY29ubmVjdGAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gdXJpXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuY29ubmVjdCA9IGxvb2t1cDtcblxuXHQgIC8qKlxuXHQgICAqIEV4cG9zZSBjb25zdHJ1Y3RvcnMgZm9yIHN0YW5kYWxvbmUgYnVpbGQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5NYW5hZ2VyID0gTWFuYWdlciQxO1xuXHQgIGV4cG9ydHMuU29ja2V0ID0gU29ja2V0JDE7XG5cdH0pO1xuXHR2YXIgbGliXzEgPSBsaWIkMi5tYW5hZ2Vycztcblx0dmFyIGxpYl8yID0gbGliJDIucHJvdG9jb2w7XG5cdHZhciBsaWJfMyA9IGxpYiQyLmNvbm5lY3Q7XG5cdHZhciBsaWJfNCA9IGxpYiQyLk1hbmFnZXI7XG5cdHZhciBsaWJfNSA9IGxpYiQyLlNvY2tldDtcblxuXHRmdW5jdGlvbiBleHRlbmQoWSkge1xuXHQgICAgdmFyIENvbm5lY3RvciA9IGZ1bmN0aW9uIChfWSRBYnN0cmFjdENvbm5lY3Rvcikge1xuXHQgICAgICAgIGluaGVyaXRzKENvbm5lY3RvciwgX1kkQWJzdHJhY3RDb25uZWN0b3IpO1xuXG5cdCAgICAgICAgZnVuY3Rpb24gQ29ubmVjdG9yKHksIG9wdGlvbnMpIHtcblx0ICAgICAgICAgICAgY2xhc3NDYWxsQ2hlY2sodGhpcywgQ29ubmVjdG9yKTtcblxuXHQgICAgICAgICAgICBpZiAob3B0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG5cdCAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09wdGlvbnMgbXVzdCBub3QgYmUgdW5kZWZpbmVkIScpO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIG9wdGlvbnMucHJlZmVyVW50cmFuc2Zvcm1lZCA9IHRydWU7XG5cdCAgICAgICAgICAgIG9wdGlvbnMuZ2VuZXJhdGVVc2VySWQgPSBvcHRpb25zLmdlbmVyYXRlVXNlcklkIHx8IGZhbHNlO1xuXHQgICAgICAgICAgICBpZiAob3B0aW9ucy5pbml0U3luYyAhPT0gZmFsc2UpIHtcblx0ICAgICAgICAgICAgICAgIG9wdGlvbnMuaW5pdFN5bmMgPSB0cnVlO1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgdmFyIF90aGlzID0gcG9zc2libGVDb25zdHJ1Y3RvclJldHVybih0aGlzLCAoQ29ubmVjdG9yLl9fcHJvdG9fXyB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YoQ29ubmVjdG9yKSkuY2FsbCh0aGlzLCB5LCBvcHRpb25zKSk7XG5cblx0ICAgICAgICAgICAgX3RoaXMuX3NlbnRTeW5jID0gZmFsc2U7XG5cdCAgICAgICAgICAgIF90aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHQgICAgICAgICAgICBvcHRpb25zLnVybCA9IG9wdGlvbnMudXJsIHx8ICdodHRwczovL3lqcy5kYmlzLnJ3dGgtYWFjaGVuLmRlOjUwNzInO1xuXHQgICAgICAgICAgICB2YXIgc29ja2V0ID0gb3B0aW9ucy5zb2NrZXQgfHwgbGliJDIob3B0aW9ucy51cmwsIG9wdGlvbnMub3B0aW9ucyk7XG5cdCAgICAgICAgICAgIF90aGlzLnNvY2tldCA9IHNvY2tldDtcblx0ICAgICAgICAgICAgdmFyIHNlbGYgPSBfdGhpcztcblxuXHQgICAgICAgICAgICAvKioqKioqKioqKioqKioqKioqIHN0YXJ0IG1pbmltYWwgd2VicnRjICoqKioqKioqKioqKioqKioqKioqKiovXG5cdCAgICAgICAgICAgIHZhciBzaWduYWxpbmdfc29ja2V0ID0gc29ja2V0O1xuXHQgICAgICAgICAgICB2YXIgSUNFX1NFUlZFUlMgPSBbeyB1cmxzOiBcInN0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDJcIiB9LCB7IHVybHM6IFwidHVybjp0cnkucmVmYWN0b3JlZC5haTozNDc4XCIsIHVzZXJuYW1lOiBcInRlc3Q5OVwiLCBjcmVkZW50aWFsOiBcInRlc3RcIiB9XTtcblx0ICAgICAgICAgICAgdmFyIGRjcyA9IHt9O1xuXHQgICAgICAgICAgICBfdGhpcy5kY3MgPSBkY3M7XG5cdCAgICAgICAgICAgIF90aGlzLnNkY3MgPSBkY3M7XG5cdCAgICAgICAgICAgIHZhciBwZWVycyA9IHt9O1xuXHQgICAgICAgICAgICB2YXIgcGVlcl9tZWRpYV9lbGVtZW50cyA9IHt9O1xuXHQgICAgICAgICAgICB2YXIgc29ja2V0cztcblx0ICAgICAgICAgICAgX3RoaXMuc29ja2V0cyA9IHNvY2tldHM7XG5cblx0ICAgICAgICAgICAgZnVuY3Rpb24gcmVjZWl2ZURhdGEoeXdlYnJ0YywgcGVlcl9pZCkge1xuXHQgICAgICAgICAgICAgICAgdmFyIGJ1ZiwgY291bnQ7XG5cdCAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gb25tZXNzYWdlKGV2ZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBldmVudC5kYXRhID09PSAnc3RyaW5nJykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBidWYgPSBuZXcgVWludDhBcnJheShwYXJzZUludChldmVudC5kYXRhKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50ID0gMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IG5ldyBVaW50OEFycmF5KGV2ZW50LmRhdGEpO1xuXHQgICAgICAgICAgICAgICAgICAgIGJ1Zi5zZXQoZGF0YSwgY291bnQpO1xuXHQgICAgICAgICAgICAgICAgICAgIGNvdW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQgPT09IGJ1Zi5ieXRlTGVuZ3RoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZU1lc3NhZ2UocGVlcl9pZCwgYnVmKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9O1xuXHQgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgZnVuY3Rpb24gaW5pdCh5d2VicnRjKSB7XG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdjb25uZWN0JywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgIGpvaW5fY2hhdF9jaGFubmVsKHl3ZWJydGMub3B0aW9ucy5yb29tLCB7ICd3aGF0ZXZlci15b3Utd2FudC1oZXJlJzogJ3N0dWZmJyB9KTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdzb2NrZXRzJywgZnVuY3Rpb24gKHNvY2tldHMpIHtcblx0ICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc29ja2V0cyA9IHNvY2tldHM7XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignZGlzY29ubmVjdCcsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAvKiBUZWFyIGRvd24gYWxsIG9mIG91ciBwZWVyIGNvbm5lY3Rpb25zIGFuZCByZW1vdmUgYWxsIHRoZVxuXHQgICAgICAgICAgICAgICAgICAgICAqIG1lZGlhIGRpdnMgd2hlbiB3ZSBkaXNjb25uZWN0ICovXG5cdCAgICAgICAgICAgICAgICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJfbWVkaWFfZWxlbWVudHMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50c1twZWVyX2lkXS5yZW1vdmUoKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdLmNsb3NlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgcGVlcnMgPSB7fTtcblx0ICAgICAgICAgICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzID0ge307XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgZnVuY3Rpb24gam9pbl9jaGF0X2NoYW5uZWwoY2hhbm5lbCwgdXNlcmRhdGEpIHtcblx0ICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ2pvaW4nLCB7IFwiY2hhbm5lbFwiOiBjaGFubmVsLCBcInVzZXJkYXRhXCI6IHVzZXJkYXRhIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMudXNlcklEID0gc2lnbmFsaW5nX3NvY2tldC5pZDtcblx0ICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignYWRkUGVlcicsIGZ1bmN0aW9uIChjb25maWcpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcnMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgLyogVGhpcyBjb3VsZCBoYXBwZW4gaWYgdGhlIHVzZXIgam9pbnMgbXVsdGlwbGUgY2hhbm5lbHMgd2hlcmUgdGhlIG90aGVyIHBlZXIgaXMgYWxzbyBpbi4gKi9cblx0ICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2Nvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oeyBcImljZVNlcnZlcnNcIjogSUNFX1NFUlZFUlMgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0gPSBwZWVyX2Nvbm5lY3Rpb247XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YUNoYW5uZWwgPSBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoJ2RhdGEnKTtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgc3luY0RhdGFDaGFubmVsID0gcGVlcl9jb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKCdzeW5jX2RhdGEnKTtcblxuXHQgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXHQgICAgICAgICAgICAgICAgICAgIHN5bmNEYXRhQ2hhbm5lbC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblxuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMuZGNzW3BlZXJfaWRdID0gZGF0YUNoYW5uZWw7XG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5zZGNzW3BlZXJfaWRdID0gc3luY0RhdGFDaGFubmVsO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy51c2VySm9pbmVkKHBlZXJfaWQsICdtYXN0ZXInKTtcblxuXHQgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLm9ubWVzc2FnZSA9IHJlY2VpdmVEYXRhKHl3ZWJydGMsIHBlZXJfaWQpO1xuXHQgICAgICAgICAgICAgICAgICAgIHN5bmNEYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnJlY2VpdmVidWZmZXIocGVlcl9pZCwgZS5kYXRhKTtcblx0ICAgICAgICAgICAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICAgICAgICAgICAgcGVlcl9jb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudC5jYW5kaWRhdGUpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlJQ0VDYW5kaWRhdGUnLCB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3BlZXJfaWQnOiBwZWVyX2lkLFxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdpY2VfY2FuZGlkYXRlJzoge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc2RwTUxpbmVJbmRleCc6IGV2ZW50LmNhbmRpZGF0ZS5zZHBNTGluZUluZGV4LFxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY2FuZGlkYXRlJzogZXZlbnQuY2FuZGlkYXRlLmNhbmRpZGF0ZVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgfTtcblxuXHQgICAgICAgICAgICAgICAgICAgIGlmIChjb25maWcuc2hvdWxkX2NyZWF0ZV9vZmZlcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoZnVuY3Rpb24gKGxvY2FsX2Rlc2NyaXB0aW9uKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbF9kZXNjcmlwdGlvbiwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlTZXNzaW9uRGVzY3JpcHRpb24nLCB7ICdwZWVyX2lkJzogcGVlcl9pZCwgJ3Nlc3Npb25fZGVzY3JpcHRpb24nOiBsb2NhbF9kZXNjcmlwdGlvbiB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGVydChcIk9mZmVyIHNldExvY2FsRGVzY3JpcHRpb24gZmFpbGVkIVwiKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3Igc2VuZGluZyBvZmZlcjogXCIsIGVycm9yKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfSk7XG5cblx0ICAgICAgICAgICAgICAgIC8qKiBcblx0ICAgICAgICAgICAgICAgICAqIFBlZXJzIGV4Y2hhbmdlIHNlc3Npb24gZGVzY3JpcHRpb25zIHdoaWNoIGNvbnRhaW5zIGluZm9ybWF0aW9uXG5cdCAgICAgICAgICAgICAgICAgKiBhYm91dCB0aGVpciBhdWRpbyAvIHZpZGVvIHNldHRpbmdzIGFuZCB0aGF0IHNvcnQgb2Ygc3R1ZmYuIEZpcnN0XG5cdCAgICAgICAgICAgICAgICAgKiB0aGUgJ29mZmVyZXInIHNlbmRzIGEgZGVzY3JpcHRpb24gdG8gdGhlICdhbnN3ZXJlcicgKHdpdGggdHlwZVxuXHQgICAgICAgICAgICAgICAgICogXCJvZmZlclwiKSwgdGhlbiB0aGUgYW5zd2VyZXIgc2VuZHMgb25lIGJhY2sgKHdpdGggdHlwZSBcImFuc3dlclwiKS4gIFxuXHQgICAgICAgICAgICAgICAgICovXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdzZXNzaW9uRGVzY3JpcHRpb24nLCBmdW5jdGlvbiAoY29uZmlnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlciA9IHBlZXJzW3BlZXJfaWRdO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgcGVlci5vbmRhdGFjaGFubmVsID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhQ2hhbm5lbCA9IGV2ZW50LmNoYW5uZWw7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YUNoYW5uZWwubGFiZWwgPT0gJ3N5bmNfZGF0YScpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLm9ubWVzc2FnZSA9IHJlY2VpdmVEYXRhKHl3ZWJydGMsIHBlZXJfaWQpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnJlY2VpdmVidWZmZXIocGVlcl9pZCwgZS5kYXRhKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW90ZV9kZXNjcmlwdGlvbiA9IGNvbmZpZy5zZXNzaW9uX2Rlc2NyaXB0aW9uO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGRlc2MgPSBuZXcgUlRDU2Vzc2lvbkRlc2NyaXB0aW9uKHJlbW90ZV9kZXNjcmlwdGlvbik7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHN0dWZmID0gcGVlci5zZXRSZW1vdGVEZXNjcmlwdGlvbihkZXNjLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdGVfZGVzY3JpcHRpb24udHlwZSA9PSBcIm9mZmVyXCIpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXIuY3JlYXRlQW5zd2VyKGZ1bmN0aW9uIChsb2NhbF9kZXNjcmlwdGlvbikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXIuc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbF9kZXNjcmlwdGlvbiwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5U2Vzc2lvbkRlc2NyaXB0aW9uJywgeyAncGVlcl9pZCc6IHBlZXJfaWQsICdzZXNzaW9uX2Rlc2NyaXB0aW9uJzogbG9jYWxfZGVzY3JpcHRpb24gfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGVydChcIkFuc3dlciBzZXRMb2NhbERlc2NyaXB0aW9uIGZhaWxlZCFcIik7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVycm9yIGNyZWF0aW5nIGFuc3dlcjogXCIsIGVycm9yKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2V0UmVtb3RlRGVzY3JpcHRpb24gZXJyb3I6IFwiLCBlcnJvcik7XG5cdCAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbignaWNlQ2FuZGlkYXRlJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyID0gcGVlcnNbY29uZmlnLnBlZXJfaWRdO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBpY2VfY2FuZGlkYXRlID0gY29uZmlnLmljZV9jYW5kaWRhdGU7XG5cdCAgICAgICAgICAgICAgICAgICAgcGVlci5hZGRJY2VDYW5kaWRhdGUobmV3IFJUQ0ljZUNhbmRpZGF0ZShpY2VfY2FuZGlkYXRlKSk7XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5vbigncmVtb3ZlUGVlcicsIGZ1bmN0aW9uIChjb25maWcpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMudXNlckxlZnQocGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcl9tZWRpYV9lbGVtZW50cykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzW3BlZXJfaWRdLnJlbW92ZSgpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVycykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyc1twZWVyX2lkXS5jbG9zZSgpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBwZWVyc1twZWVyX2lkXTtcblx0ICAgICAgICAgICAgICAgICAgICBkZWxldGUgcGVlcl9tZWRpYV9lbGVtZW50c1tjb25maWcucGVlcl9pZF07XG5cdCAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICBpbml0KHNlbGYpO1xuXHQgICAgICAgICAgICAvKioqKioqKioqKioqKioqKioqKioqKioqIGVuZCBtaW5pbWFsX3dlYnJ0YyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXHQgICAgICAgICAgICByZXR1cm4gX3RoaXM7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgY3JlYXRlQ2xhc3MoQ29ubmVjdG9yLCBbe1xuXHQgICAgICAgICAgICBrZXk6ICdkaXNjb25uZWN0Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRpc2Nvbm5lY3QoKSB7fVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAnZGVzdHJveScsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBkZXN0cm95KCkge31cblx0ICAgICAgICB9LCB7XG5cdCAgICAgICAgICAgIGtleTogJ3JlY29ubmVjdCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiByZWNvbm5lY3QoKSB7fVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAnc2VuZCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBzZW5kKHVpZCwgbWVzc2FnZSkge1xuXHQgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJyQkJCQkJCQkJCQkJCQkJCQgc3luY2luZy4uLi4uLiAkJCQkJCQkJCQkJCQkJCQkJCcpO1xuXHQgICAgICAgICAgICAgICAgZnVuY3Rpb24gc2VuZDIoZGF0YUNoYW5uZWwsIGRhdGEyKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFDaGFubmVsLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB2YXIgQ0hVTktfTEVOID0gNjQwMDA7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhMi5ieXRlTGVuZ3RoO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbiA9IGxlbiAvIENIVU5LX0xFTiB8IDA7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQobGVuKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BsaXQgdGhlIHBob3RvIGFuZCBzZW5kIGluIGNodW5rcyBvZiBhYm91dCA2NEtCXG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RhcnQgPSBpICogQ0hVTktfTEVOLFxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZCA9IChpICsgMSkgKiBDSFVOS19MRU47XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5zZW5kKGRhdGEyLnN1YmFycmF5KHN0YXJ0LCBlbmQpKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIHRoZSByZW1pbmRlciwgaWYgYW55XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZW4gJSBDSFVOS19MRU4pIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQoZGF0YTIuc3ViYXJyYXkobiAqIENIVU5LX0xFTikpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChzZW5kMiwgNTAwLCBkYXRhQ2hhbm5lbCwgZGF0YTIpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIHNlbmQyKHRoaXMuc2Rjc1t1aWRdLCBuZXcgVWludDhBcnJheShtZXNzYWdlKSk7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICB9LCB7XG5cdCAgICAgICAgICAgIGtleTogJ2Jyb2FkY2FzdCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBicm9hZGNhc3QobWVzc2FnZSkge1xuXHQgICAgICAgICAgICAgICAgZm9yICh2YXIgcGVlcl9pZCBpbiB0aGlzLmRjcykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBzZW5kMiA9IGZ1bmN0aW9uIHNlbmQyKGRhdGFDaGFubmVsLCBkYXRhMikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YUNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgQ0hVTktfTEVOID0gNjQwMDA7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGVuID0gZGF0YTIuYnl0ZUxlbmd0aDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gbGVuIC8gQ0hVTktfTEVOIHwgMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQobGVuKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNwbGl0IHRoZSBwaG90byBhbmQgc2VuZCBpbiBjaHVua3Mgb2YgYWJvdXQgNjRLQlxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RhcnQgPSBpICogQ0hVTktfTEVOLFxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmQgPSAoaSArIDEpICogQ0hVTktfTEVOO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQoZGF0YTIuc3ViYXJyYXkoc3RhcnQsIGVuZCkpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2VuZCB0aGUgcmVtaW5kZXIsIGlmIGFueVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbiAlIENIVU5LX0xFTikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQoZGF0YTIuc3ViYXJyYXkobiAqIENIVU5LX0xFTikpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0VycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJyJywgcGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICAgICAgICAgICAgc2VuZDIodGhpcy5kY3NbcGVlcl9pZF0sIG5ldyBVaW50OEFycmF5KG1lc3NhZ2UpKTtcblx0ICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAnaXNEaXNjb25uZWN0ZWQnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gaXNEaXNjb25uZWN0ZWQoKSB7XG5cdCAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zb2NrZXQuZGlzY29ubmVjdGVkO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgfV0pO1xuXHQgICAgICAgIHJldHVybiBDb25uZWN0b3I7XG5cdCAgICB9KFkuQWJzdHJhY3RDb25uZWN0b3IpO1xuXG5cdCAgICBDb25uZWN0b3IuaW8gPSBsaWIkMjtcblx0ICAgIFlbJ3dlYnJ0YyddID0gQ29ubmVjdG9yO1xuXHR9XG5cblx0aWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuXHQgICAgZXh0ZW5kKFkpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdH1cblxuXHRyZXR1cm4gZXh0ZW5kO1xuXG59KSkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eS13ZWJydGMuanMubWFwXG4iLCIvKipcbiAqIHlqcyAtIEEgZnJhbWV3b3JrIGZvciByZWFsLXRpbWUgcDJwIHNoYXJlZCBlZGl0aW5nIG9uIGFueSBkYXRhXG4gKiBAdmVyc2lvbiB2MTMuMC4wLTY2XG4gKiBAbGljZW5zZSBNSVRcbiAqL1xuIWZ1bmN0aW9uKHQsZSl7XCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGU/bW9kdWxlLmV4cG9ydHM9ZSgpOlwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZD9kZWZpbmUoZSk6dC5ZPWUoKX0odGhpcyxmdW5jdGlvbigpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIHQodCxlLG4scil7aWYobnVsbD09PWUpdC5yb290PW4sbi5fcGFyZW50PW51bGw7ZWxzZSBpZihlLmxlZnQ9PT1yKWUubGVmdD1uO2Vsc2V7aWYoZS5yaWdodCE9PXIpdGhyb3cgbmV3IEVycm9yKFwiVGhlIGVsZW1lbnRzIGFyZSB3cm9uZ2x5IGNvbm5lY3RlZCFcIik7ZS5yaWdodD1ufX1mdW5jdGlvbiBlKHQsZSl7dmFyIG49ZS5faWQ7aWYodm9pZCAwPT09billLl9pbnRlZ3JhdGUodCk7ZWxzZXtpZih0LnNzLmdldFN0YXRlKG4udXNlcik+bi5jbG9jaylyZXR1cm47IXQuZ2NFbmFibGVkfHxlLmNvbnN0cnVjdG9yPT09THR8fGUuX3BhcmVudC5jb25zdHJ1Y3RvciE9PUx0JiYhMT09PWUuX3BhcmVudC5fZGVsZXRlZD9lLl9pbnRlZ3JhdGUodCk6ZS5fZ2ModCk7dmFyIHI9dC5fbWlzc2luZ1N0cnVjdHMuZ2V0KG4udXNlcik7aWYobnVsbCE9cilmb3IodmFyIGk9bi5jbG9jayxvPWkrZS5fbGVuZ3RoO2k8bztpKyspe3ZhciBhPXIuZ2V0KGkpO3ZvaWQgMCE9PWEmJihhLmZvckVhY2goZnVuY3Rpb24oZSl7aWYoMD09PS0tZS5taXNzaW5nKXt2YXIgbj1lLmRlY29kZXIscj1uLnBvcyxpPWUuc3RydWN0Ll9mcm9tQmluYXJ5KHQsbik7bi5wb3M9ciwwPT09aS5sZW5ndGgmJnQuX3JlYWR5VG9JbnRlZ3JhdGUucHVzaChlLnN0cnVjdCl9fSksci5kZWxldGUoaSkpfX19ZnVuY3Rpb24gbih0LGUsbil7Zm9yKHZhciByPWUucmVhZFVpbnQzMigpLGk9MDtpPHI7aSsrKXt2YXIgbz1lLnJlYWRWYXJVaW50KCksYT1xKG8pLHM9bmV3IGEsbD1zLl9mcm9tQmluYXJ5KHQsZSksdT1cIiAgXCIrcy5fbG9nU3RyaW5nKCk7bC5sZW5ndGg+MCYmKHUrPVwiIC4uIG1pc3Npbmc6IFwiK2wubWFwKHApLmpvaW4oXCIsIFwiKSksbi5wdXNoKHUpfX1mdW5jdGlvbiByKHQsbil7Zm9yKHZhciByPW4ucmVhZFVpbnQzMigpLGk9MDtpPHI7aSsrKXt2YXIgbz1uLnJlYWRWYXJVaW50KCksYT1xKG8pLHM9bmV3IGEsbD1uLnBvcyx1PXMuX2Zyb21CaW5hcnkodCxuKTtpZigwPT09dS5sZW5ndGgpZm9yKDtudWxsIT1zOyllKHQscykscz10Ll9yZWFkeVRvSW50ZWdyYXRlLnNoaWZ0KCk7ZWxzZXt2YXIgYz1uZXcgVnQobi51aW50OGFycik7Yy5wb3M9bDtmb3IodmFyIGg9bmV3IE10KGMsdSxzKSxmPXQuX21pc3NpbmdTdHJ1Y3RzLGQ9dS5sZW5ndGgtMTtkPj0wO2QtLSl7dmFyIF89dVtkXTtmLmhhcyhfLnVzZXIpfHxmLnNldChfLnVzZXIsbmV3IE1hcCk7dmFyIHY9Zi5nZXQoXy51c2VyKTt2LmhhcyhfLmNsb2NrKXx8di5zZXQoXy5jbG9jayxbXSk7KHY9di5nZXQoXy5jbG9jaykpLnB1c2goaCl9fX19ZnVuY3Rpb24gaSh0KXtmb3IodmFyIGU9bmV3IE1hcCxuPXQucmVhZFVpbnQzMigpLHI9MDtyPG47cisrKXt2YXIgaT10LnJlYWRWYXJVaW50KCksbz10LnJlYWRWYXJVaW50KCk7ZS5zZXQoaSxvKX1yZXR1cm4gZX1mdW5jdGlvbiBvKHQsZSl7dmFyIG49ZS5wb3Mscj0wO2Uud3JpdGVVaW50MzIoMCk7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9dC5zcy5zdGF0ZVtTeW1ib2wuaXRlcmF0b3JdKCk7IShpPShzPWwubmV4dCgpKS5kb25lKTtpPSEwKXt2YXIgdT14dChzLnZhbHVlLDIpLGM9dVswXSxoPXVbMV07ZS53cml0ZVZhclVpbnQoYyksZS53cml0ZVZhclVpbnQoaCkscisrfX1jYXRjaCh0KXtvPSEwLGE9dH1maW5hbGx5e3RyeXshaSYmbC5yZXR1cm4mJmwucmV0dXJuKCl9ZmluYWxseXtpZihvKXRocm93IGF9fWUuc2V0VWludDMyKG4scil9ZnVuY3Rpb24gYSh0LGUpe3ZhciBuPW51bGwscj12b2lkIDAsaT12b2lkIDAsbz0wLGE9ZS5wb3M7ZS53cml0ZVVpbnQzMigwKSx0LmRzLml0ZXJhdGUobnVsbCxudWxsLGZ1bmN0aW9uKHQpe3ZhciBhPXQuX2lkLnVzZXIscz10Ll9pZC5jbG9jayxsPXQubGVuLHU9dC5nYztuIT09YSYmKG8rKyxudWxsIT09biYmZS5zZXRVaW50MzIoaSxyKSxuPWEsZS53cml0ZVZhclVpbnQoYSksaT1lLnBvcyxlLndyaXRlVWludDMyKDApLHI9MCksZS53cml0ZVZhclVpbnQocyksZS53cml0ZVZhclVpbnQobCksZS53cml0ZVVpbnQ4KHU/MTowKSxyKyt9KSxudWxsIT09biYmZS5zZXRVaW50MzIoaSxyKSxlLnNldFVpbnQzMihhLG8pfWZ1bmN0aW9uIHModCxlKXtmb3IodmFyIG49ZS5yZWFkVWludDMyKCkscj0wO3I8bjtyKyspIWZ1bmN0aW9uKG4pe2Zvcih2YXIgcj1lLnJlYWRWYXJVaW50KCksaT1bXSxvPWUucmVhZFVpbnQzMigpLGE9MDthPG87YSsrKXt2YXIgcz1lLnJlYWRWYXJVaW50KCksbD1lLnJlYWRWYXJVaW50KCksdT0xPT09ZS5yZWFkVWludDgoKTtpLnB1c2goW3MsbCx1XSl9aWYobz4wKXt2YXIgYz0wLGg9aVtjXSxmPVtdO3QuZHMuaXRlcmF0ZShuZXcgUHQociwwKSxuZXcgUHQocixOdW1iZXIuTUFYX1ZBTFVFKSxmdW5jdGlvbih0KXtmb3IoO251bGwhPWg7KXt2YXIgZT0wO2lmKHQuX2lkLmNsb2NrK3QubGVuPD1oWzBdKWJyZWFrO2hbMF08dC5faWQuY2xvY2s/KGU9TWF0aC5taW4odC5faWQuY2xvY2staFswXSxoWzFdKSxmLnB1c2goW3IsaFswXSxlXSkpOihlPXQuX2lkLmNsb2NrK3QubGVuLWhbMF0saFsyXSYmIXQuZ2MmJmYucHVzaChbcixoWzBdLE1hdGgubWluKGUsaFsxXSldKSksaFsxXTw9ZT9oPWlbKytjXTooaFswXT1oWzBdK2UsaFsxXT1oWzFdLWUpfX0pO2Zvcih2YXIgZD1mLmxlbmd0aC0xO2Q+PTA7ZC0tKXt2YXIgXz1mW2RdO2codCxfWzBdLF9bMV0sX1syXSwhMCl9Zm9yKDtjPGkubGVuZ3RoO2MrKyloPWlbY10sZyh0LHIsaFswXSxoWzFdLCEwKX19KCl9ZnVuY3Rpb24gbCh0LGUsbil7dmFyIHI9ZS5yZWFkVmFyU3RyaW5nKCksaT1lLnJlYWRWYXJVaW50KCk7bi5wdXNoKCcgIC0gYXV0aDogXCInK3IrJ1wiJyksbi5wdXNoKFwiICAtIHByb3RvY29sVmVyc2lvbjogXCIraSk7Zm9yKHZhciBvPVtdLGE9ZS5yZWFkVWludDMyKCkscz0wO3M8YTtzKyspe3ZhciBsPWUucmVhZFZhclVpbnQoKSx1PWUucmVhZFZhclVpbnQoKTtvLnB1c2goXCIoXCIrbCtcIjpcIit1K1wiKVwiKX1uLnB1c2goXCIgID09IFNTOiBcIitvLmpvaW4oXCIsXCIpKX1mdW5jdGlvbiB1KHQsZSl7dmFyIG49bmV3IEN0O24ud3JpdGVWYXJTdHJpbmcodC55LnJvb20pLG4ud3JpdGVWYXJTdHJpbmcoXCJzeW5jIHN0ZXAgMVwiKSxuLndyaXRlVmFyU3RyaW5nKHQuYXV0aEluZm98fFwiXCIpLG4ud3JpdGVWYXJVaW50KHQucHJvdG9jb2xWZXJzaW9uKSxvKHQueSxuKSx0LnNlbmQoZSxuLmNyZWF0ZUJ1ZmZlcigpKX1mdW5jdGlvbiBjKHQsZSxuKXt2YXIgcj1lLnBvcztlLndyaXRlVWludDMyKDApO3ZhciBpPTAsbz0hMCxhPSExLHM9dm9pZCAwO3RyeXtmb3IodmFyIGwsdT10LnNzLnN0YXRlLmtleXMoKVtTeW1ib2wuaXRlcmF0b3JdKCk7IShvPShsPXUubmV4dCgpKS5kb25lKTtvPSEwKXt2YXIgYz1sLnZhbHVlLGg9bi5nZXQoYyl8fDA7aWYoYyE9PXF0KXt2YXIgZj1uZXcgUHQoYyxoKSxkPXQub3MuZmluZFByZXYoZiksXz1udWxsPT09ZD9udWxsOmQuX2lkO2lmKG51bGwhPT1fJiZfLnVzZXI9PT1jJiZfLmNsb2NrK2QuX2xlbmd0aD5oKXtkLl9jbG9uZVBhcnRpYWwoaC1fLmNsb2NrKS5fdG9CaW5hcnkoZSksaSsrfXQub3MuaXRlcmF0ZShmLG5ldyBQdChjLE51bWJlci5NQVhfVkFMVUUpLGZ1bmN0aW9uKHQpe3QuX3RvQmluYXJ5KGUpLGkrK30pfX19Y2F0Y2godCl7YT0hMCxzPXR9ZmluYWxseXt0cnl7IW8mJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYoYSl0aHJvdyBzfX1lLnNldFVpbnQzMihyLGkpfWZ1bmN0aW9uIGgodCxlLG4scixvKXt2YXIgcz10LnJlYWRWYXJVaW50KCk7cyE9PW4uY29ubmVjdG9yLnByb3RvY29sVmVyc2lvbiYmKGNvbnNvbGUud2FybihcIllvdSB0cmllZCB0byBzeW5jIHdpdGggYSBZanMgaW5zdGFuY2UgdGhhdCBoYXMgYSBkaWZmZXJlbnQgcHJvdG9jb2wgdmVyc2lvblxcbiAgICAgIChZb3U6IFwiK3MrXCIsIENsaWVudDogXCIrcytcIikuXFxuICAgICAgXCIpLG4uZGVzdHJveSgpKSxlLndyaXRlVmFyU3RyaW5nKFwic3luYyBzdGVwIDJcIiksZS53cml0ZVZhclN0cmluZyhuLmNvbm5lY3Rvci5hdXRoSW5mb3x8XCJcIiksYyhuLGUsaSh0KSksYShuLGUpLG4uY29ubmVjdG9yLnNlbmQoci51aWQsZS5jcmVhdGVCdWZmZXIoKSksci5yZWNlaXZlZFN5bmNTdGVwMj0hMCxcInNsYXZlXCI9PT1uLmNvbm5lY3Rvci5yb2xlJiZ1KG4uY29ubmVjdG9yLG8pfWZ1bmN0aW9uIGYodCxlLHIpe3IucHVzaChcIiAgICAgLSBhdXRoOiBcIitlLnJlYWRWYXJTdHJpbmcoKSksci5wdXNoKFwiICA9PSBPUzpcIiksbih0LGUsciksci5wdXNoKFwiICA9PSBEUzpcIik7Zm9yKHZhciBpPWUucmVhZFVpbnQzMigpLG89MDtvPGk7bysrKXt2YXIgYT1lLnJlYWRWYXJVaW50KCk7ci5wdXNoKFwiICAgIFVzZXI6IFwiK2ErXCI6IFwiKTtmb3IodmFyIHM9ZS5yZWFkVWludDMyKCksbD0wO2w8cztsKyspe3ZhciB1PWUucmVhZFZhclVpbnQoKSxjPWUucmVhZFZhclVpbnQoKSxoPTE9PT1lLnJlYWRVaW50OCgpO3IucHVzaChcIltcIit1K1wiLCBcIitjK1wiLCBcIitoK1wiXVwiKX19fWZ1bmN0aW9uIGQodCxlLG4saSxvKXtyKG4sdCkscyhuLHQpLG4uY29ubmVjdG9yLl9zZXRTeW5jZWRXaXRoKG8pfWZ1bmN0aW9uIF8odCl7dmFyIGU9eHQodCwyKSxyPWVbMF0saT1lWzFdLG89bmV3IFZ0KGkpO28ucmVhZFZhclN0cmluZygpO3ZhciBhPW8ucmVhZFZhclN0cmluZygpLHM9W107cmV0dXJuIHMucHVzaChcIlxcbiA9PT0gXCIrYStcIiA9PT1cIiksXCJ1cGRhdGVcIj09PWE/bihyLG8scyk6XCJzeW5jIHN0ZXAgMVwiPT09YT9sKHIsbyxzKTpcInN5bmMgc3RlcCAyXCI9PT1hP2YocixvLHMpOnMucHVzaChcIi0tIFVua25vd24gbWVzc2FnZSB0eXBlIC0gcHJvYmFibHkgYW4gZW5jb2RpbmcgaXNzdWUhISFcIikscy5qb2luKFwiXFxuXCIpfWZ1bmN0aW9uIHYodCl7dmFyIGU9bmV3IFZ0KHQpO3JldHVybiBlLnJlYWRWYXJTdHJpbmcoKSxlLnJlYWRWYXJTdHJpbmcoKX1mdW5jdGlvbiBwKHQpe2lmKG51bGwhPT10JiZudWxsIT10Ll9pZCYmKHQ9dC5faWQpLG51bGw9PT10KXJldHVyblwiKClcIjtpZih0IGluc3RhbmNlb2YgUHQpcmV0dXJuXCIoXCIrdC51c2VyK1wiLFwiK3QuY2xvY2srXCIpXCI7aWYodCBpbnN0YW5jZW9mICR0KXJldHVyblwiKFwiK3QubmFtZStcIixcIit0LnR5cGUrXCIpXCI7aWYodC5jb25zdHJ1Y3Rvcj09PVkpcmV0dXJuXCJ5XCI7dGhyb3cgbmV3IEVycm9yKFwiVGhpcyBpcyBub3QgYSB2YWxpZCBJRCFcIil9ZnVuY3Rpb24geSh0LGUsbil7dmFyIHI9bnVsbCE9PWUuX2xlZnQ/ZS5fbGVmdC5fbGFzdElkOm51bGwsaT1udWxsIT09ZS5fb3JpZ2luP2UuX29yaWdpbi5fbGFzdElkOm51bGw7cmV0dXJuIHQrXCIoaWQ6XCIrcChlLl9pZCkrXCIsbGVmdDpcIitwKHIpK1wiLG9yaWdpbjpcIitwKGkpK1wiLHJpZ2h0OlwiK3AoZS5fcmlnaHQpK1wiLHBhcmVudDpcIitwKGUuX3BhcmVudCkrXCIscGFyZW50U3ViOlwiK2UuX3BhcmVudFN1Yisodm9pZCAwIT09bj9cIiAtIFwiK246XCJcIikrXCIpXCJ9ZnVuY3Rpb24gZyh0LGUsbixyLGkpe3ZhciBvPW51bGwhPT10LmNvbm5lY3RvciYmdC5jb25uZWN0b3IuX2ZvcndhcmRBcHBsaWVkU3RydWN0cyxhPXQub3MuZ2V0SXRlbUNsZWFuU3RhcnQobmV3IFB0KGUsbikpO2lmKG51bGwhPT1hKXthLl9kZWxldGVkfHwoYS5fc3BsaXRBdCh0LHIpLGEuX2RlbGV0ZSh0LG8sITApKTt2YXIgcz1hLl9sZW5ndGg7aWYoci09cyxuKz1zLHI+MClmb3IodmFyIGw9dC5vcy5maW5kTm9kZShuZXcgUHQoZSxuKSk7bnVsbCE9PWwmJm51bGwhPT1sLnZhbCYmcj4wJiZsLnZhbC5faWQuZXF1YWxzKG5ldyBQdChlLG4pKTspe3ZhciB1PWwudmFsO3UuX2RlbGV0ZWR8fCh1Ll9zcGxpdEF0KHQsciksdS5fZGVsZXRlKHQsbyxpKSk7dmFyIGM9dS5fbGVuZ3RoO3ItPWMsbis9YyxsPWwubmV4dCgpfX19ZnVuY3Rpb24gbSh0LGUsbil7aWYoZSE9PXQmJiFlLl9kZWxldGVkJiYhdC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuaGFzKGUpKXt2YXIgcj10Ll90cmFuc2FjdGlvbi5jaGFuZ2VkVHlwZXMsaT1yLmdldChlKTt2b2lkIDA9PT1pJiYoaT1uZXcgU2V0LHIuc2V0KGUsaSkpLGkuYWRkKG4pfX1mdW5jdGlvbiBrKHQsZSxuLHIpe3ZhciBpPWUuX2lkO24uX2lkPW5ldyBQdChpLnVzZXIsaS5jbG9jaytyKSxuLl9vcmlnaW49ZSxuLl9sZWZ0PWUsbi5fcmlnaHQ9ZS5fcmlnaHQsbnVsbCE9PW4uX3JpZ2h0JiYobi5fcmlnaHQuX2xlZnQ9biksbi5fcmlnaHRfb3JpZ2luPWUuX3JpZ2h0X29yaWdpbixlLl9yaWdodD1uLG4uX3BhcmVudD1lLl9wYXJlbnQsbi5fcGFyZW50U3ViPWUuX3BhcmVudFN1YixuLl9kZWxldGVkPWUuX2RlbGV0ZWQ7dmFyIG89bmV3IFNldDtvLmFkZChlKTtmb3IodmFyIGE9bi5fcmlnaHQ7bnVsbCE9PWEmJm8uaGFzKGEuX29yaWdpbik7KWEuX29yaWdpbj09PWUmJihhLl9vcmlnaW49biksby5hZGQoYSksYT1hLl9yaWdodDt0Lm9zLnB1dChuKSx0Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5oYXMoZSk/dC5fdHJhbnNhY3Rpb24ubmV3VHlwZXMuYWRkKG4pOnQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmhhcyhlKSYmdC5fdHJhbnNhY3Rpb24uZGVsZXRlZFN0cnVjdHMuYWRkKG4pfWZ1bmN0aW9uIGIodCxlKXt2YXIgbj12b2lkIDA7ZG97bj1lLl9yaWdodCxlLl9yaWdodD1udWxsLGUuX3JpZ2h0X29yaWdpbj1udWxsLGUuX29yaWdpbj1lLl9sZWZ0LGUuX2ludGVncmF0ZSh0KSxlPW59d2hpbGUobnVsbCE9PW4pfWZ1bmN0aW9uIHcodCxlKXtmb3IoO251bGwhPT1lOyllLl9kZWxldGUodCwhMSwhMCksZS5fZ2ModCksZT1lLl9yaWdodH1mdW5jdGlvbiBTKHQsZSxuLHIsaSl7dC5fb3JpZ2luPXIsdC5fbGVmdD1yLHQuX3JpZ2h0PWksdC5fcmlnaHRfb3JpZ2luPWksdC5fcGFyZW50PWUsbnVsbCE9PW4/dC5faW50ZWdyYXRlKG4pOm51bGw9PT1yP2UuX3N0YXJ0PXQ6ci5fcmlnaHQ9dH1mdW5jdGlvbiBPKHQsZSxuLHIsaSl7Zm9yKDtudWxsIT09ciYmaT4wOyl7c3dpdGNoKHIuY29uc3RydWN0b3Ipe2Nhc2UgSHQ6Y2FzZSBJdGVtU3RyaW5nOmlmKGk8PShyLl9kZWxldGVkPzA6ci5fbGVuZ3RoLTEpKXJldHVybiByPXIuX3NwbGl0QXQoZS5feSxpKSxuPXIuX2xlZnQsW24scix0XTshMT09PXIuX2RlbGV0ZWQmJihpLT1yLl9sZW5ndGgpO2JyZWFrO2Nhc2UgSnQ6ITE9PT1yLl9kZWxldGVkJiZCKHQscil9bj1yLHI9ci5fcmlnaHR9cmV0dXJuW24scix0XX1mdW5jdGlvbiBFKHQsZSl7cmV0dXJuIE8obmV3IE1hcCx0LG51bGwsdC5fc3RhcnQsZSl9ZnVuY3Rpb24gVSh0LGUsbixyLGkpe2Zvcig7bnVsbCE9PXImJighMD09PXIuX2RlbGV0ZWR8fHIuY29uc3RydWN0b3I9PT1KdCYmaS5nZXQoci5rZXkpPT09ci52YWx1ZSk7KSExPT09ci5fZGVsZXRlZCYmaS5kZWxldGUoci5rZXkpLG49cixyPXIuX3JpZ2h0O3ZhciBvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PWlbU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9eHQobC52YWx1ZSwyKSxoPWNbMF0sZj1jWzFdLGQ9bmV3IEp0O2Qua2V5PWgsZC52YWx1ZT1mLFMoZCxlLHQsbixyKSxuPWR9fWNhdGNoKHQpe2E9ITAscz10fWZpbmFsbHl7dHJ5eyFvJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKGEpdGhyb3cgc319cmV0dXJuW24scl19ZnVuY3Rpb24gQih0LGUpe3ZhciBuPWUudmFsdWUscj1lLmtleTtudWxsPT09bj90LmRlbGV0ZShyKTp0LnNldChyLG4pfWZ1bmN0aW9uIFQodCxlLG4scil7Zm9yKDs7KXtpZihudWxsPT09ZSlicmVhaztpZighMD09PWUuX2RlbGV0ZWQpO2Vsc2V7aWYoZS5jb25zdHJ1Y3RvciE9PUp0fHwocltlLmtleV18fG51bGwpIT09ZS52YWx1ZSlicmVhaztCKG4sZSl9dD1lLGU9ZS5fcmlnaHR9cmV0dXJuW3QsZV19ZnVuY3Rpb24gQSh0LGUsbixyLGksbyl7dmFyIGE9bmV3IE1hcDtmb3IodmFyIHMgaW4gaSl7dmFyIGw9aVtzXSx1PW8uZ2V0KHMpO2lmKHUhPT1sKXthLnNldChzLHV8fG51bGwpO3ZhciBjPW5ldyBKdDtjLmtleT1zLGMudmFsdWU9bCxTKGMsZSx0LG4sciksbj1jfX1yZXR1cm5bbixyLGFdfWZ1bmN0aW9uIHgodCxlLG4scixpLG8sYSl7dmFyIHM9ITAsbD0hMSx1PXZvaWQgMDt0cnl7Zm9yKHZhciBjLGg9b1tTeW1ib2wuaXRlcmF0b3JdKCk7IShzPShjPWgubmV4dCgpKS5kb25lKTtzPSEwKXt2YXIgZj14dChjLnZhbHVlLDEpLGQ9ZlswXTt2b2lkIDA9PT1hW2RdJiYoYVtkXT1udWxsKX19Y2F0Y2godCl7bD0hMCx1PXR9ZmluYWxseXt0cnl7IXMmJmgucmV0dXJuJiZoLnJldHVybigpfWZpbmFsbHl7aWYobCl0aHJvdyB1fX12YXIgXz1UKHIsaSxvLGEpLHY9eHQoXywyKTtyPXZbMF0saT12WzFdO3ZhciBwPXZvaWQgMCx5PUEodCxuLHIsaSxhLG8pLGc9eHQoeSwzKTtyPWdbMF0saT1nWzFdLHA9Z1syXTt2YXIgbT12b2lkIDA7cmV0dXJuIGUuY29uc3RydWN0b3I9PT1TdHJpbmc/KG09bmV3IEl0ZW1TdHJpbmcsbS5fY29udGVudD1lKToobT1uZXcgSHQsbS5lbWJlZD1lKSxTKG0sbix0LHIsaSkscj1tLFUodCxuLHIsaSxwKX1mdW5jdGlvbiBJKHQsZSxuLHIsaSxvLGEpe3ZhciBzPVQocixpLG8sYSksbD14dChzLDIpO3I9bFswXSxpPWxbMV07dmFyIHU9dm9pZCAwLGM9QSh0LG4scixpLGEsbyksaD14dChjLDMpO2ZvcihyPWhbMF0saT1oWzFdLHU9aFsyXTtlPjAmJm51bGwhPT1pOyl7aWYoITE9PT1pLl9kZWxldGVkKXN3aXRjaChpLmNvbnN0cnVjdG9yKXtjYXNlIEp0OnZhciBmPWFbaS5rZXldO3ZvaWQgMCE9PWYmJihmPT09aS52YWx1ZT91LmRlbGV0ZShpLmtleSk6dS5zZXQoaS5rZXksaS52YWx1ZSksaS5fZGVsZXRlKHQpKSxCKG8saSk7YnJlYWs7Y2FzZSBIdDpjYXNlIEl0ZW1TdHJpbmc6aS5fc3BsaXRBdCh0LGUpLGUtPWkuX2xlbmd0aH1yPWksaT1pLl9yaWdodH1yZXR1cm4gVSh0LG4scixpLHUpfWZ1bmN0aW9uIEQodCxlLG4scixpLG8pe2Zvcig7ZT4wJiZudWxsIT09aTspe2lmKCExPT09aS5fZGVsZXRlZClzd2l0Y2goaS5jb25zdHJ1Y3Rvcil7Y2FzZSBKdDpCKG8saSk7YnJlYWs7Y2FzZSBIdDpjYXNlIEl0ZW1TdHJpbmc6aS5fc3BsaXRBdCh0LGUpLGUtPWkuX2xlbmd0aCxpLl9kZWxldGUodCl9cj1pLGk9aS5fcmlnaHR9cmV0dXJuW3IsaV19ZnVuY3Rpb24gUCh0LGUpe2ZvcihlPWUuX3BhcmVudDtudWxsIT09ZTspe2lmKGU9PT10KXJldHVybiEwO2U9ZS5fcGFyZW50fXJldHVybiExfWZ1bmN0aW9uIGoodCxlKXtyZXR1cm4gZX1mdW5jdGlvbiBOKHQsZSl7Zm9yKHZhciBuPW5ldyBNYXAscj10LmF0dHJpYnV0ZXMubGVuZ3RoLTE7cj49MDtyLS0pe3ZhciBpPXQuYXR0cmlidXRlc1tyXTtuLnNldChpLm5hbWUsaS52YWx1ZSl9cmV0dXJuIGUodC5ub2RlTmFtZSxuKX1mdW5jdGlvbiBWKHQsZSxuKXtpZihQKGUudHlwZSxuKSl7dmFyIHI9bi5ub2RlTmFtZSxpPW5ldyBNYXA7aWYodm9pZCAwIT09bi5nZXRBdHRyaWJ1dGVzKXt2YXIgbz1uLmdldEF0dHJpYnV0ZXMoKTtmb3IodmFyIGEgaW4gbylpLnNldChhLG9bYV0pfXZhciBzPWUuZmlsdGVyKHIsbmV3IE1hcChpKSk7bnVsbD09PXM/bi5fZGVsZXRlKHQpOmkuZm9yRWFjaChmdW5jdGlvbih0LGUpeyExPT09cy5oYXMoZSkmJm4ucmVtb3ZlQXR0cmlidXRlKGUpfSl9fWZ1bmN0aW9uIEwodCl7dmFyIGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOmRvY3VtZW50LG49YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9LHI9YXJndW1lbnRzLmxlbmd0aD4zJiZ2b2lkIDAhPT1hcmd1bWVudHNbM10/YXJndW1lbnRzWzNdOmosaT1hcmd1bWVudHNbNF0sbz12b2lkIDA7c3dpdGNoKHQubm9kZVR5cGUpe2Nhc2UgZS5FTEVNRU5UX05PREU6dmFyIGE9bnVsbCxzPXZvaWQgMDtpZih0Lmhhc0F0dHJpYnV0ZShcImRhdGEteWpzLWhvb2tcIikmJihhPXQuZ2V0QXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiKSx2b2lkIDA9PT0ocz1uW2FdKSYmKGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gaG9vayBcIicrYSsnXCIuIERlbGV0aW5nIHlqc0hvb2sgZGF0YXNldCBwcm9wZXJ0eS4nKSx0LnJlbW92ZUF0dHJpYnV0ZShcImRhdGEteWpzLWhvb2tcIiksYT1udWxsKSksbnVsbD09PWEpe3ZhciBsPU4odCxyKTtudWxsPT09bD9vPSExOihvPW5ldyBZWG1sRWxlbWVudCh0Lm5vZGVOYW1lKSxsLmZvckVhY2goZnVuY3Rpb24odCxlKXtvLnNldEF0dHJpYnV0ZShlLHQpfSksby5pbnNlcnQoMCxKKHQuY2hpbGROb2Rlcyxkb2N1bWVudCxuLHIsaSkpKX1lbHNlIG89bmV3IFlYbWxIb29rKGEpLHMuZmlsbFR5cGUodCxvKTticmVhaztjYXNlIGUuVEVYVF9OT0RFOm89bmV3IFlYbWxUZXh0LG8uaW5zZXJ0KDAsdC5ub2RlVmFsdWUpO2JyZWFrO2RlZmF1bHQ6dGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgdHJhbnNmb3JtIHRoaXMgbm9kZSB0eXBlIHRvIGEgWVhtbCB0eXBlIVwiKX1yZXR1cm4gUihpLHQsbyksb31mdW5jdGlvbiBNKHQpe2Zvcig7bnVsbCE9PXQmJnQuX2RlbGV0ZWQ7KXQ9dC5fcmlnaHQ7cmV0dXJuIHR9ZnVuY3Rpb24gQyh0LGUsbil7dC5kb21Ub1R5cGUuZGVsZXRlKGUpLHQudHlwZVRvRG9tLmRlbGV0ZShuKX1mdW5jdGlvbiBSKHQsZSxuKXt2b2lkIDAhPT10JiYodC5kb21Ub1R5cGUuc2V0KGUsbiksdC50eXBlVG9Eb20uc2V0KG4sZSkpfWZ1bmN0aW9uIFcodCxlLG4pe2lmKHZvaWQgMCE9PXQpe3ZhciByPXQuZG9tVG9UeXBlLmdldChlKTt2b2lkIDAhPT1yJiYoQyh0LGUsciksUih0LG4scikpfX1mdW5jdGlvbiBIKHQsZSxuLHIsaSl7dmFyIG89SihuLHIsaS5vcHRzLmhvb2tzLGkuZmlsdGVyLGkpO3JldHVybiB0Lmluc2VydEFmdGVyKGUsbyl9ZnVuY3Rpb24gSih0LGUsbixyLGkpe3ZhciBvPVtdLGE9ITAscz0hMSxsPXZvaWQgMDt0cnl7Zm9yKHZhciB1LGM9dFtTeW1ib2wuaXRlcmF0b3JdKCk7IShhPSh1PWMubmV4dCgpKS5kb25lKTthPSEwKXt2YXIgaD11LnZhbHVlLGY9TChoLGUsbixyLGkpOyExIT09ZiYmby5wdXNoKGYpfX1jYXRjaCh0KXtzPSEwLGw9dH1maW5hbGx5e3RyeXshYSYmYy5yZXR1cm4mJmMucmV0dXJuKCl9ZmluYWxseXtpZihzKXRocm93IGx9fXJldHVybiBvfWZ1bmN0aW9uIHoodCxlLG4scixpKXt2YXIgbz1IKHQsZSxbbl0scixpKTtyZXR1cm4gby5sZW5ndGg+MD9vWzBdOmV9ZnVuY3Rpb24gRih0LGUsbil7Zm9yKDtlIT09bjspe3ZhciByPWU7ZT1lLm5leHRTaWJsaW5nLHQucmVtb3ZlQ2hpbGQocil9fWZ1bmN0aW9uIFgodCxlKXtGdC5zZXQodCxlKSxYdC5zZXQoZSx0KX1mdW5jdGlvbiBxKHQpe3JldHVybiBGdC5nZXQodCl9ZnVuY3Rpb24gJCh0KXtyZXR1cm4gWHQuZ2V0KHQpfWZ1bmN0aW9uIEcoKXtpZihcInVuZGVmaW5lZFwiIT10eXBlb2YgY3J5cHRvJiZudWxsIT1jcnlwdG8uZ2V0UmFuZG9tVmFsdWUpe3ZhciB0PW5ldyBVaW50MzJBcnJheSgxKTtyZXR1cm4gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyh0KSx0WzBdfWlmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBjcnlwdG8mJm51bGwhPWNyeXB0by5yYW5kb21CeXRlcyl7dmFyIGU9Y3J5cHRvLnJhbmRvbUJ5dGVzKDQpO3JldHVybiBuZXcgVWludDMyQXJyYXkoZS5idWZmZXIpWzBdfXJldHVybiBNYXRoLmNlaWwoNDI5NDk2NzI5NSpNYXRoLnJhbmRvbSgpKX1mdW5jdGlvbiBaKHQsZSl7Zm9yKHZhciBuPXQuX3N0YXJ0O251bGwhPT1uOyl7aWYoITE9PT1uLl9kZWxldGVkKXtpZihuLl9sZW5ndGg+ZSlyZXR1cm5bbi5faWQudXNlcixuLl9pZC5jbG9jaytlXTtlLT1uLl9sZW5ndGh9bj1uLl9yaWdodH1yZXR1cm5bXCJlbmRvZlwiLHQuX2lkLnVzZXIsdC5faWQuY2xvY2t8fG51bGwsdC5faWQubmFtZXx8bnVsbCx0Ll9pZC50eXBlfHxudWxsXX1mdW5jdGlvbiBRKHQsZSl7aWYoXCJlbmRvZlwiPT09ZVswXSl7dmFyIG49dm9pZCAwO249bnVsbD09PWVbM10/bmV3IFB0KGVbMV0sZVsyXSk6bmV3ICR0KGVbM10sZVs0XSk7Zm9yKHZhciByPXQub3MuZ2V0KG4pO251bGwhPT1yLl9yZWRvbmU7KXI9ci5fcmVkb25lO3JldHVybiBudWxsPT09cnx8ci5jb25zdHJ1Y3Rvcj09PUx0P251bGw6e3R5cGU6cixvZmZzZXQ6ci5sZW5ndGh9fWZvcih2YXIgaT0wLG89dC5vcy5maW5kTm9kZVdpdGhVcHBlckJvdW5kKG5ldyBQdChlWzBdLGVbMV0pKS52YWwsYT1lWzFdLW8uX2lkLmNsb2NrO251bGwhPT1vLl9yZWRvbmU7KW89by5fcmVkb25lO3ZhciBzPW8uX3BhcmVudDtpZihvLmNvbnN0cnVjdG9yPT09THR8fHMuX2RlbGV0ZWQpcmV0dXJuIG51bGw7Zm9yKG8uX2RlbGV0ZWR8fChpPWEpLG89by5fbGVmdDtudWxsIT09bzspby5fZGVsZXRlZHx8KGkrPW8uX2xlbmd0aCksbz1vLl9sZWZ0O3JldHVybnt0eXBlOnMsb2Zmc2V0Oml9fWZ1bmN0aW9uIEsoKXt2YXIgdD0hMDtyZXR1cm4gZnVuY3Rpb24oZSl7aWYodCl7dD0hMTt0cnl7ZSgpfWNhdGNoKHQpe2NvbnNvbGUuZXJyb3IodCl9dD0hMH19fWZ1bmN0aW9uIHR0KHQpe3ZhciBlPWdldFNlbGVjdGlvbigpLG49ZS5iYXNlTm9kZSxyPWUuYmFzZU9mZnNldCxpPWUuZXh0ZW50Tm9kZSxvPWUuZXh0ZW50T2Zmc2V0LGE9dC5kb21Ub1R5cGUuZ2V0KG4pLHM9dC5kb21Ub1R5cGUuZ2V0KGkpO3JldHVybiB2b2lkIDAhPT1hJiZ2b2lkIDAhPT1zP3tmcm9tOlooYSxyKSx0bzpaKHMsbyl9Om51bGx9ZnVuY3Rpb24gZXQodCl7dGU9ZWUodCl9ZnVuY3Rpb24gbnQodCl7bnVsbCE9PXRlJiZ0LnJlc3RvcmVTZWxlY3Rpb24odGUpfWZ1bmN0aW9uIHJ0KHQpe2lmKG51bGwhPT10KXt2YXIgZT1nZXRTZWxlY3Rpb24oKS5hbmNob3JOb2RlO2lmKG51bGwhPWUpe2Uubm9kZVR5cGU9PT1kb2N1bWVudC5URVhUX05PREUmJihlPWUucGFyZW50RWxlbWVudCk7cmV0dXJue2VsZW06ZSx0b3A6ZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3B9fWZvcih2YXIgbj10LmNoaWxkcmVuLHI9MDtyPG4ubGVuZ3RoO3IrKyl7dmFyIGk9bltyXSxvPWkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7aWYoby50b3A+PTApcmV0dXJue2VsZW06aSx0b3A6by50b3B9fX1yZXR1cm4gbnVsbH1mdW5jdGlvbiBpdCh0LGUpe2lmKG51bGwhPT1lKXt2YXIgbj1lLmVsZW0scj1lLnRvcCxpPW4uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wLG89dC5zY3JvbGxUb3AraS1yO28+PTAmJih0LnNjcm9sbFRvcD1vKX19ZnVuY3Rpb24gb3QodCl7dmFyIGU9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIG49cnQoZS5zY3JvbGxpbmdFbGVtZW50KTt0LmZvckVhY2goZnVuY3Rpb24odCl7dmFyIG49dC50YXJnZXQscj1lLnR5cGVUb0RvbS5nZXQobik7aWYodm9pZCAwIT09ciYmITEhPT1yKWlmKG4uY29uc3RydWN0b3I9PT1ZWG1sVGV4dClyLm5vZGVWYWx1ZT1uLnRvU3RyaW5nKCk7ZWxzZSBpZih2b2lkIDAhPT10LmF0dHJpYnV0ZXNDaGFuZ2VkJiYodC5hdHRyaWJ1dGVzQ2hhbmdlZC5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBlPW4uZ2V0QXR0cmlidXRlKHQpO3ZvaWQgMD09PWU/ci5yZW1vdmVBdHRyaWJ1dGUodCk6ci5zZXRBdHRyaWJ1dGUodCxlKX0pLHQuY2hpbGRMaXN0Q2hhbmdlZCYmbi5jb25zdHJ1Y3RvciE9PVlYbWxIb29rKSl7dmFyIGk9ci5maXJzdENoaWxkO24uZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgbj1lLnR5cGVUb0RvbS5nZXQodCk7c3dpdGNoKG4pe2Nhc2Ugdm9pZCAwOnZhciBvPXQudG9Eb20oZS5vcHRzLmRvY3VtZW50LGUub3B0cy5ob29rcyxlKTtyLmluc2VydEJlZm9yZShvLGkpO2JyZWFrO2Nhc2UhMTpicmVhaztkZWZhdWx0OkYocixpLG4pLGk9bi5uZXh0U2libGluZ319KSxGKHIsaSxudWxsKX19KSxpdChlLnNjcm9sbGluZ0VsZW1lbnQsbil9KX1mdW5jdGlvbiBhdCh0LGUpe2Zvcih2YXIgbj0wLHI9MDtuPHQubGVuZ3RoJiZuPGUubGVuZ3RoJiZ0W25dPT09ZVtuXTspbisrO2lmKG4hPT10Lmxlbmd0aHx8biE9PWUubGVuZ3RoKWZvcig7cituPHQubGVuZ3RoJiZyK248ZS5sZW5ndGgmJnRbdC5sZW5ndGgtci0xXT09PWVbZS5sZW5ndGgtci0xXTspcisrO3JldHVybntwb3M6bixyZW1vdmU6dC5sZW5ndGgtbi1yLGluc2VydDplLnNsaWNlKG4sZS5sZW5ndGgtcil9fWZ1bmN0aW9uIHN0KHQsZSxuLHIpe2lmKG51bGwhPW4mJiExIT09biYmbi5jb25zdHJ1Y3RvciE9PVlYbWxIb29rKXtmb3IodmFyIGk9bi5feSxvPW5ldyBTZXQsYT1lLmNoaWxkTm9kZXMubGVuZ3RoLTE7YT49MDthLS0pe3ZhciBzPXQuZG9tVG9UeXBlLmdldChlLmNoaWxkTm9kZXNbYV0pO3ZvaWQgMCE9PXMmJiExIT09cyYmby5hZGQocyl9bi5mb3JFYWNoKGZ1bmN0aW9uKGUpeyExPT09by5oYXMoZSkmJihlLl9kZWxldGUoaSksQyh0LHQudHlwZVRvRG9tLmdldChlKSxlKSl9KTtmb3IodmFyIGw9ZS5jaGlsZE5vZGVzLHU9bC5sZW5ndGgsYz1udWxsLGg9TShuLl9zdGFydCksZj0wO2Y8dTtmKyspe3ZhciBkPWxbZl0sXz10LmRvbVRvVHlwZS5nZXQoZCk7aWYodm9pZCAwIT09Xyl7aWYoITE9PT1fKWNvbnRpbnVlO251bGwhPT1oP2ghPT1fPyhfLl9wYXJlbnQhPT1uP0ModCxkLF8pOihDKHQsZCxfKSxfLl9kZWxldGUoaSkpLGM9eihuLGMsZCxyLHQpKTooYz1oLGg9TShoLl9yaWdodCkpOmM9eihuLGMsZCxyLHQpfWVsc2UgYz16KG4sYyxkLHIsdCl9fX1mdW5jdGlvbiBsdCh0LGUpe3ZhciBuPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe24udHlwZS5feS50cmFuc2FjdChmdW5jdGlvbigpe3ZhciByPW5ldyBTZXQ7dC5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBlPXQudGFyZ2V0LGk9bi5kb21Ub1R5cGUuZ2V0KGUpO2lmKHZvaWQgMD09PWkpe3ZhciBvPWUsYT12b2lkIDA7ZG97bz1vLnBhcmVudEVsZW1lbnQsYT1uLmRvbVRvVHlwZS5nZXQobyl9d2hpbGUodm9pZCAwPT09YSYmbnVsbCE9PW8pO3JldHVybiB2b2lkKCExIT09YSYmdm9pZCAwIT09YSYmYS5jb25zdHJ1Y3RvciE9PVlYbWxIb29rJiZyLmFkZChvKSl9aWYoITEhPT1pJiZpLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spc3dpdGNoKHQudHlwZSl7Y2FzZVwiY2hhcmFjdGVyRGF0YVwiOnZhciBzPWF0KGkudG9TdHJpbmcoKSxlLm5vZGVWYWx1ZSk7aS5kZWxldGUocy5wb3Mscy5yZW1vdmUpLGkuaW5zZXJ0KHMucG9zLHMuaW5zZXJ0KTticmVhaztjYXNlXCJhdHRyaWJ1dGVzXCI6aWYoaS5jb25zdHJ1Y3Rvcj09PVlYbWxGcmFnbWVudClicmVhazt2YXIgbD10LmF0dHJpYnV0ZU5hbWUsdT1lLmdldEF0dHJpYnV0ZShsKSxjPW5ldyBNYXA7Yy5zZXQobCx1KSxpLmNvbnN0cnVjdG9yIT09WVhtbEZyYWdtZW50JiZuLmZpbHRlcihlLm5vZGVOYW1lLGMpLnNpemU+MCYmaS5nZXRBdHRyaWJ1dGUobCkhPT11JiYobnVsbD09dT9pLnJlbW92ZUF0dHJpYnV0ZShsKTppLnNldEF0dHJpYnV0ZShsLHUpKTticmVhaztjYXNlXCJjaGlsZExpc3RcIjpyLmFkZCh0LnRhcmdldCl9fSk7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9cltTeW1ib2wuaXRlcmF0b3JdKCk7IShpPShzPWwubmV4dCgpKS5kb25lKTtpPSEwKXt2YXIgdT1zLnZhbHVlLGM9bi5kb21Ub1R5cGUuZ2V0KHUpO3N0KG4sdSxjLGUpfX1jYXRjaCh0KXtvPSEwLGE9dH1maW5hbGx5e3RyeXshaSYmbC5yZXR1cm4mJmwucmV0dXJuKCl9ZmluYWxseXtpZihvKXRocm93IGF9fX0pfSl9ZnVuY3Rpb24gdXQodCxlLG4pe3ZhciByPSExLGk9dm9pZCAwO3JldHVybiB0LnRyYW5zYWN0KGZ1bmN0aW9uKCl7Zm9yKDshciYmbi5sZW5ndGg+MDspIWZ1bmN0aW9uKCl7aT1uLnBvcCgpLG51bGwhPT1pLmZyb21TdGF0ZSYmKHQub3MuZ2V0SXRlbUNsZWFuU3RhcnQoaS5mcm9tU3RhdGUpLHQub3MuZ2V0SXRlbUNsZWFuRW5kKGkudG9TdGF0ZSksdC5vcy5pdGVyYXRlKGkuZnJvbVN0YXRlLGkudG9TdGF0ZSxmdW5jdGlvbihuKXtmb3IoO24uX2RlbGV0ZWQmJm51bGwhPT1uLl9yZWRvbmU7KW49bi5fcmVkb25lOyExPT09bi5fZGVsZXRlZCYmUChlLG4pJiYocj0hMCxuLl9kZWxldGUodCkpfSkpO3ZhciBvPW5ldyBTZXQsYT0hMCxzPSExLGw9dm9pZCAwO3RyeXtmb3IodmFyIHUsYz1pLmRlbGV0ZWRTdHJ1Y3RzW1N5bWJvbC5pdGVyYXRvcl0oKTshKGE9KHU9Yy5uZXh0KCkpLmRvbmUpO2E9ITApe3ZhciBoPXUudmFsdWUsZj1oLmZyb20sZD1uZXcgUHQoZi51c2VyLGYuY2xvY2sraC5sZW4tMSk7dC5vcy5nZXRJdGVtQ2xlYW5TdGFydChmKSx0Lm9zLmdldEl0ZW1DbGVhbkVuZChkKSx0Lm9zLml0ZXJhdGUoZixkLGZ1bmN0aW9uKG4pe1AoZSxuKSYmbi5fcGFyZW50IT09dCYmKG4uX2lkLnVzZXIhPT10LnVzZXJJRHx8bnVsbD09PWkuZnJvbVN0YXRlfHxuLl9pZC5jbG9jazxpLmZyb21TdGF0ZS5jbG9ja3x8bi5faWQuY2xvY2s+aS50b1N0YXRlLmNsb2NrKSYmby5hZGQobil9KX19Y2F0Y2godCl7cz0hMCxsPXR9ZmluYWxseXt0cnl7IWEmJmMucmV0dXJuJiZjLnJldHVybigpfWZpbmFsbHl7aWYocyl0aHJvdyBsfX1vLmZvckVhY2goZnVuY3Rpb24oZSl7dmFyIG49ZS5fcmVkbyh0LG8pO3I9cnx8bn0pfSgpfSksciYmaS5iaW5kaW5nSW5mb3MuZm9yRWFjaChmdW5jdGlvbih0LGUpe2UuX3Jlc3RvcmVVbmRvU3RhY2tJbmZvKHQpfSkscn1mdW5jdGlvbiBjdCh0LGUpe3JldHVybiBlPXtleHBvcnRzOnt9fSx0KGUsZS5leHBvcnRzKSxlLmV4cG9ydHN9ZnVuY3Rpb24gaHQodCl7aWYodD1TdHJpbmcodCksISh0Lmxlbmd0aD4xMDApKXt2YXIgZT0vXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHQpO2lmKGUpe3ZhciBuPXBhcnNlRmxvYXQoZVsxXSk7c3dpdGNoKChlWzJdfHxcIm1zXCIpLnRvTG93ZXJDYXNlKCkpe2Nhc2VcInllYXJzXCI6Y2FzZVwieWVhclwiOmNhc2VcInlyc1wiOmNhc2VcInlyXCI6Y2FzZVwieVwiOnJldHVybiBuKnVlO2Nhc2VcImRheXNcIjpjYXNlXCJkYXlcIjpjYXNlXCJkXCI6cmV0dXJuIG4qbGU7Y2FzZVwiaG91cnNcIjpjYXNlXCJob3VyXCI6Y2FzZVwiaHJzXCI6Y2FzZVwiaHJcIjpjYXNlXCJoXCI6cmV0dXJuIG4qc2U7Y2FzZVwibWludXRlc1wiOmNhc2VcIm1pbnV0ZVwiOmNhc2VcIm1pbnNcIjpjYXNlXCJtaW5cIjpjYXNlXCJtXCI6cmV0dXJuIG4qYWU7Y2FzZVwic2Vjb25kc1wiOmNhc2VcInNlY29uZFwiOmNhc2VcInNlY3NcIjpjYXNlXCJzZWNcIjpjYXNlXCJzXCI6cmV0dXJuIG4qb2U7Y2FzZVwibWlsbGlzZWNvbmRzXCI6Y2FzZVwibWlsbGlzZWNvbmRcIjpjYXNlXCJtc2Vjc1wiOmNhc2VcIm1zZWNcIjpjYXNlXCJtc1wiOnJldHVybiBuO2RlZmF1bHQ6cmV0dXJufX19fWZ1bmN0aW9uIGZ0KHQpe3JldHVybiB0Pj1sZT9NYXRoLnJvdW5kKHQvbGUpK1wiZFwiOnQ+PXNlP01hdGgucm91bmQodC9zZSkrXCJoXCI6dD49YWU/TWF0aC5yb3VuZCh0L2FlKStcIm1cIjp0Pj1vZT9NYXRoLnJvdW5kKHQvb2UpK1wic1wiOnQrXCJtc1wifWZ1bmN0aW9uIGR0KHQpe3JldHVybiBfdCh0LGxlLFwiZGF5XCIpfHxfdCh0LHNlLFwiaG91clwiKXx8X3QodCxhZSxcIm1pbnV0ZVwiKXx8X3QodCxvZSxcInNlY29uZFwiKXx8dCtcIiBtc1wifWZ1bmN0aW9uIF90KHQsZSxuKXtpZighKHQ8ZSkpcmV0dXJuIHQ8MS41KmU/TWF0aC5mbG9vcih0L2UpK1wiIFwiK246TWF0aC5jZWlsKHQvZSkrXCIgXCIrbitcInNcIn1mdW5jdGlvbiB2dCh0LGUpe3QudHJhbnNhY3QoZnVuY3Rpb24oKXtyKHQsZSkscyh0LGUpfSl9ZnVuY3Rpb24gcHQodCl7dmFyIGU9bmV3IEN0O3JldHVybiBjKHQsZSxuZXcgTWFwKSxhKHQsZSksZX1mdW5jdGlvbiB5dCgpe3ZhciB0PW5ldyBDdDtyZXR1cm4gdC53cml0ZVVpbnQzMigwKSx7bGVuOjAsYnVmZmVyOnR9fWZ1bmN0aW9uIGd0KCl7dmFyIHQ9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIGU9dC50YXJnZXQsbj10LnR5cGUscj1aKG4sZS5zZWxlY3Rpb25TdGFydCksaT1aKG4sZS5zZWxlY3Rpb25FbmQpO2UudmFsdWU9bi50b1N0cmluZygpO3ZhciBvPVEobi5feSxyKSxhPVEobi5feSxpKTtlLnNldFNlbGVjdGlvblJhbmdlKG8sYSl9KX1mdW5jdGlvbiBtdCgpe3ZhciB0PXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe3ZhciBlPWF0KHQudHlwZS50b1N0cmluZygpLHQudGFyZ2V0LnZhbHVlKTt0LnR5cGUuZGVsZXRlKGUucG9zLGUucmVtb3ZlKSx0LnR5cGUuaW5zZXJ0KGUucG9zLGUuaW5zZXJ0KX0pfWZ1bmN0aW9uIGt0KHQpe3ZhciBlPXRoaXMudGFyZ2V0O2UudXBkYXRlKFwieWpzXCIpLHRoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtlLnVwZGF0ZUNvbnRlbnRzKHQuZGVsdGEsXCJ5anNcIiksZS51cGRhdGUoXCJ5anNcIil9KX1mdW5jdGlvbiBidCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtlLnR5cGUuYXBwbHlEZWx0YSh0Lm9wcyl9KX1mdW5jdGlvbiB3dCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtmb3IodmFyIG49ZS50YXJnZXQscj10LmRlbHRhLGk9MCxvPW4ucG9zRnJvbUluZGV4KGkpLGE9MDthPHIubGVuZ3RoO2ErKyl7dmFyIHM9clthXTtzLnJldGFpbj8oaT1zLnJldGFpbixvPW4ucG9zRnJvbUluZGV4KGkpKTpzLmluc2VydD9uLnJlcGxhY2VSYW5nZShzLmluc2VydCxvLG8pOnMuZGVsZXRlJiZuLnJlcGxhY2VSYW5nZShcIlwiLG8sbi5wb3NGcm9tSW5kZXgoaStzLmRlbGV0ZSkpfX0pfWZ1bmN0aW9uIFN0KHQsZSl7dmFyIG49dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7Zm9yKHZhciByPTA7cjxlLmxlbmd0aDtyKyspe3ZhciBpPWVbcl0sbz10LmluZGV4RnJvbVBvcyhpLmZyb20pO2lmKGkucmVtb3ZlZC5sZW5ndGg+MCl7Zm9yKHZhciBhPTAscz0wO3M8aS5yZW1vdmVkLmxlbmd0aDtzKyspYSs9aS5yZW1vdmVkW3NdLmxlbmd0aDthKz1pLnJlbW92ZWQubGVuZ3RoLTEsbi50eXBlLmRlbGV0ZShvLGEpfW4udHlwZS5pbnNlcnQobyxpLnRleHQuam9pbihcIlxcblwiKSl9fSl9dmFyIE90PVwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmXCJzeW1ib2xcIj09dHlwZW9mIFN5bWJvbC5pdGVyYXRvcj9mdW5jdGlvbih0KXtyZXR1cm4gdHlwZW9mIHR9OmZ1bmN0aW9uKHQpe3JldHVybiB0JiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJnQuY29uc3RydWN0b3I9PT1TeW1ib2wmJnQhPT1TeW1ib2wucHJvdG90eXBlP1wic3ltYm9sXCI6dHlwZW9mIHR9LEV0PWZ1bmN0aW9uKHQsZSl7aWYoISh0IGluc3RhbmNlb2YgZSkpdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKX0sVXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KHQsZSl7Zm9yKHZhciBuPTA7bjxlLmxlbmd0aDtuKyspe3ZhciByPWVbbl07ci5lbnVtZXJhYmxlPXIuZW51bWVyYWJsZXx8ITEsci5jb25maWd1cmFibGU9ITAsXCJ2YWx1ZVwiaW4gciYmKHIud3JpdGFibGU9ITApLE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0LHIua2V5LHIpfX1yZXR1cm4gZnVuY3Rpb24oZSxuLHIpe3JldHVybiBuJiZ0KGUucHJvdG90eXBlLG4pLHImJnQoZSxyKSxlfX0oKSxCdD1mdW5jdGlvbiB0KGUsbixyKXtudWxsPT09ZSYmKGU9RnVuY3Rpb24ucHJvdG90eXBlKTt2YXIgaT1PYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGUsbik7aWYodm9pZCAwPT09aSl7dmFyIG89T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpO3JldHVybiBudWxsPT09bz92b2lkIDA6dChvLG4scil9aWYoXCJ2YWx1ZVwiaW4gaSlyZXR1cm4gaS52YWx1ZTt2YXIgYT1pLmdldDtpZih2b2lkIDAhPT1hKXJldHVybiBhLmNhbGwocil9LFR0PWZ1bmN0aW9uKHQsZSl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgZSYmbnVsbCE9PWUpdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIrdHlwZW9mIGUpO3QucHJvdG90eXBlPU9iamVjdC5jcmVhdGUoZSYmZS5wcm90b3R5cGUse2NvbnN0cnVjdG9yOnt2YWx1ZTp0LGVudW1lcmFibGU6ITEsd3JpdGFibGU6ITAsY29uZmlndXJhYmxlOiEwfX0pLGUmJihPYmplY3Quc2V0UHJvdG90eXBlT2Y/T2JqZWN0LnNldFByb3RvdHlwZU9mKHQsZSk6dC5fX3Byb3RvX189ZSl9LEF0PWZ1bmN0aW9uKHQsZSl7aWYoIXQpdGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwidGhpcyBoYXNuJ3QgYmVlbiBpbml0aWFsaXNlZCAtIHN1cGVyKCkgaGFzbid0IGJlZW4gY2FsbGVkXCIpO3JldHVybiFlfHxcIm9iamVjdFwiIT10eXBlb2YgZSYmXCJmdW5jdGlvblwiIT10eXBlb2YgZT90OmV9LHh0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCh0LGUpe3ZhciBuPVtdLHI9ITAsaT0hMSxvPXZvaWQgMDt0cnl7Zm9yKHZhciBhLHM9dFtTeW1ib2wuaXRlcmF0b3JdKCk7IShyPShhPXMubmV4dCgpKS5kb25lKSYmKG4ucHVzaChhLnZhbHVlKSwhZXx8bi5sZW5ndGghPT1lKTtyPSEwKTt9Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX1yZXR1cm4gbn1yZXR1cm4gZnVuY3Rpb24oZSxuKXtpZihBcnJheS5pc0FycmF5KGUpKXJldHVybiBlO2lmKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoZSkpcmV0dXJuIHQoZSxuKTt0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIGRlc3RydWN0dXJlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZVwiKX19KCksSXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQpe0V0KHRoaXMsZSksdGhpcy52YWw9dCx0aGlzLmNvbG9yPSEwLHRoaXMuX2xlZnQ9bnVsbCx0aGlzLl9yaWdodD1udWxsLHRoaXMuX3BhcmVudD1udWxsfXJldHVybiBVdChlLFt7a2V5OlwiaXNSZWRcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbG9yfX0se2tleTpcImlzQmxhY2tcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiF0aGlzLmNvbG9yfX0se2tleTpcInJlZGRlblwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3I9ITAsdGhpc319LHtrZXk6XCJibGFja2VuXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb2xvcj0hMSx0aGlzfX0se2tleTpcInJvdGF0ZUxlZnRcIix2YWx1ZTpmdW5jdGlvbihlKXt2YXIgbj10aGlzLnBhcmVudCxyPXRoaXMucmlnaHQsaT10aGlzLnJpZ2h0LmxlZnQ7ci5sZWZ0PXRoaXMsdGhpcy5yaWdodD1pLHQoZSxuLHIsdGhpcyl9fSx7a2V5OlwibmV4dFwiLHZhbHVlOmZ1bmN0aW9uKCl7aWYobnVsbCE9PXRoaXMucmlnaHQpe2Zvcih2YXIgdD10aGlzLnJpZ2h0O251bGwhPT10LmxlZnQ7KXQ9dC5sZWZ0O3JldHVybiB0fWZvcih2YXIgZT10aGlzO251bGwhPT1lLnBhcmVudCYmZSE9PWUucGFyZW50LmxlZnQ7KWU9ZS5wYXJlbnQ7cmV0dXJuIGUucGFyZW50fX0se2tleTpcInByZXZcIix2YWx1ZTpmdW5jdGlvbigpe2lmKG51bGwhPT10aGlzLmxlZnQpe2Zvcih2YXIgdD10aGlzLmxlZnQ7bnVsbCE9PXQucmlnaHQ7KXQ9dC5yaWdodDtyZXR1cm4gdH1mb3IodmFyIGU9dGhpcztudWxsIT09ZS5wYXJlbnQmJmUhPT1lLnBhcmVudC5yaWdodDspZT1lLnBhcmVudDtyZXR1cm4gZS5wYXJlbnR9fSx7a2V5Olwicm90YXRlUmlnaHRcIix2YWx1ZTpmdW5jdGlvbihlKXt2YXIgbj10aGlzLnBhcmVudCxyPXRoaXMubGVmdCxpPXRoaXMubGVmdC5yaWdodDtyLnJpZ2h0PXRoaXMsdGhpcy5sZWZ0PWksdChlLG4scix0aGlzKX19LHtrZXk6XCJnZXRVbmNsZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucGFyZW50PT09dGhpcy5wYXJlbnQucGFyZW50LmxlZnQ/dGhpcy5wYXJlbnQucGFyZW50LnJpZ2h0OnRoaXMucGFyZW50LnBhcmVudC5sZWZ0fX0se2tleTpcImdyYW5kcGFyZW50XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucGFyZW50LnBhcmVudH19LHtrZXk6XCJwYXJlbnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fcGFyZW50fX0se2tleTpcInNpYmxpbmdcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcz09PXRoaXMucGFyZW50LmxlZnQ/dGhpcy5wYXJlbnQucmlnaHQ6dGhpcy5wYXJlbnQubGVmdH19LHtrZXk6XCJsZWZ0XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX2xlZnR9LHNldDpmdW5jdGlvbih0KXtudWxsIT09dCYmKHQuX3BhcmVudD10aGlzKSx0aGlzLl9sZWZ0PXR9fSx7a2V5OlwicmlnaHRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fcmlnaHR9LHNldDpmdW5jdGlvbih0KXtudWxsIT09dCYmKHQuX3BhcmVudD10aGlzKSx0aGlzLl9yaWdodD10fX1dKSxlfSgpLER0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe0V0KHRoaXMsdCksdGhpcy5yb290PW51bGwsdGhpcy5sZW5ndGg9MH1yZXR1cm4gVXQodCxbe2tleTpcImZpbmROZXh0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dC5jbG9uZSgpO3JldHVybiBlLmNsb2NrKz0xLHRoaXMuZmluZFdpdGhMb3dlckJvdW5kKGUpfX0se2tleTpcImZpbmRQcmV2XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dC5jbG9uZSgpO3JldHVybiBlLmNsb2NrLT0xLHRoaXMuZmluZFdpdGhVcHBlckJvdW5kKGUpfX0se2tleTpcImZpbmROb2RlV2l0aExvd2VyQm91bmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnJvb3Q7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7Zm9yKDs7KWlmKG51bGw9PT10fHx0Lmxlc3NUaGFuKGUudmFsLl9pZCkmJm51bGwhPT1lLmxlZnQpZT1lLmxlZnQ7ZWxzZXtpZihudWxsPT09dHx8IWUudmFsLl9pZC5sZXNzVGhhbih0KSlyZXR1cm4gZTtpZihudWxsPT09ZS5yaWdodClyZXR1cm4gZS5uZXh0KCk7ZT1lLnJpZ2h0fX19LHtrZXk6XCJmaW5kTm9kZVdpdGhVcHBlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodm9pZCAwPT09dCl0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBkZWZpbmUgZnJvbSFcIik7dmFyIGU9dGhpcy5yb290O2lmKG51bGw9PT1lKXJldHVybiBudWxsO2Zvcig7OylpZihudWxsIT09dCYmIWUudmFsLl9pZC5sZXNzVGhhbih0KXx8bnVsbD09PWUucmlnaHQpe2lmKG51bGw9PT10fHwhdC5sZXNzVGhhbihlLnZhbC5faWQpKXJldHVybiBlO2lmKG51bGw9PT1lLmxlZnQpcmV0dXJuIGUucHJldigpO2U9ZS5sZWZ0fWVsc2UgZT1lLnJpZ2h0fX0se2tleTpcImZpbmRTbWFsbGVzdE5vZGVcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD10aGlzLnJvb3Q7bnVsbCE9dCYmbnVsbCE9dC5sZWZ0Oyl0PXQubGVmdDtyZXR1cm4gdH19LHtrZXk6XCJmaW5kV2l0aExvd2VyQm91bmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmROb2RlV2l0aExvd2VyQm91bmQodCk7cmV0dXJuIG51bGw9PWU/bnVsbDplLnZhbH19LHtrZXk6XCJmaW5kV2l0aFVwcGVyQm91bmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmROb2RlV2l0aFVwcGVyQm91bmQodCk7cmV0dXJuIG51bGw9PWU/bnVsbDplLnZhbH19LHtrZXk6XCJpdGVyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3ZhciByO2ZvcihyPW51bGw9PT10P3RoaXMuZmluZFNtYWxsZXN0Tm9kZSgpOnRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZCh0KTtudWxsIT09ciYmKG51bGw9PT1lfHxyLnZhbC5faWQubGVzc1RoYW4oZSl8fHIudmFsLl9pZC5lcXVhbHMoZSkpOyluKHIudmFsKSxyPXIubmV4dCgpfX0se2tleTpcImZpbmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmROb2RlKHQpO3JldHVybiBudWxsIT09ZT9lLnZhbDpudWxsfX0se2tleTpcImZpbmROb2RlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5yb290O2lmKG51bGw9PT1lKXJldHVybiBudWxsO2Zvcig7Oyl7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7aWYodC5sZXNzVGhhbihlLnZhbC5faWQpKWU9ZS5sZWZ0O2Vsc2V7aWYoIWUudmFsLl9pZC5sZXNzVGhhbih0KSlyZXR1cm4gZTtlPWUucmlnaHR9fX19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmROb2RlKHQpO2lmKG51bGwhPWUpe2lmKHRoaXMubGVuZ3RoLS0sbnVsbCE9PWUubGVmdCYmbnVsbCE9PWUucmlnaHQpe2Zvcih2YXIgbj1lLmxlZnQ7bnVsbCE9PW4ucmlnaHQ7KW49bi5yaWdodDtlLnZhbD1uLnZhbCxlPW59dmFyIHIsaT1lLmxlZnR8fGUucmlnaHQ7aWYobnVsbD09PWk/KHI9ITAsaT1uZXcgSXQobnVsbCksaS5ibGFja2VuKCksZS5yaWdodD1pKTpyPSExLG51bGw9PT1lLnBhcmVudClyZXR1cm4gdm9pZChyP3RoaXMucm9vdD1udWxsOih0aGlzLnJvb3Q9aSxpLmJsYWNrZW4oKSxpLl9wYXJlbnQ9bnVsbCkpO2lmKGUucGFyZW50LmxlZnQ9PT1lKWUucGFyZW50LmxlZnQ9aTtlbHNle2lmKGUucGFyZW50LnJpZ2h0IT09ZSl0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIVwiKTtlLnBhcmVudC5yaWdodD1pfWlmKGUuaXNCbGFjaygpJiYoaS5pc1JlZCgpP2kuYmxhY2tlbigpOnRoaXMuX2ZpeERlbGV0ZShpKSksdGhpcy5yb290LmJsYWNrZW4oKSxyKWlmKGkucGFyZW50LmxlZnQ9PT1pKWkucGFyZW50LmxlZnQ9bnVsbDtlbHNle2lmKGkucGFyZW50LnJpZ2h0IT09aSl0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlICMzXCIpO2kucGFyZW50LnJpZ2h0PW51bGx9fX19LHtrZXk6XCJfZml4RGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0KXtyZXR1cm4gbnVsbD09PXR8fHQuaXNCbGFjaygpfWZ1bmN0aW9uIG4odCl7cmV0dXJuIG51bGwhPT10JiZ0LmlzUmVkKCl9aWYobnVsbCE9PXQucGFyZW50KXt2YXIgcj10LnNpYmxpbmc7aWYobihyKSl7aWYodC5wYXJlbnQucmVkZGVuKCksci5ibGFja2VuKCksdD09PXQucGFyZW50LmxlZnQpdC5wYXJlbnQucm90YXRlTGVmdCh0aGlzKTtlbHNle2lmKHQhPT10LnBhcmVudC5yaWdodCl0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlICMyXCIpO3QucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpfXI9dC5zaWJsaW5nfXQucGFyZW50LmlzQmxhY2soKSYmci5pc0JsYWNrKCkmJmUoci5sZWZ0KSYmZShyLnJpZ2h0KT8oci5yZWRkZW4oKSx0aGlzLl9maXhEZWxldGUodC5wYXJlbnQpKTp0LnBhcmVudC5pc1JlZCgpJiZyLmlzQmxhY2soKSYmZShyLmxlZnQpJiZlKHIucmlnaHQpPyhyLnJlZGRlbigpLHQucGFyZW50LmJsYWNrZW4oKSk6KHQ9PT10LnBhcmVudC5sZWZ0JiZyLmlzQmxhY2soKSYmbihyLmxlZnQpJiZlKHIucmlnaHQpPyhyLnJlZGRlbigpLHIubGVmdC5ibGFja2VuKCksci5yb3RhdGVSaWdodCh0aGlzKSxyPXQuc2libGluZyk6dD09PXQucGFyZW50LnJpZ2h0JiZyLmlzQmxhY2soKSYmbihyLnJpZ2h0KSYmZShyLmxlZnQpJiYoci5yZWRkZW4oKSxyLnJpZ2h0LmJsYWNrZW4oKSxyLnJvdGF0ZUxlZnQodGhpcykscj10LnNpYmxpbmcpLHIuY29sb3I9dC5wYXJlbnQuY29sb3IsdC5wYXJlbnQuYmxhY2tlbigpLHQ9PT10LnBhcmVudC5sZWZ0PyhyLnJpZ2h0LmJsYWNrZW4oKSx0LnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpKTooci5sZWZ0LmJsYWNrZW4oKSx0LnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKSkpfX19LHtrZXk6XCJwdXRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT1uZXcgSXQodCk7aWYobnVsbCE9PXRoaXMucm9vdCl7Zm9yKHZhciBuPXRoaXMucm9vdDs7KWlmKGUudmFsLl9pZC5sZXNzVGhhbihuLnZhbC5faWQpKXtpZihudWxsPT09bi5sZWZ0KXtuLmxlZnQ9ZTticmVha31uPW4ubGVmdH1lbHNle2lmKCFuLnZhbC5faWQubGVzc1RoYW4oZS52YWwuX2lkKSlyZXR1cm4gbi52YWw9ZS52YWwsbjtpZihudWxsPT09bi5yaWdodCl7bi5yaWdodD1lO2JyZWFrfW49bi5yaWdodH10aGlzLl9maXhJbnNlcnQoZSl9ZWxzZSB0aGlzLnJvb3Q9ZTtyZXR1cm4gdGhpcy5sZW5ndGgrKyx0aGlzLnJvb3QuYmxhY2tlbigpLGV9fSx7a2V5OlwiX2ZpeEluc2VydFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGw9PT10LnBhcmVudClyZXR1cm4gdm9pZCB0LmJsYWNrZW4oKTtpZighdC5wYXJlbnQuaXNCbGFjaygpKXt2YXIgZT10LmdldFVuY2xlKCk7bnVsbCE9PWUmJmUuaXNSZWQoKT8odC5wYXJlbnQuYmxhY2tlbigpLGUuYmxhY2tlbigpLHQuZ3JhbmRwYXJlbnQucmVkZGVuKCksdGhpcy5fZml4SW5zZXJ0KHQuZ3JhbmRwYXJlbnQpKToodD09PXQucGFyZW50LnJpZ2h0JiZ0LnBhcmVudD09PXQuZ3JhbmRwYXJlbnQubGVmdD8odC5wYXJlbnQucm90YXRlTGVmdCh0aGlzKSx0PXQubGVmdCk6dD09PXQucGFyZW50LmxlZnQmJnQucGFyZW50PT09dC5ncmFuZHBhcmVudC5yaWdodCYmKHQucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpLHQ9dC5yaWdodCksdC5wYXJlbnQuYmxhY2tlbigpLHQuZ3JhbmRwYXJlbnQucmVkZGVuKCksdD09PXQucGFyZW50LmxlZnQ/dC5ncmFuZHBhcmVudC5yb3RhdGVSaWdodCh0aGlzKTp0LmdyYW5kcGFyZW50LnJvdGF0ZUxlZnQodGhpcykpfX19XSksdH0oKSxQdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtFdCh0aGlzLHQpLHRoaXMudXNlcj1lLHRoaXMuY2xvY2s9bn1yZXR1cm4gVXQodCxbe2tleTpcImNsb25lXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IHQodGhpcy51c2VyLHRoaXMuY2xvY2spfX0se2tleTpcImVxdWFsc1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBudWxsIT09dCYmdC51c2VyPT09dGhpcy51c2VyJiZ0LmNsb2NrPT09dGhpcy5jbG9ja319LHtrZXk6XCJsZXNzVGhhblwiLHZhbHVlOmZ1bmN0aW9uKGUpe3JldHVybiBlLmNvbnN0cnVjdG9yPT09dCYmKHRoaXMudXNlcjxlLnVzZXJ8fHRoaXMudXNlcj09PWUudXNlciYmdGhpcy5jbG9jazxlLmNsb2NrKX19XSksdH0oKSxqdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuLHIpe0V0KHRoaXMsdCksdGhpcy5faWQ9ZSx0aGlzLmxlbj1uLHRoaXMuZ2M9cn1yZXR1cm4gVXQodCxbe2tleTpcImNsb25lXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IHQodGhpcy5faWQsdGhpcy5sZW4sdGhpcy5nYyl9fV0pLHR9KCksTnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSgpe3JldHVybiBFdCh0aGlzLGUpLEF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXTt0aGlzLml0ZXJhdGUobnVsbCxudWxsLGZ1bmN0aW9uKGUpe3QucHVzaCh7dXNlcjplLl9pZC51c2VyLGNsb2NrOmUuX2lkLmNsb2NrLGxlbjplLmxlbixnYzplLmdjfSl9KSxjb25zb2xlLnRhYmxlKHQpfX0se2tleTpcImlzRGVsZXRlZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKHQpO3JldHVybiBudWxsIT09ZSYmZS5faWQudXNlcj09PXQudXNlciYmdC5jbG9jazxlLl9pZC5jbG9jaytlLmxlbn19LHtrZXk6XCJtYXJrXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe2lmKDAhPT1lKXt2YXIgcj10aGlzLmZpbmRXaXRoVXBwZXJCb3VuZChuZXcgUHQodC51c2VyLHQuY2xvY2stMSkpO251bGwhPT1yJiZyLl9pZC51c2VyPT09dC51c2VyJiZyLl9pZC5jbG9jazx0LmNsb2NrJiZ0LmNsb2NrPHIuX2lkLmNsb2NrK3IubGVuJiYodC5jbG9jaytlPHIuX2lkLmNsb2NrK3IubGVuJiZ0aGlzLnB1dChuZXcganQobmV3IFB0KHQudXNlcix0LmNsb2NrK2UpLHIuX2lkLmNsb2NrK3IubGVuLXQuY2xvY2stZSxyLmdjKSksci5sZW49dC5jbG9jay1yLl9pZC5jbG9jayk7dmFyIGk9bmV3IFB0KHQudXNlcix0LmNsb2NrK2UtMSksbz10aGlzLmZpbmRXaXRoVXBwZXJCb3VuZChpKTtpZihudWxsIT09byYmby5faWQudXNlcj09PXQudXNlciYmby5faWQuY2xvY2s8dC5jbG9jaytlJiZ0LmNsb2NrPD1vLl9pZC5jbG9jayYmdC5jbG9jaytlPG8uX2lkLmNsb2NrK28ubGVuKXt2YXIgYT10LmNsb2NrK2Utby5faWQuY2xvY2s7by5faWQ9bmV3IFB0KG8uX2lkLnVzZXIsby5faWQuY2xvY2srYSksby5sZW4tPWF9dmFyIHM9W107dGhpcy5pdGVyYXRlKHQsaSxmdW5jdGlvbih0KXtzLnB1c2godC5faWQpfSk7Zm9yKHZhciBsPXMubGVuZ3RoLTE7bD49MDtsLS0pdGhpcy5kZWxldGUoc1tsXSk7dmFyIHU9bmV3IGp0KHQsZSxuKTtudWxsIT09ciYmci5faWQudXNlcj09PXQudXNlciYmci5faWQuY2xvY2srci5sZW49PT10LmNsb2NrJiZyLmdjPT09biYmKHIubGVuKz1lLHU9cik7dmFyIGM9dGhpcy5maW5kKG5ldyBQdCh0LnVzZXIsdC5jbG9jaytlKSk7bnVsbCE9PWMmJmMuX2lkLnVzZXI9PT10LnVzZXImJnQuY2xvY2srZT09PWMuX2lkLmNsb2NrJiZuPT09Yy5nYyYmKHUubGVuKz1jLmxlbix0aGlzLmRlbGV0ZShjLl9pZCkpLHIhPT11JiZ0aGlzLnB1dCh1KX19fSx7a2V5OlwibWFya0RlbGV0ZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMubWFyayh0LGUsITEpfX1dKSxlfShEdCksVnQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe2lmKEV0KHRoaXMsdCksZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKXRoaXMudWludDhhcnI9bmV3IFVpbnQ4QXJyYXkoZSk7ZWxzZXtpZighKGUgaW5zdGFuY2VvZiBVaW50OEFycmF5fHxcInVuZGVmaW5lZFwiIT10eXBlb2YgQnVmZmVyJiZlIGluc3RhbmNlb2YgQnVmZmVyKSl0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IVwiKTt0aGlzLnVpbnQ4YXJyPWV9dGhpcy5wb3M9MH1yZXR1cm4gVXQodCxbe2tleTpcImNsb25lXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgZT1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06dGhpcy5wb3Msbj1uZXcgdCh0aGlzLnVpbnQ4YXJyKTtyZXR1cm4gbi5wb3M9ZSxufX0se2tleTpcInNraXA4XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnBvcysrfX0se2tleTpcInJlYWRVaW50OFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudWludDhhcnJbdGhpcy5wb3MrK119fSx7a2V5OlwicmVhZFVpbnQzMlwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy51aW50OGFyclt0aGlzLnBvc10rKHRoaXMudWludDhhcnJbdGhpcy5wb3MrMV08PDgpKyh0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKzJdPDwxNikrKHRoaXMudWludDhhcnJbdGhpcy5wb3MrM108PDI0KTtyZXR1cm4gdGhpcy5wb3MrPTQsdH19LHtrZXk6XCJwZWVrVWludDhcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVpbnQ4YXJyW3RoaXMucG9zXX19LHtrZXk6XCJyZWFkVmFyVWludFwiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PTAsZT0wOzspe3ZhciBuPXRoaXMudWludDhhcnJbdGhpcy5wb3MrK107aWYodHw9KDEyNyZuKTw8ZSxlKz03LG48MTI4KXJldHVybiB0Pj4+MDtpZihlPjM1KXRocm93IG5ldyBFcnJvcihcIkludGVnZXIgb3V0IG9mIHJhbmdlIVwiKX19fSx7a2V5OlwicmVhZFZhclN0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7Zm9yKHZhciB0PXRoaXMucmVhZFZhclVpbnQoKSxlPW5ldyBBcnJheSh0KSxuPTA7bjx0O24rKyllW25dPXRoaXMudWludDhhcnJbdGhpcy5wb3MrK107dmFyIHI9ZS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KHQpfSkuam9pbihcIlwiKTtyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGVzY2FwZShyKSl9fSx7a2V5OlwicGVla1ZhclN0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5wb3MsZT10aGlzLnJlYWRWYXJTdHJpbmcoKTtyZXR1cm4gdGhpcy5wb3M9dCxlfX0se2tleTpcInJlYWRJRFwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5yZWFkVmFyVWludCgpO2lmKHQ9PT1xdCl7dmFyIGU9bmV3ICR0KHRoaXMucmVhZFZhclN0cmluZygpLG51bGwpO3JldHVybiBlLnR5cGU9dGhpcy5yZWFkVmFyVWludCgpLGV9cmV0dXJuIG5ldyBQdCh0LHRoaXMucmVhZFZhclVpbnQoKSl9fSx7a2V5OlwibGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMudWludDhhcnIubGVuZ3RofX1dKSx0fSgpLEx0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe0V0KHRoaXMsdCksdGhpcy5faWQ9bnVsbCx0aGlzLl9sZW5ndGg9MH1yZXR1cm4gVXQodCxbe2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbihlKXt2YXIgbj10aGlzLl9pZCxyPWUuc3MuZ2V0U3RhdGUobi51c2VyKTtuLmNsb2NrPT09ciYmZS5zcy5zZXRTdGF0ZShuLnVzZXIsbi5jbG9jayt0aGlzLl9sZW5ndGgpLGUuZHMubWFyayh0aGlzLl9pZCx0aGlzLl9sZW5ndGgsITApO3ZhciBpPWUub3MucHV0KHRoaXMpLG89aS5wcmV2KCkudmFsO251bGwhPT1vJiZvLmNvbnN0cnVjdG9yPT09dCYmby5faWQudXNlcj09PWkudmFsLl9pZC51c2VyJiZvLl9pZC5jbG9jaytvLl9sZW5ndGg9PT1pLnZhbC5faWQuY2xvY2smJihvLl9sZW5ndGgrPWkudmFsLl9sZW5ndGgsZS5vcy5kZWxldGUoaS52YWwuX2lkKSxpPW8pLGkudmFsJiYoaT1pLnZhbCk7dmFyIGE9ZS5vcy5maW5kTmV4dChpLl9pZCk7bnVsbCE9PWEmJmEuY29uc3RydWN0b3I9PT10JiZhLl9pZC51c2VyPT09aS5faWQudXNlciYmYS5faWQuY2xvY2s9PT1pLl9pZC5jbG9jaytpLl9sZW5ndGgmJihpLl9sZW5ndGgrPWEuX2xlbmd0aCxlLm9zLmRlbGV0ZShhLl9pZCkpLG4udXNlciE9PXF0JiYobnVsbD09PWUuY29ubmVjdG9yfHwhZS5jb25uZWN0b3IuX2ZvcndhcmRBcHBsaWVkU3RydWN0cyYmbi51c2VyIT09ZS51c2VySUR8fGUuY29ubmVjdG9yLmJyb2FkY2FzdFN0cnVjdCh0aGlzKSxudWxsIT09ZS5wZXJzaXN0ZW5jZSYmZS5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KGUsdGhpcykpfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKSx0LndyaXRlSUQodGhpcy5faWQpLHQud3JpdGVWYXJVaW50KHRoaXMuX2xlbmd0aCl9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPWUucmVhZElEKCk7dGhpcy5faWQ9bix0aGlzLl9sZW5ndGg9ZS5yZWFkVmFyVWludCgpO3ZhciByPVtdO3JldHVybiB0LnNzLmdldFN0YXRlKG4udXNlcik8bi5jbG9jayYmci5wdXNoKG5ldyBQdChuLnVzZXIsbi5jbG9jay0xKSkscn19LHtrZXk6XCJfc3BsaXRBdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9fSx7a2V5OlwiX2Nsb25lUGFydGlhbFwiLHZhbHVlOmZ1bmN0aW9uKGUpe3ZhciBuPW5ldyB0O3JldHVybiBuLl9pZD1uZXcgUHQodGhpcy5faWQudXNlcix0aGlzLl9pZC5jbG9jaytlKSxuLl9sZW5ndGg9dGhpcy5fbGVuZ3RoLWUsbn19LHtrZXk6XCJfZGVsZXRlZFwiLGdldDpmdW5jdGlvbigpe3JldHVybiEwfX1dKSx0fSgpLE10PWZ1bmN0aW9uIHQoZSxuLHIpe0V0KHRoaXMsdCksdGhpcy5kZWNvZGVyPWUsdGhpcy5taXNzaW5nPW4ubGVuZ3RoLHRoaXMuc3RydWN0PXJ9LEN0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe0V0KHRoaXMsdCksdGhpcy5kYXRhPVtdfXJldHVybiBVdCh0LFt7a2V5OlwiY3JlYXRlQnVmZmVyXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gVWludDhBcnJheS5mcm9tKHRoaXMuZGF0YSkuYnVmZmVyfX0se2tleTpcIndyaXRlVWludDhcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmRhdGEucHVzaCgyNTUmdCl9fSx7a2V5Olwic2V0VWludDhcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMuZGF0YVt0XT0yNTUmZX19LHtrZXk6XCJ3cml0ZVVpbnQxNlwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZGF0YS5wdXNoKDI1NSZ0LHQ+Pj44JjI1NSl9fSx7a2V5Olwic2V0VWludDE2XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLmRhdGFbdF09MjU1JmUsdGhpcy5kYXRhW3QrMV09ZT4+PjgmMjU1fX0se2tleTpcIndyaXRlVWludDMyXCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPTA7ZTw0O2UrKyl0aGlzLmRhdGEucHVzaCgyNTUmdCksdD4+Pj04fX0se2tleTpcInNldFVpbnQzMlwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7Zm9yKHZhciBuPTA7bjw0O24rKyl0aGlzLmRhdGFbdCtuXT0yNTUmZSxlPj4+PTh9fSx7a2V5Olwid3JpdGVWYXJVaW50XCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKDt0Pj0xMjg7KXRoaXMuZGF0YS5wdXNoKDEyOHwxMjcmdCksdD4+Pj03O3RoaXMuZGF0YS5wdXNoKDEyNyZ0KX19LHtrZXk6XCJ3cml0ZVZhclN0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKHQpe1xudmFyIGU9dW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHQpKSxuPWUuc3BsaXQoXCJcIikubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0LmNvZGVQb2ludEF0KCl9KSxyPW4ubGVuZ3RoO3RoaXMud3JpdGVWYXJVaW50KHIpO2Zvcih2YXIgaT0wO2k8cjtpKyspdGhpcy5kYXRhLnB1c2gobltpXSl9fSx7a2V5Olwid3JpdGVJRFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQudXNlcjt0aGlzLndyaXRlVmFyVWludChlKSxlIT09cXQ/dGhpcy53cml0ZVZhclVpbnQodC5jbG9jayk6KHRoaXMud3JpdGVWYXJTdHJpbmcodC5uYW1lKSx0aGlzLndyaXRlVmFyVWludCh0LnR5cGUpKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kYXRhLmxlbmd0aH19LHtrZXk6XCJwb3NcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kYXRhLmxlbmd0aH19XSksdH0oKSxEZWxldGU9ZnVuY3Rpb24oKXtmdW5jdGlvbiBEZWxldGUoKXtFdCh0aGlzLERlbGV0ZSksdGhpcy5fdGFyZ2V0PW51bGwsdGhpcy5fbGVuZ3RoPW51bGx9cmV0dXJuIFV0KERlbGV0ZSxbe2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1lLnJlYWRJRCgpO3JldHVybiB0aGlzLl90YXJnZXRJRD1uLHRoaXMuX2xlbmd0aD1lLnJlYWRWYXJVaW50KCksbnVsbD09PXQub3MuZ2V0SXRlbShuKT9bbl06W119fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7dC53cml0ZVVpbnQ4KCQodGhpcy5jb25zdHJ1Y3RvcikpLHQud3JpdGVJRCh0aGlzLl90YXJnZXRJRCksdC53cml0ZVZhclVpbnQodGhpcy5fbGVuZ3RoKX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYoYXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0mJmFyZ3VtZW50c1sxXSludWxsIT09dC5jb25uZWN0b3ImJnQuY29ubmVjdG9yLmJyb2FkY2FzdFN0cnVjdCh0aGlzKTtlbHNle3ZhciBlPXRoaXMuX3RhcmdldElEO2codCxlLnVzZXIsZS5jbG9jayx0aGlzLl9sZW5ndGgsITEpfW51bGwhPT10LnBlcnNpc3RlbmNlJiZ0LnBlcnNpc3RlbmNlLnNhdmVTdHJ1Y3QodCx0aGlzKX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm5cIkRlbGV0ZSAtIHRhcmdldDogXCIrcCh0aGlzLl90YXJnZXRJRCkrXCIsIGxlbjogXCIrdGhpcy5fbGVuZ3RofX1dKSxEZWxldGV9KCksUnQ9ZnVuY3Rpb24gdChlKXtFdCh0aGlzLHQpLHRoaXMueT1lLHRoaXMubmV3VHlwZXM9bmV3IFNldCx0aGlzLmNoYW5nZWRUeXBlcz1uZXcgTWFwLHRoaXMuZGVsZXRlZFN0cnVjdHM9bmV3IFNldCx0aGlzLmJlZm9yZVN0YXRlPW5ldyBNYXAsdGhpcy5jaGFuZ2VkUGFyZW50VHlwZXM9bmV3IE1hcH0sSXRlbT1mdW5jdGlvbigpe2Z1bmN0aW9uIEl0ZW0oKXtFdCh0aGlzLEl0ZW0pLHRoaXMuX2lkPW51bGwsdGhpcy5fb3JpZ2luPW51bGwsdGhpcy5fbGVmdD1udWxsLHRoaXMuX3JpZ2h0PW51bGwsdGhpcy5fcmlnaHRfb3JpZ2luPW51bGwsdGhpcy5fcGFyZW50PW51bGwsdGhpcy5fcGFyZW50U3ViPW51bGwsdGhpcy5fZGVsZXRlZD0hMSx0aGlzLl9yZWRvbmU9bnVsbH1yZXR1cm4gVXQoSXRlbSxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3J9fSx7a2V5OlwiX3JlZG9cIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKG51bGwhPT10aGlzLl9yZWRvbmUpcmV0dXJuIHRoaXMuX3JlZG9uZTt2YXIgbj10aGlzLl9jb3B5KCkscj12b2lkIDAsaT12b2lkIDA7bnVsbD09PXRoaXMuX3BhcmVudFN1Yj8ocj10aGlzLl9sZWZ0LGk9dGhpcyk6KHI9bnVsbCxpPXRoaXMuX3BhcmVudC5fbWFwLmdldCh0aGlzLl9wYXJlbnRTdWIpLGkuX2RlbGV0ZSh0KSk7dmFyIG89dGhpcy5fcGFyZW50O2lmKCEoITAhPT1vLl9kZWxldGVkfHxudWxsIT09by5fcmVkb25lfHxlLmhhcyhvKSYmby5fcmVkbyh0LGUpKSlyZXR1cm4hMTtpZihudWxsIT09by5fcmVkb25lKXtmb3Iobz1vLl9yZWRvbmU7bnVsbCE9PXI7KXtpZihudWxsIT09ci5fcmVkb25lJiZyLl9yZWRvbmUuX3BhcmVudD09PW8pe3I9ci5fcmVkb25lO2JyZWFrfXI9ci5fbGVmdH1mb3IoO251bGwhPT1pOyludWxsIT09aS5fcmVkb25lJiZpLl9yZWRvbmUuX3BhcmVudD09PW8mJihpPWkuX3JlZG9uZSksaT1pLl9yaWdodH1yZXR1cm4gbi5fb3JpZ2luPXIsbi5fbGVmdD1yLG4uX3JpZ2h0PWksbi5fcmlnaHRfb3JpZ2luPWksbi5fcGFyZW50PW8sbi5fcGFyZW50U3ViPXRoaXMuX3BhcmVudFN1YixuLl9pbnRlZ3JhdGUodCksdGhpcy5fcmVkb25lPW4sITB9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3JldHVybiAwPT09ZT90aGlzOnRoaXMuX3JpZ2h0fX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT0hKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdKXx8YXJndW1lbnRzWzFdO2lmKCF0aGlzLl9kZWxldGVkKXt0aGlzLl9kZWxldGVkPSEwLHQuZHMubWFyayh0aGlzLl9pZCx0aGlzLl9sZW5ndGgsITEpO3ZhciBuPW5ldyBEZWxldGU7bi5fdGFyZ2V0SUQ9dGhpcy5faWQsbi5fbGVuZ3RoPXRoaXMuX2xlbmd0aCxlP24uX2ludGVncmF0ZSh0LCEwKTpudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsbiksbSh0LHRoaXMuX3BhcmVudCx0aGlzLl9wYXJlbnRTdWIpLHQuX3RyYW5zYWN0aW9uLmRlbGV0ZWRTdHJ1Y3RzLmFkZCh0aGlzKX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9bmV3IEx0O2UuX2lkPXRoaXMuX2lkLGUuX2xlbmd0aD10aGlzLl9sZW5ndGgsdC5vcy5kZWxldGUodGhpcy5faWQpLGUuX2ludGVncmF0ZSh0KX19LHtrZXk6XCJfYmVmb3JlQ2hhbmdlXCIsdmFsdWU6ZnVuY3Rpb24oKXt9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3QuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmFkZCh0aGlzKTt2YXIgZT10aGlzLl9wYXJlbnQsbj10aGlzLl9pZCxyPW51bGw9PT1uP3QudXNlcklEOm4udXNlcixpPXQuc3MuZ2V0U3RhdGUocik7aWYobnVsbD09PW4pdGhpcy5faWQ9dC5zcy5nZXROZXh0SUQodGhpcy5fbGVuZ3RoKTtlbHNlIGlmKG4udXNlcj09PXF0KTtlbHNle2lmKG4uY2xvY2s8aSlyZXR1cm5bXTtpZihuLmNsb2NrIT09aSl0aHJvdyBuZXcgRXJyb3IoXCJDYW4gbm90IGFwcGx5IHlldCFcIik7dC5zcy5zZXRTdGF0ZShuLnVzZXIsaSt0aGlzLl9sZW5ndGgpfWUuX2RlbGV0ZWR8fHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5oYXMoZSl8fHQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKXx8dGhpcy5fcGFyZW50Ll9iZWZvcmVDaGFuZ2UoKTt2YXIgbz12b2lkIDA7bz1udWxsIT09dGhpcy5fbGVmdD90aGlzLl9sZWZ0Ll9yaWdodDpudWxsIT09dGhpcy5fcGFyZW50U3ViP3RoaXMuX3BhcmVudC5fbWFwLmdldCh0aGlzLl9wYXJlbnRTdWIpfHxudWxsOnRoaXMuX3BhcmVudC5fc3RhcnQ7Zm9yKHZhciBhPW5ldyBTZXQscz1uZXcgU2V0O251bGwhPT1vJiZvIT09dGhpcy5fcmlnaHQ7KXtpZihzLmFkZChvKSxhLmFkZChvKSx0aGlzLl9vcmlnaW49PT1vLl9vcmlnaW4pby5faWQudXNlcjx0aGlzLl9pZC51c2VyJiYodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSk7ZWxzZXtpZighcy5oYXMoby5fb3JpZ2luKSlicmVhazthLmhhcyhvLl9vcmlnaW4pfHwodGhpcy5fbGVmdD1vLGEuY2xlYXIoKSl9bz1vLl9yaWdodH12YXIgbD10aGlzLl9wYXJlbnRTdWI7aWYobnVsbD09PXRoaXMuX2xlZnQpe3ZhciB1PXZvaWQgMDtpZihudWxsIT09bCl7dmFyIGM9ZS5fbWFwO3U9Yy5nZXQobCl8fG51bGwsYy5zZXQobCx0aGlzKX1lbHNlIHU9ZS5fc3RhcnQsZS5fc3RhcnQ9dGhpczt0aGlzLl9yaWdodD11LG51bGwhPT11JiYodS5fbGVmdD10aGlzKX1lbHNle3ZhciBoPXRoaXMuX2xlZnQsZj1oLl9yaWdodDt0aGlzLl9yaWdodD1mLGguX3JpZ2h0PXRoaXMsbnVsbCE9PWYmJihmLl9sZWZ0PXRoaXMpfWUuX2RlbGV0ZWQmJnRoaXMuX2RlbGV0ZSh0LCExKSx0Lm9zLnB1dCh0aGlzKSxtKHQsZSxsKSx0aGlzLl9pZC51c2VyIT09cXQmJihudWxsPT09dC5jb25uZWN0b3J8fCF0LmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzJiZ0aGlzLl9pZC51c2VyIT09dC51c2VySUR8fHQuY29ubmVjdG9yLmJyb2FkY2FzdFN0cnVjdCh0aGlzKSxudWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsdGhpcykpfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKTt2YXIgZT0wO251bGwhPT10aGlzLl9vcmlnaW4mJihlKz0xKSxudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYoZSs9NCksbnVsbCE9PXRoaXMuX3BhcmVudFN1YiYmKGUrPTgpLHQud3JpdGVVaW50OChlKSx0LndyaXRlSUQodGhpcy5faWQpLDEmZSYmdC53cml0ZUlEKHRoaXMuX29yaWdpbi5fbGFzdElkKSw0JmUmJnQud3JpdGVJRCh0aGlzLl9yaWdodF9vcmlnaW4uX2lkKSwwPT0oNSZlKSYmdC53cml0ZUlEKHRoaXMuX3BhcmVudC5faWQpLDgmZSYmdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLl9wYXJlbnRTdWIpKX19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49W10scj1lLnJlYWRVaW50OCgpLGk9ZS5yZWFkSUQoKTtpZih0aGlzLl9pZD1pLDEmcil7dmFyIG89ZS5yZWFkSUQoKSxhPXQub3MuZ2V0SXRlbUNsZWFuRW5kKG8pO251bGw9PT1hP24ucHVzaChvKToodGhpcy5fb3JpZ2luPWEsdGhpcy5fbGVmdD10aGlzLl9vcmlnaW4pfWlmKDQmcil7dmFyIHM9ZS5yZWFkSUQoKSxsPXQub3MuZ2V0SXRlbUNsZWFuU3RhcnQocyk7bnVsbD09PWw/bi5wdXNoKHMpOih0aGlzLl9yaWdodD1sLHRoaXMuX3JpZ2h0X29yaWdpbj1sKX1pZigwPT0oNSZyKSl7dmFyIHU9ZS5yZWFkSUQoKTtpZihudWxsPT09dGhpcy5fcGFyZW50KXt2YXIgYz12b2lkIDA7Yz11LmNvbnN0cnVjdG9yPT09JHQ/dC5vcy5nZXQodSk6dC5vcy5nZXRJdGVtKHUpLG51bGw9PT1jP24ucHVzaCh1KTp0aGlzLl9wYXJlbnQ9Y319ZWxzZSBudWxsPT09dGhpcy5fcGFyZW50JiYobnVsbCE9PXRoaXMuX29yaWdpbj90aGlzLl9vcmlnaW4uY29uc3RydWN0b3I9PT1MdD90aGlzLl9wYXJlbnQ9dGhpcy5fb3JpZ2luOnRoaXMuX3BhcmVudD10aGlzLl9vcmlnaW4uX3BhcmVudDpudWxsIT09dGhpcy5fcmlnaHRfb3JpZ2luJiYodGhpcy5fcmlnaHRfb3JpZ2luLmNvbnN0cnVjdG9yPT09THQ/dGhpcy5fcGFyZW50PXRoaXMuX3JpZ2h0X29yaWdpbjp0aGlzLl9wYXJlbnQ9dGhpcy5fcmlnaHRfb3JpZ2luLl9wYXJlbnQpKTtyZXR1cm4gOCZyJiYodGhpcy5fcGFyZW50U3ViPUpTT04ucGFyc2UoZS5yZWFkVmFyU3RyaW5nKCkpKSx0LnNzLmdldFN0YXRlKGkudXNlcik8aS5jbG9jayYmbi5wdXNoKG5ldyBQdChpLnVzZXIsaS5jbG9jay0xKSksbn19LHtrZXk6XCJfbGFzdElkXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBQdCh0aGlzLl9pZC51c2VyLHRoaXMuX2lkLmNsb2NrK3RoaXMuX2xlbmd0aC0xKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fSx7a2V5OlwiX2NvdW50YWJsZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiEwfX1dKSxJdGVtfSgpLFd0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe0V0KHRoaXMsdCksdGhpcy5ldmVudExpc3RlbmVycz1bXX1yZXR1cm4gVXQodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZXZlbnRMaXN0ZW5lcnM9bnVsbH19LHtrZXk6XCJhZGRFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5ldmVudExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcInJlbW92ZUV2ZW50TGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmV2ZW50TGlzdGVuZXJzPXRoaXMuZXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiB0IT09ZX0pfX0se2tleTpcInJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50TGlzdGVuZXJzPVtdfX0se2tleTpcImNhbGxFdmVudExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7Zm9yKHZhciBuPTA7bjx0aGlzLmV2ZW50TGlzdGVuZXJzLmxlbmd0aDtuKyspdHJ5eygwLHRoaXMuZXZlbnRMaXN0ZW5lcnNbbl0pKGUpfWNhdGNoKHQpe2NvbnNvbGUuZXJyb3IodCl9fX1dKSx0fSgpLFR5cGU9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gVHlwZSgpe0V0KHRoaXMsVHlwZSk7dmFyIHQ9QXQodGhpcywoVHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX21hcD1uZXcgTWFwLHQuX3N0YXJ0PW51bGwsdC5feT1udWxsLHQuX2V2ZW50SGFuZGxlcj1uZXcgV3QsdC5fZGVlcEV2ZW50SGFuZGxlcj1uZXcgV3QsdH1yZXR1cm4gVHQoVHlwZSx0KSxVdChUeXBlLFt7a2V5OlwiZ2V0UGF0aFRvXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodD09PXRoaXMpcmV0dXJuW107Zm9yKHZhciBlPVtdLG49dGhpcy5feTt0IT09dGhpcyYmdCE9PW47KXt2YXIgcj10Ll9wYXJlbnQ7aWYobnVsbCE9PXQuX3BhcmVudFN1YillLnVuc2hpZnQodC5fcGFyZW50U3ViKTtlbHNle3ZhciBpPSEwLG89ITEsYT12b2lkIDA7dHJ5e2Zvcih2YXIgcyxsPXJbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7dmFyIHU9eHQocy52YWx1ZSwyKSxjPXVbMF07aWYodVsxXT09PXQpe2UudW5zaGlmdChjKTticmVha319fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fXQ9cn1pZih0IT09dGhpcyl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgdHlwZSBpcyBub3QgYSBjaGlsZCBvZiB0aGlzIG5vZGVcIik7cmV0dXJuIGV9fSx7a2V5OlwiX2NhbGxFdmVudEhhbmRsZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXQuY2hhbmdlZFBhcmVudFR5cGVzO3RoaXMuX2V2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnModCxlKTtmb3IodmFyIHI9dGhpcztyIT09dGhpcy5feTspe3ZhciBpPW4uZ2V0KHIpO3ZvaWQgMD09PWkmJihpPVtdLG4uc2V0KHIsaSkpLGkucHVzaChlKSxyPXIuX3BhcmVudH19fSx7a2V5OlwiX3RyYW5zYWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5feTtudWxsIT09ZT9lLnRyYW5zYWN0KHQpOnQoZSl9fSx7a2V5Olwib2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcIm9ic2VydmVEZWVwXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZGVlcEV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2V2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKHQpfX0se2tleTpcInVub2JzZXJ2ZURlZXBcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIodCl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCksdGhpcy5feT10O3ZhciBlPXRoaXMuX3N0YXJ0O251bGwhPT1lJiYodGhpcy5fc3RhcnQ9bnVsbCxiKHQsZSkpO3ZhciBuPXRoaXMuX21hcDt0aGlzLl9tYXA9bmV3IE1hcDt2YXIgcj0hMCxpPSExLG89dm9pZCAwO3RyeXtmb3IodmFyIGEscz1uLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe2IodCxhLnZhbHVlKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX19fSx7a2V5OlwiX2djQ2hpbGRyZW5cIix2YWx1ZTpmdW5jdGlvbih0KXt3KHQsdGhpcy5fc3RhcnQpLHRoaXMuX3N0YXJ0PW51bGwsdGhpcy5fbWFwLmZvckVhY2goZnVuY3Rpb24oZSl7dyh0LGUpfSksdGhpcy5fbWFwPW5ldyBNYXB9fSx7a2V5OlwiX2djXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZ2NDaGlsZHJlbih0KSxCdChUeXBlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlLnByb3RvdHlwZSksXCJfZ2NcIix0aGlzKS5jYWxsKHRoaXMsdCl9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2b2lkIDAhPT1uJiZ0LmdjRW5hYmxlZHx8KG49ITE9PT10Ll9oYXNVbmRvTWFuYWdlciYmdC5nY0VuYWJsZWQpLEJ0KFR5cGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFR5cGUucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pLHQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcy5kZWxldGUodGhpcyk7dmFyIHI9ITAsaT0hMSxvPXZvaWQgMDt0cnl7Zm9yKHZhciBhLHM9dGhpcy5fbWFwLnZhbHVlcygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKHI9KGE9cy5uZXh0KCkpLmRvbmUpO3I9ITApe3ZhciBsPWEudmFsdWU7bCBpbnN0YW5jZW9mIEl0ZW0mJiFsLl9kZWxldGVkJiZsLl9kZWxldGUodCwhMSxuKX19Y2F0Y2godCl7aT0hMCxvPXR9ZmluYWxseXt0cnl7IXImJnMucmV0dXJuJiZzLnJldHVybigpfWZpbmFsbHl7aWYoaSl0aHJvdyBvfX1mb3IodmFyIHU9dGhpcy5fc3RhcnQ7bnVsbCE9PXU7KXUuX2RlbGV0ZWR8fHUuX2RlbGV0ZSh0LCExLG4pLHU9dS5fcmlnaHQ7biYmdGhpcy5fZ2NDaGlsZHJlbih0KX19XSksVHlwZX0oSXRlbSksSXRlbUpTT049ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbUpTT04oKXtFdCh0aGlzLEl0ZW1KU09OKTt2YXIgdD1BdCh0aGlzLChJdGVtSlNPTi5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTikpLmNhbGwodGhpcykpO3JldHVybiB0Ll9jb250ZW50PW51bGwsdH1yZXR1cm4gVHQoSXRlbUpTT04sdCksVXQoSXRlbUpTT04sW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9QnQoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQuX2NvbnRlbnQ9dGhpcy5fY29udGVudCx0fX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1CdChJdGVtSlNPTi5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04ucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSkscj1lLnJlYWRWYXJVaW50KCk7dGhpcy5fY29udGVudD1uZXcgQXJyYXkocik7Zm9yKHZhciBpPTA7aTxyO2krKyl7dmFyIG89ZS5yZWFkVmFyU3RyaW5nKCksYT12b2lkIDA7YT1cInVuZGVmaW5lZFwiPT09bz92b2lkIDA6SlNPTi5wYXJzZShvKSx0aGlzLl9jb250ZW50W2ldPWF9cmV0dXJuIG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCk7dmFyIGU9dGhpcy5fY29udGVudC5sZW5ndGg7dC53cml0ZVZhclVpbnQoZSk7Zm9yKHZhciBuPTA7bjxlO24rKyl7dmFyIHI9dm9pZCAwLGk9dGhpcy5fY29udGVudFtuXTtyPXZvaWQgMD09PWk/XCJ1bmRlZmluZWRcIjpKU09OLnN0cmluZ2lmeShpKSx0LndyaXRlVmFyU3RyaW5nKHIpfX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1KU09OXCIsdGhpcyxcImNvbnRlbnQ6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy5fY29udGVudCkpfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZigwPT09ZSlyZXR1cm4gdGhpcztpZihlPj10aGlzLl9sZW5ndGgpcmV0dXJuIHRoaXMuX3JpZ2h0O3ZhciBuPW5ldyBJdGVtSlNPTjtyZXR1cm4gbi5fY29udGVudD10aGlzLl9jb250ZW50LnNwbGljZShlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbUpTT059KEl0ZW0pLEl0ZW1TdHJpbmc9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gSXRlbVN0cmluZygpe0V0KHRoaXMsSXRlbVN0cmluZyk7dmFyIHQ9QXQodGhpcywoSXRlbVN0cmluZy5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nKSkuY2FsbCh0aGlzKSk7cmV0dXJuIHQuX2NvbnRlbnQ9bnVsbCx0fXJldHVybiBUdChJdGVtU3RyaW5nLHQpLFV0KEl0ZW1TdHJpbmcsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9QnQoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Ll9jb250ZW50PXRoaXMuX2NvbnRlbnQsdH19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49QnQoSXRlbVN0cmluZy5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZy5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5fY29udGVudD1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KEl0ZW1TdHJpbmcucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMuX2NvbnRlbnQpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbVN0cmluZ1wiLHRoaXMsJ2NvbnRlbnQ6XCInK3RoaXMuX2NvbnRlbnQrJ1wiJyl9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKDA9PT1lKXJldHVybiB0aGlzO2lmKGU+PXRoaXMuX2xlbmd0aClyZXR1cm4gdGhpcy5fcmlnaHQ7dmFyIG49bmV3IEl0ZW1TdHJpbmc7cmV0dXJuIG4uX2NvbnRlbnQ9dGhpcy5fY29udGVudC5zbGljZShlKSx0aGlzLl9jb250ZW50PXRoaXMuX2NvbnRlbnQuc2xpY2UoMCxlKSxrKHQsdGhpcyxuLGUpLG59fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aH19XSksSXRlbVN0cmluZ30oSXRlbSksWUV2ZW50PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gWUV2ZW50KHQpe0V0KHRoaXMsWUV2ZW50KSx0aGlzLnRhcmdldD10LHRoaXMuY3VycmVudFRhcmdldD10fXJldHVybiBVdChZRXZlbnQsW3trZXk6XCJwYXRoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY3VycmVudFRhcmdldC5nZXRQYXRoVG8odGhpcy50YXJnZXQpfX1dKSxZRXZlbnR9KCksWUFycmF5RXZlbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWUFycmF5RXZlbnQodCxlLG4pe0V0KHRoaXMsWUFycmF5RXZlbnQpO3ZhciByPUF0KHRoaXMsKFlBcnJheUV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheUV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5yZW1vdGU9ZSxyLl90cmFuc2FjdGlvbj1uLHIuX2FkZGVkRWxlbWVudHM9bnVsbCxyLl9yZW1vdmVkRWxlbWVudHM9bnVsbCxyfXJldHVybiBUdChZQXJyYXlFdmVudCx0KSxVdChZQXJyYXlFdmVudCxbe2tleTpcImFkZGVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fYWRkZWRFbGVtZW50cyl7dmFyIHQ9dGhpcy50YXJnZXQsZT10aGlzLl90cmFuc2FjdGlvbixuPW5ldyBTZXQ7ZS5uZXdUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHIpe3IuX3BhcmVudCE9PXR8fGUuZGVsZXRlZFN0cnVjdHMuaGFzKHIpfHxuLmFkZChyKX0pLHRoaXMuX2FkZGVkRWxlbWVudHM9bn1yZXR1cm4gdGhpcy5fYWRkZWRFbGVtZW50c319LHtrZXk6XCJyZW1vdmVkRWxlbWVudHNcIixnZXQ6ZnVuY3Rpb24oKXtpZihudWxsPT09dGhpcy5fcmVtb3ZlZEVsZW1lbnRzKXt2YXIgdD10aGlzLnRhcmdldCxlPXRoaXMuX3RyYW5zYWN0aW9uLG49bmV3IFNldDtlLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24ocil7ci5fcGFyZW50IT09dHx8ZS5uZXdUeXBlcy5oYXMocil8fG4uYWRkKHIpfSksdGhpcy5fcmVtb3ZlZEVsZW1lbnRzPW59cmV0dXJuIHRoaXMuX3JlbW92ZWRFbGVtZW50c319XSksWUFycmF5RXZlbnR9KFlFdmVudCksWUFycmF5PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlBcnJheSgpe3JldHVybiBFdCh0aGlzLFlBcnJheSksQXQodGhpcywoWUFycmF5Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlBcnJheSkpLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9cmV0dXJuIFR0KFlBcnJheSx0KSxVdChZQXJyYXksW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWUFycmF5RXZlbnQodGhpcyxuLHQpKX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KXtpZighZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlKXtpZih0PGUuX2xlbmd0aClyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PUl0ZW1KU09OfHxlLmNvbnN0cnVjdG9yPT09SXRlbVN0cmluZz9lLl9jb250ZW50W3RdOmU7dC09ZS5fbGVuZ3RofWU9ZS5fcmlnaHR9fX0se2tleTpcInRvQXJyYXlcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdH0pfX0se2tleTpcInRvSlNPTlwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0IGluc3RhbmNlb2YgVHlwZT9udWxsIT09dC50b0pTT04/dC50b0pTT04oKTp0LnRvU3RyaW5nKCk6dH0pfX0se2tleTpcIm1hcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1bXTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHIsaSl7bi5wdXNoKHQocixpLGUpKX0pLG59fSx7a2V5OlwiZm9yRWFjaFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wLG49dGhpcy5fc3RhcnQ7bnVsbCE9PW47KXtpZighbi5fZGVsZXRlZCYmbi5fY291bnRhYmxlKWlmKG4gaW5zdGFuY2VvZiBUeXBlKXQobixlKyssdGhpcyk7ZWxzZSBmb3IodmFyIHI9bi5fY29udGVudCxpPXIubGVuZ3RoLG89MDtvPGk7bysrKWUrKyx0KHJbb10sZSx0aGlzKTtuPW4uX3JpZ2h0fX19LHtrZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJue25leHQ6ZnVuY3Rpb24oKXtmb3IoO251bGwhPT10aGlzLl9pdGVtJiYodGhpcy5faXRlbS5fZGVsZXRlZHx8dGhpcy5faXRlbS5fbGVuZ3RoPD10aGlzLl9pdGVtRWxlbWVudCk7KXRoaXMuX2l0ZW09dGhpcy5faXRlbS5fcmlnaHQsdGhpcy5faXRlbUVsZW1lbnQ9MDtpZihudWxsPT09dGhpcy5faXRlbSlyZXR1cm57ZG9uZTohMH07dmFyIHQ9dm9pZCAwO3JldHVybiB0PXRoaXMuX2l0ZW0gaW5zdGFuY2VvZiBUeXBlP3RoaXMuX2l0ZW06dGhpcy5faXRlbS5fY29udGVudFt0aGlzLl9pdGVtRWxlbWVudCsrXSx7dmFsdWU6dCxkb25lOiExfX0sX2l0ZW06dGhpcy5fc3RhcnQsX2l0ZW1FbGVtZW50OjAsX2NvdW50OjB9fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06MTtpZih0aGlzLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7Zm9yKHZhciByPWUuX3N0YXJ0LGk9MDtudWxsIT09ciYmbj4wOyl7aWYoIXIuX2RlbGV0ZWQmJnIuX2NvdW50YWJsZSlpZihpPD10JiZ0PGkrci5fbGVuZ3RoKXt2YXIgbz10LWk7cj1yLl9zcGxpdEF0KGUuX3ksbyksci5fc3BsaXRBdChlLl95LG4pLG4tPXIuX2xlbmd0aCxyLl9kZWxldGUoZS5feSksaSs9b31lbHNlIGkrPXIuX2xlbmd0aDtyPXIuX3JpZ2h0fX0pLG4+MCl0aHJvdyBuZXcgRXJyb3IoXCJEZWxldGUgZXhjZWVkcyB0aGUgcmFuZ2Ugb2YgdGhlIFlBcnJheVwiKX19LHtrZXk6XCJpbnNlcnRBZnRlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcztyZXR1cm4gdGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24ocil7dmFyIGk9dm9pZCAwO2k9bnVsbD09PXQ/bi5fc3RhcnQ6dC5fcmlnaHQ7Zm9yKHZhciBvPW51bGwsYT0wO2E8ZS5sZW5ndGg7YSsrKXt2YXIgcz1lW2FdO1wiZnVuY3Rpb25cIj09dHlwZW9mIHMmJihzPW5ldyBzKSxzIGluc3RhbmNlb2YgVHlwZT8obnVsbCE9PW8mJihudWxsIT09ciYmby5faW50ZWdyYXRlKHIpLHQ9byxvPW51bGwpLHMuX29yaWdpbj10LHMuX2xlZnQ9dCxzLl9yaWdodD1pLHMuX3JpZ2h0X29yaWdpbj1pLHMuX3BhcmVudD1uLG51bGwhPT1yP3MuX2ludGVncmF0ZShyKTpudWxsPT09dD9uLl9zdGFydD1zOnQuX3JpZ2h0PXMsdD1zKToobnVsbD09PW8mJihvPW5ldyBJdGVtSlNPTixvLl9vcmlnaW49dCxvLl9sZWZ0PXQsby5fcmlnaHQ9aSxvLl9yaWdodF9vcmlnaW49aSxvLl9wYXJlbnQ9bixvLl9jb250ZW50PVtdKSxvLl9jb250ZW50LnB1c2gocykpfW51bGwhPT1vJiYobnVsbCE9PXI/by5faW50ZWdyYXRlKHIpOm51bGw9PT1vLl9sZWZ0JiYobi5fc3RhcnQ9bykpfSksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IodmFyIHI9bnVsbCxpPW4uX3N0YXJ0LG89MCxhPW4uX3k7bnVsbCE9PWk7KXt2YXIgcz1pLl9kZWxldGVkPzA6aS5fbGVuZ3RoLTE7aWYobzw9dCYmdDw9bytzKXt2YXIgbD10LW87aT1pLl9zcGxpdEF0KGEsbCkscj1pLl9sZWZ0LG8rPWw7YnJlYWt9aS5fZGVsZXRlZHx8KG8rPWkuX2xlbmd0aCkscj1pLGk9aS5fcmlnaHR9aWYodD5vKXRocm93IG5ldyBFcnJvcihcIkluZGV4IGV4Y2VlZHMgYXJyYXkgcmFuZ2UhXCIpO24uaW5zZXJ0QWZ0ZXIocixlKX0pfX0se2tleTpcInB1c2hcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5fc3RhcnQsbj1udWxsO251bGwhPT1lOyllLl9kZWxldGVkfHwobj1lKSxlPWUuX3JpZ2h0O3RoaXMuaW5zZXJ0QWZ0ZXIobix0KX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllBcnJheVwiLHRoaXMsXCJzdGFydDpcIitwKHRoaXMuX3N0YXJ0KSsnXCInKX19LHtrZXk6XCJsZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MCxlPXRoaXMuX3N0YXJ0O251bGwhPT1lOykhZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlJiYodCs9ZS5fbGVuZ3RoKSxlPWUuX3JpZ2h0O3JldHVybiB0fX1dKSxZQXJyYXl9KFR5cGUpLFlNYXBFdmVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZTWFwRXZlbnQodCxlLG4pe0V0KHRoaXMsWU1hcEV2ZW50KTt2YXIgcj1BdCh0aGlzLChZTWFwRXZlbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWU1hcEV2ZW50KSkuY2FsbCh0aGlzLHQpKTtyZXR1cm4gci5rZXlzQ2hhbmdlZD1lLHIucmVtb3RlPW4scn1yZXR1cm4gVHQoWU1hcEV2ZW50LHQpLFlNYXBFdmVudH0oWUV2ZW50KSxZTWFwPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlNYXAoKXtyZXR1cm4gRXQodGhpcyxZTWFwKSxBdCh0aGlzLChZTWFwLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlNYXApKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZTWFwLHQpLFV0KFlNYXAsW3trZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWU1hcEV2ZW50KHRoaXMsZSxuKSl9fSx7a2V5OlwidG9KU09OXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD17fSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07aWYoIWwuX2RlbGV0ZWQpe3ZhciB1PXZvaWQgMDt1PWwgaW5zdGFuY2VvZiBUeXBlP3ZvaWQgMCE9PWwudG9KU09OP2wudG9KU09OKCk6bC50b1N0cmluZygpOmwuX2NvbnRlbnRbMF0sdFtzXT11fX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJrZXlzXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXTthWzFdLl9kZWxldGVkfHx0LnB1c2gocyl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19cmV0dXJuIHR9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihuKXt2YXIgcj1lLl9tYXAuZ2V0KHQpO251bGwhPT1uJiZ2b2lkIDAhPT1yJiZyLl9kZWxldGUobil9KX19LHtrZXk6XCJzZXRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7cmV0dXJuIHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKHIpe3ZhciBpPW4uX21hcC5nZXQodCl8fG51bGw7aWYobnVsbCE9PWkpe2lmKGkuY29uc3RydWN0b3I9PT1JdGVtSlNPTiYmIWkuX2RlbGV0ZWQmJmkuX2NvbnRlbnRbMF09PT1lKXJldHVybiBlO251bGwhPT1yJiZpLl9kZWxldGUocil9dmFyIG89dm9pZCAwO1wiZnVuY3Rpb25cIj09dHlwZW9mIGU/KG89bmV3IGUsZT1vKTplIGluc3RhbmNlb2YgSXRlbT9vPWU6KG89bmV3IEl0ZW1KU09OLG8uX2NvbnRlbnQ9W2VdKSxvLl9yaWdodD1pLG8uX3JpZ2h0X29yaWdpbj1pLG8uX3BhcmVudD1uLG8uX3BhcmVudFN1Yj10LG51bGwhPT1yP28uX2ludGVncmF0ZShyKTpuLl9tYXAuc2V0KHQsbyl9KSxlfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX21hcC5nZXQodCk7aWYodm9pZCAwIT09ZSYmIWUuX2RlbGV0ZWQpcmV0dXJuIGUgaW5zdGFuY2VvZiBUeXBlP2U6ZS5fY29udGVudFtlLl9jb250ZW50Lmxlbmd0aC0xXX19LHtrZXk6XCJoYXNcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9tYXAuZ2V0KHQpO3JldHVybiB2b2lkIDAhPT1lJiYhZS5fZGVsZXRlZH19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllNYXBcIix0aGlzLFwibWFwU2l6ZTpcIit0aGlzLl9tYXAuc2l6ZSl9fV0pLFlNYXB9KFR5cGUpLEh0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtFdCh0aGlzLGUpO3ZhciB0PUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmVtYmVkPW51bGwsdH1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHIuZW1iZWQ9dGhpcy5lbWJlZCxyfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1CdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiB0aGlzLmVtYmVkPUpTT04ucGFyc2Uobi5yZWFkVmFyU3RyaW5nKCkpLHJ9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcoSlNPTi5zdHJpbmdpZnkodGhpcy5lbWJlZCkpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbUVtYmVkXCIsdGhpcyxcImVtYmVkOlwiK0pTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWQpKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fV0pLGV9KEl0ZW0pLEp0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtFdCh0aGlzLGUpO3ZhciB0PUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiB0LmtleT1udWxsLHQudmFsdWU9bnVsbCx0fXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9QnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gci5rZXk9dGhpcy5rZXksci52YWx1ZT10aGlzLnZhbHVlLHJ9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHRoaXMua2V5PW4ucmVhZFZhclN0cmluZygpLHRoaXMudmFsdWU9SlNPTi5wYXJzZShuLnJlYWRWYXJTdHJpbmcoKSkscn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmtleSksdC53cml0ZVZhclN0cmluZyhKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlKSl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtRm9ybWF0XCIsdGhpcyxcImtleTpcIitKU09OLnN0cmluZ2lmeSh0aGlzLmtleSkrXCIsdmFsdWU6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZSkpfX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gMX19LHtrZXk6XCJfY291bnRhYmxlXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuITF9fV0pLGV9KEl0ZW0pLHp0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuLHIpe0V0KHRoaXMsZSk7dmFyIGk9QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzLHQsbixyKSk7cmV0dXJuIGkuX2RlbHRhPW51bGwsaX1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVsdGFcIixnZXQ6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO2lmKG51bGw9PT10aGlzLl9kZWx0YSl7dmFyIGU9dGhpcy50YXJnZXQuX3k7ZS50cmFuc2FjdChmdW5jdGlvbigpe3ZhciBuPXQudGFyZ2V0Ll9zdGFydCxyPVtdLGk9dC5hZGRlZEVsZW1lbnRzLG89dC5yZW1vdmVkRWxlbWVudHM7dC5fZGVsdGE9cjtmb3IodmFyIGE9bnVsbCxzPXt9LGw9bmV3IE1hcCx1PW5ldyBNYXAsYz1cIlwiLGg9MCxmPTAsZD1mdW5jdGlvbigpe2lmKG51bGwhPT1hKXt2YXIgdD12b2lkIDA7c3dpdGNoKGEpe2Nhc2VcImRlbGV0ZVwiOnQ9e2RlbGV0ZTpmfSxmPTA7YnJlYWs7Y2FzZVwiaW5zZXJ0XCI6aWYodD17aW5zZXJ0OmN9LGwuc2l6ZT4wKXt0LmF0dHJpYnV0ZXM9e307dmFyIGU9ITAsbj0hMSxpPXZvaWQgMDt0cnl7Zm9yKHZhciBvLHU9bFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShvPXUubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgZD14dChvLnZhbHVlLDIpLF89ZFswXSx2PWRbMV07bnVsbCE9PXYmJih0LmF0dHJpYnV0ZXNbX109dil9fWNhdGNoKHQpe249ITAsaT10fWZpbmFsbHl7dHJ5eyFlJiZ1LnJldHVybiYmdS5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgaX19fWM9XCJcIjticmVhaztjYXNlXCJyZXRhaW5cIjppZih0PXtyZXRhaW46aH0sT2JqZWN0LmtleXMocykubGVuZ3RoPjApe3QuYXR0cmlidXRlcz17fTtmb3IodmFyIF8gaW4gcyl0LmF0dHJpYnV0ZXNbX109c1tfXX1oPTB9ci5wdXNoKHQpLGE9bnVsbH19O251bGwhPT1uOyl7c3dpdGNoKG4uY29uc3RydWN0b3Ipe2Nhc2UgSHQ6aS5oYXMobik/KGQoKSxhPVwiaW5zZXJ0XCIsYz1uLmVtYmVkLGQoKSk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9MSk6ITE9PT1uLl9kZWxldGVkJiYoXCJyZXRhaW5cIiE9PWEmJihkKCksYT1cInJldGFpblwiKSxoKz0xKTticmVhaztjYXNlIEl0ZW1TdHJpbmc6aS5oYXMobik/KFwiaW5zZXJ0XCIhPT1hJiYoZCgpLGE9XCJpbnNlcnRcIiksYys9bi5fY29udGVudCk6by5oYXMobik/KFwiZGVsZXRlXCIhPT1hJiYoZCgpLGE9XCJkZWxldGVcIiksZis9bi5fbGVuZ3RoKTohMT09PW4uX2RlbGV0ZWQmJihcInJldGFpblwiIT09YSYmKGQoKSxhPVwicmV0YWluXCIpLGgrPW4uX2xlbmd0aCk7YnJlYWs7Y2FzZSBKdDppZihpLmhhcyhuKSl7KGwuZ2V0KG4ua2V5KXx8bnVsbCkhPT1uLnZhbHVlPyhcInJldGFpblwiPT09YSYmZCgpLG4udmFsdWU9PT0odS5nZXQobi5rZXkpfHxudWxsKT9kZWxldGUgc1tuLmtleV06c1tuLmtleV09bi52YWx1ZSk6bi5fZGVsZXRlKGUpfWVsc2UgaWYoby5oYXMobikpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciBfPWwuZ2V0KG4ua2V5KXx8bnVsbDtfIT09bi52YWx1ZSYmKFwicmV0YWluXCI9PT1hJiZkKCksc1tuLmtleV09Xyl9ZWxzZSBpZighMT09PW4uX2RlbGV0ZWQpe3Uuc2V0KG4ua2V5LG4udmFsdWUpO3ZhciB2PXNbbi5rZXldO3ZvaWQgMCE9PXYmJih2IT09bi52YWx1ZT8oXCJyZXRhaW5cIj09PWEmJmQoKSxudWxsPT09bi52YWx1ZT9zW24ua2V5XT1uLnZhbHVlOmRlbGV0ZSBzW24ua2V5XSk6bi5fZGVsZXRlKGUpKX0hMT09PW4uX2RlbGV0ZWQmJihcImluc2VydFwiPT09YSYmZCgpLEIobCxuKSl9bj1uLl9yaWdodH1mb3IoZCgpO3QuX2RlbHRhLmxlbmd0aD4wOyl7dmFyIHA9dC5fZGVsdGFbdC5fZGVsdGEubGVuZ3RoLTFdO2lmKHZvaWQgMD09PXAucmV0YWlufHx2b2lkIDAhPT1wLmF0dHJpYnV0ZXMpYnJlYWs7dC5fZGVsdGEucG9wKCl9fSl9cmV0dXJuIHRoaXMuX2RlbHRhfX1dKSxlfShZQXJyYXlFdmVudCksWVRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVRleHQodCl7RXQodGhpcyxZVGV4dCk7dmFyIGU9QXQodGhpcywoWVRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVRleHQpKS5jYWxsKHRoaXMpKTtpZihcInN0cmluZ1wiPT10eXBlb2YgdCl7dmFyIG49bmV3IEl0ZW1TdHJpbmc7bi5fcGFyZW50PWUsbi5fY29udGVudD10LGUuX3N0YXJ0PW59cmV0dXJuIGV9cmV0dXJuIFR0KFlUZXh0LHQpLFV0KFlUZXh0LFt7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IHp0KHRoaXMsbix0KSl9fSx7a2V5OlwidG9TdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD1cIlwiLGU9dGhpcy5fc3RhcnQ7bnVsbCE9PWU7KSFlLl9kZWxldGVkJiZlLl9jb3VudGFibGUmJih0Kz1lLl9jb250ZW50KSxlPWUuX3JpZ2h0O3JldHVybiB0fX0se2tleTpcImFwcGx5RGVsdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKG4pe2Zvcih2YXIgcj1udWxsLGk9ZS5fc3RhcnQsbz1uZXcgTWFwLGE9MDthPHQubGVuZ3RoO2ErKyl7dmFyIHM9dFthXTtpZih2b2lkIDAhPT1zLmluc2VydCl7dmFyIGw9eChuLHMuaW5zZXJ0LGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksdT14dChsLDIpO3I9dVswXSxpPXVbMV19ZWxzZSBpZih2b2lkIDAhPT1zLnJldGFpbil7dmFyIGM9SShuLHMucmV0YWluLGUscixpLG8scy5hdHRyaWJ1dGVzfHx7fSksaD14dChjLDIpO3I9aFswXSxpPWhbMV19ZWxzZSBpZih2b2lkIDAhPT1zLmRlbGV0ZSl7dmFyIGY9RChuLHMuZGVsZXRlLGUscixpLG8pLGQ9eHQoZiwyKTtyPWRbMF0saT1kWzFdfX19KX19LHtrZXk6XCJ0b0RlbHRhXCIsdmFsdWU6ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7aWYoci5sZW5ndGg+MCl7dmFyIHQ9e30saT0hMSxvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PW5bU3ltYm9sLml0ZXJhdG9yXSgpOyEobz0obD11Lm5leHQoKSkuZG9uZSk7bz0hMCl7dmFyIGM9eHQobC52YWx1ZSwyKSxoPWNbMF0sZj1jWzFdO2k9ITAsdFtoXT1mfX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fXZhciBkPXtpbnNlcnQ6cn07aSYmKGQuYXR0cmlidXRlcz10KSxlLnB1c2goZCkscj1cIlwifX1mb3IodmFyIGU9W10sbj1uZXcgTWFwLHI9XCJcIixpPXRoaXMuX3N0YXJ0O251bGwhPT1pOyl7aWYoIWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgSXRlbVN0cmluZzpyKz1pLl9jb250ZW50O2JyZWFrO2Nhc2UgSnQ6dCgpLEIobixpKX1pPWkuX3JpZ2h0fXJldHVybiB0KCksZX19LHtrZXk6XCJpbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307ZS5sZW5ndGg8PTB8fHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKGkpe3ZhciBvPUUobix0KSxhPXh0KG8sMykscz1hWzBdLGw9YVsxXSx1PWFbMl07eChpLGUsbixzLGwsdSxyKX0pfX0se2tleTpcImluc2VydEVtYmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLHI9YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9O2lmKGUuY29uc3RydWN0b3IhPT1PYmplY3QpdGhyb3cgbmV3IEVycm9yKFwiRW1iZWQgbXVzdCBiZSBhbiBPYmplY3RcIik7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShuLHQpLGE9eHQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTt4KGksZSxuLHMsbCx1LHIpfSl9fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzOzAhPT1lJiZ0aGlzLl90cmFuc2FjdChmdW5jdGlvbihyKXt2YXIgaT1FKG4sdCksbz14dChpLDMpLGE9b1swXSxzPW9bMV0sbD1vWzJdO0QocixlLG4sYSxzLGwpfSl9fSx7a2V5OlwiZm9ybWF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3ZhciByPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24oaSl7dmFyIG89RShyLHQpLGE9eHQobywzKSxzPWFbMF0sbD1hWzFdLHU9YVsyXTtudWxsIT09bCYmSShpLGUscixzLGwsdSxuKX0pfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVRleHRcIix0aGlzKX19XSksWVRleHR9KFlBcnJheSksWVhtbEhvb2s9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEhvb2sodCl7RXQodGhpcyxZWG1sSG9vayk7dmFyIGU9QXQodGhpcywoWVhtbEhvb2suX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2spKS5jYWxsKHRoaXMpKTtyZXR1cm4gZS5ob29rTmFtZT1udWxsLHZvaWQgMCE9PXQmJihlLmhvb2tOYW1lPXQpLGV9cmV0dXJuIFR0KFlYbWxIb29rLHQpLFV0KFlYbWxIb29rLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PUJ0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Lmhvb2tOYW1lPXRoaXMuaG9va05hbWUsdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LGU9YXJndW1lbnRzWzJdLG49dFt0aGlzLmhvb2tOYW1lXSxyPXZvaWQgMDtyZXR1cm4gcj12b2lkIDAhPT1uP24uY3JlYXRlRG9tKHRoaXMpOmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGhpcy5ob29rTmFtZSksci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIsdGhpcy5ob29rTmFtZSksUihlLHIsdGhpcykscn19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49QnQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpO3JldHVybiB0aGlzLmhvb2tOYW1lPWUucmVhZFZhclN0cmluZygpLG59fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7QnQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLmhvb2tOYW1lKX19LHtrZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbD09PXRoaXMuaG9va05hbWUpdGhyb3cgbmV3IEVycm9yKFwiaG9va05hbWUgbXVzdCBiZSBkZWZpbmVkIVwiKTtCdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl9pbnRlZ3JhdGVcIix0aGlzKS5jYWxsKHRoaXMsdCl9fV0pLFlYbWxIb29rfShZTWFwKSxZdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtFdCh0aGlzLHQpLHRoaXMuX2ZpbHRlcj1ufHxmdW5jdGlvbigpe3JldHVybiEwfSx0aGlzLl9yb290PWUsdGhpcy5fY3VycmVudE5vZGU9ZSx0aGlzLl9maXJzdENhbGw9ITB9cmV0dXJuIFV0KHQsW3trZXk6U3ltYm9sLml0ZXJhdG9yLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9fSx7a2V5OlwibmV4dFwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5fY3VycmVudE5vZGU7aWYodGhpcy5fZmlyc3RDYWxsJiYodGhpcy5fZmlyc3RDYWxsPSExLCF0Ll9kZWxldGVkJiZ0aGlzLl9maWx0ZXIodCkpKXJldHVybnt2YWx1ZTp0LGRvbmU6ITF9O2Rve2lmKHQuX2RlbGV0ZWR8fHQuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQuX1lYbWxFbGVtZW50JiZ0LmNvbnN0cnVjdG9yIT09WVhtbEZyYWdtZW50fHxudWxsPT09dC5fc3RhcnQpe2Zvcig7dCE9PXRoaXMuX3Jvb3Q7KXtpZihudWxsIT09dC5fcmlnaHQpe3Q9dC5fcmlnaHQ7YnJlYWt9dD10Ll9wYXJlbnR9dD09PXRoaXMuX3Jvb3QmJih0PW51bGwpfWVsc2UgdD10Ll9zdGFydDtpZih0PT09dGhpcy5fcm9vdClicmVha313aGlsZShudWxsIT09dCYmKHQuX2RlbGV0ZWR8fCF0aGlzLl9maWx0ZXIodCkpKTtyZXR1cm4gdGhpcy5fY3VycmVudE5vZGU9dCxudWxsPT09dD97ZG9uZTohMH06e3ZhbHVlOnQsZG9uZTohMX19fV0pLHR9KCksWVhtbEV2ZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxFdmVudCh0LGUsbixyKXtFdCh0aGlzLFlYbWxFdmVudCk7dmFyIGk9QXQodGhpcywoWVhtbEV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFdmVudCkpLmNhbGwodGhpcyx0KSk7cmV0dXJuIGkuX3RyYW5zYWN0aW9uPXIsaS5jaGlsZExpc3RDaGFuZ2VkPSExLGkuYXR0cmlidXRlc0NoYW5nZWQ9bmV3IFNldCxpLnJlbW90ZT1uLGUuZm9yRWFjaChmdW5jdGlvbih0KXtudWxsPT09dD9pLmNoaWxkTGlzdENoYW5nZWQ9ITA6aS5hdHRyaWJ1dGVzQ2hhbmdlZC5hZGQodCl9KSxpfXJldHVybiBUdChZWG1sRXZlbnQsdCksWVhtbEV2ZW50fShZRXZlbnQpLFlYbWxGcmFnbWVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sRnJhZ21lbnQoKXtyZXR1cm4gRXQodGhpcyxZWG1sRnJhZ21lbnQpLEF0KHRoaXMsKFlYbWxGcmFnbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRnJhZ21lbnQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZWG1sRnJhZ21lbnQsdCksVXQoWVhtbEZyYWdtZW50LFt7a2V5OlwiY3JlYXRlVHJlZVdhbGtlclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBuZXcgWXQodGhpcyx0KX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yXCIsdmFsdWU6ZnVuY3Rpb24odCl7dD10LnRvVXBwZXJDYXNlKCk7dmFyIGU9bmV3IFl0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSksbj1lLm5leHQoKTtyZXR1cm4gbi5kb25lP251bGw6bi52YWx1ZX19LHtrZXk6XCJxdWVyeVNlbGVjdG9yQWxsXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHQ9dC50b1VwcGVyQ2FzZSgpLEFycmF5LmZyb20obmV3IFl0KHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGUubm9kZU5hbWU9PT10fSkpfX0se2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBZWG1sRXZlbnQodGhpcyxlLG4sdCkpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQudG9TdHJpbmcoKX0pLmpvaW4oXCJcIil9fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtCdChZWG1sRnJhZ21lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxGcmFnbWVudC5wcm90b3R5cGUpLFwiX2RlbGV0ZVwiLHRoaXMpLmNhbGwodGhpcyx0LGUsbil9fSx7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpkb2N1bWVudCxlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fSxuPWFyZ3VtZW50c1syXSxyPXQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO3JldHVybiBSKG4scix0aGlzKSx0aGlzLmZvckVhY2goZnVuY3Rpb24oaSl7ci5pbnNlcnRCZWZvcmUoaS50b0RvbSh0LGUsbiksbnVsbCl9KSxyfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiWVhtbFwiLHRoaXMpfX1dKSxZWG1sRnJhZ21lbnR9KFlBcnJheSksWVhtbEVsZW1lbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEVsZW1lbnQoKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06XCJVTkRFRklORURcIjtFdCh0aGlzLFlYbWxFbGVtZW50KTt2YXIgZT1BdCh0aGlzLChZWG1sRWxlbWVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudCkpLmNhbGwodGhpcykpO3JldHVybiBlLm5vZGVOYW1lPXQudG9VcHBlckNhc2UoKSxlfXJldHVybiBUdChZWG1sRWxlbWVudCx0KSxVdChZWG1sRWxlbWVudCxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1CdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5ub2RlTmFtZT10aGlzLm5vZGVOYW1lLHR9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPUJ0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5ub2RlTmFtZT1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0J0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5ub2RlTmFtZSl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGw9PT10aGlzLm5vZGVOYW1lKXRocm93IG5ldyBFcnJvcihcIm5vZGVOYW1lIG11c3QgYmUgZGVmaW5lZCFcIik7QnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfaW50ZWdyYXRlXCIsdGhpcykuY2FsbCh0aGlzLHQpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzLmdldEF0dHJpYnV0ZXMoKSxlPVtdLG49W107Zm9yKHZhciByIGluIHQpbi5wdXNoKHIpO24uc29ydCgpO2Zvcih2YXIgaT1uLmxlbmd0aCxvPTA7bzxpO28rKyl7dmFyIGE9bltvXTtlLnB1c2goYSsnPVwiJyt0W2FdKydcIicpfXZhciBzPXRoaXMubm9kZU5hbWUudG9Mb2NhbGVMb3dlckNhc2UoKTtyZXR1cm5cIjxcIitzKyhlLmxlbmd0aD4wP1wiIFwiK2Uuam9pbihcIiBcIik6XCJcIikrXCI+XCIrQnQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJ0b1N0cmluZ1wiLHRoaXMpLmNhbGwodGhpcykrXCI8L1wiK3MrXCI+XCJ9fSx7a2V5OlwicmVtb3ZlQXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIFlNYXAucHJvdG90eXBlLmRlbGV0ZS5jYWxsKHRoaXMsdCl9fSx7a2V5Olwic2V0QXR0cmlidXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtyZXR1cm4gWU1hcC5wcm90b3R5cGUuc2V0LmNhbGwodGhpcyx0LGUpfX0se2tleTpcImdldEF0dHJpYnV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBZTWFwLnByb3RvdHlwZS5nZXQuY2FsbCh0aGlzLHQpfX0se2tleTpcImdldEF0dHJpYnV0ZXNcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXt9LGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPXh0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTtsLl9kZWxldGVkfHwodFtzXT1sLl9jb250ZW50WzBdKX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX1yZXR1cm4gdH19LHtrZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOmRvY3VtZW50LGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9LG49YXJndW1lbnRzWzJdLHI9dC5jcmVhdGVFbGVtZW50KHRoaXMubm9kZU5hbWUpLGk9dGhpcy5nZXRBdHRyaWJ1dGVzKCk7Zm9yKHZhciBvIGluIGkpci5zZXRBdHRyaWJ1dGUobyxpW29dKTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe3IuYXBwZW5kQ2hpbGQoaS50b0RvbSh0LGUsbikpfSksUihuLHIsdGhpcykscn19XSksWVhtbEVsZW1lbnR9KFlYbWxGcmFnbWVudCk7WVhtbEZyYWdtZW50Ll9ZWG1sRWxlbWVudD1ZWG1sRWxlbWVudDt2YXIgWVhtbFRleHQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbFRleHQoKXtyZXR1cm4gRXQodGhpcyxZWG1sVGV4dCksQXQodGhpcywoWVhtbFRleHQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBUdChZWG1sVGV4dCx0KSxVdChZWG1sVGV4dCxbe2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06ZG9jdW1lbnQsZT1hcmd1bWVudHNbMl0sbj10LmNyZWF0ZVRleHROb2RlKHRoaXMudG9TdHJpbmcoKSk7cmV0dXJuIFIoZSxuLHRoaXMpLG59fSx7a2V5OlwiX2RlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtCdChZWG1sVGV4dC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbFRleHQucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pfX1dKSxZWG1sVGV4dH0oWVRleHQpLEZ0PW5ldyBNYXAsWHQ9bmV3IE1hcDtYKDAsSXRlbUpTT04pLFgoMSxJdGVtU3RyaW5nKSxYKDEwLEp0KSxYKDExLEh0KSxYKDIsRGVsZXRlKSxYKDMsWUFycmF5KSxYKDQsWU1hcCksWCg1LFlUZXh0KSxYKDYsWVhtbEZyYWdtZW50KSxYKDcsWVhtbEVsZW1lbnQpLFgoOCxZWG1sVGV4dCksWCg5LFlYbWxIb29rKSxYKDEyLEx0KTt2YXIgcXQ9MTY3NzcyMTUsJHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7RXQodGhpcyx0KSx0aGlzLnVzZXI9cXQsdGhpcy5uYW1lPWUsdGhpcy50eXBlPSQobil9cmV0dXJuIFV0KHQsW3trZXk6XCJlcXVhbHNcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQudXNlcj09PXRoaXMudXNlciYmdC5uYW1lPT09dGhpcy5uYW1lJiZ0LnR5cGU9PT10aGlzLnR5cGV9fSx7a2V5OlwibGVzc1RoYW5cIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5jb25zdHJ1Y3RvciE9PXR8fCh0aGlzLnVzZXI8ZS51c2VyfHx0aGlzLnVzZXI9PT1lLnVzZXImJih0aGlzLm5hbWU8ZS5uYW1lfHx0aGlzLm5hbWU9PT1lLm5hbWUmJnRoaXMudHlwZTxlLnR5cGUpKX19XSksdH0oKSxHdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQpe0V0KHRoaXMsZSk7dmFyIG49QXQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzKSk7cmV0dXJuIG4ueT10LG59cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcImxvZ1RhYmxlXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1bXTt0aGlzLml0ZXJhdGUobnVsbCxudWxsLGZ1bmN0aW9uKGUpe2UuY29uc3RydWN0b3I9PT1MdD90LnB1c2goe2lkOnAoZSksY29udGVudDplLl9sZW5ndGgsZGVsZXRlZDpcIkdDXCJ9KTp0LnB1c2goe2lkOnAoZSksb3JpZ2luOnAobnVsbD09PWUuX29yaWdpbj9udWxsOmUuX29yaWdpbi5fbGFzdElkKSxsZWZ0OnAobnVsbD09PWUuX2xlZnQ/bnVsbDplLl9sZWZ0Ll9sYXN0SWQpLHJpZ2h0OnAoZS5fcmlnaHQpLHJpZ2h0X29yaWdpbjpwKGUuX3JpZ2h0X29yaWdpbikscGFyZW50OnAoZS5fcGFyZW50KSxwYXJlbnRTdWI6ZS5fcGFyZW50U3ViLGRlbGV0ZWQ6ZS5fZGVsZXRlZCxjb250ZW50OkpTT04uc3RyaW5naWZ5KGUuX2NvbnRlbnQpfSl9KSxjb25zb2xlLnRhYmxlKHQpfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZCh0KTtpZihudWxsPT09ZSYmdCBpbnN0YW5jZW9mICR0KXt2YXIgbj1xKHQudHlwZSkscj10aGlzLnk7ZT1uZXcgbixlLl9pZD10LGUuX3BhcmVudD1yLHIudHJhbnNhY3QoZnVuY3Rpb24oKXtlLl9pbnRlZ3JhdGUocil9KSx0aGlzLnB1dChlKX1yZXR1cm4gZX19LHtrZXk6XCJnZXRJdGVtXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQodCk7aWYobnVsbD09PWUpcmV0dXJuIG51bGw7dmFyIG49ZS5faWQ7cmV0dXJuIHQudXNlcj09PW4udXNlciYmdC5jbG9jazxuLmNsb2NrK2UuX2xlbmd0aD9lOm51bGx9fSx7a2V5OlwiZ2V0SXRlbUNsZWFuU3RhcnRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2s9PT10LmNsb2NrP2U6ZS5fc3BsaXRBdCh0aGlzLnksdC5jbG9jay1uLmNsb2NrKX19LHtrZXk6XCJnZXRJdGVtQ2xlYW5FbmRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldEl0ZW0odCk7aWYobnVsbD09PWV8fDE9PT1lLl9sZW5ndGgpcmV0dXJuIGU7dmFyIG49ZS5faWQ7cmV0dXJuIG4uY2xvY2srZS5fbGVuZ3RoLTE9PT10LmNsb2NrP2U6KGUuX3NwbGl0QXQodGhpcy55LHQuY2xvY2stbi5jbG9jaysxKSxlKX19XSksZX0oRHQpLFp0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtFdCh0aGlzLHQpLFxudGhpcy55PWUsdGhpcy5zdGF0ZT1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwibG9nVGFibGVcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PVtdLGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy5zdGF0ZVtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT14dChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07dC5wdXNoKHt1c2VyOnMsc3RhdGU6bH0pfX1jYXRjaCh0KXtuPSEwLHI9dH1maW5hbGx5e3RyeXshZSYmby5yZXR1cm4mJm8ucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IHJ9fWNvbnNvbGUudGFibGUodCl9fSx7a2V5OlwiZ2V0TmV4dElEXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy55LnVzZXJJRCxuPXRoaXMuZ2V0U3RhdGUoZSk7cmV0dXJuIHRoaXMuc2V0U3RhdGUoZSxuK3QpLG5ldyBQdChlLG4pfX0se2tleTpcInVwZGF0ZVJlbW90ZVN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPXQuX2lkLnVzZXIsbj10aGlzLnN0YXRlLmdldChlKTtudWxsIT09dCYmdC5faWQuY2xvY2s9PT1uOyluKz10Ll9sZW5ndGgsdD10aGlzLnkub3MuZ2V0KG5ldyBQdChlLG4pKTt0aGlzLnN0YXRlLnNldChlLG4pfX0se2tleTpcImdldFN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5zdGF0ZS5nZXQodCk7cmV0dXJuIG51bGw9PWU/MDplfX0se2tleTpcInNldFN0YXRlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLnkuX3RyYW5zYWN0aW9uLmJlZm9yZVN0YXRlO24uaGFzKHQpfHxuLnNldCh0LHRoaXMuZ2V0U3RhdGUodCkpLHRoaXMuc3RhdGUuc2V0KHQsZSl9fV0pLHR9KCksUXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7RXQodGhpcyx0KSx0aGlzLl9ldmVudExpc3RlbmVyPW5ldyBNYXAsdGhpcy5fc3RhdGVMaXN0ZW5lcj1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwiX2dldExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7cmV0dXJuIHZvaWQgMD09PWUmJihlPXtvbmNlOm5ldyBTZXQsb246bmV3IFNldH0sdGhpcy5fZXZlbnRMaXN0ZW5lci5zZXQodCxlKSksZX19LHtrZXk6XCJvbmNlXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLl9nZXRMaXN0ZW5lcih0KS5vbmNlLmFkZChlKX19LHtrZXk6XCJvblwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5fZ2V0TGlzdGVuZXIodCkub24uYWRkKGUpfX0se2tleTpcIl9pbml0U3RhdGVMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX3N0YXRlTGlzdGVuZXIuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1lJiYoZT17fSxlLnByb21pc2U9bmV3IFByb21pc2UoZnVuY3Rpb24odCl7ZS5yZXNvbHZlPXR9KSx0aGlzLl9zdGF0ZUxpc3RlbmVyLnNldCh0LGUpKSxlfX0se2tleTpcIndoZW5cIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5faW5pdFN0YXRlTGlzdGVuZXIodCkucHJvbWlzZX19LHtrZXk6XCJvZmZcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2lmKG51bGw9PXR8fG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSBldmVudCBuYW1lIGFuZCBmdW5jdGlvbiFcIik7dmFyIG49dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09biYmKG4ub24uZGVsZXRlKGUpLG4ub25jZS5kZWxldGUoZSkpfX0se2tleTpcImVtaXRcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9YXJndW1lbnRzLmxlbmd0aCxuPUFycmF5KGU+MT9lLTE6MCkscj0xO3I8ZTtyKyspbltyLTFdPWFyZ3VtZW50c1tyXTt0aGlzLl9pbml0U3RhdGVMaXN0ZW5lcih0KS5yZXNvbHZlKCk7dmFyIGk9dGhpcy5fZXZlbnRMaXN0ZW5lci5nZXQodCk7dm9pZCAwIT09aT8oaS5vbi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiB0LmFwcGx5KG51bGwsbil9KSxpLm9uY2UuZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gdC5hcHBseShudWxsLG4pfSksaS5vbmNlPW5ldyBTZXQpOlwiZXJyb3JcIj09PXQmJmNvbnNvbGUuZXJyb3IoblswXSl9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fZXZlbnRMaXN0ZW5lcj1udWxsfX1dKSx0fSgpLEt0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe0V0KHRoaXMsdCksdGhpcy50eXBlPWUsdGhpcy50YXJnZXQ9bix0aGlzLl9tdXR1YWxFeGNsdWRlPUsoKX1yZXR1cm4gVXQodCxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZT1udWxsLHRoaXMudGFyZ2V0PW51bGx9fV0pLHR9KCksdGU9bnVsbCxlZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgZ2V0U2VsZWN0aW9uP3R0OmZ1bmN0aW9uKCl7cmV0dXJuIG51bGx9LG5lPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXt2YXIgcj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e307RXQodGhpcyxlKTt2YXIgaT1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7aS5vcHRzPXIsci5kb2N1bWVudD1yLmRvY3VtZW50fHxkb2N1bWVudCxyLmhvb2tzPXIuaG9va3N8fHt9LGkuc2Nyb2xsaW5nRWxlbWVudD1yLnNjcm9sbGluZ0VsZW1lbnR8fG51bGwsaS5kb21Ub1R5cGU9bmV3IE1hcCxpLnR5cGVUb0RvbT1uZXcgTWFwLGkuZmlsdGVyPXIuZmlsdGVyfHxqLG4uaW5uZXJIVE1MPVwiXCIsdC5mb3JFYWNoKGZ1bmN0aW9uKHQpe24uaW5zZXJ0QmVmb3JlKHQudG9Eb20oci5kb2N1bWVudCxyLmhvb2tzLGkpLG51bGwpfSksaS5fdHlwZU9ic2VydmVyPW90LmJpbmQoaSksaS5fZG9tT2JzZXJ2ZXI9ZnVuY3Rpb24odCl7bHQuY2FsbChpLHQsci5kb2N1bWVudCl9LHQub2JzZXJ2ZURlZXAoaS5fdHlwZU9ic2VydmVyKSxpLl9tdXRhdGlvbk9ic2VydmVyPW5ldyBNdXRhdGlvbk9ic2VydmVyKGkuX2RvbU9ic2VydmVyKSxpLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUobix7Y2hpbGRMaXN0OiEwLGF0dHJpYnV0ZXM6ITAsY2hhcmFjdGVyRGF0YTohMCxzdWJ0cmVlOiEwfSksaS5fY3VycmVudFNlbD1udWxsLGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJzZWxlY3Rpb25jaGFuZ2VcIixmdW5jdGlvbigpe2kuX2N1cnJlbnRTZWw9ZWUoaSl9KTt2YXIgbz10Ll95O3JldHVybiBpLnk9byxpLl9iZWZvcmVUcmFuc2FjdGlvbkhhbmRsZXI9ZnVuY3Rpb24odCxlLG4pe2kuX2RvbU9ic2VydmVyKGkuX211dGF0aW9uT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSksaS5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2V0KGksbil9KX0sby5vbihcImJlZm9yZVRyYW5zYWN0aW9uXCIsaS5fYmVmb3JlVHJhbnNhY3Rpb25IYW5kbGVyKSxpLl9hZnRlclRyYW5zYWN0aW9uSGFuZGxlcj1mdW5jdGlvbih0LGUsbil7aS5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe250KGksbil9KSxlLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9aS50eXBlVG9Eb20uZ2V0KHQpO3ZvaWQgMCE9PWUmJkMoaSxlLHQpfSl9LG8ub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsaS5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXIpLGkuX2JlZm9yZU9ic2VydmVyQ2FsbHNIYW5kbGVyPWZ1bmN0aW9uKHQsZSl7ZS5jaGFuZ2VkVHlwZXMuZm9yRWFjaChmdW5jdGlvbihlLG4peyhlLnNpemU+MXx8MT09PWUuc2l6ZSYmITE9PT1lLmhhcyhudWxsKSkmJlYodCxpLG4pfSksZS5uZXdUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKGUpe1YodCxpLGUpfSl9LG8ub24oXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsaS5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXIpLFIoaSxuLHQpLGl9cmV0dXJuIFR0KGUsdCksVXQoZSxbe2tleTpcInNldEZpbHRlclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZmlsdGVyPXR9fSx7a2V5OlwiX2dldFVuZG9TdGFja0luZm9cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmdldFNlbGVjdGlvbigpfX0se2tleTpcIl9yZXN0b3JlVW5kb1N0YWNrSW5mb1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMucmVzdG9yZVNlbGVjdGlvbih0KX19LHtrZXk6XCJnZXRTZWxlY3Rpb25cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9jdXJyZW50U2VsfX0se2tleTpcInJlc3RvcmVTZWxlY3Rpb25cIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsIT09dCl7dmFyIGU9dC50byxuPXQuZnJvbSxyPWdldFNlbGVjdGlvbigpLGk9ci5iYXNlTm9kZSxvPXIuYmFzZU9mZnNldCxhPXIuZXh0ZW50Tm9kZSxzPXIuZXh0ZW50T2Zmc2V0O2lmKG51bGwhPT1uKXt2YXIgbD1RKHRoaXMueSxuKTtpZihudWxsIT09bCl7dmFyIHU9dGhpcy50eXBlVG9Eb20uZ2V0KGwudHlwZSksYz1sLm9mZnNldDt1PT09aSYmYz09PW98fChpPXUsbz1jKX19aWYobnVsbCE9PWUpe3ZhciBoPVEodGhpcy55LGUpO2lmKG51bGwhPT1oKXt2YXIgZj10aGlzLnR5cGVUb0RvbS5nZXQoaC50eXBlKSxkPWgub2Zmc2V0O2Y9PT1hJiZkPT09c3x8KGE9ZixzPWQpfX1yLnNldEJhc2VBbmRFeHRlbnQoaSxvLGEscyl9fX0se2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuZG9tVG9UeXBlPW51bGwsdGhpcy50eXBlVG9Eb209bnVsbCx0aGlzLnR5cGUudW5vYnNlcnZlRGVlcCh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpO3ZhciB0PXRoaXMudHlwZS5feTt0Lm9mZihcImJlZm9yZVRyYW5zYWN0aW9uXCIsdGhpcy5fYmVmb3JlVHJhbnNhY3Rpb25IYW5kbGVyKSx0Lm9mZihcImJlZm9yZU9ic2VydmVyQ2FsbHNcIix0aGlzLl9iZWZvcmVPYnNlcnZlckNhbGxzSGFuZGxlciksdC5vZmYoXCJhZnRlclRyYW5zYWN0aW9uXCIsdGhpcy5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXIpLEJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShLdCksWT1mdW5jdGlvbih0KXtmdW5jdGlvbiBZKHQsZSxuKXt2YXIgcj1hcmd1bWVudHMubGVuZ3RoPjMmJnZvaWQgMCE9PWFyZ3VtZW50c1szXT9hcmd1bWVudHNbM106e307RXQodGhpcyxZKTt2YXIgaT1BdCh0aGlzLChZLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFkpKS5jYWxsKHRoaXMpKTtpLmdjRW5hYmxlZD1yLmdjfHwhMSxpLnJvb209dCxudWxsIT1lJiYoZS5jb25uZWN0b3Iucm9vbT10KSxpLl9jb250ZW50UmVhZHk9ITEsaS5fb3B0cz1lLFwibnVtYmVyXCIhPXR5cGVvZiBlLnVzZXJJRD9pLnVzZXJJRD1HKCk6aS51c2VySUQ9ZS51c2VySUQsaS5zaGFyZT17fSxpLmRzPW5ldyBOdChpKSxpLm9zPW5ldyBHdChpKSxpLnNzPW5ldyBadChpKSxpLl9taXNzaW5nU3RydWN0cz1uZXcgTWFwLGkuX3JlYWR5VG9JbnRlZ3JhdGU9W10saS5fdHJhbnNhY3Rpb249bnVsbCxpLmNvbm5lY3Rvcj1udWxsLGkuY29ubmVjdGVkPSExO3ZhciBvPWZ1bmN0aW9uKCl7bnVsbCE9ZSYmKGkuY29ubmVjdG9yPW5ldyBZW2UuY29ubmVjdG9yLm5hbWVdKGksZS5jb25uZWN0b3IpLGkuY29ubmVjdGVkPSEwLGkuZW1pdChcImNvbm5lY3RvclJlYWR5XCIpKX07cmV0dXJuIGkucGVyc2lzdGVuY2U9bnVsbCxudWxsIT1uPyhpLnBlcnNpc3RlbmNlPW4sbi5faW5pdChpKS50aGVuKG8pKTpvKCksaS5fcGFyZW50PW51bGwsaS5faGFzVW5kb01hbmFnZXI9ITEsaX1yZXR1cm4gVHQoWSx0KSxVdChZLFt7a2V5OlwiX3NldENvbnRlbnRSZWFkeVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fY29udGVudFJlYWR5fHwodGhpcy5fY29udGVudFJlYWR5PSEwLHRoaXMuZW1pdChcImNvbnRlbnRcIikpfX0se2tleTpcIndoZW5Db250ZW50UmVhZHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXM7cmV0dXJuIHRoaXMuX2NvbnRlbnRSZWFkeT9Qcm9taXNlLnJlc29sdmUoKTpuZXcgUHJvbWlzZShmdW5jdGlvbihlKXt0Lm9uY2UoXCJjb250ZW50XCIsZSl9KX19LHtrZXk6XCJfYmVmb3JlQ2hhbmdlXCIsdmFsdWU6ZnVuY3Rpb24oKXt9fSx7a2V5OlwidHJhbnNhY3RcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSYmYXJndW1lbnRzWzFdLG49bnVsbD09PXRoaXMuX3RyYW5zYWN0aW9uO24mJih0aGlzLl90cmFuc2FjdGlvbj1uZXcgUnQodGhpcyksdGhpcy5lbWl0KFwiYmVmb3JlVHJhbnNhY3Rpb25cIix0aGlzLHRoaXMuX3RyYW5zYWN0aW9uLGUpKTt0cnl7dCh0aGlzKX1jYXRjaCh0KXtjb25zb2xlLmVycm9yKHQpfWlmKG4pe3RoaXMuZW1pdChcImJlZm9yZU9ic2VydmVyQ2FsbHNcIix0aGlzLHRoaXMuX3RyYW5zYWN0aW9uLGUpO3ZhciByPXRoaXMuX3RyYW5zYWN0aW9uO3RoaXMuX3RyYW5zYWN0aW9uPW51bGwsci5jaGFuZ2VkVHlwZXMuZm9yRWFjaChmdW5jdGlvbih0LG4pe24uX2RlbGV0ZWR8fG4uX2NhbGxPYnNlcnZlcihyLHQsZSl9KSxyLmNoYW5nZWRQYXJlbnRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ZS5fZGVsZXRlZHx8KHQ9dC5maWx0ZXIoZnVuY3Rpb24odCl7cmV0dXJuIXQudGFyZ2V0Ll9kZWxldGVkfSksdC5mb3JFYWNoKGZ1bmN0aW9uKHQpe3QuY3VycmVudFRhcmdldD1lfSksZS5fZGVlcEV2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMocix0KSl9KSx0aGlzLmVtaXQoXCJhZnRlclRyYW5zYWN0aW9uXCIsdGhpcyxyLGUpfX19LHtrZXk6XCJkZWZpbmVcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPW5ldyAkdCh0LGUpLHI9dGhpcy5vcy5nZXQobik7aWYodm9pZCAwPT09dGhpcy5zaGFyZVt0XSl0aGlzLnNoYXJlW3RdPXI7ZWxzZSBpZih0aGlzLnNoYXJlW3RdIT09cil0aHJvdyBuZXcgRXJyb3IoXCJUeXBlIGlzIGFscmVhZHkgZGVmaW5lZCB3aXRoIGEgZGlmZmVyZW50IGNvbnN0cnVjdG9yXCIpO3JldHVybiByfX0se2tleTpcImdldFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLnNoYXJlW3RdfX0se2tleTpcImRpc2Nvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbm5lY3RlZD8odGhpcy5jb25uZWN0ZWQ9ITEsdGhpcy5jb25uZWN0b3IuZGlzY29ubmVjdCgpKTpQcm9taXNlLnJlc29sdmUoKX19LHtrZXk6XCJyZWNvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbm5lY3RlZD9Qcm9taXNlLnJlc29sdmUoKToodGhpcy5jb25uZWN0ZWQ9ITAsdGhpcy5jb25uZWN0b3IucmVjb25uZWN0KCkpfX0se2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe0J0KFkucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFkucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpLHRoaXMuc2hhcmU9bnVsbCxudWxsIT10aGlzLmNvbm5lY3RvciYmKG51bGwhPXRoaXMuY29ubmVjdG9yLmRlc3Ryb3k/dGhpcy5jb25uZWN0b3IuZGVzdHJveSgpOnRoaXMuY29ubmVjdG9yLmRpc2Nvbm5lY3QoKSksbnVsbCE9PXRoaXMucGVyc2lzdGVuY2UmJih0aGlzLnBlcnNpc3RlbmNlLmRlaW5pdCh0aGlzKSx0aGlzLnBlcnNpc3RlbmNlPW51bGwpLHRoaXMub3M9bnVsbCx0aGlzLmRzPW51bGwsdGhpcy5zcz1udWxsfX0se2tleTpcIl9zdGFydFwiLGdldDpmdW5jdGlvbigpe3JldHVybiBudWxsfSxzZXQ6ZnVuY3Rpb24odCl7cmV0dXJuIG51bGx9fV0pLFl9KFF0KTtZLmV4dGVuZD1mdW5jdGlvbigpe2Zvcih2YXIgdD0wO3Q8YXJndW1lbnRzLmxlbmd0aDt0Kyspe3ZhciBlPWFyZ3VtZW50c1t0XTtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBlKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGEgZnVuY3Rpb24hXCIpO2UoWSl9fTt2YXIgcmU9ZnVuY3Rpb24gdChlLG4scil7dmFyIGk9dGhpcztFdCh0aGlzLHQpLHRoaXMuY3JlYXRlZD1uZXcgRGF0ZTt2YXIgbz1uLmJlZm9yZVN0YXRlO28uaGFzKGUudXNlcklEKT8odGhpcy50b1N0YXRlPW5ldyBQdChlLnVzZXJJRCxlLnNzLmdldFN0YXRlKGUudXNlcklEKS0xKSx0aGlzLmZyb21TdGF0ZT1uZXcgUHQoZS51c2VySUQsby5nZXQoZS51c2VySUQpKSk6KHRoaXMudG9TdGF0ZT1udWxsLHRoaXMuZnJvbVN0YXRlPW51bGwpLHRoaXMuZGVsZXRlZFN0cnVjdHM9bmV3IFNldCxuLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2goZnVuY3Rpb24odCl7aS5kZWxldGVkU3RydWN0cy5hZGQoe2Zyb206dC5faWQsbGVuOnQuX2xlbmd0aH0pfSksdGhpcy5iaW5kaW5nSW5mb3M9cn0saWU9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe3ZhciBuPXRoaXMscj1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e307RXQodGhpcyx0KSx0aGlzLm9wdGlvbnM9cix0aGlzLl9iaW5kaW5ncz1uZXcgU2V0KHIuYmluZGluZ3MpLHIuY2FwdHVyZVRpbWVvdXQ9bnVsbD09ci5jYXB0dXJlVGltZW91dD81MDA6ci5jYXB0dXJlVGltZW91dCx0aGlzLl91bmRvQnVmZmVyPVtdLHRoaXMuX3JlZG9CdWZmZXI9W10sdGhpcy5fc2NvcGU9ZSx0aGlzLl91bmRvaW5nPSExLHRoaXMuX3JlZG9pbmc9ITEsdGhpcy5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMTt2YXIgaT1lLl95O3RoaXMueT1pLGkuX2hhc1VuZG9NYW5hZ2VyPSEwO3ZhciBvPXZvaWQgMDtpLm9uKFwiYmVmb3JlVHJhbnNhY3Rpb25cIixmdW5jdGlvbih0LGUscil7cnx8KG89bmV3IE1hcCxuLl9iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKHQpe28uc2V0KHQsdC5fZ2V0VW5kb1N0YWNrSW5mbygpKX0pKX0pLGkub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxpLGEpe2lmKCFhJiZpLmNoYW5nZWRQYXJlbnRUeXBlcy5oYXMoZSkpe3ZhciBzPW5ldyByZSh0LGksbyk7aWYobi5fdW5kb2luZyluLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSEwLG4uX3JlZG9CdWZmZXIucHVzaChzKTtlbHNle3ZhciBsPW4uX3VuZG9CdWZmZXIubGVuZ3RoPjA/bi5fdW5kb0J1ZmZlcltuLl91bmRvQnVmZmVyLmxlbmd0aC0xXTpudWxsOyExPT09bi5fcmVkb2luZyYmITE9PT1uLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvJiZudWxsIT09bCYmKHIuY2FwdHVyZVRpbWVvdXQ8MHx8cy5jcmVhdGVkLWwuY3JlYXRlZDw9ci5jYXB0dXJlVGltZW91dCk/KGwuY3JlYXRlZD1zLmNyZWF0ZWQsbnVsbCE9PXMudG9TdGF0ZSYmKGwudG9TdGF0ZT1zLnRvU3RhdGUsbnVsbD09PWwuZnJvbVN0YXRlJiYobC5mcm9tU3RhdGU9cy5mcm9tU3RhdGUpKSxzLmRlbGV0ZWRTdHJ1Y3RzLmZvckVhY2gobC5kZWxldGVkU3RydWN0cy5hZGQsbC5kZWxldGVkU3RydWN0cykpOihuLl9sYXN0VHJhbnNhY3Rpb25XYXNVbmRvPSExLG4uX3VuZG9CdWZmZXIucHVzaChzKSksbi5fcmVkb2luZ3x8KG4uX3JlZG9CdWZmZXI9W10pfX19KX1yZXR1cm4gVXQodCxbe2tleTpcImZsdXNoQ2hhbmdlc1wiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMH19LHtrZXk6XCJ1bmRvXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl91bmRvaW5nPSEwO3ZhciB0PXV0KHRoaXMueSx0aGlzLl9zY29wZSx0aGlzLl91bmRvQnVmZmVyKTtyZXR1cm4gdGhpcy5fdW5kb2luZz0hMSx0fX0se2tleTpcInJlZG9cIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX3JlZG9pbmc9ITA7dmFyIHQ9dXQodGhpcy55LHRoaXMuX3Njb3BlLHRoaXMuX3JlZG9CdWZmZXIpO3JldHVybiB0aGlzLl9yZWRvaW5nPSExLHR9fV0pLHR9KCksb2U9MWUzLGFlPTYwKm9lLHNlPTYwKmFlLGxlPTI0KnNlLHVlPTM2NS4yNSpsZSxjZT1mdW5jdGlvbih0LGUpe2U9ZXx8e307dmFyIG49dm9pZCAwPT09dD9cInVuZGVmaW5lZFwiOk90KHQpO2lmKFwic3RyaW5nXCI9PT1uJiZ0Lmxlbmd0aD4wKXJldHVybiBodCh0KTtpZihcIm51bWJlclwiPT09biYmITE9PT1pc05hTih0KSlyZXR1cm4gZS5sb25nP2R0KHQpOmZ0KHQpO3Rocm93IG5ldyBFcnJvcihcInZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgdmFsaWQgbnVtYmVyLiB2YWw9XCIrSlNPTi5zdHJpbmdpZnkodCkpfSxoZT1PYmplY3QuZnJlZXplKHtkZWZhdWx0OmNlLF9fbW9kdWxlRXhwb3J0czpjZX0pLGZlPWhlJiZjZXx8aGUsZGU9Y3QoZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKHQpe3ZhciBuLHI9MDtmb3IobiBpbiB0KXI9KHI8PDUpLXIrdC5jaGFyQ29kZUF0KG4pLHJ8PTA7cmV0dXJuIGUuY29sb3JzW01hdGguYWJzKHIpJWUuY29sb3JzLmxlbmd0aF19ZnVuY3Rpb24gcih0KXtmdW5jdGlvbiByKCl7aWYoci5lbmFibGVkKXt2YXIgdD1yLG49K25ldyBEYXRlLGk9bi0obHx8bik7dC5kaWZmPWksdC5wcmV2PWwsdC5jdXJyPW4sbD1uO2Zvcih2YXIgbz1uZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCksYT0wO2E8by5sZW5ndGg7YSsrKW9bYV09YXJndW1lbnRzW2FdO29bMF09ZS5jb2VyY2Uob1swXSksXCJzdHJpbmdcIiE9dHlwZW9mIG9bMF0mJm8udW5zaGlmdChcIiVPXCIpO3ZhciBzPTA7b1swXT1vWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLGZ1bmN0aW9uKG4scil7aWYoXCIlJVwiPT09bilyZXR1cm4gbjtzKys7dmFyIGk9ZS5mb3JtYXR0ZXJzW3JdO2lmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGkpe3ZhciBhPW9bc107bj1pLmNhbGwodCxhKSxvLnNwbGljZShzLDEpLHMtLX1yZXR1cm4gbn0pLGUuZm9ybWF0QXJncy5jYWxsKHQsbyk7KHIubG9nfHxlLmxvZ3x8Y29uc29sZS5sb2cuYmluZChjb25zb2xlKSkuYXBwbHkodCxvKX19cmV0dXJuIHIubmFtZXNwYWNlPXQsci5lbmFibGVkPWUuZW5hYmxlZCh0KSxyLnVzZUNvbG9ycz1lLnVzZUNvbG9ycygpLHIuY29sb3I9bih0KSxcImZ1bmN0aW9uXCI9PXR5cGVvZiBlLmluaXQmJmUuaW5pdChyKSxyfWZ1bmN0aW9uIGkodCl7ZS5zYXZlKHQpLGUubmFtZXM9W10sZS5za2lwcz1bXTtmb3IodmFyIG49KFwic3RyaW5nXCI9PXR5cGVvZiB0P3Q6XCJcIikuc3BsaXQoL1tcXHMsXSsvKSxyPW4ubGVuZ3RoLGk9MDtpPHI7aSsrKW5baV0mJih0PW5baV0ucmVwbGFjZSgvXFwqL2csXCIuKj9cIiksXCItXCI9PT10WzBdP2Uuc2tpcHMucHVzaChuZXcgUmVnRXhwKFwiXlwiK3Quc3Vic3RyKDEpK1wiJFwiKSk6ZS5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoXCJeXCIrdCtcIiRcIikpKX1mdW5jdGlvbiBvKCl7ZS5lbmFibGUoXCJcIil9ZnVuY3Rpb24gYSh0KXt2YXIgbixyO2ZvcihuPTAscj1lLnNraXBzLmxlbmd0aDtuPHI7bisrKWlmKGUuc2tpcHNbbl0udGVzdCh0KSlyZXR1cm4hMTtmb3Iobj0wLHI9ZS5uYW1lcy5sZW5ndGg7bjxyO24rKylpZihlLm5hbWVzW25dLnRlc3QodCkpcmV0dXJuITA7cmV0dXJuITF9ZnVuY3Rpb24gcyh0KXtyZXR1cm4gdCBpbnN0YW5jZW9mIEVycm9yP3Quc3RhY2t8fHQubWVzc2FnZTp0fWU9dC5leHBvcnRzPXIuZGVidWc9ci5kZWZhdWx0PXIsZS5jb2VyY2U9cyxlLmRpc2FibGU9byxlLmVuYWJsZT1pLGUuZW5hYmxlZD1hLGUuaHVtYW5pemU9ZmUsZS5uYW1lcz1bXSxlLnNraXBzPVtdLGUuZm9ybWF0dGVycz17fTt2YXIgbH0pLF9lPWRlLmNvZXJjZSx2ZT1kZS5kaXNhYmxlLHBlPWRlLmVuYWJsZSx5ZT1kZS5lbmFibGVkLGdlPWRlLmh1bWFuaXplLG1lPWRlLm5hbWVzLGtlPWRlLnNraXBzLGJlPWRlLmZvcm1hdHRlcnMsd2U9T2JqZWN0LmZyZWV6ZSh7ZGVmYXVsdDpkZSxfX21vZHVsZUV4cG9ydHM6ZGUsY29lcmNlOl9lLGRpc2FibGU6dmUsZW5hYmxlOnBlLGVuYWJsZWQ6eWUsaHVtYW5pemU6Z2UsbmFtZXM6bWUsc2tpcHM6a2UsZm9ybWF0dGVyczpiZX0pLFNlPXdlJiZkZXx8d2UsT2U9Y3QoZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7cmV0dXJuIShcInVuZGVmaW5lZFwiPT10eXBlb2Ygd2luZG93fHwhd2luZG93LnByb2Nlc3N8fFwicmVuZGVyZXJcIiE9PXdpbmRvdy5wcm9jZXNzLnR5cGUpfHwoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGRvY3VtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2V8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3cmJndpbmRvdy5jb25zb2xlJiYod2luZG93LmNvbnNvbGUuZmlyZWJ1Z3x8d2luZG93LmNvbnNvbGUuZXhjZXB0aW9uJiZ3aW5kb3cuY29uc29sZS50YWJsZSl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQmJm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pJiZwYXJzZUludChSZWdFeHAuJDEsMTApPj0zMXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmbmF2aWdhdG9yLnVzZXJBZ2VudCYmbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKX1mdW5jdGlvbiByKHQpe3ZhciBuPXRoaXMudXNlQ29sb3JzO2lmKHRbMF09KG4/XCIlY1wiOlwiXCIpK3RoaXMubmFtZXNwYWNlKyhuP1wiICVjXCI6XCIgXCIpK3RbMF0rKG4/XCIlYyBcIjpcIiBcIikrXCIrXCIrZS5odW1hbml6ZSh0aGlzLmRpZmYpLG4pe3ZhciByPVwiY29sb3I6IFwiK3RoaXMuY29sb3I7dC5zcGxpY2UoMSwwLHIsXCJjb2xvcjogaW5oZXJpdFwiKTt2YXIgaT0wLG89MDt0WzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZyxmdW5jdGlvbih0KXtcIiUlXCIhPT10JiYoaSsrLFwiJWNcIj09PXQmJihvPWkpKX0pLHQuc3BsaWNlKG8sMCxyKX19ZnVuY3Rpb24gaSgpe3JldHVyblwib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIGNvbnNvbGU/XCJ1bmRlZmluZWRcIjpPdChjb25zb2xlKSkmJmNvbnNvbGUubG9nJiZGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZyxjb25zb2xlLGFyZ3VtZW50cyl9ZnVuY3Rpb24gbyh0KXt0cnl7bnVsbD09dD9lLnN0b3JhZ2UucmVtb3ZlSXRlbShcImRlYnVnXCIpOmUuc3RvcmFnZS5kZWJ1Zz10fWNhdGNoKHQpe319ZnVuY3Rpb24gYSgpe3ZhciB0O3RyeXt0PWUuc3RvcmFnZS5kZWJ1Z31jYXRjaCh0KXt9cmV0dXJuIXQmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBwcm9jZXNzJiZcImVudlwiaW4gcHJvY2VzcyYmKHQ9cHJvY2Vzcy5lbnYuREVCVUcpLHR9ZT10LmV4cG9ydHM9U2UsZS5sb2c9aSxlLmZvcm1hdEFyZ3M9cixlLnNhdmU9byxlLmxvYWQ9YSxlLnVzZUNvbG9ycz1uLGUuc3RvcmFnZT1cInVuZGVmaW5lZFwiIT10eXBlb2YgY2hyb21lJiZ2b2lkIDAhPT1jaHJvbWUuc3RvcmFnZT9jaHJvbWUuc3RvcmFnZS5sb2NhbDpmdW5jdGlvbigpe3RyeXtyZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZX1jYXRjaCh0KXt9fSgpLGUuY29sb3JzPVtcImxpZ2h0c2VhZ3JlZW5cIixcImZvcmVzdGdyZWVuXCIsXCJnb2xkZW5yb2RcIixcImRvZGdlcmJsdWVcIixcImRhcmtvcmNoaWRcIixcImNyaW1zb25cIl0sZS5mb3JtYXR0ZXJzLmo9ZnVuY3Rpb24odCl7dHJ5e3JldHVybiBKU09OLnN0cmluZ2lmeSh0KX1jYXRjaCh0KXtyZXR1cm5cIltVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiBcIit0Lm1lc3NhZ2V9fSxlLmVuYWJsZShhKCkpfSksRWU9KE9lLmxvZyxPZS5mb3JtYXRBcmdzLE9lLnNhdmUsT2UubG9hZCxPZS51c2VDb2xvcnMsT2Uuc3RvcmFnZSxPZS5jb2xvcnMsZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7aWYoRXQodGhpcyx0KSx0aGlzLnk9ZSx0aGlzLm9wdHM9bixudWxsPT1uLnJvbGV8fFwibWFzdGVyXCI9PT1uLnJvbGUpdGhpcy5yb2xlPVwibWFzdGVyXCI7ZWxzZXtpZihcInNsYXZlXCIhPT1uLnJvbGUpdGhyb3cgbmV3IEVycm9yKFwiUm9sZSBtdXN0IGJlIGVpdGhlciAnbWFzdGVyJyBvciAnc2xhdmUnIVwiKTt0aGlzLnJvbGU9XCJzbGF2ZVwifXRoaXMubG9nPU9lKFwieTpjb25uZWN0b3JcIiksdGhpcy5sb2dNZXNzYWdlPU9lKFwieTpjb25uZWN0b3ItbWVzc2FnZVwiKSx0aGlzLl9mb3J3YXJkQXBwbGllZFN0cnVjdHM9bi5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnN8fCExLHRoaXMucm9sZT1uLnJvbGUsdGhpcy5jb25uZWN0aW9ucz1uZXcgTWFwLHRoaXMuaXNTeW5jZWQ9ITEsdGhpcy51c2VyRXZlbnRMaXN0ZW5lcnM9W10sdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLHRoaXMuY3VycmVudFN5bmNUYXJnZXQ9bnVsbCx0aGlzLmRlYnVnPSEwPT09bi5kZWJ1Zyx0aGlzLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgQ3QsdGhpcy5icm9hZGNhc3RCdWZmZXJTaXplPTAsdGhpcy5wcm90b2NvbFZlcnNpb249MTEsdGhpcy5hdXRoSW5mbz1uLmF1dGh8fG51bGwsdGhpcy5jaGVja0F1dGg9bi5jaGVja0F1dGh8fGZ1bmN0aW9uKCl7cmV0dXJuIFByb21pc2UucmVzb2x2ZShcIndyaXRlXCIpfSxudWxsPT1uLm1heEJ1ZmZlckxlbmd0aD90aGlzLm1heEJ1ZmZlckxlbmd0aD0tMTp0aGlzLm1heEJ1ZmZlckxlbmd0aD1uLm1heEJ1ZmZlckxlbmd0aH1yZXR1cm4gVXQodCxbe2tleTpcInJlY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5sb2coXCJyZWNvbm5lY3RpbmcuLlwiKX19LHtrZXk6XCJkaXNjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5sb2coXCJkaXNjcm9ubmVjdGluZy4uXCIpLHRoaXMuY29ubmVjdGlvbnM9bmV3IE1hcCx0aGlzLmlzU3luY2VkPSExLHRoaXMuY3VycmVudFN5bmNUYXJnZXQ9bnVsbCx0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnM9W10sUHJvbWlzZS5yZXNvbHZlKCl9fSx7a2V5Olwib25Vc2VyRXZlbnRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnVzZXJFdmVudExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcInJlbW92ZVVzZXJFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnM9dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uKGUpe3JldHVybiB0IT09ZX0pfX0se2tleTpcInVzZXJMZWZ0XCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYodGhpcy5jb25uZWN0aW9ucy5oYXModCkpe3RoaXMubG9nKFwiJXM6IFVzZXIgbGVmdCAlc1wiLHRoaXMueS51c2VySUQsdCksdGhpcy5jb25uZWN0aW9ucy5kZWxldGUodCksdGhpcy5fc2V0U3luY2VkV2l0aChudWxsKTt2YXIgZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLnVzZXJFdmVudExpc3RlbmVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXsoMCxpLnZhbHVlKSh7YWN0aW9uOlwidXNlckxlZnRcIix1c2VyOnR9KX19Y2F0Y2godCl7bj0hMCxyPXR9ZmluYWxseXt0cnl7IWUmJm8ucmV0dXJuJiZvLnJldHVybigpfWZpbmFsbHl7aWYobil0aHJvdyByfX19fX0se2tleTpcInVzZXJKb2luZWRcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7aWYobnVsbD09ZSl0aHJvdyBuZXcgRXJyb3IoXCJZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciFcIik7aWYodGhpcy5jb25uZWN0aW9ucy5oYXModCkpdGhyb3cgbmV3IEVycm9yKFwiVGhpcyB1c2VyIGFscmVhZHkgam9pbmVkIVwiKTt0aGlzLmxvZyhcIiVzOiBVc2VyIGpvaW5lZCAlc1wiLHRoaXMueS51c2VySUQsdCksdGhpcy5jb25uZWN0aW9ucy5zZXQodCx7dWlkOnQsaXNTeW5jZWQ6ITEscm9sZTplLHByb2Nlc3NBZnRlckF1dGg6W10scHJvY2Vzc0FmdGVyU3luYzpbXSxhdXRoOm58fG51bGwscmVjZWl2ZWRTeW5jU3RlcDI6ITF9KTt2YXIgcj17fTtyLnByb21pc2U9bmV3IFByb21pc2UoZnVuY3Rpb24odCl7ci5yZXNvbHZlPXR9KSx0aGlzLmNvbm5lY3Rpb25zLmdldCh0KS5zeW5jU3RlcDI9cjt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD10aGlzLnVzZXJFdmVudExpc3RlbmVyc1tTeW1ib2wuaXRlcmF0b3JdKCk7IShpPShzPWwubmV4dCgpKS5kb25lKTtpPSEwKXsoMCxzLnZhbHVlKSh7YWN0aW9uOlwidXNlckpvaW5lZFwiLHVzZXI6dCxyb2xlOmV9KX19Y2F0Y2godCl7bz0hMCxhPXR9ZmluYWxseXt0cnl7IWkmJmwucmV0dXJuJiZsLnJldHVybigpfWZpbmFsbHl7aWYobyl0aHJvdyBhfX10aGlzLl9zeW5jV2l0aFVzZXIodCl9fSx7a2V5Olwid2hlblN5bmNlZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuaXNTeW5jZWQ/dCgpOnRoaXMud2hlblN5bmNlZExpc3RlbmVycy5wdXNoKHQpfX0se2tleTpcIl9zeW5jV2l0aFVzZXJcIix2YWx1ZTpmdW5jdGlvbih0KXtcInNsYXZlXCIhPT10aGlzLnJvbGUmJnUodGhpcyx0KX19LHtrZXk6XCJfZmlyZUlzU3luY2VkTGlzdGVuZXJzXCIsdmFsdWU6ZnVuY3Rpb24oKXtpZighdGhpcy5pc1N5bmNlZCl7dGhpcy5pc1N5bmNlZD0hMDt2YXIgdD0hMCxlPSExLG49dm9pZCAwO3RyeXtmb3IodmFyIHIsaT10aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEodD0ocj1pLm5leHQoKSkuZG9uZSk7dD0hMCl7KDAsci52YWx1ZSkoKX19Y2F0Y2godCl7ZT0hMCxuPXR9ZmluYWxseXt0cnl7IXQmJmkucmV0dXJuJiZpLnJldHVybigpfWZpbmFsbHl7aWYoZSl0aHJvdyBufX10aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnM9W10sdGhpcy55Ll9zZXRDb250ZW50UmVhZHkoKSx0aGlzLnkuZW1pdChcInN5bmNlZFwiKX19fSx7a2V5Olwic2VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55O2lmKCEoZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyfHxlIGluc3RhbmNlb2YgVWludDhBcnJheSkpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IC0gZG9uJ3QgdXNlIHRoaXMgbWV0aG9kIHRvIHNlbmQgY3VzdG9tIG1lc3NhZ2VzXCIpO3RoaXMubG9nKFwiVXNlciVzIHRvIFVzZXIlczogU2VuZCAnJXknXCIsbi51c2VySUQsdCxlKSx0aGlzLmxvZ01lc3NhZ2UoXCJVc2VyJXMgdG8gVXNlciVzOiBTZW5kICVZXCIsbi51c2VySUQsdCxbbixlXSl9fSx7a2V5OlwiYnJvYWRjYXN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy55O2lmKCEodCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyfHx0IGluc3RhbmNlb2YgVWludDhBcnJheSkpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IC0gZG9uJ3QgdXNlIHRoaXMgbWV0aG9kIHRvIHNlbmQgY3VzdG9tIG1lc3NhZ2VzXCIpO3RoaXMubG9nKFwiVXNlciVzOiBCcm9hZGNhc3QgJyV5J1wiLGUudXNlcklELHQpLHRoaXMubG9nTWVzc2FnZShcIlVzZXIlczogQnJvYWRjYXN0OiAlWVwiLGUudXNlcklELFtlLHRdKX19LHtrZXk6XCJicm9hZGNhc3RTdHJ1Y3RcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49MD09PXRoaXMuYnJvYWRjYXN0QnVmZmVyLmxlbmd0aDtpZihuJiYodGhpcy5icm9hZGNhc3RCdWZmZXIud3JpdGVWYXJTdHJpbmcodGhpcy55LnJvb20pLHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVmFyU3RyaW5nKFwidXBkYXRlXCIpLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZT0wLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcz10aGlzLmJyb2FkY2FzdEJ1ZmZlci5wb3MsdGhpcy5icm9hZGNhc3RCdWZmZXIud3JpdGVVaW50MzIoMCkpLHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZSsrLHQuX3RvQmluYXJ5KHRoaXMuYnJvYWRjYXN0QnVmZmVyKSx0aGlzLm1heEJ1ZmZlckxlbmd0aD4wJiZ0aGlzLmJyb2FkY2FzdEJ1ZmZlci5sZW5ndGg+dGhpcy5tYXhCdWZmZXJMZW5ndGgpe3ZhciByPXRoaXMuYnJvYWRjYXN0QnVmZmVyO3Iuc2V0VWludDMyKHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcyx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemUpLHRoaXMuYnJvYWRjYXN0QnVmZmVyPW5ldyBDdCx0aGlzLndoZW5SZW1vdGVSZXNwb25zaXZlKCkudGhlbihmdW5jdGlvbigpe2UuYnJvYWRjYXN0KHIuY3JlYXRlQnVmZmVyKCkpfSl9ZWxzZSBuJiZzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7aWYoZS5icm9hZGNhc3RCdWZmZXIubGVuZ3RoPjApe3ZhciB0PWUuYnJvYWRjYXN0QnVmZmVyO3Quc2V0VWludDMyKGUuYnJvYWRjYXN0QnVmZmVyU2l6ZVBvcyxlLmJyb2FkY2FzdEJ1ZmZlclNpemUpLGUuYnJvYWRjYXN0KHQuY3JlYXRlQnVmZmVyKCkpLGUuYnJvYWRjYXN0QnVmZmVyPW5ldyBDdH19LDApfX0se2tleTpcIndoZW5SZW1vdGVSZXNwb25zaXZlXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24odCl7c2V0VGltZW91dCh0LDEwMCl9KX19LHtrZXk6XCJyZWNlaXZlTWVzc2FnZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgcj10aGlzLGk9dGhpcy55LG89aS51c2VySUQ7aWYobj1ufHwhMSwhKGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoXCJFeHBlY3RlZCBNZXNzYWdlIHRvIGJlIGFuIEFycmF5QnVmZmVyIG9yIFVpbnQ4QXJyYXkhXCIpKTtpZih0PT09bylyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7dmFyIGE9bmV3IFZ0KGUpLHM9bmV3IEN0LGw9YS5yZWFkVmFyU3RyaW5nKCk7cy53cml0ZVZhclN0cmluZyhsKTt2YXIgdT1hLnJlYWRWYXJTdHJpbmcoKSxjPXRoaXMuY29ubmVjdGlvbnMuZ2V0KHQpO2lmKHRoaXMubG9nKFwiVXNlciVzIGZyb20gVXNlciVzOiBSZWNlaXZlICclcydcIixvLHQsdSksdGhpcy5sb2dNZXNzYWdlKFwiVXNlciVzIGZyb20gVXNlciVzOiBSZWNlaXZlICVZXCIsbyx0LFtpLGVdKSxudWxsPT1jJiYhbil0aHJvdyBuZXcgRXJyb3IoXCJSZWNlaXZlZCBtZXNzYWdlIGZyb20gdW5rbm93biBwZWVyIVwiKTtpZihcInN5bmMgc3RlcCAxXCI9PT11fHxcInN5bmMgc3RlcCAyXCI9PT11KXt2YXIgaD1hLnJlYWRWYXJVaW50KCk7aWYobnVsbD09Yy5hdXRoKXJldHVybiBjLnByb2Nlc3NBZnRlckF1dGgucHVzaChbdSxjLGEscyx0XSksdGhpcy5jaGVja0F1dGgoaCxpLHQpLnRoZW4oZnVuY3Rpb24odCl7bnVsbD09Yy5hdXRoJiYoYy5hdXRoPXQsaS5lbWl0KFwidXNlckF1dGhlbnRpY2F0ZWRcIix7dXNlcjpjLnVpZCxhdXRoOnR9KSk7dmFyIGU9Yy5wcm9jZXNzQWZ0ZXJBdXRoO2MucHJvY2Vzc0FmdGVyQXV0aD1bXSxlLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIHIuY29tcHV0ZU1lc3NhZ2UodFswXSx0WzFdLHRbMl0sdFszXSx0WzRdKX0pfSl9IW4mJm51bGw9PWMuYXV0aHx8XCJ1cGRhdGVcIj09PXUmJiFjLmlzU3luY2VkP2MucHJvY2Vzc0FmdGVyU3luYy5wdXNoKFt1LGMsYSxzLHQsITFdKTp0aGlzLmNvbXB1dGVNZXNzYWdlKHUsYyxhLHMsdCxuKX19LHtrZXk6XCJjb21wdXRlTWVzc2FnZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuLGksbyxhKXtpZihcInN5bmMgc3RlcCAxXCIhPT10fHxcIndyaXRlXCIhPT1lLmF1dGgmJlwicmVhZFwiIT09ZS5hdXRoKXt2YXIgcz10aGlzLnk7cy50cmFuc2FjdChmdW5jdGlvbigpe2lmKFwic3luYyBzdGVwIDJcIj09PXQmJlwid3JpdGVcIj09PWUuYXV0aClkKG4saSxzLGUsbyk7ZWxzZXtpZihcInVwZGF0ZVwiIT09dHx8IWEmJlwid3JpdGVcIiE9PWUuYXV0aCl0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gcmVjZWl2ZSBtZXNzYWdlXCIpO3IocyxuKX19LCEwKX1lbHNlIGgobixpLHRoaXMueSxlLG8pfX0se2tleTpcIl9zZXRTeW5jZWRXaXRoXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcztpZihudWxsIT10KXt2YXIgbj10aGlzLmNvbm5lY3Rpb25zLmdldCh0KTtuLmlzU3luY2VkPSEwO3ZhciByPW4ucHJvY2Vzc0FmdGVyU3luYztuLnByb2Nlc3NBZnRlclN5bmM9W10sci5mb3JFYWNoKGZ1bmN0aW9uKHQpe2UuY29tcHV0ZU1lc3NhZ2UodFswXSx0WzFdLHRbMl0sdFszXSx0WzRdKX0pfXZhciBpPUFycmF5LmZyb20odGhpcy5jb25uZWN0aW9ucy52YWx1ZXMoKSk7aS5sZW5ndGg+MCYmaS5ldmVyeShmdW5jdGlvbih0KXtyZXR1cm4gdC5pc1N5bmNlZH0pJiZ0aGlzLl9maXJlSXNTeW5jZWRMaXN0ZW5lcnMoKX19XSksdH0oKSksVWU9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUpe0V0KHRoaXMsdCksdGhpcy5vcHRzPWUsdGhpcy55cz1uZXcgTWFwfXJldHVybiBVdCh0LFt7a2V5OlwiX2luaXRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49dGhpcy55cy5nZXQodCk7cmV0dXJuIHZvaWQgMD09PW4/KG49eXQoKSxuLm11dHVhbEV4Y2x1ZGU9SygpLHRoaXMueXMuc2V0KHQsbiksdGhpcy5pbml0KHQpLnRoZW4oZnVuY3Rpb24oKXtyZXR1cm4gdC5vbihcImFmdGVyVHJhbnNhY3Rpb25cIixmdW5jdGlvbih0LG4pe3ZhciByPWUueXMuZ2V0KHQpO2lmKHIubGVuPjApe3IuYnVmZmVyLnNldFVpbnQzMigwLHIubGVuKSxlLnNhdmVVcGRhdGUodCxyLmJ1ZmZlci5jcmVhdGVCdWZmZXIoKSxuKTt2YXIgaT15dCgpO2Zvcih2YXIgbyBpbiBpKXJbb109aVtvXX19KSxlLnJldHJpZXZlKHQpfSkudGhlbihmdW5jdGlvbigpe3JldHVybiBQcm9taXNlLnJlc29sdmUobil9KSk6UHJvbWlzZS5yZXNvbHZlKG4pfX0se2tleTpcImRlaW5pdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMueXMuZGVsZXRlKHQpLHQucGVyc2lzdGVuY2U9bnVsbH19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnlzPW51bGx9fSx7a2V5OlwicmVtb3ZlUGVyc2lzdGVkRGF0YVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMsbj0hKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdKXx8YXJndW1lbnRzWzFdO3RoaXMueXMuZm9yRWFjaChmdW5jdGlvbihyLGkpe2kucm9vbT09PXQmJihuP2kuZGVzdHJveSgpOmUuZGVpbml0KGkpKX0pfX0se2tleTpcInNhdmVVcGRhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXt9fSx7a2V5Olwic2F2ZVN0cnVjdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55cy5nZXQodCk7dm9pZCAwIT09biYmbi5tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7ZS5fdG9CaW5hcnkobi5idWZmZXIpLG4ubGVuKyt9KX19LHtrZXk6XCJyZXRyaWV2ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgaT10aGlzLnlzLmdldCh0KTt2b2lkIDAhPT1pJiZpLm11dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt0LnRyYW5zYWN0KGZ1bmN0aW9uKCl7aWYobnVsbCE9ZSYmdnQodCxuZXcgVnQobmV3IFVpbnQ4QXJyYXkoZSkpKSxudWxsIT1uKWZvcih2YXIgaT0wO2k8bi5sZW5ndGg7aSsrKXIodCxuZXcgVnQobmV3IFVpbnQ4QXJyYXkobltpXSkpKX0pLHQuZW1pdChcInBlcnNpc3RlbmNlUmVhZHlcIil9KX19LHtrZXk6XCJwZXJzaXN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHB0KHQpLmNyZWF0ZUJ1ZmZlcigpfX1dKSx0fSgpLEJlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXtFdCh0aGlzLGUpO3ZhciByPUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtyZXR1cm4gbi52YWx1ZT10LnRvU3RyaW5nKCksci5fdHlwZU9ic2VydmVyPWd0LmJpbmQociksci5fZG9tT2JzZXJ2ZXI9bXQuYmluZChyKSx0Lm9ic2VydmUoci5fdHlwZU9ic2VydmVyKSxuLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLHIuX2RvbU9ic2VydmVyKSxyfXJldHVybiBUdChlLHQpLFV0KGUsW3trZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnR5cGUudW5vYnNlcnZlKHRoaXMuX3R5cGVPYnNlcnZlciksdGhpcy50YXJnZXQudW5vYnNlcnZlKHRoaXMuX2RvbU9ic2VydmVyKSxCdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0oS3QpLFRlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCxuKXtFdCh0aGlzLGUpO3ZhciByPUF0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4pKTtyZXR1cm4gbi5zZXRDb250ZW50cyh0LnRvRGVsdGEoKSxcInlqc1wiKSxyLl90eXBlT2JzZXJ2ZXI9a3QuYmluZChyKSxyLl9xdWlsbE9ic2VydmVyPWJ0LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5vbihcInRleHQtY2hhbmdlXCIsci5fcXVpbGxPYnNlcnZlcikscn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0Lm9mZihcInRleHQtY2hhbmdlXCIsdGhpcy5fcXVpbGxPYnNlcnZlciksQnQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KEt0KSxBZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7RXQodGhpcyxlKTt2YXIgcj1BdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4uc2V0VmFsdWUodC50b1N0cmluZygpKSxyLl90eXBlT2JzZXJ2ZXI9d3QuYmluZChyKSxyLl9jb2RlTWlycm9yT2JzZXJ2ZXI9U3QuYmluZChyKSx0Lm9ic2VydmUoci5fdHlwZU9ic2VydmVyKSxuLm9uKFwiY2hhbmdlc1wiLHIuX2NvZGVNaXJyb3JPYnNlcnZlcikscn1yZXR1cm4gVHQoZSx0KSxVdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0LnVub2JzZXJ2ZSh0aGlzLl9jb2RlTWlycm9yT2JzZXJ2ZXIpLEJ0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShLdCk7cmV0dXJuIFkuQWJzdHJhY3RDb25uZWN0b3I9RWUsWS5BYnN0cmFjdFBlcnNpc3RlbmNlPVVlLFkuQXJyYXk9WUFycmF5LFkuTWFwPVlNYXAsWS5UZXh0PVlUZXh0LFkuWG1sRWxlbWVudD1ZWG1sRWxlbWVudCxZLlhtbEZyYWdtZW50PVlYbWxGcmFnbWVudCxZLlhtbFRleHQ9WVhtbFRleHQsWS5YbWxIb29rPVlYbWxIb29rLFkuVGV4dGFyZWFCaW5kaW5nPUJlLFkuUXVpbGxCaW5kaW5nPVRlLFkuRG9tQmluZGluZz1uZSxZLkNvZGVNaXJyb3JCaW5kaW5nPUFlLG5lLmRvbVRvVHlwZT1MLG5lLmRvbXNUb1R5cGVzPUosbmUuc3dpdGNoQXNzb2NpYXRpb249VyxZLnV0aWxzPXtCaW5hcnlEZWNvZGVyOlZ0LFVuZG9NYW5hZ2VyOmllLGdldFJlbGF0aXZlUG9zaXRpb246Wixmcm9tUmVsYXRpdmVQb3NpdGlvbjpRLHJlZ2lzdGVyU3RydWN0OlgsaW50ZWdyYXRlUmVtb3RlU3RydWN0czpyLHRvQmluYXJ5OnB0LGZyb21CaW5hcnk6dnR9LFkuZGVidWc9T2UsT2UuZm9ybWF0dGVycy5ZPV8sT2UuZm9ybWF0dGVycy55PXYsWX0pO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eS5qcy5tYXBcbiIsInZhciBZID0gcmVxdWlyZSgneWpzJyk7XG53aW5kb3cuWSA9IFk7XG5yZXF1aXJlKCd5LXdlYnJ0YzMnKShZKTtcblxudmFyIHlpZCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC8vZywgJ19fJyk7XG52YXIgeSA9IG5ldyBZKHlpZCwge1xuICAgIGNvbm5lY3Rvcjoge1xuICAgICAgICBuYW1lOiAnd2VicnRjJyxcbiAgICAgICAgcm9vbTogeWlkLFxuICAgICAgICB1cmw6ICdodHRwczovL2Zpbndpbi5pbzoxMjU2J1xuICAgIH1cbn0pO1xud2luZG93LnkgPSB5O1xuXG5mdW5jdGlvbiBzdGFydF95YmluZGluZ3MoKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzX2F2YWlsYWJsZSAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgJiYgdHlwZW9mIEp1cHl0ZXIgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICYmIHR5cGVvZiBKdXB5dGVyLm5vdGVib29rICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICAmJiBKdXB5dGVyLm5vdGVib29rLl9mdWxseV9sb2FkZWQpIHtcblxuICAgICAgICBmb3IgKHZhciBpZCBpbiBzaGFyZWRfZWxlbWVudHMpIHtcbiAgICAgICAgICAgIHZhciBjb2RlbWlycm9yID0gc2hhcmVkX2VsZW1lbnRzW2lkXVsnY29kZW1pcnJvciddO1xuICAgICAgICAgICAgbmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3InK2lkLCBZLlRleHQpLCBjb2RlbWlycm9yKTtcblxuICAgICAgICAgICAgdmFyIG91dHB1dCA9IHNoYXJlZF9lbGVtZW50c1tpZF1bJ291dHB1dCddO1xuICAgICAgICAgICAgbmV3IFkuRG9tQmluZGluZyh5LmRlZmluZSgneG1sJytpZCwgWS5YbWxGcmFnbWVudCksIG91dHB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdpbmRvdy5nZXRfaW5hY3RpdmVfY2VsbCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgICAgIHZhciBjZWxscyA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGxzKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8Y2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGNlbGxzW2ldLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdhY3RpdmUnKSA9PT0gJ25vJ1xuICAgICAgICAgICAgICAgICAgICAmJiBjZWxsc1tpXS5jZWxsX3R5cGUgPT09IHR5cGVcbiAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjZWxsc1tpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdpbmRvdy5nZXRfY2VsbCA9IGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgdmFyIGNlbGxzID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxjZWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjZWxsc1tpXS5lbGVtZW50LmZpbmQoJy5pbnB1dF9hcmVhJykuZGF0YSgnaWQnKSA9PT0gaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNlbGxzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgd2luZG93LnNldF9jZWxsID0gZnVuY3Rpb24gKGlkLCBpbmRleCwgYWN0aXZlKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBzZXRfZWxlbWVudChlbGVtZW50LCBpbmRleCkge1xuICAgICAgICAgICAgICAgIHZhciB0byA9ICQoJyNub3RlYm9vay1jb250YWluZXInKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdG8ucHJlcGVuZChlbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0by5jaGlsZHJlbigpLmVxKGluZGV4LTEpLmFmdGVyKGVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICAgICB2YXIgY2VsbCA9IGdldF9jZWxsKHBhcnNlSW50KGlkKSk7XG4gICAgICAgICAgICBpZiAocGFyc2VJbnQoaWQpICE9PSBwYXJzZUludChpbmRleCkpIHtcbiAgICAgICAgICAgICAgICBzZXRfZWxlbWVudChjZWxsLmVsZW1lbnQsIGluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhY3RpdmUgPT09ICd5ZXMnKSB7XG4gICAgICAgICAgICAgICAgY2VsbC5lbGVtZW50LmZpbmQoJy5pbnB1dF9hcmVhJykuZGF0YSgnYWN0aXZlJywgJ3llcycpO1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5mb2N1c19jZWxsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5zZXRfdGV4dCgnJyk7XG4gICAgICAgICAgICAgICAgaWYgKGNlbGwuY2VsbF90eXBlID09PSAnY29kZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5vdXRwdXRfYXJlYS5jbGVhcl9vdXRwdXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2VsbC5lbGVtZW50LmZpbmQoJy5pbnB1dF9hcmVhJykuZGF0YSgnYWN0aXZlJywgJ25vJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjZWxsLmNlbGxfdHlwZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICAgICAgICAgIGNlbGwudW5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICBjZWxsLnJlbmRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LnJlc29sdmVfeW1hcCA9IHRydWU7XG4gICAgICAgIHZhciB5bWFwID0geS5kZWZpbmUoJ3ltYXAnLCBZLk1hcCk7XG4gICAgICAgIHltYXAub2JzZXJ2ZShmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgZm9yIChsZXQga2V5IG9mIGUua2V5c0NoYW5nZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRfY2VsbChrZXksIHltYXAuZ2V0KGtleSlbJ2luZGV4J10sIHltYXAuZ2V0KGtleSlbJ2FjdGl2ZSddKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh3aW5kb3cucmVzb2x2ZV95bWFwKSB7XG4gICAgICAgICAgICB3aW5kb3cucmVzb2x2ZV95bWFwID0gZmFsc2U7XG4gICAgICAgICAgICBleGVjX3ltYXAoKTtcbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cueW1hcCA9IHltYXA7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBleGVjX3ltYXAoKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIEp1cHl0ZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBKdXB5dGVyLm5vdGVib29rICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0geW1hcC5rZXlzKCk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaW5kZXggaW4ga2V5cykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWQgPSBrZXlzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgc2V0X2NlbGwoaWQsIHltYXAuZ2V0KGlkKVsnaW5kZXgnXSwgeW1hcC5nZXQoaWQpWydhY3RpdmUnXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGV4ZWNfeW1hcCwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KHN0YXJ0X3liaW5kaW5ncywgMCk7XG4gICAgfVxufVxuc3RhcnRfeWJpbmRpbmdzKCk7XG4iXX0=

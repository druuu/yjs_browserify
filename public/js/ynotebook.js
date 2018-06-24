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
	            var DEFAULT_CHANNEL = 'dinesh';
	            var ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "turn:try.refactored.ai:3478", username: "test99", credential: "test" }];
	            var dcs = {};
	            _this.dcs = dcs;
	            _this.sdcs = dcs;
	            var peers = {};
	            var peer_media_elements = {};
	            var sockets;
	            _this.sockets = sockets;
	            _this.load_ynotebook = options.load_ynotebook;

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
	                    join_chat_channel(DEFAULT_CHANNEL, { 'whatever-you-want-here': 'stuff' });
	                });

	                signaling_socket.on('sockets', function (sockets) {
	                    ywebrtc.sockets = sockets;
	                    ywebrtc.load_ynotebook();
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
 * @version v13.0.0-63
 * @license MIT
 */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.Y=e()}(this,function(){"use strict";function t(t,e,n,r){if(null===e)t.root=n,n._parent=null;else if(e.left===r)e.left=n;else{if(e.right!==r)throw new Error("The elements are wrongly connected!");e.right=n}}function e(t,e){var n=e._id;if(void 0===n)e._integrate(t);else{if(t.ss.getState(n.user)>n.clock)return;!t.gcEnabled||e.constructor===jt||e._parent.constructor!==jt&&!1===e._parent._deleted?e._integrate(t):e._gc(t);var r=t._missingStructs.get(n.user);if(null!=r)for(var i=n.clock,o=i+e._length;i<o;i++){var a=r.get(i);void 0!==a&&(a.forEach(function(e){if(0===--e.missing){var n=e.decoder,r=n.pos,i=e.struct._fromBinary(t,n);n.pos=r,0===i.length&&t._readyToIntegrate.push(e.struct)}}),r.delete(i))}}}function n(t,e,n){for(var r=e.readUint32(),i=0;i<r;i++){var o=e.readVarUint(),a=F(o),s=new a,l=s._fromBinary(t,e),u="  "+s._logString();l.length>0&&(u+=" .. missing: "+l.map(p).join(", ")),n.push(u)}}function r(t,n){for(var r=n.readUint32(),i=0;i<r;i++){var o=n.readVarUint(),a=F(o),s=new a,l=n.pos,u=s._fromBinary(t,n);if(0===u.length)for(;null!=s;)e(t,s),s=t._readyToIntegrate.shift();else{var c=new Nt(n.uint8arr);c.pos=l;for(var h=new Vt(c,u,s),f=t._missingStructs,d=u.length-1;d>=0;d--){var _=u[d];f.has(_.user)||f.set(_.user,new Map);var v=f.get(_.user);v.has(_.clock)||v.set(_.clock,[]);(v=v.get(_.clock)).push(h)}}}}function i(t){for(var e=new Map,n=t.readUint32(),r=0;r<n;r++){var i=t.readVarUint(),o=t.readVarUint();e.set(i,o)}return e}function o(t,e){var n=e.pos,r=0;e.writeUint32(0);var i=!0,o=!1,a=void 0;try{for(var s,l=t.ss.state[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=Bt(s.value,2),c=u[0],h=u[1];e.writeVarUint(c),e.writeVarUint(h),r++}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}e.setUint32(n,r)}function a(t,e){var n=null,r=void 0,i=void 0,o=0,a=e.pos;e.writeUint32(0),t.ds.iterate(null,null,function(t){var a=t._id.user,s=t._id.clock,l=t.len,u=t.gc;n!==a&&(o++,null!==n&&e.setUint32(i,r),n=a,e.writeVarUint(a),i=e.pos,e.writeUint32(0),r=0),e.writeVarUint(s),e.writeVarUint(l),e.writeUint8(u?1:0),r++}),null!==n&&e.setUint32(i,r),e.setUint32(a,o)}function s(t,e){for(var n=e.readUint32(),r=0;r<n;r++)!function(n){for(var r=e.readVarUint(),i=[],o=e.readUint32(),a=0;a<o;a++){var s=e.readVarUint(),l=e.readVarUint(),u=1===e.readUint8();i.push([s,l,u])}if(o>0){var c=0,h=i[c],f=[];t.ds.iterate(new It(r,0),new It(r,Number.MAX_VALUE),function(t){for(;null!=h;){var e=0;if(t._id.clock+t.len<=h[0])break;h[0]<t._id.clock?(e=Math.min(t._id.clock-h[0],h[1]),f.push([r,h[0],e])):(e=t._id.clock+t.len-h[0],h[2]&&!t.gc&&f.push([r,h[0],Math.min(e,h[1])])),h[1]<=e?h=i[++c]:(h[0]=h[0]+e,h[1]=h[1]-e)}});for(var d=f.length-1;d>=0;d--){var _=f[d];g(t,_[0],_[1],_[2],!0)}for(;c<i.length;c++)h=i[c],g(t,r,h[0],h[1],!0)}}()}function l(t,e,n){var r=e.readVarString(),i=e.readVarUint();n.push('  - auth: "'+r+'"'),n.push("  - protocolVersion: "+i);for(var o=[],a=e.readUint32(),s=0;s<a;s++){var l=e.readVarUint(),u=e.readVarUint();o.push("("+l+":"+u+")")}n.push("  == SS: "+o.join(","))}function u(t,e){var n=new Lt;n.writeVarString(t.y.room),n.writeVarString("sync step 1"),n.writeVarString(t.authInfo||""),n.writeVarUint(t.protocolVersion),o(t.y,n),t.send(e,n.createBuffer())}function c(t,e,n){var r=e.pos;e.writeUint32(0);var i=0,o=!0,a=!1,s=void 0;try{for(var l,u=t.ss.state.keys()[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=l.value,h=n.get(c)||0;if(c!==Xt){var f=new It(c,h),d=t.os.findPrev(f),_=null===d?null:d._id;if(null!==_&&_.user===c&&_.clock+d._length>h){d._clonePartial(h-_.clock)._toBinary(e),i++}t.os.iterate(f,new It(c,Number.MAX_VALUE),function(t){t._toBinary(e),i++})}}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}e.setUint32(r,i)}function h(t,e,n,r,o){var s=t.readVarUint();s!==n.connector.protocolVersion&&(console.warn("You tried to sync with a Yjs instance that has a different protocol version\n      (You: "+s+", Client: "+s+").\n      "),n.destroy()),e.writeVarString("sync step 2"),e.writeVarString(n.connector.authInfo||""),c(n,e,i(t)),a(n,e),n.connector.send(r.uid,e.createBuffer()),r.receivedSyncStep2=!0,"slave"===n.connector.role&&u(n.connector,o)}function f(t,e,r){r.push("     - auth: "+e.readVarString()),r.push("  == OS:"),n(t,e,r),r.push("  == DS:");for(var i=e.readUint32(),o=0;o<i;o++){var a=e.readVarUint();r.push("    User: "+a+": ");for(var s=e.readUint32(),l=0;l<s;l++){var u=e.readVarUint(),c=e.readVarUint(),h=1===e.readUint8();r.push("["+u+", "+c+", "+h+"]")}}}function d(t,e,n,i,o){r(n,t),s(n,t),n.connector._setSyncedWith(o)}function _(t){var e=Bt(t,2),r=e[0],i=e[1],o=new Nt(i);o.readVarString();var a=o.readVarString(),s=[];return s.push("\n === "+a+" ==="),"update"===a?n(r,o,s):"sync step 1"===a?l(r,o,s):"sync step 2"===a?f(r,o,s):s.push("-- Unknown message type - probably an encoding issue!!!"),s.join("\n")}function v(t){var e=new Nt(t);return e.readVarString(),e.readVarString()}function p(t){if(null!==t&&null!=t._id&&(t=t._id),null===t)return"()";if(t instanceof It)return"("+t.user+","+t.clock+")";if(t instanceof qt)return"("+t.name+","+t.type+")";if(t.constructor===Y)return"y";throw new Error("This is not a valid ID!")}function y(t,e,n){var r=null!==e._left?e._left._lastId:null,i=null!==e._origin?e._origin._lastId:null;return t+"(id:"+p(e._id)+",left:"+p(r)+",origin:"+p(i)+",right:"+p(e._right)+",parent:"+p(e._parent)+",parentSub:"+e._parentSub+(void 0!==n?" - "+n:"")+")"}function g(t,e,n,r,i){var o=null!==t.connector&&t.connector._forwardAppliedStructs,a=t.os.getItemCleanStart(new It(e,n));if(null!==a){a._deleted||(a._splitAt(t,r),a._delete(t,o,!0));var s=a._length;if(r-=s,n+=s,r>0)for(var l=t.os.findNode(new It(e,n));null!==l&&null!==l.val&&r>0&&l.val._id.equals(new It(e,n));){var u=l.val;u._deleted||(u._splitAt(t,r),u._delete(t,o,i));var c=u._length;r-=c,n+=c,l=l.next()}}}function m(t,e,n){if(e!==t&&!e._deleted&&!t._transaction.newTypes.has(e)){var r=t._transaction.changedTypes,i=r.get(e);void 0===i&&(i=new Set,r.set(e,i)),i.add(n)}}function k(t,e,n,r){var i=e._id;n._id=new It(i.user,i.clock+r),n._origin=e,n._left=e,n._right=e._right,null!==n._right&&(n._right._left=n),n._right_origin=e._right_origin,e._right=n,n._parent=e._parent,n._parentSub=e._parentSub,n._deleted=e._deleted;var o=new Set;o.add(e);for(var a=n._right;null!==a&&o.has(a._origin);)a._origin===e&&(a._origin=n),o.add(a),a=a._right;t.os.put(n),t._transaction.newTypes.has(e)?t._transaction.newTypes.add(n):t._transaction.deletedStructs.has(e)&&t._transaction.deletedStructs.add(n)}function b(t,e){var n=void 0;do{n=e._right,e._right=null,e._right_origin=null,e._origin=e._left,e._integrate(t),e=n}while(null!==n)}function w(t,e){for(;null!==e;)e._delete(t,!1,!0),e._gc(t),e=e._right}function S(t,e,n,r,i){t._origin=r,t._left=r,t._right=i,t._right_origin=i,t._parent=e,null!==n?t._integrate(n):null===r?e._start=t:r._right=t}function O(t,e,n,r,i){for(;null!==r&&i>0;){switch(r.constructor){case Rt:case ItemString:if(i<=(r._deleted?0:r._length-1))return r=r._splitAt(e._y,i),n=r._left,[n,r,t];!1===r._deleted&&(i-=r._length);break;case Wt:!1===r._deleted&&T(t,r)}n=r,r=r._right}return[n,r,t]}function E(t,e){return O(new Map,t,null,t._start,e)}function U(t,e,n,r,i){for(;null!==r&&(!0===r._deleted||r.constructor===Wt&&i.get(r.key)===r.value);)!1===r._deleted&&i.delete(r.key),n=r,r=r._right;var o=!0,a=!1,s=void 0;try{for(var l,u=i[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=Bt(l.value,2),h=c[0],f=c[1],d=new Wt;d.key=h,d.value=f,S(d,e,t,n,r),n=d}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}return[n,r]}function T(t,e){var n=e.value,r=e.key;null===n?t.delete(r):t.set(r,n)}function B(t,e,n,r){for(;;){if(null===e)break;if(!0===e._deleted);else{if(e.constructor!==Wt||(r[e.key]||null)!==e.value)break;T(n,e)}t=e,e=e._right}return[t,e]}function A(t,e,n,r,i,o){var a=new Map;for(var s in i){var l=i[s],u=o.get(s);if(u!==l){a.set(s,u||null);var c=new Wt;c.key=s,c.value=l,S(c,e,t,n,r),n=c}}return[n,r,a]}function x(t,e,n,r,i,o,a){var s=!0,l=!1,u=void 0;try{for(var c,h=o[Symbol.iterator]();!(s=(c=h.next()).done);s=!0){var f=Bt(c.value,1),d=f[0];void 0===a[d]&&(a[d]=null)}}catch(t){l=!0,u=t}finally{try{!s&&h.return&&h.return()}finally{if(l)throw u}}var _=B(r,i,o,a),v=Bt(_,2);r=v[0],i=v[1];var p=void 0,y=A(t,n,r,i,a,o),g=Bt(y,3);r=g[0],i=g[1],p=g[2];var m=void 0;return e.constructor===String?(m=new ItemString,m._content=e):(m=new Rt,m.embed=e),S(m,n,t,r,i),r=m,U(t,n,r,i,p)}function I(t,e,n,r,i,o,a){var s=B(r,i,o,a),l=Bt(s,2);r=l[0],i=l[1];var u=void 0,c=A(t,n,r,i,a,o),h=Bt(c,3);for(r=h[0],i=h[1],u=h[2];e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Wt:var f=a[i.key];void 0!==f&&(f===i.value?u.delete(i.key):u.set(i.key,i.value),i._delete(t)),T(o,i);break;case Rt:case ItemString:i._splitAt(t,e),e-=i._length}r=i,i=i._right}return U(t,n,r,i,u)}function D(t,e,n,r,i,o){for(;e>0&&null!==i;){if(!1===i._deleted)switch(i.constructor){case Wt:T(o,i);break;case Rt:case ItemString:i._splitAt(t,e),e-=i._length,i._delete(t)}r=i,i=i._right}return[r,i]}function P(t,e){for(e=e._parent;null!==e;){if(e===t)return!0;e=e._parent}return!1}function N(t,e){return e}function j(t,e){for(var n=new Map,r=t.attributes.length-1;r>=0;r--){var i=t.attributes[r];n.set(i.name,i.value)}return e(t.nodeName,n)}function V(t,e,n){if(P(e.type,n)){var r=n.nodeName,i=new Map;if(void 0!==n.getAttributes){var o=n.getAttributes();for(var a in o)i.set(a,o[a])}var s=e.filter(r,new Map(i));null===s?n._delete(t):i.forEach(function(t,e){!1===s.has(e)&&n.removeAttribute(e)})}}function L(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:document,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:N,i=arguments[4],o=void 0;switch(t.nodeType){case e.ELEMENT_NODE:var a=null,s=void 0;if(t.hasAttribute("data-yjs-hook")&&(a=t.getAttribute("data-yjs-hook"),void 0===(s=n[a])&&(console.error('Unknown hook "'+a+'". Deleting yjsHook dataset property.'),t.removeAttribute("data-yjs-hook"),a=null)),null===a){var l=j(t,r);null===l?o=!1:(o=new YXmlElement(t.nodeName),l.forEach(function(t,e){o.setAttribute(e,t)}),o.insert(0,J(t.childNodes,document,n,r,i)))}else o=new YXmlHook(a),s.fillType(t,o);break;case e.TEXT_NODE:o=new YXmlText,o.insert(0,t.nodeValue);break;default:throw new Error("Can't transform this node type to a YXml type!")}return R(i,t,o),o}function C(t){for(;null!==t&&t._deleted;)t=t._right;return t}function M(t,e,n){t.domToType.delete(e),t.typeToDom.delete(n)}function R(t,e,n){void 0!==t&&(t.domToType.set(e,n),t.typeToDom.set(n,e))}function W(t,e,n){if(void 0!==t){var r=t.domToType.get(e);void 0!==r&&(M(t,e,r),R(t,n,r))}}function H(t,e,n,r,i){var o=J(n,r,i.opts.hooks,i.filter,i);return t.insertAfter(e,o)}function J(t,e,n,r,i){var o=[],a=!0,s=!1,l=void 0;try{for(var u,c=t[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=L(h,e,n,r,i);!1!==f&&o.push(f)}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}return o}function z(t,e,n,r,i){var o=H(t,e,[n],r,i);return o.length>0?o[0]:e}function X(t,e,n){for(;e!==n;){var r=e;e=e.nextSibling,t.removeChild(r)}}function q(t,e){zt.set(t,e),Yt.set(e,t)}function F(t){return zt.get(t)}function $(t){return Yt.get(t)}function G(){if("undefined"!=typeof crypto&&null!=crypto.getRandomValue){var t=new Uint32Array(1);return crypto.getRandomValues(t),t[0]}if("undefined"!=typeof crypto&&null!=crypto.randomBytes){var e=crypto.randomBytes(4);return new Uint32Array(e.buffer)[0]}return Math.ceil(4294967295*Math.random())}function Z(t,e){for(var n=t._start;null!==n;){if(!1===n._deleted){if(n._length>e)return[n._id.user,n._id.clock+e];e-=n._length}n=n._right}return["endof",t._id.user,t._id.clock||null,t._id.name||null,t._id.type||null]}function Q(t,e){if("endof"===e[0]){var n=void 0;n=null===e[3]?new It(e[1],e[2]):new qt(e[3],e[4]);for(var r=t.os.get(n);null!==r._redone;)r=r._redone;return null===r||r.constructor===jt?null:{type:r,offset:r.length}}for(var i=0,o=t.os.findNodeWithUpperBound(new It(e[0],e[1])).val,a=e[1]-o._id.clock;null!==o._redone;)o=o._redone;var s=o._parent;if(o.constructor===jt||s._deleted)return null;for(o._deleted||(i=a),o=o._left;null!==o;)o._deleted||(i+=o._length),o=o._left;return{type:s,offset:i}}function K(){var t=!0;return function(e){if(t){t=!1;try{e()}catch(t){console.error(t)}t=!0}}}function tt(t){var e=getSelection(),n=e.baseNode,r=e.baseOffset,i=e.extentNode,o=e.extentOffset,a=t.domToType.get(n),s=t.domToType.get(i);return void 0!==a&&void 0!==s?{from:Z(a,r),to:Z(s,o)}:null}function et(t,e){e&&(Qt=Kt(t))}function nt(t,e){null!==Qt&&e&&t.restoreSelection(Qt)}function rt(t){if(null!==t){var e=getSelection().anchorNode;if(null!=e){e.nodeType===document.TEXT_NODE&&(e=e.parentElement);return{elem:e,top:e.getBoundingClientRect().top}}for(var n=t.children,r=0;r<n.length;r++){var i=n[r],o=i.getBoundingClientRect();if(o.top>=0)return{elem:i,top:o.top}}}return null}function it(t,e){if(null!==e){var n=e.elem,r=e.top,i=n.getBoundingClientRect().top,o=t.scrollTop+i-r;o>=0&&(t.scrollTop=o)}}function ot(t){var e=this;this._mutualExclude(function(){var n=rt(e.scrollingElement);t.forEach(function(t){var n=t.target,r=e.typeToDom.get(n);if(void 0!==r&&!1!==r)if(n.constructor===YXmlText)r.nodeValue=n.toString();else if(void 0!==t.attributesChanged&&(t.attributesChanged.forEach(function(t){var e=n.getAttribute(t);void 0===e?r.removeAttribute(t):r.setAttribute(t,e)}),t.childListChanged&&n.constructor!==YXmlHook)){var i=r.firstChild;n.forEach(function(t){var n=e.typeToDom.get(t);switch(n){case void 0:var o=t.toDom(e.opts.document,e.opts.hooks,e);r.insertBefore(o,i);break;case!1:break;default:X(r,i,n),i=n.nextSibling}}),X(r,i,null)}}),it(e.scrollingElement,n)})}function at(t,e){for(var n=0,r=0;n<t.length&&n<e.length&&t[n]===e[n];)n++;if(n!==t.length||n!==e.length)for(;r+n<t.length&&r+n<e.length&&t[t.length-r-1]===e[e.length-r-1];)r++;return{pos:n,remove:t.length-n-r,insert:e.slice(n,e.length-r)}}function st(t,e,n,r){if(null!=n&&!1!==n&&n.constructor!==YXmlHook){for(var i=n._y,o=new Set,a=e.childNodes.length-1;a>=0;a--){var s=t.domToType.get(e.childNodes[a]);void 0!==s&&!1!==s&&o.add(s)}n.forEach(function(e){!1===o.has(e)&&(e._delete(i),M(t,t.typeToDom.get(e),e))});for(var l=e.childNodes,u=l.length,c=null,h=C(n._start),f=0;f<u;f++){var d=l[f],_=t.domToType.get(d);if(void 0!==_){if(!1===_)continue;null!==h?h!==_?(_._parent!==n?M(t,d,_):(M(t,d,_),_._delete(i)),c=z(n,c,d,r,t)):(c=h,h=C(h._right)):c=z(n,c,d,r,t)}else c=z(n,c,d,r,t)}}}function lt(t,e){var n=this;this._mutualExclude(function(){n.type._y.transact(function(){var r=new Set;t.forEach(function(t){var e=t.target,i=n.domToType.get(e);if(void 0===i){var o=e,a=void 0;do{o=o.parentElement,a=n.domToType.get(o)}while(void 0===a&&null!==o);return void(!1!==a&&void 0!==a&&a.constructor!==YXmlHook&&r.add(o))}if(!1!==i&&i.constructor!==YXmlHook)switch(t.type){case"characterData":var s=at(i.toString(),e.nodeValue);i.delete(s.pos,s.remove),i.insert(s.pos,s.insert);break;case"attributes":if(i.constructor===YXmlFragment)break;var l=t.attributeName,u=e.getAttribute(l),c=new Map;c.set(l,u),i.constructor!==YXmlFragment&&n.filter(e.nodeName,c).size>0&&i.getAttribute(l)!==u&&(null==u?i.removeAttribute(l):i.setAttribute(l,u));break;case"childList":r.add(t.target)}});var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=s.value,c=n.domToType.get(u);st(n,u,c,e)}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}})})}function ut(t,e,n){var r=!1,i=void 0;return t.transact(function(){for(;!r&&n.length>0;)!function(){i=n.pop(),null!==i.fromState&&(t.os.getItemCleanStart(i.fromState),t.os.getItemCleanEnd(i.toState),t.os.iterate(i.fromState,i.toState,function(n){for(;n._deleted&&null!==n._redone;)n=n._redone;!1===n._deleted&&P(e,n)&&(r=!0,n._delete(t))}));var o=new Set,a=!0,s=!1,l=void 0;try{for(var u,c=i.deletedStructs[Symbol.iterator]();!(a=(u=c.next()).done);a=!0){var h=u.value,f=h.from,d=new It(f.user,f.clock+h.len-1);t.os.getItemCleanStart(f),t.os.getItemCleanEnd(d),t.os.iterate(f,d,function(n){P(e,n)&&n._parent!==t&&(n._id.user!==t.userID||null===i.fromState||n._id.clock<i.fromState.clock||n._id.clock>i.toState.clock)&&o.add(n)})}}catch(t){s=!0,l=t}finally{try{!a&&c.return&&c.return()}finally{if(s)throw l}}o.forEach(function(e){var n=e._redo(t,o);r=r||n})}()}),r&&i.bindingInfos.forEach(function(t,e){e._restoreUndoStackInfo(t)}),r}function ct(t,e){return e={exports:{}},t(e,e.exports),e.exports}function ht(t){if(t=String(t),!(t.length>100)){var e=/^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);if(e){var n=parseFloat(e[1]);switch((e[2]||"ms").toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return n*se;case"days":case"day":case"d":return n*ae;case"hours":case"hour":case"hrs":case"hr":case"h":return n*oe;case"minutes":case"minute":case"mins":case"min":case"m":return n*ie;case"seconds":case"second":case"secs":case"sec":case"s":return n*re;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return n;default:return}}}}function ft(t){return t>=ae?Math.round(t/ae)+"d":t>=oe?Math.round(t/oe)+"h":t>=ie?Math.round(t/ie)+"m":t>=re?Math.round(t/re)+"s":t+"ms"}function dt(t){return _t(t,ae,"day")||_t(t,oe,"hour")||_t(t,ie,"minute")||_t(t,re,"second")||t+" ms"}function _t(t,e,n){if(!(t<e))return t<1.5*e?Math.floor(t/e)+" "+n:Math.ceil(t/e)+" "+n+"s"}function vt(t,e){t.transact(function(){r(t,e),s(t,e)})}function pt(t){var e=new Lt;return c(t,e,new Map),a(t,e),e}function yt(){var t=new Lt;return t.writeUint32(0),{len:0,buffer:t}}function gt(){var t=this;this._mutualExclude(function(){var e=t.target,n=t.type,r=Z(n,e.selectionStart),i=Z(n,e.selectionEnd);e.value=n.toString();var o=Q(n._y,r),a=Q(n._y,i);e.setSelectionRange(o,a)})}function mt(){var t=this;this._mutualExclude(function(){var e=at(t.type.toString(),t.target.value);t.type.delete(e.pos,e.remove),t.type.insert(e.pos,e.insert)})}function kt(t){var e=this.target;e.update("yjs"),this._mutualExclude(function(){e.updateContents(t.delta,"yjs"),e.update("yjs")})}function bt(t){var e=this;this._mutualExclude(function(){e.type.applyDelta(t.ops)})}var wt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},St=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},Ot=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),Et=function t(e,n,r){null===e&&(e=Function.prototype);var i=Object.getOwnPropertyDescriptor(e,n);if(void 0===i){var o=Object.getPrototypeOf(e);return null===o?void 0:t(o,n,r)}if("value"in i)return i.value;var a=i.get;if(void 0!==a)return a.call(r)},Ut=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)},Tt=function(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e},Bt=function(){function t(t,e){var n=[],r=!0,i=!1,o=void 0;try{for(var a,s=t[Symbol.iterator]();!(r=(a=s.next()).done)&&(n.push(a.value),!e||n.length!==e);r=!0);}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}return n}return function(e,n){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,n);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),At=function(){function e(t){St(this,e),this.val=t,this.color=!0,this._left=null,this._right=null,this._parent=null}return Ot(e,[{key:"isRed",value:function(){return this.color}},{key:"isBlack",value:function(){return!this.color}},{key:"redden",value:function(){return this.color=!0,this}},{key:"blacken",value:function(){return this.color=!1,this}},{key:"rotateLeft",value:function(e){var n=this.parent,r=this.right,i=this.right.left;r.left=this,this.right=i,t(e,n,r,this)}},{key:"next",value:function(){if(null!==this.right){for(var t=this.right;null!==t.left;)t=t.left;return t}for(var e=this;null!==e.parent&&e!==e.parent.left;)e=e.parent;return e.parent}},{key:"prev",value:function(){if(null!==this.left){for(var t=this.left;null!==t.right;)t=t.right;return t}for(var e=this;null!==e.parent&&e!==e.parent.right;)e=e.parent;return e.parent}},{key:"rotateRight",value:function(e){var n=this.parent,r=this.left,i=this.left.right;r.right=this,this.left=i,t(e,n,r,this)}},{key:"getUncle",value:function(){return this.parent===this.parent.parent.left?this.parent.parent.right:this.parent.parent.left}},{key:"grandparent",get:function(){return this.parent.parent}},{key:"parent",get:function(){return this._parent}},{key:"sibling",get:function(){return this===this.parent.left?this.parent.right:this.parent.left}},{key:"left",get:function(){return this._left},set:function(t){null!==t&&(t._parent=this),this._left=t}},{key:"right",get:function(){return this._right},set:function(t){null!==t&&(t._parent=this),this._right=t}}]),e}(),xt=function(){function t(){St(this,t),this.root=null,this.length=0}return Ot(t,[{key:"findNext",value:function(t){var e=t.clone();return e.clock+=1,this.findWithLowerBound(e)}},{key:"findPrev",value:function(t){var e=t.clone();return e.clock-=1,this.findWithUpperBound(e)}},{key:"findNodeWithLowerBound",value:function(t){var e=this.root;if(null===e)return null;for(;;)if(null===t||t.lessThan(e.val._id)&&null!==e.left)e=e.left;else{if(null===t||!e.val._id.lessThan(t))return e;if(null===e.right)return e.next();e=e.right}}},{key:"findNodeWithUpperBound",value:function(t){if(void 0===t)throw new Error("You must define from!");var e=this.root;if(null===e)return null;for(;;)if(null!==t&&!e.val._id.lessThan(t)||null===e.right){if(null===t||!t.lessThan(e.val._id))return e;if(null===e.left)return e.prev();e=e.left}else e=e.right}},{key:"findSmallestNode",value:function(){for(var t=this.root;null!=t&&null!=t.left;)t=t.left;return t}},{key:"findWithLowerBound",value:function(t){var e=this.findNodeWithLowerBound(t);return null==e?null:e.val}},{key:"findWithUpperBound",value:function(t){var e=this.findNodeWithUpperBound(t);return null==e?null:e.val}},{key:"iterate",value:function(t,e,n){var r;for(r=null===t?this.findSmallestNode():this.findNodeWithLowerBound(t);null!==r&&(null===e||r.val._id.lessThan(e)||r.val._id.equals(e));)n(r.val),r=r.next()}},{key:"find",value:function(t){var e=this.findNode(t);return null!==e?e.val:null}},{key:"findNode",value:function(t){var e=this.root;if(null===e)return null;for(;;){if(null===e)return null;if(t.lessThan(e.val._id))e=e.left;else{if(!e.val._id.lessThan(t))return e;e=e.right}}}},{key:"delete",value:function(t){var e=this.findNode(t);if(null!=e){if(this.length--,null!==e.left&&null!==e.right){for(var n=e.left;null!==n.right;)n=n.right;e.val=n.val,e=n}var r,i=e.left||e.right;if(null===i?(r=!0,i=new At(null),i.blacken(),e.right=i):r=!1,null===e.parent)return void(r?this.root=null:(this.root=i,i.blacken(),i._parent=null));if(e.parent.left===e)e.parent.left=i;else{if(e.parent.right!==e)throw new Error("Impossible!");e.parent.right=i}if(e.isBlack()&&(i.isRed()?i.blacken():this._fixDelete(i)),this.root.blacken(),r)if(i.parent.left===i)i.parent.left=null;else{if(i.parent.right!==i)throw new Error("Impossible #3");i.parent.right=null}}}},{key:"_fixDelete",value:function(t){function e(t){return null===t||t.isBlack()}function n(t){return null!==t&&t.isRed()}if(null!==t.parent){var r=t.sibling;if(n(r)){if(t.parent.redden(),r.blacken(),t===t.parent.left)t.parent.rotateLeft(this);else{if(t!==t.parent.right)throw new Error("Impossible #2");t.parent.rotateRight(this)}r=t.sibling}t.parent.isBlack()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),this._fixDelete(t.parent)):t.parent.isRed()&&r.isBlack()&&e(r.left)&&e(r.right)?(r.redden(),t.parent.blacken()):(t===t.parent.left&&r.isBlack()&&n(r.left)&&e(r.right)?(r.redden(),r.left.blacken(),r.rotateRight(this),r=t.sibling):t===t.parent.right&&r.isBlack()&&n(r.right)&&e(r.left)&&(r.redden(),r.right.blacken(),r.rotateLeft(this),r=t.sibling),r.color=t.parent.color,t.parent.blacken(),t===t.parent.left?(r.right.blacken(),t.parent.rotateLeft(this)):(r.left.blacken(),t.parent.rotateRight(this)))}}},{key:"put",value:function(t){var e=new At(t);if(null!==this.root){for(var n=this.root;;)if(e.val._id.lessThan(n.val._id)){if(null===n.left){n.left=e;break}n=n.left}else{if(!n.val._id.lessThan(e.val._id))return n.val=e.val,n;if(null===n.right){n.right=e;break}n=n.right}this._fixInsert(e)}else this.root=e;return this.length++,this.root.blacken(),e}},{key:"_fixInsert",value:function(t){if(null===t.parent)return void t.blacken();if(!t.parent.isBlack()){var e=t.getUncle();null!==e&&e.isRed()?(t.parent.blacken(),e.blacken(),t.grandparent.redden(),this._fixInsert(t.grandparent)):(t===t.parent.right&&t.parent===t.grandparent.left?(t.parent.rotateLeft(this),t=t.left):t===t.parent.left&&t.parent===t.grandparent.right&&(t.parent.rotateRight(this),t=t.right),t.parent.blacken(),t.grandparent.redden(),t===t.parent.left?t.grandparent.rotateRight(this):t.grandparent.rotateLeft(this))}}}]),t}(),It=function(){function t(e,n){St(this,t),this.user=e,this.clock=n}return Ot(t,[{key:"clone",value:function(){return new t(this.user,this.clock)}},{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.clock===this.clock}},{key:"lessThan",value:function(e){return e.constructor===t&&(this.user<e.user||this.user===e.user&&this.clock<e.clock)}}]),t}(),Dt=function(){function t(e,n,r){St(this,t),this._id=e,this.len=n,this.gc=r}return Ot(t,[{key:"clone",value:function(){return new t(this._id,this.len,this.gc)}}]),t}(),Pt=function(t){function e(){return St(this,e),Tt(this,(e.__proto__||Object.getPrototypeOf(e)).apply(this,arguments))}return Ut(e,t),Ot(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){t.push({user:e._id.user,clock:e._id.clock,len:e.len,gc:e.gc})}),console.table(t)}},{key:"isDeleted",value:function(t){var e=this.findWithUpperBound(t);return null!==e&&e._id.user===t.user&&t.clock<e._id.clock+e.len}},{key:"mark",value:function(t,e,n){if(0!==e){var r=this.findWithUpperBound(new It(t.user,t.clock-1));null!==r&&r._id.user===t.user&&r._id.clock<t.clock&&t.clock<r._id.clock+r.len&&(t.clock+e<r._id.clock+r.len&&this.put(new Dt(new It(t.user,t.clock+e),r._id.clock+r.len-t.clock-e,r.gc)),r.len=t.clock-r._id.clock);var i=new It(t.user,t.clock+e-1),o=this.findWithUpperBound(i);if(null!==o&&o._id.user===t.user&&o._id.clock<t.clock+e&&t.clock<=o._id.clock&&t.clock+e<o._id.clock+o.len){var a=t.clock+e-o._id.clock;o._id=new It(o._id.user,o._id.clock+a),o.len-=a}var s=[];this.iterate(t,i,function(t){s.push(t._id)});for(var l=s.length-1;l>=0;l--)this.delete(s[l]);var u=new Dt(t,e,n);null!==r&&r._id.user===t.user&&r._id.clock+r.len===t.clock&&r.gc===n&&(r.len+=e,u=r);var c=this.find(new It(t.user,t.clock+e));null!==c&&c._id.user===t.user&&t.clock+e===c._id.clock&&n===c.gc&&(u.len+=c.len,this.delete(c._id)),r!==u&&this.put(u)}}},{key:"markDeleted",value:function(t,e){this.mark(t,e,!1)}}]),e}(xt),Nt=function(){function t(e){if(St(this,t),e instanceof ArrayBuffer)this.uint8arr=new Uint8Array(e);else{if(!(e instanceof Uint8Array||"undefined"!=typeof Buffer&&e instanceof Buffer))throw new Error("Expected an ArrayBuffer or Uint8Array!");this.uint8arr=e}this.pos=0}return Ot(t,[{key:"clone",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.pos,n=new t(this.uint8arr);return n.pos=e,n}},{key:"skip8",value:function(){this.pos++}},{key:"readUint8",value:function(){return this.uint8arr[this.pos++]}},{key:"readUint32",value:function(){var t=this.uint8arr[this.pos]+(this.uint8arr[this.pos+1]<<8)+(this.uint8arr[this.pos+2]<<16)+(this.uint8arr[this.pos+3]<<24);return this.pos+=4,t}},{key:"peekUint8",value:function(){return this.uint8arr[this.pos]}},{key:"readVarUint",value:function(){for(var t=0,e=0;;){var n=this.uint8arr[this.pos++];if(t|=(127&n)<<e,e+=7,n<128)return t>>>0;if(e>35)throw new Error("Integer out of range!")}}},{key:"readVarString",value:function(){for(var t=this.readVarUint(),e=new Array(t),n=0;n<t;n++)e[n]=this.uint8arr[this.pos++];var r=e.map(function(t){return String.fromCodePoint(t)}).join("");return decodeURIComponent(escape(r))}},{key:"peekVarString",value:function(){var t=this.pos,e=this.readVarString();return this.pos=t,e}},{key:"readID",value:function(){var t=this.readVarUint();if(t===Xt){var e=new qt(this.readVarString(),null);return e.type=this.readVarUint(),e}return new It(t,this.readVarUint())}},{key:"length",get:function(){return this.uint8arr.length}}]),t}(),jt=function(){function t(){St(this,t),this._id=null,this._length=0}return Ot(t,[{key:"_integrate",value:function(e){var n=this._id,r=e.ss.getState(n.user);n.clock===r&&e.ss.setState(n.user,n.clock+this._length),e.ds.mark(this._id,this._length,!0);var i=e.os.put(this),o=i.prev().val;null!==o&&o.constructor===t&&o._id.user===i.val._id.user&&o._id.clock+o._length===i.val._id.clock&&(o._length+=i.val._length,e.os.delete(i.val._id),i=o),i.val&&(i=i.val);var a=e.os.findNext(i._id);null!==a&&a.constructor===t&&a._id.user===i._id.user&&a._id.clock===i._id.clock+i._length&&(i._length+=a._length,e.os.delete(a._id)),n.user!==Xt&&(null===e.connector||!e.connector._forwardAppliedStructs&&n.user!==e.userID||e.connector.broadcastStruct(this),null!==e.persistence&&e.persistence.saveStruct(e,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._id),t.writeVarUint(this._length)}},{key:"_fromBinary",value:function(t,e){var n=e.readID();this._id=n,this._length=e.readVarUint();var r=[];return t.ss.getState(n.user)<n.clock&&r.push(new It(n.user,n.clock-1)),r}},{key:"_splitAt",value:function(){return this}},{key:"_clonePartial",value:function(e){var n=new t;return n._id=new It(this._id.user,this._id.clock+e),n._length=this._length-e,n}},{key:"_deleted",get:function(){return!0}}]),t}(),Vt=function t(e,n,r){St(this,t),this.decoder=e,this.missing=n.length,this.struct=r},Lt=function(){function t(){St(this,t),this.data=[]}return Ot(t,[{key:"createBuffer",value:function(){return Uint8Array.from(this.data).buffer}},{key:"writeUint8",value:function(t){this.data.push(255&t)}},{key:"setUint8",value:function(t,e){this.data[t]=255&e}},{key:"writeUint16",value:function(t){this.data.push(255&t,t>>>8&255)}},{key:"setUint16",value:function(t,e){this.data[t]=255&e,this.data[t+1]=e>>>8&255}},{key:"writeUint32",value:function(t){for(var e=0;e<4;e++)this.data.push(255&t),t>>>=8}},{key:"setUint32",value:function(t,e){for(var n=0;n<4;n++)this.data[t+n]=255&e,e>>>=8}},{key:"writeVarUint",value:function(t){for(;t>=128;)this.data.push(128|127&t),t>>>=7;this.data.push(127&t)}},{key:"writeVarString",value:function(t){var e=unescape(encodeURIComponent(t)),n=e.split("").map(function(t){return t.codePointAt()}),r=n.length;this.writeVarUint(r);for(var i=0;i<r;i++)this.data.push(n[i])}},{key:"writeID",value:function(t){var e=t.user;this.writeVarUint(e),e!==Xt?this.writeVarUint(t.clock):(this.writeVarString(t.name),this.writeVarUint(t.type))}},{key:"length",get:function(){return this.data.length}},{key:"pos",get:function(){return this.data.length}}]),t}(),Delete=function(){function Delete(){St(this,Delete),this._target=null,this._length=null}return Ot(Delete,[{key:"_fromBinary",value:function(t,e){var n=e.readID()
;return this._targetID=n,this._length=e.readVarUint(),null===t.os.getItem(n)?[n]:[]}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor)),t.writeID(this._targetID),t.writeVarUint(this._length)}},{key:"_integrate",value:function(t){if(arguments.length>1&&void 0!==arguments[1]&&arguments[1])null!==t.connector&&t.connector.broadcastStruct(this);else{var e=this._targetID;g(t,e.user,e.clock,this._length,!1)}null!==t.persistence&&t.persistence.saveStruct(t,this)}},{key:"_logString",value:function(){return"Delete - target: "+p(this._targetID)+", len: "+this._length}}]),Delete}(),Ct=function t(e){St(this,t),this.y=e,this.newTypes=new Set,this.changedTypes=new Map,this.deletedStructs=new Set,this.beforeState=new Map,this.changedParentTypes=new Map},Item=function(){function Item(){St(this,Item),this._id=null,this._origin=null,this._left=null,this._right=null,this._right_origin=null,this._parent=null,this._parentSub=null,this._deleted=!1,this._redone=null}return Ot(Item,[{key:"_copy",value:function(){return new this.constructor}},{key:"_redo",value:function(t,e){if(null!==this._redone)return this._redone;var n=this._copy(),r=void 0,i=void 0;null===this._parentSub?(r=this._left,i=this):(r=null,i=this._parent._map.get(this._parentSub),i._delete(t));var o=this._parent;if(!(!0!==o._deleted||null!==o._redone||e.has(o)&&o._redo(t,e)))return!1;if(null!==o._redone){for(o=o._redone;null!==r;){if(null!==r._redone&&r._redone._parent===o){r=r._redone;break}r=r._left}for(;null!==i;)null!==i._redone&&i._redone._parent===o&&(i=i._redone),i=i._right}return n._origin=r,n._left=r,n._right=i,n._right_origin=i,n._parent=o,n._parentSub=this._parentSub,n._integrate(t),this._redone=n,!0}},{key:"_splitAt",value:function(t,e){return 0===e?this:this._right}},{key:"_delete",value:function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];if(!this._deleted){this._deleted=!0,t.ds.mark(this._id,this._length,!1);var n=new Delete;n._targetID=this._id,n._length=this._length,e?n._integrate(t,!0):null!==t.persistence&&t.persistence.saveStruct(t,n),m(t,this._parent,this._parentSub),t._transaction.deletedStructs.add(this)}}},{key:"_gcChildren",value:function(t){}},{key:"_gc",value:function(t){var e=new jt;e._id=this._id,e._length=this._length,t.os.delete(this._id),e._integrate(t)}},{key:"_beforeChange",value:function(){}},{key:"_integrate",value:function(t){t._transaction.newTypes.add(this);var e=this._parent,n=this._id,r=null===n?t.userID:n.user,i=t.ss.getState(r);if(null===n)this._id=t.ss.getNextID(this._length);else if(n.user===Xt);else{if(n.clock<i)return[];if(n.clock!==i)throw new Error("Can not apply yet!");t.ss.setState(n.user,i+this._length)}e._deleted||t._transaction.changedTypes.has(e)||t._transaction.newTypes.has(e)||this._parent._beforeChange();var o=void 0;o=null!==this._left?this._left._right:null!==this._parentSub?this._parent._map.get(this._parentSub)||null:this._parent._start;for(var a=new Set,s=new Set;null!==o&&o!==this._right;){if(s.add(o),a.add(o),this._origin===o._origin)o._id.user<this._id.user&&(this._left=o,a.clear());else{if(!s.has(o._origin))break;a.has(o._origin)||(this._left=o,a.clear())}o=o._right}var l=this._parentSub;if(null===this._left){var u=void 0;if(null!==l){var c=e._map;u=c.get(l)||null,c.set(l,this)}else u=e._start,e._start=this;this._right=u,null!==u&&(u._left=this)}else{var h=this._left,f=h._right;this._right=f,h._right=this,null!==f&&(f._left=this)}e._deleted&&this._delete(t,!1),t.os.put(this),m(t,e,l),this._id.user!==Xt&&(null===t.connector||!t.connector._forwardAppliedStructs&&this._id.user!==t.userID||t.connector.broadcastStruct(this),null!==t.persistence&&t.persistence.saveStruct(t,this))}},{key:"_toBinary",value:function(t){t.writeUint8($(this.constructor));var e=0;null!==this._origin&&(e+=1),null!==this._right_origin&&(e+=4),null!==this._parentSub&&(e+=8),t.writeUint8(e),t.writeID(this._id),1&e&&t.writeID(this._origin._lastId),4&e&&t.writeID(this._right_origin._id),0==(5&e)&&t.writeID(this._parent._id),8&e&&t.writeVarString(JSON.stringify(this._parentSub))}},{key:"_fromBinary",value:function(t,e){var n=[],r=e.readUint8(),i=e.readID();if(this._id=i,1&r){var o=e.readID(),a=t.os.getItemCleanEnd(o);null===a?n.push(o):(this._origin=a,this._left=this._origin)}if(4&r){var s=e.readID(),l=t.os.getItemCleanStart(s);null===l?n.push(s):(this._right=l,this._right_origin=l)}if(0==(5&r)){var u=e.readID();if(null===this._parent){var c=void 0;c=u.constructor===qt?t.os.get(u):t.os.getItem(u),null===c?n.push(u):this._parent=c}}else null===this._parent&&(null!==this._origin?this._origin.constructor===jt?this._parent=this._origin:this._parent=this._origin._parent:null!==this._right_origin&&(this._right_origin.constructor===jt?this._parent=this._right_origin:this._parent=this._right_origin._parent));return 8&r&&(this._parentSub=JSON.parse(e.readVarString())),t.ss.getState(i.user)<i.clock&&n.push(new It(i.user,i.clock-1)),n}},{key:"_lastId",get:function(){return new It(this._id.user,this._id.clock+this._length-1)}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!0}}]),Item}(),Mt=function(){function t(){St(this,t),this.eventListeners=[]}return Ot(t,[{key:"destroy",value:function(){this.eventListeners=null}},{key:"addEventListener",value:function(t){this.eventListeners.push(t)}},{key:"removeEventListener",value:function(t){this.eventListeners=this.eventListeners.filter(function(e){return t!==e})}},{key:"removeAllEventListeners",value:function(){this.eventListeners=[]}},{key:"callEventListeners",value:function(t,e){for(var n=0;n<this.eventListeners.length;n++)try{(0,this.eventListeners[n])(e)}catch(t){console.error(t)}}}]),t}(),Type=function(t){function Type(){St(this,Type);var t=Tt(this,(Type.__proto__||Object.getPrototypeOf(Type)).call(this));return t._map=new Map,t._start=null,t._y=null,t._eventHandler=new Mt,t._deepEventHandler=new Mt,t}return Ut(Type,t),Ot(Type,[{key:"getPathTo",value:function(t){if(t===this)return[];for(var e=[],n=this._y;t!==this&&t!==n;){var r=t._parent;if(null!==t._parentSub)e.unshift(t._parentSub);else{var i=!0,o=!1,a=void 0;try{for(var s,l=r[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){var u=Bt(s.value,2),c=u[0];if(u[1]===t){e.unshift(c);break}}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}}t=r}if(t!==this)throw new Error("The type is not a child of this node");return e}},{key:"_callEventHandler",value:function(t,e){var n=t.changedParentTypes;this._eventHandler.callEventListeners(t,e);for(var r=this;r!==this._y;){var i=n.get(r);void 0===i&&(i=[],n.set(r,i)),i.push(e),r=r._parent}}},{key:"_transact",value:function(t){var e=this._y;null!==e?e.transact(t):t(e)}},{key:"observe",value:function(t){this._eventHandler.addEventListener(t)}},{key:"observeDeep",value:function(t){this._deepEventHandler.addEventListener(t)}},{key:"unobserve",value:function(t){this._eventHandler.removeEventListener(t)}},{key:"unobserveDeep",value:function(t){this._deepEventHandler.removeEventListener(t)}},{key:"_integrate",value:function(t){Et(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_integrate",this).call(this,t),this._y=t;var e=this._start;null!==e&&(this._start=null,b(t,e));var n=this._map;this._map=new Map;var r=!0,i=!1,o=void 0;try{for(var a,s=n.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){b(t,a.value)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}}},{key:"_gcChildren",value:function(t){w(t,this._start),this._start=null,this._map.forEach(function(e){w(t,e)}),this._map=new Map}},{key:"_gc",value:function(t){this._gcChildren(t),Et(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_gc",this).call(this,t)}},{key:"_delete",value:function(t,e,n){void 0!==n&&t.gcEnabled||(n=!1===t._hasUndoManager&&t.gcEnabled),Et(Type.prototype.__proto__||Object.getPrototypeOf(Type.prototype),"_delete",this).call(this,t,e,n),t._transaction.changedTypes.delete(this);var r=!0,i=!1,o=void 0;try{for(var a,s=this._map.values()[Symbol.iterator]();!(r=(a=s.next()).done);r=!0){var l=a.value;l instanceof Item&&!l._deleted&&l._delete(t,!1,n)}}catch(t){i=!0,o=t}finally{try{!r&&s.return&&s.return()}finally{if(i)throw o}}for(var u=this._start;null!==u;)u._deleted||u._delete(t,!1,n),u=u._right;n&&this._gcChildren(t)}}]),Type}(Item),ItemJSON=function(t){function ItemJSON(){St(this,ItemJSON);var t=Tt(this,(ItemJSON.__proto__||Object.getPrototypeOf(ItemJSON)).call(this));return t._content=null,t}return Ut(ItemJSON,t),Ot(ItemJSON,[{key:"_copy",value:function(){var t=Et(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Et(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_fromBinary",this).call(this,t,e),r=e.readVarUint();this._content=new Array(r);for(var i=0;i<r;i++){var o=e.readVarString(),a=void 0;a="undefined"===o?void 0:JSON.parse(o),this._content[i]=a}return n}},{key:"_toBinary",value:function(t){Et(ItemJSON.prototype.__proto__||Object.getPrototypeOf(ItemJSON.prototype),"_toBinary",this).call(this,t);var e=this._content.length;t.writeVarUint(e);for(var n=0;n<e;n++){var r=void 0,i=this._content[n];r=void 0===i?"undefined":JSON.stringify(i),t.writeVarString(r)}}},{key:"_logString",value:function(){return y("ItemJSON",this,"content:"+JSON.stringify(this._content))}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemJSON;return n._content=this._content.splice(e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemJSON}(Item),ItemString=function(t){function ItemString(){St(this,ItemString);var t=Tt(this,(ItemString.__proto__||Object.getPrototypeOf(ItemString)).call(this));return t._content=null,t}return Ut(ItemString,t),Ot(ItemString,[{key:"_copy",value:function(){var t=Et(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_copy",this).call(this);return t._content=this._content,t}},{key:"_fromBinary",value:function(t,e){var n=Et(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_fromBinary",this).call(this,t,e);return this._content=e.readVarString(),n}},{key:"_toBinary",value:function(t){Et(ItemString.prototype.__proto__||Object.getPrototypeOf(ItemString.prototype),"_toBinary",this).call(this,t),t.writeVarString(this._content)}},{key:"_logString",value:function(){return y("ItemString",this,'content:"'+this._content+'"')}},{key:"_splitAt",value:function(t,e){if(0===e)return this;if(e>=this._length)return this._right;var n=new ItemString;return n._content=this._content.slice(e),this._content=this._content.slice(0,e),k(t,this,n,e),n}},{key:"_length",get:function(){return this._content.length}}]),ItemString}(Item),YEvent=function(){function YEvent(t){St(this,YEvent),this.target=t,this.currentTarget=t}return Ot(YEvent,[{key:"path",get:function(){return this.currentTarget.getPathTo(this.target)}}]),YEvent}(),YArrayEvent=function(t){function YArrayEvent(t,e,n){St(this,YArrayEvent);var r=Tt(this,(YArrayEvent.__proto__||Object.getPrototypeOf(YArrayEvent)).call(this,t));return r.remote=e,r._transaction=n,r._addedElements=null,r._removedElements=null,r}return Ut(YArrayEvent,t),Ot(YArrayEvent,[{key:"addedElements",get:function(){if(null===this._addedElements){var t=this.target,e=this._transaction,n=new Set;e.newTypes.forEach(function(r){r._parent!==t||e.deletedStructs.has(r)||n.add(r)}),this._addedElements=n}return this._addedElements}},{key:"removedElements",get:function(){if(null===this._removedElements){var t=this.target,e=this._transaction,n=new Set;e.deletedStructs.forEach(function(r){r._parent!==t||e.newTypes.has(r)||n.add(r)}),this._removedElements=n}return this._removedElements}}]),YArrayEvent}(YEvent),YArray=function(t){function YArray(){return St(this,YArray),Tt(this,(YArray.__proto__||Object.getPrototypeOf(YArray)).apply(this,arguments))}return Ut(YArray,t),Ot(YArray,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YArrayEvent(this,n,t))}},{key:"get",value:function(t){for(var e=this._start;null!==e;){if(!e._deleted&&e._countable){if(t<e._length)return e.constructor===ItemJSON||e.constructor===ItemString?e._content[t]:e;t-=e._length}e=e._right}}},{key:"toArray",value:function(){return this.map(function(t){return t})}},{key:"toJSON",value:function(){return this.map(function(t){return t instanceof Type?null!==t.toJSON?t.toJSON():t.toString():t})}},{key:"map",value:function(t){var e=this,n=[];return this.forEach(function(r,i){n.push(t(r,i,e))}),n}},{key:"forEach",value:function(t){for(var e=0,n=this._start;null!==n;){if(!n._deleted&&n._countable)if(n instanceof Type)t(n,e++,this);else for(var r=n._content,i=r.length,o=0;o<i;o++)e++,t(r[o],e,this);n=n._right}}},{key:Symbol.iterator,value:function(){return{next:function(){for(;null!==this._item&&(this._item._deleted||this._item._length<=this._itemElement);)this._item=this._item._right,this._itemElement=0;if(null===this._item)return{done:!0};var t=void 0;return t=this._item instanceof Type?this._item:this._item._content[this._itemElement++],{value:t,done:!1}},_item:this._start,_itemElement:0,_count:0}}},{key:"delete",value:function(t){var e=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1;if(this._y.transact(function(){for(var r=e._start,i=0;null!==r&&n>0;){if(!r._deleted&&r._countable)if(i<=t&&t<i+r._length){var o=t-i;r=r._splitAt(e._y,o),r._splitAt(e._y,n),n-=r._length,r._delete(e._y),i+=o}else i+=r._length;r=r._right}}),n>0)throw new Error("Delete exceeds the range of the YArray")}},{key:"insertAfter",value:function(t,e){var n=this;return this._transact(function(r){var i=void 0;i=null===t?n._start:t._right;for(var o=null,a=0;a<e.length;a++){var s=e[a];"function"==typeof s&&(s=new s),s instanceof Type?(null!==o&&(null!==r&&o._integrate(r),t=o,o=null),s._origin=t,s._left=t,s._right=i,s._right_origin=i,s._parent=n,null!==r?s._integrate(r):null===t?n._start=s:t._right=s,t=s):(null===o&&(o=new ItemJSON,o._origin=t,o._left=t,o._right=i,o._right_origin=i,o._parent=n,o._content=[]),o._content.push(s))}null!==o&&(null!==r?o._integrate(r):null===o._left&&(n._start=o))}),e}},{key:"insert",value:function(t,e){var n=this;this._transact(function(){for(var r=null,i=n._start,o=0,a=n._y;null!==i;){var s=i._deleted?0:i._length-1;if(o<=t&&t<=o+s){var l=t-o;i=i._splitAt(a,l),r=i._left,o+=l;break}i._deleted||(o+=i._length),r=i,i=i._right}if(t>o)throw new Error("Index exceeds array range!");n.insertAfter(r,e)})}},{key:"push",value:function(t){for(var e=this._start,n=null;null!==e;)e._deleted||(n=e),e=e._right;this.insertAfter(n,t)}},{key:"_logString",value:function(){return y("YArray",this,"start:"+p(this._start)+'"')}},{key:"length",get:function(){for(var t=0,e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._length),e=e._right;return t}}]),YArray}(Type),YMapEvent=function(t){function YMapEvent(t,e,n){St(this,YMapEvent);var r=Tt(this,(YMapEvent.__proto__||Object.getPrototypeOf(YMapEvent)).call(this,t));return r.keysChanged=e,r.remote=n,r}return Ut(YMapEvent,t),YMapEvent}(YEvent),YMap=function(t){function YMap(){return St(this,YMap),Tt(this,(YMap.__proto__||Object.getPrototypeOf(YMap)).apply(this,arguments))}return Ut(YMap,t),Ot(YMap,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YMapEvent(this,e,n))}},{key:"toJSON",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Bt(i.value,2),s=a[0],l=a[1];if(!l._deleted){var u=void 0;u=l instanceof Type?void 0!==l.toJSON?l.toJSON():l.toString():l._content[0],t[s]=u}}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"keys",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Bt(i.value,2),s=a[0];a[1]._deleted||t.push(s)}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"delete",value:function(t){var e=this;this._transact(function(n){var r=e._map.get(t);null!==n&&void 0!==r&&r._delete(n)})}},{key:"set",value:function(t,e){var n=this;return this._transact(function(r){var i=n._map.get(t)||null;if(null!==i){if(i.constructor===ItemJSON&&!i._deleted&&i._content[0]===e)return e;null!==r&&i._delete(r)}var o=void 0;"function"==typeof e?(o=new e,e=o):e instanceof Item?o=e:(o=new ItemJSON,o._content=[e]),o._right=i,o._right_origin=i,o._parent=n,o._parentSub=t,null!==r?o._integrate(r):n._map.set(t,o)}),e}},{key:"get",value:function(t){var e=this._map.get(t);if(void 0!==e&&!e._deleted)return e instanceof Type?e:e._content[e._content.length-1]}},{key:"has",value:function(t){var e=this._map.get(t);return void 0!==e&&!e._deleted}},{key:"_logString",value:function(){return y("YMap",this,"mapSize:"+this._map.size)}}]),YMap}(Type),Rt=function(t){function e(){St(this,e);var t=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.embed=null,t}return Ut(e,t),Ot(e,[{key:"_copy",value:function(t,n){var r=Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.embed=this.embed,r}},{key:"_fromBinary",value:function(t,n){var r=Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.embed=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(JSON.stringify(this.embed))}},{key:"_logString",value:function(){return y("ItemEmbed",this,"embed:"+JSON.stringify(this.embed))}},{key:"_length",get:function(){return 1}}]),e}(Item),Wt=function(t){function e(){St(this,e);var t=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return t.key=null,t.value=null,t}return Ut(e,t),Ot(e,[{key:"_copy",value:function(t,n){var r=Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_copy",this).call(this,t,n);return r.key=this.key,r.value=this.value,r}},{key:"_fromBinary",value:function(t,n){var r=Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_fromBinary",this).call(this,t,n);return this.key=n.readVarString(),this.value=JSON.parse(n.readVarString()),r}},{key:"_toBinary",value:function(t){Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.key),t.writeVarString(JSON.stringify(this.value))}},{key:"_logString",value:function(){return y("ItemFormat",this,"key:"+JSON.stringify(this.key)+",value:"+JSON.stringify(this.value))}},{key:"_length",get:function(){return 1}},{key:"_countable",get:function(){return!1}}]),e}(Item),Ht=function(t){function e(t,n,r){St(this,e);var i=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n,r));return i._delta=null,i}return Ut(e,t),Ot(e,[{key:"delta",get:function(){var t=this;if(null===this._delta){var e=this.target._y;e.transact(function(){var n=t.target._start,r=[],i=t.addedElements,o=t.removedElements;t._delta=r;for(var a=null,s={},l=new Map,u=new Map,c="",h=0,f=0,d=function(){if(null!==a){var t=void 0;switch(a){case"delete":t={delete:f},f=0;break;case"insert":if(t={insert:c},l.size>0){t.attributes={};var e=!0,n=!1,i=void 0;try{for(var o,u=l[Symbol.iterator]();!(e=(o=u.next()).done);e=!0){var d=Bt(o.value,2),_=d[0],v=d[1];null!==v&&(t.attributes[_]=v)}}catch(t){n=!0,i=t}finally{try{!e&&u.return&&u.return()}finally{if(n)throw i}}}c="";break;case"retain":if(t={retain:h},Object.keys(s).length>0){t.attributes={};for(var _ in s)t.attributes[_]=s[_]}h=0}r.push(t),a=null}};null!==n;){switch(n.constructor){case Rt:i.has(n)?(d(),a="insert",c=n.embed,d()):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=1):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=1);break;case ItemString:i.has(n)?("insert"!==a&&(d(),a="insert"),c+=n._content):o.has(n)?("delete"!==a&&(d(),a="delete"),f+=n._length):!1===n._deleted&&("retain"!==a&&(d(),a="retain"),h+=n._length);break;case Wt:if(i.has(n)){(l.get(n.key)||null)!==n.value?("retain"===a&&d(),n.value===(u.get(n.key)||null)?delete s[n.key]:s[n.key]=n.value):n._delete(e)}else if(o.has(n)){u.set(n.key,n.value);var _=l.get(n.key)||null;_!==n.value&&("retain"===a&&d(),s[n.key]=_)}else if(!1===n._deleted){u.set(n.key,n.value);var v=s[n.key];void 0!==v&&(v!==n.value?("retain"===a&&d(),null===n.value?s[n.key]=n.value:delete s[n.key]):n._delete(e))}!1===n._deleted&&("insert"===a&&d(),T(l,n))}n=n._right}for(d();t._delta.length>0;){var p=t._delta[t._delta.length-1];if(void 0===p.retain||void 0!==p.attributes)break;t._delta.pop()}})}return this._delta}}]),e}(YArrayEvent),YText=function(t){function YText(t){St(this,YText);var e=Tt(this,(YText.__proto__||Object.getPrototypeOf(YText)).call(this));if("string"==typeof t){var n=new ItemString;n._parent=e,n._content=t,e._start=n}return e}return Ut(YText,t),Ot(YText,[{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new Ht(this,n,t))}},{key:"toString",value:function(){for(var t="",e=this._start;null!==e;)!e._deleted&&e._countable&&(t+=e._content),e=e._right;return t}},{key:"applyDelta",value:function(t){var e=this;this._transact(function(n){for(var r=null,i=e._start,o=new Map,a=0;a<t.length;a++){var s=t[a];if(void 0!==s.insert){var l=x(n,s.insert,e,r,i,o,s.attributes||{}),u=Bt(l,2);r=u[0],i=u[1]}else if(void 0!==s.retain){var c=I(n,s.retain,e,r,i,o,s.attributes||{}),h=Bt(c,2);r=h[0],i=h[1]}else if(void 0!==s.delete){var f=D(n,s.delete,e,r,i,o),d=Bt(f,2);r=d[0],i=d[1]}}})}},{key:"toDelta",value:function(){function t(){if(r.length>0){var t={},i=!1,o=!0,a=!1,s=void 0;try{for(var l,u=n[Symbol.iterator]();!(o=(l=u.next()).done);o=!0){var c=Bt(l.value,2),h=c[0],f=c[1];i=!0,t[h]=f}}catch(t){a=!0,s=t}finally{try{!o&&u.return&&u.return()}finally{if(a)throw s}}var d={insert:r};i&&(d.attributes=t),e.push(d),r=""}}for(var e=[],n=new Map,r="",i=this._start;null!==i;){if(!i._deleted)switch(i.constructor){case ItemString:r+=i._content;break;case Wt:t(),T(n,i)}i=i._right}return t(),e}},{key:"insert",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};e.length<=0||this._transact(function(i){var o=E(n,t),a=Bt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"insertEmbed",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(e.constructor!==Object)throw new Error("Embed must be an Object");this._transact(function(i){var o=E(n,t),a=Bt(o,3),s=a[0],l=a[1],u=a[2];x(i,e,n,s,l,u,r)})}},{key:"delete",value:function(t,e){var n=this;0!==e&&this._transact(function(r){var i=E(n,t),o=Bt(i,3),a=o[0],s=o[1],l=o[2];D(r,e,n,a,s,l)})}},{key:"format",value:function(t,e,n){var r=this;this._transact(function(i){var o=E(r,t),a=Bt(o,3),s=a[0],l=a[1],u=a[2];null!==l&&I(i,e,r,s,l,u,n)})}},{key:"_logString",value:function(){return y("YText",this)}}]),YText}(YArray),YXmlHook=function(t){function YXmlHook(t){St(this,YXmlHook);var e=Tt(this,(YXmlHook.__proto__||Object.getPrototypeOf(YXmlHook)).call(this));return e.hookName=null,void 0!==t&&(e.hookName=t),e}return Ut(YXmlHook,t),Ot(YXmlHook,[{key:"_copy",value:function(){var t=Et(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_copy",this).call(this);return t.hookName=this.hookName,t}},{key:"toDom",value:function(){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},e=arguments[2],n=t[this.hookName],r=void 0;return r=void 0!==n?n.createDom(this):document.createElement(this.hookName),r.setAttribute("data-yjs-hook",this.hookName),R(e,r,this),r}},{key:"_fromBinary",value:function(t,e){var n=Et(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_fromBinary",this).call(this,t,e);return this.hookName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Et(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.hookName)}},{key:"_integrate",value:function(t){if(null===this.hookName)throw new Error("hookName must be defined!");Et(YXmlHook.prototype.__proto__||Object.getPrototypeOf(YXmlHook.prototype),"_integrate",this).call(this,t)}}]),YXmlHook}(YMap),Jt=function(){function t(e,n){St(this,t),this._filter=n||function(){return!0},this._root=e,this._currentNode=e,this._firstCall=!0}return Ot(t,[{key:Symbol.iterator,value:function(){return this}},{key:"next",value:function(){var t=this._currentNode;if(this._firstCall&&(this._firstCall=!1,!t._deleted&&this._filter(t)))return{value:t,done:!1};do{if(t._deleted||t.constructor!==YXmlFragment._YXmlElement&&t.constructor!==YXmlFragment||null===t._start){for(;t!==this._root;){if(null!==t._right){t=t._right;break}t=t._parent}t===this._root&&(t=null)}else t=t._start;if(t===this._root)break}while(null!==t&&(t._deleted||!this._filter(t)));return this._currentNode=t,null===t?{done:!0}:{value:t,done:!1}}}]),t}(),YXmlEvent=function(t){function YXmlEvent(t,e,n,r){St(this,YXmlEvent);var i=Tt(this,(YXmlEvent.__proto__||Object.getPrototypeOf(YXmlEvent)).call(this,t));return i._transaction=r,i.childListChanged=!1,i.attributesChanged=new Set,i.remote=n,e.forEach(function(t){null===t?i.childListChanged=!0:i.attributesChanged.add(t)}),i}return Ut(YXmlEvent,t),YXmlEvent}(YEvent),YXmlFragment=function(t){function YXmlFragment(){return St(this,YXmlFragment),Tt(this,(YXmlFragment.__proto__||Object.getPrototypeOf(YXmlFragment)).apply(this,arguments))}return Ut(YXmlFragment,t),Ot(YXmlFragment,[{key:"createTreeWalker",value:function(t){return new Jt(this,t)}},{key:"querySelector",value:function(t){t=t.toUpperCase();var e=new Jt(this,function(e){return e.nodeName===t}),n=e.next();return n.done?null:n.value}},{key:"querySelectorAll",value:function(t){return t=t.toUpperCase(),Array.from(new Jt(this,function(e){return e.nodeName===t}))}},{key:"_callObserver",value:function(t,e,n){this._callEventHandler(t,new YXmlEvent(this,e,n,t))}},{key:"toString",value:function(){return this.map(function(t){return t.toString()}).join("")}},{key:"_delete",value:function(t,e,n){Et(YXmlFragment.prototype.__proto__||Object.getPrototypeOf(YXmlFragment.prototype),"_delete",this).call(this,t,e,n)}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createDocumentFragment();return R(n,r,this),this.forEach(function(i){r.insertBefore(i.toDom(t,e,n),null)}),r}},{key:"_logString",value:function(){return y("YXml",this)}}]),YXmlFragment}(YArray),YXmlElement=function(t){function YXmlElement(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"UNDEFINED";St(this,YXmlElement);var e=Tt(this,(YXmlElement.__proto__||Object.getPrototypeOf(YXmlElement)).call(this));return e.nodeName=t.toUpperCase(),e}return Ut(YXmlElement,t),Ot(YXmlElement,[{key:"_copy",value:function(){var t=Et(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_copy",this).call(this);return t.nodeName=this.nodeName,t}},{key:"_fromBinary",value:function(t,e){var n=Et(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_fromBinary",this).call(this,t,e);return this.nodeName=e.readVarString(),n}},{key:"_toBinary",value:function(t){Et(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_toBinary",this).call(this,t),t.writeVarString(this.nodeName)}},{key:"_integrate",value:function(t){if(null===this.nodeName)throw new Error("nodeName must be defined!");Et(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"_integrate",this).call(this,t)}},{key:"toString",value:function(){var t=this.getAttributes(),e=[],n=[];for(var r in t)n.push(r);n.sort();for(var i=n.length,o=0;o<i;o++){var a=n[o];e.push(a+'="'+t[a]+'"')}var s=this.nodeName.toLocaleLowerCase();return"<"+s+(e.length>0?" "+e.join(" "):"")+">"+Et(YXmlElement.prototype.__proto__||Object.getPrototypeOf(YXmlElement.prototype),"toString",this).call(this)+"</"+s+">"}},{key:"removeAttribute",value:function(t){return YMap.prototype.delete.call(this,t)}},{key:"setAttribute",value:function(t,e){return YMap.prototype.set.call(this,t,e)}},{key:"getAttribute",value:function(t){return YMap.prototype.get.call(this,t)}},{key:"getAttributes",value:function(){var t={},e=!0,n=!1,r=void 0;try{for(var i,o=this._map[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Bt(i.value,2),s=a[0],l=a[1];l._deleted||(t[s]=l._content[0])}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}return t}},{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments[2],r=t.createElement(this.nodeName),i=this.getAttributes();for(var o in i)r.setAttribute(o,i[o]);return this.forEach(function(i){r.appendChild(i.toDom(t,e,n))}),R(n,r,this),r}}]),YXmlElement}(YXmlFragment);YXmlFragment._YXmlElement=YXmlElement;var YXmlText=function(t){function YXmlText(){return St(this,YXmlText),Tt(this,(YXmlText.__proto__||Object.getPrototypeOf(YXmlText)).apply(this,arguments))}return Ut(YXmlText,t),Ot(YXmlText,[{key:"toDom",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:document,e=arguments[2],n=t.createTextNode(this.toString());return R(e,n,this),n}},{key:"_delete",value:function(t,e,n){Et(YXmlText.prototype.__proto__||Object.getPrototypeOf(YXmlText.prototype),"_delete",this).call(this,t,e,n)}}]),YXmlText}(YText),zt=new Map,Yt=new Map;q(0,ItemJSON),q(1,ItemString),q(10,Wt),q(11,Rt),q(2,Delete),q(3,YArray),q(4,YMap),q(5,YText),q(6,YXmlFragment),q(7,YXmlElement),q(8,YXmlText),q(9,YXmlHook),q(12,jt);var Xt=16777215,qt=function(){function t(e,n){St(this,t),this.user=Xt,this.name=e,this.type=$(n)}return Ot(t,[{key:"equals",value:function(t){return null!==t&&t.user===this.user&&t.name===this.name&&t.type===this.type}},{key:"lessThan",value:function(e){return e.constructor!==t||(this.user<e.user||this.user===e.user&&(this.name<e.name||this.name===e.name&&this.type<e.type))}}]),t}(),Ft=function(t){function e(t){St(this,e);var n=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this));return n.y=t,n}return Ut(e,t),Ot(e,[{key:"logTable",value:function(){var t=[];this.iterate(null,null,function(e){e.constructor===jt?t.push({id:p(e),content:e._length,deleted:"GC"}):t.push({id:p(e),origin:p(null===e._origin?null:e._origin._lastId),left:p(null===e._left?null:e._left._lastId),right:p(e._right),right_origin:p(e._right_origin),parent:p(e._parent),parentSub:e._parentSub,deleted:e._deleted,content:JSON.stringify(e._content)})}),console.table(t)}},{key:"get",value:function(t){var e=this.find(t);if(null===e&&t instanceof qt){var n=F(t.type),r=this.y;e=new n,e._id=t,e._parent=r,r.transact(function(){e._integrate(r)}),this.put(e)}return e}},{key:"getItem",value:function(t){var e=this.findWithUpperBound(t);if(null===e)return null;var n=e._id;return t.user===n.user&&t.clock<n.clock+e._length?e:null}},{key:"getItemCleanStart",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock===t.clock?e:e._splitAt(this.y,t.clock-n.clock)}},{key:"getItemCleanEnd",value:function(t){var e=this.getItem(t);if(null===e||1===e._length)return e;var n=e._id;return n.clock+e._length-1===t.clock?e:(e._splitAt(this.y,t.clock-n.clock+1),e)}}]),e}(xt),$t=function(){function t(e){St(this,t),this.y=e,this.state=new Map}return Ot(t,[{key:"logTable",value:function(){var t=[],e=!0,n=!1,r=void 0;try{for(var i,o=this.state[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){var a=Bt(i.value,2),s=a[0],l=a[1];t.push({user:s,state:l})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}console.table(t)}},{key:"getNextID",value:function(t){var e=this.y.userID,n=this.getState(e);return this.setState(e,n+t),new It(e,n)}},{key:"updateRemoteState",value:function(t){for(var e=t._id.user,n=this.state.get(e);null!==t&&t._id.clock===n;)n+=t._length,t=this.y.os.get(new It(e,n))
;this.state.set(e,n)}},{key:"getState",value:function(t){var e=this.state.get(t);return null==e?0:e}},{key:"setState",value:function(t,e){var n=this.y._transaction.beforeState;n.has(t)||n.set(t,this.getState(t)),this.state.set(t,e)}}]),t}(),Gt=function(){function t(){St(this,t),this._eventListener=new Map,this._stateListener=new Map}return Ot(t,[{key:"_getListener",value:function(t){var e=this._eventListener.get(t);return void 0===e&&(e={once:new Set,on:new Set},this._eventListener.set(t,e)),e}},{key:"once",value:function(t,e){this._getListener(t).once.add(e)}},{key:"on",value:function(t,e){this._getListener(t).on.add(e)}},{key:"_initStateListener",value:function(t){var e=this._stateListener.get(t);return void 0===e&&(e={},e.promise=new Promise(function(t){e.resolve=t}),this._stateListener.set(t,e)),e}},{key:"when",value:function(t){return this._initStateListener(t).promise}},{key:"off",value:function(t,e){if(null==t||null==e)throw new Error("You must specify event name and function!");var n=this._eventListener.get(t);void 0!==n&&(n.on.delete(e),n.once.delete(e))}},{key:"emit",value:function(t){for(var e=arguments.length,n=Array(e>1?e-1:0),r=1;r<e;r++)n[r-1]=arguments[r];this._initStateListener(t).resolve();var i=this._eventListener.get(t);void 0!==i?(i.on.forEach(function(t){return t.apply(null,n)}),i.once.forEach(function(t){return t.apply(null,n)}),i.once=new Set):"error"===t&&console.error(n[0])}},{key:"destroy",value:function(){this._eventListener=null}}]),t}(),Zt=function(){function t(e,n){St(this,t),this.type=e,this.target=n,this._mutualExclude=K()}return Ot(t,[{key:"destroy",value:function(){this.type=null,this.target=null}}]),t}(),Qt=null,Kt="undefined"!=typeof getSelection?tt:function(){return null},te=function(t){function e(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};St(this,e);var i=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));i.opts=r,r.document=r.document||document,r.hooks=r.hooks||{},i.scrollingElement=r.scrollingElement||null,i.domToType=new Map,i.typeToDom=new Map,i.filter=r.filter||N,n.innerHTML="",t.forEach(function(t){n.insertBefore(t.toDom(r.document,r.hooks,i),null)}),i._typeObserver=ot.bind(i),i._domObserver=function(t){lt.call(i,t,r.document)},t.observeDeep(i._typeObserver),i._mutationObserver=new MutationObserver(i._domObserver),i._mutationObserver.observe(n,{childList:!0,attributes:!0,characterData:!0,subtree:!0}),i._currentSel=null,document.addEventListener("selectionchange",function(){i._currentSel=Kt(i)});var o=t._y;return i.y=o,i._beforeTransactionHandler=function(t,e,n){i._domObserver(i._mutationObserver.takeRecords()),i._mutualExclude(function(){et(i,n)})},o.on("beforeTransaction",i._beforeTransactionHandler),i._afterTransactionHandler=function(t,e,n){i._mutualExclude(function(){nt(i,n)}),e.deletedStructs.forEach(function(t){var e=i.typeToDom.get(t);void 0!==e&&M(i,e,t)})},o.on("afterTransaction",i._afterTransactionHandler),i._beforeObserverCallsHandler=function(t,e){e.changedTypes.forEach(function(e,n){(e.size>1||1===e.size&&!1===e.has(null))&&V(t,i,n)}),e.newTypes.forEach(function(e){V(t,i,e)})},o.on("beforeObserverCalls",i._beforeObserverCallsHandler),R(i,n,t),i}return Ut(e,t),Ot(e,[{key:"setFilter",value:function(t){this.filter=t}},{key:"_getUndoStackInfo",value:function(){return this.getSelection()}},{key:"_restoreUndoStackInfo",value:function(t){this.restoreSelection(t)}},{key:"getSelection",value:function(){return this._currentSel}},{key:"restoreSelection",value:function(t){if(null!==t){var e=t.to,n=t.from,r=!1,i=getSelection(),o=i.baseNode,a=i.baseOffset,s=i.extentNode,l=i.extentOffset;if(null!==n){var u=Q(this.y,n);if(null!==u){var c=this.typeToDom.get(u.type),h=u.offset;c===o&&h===a||(o=c,a=h,r=!0)}}if(null!==e){var f=Q(this.y,e);if(null!==f){var d=this.typeToDom.get(f.type),_=f.offset;d===s&&_===l||(s=d,l=_,r=!0)}}r&&i.setBaseAndExtent(o,a,s,l)}}},{key:"destroy",value:function(){this.domToType=null,this.typeToDom=null,this.type.unobserveDeep(this._typeObserver),this._mutationObserver.disconnect();var t=this.type._y;t.off("beforeTransaction",this._beforeTransactionHandler),t.off("beforeObserverCalls",this._beforeObserverCallsHandler),t.off("afterTransaction",this._afterTransactionHandler),Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Zt),Y=function(t){function Y(t,e,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{};St(this,Y);var i=Tt(this,(Y.__proto__||Object.getPrototypeOf(Y)).call(this));i.gcEnabled=r.gc||!1,i.room=t,null!=e&&(e.connector.room=t),i._contentReady=!1,i._opts=e,"number"!=typeof e.userID?i.userID=G():i.userID=e.userID,i.share={},i.ds=new Pt(i),i.os=new Ft(i),i.ss=new $t(i),i._missingStructs=new Map,i._readyToIntegrate=[],i._transaction=null,i.connector=null,i.connected=!1;var o=function(){null!=e&&(i.connector=new Y[e.connector.name](i,e.connector),i.connected=!0,i.emit("connectorReady"))};return i.persistence=null,null!=n?(i.persistence=n,n._init(i).then(o)):o(),i._parent=null,i._hasUndoManager=!1,i}return Ut(Y,t),Ot(Y,[{key:"_setContentReady",value:function(){this._contentReady||(this._contentReady=!0,this.emit("content"))}},{key:"whenContentReady",value:function(){var t=this;return this._contentReady?Promise.resolve():new Promise(function(e){t.once("content",e)})}},{key:"_beforeChange",value:function(){}},{key:"transact",value:function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=null===this._transaction;n&&(this._transaction=new Ct(this),this.emit("beforeTransaction",this,this._transaction,e));try{t(this)}catch(t){console.error(t)}if(n){this.emit("beforeObserverCalls",this,this._transaction,e);var r=this._transaction;this._transaction=null,r.changedTypes.forEach(function(t,n){n._deleted||n._callObserver(r,t,e)}),r.changedParentTypes.forEach(function(t,e){e._deleted||(t=t.filter(function(t){return!t.target._deleted}),t.forEach(function(t){t.currentTarget=e}),e._deepEventHandler.callEventListeners(r,t))}),this.emit("afterTransaction",this,r,e)}}},{key:"define",value:function(t,e){var n=new qt(t,e),r=this.os.get(n);if(void 0===this.share[t])this.share[t]=r;else if(this.share[t]!==r)throw new Error("Type is already defined with a different constructor");return r}},{key:"get",value:function(t){return this.share[t]}},{key:"disconnect",value:function(){return this.connected?(this.connected=!1,this.connector.disconnect()):Promise.resolve()}},{key:"reconnect",value:function(){return this.connected?Promise.resolve():(this.connected=!0,this.connector.reconnect())}},{key:"destroy",value:function(){Et(Y.prototype.__proto__||Object.getPrototypeOf(Y.prototype),"destroy",this).call(this),this.share=null,null!=this.connector&&(null!=this.connector.destroy?this.connector.destroy():this.connector.disconnect()),null!==this.persistence&&(this.persistence.deinit(this),this.persistence=null),this.os=null,this.ds=null,this.ss=null}},{key:"_start",get:function(){return null},set:function(t){return null}}]),Y}(Gt);Y.extend=function(){for(var t=0;t<arguments.length;t++){var e=arguments[t];if("function"!=typeof e)throw new Error("Expected a function!");e(Y)}};var ee=function t(e,n,r){var i=this;St(this,t),this.created=new Date;var o=n.beforeState;o.has(e.userID)?(this.toState=new It(e.userID,e.ss.getState(e.userID)-1),this.fromState=new It(e.userID,o.get(e.userID))):(this.toState=null,this.fromState=null),this.deletedStructs=new Set,n.deletedStructs.forEach(function(t){i.deletedStructs.add({from:t._id,len:t._length})}),this.bindingInfos=r},ne=function(){function t(e){var n=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};St(this,t),this.options=r,this._bindings=new Set(r.bindings),r.captureTimeout=null==r.captureTimeout?500:r.captureTimeout,this._undoBuffer=[],this._redoBuffer=[],this._scope=e,this._undoing=!1,this._redoing=!1,this._lastTransactionWasUndo=!1;var i=e._y;this.y=i,i._hasUndoManager=!0;var o=void 0;i.on("beforeTransaction",function(t,e,r){r||(o=new Map,n._bindings.forEach(function(t){o.set(t,t._getUndoStackInfo())}))}),i.on("afterTransaction",function(t,i,a){if(!a&&i.changedParentTypes.has(e)){var s=new ee(t,i,o);if(n._undoing)n._lastTransactionWasUndo=!0,n._redoBuffer.push(s);else{var l=n._undoBuffer.length>0?n._undoBuffer[n._undoBuffer.length-1]:null;!1===n._redoing&&!1===n._lastTransactionWasUndo&&null!==l&&(r.captureTimeout<0||s.created-l.created<=r.captureTimeout)?(l.created=s.created,null!==s.toState&&(l.toState=s.toState,null===l.fromState&&(l.fromState=s.fromState)),s.deletedStructs.forEach(l.deletedStructs.add,l.deletedStructs)):(n._lastTransactionWasUndo=!1,n._undoBuffer.push(s)),n._redoing||(n._redoBuffer=[])}}})}return Ot(t,[{key:"flushChanges",value:function(){this._lastTransactionWasUndo=!0}},{key:"undo",value:function(){this._undoing=!0;var t=ut(this.y,this._scope,this._undoBuffer);return this._undoing=!1,t}},{key:"redo",value:function(){this._redoing=!0;var t=ut(this.y,this._scope,this._redoBuffer);return this._redoing=!1,t}}]),t}(),re=1e3,ie=60*re,oe=60*ie,ae=24*oe,se=365.25*ae,le=function(t,e){e=e||{};var n=void 0===t?"undefined":wt(t);if("string"===n&&t.length>0)return ht(t);if("number"===n&&!1===isNaN(t))return e.long?dt(t):ft(t);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(t))},ue=Object.freeze({default:le,__moduleExports:le}),ce=ue&&le||ue,he=ct(function(t,e){function n(t){var n,r=0;for(n in t)r=(r<<5)-r+t.charCodeAt(n),r|=0;return e.colors[Math.abs(r)%e.colors.length]}function r(t){function r(){if(r.enabled){var t=r,n=+new Date,i=n-(l||n);t.diff=i,t.prev=l,t.curr=n,l=n;for(var o=new Array(arguments.length),a=0;a<o.length;a++)o[a]=arguments[a];o[0]=e.coerce(o[0]),"string"!=typeof o[0]&&o.unshift("%O");var s=0;o[0]=o[0].replace(/%([a-zA-Z%])/g,function(n,r){if("%%"===n)return n;s++;var i=e.formatters[r];if("function"==typeof i){var a=o[s];n=i.call(t,a),o.splice(s,1),s--}return n}),e.formatArgs.call(t,o);(r.log||e.log||console.log.bind(console)).apply(t,o)}}return r.namespace=t,r.enabled=e.enabled(t),r.useColors=e.useColors(),r.color=n(t),"function"==typeof e.init&&e.init(r),r}function i(t){e.save(t),e.names=[],e.skips=[];for(var n=("string"==typeof t?t:"").split(/[\s,]+/),r=n.length,i=0;i<r;i++)n[i]&&(t=n[i].replace(/\*/g,".*?"),"-"===t[0]?e.skips.push(new RegExp("^"+t.substr(1)+"$")):e.names.push(new RegExp("^"+t+"$")))}function o(){e.enable("")}function a(t){var n,r;for(n=0,r=e.skips.length;n<r;n++)if(e.skips[n].test(t))return!1;for(n=0,r=e.names.length;n<r;n++)if(e.names[n].test(t))return!0;return!1}function s(t){return t instanceof Error?t.stack||t.message:t}e=t.exports=r.debug=r.default=r,e.coerce=s,e.disable=o,e.enable=i,e.enabled=a,e.humanize=ce,e.names=[],e.skips=[],e.formatters={};var l}),fe=he.coerce,de=he.disable,_e=he.enable,ve=he.enabled,pe=he.humanize,ye=he.names,ge=he.skips,me=he.formatters,ke=Object.freeze({default:he,__moduleExports:he,coerce:fe,disable:de,enable:_e,enabled:ve,humanize:pe,names:ye,skips:ge,formatters:me}),be=ke&&he||ke,we=ct(function(t,e){function n(){return!("undefined"==typeof window||!window.process||"renderer"!==window.process.type)||("undefined"!=typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"undefined"!=typeof window&&window.console&&(window.console.firebug||window.console.exception&&window.console.table)||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))}function r(t){var n=this.useColors;if(t[0]=(n?"%c":"")+this.namespace+(n?" %c":" ")+t[0]+(n?"%c ":" ")+"+"+e.humanize(this.diff),n){var r="color: "+this.color;t.splice(1,0,r,"color: inherit");var i=0,o=0;t[0].replace(/%[a-zA-Z%]/g,function(t){"%%"!==t&&(i++,"%c"===t&&(o=i))}),t.splice(o,0,r)}}function i(){return"object"===("undefined"==typeof console?"undefined":wt(console))&&console.log&&Function.prototype.apply.call(console.log,console,arguments)}function o(t){try{null==t?e.storage.removeItem("debug"):e.storage.debug=t}catch(t){}}function a(){var t;try{t=e.storage.debug}catch(t){}return!t&&"undefined"!=typeof process&&"env"in process&&(t=process.env.DEBUG),t}e=t.exports=be,e.log=i,e.formatArgs=r,e.save=o,e.load=a,e.useColors=n,e.storage="undefined"!=typeof chrome&&void 0!==chrome.storage?chrome.storage.local:function(){try{return window.localStorage}catch(t){}}(),e.colors=["lightseagreen","forestgreen","goldenrod","dodgerblue","darkorchid","crimson"],e.formatters.j=function(t){try{return JSON.stringify(t)}catch(t){return"[UnexpectedJSONParseError]: "+t.message}},e.enable(a())}),Se=(we.log,we.formatArgs,we.save,we.load,we.useColors,we.storage,we.colors,function(){function t(e,n){if(St(this,t),this.y=e,this.opts=n,null==n.role||"master"===n.role)this.role="master";else{if("slave"!==n.role)throw new Error("Role must be either 'master' or 'slave'!");this.role="slave"}this.log=we("y:connector"),this.logMessage=we("y:connector-message"),this._forwardAppliedStructs=n.forwardAppliedOperations||!1,this.role=n.role,this.connections=new Map,this.isSynced=!1,this.userEventListeners=[],this.whenSyncedListeners=[],this.currentSyncTarget=null,this.debug=!0===n.debug,this.broadcastBuffer=new Lt,this.broadcastBufferSize=0,this.protocolVersion=11,this.authInfo=n.auth||null,this.checkAuth=n.checkAuth||function(){return Promise.resolve("write")},null==n.maxBufferLength?this.maxBufferLength=-1:this.maxBufferLength=n.maxBufferLength}return Ot(t,[{key:"reconnect",value:function(){this.log("reconnecting..")}},{key:"disconnect",value:function(){return this.log("discronnecting.."),this.connections=new Map,this.isSynced=!1,this.currentSyncTarget=null,this.whenSyncedListeners=[],Promise.resolve()}},{key:"onUserEvent",value:function(t){this.userEventListeners.push(t)}},{key:"removeUserEventListener",value:function(t){this.userEventListeners=this.userEventListeners.filter(function(e){return t!==e})}},{key:"userLeft",value:function(t){if(this.connections.has(t)){this.log("%s: User left %s",this.y.userID,t),this.connections.delete(t),this._setSyncedWith(null);var e=!0,n=!1,r=void 0;try{for(var i,o=this.userEventListeners[Symbol.iterator]();!(e=(i=o.next()).done);e=!0){(0,i.value)({action:"userLeft",user:t})}}catch(t){n=!0,r=t}finally{try{!e&&o.return&&o.return()}finally{if(n)throw r}}}}},{key:"userJoined",value:function(t,e,n){if(null==e)throw new Error("You must specify the role of the joined user!");if(this.connections.has(t))throw new Error("This user already joined!");this.log("%s: User joined %s",this.y.userID,t),this.connections.set(t,{uid:t,isSynced:!1,role:e,processAfterAuth:[],processAfterSync:[],auth:n||null,receivedSyncStep2:!1});var r={};r.promise=new Promise(function(t){r.resolve=t}),this.connections.get(t).syncStep2=r;var i=!0,o=!1,a=void 0;try{for(var s,l=this.userEventListeners[Symbol.iterator]();!(i=(s=l.next()).done);i=!0){(0,s.value)({action:"userJoined",user:t,role:e})}}catch(t){o=!0,a=t}finally{try{!i&&l.return&&l.return()}finally{if(o)throw a}}this._syncWithUser(t)}},{key:"whenSynced",value:function(t){this.isSynced?t():this.whenSyncedListeners.push(t)}},{key:"_syncWithUser",value:function(t){"slave"!==this.role&&u(this,t)}},{key:"_fireIsSyncedListeners",value:function(){if(!this.isSynced){this.isSynced=!0;var t=!0,e=!1,n=void 0;try{for(var r,i=this.whenSyncedListeners[Symbol.iterator]();!(t=(r=i.next()).done);t=!0){(0,r.value)()}}catch(t){e=!0,n=t}finally{try{!t&&i.return&&i.return()}finally{if(e)throw n}}this.whenSyncedListeners=[],this.y._setContentReady(),this.y.emit("synced")}}},{key:"send",value:function(t,e){var n=this.y;if(!(e instanceof ArrayBuffer||e instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s to User%s: Send '%y'",n.userID,t,e),this.logMessage("User%s to User%s: Send %Y",n.userID,t,[n,e])}},{key:"broadcast",value:function(t){var e=this.y;if(!(t instanceof ArrayBuffer||t instanceof Uint8Array))throw new Error("Expected Message to be an ArrayBuffer or Uint8Array - don't use this method to send custom messages");this.log("User%s: Broadcast '%y'",e.userID,t),this.logMessage("User%s: Broadcast: %Y",e.userID,[e,t])}},{key:"broadcastStruct",value:function(t){var e=this,n=0===this.broadcastBuffer.length;if(n&&(this.broadcastBuffer.writeVarString(this.y.room),this.broadcastBuffer.writeVarString("update"),this.broadcastBufferSize=0,this.broadcastBufferSizePos=this.broadcastBuffer.pos,this.broadcastBuffer.writeUint32(0)),this.broadcastBufferSize++,t._toBinary(this.broadcastBuffer),this.maxBufferLength>0&&this.broadcastBuffer.length>this.maxBufferLength){var r=this.broadcastBuffer;r.setUint32(this.broadcastBufferSizePos,this.broadcastBufferSize),this.broadcastBuffer=new Lt,this.whenRemoteResponsive().then(function(){e.broadcast(r.createBuffer())})}else n&&setTimeout(function(){if(e.broadcastBuffer.length>0){var t=e.broadcastBuffer;t.setUint32(e.broadcastBufferSizePos,e.broadcastBufferSize),e.broadcast(t.createBuffer()),e.broadcastBuffer=new Lt}},0)}},{key:"whenRemoteResponsive",value:function(){return new Promise(function(t){setTimeout(t,100)})}},{key:"receiveMessage",value:function(t,e,n){var r=this,i=this.y,o=i.userID;if(n=n||!1,!(e instanceof ArrayBuffer||e instanceof Uint8Array))return Promise.reject(new Error("Expected Message to be an ArrayBuffer or Uint8Array!"));if(t===o)return Promise.resolve();var a=new Nt(e),s=new Lt,l=a.readVarString();s.writeVarString(l);var u=a.readVarString(),c=this.connections.get(t);if(this.log("User%s from User%s: Receive '%s'",o,t,u),this.logMessage("User%s from User%s: Receive %Y",o,t,[i,e]),null==c&&!n)throw new Error("Received message from unknown peer!");if("sync step 1"===u||"sync step 2"===u){var h=a.readVarUint();if(null==c.auth)return c.processAfterAuth.push([u,c,a,s,t]),this.checkAuth(h,i,t).then(function(t){null==c.auth&&(c.auth=t,i.emit("userAuthenticated",{user:c.uid,auth:t}));var e=c.processAfterAuth;c.processAfterAuth=[],e.forEach(function(t){return r.computeMessage(t[0],t[1],t[2],t[3],t[4])})})}!n&&null==c.auth||"update"===u&&!c.isSynced?c.processAfterSync.push([u,c,a,s,t,!1]):this.computeMessage(u,c,a,s,t,n)}},{key:"computeMessage",value:function(t,e,n,i,o,a){if("sync step 1"!==t||"write"!==e.auth&&"read"!==e.auth){var s=this.y;s.transact(function(){if("sync step 2"===t&&"write"===e.auth)d(n,i,s,e,o);else{if("update"!==t||!a&&"write"!==e.auth)throw new Error("Unable to receive message");r(s,n)}},!0)}else h(n,i,this.y,e,o)}},{key:"_setSyncedWith",value:function(t){var e=this;if(null!=t){var n=this.connections.get(t);n.isSynced=!0;var r=n.processAfterSync;n.processAfterSync=[],r.forEach(function(t){e.computeMessage(t[0],t[1],t[2],t[3],t[4])})}var i=Array.from(this.connections.values());i.length>0&&i.every(function(t){return t.isSynced})&&this._fireIsSyncedListeners()}}]),t}()),Oe=function(){function t(e){St(this,t),this.opts=e,this.ys=new Map}return Ot(t,[{key:"_init",value:function(t){var e=this,n=this.ys.get(t);return void 0===n?(n=yt(),n.mutualExclude=K(),this.ys.set(t,n),this.init(t).then(function(){return t.on("afterTransaction",function(t,n){var r=e.ys.get(t);if(r.len>0){r.buffer.setUint32(0,r.len),e.saveUpdate(t,r.buffer.createBuffer(),n);var i=yt();for(var o in i)r[o]=i[o]}}),e.retrieve(t)}).then(function(){return Promise.resolve(n)})):Promise.resolve(n)}},{key:"deinit",value:function(t){this.ys.delete(t),t.persistence=null}},{key:"destroy",value:function(){this.ys=null}},{key:"removePersistedData",value:function(t){var e=this,n=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];this.ys.forEach(function(r,i){i.room===t&&(n?i.destroy():e.deinit(i))})}},{key:"saveUpdate",value:function(t){}},{key:"saveStruct",value:function(t,e){var n=this.ys.get(t);void 0!==n&&n.mutualExclude(function(){e._toBinary(n.buffer),n.len++})}},{key:"retrieve",value:function(t,e,n){var i=this.ys.get(t);void 0!==i&&i.mutualExclude(function(){t.transact(function(){if(null!=e&&vt(t,new Nt(new Uint8Array(e))),null!=n)for(var i=0;i<n.length;i++)r(t,new Nt(new Uint8Array(n[i])))}),t.emit("persistenceReady")})}},{key:"persist",value:function(t){return pt(t).createBuffer()}}]),t}(),Ee=function(t){function e(t,n){St(this,e);var r=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.value=t.toString(),r._typeObserver=gt.bind(r),r._domObserver=mt.bind(r),t.observe(r._typeObserver),n.addEventListener("input",r._domObserver),r}return Ut(e,t),Ot(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.unobserve(this._domObserver),Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Zt),Ue=function(t){function e(t,n){St(this,e);var r=Tt(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t,n));return n.setContents(t.toDelta(),"yjs"),r._typeObserver=kt.bind(r),r._quillObserver=bt.bind(r),t.observe(r._typeObserver),n.on("text-change",r._quillObserver),r}return Ut(e,t),Ot(e,[{key:"destroy",value:function(){this.type.unobserve(this._typeObserver),this.target.off("text-change",this._quillObserver),Et(e.prototype.__proto__||Object.getPrototypeOf(e.prototype),"destroy",this).call(this)}}]),e}(Zt);return Y.AbstractConnector=Se,Y.AbstractPersistence=Oe,Y.Array=YArray,Y.Map=YMap,Y.Text=YText,Y.XmlElement=YXmlElement,Y.XmlFragment=YXmlFragment,Y.XmlText=YXmlText,Y.XmlHook=YXmlHook,Y.TextareaBinding=Ee,Y.QuillBinding=Ue,Y.DomBinding=te,te.domToType=L,te.domsToTypes=J,te.switchAssociation=W,Y.utils={BinaryDecoder:Nt,UndoManager:ne,getRelativePosition:Z,fromRelativePosition:Q,registerStruct:q,integrateRemoteStructs:r,toBinary:pt,fromBinary:vt},Y.debug=we,we.formatters.Y=_,we.formatters.y=v,Y});


}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":4,"buffer":2}],7:[function(require,module,exports){
var Y = require('yjs');
window.Y = Y;
require('y-webrtc3')(Y);

var url = new URL(window.location.href);
var yid = url.searchParams.get("id");
var y = new Y(yid, {
    connector: {
        name: 'webrtc',
        room: yid,
        url: 'http://finplane.io:1256'
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMveS13ZWJydGMuanMiLCJub2RlX21vZHVsZXMveWpzL3kuanMiLCJzcmMveW5vdGVib29rLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbnZhciBjb2RlID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5mb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gIHJldkxvb2t1cFtjb2RlLmNoYXJDb2RlQXQoaSldID0gaVxufVxuXG4vLyBTdXBwb3J0IGRlY29kaW5nIFVSTC1zYWZlIGJhc2U2NCBzdHJpbmdzLCBhcyBOb2RlLmpzIGRvZXMuXG4vLyBTZWU6IGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jhc2U2NCNVUkxfYXBwbGljYXRpb25zXG5yZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbnJldkxvb2t1cFsnXycuY2hhckNvZGVBdCgwKV0gPSA2M1xuXG5mdW5jdGlvbiBnZXRMZW5zIChiNjQpIHtcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gVHJpbSBvZmYgZXh0cmEgYnl0ZXMgYWZ0ZXIgcGxhY2Vob2xkZXIgYnl0ZXMgYXJlIGZvdW5kXG4gIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2JlYXRnYW1taXQvYmFzZTY0LWpzL2lzc3Vlcy80MlxuICB2YXIgdmFsaWRMZW4gPSBiNjQuaW5kZXhPZignPScpXG4gIGlmICh2YWxpZExlbiA9PT0gLTEpIHZhbGlkTGVuID0gbGVuXG5cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IHZhbGlkTGVuID09PSBsZW5cbiAgICA/IDBcbiAgICA6IDQgLSAodmFsaWRMZW4gJSA0KVxuXG4gIHJldHVybiBbdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbl1cbn1cblxuLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChiNjQpIHtcbiAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NClcbiAgdmFyIHZhbGlkTGVuID0gbGVuc1swXVxuICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXVxuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gX2J5dGVMZW5ndGggKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikge1xuICByZXR1cm4gKCh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCkgLSBwbGFjZUhvbGRlcnNMZW5cbn1cblxuZnVuY3Rpb24gdG9CeXRlQXJyYXkgKGI2NCkge1xuICB2YXIgdG1wXG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cblxuICB2YXIgYXJyID0gbmV3IEFycihfYnl0ZUxlbmd0aChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pKVxuXG4gIHZhciBjdXJCeXRlID0gMFxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgdmFyIGxlbiA9IHBsYWNlSG9sZGVyc0xlbiA+IDBcbiAgICA/IHZhbGlkTGVuIC0gNFxuICAgIDogdmFsaWRMZW5cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8XG4gICAgICByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMikge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDEpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPVxuICAgICAgKCh1aW50OFtpXSA8PCAxNikgJiAweEZGMDAwMCkgK1xuICAgICAgKCh1aW50OFtpICsgMV0gPDwgOCkgJiAweEZGMDApICtcbiAgICAgICh1aW50OFtpICsgMl0gJiAweEZGKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKFxuICAgICAgdWludDgsIGksIChpICsgbWF4Q2h1bmtMZW5ndGgpID4gbGVuMiA/IGxlbjIgOiAoaSArIG1heENodW5rTGVuZ3RoKVxuICAgICkpXG4gIH1cblxuICAvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG4gIGlmIChleHRyYUJ5dGVzID09PSAxKSB7XG4gICAgdG1wID0gdWludDhbbGVuIC0gMV1cbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgbG9va3VwW3RtcCA+PiAyXSArXG4gICAgICBsb29rdXBbKHRtcCA8PCA0KSAmIDB4M0ZdICtcbiAgICAgICc9PSdcbiAgICApXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArIHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMTBdICtcbiAgICAgIGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXSArXG4gICAgICAnPSdcbiAgICApXG4gIH1cblxuICByZXR1cm4gcGFydHMuam9pbignJylcbn1cbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGh0dHBzOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuXG52YXIgS19NQVhfTEVOR1RIID0gMHg3ZmZmZmZmZlxuZXhwb3J0cy5rTWF4TGVuZ3RoID0gS19NQVhfTEVOR1RIXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFByaW50IHdhcm5pbmcgYW5kIHJlY29tbWVuZCB1c2luZyBgYnVmZmVyYCB2NC54IHdoaWNoIGhhcyBhbiBPYmplY3RcbiAqICAgICAgICAgICAgICAgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIFdlIHJlcG9ydCB0aGF0IHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGlmIHRoZSBhcmUgbm90IHN1YmNsYXNzYWJsZVxuICogdXNpbmcgX19wcm90b19fLiBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YFxuICogKFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4KS4gSUUgMTAgbGFja3Mgc3VwcG9ydFxuICogZm9yIF9fcHJvdG9fXyBhbmQgaGFzIGEgYnVnZ3kgdHlwZWQgYXJyYXkgaW1wbGVtZW50YXRpb24uXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5pZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBjb25zb2xlLmVycm9yID09PSAnZnVuY3Rpb24nKSB7XG4gIGNvbnNvbGUuZXJyb3IoXG4gICAgJ1RoaXMgYnJvd3NlciBsYWNrcyB0eXBlZCBhcnJheSAoVWludDhBcnJheSkgc3VwcG9ydCB3aGljaCBpcyByZXF1aXJlZCBieSAnICtcbiAgICAnYGJ1ZmZlcmAgdjUueC4gVXNlIGBidWZmZXJgIHY0LnggaWYgeW91IHJlcXVpcmUgb2xkIGJyb3dzZXIgc3VwcG9ydC4nXG4gIClcbn1cblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICAvLyBDYW4gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWQ/XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLl9fcHJvdG9fXyA9IHtfX3Byb3RvX186IFVpbnQ4QXJyYXkucHJvdG90eXBlLCBmb286IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH19XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDJcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAncGFyZW50Jywge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5idWZmZXJcbiAgfVxufSlcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlci5wcm90b3R5cGUsICdvZmZzZXQnLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ5dGVPZmZzZXRcbiAgfVxufSlcblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKGxlbmd0aCA+IEtfTUFYX0xFTkdUSCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgYnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGJ1ZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIGlmICh0eXBlb2YgZW5jb2RpbmdPck9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0lmIGVuY29kaW5nIGlzIHNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJ1xuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gYWxsb2NVbnNhZmUoYXJnKVxuICB9XG4gIHJldHVybiBmcm9tKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgQnVmZmVyW1N5bWJvbC5zcGVjaWVzXSA9PT0gQnVmZmVyKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgIHdyaXRhYmxlOiBmYWxzZVxuICB9KVxufVxuXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxuZnVuY3Rpb24gZnJvbSAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cblxuICBpZiAoaXNBcnJheUJ1ZmZlcih2YWx1ZSkgfHwgKHZhbHVlICYmIGlzQXJyYXlCdWZmZXIodmFsdWUuYnVmZmVyKSkpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KVxuICB9XG5cbiAgcmV0dXJuIGZyb21PYmplY3QodmFsdWUpXG59XG5cbi8qKlxuICogRnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdG8gQnVmZmVyKGFyZywgZW5jb2RpbmcpIGJ1dCB0aHJvd3MgYSBUeXBlRXJyb3JcbiAqIGlmIHZhbHVlIGlzIGEgbnVtYmVyLlxuICogQnVmZmVyLmZyb20oc3RyWywgZW5jb2RpbmddKVxuICogQnVmZmVyLmZyb20oYXJyYXkpXG4gKiBCdWZmZXIuZnJvbShidWZmZXIpXG4gKiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlclssIGJ5dGVPZmZzZXRbLCBsZW5ndGhdXSlcbiAqKi9cbkJ1ZmZlci5mcm9tID0gZnVuY3Rpb24gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGZyb20odmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuLy8gTm90ZTogQ2hhbmdlIHByb3RvdHlwZSAqYWZ0ZXIqIEJ1ZmZlci5mcm9tIGlzIGRlZmluZWQgdG8gd29ya2Fyb3VuZCBDaHJvbWUgYnVnOlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC8xNDhcbkJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbkJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG5cbmZ1bmN0aW9uIGFzc2VydFNpemUgKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSBudW1iZXInKVxuICB9IGVsc2UgaWYgKHNpemUgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1wic2l6ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIG5lZ2F0aXZlJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcihzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2Moc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlIChzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbn1cblxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIEJ1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIFNsb3dCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbmd0aClcblxuICB2YXIgYWN0dWFsID0gYnVmLndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG5cbiAgaWYgKGFjdHVhbCAhPT0gbGVuZ3RoKSB7XG4gICAgLy8gV3JpdGluZyBhIGhleCBzdHJpbmcsIGZvciBleGFtcGxlLCB0aGF0IGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycyB3aWxsXG4gICAgLy8gY2F1c2UgZXZlcnl0aGluZyBhZnRlciB0aGUgZmlyc3QgaW52YWxpZCBjaGFyYWN0ZXIgdG8gYmUgaWdub3JlZC4gKGUuZy5cbiAgICAvLyAnYWJ4eGNkJyB3aWxsIGJlIHRyZWF0ZWQgYXMgJ2FiJylcbiAgICBidWYgPSBidWYuc2xpY2UoMCwgYWN0dWFsKVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlIChhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgYnVmW2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJvZmZzZXRcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcImxlbmd0aFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICB2YXIgYnVmXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbilcblxuICAgIGlmIChidWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYnVmXG4gICAgfVxuXG4gICAgb2JqLmNvcHkoYnVmLCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIGJ1ZlxuICB9XG5cbiAgaWYgKG9iaikge1xuICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcob2JqKSB8fCAnbGVuZ3RoJyBpbiBvYmopIHtcbiAgICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgbnVtYmVySXNOYU4ob2JqLmxlbmd0aCkpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcigwKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqKVxuICAgIH1cblxuICAgIGlmIChvYmoudHlwZSA9PT0gJ0J1ZmZlcicgJiYgQXJyYXkuaXNBcnJheShvYmouZGF0YSkpIHtcbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iai5kYXRhKVxuICAgIH1cbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIG9uZSBvZiB0eXBlIHN0cmluZywgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQXJyYXksIG9yIEFycmF5LWxpa2UgT2JqZWN0LicpXG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBLX01BWF9MRU5HVEhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIEtfTUFYX0xFTkdUSC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuIGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlciA9PT0gdHJ1ZVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhidWYpKSB7XG4gICAgICBidWYgPSBCdWZmZXIuZnJvbShidWYpXG4gICAgfVxuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gICAgfVxuICAgIGJ1Zi5jb3B5KGJ1ZmZlciwgcG9zKVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gIH1cbiAgaWYgKEFycmF5QnVmZmVyLmlzVmlldyhzdHJpbmcpIHx8IGlzQXJyYXlCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoaXMgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCAoYW5kIHRoZSBgaXMtYnVmZmVyYCBucG0gcGFja2FnZSlcbi8vIHRvIGRldGVjdCBhIEJ1ZmZlciBpbnN0YW5jZS4gSXQncyBub3QgcG9zc2libGUgdG8gdXNlIGBpbnN0YW5jZW9mIEJ1ZmZlcmBcbi8vIHJlbGlhYmx5IGluIGEgYnJvd3NlcmlmeSBjb250ZXh0IGJlY2F1c2UgdGhlcmUgY291bGQgYmUgbXVsdGlwbGUgZGlmZmVyZW50XG4vLyBjb3BpZXMgb2YgdGhlICdidWZmZXInIHBhY2thZ2UgaW4gdXNlLiBUaGlzIG1ldGhvZCB3b3JrcyBldmVuIGZvciBCdWZmZXJcbi8vIGluc3RhbmNlcyB0aGF0IHdlcmUgY3JlYXRlZCBmcm9tIGFub3RoZXIgY29weSBvZiB0aGUgYGJ1ZmZlcmAgcGFja2FnZS5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvaXNzdWVzLzE1NFxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwNjQgPSBmdW5jdGlvbiBzd2FwNjQgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDggIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDY0LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDgpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyA3KVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyA2KVxuICAgIHN3YXAodGhpcywgaSArIDIsIGkgKyA1KVxuICAgIHN3YXAodGhpcywgaSArIDMsIGkgKyA0KVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0xvY2FsZVN0cmluZyA9IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmdcblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgIC8vIENvZXJjZSB0byBOdW1iZXIuXG4gIGlmIChudW1iZXJJc05hTihieXRlT2Zmc2V0KSkge1xuICAgIC8vIGJ5dGVPZmZzZXQ6IGl0IGl0J3MgdW5kZWZpbmVkLCBudWxsLCBOYU4sIFwiZm9vXCIsIGV0Yywgc2VhcmNoIHdob2xlIGJ1ZmZlclxuICAgIGJ5dGVPZmZzZXQgPSBkaXIgPyAwIDogKGJ1ZmZlci5sZW5ndGggLSAxKVxuICB9XG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXQ6IG5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCArIGJ5dGVPZmZzZXRcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgIGlmIChkaXIpIHJldHVybiAtMVxuICAgIGVsc2UgYnl0ZU9mZnNldCA9IGJ1ZmZlci5sZW5ndGggLSAxXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA8IDApIHtcbiAgICBpZiAoZGlyKSBieXRlT2Zmc2V0ID0gMFxuICAgIGVsc2UgcmV0dXJuIC0xXG4gIH1cblxuICAvLyBOb3JtYWxpemUgdmFsXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICAvLyBGaW5hbGx5LCBzZWFyY2ggZWl0aGVyIGluZGV4T2YgKGlmIGRpciBpcyB0cnVlKSBvciBsYXN0SW5kZXhPZlxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChkaXIpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggIT09IC0xKSBpIC09IGkgLSBmb3VuZEluZGV4XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYnl0ZU9mZnNldCArIHZhbExlbmd0aCA+IGFyckxlbmd0aCkgYnl0ZU9mZnNldCA9IGFyckxlbmd0aCAtIHZhbExlbmd0aFxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgZm91bmQgPSB0cnVlXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbExlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChyZWFkKGFyciwgaSArIGopICE9PSByZWFkKHZhbCwgaikpIHtcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZvdW5kKSByZXR1cm4gaVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgdHJ1ZSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uIGxhc3RJbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBmYWxzZSlcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChudW1iZXJJc05hTihwYXJzZWQpKSByZXR1cm4gaVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gbGF0aW4xV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCA+Pj4gMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0J1ZmZlci53cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXRbLCBsZW5ndGhdKSBpcyBubyBsb25nZXIgc3VwcG9ydGVkJ1xuICAgIClcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gbGF0aW4xU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIChieXRlc1tpICsgMV0gKiAyNTYpKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsICg4ICogYnl0ZUxlbmd0aCkgLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgaWYgKHZhbHVlIDwgMCAmJiBzdWIgPT09IDAgJiYgdGhpc1tvZmZzZXQgKyBpICsgMV0gIT09IDApIHtcbiAgICAgIHN1YiA9IDFcbiAgICB9XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdhcmd1bWVudCBzaG91bGQgYmUgYSBCdWZmZXInKVxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiB0eXBlb2YgVWludDhBcnJheS5wcm90b3R5cGUuY29weVdpdGhpbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8vIFVzZSBidWlsdC1pbiB3aGVuIGF2YWlsYWJsZSwgbWlzc2luZyBmcm9tIElFMTFcbiAgICB0aGlzLmNvcHlXaXRoaW4odGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpXG4gIH0gZWxzZSBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKHZhciBpID0gbGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIFVpbnQ4QXJyYXkucHJvdG90eXBlLnNldC5jYWxsKFxuICAgICAgdGFyZ2V0LFxuICAgICAgdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBVc2FnZTpcbi8vICAgIGJ1ZmZlci5maWxsKG51bWJlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoYnVmZmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChzdHJpbmdbLCBvZmZzZXRbLCBlbmRdXVssIGVuY29kaW5nXSlcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbCwgc3RhcnQsIGVuZCwgZW5jb2RpbmcpIHtcbiAgLy8gSGFuZGxlIHN0cmluZyBjYXNlczpcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gc3RhcnRcbiAgICAgIHN0YXJ0ID0gMFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuZFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9XG4gICAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5jb2RpbmcgbXVzdCBiZSBhIHN0cmluZycpXG4gICAgfVxuICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHZhciBjb2RlID0gdmFsLmNoYXJDb2RlQXQoMClcbiAgICAgIGlmICgoZW5jb2RpbmcgPT09ICd1dGY4JyAmJiBjb2RlIDwgMTI4KSB8fFxuICAgICAgICAgIGVuY29kaW5nID09PSAnbGF0aW4xJykge1xuICAgICAgICAvLyBGYXN0IHBhdGg6IElmIGB2YWxgIGZpdHMgaW50byBhIHNpbmdsZSBieXRlLCB1c2UgdGhhdCBudW1lcmljIHZhbHVlLlxuICAgICAgICB2YWwgPSBjb2RlXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMjU1XG4gIH1cblxuICAvLyBJbnZhbGlkIHJhbmdlcyBhcmUgbm90IHNldCB0byBhIGRlZmF1bHQsIHNvIGNhbiByYW5nZSBjaGVjayBlYXJseS5cbiAgaWYgKHN0YXJ0IDwgMCB8fCB0aGlzLmxlbmd0aCA8IHN0YXJ0IHx8IHRoaXMubGVuZ3RoIDwgZW5kKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghdmFsKSB2YWwgPSAwXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgdGhpc1tpXSA9IHZhbFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuaXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogbmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBpZiAobGVuID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgdmFsdWUgXCInICsgdmFsICtcbiAgICAgICAgJ1wiIGlzIGludmFsaWQgZm9yIGFyZ3VtZW50IFwidmFsdWVcIicpXG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teKy8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgdGFrZXMgZXF1YWwgc2lnbnMgYXMgZW5kIG9mIHRoZSBCYXNlNjQgZW5jb2RpbmdcbiAgc3RyID0gc3RyLnNwbGl0KCc9JylbMF1cbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0ci50cmltKCkucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG4vLyBBcnJheUJ1ZmZlcnMgZnJvbSBhbm90aGVyIGNvbnRleHQgKGkuZS4gYW4gaWZyYW1lKSBkbyBub3QgcGFzcyB0aGUgYGluc3RhbmNlb2ZgIGNoZWNrXG4vLyBidXQgdGhleSBzaG91bGQgYmUgdHJlYXRlZCBhcyB2YWxpZC4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9pc3N1ZXMvMTY2XG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyIChvYmopIHtcbiAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIEFycmF5QnVmZmVyIHx8XG4gICAgKG9iaiAhPSBudWxsICYmIG9iai5jb25zdHJ1Y3RvciAhPSBudWxsICYmIG9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSAnQXJyYXlCdWZmZXInICYmXG4gICAgICB0eXBlb2Ygb2JqLmJ5dGVMZW5ndGggPT09ICdudW1iZXInKVxufVxuXG5mdW5jdGlvbiBudW1iZXJJc05hTiAob2JqKSB7XG4gIHJldHVybiBvYmogIT09IG9iaiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSAoZSAqIDI1NikgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSAobSAqIDI1NikgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gKG5CeXRlcyAqIDgpIC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICgodmFsdWUgKiBjKSAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIlxuLyoqXG4gKiB5LXdlYnJ0YzMgLSBcbiAqIEB2ZXJzaW9uIHYyLjQuMFxuICogQGxpY2Vuc2UgTUlUXG4gKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLnl3ZWJydGMgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cblx0dmFyIGNvbW1vbmpzR2xvYmFsID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB7fTtcblxuXHRmdW5jdGlvbiBjcmVhdGVDb21tb25qc01vZHVsZShmbiwgbW9kdWxlKSB7XG5cdFx0cmV0dXJuIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfSwgZm4obW9kdWxlLCBtb2R1bGUuZXhwb3J0cyksIG1vZHVsZS5leHBvcnRzO1xuXHR9XG5cblx0LyoqXHJcblx0ICogUGFyc2VzIGFuIFVSSVxyXG5cdCAqXHJcblx0ICogQGF1dGhvciBTdGV2ZW4gTGV2aXRoYW4gPHN0ZXZlbmxldml0aGFuLmNvbT4gKE1JVCBsaWNlbnNlKVxyXG5cdCAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAqL1xuXG5cdHZhciByZSA9IC9eKD86KD8hW146QF0rOlteOkBcXC9dKkApKGh0dHB8aHR0cHN8d3N8d3NzKTpcXC9cXC8pPygoPzooKFteOkBdKikoPzo6KFteOkBdKikpPyk/QCk/KCg/OlthLWYwLTldezAsNH06KXsyLDd9W2EtZjAtOV17MCw0fXxbXjpcXC8/I10qKSg/OjooXFxkKikpPykoKChcXC8oPzpbXj8jXSg/IVtePyNcXC9dKlxcLltePyNcXC8uXSsoPzpbPyNdfCQpKSkqXFwvPyk/KFtePyNcXC9dKikpKD86XFw/KFteI10qKSk/KD86IyguKikpPykvO1xuXG5cdHZhciBwYXJ0cyA9IFsnc291cmNlJywgJ3Byb3RvY29sJywgJ2F1dGhvcml0eScsICd1c2VySW5mbycsICd1c2VyJywgJ3Bhc3N3b3JkJywgJ2hvc3QnLCAncG9ydCcsICdyZWxhdGl2ZScsICdwYXRoJywgJ2RpcmVjdG9yeScsICdmaWxlJywgJ3F1ZXJ5JywgJ2FuY2hvciddO1xuXG5cdHZhciBwYXJzZXVyaSA9IGZ1bmN0aW9uIHBhcnNldXJpKHN0cikge1xuXHQgICAgdmFyIHNyYyA9IHN0cixcblx0ICAgICAgICBiID0gc3RyLmluZGV4T2YoJ1snKSxcblx0ICAgICAgICBlID0gc3RyLmluZGV4T2YoJ10nKTtcblxuXHQgICAgaWYgKGIgIT0gLTEgJiYgZSAhPSAtMSkge1xuXHQgICAgICAgIHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgYikgKyBzdHIuc3Vic3RyaW5nKGIsIGUpLnJlcGxhY2UoLzovZywgJzsnKSArIHN0ci5zdWJzdHJpbmcoZSwgc3RyLmxlbmd0aCk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBtID0gcmUuZXhlYyhzdHIgfHwgJycpLFxuXHQgICAgICAgIHVyaSA9IHt9LFxuXHQgICAgICAgIGkgPSAxNDtcblxuXHQgICAgd2hpbGUgKGktLSkge1xuXHQgICAgICAgIHVyaVtwYXJ0c1tpXV0gPSBtW2ldIHx8ICcnO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoYiAhPSAtMSAmJiBlICE9IC0xKSB7XG5cdCAgICAgICAgdXJpLnNvdXJjZSA9IHNyYztcblx0ICAgICAgICB1cmkuaG9zdCA9IHVyaS5ob3N0LnN1YnN0cmluZygxLCB1cmkuaG9zdC5sZW5ndGggLSAxKS5yZXBsYWNlKC87L2csICc6Jyk7XG5cdCAgICAgICAgdXJpLmF1dGhvcml0eSA9IHVyaS5hdXRob3JpdHkucmVwbGFjZSgnWycsICcnKS5yZXBsYWNlKCddJywgJycpLnJlcGxhY2UoLzsvZywgJzonKTtcblx0ICAgICAgICB1cmkuaXB2NnVyaSA9IHRydWU7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiB1cmk7XG5cdH07XG5cblx0dmFyIHBhcnNldXJpJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcGFyc2V1cmksXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwYXJzZXVyaVxuXHR9KTtcblxuXHR2YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikge1xuXHQgIHJldHVybiB0eXBlb2Ygb2JqO1xuXHR9IDogZnVuY3Rpb24gKG9iaikge1xuXHQgIHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sICYmIG9iaiAhPT0gU3ltYm9sLnByb3RvdHlwZSA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqO1xuXHR9O1xuXG5cdHZhciBjbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcblx0ICBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkge1xuXHQgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTtcblx0ICB9XG5cdH07XG5cblx0dmFyIGNyZWF0ZUNsYXNzID0gZnVuY3Rpb24gKCkge1xuXHQgIGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuXHQgICAgICB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldO1xuXHQgICAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG5cdCAgICAgIGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTtcblx0ICAgICAgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTtcblx0ICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG5cdCAgICBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuXHQgICAgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7XG5cdCAgICByZXR1cm4gQ29uc3RydWN0b3I7XG5cdCAgfTtcblx0fSgpO1xuXG5cdHZhciBpbmhlcml0cyA9IGZ1bmN0aW9uIChzdWJDbGFzcywgc3VwZXJDbGFzcykge1xuXHQgIGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gXCJmdW5jdGlvblwiICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHtcblx0ICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiICsgdHlwZW9mIHN1cGVyQ2xhc3MpO1xuXHQgIH1cblxuXHQgIHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwge1xuXHQgICAgY29uc3RydWN0b3I6IHtcblx0ICAgICAgdmFsdWU6IHN1YkNsYXNzLFxuXHQgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcblx0ICAgICAgd3JpdGFibGU6IHRydWUsXG5cdCAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuXHQgICAgfVxuXHQgIH0pO1xuXHQgIGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzcztcblx0fTtcblxuXHR2YXIgcG9zc2libGVDb25zdHJ1Y3RvclJldHVybiA9IGZ1bmN0aW9uIChzZWxmLCBjYWxsKSB7XG5cdCAgaWYgKCFzZWxmKSB7XG5cdCAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGNhbGwgJiYgKHR5cGVvZiBjYWxsID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBjYWxsID09PSBcImZ1bmN0aW9uXCIpID8gY2FsbCA6IHNlbGY7XG5cdH07XG5cblx0LyoqXG5cdCAqIEhlbHBlcnMuXG5cdCAqL1xuXG5cdHZhciBzID0gMTAwMDtcblx0dmFyIG0gPSBzICogNjA7XG5cdHZhciBoID0gbSAqIDYwO1xuXHR2YXIgZCA9IGggKiAyNDtcblx0dmFyIHkgPSBkICogMzY1LjI1O1xuXG5cdC8qKlxuXHQgKiBQYXJzZSBvciBmb3JtYXQgdGhlIGdpdmVuIGB2YWxgLlxuXHQgKlxuXHQgKiBPcHRpb25zOlxuXHQgKlxuXHQgKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSB2YWxcblx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuXHQgKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcblx0ICogQHJldHVybiB7U3RyaW5nfE51bWJlcn1cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIG1zID0gZnVuY3Rpb24gbXModmFsLCBvcHRpb25zKSB7XG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdCAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih2YWwpO1xuXHQgIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuXHQgICAgcmV0dXJuIHBhcnNlKHZhbCk7XG5cdCAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTih2YWwpID09PSBmYWxzZSkge1xuXHQgICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG5cdCAgfVxuXHQgIHRocm93IG5ldyBFcnJvcigndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICsgSlNPTi5zdHJpbmdpZnkodmFsKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFBhcnNlIHRoZSBnaXZlbiBgc3RyYCBhbmQgcmV0dXJuIG1pbGxpc2Vjb25kcy5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0clxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBwYXJzZShzdHIpIHtcblx0ICBzdHIgPSBTdHJpbmcoc3RyKTtcblx0ICBpZiAoc3RyLmxlbmd0aCA+IDEwMCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHN0cik7XG5cdCAgaWYgKCFtYXRjaCkge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuXHQgIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG5cdCAgc3dpdGNoICh0eXBlKSB7XG5cdCAgICBjYXNlICd5ZWFycyc6XG5cdCAgICBjYXNlICd5ZWFyJzpcblx0ICAgIGNhc2UgJ3lycyc6XG5cdCAgICBjYXNlICd5cic6XG5cdCAgICBjYXNlICd5Jzpcblx0ICAgICAgcmV0dXJuIG4gKiB5O1xuXHQgICAgY2FzZSAnZGF5cyc6XG5cdCAgICBjYXNlICdkYXknOlxuXHQgICAgY2FzZSAnZCc6XG5cdCAgICAgIHJldHVybiBuICogZDtcblx0ICAgIGNhc2UgJ2hvdXJzJzpcblx0ICAgIGNhc2UgJ2hvdXInOlxuXHQgICAgY2FzZSAnaHJzJzpcblx0ICAgIGNhc2UgJ2hyJzpcblx0ICAgIGNhc2UgJ2gnOlxuXHQgICAgICByZXR1cm4gbiAqIGg7XG5cdCAgICBjYXNlICdtaW51dGVzJzpcblx0ICAgIGNhc2UgJ21pbnV0ZSc6XG5cdCAgICBjYXNlICdtaW5zJzpcblx0ICAgIGNhc2UgJ21pbic6XG5cdCAgICBjYXNlICdtJzpcblx0ICAgICAgcmV0dXJuIG4gKiBtO1xuXHQgICAgY2FzZSAnc2Vjb25kcyc6XG5cdCAgICBjYXNlICdzZWNvbmQnOlxuXHQgICAgY2FzZSAnc2Vjcyc6XG5cdCAgICBjYXNlICdzZWMnOlxuXHQgICAgY2FzZSAncyc6XG5cdCAgICAgIHJldHVybiBuICogcztcblx0ICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG5cdCAgICBjYXNlICdtaWxsaXNlY29uZCc6XG5cdCAgICBjYXNlICdtc2Vjcyc6XG5cdCAgICBjYXNlICdtc2VjJzpcblx0ICAgIGNhc2UgJ21zJzpcblx0ICAgICAgcmV0dXJuIG47XG5cdCAgICBkZWZhdWx0OlxuXHQgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXHQgIH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBmbXRTaG9ydChtcykge1xuXHQgIGlmIChtcyA+PSBkKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGQpICsgJ2QnO1xuXHQgIH1cblx0ICBpZiAobXMgPj0gaCkge1xuXHQgICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBoKSArICdoJztcblx0ICB9XG5cdCAgaWYgKG1zID49IG0pIHtcblx0ICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gbSkgKyAnbSc7XG5cdCAgfVxuXHQgIGlmIChtcyA+PSBzKSB7XG5cdCAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIHMpICsgJ3MnO1xuXHQgIH1cblx0ICByZXR1cm4gbXMgKyAnbXMnO1xuXHR9XG5cblx0LyoqXG5cdCAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuXHQgKlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbXNcblx0ICogQHJldHVybiB7U3RyaW5nfVxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0ZnVuY3Rpb24gZm10TG9uZyhtcykge1xuXHQgIHJldHVybiBwbHVyYWwobXMsIGQsICdkYXknKSB8fCBwbHVyYWwobXMsIGgsICdob3VyJykgfHwgcGx1cmFsKG1zLCBtLCAnbWludXRlJykgfHwgcGx1cmFsKG1zLCBzLCAnc2Vjb25kJykgfHwgbXMgKyAnIG1zJztcblx0fVxuXG5cdC8qKlxuXHQgKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cblx0ICovXG5cblx0ZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG5cdCAgaWYgKG1zIDwgbikge1xuXHQgICAgcmV0dXJuO1xuXHQgIH1cblx0ICBpZiAobXMgPCBuICogMS41KSB7XG5cdCAgICByZXR1cm4gTWF0aC5mbG9vcihtcyAvIG4pICsgJyAnICsgbmFtZTtcblx0ICB9XG5cdCAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcblx0fVxuXG5cdHZhciBtcyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IG1zLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogbXNcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDAgPSAoIG1zJDEgJiYgbXMgKSB8fCBtcyQxO1xuXG5cdHZhciBkZWJ1ZyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKipcblx0ICAgKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG5cdCAgICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cblx0ICAgKlxuXHQgICAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZURlYnVnLmRlYnVnID0gY3JlYXRlRGVidWdbJ2RlZmF1bHQnXSA9IGNyZWF0ZURlYnVnO1xuXHQgIGV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuXHQgIGV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5cdCAgZXhwb3J0cy5lbmFibGUgPSBlbmFibGU7XG5cdCAgZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcblx0ICBleHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSQkMDtcblxuXHQgIC8qKlxuXHQgICAqIEFjdGl2ZSBgZGVidWdgIGluc3RhbmNlcy5cblx0ICAgKi9cblx0ICBleHBvcnRzLmluc3RhbmNlcyA9IFtdO1xuXG5cdCAgLyoqXG5cdCAgICogVGhlIGN1cnJlbnRseSBhY3RpdmUgZGVidWcgbW9kZSBuYW1lcywgYW5kIG5hbWVzIHRvIHNraXAuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLm5hbWVzID0gW107XG5cdCAgZXhwb3J0cy5za2lwcyA9IFtdO1xuXG5cdCAgLyoqXG5cdCAgICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuXHQgICAqXG5cdCAgICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXIgb3IgdXBwZXItY2FzZSBsZXR0ZXIsIGkuZS4gXCJuXCIgYW5kIFwiTlwiLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5mb3JtYXR0ZXJzID0ge307XG5cblx0ICAvKipcblx0ICAgKiBTZWxlY3QgYSBjb2xvci5cblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG5cdCAgICogQHJldHVybiB7TnVtYmVyfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gc2VsZWN0Q29sb3IobmFtZXNwYWNlKSB7XG5cdCAgICB2YXIgaGFzaCA9IDAsXG5cdCAgICAgICAgaTtcblxuXHQgICAgZm9yIChpIGluIG5hbWVzcGFjZSkge1xuXHQgICAgICBoYXNoID0gKGhhc2ggPDwgNSkgLSBoYXNoICsgbmFtZXNwYWNlLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgIGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG5cdCAgICB9XG5cblx0ICAgIHJldHVybiBleHBvcnRzLmNvbG9yc1tNYXRoLmFicyhoYXNoKSAlIGV4cG9ydHMuY29sb3JzLmxlbmd0aF07XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG5cdCAgICogQHJldHVybiB7RnVuY3Rpb259XG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGNyZWF0ZURlYnVnKG5hbWVzcGFjZSkge1xuXG5cdCAgICB2YXIgcHJldlRpbWU7XG5cblx0ICAgIGZ1bmN0aW9uIGRlYnVnKCkge1xuXHQgICAgICAvLyBkaXNhYmxlZD9cblx0ICAgICAgaWYgKCFkZWJ1Zy5lbmFibGVkKSByZXR1cm47XG5cblx0ICAgICAgdmFyIHNlbGYgPSBkZWJ1ZztcblxuXHQgICAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuXHQgICAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuXHQgICAgICB2YXIgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuXHQgICAgICBzZWxmLmRpZmYgPSBtcztcblx0ICAgICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG5cdCAgICAgIHNlbGYuY3VyciA9IGN1cnI7XG5cdCAgICAgIHByZXZUaW1lID0gY3VycjtcblxuXHQgICAgICAvLyB0dXJuIHRoZSBgYXJndW1lbnRzYCBpbnRvIGEgcHJvcGVyIEFycmF5XG5cdCAgICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpO1xuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuXHQgICAgICB9XG5cblx0ICAgICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG5cdCAgICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcblx0ICAgICAgICAvLyBhbnl0aGluZyBlbHNlIGxldCdzIGluc3BlY3Qgd2l0aCAlT1xuXHQgICAgICAgIGFyZ3MudW5zaGlmdCgnJU8nKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIC8vIGFwcGx5IGFueSBgZm9ybWF0dGVyc2AgdHJhbnNmb3JtYXRpb25zXG5cdCAgICAgIHZhciBpbmRleCA9IDA7XG5cdCAgICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLCBmdW5jdGlvbiAobWF0Y2gsIGZvcm1hdCkge1xuXHQgICAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcblx0ICAgICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcblx0ICAgICAgICBpbmRleCsrO1xuXHQgICAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcblx0ICAgICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuXHQgICAgICAgICAgdmFyIHZhbCA9IGFyZ3NbaW5kZXhdO1xuXHQgICAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG5cdCAgICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG5cdCAgICAgICAgICBhcmdzLnNwbGljZShpbmRleCwgMSk7XG5cdCAgICAgICAgICBpbmRleC0tO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByZXR1cm4gbWF0Y2g7XG5cdCAgICAgIH0pO1xuXG5cdCAgICAgIC8vIGFwcGx5IGVudi1zcGVjaWZpYyBmb3JtYXR0aW5nIChjb2xvcnMsIGV0Yy4pXG5cdCAgICAgIGV4cG9ydHMuZm9ybWF0QXJncy5jYWxsKHNlbGYsIGFyZ3MpO1xuXG5cdCAgICAgIHZhciBsb2dGbiA9IGRlYnVnLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuXHQgICAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcblx0ICAgIH1cblxuXHQgICAgZGVidWcubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuXHQgICAgZGVidWcuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpO1xuXHQgICAgZGVidWcudXNlQ29sb3JzID0gZXhwb3J0cy51c2VDb2xvcnMoKTtcblx0ICAgIGRlYnVnLmNvbG9yID0gc2VsZWN0Q29sb3IobmFtZXNwYWNlKTtcblx0ICAgIGRlYnVnLmRlc3Ryb3kgPSBkZXN0cm95O1xuXG5cdCAgICAvLyBlbnYtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGRlYnVnIGluc3RhbmNlc1xuXHQgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmluaXQpIHtcblx0ICAgICAgZXhwb3J0cy5pbml0KGRlYnVnKTtcblx0ICAgIH1cblxuXHQgICAgZXhwb3J0cy5pbnN0YW5jZXMucHVzaChkZWJ1Zyk7XG5cblx0ICAgIHJldHVybiBkZWJ1Zztcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBkZXN0cm95KCkge1xuXHQgICAgdmFyIGluZGV4ID0gZXhwb3J0cy5pbnN0YW5jZXMuaW5kZXhPZih0aGlzKTtcblx0ICAgIGlmIChpbmRleCAhPT0gLTEpIHtcblx0ICAgICAgZXhwb3J0cy5pbnN0YW5jZXMuc3BsaWNlKGluZGV4LCAxKTtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuXHQgICAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuXHQgICAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG5cdCAgICBleHBvcnRzLm5hbWVzID0gW107XG5cdCAgICBleHBvcnRzLnNraXBzID0gW107XG5cblx0ICAgIHZhciBpO1xuXHQgICAgdmFyIHNwbGl0ID0gKHR5cGVvZiBuYW1lc3BhY2VzID09PSAnc3RyaW5nJyA/IG5hbWVzcGFjZXMgOiAnJykuc3BsaXQoL1tcXHMsXSsvKTtcblx0ICAgIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cblx0ICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICBpZiAoIXNwbGl0W2ldKSBjb250aW51ZTsgLy8gaWdub3JlIGVtcHR5IHN0cmluZ3Ncblx0ICAgICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG5cdCAgICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcblx0ICAgICAgICBleHBvcnRzLnNraXBzLnB1c2gobmV3IFJlZ0V4cCgnXicgKyBuYW1lc3BhY2VzLnN1YnN0cigxKSArICckJykpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBmb3IgKGkgPSAwOyBpIDwgZXhwb3J0cy5pbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgdmFyIGluc3RhbmNlID0gZXhwb3J0cy5pbnN0YW5jZXNbaV07XG5cdCAgICAgIGluc3RhbmNlLmVuYWJsZWQgPSBleHBvcnRzLmVuYWJsZWQoaW5zdGFuY2UubmFtZXNwYWNlKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBkaXNhYmxlKCkge1xuXHQgICAgZXhwb3J0cy5lbmFibGUoJycpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG5cdCAgICogQHJldHVybiB7Qm9vbGVhbn1cblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG5cdCAgICBpZiAobmFtZVtuYW1lLmxlbmd0aCAtIDFdID09PSAnKicpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cdCAgICB2YXIgaSwgbGVuO1xuXHQgICAgZm9yIChpID0gMCwgbGVuID0gZXhwb3J0cy5za2lwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHQgICAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG5cdCAgICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdCAgICAgIGlmIChleHBvcnRzLm5hbWVzW2ldLnRlc3QobmFtZSkpIHtcblx0ICAgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIENvZXJjZSBgdmFsYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuXHQgICAqIEByZXR1cm4ge01peGVkfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuXHQgICAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuXHQgICAgcmV0dXJuIHZhbDtcblx0ICB9XG5cdH0pO1xuXHR2YXIgZGVidWdfMSA9IGRlYnVnLmNvZXJjZTtcblx0dmFyIGRlYnVnXzIgPSBkZWJ1Zy5kaXNhYmxlO1xuXHR2YXIgZGVidWdfMyA9IGRlYnVnLmVuYWJsZTtcblx0dmFyIGRlYnVnXzQgPSBkZWJ1Zy5lbmFibGVkO1xuXHR2YXIgZGVidWdfNSA9IGRlYnVnLmh1bWFuaXplO1xuXHR2YXIgZGVidWdfNiA9IGRlYnVnLmluc3RhbmNlcztcblx0dmFyIGRlYnVnXzcgPSBkZWJ1Zy5uYW1lcztcblx0dmFyIGRlYnVnXzggPSBkZWJ1Zy5za2lwcztcblx0dmFyIGRlYnVnXzkgPSBkZWJ1Zy5mb3JtYXR0ZXJzO1xuXG5cdHZhciBkZWJ1ZyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGRlYnVnLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogZGVidWcsXG5cdFx0Y29lcmNlOiBkZWJ1Z18xLFxuXHRcdGRpc2FibGU6IGRlYnVnXzIsXG5cdFx0ZW5hYmxlOiBkZWJ1Z18zLFxuXHRcdGVuYWJsZWQ6IGRlYnVnXzQsXG5cdFx0aHVtYW5pemU6IGRlYnVnXzUsXG5cdFx0aW5zdGFuY2VzOiBkZWJ1Z182LFxuXHRcdG5hbWVzOiBkZWJ1Z183LFxuXHRcdHNraXBzOiBkZWJ1Z184LFxuXHRcdGZvcm1hdHRlcnM6IGRlYnVnXzlcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDAkMSA9ICggZGVidWckMSAmJiBkZWJ1ZyApIHx8IGRlYnVnJDE7XG5cblx0dmFyIGJyb3dzZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuXHQgICAqXG5cdCAgICogRXhwb3NlIGBkZWJ1ZygpYCBhcyB0aGUgbW9kdWxlLlxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSQkMCQxO1xuXHQgIGV4cG9ydHMubG9nID0gbG9nO1xuXHQgIGV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5cdCAgZXhwb3J0cy5zYXZlID0gc2F2ZTtcblx0ICBleHBvcnRzLmxvYWQgPSBsb2FkO1xuXHQgIGV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuXHQgIGV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlID8gY2hyb21lLnN0b3JhZ2UubG9jYWwgOiBsb2NhbHN0b3JhZ2UoKTtcblxuXHQgIC8qKlxuXHQgICAqIENvbG9ycy5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuY29sb3JzID0gWycjMDAwMENDJywgJyMwMDAwRkYnLCAnIzAwMzNDQycsICcjMDAzM0ZGJywgJyMwMDY2Q0MnLCAnIzAwNjZGRicsICcjMDA5OUNDJywgJyMwMDk5RkYnLCAnIzAwQ0MwMCcsICcjMDBDQzMzJywgJyMwMENDNjYnLCAnIzAwQ0M5OScsICcjMDBDQ0NDJywgJyMwMENDRkYnLCAnIzMzMDBDQycsICcjMzMwMEZGJywgJyMzMzMzQ0MnLCAnIzMzMzNGRicsICcjMzM2NkNDJywgJyMzMzY2RkYnLCAnIzMzOTlDQycsICcjMzM5OUZGJywgJyMzM0NDMDAnLCAnIzMzQ0MzMycsICcjMzNDQzY2JywgJyMzM0NDOTknLCAnIzMzQ0NDQycsICcjMzNDQ0ZGJywgJyM2NjAwQ0MnLCAnIzY2MDBGRicsICcjNjYzM0NDJywgJyM2NjMzRkYnLCAnIzY2Q0MwMCcsICcjNjZDQzMzJywgJyM5OTAwQ0MnLCAnIzk5MDBGRicsICcjOTkzM0NDJywgJyM5OTMzRkYnLCAnIzk5Q0MwMCcsICcjOTlDQzMzJywgJyNDQzAwMDAnLCAnI0NDMDAzMycsICcjQ0MwMDY2JywgJyNDQzAwOTknLCAnI0NDMDBDQycsICcjQ0MwMEZGJywgJyNDQzMzMDAnLCAnI0NDMzMzMycsICcjQ0MzMzY2JywgJyNDQzMzOTknLCAnI0NDMzNDQycsICcjQ0MzM0ZGJywgJyNDQzY2MDAnLCAnI0NDNjYzMycsICcjQ0M5OTAwJywgJyNDQzk5MzMnLCAnI0NDQ0MwMCcsICcjQ0NDQzMzJywgJyNGRjAwMDAnLCAnI0ZGMDAzMycsICcjRkYwMDY2JywgJyNGRjAwOTknLCAnI0ZGMDBDQycsICcjRkYwMEZGJywgJyNGRjMzMDAnLCAnI0ZGMzMzMycsICcjRkYzMzY2JywgJyNGRjMzOTknLCAnI0ZGMzNDQycsICcjRkYzM0ZGJywgJyNGRjY2MDAnLCAnI0ZGNjYzMycsICcjRkY5OTAwJywgJyNGRjk5MzMnLCAnI0ZGQ0MwMCcsICcjRkZDQzMzJ107XG5cblx0ICAvKipcblx0ICAgKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuXHQgICAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuXHQgICAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cblx0ICAgKlxuXHQgICAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG5cdCAgICAvLyBOQjogSW4gYW4gRWxlY3Ryb24gcHJlbG9hZCBzY3JpcHQsIGRvY3VtZW50IHdpbGwgYmUgZGVmaW5lZCBidXQgbm90IGZ1bGx5XG5cdCAgICAvLyBpbml0aWFsaXplZC4gU2luY2Ugd2Uga25vdyB3ZSdyZSBpbiBDaHJvbWUsIHdlJ2xsIGp1c3QgZGV0ZWN0IHRoaXMgY2FzZVxuXHQgICAgLy8gZXhwbGljaXRseVxuXHQgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGUgPT09ICdyZW5kZXJlcicpIHtcblx0ICAgICAgcmV0dXJuIHRydWU7XG5cdCAgICB9XG5cblx0ICAgIC8vIEludGVybmV0IEV4cGxvcmVyIGFuZCBFZGdlIGRvIG5vdCBzdXBwb3J0IGNvbG9ycy5cblx0ICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvKGVkZ2V8dHJpZGVudClcXC8oXFxkKykvKSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG5cdCAgICAvLyBkb2N1bWVudCBpcyB1bmRlZmluZWQgaW4gcmVhY3QtbmF0aXZlOiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QtbmF0aXZlL3B1bGwvMTYzMlxuXHQgICAgcmV0dXJuIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuV2Via2l0QXBwZWFyYW5jZSB8fFxuXHQgICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuXHQgICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmNvbnNvbGUgJiYgKHdpbmRvdy5jb25zb2xlLmZpcmVidWcgfHwgd2luZG93LmNvbnNvbGUuZXhjZXB0aW9uICYmIHdpbmRvdy5jb25zb2xlLnRhYmxlKSB8fFxuXHQgICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG5cdCAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcblx0ICAgIHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEgfHxcblx0ICAgIC8vIGRvdWJsZSBjaGVjayB3ZWJraXQgaW4gdXNlckFnZW50IGp1c3QgaW4gY2FzZSB3ZSBhcmUgaW4gYSB3b3JrZXJcblx0ICAgIHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24gKHYpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcblx0ICAgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgICByZXR1cm4gJ1tVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiAnICsgZXJyLm1lc3NhZ2U7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBmb3JtYXRBcmdzKGFyZ3MpIHtcblx0ICAgIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuXHQgICAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpICsgdGhpcy5uYW1lc3BhY2UgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpICsgYXJnc1swXSArICh1c2VDb2xvcnMgPyAnJWMgJyA6ICcgJykgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cblx0ICAgIGlmICghdXNlQ29sb3JzKSByZXR1cm47XG5cblx0ICAgIHZhciBjID0gJ2NvbG9yOiAnICsgdGhpcy5jb2xvcjtcblx0ICAgIGFyZ3Muc3BsaWNlKDEsIDAsIGMsICdjb2xvcjogaW5oZXJpdCcpO1xuXG5cdCAgICAvLyB0aGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuXHQgICAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuXHQgICAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG5cdCAgICB2YXIgaW5kZXggPSAwO1xuXHQgICAgdmFyIGxhc3RDID0gMDtcblx0ICAgIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLCBmdW5jdGlvbiAobWF0Y2gpIHtcblx0ICAgICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG5cdCAgICAgIGluZGV4Kys7XG5cdCAgICAgIGlmICgnJWMnID09PSBtYXRjaCkge1xuXHQgICAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuXHQgICAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG5cdCAgICAgICAgbGFzdEMgPSBpbmRleDtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cblx0ICAgIGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBJbnZva2VzIGBjb25zb2xlLmxvZygpYCB3aGVuIGF2YWlsYWJsZS5cblx0ICAgKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGxvZygpIHtcblx0ICAgIC8vIHRoaXMgaGFja2VyeSBpcyByZXF1aXJlZCBmb3IgSUU4LzksIHdoZXJlXG5cdCAgICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuXHQgICAgcmV0dXJuICdvYmplY3QnID09PSAodHlwZW9mIGNvbnNvbGUgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNvbnNvbGUpKSAmJiBjb25zb2xlLmxvZyAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBTYXZlIGBuYW1lc3BhY2VzYC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcblx0ICAgICAgICBleHBvcnRzLnN0b3JhZ2UucmVtb3ZlSXRlbSgnZGVidWcnKTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuXHQgICAgICB9XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIExvYWQgYG5hbWVzcGFjZXNgLlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9hZCgpIHtcblx0ICAgIHZhciByO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1Zztcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICAgIC8vIElmIGRlYnVnIGlzbid0IHNldCBpbiBMUywgYW5kIHdlJ3JlIGluIEVsZWN0cm9uLCB0cnkgdG8gbG9hZCAkREVCVUdcblx0ICAgIGlmICghciAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgJ2VudicgaW4gcHJvY2Vzcykge1xuXHQgICAgICByID0gcHJvY2Vzcy5lbnYuREVCVUc7XG5cdCAgICB9XG5cblx0ICAgIHJldHVybiByO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG5cdCAgLyoqXG5cdCAgICogTG9jYWxzdG9yYWdlIGF0dGVtcHRzIHRvIHJldHVybiB0aGUgbG9jYWxzdG9yYWdlLlxuXHQgICAqXG5cdCAgICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG5cdCAgICogd2hlbiBhIHVzZXIgZGlzYWJsZXMgY29va2llcy9sb2NhbHN0b3JhZ2Vcblx0ICAgKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7TG9jYWxTdG9yYWdlfVxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gbG9jYWxzdG9yYWdlKCkge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgIH1cblx0fSk7XG5cdHZhciBicm93c2VyXzEgPSBicm93c2VyLmxvZztcblx0dmFyIGJyb3dzZXJfMiA9IGJyb3dzZXIuZm9ybWF0QXJncztcblx0dmFyIGJyb3dzZXJfMyA9IGJyb3dzZXIuc2F2ZTtcblx0dmFyIGJyb3dzZXJfNCA9IGJyb3dzZXIubG9hZDtcblx0dmFyIGJyb3dzZXJfNSA9IGJyb3dzZXIudXNlQ29sb3JzO1xuXHR2YXIgYnJvd3Nlcl82ID0gYnJvd3Nlci5zdG9yYWdlO1xuXHR2YXIgYnJvd3Nlcl83ID0gYnJvd3Nlci5jb2xvcnM7XG5cblx0dmFyIGJyb3dzZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBicm93c2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYnJvd3Nlcixcblx0XHRsb2c6IGJyb3dzZXJfMSxcblx0XHRmb3JtYXRBcmdzOiBicm93c2VyXzIsXG5cdFx0c2F2ZTogYnJvd3Nlcl8zLFxuXHRcdGxvYWQ6IGJyb3dzZXJfNCxcblx0XHR1c2VDb2xvcnM6IGJyb3dzZXJfNSxcblx0XHRzdG9yYWdlOiBicm93c2VyXzYsXG5cdFx0Y29sb3JzOiBicm93c2VyXzdcblx0fSk7XG5cblx0dmFyIHBhcnNldXJpJDIgPSAoIHBhcnNldXJpJDEgJiYgcGFyc2V1cmkgKSB8fCBwYXJzZXVyaSQxO1xuXG5cdHZhciByZXF1aXJlJCQwJDIgPSAoIGJyb3dzZXIkMSAmJiBicm93c2VyICkgfHwgYnJvd3NlciQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckMiA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudDp1cmwnKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB1cmxfMSA9IHVybDtcblxuXHQvKipcblx0ICogVVJMIHBhcnNlci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHVybFxuXHQgKiBAcGFyYW0ge09iamVjdH0gQW4gb2JqZWN0IG1lYW50IHRvIG1pbWljIHdpbmRvdy5sb2NhdGlvbi5cblx0ICogICAgICAgICAgICAgICAgIERlZmF1bHRzIHRvIHdpbmRvdy5sb2NhdGlvbi5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gdXJsKHVyaSwgbG9jKSB7XG5cdCAgdmFyIG9iaiA9IHVyaTtcblxuXHQgIC8vIGRlZmF1bHQgdG8gd2luZG93LmxvY2F0aW9uXG5cdCAgbG9jID0gbG9jIHx8IGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uO1xuXHQgIGlmIChudWxsID09IHVyaSkgdXJpID0gbG9jLnByb3RvY29sICsgJy8vJyArIGxvYy5ob3N0O1xuXG5cdCAgLy8gcmVsYXRpdmUgcGF0aCBzdXBwb3J0XG5cdCAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgdXJpKSB7XG5cdCAgICBpZiAoJy8nID09PSB1cmkuY2hhckF0KDApKSB7XG5cdCAgICAgIGlmICgnLycgPT09IHVyaS5jaGFyQXQoMSkpIHtcblx0ICAgICAgICB1cmkgPSBsb2MucHJvdG9jb2wgKyB1cmk7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgdXJpID0gbG9jLmhvc3QgKyB1cmk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgaWYgKCEvXihodHRwcz98d3NzPyk6XFwvXFwvLy50ZXN0KHVyaSkpIHtcblx0ICAgICAgZGVidWckMigncHJvdG9jb2wtbGVzcyB1cmwgJXMnLCB1cmkpO1xuXHQgICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBsb2MpIHtcblx0ICAgICAgICB1cmkgPSBsb2MucHJvdG9jb2wgKyAnLy8nICsgdXJpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHVyaSA9ICdodHRwczovLycgKyB1cmk7XG5cdCAgICAgIH1cblx0ICAgIH1cblxuXHQgICAgLy8gcGFyc2Vcblx0ICAgIGRlYnVnJDIoJ3BhcnNlICVzJywgdXJpKTtcblx0ICAgIG9iaiA9IHBhcnNldXJpJDIodXJpKTtcblx0ICB9XG5cblx0ICAvLyBtYWtlIHN1cmUgd2UgdHJlYXQgYGxvY2FsaG9zdDo4MGAgYW5kIGBsb2NhbGhvc3RgIGVxdWFsbHlcblx0ICBpZiAoIW9iai5wb3J0KSB7XG5cdCAgICBpZiAoL14oaHR0cHx3cykkLy50ZXN0KG9iai5wcm90b2NvbCkpIHtcblx0ICAgICAgb2JqLnBvcnQgPSAnODAnO1xuXHQgICAgfSBlbHNlIGlmICgvXihodHRwfHdzKXMkLy50ZXN0KG9iai5wcm90b2NvbCkpIHtcblx0ICAgICAgb2JqLnBvcnQgPSAnNDQzJztcblx0ICAgIH1cblx0ICB9XG5cblx0ICBvYmoucGF0aCA9IG9iai5wYXRoIHx8ICcvJztcblxuXHQgIHZhciBpcHY2ID0gb2JqLmhvc3QuaW5kZXhPZignOicpICE9PSAtMTtcblx0ICB2YXIgaG9zdCA9IGlwdjYgPyAnWycgKyBvYmouaG9zdCArICddJyA6IG9iai5ob3N0O1xuXG5cdCAgLy8gZGVmaW5lIHVuaXF1ZSBpZFxuXHQgIG9iai5pZCA9IG9iai5wcm90b2NvbCArICc6Ly8nICsgaG9zdCArICc6JyArIG9iai5wb3J0O1xuXHQgIC8vIGRlZmluZSBocmVmXG5cdCAgb2JqLmhyZWYgPSBvYmoucHJvdG9jb2wgKyAnOi8vJyArIGhvc3QgKyAobG9jICYmIGxvYy5wb3J0ID09PSBvYmoucG9ydCA/ICcnIDogJzonICsgb2JqLnBvcnQpO1xuXG5cdCAgcmV0dXJuIG9iajtcblx0fVxuXG5cdHZhciB1cmwkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB1cmxfMSxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHVybF8xXG5cdH0pO1xuXG5cdHZhciBjb21wb25lbnRFbWl0dGVyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSkge1xuXHQgIC8qKlxyXG5cdCAgICogRXhwb3NlIGBFbWl0dGVyYC5cclxuXHQgICAqL1xuXG5cdCAge1xuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyO1xuXHQgIH1cblxuXHQgIC8qKlxyXG5cdCAgICogSW5pdGlhbGl6ZSBhIG5ldyBgRW1pdHRlcmAuXHJcblx0ICAgKlxyXG5cdCAgICogQGFwaSBwdWJsaWNcclxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcblx0ICAgIGlmIChvYmopIHJldHVybiBtaXhpbihvYmopO1xuXHQgIH1cblx0ICAvKipcclxuXHQgICAqIE1peGluIHRoZSBlbWl0dGVyIHByb3BlcnRpZXMuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IG9ialxyXG5cdCAgICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAgICogQGFwaSBwcml2YXRlXHJcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIG1peGluKG9iaikge1xuXHQgICAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XG5cdCAgICAgIG9ialtrZXldID0gRW1pdHRlci5wcm90b3R5cGVba2V5XTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBvYmo7XG5cdCAgfVxuXG5cdCAgLyoqXHJcblx0ICAgKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEVtaXR0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdCAgICAodGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW10pLnB1c2goZm4pO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxyXG5cdCAgICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXHJcblx0ICAgKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cclxuXHQgICAqIEByZXR1cm4ge0VtaXR0ZXJ9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuXHQgICAgZnVuY3Rpb24gb24oKSB7XG5cdCAgICAgIHRoaXMub2ZmKGV2ZW50LCBvbik7XG5cdCAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdCAgICB9XG5cblx0ICAgIG9uLmZuID0gZm47XG5cdCAgICB0aGlzLm9uKGV2ZW50LCBvbik7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxyXG5cdCAgICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXHJcblx0ICAgKlxyXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XHJcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxyXG5cdCAgICogQHJldHVybiB7RW1pdHRlcn1cclxuXHQgICAqIEBhcGkgcHVibGljXHJcblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblxuXHQgICAgLy8gYWxsXG5cdCAgICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH1cblxuXHQgICAgLy8gc3BlY2lmaWMgZXZlbnRcblx0ICAgIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXHQgICAgaWYgKCFjYWxsYmFja3MpIHJldHVybiB0aGlzO1xuXG5cdCAgICAvLyByZW1vdmUgYWxsIGhhbmRsZXJzXG5cdCAgICBpZiAoMSA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG5cdCAgICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXHQgICAgICByZXR1cm4gdGhpcztcblx0ICAgIH1cblxuXHQgICAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcblx0ICAgIHZhciBjYjtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGNiID0gY2FsbGJhY2tzW2ldO1xuXHQgICAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xuXHQgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaSwgMSk7XG5cdCAgICAgICAgYnJlYWs7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIEVtaXQgYGV2ZW50YCB3aXRoIHRoZSBnaXZlbiBhcmdzLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHBhcmFtIHtNaXhlZH0gLi4uXHJcblx0ICAgKiBAcmV0dXJuIHtFbWl0dGVyfVxyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG5cdCAgICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cdCAgICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcblx0ICAgICAgICBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuXG5cdCAgICBpZiAoY2FsbGJhY2tzKSB7XG5cdCAgICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcblx0ICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuXHQgICAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXG5cdCAgLyoqXHJcblx0ICAgKiBSZXR1cm4gYXJyYXkgb2YgY2FsbGJhY2tzIGZvciBgZXZlbnRgLlxyXG5cdCAgICpcclxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxyXG5cdCAgICogQHJldHVybiB7QXJyYXl9XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblx0ICAgIHJldHVybiB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdO1xuXHQgIH07XG5cblx0ICAvKipcclxuXHQgICAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cclxuXHQgICAqXHJcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcclxuXHQgICAqIEByZXR1cm4ge0Jvb2xlYW59XHJcblx0ICAgKiBAYXBpIHB1YmxpY1xyXG5cdCAgICovXG5cblx0ICBFbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgIHJldHVybiAhIXRoaXMubGlzdGVuZXJzKGV2ZW50KS5sZW5ndGg7XG5cdCAgfTtcblx0fSk7XG5cblx0dmFyIGNvbXBvbmVudEVtaXR0ZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBjb21wb25lbnRFbWl0dGVyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogY29tcG9uZW50RW1pdHRlclxuXHR9KTtcblxuXHR2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxuXHR2YXIgaXNhcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuXHQgIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcblx0fTtcblxuXHR2YXIgaXNhcnJheSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGlzYXJyYXksXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBpc2FycmF5XG5cdH0pO1xuXG5cdHZhciBpc0J1ZmZlciA9IGlzQnVmO1xuXG5cdHZhciB3aXRoTmF0aXZlQnVmZmVyID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgY29tbW9uanNHbG9iYWwuQnVmZmVyLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nO1xuXHR2YXIgd2l0aE5hdGl2ZUFycmF5QnVmZmVyID0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyID09PSAnZnVuY3Rpb24nO1xuXG5cdHZhciBpc1ZpZXcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJiB0eXBlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIuaXNWaWV3ID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICByZXR1cm4gY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIuaXNWaWV3O1xuXHQgIH0gZWxzZSB7XG5cdCAgICByZXR1cm4gZnVuY3Rpb24gKG9iaikge1xuXHQgICAgICByZXR1cm4gb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkFycmF5QnVmZmVyO1xuXHQgICAgfTtcblx0ICB9XG5cdH0oKTtcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIG9iaiBpcyBhIGJ1ZmZlciBvciBhbiBhcnJheWJ1ZmZlci5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGlzQnVmKG9iaikge1xuXHQgIHJldHVybiB3aXRoTmF0aXZlQnVmZmVyICYmIGNvbW1vbmpzR2xvYmFsLkJ1ZmZlci5pc0J1ZmZlcihvYmopIHx8IHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJiAob2JqIGluc3RhbmNlb2YgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIgfHwgaXNWaWV3KG9iaikpO1xuXHR9XG5cblx0dmFyIGlzQnVmZmVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaXNCdWZmZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBpc0J1ZmZlclxuXHR9KTtcblxuXHR2YXIgaXNBcnJheSA9ICggaXNhcnJheSQxICYmIGlzYXJyYXkgKSB8fCBpc2FycmF5JDE7XG5cblx0dmFyIGlzQnVmJDEgPSAoIGlzQnVmZmVyJDEgJiYgaXNCdWZmZXIgKSB8fCBpc0J1ZmZlciQxO1xuXG5cdC8qZ2xvYmFsIEJsb2IsRmlsZSovXG5cblx0LyoqXG5cdCAqIE1vZHVsZSByZXF1aXJlbWVudHNcblx0ICovXG5cblx0dmFyIHRvU3RyaW5nJDEgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgd2l0aE5hdGl2ZUJsb2IgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuQmxvYiA9PT0gJ2Z1bmN0aW9uJyB8fCB0b1N0cmluZyQxLmNhbGwoY29tbW9uanNHbG9iYWwuQmxvYikgPT09ICdbb2JqZWN0IEJsb2JDb25zdHJ1Y3Rvcl0nO1xuXHR2YXIgd2l0aE5hdGl2ZUZpbGUgPSB0eXBlb2YgY29tbW9uanNHbG9iYWwuRmlsZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0b1N0cmluZyQxLmNhbGwoY29tbW9uanNHbG9iYWwuRmlsZSkgPT09ICdbb2JqZWN0IEZpbGVDb25zdHJ1Y3Rvcl0nO1xuXG5cdC8qKlxuXHQgKiBSZXBsYWNlcyBldmVyeSBCdWZmZXIgfCBBcnJheUJ1ZmZlciBpbiBwYWNrZXQgd2l0aCBhIG51bWJlcmVkIHBsYWNlaG9sZGVyLlxuXHQgKiBBbnl0aGluZyB3aXRoIGJsb2JzIG9yIGZpbGVzIHNob3VsZCBiZSBmZWQgdGhyb3VnaCByZW1vdmVCbG9icyBiZWZvcmUgY29taW5nXG5cdCAqIGhlcmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQgLSBzb2NrZXQuaW8gZXZlbnQgcGFja2V0XG5cdCAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBkZWNvbnN0cnVjdGVkIHBhY2tldCBhbmQgbGlzdCBvZiBidWZmZXJzXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBkZWNvbnN0cnVjdFBhY2tldCA9IGZ1bmN0aW9uIGRlY29uc3RydWN0UGFja2V0KHBhY2tldCkge1xuXHQgIHZhciBidWZmZXJzID0gW107XG5cdCAgdmFyIHBhY2tldERhdGEgPSBwYWNrZXQuZGF0YTtcblx0ICB2YXIgcGFjayA9IHBhY2tldDtcblx0ICBwYWNrLmRhdGEgPSBfZGVjb25zdHJ1Y3RQYWNrZXQocGFja2V0RGF0YSwgYnVmZmVycyk7XG5cdCAgcGFjay5hdHRhY2htZW50cyA9IGJ1ZmZlcnMubGVuZ3RoOyAvLyBudW1iZXIgb2YgYmluYXJ5ICdhdHRhY2htZW50cydcblx0ICByZXR1cm4geyBwYWNrZXQ6IHBhY2ssIGJ1ZmZlcnM6IGJ1ZmZlcnMgfTtcblx0fTtcblxuXHRmdW5jdGlvbiBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YSwgYnVmZmVycykge1xuXHQgIGlmICghZGF0YSkgcmV0dXJuIGRhdGE7XG5cblx0ICBpZiAoaXNCdWYkMShkYXRhKSkge1xuXHQgICAgdmFyIHBsYWNlaG9sZGVyID0geyBfcGxhY2Vob2xkZXI6IHRydWUsIG51bTogYnVmZmVycy5sZW5ndGggfTtcblx0ICAgIGJ1ZmZlcnMucHVzaChkYXRhKTtcblx0ICAgIHJldHVybiBwbGFjZWhvbGRlcjtcblx0ICB9IGVsc2UgaWYgKGlzQXJyYXkoZGF0YSkpIHtcblx0ICAgIHZhciBuZXdEYXRhID0gbmV3IEFycmF5KGRhdGEubGVuZ3RoKTtcblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHQgICAgICBuZXdEYXRhW2ldID0gX2RlY29uc3RydWN0UGFja2V0KGRhdGFbaV0sIGJ1ZmZlcnMpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG5ld0RhdGE7XG5cdCAgfSBlbHNlIGlmICgodHlwZW9mIGRhdGEgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGRhdGEpKSA9PT0gJ29iamVjdCcgJiYgIShkYXRhIGluc3RhbmNlb2YgRGF0ZSkpIHtcblx0ICAgIHZhciBuZXdEYXRhID0ge307XG5cdCAgICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xuXHQgICAgICBuZXdEYXRhW2tleV0gPSBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtrZXldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBuZXdEYXRhO1xuXHQgIH1cblx0ICByZXR1cm4gZGF0YTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWNvbnN0cnVjdHMgYSBiaW5hcnkgcGFja2V0IGZyb20gaXRzIHBsYWNlaG9sZGVyIHBhY2tldCBhbmQgYnVmZmVyc1xuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0IC0gZXZlbnQgcGFja2V0IHdpdGggcGxhY2Vob2xkZXJzXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGJ1ZmZlcnMgLSBiaW5hcnkgYnVmZmVycyB0byBwdXQgaW4gcGxhY2Vob2xkZXIgcG9zaXRpb25zXG5cdCAqIEByZXR1cm4ge09iamVjdH0gcmVjb25zdHJ1Y3RlZCBwYWNrZXRcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0dmFyIHJlY29uc3RydWN0UGFja2V0ID0gZnVuY3Rpb24gcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LCBidWZmZXJzKSB7XG5cdCAgcGFja2V0LmRhdGEgPSBfcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LmRhdGEsIGJ1ZmZlcnMpO1xuXHQgIHBhY2tldC5hdHRhY2htZW50cyA9IHVuZGVmaW5lZDsgLy8gbm8gbG9uZ2VyIHVzZWZ1bFxuXHQgIHJldHVybiBwYWNrZXQ7XG5cdH07XG5cblx0ZnVuY3Rpb24gX3JlY29uc3RydWN0UGFja2V0KGRhdGEsIGJ1ZmZlcnMpIHtcblx0ICBpZiAoIWRhdGEpIHJldHVybiBkYXRhO1xuXG5cdCAgaWYgKGRhdGEgJiYgZGF0YS5fcGxhY2Vob2xkZXIpIHtcblx0ICAgIHJldHVybiBidWZmZXJzW2RhdGEubnVtXTsgLy8gYXBwcm9wcmlhdGUgYnVmZmVyIChzaG91bGQgYmUgbmF0dXJhbCBvcmRlciBhbnl3YXkpXG5cdCAgfSBlbHNlIGlmIChpc0FycmF5KGRhdGEpKSB7XG5cdCAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgZGF0YVtpXSA9IF9yZWNvbnN0cnVjdFBhY2tldChkYXRhW2ldLCBidWZmZXJzKTtcblx0ICAgIH1cblx0ICB9IGVsc2UgaWYgKCh0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoZGF0YSkpID09PSAnb2JqZWN0Jykge1xuXHQgICAgZm9yICh2YXIga2V5IGluIGRhdGEpIHtcblx0ICAgICAgZGF0YVtrZXldID0gX3JlY29uc3RydWN0UGFja2V0KGRhdGFba2V5XSwgYnVmZmVycyk7XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGRhdGE7XG5cdH1cblxuXHQvKipcblx0ICogQXN5bmNocm9ub3VzbHkgcmVtb3ZlcyBCbG9icyBvciBGaWxlcyBmcm9tIGRhdGEgdmlhXG5cdCAqIEZpbGVSZWFkZXIncyByZWFkQXNBcnJheUJ1ZmZlciBtZXRob2QuIFVzZWQgYmVmb3JlIGVuY29kaW5nXG5cdCAqIGRhdGEgYXMgbXNncGFjay4gQ2FsbHMgY2FsbGJhY2sgd2l0aCB0aGUgYmxvYmxlc3MgZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdHZhciByZW1vdmVCbG9icyA9IGZ1bmN0aW9uIHJlbW92ZUJsb2JzKGRhdGEsIGNhbGxiYWNrKSB7XG5cdCAgZnVuY3Rpb24gX3JlbW92ZUJsb2JzKG9iaiwgY3VyS2V5LCBjb250YWluaW5nT2JqZWN0KSB7XG5cdCAgICBpZiAoIW9iaikgcmV0dXJuIG9iajtcblxuXHQgICAgLy8gY29udmVydCBhbnkgYmxvYlxuXHQgICAgaWYgKHdpdGhOYXRpdmVCbG9iICYmIG9iaiBpbnN0YW5jZW9mIEJsb2IgfHwgd2l0aE5hdGl2ZUZpbGUgJiYgb2JqIGluc3RhbmNlb2YgRmlsZSkge1xuXHQgICAgICBwZW5kaW5nQmxvYnMrKztcblxuXHQgICAgICAvLyBhc3luYyBmaWxlcmVhZGVyXG5cdCAgICAgIHZhciBmaWxlUmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgICAgZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgLy8gdGhpcy5yZXN1bHQgPT0gYXJyYXlidWZmZXJcblx0ICAgICAgICBpZiAoY29udGFpbmluZ09iamVjdCkge1xuXHQgICAgICAgICAgY29udGFpbmluZ09iamVjdFtjdXJLZXldID0gdGhpcy5yZXN1bHQ7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGJsb2JsZXNzRGF0YSA9IHRoaXMucmVzdWx0O1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIC8vIGlmIG5vdGhpbmcgcGVuZGluZyBpdHMgY2FsbGJhY2sgdGltZVxuXHQgICAgICAgIGlmICghIC0tcGVuZGluZ0Jsb2JzKSB7XG5cdCAgICAgICAgICBjYWxsYmFjayhibG9ibGVzc0RhdGEpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfTtcblxuXHQgICAgICBmaWxlUmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKG9iaik7IC8vIGJsb2IgLT4gYXJyYXlidWZmZXJcblx0ICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmopKSB7XG5cdCAgICAgIC8vIGhhbmRsZSBhcnJheVxuXHQgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIF9yZW1vdmVCbG9icyhvYmpbaV0sIGksIG9iaik7XG5cdCAgICAgIH1cblx0ICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKG9iaikpID09PSAnb2JqZWN0JyAmJiAhaXNCdWYkMShvYmopKSB7XG5cdCAgICAgIC8vIGFuZCBvYmplY3Rcblx0ICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuXHQgICAgICAgIF9yZW1vdmVCbG9icyhvYmpba2V5XSwga2V5LCBvYmopO1xuXHQgICAgICB9XG5cdCAgICB9XG5cdCAgfVxuXG5cdCAgdmFyIHBlbmRpbmdCbG9icyA9IDA7XG5cdCAgdmFyIGJsb2JsZXNzRGF0YSA9IGRhdGE7XG5cdCAgX3JlbW92ZUJsb2JzKGJsb2JsZXNzRGF0YSk7XG5cdCAgaWYgKCFwZW5kaW5nQmxvYnMpIHtcblx0ICAgIGNhbGxiYWNrKGJsb2JsZXNzRGF0YSk7XG5cdCAgfVxuXHR9O1xuXG5cdHZhciBiaW5hcnkgPSB7XG5cdCAgZGVjb25zdHJ1Y3RQYWNrZXQ6IGRlY29uc3RydWN0UGFja2V0LFxuXHQgIHJlY29uc3RydWN0UGFja2V0OiByZWNvbnN0cnVjdFBhY2tldCxcblx0ICByZW1vdmVCbG9iczogcmVtb3ZlQmxvYnNcblx0fTtcblxuXHR2YXIgYmluYXJ5JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmluYXJ5LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmluYXJ5LFxuXHRcdGRlY29uc3RydWN0UGFja2V0OiBkZWNvbnN0cnVjdFBhY2tldCxcblx0XHRyZWNvbnN0cnVjdFBhY2tldDogcmVjb25zdHJ1Y3RQYWNrZXQsXG5cdFx0cmVtb3ZlQmxvYnM6IHJlbW92ZUJsb2JzXG5cdH0pO1xuXG5cdHZhciBFbWl0dGVyID0gKCBjb21wb25lbnRFbWl0dGVyJDEgJiYgY29tcG9uZW50RW1pdHRlciApIHx8IGNvbXBvbmVudEVtaXR0ZXIkMTtcblxuXHR2YXIgYmluYXJ5JDIgPSAoIGJpbmFyeSQxICYmIGJpbmFyeSApIHx8IGJpbmFyeSQxO1xuXG5cdHZhciBzb2NrZXRfaW9QYXJzZXIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBkZWJ1ZyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLXBhcnNlcicpO1xuXG5cdCAgLyoqXG5cdCAgICogUHJvdG9jb2wgdmVyc2lvbi5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnByb3RvY29sID0gNDtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLnR5cGVzID0gWydDT05ORUNUJywgJ0RJU0NPTk5FQ1QnLCAnRVZFTlQnLCAnQUNLJywgJ0VSUk9SJywgJ0JJTkFSWV9FVkVOVCcsICdCSU5BUllfQUNLJ107XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSBgY29ubmVjdGAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5DT05ORUNUID0gMDtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBkaXNjb25uZWN0YC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkRJU0NPTk5FQ1QgPSAxO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGUgYGV2ZW50YC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLkVWRU5UID0gMjtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBhY2tgLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQUNLID0gMztcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBlcnJvcmAuXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5FUlJPUiA9IDQ7XG5cblx0ICAvKipcblx0ICAgKiBQYWNrZXQgdHlwZSAnYmluYXJ5IGV2ZW50J1xuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQklOQVJZX0VWRU5UID0gNTtcblxuXHQgIC8qKlxuXHQgICAqIFBhY2tldCB0eXBlIGBiaW5hcnkgYWNrYC4gRm9yIGFja3Mgd2l0aCBiaW5hcnkgYXJndW1lbnRzLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuQklOQVJZX0FDSyA9IDY7XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVyIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRW5jb2RlciA9IEVuY29kZXI7XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVyIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuRGVjb2RlciA9IERlY29kZXI7XG5cblx0ICAvKipcblx0ICAgKiBBIHNvY2tldC5pbyBFbmNvZGVyIGluc3RhbmNlXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gRW5jb2RlcigpIHt9XG5cblx0ICB2YXIgRVJST1JfUEFDS0VUID0gZXhwb3J0cy5FUlJPUiArICdcImVuY29kZSBlcnJvclwiJztcblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBhIHBhY2tldCBhcyBhIHNpbmdsZSBzdHJpbmcgaWYgbm9uLWJpbmFyeSwgb3IgYXMgYVxuXHQgICAqIGJ1ZmZlciBzZXF1ZW5jZSwgZGVwZW5kaW5nIG9uIHBhY2tldCB0eXBlLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIHBhY2tldCBvYmplY3Rcblx0ICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIGZ1bmN0aW9uIHRvIGhhbmRsZSBlbmNvZGluZ3MgKGxpa2VseSBlbmdpbmUud3JpdGUpXG5cdCAgICogQHJldHVybiBDYWxscyBjYWxsYmFjayB3aXRoIEFycmF5IG9mIGVuY29kaW5nc1xuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBFbmNvZGVyLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbiAob2JqLCBjYWxsYmFjaykge1xuXHQgICAgZGVidWcoJ2VuY29kaW5nIHBhY2tldCAlaicsIG9iaik7XG5cblx0ICAgIGlmIChleHBvcnRzLkJJTkFSWV9FVkVOVCA9PT0gb2JqLnR5cGUgfHwgZXhwb3J0cy5CSU5BUllfQUNLID09PSBvYmoudHlwZSkge1xuXHQgICAgICBlbmNvZGVBc0JpbmFyeShvYmosIGNhbGxiYWNrKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHZhciBlbmNvZGluZyA9IGVuY29kZUFzU3RyaW5nKG9iaik7XG5cdCAgICAgIGNhbGxiYWNrKFtlbmNvZGluZ10pO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGUgcGFja2V0IGFzIHN0cmluZy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUFzU3RyaW5nKG9iaikge1xuXG5cdCAgICAvLyBmaXJzdCBpcyB0eXBlXG5cdCAgICB2YXIgc3RyID0gJycgKyBvYmoudHlwZTtcblxuXHQgICAgLy8gYXR0YWNobWVudHMgaWYgd2UgaGF2ZSB0aGVtXG5cdCAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IG9iai50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gb2JqLnR5cGUpIHtcblx0ICAgICAgc3RyICs9IG9iai5hdHRhY2htZW50cyArICctJztcblx0ICAgIH1cblxuXHQgICAgLy8gaWYgd2UgaGF2ZSBhIG5hbWVzcGFjZSBvdGhlciB0aGFuIGAvYFxuXHQgICAgLy8gd2UgYXBwZW5kIGl0IGZvbGxvd2VkIGJ5IGEgY29tbWEgYCxgXG5cdCAgICBpZiAob2JqLm5zcCAmJiAnLycgIT09IG9iai5uc3ApIHtcblx0ICAgICAgc3RyICs9IG9iai5uc3AgKyAnLCc7XG5cdCAgICB9XG5cblx0ICAgIC8vIGltbWVkaWF0ZWx5IGZvbGxvd2VkIGJ5IHRoZSBpZFxuXHQgICAgaWYgKG51bGwgIT0gb2JqLmlkKSB7XG5cdCAgICAgIHN0ciArPSBvYmouaWQ7XG5cdCAgICB9XG5cblx0ICAgIC8vIGpzb24gZGF0YVxuXHQgICAgaWYgKG51bGwgIT0gb2JqLmRhdGEpIHtcblx0ICAgICAgdmFyIHBheWxvYWQgPSB0cnlTdHJpbmdpZnkob2JqLmRhdGEpO1xuXHQgICAgICBpZiAocGF5bG9hZCAhPT0gZmFsc2UpIHtcblx0ICAgICAgICBzdHIgKz0gcGF5bG9hZDtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICByZXR1cm4gRVJST1JfUEFDS0VUO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIGRlYnVnKCdlbmNvZGVkICVqIGFzICVzJywgb2JqLCBzdHIpO1xuXHQgICAgcmV0dXJuIHN0cjtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0cnlTdHJpbmdpZnkoc3RyKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc3RyKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgcmV0dXJuIGZhbHNlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBwYWNrZXQgYXMgJ2J1ZmZlciBzZXF1ZW5jZScgYnkgcmVtb3ZpbmcgYmxvYnMsIGFuZFxuXHQgICAqIGRlY29uc3RydWN0aW5nIHBhY2tldCBpbnRvIG9iamVjdCB3aXRoIHBsYWNlaG9sZGVycyBhbmRcblx0ICAgKiBhIGxpc3Qgb2YgYnVmZmVycy5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtCdWZmZXJ9IGVuY29kZWRcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUFzQmluYXJ5KG9iaiwgY2FsbGJhY2spIHtcblxuXHQgICAgZnVuY3Rpb24gd3JpdGVFbmNvZGluZyhibG9ibGVzc0RhdGEpIHtcblx0ICAgICAgdmFyIGRlY29uc3RydWN0aW9uID0gYmluYXJ5JDIuZGVjb25zdHJ1Y3RQYWNrZXQoYmxvYmxlc3NEYXRhKTtcblx0ICAgICAgdmFyIHBhY2sgPSBlbmNvZGVBc1N0cmluZyhkZWNvbnN0cnVjdGlvbi5wYWNrZXQpO1xuXHQgICAgICB2YXIgYnVmZmVycyA9IGRlY29uc3RydWN0aW9uLmJ1ZmZlcnM7XG5cblx0ICAgICAgYnVmZmVycy51bnNoaWZ0KHBhY2spOyAvLyBhZGQgcGFja2V0IGluZm8gdG8gYmVnaW5uaW5nIG9mIGRhdGEgbGlzdFxuXHQgICAgICBjYWxsYmFjayhidWZmZXJzKTsgLy8gd3JpdGUgYWxsIHRoZSBidWZmZXJzXG5cdCAgICB9XG5cblx0ICAgIGJpbmFyeSQyLnJlbW92ZUJsb2JzKG9iaiwgd3JpdGVFbmNvZGluZyk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQSBzb2NrZXQuaW8gRGVjb2RlciBpbnN0YW5jZVxuXHQgICAqXG5cdCAgICogQHJldHVybiB7T2JqZWN0fSBkZWNvZGVyXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIERlY29kZXIoKSB7XG5cdCAgICB0aGlzLnJlY29uc3RydWN0b3IgPSBudWxsO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIE1peCBpbiBgRW1pdHRlcmAgd2l0aCBEZWNvZGVyLlxuXHQgICAqL1xuXG5cdCAgRW1pdHRlcihEZWNvZGVyLnByb3RvdHlwZSk7XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVzIGFuIGVjb2RlZCBwYWNrZXQgc3RyaW5nIGludG8gcGFja2V0IEpTT04uXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gb2JqIC0gZW5jb2RlZCBwYWNrZXRcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBEZWNvZGVyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAob2JqKSB7XG5cdCAgICB2YXIgcGFja2V0O1xuXHQgICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIHBhY2tldCA9IGRlY29kZVN0cmluZyhvYmopO1xuXHQgICAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IHBhY2tldC50eXBlIHx8IGV4cG9ydHMuQklOQVJZX0FDSyA9PT0gcGFja2V0LnR5cGUpIHtcblx0ICAgICAgICAvLyBiaW5hcnkgcGFja2V0J3MganNvblxuXHQgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG5ldyBCaW5hcnlSZWNvbnN0cnVjdG9yKHBhY2tldCk7XG5cblx0ICAgICAgICAvLyBubyBhdHRhY2htZW50cywgbGFiZWxlZCBiaW5hcnkgYnV0IG5vIGJpbmFyeSBkYXRhIHRvIGZvbGxvd1xuXHQgICAgICAgIGlmICh0aGlzLnJlY29uc3RydWN0b3IucmVjb25QYWNrLmF0dGFjaG1lbnRzID09PSAwKSB7XG5cdCAgICAgICAgICB0aGlzLmVtaXQoJ2RlY29kZWQnLCBwYWNrZXQpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAvLyBub24tYmluYXJ5IGZ1bGwgcGFja2V0XG5cdCAgICAgICAgdGhpcy5lbWl0KCdkZWNvZGVkJywgcGFja2V0KTtcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIGlmIChpc0J1ZiQxKG9iaikgfHwgb2JqLmJhc2U2NCkge1xuXHQgICAgICAvLyByYXcgYmluYXJ5IGRhdGFcblx0ICAgICAgaWYgKCF0aGlzLnJlY29uc3RydWN0b3IpIHtcblx0ICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dvdCBiaW5hcnkgZGF0YSB3aGVuIG5vdCByZWNvbnN0cnVjdGluZyBhIHBhY2tldCcpO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIHBhY2tldCA9IHRoaXMucmVjb25zdHJ1Y3Rvci50YWtlQmluYXJ5RGF0YShvYmopO1xuXHQgICAgICAgIGlmIChwYWNrZXQpIHtcblx0ICAgICAgICAgIC8vIHJlY2VpdmVkIGZpbmFsIGJ1ZmZlclxuXHQgICAgICAgICAgdGhpcy5yZWNvbnN0cnVjdG9yID0gbnVsbDtcblx0ICAgICAgICAgIHRoaXMuZW1pdCgnZGVjb2RlZCcsIHBhY2tldCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gdHlwZTogJyArIG9iaik7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIERlY29kZSBhIHBhY2tldCBTdHJpbmcgKEpTT04gZGF0YSlcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gZGVjb2RlU3RyaW5nKHN0cikge1xuXHQgICAgdmFyIGkgPSAwO1xuXHQgICAgLy8gbG9vayB1cCB0eXBlXG5cdCAgICB2YXIgcCA9IHtcblx0ICAgICAgdHlwZTogTnVtYmVyKHN0ci5jaGFyQXQoMCkpXG5cdCAgICB9O1xuXG5cdCAgICBpZiAobnVsbCA9PSBleHBvcnRzLnR5cGVzW3AudHlwZV0pIHtcblx0ICAgICAgcmV0dXJuIGVycm9yKCd1bmtub3duIHBhY2tldCB0eXBlICcgKyBwLnR5cGUpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIGF0dGFjaG1lbnRzIGlmIHR5cGUgYmluYXJ5XG5cdCAgICBpZiAoZXhwb3J0cy5CSU5BUllfRVZFTlQgPT09IHAudHlwZSB8fCBleHBvcnRzLkJJTkFSWV9BQ0sgPT09IHAudHlwZSkge1xuXHQgICAgICB2YXIgYnVmID0gJyc7XG5cdCAgICAgIHdoaWxlIChzdHIuY2hhckF0KCsraSkgIT09ICctJykge1xuXHQgICAgICAgIGJ1ZiArPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmIChpID09IHN0ci5sZW5ndGgpIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICAgIGlmIChidWYgIT0gTnVtYmVyKGJ1ZikgfHwgc3RyLmNoYXJBdChpKSAhPT0gJy0nKSB7XG5cdCAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGF0dGFjaG1lbnRzJyk7XG5cdCAgICAgIH1cblx0ICAgICAgcC5hdHRhY2htZW50cyA9IE51bWJlcihidWYpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBsb29rIHVwIG5hbWVzcGFjZSAoaWYgYW55KVxuXHQgICAgaWYgKCcvJyA9PT0gc3RyLmNoYXJBdChpICsgMSkpIHtcblx0ICAgICAgcC5uc3AgPSAnJztcblx0ICAgICAgd2hpbGUgKCsraSkge1xuXHQgICAgICAgIHZhciBjID0gc3RyLmNoYXJBdChpKTtcblx0ICAgICAgICBpZiAoJywnID09PSBjKSBicmVhaztcblx0ICAgICAgICBwLm5zcCArPSBjO1xuXHQgICAgICAgIGlmIChpID09PSBzdHIubGVuZ3RoKSBicmVhaztcblx0ICAgICAgfVxuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgcC5uc3AgPSAnLyc7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAgaWRcblx0ICAgIHZhciBuZXh0ID0gc3RyLmNoYXJBdChpICsgMSk7XG5cdCAgICBpZiAoJycgIT09IG5leHQgJiYgTnVtYmVyKG5leHQpID09IG5leHQpIHtcblx0ICAgICAgcC5pZCA9ICcnO1xuXHQgICAgICB3aGlsZSAoKytpKSB7XG5cdCAgICAgICAgdmFyIGMgPSBzdHIuY2hhckF0KGkpO1xuXHQgICAgICAgIGlmIChudWxsID09IGMgfHwgTnVtYmVyKGMpICE9IGMpIHtcblx0ICAgICAgICAgIC0taTtcblx0ICAgICAgICAgIGJyZWFrO1xuXHQgICAgICAgIH1cblx0ICAgICAgICBwLmlkICs9IHN0ci5jaGFyQXQoaSk7XG5cdCAgICAgICAgaWYgKGkgPT09IHN0ci5sZW5ndGgpIGJyZWFrO1xuXHQgICAgICB9XG5cdCAgICAgIHAuaWQgPSBOdW1iZXIocC5pZCk7XG5cdCAgICB9XG5cblx0ICAgIC8vIGxvb2sgdXAganNvbiBkYXRhXG5cdCAgICBpZiAoc3RyLmNoYXJBdCgrK2kpKSB7XG5cdCAgICAgIHZhciBwYXlsb2FkID0gdHJ5UGFyc2Uoc3RyLnN1YnN0cihpKSk7XG5cdCAgICAgIHZhciBpc1BheWxvYWRWYWxpZCA9IHBheWxvYWQgIT09IGZhbHNlICYmIChwLnR5cGUgPT09IGV4cG9ydHMuRVJST1IgfHwgaXNBcnJheShwYXlsb2FkKSk7XG5cdCAgICAgIGlmIChpc1BheWxvYWRWYWxpZCkge1xuXHQgICAgICAgIHAuZGF0YSA9IHBheWxvYWQ7XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIGVycm9yKCdpbnZhbGlkIHBheWxvYWQnKTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICBkZWJ1ZygnZGVjb2RlZCAlcyBhcyAlaicsIHN0ciwgcCk7XG5cdCAgICByZXR1cm4gcDtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB0cnlQYXJzZShzdHIpIHtcblx0ICAgIHRyeSB7XG5cdCAgICAgIHJldHVybiBKU09OLnBhcnNlKHN0cik7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEZWFsbG9jYXRlcyBhIHBhcnNlcidzIHJlc291cmNlc1xuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIERlY29kZXIucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5yZWNvbnN0cnVjdG9yKSB7XG5cdCAgICAgIHRoaXMucmVjb25zdHJ1Y3Rvci5maW5pc2hlZFJlY29uc3RydWN0aW9uKCk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIEEgbWFuYWdlciBvZiBhIGJpbmFyeSBldmVudCdzICdidWZmZXIgc2VxdWVuY2UnLiBTaG91bGRcblx0ICAgKiBiZSBjb25zdHJ1Y3RlZCB3aGVuZXZlciBhIHBhY2tldCBvZiB0eXBlIEJJTkFSWV9FVkVOVCBpc1xuXHQgICAqIGRlY29kZWQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQHJldHVybiB7QmluYXJ5UmVjb25zdHJ1Y3Rvcn0gaW5pdGlhbGl6ZWQgcmVjb25zdHJ1Y3RvclxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgZnVuY3Rpb24gQmluYXJ5UmVjb25zdHJ1Y3RvcihwYWNrZXQpIHtcblx0ICAgIHRoaXMucmVjb25QYWNrID0gcGFja2V0O1xuXHQgICAgdGhpcy5idWZmZXJzID0gW107XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWV0aG9kIHRvIGJlIGNhbGxlZCB3aGVuIGJpbmFyeSBkYXRhIHJlY2VpdmVkIGZyb20gY29ubmVjdGlvblxuXHQgICAqIGFmdGVyIGEgQklOQVJZX0VWRU5UIHBhY2tldC5cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QnVmZmVyIHwgQXJyYXlCdWZmZXJ9IGJpbkRhdGEgLSB0aGUgcmF3IGJpbmFyeSBkYXRhIHJlY2VpdmVkXG5cdCAgICogQHJldHVybiB7bnVsbCB8IE9iamVjdH0gcmV0dXJucyBudWxsIGlmIG1vcmUgYmluYXJ5IGRhdGEgaXMgZXhwZWN0ZWQgb3Jcblx0ICAgKiAgIGEgcmVjb25zdHJ1Y3RlZCBwYWNrZXQgb2JqZWN0IGlmIGFsbCBidWZmZXJzIGhhdmUgYmVlbiByZWNlaXZlZC5cblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIEJpbmFyeVJlY29uc3RydWN0b3IucHJvdG90eXBlLnRha2VCaW5hcnlEYXRhID0gZnVuY3Rpb24gKGJpbkRhdGEpIHtcblx0ICAgIHRoaXMuYnVmZmVycy5wdXNoKGJpbkRhdGEpO1xuXHQgICAgaWYgKHRoaXMuYnVmZmVycy5sZW5ndGggPT09IHRoaXMucmVjb25QYWNrLmF0dGFjaG1lbnRzKSB7XG5cdCAgICAgIC8vIGRvbmUgd2l0aCBidWZmZXIgbGlzdFxuXHQgICAgICB2YXIgcGFja2V0ID0gYmluYXJ5JDIucmVjb25zdHJ1Y3RQYWNrZXQodGhpcy5yZWNvblBhY2ssIHRoaXMuYnVmZmVycyk7XG5cdCAgICAgIHRoaXMuZmluaXNoZWRSZWNvbnN0cnVjdGlvbigpO1xuXHQgICAgICByZXR1cm4gcGFja2V0O1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIG51bGw7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENsZWFucyB1cCBiaW5hcnkgcGFja2V0IHJlY29uc3RydWN0aW9uIHZhcmlhYmxlcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgQmluYXJ5UmVjb25zdHJ1Y3Rvci5wcm90b3R5cGUuZmluaXNoZWRSZWNvbnN0cnVjdGlvbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHRoaXMucmVjb25QYWNrID0gbnVsbDtcblx0ICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiBlcnJvcihtc2cpIHtcblx0ICAgIHJldHVybiB7XG5cdCAgICAgIHR5cGU6IGV4cG9ydHMuRVJST1IsXG5cdCAgICAgIGRhdGE6ICdwYXJzZXIgZXJyb3I6ICcgKyBtc2dcblx0ICAgIH07XG5cdCAgfVxuXHR9KTtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl8xID0gc29ja2V0X2lvUGFyc2VyLnByb3RvY29sO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzIgPSBzb2NrZXRfaW9QYXJzZXIudHlwZXM7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMyA9IHNvY2tldF9pb1BhcnNlci5DT05ORUNUO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzQgPSBzb2NrZXRfaW9QYXJzZXIuRElTQ09OTkVDVDtcblx0dmFyIHNvY2tldF9pb1BhcnNlcl81ID0gc29ja2V0X2lvUGFyc2VyLkVWRU5UO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzYgPSBzb2NrZXRfaW9QYXJzZXIuQUNLO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzcgPSBzb2NrZXRfaW9QYXJzZXIuRVJST1I7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfOCA9IHNvY2tldF9pb1BhcnNlci5CSU5BUllfRVZFTlQ7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfOSA9IHNvY2tldF9pb1BhcnNlci5CSU5BUllfQUNLO1xuXHR2YXIgc29ja2V0X2lvUGFyc2VyXzEwID0gc29ja2V0X2lvUGFyc2VyLkVuY29kZXI7XG5cdHZhciBzb2NrZXRfaW9QYXJzZXJfMTEgPSBzb2NrZXRfaW9QYXJzZXIuRGVjb2RlcjtcblxuXHR2YXIgc29ja2V0X2lvUGFyc2VyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogc29ja2V0X2lvUGFyc2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogc29ja2V0X2lvUGFyc2VyLFxuXHRcdHByb3RvY29sOiBzb2NrZXRfaW9QYXJzZXJfMSxcblx0XHR0eXBlczogc29ja2V0X2lvUGFyc2VyXzIsXG5cdFx0Q09OTkVDVDogc29ja2V0X2lvUGFyc2VyXzMsXG5cdFx0RElTQ09OTkVDVDogc29ja2V0X2lvUGFyc2VyXzQsXG5cdFx0RVZFTlQ6IHNvY2tldF9pb1BhcnNlcl81LFxuXHRcdEFDSzogc29ja2V0X2lvUGFyc2VyXzYsXG5cdFx0RVJST1I6IHNvY2tldF9pb1BhcnNlcl83LFxuXHRcdEJJTkFSWV9FVkVOVDogc29ja2V0X2lvUGFyc2VyXzgsXG5cdFx0QklOQVJZX0FDSzogc29ja2V0X2lvUGFyc2VyXzksXG5cdFx0RW5jb2Rlcjogc29ja2V0X2lvUGFyc2VyXzEwLFxuXHRcdERlY29kZXI6IHNvY2tldF9pb1BhcnNlcl8xMVxuXHR9KTtcblxuXHR2YXIgaGFzQ29ycyA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUpIHtcblx0ICAvKipcblx0ICAgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICAgKlxuXHQgICAqIExvZ2ljIGJvcnJvd2VkIGZyb20gTW9kZXJuaXpyOlxuXHQgICAqXG5cdCAgICogICAtIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb2Rlcm5penIvTW9kZXJuaXpyL2Jsb2IvbWFzdGVyL2ZlYXR1cmUtZGV0ZWN0cy9jb3JzLmpzXG5cdCAgICovXG5cblx0ICB0cnkge1xuXHQgICAgbW9kdWxlLmV4cG9ydHMgPSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnICYmICd3aXRoQ3JlZGVudGlhbHMnIGluIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHQgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgLy8gaWYgWE1MSHR0cCBzdXBwb3J0IGlzIGRpc2FibGVkIGluIElFIHRoZW4gaXQgd2lsbCB0aHJvd1xuXHQgICAgLy8gd2hlbiB0cnlpbmcgdG8gY3JlYXRlXG5cdCAgICBtb2R1bGUuZXhwb3J0cyA9IGZhbHNlO1xuXHQgIH1cblx0fSk7XG5cblx0dmFyIGhhc0NvcnMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBoYXNDb3JzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaGFzQ29yc1xuXHR9KTtcblxuXHR2YXIgaGFzQ09SUyA9ICggaGFzQ29ycyQxICYmIGhhc0NvcnMgKSB8fCBoYXNDb3JzJDE7XG5cblx0Ly8gYnJvd3NlciBzaGltIGZvciB4bWxodHRwcmVxdWVzdCBtb2R1bGVcblxuXG5cdHZhciB4bWxodHRwcmVxdWVzdCA9IGZ1bmN0aW9uIHhtbGh0dHByZXF1ZXN0KG9wdHMpIHtcblx0ICB2YXIgeGRvbWFpbiA9IG9wdHMueGRvbWFpbjtcblxuXHQgIC8vIHNjaGVtZSBtdXN0IGJlIHNhbWUgd2hlbiB1c2lnbiBYRG9tYWluUmVxdWVzdFxuXHQgIC8vIGh0dHA6Ly9ibG9ncy5tc2RuLmNvbS9iL2llaW50ZXJuYWxzL2FyY2hpdmUvMjAxMC8wNS8xMy94ZG9tYWlucmVxdWVzdC1yZXN0cmljdGlvbnMtbGltaXRhdGlvbnMtYW5kLXdvcmthcm91bmRzLmFzcHhcblx0ICB2YXIgeHNjaGVtZSA9IG9wdHMueHNjaGVtZTtcblxuXHQgIC8vIFhEb21haW5SZXF1ZXN0IGhhcyBhIGZsb3cgb2Ygbm90IHNlbmRpbmcgY29va2llLCB0aGVyZWZvcmUgaXQgc2hvdWxkIGJlIGRpc2FibGVkIGFzIGEgZGVmYXVsdC5cblx0ICAvLyBodHRwczovL2dpdGh1Yi5jb20vQXV0b21hdHRpYy9lbmdpbmUuaW8tY2xpZW50L3B1bGwvMjE3XG5cdCAgdmFyIGVuYWJsZXNYRFIgPSBvcHRzLmVuYWJsZXNYRFI7XG5cblx0ICAvLyBYTUxIdHRwUmVxdWVzdCBjYW4gYmUgZGlzYWJsZWQgb24gSUVcblx0ICB0cnkge1xuXHQgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgJiYgKCF4ZG9tYWluIHx8IGhhc0NPUlMpKSB7XG5cdCAgICAgIHJldHVybiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0ICAgIH1cblx0ICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgLy8gVXNlIFhEb21haW5SZXF1ZXN0IGZvciBJRTggaWYgZW5hYmxlc1hEUiBpcyB0cnVlXG5cdCAgLy8gYmVjYXVzZSBsb2FkaW5nIGJhciBrZWVwcyBmbGFzaGluZyB3aGVuIHVzaW5nIGpzb25wLXBvbGxpbmdcblx0ICAvLyBodHRwczovL2dpdGh1Yi5jb20veXVqaW9zYWthL3NvY2tlLmlvLWllOC1sb2FkaW5nLWV4YW1wbGVcblx0ICB0cnkge1xuXHQgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgWERvbWFpblJlcXVlc3QgJiYgIXhzY2hlbWUgJiYgZW5hYmxlc1hEUikge1xuXHQgICAgICByZXR1cm4gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG5cdCAgICB9XG5cdCAgfSBjYXRjaCAoZSkge31cblxuXHQgIGlmICgheGRvbWFpbikge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgcmV0dXJuIG5ldyBjb21tb25qc0dsb2JhbFtbJ0FjdGl2ZSddLmNvbmNhdCgnT2JqZWN0Jykuam9pbignWCcpXSgnTWljcm9zb2Z0LlhNTEhUVFAnKTtcblx0ICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgfVxuXHR9O1xuXG5cdHZhciB4bWxodHRwcmVxdWVzdCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHhtbGh0dHByZXF1ZXN0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogeG1saHR0cHJlcXVlc3Rcblx0fSk7XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGtleXMgZm9yIGFuIG9iamVjdC5cblx0ICpcblx0ICogQHJldHVybiB7QXJyYXl9IGtleXNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdHZhciBrZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ga2V5cyhvYmopIHtcblx0ICB2YXIgYXJyID0gW107XG5cdCAgdmFyIGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cblx0ICBmb3IgKHZhciBpIGluIG9iaikge1xuXHQgICAgaWYgKGhhcy5jYWxsKG9iaiwgaSkpIHtcblx0ICAgICAgYXJyLnB1c2goaSk7XG5cdCAgICB9XG5cdCAgfVxuXHQgIHJldHVybiBhcnI7XG5cdH07XG5cblx0dmFyIGtleXMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBrZXlzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czoga2V5c1xuXHR9KTtcblxuXHQvKiBnbG9iYWwgQmxvYiBGaWxlICovXG5cblx0Lypcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50cy5cblx0ICovXG5cblx0dmFyIHRvU3RyaW5nJDIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgd2l0aE5hdGl2ZUJsb2IkMSA9IHR5cGVvZiBCbG9iID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyAmJiB0b1N0cmluZyQyLmNhbGwoQmxvYikgPT09ICdbb2JqZWN0IEJsb2JDb25zdHJ1Y3Rvcl0nO1xuXHR2YXIgd2l0aE5hdGl2ZUZpbGUkMSA9IHR5cGVvZiBGaWxlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBGaWxlICE9PSAndW5kZWZpbmVkJyAmJiB0b1N0cmluZyQyLmNhbGwoRmlsZSkgPT09ICdbb2JqZWN0IEZpbGVDb25zdHJ1Y3Rvcl0nO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIGhhc0JpbmFyeTIgPSBoYXNCaW5hcnk7XG5cblx0LyoqXG5cdCAqIENoZWNrcyBmb3IgYmluYXJ5IGRhdGEuXG5cdCAqXG5cdCAqIFN1cHBvcnRzIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEJsb2IgYW5kIEZpbGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBhbnl0aGluZ1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBoYXNCaW5hcnkob2JqKSB7XG5cdCAgaWYgKCFvYmogfHwgKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKG9iaikpICE9PSAnb2JqZWN0Jykge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmIChpc0FycmF5KG9iaikpIHtcblx0ICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICBpZiAoaGFzQmluYXJ5KG9ialtpXSkpIHtcblx0ICAgICAgICByZXR1cm4gdHJ1ZTtcblx0ICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmICh0eXBlb2YgQnVmZmVyID09PSAnZnVuY3Rpb24nICYmIEJ1ZmZlci5pc0J1ZmZlciAmJiBCdWZmZXIuaXNCdWZmZXIob2JqKSB8fCB0eXBlb2YgQXJyYXlCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHwgd2l0aE5hdGl2ZUJsb2IkMSAmJiBvYmogaW5zdGFuY2VvZiBCbG9iIHx8IHdpdGhOYXRpdmVGaWxlJDEgJiYgb2JqIGluc3RhbmNlb2YgRmlsZSkge1xuXHQgICAgcmV0dXJuIHRydWU7XG5cdCAgfVxuXG5cdCAgLy8gc2VlOiBodHRwczovL2dpdGh1Yi5jb20vQXV0b21hdHRpYy9oYXMtYmluYXJ5L3B1bGwvNFxuXHQgIGlmIChvYmoudG9KU09OICYmIHR5cGVvZiBvYmoudG9KU09OID09PSAnZnVuY3Rpb24nICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcblx0ICAgIHJldHVybiBoYXNCaW5hcnkob2JqLnRvSlNPTigpLCB0cnVlKTtcblx0ICB9XG5cblx0ICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG5cdCAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSAmJiBoYXNCaW5hcnkob2JqW2tleV0pKSB7XG5cdCAgICAgIHJldHVybiB0cnVlO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHZhciBoYXNCaW5hcnkyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogaGFzQmluYXJ5Mixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGhhc0JpbmFyeTJcblx0fSk7XG5cblx0LyoqXG5cdCAqIEFuIGFic3RyYWN0aW9uIGZvciBzbGljaW5nIGFuIGFycmF5YnVmZmVyIGV2ZW4gd2hlblxuXHQgKiBBcnJheUJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgaXMgbm90IHN1cHBvcnRlZFxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHR2YXIgYXJyYXlidWZmZXJfc2xpY2UgPSBmdW5jdGlvbiBhcnJheWJ1ZmZlcl9zbGljZShhcnJheWJ1ZmZlciwgc3RhcnQsIGVuZCkge1xuXHQgIHZhciBieXRlcyA9IGFycmF5YnVmZmVyLmJ5dGVMZW5ndGg7XG5cdCAgc3RhcnQgPSBzdGFydCB8fCAwO1xuXHQgIGVuZCA9IGVuZCB8fCBieXRlcztcblxuXHQgIGlmIChhcnJheWJ1ZmZlci5zbGljZSkge1xuXHQgICAgcmV0dXJuIGFycmF5YnVmZmVyLnNsaWNlKHN0YXJ0LCBlbmQpO1xuXHQgIH1cblxuXHQgIGlmIChzdGFydCA8IDApIHtcblx0ICAgIHN0YXJ0ICs9IGJ5dGVzO1xuXHQgIH1cblx0ICBpZiAoZW5kIDwgMCkge1xuXHQgICAgZW5kICs9IGJ5dGVzO1xuXHQgIH1cblx0ICBpZiAoZW5kID4gYnl0ZXMpIHtcblx0ICAgIGVuZCA9IGJ5dGVzO1xuXHQgIH1cblxuXHQgIGlmIChzdGFydCA+PSBieXRlcyB8fCBzdGFydCA+PSBlbmQgfHwgYnl0ZXMgPT09IDApIHtcblx0ICAgIHJldHVybiBuZXcgQXJyYXlCdWZmZXIoMCk7XG5cdCAgfVxuXG5cdCAgdmFyIGFidiA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKTtcblx0ICB2YXIgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoZW5kIC0gc3RhcnQpO1xuXHQgIGZvciAodmFyIGkgPSBzdGFydCwgaWkgPSAwOyBpIDwgZW5kOyBpKyssIGlpKyspIHtcblx0ICAgIHJlc3VsdFtpaV0gPSBhYnZbaV07XG5cdCAgfVxuXHQgIHJldHVybiByZXN1bHQuYnVmZmVyO1xuXHR9O1xuXG5cdHZhciBhcnJheWJ1ZmZlcl9zbGljZSQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGFycmF5YnVmZmVyX3NsaWNlLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYXJyYXlidWZmZXJfc2xpY2Vcblx0fSk7XG5cblx0dmFyIGFmdGVyXzEgPSBhZnRlcjtcblxuXHRmdW5jdGlvbiBhZnRlcihjb3VudCwgY2FsbGJhY2ssIGVycl9jYikge1xuXHQgICAgdmFyIGJhaWwgPSBmYWxzZTtcblx0ICAgIGVycl9jYiA9IGVycl9jYiB8fCBub29wO1xuXHQgICAgcHJveHkuY291bnQgPSBjb3VudDtcblxuXHQgICAgcmV0dXJuIGNvdW50ID09PSAwID8gY2FsbGJhY2soKSA6IHByb3h5O1xuXG5cdCAgICBmdW5jdGlvbiBwcm94eShlcnIsIHJlc3VsdCkge1xuXHQgICAgICAgIGlmIChwcm94eS5jb3VudCA8PSAwKSB7XG5cdCAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYWZ0ZXIgY2FsbGVkIHRvbyBtYW55IHRpbWVzJyk7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIC0tcHJveHkuY291bnQ7XG5cblx0ICAgICAgICAvLyBhZnRlciBmaXJzdCBlcnJvciwgcmVzdCBhcmUgcGFzc2VkIHRvIGVycl9jYlxuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgICAgYmFpbCA9IHRydWU7XG5cdCAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG5cdCAgICAgICAgICAgIC8vIGZ1dHVyZSBlcnJvciBjYWxsYmFja3Mgd2lsbCBnbyB0byBlcnJvciBoYW5kbGVyXG5cdCAgICAgICAgICAgIGNhbGxiYWNrID0gZXJyX2NiO1xuXHQgICAgICAgIH0gZWxzZSBpZiAocHJveHkuY291bnQgPT09IDAgJiYgIWJhaWwpIHtcblx0ICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcblx0ICAgICAgICB9XG5cdCAgICB9XG5cdH1cblxuXHRmdW5jdGlvbiBub29wKCkge31cblxuXHR2YXIgYWZ0ZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBhZnRlcl8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYWZ0ZXJfMVxuXHR9KTtcblxuXHR2YXIgdXRmOCA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0KGZ1bmN0aW9uIChyb290KSB7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlcyBgZXhwb3J0c2Bcblx0XHRcdHZhciBmcmVlRXhwb3J0cyA9IGV4cG9ydHM7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgXG5cdFx0XHR2YXIgZnJlZU1vZHVsZSA9IG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cblx0XHRcdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgLCBmcm9tIE5vZGUuanMgb3IgQnJvd3NlcmlmaWVkIGNvZGUsXG5cdFx0XHQvLyBhbmQgdXNlIGl0IGFzIGByb290YFxuXHRcdFx0dmFyIGZyZWVHbG9iYWwgPSBfdHlwZW9mKGNvbW1vbmpzR2xvYmFsKSA9PSAnb2JqZWN0JyAmJiBjb21tb25qc0dsb2JhbDtcblx0XHRcdGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkge1xuXHRcdFx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0XHRcdH1cblxuXHRcdFx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0XHRcdHZhciBzdHJpbmdGcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuXG5cdFx0XHQvLyBUYWtlbiBmcm9tIGh0dHBzOi8vbXRocy5iZS9wdW55Y29kZVxuXHRcdFx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHRcdFx0dmFyIG91dHB1dCA9IFtdO1xuXHRcdFx0XHR2YXIgY291bnRlciA9IDA7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoO1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdHZhciBleHRyYTtcblx0XHRcdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHtcblx0XHRcdFx0XHRcdFx0Ly8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRha2VuIGZyb20gaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlXG5cdFx0XHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0XHRcdHZhciBpbmRleCA9IC0xO1xuXHRcdFx0XHR2YXIgdmFsdWU7XG5cdFx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdFx0d2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IGFycmF5W2luZGV4XTtcblx0XHRcdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gY2hlY2tTY2FsYXJWYWx1ZShjb2RlUG9pbnQsIHN0cmljdCkge1xuXHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4RDgwMCAmJiBjb2RlUG9pbnQgPD0gMHhERkZGKSB7XG5cdFx0XHRcdFx0aWYgKHN0cmljdCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0xvbmUgc3Vycm9nYXRlIFUrJyArIGNvZGVQb2ludC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSArICcgaXMgbm90IGEgc2NhbGFyIHZhbHVlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHRmdW5jdGlvbiBjcmVhdGVCeXRlKGNvZGVQb2ludCwgc2hpZnQpIHtcblx0XHRcdFx0cmV0dXJuIHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gc2hpZnQgJiAweDNGIHwgMHg4MCk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGVuY29kZUNvZGVQb2ludChjb2RlUG9pbnQsIHN0cmljdCkge1xuXHRcdFx0XHRpZiAoKGNvZGVQb2ludCAmIDB4RkZGRkZGODApID09IDApIHtcblx0XHRcdFx0XHQvLyAxLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRyZXR1cm4gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIHN5bWJvbCA9ICcnO1xuXHRcdFx0XHRpZiAoKGNvZGVQb2ludCAmIDB4RkZGRkY4MDApID09IDApIHtcblx0XHRcdFx0XHQvLyAyLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRzeW1ib2wgPSBzdHJpbmdGcm9tQ2hhckNvZGUoY29kZVBvaW50ID4+IDYgJiAweDFGIHwgMHhDMCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGNvZGVQb2ludCAmIDB4RkZGRjAwMDApID09IDApIHtcblx0XHRcdFx0XHQvLyAzLWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0XHRpZiAoIWNoZWNrU2NhbGFyVmFsdWUoY29kZVBvaW50LCBzdHJpY3QpKSB7XG5cdFx0XHRcdFx0XHRjb2RlUG9pbnQgPSAweEZGRkQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN5bWJvbCA9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gMTIgJiAweDBGIHwgMHhFMCk7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCA2KTtcblx0XHRcdFx0fSBlbHNlIGlmICgoY29kZVBvaW50ICYgMHhGRkUwMDAwMCkgPT0gMCkge1xuXHRcdFx0XHRcdC8vIDQtYnl0ZSBzZXF1ZW5jZVxuXHRcdFx0XHRcdHN5bWJvbCA9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQgPj4gMTggJiAweDA3IHwgMHhGMCk7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCAxMik7XG5cdFx0XHRcdFx0c3ltYm9sICs9IGNyZWF0ZUJ5dGUoY29kZVBvaW50LCA2KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzeW1ib2wgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCAmIDB4M0YgfCAweDgwKTtcblx0XHRcdFx0cmV0dXJuIHN5bWJvbDtcblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gdXRmOGVuY29kZShzdHJpbmcsIG9wdHMpIHtcblx0XHRcdFx0b3B0cyA9IG9wdHMgfHwge307XG5cdFx0XHRcdHZhciBzdHJpY3QgPSBmYWxzZSAhPT0gb3B0cy5zdHJpY3Q7XG5cblx0XHRcdFx0dmFyIGNvZGVQb2ludHMgPSB1Y3MyZGVjb2RlKHN0cmluZyk7XG5cdFx0XHRcdHZhciBsZW5ndGggPSBjb2RlUG9pbnRzLmxlbmd0aDtcblx0XHRcdFx0dmFyIGluZGV4ID0gLTE7XG5cdFx0XHRcdHZhciBjb2RlUG9pbnQ7XG5cdFx0XHRcdHZhciBieXRlU3RyaW5nID0gJyc7XG5cdFx0XHRcdHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gY29kZVBvaW50c1tpbmRleF07XG5cdFx0XHRcdFx0Ynl0ZVN0cmluZyArPSBlbmNvZGVDb2RlUG9pbnQoY29kZVBvaW50LCBzdHJpY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBieXRlU3RyaW5nO1xuXHRcdFx0fVxuXG5cdFx0XHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHRcdFx0ZnVuY3Rpb24gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKSB7XG5cdFx0XHRcdGlmIChieXRlSW5kZXggPj0gYnl0ZUNvdW50KSB7XG5cdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgYnl0ZSBpbmRleCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGNvbnRpbnVhdGlvbkJ5dGUgPSBieXRlQXJyYXlbYnl0ZUluZGV4XSAmIDB4RkY7XG5cdFx0XHRcdGJ5dGVJbmRleCsrO1xuXG5cdFx0XHRcdGlmICgoY29udGludWF0aW9uQnl0ZSAmIDB4QzApID09IDB4ODApIHtcblx0XHRcdFx0XHRyZXR1cm4gY29udGludWF0aW9uQnl0ZSAmIDB4M0Y7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiB3ZSBlbmQgdXAgaGVyZSwgaXTigJlzIG5vdCBhIGNvbnRpbnVhdGlvbiBieXRlXG5cdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlJyk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGRlY29kZVN5bWJvbChzdHJpY3QpIHtcblx0XHRcdFx0dmFyIGJ5dGUxO1xuXHRcdFx0XHR2YXIgYnl0ZTI7XG5cdFx0XHRcdHZhciBieXRlMztcblx0XHRcdFx0dmFyIGJ5dGU0O1xuXHRcdFx0XHR2YXIgY29kZVBvaW50O1xuXG5cdFx0XHRcdGlmIChieXRlSW5kZXggPiBieXRlQ291bnQpIHtcblx0XHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBieXRlIGluZGV4Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYnl0ZUluZGV4ID09IGJ5dGVDb3VudCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlYWQgZmlyc3QgYnl0ZVxuXHRcdFx0XHRieXRlMSA9IGJ5dGVBcnJheVtieXRlSW5kZXhdICYgMHhGRjtcblx0XHRcdFx0Ynl0ZUluZGV4Kys7XG5cblx0XHRcdFx0Ly8gMS1ieXRlIHNlcXVlbmNlIChubyBjb250aW51YXRpb24gYnl0ZXMpXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweDgwKSA9PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGJ5dGUxO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gMi1ieXRlIHNlcXVlbmNlXG5cdFx0XHRcdGlmICgoYnl0ZTEgJiAweEUwKSA9PSAweEMwKSB7XG5cdFx0XHRcdFx0Ynl0ZTIgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGNvZGVQb2ludCA9IChieXRlMSAmIDB4MUYpIDw8IDYgfCBieXRlMjtcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4ODApIHtcblx0XHRcdFx0XHRcdHJldHVybiBjb2RlUG9pbnQ7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IEVycm9yKCdJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gMy1ieXRlIHNlcXVlbmNlIChtYXkgaW5jbHVkZSB1bnBhaXJlZCBzdXJyb2dhdGVzKVxuXHRcdFx0XHRpZiAoKGJ5dGUxICYgMHhGMCkgPT0gMHhFMCkge1xuXHRcdFx0XHRcdGJ5dGUyID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRieXRlMyA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Y29kZVBvaW50ID0gKGJ5dGUxICYgMHgwRikgPDwgMTIgfCBieXRlMiA8PCA2IHwgYnl0ZTM7XG5cdFx0XHRcdFx0aWYgKGNvZGVQb2ludCA+PSAweDA4MDApIHtcblx0XHRcdFx0XHRcdHJldHVybiBjaGVja1NjYWxhclZhbHVlKGNvZGVQb2ludCwgc3RyaWN0KSA/IGNvZGVQb2ludCA6IDB4RkZGRDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ludmFsaWQgY29udGludWF0aW9uIGJ5dGUnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyA0LWJ5dGUgc2VxdWVuY2Vcblx0XHRcdFx0aWYgKChieXRlMSAmIDB4RjgpID09IDB4RjApIHtcblx0XHRcdFx0XHRieXRlMiA9IHJlYWRDb250aW51YXRpb25CeXRlKCk7XG5cdFx0XHRcdFx0Ynl0ZTMgPSByZWFkQ29udGludWF0aW9uQnl0ZSgpO1xuXHRcdFx0XHRcdGJ5dGU0ID0gcmVhZENvbnRpbnVhdGlvbkJ5dGUoKTtcblx0XHRcdFx0XHRjb2RlUG9pbnQgPSAoYnl0ZTEgJiAweDA3KSA8PCAweDEyIHwgYnl0ZTIgPDwgMHgwQyB8IGJ5dGUzIDw8IDB4MDYgfCBieXRlNDtcblx0XHRcdFx0XHRpZiAoY29kZVBvaW50ID49IDB4MDEwMDAwICYmIGNvZGVQb2ludCA8PSAweDEwRkZGRikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNvZGVQb2ludDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aHJvdyBFcnJvcignSW52YWxpZCBVVEYtOCBkZXRlY3RlZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgYnl0ZUFycmF5O1xuXHRcdFx0dmFyIGJ5dGVDb3VudDtcblx0XHRcdHZhciBieXRlSW5kZXg7XG5cdFx0XHRmdW5jdGlvbiB1dGY4ZGVjb2RlKGJ5dGVTdHJpbmcsIG9wdHMpIHtcblx0XHRcdFx0b3B0cyA9IG9wdHMgfHwge307XG5cdFx0XHRcdHZhciBzdHJpY3QgPSBmYWxzZSAhPT0gb3B0cy5zdHJpY3Q7XG5cblx0XHRcdFx0Ynl0ZUFycmF5ID0gdWNzMmRlY29kZShieXRlU3RyaW5nKTtcblx0XHRcdFx0Ynl0ZUNvdW50ID0gYnl0ZUFycmF5Lmxlbmd0aDtcblx0XHRcdFx0Ynl0ZUluZGV4ID0gMDtcblx0XHRcdFx0dmFyIGNvZGVQb2ludHMgPSBbXTtcblx0XHRcdFx0dmFyIHRtcDtcblx0XHRcdFx0d2hpbGUgKCh0bXAgPSBkZWNvZGVTeW1ib2woc3RyaWN0KSkgIT09IGZhbHNlKSB7XG5cdFx0XHRcdFx0Y29kZVBvaW50cy5wdXNoKHRtcCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVjczJlbmNvZGUoY29kZVBvaW50cyk7XG5cdFx0XHR9XG5cblx0XHRcdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdFx0XHR2YXIgdXRmOCA9IHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4xLjInLFxuXHRcdFx0XHQnZW5jb2RlJzogdXRmOGVuY29kZSxcblx0XHRcdFx0J2RlY29kZSc6IHV0ZjhkZWNvZGVcblx0XHRcdH07XG5cblx0XHRcdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHRcdFx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRcdFx0aWYgKHR5cGVvZiB1bmRlZmluZWQgPT0gJ2Z1bmN0aW9uJyAmJiBfdHlwZW9mKHVuZGVmaW5lZC5hbWQpID09ICdvYmplY3QnICYmIHVuZGVmaW5lZC5hbWQpIHtcblx0XHRcdFx0dW5kZWZpbmVkKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdXRmODtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdFx0XHRpZiAoZnJlZU1vZHVsZSkge1xuXHRcdFx0XHRcdC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gdXRmODtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0XHRcdHZhciBvYmplY3QgPSB7fTtcblx0XHRcdFx0XHR2YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3QuaGFzT3duUHJvcGVydHk7XG5cdFx0XHRcdFx0Zm9yICh2YXIga2V5IGluIHV0ZjgpIHtcblx0XHRcdFx0XHRcdGhhc093blByb3BlcnR5LmNhbGwodXRmOCwga2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHV0Zjhba2V5XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0XHRcdHJvb3QudXRmOCA9IHV0Zjg7XG5cdFx0XHR9XG5cdFx0fSkoY29tbW9uanNHbG9iYWwpO1xuXHR9KTtcblxuXHR2YXIgdXRmOCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHV0ZjgsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB1dGY4XG5cdH0pO1xuXG5cdHZhciBiYXNlNjRBcnJheWJ1ZmZlciA9IGNyZWF0ZUNvbW1vbmpzTW9kdWxlKGZ1bmN0aW9uIChtb2R1bGUsIGV4cG9ydHMpIHtcblx0ICAvKlxuXHQgICAqIGJhc2U2NC1hcnJheWJ1ZmZlclxuXHQgICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9iYXNlNjQtYXJyYXlidWZmZXJcblx0ICAgKlxuXHQgICAqIENvcHlyaWdodCAoYykgMjAxMiBOaWtsYXMgdm9uIEhlcnR6ZW5cblx0ICAgKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cdCAgICovXG5cdCAgKGZ1bmN0aW9uICgpIHtcblxuXHQgICAgdmFyIGNoYXJzID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvXCI7XG5cblx0ICAgIC8vIFVzZSBhIGxvb2t1cCB0YWJsZSB0byBmaW5kIHRoZSBpbmRleC5cblx0ICAgIHZhciBsb29rdXAgPSBuZXcgVWludDhBcnJheSgyNTYpO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFycy5sZW5ndGg7IGkrKykge1xuXHQgICAgICBsb29rdXBbY2hhcnMuY2hhckNvZGVBdChpKV0gPSBpO1xuXHQgICAgfVxuXG5cdCAgICBleHBvcnRzLmVuY29kZSA9IGZ1bmN0aW9uIChhcnJheWJ1ZmZlcikge1xuXHQgICAgICB2YXIgYnl0ZXMgPSBuZXcgVWludDhBcnJheShhcnJheWJ1ZmZlciksXG5cdCAgICAgICAgICBpLFxuXHQgICAgICAgICAgbGVuID0gYnl0ZXMubGVuZ3RoLFxuXHQgICAgICAgICAgYmFzZTY0ID0gXCJcIjtcblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDMpIHtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaV0gPj4gMl07XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpXSAmIDMpIDw8IDQgfCBieXRlc1tpICsgMV0gPj4gNF07XG5cdCAgICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpICsgMV0gJiAxNSkgPDwgMiB8IGJ5dGVzW2kgKyAyXSA+PiA2XTtcblx0ICAgICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaSArIDJdICYgNjNdO1xuXHQgICAgICB9XG5cblx0ICAgICAgaWYgKGxlbiAlIDMgPT09IDIpIHtcblx0ICAgICAgICBiYXNlNjQgPSBiYXNlNjQuc3Vic3RyaW5nKDAsIGJhc2U2NC5sZW5ndGggLSAxKSArIFwiPVwiO1xuXHQgICAgICB9IGVsc2UgaWYgKGxlbiAlIDMgPT09IDEpIHtcblx0ICAgICAgICBiYXNlNjQgPSBiYXNlNjQuc3Vic3RyaW5nKDAsIGJhc2U2NC5sZW5ndGggLSAyKSArIFwiPT1cIjtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBiYXNlNjQ7XG5cdCAgICB9O1xuXG5cdCAgICBleHBvcnRzLmRlY29kZSA9IGZ1bmN0aW9uIChiYXNlNjQpIHtcblx0ICAgICAgdmFyIGJ1ZmZlckxlbmd0aCA9IGJhc2U2NC5sZW5ndGggKiAwLjc1LFxuXHQgICAgICAgICAgbGVuID0gYmFzZTY0Lmxlbmd0aCxcblx0ICAgICAgICAgIGksXG5cdCAgICAgICAgICBwID0gMCxcblx0ICAgICAgICAgIGVuY29kZWQxLFxuXHQgICAgICAgICAgZW5jb2RlZDIsXG5cdCAgICAgICAgICBlbmNvZGVkMyxcblx0ICAgICAgICAgIGVuY29kZWQ0O1xuXG5cdCAgICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDFdID09PSBcIj1cIikge1xuXHQgICAgICAgIGJ1ZmZlckxlbmd0aC0tO1xuXHQgICAgICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDJdID09PSBcIj1cIikge1xuXHQgICAgICAgICAgYnVmZmVyTGVuZ3RoLS07XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cblx0ICAgICAgdmFyIGFycmF5YnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlckxlbmd0aCksXG5cdCAgICAgICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKTtcblxuXHQgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcblx0ICAgICAgICBlbmNvZGVkMSA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpKV07XG5cdCAgICAgICAgZW5jb2RlZDIgPSBsb29rdXBbYmFzZTY0LmNoYXJDb2RlQXQoaSArIDEpXTtcblx0ICAgICAgICBlbmNvZGVkMyA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpICsgMildO1xuXHQgICAgICAgIGVuY29kZWQ0ID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAzKV07XG5cblx0ICAgICAgICBieXRlc1twKytdID0gZW5jb2RlZDEgPDwgMiB8IGVuY29kZWQyID4+IDQ7XG5cdCAgICAgICAgYnl0ZXNbcCsrXSA9IChlbmNvZGVkMiAmIDE1KSA8PCA0IHwgZW5jb2RlZDMgPj4gMjtcblx0ICAgICAgICBieXRlc1twKytdID0gKGVuY29kZWQzICYgMykgPDwgNiB8IGVuY29kZWQ0ICYgNjM7XG5cdCAgICAgIH1cblxuXHQgICAgICByZXR1cm4gYXJyYXlidWZmZXI7XG5cdCAgICB9O1xuXHQgIH0pKCk7XG5cdH0pO1xuXHR2YXIgYmFzZTY0QXJyYXlidWZmZXJfMSA9IGJhc2U2NEFycmF5YnVmZmVyLmVuY29kZTtcblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyXzIgPSBiYXNlNjRBcnJheWJ1ZmZlci5kZWNvZGU7XG5cblx0dmFyIGJhc2U2NEFycmF5YnVmZmVyJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmFzZTY0QXJyYXlidWZmZXIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBiYXNlNjRBcnJheWJ1ZmZlcixcblx0XHRlbmNvZGU6IGJhc2U2NEFycmF5YnVmZmVyXzEsXG5cdFx0ZGVjb2RlOiBiYXNlNjRBcnJheWJ1ZmZlcl8yXG5cdH0pO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBibG9iIGJ1aWxkZXIgZXZlbiB3aGVuIHZlbmRvciBwcmVmaXhlcyBleGlzdFxuXHQgKi9cblxuXHR2YXIgQmxvYkJ1aWxkZXIgPSBjb21tb25qc0dsb2JhbC5CbG9iQnVpbGRlciB8fCBjb21tb25qc0dsb2JhbC5XZWJLaXRCbG9iQnVpbGRlciB8fCBjb21tb25qc0dsb2JhbC5NU0Jsb2JCdWlsZGVyIHx8IGNvbW1vbmpzR2xvYmFsLk1vekJsb2JCdWlsZGVyO1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBCbG9iIGNvbnN0cnVjdG9yIGlzIHN1cHBvcnRlZFxuXHQgKi9cblxuXHR2YXIgYmxvYlN1cHBvcnRlZCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0cnkge1xuXHQgICAgdmFyIGEgPSBuZXcgQmxvYihbJ2hpJ10pO1xuXHQgICAgcmV0dXJuIGEuc2l6ZSA9PT0gMjtcblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICByZXR1cm4gZmFsc2U7XG5cdCAgfVxuXHR9KCk7XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIEJsb2IgY29uc3RydWN0b3Igc3VwcG9ydHMgQXJyYXlCdWZmZXJWaWV3c1xuXHQgKiBGYWlscyBpbiBTYWZhcmkgNiwgc28gd2UgbmVlZCB0byBtYXAgdG8gQXJyYXlCdWZmZXJzIHRoZXJlLlxuXHQgKi9cblxuXHR2YXIgYmxvYlN1cHBvcnRzQXJyYXlCdWZmZXJWaWV3ID0gYmxvYlN1cHBvcnRlZCAmJiBmdW5jdGlvbiAoKSB7XG5cdCAgdHJ5IHtcblx0ICAgIHZhciBiID0gbmV3IEJsb2IoW25ldyBVaW50OEFycmF5KFsxLCAyXSldKTtcblx0ICAgIHJldHVybiBiLnNpemUgPT09IDI7XG5cdCAgfSBjYXRjaCAoZSkge1xuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHQgIH1cblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBCbG9iQnVpbGRlciBpcyBzdXBwb3J0ZWRcblx0ICovXG5cblx0dmFyIGJsb2JCdWlsZGVyU3VwcG9ydGVkID0gQmxvYkJ1aWxkZXIgJiYgQmxvYkJ1aWxkZXIucHJvdG90eXBlLmFwcGVuZCAmJiBCbG9iQnVpbGRlci5wcm90b3R5cGUuZ2V0QmxvYjtcblxuXHQvKipcblx0ICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgbWFwcyBBcnJheUJ1ZmZlclZpZXdzIHRvIEFycmF5QnVmZmVyc1xuXHQgKiBVc2VkIGJ5IEJsb2JCdWlsZGVyIGNvbnN0cnVjdG9yIGFuZCBvbGQgYnJvd3NlcnMgdGhhdCBkaWRuJ3Rcblx0ICogc3VwcG9ydCBpdCBpbiB0aGUgQmxvYiBjb25zdHJ1Y3Rvci5cblx0ICovXG5cblx0ZnVuY3Rpb24gbWFwQXJyYXlCdWZmZXJWaWV3cyhhcnkpIHtcblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuXHQgICAgdmFyIGNodW5rID0gYXJ5W2ldO1xuXHQgICAgaWYgKGNodW5rLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG5cdCAgICAgIHZhciBidWYgPSBjaHVuay5idWZmZXI7XG5cblx0ICAgICAgLy8gaWYgdGhpcyBpcyBhIHN1YmFycmF5LCBtYWtlIGEgY29weSBzbyB3ZSBvbmx5XG5cdCAgICAgIC8vIGluY2x1ZGUgdGhlIHN1YmFycmF5IHJlZ2lvbiBmcm9tIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlclxuXHQgICAgICBpZiAoY2h1bmsuYnl0ZUxlbmd0aCAhPT0gYnVmLmJ5dGVMZW5ndGgpIHtcblx0ICAgICAgICB2YXIgY29weSA9IG5ldyBVaW50OEFycmF5KGNodW5rLmJ5dGVMZW5ndGgpO1xuXHQgICAgICAgIGNvcHkuc2V0KG5ldyBVaW50OEFycmF5KGJ1ZiwgY2h1bmsuYnl0ZU9mZnNldCwgY2h1bmsuYnl0ZUxlbmd0aCkpO1xuXHQgICAgICAgIGJ1ZiA9IGNvcHkuYnVmZmVyO1xuXHQgICAgICB9XG5cblx0ICAgICAgYXJ5W2ldID0gYnVmO1xuXHQgICAgfVxuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIEJsb2JCdWlsZGVyQ29uc3RydWN0b3IoYXJ5LCBvcHRpb25zKSB7XG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cblx0ICB2YXIgYmIgPSBuZXcgQmxvYkJ1aWxkZXIoKTtcblx0ICBtYXBBcnJheUJ1ZmZlclZpZXdzKGFyeSk7XG5cblx0ICBmb3IgKHZhciBpID0gMDsgaSA8IGFyeS5sZW5ndGg7IGkrKykge1xuXHQgICAgYmIuYXBwZW5kKGFyeVtpXSk7XG5cdCAgfVxuXG5cdCAgcmV0dXJuIG9wdGlvbnMudHlwZSA/IGJiLmdldEJsb2Iob3B0aW9ucy50eXBlKSA6IGJiLmdldEJsb2IoKTtcblx0fVxuXHRmdW5jdGlvbiBCbG9iQ29uc3RydWN0b3IoYXJ5LCBvcHRpb25zKSB7XG5cdCAgbWFwQXJyYXlCdWZmZXJWaWV3cyhhcnkpO1xuXHQgIHJldHVybiBuZXcgQmxvYihhcnksIG9wdGlvbnMgfHwge30pO1xuXHR9XG5cdHZhciBibG9iID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmIChibG9iU3VwcG9ydGVkKSB7XG5cdCAgICByZXR1cm4gYmxvYlN1cHBvcnRzQXJyYXlCdWZmZXJWaWV3ID8gY29tbW9uanNHbG9iYWwuQmxvYiA6IEJsb2JDb25zdHJ1Y3Rvcjtcblx0ICB9IGVsc2UgaWYgKGJsb2JCdWlsZGVyU3VwcG9ydGVkKSB7XG5cdCAgICByZXR1cm4gQmxvYkJ1aWxkZXJDb25zdHJ1Y3Rvcjtcblx0ICB9IGVsc2Uge1xuXHQgICAgcmV0dXJuIHVuZGVmaW5lZDtcblx0ICB9XG5cdH0oKTtcblxuXHR2YXIgYmxvYiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJsb2IsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBibG9iXG5cdH0pO1xuXG5cdHZhciBrZXlzJDIgPSAoIGtleXMkMSAmJiBrZXlzICkgfHwga2V5cyQxO1xuXG5cdHZhciBoYXNCaW5hcnkkMSA9ICggaGFzQmluYXJ5MiQxICYmIGhhc0JpbmFyeTIgKSB8fCBoYXNCaW5hcnkyJDE7XG5cblx0dmFyIHNsaWNlQnVmZmVyID0gKCBhcnJheWJ1ZmZlcl9zbGljZSQxICYmIGFycmF5YnVmZmVyX3NsaWNlICkgfHwgYXJyYXlidWZmZXJfc2xpY2UkMTtcblxuXHR2YXIgYWZ0ZXIkMiA9ICggYWZ0ZXIkMSAmJiBhZnRlcl8xICkgfHwgYWZ0ZXIkMTtcblxuXHR2YXIgdXRmOCQyID0gKCB1dGY4JDEgJiYgdXRmOCApIHx8IHV0ZjgkMTtcblxuXHR2YXIgcmVxdWlyZSQkMCQzID0gKCBiYXNlNjRBcnJheWJ1ZmZlciQxICYmIGJhc2U2NEFycmF5YnVmZmVyICkgfHwgYmFzZTY0QXJyYXlidWZmZXIkMTtcblxuXHR2YXIgQmxvYiQxID0gKCBibG9iJDEgJiYgYmxvYiApIHx8IGJsb2IkMTtcblxuXHR2YXIgYnJvd3NlciQyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgYmFzZTY0ZW5jb2Rlcjtcblx0ICBpZiAoY29tbW9uanNHbG9iYWwgJiYgY29tbW9uanNHbG9iYWwuQXJyYXlCdWZmZXIpIHtcblx0ICAgIGJhc2U2NGVuY29kZXIgPSByZXF1aXJlJCQwJDM7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogQ2hlY2sgaWYgd2UgYXJlIHJ1bm5pbmcgYW4gYW5kcm9pZCBicm93c2VyLiBUaGF0IHJlcXVpcmVzIHVzIHRvIHVzZVxuXHQgICAqIEFycmF5QnVmZmVyIHdpdGggcG9sbGluZyB0cmFuc3BvcnRzLi4uXG5cdCAgICpcblx0ICAgKiBodHRwOi8vZ2hpbmRhLm5ldC9qcGVnLWJsb2ItYWpheC1hbmRyb2lkL1xuXHQgICAqL1xuXG5cdCAgdmFyIGlzQW5kcm9pZCA9IHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIC9BbmRyb2lkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXHQgIC8qKlxuXHQgICAqIENoZWNrIGlmIHdlIGFyZSBydW5uaW5nIGluIFBoYW50b21KUy5cblx0ICAgKiBVcGxvYWRpbmcgYSBCbG9iIHdpdGggUGhhbnRvbUpTIGRvZXMgbm90IHdvcmsgY29ycmVjdGx5LCBhcyByZXBvcnRlZCBoZXJlOlxuXHQgICAqIGh0dHBzOi8vZ2l0aHViLmNvbS9hcml5YS9waGFudG9tanMvaXNzdWVzLzExMzk1XG5cdCAgICogQHR5cGUgYm9vbGVhblxuXHQgICAqL1xuXHQgIHZhciBpc1BoYW50b21KUyA9IHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIC9QaGFudG9tSlMvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cdCAgLyoqXG5cdCAgICogV2hlbiB0cnVlLCBhdm9pZHMgdXNpbmcgQmxvYnMgdG8gZW5jb2RlIHBheWxvYWRzLlxuXHQgICAqIEB0eXBlIGJvb2xlYW5cblx0ICAgKi9cblx0ICB2YXIgZG9udFNlbmRCbG9icyA9IGlzQW5kcm9pZCB8fCBpc1BoYW50b21KUztcblxuXHQgIC8qKlxuXHQgICAqIEN1cnJlbnQgcHJvdG9jb2wgdmVyc2lvbi5cblx0ICAgKi9cblxuXHQgIGV4cG9ydHMucHJvdG9jb2wgPSAzO1xuXG5cdCAgLyoqXG5cdCAgICogUGFja2V0IHR5cGVzLlxuXHQgICAqL1xuXG5cdCAgdmFyIHBhY2tldHMgPSBleHBvcnRzLnBhY2tldHMgPSB7XG5cdCAgICBvcGVuOiAwIC8vIG5vbi13c1xuXHQgICAgLCBjbG9zZTogMSAvLyBub24td3Ncblx0ICAgICwgcGluZzogMixcblx0ICAgIHBvbmc6IDMsXG5cdCAgICBtZXNzYWdlOiA0LFxuXHQgICAgdXBncmFkZTogNSxcblx0ICAgIG5vb3A6IDZcblx0ICB9O1xuXG5cdCAgdmFyIHBhY2tldHNsaXN0ID0ga2V5cyQyKHBhY2tldHMpO1xuXG5cdCAgLyoqXG5cdCAgICogUHJlbWFkZSBlcnJvciBwYWNrZXQuXG5cdCAgICovXG5cblx0ICB2YXIgZXJyID0geyB0eXBlOiAnZXJyb3InLCBkYXRhOiAncGFyc2VyIGVycm9yJyB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ3JlYXRlIGEgYmxvYiBhcGkgZXZlbiBmb3IgYmxvYiBidWlsZGVyIHdoZW4gdmVuZG9yIHByZWZpeGVzIGV4aXN0XG5cdCAgICovXG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIGEgcGFja2V0LlxuXHQgICAqXG5cdCAgICogICAgIDxwYWNrZXQgdHlwZSBpZD4gWyA8ZGF0YT4gXVxuXHQgICAqXG5cdCAgICogRXhhbXBsZTpcblx0ICAgKlxuXHQgICAqICAgICA1aGVsbG8gd29ybGRcblx0ICAgKiAgICAgM1xuXHQgICAqICAgICA0XG5cdCAgICpcblx0ICAgKiBCaW5hcnkgaXMgZW5jb2RlZCBpbiBhbiBpZGVudGljYWwgcHJpbmNpcGxlXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIHV0ZjhlbmNvZGUsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIHN1cHBvcnRzQmluYXJ5ID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gc3VwcG9ydHNCaW5hcnk7XG5cdCAgICAgIHN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2YgdXRmOGVuY29kZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IHV0ZjhlbmNvZGU7XG5cdCAgICAgIHV0ZjhlbmNvZGUgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgZGF0YSA9IHBhY2tldC5kYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBwYWNrZXQuZGF0YS5idWZmZXIgfHwgcGFja2V0LmRhdGE7XG5cblx0ICAgIGlmIChjb21tb25qc0dsb2JhbC5BcnJheUJ1ZmZlciAmJiBkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcblx0ICAgICAgcmV0dXJuIGVuY29kZUFycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKTtcblx0ICAgIH0gZWxzZSBpZiAoQmxvYiQxICYmIGRhdGEgaW5zdGFuY2VvZiBjb21tb25qc0dsb2JhbC5CbG9iKSB7XG5cdCAgICAgIHJldHVybiBlbmNvZGVCbG9iKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgLy8gbWlnaHQgYmUgYW4gb2JqZWN0IHdpdGggeyBiYXNlNjQ6IHRydWUsIGRhdGE6IGRhdGFBc0Jhc2U2NFN0cmluZyB9XG5cdCAgICBpZiAoZGF0YSAmJiBkYXRhLmJhc2U2NCkge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQmFzZTY0T2JqZWN0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICAvLyBTZW5kaW5nIGRhdGEgYXMgYSB1dGYtOCBzdHJpbmdcblx0ICAgIHZhciBlbmNvZGVkID0gcGFja2V0c1twYWNrZXQudHlwZV07XG5cblx0ICAgIC8vIGRhdGEgZnJhZ21lbnQgaXMgb3B0aW9uYWxcblx0ICAgIGlmICh1bmRlZmluZWQgIT09IHBhY2tldC5kYXRhKSB7XG5cdCAgICAgIGVuY29kZWQgKz0gdXRmOGVuY29kZSA/IHV0ZjgkMi5lbmNvZGUoU3RyaW5nKHBhY2tldC5kYXRhKSwgeyBzdHJpY3Q6IGZhbHNlIH0pIDogU3RyaW5nKHBhY2tldC5kYXRhKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKCcnICsgZW5jb2RlZCk7XG5cdCAgfTtcblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJhc2U2NE9iamVjdChwYWNrZXQsIGNhbGxiYWNrKSB7XG5cdCAgICAvLyBwYWNrZXQgZGF0YSBpcyBhbiBvYmplY3QgeyBiYXNlNjQ6IHRydWUsIGRhdGE6IGRhdGFBc0Jhc2U2NFN0cmluZyB9XG5cdCAgICB2YXIgbWVzc2FnZSA9ICdiJyArIGV4cG9ydHMucGFja2V0c1twYWNrZXQudHlwZV0gKyBwYWNrZXQuZGF0YS5kYXRhO1xuXHQgICAgcmV0dXJuIGNhbGxiYWNrKG1lc3NhZ2UpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZSBwYWNrZXQgaGVscGVycyBmb3IgYmluYXJ5IHR5cGVzXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBlbmNvZGVBcnJheUJ1ZmZlcihwYWNrZXQsIHN1cHBvcnRzQmluYXJ5LCBjYWxsYmFjaykge1xuXHQgICAgaWYgKCFzdXBwb3J0c0JpbmFyeSkge1xuXHQgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQocGFja2V0LCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBkYXRhID0gcGFja2V0LmRhdGE7XG5cdCAgICB2YXIgY29udGVudEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG5cdCAgICB2YXIgcmVzdWx0QnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMSArIGRhdGEuYnl0ZUxlbmd0aCk7XG5cblx0ICAgIHJlc3VsdEJ1ZmZlclswXSA9IHBhY2tldHNbcGFja2V0LnR5cGVdO1xuXHQgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb250ZW50QXJyYXkubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgcmVzdWx0QnVmZmVyW2kgKyAxXSA9IGNvbnRlbnRBcnJheVtpXTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKHJlc3VsdEJ1ZmZlci5idWZmZXIpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJsb2JBc0FycmF5QnVmZmVyKHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZUJhc2U2NFBhY2tldChwYWNrZXQsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgIGZyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgcGFja2V0LmRhdGEgPSBmci5yZXN1bHQ7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgc3VwcG9ydHNCaW5hcnksIHRydWUsIGNhbGxiYWNrKTtcblx0ICAgIH07XG5cdCAgICByZXR1cm4gZnIucmVhZEFzQXJyYXlCdWZmZXIocGFja2V0LmRhdGEpO1xuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGVuY29kZUJsb2IocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICghc3VwcG9ydHNCaW5hcnkpIHtcblx0ICAgICAgcmV0dXJuIGV4cG9ydHMuZW5jb2RlQmFzZTY0UGFja2V0KHBhY2tldCwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICBpZiAoZG9udFNlbmRCbG9icykge1xuXHQgICAgICByZXR1cm4gZW5jb2RlQmxvYkFzQXJyYXlCdWZmZXIocGFja2V0LCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgbGVuZ3RoID0gbmV3IFVpbnQ4QXJyYXkoMSk7XG5cdCAgICBsZW5ndGhbMF0gPSBwYWNrZXRzW3BhY2tldC50eXBlXTtcblx0ICAgIHZhciBibG9iID0gbmV3IEJsb2IkMShbbGVuZ3RoLmJ1ZmZlciwgcGFja2V0LmRhdGFdKTtcblxuXHQgICAgcmV0dXJuIGNhbGxiYWNrKGJsb2IpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIEVuY29kZXMgYSBwYWNrZXQgd2l0aCBiaW5hcnkgZGF0YSBpbiBhIGJhc2U2NCBzdHJpbmdcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQsIGhhcyBgdHlwZWAgYW5kIGBkYXRhYFxuXHQgICAqIEByZXR1cm4ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgbWVzc2FnZVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5lbmNvZGVCYXNlNjRQYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0LCBjYWxsYmFjaykge1xuXHQgICAgdmFyIG1lc3NhZ2UgPSAnYicgKyBleHBvcnRzLnBhY2tldHNbcGFja2V0LnR5cGVdO1xuXHQgICAgaWYgKEJsb2IkMSAmJiBwYWNrZXQuZGF0YSBpbnN0YW5jZW9mIGNvbW1vbmpzR2xvYmFsLkJsb2IpIHtcblx0ICAgICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0ICAgICAgZnIub25sb2FkID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIHZhciBiNjQgPSBmci5yZXN1bHQuc3BsaXQoJywnKVsxXTtcblx0ICAgICAgICBjYWxsYmFjayhtZXNzYWdlICsgYjY0KTtcblx0ICAgICAgfTtcblx0ICAgICAgcmV0dXJuIGZyLnJlYWRBc0RhdGFVUkwocGFja2V0LmRhdGEpO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgYjY0ZGF0YTtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGI2NGRhdGEgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KHBhY2tldC5kYXRhKSk7XG5cdCAgICB9IGNhdGNoIChlKSB7XG5cdCAgICAgIC8vIGlQaG9uZSBTYWZhcmkgZG9lc24ndCBsZXQgeW91IGFwcGx5IHdpdGggdHlwZWQgYXJyYXlzXG5cdCAgICAgIHZhciB0eXBlZCA9IG5ldyBVaW50OEFycmF5KHBhY2tldC5kYXRhKTtcblx0ICAgICAgdmFyIGJhc2ljID0gbmV3IEFycmF5KHR5cGVkLmxlbmd0aCk7XG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHlwZWQubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBiYXNpY1tpXSA9IHR5cGVkW2ldO1xuXHQgICAgICB9XG5cdCAgICAgIGI2NGRhdGEgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGJhc2ljKTtcblx0ICAgIH1cblx0ICAgIG1lc3NhZ2UgKz0gY29tbW9uanNHbG9iYWwuYnRvYShiNjRkYXRhKTtcblx0ICAgIHJldHVybiBjYWxsYmFjayhtZXNzYWdlKTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRGVjb2RlcyBhIHBhY2tldC4gQ2hhbmdlcyBmb3JtYXQgdG8gQmxvYiBpZiByZXF1ZXN0ZWQuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtPYmplY3R9IHdpdGggYHR5cGVgIGFuZCBgZGF0YWAgKGlmIGFueSlcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZGVjb2RlUGFja2V0ID0gZnVuY3Rpb24gKGRhdGEsIGJpbmFyeVR5cGUsIHV0ZjhkZWNvZGUpIHtcblx0ICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQpIHtcblx0ICAgICAgcmV0dXJuIGVycjtcblx0ICAgIH1cblx0ICAgIC8vIFN0cmluZyBkYXRhXG5cdCAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIGlmIChkYXRhLmNoYXJBdCgwKSA9PT0gJ2InKSB7XG5cdCAgICAgICAgcmV0dXJuIGV4cG9ydHMuZGVjb2RlQmFzZTY0UGFja2V0KGRhdGEuc3Vic3RyKDEpLCBiaW5hcnlUeXBlKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmICh1dGY4ZGVjb2RlKSB7XG5cdCAgICAgICAgZGF0YSA9IHRyeURlY29kZShkYXRhKTtcblx0ICAgICAgICBpZiAoZGF0YSA9PT0gZmFsc2UpIHtcblx0ICAgICAgICAgIHJldHVybiBlcnI7XG5cdCAgICAgICAgfVxuXHQgICAgICB9XG5cdCAgICAgIHZhciB0eXBlID0gZGF0YS5jaGFyQXQoMCk7XG5cblx0ICAgICAgaWYgKE51bWJlcih0eXBlKSAhPSB0eXBlIHx8ICFwYWNrZXRzbGlzdFt0eXBlXSkge1xuXHQgICAgICAgIHJldHVybiBlcnI7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAoZGF0YS5sZW5ndGggPiAxKSB7XG5cdCAgICAgICAgcmV0dXJuIHsgdHlwZTogcGFja2V0c2xpc3RbdHlwZV0sIGRhdGE6IGRhdGEuc3Vic3RyaW5nKDEpIH07XG5cdCAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgcmV0dXJuIHsgdHlwZTogcGFja2V0c2xpc3RbdHlwZV0gfTtcblx0ICAgICAgfVxuXHQgICAgfVxuXG5cdCAgICB2YXIgYXNBcnJheSA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuXHQgICAgdmFyIHR5cGUgPSBhc0FycmF5WzBdO1xuXHQgICAgdmFyIHJlc3QgPSBzbGljZUJ1ZmZlcihkYXRhLCAxKTtcblx0ICAgIGlmIChCbG9iJDEgJiYgYmluYXJ5VHlwZSA9PT0gJ2Jsb2InKSB7XG5cdCAgICAgIHJlc3QgPSBuZXcgQmxvYiQxKFtyZXN0XSk7XG5cdCAgICB9XG5cdCAgICByZXR1cm4geyB0eXBlOiBwYWNrZXRzbGlzdFt0eXBlXSwgZGF0YTogcmVzdCB9O1xuXHQgIH07XG5cblx0ICBmdW5jdGlvbiB0cnlEZWNvZGUoZGF0YSkge1xuXHQgICAgdHJ5IHtcblx0ICAgICAgZGF0YSA9IHV0ZjgkMi5kZWNvZGUoZGF0YSwgeyBzdHJpY3Q6IGZhbHNlIH0pO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICByZXR1cm4gZmFsc2U7XG5cdCAgICB9XG5cdCAgICByZXR1cm4gZGF0YTtcblx0ICB9XG5cblx0ICAvKipcblx0ICAgKiBEZWNvZGVzIGEgcGFja2V0IGVuY29kZWQgaW4gYSBiYXNlNjQgc3RyaW5nXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgbWVzc2FnZVxuXHQgICAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBgdHlwZWAgYW5kIGBkYXRhYCAoaWYgYW55KVxuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVCYXNlNjRQYWNrZXQgPSBmdW5jdGlvbiAobXNnLCBiaW5hcnlUeXBlKSB7XG5cdCAgICB2YXIgdHlwZSA9IHBhY2tldHNsaXN0W21zZy5jaGFyQXQoMCldO1xuXHQgICAgaWYgKCFiYXNlNjRlbmNvZGVyKSB7XG5cdCAgICAgIHJldHVybiB7IHR5cGU6IHR5cGUsIGRhdGE6IHsgYmFzZTY0OiB0cnVlLCBkYXRhOiBtc2cuc3Vic3RyKDEpIH0gfTtcblx0ICAgIH1cblxuXHQgICAgdmFyIGRhdGEgPSBiYXNlNjRlbmNvZGVyLmRlY29kZShtc2cuc3Vic3RyKDEpKTtcblxuXHQgICAgaWYgKGJpbmFyeVR5cGUgPT09ICdibG9iJyAmJiBCbG9iJDEpIHtcblx0ICAgICAgZGF0YSA9IG5ldyBCbG9iJDEoW2RhdGFdKTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIHsgdHlwZTogdHlwZSwgZGF0YTogZGF0YSB9O1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbmNvZGVzIG11bHRpcGxlIG1lc3NhZ2VzIChwYXlsb2FkKS5cblx0ICAgKlxuXHQgICAqICAgICA8bGVuZ3RoPjpkYXRhXG5cdCAgICpcblx0ICAgKiBFeGFtcGxlOlxuXHQgICAqXG5cdCAgICogICAgIDExOmhlbGxvIHdvcmxkMjpoaVxuXHQgICAqXG5cdCAgICogSWYgYW55IGNvbnRlbnRzIGFyZSBiaW5hcnksIHRoZXkgd2lsbCBiZSBlbmNvZGVkIGFzIGJhc2U2NCBzdHJpbmdzLiBCYXNlNjRcblx0ICAgKiBlbmNvZGVkIHN0cmluZ3MgYXJlIG1hcmtlZCB3aXRoIGEgYiBiZWZvcmUgdGhlIGxlbmd0aCBzcGVjaWZpZXJcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGF5bG9hZCA9IGZ1bmN0aW9uIChwYWNrZXRzLCBzdXBwb3J0c0JpbmFyeSwgY2FsbGJhY2spIHtcblx0ICAgIGlmICh0eXBlb2Ygc3VwcG9ydHNCaW5hcnkgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgICAgY2FsbGJhY2sgPSBzdXBwb3J0c0JpbmFyeTtcblx0ICAgICAgc3VwcG9ydHNCaW5hcnkgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgaXNCaW5hcnkgPSBoYXNCaW5hcnkkMShwYWNrZXRzKTtcblxuXHQgICAgaWYgKHN1cHBvcnRzQmluYXJ5ICYmIGlzQmluYXJ5KSB7XG5cdCAgICAgIGlmIChCbG9iJDEgJiYgIWRvbnRTZW5kQmxvYnMpIHtcblx0ICAgICAgICByZXR1cm4gZXhwb3J0cy5lbmNvZGVQYXlsb2FkQXNCbG9iKHBhY2tldHMsIGNhbGxiYWNrKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIHJldHVybiBleHBvcnRzLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyKHBhY2tldHMsIGNhbGxiYWNrKTtcblx0ICAgIH1cblxuXHQgICAgaWYgKCFwYWNrZXRzLmxlbmd0aCkge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2soJzA6Jyk7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIHNldExlbmd0aEhlYWRlcihtZXNzYWdlKSB7XG5cdCAgICAgIHJldHVybiBtZXNzYWdlLmxlbmd0aCArICc6JyArIG1lc3NhZ2U7XG5cdCAgICB9XG5cblx0ICAgIGZ1bmN0aW9uIGVuY29kZU9uZShwYWNrZXQsIGRvbmVDYWxsYmFjaykge1xuXHQgICAgICBleHBvcnRzLmVuY29kZVBhY2tldChwYWNrZXQsICFpc0JpbmFyeSA/IGZhbHNlIDogc3VwcG9ydHNCaW5hcnksIGZhbHNlLCBmdW5jdGlvbiAobWVzc2FnZSkge1xuXHQgICAgICAgIGRvbmVDYWxsYmFjayhudWxsLCBzZXRMZW5ndGhIZWFkZXIobWVzc2FnZSkpO1xuXHQgICAgICB9KTtcblx0ICAgIH1cblxuXHQgICAgbWFwKHBhY2tldHMsIGVuY29kZU9uZSwgZnVuY3Rpb24gKGVyciwgcmVzdWx0cykge1xuXHQgICAgICByZXR1cm4gY2FsbGJhY2socmVzdWx0cy5qb2luKCcnKSk7XG5cdCAgICB9KTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQXN5bmMgYXJyYXkgbWFwIHVzaW5nIGFmdGVyXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBtYXAoYXJ5LCBlYWNoLCBkb25lKSB7XG5cdCAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KGFyeS5sZW5ndGgpO1xuXHQgICAgdmFyIG5leHQgPSBhZnRlciQyKGFyeS5sZW5ndGgsIGRvbmUpO1xuXG5cdCAgICB2YXIgZWFjaFdpdGhJbmRleCA9IGZ1bmN0aW9uIGVhY2hXaXRoSW5kZXgoaSwgZWwsIGNiKSB7XG5cdCAgICAgIGVhY2goZWwsIGZ1bmN0aW9uIChlcnJvciwgbXNnKSB7XG5cdCAgICAgICAgcmVzdWx0W2ldID0gbXNnO1xuXHQgICAgICAgIGNiKGVycm9yLCByZXN1bHQpO1xuXHQgICAgICB9KTtcblx0ICAgIH07XG5cblx0ICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJ5Lmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgIGVhY2hXaXRoSW5kZXgoaSwgYXJ5W2ldLCBuZXh0KTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvKlxuXHQgICAqIERlY29kZXMgZGF0YSB3aGVuIGEgcGF5bG9hZCBpcyBtYXliZSBleHBlY3RlZC4gUG9zc2libGUgYmluYXJ5IGNvbnRlbnRzIGFyZVxuXHQgICAqIGRlY29kZWQgZnJvbSB0aGVpciBiYXNlNjQgcmVwcmVzZW50YXRpb25cblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhLCBjYWxsYmFjayBtZXRob2Rcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5kZWNvZGVQYXlsb2FkID0gZnVuY3Rpb24gKGRhdGEsIGJpbmFyeVR5cGUsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG5cdCAgICAgIHJldHVybiBleHBvcnRzLmRlY29kZVBheWxvYWRBc0JpbmFyeShkYXRhLCBiaW5hcnlUeXBlLCBjYWxsYmFjayk7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0eXBlb2YgYmluYXJ5VHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgICBjYWxsYmFjayA9IGJpbmFyeVR5cGU7XG5cdCAgICAgIGJpbmFyeVR5cGUgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB2YXIgcGFja2V0O1xuXHQgICAgaWYgKGRhdGEgPT09ICcnKSB7XG5cdCAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBsZW5ndGggPSAnJyxcblx0ICAgICAgICBuLFxuXHQgICAgICAgIG1zZztcblxuXHQgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHQgICAgICB2YXIgY2hyID0gZGF0YS5jaGFyQXQoaSk7XG5cblx0ICAgICAgaWYgKGNociAhPT0gJzonKSB7XG5cdCAgICAgICAgbGVuZ3RoICs9IGNocjtcblx0ICAgICAgICBjb250aW51ZTtcblx0ICAgICAgfVxuXG5cdCAgICAgIGlmIChsZW5ndGggPT09ICcnIHx8IGxlbmd0aCAhPSAobiA9IE51bWJlcihsZW5ndGgpKSkge1xuXHQgICAgICAgIC8vIHBhcnNlciBlcnJvciAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgfVxuXG5cdCAgICAgIG1zZyA9IGRhdGEuc3Vic3RyKGkgKyAxLCBuKTtcblxuXHQgICAgICBpZiAobGVuZ3RoICE9IG1zZy5sZW5ndGgpIHtcblx0ICAgICAgICAvLyBwYXJzZXIgZXJyb3IgLSBpZ25vcmluZyBwYXlsb2FkXG5cdCAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgMCwgMSk7XG5cdCAgICAgIH1cblxuXHQgICAgICBpZiAobXNnLmxlbmd0aCkge1xuXHQgICAgICAgIHBhY2tldCA9IGV4cG9ydHMuZGVjb2RlUGFja2V0KG1zZywgYmluYXJ5VHlwZSwgZmFsc2UpO1xuXG5cdCAgICAgICAgaWYgKGVyci50eXBlID09PSBwYWNrZXQudHlwZSAmJiBlcnIuZGF0YSA9PT0gcGFja2V0LmRhdGEpIHtcblx0ICAgICAgICAgIC8vIHBhcnNlciBlcnJvciBpbiBpbmRpdmlkdWFsIHBhY2tldCAtIGlnbm9yaW5nIHBheWxvYWRcblx0ICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIsIDAsIDEpO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIHZhciByZXQgPSBjYWxsYmFjayhwYWNrZXQsIGkgKyBuLCBsKTtcblx0ICAgICAgICBpZiAoZmFsc2UgPT09IHJldCkgcmV0dXJuO1xuXHQgICAgICB9XG5cblx0ICAgICAgLy8gYWR2YW5jZSBjdXJzb3Jcblx0ICAgICAgaSArPSBuO1xuXHQgICAgICBsZW5ndGggPSAnJztcblx0ICAgIH1cblxuXHQgICAgaWYgKGxlbmd0aCAhPT0gJycpIHtcblx0ICAgICAgLy8gcGFyc2VyIGVycm9yIC0gaWdub3JpbmcgcGF5bG9hZFxuXHQgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlcyBtdWx0aXBsZSBtZXNzYWdlcyAocGF5bG9hZCkgYXMgYmluYXJ5LlxuXHQgICAqXG5cdCAgICogPDEgPSBiaW5hcnksIDAgPSBzdHJpbmc+PG51bWJlciBmcm9tIDAtOT48bnVtYmVyIGZyb20gMC05PlsuLi5dPG51bWJlclxuXHQgICAqIDI1NT48ZGF0YT5cblx0ICAgKlxuXHQgICAqIEV4YW1wbGU6XG5cdCAgICogMSAzIDI1NSAxIDIgMywgaWYgdGhlIGJpbmFyeSBjb250ZW50cyBhcmUgaW50ZXJwcmV0ZWQgYXMgOCBiaXQgaW50ZWdlcnNcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcblx0ICAgKiBAcmV0dXJuIHtBcnJheUJ1ZmZlcn0gZW5jb2RlZCBwYXlsb2FkXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyID0gZnVuY3Rpb24gKHBhY2tldHMsIGNhbGxiYWNrKSB7XG5cdCAgICBpZiAoIXBhY2tldHMubGVuZ3RoKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgQXJyYXlCdWZmZXIoMCkpO1xuXHQgICAgfVxuXG5cdCAgICBmdW5jdGlvbiBlbmNvZGVPbmUocGFja2V0LCBkb25lQ2FsbGJhY2spIHtcblx0ICAgICAgZXhwb3J0cy5lbmNvZGVQYWNrZXQocGFja2V0LCB0cnVlLCB0cnVlLCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgICAgIHJldHVybiBkb25lQ2FsbGJhY2sobnVsbCwgZGF0YSk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBtYXAocGFja2V0cywgZW5jb2RlT25lLCBmdW5jdGlvbiAoZXJyLCBlbmNvZGVkUGFja2V0cykge1xuXHQgICAgICB2YXIgdG90YWxMZW5ndGggPSBlbmNvZGVkUGFja2V0cy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgcCkge1xuXHQgICAgICAgIHZhciBsZW47XG5cdCAgICAgICAgaWYgKHR5cGVvZiBwID09PSAnc3RyaW5nJykge1xuXHQgICAgICAgICAgbGVuID0gcC5sZW5ndGg7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIGxlbiA9IHAuYnl0ZUxlbmd0aDtcblx0ICAgICAgICB9XG5cdCAgICAgICAgcmV0dXJuIGFjYyArIGxlbi50b1N0cmluZygpLmxlbmd0aCArIGxlbiArIDI7IC8vIHN0cmluZy9iaW5hcnkgaWRlbnRpZmllciArIHNlcGFyYXRvciA9IDJcblx0ICAgICAgfSwgMCk7XG5cblx0ICAgICAgdmFyIHJlc3VsdEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkodG90YWxMZW5ndGgpO1xuXG5cdCAgICAgIHZhciBidWZmZXJJbmRleCA9IDA7XG5cdCAgICAgIGVuY29kZWRQYWNrZXRzLmZvckVhY2goZnVuY3Rpb24gKHApIHtcblx0ICAgICAgICB2YXIgaXNTdHJpbmcgPSB0eXBlb2YgcCA9PT0gJ3N0cmluZyc7XG5cdCAgICAgICAgdmFyIGFiID0gcDtcblx0ICAgICAgICBpZiAoaXNTdHJpbmcpIHtcblx0ICAgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkocC5sZW5ndGgpO1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZpZXdbaV0gPSBwLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICBhYiA9IHZpZXcuYnVmZmVyO1xuXHQgICAgICAgIH1cblxuXHQgICAgICAgIGlmIChpc1N0cmluZykge1xuXHQgICAgICAgICAgLy8gbm90IHRydWUgYmluYXJ5XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDA7XG5cdCAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgIC8vIHRydWUgYmluYXJ5XG5cdCAgICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDE7XG5cdCAgICAgICAgfVxuXG5cdCAgICAgICAgdmFyIGxlblN0ciA9IGFiLmJ5dGVMZW5ndGgudG9TdHJpbmcoKTtcblx0ICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlblN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSBwYXJzZUludChsZW5TdHJbaV0pO1xuXHQgICAgICAgIH1cblx0ICAgICAgICByZXN1bHRBcnJheVtidWZmZXJJbmRleCsrXSA9IDI1NTtcblxuXHQgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYWIpO1xuXHQgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgICAgcmVzdWx0QXJyYXlbYnVmZmVySW5kZXgrK10gPSB2aWV3W2ldO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cblx0ICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlc3VsdEFycmF5LmJ1ZmZlcik7XG5cdCAgICB9KTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogRW5jb2RlIGFzIEJsb2Jcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuZW5jb2RlUGF5bG9hZEFzQmxvYiA9IGZ1bmN0aW9uIChwYWNrZXRzLCBjYWxsYmFjaykge1xuXHQgICAgZnVuY3Rpb24gZW5jb2RlT25lKHBhY2tldCwgZG9uZUNhbGxiYWNrKSB7XG5cdCAgICAgIGV4cG9ydHMuZW5jb2RlUGFja2V0KHBhY2tldCwgdHJ1ZSwgdHJ1ZSwgZnVuY3Rpb24gKGVuY29kZWQpIHtcblx0ICAgICAgICB2YXIgYmluYXJ5SWRlbnRpZmllciA9IG5ldyBVaW50OEFycmF5KDEpO1xuXHQgICAgICAgIGJpbmFyeUlkZW50aWZpZXJbMF0gPSAxO1xuXHQgICAgICAgIGlmICh0eXBlb2YgZW5jb2RlZCA9PT0gJ3N0cmluZycpIHtcblx0ICAgICAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoZW5jb2RlZC5sZW5ndGgpO1xuXHQgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbmNvZGVkLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIHZpZXdbaV0gPSBlbmNvZGVkLmNoYXJDb2RlQXQoaSk7XG5cdCAgICAgICAgICB9XG5cdCAgICAgICAgICBlbmNvZGVkID0gdmlldy5idWZmZXI7XG5cdCAgICAgICAgICBiaW5hcnlJZGVudGlmaWVyWzBdID0gMDtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICB2YXIgbGVuID0gZW5jb2RlZCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyID8gZW5jb2RlZC5ieXRlTGVuZ3RoIDogZW5jb2RlZC5zaXplO1xuXG5cdCAgICAgICAgdmFyIGxlblN0ciA9IGxlbi50b1N0cmluZygpO1xuXHQgICAgICAgIHZhciBsZW5ndGhBcnkgPSBuZXcgVWludDhBcnJheShsZW5TdHIubGVuZ3RoICsgMSk7XG5cdCAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5TdHIubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICAgIGxlbmd0aEFyeVtpXSA9IHBhcnNlSW50KGxlblN0cltpXSk7XG5cdCAgICAgICAgfVxuXHQgICAgICAgIGxlbmd0aEFyeVtsZW5TdHIubGVuZ3RoXSA9IDI1NTtcblxuXHQgICAgICAgIGlmIChCbG9iJDEpIHtcblx0ICAgICAgICAgIHZhciBibG9iID0gbmV3IEJsb2IkMShbYmluYXJ5SWRlbnRpZmllci5idWZmZXIsIGxlbmd0aEFyeS5idWZmZXIsIGVuY29kZWRdKTtcblx0ICAgICAgICAgIGRvbmVDYWxsYmFjayhudWxsLCBibG9iKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXG5cdCAgICBtYXAocGFja2V0cywgZW5jb2RlT25lLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRzKSB7XG5cdCAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgQmxvYiQxKHJlc3VsdHMpKTtcblx0ICAgIH0pO1xuXHQgIH07XG5cblx0ICAvKlxuXHQgICAqIERlY29kZXMgZGF0YSB3aGVuIGEgcGF5bG9hZCBpcyBtYXliZSBleHBlY3RlZC4gU3RyaW5ncyBhcmUgZGVjb2RlZCBieVxuXHQgICAqIGludGVycHJldGluZyBlYWNoIGJ5dGUgYXMgYSBrZXkgY29kZSBmb3IgZW50cmllcyBtYXJrZWQgdG8gc3RhcnQgd2l0aCAwLiBTZWVcblx0ICAgKiBkZXNjcmlwdGlvbiBvZiBlbmNvZGVQYXlsb2FkQXNCaW5hcnlcblx0ICAgKlxuXHQgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IGRhdGEsIGNhbGxiYWNrIG1ldGhvZFxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmRlY29kZVBheWxvYWRBc0JpbmFyeSA9IGZ1bmN0aW9uIChkYXRhLCBiaW5hcnlUeXBlLCBjYWxsYmFjaykge1xuXHQgICAgaWYgKHR5cGVvZiBiaW5hcnlUeXBlID09PSAnZnVuY3Rpb24nKSB7XG5cdCAgICAgIGNhbGxiYWNrID0gYmluYXJ5VHlwZTtcblx0ICAgICAgYmluYXJ5VHlwZSA9IG51bGw7XG5cdCAgICB9XG5cblx0ICAgIHZhciBidWZmZXJUYWlsID0gZGF0YTtcblx0ICAgIHZhciBidWZmZXJzID0gW107XG5cblx0ICAgIHdoaWxlIChidWZmZXJUYWlsLmJ5dGVMZW5ndGggPiAwKSB7XG5cdCAgICAgIHZhciB0YWlsQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJUYWlsKTtcblx0ICAgICAgdmFyIGlzU3RyaW5nID0gdGFpbEFycmF5WzBdID09PSAwO1xuXHQgICAgICB2YXIgbXNnTGVuZ3RoID0gJyc7XG5cblx0ICAgICAgZm9yICh2YXIgaSA9IDE7OyBpKyspIHtcblx0ICAgICAgICBpZiAodGFpbEFycmF5W2ldID09PSAyNTUpIGJyZWFrO1xuXG5cdCAgICAgICAgLy8gMzEwID0gY2hhciBsZW5ndGggb2YgTnVtYmVyLk1BWF9WQUxVRVxuXHQgICAgICAgIGlmIChtc2dMZW5ndGgubGVuZ3RoID4gMzEwKSB7XG5cdCAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCAwLCAxKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBtc2dMZW5ndGggKz0gdGFpbEFycmF5W2ldO1xuXHQgICAgICB9XG5cblx0ICAgICAgYnVmZmVyVGFpbCA9IHNsaWNlQnVmZmVyKGJ1ZmZlclRhaWwsIDIgKyBtc2dMZW5ndGgubGVuZ3RoKTtcblx0ICAgICAgbXNnTGVuZ3RoID0gcGFyc2VJbnQobXNnTGVuZ3RoKTtcblxuXHQgICAgICB2YXIgbXNnID0gc2xpY2VCdWZmZXIoYnVmZmVyVGFpbCwgMCwgbXNnTGVuZ3RoKTtcblx0ICAgICAgaWYgKGlzU3RyaW5nKSB7XG5cdCAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgIG1zZyA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkobXNnKSk7XG5cdCAgICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgICAgLy8gaVBob25lIFNhZmFyaSBkb2Vzbid0IGxldCB5b3UgYXBwbHkgdG8gdHlwZWQgYXJyYXlzXG5cdCAgICAgICAgICB2YXIgdHlwZWQgPSBuZXcgVWludDhBcnJheShtc2cpO1xuXHQgICAgICAgICAgbXNnID0gJyc7XG5cdCAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGVkLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgICAgIG1zZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHR5cGVkW2ldKTtcblx0ICAgICAgICAgIH1cblx0ICAgICAgICB9XG5cdCAgICAgIH1cblxuXHQgICAgICBidWZmZXJzLnB1c2gobXNnKTtcblx0ICAgICAgYnVmZmVyVGFpbCA9IHNsaWNlQnVmZmVyKGJ1ZmZlclRhaWwsIG1zZ0xlbmd0aCk7XG5cdCAgICB9XG5cblx0ICAgIHZhciB0b3RhbCA9IGJ1ZmZlcnMubGVuZ3RoO1xuXHQgICAgYnVmZmVycy5mb3JFYWNoKGZ1bmN0aW9uIChidWZmZXIsIGkpIHtcblx0ICAgICAgY2FsbGJhY2soZXhwb3J0cy5kZWNvZGVQYWNrZXQoYnVmZmVyLCBiaW5hcnlUeXBlLCB0cnVlKSwgaSwgdG90YWwpO1xuXHQgICAgfSk7XG5cdCAgfTtcblx0fSk7XG5cdHZhciBicm93c2VyXzEkMSA9IGJyb3dzZXIkMi5wcm90b2NvbDtcblx0dmFyIGJyb3dzZXJfMiQxID0gYnJvd3NlciQyLnBhY2tldHM7XG5cdHZhciBicm93c2VyXzMkMSA9IGJyb3dzZXIkMi5lbmNvZGVQYWNrZXQ7XG5cdHZhciBicm93c2VyXzQkMSA9IGJyb3dzZXIkMi5lbmNvZGVCYXNlNjRQYWNrZXQ7XG5cdHZhciBicm93c2VyXzUkMSA9IGJyb3dzZXIkMi5kZWNvZGVQYWNrZXQ7XG5cdHZhciBicm93c2VyXzYkMSA9IGJyb3dzZXIkMi5kZWNvZGVCYXNlNjRQYWNrZXQ7XG5cdHZhciBicm93c2VyXzckMSA9IGJyb3dzZXIkMi5lbmNvZGVQYXlsb2FkO1xuXHR2YXIgYnJvd3Nlcl84ID0gYnJvd3NlciQyLmRlY29kZVBheWxvYWQ7XG5cdHZhciBicm93c2VyXzkgPSBicm93c2VyJDIuZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXI7XG5cdHZhciBicm93c2VyXzEwID0gYnJvd3NlciQyLmVuY29kZVBheWxvYWRBc0Jsb2I7XG5cdHZhciBicm93c2VyXzExID0gYnJvd3NlciQyLmRlY29kZVBheWxvYWRBc0JpbmFyeTtcblxuXHR2YXIgYnJvd3NlciQzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGJyb3dzZXIkMixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGJyb3dzZXIkMixcblx0XHRwcm90b2NvbDogYnJvd3Nlcl8xJDEsXG5cdFx0cGFja2V0czogYnJvd3Nlcl8yJDEsXG5cdFx0ZW5jb2RlUGFja2V0OiBicm93c2VyXzMkMSxcblx0XHRlbmNvZGVCYXNlNjRQYWNrZXQ6IGJyb3dzZXJfNCQxLFxuXHRcdGRlY29kZVBhY2tldDogYnJvd3Nlcl81JDEsXG5cdFx0ZGVjb2RlQmFzZTY0UGFja2V0OiBicm93c2VyXzYkMSxcblx0XHRlbmNvZGVQYXlsb2FkOiBicm93c2VyXzckMSxcblx0XHRkZWNvZGVQYXlsb2FkOiBicm93c2VyXzgsXG5cdFx0ZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXI6IGJyb3dzZXJfOSxcblx0XHRlbmNvZGVQYXlsb2FkQXNCbG9iOiBicm93c2VyXzEwLFxuXHRcdGRlY29kZVBheWxvYWRBc0JpbmFyeTogYnJvd3Nlcl8xMVxuXHR9KTtcblxuXHR2YXIgcGFyc2VyID0gKCBicm93c2VyJDMgJiYgYnJvd3NlciQyICkgfHwgYnJvd3NlciQzO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB0cmFuc3BvcnQgPSBUcmFuc3BvcnQ7XG5cblx0LyoqXG5cdCAqIFRyYW5zcG9ydCBhYnN0cmFjdCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRmdW5jdGlvbiBUcmFuc3BvcnQob3B0cykge1xuXHQgIHRoaXMucGF0aCA9IG9wdHMucGF0aDtcblx0ICB0aGlzLmhvc3RuYW1lID0gb3B0cy5ob3N0bmFtZTtcblx0ICB0aGlzLnBvcnQgPSBvcHRzLnBvcnQ7XG5cdCAgdGhpcy5zZWN1cmUgPSBvcHRzLnNlY3VyZTtcblx0ICB0aGlzLnF1ZXJ5ID0gb3B0cy5xdWVyeTtcblx0ICB0aGlzLnRpbWVzdGFtcFBhcmFtID0gb3B0cy50aW1lc3RhbXBQYXJhbTtcblx0ICB0aGlzLnRpbWVzdGFtcFJlcXVlc3RzID0gb3B0cy50aW1lc3RhbXBSZXF1ZXN0cztcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnJztcblx0ICB0aGlzLmFnZW50ID0gb3B0cy5hZ2VudCB8fCBmYWxzZTtcblx0ICB0aGlzLnNvY2tldCA9IG9wdHMuc29ja2V0O1xuXHQgIHRoaXMuZW5hYmxlc1hEUiA9IG9wdHMuZW5hYmxlc1hEUjtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMucGZ4ID0gb3B0cy5wZng7XG5cdCAgdGhpcy5rZXkgPSBvcHRzLmtleTtcblx0ICB0aGlzLnBhc3NwaHJhc2UgPSBvcHRzLnBhc3NwaHJhc2U7XG5cdCAgdGhpcy5jZXJ0ID0gb3B0cy5jZXJ0O1xuXHQgIHRoaXMuY2EgPSBvcHRzLmNhO1xuXHQgIHRoaXMuY2lwaGVycyA9IG9wdHMuY2lwaGVycztcblx0ICB0aGlzLnJlamVjdFVuYXV0aG9yaXplZCA9IG9wdHMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIHRoaXMuZm9yY2VOb2RlID0gb3B0cy5mb3JjZU5vZGU7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cdCAgdGhpcy5sb2NhbEFkZHJlc3MgPSBvcHRzLmxvY2FsQWRkcmVzcztcblx0fVxuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKFRyYW5zcG9ydC5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBFbWl0cyBhbiBlcnJvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0clxuXHQgKiBAcmV0dXJuIHtUcmFuc3BvcnR9IGZvciBjaGFpbmluZ1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uRXJyb3IgPSBmdW5jdGlvbiAobXNnLCBkZXNjKSB7XG5cdCAgdmFyIGVyciA9IG5ldyBFcnJvcihtc2cpO1xuXHQgIGVyci50eXBlID0gJ1RyYW5zcG9ydEVycm9yJztcblx0ICBlcnIuZGVzY3JpcHRpb24gPSBkZXNjO1xuXHQgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBPcGVucyB0aGUgdHJhbnNwb3J0LlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdjbG9zZWQnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW5pbmcnO1xuXHQgICAgdGhpcy5kb09wZW4oKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSB0cmFuc3BvcnQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgdGhpcy5kb0Nsb3NlKCk7XG5cdCAgICB0aGlzLm9uQ2xvc2UoKTtcblx0ICB9XG5cblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgbXVsdGlwbGUgcGFja2V0cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gcGFja2V0c1xuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0VHJhbnNwb3J0LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKHBhY2tldHMpIHtcblx0ICBpZiAoJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIHRoaXMud3JpdGUocGFja2V0cyk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRocm93IG5ldyBFcnJvcignVHJhbnNwb3J0IG5vdCBvcGVuJyk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBvcGVuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgdGhpcy53cml0YWJsZSA9IHRydWU7XG5cdCAgdGhpcy5lbWl0KCdvcGVuJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aXRoIGRhdGEuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uRGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdmFyIHBhY2tldCA9IHBhcnNlci5kZWNvZGVQYWNrZXQoZGF0YSwgdGhpcy5zb2NrZXQuYmluYXJ5VHlwZSk7XG5cdCAgdGhpcy5vblBhY2tldChwYWNrZXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2l0aCBhIGRlY29kZWQgcGFja2V0LlxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIHRoaXMuZW1pdCgncGFja2V0JywgcGFja2V0KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gY2xvc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRUcmFuc3BvcnQucHJvdG90eXBlLm9uQ2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy5lbWl0KCdjbG9zZScpO1xuXHR9O1xuXG5cdHZhciB0cmFuc3BvcnQkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0cmFuc3BvcnQsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB0cmFuc3BvcnRcblx0fSk7XG5cblx0LyoqXHJcblx0ICogQ29tcGlsZXMgYSBxdWVyeXN0cmluZ1xyXG5cdCAqIFJldHVybnMgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3RcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fVxyXG5cdCAqIEBhcGkgcHJpdmF0ZVxyXG5cdCAqL1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbiBlbmNvZGUob2JqKSB7XG5cdCAgdmFyIHN0ciA9ICcnO1xuXG5cdCAgZm9yICh2YXIgaSBpbiBvYmopIHtcblx0ICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgaWYgKHN0ci5sZW5ndGgpIHN0ciArPSAnJic7XG5cdCAgICAgIHN0ciArPSBlbmNvZGVVUklDb21wb25lbnQoaSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQob2JqW2ldKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gc3RyO1xuXHR9O1xuXG5cdC8qKlxyXG5cdCAqIFBhcnNlcyBhIHNpbXBsZSBxdWVyeXN0cmluZyBpbnRvIGFuIG9iamVjdFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IHFzXHJcblx0ICogQGFwaSBwcml2YXRlXHJcblx0ICovXG5cblx0dmFyIGRlY29kZSA9IGZ1bmN0aW9uIGRlY29kZShxcykge1xuXHQgIHZhciBxcnkgPSB7fTtcblx0ICB2YXIgcGFpcnMgPSBxcy5zcGxpdCgnJicpO1xuXHQgIGZvciAodmFyIGkgPSAwLCBsID0gcGFpcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdCAgICB2YXIgcGFpciA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG5cdCAgICBxcnlbZGVjb2RlVVJJQ29tcG9uZW50KHBhaXJbMF0pXSA9IGRlY29kZVVSSUNvbXBvbmVudChwYWlyWzFdKTtcblx0ICB9XG5cdCAgcmV0dXJuIHFyeTtcblx0fTtcblxuXHR2YXIgcGFyc2VxcyA9IHtcblx0ICBlbmNvZGU6IGVuY29kZSxcblx0ICBkZWNvZGU6IGRlY29kZVxuXHR9O1xuXG5cdHZhciBwYXJzZXFzJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogcGFyc2Vxcyxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBhcnNlcXMsXG5cdFx0ZW5jb2RlOiBlbmNvZGUsXG5cdFx0ZGVjb2RlOiBkZWNvZGVcblx0fSk7XG5cblx0dmFyIGNvbXBvbmVudEluaGVyaXQgPSBmdW5jdGlvbiBjb21wb25lbnRJbmhlcml0KGEsIGIpIHtcblx0ICB2YXIgZm4gPSBmdW5jdGlvbiBmbigpIHt9O1xuXHQgIGZuLnByb3RvdHlwZSA9IGIucHJvdG90eXBlO1xuXHQgIGEucHJvdG90eXBlID0gbmV3IGZuKCk7XG5cdCAgYS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBhO1xuXHR9O1xuXG5cdHZhciBjb21wb25lbnRJbmhlcml0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogY29tcG9uZW50SW5oZXJpdCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGNvbXBvbmVudEluaGVyaXRcblx0fSk7XG5cblx0dmFyIGFscGhhYmV0ID0gJzAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6LV8nLnNwbGl0KCcnKSxcblx0ICAgIGxlbmd0aCA9IDY0LFxuXHQgICAgbWFwID0ge30sXG5cdCAgICBzZWVkID0gMCxcblx0ICAgIGkgPSAwLFxuXHQgICAgcHJldjtcblxuXHQvKipcblx0ICogUmV0dXJuIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgc3BlY2lmaWVkIG51bWJlci5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG51bSBUaGUgbnVtYmVyIHRvIGNvbnZlcnQuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG51bWJlci5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZSQxKG51bSkge1xuXHQgIHZhciBlbmNvZGVkID0gJyc7XG5cblx0ICBkbyB7XG5cdCAgICBlbmNvZGVkID0gYWxwaGFiZXRbbnVtICUgbGVuZ3RoXSArIGVuY29kZWQ7XG5cdCAgICBudW0gPSBNYXRoLmZsb29yKG51bSAvIGxlbmd0aCk7XG5cdCAgfSB3aGlsZSAobnVtID4gMCk7XG5cblx0ICByZXR1cm4gZW5jb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGludGVnZXIgdmFsdWUgc3BlY2lmaWVkIGJ5IHRoZSBnaXZlbiBzdHJpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIHN0cmluZyB0byBjb252ZXJ0LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgaW50ZWdlciB2YWx1ZSByZXByZXNlbnRlZCBieSB0aGUgc3RyaW5nLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlJDEoc3RyKSB7XG5cdCAgdmFyIGRlY29kZWQgPSAwO1xuXG5cdCAgZm9yIChpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuXHQgICAgZGVjb2RlZCA9IGRlY29kZWQgKiBsZW5ndGggKyBtYXBbc3RyLmNoYXJBdChpKV07XG5cdCAgfVxuXG5cdCAgcmV0dXJuIGRlY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogWWVhc3Q6IEEgdGlueSBncm93aW5nIGlkIGdlbmVyYXRvci5cblx0ICpcblx0ICogQHJldHVybnMge1N0cmluZ30gQSB1bmlxdWUgaWQuXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXHRmdW5jdGlvbiB5ZWFzdCgpIHtcblx0ICB2YXIgbm93ID0gZW5jb2RlJDEoK25ldyBEYXRlKCkpO1xuXG5cdCAgaWYgKG5vdyAhPT0gcHJldikgcmV0dXJuIHNlZWQgPSAwLCBwcmV2ID0gbm93O1xuXHQgIHJldHVybiBub3cgKyAnLicgKyBlbmNvZGUkMShzZWVkKyspO1xuXHR9XG5cblx0Ly9cblx0Ly8gTWFwIGVhY2ggY2hhcmFjdGVyIHRvIGl0cyBpbmRleC5cblx0Ly9cblx0Zm9yICg7IGkgPCBsZW5ndGg7IGkrKykge1xuXHQgIG1hcFthbHBoYWJldFtpXV0gPSBpO1xuXHR9IC8vXG5cdC8vIEV4cG9zZSB0aGUgYHllYXN0YCwgYGVuY29kZWAgYW5kIGBkZWNvZGVgIGZ1bmN0aW9ucy5cblx0Ly9cblx0eWVhc3QuZW5jb2RlID0gZW5jb2RlJDE7XG5cdHllYXN0LmRlY29kZSA9IGRlY29kZSQxO1xuXHR2YXIgeWVhc3RfMSA9IHllYXN0O1xuXG5cdHZhciB5ZWFzdCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHllYXN0XzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB5ZWFzdF8xXG5cdH0pO1xuXG5cdHZhciBUcmFuc3BvcnQkMSA9ICggdHJhbnNwb3J0JDEgJiYgdHJhbnNwb3J0ICkgfHwgdHJhbnNwb3J0JDE7XG5cblx0dmFyIHBhcnNlcXMkMiA9ICggcGFyc2VxcyQxICYmIHBhcnNlcXMgKSB8fCBwYXJzZXFzJDE7XG5cblx0dmFyIGluaGVyaXQgPSAoIGNvbXBvbmVudEluaGVyaXQkMSAmJiBjb21wb25lbnRJbmhlcml0ICkgfHwgY29tcG9uZW50SW5oZXJpdCQxO1xuXG5cdHZhciB5ZWFzdCQyID0gKCB5ZWFzdCQxICYmIHllYXN0XzEgKSB8fCB5ZWFzdCQxO1xuXG5cdHZhciByZXF1aXJlJCQxID0gKCB4bWxodHRwcmVxdWVzdCQxICYmIHhtbGh0dHByZXF1ZXN0ICkgfHwgeG1saHR0cHJlcXVlc3QkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDMgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6cG9sbGluZycpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmcgPSBQb2xsaW5nO1xuXG5cdC8qKlxuXHQgKiBJcyBYSFIyIHN1cHBvcnRlZD9cblx0ICovXG5cblx0dmFyIGhhc1hIUjIgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIFhNTEh0dHBSZXF1ZXN0ID0gcmVxdWlyZSQkMTtcblx0ICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KHsgeGRvbWFpbjogZmFsc2UgfSk7XG5cdCAgcmV0dXJuIG51bGwgIT0geGhyLnJlc3BvbnNlVHlwZTtcblx0fSgpO1xuXG5cdC8qKlxuXHQgKiBQb2xsaW5nIGludGVyZmFjZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdHNcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFBvbGxpbmcob3B0cykge1xuXHQgIHZhciBmb3JjZUJhc2U2NCA9IG9wdHMgJiYgb3B0cy5mb3JjZUJhc2U2NDtcblx0ICBpZiAoIWhhc1hIUjIgfHwgZm9yY2VCYXNlNjQpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICB9XG5cdCAgVHJhbnNwb3J0JDEuY2FsbCh0aGlzLCBvcHRzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbmhlcml0cyBmcm9tIFRyYW5zcG9ydC5cblx0ICovXG5cblx0aW5oZXJpdChQb2xsaW5nLCBUcmFuc3BvcnQkMSk7XG5cblx0LyoqXG5cdCAqIFRyYW5zcG9ydCBuYW1lLlxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5uYW1lID0gJ3BvbGxpbmcnO1xuXG5cdC8qKlxuXHQgKiBPcGVucyB0aGUgc29ja2V0ICh0cmlnZ2VycyBwb2xsaW5nKS4gV2Ugd3JpdGUgYSBQSU5HIG1lc3NhZ2UgdG8gZGV0ZXJtaW5lXG5cdCAqIHdoZW4gdGhlIHRyYW5zcG9ydCBpcyBvcGVuLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUuZG9PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMucG9sbCgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQYXVzZXMgcG9sbGluZy5cblx0ICpcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdXBvbiBidWZmZXJzIGFyZSBmbHVzaGVkIGFuZCB0cmFuc3BvcnQgaXMgcGF1c2VkXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uIChvblBhdXNlKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ3BhdXNpbmcnO1xuXG5cdCAgZnVuY3Rpb24gcGF1c2UoKSB7XG5cdCAgICBkZWJ1ZyQzKCdwYXVzZWQnKTtcblx0ICAgIHNlbGYucmVhZHlTdGF0ZSA9ICdwYXVzZWQnO1xuXHQgICAgb25QYXVzZSgpO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLnBvbGxpbmcgfHwgIXRoaXMud3JpdGFibGUpIHtcblx0ICAgIHZhciB0b3RhbCA9IDA7XG5cblx0ICAgIGlmICh0aGlzLnBvbGxpbmcpIHtcblx0ICAgICAgZGVidWckMygnd2UgYXJlIGN1cnJlbnRseSBwb2xsaW5nIC0gd2FpdGluZyB0byBwYXVzZScpO1xuXHQgICAgICB0b3RhbCsrO1xuXHQgICAgICB0aGlzLm9uY2UoJ3BvbGxDb21wbGV0ZScsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBkZWJ1ZyQzKCdwcmUtcGF1c2UgcG9sbGluZyBjb21wbGV0ZScpO1xuXHQgICAgICAgIC0tdG90YWwgfHwgcGF1c2UoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9XG5cblx0ICAgIGlmICghdGhpcy53cml0YWJsZSkge1xuXHQgICAgICBkZWJ1ZyQzKCd3ZSBhcmUgY3VycmVudGx5IHdyaXRpbmcgLSB3YWl0aW5nIHRvIHBhdXNlJyk7XG5cdCAgICAgIHRvdGFsKys7XG5cdCAgICAgIHRoaXMub25jZSgnZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgZGVidWckMygncHJlLXBhdXNlIHdyaXRpbmcgY29tcGxldGUnKTtcblx0ICAgICAgICAtLXRvdGFsIHx8IHBhdXNlKCk7XG5cdCAgICAgIH0pO1xuXHQgICAgfVxuXHQgIH0gZWxzZSB7XG5cdCAgICBwYXVzZSgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogU3RhcnRzIHBvbGxpbmcgY3ljbGUuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLnBvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckMygncG9sbGluZycpO1xuXHQgIHRoaXMucG9sbGluZyA9IHRydWU7XG5cdCAgdGhpcy5kb1BvbGwoKTtcblx0ICB0aGlzLmVtaXQoJ3BvbGwnKTtcblx0fTtcblxuXHQvKipcblx0ICogT3ZlcmxvYWRzIG9uRGF0YSB0byBkZXRlY3QgcGF5bG9hZHMuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRQb2xsaW5nLnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBkZWJ1ZyQzKCdwb2xsaW5nIGdvdCBkYXRhICVzJywgZGF0YSk7XG5cdCAgdmFyIGNhbGxiYWNrID0gZnVuY3Rpb24gY2FsbGJhY2socGFja2V0LCBpbmRleCwgdG90YWwpIHtcblx0ICAgIC8vIGlmIGl0cyB0aGUgZmlyc3QgbWVzc2FnZSB3ZSBjb25zaWRlciB0aGUgdHJhbnNwb3J0IG9wZW5cblx0ICAgIGlmICgnb3BlbmluZycgPT09IHNlbGYucmVhZHlTdGF0ZSkge1xuXHQgICAgICBzZWxmLm9uT3BlbigpO1xuXHQgICAgfVxuXG5cdCAgICAvLyBpZiBpdHMgYSBjbG9zZSBwYWNrZXQsIHdlIGNsb3NlIHRoZSBvbmdvaW5nIHJlcXVlc3RzXG5cdCAgICBpZiAoJ2Nsb3NlJyA9PT0gcGFja2V0LnR5cGUpIHtcblx0ICAgICAgc2VsZi5vbkNsb3NlKCk7XG5cdCAgICAgIHJldHVybiBmYWxzZTtcblx0ICAgIH1cblxuXHQgICAgLy8gb3RoZXJ3aXNlIGJ5cGFzcyBvbkRhdGEgYW5kIGhhbmRsZSB0aGUgbWVzc2FnZVxuXHQgICAgc2VsZi5vblBhY2tldChwYWNrZXQpO1xuXHQgIH07XG5cblx0ICAvLyBkZWNvZGUgcGF5bG9hZFxuXHQgIHBhcnNlci5kZWNvZGVQYXlsb2FkKGRhdGEsIHRoaXMuc29ja2V0LmJpbmFyeVR5cGUsIGNhbGxiYWNrKTtcblxuXHQgIC8vIGlmIGFuIGV2ZW50IGRpZCBub3QgdHJpZ2dlciBjbG9zaW5nXG5cdCAgaWYgKCdjbG9zZWQnICE9PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIC8vIGlmIHdlIGdvdCBkYXRhIHdlJ3JlIG5vdCBwb2xsaW5nXG5cdCAgICB0aGlzLnBvbGxpbmcgPSBmYWxzZTtcblx0ICAgIHRoaXMuZW1pdCgncG9sbENvbXBsZXRlJyk7XG5cblx0ICAgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgICB0aGlzLnBvbGwoKTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIGRlYnVnJDMoJ2lnbm9yaW5nIHBvbGwgLSB0cmFuc3BvcnQgc3RhdGUgXCIlc1wiJywgdGhpcy5yZWFkeVN0YXRlKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEZvciBwb2xsaW5nLCBzZW5kIGEgY2xvc2UgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUuZG9DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBmdW5jdGlvbiBjbG9zZSgpIHtcblx0ICAgIGRlYnVnJDMoJ3dyaXRpbmcgY2xvc2UgcGFja2V0Jyk7XG5cdCAgICBzZWxmLndyaXRlKFt7IHR5cGU6ICdjbG9zZScgfV0pO1xuXHQgIH1cblxuXHQgIGlmICgnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgZGVidWckMygndHJhbnNwb3J0IG9wZW4gLSBjbG9zaW5nJyk7XG5cdCAgICBjbG9zZSgpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAvLyBpbiBjYXNlIHdlJ3JlIHRyeWluZyB0byBjbG9zZSB3aGlsZVxuXHQgICAgLy8gaGFuZHNoYWtpbmcgaXMgaW4gcHJvZ3Jlc3MgKEdILTE2NClcblx0ICAgIGRlYnVnJDMoJ3RyYW5zcG9ydCBub3Qgb3BlbiAtIGRlZmVycmluZyBjbG9zZScpO1xuXHQgICAgdGhpcy5vbmNlKCdvcGVuJywgY2xvc2UpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogV3JpdGVzIGEgcGFja2V0cyBwYXlsb2FkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5fSBkYXRhIHBhY2tldHNcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gZHJhaW4gY2FsbGJhY2tcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFBvbGxpbmcucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHBhY2tldHMpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXHQgIHZhciBjYWxsYmFja2ZuID0gZnVuY3Rpb24gY2FsbGJhY2tmbigpIHtcblx0ICAgIHNlbGYud3JpdGFibGUgPSB0cnVlO1xuXHQgICAgc2VsZi5lbWl0KCdkcmFpbicpO1xuXHQgIH07XG5cblx0ICBwYXJzZXIuZW5jb2RlUGF5bG9hZChwYWNrZXRzLCB0aGlzLnN1cHBvcnRzQmluYXJ5LCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgc2VsZi5kb1dyaXRlKGRhdGEsIGNhbGxiYWNrZm4pO1xuXHQgIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgdXJpIGZvciBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UG9sbGluZy5wcm90b3R5cGUudXJpID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBxdWVyeSA9IHRoaXMucXVlcnkgfHwge307XG5cdCAgdmFyIHNjaGVtYSA9IHRoaXMuc2VjdXJlID8gJ2h0dHBzJyA6ICdodHRwJztcblx0ICB2YXIgcG9ydCA9ICcnO1xuXG5cdCAgLy8gY2FjaGUgYnVzdGluZyBpcyBmb3JjZWRcblx0ICBpZiAoZmFsc2UgIT09IHRoaXMudGltZXN0YW1wUmVxdWVzdHMpIHtcblx0ICAgIHF1ZXJ5W3RoaXMudGltZXN0YW1wUGFyYW1dID0geWVhc3QkMigpO1xuXHQgIH1cblxuXHQgIGlmICghdGhpcy5zdXBwb3J0c0JpbmFyeSAmJiAhcXVlcnkuc2lkKSB7XG5cdCAgICBxdWVyeS5iNjQgPSAxO1xuXHQgIH1cblxuXHQgIHF1ZXJ5ID0gcGFyc2VxcyQyLmVuY29kZShxdWVyeSk7XG5cblx0ICAvLyBhdm9pZCBwb3J0IGlmIGRlZmF1bHQgZm9yIHNjaGVtYVxuXHQgIGlmICh0aGlzLnBvcnQgJiYgKCdodHRwcycgPT09IHNjaGVtYSAmJiBOdW1iZXIodGhpcy5wb3J0KSAhPT0gNDQzIHx8ICdodHRwJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA4MCkpIHtcblx0ICAgIHBvcnQgPSAnOicgKyB0aGlzLnBvcnQ7XG5cdCAgfVxuXG5cdCAgLy8gcHJlcGVuZCA/IHRvIHF1ZXJ5XG5cdCAgaWYgKHF1ZXJ5Lmxlbmd0aCkge1xuXHQgICAgcXVlcnkgPSAnPycgKyBxdWVyeTtcblx0ICB9XG5cblx0ICB2YXIgaXB2NiA9IHRoaXMuaG9zdG5hbWUuaW5kZXhPZignOicpICE9PSAtMTtcblx0ICByZXR1cm4gc2NoZW1hICsgJzovLycgKyAoaXB2NiA/ICdbJyArIHRoaXMuaG9zdG5hbWUgKyAnXScgOiB0aGlzLmhvc3RuYW1lKSArIHBvcnQgKyB0aGlzLnBhdGggKyBxdWVyeTtcblx0fTtcblxuXHR2YXIgcG9sbGluZyQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmcsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwb2xsaW5nXG5cdH0pO1xuXG5cdHZhciBQb2xsaW5nJDEgPSAoIHBvbGxpbmckMSAmJiBwb2xsaW5nICkgfHwgcG9sbGluZyQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgcmVxdWlyZW1lbnRzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNCA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDpwb2xsaW5nLXhocicpO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmdYaHIgPSBYSFI7XG5cdHZhciBSZXF1ZXN0XzEgPSBSZXF1ZXN0O1xuXG5cdC8qKlxuXHQgKiBFbXB0eSBmdW5jdGlvblxuXHQgKi9cblxuXHRmdW5jdGlvbiBlbXB0eSgpIHt9XG5cblx0LyoqXG5cdCAqIFhIUiBQb2xsaW5nIGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBYSFIob3B0cykge1xuXHQgIFBvbGxpbmckMS5jYWxsKHRoaXMsIG9wdHMpO1xuXHQgIHRoaXMucmVxdWVzdFRpbWVvdXQgPSBvcHRzLnJlcXVlc3RUaW1lb3V0O1xuXHQgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwubG9jYXRpb24pIHtcblx0ICAgIHZhciBpc1NTTCA9ICdodHRwczonID09PSBsb2NhdGlvbi5wcm90b2NvbDtcblx0ICAgIHZhciBwb3J0ID0gbG9jYXRpb24ucG9ydDtcblxuXHQgICAgLy8gc29tZSB1c2VyIGFnZW50cyBoYXZlIGVtcHR5IGBsb2NhdGlvbi5wb3J0YFxuXHQgICAgaWYgKCFwb3J0KSB7XG5cdCAgICAgIHBvcnQgPSBpc1NTTCA/IDQ0MyA6IDgwO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLnhkID0gb3B0cy5ob3N0bmFtZSAhPT0gY29tbW9uanNHbG9iYWwubG9jYXRpb24uaG9zdG5hbWUgfHwgcG9ydCAhPT0gb3B0cy5wb3J0O1xuXHQgICAgdGhpcy54cyA9IG9wdHMuc2VjdXJlICE9PSBpc1NTTDtcblx0ICB9XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBQb2xsaW5nLlxuXHQgKi9cblxuXHRpbmhlcml0KFhIUiwgUG9sbGluZyQxKTtcblxuXHQvKipcblx0ICogWEhSIHN1cHBvcnRzIGJpbmFyeVxuXHQgKi9cblxuXHRYSFIucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5ID0gdHJ1ZTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2Rcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uIChvcHRzKSB7XG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cdCAgb3B0cy51cmkgPSB0aGlzLnVyaSgpO1xuXHQgIG9wdHMueGQgPSB0aGlzLnhkO1xuXHQgIG9wdHMueHMgPSB0aGlzLnhzO1xuXHQgIG9wdHMuYWdlbnQgPSB0aGlzLmFnZW50IHx8IGZhbHNlO1xuXHQgIG9wdHMuc3VwcG9ydHNCaW5hcnkgPSB0aGlzLnN1cHBvcnRzQmluYXJ5O1xuXHQgIG9wdHMuZW5hYmxlc1hEUiA9IHRoaXMuZW5hYmxlc1hEUjtcblxuXHQgIC8vIFNTTCBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIG9wdHMucGZ4ID0gdGhpcy5wZng7XG5cdCAgb3B0cy5rZXkgPSB0aGlzLmtleTtcblx0ICBvcHRzLnBhc3NwaHJhc2UgPSB0aGlzLnBhc3NwaHJhc2U7XG5cdCAgb3B0cy5jZXJ0ID0gdGhpcy5jZXJ0O1xuXHQgIG9wdHMuY2EgPSB0aGlzLmNhO1xuXHQgIG9wdHMuY2lwaGVycyA9IHRoaXMuY2lwaGVycztcblx0ICBvcHRzLnJlamVjdFVuYXV0aG9yaXplZCA9IHRoaXMucmVqZWN0VW5hdXRob3JpemVkO1xuXHQgIG9wdHMucmVxdWVzdFRpbWVvdXQgPSB0aGlzLnJlcXVlc3RUaW1lb3V0O1xuXG5cdCAgLy8gb3RoZXIgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLmV4dHJhSGVhZGVycyA9IHRoaXMuZXh0cmFIZWFkZXJzO1xuXG5cdCAgcmV0dXJuIG5ldyBSZXF1ZXN0KG9wdHMpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGF0YSB0byBzZW5kLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsZWQgdXBvbiBmbHVzaC5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFhIUi5wcm90b3R5cGUuZG9Xcml0ZSA9IGZ1bmN0aW9uIChkYXRhLCBmbikge1xuXHQgIHZhciBpc0JpbmFyeSA9IHR5cGVvZiBkYXRhICE9PSAnc3RyaW5nJyAmJiBkYXRhICE9PSB1bmRlZmluZWQ7XG5cdCAgdmFyIHJlcSA9IHRoaXMucmVxdWVzdCh7IG1ldGhvZDogJ1BPU1QnLCBkYXRhOiBkYXRhLCBpc0JpbmFyeTogaXNCaW5hcnkgfSk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHJlcS5vbignc3VjY2VzcycsIGZuKTtcblx0ICByZXEub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVycikge1xuXHQgICAgc2VsZi5vbkVycm9yKCd4aHIgcG9zdCBlcnJvcicsIGVycik7XG5cdCAgfSk7XG5cdCAgdGhpcy5zZW5kWGhyID0gcmVxO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgYSBwb2xsIGN5Y2xlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0WEhSLnByb3RvdHlwZS5kb1BvbGwgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNCgneGhyIHBvbGwnKTtcblx0ICB2YXIgcmVxID0gdGhpcy5yZXF1ZXN0KCk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHJlcS5vbignZGF0YScsIGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgICBzZWxmLm9uRGF0YShkYXRhKTtcblx0ICB9KTtcblx0ICByZXEub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVycikge1xuXHQgICAgc2VsZi5vbkVycm9yKCd4aHIgcG9sbCBlcnJvcicsIGVycik7XG5cdCAgfSk7XG5cdCAgdGhpcy5wb2xsWGhyID0gcmVxO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZXF1ZXN0IGNvbnN0cnVjdG9yXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIFJlcXVlc3Qob3B0cykge1xuXHQgIHRoaXMubWV0aG9kID0gb3B0cy5tZXRob2QgfHwgJ0dFVCc7XG5cdCAgdGhpcy51cmkgPSBvcHRzLnVyaTtcblx0ICB0aGlzLnhkID0gISFvcHRzLnhkO1xuXHQgIHRoaXMueHMgPSAhIW9wdHMueHM7XG5cdCAgdGhpcy5hc3luYyA9IGZhbHNlICE9PSBvcHRzLmFzeW5jO1xuXHQgIHRoaXMuZGF0YSA9IHVuZGVmaW5lZCAhPT0gb3B0cy5kYXRhID8gb3B0cy5kYXRhIDogbnVsbDtcblx0ICB0aGlzLmFnZW50ID0gb3B0cy5hZ2VudDtcblx0ICB0aGlzLmlzQmluYXJ5ID0gb3B0cy5pc0JpbmFyeTtcblx0ICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gb3B0cy5zdXBwb3J0c0JpbmFyeTtcblx0ICB0aGlzLmVuYWJsZXNYRFIgPSBvcHRzLmVuYWJsZXNYRFI7XG5cdCAgdGhpcy5yZXF1ZXN0VGltZW91dCA9IG9wdHMucmVxdWVzdFRpbWVvdXQ7XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICB0aGlzLnBmeCA9IG9wdHMucGZ4O1xuXHQgIHRoaXMua2V5ID0gb3B0cy5rZXk7XG5cdCAgdGhpcy5wYXNzcGhyYXNlID0gb3B0cy5wYXNzcGhyYXNlO1xuXHQgIHRoaXMuY2VydCA9IG9wdHMuY2VydDtcblx0ICB0aGlzLmNhID0gb3B0cy5jYTtcblx0ICB0aGlzLmNpcGhlcnMgPSBvcHRzLmNpcGhlcnM7XG5cdCAgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQgPSBvcHRzLnJlamVjdFVuYXV0aG9yaXplZDtcblxuXHQgIC8vIG90aGVyIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5leHRyYUhlYWRlcnMgPSBvcHRzLmV4dHJhSGVhZGVycztcblxuXHQgIHRoaXMuY3JlYXRlKCk7XG5cdH1cblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihSZXF1ZXN0LnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdGhlIFhIUiBvYmplY3QgYW5kIHNlbmRzIHRoZSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBvcHRzID0geyBhZ2VudDogdGhpcy5hZ2VudCwgeGRvbWFpbjogdGhpcy54ZCwgeHNjaGVtZTogdGhpcy54cywgZW5hYmxlc1hEUjogdGhpcy5lbmFibGVzWERSIH07XG5cblx0ICAvLyBTU0wgb3B0aW9ucyBmb3IgTm9kZS5qcyBjbGllbnRcblx0ICBvcHRzLnBmeCA9IHRoaXMucGZ4O1xuXHQgIG9wdHMua2V5ID0gdGhpcy5rZXk7XG5cdCAgb3B0cy5wYXNzcGhyYXNlID0gdGhpcy5wYXNzcGhyYXNlO1xuXHQgIG9wdHMuY2VydCA9IHRoaXMuY2VydDtcblx0ICBvcHRzLmNhID0gdGhpcy5jYTtcblx0ICBvcHRzLmNpcGhlcnMgPSB0aGlzLmNpcGhlcnM7XG5cdCAgb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPSB0aGlzLnJlamVjdFVuYXV0aG9yaXplZDtcblxuXHQgIHZhciB4aHIgPSB0aGlzLnhociA9IG5ldyByZXF1aXJlJCQxKG9wdHMpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIHRyeSB7XG5cdCAgICBkZWJ1ZyQ0KCd4aHIgb3BlbiAlczogJXMnLCB0aGlzLm1ldGhvZCwgdGhpcy51cmkpO1xuXHQgICAgeGhyLm9wZW4odGhpcy5tZXRob2QsIHRoaXMudXJpLCB0aGlzLmFzeW5jKTtcblx0ICAgIHRyeSB7XG5cdCAgICAgIGlmICh0aGlzLmV4dHJhSGVhZGVycykge1xuXHQgICAgICAgIHhoci5zZXREaXNhYmxlSGVhZGVyQ2hlY2sgJiYgeGhyLnNldERpc2FibGVIZWFkZXJDaGVjayh0cnVlKTtcblx0ICAgICAgICBmb3IgKHZhciBpIGluIHRoaXMuZXh0cmFIZWFkZXJzKSB7XG5cdCAgICAgICAgICBpZiAodGhpcy5leHRyYUhlYWRlcnMuaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoaSwgdGhpcy5leHRyYUhlYWRlcnNbaV0pO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblx0ICAgICAgfVxuXHQgICAgfSBjYXRjaCAoZSkge31cblxuXHQgICAgaWYgKCdQT1NUJyA9PT0gdGhpcy5tZXRob2QpIHtcblx0ICAgICAgdHJ5IHtcblx0ICAgICAgICBpZiAodGhpcy5pc0JpbmFyeSkge1xuXHQgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKTtcblx0ICAgICAgICB9XG5cdCAgICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgICB9XG5cblx0ICAgIHRyeSB7XG5cdCAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnKi8qJyk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXG5cdCAgICAvLyBpZTYgY2hlY2tcblx0ICAgIGlmICgnd2l0aENyZWRlbnRpYWxzJyBpbiB4aHIpIHtcblx0ICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLnJlcXVlc3RUaW1lb3V0KSB7XG5cdCAgICAgIHhoci50aW1lb3V0ID0gdGhpcy5yZXF1ZXN0VGltZW91dDtcblx0ICAgIH1cblxuXHQgICAgaWYgKHRoaXMuaGFzWERSKCkpIHtcblx0ICAgICAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBzZWxmLm9uTG9hZCgpO1xuXHQgICAgICB9O1xuXHQgICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICBzZWxmLm9uRXJyb3IoeGhyLnJlc3BvbnNlVGV4dCk7XG5cdCAgICAgIH07XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuXHQgICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gMikge1xuXHQgICAgICAgICAgdHJ5IHtcblx0ICAgICAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKTtcblx0ICAgICAgICAgICAgaWYgKHNlbGYuc3VwcG9ydHNCaW5hcnkgJiYgY29udGVudFR5cGUgPT09ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nKSB7XG5cdCAgICAgICAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG5cdCAgICAgICAgfVxuXHQgICAgICAgIGlmICg0ICE9PSB4aHIucmVhZHlTdGF0ZSkgcmV0dXJuO1xuXHQgICAgICAgIGlmICgyMDAgPT09IHhoci5zdGF0dXMgfHwgMTIyMyA9PT0geGhyLnN0YXR1cykge1xuXHQgICAgICAgICAgc2VsZi5vbkxvYWQoKTtcblx0ICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgLy8gbWFrZSBzdXJlIHRoZSBgZXJyb3JgIGV2ZW50IGhhbmRsZXIgdGhhdCdzIHVzZXItc2V0XG5cdCAgICAgICAgICAvLyBkb2VzIG5vdCB0aHJvdyBpbiB0aGUgc2FtZSB0aWNrIGFuZCBnZXRzIGNhdWdodCBoZXJlXG5cdCAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgc2VsZi5vbkVycm9yKHhoci5zdGF0dXMpO1xuXHQgICAgICAgICAgfSwgMCk7XG5cdCAgICAgICAgfVxuXHQgICAgICB9O1xuXHQgICAgfVxuXG5cdCAgICBkZWJ1ZyQ0KCd4aHIgZGF0YSAlcycsIHRoaXMuZGF0YSk7XG5cdCAgICB4aHIuc2VuZCh0aGlzLmRhdGEpO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIC8vIE5lZWQgdG8gZGVmZXIgc2luY2UgLmNyZWF0ZSgpIGlzIGNhbGxlZCBkaXJlY3RseSBmaHJvbSB0aGUgY29uc3RydWN0b3Jcblx0ICAgIC8vIGFuZCB0aHVzIHRoZSAnZXJyb3InIGV2ZW50IGNhbiBvbmx5IGJlIG9ubHkgYm91bmQgKmFmdGVyKiB0aGlzIGV4Y2VwdGlvblxuXHQgICAgLy8gb2NjdXJzLiAgVGhlcmVmb3JlLCBhbHNvLCB3ZSBjYW5ub3QgdGhyb3cgaGVyZSBhdCBhbGwuXG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi5vbkVycm9yKGUpO1xuXHQgICAgfSwgMCk7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgaWYgKGNvbW1vbmpzR2xvYmFsLmRvY3VtZW50KSB7XG5cdCAgICB0aGlzLmluZGV4ID0gUmVxdWVzdC5yZXF1ZXN0c0NvdW50Kys7XG5cdCAgICBSZXF1ZXN0LnJlcXVlc3RzW3RoaXMuaW5kZXhdID0gdGhpcztcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHN1Y2Nlc3NmdWwgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vblN1Y2Nlc3MgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5lbWl0KCdzdWNjZXNzJyk7XG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCBpZiB3ZSBoYXZlIGRhdGEuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5vbkRhdGEgPSBmdW5jdGlvbiAoZGF0YSkge1xuXHQgIHRoaXMuZW1pdCgnZGF0YScsIGRhdGEpO1xuXHQgIHRoaXMub25TdWNjZXNzKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGVycm9yLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblx0ICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLmNsZWFudXAodHJ1ZSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsZWFucyB1cCBob3VzZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLmNsZWFudXAgPSBmdW5jdGlvbiAoZnJvbUVycm9yKSB7XG5cdCAgaWYgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGhpcy54aHIgfHwgbnVsbCA9PT0gdGhpcy54aHIpIHtcblx0ICAgIHJldHVybjtcblx0ICB9XG5cdCAgLy8geG1saHR0cHJlcXVlc3Rcblx0ICBpZiAodGhpcy5oYXNYRFIoKSkge1xuXHQgICAgdGhpcy54aHIub25sb2FkID0gdGhpcy54aHIub25lcnJvciA9IGVtcHR5O1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLnhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbXB0eTtcblx0ICB9XG5cblx0ICBpZiAoZnJvbUVycm9yKSB7XG5cdCAgICB0cnkge1xuXHQgICAgICB0aGlzLnhoci5hYm9ydCgpO1xuXHQgICAgfSBjYXRjaCAoZSkge31cblx0ICB9XG5cblx0ICBpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQpIHtcblx0ICAgIGRlbGV0ZSBSZXF1ZXN0LnJlcXVlc3RzW3RoaXMuaW5kZXhdO1xuXHQgIH1cblxuXHQgIHRoaXMueGhyID0gbnVsbDtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gbG9hZC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFJlcXVlc3QucHJvdG90eXBlLm9uTG9hZCA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgZGF0YTtcblx0ICB0cnkge1xuXHQgICAgdmFyIGNvbnRlbnRUeXBlO1xuXHQgICAgdHJ5IHtcblx0ICAgICAgY29udGVudFR5cGUgPSB0aGlzLnhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1UeXBlJyk7XG5cdCAgICB9IGNhdGNoIChlKSB7fVxuXHQgICAgaWYgKGNvbnRlbnRUeXBlID09PSAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJykge1xuXHQgICAgICBkYXRhID0gdGhpcy54aHIucmVzcG9uc2UgfHwgdGhpcy54aHIucmVzcG9uc2VUZXh0O1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgZGF0YSA9IHRoaXMueGhyLnJlc3BvbnNlVGV4dDtcblx0ICAgIH1cblx0ICB9IGNhdGNoIChlKSB7XG5cdCAgICB0aGlzLm9uRXJyb3IoZSk7XG5cdCAgfVxuXHQgIGlmIChudWxsICE9IGRhdGEpIHtcblx0ICAgIHRoaXMub25EYXRhKGRhdGEpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgaXQgaGFzIFhEb21haW5SZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0UmVxdWVzdC5wcm90b3R5cGUuaGFzWERSID0gZnVuY3Rpb24gKCkge1xuXHQgIHJldHVybiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGNvbW1vbmpzR2xvYmFsLlhEb21haW5SZXF1ZXN0ICYmICF0aGlzLnhzICYmIHRoaXMuZW5hYmxlc1hEUjtcblx0fTtcblxuXHQvKipcblx0ICogQWJvcnRzIHRoZSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRSZXF1ZXN0LnByb3RvdHlwZS5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLmNsZWFudXAoKTtcblx0fTtcblxuXHQvKipcblx0ICogQWJvcnRzIHBlbmRpbmcgcmVxdWVzdHMgd2hlbiB1bmxvYWRpbmcgdGhlIHdpbmRvdy4gVGhpcyBpcyBuZWVkZWQgdG8gcHJldmVudFxuXHQgKiBtZW1vcnkgbGVha3MgKGUuZy4gd2hlbiB1c2luZyBJRSkgYW5kIHRvIGVuc3VyZSB0aGF0IG5vIHNwdXJpb3VzIGVycm9yIGlzXG5cdCAqIGVtaXR0ZWQuXG5cdCAqL1xuXG5cdFJlcXVlc3QucmVxdWVzdHNDb3VudCA9IDA7XG5cdFJlcXVlc3QucmVxdWVzdHMgPSB7fTtcblxuXHRpZiAoY29tbW9uanNHbG9iYWwuZG9jdW1lbnQpIHtcblx0ICBpZiAoY29tbW9uanNHbG9iYWwuYXR0YWNoRXZlbnQpIHtcblx0ICAgIGNvbW1vbmpzR2xvYmFsLmF0dGFjaEV2ZW50KCdvbnVubG9hZCcsIHVubG9hZEhhbmRsZXIpO1xuXHQgIH0gZWxzZSBpZiAoY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHQgICAgY29tbW9uanNHbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgdW5sb2FkSGFuZGxlciwgZmFsc2UpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIHVubG9hZEhhbmRsZXIoKSB7XG5cdCAgZm9yICh2YXIgaSBpbiBSZXF1ZXN0LnJlcXVlc3RzKSB7XG5cdCAgICBpZiAoUmVxdWVzdC5yZXF1ZXN0cy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHQgICAgICBSZXF1ZXN0LnJlcXVlc3RzW2ldLmFib3J0KCk7XG5cdCAgICB9XG5cdCAgfVxuXHR9XG5cdHBvbGxpbmdYaHIuUmVxdWVzdCA9IFJlcXVlc3RfMTtcblxuXHR2YXIgcG9sbGluZ1hociQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmdYaHIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBwb2xsaW5nWGhyLFxuXHRcdFJlcXVlc3Q6IFJlcXVlc3RfMVxuXHR9KTtcblxuXHQvKipcblx0ICogTW9kdWxlIHJlcXVpcmVtZW50cy5cblx0ICovXG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgcG9sbGluZ0pzb25wID0gSlNPTlBQb2xsaW5nO1xuXG5cdC8qKlxuXHQgKiBDYWNoZWQgcmVndWxhciBleHByZXNzaW9ucy5cblx0ICovXG5cblx0dmFyIHJOZXdsaW5lID0gL1xcbi9nO1xuXHR2YXIgckVzY2FwZWROZXdsaW5lID0gL1xcXFxuL2c7XG5cblx0LyoqXG5cdCAqIEdsb2JhbCBKU09OUCBjYWxsYmFja3MuXG5cdCAqL1xuXG5cdHZhciBjYWxsYmFja3M7XG5cblx0LyoqXG5cdCAqIE5vb3AuXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIGVtcHR5JDEoKSB7fVxuXG5cdC8qKlxuXHQgKiBKU09OUCBQb2xsaW5nIGNvbnN0cnVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0cy5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gSlNPTlBQb2xsaW5nKG9wdHMpIHtcblx0ICBQb2xsaW5nJDEuY2FsbCh0aGlzLCBvcHRzKTtcblxuXHQgIHRoaXMucXVlcnkgPSB0aGlzLnF1ZXJ5IHx8IHt9O1xuXG5cdCAgLy8gZGVmaW5lIGdsb2JhbCBjYWxsYmFja3MgYXJyYXkgaWYgbm90IHByZXNlbnRcblx0ICAvLyB3ZSBkbyB0aGlzIGhlcmUgKGxhemlseSkgdG8gYXZvaWQgdW5uZWVkZWQgZ2xvYmFsIHBvbGx1dGlvblxuXHQgIGlmICghY2FsbGJhY2tzKSB7XG5cdCAgICAvLyB3ZSBuZWVkIHRvIGNvbnNpZGVyIG11bHRpcGxlIGVuZ2luZXMgaW4gdGhlIHNhbWUgcGFnZVxuXHQgICAgaWYgKCFjb21tb25qc0dsb2JhbC5fX19laW8pIGNvbW1vbmpzR2xvYmFsLl9fX2VpbyA9IFtdO1xuXHQgICAgY2FsbGJhY2tzID0gY29tbW9uanNHbG9iYWwuX19fZWlvO1xuXHQgIH1cblxuXHQgIC8vIGNhbGxiYWNrIGlkZW50aWZpZXJcblx0ICB0aGlzLmluZGV4ID0gY2FsbGJhY2tzLmxlbmd0aDtcblxuXHQgIC8vIGFkZCBjYWxsYmFjayB0byBqc29ucCBnbG9iYWxcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgY2FsbGJhY2tzLnB1c2goZnVuY3Rpb24gKG1zZykge1xuXHQgICAgc2VsZi5vbkRhdGEobXNnKTtcblx0ICB9KTtcblxuXHQgIC8vIGFwcGVuZCB0byBxdWVyeSBzdHJpbmdcblx0ICB0aGlzLnF1ZXJ5LmogPSB0aGlzLmluZGV4O1xuXG5cdCAgLy8gcHJldmVudCBzcHVyaW91cyBlcnJvcnMgZnJvbSBiZWluZyBlbWl0dGVkIHdoZW4gdGhlIHdpbmRvdyBpcyB1bmxvYWRlZFxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5kb2N1bWVudCAmJiBjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG5cdCAgICBjb21tb25qc0dsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgIGlmIChzZWxmLnNjcmlwdCkgc2VsZi5zY3JpcHQub25lcnJvciA9IGVtcHR5JDE7XG5cdCAgICB9LCBmYWxzZSk7XG5cdCAgfVxuXHR9XG5cblx0LyoqXG5cdCAqIEluaGVyaXRzIGZyb20gUG9sbGluZy5cblx0ICovXG5cblx0aW5oZXJpdChKU09OUFBvbGxpbmcsIFBvbGxpbmckMSk7XG5cblx0Lypcblx0ICogSlNPTlAgb25seSBzdXBwb3J0cyBiaW5hcnkgYXMgYmFzZTY0IGVuY29kZWQgc3RyaW5nc1xuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5ID0gZmFsc2U7XG5cblx0LyoqXG5cdCAqIENsb3NlcyB0aGUgc29ja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0SlNPTlBQb2xsaW5nLnByb3RvdHlwZS5kb0Nsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnNjcmlwdCkge1xuXHQgICAgdGhpcy5zY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLnNjcmlwdCk7XG5cdCAgICB0aGlzLnNjcmlwdCA9IG51bGw7XG5cdCAgfVxuXG5cdCAgaWYgKHRoaXMuZm9ybSkge1xuXHQgICAgdGhpcy5mb3JtLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5mb3JtKTtcblx0ICAgIHRoaXMuZm9ybSA9IG51bGw7XG5cdCAgICB0aGlzLmlmcmFtZSA9IG51bGw7XG5cdCAgfVxuXG5cdCAgUG9sbGluZyQxLnByb3RvdHlwZS5kb0Nsb3NlLmNhbGwodGhpcyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyBhIHBvbGwgY3ljbGUuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRKU09OUFBvbGxpbmcucHJvdG90eXBlLmRvUG9sbCA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXG5cdCAgaWYgKHRoaXMuc2NyaXB0KSB7XG5cdCAgICB0aGlzLnNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuc2NyaXB0KTtcblx0ICAgIHRoaXMuc2NyaXB0ID0gbnVsbDtcblx0ICB9XG5cblx0ICBzY3JpcHQuYXN5bmMgPSB0cnVlO1xuXHQgIHNjcmlwdC5zcmMgPSB0aGlzLnVyaSgpO1xuXHQgIHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24gKGUpIHtcblx0ICAgIHNlbGYub25FcnJvcignanNvbnAgcG9sbCBlcnJvcicsIGUpO1xuXHQgIH07XG5cblx0ICB2YXIgaW5zZXJ0QXQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc2NyaXB0JylbMF07XG5cdCAgaWYgKGluc2VydEF0KSB7XG5cdCAgICBpbnNlcnRBdC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShzY3JpcHQsIGluc2VydEF0KTtcblx0ICB9IGVsc2Uge1xuXHQgICAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuYm9keSkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcblx0ICB9XG5cdCAgdGhpcy5zY3JpcHQgPSBzY3JpcHQ7XG5cblx0ICB2YXIgaXNVQWdlY2tvID0gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBuYXZpZ2F0b3IgJiYgL2dlY2tvL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXHQgIGlmIChpc1VBZ2Vja28pIHtcblx0ICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICB2YXIgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG5cdCAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaWZyYW1lKTtcblx0ICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuXHQgICAgfSwgMTAwKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyB3aXRoIGEgaGlkZGVuIGlmcmFtZS5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGEgdG8gc2VuZFxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsZWQgdXBvbiBmbHVzaC5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdEpTT05QUG9sbGluZy5wcm90b3R5cGUuZG9Xcml0ZSA9IGZ1bmN0aW9uIChkYXRhLCBmbikge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGlmICghdGhpcy5mb3JtKSB7XG5cdCAgICB2YXIgZm9ybSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zvcm0nKTtcblx0ICAgIHZhciBhcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcblx0ICAgIHZhciBpZCA9IHRoaXMuaWZyYW1lSWQgPSAnZWlvX2lmcmFtZV8nICsgdGhpcy5pbmRleDtcblx0ICAgIHZhciBpZnJhbWU7XG5cblx0ICAgIGZvcm0uY2xhc3NOYW1lID0gJ3NvY2tldGlvJztcblx0ICAgIGZvcm0uc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHQgICAgZm9ybS5zdHlsZS50b3AgPSAnLTEwMDBweCc7XG5cdCAgICBmb3JtLnN0eWxlLmxlZnQgPSAnLTEwMDBweCc7XG5cdCAgICBmb3JtLnRhcmdldCA9IGlkO1xuXHQgICAgZm9ybS5tZXRob2QgPSAnUE9TVCc7XG5cdCAgICBmb3JtLnNldEF0dHJpYnV0ZSgnYWNjZXB0LWNoYXJzZXQnLCAndXRmLTgnKTtcblx0ICAgIGFyZWEubmFtZSA9ICdkJztcblx0ICAgIGZvcm0uYXBwZW5kQ2hpbGQoYXJlYSk7XG5cdCAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGZvcm0pO1xuXG5cdCAgICB0aGlzLmZvcm0gPSBmb3JtO1xuXHQgICAgdGhpcy5hcmVhID0gYXJlYTtcblx0ICB9XG5cblx0ICB0aGlzLmZvcm0uYWN0aW9uID0gdGhpcy51cmkoKTtcblxuXHQgIGZ1bmN0aW9uIGNvbXBsZXRlKCkge1xuXHQgICAgaW5pdElmcmFtZSgpO1xuXHQgICAgZm4oKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBpbml0SWZyYW1lKCkge1xuXHQgICAgaWYgKHNlbGYuaWZyYW1lKSB7XG5cdCAgICAgIHRyeSB7XG5cdCAgICAgICAgc2VsZi5mb3JtLnJlbW92ZUNoaWxkKHNlbGYuaWZyYW1lKTtcblx0ICAgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICAgIHNlbGYub25FcnJvcignanNvbnAgcG9sbGluZyBpZnJhbWUgcmVtb3ZhbCBlcnJvcicsIGUpO1xuXHQgICAgICB9XG5cdCAgICB9XG5cblx0ICAgIHRyeSB7XG5cdCAgICAgIC8vIGllNiBkeW5hbWljIGlmcmFtZXMgd2l0aCB0YXJnZXQ9XCJcIiBzdXBwb3J0ICh0aGFua3MgQ2hyaXMgTGFtYmFjaGVyKVxuXHQgICAgICB2YXIgaHRtbCA9ICc8aWZyYW1lIHNyYz1cImphdmFzY3JpcHQ6MFwiIG5hbWU9XCInICsgc2VsZi5pZnJhbWVJZCArICdcIj4nO1xuXHQgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGh0bWwpO1xuXHQgICAgfSBjYXRjaCAoZSkge1xuXHQgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcblx0ICAgICAgaWZyYW1lLm5hbWUgPSBzZWxmLmlmcmFtZUlkO1xuXHQgICAgICBpZnJhbWUuc3JjID0gJ2phdmFzY3JpcHQ6MCc7XG5cdCAgICB9XG5cblx0ICAgIGlmcmFtZS5pZCA9IHNlbGYuaWZyYW1lSWQ7XG5cblx0ICAgIHNlbGYuZm9ybS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuXHQgICAgc2VsZi5pZnJhbWUgPSBpZnJhbWU7XG5cdCAgfVxuXG5cdCAgaW5pdElmcmFtZSgpO1xuXG5cdCAgLy8gZXNjYXBlIFxcbiB0byBwcmV2ZW50IGl0IGZyb20gYmVpbmcgY29udmVydGVkIGludG8gXFxyXFxuIGJ5IHNvbWUgVUFzXG5cdCAgLy8gZG91YmxlIGVzY2FwaW5nIGlzIHJlcXVpcmVkIGZvciBlc2NhcGVkIG5ldyBsaW5lcyBiZWNhdXNlIHVuZXNjYXBpbmcgb2YgbmV3IGxpbmVzIGNhbiBiZSBkb25lIHNhZmVseSBvbiBzZXJ2ZXItc2lkZVxuXHQgIGRhdGEgPSBkYXRhLnJlcGxhY2UockVzY2FwZWROZXdsaW5lLCAnXFxcXFxcbicpO1xuXHQgIHRoaXMuYXJlYS52YWx1ZSA9IGRhdGEucmVwbGFjZShyTmV3bGluZSwgJ1xcXFxuJyk7XG5cblx0ICB0cnkge1xuXHQgICAgdGhpcy5mb3JtLnN1Ym1pdCgpO1xuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cblx0ICBpZiAodGhpcy5pZnJhbWUuYXR0YWNoRXZlbnQpIHtcblx0ICAgIHRoaXMuaWZyYW1lLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHNlbGYuaWZyYW1lLnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScpIHtcblx0ICAgICAgICBjb21wbGV0ZSgpO1xuXHQgICAgICB9XG5cdCAgICB9O1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLmlmcmFtZS5vbmxvYWQgPSBjb21wbGV0ZTtcblx0ICB9XG5cdH07XG5cblx0dmFyIHBvbGxpbmdKc29ucCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHBvbGxpbmdKc29ucCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHBvbGxpbmdKc29ucFxuXHR9KTtcblxuXHR2YXIgZW1wdHkkMiA9IHt9O1xuXG5cdHZhciBlbXB0eSQzID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGVtcHR5JDJcblx0fSk7XG5cblx0dmFyIHJlcXVpcmUkJDEkMSA9ICggZW1wdHkkMyAmJiBlbXB0eSQyICkgfHwgZW1wdHkkMztcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDUgPSByZXF1aXJlJCQwJDIoJ2VuZ2luZS5pby1jbGllbnQ6d2Vic29ja2V0Jyk7XG5cdHZhciBCcm93c2VyV2ViU29ja2V0ID0gY29tbW9uanNHbG9iYWwuV2ViU29ja2V0IHx8IGNvbW1vbmpzR2xvYmFsLk1veldlYlNvY2tldDtcblx0dmFyIE5vZGVXZWJTb2NrZXQ7XG5cdGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuXHQgIHRyeSB7XG5cdCAgICBOb2RlV2ViU29ja2V0ID0gcmVxdWlyZSQkMSQxO1xuXHQgIH0gY2F0Y2ggKGUpIHt9XG5cdH1cblxuXHQvKipcblx0ICogR2V0IGVpdGhlciB0aGUgYFdlYlNvY2tldGAgb3IgYE1veldlYlNvY2tldGAgZ2xvYmFsc1xuXHQgKiBpbiB0aGUgYnJvd3NlciBvciB0cnkgdG8gcmVzb2x2ZSBXZWJTb2NrZXQtY29tcGF0aWJsZVxuXHQgKiBpbnRlcmZhY2UgZXhwb3NlZCBieSBgd3NgIGZvciBOb2RlLWxpa2UgZW52aXJvbm1lbnQuXG5cdCAqL1xuXG5cdHZhciBXZWJTb2NrZXQgPSBCcm93c2VyV2ViU29ja2V0O1xuXHRpZiAoIVdlYlNvY2tldCAmJiB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuXHQgIFdlYlNvY2tldCA9IE5vZGVXZWJTb2NrZXQ7XG5cdH1cblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciB3ZWJzb2NrZXQgPSBXUztcblxuXHQvKipcblx0ICogV2ViU29ja2V0IHRyYW5zcG9ydCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQGFwaSB7T2JqZWN0fSBjb25uZWN0aW9uIG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gV1Mob3B0cykge1xuXHQgIHZhciBmb3JjZUJhc2U2NCA9IG9wdHMgJiYgb3B0cy5mb3JjZUJhc2U2NDtcblx0ICBpZiAoZm9yY2VCYXNlNjQpIHtcblx0ICAgIHRoaXMuc3VwcG9ydHNCaW5hcnkgPSBmYWxzZTtcblx0ICB9XG5cdCAgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSA9IG9wdHMucGVyTWVzc2FnZURlZmxhdGU7XG5cdCAgdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQgPSBCcm93c2VyV2ViU29ja2V0ICYmICFvcHRzLmZvcmNlTm9kZTtcblx0ICB0aGlzLnByb3RvY29scyA9IG9wdHMucHJvdG9jb2xzO1xuXHQgIGlmICghdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgIFdlYlNvY2tldCA9IE5vZGVXZWJTb2NrZXQ7XG5cdCAgfVxuXHQgIFRyYW5zcG9ydCQxLmNhbGwodGhpcywgb3B0cyk7XG5cdH1cblxuXHQvKipcblx0ICogSW5oZXJpdHMgZnJvbSBUcmFuc3BvcnQuXG5cdCAqL1xuXG5cdGluaGVyaXQoV1MsIFRyYW5zcG9ydCQxKTtcblxuXHQvKipcblx0ICogVHJhbnNwb3J0IG5hbWUuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5uYW1lID0gJ3dlYnNvY2tldCc7XG5cblx0Lypcblx0ICogV2ViU29ja2V0cyBzdXBwb3J0IGJpbmFyeVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuc3VwcG9ydHNCaW5hcnkgPSB0cnVlO1xuXG5cdC8qKlxuXHQgKiBPcGVucyBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuZG9PcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICghdGhpcy5jaGVjaygpKSB7XG5cdCAgICAvLyBsZXQgcHJvYmUgdGltZW91dFxuXHQgICAgcmV0dXJuO1xuXHQgIH1cblxuXHQgIHZhciB1cmkgPSB0aGlzLnVyaSgpO1xuXHQgIHZhciBwcm90b2NvbHMgPSB0aGlzLnByb3RvY29scztcblx0ICB2YXIgb3B0cyA9IHtcblx0ICAgIGFnZW50OiB0aGlzLmFnZW50LFxuXHQgICAgcGVyTWVzc2FnZURlZmxhdGU6IHRoaXMucGVyTWVzc2FnZURlZmxhdGVcblx0ICB9O1xuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgb3B0cy5wZnggPSB0aGlzLnBmeDtcblx0ICBvcHRzLmtleSA9IHRoaXMua2V5O1xuXHQgIG9wdHMucGFzc3BocmFzZSA9IHRoaXMucGFzc3BocmFzZTtcblx0ICBvcHRzLmNlcnQgPSB0aGlzLmNlcnQ7XG5cdCAgb3B0cy5jYSA9IHRoaXMuY2E7XG5cdCAgb3B0cy5jaXBoZXJzID0gdGhpcy5jaXBoZXJzO1xuXHQgIG9wdHMucmVqZWN0VW5hdXRob3JpemVkID0gdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ7XG5cdCAgaWYgKHRoaXMuZXh0cmFIZWFkZXJzKSB7XG5cdCAgICBvcHRzLmhlYWRlcnMgPSB0aGlzLmV4dHJhSGVhZGVycztcblx0ICB9XG5cdCAgaWYgKHRoaXMubG9jYWxBZGRyZXNzKSB7XG5cdCAgICBvcHRzLmxvY2FsQWRkcmVzcyA9IHRoaXMubG9jYWxBZGRyZXNzO1xuXHQgIH1cblxuXHQgIHRyeSB7XG5cdCAgICB0aGlzLndzID0gdGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQgPyBwcm90b2NvbHMgPyBuZXcgV2ViU29ja2V0KHVyaSwgcHJvdG9jb2xzKSA6IG5ldyBXZWJTb2NrZXQodXJpKSA6IG5ldyBXZWJTb2NrZXQodXJpLCBwcm90b2NvbHMsIG9wdHMpO1xuXHQgIH0gY2F0Y2ggKGVycikge1xuXHQgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLndzLmJpbmFyeVR5cGUgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgdGhpcy5zdXBwb3J0c0JpbmFyeSA9IGZhbHNlO1xuXHQgIH1cblxuXHQgIGlmICh0aGlzLndzLnN1cHBvcnRzICYmIHRoaXMud3Muc3VwcG9ydHMuYmluYXJ5KSB7XG5cdCAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gdHJ1ZTtcblx0ICAgIHRoaXMud3MuYmluYXJ5VHlwZSA9ICdub2RlYnVmZmVyJztcblx0ICB9IGVsc2Uge1xuXHQgICAgdGhpcy53cy5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0ICB9XG5cblx0ICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIHRvIHRoZSBzb2NrZXRcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVycyA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICB0aGlzLndzLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHNlbGYub25PcGVuKCk7XG5cdCAgfTtcblx0ICB0aGlzLndzLm9uY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uQ2xvc2UoKTtcblx0ICB9O1xuXHQgIHRoaXMud3Mub25tZXNzYWdlID0gZnVuY3Rpb24gKGV2KSB7XG5cdCAgICBzZWxmLm9uRGF0YShldi5kYXRhKTtcblx0ICB9O1xuXHQgIHRoaXMud3Mub25lcnJvciA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoJ3dlYnNvY2tldCBlcnJvcicsIGUpO1xuXHQgIH07XG5cdH07XG5cblx0LyoqXG5cdCAqIFdyaXRlcyBkYXRhIHRvIHNvY2tldC5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgb2YgcGFja2V0cy5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChwYWNrZXRzKSB7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcblxuXHQgIC8vIGVuY29kZVBhY2tldCBlZmZpY2llbnQgYXMgaXQgdXNlcyBXUyBmcmFtaW5nXG5cdCAgLy8gbm8gbmVlZCBmb3IgZW5jb2RlUGF5bG9hZFxuXHQgIHZhciB0b3RhbCA9IHBhY2tldHMubGVuZ3RoO1xuXHQgIGZvciAodmFyIGkgPSAwLCBsID0gdG90YWw7IGkgPCBsOyBpKyspIHtcblx0ICAgIChmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICAgIHBhcnNlci5lbmNvZGVQYWNrZXQocGFja2V0LCBzZWxmLnN1cHBvcnRzQmluYXJ5LCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgICAgIGlmICghc2VsZi51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgICAgICAgIC8vIGFsd2F5cyBjcmVhdGUgYSBuZXcgb2JqZWN0IChHSC00MzcpXG5cdCAgICAgICAgICB2YXIgb3B0cyA9IHt9O1xuXHQgICAgICAgICAgaWYgKHBhY2tldC5vcHRpb25zKSB7XG5cdCAgICAgICAgICAgIG9wdHMuY29tcHJlc3MgPSBwYWNrZXQub3B0aW9ucy5jb21wcmVzcztcblx0ICAgICAgICAgIH1cblxuXHQgICAgICAgICAgaWYgKHNlbGYucGVyTWVzc2FnZURlZmxhdGUpIHtcblx0ICAgICAgICAgICAgdmFyIGxlbiA9ICdzdHJpbmcnID09PSB0eXBlb2YgZGF0YSA/IGNvbW1vbmpzR2xvYmFsLkJ1ZmZlci5ieXRlTGVuZ3RoKGRhdGEpIDogZGF0YS5sZW5ndGg7XG5cdCAgICAgICAgICAgIGlmIChsZW4gPCBzZWxmLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZCkge1xuXHQgICAgICAgICAgICAgIG9wdHMuY29tcHJlc3MgPSBmYWxzZTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH1cblxuXHQgICAgICAgIC8vIFNvbWV0aW1lcyB0aGUgd2Vic29ja2V0IGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ1dCB0aGUgYnJvd3NlciBkaWRuJ3Rcblx0ICAgICAgICAvLyBoYXZlIGEgY2hhbmNlIG9mIGluZm9ybWluZyB1cyBhYm91dCBpdCB5ZXQsIGluIHRoYXQgY2FzZSBzZW5kIHdpbGxcblx0ICAgICAgICAvLyB0aHJvdyBhbiBlcnJvclxuXHQgICAgICAgIHRyeSB7XG5cdCAgICAgICAgICBpZiAoc2VsZi51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpIHtcblx0ICAgICAgICAgICAgLy8gVHlwZUVycm9yIGlzIHRocm93biB3aGVuIHBhc3NpbmcgdGhlIHNlY29uZCBhcmd1bWVudCBvbiBTYWZhcmlcblx0ICAgICAgICAgICAgc2VsZi53cy5zZW5kKGRhdGEpO1xuXHQgICAgICAgICAgfSBlbHNlIHtcblx0ICAgICAgICAgICAgc2VsZi53cy5zZW5kKGRhdGEsIG9wdHMpO1xuXHQgICAgICAgICAgfVxuXHQgICAgICAgIH0gY2F0Y2ggKGUpIHtcblx0ICAgICAgICAgIGRlYnVnJDUoJ3dlYnNvY2tldCBjbG9zZWQgYmVmb3JlIG9uY2xvc2UgZXZlbnQnKTtcblx0ICAgICAgICB9XG5cblx0ICAgICAgICAtLXRvdGFsIHx8IGRvbmUoKTtcblx0ICAgICAgfSk7XG5cdCAgICB9KShwYWNrZXRzW2ldKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBkb25lKCkge1xuXHQgICAgc2VsZi5lbWl0KCdmbHVzaCcpO1xuXG5cdCAgICAvLyBmYWtlIGRyYWluXG5cdCAgICAvLyBkZWZlciB0byBuZXh0IHRpY2sgdG8gYWxsb3cgU29ja2V0IHRvIGNsZWFyIHdyaXRlQnVmZmVyXG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi53cml0YWJsZSA9IHRydWU7XG5cdCAgICAgIHNlbGYuZW1pdCgnZHJhaW4nKTtcblx0ICAgIH0sIDApO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gY2xvc2Vcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFdTLnByb3RvdHlwZS5vbkNsb3NlID0gZnVuY3Rpb24gKCkge1xuXHQgIFRyYW5zcG9ydCQxLnByb3RvdHlwZS5vbkNsb3NlLmNhbGwodGhpcyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlcyBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRXUy5wcm90b3R5cGUuZG9DbG9zZSA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAodHlwZW9mIHRoaXMud3MgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICB0aGlzLndzLmNsb3NlKCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZW5lcmF0ZXMgdXJpIGZvciBjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0V1MucHJvdG90eXBlLnVyaSA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJ5IHx8IHt9O1xuXHQgIHZhciBzY2hlbWEgPSB0aGlzLnNlY3VyZSA/ICd3c3MnIDogJ3dzJztcblx0ICB2YXIgcG9ydCA9ICcnO1xuXG5cdCAgLy8gYXZvaWQgcG9ydCBpZiBkZWZhdWx0IGZvciBzY2hlbWFcblx0ICBpZiAodGhpcy5wb3J0ICYmICgnd3NzJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA0NDMgfHwgJ3dzJyA9PT0gc2NoZW1hICYmIE51bWJlcih0aGlzLnBvcnQpICE9PSA4MCkpIHtcblx0ICAgIHBvcnQgPSAnOicgKyB0aGlzLnBvcnQ7XG5cdCAgfVxuXG5cdCAgLy8gYXBwZW5kIHRpbWVzdGFtcCB0byBVUklcblx0ICBpZiAodGhpcy50aW1lc3RhbXBSZXF1ZXN0cykge1xuXHQgICAgcXVlcnlbdGhpcy50aW1lc3RhbXBQYXJhbV0gPSB5ZWFzdCQyKCk7XG5cdCAgfVxuXG5cdCAgLy8gY29tbXVuaWNhdGUgYmluYXJ5IHN1cHBvcnQgY2FwYWJpbGl0aWVzXG5cdCAgaWYgKCF0aGlzLnN1cHBvcnRzQmluYXJ5KSB7XG5cdCAgICBxdWVyeS5iNjQgPSAxO1xuXHQgIH1cblxuXHQgIHF1ZXJ5ID0gcGFyc2VxcyQyLmVuY29kZShxdWVyeSk7XG5cblx0ICAvLyBwcmVwZW5kID8gdG8gcXVlcnlcblx0ICBpZiAocXVlcnkubGVuZ3RoKSB7XG5cdCAgICBxdWVyeSA9ICc/JyArIHF1ZXJ5O1xuXHQgIH1cblxuXHQgIHZhciBpcHY2ID0gdGhpcy5ob3N0bmFtZS5pbmRleE9mKCc6JykgIT09IC0xO1xuXHQgIHJldHVybiBzY2hlbWEgKyAnOi8vJyArIChpcHY2ID8gJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyA6IHRoaXMuaG9zdG5hbWUpICsgcG9ydCArIHRoaXMucGF0aCArIHF1ZXJ5O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBGZWF0dXJlIGRldGVjdGlvbiBmb3IgV2ViU29ja2V0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB3aGV0aGVyIHRoaXMgdHJhbnNwb3J0IGlzIGF2YWlsYWJsZS5cblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0V1MucHJvdG90eXBlLmNoZWNrID0gZnVuY3Rpb24gKCkge1xuXHQgIHJldHVybiAhIVdlYlNvY2tldCAmJiAhKCdfX2luaXRpYWxpemUnIGluIFdlYlNvY2tldCAmJiB0aGlzLm5hbWUgPT09IFdTLnByb3RvdHlwZS5uYW1lKTtcblx0fTtcblxuXHR2YXIgd2Vic29ja2V0JDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogd2Vic29ja2V0LFxuXHRcdF9fbW9kdWxlRXhwb3J0czogd2Vic29ja2V0XG5cdH0pO1xuXG5cdHZhciBYSFIkMSA9ICggcG9sbGluZ1hociQxICYmIHBvbGxpbmdYaHIgKSB8fCBwb2xsaW5nWGhyJDE7XG5cblx0dmFyIEpTT05QID0gKCBwb2xsaW5nSnNvbnAkMSAmJiBwb2xsaW5nSnNvbnAgKSB8fCBwb2xsaW5nSnNvbnAkMTtcblxuXHR2YXIgd2Vic29ja2V0JDIgPSAoIHdlYnNvY2tldCQxICYmIHdlYnNvY2tldCApIHx8IHdlYnNvY2tldCQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzXG5cdCAqL1xuXG5cdC8qKlxuXHQgKiBFeHBvcnQgdHJhbnNwb3J0cy5cblx0ICovXG5cblx0dmFyIHBvbGxpbmdfMSA9IHBvbGxpbmckMjtcblx0dmFyIHdlYnNvY2tldF8xID0gd2Vic29ja2V0JDI7XG5cblx0LyoqXG5cdCAqIFBvbGxpbmcgdHJhbnNwb3J0IHBvbHltb3JwaGljIGNvbnN0cnVjdG9yLlxuXHQgKiBEZWNpZGVzIG9uIHhociB2cyBqc29ucCBiYXNlZCBvbiBmZWF0dXJlIGRldGVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIHBvbGxpbmckMihvcHRzKSB7XG5cdCAgdmFyIHhocjtcblx0ICB2YXIgeGQgPSBmYWxzZTtcblx0ICB2YXIgeHMgPSBmYWxzZTtcblx0ICB2YXIganNvbnAgPSBmYWxzZSAhPT0gb3B0cy5qc29ucDtcblxuXHQgIGlmIChjb21tb25qc0dsb2JhbC5sb2NhdGlvbikge1xuXHQgICAgdmFyIGlzU1NMID0gJ2h0dHBzOicgPT09IGxvY2F0aW9uLnByb3RvY29sO1xuXHQgICAgdmFyIHBvcnQgPSBsb2NhdGlvbi5wb3J0O1xuXG5cdCAgICAvLyBzb21lIHVzZXIgYWdlbnRzIGhhdmUgZW1wdHkgYGxvY2F0aW9uLnBvcnRgXG5cdCAgICBpZiAoIXBvcnQpIHtcblx0ICAgICAgcG9ydCA9IGlzU1NMID8gNDQzIDogODA7XG5cdCAgICB9XG5cblx0ICAgIHhkID0gb3B0cy5ob3N0bmFtZSAhPT0gbG9jYXRpb24uaG9zdG5hbWUgfHwgcG9ydCAhPT0gb3B0cy5wb3J0O1xuXHQgICAgeHMgPSBvcHRzLnNlY3VyZSAhPT0gaXNTU0w7XG5cdCAgfVxuXG5cdCAgb3B0cy54ZG9tYWluID0geGQ7XG5cdCAgb3B0cy54c2NoZW1lID0geHM7XG5cdCAgeGhyID0gbmV3IHJlcXVpcmUkJDEob3B0cyk7XG5cblx0ICBpZiAoJ29wZW4nIGluIHhociAmJiAhb3B0cy5mb3JjZUpTT05QKSB7XG5cdCAgICByZXR1cm4gbmV3IFhIUiQxKG9wdHMpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICBpZiAoIWpzb25wKSB0aHJvdyBuZXcgRXJyb3IoJ0pTT05QIGRpc2FibGVkJyk7XG5cdCAgICByZXR1cm4gbmV3IEpTT05QKG9wdHMpO1xuXHQgIH1cblx0fVxuXG5cdHZhciB0cmFuc3BvcnRzID0ge1xuXHQgIHBvbGxpbmc6IHBvbGxpbmdfMSxcblx0ICB3ZWJzb2NrZXQ6IHdlYnNvY2tldF8xXG5cdH07XG5cblx0dmFyIHRyYW5zcG9ydHMkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0cmFuc3BvcnRzLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogdHJhbnNwb3J0cyxcblx0XHRwb2xsaW5nOiBwb2xsaW5nXzEsXG5cdFx0d2Vic29ja2V0OiB3ZWJzb2NrZXRfMVxuXHR9KTtcblxuXHR2YXIgaW5kZXhPZiA9IFtdLmluZGV4T2Y7XG5cblx0dmFyIGluZGV4b2YgPSBmdW5jdGlvbiBpbmRleG9mKGFyciwgb2JqKSB7XG5cdCAgaWYgKGluZGV4T2YpIHJldHVybiBhcnIuaW5kZXhPZihvYmopO1xuXHQgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgKytpKSB7XG5cdCAgICBpZiAoYXJyW2ldID09PSBvYmopIHJldHVybiBpO1xuXHQgIH1cblx0ICByZXR1cm4gLTE7XG5cdH07XG5cblx0dmFyIGluZGV4b2YkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBpbmRleG9mLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogaW5kZXhvZlxuXHR9KTtcblxuXHR2YXIgdHJhbnNwb3J0cyQyID0gKCB0cmFuc3BvcnRzJDEgJiYgdHJhbnNwb3J0cyApIHx8IHRyYW5zcG9ydHMkMTtcblxuXHR2YXIgaW5kZXggPSAoIGluZGV4b2YkMSAmJiBpbmRleG9mICkgfHwgaW5kZXhvZiQxO1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuXHQgKi9cblxuXHR2YXIgZGVidWckNiA9IHJlcXVpcmUkJDAkMignZW5naW5lLmlvLWNsaWVudDpzb2NrZXQnKTtcblxuXHQvKipcblx0ICogTW9kdWxlIGV4cG9ydHMuXG5cdCAqL1xuXG5cdHZhciBzb2NrZXQgPSBTb2NrZXQ7XG5cblx0LyoqXG5cdCAqIFNvY2tldCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSB1cmkgb3Igb3B0aW9uc1xuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBTb2NrZXQodXJpLCBvcHRzKSB7XG5cdCAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNvY2tldCkpIHJldHVybiBuZXcgU29ja2V0KHVyaSwgb3B0cyk7XG5cblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblxuXHQgIGlmICh1cmkgJiYgJ29iamVjdCcgPT09ICh0eXBlb2YgdXJpID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih1cmkpKSkge1xuXHQgICAgb3B0cyA9IHVyaTtcblx0ICAgIHVyaSA9IG51bGw7XG5cdCAgfVxuXG5cdCAgaWYgKHVyaSkge1xuXHQgICAgdXJpID0gcGFyc2V1cmkkMih1cmkpO1xuXHQgICAgb3B0cy5ob3N0bmFtZSA9IHVyaS5ob3N0O1xuXHQgICAgb3B0cy5zZWN1cmUgPSB1cmkucHJvdG9jb2wgPT09ICdodHRwcycgfHwgdXJpLnByb3RvY29sID09PSAnd3NzJztcblx0ICAgIG9wdHMucG9ydCA9IHVyaS5wb3J0O1xuXHQgICAgaWYgKHVyaS5xdWVyeSkgb3B0cy5xdWVyeSA9IHVyaS5xdWVyeTtcblx0ICB9IGVsc2UgaWYgKG9wdHMuaG9zdCkge1xuXHQgICAgb3B0cy5ob3N0bmFtZSA9IHBhcnNldXJpJDIob3B0cy5ob3N0KS5ob3N0O1xuXHQgIH1cblxuXHQgIHRoaXMuc2VjdXJlID0gbnVsbCAhPSBvcHRzLnNlY3VyZSA/IG9wdHMuc2VjdXJlIDogY29tbW9uanNHbG9iYWwubG9jYXRpb24gJiYgJ2h0dHBzOicgPT09IGxvY2F0aW9uLnByb3RvY29sO1xuXG5cdCAgaWYgKG9wdHMuaG9zdG5hbWUgJiYgIW9wdHMucG9ydCkge1xuXHQgICAgLy8gaWYgbm8gcG9ydCBpcyBzcGVjaWZpZWQgbWFudWFsbHksIHVzZSB0aGUgcHJvdG9jb2wgZGVmYXVsdFxuXHQgICAgb3B0cy5wb3J0ID0gdGhpcy5zZWN1cmUgPyAnNDQzJyA6ICc4MCc7XG5cdCAgfVxuXG5cdCAgdGhpcy5hZ2VudCA9IG9wdHMuYWdlbnQgfHwgZmFsc2U7XG5cdCAgdGhpcy5ob3N0bmFtZSA9IG9wdHMuaG9zdG5hbWUgfHwgKGNvbW1vbmpzR2xvYmFsLmxvY2F0aW9uID8gbG9jYXRpb24uaG9zdG5hbWUgOiAnbG9jYWxob3N0Jyk7XG5cdCAgdGhpcy5wb3J0ID0gb3B0cy5wb3J0IHx8IChjb21tb25qc0dsb2JhbC5sb2NhdGlvbiAmJiBsb2NhdGlvbi5wb3J0ID8gbG9jYXRpb24ucG9ydCA6IHRoaXMuc2VjdXJlID8gNDQzIDogODApO1xuXHQgIHRoaXMucXVlcnkgPSBvcHRzLnF1ZXJ5IHx8IHt9O1xuXHQgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHRoaXMucXVlcnkpIHRoaXMucXVlcnkgPSBwYXJzZXFzJDIuZGVjb2RlKHRoaXMucXVlcnkpO1xuXHQgIHRoaXMudXBncmFkZSA9IGZhbHNlICE9PSBvcHRzLnVwZ3JhZGU7XG5cdCAgdGhpcy5wYXRoID0gKG9wdHMucGF0aCB8fCAnL2VuZ2luZS5pbycpLnJlcGxhY2UoL1xcLyQvLCAnJykgKyAnLyc7XG5cdCAgdGhpcy5mb3JjZUpTT05QID0gISFvcHRzLmZvcmNlSlNPTlA7XG5cdCAgdGhpcy5qc29ucCA9IGZhbHNlICE9PSBvcHRzLmpzb25wO1xuXHQgIHRoaXMuZm9yY2VCYXNlNjQgPSAhIW9wdHMuZm9yY2VCYXNlNjQ7XG5cdCAgdGhpcy5lbmFibGVzWERSID0gISFvcHRzLmVuYWJsZXNYRFI7XG5cdCAgdGhpcy50aW1lc3RhbXBQYXJhbSA9IG9wdHMudGltZXN0YW1wUGFyYW0gfHwgJ3QnO1xuXHQgIHRoaXMudGltZXN0YW1wUmVxdWVzdHMgPSBvcHRzLnRpbWVzdGFtcFJlcXVlc3RzO1xuXHQgIHRoaXMudHJhbnNwb3J0cyA9IG9wdHMudHJhbnNwb3J0cyB8fCBbJ3BvbGxpbmcnLCAnd2Vic29ja2V0J107XG5cdCAgdGhpcy50cmFuc3BvcnRPcHRpb25zID0gb3B0cy50cmFuc3BvcnRPcHRpb25zIHx8IHt9O1xuXHQgIHRoaXMucmVhZHlTdGF0ZSA9ICcnO1xuXHQgIHRoaXMud3JpdGVCdWZmZXIgPSBbXTtcblx0ICB0aGlzLnByZXZCdWZmZXJMZW4gPSAwO1xuXHQgIHRoaXMucG9saWN5UG9ydCA9IG9wdHMucG9saWN5UG9ydCB8fCA4NDM7XG5cdCAgdGhpcy5yZW1lbWJlclVwZ3JhZGUgPSBvcHRzLnJlbWVtYmVyVXBncmFkZSB8fCBmYWxzZTtcblx0ICB0aGlzLmJpbmFyeVR5cGUgPSBudWxsO1xuXHQgIHRoaXMub25seUJpbmFyeVVwZ3JhZGVzID0gb3B0cy5vbmx5QmluYXJ5VXBncmFkZXM7XG5cdCAgdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSA9IGZhbHNlICE9PSBvcHRzLnBlck1lc3NhZ2VEZWZsYXRlID8gb3B0cy5wZXJNZXNzYWdlRGVmbGF0ZSB8fCB7fSA6IGZhbHNlO1xuXG5cdCAgaWYgKHRydWUgPT09IHRoaXMucGVyTWVzc2FnZURlZmxhdGUpIHRoaXMucGVyTWVzc2FnZURlZmxhdGUgPSB7fTtcblx0ICBpZiAodGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSAmJiBudWxsID09IHRoaXMucGVyTWVzc2FnZURlZmxhdGUudGhyZXNob2xkKSB7XG5cdCAgICB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZCA9IDEwMjQ7XG5cdCAgfVxuXG5cdCAgLy8gU1NMIG9wdGlvbnMgZm9yIE5vZGUuanMgY2xpZW50XG5cdCAgdGhpcy5wZnggPSBvcHRzLnBmeCB8fCBudWxsO1xuXHQgIHRoaXMua2V5ID0gb3B0cy5rZXkgfHwgbnVsbDtcblx0ICB0aGlzLnBhc3NwaHJhc2UgPSBvcHRzLnBhc3NwaHJhc2UgfHwgbnVsbDtcblx0ICB0aGlzLmNlcnQgPSBvcHRzLmNlcnQgfHwgbnVsbDtcblx0ICB0aGlzLmNhID0gb3B0cy5jYSB8fCBudWxsO1xuXHQgIHRoaXMuY2lwaGVycyA9IG9wdHMuY2lwaGVycyB8fCBudWxsO1xuXHQgIHRoaXMucmVqZWN0VW5hdXRob3JpemVkID0gb3B0cy5yZWplY3RVbmF1dGhvcml6ZWQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRzLnJlamVjdFVuYXV0aG9yaXplZDtcblx0ICB0aGlzLmZvcmNlTm9kZSA9ICEhb3B0cy5mb3JjZU5vZGU7XG5cblx0ICAvLyBvdGhlciBvcHRpb25zIGZvciBOb2RlLmpzIGNsaWVudFxuXHQgIHZhciBmcmVlR2xvYmFsID0gX3R5cGVvZihjb21tb25qc0dsb2JhbCkgPT09ICdvYmplY3QnICYmIGNvbW1vbmpzR2xvYmFsO1xuXHQgIGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCkge1xuXHQgICAgaWYgKG9wdHMuZXh0cmFIZWFkZXJzICYmIE9iamVjdC5rZXlzKG9wdHMuZXh0cmFIZWFkZXJzKS5sZW5ndGggPiAwKSB7XG5cdCAgICAgIHRoaXMuZXh0cmFIZWFkZXJzID0gb3B0cy5leHRyYUhlYWRlcnM7XG5cdCAgICB9XG5cblx0ICAgIGlmIChvcHRzLmxvY2FsQWRkcmVzcykge1xuXHQgICAgICB0aGlzLmxvY2FsQWRkcmVzcyA9IG9wdHMubG9jYWxBZGRyZXNzO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIC8vIHNldCBvbiBoYW5kc2hha2Vcblx0ICB0aGlzLmlkID0gbnVsbDtcblx0ICB0aGlzLnVwZ3JhZGVzID0gbnVsbDtcblx0ICB0aGlzLnBpbmdJbnRlcnZhbCA9IG51bGw7XG5cdCAgdGhpcy5waW5nVGltZW91dCA9IG51bGw7XG5cblx0ICAvLyBzZXQgb24gaGVhcnRiZWF0XG5cdCAgdGhpcy5waW5nSW50ZXJ2YWxUaW1lciA9IG51bGw7XG5cdCAgdGhpcy5waW5nVGltZW91dFRpbWVyID0gbnVsbDtcblxuXHQgIHRoaXMub3BlbigpO1xuXHR9XG5cblx0U29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBNaXggaW4gYEVtaXR0ZXJgLlxuXHQgKi9cblxuXHRFbWl0dGVyKFNvY2tldC5wcm90b3R5cGUpO1xuXG5cdC8qKlxuXHQgKiBQcm90b2NvbCB2ZXJzaW9uLlxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRTb2NrZXQucHJvdG9jb2wgPSBwYXJzZXIucHJvdG9jb2w7IC8vIHRoaXMgaXMgYW4gaW50XG5cblx0LyoqXG5cdCAqIEV4cG9zZSBkZXBzIGZvciBsZWdhY3kgY29tcGF0aWJpbGl0eVxuXHQgKiBhbmQgc3RhbmRhbG9uZSBicm93c2VyIGFjY2Vzcy5cblx0ICovXG5cblx0U29ja2V0LlNvY2tldCA9IFNvY2tldDtcblx0U29ja2V0LlRyYW5zcG9ydCA9IFRyYW5zcG9ydCQxO1xuXHRTb2NrZXQudHJhbnNwb3J0cyA9IHRyYW5zcG9ydHMkMjtcblx0U29ja2V0LnBhcnNlciA9IHBhcnNlcjtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0cmFuc3BvcnQgb2YgdGhlIGdpdmVuIHR5cGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0cmFuc3BvcnQgbmFtZVxuXHQgKiBAcmV0dXJuIHtUcmFuc3BvcnR9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmNyZWF0ZVRyYW5zcG9ydCA9IGZ1bmN0aW9uIChuYW1lKSB7XG5cdCAgZGVidWckNignY3JlYXRpbmcgdHJhbnNwb3J0IFwiJXNcIicsIG5hbWUpO1xuXHQgIHZhciBxdWVyeSA9IGNsb25lKHRoaXMucXVlcnkpO1xuXG5cdCAgLy8gYXBwZW5kIGVuZ2luZS5pbyBwcm90b2NvbCBpZGVudGlmaWVyXG5cdCAgcXVlcnkuRUlPID0gcGFyc2VyLnByb3RvY29sO1xuXG5cdCAgLy8gdHJhbnNwb3J0IG5hbWVcblx0ICBxdWVyeS50cmFuc3BvcnQgPSBuYW1lO1xuXG5cdCAgLy8gcGVyLXRyYW5zcG9ydCBvcHRpb25zXG5cdCAgdmFyIG9wdGlvbnMgPSB0aGlzLnRyYW5zcG9ydE9wdGlvbnNbbmFtZV0gfHwge307XG5cblx0ICAvLyBzZXNzaW9uIGlkIGlmIHdlIGFscmVhZHkgaGF2ZSBvbmVcblx0ICBpZiAodGhpcy5pZCkgcXVlcnkuc2lkID0gdGhpcy5pZDtcblxuXHQgIHZhciB0cmFuc3BvcnQgPSBuZXcgdHJhbnNwb3J0cyQyW25hbWVdKHtcblx0ICAgIHF1ZXJ5OiBxdWVyeSxcblx0ICAgIHNvY2tldDogdGhpcyxcblx0ICAgIGFnZW50OiBvcHRpb25zLmFnZW50IHx8IHRoaXMuYWdlbnQsXG5cdCAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0bmFtZSB8fCB0aGlzLmhvc3RuYW1lLFxuXHQgICAgcG9ydDogb3B0aW9ucy5wb3J0IHx8IHRoaXMucG9ydCxcblx0ICAgIHNlY3VyZTogb3B0aW9ucy5zZWN1cmUgfHwgdGhpcy5zZWN1cmUsXG5cdCAgICBwYXRoOiBvcHRpb25zLnBhdGggfHwgdGhpcy5wYXRoLFxuXHQgICAgZm9yY2VKU09OUDogb3B0aW9ucy5mb3JjZUpTT05QIHx8IHRoaXMuZm9yY2VKU09OUCxcblx0ICAgIGpzb25wOiBvcHRpb25zLmpzb25wIHx8IHRoaXMuanNvbnAsXG5cdCAgICBmb3JjZUJhc2U2NDogb3B0aW9ucy5mb3JjZUJhc2U2NCB8fCB0aGlzLmZvcmNlQmFzZTY0LFxuXHQgICAgZW5hYmxlc1hEUjogb3B0aW9ucy5lbmFibGVzWERSIHx8IHRoaXMuZW5hYmxlc1hEUixcblx0ICAgIHRpbWVzdGFtcFJlcXVlc3RzOiBvcHRpb25zLnRpbWVzdGFtcFJlcXVlc3RzIHx8IHRoaXMudGltZXN0YW1wUmVxdWVzdHMsXG5cdCAgICB0aW1lc3RhbXBQYXJhbTogb3B0aW9ucy50aW1lc3RhbXBQYXJhbSB8fCB0aGlzLnRpbWVzdGFtcFBhcmFtLFxuXHQgICAgcG9saWN5UG9ydDogb3B0aW9ucy5wb2xpY3lQb3J0IHx8IHRoaXMucG9saWN5UG9ydCxcblx0ICAgIHBmeDogb3B0aW9ucy5wZnggfHwgdGhpcy5wZngsXG5cdCAgICBrZXk6IG9wdGlvbnMua2V5IHx8IHRoaXMua2V5LFxuXHQgICAgcGFzc3BocmFzZTogb3B0aW9ucy5wYXNzcGhyYXNlIHx8IHRoaXMucGFzc3BocmFzZSxcblx0ICAgIGNlcnQ6IG9wdGlvbnMuY2VydCB8fCB0aGlzLmNlcnQsXG5cdCAgICBjYTogb3B0aW9ucy5jYSB8fCB0aGlzLmNhLFxuXHQgICAgY2lwaGVyczogb3B0aW9ucy5jaXBoZXJzIHx8IHRoaXMuY2lwaGVycyxcblx0ICAgIHJlamVjdFVuYXV0aG9yaXplZDogb3B0aW9ucy5yZWplY3RVbmF1dGhvcml6ZWQgfHwgdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQsXG5cdCAgICBwZXJNZXNzYWdlRGVmbGF0ZTogb3B0aW9ucy5wZXJNZXNzYWdlRGVmbGF0ZSB8fCB0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLFxuXHQgICAgZXh0cmFIZWFkZXJzOiBvcHRpb25zLmV4dHJhSGVhZGVycyB8fCB0aGlzLmV4dHJhSGVhZGVycyxcblx0ICAgIGZvcmNlTm9kZTogb3B0aW9ucy5mb3JjZU5vZGUgfHwgdGhpcy5mb3JjZU5vZGUsXG5cdCAgICBsb2NhbEFkZHJlc3M6IG9wdGlvbnMubG9jYWxBZGRyZXNzIHx8IHRoaXMubG9jYWxBZGRyZXNzLFxuXHQgICAgcmVxdWVzdFRpbWVvdXQ6IG9wdGlvbnMucmVxdWVzdFRpbWVvdXQgfHwgdGhpcy5yZXF1ZXN0VGltZW91dCxcblx0ICAgIHByb3RvY29sczogb3B0aW9ucy5wcm90b2NvbHMgfHwgdm9pZCAwXG5cdCAgfSk7XG5cblx0ICByZXR1cm4gdHJhbnNwb3J0O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIGNsb25lKG9iaikge1xuXHQgIHZhciBvID0ge307XG5cdCAgZm9yICh2YXIgaSBpbiBvYmopIHtcblx0ICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcblx0ICAgICAgb1tpXSA9IG9ialtpXTtcblx0ICAgIH1cblx0ICB9XG5cdCAgcmV0dXJuIG87XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZXMgdHJhbnNwb3J0IHRvIHVzZSBhbmQgc3RhcnRzIHByb2JlLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cdFNvY2tldC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgdHJhbnNwb3J0O1xuXHQgIGlmICh0aGlzLnJlbWVtYmVyVXBncmFkZSAmJiBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzICYmIHRoaXMudHJhbnNwb3J0cy5pbmRleE9mKCd3ZWJzb2NrZXQnKSAhPT0gLTEpIHtcblx0ICAgIHRyYW5zcG9ydCA9ICd3ZWJzb2NrZXQnO1xuXHQgIH0gZWxzZSBpZiAoMCA9PT0gdGhpcy50cmFuc3BvcnRzLmxlbmd0aCkge1xuXHQgICAgLy8gRW1pdCBlcnJvciBvbiBuZXh0IHRpY2sgc28gaXQgY2FuIGJlIGxpc3RlbmVkIHRvXG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc2VsZi5lbWl0KCdlcnJvcicsICdObyB0cmFuc3BvcnRzIGF2YWlsYWJsZScpO1xuXHQgICAgfSwgMCk7XG5cdCAgICByZXR1cm47XG5cdCAgfSBlbHNlIHtcblx0ICAgIHRyYW5zcG9ydCA9IHRoaXMudHJhbnNwb3J0c1swXTtcblx0ICB9XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ29wZW5pbmcnO1xuXG5cdCAgLy8gUmV0cnkgd2l0aCB0aGUgbmV4dCB0cmFuc3BvcnQgaWYgdGhlIHRyYW5zcG9ydCBpcyBkaXNhYmxlZCAoanNvbnA6IGZhbHNlKVxuXHQgIHRyeSB7XG5cdCAgICB0cmFuc3BvcnQgPSB0aGlzLmNyZWF0ZVRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuXHQgIH0gY2F0Y2ggKGUpIHtcblx0ICAgIHRoaXMudHJhbnNwb3J0cy5zaGlmdCgpO1xuXHQgICAgdGhpcy5vcGVuKCk7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgdHJhbnNwb3J0Lm9wZW4oKTtcblx0ICB0aGlzLnNldFRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjdXJyZW50IHRyYW5zcG9ydC4gRGlzYWJsZXMgdGhlIGV4aXN0aW5nIG9uZSAoaWYgYW55KS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2V0VHJhbnNwb3J0ID0gZnVuY3Rpb24gKHRyYW5zcG9ydCkge1xuXHQgIGRlYnVnJDYoJ3NldHRpbmcgdHJhbnNwb3J0ICVzJywgdHJhbnNwb3J0Lm5hbWUpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblxuXHQgIGlmICh0aGlzLnRyYW5zcG9ydCkge1xuXHQgICAgZGVidWckNignY2xlYXJpbmcgZXhpc3RpbmcgdHJhbnNwb3J0ICVzJywgdGhpcy50cmFuc3BvcnQubmFtZSk7XG5cdCAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcblx0ICB9XG5cblx0ICAvLyBzZXQgdXAgdHJhbnNwb3J0XG5cdCAgdGhpcy50cmFuc3BvcnQgPSB0cmFuc3BvcnQ7XG5cblx0ICAvLyBzZXQgdXAgdHJhbnNwb3J0IGxpc3RlbmVyc1xuXHQgIHRyYW5zcG9ydC5vbignZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLm9uRHJhaW4oKTtcblx0ICB9KS5vbigncGFja2V0JywgZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgc2VsZi5vblBhY2tldChwYWNrZXQpO1xuXHQgIH0pLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlKSB7XG5cdCAgICBzZWxmLm9uRXJyb3IoZSk7XG5cdCAgfSkub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbkNsb3NlKCd0cmFuc3BvcnQgY2xvc2UnKTtcblx0ICB9KTtcblx0fTtcblxuXHQvKipcblx0ICogUHJvYmVzIGEgdHJhbnNwb3J0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHJhbnNwb3J0IG5hbWVcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUucHJvYmUgPSBmdW5jdGlvbiAobmFtZSkge1xuXHQgIGRlYnVnJDYoJ3Byb2JpbmcgdHJhbnNwb3J0IFwiJXNcIicsIG5hbWUpO1xuXHQgIHZhciB0cmFuc3BvcnQgPSB0aGlzLmNyZWF0ZVRyYW5zcG9ydChuYW1lLCB7IHByb2JlOiAxIH0pO1xuXHQgIHZhciBmYWlsZWQgPSBmYWxzZTtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cblx0ICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gZmFsc2U7XG5cblx0ICBmdW5jdGlvbiBvblRyYW5zcG9ydE9wZW4oKSB7XG5cdCAgICBpZiAoc2VsZi5vbmx5QmluYXJ5VXBncmFkZXMpIHtcblx0ICAgICAgdmFyIHVwZ3JhZGVMb3Nlc0JpbmFyeSA9ICF0aGlzLnN1cHBvcnRzQmluYXJ5ICYmIHNlbGYudHJhbnNwb3J0LnN1cHBvcnRzQmluYXJ5O1xuXHQgICAgICBmYWlsZWQgPSBmYWlsZWQgfHwgdXBncmFkZUxvc2VzQmluYXJ5O1xuXHQgICAgfVxuXHQgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXG5cdCAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIG9wZW5lZCcsIG5hbWUpO1xuXHQgICAgdHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogJ3BpbmcnLCBkYXRhOiAncHJvYmUnIH1dKTtcblx0ICAgIHRyYW5zcG9ydC5vbmNlKCdwYWNrZXQnLCBmdW5jdGlvbiAobXNnKSB7XG5cdCAgICAgIGlmIChmYWlsZWQpIHJldHVybjtcblx0ICAgICAgaWYgKCdwb25nJyA9PT0gbXNnLnR5cGUgJiYgJ3Byb2JlJyA9PT0gbXNnLmRhdGEpIHtcblx0ICAgICAgICBkZWJ1ZyQ2KCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIHBvbmcnLCBuYW1lKTtcblx0ICAgICAgICBzZWxmLnVwZ3JhZGluZyA9IHRydWU7XG5cdCAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRpbmcnLCB0cmFuc3BvcnQpO1xuXHQgICAgICAgIGlmICghdHJhbnNwb3J0KSByZXR1cm47XG5cdCAgICAgICAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9ICd3ZWJzb2NrZXQnID09PSB0cmFuc3BvcnQubmFtZTtcblxuXHQgICAgICAgIGRlYnVnJDYoJ3BhdXNpbmcgY3VycmVudCB0cmFuc3BvcnQgXCIlc1wiJywgc2VsZi50cmFuc3BvcnQubmFtZSk7XG5cdCAgICAgICAgc2VsZi50cmFuc3BvcnQucGF1c2UoZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgaWYgKGZhaWxlZCkgcmV0dXJuO1xuXHQgICAgICAgICAgaWYgKCdjbG9zZWQnID09PSBzZWxmLnJlYWR5U3RhdGUpIHJldHVybjtcblx0ICAgICAgICAgIGRlYnVnJDYoJ2NoYW5naW5nIHRyYW5zcG9ydCBhbmQgc2VuZGluZyB1cGdyYWRlIHBhY2tldCcpO1xuXG5cdCAgICAgICAgICBjbGVhbnVwKCk7XG5cblx0ICAgICAgICAgIHNlbGYuc2V0VHJhbnNwb3J0KHRyYW5zcG9ydCk7XG5cdCAgICAgICAgICB0cmFuc3BvcnQuc2VuZChbeyB0eXBlOiAndXBncmFkZScgfV0pO1xuXHQgICAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRlJywgdHJhbnNwb3J0KTtcblx0ICAgICAgICAgIHRyYW5zcG9ydCA9IG51bGw7XG5cdCAgICAgICAgICBzZWxmLnVwZ3JhZGluZyA9IGZhbHNlO1xuXHQgICAgICAgICAgc2VsZi5mbHVzaCgpO1xuXHQgICAgICAgIH0pO1xuXHQgICAgICB9IGVsc2Uge1xuXHQgICAgICAgIGRlYnVnJDYoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgZmFpbGVkJywgbmFtZSk7XG5cdCAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcigncHJvYmUgZXJyb3InKTtcblx0ICAgICAgICBlcnIudHJhbnNwb3J0ID0gdHJhbnNwb3J0Lm5hbWU7XG5cdCAgICAgICAgc2VsZi5lbWl0KCd1cGdyYWRlRXJyb3InLCBlcnIpO1xuXHQgICAgICB9XG5cdCAgICB9KTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBmcmVlemVUcmFuc3BvcnQoKSB7XG5cdCAgICBpZiAoZmFpbGVkKSByZXR1cm47XG5cblx0ICAgIC8vIEFueSBjYWxsYmFjayBjYWxsZWQgYnkgdHJhbnNwb3J0IHNob3VsZCBiZSBpZ25vcmVkIHNpbmNlIG5vd1xuXHQgICAgZmFpbGVkID0gdHJ1ZTtcblxuXHQgICAgY2xlYW51cCgpO1xuXG5cdCAgICB0cmFuc3BvcnQuY2xvc2UoKTtcblx0ICAgIHRyYW5zcG9ydCA9IG51bGw7XG5cdCAgfVxuXG5cdCAgLy8gSGFuZGxlIGFueSBlcnJvciB0aGF0IGhhcHBlbnMgd2hpbGUgcHJvYmluZ1xuXHQgIGZ1bmN0aW9uIG9uZXJyb3IoZXJyKSB7XG5cdCAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoJ3Byb2JlIGVycm9yOiAnICsgZXJyKTtcblx0ICAgIGVycm9yLnRyYW5zcG9ydCA9IHRyYW5zcG9ydC5uYW1lO1xuXG5cdCAgICBmcmVlemVUcmFuc3BvcnQoKTtcblxuXHQgICAgZGVidWckNigncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBmYWlsZWQgYmVjYXVzZSBvZiBlcnJvcjogJXMnLCBuYW1lLCBlcnIpO1xuXG5cdCAgICBzZWxmLmVtaXQoJ3VwZ3JhZGVFcnJvcicsIGVycm9yKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiBvblRyYW5zcG9ydENsb3NlKCkge1xuXHQgICAgb25lcnJvcigndHJhbnNwb3J0IGNsb3NlZCcpO1xuXHQgIH1cblxuXHQgIC8vIFdoZW4gdGhlIHNvY2tldCBpcyBjbG9zZWQgd2hpbGUgd2UncmUgcHJvYmluZ1xuXHQgIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG5cdCAgICBvbmVycm9yKCdzb2NrZXQgY2xvc2VkJyk7XG5cdCAgfVxuXG5cdCAgLy8gV2hlbiB0aGUgc29ja2V0IGlzIHVwZ3JhZGVkIHdoaWxlIHdlJ3JlIHByb2Jpbmdcblx0ICBmdW5jdGlvbiBvbnVwZ3JhZGUodG8pIHtcblx0ICAgIGlmICh0cmFuc3BvcnQgJiYgdG8ubmFtZSAhPT0gdHJhbnNwb3J0Lm5hbWUpIHtcblx0ICAgICAgZGVidWckNignXCIlc1wiIHdvcmtzIC0gYWJvcnRpbmcgXCIlc1wiJywgdG8ubmFtZSwgdHJhbnNwb3J0Lm5hbWUpO1xuXHQgICAgICBmcmVlemVUcmFuc3BvcnQoKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICAvLyBSZW1vdmUgYWxsIGxpc3RlbmVycyBvbiB0aGUgdHJhbnNwb3J0IGFuZCBvbiBzZWxmXG5cdCAgZnVuY3Rpb24gY2xlYW51cCgpIHtcblx0ICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcignb3BlbicsIG9uVHJhbnNwb3J0T3Blbik7XG5cdCAgICB0cmFuc3BvcnQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cdCAgICB0cmFuc3BvcnQucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25UcmFuc3BvcnRDbG9zZSk7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcigndXBncmFkaW5nJywgb251cGdyYWRlKTtcblx0ICB9XG5cblx0ICB0cmFuc3BvcnQub25jZSgnb3BlbicsIG9uVHJhbnNwb3J0T3Blbik7XG5cdCAgdHJhbnNwb3J0Lm9uY2UoJ2Vycm9yJywgb25lcnJvcik7XG5cdCAgdHJhbnNwb3J0Lm9uY2UoJ2Nsb3NlJywgb25UcmFuc3BvcnRDbG9zZSk7XG5cblx0ICB0aGlzLm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG5cdCAgdGhpcy5vbmNlKCd1cGdyYWRpbmcnLCBvbnVwZ3JhZGUpO1xuXG5cdCAgdHJhbnNwb3J0Lm9wZW4oKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gY29ubmVjdGlvbiBpcyBkZWVtZWQgb3Blbi5cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5vbk9wZW4gPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNignc29ja2V0IG9wZW4nKTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9ICd3ZWJzb2NrZXQnID09PSB0aGlzLnRyYW5zcG9ydC5uYW1lO1xuXHQgIHRoaXMuZW1pdCgnb3BlbicpO1xuXHQgIHRoaXMuZmx1c2goKTtcblxuXHQgIC8vIHdlIGNoZWNrIGZvciBgcmVhZHlTdGF0ZWAgaW4gY2FzZSBhbiBgb3BlbmBcblx0ICAvLyBsaXN0ZW5lciBhbHJlYWR5IGNsb3NlZCB0aGUgc29ja2V0XG5cdCAgaWYgKCdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlICYmIHRoaXMudXBncmFkZSAmJiB0aGlzLnRyYW5zcG9ydC5wYXVzZSkge1xuXHQgICAgZGVidWckNignc3RhcnRpbmcgdXBncmFkZSBwcm9iZXMnKTtcblx0ICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy51cGdyYWRlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblx0ICAgICAgdGhpcy5wcm9iZSh0aGlzLnVwZ3JhZGVzW2ldKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIEhhbmRsZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uUGFja2V0ID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgIGlmICgnb3BlbmluZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnb3BlbicgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnY2xvc2luZycgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuXHQgICAgZGVidWckNignc29ja2V0IHJlY2VpdmU6IHR5cGUgXCIlc1wiLCBkYXRhIFwiJXNcIicsIHBhY2tldC50eXBlLCBwYWNrZXQuZGF0YSk7XG5cblx0ICAgIHRoaXMuZW1pdCgncGFja2V0JywgcGFja2V0KTtcblxuXHQgICAgLy8gU29ja2V0IGlzIGxpdmUgLSBhbnkgcGFja2V0IGNvdW50c1xuXHQgICAgdGhpcy5lbWl0KCdoZWFydGJlYXQnKTtcblxuXHQgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuXHQgICAgICBjYXNlICdvcGVuJzpcblx0ICAgICAgICB0aGlzLm9uSGFuZHNoYWtlKEpTT04ucGFyc2UocGFja2V0LmRhdGEpKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdwb25nJzpcblx0ICAgICAgICB0aGlzLnNldFBpbmcoKTtcblx0ICAgICAgICB0aGlzLmVtaXQoJ3BvbmcnKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdlcnJvcic6XG5cdCAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignc2VydmVyIGVycm9yJyk7XG5cdCAgICAgICAgZXJyLmNvZGUgPSBwYWNrZXQuZGF0YTtcblx0ICAgICAgICB0aGlzLm9uRXJyb3IoZXJyKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlICdtZXNzYWdlJzpcblx0ICAgICAgICB0aGlzLmVtaXQoJ2RhdGEnLCBwYWNrZXQuZGF0YSk7XG5cdCAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgcGFja2V0LmRhdGEpO1xuXHQgICAgICAgIGJyZWFrO1xuXHQgICAgfVxuXHQgIH0gZWxzZSB7XG5cdCAgICBkZWJ1ZyQ2KCdwYWNrZXQgcmVjZWl2ZWQgd2l0aCBzb2NrZXQgcmVhZHlTdGF0ZSBcIiVzXCInLCB0aGlzLnJlYWR5U3RhdGUpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHVwb24gaGFuZHNoYWtlIGNvbXBsZXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBoYW5kc2hha2Ugb2JqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLm9uSGFuZHNoYWtlID0gZnVuY3Rpb24gKGRhdGEpIHtcblx0ICB0aGlzLmVtaXQoJ2hhbmRzaGFrZScsIGRhdGEpO1xuXHQgIHRoaXMuaWQgPSBkYXRhLnNpZDtcblx0ICB0aGlzLnRyYW5zcG9ydC5xdWVyeS5zaWQgPSBkYXRhLnNpZDtcblx0ICB0aGlzLnVwZ3JhZGVzID0gdGhpcy5maWx0ZXJVcGdyYWRlcyhkYXRhLnVwZ3JhZGVzKTtcblx0ICB0aGlzLnBpbmdJbnRlcnZhbCA9IGRhdGEucGluZ0ludGVydmFsO1xuXHQgIHRoaXMucGluZ1RpbWVvdXQgPSBkYXRhLnBpbmdUaW1lb3V0O1xuXHQgIHRoaXMub25PcGVuKCk7XG5cdCAgLy8gSW4gY2FzZSBvcGVuIGhhbmRsZXIgY2xvc2VzIHNvY2tldFxuXHQgIGlmICgnY2xvc2VkJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgdGhpcy5zZXRQaW5nKCk7XG5cblx0ICAvLyBQcm9sb25nIGxpdmVuZXNzIG9mIHNvY2tldCBvbiBoZWFydGJlYXRcblx0ICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdoZWFydGJlYXQnLCB0aGlzLm9uSGVhcnRiZWF0KTtcblx0ICB0aGlzLm9uKCdoZWFydGJlYXQnLCB0aGlzLm9uSGVhcnRiZWF0KTtcblx0fTtcblxuXHQvKipcblx0ICogUmVzZXRzIHBpbmcgdGltZW91dC5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25IZWFydGJlYXQgPSBmdW5jdGlvbiAodGltZW91dCkge1xuXHQgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0VGltZXIpO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICBzZWxmLnBpbmdUaW1lb3V0VGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICgnY2xvc2VkJyA9PT0gc2VsZi5yZWFkeVN0YXRlKSByZXR1cm47XG5cdCAgICBzZWxmLm9uQ2xvc2UoJ3BpbmcgdGltZW91dCcpO1xuXHQgIH0sIHRpbWVvdXQgfHwgc2VsZi5waW5nSW50ZXJ2YWwgKyBzZWxmLnBpbmdUaW1lb3V0KTtcblx0fTtcblxuXHQvKipcblx0ICogUGluZ3Mgc2VydmVyIGV2ZXJ5IGB0aGlzLnBpbmdJbnRlcnZhbGAgYW5kIGV4cGVjdHMgcmVzcG9uc2Vcblx0ICogd2l0aGluIGB0aGlzLnBpbmdUaW1lb3V0YCBvciBjbG9zZXMgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2V0UGluZyA9IGZ1bmN0aW9uICgpIHtcblx0ICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgY2xlYXJUaW1lb3V0KHNlbGYucGluZ0ludGVydmFsVGltZXIpO1xuXHQgIHNlbGYucGluZ0ludGVydmFsVGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnJDYoJ3dyaXRpbmcgcGluZyBwYWNrZXQgLSBleHBlY3RpbmcgcG9uZyB3aXRoaW4gJXNtcycsIHNlbGYucGluZ1RpbWVvdXQpO1xuXHQgICAgc2VsZi5waW5nKCk7XG5cdCAgICBzZWxmLm9uSGVhcnRiZWF0KHNlbGYucGluZ1RpbWVvdXQpO1xuXHQgIH0sIHNlbGYucGluZ0ludGVydmFsKTtcblx0fTtcblxuXHQvKipcblx0KiBTZW5kcyBhIHBpbmcgcGFja2V0LlxuXHQqXG5cdCogQGFwaSBwcml2YXRlXG5cdCovXG5cblx0U29ja2V0LnByb3RvdHlwZS5waW5nID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLnNlbmRQYWNrZXQoJ3BpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICBzZWxmLmVtaXQoJ3BpbmcnKTtcblx0ICB9KTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIG9uIGBkcmFpbmAgZXZlbnRcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25EcmFpbiA9IGZ1bmN0aW9uICgpIHtcblx0ICB0aGlzLndyaXRlQnVmZmVyLnNwbGljZSgwLCB0aGlzLnByZXZCdWZmZXJMZW4pO1xuXG5cdCAgLy8gc2V0dGluZyBwcmV2QnVmZmVyTGVuID0gMCBpcyB2ZXJ5IGltcG9ydGFudFxuXHQgIC8vIGZvciBleGFtcGxlLCB3aGVuIHVwZ3JhZGluZywgdXBncmFkZSBwYWNrZXQgaXMgc2VudCBvdmVyLFxuXHQgIC8vIGFuZCBhIG5vbnplcm8gcHJldkJ1ZmZlckxlbiBjb3VsZCBjYXVzZSBwcm9ibGVtcyBvbiBgZHJhaW5gXG5cdCAgdGhpcy5wcmV2QnVmZmVyTGVuID0gMDtcblxuXHQgIGlmICgwID09PSB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCkge1xuXHQgICAgdGhpcy5lbWl0KCdkcmFpbicpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICB0aGlzLmZsdXNoKCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBGbHVzaCB3cml0ZSBidWZmZXJzLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0U29ja2V0LnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uICgpIHtcblx0ICBpZiAoJ2Nsb3NlZCcgIT09IHRoaXMucmVhZHlTdGF0ZSAmJiB0aGlzLnRyYW5zcG9ydC53cml0YWJsZSAmJiAhdGhpcy51cGdyYWRpbmcgJiYgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcblx0ICAgIGRlYnVnJDYoJ2ZsdXNoaW5nICVkIHBhY2tldHMgaW4gc29ja2V0JywgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpO1xuXHQgICAgdGhpcy50cmFuc3BvcnQuc2VuZCh0aGlzLndyaXRlQnVmZmVyKTtcblx0ICAgIC8vIGtlZXAgdHJhY2sgb2YgY3VycmVudCBsZW5ndGggb2Ygd3JpdGVCdWZmZXJcblx0ICAgIC8vIHNwbGljZSB3cml0ZUJ1ZmZlciBhbmQgY2FsbGJhY2tCdWZmZXIgb24gYGRyYWluYFxuXHQgICAgdGhpcy5wcmV2QnVmZmVyTGVuID0gdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGg7XG5cdCAgICB0aGlzLmVtaXQoJ2ZsdXNoJyk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZW5kcyBhIG1lc3NhZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG5cdCAqIEByZXR1cm4ge1NvY2tldH0gZm9yIGNoYWluaW5nLlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLndyaXRlID0gU29ja2V0LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKG1zZywgb3B0aW9ucywgZm4pIHtcblx0ICB0aGlzLnNlbmRQYWNrZXQoJ21lc3NhZ2UnLCBtc2csIG9wdGlvbnMsIGZuKTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2VuZHMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBwYWNrZXQgdHlwZS5cblx0ICogQHBhcmFtIHtTdHJpbmd9IGRhdGEuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuc2VuZFBhY2tldCA9IGZ1bmN0aW9uICh0eXBlLCBkYXRhLCBvcHRpb25zLCBmbikge1xuXHQgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZGF0YSkge1xuXHQgICAgZm4gPSBkYXRhO1xuXHQgICAgZGF0YSA9IHVuZGVmaW5lZDtcblx0ICB9XG5cblx0ICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9wdGlvbnMpIHtcblx0ICAgIGZuID0gb3B0aW9ucztcblx0ICAgIG9wdGlvbnMgPSBudWxsO1xuXHQgIH1cblxuXHQgIGlmICgnY2xvc2luZycgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCAnY2xvc2VkJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICByZXR1cm47XG5cdCAgfVxuXG5cdCAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cdCAgb3B0aW9ucy5jb21wcmVzcyA9IGZhbHNlICE9PSBvcHRpb25zLmNvbXByZXNzO1xuXG5cdCAgdmFyIHBhY2tldCA9IHtcblx0ICAgIHR5cGU6IHR5cGUsXG5cdCAgICBkYXRhOiBkYXRhLFxuXHQgICAgb3B0aW9uczogb3B0aW9uc1xuXHQgIH07XG5cdCAgdGhpcy5lbWl0KCdwYWNrZXRDcmVhdGUnLCBwYWNrZXQpO1xuXHQgIHRoaXMud3JpdGVCdWZmZXIucHVzaChwYWNrZXQpO1xuXHQgIGlmIChmbikgdGhpcy5vbmNlKCdmbHVzaCcsIGZuKTtcblx0ICB0aGlzLmZsdXNoKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENsb3NlcyB0aGUgY29ubmVjdGlvbi5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG5cdCAgaWYgKCdvcGVuaW5nJyA9PT0gdGhpcy5yZWFkeVN0YXRlIHx8ICdvcGVuJyA9PT0gdGhpcy5yZWFkeVN0YXRlKSB7XG5cdCAgICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2luZyc7XG5cblx0ICAgIHZhciBzZWxmID0gdGhpcztcblxuXHQgICAgaWYgKHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSB7XG5cdCAgICAgIHRoaXMub25jZSgnZHJhaW4nLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgaWYgKHRoaXMudXBncmFkaW5nKSB7XG5cdCAgICAgICAgICB3YWl0Rm9yVXBncmFkZSgpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBjbG9zZSgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9IGVsc2UgaWYgKHRoaXMudXBncmFkaW5nKSB7XG5cdCAgICAgIHdhaXRGb3JVcGdyYWRlKCk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBjbG9zZSgpO1xuXHQgICAgfVxuXHQgIH1cblxuXHQgIGZ1bmN0aW9uIGNsb3NlKCkge1xuXHQgICAgc2VsZi5vbkNsb3NlKCdmb3JjZWQgY2xvc2UnKTtcblx0ICAgIGRlYnVnJDYoJ3NvY2tldCBjbG9zaW5nIC0gdGVsbGluZyB0cmFuc3BvcnQgdG8gY2xvc2UnKTtcblx0ICAgIHNlbGYudHJhbnNwb3J0LmNsb3NlKCk7XG5cdCAgfVxuXG5cdCAgZnVuY3Rpb24gY2xlYW51cEFuZENsb3NlKCkge1xuXHQgICAgc2VsZi5yZW1vdmVMaXN0ZW5lcigndXBncmFkZScsIGNsZWFudXBBbmRDbG9zZSk7XG5cdCAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKCd1cGdyYWRlRXJyb3InLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgICAgY2xvc2UoKTtcblx0ICB9XG5cblx0ICBmdW5jdGlvbiB3YWl0Rm9yVXBncmFkZSgpIHtcblx0ICAgIC8vIHdhaXQgZm9yIHVwZ3JhZGUgdG8gZmluaXNoIHNpbmNlIHdlIGNhbid0IHNlbmQgcGFja2V0cyB3aGlsZSBwYXVzaW5nIGEgdHJhbnNwb3J0XG5cdCAgICBzZWxmLm9uY2UoJ3VwZ3JhZGUnLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgICAgc2VsZi5vbmNlKCd1cGdyYWRlRXJyb3InLCBjbGVhbnVwQW5kQ2xvc2UpO1xuXHQgIH1cblxuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiB0cmFuc3BvcnQgZXJyb3Jcblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25FcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblx0ICBkZWJ1ZyQ2KCdzb2NrZXQgZXJyb3IgJWonLCBlcnIpO1xuXHQgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSBmYWxzZTtcblx0ICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLm9uQ2xvc2UoJ3RyYW5zcG9ydCBlcnJvcicsIGVycik7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBjbG9zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdFNvY2tldC5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uIChyZWFzb24sIGRlc2MpIHtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ29wZW4nID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgJ2Nsb3NpbmcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIGRlYnVnJDYoJ3NvY2tldCBjbG9zZSB3aXRoIHJlYXNvbjogXCIlc1wiJywgcmVhc29uKTtcblx0ICAgIHZhciBzZWxmID0gdGhpcztcblxuXHQgICAgLy8gY2xlYXIgdGltZXJzXG5cdCAgICBjbGVhclRpbWVvdXQodGhpcy5waW5nSW50ZXJ2YWxUaW1lcik7XG5cdCAgICBjbGVhclRpbWVvdXQodGhpcy5waW5nVGltZW91dFRpbWVyKTtcblxuXHQgICAgLy8gc3RvcCBldmVudCBmcm9tIGZpcmluZyBhZ2FpbiBmb3IgdHJhbnNwb3J0XG5cdCAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2Nsb3NlJyk7XG5cblx0ICAgIC8vIGVuc3VyZSB0cmFuc3BvcnQgd29uJ3Qgc3RheSBvcGVuXG5cdCAgICB0aGlzLnRyYW5zcG9ydC5jbG9zZSgpO1xuXG5cdCAgICAvLyBpZ25vcmUgZnVydGhlciB0cmFuc3BvcnQgY29tbXVuaWNhdGlvblxuXHQgICAgdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cblx0ICAgIC8vIHNldCByZWFkeSBzdGF0ZVxuXHQgICAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cblx0ICAgIC8vIGNsZWFyIHNlc3Npb24gaWRcblx0ICAgIHRoaXMuaWQgPSBudWxsO1xuXG5cdCAgICAvLyBlbWl0IGNsb3NlIGV2ZW50XG5cdCAgICB0aGlzLmVtaXQoJ2Nsb3NlJywgcmVhc29uLCBkZXNjKTtcblxuXHQgICAgLy8gY2xlYW4gYnVmZmVycyBhZnRlciwgc28gdXNlcnMgY2FuIHN0aWxsXG5cdCAgICAvLyBncmFiIHRoZSBidWZmZXJzIG9uIGBjbG9zZWAgZXZlbnRcblx0ICAgIHNlbGYud3JpdGVCdWZmZXIgPSBbXTtcblx0ICAgIHNlbGYucHJldkJ1ZmZlckxlbiA9IDA7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBGaWx0ZXJzIHVwZ3JhZGVzLCByZXR1cm5pbmcgb25seSB0aG9zZSBtYXRjaGluZyBjbGllbnQgdHJhbnNwb3J0cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheX0gc2VydmVyIHVwZ3JhZGVzXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKlxuXHQgKi9cblxuXHRTb2NrZXQucHJvdG90eXBlLmZpbHRlclVwZ3JhZGVzID0gZnVuY3Rpb24gKHVwZ3JhZGVzKSB7XG5cdCAgdmFyIGZpbHRlcmVkVXBncmFkZXMgPSBbXTtcblx0ICBmb3IgKHZhciBpID0gMCwgaiA9IHVwZ3JhZGVzLmxlbmd0aDsgaSA8IGo7IGkrKykge1xuXHQgICAgaWYgKH5pbmRleCh0aGlzLnRyYW5zcG9ydHMsIHVwZ3JhZGVzW2ldKSkgZmlsdGVyZWRVcGdyYWRlcy5wdXNoKHVwZ3JhZGVzW2ldKTtcblx0ICB9XG5cdCAgcmV0dXJuIGZpbHRlcmVkVXBncmFkZXM7XG5cdH07XG5cblx0dmFyIHNvY2tldCQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IHNvY2tldCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IHNvY2tldFxuXHR9KTtcblxuXHR2YXIgcmVxdWlyZSQkMCQ0ID0gKCBzb2NrZXQkMSAmJiBzb2NrZXQgKSB8fCBzb2NrZXQkMTtcblxuXHR2YXIgbGliID0gcmVxdWlyZSQkMCQ0O1xuXG5cdC8qKlxuXHQgKiBFeHBvcnRzIHBhcnNlclxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKlxuXHQgKi9cblx0dmFyIHBhcnNlciQxID0gcGFyc2VyO1xuXHRsaWIucGFyc2VyID0gcGFyc2VyJDE7XG5cblx0dmFyIGxpYiQxID0gLyojX19QVVJFX18qL09iamVjdC5mcmVlemUoe1xuXHRcdGRlZmF1bHQ6IGxpYixcblx0XHRfX21vZHVsZUV4cG9ydHM6IGxpYixcblx0XHRwYXJzZXI6IHBhcnNlciQxXG5cdH0pO1xuXG5cdHZhciB0b0FycmF5XzEgPSB0b0FycmF5JDE7XG5cblx0ZnVuY3Rpb24gdG9BcnJheSQxKGxpc3QsIGluZGV4KSB7XG5cdCAgICB2YXIgYXJyYXkgPSBbXTtcblxuXHQgICAgaW5kZXggPSBpbmRleCB8fCAwO1xuXG5cdCAgICBmb3IgKHZhciBpID0gaW5kZXggfHwgMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0ICAgICAgICBhcnJheVtpIC0gaW5kZXhdID0gbGlzdFtpXTtcblx0ICAgIH1cblxuXHQgICAgcmV0dXJuIGFycmF5O1xuXHR9XG5cblx0dmFyIHRvQXJyYXkkMiA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiB0b0FycmF5XzEsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiB0b0FycmF5XzFcblx0fSk7XG5cblx0LyoqXG5cdCAqIE1vZHVsZSBleHBvcnRzLlxuXHQgKi9cblxuXHR2YXIgb25fMSA9IG9uO1xuXG5cdC8qKlxuXHQgKiBIZWxwZXIgZm9yIHN1YnNjcmlwdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fEV2ZW50RW1pdHRlcn0gb2JqIHdpdGggYEVtaXR0ZXJgIG1peGluIG9yIGBFdmVudEVtaXR0ZXJgXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBuYW1lXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdGZ1bmN0aW9uIG9uKG9iaiwgZXYsIGZuKSB7XG5cdCAgb2JqLm9uKGV2LCBmbik7XG5cdCAgcmV0dXJuIHtcblx0ICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICAgIG9iai5yZW1vdmVMaXN0ZW5lcihldiwgZm4pO1xuXHQgICAgfVxuXHQgIH07XG5cdH1cblxuXHR2YXIgb24kMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBvbl8xLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogb25fMVxuXHR9KTtcblxuXHQvKipcblx0ICogU2xpY2UgcmVmZXJlbmNlLlxuXHQgKi9cblxuXHR2YXIgc2xpY2UgPSBbXS5zbGljZTtcblxuXHQvKipcblx0ICogQmluZCBgb2JqYCB0byBgZm5gLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb258U3RyaW5nfSBmbiBvciBzdHJpbmdcblx0ICogQHJldHVybiB7RnVuY3Rpb259XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdHZhciBjb21wb25lbnRCaW5kID0gZnVuY3Rpb24gY29tcG9uZW50QmluZChvYmosIGZuKSB7XG5cdCAgaWYgKCdzdHJpbmcnID09IHR5cGVvZiBmbikgZm4gPSBvYmpbZm5dO1xuXHQgIGlmICgnZnVuY3Rpb24nICE9IHR5cGVvZiBmbikgdGhyb3cgbmV3IEVycm9yKCdiaW5kKCkgcmVxdWlyZXMgYSBmdW5jdGlvbicpO1xuXHQgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuXHQgIHJldHVybiBmdW5jdGlvbiAoKSB7XG5cdCAgICByZXR1cm4gZm4uYXBwbHkob2JqLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcblx0ICB9O1xuXHR9O1xuXG5cdHZhciBjb21wb25lbnRCaW5kJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogY29tcG9uZW50QmluZCxcblx0XHRfX21vZHVsZUV4cG9ydHM6IGNvbXBvbmVudEJpbmRcblx0fSk7XG5cblx0dmFyIHBhcnNlciQyID0gKCBzb2NrZXRfaW9QYXJzZXIkMSAmJiBzb2NrZXRfaW9QYXJzZXIgKSB8fCBzb2NrZXRfaW9QYXJzZXIkMTtcblxuXHR2YXIgdG9BcnJheSQzID0gKCB0b0FycmF5JDIgJiYgdG9BcnJheV8xICkgfHwgdG9BcnJheSQyO1xuXG5cdHZhciBvbiQyID0gKCBvbiQxICYmIG9uXzEgKSB8fCBvbiQxO1xuXG5cdHZhciBiaW5kID0gKCBjb21wb25lbnRCaW5kJDEgJiYgY29tcG9uZW50QmluZCApIHx8IGNvbXBvbmVudEJpbmQkMTtcblxuXHR2YXIgc29ja2V0JDIgPSBjcmVhdGVDb21tb25qc01vZHVsZShmdW5jdGlvbiAobW9kdWxlLCBleHBvcnRzKSB7XG5cdCAgLyoqXG5cdCAgICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICAgKi9cblxuXHQgIHZhciBkZWJ1ZyA9IHJlcXVpcmUkJDAkMignc29ja2V0LmlvLWNsaWVudDpzb2NrZXQnKTtcblxuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBleHBvcnRzLlxuXHQgICAqL1xuXG5cdCAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gU29ja2V0O1xuXG5cdCAgLyoqXG5cdCAgICogSW50ZXJuYWwgZXZlbnRzIChibGFja2xpc3RlZCkuXG5cdCAgICogVGhlc2UgZXZlbnRzIGNhbid0IGJlIGVtaXR0ZWQgYnkgdGhlIHVzZXIuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIHZhciBldmVudHMgPSB7XG5cdCAgICBjb25uZWN0OiAxLFxuXHQgICAgY29ubmVjdF9lcnJvcjogMSxcblx0ICAgIGNvbm5lY3RfdGltZW91dDogMSxcblx0ICAgIGNvbm5lY3Rpbmc6IDEsXG5cdCAgICBkaXNjb25uZWN0OiAxLFxuXHQgICAgZXJyb3I6IDEsXG5cdCAgICByZWNvbm5lY3Q6IDEsXG5cdCAgICByZWNvbm5lY3RfYXR0ZW1wdDogMSxcblx0ICAgIHJlY29ubmVjdF9mYWlsZWQ6IDEsXG5cdCAgICByZWNvbm5lY3RfZXJyb3I6IDEsXG5cdCAgICByZWNvbm5lY3Rpbmc6IDEsXG5cdCAgICBwaW5nOiAxLFxuXHQgICAgcG9uZzogMVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTaG9ydGN1dCB0byBgRW1pdHRlciNlbWl0YC5cblx0ICAgKi9cblxuXHQgIHZhciBlbWl0ID0gRW1pdHRlci5wcm90b3R5cGUuZW1pdDtcblxuXHQgIC8qKlxuXHQgICAqIGBTb2NrZXRgIGNvbnN0cnVjdG9yLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGZ1bmN0aW9uIFNvY2tldChpbywgbnNwLCBvcHRzKSB7XG5cdCAgICB0aGlzLmlvID0gaW87XG5cdCAgICB0aGlzLm5zcCA9IG5zcDtcblx0ICAgIHRoaXMuanNvbiA9IHRoaXM7IC8vIGNvbXBhdFxuXHQgICAgdGhpcy5pZHMgPSAwO1xuXHQgICAgdGhpcy5hY2tzID0ge307XG5cdCAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcblx0ICAgIHRoaXMuc2VuZEJ1ZmZlciA9IFtdO1xuXHQgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcblx0ICAgIHRoaXMuZGlzY29ubmVjdGVkID0gdHJ1ZTtcblx0ICAgIHRoaXMuZmxhZ3MgPSB7fTtcblx0ICAgIGlmIChvcHRzICYmIG9wdHMucXVlcnkpIHtcblx0ICAgICAgdGhpcy5xdWVyeSA9IG9wdHMucXVlcnk7XG5cdCAgICB9XG5cdCAgICBpZiAodGhpcy5pby5hdXRvQ29ubmVjdCkgdGhpcy5vcGVuKCk7XG5cdCAgfVxuXG5cdCAgLyoqXG5cdCAgICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICAgKi9cblxuXHQgIEVtaXR0ZXIoU29ja2V0LnByb3RvdHlwZSk7XG5cblx0ICAvKipcblx0ICAgKiBTdWJzY3JpYmUgdG8gb3BlbiwgY2xvc2UgYW5kIHBhY2tldCBldmVudHNcblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5zdWJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICBpZiAodGhpcy5zdWJzKSByZXR1cm47XG5cblx0ICAgIHZhciBpbyA9IHRoaXMuaW87XG5cdCAgICB0aGlzLnN1YnMgPSBbb24kMihpbywgJ29wZW4nLCBiaW5kKHRoaXMsICdvbm9wZW4nKSksIG9uJDIoaW8sICdwYWNrZXQnLCBiaW5kKHRoaXMsICdvbnBhY2tldCcpKSwgb24kMihpbywgJ2Nsb3NlJywgYmluZCh0aGlzLCAnb25jbG9zZScpKV07XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFwiT3BlbnNcIiB0aGUgc29ja2V0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUub3BlbiA9IFNvY2tldC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkgcmV0dXJuIHRoaXM7XG5cblx0ICAgIHRoaXMuc3ViRXZlbnRzKCk7XG5cdCAgICB0aGlzLmlvLm9wZW4oKTsgLy8gZW5zdXJlIG9wZW5cblx0ICAgIGlmICgnb3BlbicgPT09IHRoaXMuaW8ucmVhZHlTdGF0ZSkgdGhpcy5vbm9wZW4oKTtcblx0ICAgIHRoaXMuZW1pdCgnY29ubmVjdGluZycpO1xuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNlbmRzIGEgYG1lc3NhZ2VgIGV2ZW50LlxuXHQgICAqXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciBhcmdzID0gdG9BcnJheSQzKGFyZ3VtZW50cyk7XG5cdCAgICBhcmdzLnVuc2hpZnQoJ21lc3NhZ2UnKTtcblx0ICAgIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBhcmdzKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBPdmVycmlkZSBgZW1pdGAuXG5cdCAgICogSWYgdGhlIGV2ZW50IGlzIGluIGBldmVudHNgLCBpdCdzIGVtaXR0ZWQgbm9ybWFsbHkuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgbmFtZVxuXHQgICAqIEByZXR1cm4ge1NvY2tldH0gc2VsZlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoZXYpIHtcblx0ICAgIGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoZXYpKSB7XG5cdCAgICAgIGVtaXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0ICAgICAgcmV0dXJuIHRoaXM7XG5cdCAgICB9XG5cblx0ICAgIHZhciBhcmdzID0gdG9BcnJheSQzKGFyZ3VtZW50cyk7XG5cdCAgICB2YXIgcGFja2V0ID0ge1xuXHQgICAgICB0eXBlOiAodGhpcy5mbGFncy5iaW5hcnkgIT09IHVuZGVmaW5lZCA/IHRoaXMuZmxhZ3MuYmluYXJ5IDogaGFzQmluYXJ5JDEoYXJncykpID8gcGFyc2VyJDIuQklOQVJZX0VWRU5UIDogcGFyc2VyJDIuRVZFTlQsXG5cdCAgICAgIGRhdGE6IGFyZ3Ncblx0ICAgIH07XG5cblx0ICAgIHBhY2tldC5vcHRpb25zID0ge307XG5cdCAgICBwYWNrZXQub3B0aW9ucy5jb21wcmVzcyA9ICF0aGlzLmZsYWdzIHx8IGZhbHNlICE9PSB0aGlzLmZsYWdzLmNvbXByZXNzO1xuXG5cdCAgICAvLyBldmVudCBhY2sgY2FsbGJhY2tcblx0ICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdKSB7XG5cdCAgICAgIGRlYnVnKCdlbWl0dGluZyBwYWNrZXQgd2l0aCBhY2sgaWQgJWQnLCB0aGlzLmlkcyk7XG5cdCAgICAgIHRoaXMuYWNrc1t0aGlzLmlkc10gPSBhcmdzLnBvcCgpO1xuXHQgICAgICBwYWNrZXQuaWQgPSB0aGlzLmlkcysrO1xuXHQgICAgfVxuXG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgdGhpcy5wYWNrZXQocGFja2V0KTtcblx0ICAgIH0gZWxzZSB7XG5cdCAgICAgIHRoaXMuc2VuZEJ1ZmZlci5wdXNoKHBhY2tldCk7XG5cdCAgICB9XG5cblx0ICAgIHRoaXMuZmxhZ3MgPSB7fTtcblxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNlbmRzIGEgcGFja2V0LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5wYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICBwYWNrZXQubnNwID0gdGhpcy5uc3A7XG5cdCAgICB0aGlzLmlvLnBhY2tldChwYWNrZXQpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBlbmdpbmUgYG9wZW5gLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnKCd0cmFuc3BvcnQgaXMgb3BlbiAtIGNvbm5lY3RpbmcnKTtcblxuXHQgICAgLy8gd3JpdGUgY29ubmVjdCBwYWNrZXQgaWYgbmVjZXNzYXJ5XG5cdCAgICBpZiAoJy8nICE9PSB0aGlzLm5zcCkge1xuXHQgICAgICBpZiAodGhpcy5xdWVyeSkge1xuXHQgICAgICAgIHZhciBxdWVyeSA9IF90eXBlb2YodGhpcy5xdWVyeSkgPT09ICdvYmplY3QnID8gcGFyc2VxcyQyLmVuY29kZSh0aGlzLnF1ZXJ5KSA6IHRoaXMucXVlcnk7XG5cdCAgICAgICAgZGVidWcoJ3NlbmRpbmcgY29ubmVjdCBwYWNrZXQgd2l0aCBxdWVyeSAlcycsIHF1ZXJ5KTtcblx0ICAgICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IHBhcnNlciQyLkNPTk5FQ1QsIHF1ZXJ5OiBxdWVyeSB9KTtcblx0ICAgICAgfSBlbHNlIHtcblx0ICAgICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IHBhcnNlciQyLkNPTk5FQ1QgfSk7XG5cdCAgICAgIH1cblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gZW5naW5lIGBjbG9zZWAuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgICBkZWJ1ZygnY2xvc2UgKCVzKScsIHJlYXNvbik7XG5cdCAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xuXHQgICAgdGhpcy5kaXNjb25uZWN0ZWQgPSB0cnVlO1xuXHQgICAgZGVsZXRlIHRoaXMuaWQ7XG5cdCAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3QnLCByZWFzb24pO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgd2l0aCBzb2NrZXQgcGFja2V0LlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtPYmplY3R9IHBhY2tldFxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbnBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICAgIHZhciBzYW1lTmFtZXNwYWNlID0gcGFja2V0Lm5zcCA9PT0gdGhpcy5uc3A7XG5cdCAgICB2YXIgcm9vdE5hbWVzcGFjZUVycm9yID0gcGFja2V0LnR5cGUgPT09IHBhcnNlciQyLkVSUk9SICYmIHBhY2tldC5uc3AgPT09ICcvJztcblxuXHQgICAgaWYgKCFzYW1lTmFtZXNwYWNlICYmICFyb290TmFtZXNwYWNlRXJyb3IpIHJldHVybjtcblxuXHQgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuXHQgICAgICBjYXNlIHBhcnNlciQyLkNPTk5FQ1Q6XG5cdCAgICAgICAgdGhpcy5vbmNvbm5lY3QoKTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkVWRU5UOlxuXHQgICAgICAgIHRoaXMub25ldmVudChwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQklOQVJZX0VWRU5UOlxuXHQgICAgICAgIHRoaXMub25ldmVudChwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuQUNLOlxuXHQgICAgICAgIHRoaXMub25hY2socGFja2V0KTtcblx0ICAgICAgICBicmVhaztcblxuXHQgICAgICBjYXNlIHBhcnNlciQyLkJJTkFSWV9BQ0s6XG5cdCAgICAgICAgdGhpcy5vbmFjayhwYWNrZXQpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuRElTQ09OTkVDVDpcblx0ICAgICAgICB0aGlzLm9uZGlzY29ubmVjdCgpO1xuXHQgICAgICAgIGJyZWFrO1xuXG5cdCAgICAgIGNhc2UgcGFyc2VyJDIuRVJST1I6XG5cdCAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgICBicmVhaztcblx0ICAgIH1cblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgZXZlbnQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uZXZlbnQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgICB2YXIgYXJncyA9IHBhY2tldC5kYXRhIHx8IFtdO1xuXHQgICAgZGVidWcoJ2VtaXR0aW5nIGV2ZW50ICVqJywgYXJncyk7XG5cblx0ICAgIGlmIChudWxsICE9IHBhY2tldC5pZCkge1xuXHQgICAgICBkZWJ1ZygnYXR0YWNoaW5nIGFjayBjYWxsYmFjayB0byBldmVudCcpO1xuXHQgICAgICBhcmdzLnB1c2godGhpcy5hY2socGFja2V0LmlkKSk7XG5cdCAgICB9XG5cblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICBlbWl0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgdGhpcy5yZWNlaXZlQnVmZmVyLnB1c2goYXJncyk7XG5cdCAgICB9XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFByb2R1Y2VzIGFuIGFjayBjYWxsYmFjayB0byBlbWl0IHdpdGggYW4gZXZlbnQuXG5cdCAgICpcblx0ICAgKiBAYXBpIHByaXZhdGVcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuYWNrID0gZnVuY3Rpb24gKGlkKSB7XG5cdCAgICB2YXIgc2VsZiA9IHRoaXM7XG5cdCAgICB2YXIgc2VudCA9IGZhbHNlO1xuXHQgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgLy8gcHJldmVudCBkb3VibGUgY2FsbGJhY2tzXG5cdCAgICAgIGlmIChzZW50KSByZXR1cm47XG5cdCAgICAgIHNlbnQgPSB0cnVlO1xuXHQgICAgICB2YXIgYXJncyA9IHRvQXJyYXkkMyhhcmd1bWVudHMpO1xuXHQgICAgICBkZWJ1Zygnc2VuZGluZyBhY2sgJWonLCBhcmdzKTtcblxuXHQgICAgICBzZWxmLnBhY2tldCh7XG5cdCAgICAgICAgdHlwZTogaGFzQmluYXJ5JDEoYXJncykgPyBwYXJzZXIkMi5CSU5BUllfQUNLIDogcGFyc2VyJDIuQUNLLFxuXHQgICAgICAgIGlkOiBpZCxcblx0ICAgICAgICBkYXRhOiBhcmdzXG5cdCAgICAgIH0pO1xuXHQgICAgfTtcblx0ICB9O1xuXG5cdCAgLyoqXG5cdCAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgYWNrbm93bGVnZW1lbnQuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0XG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uYWNrID0gZnVuY3Rpb24gKHBhY2tldCkge1xuXHQgICAgdmFyIGFjayA9IHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuXHQgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBhY2spIHtcblx0ICAgICAgZGVidWcoJ2NhbGxpbmcgYWNrICVzIHdpdGggJWonLCBwYWNrZXQuaWQsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgYWNrLmFwcGx5KHRoaXMsIHBhY2tldC5kYXRhKTtcblx0ICAgICAgZGVsZXRlIHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgZGVidWcoJ2JhZCBhY2sgJXMnLCBwYWNrZXQuaWQpO1xuXHQgICAgfVxuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBDYWxsZWQgdXBvbiBzZXJ2ZXIgY29ubmVjdC5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZVxuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5vbmNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG5cdCAgICB0aGlzLmRpc2Nvbm5lY3RlZCA9IGZhbHNlO1xuXHQgICAgdGhpcy5lbWl0KCdjb25uZWN0Jyk7XG5cdCAgICB0aGlzLmVtaXRCdWZmZXJlZCgpO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBFbWl0IGJ1ZmZlcmVkIGV2ZW50cyAocmVjZWl2ZWQgYW5kIGVtaXR0ZWQpLlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLmVtaXRCdWZmZXJlZCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIHZhciBpO1xuXHQgICAgZm9yIChpID0gMDsgaSA8IHRoaXMucmVjZWl2ZUJ1ZmZlci5sZW5ndGg7IGkrKykge1xuXHQgICAgICBlbWl0LmFwcGx5KHRoaXMsIHRoaXMucmVjZWl2ZUJ1ZmZlcltpXSk7XG5cdCAgICB9XG5cdCAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcblxuXHQgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuc2VuZEJ1ZmZlci5sZW5ndGg7IGkrKykge1xuXHQgICAgICB0aGlzLnBhY2tldCh0aGlzLnNlbmRCdWZmZXJbaV0pO1xuXHQgICAgfVxuXHQgICAgdGhpcy5zZW5kQnVmZmVyID0gW107XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIHNlcnZlciBkaXNjb25uZWN0LlxuXHQgICAqXG5cdCAgICogQGFwaSBwcml2YXRlXG5cdCAgICovXG5cblx0ICBTb2NrZXQucHJvdG90eXBlLm9uZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGRlYnVnKCdzZXJ2ZXIgZGlzY29ubmVjdCAoJXMpJywgdGhpcy5uc3ApO1xuXHQgICAgdGhpcy5kZXN0cm95KCk7XG5cdCAgICB0aGlzLm9uY2xvc2UoJ2lvIHNlcnZlciBkaXNjb25uZWN0Jyk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIENhbGxlZCB1cG9uIGZvcmNlZCBjbGllbnQvc2VydmVyIHNpZGUgZGlzY29ubmVjdGlvbnMsXG5cdCAgICogdGhpcyBtZXRob2QgZW5zdXJlcyB0aGUgbWFuYWdlciBzdG9wcyB0cmFja2luZyB1cyBhbmRcblx0ICAgKiB0aGF0IHJlY29ubmVjdGlvbnMgZG9uJ3QgZ2V0IHRyaWdnZXJlZCBmb3IgdGhpcy5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHJpdmF0ZS5cblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLnN1YnMpIHtcblx0ICAgICAgLy8gY2xlYW4gc3Vic2NyaXB0aW9ucyB0byBhdm9pZCByZWNvbm5lY3Rpb25zXG5cdCAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5zdWJzLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgdGhpcy5zdWJzW2ldLmRlc3Ryb3koKTtcblx0ICAgICAgfVxuXHQgICAgICB0aGlzLnN1YnMgPSBudWxsO1xuXHQgICAgfVxuXG5cdCAgICB0aGlzLmlvLmRlc3Ryb3kodGhpcyk7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIERpc2Nvbm5lY3RzIHRoZSBzb2NrZXQgbWFudWFsbHkuXG5cdCAgICpcblx0ICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgU29ja2V0LnByb3RvdHlwZS5jbG9zZSA9IFNvY2tldC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uICgpIHtcblx0ICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuXHQgICAgICBkZWJ1ZygncGVyZm9ybWluZyBkaXNjb25uZWN0ICglcyknLCB0aGlzLm5zcCk7XG5cdCAgICAgIHRoaXMucGFja2V0KHsgdHlwZTogcGFyc2VyJDIuRElTQ09OTkVDVCB9KTtcblx0ICAgIH1cblxuXHQgICAgLy8gcmVtb3ZlIHNvY2tldCBmcm9tIHBvb2xcblx0ICAgIHRoaXMuZGVzdHJveSgpO1xuXG5cdCAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcblx0ICAgICAgLy8gZmlyZSBldmVudHNcblx0ICAgICAgdGhpcy5vbmNsb3NlKCdpbyBjbGllbnQgZGlzY29ubmVjdCcpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIHRoaXM7XG5cdCAgfTtcblxuXHQgIC8qKlxuXHQgICAqIFNldHMgdGhlIGNvbXByZXNzIGZsYWcuXG5cdCAgICpcblx0ICAgKiBAcGFyYW0ge0Jvb2xlYW59IGlmIGB0cnVlYCwgY29tcHJlc3NlcyB0aGUgc2VuZGluZyBkYXRhXG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuY29tcHJlc3MgPSBmdW5jdGlvbiAoY29tcHJlc3MpIHtcblx0ICAgIHRoaXMuZmxhZ3MuY29tcHJlc3MgPSBjb21wcmVzcztcblx0ICAgIHJldHVybiB0aGlzO1xuXHQgIH07XG5cblx0ICAvKipcblx0ICAgKiBTZXRzIHRoZSBiaW5hcnkgZmxhZ1xuXHQgICAqXG5cdCAgICogQHBhcmFtIHtCb29sZWFufSB3aGV0aGVyIHRoZSBlbWl0dGVkIGRhdGEgY29udGFpbnMgYmluYXJ5XG5cdCAgICogQHJldHVybiB7U29ja2V0fSBzZWxmXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIFNvY2tldC5wcm90b3R5cGUuYmluYXJ5ID0gZnVuY3Rpb24gKGJpbmFyeSkge1xuXHQgICAgdGhpcy5mbGFncy5iaW5hcnkgPSBiaW5hcnk7XG5cdCAgICByZXR1cm4gdGhpcztcblx0ICB9O1xuXHR9KTtcblxuXHR2YXIgc29ja2V0JDMgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogc29ja2V0JDIsXG5cdFx0X19tb2R1bGVFeHBvcnRzOiBzb2NrZXQkMlxuXHR9KTtcblxuXHQvKipcblx0ICogRXhwb3NlIGBCYWNrb2ZmYC5cblx0ICovXG5cblx0dmFyIGJhY2tvMiA9IEJhY2tvZmY7XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgYmFja29mZiB0aW1lciB3aXRoIGBvcHRzYC5cblx0ICpcblx0ICogLSBgbWluYCBpbml0aWFsIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIFsxMDBdXG5cdCAqIC0gYG1heGAgbWF4IHRpbWVvdXQgWzEwMDAwXVxuXHQgKiAtIGBqaXR0ZXJgIFswXVxuXHQgKiAtIGBmYWN0b3JgIFsyXVxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRmdW5jdGlvbiBCYWNrb2ZmKG9wdHMpIHtcblx0ICBvcHRzID0gb3B0cyB8fCB7fTtcblx0ICB0aGlzLm1zID0gb3B0cy5taW4gfHwgMTAwO1xuXHQgIHRoaXMubWF4ID0gb3B0cy5tYXggfHwgMTAwMDA7XG5cdCAgdGhpcy5mYWN0b3IgPSBvcHRzLmZhY3RvciB8fCAyO1xuXHQgIHRoaXMuaml0dGVyID0gb3B0cy5qaXR0ZXIgPiAwICYmIG9wdHMuaml0dGVyIDw9IDEgPyBvcHRzLmppdHRlciA6IDA7XG5cdCAgdGhpcy5hdHRlbXB0cyA9IDA7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBiYWNrb2ZmIGR1cmF0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9XG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLmR1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuXHQgIHZhciBtcyA9IHRoaXMubXMgKiBNYXRoLnBvdyh0aGlzLmZhY3RvciwgdGhpcy5hdHRlbXB0cysrKTtcblx0ICBpZiAodGhpcy5qaXR0ZXIpIHtcblx0ICAgIHZhciByYW5kID0gTWF0aC5yYW5kb20oKTtcblx0ICAgIHZhciBkZXZpYXRpb24gPSBNYXRoLmZsb29yKHJhbmQgKiB0aGlzLmppdHRlciAqIG1zKTtcblx0ICAgIG1zID0gKE1hdGguZmxvb3IocmFuZCAqIDEwKSAmIDEpID09IDAgPyBtcyAtIGRldmlhdGlvbiA6IG1zICsgZGV2aWF0aW9uO1xuXHQgIH1cblx0ICByZXR1cm4gTWF0aC5taW4obXMsIHRoaXMubWF4KSB8IDA7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRoZSBudW1iZXIgb2YgYXR0ZW1wdHMuXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuYXR0ZW1wdHMgPSAwO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXQgdGhlIG1pbmltdW0gZHVyYXRpb25cblx0ICpcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0QmFja29mZi5wcm90b3R5cGUuc2V0TWluID0gZnVuY3Rpb24gKG1pbikge1xuXHQgIHRoaXMubXMgPSBtaW47XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgbWF4aW11bSBkdXJhdGlvblxuXHQgKlxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRCYWNrb2ZmLnByb3RvdHlwZS5zZXRNYXggPSBmdW5jdGlvbiAobWF4KSB7XG5cdCAgdGhpcy5tYXggPSBtYXg7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgaml0dGVyXG5cdCAqXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdEJhY2tvZmYucHJvdG90eXBlLnNldEppdHRlciA9IGZ1bmN0aW9uIChqaXR0ZXIpIHtcblx0ICB0aGlzLmppdHRlciA9IGppdHRlcjtcblx0fTtcblxuXHR2YXIgYmFja28yJDEgPSAvKiNfX1BVUkVfXyovT2JqZWN0LmZyZWV6ZSh7XG5cdFx0ZGVmYXVsdDogYmFja28yLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogYmFja28yXG5cdH0pO1xuXG5cdHZhciBlaW8gPSAoIGxpYiQxICYmIGxpYiApIHx8IGxpYiQxO1xuXG5cdHZhciBTb2NrZXQkMSA9ICggc29ja2V0JDMgJiYgc29ja2V0JDIgKSB8fCBzb2NrZXQkMztcblxuXHR2YXIgQmFja29mZiQxID0gKCBiYWNrbzIkMSAmJiBiYWNrbzIgKSB8fCBiYWNrbzIkMTtcblxuXHQvKipcblx0ICogTW9kdWxlIGRlcGVuZGVuY2llcy5cblx0ICovXG5cblx0dmFyIGRlYnVnJDcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQ6bWFuYWdlcicpO1xuXG5cdC8qKlxuXHQgKiBJRTYrIGhhc093blByb3BlcnR5XG5cdCAqL1xuXG5cdHZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cdC8qKlxuXHQgKiBNb2R1bGUgZXhwb3J0c1xuXHQgKi9cblxuXHR2YXIgbWFuYWdlciA9IE1hbmFnZXI7XG5cblx0LyoqXG5cdCAqIGBNYW5hZ2VyYCBjb25zdHJ1Y3Rvci5cblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IGVuZ2luZSBpbnN0YW5jZSBvciBlbmdpbmUgdXJpL29wdHNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0ZnVuY3Rpb24gTWFuYWdlcih1cmksIG9wdHMpIHtcblx0ICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTWFuYWdlcikpIHJldHVybiBuZXcgTWFuYWdlcih1cmksIG9wdHMpO1xuXHQgIGlmICh1cmkgJiYgJ29iamVjdCcgPT09ICh0eXBlb2YgdXJpID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih1cmkpKSkge1xuXHQgICAgb3B0cyA9IHVyaTtcblx0ICAgIHVyaSA9IHVuZGVmaW5lZDtcblx0ICB9XG5cdCAgb3B0cyA9IG9wdHMgfHwge307XG5cblx0ICBvcHRzLnBhdGggPSBvcHRzLnBhdGggfHwgJy9zb2NrZXQuaW8nO1xuXHQgIHRoaXMubnNwcyA9IHt9O1xuXHQgIHRoaXMuc3VicyA9IFtdO1xuXHQgIHRoaXMub3B0cyA9IG9wdHM7XG5cdCAgdGhpcy5yZWNvbm5lY3Rpb24ob3B0cy5yZWNvbm5lY3Rpb24gIT09IGZhbHNlKTtcblx0ICB0aGlzLnJlY29ubmVjdGlvbkF0dGVtcHRzKG9wdHMucmVjb25uZWN0aW9uQXR0ZW1wdHMgfHwgSW5maW5pdHkpO1xuXHQgIHRoaXMucmVjb25uZWN0aW9uRGVsYXkob3B0cy5yZWNvbm5lY3Rpb25EZWxheSB8fCAxMDAwKTtcblx0ICB0aGlzLnJlY29ubmVjdGlvbkRlbGF5TWF4KG9wdHMucmVjb25uZWN0aW9uRGVsYXlNYXggfHwgNTAwMCk7XG5cdCAgdGhpcy5yYW5kb21pemF0aW9uRmFjdG9yKG9wdHMucmFuZG9taXphdGlvbkZhY3RvciB8fCAwLjUpO1xuXHQgIHRoaXMuYmFja29mZiA9IG5ldyBCYWNrb2ZmJDEoe1xuXHQgICAgbWluOiB0aGlzLnJlY29ubmVjdGlvbkRlbGF5KCksXG5cdCAgICBtYXg6IHRoaXMucmVjb25uZWN0aW9uRGVsYXlNYXgoKSxcblx0ICAgIGppdHRlcjogdGhpcy5yYW5kb21pemF0aW9uRmFjdG9yKClcblx0ICB9KTtcblx0ICB0aGlzLnRpbWVvdXQobnVsbCA9PSBvcHRzLnRpbWVvdXQgPyAyMDAwMCA6IG9wdHMudGltZW91dCk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy51cmkgPSB1cmk7XG5cdCAgdGhpcy5jb25uZWN0aW5nID0gW107XG5cdCAgdGhpcy5sYXN0UGluZyA9IG51bGw7XG5cdCAgdGhpcy5lbmNvZGluZyA9IGZhbHNlO1xuXHQgIHRoaXMucGFja2V0QnVmZmVyID0gW107XG5cdCAgdmFyIF9wYXJzZXIgPSBvcHRzLnBhcnNlciB8fCBwYXJzZXIkMjtcblx0ICB0aGlzLmVuY29kZXIgPSBuZXcgX3BhcnNlci5FbmNvZGVyKCk7XG5cdCAgdGhpcy5kZWNvZGVyID0gbmV3IF9wYXJzZXIuRGVjb2RlcigpO1xuXHQgIHRoaXMuYXV0b0Nvbm5lY3QgPSBvcHRzLmF1dG9Db25uZWN0ICE9PSBmYWxzZTtcblx0ICBpZiAodGhpcy5hdXRvQ29ubmVjdCkgdGhpcy5vcGVuKCk7XG5cdH1cblxuXHQvKipcblx0ICogUHJvcGFnYXRlIGdpdmVuIGV2ZW50IHRvIHNvY2tldHMgYW5kIGVtaXQgb24gYHRoaXNgXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5lbWl0QWxsID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuZW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHQgIGZvciAodmFyIG5zcCBpbiB0aGlzLm5zcHMpIHtcblx0ICAgIGlmIChoYXMuY2FsbCh0aGlzLm5zcHMsIG5zcCkpIHtcblx0ICAgICAgdGhpcy5uc3BzW25zcF0uZW1pdC5hcHBseSh0aGlzLm5zcHNbbnNwXSwgYXJndW1lbnRzKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIFVwZGF0ZSBgc29ja2V0LmlkYCBvZiBhbGwgc29ja2V0c1xuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUudXBkYXRlU29ja2V0SWRzID0gZnVuY3Rpb24gKCkge1xuXHQgIGZvciAodmFyIG5zcCBpbiB0aGlzLm5zcHMpIHtcblx0ICAgIGlmIChoYXMuY2FsbCh0aGlzLm5zcHMsIG5zcCkpIHtcblx0ICAgICAgdGhpcy5uc3BzW25zcF0uaWQgPSB0aGlzLmdlbmVyYXRlSWQobnNwKTtcblx0ICAgIH1cblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIGdlbmVyYXRlIGBzb2NrZXQuaWRgIGZvciB0aGUgZ2l2ZW4gYG5zcGBcblx0ICpcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5zcFxuXHQgKiBAcmV0dXJuIHtTdHJpbmd9XG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5nZW5lcmF0ZUlkID0gZnVuY3Rpb24gKG5zcCkge1xuXHQgIHJldHVybiAobnNwID09PSAnLycgPyAnJyA6IG5zcCArICcjJykgKyB0aGlzLmVuZ2luZS5pZDtcblx0fTtcblxuXHQvKipcblx0ICogTWl4IGluIGBFbWl0dGVyYC5cblx0ICovXG5cblx0RW1pdHRlcihNYW5hZ2VyLnByb3RvdHlwZSk7XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGByZWNvbm5lY3Rpb25gIGNvbmZpZy5cblx0ICpcblx0ICogQHBhcmFtIHtCb29sZWFufSB0cnVlL2ZhbHNlIGlmIGl0IHNob3VsZCBhdXRvbWF0aWNhbGx5IHJlY29ubmVjdFxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbiA9IGZ1bmN0aW9uICh2KSB7XG5cdCAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uO1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbiA9ICEhdjtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgcmVjb25uZWN0aW9uIGF0dGVtcHRzIGNvbmZpZy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG1heCByZWNvbm5lY3Rpb24gYXR0ZW1wdHMgYmVmb3JlIGdpdmluZyB1cFxuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmIG9yIHZhbHVlXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnJlY29ubmVjdGlvbkF0dGVtcHRzID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cztcblx0ICB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cyA9IHY7XG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGRlbGF5IGJldHdlZW4gcmVjb25uZWN0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uRGVsYXkgPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5O1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5ID0gdjtcblx0ICB0aGlzLmJhY2tvZmYgJiYgdGhpcy5iYWNrb2ZmLnNldE1pbih2KTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5yYW5kb21pemF0aW9uRmFjdG9yID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl9yYW5kb21pemF0aW9uRmFjdG9yO1xuXHQgIHRoaXMuX3JhbmRvbWl6YXRpb25GYWN0b3IgPSB2O1xuXHQgIHRoaXMuYmFja29mZiAmJiB0aGlzLmJhY2tvZmYuc2V0Sml0dGVyKHYpO1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBtYXhpbXVtIGRlbGF5IGJldHdlZW4gcmVjb25uZWN0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRlbGF5XG5cdCAqIEByZXR1cm4ge01hbmFnZXJ9IHNlbGYgb3IgdmFsdWVcblx0ICogQGFwaSBwdWJsaWNcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0aW9uRGVsYXlNYXggPSBmdW5jdGlvbiAodikge1xuXHQgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4O1xuXHQgIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4ID0gdjtcblx0ICB0aGlzLmJhY2tvZmYgJiYgdGhpcy5iYWNrb2ZmLnNldE1heCh2KTtcblx0ICByZXR1cm4gdGhpcztcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY29ubmVjdGlvbiB0aW1lb3V0LiBgZmFsc2VgIHRvIGRpc2FibGVcblx0ICpcblx0ICogQHJldHVybiB7TWFuYWdlcn0gc2VsZiBvciB2YWx1ZVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS50aW1lb3V0ID0gZnVuY3Rpb24gKHYpIHtcblx0ICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiB0aGlzLl90aW1lb3V0O1xuXHQgIHRoaXMuX3RpbWVvdXQgPSB2O1xuXHQgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgdHJ5aW5nIHRvIHJlY29ubmVjdCBpZiByZWNvbm5lY3Rpb24gaXMgZW5hYmxlZCBhbmQgd2UgaGF2ZSBub3Rcblx0ICogc3RhcnRlZCByZWNvbm5lY3RpbmcgeWV0XG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5tYXliZVJlY29ubmVjdE9uT3BlbiA9IGZ1bmN0aW9uICgpIHtcblx0ICAvLyBPbmx5IHRyeSB0byByZWNvbm5lY3QgaWYgaXQncyB0aGUgZmlyc3QgdGltZSB3ZSdyZSBjb25uZWN0aW5nXG5cdCAgaWYgKCF0aGlzLnJlY29ubmVjdGluZyAmJiB0aGlzLl9yZWNvbm5lY3Rpb24gJiYgdGhpcy5iYWNrb2ZmLmF0dGVtcHRzID09PSAwKSB7XG5cdCAgICAvLyBrZWVwcyByZWNvbm5lY3Rpb24gZnJvbSBmaXJpbmcgdHdpY2UgZm9yIHRoZSBzYW1lIHJlY29ubmVjdGlvbiBsb29wXG5cdCAgICB0aGlzLnJlY29ubmVjdCgpO1xuXHQgIH1cblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY3VycmVudCB0cmFuc3BvcnQgYHNvY2tldGAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbmFsLCBjYWxsYmFja1xuXHQgKiBAcmV0dXJuIHtNYW5hZ2VyfSBzZWxmXG5cdCAqIEBhcGkgcHVibGljXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9wZW4gPSBNYW5hZ2VyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24gKGZuLCBvcHRzKSB7XG5cdCAgZGVidWckNygncmVhZHlTdGF0ZSAlcycsIHRoaXMucmVhZHlTdGF0ZSk7XG5cdCAgaWYgKH50aGlzLnJlYWR5U3RhdGUuaW5kZXhPZignb3BlbicpKSByZXR1cm4gdGhpcztcblxuXHQgIGRlYnVnJDcoJ29wZW5pbmcgJXMnLCB0aGlzLnVyaSk7XG5cdCAgdGhpcy5lbmdpbmUgPSBlaW8odGhpcy51cmksIHRoaXMub3B0cyk7XG5cdCAgdmFyIHNvY2tldCA9IHRoaXMuZW5naW5lO1xuXHQgIHZhciBzZWxmID0gdGhpcztcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3BlbmluZyc7XG5cdCAgdGhpcy5za2lwUmVjb25uZWN0ID0gZmFsc2U7XG5cblx0ICAvLyBlbWl0IGBvcGVuYFxuXHQgIHZhciBvcGVuU3ViID0gb24kMihzb2NrZXQsICdvcGVuJywgZnVuY3Rpb24gKCkge1xuXHQgICAgc2VsZi5vbm9wZW4oKTtcblx0ICAgIGZuICYmIGZuKCk7XG5cdCAgfSk7XG5cblx0ICAvLyBlbWl0IGBjb25uZWN0X2Vycm9yYFxuXHQgIHZhciBlcnJvclN1YiA9IG9uJDIoc29ja2V0LCAnZXJyb3InLCBmdW5jdGlvbiAoZGF0YSkge1xuXHQgICAgZGVidWckNygnY29ubmVjdF9lcnJvcicpO1xuXHQgICAgc2VsZi5jbGVhbnVwKCk7XG5cdCAgICBzZWxmLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICAgIHNlbGYuZW1pdEFsbCgnY29ubmVjdF9lcnJvcicsIGRhdGEpO1xuXHQgICAgaWYgKGZuKSB7XG5cdCAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gZXJyb3InKTtcblx0ICAgICAgZXJyLmRhdGEgPSBkYXRhO1xuXHQgICAgICBmbihlcnIpO1xuXHQgICAgfSBlbHNlIHtcblx0ICAgICAgLy8gT25seSBkbyB0aGlzIGlmIHRoZXJlIGlzIG5vIGZuIHRvIGhhbmRsZSB0aGUgZXJyb3Jcblx0ICAgICAgc2VsZi5tYXliZVJlY29ubmVjdE9uT3BlbigpO1xuXHQgICAgfVxuXHQgIH0pO1xuXG5cdCAgLy8gZW1pdCBgY29ubmVjdF90aW1lb3V0YFxuXHQgIGlmIChmYWxzZSAhPT0gdGhpcy5fdGltZW91dCkge1xuXHQgICAgdmFyIHRpbWVvdXQgPSB0aGlzLl90aW1lb3V0O1xuXHQgICAgZGVidWckNygnY29ubmVjdCBhdHRlbXB0IHdpbGwgdGltZW91dCBhZnRlciAlZCcsIHRpbWVvdXQpO1xuXG5cdCAgICAvLyBzZXQgdGltZXJcblx0ICAgIHZhciB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHQgICAgICBkZWJ1ZyQ3KCdjb25uZWN0IGF0dGVtcHQgdGltZWQgb3V0IGFmdGVyICVkJywgdGltZW91dCk7XG5cdCAgICAgIG9wZW5TdWIuZGVzdHJveSgpO1xuXHQgICAgICBzb2NrZXQuY2xvc2UoKTtcblx0ICAgICAgc29ja2V0LmVtaXQoJ2Vycm9yJywgJ3RpbWVvdXQnKTtcblx0ICAgICAgc2VsZi5lbWl0QWxsKCdjb25uZWN0X3RpbWVvdXQnLCB0aW1lb3V0KTtcblx0ICAgIH0sIHRpbWVvdXQpO1xuXG5cdCAgICB0aGlzLnN1YnMucHVzaCh7XG5cdCAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdCAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcblx0ICAgICAgfVxuXHQgICAgfSk7XG5cdCAgfVxuXG5cdCAgdGhpcy5zdWJzLnB1c2gob3BlblN1Yik7XG5cdCAgdGhpcy5zdWJzLnB1c2goZXJyb3JTdWIpO1xuXG5cdCAgcmV0dXJuIHRoaXM7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBvcGVuLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25vcGVuID0gZnVuY3Rpb24gKCkge1xuXHQgIGRlYnVnJDcoJ29wZW4nKTtcblxuXHQgIC8vIGNsZWFyIG9sZCBzdWJzXG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cblx0ICAvLyBtYXJrIGFzIG9wZW5cblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnb3Blbic7XG5cdCAgdGhpcy5lbWl0KCdvcGVuJyk7XG5cblx0ICAvLyBhZGQgbmV3IHN1YnNcblx0ICB2YXIgc29ja2V0ID0gdGhpcy5lbmdpbmU7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdkYXRhJywgYmluZCh0aGlzLCAnb25kYXRhJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHNvY2tldCwgJ3BpbmcnLCBiaW5kKHRoaXMsICdvbnBpbmcnKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAncG9uZycsIGJpbmQodGhpcywgJ29ucG9uZycpKSk7XG5cdCAgdGhpcy5zdWJzLnB1c2gob24kMihzb2NrZXQsICdlcnJvcicsIGJpbmQodGhpcywgJ29uZXJyb3InKSkpO1xuXHQgIHRoaXMuc3Vicy5wdXNoKG9uJDIoc29ja2V0LCAnY2xvc2UnLCBiaW5kKHRoaXMsICdvbmNsb3NlJykpKTtcblx0ICB0aGlzLnN1YnMucHVzaChvbiQyKHRoaXMuZGVjb2RlciwgJ2RlY29kZWQnLCBiaW5kKHRoaXMsICdvbmRlY29kZWQnKSkpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBhIHBpbmcuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbnBpbmcgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdGhpcy5sYXN0UGluZyA9IG5ldyBEYXRlKCk7XG5cdCAgdGhpcy5lbWl0QWxsKCdwaW5nJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGEgcGFja2V0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25wb25nID0gZnVuY3Rpb24gKCkge1xuXHQgIHRoaXMuZW1pdEFsbCgncG9uZycsIG5ldyBEYXRlKCkgLSB0aGlzLmxhc3RQaW5nKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdpdGggZGF0YS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uZGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG5cdCAgdGhpcy5kZWNvZGVyLmFkZChkYXRhKTtcblx0fTtcblxuXHQvKipcblx0ICogQ2FsbGVkIHdoZW4gcGFyc2VyIGZ1bGx5IGRlY29kZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmRlY29kZWQgPSBmdW5jdGlvbiAocGFja2V0KSB7XG5cdCAgdGhpcy5lbWl0KCdwYWNrZXQnLCBwYWNrZXQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBzb2NrZXQgZXJyb3IuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5vbmVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXHQgIGRlYnVnJDcoJ2Vycm9yJywgZXJyKTtcblx0ICB0aGlzLmVtaXRBbGwoJ2Vycm9yJywgZXJyKTtcblx0fTtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBzb2NrZXQgZm9yIHRoZSBnaXZlbiBgbnNwYC5cblx0ICpcblx0ICogQHJldHVybiB7U29ja2V0fVxuXHQgKiBAYXBpIHB1YmxpY1xuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXQgPSBmdW5jdGlvbiAobnNwLCBvcHRzKSB7XG5cdCAgdmFyIHNvY2tldCA9IHRoaXMubnNwc1tuc3BdO1xuXHQgIGlmICghc29ja2V0KSB7XG5cdCAgICBzb2NrZXQgPSBuZXcgU29ja2V0JDEodGhpcywgbnNwLCBvcHRzKTtcblx0ICAgIHRoaXMubnNwc1tuc3BdID0gc29ja2V0O1xuXHQgICAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgICAgc29ja2V0Lm9uKCdjb25uZWN0aW5nJywgb25Db25uZWN0aW5nKTtcblx0ICAgIHNvY2tldC5vbignY29ubmVjdCcsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgc29ja2V0LmlkID0gc2VsZi5nZW5lcmF0ZUlkKG5zcCk7XG5cdCAgICB9KTtcblxuXHQgICAgaWYgKHRoaXMuYXV0b0Nvbm5lY3QpIHtcblx0ICAgICAgLy8gbWFudWFsbHkgY2FsbCBoZXJlIHNpbmNlIGNvbm5lY3RpbmcgZXZlbnQgaXMgZmlyZWQgYmVmb3JlIGxpc3RlbmluZ1xuXHQgICAgICBvbkNvbm5lY3RpbmcoKTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICBmdW5jdGlvbiBvbkNvbm5lY3RpbmcoKSB7XG5cdCAgICBpZiAoIX5pbmRleChzZWxmLmNvbm5lY3RpbmcsIHNvY2tldCkpIHtcblx0ICAgICAgc2VsZi5jb25uZWN0aW5nLnB1c2goc29ja2V0KTtcblx0ICAgIH1cblx0ICB9XG5cblx0ICByZXR1cm4gc29ja2V0O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgdXBvbiBhIHNvY2tldCBjbG9zZS5cblx0ICpcblx0ICogQHBhcmFtIHtTb2NrZXR9IHNvY2tldFxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKHNvY2tldCkge1xuXHQgIHZhciBpbmRleCQkMSA9IGluZGV4KHRoaXMuY29ubmVjdGluZywgc29ja2V0KTtcblx0ICBpZiAofmluZGV4JCQxKSB0aGlzLmNvbm5lY3Rpbmcuc3BsaWNlKGluZGV4JCQxLCAxKTtcblx0ICBpZiAodGhpcy5jb25uZWN0aW5nLmxlbmd0aCkgcmV0dXJuO1xuXG5cdCAgdGhpcy5jbG9zZSgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBXcml0ZXMgYSBwYWNrZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLnBhY2tldCA9IGZ1bmN0aW9uIChwYWNrZXQpIHtcblx0ICBkZWJ1ZyQ3KCd3cml0aW5nIHBhY2tldCAlaicsIHBhY2tldCk7XG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXHQgIGlmIChwYWNrZXQucXVlcnkgJiYgcGFja2V0LnR5cGUgPT09IDApIHBhY2tldC5uc3AgKz0gJz8nICsgcGFja2V0LnF1ZXJ5O1xuXG5cdCAgaWYgKCFzZWxmLmVuY29kaW5nKSB7XG5cdCAgICAvLyBlbmNvZGUsIHRoZW4gd3JpdGUgdG8gZW5naW5lIHdpdGggcmVzdWx0XG5cdCAgICBzZWxmLmVuY29kaW5nID0gdHJ1ZTtcblx0ICAgIHRoaXMuZW5jb2Rlci5lbmNvZGUocGFja2V0LCBmdW5jdGlvbiAoZW5jb2RlZFBhY2tldHMpIHtcblx0ICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbmNvZGVkUGFja2V0cy5sZW5ndGg7IGkrKykge1xuXHQgICAgICAgIHNlbGYuZW5naW5lLndyaXRlKGVuY29kZWRQYWNrZXRzW2ldLCBwYWNrZXQub3B0aW9ucyk7XG5cdCAgICAgIH1cblx0ICAgICAgc2VsZi5lbmNvZGluZyA9IGZhbHNlO1xuXHQgICAgICBzZWxmLnByb2Nlc3NQYWNrZXRRdWV1ZSgpO1xuXHQgICAgfSk7XG5cdCAgfSBlbHNlIHtcblx0ICAgIC8vIGFkZCBwYWNrZXQgdG8gdGhlIHF1ZXVlXG5cdCAgICBzZWxmLnBhY2tldEJ1ZmZlci5wdXNoKHBhY2tldCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBJZiBwYWNrZXQgYnVmZmVyIGlzIG5vbi1lbXB0eSwgYmVnaW5zIGVuY29kaW5nIHRoZVxuXHQgKiBuZXh0IHBhY2tldCBpbiBsaW5lLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucHJvY2Vzc1BhY2tldFF1ZXVlID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnBhY2tldEJ1ZmZlci5sZW5ndGggPiAwICYmICF0aGlzLmVuY29kaW5nKSB7XG5cdCAgICB2YXIgcGFjayA9IHRoaXMucGFja2V0QnVmZmVyLnNoaWZ0KCk7XG5cdCAgICB0aGlzLnBhY2tldChwYWNrKTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENsZWFuIHVwIHRyYW5zcG9ydCBzdWJzY3JpcHRpb25zIGFuZCBwYWNrZXQgYnVmZmVyLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUuY2xlYW51cCA9IGZ1bmN0aW9uICgpIHtcblx0ICBkZWJ1ZyQ3KCdjbGVhbnVwJyk7XG5cblx0ICB2YXIgc3Vic0xlbmd0aCA9IHRoaXMuc3Vicy5sZW5ndGg7XG5cdCAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzTGVuZ3RoOyBpKyspIHtcblx0ICAgIHZhciBzdWIgPSB0aGlzLnN1YnMuc2hpZnQoKTtcblx0ICAgIHN1Yi5kZXN0cm95KCk7XG5cdCAgfVxuXG5cdCAgdGhpcy5wYWNrZXRCdWZmZXIgPSBbXTtcblx0ICB0aGlzLmVuY29kaW5nID0gZmFsc2U7XG5cdCAgdGhpcy5sYXN0UGluZyA9IG51bGw7XG5cblx0ICB0aGlzLmRlY29kZXIuZGVzdHJveSgpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDbG9zZSB0aGUgY3VycmVudCBzb2NrZXQuXG5cdCAqXG5cdCAqIEBhcGkgcHJpdmF0ZVxuXHQgKi9cblxuXHRNYW5hZ2VyLnByb3RvdHlwZS5jbG9zZSA9IE1hbmFnZXIucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgZGVidWckNygnZGlzY29ubmVjdCcpO1xuXHQgIHRoaXMuc2tpcFJlY29ubmVjdCA9IHRydWU7XG5cdCAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICBpZiAoJ29wZW5pbmcnID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcblx0ICAgIC8vIGBvbmNsb3NlYCB3aWxsIG5vdCBmaXJlIGJlY2F1c2Vcblx0ICAgIC8vIGFuIG9wZW4gZXZlbnQgbmV2ZXIgaGFwcGVuZWRcblx0ICAgIHRoaXMuY2xlYW51cCgpO1xuXHQgIH1cblx0ICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICB0aGlzLnJlYWR5U3RhdGUgPSAnY2xvc2VkJztcblx0ICBpZiAodGhpcy5lbmdpbmUpIHRoaXMuZW5naW5lLmNsb3NlKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIGVuZ2luZSBjbG9zZS5cblx0ICpcblx0ICogQGFwaSBwcml2YXRlXG5cdCAqL1xuXG5cdE1hbmFnZXIucHJvdG90eXBlLm9uY2xvc2UgPSBmdW5jdGlvbiAocmVhc29uKSB7XG5cdCAgZGVidWckNygnb25jbG9zZScpO1xuXG5cdCAgdGhpcy5jbGVhbnVwKCk7XG5cdCAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgdGhpcy5yZWFkeVN0YXRlID0gJ2Nsb3NlZCc7XG5cdCAgdGhpcy5lbWl0KCdjbG9zZScsIHJlYXNvbik7XG5cblx0ICBpZiAodGhpcy5fcmVjb25uZWN0aW9uICYmICF0aGlzLnNraXBSZWNvbm5lY3QpIHtcblx0ICAgIHRoaXMucmVjb25uZWN0KCk7XG5cdCAgfVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBBdHRlbXB0IGEgcmVjb25uZWN0aW9uLlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUucmVjb25uZWN0ID0gZnVuY3Rpb24gKCkge1xuXHQgIGlmICh0aGlzLnJlY29ubmVjdGluZyB8fCB0aGlzLnNraXBSZWNvbm5lY3QpIHJldHVybiB0aGlzO1xuXG5cdCAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cdCAgaWYgKHRoaXMuYmFja29mZi5hdHRlbXB0cyA+PSB0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cykge1xuXHQgICAgZGVidWckNygncmVjb25uZWN0IGZhaWxlZCcpO1xuXHQgICAgdGhpcy5iYWNrb2ZmLnJlc2V0KCk7XG5cdCAgICB0aGlzLmVtaXRBbGwoJ3JlY29ubmVjdF9mYWlsZWQnKTtcblx0ICAgIHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2U7XG5cdCAgfSBlbHNlIHtcblx0ICAgIHZhciBkZWxheSA9IHRoaXMuYmFja29mZi5kdXJhdGlvbigpO1xuXHQgICAgZGVidWckNygnd2lsbCB3YWl0ICVkbXMgYmVmb3JlIHJlY29ubmVjdCBhdHRlbXB0JywgZGVsYXkpO1xuXG5cdCAgICB0aGlzLnJlY29ubmVjdGluZyA9IHRydWU7XG5cdCAgICB2YXIgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0ICAgICAgaWYgKHNlbGYuc2tpcFJlY29ubmVjdCkgcmV0dXJuO1xuXG5cdCAgICAgIGRlYnVnJDcoJ2F0dGVtcHRpbmcgcmVjb25uZWN0Jyk7XG5cdCAgICAgIHNlbGYuZW1pdEFsbCgncmVjb25uZWN0X2F0dGVtcHQnLCBzZWxmLmJhY2tvZmYuYXR0ZW1wdHMpO1xuXHQgICAgICBzZWxmLmVtaXRBbGwoJ3JlY29ubmVjdGluZycsIHNlbGYuYmFja29mZi5hdHRlbXB0cyk7XG5cblx0ICAgICAgLy8gY2hlY2sgYWdhaW4gZm9yIHRoZSBjYXNlIHNvY2tldCBjbG9zZWQgaW4gYWJvdmUgZXZlbnRzXG5cdCAgICAgIGlmIChzZWxmLnNraXBSZWNvbm5lY3QpIHJldHVybjtcblxuXHQgICAgICBzZWxmLm9wZW4oZnVuY3Rpb24gKGVycikge1xuXHQgICAgICAgIGlmIChlcnIpIHtcblx0ICAgICAgICAgIGRlYnVnJDcoJ3JlY29ubmVjdCBhdHRlbXB0IGVycm9yJyk7XG5cdCAgICAgICAgICBzZWxmLnJlY29ubmVjdGluZyA9IGZhbHNlO1xuXHQgICAgICAgICAgc2VsZi5yZWNvbm5lY3QoKTtcblx0ICAgICAgICAgIHNlbGYuZW1pdEFsbCgncmVjb25uZWN0X2Vycm9yJywgZXJyLmRhdGEpO1xuXHQgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICBkZWJ1ZyQ3KCdyZWNvbm5lY3Qgc3VjY2VzcycpO1xuXHQgICAgICAgICAgc2VsZi5vbnJlY29ubmVjdCgpO1xuXHQgICAgICAgIH1cblx0ICAgICAgfSk7XG5cdCAgICB9LCBkZWxheSk7XG5cblx0ICAgIHRoaXMuc3Vicy5wdXNoKHtcblx0ICAgICAgZGVzdHJveTogZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0ICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuXHQgICAgICB9XG5cdCAgICB9KTtcblx0ICB9XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGxlZCB1cG9uIHN1Y2Nlc3NmdWwgcmVjb25uZWN0LlxuXHQgKlxuXHQgKiBAYXBpIHByaXZhdGVcblx0ICovXG5cblx0TWFuYWdlci5wcm90b3R5cGUub25yZWNvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG5cdCAgdmFyIGF0dGVtcHQgPSB0aGlzLmJhY2tvZmYuYXR0ZW1wdHM7XG5cdCAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcblx0ICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcblx0ICB0aGlzLnVwZGF0ZVNvY2tldElkcygpO1xuXHQgIHRoaXMuZW1pdEFsbCgncmVjb25uZWN0JywgYXR0ZW1wdCk7XG5cdH07XG5cblx0dmFyIG1hbmFnZXIkMSA9IC8qI19fUFVSRV9fKi9PYmplY3QuZnJlZXplKHtcblx0XHRkZWZhdWx0OiBtYW5hZ2VyLFxuXHRcdF9fbW9kdWxlRXhwb3J0czogbWFuYWdlclxuXHR9KTtcblxuXHR2YXIgdXJsJDIgPSAoIHVybCQxICYmIHVybF8xICkgfHwgdXJsJDE7XG5cblx0dmFyIE1hbmFnZXIkMSA9ICggbWFuYWdlciQxICYmIG1hbmFnZXIgKSB8fCBtYW5hZ2VyJDE7XG5cblx0dmFyIGxpYiQyID0gY3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24gKG1vZHVsZSwgZXhwb3J0cykge1xuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG5cdCAgICovXG5cblx0ICB2YXIgZGVidWcgPSByZXF1aXJlJCQwJDIoJ3NvY2tldC5pby1jbGllbnQnKTtcblxuXHQgIC8qKlxuXHQgICAqIE1vZHVsZSBleHBvcnRzLlxuXHQgICAqL1xuXG5cdCAgbW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gbG9va3VwO1xuXG5cdCAgLyoqXG5cdCAgICogTWFuYWdlcnMgY2FjaGUuXG5cdCAgICovXG5cblx0ICB2YXIgY2FjaGUgPSBleHBvcnRzLm1hbmFnZXJzID0ge307XG5cblx0ICAvKipcblx0ICAgKiBMb29rcyB1cCBhbiBleGlzdGluZyBgTWFuYWdlcmAgZm9yIG11bHRpcGxleGluZy5cblx0ICAgKiBJZiB0aGUgdXNlciBzdW1tb25zOlxuXHQgICAqXG5cdCAgICogICBgaW8oJ2h0dHA6Ly9sb2NhbGhvc3QvYScpO2Bcblx0ICAgKiAgIGBpbygnaHR0cDovL2xvY2FsaG9zdC9iJyk7YFxuXHQgICAqXG5cdCAgICogV2UgcmV1c2UgdGhlIGV4aXN0aW5nIGluc3RhbmNlIGJhc2VkIG9uIHNhbWUgc2NoZW1lL3BvcnQvaG9zdCxcblx0ICAgKiBhbmQgd2UgaW5pdGlhbGl6ZSBzb2NrZXRzIGZvciBlYWNoIG5hbWVzcGFjZS5cblx0ICAgKlxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBmdW5jdGlvbiBsb29rdXAodXJpLCBvcHRzKSB7XG5cdCAgICBpZiAoKHR5cGVvZiB1cmkgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHVyaSkpID09PSAnb2JqZWN0Jykge1xuXHQgICAgICBvcHRzID0gdXJpO1xuXHQgICAgICB1cmkgPSB1bmRlZmluZWQ7XG5cdCAgICB9XG5cblx0ICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuXG5cdCAgICB2YXIgcGFyc2VkID0gdXJsJDIodXJpKTtcblx0ICAgIHZhciBzb3VyY2UgPSBwYXJzZWQuc291cmNlO1xuXHQgICAgdmFyIGlkID0gcGFyc2VkLmlkO1xuXHQgICAgdmFyIHBhdGggPSBwYXJzZWQucGF0aDtcblx0ICAgIHZhciBzYW1lTmFtZXNwYWNlID0gY2FjaGVbaWRdICYmIHBhdGggaW4gY2FjaGVbaWRdLm5zcHM7XG5cdCAgICB2YXIgbmV3Q29ubmVjdGlvbiA9IG9wdHMuZm9yY2VOZXcgfHwgb3B0c1snZm9yY2UgbmV3IGNvbm5lY3Rpb24nXSB8fCBmYWxzZSA9PT0gb3B0cy5tdWx0aXBsZXggfHwgc2FtZU5hbWVzcGFjZTtcblxuXHQgICAgdmFyIGlvO1xuXG5cdCAgICBpZiAobmV3Q29ubmVjdGlvbikge1xuXHQgICAgICBkZWJ1ZygnaWdub3Jpbmcgc29ja2V0IGNhY2hlIGZvciAlcycsIHNvdXJjZSk7XG5cdCAgICAgIGlvID0gTWFuYWdlciQxKHNvdXJjZSwgb3B0cyk7XG5cdCAgICB9IGVsc2Uge1xuXHQgICAgICBpZiAoIWNhY2hlW2lkXSkge1xuXHQgICAgICAgIGRlYnVnKCduZXcgaW8gaW5zdGFuY2UgZm9yICVzJywgc291cmNlKTtcblx0ICAgICAgICBjYWNoZVtpZF0gPSBNYW5hZ2VyJDEoc291cmNlLCBvcHRzKTtcblx0ICAgICAgfVxuXHQgICAgICBpbyA9IGNhY2hlW2lkXTtcblx0ICAgIH1cblx0ICAgIGlmIChwYXJzZWQucXVlcnkgJiYgIW9wdHMucXVlcnkpIHtcblx0ICAgICAgb3B0cy5xdWVyeSA9IHBhcnNlZC5xdWVyeTtcblx0ICAgIH1cblx0ICAgIHJldHVybiBpby5zb2NrZXQocGFyc2VkLnBhdGgsIG9wdHMpO1xuXHQgIH1cblxuXHQgIC8qKlxuXHQgICAqIFByb3RvY29sIHZlcnNpb24uXG5cdCAgICpcblx0ICAgKiBAYXBpIHB1YmxpY1xuXHQgICAqL1xuXG5cdCAgZXhwb3J0cy5wcm90b2NvbCA9IHBhcnNlciQyLnByb3RvY29sO1xuXG5cdCAgLyoqXG5cdCAgICogYGNvbm5lY3RgLlxuXHQgICAqXG5cdCAgICogQHBhcmFtIHtTdHJpbmd9IHVyaVxuXHQgICAqIEBhcGkgcHVibGljXG5cdCAgICovXG5cblx0ICBleHBvcnRzLmNvbm5lY3QgPSBsb29rdXA7XG5cblx0ICAvKipcblx0ICAgKiBFeHBvc2UgY29uc3RydWN0b3JzIGZvciBzdGFuZGFsb25lIGJ1aWxkLlxuXHQgICAqXG5cdCAgICogQGFwaSBwdWJsaWNcblx0ICAgKi9cblxuXHQgIGV4cG9ydHMuTWFuYWdlciA9IE1hbmFnZXIkMTtcblx0ICBleHBvcnRzLlNvY2tldCA9IFNvY2tldCQxO1xuXHR9KTtcblx0dmFyIGxpYl8xID0gbGliJDIubWFuYWdlcnM7XG5cdHZhciBsaWJfMiA9IGxpYiQyLnByb3RvY29sO1xuXHR2YXIgbGliXzMgPSBsaWIkMi5jb25uZWN0O1xuXHR2YXIgbGliXzQgPSBsaWIkMi5NYW5hZ2VyO1xuXHR2YXIgbGliXzUgPSBsaWIkMi5Tb2NrZXQ7XG5cblx0ZnVuY3Rpb24gZXh0ZW5kKFkpIHtcblx0ICAgIHZhciBDb25uZWN0b3IgPSBmdW5jdGlvbiAoX1kkQWJzdHJhY3RDb25uZWN0b3IpIHtcblx0ICAgICAgICBpbmhlcml0cyhDb25uZWN0b3IsIF9ZJEFic3RyYWN0Q29ubmVjdG9yKTtcblxuXHQgICAgICAgIGZ1bmN0aW9uIENvbm5lY3Rvcih5LCBvcHRpb25zKSB7XG5cdCAgICAgICAgICAgIGNsYXNzQ2FsbENoZWNrKHRoaXMsIENvbm5lY3Rvcik7XG5cblx0ICAgICAgICAgICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuXHQgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcHRpb25zIG11c3Qgbm90IGJlIHVuZGVmaW5lZCEnKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICBvcHRpb25zLnByZWZlclVudHJhbnNmb3JtZWQgPSB0cnVlO1xuXHQgICAgICAgICAgICBvcHRpb25zLmdlbmVyYXRlVXNlcklkID0gb3B0aW9ucy5nZW5lcmF0ZVVzZXJJZCB8fCBmYWxzZTtcblx0ICAgICAgICAgICAgaWYgKG9wdGlvbnMuaW5pdFN5bmMgIT09IGZhbHNlKSB7XG5cdCAgICAgICAgICAgICAgICBvcHRpb25zLmluaXRTeW5jID0gdHJ1ZTtcblx0ICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgIHZhciBfdGhpcyA9IHBvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgKENvbm5lY3Rvci5fX3Byb3RvX18gfHwgT2JqZWN0LmdldFByb3RvdHlwZU9mKENvbm5lY3RvcikpLmNhbGwodGhpcywgeSwgb3B0aW9ucykpO1xuXG5cdCAgICAgICAgICAgIF90aGlzLl9zZW50U3luYyA9IGZhbHNlO1xuXHQgICAgICAgICAgICBfdGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0ICAgICAgICAgICAgb3B0aW9ucy51cmwgPSBvcHRpb25zLnVybCB8fCAnaHR0cHM6Ly95anMuZGJpcy5yd3RoLWFhY2hlbi5kZTo1MDcyJztcblx0ICAgICAgICAgICAgdmFyIHNvY2tldCA9IG9wdGlvbnMuc29ja2V0IHx8IGxpYiQyKG9wdGlvbnMudXJsLCBvcHRpb25zLm9wdGlvbnMpO1xuXHQgICAgICAgICAgICBfdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG5cdCAgICAgICAgICAgIHZhciBzZWxmID0gX3RoaXM7XG5cblx0ICAgICAgICAgICAgLyoqKioqKioqKioqKioqKioqKiBzdGFydCBtaW5pbWFsIHdlYnJ0YyAqKioqKioqKioqKioqKioqKioqKioqL1xuXHQgICAgICAgICAgICB2YXIgc2lnbmFsaW5nX3NvY2tldCA9IHNvY2tldDtcblx0ICAgICAgICAgICAgdmFyIERFRkFVTFRfQ0hBTk5FTCA9ICdkaW5lc2gnO1xuXHQgICAgICAgICAgICB2YXIgSUNFX1NFUlZFUlMgPSBbeyB1cmxzOiBcInN0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDJcIiB9LCB7IHVybHM6IFwidHVybjp0cnkucmVmYWN0b3JlZC5haTozNDc4XCIsIHVzZXJuYW1lOiBcInRlc3Q5OVwiLCBjcmVkZW50aWFsOiBcInRlc3RcIiB9XTtcblx0ICAgICAgICAgICAgdmFyIGRjcyA9IHt9O1xuXHQgICAgICAgICAgICBfdGhpcy5kY3MgPSBkY3M7XG5cdCAgICAgICAgICAgIF90aGlzLnNkY3MgPSBkY3M7XG5cdCAgICAgICAgICAgIHZhciBwZWVycyA9IHt9O1xuXHQgICAgICAgICAgICB2YXIgcGVlcl9tZWRpYV9lbGVtZW50cyA9IHt9O1xuXHQgICAgICAgICAgICB2YXIgc29ja2V0cztcblx0ICAgICAgICAgICAgX3RoaXMuc29ja2V0cyA9IHNvY2tldHM7XG5cdCAgICAgICAgICAgIF90aGlzLmxvYWRfeW5vdGVib29rID0gb3B0aW9ucy5sb2FkX3lub3RlYm9vaztcblxuXHQgICAgICAgICAgICBmdW5jdGlvbiByZWNlaXZlRGF0YSh5d2VicnRjLCBwZWVyX2lkKSB7XG5cdCAgICAgICAgICAgICAgICB2YXIgYnVmLCBjb3VudDtcblx0ICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBvbm1lc3NhZ2UoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGV2ZW50LmRhdGEgPT09ICdzdHJpbmcnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHBhcnNlSW50KGV2ZW50LmRhdGEpKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgY291bnQgPSAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuZGF0YSk7XG5cdCAgICAgICAgICAgICAgICAgICAgYnVmLnNldChkYXRhLCBjb3VudCk7XG5cdCAgICAgICAgICAgICAgICAgICAgY291bnQgKz0gZGF0YS5ieXRlTGVuZ3RoO1xuXHQgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA9PT0gYnVmLmJ5dGVMZW5ndGgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlTWVzc2FnZShwZWVyX2lkLCBidWYpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgIH07XG5cdCAgICAgICAgICAgIH1cblxuXHQgICAgICAgICAgICBmdW5jdGlvbiBpbml0KHl3ZWJydGMpIHtcblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgam9pbl9jaGF0X2NoYW5uZWwoREVGQVVMVF9DSEFOTkVMLCB7ICd3aGF0ZXZlci15b3Utd2FudC1oZXJlJzogJ3N0dWZmJyB9KTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdzb2NrZXRzJywgZnVuY3Rpb24gKHNvY2tldHMpIHtcblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnNvY2tldHMgPSBzb2NrZXRzO1xuXHQgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMubG9hZF95bm90ZWJvb2soKTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgIC8qIFRlYXIgZG93biBhbGwgb2Ygb3VyIHBlZXIgY29ubmVjdGlvbnMgYW5kIHJlbW92ZSBhbGwgdGhlXG5cdCAgICAgICAgICAgICAgICAgICAgICogbWVkaWEgZGl2cyB3aGVuIHdlIGRpc2Nvbm5lY3QgKi9cblx0ICAgICAgICAgICAgICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcl9tZWRpYV9lbGVtZW50cykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzW3BlZXJfaWRdLnJlbW92ZSgpO1xuXHQgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICBmb3IgKHBlZXJfaWQgaW4gcGVlcnMpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0uY2xvc2UoKTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVycyA9IHt9O1xuXHQgICAgICAgICAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHMgPSB7fTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBmdW5jdGlvbiBqb2luX2NoYXRfY2hhbm5lbChjaGFubmVsLCB1c2VyZGF0YSkge1xuXHQgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgnam9pbicsIHsgXCJjaGFubmVsXCI6IGNoYW5uZWwsIFwidXNlcmRhdGFcIjogdXNlcmRhdGEgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy51c2VySUQgPSBzaWduYWxpbmdfc29ja2V0LmlkO1xuXHQgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdhZGRQZWVyJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cblx0ICAgICAgICAgICAgICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVycykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAvKiBUaGlzIGNvdWxkIGhhcHBlbiBpZiB0aGUgdXNlciBqb2lucyBtdWx0aXBsZSBjaGFubmVscyB3aGVyZSB0aGUgb3RoZXIgcGVlciBpcyBhbHNvIGluLiAqL1xuXHQgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXJfY29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbih7IFwiaWNlU2VydmVyc1wiOiBJQ0VfU0VSVkVSUyB9KTtcblx0ICAgICAgICAgICAgICAgICAgICBwZWVyc1twZWVyX2lkXSA9IHBlZXJfY29ubmVjdGlvbjtcblxuXHQgICAgICAgICAgICAgICAgICAgIHZhciBkYXRhQ2hhbm5lbCA9IHBlZXJfY29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgnZGF0YScpO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBzeW5jRGF0YUNoYW5uZWwgPSBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoJ3N5bmNfZGF0YScpO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgICAgICAgICAgc3luY0RhdGFDaGFubmVsLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy5kY3NbcGVlcl9pZF0gPSBkYXRhQ2hhbm5lbDtcblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnNkY3NbcGVlcl9pZF0gPSBzeW5jRGF0YUNoYW5uZWw7XG5cblx0ICAgICAgICAgICAgICAgICAgICB5d2VicnRjLnVzZXJKb2luZWQocGVlcl9pZCwgJ21hc3RlcicpO1xuXG5cdCAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gcmVjZWl2ZURhdGEoeXdlYnJ0YywgcGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgc3luY0RhdGFDaGFubmVsLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZWJ1ZmZlcihwZWVyX2lkLCBlLmRhdGEpO1xuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24ub25pY2VjYW5kaWRhdGUgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LmNhbmRpZGF0ZSkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheUlDRUNhbmRpZGF0ZScsIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncGVlcl9pZCc6IHBlZXJfaWQsXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2ljZV9jYW5kaWRhdGUnOiB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzZHBNTGluZUluZGV4JzogZXZlbnQuY2FuZGlkYXRlLnNkcE1MaW5lSW5kZXgsXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjYW5kaWRhdGUnOiBldmVudC5jYW5kaWRhdGUuY2FuZGlkYXRlXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9O1xuXG5cdCAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5zaG91bGRfY3JlYXRlX29mZmVyKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5jcmVhdGVPZmZlcihmdW5jdGlvbiAobG9jYWxfZGVzY3JpcHRpb24pIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheVNlc3Npb25EZXNjcmlwdGlvbicsIHsgJ3BlZXJfaWQnOiBwZWVyX2lkLCAnc2Vzc2lvbl9kZXNjcmlwdGlvbic6IGxvY2FsX2Rlc2NyaXB0aW9uIH0pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsZXJ0KFwiT2ZmZXIgc2V0TG9jYWxEZXNjcmlwdGlvbiBmYWlsZWQhXCIpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJFcnJvciBzZW5kaW5nIG9mZmVyOiBcIiwgZXJyb3IpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICB9KTtcblxuXHQgICAgICAgICAgICAgICAgLyoqIFxuXHQgICAgICAgICAgICAgICAgICogUGVlcnMgZXhjaGFuZ2Ugc2Vzc2lvbiBkZXNjcmlwdGlvbnMgd2hpY2ggY29udGFpbnMgaW5mb3JtYXRpb25cblx0ICAgICAgICAgICAgICAgICAqIGFib3V0IHRoZWlyIGF1ZGlvIC8gdmlkZW8gc2V0dGluZ3MgYW5kIHRoYXQgc29ydCBvZiBzdHVmZi4gRmlyc3Rcblx0ICAgICAgICAgICAgICAgICAqIHRoZSAnb2ZmZXJlcicgc2VuZHMgYSBkZXNjcmlwdGlvbiB0byB0aGUgJ2Fuc3dlcmVyJyAod2l0aCB0eXBlXG5cdCAgICAgICAgICAgICAgICAgKiBcIm9mZmVyXCIpLCB0aGVuIHRoZSBhbnN3ZXJlciBzZW5kcyBvbmUgYmFjayAod2l0aCB0eXBlIFwiYW5zd2VyXCIpLiAgXG5cdCAgICAgICAgICAgICAgICAgKi9cblx0ICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3Nlc3Npb25EZXNjcmlwdGlvbicsIGZ1bmN0aW9uIChjb25maWcpIHtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyID0gcGVlcnNbcGVlcl9pZF07XG5cblx0ICAgICAgICAgICAgICAgICAgICBwZWVyLm9uZGF0YWNoYW5uZWwgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGFDaGFubmVsID0gZXZlbnQuY2hhbm5lbDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhQ2hhbm5lbC5sYWJlbCA9PSAnc3luY19kYXRhJykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gcmVjZWl2ZURhdGEoeXdlYnJ0YywgcGVlcl9pZCk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhQ2hhbm5lbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZWJ1ZmZlcihwZWVyX2lkLCBlLmRhdGEpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgcmVtb3RlX2Rlc2NyaXB0aW9uID0gY29uZmlnLnNlc3Npb25fZGVzY3JpcHRpb247XG5cblx0ICAgICAgICAgICAgICAgICAgICB2YXIgZGVzYyA9IG5ldyBSVENTZXNzaW9uRGVzY3JpcHRpb24ocmVtb3RlX2Rlc2NyaXB0aW9uKTtcblx0ICAgICAgICAgICAgICAgICAgICB2YXIgc3R1ZmYgPSBwZWVyLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2MsIGZ1bmN0aW9uICgpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW90ZV9kZXNjcmlwdGlvbi50eXBlID09IFwib2ZmZXJcIikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlci5jcmVhdGVBbnN3ZXIoZnVuY3Rpb24gKGxvY2FsX2Rlc2NyaXB0aW9uKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlci5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlTZXNzaW9uRGVzY3JpcHRpb24nLCB7ICdwZWVyX2lkJzogcGVlcl9pZCwgJ3Nlc3Npb25fZGVzY3JpcHRpb24nOiBsb2NhbF9kZXNjcmlwdGlvbiB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsZXJ0KFwiQW5zd2VyIHNldExvY2FsRGVzY3JpcHRpb24gZmFpbGVkIVwiKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3IgY3JlYXRpbmcgYW5zd2VyOiBcIiwgZXJyb3IpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZXRSZW1vdGVEZXNjcmlwdGlvbiBlcnJvcjogXCIsIGVycm9yKTtcblx0ICAgICAgICAgICAgICAgICAgICB9KTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdpY2VDYW5kaWRhdGUnLCBmdW5jdGlvbiAoY29uZmlnKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHBlZXIgPSBwZWVyc1tjb25maWcucGVlcl9pZF07XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIGljZV9jYW5kaWRhdGUgPSBjb25maWcuaWNlX2NhbmRpZGF0ZTtcblx0ICAgICAgICAgICAgICAgICAgICBwZWVyLmFkZEljZUNhbmRpZGF0ZShuZXcgUlRDSWNlQ2FuZGlkYXRlKGljZV9jYW5kaWRhdGUpKTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXG5cdCAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdyZW1vdmVQZWVyJywgZnVuY3Rpb24gKGNvbmZpZykge1xuXHQgICAgICAgICAgICAgICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG5cdCAgICAgICAgICAgICAgICAgICAgeXdlYnJ0Yy51c2VyTGVmdChwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVyX21lZGlhX2VsZW1lbnRzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHNbcGVlcl9pZF0ucmVtb3ZlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHBlZXJzW3BlZXJfaWRdLmNsb3NlKCk7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXG5cdCAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHBlZXJzW3BlZXJfaWRdO1xuXHQgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBwZWVyX21lZGlhX2VsZW1lbnRzW2NvbmZpZy5wZWVyX2lkXTtcblx0ICAgICAgICAgICAgICAgIH0pO1xuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgIGluaXQoc2VsZik7XG5cdCAgICAgICAgICAgIC8qKioqKioqKioqKioqKioqKioqKioqKiogZW5kIG1pbmltYWxfd2VicnRjICoqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cdCAgICAgICAgICAgIHJldHVybiBfdGhpcztcblx0ICAgICAgICB9XG5cblx0ICAgICAgICBjcmVhdGVDbGFzcyhDb25uZWN0b3IsIFt7XG5cdCAgICAgICAgICAgIGtleTogJ2Rpc2Nvbm5lY3QnLFxuXHQgICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZGlzY29ubmVjdCgpIHt9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdkZXN0cm95Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7fVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAncmVjb25uZWN0Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHJlY29ubmVjdCgpIHt9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdzZW5kJyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIHNlbmQodWlkLCBtZXNzYWdlKSB7XG5cdCAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnJCQkJCQkJCQkJCQkJCQkJCBzeW5jaW5nLi4uLi4uICQkJCQkJCQkJCQkJCQkJCQkJyk7XG5cdCAgICAgICAgICAgICAgICBmdW5jdGlvbiBzZW5kMihkYXRhQ2hhbm5lbCwgZGF0YTIpIHtcblx0ICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YUNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBDSFVOS19MRU4gPSA2NDAwMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxlbiA9IGRhdGEyLmJ5dGVMZW5ndGg7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gbGVuIC8gQ0hVTktfTEVOIHwgMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChsZW4pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAvLyBzcGxpdCB0aGUgcGhvdG8gYW5kIHNlbmQgaW4gY2h1bmtzIG9mIGFib3V0IDY0S0Jcblx0ICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdGFydCA9IGkgKiBDSFVOS19MRU4sXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kID0gKGkgKyAxKSAqIENIVU5LX0xFTjtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFDaGFubmVsLnNlbmQoZGF0YTIuc3ViYXJyYXkoc3RhcnQsIGVuZCkpO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbmQgdGhlIHJlbWluZGVyLCBpZiBhbnlcblx0ICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxlbiAlIENIVU5LX0xFTikge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShuICogQ0hVTktfTEVOKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH1cblx0ICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHNlbmQyLCA1MDAsIGRhdGFDaGFubmVsLCBkYXRhMik7XG5cdCAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgc2VuZDIodGhpcy5zZGNzW3VpZF0sIG5ldyBVaW50OEFycmF5KG1lc3NhZ2UpKTtcblx0ICAgICAgICAgICAgfVxuXHQgICAgICAgIH0sIHtcblx0ICAgICAgICAgICAga2V5OiAnYnJvYWRjYXN0Jyxcblx0ICAgICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGJyb2FkY2FzdChtZXNzYWdlKSB7XG5cdCAgICAgICAgICAgICAgICBmb3IgKHZhciBwZWVyX2lkIGluIHRoaXMuZGNzKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHNlbmQyID0gZnVuY3Rpb24gc2VuZDIoZGF0YUNoYW5uZWwsIGRhdGEyKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhQ2hhbm5lbC5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBDSFVOS19MRU4gPSA2NDAwMDtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsZW4gPSBkYXRhMi5ieXRlTGVuZ3RoO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG4gPSBsZW4gLyBDSFVOS19MRU4gfCAwO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChsZW4pO1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BsaXQgdGhlIHBob3RvIGFuZCBzZW5kIGluIGNodW5rcyBvZiBhYm91dCA2NEtCXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykge1xuXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdGFydCA9IGkgKiBDSFVOS19MRU4sXG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZCA9IChpICsgMSkgKiBDSFVOS19MRU47XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShzdGFydCwgZW5kKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZW5kIHRoZSByZW1pbmRlciwgaWYgYW55XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGVuICUgQ0hVTktfTEVOKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YUNoYW5uZWwuc2VuZChkYXRhMi5zdWJhcnJheShuICogQ0hVTktfTEVOKSk7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cdCAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRXJycnJycnJycnJycnJycnJycnJycnJycnJycnJycnInLCBwZWVyX2lkKTtcblx0ICAgICAgICAgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICAgICAgICAgIH07XG5cblx0ICAgICAgICAgICAgICAgICAgICBzZW5kMih0aGlzLmRjc1twZWVyX2lkXSwgbmV3IFVpbnQ4QXJyYXkobWVzc2FnZSkpO1xuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgfSwge1xuXHQgICAgICAgICAgICBrZXk6ICdpc0Rpc2Nvbm5lY3RlZCcsXG5cdCAgICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBpc0Rpc2Nvbm5lY3RlZCgpIHtcblx0ICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnNvY2tldC5kaXNjb25uZWN0ZWQ7XG5cdCAgICAgICAgICAgIH1cblx0ICAgICAgICB9XSk7XG5cdCAgICAgICAgcmV0dXJuIENvbm5lY3Rvcjtcblx0ICAgIH0oWS5BYnN0cmFjdENvbm5lY3Rvcik7XG5cblx0ICAgIENvbm5lY3Rvci5pbyA9IGxpYiQyO1xuXHQgICAgWVsnd2VicnRjJ10gPSBDb25uZWN0b3I7XG5cdH1cblxuXHRpZiAodHlwZW9mIFkgIT09ICd1bmRlZmluZWQnKSB7XG5cdCAgICBleHRlbmQoWSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0fVxuXG5cdHJldHVybiBleHRlbmQ7XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD15LXdlYnJ0Yy5qcy5tYXBcbiIsIi8qKlxuICogeWpzIC0gQSBmcmFtZXdvcmsgZm9yIHJlYWwtdGltZSBwMnAgc2hhcmVkIGVkaXRpbmcgb24gYW55IGRhdGFcbiAqIEB2ZXJzaW9uIHYxMy4wLjAtNjNcbiAqIEBsaWNlbnNlIE1JVFxuICovXG4hZnVuY3Rpb24odCxlKXtcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZT9tb2R1bGUuZXhwb3J0cz1lKCk6XCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShlKTp0Llk9ZSgpfSh0aGlzLGZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gdCh0LGUsbixyKXtpZihudWxsPT09ZSl0LnJvb3Q9bixuLl9wYXJlbnQ9bnVsbDtlbHNlIGlmKGUubGVmdD09PXIpZS5sZWZ0PW47ZWxzZXtpZihlLnJpZ2h0IT09cil0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZWxlbWVudHMgYXJlIHdyb25nbHkgY29ubmVjdGVkIVwiKTtlLnJpZ2h0PW59fWZ1bmN0aW9uIGUodCxlKXt2YXIgbj1lLl9pZDtpZih2b2lkIDA9PT1uKWUuX2ludGVncmF0ZSh0KTtlbHNle2lmKHQuc3MuZ2V0U3RhdGUobi51c2VyKT5uLmNsb2NrKXJldHVybjshdC5nY0VuYWJsZWR8fGUuY29uc3RydWN0b3I9PT1qdHx8ZS5fcGFyZW50LmNvbnN0cnVjdG9yIT09anQmJiExPT09ZS5fcGFyZW50Ll9kZWxldGVkP2UuX2ludGVncmF0ZSh0KTplLl9nYyh0KTt2YXIgcj10Ll9taXNzaW5nU3RydWN0cy5nZXQobi51c2VyKTtpZihudWxsIT1yKWZvcih2YXIgaT1uLmNsb2NrLG89aStlLl9sZW5ndGg7aTxvO2krKyl7dmFyIGE9ci5nZXQoaSk7dm9pZCAwIT09YSYmKGEuZm9yRWFjaChmdW5jdGlvbihlKXtpZigwPT09LS1lLm1pc3Npbmcpe3ZhciBuPWUuZGVjb2RlcixyPW4ucG9zLGk9ZS5zdHJ1Y3QuX2Zyb21CaW5hcnkodCxuKTtuLnBvcz1yLDA9PT1pLmxlbmd0aCYmdC5fcmVhZHlUb0ludGVncmF0ZS5wdXNoKGUuc3RydWN0KX19KSxyLmRlbGV0ZShpKSl9fX1mdW5jdGlvbiBuKHQsZSxuKXtmb3IodmFyIHI9ZS5yZWFkVWludDMyKCksaT0wO2k8cjtpKyspe3ZhciBvPWUucmVhZFZhclVpbnQoKSxhPUYobykscz1uZXcgYSxsPXMuX2Zyb21CaW5hcnkodCxlKSx1PVwiICBcIitzLl9sb2dTdHJpbmcoKTtsLmxlbmd0aD4wJiYodSs9XCIgLi4gbWlzc2luZzogXCIrbC5tYXAocCkuam9pbihcIiwgXCIpKSxuLnB1c2godSl9fWZ1bmN0aW9uIHIodCxuKXtmb3IodmFyIHI9bi5yZWFkVWludDMyKCksaT0wO2k8cjtpKyspe3ZhciBvPW4ucmVhZFZhclVpbnQoKSxhPUYobykscz1uZXcgYSxsPW4ucG9zLHU9cy5fZnJvbUJpbmFyeSh0LG4pO2lmKDA9PT11Lmxlbmd0aClmb3IoO251bGwhPXM7KWUodCxzKSxzPXQuX3JlYWR5VG9JbnRlZ3JhdGUuc2hpZnQoKTtlbHNle3ZhciBjPW5ldyBOdChuLnVpbnQ4YXJyKTtjLnBvcz1sO2Zvcih2YXIgaD1uZXcgVnQoYyx1LHMpLGY9dC5fbWlzc2luZ1N0cnVjdHMsZD11Lmxlbmd0aC0xO2Q+PTA7ZC0tKXt2YXIgXz11W2RdO2YuaGFzKF8udXNlcil8fGYuc2V0KF8udXNlcixuZXcgTWFwKTt2YXIgdj1mLmdldChfLnVzZXIpO3YuaGFzKF8uY2xvY2spfHx2LnNldChfLmNsb2NrLFtdKTsodj12LmdldChfLmNsb2NrKSkucHVzaChoKX19fX1mdW5jdGlvbiBpKHQpe2Zvcih2YXIgZT1uZXcgTWFwLG49dC5yZWFkVWludDMyKCkscj0wO3I8bjtyKyspe3ZhciBpPXQucmVhZFZhclVpbnQoKSxvPXQucmVhZFZhclVpbnQoKTtlLnNldChpLG8pfXJldHVybiBlfWZ1bmN0aW9uIG8odCxlKXt2YXIgbj1lLnBvcyxyPTA7ZS53cml0ZVVpbnQzMigwKTt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD10LnNzLnN0YXRlW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PUJ0KHMudmFsdWUsMiksYz11WzBdLGg9dVsxXTtlLndyaXRlVmFyVWludChjKSxlLndyaXRlVmFyVWludChoKSxyKyt9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19ZS5zZXRVaW50MzIobixyKX1mdW5jdGlvbiBhKHQsZSl7dmFyIG49bnVsbCxyPXZvaWQgMCxpPXZvaWQgMCxvPTAsYT1lLnBvcztlLndyaXRlVWludDMyKDApLHQuZHMuaXRlcmF0ZShudWxsLG51bGwsZnVuY3Rpb24odCl7dmFyIGE9dC5faWQudXNlcixzPXQuX2lkLmNsb2NrLGw9dC5sZW4sdT10LmdjO24hPT1hJiYobysrLG51bGwhPT1uJiZlLnNldFVpbnQzMihpLHIpLG49YSxlLndyaXRlVmFyVWludChhKSxpPWUucG9zLGUud3JpdGVVaW50MzIoMCkscj0wKSxlLndyaXRlVmFyVWludChzKSxlLndyaXRlVmFyVWludChsKSxlLndyaXRlVWludDgodT8xOjApLHIrK30pLG51bGwhPT1uJiZlLnNldFVpbnQzMihpLHIpLGUuc2V0VWludDMyKGEsbyl9ZnVuY3Rpb24gcyh0LGUpe2Zvcih2YXIgbj1lLnJlYWRVaW50MzIoKSxyPTA7cjxuO3IrKykhZnVuY3Rpb24obil7Zm9yKHZhciByPWUucmVhZFZhclVpbnQoKSxpPVtdLG89ZS5yZWFkVWludDMyKCksYT0wO2E8bzthKyspe3ZhciBzPWUucmVhZFZhclVpbnQoKSxsPWUucmVhZFZhclVpbnQoKSx1PTE9PT1lLnJlYWRVaW50OCgpO2kucHVzaChbcyxsLHVdKX1pZihvPjApe3ZhciBjPTAsaD1pW2NdLGY9W107dC5kcy5pdGVyYXRlKG5ldyBJdChyLDApLG5ldyBJdChyLE51bWJlci5NQVhfVkFMVUUpLGZ1bmN0aW9uKHQpe2Zvcig7bnVsbCE9aDspe3ZhciBlPTA7aWYodC5faWQuY2xvY2srdC5sZW48PWhbMF0pYnJlYWs7aFswXTx0Ll9pZC5jbG9jaz8oZT1NYXRoLm1pbih0Ll9pZC5jbG9jay1oWzBdLGhbMV0pLGYucHVzaChbcixoWzBdLGVdKSk6KGU9dC5faWQuY2xvY2srdC5sZW4taFswXSxoWzJdJiYhdC5nYyYmZi5wdXNoKFtyLGhbMF0sTWF0aC5taW4oZSxoWzFdKV0pKSxoWzFdPD1lP2g9aVsrK2NdOihoWzBdPWhbMF0rZSxoWzFdPWhbMV0tZSl9fSk7Zm9yKHZhciBkPWYubGVuZ3RoLTE7ZD49MDtkLS0pe3ZhciBfPWZbZF07Zyh0LF9bMF0sX1sxXSxfWzJdLCEwKX1mb3IoO2M8aS5sZW5ndGg7YysrKWg9aVtjXSxnKHQscixoWzBdLGhbMV0sITApfX0oKX1mdW5jdGlvbiBsKHQsZSxuKXt2YXIgcj1lLnJlYWRWYXJTdHJpbmcoKSxpPWUucmVhZFZhclVpbnQoKTtuLnB1c2goJyAgLSBhdXRoOiBcIicrcisnXCInKSxuLnB1c2goXCIgIC0gcHJvdG9jb2xWZXJzaW9uOiBcIitpKTtmb3IodmFyIG89W10sYT1lLnJlYWRVaW50MzIoKSxzPTA7czxhO3MrKyl7dmFyIGw9ZS5yZWFkVmFyVWludCgpLHU9ZS5yZWFkVmFyVWludCgpO28ucHVzaChcIihcIitsK1wiOlwiK3UrXCIpXCIpfW4ucHVzaChcIiAgPT0gU1M6IFwiK28uam9pbihcIixcIikpfWZ1bmN0aW9uIHUodCxlKXt2YXIgbj1uZXcgTHQ7bi53cml0ZVZhclN0cmluZyh0Lnkucm9vbSksbi53cml0ZVZhclN0cmluZyhcInN5bmMgc3RlcCAxXCIpLG4ud3JpdGVWYXJTdHJpbmcodC5hdXRoSW5mb3x8XCJcIiksbi53cml0ZVZhclVpbnQodC5wcm90b2NvbFZlcnNpb24pLG8odC55LG4pLHQuc2VuZChlLG4uY3JlYXRlQnVmZmVyKCkpfWZ1bmN0aW9uIGModCxlLG4pe3ZhciByPWUucG9zO2Uud3JpdGVVaW50MzIoMCk7dmFyIGk9MCxvPSEwLGE9ITEscz12b2lkIDA7dHJ5e2Zvcih2YXIgbCx1PXQuc3Muc3RhdGUua2V5cygpW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPWwudmFsdWUsaD1uLmdldChjKXx8MDtpZihjIT09WHQpe3ZhciBmPW5ldyBJdChjLGgpLGQ9dC5vcy5maW5kUHJldihmKSxfPW51bGw9PT1kP251bGw6ZC5faWQ7aWYobnVsbCE9PV8mJl8udXNlcj09PWMmJl8uY2xvY2srZC5fbGVuZ3RoPmgpe2QuX2Nsb25lUGFydGlhbChoLV8uY2xvY2spLl90b0JpbmFyeShlKSxpKyt9dC5vcy5pdGVyYXRlKGYsbmV3IEl0KGMsTnVtYmVyLk1BWF9WQUxVRSksZnVuY3Rpb24odCl7dC5fdG9CaW5hcnkoZSksaSsrfSl9fX1jYXRjaCh0KXthPSEwLHM9dH1maW5hbGx5e3RyeXshbyYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihhKXRocm93IHN9fWUuc2V0VWludDMyKHIsaSl9ZnVuY3Rpb24gaCh0LGUsbixyLG8pe3ZhciBzPXQucmVhZFZhclVpbnQoKTtzIT09bi5jb25uZWN0b3IucHJvdG9jb2xWZXJzaW9uJiYoY29uc29sZS53YXJuKFwiWW91IHRyaWVkIHRvIHN5bmMgd2l0aCBhIFlqcyBpbnN0YW5jZSB0aGF0IGhhcyBhIGRpZmZlcmVudCBwcm90b2NvbCB2ZXJzaW9uXFxuICAgICAgKFlvdTogXCIrcytcIiwgQ2xpZW50OiBcIitzK1wiKS5cXG4gICAgICBcIiksbi5kZXN0cm95KCkpLGUud3JpdGVWYXJTdHJpbmcoXCJzeW5jIHN0ZXAgMlwiKSxlLndyaXRlVmFyU3RyaW5nKG4uY29ubmVjdG9yLmF1dGhJbmZvfHxcIlwiKSxjKG4sZSxpKHQpKSxhKG4sZSksbi5jb25uZWN0b3Iuc2VuZChyLnVpZCxlLmNyZWF0ZUJ1ZmZlcigpKSxyLnJlY2VpdmVkU3luY1N0ZXAyPSEwLFwic2xhdmVcIj09PW4uY29ubmVjdG9yLnJvbGUmJnUobi5jb25uZWN0b3Isbyl9ZnVuY3Rpb24gZih0LGUscil7ci5wdXNoKFwiICAgICAtIGF1dGg6IFwiK2UucmVhZFZhclN0cmluZygpKSxyLnB1c2goXCIgID09IE9TOlwiKSxuKHQsZSxyKSxyLnB1c2goXCIgID09IERTOlwiKTtmb3IodmFyIGk9ZS5yZWFkVWludDMyKCksbz0wO288aTtvKyspe3ZhciBhPWUucmVhZFZhclVpbnQoKTtyLnB1c2goXCIgICAgVXNlcjogXCIrYStcIjogXCIpO2Zvcih2YXIgcz1lLnJlYWRVaW50MzIoKSxsPTA7bDxzO2wrKyl7dmFyIHU9ZS5yZWFkVmFyVWludCgpLGM9ZS5yZWFkVmFyVWludCgpLGg9MT09PWUucmVhZFVpbnQ4KCk7ci5wdXNoKFwiW1wiK3UrXCIsIFwiK2MrXCIsIFwiK2grXCJdXCIpfX19ZnVuY3Rpb24gZCh0LGUsbixpLG8pe3Iobix0KSxzKG4sdCksbi5jb25uZWN0b3IuX3NldFN5bmNlZFdpdGgobyl9ZnVuY3Rpb24gXyh0KXt2YXIgZT1CdCh0LDIpLHI9ZVswXSxpPWVbMV0sbz1uZXcgTnQoaSk7by5yZWFkVmFyU3RyaW5nKCk7dmFyIGE9by5yZWFkVmFyU3RyaW5nKCkscz1bXTtyZXR1cm4gcy5wdXNoKFwiXFxuID09PSBcIithK1wiID09PVwiKSxcInVwZGF0ZVwiPT09YT9uKHIsbyxzKTpcInN5bmMgc3RlcCAxXCI9PT1hP2wocixvLHMpOlwic3luYyBzdGVwIDJcIj09PWE/ZihyLG8scyk6cy5wdXNoKFwiLS0gVW5rbm93biBtZXNzYWdlIHR5cGUgLSBwcm9iYWJseSBhbiBlbmNvZGluZyBpc3N1ZSEhIVwiKSxzLmpvaW4oXCJcXG5cIil9ZnVuY3Rpb24gdih0KXt2YXIgZT1uZXcgTnQodCk7cmV0dXJuIGUucmVhZFZhclN0cmluZygpLGUucmVhZFZhclN0cmluZygpfWZ1bmN0aW9uIHAodCl7aWYobnVsbCE9PXQmJm51bGwhPXQuX2lkJiYodD10Ll9pZCksbnVsbD09PXQpcmV0dXJuXCIoKVwiO2lmKHQgaW5zdGFuY2VvZiBJdClyZXR1cm5cIihcIit0LnVzZXIrXCIsXCIrdC5jbG9jaytcIilcIjtpZih0IGluc3RhbmNlb2YgcXQpcmV0dXJuXCIoXCIrdC5uYW1lK1wiLFwiK3QudHlwZStcIilcIjtpZih0LmNvbnN0cnVjdG9yPT09WSlyZXR1cm5cInlcIjt0aHJvdyBuZXcgRXJyb3IoXCJUaGlzIGlzIG5vdCBhIHZhbGlkIElEIVwiKX1mdW5jdGlvbiB5KHQsZSxuKXt2YXIgcj1udWxsIT09ZS5fbGVmdD9lLl9sZWZ0Ll9sYXN0SWQ6bnVsbCxpPW51bGwhPT1lLl9vcmlnaW4/ZS5fb3JpZ2luLl9sYXN0SWQ6bnVsbDtyZXR1cm4gdCtcIihpZDpcIitwKGUuX2lkKStcIixsZWZ0OlwiK3AocikrXCIsb3JpZ2luOlwiK3AoaSkrXCIscmlnaHQ6XCIrcChlLl9yaWdodCkrXCIscGFyZW50OlwiK3AoZS5fcGFyZW50KStcIixwYXJlbnRTdWI6XCIrZS5fcGFyZW50U3ViKyh2b2lkIDAhPT1uP1wiIC0gXCIrbjpcIlwiKStcIilcIn1mdW5jdGlvbiBnKHQsZSxuLHIsaSl7dmFyIG89bnVsbCE9PXQuY29ubmVjdG9yJiZ0LmNvbm5lY3Rvci5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzLGE9dC5vcy5nZXRJdGVtQ2xlYW5TdGFydChuZXcgSXQoZSxuKSk7aWYobnVsbCE9PWEpe2EuX2RlbGV0ZWR8fChhLl9zcGxpdEF0KHQsciksYS5fZGVsZXRlKHQsbywhMCkpO3ZhciBzPWEuX2xlbmd0aDtpZihyLT1zLG4rPXMscj4wKWZvcih2YXIgbD10Lm9zLmZpbmROb2RlKG5ldyBJdChlLG4pKTtudWxsIT09bCYmbnVsbCE9PWwudmFsJiZyPjAmJmwudmFsLl9pZC5lcXVhbHMobmV3IEl0KGUsbikpOyl7dmFyIHU9bC52YWw7dS5fZGVsZXRlZHx8KHUuX3NwbGl0QXQodCxyKSx1Ll9kZWxldGUodCxvLGkpKTt2YXIgYz11Ll9sZW5ndGg7ci09YyxuKz1jLGw9bC5uZXh0KCl9fX1mdW5jdGlvbiBtKHQsZSxuKXtpZihlIT09dCYmIWUuX2RlbGV0ZWQmJiF0Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5oYXMoZSkpe3ZhciByPXQuX3RyYW5zYWN0aW9uLmNoYW5nZWRUeXBlcyxpPXIuZ2V0KGUpO3ZvaWQgMD09PWkmJihpPW5ldyBTZXQsci5zZXQoZSxpKSksaS5hZGQobil9fWZ1bmN0aW9uIGsodCxlLG4scil7dmFyIGk9ZS5faWQ7bi5faWQ9bmV3IEl0KGkudXNlcixpLmNsb2NrK3IpLG4uX29yaWdpbj1lLG4uX2xlZnQ9ZSxuLl9yaWdodD1lLl9yaWdodCxudWxsIT09bi5fcmlnaHQmJihuLl9yaWdodC5fbGVmdD1uKSxuLl9yaWdodF9vcmlnaW49ZS5fcmlnaHRfb3JpZ2luLGUuX3JpZ2h0PW4sbi5fcGFyZW50PWUuX3BhcmVudCxuLl9wYXJlbnRTdWI9ZS5fcGFyZW50U3ViLG4uX2RlbGV0ZWQ9ZS5fZGVsZXRlZDt2YXIgbz1uZXcgU2V0O28uYWRkKGUpO2Zvcih2YXIgYT1uLl9yaWdodDtudWxsIT09YSYmby5oYXMoYS5fb3JpZ2luKTspYS5fb3JpZ2luPT09ZSYmKGEuX29yaWdpbj1uKSxvLmFkZChhKSxhPWEuX3JpZ2h0O3Qub3MucHV0KG4pLHQuX3RyYW5zYWN0aW9uLm5ld1R5cGVzLmhhcyhlKT90Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5hZGQobik6dC5fdHJhbnNhY3Rpb24uZGVsZXRlZFN0cnVjdHMuaGFzKGUpJiZ0Ll90cmFuc2FjdGlvbi5kZWxldGVkU3RydWN0cy5hZGQobil9ZnVuY3Rpb24gYih0LGUpe3ZhciBuPXZvaWQgMDtkb3tuPWUuX3JpZ2h0LGUuX3JpZ2h0PW51bGwsZS5fcmlnaHRfb3JpZ2luPW51bGwsZS5fb3JpZ2luPWUuX2xlZnQsZS5faW50ZWdyYXRlKHQpLGU9bn13aGlsZShudWxsIT09bil9ZnVuY3Rpb24gdyh0LGUpe2Zvcig7bnVsbCE9PWU7KWUuX2RlbGV0ZSh0LCExLCEwKSxlLl9nYyh0KSxlPWUuX3JpZ2h0fWZ1bmN0aW9uIFModCxlLG4scixpKXt0Ll9vcmlnaW49cix0Ll9sZWZ0PXIsdC5fcmlnaHQ9aSx0Ll9yaWdodF9vcmlnaW49aSx0Ll9wYXJlbnQ9ZSxudWxsIT09bj90Ll9pbnRlZ3JhdGUobik6bnVsbD09PXI/ZS5fc3RhcnQ9dDpyLl9yaWdodD10fWZ1bmN0aW9uIE8odCxlLG4scixpKXtmb3IoO251bGwhPT1yJiZpPjA7KXtzd2l0Y2goci5jb25zdHJ1Y3Rvcil7Y2FzZSBSdDpjYXNlIEl0ZW1TdHJpbmc6aWYoaTw9KHIuX2RlbGV0ZWQ/MDpyLl9sZW5ndGgtMSkpcmV0dXJuIHI9ci5fc3BsaXRBdChlLl95LGkpLG49ci5fbGVmdCxbbixyLHRdOyExPT09ci5fZGVsZXRlZCYmKGktPXIuX2xlbmd0aCk7YnJlYWs7Y2FzZSBXdDohMT09PXIuX2RlbGV0ZWQmJlQodCxyKX1uPXIscj1yLl9yaWdodH1yZXR1cm5bbixyLHRdfWZ1bmN0aW9uIEUodCxlKXtyZXR1cm4gTyhuZXcgTWFwLHQsbnVsbCx0Ll9zdGFydCxlKX1mdW5jdGlvbiBVKHQsZSxuLHIsaSl7Zm9yKDtudWxsIT09ciYmKCEwPT09ci5fZGVsZXRlZHx8ci5jb25zdHJ1Y3Rvcj09PVd0JiZpLmdldChyLmtleSk9PT1yLnZhbHVlKTspITE9PT1yLl9kZWxldGVkJiZpLmRlbGV0ZShyLmtleSksbj1yLHI9ci5fcmlnaHQ7dmFyIG89ITAsYT0hMSxzPXZvaWQgMDt0cnl7Zm9yKHZhciBsLHU9aVtTeW1ib2wuaXRlcmF0b3JdKCk7IShvPShsPXUubmV4dCgpKS5kb25lKTtvPSEwKXt2YXIgYz1CdChsLnZhbHVlLDIpLGg9Y1swXSxmPWNbMV0sZD1uZXcgV3Q7ZC5rZXk9aCxkLnZhbHVlPWYsUyhkLGUsdCxuLHIpLG49ZH19Y2F0Y2godCl7YT0hMCxzPXR9ZmluYWxseXt0cnl7IW8mJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYoYSl0aHJvdyBzfX1yZXR1cm5bbixyXX1mdW5jdGlvbiBUKHQsZSl7dmFyIG49ZS52YWx1ZSxyPWUua2V5O251bGw9PT1uP3QuZGVsZXRlKHIpOnQuc2V0KHIsbil9ZnVuY3Rpb24gQih0LGUsbixyKXtmb3IoOzspe2lmKG51bGw9PT1lKWJyZWFrO2lmKCEwPT09ZS5fZGVsZXRlZCk7ZWxzZXtpZihlLmNvbnN0cnVjdG9yIT09V3R8fChyW2Uua2V5XXx8bnVsbCkhPT1lLnZhbHVlKWJyZWFrO1QobixlKX10PWUsZT1lLl9yaWdodH1yZXR1cm5bdCxlXX1mdW5jdGlvbiBBKHQsZSxuLHIsaSxvKXt2YXIgYT1uZXcgTWFwO2Zvcih2YXIgcyBpbiBpKXt2YXIgbD1pW3NdLHU9by5nZXQocyk7aWYodSE9PWwpe2Euc2V0KHMsdXx8bnVsbCk7dmFyIGM9bmV3IFd0O2Mua2V5PXMsYy52YWx1ZT1sLFMoYyxlLHQsbixyKSxuPWN9fXJldHVybltuLHIsYV19ZnVuY3Rpb24geCh0LGUsbixyLGksbyxhKXt2YXIgcz0hMCxsPSExLHU9dm9pZCAwO3RyeXtmb3IodmFyIGMsaD1vW1N5bWJvbC5pdGVyYXRvcl0oKTshKHM9KGM9aC5uZXh0KCkpLmRvbmUpO3M9ITApe3ZhciBmPUJ0KGMudmFsdWUsMSksZD1mWzBdO3ZvaWQgMD09PWFbZF0mJihhW2RdPW51bGwpfX1jYXRjaCh0KXtsPSEwLHU9dH1maW5hbGx5e3RyeXshcyYmaC5yZXR1cm4mJmgucmV0dXJuKCl9ZmluYWxseXtpZihsKXRocm93IHV9fXZhciBfPUIocixpLG8sYSksdj1CdChfLDIpO3I9dlswXSxpPXZbMV07dmFyIHA9dm9pZCAwLHk9QSh0LG4scixpLGEsbyksZz1CdCh5LDMpO3I9Z1swXSxpPWdbMV0scD1nWzJdO3ZhciBtPXZvaWQgMDtyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PVN0cmluZz8obT1uZXcgSXRlbVN0cmluZyxtLl9jb250ZW50PWUpOihtPW5ldyBSdCxtLmVtYmVkPWUpLFMobSxuLHQscixpKSxyPW0sVSh0LG4scixpLHApfWZ1bmN0aW9uIEkodCxlLG4scixpLG8sYSl7dmFyIHM9QihyLGksbyxhKSxsPUJ0KHMsMik7cj1sWzBdLGk9bFsxXTt2YXIgdT12b2lkIDAsYz1BKHQsbixyLGksYSxvKSxoPUJ0KGMsMyk7Zm9yKHI9aFswXSxpPWhbMV0sdT1oWzJdO2U+MCYmbnVsbCE9PWk7KXtpZighMT09PWkuX2RlbGV0ZWQpc3dpdGNoKGkuY29uc3RydWN0b3Ipe2Nhc2UgV3Q6dmFyIGY9YVtpLmtleV07dm9pZCAwIT09ZiYmKGY9PT1pLnZhbHVlP3UuZGVsZXRlKGkua2V5KTp1LnNldChpLmtleSxpLnZhbHVlKSxpLl9kZWxldGUodCkpLFQobyxpKTticmVhaztjYXNlIFJ0OmNhc2UgSXRlbVN0cmluZzppLl9zcGxpdEF0KHQsZSksZS09aS5fbGVuZ3RofXI9aSxpPWkuX3JpZ2h0fXJldHVybiBVKHQsbixyLGksdSl9ZnVuY3Rpb24gRCh0LGUsbixyLGksbyl7Zm9yKDtlPjAmJm51bGwhPT1pOyl7aWYoITE9PT1pLl9kZWxldGVkKXN3aXRjaChpLmNvbnN0cnVjdG9yKXtjYXNlIFd0OlQobyxpKTticmVhaztjYXNlIFJ0OmNhc2UgSXRlbVN0cmluZzppLl9zcGxpdEF0KHQsZSksZS09aS5fbGVuZ3RoLGkuX2RlbGV0ZSh0KX1yPWksaT1pLl9yaWdodH1yZXR1cm5bcixpXX1mdW5jdGlvbiBQKHQsZSl7Zm9yKGU9ZS5fcGFyZW50O251bGwhPT1lOyl7aWYoZT09PXQpcmV0dXJuITA7ZT1lLl9wYXJlbnR9cmV0dXJuITF9ZnVuY3Rpb24gTih0LGUpe3JldHVybiBlfWZ1bmN0aW9uIGoodCxlKXtmb3IodmFyIG49bmV3IE1hcCxyPXQuYXR0cmlidXRlcy5sZW5ndGgtMTtyPj0wO3ItLSl7dmFyIGk9dC5hdHRyaWJ1dGVzW3JdO24uc2V0KGkubmFtZSxpLnZhbHVlKX1yZXR1cm4gZSh0Lm5vZGVOYW1lLG4pfWZ1bmN0aW9uIFYodCxlLG4pe2lmKFAoZS50eXBlLG4pKXt2YXIgcj1uLm5vZGVOYW1lLGk9bmV3IE1hcDtpZih2b2lkIDAhPT1uLmdldEF0dHJpYnV0ZXMpe3ZhciBvPW4uZ2V0QXR0cmlidXRlcygpO2Zvcih2YXIgYSBpbiBvKWkuc2V0KGEsb1thXSl9dmFyIHM9ZS5maWx0ZXIocixuZXcgTWFwKGkpKTtudWxsPT09cz9uLl9kZWxldGUodCk6aS5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ITE9PT1zLmhhcyhlKSYmbi5yZW1vdmVBdHRyaWJ1dGUoZSl9KX19ZnVuY3Rpb24gTCh0KXt2YXIgZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06ZG9jdW1lbnQsbj1hcmd1bWVudHMubGVuZ3RoPjImJnZvaWQgMCE9PWFyZ3VtZW50c1syXT9hcmd1bWVudHNbMl06e30scj1hcmd1bWVudHMubGVuZ3RoPjMmJnZvaWQgMCE9PWFyZ3VtZW50c1szXT9hcmd1bWVudHNbM106TixpPWFyZ3VtZW50c1s0XSxvPXZvaWQgMDtzd2l0Y2godC5ub2RlVHlwZSl7Y2FzZSBlLkVMRU1FTlRfTk9ERTp2YXIgYT1udWxsLHM9dm9pZCAwO2lmKHQuaGFzQXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiKSYmKGE9dC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXlqcy1ob29rXCIpLHZvaWQgMD09PShzPW5bYV0pJiYoY29uc29sZS5lcnJvcignVW5rbm93biBob29rIFwiJythKydcIi4gRGVsZXRpbmcgeWpzSG9vayBkYXRhc2V0IHByb3BlcnR5LicpLHQucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiKSxhPW51bGwpKSxudWxsPT09YSl7dmFyIGw9aih0LHIpO251bGw9PT1sP289ITE6KG89bmV3IFlYbWxFbGVtZW50KHQubm9kZU5hbWUpLGwuZm9yRWFjaChmdW5jdGlvbih0LGUpe28uc2V0QXR0cmlidXRlKGUsdCl9KSxvLmluc2VydCgwLEoodC5jaGlsZE5vZGVzLGRvY3VtZW50LG4scixpKSkpfWVsc2Ugbz1uZXcgWVhtbEhvb2soYSkscy5maWxsVHlwZSh0LG8pO2JyZWFrO2Nhc2UgZS5URVhUX05PREU6bz1uZXcgWVhtbFRleHQsby5pbnNlcnQoMCx0Lm5vZGVWYWx1ZSk7YnJlYWs7ZGVmYXVsdDp0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCB0cmFuc2Zvcm0gdGhpcyBub2RlIHR5cGUgdG8gYSBZWG1sIHR5cGUhXCIpfXJldHVybiBSKGksdCxvKSxvfWZ1bmN0aW9uIEModCl7Zm9yKDtudWxsIT09dCYmdC5fZGVsZXRlZDspdD10Ll9yaWdodDtyZXR1cm4gdH1mdW5jdGlvbiBNKHQsZSxuKXt0LmRvbVRvVHlwZS5kZWxldGUoZSksdC50eXBlVG9Eb20uZGVsZXRlKG4pfWZ1bmN0aW9uIFIodCxlLG4pe3ZvaWQgMCE9PXQmJih0LmRvbVRvVHlwZS5zZXQoZSxuKSx0LnR5cGVUb0RvbS5zZXQobixlKSl9ZnVuY3Rpb24gVyh0LGUsbil7aWYodm9pZCAwIT09dCl7dmFyIHI9dC5kb21Ub1R5cGUuZ2V0KGUpO3ZvaWQgMCE9PXImJihNKHQsZSxyKSxSKHQsbixyKSl9fWZ1bmN0aW9uIEgodCxlLG4scixpKXt2YXIgbz1KKG4scixpLm9wdHMuaG9va3MsaS5maWx0ZXIsaSk7cmV0dXJuIHQuaW5zZXJ0QWZ0ZXIoZSxvKX1mdW5jdGlvbiBKKHQsZSxuLHIsaSl7dmFyIG89W10sYT0hMCxzPSExLGw9dm9pZCAwO3RyeXtmb3IodmFyIHUsYz10W1N5bWJvbC5pdGVyYXRvcl0oKTshKGE9KHU9Yy5uZXh0KCkpLmRvbmUpO2E9ITApe3ZhciBoPXUudmFsdWUsZj1MKGgsZSxuLHIsaSk7ITEhPT1mJiZvLnB1c2goZil9fWNhdGNoKHQpe3M9ITAsbD10fWZpbmFsbHl7dHJ5eyFhJiZjLnJldHVybiYmYy5yZXR1cm4oKX1maW5hbGx5e2lmKHMpdGhyb3cgbH19cmV0dXJuIG99ZnVuY3Rpb24geih0LGUsbixyLGkpe3ZhciBvPUgodCxlLFtuXSxyLGkpO3JldHVybiBvLmxlbmd0aD4wP29bMF06ZX1mdW5jdGlvbiBYKHQsZSxuKXtmb3IoO2UhPT1uOyl7dmFyIHI9ZTtlPWUubmV4dFNpYmxpbmcsdC5yZW1vdmVDaGlsZChyKX19ZnVuY3Rpb24gcSh0LGUpe3p0LnNldCh0LGUpLFl0LnNldChlLHQpfWZ1bmN0aW9uIEYodCl7cmV0dXJuIHp0LmdldCh0KX1mdW5jdGlvbiAkKHQpe3JldHVybiBZdC5nZXQodCl9ZnVuY3Rpb24gRygpe2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBjcnlwdG8mJm51bGwhPWNyeXB0by5nZXRSYW5kb21WYWx1ZSl7dmFyIHQ9bmV3IFVpbnQzMkFycmF5KDEpO3JldHVybiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHQpLHRbMF19aWYoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNyeXB0byYmbnVsbCE9Y3J5cHRvLnJhbmRvbUJ5dGVzKXt2YXIgZT1jcnlwdG8ucmFuZG9tQnl0ZXMoNCk7cmV0dXJuIG5ldyBVaW50MzJBcnJheShlLmJ1ZmZlcilbMF19cmV0dXJuIE1hdGguY2VpbCg0Mjk0OTY3Mjk1Kk1hdGgucmFuZG9tKCkpfWZ1bmN0aW9uIFoodCxlKXtmb3IodmFyIG49dC5fc3RhcnQ7bnVsbCE9PW47KXtpZighMT09PW4uX2RlbGV0ZWQpe2lmKG4uX2xlbmd0aD5lKXJldHVybltuLl9pZC51c2VyLG4uX2lkLmNsb2NrK2VdO2UtPW4uX2xlbmd0aH1uPW4uX3JpZ2h0fXJldHVybltcImVuZG9mXCIsdC5faWQudXNlcix0Ll9pZC5jbG9ja3x8bnVsbCx0Ll9pZC5uYW1lfHxudWxsLHQuX2lkLnR5cGV8fG51bGxdfWZ1bmN0aW9uIFEodCxlKXtpZihcImVuZG9mXCI9PT1lWzBdKXt2YXIgbj12b2lkIDA7bj1udWxsPT09ZVszXT9uZXcgSXQoZVsxXSxlWzJdKTpuZXcgcXQoZVszXSxlWzRdKTtmb3IodmFyIHI9dC5vcy5nZXQobik7bnVsbCE9PXIuX3JlZG9uZTspcj1yLl9yZWRvbmU7cmV0dXJuIG51bGw9PT1yfHxyLmNvbnN0cnVjdG9yPT09anQ/bnVsbDp7dHlwZTpyLG9mZnNldDpyLmxlbmd0aH19Zm9yKHZhciBpPTAsbz10Lm9zLmZpbmROb2RlV2l0aFVwcGVyQm91bmQobmV3IEl0KGVbMF0sZVsxXSkpLnZhbCxhPWVbMV0tby5faWQuY2xvY2s7bnVsbCE9PW8uX3JlZG9uZTspbz1vLl9yZWRvbmU7dmFyIHM9by5fcGFyZW50O2lmKG8uY29uc3RydWN0b3I9PT1qdHx8cy5fZGVsZXRlZClyZXR1cm4gbnVsbDtmb3Ioby5fZGVsZXRlZHx8KGk9YSksbz1vLl9sZWZ0O251bGwhPT1vOylvLl9kZWxldGVkfHwoaSs9by5fbGVuZ3RoKSxvPW8uX2xlZnQ7cmV0dXJue3R5cGU6cyxvZmZzZXQ6aX19ZnVuY3Rpb24gSygpe3ZhciB0PSEwO3JldHVybiBmdW5jdGlvbihlKXtpZih0KXt0PSExO3RyeXtlKCl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX10PSEwfX19ZnVuY3Rpb24gdHQodCl7dmFyIGU9Z2V0U2VsZWN0aW9uKCksbj1lLmJhc2VOb2RlLHI9ZS5iYXNlT2Zmc2V0LGk9ZS5leHRlbnROb2RlLG89ZS5leHRlbnRPZmZzZXQsYT10LmRvbVRvVHlwZS5nZXQobikscz10LmRvbVRvVHlwZS5nZXQoaSk7cmV0dXJuIHZvaWQgMCE9PWEmJnZvaWQgMCE9PXM/e2Zyb206WihhLHIpLHRvOloocyxvKX06bnVsbH1mdW5jdGlvbiBldCh0LGUpe2UmJihRdD1LdCh0KSl9ZnVuY3Rpb24gbnQodCxlKXtudWxsIT09UXQmJmUmJnQucmVzdG9yZVNlbGVjdGlvbihRdCl9ZnVuY3Rpb24gcnQodCl7aWYobnVsbCE9PXQpe3ZhciBlPWdldFNlbGVjdGlvbigpLmFuY2hvck5vZGU7aWYobnVsbCE9ZSl7ZS5ub2RlVHlwZT09PWRvY3VtZW50LlRFWFRfTk9ERSYmKGU9ZS5wYXJlbnRFbGVtZW50KTtyZXR1cm57ZWxlbTplLHRvcDplLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcH19Zm9yKHZhciBuPXQuY2hpbGRyZW4scj0wO3I8bi5sZW5ndGg7cisrKXt2YXIgaT1uW3JdLG89aS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtpZihvLnRvcD49MClyZXR1cm57ZWxlbTppLHRvcDpvLnRvcH19fXJldHVybiBudWxsfWZ1bmN0aW9uIGl0KHQsZSl7aWYobnVsbCE9PWUpe3ZhciBuPWUuZWxlbSxyPWUudG9wLGk9bi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3Asbz10LnNjcm9sbFRvcCtpLXI7bz49MCYmKHQuc2Nyb2xsVG9wPW8pfX1mdW5jdGlvbiBvdCh0KXt2YXIgZT10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgbj1ydChlLnNjcm9sbGluZ0VsZW1lbnQpO3QuZm9yRWFjaChmdW5jdGlvbih0KXt2YXIgbj10LnRhcmdldCxyPWUudHlwZVRvRG9tLmdldChuKTtpZih2b2lkIDAhPT1yJiYhMSE9PXIpaWYobi5jb25zdHJ1Y3Rvcj09PVlYbWxUZXh0KXIubm9kZVZhbHVlPW4udG9TdHJpbmcoKTtlbHNlIGlmKHZvaWQgMCE9PXQuYXR0cmlidXRlc0NoYW5nZWQmJih0LmF0dHJpYnV0ZXNDaGFuZ2VkLmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9bi5nZXRBdHRyaWJ1dGUodCk7dm9pZCAwPT09ZT9yLnJlbW92ZUF0dHJpYnV0ZSh0KTpyLnNldEF0dHJpYnV0ZSh0LGUpfSksdC5jaGlsZExpc3RDaGFuZ2VkJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spKXt2YXIgaT1yLmZpcnN0Q2hpbGQ7bi5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBuPWUudHlwZVRvRG9tLmdldCh0KTtzd2l0Y2gobil7Y2FzZSB2b2lkIDA6dmFyIG89dC50b0RvbShlLm9wdHMuZG9jdW1lbnQsZS5vcHRzLmhvb2tzLGUpO3IuaW5zZXJ0QmVmb3JlKG8saSk7YnJlYWs7Y2FzZSExOmJyZWFrO2RlZmF1bHQ6WChyLGksbiksaT1uLm5leHRTaWJsaW5nfX0pLFgocixpLG51bGwpfX0pLGl0KGUuc2Nyb2xsaW5nRWxlbWVudCxuKX0pfWZ1bmN0aW9uIGF0KHQsZSl7Zm9yKHZhciBuPTAscj0wO248dC5sZW5ndGgmJm48ZS5sZW5ndGgmJnRbbl09PT1lW25dOyluKys7aWYobiE9PXQubGVuZ3RofHxuIT09ZS5sZW5ndGgpZm9yKDtyK248dC5sZW5ndGgmJnIrbjxlLmxlbmd0aCYmdFt0Lmxlbmd0aC1yLTFdPT09ZVtlLmxlbmd0aC1yLTFdOylyKys7cmV0dXJue3BvczpuLHJlbW92ZTp0Lmxlbmd0aC1uLXIsaW5zZXJ0OmUuc2xpY2UobixlLmxlbmd0aC1yKX19ZnVuY3Rpb24gc3QodCxlLG4scil7aWYobnVsbCE9biYmITEhPT1uJiZuLmNvbnN0cnVjdG9yIT09WVhtbEhvb2spe2Zvcih2YXIgaT1uLl95LG89bmV3IFNldCxhPWUuY2hpbGROb2Rlcy5sZW5ndGgtMTthPj0wO2EtLSl7dmFyIHM9dC5kb21Ub1R5cGUuZ2V0KGUuY2hpbGROb2Rlc1thXSk7dm9pZCAwIT09cyYmITEhPT1zJiZvLmFkZChzKX1uLmZvckVhY2goZnVuY3Rpb24oZSl7ITE9PT1vLmhhcyhlKSYmKGUuX2RlbGV0ZShpKSxNKHQsdC50eXBlVG9Eb20uZ2V0KGUpLGUpKX0pO2Zvcih2YXIgbD1lLmNoaWxkTm9kZXMsdT1sLmxlbmd0aCxjPW51bGwsaD1DKG4uX3N0YXJ0KSxmPTA7Zjx1O2YrKyl7dmFyIGQ9bFtmXSxfPXQuZG9tVG9UeXBlLmdldChkKTtpZih2b2lkIDAhPT1fKXtpZighMT09PV8pY29udGludWU7bnVsbCE9PWg/aCE9PV8/KF8uX3BhcmVudCE9PW4/TSh0LGQsXyk6KE0odCxkLF8pLF8uX2RlbGV0ZShpKSksYz16KG4sYyxkLHIsdCkpOihjPWgsaD1DKGguX3JpZ2h0KSk6Yz16KG4sYyxkLHIsdCl9ZWxzZSBjPXoobixjLGQscix0KX19fWZ1bmN0aW9uIGx0KHQsZSl7dmFyIG49dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7bi50eXBlLl95LnRyYW5zYWN0KGZ1bmN0aW9uKCl7dmFyIHI9bmV3IFNldDt0LmZvckVhY2goZnVuY3Rpb24odCl7dmFyIGU9dC50YXJnZXQsaT1uLmRvbVRvVHlwZS5nZXQoZSk7aWYodm9pZCAwPT09aSl7dmFyIG89ZSxhPXZvaWQgMDtkb3tvPW8ucGFyZW50RWxlbWVudCxhPW4uZG9tVG9UeXBlLmdldChvKX13aGlsZSh2b2lkIDA9PT1hJiZudWxsIT09byk7cmV0dXJuIHZvaWQoITEhPT1hJiZ2b2lkIDAhPT1hJiZhLmNvbnN0cnVjdG9yIT09WVhtbEhvb2smJnIuYWRkKG8pKX1pZighMSE9PWkmJmkuY29uc3RydWN0b3IhPT1ZWG1sSG9vaylzd2l0Y2godC50eXBlKXtjYXNlXCJjaGFyYWN0ZXJEYXRhXCI6dmFyIHM9YXQoaS50b1N0cmluZygpLGUubm9kZVZhbHVlKTtpLmRlbGV0ZShzLnBvcyxzLnJlbW92ZSksaS5pbnNlcnQocy5wb3Mscy5pbnNlcnQpO2JyZWFrO2Nhc2VcImF0dHJpYnV0ZXNcIjppZihpLmNvbnN0cnVjdG9yPT09WVhtbEZyYWdtZW50KWJyZWFrO3ZhciBsPXQuYXR0cmlidXRlTmFtZSx1PWUuZ2V0QXR0cmlidXRlKGwpLGM9bmV3IE1hcDtjLnNldChsLHUpLGkuY29uc3RydWN0b3IhPT1ZWG1sRnJhZ21lbnQmJm4uZmlsdGVyKGUubm9kZU5hbWUsYykuc2l6ZT4wJiZpLmdldEF0dHJpYnV0ZShsKSE9PXUmJihudWxsPT11P2kucmVtb3ZlQXR0cmlidXRlKGwpOmkuc2V0QXR0cmlidXRlKGwsdSkpO2JyZWFrO2Nhc2VcImNoaWxkTGlzdFwiOnIuYWRkKHQudGFyZ2V0KX19KTt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD1yW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PXMudmFsdWUsYz1uLmRvbVRvVHlwZS5nZXQodSk7c3Qobix1LGMsZSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19fSl9KX1mdW5jdGlvbiB1dCh0LGUsbil7dmFyIHI9ITEsaT12b2lkIDA7cmV0dXJuIHQudHJhbnNhY3QoZnVuY3Rpb24oKXtmb3IoOyFyJiZuLmxlbmd0aD4wOykhZnVuY3Rpb24oKXtpPW4ucG9wKCksbnVsbCE9PWkuZnJvbVN0YXRlJiYodC5vcy5nZXRJdGVtQ2xlYW5TdGFydChpLmZyb21TdGF0ZSksdC5vcy5nZXRJdGVtQ2xlYW5FbmQoaS50b1N0YXRlKSx0Lm9zLml0ZXJhdGUoaS5mcm9tU3RhdGUsaS50b1N0YXRlLGZ1bmN0aW9uKG4pe2Zvcig7bi5fZGVsZXRlZCYmbnVsbCE9PW4uX3JlZG9uZTspbj1uLl9yZWRvbmU7ITE9PT1uLl9kZWxldGVkJiZQKGUsbikmJihyPSEwLG4uX2RlbGV0ZSh0KSl9KSk7dmFyIG89bmV3IFNldCxhPSEwLHM9ITEsbD12b2lkIDA7dHJ5e2Zvcih2YXIgdSxjPWkuZGVsZXRlZFN0cnVjdHNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoYT0odT1jLm5leHQoKSkuZG9uZSk7YT0hMCl7dmFyIGg9dS52YWx1ZSxmPWguZnJvbSxkPW5ldyBJdChmLnVzZXIsZi5jbG9jaytoLmxlbi0xKTt0Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KGYpLHQub3MuZ2V0SXRlbUNsZWFuRW5kKGQpLHQub3MuaXRlcmF0ZShmLGQsZnVuY3Rpb24obil7UChlLG4pJiZuLl9wYXJlbnQhPT10JiYobi5faWQudXNlciE9PXQudXNlcklEfHxudWxsPT09aS5mcm9tU3RhdGV8fG4uX2lkLmNsb2NrPGkuZnJvbVN0YXRlLmNsb2NrfHxuLl9pZC5jbG9jaz5pLnRvU3RhdGUuY2xvY2spJiZvLmFkZChuKX0pfX1jYXRjaCh0KXtzPSEwLGw9dH1maW5hbGx5e3RyeXshYSYmYy5yZXR1cm4mJmMucmV0dXJuKCl9ZmluYWxseXtpZihzKXRocm93IGx9fW8uZm9yRWFjaChmdW5jdGlvbihlKXt2YXIgbj1lLl9yZWRvKHQsbyk7cj1yfHxufSl9KCl9KSxyJiZpLmJpbmRpbmdJbmZvcy5mb3JFYWNoKGZ1bmN0aW9uKHQsZSl7ZS5fcmVzdG9yZVVuZG9TdGFja0luZm8odCl9KSxyfWZ1bmN0aW9uIGN0KHQsZSl7cmV0dXJuIGU9e2V4cG9ydHM6e319LHQoZSxlLmV4cG9ydHMpLGUuZXhwb3J0c31mdW5jdGlvbiBodCh0KXtpZih0PVN0cmluZyh0KSwhKHQubGVuZ3RoPjEwMCkpe3ZhciBlPS9eKCg/OlxcZCspP1xcLj9cXGQrKSAqKG1pbGxpc2Vjb25kcz98bXNlY3M/fG1zfHNlY29uZHM/fHNlY3M/fHN8bWludXRlcz98bWlucz98bXxob3Vycz98aHJzP3xofGRheXM/fGR8eWVhcnM/fHlycz98eSk/JC9pLmV4ZWModCk7aWYoZSl7dmFyIG49cGFyc2VGbG9hdChlWzFdKTtzd2l0Y2goKGVbMl18fFwibXNcIikudG9Mb3dlckNhc2UoKSl7Y2FzZVwieWVhcnNcIjpjYXNlXCJ5ZWFyXCI6Y2FzZVwieXJzXCI6Y2FzZVwieXJcIjpjYXNlXCJ5XCI6cmV0dXJuIG4qc2U7Y2FzZVwiZGF5c1wiOmNhc2VcImRheVwiOmNhc2VcImRcIjpyZXR1cm4gbiphZTtjYXNlXCJob3Vyc1wiOmNhc2VcImhvdXJcIjpjYXNlXCJocnNcIjpjYXNlXCJoclwiOmNhc2VcImhcIjpyZXR1cm4gbipvZTtjYXNlXCJtaW51dGVzXCI6Y2FzZVwibWludXRlXCI6Y2FzZVwibWluc1wiOmNhc2VcIm1pblwiOmNhc2VcIm1cIjpyZXR1cm4gbippZTtjYXNlXCJzZWNvbmRzXCI6Y2FzZVwic2Vjb25kXCI6Y2FzZVwic2Vjc1wiOmNhc2VcInNlY1wiOmNhc2VcInNcIjpyZXR1cm4gbipyZTtjYXNlXCJtaWxsaXNlY29uZHNcIjpjYXNlXCJtaWxsaXNlY29uZFwiOmNhc2VcIm1zZWNzXCI6Y2FzZVwibXNlY1wiOmNhc2VcIm1zXCI6cmV0dXJuIG47ZGVmYXVsdDpyZXR1cm59fX19ZnVuY3Rpb24gZnQodCl7cmV0dXJuIHQ+PWFlP01hdGgucm91bmQodC9hZSkrXCJkXCI6dD49b2U/TWF0aC5yb3VuZCh0L29lKStcImhcIjp0Pj1pZT9NYXRoLnJvdW5kKHQvaWUpK1wibVwiOnQ+PXJlP01hdGgucm91bmQodC9yZSkrXCJzXCI6dCtcIm1zXCJ9ZnVuY3Rpb24gZHQodCl7cmV0dXJuIF90KHQsYWUsXCJkYXlcIil8fF90KHQsb2UsXCJob3VyXCIpfHxfdCh0LGllLFwibWludXRlXCIpfHxfdCh0LHJlLFwic2Vjb25kXCIpfHx0K1wiIG1zXCJ9ZnVuY3Rpb24gX3QodCxlLG4pe2lmKCEodDxlKSlyZXR1cm4gdDwxLjUqZT9NYXRoLmZsb29yKHQvZSkrXCIgXCIrbjpNYXRoLmNlaWwodC9lKStcIiBcIituK1wic1wifWZ1bmN0aW9uIHZ0KHQsZSl7dC50cmFuc2FjdChmdW5jdGlvbigpe3IodCxlKSxzKHQsZSl9KX1mdW5jdGlvbiBwdCh0KXt2YXIgZT1uZXcgTHQ7cmV0dXJuIGModCxlLG5ldyBNYXApLGEodCxlKSxlfWZ1bmN0aW9uIHl0KCl7dmFyIHQ9bmV3IEx0O3JldHVybiB0LndyaXRlVWludDMyKDApLHtsZW46MCxidWZmZXI6dH19ZnVuY3Rpb24gZ3QoKXt2YXIgdD10aGlzO3RoaXMuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXt2YXIgZT10LnRhcmdldCxuPXQudHlwZSxyPVoobixlLnNlbGVjdGlvblN0YXJ0KSxpPVoobixlLnNlbGVjdGlvbkVuZCk7ZS52YWx1ZT1uLnRvU3RyaW5nKCk7dmFyIG89UShuLl95LHIpLGE9UShuLl95LGkpO2Uuc2V0U2VsZWN0aW9uUmFuZ2UobyxhKX0pfWZ1bmN0aW9uIG10KCl7dmFyIHQ9dGhpczt0aGlzLl9tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dmFyIGU9YXQodC50eXBlLnRvU3RyaW5nKCksdC50YXJnZXQudmFsdWUpO3QudHlwZS5kZWxldGUoZS5wb3MsZS5yZW1vdmUpLHQudHlwZS5pbnNlcnQoZS5wb3MsZS5pbnNlcnQpfSl9ZnVuY3Rpb24ga3QodCl7dmFyIGU9dGhpcy50YXJnZXQ7ZS51cGRhdGUoXCJ5anNcIiksdGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UudXBkYXRlQ29udGVudHModC5kZWx0YSxcInlqc1wiKSxlLnVwZGF0ZShcInlqc1wiKX0pfWZ1bmN0aW9uIGJ0KHQpe3ZhciBlPXRoaXM7dGhpcy5fbXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UudHlwZS5hcHBseURlbHRhKHQub3BzKX0pfXZhciB3dD1cImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJlwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wuaXRlcmF0b3I/ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0fTpmdW5jdGlvbih0KXtyZXR1cm4gdCYmXCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZ0LmNvbnN0cnVjdG9yPT09U3ltYm9sJiZ0IT09U3ltYm9sLnByb3RvdHlwZT9cInN5bWJvbFwiOnR5cGVvZiB0fSxTdD1mdW5jdGlvbih0LGUpe2lmKCEodCBpbnN0YW5jZW9mIGUpKXRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIil9LE90PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCh0LGUpe2Zvcih2YXIgbj0wO248ZS5sZW5ndGg7bisrKXt2YXIgcj1lW25dO3IuZW51bWVyYWJsZT1yLmVudW1lcmFibGV8fCExLHIuY29uZmlndXJhYmxlPSEwLFwidmFsdWVcImluIHImJihyLndyaXRhYmxlPSEwKSxPYmplY3QuZGVmaW5lUHJvcGVydHkodCxyLmtleSxyKX19cmV0dXJuIGZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gbiYmdChlLnByb3RvdHlwZSxuKSxyJiZ0KGUsciksZX19KCksRXQ9ZnVuY3Rpb24gdChlLG4scil7bnVsbD09PWUmJihlPUZ1bmN0aW9uLnByb3RvdHlwZSk7dmFyIGk9T2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihlLG4pO2lmKHZvaWQgMD09PWkpe3ZhciBvPU9iamVjdC5nZXRQcm90b3R5cGVPZihlKTtyZXR1cm4gbnVsbD09PW8/dm9pZCAwOnQobyxuLHIpfWlmKFwidmFsdWVcImluIGkpcmV0dXJuIGkudmFsdWU7dmFyIGE9aS5nZXQ7aWYodm9pZCAwIT09YSlyZXR1cm4gYS5jYWxsKHIpfSxVdD1mdW5jdGlvbih0LGUpe2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGUmJm51bGwhPT1lKXRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiK3R5cGVvZiBlKTt0LnByb3RvdHlwZT1PYmplY3QuY3JlYXRlKGUmJmUucHJvdG90eXBlLHtjb25zdHJ1Y3Rvcjp7dmFsdWU6dCxlbnVtZXJhYmxlOiExLHdyaXRhYmxlOiEwLGNvbmZpZ3VyYWJsZTohMH19KSxlJiYoT2JqZWN0LnNldFByb3RvdHlwZU9mP09iamVjdC5zZXRQcm90b3R5cGVPZih0LGUpOnQuX19wcm90b19fPWUpfSxUdD1mdW5jdGlvbih0LGUpe2lmKCF0KXRocm93IG5ldyBSZWZlcmVuY2VFcnJvcihcInRoaXMgaGFzbid0IGJlZW4gaW5pdGlhbGlzZWQgLSBzdXBlcigpIGhhc24ndCBiZWVuIGNhbGxlZFwiKTtyZXR1cm4hZXx8XCJvYmplY3RcIiE9dHlwZW9mIGUmJlwiZnVuY3Rpb25cIiE9dHlwZW9mIGU/dDplfSxCdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQodCxlKXt2YXIgbj1bXSxyPSEwLGk9ITEsbz12b2lkIDA7dHJ5e2Zvcih2YXIgYSxzPXRbU3ltYm9sLml0ZXJhdG9yXSgpOyEocj0oYT1zLm5leHQoKSkuZG9uZSkmJihuLnB1c2goYS52YWx1ZSksIWV8fG4ubGVuZ3RoIT09ZSk7cj0hMCk7fWNhdGNoKHQpe2k9ITAsbz10fWZpbmFsbHl7dHJ5eyFyJiZzLnJldHVybiYmcy5yZXR1cm4oKX1maW5hbGx5e2lmKGkpdGhyb3cgb319cmV0dXJuIG59cmV0dXJuIGZ1bmN0aW9uKGUsbil7aWYoQXJyYXkuaXNBcnJheShlKSlyZXR1cm4gZTtpZihTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGUpKXJldHVybiB0KGUsbik7dGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2VcIil9fSgpLEF0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0KXtTdCh0aGlzLGUpLHRoaXMudmFsPXQsdGhpcy5jb2xvcj0hMCx0aGlzLl9sZWZ0PW51bGwsdGhpcy5fcmlnaHQ9bnVsbCx0aGlzLl9wYXJlbnQ9bnVsbH1yZXR1cm4gT3QoZSxbe2tleTpcImlzUmVkXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb2xvcn19LHtrZXk6XCJpc0JsYWNrXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5jb2xvcn19LHtrZXk6XCJyZWRkZW5cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbG9yPSEwLHRoaXN9fSx7a2V5OlwiYmxhY2tlblwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuY29sb3I9ITEsdGhpc319LHtrZXk6XCJyb3RhdGVMZWZ0XCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5wYXJlbnQscj10aGlzLnJpZ2h0LGk9dGhpcy5yaWdodC5sZWZ0O3IubGVmdD10aGlzLHRoaXMucmlnaHQ9aSx0KGUsbixyLHRoaXMpfX0se2tleTpcIm5leHRcIix2YWx1ZTpmdW5jdGlvbigpe2lmKG51bGwhPT10aGlzLnJpZ2h0KXtmb3IodmFyIHQ9dGhpcy5yaWdodDtudWxsIT09dC5sZWZ0Oyl0PXQubGVmdDtyZXR1cm4gdH1mb3IodmFyIGU9dGhpcztudWxsIT09ZS5wYXJlbnQmJmUhPT1lLnBhcmVudC5sZWZ0OyllPWUucGFyZW50O3JldHVybiBlLnBhcmVudH19LHtrZXk6XCJwcmV2XCIsdmFsdWU6ZnVuY3Rpb24oKXtpZihudWxsIT09dGhpcy5sZWZ0KXtmb3IodmFyIHQ9dGhpcy5sZWZ0O251bGwhPT10LnJpZ2h0Oyl0PXQucmlnaHQ7cmV0dXJuIHR9Zm9yKHZhciBlPXRoaXM7bnVsbCE9PWUucGFyZW50JiZlIT09ZS5wYXJlbnQucmlnaHQ7KWU9ZS5wYXJlbnQ7cmV0dXJuIGUucGFyZW50fX0se2tleTpcInJvdGF0ZVJpZ2h0XCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5wYXJlbnQscj10aGlzLmxlZnQsaT10aGlzLmxlZnQucmlnaHQ7ci5yaWdodD10aGlzLHRoaXMubGVmdD1pLHQoZSxuLHIsdGhpcyl9fSx7a2V5OlwiZ2V0VW5jbGVcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudD09PXRoaXMucGFyZW50LnBhcmVudC5sZWZ0P3RoaXMucGFyZW50LnBhcmVudC5yaWdodDp0aGlzLnBhcmVudC5wYXJlbnQubGVmdH19LHtrZXk6XCJncmFuZHBhcmVudFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudC5wYXJlbnR9fSx7a2V5OlwicGFyZW50XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX3BhcmVudH19LHtrZXk6XCJzaWJsaW5nXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXM9PT10aGlzLnBhcmVudC5sZWZ0P3RoaXMucGFyZW50LnJpZ2h0OnRoaXMucGFyZW50LmxlZnR9fSx7a2V5OlwibGVmdFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLl9sZWZ0fSxzZXQ6ZnVuY3Rpb24odCl7bnVsbCE9PXQmJih0Ll9wYXJlbnQ9dGhpcyksdGhpcy5fbGVmdD10fX0se2tleTpcInJpZ2h0XCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuX3JpZ2h0fSxzZXQ6ZnVuY3Rpb24odCl7bnVsbCE9PXQmJih0Ll9wYXJlbnQ9dGhpcyksdGhpcy5fcmlnaHQ9dH19XSksZX0oKSx4dD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtTdCh0aGlzLHQpLHRoaXMucm9vdD1udWxsLHRoaXMubGVuZ3RoPTB9cmV0dXJuIE90KHQsW3trZXk6XCJmaW5kTmV4dFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQuY2xvbmUoKTtyZXR1cm4gZS5jbG9jays9MSx0aGlzLmZpbmRXaXRoTG93ZXJCb3VuZChlKX19LHtrZXk6XCJmaW5kUHJldlwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXQuY2xvbmUoKTtyZXR1cm4gZS5jbG9jay09MSx0aGlzLmZpbmRXaXRoVXBwZXJCb3VuZChlKX19LHtrZXk6XCJmaW5kTm9kZVdpdGhMb3dlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5yb290O2lmKG51bGw9PT1lKXJldHVybiBudWxsO2Zvcig7OylpZihudWxsPT09dHx8dC5sZXNzVGhhbihlLnZhbC5faWQpJiZudWxsIT09ZS5sZWZ0KWU9ZS5sZWZ0O2Vsc2V7aWYobnVsbD09PXR8fCFlLnZhbC5faWQubGVzc1RoYW4odCkpcmV0dXJuIGU7aWYobnVsbD09PWUucmlnaHQpcmV0dXJuIGUubmV4dCgpO2U9ZS5yaWdodH19fSx7a2V5OlwiZmluZE5vZGVXaXRoVXBwZXJCb3VuZFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHZvaWQgMD09PXQpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3QgZGVmaW5lIGZyb20hXCIpO3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspaWYobnVsbCE9PXQmJiFlLnZhbC5faWQubGVzc1RoYW4odCl8fG51bGw9PT1lLnJpZ2h0KXtpZihudWxsPT09dHx8IXQubGVzc1RoYW4oZS52YWwuX2lkKSlyZXR1cm4gZTtpZihudWxsPT09ZS5sZWZ0KXJldHVybiBlLnByZXYoKTtlPWUubGVmdH1lbHNlIGU9ZS5yaWdodH19LHtrZXk6XCJmaW5kU21hbGxlc3ROb2RlXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9dGhpcy5yb290O251bGwhPXQmJm51bGwhPXQubGVmdDspdD10LmxlZnQ7cmV0dXJuIHR9fSx7a2V5OlwiZmluZFdpdGhMb3dlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKHQpO3JldHVybiBudWxsPT1lP251bGw6ZS52YWx9fSx7a2V5OlwiZmluZFdpdGhVcHBlckJvdW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZVdpdGhVcHBlckJvdW5kKHQpO3JldHVybiBudWxsPT1lP251bGw6ZS52YWx9fSx7a2V5OlwiaXRlcmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgcjtmb3Iocj1udWxsPT09dD90aGlzLmZpbmRTbWFsbGVzdE5vZGUoKTp0aGlzLmZpbmROb2RlV2l0aExvd2VyQm91bmQodCk7bnVsbCE9PXImJihudWxsPT09ZXx8ci52YWwuX2lkLmxlc3NUaGFuKGUpfHxyLnZhbC5faWQuZXF1YWxzKGUpKTspbihyLnZhbCkscj1yLm5leHQoKX19LHtrZXk6XCJmaW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZSh0KTtyZXR1cm4gbnVsbCE9PWU/ZS52YWw6bnVsbH19LHtrZXk6XCJmaW5kTm9kZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMucm9vdDtpZihudWxsPT09ZSlyZXR1cm4gbnVsbDtmb3IoOzspe2lmKG51bGw9PT1lKXJldHVybiBudWxsO2lmKHQubGVzc1RoYW4oZS52YWwuX2lkKSllPWUubGVmdDtlbHNle2lmKCFlLnZhbC5faWQubGVzc1RoYW4odCkpcmV0dXJuIGU7ZT1lLnJpZ2h0fX19fSx7a2V5OlwiZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5maW5kTm9kZSh0KTtpZihudWxsIT1lKXtpZih0aGlzLmxlbmd0aC0tLG51bGwhPT1lLmxlZnQmJm51bGwhPT1lLnJpZ2h0KXtmb3IodmFyIG49ZS5sZWZ0O251bGwhPT1uLnJpZ2h0OyluPW4ucmlnaHQ7ZS52YWw9bi52YWwsZT1ufXZhciByLGk9ZS5sZWZ0fHxlLnJpZ2h0O2lmKG51bGw9PT1pPyhyPSEwLGk9bmV3IEF0KG51bGwpLGkuYmxhY2tlbigpLGUucmlnaHQ9aSk6cj0hMSxudWxsPT09ZS5wYXJlbnQpcmV0dXJuIHZvaWQocj90aGlzLnJvb3Q9bnVsbDoodGhpcy5yb290PWksaS5ibGFja2VuKCksaS5fcGFyZW50PW51bGwpKTtpZihlLnBhcmVudC5sZWZ0PT09ZSllLnBhcmVudC5sZWZ0PWk7ZWxzZXtpZihlLnBhcmVudC5yaWdodCE9PWUpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSFcIik7ZS5wYXJlbnQucmlnaHQ9aX1pZihlLmlzQmxhY2soKSYmKGkuaXNSZWQoKT9pLmJsYWNrZW4oKTp0aGlzLl9maXhEZWxldGUoaSkpLHRoaXMucm9vdC5ibGFja2VuKCkscilpZihpLnBhcmVudC5sZWZ0PT09aSlpLnBhcmVudC5sZWZ0PW51bGw7ZWxzZXtpZihpLnBhcmVudC5yaWdodCE9PWkpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSAjM1wiKTtpLnBhcmVudC5yaWdodD1udWxsfX19fSx7a2V5OlwiX2ZpeERlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUodCl7cmV0dXJuIG51bGw9PT10fHx0LmlzQmxhY2soKX1mdW5jdGlvbiBuKHQpe3JldHVybiBudWxsIT09dCYmdC5pc1JlZCgpfWlmKG51bGwhPT10LnBhcmVudCl7dmFyIHI9dC5zaWJsaW5nO2lmKG4ocikpe2lmKHQucGFyZW50LnJlZGRlbigpLHIuYmxhY2tlbigpLHQ9PT10LnBhcmVudC5sZWZ0KXQucGFyZW50LnJvdGF0ZUxlZnQodGhpcyk7ZWxzZXtpZih0IT09dC5wYXJlbnQucmlnaHQpdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSAjMlwiKTt0LnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKX1yPXQuc2libGluZ310LnBhcmVudC5pc0JsYWNrKCkmJnIuaXNCbGFjaygpJiZlKHIubGVmdCkmJmUoci5yaWdodCk/KHIucmVkZGVuKCksdGhpcy5fZml4RGVsZXRlKHQucGFyZW50KSk6dC5wYXJlbnQuaXNSZWQoKSYmci5pc0JsYWNrKCkmJmUoci5sZWZ0KSYmZShyLnJpZ2h0KT8oci5yZWRkZW4oKSx0LnBhcmVudC5ibGFja2VuKCkpOih0PT09dC5wYXJlbnQubGVmdCYmci5pc0JsYWNrKCkmJm4oci5sZWZ0KSYmZShyLnJpZ2h0KT8oci5yZWRkZW4oKSxyLmxlZnQuYmxhY2tlbigpLHIucm90YXRlUmlnaHQodGhpcykscj10LnNpYmxpbmcpOnQ9PT10LnBhcmVudC5yaWdodCYmci5pc0JsYWNrKCkmJm4oci5yaWdodCkmJmUoci5sZWZ0KSYmKHIucmVkZGVuKCksci5yaWdodC5ibGFja2VuKCksci5yb3RhdGVMZWZ0KHRoaXMpLHI9dC5zaWJsaW5nKSxyLmNvbG9yPXQucGFyZW50LmNvbG9yLHQucGFyZW50LmJsYWNrZW4oKSx0PT09dC5wYXJlbnQubGVmdD8oci5yaWdodC5ibGFja2VuKCksdC5wYXJlbnQucm90YXRlTGVmdCh0aGlzKSk6KHIubGVmdC5ibGFja2VuKCksdC5wYXJlbnQucm90YXRlUmlnaHQodGhpcykpKX19fSx7a2V5OlwicHV0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9bmV3IEF0KHQpO2lmKG51bGwhPT10aGlzLnJvb3Qpe2Zvcih2YXIgbj10aGlzLnJvb3Q7OylpZihlLnZhbC5faWQubGVzc1RoYW4obi52YWwuX2lkKSl7aWYobnVsbD09PW4ubGVmdCl7bi5sZWZ0PWU7YnJlYWt9bj1uLmxlZnR9ZWxzZXtpZighbi52YWwuX2lkLmxlc3NUaGFuKGUudmFsLl9pZCkpcmV0dXJuIG4udmFsPWUudmFsLG47aWYobnVsbD09PW4ucmlnaHQpe24ucmlnaHQ9ZTticmVha31uPW4ucmlnaHR9dGhpcy5fZml4SW5zZXJ0KGUpfWVsc2UgdGhpcy5yb290PWU7cmV0dXJuIHRoaXMubGVuZ3RoKyssdGhpcy5yb290LmJsYWNrZW4oKSxlfX0se2tleTpcIl9maXhJbnNlcnRcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsPT09dC5wYXJlbnQpcmV0dXJuIHZvaWQgdC5ibGFja2VuKCk7aWYoIXQucGFyZW50LmlzQmxhY2soKSl7dmFyIGU9dC5nZXRVbmNsZSgpO251bGwhPT1lJiZlLmlzUmVkKCk/KHQucGFyZW50LmJsYWNrZW4oKSxlLmJsYWNrZW4oKSx0LmdyYW5kcGFyZW50LnJlZGRlbigpLHRoaXMuX2ZpeEluc2VydCh0LmdyYW5kcGFyZW50KSk6KHQ9PT10LnBhcmVudC5yaWdodCYmdC5wYXJlbnQ9PT10LmdyYW5kcGFyZW50LmxlZnQ/KHQucGFyZW50LnJvdGF0ZUxlZnQodGhpcyksdD10LmxlZnQpOnQ9PT10LnBhcmVudC5sZWZ0JiZ0LnBhcmVudD09PXQuZ3JhbmRwYXJlbnQucmlnaHQmJih0LnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKSx0PXQucmlnaHQpLHQucGFyZW50LmJsYWNrZW4oKSx0LmdyYW5kcGFyZW50LnJlZGRlbigpLHQ9PT10LnBhcmVudC5sZWZ0P3QuZ3JhbmRwYXJlbnQucm90YXRlUmlnaHQodGhpcyk6dC5ncmFuZHBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpKX19fV0pLHR9KCksSXQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7U3QodGhpcyx0KSx0aGlzLnVzZXI9ZSx0aGlzLmNsb2NrPW59cmV0dXJuIE90KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0KHRoaXMudXNlcix0aGlzLmNsb2NrKX19LHtrZXk6XCJlcXVhbHNcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbnVsbCE9PXQmJnQudXNlcj09PXRoaXMudXNlciYmdC5jbG9jaz09PXRoaXMuY2xvY2t9fSx7a2V5OlwibGVzc1RoYW5cIix2YWx1ZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5jb25zdHJ1Y3Rvcj09PXQmJih0aGlzLnVzZXI8ZS51c2VyfHx0aGlzLnVzZXI9PT1lLnVzZXImJnRoaXMuY2xvY2s8ZS5jbG9jayl9fV0pLHR9KCksRHQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbixyKXtTdCh0aGlzLHQpLHRoaXMuX2lkPWUsdGhpcy5sZW49bix0aGlzLmdjPXJ9cmV0dXJuIE90KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0KHRoaXMuX2lkLHRoaXMubGVuLHRoaXMuZ2MpfX1dKSx0fSgpLFB0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIGUoKXtyZXR1cm4gU3QodGhpcyxlKSxUdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBVdChlLHQpLE90KGUsW3trZXk6XCJsb2dUYWJsZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9W107dGhpcy5pdGVyYXRlKG51bGwsbnVsbCxmdW5jdGlvbihlKXt0LnB1c2goe3VzZXI6ZS5faWQudXNlcixjbG9jazplLl9pZC5jbG9jayxsZW46ZS5sZW4sZ2M6ZS5nY30pfSksY29uc29sZS50YWJsZSh0KX19LHtrZXk6XCJpc0RlbGV0ZWRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmRXaXRoVXBwZXJCb3VuZCh0KTtyZXR1cm4gbnVsbCE9PWUmJmUuX2lkLnVzZXI9PT10LnVzZXImJnQuY2xvY2s8ZS5faWQuY2xvY2srZS5sZW59fSx7a2V5OlwibWFya1wiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXtpZigwIT09ZSl7dmFyIHI9dGhpcy5maW5kV2l0aFVwcGVyQm91bmQobmV3IEl0KHQudXNlcix0LmNsb2NrLTEpKTtudWxsIT09ciYmci5faWQudXNlcj09PXQudXNlciYmci5faWQuY2xvY2s8dC5jbG9jayYmdC5jbG9jazxyLl9pZC5jbG9jaytyLmxlbiYmKHQuY2xvY2srZTxyLl9pZC5jbG9jaytyLmxlbiYmdGhpcy5wdXQobmV3IER0KG5ldyBJdCh0LnVzZXIsdC5jbG9jaytlKSxyLl9pZC5jbG9jaytyLmxlbi10LmNsb2NrLWUsci5nYykpLHIubGVuPXQuY2xvY2stci5faWQuY2xvY2spO3ZhciBpPW5ldyBJdCh0LnVzZXIsdC5jbG9jaytlLTEpLG89dGhpcy5maW5kV2l0aFVwcGVyQm91bmQoaSk7aWYobnVsbCE9PW8mJm8uX2lkLnVzZXI9PT10LnVzZXImJm8uX2lkLmNsb2NrPHQuY2xvY2srZSYmdC5jbG9jazw9by5faWQuY2xvY2smJnQuY2xvY2srZTxvLl9pZC5jbG9jaytvLmxlbil7dmFyIGE9dC5jbG9jaytlLW8uX2lkLmNsb2NrO28uX2lkPW5ldyBJdChvLl9pZC51c2VyLG8uX2lkLmNsb2NrK2EpLG8ubGVuLT1hfXZhciBzPVtdO3RoaXMuaXRlcmF0ZSh0LGksZnVuY3Rpb24odCl7cy5wdXNoKHQuX2lkKX0pO2Zvcih2YXIgbD1zLmxlbmd0aC0xO2w+PTA7bC0tKXRoaXMuZGVsZXRlKHNbbF0pO3ZhciB1PW5ldyBEdCh0LGUsbik7bnVsbCE9PXImJnIuX2lkLnVzZXI9PT10LnVzZXImJnIuX2lkLmNsb2NrK3IubGVuPT09dC5jbG9jayYmci5nYz09PW4mJihyLmxlbis9ZSx1PXIpO3ZhciBjPXRoaXMuZmluZChuZXcgSXQodC51c2VyLHQuY2xvY2srZSkpO251bGwhPT1jJiZjLl9pZC51c2VyPT09dC51c2VyJiZ0LmNsb2NrK2U9PT1jLl9pZC5jbG9jayYmbj09PWMuZ2MmJih1Lmxlbis9Yy5sZW4sdGhpcy5kZWxldGUoYy5faWQpKSxyIT09dSYmdGhpcy5wdXQodSl9fX0se2tleTpcIm1hcmtEZWxldGVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLm1hcmsodCxlLCExKX19XSksZX0oeHQpLE50PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtpZihTdCh0aGlzLHQpLGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcil0aGlzLnVpbnQ4YXJyPW5ldyBVaW50OEFycmF5KGUpO2Vsc2V7aWYoIShlIGluc3RhbmNlb2YgVWludDhBcnJheXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIEJ1ZmZlciYmZSBpbnN0YW5jZW9mIEJ1ZmZlcikpdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSFcIik7dGhpcy51aW50OGFycj1lfXRoaXMucG9zPTB9cmV0dXJuIE90KHQsW3trZXk6XCJjbG9uZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOnRoaXMucG9zLG49bmV3IHQodGhpcy51aW50OGFycik7cmV0dXJuIG4ucG9zPWUsbn19LHtrZXk6XCJza2lwOFwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5wb3MrK319LHtrZXk6XCJyZWFkVWludDhcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdfX0se2tleTpcInJlYWRVaW50MzJcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMudWludDhhcnJbdGhpcy5wb3NdKyh0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKzFdPDw4KSsodGhpcy51aW50OGFyclt0aGlzLnBvcysyXTw8MTYpKyh0aGlzLnVpbnQ4YXJyW3RoaXMucG9zKzNdPDwyNCk7cmV0dXJuIHRoaXMucG9zKz00LHR9fSx7a2V5OlwicGVla1VpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy51aW50OGFyclt0aGlzLnBvc119fSx7a2V5OlwicmVhZFZhclVpbnRcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD0wLGU9MDs7KXt2YXIgbj10aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdO2lmKHR8PSgxMjcmbik8PGUsZSs9NyxuPDEyOClyZXR1cm4gdD4+PjA7aWYoZT4zNSl0aHJvdyBuZXcgRXJyb3IoXCJJbnRlZ2VyIG91dCBvZiByYW5nZSFcIil9fX0se2tleTpcInJlYWRWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe2Zvcih2YXIgdD10aGlzLnJlYWRWYXJVaW50KCksZT1uZXcgQXJyYXkodCksbj0wO248dDtuKyspZVtuXT10aGlzLnVpbnQ4YXJyW3RoaXMucG9zKytdO3ZhciByPWUubWFwKGZ1bmN0aW9uKHQpe3JldHVybiBTdHJpbmcuZnJvbUNvZGVQb2ludCh0KX0pLmpvaW4oXCJcIik7cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUocikpfX0se2tleTpcInBlZWtWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMucG9zLGU9dGhpcy5yZWFkVmFyU3RyaW5nKCk7cmV0dXJuIHRoaXMucG9zPXQsZX19LHtrZXk6XCJyZWFkSURcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMucmVhZFZhclVpbnQoKTtpZih0PT09WHQpe3ZhciBlPW5ldyBxdCh0aGlzLnJlYWRWYXJTdHJpbmcoKSxudWxsKTtyZXR1cm4gZS50eXBlPXRoaXMucmVhZFZhclVpbnQoKSxlfXJldHVybiBuZXcgSXQodCx0aGlzLnJlYWRWYXJVaW50KCkpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnVpbnQ4YXJyLmxlbmd0aH19XSksdH0oKSxqdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtTdCh0aGlzLHQpLHRoaXMuX2lkPW51bGwsdGhpcy5fbGVuZ3RoPTB9cmV0dXJuIE90KHQsW3trZXk6XCJfaW50ZWdyYXRlXCIsdmFsdWU6ZnVuY3Rpb24oZSl7dmFyIG49dGhpcy5faWQscj1lLnNzLmdldFN0YXRlKG4udXNlcik7bi5jbG9jaz09PXImJmUuc3Muc2V0U3RhdGUobi51c2VyLG4uY2xvY2srdGhpcy5fbGVuZ3RoKSxlLmRzLm1hcmsodGhpcy5faWQsdGhpcy5fbGVuZ3RoLCEwKTt2YXIgaT1lLm9zLnB1dCh0aGlzKSxvPWkucHJldigpLnZhbDtudWxsIT09byYmby5jb25zdHJ1Y3Rvcj09PXQmJm8uX2lkLnVzZXI9PT1pLnZhbC5faWQudXNlciYmby5faWQuY2xvY2srby5fbGVuZ3RoPT09aS52YWwuX2lkLmNsb2NrJiYoby5fbGVuZ3RoKz1pLnZhbC5fbGVuZ3RoLGUub3MuZGVsZXRlKGkudmFsLl9pZCksaT1vKSxpLnZhbCYmKGk9aS52YWwpO3ZhciBhPWUub3MuZmluZE5leHQoaS5faWQpO251bGwhPT1hJiZhLmNvbnN0cnVjdG9yPT09dCYmYS5faWQudXNlcj09PWkuX2lkLnVzZXImJmEuX2lkLmNsb2NrPT09aS5faWQuY2xvY2sraS5fbGVuZ3RoJiYoaS5fbGVuZ3RoKz1hLl9sZW5ndGgsZS5vcy5kZWxldGUoYS5faWQpKSxuLnVzZXIhPT1YdCYmKG51bGw9PT1lLmNvbm5lY3Rvcnx8IWUuY29ubmVjdG9yLl9mb3J3YXJkQXBwbGllZFN0cnVjdHMmJm4udXNlciE9PWUudXNlcklEfHxlLmNvbm5lY3Rvci5icm9hZGNhc3RTdHJ1Y3QodGhpcyksbnVsbCE9PWUucGVyc2lzdGVuY2UmJmUucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdChlLHRoaXMpKX19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXt0LndyaXRlVWludDgoJCh0aGlzLmNvbnN0cnVjdG9yKSksdC53cml0ZUlEKHRoaXMuX2lkKSx0LndyaXRlVmFyVWludCh0aGlzLl9sZW5ndGgpfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1lLnJlYWRJRCgpO3RoaXMuX2lkPW4sdGhpcy5fbGVuZ3RoPWUucmVhZFZhclVpbnQoKTt2YXIgcj1bXTtyZXR1cm4gdC5zcy5nZXRTdGF0ZShuLnVzZXIpPG4uY2xvY2smJnIucHVzaChuZXcgSXQobi51c2VyLG4uY2xvY2stMSkpLHJ9fSx7a2V5OlwiX3NwbGl0QXRcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzfX0se2tleTpcIl9jbG9uZVBhcnRpYWxcIix2YWx1ZTpmdW5jdGlvbihlKXt2YXIgbj1uZXcgdDtyZXR1cm4gbi5faWQ9bmV3IEl0KHRoaXMuX2lkLnVzZXIsdGhpcy5faWQuY2xvY2srZSksbi5fbGVuZ3RoPXRoaXMuX2xlbmd0aC1lLG59fSx7a2V5OlwiX2RlbGV0ZWRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4hMH19XSksdH0oKSxWdD1mdW5jdGlvbiB0KGUsbixyKXtTdCh0aGlzLHQpLHRoaXMuZGVjb2Rlcj1lLHRoaXMubWlzc2luZz1uLmxlbmd0aCx0aGlzLnN0cnVjdD1yfSxMdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtTdCh0aGlzLHQpLHRoaXMuZGF0YT1bXX1yZXR1cm4gT3QodCxbe2tleTpcImNyZWF0ZUJ1ZmZlclwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIFVpbnQ4QXJyYXkuZnJvbSh0aGlzLmRhdGEpLmJ1ZmZlcn19LHtrZXk6XCJ3cml0ZVVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5kYXRhLnB1c2goMjU1JnQpfX0se2tleTpcInNldFVpbnQ4XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt0aGlzLmRhdGFbdF09MjU1JmV9fSx7a2V5Olwid3JpdGVVaW50MTZcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmRhdGEucHVzaCgyNTUmdCx0Pj4+OCYyNTUpfX0se2tleTpcInNldFVpbnQxNlwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5kYXRhW3RdPTI1NSZlLHRoaXMuZGF0YVt0KzFdPWU+Pj44JjI1NX19LHtrZXk6XCJ3cml0ZVVpbnQzMlwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcih2YXIgZT0wO2U8NDtlKyspdGhpcy5kYXRhLnB1c2goMjU1JnQpLHQ+Pj49OH19LHtrZXk6XCJzZXRVaW50MzJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2Zvcih2YXIgbj0wO248NDtuKyspdGhpcy5kYXRhW3Qrbl09MjU1JmUsZT4+Pj04fX0se2tleTpcIndyaXRlVmFyVWludFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2Zvcig7dD49MTI4Oyl0aGlzLmRhdGEucHVzaCgxMjh8MTI3JnQpLHQ+Pj49Nzt0aGlzLmRhdGEucHVzaCgxMjcmdCl9fSx7a2V5Olwid3JpdGVWYXJTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT11bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQodCkpLG49ZS5zcGxpdChcIlwiKS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHQuY29kZVBvaW50QXQoKX0pLHI9bi5sZW5ndGg7dGhpcy53cml0ZVZhclVpbnQocik7Zm9yKHZhciBpPTA7aTxyO2krKyl0aGlzLmRhdGEucHVzaChuW2ldKX19LHtrZXk6XCJ3cml0ZUlEXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dC51c2VyO3RoaXMud3JpdGVWYXJVaW50KGUpLGUhPT1YdD90aGlzLndyaXRlVmFyVWludCh0LmNsb2NrKToodGhpcy53cml0ZVZhclN0cmluZyh0Lm5hbWUpLHRoaXMud3JpdGVWYXJVaW50KHQudHlwZSkpfX0se2tleTpcImxlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRhdGEubGVuZ3RofX0se2tleTpcInBvc1wiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRhdGEubGVuZ3RofX1dKSx0fSgpLERlbGV0ZT1mdW5jdGlvbigpe2Z1bmN0aW9uIERlbGV0ZSgpe1N0KHRoaXMsRGVsZXRlKSx0aGlzLl90YXJnZXQ9bnVsbCx0aGlzLl9sZW5ndGg9bnVsbH1yZXR1cm4gT3QoRGVsZXRlLFt7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPWUucmVhZElEKClcbjtyZXR1cm4gdGhpcy5fdGFyZ2V0SUQ9bix0aGlzLl9sZW5ndGg9ZS5yZWFkVmFyVWludCgpLG51bGw9PT10Lm9zLmdldEl0ZW0obik/W25dOltdfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Qud3JpdGVVaW50OCgkKHRoaXMuY29uc3RydWN0b3IpKSx0LndyaXRlSUQodGhpcy5fdGFyZ2V0SUQpLHQud3JpdGVWYXJVaW50KHRoaXMuX2xlbmd0aCl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKGFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdJiZhcmd1bWVudHNbMV0pbnVsbCE9PXQuY29ubmVjdG9yJiZ0LmNvbm5lY3Rvci5icm9hZGNhc3RTdHJ1Y3QodGhpcyk7ZWxzZXt2YXIgZT10aGlzLl90YXJnZXRJRDtnKHQsZS51c2VyLGUuY2xvY2ssdGhpcy5fbGVuZ3RoLCExKX1udWxsIT09dC5wZXJzaXN0ZW5jZSYmdC5wZXJzaXN0ZW5jZS5zYXZlU3RydWN0KHQsdGhpcyl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuXCJEZWxldGUgLSB0YXJnZXQ6IFwiK3AodGhpcy5fdGFyZ2V0SUQpK1wiLCBsZW46IFwiK3RoaXMuX2xlbmd0aH19XSksRGVsZXRlfSgpLEN0PWZ1bmN0aW9uIHQoZSl7U3QodGhpcyx0KSx0aGlzLnk9ZSx0aGlzLm5ld1R5cGVzPW5ldyBTZXQsdGhpcy5jaGFuZ2VkVHlwZXM9bmV3IE1hcCx0aGlzLmRlbGV0ZWRTdHJ1Y3RzPW5ldyBTZXQsdGhpcy5iZWZvcmVTdGF0ZT1uZXcgTWFwLHRoaXMuY2hhbmdlZFBhcmVudFR5cGVzPW5ldyBNYXB9LEl0ZW09ZnVuY3Rpb24oKXtmdW5jdGlvbiBJdGVtKCl7U3QodGhpcyxJdGVtKSx0aGlzLl9pZD1udWxsLHRoaXMuX29yaWdpbj1udWxsLHRoaXMuX2xlZnQ9bnVsbCx0aGlzLl9yaWdodD1udWxsLHRoaXMuX3JpZ2h0X29yaWdpbj1udWxsLHRoaXMuX3BhcmVudD1udWxsLHRoaXMuX3BhcmVudFN1Yj1udWxsLHRoaXMuX2RlbGV0ZWQ9ITEsdGhpcy5fcmVkb25lPW51bGx9cmV0dXJuIE90KEl0ZW0sW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yfX0se2tleTpcIl9yZWRvXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZihudWxsIT09dGhpcy5fcmVkb25lKXJldHVybiB0aGlzLl9yZWRvbmU7dmFyIG49dGhpcy5fY29weSgpLHI9dm9pZCAwLGk9dm9pZCAwO251bGw9PT10aGlzLl9wYXJlbnRTdWI/KHI9dGhpcy5fbGVmdCxpPXRoaXMpOihyPW51bGwsaT10aGlzLl9wYXJlbnQuX21hcC5nZXQodGhpcy5fcGFyZW50U3ViKSxpLl9kZWxldGUodCkpO3ZhciBvPXRoaXMuX3BhcmVudDtpZighKCEwIT09by5fZGVsZXRlZHx8bnVsbCE9PW8uX3JlZG9uZXx8ZS5oYXMobykmJm8uX3JlZG8odCxlKSkpcmV0dXJuITE7aWYobnVsbCE9PW8uX3JlZG9uZSl7Zm9yKG89by5fcmVkb25lO251bGwhPT1yOyl7aWYobnVsbCE9PXIuX3JlZG9uZSYmci5fcmVkb25lLl9wYXJlbnQ9PT1vKXtyPXIuX3JlZG9uZTticmVha31yPXIuX2xlZnR9Zm9yKDtudWxsIT09aTspbnVsbCE9PWkuX3JlZG9uZSYmaS5fcmVkb25lLl9wYXJlbnQ9PT1vJiYoaT1pLl9yZWRvbmUpLGk9aS5fcmlnaHR9cmV0dXJuIG4uX29yaWdpbj1yLG4uX2xlZnQ9cixuLl9yaWdodD1pLG4uX3JpZ2h0X29yaWdpbj1pLG4uX3BhcmVudD1vLG4uX3BhcmVudFN1Yj10aGlzLl9wYXJlbnRTdWIsbi5faW50ZWdyYXRlKHQpLHRoaXMuX3JlZG9uZT1uLCEwfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtyZXR1cm4gMD09PWU/dGhpczp0aGlzLl9yaWdodH19LHtrZXk6XCJfZGVsZXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9IShhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSl8fGFyZ3VtZW50c1sxXTtpZighdGhpcy5fZGVsZXRlZCl7dGhpcy5fZGVsZXRlZD0hMCx0LmRzLm1hcmsodGhpcy5faWQsdGhpcy5fbGVuZ3RoLCExKTt2YXIgbj1uZXcgRGVsZXRlO24uX3RhcmdldElEPXRoaXMuX2lkLG4uX2xlbmd0aD10aGlzLl9sZW5ndGgsZT9uLl9pbnRlZ3JhdGUodCwhMCk6bnVsbCE9PXQucGVyc2lzdGVuY2UmJnQucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdCh0LG4pLG0odCx0aGlzLl9wYXJlbnQsdGhpcy5fcGFyZW50U3ViKSx0Ll90cmFuc2FjdGlvbi5kZWxldGVkU3RydWN0cy5hZGQodGhpcyl9fX0se2tleTpcIl9nY0NoaWxkcmVuXCIsdmFsdWU6ZnVuY3Rpb24odCl7fX0se2tleTpcIl9nY1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBqdDtlLl9pZD10aGlzLl9pZCxlLl9sZW5ndGg9dGhpcy5fbGVuZ3RoLHQub3MuZGVsZXRlKHRoaXMuX2lkKSxlLl9pbnRlZ3JhdGUodCl9fSx7a2V5OlwiX2JlZm9yZUNoYW5nZVwiLHZhbHVlOmZ1bmN0aW9uKCl7fX0se2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXt0Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5hZGQodGhpcyk7dmFyIGU9dGhpcy5fcGFyZW50LG49dGhpcy5faWQscj1udWxsPT09bj90LnVzZXJJRDpuLnVzZXIsaT10LnNzLmdldFN0YXRlKHIpO2lmKG51bGw9PT1uKXRoaXMuX2lkPXQuc3MuZ2V0TmV4dElEKHRoaXMuX2xlbmd0aCk7ZWxzZSBpZihuLnVzZXI9PT1YdCk7ZWxzZXtpZihuLmNsb2NrPGkpcmV0dXJuW107aWYobi5jbG9jayE9PWkpdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG5vdCBhcHBseSB5ZXQhXCIpO3Quc3Muc2V0U3RhdGUobi51c2VyLGkrdGhpcy5fbGVuZ3RoKX1lLl9kZWxldGVkfHx0Ll90cmFuc2FjdGlvbi5jaGFuZ2VkVHlwZXMuaGFzKGUpfHx0Ll90cmFuc2FjdGlvbi5uZXdUeXBlcy5oYXMoZSl8fHRoaXMuX3BhcmVudC5fYmVmb3JlQ2hhbmdlKCk7dmFyIG89dm9pZCAwO289bnVsbCE9PXRoaXMuX2xlZnQ/dGhpcy5fbGVmdC5fcmlnaHQ6bnVsbCE9PXRoaXMuX3BhcmVudFN1Yj90aGlzLl9wYXJlbnQuX21hcC5nZXQodGhpcy5fcGFyZW50U3ViKXx8bnVsbDp0aGlzLl9wYXJlbnQuX3N0YXJ0O2Zvcih2YXIgYT1uZXcgU2V0LHM9bmV3IFNldDtudWxsIT09byYmbyE9PXRoaXMuX3JpZ2h0Oyl7aWYocy5hZGQobyksYS5hZGQobyksdGhpcy5fb3JpZ2luPT09by5fb3JpZ2luKW8uX2lkLnVzZXI8dGhpcy5faWQudXNlciYmKHRoaXMuX2xlZnQ9byxhLmNsZWFyKCkpO2Vsc2V7aWYoIXMuaGFzKG8uX29yaWdpbikpYnJlYWs7YS5oYXMoby5fb3JpZ2luKXx8KHRoaXMuX2xlZnQ9byxhLmNsZWFyKCkpfW89by5fcmlnaHR9dmFyIGw9dGhpcy5fcGFyZW50U3ViO2lmKG51bGw9PT10aGlzLl9sZWZ0KXt2YXIgdT12b2lkIDA7aWYobnVsbCE9PWwpe3ZhciBjPWUuX21hcDt1PWMuZ2V0KGwpfHxudWxsLGMuc2V0KGwsdGhpcyl9ZWxzZSB1PWUuX3N0YXJ0LGUuX3N0YXJ0PXRoaXM7dGhpcy5fcmlnaHQ9dSxudWxsIT09dSYmKHUuX2xlZnQ9dGhpcyl9ZWxzZXt2YXIgaD10aGlzLl9sZWZ0LGY9aC5fcmlnaHQ7dGhpcy5fcmlnaHQ9ZixoLl9yaWdodD10aGlzLG51bGwhPT1mJiYoZi5fbGVmdD10aGlzKX1lLl9kZWxldGVkJiZ0aGlzLl9kZWxldGUodCwhMSksdC5vcy5wdXQodGhpcyksbSh0LGUsbCksdGhpcy5faWQudXNlciE9PVh0JiYobnVsbD09PXQuY29ubmVjdG9yfHwhdC5jb25uZWN0b3IuX2ZvcndhcmRBcHBsaWVkU3RydWN0cyYmdGhpcy5faWQudXNlciE9PXQudXNlcklEfHx0LmNvbm5lY3Rvci5icm9hZGNhc3RTdHJ1Y3QodGhpcyksbnVsbCE9PXQucGVyc2lzdGVuY2UmJnQucGVyc2lzdGVuY2Uuc2F2ZVN0cnVjdCh0LHRoaXMpKX19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXt0LndyaXRlVWludDgoJCh0aGlzLmNvbnN0cnVjdG9yKSk7dmFyIGU9MDtudWxsIT09dGhpcy5fb3JpZ2luJiYoZSs9MSksbnVsbCE9PXRoaXMuX3JpZ2h0X29yaWdpbiYmKGUrPTQpLG51bGwhPT10aGlzLl9wYXJlbnRTdWImJihlKz04KSx0LndyaXRlVWludDgoZSksdC53cml0ZUlEKHRoaXMuX2lkKSwxJmUmJnQud3JpdGVJRCh0aGlzLl9vcmlnaW4uX2xhc3RJZCksNCZlJiZ0LndyaXRlSUQodGhpcy5fcmlnaHRfb3JpZ2luLl9pZCksMD09KDUmZSkmJnQud3JpdGVJRCh0aGlzLl9wYXJlbnQuX2lkKSw4JmUmJnQud3JpdGVWYXJTdHJpbmcoSlNPTi5zdHJpbmdpZnkodGhpcy5fcGFyZW50U3ViKSl9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPVtdLHI9ZS5yZWFkVWludDgoKSxpPWUucmVhZElEKCk7aWYodGhpcy5faWQ9aSwxJnIpe3ZhciBvPWUucmVhZElEKCksYT10Lm9zLmdldEl0ZW1DbGVhbkVuZChvKTtudWxsPT09YT9uLnB1c2gobyk6KHRoaXMuX29yaWdpbj1hLHRoaXMuX2xlZnQ9dGhpcy5fb3JpZ2luKX1pZig0JnIpe3ZhciBzPWUucmVhZElEKCksbD10Lm9zLmdldEl0ZW1DbGVhblN0YXJ0KHMpO251bGw9PT1sP24ucHVzaChzKToodGhpcy5fcmlnaHQ9bCx0aGlzLl9yaWdodF9vcmlnaW49bCl9aWYoMD09KDUmcikpe3ZhciB1PWUucmVhZElEKCk7aWYobnVsbD09PXRoaXMuX3BhcmVudCl7dmFyIGM9dm9pZCAwO2M9dS5jb25zdHJ1Y3Rvcj09PXF0P3Qub3MuZ2V0KHUpOnQub3MuZ2V0SXRlbSh1KSxudWxsPT09Yz9uLnB1c2godSk6dGhpcy5fcGFyZW50PWN9fWVsc2UgbnVsbD09PXRoaXMuX3BhcmVudCYmKG51bGwhPT10aGlzLl9vcmlnaW4/dGhpcy5fb3JpZ2luLmNvbnN0cnVjdG9yPT09anQ/dGhpcy5fcGFyZW50PXRoaXMuX29yaWdpbjp0aGlzLl9wYXJlbnQ9dGhpcy5fb3JpZ2luLl9wYXJlbnQ6bnVsbCE9PXRoaXMuX3JpZ2h0X29yaWdpbiYmKHRoaXMuX3JpZ2h0X29yaWdpbi5jb25zdHJ1Y3Rvcj09PWp0P3RoaXMuX3BhcmVudD10aGlzLl9yaWdodF9vcmlnaW46dGhpcy5fcGFyZW50PXRoaXMuX3JpZ2h0X29yaWdpbi5fcGFyZW50KSk7cmV0dXJuIDgmciYmKHRoaXMuX3BhcmVudFN1Yj1KU09OLnBhcnNlKGUucmVhZFZhclN0cmluZygpKSksdC5zcy5nZXRTdGF0ZShpLnVzZXIpPGkuY2xvY2smJm4ucHVzaChuZXcgSXQoaS51c2VyLGkuY2xvY2stMSkpLG59fSx7a2V5OlwiX2xhc3RJZFwiLGdldDpmdW5jdGlvbigpe3JldHVybiBuZXcgSXQodGhpcy5faWQudXNlcix0aGlzLl9pZC5jbG9jayt0aGlzLl9sZW5ndGgtMSl9fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiAxfX0se2tleTpcIl9jb3VudGFibGVcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4hMH19XSksSXRlbX0oKSxNdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtTdCh0aGlzLHQpLHRoaXMuZXZlbnRMaXN0ZW5lcnM9W119cmV0dXJuIE90KHQsW3trZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmV2ZW50TGlzdGVuZXJzPW51bGx9fSx7a2V5OlwiYWRkRXZlbnRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuZXZlbnRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJyZW1vdmVFdmVudExpc3RlbmVyXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5ldmVudExpc3RlbmVycz10aGlzLmV2ZW50TGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm4gdCE9PWV9KX19LHtrZXk6XCJyZW1vdmVBbGxFdmVudExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5ldmVudExpc3RlbmVycz1bXX19LHtrZXk6XCJjYWxsRXZlbnRMaXN0ZW5lcnNcIix2YWx1ZTpmdW5jdGlvbih0LGUpe2Zvcih2YXIgbj0wO248dGhpcy5ldmVudExpc3RlbmVycy5sZW5ndGg7bisrKXRyeXsoMCx0aGlzLmV2ZW50TGlzdGVuZXJzW25dKShlKX1jYXRjaCh0KXtjb25zb2xlLmVycm9yKHQpfX19XSksdH0oKSxUeXBlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFR5cGUoKXtTdCh0aGlzLFR5cGUpO3ZhciB0PVR0KHRoaXMsKFR5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoVHlwZSkpLmNhbGwodGhpcykpO3JldHVybiB0Ll9tYXA9bmV3IE1hcCx0Ll9zdGFydD1udWxsLHQuX3k9bnVsbCx0Ll9ldmVudEhhbmRsZXI9bmV3IE10LHQuX2RlZXBFdmVudEhhbmRsZXI9bmV3IE10LHR9cmV0dXJuIFV0KFR5cGUsdCksT3QoVHlwZSxbe2tleTpcImdldFBhdGhUb1wiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHQ9PT10aGlzKXJldHVybltdO2Zvcih2YXIgZT1bXSxuPXRoaXMuX3k7dCE9PXRoaXMmJnQhPT1uOyl7dmFyIHI9dC5fcGFyZW50O2lmKG51bGwhPT10Ll9wYXJlbnRTdWIpZS51bnNoaWZ0KHQuX3BhcmVudFN1Yik7ZWxzZXt2YXIgaT0hMCxvPSExLGE9dm9pZCAwO3RyeXtmb3IodmFyIHMsbD1yW1N5bWJvbC5pdGVyYXRvcl0oKTshKGk9KHM9bC5uZXh0KCkpLmRvbmUpO2k9ITApe3ZhciB1PUJ0KHMudmFsdWUsMiksYz11WzBdO2lmKHVbMV09PT10KXtlLnVuc2hpZnQoYyk7YnJlYWt9fX1jYXRjaCh0KXtvPSEwLGE9dH1maW5hbGx5e3RyeXshaSYmbC5yZXR1cm4mJmwucmV0dXJuKCl9ZmluYWxseXtpZihvKXRocm93IGF9fX10PXJ9aWYodCE9PXRoaXMpdGhyb3cgbmV3IEVycm9yKFwiVGhlIHR5cGUgaXMgbm90IGEgY2hpbGQgb2YgdGhpcyBub2RlXCIpO3JldHVybiBlfX0se2tleTpcIl9jYWxsRXZlbnRIYW5kbGVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10LmNoYW5nZWRQYXJlbnRUeXBlczt0aGlzLl9ldmVudEhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKHQsZSk7Zm9yKHZhciByPXRoaXM7ciE9PXRoaXMuX3k7KXt2YXIgaT1uLmdldChyKTt2b2lkIDA9PT1pJiYoaT1bXSxuLnNldChyLGkpKSxpLnB1c2goZSkscj1yLl9wYXJlbnR9fX0se2tleTpcIl90cmFuc2FjdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX3k7bnVsbCE9PWU/ZS50cmFuc2FjdCh0KTp0KGUpfX0se2tleTpcIm9ic2VydmVcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9ldmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJvYnNlcnZlRGVlcFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2RlZXBFdmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJ1bm9ic2VydmVcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLl9ldmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcih0KX19LHtrZXk6XCJ1bm9ic2VydmVEZWVwXCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy5fZGVlcEV2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKHQpfX0se2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtFdChUeXBlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlLnByb3RvdHlwZSksXCJfaW50ZWdyYXRlXCIsdGhpcykuY2FsbCh0aGlzLHQpLHRoaXMuX3k9dDt2YXIgZT10aGlzLl9zdGFydDtudWxsIT09ZSYmKHRoaXMuX3N0YXJ0PW51bGwsYih0LGUpKTt2YXIgbj10aGlzLl9tYXA7dGhpcy5fbWFwPW5ldyBNYXA7dmFyIHI9ITAsaT0hMSxvPXZvaWQgMDt0cnl7Zm9yKHZhciBhLHM9bi52YWx1ZXMoKVtTeW1ib2wuaXRlcmF0b3JdKCk7IShyPShhPXMubmV4dCgpKS5kb25lKTtyPSEwKXtiKHQsYS52YWx1ZSl9fWNhdGNoKHQpe2k9ITAsbz10fWZpbmFsbHl7dHJ5eyFyJiZzLnJldHVybiYmcy5yZXR1cm4oKX1maW5hbGx5e2lmKGkpdGhyb3cgb319fX0se2tleTpcIl9nY0NoaWxkcmVuXCIsdmFsdWU6ZnVuY3Rpb24odCl7dyh0LHRoaXMuX3N0YXJ0KSx0aGlzLl9zdGFydD1udWxsLHRoaXMuX21hcC5mb3JFYWNoKGZ1bmN0aW9uKGUpe3codCxlKX0pLHRoaXMuX21hcD1uZXcgTWFwfX0se2tleTpcIl9nY1wiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMuX2djQ2hpbGRyZW4odCksRXQoVHlwZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoVHlwZS5wcm90b3R5cGUpLFwiX2djXCIsdGhpcykuY2FsbCh0aGlzLHQpfX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dm9pZCAwIT09biYmdC5nY0VuYWJsZWR8fChuPSExPT09dC5faGFzVW5kb01hbmFnZXImJnQuZ2NFbmFibGVkKSxFdChUeXBlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihUeXBlLnByb3RvdHlwZSksXCJfZGVsZXRlXCIsdGhpcykuY2FsbCh0aGlzLHQsZSxuKSx0Ll90cmFuc2FjdGlvbi5jaGFuZ2VkVHlwZXMuZGVsZXRlKHRoaXMpO3ZhciByPSEwLGk9ITEsbz12b2lkIDA7dHJ5e2Zvcih2YXIgYSxzPXRoaXMuX21hcC52YWx1ZXMoKVtTeW1ib2wuaXRlcmF0b3JdKCk7IShyPShhPXMubmV4dCgpKS5kb25lKTtyPSEwKXt2YXIgbD1hLnZhbHVlO2wgaW5zdGFuY2VvZiBJdGVtJiYhbC5fZGVsZXRlZCYmbC5fZGVsZXRlKHQsITEsbil9fWNhdGNoKHQpe2k9ITAsbz10fWZpbmFsbHl7dHJ5eyFyJiZzLnJldHVybiYmcy5yZXR1cm4oKX1maW5hbGx5e2lmKGkpdGhyb3cgb319Zm9yKHZhciB1PXRoaXMuX3N0YXJ0O251bGwhPT11Oyl1Ll9kZWxldGVkfHx1Ll9kZWxldGUodCwhMSxuKSx1PXUuX3JpZ2h0O24mJnRoaXMuX2djQ2hpbGRyZW4odCl9fV0pLFR5cGV9KEl0ZW0pLEl0ZW1KU09OPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIEl0ZW1KU09OKCl7U3QodGhpcyxJdGVtSlNPTik7dmFyIHQ9VHQodGhpcywoSXRlbUpTT04uX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbUpTT04pKS5jYWxsKHRoaXMpKTtyZXR1cm4gdC5fY29udGVudD1udWxsLHR9cmV0dXJuIFV0KEl0ZW1KU09OLHQpLE90KEl0ZW1KU09OLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PUV0KEl0ZW1KU09OLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTi5wcm90b3R5cGUpLFwiX2NvcHlcIix0aGlzKS5jYWxsKHRoaXMpO3JldHVybiB0Ll9jb250ZW50PXRoaXMuX2NvbnRlbnQsdH19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49RXQoSXRlbUpTT04ucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1KU09OLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LGUpLHI9ZS5yZWFkVmFyVWludCgpO3RoaXMuX2NvbnRlbnQ9bmV3IEFycmF5KHIpO2Zvcih2YXIgaT0wO2k8cjtpKyspe3ZhciBvPWUucmVhZFZhclN0cmluZygpLGE9dm9pZCAwO2E9XCJ1bmRlZmluZWRcIj09PW8/dm9pZCAwOkpTT04ucGFyc2UobyksdGhpcy5fY29udGVudFtpXT1hfXJldHVybiBufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0V0KEl0ZW1KU09OLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtSlNPTi5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpO3ZhciBlPXRoaXMuX2NvbnRlbnQubGVuZ3RoO3Qud3JpdGVWYXJVaW50KGUpO2Zvcih2YXIgbj0wO248ZTtuKyspe3ZhciByPXZvaWQgMCxpPXRoaXMuX2NvbnRlbnRbbl07cj12b2lkIDA9PT1pP1widW5kZWZpbmVkXCI6SlNPTi5zdHJpbmdpZnkoaSksdC53cml0ZVZhclN0cmluZyhyKX19fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJJdGVtSlNPTlwiLHRoaXMsXCJjb250ZW50OlwiK0pTT04uc3RyaW5naWZ5KHRoaXMuX2NvbnRlbnQpKX19LHtrZXk6XCJfc3BsaXRBdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7aWYoMD09PWUpcmV0dXJuIHRoaXM7aWYoZT49dGhpcy5fbGVuZ3RoKXJldHVybiB0aGlzLl9yaWdodDt2YXIgbj1uZXcgSXRlbUpTT047cmV0dXJuIG4uX2NvbnRlbnQ9dGhpcy5fY29udGVudC5zcGxpY2UoZSksayh0LHRoaXMsbixlKSxufX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY29udGVudC5sZW5ndGh9fV0pLEl0ZW1KU09OfShJdGVtKSxJdGVtU3RyaW5nPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIEl0ZW1TdHJpbmcoKXtTdCh0aGlzLEl0ZW1TdHJpbmcpO3ZhciB0PVR0KHRoaXMsKEl0ZW1TdHJpbmcuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoSXRlbVN0cmluZykpLmNhbGwodGhpcykpO3JldHVybiB0Ll9jb250ZW50PW51bGwsdH1yZXR1cm4gVXQoSXRlbVN0cmluZyx0KSxPdChJdGVtU3RyaW5nLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PUV0KEl0ZW1TdHJpbmcucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5fY29udGVudD10aGlzLl9jb250ZW50LHR9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPUV0KEl0ZW1TdHJpbmcucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKEl0ZW1TdHJpbmcucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSk7cmV0dXJuIHRoaXMuX2NvbnRlbnQ9ZS5yZWFkVmFyU3RyaW5nKCksbn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtFdChJdGVtU3RyaW5nLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihJdGVtU3RyaW5nLnByb3RvdHlwZSksXCJfdG9CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCksdC53cml0ZVZhclN0cmluZyh0aGlzLl9jb250ZW50KX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1TdHJpbmdcIix0aGlzLCdjb250ZW50OlwiJyt0aGlzLl9jb250ZW50KydcIicpfX0se2tleTpcIl9zcGxpdEF0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZigwPT09ZSlyZXR1cm4gdGhpcztpZihlPj10aGlzLl9sZW5ndGgpcmV0dXJuIHRoaXMuX3JpZ2h0O3ZhciBuPW5ldyBJdGVtU3RyaW5nO3JldHVybiBuLl9jb250ZW50PXRoaXMuX2NvbnRlbnQuc2xpY2UoZSksdGhpcy5fY29udGVudD10aGlzLl9jb250ZW50LnNsaWNlKDAsZSksayh0LHRoaXMsbixlKSxufX0se2tleTpcIl9sZW5ndGhcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY29udGVudC5sZW5ndGh9fV0pLEl0ZW1TdHJpbmd9KEl0ZW0pLFlFdmVudD1mdW5jdGlvbigpe2Z1bmN0aW9uIFlFdmVudCh0KXtTdCh0aGlzLFlFdmVudCksdGhpcy50YXJnZXQ9dCx0aGlzLmN1cnJlbnRUYXJnZXQ9dH1yZXR1cm4gT3QoWUV2ZW50LFt7a2V5OlwicGF0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmN1cnJlbnRUYXJnZXQuZ2V0UGF0aFRvKHRoaXMudGFyZ2V0KX19XSksWUV2ZW50fSgpLFlBcnJheUV2ZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlBcnJheUV2ZW50KHQsZSxuKXtTdCh0aGlzLFlBcnJheUV2ZW50KTt2YXIgcj1UdCh0aGlzLChZQXJyYXlFdmVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZQXJyYXlFdmVudCkpLmNhbGwodGhpcyx0KSk7cmV0dXJuIHIucmVtb3RlPWUsci5fdHJhbnNhY3Rpb249bixyLl9hZGRlZEVsZW1lbnRzPW51bGwsci5fcmVtb3ZlZEVsZW1lbnRzPW51bGwscn1yZXR1cm4gVXQoWUFycmF5RXZlbnQsdCksT3QoWUFycmF5RXZlbnQsW3trZXk6XCJhZGRlZEVsZW1lbnRzXCIsZ2V0OmZ1bmN0aW9uKCl7aWYobnVsbD09PXRoaXMuX2FkZGVkRWxlbWVudHMpe3ZhciB0PXRoaXMudGFyZ2V0LGU9dGhpcy5fdHJhbnNhY3Rpb24sbj1uZXcgU2V0O2UubmV3VHlwZXMuZm9yRWFjaChmdW5jdGlvbihyKXtyLl9wYXJlbnQhPT10fHxlLmRlbGV0ZWRTdHJ1Y3RzLmhhcyhyKXx8bi5hZGQocil9KSx0aGlzLl9hZGRlZEVsZW1lbnRzPW59cmV0dXJuIHRoaXMuX2FkZGVkRWxlbWVudHN9fSx7a2V5OlwicmVtb3ZlZEVsZW1lbnRzXCIsZ2V0OmZ1bmN0aW9uKCl7aWYobnVsbD09PXRoaXMuX3JlbW92ZWRFbGVtZW50cyl7dmFyIHQ9dGhpcy50YXJnZXQsZT10aGlzLl90cmFuc2FjdGlvbixuPW5ldyBTZXQ7ZS5kZWxldGVkU3RydWN0cy5mb3JFYWNoKGZ1bmN0aW9uKHIpe3IuX3BhcmVudCE9PXR8fGUubmV3VHlwZXMuaGFzKHIpfHxuLmFkZChyKX0pLHRoaXMuX3JlbW92ZWRFbGVtZW50cz1ufXJldHVybiB0aGlzLl9yZW1vdmVkRWxlbWVudHN9fV0pLFlBcnJheUV2ZW50fShZRXZlbnQpLFlBcnJheT1mdW5jdGlvbih0KXtmdW5jdGlvbiBZQXJyYXkoKXtyZXR1cm4gU3QodGhpcyxZQXJyYXkpLFR0KHRoaXMsKFlBcnJheS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZQXJyYXkpKS5hcHBseSh0aGlzLGFyZ3VtZW50cykpfXJldHVybiBVdChZQXJyYXksdCksT3QoWUFycmF5LFt7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IFlBcnJheUV2ZW50KHRoaXMsbix0KSl9fSx7a2V5OlwiZ2V0XCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPXRoaXMuX3N0YXJ0O251bGwhPT1lOyl7aWYoIWUuX2RlbGV0ZWQmJmUuX2NvdW50YWJsZSl7aWYodDxlLl9sZW5ndGgpcmV0dXJuIGUuY29uc3RydWN0b3I9PT1JdGVtSlNPTnx8ZS5jb25zdHJ1Y3Rvcj09PUl0ZW1TdHJpbmc/ZS5fY29udGVudFt0XTplO3QtPWUuX2xlbmd0aH1lPWUuX3JpZ2h0fX19LHtrZXk6XCJ0b0FycmF5XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIHR9KX19LHtrZXk6XCJ0b0pTT05cIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbih0KXtyZXR1cm4gdCBpbnN0YW5jZW9mIFR5cGU/bnVsbCE9PXQudG9KU09OP3QudG9KU09OKCk6dC50b1N0cmluZygpOnR9KX19LHtrZXk6XCJtYXBcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49W107cmV0dXJuIHRoaXMuZm9yRWFjaChmdW5jdGlvbihyLGkpe24ucHVzaCh0KHIsaSxlKSl9KSxufX0se2tleTpcImZvckVhY2hcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9MCxuPXRoaXMuX3N0YXJ0O251bGwhPT1uOyl7aWYoIW4uX2RlbGV0ZWQmJm4uX2NvdW50YWJsZSlpZihuIGluc3RhbmNlb2YgVHlwZSl0KG4sZSsrLHRoaXMpO2Vsc2UgZm9yKHZhciByPW4uX2NvbnRlbnQsaT1yLmxlbmd0aCxvPTA7bzxpO28rKyllKyssdChyW29dLGUsdGhpcyk7bj1uLl9yaWdodH19fSx7a2V5OlN5bWJvbC5pdGVyYXRvcix2YWx1ZTpmdW5jdGlvbigpe3JldHVybntuZXh0OmZ1bmN0aW9uKCl7Zm9yKDtudWxsIT09dGhpcy5faXRlbSYmKHRoaXMuX2l0ZW0uX2RlbGV0ZWR8fHRoaXMuX2l0ZW0uX2xlbmd0aDw9dGhpcy5faXRlbUVsZW1lbnQpOyl0aGlzLl9pdGVtPXRoaXMuX2l0ZW0uX3JpZ2h0LHRoaXMuX2l0ZW1FbGVtZW50PTA7aWYobnVsbD09PXRoaXMuX2l0ZW0pcmV0dXJue2RvbmU6ITB9O3ZhciB0PXZvaWQgMDtyZXR1cm4gdD10aGlzLl9pdGVtIGluc3RhbmNlb2YgVHlwZT90aGlzLl9pdGVtOnRoaXMuX2l0ZW0uX2NvbnRlbnRbdGhpcy5faXRlbUVsZW1lbnQrK10se3ZhbHVlOnQsZG9uZTohMX19LF9pdGVtOnRoaXMuX3N0YXJ0LF9pdGVtRWxlbWVudDowLF9jb3VudDowfX19LHtrZXk6XCJkZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOjE7aWYodGhpcy5feS50cmFuc2FjdChmdW5jdGlvbigpe2Zvcih2YXIgcj1lLl9zdGFydCxpPTA7bnVsbCE9PXImJm4+MDspe2lmKCFyLl9kZWxldGVkJiZyLl9jb3VudGFibGUpaWYoaTw9dCYmdDxpK3IuX2xlbmd0aCl7dmFyIG89dC1pO3I9ci5fc3BsaXRBdChlLl95LG8pLHIuX3NwbGl0QXQoZS5feSxuKSxuLT1yLl9sZW5ndGgsci5fZGVsZXRlKGUuX3kpLGkrPW99ZWxzZSBpKz1yLl9sZW5ndGg7cj1yLl9yaWdodH19KSxuPjApdGhyb3cgbmV3IEVycm9yKFwiRGVsZXRlIGV4Y2VlZHMgdGhlIHJhbmdlIG9mIHRoZSBZQXJyYXlcIil9fSx7a2V5OlwiaW5zZXJ0QWZ0ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXM7cmV0dXJuIHRoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKHIpe3ZhciBpPXZvaWQgMDtpPW51bGw9PT10P24uX3N0YXJ0OnQuX3JpZ2h0O2Zvcih2YXIgbz1udWxsLGE9MDthPGUubGVuZ3RoO2ErKyl7dmFyIHM9ZVthXTtcImZ1bmN0aW9uXCI9PXR5cGVvZiBzJiYocz1uZXcgcykscyBpbnN0YW5jZW9mIFR5cGU/KG51bGwhPT1vJiYobnVsbCE9PXImJm8uX2ludGVncmF0ZShyKSx0PW8sbz1udWxsKSxzLl9vcmlnaW49dCxzLl9sZWZ0PXQscy5fcmlnaHQ9aSxzLl9yaWdodF9vcmlnaW49aSxzLl9wYXJlbnQ9bixudWxsIT09cj9zLl9pbnRlZ3JhdGUocik6bnVsbD09PXQ/bi5fc3RhcnQ9czp0Ll9yaWdodD1zLHQ9cyk6KG51bGw9PT1vJiYobz1uZXcgSXRlbUpTT04sby5fb3JpZ2luPXQsby5fbGVmdD10LG8uX3JpZ2h0PWksby5fcmlnaHRfb3JpZ2luPWksby5fcGFyZW50PW4sby5fY29udGVudD1bXSksby5fY29udGVudC5wdXNoKHMpKX1udWxsIT09byYmKG51bGwhPT1yP28uX2ludGVncmF0ZShyKTpudWxsPT09by5fbGVmdCYmKG4uX3N0YXJ0PW8pKX0pLGV9fSx7a2V5OlwiaW5zZXJ0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKCl7Zm9yKHZhciByPW51bGwsaT1uLl9zdGFydCxvPTAsYT1uLl95O251bGwhPT1pOyl7dmFyIHM9aS5fZGVsZXRlZD8wOmkuX2xlbmd0aC0xO2lmKG88PXQmJnQ8PW8rcyl7dmFyIGw9dC1vO2k9aS5fc3BsaXRBdChhLGwpLHI9aS5fbGVmdCxvKz1sO2JyZWFrfWkuX2RlbGV0ZWR8fChvKz1pLl9sZW5ndGgpLHI9aSxpPWkuX3JpZ2h0fWlmKHQ+byl0aHJvdyBuZXcgRXJyb3IoXCJJbmRleCBleGNlZWRzIGFycmF5IHJhbmdlIVwiKTtuLmluc2VydEFmdGVyKHIsZSl9KX19LHtrZXk6XCJwdXNoXCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPXRoaXMuX3N0YXJ0LG49bnVsbDtudWxsIT09ZTspZS5fZGVsZXRlZHx8KG49ZSksZT1lLl9yaWdodDt0aGlzLmluc2VydEFmdGVyKG4sdCl9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJZQXJyYXlcIix0aGlzLFwic3RhcnQ6XCIrcCh0aGlzLl9zdGFydCkrJ1wiJyl9fSx7a2V5OlwibGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7Zm9yKHZhciB0PTAsZT10aGlzLl9zdGFydDtudWxsIT09ZTspIWUuX2RlbGV0ZWQmJmUuX2NvdW50YWJsZSYmKHQrPWUuX2xlbmd0aCksZT1lLl9yaWdodDtyZXR1cm4gdH19XSksWUFycmF5fShUeXBlKSxZTWFwRXZlbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWU1hcEV2ZW50KHQsZSxuKXtTdCh0aGlzLFlNYXBFdmVudCk7dmFyIHI9VHQodGhpcywoWU1hcEV2ZW50Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlNYXBFdmVudCkpLmNhbGwodGhpcyx0KSk7cmV0dXJuIHIua2V5c0NoYW5nZWQ9ZSxyLnJlbW90ZT1uLHJ9cmV0dXJuIFV0KFlNYXBFdmVudCx0KSxZTWFwRXZlbnR9KFlFdmVudCksWU1hcD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZTWFwKCl7cmV0dXJuIFN0KHRoaXMsWU1hcCksVHQodGhpcywoWU1hcC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZTWFwKSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gVXQoWU1hcCx0KSxPdChZTWFwLFt7a2V5OlwiX2NhbGxPYnNlcnZlclwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt0aGlzLl9jYWxsRXZlbnRIYW5kbGVyKHQsbmV3IFlNYXBFdmVudCh0aGlzLGUsbikpfX0se2tleTpcInRvSlNPTlwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9e30sZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLl9tYXBbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7dmFyIGE9QnQoaS52YWx1ZSwyKSxzPWFbMF0sbD1hWzFdO2lmKCFsLl9kZWxldGVkKXt2YXIgdT12b2lkIDA7dT1sIGluc3RhbmNlb2YgVHlwZT92b2lkIDAhPT1sLnRvSlNPTj9sLnRvSlNPTigpOmwudG9TdHJpbmcoKTpsLl9jb250ZW50WzBdLHRbc109dX19fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19cmV0dXJuIHR9fSx7a2V5Olwia2V5c1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9W10sZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLl9tYXBbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7dmFyIGE9QnQoaS52YWx1ZSwyKSxzPWFbMF07YVsxXS5fZGVsZXRlZHx8dC5wdXNoKHMpfX1jYXRjaCh0KXtuPSEwLHI9dH1maW5hbGx5e3RyeXshZSYmby5yZXR1cm4mJm8ucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IHJ9fXJldHVybiB0fX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7dGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24obil7dmFyIHI9ZS5fbWFwLmdldCh0KTtudWxsIT09biYmdm9pZCAwIT09ciYmci5fZGVsZXRlKG4pfSl9fSx7a2V5Olwic2V0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzO3JldHVybiB0aGlzLl90cmFuc2FjdChmdW5jdGlvbihyKXt2YXIgaT1uLl9tYXAuZ2V0KHQpfHxudWxsO2lmKG51bGwhPT1pKXtpZihpLmNvbnN0cnVjdG9yPT09SXRlbUpTT04mJiFpLl9kZWxldGVkJiZpLl9jb250ZW50WzBdPT09ZSlyZXR1cm4gZTtudWxsIT09ciYmaS5fZGVsZXRlKHIpfXZhciBvPXZvaWQgMDtcImZ1bmN0aW9uXCI9PXR5cGVvZiBlPyhvPW5ldyBlLGU9byk6ZSBpbnN0YW5jZW9mIEl0ZW0/bz1lOihvPW5ldyBJdGVtSlNPTixvLl9jb250ZW50PVtlXSksby5fcmlnaHQ9aSxvLl9yaWdodF9vcmlnaW49aSxvLl9wYXJlbnQ9bixvLl9wYXJlbnRTdWI9dCxudWxsIT09cj9vLl9pbnRlZ3JhdGUocik6bi5fbWFwLnNldCh0LG8pfSksZX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9tYXAuZ2V0KHQpO2lmKHZvaWQgMCE9PWUmJiFlLl9kZWxldGVkKXJldHVybiBlIGluc3RhbmNlb2YgVHlwZT9lOmUuX2NvbnRlbnRbZS5fY29udGVudC5sZW5ndGgtMV19fSx7a2V5OlwiaGFzXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5fbWFwLmdldCh0KTtyZXR1cm4gdm9pZCAwIT09ZSYmIWUuX2RlbGV0ZWR9fSx7a2V5OlwiX2xvZ1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHkoXCJZTWFwXCIsdGhpcyxcIm1hcFNpemU6XCIrdGhpcy5fbWFwLnNpemUpfX1dKSxZTWFwfShUeXBlKSxSdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7U3QodGhpcyxlKTt2YXIgdD1UdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMpKTtyZXR1cm4gdC5lbWJlZD1udWxsLHR9cmV0dXJuIFV0KGUsdCksT3QoZSxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1FdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiByLmVtYmVkPXRoaXMuZW1iZWQscn19LHtrZXk6XCJfZnJvbUJpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQsbil7dmFyIHI9RXQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxuKTtyZXR1cm4gdGhpcy5lbWJlZD1KU09OLnBhcnNlKG4ucmVhZFZhclN0cmluZygpKSxyfX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0V0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKEpTT04uc3RyaW5naWZ5KHRoaXMuZW1iZWQpKX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIkl0ZW1FbWJlZFwiLHRoaXMsXCJlbWJlZDpcIitKU09OLnN0cmluZ2lmeSh0aGlzLmVtYmVkKSl9fSx7a2V5OlwiX2xlbmd0aFwiLGdldDpmdW5jdGlvbigpe3JldHVybiAxfX1dKSxlfShJdGVtKSxXdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7U3QodGhpcyxlKTt2YXIgdD1UdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMpKTtyZXR1cm4gdC5rZXk9bnVsbCx0LnZhbHVlPW51bGwsdH1yZXR1cm4gVXQoZSx0KSxPdChlLFt7a2V5OlwiX2NvcHlcIix2YWx1ZTpmdW5jdGlvbih0LG4pe3ZhciByPUV0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzLHQsbik7cmV0dXJuIHIua2V5PXRoaXMua2V5LHIudmFsdWU9dGhpcy52YWx1ZSxyfX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxuKXt2YXIgcj1FdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJfZnJvbUJpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0LG4pO3JldHVybiB0aGlzLmtleT1uLnJlYWRWYXJTdHJpbmcoKSx0aGlzLnZhbHVlPUpTT04ucGFyc2Uobi5yZWFkVmFyU3RyaW5nKCkpLHJ9fSx7a2V5OlwiX3RvQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCl7RXQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5rZXkpLHQud3JpdGVWYXJTdHJpbmcoSlNPTi5zdHJpbmdpZnkodGhpcy52YWx1ZSkpfX0se2tleTpcIl9sb2dTdHJpbmdcIix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB5KFwiSXRlbUZvcm1hdFwiLHRoaXMsXCJrZXk6XCIrSlNPTi5zdHJpbmdpZnkodGhpcy5rZXkpK1wiLHZhbHVlOlwiK0pTT04uc3RyaW5naWZ5KHRoaXMudmFsdWUpKX19LHtrZXk6XCJfbGVuZ3RoXCIsZ2V0OmZ1bmN0aW9uKCl7cmV0dXJuIDF9fSx7a2V5OlwiX2NvdW50YWJsZVwiLGdldDpmdW5jdGlvbigpe3JldHVybiExfX1dKSxlfShJdGVtKSxIdD1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbixyKXtTdCh0aGlzLGUpO3ZhciBpPVR0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcyx0LG4scikpO3JldHVybiBpLl9kZWx0YT1udWxsLGl9cmV0dXJuIFV0KGUsdCksT3QoZSxbe2tleTpcImRlbHRhXCIsZ2V0OmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcztpZihudWxsPT09dGhpcy5fZGVsdGEpe3ZhciBlPXRoaXMudGFyZ2V0Ll95O2UudHJhbnNhY3QoZnVuY3Rpb24oKXt2YXIgbj10LnRhcmdldC5fc3RhcnQscj1bXSxpPXQuYWRkZWRFbGVtZW50cyxvPXQucmVtb3ZlZEVsZW1lbnRzO3QuX2RlbHRhPXI7Zm9yKHZhciBhPW51bGwscz17fSxsPW5ldyBNYXAsdT1uZXcgTWFwLGM9XCJcIixoPTAsZj0wLGQ9ZnVuY3Rpb24oKXtpZihudWxsIT09YSl7dmFyIHQ9dm9pZCAwO3N3aXRjaChhKXtjYXNlXCJkZWxldGVcIjp0PXtkZWxldGU6Zn0sZj0wO2JyZWFrO2Nhc2VcImluc2VydFwiOmlmKHQ9e2luc2VydDpjfSxsLnNpemU+MCl7dC5hdHRyaWJ1dGVzPXt9O3ZhciBlPSEwLG49ITEsaT12b2lkIDA7dHJ5e2Zvcih2YXIgbyx1PWxbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0obz11Lm5leHQoKSkuZG9uZSk7ZT0hMCl7dmFyIGQ9QnQoby52YWx1ZSwyKSxfPWRbMF0sdj1kWzFdO251bGwhPT12JiYodC5hdHRyaWJ1dGVzW19dPXYpfX1jYXRjaCh0KXtuPSEwLGk9dH1maW5hbGx5e3RyeXshZSYmdS5yZXR1cm4mJnUucmV0dXJuKCl9ZmluYWxseXtpZihuKXRocm93IGl9fX1jPVwiXCI7YnJlYWs7Y2FzZVwicmV0YWluXCI6aWYodD17cmV0YWluOmh9LE9iamVjdC5rZXlzKHMpLmxlbmd0aD4wKXt0LmF0dHJpYnV0ZXM9e307Zm9yKHZhciBfIGluIHMpdC5hdHRyaWJ1dGVzW19dPXNbX119aD0wfXIucHVzaCh0KSxhPW51bGx9fTtudWxsIT09bjspe3N3aXRjaChuLmNvbnN0cnVjdG9yKXtjYXNlIFJ0OmkuaGFzKG4pPyhkKCksYT1cImluc2VydFwiLGM9bi5lbWJlZCxkKCkpOm8uaGFzKG4pPyhcImRlbGV0ZVwiIT09YSYmKGQoKSxhPVwiZGVsZXRlXCIpLGYrPTEpOiExPT09bi5fZGVsZXRlZCYmKFwicmV0YWluXCIhPT1hJiYoZCgpLGE9XCJyZXRhaW5cIiksaCs9MSk7YnJlYWs7Y2FzZSBJdGVtU3RyaW5nOmkuaGFzKG4pPyhcImluc2VydFwiIT09YSYmKGQoKSxhPVwiaW5zZXJ0XCIpLGMrPW4uX2NvbnRlbnQpOm8uaGFzKG4pPyhcImRlbGV0ZVwiIT09YSYmKGQoKSxhPVwiZGVsZXRlXCIpLGYrPW4uX2xlbmd0aCk6ITE9PT1uLl9kZWxldGVkJiYoXCJyZXRhaW5cIiE9PWEmJihkKCksYT1cInJldGFpblwiKSxoKz1uLl9sZW5ndGgpO2JyZWFrO2Nhc2UgV3Q6aWYoaS5oYXMobikpeyhsLmdldChuLmtleSl8fG51bGwpIT09bi52YWx1ZT8oXCJyZXRhaW5cIj09PWEmJmQoKSxuLnZhbHVlPT09KHUuZ2V0KG4ua2V5KXx8bnVsbCk/ZGVsZXRlIHNbbi5rZXldOnNbbi5rZXldPW4udmFsdWUpOm4uX2RlbGV0ZShlKX1lbHNlIGlmKG8uaGFzKG4pKXt1LnNldChuLmtleSxuLnZhbHVlKTt2YXIgXz1sLmdldChuLmtleSl8fG51bGw7XyE9PW4udmFsdWUmJihcInJldGFpblwiPT09YSYmZCgpLHNbbi5rZXldPV8pfWVsc2UgaWYoITE9PT1uLl9kZWxldGVkKXt1LnNldChuLmtleSxuLnZhbHVlKTt2YXIgdj1zW24ua2V5XTt2b2lkIDAhPT12JiYodiE9PW4udmFsdWU/KFwicmV0YWluXCI9PT1hJiZkKCksbnVsbD09PW4udmFsdWU/c1tuLmtleV09bi52YWx1ZTpkZWxldGUgc1tuLmtleV0pOm4uX2RlbGV0ZShlKSl9ITE9PT1uLl9kZWxldGVkJiYoXCJpbnNlcnRcIj09PWEmJmQoKSxUKGwsbikpfW49bi5fcmlnaHR9Zm9yKGQoKTt0Ll9kZWx0YS5sZW5ndGg+MDspe3ZhciBwPXQuX2RlbHRhW3QuX2RlbHRhLmxlbmd0aC0xXTtpZih2b2lkIDA9PT1wLnJldGFpbnx8dm9pZCAwIT09cC5hdHRyaWJ1dGVzKWJyZWFrO3QuX2RlbHRhLnBvcCgpfX0pfXJldHVybiB0aGlzLl9kZWx0YX19XSksZX0oWUFycmF5RXZlbnQpLFlUZXh0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlUZXh0KHQpe1N0KHRoaXMsWVRleHQpO3ZhciBlPVR0KHRoaXMsKFlUZXh0Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlUZXh0KSkuY2FsbCh0aGlzKSk7aWYoXCJzdHJpbmdcIj09dHlwZW9mIHQpe3ZhciBuPW5ldyBJdGVtU3RyaW5nO24uX3BhcmVudD1lLG4uX2NvbnRlbnQ9dCxlLl9zdGFydD1ufXJldHVybiBlfXJldHVybiBVdChZVGV4dCx0KSxPdChZVGV4dCxbe2tleTpcIl9jYWxsT2JzZXJ2ZXJcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dGhpcy5fY2FsbEV2ZW50SGFuZGxlcih0LG5ldyBIdCh0aGlzLG4sdCkpfX0se2tleTpcInRvU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtmb3IodmFyIHQ9XCJcIixlPXRoaXMuX3N0YXJ0O251bGwhPT1lOykhZS5fZGVsZXRlZCYmZS5fY291bnRhYmxlJiYodCs9ZS5fY29udGVudCksZT1lLl9yaWdodDtyZXR1cm4gdH19LHtrZXk6XCJhcHBseURlbHRhXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpczt0aGlzLl90cmFuc2FjdChmdW5jdGlvbihuKXtmb3IodmFyIHI9bnVsbCxpPWUuX3N0YXJ0LG89bmV3IE1hcCxhPTA7YTx0Lmxlbmd0aDthKyspe3ZhciBzPXRbYV07aWYodm9pZCAwIT09cy5pbnNlcnQpe3ZhciBsPXgobixzLmluc2VydCxlLHIsaSxvLHMuYXR0cmlidXRlc3x8e30pLHU9QnQobCwyKTtyPXVbMF0saT11WzFdfWVsc2UgaWYodm9pZCAwIT09cy5yZXRhaW4pe3ZhciBjPUkobixzLnJldGFpbixlLHIsaSxvLHMuYXR0cmlidXRlc3x8e30pLGg9QnQoYywyKTtyPWhbMF0saT1oWzFdfWVsc2UgaWYodm9pZCAwIT09cy5kZWxldGUpe3ZhciBmPUQobixzLmRlbGV0ZSxlLHIsaSxvKSxkPUJ0KGYsMik7cj1kWzBdLGk9ZFsxXX19fSl9fSx7a2V5OlwidG9EZWx0YVwiLHZhbHVlOmZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe2lmKHIubGVuZ3RoPjApe3ZhciB0PXt9LGk9ITEsbz0hMCxhPSExLHM9dm9pZCAwO3RyeXtmb3IodmFyIGwsdT1uW1N5bWJvbC5pdGVyYXRvcl0oKTshKG89KGw9dS5uZXh0KCkpLmRvbmUpO289ITApe3ZhciBjPUJ0KGwudmFsdWUsMiksaD1jWzBdLGY9Y1sxXTtpPSEwLHRbaF09Zn19Y2F0Y2godCl7YT0hMCxzPXR9ZmluYWxseXt0cnl7IW8mJnUucmV0dXJuJiZ1LnJldHVybigpfWZpbmFsbHl7aWYoYSl0aHJvdyBzfX12YXIgZD17aW5zZXJ0OnJ9O2kmJihkLmF0dHJpYnV0ZXM9dCksZS5wdXNoKGQpLHI9XCJcIn19Zm9yKHZhciBlPVtdLG49bmV3IE1hcCxyPVwiXCIsaT10aGlzLl9zdGFydDtudWxsIT09aTspe2lmKCFpLl9kZWxldGVkKXN3aXRjaChpLmNvbnN0cnVjdG9yKXtjYXNlIEl0ZW1TdHJpbmc6cis9aS5fY29udGVudDticmVhaztjYXNlIFd0OnQoKSxUKG4saSl9aT1pLl9yaWdodH1yZXR1cm4gdCgpLGV9fSx7a2V5OlwiaW5zZXJ0XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj10aGlzLHI9YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9O2UubGVuZ3RoPD0wfHx0aGlzLl90cmFuc2FjdChmdW5jdGlvbihpKXt2YXIgbz1FKG4sdCksYT1CdChvLDMpLHM9YVswXSxsPWFbMV0sdT1hWzJdO3goaSxlLG4scyxsLHUscil9KX19LHtrZXk6XCJpbnNlcnRFbWJlZFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcyxyPWFyZ3VtZW50cy5sZW5ndGg+MiYmdm9pZCAwIT09YXJndW1lbnRzWzJdP2FyZ3VtZW50c1syXTp7fTtpZihlLmNvbnN0cnVjdG9yIT09T2JqZWN0KXRocm93IG5ldyBFcnJvcihcIkVtYmVkIG11c3QgYmUgYW4gT2JqZWN0XCIpO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKGkpe3ZhciBvPUUobix0KSxhPUJ0KG8sMykscz1hWzBdLGw9YVsxXSx1PWFbMl07eChpLGUsbixzLGwsdSxyKX0pfX0se2tleTpcImRlbGV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpczswIT09ZSYmdGhpcy5fdHJhbnNhY3QoZnVuY3Rpb24ocil7dmFyIGk9RShuLHQpLG89QnQoaSwzKSxhPW9bMF0scz1vWzFdLGw9b1syXTtEKHIsZSxuLGEscyxsKX0pfX0se2tleTpcImZvcm1hdFwiLHZhbHVlOmZ1bmN0aW9uKHQsZSxuKXt2YXIgcj10aGlzO3RoaXMuX3RyYW5zYWN0KGZ1bmN0aW9uKGkpe3ZhciBvPUUocix0KSxhPUJ0KG8sMykscz1hWzBdLGw9YVsxXSx1PWFbMl07bnVsbCE9PWwmJkkoaSxlLHIscyxsLHUsbil9KX19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllUZXh0XCIsdGhpcyl9fV0pLFlUZXh0fShZQXJyYXkpLFlYbWxIb29rPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxIb29rKHQpe1N0KHRoaXMsWVhtbEhvb2spO3ZhciBlPVR0KHRoaXMsKFlYbWxIb29rLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rKSkuY2FsbCh0aGlzKSk7cmV0dXJuIGUuaG9va05hbWU9bnVsbCx2b2lkIDAhPT10JiYoZS5ob29rTmFtZT10KSxlfXJldHVybiBVdChZWG1sSG9vayx0KSxPdChZWG1sSG9vayxbe2tleTpcIl9jb3B5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1FdChZWG1sSG9vay5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEhvb2sucHJvdG90eXBlKSxcIl9jb3B5XCIsdGhpcykuY2FsbCh0aGlzKTtyZXR1cm4gdC5ob29rTmFtZT10aGlzLmhvb2tOYW1lLHR9fSx7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fSxlPWFyZ3VtZW50c1syXSxuPXRbdGhpcy5ob29rTmFtZV0scj12b2lkIDA7cmV0dXJuIHI9dm9pZCAwIT09bj9uLmNyZWF0ZURvbSh0aGlzKTpkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRoaXMuaG9va05hbWUpLHIuc2V0QXR0cmlidXRlKFwiZGF0YS15anMtaG9va1wiLHRoaXMuaG9va05hbWUpLFIoZSxyLHRoaXMpLHJ9fSx7a2V5OlwiX2Zyb21CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPUV0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX2Zyb21CaW5hcnlcIix0aGlzKS5jYWxsKHRoaXMsdCxlKTtyZXR1cm4gdGhpcy5ob29rTmFtZT1lLnJlYWRWYXJTdHJpbmcoKSxufX0se2tleTpcIl90b0JpbmFyeVwiLHZhbHVlOmZ1bmN0aW9uKHQpe0V0KFlYbWxIb29rLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sSG9vay5wcm90b3R5cGUpLFwiX3RvQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQpLHQud3JpdGVWYXJTdHJpbmcodGhpcy5ob29rTmFtZSl9fSx7a2V5OlwiX2ludGVncmF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKG51bGw9PT10aGlzLmhvb2tOYW1lKXRocm93IG5ldyBFcnJvcihcImhvb2tOYW1lIG11c3QgYmUgZGVmaW5lZCFcIik7RXQoWVhtbEhvb2sucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxIb29rLnByb3RvdHlwZSksXCJfaW50ZWdyYXRlXCIsdGhpcykuY2FsbCh0aGlzLHQpfX1dKSxZWG1sSG9va30oWU1hcCksSnQ9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KGUsbil7U3QodGhpcyx0KSx0aGlzLl9maWx0ZXI9bnx8ZnVuY3Rpb24oKXtyZXR1cm4hMH0sdGhpcy5fcm9vdD1lLHRoaXMuX2N1cnJlbnROb2RlPWUsdGhpcy5fZmlyc3RDYWxsPSEwfXJldHVybiBPdCh0LFt7a2V5OlN5bWJvbC5pdGVyYXRvcix2YWx1ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzfX0se2tleTpcIm5leHRcIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PXRoaXMuX2N1cnJlbnROb2RlO2lmKHRoaXMuX2ZpcnN0Q2FsbCYmKHRoaXMuX2ZpcnN0Q2FsbD0hMSwhdC5fZGVsZXRlZCYmdGhpcy5fZmlsdGVyKHQpKSlyZXR1cm57dmFsdWU6dCxkb25lOiExfTtkb3tpZih0Ll9kZWxldGVkfHx0LmNvbnN0cnVjdG9yIT09WVhtbEZyYWdtZW50Ll9ZWG1sRWxlbWVudCYmdC5jb25zdHJ1Y3RvciE9PVlYbWxGcmFnbWVudHx8bnVsbD09PXQuX3N0YXJ0KXtmb3IoO3QhPT10aGlzLl9yb290Oyl7aWYobnVsbCE9PXQuX3JpZ2h0KXt0PXQuX3JpZ2h0O2JyZWFrfXQ9dC5fcGFyZW50fXQ9PT10aGlzLl9yb290JiYodD1udWxsKX1lbHNlIHQ9dC5fc3RhcnQ7aWYodD09PXRoaXMuX3Jvb3QpYnJlYWt9d2hpbGUobnVsbCE9PXQmJih0Ll9kZWxldGVkfHwhdGhpcy5fZmlsdGVyKHQpKSk7cmV0dXJuIHRoaXMuX2N1cnJlbnROb2RlPXQsbnVsbD09PXQ/e2RvbmU6ITB9Ont2YWx1ZTp0LGRvbmU6ITF9fX1dKSx0fSgpLFlYbWxFdmVudD1mdW5jdGlvbih0KXtmdW5jdGlvbiBZWG1sRXZlbnQodCxlLG4scil7U3QodGhpcyxZWG1sRXZlbnQpO3ZhciBpPVR0KHRoaXMsKFlYbWxFdmVudC5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRXZlbnQpKS5jYWxsKHRoaXMsdCkpO3JldHVybiBpLl90cmFuc2FjdGlvbj1yLGkuY2hpbGRMaXN0Q2hhbmdlZD0hMSxpLmF0dHJpYnV0ZXNDaGFuZ2VkPW5ldyBTZXQsaS5yZW1vdGU9bixlLmZvckVhY2goZnVuY3Rpb24odCl7bnVsbD09PXQ/aS5jaGlsZExpc3RDaGFuZ2VkPSEwOmkuYXR0cmlidXRlc0NoYW5nZWQuYWRkKHQpfSksaX1yZXR1cm4gVXQoWVhtbEV2ZW50LHQpLFlYbWxFdmVudH0oWUV2ZW50KSxZWG1sRnJhZ21lbnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWVhtbEZyYWdtZW50KCl7cmV0dXJuIFN0KHRoaXMsWVhtbEZyYWdtZW50KSxUdCh0aGlzLChZWG1sRnJhZ21lbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEZyYWdtZW50KSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gVXQoWVhtbEZyYWdtZW50LHQpLE90KFlYbWxGcmFnbWVudCxbe2tleTpcImNyZWF0ZVRyZWVXYWxrZXJcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gbmV3IEp0KHRoaXMsdCl9fSx7a2V5OlwicXVlcnlTZWxlY3RvclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3Q9dC50b1VwcGVyQ2FzZSgpO3ZhciBlPW5ldyBKdCh0aGlzLGZ1bmN0aW9uKGUpe3JldHVybiBlLm5vZGVOYW1lPT09dH0pLG49ZS5uZXh0KCk7cmV0dXJuIG4uZG9uZT9udWxsOm4udmFsdWV9fSx7a2V5OlwicXVlcnlTZWxlY3RvckFsbFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiB0PXQudG9VcHBlckNhc2UoKSxBcnJheS5mcm9tKG5ldyBKdCh0aGlzLGZ1bmN0aW9uKGUpe3JldHVybiBlLm5vZGVOYW1lPT09dH0pKX19LHtrZXk6XCJfY2FsbE9ic2VydmVyXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe3RoaXMuX2NhbGxFdmVudEhhbmRsZXIodCxuZXcgWVhtbEV2ZW50KHRoaXMsZSxuLHQpKX19LHtrZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKHQpe3JldHVybiB0LnRvU3RyaW5nKCl9KS5qb2luKFwiXCIpfX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7RXQoWVhtbEZyYWdtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRnJhZ21lbnQucHJvdG90eXBlKSxcIl9kZWxldGVcIix0aGlzKS5jYWxsKHRoaXMsdCxlLG4pfX0se2tleTpcInRvRG9tXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD1hcmd1bWVudHMubGVuZ3RoPjAmJnZvaWQgMCE9PWFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06ZG9jdW1lbnQsZT1hcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06e30sbj1hcmd1bWVudHNbMl0scj10LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtyZXR1cm4gUihuLHIsdGhpcyksdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe3IuaW5zZXJ0QmVmb3JlKGkudG9Eb20odCxlLG4pLG51bGwpfSkscn19LHtrZXk6XCJfbG9nU3RyaW5nXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4geShcIllYbWxcIix0aGlzKX19XSksWVhtbEZyYWdtZW50fShZQXJyYXkpLFlYbWxFbGVtZW50PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxFbGVtZW50KCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOlwiVU5ERUZJTkVEXCI7U3QodGhpcyxZWG1sRWxlbWVudCk7dmFyIGU9VHQodGhpcywoWVhtbEVsZW1lbnQuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQpKS5jYWxsKHRoaXMpKTtyZXR1cm4gZS5ub2RlTmFtZT10LnRvVXBwZXJDYXNlKCksZX1yZXR1cm4gVXQoWVhtbEVsZW1lbnQsdCksT3QoWVhtbEVsZW1lbnQsW3trZXk6XCJfY29weVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9RXQoWVhtbEVsZW1lbnQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxFbGVtZW50LnByb3RvdHlwZSksXCJfY29weVwiLHRoaXMpLmNhbGwodGhpcyk7cmV0dXJuIHQubm9kZU5hbWU9dGhpcy5ub2RlTmFtZSx0fX0se2tleTpcIl9mcm9tQmluYXJ5XCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1FdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl9mcm9tQmluYXJ5XCIsdGhpcykuY2FsbCh0aGlzLHQsZSk7cmV0dXJuIHRoaXMubm9kZU5hbWU9ZS5yZWFkVmFyU3RyaW5nKCksbn19LHtrZXk6XCJfdG9CaW5hcnlcIix2YWx1ZTpmdW5jdGlvbih0KXtFdChZWG1sRWxlbWVudC5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoWVhtbEVsZW1lbnQucHJvdG90eXBlKSxcIl90b0JpbmFyeVwiLHRoaXMpLmNhbGwodGhpcyx0KSx0LndyaXRlVmFyU3RyaW5nKHRoaXMubm9kZU5hbWUpfX0se2tleTpcIl9pbnRlZ3JhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtpZihudWxsPT09dGhpcy5ub2RlTmFtZSl0aHJvdyBuZXcgRXJyb3IoXCJub2RlTmFtZSBtdXN0IGJlIGRlZmluZWQhXCIpO0V0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwiX2ludGVncmF0ZVwiLHRoaXMpLmNhbGwodGhpcyx0KX19LHtrZXk6XCJ0b1N0cmluZ1wiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9dGhpcy5nZXRBdHRyaWJ1dGVzKCksZT1bXSxuPVtdO2Zvcih2YXIgciBpbiB0KW4ucHVzaChyKTtuLnNvcnQoKTtmb3IodmFyIGk9bi5sZW5ndGgsbz0wO288aTtvKyspe3ZhciBhPW5bb107ZS5wdXNoKGErJz1cIicrdFthXSsnXCInKX12YXIgcz10aGlzLm5vZGVOYW1lLnRvTG9jYWxlTG93ZXJDYXNlKCk7cmV0dXJuXCI8XCIrcysoZS5sZW5ndGg+MD9cIiBcIitlLmpvaW4oXCIgXCIpOlwiXCIpK1wiPlwiK0V0KFlYbWxFbGVtZW50LnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZWG1sRWxlbWVudC5wcm90b3R5cGUpLFwidG9TdHJpbmdcIix0aGlzKS5jYWxsKHRoaXMpK1wiPC9cIitzK1wiPlwifX0se2tleTpcInJlbW92ZUF0dHJpYnV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBZTWFwLnByb3RvdHlwZS5kZWxldGUuY2FsbCh0aGlzLHQpfX0se2tleTpcInNldEF0dHJpYnV0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7cmV0dXJuIFlNYXAucHJvdG90eXBlLnNldC5jYWxsKHRoaXMsdCxlKX19LHtrZXk6XCJnZXRBdHRyaWJ1dGVcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gWU1hcC5wcm90b3R5cGUuZ2V0LmNhbGwodGhpcyx0KX19LHtrZXk6XCJnZXRBdHRyaWJ1dGVzXCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD17fSxlPSEwLG49ITEscj12b2lkIDA7dHJ5e2Zvcih2YXIgaSxvPXRoaXMuX21hcFtTeW1ib2wuaXRlcmF0b3JdKCk7IShlPShpPW8ubmV4dCgpKS5kb25lKTtlPSEwKXt2YXIgYT1CdChpLnZhbHVlLDIpLHM9YVswXSxsPWFbMV07bC5fZGVsZXRlZHx8KHRbc109bC5fY29udGVudFswXSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19cmV0dXJuIHR9fSx7a2V5OlwidG9Eb21cIix2YWx1ZTpmdW5jdGlvbigpe3ZhciB0PWFyZ3VtZW50cy5sZW5ndGg+MCYmdm9pZCAwIT09YXJndW1lbnRzWzBdP2FyZ3VtZW50c1swXTpkb2N1bWVudCxlPWFyZ3VtZW50cy5sZW5ndGg+MSYmdm9pZCAwIT09YXJndW1lbnRzWzFdP2FyZ3VtZW50c1sxXTp7fSxuPWFyZ3VtZW50c1syXSxyPXQuY3JlYXRlRWxlbWVudCh0aGlzLm5vZGVOYW1lKSxpPXRoaXMuZ2V0QXR0cmlidXRlcygpO2Zvcih2YXIgbyBpbiBpKXIuc2V0QXR0cmlidXRlKG8saVtvXSk7cmV0dXJuIHRoaXMuZm9yRWFjaChmdW5jdGlvbihpKXtyLmFwcGVuZENoaWxkKGkudG9Eb20odCxlLG4pKX0pLFIobixyLHRoaXMpLHJ9fV0pLFlYbWxFbGVtZW50fShZWG1sRnJhZ21lbnQpO1lYbWxGcmFnbWVudC5fWVhtbEVsZW1lbnQ9WVhtbEVsZW1lbnQ7dmFyIFlYbWxUZXh0PWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIFlYbWxUZXh0KCl7cmV0dXJuIFN0KHRoaXMsWVhtbFRleHQpLFR0KHRoaXMsKFlYbWxUZXh0Ll9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxUZXh0KSkuYXBwbHkodGhpcyxhcmd1bWVudHMpKX1yZXR1cm4gVXQoWVhtbFRleHQsdCksT3QoWVhtbFRleHQsW3trZXk6XCJ0b0RvbVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9YXJndW1lbnRzLmxlbmd0aD4wJiZ2b2lkIDAhPT1hcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOmRvY3VtZW50LGU9YXJndW1lbnRzWzJdLG49dC5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRvU3RyaW5nKCkpO3JldHVybiBSKGUsbix0aGlzKSxufX0se2tleTpcIl9kZWxldGVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7RXQoWVhtbFRleHQucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKFlYbWxUZXh0LnByb3RvdHlwZSksXCJfZGVsZXRlXCIsdGhpcykuY2FsbCh0aGlzLHQsZSxuKX19XSksWVhtbFRleHR9KFlUZXh0KSx6dD1uZXcgTWFwLFl0PW5ldyBNYXA7cSgwLEl0ZW1KU09OKSxxKDEsSXRlbVN0cmluZykscSgxMCxXdCkscSgxMSxSdCkscSgyLERlbGV0ZSkscSgzLFlBcnJheSkscSg0LFlNYXApLHEoNSxZVGV4dCkscSg2LFlYbWxGcmFnbWVudCkscSg3LFlYbWxFbGVtZW50KSxxKDgsWVhtbFRleHQpLHEoOSxZWG1sSG9vaykscSgxMixqdCk7dmFyIFh0PTE2Nzc3MjE1LHF0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe1N0KHRoaXMsdCksdGhpcy51c2VyPVh0LHRoaXMubmFtZT1lLHRoaXMudHlwZT0kKG4pfXJldHVybiBPdCh0LFt7a2V5OlwiZXF1YWxzXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIG51bGwhPT10JiZ0LnVzZXI9PT10aGlzLnVzZXImJnQubmFtZT09PXRoaXMubmFtZSYmdC50eXBlPT09dGhpcy50eXBlfX0se2tleTpcImxlc3NUaGFuXCIsdmFsdWU6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuY29uc3RydWN0b3IhPT10fHwodGhpcy51c2VyPGUudXNlcnx8dGhpcy51c2VyPT09ZS51c2VyJiYodGhpcy5uYW1lPGUubmFtZXx8dGhpcy5uYW1lPT09ZS5uYW1lJiZ0aGlzLnR5cGU8ZS50eXBlKSl9fV0pLHR9KCksRnQ9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gZSh0KXtTdCh0aGlzLGUpO3ZhciBuPVR0KHRoaXMsKGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZSkpLmNhbGwodGhpcykpO3JldHVybiBuLnk9dCxufXJldHVybiBVdChlLHQpLE90KGUsW3trZXk6XCJsb2dUYWJsZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9W107dGhpcy5pdGVyYXRlKG51bGwsbnVsbCxmdW5jdGlvbihlKXtlLmNvbnN0cnVjdG9yPT09anQ/dC5wdXNoKHtpZDpwKGUpLGNvbnRlbnQ6ZS5fbGVuZ3RoLGRlbGV0ZWQ6XCJHQ1wifSk6dC5wdXNoKHtpZDpwKGUpLG9yaWdpbjpwKG51bGw9PT1lLl9vcmlnaW4/bnVsbDplLl9vcmlnaW4uX2xhc3RJZCksbGVmdDpwKG51bGw9PT1lLl9sZWZ0P251bGw6ZS5fbGVmdC5fbGFzdElkKSxyaWdodDpwKGUuX3JpZ2h0KSxyaWdodF9vcmlnaW46cChlLl9yaWdodF9vcmlnaW4pLHBhcmVudDpwKGUuX3BhcmVudCkscGFyZW50U3ViOmUuX3BhcmVudFN1YixkZWxldGVkOmUuX2RlbGV0ZWQsY29udGVudDpKU09OLnN0cmluZ2lmeShlLl9jb250ZW50KX0pfSksY29uc29sZS50YWJsZSh0KX19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLmZpbmQodCk7aWYobnVsbD09PWUmJnQgaW5zdGFuY2VvZiBxdCl7dmFyIG49Rih0LnR5cGUpLHI9dGhpcy55O2U9bmV3IG4sZS5faWQ9dCxlLl9wYXJlbnQ9cixyLnRyYW5zYWN0KGZ1bmN0aW9uKCl7ZS5faW50ZWdyYXRlKHIpfSksdGhpcy5wdXQoZSl9cmV0dXJuIGV9fSx7a2V5OlwiZ2V0SXRlbVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuZmluZFdpdGhVcHBlckJvdW5kKHQpO2lmKG51bGw9PT1lKXJldHVybiBudWxsO3ZhciBuPWUuX2lkO3JldHVybiB0LnVzZXI9PT1uLnVzZXImJnQuY2xvY2s8bi5jbG9jaytlLl9sZW5ndGg/ZTpudWxsfX0se2tleTpcImdldEl0ZW1DbGVhblN0YXJ0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5nZXRJdGVtKHQpO2lmKG51bGw9PT1lfHwxPT09ZS5fbGVuZ3RoKXJldHVybiBlO3ZhciBuPWUuX2lkO3JldHVybiBuLmNsb2NrPT09dC5jbG9jaz9lOmUuX3NwbGl0QXQodGhpcy55LHQuY2xvY2stbi5jbG9jayl9fSx7a2V5OlwiZ2V0SXRlbUNsZWFuRW5kXCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5nZXRJdGVtKHQpO2lmKG51bGw9PT1lfHwxPT09ZS5fbGVuZ3RoKXJldHVybiBlO3ZhciBuPWUuX2lkO3JldHVybiBuLmNsb2NrK2UuX2xlbmd0aC0xPT09dC5jbG9jaz9lOihlLl9zcGxpdEF0KHRoaXMueSx0LmNsb2NrLW4uY2xvY2srMSksZSl9fV0pLGV9KHh0KSwkdD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSl7U3QodGhpcyx0KSx0aGlzLnk9ZSx0aGlzLnN0YXRlPW5ldyBNYXB9cmV0dXJuIE90KHQsW3trZXk6XCJsb2dUYWJsZVwiLHZhbHVlOmZ1bmN0aW9uKCl7dmFyIHQ9W10sZT0hMCxuPSExLHI9dm9pZCAwO3RyeXtmb3IodmFyIGksbz10aGlzLnN0YXRlW1N5bWJvbC5pdGVyYXRvcl0oKTshKGU9KGk9by5uZXh0KCkpLmRvbmUpO2U9ITApe3ZhciBhPUJ0KGkudmFsdWUsMikscz1hWzBdLGw9YVsxXTt0LnB1c2goe3VzZXI6cyxzdGF0ZTpsfSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19Y29uc29sZS50YWJsZSh0KX19LHtrZXk6XCJnZXROZXh0SURcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLnkudXNlcklELG49dGhpcy5nZXRTdGF0ZShlKTtyZXR1cm4gdGhpcy5zZXRTdGF0ZShlLG4rdCksbmV3IEl0KGUsbil9fSx7a2V5OlwidXBkYXRlUmVtb3RlU3RhdGVcIix2YWx1ZTpmdW5jdGlvbih0KXtmb3IodmFyIGU9dC5faWQudXNlcixuPXRoaXMuc3RhdGUuZ2V0KGUpO251bGwhPT10JiZ0Ll9pZC5jbG9jaz09PW47KW4rPXQuX2xlbmd0aCx0PXRoaXMueS5vcy5nZXQobmV3IEl0KGUsbikpXG47dGhpcy5zdGF0ZS5zZXQoZSxuKX19LHtrZXk6XCJnZXRTdGF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuc3RhdGUuZ2V0KHQpO3JldHVybiBudWxsPT1lPzA6ZX19LHtrZXk6XCJzZXRTdGF0ZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dmFyIG49dGhpcy55Ll90cmFuc2FjdGlvbi5iZWZvcmVTdGF0ZTtuLmhhcyh0KXx8bi5zZXQodCx0aGlzLmdldFN0YXRlKHQpKSx0aGlzLnN0YXRlLnNldCh0LGUpfX1dKSx0fSgpLEd0PWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdCgpe1N0KHRoaXMsdCksdGhpcy5fZXZlbnRMaXN0ZW5lcj1uZXcgTWFwLHRoaXMuX3N0YXRlTGlzdGVuZXI9bmV3IE1hcH1yZXR1cm4gT3QodCxbe2tleTpcIl9nZXRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX2V2ZW50TGlzdGVuZXIuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1lJiYoZT17b25jZTpuZXcgU2V0LG9uOm5ldyBTZXR9LHRoaXMuX2V2ZW50TGlzdGVuZXIuc2V0KHQsZSkpLGV9fSx7a2V5Olwib25jZVwiLHZhbHVlOmZ1bmN0aW9uKHQsZSl7dGhpcy5fZ2V0TGlzdGVuZXIodCkub25jZS5hZGQoZSl9fSx7a2V5Olwib25cIix2YWx1ZTpmdW5jdGlvbih0LGUpe3RoaXMuX2dldExpc3RlbmVyKHQpLm9uLmFkZChlKX19LHtrZXk6XCJfaW5pdFN0YXRlTGlzdGVuZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLl9zdGF0ZUxpc3RlbmVyLmdldCh0KTtyZXR1cm4gdm9pZCAwPT09ZSYmKGU9e30sZS5wcm9taXNlPW5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe2UucmVzb2x2ZT10fSksdGhpcy5fc3RhdGVMaXN0ZW5lci5zZXQodCxlKSksZX19LHtrZXk6XCJ3aGVuXCIsdmFsdWU6ZnVuY3Rpb24odCl7cmV0dXJuIHRoaXMuX2luaXRTdGF0ZUxpc3RlbmVyKHQpLnByb21pc2V9fSx7a2V5Olwib2ZmXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXtpZihudWxsPT10fHxudWxsPT1lKXRocm93IG5ldyBFcnJvcihcIllvdSBtdXN0IHNwZWNpZnkgZXZlbnQgbmFtZSBhbmQgZnVuY3Rpb24hXCIpO3ZhciBuPXRoaXMuX2V2ZW50TGlzdGVuZXIuZ2V0KHQpO3ZvaWQgMCE9PW4mJihuLm9uLmRlbGV0ZShlKSxuLm9uY2UuZGVsZXRlKGUpKX19LHtrZXk6XCJlbWl0XCIsdmFsdWU6ZnVuY3Rpb24odCl7Zm9yKHZhciBlPWFyZ3VtZW50cy5sZW5ndGgsbj1BcnJheShlPjE/ZS0xOjApLHI9MTtyPGU7cisrKW5bci0xXT1hcmd1bWVudHNbcl07dGhpcy5faW5pdFN0YXRlTGlzdGVuZXIodCkucmVzb2x2ZSgpO3ZhciBpPXRoaXMuX2V2ZW50TGlzdGVuZXIuZ2V0KHQpO3ZvaWQgMCE9PWk/KGkub24uZm9yRWFjaChmdW5jdGlvbih0KXtyZXR1cm4gdC5hcHBseShudWxsLG4pfSksaS5vbmNlLmZvckVhY2goZnVuY3Rpb24odCl7cmV0dXJuIHQuYXBwbHkobnVsbCxuKX0pLGkub25jZT1uZXcgU2V0KTpcImVycm9yXCI9PT10JiZjb25zb2xlLmVycm9yKG5bMF0pfX0se2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX2V2ZW50TGlzdGVuZXI9bnVsbH19XSksdH0oKSxadD1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoZSxuKXtTdCh0aGlzLHQpLHRoaXMudHlwZT1lLHRoaXMudGFyZ2V0PW4sdGhpcy5fbXV0dWFsRXhjbHVkZT1LKCl9cmV0dXJuIE90KHQsW3trZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLnR5cGU9bnVsbCx0aGlzLnRhcmdldD1udWxsfX1dKSx0fSgpLFF0PW51bGwsS3Q9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdldFNlbGVjdGlvbj90dDpmdW5jdGlvbigpe3JldHVybiBudWxsfSx0ZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7dmFyIHI9YXJndW1lbnRzLmxlbmd0aD4yJiZ2b2lkIDAhPT1hcmd1bWVudHNbMl0/YXJndW1lbnRzWzJdOnt9O1N0KHRoaXMsZSk7dmFyIGk9VHQodGhpcywoZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlKSkuY2FsbCh0aGlzLHQsbikpO2kub3B0cz1yLHIuZG9jdW1lbnQ9ci5kb2N1bWVudHx8ZG9jdW1lbnQsci5ob29rcz1yLmhvb2tzfHx7fSxpLnNjcm9sbGluZ0VsZW1lbnQ9ci5zY3JvbGxpbmdFbGVtZW50fHxudWxsLGkuZG9tVG9UeXBlPW5ldyBNYXAsaS50eXBlVG9Eb209bmV3IE1hcCxpLmZpbHRlcj1yLmZpbHRlcnx8TixuLmlubmVySFRNTD1cIlwiLHQuZm9yRWFjaChmdW5jdGlvbih0KXtuLmluc2VydEJlZm9yZSh0LnRvRG9tKHIuZG9jdW1lbnQsci5ob29rcyxpKSxudWxsKX0pLGkuX3R5cGVPYnNlcnZlcj1vdC5iaW5kKGkpLGkuX2RvbU9ic2VydmVyPWZ1bmN0aW9uKHQpe2x0LmNhbGwoaSx0LHIuZG9jdW1lbnQpfSx0Lm9ic2VydmVEZWVwKGkuX3R5cGVPYnNlcnZlciksaS5fbXV0YXRpb25PYnNlcnZlcj1uZXcgTXV0YXRpb25PYnNlcnZlcihpLl9kb21PYnNlcnZlciksaS5fbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKG4se2NoaWxkTGlzdDohMCxhdHRyaWJ1dGVzOiEwLGNoYXJhY3RlckRhdGE6ITAsc3VidHJlZTohMH0pLGkuX2N1cnJlbnRTZWw9bnVsbCxkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwic2VsZWN0aW9uY2hhbmdlXCIsZnVuY3Rpb24oKXtpLl9jdXJyZW50U2VsPUt0KGkpfSk7dmFyIG89dC5feTtyZXR1cm4gaS55PW8saS5fYmVmb3JlVHJhbnNhY3Rpb25IYW5kbGVyPWZ1bmN0aW9uKHQsZSxuKXtpLl9kb21PYnNlcnZlcihpLl9tdXRhdGlvbk9ic2VydmVyLnRha2VSZWNvcmRzKCkpLGkuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtldChpLG4pfSl9LG8ub24oXCJiZWZvcmVUcmFuc2FjdGlvblwiLGkuX2JlZm9yZVRyYW5zYWN0aW9uSGFuZGxlciksaS5fYWZ0ZXJUcmFuc2FjdGlvbkhhbmRsZXI9ZnVuY3Rpb24odCxlLG4pe2kuX211dHVhbEV4Y2x1ZGUoZnVuY3Rpb24oKXtudChpLG4pfSksZS5kZWxldGVkU3RydWN0cy5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBlPWkudHlwZVRvRG9tLmdldCh0KTt2b2lkIDAhPT1lJiZNKGksZSx0KX0pfSxvLm9uKFwiYWZ0ZXJUcmFuc2FjdGlvblwiLGkuX2FmdGVyVHJhbnNhY3Rpb25IYW5kbGVyKSxpLl9iZWZvcmVPYnNlcnZlckNhbGxzSGFuZGxlcj1mdW5jdGlvbih0LGUpe2UuY2hhbmdlZFR5cGVzLmZvckVhY2goZnVuY3Rpb24oZSxuKXsoZS5zaXplPjF8fDE9PT1lLnNpemUmJiExPT09ZS5oYXMobnVsbCkpJiZWKHQsaSxuKX0pLGUubmV3VHlwZXMuZm9yRWFjaChmdW5jdGlvbihlKXtWKHQsaSxlKX0pfSxvLm9uKFwiYmVmb3JlT2JzZXJ2ZXJDYWxsc1wiLGkuX2JlZm9yZU9ic2VydmVyQ2FsbHNIYW5kbGVyKSxSKGksbix0KSxpfXJldHVybiBVdChlLHQpLE90KGUsW3trZXk6XCJzZXRGaWx0ZXJcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmZpbHRlcj10fX0se2tleTpcIl9nZXRVbmRvU3RhY2tJbmZvXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5nZXRTZWxlY3Rpb24oKX19LHtrZXk6XCJfcmVzdG9yZVVuZG9TdGFja0luZm9cIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnJlc3RvcmVTZWxlY3Rpb24odCl9fSx7a2V5OlwiZ2V0U2VsZWN0aW9uXCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fY3VycmVudFNlbH19LHtrZXk6XCJyZXN0b3JlU2VsZWN0aW9uXCIsdmFsdWU6ZnVuY3Rpb24odCl7aWYobnVsbCE9PXQpe3ZhciBlPXQudG8sbj10LmZyb20scj0hMSxpPWdldFNlbGVjdGlvbigpLG89aS5iYXNlTm9kZSxhPWkuYmFzZU9mZnNldCxzPWkuZXh0ZW50Tm9kZSxsPWkuZXh0ZW50T2Zmc2V0O2lmKG51bGwhPT1uKXt2YXIgdT1RKHRoaXMueSxuKTtpZihudWxsIT09dSl7dmFyIGM9dGhpcy50eXBlVG9Eb20uZ2V0KHUudHlwZSksaD11Lm9mZnNldDtjPT09byYmaD09PWF8fChvPWMsYT1oLHI9ITApfX1pZihudWxsIT09ZSl7dmFyIGY9USh0aGlzLnksZSk7aWYobnVsbCE9PWYpe3ZhciBkPXRoaXMudHlwZVRvRG9tLmdldChmLnR5cGUpLF89Zi5vZmZzZXQ7ZD09PXMmJl89PT1sfHwocz1kLGw9XyxyPSEwKX19ciYmaS5zZXRCYXNlQW5kRXh0ZW50KG8sYSxzLGwpfX19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLmRvbVRvVHlwZT1udWxsLHRoaXMudHlwZVRvRG9tPW51bGwsdGhpcy50eXBlLnVub2JzZXJ2ZURlZXAodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKTt2YXIgdD10aGlzLnR5cGUuX3k7dC5vZmYoXCJiZWZvcmVUcmFuc2FjdGlvblwiLHRoaXMuX2JlZm9yZVRyYW5zYWN0aW9uSGFuZGxlciksdC5vZmYoXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsdGhpcy5fYmVmb3JlT2JzZXJ2ZXJDYWxsc0hhbmRsZXIpLHQub2ZmKFwiYWZ0ZXJUcmFuc2FjdGlvblwiLHRoaXMuX2FmdGVyVHJhbnNhY3Rpb25IYW5kbGVyKSxFdChlLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihlLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKX19XSksZX0oWnQpLFk9ZnVuY3Rpb24odCl7ZnVuY3Rpb24gWSh0LGUsbil7dmFyIHI9YXJndW1lbnRzLmxlbmd0aD4zJiZ2b2lkIDAhPT1hcmd1bWVudHNbM10/YXJndW1lbnRzWzNdOnt9O1N0KHRoaXMsWSk7dmFyIGk9VHQodGhpcywoWS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZKSkuY2FsbCh0aGlzKSk7aS5nY0VuYWJsZWQ9ci5nY3x8ITEsaS5yb29tPXQsbnVsbCE9ZSYmKGUuY29ubmVjdG9yLnJvb209dCksaS5fY29udGVudFJlYWR5PSExLGkuX29wdHM9ZSxcIm51bWJlclwiIT10eXBlb2YgZS51c2VySUQ/aS51c2VySUQ9RygpOmkudXNlcklEPWUudXNlcklELGkuc2hhcmU9e30saS5kcz1uZXcgUHQoaSksaS5vcz1uZXcgRnQoaSksaS5zcz1uZXcgJHQoaSksaS5fbWlzc2luZ1N0cnVjdHM9bmV3IE1hcCxpLl9yZWFkeVRvSW50ZWdyYXRlPVtdLGkuX3RyYW5zYWN0aW9uPW51bGwsaS5jb25uZWN0b3I9bnVsbCxpLmNvbm5lY3RlZD0hMTt2YXIgbz1mdW5jdGlvbigpe251bGwhPWUmJihpLmNvbm5lY3Rvcj1uZXcgWVtlLmNvbm5lY3Rvci5uYW1lXShpLGUuY29ubmVjdG9yKSxpLmNvbm5lY3RlZD0hMCxpLmVtaXQoXCJjb25uZWN0b3JSZWFkeVwiKSl9O3JldHVybiBpLnBlcnNpc3RlbmNlPW51bGwsbnVsbCE9bj8oaS5wZXJzaXN0ZW5jZT1uLG4uX2luaXQoaSkudGhlbihvKSk6bygpLGkuX3BhcmVudD1udWxsLGkuX2hhc1VuZG9NYW5hZ2VyPSExLGl9cmV0dXJuIFV0KFksdCksT3QoWSxbe2tleTpcIl9zZXRDb250ZW50UmVhZHlcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX2NvbnRlbnRSZWFkeXx8KHRoaXMuX2NvbnRlbnRSZWFkeT0hMCx0aGlzLmVtaXQoXCJjb250ZW50XCIpKX19LHtrZXk6XCJ3aGVuQ29udGVudFJlYWR5XCIsdmFsdWU6ZnVuY3Rpb24oKXt2YXIgdD10aGlzO3JldHVybiB0aGlzLl9jb250ZW50UmVhZHk/UHJvbWlzZS5yZXNvbHZlKCk6bmV3IFByb21pc2UoZnVuY3Rpb24oZSl7dC5vbmNlKFwiY29udGVudFwiLGUpfSl9fSx7a2V5OlwiX2JlZm9yZUNoYW5nZVwiLHZhbHVlOmZ1bmN0aW9uKCl7fX0se2tleTpcInRyYW5zYWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0mJmFyZ3VtZW50c1sxXSxuPW51bGw9PT10aGlzLl90cmFuc2FjdGlvbjtuJiYodGhpcy5fdHJhbnNhY3Rpb249bmV3IEN0KHRoaXMpLHRoaXMuZW1pdChcImJlZm9yZVRyYW5zYWN0aW9uXCIsdGhpcyx0aGlzLl90cmFuc2FjdGlvbixlKSk7dHJ5e3QodGhpcyl9Y2F0Y2godCl7Y29uc29sZS5lcnJvcih0KX1pZihuKXt0aGlzLmVtaXQoXCJiZWZvcmVPYnNlcnZlckNhbGxzXCIsdGhpcyx0aGlzLl90cmFuc2FjdGlvbixlKTt2YXIgcj10aGlzLl90cmFuc2FjdGlvbjt0aGlzLl90cmFuc2FjdGlvbj1udWxsLHIuY2hhbmdlZFR5cGVzLmZvckVhY2goZnVuY3Rpb24odCxuKXtuLl9kZWxldGVkfHxuLl9jYWxsT2JzZXJ2ZXIocix0LGUpfSksci5jaGFuZ2VkUGFyZW50VHlwZXMuZm9yRWFjaChmdW5jdGlvbih0LGUpe2UuX2RlbGV0ZWR8fCh0PXQuZmlsdGVyKGZ1bmN0aW9uKHQpe3JldHVybiF0LnRhcmdldC5fZGVsZXRlZH0pLHQuZm9yRWFjaChmdW5jdGlvbih0KXt0LmN1cnJlbnRUYXJnZXQ9ZX0pLGUuX2RlZXBFdmVudEhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKHIsdCkpfSksdGhpcy5lbWl0KFwiYWZ0ZXJUcmFuc2FjdGlvblwiLHRoaXMscixlKX19fSx7a2V5OlwiZGVmaW5lXCIsdmFsdWU6ZnVuY3Rpb24odCxlKXt2YXIgbj1uZXcgcXQodCxlKSxyPXRoaXMub3MuZ2V0KG4pO2lmKHZvaWQgMD09PXRoaXMuc2hhcmVbdF0pdGhpcy5zaGFyZVt0XT1yO2Vsc2UgaWYodGhpcy5zaGFyZVt0XSE9PXIpdGhyb3cgbmV3IEVycm9yKFwiVHlwZSBpcyBhbHJlYWR5IGRlZmluZWQgd2l0aCBhIGRpZmZlcmVudCBjb25zdHJ1Y3RvclwiKTtyZXR1cm4gcn19LHtrZXk6XCJnZXRcIix2YWx1ZTpmdW5jdGlvbih0KXtyZXR1cm4gdGhpcy5zaGFyZVt0XX19LHtrZXk6XCJkaXNjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb25uZWN0ZWQ/KHRoaXMuY29ubmVjdGVkPSExLHRoaXMuY29ubmVjdG9yLmRpc2Nvbm5lY3QoKSk6UHJvbWlzZS5yZXNvbHZlKCl9fSx7a2V5OlwicmVjb25uZWN0XCIsdmFsdWU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb25uZWN0ZWQ/UHJvbWlzZS5yZXNvbHZlKCk6KHRoaXMuY29ubmVjdGVkPSEwLHRoaXMuY29ubmVjdG9yLnJlY29ubmVjdCgpKX19LHtrZXk6XCJkZXN0cm95XCIsdmFsdWU6ZnVuY3Rpb24oKXtFdChZLnByb3RvdHlwZS5fX3Byb3RvX198fE9iamVjdC5nZXRQcm90b3R5cGVPZihZLnByb3RvdHlwZSksXCJkZXN0cm95XCIsdGhpcykuY2FsbCh0aGlzKSx0aGlzLnNoYXJlPW51bGwsbnVsbCE9dGhpcy5jb25uZWN0b3ImJihudWxsIT10aGlzLmNvbm5lY3Rvci5kZXN0cm95P3RoaXMuY29ubmVjdG9yLmRlc3Ryb3koKTp0aGlzLmNvbm5lY3Rvci5kaXNjb25uZWN0KCkpLG51bGwhPT10aGlzLnBlcnNpc3RlbmNlJiYodGhpcy5wZXJzaXN0ZW5jZS5kZWluaXQodGhpcyksdGhpcy5wZXJzaXN0ZW5jZT1udWxsKSx0aGlzLm9zPW51bGwsdGhpcy5kcz1udWxsLHRoaXMuc3M9bnVsbH19LHtrZXk6XCJfc3RhcnRcIixnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gbnVsbH0sc2V0OmZ1bmN0aW9uKHQpe3JldHVybiBudWxsfX1dKSxZfShHdCk7WS5leHRlbmQ9ZnVuY3Rpb24oKXtmb3IodmFyIHQ9MDt0PGFyZ3VtZW50cy5sZW5ndGg7dCsrKXt2YXIgZT1hcmd1bWVudHNbdF07aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgZSl0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIGZ1bmN0aW9uIVwiKTtlKFkpfX07dmFyIGVlPWZ1bmN0aW9uIHQoZSxuLHIpe3ZhciBpPXRoaXM7U3QodGhpcyx0KSx0aGlzLmNyZWF0ZWQ9bmV3IERhdGU7dmFyIG89bi5iZWZvcmVTdGF0ZTtvLmhhcyhlLnVzZXJJRCk/KHRoaXMudG9TdGF0ZT1uZXcgSXQoZS51c2VySUQsZS5zcy5nZXRTdGF0ZShlLnVzZXJJRCktMSksdGhpcy5mcm9tU3RhdGU9bmV3IEl0KGUudXNlcklELG8uZ2V0KGUudXNlcklEKSkpOih0aGlzLnRvU3RhdGU9bnVsbCx0aGlzLmZyb21TdGF0ZT1udWxsKSx0aGlzLmRlbGV0ZWRTdHJ1Y3RzPW5ldyBTZXQsbi5kZWxldGVkU3RydWN0cy5mb3JFYWNoKGZ1bmN0aW9uKHQpe2kuZGVsZXRlZFN0cnVjdHMuYWRkKHtmcm9tOnQuX2lkLGxlbjp0Ll9sZW5ndGh9KX0pLHRoaXMuYmluZGluZ0luZm9zPXJ9LG5lPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXt2YXIgbj10aGlzLHI9YXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOnt9O1N0KHRoaXMsdCksdGhpcy5vcHRpb25zPXIsdGhpcy5fYmluZGluZ3M9bmV3IFNldChyLmJpbmRpbmdzKSxyLmNhcHR1cmVUaW1lb3V0PW51bGw9PXIuY2FwdHVyZVRpbWVvdXQ/NTAwOnIuY2FwdHVyZVRpbWVvdXQsdGhpcy5fdW5kb0J1ZmZlcj1bXSx0aGlzLl9yZWRvQnVmZmVyPVtdLHRoaXMuX3Njb3BlPWUsdGhpcy5fdW5kb2luZz0hMSx0aGlzLl9yZWRvaW5nPSExLHRoaXMuX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITE7dmFyIGk9ZS5feTt0aGlzLnk9aSxpLl9oYXNVbmRvTWFuYWdlcj0hMDt2YXIgbz12b2lkIDA7aS5vbihcImJlZm9yZVRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxlLHIpe3J8fChvPW5ldyBNYXAsbi5fYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbih0KXtvLnNldCh0LHQuX2dldFVuZG9TdGFja0luZm8oKSl9KSl9KSxpLm9uKFwiYWZ0ZXJUcmFuc2FjdGlvblwiLGZ1bmN0aW9uKHQsaSxhKXtpZighYSYmaS5jaGFuZ2VkUGFyZW50VHlwZXMuaGFzKGUpKXt2YXIgcz1uZXcgZWUodCxpLG8pO2lmKG4uX3VuZG9pbmcpbi5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMCxuLl9yZWRvQnVmZmVyLnB1c2gocyk7ZWxzZXt2YXIgbD1uLl91bmRvQnVmZmVyLmxlbmd0aD4wP24uX3VuZG9CdWZmZXJbbi5fdW5kb0J1ZmZlci5sZW5ndGgtMV06bnVsbDshMT09PW4uX3JlZG9pbmcmJiExPT09bi5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbyYmbnVsbCE9PWwmJihyLmNhcHR1cmVUaW1lb3V0PDB8fHMuY3JlYXRlZC1sLmNyZWF0ZWQ8PXIuY2FwdHVyZVRpbWVvdXQpPyhsLmNyZWF0ZWQ9cy5jcmVhdGVkLG51bGwhPT1zLnRvU3RhdGUmJihsLnRvU3RhdGU9cy50b1N0YXRlLG51bGw9PT1sLmZyb21TdGF0ZSYmKGwuZnJvbVN0YXRlPXMuZnJvbVN0YXRlKSkscy5kZWxldGVkU3RydWN0cy5mb3JFYWNoKGwuZGVsZXRlZFN0cnVjdHMuYWRkLGwuZGVsZXRlZFN0cnVjdHMpKToobi5fbGFzdFRyYW5zYWN0aW9uV2FzVW5kbz0hMSxuLl91bmRvQnVmZmVyLnB1c2gocykpLG4uX3JlZG9pbmd8fChuLl9yZWRvQnVmZmVyPVtdKX19fSl9cmV0dXJuIE90KHQsW3trZXk6XCJmbHVzaENoYW5nZXNcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMuX2xhc3RUcmFuc2FjdGlvbldhc1VuZG89ITB9fSx7a2V5OlwidW5kb1wiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy5fdW5kb2luZz0hMDt2YXIgdD11dCh0aGlzLnksdGhpcy5fc2NvcGUsdGhpcy5fdW5kb0J1ZmZlcik7cmV0dXJuIHRoaXMuX3VuZG9pbmc9ITEsdH19LHtrZXk6XCJyZWRvXCIsdmFsdWU6ZnVuY3Rpb24oKXt0aGlzLl9yZWRvaW5nPSEwO3ZhciB0PXV0KHRoaXMueSx0aGlzLl9zY29wZSx0aGlzLl9yZWRvQnVmZmVyKTtyZXR1cm4gdGhpcy5fcmVkb2luZz0hMSx0fX1dKSx0fSgpLHJlPTFlMyxpZT02MCpyZSxvZT02MCppZSxhZT0yNCpvZSxzZT0zNjUuMjUqYWUsbGU9ZnVuY3Rpb24odCxlKXtlPWV8fHt9O3ZhciBuPXZvaWQgMD09PXQ/XCJ1bmRlZmluZWRcIjp3dCh0KTtpZihcInN0cmluZ1wiPT09biYmdC5sZW5ndGg+MClyZXR1cm4gaHQodCk7aWYoXCJudW1iZXJcIj09PW4mJiExPT09aXNOYU4odCkpcmV0dXJuIGUubG9uZz9kdCh0KTpmdCh0KTt0aHJvdyBuZXcgRXJyb3IoXCJ2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIHZhbGlkIG51bWJlci4gdmFsPVwiK0pTT04uc3RyaW5naWZ5KHQpKX0sdWU9T2JqZWN0LmZyZWV6ZSh7ZGVmYXVsdDpsZSxfX21vZHVsZUV4cG9ydHM6bGV9KSxjZT11ZSYmbGV8fHVlLGhlPWN0KGZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0KXt2YXIgbixyPTA7Zm9yKG4gaW4gdClyPShyPDw1KS1yK3QuY2hhckNvZGVBdChuKSxyfD0wO3JldHVybiBlLmNvbG9yc1tNYXRoLmFicyhyKSVlLmNvbG9ycy5sZW5ndGhdfWZ1bmN0aW9uIHIodCl7ZnVuY3Rpb24gcigpe2lmKHIuZW5hYmxlZCl7dmFyIHQ9cixuPStuZXcgRGF0ZSxpPW4tKGx8fG4pO3QuZGlmZj1pLHQucHJldj1sLHQuY3Vycj1uLGw9bjtmb3IodmFyIG89bmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpLGE9MDthPG8ubGVuZ3RoO2ErKylvW2FdPWFyZ3VtZW50c1thXTtvWzBdPWUuY29lcmNlKG9bMF0pLFwic3RyaW5nXCIhPXR5cGVvZiBvWzBdJiZvLnVuc2hpZnQoXCIlT1wiKTt2YXIgcz0wO29bMF09b1swXS5yZXBsYWNlKC8lKFthLXpBLVolXSkvZyxmdW5jdGlvbihuLHIpe2lmKFwiJSVcIj09PW4pcmV0dXJuIG47cysrO3ZhciBpPWUuZm9ybWF0dGVyc1tyXTtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBpKXt2YXIgYT1vW3NdO249aS5jYWxsKHQsYSksby5zcGxpY2UocywxKSxzLS19cmV0dXJuIG59KSxlLmZvcm1hdEFyZ3MuY2FsbCh0LG8pOyhyLmxvZ3x8ZS5sb2d8fGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSkpLmFwcGx5KHQsbyl9fXJldHVybiByLm5hbWVzcGFjZT10LHIuZW5hYmxlZD1lLmVuYWJsZWQodCksci51c2VDb2xvcnM9ZS51c2VDb2xvcnMoKSxyLmNvbG9yPW4odCksXCJmdW5jdGlvblwiPT10eXBlb2YgZS5pbml0JiZlLmluaXQocikscn1mdW5jdGlvbiBpKHQpe2Uuc2F2ZSh0KSxlLm5hbWVzPVtdLGUuc2tpcHM9W107Zm9yKHZhciBuPShcInN0cmluZ1wiPT10eXBlb2YgdD90OlwiXCIpLnNwbGl0KC9bXFxzLF0rLykscj1uLmxlbmd0aCxpPTA7aTxyO2krKyluW2ldJiYodD1uW2ldLnJlcGxhY2UoL1xcKi9nLFwiLio/XCIpLFwiLVwiPT09dFswXT9lLnNraXBzLnB1c2gobmV3IFJlZ0V4cChcIl5cIit0LnN1YnN0cigxKStcIiRcIikpOmUubmFtZXMucHVzaChuZXcgUmVnRXhwKFwiXlwiK3QrXCIkXCIpKSl9ZnVuY3Rpb24gbygpe2UuZW5hYmxlKFwiXCIpfWZ1bmN0aW9uIGEodCl7dmFyIG4scjtmb3Iobj0wLHI9ZS5za2lwcy5sZW5ndGg7bjxyO24rKylpZihlLnNraXBzW25dLnRlc3QodCkpcmV0dXJuITE7Zm9yKG49MCxyPWUubmFtZXMubGVuZ3RoO248cjtuKyspaWYoZS5uYW1lc1tuXS50ZXN0KHQpKXJldHVybiEwO3JldHVybiExfWZ1bmN0aW9uIHModCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBFcnJvcj90LnN0YWNrfHx0Lm1lc3NhZ2U6dH1lPXQuZXhwb3J0cz1yLmRlYnVnPXIuZGVmYXVsdD1yLGUuY29lcmNlPXMsZS5kaXNhYmxlPW8sZS5lbmFibGU9aSxlLmVuYWJsZWQ9YSxlLmh1bWFuaXplPWNlLGUubmFtZXM9W10sZS5za2lwcz1bXSxlLmZvcm1hdHRlcnM9e307dmFyIGx9KSxmZT1oZS5jb2VyY2UsZGU9aGUuZGlzYWJsZSxfZT1oZS5lbmFibGUsdmU9aGUuZW5hYmxlZCxwZT1oZS5odW1hbml6ZSx5ZT1oZS5uYW1lcyxnZT1oZS5za2lwcyxtZT1oZS5mb3JtYXR0ZXJzLGtlPU9iamVjdC5mcmVlemUoe2RlZmF1bHQ6aGUsX19tb2R1bGVFeHBvcnRzOmhlLGNvZXJjZTpmZSxkaXNhYmxlOmRlLGVuYWJsZTpfZSxlbmFibGVkOnZlLGh1bWFuaXplOnBlLG5hbWVzOnllLHNraXBzOmdlLGZvcm1hdHRlcnM6bWV9KSxiZT1rZSYmaGV8fGtlLHdlPWN0KGZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbigpe3JldHVybiEoXCJ1bmRlZmluZWRcIj09dHlwZW9mIHdpbmRvd3x8IXdpbmRvdy5wcm9jZXNzfHxcInJlbmRlcmVyXCIhPT13aW5kb3cucHJvY2Vzcy50eXBlKXx8KFwidW5kZWZpbmVkXCIhPXR5cGVvZiBkb2N1bWVudCYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5XZWJraXRBcHBlYXJhbmNlfHxcInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93JiZ3aW5kb3cuY29uc29sZSYmKHdpbmRvdy5jb25zb2xlLmZpcmVidWd8fHdpbmRvdy5jb25zb2xlLmV4Y2VwdGlvbiYmd2luZG93LmNvbnNvbGUudGFibGUpfHxcInVuZGVmaW5lZFwiIT10eXBlb2YgbmF2aWdhdG9yJiZuYXZpZ2F0b3IudXNlckFnZW50JiZuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2ZpcmVmb3hcXC8oXFxkKykvKSYmcGFyc2VJbnQoUmVnRXhwLiQxLDEwKT49MzF8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQmJm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvYXBwbGV3ZWJraXRcXC8oXFxkKykvKSl9ZnVuY3Rpb24gcih0KXt2YXIgbj10aGlzLnVzZUNvbG9ycztpZih0WzBdPShuP1wiJWNcIjpcIlwiKSt0aGlzLm5hbWVzcGFjZSsobj9cIiAlY1wiOlwiIFwiKSt0WzBdKyhuP1wiJWMgXCI6XCIgXCIpK1wiK1wiK2UuaHVtYW5pemUodGhpcy5kaWZmKSxuKXt2YXIgcj1cImNvbG9yOiBcIit0aGlzLmNvbG9yO3Quc3BsaWNlKDEsMCxyLFwiY29sb3I6IGluaGVyaXRcIik7dmFyIGk9MCxvPTA7dFswXS5yZXBsYWNlKC8lW2EtekEtWiVdL2csZnVuY3Rpb24odCl7XCIlJVwiIT09dCYmKGkrKyxcIiVjXCI9PT10JiYobz1pKSl9KSx0LnNwbGljZShvLDAscil9fWZ1bmN0aW9uIGkoKXtyZXR1cm5cIm9iamVjdFwiPT09KFwidW5kZWZpbmVkXCI9PXR5cGVvZiBjb25zb2xlP1widW5kZWZpbmVkXCI6d3QoY29uc29sZSkpJiZjb25zb2xlLmxvZyYmRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csY29uc29sZSxhcmd1bWVudHMpfWZ1bmN0aW9uIG8odCl7dHJ5e251bGw9PXQ/ZS5zdG9yYWdlLnJlbW92ZUl0ZW0oXCJkZWJ1Z1wiKTplLnN0b3JhZ2UuZGVidWc9dH1jYXRjaCh0KXt9fWZ1bmN0aW9uIGEoKXt2YXIgdDt0cnl7dD1lLnN0b3JhZ2UuZGVidWd9Y2F0Y2godCl7fXJldHVybiF0JiZcInVuZGVmaW5lZFwiIT10eXBlb2YgcHJvY2VzcyYmXCJlbnZcImluIHByb2Nlc3MmJih0PXByb2Nlc3MuZW52LkRFQlVHKSx0fWU9dC5leHBvcnRzPWJlLGUubG9nPWksZS5mb3JtYXRBcmdzPXIsZS5zYXZlPW8sZS5sb2FkPWEsZS51c2VDb2xvcnM9bixlLnN0b3JhZ2U9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNocm9tZSYmdm9pZCAwIT09Y2hyb21lLnN0b3JhZ2U/Y2hyb21lLnN0b3JhZ2UubG9jYWw6ZnVuY3Rpb24oKXt0cnl7cmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2V9Y2F0Y2godCl7fX0oKSxlLmNvbG9ycz1bXCJsaWdodHNlYWdyZWVuXCIsXCJmb3Jlc3RncmVlblwiLFwiZ29sZGVucm9kXCIsXCJkb2RnZXJibHVlXCIsXCJkYXJrb3JjaGlkXCIsXCJjcmltc29uXCJdLGUuZm9ybWF0dGVycy5qPWZ1bmN0aW9uKHQpe3RyeXtyZXR1cm4gSlNPTi5zdHJpbmdpZnkodCl9Y2F0Y2godCl7cmV0dXJuXCJbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogXCIrdC5tZXNzYWdlfX0sZS5lbmFibGUoYSgpKX0pLFNlPSh3ZS5sb2csd2UuZm9ybWF0QXJncyx3ZS5zYXZlLHdlLmxvYWQsd2UudXNlQ29sb3JzLHdlLnN0b3JhZ2Usd2UuY29sb3JzLGZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlLG4pe2lmKFN0KHRoaXMsdCksdGhpcy55PWUsdGhpcy5vcHRzPW4sbnVsbD09bi5yb2xlfHxcIm1hc3RlclwiPT09bi5yb2xlKXRoaXMucm9sZT1cIm1hc3RlclwiO2Vsc2V7aWYoXCJzbGF2ZVwiIT09bi5yb2xlKXRocm93IG5ldyBFcnJvcihcIlJvbGUgbXVzdCBiZSBlaXRoZXIgJ21hc3Rlcicgb3IgJ3NsYXZlJyFcIik7dGhpcy5yb2xlPVwic2xhdmVcIn10aGlzLmxvZz13ZShcInk6Y29ubmVjdG9yXCIpLHRoaXMubG9nTWVzc2FnZT13ZShcInk6Y29ubmVjdG9yLW1lc3NhZ2VcIiksdGhpcy5fZm9yd2FyZEFwcGxpZWRTdHJ1Y3RzPW4uZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zfHwhMSx0aGlzLnJvbGU9bi5yb2xlLHRoaXMuY29ubmVjdGlvbnM9bmV3IE1hcCx0aGlzLmlzU3luY2VkPSExLHRoaXMudXNlckV2ZW50TGlzdGVuZXJzPVtdLHRoaXMud2hlblN5bmNlZExpc3RlbmVycz1bXSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy5kZWJ1Zz0hMD09PW4uZGVidWcsdGhpcy5icm9hZGNhc3RCdWZmZXI9bmV3IEx0LHRoaXMuYnJvYWRjYXN0QnVmZmVyU2l6ZT0wLHRoaXMucHJvdG9jb2xWZXJzaW9uPTExLHRoaXMuYXV0aEluZm89bi5hdXRofHxudWxsLHRoaXMuY2hlY2tBdXRoPW4uY2hlY2tBdXRofHxmdW5jdGlvbigpe3JldHVybiBQcm9taXNlLnJlc29sdmUoXCJ3cml0ZVwiKX0sbnVsbD09bi5tYXhCdWZmZXJMZW5ndGg/dGhpcy5tYXhCdWZmZXJMZW5ndGg9LTE6dGhpcy5tYXhCdWZmZXJMZW5ndGg9bi5tYXhCdWZmZXJMZW5ndGh9cmV0dXJuIE90KHQsW3trZXk6XCJyZWNvbm5lY3RcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMubG9nKFwicmVjb25uZWN0aW5nLi5cIil9fSx7a2V5OlwiZGlzY29ubmVjdFwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubG9nKFwiZGlzY3Jvbm5lY3RpbmcuLlwiKSx0aGlzLmNvbm5lY3Rpb25zPW5ldyBNYXAsdGhpcy5pc1N5bmNlZD0hMSx0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0PW51bGwsdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLFByb21pc2UucmVzb2x2ZSgpfX0se2tleTpcIm9uVXNlckV2ZW50XCIsdmFsdWU6ZnVuY3Rpb24odCl7dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJyZW1vdmVVc2VyRXZlbnRMaXN0ZW5lclwiLHZhbHVlOmZ1bmN0aW9uKHQpe3RoaXMudXNlckV2ZW50TGlzdGVuZXJzPXRoaXMudXNlckV2ZW50TGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm4gdCE9PWV9KX19LHtrZXk6XCJ1c2VyTGVmdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXt0aGlzLmxvZyhcIiVzOiBVc2VyIGxlZnQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuZGVsZXRlKHQpLHRoaXMuX3NldFN5bmNlZFdpdGgobnVsbCk7dmFyIGU9ITAsbj0hMSxyPXZvaWQgMDt0cnl7Zm9yKHZhciBpLG89dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoZT0oaT1vLm5leHQoKSkuZG9uZSk7ZT0hMCl7KDAsaS52YWx1ZSkoe2FjdGlvbjpcInVzZXJMZWZ0XCIsdXNlcjp0fSl9fWNhdGNoKHQpe249ITAscj10fWZpbmFsbHl7dHJ5eyFlJiZvLnJldHVybiYmby5yZXR1cm4oKX1maW5hbGx5e2lmKG4pdGhyb3cgcn19fX19LHtrZXk6XCJ1c2VySm9pbmVkXCIsdmFsdWU6ZnVuY3Rpb24odCxlLG4pe2lmKG51bGw9PWUpdGhyb3cgbmV3IEVycm9yKFwiWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhXCIpO2lmKHRoaXMuY29ubmVjdGlvbnMuaGFzKHQpKXRocm93IG5ldyBFcnJvcihcIlRoaXMgdXNlciBhbHJlYWR5IGpvaW5lZCFcIik7dGhpcy5sb2coXCIlczogVXNlciBqb2luZWQgJXNcIix0aGlzLnkudXNlcklELHQpLHRoaXMuY29ubmVjdGlvbnMuc2V0KHQse3VpZDp0LGlzU3luY2VkOiExLHJvbGU6ZSxwcm9jZXNzQWZ0ZXJBdXRoOltdLHByb2Nlc3NBZnRlclN5bmM6W10sYXV0aDpufHxudWxsLHJlY2VpdmVkU3luY1N0ZXAyOiExfSk7dmFyIHI9e307ci5wcm9taXNlPW5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3IucmVzb2x2ZT10fSksdGhpcy5jb25uZWN0aW9ucy5nZXQodCkuc3luY1N0ZXAyPXI7dmFyIGk9ITAsbz0hMSxhPXZvaWQgMDt0cnl7Zm9yKHZhciBzLGw9dGhpcy51c2VyRXZlbnRMaXN0ZW5lcnNbU3ltYm9sLml0ZXJhdG9yXSgpOyEoaT0ocz1sLm5leHQoKSkuZG9uZSk7aT0hMCl7KDAscy52YWx1ZSkoe2FjdGlvbjpcInVzZXJKb2luZWRcIix1c2VyOnQscm9sZTplfSl9fWNhdGNoKHQpe289ITAsYT10fWZpbmFsbHl7dHJ5eyFpJiZsLnJldHVybiYmbC5yZXR1cm4oKX1maW5hbGx5e2lmKG8pdGhyb3cgYX19dGhpcy5fc3luY1dpdGhVc2VyKHQpfX0se2tleTpcIndoZW5TeW5jZWRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLmlzU3luY2VkP3QoKTp0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMucHVzaCh0KX19LHtrZXk6XCJfc3luY1dpdGhVc2VyXCIsdmFsdWU6ZnVuY3Rpb24odCl7XCJzbGF2ZVwiIT09dGhpcy5yb2xlJiZ1KHRoaXMsdCl9fSx7a2V5OlwiX2ZpcmVJc1N5bmNlZExpc3RlbmVyc1wiLHZhbHVlOmZ1bmN0aW9uKCl7aWYoIXRoaXMuaXNTeW5jZWQpe3RoaXMuaXNTeW5jZWQ9ITA7dmFyIHQ9ITAsZT0hMSxuPXZvaWQgMDt0cnl7Zm9yKHZhciByLGk9dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzW1N5bWJvbC5pdGVyYXRvcl0oKTshKHQ9KHI9aS5uZXh0KCkpLmRvbmUpO3Q9ITApeygwLHIudmFsdWUpKCl9fWNhdGNoKHQpe2U9ITAsbj10fWZpbmFsbHl7dHJ5eyF0JiZpLnJldHVybiYmaS5yZXR1cm4oKX1maW5hbGx5e2lmKGUpdGhyb3cgbn19dGhpcy53aGVuU3luY2VkTGlzdGVuZXJzPVtdLHRoaXMueS5fc2V0Q29udGVudFJlYWR5KCksdGhpcy55LmVtaXQoXCJzeW5jZWRcIil9fX0se2tleTpcInNlbmRcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueTtpZighKGUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlcyB0byBVc2VyJXM6IFNlbmQgJyV5J1wiLG4udXNlcklELHQsZSksdGhpcy5sb2dNZXNzYWdlKFwiVXNlciVzIHRvIFVzZXIlczogU2VuZCAlWVwiLG4udXNlcklELHQsW24sZV0pfX0se2tleTpcImJyb2FkY2FzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMueTtpZighKHQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8dCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKXRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIE1lc3NhZ2UgdG8gYmUgYW4gQXJyYXlCdWZmZXIgb3IgVWludDhBcnJheSAtIGRvbid0IHVzZSB0aGlzIG1ldGhvZCB0byBzZW5kIGN1c3RvbSBtZXNzYWdlc1wiKTt0aGlzLmxvZyhcIlVzZXIlczogQnJvYWRjYXN0ICcleSdcIixlLnVzZXJJRCx0KSx0aGlzLmxvZ01lc3NhZ2UoXCJVc2VyJXM6IEJyb2FkY2FzdDogJVlcIixlLnVzZXJJRCxbZSx0XSl9fSx7a2V5OlwiYnJvYWRjYXN0U3RydWN0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPTA9PT10aGlzLmJyb2FkY2FzdEJ1ZmZlci5sZW5ndGg7aWYobiYmKHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVmFyU3RyaW5nKHRoaXMueS5yb29tKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlci53cml0ZVZhclN0cmluZyhcInVwZGF0ZVwiKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemU9MCx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3M9dGhpcy5icm9hZGNhc3RCdWZmZXIucG9zLHRoaXMuYnJvYWRjYXN0QnVmZmVyLndyaXRlVWludDMyKDApKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemUrKyx0Ll90b0JpbmFyeSh0aGlzLmJyb2FkY2FzdEJ1ZmZlciksdGhpcy5tYXhCdWZmZXJMZW5ndGg+MCYmdGhpcy5icm9hZGNhc3RCdWZmZXIubGVuZ3RoPnRoaXMubWF4QnVmZmVyTGVuZ3RoKXt2YXIgcj10aGlzLmJyb2FkY2FzdEJ1ZmZlcjtyLnNldFVpbnQzMih0aGlzLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsdGhpcy5icm9hZGNhc3RCdWZmZXJTaXplKSx0aGlzLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgTHQsdGhpcy53aGVuUmVtb3RlUmVzcG9uc2l2ZSgpLnRoZW4oZnVuY3Rpb24oKXtlLmJyb2FkY2FzdChyLmNyZWF0ZUJ1ZmZlcigpKX0pfWVsc2UgbiYmc2V0VGltZW91dChmdW5jdGlvbigpe2lmKGUuYnJvYWRjYXN0QnVmZmVyLmxlbmd0aD4wKXt2YXIgdD1lLmJyb2FkY2FzdEJ1ZmZlcjt0LnNldFVpbnQzMihlLmJyb2FkY2FzdEJ1ZmZlclNpemVQb3MsZS5icm9hZGNhc3RCdWZmZXJTaXplKSxlLmJyb2FkY2FzdCh0LmNyZWF0ZUJ1ZmZlcigpKSxlLmJyb2FkY2FzdEJ1ZmZlcj1uZXcgTHR9fSwwKX19LHtrZXk6XCJ3aGVuUmVtb3RlUmVzcG9uc2l2ZVwiLHZhbHVlOmZ1bmN0aW9uKCl7cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHQpe3NldFRpbWVvdXQodCwxMDApfSl9fSx7a2V5OlwicmVjZWl2ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIHI9dGhpcyxpPXRoaXMueSxvPWkudXNlcklEO2lmKG49bnx8ITEsIShlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXJ8fGUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSlyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKFwiRXhwZWN0ZWQgTWVzc2FnZSB0byBiZSBhbiBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IVwiKSk7aWYodD09PW8pcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO3ZhciBhPW5ldyBOdChlKSxzPW5ldyBMdCxsPWEucmVhZFZhclN0cmluZygpO3Mud3JpdGVWYXJTdHJpbmcobCk7dmFyIHU9YS5yZWFkVmFyU3RyaW5nKCksYz10aGlzLmNvbm5lY3Rpb25zLmdldCh0KTtpZih0aGlzLmxvZyhcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAnJXMnXCIsbyx0LHUpLHRoaXMubG9nTWVzc2FnZShcIlVzZXIlcyBmcm9tIFVzZXIlczogUmVjZWl2ZSAlWVwiLG8sdCxbaSxlXSksbnVsbD09YyYmIW4pdGhyb3cgbmV3IEVycm9yKFwiUmVjZWl2ZWQgbWVzc2FnZSBmcm9tIHVua25vd24gcGVlciFcIik7aWYoXCJzeW5jIHN0ZXAgMVwiPT09dXx8XCJzeW5jIHN0ZXAgMlwiPT09dSl7dmFyIGg9YS5yZWFkVmFyVWludCgpO2lmKG51bGw9PWMuYXV0aClyZXR1cm4gYy5wcm9jZXNzQWZ0ZXJBdXRoLnB1c2goW3UsYyxhLHMsdF0pLHRoaXMuY2hlY2tBdXRoKGgsaSx0KS50aGVuKGZ1bmN0aW9uKHQpe251bGw9PWMuYXV0aCYmKGMuYXV0aD10LGkuZW1pdChcInVzZXJBdXRoZW50aWNhdGVkXCIse3VzZXI6Yy51aWQsYXV0aDp0fSkpO3ZhciBlPWMucHJvY2Vzc0FmdGVyQXV0aDtjLnByb2Nlc3NBZnRlckF1dGg9W10sZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe3JldHVybiByLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX0pfSFuJiZudWxsPT1jLmF1dGh8fFwidXBkYXRlXCI9PT11JiYhYy5pc1N5bmNlZD9jLnByb2Nlc3NBZnRlclN5bmMucHVzaChbdSxjLGEscyx0LCExXSk6dGhpcy5jb21wdXRlTWVzc2FnZSh1LGMsYSxzLHQsbil9fSx7a2V5OlwiY29tcHV0ZU1lc3NhZ2VcIix2YWx1ZTpmdW5jdGlvbih0LGUsbixpLG8sYSl7aWYoXCJzeW5jIHN0ZXAgMVwiIT09dHx8XCJ3cml0ZVwiIT09ZS5hdXRoJiZcInJlYWRcIiE9PWUuYXV0aCl7dmFyIHM9dGhpcy55O3MudHJhbnNhY3QoZnVuY3Rpb24oKXtpZihcInN5bmMgc3RlcCAyXCI9PT10JiZcIndyaXRlXCI9PT1lLmF1dGgpZChuLGkscyxlLG8pO2Vsc2V7aWYoXCJ1cGRhdGVcIiE9PXR8fCFhJiZcIndyaXRlXCIhPT1lLmF1dGgpdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHJlY2VpdmUgbWVzc2FnZVwiKTtyKHMsbil9fSwhMCl9ZWxzZSBoKG4saSx0aGlzLnksZSxvKX19LHtrZXk6XCJfc2V0U3luY2VkV2l0aFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7aWYobnVsbCE9dCl7dmFyIG49dGhpcy5jb25uZWN0aW9ucy5nZXQodCk7bi5pc1N5bmNlZD0hMDt2YXIgcj1uLnByb2Nlc3NBZnRlclN5bmM7bi5wcm9jZXNzQWZ0ZXJTeW5jPVtdLHIuZm9yRWFjaChmdW5jdGlvbih0KXtlLmNvbXB1dGVNZXNzYWdlKHRbMF0sdFsxXSx0WzJdLHRbM10sdFs0XSl9KX12YXIgaT1BcnJheS5mcm9tKHRoaXMuY29ubmVjdGlvbnMudmFsdWVzKCkpO2kubGVuZ3RoPjAmJmkuZXZlcnkoZnVuY3Rpb24odCl7cmV0dXJuIHQuaXNTeW5jZWR9KSYmdGhpcy5fZmlyZUlzU3luY2VkTGlzdGVuZXJzKCl9fV0pLHR9KCkpLE9lPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gdChlKXtTdCh0aGlzLHQpLHRoaXMub3B0cz1lLHRoaXMueXM9bmV3IE1hcH1yZXR1cm4gT3QodCxbe2tleTpcIl9pbml0XCIsdmFsdWU6ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPXRoaXMueXMuZ2V0KHQpO3JldHVybiB2b2lkIDA9PT1uPyhuPXl0KCksbi5tdXR1YWxFeGNsdWRlPUsoKSx0aGlzLnlzLnNldCh0LG4pLHRoaXMuaW5pdCh0KS50aGVuKGZ1bmN0aW9uKCl7cmV0dXJuIHQub24oXCJhZnRlclRyYW5zYWN0aW9uXCIsZnVuY3Rpb24odCxuKXt2YXIgcj1lLnlzLmdldCh0KTtpZihyLmxlbj4wKXtyLmJ1ZmZlci5zZXRVaW50MzIoMCxyLmxlbiksZS5zYXZlVXBkYXRlKHQsci5idWZmZXIuY3JlYXRlQnVmZmVyKCksbik7dmFyIGk9eXQoKTtmb3IodmFyIG8gaW4gaSlyW29dPWlbb119fSksZS5yZXRyaWV2ZSh0KX0pLnRoZW4oZnVuY3Rpb24oKXtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG4pfSkpOlByb21pc2UucmVzb2x2ZShuKX19LHtrZXk6XCJkZWluaXRcIix2YWx1ZTpmdW5jdGlvbih0KXt0aGlzLnlzLmRlbGV0ZSh0KSx0LnBlcnNpc3RlbmNlPW51bGx9fSx7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy55cz1udWxsfX0se2tleTpcInJlbW92ZVBlcnNpc3RlZERhdGFcIix2YWx1ZTpmdW5jdGlvbih0KXt2YXIgZT10aGlzLG49IShhcmd1bWVudHMubGVuZ3RoPjEmJnZvaWQgMCE9PWFyZ3VtZW50c1sxXSl8fGFyZ3VtZW50c1sxXTt0aGlzLnlzLmZvckVhY2goZnVuY3Rpb24ocixpKXtpLnJvb209PT10JiYobj9pLmRlc3Ryb3koKTplLmRlaW5pdChpKSl9KX19LHtrZXk6XCJzYXZlVXBkYXRlXCIsdmFsdWU6ZnVuY3Rpb24odCl7fX0se2tleTpcInNhdmVTdHJ1Y3RcIix2YWx1ZTpmdW5jdGlvbih0LGUpe3ZhciBuPXRoaXMueXMuZ2V0KHQpO3ZvaWQgMCE9PW4mJm4ubXV0dWFsRXhjbHVkZShmdW5jdGlvbigpe2UuX3RvQmluYXJ5KG4uYnVmZmVyKSxuLmxlbisrfSl9fSx7a2V5OlwicmV0cmlldmVcIix2YWx1ZTpmdW5jdGlvbih0LGUsbil7dmFyIGk9dGhpcy55cy5nZXQodCk7dm9pZCAwIT09aSYmaS5tdXR1YWxFeGNsdWRlKGZ1bmN0aW9uKCl7dC50cmFuc2FjdChmdW5jdGlvbigpe2lmKG51bGwhPWUmJnZ0KHQsbmV3IE50KG5ldyBVaW50OEFycmF5KGUpKSksbnVsbCE9bilmb3IodmFyIGk9MDtpPG4ubGVuZ3RoO2krKylyKHQsbmV3IE50KG5ldyBVaW50OEFycmF5KG5baV0pKSl9KSx0LmVtaXQoXCJwZXJzaXN0ZW5jZVJlYWR5XCIpfSl9fSx7a2V5OlwicGVyc2lzdFwiLHZhbHVlOmZ1bmN0aW9uKHQpe3JldHVybiBwdCh0KS5jcmVhdGVCdWZmZXIoKX19XSksdH0oKSxFZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7U3QodGhpcyxlKTt2YXIgcj1UdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4udmFsdWU9dC50b1N0cmluZygpLHIuX3R5cGVPYnNlcnZlcj1ndC5iaW5kKHIpLHIuX2RvbU9ic2VydmVyPW10LmJpbmQociksdC5vYnNlcnZlKHIuX3R5cGVPYnNlcnZlciksbi5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIixyLl9kb21PYnNlcnZlcikscn1yZXR1cm4gVXQoZSx0KSxPdChlLFt7a2V5OlwiZGVzdHJveVwiLHZhbHVlOmZ1bmN0aW9uKCl7dGhpcy50eXBlLnVub2JzZXJ2ZSh0aGlzLl90eXBlT2JzZXJ2ZXIpLHRoaXMudGFyZ2V0LnVub2JzZXJ2ZSh0aGlzLl9kb21PYnNlcnZlciksRXQoZS5wcm90b3R5cGUuX19wcm90b19ffHxPYmplY3QuZ2V0UHJvdG90eXBlT2YoZS5wcm90b3R5cGUpLFwiZGVzdHJveVwiLHRoaXMpLmNhbGwodGhpcyl9fV0pLGV9KFp0KSxVZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHQsbil7U3QodGhpcyxlKTt2YXIgcj1UdCh0aGlzLChlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUpKS5jYWxsKHRoaXMsdCxuKSk7cmV0dXJuIG4uc2V0Q29udGVudHModC50b0RlbHRhKCksXCJ5anNcIiksci5fdHlwZU9ic2VydmVyPWt0LmJpbmQociksci5fcXVpbGxPYnNlcnZlcj1idC5iaW5kKHIpLHQub2JzZXJ2ZShyLl90eXBlT2JzZXJ2ZXIpLG4ub24oXCJ0ZXh0LWNoYW5nZVwiLHIuX3F1aWxsT2JzZXJ2ZXIpLHJ9cmV0dXJuIFV0KGUsdCksT3QoZSxbe2tleTpcImRlc3Ryb3lcIix2YWx1ZTpmdW5jdGlvbigpe3RoaXMudHlwZS51bm9ic2VydmUodGhpcy5fdHlwZU9ic2VydmVyKSx0aGlzLnRhcmdldC5vZmYoXCJ0ZXh0LWNoYW5nZVwiLHRoaXMuX3F1aWxsT2JzZXJ2ZXIpLEV0KGUucHJvdG90eXBlLl9fcHJvdG9fX3x8T2JqZWN0LmdldFByb3RvdHlwZU9mKGUucHJvdG90eXBlKSxcImRlc3Ryb3lcIix0aGlzKS5jYWxsKHRoaXMpfX1dKSxlfShadCk7cmV0dXJuIFkuQWJzdHJhY3RDb25uZWN0b3I9U2UsWS5BYnN0cmFjdFBlcnNpc3RlbmNlPU9lLFkuQXJyYXk9WUFycmF5LFkuTWFwPVlNYXAsWS5UZXh0PVlUZXh0LFkuWG1sRWxlbWVudD1ZWG1sRWxlbWVudCxZLlhtbEZyYWdtZW50PVlYbWxGcmFnbWVudCxZLlhtbFRleHQ9WVhtbFRleHQsWS5YbWxIb29rPVlYbWxIb29rLFkuVGV4dGFyZWFCaW5kaW5nPUVlLFkuUXVpbGxCaW5kaW5nPVVlLFkuRG9tQmluZGluZz10ZSx0ZS5kb21Ub1R5cGU9TCx0ZS5kb21zVG9UeXBlcz1KLHRlLnN3aXRjaEFzc29jaWF0aW9uPVcsWS51dGlscz17QmluYXJ5RGVjb2RlcjpOdCxVbmRvTWFuYWdlcjpuZSxnZXRSZWxhdGl2ZVBvc2l0aW9uOlosZnJvbVJlbGF0aXZlUG9zaXRpb246USxyZWdpc3RlclN0cnVjdDpxLGludGVncmF0ZVJlbW90ZVN0cnVjdHM6cix0b0JpbmFyeTpwdCxmcm9tQmluYXJ5OnZ0fSxZLmRlYnVnPXdlLHdlLmZvcm1hdHRlcnMuWT1fLHdlLmZvcm1hdHRlcnMueT12LFl9KTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXkuanMubWFwXG4iLCJ2YXIgWSA9IHJlcXVpcmUoJ3lqcycpO1xud2luZG93LlkgPSBZO1xucmVxdWlyZSgneS13ZWJydGMzJykoWSk7XG5cbnZhciB1cmwgPSBuZXcgVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbnZhciB5aWQgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcImlkXCIpO1xudmFyIHkgPSBuZXcgWSh5aWQsIHtcbiAgICBjb25uZWN0b3I6IHtcbiAgICAgICAgbmFtZTogJ3dlYnJ0YycsXG4gICAgICAgIHJvb206IHlpZCxcbiAgICAgICAgdXJsOiAnaHR0cDovL2ZpbnBsYW5lLmlvOjEyNTYnXG4gICAgfVxufSk7XG53aW5kb3cueSA9IHk7XG5cbmZ1bmN0aW9uIHN0YXJ0X3liaW5kaW5ncygpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNfYXZhaWxhYmxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBmb3IgKHZhciBpZCBpbiBzaGFyZWRfZWxlbWVudHMpIHtcbiAgICAgICAgICAgIHZhciBjb2RlbWlycm9yID0gc2hhcmVkX2VsZW1lbnRzW2lkXVsnY29kZW1pcnJvciddO1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IHNoYXJlZF9lbGVtZW50c1tpZF1bJ291dHB1dCddO1xuICAgICAgICAgICAgbmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3InK2lkLCBZLlRleHQpLCBjb2RlbWlycm9yKTtcbiAgICAgICAgICAgIG5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbCcraWQsIFkuWG1sRnJhZ21lbnQpLCBvdXRwdXQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cucmVzb2x2ZV95bWFwID0gdHJ1ZTtcbiAgICAgICAgdmFyIHltYXAgPSB5LmRlZmluZSgneW1hcCcsIFkuTWFwKTtcbiAgICAgICAgeW1hcC5vYnNlcnZlKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBleGVjX3ltYXAoKTtcbiAgICAgICAgICAgIGlmICh3aW5kb3cucmVzb2x2ZV95bWFwKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnJlc29sdmVfeW1hcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGV4ZWNfeW1hcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgd2luZG93LnltYXAgPSB5bWFwO1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZXhlY195bWFwKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBKdXB5dGVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgSnVweXRlci5ub3RlYm9vayAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IHltYXAua2V5cygpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGluZGV4IGluIGtleXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlkID0ga2V5c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIHNldF9jZWxsKGlkLCB5bWFwLmdldChpZClbJ2luZGV4J10sIHltYXAuZ2V0KGlkKVsnYWN0aXZlJ10pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChleGVjX3ltYXAsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cuZ2V0X2luYWN0aXZlX2NlbGwgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIGNlbGxzID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxjZWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjZWxsc1tpXS5jZWxsX3R5cGUgPT09IHR5cGUgJiYgY2VsbHNbaV0ubWV0YWRhdGEuYWN0aXZlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2VsbHNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB3aW5kb3cuZ2V0X2NlbGwgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgIHZhciBjZWxscyA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGxzKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8Y2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2VsbHNbaV0ubWV0YWRhdGEuaWQgPT09IGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjZWxsc1tpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdpbmRvdy5zZXRfY2VsbCA9IGZ1bmN0aW9uIChpZCwgaW5kZXgsIGFjdGl2ZSkge1xuICAgICAgICAgICAgZnVuY3Rpb24gc2V0X2VsZW1lbnQoZWxlbWVudCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICB2YXIgdG8gPSAkKCcjbm90ZWJvb2stY29udGFpbmVyJyk7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvLnByZXBlbmQoZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdG8uY2hpbGRyZW4oKS5lcShpbmRleC0xKS5hZnRlcihlbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIGNlbGwgPSBnZXRfY2VsbChwYXJzZUludChpZCkpO1xuICAgICAgICAgICAgc2V0X2VsZW1lbnQoY2VsbC5lbGVtZW50LCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YS5hY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5mb2N1c19jZWxsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgY2VsbC5zZXRfdGV4dCgnJyk7XG4gICAgICAgICAgICAgICAgaWYgKGNlbGwuY2VsbF90eXBlID09PSAnY29kZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5vdXRwdXRfYXJlYS5jbGVhcl9vdXRwdXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YS5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQoc3RhcnRfeWJpbmRpbmdzLCAwKTtcbiAgICB9XG59XG5zdGFydF95YmluZGluZ3MoKTtcbiJdfQ==
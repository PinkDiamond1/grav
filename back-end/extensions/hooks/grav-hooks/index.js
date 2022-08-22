'use strict';

var require$$1 = require('http');
var require$$2 = require('https');
var require$$0 = require('url');
var require$$3 = require('stream');
var require$$4 = require('assert');
var require$$8 = require('zlib');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
var require$$3__default = /*#__PURE__*/_interopDefaultLegacy(require$$3);
var require$$4__default = /*#__PURE__*/_interopDefaultLegacy(require$$4);
var require$$8__default = /*#__PURE__*/_interopDefaultLegacy(require$$8);

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var bn = {exports: {}};

(function (module) {
(function (module, exports) {

  // Utils
  function assert (val, msg) {
    if (!val) throw new Error(msg || 'Assertion failed');
  }

  // Could use `inherits` module, but don't want to move from single file
  // architecture yet.
  function inherits (ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  }

  // BN

  function BN (number, base, endian) {
    if (BN.isBN(number)) {
      return number;
    }

    this.negative = 0;
    this.words = null;
    this.length = 0;

    // Reduction context
    this.red = null;

    if (number !== null) {
      if (base === 'le' || base === 'be') {
        endian = base;
        base = 10;
      }

      this._init(number || 0, base || 10, endian || 'be');
    }
  }
  if (typeof module === 'object') {
    module.exports = BN;
  } else {
    exports.BN = BN;
  }

  BN.BN = BN;
  BN.wordSize = 26;

  var Buffer;
  try {
    if (typeof window !== 'undefined' && typeof window.Buffer !== 'undefined') {
      Buffer = window.Buffer;
    } else {
      Buffer = require('buffer').Buffer;
    }
  } catch (e) {
  }

  BN.isBN = function isBN (num) {
    if (num instanceof BN) {
      return true;
    }

    return num !== null && typeof num === 'object' &&
      num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
  };

  BN.max = function max (left, right) {
    if (left.cmp(right) > 0) return left;
    return right;
  };

  BN.min = function min (left, right) {
    if (left.cmp(right) < 0) return left;
    return right;
  };

  BN.prototype._init = function init (number, base, endian) {
    if (typeof number === 'number') {
      return this._initNumber(number, base, endian);
    }

    if (typeof number === 'object') {
      return this._initArray(number, base, endian);
    }

    if (base === 'hex') {
      base = 16;
    }
    assert(base === (base | 0) && base >= 2 && base <= 36);

    number = number.toString().replace(/\s+/g, '');
    var start = 0;
    if (number[0] === '-') {
      start++;
      this.negative = 1;
    }

    if (start < number.length) {
      if (base === 16) {
        this._parseHex(number, start, endian);
      } else {
        this._parseBase(number, base, start);
        if (endian === 'le') {
          this._initArray(this.toArray(), base, endian);
        }
      }
    }
  };

  BN.prototype._initNumber = function _initNumber (number, base, endian) {
    if (number < 0) {
      this.negative = 1;
      number = -number;
    }
    if (number < 0x4000000) {
      this.words = [number & 0x3ffffff];
      this.length = 1;
    } else if (number < 0x10000000000000) {
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff
      ];
      this.length = 2;
    } else {
      assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff,
        1
      ];
      this.length = 3;
    }

    if (endian !== 'le') return;

    // Reverse the bytes
    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initArray = function _initArray (number, base, endian) {
    // Perhaps a Uint8Array
    assert(typeof number.length === 'number');
    if (number.length <= 0) {
      this.words = [0];
      this.length = 1;
      return this;
    }

    this.length = Math.ceil(number.length / 3);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    var off = 0;
    if (endian === 'be') {
      for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
        w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    } else if (endian === 'le') {
      for (i = 0, j = 0; i < number.length; i += 3) {
        w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    }
    return this._strip();
  };

  function parseHex4Bits (string, index) {
    var c = string.charCodeAt(index);
    // '0' - '9'
    if (c >= 48 && c <= 57) {
      return c - 48;
    // 'A' - 'F'
    } else if (c >= 65 && c <= 70) {
      return c - 55;
    // 'a' - 'f'
    } else if (c >= 97 && c <= 102) {
      return c - 87;
    } else {
      assert(false, 'Invalid character in ' + string);
    }
  }

  function parseHexByte (string, lowerBound, index) {
    var r = parseHex4Bits(string, index);
    if (index - 1 >= lowerBound) {
      r |= parseHex4Bits(string, index - 1) << 4;
    }
    return r;
  }

  BN.prototype._parseHex = function _parseHex (number, start, endian) {
    // Create possibly bigger array to ensure that it fits the number
    this.length = Math.ceil((number.length - start) / 6);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    // 24-bits chunks
    var off = 0;
    var j = 0;

    var w;
    if (endian === 'be') {
      for (i = number.length - 1; i >= start; i -= 2) {
        w = parseHexByte(number, start, i) << off;
        this.words[j] |= w & 0x3ffffff;
        if (off >= 18) {
          off -= 18;
          j += 1;
          this.words[j] |= w >>> 26;
        } else {
          off += 8;
        }
      }
    } else {
      var parseLength = number.length - start;
      for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
        w = parseHexByte(number, start, i) << off;
        this.words[j] |= w & 0x3ffffff;
        if (off >= 18) {
          off -= 18;
          j += 1;
          this.words[j] |= w >>> 26;
        } else {
          off += 8;
        }
      }
    }

    this._strip();
  };

  function parseBase (str, start, end, mul) {
    var r = 0;
    var b = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r *= mul;

      // 'a'
      if (c >= 49) {
        b = c - 49 + 0xa;

      // 'A'
      } else if (c >= 17) {
        b = c - 17 + 0xa;

      // '0' - '9'
      } else {
        b = c;
      }
      assert(c >= 0 && b < mul, 'Invalid character');
      r += b;
    }
    return r;
  }

  BN.prototype._parseBase = function _parseBase (number, base, start) {
    // Initialize as zero
    this.words = [0];
    this.length = 1;

    // Find length of limb in base
    for (var limbLen = 0, limbPow = 1; limbPow <= 0x3ffffff; limbPow *= base) {
      limbLen++;
    }
    limbLen--;
    limbPow = (limbPow / base) | 0;

    var total = number.length - start;
    var mod = total % limbLen;
    var end = Math.min(total, total - mod) + start;

    var word = 0;
    for (var i = start; i < end; i += limbLen) {
      word = parseBase(number, i, i + limbLen, base);

      this.imuln(limbPow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    if (mod !== 0) {
      var pow = 1;
      word = parseBase(number, i, number.length, base);

      for (i = 0; i < mod; i++) {
        pow *= base;
      }

      this.imuln(pow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    this._strip();
  };

  BN.prototype.copy = function copy (dest) {
    dest.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      dest.words[i] = this.words[i];
    }
    dest.length = this.length;
    dest.negative = this.negative;
    dest.red = this.red;
  };

  function move (dest, src) {
    dest.words = src.words;
    dest.length = src.length;
    dest.negative = src.negative;
    dest.red = src.red;
  }

  BN.prototype._move = function _move (dest) {
    move(dest, this);
  };

  BN.prototype.clone = function clone () {
    var r = new BN(null);
    this.copy(r);
    return r;
  };

  BN.prototype._expand = function _expand (size) {
    while (this.length < size) {
      this.words[this.length++] = 0;
    }
    return this;
  };

  // Remove leading `0` from `this`
  BN.prototype._strip = function strip () {
    while (this.length > 1 && this.words[this.length - 1] === 0) {
      this.length--;
    }
    return this._normSign();
  };

  BN.prototype._normSign = function _normSign () {
    // -0 = 0
    if (this.length === 1 && this.words[0] === 0) {
      this.negative = 0;
    }
    return this;
  };

  // Check Symbol.for because not everywhere where Symbol defined
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Browser_compatibility
  if (typeof Symbol !== 'undefined' && typeof Symbol.for === 'function') {
    try {
      BN.prototype[Symbol.for('nodejs.util.inspect.custom')] = inspect;
    } catch (e) {
      BN.prototype.inspect = inspect;
    }
  } else {
    BN.prototype.inspect = inspect;
  }

  function inspect () {
    return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
  }

  /*

  var zeros = [];
  var groupSizes = [];
  var groupBases = [];

  var s = '';
  var i = -1;
  while (++i < BN.wordSize) {
    zeros[i] = s;
    s += '0';
  }
  groupSizes[0] = 0;
  groupSizes[1] = 0;
  groupBases[0] = 0;
  groupBases[1] = 0;
  var base = 2 - 1;
  while (++base < 36 + 1) {
    var groupSize = 0;
    var groupBase = 1;
    while (groupBase < (1 << BN.wordSize) / base) {
      groupBase *= base;
      groupSize += 1;
    }
    groupSizes[base] = groupSize;
    groupBases[base] = groupBase;
  }

  */

  var zeros = [
    '',
    '0',
    '00',
    '000',
    '0000',
    '00000',
    '000000',
    '0000000',
    '00000000',
    '000000000',
    '0000000000',
    '00000000000',
    '000000000000',
    '0000000000000',
    '00000000000000',
    '000000000000000',
    '0000000000000000',
    '00000000000000000',
    '000000000000000000',
    '0000000000000000000',
    '00000000000000000000',
    '000000000000000000000',
    '0000000000000000000000',
    '00000000000000000000000',
    '000000000000000000000000',
    '0000000000000000000000000'
  ];

  var groupSizes = [
    0, 0,
    25, 16, 12, 11, 10, 9, 8,
    8, 7, 7, 7, 7, 6, 6,
    6, 6, 6, 6, 6, 5, 5,
    5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5
  ];

  var groupBases = [
    0, 0,
    33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
    43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
    16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
    6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
    24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
  ];

  BN.prototype.toString = function toString (base, padding) {
    base = base || 10;
    padding = padding | 0 || 1;

    var out;
    if (base === 16 || base === 'hex') {
      out = '';
      var off = 0;
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w = this.words[i];
        var word = (((w << off) | carry) & 0xffffff).toString(16);
        carry = (w >>> (24 - off)) & 0xffffff;
        off += 2;
        if (off >= 26) {
          off -= 26;
          i--;
        }
        if (carry !== 0 || i !== this.length - 1) {
          out = zeros[6 - word.length] + word + out;
        } else {
          out = word + out;
        }
      }
      if (carry !== 0) {
        out = carry.toString(16) + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    if (base === (base | 0) && base >= 2 && base <= 36) {
      // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
      var groupSize = groupSizes[base];
      // var groupBase = Math.pow(base, groupSize);
      var groupBase = groupBases[base];
      out = '';
      var c = this.clone();
      c.negative = 0;
      while (!c.isZero()) {
        var r = c.modrn(groupBase).toString(base);
        c = c.idivn(groupBase);

        if (!c.isZero()) {
          out = zeros[groupSize - r.length] + r + out;
        } else {
          out = r + out;
        }
      }
      if (this.isZero()) {
        out = '0' + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    assert(false, 'Base should be between 2 and 36');
  };

  BN.prototype.toNumber = function toNumber () {
    var ret = this.words[0];
    if (this.length === 2) {
      ret += this.words[1] * 0x4000000;
    } else if (this.length === 3 && this.words[2] === 0x01) {
      // NOTE: at this stage it is known that the top bit is set
      ret += 0x10000000000000 + (this.words[1] * 0x4000000);
    } else if (this.length > 2) {
      assert(false, 'Number can only safely store up to 53 bits');
    }
    return (this.negative !== 0) ? -ret : ret;
  };

  BN.prototype.toJSON = function toJSON () {
    return this.toString(16, 2);
  };

  if (Buffer) {
    BN.prototype.toBuffer = function toBuffer (endian, length) {
      return this.toArrayLike(Buffer, endian, length);
    };
  }

  BN.prototype.toArray = function toArray (endian, length) {
    return this.toArrayLike(Array, endian, length);
  };

  var allocate = function allocate (ArrayType, size) {
    if (ArrayType.allocUnsafe) {
      return ArrayType.allocUnsafe(size);
    }
    return new ArrayType(size);
  };

  BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
    this._strip();

    var byteLength = this.byteLength();
    var reqLength = length || Math.max(1, byteLength);
    assert(byteLength <= reqLength, 'byte array longer than desired length');
    assert(reqLength > 0, 'Requested array length <= 0');

    var res = allocate(ArrayType, reqLength);
    var postfix = endian === 'le' ? 'LE' : 'BE';
    this['_toArrayLike' + postfix](res, byteLength);
    return res;
  };

  BN.prototype._toArrayLikeLE = function _toArrayLikeLE (res, byteLength) {
    var position = 0;
    var carry = 0;

    for (var i = 0, shift = 0; i < this.length; i++) {
      var word = (this.words[i] << shift) | carry;

      res[position++] = word & 0xff;
      if (position < res.length) {
        res[position++] = (word >> 8) & 0xff;
      }
      if (position < res.length) {
        res[position++] = (word >> 16) & 0xff;
      }

      if (shift === 6) {
        if (position < res.length) {
          res[position++] = (word >> 24) & 0xff;
        }
        carry = 0;
        shift = 0;
      } else {
        carry = word >>> 24;
        shift += 2;
      }
    }

    if (position < res.length) {
      res[position++] = carry;

      while (position < res.length) {
        res[position++] = 0;
      }
    }
  };

  BN.prototype._toArrayLikeBE = function _toArrayLikeBE (res, byteLength) {
    var position = res.length - 1;
    var carry = 0;

    for (var i = 0, shift = 0; i < this.length; i++) {
      var word = (this.words[i] << shift) | carry;

      res[position--] = word & 0xff;
      if (position >= 0) {
        res[position--] = (word >> 8) & 0xff;
      }
      if (position >= 0) {
        res[position--] = (word >> 16) & 0xff;
      }

      if (shift === 6) {
        if (position >= 0) {
          res[position--] = (word >> 24) & 0xff;
        }
        carry = 0;
        shift = 0;
      } else {
        carry = word >>> 24;
        shift += 2;
      }
    }

    if (position >= 0) {
      res[position--] = carry;

      while (position >= 0) {
        res[position--] = 0;
      }
    }
  };

  if (Math.clz32) {
    BN.prototype._countBits = function _countBits (w) {
      return 32 - Math.clz32(w);
    };
  } else {
    BN.prototype._countBits = function _countBits (w) {
      var t = w;
      var r = 0;
      if (t >= 0x1000) {
        r += 13;
        t >>>= 13;
      }
      if (t >= 0x40) {
        r += 7;
        t >>>= 7;
      }
      if (t >= 0x8) {
        r += 4;
        t >>>= 4;
      }
      if (t >= 0x02) {
        r += 2;
        t >>>= 2;
      }
      return r + t;
    };
  }

  BN.prototype._zeroBits = function _zeroBits (w) {
    // Short-cut
    if (w === 0) return 26;

    var t = w;
    var r = 0;
    if ((t & 0x1fff) === 0) {
      r += 13;
      t >>>= 13;
    }
    if ((t & 0x7f) === 0) {
      r += 7;
      t >>>= 7;
    }
    if ((t & 0xf) === 0) {
      r += 4;
      t >>>= 4;
    }
    if ((t & 0x3) === 0) {
      r += 2;
      t >>>= 2;
    }
    if ((t & 0x1) === 0) {
      r++;
    }
    return r;
  };

  // Return number of used bits in a BN
  BN.prototype.bitLength = function bitLength () {
    var w = this.words[this.length - 1];
    var hi = this._countBits(w);
    return (this.length - 1) * 26 + hi;
  };

  function toBitArray (num) {
    var w = new Array(num.bitLength());

    for (var bit = 0; bit < w.length; bit++) {
      var off = (bit / 26) | 0;
      var wbit = bit % 26;

      w[bit] = (num.words[off] >>> wbit) & 0x01;
    }

    return w;
  }

  // Number of trailing zero bits
  BN.prototype.zeroBits = function zeroBits () {
    if (this.isZero()) return 0;

    var r = 0;
    for (var i = 0; i < this.length; i++) {
      var b = this._zeroBits(this.words[i]);
      r += b;
      if (b !== 26) break;
    }
    return r;
  };

  BN.prototype.byteLength = function byteLength () {
    return Math.ceil(this.bitLength() / 8);
  };

  BN.prototype.toTwos = function toTwos (width) {
    if (this.negative !== 0) {
      return this.abs().inotn(width).iaddn(1);
    }
    return this.clone();
  };

  BN.prototype.fromTwos = function fromTwos (width) {
    if (this.testn(width - 1)) {
      return this.notn(width).iaddn(1).ineg();
    }
    return this.clone();
  };

  BN.prototype.isNeg = function isNeg () {
    return this.negative !== 0;
  };

  // Return negative clone of `this`
  BN.prototype.neg = function neg () {
    return this.clone().ineg();
  };

  BN.prototype.ineg = function ineg () {
    if (!this.isZero()) {
      this.negative ^= 1;
    }

    return this;
  };

  // Or `num` with `this` in-place
  BN.prototype.iuor = function iuor (num) {
    while (this.length < num.length) {
      this.words[this.length++] = 0;
    }

    for (var i = 0; i < num.length; i++) {
      this.words[i] = this.words[i] | num.words[i];
    }

    return this._strip();
  };

  BN.prototype.ior = function ior (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuor(num);
  };

  // Or `num` with `this`
  BN.prototype.or = function or (num) {
    if (this.length > num.length) return this.clone().ior(num);
    return num.clone().ior(this);
  };

  BN.prototype.uor = function uor (num) {
    if (this.length > num.length) return this.clone().iuor(num);
    return num.clone().iuor(this);
  };

  // And `num` with `this` in-place
  BN.prototype.iuand = function iuand (num) {
    // b = min-length(num, this)
    var b;
    if (this.length > num.length) {
      b = num;
    } else {
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = this.words[i] & num.words[i];
    }

    this.length = b.length;

    return this._strip();
  };

  BN.prototype.iand = function iand (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuand(num);
  };

  // And `num` with `this`
  BN.prototype.and = function and (num) {
    if (this.length > num.length) return this.clone().iand(num);
    return num.clone().iand(this);
  };

  BN.prototype.uand = function uand (num) {
    if (this.length > num.length) return this.clone().iuand(num);
    return num.clone().iuand(this);
  };

  // Xor `num` with `this` in-place
  BN.prototype.iuxor = function iuxor (num) {
    // a.length > b.length
    var a;
    var b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = a.words[i] ^ b.words[i];
    }

    if (this !== a) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = a.length;

    return this._strip();
  };

  BN.prototype.ixor = function ixor (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuxor(num);
  };

  // Xor `num` with `this`
  BN.prototype.xor = function xor (num) {
    if (this.length > num.length) return this.clone().ixor(num);
    return num.clone().ixor(this);
  };

  BN.prototype.uxor = function uxor (num) {
    if (this.length > num.length) return this.clone().iuxor(num);
    return num.clone().iuxor(this);
  };

  // Not ``this`` with ``width`` bitwidth
  BN.prototype.inotn = function inotn (width) {
    assert(typeof width === 'number' && width >= 0);

    var bytesNeeded = Math.ceil(width / 26) | 0;
    var bitsLeft = width % 26;

    // Extend the buffer with leading zeroes
    this._expand(bytesNeeded);

    if (bitsLeft > 0) {
      bytesNeeded--;
    }

    // Handle complete words
    for (var i = 0; i < bytesNeeded; i++) {
      this.words[i] = ~this.words[i] & 0x3ffffff;
    }

    // Handle the residue
    if (bitsLeft > 0) {
      this.words[i] = ~this.words[i] & (0x3ffffff >> (26 - bitsLeft));
    }

    // And remove leading zeroes
    return this._strip();
  };

  BN.prototype.notn = function notn (width) {
    return this.clone().inotn(width);
  };

  // Set `bit` of `this`
  BN.prototype.setn = function setn (bit, val) {
    assert(typeof bit === 'number' && bit >= 0);

    var off = (bit / 26) | 0;
    var wbit = bit % 26;

    this._expand(off + 1);

    if (val) {
      this.words[off] = this.words[off] | (1 << wbit);
    } else {
      this.words[off] = this.words[off] & ~(1 << wbit);
    }

    return this._strip();
  };

  // Add `num` to `this` in-place
  BN.prototype.iadd = function iadd (num) {
    var r;

    // negative + positive
    if (this.negative !== 0 && num.negative === 0) {
      this.negative = 0;
      r = this.isub(num);
      this.negative ^= 1;
      return this._normSign();

    // positive + negative
    } else if (this.negative === 0 && num.negative !== 0) {
      num.negative = 0;
      r = this.isub(num);
      num.negative = 1;
      return r._normSign();
    }

    // a.length > b.length
    var a, b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }

    this.length = a.length;
    if (carry !== 0) {
      this.words[this.length] = carry;
      this.length++;
    // Copy the rest of the words
    } else if (a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    return this;
  };

  // Add `num` to `this`
  BN.prototype.add = function add (num) {
    var res;
    if (num.negative !== 0 && this.negative === 0) {
      num.negative = 0;
      res = this.sub(num);
      num.negative ^= 1;
      return res;
    } else if (num.negative === 0 && this.negative !== 0) {
      this.negative = 0;
      res = num.sub(this);
      this.negative = 1;
      return res;
    }

    if (this.length > num.length) return this.clone().iadd(num);

    return num.clone().iadd(this);
  };

  // Subtract `num` from `this` in-place
  BN.prototype.isub = function isub (num) {
    // this - (-num) = this + num
    if (num.negative !== 0) {
      num.negative = 0;
      var r = this.iadd(num);
      num.negative = 1;
      return r._normSign();

    // -this - num = -(this + num)
    } else if (this.negative !== 0) {
      this.negative = 0;
      this.iadd(num);
      this.negative = 1;
      return this._normSign();
    }

    // At this point both numbers are positive
    var cmp = this.cmp(num);

    // Optimization - zeroify
    if (cmp === 0) {
      this.negative = 0;
      this.length = 1;
      this.words[0] = 0;
      return this;
    }

    // a > b
    var a, b;
    if (cmp > 0) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }

    // Copy rest of the words
    if (carry === 0 && i < a.length && a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = Math.max(this.length, i);

    if (a !== this) {
      this.negative = 1;
    }

    return this._strip();
  };

  // Subtract `num` from `this`
  BN.prototype.sub = function sub (num) {
    return this.clone().isub(num);
  };

  function smallMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    var len = (self.length + num.length) | 0;
    out.length = len;
    len = (len - 1) | 0;

    // Peel one iteration (compiler can't do it, because of code complexity)
    var a = self.words[0] | 0;
    var b = num.words[0] | 0;
    var r = a * b;

    var lo = r & 0x3ffffff;
    var carry = (r / 0x4000000) | 0;
    out.words[0] = lo;

    for (var k = 1; k < len; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = carry >>> 26;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = (k - j) | 0;
        a = self.words[i] | 0;
        b = num.words[j] | 0;
        r = a * b + rword;
        ncarry += (r / 0x4000000) | 0;
        rword = r & 0x3ffffff;
      }
      out.words[k] = rword | 0;
      carry = ncarry | 0;
    }
    if (carry !== 0) {
      out.words[k] = carry | 0;
    } else {
      out.length--;
    }

    return out._strip();
  }

  // TODO(indutny): it may be reasonable to omit it for users who don't need
  // to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
  // multiplication (like elliptic secp256k1).
  var comb10MulTo = function comb10MulTo (self, num, out) {
    var a = self.words;
    var b = num.words;
    var o = out.words;
    var c = 0;
    var lo;
    var mid;
    var hi;
    var a0 = a[0] | 0;
    var al0 = a0 & 0x1fff;
    var ah0 = a0 >>> 13;
    var a1 = a[1] | 0;
    var al1 = a1 & 0x1fff;
    var ah1 = a1 >>> 13;
    var a2 = a[2] | 0;
    var al2 = a2 & 0x1fff;
    var ah2 = a2 >>> 13;
    var a3 = a[3] | 0;
    var al3 = a3 & 0x1fff;
    var ah3 = a3 >>> 13;
    var a4 = a[4] | 0;
    var al4 = a4 & 0x1fff;
    var ah4 = a4 >>> 13;
    var a5 = a[5] | 0;
    var al5 = a5 & 0x1fff;
    var ah5 = a5 >>> 13;
    var a6 = a[6] | 0;
    var al6 = a6 & 0x1fff;
    var ah6 = a6 >>> 13;
    var a7 = a[7] | 0;
    var al7 = a7 & 0x1fff;
    var ah7 = a7 >>> 13;
    var a8 = a[8] | 0;
    var al8 = a8 & 0x1fff;
    var ah8 = a8 >>> 13;
    var a9 = a[9] | 0;
    var al9 = a9 & 0x1fff;
    var ah9 = a9 >>> 13;
    var b0 = b[0] | 0;
    var bl0 = b0 & 0x1fff;
    var bh0 = b0 >>> 13;
    var b1 = b[1] | 0;
    var bl1 = b1 & 0x1fff;
    var bh1 = b1 >>> 13;
    var b2 = b[2] | 0;
    var bl2 = b2 & 0x1fff;
    var bh2 = b2 >>> 13;
    var b3 = b[3] | 0;
    var bl3 = b3 & 0x1fff;
    var bh3 = b3 >>> 13;
    var b4 = b[4] | 0;
    var bl4 = b4 & 0x1fff;
    var bh4 = b4 >>> 13;
    var b5 = b[5] | 0;
    var bl5 = b5 & 0x1fff;
    var bh5 = b5 >>> 13;
    var b6 = b[6] | 0;
    var bl6 = b6 & 0x1fff;
    var bh6 = b6 >>> 13;
    var b7 = b[7] | 0;
    var bl7 = b7 & 0x1fff;
    var bh7 = b7 >>> 13;
    var b8 = b[8] | 0;
    var bl8 = b8 & 0x1fff;
    var bh8 = b8 >>> 13;
    var b9 = b[9] | 0;
    var bl9 = b9 & 0x1fff;
    var bh9 = b9 >>> 13;

    out.negative = self.negative ^ num.negative;
    out.length = 19;
    /* k = 0 */
    lo = Math.imul(al0, bl0);
    mid = Math.imul(al0, bh0);
    mid = (mid + Math.imul(ah0, bl0)) | 0;
    hi = Math.imul(ah0, bh0);
    var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
    w0 &= 0x3ffffff;
    /* k = 1 */
    lo = Math.imul(al1, bl0);
    mid = Math.imul(al1, bh0);
    mid = (mid + Math.imul(ah1, bl0)) | 0;
    hi = Math.imul(ah1, bh0);
    lo = (lo + Math.imul(al0, bl1)) | 0;
    mid = (mid + Math.imul(al0, bh1)) | 0;
    mid = (mid + Math.imul(ah0, bl1)) | 0;
    hi = (hi + Math.imul(ah0, bh1)) | 0;
    var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
    w1 &= 0x3ffffff;
    /* k = 2 */
    lo = Math.imul(al2, bl0);
    mid = Math.imul(al2, bh0);
    mid = (mid + Math.imul(ah2, bl0)) | 0;
    hi = Math.imul(ah2, bh0);
    lo = (lo + Math.imul(al1, bl1)) | 0;
    mid = (mid + Math.imul(al1, bh1)) | 0;
    mid = (mid + Math.imul(ah1, bl1)) | 0;
    hi = (hi + Math.imul(ah1, bh1)) | 0;
    lo = (lo + Math.imul(al0, bl2)) | 0;
    mid = (mid + Math.imul(al0, bh2)) | 0;
    mid = (mid + Math.imul(ah0, bl2)) | 0;
    hi = (hi + Math.imul(ah0, bh2)) | 0;
    var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
    w2 &= 0x3ffffff;
    /* k = 3 */
    lo = Math.imul(al3, bl0);
    mid = Math.imul(al3, bh0);
    mid = (mid + Math.imul(ah3, bl0)) | 0;
    hi = Math.imul(ah3, bh0);
    lo = (lo + Math.imul(al2, bl1)) | 0;
    mid = (mid + Math.imul(al2, bh1)) | 0;
    mid = (mid + Math.imul(ah2, bl1)) | 0;
    hi = (hi + Math.imul(ah2, bh1)) | 0;
    lo = (lo + Math.imul(al1, bl2)) | 0;
    mid = (mid + Math.imul(al1, bh2)) | 0;
    mid = (mid + Math.imul(ah1, bl2)) | 0;
    hi = (hi + Math.imul(ah1, bh2)) | 0;
    lo = (lo + Math.imul(al0, bl3)) | 0;
    mid = (mid + Math.imul(al0, bh3)) | 0;
    mid = (mid + Math.imul(ah0, bl3)) | 0;
    hi = (hi + Math.imul(ah0, bh3)) | 0;
    var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
    w3 &= 0x3ffffff;
    /* k = 4 */
    lo = Math.imul(al4, bl0);
    mid = Math.imul(al4, bh0);
    mid = (mid + Math.imul(ah4, bl0)) | 0;
    hi = Math.imul(ah4, bh0);
    lo = (lo + Math.imul(al3, bl1)) | 0;
    mid = (mid + Math.imul(al3, bh1)) | 0;
    mid = (mid + Math.imul(ah3, bl1)) | 0;
    hi = (hi + Math.imul(ah3, bh1)) | 0;
    lo = (lo + Math.imul(al2, bl2)) | 0;
    mid = (mid + Math.imul(al2, bh2)) | 0;
    mid = (mid + Math.imul(ah2, bl2)) | 0;
    hi = (hi + Math.imul(ah2, bh2)) | 0;
    lo = (lo + Math.imul(al1, bl3)) | 0;
    mid = (mid + Math.imul(al1, bh3)) | 0;
    mid = (mid + Math.imul(ah1, bl3)) | 0;
    hi = (hi + Math.imul(ah1, bh3)) | 0;
    lo = (lo + Math.imul(al0, bl4)) | 0;
    mid = (mid + Math.imul(al0, bh4)) | 0;
    mid = (mid + Math.imul(ah0, bl4)) | 0;
    hi = (hi + Math.imul(ah0, bh4)) | 0;
    var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
    w4 &= 0x3ffffff;
    /* k = 5 */
    lo = Math.imul(al5, bl0);
    mid = Math.imul(al5, bh0);
    mid = (mid + Math.imul(ah5, bl0)) | 0;
    hi = Math.imul(ah5, bh0);
    lo = (lo + Math.imul(al4, bl1)) | 0;
    mid = (mid + Math.imul(al4, bh1)) | 0;
    mid = (mid + Math.imul(ah4, bl1)) | 0;
    hi = (hi + Math.imul(ah4, bh1)) | 0;
    lo = (lo + Math.imul(al3, bl2)) | 0;
    mid = (mid + Math.imul(al3, bh2)) | 0;
    mid = (mid + Math.imul(ah3, bl2)) | 0;
    hi = (hi + Math.imul(ah3, bh2)) | 0;
    lo = (lo + Math.imul(al2, bl3)) | 0;
    mid = (mid + Math.imul(al2, bh3)) | 0;
    mid = (mid + Math.imul(ah2, bl3)) | 0;
    hi = (hi + Math.imul(ah2, bh3)) | 0;
    lo = (lo + Math.imul(al1, bl4)) | 0;
    mid = (mid + Math.imul(al1, bh4)) | 0;
    mid = (mid + Math.imul(ah1, bl4)) | 0;
    hi = (hi + Math.imul(ah1, bh4)) | 0;
    lo = (lo + Math.imul(al0, bl5)) | 0;
    mid = (mid + Math.imul(al0, bh5)) | 0;
    mid = (mid + Math.imul(ah0, bl5)) | 0;
    hi = (hi + Math.imul(ah0, bh5)) | 0;
    var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
    w5 &= 0x3ffffff;
    /* k = 6 */
    lo = Math.imul(al6, bl0);
    mid = Math.imul(al6, bh0);
    mid = (mid + Math.imul(ah6, bl0)) | 0;
    hi = Math.imul(ah6, bh0);
    lo = (lo + Math.imul(al5, bl1)) | 0;
    mid = (mid + Math.imul(al5, bh1)) | 0;
    mid = (mid + Math.imul(ah5, bl1)) | 0;
    hi = (hi + Math.imul(ah5, bh1)) | 0;
    lo = (lo + Math.imul(al4, bl2)) | 0;
    mid = (mid + Math.imul(al4, bh2)) | 0;
    mid = (mid + Math.imul(ah4, bl2)) | 0;
    hi = (hi + Math.imul(ah4, bh2)) | 0;
    lo = (lo + Math.imul(al3, bl3)) | 0;
    mid = (mid + Math.imul(al3, bh3)) | 0;
    mid = (mid + Math.imul(ah3, bl3)) | 0;
    hi = (hi + Math.imul(ah3, bh3)) | 0;
    lo = (lo + Math.imul(al2, bl4)) | 0;
    mid = (mid + Math.imul(al2, bh4)) | 0;
    mid = (mid + Math.imul(ah2, bl4)) | 0;
    hi = (hi + Math.imul(ah2, bh4)) | 0;
    lo = (lo + Math.imul(al1, bl5)) | 0;
    mid = (mid + Math.imul(al1, bh5)) | 0;
    mid = (mid + Math.imul(ah1, bl5)) | 0;
    hi = (hi + Math.imul(ah1, bh5)) | 0;
    lo = (lo + Math.imul(al0, bl6)) | 0;
    mid = (mid + Math.imul(al0, bh6)) | 0;
    mid = (mid + Math.imul(ah0, bl6)) | 0;
    hi = (hi + Math.imul(ah0, bh6)) | 0;
    var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
    w6 &= 0x3ffffff;
    /* k = 7 */
    lo = Math.imul(al7, bl0);
    mid = Math.imul(al7, bh0);
    mid = (mid + Math.imul(ah7, bl0)) | 0;
    hi = Math.imul(ah7, bh0);
    lo = (lo + Math.imul(al6, bl1)) | 0;
    mid = (mid + Math.imul(al6, bh1)) | 0;
    mid = (mid + Math.imul(ah6, bl1)) | 0;
    hi = (hi + Math.imul(ah6, bh1)) | 0;
    lo = (lo + Math.imul(al5, bl2)) | 0;
    mid = (mid + Math.imul(al5, bh2)) | 0;
    mid = (mid + Math.imul(ah5, bl2)) | 0;
    hi = (hi + Math.imul(ah5, bh2)) | 0;
    lo = (lo + Math.imul(al4, bl3)) | 0;
    mid = (mid + Math.imul(al4, bh3)) | 0;
    mid = (mid + Math.imul(ah4, bl3)) | 0;
    hi = (hi + Math.imul(ah4, bh3)) | 0;
    lo = (lo + Math.imul(al3, bl4)) | 0;
    mid = (mid + Math.imul(al3, bh4)) | 0;
    mid = (mid + Math.imul(ah3, bl4)) | 0;
    hi = (hi + Math.imul(ah3, bh4)) | 0;
    lo = (lo + Math.imul(al2, bl5)) | 0;
    mid = (mid + Math.imul(al2, bh5)) | 0;
    mid = (mid + Math.imul(ah2, bl5)) | 0;
    hi = (hi + Math.imul(ah2, bh5)) | 0;
    lo = (lo + Math.imul(al1, bl6)) | 0;
    mid = (mid + Math.imul(al1, bh6)) | 0;
    mid = (mid + Math.imul(ah1, bl6)) | 0;
    hi = (hi + Math.imul(ah1, bh6)) | 0;
    lo = (lo + Math.imul(al0, bl7)) | 0;
    mid = (mid + Math.imul(al0, bh7)) | 0;
    mid = (mid + Math.imul(ah0, bl7)) | 0;
    hi = (hi + Math.imul(ah0, bh7)) | 0;
    var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
    w7 &= 0x3ffffff;
    /* k = 8 */
    lo = Math.imul(al8, bl0);
    mid = Math.imul(al8, bh0);
    mid = (mid + Math.imul(ah8, bl0)) | 0;
    hi = Math.imul(ah8, bh0);
    lo = (lo + Math.imul(al7, bl1)) | 0;
    mid = (mid + Math.imul(al7, bh1)) | 0;
    mid = (mid + Math.imul(ah7, bl1)) | 0;
    hi = (hi + Math.imul(ah7, bh1)) | 0;
    lo = (lo + Math.imul(al6, bl2)) | 0;
    mid = (mid + Math.imul(al6, bh2)) | 0;
    mid = (mid + Math.imul(ah6, bl2)) | 0;
    hi = (hi + Math.imul(ah6, bh2)) | 0;
    lo = (lo + Math.imul(al5, bl3)) | 0;
    mid = (mid + Math.imul(al5, bh3)) | 0;
    mid = (mid + Math.imul(ah5, bl3)) | 0;
    hi = (hi + Math.imul(ah5, bh3)) | 0;
    lo = (lo + Math.imul(al4, bl4)) | 0;
    mid = (mid + Math.imul(al4, bh4)) | 0;
    mid = (mid + Math.imul(ah4, bl4)) | 0;
    hi = (hi + Math.imul(ah4, bh4)) | 0;
    lo = (lo + Math.imul(al3, bl5)) | 0;
    mid = (mid + Math.imul(al3, bh5)) | 0;
    mid = (mid + Math.imul(ah3, bl5)) | 0;
    hi = (hi + Math.imul(ah3, bh5)) | 0;
    lo = (lo + Math.imul(al2, bl6)) | 0;
    mid = (mid + Math.imul(al2, bh6)) | 0;
    mid = (mid + Math.imul(ah2, bl6)) | 0;
    hi = (hi + Math.imul(ah2, bh6)) | 0;
    lo = (lo + Math.imul(al1, bl7)) | 0;
    mid = (mid + Math.imul(al1, bh7)) | 0;
    mid = (mid + Math.imul(ah1, bl7)) | 0;
    hi = (hi + Math.imul(ah1, bh7)) | 0;
    lo = (lo + Math.imul(al0, bl8)) | 0;
    mid = (mid + Math.imul(al0, bh8)) | 0;
    mid = (mid + Math.imul(ah0, bl8)) | 0;
    hi = (hi + Math.imul(ah0, bh8)) | 0;
    var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
    w8 &= 0x3ffffff;
    /* k = 9 */
    lo = Math.imul(al9, bl0);
    mid = Math.imul(al9, bh0);
    mid = (mid + Math.imul(ah9, bl0)) | 0;
    hi = Math.imul(ah9, bh0);
    lo = (lo + Math.imul(al8, bl1)) | 0;
    mid = (mid + Math.imul(al8, bh1)) | 0;
    mid = (mid + Math.imul(ah8, bl1)) | 0;
    hi = (hi + Math.imul(ah8, bh1)) | 0;
    lo = (lo + Math.imul(al7, bl2)) | 0;
    mid = (mid + Math.imul(al7, bh2)) | 0;
    mid = (mid + Math.imul(ah7, bl2)) | 0;
    hi = (hi + Math.imul(ah7, bh2)) | 0;
    lo = (lo + Math.imul(al6, bl3)) | 0;
    mid = (mid + Math.imul(al6, bh3)) | 0;
    mid = (mid + Math.imul(ah6, bl3)) | 0;
    hi = (hi + Math.imul(ah6, bh3)) | 0;
    lo = (lo + Math.imul(al5, bl4)) | 0;
    mid = (mid + Math.imul(al5, bh4)) | 0;
    mid = (mid + Math.imul(ah5, bl4)) | 0;
    hi = (hi + Math.imul(ah5, bh4)) | 0;
    lo = (lo + Math.imul(al4, bl5)) | 0;
    mid = (mid + Math.imul(al4, bh5)) | 0;
    mid = (mid + Math.imul(ah4, bl5)) | 0;
    hi = (hi + Math.imul(ah4, bh5)) | 0;
    lo = (lo + Math.imul(al3, bl6)) | 0;
    mid = (mid + Math.imul(al3, bh6)) | 0;
    mid = (mid + Math.imul(ah3, bl6)) | 0;
    hi = (hi + Math.imul(ah3, bh6)) | 0;
    lo = (lo + Math.imul(al2, bl7)) | 0;
    mid = (mid + Math.imul(al2, bh7)) | 0;
    mid = (mid + Math.imul(ah2, bl7)) | 0;
    hi = (hi + Math.imul(ah2, bh7)) | 0;
    lo = (lo + Math.imul(al1, bl8)) | 0;
    mid = (mid + Math.imul(al1, bh8)) | 0;
    mid = (mid + Math.imul(ah1, bl8)) | 0;
    hi = (hi + Math.imul(ah1, bh8)) | 0;
    lo = (lo + Math.imul(al0, bl9)) | 0;
    mid = (mid + Math.imul(al0, bh9)) | 0;
    mid = (mid + Math.imul(ah0, bl9)) | 0;
    hi = (hi + Math.imul(ah0, bh9)) | 0;
    var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
    w9 &= 0x3ffffff;
    /* k = 10 */
    lo = Math.imul(al9, bl1);
    mid = Math.imul(al9, bh1);
    mid = (mid + Math.imul(ah9, bl1)) | 0;
    hi = Math.imul(ah9, bh1);
    lo = (lo + Math.imul(al8, bl2)) | 0;
    mid = (mid + Math.imul(al8, bh2)) | 0;
    mid = (mid + Math.imul(ah8, bl2)) | 0;
    hi = (hi + Math.imul(ah8, bh2)) | 0;
    lo = (lo + Math.imul(al7, bl3)) | 0;
    mid = (mid + Math.imul(al7, bh3)) | 0;
    mid = (mid + Math.imul(ah7, bl3)) | 0;
    hi = (hi + Math.imul(ah7, bh3)) | 0;
    lo = (lo + Math.imul(al6, bl4)) | 0;
    mid = (mid + Math.imul(al6, bh4)) | 0;
    mid = (mid + Math.imul(ah6, bl4)) | 0;
    hi = (hi + Math.imul(ah6, bh4)) | 0;
    lo = (lo + Math.imul(al5, bl5)) | 0;
    mid = (mid + Math.imul(al5, bh5)) | 0;
    mid = (mid + Math.imul(ah5, bl5)) | 0;
    hi = (hi + Math.imul(ah5, bh5)) | 0;
    lo = (lo + Math.imul(al4, bl6)) | 0;
    mid = (mid + Math.imul(al4, bh6)) | 0;
    mid = (mid + Math.imul(ah4, bl6)) | 0;
    hi = (hi + Math.imul(ah4, bh6)) | 0;
    lo = (lo + Math.imul(al3, bl7)) | 0;
    mid = (mid + Math.imul(al3, bh7)) | 0;
    mid = (mid + Math.imul(ah3, bl7)) | 0;
    hi = (hi + Math.imul(ah3, bh7)) | 0;
    lo = (lo + Math.imul(al2, bl8)) | 0;
    mid = (mid + Math.imul(al2, bh8)) | 0;
    mid = (mid + Math.imul(ah2, bl8)) | 0;
    hi = (hi + Math.imul(ah2, bh8)) | 0;
    lo = (lo + Math.imul(al1, bl9)) | 0;
    mid = (mid + Math.imul(al1, bh9)) | 0;
    mid = (mid + Math.imul(ah1, bl9)) | 0;
    hi = (hi + Math.imul(ah1, bh9)) | 0;
    var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
    w10 &= 0x3ffffff;
    /* k = 11 */
    lo = Math.imul(al9, bl2);
    mid = Math.imul(al9, bh2);
    mid = (mid + Math.imul(ah9, bl2)) | 0;
    hi = Math.imul(ah9, bh2);
    lo = (lo + Math.imul(al8, bl3)) | 0;
    mid = (mid + Math.imul(al8, bh3)) | 0;
    mid = (mid + Math.imul(ah8, bl3)) | 0;
    hi = (hi + Math.imul(ah8, bh3)) | 0;
    lo = (lo + Math.imul(al7, bl4)) | 0;
    mid = (mid + Math.imul(al7, bh4)) | 0;
    mid = (mid + Math.imul(ah7, bl4)) | 0;
    hi = (hi + Math.imul(ah7, bh4)) | 0;
    lo = (lo + Math.imul(al6, bl5)) | 0;
    mid = (mid + Math.imul(al6, bh5)) | 0;
    mid = (mid + Math.imul(ah6, bl5)) | 0;
    hi = (hi + Math.imul(ah6, bh5)) | 0;
    lo = (lo + Math.imul(al5, bl6)) | 0;
    mid = (mid + Math.imul(al5, bh6)) | 0;
    mid = (mid + Math.imul(ah5, bl6)) | 0;
    hi = (hi + Math.imul(ah5, bh6)) | 0;
    lo = (lo + Math.imul(al4, bl7)) | 0;
    mid = (mid + Math.imul(al4, bh7)) | 0;
    mid = (mid + Math.imul(ah4, bl7)) | 0;
    hi = (hi + Math.imul(ah4, bh7)) | 0;
    lo = (lo + Math.imul(al3, bl8)) | 0;
    mid = (mid + Math.imul(al3, bh8)) | 0;
    mid = (mid + Math.imul(ah3, bl8)) | 0;
    hi = (hi + Math.imul(ah3, bh8)) | 0;
    lo = (lo + Math.imul(al2, bl9)) | 0;
    mid = (mid + Math.imul(al2, bh9)) | 0;
    mid = (mid + Math.imul(ah2, bl9)) | 0;
    hi = (hi + Math.imul(ah2, bh9)) | 0;
    var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
    w11 &= 0x3ffffff;
    /* k = 12 */
    lo = Math.imul(al9, bl3);
    mid = Math.imul(al9, bh3);
    mid = (mid + Math.imul(ah9, bl3)) | 0;
    hi = Math.imul(ah9, bh3);
    lo = (lo + Math.imul(al8, bl4)) | 0;
    mid = (mid + Math.imul(al8, bh4)) | 0;
    mid = (mid + Math.imul(ah8, bl4)) | 0;
    hi = (hi + Math.imul(ah8, bh4)) | 0;
    lo = (lo + Math.imul(al7, bl5)) | 0;
    mid = (mid + Math.imul(al7, bh5)) | 0;
    mid = (mid + Math.imul(ah7, bl5)) | 0;
    hi = (hi + Math.imul(ah7, bh5)) | 0;
    lo = (lo + Math.imul(al6, bl6)) | 0;
    mid = (mid + Math.imul(al6, bh6)) | 0;
    mid = (mid + Math.imul(ah6, bl6)) | 0;
    hi = (hi + Math.imul(ah6, bh6)) | 0;
    lo = (lo + Math.imul(al5, bl7)) | 0;
    mid = (mid + Math.imul(al5, bh7)) | 0;
    mid = (mid + Math.imul(ah5, bl7)) | 0;
    hi = (hi + Math.imul(ah5, bh7)) | 0;
    lo = (lo + Math.imul(al4, bl8)) | 0;
    mid = (mid + Math.imul(al4, bh8)) | 0;
    mid = (mid + Math.imul(ah4, bl8)) | 0;
    hi = (hi + Math.imul(ah4, bh8)) | 0;
    lo = (lo + Math.imul(al3, bl9)) | 0;
    mid = (mid + Math.imul(al3, bh9)) | 0;
    mid = (mid + Math.imul(ah3, bl9)) | 0;
    hi = (hi + Math.imul(ah3, bh9)) | 0;
    var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
    w12 &= 0x3ffffff;
    /* k = 13 */
    lo = Math.imul(al9, bl4);
    mid = Math.imul(al9, bh4);
    mid = (mid + Math.imul(ah9, bl4)) | 0;
    hi = Math.imul(ah9, bh4);
    lo = (lo + Math.imul(al8, bl5)) | 0;
    mid = (mid + Math.imul(al8, bh5)) | 0;
    mid = (mid + Math.imul(ah8, bl5)) | 0;
    hi = (hi + Math.imul(ah8, bh5)) | 0;
    lo = (lo + Math.imul(al7, bl6)) | 0;
    mid = (mid + Math.imul(al7, bh6)) | 0;
    mid = (mid + Math.imul(ah7, bl6)) | 0;
    hi = (hi + Math.imul(ah7, bh6)) | 0;
    lo = (lo + Math.imul(al6, bl7)) | 0;
    mid = (mid + Math.imul(al6, bh7)) | 0;
    mid = (mid + Math.imul(ah6, bl7)) | 0;
    hi = (hi + Math.imul(ah6, bh7)) | 0;
    lo = (lo + Math.imul(al5, bl8)) | 0;
    mid = (mid + Math.imul(al5, bh8)) | 0;
    mid = (mid + Math.imul(ah5, bl8)) | 0;
    hi = (hi + Math.imul(ah5, bh8)) | 0;
    lo = (lo + Math.imul(al4, bl9)) | 0;
    mid = (mid + Math.imul(al4, bh9)) | 0;
    mid = (mid + Math.imul(ah4, bl9)) | 0;
    hi = (hi + Math.imul(ah4, bh9)) | 0;
    var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
    w13 &= 0x3ffffff;
    /* k = 14 */
    lo = Math.imul(al9, bl5);
    mid = Math.imul(al9, bh5);
    mid = (mid + Math.imul(ah9, bl5)) | 0;
    hi = Math.imul(ah9, bh5);
    lo = (lo + Math.imul(al8, bl6)) | 0;
    mid = (mid + Math.imul(al8, bh6)) | 0;
    mid = (mid + Math.imul(ah8, bl6)) | 0;
    hi = (hi + Math.imul(ah8, bh6)) | 0;
    lo = (lo + Math.imul(al7, bl7)) | 0;
    mid = (mid + Math.imul(al7, bh7)) | 0;
    mid = (mid + Math.imul(ah7, bl7)) | 0;
    hi = (hi + Math.imul(ah7, bh7)) | 0;
    lo = (lo + Math.imul(al6, bl8)) | 0;
    mid = (mid + Math.imul(al6, bh8)) | 0;
    mid = (mid + Math.imul(ah6, bl8)) | 0;
    hi = (hi + Math.imul(ah6, bh8)) | 0;
    lo = (lo + Math.imul(al5, bl9)) | 0;
    mid = (mid + Math.imul(al5, bh9)) | 0;
    mid = (mid + Math.imul(ah5, bl9)) | 0;
    hi = (hi + Math.imul(ah5, bh9)) | 0;
    var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
    w14 &= 0x3ffffff;
    /* k = 15 */
    lo = Math.imul(al9, bl6);
    mid = Math.imul(al9, bh6);
    mid = (mid + Math.imul(ah9, bl6)) | 0;
    hi = Math.imul(ah9, bh6);
    lo = (lo + Math.imul(al8, bl7)) | 0;
    mid = (mid + Math.imul(al8, bh7)) | 0;
    mid = (mid + Math.imul(ah8, bl7)) | 0;
    hi = (hi + Math.imul(ah8, bh7)) | 0;
    lo = (lo + Math.imul(al7, bl8)) | 0;
    mid = (mid + Math.imul(al7, bh8)) | 0;
    mid = (mid + Math.imul(ah7, bl8)) | 0;
    hi = (hi + Math.imul(ah7, bh8)) | 0;
    lo = (lo + Math.imul(al6, bl9)) | 0;
    mid = (mid + Math.imul(al6, bh9)) | 0;
    mid = (mid + Math.imul(ah6, bl9)) | 0;
    hi = (hi + Math.imul(ah6, bh9)) | 0;
    var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
    w15 &= 0x3ffffff;
    /* k = 16 */
    lo = Math.imul(al9, bl7);
    mid = Math.imul(al9, bh7);
    mid = (mid + Math.imul(ah9, bl7)) | 0;
    hi = Math.imul(ah9, bh7);
    lo = (lo + Math.imul(al8, bl8)) | 0;
    mid = (mid + Math.imul(al8, bh8)) | 0;
    mid = (mid + Math.imul(ah8, bl8)) | 0;
    hi = (hi + Math.imul(ah8, bh8)) | 0;
    lo = (lo + Math.imul(al7, bl9)) | 0;
    mid = (mid + Math.imul(al7, bh9)) | 0;
    mid = (mid + Math.imul(ah7, bl9)) | 0;
    hi = (hi + Math.imul(ah7, bh9)) | 0;
    var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
    w16 &= 0x3ffffff;
    /* k = 17 */
    lo = Math.imul(al9, bl8);
    mid = Math.imul(al9, bh8);
    mid = (mid + Math.imul(ah9, bl8)) | 0;
    hi = Math.imul(ah9, bh8);
    lo = (lo + Math.imul(al8, bl9)) | 0;
    mid = (mid + Math.imul(al8, bh9)) | 0;
    mid = (mid + Math.imul(ah8, bl9)) | 0;
    hi = (hi + Math.imul(ah8, bh9)) | 0;
    var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
    w17 &= 0x3ffffff;
    /* k = 18 */
    lo = Math.imul(al9, bl9);
    mid = Math.imul(al9, bh9);
    mid = (mid + Math.imul(ah9, bl9)) | 0;
    hi = Math.imul(ah9, bh9);
    var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
    w18 &= 0x3ffffff;
    o[0] = w0;
    o[1] = w1;
    o[2] = w2;
    o[3] = w3;
    o[4] = w4;
    o[5] = w5;
    o[6] = w6;
    o[7] = w7;
    o[8] = w8;
    o[9] = w9;
    o[10] = w10;
    o[11] = w11;
    o[12] = w12;
    o[13] = w13;
    o[14] = w14;
    o[15] = w15;
    o[16] = w16;
    o[17] = w17;
    o[18] = w18;
    if (c !== 0) {
      o[19] = c;
      out.length++;
    }
    return out;
  };

  // Polyfill comb
  if (!Math.imul) {
    comb10MulTo = smallMulTo;
  }

  function bigMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    out.length = self.length + num.length;

    var carry = 0;
    var hncarry = 0;
    for (var k = 0; k < out.length - 1; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = hncarry;
      hncarry = 0;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = k - j;
        var a = self.words[i] | 0;
        var b = num.words[j] | 0;
        var r = a * b;

        var lo = r & 0x3ffffff;
        ncarry = (ncarry + ((r / 0x4000000) | 0)) | 0;
        lo = (lo + rword) | 0;
        rword = lo & 0x3ffffff;
        ncarry = (ncarry + (lo >>> 26)) | 0;

        hncarry += ncarry >>> 26;
        ncarry &= 0x3ffffff;
      }
      out.words[k] = rword;
      carry = ncarry;
      ncarry = hncarry;
    }
    if (carry !== 0) {
      out.words[k] = carry;
    } else {
      out.length--;
    }

    return out._strip();
  }

  function jumboMulTo (self, num, out) {
    // Temporary disable, see https://github.com/indutny/bn.js/issues/211
    // var fftm = new FFTM();
    // return fftm.mulp(self, num, out);
    return bigMulTo(self, num, out);
  }

  BN.prototype.mulTo = function mulTo (num, out) {
    var res;
    var len = this.length + num.length;
    if (this.length === 10 && num.length === 10) {
      res = comb10MulTo(this, num, out);
    } else if (len < 63) {
      res = smallMulTo(this, num, out);
    } else if (len < 1024) {
      res = bigMulTo(this, num, out);
    } else {
      res = jumboMulTo(this, num, out);
    }

    return res;
  };

  // Multiply `this` by `num`
  BN.prototype.mul = function mul (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return this.mulTo(num, out);
  };

  // Multiply employing FFT
  BN.prototype.mulf = function mulf (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return jumboMulTo(this, num, out);
  };

  // In-place Multiplication
  BN.prototype.imul = function imul (num) {
    return this.clone().mulTo(num, this);
  };

  BN.prototype.imuln = function imuln (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(typeof num === 'number');
    assert(num < 0x4000000);

    // Carry
    var carry = 0;
    for (var i = 0; i < this.length; i++) {
      var w = (this.words[i] | 0) * num;
      var lo = (w & 0x3ffffff) + (carry & 0x3ffffff);
      carry >>= 26;
      carry += (w / 0x4000000) | 0;
      // NOTE: lo is 27bit maximum
      carry += lo >>> 26;
      this.words[i] = lo & 0x3ffffff;
    }

    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }

    return isNegNum ? this.ineg() : this;
  };

  BN.prototype.muln = function muln (num) {
    return this.clone().imuln(num);
  };

  // `this` * `this`
  BN.prototype.sqr = function sqr () {
    return this.mul(this);
  };

  // `this` * `this` in-place
  BN.prototype.isqr = function isqr () {
    return this.imul(this.clone());
  };

  // Math.pow(`this`, `num`)
  BN.prototype.pow = function pow (num) {
    var w = toBitArray(num);
    if (w.length === 0) return new BN(1);

    // Skip leading zeroes
    var res = this;
    for (var i = 0; i < w.length; i++, res = res.sqr()) {
      if (w[i] !== 0) break;
    }

    if (++i < w.length) {
      for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
        if (w[i] === 0) continue;

        res = res.mul(q);
      }
    }

    return res;
  };

  // Shift-left in-place
  BN.prototype.iushln = function iushln (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;
    var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
    var i;

    if (r !== 0) {
      var carry = 0;

      for (i = 0; i < this.length; i++) {
        var newCarry = this.words[i] & carryMask;
        var c = ((this.words[i] | 0) - newCarry) << r;
        this.words[i] = c | carry;
        carry = newCarry >>> (26 - r);
      }

      if (carry) {
        this.words[i] = carry;
        this.length++;
      }
    }

    if (s !== 0) {
      for (i = this.length - 1; i >= 0; i--) {
        this.words[i + s] = this.words[i];
      }

      for (i = 0; i < s; i++) {
        this.words[i] = 0;
      }

      this.length += s;
    }

    return this._strip();
  };

  BN.prototype.ishln = function ishln (bits) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushln(bits);
  };

  // Shift-right in-place
  // NOTE: `hint` is a lowest bit before trailing zeroes
  // NOTE: if `extended` is present - it will be filled with destroyed bits
  BN.prototype.iushrn = function iushrn (bits, hint, extended) {
    assert(typeof bits === 'number' && bits >= 0);
    var h;
    if (hint) {
      h = (hint - (hint % 26)) / 26;
    } else {
      h = 0;
    }

    var r = bits % 26;
    var s = Math.min((bits - r) / 26, this.length);
    var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
    var maskedWords = extended;

    h -= s;
    h = Math.max(0, h);

    // Extended mode, copy masked part
    if (maskedWords) {
      for (var i = 0; i < s; i++) {
        maskedWords.words[i] = this.words[i];
      }
      maskedWords.length = s;
    }

    if (s === 0) ; else if (this.length > s) {
      this.length -= s;
      for (i = 0; i < this.length; i++) {
        this.words[i] = this.words[i + s];
      }
    } else {
      this.words[0] = 0;
      this.length = 1;
    }

    var carry = 0;
    for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
      var word = this.words[i] | 0;
      this.words[i] = (carry << (26 - r)) | (word >>> r);
      carry = word & mask;
    }

    // Push carried bits as a mask
    if (maskedWords && carry !== 0) {
      maskedWords.words[maskedWords.length++] = carry;
    }

    if (this.length === 0) {
      this.words[0] = 0;
      this.length = 1;
    }

    return this._strip();
  };

  BN.prototype.ishrn = function ishrn (bits, hint, extended) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushrn(bits, hint, extended);
  };

  // Shift-left
  BN.prototype.shln = function shln (bits) {
    return this.clone().ishln(bits);
  };

  BN.prototype.ushln = function ushln (bits) {
    return this.clone().iushln(bits);
  };

  // Shift-right
  BN.prototype.shrn = function shrn (bits) {
    return this.clone().ishrn(bits);
  };

  BN.prototype.ushrn = function ushrn (bits) {
    return this.clone().iushrn(bits);
  };

  // Test if n bit is set
  BN.prototype.testn = function testn (bit) {
    assert(typeof bit === 'number' && bit >= 0);
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) return false;

    // Check bit and return
    var w = this.words[s];

    return !!(w & q);
  };

  // Return only lowers bits of number (in-place)
  BN.prototype.imaskn = function imaskn (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;

    assert(this.negative === 0, 'imaskn works only with positive numbers');

    if (this.length <= s) {
      return this;
    }

    if (r !== 0) {
      s++;
    }
    this.length = Math.min(s, this.length);

    if (r !== 0) {
      var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
      this.words[this.length - 1] &= mask;
    }

    return this._strip();
  };

  // Return only lowers bits of number
  BN.prototype.maskn = function maskn (bits) {
    return this.clone().imaskn(bits);
  };

  // Add plain number `num` to `this`
  BN.prototype.iaddn = function iaddn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.isubn(-num);

    // Possible sign change
    if (this.negative !== 0) {
      if (this.length === 1 && (this.words[0] | 0) <= num) {
        this.words[0] = num - (this.words[0] | 0);
        this.negative = 0;
        return this;
      }

      this.negative = 0;
      this.isubn(num);
      this.negative = 1;
      return this;
    }

    // Add without checks
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn (num) {
    this.words[0] += num;

    // Carry
    for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
      this.words[i] -= 0x4000000;
      if (i === this.length - 1) {
        this.words[i + 1] = 1;
      } else {
        this.words[i + 1]++;
      }
    }
    this.length = Math.max(this.length, i + 1);

    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.iaddn(-num);

    if (this.negative !== 0) {
      this.negative = 0;
      this.iaddn(num);
      this.negative = 1;
      return this;
    }

    this.words[0] -= num;

    if (this.length === 1 && this.words[0] < 0) {
      this.words[0] = -this.words[0];
      this.negative = 1;
    } else {
      // Carry
      for (var i = 0; i < this.length && this.words[i] < 0; i++) {
        this.words[i] += 0x4000000;
        this.words[i + 1] -= 1;
      }
    }

    return this._strip();
  };

  BN.prototype.addn = function addn (num) {
    return this.clone().iaddn(num);
  };

  BN.prototype.subn = function subn (num) {
    return this.clone().isubn(num);
  };

  BN.prototype.iabs = function iabs () {
    this.negative = 0;

    return this;
  };

  BN.prototype.abs = function abs () {
    return this.clone().iabs();
  };

  BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
    var len = num.length + shift;
    var i;

    this._expand(len);

    var w;
    var carry = 0;
    for (i = 0; i < num.length; i++) {
      w = (this.words[i + shift] | 0) + carry;
      var right = (num.words[i] | 0) * mul;
      w -= right & 0x3ffffff;
      carry = (w >> 26) - ((right / 0x4000000) | 0);
      this.words[i + shift] = w & 0x3ffffff;
    }
    for (; i < this.length - shift; i++) {
      w = (this.words[i + shift] | 0) + carry;
      carry = w >> 26;
      this.words[i + shift] = w & 0x3ffffff;
    }

    if (carry === 0) return this._strip();

    // Subtraction overflow
    assert(carry === -1);
    carry = 0;
    for (i = 0; i < this.length; i++) {
      w = -(this.words[i] | 0) + carry;
      carry = w >> 26;
      this.words[i] = w & 0x3ffffff;
    }
    this.negative = 1;

    return this._strip();
  };

  BN.prototype._wordDiv = function _wordDiv (num, mode) {
    var shift = this.length - num.length;

    var a = this.clone();
    var b = num;

    // Normalize
    var bhi = b.words[b.length - 1] | 0;
    var bhiBits = this._countBits(bhi);
    shift = 26 - bhiBits;
    if (shift !== 0) {
      b = b.ushln(shift);
      a.iushln(shift);
      bhi = b.words[b.length - 1] | 0;
    }

    // Initialize quotient
    var m = a.length - b.length;
    var q;

    if (mode !== 'mod') {
      q = new BN(null);
      q.length = m + 1;
      q.words = new Array(q.length);
      for (var i = 0; i < q.length; i++) {
        q.words[i] = 0;
      }
    }

    var diff = a.clone()._ishlnsubmul(b, 1, m);
    if (diff.negative === 0) {
      a = diff;
      if (q) {
        q.words[m] = 1;
      }
    }

    for (var j = m - 1; j >= 0; j--) {
      var qj = (a.words[b.length + j] | 0) * 0x4000000 +
        (a.words[b.length + j - 1] | 0);

      // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
      // (0x7ffffff)
      qj = Math.min((qj / bhi) | 0, 0x3ffffff);

      a._ishlnsubmul(b, qj, j);
      while (a.negative !== 0) {
        qj--;
        a.negative = 0;
        a._ishlnsubmul(b, 1, j);
        if (!a.isZero()) {
          a.negative ^= 1;
        }
      }
      if (q) {
        q.words[j] = qj;
      }
    }
    if (q) {
      q._strip();
    }
    a._strip();

    // Denormalize
    if (mode !== 'div' && shift !== 0) {
      a.iushrn(shift);
    }

    return {
      div: q || null,
      mod: a
    };
  };

  // NOTE: 1) `mode` can be set to `mod` to request mod only,
  //       to `div` to request div only, or be absent to
  //       request both div & mod
  //       2) `positive` is true if unsigned mod is requested
  BN.prototype.divmod = function divmod (num, mode, positive) {
    assert(!num.isZero());

    if (this.isZero()) {
      return {
        div: new BN(0),
        mod: new BN(0)
      };
    }

    var div, mod, res;
    if (this.negative !== 0 && num.negative === 0) {
      res = this.neg().divmod(num, mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.iadd(num);
        }
      }

      return {
        div: div,
        mod: mod
      };
    }

    if (this.negative === 0 && num.negative !== 0) {
      res = this.divmod(num.neg(), mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      return {
        div: div,
        mod: res.mod
      };
    }

    if ((this.negative & num.negative) !== 0) {
      res = this.neg().divmod(num.neg(), mode);

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.isub(num);
        }
      }

      return {
        div: res.div,
        mod: mod
      };
    }

    // Both numbers are positive at this point

    // Strip both numbers to approximate shift value
    if (num.length > this.length || this.cmp(num) < 0) {
      return {
        div: new BN(0),
        mod: this
      };
    }

    // Very short reduction
    if (num.length === 1) {
      if (mode === 'div') {
        return {
          div: this.divn(num.words[0]),
          mod: null
        };
      }

      if (mode === 'mod') {
        return {
          div: null,
          mod: new BN(this.modrn(num.words[0]))
        };
      }

      return {
        div: this.divn(num.words[0]),
        mod: new BN(this.modrn(num.words[0]))
      };
    }

    return this._wordDiv(num, mode);
  };

  // Find `this` / `num`
  BN.prototype.div = function div (num) {
    return this.divmod(num, 'div', false).div;
  };

  // Find `this` % `num`
  BN.prototype.mod = function mod (num) {
    return this.divmod(num, 'mod', false).mod;
  };

  BN.prototype.umod = function umod (num) {
    return this.divmod(num, 'mod', true).mod;
  };

  // Find Round(`this` / `num`)
  BN.prototype.divRound = function divRound (num) {
    var dm = this.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    var half = num.ushrn(1);
    var r2 = num.andln(1);
    var cmp = mod.cmp(half);

    // Round down
    if (cmp < 0 || (r2 === 1 && cmp === 0)) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  };

  BN.prototype.modrn = function modrn (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(num <= 0x3ffffff);
    var p = (1 << 26) % num;

    var acc = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      acc = (p * acc + (this.words[i] | 0)) % num;
    }

    return isNegNum ? -acc : acc;
  };

  // WARNING: DEPRECATED
  BN.prototype.modn = function modn (num) {
    return this.modrn(num);
  };

  // In-place division by number
  BN.prototype.idivn = function idivn (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(num <= 0x3ffffff);

    var carry = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var w = (this.words[i] | 0) + carry * 0x4000000;
      this.words[i] = (w / num) | 0;
      carry = w % num;
    }

    this._strip();
    return isNegNum ? this.ineg() : this;
  };

  BN.prototype.divn = function divn (num) {
    return this.clone().idivn(num);
  };

  BN.prototype.egcd = function egcd (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var x = this;
    var y = p.clone();

    if (x.negative !== 0) {
      x = x.umod(p);
    } else {
      x = x.clone();
    }

    // A * x + B * y = x
    var A = new BN(1);
    var B = new BN(0);

    // C * x + D * y = y
    var C = new BN(0);
    var D = new BN(1);

    var g = 0;

    while (x.isEven() && y.isEven()) {
      x.iushrn(1);
      y.iushrn(1);
      ++g;
    }

    var yp = y.clone();
    var xp = x.clone();

    while (!x.isZero()) {
      for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        x.iushrn(i);
        while (i-- > 0) {
          if (A.isOdd() || B.isOdd()) {
            A.iadd(yp);
            B.isub(xp);
          }

          A.iushrn(1);
          B.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        y.iushrn(j);
        while (j-- > 0) {
          if (C.isOdd() || D.isOdd()) {
            C.iadd(yp);
            D.isub(xp);
          }

          C.iushrn(1);
          D.iushrn(1);
        }
      }

      if (x.cmp(y) >= 0) {
        x.isub(y);
        A.isub(C);
        B.isub(D);
      } else {
        y.isub(x);
        C.isub(A);
        D.isub(B);
      }
    }

    return {
      a: C,
      b: D,
      gcd: y.iushln(g)
    };
  };

  // This is reduced incarnation of the binary EEA
  // above, designated to invert members of the
  // _prime_ fields F(p) at a maximal speed
  BN.prototype._invmp = function _invmp (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var a = this;
    var b = p.clone();

    if (a.negative !== 0) {
      a = a.umod(p);
    } else {
      a = a.clone();
    }

    var x1 = new BN(1);
    var x2 = new BN(0);

    var delta = b.clone();

    while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
      for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        a.iushrn(i);
        while (i-- > 0) {
          if (x1.isOdd()) {
            x1.iadd(delta);
          }

          x1.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        b.iushrn(j);
        while (j-- > 0) {
          if (x2.isOdd()) {
            x2.iadd(delta);
          }

          x2.iushrn(1);
        }
      }

      if (a.cmp(b) >= 0) {
        a.isub(b);
        x1.isub(x2);
      } else {
        b.isub(a);
        x2.isub(x1);
      }
    }

    var res;
    if (a.cmpn(1) === 0) {
      res = x1;
    } else {
      res = x2;
    }

    if (res.cmpn(0) < 0) {
      res.iadd(p);
    }

    return res;
  };

  BN.prototype.gcd = function gcd (num) {
    if (this.isZero()) return num.abs();
    if (num.isZero()) return this.abs();

    var a = this.clone();
    var b = num.clone();
    a.negative = 0;
    b.negative = 0;

    // Remove common factor of two
    for (var shift = 0; a.isEven() && b.isEven(); shift++) {
      a.iushrn(1);
      b.iushrn(1);
    }

    do {
      while (a.isEven()) {
        a.iushrn(1);
      }
      while (b.isEven()) {
        b.iushrn(1);
      }

      var r = a.cmp(b);
      if (r < 0) {
        // Swap `a` and `b` to make `a` always bigger than `b`
        var t = a;
        a = b;
        b = t;
      } else if (r === 0 || b.cmpn(1) === 0) {
        break;
      }

      a.isub(b);
    } while (true);

    return b.iushln(shift);
  };

  // Invert number in the field F(num)
  BN.prototype.invm = function invm (num) {
    return this.egcd(num).a.umod(num);
  };

  BN.prototype.isEven = function isEven () {
    return (this.words[0] & 1) === 0;
  };

  BN.prototype.isOdd = function isOdd () {
    return (this.words[0] & 1) === 1;
  };

  // And first word and num
  BN.prototype.andln = function andln (num) {
    return this.words[0] & num;
  };

  // Increment at the bit position in-line
  BN.prototype.bincn = function bincn (bit) {
    assert(typeof bit === 'number');
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) {
      this._expand(s + 1);
      this.words[s] |= q;
      return this;
    }

    // Add bit and propagate, if needed
    var carry = q;
    for (var i = s; carry !== 0 && i < this.length; i++) {
      var w = this.words[i] | 0;
      w += carry;
      carry = w >>> 26;
      w &= 0x3ffffff;
      this.words[i] = w;
    }
    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }
    return this;
  };

  BN.prototype.isZero = function isZero () {
    return this.length === 1 && this.words[0] === 0;
  };

  BN.prototype.cmpn = function cmpn (num) {
    var negative = num < 0;

    if (this.negative !== 0 && !negative) return -1;
    if (this.negative === 0 && negative) return 1;

    this._strip();

    var res;
    if (this.length > 1) {
      res = 1;
    } else {
      if (negative) {
        num = -num;
      }

      assert(num <= 0x3ffffff, 'Number is too big');

      var w = this.words[0] | 0;
      res = w === num ? 0 : w < num ? -1 : 1;
    }
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Compare two numbers and return:
  // 1 - if `this` > `num`
  // 0 - if `this` == `num`
  // -1 - if `this` < `num`
  BN.prototype.cmp = function cmp (num) {
    if (this.negative !== 0 && num.negative === 0) return -1;
    if (this.negative === 0 && num.negative !== 0) return 1;

    var res = this.ucmp(num);
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Unsigned comparison
  BN.prototype.ucmp = function ucmp (num) {
    // At this point both numbers have the same sign
    if (this.length > num.length) return 1;
    if (this.length < num.length) return -1;

    var res = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var a = this.words[i] | 0;
      var b = num.words[i] | 0;

      if (a === b) continue;
      if (a < b) {
        res = -1;
      } else if (a > b) {
        res = 1;
      }
      break;
    }
    return res;
  };

  BN.prototype.gtn = function gtn (num) {
    return this.cmpn(num) === 1;
  };

  BN.prototype.gt = function gt (num) {
    return this.cmp(num) === 1;
  };

  BN.prototype.gten = function gten (num) {
    return this.cmpn(num) >= 0;
  };

  BN.prototype.gte = function gte (num) {
    return this.cmp(num) >= 0;
  };

  BN.prototype.ltn = function ltn (num) {
    return this.cmpn(num) === -1;
  };

  BN.prototype.lt = function lt (num) {
    return this.cmp(num) === -1;
  };

  BN.prototype.lten = function lten (num) {
    return this.cmpn(num) <= 0;
  };

  BN.prototype.lte = function lte (num) {
    return this.cmp(num) <= 0;
  };

  BN.prototype.eqn = function eqn (num) {
    return this.cmpn(num) === 0;
  };

  BN.prototype.eq = function eq (num) {
    return this.cmp(num) === 0;
  };

  //
  // A reduce context, could be using montgomery or something better, depending
  // on the `m` itself.
  //
  BN.red = function red (num) {
    return new Red(num);
  };

  BN.prototype.toRed = function toRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    assert(this.negative === 0, 'red works only with positives');
    return ctx.convertTo(this)._forceRed(ctx);
  };

  BN.prototype.fromRed = function fromRed () {
    assert(this.red, 'fromRed works only with numbers in reduction context');
    return this.red.convertFrom(this);
  };

  BN.prototype._forceRed = function _forceRed (ctx) {
    this.red = ctx;
    return this;
  };

  BN.prototype.forceRed = function forceRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    return this._forceRed(ctx);
  };

  BN.prototype.redAdd = function redAdd (num) {
    assert(this.red, 'redAdd works only with red numbers');
    return this.red.add(this, num);
  };

  BN.prototype.redIAdd = function redIAdd (num) {
    assert(this.red, 'redIAdd works only with red numbers');
    return this.red.iadd(this, num);
  };

  BN.prototype.redSub = function redSub (num) {
    assert(this.red, 'redSub works only with red numbers');
    return this.red.sub(this, num);
  };

  BN.prototype.redISub = function redISub (num) {
    assert(this.red, 'redISub works only with red numbers');
    return this.red.isub(this, num);
  };

  BN.prototype.redShl = function redShl (num) {
    assert(this.red, 'redShl works only with red numbers');
    return this.red.shl(this, num);
  };

  BN.prototype.redMul = function redMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.mul(this, num);
  };

  BN.prototype.redIMul = function redIMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.imul(this, num);
  };

  BN.prototype.redSqr = function redSqr () {
    assert(this.red, 'redSqr works only with red numbers');
    this.red._verify1(this);
    return this.red.sqr(this);
  };

  BN.prototype.redISqr = function redISqr () {
    assert(this.red, 'redISqr works only with red numbers');
    this.red._verify1(this);
    return this.red.isqr(this);
  };

  // Square root over p
  BN.prototype.redSqrt = function redSqrt () {
    assert(this.red, 'redSqrt works only with red numbers');
    this.red._verify1(this);
    return this.red.sqrt(this);
  };

  BN.prototype.redInvm = function redInvm () {
    assert(this.red, 'redInvm works only with red numbers');
    this.red._verify1(this);
    return this.red.invm(this);
  };

  // Return negative clone of `this` % `red modulo`
  BN.prototype.redNeg = function redNeg () {
    assert(this.red, 'redNeg works only with red numbers');
    this.red._verify1(this);
    return this.red.neg(this);
  };

  BN.prototype.redPow = function redPow (num) {
    assert(this.red && !num.red, 'redPow(normalNum)');
    this.red._verify1(this);
    return this.red.pow(this, num);
  };

  // Prime numbers with efficient reduction
  var primes = {
    k256: null,
    p224: null,
    p192: null,
    p25519: null
  };

  // Pseudo-Mersenne prime
  function MPrime (name, p) {
    // P = 2 ^ N - K
    this.name = name;
    this.p = new BN(p, 16);
    this.n = this.p.bitLength();
    this.k = new BN(1).iushln(this.n).isub(this.p);

    this.tmp = this._tmp();
  }

  MPrime.prototype._tmp = function _tmp () {
    var tmp = new BN(null);
    tmp.words = new Array(Math.ceil(this.n / 13));
    return tmp;
  };

  MPrime.prototype.ireduce = function ireduce (num) {
    // Assumes that `num` is less than `P^2`
    // num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
    var r = num;
    var rlen;

    do {
      this.split(r, this.tmp);
      r = this.imulK(r);
      r = r.iadd(this.tmp);
      rlen = r.bitLength();
    } while (rlen > this.n);

    var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r.words[0] = 0;
      r.length = 1;
    } else if (cmp > 0) {
      r.isub(this.p);
    } else {
      if (r.strip !== undefined) {
        // r is a BN v4 instance
        r.strip();
      } else {
        // r is a BN v5 instance
        r._strip();
      }
    }

    return r;
  };

  MPrime.prototype.split = function split (input, out) {
    input.iushrn(this.n, 0, out);
  };

  MPrime.prototype.imulK = function imulK (num) {
    return num.imul(this.k);
  };

  function K256 () {
    MPrime.call(
      this,
      'k256',
      'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
  }
  inherits(K256, MPrime);

  K256.prototype.split = function split (input, output) {
    // 256 = 9 * 26 + 22
    var mask = 0x3fffff;

    var outLen = Math.min(input.length, 9);
    for (var i = 0; i < outLen; i++) {
      output.words[i] = input.words[i];
    }
    output.length = outLen;

    if (input.length <= 9) {
      input.words[0] = 0;
      input.length = 1;
      return;
    }

    // Shift by 9 limbs
    var prev = input.words[9];
    output.words[output.length++] = prev & mask;

    for (i = 10; i < input.length; i++) {
      var next = input.words[i] | 0;
      input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
      prev = next;
    }
    prev >>>= 22;
    input.words[i - 10] = prev;
    if (prev === 0 && input.length > 10) {
      input.length -= 10;
    } else {
      input.length -= 9;
    }
  };

  K256.prototype.imulK = function imulK (num) {
    // K = 0x1000003d1 = [ 0x40, 0x3d1 ]
    num.words[num.length] = 0;
    num.words[num.length + 1] = 0;
    num.length += 2;

    // bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
    var lo = 0;
    for (var i = 0; i < num.length; i++) {
      var w = num.words[i] | 0;
      lo += w * 0x3d1;
      num.words[i] = lo & 0x3ffffff;
      lo = w * 0x40 + ((lo / 0x4000000) | 0);
    }

    // Fast length reduction
    if (num.words[num.length - 1] === 0) {
      num.length--;
      if (num.words[num.length - 1] === 0) {
        num.length--;
      }
    }
    return num;
  };

  function P224 () {
    MPrime.call(
      this,
      'p224',
      'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
  }
  inherits(P224, MPrime);

  function P192 () {
    MPrime.call(
      this,
      'p192',
      'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
  }
  inherits(P192, MPrime);

  function P25519 () {
    // 2 ^ 255 - 19
    MPrime.call(
      this,
      '25519',
      '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed');
  }
  inherits(P25519, MPrime);

  P25519.prototype.imulK = function imulK (num) {
    // K = 0x13
    var carry = 0;
    for (var i = 0; i < num.length; i++) {
      var hi = (num.words[i] | 0) * 0x13 + carry;
      var lo = hi & 0x3ffffff;
      hi >>>= 26;

      num.words[i] = lo;
      carry = hi;
    }
    if (carry !== 0) {
      num.words[num.length++] = carry;
    }
    return num;
  };

  // Exported mostly for testing purposes, use plain name instead
  BN._prime = function prime (name) {
    // Cached version of prime
    if (primes[name]) return primes[name];

    var prime;
    if (name === 'k256') {
      prime = new K256();
    } else if (name === 'p224') {
      prime = new P224();
    } else if (name === 'p192') {
      prime = new P192();
    } else if (name === 'p25519') {
      prime = new P25519();
    } else {
      throw new Error('Unknown prime ' + name);
    }
    primes[name] = prime;

    return prime;
  };

  //
  // Base reduction engine
  //
  function Red (m) {
    if (typeof m === 'string') {
      var prime = BN._prime(m);
      this.m = prime.p;
      this.prime = prime;
    } else {
      assert(m.gtn(1), 'modulus must be greater than 1');
      this.m = m;
      this.prime = null;
    }
  }

  Red.prototype._verify1 = function _verify1 (a) {
    assert(a.negative === 0, 'red works only with positives');
    assert(a.red, 'red works only with red numbers');
  };

  Red.prototype._verify2 = function _verify2 (a, b) {
    assert((a.negative | b.negative) === 0, 'red works only with positives');
    assert(a.red && a.red === b.red,
      'red works only with red numbers');
  };

  Red.prototype.imod = function imod (a) {
    if (this.prime) return this.prime.ireduce(a)._forceRed(this);

    move(a, a.umod(this.m)._forceRed(this));
    return a;
  };

  Red.prototype.neg = function neg (a) {
    if (a.isZero()) {
      return a.clone();
    }

    return this.m.sub(a)._forceRed(this);
  };

  Red.prototype.add = function add (a, b) {
    this._verify2(a, b);

    var res = a.add(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.iadd = function iadd (a, b) {
    this._verify2(a, b);

    var res = a.iadd(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res;
  };

  Red.prototype.sub = function sub (a, b) {
    this._verify2(a, b);

    var res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.isub = function isub (a, b) {
    this._verify2(a, b);

    var res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  };

  Red.prototype.shl = function shl (a, num) {
    this._verify1(a);
    return this.imod(a.ushln(num));
  };

  Red.prototype.imul = function imul (a, b) {
    this._verify2(a, b);
    return this.imod(a.imul(b));
  };

  Red.prototype.mul = function mul (a, b) {
    this._verify2(a, b);
    return this.imod(a.mul(b));
  };

  Red.prototype.isqr = function isqr (a) {
    return this.imul(a, a.clone());
  };

  Red.prototype.sqr = function sqr (a) {
    return this.mul(a, a);
  };

  Red.prototype.sqrt = function sqrt (a) {
    if (a.isZero()) return a.clone();

    var mod3 = this.m.andln(3);
    assert(mod3 % 2 === 1);

    // Fast case
    if (mod3 === 3) {
      var pow = this.m.add(new BN(1)).iushrn(2);
      return this.pow(a, pow);
    }

    // Tonelli-Shanks algorithm (Totally unoptimized and slow)
    //
    // Find Q and S, that Q * 2 ^ S = (P - 1)
    var q = this.m.subn(1);
    var s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    assert(!q.isZero());

    var one = new BN(1).toRed(this);
    var nOne = one.redNeg();

    // Find quadratic non-residue
    // NOTE: Max is such because of generalized Riemann hypothesis.
    var lpow = this.m.subn(1).iushrn(1);
    var z = this.m.bitLength();
    z = new BN(2 * z * z).toRed(this);

    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }

    var c = this.pow(z, q);
    var r = this.pow(a, q.addn(1).iushrn(1));
    var t = this.pow(a, q);
    var m = s;
    while (t.cmp(one) !== 0) {
      var tmp = t;
      for (var i = 0; tmp.cmp(one) !== 0; i++) {
        tmp = tmp.redSqr();
      }
      assert(i < m);
      var b = this.pow(c, new BN(1).iushln(m - i - 1));

      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }

    return r;
  };

  Red.prototype.invm = function invm (a) {
    var inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      inv.negative = 0;
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  };

  Red.prototype.pow = function pow (a, num) {
    if (num.isZero()) return new BN(1).toRed(this);
    if (num.cmpn(1) === 0) return a.clone();

    var windowSize = 4;
    var wnd = new Array(1 << windowSize);
    wnd[0] = new BN(1).toRed(this);
    wnd[1] = a;
    for (var i = 2; i < wnd.length; i++) {
      wnd[i] = this.mul(wnd[i - 1], a);
    }

    var res = wnd[0];
    var current = 0;
    var currentLen = 0;
    var start = num.bitLength() % 26;
    if (start === 0) {
      start = 26;
    }

    for (i = num.length - 1; i >= 0; i--) {
      var word = num.words[i];
      for (var j = start - 1; j >= 0; j--) {
        var bit = (word >> j) & 1;
        if (res !== wnd[0]) {
          res = this.sqr(res);
        }

        if (bit === 0 && current === 0) {
          currentLen = 0;
          continue;
        }

        current <<= 1;
        current |= bit;
        currentLen++;
        if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

        res = this.mul(res, wnd[current]);
        currentLen = 0;
        current = 0;
      }
      start = 26;
    }

    return res;
  };

  Red.prototype.convertTo = function convertTo (num) {
    var r = num.umod(this.m);

    return r === num ? r.clone() : r;
  };

  Red.prototype.convertFrom = function convertFrom (num) {
    var res = num.clone();
    res.red = null;
    return res;
  };

  //
  // Montgomery method engine
  //

  BN.mont = function mont (num) {
    return new Mont(num);
  };

  function Mont (m) {
    Red.call(this, m);

    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - (this.shift % 26);
    }

    this.r = new BN(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);

    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  inherits(Mont, Red);

  Mont.prototype.convertTo = function convertTo (num) {
    return this.imod(num.ushln(this.shift));
  };

  Mont.prototype.convertFrom = function convertFrom (num) {
    var r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  };

  Mont.prototype.imul = function imul (a, b) {
    if (a.isZero() || b.isZero()) {
      a.words[0] = 0;
      a.length = 1;
      return a;
    }

    var t = a.imul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;

    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.mul = function mul (a, b) {
    if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

    var t = a.mul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.invm = function invm (a) {
    // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
    var res = this.imod(a._invmp(this.m).mul(this.r2));
    return res._forceRed(this);
  };
})(module, commonjsGlobal);
}(bn));

var BN$1 = bn.exports;

const version$m = "logger/5.7.0";

let _permanentCensorErrors$1 = false;
let _censorErrors$1 = false;
const LogLevels$1 = { debug: 1, "default": 2, info: 2, warning: 3, error: 4, off: 5 };
let _logLevel$1 = LogLevels$1["default"];
let _globalLogger$1 = null;
function _checkNormalize$1() {
    try {
        const missing = [];
        // Make sure all forms of normalization are supported
        ["NFD", "NFC", "NFKD", "NFKC"].forEach((form) => {
            try {
                if ("test".normalize(form) !== "test") {
                    throw new Error("bad normalize");
                }
                ;
            }
            catch (error) {
                missing.push(form);
            }
        });
        if (missing.length) {
            throw new Error("missing " + missing.join(", "));
        }
        if (String.fromCharCode(0xe9).normalize("NFD") !== String.fromCharCode(0x65, 0x0301)) {
            throw new Error("broken implementation");
        }
    }
    catch (error) {
        return error.message;
    }
    return null;
}
const _normalizeError$1 = _checkNormalize$1();
var LogLevel$2;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["OFF"] = "OFF";
})(LogLevel$2 || (LogLevel$2 = {}));
var ErrorCode$1;
(function (ErrorCode) {
    ///////////////////
    // Generic Errors
    // Unknown Error
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    // Not Implemented
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    // Unsupported Operation
    //   - operation
    ErrorCode["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
    // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
    //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    // Some sort of bad response from the server
    ErrorCode["SERVER_ERROR"] = "SERVER_ERROR";
    // Timeout
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ///////////////////
    // Operational  Errors
    // Buffer Overrun
    ErrorCode["BUFFER_OVERRUN"] = "BUFFER_OVERRUN";
    // Numeric Fault
    //   - operation: the operation being executed
    //   - fault: the reason this faulted
    ErrorCode["NUMERIC_FAULT"] = "NUMERIC_FAULT";
    ///////////////////
    // Argument Errors
    // Missing new operator to an object
    //  - name: The name of the class
    ErrorCode["MISSING_NEW"] = "MISSING_NEW";
    // Invalid argument (e.g. value is incompatible with type) to a function:
    //   - argument: The argument name that was invalid
    //   - value: The value of the argument
    ErrorCode["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
    // Missing argument to a function:
    //   - count: The number of arguments received
    //   - expectedCount: The number of arguments expected
    ErrorCode["MISSING_ARGUMENT"] = "MISSING_ARGUMENT";
    // Too many arguments
    //   - count: The number of arguments received
    //   - expectedCount: The number of arguments expected
    ErrorCode["UNEXPECTED_ARGUMENT"] = "UNEXPECTED_ARGUMENT";
    ///////////////////
    // Blockchain Errors
    // Call exception
    //  - transaction: the transaction
    //  - address?: the contract address
    //  - args?: The arguments passed into the function
    //  - method?: The Solidity method signature
    //  - errorSignature?: The EIP848 error signature
    //  - errorArgs?: The EIP848 error parameters
    //  - reason: The reason (only for EIP848 "Error(string)")
    ErrorCode["CALL_EXCEPTION"] = "CALL_EXCEPTION";
    // Insufficient funds (< value + gasLimit * gasPrice)
    //   - transaction: the transaction attempted
    ErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    // Nonce has already been used
    //   - transaction: the transaction attempted
    ErrorCode["NONCE_EXPIRED"] = "NONCE_EXPIRED";
    // The replacement fee for the transaction is too low
    //   - transaction: the transaction attempted
    ErrorCode["REPLACEMENT_UNDERPRICED"] = "REPLACEMENT_UNDERPRICED";
    // The gas limit could not be estimated
    //   - transaction: the transaction passed to estimateGas
    ErrorCode["UNPREDICTABLE_GAS_LIMIT"] = "UNPREDICTABLE_GAS_LIMIT";
    // The transaction was replaced by one with a higher gas price
    //   - reason: "cancelled", "replaced" or "repriced"
    //   - cancelled: true if reason == "cancelled" or reason == "replaced")
    //   - hash: original transaction hash
    //   - replacement: the full TransactionsResponse for the replacement
    //   - receipt: the receipt of the replacement
    ErrorCode["TRANSACTION_REPLACED"] = "TRANSACTION_REPLACED";
    ///////////////////
    // Interaction Errors
    // The user rejected the action, such as signing a message or sending
    // a transaction
    ErrorCode["ACTION_REJECTED"] = "ACTION_REJECTED";
})(ErrorCode$1 || (ErrorCode$1 = {}));
const HEX$1 = "0123456789abcdef";
class Logger$2 {
    constructor(version) {
        Object.defineProperty(this, "version", {
            enumerable: true,
            value: version,
            writable: false
        });
    }
    _log(logLevel, args) {
        const level = logLevel.toLowerCase();
        if (LogLevels$1[level] == null) {
            this.throwArgumentError("invalid log level name", "logLevel", logLevel);
        }
        if (_logLevel$1 > LogLevels$1[level]) {
            return;
        }
        console.log.apply(console, args);
    }
    debug(...args) {
        this._log(Logger$2.levels.DEBUG, args);
    }
    info(...args) {
        this._log(Logger$2.levels.INFO, args);
    }
    warn(...args) {
        this._log(Logger$2.levels.WARNING, args);
    }
    makeError(message, code, params) {
        // Errors are being censored
        if (_censorErrors$1) {
            return this.makeError("censored error", code, {});
        }
        if (!code) {
            code = Logger$2.errors.UNKNOWN_ERROR;
        }
        if (!params) {
            params = {};
        }
        const messageDetails = [];
        Object.keys(params).forEach((key) => {
            const value = params[key];
            try {
                if (value instanceof Uint8Array) {
                    let hex = "";
                    for (let i = 0; i < value.length; i++) {
                        hex += HEX$1[value[i] >> 4];
                        hex += HEX$1[value[i] & 0x0f];
                    }
                    messageDetails.push(key + "=Uint8Array(0x" + hex + ")");
                }
                else {
                    messageDetails.push(key + "=" + JSON.stringify(value));
                }
            }
            catch (error) {
                messageDetails.push(key + "=" + JSON.stringify(params[key].toString()));
            }
        });
        messageDetails.push(`code=${code}`);
        messageDetails.push(`version=${this.version}`);
        const reason = message;
        let url = "";
        switch (code) {
            case ErrorCode$1.NUMERIC_FAULT: {
                url = "NUMERIC_FAULT";
                const fault = message;
                switch (fault) {
                    case "overflow":
                    case "underflow":
                    case "division-by-zero":
                        url += "-" + fault;
                        break;
                    case "negative-power":
                    case "negative-width":
                        url += "-unsupported";
                        break;
                    case "unbound-bitwise-result":
                        url += "-unbound-result";
                        break;
                }
                break;
            }
            case ErrorCode$1.CALL_EXCEPTION:
            case ErrorCode$1.INSUFFICIENT_FUNDS:
            case ErrorCode$1.MISSING_NEW:
            case ErrorCode$1.NONCE_EXPIRED:
            case ErrorCode$1.REPLACEMENT_UNDERPRICED:
            case ErrorCode$1.TRANSACTION_REPLACED:
            case ErrorCode$1.UNPREDICTABLE_GAS_LIMIT:
                url = code;
                break;
        }
        if (url) {
            message += " [ See: https:/\/links.ethers.org/v5-errors-" + url + " ]";
        }
        if (messageDetails.length) {
            message += " (" + messageDetails.join(", ") + ")";
        }
        // @TODO: Any??
        const error = new Error(message);
        error.reason = reason;
        error.code = code;
        Object.keys(params).forEach(function (key) {
            error[key] = params[key];
        });
        return error;
    }
    throwError(message, code, params) {
        throw this.makeError(message, code, params);
    }
    throwArgumentError(message, name, value) {
        return this.throwError(message, Logger$2.errors.INVALID_ARGUMENT, {
            argument: name,
            value: value
        });
    }
    assert(condition, message, code, params) {
        if (!!condition) {
            return;
        }
        this.throwError(message, code, params);
    }
    assertArgument(condition, message, name, value) {
        if (!!condition) {
            return;
        }
        this.throwArgumentError(message, name, value);
    }
    checkNormalize(message) {
        if (_normalizeError$1) {
            this.throwError("platform missing String.prototype.normalize", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "String.prototype.normalize", form: _normalizeError$1
            });
        }
    }
    checkSafeUint53(value, message) {
        if (typeof (value) !== "number") {
            return;
        }
        if (message == null) {
            message = "value not safe";
        }
        if (value < 0 || value >= 0x1fffffffffffff) {
            this.throwError(message, Logger$2.errors.NUMERIC_FAULT, {
                operation: "checkSafeInteger",
                fault: "out-of-safe-range",
                value: value
            });
        }
        if (value % 1) {
            this.throwError(message, Logger$2.errors.NUMERIC_FAULT, {
                operation: "checkSafeInteger",
                fault: "non-integer",
                value: value
            });
        }
    }
    checkArgumentCount(count, expectedCount, message) {
        if (message) {
            message = ": " + message;
        }
        else {
            message = "";
        }
        if (count < expectedCount) {
            this.throwError("missing argument" + message, Logger$2.errors.MISSING_ARGUMENT, {
                count: count,
                expectedCount: expectedCount
            });
        }
        if (count > expectedCount) {
            this.throwError("too many arguments" + message, Logger$2.errors.UNEXPECTED_ARGUMENT, {
                count: count,
                expectedCount: expectedCount
            });
        }
    }
    checkNew(target, kind) {
        if (target === Object || target == null) {
            this.throwError("missing new", Logger$2.errors.MISSING_NEW, { name: kind.name });
        }
    }
    checkAbstract(target, kind) {
        if (target === kind) {
            this.throwError("cannot instantiate abstract class " + JSON.stringify(kind.name) + " directly; use a sub-class", Logger$2.errors.UNSUPPORTED_OPERATION, { name: target.name, operation: "new" });
        }
        else if (target === Object || target == null) {
            this.throwError("missing new", Logger$2.errors.MISSING_NEW, { name: kind.name });
        }
    }
    static globalLogger() {
        if (!_globalLogger$1) {
            _globalLogger$1 = new Logger$2(version$m);
        }
        return _globalLogger$1;
    }
    static setCensorship(censorship, permanent) {
        if (!censorship && permanent) {
            this.globalLogger().throwError("cannot permanently disable censorship", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "setCensorship"
            });
        }
        if (_permanentCensorErrors$1) {
            if (!censorship) {
                return;
            }
            this.globalLogger().throwError("error censorship permanent", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "setCensorship"
            });
        }
        _censorErrors$1 = !!censorship;
        _permanentCensorErrors$1 = !!permanent;
    }
    static setLogLevel(logLevel) {
        const level = LogLevels$1[logLevel.toLowerCase()];
        if (level == null) {
            Logger$2.globalLogger().warn("invalid log level - " + logLevel);
            return;
        }
        _logLevel$1 = level;
    }
    static from(version) {
        return new Logger$2(version);
    }
}
Logger$2.errors = ErrorCode$1;
Logger$2.levels = LogLevel$2;

const version$l = "bytes/5.7.0";

const logger$p = new Logger$2(version$l);
///////////////////////////////
function isHexable(value) {
    return !!(value.toHexString);
}
function addSlice(array) {
    if (array.slice) {
        return array;
    }
    array.slice = function () {
        const args = Array.prototype.slice.call(arguments);
        return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
    };
    return array;
}
function isBytesLike(value) {
    return ((isHexString(value) && !(value.length % 2)) || isBytes(value));
}
function isInteger(value) {
    return (typeof (value) === "number" && value == value && (value % 1) === 0);
}
function isBytes(value) {
    if (value == null) {
        return false;
    }
    if (value.constructor === Uint8Array) {
        return true;
    }
    if (typeof (value) === "string") {
        return false;
    }
    if (!isInteger(value.length) || value.length < 0) {
        return false;
    }
    for (let i = 0; i < value.length; i++) {
        const v = value[i];
        if (!isInteger(v) || v < 0 || v >= 256) {
            return false;
        }
    }
    return true;
}
function arrayify(value, options) {
    if (!options) {
        options = {};
    }
    if (typeof (value) === "number") {
        logger$p.checkSafeUint53(value, "invalid arrayify value");
        const result = [];
        while (value) {
            result.unshift(value & 0xff);
            value = parseInt(String(value / 256));
        }
        if (result.length === 0) {
            result.push(0);
        }
        return addSlice(new Uint8Array(result));
    }
    if (options.allowMissingPrefix && typeof (value) === "string" && value.substring(0, 2) !== "0x") {
        value = "0x" + value;
    }
    if (isHexable(value)) {
        value = value.toHexString();
    }
    if (isHexString(value)) {
        let hex = value.substring(2);
        if (hex.length % 2) {
            if (options.hexPad === "left") {
                hex = "0" + hex;
            }
            else if (options.hexPad === "right") {
                hex += "0";
            }
            else {
                logger$p.throwArgumentError("hex data is odd-length", "value", value);
            }
        }
        const result = [];
        for (let i = 0; i < hex.length; i += 2) {
            result.push(parseInt(hex.substring(i, i + 2), 16));
        }
        return addSlice(new Uint8Array(result));
    }
    if (isBytes(value)) {
        return addSlice(new Uint8Array(value));
    }
    return logger$p.throwArgumentError("invalid arrayify value", "value", value);
}
function concat(items) {
    const objects = items.map(item => arrayify(item));
    const length = objects.reduce((accum, item) => (accum + item.length), 0);
    const result = new Uint8Array(length);
    objects.reduce((offset, object) => {
        result.set(object, offset);
        return offset + object.length;
    }, 0);
    return addSlice(result);
}
function stripZeros(value) {
    let result = arrayify(value);
    if (result.length === 0) {
        return result;
    }
    // Find the first non-zero entry
    let start = 0;
    while (start < result.length && result[start] === 0) {
        start++;
    }
    // If we started with zeros, strip them
    if (start) {
        result = result.slice(start);
    }
    return result;
}
function zeroPad(value, length) {
    value = arrayify(value);
    if (value.length > length) {
        logger$p.throwArgumentError("value out of range", "value", arguments[0]);
    }
    const result = new Uint8Array(length);
    result.set(value, length - value.length);
    return addSlice(result);
}
function isHexString(value, length) {
    if (typeof (value) !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
        return false;
    }
    if (length && value.length !== 2 + 2 * length) {
        return false;
    }
    return true;
}
const HexCharacters = "0123456789abcdef";
function hexlify(value, options) {
    if (!options) {
        options = {};
    }
    if (typeof (value) === "number") {
        logger$p.checkSafeUint53(value, "invalid hexlify value");
        let hex = "";
        while (value) {
            hex = HexCharacters[value & 0xf] + hex;
            value = Math.floor(value / 16);
        }
        if (hex.length) {
            if (hex.length % 2) {
                hex = "0" + hex;
            }
            return "0x" + hex;
        }
        return "0x00";
    }
    if (typeof (value) === "bigint") {
        value = value.toString(16);
        if (value.length % 2) {
            return ("0x0" + value);
        }
        return "0x" + value;
    }
    if (options.allowMissingPrefix && typeof (value) === "string" && value.substring(0, 2) !== "0x") {
        value = "0x" + value;
    }
    if (isHexable(value)) {
        return value.toHexString();
    }
    if (isHexString(value)) {
        if (value.length % 2) {
            if (options.hexPad === "left") {
                value = "0x0" + value.substring(2);
            }
            else if (options.hexPad === "right") {
                value += "0";
            }
            else {
                logger$p.throwArgumentError("hex data is odd-length", "value", value);
            }
        }
        return value.toLowerCase();
    }
    if (isBytes(value)) {
        let result = "0x";
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
        }
        return result;
    }
    return logger$p.throwArgumentError("invalid hexlify value", "value", value);
}
/*
function unoddify(value: BytesLike | Hexable | number): BytesLike | Hexable | number {
    if (typeof(value) === "string" && value.length % 2 && value.substring(0, 2) === "0x") {
        return "0x0" + value.substring(2);
    }
    return value;
}
*/
function hexDataLength(data) {
    if (typeof (data) !== "string") {
        data = hexlify(data);
    }
    else if (!isHexString(data) || (data.length % 2)) {
        return null;
    }
    return (data.length - 2) / 2;
}
function hexDataSlice(data, offset, endOffset) {
    if (typeof (data) !== "string") {
        data = hexlify(data);
    }
    else if (!isHexString(data) || (data.length % 2)) {
        logger$p.throwArgumentError("invalid hexData", "value", data);
    }
    offset = 2 + 2 * offset;
    if (endOffset != null) {
        return "0x" + data.substring(offset, 2 + 2 * endOffset);
    }
    return "0x" + data.substring(offset);
}
function hexConcat(items) {
    let result = "0x";
    items.forEach((item) => {
        result += hexlify(item).substring(2);
    });
    return result;
}
function hexValue(value) {
    const trimmed = hexStripZeros(hexlify(value, { hexPad: "left" }));
    if (trimmed === "0x") {
        return "0x0";
    }
    return trimmed;
}
function hexStripZeros(value) {
    if (typeof (value) !== "string") {
        value = hexlify(value);
    }
    if (!isHexString(value)) {
        logger$p.throwArgumentError("invalid hex string", "value", value);
    }
    value = value.substring(2);
    let offset = 0;
    while (offset < value.length && value[offset] === "0") {
        offset++;
    }
    return "0x" + value.substring(offset);
}
function hexZeroPad(value, length) {
    if (typeof (value) !== "string") {
        value = hexlify(value);
    }
    else if (!isHexString(value)) {
        logger$p.throwArgumentError("invalid hex string", "value", value);
    }
    if (value.length > 2 * length + 2) {
        logger$p.throwArgumentError("value out of range", "value", arguments[1]);
    }
    while (value.length < 2 * length + 2) {
        value = "0x0" + value.substring(2);
    }
    return value;
}
function splitSignature(signature) {
    const result = {
        r: "0x",
        s: "0x",
        _vs: "0x",
        recoveryParam: 0,
        v: 0,
        yParityAndS: "0x",
        compact: "0x"
    };
    if (isBytesLike(signature)) {
        let bytes = arrayify(signature);
        // Get the r, s and v
        if (bytes.length === 64) {
            // EIP-2098; pull the v from the top bit of s and clear it
            result.v = 27 + (bytes[32] >> 7);
            bytes[32] &= 0x7f;
            result.r = hexlify(bytes.slice(0, 32));
            result.s = hexlify(bytes.slice(32, 64));
        }
        else if (bytes.length === 65) {
            result.r = hexlify(bytes.slice(0, 32));
            result.s = hexlify(bytes.slice(32, 64));
            result.v = bytes[64];
        }
        else {
            logger$p.throwArgumentError("invalid signature string", "signature", signature);
        }
        // Allow a recid to be used as the v
        if (result.v < 27) {
            if (result.v === 0 || result.v === 1) {
                result.v += 27;
            }
            else {
                logger$p.throwArgumentError("signature invalid v byte", "signature", signature);
            }
        }
        // Compute recoveryParam from v
        result.recoveryParam = 1 - (result.v % 2);
        // Compute _vs from recoveryParam and s
        if (result.recoveryParam) {
            bytes[32] |= 0x80;
        }
        result._vs = hexlify(bytes.slice(32, 64));
    }
    else {
        result.r = signature.r;
        result.s = signature.s;
        result.v = signature.v;
        result.recoveryParam = signature.recoveryParam;
        result._vs = signature._vs;
        // If the _vs is available, use it to populate missing s, v and recoveryParam
        // and verify non-missing s, v and recoveryParam
        if (result._vs != null) {
            const vs = zeroPad(arrayify(result._vs), 32);
            result._vs = hexlify(vs);
            // Set or check the recid
            const recoveryParam = ((vs[0] >= 128) ? 1 : 0);
            if (result.recoveryParam == null) {
                result.recoveryParam = recoveryParam;
            }
            else if (result.recoveryParam !== recoveryParam) {
                logger$p.throwArgumentError("signature recoveryParam mismatch _vs", "signature", signature);
            }
            // Set or check the s
            vs[0] &= 0x7f;
            const s = hexlify(vs);
            if (result.s == null) {
                result.s = s;
            }
            else if (result.s !== s) {
                logger$p.throwArgumentError("signature v mismatch _vs", "signature", signature);
            }
        }
        // Use recid and v to populate each other
        if (result.recoveryParam == null) {
            if (result.v == null) {
                logger$p.throwArgumentError("signature missing v and recoveryParam", "signature", signature);
            }
            else if (result.v === 0 || result.v === 1) {
                result.recoveryParam = result.v;
            }
            else {
                result.recoveryParam = 1 - (result.v % 2);
            }
        }
        else {
            if (result.v == null) {
                result.v = 27 + result.recoveryParam;
            }
            else {
                const recId = (result.v === 0 || result.v === 1) ? result.v : (1 - (result.v % 2));
                if (result.recoveryParam !== recId) {
                    logger$p.throwArgumentError("signature recoveryParam mismatch v", "signature", signature);
                }
            }
        }
        if (result.r == null || !isHexString(result.r)) {
            logger$p.throwArgumentError("signature missing or invalid r", "signature", signature);
        }
        else {
            result.r = hexZeroPad(result.r, 32);
        }
        if (result.s == null || !isHexString(result.s)) {
            logger$p.throwArgumentError("signature missing or invalid s", "signature", signature);
        }
        else {
            result.s = hexZeroPad(result.s, 32);
        }
        const vs = arrayify(result.s);
        if (vs[0] >= 128) {
            logger$p.throwArgumentError("signature s out of range", "signature", signature);
        }
        if (result.recoveryParam) {
            vs[0] |= 0x80;
        }
        const _vs = hexlify(vs);
        if (result._vs) {
            if (!isHexString(result._vs)) {
                logger$p.throwArgumentError("signature invalid _vs", "signature", signature);
            }
            result._vs = hexZeroPad(result._vs, 32);
        }
        // Set or check the _vs
        if (result._vs == null) {
            result._vs = _vs;
        }
        else if (result._vs !== _vs) {
            logger$p.throwArgumentError("signature _vs mismatch v and s", "signature", signature);
        }
    }
    result.yParityAndS = result._vs;
    result.compact = result.r + result.yParityAndS.substring(2);
    return result;
}
function joinSignature(signature) {
    signature = splitSignature(signature);
    return hexlify(concat([
        signature.r,
        signature.s,
        (signature.recoveryParam ? "0x1c" : "0x1b")
    ]));
}

const version$k = "bignumber/5.7.0";

var BN = BN$1.BN;
const logger$o = new Logger$2(version$k);
const _constructorGuard$2 = {};
const MAX_SAFE = 0x1fffffffffffff;
// Only warn about passing 10 into radix once
let _warnedToStringRadix = false;
class BigNumber {
    constructor(constructorGuard, hex) {
        if (constructorGuard !== _constructorGuard$2) {
            logger$o.throwError("cannot call constructor directly; use BigNumber.from", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "new (BigNumber)"
            });
        }
        this._hex = hex;
        this._isBigNumber = true;
        Object.freeze(this);
    }
    fromTwos(value) {
        return toBigNumber(toBN(this).fromTwos(value));
    }
    toTwos(value) {
        return toBigNumber(toBN(this).toTwos(value));
    }
    abs() {
        if (this._hex[0] === "-") {
            return BigNumber.from(this._hex.substring(1));
        }
        return this;
    }
    add(other) {
        return toBigNumber(toBN(this).add(toBN(other)));
    }
    sub(other) {
        return toBigNumber(toBN(this).sub(toBN(other)));
    }
    div(other) {
        const o = BigNumber.from(other);
        if (o.isZero()) {
            throwFault("division-by-zero", "div");
        }
        return toBigNumber(toBN(this).div(toBN(other)));
    }
    mul(other) {
        return toBigNumber(toBN(this).mul(toBN(other)));
    }
    mod(other) {
        const value = toBN(other);
        if (value.isNeg()) {
            throwFault("division-by-zero", "mod");
        }
        return toBigNumber(toBN(this).umod(value));
    }
    pow(other) {
        const value = toBN(other);
        if (value.isNeg()) {
            throwFault("negative-power", "pow");
        }
        return toBigNumber(toBN(this).pow(value));
    }
    and(other) {
        const value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("unbound-bitwise-result", "and");
        }
        return toBigNumber(toBN(this).and(value));
    }
    or(other) {
        const value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("unbound-bitwise-result", "or");
        }
        return toBigNumber(toBN(this).or(value));
    }
    xor(other) {
        const value = toBN(other);
        if (this.isNegative() || value.isNeg()) {
            throwFault("unbound-bitwise-result", "xor");
        }
        return toBigNumber(toBN(this).xor(value));
    }
    mask(value) {
        if (this.isNegative() || value < 0) {
            throwFault("negative-width", "mask");
        }
        return toBigNumber(toBN(this).maskn(value));
    }
    shl(value) {
        if (this.isNegative() || value < 0) {
            throwFault("negative-width", "shl");
        }
        return toBigNumber(toBN(this).shln(value));
    }
    shr(value) {
        if (this.isNegative() || value < 0) {
            throwFault("negative-width", "shr");
        }
        return toBigNumber(toBN(this).shrn(value));
    }
    eq(other) {
        return toBN(this).eq(toBN(other));
    }
    lt(other) {
        return toBN(this).lt(toBN(other));
    }
    lte(other) {
        return toBN(this).lte(toBN(other));
    }
    gt(other) {
        return toBN(this).gt(toBN(other));
    }
    gte(other) {
        return toBN(this).gte(toBN(other));
    }
    isNegative() {
        return (this._hex[0] === "-");
    }
    isZero() {
        return toBN(this).isZero();
    }
    toNumber() {
        try {
            return toBN(this).toNumber();
        }
        catch (error) {
            throwFault("overflow", "toNumber", this.toString());
        }
        return null;
    }
    toBigInt() {
        try {
            return BigInt(this.toString());
        }
        catch (e) { }
        return logger$o.throwError("this platform does not support BigInt", Logger$2.errors.UNSUPPORTED_OPERATION, {
            value: this.toString()
        });
    }
    toString() {
        // Lots of people expect this, which we do not support, so check (See: #889)
        if (arguments.length > 0) {
            if (arguments[0] === 10) {
                if (!_warnedToStringRadix) {
                    _warnedToStringRadix = true;
                    logger$o.warn("BigNumber.toString does not accept any parameters; base-10 is assumed");
                }
            }
            else if (arguments[0] === 16) {
                logger$o.throwError("BigNumber.toString does not accept any parameters; use bigNumber.toHexString()", Logger$2.errors.UNEXPECTED_ARGUMENT, {});
            }
            else {
                logger$o.throwError("BigNumber.toString does not accept parameters", Logger$2.errors.UNEXPECTED_ARGUMENT, {});
            }
        }
        return toBN(this).toString(10);
    }
    toHexString() {
        return this._hex;
    }
    toJSON(key) {
        return { type: "BigNumber", hex: this.toHexString() };
    }
    static from(value) {
        if (value instanceof BigNumber) {
            return value;
        }
        if (typeof (value) === "string") {
            if (value.match(/^-?0x[0-9a-f]+$/i)) {
                return new BigNumber(_constructorGuard$2, toHex$2(value));
            }
            if (value.match(/^-?[0-9]+$/)) {
                return new BigNumber(_constructorGuard$2, toHex$2(new BN(value)));
            }
            return logger$o.throwArgumentError("invalid BigNumber string", "value", value);
        }
        if (typeof (value) === "number") {
            if (value % 1) {
                throwFault("underflow", "BigNumber.from", value);
            }
            if (value >= MAX_SAFE || value <= -MAX_SAFE) {
                throwFault("overflow", "BigNumber.from", value);
            }
            return BigNumber.from(String(value));
        }
        const anyValue = value;
        if (typeof (anyValue) === "bigint") {
            return BigNumber.from(anyValue.toString());
        }
        if (isBytes(anyValue)) {
            return BigNumber.from(hexlify(anyValue));
        }
        if (anyValue) {
            // Hexable interface (takes priority)
            if (anyValue.toHexString) {
                const hex = anyValue.toHexString();
                if (typeof (hex) === "string") {
                    return BigNumber.from(hex);
                }
            }
            else {
                // For now, handle legacy JSON-ified values (goes away in v6)
                let hex = anyValue._hex;
                // New-form JSON
                if (hex == null && anyValue.type === "BigNumber") {
                    hex = anyValue.hex;
                }
                if (typeof (hex) === "string") {
                    if (isHexString(hex) || (hex[0] === "-" && isHexString(hex.substring(1)))) {
                        return BigNumber.from(hex);
                    }
                }
            }
        }
        return logger$o.throwArgumentError("invalid BigNumber value", "value", value);
    }
    static isBigNumber(value) {
        return !!(value && value._isBigNumber);
    }
}
// Normalize the hex string
function toHex$2(value) {
    // For BN, call on the hex string
    if (typeof (value) !== "string") {
        return toHex$2(value.toString(16));
    }
    // If negative, prepend the negative sign to the normalized positive value
    if (value[0] === "-") {
        // Strip off the negative sign
        value = value.substring(1);
        // Cannot have multiple negative signs (e.g. "--0x04")
        if (value[0] === "-") {
            logger$o.throwArgumentError("invalid hex", "value", value);
        }
        // Call toHex on the positive component
        value = toHex$2(value);
        // Do not allow "-0x00"
        if (value === "0x00") {
            return value;
        }
        // Negate the value
        return "-" + value;
    }
    // Add a "0x" prefix if missing
    if (value.substring(0, 2) !== "0x") {
        value = "0x" + value;
    }
    // Normalize zero
    if (value === "0x") {
        return "0x00";
    }
    // Make the string even length
    if (value.length % 2) {
        value = "0x0" + value.substring(2);
    }
    // Trim to smallest even-length string
    while (value.length > 4 && value.substring(0, 4) === "0x00") {
        value = "0x" + value.substring(4);
    }
    return value;
}
function toBigNumber(value) {
    return BigNumber.from(toHex$2(value));
}
function toBN(value) {
    const hex = BigNumber.from(value).toHexString();
    if (hex[0] === "-") {
        return (new BN("-" + hex.substring(3), 16));
    }
    return new BN(hex.substring(2), 16);
}
function throwFault(fault, operation, value) {
    const params = { fault: fault, operation: operation };
    if (value != null) {
        params.value = value;
    }
    return logger$o.throwError(fault, Logger$2.errors.NUMERIC_FAULT, params);
}
// value should have no prefix
function _base36To16(value) {
    return (new BN(value, 36)).toString(16);
}

var axios$2 = {exports: {}};

var bind$2 = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

var bind$1 = bind$2;

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return Array.isArray(val);
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is a Buffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return toString.call(val) === '[object FormData]';
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a plain Object
 *
 * @param {Object} val The value to test
 * @return {boolean} True if value is a plain Object, otherwise false
 */
function isPlainObject(val) {
  if (toString.call(val) !== '[object Object]') {
    return false;
  }

  var prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return toString.call(val) === '[object URLSearchParams]';
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (isPlainObject(result[key]) && isPlainObject(val)) {
      result[key] = merge(result[key], val);
    } else if (isPlainObject(val)) {
      result[key] = merge({}, val);
    } else if (isArray(val)) {
      result[key] = val.slice();
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind$1(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 * @return {string} content value without BOM
 */
function stripBOM(content) {
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

var utils$p = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isPlainObject: isPlainObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim,
  stripBOM: stripBOM
};

var utils$o = utils$p;

function encode$3(val) {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
var buildURL$3 = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils$o.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils$o.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils$o.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils$o.forEach(val, function parseValue(v) {
        if (utils$o.isDate(v)) {
          v = v.toISOString();
        } else if (utils$o.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode$3(key) + '=' + encode$3(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

var utils$n = utils$p;

function InterceptorManager$1() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager$1.prototype.use = function use(fulfilled, rejected, options) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected,
    synchronous: options ? options.synchronous : false,
    runWhen: options ? options.runWhen : null
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager$1.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager$1.prototype.forEach = function forEach(fn) {
  utils$n.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

var InterceptorManager_1 = InterceptorManager$1;

var utils$m = utils$p;

var normalizeHeaderName$1 = function normalizeHeaderName(headers, normalizedName) {
  utils$m.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
var enhanceError$3 = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function toJSON() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code,
      status: this.response && this.response.status ? this.response.status : null
    };
  };
  return error;
};

var transitional = {
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false
};

var enhanceError$2 = enhanceError$3;

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
var createError$3 = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError$2(error, config, code, request, response);
};

var createError$2 = createError$3;

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
var settle$2 = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError$2(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

var utils$l = utils$p;

var cookies$1 = (
  utils$l.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils$l.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils$l.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils$l.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
var isAbsoluteURL$1 = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
};

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
var combineURLs$1 = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

var isAbsoluteURL = isAbsoluteURL$1;
var combineURLs = combineURLs$1;

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 * @returns {string} The combined full path
 */
var buildFullPath$2 = function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};

var utils$k = utils$p;

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
var parseHeaders$1 = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils$k.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils$k.trim(line.substr(0, i)).toLowerCase();
    val = utils$k.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

var utils$j = utils$p;

var isURLSameOrigin$1 = (
  utils$j.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils$j.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel$4(message) {
  this.message = message;
}

Cancel$4.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel$4.prototype.__CANCEL__ = true;

var Cancel_1 = Cancel$4;

var utils$i = utils$p;
var settle$1 = settle$2;
var cookies = cookies$1;
var buildURL$2 = buildURL$3;
var buildFullPath$1 = buildFullPath$2;
var parseHeaders = parseHeaders$1;
var isURLSameOrigin = isURLSameOrigin$1;
var createError$1 = createError$3;
var transitionalDefaults$2 = transitional;
var Cancel$3 = Cancel_1;

var xhr = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    var responseType = config.responseType;
    var onCanceled;
    function done() {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(onCanceled);
      }

      if (config.signal) {
        config.signal.removeEventListener('abort', onCanceled);
      }
    }

    if (utils$i.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    var fullPath = buildFullPath$1(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL$2(fullPath, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    function onloadend() {
      if (!request) {
        return;
      }
      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
        request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle$1(function _resolve(value) {
        resolve(value);
        done();
      }, function _reject(err) {
        reject(err);
        done();
      }, response);

      // Clean up request
      request = null;
    }

    if ('onloadend' in request) {
      // Use onloadend if available
      request.onloadend = onloadend;
    } else {
      // Listen for ready state to emulate onloadend
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }

        // The request errored out and we didn't get a response, this will be
        // handled by onerror instead
        // With one exception: request that using file: protocol, most browsers
        // will return status as 0 even though it's a successful request
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
          return;
        }
        // readystate handler is calling before onerror or ontimeout handlers,
        // so we should call onloadend on the next 'tick'
        setTimeout(onloadend);
      };
    }

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError$1('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError$1('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
      var transitional = config.transitional || transitionalDefaults$2;
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError$1(
        timeoutErrorMessage,
        config,
        transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils$i.isStandardBrowserEnv()) {
      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils$i.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (!utils$i.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // Add responseType to request if needed
    if (responseType && responseType !== 'json') {
      request.responseType = config.responseType;
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken || config.signal) {
      // Handle cancellation
      // eslint-disable-next-line func-names
      onCanceled = function(cancel) {
        if (!request) {
          return;
        }
        reject(!cancel || (cancel && cancel.type) ? new Cancel$3('canceled') : cancel);
        request.abort();
        request = null;
      };

      config.cancelToken && config.cancelToken.subscribe(onCanceled);
      if (config.signal) {
        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
      }
    }

    if (!requestData) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

var followRedirects = {exports: {}};

var debug$1;

var debug_1 = function () {
  if (!debug$1) {
    try {
      /* eslint global-require: off */
      debug$1 = require("debug")("follow-redirects");
    }
    catch (error) { /* */ }
    if (typeof debug$1 !== "function") {
      debug$1 = function () { /* */ };
    }
  }
  debug$1.apply(null, arguments);
};

var url$1 = require$$0__default["default"];
var URL = url$1.URL;
var http$1 = require$$1__default["default"];
var https$1 = require$$2__default["default"];
var Writable = require$$3__default["default"].Writable;
var assert$c = require$$4__default["default"];
var debug = debug_1;

// Create handlers that pass events from native requests
var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
var eventHandlers = Object.create(null);
events.forEach(function (event) {
  eventHandlers[event] = function (arg1, arg2, arg3) {
    this._redirectable.emit(event, arg1, arg2, arg3);
  };
});

// Error types with codes
var RedirectionError = createErrorType(
  "ERR_FR_REDIRECTION_FAILURE",
  "Redirected request failed"
);
var TooManyRedirectsError = createErrorType(
  "ERR_FR_TOO_MANY_REDIRECTS",
  "Maximum number of redirects exceeded"
);
var MaxBodyLengthExceededError = createErrorType(
  "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
  "Request body larger than maxBodyLength limit"
);
var WriteAfterEndError = createErrorType(
  "ERR_STREAM_WRITE_AFTER_END",
  "write after end"
);

// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
  // Initialize the request
  Writable.call(this);
  this._sanitizeOptions(options);
  this._options = options;
  this._ended = false;
  this._ending = false;
  this._redirectCount = 0;
  this._redirects = [];
  this._requestBodyLength = 0;
  this._requestBodyBuffers = [];

  // Attach a callback if passed
  if (responseCallback) {
    this.on("response", responseCallback);
  }

  // React to responses of native requests
  var self = this;
  this._onNativeResponse = function (response) {
    self._processResponse(response);
  };

  // Perform the first request
  this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);

RedirectableRequest.prototype.abort = function () {
  abortRequest(this._currentRequest);
  this.emit("abort");
};

// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function (data, encoding, callback) {
  // Writing is not allowed if end has been called
  if (this._ending) {
    throw new WriteAfterEndError();
  }

  // Validate input and shift parameters if necessary
  if (!(typeof data === "string" || typeof data === "object" && ("length" in data))) {
    throw new TypeError("data should be a string, Buffer or Uint8Array");
  }
  if (typeof encoding === "function") {
    callback = encoding;
    encoding = null;
  }

  // Ignore empty buffers, since writing them doesn't invoke the callback
  // https://github.com/nodejs/node/issues/22066
  if (data.length === 0) {
    if (callback) {
      callback();
    }
    return;
  }
  // Only write when we don't exceed the maximum body length
  if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
    this._requestBodyLength += data.length;
    this._requestBodyBuffers.push({ data: data, encoding: encoding });
    this._currentRequest.write(data, encoding, callback);
  }
  // Error when we exceed the maximum body length
  else {
    this.emit("error", new MaxBodyLengthExceededError());
    this.abort();
  }
};

// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
  // Shift parameters if necessary
  if (typeof data === "function") {
    callback = data;
    data = encoding = null;
  }
  else if (typeof encoding === "function") {
    callback = encoding;
    encoding = null;
  }

  // Write data if needed and end
  if (!data) {
    this._ended = this._ending = true;
    this._currentRequest.end(null, null, callback);
  }
  else {
    var self = this;
    var currentRequest = this._currentRequest;
    this.write(data, encoding, function () {
      self._ended = true;
      currentRequest.end(null, null, callback);
    });
    this._ending = true;
  }
};

// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function (name, value) {
  this._options.headers[name] = value;
  this._currentRequest.setHeader(name, value);
};

// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function (name) {
  delete this._options.headers[name];
  this._currentRequest.removeHeader(name);
};

// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
  var self = this;

  // Destroys the socket on timeout
  function destroyOnTimeout(socket) {
    socket.setTimeout(msecs);
    socket.removeListener("timeout", socket.destroy);
    socket.addListener("timeout", socket.destroy);
  }

  // Sets up a timer to trigger a timeout event
  function startTimer(socket) {
    if (self._timeout) {
      clearTimeout(self._timeout);
    }
    self._timeout = setTimeout(function () {
      self.emit("timeout");
      clearTimer();
    }, msecs);
    destroyOnTimeout(socket);
  }

  // Stops a timeout from triggering
  function clearTimer() {
    // Clear the timeout
    if (self._timeout) {
      clearTimeout(self._timeout);
      self._timeout = null;
    }

    // Clean up all attached listeners
    self.removeListener("abort", clearTimer);
    self.removeListener("error", clearTimer);
    self.removeListener("response", clearTimer);
    if (callback) {
      self.removeListener("timeout", callback);
    }
    if (!self.socket) {
      self._currentRequest.removeListener("socket", startTimer);
    }
  }

  // Attach callback if passed
  if (callback) {
    this.on("timeout", callback);
  }

  // Start the timer if or when the socket is opened
  if (this.socket) {
    startTimer(this.socket);
  }
  else {
    this._currentRequest.once("socket", startTimer);
  }

  // Clean up on events
  this.on("socket", destroyOnTimeout);
  this.on("abort", clearTimer);
  this.on("error", clearTimer);
  this.on("response", clearTimer);

  return this;
};

// Proxy all other public ClientRequest methods
[
  "flushHeaders", "getHeader",
  "setNoDelay", "setSocketKeepAlive",
].forEach(function (method) {
  RedirectableRequest.prototype[method] = function (a, b) {
    return this._currentRequest[method](a, b);
  };
});

// Proxy all public ClientRequest properties
["aborted", "connection", "socket"].forEach(function (property) {
  Object.defineProperty(RedirectableRequest.prototype, property, {
    get: function () { return this._currentRequest[property]; },
  });
});

RedirectableRequest.prototype._sanitizeOptions = function (options) {
  // Ensure headers are always present
  if (!options.headers) {
    options.headers = {};
  }

  // Since http.request treats host as an alias of hostname,
  // but the url module interprets host as hostname plus port,
  // eliminate the host property to avoid confusion.
  if (options.host) {
    // Use hostname if set, because it has precedence
    if (!options.hostname) {
      options.hostname = options.host;
    }
    delete options.host;
  }

  // Complete the URL object when necessary
  if (!options.pathname && options.path) {
    var searchPos = options.path.indexOf("?");
    if (searchPos < 0) {
      options.pathname = options.path;
    }
    else {
      options.pathname = options.path.substring(0, searchPos);
      options.search = options.path.substring(searchPos);
    }
  }
};


// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
  // Load the native protocol
  var protocol = this._options.protocol;
  var nativeProtocol = this._options.nativeProtocols[protocol];
  if (!nativeProtocol) {
    this.emit("error", new TypeError("Unsupported protocol " + protocol));
    return;
  }

  // If specified, use the agent corresponding to the protocol
  // (HTTP and HTTPS use different types of agents)
  if (this._options.agents) {
    var scheme = protocol.slice(0, -1);
    this._options.agent = this._options.agents[scheme];
  }

  // Create the native request and set up its event handlers
  var request = this._currentRequest =
        nativeProtocol.request(this._options, this._onNativeResponse);
  request._redirectable = this;
  for (var event of events) {
    request.on(event, eventHandlers[event]);
  }

  // RFC7230§5.3.1: When making a request directly to an origin server, […]
  // a client MUST send only the absolute path […] as the request-target.
  this._currentUrl = /^\//.test(this._options.path) ?
    url$1.format(this._options) :
    // When making a request to a proxy, […]
    // a client MUST send the target URI in absolute-form […].
    this._currentUrl = this._options.path;

  // End a redirected request
  // (The first request must be ended explicitly with RedirectableRequest#end)
  if (this._isRedirect) {
    // Write the request entity and end
    var i = 0;
    var self = this;
    var buffers = this._requestBodyBuffers;
    (function writeNext(error) {
      // Only write if this request has not been redirected yet
      /* istanbul ignore else */
      if (request === self._currentRequest) {
        // Report any write errors
        /* istanbul ignore if */
        if (error) {
          self.emit("error", error);
        }
        // Write the next buffer if there are still left
        else if (i < buffers.length) {
          var buffer = buffers[i++];
          /* istanbul ignore else */
          if (!request.finished) {
            request.write(buffer.data, buffer.encoding, writeNext);
          }
        }
        // End the request if `end` has been called on us
        else if (self._ended) {
          request.end();
        }
      }
    }());
  }
};

// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
  // Store the redirected response
  var statusCode = response.statusCode;
  if (this._options.trackRedirects) {
    this._redirects.push({
      url: this._currentUrl,
      headers: response.headers,
      statusCode: statusCode,
    });
  }

  // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
  // that further action needs to be taken by the user agent in order to
  // fulfill the request. If a Location header field is provided,
  // the user agent MAY automatically redirect its request to the URI
  // referenced by the Location field value,
  // even if the specific status code is not understood.

  // If the response is not a redirect; return it as-is
  var location = response.headers.location;
  if (!location || this._options.followRedirects === false ||
      statusCode < 300 || statusCode >= 400) {
    response.responseUrl = this._currentUrl;
    response.redirects = this._redirects;
    this.emit("response", response);

    // Clean up
    this._requestBodyBuffers = [];
    return;
  }

  // The response is a redirect, so abort the current request
  abortRequest(this._currentRequest);
  // Discard the remainder of the response to avoid waiting for data
  response.destroy();

  // RFC7231§6.4: A client SHOULD detect and intervene
  // in cyclical redirections (i.e., "infinite" redirection loops).
  if (++this._redirectCount > this._options.maxRedirects) {
    this.emit("error", new TooManyRedirectsError());
    return;
  }

  // Store the request headers if applicable
  var requestHeaders;
  var beforeRedirect = this._options.beforeRedirect;
  if (beforeRedirect) {
    requestHeaders = Object.assign({
      // The Host header was set by nativeProtocol.request
      Host: response.req.getHeader("host"),
    }, this._options.headers);
  }

  // RFC7231§6.4: Automatic redirection needs to done with
  // care for methods not known to be safe, […]
  // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
  // the request method from POST to GET for the subsequent request.
  var method = this._options.method;
  if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" ||
      // RFC7231§6.4.4: The 303 (See Other) status code indicates that
      // the server is redirecting the user agent to a different resource […]
      // A user agent can perform a retrieval request targeting that URI
      // (a GET or HEAD request if using HTTP) […]
      (statusCode === 303) && !/^(?:GET|HEAD)$/.test(this._options.method)) {
    this._options.method = "GET";
    // Drop a possible entity and headers related to it
    this._requestBodyBuffers = [];
    removeMatchingHeaders(/^content-/i, this._options.headers);
  }

  // Drop the Host header, as the redirect might lead to a different host
  var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);

  // If the redirect is relative, carry over the host of the last request
  var currentUrlParts = url$1.parse(this._currentUrl);
  var currentHost = currentHostHeader || currentUrlParts.host;
  var currentUrl = /^\w+:/.test(location) ? this._currentUrl :
    url$1.format(Object.assign(currentUrlParts, { host: currentHost }));

  // Determine the URL of the redirection
  var redirectUrl;
  try {
    redirectUrl = url$1.resolve(currentUrl, location);
  }
  catch (cause) {
    this.emit("error", new RedirectionError(cause));
    return;
  }

  // Create the redirected request
  debug("redirecting to", redirectUrl);
  this._isRedirect = true;
  var redirectUrlParts = url$1.parse(redirectUrl);
  Object.assign(this._options, redirectUrlParts);

  // Drop confidential headers when redirecting to a less secure protocol
  // or to a different domain that is not a superdomain
  if (redirectUrlParts.protocol !== currentUrlParts.protocol &&
     redirectUrlParts.protocol !== "https:" ||
     redirectUrlParts.host !== currentHost &&
     !isSubdomain(redirectUrlParts.host, currentHost)) {
    removeMatchingHeaders(/^(?:authorization|cookie)$/i, this._options.headers);
  }

  // Evaluate the beforeRedirect callback
  if (typeof beforeRedirect === "function") {
    var responseDetails = {
      headers: response.headers,
      statusCode: statusCode,
    };
    var requestDetails = {
      url: currentUrl,
      method: method,
      headers: requestHeaders,
    };
    try {
      beforeRedirect(this._options, responseDetails, requestDetails);
    }
    catch (err) {
      this.emit("error", err);
      return;
    }
    this._sanitizeOptions(this._options);
  }

  // Perform the redirected request
  try {
    this._performRequest();
  }
  catch (cause) {
    this.emit("error", new RedirectionError(cause));
  }
};

// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
  // Default settings
  var exports = {
    maxRedirects: 21,
    maxBodyLength: 10 * 1024 * 1024,
  };

  // Wrap each protocol
  var nativeProtocols = {};
  Object.keys(protocols).forEach(function (scheme) {
    var protocol = scheme + ":";
    var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
    var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);

    // Executes a request, following redirects
    function request(input, options, callback) {
      // Parse parameters
      if (typeof input === "string") {
        var urlStr = input;
        try {
          input = urlToOptions(new URL(urlStr));
        }
        catch (err) {
          /* istanbul ignore next */
          input = url$1.parse(urlStr);
        }
      }
      else if (URL && (input instanceof URL)) {
        input = urlToOptions(input);
      }
      else {
        callback = options;
        options = input;
        input = { protocol: protocol };
      }
      if (typeof options === "function") {
        callback = options;
        options = null;
      }

      // Set defaults
      options = Object.assign({
        maxRedirects: exports.maxRedirects,
        maxBodyLength: exports.maxBodyLength,
      }, input, options);
      options.nativeProtocols = nativeProtocols;

      assert$c.equal(options.protocol, protocol, "protocol mismatch");
      debug("options", options);
      return new RedirectableRequest(options, callback);
    }

    // Executes a GET request, following redirects
    function get(input, options, callback) {
      var wrappedRequest = wrappedProtocol.request(input, options, callback);
      wrappedRequest.end();
      return wrappedRequest;
    }

    // Expose the properties on the wrapped protocol
    Object.defineProperties(wrappedProtocol, {
      request: { value: request, configurable: true, enumerable: true, writable: true },
      get: { value: get, configurable: true, enumerable: true, writable: true },
    });
  });
  return exports;
}

/* istanbul ignore next */
function noop$2() { /* empty */ }

// from https://github.com/nodejs/node/blob/master/lib/internal/url.js
function urlToOptions(urlObject) {
  var options = {
    protocol: urlObject.protocol,
    hostname: urlObject.hostname.startsWith("[") ?
      /* istanbul ignore next */
      urlObject.hostname.slice(1, -1) :
      urlObject.hostname,
    hash: urlObject.hash,
    search: urlObject.search,
    pathname: urlObject.pathname,
    path: urlObject.pathname + urlObject.search,
    href: urlObject.href,
  };
  if (urlObject.port !== "") {
    options.port = Number(urlObject.port);
  }
  return options;
}

function removeMatchingHeaders(regex, headers) {
  var lastValue;
  for (var header in headers) {
    if (regex.test(header)) {
      lastValue = headers[header];
      delete headers[header];
    }
  }
  return (lastValue === null || typeof lastValue === "undefined") ?
    undefined : String(lastValue).trim();
}

function createErrorType(code, defaultMessage) {
  function CustomError(cause) {
    Error.captureStackTrace(this, this.constructor);
    if (!cause) {
      this.message = defaultMessage;
    }
    else {
      this.message = defaultMessage + ": " + cause.message;
      this.cause = cause;
    }
  }
  CustomError.prototype = new Error();
  CustomError.prototype.constructor = CustomError;
  CustomError.prototype.name = "Error [" + code + "]";
  CustomError.prototype.code = code;
  return CustomError;
}

function abortRequest(request) {
  for (var event of events) {
    request.removeListener(event, eventHandlers[event]);
  }
  request.on("error", noop$2);
  request.abort();
}

function isSubdomain(subdomain, domain) {
  const dot = subdomain.length - domain.length - 1;
  return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}

// Exports
followRedirects.exports = wrap({ http: http$1, https: https$1 });
followRedirects.exports.wrap = wrap;

var data = {
  "version": "0.26.1"
};

var utils$h = utils$p;
var settle = settle$2;
var buildFullPath = buildFullPath$2;
var buildURL$1 = buildURL$3;
var http = require$$1__default["default"];
var https = require$$2__default["default"];
var httpFollow = followRedirects.exports.http;
var httpsFollow = followRedirects.exports.https;
var url = require$$0__default["default"];
var zlib = require$$8__default["default"];
var VERSION$2 = data.version;
var createError = createError$3;
var enhanceError$1 = enhanceError$3;
var transitionalDefaults$1 = transitional;
var Cancel$2 = Cancel_1;

var isHttps = /https:?/;

/**
 *
 * @param {http.ClientRequestArgs} options
 * @param {AxiosProxyConfig} proxy
 * @param {string} location
 */
function setProxy(options, proxy, location) {
  options.hostname = proxy.host;
  options.host = proxy.host;
  options.port = proxy.port;
  options.path = location;

  // Basic proxy authorization
  if (proxy.auth) {
    var base64 = Buffer.from(proxy.auth.username + ':' + proxy.auth.password, 'utf8').toString('base64');
    options.headers['Proxy-Authorization'] = 'Basic ' + base64;
  }

  // If a proxy is used, any redirects must also pass through the proxy
  options.beforeRedirect = function beforeRedirect(redirection) {
    redirection.headers.host = redirection.host;
    setProxy(redirection, proxy, redirection.href);
  };
}

/*eslint consistent-return:0*/
var http_1 = function httpAdapter(config) {
  return new Promise(function dispatchHttpRequest(resolvePromise, rejectPromise) {
    var onCanceled;
    function done() {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(onCanceled);
      }

      if (config.signal) {
        config.signal.removeEventListener('abort', onCanceled);
      }
    }
    var resolve = function resolve(value) {
      done();
      resolvePromise(value);
    };
    var rejected = false;
    var reject = function reject(value) {
      done();
      rejected = true;
      rejectPromise(value);
    };
    var data = config.data;
    var headers = config.headers;
    var headerNames = {};

    Object.keys(headers).forEach(function storeLowerName(name) {
      headerNames[name.toLowerCase()] = name;
    });

    // Set User-Agent (required by some servers)
    // See https://github.com/axios/axios/issues/69
    if ('user-agent' in headerNames) {
      // User-Agent is specified; handle case where no UA header is desired
      if (!headers[headerNames['user-agent']]) {
        delete headers[headerNames['user-agent']];
      }
      // Otherwise, use specified value
    } else {
      // Only set header if it hasn't been set in config
      headers['User-Agent'] = 'axios/' + VERSION$2;
    }

    if (data && !utils$h.isStream(data)) {
      if (Buffer.isBuffer(data)) ; else if (utils$h.isArrayBuffer(data)) {
        data = Buffer.from(new Uint8Array(data));
      } else if (utils$h.isString(data)) {
        data = Buffer.from(data, 'utf-8');
      } else {
        return reject(createError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          config
        ));
      }

      if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
        return reject(createError('Request body larger than maxBodyLength limit', config));
      }

      // Add Content-Length header if data exists
      if (!headerNames['content-length']) {
        headers['Content-Length'] = data.length;
      }
    }

    // HTTP basic authentication
    var auth = undefined;
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      auth = username + ':' + password;
    }

    // Parse url
    var fullPath = buildFullPath(config.baseURL, config.url);
    var parsed = url.parse(fullPath);
    var protocol = parsed.protocol || 'http:';

    if (!auth && parsed.auth) {
      var urlAuth = parsed.auth.split(':');
      var urlUsername = urlAuth[0] || '';
      var urlPassword = urlAuth[1] || '';
      auth = urlUsername + ':' + urlPassword;
    }

    if (auth && headerNames.authorization) {
      delete headers[headerNames.authorization];
    }

    var isHttpsRequest = isHttps.test(protocol);
    var agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;

    try {
      buildURL$1(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, '');
    } catch (err) {
      var customErr = new Error(err.message);
      customErr.config = config;
      customErr.url = config.url;
      customErr.exists = true;
      reject(customErr);
    }

    var options = {
      path: buildURL$1(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, ''),
      method: config.method.toUpperCase(),
      headers: headers,
      agent: agent,
      agents: { http: config.httpAgent, https: config.httpsAgent },
      auth: auth
    };

    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname;
      options.port = parsed.port;
    }

    var proxy = config.proxy;
    if (!proxy && proxy !== false) {
      var proxyEnv = protocol.slice(0, -1) + '_proxy';
      var proxyUrl = process.env[proxyEnv] || process.env[proxyEnv.toUpperCase()];
      if (proxyUrl) {
        var parsedProxyUrl = url.parse(proxyUrl);
        var noProxyEnv = process.env.no_proxy || process.env.NO_PROXY;
        var shouldProxy = true;

        if (noProxyEnv) {
          var noProxy = noProxyEnv.split(',').map(function trim(s) {
            return s.trim();
          });

          shouldProxy = !noProxy.some(function proxyMatch(proxyElement) {
            if (!proxyElement) {
              return false;
            }
            if (proxyElement === '*') {
              return true;
            }
            if (proxyElement[0] === '.' &&
                parsed.hostname.substr(parsed.hostname.length - proxyElement.length) === proxyElement) {
              return true;
            }

            return parsed.hostname === proxyElement;
          });
        }

        if (shouldProxy) {
          proxy = {
            host: parsedProxyUrl.hostname,
            port: parsedProxyUrl.port,
            protocol: parsedProxyUrl.protocol
          };

          if (parsedProxyUrl.auth) {
            var proxyUrlAuth = parsedProxyUrl.auth.split(':');
            proxy.auth = {
              username: proxyUrlAuth[0],
              password: proxyUrlAuth[1]
            };
          }
        }
      }
    }

    if (proxy) {
      options.headers.host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');
      setProxy(options, proxy, protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path);
    }

    var transport;
    var isHttpsProxy = isHttpsRequest && (proxy ? isHttps.test(proxy.protocol) : true);
    if (config.transport) {
      transport = config.transport;
    } else if (config.maxRedirects === 0) {
      transport = isHttpsProxy ? https : http;
    } else {
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      transport = isHttpsProxy ? httpsFollow : httpFollow;
    }

    if (config.maxBodyLength > -1) {
      options.maxBodyLength = config.maxBodyLength;
    }

    if (config.insecureHTTPParser) {
      options.insecureHTTPParser = config.insecureHTTPParser;
    }

    // Create the request
    var req = transport.request(options, function handleResponse(res) {
      if (req.aborted) return;

      // uncompress the response body transparently if required
      var stream = res;

      // return the last request in case of redirects
      var lastRequest = res.req || req;


      // if no content, is HEAD request or decompress disabled we should not decompress
      if (res.statusCode !== 204 && lastRequest.method !== 'HEAD' && config.decompress !== false) {
        switch (res.headers['content-encoding']) {
        /*eslint default-case:0*/
        case 'gzip':
        case 'compress':
        case 'deflate':
        // add the unzipper to the body stream processing pipeline
          stream = stream.pipe(zlib.createUnzip());

          // remove the content-encoding in order to not confuse downstream operations
          delete res.headers['content-encoding'];
          break;
        }
      }

      var response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: res.headers,
        config: config,
        request: lastRequest
      };

      if (config.responseType === 'stream') {
        response.data = stream;
        settle(resolve, reject, response);
      } else {
        var responseBuffer = [];
        var totalResponseBytes = 0;
        stream.on('data', function handleStreamData(chunk) {
          responseBuffer.push(chunk);
          totalResponseBytes += chunk.length;

          // make sure the content length is not over the maxContentLength if specified
          if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
            // stream.destoy() emit aborted event before calling reject() on Node.js v16
            rejected = true;
            stream.destroy();
            reject(createError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
              config, null, lastRequest));
          }
        });

        stream.on('aborted', function handlerStreamAborted() {
          if (rejected) {
            return;
          }
          stream.destroy();
          reject(createError('error request aborted', config, 'ERR_REQUEST_ABORTED', lastRequest));
        });

        stream.on('error', function handleStreamError(err) {
          if (req.aborted) return;
          reject(enhanceError$1(err, config, null, lastRequest));
        });

        stream.on('end', function handleStreamEnd() {
          try {
            var responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
            if (config.responseType !== 'arraybuffer') {
              responseData = responseData.toString(config.responseEncoding);
              if (!config.responseEncoding || config.responseEncoding === 'utf8') {
                responseData = utils$h.stripBOM(responseData);
              }
            }
            response.data = responseData;
          } catch (err) {
            reject(enhanceError$1(err, config, err.code, response.request, response));
          }
          settle(resolve, reject, response);
        });
      }
    });

    // Handle errors
    req.on('error', function handleRequestError(err) {
      if (req.aborted && err.code !== 'ERR_FR_TOO_MANY_REDIRECTS') return;
      reject(enhanceError$1(err, config, null, req));
    });

    // set tcp keep alive to prevent drop connection by peer
    req.on('socket', function handleRequestSocket(socket) {
      // default interval of sending ack packet is 1 minute
      socket.setKeepAlive(true, 1000 * 60);
    });

    // Handle request timeout
    if (config.timeout) {
      // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
      var timeout = parseInt(config.timeout, 10);

      if (isNaN(timeout)) {
        reject(createError(
          'error trying to parse `config.timeout` to int',
          config,
          'ERR_PARSE_TIMEOUT',
          req
        ));

        return;
      }

      // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
      // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
      // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
      // And then these socket which be hang up will devoring CPU little by little.
      // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
      req.setTimeout(timeout, function handleRequestTimeout() {
        req.abort();
        var timeoutErrorMessage = '';
        if (config.timeoutErrorMessage) {
          timeoutErrorMessage = config.timeoutErrorMessage;
        } else {
          timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
        }
        var transitional = config.transitional || transitionalDefaults$1;
        reject(createError(
          timeoutErrorMessage,
          config,
          transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
          req
        ));
      });
    }

    if (config.cancelToken || config.signal) {
      // Handle cancellation
      // eslint-disable-next-line func-names
      onCanceled = function(cancel) {
        if (req.aborted) return;

        req.abort();
        reject(!cancel || (cancel && cancel.type) ? new Cancel$2('canceled') : cancel);
      };

      config.cancelToken && config.cancelToken.subscribe(onCanceled);
      if (config.signal) {
        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
      }
    }


    // Send the request
    if (utils$h.isStream(data)) {
      data.on('error', function handleStreamError(err) {
        reject(enhanceError$1(err, config, null, req));
      }).pipe(req);
    } else {
      req.end(data);
    }
  });
};

var utils$g = utils$p;
var normalizeHeaderName = normalizeHeaderName$1;
var enhanceError = enhanceError$3;
var transitionalDefaults = transitional;

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils$g.isUndefined(headers) && utils$g.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = xhr;
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = http_1;
  }
  return adapter;
}

function stringifySafely(rawValue, parser, encoder) {
  if (utils$g.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils$g.trim(rawValue);
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;
      }
    }
  }

  return (encoder || JSON.stringify)(rawValue);
}

var defaults$3 = {

  transitional: transitionalDefaults,

  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');

    if (utils$g.isFormData(data) ||
      utils$g.isArrayBuffer(data) ||
      utils$g.isBuffer(data) ||
      utils$g.isStream(data) ||
      utils$g.isFile(data) ||
      utils$g.isBlob(data)
    ) {
      return data;
    }
    if (utils$g.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils$g.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils$g.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
      setContentTypeIfUnset(headers, 'application/json');
      return stringifySafely(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    var transitional = this.transitional || defaults$3.transitional;
    var silentJSONParsing = transitional && transitional.silentJSONParsing;
    var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
    var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

    if (strictJSONParsing || (forcedJSONParsing && utils$g.isString(data) && data.length)) {
      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === 'SyntaxError') {
            throw enhanceError(e, this, 'E_JSON_PARSE');
          }
          throw e;
        }
      }
    }

    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,
  maxBodyLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    }
  }
};

utils$g.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults$3.headers[method] = {};
});

utils$g.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults$3.headers[method] = utils$g.merge(DEFAULT_CONTENT_TYPE);
});

var defaults_1 = defaults$3;

var utils$f = utils$p;
var defaults$2 = defaults_1;

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
var transformData$1 = function transformData(data, headers, fns) {
  var context = this || defaults$2;
  /*eslint no-param-reassign:0*/
  utils$f.forEach(fns, function transform(fn) {
    data = fn.call(context, data, headers);
  });

  return data;
};

var isCancel$1 = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

var utils$e = utils$p;
var transformData = transformData$1;
var isCancel = isCancel$1;
var defaults$1 = defaults_1;
var Cancel$1 = Cancel_1;

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }

  if (config.signal && config.signal.aborted) {
    throw new Cancel$1('canceled');
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
var dispatchRequest$1 = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData.call(
    config,
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils$e.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers
  );

  utils$e.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults$1.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData.call(
      config,
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData.call(
          config,
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

var utils$d = utils$p;

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
var mergeConfig$2 = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  function getMergedValue(target, source) {
    if (utils$d.isPlainObject(target) && utils$d.isPlainObject(source)) {
      return utils$d.merge(target, source);
    } else if (utils$d.isPlainObject(source)) {
      return utils$d.merge({}, source);
    } else if (utils$d.isArray(source)) {
      return source.slice();
    }
    return source;
  }

  // eslint-disable-next-line consistent-return
  function mergeDeepProperties(prop) {
    if (!utils$d.isUndefined(config2[prop])) {
      return getMergedValue(config1[prop], config2[prop]);
    } else if (!utils$d.isUndefined(config1[prop])) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function valueFromConfig2(prop) {
    if (!utils$d.isUndefined(config2[prop])) {
      return getMergedValue(undefined, config2[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function defaultToConfig2(prop) {
    if (!utils$d.isUndefined(config2[prop])) {
      return getMergedValue(undefined, config2[prop]);
    } else if (!utils$d.isUndefined(config1[prop])) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  // eslint-disable-next-line consistent-return
  function mergeDirectKeys(prop) {
    if (prop in config2) {
      return getMergedValue(config1[prop], config2[prop]);
    } else if (prop in config1) {
      return getMergedValue(undefined, config1[prop]);
    }
  }

  var mergeMap = {
    'url': valueFromConfig2,
    'method': valueFromConfig2,
    'data': valueFromConfig2,
    'baseURL': defaultToConfig2,
    'transformRequest': defaultToConfig2,
    'transformResponse': defaultToConfig2,
    'paramsSerializer': defaultToConfig2,
    'timeout': defaultToConfig2,
    'timeoutMessage': defaultToConfig2,
    'withCredentials': defaultToConfig2,
    'adapter': defaultToConfig2,
    'responseType': defaultToConfig2,
    'xsrfCookieName': defaultToConfig2,
    'xsrfHeaderName': defaultToConfig2,
    'onUploadProgress': defaultToConfig2,
    'onDownloadProgress': defaultToConfig2,
    'decompress': defaultToConfig2,
    'maxContentLength': defaultToConfig2,
    'maxBodyLength': defaultToConfig2,
    'transport': defaultToConfig2,
    'httpAgent': defaultToConfig2,
    'httpsAgent': defaultToConfig2,
    'cancelToken': defaultToConfig2,
    'socketPath': defaultToConfig2,
    'responseEncoding': defaultToConfig2,
    'validateStatus': mergeDirectKeys
  };

  utils$d.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
    var merge = mergeMap[prop] || mergeDeepProperties;
    var configValue = merge(prop);
    (utils$d.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  });

  return config;
};

var VERSION$1 = data.version;

var validators$1 = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
  validators$1[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

var deprecatedWarnings = {};

/**
 * Transitional option validator
 * @param {function|boolean?} validator - set to false if the transitional option has been removed
 * @param {string?} version - deprecated version / removed since version
 * @param {string?} message - some message with additional info
 * @returns {function}
 */
validators$1.transitional = function transitional(validator, version, message) {
  function formatMessage(opt, desc) {
    return '[Axios v' + VERSION$1 + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
  }

  // eslint-disable-next-line func-names
  return function(value, opt, opts) {
    if (validator === false) {
      throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
    }

    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * Assert object's properties type
 * @param {object} options
 * @param {object} schema
 * @param {boolean?} allowUnknown
 */

function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  var keys = Object.keys(options);
  var i = keys.length;
  while (i-- > 0) {
    var opt = keys[i];
    var validator = schema[opt];
    if (validator) {
      var value = options[opt];
      var result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new TypeError('option ' + opt + ' must be ' + result);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw Error('Unknown option ' + opt);
    }
  }
}

var validator$1 = {
  assertOptions: assertOptions,
  validators: validators$1
};

var utils$c = utils$p;
var buildURL = buildURL$3;
var InterceptorManager = InterceptorManager_1;
var dispatchRequest = dispatchRequest$1;
var mergeConfig$1 = mergeConfig$2;
var validator = validator$1;

var validators = validator.validators;
/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios$1(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios$1.prototype.request = function request(configOrUrl, config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof configOrUrl === 'string') {
    config = config || {};
    config.url = configOrUrl;
  } else {
    config = configOrUrl || {};
  }

  config = mergeConfig$1(this.defaults, config);

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

  var transitional = config.transitional;

  if (transitional !== undefined) {
    validator.assertOptions(transitional, {
      silentJSONParsing: validators.transitional(validators.boolean),
      forcedJSONParsing: validators.transitional(validators.boolean),
      clarifyTimeoutError: validators.transitional(validators.boolean)
    }, false);
  }

  // filter out skipped interceptors
  var requestInterceptorChain = [];
  var synchronousRequestInterceptors = true;
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
      return;
    }

    synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

    requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  var responseInterceptorChain = [];
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
  });

  var promise;

  if (!synchronousRequestInterceptors) {
    var chain = [dispatchRequest, undefined];

    Array.prototype.unshift.apply(chain, requestInterceptorChain);
    chain = chain.concat(responseInterceptorChain);

    promise = Promise.resolve(config);
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }


  var newConfig = config;
  while (requestInterceptorChain.length) {
    var onFulfilled = requestInterceptorChain.shift();
    var onRejected = requestInterceptorChain.shift();
    try {
      newConfig = onFulfilled(newConfig);
    } catch (error) {
      onRejected(error);
      break;
    }
  }

  try {
    promise = dispatchRequest(newConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  while (responseInterceptorChain.length) {
    promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
  }

  return promise;
};

Axios$1.prototype.getUri = function getUri(config) {
  config = mergeConfig$1(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils$c.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios$1.prototype[method] = function(url, config) {
    return this.request(mergeConfig$1(config || {}, {
      method: method,
      url: url,
      data: (config || {}).data
    }));
  };
});

utils$c.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios$1.prototype[method] = function(url, data, config) {
    return this.request(mergeConfig$1(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

var Axios_1 = Axios$1;

var Cancel = Cancel_1;

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;

  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;

  // eslint-disable-next-line func-names
  this.promise.then(function(cancel) {
    if (!token._listeners) return;

    var i;
    var l = token._listeners.length;

    for (i = 0; i < l; i++) {
      token._listeners[i](cancel);
    }
    token._listeners = null;
  });

  // eslint-disable-next-line func-names
  this.promise.then = function(onfulfilled) {
    var _resolve;
    // eslint-disable-next-line func-names
    var promise = new Promise(function(resolve) {
      token.subscribe(resolve);
      _resolve = resolve;
    }).then(onfulfilled);

    promise.cancel = function reject() {
      token.unsubscribe(_resolve);
    };

    return promise;
  };

  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Subscribe to the cancel signal
 */

CancelToken.prototype.subscribe = function subscribe(listener) {
  if (this.reason) {
    listener(this.reason);
    return;
  }

  if (this._listeners) {
    this._listeners.push(listener);
  } else {
    this._listeners = [listener];
  }
};

/**
 * Unsubscribe from the cancel signal
 */

CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
  if (!this._listeners) {
    return;
  }
  var index = this._listeners.indexOf(listener);
  if (index !== -1) {
    this._listeners.splice(index, 1);
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

var CancelToken_1 = CancelToken;

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
var spread = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

var utils$b = utils$p;

/**
 * Determines whether the payload is an error thrown by Axios
 *
 * @param {*} payload The value to test
 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
 */
var isAxiosError = function isAxiosError(payload) {
  return utils$b.isObject(payload) && (payload.isAxiosError === true);
};

var utils$a = utils$p;
var bind = bind$2;
var Axios = Axios_1;
var mergeConfig = mergeConfig$2;
var defaults = defaults_1;

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils$a.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils$a.extend(instance, context);

  // Factory for creating new instances
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// Create the default instance to be exported
var axios$1 = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios$1.Axios = Axios;

// Expose Cancel & CancelToken
axios$1.Cancel = Cancel_1;
axios$1.CancelToken = CancelToken_1;
axios$1.isCancel = isCancel$1;
axios$1.VERSION = data.version;

// Expose all/spread
axios$1.all = function all(promises) {
  return Promise.all(promises);
};
axios$1.spread = spread;

// Expose isAxiosError
axios$1.isAxiosError = isAxiosError;

axios$2.exports = axios$1;

// Allow use of default import syntax in TypeScript
axios$2.exports.default = axios$1;

var axios = axios$2.exports;

var sha3$1 = {exports: {}};

/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */

(function (module) {
/*jslint bitwise: true */
(function () {

  var INPUT_ERROR = 'input is invalid type';
  var FINALIZE_ERROR = 'finalize already called';
  var WINDOW = typeof window === 'object';
  var root = WINDOW ? window : {};
  if (root.JS_SHA3_NO_WINDOW) {
    WINDOW = false;
  }
  var WEB_WORKER = !WINDOW && typeof self === 'object';
  var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
  if (NODE_JS) {
    root = commonjsGlobal;
  } else if (WEB_WORKER) {
    root = self;
  }
  var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && 'object' === 'object' && module.exports;
  var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
  var HEX_CHARS = '0123456789abcdef'.split('');
  var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
  var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
  var KECCAK_PADDING = [1, 256, 65536, 16777216];
  var PADDING = [6, 1536, 393216, 100663296];
  var SHIFT = [0, 8, 16, 24];
  var RC = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649,
    0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0,
    2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
    2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648,
    2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
  var BITS = [224, 256, 384, 512];
  var SHAKE_BITS = [128, 256];
  var OUTPUT_TYPES = ['hex', 'buffer', 'arrayBuffer', 'array', 'digest'];
  var CSHAKE_BYTEPAD = {
    '128': 168,
    '256': 136
  };

  if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
    Array.isArray = function (obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    };
  }

  if (ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
    ArrayBuffer.isView = function (obj) {
      return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
    };
  }

  var createOutputMethod = function (bits, padding, outputType) {
    return function (message) {
      return new Keccak(bits, padding, bits).update(message)[outputType]();
    };
  };

  var createShakeOutputMethod = function (bits, padding, outputType) {
    return function (message, outputBits) {
      return new Keccak(bits, padding, outputBits).update(message)[outputType]();
    };
  };

  var createCshakeOutputMethod = function (bits, padding, outputType) {
    return function (message, outputBits, n, s) {
      return methods['cshake' + bits].update(message, outputBits, n, s)[outputType]();
    };
  };

  var createKmacOutputMethod = function (bits, padding, outputType) {
    return function (key, message, outputBits, s) {
      return methods['kmac' + bits].update(key, message, outputBits, s)[outputType]();
    };
  };

  var createOutputMethods = function (method, createMethod, bits, padding) {
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createMethod(bits, padding, type);
    }
    return method;
  };

  var createMethod = function (bits, padding) {
    var method = createOutputMethod(bits, padding, 'hex');
    method.create = function () {
      return new Keccak(bits, padding, bits);
    };
    method.update = function (message) {
      return method.create().update(message);
    };
    return createOutputMethods(method, createOutputMethod, bits, padding);
  };

  var createShakeMethod = function (bits, padding) {
    var method = createShakeOutputMethod(bits, padding, 'hex');
    method.create = function (outputBits) {
      return new Keccak(bits, padding, outputBits);
    };
    method.update = function (message, outputBits) {
      return method.create(outputBits).update(message);
    };
    return createOutputMethods(method, createShakeOutputMethod, bits, padding);
  };

  var createCshakeMethod = function (bits, padding) {
    var w = CSHAKE_BYTEPAD[bits];
    var method = createCshakeOutputMethod(bits, padding, 'hex');
    method.create = function (outputBits, n, s) {
      if (!n && !s) {
        return methods['shake' + bits].create(outputBits);
      } else {
        return new Keccak(bits, padding, outputBits).bytepad([n, s], w);
      }
    };
    method.update = function (message, outputBits, n, s) {
      return method.create(outputBits, n, s).update(message);
    };
    return createOutputMethods(method, createCshakeOutputMethod, bits, padding);
  };

  var createKmacMethod = function (bits, padding) {
    var w = CSHAKE_BYTEPAD[bits];
    var method = createKmacOutputMethod(bits, padding, 'hex');
    method.create = function (key, outputBits, s) {
      return new Kmac(bits, padding, outputBits).bytepad(['KMAC', s], w).bytepad([key], w);
    };
    method.update = function (key, message, outputBits, s) {
      return method.create(key, outputBits, s).update(message);
    };
    return createOutputMethods(method, createKmacOutputMethod, bits, padding);
  };

  var algorithms = [
    { name: 'keccak', padding: KECCAK_PADDING, bits: BITS, createMethod: createMethod },
    { name: 'sha3', padding: PADDING, bits: BITS, createMethod: createMethod },
    { name: 'shake', padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
    { name: 'cshake', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
    { name: 'kmac', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
  ];

  var methods = {}, methodNames = [];

  for (var i = 0; i < algorithms.length; ++i) {
    var algorithm = algorithms[i];
    var bits = algorithm.bits;
    for (var j = 0; j < bits.length; ++j) {
      var methodName = algorithm.name + '_' + bits[j];
      methodNames.push(methodName);
      methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
      if (algorithm.name !== 'sha3') {
        var newMethodName = algorithm.name + bits[j];
        methodNames.push(newMethodName);
        methods[newMethodName] = methods[methodName];
      }
    }
  }

  function Keccak(bits, padding, outputBits) {
    this.blocks = [];
    this.s = [];
    this.padding = padding;
    this.outputBits = outputBits;
    this.reset = true;
    this.finalized = false;
    this.block = 0;
    this.start = 0;
    this.blockCount = (1600 - (bits << 1)) >> 5;
    this.byteCount = this.blockCount << 2;
    this.outputBlocks = outputBits >> 5;
    this.extraBytes = (outputBits & 31) >> 3;

    for (var i = 0; i < 50; ++i) {
      this.s[i] = 0;
    }
  }

  Keccak.prototype.update = function (message) {
    if (this.finalized) {
      throw new Error(FINALIZE_ERROR);
    }
    var notString, type = typeof message;
    if (type !== 'string') {
      if (type === 'object') {
        if (message === null) {
          throw new Error(INPUT_ERROR);
        } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
          message = new Uint8Array(message);
        } else if (!Array.isArray(message)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
            throw new Error(INPUT_ERROR);
          }
        }
      } else {
        throw new Error(INPUT_ERROR);
      }
      notString = true;
    }
    var blocks = this.blocks, byteCount = this.byteCount, length = message.length,
      blockCount = this.blockCount, index = 0, s = this.s, i, code;

    while (index < length) {
      if (this.reset) {
        this.reset = false;
        blocks[0] = this.block;
        for (i = 1; i < blockCount + 1; ++i) {
          blocks[i] = 0;
        }
      }
      if (notString) {
        for (i = this.start; index < length && i < byteCount; ++index) {
          blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
        }
      } else {
        for (i = this.start; index < length && i < byteCount; ++index) {
          code = message.charCodeAt(index);
          if (code < 0x80) {
            blocks[i >> 2] |= code << SHIFT[i++ & 3];
          } else if (code < 0x800) {
            blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else {
            code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
            blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          }
        }
      }
      this.lastByteIndex = i;
      if (i >= byteCount) {
        this.start = i - byteCount;
        this.block = blocks[blockCount];
        for (i = 0; i < blockCount; ++i) {
          s[i] ^= blocks[i];
        }
        f(s);
        this.reset = true;
      } else {
        this.start = i;
      }
    }
    return this;
  };

  Keccak.prototype.encode = function (x, right) {
    var o = x & 255, n = 1;
    var bytes = [o];
    x = x >> 8;
    o = x & 255;
    while (o > 0) {
      bytes.unshift(o);
      x = x >> 8;
      o = x & 255;
      ++n;
    }
    if (right) {
      bytes.push(n);
    } else {
      bytes.unshift(n);
    }
    this.update(bytes);
    return bytes.length;
  };

  Keccak.prototype.encodeString = function (str) {
    var notString, type = typeof str;
    if (type !== 'string') {
      if (type === 'object') {
        if (str === null) {
          throw new Error(INPUT_ERROR);
        } else if (ARRAY_BUFFER && str.constructor === ArrayBuffer) {
          str = new Uint8Array(str);
        } else if (!Array.isArray(str)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
            throw new Error(INPUT_ERROR);
          }
        }
      } else {
        throw new Error(INPUT_ERROR);
      }
      notString = true;
    }
    var bytes = 0, length = str.length;
    if (notString) {
      bytes = length;
    } else {
      for (var i = 0; i < str.length; ++i) {
        var code = str.charCodeAt(i);
        if (code < 0x80) {
          bytes += 1;
        } else if (code < 0x800) {
          bytes += 2;
        } else if (code < 0xd800 || code >= 0xe000) {
          bytes += 3;
        } else {
          code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff));
          bytes += 4;
        }
      }
    }
    bytes += this.encode(bytes * 8);
    this.update(str);
    return bytes;
  };

  Keccak.prototype.bytepad = function (strs, w) {
    var bytes = this.encode(w);
    for (var i = 0; i < strs.length; ++i) {
      bytes += this.encodeString(strs[i]);
    }
    var paddingBytes = w - bytes % w;
    var zeros = [];
    zeros.length = paddingBytes;
    this.update(zeros);
    return this;
  };

  Keccak.prototype.finalize = function () {
    if (this.finalized) {
      return;
    }
    this.finalized = true;
    var blocks = this.blocks, i = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
    blocks[i >> 2] |= this.padding[i & 3];
    if (this.lastByteIndex === this.byteCount) {
      blocks[0] = blocks[blockCount];
      for (i = 1; i < blockCount + 1; ++i) {
        blocks[i] = 0;
      }
    }
    blocks[blockCount - 1] |= 0x80000000;
    for (i = 0; i < blockCount; ++i) {
      s[i] ^= blocks[i];
    }
    f(s);
  };

  Keccak.prototype.toString = Keccak.prototype.hex = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var hex = '', block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        block = s[i];
        hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F] +
          HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F] +
          HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F] +
          HEX_CHARS[(block >> 28) & 0x0F] + HEX_CHARS[(block >> 24) & 0x0F];
      }
      if (j % blockCount === 0) {
        f(s);
        i = 0;
      }
    }
    if (extraBytes) {
      block = s[i];
      hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F];
      if (extraBytes > 1) {
        hex += HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F];
      }
      if (extraBytes > 2) {
        hex += HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F];
      }
    }
    return hex;
  };

  Keccak.prototype.arrayBuffer = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var bytes = this.outputBits >> 3;
    var buffer;
    if (extraBytes) {
      buffer = new ArrayBuffer((outputBlocks + 1) << 2);
    } else {
      buffer = new ArrayBuffer(bytes);
    }
    var array = new Uint32Array(buffer);
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        array[j] = s[i];
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      array[i] = s[i];
      buffer = buffer.slice(0, bytes);
    }
    return buffer;
  };

  Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;

  Keccak.prototype.digest = Keccak.prototype.array = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var array = [], offset, block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        offset = j << 2;
        block = s[i];
        array[offset] = block & 0xFF;
        array[offset + 1] = (block >> 8) & 0xFF;
        array[offset + 2] = (block >> 16) & 0xFF;
        array[offset + 3] = (block >> 24) & 0xFF;
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      offset = j << 2;
      block = s[i];
      array[offset] = block & 0xFF;
      if (extraBytes > 1) {
        array[offset + 1] = (block >> 8) & 0xFF;
      }
      if (extraBytes > 2) {
        array[offset + 2] = (block >> 16) & 0xFF;
      }
    }
    return array;
  };

  function Kmac(bits, padding, outputBits) {
    Keccak.call(this, bits, padding, outputBits);
  }

  Kmac.prototype = new Keccak();

  Kmac.prototype.finalize = function () {
    this.encode(this.outputBits, true);
    return Keccak.prototype.finalize.call(this);
  };

  var f = function (s) {
    var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9,
      b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17,
      b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
      b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
    for (n = 0; n < 48; n += 2) {
      c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
      c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
      c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
      c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
      c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
      c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
      c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
      c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
      c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
      c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

      h = c8 ^ ((c2 << 1) | (c3 >>> 31));
      l = c9 ^ ((c3 << 1) | (c2 >>> 31));
      s[0] ^= h;
      s[1] ^= l;
      s[10] ^= h;
      s[11] ^= l;
      s[20] ^= h;
      s[21] ^= l;
      s[30] ^= h;
      s[31] ^= l;
      s[40] ^= h;
      s[41] ^= l;
      h = c0 ^ ((c4 << 1) | (c5 >>> 31));
      l = c1 ^ ((c5 << 1) | (c4 >>> 31));
      s[2] ^= h;
      s[3] ^= l;
      s[12] ^= h;
      s[13] ^= l;
      s[22] ^= h;
      s[23] ^= l;
      s[32] ^= h;
      s[33] ^= l;
      s[42] ^= h;
      s[43] ^= l;
      h = c2 ^ ((c6 << 1) | (c7 >>> 31));
      l = c3 ^ ((c7 << 1) | (c6 >>> 31));
      s[4] ^= h;
      s[5] ^= l;
      s[14] ^= h;
      s[15] ^= l;
      s[24] ^= h;
      s[25] ^= l;
      s[34] ^= h;
      s[35] ^= l;
      s[44] ^= h;
      s[45] ^= l;
      h = c4 ^ ((c8 << 1) | (c9 >>> 31));
      l = c5 ^ ((c9 << 1) | (c8 >>> 31));
      s[6] ^= h;
      s[7] ^= l;
      s[16] ^= h;
      s[17] ^= l;
      s[26] ^= h;
      s[27] ^= l;
      s[36] ^= h;
      s[37] ^= l;
      s[46] ^= h;
      s[47] ^= l;
      h = c6 ^ ((c0 << 1) | (c1 >>> 31));
      l = c7 ^ ((c1 << 1) | (c0 >>> 31));
      s[8] ^= h;
      s[9] ^= l;
      s[18] ^= h;
      s[19] ^= l;
      s[28] ^= h;
      s[29] ^= l;
      s[38] ^= h;
      s[39] ^= l;
      s[48] ^= h;
      s[49] ^= l;

      b0 = s[0];
      b1 = s[1];
      b32 = (s[11] << 4) | (s[10] >>> 28);
      b33 = (s[10] << 4) | (s[11] >>> 28);
      b14 = (s[20] << 3) | (s[21] >>> 29);
      b15 = (s[21] << 3) | (s[20] >>> 29);
      b46 = (s[31] << 9) | (s[30] >>> 23);
      b47 = (s[30] << 9) | (s[31] >>> 23);
      b28 = (s[40] << 18) | (s[41] >>> 14);
      b29 = (s[41] << 18) | (s[40] >>> 14);
      b20 = (s[2] << 1) | (s[3] >>> 31);
      b21 = (s[3] << 1) | (s[2] >>> 31);
      b2 = (s[13] << 12) | (s[12] >>> 20);
      b3 = (s[12] << 12) | (s[13] >>> 20);
      b34 = (s[22] << 10) | (s[23] >>> 22);
      b35 = (s[23] << 10) | (s[22] >>> 22);
      b16 = (s[33] << 13) | (s[32] >>> 19);
      b17 = (s[32] << 13) | (s[33] >>> 19);
      b48 = (s[42] << 2) | (s[43] >>> 30);
      b49 = (s[43] << 2) | (s[42] >>> 30);
      b40 = (s[5] << 30) | (s[4] >>> 2);
      b41 = (s[4] << 30) | (s[5] >>> 2);
      b22 = (s[14] << 6) | (s[15] >>> 26);
      b23 = (s[15] << 6) | (s[14] >>> 26);
      b4 = (s[25] << 11) | (s[24] >>> 21);
      b5 = (s[24] << 11) | (s[25] >>> 21);
      b36 = (s[34] << 15) | (s[35] >>> 17);
      b37 = (s[35] << 15) | (s[34] >>> 17);
      b18 = (s[45] << 29) | (s[44] >>> 3);
      b19 = (s[44] << 29) | (s[45] >>> 3);
      b10 = (s[6] << 28) | (s[7] >>> 4);
      b11 = (s[7] << 28) | (s[6] >>> 4);
      b42 = (s[17] << 23) | (s[16] >>> 9);
      b43 = (s[16] << 23) | (s[17] >>> 9);
      b24 = (s[26] << 25) | (s[27] >>> 7);
      b25 = (s[27] << 25) | (s[26] >>> 7);
      b6 = (s[36] << 21) | (s[37] >>> 11);
      b7 = (s[37] << 21) | (s[36] >>> 11);
      b38 = (s[47] << 24) | (s[46] >>> 8);
      b39 = (s[46] << 24) | (s[47] >>> 8);
      b30 = (s[8] << 27) | (s[9] >>> 5);
      b31 = (s[9] << 27) | (s[8] >>> 5);
      b12 = (s[18] << 20) | (s[19] >>> 12);
      b13 = (s[19] << 20) | (s[18] >>> 12);
      b44 = (s[29] << 7) | (s[28] >>> 25);
      b45 = (s[28] << 7) | (s[29] >>> 25);
      b26 = (s[38] << 8) | (s[39] >>> 24);
      b27 = (s[39] << 8) | (s[38] >>> 24);
      b8 = (s[48] << 14) | (s[49] >>> 18);
      b9 = (s[49] << 14) | (s[48] >>> 18);

      s[0] = b0 ^ (~b2 & b4);
      s[1] = b1 ^ (~b3 & b5);
      s[10] = b10 ^ (~b12 & b14);
      s[11] = b11 ^ (~b13 & b15);
      s[20] = b20 ^ (~b22 & b24);
      s[21] = b21 ^ (~b23 & b25);
      s[30] = b30 ^ (~b32 & b34);
      s[31] = b31 ^ (~b33 & b35);
      s[40] = b40 ^ (~b42 & b44);
      s[41] = b41 ^ (~b43 & b45);
      s[2] = b2 ^ (~b4 & b6);
      s[3] = b3 ^ (~b5 & b7);
      s[12] = b12 ^ (~b14 & b16);
      s[13] = b13 ^ (~b15 & b17);
      s[22] = b22 ^ (~b24 & b26);
      s[23] = b23 ^ (~b25 & b27);
      s[32] = b32 ^ (~b34 & b36);
      s[33] = b33 ^ (~b35 & b37);
      s[42] = b42 ^ (~b44 & b46);
      s[43] = b43 ^ (~b45 & b47);
      s[4] = b4 ^ (~b6 & b8);
      s[5] = b5 ^ (~b7 & b9);
      s[14] = b14 ^ (~b16 & b18);
      s[15] = b15 ^ (~b17 & b19);
      s[24] = b24 ^ (~b26 & b28);
      s[25] = b25 ^ (~b27 & b29);
      s[34] = b34 ^ (~b36 & b38);
      s[35] = b35 ^ (~b37 & b39);
      s[44] = b44 ^ (~b46 & b48);
      s[45] = b45 ^ (~b47 & b49);
      s[6] = b6 ^ (~b8 & b0);
      s[7] = b7 ^ (~b9 & b1);
      s[16] = b16 ^ (~b18 & b10);
      s[17] = b17 ^ (~b19 & b11);
      s[26] = b26 ^ (~b28 & b20);
      s[27] = b27 ^ (~b29 & b21);
      s[36] = b36 ^ (~b38 & b30);
      s[37] = b37 ^ (~b39 & b31);
      s[46] = b46 ^ (~b48 & b40);
      s[47] = b47 ^ (~b49 & b41);
      s[8] = b8 ^ (~b0 & b2);
      s[9] = b9 ^ (~b1 & b3);
      s[18] = b18 ^ (~b10 & b12);
      s[19] = b19 ^ (~b11 & b13);
      s[28] = b28 ^ (~b20 & b22);
      s[29] = b29 ^ (~b21 & b23);
      s[38] = b38 ^ (~b30 & b32);
      s[39] = b39 ^ (~b31 & b33);
      s[48] = b48 ^ (~b40 & b42);
      s[49] = b49 ^ (~b41 & b43);

      s[0] ^= RC[n];
      s[1] ^= RC[n + 1];
    }
  };

  if (COMMON_JS) {
    module.exports = methods;
  } else {
    for (i = 0; i < methodNames.length; ++i) {
      root[methodNames[i]] = methods[methodNames[i]];
    }
  }
})();
}(sha3$1));

var sha3 = sha3$1.exports;

function keccak256(data) {
    return '0x' + sha3.keccak_256(arrayify(data));
}

const version$j = "rlp/5.7.0";

const logger$n = new Logger$2(version$j);
function arrayifyInteger(value) {
    const result = [];
    while (value) {
        result.unshift(value & 0xff);
        value >>= 8;
    }
    return result;
}
function unarrayifyInteger(data, offset, length) {
    let result = 0;
    for (let i = 0; i < length; i++) {
        result = (result * 256) + data[offset + i];
    }
    return result;
}
function _encode(object) {
    if (Array.isArray(object)) {
        let payload = [];
        object.forEach(function (child) {
            payload = payload.concat(_encode(child));
        });
        if (payload.length <= 55) {
            payload.unshift(0xc0 + payload.length);
            return payload;
        }
        const length = arrayifyInteger(payload.length);
        length.unshift(0xf7 + length.length);
        return length.concat(payload);
    }
    if (!isBytesLike(object)) {
        logger$n.throwArgumentError("RLP object must be BytesLike", "object", object);
    }
    const data = Array.prototype.slice.call(arrayify(object));
    if (data.length === 1 && data[0] <= 0x7f) {
        return data;
    }
    else if (data.length <= 55) {
        data.unshift(0x80 + data.length);
        return data;
    }
    const length = arrayifyInteger(data.length);
    length.unshift(0xb7 + length.length);
    return length.concat(data);
}
function encode$2(object) {
    return hexlify(_encode(object));
}
function _decodeChildren(data, offset, childOffset, length) {
    const result = [];
    while (childOffset < offset + 1 + length) {
        const decoded = _decode(data, childOffset);
        result.push(decoded.result);
        childOffset += decoded.consumed;
        if (childOffset > offset + 1 + length) {
            logger$n.throwError("child data too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
    }
    return { consumed: (1 + length), result: result };
}
// returns { consumed: number, result: Object }
function _decode(data, offset) {
    if (data.length === 0) {
        logger$n.throwError("data too short", Logger$2.errors.BUFFER_OVERRUN, {});
    }
    // Array with extra length prefix
    if (data[offset] >= 0xf8) {
        const lengthLength = data[offset] - 0xf7;
        if (offset + 1 + lengthLength > data.length) {
            logger$n.throwError("data short segment too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        const length = unarrayifyInteger(data, offset + 1, lengthLength);
        if (offset + 1 + lengthLength + length > data.length) {
            logger$n.throwError("data long segment too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        return _decodeChildren(data, offset, offset + 1 + lengthLength, lengthLength + length);
    }
    else if (data[offset] >= 0xc0) {
        const length = data[offset] - 0xc0;
        if (offset + 1 + length > data.length) {
            logger$n.throwError("data array too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        return _decodeChildren(data, offset, offset + 1, length);
    }
    else if (data[offset] >= 0xb8) {
        const lengthLength = data[offset] - 0xb7;
        if (offset + 1 + lengthLength > data.length) {
            logger$n.throwError("data array too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        const length = unarrayifyInteger(data, offset + 1, lengthLength);
        if (offset + 1 + lengthLength + length > data.length) {
            logger$n.throwError("data array too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        const result = hexlify(data.slice(offset + 1 + lengthLength, offset + 1 + lengthLength + length));
        return { consumed: (1 + lengthLength + length), result: result };
    }
    else if (data[offset] >= 0x80) {
        const length = data[offset] - 0x80;
        if (offset + 1 + length > data.length) {
            logger$n.throwError("data too short", Logger$2.errors.BUFFER_OVERRUN, {});
        }
        const result = hexlify(data.slice(offset + 1, offset + 1 + length));
        return { consumed: (1 + length), result: result };
    }
    return { consumed: 1, result: hexlify(data[offset]) };
}
function decode$2(data) {
    const bytes = arrayify(data);
    const decoded = _decode(bytes, 0);
    if (decoded.consumed !== bytes.length) {
        logger$n.throwArgumentError("invalid rlp data", "data", data);
    }
    return decoded.result;
}

const version$i = "address/5.7.0";

const logger$m = new Logger$2(version$i);
function getChecksumAddress(address) {
    if (!isHexString(address, 20)) {
        logger$m.throwArgumentError("invalid address", "address", address);
    }
    address = address.toLowerCase();
    const chars = address.substring(2).split("");
    const expanded = new Uint8Array(40);
    for (let i = 0; i < 40; i++) {
        expanded[i] = chars[i].charCodeAt(0);
    }
    const hashed = arrayify(keccak256(expanded));
    for (let i = 0; i < 40; i += 2) {
        if ((hashed[i >> 1] >> 4) >= 8) {
            chars[i] = chars[i].toUpperCase();
        }
        if ((hashed[i >> 1] & 0x0f) >= 8) {
            chars[i + 1] = chars[i + 1].toUpperCase();
        }
    }
    return "0x" + chars.join("");
}
// Shims for environments that are missing some required constants and functions
const MAX_SAFE_INTEGER = 0x1fffffffffffff;
function log10(x) {
    if (Math.log10) {
        return Math.log10(x);
    }
    return Math.log(x) / Math.LN10;
}
// See: https://en.wikipedia.org/wiki/International_Bank_Account_Number
// Create lookup table
const ibanLookup = {};
for (let i = 0; i < 10; i++) {
    ibanLookup[String(i)] = String(i);
}
for (let i = 0; i < 26; i++) {
    ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
// How many decimal digits can we process? (for 64-bit float, this is 15)
const safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
    address = address.toUpperCase();
    address = address.substring(4) + address.substring(0, 2) + "00";
    let expanded = address.split("").map((c) => { return ibanLookup[c]; }).join("");
    // Javascript can handle integers safely up to 15 (decimal) digits
    while (expanded.length >= safeDigits) {
        let block = expanded.substring(0, safeDigits);
        expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
    }
    let checksum = String(98 - (parseInt(expanded, 10) % 97));
    while (checksum.length < 2) {
        checksum = "0" + checksum;
    }
    return checksum;
}
function getAddress(address) {
    let result = null;
    if (typeof (address) !== "string") {
        logger$m.throwArgumentError("invalid address", "address", address);
    }
    if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
        // Missing the 0x prefix
        if (address.substring(0, 2) !== "0x") {
            address = "0x" + address;
        }
        result = getChecksumAddress(address);
        // It is a checksummed address with a bad checksum
        if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
            logger$m.throwArgumentError("bad address checksum", "address", address);
        }
        // Maybe ICAP? (we only support direct mode)
    }
    else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
        // It is an ICAP address with a bad checksum
        if (address.substring(2, 4) !== ibanChecksum(address)) {
            logger$m.throwArgumentError("bad icap checksum", "address", address);
        }
        result = _base36To16(address.substring(4));
        while (result.length < 40) {
            result = "0" + result;
        }
        result = getChecksumAddress("0x" + result);
    }
    else {
        logger$m.throwArgumentError("invalid address", "address", address);
    }
    return result;
}
// http://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
function getContractAddress(transaction) {
    let from = null;
    try {
        from = getAddress(transaction.from);
    }
    catch (error) {
        logger$m.throwArgumentError("missing from address", "transaction", transaction);
    }
    const nonce = stripZeros(arrayify(BigNumber.from(transaction.nonce).toHexString()));
    return getAddress(hexDataSlice(keccak256(encode$2([from, nonce])), 12));
}

const version$h = "properties/5.7.0";

var __awaiter$b = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$l = new Logger$2(version$h);
function defineReadOnly$1(object, name, value) {
    Object.defineProperty(object, name, {
        enumerable: true,
        value: value,
        writable: false,
    });
}
// Crawl up the constructor chain to find a static method
function getStatic(ctor, key) {
    for (let i = 0; i < 32; i++) {
        if (ctor[key]) {
            return ctor[key];
        }
        if (!ctor.prototype || typeof (ctor.prototype) !== "object") {
            break;
        }
        ctor = Object.getPrototypeOf(ctor.prototype).constructor;
    }
    return null;
}
function resolveProperties(object) {
    return __awaiter$b(this, void 0, void 0, function* () {
        const promises = Object.keys(object).map((key) => {
            const value = object[key];
            return Promise.resolve(value).then((v) => ({ key: key, value: v }));
        });
        const results = yield Promise.all(promises);
        return results.reduce((accum, result) => {
            accum[(result.key)] = result.value;
            return accum;
        }, {});
    });
}
function checkProperties(object, properties) {
    if (!object || typeof (object) !== "object") {
        logger$l.throwArgumentError("invalid object", "object", object);
    }
    Object.keys(object).forEach((key) => {
        if (!properties[key]) {
            logger$l.throwArgumentError("invalid object key - " + key, "transaction:" + key, object);
        }
    });
}
function shallowCopy(object) {
    const result = {};
    for (const key in object) {
        result[key] = object[key];
    }
    return result;
}
const opaque$1 = { bigint: true, boolean: true, "function": true, number: true, string: true };
function _isFrozen$1(object) {
    // Opaque objects are not mutable, so safe to copy by assignment
    if (object === undefined || object === null || opaque$1[typeof (object)]) {
        return true;
    }
    if (Array.isArray(object) || typeof (object) === "object") {
        if (!Object.isFrozen(object)) {
            return false;
        }
        const keys = Object.keys(object);
        for (let i = 0; i < keys.length; i++) {
            let value = null;
            try {
                value = object[keys[i]];
            }
            catch (error) {
                // If accessing a value triggers an error, it is a getter
                // designed to do so (e.g. Result) and is therefore "frozen"
                continue;
            }
            if (!_isFrozen$1(value)) {
                return false;
            }
        }
        return true;
    }
    return logger$l.throwArgumentError(`Cannot deepCopy ${typeof (object)}`, "object", object);
}
// Returns a new copy of object, such that no properties may be replaced.
// New properties may be added only to objects.
function _deepCopy$1(object) {
    if (_isFrozen$1(object)) {
        return object;
    }
    // Arrays are mutable, so we need to create a copy
    if (Array.isArray(object)) {
        return Object.freeze(object.map((item) => deepCopy$1(item)));
    }
    if (typeof (object) === "object") {
        const result = {};
        for (const key in object) {
            const value = object[key];
            if (value === undefined) {
                continue;
            }
            defineReadOnly$1(result, key, deepCopy$1(value));
        }
        return result;
    }
    return logger$l.throwArgumentError(`Cannot deepCopy ${typeof (object)}`, "object", object);
}
function deepCopy$1(object) {
    return _deepCopy$1(object);
}
class Description {
    constructor(info) {
        for (const key in info) {
            this[key] = deepCopy$1(info[key]);
        }
    }
}

const version$g = "abstract-provider/5.7.0";

var __awaiter$a = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$k = new Logger$2(version$g);
//export type CallTransactionable = {
//    call(transaction: TransactionRequest): Promise<TransactionResponse>;
//};
class ForkEvent extends Description {
    static isForkEvent(value) {
        return !!(value && value._isForkEvent);
    }
}
///////////////////////////////
// Exported Abstracts
class Provider {
    constructor() {
        logger$k.checkAbstract(new.target, Provider);
        defineReadOnly$1(this, "_isProvider", true);
    }
    getFeeData() {
        return __awaiter$a(this, void 0, void 0, function* () {
            const { block, gasPrice } = yield resolveProperties({
                block: this.getBlock("latest"),
                gasPrice: this.getGasPrice().catch((error) => {
                    // @TODO: Why is this now failing on Calaveras?
                    //console.log(error);
                    return null;
                })
            });
            let lastBaseFeePerGas = null, maxFeePerGas = null, maxPriorityFeePerGas = null;
            if (block && block.baseFeePerGas) {
                // We may want to compute this more accurately in the future,
                // using the formula "check if the base fee is correct".
                // See: https://eips.ethereum.org/EIPS/eip-1559
                lastBaseFeePerGas = block.baseFeePerGas;
                maxPriorityFeePerGas = BigNumber.from("1500000000");
                maxFeePerGas = block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas);
            }
            return { lastBaseFeePerGas, maxFeePerGas, maxPriorityFeePerGas, gasPrice };
        });
    }
    // Alias for "on"
    addListener(eventName, listener) {
        return this.on(eventName, listener);
    }
    // Alias for "off"
    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }
    static isProvider(value) {
        return !!(value && value._isProvider);
    }
}

const version$f = "abstract-signer/5.7.0";

var __awaiter$9 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$j = new Logger$2(version$f);
const allowedTransactionKeys$2 = [
    "accessList", "ccipReadEnabled", "chainId", "customData", "data", "from", "gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "nonce", "to", "type", "value"
];
const forwardErrors = [
    Logger$2.errors.INSUFFICIENT_FUNDS,
    Logger$2.errors.NONCE_EXPIRED,
    Logger$2.errors.REPLACEMENT_UNDERPRICED,
];
class Signer {
    ///////////////////
    // Sub-classes MUST call super
    constructor() {
        logger$j.checkAbstract(new.target, Signer);
        defineReadOnly$1(this, "_isSigner", true);
    }
    ///////////////////
    // Sub-classes MAY override these
    getBalance(blockTag) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("getBalance");
            return yield this.provider.getBalance(this.getAddress(), blockTag);
        });
    }
    getTransactionCount(blockTag) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("getTransactionCount");
            return yield this.provider.getTransactionCount(this.getAddress(), blockTag);
        });
    }
    // Populates "from" if unspecified, and estimates the gas for the transaction
    estimateGas(transaction) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("estimateGas");
            const tx = yield resolveProperties(this.checkTransaction(transaction));
            return yield this.provider.estimateGas(tx);
        });
    }
    // Populates "from" if unspecified, and calls with the transaction
    call(transaction, blockTag) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("call");
            const tx = yield resolveProperties(this.checkTransaction(transaction));
            return yield this.provider.call(tx, blockTag);
        });
    }
    // Populates all fields in a transaction, signs it and sends it to the network
    sendTransaction(transaction) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("sendTransaction");
            const tx = yield this.populateTransaction(transaction);
            const signedTx = yield this.signTransaction(tx);
            return yield this.provider.sendTransaction(signedTx);
        });
    }
    getChainId() {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("getChainId");
            const network = yield this.provider.getNetwork();
            return network.chainId;
        });
    }
    getGasPrice() {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("getGasPrice");
            return yield this.provider.getGasPrice();
        });
    }
    getFeeData() {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("getFeeData");
            return yield this.provider.getFeeData();
        });
    }
    resolveName(name) {
        return __awaiter$9(this, void 0, void 0, function* () {
            this._checkProvider("resolveName");
            return yield this.provider.resolveName(name);
        });
    }
    // Checks a transaction does not contain invalid keys and if
    // no "from" is provided, populates it.
    // - does NOT require a provider
    // - adds "from" is not present
    // - returns a COPY (safe to mutate the result)
    // By default called from: (overriding these prevents it)
    //   - call
    //   - estimateGas
    //   - populateTransaction (and therefor sendTransaction)
    checkTransaction(transaction) {
        for (const key in transaction) {
            if (allowedTransactionKeys$2.indexOf(key) === -1) {
                logger$j.throwArgumentError("invalid transaction key: " + key, "transaction", transaction);
            }
        }
        const tx = shallowCopy(transaction);
        if (tx.from == null) {
            tx.from = this.getAddress();
        }
        else {
            // Make sure any provided address matches this signer
            tx.from = Promise.all([
                Promise.resolve(tx.from),
                this.getAddress()
            ]).then((result) => {
                if (result[0].toLowerCase() !== result[1].toLowerCase()) {
                    logger$j.throwArgumentError("from address mismatch", "transaction", transaction);
                }
                return result[0];
            });
        }
        return tx;
    }
    // Populates ALL keys for a transaction and checks that "from" matches
    // this Signer. Should be used by sendTransaction but NOT by signTransaction.
    // By default called from: (overriding these prevents it)
    //   - sendTransaction
    //
    // Notes:
    //  - We allow gasPrice for EIP-1559 as long as it matches maxFeePerGas
    populateTransaction(transaction) {
        return __awaiter$9(this, void 0, void 0, function* () {
            const tx = yield resolveProperties(this.checkTransaction(transaction));
            if (tx.to != null) {
                tx.to = Promise.resolve(tx.to).then((to) => __awaiter$9(this, void 0, void 0, function* () {
                    if (to == null) {
                        return null;
                    }
                    const address = yield this.resolveName(to);
                    if (address == null) {
                        logger$j.throwArgumentError("provided ENS name resolves to null", "tx.to", to);
                    }
                    return address;
                }));
                // Prevent this error from causing an UnhandledPromiseException
                tx.to.catch((error) => { });
            }
            // Do not allow mixing pre-eip-1559 and eip-1559 properties
            const hasEip1559 = (tx.maxFeePerGas != null || tx.maxPriorityFeePerGas != null);
            if (tx.gasPrice != null && (tx.type === 2 || hasEip1559)) {
                logger$j.throwArgumentError("eip-1559 transaction do not support gasPrice", "transaction", transaction);
            }
            else if ((tx.type === 0 || tx.type === 1) && hasEip1559) {
                logger$j.throwArgumentError("pre-eip-1559 transaction do not support maxFeePerGas/maxPriorityFeePerGas", "transaction", transaction);
            }
            if ((tx.type === 2 || tx.type == null) && (tx.maxFeePerGas != null && tx.maxPriorityFeePerGas != null)) {
                // Fully-formed EIP-1559 transaction (skip getFeeData)
                tx.type = 2;
            }
            else if (tx.type === 0 || tx.type === 1) {
                // Explicit Legacy or EIP-2930 transaction
                // Populate missing gasPrice
                if (tx.gasPrice == null) {
                    tx.gasPrice = this.getGasPrice();
                }
            }
            else {
                // We need to get fee data to determine things
                const feeData = yield this.getFeeData();
                if (tx.type == null) {
                    // We need to auto-detect the intended type of this transaction...
                    if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
                        // The network supports EIP-1559!
                        // Upgrade transaction from null to eip-1559
                        tx.type = 2;
                        if (tx.gasPrice != null) {
                            // Using legacy gasPrice property on an eip-1559 network,
                            // so use gasPrice as both fee properties
                            const gasPrice = tx.gasPrice;
                            delete tx.gasPrice;
                            tx.maxFeePerGas = gasPrice;
                            tx.maxPriorityFeePerGas = gasPrice;
                        }
                        else {
                            // Populate missing fee data
                            if (tx.maxFeePerGas == null) {
                                tx.maxFeePerGas = feeData.maxFeePerGas;
                            }
                            if (tx.maxPriorityFeePerGas == null) {
                                tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                            }
                        }
                    }
                    else if (feeData.gasPrice != null) {
                        // Network doesn't support EIP-1559...
                        // ...but they are trying to use EIP-1559 properties
                        if (hasEip1559) {
                            logger$j.throwError("network does not support EIP-1559", Logger$2.errors.UNSUPPORTED_OPERATION, {
                                operation: "populateTransaction"
                            });
                        }
                        // Populate missing fee data
                        if (tx.gasPrice == null) {
                            tx.gasPrice = feeData.gasPrice;
                        }
                        // Explicitly set untyped transaction to legacy
                        tx.type = 0;
                    }
                    else {
                        // getFeeData has failed us.
                        logger$j.throwError("failed to get consistent fee data", Logger$2.errors.UNSUPPORTED_OPERATION, {
                            operation: "signer.getFeeData"
                        });
                    }
                }
                else if (tx.type === 2) {
                    // Explicitly using EIP-1559
                    // Populate missing fee data
                    if (tx.maxFeePerGas == null) {
                        tx.maxFeePerGas = feeData.maxFeePerGas;
                    }
                    if (tx.maxPriorityFeePerGas == null) {
                        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
                    }
                }
            }
            if (tx.nonce == null) {
                tx.nonce = this.getTransactionCount("pending");
            }
            if (tx.gasLimit == null) {
                tx.gasLimit = this.estimateGas(tx).catch((error) => {
                    if (forwardErrors.indexOf(error.code) >= 0) {
                        throw error;
                    }
                    return logger$j.throwError("cannot estimate gas; transaction may fail or may require manual gas limit", Logger$2.errors.UNPREDICTABLE_GAS_LIMIT, {
                        error: error,
                        tx: tx
                    });
                });
            }
            if (tx.chainId == null) {
                tx.chainId = this.getChainId();
            }
            else {
                tx.chainId = Promise.all([
                    Promise.resolve(tx.chainId),
                    this.getChainId()
                ]).then((results) => {
                    if (results[1] !== 0 && results[0] !== results[1]) {
                        logger$j.throwArgumentError("chainId address mismatch", "transaction", transaction);
                    }
                    return results[0];
                });
            }
            return yield resolveProperties(tx);
        });
    }
    ///////////////////
    // Sub-classes SHOULD leave these alone
    _checkProvider(operation) {
        if (!this.provider) {
            logger$j.throwError("missing provider", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: (operation || "_checkProvider")
            });
        }
    }
    static isSigner(value) {
        return !!(value && value._isSigner);
    }
}

const AddressZero = "0x0000000000000000000000000000000000000000";

const Zero$1 = ( /*#__PURE__*/BigNumber.from(0));

const HashZero = "0x0000000000000000000000000000000000000000000000000000000000000000";

const version$e = "strings/5.7.0";

const logger$i = new Logger$2(version$e);
///////////////////////////////
var UnicodeNormalizationForm;
(function (UnicodeNormalizationForm) {
    UnicodeNormalizationForm["current"] = "";
    UnicodeNormalizationForm["NFC"] = "NFC";
    UnicodeNormalizationForm["NFD"] = "NFD";
    UnicodeNormalizationForm["NFKC"] = "NFKC";
    UnicodeNormalizationForm["NFKD"] = "NFKD";
})(UnicodeNormalizationForm || (UnicodeNormalizationForm = {}));
var Utf8ErrorReason;
(function (Utf8ErrorReason) {
    // A continuation byte was present where there was nothing to continue
    // - offset = the index the codepoint began in
    Utf8ErrorReason["UNEXPECTED_CONTINUE"] = "unexpected continuation byte";
    // An invalid (non-continuation) byte to start a UTF-8 codepoint was found
    // - offset = the index the codepoint began in
    Utf8ErrorReason["BAD_PREFIX"] = "bad codepoint prefix";
    // The string is too short to process the expected codepoint
    // - offset = the index the codepoint began in
    Utf8ErrorReason["OVERRUN"] = "string overrun";
    // A missing continuation byte was expected but not found
    // - offset = the index the continuation byte was expected at
    Utf8ErrorReason["MISSING_CONTINUE"] = "missing continuation byte";
    // The computed code point is outside the range for UTF-8
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; outside the UTF-8 range
    Utf8ErrorReason["OUT_OF_RANGE"] = "out of UTF-8 range";
    // UTF-8 strings may not contain UTF-16 surrogate pairs
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; inside the UTF-16 surrogate range
    Utf8ErrorReason["UTF16_SURROGATE"] = "UTF-16 surrogate";
    // The string is an overlong representation
    // - offset       = start of this codepoint
    // - badCodepoint = the computed codepoint; already bounds checked
    Utf8ErrorReason["OVERLONG"] = "overlong representation";
})(Utf8ErrorReason || (Utf8ErrorReason = {}));
function errorFunc(reason, offset, bytes, output, badCodepoint) {
    return logger$i.throwArgumentError(`invalid codepoint at offset ${offset}; ${reason}`, "bytes", bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
    // If there is an invalid prefix (including stray continuation), skip any additional continuation bytes
    if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
        let i = 0;
        for (let o = offset + 1; o < bytes.length; o++) {
            if (bytes[o] >> 6 !== 0x02) {
                break;
            }
            i++;
        }
        return i;
    }
    // This byte runs us past the end of the string, so just jump to the end
    // (but the first byte was read already read and therefore skipped)
    if (reason === Utf8ErrorReason.OVERRUN) {
        return bytes.length - offset - 1;
    }
    // Nothing to skip
    return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
    // Overlong representations are otherwise "valid" code points; just non-deistingtished
    if (reason === Utf8ErrorReason.OVERLONG) {
        output.push(badCodepoint);
        return 0;
    }
    // Put the replacement character into the output
    output.push(0xfffd);
    // Otherwise, process as if ignoring errors
    return ignoreFunc(reason, offset, bytes);
}
// Common error handing strategies
const Utf8ErrorFuncs = Object.freeze({
    error: errorFunc,
    ignore: ignoreFunc,
    replace: replaceFunc
});
// http://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript#13691499
function getUtf8CodePoints(bytes, onError) {
    if (onError == null) {
        onError = Utf8ErrorFuncs.error;
    }
    bytes = arrayify(bytes);
    const result = [];
    let i = 0;
    // Invalid bytes are ignored
    while (i < bytes.length) {
        const c = bytes[i++];
        // 0xxx xxxx
        if (c >> 7 === 0) {
            result.push(c);
            continue;
        }
        // Multibyte; how many bytes left for this character?
        let extraLength = null;
        let overlongMask = null;
        // 110x xxxx 10xx xxxx
        if ((c & 0xe0) === 0xc0) {
            extraLength = 1;
            overlongMask = 0x7f;
            // 1110 xxxx 10xx xxxx 10xx xxxx
        }
        else if ((c & 0xf0) === 0xe0) {
            extraLength = 2;
            overlongMask = 0x7ff;
            // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
        }
        else if ((c & 0xf8) === 0xf0) {
            extraLength = 3;
            overlongMask = 0xffff;
        }
        else {
            if ((c & 0xc0) === 0x80) {
                i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result);
            }
            else {
                i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result);
            }
            continue;
        }
        // Do we have enough bytes in our data?
        if (i - 1 + extraLength >= bytes.length) {
            i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result);
            continue;
        }
        // Remove the length prefix from the char
        let res = c & ((1 << (8 - extraLength - 1)) - 1);
        for (let j = 0; j < extraLength; j++) {
            let nextChar = bytes[i];
            // Invalid continuation byte
            if ((nextChar & 0xc0) != 0x80) {
                i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result);
                res = null;
                break;
            }
            res = (res << 6) | (nextChar & 0x3f);
            i++;
        }
        // See above loop for invalid continuation byte
        if (res === null) {
            continue;
        }
        // Maximum code point
        if (res > 0x10ffff) {
            i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        // Reserved for UTF-16 surrogate halves
        if (res >= 0xd800 && res <= 0xdfff) {
            i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        // Check for overlong sequences (more bytes than needed)
        if (res <= overlongMask) {
            i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res);
            continue;
        }
        result.push(res);
    }
    return result;
}
// http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
function toUtf8Bytes(str, form = UnicodeNormalizationForm.current) {
    if (form != UnicodeNormalizationForm.current) {
        logger$i.checkNormalize();
        str = str.normalize(form);
    }
    let result = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) {
            result.push(c);
        }
        else if (c < 0x800) {
            result.push((c >> 6) | 0xc0);
            result.push((c & 0x3f) | 0x80);
        }
        else if ((c & 0xfc00) == 0xd800) {
            i++;
            const c2 = str.charCodeAt(i);
            if (i >= str.length || (c2 & 0xfc00) !== 0xdc00) {
                throw new Error("invalid utf-8 string");
            }
            // Surrogate Pair
            const pair = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
            result.push((pair >> 18) | 0xf0);
            result.push(((pair >> 12) & 0x3f) | 0x80);
            result.push(((pair >> 6) & 0x3f) | 0x80);
            result.push((pair & 0x3f) | 0x80);
        }
        else {
            result.push((c >> 12) | 0xe0);
            result.push(((c >> 6) & 0x3f) | 0x80);
            result.push((c & 0x3f) | 0x80);
        }
    }
    return arrayify(result);
}
function _toUtf8String(codePoints) {
    return codePoints.map((codePoint) => {
        if (codePoint <= 0xffff) {
            return String.fromCharCode(codePoint);
        }
        codePoint -= 0x10000;
        return String.fromCharCode((((codePoint >> 10) & 0x3ff) + 0xd800), ((codePoint & 0x3ff) + 0xdc00));
    }).join("");
}
function toUtf8String(bytes, onError) {
    return _toUtf8String(getUtf8CodePoints(bytes, onError));
}
function toUtf8CodePoints(str, form = UnicodeNormalizationForm.current) {
    return getUtf8CodePoints(toUtf8Bytes(str, form));
}

function id(text) {
    return keccak256(toUtf8Bytes(text));
}

const version$d = "hash/5.7.0";

function decode$1(textData) {
    textData = atob(textData);
    const data = [];
    for (let i = 0; i < textData.length; i++) {
        data.push(textData.charCodeAt(i));
    }
    return arrayify(data);
}
function encode$1(data) {
    data = arrayify(data);
    let textData = "";
    for (let i = 0; i < data.length; i++) {
        textData += String.fromCharCode(data[i]);
    }
    return btoa(textData);
}

/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */
// https://github.com/behnammodi/polyfill/blob/master/array.polyfill.js
function flat(array, depth) {
    if (depth == null) {
        depth = 1;
    }
    const result = [];
    const forEach = result.forEach;
    const flatDeep = function (arr, depth) {
        forEach.call(arr, function (val) {
            if (depth > 0 && Array.isArray(val)) {
                flatDeep(val, depth - 1);
            }
            else {
                result.push(val);
            }
        });
    };
    flatDeep(array, depth);
    return result;
}
function fromEntries(array) {
    const result = {};
    for (let i = 0; i < array.length; i++) {
        const value = array[i];
        result[value[0]] = value[1];
    }
    return result;
}
function decode_arithmetic(bytes) {
    let pos = 0;
    function u16() { return (bytes[pos++] << 8) | bytes[pos++]; }
    // decode the frequency table
    let symbol_count = u16();
    let total = 1;
    let acc = [0, 1]; // first symbol has frequency 1
    for (let i = 1; i < symbol_count; i++) {
        acc.push(total += u16());
    }
    // skip the sized-payload that the last 3 symbols index into
    let skip = u16();
    let pos_payload = pos;
    pos += skip;
    let read_width = 0;
    let read_buffer = 0;
    function read_bit() {
        if (read_width == 0) {
            // this will read beyond end of buffer
            // but (undefined|0) => zero pad
            read_buffer = (read_buffer << 8) | bytes[pos++];
            read_width = 8;
        }
        return (read_buffer >> --read_width) & 1;
    }
    const N = 31;
    const FULL = Math.pow(2, N);
    const HALF = FULL >>> 1;
    const QRTR = HALF >> 1;
    const MASK = FULL - 1;
    // fill register
    let register = 0;
    for (let i = 0; i < N; i++)
        register = (register << 1) | read_bit();
    let symbols = [];
    let low = 0;
    let range = FULL; // treat like a float
    while (true) {
        let value = Math.floor((((register - low + 1) * total) - 1) / range);
        let start = 0;
        let end = symbol_count;
        while (end - start > 1) { // binary search
            let mid = (start + end) >>> 1;
            if (value < acc[mid]) {
                end = mid;
            }
            else {
                start = mid;
            }
        }
        if (start == 0)
            break; // first symbol is end mark
        symbols.push(start);
        let a = low + Math.floor(range * acc[start] / total);
        let b = low + Math.floor(range * acc[start + 1] / total) - 1;
        while (((a ^ b) & HALF) == 0) {
            register = (register << 1) & MASK | read_bit();
            a = (a << 1) & MASK;
            b = (b << 1) & MASK | 1;
        }
        while (a & ~b & QRTR) {
            register = (register & HALF) | ((register << 1) & (MASK >>> 1)) | read_bit();
            a = (a << 1) ^ HALF;
            b = ((b ^ HALF) << 1) | HALF | 1;
        }
        low = a;
        range = 1 + b - a;
    }
    let offset = symbol_count - 4;
    return symbols.map(x => {
        switch (x - offset) {
            case 3: return offset + 0x10100 + ((bytes[pos_payload++] << 16) | (bytes[pos_payload++] << 8) | bytes[pos_payload++]);
            case 2: return offset + 0x100 + ((bytes[pos_payload++] << 8) | bytes[pos_payload++]);
            case 1: return offset + bytes[pos_payload++];
            default: return x - 1;
        }
    });
}
// returns an iterator which returns the next symbol
function read_payload(v) {
    let pos = 0;
    return () => v[pos++];
}
function read_compressed_payload(bytes) {
    return read_payload(decode_arithmetic(bytes));
}
// eg. [0,1,2,3...] => [0,-1,1,-2,...]
function signed(i) {
    return (i & 1) ? (~i >> 1) : (i >> 1);
}
function read_counts(n, next) {
    let v = Array(n);
    for (let i = 0; i < n; i++)
        v[i] = 1 + next();
    return v;
}
function read_ascending(n, next) {
    let v = Array(n);
    for (let i = 0, x = -1; i < n; i++)
        v[i] = x += 1 + next();
    return v;
}
function read_deltas(n, next) {
    let v = Array(n);
    for (let i = 0, x = 0; i < n; i++)
        v[i] = x += signed(next());
    return v;
}
function read_member_array(next, lookup) {
    let v = read_ascending(next(), next);
    let n = next();
    let vX = read_ascending(n, next);
    let vN = read_counts(n, next);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < vN[i]; j++) {
            v.push(vX[i] + j);
        }
    }
    return lookup ? v.map(x => lookup[x]) : v;
}
// returns array of 
// [x, ys] => single replacement rule
// [x, ys, n, dx, dx] => linear map
function read_mapped_map(next) {
    let ret = [];
    while (true) {
        let w = next();
        if (w == 0)
            break;
        ret.push(read_linear_table(w, next));
    }
    while (true) {
        let w = next() - 1;
        if (w < 0)
            break;
        ret.push(read_replacement_table(w, next));
    }
    return fromEntries(flat(ret));
}
function read_zero_terminated_array(next) {
    let v = [];
    while (true) {
        let i = next();
        if (i == 0)
            break;
        v.push(i);
    }
    return v;
}
function read_transposed(n, w, next) {
    let m = Array(n).fill(undefined).map(() => []);
    for (let i = 0; i < w; i++) {
        read_deltas(n, next).forEach((x, j) => m[j].push(x));
    }
    return m;
}
function read_linear_table(w, next) {
    let dx = 1 + next();
    let dy = next();
    let vN = read_zero_terminated_array(next);
    let m = read_transposed(vN.length, 1 + w, next);
    return flat(m.map((v, i) => {
        const x = v[0], ys = v.slice(1);
        //let [x, ...ys] = v;
        //return Array(vN[i]).fill().map((_, j) => {
        return Array(vN[i]).fill(undefined).map((_, j) => {
            let j_dy = j * dy;
            return [x + j * dx, ys.map(y => y + j_dy)];
        });
    }));
}
function read_replacement_table(w, next) {
    let n = 1 + next();
    let m = read_transposed(n, 1 + w, next);
    return m.map(v => [v[0], v.slice(1)]);
}
function read_emoji_trie(next) {
    let sorted = read_member_array(next).sort((a, b) => a - b);
    return read();
    function read() {
        let branches = [];
        while (true) {
            let keys = read_member_array(next, sorted);
            if (keys.length == 0)
                break;
            branches.push({ set: new Set(keys), node: read() });
        }
        branches.sort((a, b) => b.set.size - a.set.size); // sort by likelihood
        let temp = next();
        let valid = temp % 3;
        temp = (temp / 3) | 0;
        let fe0f = !!(temp & 1);
        temp >>= 1;
        let save = temp == 1;
        let check = temp == 2;
        return { branches, valid, fe0f, save, check };
    }
}

/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */
function getData() {
    return read_compressed_payload(decode$1('AEQF2AO2DEsA2wIrAGsBRABxAN8AZwCcAEwAqgA0AGwAUgByADcATAAVAFYAIQAyACEAKAAYAFgAGwAjABQAMAAmADIAFAAfABQAKwATACoADgAbAA8AHQAYABoAGQAxADgALAAoADwAEwA9ABMAGgARAA4ADwAWABMAFgAIAA8AHgQXBYMA5BHJAS8JtAYoAe4AExozi0UAH21tAaMnBT8CrnIyhrMDhRgDygIBUAEHcoFHUPe8AXBjAewCjgDQR8IICIcEcQLwATXCDgzvHwBmBoHNAqsBdBcUAykgDhAMShskMgo8AY8jqAQfAUAfHw8BDw87MioGlCIPBwZCa4ELatMAAMspJVgsDl8AIhckSg8XAHdvTwBcIQEiDT4OPhUqbyECAEoAS34Aej8Ybx83JgT/Xw8gHxZ/7w8RICxPHA9vBw+Pfw8PHwAPFv+fAsAvCc8vEr8ivwD/EQ8Bol8OEBa/A78hrwAPCU8vESNvvwWfHwNfAVoDHr+ZAAED34YaAdJPAK7PLwSEgDLHAGo1Pz8Pvx9fUwMrpb8O/58VTzAPIBoXIyQJNF8hpwIVAT8YGAUADDNBaX3RAMomJCg9EhUeA29MABsZBTMNJipjOhc19gcIDR8bBwQHEggCWi6DIgLuAQYA+BAFCha3A5XiAEsqM7UFFgFLhAMjFTMYE1Klnw74nRVBG/ASCm0BYRN/BrsU3VoWy+S0vV8LQx+vN8gF2AC2AK5EAWwApgYDKmAAroQ0NDQ0AT+OCg7wAAIHRAbpNgVcBV0APTA5BfbPFgMLzcYL/QqqA82eBALKCjQCjqYCht0/k2+OAsXQAoP3ASTKDgDw6ACKAUYCMpIKJpRaAE4A5womABzZvs0REEKiACIQAd5QdAECAj4Ywg/wGqY2AVgAYADYvAoCGAEubA0gvAY2ALAAbpbvqpyEAGAEpgQAJgAG7gAgAEACmghUFwCqAMpAINQIwC4DthRAAPcycKgApoIdABwBfCisABoATwBqASIAvhnSBP8aH/ECeAKXAq40NjgDBTwFYQU6AXs3oABgAD4XNgmcCY1eCl5tIFZeUqGgyoNHABgAEQAaABNwWQAmABMATPMa3T34ADldyprmM1M2XociUQgLzvwAXT3xABgAEQAaABNwIGFAnADD8AAgAD4BBJWzaCcIAIEBFMAWwKoAAdq9BWAF5wLQpALEtQAKUSGkahR4GnJM+gsAwCgeFAiUAECQ0BQuL8AAIAAAADKeIheclvFqQAAETr4iAMxIARMgAMIoHhQIAn0E0pDQFC4HhznoAAAAIAI2C0/4lvFqQAAETgBJJwYCAy4ABgYAFAA8MBKYEH4eRhTkAjYeFcgACAYAeABsOqyQ5gRwDayqugEgaIIAtgoACgDmEABmBAWGme5OBJJA2m4cDeoAmITWAXwrMgOgAGwBCh6CBXYF1Tzg1wKAAFdiuABRAFwAXQBsAG8AdgBrAHYAbwCEAHEwfxQBVE5TEQADVFhTBwBDANILAqcCzgLTApQCrQL6vAAMAL8APLhNBKkE6glGKTAU4Dr4N2EYEwBCkABKk8rHAbYBmwIoAiU4Ajf/Aq4CowCAANIChzgaNBsCsTgeODcFXrgClQKdAqQBiQGYAqsCsjTsNHsfNPA0ixsAWTWiOAMFPDQSNCk2BDZHNow2TTZUNhk28Jk9VzI3QkEoAoICoQKwAqcAQAAxBV4FXbS9BW47YkIXP1ciUqs05DS/FwABUwJW11e6nHuYZmSh/RAYA8oMKvZ8KASoUAJYWAJ6ILAsAZSoqjpgA0ocBIhmDgDWAAawRDQoAAcuAj5iAHABZiR2AIgiHgCaAU68ACxuHAG0ygM8MiZIAlgBdF4GagJqAPZOHAMuBgoATkYAsABiAHgAMLoGDPj0HpKEBAAOJgAuALggTAHWAeAMEDbd20Uege0ADwAWADkAQgA9OHd+2MUQZBBhBgNNDkxxPxUQArEPqwvqERoM1irQ090ANK4H8ANYB/ADWANYB/AH8ANYB/ADWANYA1gDWBwP8B/YxRBkD00EcgWTBZAE2wiIJk4RhgctCNdUEnQjHEwDSgEBIypJITuYMxAlR0wRTQgIATZHbKx9PQNMMbBU+pCnA9AyVDlxBgMedhKlAC8PeCE1uk6DekxxpQpQT7NX9wBFBgASqwAS5gBJDSgAUCwGPQBI4zTYABNGAE2bAE3KAExdGABKaAbgAFBXAFCOAFBJABI2SWdObALDOq0//QomCZhvwHdTBkIQHCemEPgMNAG2ATwN7kvZBPIGPATKH34ZGg/OlZ0Ipi3eDO4m5C6igFsj9iqEBe5L9TzeC05RaQ9aC2YJ5DpkgU8DIgEOIowK3g06CG4Q9ArKbA3mEUYHOgPWSZsApgcCCxIdNhW2JhFirQsKOXgG/Br3C5AmsBMqev0F1BoiBk4BKhsAANAu6IWxWjJcHU9gBgQLJiPIFKlQIQ0mQLh4SRocBxYlqgKSQ3FKiFE3HpQh9zw+DWcuFFF9B/Y8BhlQC4I8n0asRQ8R0z6OPUkiSkwtBDaALDAnjAnQD4YMunxzAVoJIgmyDHITMhEYN8YIOgcaLpclJxYIIkaWYJsE+KAD9BPSAwwFQAlCBxQDthwuEy8VKgUOgSXYAvQ21i60ApBWgQEYBcwPJh/gEFFH4Q7qCJwCZgOEJewALhUiABginAhEZABgj9lTBi7MCMhqbSN1A2gU6GIRdAeSDlgHqBw0FcAc4nDJXgyGCSiksAlcAXYJmgFgBOQICjVcjKEgQmdUi1kYnCBiQUBd/QIyDGYVoES+h3kCjA9sEhwBNgF0BzoNAgJ4Ee4RbBCWCOyGBTW2M/k6JgRQIYQgEgooA1BszwsoJvoM+WoBpBJjAw00PnfvZ6xgtyUX/gcaMsZBYSHyC5NPzgydGsIYQ1QvGeUHwAP0GvQn60FYBgADpAQUOk4z7wS+C2oIjAlAAEoOpBgH2BhrCnKM0QEyjAG4mgNYkoQCcJAGOAcMAGgMiAV65gAeAqgIpAAGANADWAA6Aq4HngAaAIZCAT4DKDABIuYCkAOUCDLMAZYwAfQqBBzEDBYA+DhuSwLDsgKAa2ajBd5ZAo8CSjYBTiYEBk9IUgOwcuIA3ABMBhTgSAEWrEvMG+REAeBwLADIAPwABjYHBkIBzgH0bgC4AWALMgmjtLYBTuoqAIQAFmwB2AKKAN4ANgCA8gFUAE4FWvoF1AJQSgESMhksWGIBvAMgATQBDgB6BsyOpsoIIARuB9QCEBwV4gLvLwe2AgMi4BPOQsYCvd9WADIXUu5eZwqoCqdeaAC0YTQHMnM9UQAPH6k+yAdy/BZIiQImSwBQ5gBQQzSaNTFWSTYBpwGqKQK38AFtqwBI/wK37gK3rQK3sAK6280C0gK33AK3zxAAUEIAUD9SklKDArekArw5AEQAzAHCO147WTteO1k7XjtZO147WTteO1kDmChYI03AVU0oJqkKbV9GYewMpw3VRMk6ShPcYFJgMxPJLbgUwhXPJVcZPhq9JwYl5VUKDwUt1GYxCC00dhe9AEApaYNCY4ceMQpMHOhTklT5LRwAskujM7ANrRsWREEFSHXuYisWDwojAmSCAmJDXE6wXDchAqH4AmiZAmYKAp+FOBwMAmY8AmYnBG8EgAN/FAN+kzkHOXgYOYM6JCQCbB4CMjc4CwJtyAJtr/CLADRoRiwBaADfAOIASwYHmQyOAP8MwwAOtgJ3MAJ2o0ACeUxEAni7Hl3cRa9G9AJ8QAJ6yQJ9CgJ88UgBSH5kJQAsFklZSlwWGErNAtECAtDNSygDiFADh+dExpEzAvKiXQQDA69Lz0wuJgTQTU1NsAKLQAKK2cIcCB5EaAa4Ao44Ao5dQZiCAo7aAo5deVG1UzYLUtVUhgKT/AKTDQDqAB1VH1WwVdEHLBwplocy4nhnRTw6ApegAu+zWCKpAFomApaQApZ9nQCqWa1aCoJOADwClrYClk9cRVzSApnMApllXMtdCBoCnJw5wzqeApwXAp+cAp65iwAeEDIrEAKd8gKekwC2PmE1YfACntQCoG8BqgKeoCACnk+mY8lkKCYsAiewAiZ/AqD8AqBN2AKmMAKlzwKoAAB+AqfzaH1osgAESmodatICrOQCrK8CrWgCrQMCVx4CVd0CseLYAx9PbJgCsr4OArLpGGzhbWRtSWADJc4Ctl08QG6RAylGArhfArlIFgK5K3hwN3DiAr0aAy2zAzISAr6JcgMDM3ICvhtzI3NQAsPMAsMFc4N0TDZGdOEDPKgDPJsDPcACxX0CxkgCxhGKAshqUgLIRQLJUALJLwJkngLd03h6YniveSZL0QMYpGcDAmH1GfSVJXsMXpNevBICz2wCz20wTFTT9BSgAMeuAs90ASrrA04TfkwGAtwoAtuLAtJQA1JdA1NgAQIDVY2AikABzBfuYUZ2AILPg44C2sgC2d+EEYRKpz0DhqYAMANkD4ZyWvoAVgLfZgLeuXR4AuIw7RUB8zEoAfScAfLTiALr9ALpcXoAAur6AurlAPpIAboC7ooC652Wq5cEAu5AA4XhmHpw4XGiAvMEAGoDjheZlAL3FAORbwOSiAL3mQL52gL4Z5odmqy8OJsfA52EAv77ARwAOp8dn7QDBY4DpmsDptoA0sYDBmuhiaIGCgMMSgFgASACtgNGAJwEgLpoBgC8BGzAEowcggCEDC6kdjoAJAM0C5IKRoABZCgiAIzw3AYBLACkfng9ogigkgNmWAN6AEQCvrkEVqTGAwCsBRbAA+4iQkMCHR072jI2PTbUNsk2RjY5NvA23TZKNiU3EDcZN5I+RTxDRTBCJkK5VBYKFhZfwQCWygU3AJBRHpu+OytgNxa61A40GMsYjsn7BVwFXQVcBV0FaAVdBVwFXQVcBV0FXAVdBVwFXUsaCNyKAK4AAQUHBwKU7oICoW1e7jAEzgPxA+YDwgCkBFDAwADABKzAAOxFLhitA1UFTDeyPkM+bj51QkRCuwTQWWQ8X+0AWBYzsACNA8xwzAGm7EZ/QisoCTAbLDs6fnLfb8H2GccsbgFw13M1HAVkBW/Jxsm9CNRO8E8FDD0FBQw9FkcClOYCoMFegpDfADgcMiA2AJQACB8AsigKAIzIEAJKeBIApY5yPZQIAKQiHb4fvj5BKSRPQrZCOz0oXyxgOywfKAnGbgMClQaCAkILXgdeCD9IIGUgQj5fPoY+dT52Ao5CM0dAX9BTVG9SDzFwWTQAbxBzJF/lOEIQQglCCkKJIAls5AcClQICoKPMODEFxhi6KSAbiyfIRrMjtCgdWCAkPlFBIitCsEJRzAbMAV/OEyQzDg0OAQQEJ36i328/Mk9AybDJsQlq3tDRApUKAkFzXf1d/j9uALYP6hCoFgCTGD8kPsFKQiobrm0+zj0KSD8kPnVCRBwMDyJRTHFgMTJa5rwXQiQ2YfI/JD7BMEJEHGINTw4TOFlIRzwJO0icMQpyPyQ+wzJCRBv6DVgnKB01NgUKj2bwYzMqCoBkznBgEF+zYDIocwRIX+NgHj4HICNfh2C4CwdwFWpTG/lgUhYGAwRfv2Ts8mAaXzVgml/XYIJfuWC4HI1gUF9pYJZgMR6ilQHMAOwLAlDRefC0in4AXAEJA6PjCwc0IamOANMMCAECRQDFNRTZBgd+CwQlRA+r6+gLBDEFBnwUBXgKATIArwAGRAAHA3cDdAN2A3kDdwN9A3oDdQN7A30DfAN4A3oDfQAYEAAlAtYASwMAUAFsAHcKAHcAmgB3AHUAdQB2AHVu8UgAygDAAHcAdQB1AHYAdQALCgB3AAsAmgB3AAsCOwB3AAtu8UgAygDAAHgKAJoAdwB3AHUAdQB2AHUAeAB1AHUAdgB1bvFIAMoAwAALCgCaAHcACwB3AAsCOwB3AAtu8UgAygDAAH4ACwGgALcBpwC6AahdAu0COwLtbvFIAMoAwAALCgCaAu0ACwLtAAsCOwLtAAtu8UgAygDAA24ACwNvAAu0VsQAAzsAABCkjUIpAAsAUIusOggWcgMeBxVsGwL67U/2HlzmWOEeOgALASvuAAseAfpKUpnpGgYJDCIZM6YyARUE9ThqAD5iXQgnAJYJPnOzw0ZAEZxEKsIAkA4DhAHnTAIDxxUDK0lxCQlPYgIvIQVYJQBVqE1GakUAKGYiDToSBA1EtAYAXQJYAIF8GgMHRyAAIAjOe9YncekRAA0KACUrjwE7Ayc6AAYWAqaiKG4McEcqANoN3+Mg9TwCBhIkuCny+JwUQ29L008JluRxu3K+oAdqiHOqFH0AG5SUIfUJ5SxCGfxdipRzqTmT4V5Zb+r1Uo4Vm+NqSSEl2mNvR2JhIa8SpYO6ntdwFXHCWTCK8f2+Hxo7uiG3drDycAuKIMP5bhi06ACnqArH1rz4Rqg//lm6SgJGEVbF9xJHISaR6HxqxSnkw6shDnelHKNEfGUXSJRJ1GcsmtJw25xrZMDK9gXSm1/YMkdX4/6NKYOdtk/NQ3/NnDASjTc3fPjIjW/5sVfVObX2oTDWkr1dF9f3kxBsD3/3aQO8hPfRz+e0uEiJqt1161griu7gz8hDDwtpy+F+BWtefnKHZPAxcZoWbnznhJpy0e842j36bcNzGnIEusgGX0a8ZxsnjcSsPDZ09yZ36fCQbriHeQ72JRMILNl6ePPf2HWoVwgWAm1fb3V2sAY0+B6rAXqSwPBgseVmoqsBTSrm91+XasMYYySI8eeRxH3ZvHkMz3BQ5aJ3iUVbYPNM3/7emRtjlsMgv/9VyTsyt/mK+8fgWeT6SoFaclXqn42dAIsvAarF5vNNWHzKSkKQ/8Hfk5ZWK7r9yliOsooyBjRhfkHP4Q2DkWXQi6FG/9r/IwbmkV5T7JSopHKn1pJwm9tb5Ot0oyN1Z2mPpKXHTxx2nlK08fKk1hEYA8WgVVWL5lgx0iTv+KdojJeU23ZDjmiubXOxVXJKKi2Wjuh2HLZOFLiSC7Tls5SMh4f+Pj6xUSrNjFqLGehRNB8lC0QSLNmkJJx/wSG3MnjE9T1CkPwJI0wH2lfzwETIiVqUxg0dfu5q39Gt+hwdcxkhhNvQ4TyrBceof3Mhs/IxFci1HmHr4FMZgXEEczPiGCx0HRwzAqDq2j9AVm1kwN0mRVLWLylgtoPNapF5cY4Y1wJh/e0BBwZj44YgZrDNqvD/9Hv7GFYdUQeDJuQ3EWI4HaKqavU1XjC/n41kT4L79kqGq0kLhdTZvgP3TA3fS0ozVz+5piZsoOtIvBUFoMKbNcmBL6YxxaUAusHB38XrS8dQMnQwJfUUkpRoGr5AUeWicvBTzyK9g77+yCkf5PAysL7r/JjcZgrbvRpMW9iyaxZvKO6ceZN2EwIxKwVFPuvFuiEPGCoagbMo+SpydLrXqBzNCDGFCrO/rkcwa2xhokQZ5CdZ0AsU3JfSqJ6n5I14YA+P/uAgfhPU84Tlw7cEFfp7AEE8ey4sP12PTt4Cods1GRgDOB5xvyiR5m+Bx8O5nBCNctU8BevfV5A08x6RHd5jcwPTMDSZJOedIZ1cGQ704lxbAzqZOP05ZxaOghzSdvFBHYqomATARyAADK4elP8Ly3IrUZKfWh23Xy20uBUmLS4Pfagu9+oyVa2iPgqRP3F2CTUsvJ7+RYnN8fFZbU/HVvxvcFFDKkiTqV5UBZ3Gz54JAKByi9hkKMZJvuGgcSYXFmw08UyoQyVdfTD1/dMkCHXcTGAKeROgArsvmRrQTLUOXioOHGK2QkjHuoYFgXciZoTJd6Fs5q1QX1G+p/e26hYsEf7QZD1nnIyl/SFkNtYYmmBhpBrxl9WbY0YpHWRuw2Ll/tj9mD8P4snVzJl4F9J+1arVeTb9E5r2ILH04qStjxQNwn3m4YNqxmaNbLAqW2TN6LidwuJRqS+NXbtqxoeDXpxeGWmxzSkWxjkyCkX4NQRme6q5SAcC+M7+9ETfA/EwrzQajKakCwYyeunP6ZFlxU2oMEn1Pz31zeStW74G406ZJFCl1wAXIoUKkWotYEpOuXB1uVNxJ63dpJEqfxBeptwIHNrPz8BllZoIcBoXwgfJ+8VAUnVPvRvexnw0Ma/WiGYuJO5y8QTvEYBigFmhUxY5RqzE8OcywN/8m4UYrlaniJO75XQ6KSo9+tWHlu+hMi0UVdiKQp7NelnoZUzNaIyBPVeOwK6GNp+FfHuPOoyhaWuNvTYFkvxscMQWDh+zeFCFkgwbXftiV23ywJ4+uwRqmg9k3KzwIQpzppt8DBBOMbrqwQM5Gb05sEwdKzMiAqOloaA/lr0KA+1pr0/+HiWoiIjHA/wir2nIuS3PeU/ji3O6ZwoxcR1SZ9FhtLC5S0FIzFhbBWcGVP/KpxOPSiUoAdWUpqKH++6Scz507iCcxYI6rdMBICPJZea7OcmeFw5mObJSiqpjg2UoWNIs+cFhyDSt6geV5qgi3FunmwwDoGSMgerFOZGX1m0dMCYo5XOruxO063dwENK9DbnVM9wYFREzh4vyU1WYYJ/LRRp6oxgjqP/X5a8/4Af6p6NWkQferzBmXme0zY/4nwMJm/wd1tIqSwGz+E3xPEAOoZlJit3XddD7/BT1pllzOx+8bmQtANQ/S6fZexc6qi3W+Q2xcmXTUhuS5mpHQRvcxZUN0S5+PL9lXWUAaRZhEH8hTdAcuNMMCuVNKTEGtSUKNi3O6KhSaTzck8csZ2vWRZ+d7mW8c4IKwXIYd25S/zIftPkwPzufjEvOHWVD1m+FjpDVUTV0DGDuHj6QnaEwLu/dEgdLQOg9E1Sro9XHJ8ykLAwtPu+pxqKDuFexqON1sKQm7rwbE1E68UCfA/erovrTCG+DBSNg0l4goDQvZN6uNlbyLpcZAwj2UclycvLpIZMgv4yRlpb3YuMftozorbcGVHt/VeDV3+Fdf1TP0iuaCsPi2G4XeGhsyF1ubVDxkoJhmniQ0/jSg/eYML9KLfnCFgISWkp91eauR3IQvED0nAPXK+6hPCYs+n3+hCZbiskmVMG2da+0EsZPonUeIY8EbfusQXjsK/eFDaosbPjEfQS0RKG7yj5GG69M7MeO1HmiUYocgygJHL6M1qzUDDwUSmr99V7Sdr2F3JjQAJY+F0yH33Iv3+C9M38eML7gTgmNu/r2bUMiPvpYbZ6v1/IaESirBHNa7mPKn4dEmYg7v/+HQgPN1G79jBQ1+soydfDC2r+h2Bl/KIc5KjMK7OH6nb1jLsNf0EHVe2KBiE51ox636uyG6Lho0t3J34L5QY/ilE3mikaF4HKXG1mG1rCevT1Vv6GavltxoQe/bMrpZvRggnBxSEPEeEzkEdOxTnPXHVjUYdw8JYvjB/o7Eegc3Ma+NUxLLnsK0kJlinPmUHzHGtrk5+CAbVzFOBqpyy3QVUnzTDfC/0XD94/okH+OB+i7g9lolhWIjSnfIb+Eq43ZXOWmwvjyV/qqD+t0e+7mTEM74qP/Ozt8nmC7mRpyu63OB4KnUzFc074SqoyPUAgM+/TJGFo6T44EHnQU4X4z6qannVqgw/U7zCpwcmXV1AubIrvOmkKHazJAR55ePjp5tLBsN8vAqs3NAHdcEHOR2xQ0lsNAFzSUuxFQCFYvXLZJdOj9p4fNq6p0HBGUik2YzaI4xySy91KzhQ0+q1hjxvImRwPRf76tChlRkhRCi74NXZ9qUNeIwP+s5p+3m5nwPdNOHgSLD79n7O9m1n1uDHiMntq4nkYwV5OZ1ENbXxFd4PgrlvavZsyUO4MqYlqqn1O8W/I1dEZq5dXhrbETLaZIbC2Kj/Aa/QM+fqUOHdf0tXAQ1huZ3cmWECWSXy/43j35+Mvq9xws7JKseriZ1pEWKc8qlzNrGPUGcVgOa9cPJYIJsGnJTAUsEcDOEVULO5x0rXBijc1lgXEzQQKhROf8zIV82w8eswc78YX11KYLWQRcgHNJElBxfXr72lS2RBSl07qTKorO2uUDZr3sFhYsvnhLZn0A94KRzJ/7DEGIAhW5ZWFpL8gEwu1aLA9MuWZzNwl8Oze9Y+bX+v9gywRVnoB5I/8kXTXU3141yRLYrIOOz6SOnyHNy4SieqzkBXharjfjqq1q6tklaEbA8Qfm2DaIPs7OTq/nvJBjKfO2H9bH2cCMh1+5gspfycu8f/cuuRmtDjyqZ7uCIMyjdV3a+p3fqmXsRx4C8lujezIFHnQiVTXLXuI1XrwN3+siYYj2HHTvESUx8DlOTXpak9qFRK+L3mgJ1WsD7F4cu1aJoFoYQnu+wGDMOjJM3kiBQWHCcvhJ/HRdxodOQp45YZaOTA22Nb4XKCVxqkbwMYFhzYQYIAnCW8FW14uf98jhUG2zrKhQQ0q0CEq0t5nXyvUyvR8DvD69LU+g3i+HFWQMQ8PqZuHD+sNKAV0+M6EJC0szq7rEr7B5bQ8BcNHzvDMc9eqB5ZCQdTf80Obn4uzjwpYU7SISdtV0QGa9D3Wrh2BDQtpBKxaNFV+/Cy2P/Sv+8s7Ud0Fd74X4+o/TNztWgETUapy+majNQ68Lq3ee0ZO48VEbTZYiH1Co4OlfWef82RWeyUXo7woM03PyapGfikTnQinoNq5z5veLpeMV3HCAMTaZmA1oGLAn7XS3XYsz+XK7VMQsc4XKrmDXOLU/pSXVNUq8dIqTba///3x6LiLS6xs1xuCAYSfcQ3+rQgmu7uvf3THKt5Ooo97TqcbRqxx7EASizaQCBQllG/rYxVapMLgtLbZS64w1MDBMXX+PQpBKNwqUKOf2DDRDUXQf9EhOS0Qj4nTmlA8dzSLz/G1d+Ud8MTy/6ghhdiLpeerGY/UlDOfiuqFsMUU5/UYlP+BAmgRLuNpvrUaLlVkrqDievNVEAwF+4CoM1MZTmjxjJMsKJq+u8Zd7tNCUFy6LiyYXRJQ4VyvEQFFaCGKsxIwQkk7EzZ6LTJq2hUuPhvAW+gQnSG6J+MszC+7QCRHcnqDdyNRJ6T9xyS87A6MDutbzKGvGktpbXqtzWtXb9HsfK2cBMomjN9a4y+TaJLnXxAeX/HWzmf4cR4vALt/P4w4qgKY04ml4ZdLOinFYS6cup3G/1ie4+t1eOnpBNlqGqs75ilzkT4+DsZQxNvaSKJ//6zIbbk/M7LOhFmRc/1R+kBtz7JFGdZm/COotIdvQoXpTqP/1uqEUmCb/QWoGLMwO5ANcHzxdY48IGP5+J+zKOTBFZ4Pid+GTM+Wq12MV/H86xEJptBa6T+p3kgpwLedManBHC2GgNrFpoN2xnrMz9WFWX/8/ygSBkavq2Uv7FdCsLEYLu9LLIvAU0bNRDtzYl+/vXmjpIvuJFYjmI0im6QEYqnIeMsNjXG4vIutIGHijeAG/9EDBozKV5cldkHbLxHh25vT+ZEzbhXlqvpzKJwcEgfNwLAKFeo0/pvEE10XDB+EXRTXtSzJozQKFFAJhMxYkVaCW+E9AL7tMeU8acxidHqzb6lX4691UsDpy/LLRmT+epgW56+5Cw8tB4kMUv6s9lh3eRKbyGs+H/4mQMaYzPTf2OOdokEn+zzgvoD3FqNKk8QqGAXVsqcGdXrT62fSPkR2vROFi68A6se86UxRUk4cajfPyCC4G5wDhD+zNq4jodQ4u4n/m37Lr36n4LIAAsVr02dFi9AiwA81MYs2rm4eDlDNmdMRvEKRHfBwW5DdMNp0jPFZMeARqF/wL4XBfd+EMLBfMzpH5GH6NaW+1vrvMdg+VxDzatk3MXgO3ro3P/DpcC6+Mo4MySJhKJhSR01SGGGp5hPWmrrUgrv3lDnP+HhcI3nt3YqBoVAVTBAQT5iuhTg8nvPtd8ZeYj6w1x6RqGUBrSku7+N1+BaasZvjTk64RoIDlL8brpEcJx3OmY7jLoZsswdtmhfC/G21llXhITOwmvRDDeTTPbyASOa16cF5/A1fZAidJpqju3wYAy9avPR1ya6eNp9K8XYrrtuxlqi+bDKwlfrYdR0RRiKRVTLOH85+ZY7XSmzRpfZBJjaTa81VDcJHpZnZnSQLASGYW9l51ZV/h7eVzTi3Hv6hUsgc/51AqJRTkpbFVLXXszoBL8nBX0u/0jBLT8nH+fJePbrwURT58OY+UieRjd1vs04w0VG5VN2U6MoGZkQzKN/ptz0Q366dxoTGmj7i1NQGHi9GgnquXFYdrCfZBmeb7s0T6yrdlZH5cZuwHFyIJ/kAtGsTg0xH5taAAq44BAk1CPk9KVVbqQzrCUiFdF/6gtlPQ8bHHc1G1W92MXGZ5HEHftyLYs8mbD/9xYRUWkHmlM0zC2ilJlnNgV4bfALpQghxOUoZL7VTqtCHIaQSXm+YUMnpkXybnV+A6xlm2CVy8fn0Xlm2XRa0+zzOa21JWWmixfiPMSCZ7qA4rS93VN3pkpF1s5TonQjisHf7iU9ZGvUPOAKZcR1pbeVf/Ul7OhepGCaId9wOtqo7pJ7yLcBZ0pFkOF28y4zEI/kcUNmutBHaQpBdNM8vjCS6HZRokkeo88TBAjGyG7SR+6vUgTcyK9Imalj0kuxz0wmK+byQU11AiJFk/ya5dNduRClcnU64yGu/ieWSeOos1t3ep+RPIWQ2pyTYVbZltTbsb7NiwSi3AV+8KLWk7LxCnfZUetEM8ThnsSoGH38/nyAwFguJp8FjvlHtcWZuU4hPva0rHfr0UhOOJ/F6vS62FW7KzkmRll2HEc7oUq4fyi5T70Vl7YVIfsPHUCdHesf9Lk7WNVWO75JDkYbMI8TOW8JKVtLY9d6UJRITO8oKo0xS+o99Yy04iniGHAaGj88kEWgwv0OrHdY/nr76DOGNS59hXCGXzTKUvDl9iKpLSWYN1lxIeyywdNpTkhay74w2jFT6NS8qkjo5CxA1yfSYwp6AJIZNKIeEK5PJAW7ORgWgwp0VgzYpqovMrWxbu+DGZ6Lhie1RAqpzm8VUzKJOH3mCzWuTOLsN3VT/dv2eeYe9UjbR8YTBsLz7q60VN1sU51k+um1f8JxD5pPhbhSC8rRaB454tmh6YUWrJI3+GWY0qeWioj/tbkYITOkJaeuGt4JrJvHA+l0Gu7kY7XOaa05alMnRWVCXqFgLIwSY4uF59Ue5SU4QKuc/HamDxbr0x6csCetXGoP7Qn1Bk/J9DsynO/UD6iZ1Hyrz+jit0hDCwi/E9OjgKTbB3ZQKQ/0ZOvevfNHG0NK4Aj3Cp7NpRk07RT1i/S0EL93Ag8GRgKI9CfpajKyK6+Jj/PI1KO5/85VAwz2AwzP8FTBb075IxCXv6T9RVvWT2tUaqxDS92zrGUbWzUYk9mSs82pECH+fkqsDt93VW++4YsR/dHCYcQSYTO/KaBMDj9LSD/J/+z20Kq8XvZUAIHtm9hRPP3ItbuAu2Hm5lkPs92pd7kCxgRs0xOVBnZ13ccdA0aunrwv9SdqElJRC3g+oCu+nXyCgmXUs9yMjTMAIHfxZV+aPKcZeUBWt057Xo85Ks1Ir5gzEHCWqZEhrLZMuF11ziGtFQUds/EESajhagzcKsxamcSZxGth4UII+adPhQkUnx2WyN+4YWR+r3f8MnkyGFuR4zjzxJS8WsQYR5PTyRaD9ixa6Mh741nBHbzfjXHskGDq179xaRNrCIB1z1xRfWfjqw2pHc1zk9xlPpL8sQWAIuETZZhbnmL54rceXVNRvUiKrrqIkeogsl0XXb17ylNb0f4GA9Wd44vffEG8FSZGHEL2fbaTGRcSiCeA8PmA/f6Hz8HCS76fXUHwgwkzSwlI71ekZ7Fapmlk/KC+Hs8hUcw3N2LN5LhkVYyizYFl/uPeVP5lsoJHhhfWvvSWruCUW1ZcJOeuTbrDgywJ/qG07gZJplnTvLcYdNaH0KMYOYMGX+rB4NGPFmQsNaIwlWrfCezxre8zXBrsMT+edVLbLqN1BqB76JH4BvZTqUIMfGwPGEn+EnmTV86fPBaYbFL3DFEhjB45CewkXEAtJxk4/Ms2pPXnaRqdky0HOYdcUcE2zcXq4vaIvW2/v0nHFJH2XXe22ueDmq/18XGtELSq85j9X8q0tcNSSKJIX8FTuJF/Pf8j5PhqG2u+osvsLxYrvvfeVJL+4tkcXcr9JV7v0ERmj/X6fM3NC4j6dS1+9Umr2oPavqiAydTZPLMNRGY23LO9zAVDly7jD+70G5TPPLdhRIl4WxcYjLnM+SNcJ26FOrkrISUtPObIz5Zb3AG612krnpy15RMW+1cQjlnWFI6538qky9axd2oJmHIHP08KyP0ubGO+TQNOYuv2uh17yCIvR8VcStw7o1g0NM60sk+8Tq7YfIBJrtp53GkvzXH7OA0p8/n/u1satf/VJhtR1l8Wa6Gmaug7haSpaCaYQax6ta0mkutlb+eAOSG1aobM81D9A4iS1RRlzBBoVX6tU1S6WE2N9ORY6DfeLRC4l9Rvr5h95XDWB2mR1d4WFudpsgVYwiTwT31ljskD8ZyDOlm5DkGh9N/UB/0AI5Xvb8ZBmai2hQ4BWMqFwYnzxwB26YHSOv9WgY3JXnvoN+2R4rqGVh/LLDMtpFP+SpMGJNWvbIl5SOodbCczW2RKleksPoUeGEzrjtKHVdtZA+kfqO+rVx/iclCqwoopepvJpSTDjT+b9GWylGRF8EDbGlw6eUzmJM95Ovoz+kwLX3c2fTjFeYEsE7vUZm3mqdGJuKh2w9/QGSaqRHs99aScGOdDqkFcACoqdbBoQqqjamhH6Q9ng39JCg3lrGJwd50Qk9ovnqBTr8MME7Ps2wiVfygUmPoUBJJfJWX5Nda0nuncbFkA=='));
}

/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */
const r$1 = getData();
// @TODO: This should be lazily loaded
const VALID = new Set(read_member_array(r$1));
const IGNORED = new Set(read_member_array(r$1));
const MAPPED = read_mapped_map(r$1);
const EMOJI_ROOT = read_emoji_trie(r$1);
//const NFC_CHECK = new Set(read_member_array(r, Array.from(VALID.values()).sort((a, b) => a - b)));
//const STOP = 0x2E;
const HYPHEN = 0x2D;
const UNDERSCORE = 0x5F;
function explode_cp(name) {
    return toUtf8CodePoints(name);
}
function filter_fe0f(cps) {
    return cps.filter(cp => cp != 0xFE0F);
}
function ens_normalize_post_check(name) {
    for (let label of name.split('.')) {
        let cps = explode_cp(label);
        try {
            for (let i = cps.lastIndexOf(UNDERSCORE) - 1; i >= 0; i--) {
                if (cps[i] !== UNDERSCORE) {
                    throw new Error(`underscore only allowed at start`);
                }
            }
            if (cps.length >= 4 && cps.every(cp => cp < 0x80) && cps[2] === HYPHEN && cps[3] === HYPHEN) {
                throw new Error(`invalid label extension`);
            }
        }
        catch (err) {
            throw new Error(`Invalid label "${label}": ${err.message}`);
        }
    }
    return name;
}
function ens_normalize(name) {
    return ens_normalize_post_check(normalize(name, filter_fe0f));
}
function normalize(name, emoji_filter) {
    let input = explode_cp(name).reverse(); // flip for pop
    let output = [];
    while (input.length) {
        let emoji = consume_emoji_reversed(input);
        if (emoji) {
            output.push(...emoji_filter(emoji));
            continue;
        }
        let cp = input.pop();
        if (VALID.has(cp)) {
            output.push(cp);
            continue;
        }
        if (IGNORED.has(cp)) {
            continue;
        }
        let cps = MAPPED[cp];
        if (cps) {
            output.push(...cps);
            continue;
        }
        throw new Error(`Disallowed codepoint: 0x${cp.toString(16).toUpperCase()}`);
    }
    return ens_normalize_post_check(nfc(String.fromCodePoint(...output)));
}
function nfc(s) {
    return s.normalize('NFC');
}
function consume_emoji_reversed(cps, eaten) {
    var _a;
    let node = EMOJI_ROOT;
    let emoji;
    let saved;
    let stack = [];
    let pos = cps.length;
    if (eaten)
        eaten.length = 0; // clear input buffer (if needed)
    while (pos) {
        let cp = cps[--pos];
        node = (_a = node.branches.find(x => x.set.has(cp))) === null || _a === void 0 ? void 0 : _a.node;
        if (!node)
            break;
        if (node.save) { // remember
            saved = cp;
        }
        else if (node.check) { // check exclusion
            if (cp === saved)
                break;
        }
        stack.push(cp);
        if (node.fe0f) {
            stack.push(0xFE0F);
            if (pos > 0 && cps[pos - 1] == 0xFE0F)
                pos--; // consume optional FE0F
        }
        if (node.valid) { // this is a valid emoji (so far)
            emoji = stack.slice(); // copy stack
            if (node.valid == 2)
                emoji.splice(1, 1); // delete FE0F at position 1 (RGI ZWJ don't follow spec!)
            if (eaten)
                eaten.push(...cps.slice(pos).reverse()); // copy input (if needed)
            cps.length = pos; // truncate
        }
    }
    return emoji;
}

const logger$h = new Logger$2(version$d);
const Zeros = new Uint8Array(32);
Zeros.fill(0);
function checkComponent(comp) {
    if (comp.length === 0) {
        throw new Error("invalid ENS name; empty component");
    }
    return comp;
}
function ensNameSplit(name) {
    const bytes = toUtf8Bytes(ens_normalize(name));
    const comps = [];
    if (name.length === 0) {
        return comps;
    }
    let last = 0;
    for (let i = 0; i < bytes.length; i++) {
        const d = bytes[i];
        // A separator (i.e. "."); copy this component
        if (d === 0x2e) {
            comps.push(checkComponent(bytes.slice(last, i)));
            last = i + 1;
        }
    }
    // There was a stray separator at the end of the name
    if (last >= bytes.length) {
        throw new Error("invalid ENS name; empty component");
    }
    comps.push(checkComponent(bytes.slice(last)));
    return comps;
}
function namehash(name) {
    /* istanbul ignore if */
    if (typeof (name) !== "string") {
        logger$h.throwArgumentError("invalid ENS name; not a string", "name", name);
    }
    let result = Zeros;
    const comps = ensNameSplit(name);
    while (comps.length) {
        result = keccak256(concat([result, keccak256(comps.pop())]));
    }
    return hexlify(result);
}
function dnsEncode(name) {
    return hexlify(concat(ensNameSplit(name).map((comp) => {
        // DNS does not allow components over 63 bytes in length
        if (comp.length > 63) {
            throw new Error("invalid DNS encoded entry; length exceeds 63 bytes");
        }
        const bytes = new Uint8Array(comp.length + 1);
        bytes.set(comp, 1);
        bytes[0] = bytes.length - 1;
        return bytes;
    }))) + "00";
}

const messagePrefix = "\x19Ethereum Signed Message:\n";
function hashMessage(message) {
    if (typeof (message) === "string") {
        message = toUtf8Bytes(message);
    }
    return keccak256(concat([
        toUtf8Bytes(messagePrefix),
        toUtf8Bytes(String(message.length)),
        message
    ]));
}

var __awaiter$8 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$g = new Logger$2(version$d);
const padding = new Uint8Array(32);
padding.fill(0);
const NegativeOne = BigNumber.from(-1);
const Zero = BigNumber.from(0);
const One = BigNumber.from(1);
const MaxUint256 = BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
function hexPadRight(value) {
    const bytes = arrayify(value);
    const padOffset = bytes.length % 32;
    if (padOffset) {
        return hexConcat([bytes, padding.slice(padOffset)]);
    }
    return hexlify(bytes);
}
const hexTrue = hexZeroPad(One.toHexString(), 32);
const hexFalse = hexZeroPad(Zero.toHexString(), 32);
const domainFieldTypes = {
    name: "string",
    version: "string",
    chainId: "uint256",
    verifyingContract: "address",
    salt: "bytes32"
};
const domainFieldNames = [
    "name", "version", "chainId", "verifyingContract", "salt"
];
function checkString(key) {
    return function (value) {
        if (typeof (value) !== "string") {
            logger$g.throwArgumentError(`invalid domain value for ${JSON.stringify(key)}`, `domain.${key}`, value);
        }
        return value;
    };
}
const domainChecks = {
    name: checkString("name"),
    version: checkString("version"),
    chainId: function (value) {
        try {
            return BigNumber.from(value).toString();
        }
        catch (error) { }
        return logger$g.throwArgumentError(`invalid domain value for "chainId"`, "domain.chainId", value);
    },
    verifyingContract: function (value) {
        try {
            return getAddress(value).toLowerCase();
        }
        catch (error) { }
        return logger$g.throwArgumentError(`invalid domain value "verifyingContract"`, "domain.verifyingContract", value);
    },
    salt: function (value) {
        try {
            const bytes = arrayify(value);
            if (bytes.length !== 32) {
                throw new Error("bad length");
            }
            return hexlify(bytes);
        }
        catch (error) { }
        return logger$g.throwArgumentError(`invalid domain value "salt"`, "domain.salt", value);
    }
};
function getBaseEncoder(type) {
    // intXX and uintXX
    {
        const match = type.match(/^(u?)int(\d*)$/);
        if (match) {
            const signed = (match[1] === "");
            const width = parseInt(match[2] || "256");
            if (width % 8 !== 0 || width > 256 || (match[2] && match[2] !== String(width))) {
                logger$g.throwArgumentError("invalid numeric width", "type", type);
            }
            const boundsUpper = MaxUint256.mask(signed ? (width - 1) : width);
            const boundsLower = signed ? boundsUpper.add(One).mul(NegativeOne) : Zero;
            return function (value) {
                const v = BigNumber.from(value);
                if (v.lt(boundsLower) || v.gt(boundsUpper)) {
                    logger$g.throwArgumentError(`value out-of-bounds for ${type}`, "value", value);
                }
                return hexZeroPad(v.toTwos(256).toHexString(), 32);
            };
        }
    }
    // bytesXX
    {
        const match = type.match(/^bytes(\d+)$/);
        if (match) {
            const width = parseInt(match[1]);
            if (width === 0 || width > 32 || match[1] !== String(width)) {
                logger$g.throwArgumentError("invalid bytes width", "type", type);
            }
            return function (value) {
                const bytes = arrayify(value);
                if (bytes.length !== width) {
                    logger$g.throwArgumentError(`invalid length for ${type}`, "value", value);
                }
                return hexPadRight(value);
            };
        }
    }
    switch (type) {
        case "address": return function (value) {
            return hexZeroPad(getAddress(value), 32);
        };
        case "bool": return function (value) {
            return ((!value) ? hexFalse : hexTrue);
        };
        case "bytes": return function (value) {
            return keccak256(value);
        };
        case "string": return function (value) {
            return id(value);
        };
    }
    return null;
}
function encodeType(name, fields) {
    return `${name}(${fields.map(({ name, type }) => (type + " " + name)).join(",")})`;
}
class TypedDataEncoder {
    constructor(types) {
        defineReadOnly$1(this, "types", Object.freeze(deepCopy$1(types)));
        defineReadOnly$1(this, "_encoderCache", {});
        defineReadOnly$1(this, "_types", {});
        // Link struct types to their direct child structs
        const links = {};
        // Link structs to structs which contain them as a child
        const parents = {};
        // Link all subtypes within a given struct
        const subtypes = {};
        Object.keys(types).forEach((type) => {
            links[type] = {};
            parents[type] = [];
            subtypes[type] = {};
        });
        for (const name in types) {
            const uniqueNames = {};
            types[name].forEach((field) => {
                // Check each field has a unique name
                if (uniqueNames[field.name]) {
                    logger$g.throwArgumentError(`duplicate variable name ${JSON.stringify(field.name)} in ${JSON.stringify(name)}`, "types", types);
                }
                uniqueNames[field.name] = true;
                // Get the base type (drop any array specifiers)
                const baseType = field.type.match(/^([^\x5b]*)(\x5b|$)/)[1];
                if (baseType === name) {
                    logger$g.throwArgumentError(`circular type reference to ${JSON.stringify(baseType)}`, "types", types);
                }
                // Is this a base encoding type?
                const encoder = getBaseEncoder(baseType);
                if (encoder) {
                    return;
                }
                if (!parents[baseType]) {
                    logger$g.throwArgumentError(`unknown type ${JSON.stringify(baseType)}`, "types", types);
                }
                // Add linkage
                parents[baseType].push(name);
                links[name][baseType] = true;
            });
        }
        // Deduce the primary type
        const primaryTypes = Object.keys(parents).filter((n) => (parents[n].length === 0));
        if (primaryTypes.length === 0) {
            logger$g.throwArgumentError("missing primary type", "types", types);
        }
        else if (primaryTypes.length > 1) {
            logger$g.throwArgumentError(`ambiguous primary types or unused types: ${primaryTypes.map((t) => (JSON.stringify(t))).join(", ")}`, "types", types);
        }
        defineReadOnly$1(this, "primaryType", primaryTypes[0]);
        // Check for circular type references
        function checkCircular(type, found) {
            if (found[type]) {
                logger$g.throwArgumentError(`circular type reference to ${JSON.stringify(type)}`, "types", types);
            }
            found[type] = true;
            Object.keys(links[type]).forEach((child) => {
                if (!parents[child]) {
                    return;
                }
                // Recursively check children
                checkCircular(child, found);
                // Mark all ancestors as having this decendant
                Object.keys(found).forEach((subtype) => {
                    subtypes[subtype][child] = true;
                });
            });
            delete found[type];
        }
        checkCircular(this.primaryType, {});
        // Compute each fully describe type
        for (const name in subtypes) {
            const st = Object.keys(subtypes[name]);
            st.sort();
            this._types[name] = encodeType(name, types[name]) + st.map((t) => encodeType(t, types[t])).join("");
        }
    }
    getEncoder(type) {
        let encoder = this._encoderCache[type];
        if (!encoder) {
            encoder = this._encoderCache[type] = this._getEncoder(type);
        }
        return encoder;
    }
    _getEncoder(type) {
        // Basic encoder type (address, bool, uint256, etc)
        {
            const encoder = getBaseEncoder(type);
            if (encoder) {
                return encoder;
            }
        }
        // Array
        const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
        if (match) {
            const subtype = match[1];
            const subEncoder = this.getEncoder(subtype);
            const length = parseInt(match[3]);
            return (value) => {
                if (length >= 0 && value.length !== length) {
                    logger$g.throwArgumentError("array length mismatch; expected length ${ arrayLength }", "value", value);
                }
                let result = value.map(subEncoder);
                if (this._types[subtype]) {
                    result = result.map(keccak256);
                }
                return keccak256(hexConcat(result));
            };
        }
        // Struct
        const fields = this.types[type];
        if (fields) {
            const encodedType = id(this._types[type]);
            return (value) => {
                const values = fields.map(({ name, type }) => {
                    const result = this.getEncoder(type)(value[name]);
                    if (this._types[type]) {
                        return keccak256(result);
                    }
                    return result;
                });
                values.unshift(encodedType);
                return hexConcat(values);
            };
        }
        return logger$g.throwArgumentError(`unknown type: ${type}`, "type", type);
    }
    encodeType(name) {
        const result = this._types[name];
        if (!result) {
            logger$g.throwArgumentError(`unknown type: ${JSON.stringify(name)}`, "name", name);
        }
        return result;
    }
    encodeData(type, value) {
        return this.getEncoder(type)(value);
    }
    hashStruct(name, value) {
        return keccak256(this.encodeData(name, value));
    }
    encode(value) {
        return this.encodeData(this.primaryType, value);
    }
    hash(value) {
        return this.hashStruct(this.primaryType, value);
    }
    _visit(type, value, callback) {
        // Basic encoder type (address, bool, uint256, etc)
        {
            const encoder = getBaseEncoder(type);
            if (encoder) {
                return callback(type, value);
            }
        }
        // Array
        const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
        if (match) {
            const subtype = match[1];
            const length = parseInt(match[3]);
            if (length >= 0 && value.length !== length) {
                logger$g.throwArgumentError("array length mismatch; expected length ${ arrayLength }", "value", value);
            }
            return value.map((v) => this._visit(subtype, v, callback));
        }
        // Struct
        const fields = this.types[type];
        if (fields) {
            return fields.reduce((accum, { name, type }) => {
                accum[name] = this._visit(type, value[name], callback);
                return accum;
            }, {});
        }
        return logger$g.throwArgumentError(`unknown type: ${type}`, "type", type);
    }
    visit(value, callback) {
        return this._visit(this.primaryType, value, callback);
    }
    static from(types) {
        return new TypedDataEncoder(types);
    }
    static getPrimaryType(types) {
        return TypedDataEncoder.from(types).primaryType;
    }
    static hashStruct(name, types, value) {
        return TypedDataEncoder.from(types).hashStruct(name, value);
    }
    static hashDomain(domain) {
        const domainFields = [];
        for (const name in domain) {
            const type = domainFieldTypes[name];
            if (!type) {
                logger$g.throwArgumentError(`invalid typed-data domain key: ${JSON.stringify(name)}`, "domain", domain);
            }
            domainFields.push({ name, type });
        }
        domainFields.sort((a, b) => {
            return domainFieldNames.indexOf(a.name) - domainFieldNames.indexOf(b.name);
        });
        return TypedDataEncoder.hashStruct("EIP712Domain", { EIP712Domain: domainFields }, domain);
    }
    static encode(domain, types, value) {
        return hexConcat([
            "0x1901",
            TypedDataEncoder.hashDomain(domain),
            TypedDataEncoder.from(types).hash(value)
        ]);
    }
    static hash(domain, types, value) {
        return keccak256(TypedDataEncoder.encode(domain, types, value));
    }
    // Replaces all address types with ENS names with their looked up address
    static resolveNames(domain, types, value, resolveName) {
        return __awaiter$8(this, void 0, void 0, function* () {
            // Make a copy to isolate it from the object passed in
            domain = shallowCopy(domain);
            // Look up all ENS names
            const ensCache = {};
            // Do we need to look up the domain's verifyingContract?
            if (domain.verifyingContract && !isHexString(domain.verifyingContract, 20)) {
                ensCache[domain.verifyingContract] = "0x";
            }
            // We are going to use the encoder to visit all the base values
            const encoder = TypedDataEncoder.from(types);
            // Get a list of all the addresses
            encoder.visit(value, (type, value) => {
                if (type === "address" && !isHexString(value, 20)) {
                    ensCache[value] = "0x";
                }
                return value;
            });
            // Lookup each name
            for (const name in ensCache) {
                ensCache[name] = yield resolveName(name);
            }
            // Replace the domain verifyingContract if needed
            if (domain.verifyingContract && ensCache[domain.verifyingContract]) {
                domain.verifyingContract = ensCache[domain.verifyingContract];
            }
            // Replace all ENS names with their address
            value = encoder.visit(value, (type, value) => {
                if (type === "address" && ensCache[value]) {
                    return ensCache[value];
                }
                return value;
            });
            return { domain, value };
        });
    }
    static getPayload(domain, types, value) {
        // Validate the domain fields
        TypedDataEncoder.hashDomain(domain);
        // Derive the EIP712Domain Struct reference type
        const domainValues = {};
        const domainTypes = [];
        domainFieldNames.forEach((name) => {
            const value = domain[name];
            if (value == null) {
                return;
            }
            domainValues[name] = domainChecks[name](value);
            domainTypes.push({ name, type: domainFieldTypes[name] });
        });
        const encoder = TypedDataEncoder.from(types);
        const typesWithDomain = shallowCopy(types);
        if (typesWithDomain.EIP712Domain) {
            logger$g.throwArgumentError("types must not contain EIP712Domain type", "types.EIP712Domain", types);
        }
        else {
            typesWithDomain.EIP712Domain = domainTypes;
        }
        // Validate the data structures and types
        encoder.encode(value);
        return {
            types: typesWithDomain,
            domain: domainValues,
            primaryType: encoder.primaryType,
            message: encoder.visit(value, (type, value) => {
                // bytes
                if (type.match(/^bytes(\d*)/)) {
                    return hexlify(arrayify(value));
                }
                // uint or int
                if (type.match(/^u?int/)) {
                    return BigNumber.from(value).toString();
                }
                switch (type) {
                    case "address":
                        return value.toLowerCase();
                    case "bool":
                        return !!value;
                    case "string":
                        if (typeof (value) !== "string") {
                            logger$g.throwArgumentError(`invalid string`, "value", value);
                        }
                        return value;
                }
                return logger$g.throwArgumentError("unsupported type", "type", type);
            })
        };
    }
}

/**
 * var basex = require("base-x");
 *
 * This implementation is heavily based on base-x. The main reason to
 * deviate was to prevent the dependency of Buffer.
 *
 * Contributors:
 *
 * base-x encoding
 * Forked from https://github.com/cryptocoinjs/bs58
 * Originally written by Mike Hearn for BitcoinJ
 * Copyright (c) 2011 Google Inc
 * Ported to JavaScript by Stefan Thomas
 * Merged Buffer refactorings from base58-native by Stephen Pair
 * Copyright (c) 2013 BitPay Inc
 *
 * The MIT License (MIT)
 *
 * Copyright base-x contributors (c) 2016
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 *
 */
class BaseX {
    constructor(alphabet) {
        defineReadOnly$1(this, "alphabet", alphabet);
        defineReadOnly$1(this, "base", alphabet.length);
        defineReadOnly$1(this, "_alphabetMap", {});
        defineReadOnly$1(this, "_leader", alphabet.charAt(0));
        // pre-compute lookup table
        for (let i = 0; i < alphabet.length; i++) {
            this._alphabetMap[alphabet.charAt(i)] = i;
        }
    }
    encode(value) {
        let source = arrayify(value);
        if (source.length === 0) {
            return "";
        }
        let digits = [0];
        for (let i = 0; i < source.length; ++i) {
            let carry = source[i];
            for (let j = 0; j < digits.length; ++j) {
                carry += digits[j] << 8;
                digits[j] = carry % this.base;
                carry = (carry / this.base) | 0;
            }
            while (carry > 0) {
                digits.push(carry % this.base);
                carry = (carry / this.base) | 0;
            }
        }
        let string = "";
        // deal with leading zeros
        for (let k = 0; source[k] === 0 && k < source.length - 1; ++k) {
            string += this._leader;
        }
        // convert digits to a string
        for (let q = digits.length - 1; q >= 0; --q) {
            string += this.alphabet[digits[q]];
        }
        return string;
    }
    decode(value) {
        if (typeof (value) !== "string") {
            throw new TypeError("Expected String");
        }
        let bytes = [];
        if (value.length === 0) {
            return new Uint8Array(bytes);
        }
        bytes.push(0);
        for (let i = 0; i < value.length; i++) {
            let byte = this._alphabetMap[value[i]];
            if (byte === undefined) {
                throw new Error("Non-base" + this.base + " character");
            }
            let carry = byte;
            for (let j = 0; j < bytes.length; ++j) {
                carry += bytes[j] * this.base;
                bytes[j] = carry & 0xff;
                carry >>= 8;
            }
            while (carry > 0) {
                bytes.push(carry & 0xff);
                carry >>= 8;
            }
        }
        // deal with leading zeros
        for (let k = 0; value[k] === this._leader && k < value.length - 1; ++k) {
            bytes.push(0);
        }
        return arrayify(new Uint8Array(bytes.reverse()));
    }
}
new BaseX("abcdefghijklmnopqrstuvwxyz234567");
const Base58 = new BaseX("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
//console.log(Base58.decode("Qmd2V777o5XvJbYMeMb8k2nU5f8d3ciUQ5YpYuWhzv8iDj"))
//console.log(Base58.encode(Base58.decode("Qmd2V777o5XvJbYMeMb8k2nU5f8d3ciUQ5YpYuWhzv8iDj")))

var hash$1 = {};

var utils$9 = {};

var minimalisticAssert$1 = assert$b;

function assert$b(val, msg) {
  if (!val)
    throw new Error(msg || 'Assertion failed');
}

assert$b.equal = function assertEqual(l, r, msg) {
  if (l != r)
    throw new Error(msg || ('Assertion failed: ' + l + ' != ' + r));
};

var inherits$1 = {exports: {}};

var inherits_browser$1 = {exports: {}};

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  inherits_browser$1.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  // old school shim for old browsers
  inherits_browser$1.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}

try {
  var util = require('util');
  /* istanbul ignore next */
  if (typeof util.inherits !== 'function') throw '';
  inherits$1.exports = util.inherits;
} catch (e) {
  /* istanbul ignore next */
  inherits$1.exports = inherits_browser$1.exports;
}

var assert$a = minimalisticAssert$1;
var inherits = inherits$1.exports;

utils$9.inherits = inherits;

function isSurrogatePair(msg, i) {
  if ((msg.charCodeAt(i) & 0xFC00) !== 0xD800) {
    return false;
  }
  if (i < 0 || i + 1 >= msg.length) {
    return false;
  }
  return (msg.charCodeAt(i + 1) & 0xFC00) === 0xDC00;
}

function toArray(msg, enc) {
  if (Array.isArray(msg))
    return msg.slice();
  if (!msg)
    return [];
  var res = [];
  if (typeof msg === 'string') {
    if (!enc) {
      // Inspired by stringToUtf8ByteArray() in closure-library by Google
      // https://github.com/google/closure-library/blob/8598d87242af59aac233270742c8984e2b2bdbe0/closure/goog/crypt/crypt.js#L117-L143
      // Apache License 2.0
      // https://github.com/google/closure-library/blob/master/LICENSE
      var p = 0;
      for (var i = 0; i < msg.length; i++) {
        var c = msg.charCodeAt(i);
        if (c < 128) {
          res[p++] = c;
        } else if (c < 2048) {
          res[p++] = (c >> 6) | 192;
          res[p++] = (c & 63) | 128;
        } else if (isSurrogatePair(msg, i)) {
          c = 0x10000 + ((c & 0x03FF) << 10) + (msg.charCodeAt(++i) & 0x03FF);
          res[p++] = (c >> 18) | 240;
          res[p++] = ((c >> 12) & 63) | 128;
          res[p++] = ((c >> 6) & 63) | 128;
          res[p++] = (c & 63) | 128;
        } else {
          res[p++] = (c >> 12) | 224;
          res[p++] = ((c >> 6) & 63) | 128;
          res[p++] = (c & 63) | 128;
        }
      }
    } else if (enc === 'hex') {
      msg = msg.replace(/[^a-z0-9]+/ig, '');
      if (msg.length % 2 !== 0)
        msg = '0' + msg;
      for (i = 0; i < msg.length; i += 2)
        res.push(parseInt(msg[i] + msg[i + 1], 16));
    }
  } else {
    for (i = 0; i < msg.length; i++)
      res[i] = msg[i] | 0;
  }
  return res;
}
utils$9.toArray = toArray;

function toHex$1(msg) {
  var res = '';
  for (var i = 0; i < msg.length; i++)
    res += zero2(msg[i].toString(16));
  return res;
}
utils$9.toHex = toHex$1;

function htonl(w) {
  var res = (w >>> 24) |
            ((w >>> 8) & 0xff00) |
            ((w << 8) & 0xff0000) |
            ((w & 0xff) << 24);
  return res >>> 0;
}
utils$9.htonl = htonl;

function toHex32(msg, endian) {
  var res = '';
  for (var i = 0; i < msg.length; i++) {
    var w = msg[i];
    if (endian === 'little')
      w = htonl(w);
    res += zero8(w.toString(16));
  }
  return res;
}
utils$9.toHex32 = toHex32;

function zero2(word) {
  if (word.length === 1)
    return '0' + word;
  else
    return word;
}
utils$9.zero2 = zero2;

function zero8(word) {
  if (word.length === 7)
    return '0' + word;
  else if (word.length === 6)
    return '00' + word;
  else if (word.length === 5)
    return '000' + word;
  else if (word.length === 4)
    return '0000' + word;
  else if (word.length === 3)
    return '00000' + word;
  else if (word.length === 2)
    return '000000' + word;
  else if (word.length === 1)
    return '0000000' + word;
  else
    return word;
}
utils$9.zero8 = zero8;

function join32(msg, start, end, endian) {
  var len = end - start;
  assert$a(len % 4 === 0);
  var res = new Array(len / 4);
  for (var i = 0, k = start; i < res.length; i++, k += 4) {
    var w;
    if (endian === 'big')
      w = (msg[k] << 24) | (msg[k + 1] << 16) | (msg[k + 2] << 8) | msg[k + 3];
    else
      w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
    res[i] = w >>> 0;
  }
  return res;
}
utils$9.join32 = join32;

function split32(msg, endian) {
  var res = new Array(msg.length * 4);
  for (var i = 0, k = 0; i < msg.length; i++, k += 4) {
    var m = msg[i];
    if (endian === 'big') {
      res[k] = m >>> 24;
      res[k + 1] = (m >>> 16) & 0xff;
      res[k + 2] = (m >>> 8) & 0xff;
      res[k + 3] = m & 0xff;
    } else {
      res[k + 3] = m >>> 24;
      res[k + 2] = (m >>> 16) & 0xff;
      res[k + 1] = (m >>> 8) & 0xff;
      res[k] = m & 0xff;
    }
  }
  return res;
}
utils$9.split32 = split32;

function rotr32$1(w, b) {
  return (w >>> b) | (w << (32 - b));
}
utils$9.rotr32 = rotr32$1;

function rotl32$2(w, b) {
  return (w << b) | (w >>> (32 - b));
}
utils$9.rotl32 = rotl32$2;

function sum32$3(a, b) {
  return (a + b) >>> 0;
}
utils$9.sum32 = sum32$3;

function sum32_3$1(a, b, c) {
  return (a + b + c) >>> 0;
}
utils$9.sum32_3 = sum32_3$1;

function sum32_4$2(a, b, c, d) {
  return (a + b + c + d) >>> 0;
}
utils$9.sum32_4 = sum32_4$2;

function sum32_5$2(a, b, c, d, e) {
  return (a + b + c + d + e) >>> 0;
}
utils$9.sum32_5 = sum32_5$2;

function sum64$1(buf, pos, ah, al) {
  var bh = buf[pos];
  var bl = buf[pos + 1];

  var lo = (al + bl) >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  buf[pos] = hi >>> 0;
  buf[pos + 1] = lo;
}
utils$9.sum64 = sum64$1;

function sum64_hi$1(ah, al, bh, bl) {
  var lo = (al + bl) >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  return hi >>> 0;
}
utils$9.sum64_hi = sum64_hi$1;

function sum64_lo$1(ah, al, bh, bl) {
  var lo = al + bl;
  return lo >>> 0;
}
utils$9.sum64_lo = sum64_lo$1;

function sum64_4_hi$1(ah, al, bh, bl, ch, cl, dh, dl) {
  var carry = 0;
  var lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;

  var hi = ah + bh + ch + dh + carry;
  return hi >>> 0;
}
utils$9.sum64_4_hi = sum64_4_hi$1;

function sum64_4_lo$1(ah, al, bh, bl, ch, cl, dh, dl) {
  var lo = al + bl + cl + dl;
  return lo >>> 0;
}
utils$9.sum64_4_lo = sum64_4_lo$1;

function sum64_5_hi$1(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var carry = 0;
  var lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;
  lo = (lo + el) >>> 0;
  carry += lo < el ? 1 : 0;

  var hi = ah + bh + ch + dh + eh + carry;
  return hi >>> 0;
}
utils$9.sum64_5_hi = sum64_5_hi$1;

function sum64_5_lo$1(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var lo = al + bl + cl + dl + el;

  return lo >>> 0;
}
utils$9.sum64_5_lo = sum64_5_lo$1;

function rotr64_hi$1(ah, al, num) {
  var r = (al << (32 - num)) | (ah >>> num);
  return r >>> 0;
}
utils$9.rotr64_hi = rotr64_hi$1;

function rotr64_lo$1(ah, al, num) {
  var r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}
utils$9.rotr64_lo = rotr64_lo$1;

function shr64_hi$1(ah, al, num) {
  return ah >>> num;
}
utils$9.shr64_hi = shr64_hi$1;

function shr64_lo$1(ah, al, num) {
  var r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}
utils$9.shr64_lo = shr64_lo$1;

var common$5 = {};

var utils$8 = utils$9;
var assert$9 = minimalisticAssert$1;

function BlockHash$4() {
  this.pending = null;
  this.pendingTotal = 0;
  this.blockSize = this.constructor.blockSize;
  this.outSize = this.constructor.outSize;
  this.hmacStrength = this.constructor.hmacStrength;
  this.padLength = this.constructor.padLength / 8;
  this.endian = 'big';

  this._delta8 = this.blockSize / 8;
  this._delta32 = this.blockSize / 32;
}
common$5.BlockHash = BlockHash$4;

BlockHash$4.prototype.update = function update(msg, enc) {
  // Convert message to array, pad it, and join into 32bit blocks
  msg = utils$8.toArray(msg, enc);
  if (!this.pending)
    this.pending = msg;
  else
    this.pending = this.pending.concat(msg);
  this.pendingTotal += msg.length;

  // Enough data, try updating
  if (this.pending.length >= this._delta8) {
    msg = this.pending;

    // Process pending data in blocks
    var r = msg.length % this._delta8;
    this.pending = msg.slice(msg.length - r, msg.length);
    if (this.pending.length === 0)
      this.pending = null;

    msg = utils$8.join32(msg, 0, msg.length - r, this.endian);
    for (var i = 0; i < msg.length; i += this._delta32)
      this._update(msg, i, i + this._delta32);
  }

  return this;
};

BlockHash$4.prototype.digest = function digest(enc) {
  this.update(this._pad());
  assert$9(this.pending === null);

  return this._digest(enc);
};

BlockHash$4.prototype._pad = function pad() {
  var len = this.pendingTotal;
  var bytes = this._delta8;
  var k = bytes - ((len + this.padLength) % bytes);
  var res = new Array(k + this.padLength);
  res[0] = 0x80;
  for (var i = 1; i < k; i++)
    res[i] = 0;

  // Append length
  len <<= 3;
  if (this.endian === 'big') {
    for (var t = 8; t < this.padLength; t++)
      res[i++] = 0;

    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = (len >>> 24) & 0xff;
    res[i++] = (len >>> 16) & 0xff;
    res[i++] = (len >>> 8) & 0xff;
    res[i++] = len & 0xff;
  } else {
    res[i++] = len & 0xff;
    res[i++] = (len >>> 8) & 0xff;
    res[i++] = (len >>> 16) & 0xff;
    res[i++] = (len >>> 24) & 0xff;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;

    for (t = 8; t < this.padLength; t++)
      res[i++] = 0;
  }

  return res;
};

var sha = {};

var common$4 = {};

var utils$7 = utils$9;
var rotr32 = utils$7.rotr32;

function ft_1$1(s, x, y, z) {
  if (s === 0)
    return ch32$1(x, y, z);
  if (s === 1 || s === 3)
    return p32(x, y, z);
  if (s === 2)
    return maj32$1(x, y, z);
}
common$4.ft_1 = ft_1$1;

function ch32$1(x, y, z) {
  return (x & y) ^ ((~x) & z);
}
common$4.ch32 = ch32$1;

function maj32$1(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z);
}
common$4.maj32 = maj32$1;

function p32(x, y, z) {
  return x ^ y ^ z;
}
common$4.p32 = p32;

function s0_256$1(x) {
  return rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22);
}
common$4.s0_256 = s0_256$1;

function s1_256$1(x) {
  return rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25);
}
common$4.s1_256 = s1_256$1;

function g0_256$1(x) {
  return rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3);
}
common$4.g0_256 = g0_256$1;

function g1_256$1(x) {
  return rotr32(x, 17) ^ rotr32(x, 19) ^ (x >>> 10);
}
common$4.g1_256 = g1_256$1;

var utils$6 = utils$9;
var common$3 = common$5;
var shaCommon$1 = common$4;

var rotl32$1 = utils$6.rotl32;
var sum32$2 = utils$6.sum32;
var sum32_5$1 = utils$6.sum32_5;
var ft_1 = shaCommon$1.ft_1;
var BlockHash$3 = common$3.BlockHash;

var sha1_K = [
  0x5A827999, 0x6ED9EBA1,
  0x8F1BBCDC, 0xCA62C1D6
];

function SHA1() {
  if (!(this instanceof SHA1))
    return new SHA1();

  BlockHash$3.call(this);
  this.h = [
    0x67452301, 0xefcdab89, 0x98badcfe,
    0x10325476, 0xc3d2e1f0 ];
  this.W = new Array(80);
}

utils$6.inherits(SHA1, BlockHash$3);
var _1 = SHA1;

SHA1.blockSize = 512;
SHA1.outSize = 160;
SHA1.hmacStrength = 80;
SHA1.padLength = 64;

SHA1.prototype._update = function _update(msg, start) {
  var W = this.W;

  for (var i = 0; i < 16; i++)
    W[i] = msg[start + i];

  for(; i < W.length; i++)
    W[i] = rotl32$1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

  var a = this.h[0];
  var b = this.h[1];
  var c = this.h[2];
  var d = this.h[3];
  var e = this.h[4];

  for (i = 0; i < W.length; i++) {
    var s = ~~(i / 20);
    var t = sum32_5$1(rotl32$1(a, 5), ft_1(s, b, c, d), e, W[i], sha1_K[s]);
    e = d;
    d = c;
    c = rotl32$1(b, 30);
    b = a;
    a = t;
  }

  this.h[0] = sum32$2(this.h[0], a);
  this.h[1] = sum32$2(this.h[1], b);
  this.h[2] = sum32$2(this.h[2], c);
  this.h[3] = sum32$2(this.h[3], d);
  this.h[4] = sum32$2(this.h[4], e);
};

SHA1.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils$6.toHex32(this.h, 'big');
  else
    return utils$6.split32(this.h, 'big');
};

var utils$5 = utils$9;
var common$2 = common$5;
var shaCommon = common$4;
var assert$8 = minimalisticAssert$1;

var sum32$1 = utils$5.sum32;
var sum32_4$1 = utils$5.sum32_4;
var sum32_5 = utils$5.sum32_5;
var ch32 = shaCommon.ch32;
var maj32 = shaCommon.maj32;
var s0_256 = shaCommon.s0_256;
var s1_256 = shaCommon.s1_256;
var g0_256 = shaCommon.g0_256;
var g1_256 = shaCommon.g1_256;

var BlockHash$2 = common$2.BlockHash;

var sha256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function SHA256$1() {
  if (!(this instanceof SHA256$1))
    return new SHA256$1();

  BlockHash$2.call(this);
  this.h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  this.k = sha256_K;
  this.W = new Array(64);
}
utils$5.inherits(SHA256$1, BlockHash$2);
var _256 = SHA256$1;

SHA256$1.blockSize = 512;
SHA256$1.outSize = 256;
SHA256$1.hmacStrength = 192;
SHA256$1.padLength = 64;

SHA256$1.prototype._update = function _update(msg, start) {
  var W = this.W;

  for (var i = 0; i < 16; i++)
    W[i] = msg[start + i];
  for (; i < W.length; i++)
    W[i] = sum32_4$1(g1_256(W[i - 2]), W[i - 7], g0_256(W[i - 15]), W[i - 16]);

  var a = this.h[0];
  var b = this.h[1];
  var c = this.h[2];
  var d = this.h[3];
  var e = this.h[4];
  var f = this.h[5];
  var g = this.h[6];
  var h = this.h[7];

  assert$8(this.k.length === W.length);
  for (i = 0; i < W.length; i++) {
    var T1 = sum32_5(h, s1_256(e), ch32(e, f, g), this.k[i], W[i]);
    var T2 = sum32$1(s0_256(a), maj32(a, b, c));
    h = g;
    g = f;
    f = e;
    e = sum32$1(d, T1);
    d = c;
    c = b;
    b = a;
    a = sum32$1(T1, T2);
  }

  this.h[0] = sum32$1(this.h[0], a);
  this.h[1] = sum32$1(this.h[1], b);
  this.h[2] = sum32$1(this.h[2], c);
  this.h[3] = sum32$1(this.h[3], d);
  this.h[4] = sum32$1(this.h[4], e);
  this.h[5] = sum32$1(this.h[5], f);
  this.h[6] = sum32$1(this.h[6], g);
  this.h[7] = sum32$1(this.h[7], h);
};

SHA256$1.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils$5.toHex32(this.h, 'big');
  else
    return utils$5.split32(this.h, 'big');
};

var utils$4 = utils$9;
var SHA256 = _256;

function SHA224() {
  if (!(this instanceof SHA224))
    return new SHA224();

  SHA256.call(this);
  this.h = [
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
    0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4 ];
}
utils$4.inherits(SHA224, SHA256);
var _224 = SHA224;

SHA224.blockSize = 512;
SHA224.outSize = 224;
SHA224.hmacStrength = 192;
SHA224.padLength = 64;

SHA224.prototype._digest = function digest(enc) {
  // Just truncate output
  if (enc === 'hex')
    return utils$4.toHex32(this.h.slice(0, 7), 'big');
  else
    return utils$4.split32(this.h.slice(0, 7), 'big');
};

var utils$3 = utils$9;
var common$1 = common$5;
var assert$7 = minimalisticAssert$1;

var rotr64_hi = utils$3.rotr64_hi;
var rotr64_lo = utils$3.rotr64_lo;
var shr64_hi = utils$3.shr64_hi;
var shr64_lo = utils$3.shr64_lo;
var sum64 = utils$3.sum64;
var sum64_hi = utils$3.sum64_hi;
var sum64_lo = utils$3.sum64_lo;
var sum64_4_hi = utils$3.sum64_4_hi;
var sum64_4_lo = utils$3.sum64_4_lo;
var sum64_5_hi = utils$3.sum64_5_hi;
var sum64_5_lo = utils$3.sum64_5_lo;

var BlockHash$1 = common$1.BlockHash;

var sha512_K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
];

function SHA512$1() {
  if (!(this instanceof SHA512$1))
    return new SHA512$1();

  BlockHash$1.call(this);
  this.h = [
    0x6a09e667, 0xf3bcc908,
    0xbb67ae85, 0x84caa73b,
    0x3c6ef372, 0xfe94f82b,
    0xa54ff53a, 0x5f1d36f1,
    0x510e527f, 0xade682d1,
    0x9b05688c, 0x2b3e6c1f,
    0x1f83d9ab, 0xfb41bd6b,
    0x5be0cd19, 0x137e2179 ];
  this.k = sha512_K;
  this.W = new Array(160);
}
utils$3.inherits(SHA512$1, BlockHash$1);
var _512 = SHA512$1;

SHA512$1.blockSize = 1024;
SHA512$1.outSize = 512;
SHA512$1.hmacStrength = 192;
SHA512$1.padLength = 128;

SHA512$1.prototype._prepareBlock = function _prepareBlock(msg, start) {
  var W = this.W;

  // 32 x 32bit words
  for (var i = 0; i < 32; i++)
    W[i] = msg[start + i];
  for (; i < W.length; i += 2) {
    var c0_hi = g1_512_hi(W[i - 4], W[i - 3]);  // i - 2
    var c0_lo = g1_512_lo(W[i - 4], W[i - 3]);
    var c1_hi = W[i - 14];  // i - 7
    var c1_lo = W[i - 13];
    var c2_hi = g0_512_hi(W[i - 30], W[i - 29]);  // i - 15
    var c2_lo = g0_512_lo(W[i - 30], W[i - 29]);
    var c3_hi = W[i - 32];  // i - 16
    var c3_lo = W[i - 31];

    W[i] = sum64_4_hi(
      c0_hi, c0_lo,
      c1_hi, c1_lo,
      c2_hi, c2_lo,
      c3_hi, c3_lo);
    W[i + 1] = sum64_4_lo(
      c0_hi, c0_lo,
      c1_hi, c1_lo,
      c2_hi, c2_lo,
      c3_hi, c3_lo);
  }
};

SHA512$1.prototype._update = function _update(msg, start) {
  this._prepareBlock(msg, start);

  var W = this.W;

  var ah = this.h[0];
  var al = this.h[1];
  var bh = this.h[2];
  var bl = this.h[3];
  var ch = this.h[4];
  var cl = this.h[5];
  var dh = this.h[6];
  var dl = this.h[7];
  var eh = this.h[8];
  var el = this.h[9];
  var fh = this.h[10];
  var fl = this.h[11];
  var gh = this.h[12];
  var gl = this.h[13];
  var hh = this.h[14];
  var hl = this.h[15];

  assert$7(this.k.length === W.length);
  for (var i = 0; i < W.length; i += 2) {
    var c0_hi = hh;
    var c0_lo = hl;
    var c1_hi = s1_512_hi(eh, el);
    var c1_lo = s1_512_lo(eh, el);
    var c2_hi = ch64_hi(eh, el, fh, fl, gh);
    var c2_lo = ch64_lo(eh, el, fh, fl, gh, gl);
    var c3_hi = this.k[i];
    var c3_lo = this.k[i + 1];
    var c4_hi = W[i];
    var c4_lo = W[i + 1];

    var T1_hi = sum64_5_hi(
      c0_hi, c0_lo,
      c1_hi, c1_lo,
      c2_hi, c2_lo,
      c3_hi, c3_lo,
      c4_hi, c4_lo);
    var T1_lo = sum64_5_lo(
      c0_hi, c0_lo,
      c1_hi, c1_lo,
      c2_hi, c2_lo,
      c3_hi, c3_lo,
      c4_hi, c4_lo);

    c0_hi = s0_512_hi(ah, al);
    c0_lo = s0_512_lo(ah, al);
    c1_hi = maj64_hi(ah, al, bh, bl, ch);
    c1_lo = maj64_lo(ah, al, bh, bl, ch, cl);

    var T2_hi = sum64_hi(c0_hi, c0_lo, c1_hi, c1_lo);
    var T2_lo = sum64_lo(c0_hi, c0_lo, c1_hi, c1_lo);

    hh = gh;
    hl = gl;

    gh = fh;
    gl = fl;

    fh = eh;
    fl = el;

    eh = sum64_hi(dh, dl, T1_hi, T1_lo);
    el = sum64_lo(dl, dl, T1_hi, T1_lo);

    dh = ch;
    dl = cl;

    ch = bh;
    cl = bl;

    bh = ah;
    bl = al;

    ah = sum64_hi(T1_hi, T1_lo, T2_hi, T2_lo);
    al = sum64_lo(T1_hi, T1_lo, T2_hi, T2_lo);
  }

  sum64(this.h, 0, ah, al);
  sum64(this.h, 2, bh, bl);
  sum64(this.h, 4, ch, cl);
  sum64(this.h, 6, dh, dl);
  sum64(this.h, 8, eh, el);
  sum64(this.h, 10, fh, fl);
  sum64(this.h, 12, gh, gl);
  sum64(this.h, 14, hh, hl);
};

SHA512$1.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils$3.toHex32(this.h, 'big');
  else
    return utils$3.split32(this.h, 'big');
};

function ch64_hi(xh, xl, yh, yl, zh) {
  var r = (xh & yh) ^ ((~xh) & zh);
  if (r < 0)
    r += 0x100000000;
  return r;
}

function ch64_lo(xh, xl, yh, yl, zh, zl) {
  var r = (xl & yl) ^ ((~xl) & zl);
  if (r < 0)
    r += 0x100000000;
  return r;
}

function maj64_hi(xh, xl, yh, yl, zh) {
  var r = (xh & yh) ^ (xh & zh) ^ (yh & zh);
  if (r < 0)
    r += 0x100000000;
  return r;
}

function maj64_lo(xh, xl, yh, yl, zh, zl) {
  var r = (xl & yl) ^ (xl & zl) ^ (yl & zl);
  if (r < 0)
    r += 0x100000000;
  return r;
}

function s0_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 28);
  var c1_hi = rotr64_hi(xl, xh, 2);  // 34
  var c2_hi = rotr64_hi(xl, xh, 7);  // 39

  var r = c0_hi ^ c1_hi ^ c2_hi;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function s0_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 28);
  var c1_lo = rotr64_lo(xl, xh, 2);  // 34
  var c2_lo = rotr64_lo(xl, xh, 7);  // 39

  var r = c0_lo ^ c1_lo ^ c2_lo;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function s1_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 14);
  var c1_hi = rotr64_hi(xh, xl, 18);
  var c2_hi = rotr64_hi(xl, xh, 9);  // 41

  var r = c0_hi ^ c1_hi ^ c2_hi;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function s1_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 14);
  var c1_lo = rotr64_lo(xh, xl, 18);
  var c2_lo = rotr64_lo(xl, xh, 9);  // 41

  var r = c0_lo ^ c1_lo ^ c2_lo;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function g0_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 1);
  var c1_hi = rotr64_hi(xh, xl, 8);
  var c2_hi = shr64_hi(xh, xl, 7);

  var r = c0_hi ^ c1_hi ^ c2_hi;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function g0_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 1);
  var c1_lo = rotr64_lo(xh, xl, 8);
  var c2_lo = shr64_lo(xh, xl, 7);

  var r = c0_lo ^ c1_lo ^ c2_lo;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function g1_512_hi(xh, xl) {
  var c0_hi = rotr64_hi(xh, xl, 19);
  var c1_hi = rotr64_hi(xl, xh, 29);  // 61
  var c2_hi = shr64_hi(xh, xl, 6);

  var r = c0_hi ^ c1_hi ^ c2_hi;
  if (r < 0)
    r += 0x100000000;
  return r;
}

function g1_512_lo(xh, xl) {
  var c0_lo = rotr64_lo(xh, xl, 19);
  var c1_lo = rotr64_lo(xl, xh, 29);  // 61
  var c2_lo = shr64_lo(xh, xl, 6);

  var r = c0_lo ^ c1_lo ^ c2_lo;
  if (r < 0)
    r += 0x100000000;
  return r;
}

var utils$2 = utils$9;

var SHA512 = _512;

function SHA384() {
  if (!(this instanceof SHA384))
    return new SHA384();

  SHA512.call(this);
  this.h = [
    0xcbbb9d5d, 0xc1059ed8,
    0x629a292a, 0x367cd507,
    0x9159015a, 0x3070dd17,
    0x152fecd8, 0xf70e5939,
    0x67332667, 0xffc00b31,
    0x8eb44a87, 0x68581511,
    0xdb0c2e0d, 0x64f98fa7,
    0x47b5481d, 0xbefa4fa4 ];
}
utils$2.inherits(SHA384, SHA512);
var _384 = SHA384;

SHA384.blockSize = 1024;
SHA384.outSize = 384;
SHA384.hmacStrength = 192;
SHA384.padLength = 128;

SHA384.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils$2.toHex32(this.h.slice(0, 12), 'big');
  else
    return utils$2.split32(this.h.slice(0, 12), 'big');
};

sha.sha1 = _1;
sha.sha224 = _224;
sha.sha256 = _256;
sha.sha384 = _384;
sha.sha512 = _512;

var ripemd = {};

var utils$1 = utils$9;
var common = common$5;

var rotl32 = utils$1.rotl32;
var sum32 = utils$1.sum32;
var sum32_3 = utils$1.sum32_3;
var sum32_4 = utils$1.sum32_4;
var BlockHash = common.BlockHash;

function RIPEMD160() {
  if (!(this instanceof RIPEMD160))
    return new RIPEMD160();

  BlockHash.call(this);

  this.h = [ 0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0 ];
  this.endian = 'little';
}
utils$1.inherits(RIPEMD160, BlockHash);
ripemd.ripemd160 = RIPEMD160;

RIPEMD160.blockSize = 512;
RIPEMD160.outSize = 160;
RIPEMD160.hmacStrength = 192;
RIPEMD160.padLength = 64;

RIPEMD160.prototype._update = function update(msg, start) {
  var A = this.h[0];
  var B = this.h[1];
  var C = this.h[2];
  var D = this.h[3];
  var E = this.h[4];
  var Ah = A;
  var Bh = B;
  var Ch = C;
  var Dh = D;
  var Eh = E;
  for (var j = 0; j < 80; j++) {
    var T = sum32(
      rotl32(
        sum32_4(A, f(j, B, C, D), msg[r[j] + start], K(j)),
        s[j]),
      E);
    A = E;
    E = D;
    D = rotl32(C, 10);
    C = B;
    B = T;
    T = sum32(
      rotl32(
        sum32_4(Ah, f(79 - j, Bh, Ch, Dh), msg[rh[j] + start], Kh(j)),
        sh[j]),
      Eh);
    Ah = Eh;
    Eh = Dh;
    Dh = rotl32(Ch, 10);
    Ch = Bh;
    Bh = T;
  }
  T = sum32_3(this.h[1], C, Dh);
  this.h[1] = sum32_3(this.h[2], D, Eh);
  this.h[2] = sum32_3(this.h[3], E, Ah);
  this.h[3] = sum32_3(this.h[4], A, Bh);
  this.h[4] = sum32_3(this.h[0], B, Ch);
  this.h[0] = T;
};

RIPEMD160.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils$1.toHex32(this.h, 'little');
  else
    return utils$1.split32(this.h, 'little');
};

function f(j, x, y, z) {
  if (j <= 15)
    return x ^ y ^ z;
  else if (j <= 31)
    return (x & y) | ((~x) & z);
  else if (j <= 47)
    return (x | (~y)) ^ z;
  else if (j <= 63)
    return (x & z) | (y & (~z));
  else
    return x ^ (y | (~z));
}

function K(j) {
  if (j <= 15)
    return 0x00000000;
  else if (j <= 31)
    return 0x5a827999;
  else if (j <= 47)
    return 0x6ed9eba1;
  else if (j <= 63)
    return 0x8f1bbcdc;
  else
    return 0xa953fd4e;
}

function Kh(j) {
  if (j <= 15)
    return 0x50a28be6;
  else if (j <= 31)
    return 0x5c4dd124;
  else if (j <= 47)
    return 0x6d703ef3;
  else if (j <= 63)
    return 0x7a6d76e9;
  else
    return 0x00000000;
}

var r = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
];

var rh = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
];

var s = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
];

var sh = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
];

var utils = utils$9;
var assert$6 = minimalisticAssert$1;

function Hmac(hash, key, enc) {
  if (!(this instanceof Hmac))
    return new Hmac(hash, key, enc);
  this.Hash = hash;
  this.blockSize = hash.blockSize / 8;
  this.outSize = hash.outSize / 8;
  this.inner = null;
  this.outer = null;

  this._init(utils.toArray(key, enc));
}
var hmac = Hmac;

Hmac.prototype._init = function init(key) {
  // Shorten key, if needed
  if (key.length > this.blockSize)
    key = new this.Hash().update(key).digest();
  assert$6(key.length <= this.blockSize);

  // Add padding to key
  for (var i = key.length; i < this.blockSize; i++)
    key.push(0);

  for (i = 0; i < key.length; i++)
    key[i] ^= 0x36;
  this.inner = new this.Hash().update(key);

  // 0x36 ^ 0x5c = 0x6a
  for (i = 0; i < key.length; i++)
    key[i] ^= 0x6a;
  this.outer = new this.Hash().update(key);
};

Hmac.prototype.update = function update(msg, enc) {
  this.inner.update(msg, enc);
  return this;
};

Hmac.prototype.digest = function digest(enc) {
  this.outer.update(this.inner.digest());
  return this.outer.digest(enc);
};

(function (exports) {
var hash = exports;

hash.utils = utils$9;
hash.common = common$5;
hash.sha = sha;
hash.ripemd = ripemd;
hash.hmac = hmac;

// Proxy hash functions to the main object
hash.sha1 = hash.sha.sha1;
hash.sha256 = hash.sha.sha256;
hash.sha224 = hash.sha.sha224;
hash.sha384 = hash.sha.sha384;
hash.sha512 = hash.sha.sha512;
hash.ripemd160 = hash.ripemd.ripemd160;
}(hash$1));

var hash = hash$1;

var SupportedAlgorithm;
(function (SupportedAlgorithm) {
    SupportedAlgorithm["sha256"] = "sha256";
    SupportedAlgorithm["sha512"] = "sha512";
})(SupportedAlgorithm || (SupportedAlgorithm = {}));

const version$c = "sha2/5.7.0";

const logger$f = new Logger$2(version$c);
function ripemd160(data) {
    return "0x" + (hash.ripemd160().update(arrayify(data)).digest("hex"));
}
function sha256(data) {
    return "0x" + (hash.sha256().update(arrayify(data)).digest("hex"));
}
function computeHmac(algorithm, key, data) {
    if (!SupportedAlgorithm[algorithm]) {
        logger$f.throwError("unsupported algorithm " + algorithm, Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "hmac",
            algorithm: algorithm
        });
    }
    return "0x" + hash.hmac(hash[algorithm], arrayify(key)).update(arrayify(data)).digest("hex");
}

function pbkdf2$1(password, salt, iterations, keylen, hashAlgorithm) {
    password = arrayify(password);
    salt = arrayify(salt);
    let hLen;
    let l = 1;
    const DK = new Uint8Array(keylen);
    const block1 = new Uint8Array(salt.length + 4);
    block1.set(salt);
    //salt.copy(block1, 0, 0, salt.length)
    let r;
    let T;
    for (let i = 1; i <= l; i++) {
        //block1.writeUInt32BE(i, salt.length)
        block1[salt.length] = (i >> 24) & 0xff;
        block1[salt.length + 1] = (i >> 16) & 0xff;
        block1[salt.length + 2] = (i >> 8) & 0xff;
        block1[salt.length + 3] = i & 0xff;
        //let U = createHmac(password).update(block1).digest();
        let U = arrayify(computeHmac(hashAlgorithm, password, block1));
        if (!hLen) {
            hLen = U.length;
            T = new Uint8Array(hLen);
            l = Math.ceil(keylen / hLen);
            r = keylen - (l - 1) * hLen;
        }
        //U.copy(T, 0, 0, hLen)
        T.set(U);
        for (let j = 1; j < iterations; j++) {
            //U = createHmac(password).update(U).digest();
            U = arrayify(computeHmac(hashAlgorithm, password, U));
            for (let k = 0; k < hLen; k++)
                T[k] ^= U[k];
        }
        const destPos = (i - 1) * hLen;
        const len = (i === l ? r : hLen);
        //T.copy(DK, destPos, 0, len)
        DK.set(arrayify(T).slice(0, len), destPos);
    }
    return hexlify(DK);
}

function createCommonjsModule(fn, basedir, module) {
	return module = {
		path: basedir,
		exports: {},
		require: function (path, base) {
			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
		}
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var minimalisticAssert = assert;

function assert(val, msg) {
  if (!val)
    throw new Error(msg || 'Assertion failed');
}

assert.equal = function assertEqual(l, r, msg) {
  if (l != r)
    throw new Error(msg || ('Assertion failed: ' + l + ' != ' + r));
};

var utils_1 = createCommonjsModule(function (module, exports) {

var utils = exports;

function toArray(msg, enc) {
  if (Array.isArray(msg))
    return msg.slice();
  if (!msg)
    return [];
  var res = [];
  if (typeof msg !== 'string') {
    for (var i = 0; i < msg.length; i++)
      res[i] = msg[i] | 0;
    return res;
  }
  if (enc === 'hex') {
    msg = msg.replace(/[^a-z0-9]+/ig, '');
    if (msg.length % 2 !== 0)
      msg = '0' + msg;
    for (var i = 0; i < msg.length; i += 2)
      res.push(parseInt(msg[i] + msg[i + 1], 16));
  } else {
    for (var i = 0; i < msg.length; i++) {
      var c = msg.charCodeAt(i);
      var hi = c >> 8;
      var lo = c & 0xff;
      if (hi)
        res.push(hi, lo);
      else
        res.push(lo);
    }
  }
  return res;
}
utils.toArray = toArray;

function zero2(word) {
  if (word.length === 1)
    return '0' + word;
  else
    return word;
}
utils.zero2 = zero2;

function toHex(msg) {
  var res = '';
  for (var i = 0; i < msg.length; i++)
    res += zero2(msg[i].toString(16));
  return res;
}
utils.toHex = toHex;

utils.encode = function encode(arr, enc) {
  if (enc === 'hex')
    return toHex(arr);
  else
    return arr;
};
});

var utils_1$1 = createCommonjsModule(function (module, exports) {

var utils = exports;




utils.assert = minimalisticAssert;
utils.toArray = utils_1.toArray;
utils.zero2 = utils_1.zero2;
utils.toHex = utils_1.toHex;
utils.encode = utils_1.encode;

// Represent num in a w-NAF form
function getNAF(num, w, bits) {
  var naf = new Array(Math.max(num.bitLength(), bits) + 1);
  naf.fill(0);

  var ws = 1 << (w + 1);
  var k = num.clone();

  for (var i = 0; i < naf.length; i++) {
    var z;
    var mod = k.andln(ws - 1);
    if (k.isOdd()) {
      if (mod > (ws >> 1) - 1)
        z = (ws >> 1) - mod;
      else
        z = mod;
      k.isubn(z);
    } else {
      z = 0;
    }

    naf[i] = z;
    k.iushrn(1);
  }

  return naf;
}
utils.getNAF = getNAF;

// Represent k1, k2 in a Joint Sparse Form
function getJSF(k1, k2) {
  var jsf = [
    [],
    [],
  ];

  k1 = k1.clone();
  k2 = k2.clone();
  var d1 = 0;
  var d2 = 0;
  var m8;
  while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {
    // First phase
    var m14 = (k1.andln(3) + d1) & 3;
    var m24 = (k2.andln(3) + d2) & 3;
    if (m14 === 3)
      m14 = -1;
    if (m24 === 3)
      m24 = -1;
    var u1;
    if ((m14 & 1) === 0) {
      u1 = 0;
    } else {
      m8 = (k1.andln(7) + d1) & 7;
      if ((m8 === 3 || m8 === 5) && m24 === 2)
        u1 = -m14;
      else
        u1 = m14;
    }
    jsf[0].push(u1);

    var u2;
    if ((m24 & 1) === 0) {
      u2 = 0;
    } else {
      m8 = (k2.andln(7) + d2) & 7;
      if ((m8 === 3 || m8 === 5) && m14 === 2)
        u2 = -m24;
      else
        u2 = m24;
    }
    jsf[1].push(u2);

    // Second phase
    if (2 * d1 === u1 + 1)
      d1 = 1 - d1;
    if (2 * d2 === u2 + 1)
      d2 = 1 - d2;
    k1.iushrn(1);
    k2.iushrn(1);
  }

  return jsf;
}
utils.getJSF = getJSF;

function cachedProperty(obj, name, computer) {
  var key = '_' + name;
  obj.prototype[name] = function cachedProperty() {
    return this[key] !== undefined ? this[key] :
      this[key] = computer.call(this);
  };
}
utils.cachedProperty = cachedProperty;

function parseBytes(bytes) {
  return typeof bytes === 'string' ? utils.toArray(bytes, 'hex') :
    bytes;
}
utils.parseBytes = parseBytes;

function intFromLE(bytes) {
  return new BN$1(bytes, 'hex', 'le');
}
utils.intFromLE = intFromLE;
});



var getNAF = utils_1$1.getNAF;
var getJSF = utils_1$1.getJSF;
var assert$1 = utils_1$1.assert;

function BaseCurve(type, conf) {
  this.type = type;
  this.p = new BN$1(conf.p, 16);

  // Use Montgomery, when there is no fast reduction for the prime
  this.red = conf.prime ? BN$1.red(conf.prime) : BN$1.mont(this.p);

  // Useful for many curves
  this.zero = new BN$1(0).toRed(this.red);
  this.one = new BN$1(1).toRed(this.red);
  this.two = new BN$1(2).toRed(this.red);

  // Curve configuration, optional
  this.n = conf.n && new BN$1(conf.n, 16);
  this.g = conf.g && this.pointFromJSON(conf.g, conf.gRed);

  // Temporary arrays
  this._wnafT1 = new Array(4);
  this._wnafT2 = new Array(4);
  this._wnafT3 = new Array(4);
  this._wnafT4 = new Array(4);

  this._bitLength = this.n ? this.n.bitLength() : 0;

  // Generalized Greg Maxwell's trick
  var adjustCount = this.n && this.p.div(this.n);
  if (!adjustCount || adjustCount.cmpn(100) > 0) {
    this.redN = null;
  } else {
    this._maxwellTrick = true;
    this.redN = this.n.toRed(this.red);
  }
}
var base = BaseCurve;

BaseCurve.prototype.point = function point() {
  throw new Error('Not implemented');
};

BaseCurve.prototype.validate = function validate() {
  throw new Error('Not implemented');
};

BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p, k) {
  assert$1(p.precomputed);
  var doubles = p._getDoubles();

  var naf = getNAF(k, 1, this._bitLength);
  var I = (1 << (doubles.step + 1)) - (doubles.step % 2 === 0 ? 2 : 1);
  I /= 3;

  // Translate into more windowed form
  var repr = [];
  var j;
  var nafW;
  for (j = 0; j < naf.length; j += doubles.step) {
    nafW = 0;
    for (var l = j + doubles.step - 1; l >= j; l--)
      nafW = (nafW << 1) + naf[l];
    repr.push(nafW);
  }

  var a = this.jpoint(null, null, null);
  var b = this.jpoint(null, null, null);
  for (var i = I; i > 0; i--) {
    for (j = 0; j < repr.length; j++) {
      nafW = repr[j];
      if (nafW === i)
        b = b.mixedAdd(doubles.points[j]);
      else if (nafW === -i)
        b = b.mixedAdd(doubles.points[j].neg());
    }
    a = a.add(b);
  }
  return a.toP();
};

BaseCurve.prototype._wnafMul = function _wnafMul(p, k) {
  var w = 4;

  // Precompute window
  var nafPoints = p._getNAFPoints(w);
  w = nafPoints.wnd;
  var wnd = nafPoints.points;

  // Get NAF form
  var naf = getNAF(k, w, this._bitLength);

  // Add `this`*(N+1) for every w-NAF index
  var acc = this.jpoint(null, null, null);
  for (var i = naf.length - 1; i >= 0; i--) {
    // Count zeroes
    for (var l = 0; i >= 0 && naf[i] === 0; i--)
      l++;
    if (i >= 0)
      l++;
    acc = acc.dblp(l);

    if (i < 0)
      break;
    var z = naf[i];
    assert$1(z !== 0);
    if (p.type === 'affine') {
      // J +- P
      if (z > 0)
        acc = acc.mixedAdd(wnd[(z - 1) >> 1]);
      else
        acc = acc.mixedAdd(wnd[(-z - 1) >> 1].neg());
    } else {
      // J +- J
      if (z > 0)
        acc = acc.add(wnd[(z - 1) >> 1]);
      else
        acc = acc.add(wnd[(-z - 1) >> 1].neg());
    }
  }
  return p.type === 'affine' ? acc.toP() : acc;
};

BaseCurve.prototype._wnafMulAdd = function _wnafMulAdd(defW,
  points,
  coeffs,
  len,
  jacobianResult) {
  var wndWidth = this._wnafT1;
  var wnd = this._wnafT2;
  var naf = this._wnafT3;

  // Fill all arrays
  var max = 0;
  var i;
  var j;
  var p;
  for (i = 0; i < len; i++) {
    p = points[i];
    var nafPoints = p._getNAFPoints(defW);
    wndWidth[i] = nafPoints.wnd;
    wnd[i] = nafPoints.points;
  }

  // Comb small window NAFs
  for (i = len - 1; i >= 1; i -= 2) {
    var a = i - 1;
    var b = i;
    if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
      naf[a] = getNAF(coeffs[a], wndWidth[a], this._bitLength);
      naf[b] = getNAF(coeffs[b], wndWidth[b], this._bitLength);
      max = Math.max(naf[a].length, max);
      max = Math.max(naf[b].length, max);
      continue;
    }

    var comb = [
      points[a], /* 1 */
      null, /* 3 */
      null, /* 5 */
      points[b], /* 7 */
    ];

    // Try to avoid Projective points, if possible
    if (points[a].y.cmp(points[b].y) === 0) {
      comb[1] = points[a].add(points[b]);
      comb[2] = points[a].toJ().mixedAdd(points[b].neg());
    } else if (points[a].y.cmp(points[b].y.redNeg()) === 0) {
      comb[1] = points[a].toJ().mixedAdd(points[b]);
      comb[2] = points[a].add(points[b].neg());
    } else {
      comb[1] = points[a].toJ().mixedAdd(points[b]);
      comb[2] = points[a].toJ().mixedAdd(points[b].neg());
    }

    var index = [
      -3, /* -1 -1 */
      -1, /* -1 0 */
      -5, /* -1 1 */
      -7, /* 0 -1 */
      0, /* 0 0 */
      7, /* 0 1 */
      5, /* 1 -1 */
      1, /* 1 0 */
      3,  /* 1 1 */
    ];

    var jsf = getJSF(coeffs[a], coeffs[b]);
    max = Math.max(jsf[0].length, max);
    naf[a] = new Array(max);
    naf[b] = new Array(max);
    for (j = 0; j < max; j++) {
      var ja = jsf[0][j] | 0;
      var jb = jsf[1][j] | 0;

      naf[a][j] = index[(ja + 1) * 3 + (jb + 1)];
      naf[b][j] = 0;
      wnd[a] = comb;
    }
  }

  var acc = this.jpoint(null, null, null);
  var tmp = this._wnafT4;
  for (i = max; i >= 0; i--) {
    var k = 0;

    while (i >= 0) {
      var zero = true;
      for (j = 0; j < len; j++) {
        tmp[j] = naf[j][i] | 0;
        if (tmp[j] !== 0)
          zero = false;
      }
      if (!zero)
        break;
      k++;
      i--;
    }
    if (i >= 0)
      k++;
    acc = acc.dblp(k);
    if (i < 0)
      break;

    for (j = 0; j < len; j++) {
      var z = tmp[j];
      if (z === 0)
        continue;
      else if (z > 0)
        p = wnd[j][(z - 1) >> 1];
      else if (z < 0)
        p = wnd[j][(-z - 1) >> 1].neg();

      if (p.type === 'affine')
        acc = acc.mixedAdd(p);
      else
        acc = acc.add(p);
    }
  }
  // Zeroify references
  for (i = 0; i < len; i++)
    wnd[i] = null;

  if (jacobianResult)
    return acc;
  else
    return acc.toP();
};

function BasePoint(curve, type) {
  this.curve = curve;
  this.type = type;
  this.precomputed = null;
}
BaseCurve.BasePoint = BasePoint;

BasePoint.prototype.eq = function eq(/*other*/) {
  throw new Error('Not implemented');
};

BasePoint.prototype.validate = function validate() {
  return this.curve.validate(this);
};

BaseCurve.prototype.decodePoint = function decodePoint(bytes, enc) {
  bytes = utils_1$1.toArray(bytes, enc);

  var len = this.p.byteLength();

  // uncompressed, hybrid-odd, hybrid-even
  if ((bytes[0] === 0x04 || bytes[0] === 0x06 || bytes[0] === 0x07) &&
      bytes.length - 1 === 2 * len) {
    if (bytes[0] === 0x06)
      assert$1(bytes[bytes.length - 1] % 2 === 0);
    else if (bytes[0] === 0x07)
      assert$1(bytes[bytes.length - 1] % 2 === 1);

    var res =  this.point(bytes.slice(1, 1 + len),
      bytes.slice(1 + len, 1 + 2 * len));

    return res;
  } else if ((bytes[0] === 0x02 || bytes[0] === 0x03) &&
              bytes.length - 1 === len) {
    return this.pointFromX(bytes.slice(1, 1 + len), bytes[0] === 0x03);
  }
  throw new Error('Unknown point format');
};

BasePoint.prototype.encodeCompressed = function encodeCompressed(enc) {
  return this.encode(enc, true);
};

BasePoint.prototype._encode = function _encode(compact) {
  var len = this.curve.p.byteLength();
  var x = this.getX().toArray('be', len);

  if (compact)
    return [ this.getY().isEven() ? 0x02 : 0x03 ].concat(x);

  return [ 0x04 ].concat(x, this.getY().toArray('be', len));
};

BasePoint.prototype.encode = function encode(enc, compact) {
  return utils_1$1.encode(this._encode(compact), enc);
};

BasePoint.prototype.precompute = function precompute(power) {
  if (this.precomputed)
    return this;

  var precomputed = {
    doubles: null,
    naf: null,
    beta: null,
  };
  precomputed.naf = this._getNAFPoints(8);
  precomputed.doubles = this._getDoubles(4, power);
  precomputed.beta = this._getBeta();
  this.precomputed = precomputed;

  return this;
};

BasePoint.prototype._hasDoubles = function _hasDoubles(k) {
  if (!this.precomputed)
    return false;

  var doubles = this.precomputed.doubles;
  if (!doubles)
    return false;

  return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
};

BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
  if (this.precomputed && this.precomputed.doubles)
    return this.precomputed.doubles;

  var doubles = [ this ];
  var acc = this;
  for (var i = 0; i < power; i += step) {
    for (var j = 0; j < step; j++)
      acc = acc.dbl();
    doubles.push(acc);
  }
  return {
    step: step,
    points: doubles,
  };
};

BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
  if (this.precomputed && this.precomputed.naf)
    return this.precomputed.naf;

  var res = [ this ];
  var max = (1 << wnd) - 1;
  var dbl = max === 1 ? null : this.dbl();
  for (var i = 1; i < max; i++)
    res[i] = res[i - 1].add(dbl);
  return {
    wnd: wnd,
    points: res,
  };
};

BasePoint.prototype._getBeta = function _getBeta() {
  return null;
};

BasePoint.prototype.dblp = function dblp(k) {
  var r = this;
  for (var i = 0; i < k; i++)
    r = r.dbl();
  return r;
};

var inherits_browser = createCommonjsModule(function (module) {
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}
});






var assert$2 = utils_1$1.assert;

function ShortCurve(conf) {
  base.call(this, 'short', conf);

  this.a = new BN$1(conf.a, 16).toRed(this.red);
  this.b = new BN$1(conf.b, 16).toRed(this.red);
  this.tinv = this.two.redInvm();

  this.zeroA = this.a.fromRed().cmpn(0) === 0;
  this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;

  // If the curve is endomorphic, precalculate beta and lambda
  this.endo = this._getEndomorphism(conf);
  this._endoWnafT1 = new Array(4);
  this._endoWnafT2 = new Array(4);
}
inherits_browser(ShortCurve, base);
var short_1 = ShortCurve;

ShortCurve.prototype._getEndomorphism = function _getEndomorphism(conf) {
  // No efficient endomorphism
  if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1)
    return;

  // Compute beta and lambda, that lambda * P = (beta * Px; Py)
  var beta;
  var lambda;
  if (conf.beta) {
    beta = new BN$1(conf.beta, 16).toRed(this.red);
  } else {
    var betas = this._getEndoRoots(this.p);
    // Choose the smallest beta
    beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
    beta = beta.toRed(this.red);
  }
  if (conf.lambda) {
    lambda = new BN$1(conf.lambda, 16);
  } else {
    // Choose the lambda that is matching selected beta
    var lambdas = this._getEndoRoots(this.n);
    if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
      lambda = lambdas[0];
    } else {
      lambda = lambdas[1];
      assert$2(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
    }
  }

  // Get basis vectors, used for balanced length-two representation
  var basis;
  if (conf.basis) {
    basis = conf.basis.map(function(vec) {
      return {
        a: new BN$1(vec.a, 16),
        b: new BN$1(vec.b, 16),
      };
    });
  } else {
    basis = this._getEndoBasis(lambda);
  }

  return {
    beta: beta,
    lambda: lambda,
    basis: basis,
  };
};

ShortCurve.prototype._getEndoRoots = function _getEndoRoots(num) {
  // Find roots of for x^2 + x + 1 in F
  // Root = (-1 +- Sqrt(-3)) / 2
  //
  var red = num === this.p ? this.red : BN$1.mont(num);
  var tinv = new BN$1(2).toRed(red).redInvm();
  var ntinv = tinv.redNeg();

  var s = new BN$1(3).toRed(red).redNeg().redSqrt().redMul(tinv);

  var l1 = ntinv.redAdd(s).fromRed();
  var l2 = ntinv.redSub(s).fromRed();
  return [ l1, l2 ];
};

ShortCurve.prototype._getEndoBasis = function _getEndoBasis(lambda) {
  // aprxSqrt >= sqrt(this.n)
  var aprxSqrt = this.n.ushrn(Math.floor(this.n.bitLength() / 2));

  // 3.74
  // Run EGCD, until r(L + 1) < aprxSqrt
  var u = lambda;
  var v = this.n.clone();
  var x1 = new BN$1(1);
  var y1 = new BN$1(0);
  var x2 = new BN$1(0);
  var y2 = new BN$1(1);

  // NOTE: all vectors are roots of: a + b * lambda = 0 (mod n)
  var a0;
  var b0;
  // First vector
  var a1;
  var b1;
  // Second vector
  var a2;
  var b2;

  var prevR;
  var i = 0;
  var r;
  var x;
  while (u.cmpn(0) !== 0) {
    var q = v.div(u);
    r = v.sub(q.mul(u));
    x = x2.sub(q.mul(x1));
    var y = y2.sub(q.mul(y1));

    if (!a1 && r.cmp(aprxSqrt) < 0) {
      a0 = prevR.neg();
      b0 = x1;
      a1 = r.neg();
      b1 = x;
    } else if (a1 && ++i === 2) {
      break;
    }
    prevR = r;

    v = u;
    u = r;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  a2 = r.neg();
  b2 = x;

  var len1 = a1.sqr().add(b1.sqr());
  var len2 = a2.sqr().add(b2.sqr());
  if (len2.cmp(len1) >= 0) {
    a2 = a0;
    b2 = b0;
  }

  // Normalize signs
  if (a1.negative) {
    a1 = a1.neg();
    b1 = b1.neg();
  }
  if (a2.negative) {
    a2 = a2.neg();
    b2 = b2.neg();
  }

  return [
    { a: a1, b: b1 },
    { a: a2, b: b2 },
  ];
};

ShortCurve.prototype._endoSplit = function _endoSplit(k) {
  var basis = this.endo.basis;
  var v1 = basis[0];
  var v2 = basis[1];

  var c1 = v2.b.mul(k).divRound(this.n);
  var c2 = v1.b.neg().mul(k).divRound(this.n);

  var p1 = c1.mul(v1.a);
  var p2 = c2.mul(v2.a);
  var q1 = c1.mul(v1.b);
  var q2 = c2.mul(v2.b);

  // Calculate answer
  var k1 = k.sub(p1).sub(p2);
  var k2 = q1.add(q2).neg();
  return { k1: k1, k2: k2 };
};

ShortCurve.prototype.pointFromX = function pointFromX(x, odd) {
  x = new BN$1(x, 16);
  if (!x.red)
    x = x.toRed(this.red);

  var y2 = x.redSqr().redMul(x).redIAdd(x.redMul(this.a)).redIAdd(this.b);
  var y = y2.redSqrt();
  if (y.redSqr().redSub(y2).cmp(this.zero) !== 0)
    throw new Error('invalid point');

  // XXX Is there any way to tell if the number is odd without converting it
  // to non-red form?
  var isOdd = y.fromRed().isOdd();
  if (odd && !isOdd || !odd && isOdd)
    y = y.redNeg();

  return this.point(x, y);
};

ShortCurve.prototype.validate = function validate(point) {
  if (point.inf)
    return true;

  var x = point.x;
  var y = point.y;

  var ax = this.a.redMul(x);
  var rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);
  return y.redSqr().redISub(rhs).cmpn(0) === 0;
};

ShortCurve.prototype._endoWnafMulAdd =
    function _endoWnafMulAdd(points, coeffs, jacobianResult) {
      var npoints = this._endoWnafT1;
      var ncoeffs = this._endoWnafT2;
      for (var i = 0; i < points.length; i++) {
        var split = this._endoSplit(coeffs[i]);
        var p = points[i];
        var beta = p._getBeta();

        if (split.k1.negative) {
          split.k1.ineg();
          p = p.neg(true);
        }
        if (split.k2.negative) {
          split.k2.ineg();
          beta = beta.neg(true);
        }

        npoints[i * 2] = p;
        npoints[i * 2 + 1] = beta;
        ncoeffs[i * 2] = split.k1;
        ncoeffs[i * 2 + 1] = split.k2;
      }
      var res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);

      // Clean-up references to points and coefficients
      for (var j = 0; j < i * 2; j++) {
        npoints[j] = null;
        ncoeffs[j] = null;
      }
      return res;
    };

function Point(curve, x, y, isRed) {
  base.BasePoint.call(this, curve, 'affine');
  if (x === null && y === null) {
    this.x = null;
    this.y = null;
    this.inf = true;
  } else {
    this.x = new BN$1(x, 16);
    this.y = new BN$1(y, 16);
    // Force redgomery representation when loading from JSON
    if (isRed) {
      this.x.forceRed(this.curve.red);
      this.y.forceRed(this.curve.red);
    }
    if (!this.x.red)
      this.x = this.x.toRed(this.curve.red);
    if (!this.y.red)
      this.y = this.y.toRed(this.curve.red);
    this.inf = false;
  }
}
inherits_browser(Point, base.BasePoint);

ShortCurve.prototype.point = function point(x, y, isRed) {
  return new Point(this, x, y, isRed);
};

ShortCurve.prototype.pointFromJSON = function pointFromJSON(obj, red) {
  return Point.fromJSON(this, obj, red);
};

Point.prototype._getBeta = function _getBeta() {
  if (!this.curve.endo)
    return;

  var pre = this.precomputed;
  if (pre && pre.beta)
    return pre.beta;

  var beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
  if (pre) {
    var curve = this.curve;
    var endoMul = function(p) {
      return curve.point(p.x.redMul(curve.endo.beta), p.y);
    };
    pre.beta = beta;
    beta.precomputed = {
      beta: null,
      naf: pre.naf && {
        wnd: pre.naf.wnd,
        points: pre.naf.points.map(endoMul),
      },
      doubles: pre.doubles && {
        step: pre.doubles.step,
        points: pre.doubles.points.map(endoMul),
      },
    };
  }
  return beta;
};

Point.prototype.toJSON = function toJSON() {
  if (!this.precomputed)
    return [ this.x, this.y ];

  return [ this.x, this.y, this.precomputed && {
    doubles: this.precomputed.doubles && {
      step: this.precomputed.doubles.step,
      points: this.precomputed.doubles.points.slice(1),
    },
    naf: this.precomputed.naf && {
      wnd: this.precomputed.naf.wnd,
      points: this.precomputed.naf.points.slice(1),
    },
  } ];
};

Point.fromJSON = function fromJSON(curve, obj, red) {
  if (typeof obj === 'string')
    obj = JSON.parse(obj);
  var res = curve.point(obj[0], obj[1], red);
  if (!obj[2])
    return res;

  function obj2point(obj) {
    return curve.point(obj[0], obj[1], red);
  }

  var pre = obj[2];
  res.precomputed = {
    beta: null,
    doubles: pre.doubles && {
      step: pre.doubles.step,
      points: [ res ].concat(pre.doubles.points.map(obj2point)),
    },
    naf: pre.naf && {
      wnd: pre.naf.wnd,
      points: [ res ].concat(pre.naf.points.map(obj2point)),
    },
  };
  return res;
};

Point.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC Point Infinity>';
  return '<EC Point x: ' + this.x.fromRed().toString(16, 2) +
      ' y: ' + this.y.fromRed().toString(16, 2) + '>';
};

Point.prototype.isInfinity = function isInfinity() {
  return this.inf;
};

Point.prototype.add = function add(p) {
  // O + P = P
  if (this.inf)
    return p;

  // P + O = P
  if (p.inf)
    return this;

  // P + P = 2P
  if (this.eq(p))
    return this.dbl();

  // P + (-P) = O
  if (this.neg().eq(p))
    return this.curve.point(null, null);

  // P + Q = O
  if (this.x.cmp(p.x) === 0)
    return this.curve.point(null, null);

  var c = this.y.redSub(p.y);
  if (c.cmpn(0) !== 0)
    c = c.redMul(this.x.redSub(p.x).redInvm());
  var nx = c.redSqr().redISub(this.x).redISub(p.x);
  var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
  return this.curve.point(nx, ny);
};

Point.prototype.dbl = function dbl() {
  if (this.inf)
    return this;

  // 2P = O
  var ys1 = this.y.redAdd(this.y);
  if (ys1.cmpn(0) === 0)
    return this.curve.point(null, null);

  var a = this.curve.a;

  var x2 = this.x.redSqr();
  var dyinv = ys1.redInvm();
  var c = x2.redAdd(x2).redIAdd(x2).redIAdd(a).redMul(dyinv);

  var nx = c.redSqr().redISub(this.x.redAdd(this.x));
  var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
  return this.curve.point(nx, ny);
};

Point.prototype.getX = function getX() {
  return this.x.fromRed();
};

Point.prototype.getY = function getY() {
  return this.y.fromRed();
};

Point.prototype.mul = function mul(k) {
  k = new BN$1(k, 16);
  if (this.isInfinity())
    return this;
  else if (this._hasDoubles(k))
    return this.curve._fixedNafMul(this, k);
  else if (this.curve.endo)
    return this.curve._endoWnafMulAdd([ this ], [ k ]);
  else
    return this.curve._wnafMul(this, k);
};

Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
  var points = [ this, p2 ];
  var coeffs = [ k1, k2 ];
  if (this.curve.endo)
    return this.curve._endoWnafMulAdd(points, coeffs);
  else
    return this.curve._wnafMulAdd(1, points, coeffs, 2);
};

Point.prototype.jmulAdd = function jmulAdd(k1, p2, k2) {
  var points = [ this, p2 ];
  var coeffs = [ k1, k2 ];
  if (this.curve.endo)
    return this.curve._endoWnafMulAdd(points, coeffs, true);
  else
    return this.curve._wnafMulAdd(1, points, coeffs, 2, true);
};

Point.prototype.eq = function eq(p) {
  return this === p ||
         this.inf === p.inf &&
             (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
};

Point.prototype.neg = function neg(_precompute) {
  if (this.inf)
    return this;

  var res = this.curve.point(this.x, this.y.redNeg());
  if (_precompute && this.precomputed) {
    var pre = this.precomputed;
    var negate = function(p) {
      return p.neg();
    };
    res.precomputed = {
      naf: pre.naf && {
        wnd: pre.naf.wnd,
        points: pre.naf.points.map(negate),
      },
      doubles: pre.doubles && {
        step: pre.doubles.step,
        points: pre.doubles.points.map(negate),
      },
    };
  }
  return res;
};

Point.prototype.toJ = function toJ() {
  if (this.inf)
    return this.curve.jpoint(null, null, null);

  var res = this.curve.jpoint(this.x, this.y, this.curve.one);
  return res;
};

function JPoint(curve, x, y, z) {
  base.BasePoint.call(this, curve, 'jacobian');
  if (x === null && y === null && z === null) {
    this.x = this.curve.one;
    this.y = this.curve.one;
    this.z = new BN$1(0);
  } else {
    this.x = new BN$1(x, 16);
    this.y = new BN$1(y, 16);
    this.z = new BN$1(z, 16);
  }
  if (!this.x.red)
    this.x = this.x.toRed(this.curve.red);
  if (!this.y.red)
    this.y = this.y.toRed(this.curve.red);
  if (!this.z.red)
    this.z = this.z.toRed(this.curve.red);

  this.zOne = this.z === this.curve.one;
}
inherits_browser(JPoint, base.BasePoint);

ShortCurve.prototype.jpoint = function jpoint(x, y, z) {
  return new JPoint(this, x, y, z);
};

JPoint.prototype.toP = function toP() {
  if (this.isInfinity())
    return this.curve.point(null, null);

  var zinv = this.z.redInvm();
  var zinv2 = zinv.redSqr();
  var ax = this.x.redMul(zinv2);
  var ay = this.y.redMul(zinv2).redMul(zinv);

  return this.curve.point(ax, ay);
};

JPoint.prototype.neg = function neg() {
  return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
};

JPoint.prototype.add = function add(p) {
  // O + P = P
  if (this.isInfinity())
    return p;

  // P + O = P
  if (p.isInfinity())
    return this;

  // 12M + 4S + 7A
  var pz2 = p.z.redSqr();
  var z2 = this.z.redSqr();
  var u1 = this.x.redMul(pz2);
  var u2 = p.x.redMul(z2);
  var s1 = this.y.redMul(pz2.redMul(p.z));
  var s2 = p.y.redMul(z2.redMul(this.z));

  var h = u1.redSub(u2);
  var r = s1.redSub(s2);
  if (h.cmpn(0) === 0) {
    if (r.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h2 = h.redSqr();
  var h3 = h2.redMul(h);
  var v = u1.redMul(h2);

  var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
  var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
  var nz = this.z.redMul(p.z).redMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mixedAdd = function mixedAdd(p) {
  // O + P = P
  if (this.isInfinity())
    return p.toJ();

  // P + O = P
  if (p.isInfinity())
    return this;

  // 8M + 3S + 7A
  var z2 = this.z.redSqr();
  var u1 = this.x;
  var u2 = p.x.redMul(z2);
  var s1 = this.y;
  var s2 = p.y.redMul(z2).redMul(this.z);

  var h = u1.redSub(u2);
  var r = s1.redSub(s2);
  if (h.cmpn(0) === 0) {
    if (r.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h2 = h.redSqr();
  var h3 = h2.redMul(h);
  var v = u1.redMul(h2);

  var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
  var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
  var nz = this.z.redMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.dblp = function dblp(pow) {
  if (pow === 0)
    return this;
  if (this.isInfinity())
    return this;
  if (!pow)
    return this.dbl();

  var i;
  if (this.curve.zeroA || this.curve.threeA) {
    var r = this;
    for (i = 0; i < pow; i++)
      r = r.dbl();
    return r;
  }

  // 1M + 2S + 1A + N * (4S + 5M + 8A)
  // N = 1 => 6M + 6S + 9A
  var a = this.curve.a;
  var tinv = this.curve.tinv;

  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.redSqr().redSqr();

  // Reuse results
  var jyd = jy.redAdd(jy);
  for (i = 0; i < pow; i++) {
    var jx2 = jx.redSqr();
    var jyd2 = jyd.redSqr();
    var jyd4 = jyd2.redSqr();
    var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

    var t1 = jx.redMul(jyd2);
    var nx = c.redSqr().redISub(t1.redAdd(t1));
    var t2 = t1.redISub(nx);
    var dny = c.redMul(t2);
    dny = dny.redIAdd(dny).redISub(jyd4);
    var nz = jyd.redMul(jz);
    if (i + 1 < pow)
      jz4 = jz4.redMul(jyd4);

    jx = nx;
    jz = nz;
    jyd = dny;
  }

  return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
};

JPoint.prototype.dbl = function dbl() {
  if (this.isInfinity())
    return this;

  if (this.curve.zeroA)
    return this._zeroDbl();
  else if (this.curve.threeA)
    return this._threeDbl();
  else
    return this._dbl();
};

JPoint.prototype._zeroDbl = function _zeroDbl() {
  var nx;
  var ny;
  var nz;
  // Z = 1
  if (this.zOne) {
    // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
    //     #doubling-mdbl-2007-bl
    // 1M + 5S + 14A

    // XX = X1^2
    var xx = this.x.redSqr();
    // YY = Y1^2
    var yy = this.y.redSqr();
    // YYYY = YY^2
    var yyyy = yy.redSqr();
    // S = 2 * ((X1 + YY)^2 - XX - YYYY)
    var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
    s = s.redIAdd(s);
    // M = 3 * XX + a; a = 0
    var m = xx.redAdd(xx).redIAdd(xx);
    // T = M ^ 2 - 2*S
    var t = m.redSqr().redISub(s).redISub(s);

    // 8 * YYYY
    var yyyy8 = yyyy.redIAdd(yyyy);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    yyyy8 = yyyy8.redIAdd(yyyy8);

    // X3 = T
    nx = t;
    // Y3 = M * (S - T) - 8 * YYYY
    ny = m.redMul(s.redISub(t)).redISub(yyyy8);
    // Z3 = 2*Y1
    nz = this.y.redAdd(this.y);
  } else {
    // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
    //     #doubling-dbl-2009-l
    // 2M + 5S + 13A

    // A = X1^2
    var a = this.x.redSqr();
    // B = Y1^2
    var b = this.y.redSqr();
    // C = B^2
    var c = b.redSqr();
    // D = 2 * ((X1 + B)^2 - A - C)
    var d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
    d = d.redIAdd(d);
    // E = 3 * A
    var e = a.redAdd(a).redIAdd(a);
    // F = E^2
    var f = e.redSqr();

    // 8 * C
    var c8 = c.redIAdd(c);
    c8 = c8.redIAdd(c8);
    c8 = c8.redIAdd(c8);

    // X3 = F - 2 * D
    nx = f.redISub(d).redISub(d);
    // Y3 = E * (D - X3) - 8 * C
    ny = e.redMul(d.redISub(nx)).redISub(c8);
    // Z3 = 2 * Y1 * Z1
    nz = this.y.redMul(this.z);
    nz = nz.redIAdd(nz);
  }

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype._threeDbl = function _threeDbl() {
  var nx;
  var ny;
  var nz;
  // Z = 1
  if (this.zOne) {
    // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-3.html
    //     #doubling-mdbl-2007-bl
    // 1M + 5S + 15A

    // XX = X1^2
    var xx = this.x.redSqr();
    // YY = Y1^2
    var yy = this.y.redSqr();
    // YYYY = YY^2
    var yyyy = yy.redSqr();
    // S = 2 * ((X1 + YY)^2 - XX - YYYY)
    var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
    s = s.redIAdd(s);
    // M = 3 * XX + a
    var m = xx.redAdd(xx).redIAdd(xx).redIAdd(this.curve.a);
    // T = M^2 - 2 * S
    var t = m.redSqr().redISub(s).redISub(s);
    // X3 = T
    nx = t;
    // Y3 = M * (S - T) - 8 * YYYY
    var yyyy8 = yyyy.redIAdd(yyyy);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    yyyy8 = yyyy8.redIAdd(yyyy8);
    ny = m.redMul(s.redISub(t)).redISub(yyyy8);
    // Z3 = 2 * Y1
    nz = this.y.redAdd(this.y);
  } else {
    // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-3.html#doubling-dbl-2001-b
    // 3M + 5S

    // delta = Z1^2
    var delta = this.z.redSqr();
    // gamma = Y1^2
    var gamma = this.y.redSqr();
    // beta = X1 * gamma
    var beta = this.x.redMul(gamma);
    // alpha = 3 * (X1 - delta) * (X1 + delta)
    var alpha = this.x.redSub(delta).redMul(this.x.redAdd(delta));
    alpha = alpha.redAdd(alpha).redIAdd(alpha);
    // X3 = alpha^2 - 8 * beta
    var beta4 = beta.redIAdd(beta);
    beta4 = beta4.redIAdd(beta4);
    var beta8 = beta4.redAdd(beta4);
    nx = alpha.redSqr().redISub(beta8);
    // Z3 = (Y1 + Z1)^2 - gamma - delta
    nz = this.y.redAdd(this.z).redSqr().redISub(gamma).redISub(delta);
    // Y3 = alpha * (4 * beta - X3) - 8 * gamma^2
    var ggamma8 = gamma.redSqr();
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ggamma8 = ggamma8.redIAdd(ggamma8);
    ny = alpha.redMul(beta4.redISub(nx)).redISub(ggamma8);
  }

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype._dbl = function _dbl() {
  var a = this.curve.a;

  // 4M + 6S + 10A
  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.redSqr().redSqr();

  var jx2 = jx.redSqr();
  var jy2 = jy.redSqr();

  var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

  var jxd4 = jx.redAdd(jx);
  jxd4 = jxd4.redIAdd(jxd4);
  var t1 = jxd4.redMul(jy2);
  var nx = c.redSqr().redISub(t1.redAdd(t1));
  var t2 = t1.redISub(nx);

  var jyd8 = jy2.redSqr();
  jyd8 = jyd8.redIAdd(jyd8);
  jyd8 = jyd8.redIAdd(jyd8);
  jyd8 = jyd8.redIAdd(jyd8);
  var ny = c.redMul(t2).redISub(jyd8);
  var nz = jy.redAdd(jy).redMul(jz);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.trpl = function trpl() {
  if (!this.curve.zeroA)
    return this.dbl().add(this);

  // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#tripling-tpl-2007-bl
  // 5M + 10S + ...

  // XX = X1^2
  var xx = this.x.redSqr();
  // YY = Y1^2
  var yy = this.y.redSqr();
  // ZZ = Z1^2
  var zz = this.z.redSqr();
  // YYYY = YY^2
  var yyyy = yy.redSqr();
  // M = 3 * XX + a * ZZ2; a = 0
  var m = xx.redAdd(xx).redIAdd(xx);
  // MM = M^2
  var mm = m.redSqr();
  // E = 6 * ((X1 + YY)^2 - XX - YYYY) - MM
  var e = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
  e = e.redIAdd(e);
  e = e.redAdd(e).redIAdd(e);
  e = e.redISub(mm);
  // EE = E^2
  var ee = e.redSqr();
  // T = 16*YYYY
  var t = yyyy.redIAdd(yyyy);
  t = t.redIAdd(t);
  t = t.redIAdd(t);
  t = t.redIAdd(t);
  // U = (M + E)^2 - MM - EE - T
  var u = m.redIAdd(e).redSqr().redISub(mm).redISub(ee).redISub(t);
  // X3 = 4 * (X1 * EE - 4 * YY * U)
  var yyu4 = yy.redMul(u);
  yyu4 = yyu4.redIAdd(yyu4);
  yyu4 = yyu4.redIAdd(yyu4);
  var nx = this.x.redMul(ee).redISub(yyu4);
  nx = nx.redIAdd(nx);
  nx = nx.redIAdd(nx);
  // Y3 = 8 * Y1 * (U * (T - U) - E * EE)
  var ny = this.y.redMul(u.redMul(t.redISub(u)).redISub(e.redMul(ee)));
  ny = ny.redIAdd(ny);
  ny = ny.redIAdd(ny);
  ny = ny.redIAdd(ny);
  // Z3 = (Z1 + E)^2 - ZZ - EE
  var nz = this.z.redAdd(e).redSqr().redISub(zz).redISub(ee);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mul = function mul(k, kbase) {
  k = new BN$1(k, kbase);

  return this.curve._wnafMul(this, k);
};

JPoint.prototype.eq = function eq(p) {
  if (p.type === 'affine')
    return this.eq(p.toJ());

  if (this === p)
    return true;

  // x1 * z2^2 == x2 * z1^2
  var z2 = this.z.redSqr();
  var pz2 = p.z.redSqr();
  if (this.x.redMul(pz2).redISub(p.x.redMul(z2)).cmpn(0) !== 0)
    return false;

  // y1 * z2^3 == y2 * z1^3
  var z3 = z2.redMul(this.z);
  var pz3 = pz2.redMul(p.z);
  return this.y.redMul(pz3).redISub(p.y.redMul(z3)).cmpn(0) === 0;
};

JPoint.prototype.eqXToP = function eqXToP(x) {
  var zs = this.z.redSqr();
  var rx = x.toRed(this.curve.red).redMul(zs);
  if (this.x.cmp(rx) === 0)
    return true;

  var xc = x.clone();
  var t = this.curve.redN.redMul(zs);
  for (;;) {
    xc.iadd(this.curve.n);
    if (xc.cmp(this.curve.p) >= 0)
      return false;

    rx.redIAdd(t);
    if (this.x.cmp(rx) === 0)
      return true;
  }
};

JPoint.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC JPoint Infinity>';
  return '<EC JPoint x: ' + this.x.toString(16, 2) +
      ' y: ' + this.y.toString(16, 2) +
      ' z: ' + this.z.toString(16, 2) + '>';
};

JPoint.prototype.isInfinity = function isInfinity() {
  // XXX This code assumes that zero is always zero in red
  return this.z.cmpn(0) === 0;
};

var curve_1 = createCommonjsModule(function (module, exports) {

var curve = exports;

curve.base = base;
curve.short = short_1;
curve.mont = /*RicMoo:ethers:require(./mont)*/(null);
curve.edwards = /*RicMoo:ethers:require(./edwards)*/(null);
});

var curves_1 = createCommonjsModule(function (module, exports) {

var curves = exports;





var assert = utils_1$1.assert;

function PresetCurve(options) {
  if (options.type === 'short')
    this.curve = new curve_1.short(options);
  else if (options.type === 'edwards')
    this.curve = new curve_1.edwards(options);
  else
    this.curve = new curve_1.mont(options);
  this.g = this.curve.g;
  this.n = this.curve.n;
  this.hash = options.hash;

  assert(this.g.validate(), 'Invalid curve');
  assert(this.g.mul(this.n).isInfinity(), 'Invalid curve, G*N != O');
}
curves.PresetCurve = PresetCurve;

function defineCurve(name, options) {
  Object.defineProperty(curves, name, {
    configurable: true,
    enumerable: true,
    get: function() {
      var curve = new PresetCurve(options);
      Object.defineProperty(curves, name, {
        configurable: true,
        enumerable: true,
        value: curve,
      });
      return curve;
    },
  });
}

defineCurve('p192', {
  type: 'short',
  prime: 'p192',
  p: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff',
  a: 'ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc',
  b: '64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1',
  n: 'ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831',
  hash: hash.sha256,
  gRed: false,
  g: [
    '188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012',
    '07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811',
  ],
});

defineCurve('p224', {
  type: 'short',
  prime: 'p224',
  p: 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001',
  a: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe',
  b: 'b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4',
  n: 'ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d',
  hash: hash.sha256,
  gRed: false,
  g: [
    'b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21',
    'bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34',
  ],
});

defineCurve('p256', {
  type: 'short',
  prime: null,
  p: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff',
  a: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc',
  b: '5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b',
  n: 'ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551',
  hash: hash.sha256,
  gRed: false,
  g: [
    '6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296',
    '4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5',
  ],
});

defineCurve('p384', {
  type: 'short',
  prime: null,
  p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'fffffffe ffffffff 00000000 00000000 ffffffff',
  a: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'fffffffe ffffffff 00000000 00000000 fffffffc',
  b: 'b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f ' +
     '5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef',
  n: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 ' +
     'f4372ddf 581a0db2 48b0a77a ecec196a ccc52973',
  hash: hash.sha384,
  gRed: false,
  g: [
    'aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 ' +
    '5502f25d bf55296c 3a545e38 72760ab7',
    '3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 ' +
    '0a60b1ce 1d7e819d 7a431d7c 90ea0e5f',
  ],
});

defineCurve('p521', {
  type: 'short',
  prime: null,
  p: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'ffffffff ffffffff ffffffff ffffffff ffffffff',
  a: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'ffffffff ffffffff ffffffff ffffffff fffffffc',
  b: '00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b ' +
     '99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd ' +
     '3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00',
  n: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
     'ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 ' +
     'f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409',
  hash: hash.sha512,
  gRed: false,
  g: [
    '000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 ' +
    '053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 ' +
    'a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66',
    '00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 ' +
    '579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 ' +
    '3fad0761 353c7086 a272c240 88be9476 9fd16650',
  ],
});

defineCurve('curve25519', {
  type: 'mont',
  prime: 'p25519',
  p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
  a: '76d06',
  b: '1',
  n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
  hash: hash.sha256,
  gRed: false,
  g: [
    '9',
  ],
});

defineCurve('ed25519', {
  type: 'edwards',
  prime: 'p25519',
  p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
  a: '-1',
  c: '1',
  // -121665 * (121666^(-1)) (mod P)
  d: '52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3',
  n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
  hash: hash.sha256,
  gRed: false,
  g: [
    '216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a',

    // 4/5
    '6666666666666666666666666666666666666666666666666666666666666658',
  ],
});

var pre;
try {
  pre = /*RicMoo:ethers:require(./precomputed/secp256k1)*/(null).crash();
} catch (e) {
  pre = undefined;
}

defineCurve('secp256k1', {
  type: 'short',
  prime: 'k256',
  p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f',
  a: '0',
  b: '7',
  n: 'ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141',
  h: '1',
  hash: hash.sha256,

  // Precomputed endomorphism
  beta: '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
  lambda: '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
  basis: [
    {
      a: '3086d221a7d46bcde86c90e49284eb15',
      b: '-e4437ed6010e88286f547fa90abfe4c3',
    },
    {
      a: '114ca50f7a8e2f3f657c1108d9d44cfd8',
      b: '3086d221a7d46bcde86c90e49284eb15',
    },
  ],

  gRed: false,
  g: [
    '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
    pre,
  ],
});
});





function HmacDRBG(options) {
  if (!(this instanceof HmacDRBG))
    return new HmacDRBG(options);
  this.hash = options.hash;
  this.predResist = !!options.predResist;

  this.outLen = this.hash.outSize;
  this.minEntropy = options.minEntropy || this.hash.hmacStrength;

  this._reseed = null;
  this.reseedInterval = null;
  this.K = null;
  this.V = null;

  var entropy = utils_1.toArray(options.entropy, options.entropyEnc || 'hex');
  var nonce = utils_1.toArray(options.nonce, options.nonceEnc || 'hex');
  var pers = utils_1.toArray(options.pers, options.persEnc || 'hex');
  minimalisticAssert(entropy.length >= (this.minEntropy / 8),
         'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');
  this._init(entropy, nonce, pers);
}
var hmacDrbg = HmacDRBG;

HmacDRBG.prototype._init = function init(entropy, nonce, pers) {
  var seed = entropy.concat(nonce).concat(pers);

  this.K = new Array(this.outLen / 8);
  this.V = new Array(this.outLen / 8);
  for (var i = 0; i < this.V.length; i++) {
    this.K[i] = 0x00;
    this.V[i] = 0x01;
  }

  this._update(seed);
  this._reseed = 1;
  this.reseedInterval = 0x1000000000000;  // 2^48
};

HmacDRBG.prototype._hmac = function hmac() {
  return new hash.hmac(this.hash, this.K);
};

HmacDRBG.prototype._update = function update(seed) {
  var kmac = this._hmac()
                 .update(this.V)
                 .update([ 0x00 ]);
  if (seed)
    kmac = kmac.update(seed);
  this.K = kmac.digest();
  this.V = this._hmac().update(this.V).digest();
  if (!seed)
    return;

  this.K = this._hmac()
               .update(this.V)
               .update([ 0x01 ])
               .update(seed)
               .digest();
  this.V = this._hmac().update(this.V).digest();
};

HmacDRBG.prototype.reseed = function reseed(entropy, entropyEnc, add, addEnc) {
  // Optional entropy enc
  if (typeof entropyEnc !== 'string') {
    addEnc = add;
    add = entropyEnc;
    entropyEnc = null;
  }

  entropy = utils_1.toArray(entropy, entropyEnc);
  add = utils_1.toArray(add, addEnc);

  minimalisticAssert(entropy.length >= (this.minEntropy / 8),
         'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');

  this._update(entropy.concat(add || []));
  this._reseed = 1;
};

HmacDRBG.prototype.generate = function generate(len, enc, add, addEnc) {
  if (this._reseed > this.reseedInterval)
    throw new Error('Reseed is required');

  // Optional encoding
  if (typeof enc !== 'string') {
    addEnc = add;
    add = enc;
    enc = null;
  }

  // Optional additional data
  if (add) {
    add = utils_1.toArray(add, addEnc || 'hex');
    this._update(add);
  }

  var temp = [];
  while (temp.length < len) {
    this.V = this._hmac().update(this.V).digest();
    temp = temp.concat(this.V);
  }

  var res = temp.slice(0, len);
  this._update(add);
  this._reseed++;
  return utils_1.encode(res, enc);
};



var assert$3 = utils_1$1.assert;

function KeyPair(ec, options) {
  this.ec = ec;
  this.priv = null;
  this.pub = null;

  // KeyPair(ec, { priv: ..., pub: ... })
  if (options.priv)
    this._importPrivate(options.priv, options.privEnc);
  if (options.pub)
    this._importPublic(options.pub, options.pubEnc);
}
var key = KeyPair;

KeyPair.fromPublic = function fromPublic(ec, pub, enc) {
  if (pub instanceof KeyPair)
    return pub;

  return new KeyPair(ec, {
    pub: pub,
    pubEnc: enc,
  });
};

KeyPair.fromPrivate = function fromPrivate(ec, priv, enc) {
  if (priv instanceof KeyPair)
    return priv;

  return new KeyPair(ec, {
    priv: priv,
    privEnc: enc,
  });
};

KeyPair.prototype.validate = function validate() {
  var pub = this.getPublic();

  if (pub.isInfinity())
    return { result: false, reason: 'Invalid public key' };
  if (!pub.validate())
    return { result: false, reason: 'Public key is not a point' };
  if (!pub.mul(this.ec.curve.n).isInfinity())
    return { result: false, reason: 'Public key * N != O' };

  return { result: true, reason: null };
};

KeyPair.prototype.getPublic = function getPublic(compact, enc) {
  // compact is optional argument
  if (typeof compact === 'string') {
    enc = compact;
    compact = null;
  }

  if (!this.pub)
    this.pub = this.ec.g.mul(this.priv);

  if (!enc)
    return this.pub;

  return this.pub.encode(enc, compact);
};

KeyPair.prototype.getPrivate = function getPrivate(enc) {
  if (enc === 'hex')
    return this.priv.toString(16, 2);
  else
    return this.priv;
};

KeyPair.prototype._importPrivate = function _importPrivate(key, enc) {
  this.priv = new BN$1(key, enc || 16);

  // Ensure that the priv won't be bigger than n, otherwise we may fail
  // in fixed multiplication method
  this.priv = this.priv.umod(this.ec.curve.n);
};

KeyPair.prototype._importPublic = function _importPublic(key, enc) {
  if (key.x || key.y) {
    // Montgomery points only have an `x` coordinate.
    // Weierstrass/Edwards points on the other hand have both `x` and
    // `y` coordinates.
    if (this.ec.curve.type === 'mont') {
      assert$3(key.x, 'Need x coordinate');
    } else if (this.ec.curve.type === 'short' ||
               this.ec.curve.type === 'edwards') {
      assert$3(key.x && key.y, 'Need both x and y coordinate');
    }
    this.pub = this.ec.curve.point(key.x, key.y);
    return;
  }
  this.pub = this.ec.curve.decodePoint(key, enc);
};

// ECDH
KeyPair.prototype.derive = function derive(pub) {
  if(!pub.validate()) {
    assert$3(pub.validate(), 'public point not validated');
  }
  return pub.mul(this.priv).getX();
};

// ECDSA
KeyPair.prototype.sign = function sign(msg, enc, options) {
  return this.ec.sign(msg, this, enc, options);
};

KeyPair.prototype.verify = function verify(msg, signature) {
  return this.ec.verify(msg, signature, this);
};

KeyPair.prototype.inspect = function inspect() {
  return '<Key priv: ' + (this.priv && this.priv.toString(16, 2)) +
         ' pub: ' + (this.pub && this.pub.inspect()) + ' >';
};




var assert$4 = utils_1$1.assert;

function Signature(options, enc) {
  if (options instanceof Signature)
    return options;

  if (this._importDER(options, enc))
    return;

  assert$4(options.r && options.s, 'Signature without r or s');
  this.r = new BN$1(options.r, 16);
  this.s = new BN$1(options.s, 16);
  if (options.recoveryParam === undefined)
    this.recoveryParam = null;
  else
    this.recoveryParam = options.recoveryParam;
}
var signature = Signature;

function Position() {
  this.place = 0;
}

function getLength(buf, p) {
  var initial = buf[p.place++];
  if (!(initial & 0x80)) {
    return initial;
  }
  var octetLen = initial & 0xf;

  // Indefinite length or overflow
  if (octetLen === 0 || octetLen > 4) {
    return false;
  }

  var val = 0;
  for (var i = 0, off = p.place; i < octetLen; i++, off++) {
    val <<= 8;
    val |= buf[off];
    val >>>= 0;
  }

  // Leading zeroes
  if (val <= 0x7f) {
    return false;
  }

  p.place = off;
  return val;
}

function rmPadding(buf) {
  var i = 0;
  var len = buf.length - 1;
  while (!buf[i] && !(buf[i + 1] & 0x80) && i < len) {
    i++;
  }
  if (i === 0) {
    return buf;
  }
  return buf.slice(i);
}

Signature.prototype._importDER = function _importDER(data, enc) {
  data = utils_1$1.toArray(data, enc);
  var p = new Position();
  if (data[p.place++] !== 0x30) {
    return false;
  }
  var len = getLength(data, p);
  if (len === false) {
    return false;
  }
  if ((len + p.place) !== data.length) {
    return false;
  }
  if (data[p.place++] !== 0x02) {
    return false;
  }
  var rlen = getLength(data, p);
  if (rlen === false) {
    return false;
  }
  var r = data.slice(p.place, rlen + p.place);
  p.place += rlen;
  if (data[p.place++] !== 0x02) {
    return false;
  }
  var slen = getLength(data, p);
  if (slen === false) {
    return false;
  }
  if (data.length !== slen + p.place) {
    return false;
  }
  var s = data.slice(p.place, slen + p.place);
  if (r[0] === 0) {
    if (r[1] & 0x80) {
      r = r.slice(1);
    } else {
      // Leading zeroes
      return false;
    }
  }
  if (s[0] === 0) {
    if (s[1] & 0x80) {
      s = s.slice(1);
    } else {
      // Leading zeroes
      return false;
    }
  }

  this.r = new BN$1(r);
  this.s = new BN$1(s);
  this.recoveryParam = null;

  return true;
};

function constructLength(arr, len) {
  if (len < 0x80) {
    arr.push(len);
    return;
  }
  var octets = 1 + (Math.log(len) / Math.LN2 >>> 3);
  arr.push(octets | 0x80);
  while (--octets) {
    arr.push((len >>> (octets << 3)) & 0xff);
  }
  arr.push(len);
}

Signature.prototype.toDER = function toDER(enc) {
  var r = this.r.toArray();
  var s = this.s.toArray();

  // Pad values
  if (r[0] & 0x80)
    r = [ 0 ].concat(r);
  // Pad values
  if (s[0] & 0x80)
    s = [ 0 ].concat(s);

  r = rmPadding(r);
  s = rmPadding(s);

  while (!s[0] && !(s[1] & 0x80)) {
    s = s.slice(1);
  }
  var arr = [ 0x02 ];
  constructLength(arr, r.length);
  arr = arr.concat(r);
  arr.push(0x02);
  constructLength(arr, s.length);
  var backHalf = arr.concat(s);
  var res = [ 0x30 ];
  constructLength(res, backHalf.length);
  res = res.concat(backHalf);
  return utils_1$1.encode(res, enc);
};





var rand = /*RicMoo:ethers:require(brorand)*/(function() { throw new Error('unsupported'); });
var assert$5 = utils_1$1.assert;




function EC(options) {
  if (!(this instanceof EC))
    return new EC(options);

  // Shortcut `elliptic.ec(curve-name)`
  if (typeof options === 'string') {
    assert$5(Object.prototype.hasOwnProperty.call(curves_1, options),
      'Unknown curve ' + options);

    options = curves_1[options];
  }

  // Shortcut for `elliptic.ec(elliptic.curves.curveName)`
  if (options instanceof curves_1.PresetCurve)
    options = { curve: options };

  this.curve = options.curve.curve;
  this.n = this.curve.n;
  this.nh = this.n.ushrn(1);
  this.g = this.curve.g;

  // Point on curve
  this.g = options.curve.g;
  this.g.precompute(options.curve.n.bitLength() + 1);

  // Hash for function for DRBG
  this.hash = options.hash || options.curve.hash;
}
var ec = EC;

EC.prototype.keyPair = function keyPair(options) {
  return new key(this, options);
};

EC.prototype.keyFromPrivate = function keyFromPrivate(priv, enc) {
  return key.fromPrivate(this, priv, enc);
};

EC.prototype.keyFromPublic = function keyFromPublic(pub, enc) {
  return key.fromPublic(this, pub, enc);
};

EC.prototype.genKeyPair = function genKeyPair(options) {
  if (!options)
    options = {};

  // Instantiate Hmac_DRBG
  var drbg = new hmacDrbg({
    hash: this.hash,
    pers: options.pers,
    persEnc: options.persEnc || 'utf8',
    entropy: options.entropy || rand(this.hash.hmacStrength),
    entropyEnc: options.entropy && options.entropyEnc || 'utf8',
    nonce: this.n.toArray(),
  });

  var bytes = this.n.byteLength();
  var ns2 = this.n.sub(new BN$1(2));
  for (;;) {
    var priv = new BN$1(drbg.generate(bytes));
    if (priv.cmp(ns2) > 0)
      continue;

    priv.iaddn(1);
    return this.keyFromPrivate(priv);
  }
};

EC.prototype._truncateToN = function _truncateToN(msg, truncOnly) {
  var delta = msg.byteLength() * 8 - this.n.bitLength();
  if (delta > 0)
    msg = msg.ushrn(delta);
  if (!truncOnly && msg.cmp(this.n) >= 0)
    return msg.sub(this.n);
  else
    return msg;
};

EC.prototype.sign = function sign(msg, key, enc, options) {
  if (typeof enc === 'object') {
    options = enc;
    enc = null;
  }
  if (!options)
    options = {};

  key = this.keyFromPrivate(key, enc);
  msg = this._truncateToN(new BN$1(msg, 16));

  // Zero-extend key to provide enough entropy
  var bytes = this.n.byteLength();
  var bkey = key.getPrivate().toArray('be', bytes);

  // Zero-extend nonce to have the same byte size as N
  var nonce = msg.toArray('be', bytes);

  // Instantiate Hmac_DRBG
  var drbg = new hmacDrbg({
    hash: this.hash,
    entropy: bkey,
    nonce: nonce,
    pers: options.pers,
    persEnc: options.persEnc || 'utf8',
  });

  // Number of bytes to generate
  var ns1 = this.n.sub(new BN$1(1));

  for (var iter = 0; ; iter++) {
    var k = options.k ?
      options.k(iter) :
      new BN$1(drbg.generate(this.n.byteLength()));
    k = this._truncateToN(k, true);
    if (k.cmpn(1) <= 0 || k.cmp(ns1) >= 0)
      continue;

    var kp = this.g.mul(k);
    if (kp.isInfinity())
      continue;

    var kpX = kp.getX();
    var r = kpX.umod(this.n);
    if (r.cmpn(0) === 0)
      continue;

    var s = k.invm(this.n).mul(r.mul(key.getPrivate()).iadd(msg));
    s = s.umod(this.n);
    if (s.cmpn(0) === 0)
      continue;

    var recoveryParam = (kp.getY().isOdd() ? 1 : 0) |
                        (kpX.cmp(r) !== 0 ? 2 : 0);

    // Use complement of `s`, if it is > `n / 2`
    if (options.canonical && s.cmp(this.nh) > 0) {
      s = this.n.sub(s);
      recoveryParam ^= 1;
    }

    return new signature({ r: r, s: s, recoveryParam: recoveryParam });
  }
};

EC.prototype.verify = function verify(msg, signature$1, key, enc) {
  msg = this._truncateToN(new BN$1(msg, 16));
  key = this.keyFromPublic(key, enc);
  signature$1 = new signature(signature$1, 'hex');

  // Perform primitive values validation
  var r = signature$1.r;
  var s = signature$1.s;
  if (r.cmpn(1) < 0 || r.cmp(this.n) >= 0)
    return false;
  if (s.cmpn(1) < 0 || s.cmp(this.n) >= 0)
    return false;

  // Validate signature
  var sinv = s.invm(this.n);
  var u1 = sinv.mul(msg).umod(this.n);
  var u2 = sinv.mul(r).umod(this.n);
  var p;

  if (!this.curve._maxwellTrick) {
    p = this.g.mulAdd(u1, key.getPublic(), u2);
    if (p.isInfinity())
      return false;

    return p.getX().umod(this.n).cmp(r) === 0;
  }

  // NOTE: Greg Maxwell's trick, inspired by:
  // https://git.io/vad3K

  p = this.g.jmulAdd(u1, key.getPublic(), u2);
  if (p.isInfinity())
    return false;

  // Compare `p.x` of Jacobian point with `r`,
  // this will do `p.x == r * p.z^2` instead of multiplying `p.x` by the
  // inverse of `p.z^2`
  return p.eqXToP(r);
};

EC.prototype.recoverPubKey = function(msg, signature$1, j, enc) {
  assert$5((3 & j) === j, 'The recovery param is more than two bits');
  signature$1 = new signature(signature$1, enc);

  var n = this.n;
  var e = new BN$1(msg);
  var r = signature$1.r;
  var s = signature$1.s;

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = j & 1;
  var isSecondKey = j >> 1;
  if (r.cmp(this.curve.p.umod(this.curve.n)) >= 0 && isSecondKey)
    throw new Error('Unable to find sencond key candinate');

  // 1.1. Let x = r + jn.
  if (isSecondKey)
    r = this.curve.pointFromX(r.add(this.curve.n), isYOdd);
  else
    r = this.curve.pointFromX(r, isYOdd);

  var rInv = signature$1.r.invm(n);
  var s1 = n.sub(e).mul(rInv).umod(n);
  var s2 = s.mul(rInv).umod(n);

  // 1.6.1 Compute Q = r^-1 (sR -  eG)
  //               Q = r^-1 (sR + -eG)
  return this.g.mulAdd(s1, r, s2);
};

EC.prototype.getKeyRecoveryParam = function(e, signature$1, Q, enc) {
  signature$1 = new signature(signature$1, enc);
  if (signature$1.recoveryParam !== null)
    return signature$1.recoveryParam;

  for (var i = 0; i < 4; i++) {
    var Qprime;
    try {
      Qprime = this.recoverPubKey(e, signature$1, i);
    } catch (e) {
      continue;
    }

    if (Qprime.eq(Q))
      return i;
  }
  throw new Error('Unable to find valid recovery factor');
};

var elliptic_1 = createCommonjsModule(function (module, exports) {

var elliptic = exports;

elliptic.version = /*RicMoo:ethers*/{ version: "6.5.4" }.version;
elliptic.utils = utils_1$1;
elliptic.rand = /*RicMoo:ethers:require(brorand)*/(function() { throw new Error('unsupported'); });
elliptic.curve = curve_1;
elliptic.curves = curves_1;

// Protocols
elliptic.ec = ec;
elliptic.eddsa = /*RicMoo:ethers:require(./elliptic/eddsa)*/(null);
});

var EC$1 = elliptic_1.ec;

const version$b = "signing-key/5.7.0";

const logger$e = new Logger$2(version$b);
let _curve = null;
function getCurve() {
    if (!_curve) {
        _curve = new EC$1("secp256k1");
    }
    return _curve;
}
class SigningKey {
    constructor(privateKey) {
        defineReadOnly$1(this, "curve", "secp256k1");
        defineReadOnly$1(this, "privateKey", hexlify(privateKey));
        if (hexDataLength(this.privateKey) !== 32) {
            logger$e.throwArgumentError("invalid private key", "privateKey", "[[ REDACTED ]]");
        }
        const keyPair = getCurve().keyFromPrivate(arrayify(this.privateKey));
        defineReadOnly$1(this, "publicKey", "0x" + keyPair.getPublic(false, "hex"));
        defineReadOnly$1(this, "compressedPublicKey", "0x" + keyPair.getPublic(true, "hex"));
        defineReadOnly$1(this, "_isSigningKey", true);
    }
    _addPoint(other) {
        const p0 = getCurve().keyFromPublic(arrayify(this.publicKey));
        const p1 = getCurve().keyFromPublic(arrayify(other));
        return "0x" + p0.pub.add(p1.pub).encodeCompressed("hex");
    }
    signDigest(digest) {
        const keyPair = getCurve().keyFromPrivate(arrayify(this.privateKey));
        const digestBytes = arrayify(digest);
        if (digestBytes.length !== 32) {
            logger$e.throwArgumentError("bad digest length", "digest", digest);
        }
        const signature = keyPair.sign(digestBytes, { canonical: true });
        return splitSignature({
            recoveryParam: signature.recoveryParam,
            r: hexZeroPad("0x" + signature.r.toString(16), 32),
            s: hexZeroPad("0x" + signature.s.toString(16), 32),
        });
    }
    computeSharedSecret(otherKey) {
        const keyPair = getCurve().keyFromPrivate(arrayify(this.privateKey));
        const otherKeyPair = getCurve().keyFromPublic(arrayify(computePublicKey(otherKey)));
        return hexZeroPad("0x" + keyPair.derive(otherKeyPair.getPublic()).toString(16), 32);
    }
    static isSigningKey(value) {
        return !!(value && value._isSigningKey);
    }
}
function recoverPublicKey(digest, signature) {
    const sig = splitSignature(signature);
    const rs = { r: arrayify(sig.r), s: arrayify(sig.s) };
    return "0x" + getCurve().recoverPubKey(arrayify(digest), rs, sig.recoveryParam).encode("hex", false);
}
function computePublicKey(key, compressed) {
    const bytes = arrayify(key);
    if (bytes.length === 32) {
        const signingKey = new SigningKey(bytes);
        if (compressed) {
            return "0x" + getCurve().keyFromPrivate(bytes).getPublic(true, "hex");
        }
        return signingKey.publicKey;
    }
    else if (bytes.length === 33) {
        if (compressed) {
            return hexlify(bytes);
        }
        return "0x" + getCurve().keyFromPublic(bytes).getPublic(false, "hex");
    }
    else if (bytes.length === 65) {
        if (!compressed) {
            return hexlify(bytes);
        }
        return "0x" + getCurve().keyFromPublic(bytes).getPublic(true, "hex");
    }
    return logger$e.throwArgumentError("invalid public or private key", "key", "[REDACTED]");
}

const version$a = "transactions/5.7.0";

const logger$d = new Logger$2(version$a);
var TransactionTypes;
(function (TransactionTypes) {
    TransactionTypes[TransactionTypes["legacy"] = 0] = "legacy";
    TransactionTypes[TransactionTypes["eip2930"] = 1] = "eip2930";
    TransactionTypes[TransactionTypes["eip1559"] = 2] = "eip1559";
})(TransactionTypes || (TransactionTypes = {}));
///////////////////////////////
function handleAddress(value) {
    if (value === "0x") {
        return null;
    }
    return getAddress(value);
}
function handleNumber(value) {
    if (value === "0x") {
        return Zero$1;
    }
    return BigNumber.from(value);
}
// Legacy Transaction Fields
const transactionFields = [
    { name: "nonce", maxLength: 32, numeric: true },
    { name: "gasPrice", maxLength: 32, numeric: true },
    { name: "gasLimit", maxLength: 32, numeric: true },
    { name: "to", length: 20 },
    { name: "value", maxLength: 32, numeric: true },
    { name: "data" },
];
const allowedTransactionKeys$1 = {
    chainId: true, data: true, gasLimit: true, gasPrice: true, nonce: true, to: true, type: true, value: true
};
function computeAddress(key) {
    const publicKey = computePublicKey(key);
    return getAddress(hexDataSlice(keccak256(hexDataSlice(publicKey, 1)), 12));
}
function recoverAddress(digest, signature) {
    return computeAddress(recoverPublicKey(arrayify(digest), signature));
}
function formatNumber(value, name) {
    const result = stripZeros(BigNumber.from(value).toHexString());
    if (result.length > 32) {
        logger$d.throwArgumentError("invalid length for " + name, ("transaction:" + name), value);
    }
    return result;
}
function accessSetify(addr, storageKeys) {
    return {
        address: getAddress(addr),
        storageKeys: (storageKeys || []).map((storageKey, index) => {
            if (hexDataLength(storageKey) !== 32) {
                logger$d.throwArgumentError("invalid access list storageKey", `accessList[${addr}:${index}]`, storageKey);
            }
            return storageKey.toLowerCase();
        })
    };
}
function accessListify(value) {
    if (Array.isArray(value)) {
        return value.map((set, index) => {
            if (Array.isArray(set)) {
                if (set.length > 2) {
                    logger$d.throwArgumentError("access list expected to be [ address, storageKeys[] ]", `value[${index}]`, set);
                }
                return accessSetify(set[0], set[1]);
            }
            return accessSetify(set.address, set.storageKeys);
        });
    }
    const result = Object.keys(value).map((addr) => {
        const storageKeys = value[addr].reduce((accum, storageKey) => {
            accum[storageKey] = true;
            return accum;
        }, {});
        return accessSetify(addr, Object.keys(storageKeys).sort());
    });
    result.sort((a, b) => (a.address.localeCompare(b.address)));
    return result;
}
function formatAccessList(value) {
    return accessListify(value).map((set) => [set.address, set.storageKeys]);
}
function _serializeEip1559(transaction, signature) {
    // If there is an explicit gasPrice, make sure it matches the
    // EIP-1559 fees; otherwise they may not understand what they
    // think they are setting in terms of fee.
    if (transaction.gasPrice != null) {
        const gasPrice = BigNumber.from(transaction.gasPrice);
        const maxFeePerGas = BigNumber.from(transaction.maxFeePerGas || 0);
        if (!gasPrice.eq(maxFeePerGas)) {
            logger$d.throwArgumentError("mismatch EIP-1559 gasPrice != maxFeePerGas", "tx", {
                gasPrice, maxFeePerGas
            });
        }
    }
    const fields = [
        formatNumber(transaction.chainId || 0, "chainId"),
        formatNumber(transaction.nonce || 0, "nonce"),
        formatNumber(transaction.maxPriorityFeePerGas || 0, "maxPriorityFeePerGas"),
        formatNumber(transaction.maxFeePerGas || 0, "maxFeePerGas"),
        formatNumber(transaction.gasLimit || 0, "gasLimit"),
        ((transaction.to != null) ? getAddress(transaction.to) : "0x"),
        formatNumber(transaction.value || 0, "value"),
        (transaction.data || "0x"),
        (formatAccessList(transaction.accessList || []))
    ];
    if (signature) {
        const sig = splitSignature(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push(stripZeros(sig.r));
        fields.push(stripZeros(sig.s));
    }
    return hexConcat(["0x02", encode$2(fields)]);
}
function _serializeEip2930(transaction, signature) {
    const fields = [
        formatNumber(transaction.chainId || 0, "chainId"),
        formatNumber(transaction.nonce || 0, "nonce"),
        formatNumber(transaction.gasPrice || 0, "gasPrice"),
        formatNumber(transaction.gasLimit || 0, "gasLimit"),
        ((transaction.to != null) ? getAddress(transaction.to) : "0x"),
        formatNumber(transaction.value || 0, "value"),
        (transaction.data || "0x"),
        (formatAccessList(transaction.accessList || []))
    ];
    if (signature) {
        const sig = splitSignature(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push(stripZeros(sig.r));
        fields.push(stripZeros(sig.s));
    }
    return hexConcat(["0x01", encode$2(fields)]);
}
// Legacy Transactions and EIP-155
function _serialize(transaction, signature) {
    checkProperties(transaction, allowedTransactionKeys$1);
    const raw = [];
    transactionFields.forEach(function (fieldInfo) {
        let value = transaction[fieldInfo.name] || ([]);
        const options = {};
        if (fieldInfo.numeric) {
            options.hexPad = "left";
        }
        value = arrayify(hexlify(value, options));
        // Fixed-width field
        if (fieldInfo.length && value.length !== fieldInfo.length && value.length > 0) {
            logger$d.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value);
        }
        // Variable-width (with a maximum)
        if (fieldInfo.maxLength) {
            value = stripZeros(value);
            if (value.length > fieldInfo.maxLength) {
                logger$d.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value);
            }
        }
        raw.push(hexlify(value));
    });
    let chainId = 0;
    if (transaction.chainId != null) {
        // A chainId was provided; if non-zero we'll use EIP-155
        chainId = transaction.chainId;
        if (typeof (chainId) !== "number") {
            logger$d.throwArgumentError("invalid transaction.chainId", "transaction", transaction);
        }
    }
    else if (signature && !isBytesLike(signature) && signature.v > 28) {
        // No chainId provided, but the signature is signing with EIP-155; derive chainId
        chainId = Math.floor((signature.v - 35) / 2);
    }
    // We have an EIP-155 transaction (chainId was specified and non-zero)
    if (chainId !== 0) {
        raw.push(hexlify(chainId)); // @TODO: hexValue?
        raw.push("0x");
        raw.push("0x");
    }
    // Requesting an unsigned transaction
    if (!signature) {
        return encode$2(raw);
    }
    // The splitSignature will ensure the transaction has a recoveryParam in the
    // case that the signTransaction function only adds a v.
    const sig = splitSignature(signature);
    // We pushed a chainId and null r, s on for hashing only; remove those
    let v = 27 + sig.recoveryParam;
    if (chainId !== 0) {
        raw.pop();
        raw.pop();
        raw.pop();
        v += chainId * 2 + 8;
        // If an EIP-155 v (directly or indirectly; maybe _vs) was provided, check it!
        if (sig.v > 28 && sig.v !== v) {
            logger$d.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
        }
    }
    else if (sig.v !== v) {
        logger$d.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
    }
    raw.push(hexlify(v));
    raw.push(stripZeros(arrayify(sig.r)));
    raw.push(stripZeros(arrayify(sig.s)));
    return encode$2(raw);
}
function serialize(transaction, signature) {
    // Legacy and EIP-155 Transactions
    if (transaction.type == null || transaction.type === 0) {
        if (transaction.accessList != null) {
            logger$d.throwArgumentError("untyped transactions do not support accessList; include type: 1", "transaction", transaction);
        }
        return _serialize(transaction, signature);
    }
    // Typed Transactions (EIP-2718)
    switch (transaction.type) {
        case 1:
            return _serializeEip2930(transaction, signature);
        case 2:
            return _serializeEip1559(transaction, signature);
    }
    return logger$d.throwError(`unsupported transaction type: ${transaction.type}`, Logger$2.errors.UNSUPPORTED_OPERATION, {
        operation: "serializeTransaction",
        transactionType: transaction.type
    });
}
function _parseEipSignature(tx, fields, serialize) {
    try {
        const recid = handleNumber(fields[0]).toNumber();
        if (recid !== 0 && recid !== 1) {
            throw new Error("bad recid");
        }
        tx.v = recid;
    }
    catch (error) {
        logger$d.throwArgumentError("invalid v for transaction type: 1", "v", fields[0]);
    }
    tx.r = hexZeroPad(fields[1], 32);
    tx.s = hexZeroPad(fields[2], 32);
    try {
        const digest = keccak256(serialize(tx));
        tx.from = recoverAddress(digest, { r: tx.r, s: tx.s, recoveryParam: tx.v });
    }
    catch (error) { }
}
function _parseEip1559(payload) {
    const transaction = decode$2(payload.slice(1));
    if (transaction.length !== 9 && transaction.length !== 12) {
        logger$d.throwArgumentError("invalid component count for transaction type: 2", "payload", hexlify(payload));
    }
    const maxPriorityFeePerGas = handleNumber(transaction[2]);
    const maxFeePerGas = handleNumber(transaction[3]);
    const tx = {
        type: 2,
        chainId: handleNumber(transaction[0]).toNumber(),
        nonce: handleNumber(transaction[1]).toNumber(),
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        maxFeePerGas: maxFeePerGas,
        gasPrice: null,
        gasLimit: handleNumber(transaction[4]),
        to: handleAddress(transaction[5]),
        value: handleNumber(transaction[6]),
        data: transaction[7],
        accessList: accessListify(transaction[8]),
    };
    // Unsigned EIP-1559 Transaction
    if (transaction.length === 9) {
        return tx;
    }
    tx.hash = keccak256(payload);
    _parseEipSignature(tx, transaction.slice(9), _serializeEip1559);
    return tx;
}
function _parseEip2930(payload) {
    const transaction = decode$2(payload.slice(1));
    if (transaction.length !== 8 && transaction.length !== 11) {
        logger$d.throwArgumentError("invalid component count for transaction type: 1", "payload", hexlify(payload));
    }
    const tx = {
        type: 1,
        chainId: handleNumber(transaction[0]).toNumber(),
        nonce: handleNumber(transaction[1]).toNumber(),
        gasPrice: handleNumber(transaction[2]),
        gasLimit: handleNumber(transaction[3]),
        to: handleAddress(transaction[4]),
        value: handleNumber(transaction[5]),
        data: transaction[6],
        accessList: accessListify(transaction[7])
    };
    // Unsigned EIP-2930 Transaction
    if (transaction.length === 8) {
        return tx;
    }
    tx.hash = keccak256(payload);
    _parseEipSignature(tx, transaction.slice(8), _serializeEip2930);
    return tx;
}
// Legacy Transactions and EIP-155
function _parse(rawTransaction) {
    const transaction = decode$2(rawTransaction);
    if (transaction.length !== 9 && transaction.length !== 6) {
        logger$d.throwArgumentError("invalid raw transaction", "rawTransaction", rawTransaction);
    }
    const tx = {
        nonce: handleNumber(transaction[0]).toNumber(),
        gasPrice: handleNumber(transaction[1]),
        gasLimit: handleNumber(transaction[2]),
        to: handleAddress(transaction[3]),
        value: handleNumber(transaction[4]),
        data: transaction[5],
        chainId: 0
    };
    // Legacy unsigned transaction
    if (transaction.length === 6) {
        return tx;
    }
    try {
        tx.v = BigNumber.from(transaction[6]).toNumber();
    }
    catch (error) {
        // @TODO: What makes snese to do? The v is too big
        return tx;
    }
    tx.r = hexZeroPad(transaction[7], 32);
    tx.s = hexZeroPad(transaction[8], 32);
    if (BigNumber.from(tx.r).isZero() && BigNumber.from(tx.s).isZero()) {
        // EIP-155 unsigned transaction
        tx.chainId = tx.v;
        tx.v = 0;
    }
    else {
        // Signed Transaction
        tx.chainId = Math.floor((tx.v - 35) / 2);
        if (tx.chainId < 0) {
            tx.chainId = 0;
        }
        let recoveryParam = tx.v - 27;
        const raw = transaction.slice(0, 6);
        if (tx.chainId !== 0) {
            raw.push(hexlify(tx.chainId));
            raw.push("0x");
            raw.push("0x");
            recoveryParam -= tx.chainId * 2 + 8;
        }
        const digest = keccak256(encode$2(raw));
        try {
            tx.from = recoverAddress(digest, { r: hexlify(tx.r), s: hexlify(tx.s), recoveryParam: recoveryParam });
        }
        catch (error) { }
        tx.hash = keccak256(rawTransaction);
    }
    tx.type = null;
    return tx;
}
function parse(rawTransaction) {
    const payload = arrayify(rawTransaction);
    // Legacy and EIP-155 Transactions
    if (payload[0] > 0x7f) {
        return _parse(payload);
    }
    // Typed Transaction (EIP-2718)
    switch (payload[0]) {
        case 1:
            return _parseEip2930(payload);
        case 2:
            return _parseEip1559(payload);
    }
    return logger$d.throwError(`unsupported transaction type: ${payload[0]}`, Logger$2.errors.UNSUPPORTED_OPERATION, {
        operation: "parseTransaction",
        transactionType: payload[0]
    });
}

const version$9 = "wordlists/5.7.0";

const logger$c = new Logger$2(version$9);
class Wordlist {
    constructor(locale) {
        logger$c.checkAbstract(new.target, Wordlist);
        defineReadOnly$1(this, "locale", locale);
    }
    // Subclasses may override this
    split(mnemonic) {
        return mnemonic.toLowerCase().split(/ +/g);
    }
    // Subclasses may override this
    join(words) {
        return words.join(" ");
    }
    static check(wordlist) {
        const words = [];
        for (let i = 0; i < 2048; i++) {
            const word = wordlist.getWord(i);
            /* istanbul ignore if */
            if (i !== wordlist.getWordIndex(word)) {
                return "0x";
            }
            words.push(word);
        }
        return id(words.join("\n") + "\n");
    }
    static register(lang, name) {
        if (!name) {
            name = lang.locale;
        }
    }
}

const words = "AbandonAbilityAbleAboutAboveAbsentAbsorbAbstractAbsurdAbuseAccessAccidentAccountAccuseAchieveAcidAcousticAcquireAcrossActActionActorActressActualAdaptAddAddictAddressAdjustAdmitAdultAdvanceAdviceAerobicAffairAffordAfraidAgainAgeAgentAgreeAheadAimAirAirportAisleAlarmAlbumAlcoholAlertAlienAllAlleyAllowAlmostAloneAlphaAlreadyAlsoAlterAlwaysAmateurAmazingAmongAmountAmusedAnalystAnchorAncientAngerAngleAngryAnimalAnkleAnnounceAnnualAnotherAnswerAntennaAntiqueAnxietyAnyApartApologyAppearAppleApproveAprilArchArcticAreaArenaArgueArmArmedArmorArmyAroundArrangeArrestArriveArrowArtArtefactArtistArtworkAskAspectAssaultAssetAssistAssumeAsthmaAthleteAtomAttackAttendAttitudeAttractAuctionAuditAugustAuntAuthorAutoAutumnAverageAvocadoAvoidAwakeAwareAwayAwesomeAwfulAwkwardAxisBabyBachelorBaconBadgeBagBalanceBalconyBallBambooBananaBannerBarBarelyBargainBarrelBaseBasicBasketBattleBeachBeanBeautyBecauseBecomeBeefBeforeBeginBehaveBehindBelieveBelowBeltBenchBenefitBestBetrayBetterBetweenBeyondBicycleBidBikeBindBiologyBirdBirthBitterBlackBladeBlameBlanketBlastBleakBlessBlindBloodBlossomBlouseBlueBlurBlushBoardBoatBodyBoilBombBoneBonusBookBoostBorderBoringBorrowBossBottomBounceBoxBoyBracketBrainBrandBrassBraveBreadBreezeBrickBridgeBriefBrightBringBriskBroccoliBrokenBronzeBroomBrotherBrownBrushBubbleBuddyBudgetBuffaloBuildBulbBulkBulletBundleBunkerBurdenBurgerBurstBusBusinessBusyButterBuyerBuzzCabbageCabinCableCactusCageCakeCallCalmCameraCampCanCanalCancelCandyCannonCanoeCanvasCanyonCapableCapitalCaptainCarCarbonCardCargoCarpetCarryCartCaseCashCasinoCastleCasualCatCatalogCatchCategoryCattleCaughtCauseCautionCaveCeilingCeleryCementCensusCenturyCerealCertainChairChalkChampionChangeChaosChapterChargeChaseChatCheapCheckCheeseChefCherryChestChickenChiefChildChimneyChoiceChooseChronicChuckleChunkChurnCigarCinnamonCircleCitizenCityCivilClaimClapClarifyClawClayCleanClerkCleverClickClientCliffClimbClinicClipClockClogCloseClothCloudClownClubClumpClusterClutchCoachCoastCoconutCodeCoffeeCoilCoinCollectColorColumnCombineComeComfortComicCommonCompanyConcertConductConfirmCongressConnectConsiderControlConvinceCookCoolCopperCopyCoralCoreCornCorrectCostCottonCouchCountryCoupleCourseCousinCoverCoyoteCrackCradleCraftCramCraneCrashCraterCrawlCrazyCreamCreditCreekCrewCricketCrimeCrispCriticCropCrossCrouchCrowdCrucialCruelCruiseCrumbleCrunchCrushCryCrystalCubeCultureCupCupboardCuriousCurrentCurtainCurveCushionCustomCuteCycleDadDamageDampDanceDangerDaringDashDaughterDawnDayDealDebateDebrisDecadeDecemberDecideDeclineDecorateDecreaseDeerDefenseDefineDefyDegreeDelayDeliverDemandDemiseDenialDentistDenyDepartDependDepositDepthDeputyDeriveDescribeDesertDesignDeskDespairDestroyDetailDetectDevelopDeviceDevoteDiagramDialDiamondDiaryDiceDieselDietDifferDigitalDignityDilemmaDinnerDinosaurDirectDirtDisagreeDiscoverDiseaseDishDismissDisorderDisplayDistanceDivertDivideDivorceDizzyDoctorDocumentDogDollDolphinDomainDonateDonkeyDonorDoorDoseDoubleDoveDraftDragonDramaDrasticDrawDreamDressDriftDrillDrinkDripDriveDropDrumDryDuckDumbDuneDuringDustDutchDutyDwarfDynamicEagerEagleEarlyEarnEarthEasilyEastEasyEchoEcologyEconomyEdgeEditEducateEffortEggEightEitherElbowElderElectricElegantElementElephantElevatorEliteElseEmbarkEmbodyEmbraceEmergeEmotionEmployEmpowerEmptyEnableEnactEndEndlessEndorseEnemyEnergyEnforceEngageEngineEnhanceEnjoyEnlistEnoughEnrichEnrollEnsureEnterEntireEntryEnvelopeEpisodeEqualEquipEraEraseErodeErosionErrorEruptEscapeEssayEssenceEstateEternalEthicsEvidenceEvilEvokeEvolveExactExampleExcessExchangeExciteExcludeExcuseExecuteExerciseExhaustExhibitExileExistExitExoticExpandExpectExpireExplainExposeExpressExtendExtraEyeEyebrowFabricFaceFacultyFadeFaintFaithFallFalseFameFamilyFamousFanFancyFantasyFarmFashionFatFatalFatherFatigueFaultFavoriteFeatureFebruaryFederalFeeFeedFeelFemaleFenceFestivalFetchFeverFewFiberFictionFieldFigureFileFilmFilterFinalFindFineFingerFinishFireFirmFirstFiscalFishFitFitnessFixFlagFlameFlashFlatFlavorFleeFlightFlipFloatFlockFloorFlowerFluidFlushFlyFoamFocusFogFoilFoldFollowFoodFootForceForestForgetForkFortuneForumForwardFossilFosterFoundFoxFragileFrameFrequentFreshFriendFringeFrogFrontFrostFrownFrozenFruitFuelFunFunnyFurnaceFuryFutureGadgetGainGalaxyGalleryGameGapGarageGarbageGardenGarlicGarmentGasGaspGateGatherGaugeGazeGeneralGeniusGenreGentleGenuineGestureGhostGiantGiftGiggleGingerGiraffeGirlGiveGladGlanceGlareGlassGlideGlimpseGlobeGloomGloryGloveGlowGlueGoatGoddessGoldGoodGooseGorillaGospelGossipGovernGownGrabGraceGrainGrantGrapeGrassGravityGreatGreenGridGriefGritGroceryGroupGrowGruntGuardGuessGuideGuiltGuitarGunGymHabitHairHalfHammerHamsterHandHappyHarborHardHarshHarvestHatHaveHawkHazardHeadHealthHeartHeavyHedgehogHeightHelloHelmetHelpHenHeroHiddenHighHillHintHipHireHistoryHobbyHockeyHoldHoleHolidayHollowHomeHoneyHoodHopeHornHorrorHorseHospitalHostHotelHourHoverHubHugeHumanHumbleHumorHundredHungryHuntHurdleHurryHurtHusbandHybridIceIconIdeaIdentifyIdleIgnoreIllIllegalIllnessImageImitateImmenseImmuneImpactImposeImproveImpulseInchIncludeIncomeIncreaseIndexIndicateIndoorIndustryInfantInflictInformInhaleInheritInitialInjectInjuryInmateInnerInnocentInputInquiryInsaneInsectInsideInspireInstallIntactInterestIntoInvestInviteInvolveIronIslandIsolateIssueItemIvoryJacketJaguarJarJazzJealousJeansJellyJewelJobJoinJokeJourneyJoyJudgeJuiceJumpJungleJuniorJunkJustKangarooKeenKeepKetchupKeyKickKidKidneyKindKingdomKissKitKitchenKiteKittenKiwiKneeKnifeKnockKnowLabLabelLaborLadderLadyLakeLampLanguageLaptopLargeLaterLatinLaughLaundryLavaLawLawnLawsuitLayerLazyLeaderLeafLearnLeaveLectureLeftLegLegalLegendLeisureLemonLendLengthLensLeopardLessonLetterLevelLiarLibertyLibraryLicenseLifeLiftLightLikeLimbLimitLinkLionLiquidListLittleLiveLizardLoadLoanLobsterLocalLockLogicLonelyLongLoopLotteryLoudLoungeLoveLoyalLuckyLuggageLumberLunarLunchLuxuryLyricsMachineMadMagicMagnetMaidMailMainMajorMakeMammalManManageMandateMangoMansionManualMapleMarbleMarchMarginMarineMarketMarriageMaskMassMasterMatchMaterialMathMatrixMatterMaximumMazeMeadowMeanMeasureMeatMechanicMedalMediaMelodyMeltMemberMemoryMentionMenuMercyMergeMeritMerryMeshMessageMetalMethodMiddleMidnightMilkMillionMimicMindMinimumMinorMinuteMiracleMirrorMiseryMissMistakeMixMixedMixtureMobileModelModifyMomMomentMonitorMonkeyMonsterMonthMoonMoralMoreMorningMosquitoMotherMotionMotorMountainMouseMoveMovieMuchMuffinMuleMultiplyMuscleMuseumMushroomMusicMustMutualMyselfMysteryMythNaiveNameNapkinNarrowNastyNationNatureNearNeckNeedNegativeNeglectNeitherNephewNerveNestNetNetworkNeutralNeverNewsNextNiceNightNobleNoiseNomineeNoodleNormalNorthNoseNotableNoteNothingNoticeNovelNowNuclearNumberNurseNutOakObeyObjectObligeObscureObserveObtainObviousOccurOceanOctoberOdorOffOfferOfficeOftenOilOkayOldOliveOlympicOmitOnceOneOnionOnlineOnlyOpenOperaOpinionOpposeOptionOrangeOrbitOrchardOrderOrdinaryOrganOrientOriginalOrphanOstrichOtherOutdoorOuterOutputOutsideOvalOvenOverOwnOwnerOxygenOysterOzonePactPaddlePagePairPalacePalmPandaPanelPanicPantherPaperParadeParentParkParrotPartyPassPatchPathPatientPatrolPatternPausePavePaymentPeacePeanutPearPeasantPelicanPenPenaltyPencilPeoplePepperPerfectPermitPersonPetPhonePhotoPhrasePhysicalPianoPicnicPicturePiecePigPigeonPillPilotPinkPioneerPipePistolPitchPizzaPlacePlanetPlasticPlatePlayPleasePledgePluckPlugPlungePoemPoetPointPolarPolePolicePondPonyPoolPopularPortionPositionPossiblePostPotatoPotteryPovertyPowderPowerPracticePraisePredictPreferPreparePresentPrettyPreventPricePridePrimaryPrintPriorityPrisonPrivatePrizeProblemProcessProduceProfitProgramProjectPromoteProofPropertyProsperProtectProudProvidePublicPuddingPullPulpPulsePumpkinPunchPupilPuppyPurchasePurityPurposePursePushPutPuzzlePyramidQualityQuantumQuarterQuestionQuickQuitQuizQuoteRabbitRaccoonRaceRackRadarRadioRailRainRaiseRallyRampRanchRandomRangeRapidRareRateRatherRavenRawRazorReadyRealReasonRebelRebuildRecallReceiveRecipeRecordRecycleReduceReflectReformRefuseRegionRegretRegularRejectRelaxReleaseReliefRelyRemainRememberRemindRemoveRenderRenewRentReopenRepairRepeatReplaceReportRequireRescueResembleResistResourceResponseResultRetireRetreatReturnReunionRevealReviewRewardRhythmRibRibbonRiceRichRideRidgeRifleRightRigidRingRiotRippleRiskRitualRivalRiverRoadRoastRobotRobustRocketRomanceRoofRookieRoomRoseRotateRoughRoundRouteRoyalRubberRudeRugRuleRunRunwayRuralSadSaddleSadnessSafeSailSaladSalmonSalonSaltSaluteSameSampleSandSatisfySatoshiSauceSausageSaveSayScaleScanScareScatterSceneSchemeSchoolScienceScissorsScorpionScoutScrapScreenScriptScrubSeaSearchSeasonSeatSecondSecretSectionSecuritySeedSeekSegmentSelectSellSeminarSeniorSenseSentenceSeriesServiceSessionSettleSetupSevenShadowShaftShallowShareShedShellSheriffShieldShiftShineShipShiverShockShoeShootShopShortShoulderShoveShrimpShrugShuffleShySiblingSickSideSiegeSightSignSilentSilkSillySilverSimilarSimpleSinceSingSirenSisterSituateSixSizeSkateSketchSkiSkillSkinSkirtSkullSlabSlamSleepSlenderSliceSlideSlightSlimSloganSlotSlowSlushSmallSmartSmileSmokeSmoothSnackSnakeSnapSniffSnowSoapSoccerSocialSockSodaSoftSolarSoldierSolidSolutionSolveSomeoneSongSoonSorrySortSoulSoundSoupSourceSouthSpaceSpareSpatialSpawnSpeakSpecialSpeedSpellSpendSphereSpiceSpiderSpikeSpinSpiritSplitSpoilSponsorSpoonSportSpotSpraySpreadSpringSpySquareSqueezeSquirrelStableStadiumStaffStageStairsStampStandStartStateStaySteakSteelStemStepStereoStickStillStingStockStomachStoneStoolStoryStoveStrategyStreetStrikeStrongStruggleStudentStuffStumbleStyleSubjectSubmitSubwaySuccessSuchSuddenSufferSugarSuggestSuitSummerSunSunnySunsetSuperSupplySupremeSureSurfaceSurgeSurpriseSurroundSurveySuspectSustainSwallowSwampSwapSwarmSwearSweetSwiftSwimSwingSwitchSwordSymbolSymptomSyrupSystemTableTackleTagTailTalentTalkTankTapeTargetTaskTasteTattooTaxiTeachTeamTellTenTenantTennisTentTermTestTextThankThatThemeThenTheoryThereTheyThingThisThoughtThreeThriveThrowThumbThunderTicketTideTigerTiltTimberTimeTinyTipTiredTissueTitleToastTobaccoTodayToddlerToeTogetherToiletTokenTomatoTomorrowToneTongueTonightToolToothTopTopicToppleTorchTornadoTortoiseTossTotalTouristTowardTowerTownToyTrackTradeTrafficTragicTrainTransferTrapTrashTravelTrayTreatTreeTrendTrialTribeTrickTriggerTrimTripTrophyTroubleTruckTrueTrulyTrumpetTrustTruthTryTubeTuitionTumbleTunaTunnelTurkeyTurnTurtleTwelveTwentyTwiceTwinTwistTwoTypeTypicalUglyUmbrellaUnableUnawareUncleUncoverUnderUndoUnfairUnfoldUnhappyUniformUniqueUnitUniverseUnknownUnlockUntilUnusualUnveilUpdateUpgradeUpholdUponUpperUpsetUrbanUrgeUsageUseUsedUsefulUselessUsualUtilityVacantVacuumVagueValidValleyValveVanVanishVaporVariousVastVaultVehicleVelvetVendorVentureVenueVerbVerifyVersionVeryVesselVeteranViableVibrantViciousVictoryVideoViewVillageVintageViolinVirtualVirusVisaVisitVisualVitalVividVocalVoiceVoidVolcanoVolumeVoteVoyageWageWagonWaitWalkWallWalnutWantWarfareWarmWarriorWashWaspWasteWaterWaveWayWealthWeaponWearWeaselWeatherWebWeddingWeekendWeirdWelcomeWestWetWhaleWhatWheatWheelWhenWhereWhipWhisperWideWidthWifeWildWillWinWindowWineWingWinkWinnerWinterWireWisdomWiseWishWitnessWolfWomanWonderWoodWoolWordWorkWorldWorryWorthWrapWreckWrestleWristWriteWrongYardYearYellowYouYoungYouthZebraZeroZoneZoo";
let wordlist = null;
function loadWords(lang) {
    if (wordlist != null) {
        return;
    }
    wordlist = words.replace(/([A-Z])/g, " $1").toLowerCase().substring(1).split(" ");
    // Verify the computed list matches the official list
    /* istanbul ignore if */
    if (Wordlist.check(lang) !== "0x3c8acc1e7b08d8e76f9fda015ef48dc8c710a73cb7e0f77b2c18a9b5a7adde60") {
        wordlist = null;
        throw new Error("BIP39 Wordlist for en (English) FAILED");
    }
}
class LangEn extends Wordlist {
    constructor() {
        super("en");
    }
    getWord(index) {
        loadWords(this);
        return wordlist[index];
    }
    getWordIndex(word) {
        loadWords(this);
        return wordlist.indexOf(word);
    }
}
const langEn = new LangEn();
Wordlist.register(langEn);

const wordlists = {
    en: langEn
};

const version$8 = "hdnode/5.7.0";

const logger$b = new Logger$2(version$8);
const N = BigNumber.from("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
// "Bitcoin seed"
const MasterSecret = toUtf8Bytes("Bitcoin seed");
const HardenedBit = 0x80000000;
// Returns a byte with the MSB bits set
function getUpperMask(bits) {
    return ((1 << bits) - 1) << (8 - bits);
}
// Returns a byte with the LSB bits set
function getLowerMask(bits) {
    return (1 << bits) - 1;
}
function bytes32(value) {
    return hexZeroPad(hexlify(value), 32);
}
function base58check(data) {
    return Base58.encode(concat([data, hexDataSlice(sha256(sha256(data)), 0, 4)]));
}
function getWordlist(wordlist) {
    if (wordlist == null) {
        return wordlists["en"];
    }
    if (typeof (wordlist) === "string") {
        const words = wordlists[wordlist];
        if (words == null) {
            logger$b.throwArgumentError("unknown locale", "wordlist", wordlist);
        }
        return words;
    }
    return wordlist;
}
const _constructorGuard$1 = {};
const defaultPath = "m/44'/60'/0'/0/0";
class HDNode {
    /**
     *  This constructor should not be called directly.
     *
     *  Please use:
     *   - fromMnemonic
     *   - fromSeed
     */
    constructor(constructorGuard, privateKey, publicKey, parentFingerprint, chainCode, index, depth, mnemonicOrPath) {
        /* istanbul ignore if */
        if (constructorGuard !== _constructorGuard$1) {
            throw new Error("HDNode constructor cannot be called directly");
        }
        if (privateKey) {
            const signingKey = new SigningKey(privateKey);
            defineReadOnly$1(this, "privateKey", signingKey.privateKey);
            defineReadOnly$1(this, "publicKey", signingKey.compressedPublicKey);
        }
        else {
            defineReadOnly$1(this, "privateKey", null);
            defineReadOnly$1(this, "publicKey", hexlify(publicKey));
        }
        defineReadOnly$1(this, "parentFingerprint", parentFingerprint);
        defineReadOnly$1(this, "fingerprint", hexDataSlice(ripemd160(sha256(this.publicKey)), 0, 4));
        defineReadOnly$1(this, "address", computeAddress(this.publicKey));
        defineReadOnly$1(this, "chainCode", chainCode);
        defineReadOnly$1(this, "index", index);
        defineReadOnly$1(this, "depth", depth);
        if (mnemonicOrPath == null) {
            // From a source that does not preserve the path (e.g. extended keys)
            defineReadOnly$1(this, "mnemonic", null);
            defineReadOnly$1(this, "path", null);
        }
        else if (typeof (mnemonicOrPath) === "string") {
            // From a source that does not preserve the mnemonic (e.g. neutered)
            defineReadOnly$1(this, "mnemonic", null);
            defineReadOnly$1(this, "path", mnemonicOrPath);
        }
        else {
            // From a fully qualified source
            defineReadOnly$1(this, "mnemonic", mnemonicOrPath);
            defineReadOnly$1(this, "path", mnemonicOrPath.path);
        }
    }
    get extendedKey() {
        // We only support the mainnet values for now, but if anyone needs
        // testnet values, let me know. I believe current sentiment is that
        // we should always use mainnet, and use BIP-44 to derive the network
        //   - Mainnet: public=0x0488B21E, private=0x0488ADE4
        //   - Testnet: public=0x043587CF, private=0x04358394
        if (this.depth >= 256) {
            throw new Error("Depth too large!");
        }
        return base58check(concat([
            ((this.privateKey != null) ? "0x0488ADE4" : "0x0488B21E"),
            hexlify(this.depth),
            this.parentFingerprint,
            hexZeroPad(hexlify(this.index), 4),
            this.chainCode,
            ((this.privateKey != null) ? concat(["0x00", this.privateKey]) : this.publicKey),
        ]));
    }
    neuter() {
        return new HDNode(_constructorGuard$1, null, this.publicKey, this.parentFingerprint, this.chainCode, this.index, this.depth, this.path);
    }
    _derive(index) {
        if (index > 0xffffffff) {
            throw new Error("invalid index - " + String(index));
        }
        // Base path
        let path = this.path;
        if (path) {
            path += "/" + (index & ~HardenedBit);
        }
        const data = new Uint8Array(37);
        if (index & HardenedBit) {
            if (!this.privateKey) {
                throw new Error("cannot derive child of neutered node");
            }
            // Data = 0x00 || ser_256(k_par)
            data.set(arrayify(this.privateKey), 1);
            // Hardened path
            if (path) {
                path += "'";
            }
        }
        else {
            // Data = ser_p(point(k_par))
            data.set(arrayify(this.publicKey));
        }
        // Data += ser_32(i)
        for (let i = 24; i >= 0; i -= 8) {
            data[33 + (i >> 3)] = ((index >> (24 - i)) & 0xff);
        }
        const I = arrayify(computeHmac(SupportedAlgorithm.sha512, this.chainCode, data));
        const IL = I.slice(0, 32);
        const IR = I.slice(32);
        // The private key
        let ki = null;
        // The public key
        let Ki = null;
        if (this.privateKey) {
            ki = bytes32(BigNumber.from(IL).add(this.privateKey).mod(N));
        }
        else {
            const ek = new SigningKey(hexlify(IL));
            Ki = ek._addPoint(this.publicKey);
        }
        let mnemonicOrPath = path;
        const srcMnemonic = this.mnemonic;
        if (srcMnemonic) {
            mnemonicOrPath = Object.freeze({
                phrase: srcMnemonic.phrase,
                path: path,
                locale: (srcMnemonic.locale || "en")
            });
        }
        return new HDNode(_constructorGuard$1, ki, Ki, this.fingerprint, bytes32(IR), index, this.depth + 1, mnemonicOrPath);
    }
    derivePath(path) {
        const components = path.split("/");
        if (components.length === 0 || (components[0] === "m" && this.depth !== 0)) {
            throw new Error("invalid path - " + path);
        }
        if (components[0] === "m") {
            components.shift();
        }
        let result = this;
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (component.match(/^[0-9]+'$/)) {
                const index = parseInt(component.substring(0, component.length - 1));
                if (index >= HardenedBit) {
                    throw new Error("invalid path index - " + component);
                }
                result = result._derive(HardenedBit + index);
            }
            else if (component.match(/^[0-9]+$/)) {
                const index = parseInt(component);
                if (index >= HardenedBit) {
                    throw new Error("invalid path index - " + component);
                }
                result = result._derive(index);
            }
            else {
                throw new Error("invalid path component - " + component);
            }
        }
        return result;
    }
    static _fromSeed(seed, mnemonic) {
        const seedArray = arrayify(seed);
        if (seedArray.length < 16 || seedArray.length > 64) {
            throw new Error("invalid seed");
        }
        const I = arrayify(computeHmac(SupportedAlgorithm.sha512, MasterSecret, seedArray));
        return new HDNode(_constructorGuard$1, bytes32(I.slice(0, 32)), null, "0x00000000", bytes32(I.slice(32)), 0, 0, mnemonic);
    }
    static fromMnemonic(mnemonic, password, wordlist) {
        // If a locale name was passed in, find the associated wordlist
        wordlist = getWordlist(wordlist);
        // Normalize the case and spacing in the mnemonic (throws if the mnemonic is invalid)
        mnemonic = entropyToMnemonic(mnemonicToEntropy(mnemonic, wordlist), wordlist);
        return HDNode._fromSeed(mnemonicToSeed(mnemonic, password), {
            phrase: mnemonic,
            path: "m",
            locale: wordlist.locale
        });
    }
    static fromSeed(seed) {
        return HDNode._fromSeed(seed, null);
    }
    static fromExtendedKey(extendedKey) {
        const bytes = Base58.decode(extendedKey);
        if (bytes.length !== 82 || base58check(bytes.slice(0, 78)) !== extendedKey) {
            logger$b.throwArgumentError("invalid extended key", "extendedKey", "[REDACTED]");
        }
        const depth = bytes[4];
        const parentFingerprint = hexlify(bytes.slice(5, 9));
        const index = parseInt(hexlify(bytes.slice(9, 13)).substring(2), 16);
        const chainCode = hexlify(bytes.slice(13, 45));
        const key = bytes.slice(45, 78);
        switch (hexlify(bytes.slice(0, 4))) {
            // Public Key
            case "0x0488b21e":
            case "0x043587cf":
                return new HDNode(_constructorGuard$1, null, hexlify(key), parentFingerprint, chainCode, index, depth, null);
            // Private Key
            case "0x0488ade4":
            case "0x04358394 ":
                if (key[0] !== 0) {
                    break;
                }
                return new HDNode(_constructorGuard$1, hexlify(key.slice(1)), null, parentFingerprint, chainCode, index, depth, null);
        }
        return logger$b.throwArgumentError("invalid extended key", "extendedKey", "[REDACTED]");
    }
}
function mnemonicToSeed(mnemonic, password) {
    if (!password) {
        password = "";
    }
    const salt = toUtf8Bytes("mnemonic" + password, UnicodeNormalizationForm.NFKD);
    return pbkdf2$1(toUtf8Bytes(mnemonic, UnicodeNormalizationForm.NFKD), salt, 2048, 64, "sha512");
}
function mnemonicToEntropy(mnemonic, wordlist) {
    wordlist = getWordlist(wordlist);
    logger$b.checkNormalize();
    const words = wordlist.split(mnemonic);
    if ((words.length % 3) !== 0) {
        throw new Error("invalid mnemonic");
    }
    const entropy = arrayify(new Uint8Array(Math.ceil(11 * words.length / 8)));
    let offset = 0;
    for (let i = 0; i < words.length; i++) {
        let index = wordlist.getWordIndex(words[i].normalize("NFKD"));
        if (index === -1) {
            throw new Error("invalid mnemonic");
        }
        for (let bit = 0; bit < 11; bit++) {
            if (index & (1 << (10 - bit))) {
                entropy[offset >> 3] |= (1 << (7 - (offset % 8)));
            }
            offset++;
        }
    }
    const entropyBits = 32 * words.length / 3;
    const checksumBits = words.length / 3;
    const checksumMask = getUpperMask(checksumBits);
    const checksum = arrayify(sha256(entropy.slice(0, entropyBits / 8)))[0] & checksumMask;
    if (checksum !== (entropy[entropy.length - 1] & checksumMask)) {
        throw new Error("invalid checksum");
    }
    return hexlify(entropy.slice(0, entropyBits / 8));
}
function entropyToMnemonic(entropy, wordlist) {
    wordlist = getWordlist(wordlist);
    entropy = arrayify(entropy);
    if ((entropy.length % 4) !== 0 || entropy.length < 16 || entropy.length > 32) {
        throw new Error("invalid entropy");
    }
    const indices = [0];
    let remainingBits = 11;
    for (let i = 0; i < entropy.length; i++) {
        // Consume the whole byte (with still more to go)
        if (remainingBits > 8) {
            indices[indices.length - 1] <<= 8;
            indices[indices.length - 1] |= entropy[i];
            remainingBits -= 8;
            // This byte will complete an 11-bit index
        }
        else {
            indices[indices.length - 1] <<= remainingBits;
            indices[indices.length - 1] |= entropy[i] >> (8 - remainingBits);
            // Start the next word
            indices.push(entropy[i] & getLowerMask(8 - remainingBits));
            remainingBits += 3;
        }
    }
    // Compute the checksum bits
    const checksumBits = entropy.length / 4;
    const checksum = arrayify(sha256(entropy))[0] & getUpperMask(checksumBits);
    // Shift the checksum into the word indices
    indices[indices.length - 1] <<= checksumBits;
    indices[indices.length - 1] |= (checksum >> (8 - checksumBits));
    return wordlist.join(indices.map((index) => wordlist.getWord(index)));
}

const version$7 = "random/5.7.0";

const logger$a = new Logger$2(version$7);
// Debugging line for testing browser lib in node
//const window = { crypto: { getRandomValues: () => { } } };
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
function getGlobal() {
    if (typeof self !== 'undefined') {
        return self;
    }
    if (typeof window !== 'undefined') {
        return window;
    }
    if (typeof global !== 'undefined') {
        return global;
    }
    throw new Error('unable to locate global object');
}
const anyGlobal = getGlobal();
let crypto = anyGlobal.crypto || anyGlobal.msCrypto;
if (!crypto || !crypto.getRandomValues) {
    logger$a.warn("WARNING: Missing strong random number source");
    crypto = {
        getRandomValues: function (buffer) {
            return logger$a.throwError("no secure random source avaialble", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "crypto.getRandomValues"
            });
        }
    };
}
function randomBytes(length) {
    if (length <= 0 || length > 1024 || (length % 1) || length != length) {
        logger$a.throwArgumentError("invalid length", "length", length);
    }
    const result = new Uint8Array(length);
    crypto.getRandomValues(result);
    return arrayify(result);
}

var aesJs = {exports: {}};

(function (module, exports) {

(function(root) {

    function checkInt(value) {
        return (parseInt(value) === value);
    }

    function checkInts(arrayish) {
        if (!checkInt(arrayish.length)) { return false; }

        for (var i = 0; i < arrayish.length; i++) {
            if (!checkInt(arrayish[i]) || arrayish[i] < 0 || arrayish[i] > 255) {
                return false;
            }
        }

        return true;
    }

    function coerceArray(arg, copy) {

        // ArrayBuffer view
        if (arg.buffer && ArrayBuffer.isView(arg) && arg.name === 'Uint8Array') {

            if (copy) {
                if (arg.slice) {
                    arg = arg.slice();
                } else {
                    arg = Array.prototype.slice.call(arg);
                }
            }

            return arg;
        }

        // It's an array; check it is a valid representation of a byte
        if (Array.isArray(arg)) {
            if (!checkInts(arg)) {
                throw new Error('Array contains invalid value: ' + arg);
            }

            return new Uint8Array(arg);
        }

        // Something else, but behaves like an array (maybe a Buffer? Arguments?)
        if (checkInt(arg.length) && checkInts(arg)) {
            return new Uint8Array(arg);
        }

        throw new Error('unsupported array-like object');
    }

    function createArray(length) {
        return new Uint8Array(length);
    }

    function copyArray(sourceArray, targetArray, targetStart, sourceStart, sourceEnd) {
        if (sourceStart != null || sourceEnd != null) {
            if (sourceArray.slice) {
                sourceArray = sourceArray.slice(sourceStart, sourceEnd);
            } else {
                sourceArray = Array.prototype.slice.call(sourceArray, sourceStart, sourceEnd);
            }
        }
        targetArray.set(sourceArray, targetStart);
    }



    var convertUtf8 = (function() {
        function toBytes(text) {
            var result = [], i = 0;
            text = encodeURI(text);
            while (i < text.length) {
                var c = text.charCodeAt(i++);

                // if it is a % sign, encode the following 2 bytes as a hex value
                if (c === 37) {
                    result.push(parseInt(text.substr(i, 2), 16));
                    i += 2;

                // otherwise, just the actual byte
                } else {
                    result.push(c);
                }
            }

            return coerceArray(result);
        }

        function fromBytes(bytes) {
            var result = [], i = 0;

            while (i < bytes.length) {
                var c = bytes[i];

                if (c < 128) {
                    result.push(String.fromCharCode(c));
                    i++;
                } else if (c > 191 && c < 224) {
                    result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
                    i += 2;
                } else {
                    result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
                    i += 3;
                }
            }

            return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();

    var convertHex = (function() {
        function toBytes(text) {
            var result = [];
            for (var i = 0; i < text.length; i += 2) {
                result.push(parseInt(text.substr(i, 2), 16));
            }

            return result;
        }

        // http://ixti.net/development/javascript/2011/11/11/base64-encodedecode-of-utf8-in-browser-with-js.html
        var Hex = '0123456789abcdef';

        function fromBytes(bytes) {
                var result = [];
                for (var i = 0; i < bytes.length; i++) {
                    var v = bytes[i];
                    result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f]);
                }
                return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();


    // Number of rounds by keysize
    var numberOfRounds = {16: 10, 24: 12, 32: 14};

    // Round constant words
    var rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91];

    // S-box and Inverse S-box (S is for Substitution)
    var S = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16];
    var Si =[0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e, 0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25, 0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84, 0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73, 0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4, 0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f, 0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61, 0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d];

    // Transformations for encryption
    var T1 = [0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554, 0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a, 0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b, 0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b, 0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f, 0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f, 0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5, 0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f, 0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb, 0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497, 0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed, 0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a, 0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594, 0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3, 0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504, 0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d, 0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739, 0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395, 0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883, 0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76, 0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4, 0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b, 0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0, 0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818, 0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651, 0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85, 0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12, 0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9, 0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7, 0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a, 0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8, 0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a];
    var T2 = [0xa5c66363, 0x84f87c7c, 0x99ee7777, 0x8df67b7b, 0x0dfff2f2, 0xbdd66b6b, 0xb1de6f6f, 0x5491c5c5, 0x50603030, 0x03020101, 0xa9ce6767, 0x7d562b2b, 0x19e7fefe, 0x62b5d7d7, 0xe64dabab, 0x9aec7676, 0x458fcaca, 0x9d1f8282, 0x4089c9c9, 0x87fa7d7d, 0x15effafa, 0xebb25959, 0xc98e4747, 0x0bfbf0f0, 0xec41adad, 0x67b3d4d4, 0xfd5fa2a2, 0xea45afaf, 0xbf239c9c, 0xf753a4a4, 0x96e47272, 0x5b9bc0c0, 0xc275b7b7, 0x1ce1fdfd, 0xae3d9393, 0x6a4c2626, 0x5a6c3636, 0x417e3f3f, 0x02f5f7f7, 0x4f83cccc, 0x5c683434, 0xf451a5a5, 0x34d1e5e5, 0x08f9f1f1, 0x93e27171, 0x73abd8d8, 0x53623131, 0x3f2a1515, 0x0c080404, 0x5295c7c7, 0x65462323, 0x5e9dc3c3, 0x28301818, 0xa1379696, 0x0f0a0505, 0xb52f9a9a, 0x090e0707, 0x36241212, 0x9b1b8080, 0x3ddfe2e2, 0x26cdebeb, 0x694e2727, 0xcd7fb2b2, 0x9fea7575, 0x1b120909, 0x9e1d8383, 0x74582c2c, 0x2e341a1a, 0x2d361b1b, 0xb2dc6e6e, 0xeeb45a5a, 0xfb5ba0a0, 0xf6a45252, 0x4d763b3b, 0x61b7d6d6, 0xce7db3b3, 0x7b522929, 0x3edde3e3, 0x715e2f2f, 0x97138484, 0xf5a65353, 0x68b9d1d1, 0x00000000, 0x2cc1eded, 0x60402020, 0x1fe3fcfc, 0xc879b1b1, 0xedb65b5b, 0xbed46a6a, 0x468dcbcb, 0xd967bebe, 0x4b723939, 0xde944a4a, 0xd4984c4c, 0xe8b05858, 0x4a85cfcf, 0x6bbbd0d0, 0x2ac5efef, 0xe54faaaa, 0x16edfbfb, 0xc5864343, 0xd79a4d4d, 0x55663333, 0x94118585, 0xcf8a4545, 0x10e9f9f9, 0x06040202, 0x81fe7f7f, 0xf0a05050, 0x44783c3c, 0xba259f9f, 0xe34ba8a8, 0xf3a25151, 0xfe5da3a3, 0xc0804040, 0x8a058f8f, 0xad3f9292, 0xbc219d9d, 0x48703838, 0x04f1f5f5, 0xdf63bcbc, 0xc177b6b6, 0x75afdada, 0x63422121, 0x30201010, 0x1ae5ffff, 0x0efdf3f3, 0x6dbfd2d2, 0x4c81cdcd, 0x14180c0c, 0x35261313, 0x2fc3ecec, 0xe1be5f5f, 0xa2359797, 0xcc884444, 0x392e1717, 0x5793c4c4, 0xf255a7a7, 0x82fc7e7e, 0x477a3d3d, 0xacc86464, 0xe7ba5d5d, 0x2b321919, 0x95e67373, 0xa0c06060, 0x98198181, 0xd19e4f4f, 0x7fa3dcdc, 0x66442222, 0x7e542a2a, 0xab3b9090, 0x830b8888, 0xca8c4646, 0x29c7eeee, 0xd36bb8b8, 0x3c281414, 0x79a7dede, 0xe2bc5e5e, 0x1d160b0b, 0x76addbdb, 0x3bdbe0e0, 0x56643232, 0x4e743a3a, 0x1e140a0a, 0xdb924949, 0x0a0c0606, 0x6c482424, 0xe4b85c5c, 0x5d9fc2c2, 0x6ebdd3d3, 0xef43acac, 0xa6c46262, 0xa8399191, 0xa4319595, 0x37d3e4e4, 0x8bf27979, 0x32d5e7e7, 0x438bc8c8, 0x596e3737, 0xb7da6d6d, 0x8c018d8d, 0x64b1d5d5, 0xd29c4e4e, 0xe049a9a9, 0xb4d86c6c, 0xfaac5656, 0x07f3f4f4, 0x25cfeaea, 0xafca6565, 0x8ef47a7a, 0xe947aeae, 0x18100808, 0xd56fbaba, 0x88f07878, 0x6f4a2525, 0x725c2e2e, 0x24381c1c, 0xf157a6a6, 0xc773b4b4, 0x5197c6c6, 0x23cbe8e8, 0x7ca1dddd, 0x9ce87474, 0x213e1f1f, 0xdd964b4b, 0xdc61bdbd, 0x860d8b8b, 0x850f8a8a, 0x90e07070, 0x427c3e3e, 0xc471b5b5, 0xaacc6666, 0xd8904848, 0x05060303, 0x01f7f6f6, 0x121c0e0e, 0xa3c26161, 0x5f6a3535, 0xf9ae5757, 0xd069b9b9, 0x91178686, 0x5899c1c1, 0x273a1d1d, 0xb9279e9e, 0x38d9e1e1, 0x13ebf8f8, 0xb32b9898, 0x33221111, 0xbbd26969, 0x70a9d9d9, 0x89078e8e, 0xa7339494, 0xb62d9b9b, 0x223c1e1e, 0x92158787, 0x20c9e9e9, 0x4987cece, 0xffaa5555, 0x78502828, 0x7aa5dfdf, 0x8f038c8c, 0xf859a1a1, 0x80098989, 0x171a0d0d, 0xda65bfbf, 0x31d7e6e6, 0xc6844242, 0xb8d06868, 0xc3824141, 0xb0299999, 0x775a2d2d, 0x111e0f0f, 0xcb7bb0b0, 0xfca85454, 0xd66dbbbb, 0x3a2c1616];
    var T3 = [0x63a5c663, 0x7c84f87c, 0x7799ee77, 0x7b8df67b, 0xf20dfff2, 0x6bbdd66b, 0x6fb1de6f, 0xc55491c5, 0x30506030, 0x01030201, 0x67a9ce67, 0x2b7d562b, 0xfe19e7fe, 0xd762b5d7, 0xabe64dab, 0x769aec76, 0xca458fca, 0x829d1f82, 0xc94089c9, 0x7d87fa7d, 0xfa15effa, 0x59ebb259, 0x47c98e47, 0xf00bfbf0, 0xadec41ad, 0xd467b3d4, 0xa2fd5fa2, 0xafea45af, 0x9cbf239c, 0xa4f753a4, 0x7296e472, 0xc05b9bc0, 0xb7c275b7, 0xfd1ce1fd, 0x93ae3d93, 0x266a4c26, 0x365a6c36, 0x3f417e3f, 0xf702f5f7, 0xcc4f83cc, 0x345c6834, 0xa5f451a5, 0xe534d1e5, 0xf108f9f1, 0x7193e271, 0xd873abd8, 0x31536231, 0x153f2a15, 0x040c0804, 0xc75295c7, 0x23654623, 0xc35e9dc3, 0x18283018, 0x96a13796, 0x050f0a05, 0x9ab52f9a, 0x07090e07, 0x12362412, 0x809b1b80, 0xe23ddfe2, 0xeb26cdeb, 0x27694e27, 0xb2cd7fb2, 0x759fea75, 0x091b1209, 0x839e1d83, 0x2c74582c, 0x1a2e341a, 0x1b2d361b, 0x6eb2dc6e, 0x5aeeb45a, 0xa0fb5ba0, 0x52f6a452, 0x3b4d763b, 0xd661b7d6, 0xb3ce7db3, 0x297b5229, 0xe33edde3, 0x2f715e2f, 0x84971384, 0x53f5a653, 0xd168b9d1, 0x00000000, 0xed2cc1ed, 0x20604020, 0xfc1fe3fc, 0xb1c879b1, 0x5bedb65b, 0x6abed46a, 0xcb468dcb, 0xbed967be, 0x394b7239, 0x4ade944a, 0x4cd4984c, 0x58e8b058, 0xcf4a85cf, 0xd06bbbd0, 0xef2ac5ef, 0xaae54faa, 0xfb16edfb, 0x43c58643, 0x4dd79a4d, 0x33556633, 0x85941185, 0x45cf8a45, 0xf910e9f9, 0x02060402, 0x7f81fe7f, 0x50f0a050, 0x3c44783c, 0x9fba259f, 0xa8e34ba8, 0x51f3a251, 0xa3fe5da3, 0x40c08040, 0x8f8a058f, 0x92ad3f92, 0x9dbc219d, 0x38487038, 0xf504f1f5, 0xbcdf63bc, 0xb6c177b6, 0xda75afda, 0x21634221, 0x10302010, 0xff1ae5ff, 0xf30efdf3, 0xd26dbfd2, 0xcd4c81cd, 0x0c14180c, 0x13352613, 0xec2fc3ec, 0x5fe1be5f, 0x97a23597, 0x44cc8844, 0x17392e17, 0xc45793c4, 0xa7f255a7, 0x7e82fc7e, 0x3d477a3d, 0x64acc864, 0x5de7ba5d, 0x192b3219, 0x7395e673, 0x60a0c060, 0x81981981, 0x4fd19e4f, 0xdc7fa3dc, 0x22664422, 0x2a7e542a, 0x90ab3b90, 0x88830b88, 0x46ca8c46, 0xee29c7ee, 0xb8d36bb8, 0x143c2814, 0xde79a7de, 0x5ee2bc5e, 0x0b1d160b, 0xdb76addb, 0xe03bdbe0, 0x32566432, 0x3a4e743a, 0x0a1e140a, 0x49db9249, 0x060a0c06, 0x246c4824, 0x5ce4b85c, 0xc25d9fc2, 0xd36ebdd3, 0xacef43ac, 0x62a6c462, 0x91a83991, 0x95a43195, 0xe437d3e4, 0x798bf279, 0xe732d5e7, 0xc8438bc8, 0x37596e37, 0x6db7da6d, 0x8d8c018d, 0xd564b1d5, 0x4ed29c4e, 0xa9e049a9, 0x6cb4d86c, 0x56faac56, 0xf407f3f4, 0xea25cfea, 0x65afca65, 0x7a8ef47a, 0xaee947ae, 0x08181008, 0xbad56fba, 0x7888f078, 0x256f4a25, 0x2e725c2e, 0x1c24381c, 0xa6f157a6, 0xb4c773b4, 0xc65197c6, 0xe823cbe8, 0xdd7ca1dd, 0x749ce874, 0x1f213e1f, 0x4bdd964b, 0xbddc61bd, 0x8b860d8b, 0x8a850f8a, 0x7090e070, 0x3e427c3e, 0xb5c471b5, 0x66aacc66, 0x48d89048, 0x03050603, 0xf601f7f6, 0x0e121c0e, 0x61a3c261, 0x355f6a35, 0x57f9ae57, 0xb9d069b9, 0x86911786, 0xc15899c1, 0x1d273a1d, 0x9eb9279e, 0xe138d9e1, 0xf813ebf8, 0x98b32b98, 0x11332211, 0x69bbd269, 0xd970a9d9, 0x8e89078e, 0x94a73394, 0x9bb62d9b, 0x1e223c1e, 0x87921587, 0xe920c9e9, 0xce4987ce, 0x55ffaa55, 0x28785028, 0xdf7aa5df, 0x8c8f038c, 0xa1f859a1, 0x89800989, 0x0d171a0d, 0xbfda65bf, 0xe631d7e6, 0x42c68442, 0x68b8d068, 0x41c38241, 0x99b02999, 0x2d775a2d, 0x0f111e0f, 0xb0cb7bb0, 0x54fca854, 0xbbd66dbb, 0x163a2c16];
    var T4 = [0x6363a5c6, 0x7c7c84f8, 0x777799ee, 0x7b7b8df6, 0xf2f20dff, 0x6b6bbdd6, 0x6f6fb1de, 0xc5c55491, 0x30305060, 0x01010302, 0x6767a9ce, 0x2b2b7d56, 0xfefe19e7, 0xd7d762b5, 0xababe64d, 0x76769aec, 0xcaca458f, 0x82829d1f, 0xc9c94089, 0x7d7d87fa, 0xfafa15ef, 0x5959ebb2, 0x4747c98e, 0xf0f00bfb, 0xadadec41, 0xd4d467b3, 0xa2a2fd5f, 0xafafea45, 0x9c9cbf23, 0xa4a4f753, 0x727296e4, 0xc0c05b9b, 0xb7b7c275, 0xfdfd1ce1, 0x9393ae3d, 0x26266a4c, 0x36365a6c, 0x3f3f417e, 0xf7f702f5, 0xcccc4f83, 0x34345c68, 0xa5a5f451, 0xe5e534d1, 0xf1f108f9, 0x717193e2, 0xd8d873ab, 0x31315362, 0x15153f2a, 0x04040c08, 0xc7c75295, 0x23236546, 0xc3c35e9d, 0x18182830, 0x9696a137, 0x05050f0a, 0x9a9ab52f, 0x0707090e, 0x12123624, 0x80809b1b, 0xe2e23ddf, 0xebeb26cd, 0x2727694e, 0xb2b2cd7f, 0x75759fea, 0x09091b12, 0x83839e1d, 0x2c2c7458, 0x1a1a2e34, 0x1b1b2d36, 0x6e6eb2dc, 0x5a5aeeb4, 0xa0a0fb5b, 0x5252f6a4, 0x3b3b4d76, 0xd6d661b7, 0xb3b3ce7d, 0x29297b52, 0xe3e33edd, 0x2f2f715e, 0x84849713, 0x5353f5a6, 0xd1d168b9, 0x00000000, 0xeded2cc1, 0x20206040, 0xfcfc1fe3, 0xb1b1c879, 0x5b5bedb6, 0x6a6abed4, 0xcbcb468d, 0xbebed967, 0x39394b72, 0x4a4ade94, 0x4c4cd498, 0x5858e8b0, 0xcfcf4a85, 0xd0d06bbb, 0xefef2ac5, 0xaaaae54f, 0xfbfb16ed, 0x4343c586, 0x4d4dd79a, 0x33335566, 0x85859411, 0x4545cf8a, 0xf9f910e9, 0x02020604, 0x7f7f81fe, 0x5050f0a0, 0x3c3c4478, 0x9f9fba25, 0xa8a8e34b, 0x5151f3a2, 0xa3a3fe5d, 0x4040c080, 0x8f8f8a05, 0x9292ad3f, 0x9d9dbc21, 0x38384870, 0xf5f504f1, 0xbcbcdf63, 0xb6b6c177, 0xdada75af, 0x21216342, 0x10103020, 0xffff1ae5, 0xf3f30efd, 0xd2d26dbf, 0xcdcd4c81, 0x0c0c1418, 0x13133526, 0xecec2fc3, 0x5f5fe1be, 0x9797a235, 0x4444cc88, 0x1717392e, 0xc4c45793, 0xa7a7f255, 0x7e7e82fc, 0x3d3d477a, 0x6464acc8, 0x5d5de7ba, 0x19192b32, 0x737395e6, 0x6060a0c0, 0x81819819, 0x4f4fd19e, 0xdcdc7fa3, 0x22226644, 0x2a2a7e54, 0x9090ab3b, 0x8888830b, 0x4646ca8c, 0xeeee29c7, 0xb8b8d36b, 0x14143c28, 0xdede79a7, 0x5e5ee2bc, 0x0b0b1d16, 0xdbdb76ad, 0xe0e03bdb, 0x32325664, 0x3a3a4e74, 0x0a0a1e14, 0x4949db92, 0x06060a0c, 0x24246c48, 0x5c5ce4b8, 0xc2c25d9f, 0xd3d36ebd, 0xacacef43, 0x6262a6c4, 0x9191a839, 0x9595a431, 0xe4e437d3, 0x79798bf2, 0xe7e732d5, 0xc8c8438b, 0x3737596e, 0x6d6db7da, 0x8d8d8c01, 0xd5d564b1, 0x4e4ed29c, 0xa9a9e049, 0x6c6cb4d8, 0x5656faac, 0xf4f407f3, 0xeaea25cf, 0x6565afca, 0x7a7a8ef4, 0xaeaee947, 0x08081810, 0xbabad56f, 0x787888f0, 0x25256f4a, 0x2e2e725c, 0x1c1c2438, 0xa6a6f157, 0xb4b4c773, 0xc6c65197, 0xe8e823cb, 0xdddd7ca1, 0x74749ce8, 0x1f1f213e, 0x4b4bdd96, 0xbdbddc61, 0x8b8b860d, 0x8a8a850f, 0x707090e0, 0x3e3e427c, 0xb5b5c471, 0x6666aacc, 0x4848d890, 0x03030506, 0xf6f601f7, 0x0e0e121c, 0x6161a3c2, 0x35355f6a, 0x5757f9ae, 0xb9b9d069, 0x86869117, 0xc1c15899, 0x1d1d273a, 0x9e9eb927, 0xe1e138d9, 0xf8f813eb, 0x9898b32b, 0x11113322, 0x6969bbd2, 0xd9d970a9, 0x8e8e8907, 0x9494a733, 0x9b9bb62d, 0x1e1e223c, 0x87879215, 0xe9e920c9, 0xcece4987, 0x5555ffaa, 0x28287850, 0xdfdf7aa5, 0x8c8c8f03, 0xa1a1f859, 0x89898009, 0x0d0d171a, 0xbfbfda65, 0xe6e631d7, 0x4242c684, 0x6868b8d0, 0x4141c382, 0x9999b029, 0x2d2d775a, 0x0f0f111e, 0xb0b0cb7b, 0x5454fca8, 0xbbbbd66d, 0x16163a2c];

    // Transformations for decryption
    var T5 = [0x51f4a750, 0x7e416553, 0x1a17a4c3, 0x3a275e96, 0x3bab6bcb, 0x1f9d45f1, 0xacfa58ab, 0x4be30393, 0x2030fa55, 0xad766df6, 0x88cc7691, 0xf5024c25, 0x4fe5d7fc, 0xc52acbd7, 0x26354480, 0xb562a38f, 0xdeb15a49, 0x25ba1b67, 0x45ea0e98, 0x5dfec0e1, 0xc32f7502, 0x814cf012, 0x8d4697a3, 0x6bd3f9c6, 0x038f5fe7, 0x15929c95, 0xbf6d7aeb, 0x955259da, 0xd4be832d, 0x587421d3, 0x49e06929, 0x8ec9c844, 0x75c2896a, 0xf48e7978, 0x99583e6b, 0x27b971dd, 0xbee14fb6, 0xf088ad17, 0xc920ac66, 0x7dce3ab4, 0x63df4a18, 0xe51a3182, 0x97513360, 0x62537f45, 0xb16477e0, 0xbb6bae84, 0xfe81a01c, 0xf9082b94, 0x70486858, 0x8f45fd19, 0x94de6c87, 0x527bf8b7, 0xab73d323, 0x724b02e2, 0xe31f8f57, 0x6655ab2a, 0xb2eb2807, 0x2fb5c203, 0x86c57b9a, 0xd33708a5, 0x302887f2, 0x23bfa5b2, 0x02036aba, 0xed16825c, 0x8acf1c2b, 0xa779b492, 0xf307f2f0, 0x4e69e2a1, 0x65daf4cd, 0x0605bed5, 0xd134621f, 0xc4a6fe8a, 0x342e539d, 0xa2f355a0, 0x058ae132, 0xa4f6eb75, 0x0b83ec39, 0x4060efaa, 0x5e719f06, 0xbd6e1051, 0x3e218af9, 0x96dd063d, 0xdd3e05ae, 0x4de6bd46, 0x91548db5, 0x71c45d05, 0x0406d46f, 0x605015ff, 0x1998fb24, 0xd6bde997, 0x894043cc, 0x67d99e77, 0xb0e842bd, 0x07898b88, 0xe7195b38, 0x79c8eedb, 0xa17c0a47, 0x7c420fe9, 0xf8841ec9, 0x00000000, 0x09808683, 0x322bed48, 0x1e1170ac, 0x6c5a724e, 0xfd0efffb, 0x0f853856, 0x3daed51e, 0x362d3927, 0x0a0fd964, 0x685ca621, 0x9b5b54d1, 0x24362e3a, 0x0c0a67b1, 0x9357e70f, 0xb4ee96d2, 0x1b9b919e, 0x80c0c54f, 0x61dc20a2, 0x5a774b69, 0x1c121a16, 0xe293ba0a, 0xc0a02ae5, 0x3c22e043, 0x121b171d, 0x0e090d0b, 0xf28bc7ad, 0x2db6a8b9, 0x141ea9c8, 0x57f11985, 0xaf75074c, 0xee99ddbb, 0xa37f60fd, 0xf701269f, 0x5c72f5bc, 0x44663bc5, 0x5bfb7e34, 0x8b432976, 0xcb23c6dc, 0xb6edfc68, 0xb8e4f163, 0xd731dcca, 0x42638510, 0x13972240, 0x84c61120, 0x854a247d, 0xd2bb3df8, 0xaef93211, 0xc729a16d, 0x1d9e2f4b, 0xdcb230f3, 0x0d8652ec, 0x77c1e3d0, 0x2bb3166c, 0xa970b999, 0x119448fa, 0x47e96422, 0xa8fc8cc4, 0xa0f03f1a, 0x567d2cd8, 0x223390ef, 0x87494ec7, 0xd938d1c1, 0x8ccaa2fe, 0x98d40b36, 0xa6f581cf, 0xa57ade28, 0xdab78e26, 0x3fadbfa4, 0x2c3a9de4, 0x5078920d, 0x6a5fcc9b, 0x547e4662, 0xf68d13c2, 0x90d8b8e8, 0x2e39f75e, 0x82c3aff5, 0x9f5d80be, 0x69d0937c, 0x6fd52da9, 0xcf2512b3, 0xc8ac993b, 0x10187da7, 0xe89c636e, 0xdb3bbb7b, 0xcd267809, 0x6e5918f4, 0xec9ab701, 0x834f9aa8, 0xe6956e65, 0xaaffe67e, 0x21bccf08, 0xef15e8e6, 0xbae79bd9, 0x4a6f36ce, 0xea9f09d4, 0x29b07cd6, 0x31a4b2af, 0x2a3f2331, 0xc6a59430, 0x35a266c0, 0x744ebc37, 0xfc82caa6, 0xe090d0b0, 0x33a7d815, 0xf104984a, 0x41ecdaf7, 0x7fcd500e, 0x1791f62f, 0x764dd68d, 0x43efb04d, 0xccaa4d54, 0xe49604df, 0x9ed1b5e3, 0x4c6a881b, 0xc12c1fb8, 0x4665517f, 0x9d5eea04, 0x018c355d, 0xfa877473, 0xfb0b412e, 0xb3671d5a, 0x92dbd252, 0xe9105633, 0x6dd64713, 0x9ad7618c, 0x37a10c7a, 0x59f8148e, 0xeb133c89, 0xcea927ee, 0xb761c935, 0xe11ce5ed, 0x7a47b13c, 0x9cd2df59, 0x55f2733f, 0x1814ce79, 0x73c737bf, 0x53f7cdea, 0x5ffdaa5b, 0xdf3d6f14, 0x7844db86, 0xcaaff381, 0xb968c43e, 0x3824342c, 0xc2a3405f, 0x161dc372, 0xbce2250c, 0x283c498b, 0xff0d9541, 0x39a80171, 0x080cb3de, 0xd8b4e49c, 0x6456c190, 0x7bcb8461, 0xd532b670, 0x486c5c74, 0xd0b85742];
    var T6 = [0x5051f4a7, 0x537e4165, 0xc31a17a4, 0x963a275e, 0xcb3bab6b, 0xf11f9d45, 0xabacfa58, 0x934be303, 0x552030fa, 0xf6ad766d, 0x9188cc76, 0x25f5024c, 0xfc4fe5d7, 0xd7c52acb, 0x80263544, 0x8fb562a3, 0x49deb15a, 0x6725ba1b, 0x9845ea0e, 0xe15dfec0, 0x02c32f75, 0x12814cf0, 0xa38d4697, 0xc66bd3f9, 0xe7038f5f, 0x9515929c, 0xebbf6d7a, 0xda955259, 0x2dd4be83, 0xd3587421, 0x2949e069, 0x448ec9c8, 0x6a75c289, 0x78f48e79, 0x6b99583e, 0xdd27b971, 0xb6bee14f, 0x17f088ad, 0x66c920ac, 0xb47dce3a, 0x1863df4a, 0x82e51a31, 0x60975133, 0x4562537f, 0xe0b16477, 0x84bb6bae, 0x1cfe81a0, 0x94f9082b, 0x58704868, 0x198f45fd, 0x8794de6c, 0xb7527bf8, 0x23ab73d3, 0xe2724b02, 0x57e31f8f, 0x2a6655ab, 0x07b2eb28, 0x032fb5c2, 0x9a86c57b, 0xa5d33708, 0xf2302887, 0xb223bfa5, 0xba02036a, 0x5ced1682, 0x2b8acf1c, 0x92a779b4, 0xf0f307f2, 0xa14e69e2, 0xcd65daf4, 0xd50605be, 0x1fd13462, 0x8ac4a6fe, 0x9d342e53, 0xa0a2f355, 0x32058ae1, 0x75a4f6eb, 0x390b83ec, 0xaa4060ef, 0x065e719f, 0x51bd6e10, 0xf93e218a, 0x3d96dd06, 0xaedd3e05, 0x464de6bd, 0xb591548d, 0x0571c45d, 0x6f0406d4, 0xff605015, 0x241998fb, 0x97d6bde9, 0xcc894043, 0x7767d99e, 0xbdb0e842, 0x8807898b, 0x38e7195b, 0xdb79c8ee, 0x47a17c0a, 0xe97c420f, 0xc9f8841e, 0x00000000, 0x83098086, 0x48322bed, 0xac1e1170, 0x4e6c5a72, 0xfbfd0eff, 0x560f8538, 0x1e3daed5, 0x27362d39, 0x640a0fd9, 0x21685ca6, 0xd19b5b54, 0x3a24362e, 0xb10c0a67, 0x0f9357e7, 0xd2b4ee96, 0x9e1b9b91, 0x4f80c0c5, 0xa261dc20, 0x695a774b, 0x161c121a, 0x0ae293ba, 0xe5c0a02a, 0x433c22e0, 0x1d121b17, 0x0b0e090d, 0xadf28bc7, 0xb92db6a8, 0xc8141ea9, 0x8557f119, 0x4caf7507, 0xbbee99dd, 0xfda37f60, 0x9ff70126, 0xbc5c72f5, 0xc544663b, 0x345bfb7e, 0x768b4329, 0xdccb23c6, 0x68b6edfc, 0x63b8e4f1, 0xcad731dc, 0x10426385, 0x40139722, 0x2084c611, 0x7d854a24, 0xf8d2bb3d, 0x11aef932, 0x6dc729a1, 0x4b1d9e2f, 0xf3dcb230, 0xec0d8652, 0xd077c1e3, 0x6c2bb316, 0x99a970b9, 0xfa119448, 0x2247e964, 0xc4a8fc8c, 0x1aa0f03f, 0xd8567d2c, 0xef223390, 0xc787494e, 0xc1d938d1, 0xfe8ccaa2, 0x3698d40b, 0xcfa6f581, 0x28a57ade, 0x26dab78e, 0xa43fadbf, 0xe42c3a9d, 0x0d507892, 0x9b6a5fcc, 0x62547e46, 0xc2f68d13, 0xe890d8b8, 0x5e2e39f7, 0xf582c3af, 0xbe9f5d80, 0x7c69d093, 0xa96fd52d, 0xb3cf2512, 0x3bc8ac99, 0xa710187d, 0x6ee89c63, 0x7bdb3bbb, 0x09cd2678, 0xf46e5918, 0x01ec9ab7, 0xa8834f9a, 0x65e6956e, 0x7eaaffe6, 0x0821bccf, 0xe6ef15e8, 0xd9bae79b, 0xce4a6f36, 0xd4ea9f09, 0xd629b07c, 0xaf31a4b2, 0x312a3f23, 0x30c6a594, 0xc035a266, 0x37744ebc, 0xa6fc82ca, 0xb0e090d0, 0x1533a7d8, 0x4af10498, 0xf741ecda, 0x0e7fcd50, 0x2f1791f6, 0x8d764dd6, 0x4d43efb0, 0x54ccaa4d, 0xdfe49604, 0xe39ed1b5, 0x1b4c6a88, 0xb8c12c1f, 0x7f466551, 0x049d5eea, 0x5d018c35, 0x73fa8774, 0x2efb0b41, 0x5ab3671d, 0x5292dbd2, 0x33e91056, 0x136dd647, 0x8c9ad761, 0x7a37a10c, 0x8e59f814, 0x89eb133c, 0xeecea927, 0x35b761c9, 0xede11ce5, 0x3c7a47b1, 0x599cd2df, 0x3f55f273, 0x791814ce, 0xbf73c737, 0xea53f7cd, 0x5b5ffdaa, 0x14df3d6f, 0x867844db, 0x81caaff3, 0x3eb968c4, 0x2c382434, 0x5fc2a340, 0x72161dc3, 0x0cbce225, 0x8b283c49, 0x41ff0d95, 0x7139a801, 0xde080cb3, 0x9cd8b4e4, 0x906456c1, 0x617bcb84, 0x70d532b6, 0x74486c5c, 0x42d0b857];
    var T7 = [0xa75051f4, 0x65537e41, 0xa4c31a17, 0x5e963a27, 0x6bcb3bab, 0x45f11f9d, 0x58abacfa, 0x03934be3, 0xfa552030, 0x6df6ad76, 0x769188cc, 0x4c25f502, 0xd7fc4fe5, 0xcbd7c52a, 0x44802635, 0xa38fb562, 0x5a49deb1, 0x1b6725ba, 0x0e9845ea, 0xc0e15dfe, 0x7502c32f, 0xf012814c, 0x97a38d46, 0xf9c66bd3, 0x5fe7038f, 0x9c951592, 0x7aebbf6d, 0x59da9552, 0x832dd4be, 0x21d35874, 0x692949e0, 0xc8448ec9, 0x896a75c2, 0x7978f48e, 0x3e6b9958, 0x71dd27b9, 0x4fb6bee1, 0xad17f088, 0xac66c920, 0x3ab47dce, 0x4a1863df, 0x3182e51a, 0x33609751, 0x7f456253, 0x77e0b164, 0xae84bb6b, 0xa01cfe81, 0x2b94f908, 0x68587048, 0xfd198f45, 0x6c8794de, 0xf8b7527b, 0xd323ab73, 0x02e2724b, 0x8f57e31f, 0xab2a6655, 0x2807b2eb, 0xc2032fb5, 0x7b9a86c5, 0x08a5d337, 0x87f23028, 0xa5b223bf, 0x6aba0203, 0x825ced16, 0x1c2b8acf, 0xb492a779, 0xf2f0f307, 0xe2a14e69, 0xf4cd65da, 0xbed50605, 0x621fd134, 0xfe8ac4a6, 0x539d342e, 0x55a0a2f3, 0xe132058a, 0xeb75a4f6, 0xec390b83, 0xefaa4060, 0x9f065e71, 0x1051bd6e, 0x8af93e21, 0x063d96dd, 0x05aedd3e, 0xbd464de6, 0x8db59154, 0x5d0571c4, 0xd46f0406, 0x15ff6050, 0xfb241998, 0xe997d6bd, 0x43cc8940, 0x9e7767d9, 0x42bdb0e8, 0x8b880789, 0x5b38e719, 0xeedb79c8, 0x0a47a17c, 0x0fe97c42, 0x1ec9f884, 0x00000000, 0x86830980, 0xed48322b, 0x70ac1e11, 0x724e6c5a, 0xfffbfd0e, 0x38560f85, 0xd51e3dae, 0x3927362d, 0xd9640a0f, 0xa621685c, 0x54d19b5b, 0x2e3a2436, 0x67b10c0a, 0xe70f9357, 0x96d2b4ee, 0x919e1b9b, 0xc54f80c0, 0x20a261dc, 0x4b695a77, 0x1a161c12, 0xba0ae293, 0x2ae5c0a0, 0xe0433c22, 0x171d121b, 0x0d0b0e09, 0xc7adf28b, 0xa8b92db6, 0xa9c8141e, 0x198557f1, 0x074caf75, 0xddbbee99, 0x60fda37f, 0x269ff701, 0xf5bc5c72, 0x3bc54466, 0x7e345bfb, 0x29768b43, 0xc6dccb23, 0xfc68b6ed, 0xf163b8e4, 0xdccad731, 0x85104263, 0x22401397, 0x112084c6, 0x247d854a, 0x3df8d2bb, 0x3211aef9, 0xa16dc729, 0x2f4b1d9e, 0x30f3dcb2, 0x52ec0d86, 0xe3d077c1, 0x166c2bb3, 0xb999a970, 0x48fa1194, 0x642247e9, 0x8cc4a8fc, 0x3f1aa0f0, 0x2cd8567d, 0x90ef2233, 0x4ec78749, 0xd1c1d938, 0xa2fe8cca, 0x0b3698d4, 0x81cfa6f5, 0xde28a57a, 0x8e26dab7, 0xbfa43fad, 0x9de42c3a, 0x920d5078, 0xcc9b6a5f, 0x4662547e, 0x13c2f68d, 0xb8e890d8, 0xf75e2e39, 0xaff582c3, 0x80be9f5d, 0x937c69d0, 0x2da96fd5, 0x12b3cf25, 0x993bc8ac, 0x7da71018, 0x636ee89c, 0xbb7bdb3b, 0x7809cd26, 0x18f46e59, 0xb701ec9a, 0x9aa8834f, 0x6e65e695, 0xe67eaaff, 0xcf0821bc, 0xe8e6ef15, 0x9bd9bae7, 0x36ce4a6f, 0x09d4ea9f, 0x7cd629b0, 0xb2af31a4, 0x23312a3f, 0x9430c6a5, 0x66c035a2, 0xbc37744e, 0xcaa6fc82, 0xd0b0e090, 0xd81533a7, 0x984af104, 0xdaf741ec, 0x500e7fcd, 0xf62f1791, 0xd68d764d, 0xb04d43ef, 0x4d54ccaa, 0x04dfe496, 0xb5e39ed1, 0x881b4c6a, 0x1fb8c12c, 0x517f4665, 0xea049d5e, 0x355d018c, 0x7473fa87, 0x412efb0b, 0x1d5ab367, 0xd25292db, 0x5633e910, 0x47136dd6, 0x618c9ad7, 0x0c7a37a1, 0x148e59f8, 0x3c89eb13, 0x27eecea9, 0xc935b761, 0xe5ede11c, 0xb13c7a47, 0xdf599cd2, 0x733f55f2, 0xce791814, 0x37bf73c7, 0xcdea53f7, 0xaa5b5ffd, 0x6f14df3d, 0xdb867844, 0xf381caaf, 0xc43eb968, 0x342c3824, 0x405fc2a3, 0xc372161d, 0x250cbce2, 0x498b283c, 0x9541ff0d, 0x017139a8, 0xb3de080c, 0xe49cd8b4, 0xc1906456, 0x84617bcb, 0xb670d532, 0x5c74486c, 0x5742d0b8];
    var T8 = [0xf4a75051, 0x4165537e, 0x17a4c31a, 0x275e963a, 0xab6bcb3b, 0x9d45f11f, 0xfa58abac, 0xe303934b, 0x30fa5520, 0x766df6ad, 0xcc769188, 0x024c25f5, 0xe5d7fc4f, 0x2acbd7c5, 0x35448026, 0x62a38fb5, 0xb15a49de, 0xba1b6725, 0xea0e9845, 0xfec0e15d, 0x2f7502c3, 0x4cf01281, 0x4697a38d, 0xd3f9c66b, 0x8f5fe703, 0x929c9515, 0x6d7aebbf, 0x5259da95, 0xbe832dd4, 0x7421d358, 0xe0692949, 0xc9c8448e, 0xc2896a75, 0x8e7978f4, 0x583e6b99, 0xb971dd27, 0xe14fb6be, 0x88ad17f0, 0x20ac66c9, 0xce3ab47d, 0xdf4a1863, 0x1a3182e5, 0x51336097, 0x537f4562, 0x6477e0b1, 0x6bae84bb, 0x81a01cfe, 0x082b94f9, 0x48685870, 0x45fd198f, 0xde6c8794, 0x7bf8b752, 0x73d323ab, 0x4b02e272, 0x1f8f57e3, 0x55ab2a66, 0xeb2807b2, 0xb5c2032f, 0xc57b9a86, 0x3708a5d3, 0x2887f230, 0xbfa5b223, 0x036aba02, 0x16825ced, 0xcf1c2b8a, 0x79b492a7, 0x07f2f0f3, 0x69e2a14e, 0xdaf4cd65, 0x05bed506, 0x34621fd1, 0xa6fe8ac4, 0x2e539d34, 0xf355a0a2, 0x8ae13205, 0xf6eb75a4, 0x83ec390b, 0x60efaa40, 0x719f065e, 0x6e1051bd, 0x218af93e, 0xdd063d96, 0x3e05aedd, 0xe6bd464d, 0x548db591, 0xc45d0571, 0x06d46f04, 0x5015ff60, 0x98fb2419, 0xbde997d6, 0x4043cc89, 0xd99e7767, 0xe842bdb0, 0x898b8807, 0x195b38e7, 0xc8eedb79, 0x7c0a47a1, 0x420fe97c, 0x841ec9f8, 0x00000000, 0x80868309, 0x2bed4832, 0x1170ac1e, 0x5a724e6c, 0x0efffbfd, 0x8538560f, 0xaed51e3d, 0x2d392736, 0x0fd9640a, 0x5ca62168, 0x5b54d19b, 0x362e3a24, 0x0a67b10c, 0x57e70f93, 0xee96d2b4, 0x9b919e1b, 0xc0c54f80, 0xdc20a261, 0x774b695a, 0x121a161c, 0x93ba0ae2, 0xa02ae5c0, 0x22e0433c, 0x1b171d12, 0x090d0b0e, 0x8bc7adf2, 0xb6a8b92d, 0x1ea9c814, 0xf1198557, 0x75074caf, 0x99ddbbee, 0x7f60fda3, 0x01269ff7, 0x72f5bc5c, 0x663bc544, 0xfb7e345b, 0x4329768b, 0x23c6dccb, 0xedfc68b6, 0xe4f163b8, 0x31dccad7, 0x63851042, 0x97224013, 0xc6112084, 0x4a247d85, 0xbb3df8d2, 0xf93211ae, 0x29a16dc7, 0x9e2f4b1d, 0xb230f3dc, 0x8652ec0d, 0xc1e3d077, 0xb3166c2b, 0x70b999a9, 0x9448fa11, 0xe9642247, 0xfc8cc4a8, 0xf03f1aa0, 0x7d2cd856, 0x3390ef22, 0x494ec787, 0x38d1c1d9, 0xcaa2fe8c, 0xd40b3698, 0xf581cfa6, 0x7ade28a5, 0xb78e26da, 0xadbfa43f, 0x3a9de42c, 0x78920d50, 0x5fcc9b6a, 0x7e466254, 0x8d13c2f6, 0xd8b8e890, 0x39f75e2e, 0xc3aff582, 0x5d80be9f, 0xd0937c69, 0xd52da96f, 0x2512b3cf, 0xac993bc8, 0x187da710, 0x9c636ee8, 0x3bbb7bdb, 0x267809cd, 0x5918f46e, 0x9ab701ec, 0x4f9aa883, 0x956e65e6, 0xffe67eaa, 0xbccf0821, 0x15e8e6ef, 0xe79bd9ba, 0x6f36ce4a, 0x9f09d4ea, 0xb07cd629, 0xa4b2af31, 0x3f23312a, 0xa59430c6, 0xa266c035, 0x4ebc3774, 0x82caa6fc, 0x90d0b0e0, 0xa7d81533, 0x04984af1, 0xecdaf741, 0xcd500e7f, 0x91f62f17, 0x4dd68d76, 0xefb04d43, 0xaa4d54cc, 0x9604dfe4, 0xd1b5e39e, 0x6a881b4c, 0x2c1fb8c1, 0x65517f46, 0x5eea049d, 0x8c355d01, 0x877473fa, 0x0b412efb, 0x671d5ab3, 0xdbd25292, 0x105633e9, 0xd647136d, 0xd7618c9a, 0xa10c7a37, 0xf8148e59, 0x133c89eb, 0xa927eece, 0x61c935b7, 0x1ce5ede1, 0x47b13c7a, 0xd2df599c, 0xf2733f55, 0x14ce7918, 0xc737bf73, 0xf7cdea53, 0xfdaa5b5f, 0x3d6f14df, 0x44db8678, 0xaff381ca, 0x68c43eb9, 0x24342c38, 0xa3405fc2, 0x1dc37216, 0xe2250cbc, 0x3c498b28, 0x0d9541ff, 0xa8017139, 0x0cb3de08, 0xb4e49cd8, 0x56c19064, 0xcb84617b, 0x32b670d5, 0x6c5c7448, 0xb85742d0];

    // Transformations for decryption key expansion
    var U1 = [0x00000000, 0x0e090d0b, 0x1c121a16, 0x121b171d, 0x3824342c, 0x362d3927, 0x24362e3a, 0x2a3f2331, 0x70486858, 0x7e416553, 0x6c5a724e, 0x62537f45, 0x486c5c74, 0x4665517f, 0x547e4662, 0x5a774b69, 0xe090d0b0, 0xee99ddbb, 0xfc82caa6, 0xf28bc7ad, 0xd8b4e49c, 0xd6bde997, 0xc4a6fe8a, 0xcaaff381, 0x90d8b8e8, 0x9ed1b5e3, 0x8ccaa2fe, 0x82c3aff5, 0xa8fc8cc4, 0xa6f581cf, 0xb4ee96d2, 0xbae79bd9, 0xdb3bbb7b, 0xd532b670, 0xc729a16d, 0xc920ac66, 0xe31f8f57, 0xed16825c, 0xff0d9541, 0xf104984a, 0xab73d323, 0xa57ade28, 0xb761c935, 0xb968c43e, 0x9357e70f, 0x9d5eea04, 0x8f45fd19, 0x814cf012, 0x3bab6bcb, 0x35a266c0, 0x27b971dd, 0x29b07cd6, 0x038f5fe7, 0x0d8652ec, 0x1f9d45f1, 0x119448fa, 0x4be30393, 0x45ea0e98, 0x57f11985, 0x59f8148e, 0x73c737bf, 0x7dce3ab4, 0x6fd52da9, 0x61dc20a2, 0xad766df6, 0xa37f60fd, 0xb16477e0, 0xbf6d7aeb, 0x955259da, 0x9b5b54d1, 0x894043cc, 0x87494ec7, 0xdd3e05ae, 0xd33708a5, 0xc12c1fb8, 0xcf2512b3, 0xe51a3182, 0xeb133c89, 0xf9082b94, 0xf701269f, 0x4de6bd46, 0x43efb04d, 0x51f4a750, 0x5ffdaa5b, 0x75c2896a, 0x7bcb8461, 0x69d0937c, 0x67d99e77, 0x3daed51e, 0x33a7d815, 0x21bccf08, 0x2fb5c203, 0x058ae132, 0x0b83ec39, 0x1998fb24, 0x1791f62f, 0x764dd68d, 0x7844db86, 0x6a5fcc9b, 0x6456c190, 0x4e69e2a1, 0x4060efaa, 0x527bf8b7, 0x5c72f5bc, 0x0605bed5, 0x080cb3de, 0x1a17a4c3, 0x141ea9c8, 0x3e218af9, 0x302887f2, 0x223390ef, 0x2c3a9de4, 0x96dd063d, 0x98d40b36, 0x8acf1c2b, 0x84c61120, 0xaef93211, 0xa0f03f1a, 0xb2eb2807, 0xbce2250c, 0xe6956e65, 0xe89c636e, 0xfa877473, 0xf48e7978, 0xdeb15a49, 0xd0b85742, 0xc2a3405f, 0xccaa4d54, 0x41ecdaf7, 0x4fe5d7fc, 0x5dfec0e1, 0x53f7cdea, 0x79c8eedb, 0x77c1e3d0, 0x65daf4cd, 0x6bd3f9c6, 0x31a4b2af, 0x3fadbfa4, 0x2db6a8b9, 0x23bfa5b2, 0x09808683, 0x07898b88, 0x15929c95, 0x1b9b919e, 0xa17c0a47, 0xaf75074c, 0xbd6e1051, 0xb3671d5a, 0x99583e6b, 0x97513360, 0x854a247d, 0x8b432976, 0xd134621f, 0xdf3d6f14, 0xcd267809, 0xc32f7502, 0xe9105633, 0xe7195b38, 0xf5024c25, 0xfb0b412e, 0x9ad7618c, 0x94de6c87, 0x86c57b9a, 0x88cc7691, 0xa2f355a0, 0xacfa58ab, 0xbee14fb6, 0xb0e842bd, 0xea9f09d4, 0xe49604df, 0xf68d13c2, 0xf8841ec9, 0xd2bb3df8, 0xdcb230f3, 0xcea927ee, 0xc0a02ae5, 0x7a47b13c, 0x744ebc37, 0x6655ab2a, 0x685ca621, 0x42638510, 0x4c6a881b, 0x5e719f06, 0x5078920d, 0x0a0fd964, 0x0406d46f, 0x161dc372, 0x1814ce79, 0x322bed48, 0x3c22e043, 0x2e39f75e, 0x2030fa55, 0xec9ab701, 0xe293ba0a, 0xf088ad17, 0xfe81a01c, 0xd4be832d, 0xdab78e26, 0xc8ac993b, 0xc6a59430, 0x9cd2df59, 0x92dbd252, 0x80c0c54f, 0x8ec9c844, 0xa4f6eb75, 0xaaffe67e, 0xb8e4f163, 0xb6edfc68, 0x0c0a67b1, 0x02036aba, 0x10187da7, 0x1e1170ac, 0x342e539d, 0x3a275e96, 0x283c498b, 0x26354480, 0x7c420fe9, 0x724b02e2, 0x605015ff, 0x6e5918f4, 0x44663bc5, 0x4a6f36ce, 0x587421d3, 0x567d2cd8, 0x37a10c7a, 0x39a80171, 0x2bb3166c, 0x25ba1b67, 0x0f853856, 0x018c355d, 0x13972240, 0x1d9e2f4b, 0x47e96422, 0x49e06929, 0x5bfb7e34, 0x55f2733f, 0x7fcd500e, 0x71c45d05, 0x63df4a18, 0x6dd64713, 0xd731dcca, 0xd938d1c1, 0xcb23c6dc, 0xc52acbd7, 0xef15e8e6, 0xe11ce5ed, 0xf307f2f0, 0xfd0efffb, 0xa779b492, 0xa970b999, 0xbb6bae84, 0xb562a38f, 0x9f5d80be, 0x91548db5, 0x834f9aa8, 0x8d4697a3];
    var U2 = [0x00000000, 0x0b0e090d, 0x161c121a, 0x1d121b17, 0x2c382434, 0x27362d39, 0x3a24362e, 0x312a3f23, 0x58704868, 0x537e4165, 0x4e6c5a72, 0x4562537f, 0x74486c5c, 0x7f466551, 0x62547e46, 0x695a774b, 0xb0e090d0, 0xbbee99dd, 0xa6fc82ca, 0xadf28bc7, 0x9cd8b4e4, 0x97d6bde9, 0x8ac4a6fe, 0x81caaff3, 0xe890d8b8, 0xe39ed1b5, 0xfe8ccaa2, 0xf582c3af, 0xc4a8fc8c, 0xcfa6f581, 0xd2b4ee96, 0xd9bae79b, 0x7bdb3bbb, 0x70d532b6, 0x6dc729a1, 0x66c920ac, 0x57e31f8f, 0x5ced1682, 0x41ff0d95, 0x4af10498, 0x23ab73d3, 0x28a57ade, 0x35b761c9, 0x3eb968c4, 0x0f9357e7, 0x049d5eea, 0x198f45fd, 0x12814cf0, 0xcb3bab6b, 0xc035a266, 0xdd27b971, 0xd629b07c, 0xe7038f5f, 0xec0d8652, 0xf11f9d45, 0xfa119448, 0x934be303, 0x9845ea0e, 0x8557f119, 0x8e59f814, 0xbf73c737, 0xb47dce3a, 0xa96fd52d, 0xa261dc20, 0xf6ad766d, 0xfda37f60, 0xe0b16477, 0xebbf6d7a, 0xda955259, 0xd19b5b54, 0xcc894043, 0xc787494e, 0xaedd3e05, 0xa5d33708, 0xb8c12c1f, 0xb3cf2512, 0x82e51a31, 0x89eb133c, 0x94f9082b, 0x9ff70126, 0x464de6bd, 0x4d43efb0, 0x5051f4a7, 0x5b5ffdaa, 0x6a75c289, 0x617bcb84, 0x7c69d093, 0x7767d99e, 0x1e3daed5, 0x1533a7d8, 0x0821bccf, 0x032fb5c2, 0x32058ae1, 0x390b83ec, 0x241998fb, 0x2f1791f6, 0x8d764dd6, 0x867844db, 0x9b6a5fcc, 0x906456c1, 0xa14e69e2, 0xaa4060ef, 0xb7527bf8, 0xbc5c72f5, 0xd50605be, 0xde080cb3, 0xc31a17a4, 0xc8141ea9, 0xf93e218a, 0xf2302887, 0xef223390, 0xe42c3a9d, 0x3d96dd06, 0x3698d40b, 0x2b8acf1c, 0x2084c611, 0x11aef932, 0x1aa0f03f, 0x07b2eb28, 0x0cbce225, 0x65e6956e, 0x6ee89c63, 0x73fa8774, 0x78f48e79, 0x49deb15a, 0x42d0b857, 0x5fc2a340, 0x54ccaa4d, 0xf741ecda, 0xfc4fe5d7, 0xe15dfec0, 0xea53f7cd, 0xdb79c8ee, 0xd077c1e3, 0xcd65daf4, 0xc66bd3f9, 0xaf31a4b2, 0xa43fadbf, 0xb92db6a8, 0xb223bfa5, 0x83098086, 0x8807898b, 0x9515929c, 0x9e1b9b91, 0x47a17c0a, 0x4caf7507, 0x51bd6e10, 0x5ab3671d, 0x6b99583e, 0x60975133, 0x7d854a24, 0x768b4329, 0x1fd13462, 0x14df3d6f, 0x09cd2678, 0x02c32f75, 0x33e91056, 0x38e7195b, 0x25f5024c, 0x2efb0b41, 0x8c9ad761, 0x8794de6c, 0x9a86c57b, 0x9188cc76, 0xa0a2f355, 0xabacfa58, 0xb6bee14f, 0xbdb0e842, 0xd4ea9f09, 0xdfe49604, 0xc2f68d13, 0xc9f8841e, 0xf8d2bb3d, 0xf3dcb230, 0xeecea927, 0xe5c0a02a, 0x3c7a47b1, 0x37744ebc, 0x2a6655ab, 0x21685ca6, 0x10426385, 0x1b4c6a88, 0x065e719f, 0x0d507892, 0x640a0fd9, 0x6f0406d4, 0x72161dc3, 0x791814ce, 0x48322bed, 0x433c22e0, 0x5e2e39f7, 0x552030fa, 0x01ec9ab7, 0x0ae293ba, 0x17f088ad, 0x1cfe81a0, 0x2dd4be83, 0x26dab78e, 0x3bc8ac99, 0x30c6a594, 0x599cd2df, 0x5292dbd2, 0x4f80c0c5, 0x448ec9c8, 0x75a4f6eb, 0x7eaaffe6, 0x63b8e4f1, 0x68b6edfc, 0xb10c0a67, 0xba02036a, 0xa710187d, 0xac1e1170, 0x9d342e53, 0x963a275e, 0x8b283c49, 0x80263544, 0xe97c420f, 0xe2724b02, 0xff605015, 0xf46e5918, 0xc544663b, 0xce4a6f36, 0xd3587421, 0xd8567d2c, 0x7a37a10c, 0x7139a801, 0x6c2bb316, 0x6725ba1b, 0x560f8538, 0x5d018c35, 0x40139722, 0x4b1d9e2f, 0x2247e964, 0x2949e069, 0x345bfb7e, 0x3f55f273, 0x0e7fcd50, 0x0571c45d, 0x1863df4a, 0x136dd647, 0xcad731dc, 0xc1d938d1, 0xdccb23c6, 0xd7c52acb, 0xe6ef15e8, 0xede11ce5, 0xf0f307f2, 0xfbfd0eff, 0x92a779b4, 0x99a970b9, 0x84bb6bae, 0x8fb562a3, 0xbe9f5d80, 0xb591548d, 0xa8834f9a, 0xa38d4697];
    var U3 = [0x00000000, 0x0d0b0e09, 0x1a161c12, 0x171d121b, 0x342c3824, 0x3927362d, 0x2e3a2436, 0x23312a3f, 0x68587048, 0x65537e41, 0x724e6c5a, 0x7f456253, 0x5c74486c, 0x517f4665, 0x4662547e, 0x4b695a77, 0xd0b0e090, 0xddbbee99, 0xcaa6fc82, 0xc7adf28b, 0xe49cd8b4, 0xe997d6bd, 0xfe8ac4a6, 0xf381caaf, 0xb8e890d8, 0xb5e39ed1, 0xa2fe8cca, 0xaff582c3, 0x8cc4a8fc, 0x81cfa6f5, 0x96d2b4ee, 0x9bd9bae7, 0xbb7bdb3b, 0xb670d532, 0xa16dc729, 0xac66c920, 0x8f57e31f, 0x825ced16, 0x9541ff0d, 0x984af104, 0xd323ab73, 0xde28a57a, 0xc935b761, 0xc43eb968, 0xe70f9357, 0xea049d5e, 0xfd198f45, 0xf012814c, 0x6bcb3bab, 0x66c035a2, 0x71dd27b9, 0x7cd629b0, 0x5fe7038f, 0x52ec0d86, 0x45f11f9d, 0x48fa1194, 0x03934be3, 0x0e9845ea, 0x198557f1, 0x148e59f8, 0x37bf73c7, 0x3ab47dce, 0x2da96fd5, 0x20a261dc, 0x6df6ad76, 0x60fda37f, 0x77e0b164, 0x7aebbf6d, 0x59da9552, 0x54d19b5b, 0x43cc8940, 0x4ec78749, 0x05aedd3e, 0x08a5d337, 0x1fb8c12c, 0x12b3cf25, 0x3182e51a, 0x3c89eb13, 0x2b94f908, 0x269ff701, 0xbd464de6, 0xb04d43ef, 0xa75051f4, 0xaa5b5ffd, 0x896a75c2, 0x84617bcb, 0x937c69d0, 0x9e7767d9, 0xd51e3dae, 0xd81533a7, 0xcf0821bc, 0xc2032fb5, 0xe132058a, 0xec390b83, 0xfb241998, 0xf62f1791, 0xd68d764d, 0xdb867844, 0xcc9b6a5f, 0xc1906456, 0xe2a14e69, 0xefaa4060, 0xf8b7527b, 0xf5bc5c72, 0xbed50605, 0xb3de080c, 0xa4c31a17, 0xa9c8141e, 0x8af93e21, 0x87f23028, 0x90ef2233, 0x9de42c3a, 0x063d96dd, 0x0b3698d4, 0x1c2b8acf, 0x112084c6, 0x3211aef9, 0x3f1aa0f0, 0x2807b2eb, 0x250cbce2, 0x6e65e695, 0x636ee89c, 0x7473fa87, 0x7978f48e, 0x5a49deb1, 0x5742d0b8, 0x405fc2a3, 0x4d54ccaa, 0xdaf741ec, 0xd7fc4fe5, 0xc0e15dfe, 0xcdea53f7, 0xeedb79c8, 0xe3d077c1, 0xf4cd65da, 0xf9c66bd3, 0xb2af31a4, 0xbfa43fad, 0xa8b92db6, 0xa5b223bf, 0x86830980, 0x8b880789, 0x9c951592, 0x919e1b9b, 0x0a47a17c, 0x074caf75, 0x1051bd6e, 0x1d5ab367, 0x3e6b9958, 0x33609751, 0x247d854a, 0x29768b43, 0x621fd134, 0x6f14df3d, 0x7809cd26, 0x7502c32f, 0x5633e910, 0x5b38e719, 0x4c25f502, 0x412efb0b, 0x618c9ad7, 0x6c8794de, 0x7b9a86c5, 0x769188cc, 0x55a0a2f3, 0x58abacfa, 0x4fb6bee1, 0x42bdb0e8, 0x09d4ea9f, 0x04dfe496, 0x13c2f68d, 0x1ec9f884, 0x3df8d2bb, 0x30f3dcb2, 0x27eecea9, 0x2ae5c0a0, 0xb13c7a47, 0xbc37744e, 0xab2a6655, 0xa621685c, 0x85104263, 0x881b4c6a, 0x9f065e71, 0x920d5078, 0xd9640a0f, 0xd46f0406, 0xc372161d, 0xce791814, 0xed48322b, 0xe0433c22, 0xf75e2e39, 0xfa552030, 0xb701ec9a, 0xba0ae293, 0xad17f088, 0xa01cfe81, 0x832dd4be, 0x8e26dab7, 0x993bc8ac, 0x9430c6a5, 0xdf599cd2, 0xd25292db, 0xc54f80c0, 0xc8448ec9, 0xeb75a4f6, 0xe67eaaff, 0xf163b8e4, 0xfc68b6ed, 0x67b10c0a, 0x6aba0203, 0x7da71018, 0x70ac1e11, 0x539d342e, 0x5e963a27, 0x498b283c, 0x44802635, 0x0fe97c42, 0x02e2724b, 0x15ff6050, 0x18f46e59, 0x3bc54466, 0x36ce4a6f, 0x21d35874, 0x2cd8567d, 0x0c7a37a1, 0x017139a8, 0x166c2bb3, 0x1b6725ba, 0x38560f85, 0x355d018c, 0x22401397, 0x2f4b1d9e, 0x642247e9, 0x692949e0, 0x7e345bfb, 0x733f55f2, 0x500e7fcd, 0x5d0571c4, 0x4a1863df, 0x47136dd6, 0xdccad731, 0xd1c1d938, 0xc6dccb23, 0xcbd7c52a, 0xe8e6ef15, 0xe5ede11c, 0xf2f0f307, 0xfffbfd0e, 0xb492a779, 0xb999a970, 0xae84bb6b, 0xa38fb562, 0x80be9f5d, 0x8db59154, 0x9aa8834f, 0x97a38d46];
    var U4 = [0x00000000, 0x090d0b0e, 0x121a161c, 0x1b171d12, 0x24342c38, 0x2d392736, 0x362e3a24, 0x3f23312a, 0x48685870, 0x4165537e, 0x5a724e6c, 0x537f4562, 0x6c5c7448, 0x65517f46, 0x7e466254, 0x774b695a, 0x90d0b0e0, 0x99ddbbee, 0x82caa6fc, 0x8bc7adf2, 0xb4e49cd8, 0xbde997d6, 0xa6fe8ac4, 0xaff381ca, 0xd8b8e890, 0xd1b5e39e, 0xcaa2fe8c, 0xc3aff582, 0xfc8cc4a8, 0xf581cfa6, 0xee96d2b4, 0xe79bd9ba, 0x3bbb7bdb, 0x32b670d5, 0x29a16dc7, 0x20ac66c9, 0x1f8f57e3, 0x16825ced, 0x0d9541ff, 0x04984af1, 0x73d323ab, 0x7ade28a5, 0x61c935b7, 0x68c43eb9, 0x57e70f93, 0x5eea049d, 0x45fd198f, 0x4cf01281, 0xab6bcb3b, 0xa266c035, 0xb971dd27, 0xb07cd629, 0x8f5fe703, 0x8652ec0d, 0x9d45f11f, 0x9448fa11, 0xe303934b, 0xea0e9845, 0xf1198557, 0xf8148e59, 0xc737bf73, 0xce3ab47d, 0xd52da96f, 0xdc20a261, 0x766df6ad, 0x7f60fda3, 0x6477e0b1, 0x6d7aebbf, 0x5259da95, 0x5b54d19b, 0x4043cc89, 0x494ec787, 0x3e05aedd, 0x3708a5d3, 0x2c1fb8c1, 0x2512b3cf, 0x1a3182e5, 0x133c89eb, 0x082b94f9, 0x01269ff7, 0xe6bd464d, 0xefb04d43, 0xf4a75051, 0xfdaa5b5f, 0xc2896a75, 0xcb84617b, 0xd0937c69, 0xd99e7767, 0xaed51e3d, 0xa7d81533, 0xbccf0821, 0xb5c2032f, 0x8ae13205, 0x83ec390b, 0x98fb2419, 0x91f62f17, 0x4dd68d76, 0x44db8678, 0x5fcc9b6a, 0x56c19064, 0x69e2a14e, 0x60efaa40, 0x7bf8b752, 0x72f5bc5c, 0x05bed506, 0x0cb3de08, 0x17a4c31a, 0x1ea9c814, 0x218af93e, 0x2887f230, 0x3390ef22, 0x3a9de42c, 0xdd063d96, 0xd40b3698, 0xcf1c2b8a, 0xc6112084, 0xf93211ae, 0xf03f1aa0, 0xeb2807b2, 0xe2250cbc, 0x956e65e6, 0x9c636ee8, 0x877473fa, 0x8e7978f4, 0xb15a49de, 0xb85742d0, 0xa3405fc2, 0xaa4d54cc, 0xecdaf741, 0xe5d7fc4f, 0xfec0e15d, 0xf7cdea53, 0xc8eedb79, 0xc1e3d077, 0xdaf4cd65, 0xd3f9c66b, 0xa4b2af31, 0xadbfa43f, 0xb6a8b92d, 0xbfa5b223, 0x80868309, 0x898b8807, 0x929c9515, 0x9b919e1b, 0x7c0a47a1, 0x75074caf, 0x6e1051bd, 0x671d5ab3, 0x583e6b99, 0x51336097, 0x4a247d85, 0x4329768b, 0x34621fd1, 0x3d6f14df, 0x267809cd, 0x2f7502c3, 0x105633e9, 0x195b38e7, 0x024c25f5, 0x0b412efb, 0xd7618c9a, 0xde6c8794, 0xc57b9a86, 0xcc769188, 0xf355a0a2, 0xfa58abac, 0xe14fb6be, 0xe842bdb0, 0x9f09d4ea, 0x9604dfe4, 0x8d13c2f6, 0x841ec9f8, 0xbb3df8d2, 0xb230f3dc, 0xa927eece, 0xa02ae5c0, 0x47b13c7a, 0x4ebc3774, 0x55ab2a66, 0x5ca62168, 0x63851042, 0x6a881b4c, 0x719f065e, 0x78920d50, 0x0fd9640a, 0x06d46f04, 0x1dc37216, 0x14ce7918, 0x2bed4832, 0x22e0433c, 0x39f75e2e, 0x30fa5520, 0x9ab701ec, 0x93ba0ae2, 0x88ad17f0, 0x81a01cfe, 0xbe832dd4, 0xb78e26da, 0xac993bc8, 0xa59430c6, 0xd2df599c, 0xdbd25292, 0xc0c54f80, 0xc9c8448e, 0xf6eb75a4, 0xffe67eaa, 0xe4f163b8, 0xedfc68b6, 0x0a67b10c, 0x036aba02, 0x187da710, 0x1170ac1e, 0x2e539d34, 0x275e963a, 0x3c498b28, 0x35448026, 0x420fe97c, 0x4b02e272, 0x5015ff60, 0x5918f46e, 0x663bc544, 0x6f36ce4a, 0x7421d358, 0x7d2cd856, 0xa10c7a37, 0xa8017139, 0xb3166c2b, 0xba1b6725, 0x8538560f, 0x8c355d01, 0x97224013, 0x9e2f4b1d, 0xe9642247, 0xe0692949, 0xfb7e345b, 0xf2733f55, 0xcd500e7f, 0xc45d0571, 0xdf4a1863, 0xd647136d, 0x31dccad7, 0x38d1c1d9, 0x23c6dccb, 0x2acbd7c5, 0x15e8e6ef, 0x1ce5ede1, 0x07f2f0f3, 0x0efffbfd, 0x79b492a7, 0x70b999a9, 0x6bae84bb, 0x62a38fb5, 0x5d80be9f, 0x548db591, 0x4f9aa883, 0x4697a38d];

    function convertToInt32(bytes) {
        var result = [];
        for (var i = 0; i < bytes.length; i += 4) {
            result.push(
                (bytes[i    ] << 24) |
                (bytes[i + 1] << 16) |
                (bytes[i + 2] <<  8) |
                 bytes[i + 3]
            );
        }
        return result;
    }

    var AES = function(key) {
        if (!(this instanceof AES)) {
            throw Error('AES must be instanitated with `new`');
        }

        Object.defineProperty(this, 'key', {
            value: coerceArray(key, true)
        });

        this._prepare();
    };


    AES.prototype._prepare = function() {

        var rounds = numberOfRounds[this.key.length];
        if (rounds == null) {
            throw new Error('invalid key size (must be 16, 24 or 32 bytes)');
        }

        // encryption round keys
        this._Ke = [];

        // decryption round keys
        this._Kd = [];

        for (var i = 0; i <= rounds; i++) {
            this._Ke.push([0, 0, 0, 0]);
            this._Kd.push([0, 0, 0, 0]);
        }

        var roundKeyCount = (rounds + 1) * 4;
        var KC = this.key.length / 4;

        // convert the key into ints
        var tk = convertToInt32(this.key);

        // copy values into round key arrays
        var index;
        for (var i = 0; i < KC; i++) {
            index = i >> 2;
            this._Ke[index][i % 4] = tk[i];
            this._Kd[rounds - index][i % 4] = tk[i];
        }

        // key expansion (fips-197 section 5.2)
        var rconpointer = 0;
        var t = KC, tt;
        while (t < roundKeyCount) {
            tt = tk[KC - 1];
            tk[0] ^= ((S[(tt >> 16) & 0xFF] << 24) ^
                      (S[(tt >>  8) & 0xFF] << 16) ^
                      (S[ tt        & 0xFF] <<  8) ^
                       S[(tt >> 24) & 0xFF]        ^
                      (rcon[rconpointer] << 24));
            rconpointer += 1;

            // key expansion (for non-256 bit)
            if (KC != 8) {
                for (var i = 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }

            // key expansion for 256-bit keys is "slightly different" (fips-197)
            } else {
                for (var i = 1; i < (KC / 2); i++) {
                    tk[i] ^= tk[i - 1];
                }
                tt = tk[(KC / 2) - 1];

                tk[KC / 2] ^= (S[ tt        & 0xFF]        ^
                              (S[(tt >>  8) & 0xFF] <<  8) ^
                              (S[(tt >> 16) & 0xFF] << 16) ^
                              (S[(tt >> 24) & 0xFF] << 24));

                for (var i = (KC / 2) + 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }
            }

            // copy values into round key arrays
            var i = 0, r, c;
            while (i < KC && t < roundKeyCount) {
                r = t >> 2;
                c = t % 4;
                this._Ke[r][c] = tk[i];
                this._Kd[rounds - r][c] = tk[i++];
                t++;
            }
        }

        // inverse-cipher-ify the decryption round key (fips-197 section 5.3)
        for (var r = 1; r < rounds; r++) {
            for (var c = 0; c < 4; c++) {
                tt = this._Kd[r][c];
                this._Kd[r][c] = (U1[(tt >> 24) & 0xFF] ^
                                  U2[(tt >> 16) & 0xFF] ^
                                  U3[(tt >>  8) & 0xFF] ^
                                  U4[ tt        & 0xFF]);
            }
        }
    };

    AES.prototype.encrypt = function(plaintext) {
        if (plaintext.length != 16) {
            throw new Error('invalid plaintext size (must be 16 bytes)');
        }

        var rounds = this._Ke.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(plaintext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Ke[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T1[(t[ i         ] >> 24) & 0xff] ^
                        T2[(t[(i + 1) % 4] >> 16) & 0xff] ^
                        T3[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T4[ t[(i + 3) % 4]        & 0xff] ^
                        this._Ke[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Ke[rounds][i];
            result[4 * i    ] = (S[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (S[(t[(i + 1) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (S[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (S[ t[(i + 3) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    };

    AES.prototype.decrypt = function(ciphertext) {
        if (ciphertext.length != 16) {
            throw new Error('invalid ciphertext size (must be 16 bytes)');
        }

        var rounds = this._Kd.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(ciphertext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Kd[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T5[(t[ i          ] >> 24) & 0xff] ^
                        T6[(t[(i + 3) % 4] >> 16) & 0xff] ^
                        T7[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T8[ t[(i + 1) % 4]        & 0xff] ^
                        this._Kd[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Kd[rounds][i];
            result[4 * i    ] = (Si[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (Si[(t[(i + 3) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (Si[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (Si[ t[(i + 1) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    };


    /**
     *  Mode Of Operation - Electonic Codebook (ECB)
     */
    var ModeOfOperationECB = function(key) {
        if (!(this instanceof ModeOfOperationECB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Electronic Code Block";
        this.name = "ecb";

        this._aes = new AES(key);
    };

    ModeOfOperationECB.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);
            block = this._aes.encrypt(block);
            copyArray(block, ciphertext, i);
        }

        return ciphertext;
    };

    ModeOfOperationECB.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);
            copyArray(block, plaintext, i);
        }

        return plaintext;
    };


    /**
     *  Mode Of Operation - Cipher Block Chaining (CBC)
     */
    var ModeOfOperationCBC = function(key, iv) {
        if (!(this instanceof ModeOfOperationCBC)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Block Chaining";
        this.name = "cbc";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastCipherblock = coerceArray(iv, true);

        this._aes = new AES(key);
    };

    ModeOfOperationCBC.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);

            for (var j = 0; j < 16; j++) {
                block[j] ^= this._lastCipherblock[j];
            }

            this._lastCipherblock = this._aes.encrypt(block);
            copyArray(this._lastCipherblock, ciphertext, i);
        }

        return ciphertext;
    };

    ModeOfOperationCBC.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);

            for (var j = 0; j < 16; j++) {
                plaintext[i + j] = block[j] ^ this._lastCipherblock[j];
            }

            copyArray(ciphertext, this._lastCipherblock, 0, i, i + 16);
        }

        return plaintext;
    };


    /**
     *  Mode Of Operation - Cipher Feedback (CFB)
     */
    var ModeOfOperationCFB = function(key, iv, segmentSize) {
        if (!(this instanceof ModeOfOperationCFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Feedback";
        this.name = "cfb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 size)');
        }

        if (!segmentSize) { segmentSize = 1; }

        this.segmentSize = segmentSize;

        this._shiftRegister = coerceArray(iv, true);

        this._aes = new AES(key);
    };

    ModeOfOperationCFB.prototype.encrypt = function(plaintext) {
        if ((plaintext.length % this.segmentSize) != 0) {
            throw new Error('invalid plaintext size (must be segmentSize bytes)');
        }

        var encrypted = coerceArray(plaintext, true);

        var xorSegment;
        for (var i = 0; i < encrypted.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);
            for (var j = 0; j < this.segmentSize; j++) {
                encrypted[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(encrypted, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return encrypted;
    };

    ModeOfOperationCFB.prototype.decrypt = function(ciphertext) {
        if ((ciphertext.length % this.segmentSize) != 0) {
            throw new Error('invalid ciphertext size (must be segmentSize bytes)');
        }

        var plaintext = coerceArray(ciphertext, true);

        var xorSegment;
        for (var i = 0; i < plaintext.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);

            for (var j = 0; j < this.segmentSize; j++) {
                plaintext[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(ciphertext, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return plaintext;
    };

    /**
     *  Mode Of Operation - Output Feedback (OFB)
     */
    var ModeOfOperationOFB = function(key, iv) {
        if (!(this instanceof ModeOfOperationOFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Output Feedback";
        this.name = "ofb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastPrecipher = coerceArray(iv, true);
        this._lastPrecipherIndex = 16;

        this._aes = new AES(key);
    };

    ModeOfOperationOFB.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._lastPrecipherIndex === 16) {
                this._lastPrecipher = this._aes.encrypt(this._lastPrecipher);
                this._lastPrecipherIndex = 0;
            }
            encrypted[i] ^= this._lastPrecipher[this._lastPrecipherIndex++];
        }

        return encrypted;
    };

    // Decryption is symetric
    ModeOfOperationOFB.prototype.decrypt = ModeOfOperationOFB.prototype.encrypt;


    /**
     *  Counter object for CTR common mode of operation
     */
    var Counter = function(initialValue) {
        if (!(this instanceof Counter)) {
            throw Error('Counter must be instanitated with `new`');
        }

        // We allow 0, but anything false-ish uses the default 1
        if (initialValue !== 0 && !initialValue) { initialValue = 1; }

        if (typeof(initialValue) === 'number') {
            this._counter = createArray(16);
            this.setValue(initialValue);

        } else {
            this.setBytes(initialValue);
        }
    };

    Counter.prototype.setValue = function(value) {
        if (typeof(value) !== 'number' || parseInt(value) != value) {
            throw new Error('invalid counter value (must be an integer)');
        }

        for (var index = 15; index >= 0; --index) {
            this._counter[index] = value % 256;
            value = value >> 8;
        }
    };

    Counter.prototype.setBytes = function(bytes) {
        bytes = coerceArray(bytes, true);

        if (bytes.length != 16) {
            throw new Error('invalid counter bytes size (must be 16 bytes)');
        }

        this._counter = bytes;
    };

    Counter.prototype.increment = function() {
        for (var i = 15; i >= 0; i--) {
            if (this._counter[i] === 255) {
                this._counter[i] = 0;
            } else {
                this._counter[i]++;
                break;
            }
        }
    };


    /**
     *  Mode Of Operation - Counter (CTR)
     */
    var ModeOfOperationCTR = function(key, counter) {
        if (!(this instanceof ModeOfOperationCTR)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Counter";
        this.name = "ctr";

        if (!(counter instanceof Counter)) {
            counter = new Counter(counter);
        }

        this._counter = counter;

        this._remainingCounter = null;
        this._remainingCounterIndex = 16;

        this._aes = new AES(key);
    };

    ModeOfOperationCTR.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._remainingCounterIndex === 16) {
                this._remainingCounter = this._aes.encrypt(this._counter._counter);
                this._remainingCounterIndex = 0;
                this._counter.increment();
            }
            encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
        }

        return encrypted;
    };

    // Decryption is symetric
    ModeOfOperationCTR.prototype.decrypt = ModeOfOperationCTR.prototype.encrypt;


    ///////////////////////
    // Padding

    // See:https://tools.ietf.org/html/rfc2315
    function pkcs7pad(data) {
        data = coerceArray(data, true);
        var padder = 16 - (data.length % 16);
        var result = createArray(data.length + padder);
        copyArray(data, result);
        for (var i = data.length; i < result.length; i++) {
            result[i] = padder;
        }
        return result;
    }

    function pkcs7strip(data) {
        data = coerceArray(data, true);
        if (data.length < 16) { throw new Error('PKCS#7 invalid length'); }

        var padder = data[data.length - 1];
        if (padder > 16) { throw new Error('PKCS#7 padding byte out of range'); }

        var length = data.length - padder;
        for (var i = 0; i < padder; i++) {
            if (data[length + i] !== padder) {
                throw new Error('PKCS#7 invalid padding byte');
            }
        }

        var result = createArray(length);
        copyArray(data, result, 0, 0, length);
        return result;
    }

    ///////////////////////
    // Exporting


    // The block cipher
    var aesjs = {
        AES: AES,
        Counter: Counter,

        ModeOfOperation: {
            ecb: ModeOfOperationECB,
            cbc: ModeOfOperationCBC,
            cfb: ModeOfOperationCFB,
            ofb: ModeOfOperationOFB,
            ctr: ModeOfOperationCTR
        },

        utils: {
            hex: convertHex,
            utf8: convertUtf8
        },

        padding: {
            pkcs7: {
                pad: pkcs7pad,
                strip: pkcs7strip
            }
        },

        _arrayTest: {
            coerceArray: coerceArray,
            createArray: createArray,
            copyArray: copyArray,
        }
    };


    // node.js
    {
        module.exports = aesjs;

    // RequireJS/AMD
    // http://www.requirejs.org/docs/api.html
    // https://github.com/amdjs/amdjs-api/wiki/AMD
    }


})();
}(aesJs));

var aes = aesJs.exports;

const version$6 = "json-wallets/5.7.0";

function looseArrayify(hexString) {
    if (typeof (hexString) === 'string' && hexString.substring(0, 2) !== '0x') {
        hexString = '0x' + hexString;
    }
    return arrayify(hexString);
}
function zpad(value, length) {
    value = String(value);
    while (value.length < length) {
        value = '0' + value;
    }
    return value;
}
function getPassword(password) {
    if (typeof (password) === 'string') {
        return toUtf8Bytes(password, UnicodeNormalizationForm.NFKC);
    }
    return arrayify(password);
}
function searchPath(object, path) {
    let currentChild = object;
    const comps = path.toLowerCase().split('/');
    for (let i = 0; i < comps.length; i++) {
        // Search for a child object with a case-insensitive matching key
        let matchingChild = null;
        for (const key in currentChild) {
            if (key.toLowerCase() === comps[i]) {
                matchingChild = currentChild[key];
                break;
            }
        }
        // Didn't find one. :'(
        if (matchingChild === null) {
            return null;
        }
        // Now check this child...
        currentChild = matchingChild;
    }
    return currentChild;
}
// See: https://www.ietf.org/rfc/rfc4122.txt (Section 4.4)
function uuidV4(randomBytes) {
    const bytes = arrayify(randomBytes);
    // Section: 4.1.3:
    // - time_hi_and_version[12:16] = 0b0100
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Section 4.4
    // - clock_seq_hi_and_reserved[6] = 0b0
    // - clock_seq_hi_and_reserved[7] = 0b1
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = hexlify(bytes);
    return [
        value.substring(2, 10),
        value.substring(10, 14),
        value.substring(14, 18),
        value.substring(18, 22),
        value.substring(22, 34),
    ].join("-");
}

const logger$9 = new Logger$2(version$6);
class CrowdsaleAccount extends Description {
    isCrowdsaleAccount(value) {
        return !!(value && value._isCrowdsaleAccount);
    }
}
// See: https://github.com/ethereum/pyethsaletool
function decrypt$1(json, password) {
    const data = JSON.parse(json);
    password = getPassword(password);
    // Ethereum Address
    const ethaddr = getAddress(searchPath(data, "ethaddr"));
    // Encrypted Seed
    const encseed = looseArrayify(searchPath(data, "encseed"));
    if (!encseed || (encseed.length % 16) !== 0) {
        logger$9.throwArgumentError("invalid encseed", "json", json);
    }
    const key = arrayify(pbkdf2$1(password, password, 2000, 32, "sha256")).slice(0, 16);
    const iv = encseed.slice(0, 16);
    const encryptedSeed = encseed.slice(16);
    // Decrypt the seed
    const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
    const seed = aes.padding.pkcs7.strip(arrayify(aesCbc.decrypt(encryptedSeed)));
    // This wallet format is weird... Convert the binary encoded hex to a string.
    let seedHex = "";
    for (let i = 0; i < seed.length; i++) {
        seedHex += String.fromCharCode(seed[i]);
    }
    const seedHexBytes = toUtf8Bytes(seedHex);
    const privateKey = keccak256(seedHexBytes);
    return new CrowdsaleAccount({
        _isCrowdsaleAccount: true,
        address: ethaddr,
        privateKey: privateKey
    });
}

function isCrowdsaleWallet(json) {
    let data = null;
    try {
        data = JSON.parse(json);
    }
    catch (error) {
        return false;
    }
    return (data.encseed && data.ethaddr);
}
function isKeystoreWallet(json) {
    let data = null;
    try {
        data = JSON.parse(json);
    }
    catch (error) {
        return false;
    }
    if (!data.version || parseInt(data.version) !== data.version || parseInt(data.version) !== 3) {
        return false;
    }
    // @TODO: Put more checks to make sure it has kdf, iv and all that good stuff
    return true;
}

var scrypt$1 = {exports: {}};

(function (module, exports) {

(function(root) {
    const MAX_VALUE = 0x7fffffff;

    // The SHA256 and PBKDF2 implementation are from scrypt-async-js:
    // See: https://github.com/dchest/scrypt-async-js
    function SHA256(m) {
        const K = new Uint32Array([
           0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
           0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
           0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
           0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
           0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
           0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
           0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
           0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
           0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
           0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
           0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
           0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
           0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
       ]);

        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
        let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
        const w = new Uint32Array(64);

        function blocks(p) {
            let off = 0, len = p.length;
            while (len >= 64) {
                let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7, u, i, j, t1, t2;

                for (i = 0; i < 16; i++) {
                    j = off + i*4;
                    w[i] = ((p[j] & 0xff)<<24) | ((p[j+1] & 0xff)<<16) |
                    ((p[j+2] & 0xff)<<8) | (p[j+3] & 0xff);
                }

                for (i = 16; i < 64; i++) {
                    u = w[i-2];
                    t1 = ((u>>>17) | (u<<(32-17))) ^ ((u>>>19) | (u<<(32-19))) ^ (u>>>10);

                    u = w[i-15];
                    t2 = ((u>>>7) | (u<<(32-7))) ^ ((u>>>18) | (u<<(32-18))) ^ (u>>>3);

                    w[i] = (((t1 + w[i-7]) | 0) + ((t2 + w[i-16]) | 0)) | 0;
                }

                for (i = 0; i < 64; i++) {
                    t1 = ((((((e>>>6) | (e<<(32-6))) ^ ((e>>>11) | (e<<(32-11))) ^
                             ((e>>>25) | (e<<(32-25)))) + ((e & f) ^ (~e & g))) | 0) +
                          ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;

                    t2 = ((((a>>>2) | (a<<(32-2))) ^ ((a>>>13) | (a<<(32-13))) ^
                           ((a>>>22) | (a<<(32-22)))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;

                    h = g;
                    g = f;
                    f = e;
                    e = (d + t1) | 0;
                    d = c;
                    c = b;
                    b = a;
                    a = (t1 + t2) | 0;
                }

                h0 = (h0 + a) | 0;
                h1 = (h1 + b) | 0;
                h2 = (h2 + c) | 0;
                h3 = (h3 + d) | 0;
                h4 = (h4 + e) | 0;
                h5 = (h5 + f) | 0;
                h6 = (h6 + g) | 0;
                h7 = (h7 + h) | 0;

                off += 64;
                len -= 64;
            }
        }

        blocks(m);

        let i, bytesLeft = m.length % 64,
        bitLenHi = (m.length / 0x20000000) | 0,
        bitLenLo = m.length << 3,
        numZeros = (bytesLeft < 56) ? 56 : 120,
        p = m.slice(m.length - bytesLeft, m.length);

        p.push(0x80);
        for (i = bytesLeft + 1; i < numZeros; i++) { p.push(0); }
        p.push((bitLenHi >>> 24) & 0xff);
        p.push((bitLenHi >>> 16) & 0xff);
        p.push((bitLenHi >>> 8)  & 0xff);
        p.push((bitLenHi >>> 0)  & 0xff);
        p.push((bitLenLo >>> 24) & 0xff);
        p.push((bitLenLo >>> 16) & 0xff);
        p.push((bitLenLo >>> 8)  & 0xff);
        p.push((bitLenLo >>> 0)  & 0xff);

        blocks(p);

        return [
            (h0 >>> 24) & 0xff, (h0 >>> 16) & 0xff, (h0 >>> 8) & 0xff, (h0 >>> 0) & 0xff,
            (h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, (h1 >>> 0) & 0xff,
            (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, (h2 >>> 0) & 0xff,
            (h3 >>> 24) & 0xff, (h3 >>> 16) & 0xff, (h3 >>> 8) & 0xff, (h3 >>> 0) & 0xff,
            (h4 >>> 24) & 0xff, (h4 >>> 16) & 0xff, (h4 >>> 8) & 0xff, (h4 >>> 0) & 0xff,
            (h5 >>> 24) & 0xff, (h5 >>> 16) & 0xff, (h5 >>> 8) & 0xff, (h5 >>> 0) & 0xff,
            (h6 >>> 24) & 0xff, (h6 >>> 16) & 0xff, (h6 >>> 8) & 0xff, (h6 >>> 0) & 0xff,
            (h7 >>> 24) & 0xff, (h7 >>> 16) & 0xff, (h7 >>> 8) & 0xff, (h7 >>> 0) & 0xff
        ];
    }

    function PBKDF2_HMAC_SHA256_OneIter(password, salt, dkLen) {
        // compress password if it's longer than hash block length
        password = (password.length <= 64) ? password : SHA256(password);

        const innerLen = 64 + salt.length + 4;
        const inner = new Array(innerLen);
        const outerKey = new Array(64);

        let i;
        let dk = [];

        // inner = (password ^ ipad) || salt || counter
        for (i = 0; i < 64; i++) { inner[i] = 0x36; }
        for (i = 0; i < password.length; i++) { inner[i] ^= password[i]; }
        for (i = 0; i < salt.length; i++) { inner[64 + i] = salt[i]; }
        for (i = innerLen - 4; i < innerLen; i++) { inner[i] = 0; }

        // outerKey = password ^ opad
        for (i = 0; i < 64; i++) outerKey[i] = 0x5c;
        for (i = 0; i < password.length; i++) outerKey[i] ^= password[i];

        // increments counter inside inner
        function incrementCounter() {
            for (let i = innerLen - 1; i >= innerLen - 4; i--) {
                inner[i]++;
                if (inner[i] <= 0xff) return;
                inner[i] = 0;
            }
        }

        // output blocks = SHA256(outerKey || SHA256(inner)) ...
        while (dkLen >= 32) {
            incrementCounter();
            dk = dk.concat(SHA256(outerKey.concat(SHA256(inner))));
            dkLen -= 32;
        }
        if (dkLen > 0) {
            incrementCounter();
            dk = dk.concat(SHA256(outerKey.concat(SHA256(inner))).slice(0, dkLen));
        }

        return dk;
    }

    // The following is an adaptation of scryptsy
    // See: https://www.npmjs.com/package/scryptsy
    function blockmix_salsa8(BY, Yi, r, x, _X) {
        let i;

        arraycopy(BY, (2 * r - 1) * 16, _X, 0, 16);
        for (i = 0; i < 2 * r; i++) {
            blockxor(BY, i * 16, _X, 16);
            salsa20_8(_X, x);
            arraycopy(_X, 0, BY, Yi + (i * 16), 16);
        }

        for (i = 0; i < r; i++) {
            arraycopy(BY, Yi + (i * 2) * 16, BY, (i * 16), 16);
        }

        for (i = 0; i < r; i++) {
            arraycopy(BY, Yi + (i * 2 + 1) * 16, BY, (i + r) * 16, 16);
        }
    }

    function R(a, b) {
        return (a << b) | (a >>> (32 - b));
    }

    function salsa20_8(B, x) {
        arraycopy(B, 0, x, 0, 16);

        for (let i = 8; i > 0; i -= 2) {
            x[ 4] ^= R(x[ 0] + x[12], 7);
            x[ 8] ^= R(x[ 4] + x[ 0], 9);
            x[12] ^= R(x[ 8] + x[ 4], 13);
            x[ 0] ^= R(x[12] + x[ 8], 18);
            x[ 9] ^= R(x[ 5] + x[ 1], 7);
            x[13] ^= R(x[ 9] + x[ 5], 9);
            x[ 1] ^= R(x[13] + x[ 9], 13);
            x[ 5] ^= R(x[ 1] + x[13], 18);
            x[14] ^= R(x[10] + x[ 6], 7);
            x[ 2] ^= R(x[14] + x[10], 9);
            x[ 6] ^= R(x[ 2] + x[14], 13);
            x[10] ^= R(x[ 6] + x[ 2], 18);
            x[ 3] ^= R(x[15] + x[11], 7);
            x[ 7] ^= R(x[ 3] + x[15], 9);
            x[11] ^= R(x[ 7] + x[ 3], 13);
            x[15] ^= R(x[11] + x[ 7], 18);
            x[ 1] ^= R(x[ 0] + x[ 3], 7);
            x[ 2] ^= R(x[ 1] + x[ 0], 9);
            x[ 3] ^= R(x[ 2] + x[ 1], 13);
            x[ 0] ^= R(x[ 3] + x[ 2], 18);
            x[ 6] ^= R(x[ 5] + x[ 4], 7);
            x[ 7] ^= R(x[ 6] + x[ 5], 9);
            x[ 4] ^= R(x[ 7] + x[ 6], 13);
            x[ 5] ^= R(x[ 4] + x[ 7], 18);
            x[11] ^= R(x[10] + x[ 9], 7);
            x[ 8] ^= R(x[11] + x[10], 9);
            x[ 9] ^= R(x[ 8] + x[11], 13);
            x[10] ^= R(x[ 9] + x[ 8], 18);
            x[12] ^= R(x[15] + x[14], 7);
            x[13] ^= R(x[12] + x[15], 9);
            x[14] ^= R(x[13] + x[12], 13);
            x[15] ^= R(x[14] + x[13], 18);
        }

        for (let i = 0; i < 16; ++i) {
            B[i] += x[i];
        }
    }

    // naive approach... going back to loop unrolling may yield additional performance
    function blockxor(S, Si, D, len) {
        for (let i = 0; i < len; i++) {
            D[i] ^= S[Si + i];
        }
    }

    function arraycopy(src, srcPos, dest, destPos, length) {
        while (length--) {
            dest[destPos++] = src[srcPos++];
        }
    }

    function checkBufferish(o) {
        if (!o || typeof(o.length) !== 'number') { return false; }

        for (let i = 0; i < o.length; i++) {
            const v = o[i];
            if (typeof(v) !== 'number' || v % 1 || v < 0 || v >= 256) {
                return false;
            }
        }

        return true;
    }

    function ensureInteger(value, name) {
        if (typeof(value) !== "number" || (value % 1)) { throw new Error('invalid ' + name); }
        return value;
    }

    // N = Cpu cost, r = Memory cost, p = parallelization cost
    // callback(error, progress, key)
    function _scrypt(password, salt, N, r, p, dkLen, callback) {

        N = ensureInteger(N, 'N');
        r = ensureInteger(r, 'r');
        p = ensureInteger(p, 'p');

        dkLen = ensureInteger(dkLen, 'dkLen');

        if (N === 0 || (N & (N - 1)) !== 0) { throw new Error('N must be power of 2'); }

        if (N > MAX_VALUE / 128 / r) { throw new Error('N too large'); }
        if (r > MAX_VALUE / 128 / p) { throw new Error('r too large'); }

        if (!checkBufferish(password)) {
            throw new Error('password must be an array or buffer');
        }
        password = Array.prototype.slice.call(password);

        if (!checkBufferish(salt)) {
            throw new Error('salt must be an array or buffer');
        }
        salt = Array.prototype.slice.call(salt);

        let b = PBKDF2_HMAC_SHA256_OneIter(password, salt, p * 128 * r);
        const B = new Uint32Array(p * 32 * r);
        for (let i = 0; i < B.length; i++) {
            const j = i * 4;
            B[i] = ((b[j + 3] & 0xff) << 24) |
                   ((b[j + 2] & 0xff) << 16) |
                   ((b[j + 1] & 0xff) << 8) |
                   ((b[j + 0] & 0xff) << 0);
        }

        const XY = new Uint32Array(64 * r);
        const V = new Uint32Array(32 * r * N);

        const Yi = 32 * r;

        // scratch space
        const x = new Uint32Array(16);       // salsa20_8
        const _X = new Uint32Array(16);      // blockmix_salsa8

        const totalOps = p * N * 2;
        let currentOp = 0;
        let lastPercent10 = null;

        // Set this to true to abandon the scrypt on the next step
        let stop = false;

        // State information
        let state = 0;
        let i0 = 0, i1;
        let Bi;

        // How many blockmix_salsa8 can we do per step?
        const limit = callback ? parseInt(1000 / r): 0xffffffff;

        // Trick from scrypt-async; if there is a setImmediate shim in place, use it
        const nextTick = (typeof(setImmediate) !== 'undefined') ? setImmediate : setTimeout;

        // This is really all I changed; making scryptsy a state machine so we occasionally
        // stop and give other evnts on the evnt loop a chance to run. ~RicMoo
        const incrementalSMix = function() {
            if (stop) {
                return callback(new Error('cancelled'), currentOp / totalOps);
            }

            let steps;

            switch (state) {
                case 0:
                    // for (var i = 0; i < p; i++)...
                    Bi = i0 * 32 * r;

                    arraycopy(B, Bi, XY, 0, Yi);                       // ROMix - 1

                    state = 1;                                         // Move to ROMix 2
                    i1 = 0;

                    // Fall through

                case 1:

                    // Run up to 1000 steps of the first inner smix loop
                    steps = N - i1;
                    if (steps > limit) { steps = limit; }
                    for (let i = 0; i < steps; i++) {                  // ROMix - 2
                        arraycopy(XY, 0, V, (i1 + i) * Yi, Yi);         // ROMix - 3
                        blockmix_salsa8(XY, Yi, r, x, _X);             // ROMix - 4
                    }

                    // for (var i = 0; i < N; i++)
                    i1 += steps;
                    currentOp += steps;

                    if (callback) {
                        // Call the callback with the progress (optionally stopping us)
                        const percent10 = parseInt(1000 * currentOp / totalOps);
                        if (percent10 !== lastPercent10) {
                            stop = callback(null, currentOp / totalOps);
                            if (stop) { break; }
                            lastPercent10 = percent10;
                        }
                    }

                    if (i1 < N) { break; }

                    i1 = 0;                                          // Move to ROMix 6
                    state = 2;

                    // Fall through

                case 2:

                    // Run up to 1000 steps of the second inner smix loop
                    steps = N - i1;
                    if (steps > limit) { steps = limit; }
                    for (let i = 0; i < steps; i++) {                // ROMix - 6
                        const offset = (2 * r - 1) * 16;             // ROMix - 7
                        const j = XY[offset] & (N - 1);
                        blockxor(V, j * Yi, XY, Yi);                 // ROMix - 8 (inner)
                        blockmix_salsa8(XY, Yi, r, x, _X);           // ROMix - 9 (outer)
                    }

                    // for (var i = 0; i < N; i++)...
                    i1 += steps;
                    currentOp += steps;

                    // Call the callback with the progress (optionally stopping us)
                    if (callback) {
                        const percent10 = parseInt(1000 * currentOp / totalOps);
                        if (percent10 !== lastPercent10) {
                            stop = callback(null, currentOp / totalOps);
                            if (stop) { break; }
                            lastPercent10 = percent10;
                        }
                    }

                    if (i1 < N) { break; }

                    arraycopy(XY, 0, B, Bi, Yi);                     // ROMix - 10

                    // for (var i = 0; i < p; i++)...
                    i0++;
                    if (i0 < p) {
                        state = 0;
                        break;
                    }

                    b = [];
                    for (let i = 0; i < B.length; i++) {
                        b.push((B[i] >>  0) & 0xff);
                        b.push((B[i] >>  8) & 0xff);
                        b.push((B[i] >> 16) & 0xff);
                        b.push((B[i] >> 24) & 0xff);
                    }

                    const derivedKey = PBKDF2_HMAC_SHA256_OneIter(password, b, dkLen);

                    // Send the result to the callback
                    if (callback) { callback(null, 1.0, derivedKey); }

                    // Done; don't break (which would reschedule)
                    return derivedKey;
            }

            // Schedule the next steps
            if (callback) { nextTick(incrementalSMix); }
        };

        // Run the smix state machine until completion
        if (!callback) {
            while (true) {
                const derivedKey = incrementalSMix();
                if (derivedKey != undefined) { return derivedKey; }
            }
        }

        // Bootstrap the async incremental smix
        incrementalSMix();
    }

    const lib = {
        scrypt: function(password, salt, N, r, p, dkLen, progressCallback) {
            return new Promise(function(resolve, reject) {
                let lastProgress = 0;
                if (progressCallback) { progressCallback(0); }
                _scrypt(password, salt, N, r, p, dkLen, function(error, progress, key) {
                    if (error) {
                        reject(error);
                    } else if (key) {
                        if (progressCallback && lastProgress !== 1) {
                            progressCallback(1);
                        }
                        resolve(new Uint8Array(key));
                    } else if (progressCallback && progress !== lastProgress) {
                        lastProgress = progress;
                        return progressCallback(progress);
                    }
                });
            });
        },
        syncScrypt: function(password, salt, N, r, p, dkLen) {
            return new Uint8Array(_scrypt(password, salt, N, r, p, dkLen));
        }
    };

    // node.js
    {
       module.exports = lib;

    // RequireJS/AMD
    // http://www.requirejs.org/docs/api.html
    // https://github.com/amdjs/amdjs-api/wiki/AMD
    }

})();
}(scrypt$1));

var scrypt = scrypt$1.exports;

var __awaiter$7 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$8 = new Logger$2(version$6);
// Exported Types
function hasMnemonic$1(value) {
    return (value != null && value.mnemonic && value.mnemonic.phrase);
}
class KeystoreAccount extends Description {
    isKeystoreAccount(value) {
        return !!(value && value._isKeystoreAccount);
    }
}
function _decrypt(data, key, ciphertext) {
    const cipher = searchPath(data, "crypto/cipher");
    if (cipher === "aes-128-ctr") {
        const iv = looseArrayify(searchPath(data, "crypto/cipherparams/iv"));
        const counter = new aes.Counter(iv);
        const aesCtr = new aes.ModeOfOperation.ctr(key, counter);
        return arrayify(aesCtr.decrypt(ciphertext));
    }
    return null;
}
function _getAccount(data, key) {
    const ciphertext = looseArrayify(searchPath(data, "crypto/ciphertext"));
    const computedMAC = hexlify(keccak256(concat([key.slice(16, 32), ciphertext]))).substring(2);
    if (computedMAC !== searchPath(data, "crypto/mac").toLowerCase()) {
        throw new Error("invalid password");
    }
    const privateKey = _decrypt(data, key.slice(0, 16), ciphertext);
    if (!privateKey) {
        logger$8.throwError("unsupported cipher", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "decrypt"
        });
    }
    const mnemonicKey = key.slice(32, 64);
    const address = computeAddress(privateKey);
    if (data.address) {
        let check = data.address.toLowerCase();
        if (check.substring(0, 2) !== "0x") {
            check = "0x" + check;
        }
        if (getAddress(check) !== address) {
            throw new Error("address mismatch");
        }
    }
    const account = {
        _isKeystoreAccount: true,
        address: address,
        privateKey: hexlify(privateKey)
    };
    // Version 0.1 x-ethers metadata must contain an encrypted mnemonic phrase
    if (searchPath(data, "x-ethers/version") === "0.1") {
        const mnemonicCiphertext = looseArrayify(searchPath(data, "x-ethers/mnemonicCiphertext"));
        const mnemonicIv = looseArrayify(searchPath(data, "x-ethers/mnemonicCounter"));
        const mnemonicCounter = new aes.Counter(mnemonicIv);
        const mnemonicAesCtr = new aes.ModeOfOperation.ctr(mnemonicKey, mnemonicCounter);
        const path = searchPath(data, "x-ethers/path") || defaultPath;
        const locale = searchPath(data, "x-ethers/locale") || "en";
        const entropy = arrayify(mnemonicAesCtr.decrypt(mnemonicCiphertext));
        try {
            const mnemonic = entropyToMnemonic(entropy, locale);
            const node = HDNode.fromMnemonic(mnemonic, null, locale).derivePath(path);
            if (node.privateKey != account.privateKey) {
                throw new Error("mnemonic mismatch");
            }
            account.mnemonic = node.mnemonic;
        }
        catch (error) {
            // If we don't have the locale wordlist installed to
            // read this mnemonic, just bail and don't set the
            // mnemonic
            if (error.code !== Logger$2.errors.INVALID_ARGUMENT || error.argument !== "wordlist") {
                throw error;
            }
        }
    }
    return new KeystoreAccount(account);
}
function pbkdf2Sync(passwordBytes, salt, count, dkLen, prfFunc) {
    return arrayify(pbkdf2$1(passwordBytes, salt, count, dkLen, prfFunc));
}
function pbkdf2(passwordBytes, salt, count, dkLen, prfFunc) {
    return Promise.resolve(pbkdf2Sync(passwordBytes, salt, count, dkLen, prfFunc));
}
function _computeKdfKey(data, password, pbkdf2Func, scryptFunc, progressCallback) {
    const passwordBytes = getPassword(password);
    const kdf = searchPath(data, "crypto/kdf");
    if (kdf && typeof (kdf) === "string") {
        const throwError = function (name, value) {
            return logger$8.throwArgumentError("invalid key-derivation function parameters", name, value);
        };
        if (kdf.toLowerCase() === "scrypt") {
            const salt = looseArrayify(searchPath(data, "crypto/kdfparams/salt"));
            const N = parseInt(searchPath(data, "crypto/kdfparams/n"));
            const r = parseInt(searchPath(data, "crypto/kdfparams/r"));
            const p = parseInt(searchPath(data, "crypto/kdfparams/p"));
            // Check for all required parameters
            if (!N || !r || !p) {
                throwError("kdf", kdf);
            }
            // Make sure N is a power of 2
            if ((N & (N - 1)) !== 0) {
                throwError("N", N);
            }
            const dkLen = parseInt(searchPath(data, "crypto/kdfparams/dklen"));
            if (dkLen !== 32) {
                throwError("dklen", dkLen);
            }
            return scryptFunc(passwordBytes, salt, N, r, p, 64, progressCallback);
        }
        else if (kdf.toLowerCase() === "pbkdf2") {
            const salt = looseArrayify(searchPath(data, "crypto/kdfparams/salt"));
            let prfFunc = null;
            const prf = searchPath(data, "crypto/kdfparams/prf");
            if (prf === "hmac-sha256") {
                prfFunc = "sha256";
            }
            else if (prf === "hmac-sha512") {
                prfFunc = "sha512";
            }
            else {
                throwError("prf", prf);
            }
            const count = parseInt(searchPath(data, "crypto/kdfparams/c"));
            const dkLen = parseInt(searchPath(data, "crypto/kdfparams/dklen"));
            if (dkLen !== 32) {
                throwError("dklen", dkLen);
            }
            return pbkdf2Func(passwordBytes, salt, count, dkLen, prfFunc);
        }
    }
    return logger$8.throwArgumentError("unsupported key-derivation function", "kdf", kdf);
}
function decryptSync(json, password) {
    const data = JSON.parse(json);
    const key = _computeKdfKey(data, password, pbkdf2Sync, scrypt.syncScrypt);
    return _getAccount(data, key);
}
function decrypt(json, password, progressCallback) {
    return __awaiter$7(this, void 0, void 0, function* () {
        const data = JSON.parse(json);
        const key = yield _computeKdfKey(data, password, pbkdf2, scrypt.scrypt, progressCallback);
        return _getAccount(data, key);
    });
}
function encrypt(account, password, options, progressCallback) {
    try {
        // Check the address matches the private key
        if (getAddress(account.address) !== computeAddress(account.privateKey)) {
            throw new Error("address/privateKey mismatch");
        }
        // Check the mnemonic (if any) matches the private key
        if (hasMnemonic$1(account)) {
            const mnemonic = account.mnemonic;
            const node = HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path || defaultPath);
            if (node.privateKey != account.privateKey) {
                throw new Error("mnemonic mismatch");
            }
        }
    }
    catch (e) {
        return Promise.reject(e);
    }
    // The options are optional, so adjust the call as needed
    if (typeof (options) === "function" && !progressCallback) {
        progressCallback = options;
        options = {};
    }
    if (!options) {
        options = {};
    }
    const privateKey = arrayify(account.privateKey);
    const passwordBytes = getPassword(password);
    let entropy = null;
    let path = null;
    let locale = null;
    if (hasMnemonic$1(account)) {
        const srcMnemonic = account.mnemonic;
        entropy = arrayify(mnemonicToEntropy(srcMnemonic.phrase, srcMnemonic.locale || "en"));
        path = srcMnemonic.path || defaultPath;
        locale = srcMnemonic.locale || "en";
    }
    let client = options.client;
    if (!client) {
        client = "ethers.js";
    }
    // Check/generate the salt
    let salt = null;
    if (options.salt) {
        salt = arrayify(options.salt);
    }
    else {
        salt = randomBytes(32);
    }
    // Override initialization vector
    let iv = null;
    if (options.iv) {
        iv = arrayify(options.iv);
        if (iv.length !== 16) {
            throw new Error("invalid iv");
        }
    }
    else {
        iv = randomBytes(16);
    }
    // Override the uuid
    let uuidRandom = null;
    if (options.uuid) {
        uuidRandom = arrayify(options.uuid);
        if (uuidRandom.length !== 16) {
            throw new Error("invalid uuid");
        }
    }
    else {
        uuidRandom = randomBytes(16);
    }
    // Override the scrypt password-based key derivation function parameters
    let N = (1 << 17), r = 8, p = 1;
    if (options.scrypt) {
        if (options.scrypt.N) {
            N = options.scrypt.N;
        }
        if (options.scrypt.r) {
            r = options.scrypt.r;
        }
        if (options.scrypt.p) {
            p = options.scrypt.p;
        }
    }
    // We take 64 bytes:
    //   - 32 bytes   As normal for the Web3 secret storage (derivedKey, macPrefix)
    //   - 32 bytes   AES key to encrypt mnemonic with (required here to be Ethers Wallet)
    return scrypt.scrypt(passwordBytes, salt, N, r, p, 64, progressCallback).then((key) => {
        key = arrayify(key);
        // This will be used to encrypt the wallet (as per Web3 secret storage)
        const derivedKey = key.slice(0, 16);
        const macPrefix = key.slice(16, 32);
        // This will be used to encrypt the mnemonic phrase (if any)
        const mnemonicKey = key.slice(32, 64);
        // Encrypt the private key
        const counter = new aes.Counter(iv);
        const aesCtr = new aes.ModeOfOperation.ctr(derivedKey, counter);
        const ciphertext = arrayify(aesCtr.encrypt(privateKey));
        // Compute the message authentication code, used to check the password
        const mac = keccak256(concat([macPrefix, ciphertext]));
        // See: https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition
        const data = {
            address: account.address.substring(2).toLowerCase(),
            id: uuidV4(uuidRandom),
            version: 3,
            crypto: {
                cipher: "aes-128-ctr",
                cipherparams: {
                    iv: hexlify(iv).substring(2),
                },
                ciphertext: hexlify(ciphertext).substring(2),
                kdf: "scrypt",
                kdfparams: {
                    salt: hexlify(salt).substring(2),
                    n: N,
                    dklen: 32,
                    p: p,
                    r: r
                },
                mac: mac.substring(2)
            }
        };
        // If we have a mnemonic, encrypt it into the JSON wallet
        if (entropy) {
            const mnemonicIv = randomBytes(16);
            const mnemonicCounter = new aes.Counter(mnemonicIv);
            const mnemonicAesCtr = new aes.ModeOfOperation.ctr(mnemonicKey, mnemonicCounter);
            const mnemonicCiphertext = arrayify(mnemonicAesCtr.encrypt(entropy));
            const now = new Date();
            const timestamp = (now.getUTCFullYear() + "-" +
                zpad(now.getUTCMonth() + 1, 2) + "-" +
                zpad(now.getUTCDate(), 2) + "T" +
                zpad(now.getUTCHours(), 2) + "-" +
                zpad(now.getUTCMinutes(), 2) + "-" +
                zpad(now.getUTCSeconds(), 2) + ".0Z");
            data["x-ethers"] = {
                client: client,
                gethFilename: ("UTC--" + timestamp + "--" + data.address),
                mnemonicCounter: hexlify(mnemonicIv).substring(2),
                mnemonicCiphertext: hexlify(mnemonicCiphertext).substring(2),
                path: path,
                locale: locale,
                version: "0.1"
            };
        }
        return JSON.stringify(data);
    });
}

function decryptJsonWallet(json, password, progressCallback) {
    if (isCrowdsaleWallet(json)) {
        if (progressCallback) {
            progressCallback(0);
        }
        const account = decrypt$1(json, password);
        if (progressCallback) {
            progressCallback(1);
        }
        return Promise.resolve(account);
    }
    if (isKeystoreWallet(json)) {
        return decrypt(json, password, progressCallback);
    }
    return Promise.reject(new Error("invalid JSON wallet"));
}
function decryptJsonWalletSync(json, password) {
    if (isCrowdsaleWallet(json)) {
        return decrypt$1(json, password);
    }
    if (isKeystoreWallet(json)) {
        return decryptSync(json, password);
    }
    throw new Error("invalid JSON wallet");
}

const version$5 = "wallet/5.7.0";

var __awaiter$6 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$7 = new Logger$2(version$5);
function isAccount(value) {
    return (value != null && isHexString(value.privateKey, 32) && value.address != null);
}
function hasMnemonic(value) {
    const mnemonic = value.mnemonic;
    return (mnemonic && mnemonic.phrase);
}
class Wallet$1 extends Signer {
    constructor(privateKey, provider) {
        super();
        if (isAccount(privateKey)) {
            const signingKey = new SigningKey(privateKey.privateKey);
            defineReadOnly$1(this, "_signingKey", () => signingKey);
            defineReadOnly$1(this, "address", computeAddress(this.publicKey));
            if (this.address !== getAddress(privateKey.address)) {
                logger$7.throwArgumentError("privateKey/address mismatch", "privateKey", "[REDACTED]");
            }
            if (hasMnemonic(privateKey)) {
                const srcMnemonic = privateKey.mnemonic;
                defineReadOnly$1(this, "_mnemonic", () => ({
                    phrase: srcMnemonic.phrase,
                    path: srcMnemonic.path || defaultPath,
                    locale: srcMnemonic.locale || "en"
                }));
                const mnemonic = this.mnemonic;
                const node = HDNode.fromMnemonic(mnemonic.phrase, null, mnemonic.locale).derivePath(mnemonic.path);
                if (computeAddress(node.privateKey) !== this.address) {
                    logger$7.throwArgumentError("mnemonic/address mismatch", "privateKey", "[REDACTED]");
                }
            }
            else {
                defineReadOnly$1(this, "_mnemonic", () => null);
            }
        }
        else {
            if (SigningKey.isSigningKey(privateKey)) {
                /* istanbul ignore if */
                if (privateKey.curve !== "secp256k1") {
                    logger$7.throwArgumentError("unsupported curve; must be secp256k1", "privateKey", "[REDACTED]");
                }
                defineReadOnly$1(this, "_signingKey", () => privateKey);
            }
            else {
                // A lot of common tools do not prefix private keys with a 0x (see: #1166)
                if (typeof (privateKey) === "string") {
                    if (privateKey.match(/^[0-9a-f]*$/i) && privateKey.length === 64) {
                        privateKey = "0x" + privateKey;
                    }
                }
                const signingKey = new SigningKey(privateKey);
                defineReadOnly$1(this, "_signingKey", () => signingKey);
            }
            defineReadOnly$1(this, "_mnemonic", () => null);
            defineReadOnly$1(this, "address", computeAddress(this.publicKey));
        }
        /* istanbul ignore if */
        if (provider && !Provider.isProvider(provider)) {
            logger$7.throwArgumentError("invalid provider", "provider", provider);
        }
        defineReadOnly$1(this, "provider", provider || null);
    }
    get mnemonic() { return this._mnemonic(); }
    get privateKey() { return this._signingKey().privateKey; }
    get publicKey() { return this._signingKey().publicKey; }
    getAddress() {
        return Promise.resolve(this.address);
    }
    connect(provider) {
        return new Wallet$1(this, provider);
    }
    signTransaction(transaction) {
        return resolveProperties(transaction).then((tx) => {
            if (tx.from != null) {
                if (getAddress(tx.from) !== this.address) {
                    logger$7.throwArgumentError("transaction from address mismatch", "transaction.from", transaction.from);
                }
                delete tx.from;
            }
            const signature = this._signingKey().signDigest(keccak256(serialize(tx)));
            return serialize(tx, signature);
        });
    }
    signMessage(message) {
        return __awaiter$6(this, void 0, void 0, function* () {
            return joinSignature(this._signingKey().signDigest(hashMessage(message)));
        });
    }
    _signTypedData(domain, types, value) {
        return __awaiter$6(this, void 0, void 0, function* () {
            // Populate any ENS names
            const populated = yield TypedDataEncoder.resolveNames(domain, types, value, (name) => {
                if (this.provider == null) {
                    logger$7.throwError("cannot resolve ENS names without a provider", Logger$2.errors.UNSUPPORTED_OPERATION, {
                        operation: "resolveName",
                        value: name
                    });
                }
                return this.provider.resolveName(name);
            });
            return joinSignature(this._signingKey().signDigest(TypedDataEncoder.hash(populated.domain, types, populated.value)));
        });
    }
    encrypt(password, options, progressCallback) {
        if (typeof (options) === "function" && !progressCallback) {
            progressCallback = options;
            options = {};
        }
        if (progressCallback && typeof (progressCallback) !== "function") {
            throw new Error("invalid callback");
        }
        if (!options) {
            options = {};
        }
        return encrypt(this, password, options, progressCallback);
    }
    /**
     *  Static methods to create Wallet instances.
     */
    static createRandom(options) {
        let entropy = randomBytes(16);
        if (!options) {
            options = {};
        }
        if (options.extraEntropy) {
            entropy = arrayify(hexDataSlice(keccak256(concat([entropy, options.extraEntropy])), 0, 16));
        }
        const mnemonic = entropyToMnemonic(entropy, options.locale);
        return Wallet$1.fromMnemonic(mnemonic, options.path, options.locale);
    }
    static fromEncryptedJson(json, password, progressCallback) {
        return decryptJsonWallet(json, password, progressCallback).then((account) => {
            return new Wallet$1(account);
        });
    }
    static fromEncryptedJsonSync(json, password) {
        return new Wallet$1(decryptJsonWalletSync(json, password));
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        if (!path) {
            path = defaultPath;
        }
        return new Wallet$1(HDNode.fromMnemonic(mnemonic, null, wordlist).derivePath(path));
    }
}

/**
 * The supported networks by Alchemy. Note that some functions are not available
 * on all networks. Please refer to the Alchemy documentation for which APIs are
 * available on which networks
 * {@link https://docs.alchemy.com/alchemy/apis/feature-support-by-chain}
 *
 * @public
 */
var Network;
(function (Network) {
    Network["ETH_MAINNET"] = "eth-mainnet";
    Network["ETH_ROPSTEN"] = "eth-ropsten";
    Network["ETH_GOERLI"] = "eth-goerli";
    Network["ETH_KOVAN"] = "eth-kovan";
    Network["ETH_RINKEBY"] = "eth-rinkeby";
    Network["OPT_MAINNET"] = "opt-mainnet";
    Network["OPT_KOVAN"] = "opt-kovan";
    Network["OPT_GOERLI"] = "opt-goerli";
    Network["ARB_MAINNET"] = "arb-mainnet";
    Network["ARB_RINKEBY"] = "arb-rinkeby";
    Network["ARB_GOERLI"] = "arb-goerli";
    Network["MATIC_MAINNET"] = "polygon-mainnet";
    Network["MATIC_MUMBAI"] = "polygon-mumbai";
    Network["ASTAR_MAINNET"] = "astar-mainnet";
})(Network || (Network = {}));
/**
 * Categories of transfers to use with the {@link AssetTransfersParams} request
 * object when using {@link CoreNamespace.getAssetTransfers}.
 *
 * @public
 */
var AssetTransfersCategory;
(function (AssetTransfersCategory) {
    /**
     * Top level ETH transactions that occur where the `fromAddress` is an
     * external user-created address. External addresses have private keys and are
     * accessed by users.
     */
    AssetTransfersCategory["EXTERNAL"] = "external";
    /**
     * Top level ETH transactions that occur where the `fromAddress` is an
     * internal, smart contract address. For example, a smart contract calling
     * another smart contract or sending
     */
    AssetTransfersCategory["INTERNAL"] = "internal";
    /** ERC20 transfers. */
    AssetTransfersCategory["ERC20"] = "erc20";
    /** ERC721 transfers. */
    AssetTransfersCategory["ERC721"] = "erc721";
    /** ERC1155 transfers. */
    AssetTransfersCategory["ERC1155"] = "erc1155";
    /** Special contracts that don't follow ERC 721/1155, (ex: CryptoKitties). */
    AssetTransfersCategory["SPECIALNFT"] = "specialnft";
})(AssetTransfersCategory || (AssetTransfersCategory = {}));
/**
 * Enum for the order of the {@link AssetTransfersParams} request object when
 * using {@link CoreNamespace.getAssetTransfers}.
 *
 * @public
 */
var AssetTransfersOrder;
(function (AssetTransfersOrder) {
    AssetTransfersOrder["ASCENDING"] = "asc";
    AssetTransfersOrder["DESCENDING"] = "desc";
})(AssetTransfersOrder || (AssetTransfersOrder = {}));
/**
 * An enum for specifying the token type on NFTs.
 *
 * @public
 */
var NftTokenType;
(function (NftTokenType) {
    NftTokenType["ERC721"] = "ERC721";
    NftTokenType["ERC1155"] = "ERC1155";
    NftTokenType["UNKNOWN"] = "UNKNOWN";
})(NftTokenType || (NftTokenType = {}));
/**
 * Enum of NFT filters that can be applied to a {@link getNftsForOwner} request.
 * NFTs that match one or more of these filters are excluded from the response.
 *
 * @beta
 */
var NftExcludeFilters;
(function (NftExcludeFilters) {
    /** Exclude NFTs that have been classified as spam. */
    NftExcludeFilters["SPAM"] = "SPAM";
})(NftExcludeFilters || (NftExcludeFilters = {}));
/** The current state of the NFT contract refresh process. */
var RefreshState;
(function (RefreshState) {
    /** The provided contract is not an NFT or does not contain metadata. */
    RefreshState["DOES_NOT_EXIST"] = "does_not_exist";
    /** The contract has already been queued for refresh. */
    RefreshState["ALREADY_QUEUED"] = "already_queued";
    /** The contract is currently being refreshed. */
    RefreshState["IN_PROGRESS"] = "in_progress";
    /** The contract refresh is complete. */
    RefreshState["FINISHED"] = "finished";
    /** The contract refresh has been queued and await execution. */
    RefreshState["QUEUED"] = "queued";
    /** The contract was unable to be queued due to an internal error. */
    RefreshState["QUEUE_FAILED"] = "queue_failed";
})(RefreshState || (RefreshState = {}));

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter$5(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

// This file is autogenerated by injectVersion.js. Any changes will be
// overwritten on commit!
const VERSION = '2.0.3';

// TODO: Remove ethers package dependency for smaller bundle size.
/**
 * Converts a hex string to a decimal number.
 *
 * @param hexString - The hex string to convert.
 * @public
 */
function fromHex(hexString) {
    return BigNumber.from(hexString).toNumber();
}
/**
 * Converts a number to a hex string.
 *
 * @param num - The number to convert to hex.
 * @public
 */
function toHex(num) {
    return BigNumber.from(num).toHexString();
}

function formatBlock(block) {
    if (typeof block === 'string') {
        return block;
    }
    else if (Number.isInteger(block)) {
        return toHex(block);
    }
    return block.toString();
}
function getNftContractFromRaw(rawNftContract) {
    return {
        address: rawNftContract.address,
        name: rawNftContract.contractMetadata.name,
        symbol: rawNftContract.contractMetadata.symbol,
        totalSupply: rawNftContract.contractMetadata.totalSupply,
        tokenType: parseNftTokenType(rawNftContract.contractMetadata.tokenType)
    };
}
function getBaseNftFromRaw(rawBaseNft, contractAddress) {
    var _a;
    return {
        contract: { address: contractAddress },
        tokenId: BigNumber.from(rawBaseNft.id.tokenId).toString(),
        tokenType: parseNftTokenType((_a = rawBaseNft.id.tokenMetadata) === null || _a === void 0 ? void 0 : _a.tokenType)
    };
}
function getNftFromRaw(rawNft, contractAddress) {
    var _a;
    return {
        contract: { address: contractAddress },
        tokenId: parseNftTokenId(rawNft.id.tokenId),
        tokenType: parseNftTokenType((_a = rawNft.id.tokenMetadata) === null || _a === void 0 ? void 0 : _a.tokenType),
        title: rawNft.title,
        description: parseNftDescription(rawNft.description),
        timeLastUpdated: rawNft.timeLastUpdated,
        metadataError: rawNft.error,
        rawMetadata: rawNft.metadata,
        tokenUri: parseNftTokenUri(rawNft.tokenUri),
        media: parseNftTokenUriArray(rawNft.media)
    };
}
function parseNftTokenId(tokenId) {
    // We have to normalize the token id here since the backend sometimes
    // returns the token ID as a hex string and sometimes as an integer.
    return BigNumber.from(tokenId).toString();
}
function parseNftTokenType(tokenType) {
    switch (tokenType) {
        case 'erc721':
        case 'ERC721':
            return NftTokenType.ERC721;
        case 'erc1155':
        case 'ERC1155':
            return NftTokenType.ERC1155;
        default:
            return NftTokenType.UNKNOWN;
    }
}
function parseNftDescription(description) {
    if (description === undefined) {
        return '';
    }
    return typeof description === 'string' ? description : description.join(' ');
}
function parseNftTokenUri(uri) {
    if (uri && uri.raw.length === 0 && uri.gateway.length == 0) {
        return undefined;
    }
    return uri;
}
function parseNftTokenUriArray(arr) {
    if (arr === undefined) {
        return [];
    }
    return arr.filter(uri => parseNftTokenUri(uri) !== undefined);
}
const IS_BROWSER = typeof window !== 'undefined' && window !== null;

/**
 * Given a REST endpoint, method, and params, sends the request with axios and
 * returns the response.
 */
/**
 * Helper function to send http requests using Axis.
 *
 * @private
 */
// TODO: Support other methods besides GET + other http options.
function sendAxiosRequest(baseUrl, restApiName, methodName, params) {
    const requestUrl = baseUrl + '/' + restApiName;
    const config = {
        headers: IS_BROWSER
            ? {
                'Alchemy-Ethers-Sdk-Version': VERSION,
                'Alchemy-Ethers-Sdk-Method': methodName
            }
            : {
                'Alchemy-Ethers-Sdk-Version': VERSION,
                'Alchemy-Ethers-Sdk-Method': methodName,
                'Accept-Encoding': 'gzip'
            },
        method: 'get',
        url: requestUrl,
        params
    };
    return axios(config);
}

/**
 * The SDK has 4 log levels and a 5th option for disabling all logging. By
 * default, the log level is set to INFO.
 *
 * The order is a follows: DEBUG < INFO < WARN < ERROR
 *
 * All log types above the current log level will be outputted.
 */
var LogLevel$1;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["SILENT"] = 4] = "SILENT";
})(LogLevel$1 || (LogLevel$1 = {}));
({
    debug: LogLevel$1.DEBUG,
    info: LogLevel$1.INFO,
    warn: LogLevel$1.WARN,
    error: LogLevel$1.ERROR,
    silent: LogLevel$1.SILENT
});
// HACKY: Use the console method as a string rather than the function itself
// in order to allow for mocking in tests.
const logLevelToConsoleFn = {
    [LogLevel$1.DEBUG]: 'log',
    [LogLevel$1.INFO]: 'info',
    [LogLevel$1.WARN]: 'warn',
    [LogLevel$1.ERROR]: 'error'
};
const DEFAULT_LOG_LEVEL = LogLevel$1.INFO;
function logDebug(message, ...args) {
    loggerClient.debug(message, args);
}
function logInfo(message, ...args) {
    loggerClient.info(message, args);
}
function logWarn(message, ...args) {
    loggerClient.warn(message, args);
}
class Logger$1 {
    constructor() {
        /** The log level of the given Logger instance. */
        this._logLevel = DEFAULT_LOG_LEVEL;
    }
    get logLevel() {
        return this._logLevel;
    }
    set logLevel(val) {
        if (!(val in LogLevel$1)) {
            throw new TypeError(`Invalid value "${val}" assigned to \`logLevel\``);
        }
        this._logLevel = val;
    }
    debug(...args) {
        this._log(LogLevel$1.DEBUG, ...args);
    }
    info(...args) {
        this._log(LogLevel$1.INFO, ...args);
    }
    warn(...args) {
        this._log(LogLevel$1.WARN, ...args);
    }
    error(...args) {
        this._log(LogLevel$1.ERROR, ...args);
    }
    /**
     * Forwards log messages to their corresponding console counterparts if the
     * log level allows it.
     */
    _log(logLevel, ...args) {
        if (logLevel < this._logLevel) {
            return;
        }
        const now = new Date().toISOString();
        const method = logLevelToConsoleFn[logLevel];
        if (method) {
            console[method](`[${now}] Alchemy:`, ...args.map(stringify));
        }
        else {
            throw new Error(`Logger received an invalid logLevel (value: ${logLevel})`);
        }
    }
}
function stringify(obj) {
    if (typeof obj === 'string') {
        return obj;
    }
    else {
        try {
            return JSON.stringify(obj);
        }
        catch (e) {
            // Failed to convert to JSON, log the object directly.
            return obj;
        }
    }
}
// Instantiate default logger for the SDK.
const loggerClient = new Logger$1();

const DEFAULT_BACKOFF_INITIAL_DELAY_MS = 1000;
const DEFAULT_BACKOFF_MULTIPLIER = 1.5;
const DEFAULT_BACKOFF_MAX_DELAY_MS = 30 * 1000;
const DEFAULT_BACKOFF_MAX_ATTEMPTS = 5;
/**
 * Helper class for implementing exponential backoff and max retry attempts.
 *
 * @private
 * @internal
 */
class ExponentialBackoff {
    constructor(maxAttempts = DEFAULT_BACKOFF_MAX_ATTEMPTS) {
        this.maxAttempts = maxAttempts;
        this.initialDelayMs = DEFAULT_BACKOFF_INITIAL_DELAY_MS;
        this.backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER;
        this.maxDelayMs = DEFAULT_BACKOFF_MAX_DELAY_MS;
        this.numAttempts = 0;
        this.currentDelayMs = 0;
        this.isInBackoff = false;
    }
    /**
     * Returns a promise that resolves after the the backoff delay. The delay is
     * increased for each attempt. The promise is rejected if the maximum number
     * of attempts is exceeded.
     */
    // TODO: beautify this into an async iterator.
    backoff() {
        if (this.numAttempts >= this.maxAttempts) {
            return Promise.reject(new Error(`Exceeded maximum number of attempts: ${this.maxAttempts}`));
        }
        if (this.isInBackoff) {
            return Promise.reject(new Error('A backoff operation is already in progress'));
        }
        const backoffDelayWithJitterMs = this.withJitterMs(this.currentDelayMs);
        if (backoffDelayWithJitterMs > 0) {
            logDebug('ExponentialBackoff.backoff', `Backing off for ${backoffDelayWithJitterMs}ms`);
        }
        // Calculate the next delay.
        this.currentDelayMs *= this.backoffMultiplier;
        this.currentDelayMs = Math.max(this.currentDelayMs, this.initialDelayMs);
        this.currentDelayMs = Math.min(this.currentDelayMs, this.maxDelayMs);
        this.numAttempts += 1;
        return new Promise(resolve => {
            this.isInBackoff = true;
            setTimeout(() => {
                this.isInBackoff = false;
                resolve();
            }, backoffDelayWithJitterMs);
        });
    }
    /**
     * Applies +/- 50% jitter to the backoff delay, up to the max delay cap.
     *
     * @private
     * @param delayMs
     */
    withJitterMs(delayMs) {
        return Math.min(delayMs + (Math.random() - 0.5) * delayMs, this.maxDelayMs);
    }
}

/**
 * A wrapper function to make http requests and retry if the request fails.
 *
 * @internal
 */
// TODO: Wrap Axios error in AlchemyError.
function requestHttpWithBackoff(config, apiType, restApiName, methodName, params) {
    return __awaiter$5(this, void 0, void 0, function* () {
        let lastError = undefined;
        const backoff = new ExponentialBackoff(config.maxRetries);
        for (let attempt = 0; attempt < config.maxRetries + 1; attempt++) {
            try {
                if (lastError !== undefined) {
                    logInfo('requestHttp', `Retrying after error: ${lastError.message}`);
                }
                try {
                    yield backoff.backoff();
                }
                catch (err) {
                    // Backoff errors when the maximum number of attempts is reached. Break
                    // out of the loop to preserve the last error.
                    break;
                }
                const response = yield sendAxiosRequest(config._getRequestUrl(apiType), restApiName, methodName, params);
                if (response.status === 200) {
                    logDebug(restApiName, `Successful request: ${restApiName}`);
                    return response.data;
                }
                else {
                    logInfo(restApiName, `Request failed: ${restApiName}, ${response.status}, ${response.data}`);
                    lastError = new Error(response.status + ': ' + response.data);
                }
            }
            catch (err) {
                if (!axios.isAxiosError(err) || err.response === undefined) {
                    throw err;
                }
                // TODO: Standardize all errors into AlchemyError
                lastError = new Error(err.response.status + ': ' + err.response.data);
                if (!isRetryableHttpError(err)) {
                    break;
                }
            }
        }
        return Promise.reject(lastError);
    });
}
function isRetryableHttpError(err) {
    const retryableCodes = [429];
    return (err.response !== undefined && retryableCodes.includes(err.response.status));
}
/**
 * Fetches all pages in a paginated endpoint, given a `pageKey` field that
 * represents the property name containing the next page token.
 *
 * @internal
 */
function paginateEndpoint(config, apiType, restApiName, methodName, reqPageKey, resPageKey, params) {
    return __asyncGenerator(this, arguments, function* paginateEndpoint_1() {
        let hasNext = true;
        const requestParams = Object.assign({}, params);
        while (hasNext) {
            const response = yield __await(requestHttpWithBackoff(config, apiType, restApiName, methodName, requestParams));
            yield yield __await(response);
            if (response[resPageKey] !== undefined) {
                requestParams[reqPageKey] = response[resPageKey];
            }
            else {
                hasNext = false;
            }
        }
    });
}

const DEFAULT_CONTRACT_ADDRESSES = 'DEFAULT_TOKENS';
const DEFAULT_ALCHEMY_API_KEY = 'demo';
const DEFAULT_NETWORK = Network.ETH_MAINNET;
const DEFAULT_MAX_RETRIES = 5;
/**
 * Returns the base URL for making Alchemy API requests. The `alchemy.com`
 * endpoints only work with non eth json-rpc requests.
 *
 * @internal
 */
function getAlchemyHttpUrl(network, apiKey) {
    return `https://${network}.g.alchemy.com/v2/${apiKey}`;
}
function getAlchemyNftHttpUrl(network, apiKey) {
    return `https://${network}.g.alchemy.com/nft/v2/${apiKey}`;
}
function getAlchemyWsUrl(network, apiKey) {
    return `wss://${network}.g.alchemy.com/v2/${apiKey}`;
}
var AlchemyApiType;
(function (AlchemyApiType) {
    AlchemyApiType[AlchemyApiType["BASE"] = 0] = "BASE";
    AlchemyApiType[AlchemyApiType["NFT"] = 1] = "NFT";
})(AlchemyApiType || (AlchemyApiType = {}));
/**
 * Mapping of network names to their corresponding Network strings used to
 * create an Ethers.js Provider instance.
 */
const EthersNetwork = {
    [Network.ETH_MAINNET]: 'mainnet',
    [Network.ETH_ROPSTEN]: 'ropsten',
    [Network.ETH_GOERLI]: 'goerli',
    [Network.ETH_KOVAN]: 'kovan',
    [Network.ETH_RINKEBY]: 'rinkeby',
    [Network.OPT_MAINNET]: 'optimism',
    [Network.OPT_KOVAN]: 'optimism-kovan',
    [Network.OPT_GOERLI]: 'optimism-goerli',
    [Network.ARB_MAINNET]: 'arbitrum',
    [Network.ARB_RINKEBY]: 'arbitrum-rinkeby',
    [Network.ARB_GOERLI]: 'arbitrum-goerli',
    [Network.MATIC_MAINNET]: 'matic',
    [Network.MATIC_MUMBAI]: 'maticmum',
    [Network.ASTAR_MAINNET]: 'astar-mainnet'
};
/**
 * Mapping of network names to their corresponding Ethers Network objects. These
 * networks are not yet supported by Ethers and are listed here to be overriden
 * in the provider.
 */
const CustomNetworks = {
    'arbitrum-goerli': {
        chainId: 421613,
        name: 'arbitrum-goerli'
    },
    'astar-mainnet': {
        chainId: 592,
        name: 'astar-mainnet'
    }
};
function noop$1() {
    // It's a no-op
}
const ETH_NULL_VALUE = '0x';

function getNftMetadata(config, contractAddress, tokenId, tokenType, tokenUriTimeoutInMs, srcMethod = 'getNftMetadata') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getNFTMetadata', srcMethod, {
            contractAddress,
            tokenId: BigNumber.from(tokenId).toString(),
            tokenType: tokenType !== NftTokenType.UNKNOWN ? tokenType : undefined,
            tokenUriTimeoutInMs
        });
        return getNftFromRaw(response, contractAddress);
    });
}
function getContractMetadata(config, contractAddress, srcMethod = 'getContractMetadata') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getContractMetadata', srcMethod, {
            contractAddress
        });
        return getNftContractFromRaw(response);
    });
}
function getNftsForOwnerIterator(config, owner, options, srcMethod = 'getNftsForOwnerIterator') {
    return __asyncGenerator(this, arguments, function* getNftsForOwnerIterator_1() {
        var e_1, _a;
        const withMetadata = omitMetadataToWithMetadata(options === null || options === void 0 ? void 0 : options.omitMetadata);
        try {
            for (var _b = __asyncValues(paginateEndpoint(config, AlchemyApiType.NFT, 'getNFTs', srcMethod, 'pageKey', 'pageKey', {
                contractAddresses: options === null || options === void 0 ? void 0 : options.contractAddresses,
                pageKey: options === null || options === void 0 ? void 0 : options.pageKey,
                filters: options === null || options === void 0 ? void 0 : options.excludeFilters,
                owner,
                withMetadata
            })), _c; _c = yield __await(_b.next()), !_c.done;) {
                const response = _c.value;
                for (const ownedNft of response.ownedNfts) {
                    yield yield __await(Object.assign(Object.assign({}, nftFromGetNftResponse(ownedNft)), { balance: parseInt(ownedNft.balance) }));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
}
function getNftsForOwner(config, owner, options, srcMethod = 'getNftsForOwner') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const withMetadata = omitMetadataToWithMetadata(options === null || options === void 0 ? void 0 : options.omitMetadata);
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getNFTs', srcMethod, {
            contractAddresses: options === null || options === void 0 ? void 0 : options.contractAddresses,
            pageKey: options === null || options === void 0 ? void 0 : options.pageKey,
            filters: options === null || options === void 0 ? void 0 : options.excludeFilters,
            owner,
            pageSize: options === null || options === void 0 ? void 0 : options.pageSize,
            withMetadata,
            tokenUriTimeoutInMs: options === null || options === void 0 ? void 0 : options.tokenUriTimeoutInMs
        });
        return {
            ownedNfts: response.ownedNfts.map(res => (Object.assign(Object.assign({}, nftFromGetNftResponse(res)), { balance: parseInt(res.balance) }))),
            pageKey: response.pageKey,
            totalCount: response.totalCount
        };
    });
}
function getNftsForContract(config, contractAddress, options, srcMethod = 'getNftsForContract') {
    var _a;
    return __awaiter$5(this, void 0, void 0, function* () {
        const withMetadata = omitMetadataToWithMetadata(options === null || options === void 0 ? void 0 : options.omitMetadata);
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getNFTsForCollection', srcMethod, {
            contractAddress,
            startToken: options === null || options === void 0 ? void 0 : options.pageKey,
            withMetadata,
            limit: (_a = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _a !== void 0 ? _a : undefined,
            tokenUriTimeoutInMs: 50
        });
        return {
            nfts: response.nfts.map(res => nftFromGetNftNftContractResponse(res, contractAddress)),
            pageKey: response.nextToken
        };
    });
}
function getNftsForContractIterator(config, contractAddress, options, srcMethod = 'getNftsForContractIterator') {
    return __asyncGenerator(this, arguments, function* getNftsForContractIterator_1() {
        var e_2, _a;
        const withMetadata = omitMetadataToWithMetadata(options === null || options === void 0 ? void 0 : options.omitMetadata);
        try {
            for (var _b = __asyncValues(paginateEndpoint(config, AlchemyApiType.NFT, 'getNFTsForCollection', srcMethod, 'startToken', 'nextToken', {
                contractAddress,
                startToken: options === null || options === void 0 ? void 0 : options.pageKey,
                withMetadata
            })), _c; _c = yield __await(_b.next()), !_c.done;) {
                const response = _c.value;
                for (const nft of response.nfts) {
                    yield yield __await(nftFromGetNftNftContractResponse(nft, contractAddress));
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
            }
            finally { if (e_2) throw e_2.error; }
        }
    });
}
function getOwnersForContract(config, contractAddress, srcMethod = 'getOwnersForContract') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getOwnersForCollection', srcMethod, {
            contractAddress
        });
        return {
            owners: response.ownerAddresses
        };
    });
}
function getOwnersForNft(config, contractAddress, tokenId, srcMethod = 'getOwnersForNft') {
    return __awaiter$5(this, void 0, void 0, function* () {
        return requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getOwnersForToken', srcMethod, {
            contractAddress,
            tokenId: BigNumber.from(tokenId).toString()
        });
    });
}
function checkNftOwnership(config, owner, contractAddresses, srcMethod = 'checkNftOwnership') {
    return __awaiter$5(this, void 0, void 0, function* () {
        if (contractAddresses.length === 0) {
            throw new Error('Must provide at least one contract address');
        }
        const response = yield getNftsForOwner(config, owner, {
            contractAddresses,
            omitMetadata: true
        }, srcMethod);
        return response.ownedNfts.length > 0;
    });
}
function isSpamContract(config, contractAddress, srcMethod = 'isSpamContract') {
    return __awaiter$5(this, void 0, void 0, function* () {
        return requestHttpWithBackoff(config, AlchemyApiType.NFT, 'isSpamContract', srcMethod, {
            contractAddress
        });
    });
}
function getSpamContracts(config, srcMethod = 'getSpamContracts') {
    return __awaiter$5(this, void 0, void 0, function* () {
        return requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getSpamContracts', srcMethod, undefined);
    });
}
function getFloorPrice(config, contractAddress, srcMethod = 'getFloorPrice') {
    return __awaiter$5(this, void 0, void 0, function* () {
        return requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getFloorPrice', srcMethod, {
            contractAddress
        });
    });
}
function refreshNftMetadata(config, contractAddress, tokenId, srcMethod = 'refreshNftMetadata') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const tokenIdString = BigNumber.from(tokenId).toString();
        const first = yield getNftMetadata(config, contractAddress, tokenIdString, undefined, undefined, srcMethod);
        const second = yield refresh(config, contractAddress, tokenIdString, srcMethod);
        return first.timeLastUpdated !== second.timeLastUpdated;
    });
}
function refreshContract(config, contractAddress, srcMethod = 'refreshContract') {
    return __awaiter$5(this, void 0, void 0, function* () {
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'reingestContract', srcMethod, {
            contractAddress
        });
        return {
            contractAddress: response.contractAddress,
            refreshState: parseReingestionState(response.reingestionState),
            progress: response.progress
        };
    });
}
function refresh(config, contractAddress, tokenId, srcMethod) {
    return __awaiter$5(this, void 0, void 0, function* () {
        const response = yield requestHttpWithBackoff(config, AlchemyApiType.NFT, 'getNFTMetadata', srcMethod, {
            contractAddress,
            tokenId: BigNumber.from(tokenId).toString(),
            refreshCache: true
        });
        return getNftFromRaw(response, contractAddress);
    });
}
/**
 * Helper method to convert a NFT response received from Alchemy backend to an
 * SDK NFT type.
 *
 * @internal
 */
function nftFromGetNftResponse(ownedNft) {
    if (isNftWithMetadata(ownedNft)) {
        return getNftFromRaw(ownedNft, ownedNft.contract.address);
    }
    else {
        return getBaseNftFromRaw(ownedNft, ownedNft.contract.address);
    }
}
/**
 * Helper method to convert a NFT response received from Alchemy backend to an
 * SDK NFT type.
 *
 * @internal
 */
function nftFromGetNftNftContractResponse(ownedNft, contractAddress) {
    if (isNftWithMetadata(ownedNft)) {
        return getNftFromRaw(ownedNft, contractAddress);
    }
    else {
        return getBaseNftFromRaw(ownedNft, contractAddress);
    }
}
/** @internal */
// TODO: more comprehensive type check
function isNftWithMetadata(response) {
    return response.title !== undefined;
}
/**
 * Flips the `omitMetadata` SDK parameter type to the `withMetadata` parameter
 * required by the Alchemy API. If `omitMetadata` is undefined, the SDK defaults
 * to including metadata.
 *
 * @internal
 */
function omitMetadataToWithMetadata(omitMetadata) {
    return omitMetadata === undefined ? true : !omitMetadata;
}
function parseReingestionState(reingestionState) {
    switch (reingestionState) {
        case 'does_not_exist':
            return RefreshState.DOES_NOT_EXIST;
        case 'already_queued':
            return RefreshState.ALREADY_QUEUED;
        case 'in_progress':
            return RefreshState.IN_PROGRESS;
        case 'finished':
            return RefreshState.FINISHED;
        case 'queued':
            return RefreshState.QUEUED;
        case 'queue_failed':
            return RefreshState.QUEUE_FAILED;
        default:
            throw new Error('Unknown reingestion state: ' + reingestionState);
    }
}

/**
 * The NFT namespace contains all the functionality related to NFTs.
 *
 * Do not call this constructor directly. Instead, instantiate an Alchemy object
 * with `const alchemy = new Alchemy(config)` and then access the core namespace
 * via `alchemy.nft`.
 */
class NftNamespace {
    /** @internal */
    constructor(config) {
        this.config = config;
    }
    /**
     * Get the NFT metadata associated with the provided parameters.
     *
     * @param contractAddress - The contract address of the NFT.
     * @param tokenId - Token id of the NFT.
     * @param tokenType - Optionally specify the type of token to speed up the query.
     * @param tokenUriTimeoutInMs - No set timeout by default - When metadata is
     *   requested, this parameter is the timeout (in milliseconds) for the
     *   website hosting the metadata to respond. If you want to only access the
     *   cache and not live fetch any metadata for cache misses then set this value to 0.
     * @public
     */
    getNftMetadata(contractAddress, tokenId, tokenType, tokenUriTimeoutInMs) {
        return getNftMetadata(this.config, contractAddress, tokenId, tokenType, tokenUriTimeoutInMs);
    }
    /**
     * Get the NFT collection metadata associated with the provided parameters.
     *
     * @param contractAddress - The contract address of the NFT.
     * @public
     */
    getContractMetadata(contractAddress) {
        return getContractMetadata(this.config, contractAddress);
    }
    getNftsForOwnerIterator(owner, options) {
        return getNftsForOwnerIterator(this.config, owner, options);
    }
    getNftsForOwner(owner, options) {
        return getNftsForOwner(this.config, owner, options);
    }
    getNftsForContract(contractAddress, options) {
        return getNftsForContract(this.config, contractAddress, options);
    }
    getNftsForContractIterator(contractAddress, options) {
        return getNftsForContractIterator(this.config, contractAddress, options);
    }
    /**
     * Gets all the owners for a given NFT contract.
     *
     * @param contractAddress - The NFT contract to get the owners for.
     * @beta
     */
    getOwnersForContract(contractAddress) {
        return getOwnersForContract(this.config, contractAddress);
    }
    /**
     * Gets all the owners for a given NFT contract address and token ID.
     *
     * @param contractAddress - The NFT contract address.
     * @param tokenId - Token id of the NFT.
     * @beta
     */
    getOwnersForNft(contractAddress, tokenId) {
        return getOwnersForNft(this.config, contractAddress, tokenId);
    }
    /**
     * Checks that the provided owner address owns one of more of the provided NFTs.
     *
     * @param owner - The owner address to check.
     * @param contractAddresses - An array of NFT contract addresses to check ownership for.
     * @beta
     */
    checkNftOwnership(owner, contractAddresses) {
        return checkNftOwnership(this.config, owner, contractAddresses);
    }
    /**
     * Returns whether a contract is marked as spam or not by Alchemy. For more
     * information on how we classify spam, go to our NFT API FAQ at
     * https://docs.alchemy.com/alchemy/enhanced-apis/nft-api/nft-api-faq#nft-spam-classification.
     *
     * @param contractAddress - The contract address to check.
     * @beta
     */
    isSpamContract(contractAddress) {
        return isSpamContract(this.config, contractAddress);
    }
    /**
     * Returns a list of all spam contracts marked by Alchemy. For details on how
     * Alchemy marks spam contracts, go to
     * https://docs.alchemy.com/alchemy/enhanced-apis/nft-api/nft-api-faq#nft-spam-classification.
     *
     * @beta
     */
    getSpamContracts() {
        return getSpamContracts(this.config);
    }
    /**
     * Returns the floor prices of a NFT contract by marketplace.
     *
     * @param contractAddress - The contract address for the NFT collection.
     * @beta
     */
    getFloorPrice(contractAddress) {
        return getFloorPrice(this.config, contractAddress);
    }
    /**
     * Refreshes the cached metadata for a provided NFT contract address and token
     * id. Returns a boolean value indicating whether the metadata was refreshed.
     *
     * This method is useful when you want to refresh the metadata for a NFT that
     * has been updated since the last time it was fetched. Note that the backend
     * only allows one refresh per token every 15 minutes, globally for all users.
     * The last refresh time for an NFT can be accessed on the
     * {@link Nft.timeLastUpdated} field.
     *
     * To trigger a refresh for all NFTs in a contract, use {@link refreshContract} instead.
     *
     * @param contractAddress - The contract address of the NFT.
     * @param tokenId - The token id of the NFT.
     */
    refreshNftMetadata(contractAddress, tokenId) {
        return refreshNftMetadata(this.config, contractAddress, tokenId);
    }
    /**
     * Triggers a metadata refresh all NFTs in the provided contract address. This
     * method is useful after an NFT collection is revealed.
     *
     * Refreshes are queued on the Alchemy backend and may take time to fully
     * process. To refresh the metadata for a specific token, use the
     * {@link refreshNftMetadata} method instead.
     *
     * @param contractAddress - The contract address of the NFT collection.
     * @beta
     */
    refreshContract(contractAddress) {
        return refreshContract(this.config, contractAddress);
    }
}

/**
 * The Websocket namespace contains all subscription related functions that
 * allow you to subscribe to events and receive updates as they occur. The
 * underlying WebSocket provider has additional logic to handle reconnections
 * and automatically backfills missed events.
 *
 * Do not call this constructor directly. Instead, instantiate an Alchemy object
 * with `const alchemy = new Alchemy(config)` and then access the core namespace
 * via `alchemy.ws`.
 */
class WebSocketNamespace {
    /** @internal */
    constructor(config) {
        this.config = config;
    }
    /**
     * Adds a listener to be triggered for each {@link eventName} event. Also
     * includes Alchemy's Subscription API events. See {@link AlchemyEventType} for
     * how to use them.
     *
     * @param eventName The event to listen for.
     * @param listener The listener to call when the event is triggered.
     * @public
     */
    on(eventName, listener) {
        void (() => __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            provider.on(eventName, listener);
        }))();
        return this;
    }
    /**
     * Adds a listener to be triggered for only the next {@link eventName} event,
     * after which it will be removed. Also includes Alchemy's Subscription API
     * events. See {@link AlchemyEventType} for how to use them.
     *
     * @param eventName The event to listen for.
     * @param listener The listener to call when the event is triggered.
     * @public
     */
    once(eventName, listener) {
        void (() => __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            provider.once(eventName, listener);
        }))();
        return this;
    }
    /**
     * Removes the provided {@link listener} for the {@link eventName} event. If no
     * listener is provided, all listeners for the event will be removed.
     *
     * @param eventName The event to unlisten to.
     * @param listener The listener to remove.
     * @public
     */
    off(eventName, listener) {
        void (() => __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            return provider.off(eventName, listener);
        }))();
        return this;
    }
    /**
     * Remove all listeners for the provided {@link eventName} event. If no event
     * is provided, all events and their listeners are removed.
     *
     * @param eventName The event to remove all listeners for.
     * @public
     */
    removeAllListeners(eventName) {
        void (() => __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            provider.removeAllListeners(eventName);
        }))();
        return this;
    }
    /**
     * Returns the number of listeners for the provided {@link eventName} event. If
     * no event is provided, the total number of listeners for all events is returned.
     *
     * @param eventName The event to get the number of listeners for.
     * @public
     */
    listenerCount(eventName) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            return provider.listenerCount(eventName);
        });
    }
    /**
     * Returns an array of listeners for the provided {@link eventName} event. If
     * no event is provided, all listeners will be included.
     *
     * @param eventName The event to get the listeners for.
     */
    listeners(eventName) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getWebSocketProvider();
            return provider.listeners(eventName);
        });
    }
}

/**
 * This class holds the config information for the SDK client instance and
 * exposes the underlying providers for more advanced use cases.
 *
 * @public
 */
class AlchemyConfig {
    constructor(config) {
        this.apiKey = (config === null || config === void 0 ? void 0 : config.apiKey) || DEFAULT_ALCHEMY_API_KEY;
        this.network = (config === null || config === void 0 ? void 0 : config.network) || DEFAULT_NETWORK;
        this.maxRetries = (config === null || config === void 0 ? void 0 : config.maxRetries) || DEFAULT_MAX_RETRIES;
        this.url = config === null || config === void 0 ? void 0 : config.url;
    }
    /**
     * Returns the URL endpoint to send the HTTP request to. If a custom URL was
     * provided in the config, that URL is returned. Otherwise, the default URL is
     * from the network and API key.
     *
     * @param apiType - The type of API to get the URL for.
     * @internal
     */
    _getRequestUrl(apiType) {
        if (this.url !== undefined) {
            return this.url;
        }
        else if (apiType === AlchemyApiType.NFT) {
            return getAlchemyNftHttpUrl(this.network, this.apiKey);
        }
        else {
            return getAlchemyHttpUrl(this.network, this.apiKey);
        }
    }
    /**
     * Returns an AlchemyProvider instance. Only one provider is created per
     * Alchemy instance.
     *
     * The AlchemyProvider is a wrapper around ether's `AlchemyProvider` class and
     * has been expanded to support Alchemy's Enhanced APIs.
     *
     * Most common methods on the provider are available as top-level methods on
     * the {@link Alchemy} instance, but the provider is exposed here to access
     * other less-common methods.
     *
     * @public
     */
    getProvider() {
        if (!this._baseAlchemyProvider) {
            this._baseAlchemyProvider = (() => __awaiter$5(this, void 0, void 0, function* () {
                const { AlchemyProvider } = yield Promise.resolve().then(function () { return alchemyProvider1b13a2c9; });
                return new AlchemyProvider(this);
            }))();
        }
        return this._baseAlchemyProvider;
    }
    /**
     * Returns an AlchemyWebsocketProvider instance. Only one provider is created
     * per Alchemy instance.
     *
     * The AlchemyWebSocketProvider is a wrapper around ether's
     * `AlchemyWebSocketProvider` class and has been expanded to support Alchemy's
     * Subscription APIs, automatic backfilling, and other performance improvements.
     *
     * Most common methods on the provider are available as top-level methods on
     * the {@link Alchemy} instance, but the provider is exposed here to access
     * other less-common methods.
     *
     * @internal
     */
    getWebSocketProvider() {
        if (!this._baseAlchemyWssProvider) {
            this._baseAlchemyWssProvider = (() => __awaiter$5(this, void 0, void 0, function* () {
                const { AlchemyWebSocketProvider } = yield Promise.resolve().then(function () { return alchemyWebsocketProvider70d41746; });
                return new AlchemyWebSocketProvider(this);
            }))();
        }
        return this._baseAlchemyWssProvider;
    }
}

/**
 * The core namespace contains all commonly-used [Ethers.js
 * Provider](https://docs.ethers.io/v5/api/providers/api-providers/#AlchemyProvider)
 * methods. If you are already using Ethers.js, you should be simply able to
 * replace the Ethers.js Provider object with `alchemy.core` when accessing
 * provider methods and it should just work.
 *
 * Do not call this constructor directly. Instead, instantiate an Alchemy object
 * with `const alchemy = new Alchemy(config)` and then access the core namespace
 * via `alchemy.core`.
 */
class CoreNamespace {
    /** @internal */
    constructor(config) {
        this.config = config;
    }
    /**
     * Returns the balance of a given address as of the provided block.
     *
     * @param addressOrName The address or name of the account to get the balance for.
     * @param blockTag The optional block number or hash to get the balance for.
     *   Defaults to 'latest' if unspecified.
     * @public
     */
    getBalance(addressOrName, blockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getBalance(addressOrName, blockTag);
        });
    }
    /**
     * Returns the contract code of the provided address at the block. If there is
     * no contract deployed, the result is `0x`.
     *
     * @param addressOrName The address or name of the account to get the code for.
     * @param blockTag The optional block number or hash to get the code for.
     *   Defaults to 'latest' if unspecified.
     * @public
     */
    getCode(addressOrName, blockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getCode(addressOrName, blockTag);
        });
    }
    /**
     * Return the value of the provided position at the provided address, at the
     * provided block in `Bytes32` format.
     *
     * @param addressOrName The address or name of the account to get the code for.
     * @param position The position of the storage slot to get.
     * @param blockTag The optional block number or hash to get the code for.
     *   Defaults to 'latest' if unspecified.
     * @public
     */
    getStorageAt(addressOrName, position, blockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getStorageAt(addressOrName, position, blockTag);
        });
    }
    /**
     * Returns the number of transactions ever sent from the provided address, as
     * of the provided block tag. This value is used as the nonce for the next
     * transaction from the address sent to the network.
     *
     * @param addressOrName The address or name of the account to get the nonce for.
     * @param blockTag The optional block number or hash to get the nonce for.
     * @public
     */
    getTransactionCount(addressOrName, blockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getTransactionCount(addressOrName, blockTag);
        });
    }
    /**
     * Returns the block from the network based on the provided block number or
     * hash. Transactions on the block are represented as an array of transaction
     * hashes. To get the full transaction details on the block, use
     * {@link getBlockWithTransactions} instead.
     *
     * @param blockHashOrBlockTag The block number or hash to get the block for.
     * @public
     */
    getBlock(blockHashOrBlockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getBlock(blockHashOrBlockTag);
        });
    }
    /**
     * Returns the block from the network based on the provided block number or
     * hash. Transactions on the block are represented as an array of
     * {@link TransactionResponse} objects.
     *
     * @param blockHashOrBlockTag The block number or hash to get the block for.
     * @public
     */
    getBlockWithTransactions(blockHashOrBlockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getBlockWithTransactions(blockHashOrBlockTag);
        });
    }
    /**
     * Returns the {@link EthersNetworkAlias} Alchemy is connected to.
     *
     * @public
     */
    getNetwork() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getNetwork();
        });
    }
    /**
     * Returns the block number of the most recently mined block.
     *
     * @public
     */
    getBlockNumber() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getBlockNumber();
        });
    }
    /**
     * Returns the best guess of the current gas price to use in a transaction.
     *
     * @public
     */
    getGasPrice() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getGasPrice();
        });
    }
    /**
     * Returns the recommended fee data to use in a transaction.
     *
     * For an EIP-1559 transaction, the maxFeePerGas and maxPriorityFeePerGas
     * should be used.
     *
     * For legacy transactions and networks which do not support EIP-1559, the
     * gasPrice should be used.
     *
     * @public
     */
    getFeeData() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getFeeData();
        });
    }
    /**
     * Returns a Promise which will stall until the network has heen established,
     * ignoring errors due to the target node not being active yet.
     *
     * This can be used for testing or attaching scripts to wait until the node is
     * up and running smoothly.
     *
     * @public
     */
    ready() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.ready;
        });
    }
    /**
     * Returns the result of executing the transaction, using call. A call does
     * not require any ether, but cannot change any state. This is useful for
     * calling getters on Contracts.
     *
     * @param transaction The transaction to execute.
     * @param blockTag The optional block number or hash to get the call for.
     * @public
     */
    call(transaction, blockTag) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.call(transaction, blockTag);
        });
    }
    /**
     * Returns an estimate of the amount of gas that would be required to submit
     * transaction to the network.
     *
     * An estimate may not be accurate since there could be another transaction on
     * the network that was not accounted for, but after being mined affects the
     * relevant state.
     *
     * @param transaction The transaction to estimate gas for.
     * @public
     */
    estimateGas(transaction) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.estimateGas(transaction);
        });
    }
    /**
     * Returns the transaction with hash or null if the transaction is unknown.
     *
     * If a transaction has not been mined, this method will search the
     * transaction pool. Various backends may have more restrictive transaction
     * pool access (e.g. if the gas price is too low or the transaction was only
     * recently sent and not yet indexed) in which case this method may also return null.
     *
     * NOTE: This is an alias for {@link TransactNamespace.getTransaction}.
     *
     * @param transactionHash The hash of the transaction to get.
     * @public
     */
    getTransaction(transactionHash) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getTransaction(transactionHash);
        });
    }
    /**
     * Returns the transaction receipt for hash or null if the transaction has not
     * been mined.
     *
     * To stall until the transaction has been mined, consider the
     * waitForTransaction method below.
     *
     * @param transactionHash The hash of the transaction to get.
     * @public
     */
    getTransactionReceipt(transactionHash) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getTransactionReceipt(transactionHash);
        });
    }
    /**
     * Submits transaction to the network to be mined. The transaction must be
     * signed, and be valid (i.e. the nonce is correct and the account has
     * sufficient balance to pay for the transaction).
     *
     * NOTE: This is an alias for {@link TransactNamespace.getTransaction}.
     *
     * @param signedTransaction The signed transaction to send.
     * @public
     */
    sendTransaction(signedTransaction) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.sendTransaction(signedTransaction);
        });
    }
    /**
     * Returns a promise which will not resolve until specified transaction hash is mined.
     *
     * If {@link confirmations} is 0, this method is non-blocking and if the
     * transaction has not been mined returns null. Otherwise, this method will
     * block until the transaction has confirmed blocks mined on top of the block
     * in which it was mined.
     *
     * NOTE: This is an alias for {@link TransactNamespace.getTransaction}.
     *
     * @param transactionHash The hash of the transaction to wait for.
     * @param confirmations The number of blocks to wait for.
     * @param timeout The maximum time to wait for the transaction to confirm.
     * @public
     */
    waitForTransaction(transactionHash, confirmations, timeout) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.waitForTransaction(transactionHash, confirmations, timeout);
        });
    }
    /**
     * Returns an array of logs that match the provided filter.
     *
     * @param filter The filter object to use.
     * @public
     */
    getLogs(filter) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getLogs(filter);
        });
    }
    /**
     * Allows sending a raw message to the Alchemy backend.
     *
     * @param method The method to call.
     * @param params The parameters to pass to the method.
     * @public
     */
    send(method, params) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.send(method, params);
        });
    }
    /**
     * Finds the address that deployed the provided contract and block number it
     * was deployed in.
     *
     * NOTE: This method performs a binary search across all blocks since genesis
     * and can take a long time to complete. This method is a convenience method
     * that will eventually be replaced by a single call to an Alchemy endpoint
     * with this information cached.
     *
     * @param contractAddress - The contract address to find the deployer for.
     * @beta
     */
    findContractDeployer(contractAddress) {
        var _a;
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            const currentBlockNum = yield provider.getBlockNumber();
            if ((yield provider.getCode(contractAddress, currentBlockNum)) ===
                ETH_NULL_VALUE) {
                throw new Error(`Contract '${contractAddress}' does not exist`);
            }
            // Binary search for the block number that the contract was deployed in.
            const firstBlock = yield binarySearchFirstBlock(0, currentBlockNum + 1, contractAddress, this.config);
            // Find the first transaction in the block that matches the provided address.
            const txReceipts = yield this.getTransactionReceipts({
                blockNumber: toHex(firstBlock)
            });
            const matchingReceipt = (_a = txReceipts.receipts) === null || _a === void 0 ? void 0 : _a.find(receipt => receipt.contractAddress === contractAddress.toLowerCase());
            return {
                deployerAddress: matchingReceipt === null || matchingReceipt === void 0 ? void 0 : matchingReceipt.from,
                blockNumber: firstBlock
            };
        });
    }
    /**
     * Returns the token balances for a specific owner address given a list of contracts.
     *
     * @param address The owner address to get the token balances for.
     * @param contractAddresses A list of contract addresses to check. If omitted,
     *   the top 100 tokens by 24 hour volume will be checked.
     * @public
     */
    getTokenBalances(address, contractAddresses) {
        return __awaiter$5(this, void 0, void 0, function* () {
            if (contractAddresses && contractAddresses.length > 1500) {
                throw new Error('You cannot pass in more than 1500 contract addresses to getTokenBalances()');
            }
            const provider = yield this.config.getProvider();
            return provider._send('alchemy_getTokenBalances', [address, contractAddresses || DEFAULT_CONTRACT_ADDRESSES], 'getTokenBalances');
        });
    }
    /**
     * Returns metadata for a given token contract address.
     *
     * @param address The contract address to get metadata for.
     * @public
     */
    getTokenMetadata(address) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider._send('alchemy_getTokenMetadata', [address], 'getTokenMetadata');
        });
    }
    getAssetTransfers(params) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider._send('alchemy_getAssetTransfers', [
                Object.assign(Object.assign({}, params), { fromBlock: params.fromBlock != null
                        ? formatBlock(params.fromBlock)
                        : undefined, toBlock: params.toBlock != null ? formatBlock(params.toBlock) : undefined, maxCount: params.maxCount != null ? toHex(params.maxCount) : undefined })
            ], 'getAssetTransfers');
        });
    }
    /**
     * Gets all transaction receipts for a given block by number or block hash.
     *
     * @param params An object containing fields for the transaction receipt query.
     * @public
     */
    getTransactionReceipts(params) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider._send('alchemy_getTransactionReceipts', [params], 'getTransactionReceipts');
        });
    }
}
/**
 * Perform a binary search between an integer range of block numbers to find the
 * block number where the contract was deployed.
 *
 * @internal
 */
function binarySearchFirstBlock(start, end, address, config) {
    return __awaiter$5(this, void 0, void 0, function* () {
        if (start >= end) {
            return end;
        }
        const mid = Math.floor((start + end) / 2);
        const provider = yield config.getProvider();
        const code = yield provider.getCode(address, mid);
        if (code === ETH_NULL_VALUE) {
            return binarySearchFirstBlock(mid + 1, end, address, config);
        }
        return binarySearchFirstBlock(start, mid, address, config);
    });
}

/**
 * The Transact namespace contains methods used for sending transactions and
 * checking on the state of submitted transactions.
 *
 * Do not call this constructor directly. Instead, instantiate an Alchemy object
 * with `const alchemy = new Alchemy(config)` and then access the core namespace
 * via `alchemy.transact`.
 */
class TransactNamespace {
    /** @internal */
    constructor(config) {
        this.config = config;
    }
    /**
     * Used to send a single transaction to Flashbots. Flashbots will attempt to
     * send the transaction to miners for the next 25 blocks.
     *
     * Returns the transaction hash of the submitted transaction.
     *
     * @param signedTransaction The raw, signed transaction as a hash.
     * @param maxBlockNumber Optional hex-encoded number string. Highest block
     *   number in which the transaction should be included.
     * @param options Options to configure the request.
     */
    sendPrivateTransaction(signedTransaction, maxBlockNumber, options) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            const hexBlockNumber = maxBlockNumber ? toHex(maxBlockNumber) : undefined;
            return provider._send('eth_sendPrivateTransaction', [
                {
                    tx: signedTransaction,
                    maxBlockNumber: hexBlockNumber,
                    preferences: options
                }
            ], 'sendPrivateTransaction');
        });
    }
    /**
     * Stops the provided private transaction from being submitted for future
     * blocks. A transaction can only be cancelled if the request is signed by the
     * same key as the {@link sendPrivateTransaction} call submitting the
     * transaction in first place.
     *
     * Please note that fast mode transactions cannot be cancelled using this method.
     *
     * Returns a boolean indicating whether the cancellation was successful.
     *
     * @param transactionHash Transaction hash of private tx to be cancelled
     */
    cancelPrivateTransaction(transactionHash) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider._send('eth_cancelPrivateTransaction', [
                {
                    txHash: transactionHash
                }
            ], 'cancelPrivateTransaction');
        });
    }
    /**
     * Returns the transaction with hash or null if the transaction is unknown.
     *
     * If a transaction has not been mined, this method will search the
     * transaction pool. Various backends may have more restrictive transaction
     * pool access (e.g. if the gas price is too low or the transaction was only
     * recently sent and not yet indexed) in which case this method may also return null.
     *
     * NOTE: This is an alias for {@link CoreNamespace.getTransaction}.
     *
     * @param transactionHash The hash of the transaction to get.
     * @public
     */
    getTransaction(transactionHash) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.getTransaction(transactionHash);
        });
    }
    /**
     * Submits transaction to the network to be mined. The transaction must be
     * signed, and be valid (i.e. the nonce is correct and the account has
     * sufficient balance to pay for the transaction).
     *
     * NOTE: This is an alias for {@link CoreNamespace.sendTransaction}.
     *
     * @param signedTransaction The signed transaction to send.
     * @public
     */
    sendTransaction(signedTransaction) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.sendTransaction(signedTransaction);
        });
    }
    /**
     * Returns a promise which will not resolve until specified transaction hash is mined.
     *
     * If {@link confirmations} is 0, this method is non-blocking and if the
     * transaction has not been mined returns null. Otherwise, this method will
     * block until the transaction has confirmed blocks mined on top of the block
     * in which it was mined.
     *
     * NOTE: This is an alias for {@link CoreNamespace.waitForTransaction}.
     *
     * @param transactionHash The hash of the transaction to wait for.
     * @param confirmations The number of blocks to wait for.
     * @param timeout The maximum time to wait for the transaction to confirm.
     * @public
     */
    waitForTransaction(transactionHash, confirmations, timeout) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const provider = yield this.config.getProvider();
            return provider.waitForTransaction(transactionHash, confirmations, timeout);
        });
    }
}

/**
 * The Alchemy SDK client. This class is the main entry point into Alchemy's
 * APIs and separates functionality into different namespaces.
 *
 * Each SDK instance is associated with a specific network and API key. To use a
 * different network or API key, create a new instance of {@link Alchemy}.
 *
 * @public
 */
class Alchemy {
    /**
     * @param {string} [settings.apiKey] - The API key to use for Alchemy
     * @param {Network} [settings.network] - The network to use for Alchemy
     * @param {number} [settings.maxRetries] - The maximum number of retries to attempt
     * @public
     */
    constructor(settings) {
        this.config = new AlchemyConfig(settings);
        this.core = new CoreNamespace(this.config);
        this.nft = new NftNamespace(this.config);
        this.ws = new WebSocketNamespace(this.config);
        this.transact = new TransactNamespace(this.config);
    }
}

class Wallet extends Wallet$1 {
}

// Optional config object, but defaults to demo api-key and eth-mainnet.
const settings = {
  apiKey: 'd9EFFkpIfWy9F72xlsKA1uWCarExbmtL', // Replace with your Alchemy API Key.
  network: Network.MATIC_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);



var index = ({ filter, schedule }, { services, exceptions, getSchema }) => {
	const { ItemsService } = services;

	filter('items.create', async (input, { collection }, { accountability: { user }}) => {
		if (collection === 'shops') {
			input.owner = user;
		}
		return input;
	});

	schedule('*/1 * * * *', async (foo) => {
		const schema = await getSchema();
		const paymentService = new ItemsService('payments', { schema });
		
		const pendingPayments = await paymentService.readByQuery({
			filter: { 
				"status": {
					"_eq": "Pending",
				},
			},
			fields: ['id', 'tx_hash']
		});

		pendingPayments.forEach((payment) => {
			try {
				alchemy.core.getTransactionReceipt(payment.tx_hash)
				.then(console.log);
			} catch (err) {
				console.log(err);
			}
		});

		console.log(pendingPayments);
	});
};

const version$4 = "networks/5.7.0";

const logger$6 = new Logger$2(version$4);
function isRenetworkable(value) {
    return (value && typeof (value.renetwork) === "function");
}
function ethDefaultProvider(network) {
    const func = function (providers, options) {
        if (options == null) {
            options = {};
        }
        const providerList = [];
        if (providers.InfuraProvider && options.infura !== "-") {
            try {
                providerList.push(new providers.InfuraProvider(network, options.infura));
            }
            catch (error) { }
        }
        if (providers.EtherscanProvider && options.etherscan !== "-") {
            try {
                providerList.push(new providers.EtherscanProvider(network, options.etherscan));
            }
            catch (error) { }
        }
        if (providers.AlchemyProvider && options.alchemy !== "-") {
            try {
                providerList.push(new providers.AlchemyProvider(network, options.alchemy));
            }
            catch (error) { }
        }
        if (providers.PocketProvider && options.pocket !== "-") {
            // These networks are currently faulty on Pocket as their
            // network does not handle the Berlin hardfork, which is
            // live on these ones.
            // @TODO: This goes away once Pocket has upgraded their nodes
            const skip = ["goerli", "ropsten", "rinkeby"];
            try {
                const provider = new providers.PocketProvider(network, options.pocket);
                if (provider.network && skip.indexOf(provider.network.name) === -1) {
                    providerList.push(provider);
                }
            }
            catch (error) { }
        }
        if (providers.CloudflareProvider && options.cloudflare !== "-") {
            try {
                providerList.push(new providers.CloudflareProvider(network));
            }
            catch (error) { }
        }
        if (providers.AnkrProvider && options.ankr !== "-") {
            try {
                const skip = ["ropsten"];
                const provider = new providers.AnkrProvider(network, options.ankr);
                if (provider.network && skip.indexOf(provider.network.name) === -1) {
                    providerList.push(provider);
                }
            }
            catch (error) { }
        }
        if (providerList.length === 0) {
            return null;
        }
        if (providers.FallbackProvider) {
            let quorum = 1;
            if (options.quorum != null) {
                quorum = options.quorum;
            }
            else if (network === "homestead") {
                quorum = 2;
            }
            return new providers.FallbackProvider(providerList, quorum);
        }
        return providerList[0];
    };
    func.renetwork = function (network) {
        return ethDefaultProvider(network);
    };
    return func;
}
function etcDefaultProvider(url, network) {
    const func = function (providers, options) {
        if (providers.JsonRpcProvider) {
            return new providers.JsonRpcProvider(url, network);
        }
        return null;
    };
    func.renetwork = function (network) {
        return etcDefaultProvider(url, network);
    };
    return func;
}
const homestead = {
    chainId: 1,
    ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    name: "homestead",
    _defaultProvider: ethDefaultProvider("homestead")
};
const ropsten = {
    chainId: 3,
    ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    name: "ropsten",
    _defaultProvider: ethDefaultProvider("ropsten")
};
const classicMordor = {
    chainId: 63,
    name: "classicMordor",
    _defaultProvider: etcDefaultProvider("https://www.ethercluster.com/mordor", "classicMordor")
};
// See: https://chainlist.org
const networks = {
    unspecified: { chainId: 0, name: "unspecified" },
    homestead: homestead,
    mainnet: homestead,
    morden: { chainId: 2, name: "morden" },
    ropsten: ropsten,
    testnet: ropsten,
    rinkeby: {
        chainId: 4,
        ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        name: "rinkeby",
        _defaultProvider: ethDefaultProvider("rinkeby")
    },
    kovan: {
        chainId: 42,
        name: "kovan",
        _defaultProvider: ethDefaultProvider("kovan")
    },
    goerli: {
        chainId: 5,
        ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        name: "goerli",
        _defaultProvider: ethDefaultProvider("goerli")
    },
    kintsugi: { chainId: 1337702, name: "kintsugi" },
    // ETC (See: #351)
    classic: {
        chainId: 61,
        name: "classic",
        _defaultProvider: etcDefaultProvider("https:/\/www.ethercluster.com/etc", "classic")
    },
    classicMorden: { chainId: 62, name: "classicMorden" },
    classicMordor: classicMordor,
    classicTestnet: classicMordor,
    classicKotti: {
        chainId: 6,
        name: "classicKotti",
        _defaultProvider: etcDefaultProvider("https:/\/www.ethercluster.com/kotti", "classicKotti")
    },
    xdai: { chainId: 100, name: "xdai" },
    matic: {
        chainId: 137,
        name: "matic",
        _defaultProvider: ethDefaultProvider("matic")
    },
    maticmum: { chainId: 80001, name: "maticmum" },
    optimism: {
        chainId: 10,
        name: "optimism",
        _defaultProvider: ethDefaultProvider("optimism")
    },
    "optimism-kovan": { chainId: 69, name: "optimism-kovan" },
    "optimism-goerli": { chainId: 420, name: "optimism-goerli" },
    arbitrum: { chainId: 42161, name: "arbitrum" },
    "arbitrum-rinkeby": { chainId: 421611, name: "arbitrum-rinkeby" },
    "arbitrum-goerli": { chainId: 421613, name: "arbitrum-goerli" },
    bnb: { chainId: 56, name: "bnb" },
    bnbt: { chainId: 97, name: "bnbt" },
};
/**
 *  getNetwork
 *
 *  Converts a named common networks or chain ID (network ID) to a Network
 *  and verifies a network is a valid Network..
 */
function getNetwork(network) {
    // No network (null)
    if (network == null) {
        return null;
    }
    if (typeof (network) === "number") {
        for (const name in networks) {
            const standard = networks[name];
            if (standard.chainId === network) {
                return {
                    name: standard.name,
                    chainId: standard.chainId,
                    ensAddress: (standard.ensAddress || null),
                    _defaultProvider: (standard._defaultProvider || null)
                };
            }
        }
        return {
            chainId: network,
            name: "unknown"
        };
    }
    if (typeof (network) === "string") {
        const standard = networks[network];
        if (standard == null) {
            return null;
        }
        return {
            name: standard.name,
            chainId: standard.chainId,
            ensAddress: standard.ensAddress,
            _defaultProvider: (standard._defaultProvider || null)
        };
    }
    const standard = networks[network.name];
    // Not a standard network; check that it is a valid network in general
    if (!standard) {
        if (typeof (network.chainId) !== "number") {
            logger$6.throwArgumentError("invalid network chainId", "network", network);
        }
        return network;
    }
    // Make sure the chainId matches the expected network chainId (or is 0; disable EIP-155)
    if (network.chainId !== 0 && network.chainId !== standard.chainId) {
        logger$6.throwArgumentError("network chainId mismatch", "network", network);
    }
    // @TODO: In the next major version add an attach function to a defaultProvider
    // class and move the _defaultProvider internal to this file (extend Network)
    let defaultProvider = network._defaultProvider || null;
    if (defaultProvider == null && standard._defaultProvider) {
        if (isRenetworkable(standard._defaultProvider)) {
            defaultProvider = standard._defaultProvider.renetwork(network);
        }
        else {
            defaultProvider = standard._defaultProvider;
        }
    }
    // Standard Network (allow overriding the ENS address)
    return {
        name: network.name,
        chainId: standard.chainId,
        ensAddress: (network.ensAddress || standard.ensAddress || null),
        _defaultProvider: defaultProvider
    };
}

const version$3 = "web/5.7.0";

var __awaiter$4 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getUrl(href, options) {
    return __awaiter$4(this, void 0, void 0, function* () {
        if (options == null) {
            options = {};
        }
        const request = {
            method: (options.method || "GET"),
            headers: (options.headers || {}),
            body: (options.body || undefined),
        };
        if (options.skipFetchSetup !== true) {
            request.mode = "cors"; // no-cors, cors, *same-origin
            request.cache = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached
            request.credentials = "same-origin"; // include, *same-origin, omit
            request.redirect = "follow"; // manual, *follow, error
            request.referrer = "client"; // no-referrer, *client
        }
        if (options.fetchOptions != null) {
            const opts = options.fetchOptions;
            if (opts.mode) {
                request.mode = (opts.mode);
            }
            if (opts.cache) {
                request.cache = (opts.cache);
            }
            if (opts.credentials) {
                request.credentials = (opts.credentials);
            }
            if (opts.redirect) {
                request.redirect = (opts.redirect);
            }
            if (opts.referrer) {
                request.referrer = opts.referrer;
            }
        }
        const response = yield fetch(href, request);
        const body = yield response.arrayBuffer();
        const headers = {};
        if (response.headers.forEach) {
            response.headers.forEach((value, key) => {
                headers[key.toLowerCase()] = value;
            });
        }
        else {
            ((response.headers).keys)().forEach((key) => {
                headers[key.toLowerCase()] = response.headers.get(key);
            });
        }
        return {
            headers: headers,
            statusCode: response.status,
            statusMessage: response.statusText,
            body: arrayify(new Uint8Array(body)),
        };
    });
}

var __awaiter$3 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$5 = new Logger$2(version$3);
function staller(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}
function bodyify(value, type) {
    if (value == null) {
        return null;
    }
    if (typeof (value) === "string") {
        return value;
    }
    if (isBytesLike(value)) {
        if (type && (type.split("/")[0] === "text" || type.split(";")[0].trim() === "application/json")) {
            try {
                return toUtf8String(value);
            }
            catch (error) { }
        }
        return hexlify(value);
    }
    return value;
}
// This API is still a work in progress; the future changes will likely be:
// - ConnectionInfo => FetchDataRequest<T = any>
// - FetchDataRequest.body? = string | Uint8Array | { contentType: string, data: string | Uint8Array }
//   - If string => text/plain, Uint8Array => application/octet-stream (if content-type unspecified)
// - FetchDataRequest.processFunc = (body: Uint8Array, response: FetchDataResponse) => T
// For this reason, it should be considered internal until the API is finalized
function _fetchData(connection, body, processFunc) {
    // How many times to retry in the event of a throttle
    const attemptLimit = (typeof (connection) === "object" && connection.throttleLimit != null) ? connection.throttleLimit : 12;
    logger$5.assertArgument((attemptLimit > 0 && (attemptLimit % 1) === 0), "invalid connection throttle limit", "connection.throttleLimit", attemptLimit);
    const throttleCallback = ((typeof (connection) === "object") ? connection.throttleCallback : null);
    const throttleSlotInterval = ((typeof (connection) === "object" && typeof (connection.throttleSlotInterval) === "number") ? connection.throttleSlotInterval : 100);
    logger$5.assertArgument((throttleSlotInterval > 0 && (throttleSlotInterval % 1) === 0), "invalid connection throttle slot interval", "connection.throttleSlotInterval", throttleSlotInterval);
    const errorPassThrough = ((typeof (connection) === "object") ? !!(connection.errorPassThrough) : false);
    const headers = {};
    let url = null;
    // @TODO: Allow ConnectionInfo to override some of these values
    const options = {
        method: "GET",
    };
    let allow304 = false;
    let timeout = 2 * 60 * 1000;
    if (typeof (connection) === "string") {
        url = connection;
    }
    else if (typeof (connection) === "object") {
        if (connection == null || connection.url == null) {
            logger$5.throwArgumentError("missing URL", "connection.url", connection);
        }
        url = connection.url;
        if (typeof (connection.timeout) === "number" && connection.timeout > 0) {
            timeout = connection.timeout;
        }
        if (connection.headers) {
            for (const key in connection.headers) {
                headers[key.toLowerCase()] = { key: key, value: String(connection.headers[key]) };
                if (["if-none-match", "if-modified-since"].indexOf(key.toLowerCase()) >= 0) {
                    allow304 = true;
                }
            }
        }
        options.allowGzip = !!connection.allowGzip;
        if (connection.user != null && connection.password != null) {
            if (url.substring(0, 6) !== "https:" && connection.allowInsecureAuthentication !== true) {
                logger$5.throwError("basic authentication requires a secure https url", Logger$2.errors.INVALID_ARGUMENT, { argument: "url", url: url, user: connection.user, password: "[REDACTED]" });
            }
            const authorization = connection.user + ":" + connection.password;
            headers["authorization"] = {
                key: "Authorization",
                value: "Basic " + encode$1(toUtf8Bytes(authorization))
            };
        }
        if (connection.skipFetchSetup != null) {
            options.skipFetchSetup = !!connection.skipFetchSetup;
        }
        if (connection.fetchOptions != null) {
            options.fetchOptions = shallowCopy(connection.fetchOptions);
        }
    }
    const reData = new RegExp("^data:([a-z0-9-]+/[a-z0-9-]+);base64,(.*)$", "i");
    const dataMatch = ((url) ? url.match(reData) : null);
    if (dataMatch) {
        try {
            const response = {
                statusCode: 200,
                statusMessage: "OK",
                headers: { "content-type": dataMatch[1] },
                body: decode$1(dataMatch[2])
            };
            let result = response.body;
            if (processFunc) {
                result = processFunc(response.body, response);
            }
            return Promise.resolve(result);
        }
        catch (error) {
            logger$5.throwError("processing response error", Logger$2.errors.SERVER_ERROR, {
                body: bodyify(dataMatch[1], dataMatch[2]),
                error: error,
                requestBody: null,
                requestMethod: "GET",
                url: url
            });
        }
    }
    if (body) {
        options.method = "POST";
        options.body = body;
        if (headers["content-type"] == null) {
            headers["content-type"] = { key: "Content-Type", value: "application/octet-stream" };
        }
        if (headers["content-length"] == null) {
            headers["content-length"] = { key: "Content-Length", value: String(body.length) };
        }
    }
    const flatHeaders = {};
    Object.keys(headers).forEach((key) => {
        const header = headers[key];
        flatHeaders[header.key] = header.value;
    });
    options.headers = flatHeaders;
    const runningTimeout = (function () {
        let timer = null;
        const promise = new Promise(function (resolve, reject) {
            if (timeout) {
                timer = setTimeout(() => {
                    if (timer == null) {
                        return;
                    }
                    timer = null;
                    reject(logger$5.makeError("timeout", Logger$2.errors.TIMEOUT, {
                        requestBody: bodyify(options.body, flatHeaders["content-type"]),
                        requestMethod: options.method,
                        timeout: timeout,
                        url: url
                    }));
                }, timeout);
            }
        });
        const cancel = function () {
            if (timer == null) {
                return;
            }
            clearTimeout(timer);
            timer = null;
        };
        return { promise, cancel };
    })();
    const runningFetch = (function () {
        return __awaiter$3(this, void 0, void 0, function* () {
            for (let attempt = 0; attempt < attemptLimit; attempt++) {
                let response = null;
                try {
                    response = yield getUrl(url, options);
                    if (attempt < attemptLimit) {
                        if (response.statusCode === 301 || response.statusCode === 302) {
                            // Redirection; for now we only support absolute locataions
                            const location = response.headers.location || "";
                            if (options.method === "GET" && location.match(/^https:/)) {
                                url = response.headers.location;
                                continue;
                            }
                        }
                        else if (response.statusCode === 429) {
                            // Exponential back-off throttling
                            let tryAgain = true;
                            if (throttleCallback) {
                                tryAgain = yield throttleCallback(attempt, url);
                            }
                            if (tryAgain) {
                                let stall = 0;
                                const retryAfter = response.headers["retry-after"];
                                if (typeof (retryAfter) === "string" && retryAfter.match(/^[1-9][0-9]*$/)) {
                                    stall = parseInt(retryAfter) * 1000;
                                }
                                else {
                                    stall = throttleSlotInterval * parseInt(String(Math.random() * Math.pow(2, attempt)));
                                }
                                //console.log("Stalling 429");
                                yield staller(stall);
                                continue;
                            }
                        }
                    }
                }
                catch (error) {
                    response = error.response;
                    if (response == null) {
                        runningTimeout.cancel();
                        logger$5.throwError("missing response", Logger$2.errors.SERVER_ERROR, {
                            requestBody: bodyify(options.body, flatHeaders["content-type"]),
                            requestMethod: options.method,
                            serverError: error,
                            url: url
                        });
                    }
                }
                let body = response.body;
                if (allow304 && response.statusCode === 304) {
                    body = null;
                }
                else if (!errorPassThrough && (response.statusCode < 200 || response.statusCode >= 300)) {
                    runningTimeout.cancel();
                    logger$5.throwError("bad response", Logger$2.errors.SERVER_ERROR, {
                        status: response.statusCode,
                        headers: response.headers,
                        body: bodyify(body, ((response.headers) ? response.headers["content-type"] : null)),
                        requestBody: bodyify(options.body, flatHeaders["content-type"]),
                        requestMethod: options.method,
                        url: url
                    });
                }
                if (processFunc) {
                    try {
                        const result = yield processFunc(body, response);
                        runningTimeout.cancel();
                        return result;
                    }
                    catch (error) {
                        // Allow the processFunc to trigger a throttle
                        if (error.throttleRetry && attempt < attemptLimit) {
                            let tryAgain = true;
                            if (throttleCallback) {
                                tryAgain = yield throttleCallback(attempt, url);
                            }
                            if (tryAgain) {
                                const timeout = throttleSlotInterval * parseInt(String(Math.random() * Math.pow(2, attempt)));
                                //console.log("Stalling callback");
                                yield staller(timeout);
                                continue;
                            }
                        }
                        runningTimeout.cancel();
                        logger$5.throwError("processing response error", Logger$2.errors.SERVER_ERROR, {
                            body: bodyify(body, ((response.headers) ? response.headers["content-type"] : null)),
                            error: error,
                            requestBody: bodyify(options.body, flatHeaders["content-type"]),
                            requestMethod: options.method,
                            url: url
                        });
                    }
                }
                runningTimeout.cancel();
                // If we had a processFunc, it either returned a T or threw above.
                // The "body" is now a Uint8Array.
                return body;
            }
            return logger$5.throwError("failed response", Logger$2.errors.SERVER_ERROR, {
                requestBody: bodyify(options.body, flatHeaders["content-type"]),
                requestMethod: options.method,
                url: url
            });
        });
    })();
    return Promise.race([runningTimeout.promise, runningFetch]);
}
function fetchJson(connection, json, processFunc) {
    let processJsonFunc = (value, response) => {
        let result = null;
        if (value != null) {
            try {
                result = JSON.parse(toUtf8String(value));
            }
            catch (error) {
                logger$5.throwError("invalid JSON", Logger$2.errors.SERVER_ERROR, {
                    body: value,
                    error: error
                });
            }
        }
        if (processFunc) {
            result = processFunc(result, response);
        }
        return result;
    };
    // If we have json to send, we must
    // - add content-type of application/json (unless already overridden)
    // - convert the json to bytes
    let body = null;
    if (json != null) {
        body = toUtf8Bytes(json);
        // Create a connection with the content-type set for JSON
        const updated = (typeof (connection) === "string") ? ({ url: connection }) : shallowCopy(connection);
        if (updated.headers) {
            const hasContentType = (Object.keys(updated.headers).filter((k) => (k.toLowerCase() === "content-type")).length) !== 0;
            if (!hasContentType) {
                updated.headers = shallowCopy(updated.headers);
                updated.headers["content-type"] = "application/json";
            }
        }
        else {
            updated.headers = { "content-type": "application/json" };
        }
        connection = updated;
    }
    return _fetchData(connection, body, processJsonFunc);
}
function poll(func, options) {
    if (!options) {
        options = {};
    }
    options = shallowCopy(options);
    if (options.floor == null) {
        options.floor = 0;
    }
    if (options.ceiling == null) {
        options.ceiling = 10000;
    }
    if (options.interval == null) {
        options.interval = 250;
    }
    return new Promise(function (resolve, reject) {
        let timer = null;
        let done = false;
        // Returns true if cancel was successful. Unsuccessful cancel means we're already done.
        const cancel = () => {
            if (done) {
                return false;
            }
            done = true;
            if (timer) {
                clearTimeout(timer);
            }
            return true;
        };
        if (options.timeout) {
            timer = setTimeout(() => {
                if (cancel()) {
                    reject(new Error("timeout"));
                }
            }, options.timeout);
        }
        const retryLimit = options.retryLimit;
        let attempt = 0;
        function check() {
            return func().then(function (result) {
                // If we have a result, or are allowed null then we're done
                if (result !== undefined) {
                    if (cancel()) {
                        resolve(result);
                    }
                }
                else if (options.oncePoll) {
                    options.oncePoll.once("poll", check);
                }
                else if (options.onceBlock) {
                    options.onceBlock.once("block", check);
                    // Otherwise, exponential back-off (up to 10s) our next request
                }
                else if (!done) {
                    attempt++;
                    if (attempt > retryLimit) {
                        if (cancel()) {
                            reject(new Error("retry limit reached"));
                        }
                        return;
                    }
                    let timeout = options.interval * parseInt(String(Math.random() * Math.pow(2, attempt)));
                    if (timeout < options.floor) {
                        timeout = options.floor;
                    }
                    if (timeout > options.ceiling) {
                        timeout = options.ceiling;
                    }
                    setTimeout(check, timeout);
                }
                return null;
            }, function (error) {
                if (cancel()) {
                    reject(error);
                }
            });
        }
        check();
    });
}

var ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// pre-compute lookup table
var ALPHABET_MAP = {};
for (var z = 0; z < ALPHABET.length; z++) {
  var x = ALPHABET.charAt(z);

  if (ALPHABET_MAP[x] !== undefined) throw new TypeError(x + ' is ambiguous')
  ALPHABET_MAP[x] = z;
}

function polymodStep (pre) {
  var b = pre >> 25;
  return ((pre & 0x1FFFFFF) << 5) ^
    (-((b >> 0) & 1) & 0x3b6a57b2) ^
    (-((b >> 1) & 1) & 0x26508e6d) ^
    (-((b >> 2) & 1) & 0x1ea119fa) ^
    (-((b >> 3) & 1) & 0x3d4233dd) ^
    (-((b >> 4) & 1) & 0x2a1462b3)
}

function prefixChk (prefix) {
  var chk = 1;
  for (var i = 0; i < prefix.length; ++i) {
    var c = prefix.charCodeAt(i);
    if (c < 33 || c > 126) return 'Invalid prefix (' + prefix + ')'

    chk = polymodStep(chk) ^ (c >> 5);
  }
  chk = polymodStep(chk);

  for (i = 0; i < prefix.length; ++i) {
    var v = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (v & 0x1f);
  }
  return chk
}

function encode (prefix, words, LIMIT) {
  LIMIT = LIMIT || 90;
  if ((prefix.length + 7 + words.length) > LIMIT) throw new TypeError('Exceeds length limit')

  prefix = prefix.toLowerCase();

  // determine chk mod
  var chk = prefixChk(prefix);
  if (typeof chk === 'string') throw new Error(chk)

  var result = prefix + '1';
  for (var i = 0; i < words.length; ++i) {
    var x = words[i];
    if ((x >> 5) !== 0) throw new Error('Non 5-bit word')

    chk = polymodStep(chk) ^ x;
    result += ALPHABET.charAt(x);
  }

  for (i = 0; i < 6; ++i) {
    chk = polymodStep(chk);
  }
  chk ^= 1;

  for (i = 0; i < 6; ++i) {
    var v = (chk >> ((5 - i) * 5)) & 0x1f;
    result += ALPHABET.charAt(v);
  }

  return result
}

function __decode (str, LIMIT) {
  LIMIT = LIMIT || 90;
  if (str.length < 8) return str + ' too short'
  if (str.length > LIMIT) return 'Exceeds length limit'

  // don't allow mixed case
  var lowered = str.toLowerCase();
  var uppered = str.toUpperCase();
  if (str !== lowered && str !== uppered) return 'Mixed-case string ' + str
  str = lowered;

  var split = str.lastIndexOf('1');
  if (split === -1) return 'No separator character for ' + str
  if (split === 0) return 'Missing prefix for ' + str

  var prefix = str.slice(0, split);
  var wordChars = str.slice(split + 1);
  if (wordChars.length < 6) return 'Data too short'

  var chk = prefixChk(prefix);
  if (typeof chk === 'string') return chk

  var words = [];
  for (var i = 0; i < wordChars.length; ++i) {
    var c = wordChars.charAt(i);
    var v = ALPHABET_MAP[c];
    if (v === undefined) return 'Unknown character ' + c
    chk = polymodStep(chk) ^ v;

    // not in the checksum?
    if (i + 6 >= wordChars.length) continue
    words.push(v);
  }

  if (chk !== 1) return 'Invalid checksum for ' + str
  return { prefix: prefix, words: words }
}

function decodeUnsafe () {
  var res = __decode.apply(null, arguments);
  if (typeof res === 'object') return res
}

function decode (str) {
  var res = __decode.apply(null, arguments);
  if (typeof res === 'object') return res

  throw new Error(res)
}

function convert (data, inBits, outBits, pad) {
  var value = 0;
  var bits = 0;
  var maxV = (1 << outBits) - 1;

  var result = [];
  for (var i = 0; i < data.length; ++i) {
    value = (value << inBits) | data[i];
    bits += inBits;

    while (bits >= outBits) {
      bits -= outBits;
      result.push((value >> bits) & maxV);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((value << (outBits - bits)) & maxV);
    }
  } else {
    if (bits >= inBits) return 'Excess padding'
    if ((value << (outBits - bits)) & maxV) return 'Non-zero padding'
  }

  return result
}

function toWordsUnsafe (bytes) {
  var res = convert(bytes, 8, 5, true);
  if (Array.isArray(res)) return res
}

function toWords (bytes) {
  var res = convert(bytes, 8, 5, true);
  if (Array.isArray(res)) return res

  throw new Error(res)
}

function fromWordsUnsafe (words) {
  var res = convert(words, 5, 8, false);
  if (Array.isArray(res)) return res
}

function fromWords (words) {
  var res = convert(words, 5, 8, false);
  if (Array.isArray(res)) return res

  throw new Error(res)
}

var bech32 = {
  decodeUnsafe: decodeUnsafe,
  decode: decode,
  encode: encode,
  toWordsUnsafe: toWordsUnsafe,
  toWords: toWords,
  fromWordsUnsafe: fromWordsUnsafe,
  fromWords: fromWords
};

const version$2 = "providers/5.7.0";

const logger$4 = new Logger$2(version$2);
class Formatter {
    constructor() {
        this.formats = this.getDefaultFormats();
    }
    getDefaultFormats() {
        const formats = ({});
        const address = this.address.bind(this);
        const bigNumber = this.bigNumber.bind(this);
        const blockTag = this.blockTag.bind(this);
        const data = this.data.bind(this);
        const hash = this.hash.bind(this);
        const hex = this.hex.bind(this);
        const number = this.number.bind(this);
        const type = this.type.bind(this);
        const strictData = (v) => { return this.data(v, true); };
        formats.transaction = {
            hash: hash,
            type: type,
            accessList: Formatter.allowNull(this.accessList.bind(this), null),
            blockHash: Formatter.allowNull(hash, null),
            blockNumber: Formatter.allowNull(number, null),
            transactionIndex: Formatter.allowNull(number, null),
            confirmations: Formatter.allowNull(number, null),
            from: address,
            // either (gasPrice) or (maxPriorityFeePerGas + maxFeePerGas)
            // must be set
            gasPrice: Formatter.allowNull(bigNumber),
            maxPriorityFeePerGas: Formatter.allowNull(bigNumber),
            maxFeePerGas: Formatter.allowNull(bigNumber),
            gasLimit: bigNumber,
            to: Formatter.allowNull(address, null),
            value: bigNumber,
            nonce: number,
            data: data,
            r: Formatter.allowNull(this.uint256),
            s: Formatter.allowNull(this.uint256),
            v: Formatter.allowNull(number),
            creates: Formatter.allowNull(address, null),
            raw: Formatter.allowNull(data),
        };
        formats.transactionRequest = {
            from: Formatter.allowNull(address),
            nonce: Formatter.allowNull(number),
            gasLimit: Formatter.allowNull(bigNumber),
            gasPrice: Formatter.allowNull(bigNumber),
            maxPriorityFeePerGas: Formatter.allowNull(bigNumber),
            maxFeePerGas: Formatter.allowNull(bigNumber),
            to: Formatter.allowNull(address),
            value: Formatter.allowNull(bigNumber),
            data: Formatter.allowNull(strictData),
            type: Formatter.allowNull(number),
            accessList: Formatter.allowNull(this.accessList.bind(this), null),
        };
        formats.receiptLog = {
            transactionIndex: number,
            blockNumber: number,
            transactionHash: hash,
            address: address,
            topics: Formatter.arrayOf(hash),
            data: data,
            logIndex: number,
            blockHash: hash,
        };
        formats.receipt = {
            to: Formatter.allowNull(this.address, null),
            from: Formatter.allowNull(this.address, null),
            contractAddress: Formatter.allowNull(address, null),
            transactionIndex: number,
            // should be allowNull(hash), but broken-EIP-658 support is handled in receipt
            root: Formatter.allowNull(hex),
            gasUsed: bigNumber,
            logsBloom: Formatter.allowNull(data),
            blockHash: hash,
            transactionHash: hash,
            logs: Formatter.arrayOf(this.receiptLog.bind(this)),
            blockNumber: number,
            confirmations: Formatter.allowNull(number, null),
            cumulativeGasUsed: bigNumber,
            effectiveGasPrice: Formatter.allowNull(bigNumber),
            status: Formatter.allowNull(number),
            type: type
        };
        formats.block = {
            hash: Formatter.allowNull(hash),
            parentHash: hash,
            number: number,
            timestamp: number,
            nonce: Formatter.allowNull(hex),
            difficulty: this.difficulty.bind(this),
            gasLimit: bigNumber,
            gasUsed: bigNumber,
            miner: Formatter.allowNull(address),
            extraData: data,
            transactions: Formatter.allowNull(Formatter.arrayOf(hash)),
            baseFeePerGas: Formatter.allowNull(bigNumber)
        };
        formats.blockWithTransactions = shallowCopy(formats.block);
        formats.blockWithTransactions.transactions = Formatter.allowNull(Formatter.arrayOf(this.transactionResponse.bind(this)));
        formats.filter = {
            fromBlock: Formatter.allowNull(blockTag, undefined),
            toBlock: Formatter.allowNull(blockTag, undefined),
            blockHash: Formatter.allowNull(hash, undefined),
            address: Formatter.allowNull(address, undefined),
            topics: Formatter.allowNull(this.topics.bind(this), undefined),
        };
        formats.filterLog = {
            blockNumber: Formatter.allowNull(number),
            blockHash: Formatter.allowNull(hash),
            transactionIndex: number,
            removed: Formatter.allowNull(this.boolean.bind(this)),
            address: address,
            data: Formatter.allowFalsish(data, "0x"),
            topics: Formatter.arrayOf(hash),
            transactionHash: hash,
            logIndex: number,
        };
        return formats;
    }
    accessList(accessList) {
        return accessListify(accessList || []);
    }
    // Requires a BigNumberish that is within the IEEE754 safe integer range; returns a number
    // Strict! Used on input.
    number(number) {
        if (number === "0x") {
            return 0;
        }
        return BigNumber.from(number).toNumber();
    }
    type(number) {
        if (number === "0x" || number == null) {
            return 0;
        }
        return BigNumber.from(number).toNumber();
    }
    // Strict! Used on input.
    bigNumber(value) {
        return BigNumber.from(value);
    }
    // Requires a boolean, "true" or  "false"; returns a boolean
    boolean(value) {
        if (typeof (value) === "boolean") {
            return value;
        }
        if (typeof (value) === "string") {
            value = value.toLowerCase();
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
        }
        throw new Error("invalid boolean - " + value);
    }
    hex(value, strict) {
        if (typeof (value) === "string") {
            if (!strict && value.substring(0, 2) !== "0x") {
                value = "0x" + value;
            }
            if (isHexString(value)) {
                return value.toLowerCase();
            }
        }
        return logger$4.throwArgumentError("invalid hash", "value", value);
    }
    data(value, strict) {
        const result = this.hex(value, strict);
        if ((result.length % 2) !== 0) {
            throw new Error("invalid data; odd-length - " + value);
        }
        return result;
    }
    // Requires an address
    // Strict! Used on input.
    address(value) {
        return getAddress(value);
    }
    callAddress(value) {
        if (!isHexString(value, 32)) {
            return null;
        }
        const address = getAddress(hexDataSlice(value, 12));
        return (address === AddressZero) ? null : address;
    }
    contractAddress(value) {
        return getContractAddress(value);
    }
    // Strict! Used on input.
    blockTag(blockTag) {
        if (blockTag == null) {
            return "latest";
        }
        if (blockTag === "earliest") {
            return "0x0";
        }
        switch (blockTag) {
            case "earliest": return "0x0";
            case "latest":
            case "pending":
            case "safe":
            case "finalized":
                return blockTag;
        }
        if (typeof (blockTag) === "number" || isHexString(blockTag)) {
            return hexValue(blockTag);
        }
        throw new Error("invalid blockTag");
    }
    // Requires a hash, optionally requires 0x prefix; returns prefixed lowercase hash.
    hash(value, strict) {
        const result = this.hex(value, strict);
        if (hexDataLength(result) !== 32) {
            return logger$4.throwArgumentError("invalid hash", "value", value);
        }
        return result;
    }
    // Returns the difficulty as a number, or if too large (i.e. PoA network) null
    difficulty(value) {
        if (value == null) {
            return null;
        }
        const v = BigNumber.from(value);
        try {
            return v.toNumber();
        }
        catch (error) { }
        return null;
    }
    uint256(value) {
        if (!isHexString(value)) {
            throw new Error("invalid uint256");
        }
        return hexZeroPad(value, 32);
    }
    _block(value, format) {
        if (value.author != null && value.miner == null) {
            value.miner = value.author;
        }
        // The difficulty may need to come from _difficulty in recursed blocks
        const difficulty = (value._difficulty != null) ? value._difficulty : value.difficulty;
        const result = Formatter.check(format, value);
        result._difficulty = ((difficulty == null) ? null : BigNumber.from(difficulty));
        return result;
    }
    block(value) {
        return this._block(value, this.formats.block);
    }
    blockWithTransactions(value) {
        return this._block(value, this.formats.blockWithTransactions);
    }
    // Strict! Used on input.
    transactionRequest(value) {
        return Formatter.check(this.formats.transactionRequest, value);
    }
    transactionResponse(transaction) {
        // Rename gas to gasLimit
        if (transaction.gas != null && transaction.gasLimit == null) {
            transaction.gasLimit = transaction.gas;
        }
        // Some clients (TestRPC) do strange things like return 0x0 for the
        // 0 address; correct this to be a real address
        if (transaction.to && BigNumber.from(transaction.to).isZero()) {
            transaction.to = "0x0000000000000000000000000000000000000000";
        }
        // Rename input to data
        if (transaction.input != null && transaction.data == null) {
            transaction.data = transaction.input;
        }
        // If to and creates are empty, populate the creates from the transaction
        if (transaction.to == null && transaction.creates == null) {
            transaction.creates = this.contractAddress(transaction);
        }
        if ((transaction.type === 1 || transaction.type === 2) && transaction.accessList == null) {
            transaction.accessList = [];
        }
        const result = Formatter.check(this.formats.transaction, transaction);
        if (transaction.chainId != null) {
            let chainId = transaction.chainId;
            if (isHexString(chainId)) {
                chainId = BigNumber.from(chainId).toNumber();
            }
            result.chainId = chainId;
        }
        else {
            let chainId = transaction.networkId;
            // geth-etc returns chainId
            if (chainId == null && result.v == null) {
                chainId = transaction.chainId;
            }
            if (isHexString(chainId)) {
                chainId = BigNumber.from(chainId).toNumber();
            }
            if (typeof (chainId) !== "number" && result.v != null) {
                chainId = (result.v - 35) / 2;
                if (chainId < 0) {
                    chainId = 0;
                }
                chainId = parseInt(chainId);
            }
            if (typeof (chainId) !== "number") {
                chainId = 0;
            }
            result.chainId = chainId;
        }
        // 0x0000... should actually be null
        if (result.blockHash && result.blockHash.replace(/0/g, "") === "x") {
            result.blockHash = null;
        }
        return result;
    }
    transaction(value) {
        return parse(value);
    }
    receiptLog(value) {
        return Formatter.check(this.formats.receiptLog, value);
    }
    receipt(value) {
        const result = Formatter.check(this.formats.receipt, value);
        // RSK incorrectly implemented EIP-658, so we munge things a bit here for it
        if (result.root != null) {
            if (result.root.length <= 4) {
                // Could be 0x00, 0x0, 0x01 or 0x1
                const value = BigNumber.from(result.root).toNumber();
                if (value === 0 || value === 1) {
                    // Make sure if both are specified, they match
                    if (result.status != null && (result.status !== value)) {
                        logger$4.throwArgumentError("alt-root-status/status mismatch", "value", { root: result.root, status: result.status });
                    }
                    result.status = value;
                    delete result.root;
                }
                else {
                    logger$4.throwArgumentError("invalid alt-root-status", "value.root", result.root);
                }
            }
            else if (result.root.length !== 66) {
                // Must be a valid bytes32
                logger$4.throwArgumentError("invalid root hash", "value.root", result.root);
            }
        }
        if (result.status != null) {
            result.byzantium = true;
        }
        return result;
    }
    topics(value) {
        if (Array.isArray(value)) {
            return value.map((v) => this.topics(v));
        }
        else if (value != null) {
            return this.hash(value, true);
        }
        return null;
    }
    filter(value) {
        return Formatter.check(this.formats.filter, value);
    }
    filterLog(value) {
        return Formatter.check(this.formats.filterLog, value);
    }
    static check(format, object) {
        const result = {};
        for (const key in format) {
            try {
                const value = format[key](object[key]);
                if (value !== undefined) {
                    result[key] = value;
                }
            }
            catch (error) {
                error.checkKey = key;
                error.checkValue = object[key];
                throw error;
            }
        }
        return result;
    }
    // if value is null-ish, nullValue is returned
    static allowNull(format, nullValue) {
        return (function (value) {
            if (value == null) {
                return nullValue;
            }
            return format(value);
        });
    }
    // If value is false-ish, replaceValue is returned
    static allowFalsish(format, replaceValue) {
        return (function (value) {
            if (!value) {
                return replaceValue;
            }
            return format(value);
        });
    }
    // Requires an Array satisfying check
    static arrayOf(format) {
        return (function (array) {
            if (!Array.isArray(array)) {
                throw new Error("not an array");
            }
            const result = [];
            array.forEach(function (value) {
                result.push(format(value));
            });
            return result;
        });
    }
}

var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$3 = new Logger$2(version$2);
const MAX_CCIP_REDIRECTS = 10;
//////////////////////////////
// Event Serializeing
function checkTopic(topic) {
    if (topic == null) {
        return "null";
    }
    if (hexDataLength(topic) !== 32) {
        logger$3.throwArgumentError("invalid topic", "topic", topic);
    }
    return topic.toLowerCase();
}
function serializeTopics(topics) {
    // Remove trailing null AND-topics; they are redundant
    topics = topics.slice();
    while (topics.length > 0 && topics[topics.length - 1] == null) {
        topics.pop();
    }
    return topics.map((topic) => {
        if (Array.isArray(topic)) {
            // Only track unique OR-topics
            const unique = {};
            topic.forEach((topic) => {
                unique[checkTopic(topic)] = true;
            });
            // The order of OR-topics does not matter
            const sorted = Object.keys(unique);
            sorted.sort();
            return sorted.join("|");
        }
        else {
            return checkTopic(topic);
        }
    }).join("&");
}
function deserializeTopics$1(data) {
    if (data === "") {
        return [];
    }
    return data.split(/&/g).map((topic) => {
        if (topic === "") {
            return [];
        }
        const comps = topic.split("|").map((topic) => {
            return ((topic === "null") ? null : topic);
        });
        return ((comps.length === 1) ? comps[0] : comps);
    });
}
function getEventTag(eventName) {
    if (typeof (eventName) === "string") {
        eventName = eventName.toLowerCase();
        if (hexDataLength(eventName) === 32) {
            return "tx:" + eventName;
        }
        if (eventName.indexOf(":") === -1) {
            return eventName;
        }
    }
    else if (Array.isArray(eventName)) {
        return "filter:*:" + serializeTopics(eventName);
    }
    else if (ForkEvent.isForkEvent(eventName)) {
        logger$3.warn("not implemented");
        throw new Error("not implemented");
    }
    else if (eventName && typeof (eventName) === "object") {
        return "filter:" + (eventName.address || "*") + ":" + serializeTopics(eventName.topics || []);
    }
    throw new Error("invalid event - " + eventName);
}
//////////////////////////////
// Helper Object
function getTime() {
    return (new Date()).getTime();
}
function stall(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}
//////////////////////////////
// Provider Object
/**
 *  EventType
 *   - "block"
 *   - "poll"
 *   - "didPoll"
 *   - "pending"
 *   - "error"
 *   - "network"
 *   - filter
 *   - topics array
 *   - transaction hash
 */
const PollableEvents = ["block", "network", "pending", "poll"];
class Event$1 {
    constructor(tag, listener, once) {
        defineReadOnly$1(this, "tag", tag);
        defineReadOnly$1(this, "listener", listener);
        defineReadOnly$1(this, "once", once);
        this._lastBlockNumber = -2;
        this._inflight = false;
    }
    get event() {
        switch (this.type) {
            case "tx":
                return this.hash;
            case "filter":
                return this.filter;
        }
        return this.tag;
    }
    get type() {
        return this.tag.split(":")[0];
    }
    get hash() {
        const comps = this.tag.split(":");
        if (comps[0] !== "tx") {
            return null;
        }
        return comps[1];
    }
    get filter() {
        const comps = this.tag.split(":");
        if (comps[0] !== "filter") {
            return null;
        }
        const address = comps[1];
        const topics = deserializeTopics$1(comps[2]);
        const filter = {};
        if (topics.length > 0) {
            filter.topics = topics;
        }
        if (address && address !== "*") {
            filter.address = address;
        }
        return filter;
    }
    pollable() {
        return (this.tag.indexOf(":") >= 0 || PollableEvents.indexOf(this.tag) >= 0);
    }
}
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const coinInfos = {
    "0": { symbol: "btc", p2pkh: 0x00, p2sh: 0x05, prefix: "bc" },
    "2": { symbol: "ltc", p2pkh: 0x30, p2sh: 0x32, prefix: "ltc" },
    "3": { symbol: "doge", p2pkh: 0x1e, p2sh: 0x16 },
    "60": { symbol: "eth", ilk: "eth" },
    "61": { symbol: "etc", ilk: "eth" },
    "700": { symbol: "xdai", ilk: "eth" },
};
function bytes32ify(value) {
    return hexZeroPad(BigNumber.from(value).toHexString(), 32);
}
// Compute the Base58Check encoded data (checksum is first 4 bytes of sha256d)
function base58Encode(data) {
    return Base58.encode(concat([data, hexDataSlice(sha256(sha256(data)), 0, 4)]));
}
const matcherIpfs = new RegExp("^(ipfs):/\/(.*)$", "i");
const matchers = [
    new RegExp("^(https):/\/(.*)$", "i"),
    new RegExp("^(data):(.*)$", "i"),
    matcherIpfs,
    new RegExp("^eip155:[0-9]+/(erc[0-9]+):(.*)$", "i"),
];
function _parseString(result, start) {
    try {
        return toUtf8String(_parseBytes(result, start));
    }
    catch (error) { }
    return null;
}
function _parseBytes(result, start) {
    if (result === "0x") {
        return null;
    }
    const offset = BigNumber.from(hexDataSlice(result, start, start + 32)).toNumber();
    const length = BigNumber.from(hexDataSlice(result, offset, offset + 32)).toNumber();
    return hexDataSlice(result, offset + 32, offset + 32 + length);
}
// Trim off the ipfs:// prefix and return the default gateway URL
function getIpfsLink(link) {
    if (link.match(/^ipfs:\/\/ipfs\//i)) {
        link = link.substring(12);
    }
    else if (link.match(/^ipfs:\/\//i)) {
        link = link.substring(7);
    }
    else {
        logger$3.throwArgumentError("unsupported IPFS format", "link", link);
    }
    return `https:/\/gateway.ipfs.io/ipfs/${link}`;
}
function numPad(value) {
    const result = arrayify(value);
    if (result.length > 32) {
        throw new Error("internal; should not happen");
    }
    const padded = new Uint8Array(32);
    padded.set(result, 32 - result.length);
    return padded;
}
function bytesPad(value) {
    if ((value.length % 32) === 0) {
        return value;
    }
    const result = new Uint8Array(Math.ceil(value.length / 32) * 32);
    result.set(value);
    return result;
}
// ABI Encodes a series of (bytes, bytes, ...)
function encodeBytes(datas) {
    const result = [];
    let byteCount = 0;
    // Add place-holders for pointers as we add items
    for (let i = 0; i < datas.length; i++) {
        result.push(null);
        byteCount += 32;
    }
    for (let i = 0; i < datas.length; i++) {
        const data = arrayify(datas[i]);
        // Update the bytes offset
        result[i] = numPad(byteCount);
        // The length and padded value of data
        result.push(numPad(data.length));
        result.push(bytesPad(data));
        byteCount += 32 + Math.ceil(data.length / 32) * 32;
    }
    return hexConcat(result);
}
class Resolver {
    // The resolvedAddress is only for creating a ReverseLookup resolver
    constructor(provider, address, name, resolvedAddress) {
        defineReadOnly$1(this, "provider", provider);
        defineReadOnly$1(this, "name", name);
        defineReadOnly$1(this, "address", provider.formatter.address(address));
        defineReadOnly$1(this, "_resolvedAddress", resolvedAddress);
    }
    supportsWildcard() {
        if (!this._supportsEip2544) {
            // supportsInterface(bytes4 = selector("resolve(bytes,bytes)"))
            this._supportsEip2544 = this.provider.call({
                to: this.address,
                data: "0x01ffc9a79061b92300000000000000000000000000000000000000000000000000000000"
            }).then((result) => {
                return BigNumber.from(result).eq(1);
            }).catch((error) => {
                if (error.code === Logger$2.errors.CALL_EXCEPTION) {
                    return false;
                }
                // Rethrow the error: link is down, etc. Let future attempts retry.
                this._supportsEip2544 = null;
                throw error;
            });
        }
        return this._supportsEip2544;
    }
    _fetch(selector, parameters) {
        return __awaiter$2(this, void 0, void 0, function* () {
            // e.g. keccak256("addr(bytes32,uint256)")
            const tx = {
                to: this.address,
                ccipReadEnabled: true,
                data: hexConcat([selector, namehash(this.name), (parameters || "0x")])
            };
            // Wildcard support; use EIP-2544 to resolve the request
            let parseBytes = false;
            if (yield this.supportsWildcard()) {
                parseBytes = true;
                // selector("resolve(bytes,bytes)")
                tx.data = hexConcat(["0x9061b923", encodeBytes([dnsEncode(this.name), tx.data])]);
            }
            try {
                let result = yield this.provider.call(tx);
                if ((arrayify(result).length % 32) === 4) {
                    logger$3.throwError("resolver threw error", Logger$2.errors.CALL_EXCEPTION, {
                        transaction: tx, data: result
                    });
                }
                if (parseBytes) {
                    result = _parseBytes(result, 0);
                }
                return result;
            }
            catch (error) {
                if (error.code === Logger$2.errors.CALL_EXCEPTION) {
                    return null;
                }
                throw error;
            }
        });
    }
    _fetchBytes(selector, parameters) {
        return __awaiter$2(this, void 0, void 0, function* () {
            const result = yield this._fetch(selector, parameters);
            if (result != null) {
                return _parseBytes(result, 0);
            }
            return null;
        });
    }
    _getAddress(coinType, hexBytes) {
        const coinInfo = coinInfos[String(coinType)];
        if (coinInfo == null) {
            logger$3.throwError(`unsupported coin type: ${coinType}`, Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: `getAddress(${coinType})`
            });
        }
        if (coinInfo.ilk === "eth") {
            return this.provider.formatter.address(hexBytes);
        }
        const bytes = arrayify(hexBytes);
        // P2PKH: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        if (coinInfo.p2pkh != null) {
            const p2pkh = hexBytes.match(/^0x76a9([0-9a-f][0-9a-f])([0-9a-f]*)88ac$/);
            if (p2pkh) {
                const length = parseInt(p2pkh[1], 16);
                if (p2pkh[2].length === length * 2 && length >= 1 && length <= 75) {
                    return base58Encode(concat([[coinInfo.p2pkh], ("0x" + p2pkh[2])]));
                }
            }
        }
        // P2SH: OP_HASH160 <scriptHash> OP_EQUAL
        if (coinInfo.p2sh != null) {
            const p2sh = hexBytes.match(/^0xa9([0-9a-f][0-9a-f])([0-9a-f]*)87$/);
            if (p2sh) {
                const length = parseInt(p2sh[1], 16);
                if (p2sh[2].length === length * 2 && length >= 1 && length <= 75) {
                    return base58Encode(concat([[coinInfo.p2sh], ("0x" + p2sh[2])]));
                }
            }
        }
        // Bech32
        if (coinInfo.prefix != null) {
            const length = bytes[1];
            // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#witness-program
            let version = bytes[0];
            if (version === 0x00) {
                if (length !== 20 && length !== 32) {
                    version = -1;
                }
            }
            else {
                version = -1;
            }
            if (version >= 0 && bytes.length === 2 + length && length >= 1 && length <= 75) {
                const words = bech32.toWords(bytes.slice(2));
                words.unshift(version);
                return bech32.encode(coinInfo.prefix, words);
            }
        }
        return null;
    }
    getAddress(coinType) {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (coinType == null) {
                coinType = 60;
            }
            // If Ethereum, use the standard `addr(bytes32)`
            if (coinType === 60) {
                try {
                    // keccak256("addr(bytes32)")
                    const result = yield this._fetch("0x3b3b57de");
                    // No address
                    if (result === "0x" || result === HashZero) {
                        return null;
                    }
                    return this.provider.formatter.callAddress(result);
                }
                catch (error) {
                    if (error.code === Logger$2.errors.CALL_EXCEPTION) {
                        return null;
                    }
                    throw error;
                }
            }
            // keccak256("addr(bytes32,uint256")
            const hexBytes = yield this._fetchBytes("0xf1cb7e06", bytes32ify(coinType));
            // No address
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            // Compute the address
            const address = this._getAddress(coinType, hexBytes);
            if (address == null) {
                logger$3.throwError(`invalid or unsupported coin data`, Logger$2.errors.UNSUPPORTED_OPERATION, {
                    operation: `getAddress(${coinType})`,
                    coinType: coinType,
                    data: hexBytes
                });
            }
            return address;
        });
    }
    getAvatar() {
        return __awaiter$2(this, void 0, void 0, function* () {
            const linkage = [{ type: "name", content: this.name }];
            try {
                // test data for ricmoo.eth
                //const avatar = "eip155:1/erc721:0x265385c7f4132228A0d54EB1A9e7460b91c0cC68/29233";
                const avatar = yield this.getText("avatar");
                if (avatar == null) {
                    return null;
                }
                for (let i = 0; i < matchers.length; i++) {
                    const match = avatar.match(matchers[i]);
                    if (match == null) {
                        continue;
                    }
                    const scheme = match[1].toLowerCase();
                    switch (scheme) {
                        case "https":
                            linkage.push({ type: "url", content: avatar });
                            return { linkage, url: avatar };
                        case "data":
                            linkage.push({ type: "data", content: avatar });
                            return { linkage, url: avatar };
                        case "ipfs":
                            linkage.push({ type: "ipfs", content: avatar });
                            return { linkage, url: getIpfsLink(avatar) };
                        case "erc721":
                        case "erc1155": {
                            // Depending on the ERC type, use tokenURI(uint256) or url(uint256)
                            const selector = (scheme === "erc721") ? "0xc87b56dd" : "0x0e89341c";
                            linkage.push({ type: scheme, content: avatar });
                            // The owner of this name
                            const owner = (this._resolvedAddress || (yield this.getAddress()));
                            const comps = (match[2] || "").split("/");
                            if (comps.length !== 2) {
                                return null;
                            }
                            const addr = yield this.provider.formatter.address(comps[0]);
                            const tokenId = hexZeroPad(BigNumber.from(comps[1]).toHexString(), 32);
                            // Check that this account owns the token
                            if (scheme === "erc721") {
                                // ownerOf(uint256 tokenId)
                                const tokenOwner = this.provider.formatter.callAddress(yield this.provider.call({
                                    to: addr, data: hexConcat(["0x6352211e", tokenId])
                                }));
                                if (owner !== tokenOwner) {
                                    return null;
                                }
                                linkage.push({ type: "owner", content: tokenOwner });
                            }
                            else if (scheme === "erc1155") {
                                // balanceOf(address owner, uint256 tokenId)
                                const balance = BigNumber.from(yield this.provider.call({
                                    to: addr, data: hexConcat(["0x00fdd58e", hexZeroPad(owner, 32), tokenId])
                                }));
                                if (balance.isZero()) {
                                    return null;
                                }
                                linkage.push({ type: "balance", content: balance.toString() });
                            }
                            // Call the token contract for the metadata URL
                            const tx = {
                                to: this.provider.formatter.address(comps[0]),
                                data: hexConcat([selector, tokenId])
                            };
                            let metadataUrl = _parseString(yield this.provider.call(tx), 0);
                            if (metadataUrl == null) {
                                return null;
                            }
                            linkage.push({ type: "metadata-url-base", content: metadataUrl });
                            // ERC-1155 allows a generic {id} in the URL
                            if (scheme === "erc1155") {
                                metadataUrl = metadataUrl.replace("{id}", tokenId.substring(2));
                                linkage.push({ type: "metadata-url-expanded", content: metadataUrl });
                            }
                            // Transform IPFS metadata links
                            if (metadataUrl.match(/^ipfs:/i)) {
                                metadataUrl = getIpfsLink(metadataUrl);
                            }
                            linkage.push({ type: "metadata-url", content: metadataUrl });
                            // Get the token metadata
                            const metadata = yield fetchJson(metadataUrl);
                            if (!metadata) {
                                return null;
                            }
                            linkage.push({ type: "metadata", content: JSON.stringify(metadata) });
                            // Pull the image URL out
                            let imageUrl = metadata.image;
                            if (typeof (imageUrl) !== "string") {
                                return null;
                            }
                            if (imageUrl.match(/^(https:\/\/|data:)/i)) {
                                // Allow
                            }
                            else {
                                // Transform IPFS link to gateway
                                const ipfs = imageUrl.match(matcherIpfs);
                                if (ipfs == null) {
                                    return null;
                                }
                                linkage.push({ type: "url-ipfs", content: imageUrl });
                                imageUrl = getIpfsLink(imageUrl);
                            }
                            linkage.push({ type: "url", content: imageUrl });
                            return { linkage, url: imageUrl };
                        }
                    }
                }
            }
            catch (error) { }
            return null;
        });
    }
    getContentHash() {
        return __awaiter$2(this, void 0, void 0, function* () {
            // keccak256("contenthash()")
            const hexBytes = yield this._fetchBytes("0xbc1c58d1");
            // No contenthash
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            // IPFS (CID: 1, Type: DAG-PB)
            const ipfs = hexBytes.match(/^0xe3010170(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
            if (ipfs) {
                const length = parseInt(ipfs[3], 16);
                if (ipfs[4].length === length * 2) {
                    return "ipfs:/\/" + Base58.encode("0x" + ipfs[1]);
                }
            }
            // IPNS (CID: 1, Type: libp2p-key)
            const ipns = hexBytes.match(/^0xe5010172(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
            if (ipns) {
                const length = parseInt(ipns[3], 16);
                if (ipns[4].length === length * 2) {
                    return "ipns:/\/" + Base58.encode("0x" + ipns[1]);
                }
            }
            // Swarm (CID: 1, Type: swarm-manifest; hash/length hard-coded to keccak256/32)
            const swarm = hexBytes.match(/^0xe40101fa011b20([0-9a-f]*)$/);
            if (swarm) {
                if (swarm[1].length === (32 * 2)) {
                    return "bzz:/\/" + swarm[1];
                }
            }
            const skynet = hexBytes.match(/^0x90b2c605([0-9a-f]*)$/);
            if (skynet) {
                if (skynet[1].length === (34 * 2)) {
                    // URL Safe base64; https://datatracker.ietf.org/doc/html/rfc4648#section-5
                    const urlSafe = { "=": "", "+": "-", "/": "_" };
                    const hash = encode$1("0x" + skynet[1]).replace(/[=+\/]/g, (a) => (urlSafe[a]));
                    return "sia:/\/" + hash;
                }
            }
            return logger$3.throwError(`invalid or unsupported content hash data`, Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "getContentHash()",
                data: hexBytes
            });
        });
    }
    getText(key) {
        return __awaiter$2(this, void 0, void 0, function* () {
            // The key encoded as parameter to fetchBytes
            let keyBytes = toUtf8Bytes(key);
            // The nodehash consumes the first slot, so the string pointer targets
            // offset 64, with the length at offset 64 and data starting at offset 96
            keyBytes = concat([bytes32ify(64), bytes32ify(keyBytes.length), keyBytes]);
            // Pad to word-size (32 bytes)
            if ((keyBytes.length % 32) !== 0) {
                keyBytes = concat([keyBytes, hexZeroPad("0x", 32 - (key.length % 32))]);
            }
            const hexBytes = yield this._fetchBytes("0x59d1d43c", hexlify(keyBytes));
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            return toUtf8String(hexBytes);
        });
    }
}
let defaultFormatter = null;
let nextPollId = 1;
class BaseProvider extends Provider {
    /**
     *  ready
     *
     *  A Promise<Network> that resolves only once the provider is ready.
     *
     *  Sub-classes that call the super with a network without a chainId
     *  MUST set this. Standard named networks have a known chainId.
     *
     */
    constructor(network) {
        super();
        // Events being listened to
        this._events = [];
        this._emitted = { block: -2 };
        this.disableCcipRead = false;
        this.formatter = new.target.getFormatter();
        // If network is any, this Provider allows the underlying
        // network to change dynamically, and we auto-detect the
        // current network
        defineReadOnly$1(this, "anyNetwork", (network === "any"));
        if (this.anyNetwork) {
            network = this.detectNetwork();
        }
        if (network instanceof Promise) {
            this._networkPromise = network;
            // Squash any "unhandled promise" errors; that do not need to be handled
            network.catch((error) => { });
            // Trigger initial network setting (async)
            this._ready().catch((error) => { });
        }
        else {
            const knownNetwork = getStatic(new.target, "getNetwork")(network);
            if (knownNetwork) {
                defineReadOnly$1(this, "_network", knownNetwork);
                this.emit("network", knownNetwork, null);
            }
            else {
                logger$3.throwArgumentError("invalid network", "network", network);
            }
        }
        this._maxInternalBlockNumber = -1024;
        this._lastBlockNumber = -2;
        this._maxFilterBlockRange = 10;
        this._pollingInterval = 4000;
        this._fastQueryDate = 0;
    }
    _ready() {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (this._network == null) {
                let network = null;
                if (this._networkPromise) {
                    try {
                        network = yield this._networkPromise;
                    }
                    catch (error) { }
                }
                // Try the Provider's network detection (this MUST throw if it cannot)
                if (network == null) {
                    network = yield this.detectNetwork();
                }
                // This should never happen; every Provider sub-class should have
                // suggested a network by here (or have thrown).
                if (!network) {
                    logger$3.throwError("no network detected", Logger$2.errors.UNKNOWN_ERROR, {});
                }
                // Possible this call stacked so do not call defineReadOnly again
                if (this._network == null) {
                    if (this.anyNetwork) {
                        this._network = network;
                    }
                    else {
                        defineReadOnly$1(this, "_network", network);
                    }
                    this.emit("network", network, null);
                }
            }
            return this._network;
        });
    }
    // This will always return the most recently established network.
    // For "any", this can change (a "network" event is emitted before
    // any change is reflected); otherwise this cannot change
    get ready() {
        return poll(() => {
            return this._ready().then((network) => {
                return network;
            }, (error) => {
                // If the network isn't running yet, we will wait
                if (error.code === Logger$2.errors.NETWORK_ERROR && error.event === "noNetwork") {
                    return undefined;
                }
                throw error;
            });
        });
    }
    // @TODO: Remove this and just create a singleton formatter
    static getFormatter() {
        if (defaultFormatter == null) {
            defaultFormatter = new Formatter();
        }
        return defaultFormatter;
    }
    // @TODO: Remove this and just use getNetwork
    static getNetwork(network) {
        return getNetwork((network == null) ? "homestead" : network);
    }
    ccipReadFetch(tx, calldata, urls) {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (this.disableCcipRead || urls.length === 0) {
                return null;
            }
            const sender = tx.to.toLowerCase();
            const data = calldata.toLowerCase();
            const errorMessages = [];
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                // URL expansion
                const href = url.replace("{sender}", sender).replace("{data}", data);
                // If no {data} is present, use POST; otherwise GET
                const json = (url.indexOf("{data}") >= 0) ? null : JSON.stringify({ data, sender });
                const result = yield fetchJson({ url: href, errorPassThrough: true }, json, (value, response) => {
                    value.status = response.statusCode;
                    return value;
                });
                if (result.data) {
                    return result.data;
                }
                const errorMessage = (result.message || "unknown error");
                // 4xx indicates the result is not present; stop
                if (result.status >= 400 && result.status < 500) {
                    return logger$3.throwError(`response not found during CCIP fetch: ${errorMessage}`, Logger$2.errors.SERVER_ERROR, { url, errorMessage });
                }
                // 5xx indicates server issue; try the next url
                errorMessages.push(errorMessage);
            }
            return logger$3.throwError(`error encountered during CCIP fetch: ${errorMessages.map((m) => JSON.stringify(m)).join(", ")}`, Logger$2.errors.SERVER_ERROR, {
                urls, errorMessages
            });
        });
    }
    // Fetches the blockNumber, but will reuse any result that is less
    // than maxAge old or has been requested since the last request
    _getInternalBlockNumber(maxAge) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this._ready();
            // Allowing stale data up to maxAge old
            if (maxAge > 0) {
                // While there are pending internal block requests...
                while (this._internalBlockNumber) {
                    // ..."remember" which fetch we started with
                    const internalBlockNumber = this._internalBlockNumber;
                    try {
                        // Check the result is not too stale
                        const result = yield internalBlockNumber;
                        if ((getTime() - result.respTime) <= maxAge) {
                            return result.blockNumber;
                        }
                        // Too old; fetch a new value
                        break;
                    }
                    catch (error) {
                        // The fetch rejected; if we are the first to get the
                        // rejection, drop through so we replace it with a new
                        // fetch; all others blocked will then get that fetch
                        // which won't match the one they "remembered" and loop
                        if (this._internalBlockNumber === internalBlockNumber) {
                            break;
                        }
                    }
                }
            }
            const reqTime = getTime();
            const checkInternalBlockNumber = resolveProperties({
                blockNumber: this.perform("getBlockNumber", {}),
                networkError: this.getNetwork().then((network) => (null), (error) => (error))
            }).then(({ blockNumber, networkError }) => {
                if (networkError) {
                    // Unremember this bad internal block number
                    if (this._internalBlockNumber === checkInternalBlockNumber) {
                        this._internalBlockNumber = null;
                    }
                    throw networkError;
                }
                const respTime = getTime();
                blockNumber = BigNumber.from(blockNumber).toNumber();
                if (blockNumber < this._maxInternalBlockNumber) {
                    blockNumber = this._maxInternalBlockNumber;
                }
                this._maxInternalBlockNumber = blockNumber;
                this._setFastBlockNumber(blockNumber); // @TODO: Still need this?
                return { blockNumber, reqTime, respTime };
            });
            this._internalBlockNumber = checkInternalBlockNumber;
            // Swallow unhandled exceptions; if needed they are handled else where
            checkInternalBlockNumber.catch((error) => {
                // Don't null the dead (rejected) fetch, if it has already been updated
                if (this._internalBlockNumber === checkInternalBlockNumber) {
                    this._internalBlockNumber = null;
                }
            });
            return (yield checkInternalBlockNumber).blockNumber;
        });
    }
    poll() {
        return __awaiter$2(this, void 0, void 0, function* () {
            const pollId = nextPollId++;
            // Track all running promises, so we can trigger a post-poll once they are complete
            const runners = [];
            let blockNumber = null;
            try {
                blockNumber = yield this._getInternalBlockNumber(100 + this.pollingInterval / 2);
            }
            catch (error) {
                this.emit("error", error);
                return;
            }
            this._setFastBlockNumber(blockNumber);
            // Emit a poll event after we have the latest (fast) block number
            this.emit("poll", pollId, blockNumber);
            // If the block has not changed, meh.
            if (blockNumber === this._lastBlockNumber) {
                this.emit("didPoll", pollId);
                return;
            }
            // First polling cycle, trigger a "block" events
            if (this._emitted.block === -2) {
                this._emitted.block = blockNumber - 1;
            }
            if (Math.abs((this._emitted.block) - blockNumber) > 1000) {
                logger$3.warn(`network block skew detected; skipping block events (emitted=${this._emitted.block} blockNumber${blockNumber})`);
                this.emit("error", logger$3.makeError("network block skew detected", Logger$2.errors.NETWORK_ERROR, {
                    blockNumber: blockNumber,
                    event: "blockSkew",
                    previousBlockNumber: this._emitted.block
                }));
                this.emit("block", blockNumber);
            }
            else {
                // Notify all listener for each block that has passed
                for (let i = this._emitted.block + 1; i <= blockNumber; i++) {
                    this.emit("block", i);
                }
            }
            // The emitted block was updated, check for obsolete events
            if (this._emitted.block !== blockNumber) {
                this._emitted.block = blockNumber;
                Object.keys(this._emitted).forEach((key) => {
                    // The block event does not expire
                    if (key === "block") {
                        return;
                    }
                    // The block we were at when we emitted this event
                    const eventBlockNumber = this._emitted[key];
                    // We cannot garbage collect pending transactions or blocks here
                    // They should be garbage collected by the Provider when setting
                    // "pending" events
                    if (eventBlockNumber === "pending") {
                        return;
                    }
                    // Evict any transaction hashes or block hashes over 12 blocks
                    // old, since they should not return null anyways
                    if (blockNumber - eventBlockNumber > 12) {
                        delete this._emitted[key];
                    }
                });
            }
            // First polling cycle
            if (this._lastBlockNumber === -2) {
                this._lastBlockNumber = blockNumber - 1;
            }
            // Find all transaction hashes we are waiting on
            this._events.forEach((event) => {
                switch (event.type) {
                    case "tx": {
                        const hash = event.hash;
                        let runner = this.getTransactionReceipt(hash).then((receipt) => {
                            if (!receipt || receipt.blockNumber == null) {
                                return null;
                            }
                            this._emitted["t:" + hash] = receipt.blockNumber;
                            this.emit(hash, receipt);
                            return null;
                        }).catch((error) => { this.emit("error", error); });
                        runners.push(runner);
                        break;
                    }
                    case "filter": {
                        // We only allow a single getLogs to be in-flight at a time
                        if (!event._inflight) {
                            event._inflight = true;
                            // This is the first filter for this event, so we want to
                            // restrict events to events that happened no earlier than now
                            if (event._lastBlockNumber === -2) {
                                event._lastBlockNumber = blockNumber - 1;
                            }
                            // Filter from the last *known* event; due to load-balancing
                            // and some nodes returning updated block numbers before
                            // indexing events, a logs result with 0 entries cannot be
                            // trusted and we must retry a range which includes it again
                            const filter = event.filter;
                            filter.fromBlock = event._lastBlockNumber + 1;
                            filter.toBlock = blockNumber;
                            // Prevent fitler ranges from growing too wild, since it is quite
                            // likely there just haven't been any events to move the lastBlockNumber.
                            const minFromBlock = filter.toBlock - this._maxFilterBlockRange;
                            if (minFromBlock > filter.fromBlock) {
                                filter.fromBlock = minFromBlock;
                            }
                            if (filter.fromBlock < 0) {
                                filter.fromBlock = 0;
                            }
                            const runner = this.getLogs(filter).then((logs) => {
                                // Allow the next getLogs
                                event._inflight = false;
                                if (logs.length === 0) {
                                    return;
                                }
                                logs.forEach((log) => {
                                    // Only when we get an event for a given block number
                                    // can we trust the events are indexed
                                    if (log.blockNumber > event._lastBlockNumber) {
                                        event._lastBlockNumber = log.blockNumber;
                                    }
                                    // Make sure we stall requests to fetch blocks and txs
                                    this._emitted["b:" + log.blockHash] = log.blockNumber;
                                    this._emitted["t:" + log.transactionHash] = log.blockNumber;
                                    this.emit(filter, log);
                                });
                            }).catch((error) => {
                                this.emit("error", error);
                                // Allow another getLogs (the range was not updated)
                                event._inflight = false;
                            });
                            runners.push(runner);
                        }
                        break;
                    }
                }
            });
            this._lastBlockNumber = blockNumber;
            // Once all events for this loop have been processed, emit "didPoll"
            Promise.all(runners).then(() => {
                this.emit("didPoll", pollId);
            }).catch((error) => { this.emit("error", error); });
            return;
        });
    }
    // Deprecated; do not use this
    resetEventsBlock(blockNumber) {
        this._lastBlockNumber = blockNumber - 1;
        if (this.polling) {
            this.poll();
        }
    }
    get network() {
        return this._network;
    }
    // This method should query the network if the underlying network
    // can change, such as when connected to a JSON-RPC backend
    detectNetwork() {
        return __awaiter$2(this, void 0, void 0, function* () {
            return logger$3.throwError("provider does not support network detection", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "provider.detectNetwork"
            });
        });
    }
    getNetwork() {
        return __awaiter$2(this, void 0, void 0, function* () {
            const network = yield this._ready();
            // Make sure we are still connected to the same network; this is
            // only an external call for backends which can have the underlying
            // network change spontaneously
            const currentNetwork = yield this.detectNetwork();
            if (network.chainId !== currentNetwork.chainId) {
                // We are allowing network changes, things can get complex fast;
                // make sure you know what you are doing if you use "any"
                if (this.anyNetwork) {
                    this._network = currentNetwork;
                    // Reset all internal block number guards and caches
                    this._lastBlockNumber = -2;
                    this._fastBlockNumber = null;
                    this._fastBlockNumberPromise = null;
                    this._fastQueryDate = 0;
                    this._emitted.block = -2;
                    this._maxInternalBlockNumber = -1024;
                    this._internalBlockNumber = null;
                    // The "network" event MUST happen before this method resolves
                    // so any events have a chance to unregister, so we stall an
                    // additional event loop before returning from /this/ call
                    this.emit("network", currentNetwork, network);
                    yield stall(0);
                    return this._network;
                }
                const error = logger$3.makeError("underlying network changed", Logger$2.errors.NETWORK_ERROR, {
                    event: "changed",
                    network: network,
                    detectedNetwork: currentNetwork
                });
                this.emit("error", error);
                throw error;
            }
            return network;
        });
    }
    get blockNumber() {
        this._getInternalBlockNumber(100 + this.pollingInterval / 2).then((blockNumber) => {
            this._setFastBlockNumber(blockNumber);
        }, (error) => { });
        return (this._fastBlockNumber != null) ? this._fastBlockNumber : -1;
    }
    get polling() {
        return (this._poller != null);
    }
    set polling(value) {
        if (value && !this._poller) {
            this._poller = setInterval(() => { this.poll(); }, this.pollingInterval);
            if (!this._bootstrapPoll) {
                this._bootstrapPoll = setTimeout(() => {
                    this.poll();
                    // We block additional polls until the polling interval
                    // is done, to prevent overwhelming the poll function
                    this._bootstrapPoll = setTimeout(() => {
                        // If polling was disabled, something may require a poke
                        // since starting the bootstrap poll and it was disabled
                        if (!this._poller) {
                            this.poll();
                        }
                        // Clear out the bootstrap so we can do another
                        this._bootstrapPoll = null;
                    }, this.pollingInterval);
                }, 0);
            }
        }
        else if (!value && this._poller) {
            clearInterval(this._poller);
            this._poller = null;
        }
    }
    get pollingInterval() {
        return this._pollingInterval;
    }
    set pollingInterval(value) {
        if (typeof (value) !== "number" || value <= 0 || parseInt(String(value)) != value) {
            throw new Error("invalid polling interval");
        }
        this._pollingInterval = value;
        if (this._poller) {
            clearInterval(this._poller);
            this._poller = setInterval(() => { this.poll(); }, this._pollingInterval);
        }
    }
    _getFastBlockNumber() {
        const now = getTime();
        // Stale block number, request a newer value
        if ((now - this._fastQueryDate) > 2 * this._pollingInterval) {
            this._fastQueryDate = now;
            this._fastBlockNumberPromise = this.getBlockNumber().then((blockNumber) => {
                if (this._fastBlockNumber == null || blockNumber > this._fastBlockNumber) {
                    this._fastBlockNumber = blockNumber;
                }
                return this._fastBlockNumber;
            });
        }
        return this._fastBlockNumberPromise;
    }
    _setFastBlockNumber(blockNumber) {
        // Older block, maybe a stale request
        if (this._fastBlockNumber != null && blockNumber < this._fastBlockNumber) {
            return;
        }
        // Update the time we updated the blocknumber
        this._fastQueryDate = getTime();
        // Newer block number, use  it
        if (this._fastBlockNumber == null || blockNumber > this._fastBlockNumber) {
            this._fastBlockNumber = blockNumber;
            this._fastBlockNumberPromise = Promise.resolve(blockNumber);
        }
    }
    waitForTransaction(transactionHash, confirmations, timeout) {
        return __awaiter$2(this, void 0, void 0, function* () {
            return this._waitForTransaction(transactionHash, (confirmations == null) ? 1 : confirmations, timeout || 0, null);
        });
    }
    _waitForTransaction(transactionHash, confirmations, timeout, replaceable) {
        return __awaiter$2(this, void 0, void 0, function* () {
            const receipt = yield this.getTransactionReceipt(transactionHash);
            // Receipt is already good
            if ((receipt ? receipt.confirmations : 0) >= confirmations) {
                return receipt;
            }
            // Poll until the receipt is good...
            return new Promise((resolve, reject) => {
                const cancelFuncs = [];
                let done = false;
                const alreadyDone = function () {
                    if (done) {
                        return true;
                    }
                    done = true;
                    cancelFuncs.forEach((func) => { func(); });
                    return false;
                };
                const minedHandler = (receipt) => {
                    if (receipt.confirmations < confirmations) {
                        return;
                    }
                    if (alreadyDone()) {
                        return;
                    }
                    resolve(receipt);
                };
                this.on(transactionHash, minedHandler);
                cancelFuncs.push(() => { this.removeListener(transactionHash, minedHandler); });
                if (replaceable) {
                    let lastBlockNumber = replaceable.startBlock;
                    let scannedBlock = null;
                    const replaceHandler = (blockNumber) => __awaiter$2(this, void 0, void 0, function* () {
                        if (done) {
                            return;
                        }
                        // Wait 1 second; this is only used in the case of a fault, so
                        // we will trade off a little bit of latency for more consistent
                        // results and fewer JSON-RPC calls
                        yield stall(1000);
                        this.getTransactionCount(replaceable.from).then((nonce) => __awaiter$2(this, void 0, void 0, function* () {
                            if (done) {
                                return;
                            }
                            if (nonce <= replaceable.nonce) {
                                lastBlockNumber = blockNumber;
                            }
                            else {
                                // First check if the transaction was mined
                                {
                                    const mined = yield this.getTransaction(transactionHash);
                                    if (mined && mined.blockNumber != null) {
                                        return;
                                    }
                                }
                                // First time scanning. We start a little earlier for some
                                // wiggle room here to handle the eventually consistent nature
                                // of blockchain (e.g. the getTransactionCount was for a
                                // different block)
                                if (scannedBlock == null) {
                                    scannedBlock = lastBlockNumber - 3;
                                    if (scannedBlock < replaceable.startBlock) {
                                        scannedBlock = replaceable.startBlock;
                                    }
                                }
                                while (scannedBlock <= blockNumber) {
                                    if (done) {
                                        return;
                                    }
                                    const block = yield this.getBlockWithTransactions(scannedBlock);
                                    for (let ti = 0; ti < block.transactions.length; ti++) {
                                        const tx = block.transactions[ti];
                                        // Successfully mined!
                                        if (tx.hash === transactionHash) {
                                            return;
                                        }
                                        // Matches our transaction from and nonce; its a replacement
                                        if (tx.from === replaceable.from && tx.nonce === replaceable.nonce) {
                                            if (done) {
                                                return;
                                            }
                                            // Get the receipt of the replacement
                                            const receipt = yield this.waitForTransaction(tx.hash, confirmations);
                                            // Already resolved or rejected (prolly a timeout)
                                            if (alreadyDone()) {
                                                return;
                                            }
                                            // The reason we were replaced
                                            let reason = "replaced";
                                            if (tx.data === replaceable.data && tx.to === replaceable.to && tx.value.eq(replaceable.value)) {
                                                reason = "repriced";
                                            }
                                            else if (tx.data === "0x" && tx.from === tx.to && tx.value.isZero()) {
                                                reason = "cancelled";
                                            }
                                            // Explain why we were replaced
                                            reject(logger$3.makeError("transaction was replaced", Logger$2.errors.TRANSACTION_REPLACED, {
                                                cancelled: (reason === "replaced" || reason === "cancelled"),
                                                reason,
                                                replacement: this._wrapTransaction(tx),
                                                hash: transactionHash,
                                                receipt
                                            }));
                                            return;
                                        }
                                    }
                                    scannedBlock++;
                                }
                            }
                            if (done) {
                                return;
                            }
                            this.once("block", replaceHandler);
                        }), (error) => {
                            if (done) {
                                return;
                            }
                            this.once("block", replaceHandler);
                        });
                    });
                    if (done) {
                        return;
                    }
                    this.once("block", replaceHandler);
                    cancelFuncs.push(() => {
                        this.removeListener("block", replaceHandler);
                    });
                }
                if (typeof (timeout) === "number" && timeout > 0) {
                    const timer = setTimeout(() => {
                        if (alreadyDone()) {
                            return;
                        }
                        reject(logger$3.makeError("timeout exceeded", Logger$2.errors.TIMEOUT, { timeout: timeout }));
                    }, timeout);
                    if (timer.unref) {
                        timer.unref();
                    }
                    cancelFuncs.push(() => { clearTimeout(timer); });
                }
            });
        });
    }
    getBlockNumber() {
        return __awaiter$2(this, void 0, void 0, function* () {
            return this._getInternalBlockNumber(0);
        });
    }
    getGasPrice() {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const result = yield this.perform("getGasPrice", {});
            try {
                return BigNumber.from(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "getGasPrice",
                    result, error
                });
            }
        });
    }
    getBalance(addressOrName, blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                address: this._getAddress(addressOrName),
                blockTag: this._getBlockTag(blockTag)
            });
            const result = yield this.perform("getBalance", params);
            try {
                return BigNumber.from(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "getBalance",
                    params, result, error
                });
            }
        });
    }
    getTransactionCount(addressOrName, blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                address: this._getAddress(addressOrName),
                blockTag: this._getBlockTag(blockTag)
            });
            const result = yield this.perform("getTransactionCount", params);
            try {
                return BigNumber.from(result).toNumber();
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "getTransactionCount",
                    params, result, error
                });
            }
        });
    }
    getCode(addressOrName, blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                address: this._getAddress(addressOrName),
                blockTag: this._getBlockTag(blockTag)
            });
            const result = yield this.perform("getCode", params);
            try {
                return hexlify(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "getCode",
                    params, result, error
                });
            }
        });
    }
    getStorageAt(addressOrName, position, blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                address: this._getAddress(addressOrName),
                blockTag: this._getBlockTag(blockTag),
                position: Promise.resolve(position).then((p) => hexValue(p))
            });
            const result = yield this.perform("getStorageAt", params);
            try {
                return hexlify(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "getStorageAt",
                    params, result, error
                });
            }
        });
    }
    // This should be called by any subclass wrapping a TransactionResponse
    _wrapTransaction(tx, hash, startBlock) {
        if (hash != null && hexDataLength(hash) !== 32) {
            throw new Error("invalid response - sendTransaction");
        }
        const result = tx;
        // Check the hash we expect is the same as the hash the server reported
        if (hash != null && tx.hash !== hash) {
            logger$3.throwError("Transaction hash mismatch from Provider.sendTransaction.", Logger$2.errors.UNKNOWN_ERROR, { expectedHash: tx.hash, returnedHash: hash });
        }
        result.wait = (confirms, timeout) => __awaiter$2(this, void 0, void 0, function* () {
            if (confirms == null) {
                confirms = 1;
            }
            if (timeout == null) {
                timeout = 0;
            }
            // Get the details to detect replacement
            let replacement = undefined;
            if (confirms !== 0 && startBlock != null) {
                replacement = {
                    data: tx.data,
                    from: tx.from,
                    nonce: tx.nonce,
                    to: tx.to,
                    value: tx.value,
                    startBlock
                };
            }
            const receipt = yield this._waitForTransaction(tx.hash, confirms, timeout, replacement);
            if (receipt == null && confirms === 0) {
                return null;
            }
            // No longer pending, allow the polling loop to garbage collect this
            this._emitted["t:" + tx.hash] = receipt.blockNumber;
            if (receipt.status === 0) {
                logger$3.throwError("transaction failed", Logger$2.errors.CALL_EXCEPTION, {
                    transactionHash: tx.hash,
                    transaction: tx,
                    receipt: receipt
                });
            }
            return receipt;
        });
        return result;
    }
    sendTransaction(signedTransaction) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const hexTx = yield Promise.resolve(signedTransaction).then(t => hexlify(t));
            const tx = this.formatter.transaction(signedTransaction);
            if (tx.confirmations == null) {
                tx.confirmations = 0;
            }
            const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
            try {
                const hash = yield this.perform("sendTransaction", { signedTransaction: hexTx });
                return this._wrapTransaction(tx, hash, blockNumber);
            }
            catch (error) {
                error.transaction = tx;
                error.transactionHash = tx.hash;
                throw error;
            }
        });
    }
    _getTransactionRequest(transaction) {
        return __awaiter$2(this, void 0, void 0, function* () {
            const values = yield transaction;
            const tx = {};
            ["from", "to"].forEach((key) => {
                if (values[key] == null) {
                    return;
                }
                tx[key] = Promise.resolve(values[key]).then((v) => (v ? this._getAddress(v) : null));
            });
            ["gasLimit", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "value"].forEach((key) => {
                if (values[key] == null) {
                    return;
                }
                tx[key] = Promise.resolve(values[key]).then((v) => (v ? BigNumber.from(v) : null));
            });
            ["type"].forEach((key) => {
                if (values[key] == null) {
                    return;
                }
                tx[key] = Promise.resolve(values[key]).then((v) => ((v != null) ? v : null));
            });
            if (values.accessList) {
                tx.accessList = this.formatter.accessList(values.accessList);
            }
            ["data"].forEach((key) => {
                if (values[key] == null) {
                    return;
                }
                tx[key] = Promise.resolve(values[key]).then((v) => (v ? hexlify(v) : null));
            });
            return this.formatter.transactionRequest(yield resolveProperties(tx));
        });
    }
    _getFilter(filter) {
        return __awaiter$2(this, void 0, void 0, function* () {
            filter = yield filter;
            const result = {};
            if (filter.address != null) {
                result.address = this._getAddress(filter.address);
            }
            ["blockHash", "topics"].forEach((key) => {
                if (filter[key] == null) {
                    return;
                }
                result[key] = filter[key];
            });
            ["fromBlock", "toBlock"].forEach((key) => {
                if (filter[key] == null) {
                    return;
                }
                result[key] = this._getBlockTag(filter[key]);
            });
            return this.formatter.filter(yield resolveProperties(result));
        });
    }
    _call(transaction, blockTag, attempt) {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (attempt >= MAX_CCIP_REDIRECTS) {
                logger$3.throwError("CCIP read exceeded maximum redirections", Logger$2.errors.SERVER_ERROR, {
                    redirects: attempt, transaction
                });
            }
            const txSender = transaction.to;
            const result = yield this.perform("call", { transaction, blockTag });
            // CCIP Read request via OffchainLookup(address,string[],bytes,bytes4,bytes)
            if (attempt >= 0 && blockTag === "latest" && txSender != null && result.substring(0, 10) === "0x556f1830" && (hexDataLength(result) % 32 === 4)) {
                try {
                    const data = hexDataSlice(result, 4);
                    // Check the sender of the OffchainLookup matches the transaction
                    const sender = hexDataSlice(data, 0, 32);
                    if (!BigNumber.from(sender).eq(txSender)) {
                        logger$3.throwError("CCIP Read sender did not match", Logger$2.errors.CALL_EXCEPTION, {
                            name: "OffchainLookup",
                            signature: "OffchainLookup(address,string[],bytes,bytes4,bytes)",
                            transaction, data: result
                        });
                    }
                    // Read the URLs from the response
                    const urls = [];
                    const urlsOffset = BigNumber.from(hexDataSlice(data, 32, 64)).toNumber();
                    const urlsLength = BigNumber.from(hexDataSlice(data, urlsOffset, urlsOffset + 32)).toNumber();
                    const urlsData = hexDataSlice(data, urlsOffset + 32);
                    for (let u = 0; u < urlsLength; u++) {
                        const url = _parseString(urlsData, u * 32);
                        if (url == null) {
                            logger$3.throwError("CCIP Read contained corrupt URL string", Logger$2.errors.CALL_EXCEPTION, {
                                name: "OffchainLookup",
                                signature: "OffchainLookup(address,string[],bytes,bytes4,bytes)",
                                transaction, data: result
                            });
                        }
                        urls.push(url);
                    }
                    // Get the CCIP calldata to forward
                    const calldata = _parseBytes(data, 64);
                    // Get the callbackSelector (bytes4)
                    if (!BigNumber.from(hexDataSlice(data, 100, 128)).isZero()) {
                        logger$3.throwError("CCIP Read callback selector included junk", Logger$2.errors.CALL_EXCEPTION, {
                            name: "OffchainLookup",
                            signature: "OffchainLookup(address,string[],bytes,bytes4,bytes)",
                            transaction, data: result
                        });
                    }
                    const callbackSelector = hexDataSlice(data, 96, 100);
                    // Get the extra data to send back to the contract as context
                    const extraData = _parseBytes(data, 128);
                    const ccipResult = yield this.ccipReadFetch(transaction, calldata, urls);
                    if (ccipResult == null) {
                        logger$3.throwError("CCIP Read disabled or provided no URLs", Logger$2.errors.CALL_EXCEPTION, {
                            name: "OffchainLookup",
                            signature: "OffchainLookup(address,string[],bytes,bytes4,bytes)",
                            transaction, data: result
                        });
                    }
                    const tx = {
                        to: txSender,
                        data: hexConcat([callbackSelector, encodeBytes([ccipResult, extraData])])
                    };
                    return this._call(tx, blockTag, attempt + 1);
                }
                catch (error) {
                    if (error.code === Logger$2.errors.SERVER_ERROR) {
                        throw error;
                    }
                }
            }
            try {
                return hexlify(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "call",
                    params: { transaction, blockTag }, result, error
                });
            }
        });
    }
    call(transaction, blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const resolved = yield resolveProperties({
                transaction: this._getTransactionRequest(transaction),
                blockTag: this._getBlockTag(blockTag),
                ccipReadEnabled: Promise.resolve(transaction.ccipReadEnabled)
            });
            return this._call(resolved.transaction, resolved.blockTag, resolved.ccipReadEnabled ? 0 : -1);
        });
    }
    estimateGas(transaction) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                transaction: this._getTransactionRequest(transaction)
            });
            const result = yield this.perform("estimateGas", params);
            try {
                return BigNumber.from(result);
            }
            catch (error) {
                return logger$3.throwError("bad result from backend", Logger$2.errors.SERVER_ERROR, {
                    method: "estimateGas",
                    params, result, error
                });
            }
        });
    }
    _getAddress(addressOrName) {
        return __awaiter$2(this, void 0, void 0, function* () {
            addressOrName = yield addressOrName;
            if (typeof (addressOrName) !== "string") {
                logger$3.throwArgumentError("invalid address or ENS name", "name", addressOrName);
            }
            const address = yield this.resolveName(addressOrName);
            if (address == null) {
                logger$3.throwError("ENS name not configured", Logger$2.errors.UNSUPPORTED_OPERATION, {
                    operation: `resolveName(${JSON.stringify(addressOrName)})`
                });
            }
            return address;
        });
    }
    _getBlock(blockHashOrBlockTag, includeTransactions) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            blockHashOrBlockTag = yield blockHashOrBlockTag;
            // If blockTag is a number (not "latest", etc), this is the block number
            let blockNumber = -128;
            const params = {
                includeTransactions: !!includeTransactions
            };
            if (isHexString(blockHashOrBlockTag, 32)) {
                params.blockHash = blockHashOrBlockTag;
            }
            else {
                try {
                    params.blockTag = yield this._getBlockTag(blockHashOrBlockTag);
                    if (isHexString(params.blockTag)) {
                        blockNumber = parseInt(params.blockTag.substring(2), 16);
                    }
                }
                catch (error) {
                    logger$3.throwArgumentError("invalid block hash or block tag", "blockHashOrBlockTag", blockHashOrBlockTag);
                }
            }
            return poll(() => __awaiter$2(this, void 0, void 0, function* () {
                const block = yield this.perform("getBlock", params);
                // Block was not found
                if (block == null) {
                    // For blockhashes, if we didn't say it existed, that blockhash may
                    // not exist. If we did see it though, perhaps from a log, we know
                    // it exists, and this node is just not caught up yet.
                    if (params.blockHash != null) {
                        if (this._emitted["b:" + params.blockHash] == null) {
                            return null;
                        }
                    }
                    // For block tags, if we are asking for a future block, we return null
                    if (params.blockTag != null) {
                        if (blockNumber > this._emitted.block) {
                            return null;
                        }
                    }
                    // Retry on the next block
                    return undefined;
                }
                // Add transactions
                if (includeTransactions) {
                    let blockNumber = null;
                    for (let i = 0; i < block.transactions.length; i++) {
                        const tx = block.transactions[i];
                        if (tx.blockNumber == null) {
                            tx.confirmations = 0;
                        }
                        else if (tx.confirmations == null) {
                            if (blockNumber == null) {
                                blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
                            }
                            // Add the confirmations using the fast block number (pessimistic)
                            let confirmations = (blockNumber - tx.blockNumber) + 1;
                            if (confirmations <= 0) {
                                confirmations = 1;
                            }
                            tx.confirmations = confirmations;
                        }
                    }
                    const blockWithTxs = this.formatter.blockWithTransactions(block);
                    blockWithTxs.transactions = blockWithTxs.transactions.map((tx) => this._wrapTransaction(tx));
                    return blockWithTxs;
                }
                return this.formatter.block(block);
            }), { oncePoll: this });
        });
    }
    getBlock(blockHashOrBlockTag) {
        return (this._getBlock(blockHashOrBlockTag, false));
    }
    getBlockWithTransactions(blockHashOrBlockTag) {
        return (this._getBlock(blockHashOrBlockTag, true));
    }
    getTransaction(transactionHash) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            transactionHash = yield transactionHash;
            const params = { transactionHash: this.formatter.hash(transactionHash, true) };
            return poll(() => __awaiter$2(this, void 0, void 0, function* () {
                const result = yield this.perform("getTransaction", params);
                if (result == null) {
                    if (this._emitted["t:" + transactionHash] == null) {
                        return null;
                    }
                    return undefined;
                }
                const tx = this.formatter.transactionResponse(result);
                if (tx.blockNumber == null) {
                    tx.confirmations = 0;
                }
                else if (tx.confirmations == null) {
                    const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
                    // Add the confirmations using the fast block number (pessimistic)
                    let confirmations = (blockNumber - tx.blockNumber) + 1;
                    if (confirmations <= 0) {
                        confirmations = 1;
                    }
                    tx.confirmations = confirmations;
                }
                return this._wrapTransaction(tx);
            }), { oncePoll: this });
        });
    }
    getTransactionReceipt(transactionHash) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            transactionHash = yield transactionHash;
            const params = { transactionHash: this.formatter.hash(transactionHash, true) };
            return poll(() => __awaiter$2(this, void 0, void 0, function* () {
                const result = yield this.perform("getTransactionReceipt", params);
                if (result == null) {
                    if (this._emitted["t:" + transactionHash] == null) {
                        return null;
                    }
                    return undefined;
                }
                // "geth-etc" returns receipts before they are ready
                if (result.blockHash == null) {
                    return undefined;
                }
                const receipt = this.formatter.receipt(result);
                if (receipt.blockNumber == null) {
                    receipt.confirmations = 0;
                }
                else if (receipt.confirmations == null) {
                    const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
                    // Add the confirmations using the fast block number (pessimistic)
                    let confirmations = (blockNumber - receipt.blockNumber) + 1;
                    if (confirmations <= 0) {
                        confirmations = 1;
                    }
                    receipt.confirmations = confirmations;
                }
                return receipt;
            }), { oncePoll: this });
        });
    }
    getLogs(filter) {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({ filter: this._getFilter(filter) });
            const logs = yield this.perform("getLogs", params);
            logs.forEach((log) => {
                if (log.removed == null) {
                    log.removed = false;
                }
            });
            return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
        });
    }
    getEtherPrice() {
        return __awaiter$2(this, void 0, void 0, function* () {
            yield this.getNetwork();
            return this.perform("getEtherPrice", {});
        });
    }
    _getBlockTag(blockTag) {
        return __awaiter$2(this, void 0, void 0, function* () {
            blockTag = yield blockTag;
            if (typeof (blockTag) === "number" && blockTag < 0) {
                if (blockTag % 1) {
                    logger$3.throwArgumentError("invalid BlockTag", "blockTag", blockTag);
                }
                let blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
                blockNumber += blockTag;
                if (blockNumber < 0) {
                    blockNumber = 0;
                }
                return this.formatter.blockTag(blockNumber);
            }
            return this.formatter.blockTag(blockTag);
        });
    }
    getResolver(name) {
        return __awaiter$2(this, void 0, void 0, function* () {
            let currentName = name;
            while (true) {
                if (currentName === "" || currentName === ".") {
                    return null;
                }
                // Optimization since the eth node cannot change and does
                // not have a wildcard resolver
                if (name !== "eth" && currentName === "eth") {
                    return null;
                }
                // Check the current node for a resolver
                const addr = yield this._getResolver(currentName, "getResolver");
                // Found a resolver!
                if (addr != null) {
                    const resolver = new Resolver(this, addr, name);
                    // Legacy resolver found, using EIP-2544 so it isn't safe to use
                    if (currentName !== name && !(yield resolver.supportsWildcard())) {
                        return null;
                    }
                    return resolver;
                }
                // Get the parent node
                currentName = currentName.split(".").slice(1).join(".");
            }
        });
    }
    _getResolver(name, operation) {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (operation == null) {
                operation = "ENS";
            }
            const network = yield this.getNetwork();
            // No ENS...
            if (!network.ensAddress) {
                logger$3.throwError("network does not support ENS", Logger$2.errors.UNSUPPORTED_OPERATION, { operation, network: network.name });
            }
            try {
                // keccak256("resolver(bytes32)")
                const addrData = yield this.call({
                    to: network.ensAddress,
                    data: ("0x0178b8bf" + namehash(name).substring(2))
                });
                return this.formatter.callAddress(addrData);
            }
            catch (error) {
                // ENS registry cannot throw errors on resolver(bytes32)
            }
            return null;
        });
    }
    resolveName(name) {
        return __awaiter$2(this, void 0, void 0, function* () {
            name = yield name;
            // If it is already an address, nothing to resolve
            try {
                return Promise.resolve(this.formatter.address(name));
            }
            catch (error) {
                // If is is a hexstring, the address is bad (See #694)
                if (isHexString(name)) {
                    throw error;
                }
            }
            if (typeof (name) !== "string") {
                logger$3.throwArgumentError("invalid ENS name", "name", name);
            }
            // Get the addr from the resolver
            const resolver = yield this.getResolver(name);
            if (!resolver) {
                return null;
            }
            return yield resolver.getAddress();
        });
    }
    lookupAddress(address) {
        return __awaiter$2(this, void 0, void 0, function* () {
            address = yield address;
            address = this.formatter.address(address);
            const node = address.substring(2).toLowerCase() + ".addr.reverse";
            const resolverAddr = yield this._getResolver(node, "lookupAddress");
            if (resolverAddr == null) {
                return null;
            }
            // keccak("name(bytes32)")
            const name = _parseString(yield this.call({
                to: resolverAddr,
                data: ("0x691f3431" + namehash(node).substring(2))
            }), 0);
            const addr = yield this.resolveName(name);
            if (addr != address) {
                return null;
            }
            return name;
        });
    }
    getAvatar(nameOrAddress) {
        return __awaiter$2(this, void 0, void 0, function* () {
            let resolver = null;
            if (isHexString(nameOrAddress)) {
                // Address; reverse lookup
                const address = this.formatter.address(nameOrAddress);
                const node = address.substring(2).toLowerCase() + ".addr.reverse";
                const resolverAddress = yield this._getResolver(node, "getAvatar");
                if (!resolverAddress) {
                    return null;
                }
                // Try resolving the avatar against the addr.reverse resolver
                resolver = new Resolver(this, resolverAddress, node);
                try {
                    const avatar = yield resolver.getAvatar();
                    if (avatar) {
                        return avatar.url;
                    }
                }
                catch (error) {
                    if (error.code !== Logger$2.errors.CALL_EXCEPTION) {
                        throw error;
                    }
                }
                // Try getting the name and performing forward lookup; allowing wildcards
                try {
                    // keccak("name(bytes32)")
                    const name = _parseString(yield this.call({
                        to: resolverAddress,
                        data: ("0x691f3431" + namehash(node).substring(2))
                    }), 0);
                    resolver = yield this.getResolver(name);
                }
                catch (error) {
                    if (error.code !== Logger$2.errors.CALL_EXCEPTION) {
                        throw error;
                    }
                    return null;
                }
            }
            else {
                // ENS name; forward lookup with wildcard
                resolver = yield this.getResolver(nameOrAddress);
                if (!resolver) {
                    return null;
                }
            }
            const avatar = yield resolver.getAvatar();
            if (avatar == null) {
                return null;
            }
            return avatar.url;
        });
    }
    perform(method, params) {
        return logger$3.throwError(method + " not implemented", Logger$2.errors.NOT_IMPLEMENTED, { operation: method });
    }
    _startEvent(event) {
        this.polling = (this._events.filter((e) => e.pollable()).length > 0);
    }
    _stopEvent(event) {
        this.polling = (this._events.filter((e) => e.pollable()).length > 0);
    }
    _addEventListener(eventName, listener, once) {
        const event = new Event$1(getEventTag(eventName), listener, once);
        this._events.push(event);
        this._startEvent(event);
        return this;
    }
    on(eventName, listener) {
        return this._addEventListener(eventName, listener, false);
    }
    once(eventName, listener) {
        return this._addEventListener(eventName, listener, true);
    }
    emit(eventName, ...args) {
        let result = false;
        let stopped = [];
        let eventTag = getEventTag(eventName);
        this._events = this._events.filter((event) => {
            if (event.tag !== eventTag) {
                return true;
            }
            setTimeout(() => {
                event.listener.apply(this, args);
            }, 0);
            result = true;
            if (event.once) {
                stopped.push(event);
                return false;
            }
            return true;
        });
        stopped.forEach((event) => { this._stopEvent(event); });
        return result;
    }
    listenerCount(eventName) {
        if (!eventName) {
            return this._events.length;
        }
        let eventTag = getEventTag(eventName);
        return this._events.filter((event) => {
            return (event.tag === eventTag);
        }).length;
    }
    listeners(eventName) {
        if (eventName == null) {
            return this._events.map((event) => event.listener);
        }
        let eventTag = getEventTag(eventName);
        return this._events
            .filter((event) => (event.tag === eventTag))
            .map((event) => event.listener);
    }
    off(eventName, listener) {
        if (listener == null) {
            return this.removeAllListeners(eventName);
        }
        const stopped = [];
        let found = false;
        let eventTag = getEventTag(eventName);
        this._events = this._events.filter((event) => {
            if (event.tag !== eventTag || event.listener != listener) {
                return true;
            }
            if (found) {
                return true;
            }
            found = true;
            stopped.push(event);
            return false;
        });
        stopped.forEach((event) => { this._stopEvent(event); });
        return this;
    }
    removeAllListeners(eventName) {
        let stopped = [];
        if (eventName == null) {
            stopped = this._events;
            this._events = [];
        }
        else {
            const eventTag = getEventTag(eventName);
            this._events = this._events.filter((event) => {
                if (event.tag !== eventTag) {
                    return true;
                }
                stopped.push(event);
                return false;
            });
        }
        stopped.forEach((event) => { this._stopEvent(event); });
        return this;
    }
}

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$2 = new Logger$2(version$2);
const errorGas = ["call", "estimateGas"];
function spelunk(value, requireData) {
    if (value == null) {
        return null;
    }
    // These *are* the droids we're looking for.
    if (typeof (value.message) === "string" && value.message.match("reverted")) {
        const data = isHexString(value.data) ? value.data : null;
        if (!requireData || data) {
            return { message: value.message, data };
        }
    }
    // Spelunk further...
    if (typeof (value) === "object") {
        for (const key in value) {
            const result = spelunk(value[key], requireData);
            if (result) {
                return result;
            }
        }
        return null;
    }
    // Might be a JSON string we can further descend...
    if (typeof (value) === "string") {
        try {
            return spelunk(JSON.parse(value), requireData);
        }
        catch (error) { }
    }
    return null;
}
function checkError(method, error, params) {
    const transaction = params.transaction || params.signedTransaction;
    // Undo the "convenience" some nodes are attempting to prevent backwards
    // incompatibility; maybe for v6 consider forwarding reverts as errors
    if (method === "call") {
        const result = spelunk(error, true);
        if (result) {
            return result.data;
        }
        // Nothing descriptive..
        logger$2.throwError("missing revert data in call exception; Transaction reverted without a reason string", Logger$2.errors.CALL_EXCEPTION, {
            data: "0x", transaction, error
        });
    }
    if (method === "estimateGas") {
        // Try to find something, with a preference on SERVER_ERROR body
        let result = spelunk(error.body, false);
        if (result == null) {
            result = spelunk(error, false);
        }
        // Found "reverted", this is a CALL_EXCEPTION
        if (result) {
            logger$2.throwError("cannot estimate gas; transaction may fail or may require manual gas limit", Logger$2.errors.UNPREDICTABLE_GAS_LIMIT, {
                reason: result.message, method, transaction, error
            });
        }
    }
    // @TODO: Should we spelunk for message too?
    let message = error.message;
    if (error.code === Logger$2.errors.SERVER_ERROR && error.error && typeof (error.error.message) === "string") {
        message = error.error.message;
    }
    else if (typeof (error.body) === "string") {
        message = error.body;
    }
    else if (typeof (error.responseText) === "string") {
        message = error.responseText;
    }
    message = (message || "").toLowerCase();
    // "insufficient funds for gas * price + value + cost(data)"
    if (message.match(/insufficient funds|base fee exceeds gas limit/i)) {
        logger$2.throwError("insufficient funds for intrinsic transaction cost", Logger$2.errors.INSUFFICIENT_FUNDS, {
            error, method, transaction
        });
    }
    // "nonce too low"
    if (message.match(/nonce (is )?too low/i)) {
        logger$2.throwError("nonce has already been used", Logger$2.errors.NONCE_EXPIRED, {
            error, method, transaction
        });
    }
    // "replacement transaction underpriced"
    if (message.match(/replacement transaction underpriced|transaction gas price.*too low/i)) {
        logger$2.throwError("replacement fee too low", Logger$2.errors.REPLACEMENT_UNDERPRICED, {
            error, method, transaction
        });
    }
    // "replacement transaction underpriced"
    if (message.match(/only replay-protected/i)) {
        logger$2.throwError("legacy pre-eip-155 transactions not supported", Logger$2.errors.UNSUPPORTED_OPERATION, {
            error, method, transaction
        });
    }
    if (errorGas.indexOf(method) >= 0 && message.match(/gas required exceeds allowance|always failing transaction|execution reverted/)) {
        logger$2.throwError("cannot estimate gas; transaction may fail or may require manual gas limit", Logger$2.errors.UNPREDICTABLE_GAS_LIMIT, {
            error, method, transaction
        });
    }
    throw error;
}
function timer(timeout) {
    return new Promise(function (resolve) {
        setTimeout(resolve, timeout);
    });
}
function getResult$1(payload) {
    if (payload.error) {
        // @TODO: not any
        const error = new Error(payload.error.message);
        error.code = payload.error.code;
        error.data = payload.error.data;
        throw error;
    }
    return payload.result;
}
function getLowerCase(value) {
    if (value) {
        return value.toLowerCase();
    }
    return value;
}
const _constructorGuard = {};
class JsonRpcSigner extends Signer {
    constructor(constructorGuard, provider, addressOrIndex) {
        super();
        if (constructorGuard !== _constructorGuard) {
            throw new Error("do not call the JsonRpcSigner constructor directly; use provider.getSigner");
        }
        defineReadOnly$1(this, "provider", provider);
        if (addressOrIndex == null) {
            addressOrIndex = 0;
        }
        if (typeof (addressOrIndex) === "string") {
            defineReadOnly$1(this, "_address", this.provider.formatter.address(addressOrIndex));
            defineReadOnly$1(this, "_index", null);
        }
        else if (typeof (addressOrIndex) === "number") {
            defineReadOnly$1(this, "_index", addressOrIndex);
            defineReadOnly$1(this, "_address", null);
        }
        else {
            logger$2.throwArgumentError("invalid address or index", "addressOrIndex", addressOrIndex);
        }
    }
    connect(provider) {
        return logger$2.throwError("cannot alter JSON-RPC Signer connection", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "connect"
        });
    }
    connectUnchecked() {
        return new UncheckedJsonRpcSigner(_constructorGuard, this.provider, this._address || this._index);
    }
    getAddress() {
        if (this._address) {
            return Promise.resolve(this._address);
        }
        return this.provider.send("eth_accounts", []).then((accounts) => {
            if (accounts.length <= this._index) {
                logger$2.throwError("unknown account #" + this._index, Logger$2.errors.UNSUPPORTED_OPERATION, {
                    operation: "getAddress"
                });
            }
            return this.provider.formatter.address(accounts[this._index]);
        });
    }
    sendUncheckedTransaction(transaction) {
        transaction = shallowCopy(transaction);
        const fromAddress = this.getAddress().then((address) => {
            if (address) {
                address = address.toLowerCase();
            }
            return address;
        });
        // The JSON-RPC for eth_sendTransaction uses 90000 gas; if the user
        // wishes to use this, it is easy to specify explicitly, otherwise
        // we look it up for them.
        if (transaction.gasLimit == null) {
            const estimate = shallowCopy(transaction);
            estimate.from = fromAddress;
            transaction.gasLimit = this.provider.estimateGas(estimate);
        }
        if (transaction.to != null) {
            transaction.to = Promise.resolve(transaction.to).then((to) => __awaiter$1(this, void 0, void 0, function* () {
                if (to == null) {
                    return null;
                }
                const address = yield this.provider.resolveName(to);
                if (address == null) {
                    logger$2.throwArgumentError("provided ENS name resolves to null", "tx.to", to);
                }
                return address;
            }));
        }
        return resolveProperties({
            tx: resolveProperties(transaction),
            sender: fromAddress
        }).then(({ tx, sender }) => {
            if (tx.from != null) {
                if (tx.from.toLowerCase() !== sender) {
                    logger$2.throwArgumentError("from address mismatch", "transaction", transaction);
                }
            }
            else {
                tx.from = sender;
            }
            const hexTx = this.provider.constructor.hexlifyTransaction(tx, { from: true });
            return this.provider.send("eth_sendTransaction", [hexTx]).then((hash) => {
                return hash;
            }, (error) => {
                if (typeof (error.message) === "string" && error.message.match(/user denied/i)) {
                    logger$2.throwError("user rejected transaction", Logger$2.errors.ACTION_REJECTED, {
                        action: "sendTransaction",
                        transaction: tx
                    });
                }
                return checkError("sendTransaction", error, hexTx);
            });
        });
    }
    signTransaction(transaction) {
        return logger$2.throwError("signing transactions is unsupported", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "signTransaction"
        });
    }
    sendTransaction(transaction) {
        return __awaiter$1(this, void 0, void 0, function* () {
            // This cannot be mined any earlier than any recent block
            const blockNumber = yield this.provider._getInternalBlockNumber(100 + 2 * this.provider.pollingInterval);
            // Send the transaction
            const hash = yield this.sendUncheckedTransaction(transaction);
            try {
                // Unfortunately, JSON-RPC only provides and opaque transaction hash
                // for a response, and we need the actual transaction, so we poll
                // for it; it should show up very quickly
                return yield poll(() => __awaiter$1(this, void 0, void 0, function* () {
                    const tx = yield this.provider.getTransaction(hash);
                    if (tx === null) {
                        return undefined;
                    }
                    return this.provider._wrapTransaction(tx, hash, blockNumber);
                }), { oncePoll: this.provider });
            }
            catch (error) {
                error.transactionHash = hash;
                throw error;
            }
        });
    }
    signMessage(message) {
        return __awaiter$1(this, void 0, void 0, function* () {
            const data = ((typeof (message) === "string") ? toUtf8Bytes(message) : message);
            const address = yield this.getAddress();
            try {
                return yield this.provider.send("personal_sign", [hexlify(data), address.toLowerCase()]);
            }
            catch (error) {
                if (typeof (error.message) === "string" && error.message.match(/user denied/i)) {
                    logger$2.throwError("user rejected signing", Logger$2.errors.ACTION_REJECTED, {
                        action: "signMessage",
                        from: address,
                        message: data
                    });
                }
                throw error;
            }
        });
    }
    _legacySignMessage(message) {
        return __awaiter$1(this, void 0, void 0, function* () {
            const data = ((typeof (message) === "string") ? toUtf8Bytes(message) : message);
            const address = yield this.getAddress();
            try {
                // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
                return yield this.provider.send("eth_sign", [address.toLowerCase(), hexlify(data)]);
            }
            catch (error) {
                if (typeof (error.message) === "string" && error.message.match(/user denied/i)) {
                    logger$2.throwError("user rejected signing", Logger$2.errors.ACTION_REJECTED, {
                        action: "_legacySignMessage",
                        from: address,
                        message: data
                    });
                }
                throw error;
            }
        });
    }
    _signTypedData(domain, types, value) {
        return __awaiter$1(this, void 0, void 0, function* () {
            // Populate any ENS names (in-place)
            const populated = yield TypedDataEncoder.resolveNames(domain, types, value, (name) => {
                return this.provider.resolveName(name);
            });
            const address = yield this.getAddress();
            try {
                return yield this.provider.send("eth_signTypedData_v4", [
                    address.toLowerCase(),
                    JSON.stringify(TypedDataEncoder.getPayload(populated.domain, types, populated.value))
                ]);
            }
            catch (error) {
                if (typeof (error.message) === "string" && error.message.match(/user denied/i)) {
                    logger$2.throwError("user rejected signing", Logger$2.errors.ACTION_REJECTED, {
                        action: "_signTypedData",
                        from: address,
                        message: { domain: populated.domain, types, value: populated.value }
                    });
                }
                throw error;
            }
        });
    }
    unlock(password) {
        return __awaiter$1(this, void 0, void 0, function* () {
            const provider = this.provider;
            const address = yield this.getAddress();
            return provider.send("personal_unlockAccount", [address.toLowerCase(), password, null]);
        });
    }
}
class UncheckedJsonRpcSigner extends JsonRpcSigner {
    sendTransaction(transaction) {
        return this.sendUncheckedTransaction(transaction).then((hash) => {
            return {
                hash: hash,
                nonce: null,
                gasLimit: null,
                gasPrice: null,
                data: null,
                value: null,
                chainId: null,
                confirmations: 0,
                from: null,
                wait: (confirmations) => { return this.provider.waitForTransaction(hash, confirmations); }
            };
        });
    }
}
const allowedTransactionKeys = {
    chainId: true, data: true, gasLimit: true, gasPrice: true, nonce: true, to: true, value: true,
    type: true, accessList: true,
    maxFeePerGas: true, maxPriorityFeePerGas: true
};
class JsonRpcProvider extends BaseProvider {
    constructor(url, network) {
        let networkOrReady = network;
        // The network is unknown, query the JSON-RPC for it
        if (networkOrReady == null) {
            networkOrReady = new Promise((resolve, reject) => {
                setTimeout(() => {
                    this.detectNetwork().then((network) => {
                        resolve(network);
                    }, (error) => {
                        reject(error);
                    });
                }, 0);
            });
        }
        super(networkOrReady);
        // Default URL
        if (!url) {
            url = getStatic(this.constructor, "defaultUrl")();
        }
        if (typeof (url) === "string") {
            defineReadOnly$1(this, "connection", Object.freeze({
                url: url
            }));
        }
        else {
            defineReadOnly$1(this, "connection", Object.freeze(shallowCopy(url)));
        }
        this._nextId = 42;
    }
    get _cache() {
        if (this._eventLoopCache == null) {
            this._eventLoopCache = {};
        }
        return this._eventLoopCache;
    }
    static defaultUrl() {
        return "http:/\/localhost:8545";
    }
    detectNetwork() {
        if (!this._cache["detectNetwork"]) {
            this._cache["detectNetwork"] = this._uncachedDetectNetwork();
            // Clear this cache at the beginning of the next event loop
            setTimeout(() => {
                this._cache["detectNetwork"] = null;
            }, 0);
        }
        return this._cache["detectNetwork"];
    }
    _uncachedDetectNetwork() {
        return __awaiter$1(this, void 0, void 0, function* () {
            yield timer(0);
            let chainId = null;
            try {
                chainId = yield this.send("eth_chainId", []);
            }
            catch (error) {
                try {
                    chainId = yield this.send("net_version", []);
                }
                catch (error) { }
            }
            if (chainId != null) {
                const getNetwork = getStatic(this.constructor, "getNetwork");
                try {
                    return getNetwork(BigNumber.from(chainId).toNumber());
                }
                catch (error) {
                    return logger$2.throwError("could not detect network", Logger$2.errors.NETWORK_ERROR, {
                        chainId: chainId,
                        event: "invalidNetwork",
                        serverError: error
                    });
                }
            }
            return logger$2.throwError("could not detect network", Logger$2.errors.NETWORK_ERROR, {
                event: "noNetwork"
            });
        });
    }
    getSigner(addressOrIndex) {
        return new JsonRpcSigner(_constructorGuard, this, addressOrIndex);
    }
    getUncheckedSigner(addressOrIndex) {
        return this.getSigner(addressOrIndex).connectUnchecked();
    }
    listAccounts() {
        return this.send("eth_accounts", []).then((accounts) => {
            return accounts.map((a) => this.formatter.address(a));
        });
    }
    send(method, params) {
        const request = {
            method: method,
            params: params,
            id: (this._nextId++),
            jsonrpc: "2.0"
        };
        this.emit("debug", {
            action: "request",
            request: deepCopy$1(request),
            provider: this
        });
        // We can expand this in the future to any call, but for now these
        // are the biggest wins and do not require any serializing parameters.
        const cache = (["eth_chainId", "eth_blockNumber"].indexOf(method) >= 0);
        if (cache && this._cache[method]) {
            return this._cache[method];
        }
        const result = fetchJson(this.connection, JSON.stringify(request), getResult$1).then((result) => {
            this.emit("debug", {
                action: "response",
                request: request,
                response: result,
                provider: this
            });
            return result;
        }, (error) => {
            this.emit("debug", {
                action: "response",
                error: error,
                request: request,
                provider: this
            });
            throw error;
        });
        // Cache the fetch, but clear it on the next event loop
        if (cache) {
            this._cache[method] = result;
            setTimeout(() => {
                this._cache[method] = null;
            }, 0);
        }
        return result;
    }
    prepareRequest(method, params) {
        switch (method) {
            case "getBlockNumber":
                return ["eth_blockNumber", []];
            case "getGasPrice":
                return ["eth_gasPrice", []];
            case "getBalance":
                return ["eth_getBalance", [getLowerCase(params.address), params.blockTag]];
            case "getTransactionCount":
                return ["eth_getTransactionCount", [getLowerCase(params.address), params.blockTag]];
            case "getCode":
                return ["eth_getCode", [getLowerCase(params.address), params.blockTag]];
            case "getStorageAt":
                return ["eth_getStorageAt", [getLowerCase(params.address), hexZeroPad(params.position, 32), params.blockTag]];
            case "sendTransaction":
                return ["eth_sendRawTransaction", [params.signedTransaction]];
            case "getBlock":
                if (params.blockTag) {
                    return ["eth_getBlockByNumber", [params.blockTag, !!params.includeTransactions]];
                }
                else if (params.blockHash) {
                    return ["eth_getBlockByHash", [params.blockHash, !!params.includeTransactions]];
                }
                return null;
            case "getTransaction":
                return ["eth_getTransactionByHash", [params.transactionHash]];
            case "getTransactionReceipt":
                return ["eth_getTransactionReceipt", [params.transactionHash]];
            case "call": {
                const hexlifyTransaction = getStatic(this.constructor, "hexlifyTransaction");
                return ["eth_call", [hexlifyTransaction(params.transaction, { from: true }), params.blockTag]];
            }
            case "estimateGas": {
                const hexlifyTransaction = getStatic(this.constructor, "hexlifyTransaction");
                return ["eth_estimateGas", [hexlifyTransaction(params.transaction, { from: true })]];
            }
            case "getLogs":
                if (params.filter && params.filter.address != null) {
                    params.filter.address = getLowerCase(params.filter.address);
                }
                return ["eth_getLogs", [params.filter]];
        }
        return null;
    }
    perform(method, params) {
        return __awaiter$1(this, void 0, void 0, function* () {
            // Legacy networks do not like the type field being passed along (which
            // is fair), so we delete type if it is 0 and a non-EIP-1559 network
            if (method === "call" || method === "estimateGas") {
                const tx = params.transaction;
                if (tx && tx.type != null && BigNumber.from(tx.type).isZero()) {
                    // If there are no EIP-1559 properties, it might be non-EIP-1559
                    if (tx.maxFeePerGas == null && tx.maxPriorityFeePerGas == null) {
                        const feeData = yield this.getFeeData();
                        if (feeData.maxFeePerGas == null && feeData.maxPriorityFeePerGas == null) {
                            // Network doesn't know about EIP-1559 (and hence type)
                            params = shallowCopy(params);
                            params.transaction = shallowCopy(tx);
                            delete params.transaction.type;
                        }
                    }
                }
            }
            const args = this.prepareRequest(method, params);
            if (args == null) {
                logger$2.throwError(method + " not implemented", Logger$2.errors.NOT_IMPLEMENTED, { operation: method });
            }
            try {
                return yield this.send(args[0], args[1]);
            }
            catch (error) {
                return checkError(method, error, params);
            }
        });
    }
    _startEvent(event) {
        if (event.tag === "pending") {
            this._startPending();
        }
        super._startEvent(event);
    }
    _startPending() {
        if (this._pendingFilter != null) {
            return;
        }
        const self = this;
        const pendingFilter = this.send("eth_newPendingTransactionFilter", []);
        this._pendingFilter = pendingFilter;
        pendingFilter.then(function (filterId) {
            function poll() {
                self.send("eth_getFilterChanges", [filterId]).then(function (hashes) {
                    if (self._pendingFilter != pendingFilter) {
                        return null;
                    }
                    let seq = Promise.resolve();
                    hashes.forEach(function (hash) {
                        // @TODO: This should be garbage collected at some point... How? When?
                        self._emitted["t:" + hash.toLowerCase()] = "pending";
                        seq = seq.then(function () {
                            return self.getTransaction(hash).then(function (tx) {
                                self.emit("pending", tx);
                                return null;
                            });
                        });
                    });
                    return seq.then(function () {
                        return timer(1000);
                    });
                }).then(function () {
                    if (self._pendingFilter != pendingFilter) {
                        self.send("eth_uninstallFilter", [filterId]);
                        return;
                    }
                    setTimeout(function () { poll(); }, 0);
                    return null;
                }).catch((error) => { });
            }
            poll();
            return filterId;
        }).catch((error) => { });
    }
    _stopEvent(event) {
        if (event.tag === "pending" && this.listenerCount("pending") === 0) {
            this._pendingFilter = null;
        }
        super._stopEvent(event);
    }
    // Convert an ethers.js transaction into a JSON-RPC transaction
    //  - gasLimit => gas
    //  - All values hexlified
    //  - All numeric values zero-striped
    //  - All addresses are lowercased
    // NOTE: This allows a TransactionRequest, but all values should be resolved
    //       before this is called
    // @TODO: This will likely be removed in future versions and prepareRequest
    //        will be the preferred method for this.
    static hexlifyTransaction(transaction, allowExtra) {
        // Check only allowed properties are given
        const allowed = shallowCopy(allowedTransactionKeys);
        if (allowExtra) {
            for (const key in allowExtra) {
                if (allowExtra[key]) {
                    allowed[key] = true;
                }
            }
        }
        checkProperties(transaction, allowed);
        const result = {};
        // JSON-RPC now requires numeric values to be "quantity" values
        ["chainId", "gasLimit", "gasPrice", "type", "maxFeePerGas", "maxPriorityFeePerGas", "nonce", "value"].forEach(function (key) {
            if (transaction[key] == null) {
                return;
            }
            const value = hexValue(BigNumber.from(transaction[key]));
            if (key === "gasLimit") {
                key = "gas";
            }
            result[key] = value;
        });
        ["from", "to", "data"].forEach(function (key) {
            if (transaction[key] == null) {
                return;
            }
            result[key] = hexlify(transaction[key]);
        });
        if (transaction.accessList) {
            result["accessList"] = accessListify(transaction.accessList);
        }
        return result;
    }
}

let WS = null;
try {
    WS = WebSocket;
    if (WS == null) {
        throw new Error("inject please");
    }
}
catch (error) {
    const logger = new Logger$2(version$2);
    WS = function () {
        logger.throwError("WebSockets not supported in this environment", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "new WebSocket()"
        });
    };
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const logger$1 = new Logger$2(version$2);
/**
 *  Notes:
 *
 *  This provider differs a bit from the polling providers. One main
 *  difference is how it handles consistency. The polling providers
 *  will stall responses to ensure a consistent state, while this
 *  WebSocket provider assumes the connected backend will manage this.
 *
 *  For example, if a polling provider emits an event which indicates
 *  the event occurred in blockhash XXX, a call to fetch that block by
 *  its hash XXX, if not present will retry until it is present. This
 *  can occur when querying a pool of nodes that are mildly out of sync
 *  with each other.
 */
let NextId = 1;
// For more info about the Real-time Event API see:
//   https://geth.ethereum.org/docs/rpc/pubsub
class WebSocketProvider extends JsonRpcProvider {
    constructor(url, network) {
        // This will be added in the future; please open an issue to expedite
        if (network === "any") {
            logger$1.throwError("WebSocketProvider does not support 'any' network yet", Logger$2.errors.UNSUPPORTED_OPERATION, {
                operation: "network:any"
            });
        }
        if (typeof (url) === "string") {
            super(url, network);
        }
        else {
            super("_websocket", network);
        }
        this._pollingInterval = -1;
        this._wsReady = false;
        if (typeof (url) === "string") {
            defineReadOnly$1(this, "_websocket", new WS(this.connection.url));
        }
        else {
            defineReadOnly$1(this, "_websocket", url);
        }
        defineReadOnly$1(this, "_requests", {});
        defineReadOnly$1(this, "_subs", {});
        defineReadOnly$1(this, "_subIds", {});
        defineReadOnly$1(this, "_detectNetwork", super.detectNetwork());
        // Stall sending requests until the socket is open...
        this.websocket.onopen = () => {
            this._wsReady = true;
            Object.keys(this._requests).forEach((id) => {
                this.websocket.send(this._requests[id].payload);
            });
        };
        this.websocket.onmessage = (messageEvent) => {
            const data = messageEvent.data;
            const result = JSON.parse(data);
            if (result.id != null) {
                const id = String(result.id);
                const request = this._requests[id];
                delete this._requests[id];
                if (result.result !== undefined) {
                    request.callback(null, result.result);
                    this.emit("debug", {
                        action: "response",
                        request: JSON.parse(request.payload),
                        response: result.result,
                        provider: this
                    });
                }
                else {
                    let error = null;
                    if (result.error) {
                        error = new Error(result.error.message || "unknown error");
                        defineReadOnly$1(error, "code", result.error.code || null);
                        defineReadOnly$1(error, "response", data);
                    }
                    else {
                        error = new Error("unknown error");
                    }
                    request.callback(error, undefined);
                    this.emit("debug", {
                        action: "response",
                        error: error,
                        request: JSON.parse(request.payload),
                        provider: this
                    });
                }
            }
            else if (result.method === "eth_subscription") {
                // Subscription...
                const sub = this._subs[result.params.subscription];
                if (sub) {
                    //this.emit.apply(this,                  );
                    sub.processFunc(result.params.result);
                }
            }
            else {
                console.warn("this should not happen");
            }
        };
        // This Provider does not actually poll, but we want to trigger
        // poll events for things that depend on them (like stalling for
        // block and transaction lookups)
        const fauxPoll = setInterval(() => {
            this.emit("poll");
        }, 1000);
        if (fauxPoll.unref) {
            fauxPoll.unref();
        }
    }
    // Cannot narrow the type of _websocket, as that is not backwards compatible
    // so we add a getter and let the WebSocket be a public API.
    get websocket() { return this._websocket; }
    detectNetwork() {
        return this._detectNetwork;
    }
    get pollingInterval() {
        return 0;
    }
    resetEventsBlock(blockNumber) {
        logger$1.throwError("cannot reset events block on WebSocketProvider", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "resetEventBlock"
        });
    }
    set pollingInterval(value) {
        logger$1.throwError("cannot set polling interval on WebSocketProvider", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "setPollingInterval"
        });
    }
    poll() {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    set polling(value) {
        if (!value) {
            return;
        }
        logger$1.throwError("cannot set polling on WebSocketProvider", Logger$2.errors.UNSUPPORTED_OPERATION, {
            operation: "setPolling"
        });
    }
    send(method, params) {
        const rid = NextId++;
        return new Promise((resolve, reject) => {
            function callback(error, result) {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            }
            const payload = JSON.stringify({
                method: method,
                params: params,
                id: rid,
                jsonrpc: "2.0"
            });
            this.emit("debug", {
                action: "request",
                request: JSON.parse(payload),
                provider: this
            });
            this._requests[String(rid)] = { callback, payload };
            if (this._wsReady) {
                this.websocket.send(payload);
            }
        });
    }
    static defaultUrl() {
        return "ws:/\/localhost:8546";
    }
    _subscribe(tag, param, processFunc) {
        return __awaiter(this, void 0, void 0, function* () {
            let subIdPromise = this._subIds[tag];
            if (subIdPromise == null) {
                subIdPromise = Promise.all(param).then((param) => {
                    return this.send("eth_subscribe", param);
                });
                this._subIds[tag] = subIdPromise;
            }
            const subId = yield subIdPromise;
            this._subs[subId] = { tag, processFunc };
        });
    }
    _startEvent(event) {
        switch (event.type) {
            case "block":
                this._subscribe("block", ["newHeads"], (result) => {
                    const blockNumber = BigNumber.from(result.number).toNumber();
                    this._emitted.block = blockNumber;
                    this.emit("block", blockNumber);
                });
                break;
            case "pending":
                this._subscribe("pending", ["newPendingTransactions"], (result) => {
                    this.emit("pending", result);
                });
                break;
            case "filter":
                this._subscribe(event.tag, ["logs", this._getFilter(event.filter)], (result) => {
                    if (result.removed == null) {
                        result.removed = false;
                    }
                    this.emit(event.filter, this.formatter.filterLog(result));
                });
                break;
            case "tx": {
                const emitReceipt = (event) => {
                    const hash = event.hash;
                    this.getTransactionReceipt(hash).then((receipt) => {
                        if (!receipt) {
                            return;
                        }
                        this.emit(hash, receipt);
                    });
                };
                // In case it is already mined
                emitReceipt(event);
                // To keep things simple, we start up a single newHeads subscription
                // to keep an eye out for transactions we are watching for.
                // Starting a subscription for an event (i.e. "tx") that is already
                // running is (basically) a nop.
                this._subscribe("tx", ["newHeads"], (result) => {
                    this._events.filter((e) => (e.type === "tx")).forEach(emitReceipt);
                });
                break;
            }
            // Nothing is needed
            case "debug":
            case "poll":
            case "willPoll":
            case "didPoll":
            case "error":
                break;
            default:
                console.log("unhandled:", event);
                break;
        }
    }
    _stopEvent(event) {
        let tag = event.tag;
        if (event.type === "tx") {
            // There are remaining transaction event listeners
            if (this._events.filter((e) => (e.type === "tx")).length) {
                return;
            }
            tag = "tx";
        }
        else if (this.listenerCount(event.event)) {
            // There are remaining event listeners
            return;
        }
        const subId = this._subIds[tag];
        if (!subId) {
            return;
        }
        delete this._subIds[tag];
        subId.then((subId) => {
            if (!this._subs[subId]) {
                return;
            }
            delete this._subs[subId];
            this.send("eth_unsubscribe", [subId]);
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            // Wait until we have connected before trying to disconnect
            if (this.websocket.readyState === WS.CONNECTING) {
                yield (new Promise((resolve) => {
                    this.websocket.onopen = function () {
                        resolve(true);
                    };
                    this.websocket.onerror = function () {
                        resolve(false);
                    };
                }));
            }
            // Hangup
            // See: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
            this.websocket.close(1000);
        });
    }
}

new Logger$2(version$2);

const version$1 = "logger/5.6.0";

let _permanentCensorErrors = false;
let _censorErrors = false;
const LogLevels = { debug: 1, "default": 2, info: 2, warning: 3, error: 4, off: 5 };
let _logLevel = LogLevels["default"];
let _globalLogger = null;
function _checkNormalize() {
    try {
        const missing = [];
        // Make sure all forms of normalization are supported
        ["NFD", "NFC", "NFKD", "NFKC"].forEach((form) => {
            try {
                if ("test".normalize(form) !== "test") {
                    throw new Error("bad normalize");
                }
                ;
            }
            catch (error) {
                missing.push(form);
            }
        });
        if (missing.length) {
            throw new Error("missing " + missing.join(", "));
        }
        if (String.fromCharCode(0xe9).normalize("NFD") !== String.fromCharCode(0x65, 0x0301)) {
            throw new Error("broken implementation");
        }
    }
    catch (error) {
        return error.message;
    }
    return null;
}
const _normalizeError = _checkNormalize();
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARNING"] = "WARNING";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["OFF"] = "OFF";
})(LogLevel || (LogLevel = {}));
var ErrorCode;
(function (ErrorCode) {
    ///////////////////
    // Generic Errors
    // Unknown Error
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    // Not Implemented
    ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    // Unsupported Operation
    //   - operation
    ErrorCode["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
    // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
    //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    // Some sort of bad response from the server
    ErrorCode["SERVER_ERROR"] = "SERVER_ERROR";
    // Timeout
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ///////////////////
    // Operational  Errors
    // Buffer Overrun
    ErrorCode["BUFFER_OVERRUN"] = "BUFFER_OVERRUN";
    // Numeric Fault
    //   - operation: the operation being executed
    //   - fault: the reason this faulted
    ErrorCode["NUMERIC_FAULT"] = "NUMERIC_FAULT";
    ///////////////////
    // Argument Errors
    // Missing new operator to an object
    //  - name: The name of the class
    ErrorCode["MISSING_NEW"] = "MISSING_NEW";
    // Invalid argument (e.g. value is incompatible with type) to a function:
    //   - argument: The argument name that was invalid
    //   - value: The value of the argument
    ErrorCode["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
    // Missing argument to a function:
    //   - count: The number of arguments received
    //   - expectedCount: The number of arguments expected
    ErrorCode["MISSING_ARGUMENT"] = "MISSING_ARGUMENT";
    // Too many arguments
    //   - count: The number of arguments received
    //   - expectedCount: The number of arguments expected
    ErrorCode["UNEXPECTED_ARGUMENT"] = "UNEXPECTED_ARGUMENT";
    ///////////////////
    // Blockchain Errors
    // Call exception
    //  - transaction: the transaction
    //  - address?: the contract address
    //  - args?: The arguments passed into the function
    //  - method?: The Solidity method signature
    //  - errorSignature?: The EIP848 error signature
    //  - errorArgs?: The EIP848 error parameters
    //  - reason: The reason (only for EIP848 "Error(string)")
    ErrorCode["CALL_EXCEPTION"] = "CALL_EXCEPTION";
    // Insufficient funds (< value + gasLimit * gasPrice)
    //   - transaction: the transaction attempted
    ErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    // Nonce has already been used
    //   - transaction: the transaction attempted
    ErrorCode["NONCE_EXPIRED"] = "NONCE_EXPIRED";
    // The replacement fee for the transaction is too low
    //   - transaction: the transaction attempted
    ErrorCode["REPLACEMENT_UNDERPRICED"] = "REPLACEMENT_UNDERPRICED";
    // The gas limit could not be estimated
    //   - transaction: the transaction passed to estimateGas
    ErrorCode["UNPREDICTABLE_GAS_LIMIT"] = "UNPREDICTABLE_GAS_LIMIT";
    // The transaction was replaced by one with a higher gas price
    //   - reason: "cancelled", "replaced" or "repriced"
    //   - cancelled: true if reason == "cancelled" or reason == "replaced")
    //   - hash: original transaction hash
    //   - replacement: the full TransactionsResponse for the replacement
    //   - receipt: the receipt of the replacement
    ErrorCode["TRANSACTION_REPLACED"] = "TRANSACTION_REPLACED";
})(ErrorCode || (ErrorCode = {}));
const HEX = "0123456789abcdef";
class Logger {
    constructor(version) {
        Object.defineProperty(this, "version", {
            enumerable: true,
            value: version,
            writable: false
        });
    }
    _log(logLevel, args) {
        const level = logLevel.toLowerCase();
        if (LogLevels[level] == null) {
            this.throwArgumentError("invalid log level name", "logLevel", logLevel);
        }
        if (_logLevel > LogLevels[level]) {
            return;
        }
        console.log.apply(console, args);
    }
    debug(...args) {
        this._log(Logger.levels.DEBUG, args);
    }
    info(...args) {
        this._log(Logger.levels.INFO, args);
    }
    warn(...args) {
        this._log(Logger.levels.WARNING, args);
    }
    makeError(message, code, params) {
        // Errors are being censored
        if (_censorErrors) {
            return this.makeError("censored error", code, {});
        }
        if (!code) {
            code = Logger.errors.UNKNOWN_ERROR;
        }
        if (!params) {
            params = {};
        }
        const messageDetails = [];
        Object.keys(params).forEach((key) => {
            const value = params[key];
            try {
                if (value instanceof Uint8Array) {
                    let hex = "";
                    for (let i = 0; i < value.length; i++) {
                        hex += HEX[value[i] >> 4];
                        hex += HEX[value[i] & 0x0f];
                    }
                    messageDetails.push(key + "=Uint8Array(0x" + hex + ")");
                }
                else {
                    messageDetails.push(key + "=" + JSON.stringify(value));
                }
            }
            catch (error) {
                messageDetails.push(key + "=" + JSON.stringify(params[key].toString()));
            }
        });
        messageDetails.push(`code=${code}`);
        messageDetails.push(`version=${this.version}`);
        const reason = message;
        let url = "";
        switch (code) {
            case ErrorCode.NUMERIC_FAULT: {
                url = "NUMERIC_FAULT";
                const fault = message;
                switch (fault) {
                    case "overflow":
                    case "underflow":
                    case "division-by-zero":
                        url += "-" + fault;
                        break;
                    case "negative-power":
                    case "negative-width":
                        url += "-unsupported";
                        break;
                    case "unbound-bitwise-result":
                        url += "-unbound-result";
                        break;
                }
                break;
            }
            case ErrorCode.CALL_EXCEPTION:
            case ErrorCode.INSUFFICIENT_FUNDS:
            case ErrorCode.MISSING_NEW:
            case ErrorCode.NONCE_EXPIRED:
            case ErrorCode.REPLACEMENT_UNDERPRICED:
            case ErrorCode.TRANSACTION_REPLACED:
            case ErrorCode.UNPREDICTABLE_GAS_LIMIT:
                url = code;
                break;
        }
        if (url) {
            message += " [ See: https:/\/links.ethers.org/v5-errors-" + url + " ]";
        }
        if (messageDetails.length) {
            message += " (" + messageDetails.join(", ") + ")";
        }
        // @TODO: Any??
        const error = new Error(message);
        error.reason = reason;
        error.code = code;
        Object.keys(params).forEach(function (key) {
            error[key] = params[key];
        });
        return error;
    }
    throwError(message, code, params) {
        throw this.makeError(message, code, params);
    }
    throwArgumentError(message, name, value) {
        return this.throwError(message, Logger.errors.INVALID_ARGUMENT, {
            argument: name,
            value: value
        });
    }
    assert(condition, message, code, params) {
        if (!!condition) {
            return;
        }
        this.throwError(message, code, params);
    }
    assertArgument(condition, message, name, value) {
        if (!!condition) {
            return;
        }
        this.throwArgumentError(message, name, value);
    }
    checkNormalize(message) {
        if (_normalizeError) {
            this.throwError("platform missing String.prototype.normalize", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "String.prototype.normalize", form: _normalizeError
            });
        }
    }
    checkSafeUint53(value, message) {
        if (typeof (value) !== "number") {
            return;
        }
        if (message == null) {
            message = "value not safe";
        }
        if (value < 0 || value >= 0x1fffffffffffff) {
            this.throwError(message, Logger.errors.NUMERIC_FAULT, {
                operation: "checkSafeInteger",
                fault: "out-of-safe-range",
                value: value
            });
        }
        if (value % 1) {
            this.throwError(message, Logger.errors.NUMERIC_FAULT, {
                operation: "checkSafeInteger",
                fault: "non-integer",
                value: value
            });
        }
    }
    checkArgumentCount(count, expectedCount, message) {
        if (message) {
            message = ": " + message;
        }
        else {
            message = "";
        }
        if (count < expectedCount) {
            this.throwError("missing argument" + message, Logger.errors.MISSING_ARGUMENT, {
                count: count,
                expectedCount: expectedCount
            });
        }
        if (count > expectedCount) {
            this.throwError("too many arguments" + message, Logger.errors.UNEXPECTED_ARGUMENT, {
                count: count,
                expectedCount: expectedCount
            });
        }
    }
    checkNew(target, kind) {
        if (target === Object || target == null) {
            this.throwError("missing new", Logger.errors.MISSING_NEW, { name: kind.name });
        }
    }
    checkAbstract(target, kind) {
        if (target === kind) {
            this.throwError("cannot instantiate abstract class " + JSON.stringify(kind.name) + " directly; use a sub-class", Logger.errors.UNSUPPORTED_OPERATION, { name: target.name, operation: "new" });
        }
        else if (target === Object || target == null) {
            this.throwError("missing new", Logger.errors.MISSING_NEW, { name: kind.name });
        }
    }
    static globalLogger() {
        if (!_globalLogger) {
            _globalLogger = new Logger(version$1);
        }
        return _globalLogger;
    }
    static setCensorship(censorship, permanent) {
        if (!censorship && permanent) {
            this.globalLogger().throwError("cannot permanently disable censorship", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "setCensorship"
            });
        }
        if (_permanentCensorErrors) {
            if (!censorship) {
                return;
            }
            this.globalLogger().throwError("error censorship permanent", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "setCensorship"
            });
        }
        _censorErrors = !!censorship;
        _permanentCensorErrors = !!permanent;
    }
    static setLogLevel(logLevel) {
        const level = LogLevels[logLevel.toLowerCase()];
        if (level == null) {
            Logger.globalLogger().warn("invalid log level - " + logLevel);
            return;
        }
        _logLevel = level;
    }
    static from(version) {
        return new Logger(version);
    }
}
Logger.errors = ErrorCode;
Logger.levels = LogLevel;

const version = "properties/5.6.0";
const logger = new Logger(version);
function defineReadOnly(object, name, value) {
    Object.defineProperty(object, name, {
        enumerable: true,
        value: value,
        writable: false,
    });
}
const opaque = { bigint: true, boolean: true, "function": true, number: true, string: true };
function _isFrozen(object) {
    // Opaque objects are not mutable, so safe to copy by assignment
    if (object === undefined || object === null || opaque[typeof (object)]) {
        return true;
    }
    if (Array.isArray(object) || typeof (object) === "object") {
        if (!Object.isFrozen(object)) {
            return false;
        }
        const keys = Object.keys(object);
        for (let i = 0; i < keys.length; i++) {
            let value = null;
            try {
                value = object[keys[i]];
            }
            catch (error) {
                // If accessing a value triggers an error, it is a getter
                // designed to do so (e.g. Result) and is therefore "frozen"
                continue;
            }
            if (!_isFrozen(value)) {
                return false;
            }
        }
        return true;
    }
    return logger.throwArgumentError(`Cannot deepCopy ${typeof (object)}`, "object", object);
}
// Returns a new copy of object, such that no properties may be replaced.
// New properties may be added only to objects.
function _deepCopy(object) {
    if (_isFrozen(object)) {
        return object;
    }
    // Arrays are mutable, so we need to create a copy
    if (Array.isArray(object)) {
        return Object.freeze(object.map((item) => deepCopy(item)));
    }
    if (typeof (object) === "object") {
        const result = {};
        for (const key in object) {
            const value = object[key];
            if (value === undefined) {
                continue;
            }
            defineReadOnly(result, key, deepCopy(value));
        }
        return result;
    }
    return logger.throwArgumentError(`Cannot deepCopy ${typeof (object)}`, "object", object);
}
function deepCopy(object) {
    return _deepCopy(object);
}

/**
 * SDK's custom implementation of ethers.js's 'AlchemyProvider'.
 *
 * Do not call this constructor directly. Instead, instantiate an instance of
 * {@link Alchemy} and call {@link Alchemy.config.getProvider()}.
 *
 * @public
 */
class AlchemyProvider extends JsonRpcProvider {
    /** @internal */
    constructor(config) {
        // Normalize the API Key to a string.
        const apiKey = AlchemyProvider.getApiKey(config.apiKey);
        // Generate our own connection info with the correct endpoint URLs.
        const alchemyNetwork = AlchemyProvider.getAlchemyNetwork(config.network);
        const connection = AlchemyProvider.getAlchemyConnectionInfo(alchemyNetwork, apiKey, 'http');
        // If a hardcoded url was specified in the config, use that instead of the
        // provided apiKey or network.
        if (config.url !== undefined) {
            connection.url = config.url;
        }
        connection.throttleLimit = config.maxRetries;
        // Normalize the Alchemy named network input to the network names used by
        // ethers. This allows the parent super constructor in JsonRpcProvider to
        // correctly set the network.
        const ethersNetwork = EthersNetwork[alchemyNetwork];
        super(connection, ethersNetwork);
        this.apiKey = config.apiKey;
        this.maxRetries = config.maxRetries;
    }
    /**
     * Overrides the `UrlJsonRpcProvider.getApiKey` method as implemented by
     * ethers.js. Returns the API key for an Alchemy provider.
     *
     * @internal
     * @override
     */
    static getApiKey(apiKey) {
        if (apiKey == null) {
            return DEFAULT_ALCHEMY_API_KEY;
        }
        if (apiKey && typeof apiKey !== 'string') {
            throw new Error(`Invalid apiKey '${apiKey}' provided. apiKey must be a string.`);
        }
        return apiKey;
    }
    /**
     * Overrides the `BaseProvider.getNetwork` method as implemented by ethers.js.
     *
     * This override allows the SDK to set the provider's network to values not
     * yet supported by ethers.js.
     *
     * @internal
     * @override
     */
    static getNetwork(network) {
        if (typeof network === 'string' && network in CustomNetworks) {
            return CustomNetworks[network];
        }
        // Call the standard ethers.js getNetwork method for other networks.
        return getNetwork(network);
    }
    /**
     * Converts the `Networkish` input to the network enum used by Alchemy.
     *
     * @internal
     */
    static getAlchemyNetwork(network) {
        if (network === undefined) {
            return DEFAULT_NETWORK;
        }
        if (typeof network === 'number') {
            throw new Error(`Invalid network '${network}' provided. Network must be a string.`);
        }
        // Guaranteed that `typeof network === 'string`.
        const isValidNetwork = Object.values(Network).includes(network);
        if (!isValidNetwork) {
            throw new Error(`Invalid network '${network}' provided. Network must be one of: ` +
                `${Object.values(Network).join(', ')}.`);
        }
        return network;
    }
    /**
     * Returns a {@link ConnectionInfo} object compatible with ethers that contains
     * the correct URLs for Alchemy.
     *
     * @internal
     */
    static getAlchemyConnectionInfo(network, apiKey, type) {
        const url = type === 'http'
            ? getAlchemyHttpUrl(network, apiKey)
            : getAlchemyWsUrl(network, apiKey);
        return {
            headers: IS_BROWSER
                ? {
                    'Alchemy-Ethers-Sdk-Version': VERSION
                }
                : {
                    'Alchemy-Ethers-Sdk-Version': VERSION,
                    'Accept-Encoding': 'gzip'
                },
            allowGzip: true,
            url
        };
    }
    /**
     * Overrides the method in ethers.js's `StaticJsonRpcProvider` class. This
     * method is called when calling methods on the parent class `BaseProvider`.
     *
     * @override
     */
    detectNetwork() {
        const _super = Object.create(null, {
            detectNetwork: { get: () => super.detectNetwork }
        });
        return __awaiter$5(this, void 0, void 0, function* () {
            let network = this.network;
            if (network == null) {
                network = yield _super.detectNetwork.call(this);
                if (!network) {
                    throw new Error('No network detected');
                }
            }
            return network;
        });
    }
    _startPending() {
        logWarn('WARNING: Alchemy Provider does not support pending filters');
    }
    /**
     * Overrides the ether's `isCommunityResource()` method. Returns true if the
     * current api key is the default key.
     *
     * @override
     */
    isCommunityResource() {
        return this.apiKey === DEFAULT_ALCHEMY_API_KEY;
    }
    /**
     * Overrides the base {@link JsonRpcProvider.send} method to implement custom
     * logic for sending requests to Alchemy.
     *
     * @param method The method name to use for the request.
     * @param params The parameters to use for the request.
     * @override
     * @public
     */
    // TODO: Add headers for `perform()` override.
    send(method, params) {
        return this._send(method, params, 'send');
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `JsonRpcProvider.send()`.
     *
     * This method is copied over directly in order to implement custom headers
     *
     * @internal
     */
    _send(method, params, methodName) {
        const request = {
            method,
            params,
            id: this._nextId++,
            jsonrpc: '2.0'
        };
        this.emit('debug', {
            action: 'request',
            request: deepCopy(request),
            provider: this
        });
        // We can expand this in the future to any call, but for now these
        // are the biggest wins and do not require any serializing parameters.
        const cache = ['eth_chainId', 'eth_blockNumber'].indexOf(method) >= 0;
        if (cache && this._cache[method]) {
            return this._cache[method];
        }
        // START MODIFIED CODE
        const connection = Object.assign({}, this.connection);
        connection.headers['Alchemy-Ethers-Sdk-Method'] = methodName;
        // END MODIFIED CODE
        const result = fetchJson(this.connection, JSON.stringify(request), getResult).then(result => {
            this.emit('debug', {
                action: 'response',
                request,
                response: result,
                provider: this
            });
            return result;
        }, error => {
            this.emit('debug', {
                action: 'response',
                error,
                request,
                provider: this
            });
            throw error;
        });
        // Cache the fetch, but clear it on the next event loop
        if (cache) {
            this._cache[method] = result;
            setTimeout(() => {
                // @ts-ignore - This is done by ethers.
                this._cache[method] = null;
            }, 0);
        }
        return result;
    }
}
/**
 * DO NOT MODIFY.
 *
 * Original code copied over from ether.js's
 * `@ethersproject/web/src.ts/index.ts`. Used to support
 * {@link AlchemyProvider._send}, which is also copied over.
 */
function getResult(payload) {
    if (payload.error) {
        const error = new Error(payload.error.message);
        error.code = payload.error.code;
        error.data = payload.error.data;
        throw error;
    }
    return payload.result;
}

var alchemyProvider1b13a2c9 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	AlchemyProvider: AlchemyProvider
});

var dist = {};

Object.defineProperty(dist, "__esModule", { value: true });
var SHOULD_RECONNECT_FALSE_MESSAGE = "Provided shouldReconnect() returned false. Closing permanently.";
var SHOULD_RECONNECT_PROMISE_FALSE_MESSAGE = "Provided shouldReconnect() resolved to false. Closing permanently.";
var SturdyWebSocket = /** @class */ (function () {
    function SturdyWebSocket(url, protocolsOrOptions, options) {
        if (options === void 0) { options = {}; }
        this.url = url;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        this.onopen = null;
        this.ondown = null;
        this.onreopen = null;
        this.CONNECTING = SturdyWebSocket.CONNECTING;
        this.OPEN = SturdyWebSocket.OPEN;
        this.CLOSING = SturdyWebSocket.CLOSING;
        this.CLOSED = SturdyWebSocket.CLOSED;
        this.hasBeenOpened = false;
        this.isClosed = false;
        this.messageBuffer = [];
        this.nextRetryTime = 0;
        this.reconnectCount = 0;
        this.lastKnownExtensions = "";
        this.lastKnownProtocol = "";
        this.listeners = {};
        if (protocolsOrOptions == null ||
            typeof protocolsOrOptions === "string" ||
            Array.isArray(protocolsOrOptions)) {
            this.protocols = protocolsOrOptions;
        }
        else {
            options = protocolsOrOptions;
        }
        this.options = applyDefaultOptions(options);
        if (!this.options.wsConstructor) {
            if (typeof WebSocket !== "undefined") {
                this.options.wsConstructor = WebSocket;
            }
            else {
                throw new Error("WebSocket not present in global scope and no " +
                    "wsConstructor option was provided.");
            }
        }
        this.openNewWebSocket();
    }
    Object.defineProperty(SturdyWebSocket.prototype, "binaryType", {
        get: function () {
            return this.binaryTypeInternal || "blob";
        },
        set: function (binaryType) {
            this.binaryTypeInternal = binaryType;
            if (this.ws) {
                this.ws.binaryType = binaryType;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SturdyWebSocket.prototype, "bufferedAmount", {
        get: function () {
            var sum = this.ws ? this.ws.bufferedAmount : 0;
            var hasUnknownAmount = false;
            this.messageBuffer.forEach(function (data) {
                var byteLength = getDataByteLength(data);
                if (byteLength != null) {
                    sum += byteLength;
                }
                else {
                    hasUnknownAmount = true;
                }
            });
            if (hasUnknownAmount) {
                this.debugLog("Some buffered data had unknown length. bufferedAmount()" +
                    " return value may be below the correct amount.");
            }
            return sum;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SturdyWebSocket.prototype, "extensions", {
        get: function () {
            return this.ws ? this.ws.extensions : this.lastKnownExtensions;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SturdyWebSocket.prototype, "protocol", {
        get: function () {
            return this.ws ? this.ws.protocol : this.lastKnownProtocol;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SturdyWebSocket.prototype, "readyState", {
        get: function () {
            return this.isClosed ? SturdyWebSocket.CLOSED : SturdyWebSocket.OPEN;
        },
        enumerable: true,
        configurable: true
    });
    SturdyWebSocket.prototype.close = function (code, reason) {
        this.disposeSocket(code, reason);
        this.shutdown();
        this.debugLog("WebSocket permanently closed by client.");
    };
    SturdyWebSocket.prototype.send = function (data) {
        if (this.isClosed) {
            throw new Error("WebSocket is already in CLOSING or CLOSED state.");
        }
        else if (this.ws && this.ws.readyState === this.OPEN) {
            this.ws.send(data);
        }
        else {
            this.messageBuffer.push(data);
        }
    };
    SturdyWebSocket.prototype.reconnect = function () {
        if (this.isClosed) {
            throw new Error("Cannot call reconnect() on socket which is permanently closed.");
        }
        this.disposeSocket(1000, "Client requested reconnect.");
        this.handleClose(undefined);
    };
    SturdyWebSocket.prototype.addEventListener = function (type, listener) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
    };
    SturdyWebSocket.prototype.dispatchEvent = function (event) {
        return this.dispatchEventOfType(event.type, event);
    };
    SturdyWebSocket.prototype.removeEventListener = function (type, listener) {
        if (this.listeners[type]) {
            this.listeners[type] = this.listeners[type].filter(function (l) { return l !== listener; });
        }
    };
    SturdyWebSocket.prototype.openNewWebSocket = function () {
        var _this = this;
        if (this.isClosed) {
            return;
        }
        var _a = this.options, connectTimeout = _a.connectTimeout, wsConstructor = _a.wsConstructor;
        this.debugLog("Opening new WebSocket to " + this.url + ".");
        var ws = new wsConstructor(this.url, this.protocols);
        ws.onclose = function (event) { return _this.handleClose(event); };
        ws.onerror = function (event) { return _this.handleError(event); };
        ws.onmessage = function (event) { return _this.handleMessage(event); };
        ws.onopen = function (event) { return _this.handleOpen(event); };
        this.connectTimeoutId = setTimeout(function () {
            // If this is running, we still haven't opened the websocket.
            // Kill it so we can try again.
            _this.clearConnectTimeout();
            _this.disposeSocket();
            _this.handleClose(undefined);
        }, connectTimeout);
        this.ws = ws;
    };
    SturdyWebSocket.prototype.handleOpen = function (event) {
        var _this = this;
        if (!this.ws || this.isClosed) {
            return;
        }
        var allClearResetTime = this.options.allClearResetTime;
        this.debugLog("WebSocket opened.");
        if (this.binaryTypeInternal != null) {
            this.ws.binaryType = this.binaryTypeInternal;
        }
        else {
            this.binaryTypeInternal = this.ws.binaryType;
        }
        this.clearConnectTimeout();
        if (this.hasBeenOpened) {
            this.dispatchEventOfType("reopen", event);
        }
        else {
            this.dispatchEventOfType("open", event);
            this.hasBeenOpened = true;
        }
        this.messageBuffer.forEach(function (message) { return _this.send(message); });
        this.messageBuffer = [];
        this.allClearTimeoutId = setTimeout(function () {
            _this.clearAllClearTimeout();
            _this.nextRetryTime = 0;
            _this.reconnectCount = 0;
            var openTime = (allClearResetTime / 1000) | 0;
            _this.debugLog("WebSocket remained open for " + openTime + " seconds. Resetting" +
                " retry time and count.");
        }, allClearResetTime);
    };
    SturdyWebSocket.prototype.handleMessage = function (event) {
        if (this.isClosed) {
            return;
        }
        this.dispatchEventOfType("message", event);
    };
    SturdyWebSocket.prototype.handleClose = function (event) {
        var _this = this;
        if (this.isClosed) {
            return;
        }
        var _a = this.options, maxReconnectAttempts = _a.maxReconnectAttempts, shouldReconnect = _a.shouldReconnect;
        this.clearConnectTimeout();
        this.clearAllClearTimeout();
        if (this.ws) {
            this.lastKnownExtensions = this.ws.extensions;
            this.lastKnownProtocol = this.ws.protocol;
            this.disposeSocket();
        }
        this.dispatchEventOfType("down", event);
        if (this.reconnectCount >= maxReconnectAttempts) {
            this.stopReconnecting(event, this.getTooManyFailedReconnectsMessage());
            return;
        }
        var willReconnect = !event || shouldReconnect(event);
        if (typeof willReconnect === "boolean") {
            this.handleWillReconnect(willReconnect, event, SHOULD_RECONNECT_FALSE_MESSAGE);
        }
        else {
            willReconnect.then(function (willReconnectResolved) {
                if (_this.isClosed) {
                    return;
                }
                _this.handleWillReconnect(willReconnectResolved, event, SHOULD_RECONNECT_PROMISE_FALSE_MESSAGE);
            });
        }
    };
    SturdyWebSocket.prototype.handleError = function (event) {
        this.dispatchEventOfType("error", event);
        this.debugLog("WebSocket encountered an error.");
    };
    SturdyWebSocket.prototype.handleWillReconnect = function (willReconnect, event, denialReason) {
        if (willReconnect) {
            this.reestablishConnection();
        }
        else {
            this.stopReconnecting(event, denialReason);
        }
    };
    SturdyWebSocket.prototype.reestablishConnection = function () {
        var _this = this;
        var _a = this.options, minReconnectDelay = _a.minReconnectDelay, maxReconnectDelay = _a.maxReconnectDelay, reconnectBackoffFactor = _a.reconnectBackoffFactor;
        this.reconnectCount++;
        var retryTime = this.nextRetryTime;
        this.nextRetryTime = Math.max(minReconnectDelay, Math.min(this.nextRetryTime * reconnectBackoffFactor, maxReconnectDelay));
        setTimeout(function () { return _this.openNewWebSocket(); }, retryTime);
        var retryTimeSeconds = (retryTime / 1000) | 0;
        this.debugLog("WebSocket was closed. Re-opening in " + retryTimeSeconds + " seconds.");
    };
    SturdyWebSocket.prototype.stopReconnecting = function (event, debugReason) {
        this.debugLog(debugReason);
        this.shutdown();
        if (event) {
            this.dispatchEventOfType("close", event);
        }
    };
    SturdyWebSocket.prototype.shutdown = function () {
        this.isClosed = true;
        this.clearAllTimeouts();
        this.messageBuffer = [];
        this.disposeSocket();
    };
    SturdyWebSocket.prototype.disposeSocket = function (closeCode, reason) {
        if (!this.ws) {
            return;
        }
        // Use noop handlers instead of null because some WebSocket
        // implementations, such as the one from isomorphic-ws, raise a stink on
        // unhandled events.
        this.ws.onerror = noop;
        this.ws.onclose = noop;
        this.ws.onmessage = noop;
        this.ws.onopen = noop;
        this.ws.close(closeCode, reason);
        this.ws = undefined;
    };
    SturdyWebSocket.prototype.clearAllTimeouts = function () {
        this.clearConnectTimeout();
        this.clearAllClearTimeout();
    };
    SturdyWebSocket.prototype.clearConnectTimeout = function () {
        if (this.connectTimeoutId != null) {
            clearTimeout(this.connectTimeoutId);
            this.connectTimeoutId = undefined;
        }
    };
    SturdyWebSocket.prototype.clearAllClearTimeout = function () {
        if (this.allClearTimeoutId != null) {
            clearTimeout(this.allClearTimeoutId);
            this.allClearTimeoutId = undefined;
        }
    };
    SturdyWebSocket.prototype.dispatchEventOfType = function (type, event) {
        var _this = this;
        switch (type) {
            case "close":
                if (this.onclose) {
                    this.onclose(event);
                }
                break;
            case "error":
                if (this.onerror) {
                    this.onerror(event);
                }
                break;
            case "message":
                if (this.onmessage) {
                    this.onmessage(event);
                }
                break;
            case "open":
                if (this.onopen) {
                    this.onopen(event);
                }
                break;
            case "down":
                if (this.ondown) {
                    this.ondown(event);
                }
                break;
            case "reopen":
                if (this.onreopen) {
                    this.onreopen(event);
                }
                break;
        }
        if (type in this.listeners) {
            this.listeners[type]
                .slice()
                .forEach(function (listener) { return _this.callListener(listener, event); });
        }
        return !event || !event.defaultPrevented;
    };
    SturdyWebSocket.prototype.callListener = function (listener, event) {
        if (typeof listener === "function") {
            listener.call(this, event);
        }
        else {
            listener.handleEvent.call(this, event);
        }
    };
    SturdyWebSocket.prototype.debugLog = function (message) {
        if (this.options.debug) {
            // tslint:disable-next-line:no-console
            console.log(message);
        }
    };
    SturdyWebSocket.prototype.getTooManyFailedReconnectsMessage = function () {
        var maxReconnectAttempts = this.options.maxReconnectAttempts;
        return "Failed to reconnect after " + maxReconnectAttempts + " " + pluralize("attempt", maxReconnectAttempts) + ". Closing permanently.";
    };
    SturdyWebSocket.DEFAULT_OPTIONS = {
        allClearResetTime: 5000,
        connectTimeout: 5000,
        debug: false,
        minReconnectDelay: 1000,
        maxReconnectDelay: 30000,
        maxReconnectAttempts: Number.POSITIVE_INFINITY,
        reconnectBackoffFactor: 1.5,
        shouldReconnect: function () { return true; },
        wsConstructor: undefined,
    };
    SturdyWebSocket.CONNECTING = 0;
    SturdyWebSocket.OPEN = 1;
    SturdyWebSocket.CLOSING = 2;
    SturdyWebSocket.CLOSED = 3;
    return SturdyWebSocket;
}());
var _default = dist.default = SturdyWebSocket;
function applyDefaultOptions(options) {
    var result = {};
    Object.keys(SturdyWebSocket.DEFAULT_OPTIONS).forEach(function (key) {
        var value = options[key];
        result[key] =
            value === undefined
                ? SturdyWebSocket.DEFAULT_OPTIONS[key]
                : value;
    });
    return result;
}
function getDataByteLength(data) {
    if (typeof data === "string") {
        // UTF-16 strings use two bytes per character.
        return 2 * data.length;
    }
    else if (data instanceof ArrayBuffer) {
        return data.byteLength;
    }
    else if (data instanceof Blob) {
        return data.size;
    }
    else {
        return undefined;
    }
}
function pluralize(s, n) {
    return n === 1 ? s : s + "s";
}
function noop() {
    // Nothing.
}

/**
 * The maximum number of blocks to backfill. If more than this many blocks have
 * been missed, then we'll sadly miss data, but we want to make sure we don't
 * end up requesting thousands of blocks if somebody left their laptop closed for a week.
 */
const MAX_BACKFILL_BLOCKS = 120;
/**
 * The WebsocketBackfiller fetches events that were sent since a provided block
 * number. This is used in the {@link AlchemyWebSocketProvider} to backfill
 * events that were transmitted while the websocket connection was down.
 *
 * The backfiller backfills two main eth_subscribe events: `logs` and `newHeads`.
 *
 * @internal
 */
class WebsocketBackfiller {
    constructor(provider) {
        this.provider = provider;
        // TODO: Use HTTP provider to do backfill.
        this.maxBackfillBlocks = MAX_BACKFILL_BLOCKS;
    }
    /**
     * Runs backfill for `newHeads` events.
     *
     * @param isCancelled Whether the backfill request is cancelled.
     * @param previousHeads Previous head requests that were sent.
     * @param fromBlockNumber The block number to start backfilling from.
     * @returns A list of `newHeads` events that were sent since the last backfill.
     */
    getNewHeadsBackfill(isCancelled, previousHeads, fromBlockNumber) {
        return __awaiter$5(this, void 0, void 0, function* () {
            throwIfCancelled(isCancelled);
            const toBlockNumber = yield this.getBlockNumber();
            throwIfCancelled(isCancelled);
            // If there are no previous heads to fetch, return new heads since
            // `fromBlockNumber`, or up to maxBackfillBlocks from the current head.
            if (previousHeads.length === 0) {
                return this.getHeadEventsInRange(Math.max(fromBlockNumber, toBlockNumber - this.maxBackfillBlocks) + 1, toBlockNumber + 1);
            }
            // If the last emitted event is too far back in the past, there's no need
            // to backfill for reorgs. Just fetch the last `maxBackfillBlocks` worth of
            // new heads.
            const lastSeenBlockNumber = fromHex(previousHeads[previousHeads.length - 1].number);
            const minBlockNumber = toBlockNumber - this.maxBackfillBlocks + 1;
            if (lastSeenBlockNumber <= minBlockNumber) {
                return this.getHeadEventsInRange(minBlockNumber, toBlockNumber + 1);
            }
            // To capture all `newHeads` events, return all head events from the last
            // seen block number to current + any of the previous heads that were re-orged.
            const reorgHeads = yield this.getReorgHeads(isCancelled, previousHeads);
            throwIfCancelled(isCancelled);
            const intermediateHeads = yield this.getHeadEventsInRange(lastSeenBlockNumber + 1, toBlockNumber + 1);
            throwIfCancelled(isCancelled);
            return [...reorgHeads, ...intermediateHeads];
        });
    }
    /**
     * Runs backfill for `logs` events.
     *
     * @param isCancelled Whether the backfill request is cancelled.
     * @param filter The filter object that accompanies a logs subscription.
     * @param previousLogs Previous log requests that were sent.
     * @param fromBlockNumber The block number to start backfilling from.
     */
    getLogsBackfill(isCancelled, filter, previousLogs, fromBlockNumber) {
        return __awaiter$5(this, void 0, void 0, function* () {
            throwIfCancelled(isCancelled);
            const toBlockNumber = yield this.getBlockNumber();
            throwIfCancelled(isCancelled);
            // If there are no previous logs to fetch, return new logs since
            // `fromBlockNumber`, or up to `maxBackfillBlocks` from the current head.
            if (previousLogs.length === 0) {
                return this.getLogsInRange(filter, Math.max(fromBlockNumber, toBlockNumber - this.maxBackfillBlocks) + 1, toBlockNumber + 1);
            }
            // If the last emitted log is too far back in the past, there's no need
            // to backfill for removed logs. Just fetch the last `maxBackfillBlocks`
            // worth of logs.
            const lastSeenBlockNumber = fromHex(previousLogs[previousLogs.length - 1].blockNumber);
            const minBlockNumber = toBlockNumber - this.maxBackfillBlocks + 1;
            if (lastSeenBlockNumber < minBlockNumber) {
                return this.getLogsInRange(filter, minBlockNumber, toBlockNumber + 1);
            }
            // Return all log events that have happened along with log events that have
            // been removed due to a chain reorg.
            const commonAncestor = yield this.getCommonAncestor(isCancelled, previousLogs);
            throwIfCancelled(isCancelled);
            // All previous logs with a block number greater than the common ancestor
            // were part of a re-org, so mark them as such.
            const removedLogs = previousLogs
                .filter(log => fromHex(log.blockNumber) > commonAncestor.blockNumber)
                .map(log => (Object.assign(Object.assign({}, log), { removed: true })));
            // If no common ancestor was found, start backfill from the oldest log's
            // block number.
            const fromBlockInclusive = commonAncestor.blockNumber === Number.NEGATIVE_INFINITY
                ? fromHex(previousLogs[0].blockNumber)
                : commonAncestor.blockNumber;
            let addedLogs = yield this.getLogsInRange(filter, fromBlockInclusive, toBlockNumber + 1);
            // De-dupe any logs that were already emitted.
            addedLogs = addedLogs.filter(log => log &&
                (fromHex(log.blockNumber) > commonAncestor.blockNumber ||
                    fromHex(log.logIndex) > commonAncestor.logIndex));
            throwIfCancelled(isCancelled);
            return [...removedLogs, ...addedLogs];
        });
    }
    /**
     * Sets a new max backfill blocks. VISIBLE ONLY FOR TESTING.
     *
     * @internal
     */
    setMaxBackfillBlock(newMax) {
        this.maxBackfillBlocks = newMax;
    }
    /**
     * Gets the current block number as a number.
     *
     * @private
     */
    getBlockNumber() {
        return __awaiter$5(this, void 0, void 0, function* () {
            const blockNumberHex = yield this.provider.send('eth_blockNumber');
            return fromHex(blockNumberHex);
        });
    }
    /**
     * Gets all `newHead` events in the provided range. Note that the returned
     * heads do not include re-orged heads. Use {@link getReorgHeads} to find heads
     * that were part of a re-org.
     *
     * @private
     */
    getHeadEventsInRange(fromBlockInclusive, toBlockExclusive) {
        return __awaiter$5(this, void 0, void 0, function* () {
            if (fromBlockInclusive >= toBlockExclusive) {
                return [];
            }
            const batchParts = [];
            for (let i = fromBlockInclusive; i < toBlockExclusive; i++) {
                batchParts.push({
                    method: 'eth_getBlockByNumber',
                    params: [toHex(i), false]
                });
            }
            // TODO: just fire off each send() separately since we're no longer batching:
            // TODO: handle errors
            const batchedBlockHeads = yield this.provider.sendBatch(batchParts);
            const blockHeads = batchedBlockHeads.reduce((acc, batch) => acc.concat(batch), []);
            return blockHeads.map(toNewHeadsEvent);
        });
    }
    /**
     * Returns all heads that were part of a reorg event.
     *
     * @private
     */
    getReorgHeads(isCancelled, previousHeads) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const result = [];
            // Iterate from the most recent head backwards in order to find the first
            // block that was part of a re-org.
            for (let i = previousHeads.length - 1; i >= 0; i--) {
                const oldEvent = previousHeads[i];
                const blockHead = yield this.getBlockByNumber(fromHex(oldEvent.number));
                throwIfCancelled(isCancelled);
                // If the hashes match, then current head in the iteration was not re-orged.
                if (oldEvent.hash === blockHead.hash) {
                    break;
                }
                result.push(toNewHeadsEvent(blockHead));
            }
            return result.reverse();
        });
    }
    /**
     * Simple wrapper around `eth_getBlockByNumber` that returns the complete
     * block information for the provided block number.
     *
     * @private
     */
    getBlockByNumber(blockNumber) {
        return __awaiter$5(this, void 0, void 0, function* () {
            return this.provider.send('eth_getBlockByNumber', [
                toHex(blockNumber),
                false
            ]);
        });
    }
    /**
     * Given a list of previous log events, finds the common block number from the
     * logs that matches the block head.
     *
     * This can be used to identify which logs are part of a re-org.
     *
     * Returns 1 less than the oldest log's block number if no common ancestor was found.
     *
     * @private
     */
    getCommonAncestor(isCancelled, previousLogs) {
        return __awaiter$5(this, void 0, void 0, function* () {
            // Iterate from the most recent head backwards in order to find the first
            // block that was part of a re-org.
            let blockHead = yield this.getBlockByNumber(fromHex(previousLogs[previousLogs.length - 1].blockNumber));
            throwIfCancelled(isCancelled);
            for (let i = previousLogs.length - 1; i >= 0; i--) {
                const oldLog = previousLogs[i];
                // Ensure that updated blocks are fetched every time the log's block number
                // changes.
                if (oldLog.blockNumber !== blockHead.number) {
                    blockHead = yield this.getBlockByNumber(fromHex(oldLog.blockNumber));
                }
                // Since logs are ordered in ascending order, the first log that matches
                // the hash should be the largest logIndex.
                if (oldLog.blockHash === blockHead.hash) {
                    return {
                        blockNumber: fromHex(oldLog.blockNumber),
                        logIndex: fromHex(oldLog.logIndex)
                    };
                }
            }
            return {
                blockNumber: Number.NEGATIVE_INFINITY,
                logIndex: Number.NEGATIVE_INFINITY
            };
        });
    }
    /**
     * Gets all `logs` events in the provided range. Note that the returned logs
     * do not include removed logs.
     *
     * @private
     */ getLogsInRange(filter, fromBlockInclusive, toBlockExclusive) {
        return __awaiter$5(this, void 0, void 0, function* () {
            if (fromBlockInclusive >= toBlockExclusive) {
                return [];
            }
            const rangeFilter = Object.assign(Object.assign({}, filter), { fromBlock: toHex(fromBlockInclusive), toBlock: toHex(toBlockExclusive - 1) });
            return this.provider.send('eth_getLogs', [rangeFilter]);
        });
    }
}
function toNewHeadsEvent(head) {
    const result = Object.assign({}, head);
    delete result.totalDifficulty;
    delete result.transactions;
    delete result.uncles;
    return result;
}
function dedupeNewHeads(events) {
    return dedupe(events, event => event.hash);
}
function dedupeLogs(events) {
    return dedupe(events, event => `${event.blockHash}/${event.logIndex}`);
}
function dedupe(items, getKey) {
    const keysSeen = new Set();
    const result = [];
    items.forEach(item => {
        const key = getKey(item);
        if (!keysSeen.has(key)) {
            keysSeen.add(key);
            result.push(item);
        }
    });
    return result;
}
const CANCELLED = new Error('Cancelled');
function throwIfCancelled(isCancelled) {
    if (isCancelled()) {
        throw CANCELLED;
    }
}

/**
 * Prefix for `alchemy_pendingTransactions` subscriptions when serializing to
 * ethers events.
 */
const ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE = 'alchemy-pending-transactions';
/**
 * DO NOT MODIFY.
 *
 * Event class copied directly over from ethers.js's `BaseProvider` class.
 *
 * This class is used to represent events and their corresponding listeners. The
 * SDK needs to extend this class in order to support Alchemy's custom
 * Subscription API types. The original class is not exported by ethers. Minimal
 * changes have been made in order to get TS to compile.
 */
class Event {
    constructor(tag, listener, once) {
        this.listener = listener;
        this.tag = tag;
        this.once = once;
        this._lastBlockNumber = -2;
        this._inflight = false;
    }
    get event() {
        switch (this.type) {
            case 'tx':
                return this.hash;
            case 'filter':
                return this.filter;
            default:
                return this.tag;
        }
    }
    get type() {
        return this.tag.split(':')[0];
    }
    get hash() {
        const comps = this.tag.split(':');
        if (comps[0] !== 'tx') {
            throw new Error('Not a transaction event');
        }
        return comps[1];
    }
    get filter() {
        const comps = this.tag.split(':');
        if (comps[0] !== 'filter') {
            throw new Error('Not a transaction event');
        }
        const address = comps[1];
        const topics = deserializeTopics(comps[2]);
        const filter = {};
        if (topics.length > 0) {
            filter.topics = topics;
        }
        if (address && address !== '*') {
            filter.address = address;
        }
        return filter;
    }
    pollable() {
        const PollableEvents = ['block', 'network', 'pending', 'poll'];
        return this.tag.indexOf(':') >= 0 || PollableEvents.indexOf(this.tag) >= 0;
    }
}
/**
 * Wrapper class around the ethers `Event` class in order to add support for
 * Alchemy's custom subscriptions types.
 *
 * The getters on this class deserialize the event tag generated by
 * {@link getAlchemyEventTag} into the original fields passed into the event.
 */
class EthersEvent extends Event {
    /**
     * Converts the event tag into the original `fromAddress` field in
     * {@link AlchemyPendingTransactionsEventFilter}.
     */
    get fromAddress() {
        const comps = this.tag.split(':');
        if (comps[0] !== ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
            return undefined;
        }
        if (comps[1] && comps[1] !== '*') {
            return deserializeAddressField(comps[1]);
        }
        else {
            return undefined;
        }
    }
    /**
     * Converts the event tag into the original `toAddress` field in
     * {@link AlchemyPendingTransactionsEventFilter}.
     */
    get toAddress() {
        const comps = this.tag.split(':');
        if (comps[0] !== ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
            return undefined;
        }
        if (comps[2] && comps[2] !== '*') {
            return deserializeAddressField(comps[2]);
        }
        else {
            return undefined;
        }
    }
    /**
     * Converts the event tag into the original `hashesOnly` field in
     * {@link AlchemyPendingTransactionsEventFilter}.
     */
    get hashesOnly() {
        const comps = this.tag.split(':');
        if (comps[0] !== ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
            return undefined;
        }
        if (comps[3] && comps[3] !== '*') {
            return comps[3] === 'true';
        }
        else {
            return undefined;
        }
    }
}
function deserializeTopics(data) {
    if (data === '') {
        return [];
    }
    return data.split(/&/g).map(topic => {
        if (topic === '') {
            return [];
        }
        const comps = topic.split('|').map(topic => {
            return topic === 'null' ? null : topic;
        });
        return comps.length === 1 ? comps[0] : comps;
    });
}
function deserializeAddressField(data) {
    if (data === '') {
        return undefined;
    }
    const addresses = data.split('|');
    return addresses.length === 1 ? addresses[0] : addresses;
}

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_WAIT_TIME = 10000;
const BACKFILL_TIMEOUT = 60000;
const BACKFILL_RETRIES = 5;
/**
 * Subscriptions have a memory of recent events they have sent so that in the
 * event that they disconnect and need to backfill, they can detect re-orgs.
 * Keep a buffer that goes back at least these many blocks, the maximum amount
 * at which we might conceivably see a re-org.
 *
 * Note that while our buffer goes back this many blocks, it may contain more
 * than this many elements, since in the case of logs subscriptions more than
 * one event may be emitted for a block.
 */
const RETAINED_EVENT_BLOCK_COUNT = 10;
/**
 * SDK's custom implementation fo the ethers.js's 'AlchemyWebSocketProvider'.
 *
 * Do not call this constructor directly. Instead, instantiate an instance of
 * {@link Alchemy} and call {@link Alchemy.config.getWebSocketProvider()}.
 *
 * @public
 */
class AlchemyWebSocketProvider extends WebSocketProvider {
    /** @internal */
    constructor(config, wsConstructor) {
        var _a;
        // Normalize the API Key to a string.
        const apiKey = AlchemyProvider.getApiKey(config.apiKey);
        // Generate our own connection info with the correct endpoint URLs.
        const alchemyNetwork = AlchemyProvider.getAlchemyNetwork(config.network);
        const connection = AlchemyProvider.getAlchemyConnectionInfo(alchemyNetwork, apiKey, 'wss');
        const protocol = `alchemy-sdk-${VERSION}`;
        // Use the provided config URL override if it exists, otherwise use the created one.
        const ws = new _default((_a = config.url) !== null && _a !== void 0 ? _a : connection.url, protocol, {
            wsConstructor: wsConstructor !== null && wsConstructor !== void 0 ? wsConstructor : getWebsocketConstructor()
        });
        // Normalize the Alchemy named network input to the network names used by
        // ethers. This allows the parent super constructor in JsonRpcProvider to
        // correctly set the network.
        const ethersNetwork = EthersNetwork[alchemyNetwork];
        super(ws, ethersNetwork);
        this._events = [];
        // In the case of a WebSocket reconnection, all subscriptions are lost and we
        // create new ones to replace them, but we want to create the illusion that
        // the original subscriptions persist. Thus, maintain a mapping from the
        // "virtual" subscription ids which are visible to the consumer to the
        // "physical" subscription ids of the actual connections. This terminology is
        // borrowed from virtual and physical memory, which has a similar mapping.
        /** @internal */
        this.virtualSubscriptionsById = new Map();
        /** @internal */
        this.virtualIdsByPhysicalId = new Map();
        /**
         * The underlying ethers {@link WebSocketProvider} already handles and emits
         * messages. To allow backfilling, track all messages that are emitted.
         *
         * This is a field arrow function in order to preserve `this` context when
         * passing the method as an event listener.
         *
         * @internal
         */
        this.handleMessage = (event) => {
            const message = JSON.parse(event.data);
            if (!isSubscriptionEvent(message)) {
                return;
            }
            const physicalId = message.params.subscription;
            const virtualId = this.virtualIdsByPhysicalId.get(physicalId);
            if (!virtualId) {
                return;
            }
            const subscription = this.virtualSubscriptionsById.get(virtualId);
            if (subscription.method !== 'eth_subscribe') {
                return;
            }
            switch (subscription.params[0]) {
                case 'newHeads': {
                    const newHeadsSubscription = subscription;
                    const newHeadsMessage = message;
                    const { isBackfilling, backfillBuffer } = newHeadsSubscription;
                    const { result } = newHeadsMessage.params;
                    if (isBackfilling) {
                        addToNewHeadsEventsBuffer(backfillBuffer, result);
                    }
                    else if (physicalId !== virtualId) {
                        // In the case of a re-opened subscription, ethers will not emit the
                        // event, so the SDK has to.
                        this.emitAndRememberEvent(virtualId, result, getNewHeadsBlockNumber);
                    }
                    else {
                        // Ethers subscription mapping will emit the event, just store it.
                        this.rememberEvent(virtualId, result, getNewHeadsBlockNumber);
                    }
                    break;
                }
                case 'logs': {
                    const logsSubscription = subscription;
                    const logsMessage = message;
                    const { isBackfilling, backfillBuffer } = logsSubscription;
                    const { result } = logsMessage.params;
                    if (isBackfilling) {
                        addToLogsEventsBuffer(backfillBuffer, result);
                    }
                    else if (virtualId !== physicalId) {
                        this.emitAndRememberEvent(virtualId, result, getLogsBlockNumber);
                    }
                    else {
                        this.rememberEvent(virtualId, result, getLogsBlockNumber);
                    }
                    break;
                }
            }
        };
        /**
         * When the websocket connection reopens:
         *
         * 1. Resubscribe to all existing subscriptions and start backfilling
         * 2. Restart heart beat.
         *
         * This is a field arrow function in order to preserve `this` context when
         * passing the method as an event listener.
         *
         * @internal
         */
        this.handleReopen = () => {
            this.virtualIdsByPhysicalId.clear();
            const { cancel, isCancelled } = makeCancelToken();
            this.cancelBackfill = cancel;
            for (const subscription of this.virtualSubscriptionsById.values()) {
                void (() => __awaiter$5(this, void 0, void 0, function* () {
                    try {
                        yield this.resubscribeAndBackfill(isCancelled, subscription);
                    }
                    catch (error) {
                        if (!isCancelled()) {
                            console.error(`Error while backfilling "${subscription.params[0]}" subscription. Some events may be missing.`, error);
                        }
                    }
                }))();
            }
            this.startHeartbeat();
        };
        /**
         * Cancels the heartbeat and any pending backfills being performed. This is
         * called when the websocket connection goes down or is disconnected.
         *
         * This is a field arrow function in order to preserve `this` context when
         * passing the method as an event listener.
         *
         * @internal
         */
        this.stopHeartbeatAndBackfill = () => {
            if (this.heartbeatIntervalId != null) {
                clearInterval(this.heartbeatIntervalId);
                this.heartbeatIntervalId = undefined;
            }
            this.cancelBackfill();
        };
        this.apiKey = apiKey;
        // Start heartbeat and backfiller for the websocket connection.
        this.backfiller = new WebsocketBackfiller(this);
        this.addSocketListeners();
        this.startHeartbeat();
        this.cancelBackfill = noop$1;
    }
    /**
     * Overrides the `BaseProvider.getNetwork` method as implemented by ethers.js.
     *
     * This override allows the SDK to set the provider's network to values not
     * yet supported by ethers.js.
     *
     * @internal
     * @override
     */
    static getNetwork(network) {
        if (typeof network === 'string' && network in CustomNetworks) {
            return CustomNetworks[network];
        }
        // Call the standard ethers.js getNetwork method for other networks.
        return getNetwork(network);
    }
    /**
     * Overridden implementation of ethers that includes Alchemy based subscriptions.
     *
     * @param eventName Event to subscribe to
     * @param listener The listener function to call when the event is triggered.
     * @override
     * @public
     */
    // TODO: Override `Listener` type to get type autocompletions.
    on(eventName, listener) {
        return this._addEventListener(eventName, listener, false);
    }
    /**
     * Overridden implementation of ethers that includes Alchemy based
     * subscriptions. Adds a listener to the triggered for only the next
     * {@link eventName} event, after which it will be removed.
     *
     * @param eventName Event to subscribe to
     * @param listener The listener function to call when the event is triggered.
     * @override
     * @public
     */
    // TODO: Override `Listener` type to get type autocompletions.
    once(eventName, listener) {
        return this._addEventListener(eventName, listener, true);
    }
    /**
     * Removes the provided {@link listener} for the {@link eventName} event. If no
     * listener is provided, all listeners for the event will be removed.
     *
     * @param eventName Event to unlisten to.
     * @param listener The listener function to remove.
     * @override
     * @public
     */
    off(eventName, listener) {
        if (isAlchemyEvent(eventName)) {
            return this._off(eventName, listener);
        }
        else {
            return super.off(eventName, listener);
        }
    }
    /**
     * Remove all listeners for the provided {@link eventName} event. If no event
     * is provided, all events and their listeners are removed.
     *
     * @param eventName The event to remove all listeners for.
     * @override
     * @public
     */
    removeAllListeners(eventName) {
        if (eventName !== undefined && isAlchemyEvent(eventName)) {
            return this._removeAllListeners(eventName);
        }
        else {
            return super.removeAllListeners(eventName);
        }
    }
    /**
     * Returns the number of listeners for the provided {@link eventName} event. If
     * no event is provided, the total number of listeners for all events is returned.
     *
     * @param eventName The event to get the number of listeners for.
     * @public
     * @override
     */
    listenerCount(eventName) {
        if (eventName !== undefined && isAlchemyEvent(eventName)) {
            return this._listenerCount(eventName);
        }
        else {
            return super.listenerCount(eventName);
        }
    }
    /**
     * Returns an array of listeners for the provided {@link eventName} event. If
     * no event is provided, all listeners will be included.
     *
     * @param eventName The event to get the listeners for.
     * @public
     * @override
     */
    listeners(eventName) {
        if (eventName !== undefined && isAlchemyEvent(eventName)) {
            return this._listeners(eventName);
        }
        else {
            return super.listeners(eventName);
        }
    }
    /**
     * Overrides the method in `BaseProvider` in order to properly format the
     * Alchemy subscription events.
     *
     * @internal
     * @override
     */
    _addEventListener(eventName, listener, once) {
        if (isAlchemyEvent(eventName)) {
            const event = new EthersEvent(getAlchemyEventTag(eventName), listener, once);
            this._events.push(event);
            this._startEvent(event);
            return this;
        }
        else {
            return super._addEventListener(eventName, listener, once);
        }
    }
    /**
     * Overrides the `_startEvent()` method in ethers.js's
     * {@link WebSocketProvider} to include additional alchemy methods.
     *
     * @param event
     * @override
     * @internal
     */
    _startEvent(event) {
        // Check if the event type is a custom Alchemy subscription.
        const customLogicTypes = [
            ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE,
            'block',
            'filter'
        ];
        if (customLogicTypes.includes(event.type)) {
            this.customStartEvent(event);
        }
        else {
            super._startEvent(event);
        }
    }
    /**
     * Overridden from ethers.js's {@link WebSocketProvider}
     *
     * Modified in order to add mappings for backfilling.
     *
     * @internal
     * @override
     */
    _subscribe(tag, param, processFunc, event) {
        return __awaiter$5(this, void 0, void 0, function* () {
            let subIdPromise = this._subIds[tag];
            // BEGIN MODIFIED CODE
            const startingBlockNumber = yield this.getBlockNumber();
            // END MODIFIED CODE
            if (subIdPromise == null) {
                subIdPromise = Promise.all(param).then(param => {
                    return this.send('eth_subscribe', param);
                });
                this._subIds[tag] = subIdPromise;
            }
            const subId = yield subIdPromise;
            // BEGIN MODIFIED CODE
            const resolvedParams = yield Promise.all(param);
            this.virtualSubscriptionsById.set(subId, {
                event: event,
                method: 'eth_subscribe',
                params: resolvedParams,
                startingBlockNumber,
                virtualId: subId,
                physicalId: subId,
                sentEvents: [],
                isBackfilling: false,
                backfillBuffer: []
            });
            this.virtualIdsByPhysicalId.set(subId, subId);
            // END MODIFIED CODE
            this._subs[subId] = { tag, processFunc };
        });
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `BaseProvider`.
     *
     * This method is copied over directly in order to implement Alchemy's unique
     * subscription types. The only difference is that this method calls
     * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
     * order to parse the Alchemy subscription event.
     *
     * @internal
     * @override
     */
    emit(eventName, ...args) {
        if (isAlchemyEvent(eventName)) {
            let result = false;
            const stopped = [];
            // This line is the only modified line from the original method.
            const eventTag = getAlchemyEventTag(eventName);
            this._events = this._events.filter(event => {
                if (event.tag !== eventTag) {
                    return true;
                }
                setTimeout(() => {
                    event.listener.apply(this, args);
                }, 0);
                result = true;
                if (event.once) {
                    stopped.push(event);
                    return false;
                }
                return true;
            });
            stopped.forEach(event => {
                this._stopEvent(event);
            });
            return result;
        }
        else {
            return super.emit(eventName, ...args);
        }
    }
    /** @internal */
    sendBatch(parts) {
        return __awaiter$5(this, void 0, void 0, function* () {
            let nextId = 0;
            const payload = parts.map(({ method, params }) => {
                return {
                    method,
                    params,
                    jsonrpc: '2.0',
                    id: `alchemy-sdk:${nextId++}`
                };
            });
            const response = yield this.sendBatchConcurrently(payload);
            const errorResponse = response.find(r => !!r.error);
            if (errorResponse) {
                throw new Error(errorResponse.error.message);
            }
            // The ids are ascending numbers because that's what Payload Factories do.
            return response
                .sort((r1, r2) => r1.id - r2.id)
                .map(r => r.result);
        });
    }
    /** @override */
    destroy() {
        this.removeSocketListeners();
        this.stopHeartbeatAndBackfill();
        return super.destroy();
    }
    /**
     * Overrides the ether's `isCommunityResource()` method. Returns true if the
     * current api key is the default key.
     *
     * @override
     */
    isCommunityResource() {
        return this.apiKey === DEFAULT_ALCHEMY_API_KEY;
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `WebSocketProvider._stopEvent()`.
     *
     * This method is copied over directly in order to support Alchemy's
     * subscription type by allowing the provider to properly stop Alchemy's
     * subscription events.
     *
     * @internal
     */
    _stopEvent(event) {
        let tag = event.tag;
        // START MODIFIED CODE
        if (event.type === ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
            // There are remaining pending transaction listeners.
            if (this._events.filter(e => e.type === ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE).length) {
                return;
            }
            // END MODIFIED CODE
        }
        else if (event.type === 'tx') {
            // There are remaining transaction event listeners
            if (this._events.filter(e => e.type === 'tx').length) {
                return;
            }
            tag = 'tx';
        }
        else if (this.listenerCount(event.event)) {
            // There are remaining event listeners
            return;
        }
        const subId = this._subIds[tag];
        if (!subId) {
            return;
        }
        delete this._subIds[tag];
        void subId.then(subId => {
            if (!this._subs[subId]) {
                return;
            }
            delete this._subs[subId];
            void this.send('eth_unsubscribe', [subId]);
        });
    }
    /** @internal */
    addSocketListeners() {
        this._websocket.addEventListener('message', this.handleMessage);
        this._websocket.addEventListener('reopen', this.handleReopen);
        this._websocket.addEventListener('down', this.stopHeartbeatAndBackfill);
    }
    /** @internal */
    removeSocketListeners() {
        this._websocket.removeEventListener('message', this.handleMessage);
        this._websocket.removeEventListener('reopen', this.handleReopen);
        this._websocket.removeEventListener('down', this.stopHeartbeatAndBackfill);
    }
    /**
     * Reopens the backfill based on
     *
     * @param isCancelled
     * @param subscription
     * @internal
     */
    resubscribeAndBackfill(isCancelled, subscription) {
        return __awaiter$5(this, void 0, void 0, function* () {
            const { virtualId, method, params, sentEvents, backfillBuffer, startingBlockNumber } = subscription;
            subscription.isBackfilling = true;
            backfillBuffer.length = 0;
            try {
                const physicalId = yield this.send(method, params);
                throwIfCancelled(isCancelled);
                subscription.physicalId = physicalId;
                this.virtualIdsByPhysicalId.set(physicalId, virtualId);
                switch (params[0]) {
                    case 'newHeads': {
                        const backfillEvents = yield withBackoffRetries(() => withTimeout(this.backfiller.getNewHeadsBackfill(isCancelled, sentEvents, startingBlockNumber), BACKFILL_TIMEOUT), BACKFILL_RETRIES, () => !isCancelled());
                        throwIfCancelled(isCancelled);
                        const events = dedupeNewHeads([...backfillEvents, ...backfillBuffer]);
                        events.forEach(event => this.emitNewHeadsEvent(virtualId, event));
                        break;
                    }
                    case 'logs': {
                        const filter = params[1] || {};
                        const backfillEvents = yield withBackoffRetries(() => withTimeout(this.backfiller.getLogsBackfill(isCancelled, filter, sentEvents, startingBlockNumber), BACKFILL_TIMEOUT), BACKFILL_RETRIES, () => !isCancelled());
                        throwIfCancelled(isCancelled);
                        const events = dedupeLogs([...backfillEvents, ...backfillBuffer]);
                        events.forEach(event => this.emitLogsEvent(virtualId, event));
                        break;
                    }
                    default:
                        break;
                }
            }
            finally {
                subscription.isBackfilling = false;
                backfillBuffer.length = 0;
            }
        });
    }
    /** @internal */
    emitNewHeadsEvent(virtualId, result) {
        this.emitAndRememberEvent(virtualId, result, getNewHeadsBlockNumber);
    }
    /** @internal */
    emitLogsEvent(virtualId, result) {
        this.emitAndRememberEvent(virtualId, result, getLogsBlockNumber);
    }
    /**
     * Emits an event to consumers, but also remembers it in its subscriptions's
     * `sentEvents` buffer so that we can detect re-orgs if the connection drops
     * and needs to be reconnected.
     *
     * @internal
     */
    emitAndRememberEvent(virtualId, result, getBlockNumber) {
        this.rememberEvent(virtualId, result, getBlockNumber);
        const subscription = this.virtualSubscriptionsById.get(virtualId);
        if (!subscription) {
            return;
        }
        this.emitGenericEvent(subscription, result);
    }
    /** @internal */
    rememberEvent(virtualId, result, getBlockNumber) {
        const subscription = this.virtualSubscriptionsById.get(virtualId);
        if (!subscription) {
            return;
        }
        // Web3 modifies these event objects once we pass them on (changing hex
        // numbers to numbers). We want the original event, so make a defensive
        // copy.
        addToPastEventsBuffer(subscription.sentEvents, Object.assign({}, result), getBlockNumber);
    }
    /** @internal */
    emitGenericEvent(subscription, result) {
        const emitFunction = this.emitProcessFn(subscription.event);
        emitFunction(result);
    }
    /**
     * Starts a heartbeat that pings the websocket server periodically to ensure
     * that the connection stays open.
     *
     * @internal
     */
    startHeartbeat() {
        if (this.heartbeatIntervalId != null) {
            return;
        }
        this.heartbeatIntervalId = setInterval(() => __awaiter$5(this, void 0, void 0, function* () {
            try {
                yield withTimeout(this.send('net_version'), HEARTBEAT_WAIT_TIME);
            }
            catch (_a) {
                this._websocket.reconnect();
            }
        }), HEARTBEAT_INTERVAL);
    }
    /**
     * This method sends the batch concurrently as individual requests rather than
     * as a batch, which was the original implementation. The original batch logic
     * is preserved in this implementation in order for faster porting.
     *
     * @param payload
     * @internal
     */
    // TODO(cleanup): Refactor and remove usages of `sendBatch()`.
    // TODO(errors): Use allSettled() once we have more error handling.
    sendBatchConcurrently(payload) {
        return __awaiter$5(this, void 0, void 0, function* () {
            return Promise.all(payload.map(req => this.send(req.method, req.params)));
        });
    }
    /** @internal */
    customStartEvent(event) {
        if (event.type === ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
            const { fromAddress, toAddress, hashesOnly } = event;
            void this._subscribe(event.tag, ['alchemy_pendingTransactions', { fromAddress, toAddress, hashesOnly }], this.emitProcessFn(event), event);
        }
        else if (event.type === 'block') {
            void this._subscribe('block', ['newHeads'], this.emitProcessFn(event), event);
        }
        else if (event.type === 'filter') {
            void this._subscribe(event.tag, ['logs', this._getFilter(event.filter)], this.emitProcessFn(event), event);
        }
    }
    /** @internal */
    emitProcessFn(event) {
        switch (event.type) {
            case ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE:
                const { fromAddress, toAddress, hashesOnly } = event;
                return result => this.emit({
                    method: 'alchemy_pendingTransactions',
                    fromAddress,
                    toAddress,
                    hashesOnly
                }, result);
            case 'block':
                return result => {
                    const blockNumber = BigNumber.from(result.number).toNumber();
                    this._emitted.block = blockNumber;
                    this.emit('block', blockNumber);
                };
            case 'filter':
                return result => {
                    if (result.removed == null) {
                        result.removed = false;
                    }
                    this.emit(event.filter, this.formatter.filterLog(result));
                };
            default:
                throw new Error('Invalid event type to `emitProcessFn()`');
        }
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `BaseProvider.off()`.
     *
     * This method is copied over directly in order to implement Alchemy's unique
     * subscription types. The only difference is that this method calls
     * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
     * order to parse the Alchemy subscription event.
     *
     * @private
     */
    _off(eventName, listener) {
        if (listener == null) {
            return this.removeAllListeners(eventName);
        }
        const stopped = [];
        let found = false;
        const eventTag = getAlchemyEventTag(eventName);
        this._events = this._events.filter(event => {
            if (event.tag !== eventTag || event.listener != listener) {
                return true;
            }
            if (found) {
                return true;
            }
            found = true;
            stopped.push(event);
            return false;
        });
        stopped.forEach(event => {
            this._stopEvent(event);
        });
        return this;
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `BaseProvider.removeAllListeners()`.
     *
     * This method is copied over directly in order to implement Alchemy's unique
     * subscription types. The only difference is that this method calls
     * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
     * order to parse the Alchemy subscription event.
     *
     * @private
     */
    _removeAllListeners(eventName) {
        let stopped = [];
        if (eventName == null) {
            stopped = this._events;
            this._events = [];
        }
        else {
            const eventTag = getAlchemyEventTag(eventName);
            this._events = this._events.filter(event => {
                if (event.tag !== eventTag) {
                    return true;
                }
                stopped.push(event);
                return false;
            });
        }
        stopped.forEach(event => {
            this._stopEvent(event);
        });
        return this;
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `BaseProvider.listenerCount()`.
     *
     * This method is copied over directly in order to implement Alchemy's unique
     * subscription types. The only difference is that this method calls
     * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
     * order to parse the Alchemy subscription event.
     *
     * @private
     */
    _listenerCount(eventName) {
        if (!eventName) {
            return this._events.length;
        }
        const eventTag = getAlchemyEventTag(eventName);
        return this._events.filter(event => {
            return event.tag === eventTag;
        }).length;
    }
    /**
     * DO NOT MODIFY.
     *
     * Original code copied over from ether.js's `BaseProvider.listeners()`.
     *
     * This method is copied over directly in order to implement Alchemy's unique
     * subscription types. The only difference is that this method calls
     * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
     * order to parse the Alchemy subscription event.
     *
     * @private
     */
    _listeners(eventName) {
        if (eventName == null) {
            return this._events.map(event => event.listener);
        }
        const eventTag = getAlchemyEventTag(eventName);
        return this._events
            .filter(event => event.tag === eventTag)
            .map(event => event.listener);
    }
}
function getWebsocketConstructor() {
    return isNodeEnvironment() ? require('websocket').w3cwebsocket : WebSocket;
}
function isNodeEnvironment() {
    return (typeof process !== 'undefined' &&
        process != null &&
        process.versions != null &&
        process.versions.node != null);
}
// TODO(cleanup): Use class variable rather than passing `isCancelled` everywhere.
function makeCancelToken() {
    let cancelled = false;
    return { cancel: () => (cancelled = true), isCancelled: () => cancelled };
}
// TODO(cleanup): replace with SDK's backoff implementation
const MIN_RETRY_DELAY = 1000;
const RETRY_BACKOFF_FACTOR = 2;
const MAX_RETRY_DELAY = 30000;
function withBackoffRetries(f, retryCount, shouldRetry = () => true) {
    return __awaiter$5(this, void 0, void 0, function* () {
        let nextWaitTime = 0;
        let i = 0;
        while (true) {
            try {
                return yield f();
            }
            catch (error) {
                i++;
                if (i >= retryCount || !shouldRetry(error)) {
                    throw error;
                }
                yield delay(nextWaitTime);
                if (!shouldRetry(error)) {
                    throw error;
                }
                nextWaitTime =
                    nextWaitTime === 0
                        ? MIN_RETRY_DELAY
                        : Math.min(MAX_RETRY_DELAY, RETRY_BACKOFF_FACTOR * nextWaitTime);
            }
        }
    });
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
}
function getNewHeadsBlockNumber(event) {
    return fromHex(event.number);
}
function getLogsBlockNumber(event) {
    return fromHex(event.blockNumber);
}
function isResponse(message) {
    return (Array.isArray(message) ||
        (message.jsonrpc === '2.0' && message.id !== undefined));
}
function isSubscriptionEvent(message) {
    return !isResponse(message);
}
function addToNewHeadsEventsBuffer(pastEvents, event) {
    addToPastEventsBuffer(pastEvents, event, getNewHeadsBlockNumber);
}
function addToLogsEventsBuffer(pastEvents, event) {
    addToPastEventsBuffer(pastEvents, event, getLogsBlockNumber);
}
/**
 * Adds a new event to an array of events, evicting any events which are so old
 * that they will no longer feasibly be part of a reorg.
 */
function addToPastEventsBuffer(pastEvents, event, getBlockNumber) {
    const currentBlockNumber = getBlockNumber(event);
    // Find first index of an event recent enough to retain, then drop everything
    // at a lower index.
    const firstGoodIndex = pastEvents.findIndex(e => getBlockNumber(e) > currentBlockNumber - RETAINED_EVENT_BLOCK_COUNT);
    if (firstGoodIndex === -1) {
        pastEvents.length = 0;
    }
    else {
        pastEvents.splice(0, firstGoodIndex);
    }
    pastEvents.push(event);
}
function isAlchemyEvent(event) {
    return typeof event === 'object' && 'method' in event;
}
/**
 * Creates a string representation of an `alchemy_pendingTransaction`
 * subscription filter that is compatible with the ethers implementation of
 * `getEventTag()`. The method is not an exported function in ethers, which is
 * why the SDK has its own implementation.
 *
 * The event tag is then deserialized by the SDK's {@link EthersEvent} getters.
 *
 * @example
 *   ```js
 *   // Returns 'alchemy-pending-transactions:0xABC:0xDEF|0xGHI:true'
 *   const eventTag =  getAlchemyEventTag(
 *   {
 *     "method": "alchemy_pendingTransaction",
 *     "fromAddress": "0xABC",
 *     "toAddress": ["0xDEF", "0xGHI"],
 *     "hashesOnly: true
 *   });
 *   ```;
 *
 * @param event
 * @internal
 */
function getAlchemyEventTag(event) {
    if (!isAlchemyEvent(event)) {
        throw new Error('Event tag requires AlchemyEventType');
    }
    const fromAddress = serializeAddressField(event.fromAddress);
    const toAddress = serializeAddressField(event.toAddress);
    const hashesOnly = serializeBooleanField(event.hashesOnly);
    return (ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE +
        ':' +
        fromAddress +
        ':' +
        toAddress +
        ':' +
        hashesOnly);
}
function serializeAddressField(field) {
    if (field === undefined) {
        return '*';
    }
    else if (Array.isArray(field)) {
        return field.join('|');
    }
    else {
        return field;
    }
}
function serializeBooleanField(field) {
    if (field === undefined) {
        return '*';
    }
    else {
        return field.toString();
    }
}

var alchemyWebsocketProvider70d41746 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	AlchemyWebSocketProvider: AlchemyWebSocketProvider,
	getAlchemyEventTag: getAlchemyEventTag
});

module.exports = index;

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {Int} cursor_pos Expected edit position in text1 (optional)
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2, cursor_pos) {
  // Check for equality (speedup).
  if (text1 == text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  // Check cursor_pos within bounds
  if (cursor_pos < 0 || text1.length < cursor_pos) {
    cursor_pos = null;
  }

  // Trim off common prefix (speedup).
  var commonlength = diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = diff_compute_(text1, text2);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  diff_cleanupMerge(diffs);
  if (cursor_pos != null) {
    diffs = fix_cursor(diffs, cursor_pos);
  }
  diffs = fix_emoji(diffs);
  return diffs;
};


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i != -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [[DIFF_INSERT, longtext.substring(0, i)],
             [DIFF_EQUAL, shorttext],
             [DIFF_INSERT, longtext.substring(i + shorttext.length)]];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length == 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = diff_main(text1_a, text2_a);
    var diffs_b = diff_main(text1_b, text2_b);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  return diff_bisect_(text1, text2);
};


/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 != 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (x1 < text1_length && y1 < text2_length &&
             text1.charAt(x1) == text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (x2 < text1_length && y2 < text2_length &&
             text1.charAt(text1_length - x2 - 1) ==
             text2.charAt(text2_length - y2 - 1)) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
};


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = diff_main(text1a, text2a);
  var diffsb = diff_main(text1b, text2b);

  return diffs.concat(diffsb);
};


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
      var prefixLength = diff_commonPrefix(longtext.substring(i),
                                           shorttext.substring(j));
      var suffixLength = diff_commonSuffix(longtext.substring(0, i),
                                           shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(j - suffixLength, j) +
            shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
};


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 */
function diff_cleanupMerge(diffs) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if ((pointer - count_delete - count_insert) > 0 &&
                  diffs[pointer - count_delete - count_insert - 1][0] ==
                  DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] +=
                    text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL,
                                    text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixies.
            commonlength = diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length -
                  commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length -
                  commonlength);
              text_delete = text_delete.substring(0, text_delete.length -
                  commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          if (count_delete === 0) {
            diffs.splice(pointer - count_insert,
                count_delete + count_insert, [DIFF_INSERT, text_insert]);
          } else if (count_insert === 0) {
            diffs.splice(pointer - count_delete,
                count_delete + count_insert, [DIFF_DELETE, text_delete]);
          } else {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert, [DIFF_DELETE, text_delete],
                [DIFF_INSERT, text_insert]);
          }
          pointer = pointer - count_delete - count_insert +
                    (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
          diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
            diffs[pointer][1].substring(0, diffs[pointer][1].length -
                                        diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
          diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
            diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
            diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diff_cleanupMerge(diffs);
  }
};


var diff = diff_main;
diff.INSERT = DIFF_INSERT;
diff.DELETE = DIFF_DELETE;
diff.EQUAL = DIFF_EQUAL;

module.exports = diff;

/*
 * Modify a diff such that the cursor position points to the start of a change:
 * E.g.
 *   cursor_normalize_diff([[DIFF_EQUAL, 'abc']], 1)
 *     => [1, [[DIFF_EQUAL, 'a'], [DIFF_EQUAL, 'bc']]]
 *   cursor_normalize_diff([[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xyz']], 2)
 *     => [2, [[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xy'], [DIFF_DELETE, 'z']]]
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} A tuple [cursor location in the modified diff, modified diff]
 */
function cursor_normalize_diff (diffs, cursor_pos) {
  if (cursor_pos === 0) {
    return [DIFF_EQUAL, diffs];
  }
  for (var current_pos = 0, i = 0; i < diffs.length; i++) {
    var d = diffs[i];
    if (d[0] === DIFF_DELETE || d[0] === DIFF_EQUAL) {
      var next_pos = current_pos + d[1].length;
      if (cursor_pos === next_pos) {
        return [i + 1, diffs];
      } else if (cursor_pos < next_pos) {
        // copy to prevent side effects
        diffs = diffs.slice();
        // split d into two diff changes
        var split_pos = cursor_pos - current_pos;
        var d_left = [d[0], d[1].slice(0, split_pos)];
        var d_right = [d[0], d[1].slice(split_pos)];
        diffs.splice(i, 1, d_left, d_right);
        return [i + 1, diffs];
      } else {
        current_pos = next_pos;
      }
    }
  }
  throw new Error('cursor_pos is out of bounds!')
}

/*
 * Modify a diff such that the edit position is "shifted" to the proposed edit location (cursor_position).
 *
 * Case 1)
 *   Check if a naive shift is possible:
 *     [0, X], [ 1, Y] -> [ 1, Y], [0, X]    (if X + Y === Y + X)
 *     [0, X], [-1, Y] -> [-1, Y], [0, X]    (if X + Y === Y + X) - holds same result
 * Case 2)
 *   Check if the following shifts are possible:
 *     [0, 'pre'], [ 1, 'prefix'] -> [ 1, 'pre'], [0, 'pre'], [ 1, 'fix']
 *     [0, 'pre'], [-1, 'prefix'] -> [-1, 'pre'], [0, 'pre'], [-1, 'fix']
 *         ^            ^
 *         d          d_next
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} Array of diff tuples
 */
function fix_cursor (diffs, cursor_pos) {
  var norm = cursor_normalize_diff(diffs, cursor_pos);
  var ndiffs = norm[1];
  var cursor_pointer = norm[0];
  var d = ndiffs[cursor_pointer];
  var d_next = ndiffs[cursor_pointer + 1];

  if (d == null) {
    // Text was deleted from end of original string,
    // cursor is now out of bounds in new string
    return diffs;
  } else if (d[0] !== DIFF_EQUAL) {
    // A modification happened at the cursor location.
    // This is the expected outcome, so we can return the original diff.
    return diffs;
  } else {
    if (d_next != null && d[1] + d_next[1] === d_next[1] + d[1]) {
      // Case 1)
      // It is possible to perform a naive shift
      ndiffs.splice(cursor_pointer, 2, d_next, d)
      return merge_tuples(ndiffs, cursor_pointer, 2)
    } else if (d_next != null && d_next[1].indexOf(d[1]) === 0) {
      // Case 2)
      // d[1] is a prefix of d_next[1]
      // We can assume that d_next[0] !== 0, since d[0] === 0
      // Shift edit locations..
      ndiffs.splice(cursor_pointer, 2, [d_next[0], d[1]], [0, d[1]]);
      var suffix = d_next[1].slice(d[1].length);
      if (suffix.length > 0) {
        ndiffs.splice(cursor_pointer + 2, 0, [d_next[0], suffix]);
      }
      return merge_tuples(ndiffs, cursor_pointer, 3)
    } else {
      // Not possible to perform any modification
      return diffs;
    }
  }
}

/*
 * Check diff did not split surrogate pairs.
 * Ex. [0, '\uD83D'], [-1, '\uDC36'], [1, '\uDC2F'] -> [-1, '\uD83D\uDC36'], [1, '\uD83D\uDC2F']
 *     '\uD83D\uDC36' === '🐶', '\uD83D\uDC2F' === '🐯'
 *
 * @param {Array} diffs Array of diff tuples
 * @return {Array} Array of diff tuples
 */
function fix_emoji (diffs) {
  var compact = false;
  var starts_with_pair_end = function(str) {
    return str.charCodeAt(0) >= 0xDC00 && str.charCodeAt(0) <= 0xDFFF;
  }
  var ends_with_pair_start = function(str) {
    return str.charCodeAt(str.length-1) >= 0xD800 && str.charCodeAt(str.length-1) <= 0xDBFF;
  }
  for (var i = 2; i < diffs.length; i += 1) {
    if (diffs[i-2][0] === DIFF_EQUAL && ends_with_pair_start(diffs[i-2][1]) &&
        diffs[i-1][0] === DIFF_DELETE && starts_with_pair_end(diffs[i-1][1]) &&
        diffs[i][0] === DIFF_INSERT && starts_with_pair_end(diffs[i][1])) {
      compact = true;

      diffs[i-1][1] = diffs[i-2][1].slice(-1) + diffs[i-1][1];
      diffs[i][1] = diffs[i-2][1].slice(-1) + diffs[i][1];

      diffs[i-2][1] = diffs[i-2][1].slice(0, -1);
    }
  }
  if (!compact) {
    return diffs;
  }
  var fixed_diffs = [];
  for (var i = 0; i < diffs.length; i += 1) {
    if (diffs[i][1].length > 0) {
      fixed_diffs.push(diffs[i]);
    }
  }
  return fixed_diffs;
}

/*
 * Try to merge tuples with their neigbors in a given range.
 * E.g. [0, 'a'], [0, 'b'] -> [0, 'ab']
 *
 * @param {Array} diffs Array of diff tuples.
 * @param {Int} start Position of the first element to merge (diffs[start] is also merged with diffs[start - 1]).
 * @param {Int} length Number of consecutive elements to check.
 * @return {Array} Array of merged diff tuples.
 */
function merge_tuples (diffs, start, length) {
  // Check from (start-1) to (start+length).
  for (var i = start + length - 1; i >= 0 && i >= start - 1; i--) {
    if (i + 1 < diffs.length) {
      var left_d = diffs[i];
      var right_d = diffs[i+1];
      if (left_d[0] === right_d[1]) {
        diffs.splice(i, 2, [left_d[0], left_d[1] + right_d[1]]);
      }
    }
  }
  return diffs;
}

},{}],2:[function(require,module,exports){
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

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
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
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
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
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
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

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  class YArray extends Y.utils.CustomType {
    constructor (os, _model, _content) {
      super()
      this.os = os
      this._model = _model
      // Array of all the neccessary content
      this._content = _content

      // the parent of this type
      this._parent = null
      this._deepEventHandler = new Y.utils.EventListenerHandler()

      // this._debugEvents = [] // TODO: remove!!
      this.eventHandler = new Y.utils.EventHandler((op) => {
        // this._debugEvents.push(JSON.parse(JSON.stringify(op)))
        if (op.struct === 'Insert') {
          // when using indexeddb db adapter, the op could already exist (see y-js/y-indexeddb#2)
          if (this._content.some(function (c) { return Y.utils.compareIds(c.id, op.id) })) {
            // op exists
            return
          }
          let pos
          // we check op.left only!,
          // because op.right might not be defined when this is called
          if (op.left === null) {
            pos = 0
          } else {
            pos = 1 + this._content.findIndex(function (c) {
              return Y.utils.compareIds(c.id, op.left)
            })
            if (pos <= 0) {
              throw new Error('Unexpected operation!')
            }
          }
          /* (see above for new approach)
          var _e = this._content[pos]
          // when using indexeddb db adapter, the op could already exist (see y-js/y-indexeddb#2)
          // If the algorithm works correctly, the double should always exist on the correct position (pos - the computed destination)
          if (_e != null && Y.utils.compareIds(_e.id, op.id)) {
            // is already defined
            return
          }*/
          var values
          var length
          if (op.hasOwnProperty('opContent')) {
            this._content.splice(pos, 0, {
              id: op.id,
              type: op.opContent
            })
            length = 1
            let type = this.os.getType(op.opContent)
            type._parent = this._model
            values = [type]
          } else {
            var contents = op.content.map(function (c, i) {
              return {
                id: [op.id[0], op.id[1] + i],
                val: c
              }
            })
            // insert value in _content
            // It is not possible to insert more than ~2^16 elements in an Array (see #5). We handle this case explicitly
            if (contents.length < 30000) {
              this._content.splice.apply(this._content, [pos, 0].concat(contents))
            } else {
              this._content = this._content.slice(0, pos).concat(contents).concat(this._content.slice(pos))
            }
            values = op.content
            length = op.content.length
          }
          Y.utils.bubbleEvent(this, {
            type: 'insert',
            object: this,
            index: pos,
            values: values,
            length: length
          })
        } else if (op.struct === 'Delete') {
          var i = 0 // current position in _content
          for (; i < this._content.length && op.length > 0; i++) {
            var c = this._content[i]
            if (Y.utils.inDeletionRange(op, c.id)) {
              // is in deletion range!
              var delLength
              // check how many character to delete in one flush
              for (delLength = 1;
                    delLength < op.length && i + delLength < this._content.length && Y.utils.inDeletionRange(op, this._content[i + delLength].id);
                    delLength++) {}
              // last operation that will be deleted
              c = this._content[i + delLength - 1]
              // update delete operation
              op.length -= c.id[1] - op.target[1] + 1
              op.target = [c.id[0], c.id[1] + 1]
              // apply deletion & find send event
              let content = this._content.splice(i, delLength)
              let values = content.map((c) => {
                if (c.val != null) {
                  return c.val
                } else {
                  return this.os.getType(c.type)
                }
              })
              Y.utils.bubbleEvent(this, {
                type: 'delete',
                object: this,
                index: i,
                values: values,
                _content: content,
                length: delLength
              })
              // with the fresh delete op, we can continue
              // note: we don't have to increment i, because the i-th content was deleted
              // but on the other had, the (i+delLength)-th was not in deletion range
              // So we don't do i--
            }
          }
        } else {
          throw new Error('Unexpected struct!')
        }
      })
    }
    _getPathToChild (childId) {
      return this._content.findIndex(c =>
        c.type != null && Y.utils.compareIds(c.type, childId)
      )
    }
    _destroy () {
      this.eventHandler.destroy()
      this.eventHandler = null
      this._content = null
      this._model = null
      this._parent = null
      this.os = null
    }
    get length () {
      return this._content.length
    }
    get (pos) {
      if (pos == null || typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (pos >= this._content.length) {
        return undefined
      }
      if (this._content[pos].type == null) {
        return this._content[pos].val
      } else {
        return this.os.getType(this._content[pos].type)
      }
    }
    toArray () {
      return this._content.map((x, i) => {
        if (x.type != null) {
          return this.os.getType(x.type)
        } else {
          return x.val
        }
      })
    }
    push (contents) {
      return this.insert(this._content.length, contents)
    }
    insert (pos, contents) {
      if (typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (!Array.isArray(contents)) {
        throw new Error('contents must be an Array of objects!')
      }
      if (contents.length === 0) {
        return
      }
      if (pos > this._content.length || pos < 0) {
        throw new Error('This position exceeds the range of the array!')
      }
      var mostLeft = pos === 0 ? null : this._content[pos - 1].id

      var ops = []
      var prevId = mostLeft
      for (var i = 0; i < contents.length;) {
        var op = {
          left: prevId,
          origin: prevId,
          // right: mostRight,
          // NOTE: I intentionally do not define right here, because it could be deleted
          // at the time of inserting this operation (when we get the transaction),
          // and would therefore not defined in this._content
          parent: this._model,
          struct: 'Insert'
        }
        var _content = []
        var typeDefinition
        while (i < contents.length) {
          var val = contents[i++]
          typeDefinition = Y.utils.isTypeDefinition(val)
          if (!typeDefinition) {
            _content.push(val)
          } else if (_content.length > 0) {
            i-- // come back again later
            break
          } else {
            break
          }
        }
        if (_content.length > 0) {
          // content is defined
          op.content = _content
          op.id = this.os.getNextOpId(_content.length)
        } else {
          // otherwise its a type
          var typeid = this.os.getNextOpId(1)
          this.os.createType(typeDefinition, typeid)
          op.opContent = typeid
          op.id = this.os.getNextOpId(1)
        }
        ops.push(op)
        prevId = op.id
      }
      var eventHandler = this.eventHandler
      this.os.requestTransaction(function *() {
        // now we can set the right reference.
        var mostRight
        if (mostLeft != null) {
          var ml = yield* this.getInsertionCleanEnd(mostLeft)
          mostRight = ml.right
        } else {
          mostRight = (yield* this.getOperation(ops[0].parent)).start
        }
        for (var j = 0; j < ops.length; j++) {
          var op = ops[j]
          op.right = mostRight
        }
        yield* eventHandler.awaitOps(this, this.applyCreatedOperations, [ops])
      })
      // always remember to do that after this.os.requestTransaction
      // (otherwise values might contain a undefined reference to type)
      eventHandler.awaitAndPrematurelyCall(ops)
    }
    delete (pos, length) {
      if (length == null) { length = 1 }
      if (typeof length !== 'number') {
        throw new Error('length must be a number!')
      }
      if (typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (pos + length > this._content.length || pos < 0 || length < 0) {
        throw new Error('The deletion range exceeds the range of the array!')
      }
      if (length === 0) {
        return
      }
      var eventHandler = this.eventHandler
      var dels = []
      for (var i = 0; i < length; i = i + delLength) {
        var targetId = this._content[pos + i].id
        var delLength
        // how many insertions can we delete in one deletion?
        for (delLength = 1; i + delLength < length; delLength++) {
          if (!Y.utils.compareIds(this._content[pos + i + delLength].id, [targetId[0], targetId[1] + delLength])) {
            break
          }
        }
        dels.push({
          target: targetId,
          struct: 'Delete',
          length: delLength
        })
      }
      this.os.requestTransaction(function *() {
        yield* eventHandler.awaitOps(this, this.applyCreatedOperations, [dels])
      })
      // always remember to do that after this.os.requestTransaction
      // (otherwise values might contain a undefined reference to type)
      eventHandler.awaitAndPrematurelyCall(dels)
    }
    observe (f) {
      this.eventHandler.addEventListener(f)
    }
    observeDeep (f) {
      this._deepEventHandler.addEventListener(f)
    }
    unobserve (f) {
      this.eventHandler.removeEventListener(f)
    }
    unobserveDeep (f) {
      this._deepEventHandler.removeEventListener(f)
    }
    * _changed (transaction, op) {
      if (!op.deleted) {
        if (op.struct === 'Insert') {
          // update left
          var l = op.left
          var left
          while (l != null) {
            left = yield* transaction.getInsertion(l)
            if (!left.deleted) {
              break
            }
            l = left.left
          }
          op.left = l
          // if op contains opContent, initialize it
          if (op.opContent != null) {
            yield* transaction.store.initType.call(transaction, op.opContent)
          }
        }
        this.eventHandler.receivedOp(op)
      }
    }
  }

  Y.extend('Array', new Y.utils.CustomTypeDefinition({
    name: 'Array',
    class: YArray,
    struct: 'List',
    initType: function * YArrayInitializer (os, model) {
      var _content = []
      var _types = []
      yield* Y.Struct.List.map.call(this, model, function (op) {
        if (op.hasOwnProperty('opContent')) {
          _content.push({
            id: op.id,
            type: op.opContent
          })
          _types.push(op.opContent)
        } else {
          op.content.forEach(function (c, i) {
            _content.push({
              id: [op.id[0], op.id[1] + i],
              val: op.content[i]
            })
          })
        }
      })
      for (var i = 0; i < _types.length; i++) {
        var type = yield* this.store.initType.call(this, _types[i])
        type._parent = model.id
      }
      return new YArray(os, model.id, _content)
    },
    createType: function YArrayCreateType (os, model) {
      return new YArray(os, model.id, [])
    }
  }))
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}],5:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y /* :any */) {
  class YMap extends Y.utils.CustomType {
    /* ::
    _model: Id;
    os: Y.AbstractDatabase;
    map: Object;
    contents: any;
    opContents: Object;
    eventHandler: Function;
    */
    constructor (os, model, contents, opContents) {
      super()
      this._model = model.id
      this._parent = null
      this._deepEventHandler = new Y.utils.EventListenerHandler()
      this.os = os
      this.map = Y.utils.copyObject(model.map)
      this.contents = contents
      this.opContents = opContents
      this.eventHandler = new Y.utils.EventHandler(op => {
        var oldValue
        // key is the name to use to access (op)content
        var key = op.struct === 'Delete' ? op.key : op.parentSub

        // compute oldValue
        if (this.opContents[key] != null) {
          oldValue = this.os.getType(this.opContents[key])
        } else {
          oldValue = this.contents[key]
        }
        // compute op event
        if (op.struct === 'Insert') {
          if (op.left === null && !Y.utils.compareIds(op.id, this.map[key])) {
            var value
            // TODO: what if op.deleted??? I partially handles this case here.. but need to send delete event instead. somehow related to #4
            if (op.opContent != null) {
              value = this.os.getType(op.opContent)
              value._parent = this._model
              delete this.contents[key]
              if (op.deleted) {
                delete this.opContents[key]
              } else {
                this.opContents[key] = op.opContent
              }
            } else {
              value = op.content[0]
              delete this.opContents[key]
              if (op.deleted) {
                delete this.contents[key]
              } else {
                this.contents[key] = op.content[0]
              }
            }
            this.map[key] = op.id
            if (oldValue === undefined) {
              Y.utils.bubbleEvent(this, {
                name: key,
                object: this,
                type: 'add',
                value: value
              })
            } else {
              Y.utils.bubbleEvent(this, {
                name: key,
                object: this,
                oldValue: oldValue,
                type: 'update',
                value: value
              })
            }
          }
        } else if (op.struct === 'Delete') {
          if (Y.utils.compareIds(this.map[key], op.target)) {
            delete this.opContents[key]
            delete this.contents[key]
            Y.utils.bubbleEvent(this, {
              name: key,
              object: this,
              oldValue: oldValue,
              type: 'delete'
            })
          }
        } else {
          throw new Error('Unexpected Operation!')
        }
      })
    }
    _getPathToChild (childId) {
      return Object.keys(this.opContents).find(key =>
        Y.utils.compareIds(this.opContents[key], childId)
      )
    }
    _destroy () {
      this.eventHandler.destroy()
      this.eventHandler = null
      this.contents = null
      this.opContents = null
      this._model = null
      this._parent = null
      this.os = null
      this.map = null
    }
    get (key) {
      // return property.
      // if property does not exist, return null
      // if property is a type, return it
      if (key == null || typeof key !== 'string') {
        throw new Error('You must specify a key (as string)!')
      }
      if (this.opContents[key] == null) {
        return this.contents[key]
      } else {
        return this.os.getType(this.opContents[key])
      }
    }
    keys () {
      return Object.keys(this.contents).concat(Object.keys(this.opContents))
    }
    keysPrimitives () {
      return Object.keys(this.contents)
    }
    keysTypes () {
      return Object.keys(this.opContents)
    }
    /*
      If there is a primitive (not a custom type), then return it.
      Returns all primitive values, if propertyName is specified!
      Note: modifying the return value could result in inconsistencies!
        -- so make sure to copy it first!
    */
    getPrimitive (key) {
      if (key == null) {
        return Y.utils.copyObject(this.contents)
      } else if (typeof key !== 'string') {
        throw new Error('Key is expected to be a string!')
      } else {
        return this.contents[key]
      }
    }
    getType (key) {
      if (key == null || typeof key !== 'string') {
        throw new Error('You must specify a key (as string)!')
      } else if (this.opContents[key] != null) {
        return this.os.getType(this.opContents[key])
      } else {
        return null
      }
    }
    delete (key) {
      var right = this.map[key]
      if (right != null) {
        var del = {
          target: right,
          struct: 'Delete'
        }
        var eventHandler = this.eventHandler
        var modDel = Y.utils.copyObject(del)
        modDel.key = key
        this.os.requestTransaction(function *() {
          yield* eventHandler.awaitOps(this, this.applyCreatedOperations, [[del]])
        })
        // always remember to do that after this.os.requestTransaction
        // (otherwise values might contain a undefined reference to type)
        eventHandler.awaitAndPrematurelyCall([modDel])
      }
    }
    set (key, value) {
      // set property.
      // if property is a type, return it
      // if not, apply immediately on this type an call event

      var right = this.map[key] || null
      var insert /* :any */ = {
        id: this.os.getNextOpId(1),
        left: null,
        right: right,
        origin: null,
        parent: this._model,
        parentSub: key,
        struct: 'Insert'
      }
      var eventHandler = this.eventHandler
      var typeDefinition = Y.utils.isTypeDefinition(value)
      if (typeDefinition !== false) {
        var type = this.os.createType(typeDefinition)
        insert.opContent = type._model
        // construct a new type
        this.os.requestTransaction(function *() {
          yield* eventHandler.awaitOps(this, this.applyCreatedOperations, [[insert]])
        })
        // always remember to do that after this.os.requestTransaction
        // (otherwise values might contain a undefined reference to type)
        eventHandler.awaitAndPrematurelyCall([insert])
        return type
      } else {
        insert.content = [value]
        this.os.requestTransaction(function * () {
          yield* eventHandler.awaitOps(this, this.applyCreatedOperations, [[insert]])
        })
        // always remember to do that after this.os.requestTransaction
        // (otherwise values might contain a undefined reference to type)
        eventHandler.awaitAndPrematurelyCall([insert])
        return value
      }
    }
    observe (f) {
      this.eventHandler.addEventListener(f)
    }
    observeDeep (f) {
      this._deepEventHandler.addEventListener(f)
    }
    unobserve (f) {
      this.eventHandler.removeEventListener(f)
    }
    unobserveDeep (f) {
      this._deepEventHandler.removeEventListener(f)
    }
    /*
      Observe a path.

      E.g.
      ```
      o.set('textarea', Y.TextBind)
      o.observePath(['textarea'], function(t){
        // is called whenever textarea is replaced
        t.bind(textarea)
      })

      returns a function that removes the observer from the path.
    */
    observePath (path, f) {
      var self = this
      var propertyName
      function observeProperty (event) {
        // call f whenever path changes
        if (event.name === propertyName) {
          // call this also for delete events!
          f(self.get(propertyName))
        }
      }

      if (path.length < 1) {
        f(this)
        return function () {}
      } else if (path.length === 1) {
        propertyName = path[0]
        f(self.get(propertyName))
        this.observe(observeProperty)
        return function () {
          self.unobserve(f)
        }
      } else {
        var deleteChildObservers
        var resetObserverPath = function () {
          var map = self.get(path[0])
          if (!(map instanceof YMap)) {
            // its either not defined or a primitive value / not a map
            map = self.set(path[0], Y.Map)
          }
          deleteChildObservers = map.observePath(path.slice(1), f)
        }
        var observer = function (event) {
          if (event.name === path[0]) {
            if (deleteChildObservers != null) {
              deleteChildObservers()
            }
            if (event.type === 'add' || event.type === 'update') {
              resetObserverPath()
            }
            // TODO: what about the delete events?
          }
        }
        self.observe(observer)
        resetObserverPath()
        // returns a function that deletes all the child observers
        // and how to unobserve the observe from this object
        return function () {
          if (deleteChildObservers != null) {
            deleteChildObservers()
          }
          self.unobserve(observer)
        }
      }
    }
    * _changed (transaction, op) {
      if (op.struct === 'Delete') {
        if (op.key == null) {
          var target = yield* transaction.getOperation(op.target)
          op.key = target.parentSub
        }
      } else if (op.opContent != null) {
        yield* transaction.store.initType.call(transaction, op.opContent)
      }
      this.eventHandler.receivedOp(op)
    }
  }
  Y.extend('Map', new Y.utils.CustomTypeDefinition({
    name: 'Map',
    class: YMap,
    struct: 'Map',
    initType: function * YMapInitializer (os, model) {
      var contents = {}
      var opContents = {}
      var map = model.map
      for (var name in map) {
        var op = yield* this.getOperation(map[name])
        if (op.deleted) continue
        if (op.opContent != null) {
          opContents[name] = op.opContent
          var type = yield* this.store.initType.call(this, op.opContent)
          type._parent = model.id
        } else {
          contents[name] = op.content[0]
        }
      }
      return new YMap(os, model, contents, opContents)
    },
    createType: function YMapCreator (os, model) {
      return new YMap(os, model, {}, {})
    }
  }))
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}],6:[function(require,module,exports){
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

},{"./RedBlackTree.js":7}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
/* global Y, Element */
'use strict'

var diff = require('fast-diff')
var monacoIdentifierTemplate = { major: 0, minor: 0 }

function extend (Y) {
  Y.requestModules(['Array']).then(function () {
    class YText extends Y.Array.typeDefinition['class'] {
      constructor (os, _model, _content) {
        super(os, _model, _content)
        this.textfields = []
        this.aceInstances = []
        this.codeMirrorInstances = []
        this.monacoInstances = []
      }
      toString () {
        return this._content.map(function (c) {
          return c.val
        }).join('')
      }
      insert (pos, content) {
        var arr = content.split('')
        for (var i = 0; i < arr.length; i++) {
          if (/[\uD800-\uDFFF]/.test(arr[i])) {
            // is surrogate pair
            arr[i] = arr[i] + arr[i + 1]
            arr[i + 1] = ''
            i++
          }
        }
        super.insert(pos, arr)
      }
      delete (pos, length) {
        if (length == null) { length = 1 }
        if (typeof length !== 'number') {
          throw new Error('length must be a number!')
        }
        if (typeof pos !== 'number') {
          throw new Error('pos must be a number!')
        }
        if (pos + length > this._content.length || pos < 0 || length < 0) {
          throw new Error('The deletion range exceeds the range of the array!')
        }
        if (length === 0) {
          return
        }
        // This is for the case that part of a surrogate pair is deleted
        // we store surrogate pairs like this: [.., '🐇', '', ..] (string, code)
        if (this._content.length > pos + length && this._content[pos + length].val === '' && this._content[pos + length - 1].val.length === 2) {
          // case one. first part of the surrogate pair is deleted
          let token = this._content[pos + length - 1].val[0]
          super.delete(pos, length + 1)
          super.insert(pos, [token])
        } else if (pos > 0 && this._content[pos].val === '' && this._content[pos - 1].val.length === 2) {
          // case two. second part of the surrogate pair is deleted
          let token = this._content[pos - 1].val[1]
          super.delete(pos - 1, length + 1)
          super.insert(pos - 1, [token])
        } else {
          super.delete(pos, length)
        }
      }
      unbindAll () {
        this.unbindTextareaAll()
        this.unbindAceAll()
        this.unbindCodeMirrorAll()
        this.unbindMonacoAll()
      }
      // Monaco implementation
      unbindMonaco (monacoInstance) {
        var i = this.monacoInstances.findIndex(function (binding) {
          return binding.editor === monacoInstance
        })
        if (i >= 0) {
          var binding = this.monacoInstances[i]
          this.unobserve(binding.yCallback)
          binding.disposeBinding()
          this.monacoInstances.splice(i, 1)
        }
      }
      unbindMonacoAll () {
        for (let i = this.monacoInstances.length - 1; i >= 0; i--) {
          this.unbindMonaco(this.monacoInstances[i].editor)
        }
      }
      bindMonaco (monacoInstance, options) {
        var self = this
        options = options || {}

        // this function makes sure that either the
        // monaco event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }
        monacoInstance.setValue(this.toString())

        function monacoCallback (event) {
          mutualExcluse(function () {
            // compute start.. (col+row -> index position)
            // We shouldn't compute the offset on the old model..
            //    var start = monacoInstance.model.getOffsetAt({column: event.range.startColumn, lineNumber: event.range.startLineNumber})
            // So we compute the offset using the _content of this type
            for (var i = 0, line = 1; line < event.range.startLineNumber; i++) {
              if (self._content[i].val === '\n') {
                line++
              }
            }
            var start = i + event.range.startColumn - 1

            // apply the delete operation first
            if (event.rangeLength > 0) {
              self.delete(start, event.rangeLength)
            }
            // apply insert operation
            self.insert(start, event.text)
          })
        }
        var disposeBinding = monacoInstance.onDidChangeModelContent(monacoCallback).dispose

        function yCallback (event) {
          mutualExcluse(function () {
            let start = monacoInstance.model.getPositionAt(event.index)
            var end, text
            if (event.type === 'insert') {
              end = start
              text = event.values.join('')
            } else if (event.type === 'delete') {
              end = monacoInstance.model.modifyPosition(start, event.length)
              text = ''
            }
            var range = {
              startLineNumber: start.lineNumber,
              startColumn: start.column,
              endLineNumber: end.lineNumber,
              endColumn: end.column
            }
            var id = {
              major: monacoIdentifierTemplate.major,
              minor: monacoIdentifierTemplate.minor++
            }
            monacoInstance.executeEdits('Yjs', [{
              id: id,
              range: range,
              text: text,
              forceMoveMarkers: true
            }])
          })
        }
        this.observe(yCallback)
        this.monacoInstances.push({
          editor: monacoInstance,
          yCallback: yCallback,
          monacoCallback: monacoCallback,
          disposeBinding: disposeBinding
        })
      }
      // CodeMirror implementation..
      unbindCodeMirror (codeMirrorInstance) {
        var i = this.codeMirrorInstances.findIndex(function (binding) {
          return binding.editor === codeMirrorInstance
        })
        if (i >= 0) {
          var binding = this.codeMirrorInstances[i]
          this.unobserve(binding.yCallback)
          binding.editor.off('changes', binding.codeMirrorCallback)
          this.codeMirrorInstances.splice(i, 1)
        }
      }
      unbindCodeMirrorAll () {
        for (let i = this.codeMirrorInstances.length - 1; i >= 0; i--) {
          this.unbindCodeMirror(this.codeMirrorInstances[i].editor)
        }
      }
      bindCodeMirror (codeMirrorInstance, options) {
        var self = this
        options = options || {}

        // this function makes sure that either the
        // codemirror event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }
        codeMirrorInstance.setValue(this.toString())

        function codeMirrorCallback (cm, deltas) {
          mutualExcluse(function () {
            for (var i = 0; i < deltas.length; i++) {
              var delta = deltas[i]
              var start = codeMirrorInstance.indexFromPos(delta.from)
              // apply the delete operation first
              if (delta.removed.length > 0) {
                var delLength = 0
                for (var j = 0; j < delta.removed.length; j++) {
                  delLength += delta.removed[j].length
                }
                // "enter" is also a character in our case
                delLength += delta.removed.length - 1
                self.delete(start, delLength)
              }
              // apply insert operation
              self.insert(start, delta.text.join('\n'))
            }
          })
        }
        codeMirrorInstance.on('changes', codeMirrorCallback)

        function yCallback (event) {
          mutualExcluse(function () {
            let from = codeMirrorInstance.posFromIndex(event.index)
            if (event.type === 'insert') {
              let to = from
              codeMirrorInstance.replaceRange(event.values.join(''), from, to)
            } else if (event.type === 'delete') {
              let to = codeMirrorInstance.posFromIndex(event.index + event.length)
              codeMirrorInstance.replaceRange('', from, to)
            }
          })
        }
        this.observe(yCallback)
        this.codeMirrorInstances.push({
          editor: codeMirrorInstance,
          yCallback: yCallback,
          codeMirrorCallback: codeMirrorCallback
        })
      }
      unbindAce (aceInstance) {
        var i = this.aceInstances.findIndex(function (binding) {
          return binding.editor === aceInstance
        })
        if (i >= 0) {
          var binding = this.aceInstances[i]
          this.unobserve(binding.yCallback)
          binding.editor.off('change', binding.aceCallback)
          this.aceInstances.splice(i, 1)
        }
      }
      unbindAceAll () {
        for (let i = this.aceInstances.length - 1; i >= 0; i--) {
          this.unbindAce(this.aceInstances[i].editor)
        }
      }
      bindAce (aceInstance, options) {
        var self = this
        options = options || {}

        // this function makes sure that either the
        // ace event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }
        aceInstance.setValue(this.toString())

        function aceCallback (delta) {
          mutualExcluse(function () {
            var start
            var length

            var aceDocument = aceInstance.getSession().getDocument()
            if (delta.action === 'insert') {
              start = aceDocument.positionToIndex(delta.start, 0)
              self.insert(start, delta.lines.join('\n'))
            } else if (delta.action === 'remove') {
              start = aceDocument.positionToIndex(delta.start, 0)
              length = delta.lines.join('\n').length
              self.delete(start, length)
            }
          })
        }
        aceInstance.on('change', aceCallback)

        aceInstance.selection.clearSelection()

        // We don't that ace is a global variable
        // see #2
        var aceClass
        if (typeof ace !== 'undefined' && options.aceClass == null) {
          aceClass = ace // eslint-disable-line
        } else {
          aceClass = options.aceClass
        }
        var aceRequire = options.aceRequire || aceClass.require
        var Range = aceRequire('ace/range').Range

        function yCallback (event) {
          var aceDocument = aceInstance.getSession().getDocument()
          mutualExcluse(function () {
            if (event.type === 'insert') {
              let start = aceDocument.indexToPosition(event.index, 0)
              aceDocument.insert(start, event.values.join(''))
            } else if (event.type === 'delete') {
              let start = aceDocument.indexToPosition(event.index, 0)
              let end = aceDocument.indexToPosition(event.index + event.length, 0)
              var range = new Range(start.row, start.column, end.row, end.column)
              aceDocument.remove(range)
            }
          })
        }
        this.observe(yCallback)
        this.aceInstances.push({
          editor: aceInstance,
          yCallback: yCallback,
          aceCallback: aceCallback
        })
      }
      bind () {
        var e = arguments[0]
        if (e instanceof Element) {
          this.bindTextarea.apply(this, arguments)
        } else if (e != null && e.session != null && e.getSession != null && e.setValue != null) {
          this.bindAce.apply(this, arguments)
        } else if (e != null && e.posFromIndex != null && e.replaceRange != null) {
          this.bindCodeMirror.apply(this, arguments)
        } else if (e != null && e.onDidChangeModelContent != null) {
          this.bindMonaco.apply(this, arguments)
        } else {
          console.error('Cannot bind, unsupported editor!')
        }
      }
      unbindTextarea (textarea) {
        var i = this.textfields.findIndex(function (binding) {
          return binding.editor === textarea
        })
        if (i >= 0) {
          var binding = this.textfields[i]
          this.unobserve(binding.yCallback)
          var e = binding.editor
          e.removeEventListener('input', binding.eventListener)
          this.textfields.splice(i, 1)
        }
      }
      unbindTextareaAll () {
        for (let i = this.textfields.length - 1; i >= 0; i--) {
          this.unbindTextarea(this.textfields[i].editor)
        }
      }
      bindTextarea (textfield, domRoot) {
        domRoot = domRoot || window; // eslint-disable-line
        if (domRoot.getSelection == null) {
          domRoot = window; // eslint-disable-line
        }

        // don't duplicate!
        for (var t = 0; t < this.textfields.length; t++) {
          if (this.textfields[t].editor === textfield) {
            return
          }
        }
        // this function makes sure that either the
        // textfieldt event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }

        var self = this
        textfield.value = this.toString()

        var createRange, writeRange, writeContent, getContent
        if (textfield.selectionStart != null && textfield.setSelectionRange != null) {
          createRange = function (fix) {
            var left = textfield.selectionStart
            var right = textfield.selectionEnd
            if (fix != null) {
              left = fix(left)
              right = fix(right)
            }
            return {
              left: left,
              right: right
            }
          }
          writeRange = function (range) {
            writeContent(self.toString())
            textfield.setSelectionRange(range.left, range.right)
          }
          writeContent = function (content) {
            textfield.value = content
          }
          getContent = function () {
            return textfield.value
          }
        } else {
          createRange = function (fix) {
            var range = {}
            var s = domRoot.getSelection()
            var clength = textfield.textContent.length
            range.left = Math.min(s.anchorOffset, clength)
            range.right = Math.min(s.focusOffset, clength)
            if (fix != null) {
              range.left = fix(range.left)
              range.right = fix(range.right)
            }
            var editedElement = s.focusNode
            if (editedElement === textfield || editedElement === textfield.childNodes[0]) {
              range.isReal = true
            } else {
              range.isReal = false
            }
            return range
          }

          writeRange = function (range) {
            writeContent(self.toString())
            var textnode = textfield.childNodes[0]
            if (range.isReal && textnode != null) {
              if (range.left < 0) {
                range.left = 0
              }
              range.right = Math.max(range.left, range.right)
              if (range.right > textnode.length) {
                range.right = textnode.length
              }
              range.left = Math.min(range.left, range.right)
              var r = document.createRange(); // eslint-disable-line
              r.setStart(textnode, range.left)
              r.setEnd(textnode, range.right)
              var s = domRoot.getSelection(); // eslint-disable-line
              s.removeAllRanges()
              s.addRange(r)
            }
          }
          writeContent = function (content) {
            textfield.innerText = content
            /*
            var contentArray = content.replace(new RegExp('\n', 'g'), ' ').split(' '); // eslint-disable-line
            textfield.innerText = ''
            for (var i = 0; i < contentArray.length; i++) {
              var c = contentArray[i]
              textfield.innerText += c
              if (i !== contentArray.length - 1) {
                textfield.innerHTML += '&nbsp;'
              }
            }
            */
          }
          getContent = function () {
            return textfield.innerText
          }
        }
        writeContent(this.toString())

        function yCallback (event) {
          mutualExcluse(() => {
            var oPos, fix
            if (event.type === 'insert') {
              oPos = event.index
              fix = function (cursor) { // eslint-disable-line
                if (cursor <= oPos) {
                  return cursor
                } else {
                  cursor += 1
                  return cursor
                }
              }
              var r = createRange(fix)
              writeRange(r)
            } else if (event.type === 'delete') {
              oPos = event.index
              fix = function (cursor) { // eslint-disable-line
                if (cursor < oPos) {
                  return cursor
                } else {
                  cursor -= 1
                  return cursor
                }
              }
              r = createRange(fix)
              writeRange(r)
            }
          })
        }
        this.observe(yCallback)

        var textfieldObserver = function textfieldObserver () {
          mutualExcluse(function () {
            var r = createRange(function (x) { return x })
            var oldContent = self.toString()
            var content = getContent()
            var diffs = diff(oldContent, content, r.left)
            var pos = 0
            for (var i = 0; i < diffs.length; i++) {
              var d = diffs[i]
              if (d[0] === 0) { // EQUAL
                pos += d[1].length
              } else if (d[0] === -1) { // DELETE
                self.delete(pos, d[1].length)
              } else { // INSERT
                self.insert(pos, d[1])
                pos += d[1].length
              }
            }
          })
        }
        textfield.addEventListener('input', textfieldObserver)
        this.textfields.push({
          editor: textfield,
          yCallback: yCallback,
          eventListener: textfieldObserver
        })
      }
      _destroy () {
        this.unbindAll()
        this.textfields = null
        this.aceInstances = null
        super._destroy()
      }
    }
    Y.extend('Text', new Y.utils.CustomTypeDefinition({
      name: 'Text',
      class: YText,
      struct: 'List',
      initType: function * YTextInitializer (os, model) {
        var _content = []
        yield * Y.Struct.List.map.call(this, model, function (op) {
          if (op.hasOwnProperty('opContent')) {
            throw new Error('Text must not contain types!')
          } else {
            op.content.forEach(function (c, i) {
              _content.push({
                id: [op.id[0], op.id[1] + i],
                val: op.content[i]
              })
            })
          }
        })
        return new YText(os, model.id, _content)
      },
      createType: function YTextCreator (os, model) {
        return new YText(os, model.id, [])
      }
    }))
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{"fast-diff":1}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
/* global Y, MutationObserver */
'use strict'

function extend (Y) {
  Y.requestModules(['Array', 'Map']).then(function () {
    class YXml extends Y.Array.typeDefinition['class'] {
      constructor (os, _model, _content, attributes, tagname, init) {
        super(os, _model, _content)
        this.attributes = attributes
        this.dom = null
        this._domObserver = null
        this._eventListenerHandler = new Y.utils.EventListenerHandler()
        this.tagname = tagname
        if (init != null && init.dom != null) {
          this._setDom(init.dom)
        }
        super.observe(event => {
          if (event.type === 'insert') {
            this._eventListenerHandler.callEventListeners({
              type: 'childInserted',
              index: event.index,
              nodes: event.values
            })
          } else if (event.type === 'delete') {
            this._eventListenerHandler.callEventListeners({
              type: 'childRemoved',
              index: event.index,
              _content: event._content,
              values: event.values
            })
          }
        })
        attributes.observe(event => {
          if (event.type === 'update' || event.type === 'add') {
            this._eventListenerHandler.callEventListeners({
              type: 'attributeChanged',
              name: event.name,
              value: event.value
            })
          } else if (event.type === 'delete') {
            this._eventListenerHandler.callEventListeners({
              type: 'attributeRemoved',
              name: event.name
            })
          }
        })
      }
      _destroy () {
        if (this._domObserver != null) {
          this._domObserver.disconnect()
        }
        this._eventListenerHandler.destroy()
        this._eventListenerHandler = null
        super._destroy()
      }
      insert (pos, types) {
        var _types = []
        if (!Array.isArray(types)) {
          throw new Error('Expected an Array of content!')
        }
        for (var i = 0; i < types.length; i++) {
          var v = types[i]
          var t = Y.utils.isTypeDefinition(v)
          if (!(v != null && (
                       typeof v === 'string' ||
                       (t && t[0].class === YXml)
             ))) {
            throw new Error('Expected Y.Xml type or String!')
          } else if (typeof v === 'string' && v.length === 0) {
            continue // if empty string
          }
          _types.push(v)
        }
        super.insert(pos, types)
      }
      // binds to a dom element
      // Only call if dom and YXml are isomorph
      _bindToDom (dom) {
        // this function makes sure that either the
        // dom event is executed, or the yjs observer is executed
        var token = true
        var mutualExclude = f => {
          // take and process current records
          var records = this._domObserver.takeRecords()
          if (records.length > 0) {
            this._domObserverListener(records)
          }
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              // discard created records
              this._domObserver.takeRecords()
              token = true
              throw e
            }
            this._domObserver.takeRecords()
            token = true
          }
        }
        this._mutualExclude = mutualExclude
        this._domObserverListener = mutations => {
          mutualExclude(() => {
            mutations.forEach(mutation => {
              if (mutation.type === 'attributes') {
                var name = mutation.attributeName
                var val = mutation.target.getAttribute(mutation.attributeName)
                if (this.attributes.get(name) !== val) {
                  this.attributes.set(name, val)
                }
              } else if (mutation.type === 'childList') {
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                  let n = mutation.addedNodes[i]
                  if (this._content.some(function (c) { return c.dom === n })) {
                    // check if it already exists (since this method is called asynchronously)
                    continue
                  }
                  if (n instanceof window.Text && n.textContent === '') {
                    // check if textnode and empty content (sometime happens.. )
                    //   TODO - you could also check if the inserted node actually exists in the
                    //          dom (in order to cover more potential cases)
                    n.remove()
                    continue
                  }
                  // compute position
                  // special case, n.nextSibling is not yet inserted. So we find the next inserted element!
                  var pos = -1
                  var nextSibling = n.nextSibling
                  while (pos < 0) {
                    if (nextSibling == null) {
                      pos = this._content.length
                    } else {
                      pos = this._content.findIndex(function (c) { return c.dom === nextSibling })
                      nextSibling = nextSibling.nextSibling
                    }
                  }
                  var c
                  if (n instanceof window.Text) {
                    c = n.textContent
                  } else if (n instanceof window.Element) {
                    c = Y.Xml(n)
                  } else {
                    throw new Error('Unsupported XML Element found. Synchronization will no longer work!')
                  }
                  this.insert(pos, [c])
                  var content = this._content[pos]
                  content.dom = n
                }
                Array.prototype.forEach.call(mutation.removedNodes, n => {
                  var pos = this._content.findIndex(function (c) {
                    return c.dom === n
                  })
                  if (pos >= 0) {
                    this.delete(pos)
                  } else {
                    throw new Error('An unexpected condition occured (deleted node does not exist in the model)!')
                  }
                })
              }
            })
          })
        }
        this._domObserver = new MutationObserver(this._domObserverListener)
        this._domObserver.observe(dom, { attributes: true, childList: true })
        // In order to insert a new node, successor needs to be inserted
        // when c.dom can be inserted, try to insert the predecessors too
        var _tryInsertDom = (pos) => {
          var c = this._content[pos]
          var succ
          if (pos + 1 < this._content.length) {
            succ = this._content[pos + 1]
            if (succ.dom == null) throw new Error('Unexpected behavior') // shouldn't happen anymore!
          } else {
            // pseudo successor
            succ = {
              dom: null
            }
          }
          dom.insertBefore(c.dom, succ.dom)
        }
        this._tryInsertDom = _tryInsertDom
        this.observe(event => {
          mutualExclude(() => {
            if (event.type === 'attributeChanged') {
              dom.setAttribute(event.name, event.value)
            } else if (event.type === 'attributeRemoved') {
              dom.removeAttribute(event.name)
            } else if (event.type === 'childInserted') {
              if (event.nodes.length === 1 && event.nodes[0] instanceof YXml) {
                // a new xml node was inserted.
                // TODO: consider the case that nodes contains mixed text & types (currently not implemented in yjs)
                var valId = this._content[event.index].id
                if (event.nodes.length > 1) { throw new Error('This case is not handled, you\'ll run into consistency issues. Contact the developer') }
                var newNode = event.nodes[0].getDom()
                // This is called async. So we have to compute the position again
                // also mutual excluse this
                var pos
                if (event.index < this._content.length && Y.utils.compareIds(this._content[event.index].id, valId)) {
                  pos = event.index
                } else {
                  pos = this._content.findIndex(function (c) {
                    return Y.utils.compareIds(c.id, valId)
                  })
                }
                if (pos >= 0) {
                  this._content[pos].dom = newNode
                  _tryInsertDom(pos)
                }
              } else {
                for (var i = event.nodes.length - 1; i >= 0; i--) {
                  var n = event.nodes[i]
                  var textNode = new window.Text(n)
                  this._content[event.index + i].dom = textNode
                  _tryInsertDom(event.index + i)
                }
              }
            } else if (event.type === 'childRemoved') {
              event._content.forEach(function (c) {
                if (c.dom != null) {
                  c.dom.remove()
                }
              })
            }
          })
        })
        return dom
      }
      _setDom (dom) {
        if (this.dom != null) {
          throw new Error('Only call this method if you know what you are doing ;)')
        } else if (dom.__yxml != null) { // TODO do i need to check this? - no.. but for dev purps..
          throw new Error('Already bound to an YXml type')
        } else {
          dom.__yxml = this._model
          // tag is already set in constructor
          // set attributes
          for (var i = 0; i < dom.attributes.length; i++) {
            var attr = dom.attributes[i]
            this.attributes.set(attr.name, attr.value)
          }
          this.insert(0, Array.prototype.map.call(dom.childNodes, (c, i) => {
            if (c instanceof window.Element) {
              return Y.Xml(c)
            } else if (c instanceof window.Text) {
              return c.textContent
            } else {
              throw new Error('Unknown node type!')
            }
          }))
          Array.prototype.forEach.call(dom.childNodes, (dom, i) => {
            var c = this._content[i]
            c.dom = dom
          })
          this.dom = this._bindToDom(dom)
          return this.dom
        }
      }
      getDom () {
        if (this.dom == null) {
          var dom = document.createElement(this.tagname)
          dom.__yxml = this
          this.attributes.keysPrimitives().forEach(key => {
            dom.setAttribute(key, this.attributes.get(key))
          })
          for (var i = 0; i < this._content.length; i++) {
            let c = this._content[i]
            if (c.hasOwnProperty('val')) {
              c.dom = new window.Text(c.val)
            } else {
              c.dom = this.os.getType(c.type).getDom()
            }
            dom.appendChild(c.dom)
          }
          this.dom = this._bindToDom(dom)
        }
        return this.dom
      }
      observe (f) {
        this._eventListenerHandler.addEventListener(f)
      }
      unobserve (f) {
        this._eventListenerHandler.removeEventListener(f)
      }
      * _changed () {
        if (this._domObserver != null) {
          this._domObserverListener(this._domObserver.takeRecords())
        }
        yield* Y.Array.typeDefinition['class'].prototype._changed.apply(this, arguments)
      }
    }
    Y.extend('Xml', new Y.utils.CustomTypeDefinition({
      name: 'Xml',
      class: YXml,
      struct: 'List',
      parseArguments: function (arg) {
        if (typeof arg === 'string') {
          return [this, {
            tagname: arg
          }]
        } else if (arg instanceof window.Element) {
          return [this, {
            tagname: arg.tagName,
            dom: arg
          }]
        } else {
          throw new Error('Y.Xml requires an argument which is a string!')
        }
      },
      initType: function * YXmlInitializer (os, model, args) {
        var _content = []
        var _types = []
        yield* Y.Struct.List.map.call(this, model, function (op) {
          if (op.hasOwnProperty('opContent')) {
            _content.push({
              id: op.id,
              type: op.opContent
            })
            _types.push(op.opContent)
          } else {
            op.content.forEach(function (c, i) {
              _content.push({
                id: [op.id[0], op.id[1] + i],
                val: op.content[i]
              })
            })
          }
        })
        for (var i = 0; i < _types.length; i++) {
          yield* os.initType.call(this, _types[i])
        }
        // if this type is defined in y.share.*, initType is called instead of createType!
        // So we have to initialize it properly
        var properties
        if (model.id[0] === '_') {
          var typestruct = Y.Map.typeDefinition.struct
          var id = ['_', typestruct + '_' + 'Map_' + model.id[1]]
          properties = yield* os.initType.call(this, id)

          model.requires = [properties._model]
          model.info = {
            tagname: args.tagname
          }
          yield* this.setOperation(model)
        } else {
          properties = yield* os.initType.call(this, model.requires[0]) // get the only required op
        }
        return new YXml(os, model.id, _content, properties, model.info.tagname, model.info)
      },
      createType: function YXmlCreator (os, model, args) {
        var id = null
        if (model.id[0] === '_') {
          var typestruct = Y.Map.typeDefinition.struct
          id = ['_', typestruct + '_' + 'Map_' + model.id[1]]
        }
        var properties = os.createType(Y.Map(), id)
        model.info = {
          tagname: args.tagname
        }
        model.requires = [properties._model] // XML requires that 'properties' exists
        return new YXml(os, model.id, [], properties, model.info.tagname, args)
      }
    }))
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}],11:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

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

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
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

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
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
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
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
  } catch(e) {}
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
  } catch(e) {}

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

}).call(this,require('_process'))

},{"./debug":12,"_process":3}],12:[function(require,module,exports){

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
exports.humanize = require('ms');

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
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
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
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
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

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
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

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
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

},{"ms":2}],13:[function(require,module,exports){
function canRead (auth) { return auth === 'read' || auth === 'write' }
function canWrite (auth) { return auth === 'write' }

module.exports = function (Y/* :any */) {
  class AbstractConnector {
    /* ::
    y: YConfig;
    role: SyncRole;
    connections: Object;
    isSynced: boolean;
    userEventListeners: Array<Function>;
    whenSyncedListeners: Array<Function>;
    currentSyncTarget: ?UserId;
    syncingClients: Array<UserId>;
    forwardToSyncingClients: boolean;
    debug: boolean;
    syncStep2: Promise;
    userId: UserId;
    send: Function;
    broadcast: Function;
    broadcastOpBuffer: Array<Operation>;
    protocolVersion: number;
    */
    /*
      opts contains the following information:
       role : String Role of this client ("master" or "slave")
       userId : String Uniquely defines the user.
       debug: Boolean Whether to print debug messages (optional)
    */
    constructor (y, opts) {
      this.y = y
      if (opts == null) {
        opts = {}
      }
      // Prefer to receive untransformed operations. This does only work if
      // this client receives operations from only one other client.
      // In particular, this does not work with y-webrtc.
      // It will work with y-websockets-client
      if (opts.role == null || opts.role === 'master') {
        this.role = 'master'
      } else if (opts.role === 'slave') {
        this.role = 'slave'
      } else {
        throw new Error("Role must be either 'master' or 'slave'!")
      }
      this.log = Y.debug('y:connector')
      this.logMessage = Y.debug('y:connector-message')
      this.y.db.forwardAppliedOperations = opts.forwardAppliedOperations || false
      this.role = opts.role
      this.connections = {}
      this.isSynced = false
      this.userEventListeners = []
      this.whenSyncedListeners = []
      this.currentSyncTarget = null
      this.syncingClients = []
      this.forwardToSyncingClients = opts.forwardToSyncingClients !== false
      this.debug = opts.debug === true
      this.syncStep2 = Promise.resolve()
      this.broadcastOpBuffer = []
      this.protocolVersion = 11
      this.authInfo = opts.auth || null
      this.checkAuth = opts.checkAuth || function () { return Promise.resolve('write') } // default is everyone has write access
      if (opts.generateUserId === true) {
        this.setUserId(Y.utils.generateGuid())
      }
    }
    resetAuth (auth) {
      if (this.authInfo !== auth) {
        this.authInfo = auth
        this.broadcast({
          type: 'auth',
          auth: this.authInfo
        })
      }
    }
    reconnect () {
      this.log('reconnecting..')
      return this.y.db.startGarbageCollector()
    }
    disconnect () {
      this.log('discronnecting..')
      this.connections = {}
      this.isSynced = false
      this.currentSyncTarget = null
      this.syncingClients = []
      this.whenSyncedListeners = []
      this.y.db.stopGarbageCollector()
      return this.y.db.whenTransactionsFinished()
    }
    repair () {
      this.log('Repairing the state of Yjs. This can happen if messages get lost, and Yjs detects that something is wrong. If this happens often, please report an issue here: https://github.com/y-js/yjs/issues')
      for (var name in this.connections) {
        this.connections[name].isSynced = false
      }
      this.isSynced = false
      this.currentSyncTarget = null
      this.findNextSyncTarget()
    }
    setUserId (userId) {
      if (this.userId == null) {
        this.log('Set userId to "%s"', userId)
        this.userId = userId
        return this.y.db.setUserId(userId)
      } else {
        return null
      }
    }
    onUserEvent (f) {
      this.userEventListeners.push(f)
    }
    removeUserEventListener (f) {
      this.userEventListeners = this.userEventListeners.filter(g => { f !== g })
    }
    userLeft (user) {
      if (this.connections[user] != null) {
        this.log('User left: %s', user)
        delete this.connections[user]
        if (user === this.currentSyncTarget) {
          this.currentSyncTarget = null
          this.findNextSyncTarget()
        }
        this.syncingClients = this.syncingClients.filter(function (cli) {
          return cli !== user
        })
        for (var f of this.userEventListeners) {
          f({
            action: 'userLeft',
            user: user
          })
        }
      }
    }
    userJoined (user, role) {
      if (role == null) {
        throw new Error('You must specify the role of the joined user!')
      }
      if (this.connections[user] != null) {
        throw new Error('This user already joined!')
      }
      this.log('User joined: %s', user)
      this.connections[user] = {
        isSynced: false,
        role: role
      }
      for (var f of this.userEventListeners) {
        f({
          action: 'userJoined',
          user: user,
          role: role
        })
      }
      if (this.currentSyncTarget == null) {
        this.findNextSyncTarget()
      }
    }
    // Execute a function _when_ we are connected.
    // If not connected, wait until connected
    whenSynced (f) {
      if (this.isSynced) {
        f()
      } else {
        this.whenSyncedListeners.push(f)
      }
    }
    findNextSyncTarget () {
      if (this.currentSyncTarget != null) {
        return // "The current sync has not finished!"
      }

      var syncUser = null
      for (var uid in this.connections) {
        if (!this.connections[uid].isSynced) {
          syncUser = uid
          break
        }
      }
      var conn = this
      if (syncUser != null) {
        this.currentSyncTarget = syncUser
        this.y.db.requestTransaction(function *() {
          var stateSet = yield* this.getStateSet()
          var deleteSet = yield* this.getDeleteSet()
          var answer = {
            type: 'sync step 1',
            stateSet: stateSet,
            deleteSet: deleteSet,
            protocolVersion: conn.protocolVersion,
            auth: conn.authInfo
          }
          conn.send(syncUser, answer)
        })
      } else {
        if (!conn.isSynced) {
          this.y.db.requestTransaction(function *() {
            if (!conn.isSynced) {
              // it is crucial that isSynced is set at the time garbageCollectAfterSync is called
              conn.isSynced = true
              yield* this.garbageCollectAfterSync()
              // call whensynced listeners
              for (var f of conn.whenSyncedListeners) {
                f()
              }
              conn.whenSyncedListeners = []
            }
          })
        }
      }
    }
    send (uid, message) {
      this.log('Send \'%s\' to %s', message.type, uid)
      this.logMessage('Message: %j', message)
    }
    broadcast (message) {
      this.log('Broadcast \'%s\'', message.type)
      this.logMessage('Message: %j', message)
    }
    /*
      Buffer operations, and broadcast them when ready.
    */
    broadcastOps (ops) {
      ops = ops.map(function (op) {
        return Y.Struct[op.struct].encode(op)
      })
      var self = this
      function broadcastOperations () {
        if (self.broadcastOpBuffer.length > 0) {
          self.broadcast({
            type: 'update',
            ops: self.broadcastOpBuffer
          })
          self.broadcastOpBuffer = []
        }
      }
      if (this.broadcastOpBuffer.length === 0) {
        this.broadcastOpBuffer = ops
        if (this.y.db.transactionInProgress) {
          this.y.db.whenTransactionsFinished().then(broadcastOperations)
        } else {
          setTimeout(broadcastOperations, 0)
        }
      } else {
        this.broadcastOpBuffer = this.broadcastOpBuffer.concat(ops)
      }
    }
    /*
      You received a raw message, and you know that it is intended for Yjs. Then call this function.
    */
    receiveMessage (sender/* :UserId */, message/* :Message */) {
      if (sender === this.userId) {
        return Promise.resolve()
      }
      this.log('Receive \'%s\' from %s', message.type, sender)
      this.logMessage('Message: %j', message)
      if (message.protocolVersion != null && message.protocolVersion !== this.protocolVersion) {
        this.log(
          `You tried to sync with a yjs instance that has a different protocol version
          (You: ${this.protocolVersion}, Client: ${message.protocolVersion}).
          The sync was stopped. You need to upgrade your dependencies (especially Yjs & the Connector)!
          `)
        this.send(sender, {
          type: 'sync stop',
          protocolVersion: this.protocolVersion
        })
        return Promise.reject('Incompatible protocol version')
      }
      if (message.auth != null && this.connections[sender] != null) {
        // authenticate using auth in message
        var auth = this.checkAuth(message.auth, this.y, sender)
        this.connections[sender].auth = auth
        auth.then(auth => {
          for (var f of this.userEventListeners) {
            f({
              action: 'userAuthenticated',
              user: sender,
              auth: auth
            })
          }
        })
      } else if (this.connections[sender] != null && this.connections[sender].auth == null) {
        // authenticate without otherwise
        this.connections[sender].auth = this.checkAuth(null, this.y, sender)
      }
      if (this.connections[sender] != null && this.connections[sender].auth != null) {
        return this.connections[sender].auth.then((auth) => {
          if (message.type === 'sync step 1' && canRead(auth)) {
            let conn = this
            let m = message

            this.y.db.requestTransaction(function *() {
              var currentStateSet = yield* this.getStateSet()
              if (canWrite(auth)) {
                yield* this.applyDeleteSet(m.deleteSet)
              }

              var ds = yield* this.getDeleteSet()
              var answer = {
                type: 'sync step 2',
                stateSet: currentStateSet,
                deleteSet: ds,
                protocolVersion: this.protocolVersion,
                auth: this.authInfo
              }
              answer.os = yield* this.getOperations(m.stateSet)
              conn.send(sender, answer)
              if (this.forwardToSyncingClients) {
                conn.syncingClients.push(sender)
                setTimeout(function () {
                  conn.syncingClients = conn.syncingClients.filter(function (cli) {
                    return cli !== sender
                  })
                  conn.send(sender, {
                    type: 'sync done'
                  })
                }, 5000) // TODO: conn.syncingClientDuration)
              } else {
                conn.send(sender, {
                  type: 'sync done'
                })
              }
            })
          } else if (message.type === 'sync step 2' && canWrite(auth)) {
            var db = this.y.db
            var defer = {}
            defer.promise = new Promise(function (resolve) {
              defer.resolve = resolve
            })
            this.syncStep2 = defer.promise
            let m /* :MessageSyncStep2 */ = message
            db.requestTransaction(function * () {
              yield* this.applyDeleteSet(m.deleteSet)
              if (m.osUntransformed != null) {
                yield* this.applyOperationsUntransformed(m.osUntransformed, m.stateSet)
              } else {
                this.store.apply(m.os)
              }
              /*
               * This just sends the complete hb after some time
               * Mostly for debugging..
               *
              db.requestTransaction(function * () {
                var ops = yield* this.getOperations(m.stateSet)
                if (ops.length > 0) {
                  if (!broadcastHB) { // TODO: consider to broadcast here..
                    conn.send(sender, {
                      type: 'update',
                      ops: ops
                    })
                  } else {
                    // broadcast only once!
                    conn.broadcastOps(ops)
                  }
                }
              })
              */
              defer.resolve()
            })
          } else if (message.type === 'sync done') {
            var self = this
            this.syncStep2.then(function () {
              self._setSyncedWith(sender)
            })
          } else if (message.type === 'update' && canWrite(auth)) {
            if (this.forwardToSyncingClients) {
              for (var client of this.syncingClients) {
                this.send(client, message)
              }
            }
            if (this.y.db.forwardAppliedOperations) {
              var delops = message.ops.filter(function (o) {
                return o.struct === 'Delete'
              })
              if (delops.length > 0) {
                this.broadcastOps(delops)
              }
            }
            this.y.db.apply(message.ops)
          }
        })
      } else {
        return Promise.reject('Unable to deliver message')
      }
    }
    _setSyncedWith (user) {
      var conn = this.connections[user]
      if (conn != null) {
        conn.isSynced = true
      }
      if (user === this.currentSyncTarget) {
        this.currentSyncTarget = null
        this.findNextSyncTarget()
      }
    }
    /*
      Currently, the HB encodes operations as JSON. For the moment I want to keep it
      that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
      too much overhead. Y is very likely to get changed a lot in the future

      Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
      we encode the JSON as XML.

      When the HB support encoding as XML, the format should look pretty much like this.

      does not support primitive values as array elements
      expects an ltx (less than xml) object
    */
    parseMessageFromXml (m/* :any */) {
      function parseArray (node) {
        for (var n of node.children) {
          if (n.getAttribute('isArray') === 'true') {
            return parseArray(n)
          } else {
            return parseObject(n)
          }
        }
      }
      function parseObject (node/* :any */) {
        var json = {}
        for (var attrName in node.attrs) {
          var value = node.attrs[attrName]
          var int = parseInt(value, 10)
          if (isNaN(int) || ('' + int) !== value) {
            json[attrName] = value
          } else {
            json[attrName] = int
          }
        }
        for (var n/* :any */ in node.children) {
          var name = n.name
          if (n.getAttribute('isArray') === 'true') {
            json[name] = parseArray(n)
          } else {
            json[name] = parseObject(n)
          }
        }
        return json
      }
      parseObject(m)
    }
    /*
      encode message in xml
      we use string because Strophe only accepts an "xml-string"..
      So {a:4,b:{c:5}} will look like
      <y a="4">
        <b c="5"></b>
      </y>
      m - ltx element
      json - Object
    */
    encodeMessageToXml (msg, obj) {
      // attributes is optional
      function encodeObject (m, json) {
        for (var name in json) {
          var value = json[name]
          if (name == null) {
            // nop
          } else if (value.constructor === Object) {
            encodeObject(m.c(name), value)
          } else if (value.constructor === Array) {
            encodeArray(m.c(name), value)
          } else {
            m.setAttribute(name, value)
          }
        }
      }
      function encodeArray (m, array) {
        m.setAttribute('isArray', 'true')
        for (var e of array) {
          if (e.constructor === Object) {
            encodeObject(m.c('array-element'), e)
          } else {
            encodeArray(m.c('array-element'), e)
          }
        }
      }
      if (obj.constructor === Object) {
        encodeObject(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else if (obj.constructor === Array) {
        encodeArray(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else {
        throw new Error("I can't encode this json!")
      }
    }
  }
  Y.AbstractConnector = AbstractConnector
}

},{}],14:[function(require,module,exports){
/* global getRandom, async */
'use strict'

module.exports = function (Y) {
  var globalRoom = {
    users: {},
    buffers: {},
    removeUser: function (user) {
      for (var i in this.users) {
        this.users[i].userLeft(user)
      }
      delete this.users[user]
      delete this.buffers[user]
    },
    addUser: function (connector) {
      this.users[connector.userId] = connector
      this.buffers[connector.userId] = {}
      for (var uname in this.users) {
        if (uname !== connector.userId) {
          var u = this.users[uname]
          u.userJoined(connector.userId, 'master')
          connector.userJoined(u.userId, 'master')
        }
      }
    },
    whenTransactionsFinished: function () {
      var self = this
      return new Promise(function (resolve, reject) {
        // The connector first has to send the messages to the db.
        // Wait for the checkAuth-function to resolve
        // The test lib only has a simple checkAuth function: `() => Promise.resolve()`
        // Just add a function to the event-queue, in order to wait for the event.
        // TODO: this may be buggy in test applications (but it isn't be for real-life apps)
        setTimeout(function () {
          var ps = []
          for (var name in self.users) {
            ps.push(self.users[name].y.db.whenTransactionsFinished())
          }
          Promise.all(ps).then(resolve, reject)
        }, 10)
      })
    },
    flushOne: function flushOne () {
      var bufs = []
      for (var receiver in globalRoom.buffers) {
        let buff = globalRoom.buffers[receiver]
        var push = false
        for (let sender in buff) {
          if (buff[sender].length > 0) {
            push = true
            break
          }
        }
        if (push) {
          bufs.push(receiver)
        }
      }
      if (bufs.length > 0) {
        var userId = getRandom(bufs)
        let buff = globalRoom.buffers[userId]
        let sender = getRandom(Object.keys(buff))
        var m = buff[sender].shift()
        if (buff[sender].length === 0) {
          delete buff[sender]
        }
        var user = globalRoom.users[userId]
        return user.receiveMessage(m[0], m[1]).then(function () {
          return user.y.db.whenTransactionsFinished()
        }, function () {})
      } else {
        return false
      }
    },
    flushAll: function () {
      return new Promise(function (resolve) {
        // flushes may result in more created operations,
        // flush until there is nothing more to flush
        function nextFlush () {
          var c = globalRoom.flushOne()
          if (c) {
            while (c) {
              c = globalRoom.flushOne()
            }
            globalRoom.whenTransactionsFinished().then(nextFlush)
          } else {
            c = globalRoom.flushOne()
            if (c) {
              c.then(function () {
                globalRoom.whenTransactionsFinished().then(nextFlush)
              })
            } else {
              resolve()
            }
          }
        }
        globalRoom.whenTransactionsFinished().then(nextFlush)
      })
    }
  }
  Y.utils.globalRoom = globalRoom

  var userIdCounter = 0

  class Test extends Y.AbstractConnector {
    constructor (y, options) {
      if (options === undefined) {
        throw new Error('Options must not be undefined!')
      }
      options.role = 'master'
      options.forwardToSyncingClients = false
      super(y, options)
      this.setUserId((userIdCounter++) + '').then(() => {
        globalRoom.addUser(this)
      })
      this.globalRoom = globalRoom
      this.syncingClientDuration = 0
    }
    receiveMessage (sender, m) {
      return super.receiveMessage(sender, JSON.parse(JSON.stringify(m)))
    }
    send (userId, message) {
      var buffer = globalRoom.buffers[userId]
      if (buffer != null) {
        if (buffer[this.userId] == null) {
          buffer[this.userId] = []
        }
        buffer[this.userId].push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    broadcast (message) {
      for (var key in globalRoom.buffers) {
        var buff = globalRoom.buffers[key]
        if (buff[this.userId] == null) {
          buff[this.userId] = []
        }
        buff[this.userId].push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    isDisconnected () {
      return globalRoom.users[this.userId] == null
    }
    reconnect () {
      if (this.isDisconnected()) {
        globalRoom.addUser(this)
        super.reconnect()
      }
      return Y.utils.globalRoom.flushAll()
    }
    disconnect () {
      var waitForMe = Promise.resolve()
      if (!this.isDisconnected()) {
        globalRoom.removeUser(this.userId)
        waitForMe = super.disconnect()
      }
      var self = this
      return waitForMe.then(function () {
        return self.y.db.whenTransactionsFinished()
      })
    }
    flush () {
      var self = this
      return async(function * () {
        var buff = globalRoom.buffers[self.userId]
        while (Object.keys(buff).length > 0) {
          var sender = getRandom(Object.keys(buff))
          var m = buff[sender].shift()
          if (buff[sender].length === 0) {
            delete buff[sender]
          }
          yield this.receiveMessage(m[0], m[1])
        }
        yield self.whenTransactionsFinished()
      })
    }
  }

  Y.Test = Test
}

},{}],15:[function(require,module,exports){
/* @flow */
'use strict'

module.exports = function (Y /* :any */) {
  /*
    Partial definition of an OperationStore.
    TODO: name it Database, operation store only holds operations.

    A database definition must alse define the following methods:
    * logTable() (optional)
      - show relevant information information in a table
    * requestTransaction(makeGen)
      - request a transaction
    * destroy()
      - destroy the database
  */
  class AbstractDatabase {
    /* ::
    y: YConfig;
    forwardAppliedOperations: boolean;
    listenersById: Object;
    listenersByIdExecuteNow: Array<Object>;
    listenersByIdRequestPending: boolean;
    initializedTypes: Object;
    whenUserIdSetListener: ?Function;
    waitingTransactions: Array<Transaction>;
    transactionInProgress: boolean;
    executeOrder: Array<Object>;
    gc1: Array<Struct>;
    gc2: Array<Struct>;
    gcTimeout: number;
    gcInterval: any;
    garbageCollect: Function;
    executeOrder: Array<any>; // for debugging only
    userId: UserId;
    opClock: number;
    transactionsFinished: ?{promise: Promise, resolve: any};
    transact: (x: ?Generator) => any;
    */
    constructor (y, opts) {
      this.y = y
      this.dbOpts = opts
      var os = this
      this.userId = null
      var resolve
      this.userIdPromise = new Promise(function (r) {
        resolve = r
      })
      this.userIdPromise.resolve = resolve
      // whether to broadcast all applied operations (insert & delete hook)
      this.forwardAppliedOperations = false
      // E.g. this.listenersById[id] : Array<Listener>
      this.listenersById = {}
      // Execute the next time a transaction is requested
      this.listenersByIdExecuteNow = []
      // A transaction is requested
      this.listenersByIdRequestPending = false
      /* To make things more clear, the following naming conventions:
         * ls : we put this.listenersById on ls
         * l : Array<Listener>
         * id : Id (can't use as property name)
         * sid : String (converted from id via JSON.stringify
                         so we can use it as a property name)

        Always remember to first overwrite
        a property before you iterate over it!
      */
      // TODO: Use ES7 Weak Maps. This way types that are no longer user,
      // wont be kept in memory.
      this.initializedTypes = {}
      this.waitingTransactions = []
      this.transactionInProgress = false
      this.transactionIsFlushed = false
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        this.executeOrder = []
      }
      this.gc1 = [] // first stage
      this.gc2 = [] // second stage -> after that, remove the op

      function garbageCollect () {
        return os.whenTransactionsFinished().then(function () {
          if (os.gc1.length > 0 || os.gc2.length > 0) {
            if (!os.y.connector.isSynced) {
              console.warn('gc should be empty when not synced!')
            }
            return new Promise((resolve) => {
              os.requestTransaction(function * () {
                if (os.y.connector != null && os.y.connector.isSynced) {
                  for (var i = 0; i < os.gc2.length; i++) {
                    var oid = os.gc2[i]
                    yield* this.garbageCollectOperation(oid)
                  }
                  os.gc2 = os.gc1
                  os.gc1 = []
                }
                // TODO: Use setInterval here instead (when garbageCollect is called several times there will be several timeouts..)
                if (os.gcTimeout > 0) {
                  os.gcInterval = setTimeout(garbageCollect, os.gcTimeout)
                }
                resolve()
              })
            })
          } else {
            // TODO: see above
            if (os.gcTimeout > 0) {
              os.gcInterval = setTimeout(garbageCollect, os.gcTimeout)
            }
            return Promise.resolve()
          }
        })
      }
      this.garbageCollect = garbageCollect
      this.startGarbageCollector()

      this.repairCheckInterval = !opts.repairCheckInterval ? 6000 : opts.repairCheckInterval
      this.opsReceivedTimestamp = new Date()
      this.startRepairCheck()
    }
    startGarbageCollector () {
      this.gc = this.dbOpts.gc == null || this.dbOpts.gc
      if (this.gc) {
        this.gcTimeout = !this.dbOpts.gcTimeout ? 50000 : this.dbOpts.gcTimeout
      } else {
        this.gcTimeout = -1
      }
      if (this.gcTimeout > 0) {
        this.garbageCollect()
      }
    }
    startRepairCheck () {
      var os = this
      if (this.repairCheckInterval > 0) {
        this.repairCheckIntervalHandler = setInterval(function repairOnMissingOperations () {
          /*
            Case 1. No ops have been received in a while (new Date() - os.opsReceivedTimestamp > os.repairCheckInterval)
              - 1.1 os.listenersById is empty. Then the state was correct the whole time. -> Nothing to do (nor to update)
              - 1.2 os.listenersById is not empty.
                      * Then the state was incorrect for at least {os.repairCheckInterval} seconds.
                      * -> Remove everything in os.listenersById and sync again (connector.repair())
            Case 2. An op has been received in the last {os.repairCheckInterval } seconds.
                    It is not yet necessary to check for faulty behavior. Everything can still resolve itself. Wait for more messages.
                    If nothing was received for a while and os.listenersById is still not emty, we are in case 1.2
                    -> Do nothing

            Baseline here is: we really only have to catch case 1.2..
          */
          if (
            new Date() - os.opsReceivedTimestamp > os.repairCheckInterval &&
            Object.keys(os.listenersById).length > 0 // os.listenersById is not empty
          ) {
            // haven't received operations for over {os.repairCheckInterval} seconds, resend state vector
            os.listenersById = {}
            os.opsReceivedTimestamp = new Date() // update so you don't send repair several times in a row
            os.y.connector.repair()
          }
        }, this.repairCheckInterval)
      }
    }
    stopRepairCheck () {
      clearInterval(this.repairCheckIntervalHandler)
    }
    queueGarbageCollector (id) {
      if (this.y.connector.isSynced && this.gc) {
        this.gc1.push(id)
      }
    }
    emptyGarbageCollector () {
      return new Promise(resolve => {
        var check = () => {
          if (this.gc1.length > 0 || this.gc2.length > 0) {
            this.garbageCollect().then(check)
          } else {
            resolve()
          }
        }
        setTimeout(check, 0)
      })
    }
    addToDebug () {
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        var command /* :string */ = Array.prototype.map.call(arguments, function (s) {
          if (typeof s === 'string') {
            return s
          } else {
            return JSON.stringify(s)
          }
        }).join('').replace(/"/g, "'").replace(/,/g, ', ').replace(/:/g, ': ')
        this.executeOrder.push(command)
      }
    }
    getDebugData () {
      console.log(this.executeOrder.join('\n'))
    }
    stopGarbageCollector () {
      var self = this
      this.gc = false
      this.gcTimeout = -1
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          var ungc /* :Array<Struct> */ = self.gc1.concat(self.gc2)
          self.gc1 = []
          self.gc2 = []
          for (var i = 0; i < ungc.length; i++) {
            var op = yield* this.getOperation(ungc[i])
            if (op != null) {
              delete op.gc
              yield* this.setOperation(op)
            }
          }
          resolve()
        })
      })
    }
    /*
      Try to add to GC.

      TODO: rename this function

      Rulez:
      * Only gc if this user is online & gc turned on
      * The most left element in a list must not be gc'd.
        => There is at least one element in the list

      returns true iff op was added to GC
    */
    * addToGarbageCollector (op, left) {
      if (
        op.gc == null &&
        op.deleted === true &&
        this.store.gc &&
        this.store.y.connector.isSynced
      ) {
        var gc = false
        if (left != null && left.deleted === true) {
          gc = true
        } else if (op.content != null && op.content.length > 1) {
          op = yield* this.getInsertionCleanStart([op.id[0], op.id[1] + 1])
          gc = true
        }
        if (gc) {
          op.gc = true
          yield* this.setOperation(op)
          this.store.queueGarbageCollector(op.id)
          return true
        }
      }
      return false
    }
    removeFromGarbageCollector (op) {
      function filter (o) {
        return !Y.utils.compareIds(o, op.id)
      }
      this.gc1 = this.gc1.filter(filter)
      this.gc2 = this.gc2.filter(filter)
      delete op.gc
    }
    destroyTypes () {
      for (var key in this.initializedTypes) {
        var type = this.initializedTypes[key]
        if (type._destroy != null) {
          type._destroy()
        } else {
          console.error('The type you included does not provide destroy functionality, it will remain in memory (updating your packages will help).')
        }
      }
    }
    * destroy () {
      clearInterval(this.gcInterval)
      this.gcInterval = null
      this.stopRepairCheck()
    }
    setUserId (userId) {
      if (!this.userIdPromise.inProgress) {
        this.userIdPromise.inProgress = true
        var self = this
        self.requestTransaction(function * () {
          self.userId = userId
          var state = yield* this.getState(userId)
          self.opClock = state.clock
          self.userIdPromise.resolve(userId)
        })
      }
      return this.userIdPromise
    }
    whenUserIdSet (f) {
      this.userIdPromise.then(f)
    }
    getNextOpId (numberOfIds) {
      if (numberOfIds == null) {
        throw new Error('getNextOpId expects the number of created ids to create!')
      } else if (this.userId == null) {
        throw new Error('OperationStore not yet initialized!')
      } else {
        var id = [this.userId, this.opClock]
        this.opClock += numberOfIds
        return id
      }
    }
    /*
      Apply a list of operations.

      * we save a timestamp, because we received new operations that could resolve ops in this.listenersById (see this.startRepairCheck)
      * get a transaction
      * check whether all Struct.*.requiredOps are in the OS
      * check if it is an expected op (otherwise wait for it)
      * check if was deleted, apply a delete operation after op was applied
    */
    apply (ops) {
      this.opsReceivedTimestamp = new Date()
      for (var i = 0; i < ops.length; i++) {
        var o = ops[i]
        if (o.id == null || o.id[0] !== this.y.connector.userId) {
          var required = Y.Struct[o.struct].requiredOps(o)
          if (o.requires != null) {
            required = required.concat(o.requires)
          }
          this.whenOperationsExist(required, o)
        }
      }
    }
    /*
      op is executed as soon as every operation requested is available.
      Note that Transaction can (and should) buffer requests.
    */
    whenOperationsExist (ids, op) {
      if (ids.length > 0) {
        let listener = {
          op: op,
          missing: ids.length
        }

        for (let i = 0; i < ids.length; i++) {
          let id = ids[i]
          let sid = JSON.stringify(id)
          let l = this.listenersById[sid]
          if (l == null) {
            l = []
            this.listenersById[sid] = l
          }
          l.push(listener)
        }
      } else {
        this.listenersByIdExecuteNow.push({
          op: op
        })
      }

      if (this.listenersByIdRequestPending) {
        return
      }

      this.listenersByIdRequestPending = true
      var store = this

      this.requestTransaction(function * () {
        var exeNow = store.listenersByIdExecuteNow
        store.listenersByIdExecuteNow = []

        var ls = store.listenersById
        store.listenersById = {}

        store.listenersByIdRequestPending = false

        for (let key = 0; key < exeNow.length; key++) {
          let o = exeNow[key].op
          yield* store.tryExecute.call(this, o)
        }

        for (var sid in ls) {
          var l = ls[sid]
          var id = JSON.parse(sid)
          var op
          if (typeof id[1] === 'string') {
            op = yield* this.getOperation(id)
          } else {
            op = yield* this.getInsertion(id)
          }
          if (op == null) {
            store.listenersById[sid] = l
          } else {
            for (let i = 0; i < l.length; i++) {
              let listener = l[i]
              let o = listener.op
              if (--listener.missing === 0) {
                yield* store.tryExecute.call(this, o)
              }
            }
          }
        }
      })
    }
    /*
      Actually execute an operation, when all expected operations are available.
    */
    /* :: // TODO: this belongs somehow to transaction
    store: Object;
    getOperation: any;
    isGarbageCollected: any;
    addOperation: any;
    whenOperationsExist: any;
    */
    * tryExecute (op) {
      this.store.addToDebug('yield* this.store.tryExecute.call(this, ', JSON.stringify(op), ')')
      if (op.struct === 'Delete') {
        yield* Y.Struct.Delete.execute.call(this, op)
        // this is now called in Transaction.deleteOperation!
        // yield* this.store.operationAdded(this, op)
      } else {
        // check if this op was defined
        var defined = yield* this.getInsertion(op.id)
        while (defined != null && defined.content != null) {
          // check if this op has a longer content in the case it is defined
          if (defined.id[1] + defined.content.length < op.id[1] + op.content.length) {
            var overlapSize = defined.content.length - (op.id[1] - defined.id[1])
            op.content.splice(0, overlapSize)
            op.id = [op.id[0], op.id[1] + overlapSize]
            op.left = Y.utils.getLastId(defined)
            op.origin = op.left
            defined = yield* this.getOperation(op.id) // getOperation suffices here
          } else {
            break
          }
        }
        if (defined == null) {
          var opid = op.id
          var isGarbageCollected = yield* this.isGarbageCollected(opid)
          if (!isGarbageCollected) {
            // TODO: reduce number of get / put calls for op ..
            yield* Y.Struct[op.struct].execute.call(this, op)
            yield* this.addOperation(op)
            yield* this.store.operationAdded(this, op)
            // operationAdded can change op..
            op = yield* this.getOperation(opid)
            // if insertion, try to combine with left
            yield* this.tryCombineWithLeft(op)
          }
        }
      }
    }
    /*
     * Called by a transaction when an operation is added.
     * This function is especially important for y-indexeddb, where several instances may share a single database.
     * Every time an operation is created by one instance, it is send to all other instances and operationAdded is called
     *
     * If it's not a Delete operation:
     *   * Checks if another operation is executable (listenersById)
     *   * Update state, if possible
     *
     * Always:
     *   * Call type
     */
    * operationAdded (transaction, op) {
      if (op.struct === 'Delete') {
        var type = this.initializedTypes[JSON.stringify(op.targetParent)]
        if (type != null) {
          yield* type._changed(transaction, op)
        }
      } else {
        // increase SS
        yield* transaction.updateState(op.id[0])
        var opLen = op.content != null ? op.content.length : 1
        for (let i = 0; i < opLen; i++) {
          // notify whenOperation listeners (by id)
          var sid = JSON.stringify([op.id[0], op.id[1] + i])
          var l = this.listenersById[sid]
          delete this.listenersById[sid]
          if (l != null) {
            for (var key in l) {
              var listener = l[key]
              if (--listener.missing === 0) {
                this.whenOperationsExist([], listener.op)
              }
            }
          }
        }
        var t = this.initializedTypes[JSON.stringify(op.parent)]

        // if parent is deleted, mark as gc'd and return
        if (op.parent != null) {
          var parentIsDeleted = yield* transaction.isDeleted(op.parent)
          if (parentIsDeleted) {
            yield* transaction.deleteList(op.id)
            return
          }
        }

        // notify parent, if it was instanciated as a custom type
        if (t != null) {
          let o = Y.utils.copyOperation(op)
          yield* t._changed(transaction, o)
        }
        if (!op.deleted) {
          // Delete if DS says this is actually deleted
          var len = op.content != null ? op.content.length : 1
          var startId = op.id // You must not use op.id in the following loop, because op will change when deleted
            // TODO: !! console.log('TODO: change this before commiting')
          for (let i = 0; i < len; i++) {
            var id = [startId[0], startId[1] + i]
            var opIsDeleted = yield* transaction.isDeleted(id)
            if (opIsDeleted) {
              var delop = {
                struct: 'Delete',
                target: id
              }
              yield* this.tryExecute.call(transaction, delop)
            }
          }
        }
      }
    }
    whenTransactionsFinished () {
      if (this.transactionInProgress) {
        if (this.transactionsFinished == null) {
          var resolve
          var promise = new Promise(function (r) {
            resolve = r
          })
          this.transactionsFinished = {
            resolve: resolve,
            promise: promise
          }
        }
        return this.transactionsFinished.promise
      } else {
        return Promise.resolve()
      }
    }
    // Check if there is another transaction request.
    // * the last transaction is always a flush :)
    getNextRequest () {
      if (this.waitingTransactions.length === 0) {
        if (this.transactionIsFlushed) {
          this.transactionInProgress = false
          this.transactionIsFlushed = false
          if (this.transactionsFinished != null) {
            this.transactionsFinished.resolve()
            this.transactionsFinished = null
          }
          return null
        } else {
          this.transactionIsFlushed = true
          return function * () {
            yield* this.flush()
          }
        }
      } else {
        this.transactionIsFlushed = false
        return this.waitingTransactions.shift()
      }
    }
    requestTransaction (makeGen/* :any */, callImmediately) {
      this.waitingTransactions.push(makeGen)
      if (!this.transactionInProgress) {
        this.transactionInProgress = true
        setTimeout(() => {
          this.transact(this.getNextRequest())
        }, 0)
      }
    }
    /*
      Get a created/initialized type.
    */
    getType (id) {
      return this.initializedTypes[JSON.stringify(id)]
    }
    /*
      Init type. This is called when a remote operation is retrieved, and transformed to a type
      TODO: delete type from store.initializedTypes[id] when corresponding id was deleted!
    */
    * initType (id, args) {
      var sid = JSON.stringify(id)
      var t = this.store.initializedTypes[sid]
      if (t == null) {
        var op/* :MapStruct | ListStruct */ = yield* this.getOperation(id)
        if (op != null) {
          t = yield* Y[op.type].typeDefinition.initType.call(this, this.store, op, args)
          this.store.initializedTypes[sid] = t
        }
      }
      return t
    }
    /*
     Create type. This is called when the local user creates a type (which is a synchronous action)
    */
    createType (typedefinition, id) {
      var structname = typedefinition[0].struct
      id = id || this.getNextOpId(1)
      var op = Y.Struct[structname].create(id)
      op.type = typedefinition[0].name

      this.requestTransaction(function * () {
        if (op.id[0] === '_') {
          yield* this.setOperation(op)
        } else {
          yield* this.applyCreatedOperations([op])
        }
      })
      var t = Y[op.type].typeDefinition.createType(this, op, typedefinition[1])
      this.initializedTypes[JSON.stringify(op.id)] = t
      return t
    }
  }
  Y.AbstractDatabase = AbstractDatabase
}

},{}],16:[function(require,module,exports){
/* @flow */
'use strict'

/*
 An operation also defines the structure of a type. This is why operation and
 structure are used interchangeably here.

 It must be of the type Object. I hope to achieve some performance
 improvements when working on databases that support the json format.

 An operation must have the following properties:

 * encode
     - Encode the structure in a readable format (preferably string- todo)
 * decode (todo)
     - decode structure to json
 * execute
     - Execute the semantics of an operation.
 * requiredOps
     - Operations that are required to execute this operation.
*/
module.exports = function (Y/* :any */) {
  var Struct = {
    /* This is the only operation that is actually not a structure, because
    it is not stored in the OS. This is why it _does not_ have an id

    op = {
      target: Id
    }
    */
    Delete: {
      encode: function (op) {
        return {
          target: op.target,
          length: op.length || 0,
          struct: 'Delete'
        }
      },
      requiredOps: function (op) {
        return [] // [op.target]
      },
      execute: function * (op) {
        return yield* this.deleteOperation(op.target, op.length || 1)
      }
    },
    Insert: {
      /* {
          content: [any],
          opContent: Id,
          id: Id,
          left: Id,
          origin: Id,
          right: Id,
          parent: Id,
          parentSub: string (optional), // child of Map type
        }
      */
      encode: function (op/* :Insertion */) /* :Insertion */ {
        // TODO: you could not send the "left" property, then you also have to
        // "op.left = null" in $execute or $decode
        var e/* :any */ = {
          id: op.id,
          left: op.left,
          right: op.right,
          origin: op.origin,
          parent: op.parent,
          struct: op.struct
        }
        if (op.parentSub != null) {
          e.parentSub = op.parentSub
        }
        if (op.hasOwnProperty('opContent')) {
          e.opContent = op.opContent
        } else {
          e.content = op.content.slice()
        }

        return e
      },
      requiredOps: function (op) {
        var ids = []
        if (op.left != null) {
          ids.push(op.left)
        }
        if (op.right != null) {
          ids.push(op.right)
        }
        if (op.origin != null && !Y.utils.compareIds(op.left, op.origin)) {
          ids.push(op.origin)
        }
        // if (op.right == null && op.left == null) {
        ids.push(op.parent)

        if (op.opContent != null) {
          ids.push(op.opContent)
        }
        return ids
      },
      getDistanceToOrigin: function * (op) {
        if (op.left == null) {
          return 0
        } else {
          var d = 0
          var o = yield* this.getInsertion(op.left)
          while (!Y.utils.matchesId(o, op.origin)) {
            d++
            if (o.left == null) {
              break
            } else {
              o = yield* this.getInsertion(o.left)
            }
          }
          return d
        }
      },
      /*
      # $this has to find a unique position between origin and the next known character
      # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
      #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
      #         o2,o3 and o4 origin is 1 (the position of o2)
      #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
      #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
      #         therefore $this would be always to the right of o3
      # case 2: $origin < $o.origin
      #         if current $this insert_position > $o origin: $this ins
      #         else $insert_position will not change
      #         (maybe we encounter case 1 later, then this will be to the right of $o)
      # case 3: $origin > $o.origin
      #         $this insert_position is to the left of $o (forever!)
      */
      execute: function * (op) {
        var i // loop counter

        // during this function some ops may get split into two pieces (e.g. with getInsertionCleanEnd)
        // We try to merge them later, if possible
        var tryToRemergeLater = []

        if (op.origin != null) { // TODO: !== instead of !=
          // we save in origin that op originates in it
          // we need that later when we eventually garbage collect origin (see transaction)
          var origin = yield* this.getInsertionCleanEnd(op.origin)
          if (origin.originOf == null) {
            origin.originOf = []
          }
          origin.originOf.push(op.id)
          yield* this.setOperation(origin)
          if (origin.right != null) {
            tryToRemergeLater.push(origin.right)
          }
        }
        var distanceToOrigin = i = yield* Struct.Insert.getDistanceToOrigin.call(this, op) // most cases: 0 (starts from 0)

        // now we begin to insert op in the list of insertions..
        var o
        var parent
        var start

        // find o. o is the first conflicting operation
        if (op.left != null) {
          o = yield* this.getInsertionCleanEnd(op.left)
          if (!Y.utils.compareIds(op.left, op.origin) && o.right != null) {
            // only if not added previously
            tryToRemergeLater.push(o.right)
          }
          o = (o.right == null) ? null : yield* this.getOperation(o.right)
        } else { // left == null
          parent = yield* this.getOperation(op.parent)
          let startId = op.parentSub ? parent.map[op.parentSub] : parent.start
          start = startId == null ? null : yield* this.getOperation(startId)
          o = start
        }

        // make sure to split op.right if necessary (also add to tryCombineWithLeft)
        if (op.right != null) {
          tryToRemergeLater.push(op.right)
          yield* this.getInsertionCleanStart(op.right)
        }

        // handle conflicts
        while (true) {
          if (o != null && !Y.utils.compareIds(o.id, op.right)) {
            var oOriginDistance = yield* Struct.Insert.getDistanceToOrigin.call(this, o)
            if (oOriginDistance === i) {
              // case 1
              if (o.id[0] < op.id[0]) {
                op.left = Y.utils.getLastId(o)
                distanceToOrigin = i + 1 // just ignore o.content.length, doesn't make a difference
              }
            } else if (oOriginDistance < i) {
              // case 2
              if (i - distanceToOrigin <= oOriginDistance) {
                op.left = Y.utils.getLastId(o)
                distanceToOrigin = i + 1 // just ignore o.content.length, doesn't make a difference
              }
            } else {
              break
            }
            i++
            if (o.right != null) {
              o = yield* this.getInsertion(o.right)
            } else {
              o = null
            }
          } else {
            break
          }
        }

        // reconnect..
        var left = null
        var right = null
        if (parent == null) {
          parent = yield* this.getOperation(op.parent)
        }

        // reconnect left and set right of op
        if (op.left != null) {
          left = yield* this.getInsertion(op.left)
          // link left
          op.right = left.right
          left.right = op.id

          yield* this.setOperation(left)
        } else {
          // set op.right from parent, if necessary
          op.right = op.parentSub ? parent.map[op.parentSub] || null : parent.start
        }
        // reconnect right
        if (op.right != null) {
          // TODO: wanna connect right too?
          right = yield* this.getOperation(op.right)
          right.left = Y.utils.getLastId(op)

          // if right exists, and it is supposed to be gc'd. Remove it from the gc
          if (right.gc != null) {
            if (right.content != null && right.content.length > 1) {
              right = yield* this.getInsertionCleanEnd(right.id)
            }
            this.store.removeFromGarbageCollector(right)
          }
          yield* this.setOperation(right)
        }

        // update parents .map/start/end properties
        if (op.parentSub != null) {
          if (left == null) {
            parent.map[op.parentSub] = op.id
            yield* this.setOperation(parent)
          }
          // is a child of a map struct.
          // Then also make sure that only the most left element is not deleted
          // We do not call the type in this case (this is what the third parameter is for)
          if (op.right != null) {
            yield* this.deleteOperation(op.right, 1, true)
          }
          if (op.left != null) {
            yield* this.deleteOperation(op.id, 1, true)
          }
        } else {
          if (right == null || left == null) {
            if (right == null) {
              parent.end = Y.utils.getLastId(op)
            }
            if (left == null) {
              parent.start = op.id
            }
            yield* this.setOperation(parent)
          }
        }

        // try to merge original op.left and op.origin
        for (i = 0; i < tryToRemergeLater.length; i++) {
          var m = yield* this.getOperation(tryToRemergeLater[i])
          yield* this.tryCombineWithLeft(m)
        }
      }
    },
    List: {
      /*
      {
        start: null,
        end: null,
        struct: "List",
        type: "",
        id: this.os.getNextOpId(1)
      }
      */
      create: function (id) {
        return {
          start: null,
          end: null,
          struct: 'List',
          id: id
        }
      },
      encode: function (op) {
        var e = {
          struct: 'List',
          id: op.id,
          type: op.type
        }
        if (op.requires != null) {
          e.requires = op.requires
        }
        if (op.info != null) {
          e.info = op.info
        }
        return e
      },
      requiredOps: function () {
        /*
        var ids = []
        if (op.start != null) {
          ids.push(op.start)
        }
        if (op.end != null){
          ids.push(op.end)
        }
        return ids
        */
        return []
      },
      execute: function * (op) {
        op.start = null
        op.end = null
      },
      ref: function * (op, pos) {
        if (op.start == null) {
          return null
        }
        var res = null
        var o = yield* this.getOperation(op.start)

        while (true) {
          if (!o.deleted) {
            res = o
            pos--
          }
          if (pos >= 0 && o.right != null) {
            o = yield* this.getOperation(o.right)
          } else {
            break
          }
        }
        return res
      },
      map: function * (o, f) {
        o = o.start
        var res = []
        while (o != null) { // TODO: change to != (at least some convention)
          var operation = yield* this.getOperation(o)
          if (!operation.deleted) {
            res.push(f(operation))
          }
          o = operation.right
        }
        return res
      }
    },
    Map: {
      /*
        {
          map: {},
          struct: "Map",
          type: "",
          id: this.os.getNextOpId(1)
        }
      */
      create: function (id) {
        return {
          id: id,
          map: {},
          struct: 'Map'
        }
      },
      encode: function (op) {
        var e = {
          struct: 'Map',
          type: op.type,
          id: op.id,
          map: {} // overwrite map!!
        }
        if (op.requires != null) {
          e.requires = op.requires
        }
        if (op.info != null) {
          e.info = op.info
        }
        return e
      },
      requiredOps: function () {
        return []
      },
      execute: function * () {},
      /*
        Get a property by name
      */
      get: function * (op, name) {
        var oid = op.map[name]
        if (oid != null) {
          var res = yield* this.getOperation(oid)
          if (res == null || res.deleted) {
            return void 0
          } else if (res.opContent == null) {
            return res.content[0]
          } else {
            return yield* this.getType(res.opContent)
          }
        }
      }
    }
  }
  Y.Struct = Struct
}

},{}],17:[function(require,module,exports){
/* @flow */
'use strict'

/*
  Partial definition of a transaction

  A transaction provides all the the async functionality on a database.

  By convention, a transaction has the following properties:
  * ss for StateSet
  * os for OperationStore
  * ds for DeleteStore

  A transaction must also define the following methods:
  * checkDeleteStoreForState(state)
    - When increasing the state of a user, an operation with an higher id
      may already be garbage collected, and therefore it will never be received.
      update the state to reflect this knowledge. This won't call a method to save the state!
  * getDeleteSet(id)
    - Get the delete set in a readable format:
      {
        "userX": [
          [5,1], // starting from position 5, one operations is deleted
          [9,4]  // starting from position 9, four operations are deleted
        ],
        "userY": ...
      }
  * getOpsFromDeleteSet(ds) -- TODO: just call this.deleteOperation(id) here
    - get a set of deletions that need to be applied in order to get to
      achieve the state of the supplied ds
  * setOperation(op)
    - write `op` to the database.
      Note: this is allowed to return an in-memory object.
      E.g. the Memory adapter returns the object that it has in-memory.
      Changing values on this object will be stored directly in the database
      without calling this function. Therefore,
      setOperation may have no functionality in some adapters. This also has
      implications on the way we use operations that were served from the database.
      We try not to call copyObject, if not necessary.
  * addOperation(op)
    - add an operation to the database.
      This may only be called once for every op.id
      Must return a function that returns the next operation in the database (ordered by id)
  * getOperation(id)
  * removeOperation(id)
    - remove an operation from the database. This is called when an operation
      is garbage collected.
  * setState(state)
    - `state` is of the form
      {
        user: "1",
        clock: 4
      } <- meaning that we have four operations from user "1"
           (with these id's respectively: 0, 1, 2, and 3)
  * getState(user)
  * getStateVector()
    - Get the state of the OS in the form
    [{
      user: "userX",
      clock: 11
    },
     ..
    ]
  * getStateSet()
    - Get the state of the OS in the form
    {
      "userX": 11,
      "userY": 22
    }
   * getOperations(startSS)
     - Get the all the operations that are necessary in order to achive the
       stateSet of this user, starting from a stateSet supplied by another user
   * makeOperationReady(ss, op)
     - this is called only by `getOperations(startSS)`. It makes an operation
       applyable on a given SS.
*/
module.exports = function (Y/* :any */) {
  class TransactionInterface {
    /* ::
    store: Y.AbstractDatabase;
    ds: Store;
    os: Store;
    ss: Store;
    */
    /*
      Apply operations that this user created (no remote ones!)
        * does not check for Struct.*.requiredOps()
        * also broadcasts it through the connector
    */
    * applyCreatedOperations (ops) {
      var send = []
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        yield* this.store.tryExecute.call(this, op)
        if (op.id == null || typeof op.id[1] !== 'string') {
          send.push(Y.Struct[op.struct].encode(op))
        }
      }
      if (send.length > 0) { // TODO: && !this.store.forwardAppliedOperations (but then i don't send delete ops)
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcastOps(send)
      }
    }

    * deleteList (start) {
      while (start != null) {
        start = yield* this.getOperation(start)
        if (!start.gc) {
          start.gc = true
          start.deleted = true
          yield* this.setOperation(start)
          var delLength = start.content != null ? start.content.length : 1
          yield* this.markDeleted(start.id, delLength)
          if (start.opContent != null) {
            yield* this.deleteOperation(start.opContent)
          }
          this.store.queueGarbageCollector(start.id)
        }
        start = start.right
      }
    }

    /*
      Mark an operation as deleted, and add it to the GC, if possible.
    */
    * deleteOperation (targetId, length, preventCallType) /* :Generator<any, any, any> */ {
      if (length == null) {
        length = 1
      }
      yield* this.markDeleted(targetId, length)
      while (length > 0) {
        var callType = false
        var target = yield* this.os.findWithUpperBound([targetId[0], targetId[1] + length - 1])
        var targetLength = target != null && target.content != null ? target.content.length : 1
        if (target == null || target.id[0] !== targetId[0] || target.id[1] + targetLength <= targetId[1]) {
          // does not exist or is not in the range of the deletion
          target = null
          length = 0
        } else {
          // does exist, check if it is too long
          if (!target.deleted) {
            if (target.id[1] < targetId[1]) {
              // starts to the left of the deletion range
              target = yield* this.getInsertionCleanStart(targetId)
              targetLength = target.content.length // must have content property!
            }
            if (target.id[1] + targetLength > targetId[1] + length) {
              // ends to the right of the deletion range
              target = yield* this.getInsertionCleanEnd([targetId[0], targetId[1] + length - 1])
              targetLength = target.content.length
            }
          }
          length = target.id[1] - targetId[1]
        }

        if (target != null) {
          if (!target.deleted) {
            callType = true
            // set deleted & notify type
            target.deleted = true
            // delete containing lists
            if (target.start != null) {
              // TODO: don't do it like this .. -.-
              yield* this.deleteList(target.start)
              // yield* this.deleteList(target.id) -- do not gc itself because this may still get referenced
            }
            if (target.map != null) {
              for (var name in target.map) {
                yield* this.deleteList(target.map[name])
              }
              // TODO: here to..  (see above)
              // yield* this.deleteList(target.id) -- see above
            }
            if (target.opContent != null) {
              yield* this.deleteOperation(target.opContent)
              // target.opContent = null
            }
            if (target.requires != null) {
              for (var i = 0; i < target.requires.length; i++) {
                yield* this.deleteOperation(target.requires[i])
              }
            }
          }
          var left
          if (target.left != null) {
            left = yield* this.getInsertion(target.left)
          } else {
            left = null
          }

          // set here because it was deleted and/or gc'd
          yield* this.setOperation(target)

          /*
            Check if it is possible to add right to the gc.
            Because this delete can't be responsible for left being gc'd,
            we don't have to add left to the gc..
          */
          var right
          if (target.right != null) {
            right = yield* this.getOperation(target.right)
          } else {
            right = null
          }
          if (callType && !preventCallType) {
            yield* this.store.operationAdded(this, {
              struct: 'Delete',
              target: target.id,
              length: targetLength,
              targetParent: target.parent
            })
          }
          // need to gc in the end!
          yield* this.store.addToGarbageCollector.call(this, target, left)
          if (right != null) {
            yield* this.store.addToGarbageCollector.call(this, right, target)
          }
        }
      }
    }
    /*
      Mark an operation as deleted&gc'd
    */
    * markGarbageCollected (id, len) {
      // this.mem.push(["gc", id]);
      this.store.addToDebug('yield* this.markGarbageCollected(', id, ', ', len, ')')
      var n = yield* this.markDeleted(id, len)
      if (n.id[1] < id[1] && !n.gc) {
        // un-extend left
        var newlen = n.len - (id[1] - n.id[1])
        n.len -= newlen
        yield* this.ds.put(n)
        n = {id: id, len: newlen, gc: false}
        yield* this.ds.put(n)
      }
      // get prev&next before adding a new operation
      var prev = yield* this.ds.findPrev(id)
      var next = yield* this.ds.findNext(id)

      if (id[1] + len < n.id[1] + n.len && !n.gc) {
        // un-extend right
        yield* this.ds.put({id: [id[0], id[1] + len], len: n.len - len, gc: false})
        n.len = len
      }
      // set gc'd
      n.gc = true
      // can extend left?
      if (
        prev != null &&
        prev.gc &&
        Y.utils.compareIds([prev.id[0], prev.id[1] + prev.len], n.id)
      ) {
        prev.len += n.len
        yield* this.ds.delete(n.id)
        n = prev
        // ds.put n here?
      }
      // can extend right?
      if (
        next != null &&
        next.gc &&
        Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id)
      ) {
        n.len += next.len
        yield* this.ds.delete(next.id)
      }
      yield* this.ds.put(n)
      yield* this.updateState(n.id[0])
    }
    /*
      Mark an operation as deleted.

      returns the delete node
    */
    * markDeleted (id, length) {
      if (length == null) {
        length = 1
      }
      // this.mem.push(["del", id]);
      var n = yield* this.ds.findWithUpperBound(id)
      if (n != null && n.id[0] === id[0]) {
        if (n.id[1] <= id[1] && id[1] <= n.id[1] + n.len) {
          // id is in n's range
          var diff = id[1] + length - (n.id[1] + n.len) // overlapping right
          if (diff > 0) {
            // id+length overlaps n
            if (!n.gc) {
              n.len += diff
            } else {
              diff = n.id[1] + n.len - id[1] // overlapping left (id till n.end)
              if (diff < length) {
                // a partial deletion
                n = {id: [id[0], id[1] + diff], len: length - diff, gc: false}
                yield* this.ds.put(n)
              } else {
                // already gc'd
                throw new Error('Cannot happen! (it dit though.. :()')
                // return n
              }
            }
          } else {
            // no overlapping, already deleted
            return n
          }
        } else {
          // cannot extend left (there is no left!)
          n = {id: id, len: length, gc: false}
          yield* this.ds.put(n) // TODO: you double-put !!
        }
      } else {
        // cannot extend left
        n = {id: id, len: length, gc: false}
        yield* this.ds.put(n)
      }
      // can extend right?
      var next = yield* this.ds.findNext(n.id)
      if (
        next != null &&
        n.id[0] === next.id[0] &&
        n.id[1] + n.len >= next.id[1]
      ) {
        diff = n.id[1] + n.len - next.id[1] // from next.start to n.end
        while (diff >= 0) {
          // n overlaps with next
          if (next.gc) {
            // gc is stronger, so reduce length of n
            n.len -= diff
            if (diff >= next.len) {
              // delete the missing range after next
              diff = diff - next.len // missing range after next
              if (diff > 0) {
                yield* this.ds.put(n) // unneccessary? TODO!
                yield* this.markDeleted([next.id[0], next.id[1] + next.len], diff)
              }
            }
            break
          } else {
            // we can extend n with next
            if (diff > next.len) {
              // n is even longer than next
              // get next.next, and try to extend it
              var _next = yield* this.ds.findNext(next.id)
              yield* this.ds.delete(next.id)
              if (_next == null || n.id[0] !== _next.id[0]) {
                break
              } else {
                next = _next
                diff = n.id[1] + n.len - next.id[1] // from next.start to n.end
                // continue!
              }
            } else {
              // n just partially overlaps with next. extend n, delete next, and break this loop
              n.len += next.len - diff
              yield* this.ds.delete(next.id)
              break
            }
          }
        }
      }
      yield* this.ds.put(n)
      return n
    }
    /*
      Call this method when the client is connected&synced with the
      other clients (e.g. master). This will query the database for
      operations that can be gc'd and add them to the garbage collector.
    */
    * garbageCollectAfterSync () {
      if (this.store.gc1.length > 0 || this.store.gc2.length > 0) {
        console.warn('gc should be empty after sync')
      }
      if (!this.store.gc) {
        return
      }
      yield* this.os.iterate(this, null, null, function * (op) {
        if (op.gc) {
          delete op.gc
          yield* this.setOperation(op)
        }
        if (op.parent != null) {
          var parentDeleted = yield* this.isDeleted(op.parent)
          if (parentDeleted) {
            op.gc = true
            if (!op.deleted) {
              yield* this.markDeleted(op.id, op.content != null ? op.content.length : 1)
              op.deleted = true
              if (op.opContent != null) {
                yield* this.deleteOperation(op.opContent)
              }
              if (op.requires != null) {
                for (var i = 0; i < op.requires.length; i++) {
                  yield* this.deleteOperation(op.requires[i])
                }
              }
            }
            yield* this.setOperation(op)
            this.store.gc1.push(op.id) // this is ok becaues its shortly before sync (otherwise use queueGarbageCollector!)
            return
          }
        }
        if (op.deleted) {
          var left = null
          if (op.left != null) {
            left = yield* this.getInsertion(op.left)
          }
          yield* this.store.addToGarbageCollector.call(this, op, left)
        }
      })
    }
    /*
      Really remove an op and all its effects.
      The complicated case here is the Insert operation:
      * reset left
      * reset right
      * reset parent.start
      * reset parent.end
      * reset origins of all right ops
    */
    * garbageCollectOperation (id) {
      this.store.addToDebug('yield* this.garbageCollectOperation(', id, ')')
      var o = yield* this.getOperation(id)
      yield* this.markGarbageCollected(id, (o != null && o.content != null) ? o.content.length : 1) // always mark gc'd
      // if op exists, then clean that mess up..
      if (o != null) {
        var deps = []
        if (o.opContent != null) {
          deps.push(o.opContent)
        }
        if (o.requires != null) {
          deps = deps.concat(o.requires)
        }
        for (var i = 0; i < deps.length; i++) {
          var dep = yield* this.getOperation(deps[i])
          if (dep != null) {
            if (!dep.deleted) {
              yield* this.deleteOperation(dep.id)
              dep = yield* this.getOperation(dep.id)
            }
            dep.gc = true
            yield* this.setOperation(dep)
            this.store.queueGarbageCollector(dep.id)
          } else {
            yield* this.markGarbageCollected(deps[i], 1)
          }
        }

        // remove gc'd op from the left op, if it exists
        if (o.left != null) {
          var left = yield* this.getInsertion(o.left)
          left.right = o.right
          yield* this.setOperation(left)
        }
        // remove gc'd op from the right op, if it exists
        // also reset origins of right ops
        if (o.right != null) {
          var right = yield* this.getOperation(o.right)
          right.left = o.left
          yield* this.setOperation(right)

          if (o.originOf != null && o.originOf.length > 0) {
            // find new origin of right ops
            // origin is the first left deleted operation
            var neworigin = o.left
            var neworigin_ = null
            while (neworigin != null) {
              neworigin_ = yield* this.getInsertion(neworigin)
              if (neworigin_.deleted) {
                break
              }
              neworigin = neworigin_.left
            }

            // reset origin of all right ops (except first right - duh!),

            /* ** The following code does not rely on the the originOf property **
                  I recently added originOf to all Insert Operations (see Struct.Insert.execute),
                  which saves which operations originate in a Insert operation.
                  Garbage collecting without originOf is more memory efficient, but is nearly impossible for large texts, or lists!
                  But I keep this code for now
            ```
            // reset origin of right
            right.origin = neworigin
            // search until you find origin pointer to the left of o
            if (right.right != null) {
              var i = yield* this.getOperation(right.right)
              var ids = [o.id, o.right]
              while (ids.some(function (id) {
                return Y.utils.compareIds(id, i.origin)
              })) {
                if (Y.utils.compareIds(i.origin, o.id)) {
                  // reset origin of i
                  i.origin = neworigin
                  yield* this.setOperation(i)
                }
                // get next i
                if (i.right == null) {
                  break
                } else {
                  ids.push(i.id)
                  i = yield* this.getOperation(i.right)
                }
              }
            }
            ```
            */
            // ** Now the new implementation starts **
            // reset neworigin of all originOf[*]
            for (var _i in o.originOf) {
              var originsIn = yield* this.getOperation(o.originOf[_i])
              if (originsIn != null) {
                originsIn.origin = neworigin
                yield* this.setOperation(originsIn)
              }
            }
            if (neworigin != null) {
              if (neworigin_.originOf == null) {
                neworigin_.originOf = o.originOf
              } else {
                neworigin_.originOf = o.originOf.concat(neworigin_.originOf)
              }
              yield* this.setOperation(neworigin_)
            }
            // we don't need to set right here, because
            // right should be in o.originOf => it is set it the previous for loop
          }
        }
        // o may originate in another operation.
        // Since o is deleted, we have to reset o.origin's `originOf` property
        if (o.origin != null) {
          var origin = yield* this.getInsertion(o.origin)
          origin.originOf = origin.originOf.filter(function (_id) {
            return !Y.utils.compareIds(id, _id)
          })
          yield* this.setOperation(origin)
        }
        var parent
        if (o.parent != null) {
          parent = yield* this.getOperation(o.parent)
        }
        // remove gc'd op from parent, if it exists
        if (parent != null) {
          var setParent = false // whether to save parent to the os
          if (o.parentSub != null) {
            if (Y.utils.compareIds(parent.map[o.parentSub], o.id)) {
              setParent = true
              if (o.right != null) {
                parent.map[o.parentSub] = o.right
              } else {
                delete parent.map[o.parentSub]
              }
            }
          } else {
            if (Y.utils.compareIds(parent.start, o.id)) {
              // gc'd op is the start
              setParent = true
              parent.start = o.right
            }
            if (Y.utils.matchesId(o, parent.end)) {
              // gc'd op is the end
              setParent = true
              parent.end = o.left
            }
          }
          if (setParent) {
            yield* this.setOperation(parent)
          }
        }
        // finally remove it from the os
        yield* this.removeOperation(o.id)
      }
    }
    * checkDeleteStoreForState (state) {
      var n = yield* this.ds.findWithUpperBound([state.user, state.clock])
      if (n != null && n.id[0] === state.user && n.gc) {
        state.clock = Math.max(state.clock, n.id[1] + n.len)
      }
    }
    * updateState (user) {
      var state = yield* this.getState(user)
      yield* this.checkDeleteStoreForState(state)
      var o = yield* this.getInsertion([user, state.clock])
      var oLength = (o != null && o.content != null) ? o.content.length : 1
      while (o != null && user === o.id[0] && o.id[1] <= state.clock && o.id[1] + oLength > state.clock) {
        // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
        state.clock += oLength
        yield* this.checkDeleteStoreForState(state)
        o = yield* this.os.findNext(o.id)
        oLength = (o != null && o.content != null) ? o.content.length : 1
      }
      yield* this.setState(state)
    }
    /*
      apply a delete set in order to get
      the state of the supplied ds
    */
    * applyDeleteSet (ds) {
      var deletions = []

      for (var user in ds) {
        var dv = ds[user]
        var pos = 0
        var d = dv[pos]
        yield* this.ds.iterate(this, [user, 0], [user, Number.MAX_VALUE], function * (n) {
          // cases:
          // 1. d deletes something to the right of n
          //  => go to next n (break)
          // 2. d deletes something to the left of n
          //  => create deletions
          //  => reset d accordingly
          //  *)=> if d doesn't delete anything anymore, go to next d (continue)
          // 3. not 2) and d deletes something that also n deletes
          //  => reset d so that it doesn't contain n's deletion
          //  *)=> if d does not delete anything anymore, go to next d (continue)
          while (d != null) {
            var diff = 0 // describe the diff of length in 1) and 2)
            if (n.id[1] + n.len <= d[0]) {
              // 1)
              break
            } else if (d[0] < n.id[1]) {
              // 2)
              // delete maximum the len of d
              // else delete as much as possible
              diff = Math.min(n.id[1] - d[0], d[1])
              deletions.push([user, d[0], diff, d[2]])
            } else {
              // 3)
              diff = n.id[1] + n.len - d[0] // never null (see 1)
              if (d[2] && !n.gc) {
                // d marks as gc'd but n does not
                // then delete either way
                deletions.push([user, d[0], Math.min(diff, d[1]), d[2]])
              }
            }
            if (d[1] <= diff) {
              // d doesn't delete anything anymore
              d = dv[++pos]
            } else {
              d[0] = d[0] + diff // reset pos
              d[1] = d[1] - diff // reset length
            }
          }
        })
        // for the rest.. just apply it
        for (; pos < dv.length; pos++) {
          d = dv[pos]
          deletions.push([user, d[0], d[1], d[2]])
        }
      }
      for (var i = 0; i < deletions.length; i++) {
        var del = deletions[i]
        // always try to delete..
        yield* this.deleteOperation([del[0], del[1]], del[2])
        if (del[3]) {
          // gc..
          yield* this.markGarbageCollected([del[0], del[1]], del[2]) // always mark gc'd
          // remove operation..
          var counter = del[1] + del[2]
          while (counter >= del[1]) {
            var o = yield* this.os.findWithUpperBound([del[0], counter - 1])
            if (o == null) {
              break
            }
            var oLen = o.content != null ? o.content.length : 1
            if (o.id[0] !== del[0] || o.id[1] + oLen <= del[1]) {
              // not in range
              break
            }
            if (o.id[1] + oLen > del[1] + del[2]) {
              // overlaps right
              o = yield* this.getInsertionCleanEnd([del[0], del[1] + del[2] - 1])
            }
            if (o.id[1] < del[1]) {
              // overlaps left
              o = yield* this.getInsertionCleanStart([del[0], del[1]])
            }
            counter = o.id[1]
            yield* this.garbageCollectOperation(o.id)
          }
        }
        if (this.store.forwardAppliedOperations) {
          var ops = []
          ops.push({struct: 'Delete', target: [del[0], del[1]], length: del[2]})
          this.store.y.connector.broadcastOps(ops)
        }
      }
    }
    * isGarbageCollected (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len && n.gc
    }
    /*
      A DeleteSet (ds) describes all the deleted ops in the OS
    */
    * getDeleteSet () {
      var ds = {}
      yield* this.ds.iterate(this, null, null, function * (n) {
        var user = n.id[0]
        var counter = n.id[1]
        var len = n.len
        var gc = n.gc
        var dv = ds[user]
        if (dv === void 0) {
          dv = []
          ds[user] = dv
        }
        dv.push([counter, len, gc])
      })
      return ds
    }
    * isDeleted (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
    }
    * setOperation (op) {
      yield* this.os.put(op)
      return op
    }
    * addOperation (op) {
      yield* this.os.put(op)
      if (this.store.forwardAppliedOperations && typeof op.id[1] !== 'string') {
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcastOps([op])
      }
    }
    // if insertion, try to combine with left insertion (if both have content property)
    * tryCombineWithLeft (op) {
      if (
        op != null &&
        op.left != null &&
        op.content != null &&
        op.left[0] === op.id[0] &&
        Y.utils.compareIds(op.left, op.origin)
      ) {
        var left = yield* this.getInsertion(op.left)
        if (left.content != null &&
            left.id[1] + left.content.length === op.id[1] &&
            left.originOf.length === 1 &&
            !left.gc && !left.deleted &&
            !op.gc && !op.deleted
        ) {
          // combine!
          if (op.originOf != null) {
            left.originOf = op.originOf
          } else {
            delete left.originOf
          }
          left.content = left.content.concat(op.content)
          left.right = op.right
          yield* this.os.delete(op.id)
          yield* this.setOperation(left)
        }
      }
    }
    * getInsertion (id) {
      var ins = yield* this.os.findWithUpperBound(id)
      if (ins == null) {
        return null
      } else {
        var len = ins.content != null ? ins.content.length : 1 // in case of opContent
        if (id[0] === ins.id[0] && id[1] < ins.id[1] + len) {
          return ins
        } else {
          return null
        }
      }
    }
    * getInsertionCleanStartEnd (id) {
      yield* this.getInsertionCleanStart(id)
      return yield* this.getInsertionCleanEnd(id)
    }
    // Return an insertion such that id is the first element of content
    // This function manipulates an operation, if necessary
    * getInsertionCleanStart (id) {
      var ins = yield* this.getInsertion(id)
      if (ins != null) {
        if (ins.id[1] === id[1]) {
          return ins
        } else {
          var left = Y.utils.copyObject(ins)
          ins.content = left.content.splice(id[1] - ins.id[1])
          ins.id = id
          var leftLid = Y.utils.getLastId(left)
          ins.origin = leftLid
          left.originOf = [ins.id]
          left.right = ins.id
          ins.left = leftLid
          // debugger // check
          yield* this.setOperation(left)
          yield* this.setOperation(ins)
          if (left.gc) {
            this.store.queueGarbageCollector(ins.id)
          }
          return ins
        }
      } else {
        return null
      }
    }
    // Return an insertion such that id is the last element of content
    // This function manipulates an operation, if necessary
    * getInsertionCleanEnd (id) {
      var ins = yield* this.getInsertion(id)
      if (ins != null) {
        if (ins.content == null || (ins.id[1] + ins.content.length - 1 === id[1])) {
          return ins
        } else {
          var right = Y.utils.copyObject(ins)
          right.content = ins.content.splice(id[1] - ins.id[1] + 1) // cut off remainder
          right.id = [id[0], id[1] + 1]
          var insLid = Y.utils.getLastId(ins)
          right.origin = insLid
          ins.originOf = [right.id]
          ins.right = right.id
          right.left = insLid
          // debugger // check
          yield* this.setOperation(right)
          yield* this.setOperation(ins)
          if (ins.gc) {
            this.store.queueGarbageCollector(right.id)
          }
          return ins
        }
      } else {
        return null
      }
    }
    * getOperation (id/* :any */)/* :Transaction<any> */ {
      var o = yield* this.os.find(id)
      if (id[0] !== '_' || o != null) {
        return o
      } else { // type is string
        // generate this operation?
        var comp = id[1].split('_')
        if (comp.length > 1) {
          var struct = comp[0]
          var op = Y.Struct[struct].create(id)
          op.type = comp[1]
          yield* this.setOperation(op)
          return op
        } else {
          // won't be called. but just in case..
          console.error('Unexpected case. How can this happen?')
          debugger // eslint-disable-line
          return null
        }
      }
    }
    * removeOperation (id) {
      yield* this.os.delete(id)
    }
    * setState (state) {
      var val = {
        id: [state.user],
        clock: state.clock
      }
      yield* this.ss.put(val)
    }
    * getState (user) {
      var n = yield* this.ss.find([user])
      var clock = n == null ? null : n.clock
      if (clock == null) {
        clock = 0
      }
      return {
        user: user,
        clock: clock
      }
    }
    * getStateVector () {
      var stateVector = []
      yield* this.ss.iterate(this, null, null, function * (n) {
        stateVector.push({
          user: n.id[0],
          clock: n.clock
        })
      })
      return stateVector
    }
    * getStateSet () {
      var ss = {}
      yield* this.ss.iterate(this, null, null, function * (n) {
        ss[n.id[0]] = n.clock
      })
      return ss
    }
    /*
      Here, we make all missing operations executable for the receiving user.

      Notes:
        startSS: denotes to the SV that the remote user sent
        currSS:  denotes to the state vector that the user should have if he
                 applies all already sent operations (increases is each step)

      We face several problems:
      * Execute op as is won't work because ops depend on each other
       -> find a way so that they do not anymore
      * When changing left, must not go more to the left than the origin
      * When changing right, you have to consider that other ops may have op
        as their origin, this means that you must not set one of these ops
        as the new right (interdependencies of ops)
      * can't just go to the right until you find the first known operation,
        With currSS
          -> interdependency of ops is a problem
        With startSS
          -> leads to inconsistencies when two users join at the same time.
             Then the position depends on the order of execution -> error!

        Solution:
        -> re-create originial situation
          -> set op.left = op.origin (which never changes)
          -> set op.right
               to the first operation that is known (according to startSS)
               or to the first operation that has an origin that is not to the
               right of op.
          -> Enforces unique execution order -> happy user

        Improvements: TODO
          * Could set left to origin, or the first known operation
            (startSS or currSS.. ?)
            -> Could be necessary when I turn GC again.
            -> Is a bad(ish) idea because it requires more computation

      What we do:
      * Iterate over all missing operations.
      * When there is an operation, where the right op is known, send this op all missing ops to the left to the user
      * I explained above what we have to do with each operation. Here is how we do it efficiently:
        1. Go to the left until you find either op.origin, or a known operation (let o denote current operation in the iteration)
        2. Found a known operation -> set op.left = o, and send it to the user. stop
        3. Found o = op.origin -> set op.left = op.origin, and send it to the user. start again from 1. (set op = o)
        4. Found some o -> set o.right = op, o.left = o.origin, send it to the user, continue
    */
    * getOperations (startSS) {
      // TODO: use bounds here!
      if (startSS == null) {
        startSS = {}
      }
      var send = []

      var endSV = yield* this.getStateVector()
      for (var endState of endSV) {
        var user = endState.user
        if (user === '_') {
          continue
        }
        var startPos = startSS[user] || 0
        if (startPos > 0) {
          // There is a change that [user, startPos] is in a composed Insertion (with a smaller counter)
          // find out if that is the case
          var firstMissing = yield* this.getInsertion([user, startPos])
          if (firstMissing != null) {
            // update startPos
            startPos = firstMissing.id[1]
            startSS[user] = startPos
          }
        }
        yield* this.os.iterate(this, [user, startPos], [user, Number.MAX_VALUE], function * (op) {
          op = Y.Struct[op.struct].encode(op)
          if (op.struct !== 'Insert') {
            send.push(op)
          } else if (op.right == null || op.right[1] < (startSS[op.right[0]] || 0)) {
            // case 1. op.right is known
            var o = op
            // Remember: ?
            // -> set op.right
            //    1. to the first operation that is known (according to startSS)
            //    2. or to the first operation that has an origin that is not to the
            //      right of op.
            // For this we maintain a list of ops which origins are not found yet.
            var missing_origins = [op]
            var newright = op.right
            while (true) {
              if (o.left == null) {
                op.left = null
                send.push(op)
                if (!Y.utils.compareIds(o.id, op.id)) {
                  o = Y.Struct[op.struct].encode(o)
                  o.right = missing_origins[missing_origins.length - 1].id
                  send.push(o)
                }
                break
              }
              o = yield* this.getInsertion(o.left)
              // we set another o, check if we can reduce $missing_origins
              while (missing_origins.length > 0 && Y.utils.matchesId(o, missing_origins[missing_origins.length - 1].origin)) {
                missing_origins.pop()
              }
              if (o.id[1] < (startSS[o.id[0]] || 0)) {
                // case 2. o is known
                op.left = Y.utils.getLastId(o)
                send.push(op)
                break
              } else if (Y.utils.matchesId(o, op.origin)) {
                // case 3. o is op.origin
                op.left = op.origin
                send.push(op)
                op = Y.Struct[op.struct].encode(o)
                op.right = newright
                if (missing_origins.length > 0) {
                  console.log('This should not happen .. :( please report this')
                }
                missing_origins = [op]
              } else {
                // case 4. send o, continue to find op.origin
                var s = Y.Struct[op.struct].encode(o)
                s.right = missing_origins[missing_origins.length - 1].id
                s.left = s.origin
                send.push(s)
                missing_origins.push(o)
              }
            }
          }
        })
      }
      return send.reverse()
    }
    /*
     * Get the plain untransformed operations from the database.
     * You can apply these operations using .applyOperationsUntransformed(ops)
     *
     */
    * getOperationsUntransformed () {
      var ops = []
      yield* this.os.iterate(this, null, null, function * (op) {
        if (op.id[0] !== '_') {
          ops.push(op)
        }
      })
      return {
        untransformed: ops
      }
    }
    * applyOperationsUntransformed (m, stateSet) {
      var ops = m.untransformed
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        // create, and modify parent, if it is created implicitly
        if (op.parent != null && op.parent[0] === '_') {
          if (op.struct === 'Insert') {
            // update parents .map/start/end properties
            if (op.parentSub != null && op.left == null) {
              // op is child of Map
              let parent = yield* this.getOperation(op.parent)
              parent.map[op.parentSub] = op.id
              yield* this.setOperation(parent)
            } else if (op.right == null || op.left == null) {
              let parent = yield* this.getOperation(op.parent)
              if (op.right == null) {
                parent.end = Y.utils.getLastId(op)
              }
              if (op.left == null) {
                parent.start = op.id
              }
              yield* this.setOperation(parent)
            }
          }
        }
        yield* this.os.put(op)
      }
      for (var user in stateSet) {
        yield* this.ss.put({
          id: [user],
          clock: stateSet[user]
        })
      }
    }
    /* this is what we used before.. use this as a reference..
    * makeOperationReady (startSS, op) {
      op = Y.Struct[op.struct].encode(op)
      op = Y.utils.copyObject(op) -- use copyoperation instead now!
      var o = op
      var ids = [op.id]
      // search for the new op.right
      // it is either the first known op (according to startSS)
      // or the o that has no origin to the right of op
      // (this is why we use the ids array)
      while (o.right != null) {
        var right = yield* this.getOperation(o.right)
        if (o.right[1] < (startSS[o.right[0]] || 0) || !ids.some(function (id) {
          return Y.utils.compareIds(id, right.origin)
        })) {
          break
        }
        ids.push(o.right)
        o = right
      }
      op.right = o.right
      op.left = op.origin
      return op
    }
    */
    * flush () {
      yield* this.os.flush()
      yield* this.ss.flush()
      yield* this.ds.flush()
    }
  }
  Y.Transaction = TransactionInterface
}

},{}],18:[function(require,module,exports){
/* @flow */
'use strict'

/*
  EventHandler is an helper class for constructing custom types.

  Why: When constructing custom types, you sometimes want your types to work
  synchronous: E.g.
  ``` Synchronous
    mytype.setSomething("yay")
    mytype.getSomething() === "yay"
  ```
  versus
  ``` Asynchronous
    mytype.setSomething("yay")
    mytype.getSomething() === undefined
    mytype.waitForSomething().then(function(){
      mytype.getSomething() === "yay"
    })
  ```

  The structures usually work asynchronously (you have to wait for the
  database request to finish). EventHandler helps you to make your type
  synchronous.
*/
module.exports = function (Y /* : any*/) {
  Y.utils = {}

  Y.utils.bubbleEvent = function (type, event) {
    type.eventHandler.callEventListeners(event)
    event.path = []
    while (type != null && type._deepEventHandler != null) {
      type._deepEventHandler.callEventListeners(event)
      var parent = null
      if (type._parent != null) {
        parent = type.os.getType(type._parent)
      }
      if (parent != null && parent._getPathToChild != null) {
        event.path = [parent._getPathToChild(type._model)].concat(event.path)
        type = parent
      } else {
        type = null
      }
    }
  }

  class EventListenerHandler {
    constructor () {
      this.eventListeners = []
    }
    destroy () {
      this.eventListeners = null
    }
     /*
      Basic event listener boilerplate...
    */
    addEventListener (f) {
      this.eventListeners.push(f)
    }
    removeEventListener (f) {
      this.eventListeners = this.eventListeners.filter(function (g) {
        return f !== g
      })
    }
    removeAllEventListeners () {
      this.eventListeners = []
    }
    callEventListeners (event) {
      for (var i = 0; i < this.eventListeners.length; i++) {
        try {
          var _event = {}
          for (var name in event) {
            _event[name] = event[name]
          }
          this.eventListeners[i](_event)
        } catch (e) {
          console.error('Your observer threw an error. This error was caught so that Yjs still can ensure data consistency! In order to debug this error you have to check "Pause On Caught Exceptions"', e)
        }
      }
    }
  }
  Y.utils.EventListenerHandler = EventListenerHandler

  class EventHandler extends EventListenerHandler {
    /* ::
    waiting: Array<Insertion | Deletion>;
    awaiting: number;
    onevent: Function;
    eventListeners: Array<Function>;
    */
    /*
      onevent: is called when the structure changes.

      Note: "awaiting opertations" is used to denote operations that were
      prematurely called. Events for received operations can not be executed until
      all prematurely called operations were executed ("waiting operations")
    */
    constructor (onevent /* : Function */) {
      super()
      this.waiting = []
      this.awaiting = 0
      this.onevent = onevent
    }
    destroy () {
      super.destroy()
      this.waiting = null
      this.onevent = null
    }
    /*
      Call this when a new operation arrives. It will be executed right away if
      there are no waiting operations, that you prematurely executed
    */
    receivedOp (op) {
      if (this.awaiting <= 0) {
        this.onevent(op)
      } else if (op.struct === 'Delete') {
        var self = this
        var checkDelete = function checkDelete (d) {
          if (d.length == null) {
            throw new Error('This shouldn\'t happen! d.length must be defined!')
          }
          // we check if o deletes something in self.waiting
          // if so, we remove the deleted operation
          for (var w = 0; w < self.waiting.length; w++) {
            var i = self.waiting[w]
            if (i.struct === 'Insert' && i.id[0] === d.target[0]) {
              var iLength = i.hasOwnProperty('content') ? i.content.length : 1
              var dStart = d.target[1]
              var dEnd = d.target[1] + (d.length || 1)
              var iStart = i.id[1]
              var iEnd = i.id[1] + iLength
              // Check if they don't overlap
              if (iEnd <= dStart || dEnd <= iStart) {
                // no overlapping
                continue
              }
              // we check all overlapping cases. All cases:
              /*
                1)  iiiii
                      ddddd
                    --> modify i and d
                2)  iiiiiii
                      ddddd
                    --> modify i, remove d
                3)  iiiiiii
                      ddd
                    --> remove d, modify i, and create another i (for the right hand side)
                4)  iiiii
                    ddddddd
                    --> remove i, modify d
                5)  iiiiiii
                    ddddddd
                    --> remove both i and d (**)
                6)  iiiiiii
                    ddddd
                    --> modify i, remove d
                7)    iii
                    ddddddd
                    --> remove i, create and apply two d with checkDelete(d) (**)
                8)    iiiii
                    ddddddd
                    --> remove i, modify d (**)
                9)    iiiii
                    ddddd
                    --> modify i and d
                (**) (also check if i contains content or type)
              */
              // TODO: I left some debugger statements, because I want to debug all cases once in production. REMEMBER END TODO
              if (iStart < dStart) {
                if (dStart < iEnd) {
                  if (iEnd < dEnd) {
                    // Case 1
                    // remove the right part of i's content
                    i.content.splice(dStart - iStart)
                    // remove the start of d's deletion
                    d.length = dEnd - iEnd
                    d.target = [d.target[0], iEnd]
                    continue
                  } else if (iEnd === dEnd) {
                    // Case 2
                    i.content.splice(dStart - iStart)
                    // remove d, we do that by simply ending this function
                    return
                  } else { // (dEnd < iEnd)
                    // Case 3
                    var newI = {
                      id: [i.id[0], dEnd],
                      content: i.content.slice(dEnd - iStart),
                      struct: 'Insert'
                    }
                    self.waiting.push(newI)
                    i.content.splice(dStart - iStart)
                    return
                  }
                }
              } else if (dStart === iStart) {
                if (iEnd < dEnd) {
                  // Case 4
                  d.length = dEnd - iEnd
                  d.target = [d.target[0], iEnd]
                  i.content = []
                  continue
                } else if (iEnd === dEnd) {
                  // Case 5
                  self.waiting.splice(w, 1)
                  return
                } else { // (dEnd < iEnd)
                  // Case 6
                  i.content = i.content.slice(dEnd - iStart)
                  i.id = [i.id[0], dEnd]
                  return
                }
              } else { // (dStart < iStart)
                if (iStart < dEnd) {
                  // they overlap
                  /*
                  7)    iii
                      ddddddd
                      --> remove i, create and apply two d with checkDelete(d) (**)
                  8)    iiiii
                      ddddddd
                      --> remove i, modify d (**)
                  9)    iiiii
                      ddddd
                      --> modify i and d
                  */
                  if (iEnd < dEnd) {
                    // Case 7
                    // debugger // TODO: You did not test this case yet!!!! (add the debugger here)
                    self.waiting.splice(w, 1)
                    checkDelete({
                      target: [d.target[0], dStart],
                      length: iStart - dStart,
                      struct: 'Delete'
                    })
                    checkDelete({
                      target: [d.target[0], iEnd],
                      length: iEnd - dEnd,
                      struct: 'Delete'
                    })
                    return
                  } else if (iEnd === dEnd) {
                    // Case 8
                    self.waiting.splice(w, 1)
                    w--
                    d.length -= iLength
                    continue
                  } else { // dEnd < iEnd
                    // Case 9
                    d.length = iStart - dStart
                    i.content.splice(0, dEnd - iStart)
                    i.id = [i.id[0], dEnd]
                    continue
                  }
                }
              }
            }
          }
          // finished with remaining operations
          self.waiting.push(d)
        }
        if (op.key == null) {
          // deletes in list
          checkDelete(op)
        } else {
          // deletes in map
          this.waiting.push(op)
        }
      } else {
        this.waiting.push(op)
      }
    }
    /*
      You created some operations, and you want the `onevent` function to be
      called right away. Received operations will not be executed untill all
      prematurely called operations are executed
    */
    awaitAndPrematurelyCall (ops) {
      this.awaiting++
      ops.map(Y.utils.copyOperation).forEach(this.onevent)
    }
    * awaitOps (transaction, f, args) {
      function notSoSmartSort (array) {
        // this function sorts insertions in a executable order
        var result = []
        while (array.length > 0) {
          for (var i = 0; i < array.length; i++) {
            var independent = true
            for (var j = 0; j < array.length; j++) {
              if (Y.utils.matchesId(array[j], array[i].left)) {
                // array[i] depends on array[j]
                independent = false
                break
              }
            }
            if (independent) {
              result.push(array.splice(i, 1)[0])
              i--
            }
          }
        }
        return result
      }
      var before = this.waiting.length
      // somehow create new operations
      yield* f.apply(transaction, args)
      // remove all appended ops / awaited ops
      this.waiting.splice(before)
      if (this.awaiting > 0) this.awaiting--
      // if there are no awaited ops anymore, we can update all waiting ops, and send execute them (if there are still no awaited ops)
      if (this.awaiting === 0 && this.waiting.length > 0) {
        // update all waiting ops
        for (let i = 0; i < this.waiting.length; i++) {
          var o = this.waiting[i]
          if (o.struct === 'Insert') {
            var _o = yield* transaction.getInsertion(o.id)
            if (_o.parentSub != null && _o.left != null) {
              // if o is an insertion of a map struc (parentSub is defined), then it shouldn't be necessary to compute left
              this.waiting.splice(i, 1)
              i-- // update index
            } else if (!Y.utils.compareIds(_o.id, o.id)) {
              // o got extended
              o.left = [o.id[0], o.id[1] - 1]
            } else if (_o.left == null) {
              o.left = null
            } else {
              // find next undeleted op
              var left = yield* transaction.getInsertion(_o.left)
              while (left.deleted != null) {
                if (left.left != null) {
                  left = yield* transaction.getInsertion(left.left)
                } else {
                  left = null
                  break
                }
              }
              o.left = left != null ? Y.utils.getLastId(left) : null
            }
          }
        }
        // the previous stuff was async, so we have to check again!
        // We also pull changes from the bindings, if there exists such a method, this could increase awaiting too
        if (this._pullChanges != null) {
          this._pullChanges()
        }
        if (this.awaiting === 0) {
          // sort by type, execute inserts first
          var ins = []
          var dels = []
          this.waiting.forEach(function (o) {
            if (o.struct === 'Delete') {
              dels.push(o)
            } else {
              ins.push(o)
            }
          })
          this.waiting = []
          // put in executable order
          ins = notSoSmartSort(ins)
          // this.onevent can trigger the creation of another operation
          // -> check if this.awaiting increased & stop computation if it does
          for (var i = 0; i < ins.length; i++) {
            if (this.awaiting === 0) {
              this.onevent(ins[i])
            } else {
              this.waiting = this.waiting.concat(ins.slice(i))
              break
            }
          }
          for (i = 0; i < dels.length; i++) {
            if (this.awaiting === 0) {
              this.onevent(dels[i])
            } else {
              this.waiting = this.waiting.concat(dels.slice(i))
              break
            }
          }
        }
      }
    }
    // TODO: Remove awaitedInserts and awaitedDeletes in favor of awaitedOps, as they are deprecated and do not always work
    // Do this in one of the coming releases that are breaking anyway
    /*
      Call this when you successfully awaited the execution of n Insert operations
    */
    awaitedInserts (n) {
      var ops = this.waiting.splice(this.waiting.length - n)
      for (var oid = 0; oid < ops.length; oid++) {
        var op = ops[oid]
        if (op.struct === 'Insert') {
          for (var i = this.waiting.length - 1; i >= 0; i--) {
            let w = this.waiting[i]
            // TODO: do I handle split operations correctly here? Super unlikely, but yeah..
            // Also: can this case happen? Can op be inserted in the middle of a larger op that is in $waiting?
            if (w.struct === 'Insert') {
              if (Y.utils.matchesId(w, op.left)) {
                // include the effect of op in w
                w.right = op.id
                // exclude the effect of w in op
                op.left = w.left
              } else if (Y.utils.compareIds(w.id, op.right)) {
                // similar..
                w.left = Y.utils.getLastId(op)
                op.right = w.right
              }
            }
          }
        } else {
          throw new Error('Expected Insert Operation!')
        }
      }
      this._tryCallEvents(n)
    }
    /*
      Call this when you successfully awaited the execution of n Delete operations
    */
    awaitedDeletes (n, newLeft) {
      var ops = this.waiting.splice(this.waiting.length - n)
      for (var j = 0; j < ops.length; j++) {
        var del = ops[j]
        if (del.struct === 'Delete') {
          if (newLeft != null) {
            for (var i = 0; i < this.waiting.length; i++) {
              let w = this.waiting[i]
              // We will just care about w.left
              if (w.struct === 'Insert' && Y.utils.compareIds(del.target, w.left)) {
                w.left = newLeft
              }
            }
          }
        } else {
          throw new Error('Expected Delete Operation!')
        }
      }
      this._tryCallEvents(n)
    }
    /* (private)
      Try to execute the events for the waiting operations
    */
    _tryCallEvents () {
      function notSoSmartSort (array) {
        var result = []
        while (array.length > 0) {
          for (var i = 0; i < array.length; i++) {
            var independent = true
            for (var j = 0; j < array.length; j++) {
              if (Y.utils.matchesId(array[j], array[i].left)) {
                // array[i] depends on array[j]
                independent = false
                break
              }
            }
            if (independent) {
              result.push(array.splice(i, 1)[0])
              i--
            }
          }
        }
        return result
      }
      if (this.awaiting > 0) this.awaiting--
      if (this.awaiting === 0 && this.waiting.length > 0) {
        var ins = []
        var dels = []
        this.waiting.forEach(function (o) {
          if (o.struct === 'Delete') {
            dels.push(o)
          } else {
            ins.push(o)
          }
        })
        ins = notSoSmartSort(ins)
        ins.forEach(this.onevent)
        dels.forEach(this.onevent)
        this.waiting = []
      }
    }
  }
  Y.utils.EventHandler = EventHandler

  /*
    Default class of custom types!
  */
  class CustomType {
    getPath () {
      var parent = null
      if (this._parent != null) {
        parent = this.os.getType(this._parent)
      }
      if (parent != null && parent._getPathToChild != null) {
        var firstKey = parent._getPathToChild(this._model)
        var parentKeys = parent.getPath()
        parentKeys.push(firstKey)
        return parentKeys
      } else {
        return []
      }
    }
  }
  Y.utils.CustomType = CustomType

  /*
    A wrapper for the definition of a custom type.
    Every custom type must have three properties:

    * struct
      - Structname of this type
    * initType
      - Given a model, creates a custom type
    * class
      - the constructor of the custom type (e.g. in order to inherit from a type)
  */
  class CustomTypeDefinition { // eslint-disable-line
    /* ::
    struct: any;
    initType: any;
    class: Function;
    name: String;
    */
    constructor (def) {
      if (def.struct == null ||
        def.initType == null ||
        def.class == null ||
        def.name == null ||
        def.createType == null
      ) {
        throw new Error('Custom type was not initialized correctly!')
      }
      this.struct = def.struct
      this.initType = def.initType
      this.createType = def.createType
      this.class = def.class
      this.name = def.name
      if (def.appendAdditionalInfo != null) {
        this.appendAdditionalInfo = def.appendAdditionalInfo
      }
      this.parseArguments = (def.parseArguments || function () {
        return [this]
      }).bind(this)
      this.parseArguments.typeDefinition = this
    }
  }
  Y.utils.CustomTypeDefinition = CustomTypeDefinition

  Y.utils.isTypeDefinition = function isTypeDefinition (v) {
    if (v != null) {
      if (v instanceof Y.utils.CustomTypeDefinition) return [v]
      else if (v.constructor === Array && v[0] instanceof Y.utils.CustomTypeDefinition) return v
      else if (v instanceof Function && v.typeDefinition instanceof Y.utils.CustomTypeDefinition) return [v.typeDefinition]
    }
    return false
  }

  /*
    Make a flat copy of an object
    (just copy properties)
  */
  function copyObject (o) {
    var c = {}
    for (var key in o) {
      c[key] = o[key]
    }
    return c
  }
  Y.utils.copyObject = copyObject

  /*
    Copy an operation, so that it can be manipulated.
    Note: You must not change subproperties (except o.content)!
  */
  function copyOperation (o) {
    o = copyObject(o)
    if (o.content != null) {
      o.content = o.content.map(function (c) { return c })
    }
    return o
  }

  Y.utils.copyOperation = copyOperation

  /*
    Defines a smaller relation on Id's
  */
  function smaller (a, b) {
    return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || typeof a[1] < typeof b[1]))
  }
  Y.utils.smaller = smaller

  function inDeletionRange (del, ins) {
    return del.target[0] === ins[0] && del.target[1] <= ins[1] && ins[1] < del.target[1] + (del.length || 1)
  }
  Y.utils.inDeletionRange = inDeletionRange

  function compareIds (id1, id2) {
    if (id1 == null || id2 == null) {
      return id1 === id2
    } else {
      return id1[0] === id2[0] && id1[1] === id2[1]
    }
  }
  Y.utils.compareIds = compareIds

  function matchesId (op, id) {
    if (id == null || op == null) {
      return id === op
    } else {
      if (id[0] === op.id[0]) {
        if (op.content == null) {
          return id[1] === op.id[1]
        } else {
          return id[1] >= op.id[1] && id[1] < op.id[1] + op.content.length
        }
      }
    }
  }
  Y.utils.matchesId = matchesId

  function getLastId (op) {
    if (op.content == null || op.content.length === 1) {
      return op.id
    } else {
      return [op.id[0], op.id[1] + op.content.length - 1]
    }
  }
  Y.utils.getLastId = getLastId

  function createEmptyOpsArray (n) {
    var a = new Array(n)
    for (var i = 0; i < a.length; i++) {
      a[i] = {
        id: [null, null]
      }
    }
    return a
  }

  function createSmallLookupBuffer (Store) {
    /*
      This buffer implements a very small buffer that temporarily stores operations
      after they are read / before they are written.
      The buffer basically implements FIFO. Often requested lookups will be re-queued every time they are looked up / written.

      It can speed up lookups on Operation Stores and State Stores. But it does not require notable use of memory or processing power.

      Good for os and ss, bot not for ds (because it often uses methods that require a flush)

      I tried to optimize this for performance, therefore no highlevel operations.
    */
    class SmallLookupBuffer extends Store {
      constructor (arg1, arg2) {
        // super(...arguments) -- do this when this is supported by stable nodejs
        super(arg1, arg2)
        this.writeBuffer = createEmptyOpsArray(5)
        this.readBuffer = createEmptyOpsArray(10)
      }
      * find (id, noSuperCall) {
        var i, r
        for (i = this.readBuffer.length - 1; i >= 0; i--) {
          r = this.readBuffer[i]
          // we don't have to use compareids, because id is always defined!
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            // found r
            // move r to the end of readBuffer
            for (; i < this.readBuffer.length - 1; i++) {
              this.readBuffer[i] = this.readBuffer[i + 1]
            }
            this.readBuffer[this.readBuffer.length - 1] = r
            return r
          }
        }
        var o
        for (i = this.writeBuffer.length - 1; i >= 0; i--) {
          r = this.writeBuffer[i]
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            o = r
            break
          }
        }
        if (i < 0 && noSuperCall === undefined) {
          // did not reach break in last loop
          // read id and put it to the end of readBuffer
          o = yield* super.find(id)
        }
        if (o != null) {
          for (i = 0; i < this.readBuffer.length - 1; i++) {
            this.readBuffer[i] = this.readBuffer[i + 1]
          }
          this.readBuffer[this.readBuffer.length - 1] = o
        }
        return o
      }
      * put (o) {
        var id = o.id
        var i, r // helper variables
        for (i = this.writeBuffer.length - 1; i >= 0; i--) {
          r = this.writeBuffer[i]
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            // is already in buffer
            // forget r, and move o to the end of writeBuffer
            for (; i < this.writeBuffer.length - 1; i++) {
              this.writeBuffer[i] = this.writeBuffer[i + 1]
            }
            this.writeBuffer[this.writeBuffer.length - 1] = o
            break
          }
        }
        if (i < 0) {
          // did not reach break in last loop
          // write writeBuffer[0]
          var write = this.writeBuffer[0]
          if (write.id[0] !== null) {
            yield* super.put(write)
          }
          // put o to the end of writeBuffer
          for (i = 0; i < this.writeBuffer.length - 1; i++) {
            this.writeBuffer[i] = this.writeBuffer[i + 1]
          }
          this.writeBuffer[this.writeBuffer.length - 1] = o
        }
        // check readBuffer for every occurence of o.id, overwrite if found
        // whether found or not, we'll append o to the readbuffer
        for (i = 0; i < this.readBuffer.length - 1; i++) {
          r = this.readBuffer[i + 1]
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            this.readBuffer[i] = o
          } else {
            this.readBuffer[i] = r
          }
        }
        this.readBuffer[this.readBuffer.length - 1] = o
      }
      * delete (id) {
        var i, r
        for (i = 0; i < this.readBuffer.length; i++) {
          r = this.readBuffer[i]
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            this.readBuffer[i] = {
              id: [null, null]
            }
          }
        }
        yield* this.flush()
        yield* super.delete(id)
      }
      * findWithLowerBound (id) {
        var o = yield* this.find(id, true)
        if (o != null) {
          return o
        } else {
          yield* this.flush()
          return yield* super.findWithLowerBound.apply(this, arguments)
        }
      }
      * findWithUpperBound (id) {
        var o = yield* this.find(id, true)
        if (o != null) {
          return o
        } else {
          yield* this.flush()
          return yield* super.findWithUpperBound.apply(this, arguments)
        }
      }
      * findNext () {
        yield* this.flush()
        return yield* super.findNext.apply(this, arguments)
      }
      * findPrev () {
        yield* this.flush()
        return yield* super.findPrev.apply(this, arguments)
      }
      * iterate () {
        yield* this.flush()
        yield* super.iterate.apply(this, arguments)
      }
      * flush () {
        for (var i = 0; i < this.writeBuffer.length; i++) {
          var write = this.writeBuffer[i]
          if (write.id[0] !== null) {
            yield* super.put(write)
            this.writeBuffer[i] = {
              id: [null, null]
            }
          }
        }
      }
    }
    return SmallLookupBuffer
  }
  Y.utils.createSmallLookupBuffer = createSmallLookupBuffer

  // Generates a unique id, for use as a user id.
  // Thx to @jed for this script https://gist.github.com/jed/982883
  function generateGuid(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,generateGuid)} // eslint-disable-line
  Y.utils.generateGuid = generateGuid
}

},{}],19:[function(require,module,exports){
/* @flow */
'use strict'

require('./Connector.js')(Y)
require('./Database.js')(Y)
require('./Transaction.js')(Y)
require('./Struct.js')(Y)
require('./Utils.js')(Y)
require('./Connectors/Test.js')(Y)

Y.debug = require('debug')

var requiringModules = {}

module.exports = Y
Y.requiringModules = requiringModules

Y.extend = function (name, value) {
  if (arguments.length === 2 && typeof name === 'string') {
    if (value instanceof Y.utils.CustomTypeDefinition) {
      Y[name] = value.parseArguments
    } else {
      Y[name] = value
    }
    if (requiringModules[name] != null) {
      requiringModules[name].resolve()
      delete requiringModules[name]
    }
  } else {
    for (var i = 0; i < arguments.length; i++) {
      var f = arguments[i]
      if (typeof f === 'function') {
        f(Y)
      } else {
        throw new Error('Expected function!')
      }
    }
  }
}

Y.requestModules = requestModules
function requestModules (modules) {
  var sourceDir
  if (Y.sourceDir === null) {
    sourceDir = null
  } else {
    sourceDir = Y.sourceDir || '/bower_components'
  }
  // determine if this module was compiled for es5 or es6 (y.js vs. y.es6)
  // if Insert.execute is a Function, then it isnt a generator..
  // then load the es5(.js) files..
  var extention = typeof regeneratorRuntime !== 'undefined' ? '.js' : '.es6'
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    var module = modules[i].split('(')[0]
    var modulename = 'y-' + module.toLowerCase()
    if (Y[module] == null) {
      if (requiringModules[module] == null) {
        // module does not exist
        if (typeof window !== 'undefined' && window.Y !== 'undefined') {
          if (sourceDir != null) {
            var imported = document.createElement('script')
            imported.src = sourceDir + '/' + modulename + '/' + modulename + extention
            document.head.appendChild(imported)
          }
          let requireModule = {}
          requiringModules[module] = requireModule
          requireModule.promise = new Promise(function (resolve) {
            requireModule.resolve = resolve
          })
          promises.push(requireModule.promise)
        } else {
          console.info('YJS: Please do not depend on automatic requiring of modules anymore! Extend modules as follows `require(\'y-modulename\')(Y)`')
          require(modulename)(Y)
        }
      } else {
        promises.push(requiringModules[modules[i]].promise)
      }
    }
  }
  return Promise.all(promises)
}

/* ::
type MemoryOptions = {
  name: 'memory'
}
type IndexedDBOptions = {
  name: 'indexeddb',
  namespace: string
}
type DbOptions = MemoryOptions | IndexedDBOptions

type WebRTCOptions = {
  name: 'webrtc',
  room: string
}
type WebsocketsClientOptions = {
  name: 'websockets-client',
  room: string
}
type ConnectionOptions = WebRTCOptions | WebsocketsClientOptions

type YOptions = {
  connector: ConnectionOptions,
  db: DbOptions,
  types: Array<TypeName>,
  sourceDir: string,
  share: {[key: string]: TypeName}
}
*/

function Y (opts/* :YOptions */) /* :Promise<YConfig> */ {
  if (opts.hasOwnProperty('sourceDir')) {
    Y.sourceDir = opts.sourceDir
  }
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  for (var name in opts.share) {
    modules.push(opts.share[name])
  }
  return new Promise(function (resolve, reject) {
    if (opts == null) reject('An options object is expected! ')
    else if (opts.connector == null) reject('You must specify a connector! (missing connector property)')
    else if (opts.connector.name == null) reject('You must specify connector name! (missing connector.name property)')
    else if (opts.db == null) reject('You must specify a database! (missing db property)')
    else if (opts.connector.name == null) reject('You must specify db name! (missing db.name property)')
    else {
      opts = Y.utils.copyObject(opts)
      opts.connector = Y.utils.copyObject(opts.connector)
      opts.db = Y.utils.copyObject(opts.db)
      opts.share = Y.utils.copyObject(opts.share)
      setTimeout(function () {
        Y.requestModules(modules).then(function () {
          var yconfig = new YConfig(opts)
          yconfig.db.whenUserIdSet(function () {
            yconfig.init(function () {
              resolve(yconfig)
            })
          })
        }).catch(reject)
      }, 0)
    }
  })
}

class YConfig {
  /* ::
  db: Y.AbstractDatabase;
  connector: Y.AbstractConnector;
  share: {[key: string]: any};
  options: Object;
  */
  constructor (opts, callback) {
    this.options = opts
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    this.connected = true
  }
  init (callback) {
    var opts = this.options
    var share = {}
    this.share = share
    this.db.requestTransaction(function * requestTransaction () {
      // create shared object
      for (var propertyname in opts.share) {
        var typeConstructor = opts.share[propertyname].split('(')
        var typeName = typeConstructor.splice(0, 1)
        var type = Y[typeName]
        var typedef = type.typeDefinition
        var id = ['_', typedef.struct + '_' + typeName + '_' + propertyname + '_' + typeConstructor]
        var args = []
        if (typeConstructor.length === 1) {
          try {
            args = JSON.parse('[' + typeConstructor[0].split(')')[0] + ']')
          } catch (e) {
            throw new Error('Was not able to parse type definition! (share.' + propertyname + ')')
          }
          if (type.typeDefinition.parseArguments == null) {
            throw new Error(typeName + ' does not expect arguments!')
          } else {
            args = typedef.parseArguments(args[0])[1]
          }
        }
        share[propertyname] = yield* this.store.initType.call(this, id, args)
      }
      this.store.whenTransactionsFinished()
        .then(callback)
    })
  }
  isConnected () {
    return this.connector.isSynced
  }
  disconnect () {
    if (this.connected) {
      this.connected = false
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }
  reconnect () {
    if (!this.connected) {
      this.connected = true
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }
  destroy () {
    var self = this
    return this.close().then(function () {
      if (self.db.deleteDB != null) {
        return self.db.deleteDB()
      } else {
        return Promise.resolve()
      }
    })
  }
  close () {
    var self = this
    this.share = null
    if (this.connector.destroy != null) {
      this.connector.destroy()
    } else {
      this.connector.disconnect()
    }
    return this.db.whenTransactionsFinished(function () {
      this.db.destroyTypes()
      // make sure to wait for all transactions before destroying the db
      this.db.requestTransaction(function * () {
        yield* self.db.destroy()
      })
      return this.db.whenTransactionsFinished()
    })
  }
}

},{"./Connector.js":13,"./Connectors/Test.js":14,"./Database.js":15,"./Struct.js":16,"./Transaction.js":17,"./Utils.js":18,"debug":11}],20:[function(require,module,exports){
const Y = require('yjs');
require('y-memory')(Y);
require('y-webrtc3')(Y);
//require('y-webrtc2')(Y);
//require('y-websockets-client')(Y);
require('y-array')(Y);
require('y-map')(Y);
require('y-text')(Y);
require('y-xml')(Y);

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

},{"y-array":4,"y-map":5,"y-memory":6,"y-text":8,"y-webrtc3":9,"y-xml":10,"yjs":19}]},{},[20])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmFzdC1kaWZmL2RpZmYuanMiLCJub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3ktYXJyYXkvc3JjL0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL3ktbWFwL3NyYy9NYXAuanMiLCJub2RlX21vZHVsZXMveS1tZW1vcnkvc3JjL01lbW9yeS5qcyIsIm5vZGVfbW9kdWxlcy95LW1lbW9yeS9zcmMvUmVkQmxhY2tUcmVlLmpzIiwibm9kZV9tb2R1bGVzL3ktdGV4dC9zcmMvVGV4dC5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMvc3JjL1dlYlJUQy5qcyIsIm5vZGVfbW9kdWxlcy95LXhtbC9zcmMvWG1sLmpzIiwibm9kZV9tb2R1bGVzL3lqcy9ub2RlX21vZHVsZXMvZGVidWcvc3JjL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMveWpzL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvZGVidWcuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9Db25uZWN0b3IuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9Db25uZWN0b3JzL1Rlc3QuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9EYXRhYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy95anMvc3JjL1N0cnVjdC5qcyIsIm5vZGVfbW9kdWxlcy95anMvc3JjL1RyYW5zYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3lqcy9zcmMvVXRpbHMuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy95LmpzIiwic3JjL2FwcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKipcbiAqIFRoaXMgbGlicmFyeSBtb2RpZmllcyB0aGUgZGlmZi1wYXRjaC1tYXRjaCBsaWJyYXJ5IGJ5IE5laWwgRnJhc2VyXG4gKiBieSByZW1vdmluZyB0aGUgcGF0Y2ggYW5kIG1hdGNoIGZ1bmN0aW9uYWxpdHkgYW5kIGNlcnRhaW4gYWR2YW5jZWRcbiAqIG9wdGlvbnMgaW4gdGhlIGRpZmYgZnVuY3Rpb24uIFRoZSBvcmlnaW5hbCBsaWNlbnNlIGlzIGFzIGZvbGxvd3M6XG4gKlxuICogPT09XG4gKlxuICogRGlmZiBNYXRjaCBhbmQgUGF0Y2hcbiAqXG4gKiBDb3B5cmlnaHQgMjAwNiBHb29nbGUgSW5jLlxuICogaHR0cDovL2NvZGUuZ29vZ2xlLmNvbS9wL2dvb2dsZS1kaWZmLW1hdGNoLXBhdGNoL1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuXG4vKipcbiAqIFRoZSBkYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgYSBkaWZmIGlzIGFuIGFycmF5IG9mIHR1cGxlczpcbiAqIFtbRElGRl9ERUxFVEUsICdIZWxsbyddLCBbRElGRl9JTlNFUlQsICdHb29kYnllJ10sIFtESUZGX0VRVUFMLCAnIHdvcmxkLiddXVxuICogd2hpY2ggbWVhbnM6IGRlbGV0ZSAnSGVsbG8nLCBhZGQgJ0dvb2RieWUnIGFuZCBrZWVwICcgd29ybGQuJ1xuICovXG52YXIgRElGRl9ERUxFVEUgPSAtMTtcbnZhciBESUZGX0lOU0VSVCA9IDE7XG52YXIgRElGRl9FUVVBTCA9IDA7XG5cblxuLyoqXG4gKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIFNpbXBsaWZpZXMgdGhlIHByb2JsZW0gYnkgc3RyaXBwaW5nXG4gKiBhbnkgY29tbW9uIHByZWZpeCBvciBzdWZmaXggb2ZmIHRoZSB0ZXh0cyBiZWZvcmUgZGlmZmluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7SW50fSBjdXJzb3JfcG9zIEV4cGVjdGVkIGVkaXQgcG9zaXRpb24gaW4gdGV4dDEgKG9wdGlvbmFsKVxuICogQHJldHVybiB7QXJyYXl9IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuICovXG5mdW5jdGlvbiBkaWZmX21haW4odGV4dDEsIHRleHQyLCBjdXJzb3JfcG9zKSB7XG4gIC8vIENoZWNrIGZvciBlcXVhbGl0eSAoc3BlZWR1cCkuXG4gIGlmICh0ZXh0MSA9PSB0ZXh0Mikge1xuICAgIGlmICh0ZXh0MSkge1xuICAgICAgcmV0dXJuIFtbRElGRl9FUVVBTCwgdGV4dDFdXTtcbiAgICB9XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgLy8gQ2hlY2sgY3Vyc29yX3BvcyB3aXRoaW4gYm91bmRzXG4gIGlmIChjdXJzb3JfcG9zIDwgMCB8fCB0ZXh0MS5sZW5ndGggPCBjdXJzb3JfcG9zKSB7XG4gICAgY3Vyc29yX3BvcyA9IG51bGw7XG4gIH1cblxuICAvLyBUcmltIG9mZiBjb21tb24gcHJlZml4IChzcGVlZHVwKS5cbiAgdmFyIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uUHJlZml4KHRleHQxLCB0ZXh0Mik7XG4gIHZhciBjb21tb25wcmVmaXggPSB0ZXh0MS5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcbiAgdGV4dDEgPSB0ZXh0MS5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgdGV4dDIgPSB0ZXh0Mi5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcblxuICAvLyBUcmltIG9mZiBjb21tb24gc3VmZml4IChzcGVlZHVwKS5cbiAgY29tbW9ubGVuZ3RoID0gZGlmZl9jb21tb25TdWZmaXgodGV4dDEsIHRleHQyKTtcbiAgdmFyIGNvbW1vbnN1ZmZpeCA9IHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZygwLCB0ZXh0MS5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZygwLCB0ZXh0Mi5sZW5ndGggLSBjb21tb25sZW5ndGgpO1xuXG4gIC8vIENvbXB1dGUgdGhlIGRpZmYgb24gdGhlIG1pZGRsZSBibG9jay5cbiAgdmFyIGRpZmZzID0gZGlmZl9jb21wdXRlXyh0ZXh0MSwgdGV4dDIpO1xuXG4gIC8vIFJlc3RvcmUgdGhlIHByZWZpeCBhbmQgc3VmZml4LlxuICBpZiAoY29tbW9ucHJlZml4KSB7XG4gICAgZGlmZnMudW5zaGlmdChbRElGRl9FUVVBTCwgY29tbW9ucHJlZml4XSk7XG4gIH1cbiAgaWYgKGNvbW1vbnN1ZmZpeCkge1xuICAgIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsIGNvbW1vbnN1ZmZpeF0pO1xuICB9XG4gIGRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgaWYgKGN1cnNvcl9wb3MgIT0gbnVsbCkge1xuICAgIGRpZmZzID0gZml4X2N1cnNvcihkaWZmcywgY3Vyc29yX3Bvcyk7XG4gIH1cbiAgZGlmZnMgPSBmaXhfZW1vamkoZGlmZnMpO1xuICByZXR1cm4gZGlmZnM7XG59O1xuXG5cbi8qKlxuICogRmluZCB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiB0d28gdGV4dHMuICBBc3N1bWVzIHRoYXQgdGhlIHRleHRzIGRvIG5vdFxuICogaGF2ZSBhbnkgY29tbW9uIHByZWZpeCBvciBzdWZmaXguXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgT2xkIHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgTmV3IHN0cmluZyB0byBiZSBkaWZmZWQuXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfY29tcHV0ZV8odGV4dDEsIHRleHQyKSB7XG4gIHZhciBkaWZmcztcblxuICBpZiAoIXRleHQxKSB7XG4gICAgLy8gSnVzdCBhZGQgc29tZSB0ZXh0IChzcGVlZHVwKS5cbiAgICByZXR1cm4gW1tESUZGX0lOU0VSVCwgdGV4dDJdXTtcbiAgfVxuXG4gIGlmICghdGV4dDIpIHtcbiAgICAvLyBKdXN0IGRlbGV0ZSBzb21lIHRleHQgKHNwZWVkdXApLlxuICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV1dO1xuICB9XG5cbiAgdmFyIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0MjtcbiAgdmFyIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gIHZhciBpID0gbG9uZ3RleHQuaW5kZXhPZihzaG9ydHRleHQpO1xuICBpZiAoaSAhPSAtMSkge1xuICAgIC8vIFNob3J0ZXIgdGV4dCBpcyBpbnNpZGUgdGhlIGxvbmdlciB0ZXh0IChzcGVlZHVwKS5cbiAgICBkaWZmcyA9IFtbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZygwLCBpKV0sXG4gICAgICAgICAgICAgW0RJRkZfRVFVQUwsIHNob3J0dGV4dF0sXG4gICAgICAgICAgICAgW0RJRkZfSU5TRVJULCBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHNob3J0dGV4dC5sZW5ndGgpXV07XG4gICAgLy8gU3dhcCBpbnNlcnRpb25zIGZvciBkZWxldGlvbnMgaWYgZGlmZiBpcyByZXZlcnNlZC5cbiAgICBpZiAodGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoKSB7XG4gICAgICBkaWZmc1swXVswXSA9IGRpZmZzWzJdWzBdID0gRElGRl9ERUxFVEU7XG4gICAgfVxuICAgIHJldHVybiBkaWZmcztcbiAgfVxuXG4gIGlmIChzaG9ydHRleHQubGVuZ3RoID09IDEpIHtcbiAgICAvLyBTaW5nbGUgY2hhcmFjdGVyIHN0cmluZy5cbiAgICAvLyBBZnRlciB0aGUgcHJldmlvdXMgc3BlZWR1cCwgdGhlIGNoYXJhY3RlciBjYW4ndCBiZSBhbiBlcXVhbGl0eS5cbiAgICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG4gIH1cblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIHByb2JsZW0gY2FuIGJlIHNwbGl0IGluIHR3by5cbiAgdmFyIGhtID0gZGlmZl9oYWxmTWF0Y2hfKHRleHQxLCB0ZXh0Mik7XG4gIGlmIChobSkge1xuICAgIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cbiAgICB2YXIgdGV4dDFfYSA9IGhtWzBdO1xuICAgIHZhciB0ZXh0MV9iID0gaG1bMV07XG4gICAgdmFyIHRleHQyX2EgPSBobVsyXTtcbiAgICB2YXIgdGV4dDJfYiA9IGhtWzNdO1xuICAgIHZhciBtaWRfY29tbW9uID0gaG1bNF07XG4gICAgLy8gU2VuZCBib3RoIHBhaXJzIG9mZiBmb3Igc2VwYXJhdGUgcHJvY2Vzc2luZy5cbiAgICB2YXIgZGlmZnNfYSA9IGRpZmZfbWFpbih0ZXh0MV9hLCB0ZXh0Ml9hKTtcbiAgICB2YXIgZGlmZnNfYiA9IGRpZmZfbWFpbih0ZXh0MV9iLCB0ZXh0Ml9iKTtcbiAgICAvLyBNZXJnZSB0aGUgcmVzdWx0cy5cbiAgICByZXR1cm4gZGlmZnNfYS5jb25jYXQoW1tESUZGX0VRVUFMLCBtaWRfY29tbW9uXV0sIGRpZmZzX2IpO1xuICB9XG5cbiAgcmV0dXJuIGRpZmZfYmlzZWN0Xyh0ZXh0MSwgdGV4dDIpO1xufTtcblxuXG4vKipcbiAqIEZpbmQgdGhlICdtaWRkbGUgc25ha2UnIG9mIGEgZGlmZiwgc3BsaXQgdGhlIHByb2JsZW0gaW4gdHdvXG4gKiBhbmQgcmV0dXJuIHRoZSByZWN1cnNpdmVseSBjb25zdHJ1Y3RlZCBkaWZmLlxuICogU2VlIE15ZXJzIDE5ODYgcGFwZXI6IEFuIE8oTkQpIERpZmZlcmVuY2UgQWxnb3JpdGhtIGFuZCBJdHMgVmFyaWF0aW9ucy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGRpZmZfYmlzZWN0Xyh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gQ2FjaGUgdGhlIHRleHQgbGVuZ3RocyB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzLlxuICB2YXIgdGV4dDFfbGVuZ3RoID0gdGV4dDEubGVuZ3RoO1xuICB2YXIgdGV4dDJfbGVuZ3RoID0gdGV4dDIubGVuZ3RoO1xuICB2YXIgbWF4X2QgPSBNYXRoLmNlaWwoKHRleHQxX2xlbmd0aCArIHRleHQyX2xlbmd0aCkgLyAyKTtcbiAgdmFyIHZfb2Zmc2V0ID0gbWF4X2Q7XG4gIHZhciB2X2xlbmd0aCA9IDIgKiBtYXhfZDtcbiAgdmFyIHYxID0gbmV3IEFycmF5KHZfbGVuZ3RoKTtcbiAgdmFyIHYyID0gbmV3IEFycmF5KHZfbGVuZ3RoKTtcbiAgLy8gU2V0dGluZyBhbGwgZWxlbWVudHMgdG8gLTEgaXMgZmFzdGVyIGluIENocm9tZSAmIEZpcmVmb3ggdGhhbiBtaXhpbmdcbiAgLy8gaW50ZWdlcnMgYW5kIHVuZGVmaW5lZC5cbiAgZm9yICh2YXIgeCA9IDA7IHggPCB2X2xlbmd0aDsgeCsrKSB7XG4gICAgdjFbeF0gPSAtMTtcbiAgICB2Mlt4XSA9IC0xO1xuICB9XG4gIHYxW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICB2Mlt2X29mZnNldCArIDFdID0gMDtcbiAgdmFyIGRlbHRhID0gdGV4dDFfbGVuZ3RoIC0gdGV4dDJfbGVuZ3RoO1xuICAvLyBJZiB0aGUgdG90YWwgbnVtYmVyIG9mIGNoYXJhY3RlcnMgaXMgb2RkLCB0aGVuIHRoZSBmcm9udCBwYXRoIHdpbGwgY29sbGlkZVxuICAvLyB3aXRoIHRoZSByZXZlcnNlIHBhdGguXG4gIHZhciBmcm9udCA9IChkZWx0YSAlIDIgIT0gMCk7XG4gIC8vIE9mZnNldHMgZm9yIHN0YXJ0IGFuZCBlbmQgb2YgayBsb29wLlxuICAvLyBQcmV2ZW50cyBtYXBwaW5nIG9mIHNwYWNlIGJleW9uZCB0aGUgZ3JpZC5cbiAgdmFyIGsxc3RhcnQgPSAwO1xuICB2YXIgazFlbmQgPSAwO1xuICB2YXIgazJzdGFydCA9IDA7XG4gIHZhciBrMmVuZCA9IDA7XG4gIGZvciAodmFyIGQgPSAwOyBkIDwgbWF4X2Q7IGQrKykge1xuICAgIC8vIFdhbGsgdGhlIGZyb250IHBhdGggb25lIHN0ZXAuXG4gICAgZm9yICh2YXIgazEgPSAtZCArIGsxc3RhcnQ7IGsxIDw9IGQgLSBrMWVuZDsgazEgKz0gMikge1xuICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgazE7XG4gICAgICB2YXIgeDE7XG4gICAgICBpZiAoazEgPT0gLWQgfHwgKGsxICE9IGQgJiYgdjFbazFfb2Zmc2V0IC0gMV0gPCB2MVtrMV9vZmZzZXQgKyAxXSkpIHtcbiAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHgxID0gdjFbazFfb2Zmc2V0IC0gMV0gKyAxO1xuICAgICAgfVxuICAgICAgdmFyIHkxID0geDEgLSBrMTtcbiAgICAgIHdoaWxlICh4MSA8IHRleHQxX2xlbmd0aCAmJiB5MSA8IHRleHQyX2xlbmd0aCAmJlxuICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh4MSkgPT0gdGV4dDIuY2hhckF0KHkxKSkge1xuICAgICAgICB4MSsrO1xuICAgICAgICB5MSsrO1xuICAgICAgfVxuICAgICAgdjFbazFfb2Zmc2V0XSA9IHgxO1xuICAgICAgaWYgKHgxID4gdGV4dDFfbGVuZ3RoKSB7XG4gICAgICAgIC8vIFJhbiBvZmYgdGhlIHJpZ2h0IG9mIHRoZSBncmFwaC5cbiAgICAgICAgazFlbmQgKz0gMjtcbiAgICAgIH0gZWxzZSBpZiAoeTEgPiB0ZXh0Ml9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgYm90dG9tIG9mIHRoZSBncmFwaC5cbiAgICAgICAgazFzdGFydCArPSAyO1xuICAgICAgfSBlbHNlIGlmIChmcm9udCkge1xuICAgICAgICB2YXIgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBkZWx0YSAtIGsxO1xuICAgICAgICBpZiAoazJfb2Zmc2V0ID49IDAgJiYgazJfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjJbazJfb2Zmc2V0XSAhPSAtMSkge1xuICAgICAgICAgIC8vIE1pcnJvciB4MiBvbnRvIHRvcC1sZWZ0IGNvb3JkaW5hdGUgc3lzdGVtLlxuICAgICAgICAgIHZhciB4MiA9IHRleHQxX2xlbmd0aCAtIHYyW2syX29mZnNldF07XG4gICAgICAgICAgaWYgKHgxID49IHgyKSB7XG4gICAgICAgICAgICAvLyBPdmVybGFwIGRldGVjdGVkLlxuICAgICAgICAgICAgcmV0dXJuIGRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeDEsIHkxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXYWxrIHRoZSByZXZlcnNlIHBhdGggb25lIHN0ZXAuXG4gICAgZm9yICh2YXIgazIgPSAtZCArIGsyc3RhcnQ7IGsyIDw9IGQgLSBrMmVuZDsgazIgKz0gMikge1xuICAgICAgdmFyIGsyX29mZnNldCA9IHZfb2Zmc2V0ICsgazI7XG4gICAgICB2YXIgeDI7XG4gICAgICBpZiAoazIgPT0gLWQgfHwgKGsyICE9IGQgJiYgdjJbazJfb2Zmc2V0IC0gMV0gPCB2MltrMl9vZmZzZXQgKyAxXSkpIHtcbiAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgKyAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHgyID0gdjJbazJfb2Zmc2V0IC0gMV0gKyAxO1xuICAgICAgfVxuICAgICAgdmFyIHkyID0geDIgLSBrMjtcbiAgICAgIHdoaWxlICh4MiA8IHRleHQxX2xlbmd0aCAmJiB5MiA8IHRleHQyX2xlbmd0aCAmJlxuICAgICAgICAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MV9sZW5ndGggLSB4MiAtIDEpID09XG4gICAgICAgICAgICAgdGV4dDIuY2hhckF0KHRleHQyX2xlbmd0aCAtIHkyIC0gMSkpIHtcbiAgICAgICAgeDIrKztcbiAgICAgICAgeTIrKztcbiAgICAgIH1cbiAgICAgIHYyW2syX29mZnNldF0gPSB4MjtcbiAgICAgIGlmICh4MiA+IHRleHQxX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSBsZWZ0IG9mIHRoZSBncmFwaC5cbiAgICAgICAgazJlbmQgKz0gMjtcbiAgICAgIH0gZWxzZSBpZiAoeTIgPiB0ZXh0Ml9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgdG9wIG9mIHRoZSBncmFwaC5cbiAgICAgICAgazJzdGFydCArPSAyO1xuICAgICAgfSBlbHNlIGlmICghZnJvbnQpIHtcbiAgICAgICAgdmFyIGsxX29mZnNldCA9IHZfb2Zmc2V0ICsgZGVsdGEgLSBrMjtcbiAgICAgICAgaWYgKGsxX29mZnNldCA+PSAwICYmIGsxX29mZnNldCA8IHZfbGVuZ3RoICYmIHYxW2sxX29mZnNldF0gIT0gLTEpIHtcbiAgICAgICAgICB2YXIgeDEgPSB2MVtrMV9vZmZzZXRdO1xuICAgICAgICAgIHZhciB5MSA9IHZfb2Zmc2V0ICsgeDEgLSBrMV9vZmZzZXQ7XG4gICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICAgICAgeDIgPSB0ZXh0MV9sZW5ndGggLSB4MjtcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcbiAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICByZXR1cm4gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBEaWZmIHRvb2sgdG9vIGxvbmcgYW5kIGhpdCB0aGUgZGVhZGxpbmUgb3JcbiAgLy8gbnVtYmVyIG9mIGRpZmZzIGVxdWFscyBudW1iZXIgb2YgY2hhcmFjdGVycywgbm8gY29tbW9uYWxpdHkgYXQgYWxsLlxuICByZXR1cm4gW1tESUZGX0RFTEVURSwgdGV4dDFdLCBbRElGRl9JTlNFUlQsIHRleHQyXV07XG59O1xuXG5cbi8qKlxuICogR2l2ZW4gdGhlIGxvY2F0aW9uIG9mIHRoZSAnbWlkZGxlIHNuYWtlJywgc3BsaXQgdGhlIGRpZmYgaW4gdHdvIHBhcnRzXG4gKiBhbmQgcmVjdXJzZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSB4IEluZGV4IG9mIHNwbGl0IHBvaW50IGluIHRleHQxLlxuICogQHBhcmFtIHtudW1iZXJ9IHkgSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDIuXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfYmlzZWN0U3BsaXRfKHRleHQxLCB0ZXh0MiwgeCwgeSkge1xuICB2YXIgdGV4dDFhID0gdGV4dDEuc3Vic3RyaW5nKDAsIHgpO1xuICB2YXIgdGV4dDJhID0gdGV4dDIuc3Vic3RyaW5nKDAsIHkpO1xuICB2YXIgdGV4dDFiID0gdGV4dDEuc3Vic3RyaW5nKHgpO1xuICB2YXIgdGV4dDJiID0gdGV4dDIuc3Vic3RyaW5nKHkpO1xuXG4gIC8vIENvbXB1dGUgYm90aCBkaWZmcyBzZXJpYWxseS5cbiAgdmFyIGRpZmZzID0gZGlmZl9tYWluKHRleHQxYSwgdGV4dDJhKTtcbiAgdmFyIGRpZmZzYiA9IGRpZmZfbWFpbih0ZXh0MWIsIHRleHQyYik7XG5cbiAgcmV0dXJuIGRpZmZzLmNvbmNhdChkaWZmc2IpO1xufTtcblxuXG4vKipcbiAqIERldGVybWluZSB0aGUgY29tbW9uIHByZWZpeCBvZiB0d28gc3RyaW5ncy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgc3RhcnQgb2YgZWFjaFxuICogICAgIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21tb25QcmVmaXgodGV4dDEsIHRleHQyKSB7XG4gIC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cbiAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHwgdGV4dDEuY2hhckF0KDApICE9IHRleHQyLmNoYXJBdCgwKSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIC8vIEJpbmFyeSBzZWFyY2guXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG4gIHZhciBwb2ludGVybWluID0gMDtcbiAgdmFyIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG4gIHZhciBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcbiAgdmFyIHBvaW50ZXJzdGFydCA9IDA7XG4gIHdoaWxlIChwb2ludGVybWluIDwgcG9pbnRlcm1pZCkge1xuICAgIGlmICh0ZXh0MS5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSA9PVxuICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcocG9pbnRlcnN0YXJ0LCBwb2ludGVybWlkKSkge1xuICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG4gICAgICBwb2ludGVyc3RhcnQgPSBwb2ludGVybWluO1xuICAgIH0gZWxzZSB7XG4gICAgICBwb2ludGVybWF4ID0gcG9pbnRlcm1pZDtcbiAgICB9XG4gICAgcG9pbnRlcm1pZCA9IE1hdGguZmxvb3IoKHBvaW50ZXJtYXggLSBwb2ludGVybWluKSAvIDIgKyBwb2ludGVybWluKTtcbiAgfVxuICByZXR1cm4gcG9pbnRlcm1pZDtcbn07XG5cblxuLyoqXG4gKiBEZXRlcm1pbmUgdGhlIGNvbW1vbiBzdWZmaXggb2YgdHdvIHN0cmluZ3MuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBjb21tb24gdG8gdGhlIGVuZCBvZiBlYWNoIHN0cmluZy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21tb25TdWZmaXgodGV4dDEsIHRleHQyKSB7XG4gIC8vIFF1aWNrIGNoZWNrIGZvciBjb21tb24gbnVsbCBjYXNlcy5cbiAgaWYgKCF0ZXh0MSB8fCAhdGV4dDIgfHxcbiAgICAgIHRleHQxLmNoYXJBdCh0ZXh0MS5sZW5ndGggLSAxKSAhPSB0ZXh0Mi5jaGFyQXQodGV4dDIubGVuZ3RoIC0gMSkpIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuICAvLyBCaW5hcnkgc2VhcmNoLlxuICAvLyBQZXJmb3JtYW5jZSBhbmFseXNpczogaHR0cDovL25laWwuZnJhc2VyLm5hbWUvbmV3cy8yMDA3LzEwLzA5L1xuICB2YXIgcG9pbnRlcm1pbiA9IDA7XG4gIHZhciBwb2ludGVybWF4ID0gTWF0aC5taW4odGV4dDEubGVuZ3RoLCB0ZXh0Mi5sZW5ndGgpO1xuICB2YXIgcG9pbnRlcm1pZCA9IHBvaW50ZXJtYXg7XG4gIHZhciBwb2ludGVyZW5kID0gMDtcbiAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG4gICAgaWYgKHRleHQxLnN1YnN0cmluZyh0ZXh0MS5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0MS5sZW5ndGggLSBwb2ludGVyZW5kKSA9PVxuICAgICAgICB0ZXh0Mi5zdWJzdHJpbmcodGV4dDIubGVuZ3RoIC0gcG9pbnRlcm1pZCwgdGV4dDIubGVuZ3RoIC0gcG9pbnRlcmVuZCkpIHtcbiAgICAgIHBvaW50ZXJtaW4gPSBwb2ludGVybWlkO1xuICAgICAgcG9pbnRlcmVuZCA9IHBvaW50ZXJtaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuICAgIH1cbiAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuICB9XG4gIHJldHVybiBwb2ludGVybWlkO1xufTtcblxuXG4vKipcbiAqIERvIHRoZSB0d28gdGV4dHMgc2hhcmUgYSBzdWJzdHJpbmcgd2hpY2ggaXMgYXQgbGVhc3QgaGFsZiB0aGUgbGVuZ3RoIG9mIHRoZVxuICogbG9uZ2VyIHRleHQ/XG4gKiBUaGlzIHNwZWVkdXAgY2FuIHByb2R1Y2Ugbm9uLW1pbmltYWwgZGlmZnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDEgRmlyc3Qgc3RyaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIFNlY29uZCBzdHJpbmcuXG4gKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gRml2ZSBlbGVtZW50IEFycmF5LCBjb250YWluaW5nIHRoZSBwcmVmaXggb2ZcbiAqICAgICB0ZXh0MSwgdGhlIHN1ZmZpeCBvZiB0ZXh0MSwgdGhlIHByZWZpeCBvZiB0ZXh0MiwgdGhlIHN1ZmZpeCBvZlxuICogICAgIHRleHQyIGFuZCB0aGUgY29tbW9uIG1pZGRsZS4gIE9yIG51bGwgaWYgdGhlcmUgd2FzIG5vIG1hdGNoLlxuICovXG5mdW5jdGlvbiBkaWZmX2hhbGZNYXRjaF8odGV4dDEsIHRleHQyKSB7XG4gIHZhciBsb25ndGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQxIDogdGV4dDI7XG4gIHZhciBzaG9ydHRleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MiA6IHRleHQxO1xuICBpZiAobG9uZ3RleHQubGVuZ3RoIDwgNCB8fCBzaG9ydHRleHQubGVuZ3RoICogMiA8IGxvbmd0ZXh0Lmxlbmd0aCkge1xuICAgIHJldHVybiBudWxsOyAgLy8gUG9pbnRsZXNzLlxuICB9XG5cbiAgLyoqXG4gICAqIERvZXMgYSBzdWJzdHJpbmcgb2Ygc2hvcnR0ZXh0IGV4aXN0IHdpdGhpbiBsb25ndGV4dCBzdWNoIHRoYXQgdGhlIHN1YnN0cmluZ1xuICAgKiBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgbG9uZ3RleHQ/XG4gICAqIENsb3N1cmUsIGJ1dCBkb2VzIG5vdCByZWZlcmVuY2UgYW55IGV4dGVybmFsIHZhcmlhYmxlcy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGxvbmd0ZXh0IExvbmdlciBzdHJpbmcuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBzaG9ydHRleHQgU2hvcnRlciBzdHJpbmcuXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpIFN0YXJ0IGluZGV4IG9mIHF1YXJ0ZXIgbGVuZ3RoIHN1YnN0cmluZyB3aXRoaW4gbG9uZ3RleHQuXG4gICAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuICAgKiAgICAgbG9uZ3RleHQsIHRoZSBzdWZmaXggb2YgbG9uZ3RleHQsIHRoZSBwcmVmaXggb2Ygc2hvcnR0ZXh0LCB0aGUgc3VmZml4XG4gICAqICAgICBvZiBzaG9ydHRleHQgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBkaWZmX2hhbGZNYXRjaElfKGxvbmd0ZXh0LCBzaG9ydHRleHQsIGkpIHtcbiAgICAvLyBTdGFydCB3aXRoIGEgMS80IGxlbmd0aCBzdWJzdHJpbmcgYXQgcG9zaXRpb24gaSBhcyBhIHNlZWQuXG4gICAgdmFyIHNlZWQgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSwgaSArIE1hdGguZmxvb3IobG9uZ3RleHQubGVuZ3RoIC8gNCkpO1xuICAgIHZhciBqID0gLTE7XG4gICAgdmFyIGJlc3RfY29tbW9uID0gJyc7XG4gICAgdmFyIGJlc3RfbG9uZ3RleHRfYSwgYmVzdF9sb25ndGV4dF9iLCBiZXN0X3Nob3J0dGV4dF9hLCBiZXN0X3Nob3J0dGV4dF9iO1xuICAgIHdoaWxlICgoaiA9IHNob3J0dGV4dC5pbmRleE9mKHNlZWQsIGogKyAxKSkgIT0gLTEpIHtcbiAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBkaWZmX2NvbW1vblByZWZpeChsb25ndGV4dC5zdWJzdHJpbmcoaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZyhqKSk7XG4gICAgICB2YXIgc3VmZml4TGVuZ3RoID0gZGlmZl9jb21tb25TdWZmaXgobG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaikpO1xuICAgICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCA8IHN1ZmZpeExlbmd0aCArIHByZWZpeExlbmd0aCkge1xuICAgICAgICBiZXN0X2NvbW1vbiA9IHNob3J0dGV4dC5zdWJzdHJpbmcoaiAtIHN1ZmZpeExlbmd0aCwgaikgK1xuICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZyhqLCBqICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgICAgYmVzdF9sb25ndGV4dF9hID0gbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkgLSBzdWZmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X2xvbmd0ZXh0X2IgPSBsb25ndGV4dC5zdWJzdHJpbmcoaSArIHByZWZpeExlbmd0aCk7XG4gICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2EgPSBzaG9ydHRleHQuc3Vic3RyaW5nKDAsIGogLSBzdWZmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X3Nob3J0dGV4dF9iID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGJlc3RfY29tbW9uLmxlbmd0aCAqIDIgPj0gbG9uZ3RleHQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW2Jlc3RfbG9uZ3RleHRfYSwgYmVzdF9sb25ndGV4dF9iLFxuICAgICAgICAgICAgICBiZXN0X3Nob3J0dGV4dF9hLCBiZXN0X3Nob3J0dGV4dF9iLCBiZXN0X2NvbW1vbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIEZpcnN0IGNoZWNrIGlmIHRoZSBzZWNvbmQgcXVhcnRlciBpcyB0aGUgc2VlZCBmb3IgYSBoYWxmLW1hdGNoLlxuICB2YXIgaG0xID0gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gNCkpO1xuICAvLyBDaGVjayBhZ2FpbiBiYXNlZCBvbiB0aGUgdGhpcmQgcXVhcnRlci5cbiAgdmFyIGhtMiA9IGRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5jZWlsKGxvbmd0ZXh0Lmxlbmd0aCAvIDIpKTtcbiAgdmFyIGhtO1xuICBpZiAoIWhtMSAmJiAhaG0yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoIWhtMikge1xuICAgIGhtID0gaG0xO1xuICB9IGVsc2UgaWYgKCFobTEpIHtcbiAgICBobSA9IGhtMjtcbiAgfSBlbHNlIHtcbiAgICAvLyBCb3RoIG1hdGNoZWQuICBTZWxlY3QgdGhlIGxvbmdlc3QuXG4gICAgaG0gPSBobTFbNF0ubGVuZ3RoID4gaG0yWzRdLmxlbmd0aCA/IGhtMSA6IGhtMjtcbiAgfVxuXG4gIC8vIEEgaGFsZi1tYXRjaCB3YXMgZm91bmQsIHNvcnQgb3V0IHRoZSByZXR1cm4gZGF0YS5cbiAgdmFyIHRleHQxX2EsIHRleHQxX2IsIHRleHQyX2EsIHRleHQyX2I7XG4gIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcbiAgICB0ZXh0MV9hID0gaG1bMF07XG4gICAgdGV4dDFfYiA9IGhtWzFdO1xuICAgIHRleHQyX2EgPSBobVsyXTtcbiAgICB0ZXh0Ml9iID0gaG1bM107XG4gIH0gZWxzZSB7XG4gICAgdGV4dDJfYSA9IGhtWzBdO1xuICAgIHRleHQyX2IgPSBobVsxXTtcbiAgICB0ZXh0MV9hID0gaG1bMl07XG4gICAgdGV4dDFfYiA9IGhtWzNdO1xuICB9XG4gIHZhciBtaWRfY29tbW9uID0gaG1bNF07XG4gIHJldHVybiBbdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYiwgbWlkX2NvbW1vbl07XG59O1xuXG5cbi8qKlxuICogUmVvcmRlciBhbmQgbWVyZ2UgbGlrZSBlZGl0IHNlY3Rpb25zLiAgTWVyZ2UgZXF1YWxpdGllcy5cbiAqIEFueSBlZGl0IHNlY3Rpb24gY2FuIG1vdmUgYXMgbG9uZyBhcyBpdCBkb2Vzbid0IGNyb3NzIGFuIGVxdWFsaXR5LlxuICogQHBhcmFtIHtBcnJheX0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKSB7XG4gIGRpZmZzLnB1c2goW0RJRkZfRVFVQUwsICcnXSk7ICAvLyBBZGQgYSBkdW1teSBlbnRyeSBhdCB0aGUgZW5kLlxuICB2YXIgcG9pbnRlciA9IDA7XG4gIHZhciBjb3VudF9kZWxldGUgPSAwO1xuICB2YXIgY291bnRfaW5zZXJ0ID0gMDtcbiAgdmFyIHRleHRfZGVsZXRlID0gJyc7XG4gIHZhciB0ZXh0X2luc2VydCA9ICcnO1xuICB2YXIgY29tbW9ubGVuZ3RoO1xuICB3aGlsZSAocG9pbnRlciA8IGRpZmZzLmxlbmd0aCkge1xuICAgIHN3aXRjaCAoZGlmZnNbcG9pbnRlcl1bMF0pIHtcbiAgICAgIGNhc2UgRElGRl9JTlNFUlQ6XG4gICAgICAgIGNvdW50X2luc2VydCsrO1xuICAgICAgICB0ZXh0X2luc2VydCArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElGRl9ERUxFVEU6XG4gICAgICAgIGNvdW50X2RlbGV0ZSsrO1xuICAgICAgICB0ZXh0X2RlbGV0ZSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElGRl9FUVVBTDpcbiAgICAgICAgLy8gVXBvbiByZWFjaGluZyBhbiBlcXVhbGl0eSwgY2hlY2sgZm9yIHByaW9yIHJlZHVuZGFuY2llcy5cbiAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCA+IDEpIHtcbiAgICAgICAgICBpZiAoY291bnRfZGVsZXRlICE9PSAwICYmIGNvdW50X2luc2VydCAhPT0gMCkge1xuICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHByZWZpeGllcy5cbiAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uUHJlZml4KHRleHRfaW5zZXJ0LCB0ZXh0X2RlbGV0ZSk7XG4gICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgIGlmICgocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCkgPiAwICYmXG4gICAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0IC0gMV1bMF0gPT1cbiAgICAgICAgICAgICAgICAgIERJRkZfRVFVQUwpIHtcbiAgICAgICAgICAgICAgICBkaWZmc1twb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0IC0gMV1bMV0gKz1cbiAgICAgICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGlmZnMuc3BsaWNlKDAsIDAsIFtESUZGX0VRVUFMLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIGNvbW1vbmxlbmd0aCldKTtcbiAgICAgICAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGV4dF9pbnNlcnQgPSB0ZXh0X2luc2VydC5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgdGV4dF9kZWxldGUgPSB0ZXh0X2RlbGV0ZS5zdWJzdHJpbmcoY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEZhY3RvciBvdXQgYW55IGNvbW1vbiBzdWZmaXhpZXMuXG4gICAgICAgICAgICBjb21tb25sZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0X2luc2VydCwgdGV4dF9kZWxldGUpO1xuICAgICAgICAgICAgaWYgKGNvbW1vbmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZyh0ZXh0X2luc2VydC5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKSArIGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZygwLCB0ZXh0X2luc2VydC5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgdGV4dF9kZWxldGUgPSB0ZXh0X2RlbGV0ZS5zdWJzdHJpbmcoMCwgdGV4dF9kZWxldGUubGVuZ3RoIC1cbiAgICAgICAgICAgICAgICAgIGNvbW1vbmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2ZmZW5kaW5nIHJlY29yZHMgYW5kIGFkZCB0aGUgbWVyZ2VkIG9uZXMuXG4gICAgICAgICAgaWYgKGNvdW50X2RlbGV0ZSA9PT0gMCkge1xuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9pbnNlcnQsXG4gICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRElGRl9JTlNFUlQsIHRleHRfaW5zZXJ0XSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjb3VudF9pbnNlcnQgPT09IDApIHtcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlLFxuICAgICAgICAgICAgICAgIGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0X2RlbGV0ZV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCxcbiAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQsIFtESUZGX0RFTEVURSwgdGV4dF9kZWxldGVdLFxuICAgICAgICAgICAgICAgIFtESUZGX0lOU0VSVCwgdGV4dF9pbnNlcnRdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcG9pbnRlciA9IHBvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgK1xuICAgICAgICAgICAgICAgICAgICAoY291bnRfZGVsZXRlID8gMSA6IDApICsgKGNvdW50X2luc2VydCA/IDEgOiAwKSArIDE7XG4gICAgICAgIH0gZWxzZSBpZiAocG9pbnRlciAhPT0gMCAmJiBkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRElGRl9FUVVBTCkge1xuICAgICAgICAgIC8vIE1lcmdlIHRoaXMgZXF1YWxpdHkgd2l0aCB0aGUgcHJldmlvdXMgb25lLlxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArPSBkaWZmc1twb2ludGVyXVsxXTtcbiAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9pbnRlcisrO1xuICAgICAgICB9XG4gICAgICAgIGNvdW50X2luc2VydCA9IDA7XG4gICAgICAgIGNvdW50X2RlbGV0ZSA9IDA7XG4gICAgICAgIHRleHRfZGVsZXRlID0gJyc7XG4gICAgICAgIHRleHRfaW5zZXJ0ID0gJyc7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICBpZiAoZGlmZnNbZGlmZnMubGVuZ3RoIC0gMV1bMV0gPT09ICcnKSB7XG4gICAgZGlmZnMucG9wKCk7ICAvLyBSZW1vdmUgdGhlIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG4gIH1cblxuICAvLyBTZWNvbmQgcGFzczogbG9vayBmb3Igc2luZ2xlIGVkaXRzIHN1cnJvdW5kZWQgb24gYm90aCBzaWRlcyBieSBlcXVhbGl0aWVzXG4gIC8vIHdoaWNoIGNhbiBiZSBzaGlmdGVkIHNpZGV3YXlzIHRvIGVsaW1pbmF0ZSBhbiBlcXVhbGl0eS5cbiAgLy8gZS5nOiBBPGlucz5CQTwvaW5zPkMgLT4gPGlucz5BQjwvaW5zPkFDXG4gIHZhciBjaGFuZ2VzID0gZmFsc2U7XG4gIHBvaW50ZXIgPSAxO1xuICAvLyBJbnRlbnRpb25hbGx5IGlnbm9yZSB0aGUgZmlyc3QgYW5kIGxhc3QgZWxlbWVudCAoZG9uJ3QgbmVlZCBjaGVja2luZykuXG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoIC0gMSkge1xuICAgIGlmIChkaWZmc1twb2ludGVyIC0gMV1bMF0gPT0gRElGRl9FUVVBTCAmJlxuICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMF0gPT0gRElGRl9FUVVBTCkge1xuICAgICAgLy8gVGhpcyBpcyBhIHNpbmdsZSBlZGl0IHN1cnJvdW5kZWQgYnkgZXF1YWxpdGllcy5cbiAgICAgIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlcl1bMV0ubGVuZ3RoIC1cbiAgICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0ubGVuZ3RoKSA9PSBkaWZmc1twb2ludGVyIC0gMV1bMV0pIHtcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgcHJldmlvdXMgZXF1YWxpdHkuXG4gICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gZGlmZnNbcG9pbnRlciAtIDFdWzFdICtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpO1xuICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gKyBkaWZmc1twb2ludGVyICsgMV1bMV07XG4gICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gMSwgMSk7XG4gICAgICAgIGNoYW5nZXMgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoMCwgZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgPT1cbiAgICAgICAgICBkaWZmc1twb2ludGVyICsgMV1bMV0pIHtcbiAgICAgICAgLy8gU2hpZnQgdGhlIGVkaXQgb3ZlciB0aGUgbmV4dCBlcXVhbGl0eS5cbiAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPVxuICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKGRpZmZzW3BvaW50ZXIgKyAxXVsxXS5sZW5ndGgpICtcbiAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgKyAxLCAxKTtcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHBvaW50ZXIrKztcbiAgfVxuICAvLyBJZiBzaGlmdHMgd2VyZSBtYWRlLCB0aGUgZGlmZiBuZWVkcyByZW9yZGVyaW5nIGFuZCBhbm90aGVyIHNoaWZ0IHN3ZWVwLlxuICBpZiAoY2hhbmdlcykge1xuICAgIGRpZmZfY2xlYW51cE1lcmdlKGRpZmZzKTtcbiAgfVxufTtcblxuXG52YXIgZGlmZiA9IGRpZmZfbWFpbjtcbmRpZmYuSU5TRVJUID0gRElGRl9JTlNFUlQ7XG5kaWZmLkRFTEVURSA9IERJRkZfREVMRVRFO1xuZGlmZi5FUVVBTCA9IERJRkZfRVFVQUw7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZjtcblxuLypcbiAqIE1vZGlmeSBhIGRpZmYgc3VjaCB0aGF0IHRoZSBjdXJzb3IgcG9zaXRpb24gcG9pbnRzIHRvIHRoZSBzdGFydCBvZiBhIGNoYW5nZTpcbiAqIEUuZy5cbiAqICAgY3Vyc29yX25vcm1hbGl6ZV9kaWZmKFtbRElGRl9FUVVBTCwgJ2FiYyddXSwgMSlcbiAqICAgICA9PiBbMSwgW1tESUZGX0VRVUFMLCAnYSddLCBbRElGRl9FUVVBTCwgJ2JjJ11dXVxuICogICBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoW1tESUZGX0lOU0VSVCwgJ25ldyddLCBbRElGRl9ERUxFVEUsICd4eXonXV0sIDIpXG4gKiAgICAgPT4gWzIsIFtbRElGRl9JTlNFUlQsICduZXcnXSwgW0RJRkZfREVMRVRFLCAneHknXSwgW0RJRkZfREVMRVRFLCAneiddXV1cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgU3VnZ2VzdGVkIGVkaXQgcG9zaXRpb24uIE11c3Qgbm90IGJlIG91dCBvZiBib3VuZHMhXG4gKiBAcmV0dXJuIHtBcnJheX0gQSB0dXBsZSBbY3Vyc29yIGxvY2F0aW9uIGluIHRoZSBtb2RpZmllZCBkaWZmLCBtb2RpZmllZCBkaWZmXVxuICovXG5mdW5jdGlvbiBjdXJzb3Jfbm9ybWFsaXplX2RpZmYgKGRpZmZzLCBjdXJzb3JfcG9zKSB7XG4gIGlmIChjdXJzb3JfcG9zID09PSAwKSB7XG4gICAgcmV0dXJuIFtESUZGX0VRVUFMLCBkaWZmc107XG4gIH1cbiAgZm9yICh2YXIgY3VycmVudF9wb3MgPSAwLCBpID0gMDsgaSA8IGRpZmZzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGQgPSBkaWZmc1tpXTtcbiAgICBpZiAoZFswXSA9PT0gRElGRl9ERUxFVEUgfHwgZFswXSA9PT0gRElGRl9FUVVBTCkge1xuICAgICAgdmFyIG5leHRfcG9zID0gY3VycmVudF9wb3MgKyBkWzFdLmxlbmd0aDtcbiAgICAgIGlmIChjdXJzb3JfcG9zID09PSBuZXh0X3Bvcykge1xuICAgICAgICByZXR1cm4gW2kgKyAxLCBkaWZmc107XG4gICAgICB9IGVsc2UgaWYgKGN1cnNvcl9wb3MgPCBuZXh0X3Bvcykge1xuICAgICAgICAvLyBjb3B5IHRvIHByZXZlbnQgc2lkZSBlZmZlY3RzXG4gICAgICAgIGRpZmZzID0gZGlmZnMuc2xpY2UoKTtcbiAgICAgICAgLy8gc3BsaXQgZCBpbnRvIHR3byBkaWZmIGNoYW5nZXNcbiAgICAgICAgdmFyIHNwbGl0X3BvcyA9IGN1cnNvcl9wb3MgLSBjdXJyZW50X3BvcztcbiAgICAgICAgdmFyIGRfbGVmdCA9IFtkWzBdLCBkWzFdLnNsaWNlKDAsIHNwbGl0X3BvcyldO1xuICAgICAgICB2YXIgZF9yaWdodCA9IFtkWzBdLCBkWzFdLnNsaWNlKHNwbGl0X3BvcyldO1xuICAgICAgICBkaWZmcy5zcGxpY2UoaSwgMSwgZF9sZWZ0LCBkX3JpZ2h0KTtcbiAgICAgICAgcmV0dXJuIFtpICsgMSwgZGlmZnNdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VycmVudF9wb3MgPSBuZXh0X3BvcztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCdjdXJzb3JfcG9zIGlzIG91dCBvZiBib3VuZHMhJylcbn1cblxuLypcbiAqIE1vZGlmeSBhIGRpZmYgc3VjaCB0aGF0IHRoZSBlZGl0IHBvc2l0aW9uIGlzIFwic2hpZnRlZFwiIHRvIHRoZSBwcm9wb3NlZCBlZGl0IGxvY2F0aW9uIChjdXJzb3JfcG9zaXRpb24pLlxuICpcbiAqIENhc2UgMSlcbiAqICAgQ2hlY2sgaWYgYSBuYWl2ZSBzaGlmdCBpcyBwb3NzaWJsZTpcbiAqICAgICBbMCwgWF0sIFsgMSwgWV0gLT4gWyAxLCBZXSwgWzAsIFhdICAgIChpZiBYICsgWSA9PT0gWSArIFgpXG4gKiAgICAgWzAsIFhdLCBbLTEsIFldIC0+IFstMSwgWV0sIFswLCBYXSAgICAoaWYgWCArIFkgPT09IFkgKyBYKSAtIGhvbGRzIHNhbWUgcmVzdWx0XG4gKiBDYXNlIDIpXG4gKiAgIENoZWNrIGlmIHRoZSBmb2xsb3dpbmcgc2hpZnRzIGFyZSBwb3NzaWJsZTpcbiAqICAgICBbMCwgJ3ByZSddLCBbIDEsICdwcmVmaXgnXSAtPiBbIDEsICdwcmUnXSwgWzAsICdwcmUnXSwgWyAxLCAnZml4J11cbiAqICAgICBbMCwgJ3ByZSddLCBbLTEsICdwcmVmaXgnXSAtPiBbLTEsICdwcmUnXSwgWzAsICdwcmUnXSwgWy0xLCAnZml4J11cbiAqICAgICAgICAgXiAgICAgICAgICAgIF5cbiAqICAgICAgICAgZCAgICAgICAgICBkX25leHRcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgU3VnZ2VzdGVkIGVkaXQgcG9zaXRpb24uIE11c3Qgbm90IGJlIG91dCBvZiBib3VuZHMhXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXNcbiAqL1xuZnVuY3Rpb24gZml4X2N1cnNvciAoZGlmZnMsIGN1cnNvcl9wb3MpIHtcbiAgdmFyIG5vcm0gPSBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoZGlmZnMsIGN1cnNvcl9wb3MpO1xuICB2YXIgbmRpZmZzID0gbm9ybVsxXTtcbiAgdmFyIGN1cnNvcl9wb2ludGVyID0gbm9ybVswXTtcbiAgdmFyIGQgPSBuZGlmZnNbY3Vyc29yX3BvaW50ZXJdO1xuICB2YXIgZF9uZXh0ID0gbmRpZmZzW2N1cnNvcl9wb2ludGVyICsgMV07XG5cbiAgaWYgKGQgPT0gbnVsbCkge1xuICAgIC8vIFRleHQgd2FzIGRlbGV0ZWQgZnJvbSBlbmQgb2Ygb3JpZ2luYWwgc3RyaW5nLFxuICAgIC8vIGN1cnNvciBpcyBub3cgb3V0IG9mIGJvdW5kcyBpbiBuZXcgc3RyaW5nXG4gICAgcmV0dXJuIGRpZmZzO1xuICB9IGVsc2UgaWYgKGRbMF0gIT09IERJRkZfRVFVQUwpIHtcbiAgICAvLyBBIG1vZGlmaWNhdGlvbiBoYXBwZW5lZCBhdCB0aGUgY3Vyc29yIGxvY2F0aW9uLlxuICAgIC8vIFRoaXMgaXMgdGhlIGV4cGVjdGVkIG91dGNvbWUsIHNvIHdlIGNhbiByZXR1cm4gdGhlIG9yaWdpbmFsIGRpZmYuXG4gICAgcmV0dXJuIGRpZmZzO1xuICB9IGVsc2Uge1xuICAgIGlmIChkX25leHQgIT0gbnVsbCAmJiBkWzFdICsgZF9uZXh0WzFdID09PSBkX25leHRbMV0gKyBkWzFdKSB7XG4gICAgICAvLyBDYXNlIDEpXG4gICAgICAvLyBJdCBpcyBwb3NzaWJsZSB0byBwZXJmb3JtIGEgbmFpdmUgc2hpZnRcbiAgICAgIG5kaWZmcy5zcGxpY2UoY3Vyc29yX3BvaW50ZXIsIDIsIGRfbmV4dCwgZClcbiAgICAgIHJldHVybiBtZXJnZV90dXBsZXMobmRpZmZzLCBjdXJzb3JfcG9pbnRlciwgMilcbiAgICB9IGVsc2UgaWYgKGRfbmV4dCAhPSBudWxsICYmIGRfbmV4dFsxXS5pbmRleE9mKGRbMV0pID09PSAwKSB7XG4gICAgICAvLyBDYXNlIDIpXG4gICAgICAvLyBkWzFdIGlzIGEgcHJlZml4IG9mIGRfbmV4dFsxXVxuICAgICAgLy8gV2UgY2FuIGFzc3VtZSB0aGF0IGRfbmV4dFswXSAhPT0gMCwgc2luY2UgZFswXSA9PT0gMFxuICAgICAgLy8gU2hpZnQgZWRpdCBsb2NhdGlvbnMuLlxuICAgICAgbmRpZmZzLnNwbGljZShjdXJzb3JfcG9pbnRlciwgMiwgW2RfbmV4dFswXSwgZFsxXV0sIFswLCBkWzFdXSk7XG4gICAgICB2YXIgc3VmZml4ID0gZF9uZXh0WzFdLnNsaWNlKGRbMV0ubGVuZ3RoKTtcbiAgICAgIGlmIChzdWZmaXgubGVuZ3RoID4gMCkge1xuICAgICAgICBuZGlmZnMuc3BsaWNlKGN1cnNvcl9wb2ludGVyICsgMiwgMCwgW2RfbmV4dFswXSwgc3VmZml4XSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVyZ2VfdHVwbGVzKG5kaWZmcywgY3Vyc29yX3BvaW50ZXIsIDMpXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBwb3NzaWJsZSB0byBwZXJmb3JtIGFueSBtb2RpZmljYXRpb25cbiAgICAgIHJldHVybiBkaWZmcztcbiAgICB9XG4gIH1cbn1cblxuLypcbiAqIENoZWNrIGRpZmYgZGlkIG5vdCBzcGxpdCBzdXJyb2dhdGUgcGFpcnMuXG4gKiBFeC4gWzAsICdcXHVEODNEJ10sIFstMSwgJ1xcdURDMzYnXSwgWzEsICdcXHVEQzJGJ10gLT4gWy0xLCAnXFx1RDgzRFxcdURDMzYnXSwgWzEsICdcXHVEODNEXFx1REMyRiddXG4gKiAgICAgJ1xcdUQ4M0RcXHVEQzM2JyA9PT0gJ/CfkLYnLCAnXFx1RDgzRFxcdURDMkYnID09PSAn8J+QrydcbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICogQHJldHVybiB7QXJyYXl9IEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKi9cbmZ1bmN0aW9uIGZpeF9lbW9qaSAoZGlmZnMpIHtcbiAgdmFyIGNvbXBhY3QgPSBmYWxzZTtcbiAgdmFyIHN0YXJ0c193aXRoX3BhaXJfZW5kID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5jaGFyQ29kZUF0KDApID49IDB4REMwMCAmJiBzdHIuY2hhckNvZGVBdCgwKSA8PSAweERGRkY7XG4gIH1cbiAgdmFyIGVuZHNfd2l0aF9wYWlyX3N0YXJ0ID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5jaGFyQ29kZUF0KHN0ci5sZW5ndGgtMSkgPj0gMHhEODAwICYmIHN0ci5jaGFyQ29kZUF0KHN0ci5sZW5ndGgtMSkgPD0gMHhEQkZGO1xuICB9XG4gIGZvciAodmFyIGkgPSAyOyBpIDwgZGlmZnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBpZiAoZGlmZnNbaS0yXVswXSA9PT0gRElGRl9FUVVBTCAmJiBlbmRzX3dpdGhfcGFpcl9zdGFydChkaWZmc1tpLTJdWzFdKSAmJlxuICAgICAgICBkaWZmc1tpLTFdWzBdID09PSBESUZGX0RFTEVURSAmJiBzdGFydHNfd2l0aF9wYWlyX2VuZChkaWZmc1tpLTFdWzFdKSAmJlxuICAgICAgICBkaWZmc1tpXVswXSA9PT0gRElGRl9JTlNFUlQgJiYgc3RhcnRzX3dpdGhfcGFpcl9lbmQoZGlmZnNbaV1bMV0pKSB7XG4gICAgICBjb21wYWN0ID0gdHJ1ZTtcblxuICAgICAgZGlmZnNbaS0xXVsxXSA9IGRpZmZzW2ktMl1bMV0uc2xpY2UoLTEpICsgZGlmZnNbaS0xXVsxXTtcbiAgICAgIGRpZmZzW2ldWzFdID0gZGlmZnNbaS0yXVsxXS5zbGljZSgtMSkgKyBkaWZmc1tpXVsxXTtcblxuICAgICAgZGlmZnNbaS0yXVsxXSA9IGRpZmZzW2ktMl1bMV0uc2xpY2UoMCwgLTEpO1xuICAgIH1cbiAgfVxuICBpZiAoIWNvbXBhY3QpIHtcbiAgICByZXR1cm4gZGlmZnM7XG4gIH1cbiAgdmFyIGZpeGVkX2RpZmZzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZGlmZnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICBpZiAoZGlmZnNbaV1bMV0ubGVuZ3RoID4gMCkge1xuICAgICAgZml4ZWRfZGlmZnMucHVzaChkaWZmc1tpXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBmaXhlZF9kaWZmcztcbn1cblxuLypcbiAqIFRyeSB0byBtZXJnZSB0dXBsZXMgd2l0aCB0aGVpciBuZWlnYm9ycyBpbiBhIGdpdmVuIHJhbmdlLlxuICogRS5nLiBbMCwgJ2EnXSwgWzAsICdiJ10gLT4gWzAsICdhYiddXG4gKlxuICogQHBhcmFtIHtBcnJheX0gZGlmZnMgQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKiBAcGFyYW0ge0ludH0gc3RhcnQgUG9zaXRpb24gb2YgdGhlIGZpcnN0IGVsZW1lbnQgdG8gbWVyZ2UgKGRpZmZzW3N0YXJ0XSBpcyBhbHNvIG1lcmdlZCB3aXRoIGRpZmZzW3N0YXJ0IC0gMV0pLlxuICogQHBhcmFtIHtJbnR9IGxlbmd0aCBOdW1iZXIgb2YgY29uc2VjdXRpdmUgZWxlbWVudHMgdG8gY2hlY2suXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgbWVyZ2VkIGRpZmYgdHVwbGVzLlxuICovXG5mdW5jdGlvbiBtZXJnZV90dXBsZXMgKGRpZmZzLCBzdGFydCwgbGVuZ3RoKSB7XG4gIC8vIENoZWNrIGZyb20gKHN0YXJ0LTEpIHRvIChzdGFydCtsZW5ndGgpLlxuICBmb3IgKHZhciBpID0gc3RhcnQgKyBsZW5ndGggLSAxOyBpID49IDAgJiYgaSA+PSBzdGFydCAtIDE7IGktLSkge1xuICAgIGlmIChpICsgMSA8IGRpZmZzLmxlbmd0aCkge1xuICAgICAgdmFyIGxlZnRfZCA9IGRpZmZzW2ldO1xuICAgICAgdmFyIHJpZ2h0X2QgPSBkaWZmc1tpKzFdO1xuICAgICAgaWYgKGxlZnRfZFswXSA9PT0gcmlnaHRfZFsxXSkge1xuICAgICAgICBkaWZmcy5zcGxpY2UoaSwgMiwgW2xlZnRfZFswXSwgbGVmdF9kWzFdICsgcmlnaHRfZFsxXV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZGlmZnM7XG59XG4iLCIvKipcbiAqIEhlbHBlcnMuXG4gKi9cblxudmFyIHMgPSAxMDAwO1xudmFyIG0gPSBzICogNjA7XG52YXIgaCA9IG0gKiA2MDtcbnZhciBkID0gaCAqIDI0O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIHZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgbnVtYmVyXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsO1xuICBpZiAodHlwZSA9PT0gJ3N0cmluZycgJiYgdmFsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gcGFyc2UodmFsKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTih2YWwpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBvcHRpb25zLmxvbmcgPyBmbXRMb25nKHZhbCkgOiBmbXRTaG9ydCh2YWwpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICtcbiAgICAgIEpTT04uc3RyaW5naWZ5KHZhbClcbiAgKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG1hdGNoID0gL14oKD86XFxkKyk/XFwuP1xcZCspICoobWlsbGlzZWNvbmRzP3xtc2Vjcz98bXN8c2Vjb25kcz98c2Vjcz98c3xtaW51dGVzP3xtaW5zP3xtfGhvdXJzP3xocnM/fGh8ZGF5cz98ZHx5ZWFycz98eXJzP3x5KT8kL2kuZXhlYyhcbiAgICBzdHJcbiAgKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbiA9IHBhcnNlRmxvYXQobWF0Y2hbMV0pO1xuICB2YXIgdHlwZSA9IChtYXRjaFsyXSB8fCAnbXMnKS50b0xvd2VyQ2FzZSgpO1xuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlICd5ZWFycyc6XG4gICAgY2FzZSAneWVhcic6XG4gICAgY2FzZSAneXJzJzpcbiAgICBjYXNlICd5cic6XG4gICAgY2FzZSAneSc6XG4gICAgICByZXR1cm4gbiAqIHk7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICBpZiAobXMgPj0gZCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gZCkgKyAnZCc7XG4gIH1cbiAgaWYgKG1zID49IGgpIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIGgpICsgJ2gnO1xuICB9XG4gIGlmIChtcyA+PSBtKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBtKSArICdtJztcbiAgfVxuICBpZiAobXMgPj0gcykge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gcykgKyAncyc7XG4gIH1cbiAgcmV0dXJuIG1zICsgJ21zJztcbn1cblxuLyoqXG4gKiBMb25nIGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdExvbmcobXMpIHtcbiAgcmV0dXJuIHBsdXJhbChtcywgZCwgJ2RheScpIHx8XG4gICAgcGx1cmFsKG1zLCBoLCAnaG91cicpIHx8XG4gICAgcGx1cmFsKG1zLCBtLCAnbWludXRlJykgfHxcbiAgICBwbHVyYWwobXMsIHMsICdzZWNvbmQnKSB8fFxuICAgIG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBuLCBuYW1lKSB7XG4gIGlmIChtcyA8IG4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG1zIDwgbiAqIDEuNSkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKG1zIC8gbikgKyAnICcgKyBuYW1lO1xuICB9XG4gIHJldHVybiBNYXRoLmNlaWwobXMgLyBuKSArICcgJyArIG5hbWUgKyAncyc7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyogZ2xvYmFsIFkgKi9cbid1c2Ugc3RyaWN0J1xuXG5mdW5jdGlvbiBleHRlbmQgKFkpIHtcbiAgY2xhc3MgWUFycmF5IGV4dGVuZHMgWS51dGlscy5DdXN0b21UeXBlIHtcbiAgICBjb25zdHJ1Y3RvciAob3MsIF9tb2RlbCwgX2NvbnRlbnQpIHtcbiAgICAgIHN1cGVyKClcbiAgICAgIHRoaXMub3MgPSBvc1xuICAgICAgdGhpcy5fbW9kZWwgPSBfbW9kZWxcbiAgICAgIC8vIEFycmF5IG9mIGFsbCB0aGUgbmVjY2Vzc2FyeSBjb250ZW50XG4gICAgICB0aGlzLl9jb250ZW50ID0gX2NvbnRlbnRcblxuICAgICAgLy8gdGhlIHBhcmVudCBvZiB0aGlzIHR5cGVcbiAgICAgIHRoaXMuX3BhcmVudCA9IG51bGxcbiAgICAgIHRoaXMuX2RlZXBFdmVudEhhbmRsZXIgPSBuZXcgWS51dGlscy5FdmVudExpc3RlbmVySGFuZGxlcigpXG5cbiAgICAgIC8vIHRoaXMuX2RlYnVnRXZlbnRzID0gW10gLy8gVE9ETzogcmVtb3ZlISFcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyID0gbmV3IFkudXRpbHMuRXZlbnRIYW5kbGVyKChvcCkgPT4ge1xuICAgICAgICAvLyB0aGlzLl9kZWJ1Z0V2ZW50cy5wdXNoKEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3ApKSlcbiAgICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICAvLyB3aGVuIHVzaW5nIGluZGV4ZWRkYiBkYiBhZGFwdGVyLCB0aGUgb3AgY291bGQgYWxyZWFkeSBleGlzdCAoc2VlIHktanMveS1pbmRleGVkZGIjMilcbiAgICAgICAgICBpZiAodGhpcy5fY29udGVudC5zb21lKGZ1bmN0aW9uIChjKSB7IHJldHVybiBZLnV0aWxzLmNvbXBhcmVJZHMoYy5pZCwgb3AuaWQpIH0pKSB7XG4gICAgICAgICAgICAvLyBvcCBleGlzdHNcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgcG9zXG4gICAgICAgICAgLy8gd2UgY2hlY2sgb3AubGVmdCBvbmx5ISxcbiAgICAgICAgICAvLyBiZWNhdXNlIG9wLnJpZ2h0IG1pZ2h0IG5vdCBiZSBkZWZpbmVkIHdoZW4gdGhpcyBpcyBjYWxsZWRcbiAgICAgICAgICBpZiAob3AubGVmdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcG9zID0gMFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb3MgPSAxICsgdGhpcy5fY29udGVudC5maW5kSW5kZXgoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFkudXRpbHMuY29tcGFyZUlkcyhjLmlkLCBvcC5sZWZ0KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChwb3MgPD0gMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgb3BlcmF0aW9uIScpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8qIChzZWUgYWJvdmUgZm9yIG5ldyBhcHByb2FjaClcbiAgICAgICAgICB2YXIgX2UgPSB0aGlzLl9jb250ZW50W3Bvc11cbiAgICAgICAgICAvLyB3aGVuIHVzaW5nIGluZGV4ZWRkYiBkYiBhZGFwdGVyLCB0aGUgb3AgY291bGQgYWxyZWFkeSBleGlzdCAoc2VlIHktanMveS1pbmRleGVkZGIjMilcbiAgICAgICAgICAvLyBJZiB0aGUgYWxnb3JpdGhtIHdvcmtzIGNvcnJlY3RseSwgdGhlIGRvdWJsZSBzaG91bGQgYWx3YXlzIGV4aXN0IG9uIHRoZSBjb3JyZWN0IHBvc2l0aW9uIChwb3MgLSB0aGUgY29tcHV0ZWQgZGVzdGluYXRpb24pXG4gICAgICAgICAgaWYgKF9lICE9IG51bGwgJiYgWS51dGlscy5jb21wYXJlSWRzKF9lLmlkLCBvcC5pZCkpIHtcbiAgICAgICAgICAgIC8vIGlzIGFscmVhZHkgZGVmaW5lZFxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfSovXG4gICAgICAgICAgdmFyIHZhbHVlc1xuICAgICAgICAgIHZhciBsZW5ndGhcbiAgICAgICAgICBpZiAob3AuaGFzT3duUHJvcGVydHkoJ29wQ29udGVudCcpKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250ZW50LnNwbGljZShwb3MsIDAsIHtcbiAgICAgICAgICAgICAgaWQ6IG9wLmlkLFxuICAgICAgICAgICAgICB0eXBlOiBvcC5vcENvbnRlbnRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBsZW5ndGggPSAxXG4gICAgICAgICAgICBsZXQgdHlwZSA9IHRoaXMub3MuZ2V0VHlwZShvcC5vcENvbnRlbnQpXG4gICAgICAgICAgICB0eXBlLl9wYXJlbnQgPSB0aGlzLl9tb2RlbFxuICAgICAgICAgICAgdmFsdWVzID0gW3R5cGVdXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBjb250ZW50cyA9IG9wLmNvbnRlbnQubWFwKGZ1bmN0aW9uIChjLCBpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaWQ6IFtvcC5pZFswXSwgb3AuaWRbMV0gKyBpXSxcbiAgICAgICAgICAgICAgICB2YWw6IGNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8vIGluc2VydCB2YWx1ZSBpbiBfY29udGVudFxuICAgICAgICAgICAgLy8gSXQgaXMgbm90IHBvc3NpYmxlIHRvIGluc2VydCBtb3JlIHRoYW4gfjJeMTYgZWxlbWVudHMgaW4gYW4gQXJyYXkgKHNlZSAjNSkuIFdlIGhhbmRsZSB0aGlzIGNhc2UgZXhwbGljaXRseVxuICAgICAgICAgICAgaWYgKGNvbnRlbnRzLmxlbmd0aCA8IDMwMDAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2NvbnRlbnQuc3BsaWNlLmFwcGx5KHRoaXMuX2NvbnRlbnQsIFtwb3MsIDBdLmNvbmNhdChjb250ZW50cykpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9jb250ZW50ID0gdGhpcy5fY29udGVudC5zbGljZSgwLCBwb3MpLmNvbmNhdChjb250ZW50cykuY29uY2F0KHRoaXMuX2NvbnRlbnQuc2xpY2UocG9zKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbHVlcyA9IG9wLmNvbnRlbnRcbiAgICAgICAgICAgIGxlbmd0aCA9IG9wLmNvbnRlbnQubGVuZ3RoXG4gICAgICAgICAgfVxuICAgICAgICAgIFkudXRpbHMuYnViYmxlRXZlbnQodGhpcywge1xuICAgICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICAgICAgICBpbmRleDogcG9zLFxuICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICBsZW5ndGg6IGxlbmd0aFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSBpZiAob3Auc3RydWN0ID09PSAnRGVsZXRlJykge1xuICAgICAgICAgIHZhciBpID0gMCAvLyBjdXJyZW50IHBvc2l0aW9uIGluIF9jb250ZW50XG4gICAgICAgICAgZm9yICg7IGkgPCB0aGlzLl9jb250ZW50Lmxlbmd0aCAmJiBvcC5sZW5ndGggPiAwOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjID0gdGhpcy5fY29udGVudFtpXVxuICAgICAgICAgICAgaWYgKFkudXRpbHMuaW5EZWxldGlvblJhbmdlKG9wLCBjLmlkKSkge1xuICAgICAgICAgICAgICAvLyBpcyBpbiBkZWxldGlvbiByYW5nZSFcbiAgICAgICAgICAgICAgdmFyIGRlbExlbmd0aFxuICAgICAgICAgICAgICAvLyBjaGVjayBob3cgbWFueSBjaGFyYWN0ZXIgdG8gZGVsZXRlIGluIG9uZSBmbHVzaFxuICAgICAgICAgICAgICBmb3IgKGRlbExlbmd0aCA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGRlbExlbmd0aCA8IG9wLmxlbmd0aCAmJiBpICsgZGVsTGVuZ3RoIDwgdGhpcy5fY29udGVudC5sZW5ndGggJiYgWS51dGlscy5pbkRlbGV0aW9uUmFuZ2Uob3AsIHRoaXMuX2NvbnRlbnRbaSArIGRlbExlbmd0aF0uaWQpO1xuICAgICAgICAgICAgICAgICAgICBkZWxMZW5ndGgrKykge31cbiAgICAgICAgICAgICAgLy8gbGFzdCBvcGVyYXRpb24gdGhhdCB3aWxsIGJlIGRlbGV0ZWRcbiAgICAgICAgICAgICAgYyA9IHRoaXMuX2NvbnRlbnRbaSArIGRlbExlbmd0aCAtIDFdXG4gICAgICAgICAgICAgIC8vIHVwZGF0ZSBkZWxldGUgb3BlcmF0aW9uXG4gICAgICAgICAgICAgIG9wLmxlbmd0aCAtPSBjLmlkWzFdIC0gb3AudGFyZ2V0WzFdICsgMVxuICAgICAgICAgICAgICBvcC50YXJnZXQgPSBbYy5pZFswXSwgYy5pZFsxXSArIDFdXG4gICAgICAgICAgICAgIC8vIGFwcGx5IGRlbGV0aW9uICYgZmluZCBzZW5kIGV2ZW50XG4gICAgICAgICAgICAgIGxldCBjb250ZW50ID0gdGhpcy5fY29udGVudC5zcGxpY2UoaSwgZGVsTGVuZ3RoKVxuICAgICAgICAgICAgICBsZXQgdmFsdWVzID0gY29udGVudC5tYXAoKGMpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYy52YWwgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGMudmFsXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9zLmdldFR5cGUoYy50eXBlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgWS51dGlscy5idWJibGVFdmVudCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2RlbGV0ZScsXG4gICAgICAgICAgICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgIHZhbHVlczogdmFsdWVzLFxuICAgICAgICAgICAgICAgIF9jb250ZW50OiBjb250ZW50LFxuICAgICAgICAgICAgICAgIGxlbmd0aDogZGVsTGVuZ3RoXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC8vIHdpdGggdGhlIGZyZXNoIGRlbGV0ZSBvcCwgd2UgY2FuIGNvbnRpbnVlXG4gICAgICAgICAgICAgIC8vIG5vdGU6IHdlIGRvbid0IGhhdmUgdG8gaW5jcmVtZW50IGksIGJlY2F1c2UgdGhlIGktdGggY29udGVudCB3YXMgZGVsZXRlZFxuICAgICAgICAgICAgICAvLyBidXQgb24gdGhlIG90aGVyIGhhZCwgdGhlIChpK2RlbExlbmd0aCktdGggd2FzIG5vdCBpbiBkZWxldGlvbiByYW5nZVxuICAgICAgICAgICAgICAvLyBTbyB3ZSBkb24ndCBkbyBpLS1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHN0cnVjdCEnKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICBfZ2V0UGF0aFRvQ2hpbGQgKGNoaWxkSWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jb250ZW50LmZpbmRJbmRleChjID0+XG4gICAgICAgIGMudHlwZSAhPSBudWxsICYmIFkudXRpbHMuY29tcGFyZUlkcyhjLnR5cGUsIGNoaWxkSWQpXG4gICAgICApXG4gICAgfVxuICAgIF9kZXN0cm95ICgpIHtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyLmRlc3Ryb3koKVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXIgPSBudWxsXG4gICAgICB0aGlzLl9jb250ZW50ID0gbnVsbFxuICAgICAgdGhpcy5fbW9kZWwgPSBudWxsXG4gICAgICB0aGlzLl9wYXJlbnQgPSBudWxsXG4gICAgICB0aGlzLm9zID0gbnVsbFxuICAgIH1cbiAgICBnZXQgbGVuZ3RoICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jb250ZW50Lmxlbmd0aFxuICAgIH1cbiAgICBnZXQgKHBvcykge1xuICAgICAgaWYgKHBvcyA9PSBudWxsIHx8IHR5cGVvZiBwb3MgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigncG9zIG11c3QgYmUgYSBudW1iZXIhJylcbiAgICAgIH1cbiAgICAgIGlmIChwb3MgPj0gdGhpcy5fY29udGVudC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2NvbnRlbnRbcG9zXS50eXBlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnRbcG9zXS52YWxcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9zLmdldFR5cGUodGhpcy5fY29udGVudFtwb3NdLnR5cGUpXG4gICAgICB9XG4gICAgfVxuICAgIHRvQXJyYXkgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnQubWFwKCh4LCBpKSA9PiB7XG4gICAgICAgIGlmICh4LnR5cGUgIT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9zLmdldFR5cGUoeC50eXBlKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB4LnZhbFxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICBwdXNoIChjb250ZW50cykge1xuICAgICAgcmV0dXJuIHRoaXMuaW5zZXJ0KHRoaXMuX2NvbnRlbnQubGVuZ3RoLCBjb250ZW50cylcbiAgICB9XG4gICAgaW5zZXJ0IChwb3MsIGNvbnRlbnRzKSB7XG4gICAgICBpZiAodHlwZW9mIHBvcyAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb3MgbXVzdCBiZSBhIG51bWJlciEnKVxuICAgICAgfVxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbnRlbnRzKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbnRlbnRzIG11c3QgYmUgYW4gQXJyYXkgb2Ygb2JqZWN0cyEnKVxuICAgICAgfVxuICAgICAgaWYgKGNvbnRlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChwb3MgPiB0aGlzLl9jb250ZW50Lmxlbmd0aCB8fCBwb3MgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhpcyBwb3NpdGlvbiBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgYXJyYXkhJylcbiAgICAgIH1cbiAgICAgIHZhciBtb3N0TGVmdCA9IHBvcyA9PT0gMCA/IG51bGwgOiB0aGlzLl9jb250ZW50W3BvcyAtIDFdLmlkXG5cbiAgICAgIHZhciBvcHMgPSBbXVxuICAgICAgdmFyIHByZXZJZCA9IG1vc3RMZWZ0XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRlbnRzLmxlbmd0aDspIHtcbiAgICAgICAgdmFyIG9wID0ge1xuICAgICAgICAgIGxlZnQ6IHByZXZJZCxcbiAgICAgICAgICBvcmlnaW46IHByZXZJZCxcbiAgICAgICAgICAvLyByaWdodDogbW9zdFJpZ2h0LFxuICAgICAgICAgIC8vIE5PVEU6IEkgaW50ZW50aW9uYWxseSBkbyBub3QgZGVmaW5lIHJpZ2h0IGhlcmUsIGJlY2F1c2UgaXQgY291bGQgYmUgZGVsZXRlZFxuICAgICAgICAgIC8vIGF0IHRoZSB0aW1lIG9mIGluc2VydGluZyB0aGlzIG9wZXJhdGlvbiAod2hlbiB3ZSBnZXQgdGhlIHRyYW5zYWN0aW9uKSxcbiAgICAgICAgICAvLyBhbmQgd291bGQgdGhlcmVmb3JlIG5vdCBkZWZpbmVkIGluIHRoaXMuX2NvbnRlbnRcbiAgICAgICAgICBwYXJlbnQ6IHRoaXMuX21vZGVsLFxuICAgICAgICAgIHN0cnVjdDogJ0luc2VydCdcbiAgICAgICAgfVxuICAgICAgICB2YXIgX2NvbnRlbnQgPSBbXVxuICAgICAgICB2YXIgdHlwZURlZmluaXRpb25cbiAgICAgICAgd2hpbGUgKGkgPCBjb250ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgdmFsID0gY29udGVudHNbaSsrXVxuICAgICAgICAgIHR5cGVEZWZpbml0aW9uID0gWS51dGlscy5pc1R5cGVEZWZpbml0aW9uKHZhbClcbiAgICAgICAgICBpZiAoIXR5cGVEZWZpbml0aW9uKSB7XG4gICAgICAgICAgICBfY29udGVudC5wdXNoKHZhbClcbiAgICAgICAgICB9IGVsc2UgaWYgKF9jb250ZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGktLSAvLyBjb21lIGJhY2sgYWdhaW4gbGF0ZXJcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChfY29udGVudC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgLy8gY29udGVudCBpcyBkZWZpbmVkXG4gICAgICAgICAgb3AuY29udGVudCA9IF9jb250ZW50XG4gICAgICAgICAgb3AuaWQgPSB0aGlzLm9zLmdldE5leHRPcElkKF9jb250ZW50Lmxlbmd0aClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBvdGhlcndpc2UgaXRzIGEgdHlwZVxuICAgICAgICAgIHZhciB0eXBlaWQgPSB0aGlzLm9zLmdldE5leHRPcElkKDEpXG4gICAgICAgICAgdGhpcy5vcy5jcmVhdGVUeXBlKHR5cGVEZWZpbml0aW9uLCB0eXBlaWQpXG4gICAgICAgICAgb3Aub3BDb250ZW50ID0gdHlwZWlkXG4gICAgICAgICAgb3AuaWQgPSB0aGlzLm9zLmdldE5leHRPcElkKDEpXG4gICAgICAgIH1cbiAgICAgICAgb3BzLnB1c2gob3ApXG4gICAgICAgIHByZXZJZCA9IG9wLmlkXG4gICAgICB9XG4gICAgICB2YXIgZXZlbnRIYW5kbGVyID0gdGhpcy5ldmVudEhhbmRsZXJcbiAgICAgIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICooKSB7XG4gICAgICAgIC8vIG5vdyB3ZSBjYW4gc2V0IHRoZSByaWdodCByZWZlcmVuY2UuXG4gICAgICAgIHZhciBtb3N0UmlnaHRcbiAgICAgICAgaWYgKG1vc3RMZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICB2YXIgbWwgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChtb3N0TGVmdClcbiAgICAgICAgICBtb3N0UmlnaHQgPSBtbC5yaWdodFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1vc3RSaWdodCA9ICh5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob3BzWzBdLnBhcmVudCkpLnN0YXJ0XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBvcHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgb3AgPSBvcHNbal1cbiAgICAgICAgICBvcC5yaWdodCA9IG1vc3RSaWdodFxuICAgICAgICB9XG4gICAgICAgIHlpZWxkKiBldmVudEhhbmRsZXIuYXdhaXRPcHModGhpcywgdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLCBbb3BzXSlcbiAgICAgIH0pXG4gICAgICAvLyBhbHdheXMgcmVtZW1iZXIgdG8gZG8gdGhhdCBhZnRlciB0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvblxuICAgICAgLy8gKG90aGVyd2lzZSB2YWx1ZXMgbWlnaHQgY29udGFpbiBhIHVuZGVmaW5lZCByZWZlcmVuY2UgdG8gdHlwZSlcbiAgICAgIGV2ZW50SGFuZGxlci5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChvcHMpXG4gICAgfVxuICAgIGRlbGV0ZSAocG9zLCBsZW5ndGgpIHtcbiAgICAgIGlmIChsZW5ndGggPT0gbnVsbCkgeyBsZW5ndGggPSAxIH1cbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2xlbmd0aCBtdXN0IGJlIGEgbnVtYmVyIScpXG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHBvcyAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb3MgbXVzdCBiZSBhIG51bWJlciEnKVxuICAgICAgfVxuICAgICAgaWYgKHBvcyArIGxlbmd0aCA+IHRoaXMuX2NvbnRlbnQubGVuZ3RoIHx8IHBvcyA8IDAgfHwgbGVuZ3RoIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBkZWxldGlvbiByYW5nZSBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgYXJyYXkhJylcbiAgICAgIH1cbiAgICAgIGlmIChsZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICB2YXIgZXZlbnRIYW5kbGVyID0gdGhpcy5ldmVudEhhbmRsZXJcbiAgICAgIHZhciBkZWxzID0gW11cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpID0gaSArIGRlbExlbmd0aCkge1xuICAgICAgICB2YXIgdGFyZ2V0SWQgPSB0aGlzLl9jb250ZW50W3BvcyArIGldLmlkXG4gICAgICAgIHZhciBkZWxMZW5ndGhcbiAgICAgICAgLy8gaG93IG1hbnkgaW5zZXJ0aW9ucyBjYW4gd2UgZGVsZXRlIGluIG9uZSBkZWxldGlvbj9cbiAgICAgICAgZm9yIChkZWxMZW5ndGggPSAxOyBpICsgZGVsTGVuZ3RoIDwgbGVuZ3RoOyBkZWxMZW5ndGgrKykge1xuICAgICAgICAgIGlmICghWS51dGlscy5jb21wYXJlSWRzKHRoaXMuX2NvbnRlbnRbcG9zICsgaSArIGRlbExlbmd0aF0uaWQsIFt0YXJnZXRJZFswXSwgdGFyZ2V0SWRbMV0gKyBkZWxMZW5ndGhdKSkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZGVscy5wdXNoKHtcbiAgICAgICAgICB0YXJnZXQ6IHRhcmdldElkLFxuICAgICAgICAgIHN0cnVjdDogJ0RlbGV0ZScsXG4gICAgICAgICAgbGVuZ3RoOiBkZWxMZW5ndGhcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICooKSB7XG4gICAgICAgIHlpZWxkKiBldmVudEhhbmRsZXIuYXdhaXRPcHModGhpcywgdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLCBbZGVsc10pXG4gICAgICB9KVxuICAgICAgLy8gYWx3YXlzIHJlbWVtYmVyIHRvIGRvIHRoYXQgYWZ0ZXIgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb25cbiAgICAgIC8vIChvdGhlcndpc2UgdmFsdWVzIG1pZ2h0IGNvbnRhaW4gYSB1bmRlZmluZWQgcmVmZXJlbmNlIHRvIHR5cGUpXG4gICAgICBldmVudEhhbmRsZXIuYXdhaXRBbmRQcmVtYXR1cmVseUNhbGwoZGVscylcbiAgICB9XG4gICAgb2JzZXJ2ZSAoZikge1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcihmKVxuICAgIH1cbiAgICBvYnNlcnZlRGVlcCAoZikge1xuICAgICAgdGhpcy5fZGVlcEV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIHVub2JzZXJ2ZSAoZikge1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihmKVxuICAgIH1cbiAgICB1bm9ic2VydmVEZWVwIChmKSB7XG4gICAgICB0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZilcbiAgICB9XG4gICAgKiBfY2hhbmdlZCAodHJhbnNhY3Rpb24sIG9wKSB7XG4gICAgICBpZiAoIW9wLmRlbGV0ZWQpIHtcbiAgICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICAvLyB1cGRhdGUgbGVmdFxuICAgICAgICAgIHZhciBsID0gb3AubGVmdFxuICAgICAgICAgIHZhciBsZWZ0XG4gICAgICAgICAgd2hpbGUgKGwgIT0gbnVsbCkge1xuICAgICAgICAgICAgbGVmdCA9IHlpZWxkKiB0cmFuc2FjdGlvbi5nZXRJbnNlcnRpb24obClcbiAgICAgICAgICAgIGlmICghbGVmdC5kZWxldGVkKSB7XG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsID0gbGVmdC5sZWZ0XG4gICAgICAgICAgfVxuICAgICAgICAgIG9wLmxlZnQgPSBsXG4gICAgICAgICAgLy8gaWYgb3AgY29udGFpbnMgb3BDb250ZW50LCBpbml0aWFsaXplIGl0XG4gICAgICAgICAgaWYgKG9wLm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICB5aWVsZCogdHJhbnNhY3Rpb24uc3RvcmUuaW5pdFR5cGUuY2FsbCh0cmFuc2FjdGlvbiwgb3Aub3BDb250ZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlci5yZWNlaXZlZE9wKG9wKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIFkuZXh0ZW5kKCdBcnJheScsIG5ldyBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKHtcbiAgICBuYW1lOiAnQXJyYXknLFxuICAgIGNsYXNzOiBZQXJyYXksXG4gICAgc3RydWN0OiAnTGlzdCcsXG4gICAgaW5pdFR5cGU6IGZ1bmN0aW9uICogWUFycmF5SW5pdGlhbGl6ZXIgKG9zLCBtb2RlbCkge1xuICAgICAgdmFyIF9jb250ZW50ID0gW11cbiAgICAgIHZhciBfdHlwZXMgPSBbXVxuICAgICAgeWllbGQqIFkuU3RydWN0Lkxpc3QubWFwLmNhbGwodGhpcywgbW9kZWwsIGZ1bmN0aW9uIChvcCkge1xuICAgICAgICBpZiAob3AuaGFzT3duUHJvcGVydHkoJ29wQ29udGVudCcpKSB7XG4gICAgICAgICAgX2NvbnRlbnQucHVzaCh7XG4gICAgICAgICAgICBpZDogb3AuaWQsXG4gICAgICAgICAgICB0eXBlOiBvcC5vcENvbnRlbnRcbiAgICAgICAgICB9KVxuICAgICAgICAgIF90eXBlcy5wdXNoKG9wLm9wQ29udGVudClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvcC5jb250ZW50LmZvckVhY2goZnVuY3Rpb24gKGMsIGkpIHtcbiAgICAgICAgICAgIF9jb250ZW50LnB1c2goe1xuICAgICAgICAgICAgICBpZDogW29wLmlkWzBdLCBvcC5pZFsxXSArIGldLFxuICAgICAgICAgICAgICB2YWw6IG9wLmNvbnRlbnRbaV1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgX3R5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB0eXBlID0geWllbGQqIHRoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLCBfdHlwZXNbaV0pXG4gICAgICAgIHR5cGUuX3BhcmVudCA9IG1vZGVsLmlkXG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFlBcnJheShvcywgbW9kZWwuaWQsIF9jb250ZW50KVxuICAgIH0sXG4gICAgY3JlYXRlVHlwZTogZnVuY3Rpb24gWUFycmF5Q3JlYXRlVHlwZSAob3MsIG1vZGVsKSB7XG4gICAgICByZXR1cm4gbmV3IFlBcnJheShvcywgbW9kZWwuaWQsIFtdKVxuICAgIH1cbiAgfSkpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5pZiAodHlwZW9mIFkgIT09ICd1bmRlZmluZWQnKSB7XG4gIGV4dGVuZChZKVxufVxuIiwiLyogZ2xvYmFsIFkgKi9cbid1c2Ugc3RyaWN0J1xuXG5mdW5jdGlvbiBleHRlbmQgKFkgLyogOmFueSAqLykge1xuICBjbGFzcyBZTWFwIGV4dGVuZHMgWS51dGlscy5DdXN0b21UeXBlIHtcbiAgICAvKiA6OlxuICAgIF9tb2RlbDogSWQ7XG4gICAgb3M6IFkuQWJzdHJhY3REYXRhYmFzZTtcbiAgICBtYXA6IE9iamVjdDtcbiAgICBjb250ZW50czogYW55O1xuICAgIG9wQ29udGVudHM6IE9iamVjdDtcbiAgICBldmVudEhhbmRsZXI6IEZ1bmN0aW9uO1xuICAgICovXG4gICAgY29uc3RydWN0b3IgKG9zLCBtb2RlbCwgY29udGVudHMsIG9wQ29udGVudHMpIHtcbiAgICAgIHN1cGVyKClcbiAgICAgIHRoaXMuX21vZGVsID0gbW9kZWwuaWRcbiAgICAgIHRoaXMuX3BhcmVudCA9IG51bGxcbiAgICAgIHRoaXMuX2RlZXBFdmVudEhhbmRsZXIgPSBuZXcgWS51dGlscy5FdmVudExpc3RlbmVySGFuZGxlcigpXG4gICAgICB0aGlzLm9zID0gb3NcbiAgICAgIHRoaXMubWFwID0gWS51dGlscy5jb3B5T2JqZWN0KG1vZGVsLm1hcClcbiAgICAgIHRoaXMuY29udGVudHMgPSBjb250ZW50c1xuICAgICAgdGhpcy5vcENvbnRlbnRzID0gb3BDb250ZW50c1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXIgPSBuZXcgWS51dGlscy5FdmVudEhhbmRsZXIob3AgPT4ge1xuICAgICAgICB2YXIgb2xkVmFsdWVcbiAgICAgICAgLy8ga2V5IGlzIHRoZSBuYW1lIHRvIHVzZSB0byBhY2Nlc3MgKG9wKWNvbnRlbnRcbiAgICAgICAgdmFyIGtleSA9IG9wLnN0cnVjdCA9PT0gJ0RlbGV0ZScgPyBvcC5rZXkgOiBvcC5wYXJlbnRTdWJcblxuICAgICAgICAvLyBjb21wdXRlIG9sZFZhbHVlXG4gICAgICAgIGlmICh0aGlzLm9wQ29udGVudHNba2V5XSAhPSBudWxsKSB7XG4gICAgICAgICAgb2xkVmFsdWUgPSB0aGlzLm9zLmdldFR5cGUodGhpcy5vcENvbnRlbnRzW2tleV0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2xkVmFsdWUgPSB0aGlzLmNvbnRlbnRzW2tleV1cbiAgICAgICAgfVxuICAgICAgICAvLyBjb21wdXRlIG9wIGV2ZW50XG4gICAgICAgIGlmIChvcC5zdHJ1Y3QgPT09ICdJbnNlcnQnKSB7XG4gICAgICAgICAgaWYgKG9wLmxlZnQgPT09IG51bGwgJiYgIVkudXRpbHMuY29tcGFyZUlkcyhvcC5pZCwgdGhpcy5tYXBba2V5XSkpIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZVxuICAgICAgICAgICAgLy8gVE9ETzogd2hhdCBpZiBvcC5kZWxldGVkPz8/IEkgcGFydGlhbGx5IGhhbmRsZXMgdGhpcyBjYXNlIGhlcmUuLiBidXQgbmVlZCB0byBzZW5kIGRlbGV0ZSBldmVudCBpbnN0ZWFkLiBzb21laG93IHJlbGF0ZWQgdG8gIzRcbiAgICAgICAgICAgIGlmIChvcC5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICB2YWx1ZSA9IHRoaXMub3MuZ2V0VHlwZShvcC5vcENvbnRlbnQpXG4gICAgICAgICAgICAgIHZhbHVlLl9wYXJlbnQgPSB0aGlzLl9tb2RlbFxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jb250ZW50c1trZXldXG4gICAgICAgICAgICAgIGlmIChvcC5kZWxldGVkKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMub3BDb250ZW50c1trZXldXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vcENvbnRlbnRzW2tleV0gPSBvcC5vcENvbnRlbnRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBvcC5jb250ZW50WzBdXG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLm9wQ29udGVudHNba2V5XVxuICAgICAgICAgICAgICBpZiAob3AuZGVsZXRlZCkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRlbnRzW2tleV1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRlbnRzW2tleV0gPSBvcC5jb250ZW50WzBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubWFwW2tleV0gPSBvcC5pZFxuICAgICAgICAgICAgaWYgKG9sZFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgWS51dGlscy5idWJibGVFdmVudCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgbmFtZToga2V5LFxuICAgICAgICAgICAgICAgIG9iamVjdDogdGhpcyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIFkudXRpbHMuYnViYmxlRXZlbnQodGhpcywge1xuICAgICAgICAgICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgICAgICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICAgICAgICAgICAgb2xkVmFsdWU6IG9sZFZhbHVlLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChvcC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgaWYgKFkudXRpbHMuY29tcGFyZUlkcyh0aGlzLm1hcFtrZXldLCBvcC50YXJnZXQpKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5vcENvbnRlbnRzW2tleV1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRlbnRzW2tleV1cbiAgICAgICAgICAgIFkudXRpbHMuYnViYmxlRXZlbnQodGhpcywge1xuICAgICAgICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgICAgICAgIG9iamVjdDogdGhpcyxcbiAgICAgICAgICAgICAgb2xkVmFsdWU6IG9sZFZhbHVlLFxuICAgICAgICAgICAgICB0eXBlOiAnZGVsZXRlJ1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIE9wZXJhdGlvbiEnKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICBfZ2V0UGF0aFRvQ2hpbGQgKGNoaWxkSWQpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLm9wQ29udGVudHMpLmZpbmQoa2V5ID0+XG4gICAgICAgIFkudXRpbHMuY29tcGFyZUlkcyh0aGlzLm9wQ29udGVudHNba2V5XSwgY2hpbGRJZClcbiAgICAgIClcbiAgICB9XG4gICAgX2Rlc3Ryb3kgKCkge1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXIuZGVzdHJveSgpXG4gICAgICB0aGlzLmV2ZW50SGFuZGxlciA9IG51bGxcbiAgICAgIHRoaXMuY29udGVudHMgPSBudWxsXG4gICAgICB0aGlzLm9wQ29udGVudHMgPSBudWxsXG4gICAgICB0aGlzLl9tb2RlbCA9IG51bGxcbiAgICAgIHRoaXMuX3BhcmVudCA9IG51bGxcbiAgICAgIHRoaXMub3MgPSBudWxsXG4gICAgICB0aGlzLm1hcCA9IG51bGxcbiAgICB9XG4gICAgZ2V0IChrZXkpIHtcbiAgICAgIC8vIHJldHVybiBwcm9wZXJ0eS5cbiAgICAgIC8vIGlmIHByb3BlcnR5IGRvZXMgbm90IGV4aXN0LCByZXR1cm4gbnVsbFxuICAgICAgLy8gaWYgcHJvcGVydHkgaXMgYSB0eXBlLCByZXR1cm4gaXRcbiAgICAgIGlmIChrZXkgPT0gbnVsbCB8fCB0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHNwZWNpZnkgYSBrZXkgKGFzIHN0cmluZykhJylcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm9wQ29udGVudHNba2V5XSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnRzW2tleV1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9zLmdldFR5cGUodGhpcy5vcENvbnRlbnRzW2tleV0pXG4gICAgICB9XG4gICAgfVxuICAgIGtleXMgKCkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29udGVudHMpLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLm9wQ29udGVudHMpKVxuICAgIH1cbiAgICBrZXlzUHJpbWl0aXZlcyAoKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5jb250ZW50cylcbiAgICB9XG4gICAga2V5c1R5cGVzICgpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLm9wQ29udGVudHMpXG4gICAgfVxuICAgIC8qXG4gICAgICBJZiB0aGVyZSBpcyBhIHByaW1pdGl2ZSAobm90IGEgY3VzdG9tIHR5cGUpLCB0aGVuIHJldHVybiBpdC5cbiAgICAgIFJldHVybnMgYWxsIHByaW1pdGl2ZSB2YWx1ZXMsIGlmIHByb3BlcnR5TmFtZSBpcyBzcGVjaWZpZWQhXG4gICAgICBOb3RlOiBtb2RpZnlpbmcgdGhlIHJldHVybiB2YWx1ZSBjb3VsZCByZXN1bHQgaW4gaW5jb25zaXN0ZW5jaWVzIVxuICAgICAgICAtLSBzbyBtYWtlIHN1cmUgdG8gY29weSBpdCBmaXJzdCFcbiAgICAqL1xuICAgIGdldFByaW1pdGl2ZSAoa2V5KSB7XG4gICAgICBpZiAoa2V5ID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIFkudXRpbHMuY29weU9iamVjdCh0aGlzLmNvbnRlbnRzKVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0tleSBpcyBleHBlY3RlZCB0byBiZSBhIHN0cmluZyEnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudHNba2V5XVxuICAgICAgfVxuICAgIH1cbiAgICBnZXRUeXBlIChrZXkpIHtcbiAgICAgIGlmIChrZXkgPT0gbnVsbCB8fCB0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHNwZWNpZnkgYSBrZXkgKGFzIHN0cmluZykhJylcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcENvbnRlbnRzW2tleV0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcy5nZXRUeXBlKHRoaXMub3BDb250ZW50c1trZXldKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG4gICAgZGVsZXRlIChrZXkpIHtcbiAgICAgIHZhciByaWdodCA9IHRoaXMubWFwW2tleV1cbiAgICAgIGlmIChyaWdodCAhPSBudWxsKSB7XG4gICAgICAgIHZhciBkZWwgPSB7XG4gICAgICAgICAgdGFyZ2V0OiByaWdodCxcbiAgICAgICAgICBzdHJ1Y3Q6ICdEZWxldGUnXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGV2ZW50SGFuZGxlciA9IHRoaXMuZXZlbnRIYW5kbGVyXG4gICAgICAgIHZhciBtb2REZWwgPSBZLnV0aWxzLmNvcHlPYmplY3QoZGVsKVxuICAgICAgICBtb2REZWwua2V5ID0ga2V5XG4gICAgICAgIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICooKSB7XG4gICAgICAgICAgeWllbGQqIGV2ZW50SGFuZGxlci5hd2FpdE9wcyh0aGlzLCB0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsIFtbZGVsXV0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vIGFsd2F5cyByZW1lbWJlciB0byBkbyB0aGF0IGFmdGVyIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uXG4gICAgICAgIC8vIChvdGhlcndpc2UgdmFsdWVzIG1pZ2h0IGNvbnRhaW4gYSB1bmRlZmluZWQgcmVmZXJlbmNlIHRvIHR5cGUpXG4gICAgICAgIGV2ZW50SGFuZGxlci5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChbbW9kRGVsXSlcbiAgICAgIH1cbiAgICB9XG4gICAgc2V0IChrZXksIHZhbHVlKSB7XG4gICAgICAvLyBzZXQgcHJvcGVydHkuXG4gICAgICAvLyBpZiBwcm9wZXJ0eSBpcyBhIHR5cGUsIHJldHVybiBpdFxuICAgICAgLy8gaWYgbm90LCBhcHBseSBpbW1lZGlhdGVseSBvbiB0aGlzIHR5cGUgYW4gY2FsbCBldmVudFxuXG4gICAgICB2YXIgcmlnaHQgPSB0aGlzLm1hcFtrZXldIHx8IG51bGxcbiAgICAgIHZhciBpbnNlcnQgLyogOmFueSAqLyA9IHtcbiAgICAgICAgaWQ6IHRoaXMub3MuZ2V0TmV4dE9wSWQoMSksXG4gICAgICAgIGxlZnQ6IG51bGwsXG4gICAgICAgIHJpZ2h0OiByaWdodCxcbiAgICAgICAgb3JpZ2luOiBudWxsLFxuICAgICAgICBwYXJlbnQ6IHRoaXMuX21vZGVsLFxuICAgICAgICBwYXJlbnRTdWI6IGtleSxcbiAgICAgICAgc3RydWN0OiAnSW5zZXJ0J1xuICAgICAgfVxuICAgICAgdmFyIGV2ZW50SGFuZGxlciA9IHRoaXMuZXZlbnRIYW5kbGVyXG4gICAgICB2YXIgdHlwZURlZmluaXRpb24gPSBZLnV0aWxzLmlzVHlwZURlZmluaXRpb24odmFsdWUpXG4gICAgICBpZiAodHlwZURlZmluaXRpb24gIT09IGZhbHNlKSB7XG4gICAgICAgIHZhciB0eXBlID0gdGhpcy5vcy5jcmVhdGVUeXBlKHR5cGVEZWZpbml0aW9uKVxuICAgICAgICBpbnNlcnQub3BDb250ZW50ID0gdHlwZS5fbW9kZWxcbiAgICAgICAgLy8gY29uc3RydWN0IGEgbmV3IHR5cGVcbiAgICAgICAgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgICB5aWVsZCogZXZlbnRIYW5kbGVyLmF3YWl0T3BzKHRoaXMsIHRoaXMuYXBwbHlDcmVhdGVkT3BlcmF0aW9ucywgW1tpbnNlcnRdXSlcbiAgICAgICAgfSlcbiAgICAgICAgLy8gYWx3YXlzIHJlbWVtYmVyIHRvIGRvIHRoYXQgYWZ0ZXIgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb25cbiAgICAgICAgLy8gKG90aGVyd2lzZSB2YWx1ZXMgbWlnaHQgY29udGFpbiBhIHVuZGVmaW5lZCByZWZlcmVuY2UgdG8gdHlwZSlcbiAgICAgICAgZXZlbnRIYW5kbGVyLmF3YWl0QW5kUHJlbWF0dXJlbHlDYWxsKFtpbnNlcnRdKVxuICAgICAgICByZXR1cm4gdHlwZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zZXJ0LmNvbnRlbnQgPSBbdmFsdWVdXG4gICAgICAgIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogKCkge1xuICAgICAgICAgIHlpZWxkKiBldmVudEhhbmRsZXIuYXdhaXRPcHModGhpcywgdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLCBbW2luc2VydF1dKVxuICAgICAgICB9KVxuICAgICAgICAvLyBhbHdheXMgcmVtZW1iZXIgdG8gZG8gdGhhdCBhZnRlciB0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvblxuICAgICAgICAvLyAob3RoZXJ3aXNlIHZhbHVlcyBtaWdodCBjb250YWluIGEgdW5kZWZpbmVkIHJlZmVyZW5jZSB0byB0eXBlKVxuICAgICAgICBldmVudEhhbmRsZXIuYXdhaXRBbmRQcmVtYXR1cmVseUNhbGwoW2luc2VydF0pXG4gICAgICAgIHJldHVybiB2YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgICBvYnNlcnZlIChmKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIG9ic2VydmVEZWVwIChmKSB7XG4gICAgICB0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIoZilcbiAgICB9XG4gICAgdW5vYnNlcnZlIChmKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIHVub2JzZXJ2ZURlZXAgKGYpIHtcbiAgICAgIHRoaXMuX2RlZXBFdmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihmKVxuICAgIH1cbiAgICAvKlxuICAgICAgT2JzZXJ2ZSBhIHBhdGguXG5cbiAgICAgIEUuZy5cbiAgICAgIGBgYFxuICAgICAgby5zZXQoJ3RleHRhcmVhJywgWS5UZXh0QmluZClcbiAgICAgIG8ub2JzZXJ2ZVBhdGgoWyd0ZXh0YXJlYSddLCBmdW5jdGlvbih0KXtcbiAgICAgICAgLy8gaXMgY2FsbGVkIHdoZW5ldmVyIHRleHRhcmVhIGlzIHJlcGxhY2VkXG4gICAgICAgIHQuYmluZCh0ZXh0YXJlYSlcbiAgICAgIH0pXG5cbiAgICAgIHJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHJlbW92ZXMgdGhlIG9ic2VydmVyIGZyb20gdGhlIHBhdGguXG4gICAgKi9cbiAgICBvYnNlcnZlUGF0aCAocGF0aCwgZikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICB2YXIgcHJvcGVydHlOYW1lXG4gICAgICBmdW5jdGlvbiBvYnNlcnZlUHJvcGVydHkgKGV2ZW50KSB7XG4gICAgICAgIC8vIGNhbGwgZiB3aGVuZXZlciBwYXRoIGNoYW5nZXNcbiAgICAgICAgaWYgKGV2ZW50Lm5hbWUgPT09IHByb3BlcnR5TmFtZSkge1xuICAgICAgICAgIC8vIGNhbGwgdGhpcyBhbHNvIGZvciBkZWxldGUgZXZlbnRzIVxuICAgICAgICAgIGYoc2VsZi5nZXQocHJvcGVydHlOYW1lKSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGF0aC5sZW5ndGggPCAxKSB7XG4gICAgICAgIGYodGhpcylcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHt9XG4gICAgICB9IGVsc2UgaWYgKHBhdGgubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHByb3BlcnR5TmFtZSA9IHBhdGhbMF1cbiAgICAgICAgZihzZWxmLmdldChwcm9wZXJ0eU5hbWUpKVxuICAgICAgICB0aGlzLm9ic2VydmUob2JzZXJ2ZVByb3BlcnR5KVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHNlbGYudW5vYnNlcnZlKGYpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBkZWxldGVDaGlsZE9ic2VydmVyc1xuICAgICAgICB2YXIgcmVzZXRPYnNlcnZlclBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIG1hcCA9IHNlbGYuZ2V0KHBhdGhbMF0pXG4gICAgICAgICAgaWYgKCEobWFwIGluc3RhbmNlb2YgWU1hcCkpIHtcbiAgICAgICAgICAgIC8vIGl0cyBlaXRoZXIgbm90IGRlZmluZWQgb3IgYSBwcmltaXRpdmUgdmFsdWUgLyBub3QgYSBtYXBcbiAgICAgICAgICAgIG1hcCA9IHNlbGYuc2V0KHBhdGhbMF0sIFkuTWFwKVxuICAgICAgICAgIH1cbiAgICAgICAgICBkZWxldGVDaGlsZE9ic2VydmVycyA9IG1hcC5vYnNlcnZlUGF0aChwYXRoLnNsaWNlKDEpLCBmKVxuICAgICAgICB9XG4gICAgICAgIHZhciBvYnNlcnZlciA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgIGlmIChldmVudC5uYW1lID09PSBwYXRoWzBdKSB7XG4gICAgICAgICAgICBpZiAoZGVsZXRlQ2hpbGRPYnNlcnZlcnMgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBkZWxldGVDaGlsZE9ic2VydmVycygpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2FkZCcgfHwgZXZlbnQudHlwZSA9PT0gJ3VwZGF0ZScpIHtcbiAgICAgICAgICAgICAgcmVzZXRPYnNlcnZlclBhdGgoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVE9ETzogd2hhdCBhYm91dCB0aGUgZGVsZXRlIGV2ZW50cz9cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5vYnNlcnZlKG9ic2VydmVyKVxuICAgICAgICByZXNldE9ic2VydmVyUGF0aCgpXG4gICAgICAgIC8vIHJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGRlbGV0ZXMgYWxsIHRoZSBjaGlsZCBvYnNlcnZlcnNcbiAgICAgICAgLy8gYW5kIGhvdyB0byB1bm9ic2VydmUgdGhlIG9ic2VydmUgZnJvbSB0aGlzIG9iamVjdFxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChkZWxldGVDaGlsZE9ic2VydmVycyAhPSBudWxsKSB7XG4gICAgICAgICAgICBkZWxldGVDaGlsZE9ic2VydmVycygpXG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGYudW5vYnNlcnZlKG9ic2VydmVyKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgICogX2NoYW5nZWQgKHRyYW5zYWN0aW9uLCBvcCkge1xuICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgaWYgKG9wLmtleSA9PSBudWxsKSB7XG4gICAgICAgICAgdmFyIHRhcmdldCA9IHlpZWxkKiB0cmFuc2FjdGlvbi5nZXRPcGVyYXRpb24ob3AudGFyZ2V0KVxuICAgICAgICAgIG9wLmtleSA9IHRhcmdldC5wYXJlbnRTdWJcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChvcC5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICB5aWVsZCogdHJhbnNhY3Rpb24uc3RvcmUuaW5pdFR5cGUuY2FsbCh0cmFuc2FjdGlvbiwgb3Aub3BDb250ZW50KVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXIucmVjZWl2ZWRPcChvcClcbiAgICB9XG4gIH1cbiAgWS5leHRlbmQoJ01hcCcsIG5ldyBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKHtcbiAgICBuYW1lOiAnTWFwJyxcbiAgICBjbGFzczogWU1hcCxcbiAgICBzdHJ1Y3Q6ICdNYXAnLFxuICAgIGluaXRUeXBlOiBmdW5jdGlvbiAqIFlNYXBJbml0aWFsaXplciAob3MsIG1vZGVsKSB7XG4gICAgICB2YXIgY29udGVudHMgPSB7fVxuICAgICAgdmFyIG9wQ29udGVudHMgPSB7fVxuICAgICAgdmFyIG1hcCA9IG1vZGVsLm1hcFxuICAgICAgZm9yICh2YXIgbmFtZSBpbiBtYXApIHtcbiAgICAgICAgdmFyIG9wID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG1hcFtuYW1lXSlcbiAgICAgICAgaWYgKG9wLmRlbGV0ZWQpIGNvbnRpbnVlXG4gICAgICAgIGlmIChvcC5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIG9wQ29udGVudHNbbmFtZV0gPSBvcC5vcENvbnRlbnRcbiAgICAgICAgICB2YXIgdHlwZSA9IHlpZWxkKiB0aGlzLnN0b3JlLmluaXRUeXBlLmNhbGwodGhpcywgb3Aub3BDb250ZW50KVxuICAgICAgICAgIHR5cGUuX3BhcmVudCA9IG1vZGVsLmlkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGVudHNbbmFtZV0gPSBvcC5jb250ZW50WzBdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgWU1hcChvcywgbW9kZWwsIGNvbnRlbnRzLCBvcENvbnRlbnRzKVxuICAgIH0sXG4gICAgY3JlYXRlVHlwZTogZnVuY3Rpb24gWU1hcENyZWF0b3IgKG9zLCBtb2RlbCkge1xuICAgICAgcmV0dXJuIG5ldyBZTWFwKG9zLCBtb2RlbCwge30sIHt9KVxuICAgIH1cbiAgfSkpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5pZiAodHlwZW9mIFkgIT09ICd1bmRlZmluZWQnKSB7XG4gIGV4dGVuZChZKVxufVxuIiwiLyogZ2xvYmFsIFkgKi9cbid1c2Ugc3RyaWN0J1xuXG5mdW5jdGlvbiBleHRlbmQgKFkpIHtcbiAgcmVxdWlyZSgnLi9SZWRCbGFja1RyZWUuanMnKShZKVxuICBjbGFzcyBUcmFuc2FjdGlvbiBleHRlbmRzIFkuVHJhbnNhY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yIChzdG9yZSkge1xuICAgICAgc3VwZXIoc3RvcmUpXG4gICAgICB0aGlzLnN0b3JlID0gc3RvcmVcbiAgICAgIHRoaXMuc3MgPSBzdG9yZS5zc1xuICAgICAgdGhpcy5vcyA9IHN0b3JlLm9zXG4gICAgICB0aGlzLmRzID0gc3RvcmUuZHNcbiAgICB9XG4gIH1cbiAgdmFyIFN0b3JlID0gWS51dGlscy5SQlRyZWVcbiAgdmFyIEJ1ZmZlcmVkU3RvcmUgPSBZLnV0aWxzLmNyZWF0ZVNtYWxsTG9va3VwQnVmZmVyKFN0b3JlKVxuXG4gIGNsYXNzIERhdGFiYXNlIGV4dGVuZHMgWS5BYnN0cmFjdERhdGFiYXNlIHtcbiAgICBjb25zdHJ1Y3RvciAoeSwgb3B0cykge1xuICAgICAgc3VwZXIoeSwgb3B0cylcbiAgICAgIHRoaXMub3MgPSBuZXcgQnVmZmVyZWRTdG9yZSgpXG4gICAgICB0aGlzLmRzID0gbmV3IFN0b3JlKClcbiAgICAgIHRoaXMuc3MgPSBuZXcgQnVmZmVyZWRTdG9yZSgpXG4gICAgfVxuICAgIGxvZ1RhYmxlICgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgc2VsZi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdVc2VyOiAnLCB0aGlzLnN0b3JlLnkuY29ubmVjdG9yLnVzZXJJZCwgXCI9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cIikgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICBjb25zb2xlLmxvZyhcIlN0YXRlIFNldCAoU1MpOlwiLCB5aWVsZCogdGhpcy5nZXRTdGF0ZVNldCgpKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGNvbnNvbGUubG9nKFwiT3BlcmF0aW9uIFN0b3JlIChPUyk6XCIpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgeWllbGQqIHRoaXMub3MubG9nVGFibGUoKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGNvbnNvbGUubG9nKFwiRGVsZXRpb24gU3RvcmUgKERTKTpcIikgLy9lc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIHlpZWxkKiB0aGlzLmRzLmxvZ1RhYmxlKCkgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICBpZiAodGhpcy5zdG9yZS5nYzEubGVuZ3RoID4gMCB8fCB0aGlzLnN0b3JlLmdjMi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdHQzF8MiBub3QgZW1wdHkhJywgdGhpcy5zdG9yZS5nYzEsIHRoaXMuc3RvcmUuZ2MyKVxuICAgICAgICB9XG4gICAgICAgIGlmIChKU09OLnN0cmluZ2lmeSh0aGlzLnN0b3JlLmxpc3RlbmVyc0J5SWQpICE9PSAne30nKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdsaXN0ZW5lcnNCeUlkIG5vdCBlbXB0eSEnKVxuICAgICAgICB9XG4gICAgICAgIGlmIChKU09OLnN0cmluZ2lmeSh0aGlzLnN0b3JlLmxpc3RlbmVyc0J5SWRFeGVjdXRlTm93KSAhPT0gJ1tdJykge1xuICAgICAgICAgIGNvbnNvbGUud2FybignbGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3cgbm90IGVtcHR5IScpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RvcmUudHJhbnNhY3Rpb25JblByb2dyZXNzKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdUcmFuc2FjdGlvbiBzdGlsbCBpbiBwcm9ncmVzcyEnKVxuICAgICAgICB9XG4gICAgICB9LCB0cnVlKVxuICAgIH1cbiAgICB0cmFuc2FjdCAobWFrZUdlbikge1xuICAgICAgdmFyIHQgPSBuZXcgVHJhbnNhY3Rpb24odGhpcylcbiAgICAgIHdoaWxlIChtYWtlR2VuICE9PSBudWxsKSB7XG4gICAgICAgIHZhciBnZW4gPSBtYWtlR2VuLmNhbGwodClcbiAgICAgICAgdmFyIHJlcyA9IGdlbi5uZXh0KClcbiAgICAgICAgd2hpbGUgKCFyZXMuZG9uZSkge1xuICAgICAgICAgIHJlcyA9IGdlbi5uZXh0KHJlcy52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgICBtYWtlR2VuID0gdGhpcy5nZXROZXh0UmVxdWVzdCgpXG4gICAgICB9XG4gICAgfVxuICAgICogZGVzdHJveSAoKSB7XG4gICAgICB5aWVsZCogc3VwZXIuZGVzdHJveSgpXG4gICAgICBkZWxldGUgdGhpcy5vc1xuICAgICAgZGVsZXRlIHRoaXMuc3NcbiAgICAgIGRlbGV0ZSB0aGlzLmRzXG4gICAgfVxuICB9XG4gIFkuZXh0ZW5kKCdtZW1vcnknLCBEYXRhYmFzZSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCIndXNlIHN0cmljdCdcblxuLypcbiAgVGhpcyBmaWxlIGNvbnRhaW5zIGEgbm90IHNvIGZhbmN5IGltcGxlbWFudGlvbiBvZiBhIFJlZCBCbGFjayBUcmVlLlxuKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFkpIHtcbiAgY2xhc3MgTiB7XG4gICAgLy8gQSBjcmVhdGVkIG5vZGUgaXMgYWx3YXlzIHJlZCFcbiAgICBjb25zdHJ1Y3RvciAodmFsKSB7XG4gICAgICB0aGlzLnZhbCA9IHZhbFxuICAgICAgdGhpcy5jb2xvciA9IHRydWVcbiAgICAgIHRoaXMuX2xlZnQgPSBudWxsXG4gICAgICB0aGlzLl9yaWdodCA9IG51bGxcbiAgICAgIHRoaXMuX3BhcmVudCA9IG51bGxcbiAgICAgIGlmICh2YWwuaWQgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBkZWZpbmUgaWQhJylcbiAgICAgIH1cbiAgICB9XG4gICAgaXNSZWQgKCkgeyByZXR1cm4gdGhpcy5jb2xvciB9XG4gICAgaXNCbGFjayAoKSB7IHJldHVybiAhdGhpcy5jb2xvciB9XG4gICAgcmVkZGVuICgpIHsgdGhpcy5jb2xvciA9IHRydWU7IHJldHVybiB0aGlzIH1cbiAgICBibGFja2VuICgpIHsgdGhpcy5jb2xvciA9IGZhbHNlOyByZXR1cm4gdGhpcyB9XG4gICAgZ2V0IGdyYW5kcGFyZW50ICgpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudC5wYXJlbnRcbiAgICB9XG4gICAgZ2V0IHBhcmVudCAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcGFyZW50XG4gICAgfVxuICAgIGdldCBzaWJsaW5nICgpIHtcbiAgICAgIHJldHVybiAodGhpcyA9PT0gdGhpcy5wYXJlbnQubGVmdClcbiAgICAgICAgPyB0aGlzLnBhcmVudC5yaWdodCA6IHRoaXMucGFyZW50LmxlZnRcbiAgICB9XG4gICAgZ2V0IGxlZnQgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2xlZnRcbiAgICB9XG4gICAgZ2V0IHJpZ2h0ICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9yaWdodFxuICAgIH1cbiAgICBzZXQgbGVmdCAobikge1xuICAgICAgaWYgKG4gIT09IG51bGwpIHtcbiAgICAgICAgbi5fcGFyZW50ID0gdGhpc1xuICAgICAgfVxuICAgICAgdGhpcy5fbGVmdCA9IG5cbiAgICB9XG4gICAgc2V0IHJpZ2h0IChuKSB7XG4gICAgICBpZiAobiAhPT0gbnVsbCkge1xuICAgICAgICBuLl9wYXJlbnQgPSB0aGlzXG4gICAgICB9XG4gICAgICB0aGlzLl9yaWdodCA9IG5cbiAgICB9XG4gICAgcm90YXRlTGVmdCAodHJlZSkge1xuICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50XG4gICAgICB2YXIgbmV3UGFyZW50ID0gdGhpcy5yaWdodFxuICAgICAgdmFyIG5ld1JpZ2h0ID0gdGhpcy5yaWdodC5sZWZ0XG4gICAgICBuZXdQYXJlbnQubGVmdCA9IHRoaXNcbiAgICAgIHRoaXMucmlnaHQgPSBuZXdSaWdodFxuICAgICAgaWYgKHBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICB0cmVlLnJvb3QgPSBuZXdQYXJlbnRcbiAgICAgICAgbmV3UGFyZW50Ll9wYXJlbnQgPSBudWxsXG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5sZWZ0ID09PSB0aGlzKSB7XG4gICAgICAgIHBhcmVudC5sZWZ0ID0gbmV3UGFyZW50XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5yaWdodCA9PT0gdGhpcykge1xuICAgICAgICBwYXJlbnQucmlnaHQgPSBuZXdQYXJlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGVsZW1lbnRzIGFyZSB3cm9uZ2x5IGNvbm5lY3RlZCEnKVxuICAgICAgfVxuICAgIH1cbiAgICBuZXh0ICgpIHtcbiAgICAgIGlmICh0aGlzLnJpZ2h0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIHNlYXJjaCB0aGUgbW9zdCBsZWZ0IG5vZGUgaW4gdGhlIHJpZ2h0IHRyZWVcbiAgICAgICAgdmFyIG8gPSB0aGlzLnJpZ2h0XG4gICAgICAgIHdoaWxlIChvLmxlZnQgIT09IG51bGwpIHtcbiAgICAgICAgICBvID0gby5sZWZ0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwID0gdGhpc1xuICAgICAgICB3aGlsZSAocC5wYXJlbnQgIT09IG51bGwgJiYgcCAhPT0gcC5wYXJlbnQubGVmdCkge1xuICAgICAgICAgIHAgPSBwLnBhcmVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwLnBhcmVudFxuICAgICAgfVxuICAgIH1cbiAgICBwcmV2ICgpIHtcbiAgICAgIGlmICh0aGlzLmxlZnQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gc2VhcmNoIHRoZSBtb3N0IHJpZ2h0IG5vZGUgaW4gdGhlIGxlZnQgdHJlZVxuICAgICAgICB2YXIgbyA9IHRoaXMubGVmdFxuICAgICAgICB3aGlsZSAoby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgIG8gPSBvLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwID0gdGhpc1xuICAgICAgICB3aGlsZSAocC5wYXJlbnQgIT09IG51bGwgJiYgcCAhPT0gcC5wYXJlbnQucmlnaHQpIHtcbiAgICAgICAgICBwID0gcC5wYXJlbnRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcC5wYXJlbnRcbiAgICAgIH1cbiAgICB9XG4gICAgcm90YXRlUmlnaHQgKHRyZWUpIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudFxuICAgICAgdmFyIG5ld1BhcmVudCA9IHRoaXMubGVmdFxuICAgICAgdmFyIG5ld0xlZnQgPSB0aGlzLmxlZnQucmlnaHRcbiAgICAgIG5ld1BhcmVudC5yaWdodCA9IHRoaXNcbiAgICAgIHRoaXMubGVmdCA9IG5ld0xlZnRcbiAgICAgIGlmIChwYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgdHJlZS5yb290ID0gbmV3UGFyZW50XG4gICAgICAgIG5ld1BhcmVudC5fcGFyZW50ID0gbnVsbFxuICAgICAgfSBlbHNlIGlmIChwYXJlbnQubGVmdCA9PT0gdGhpcykge1xuICAgICAgICBwYXJlbnQubGVmdCA9IG5ld1BhcmVudFxuICAgICAgfSBlbHNlIGlmIChwYXJlbnQucmlnaHQgPT09IHRoaXMpIHtcbiAgICAgICAgcGFyZW50LnJpZ2h0ID0gbmV3UGFyZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBlbGVtZW50cyBhcmUgd3JvbmdseSBjb25uZWN0ZWQhJylcbiAgICAgIH1cbiAgICB9XG4gICAgZ2V0VW5jbGUgKCkge1xuICAgICAgLy8gd2UgY2FuIGFzc3VtZSB0aGF0IGdyYW5kcGFyZW50IGV4aXN0cyB3aGVuIHRoaXMgaXMgY2FsbGVkIVxuICAgICAgaWYgKHRoaXMucGFyZW50ID09PSB0aGlzLnBhcmVudC5wYXJlbnQubGVmdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQucGFyZW50LnJpZ2h0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQucGFyZW50LmxlZnRcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjbGFzcyBSQlRyZWUge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMucm9vdCA9IG51bGxcbiAgICAgIHRoaXMubGVuZ3RoID0gMFxuICAgIH1cbiAgICAqIGZpbmROZXh0IChpZCkge1xuICAgICAgcmV0dXJuIHlpZWxkKiB0aGlzLmZpbmRXaXRoTG93ZXJCb3VuZChbaWRbMF0sIGlkWzFdICsgMV0pXG4gICAgfVxuICAgICogZmluZFByZXYgKGlkKSB7XG4gICAgICByZXR1cm4geWllbGQqIHRoaXMuZmluZFdpdGhVcHBlckJvdW5kKFtpZFswXSwgaWRbMV0gLSAxXSlcbiAgICB9XG4gICAgZmluZE5vZGVXaXRoTG93ZXJCb3VuZCAoZnJvbSkge1xuICAgICAgaWYgKGZyb20gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBmcm9tIScpXG4gICAgICB9XG4gICAgICB2YXIgbyA9IHRoaXMucm9vdFxuICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKChmcm9tID09PSBudWxsIHx8IFkudXRpbHMuc21hbGxlcihmcm9tLCBvLnZhbC5pZCkpICYmIG8ubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gbyBpcyBpbmNsdWRlZCBpbiB0aGUgYm91bmRcbiAgICAgICAgICAgIC8vIHRyeSB0byBmaW5kIGFuIGVsZW1lbnQgdGhhdCBpcyBjbG9zZXIgdG8gdGhlIGJvdW5kXG4gICAgICAgICAgICBvID0gby5sZWZ0XG4gICAgICAgICAgfSBlbHNlIGlmIChmcm9tICE9PSBudWxsICYmIFkudXRpbHMuc21hbGxlcihvLnZhbC5pZCwgZnJvbSkpIHtcbiAgICAgICAgICAgIC8vIG8gaXMgbm90IHdpdGhpbiB0aGUgYm91bmQsIG1heWJlIG9uZSBvZiB0aGUgcmlnaHQgZWxlbWVudHMgaXMuLlxuICAgICAgICAgICAgaWYgKG8ucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgbyA9IG8ucmlnaHRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIHJpZ2h0IGVsZW1lbnQuIFNlYXJjaCBmb3IgdGhlIG5leHQgYmlnZ2VyIGVsZW1lbnQsXG4gICAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGJlIHdpdGhpbiB0aGUgYm91bmRzXG4gICAgICAgICAgICAgIHJldHVybiBvLm5leHQoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmaW5kTm9kZVdpdGhVcHBlckJvdW5kICh0bykge1xuICAgICAgaWYgKHRvID09PSB2b2lkIDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBkZWZpbmUgZnJvbSEnKVxuICAgICAgfVxuICAgICAgdmFyIG8gPSB0aGlzLnJvb3RcbiAgICAgIGlmIChvID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGlmICgodG8gPT09IG51bGwgfHwgWS51dGlscy5zbWFsbGVyKG8udmFsLmlkLCB0bykpICYmIG8ucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIG8gaXMgaW5jbHVkZWQgaW4gdGhlIGJvdW5kXG4gICAgICAgICAgICAvLyB0cnkgdG8gZmluZCBhbiBlbGVtZW50IHRoYXQgaXMgY2xvc2VyIHRvIHRoZSBib3VuZFxuICAgICAgICAgICAgbyA9IG8ucmlnaHRcbiAgICAgICAgICB9IGVsc2UgaWYgKHRvICE9PSBudWxsICYmIFkudXRpbHMuc21hbGxlcih0bywgby52YWwuaWQpKSB7XG4gICAgICAgICAgICAvLyBvIGlzIG5vdCB3aXRoaW4gdGhlIGJvdW5kLCBtYXliZSBvbmUgb2YgdGhlIGxlZnQgZWxlbWVudHMgaXMuLlxuICAgICAgICAgICAgaWYgKG8ubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBvID0gby5sZWZ0XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyB0aGVyZSBpcyBubyBsZWZ0IGVsZW1lbnQuIFNlYXJjaCBmb3IgdGhlIHByZXYgc21hbGxlciBlbGVtZW50LFxuICAgICAgICAgICAgICAvLyB0aGlzIHNob3VsZCBiZSB3aXRoaW4gdGhlIGJvdW5kc1xuICAgICAgICAgICAgICByZXR1cm4gby5wcmV2KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG9cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZmluZFNtYWxsZXN0Tm9kZSAoKSB7XG4gICAgICB2YXIgbyA9IHRoaXMucm9vdFxuICAgICAgd2hpbGUgKG8gIT0gbnVsbCAmJiBvLmxlZnQgIT0gbnVsbCkge1xuICAgICAgICBvID0gby5sZWZ0XG4gICAgICB9XG4gICAgICByZXR1cm4gb1xuICAgIH1cbiAgICAqIGZpbmRXaXRoTG93ZXJCb3VuZCAoZnJvbSkge1xuICAgICAgdmFyIG4gPSB0aGlzLmZpbmROb2RlV2l0aExvd2VyQm91bmQoZnJvbSlcbiAgICAgIHJldHVybiBuID09IG51bGwgPyBudWxsIDogbi52YWxcbiAgICB9XG4gICAgKiBmaW5kV2l0aFVwcGVyQm91bmQgKHRvKSB7XG4gICAgICB2YXIgbiA9IHRoaXMuZmluZE5vZGVXaXRoVXBwZXJCb3VuZCh0bylcbiAgICAgIHJldHVybiBuID09IG51bGwgPyBudWxsIDogbi52YWxcbiAgICB9XG4gICAgKiBpdGVyYXRlICh0LCBmcm9tLCB0bywgZikge1xuICAgICAgdmFyIG9cbiAgICAgIGlmIChmcm9tID09PSBudWxsKSB7XG4gICAgICAgIG8gPSB0aGlzLmZpbmRTbWFsbGVzdE5vZGUoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbyA9IHRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZChmcm9tKVxuICAgICAgfVxuICAgICAgd2hpbGUgKG8gIT09IG51bGwgJiYgKHRvID09PSBudWxsIHx8IFkudXRpbHMuc21hbGxlcihvLnZhbC5pZCwgdG8pIHx8IFkudXRpbHMuY29tcGFyZUlkcyhvLnZhbC5pZCwgdG8pKSkge1xuICAgICAgICB5aWVsZCogZi5jYWxsKHQsIG8udmFsKVxuICAgICAgICBvID0gby5uZXh0KClcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgICogbG9nVGFibGUgKGZyb20sIHRvLCBmaWx0ZXIpIHtcbiAgICAgIGlmIChmaWx0ZXIgPT0gbnVsbCkge1xuICAgICAgICBmaWx0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZyb20gPT0gbnVsbCkgeyBmcm9tID0gbnVsbCB9XG4gICAgICBpZiAodG8gPT0gbnVsbCkgeyB0byA9IG51bGwgfVxuICAgICAgdmFyIG9zID0gW11cbiAgICAgIHlpZWxkKiB0aGlzLml0ZXJhdGUodGhpcywgZnJvbSwgdG8sIGZ1bmN0aW9uICogKG8pIHtcbiAgICAgICAgaWYgKGZpbHRlcihvKSkge1xuICAgICAgICAgIHZhciBvXyA9IHt9XG4gICAgICAgICAgZm9yICh2YXIga2V5IGluIG8pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb1trZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICBvX1trZXldID0gSlNPTi5zdHJpbmdpZnkob1trZXldKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb19ba2V5XSA9IG9ba2V5XVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBvcy5wdXNoKG9fKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgaWYgKGNvbnNvbGUudGFibGUgIT0gbnVsbCkge1xuICAgICAgICBjb25zb2xlLnRhYmxlKG9zKVxuICAgICAgfVxuICAgIH1cbiAgICAqIGZpbmQgKGlkKSB7XG4gICAgICB2YXIgblxuICAgICAgcmV0dXJuIChuID0gdGhpcy5maW5kTm9kZShpZCkpID8gbi52YWwgOiBudWxsXG4gICAgfVxuICAgIGZpbmROb2RlIChpZCkge1xuICAgICAgaWYgKGlkID09IG51bGwgfHwgaWQuY29uc3RydWN0b3IgIT09IEFycmF5KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0IGlkIHRvIGJlIGFuIGFycmF5IScpXG4gICAgICB9XG4gICAgICB2YXIgbyA9IHRoaXMucm9vdFxuICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGlmIChvID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKFkudXRpbHMuc21hbGxlcihpZCwgby52YWwuaWQpKSB7XG4gICAgICAgICAgICBvID0gby5sZWZ0XG4gICAgICAgICAgfSBlbHNlIGlmIChZLnV0aWxzLnNtYWxsZXIoby52YWwuaWQsIGlkKSkge1xuICAgICAgICAgICAgbyA9IG8ucmlnaHRcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG9cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBkZWxldGUgKGlkKSB7XG4gICAgICBpZiAoaWQgPT0gbnVsbCB8fCBpZC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpZCBpcyBleHBlY3RlZCB0byBiZSBhbiBBcnJheSEnKVxuICAgICAgfVxuICAgICAgdmFyIGQgPSB0aGlzLmZpbmROb2RlKGlkKVxuICAgICAgaWYgKGQgPT0gbnVsbCkge1xuICAgICAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ0VsZW1lbnQgZG9lcyBub3QgZXhpc3QhJylcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICB0aGlzLmxlbmd0aC0tXG4gICAgICBpZiAoZC5sZWZ0ICE9PSBudWxsICYmIGQucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gc3dpdGNoIGQgd2l0aCB0aGUgZ3JlYXRlcyBlbGVtZW50IGluIHRoZSBsZWZ0IHN1YnRyZWUuXG4gICAgICAgIC8vIG8gc2hvdWxkIGhhdmUgYXQgbW9zdCBvbmUgY2hpbGQuXG4gICAgICAgIHZhciBvID0gZC5sZWZ0XG4gICAgICAgIC8vIGZpbmRcbiAgICAgICAgd2hpbGUgKG8ucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICB9XG4gICAgICAgIC8vIHN3aXRjaFxuICAgICAgICBkLnZhbCA9IG8udmFsXG4gICAgICAgIGQgPSBvXG4gICAgICB9XG4gICAgICAvLyBkIGhhcyBhdCBtb3N0IG9uZSBjaGlsZFxuICAgICAgLy8gbGV0IG4gYmUgdGhlIG5vZGUgdGhhdCByZXBsYWNlcyBkXG4gICAgICB2YXIgaXNGYWtlQ2hpbGRcbiAgICAgIHZhciBjaGlsZCA9IGQubGVmdCB8fCBkLnJpZ2h0XG4gICAgICBpZiAoY2hpbGQgPT09IG51bGwpIHtcbiAgICAgICAgaXNGYWtlQ2hpbGQgPSB0cnVlXG4gICAgICAgIGNoaWxkID0gbmV3IE4oe2lkOiAwfSlcbiAgICAgICAgY2hpbGQuYmxhY2tlbigpXG4gICAgICAgIGQucmlnaHQgPSBjaGlsZFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaXNGYWtlQ2hpbGQgPSBmYWxzZVxuICAgICAgfVxuXG4gICAgICBpZiAoZC5wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgaWYgKCFpc0Zha2VDaGlsZCkge1xuICAgICAgICAgIHRoaXMucm9vdCA9IGNoaWxkXG4gICAgICAgICAgY2hpbGQuYmxhY2tlbigpXG4gICAgICAgICAgY2hpbGQuX3BhcmVudCA9IG51bGxcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJvb3QgPSBudWxsXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2UgaWYgKGQucGFyZW50LmxlZnQgPT09IGQpIHtcbiAgICAgICAgZC5wYXJlbnQubGVmdCA9IGNoaWxkXG4gICAgICB9IGVsc2UgaWYgKGQucGFyZW50LnJpZ2h0ID09PSBkKSB7XG4gICAgICAgIGQucGFyZW50LnJpZ2h0ID0gY2hpbGRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW1wb3NzaWJsZSEnKVxuICAgICAgfVxuICAgICAgaWYgKGQuaXNCbGFjaygpKSB7XG4gICAgICAgIGlmIChjaGlsZC5pc1JlZCgpKSB7XG4gICAgICAgICAgY2hpbGQuYmxhY2tlbigpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZml4RGVsZXRlKGNoaWxkKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnJvb3QuYmxhY2tlbigpXG4gICAgICBpZiAoaXNGYWtlQ2hpbGQpIHtcbiAgICAgICAgaWYgKGNoaWxkLnBhcmVudC5sZWZ0ID09PSBjaGlsZCkge1xuICAgICAgICAgIGNoaWxkLnBhcmVudC5sZWZ0ID0gbnVsbFxuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkLnBhcmVudC5yaWdodCA9PT0gY2hpbGQpIHtcbiAgICAgICAgICBjaGlsZC5wYXJlbnQucmlnaHQgPSBudWxsXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbXBvc3NpYmxlICMzJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBfZml4RGVsZXRlIChuKSB7XG4gICAgICBmdW5jdGlvbiBpc0JsYWNrIChub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlICE9PSBudWxsID8gbm9kZS5pc0JsYWNrKCkgOiB0cnVlXG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBpc1JlZCAobm9kZSkge1xuICAgICAgICByZXR1cm4gbm9kZSAhPT0gbnVsbCA/IG5vZGUuaXNSZWQoKSA6IGZhbHNlXG4gICAgICB9XG4gICAgICBpZiAobi5wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgLy8gdGhpcyBjYW4gb25seSBiZSBjYWxsZWQgYWZ0ZXIgdGhlIGZpcnN0IGl0ZXJhdGlvbiBvZiBmaXhEZWxldGUuXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgLy8gZCB3YXMgYWxyZWFkeSByZXBsYWNlZCBieSB0aGUgY2hpbGRcbiAgICAgIC8vIGQgaXMgbm90IHRoZSByb290XG4gICAgICAvLyBkIGFuZCBjaGlsZCBhcmUgYmxhY2tcbiAgICAgIHZhciBzaWJsaW5nID0gbi5zaWJsaW5nXG4gICAgICBpZiAoaXNSZWQoc2libGluZykpIHtcbiAgICAgICAgLy8gbWFrZSBzaWJsaW5nIHRoZSBncmFuZGZhdGhlclxuICAgICAgICBuLnBhcmVudC5yZWRkZW4oKVxuICAgICAgICBzaWJsaW5nLmJsYWNrZW4oKVxuICAgICAgICBpZiAobiA9PT0gbi5wYXJlbnQubGVmdCkge1xuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZUxlZnQodGhpcylcbiAgICAgICAgfSBlbHNlIGlmIChuID09PSBuLnBhcmVudC5yaWdodCkge1xuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbXBvc3NpYmxlICMyJylcbiAgICAgICAgfVxuICAgICAgICBzaWJsaW5nID0gbi5zaWJsaW5nXG4gICAgICB9XG4gICAgICAvLyBwYXJlbnQsIHNpYmxpbmcsIGFuZCBjaGlsZHJlbiBvZiBuIGFyZSBibGFja1xuICAgICAgaWYgKG4ucGFyZW50LmlzQmxhY2soKSAmJlxuICAgICAgICBzaWJsaW5nLmlzQmxhY2soKSAmJlxuICAgICAgICBpc0JsYWNrKHNpYmxpbmcubGVmdCkgJiZcbiAgICAgICAgaXNCbGFjayhzaWJsaW5nLnJpZ2h0KVxuICAgICAgKSB7XG4gICAgICAgIHNpYmxpbmcucmVkZGVuKClcbiAgICAgICAgdGhpcy5fZml4RGVsZXRlKG4ucGFyZW50KVxuICAgICAgfSBlbHNlIGlmIChuLnBhcmVudC5pc1JlZCgpICYmXG4gICAgICAgIHNpYmxpbmcuaXNCbGFjaygpICYmXG4gICAgICAgIGlzQmxhY2soc2libGluZy5sZWZ0KSAmJlxuICAgICAgICBpc0JsYWNrKHNpYmxpbmcucmlnaHQpXG4gICAgICApIHtcbiAgICAgICAgc2libGluZy5yZWRkZW4oKVxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChuID09PSBuLnBhcmVudC5sZWZ0ICYmXG4gICAgICAgICAgc2libGluZy5pc0JsYWNrKCkgJiZcbiAgICAgICAgICBpc1JlZChzaWJsaW5nLmxlZnQpICYmXG4gICAgICAgICAgaXNCbGFjayhzaWJsaW5nLnJpZ2h0KVxuICAgICAgICApIHtcbiAgICAgICAgICBzaWJsaW5nLnJlZGRlbigpXG4gICAgICAgICAgc2libGluZy5sZWZ0LmJsYWNrZW4oKVxuICAgICAgICAgIHNpYmxpbmcucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgICBzaWJsaW5nID0gbi5zaWJsaW5nXG4gICAgICAgIH0gZWxzZSBpZiAobiA9PT0gbi5wYXJlbnQucmlnaHQgJiZcbiAgICAgICAgICBzaWJsaW5nLmlzQmxhY2soKSAmJlxuICAgICAgICAgIGlzUmVkKHNpYmxpbmcucmlnaHQpICYmXG4gICAgICAgICAgaXNCbGFjayhzaWJsaW5nLmxlZnQpXG4gICAgICAgICkge1xuICAgICAgICAgIHNpYmxpbmcucmVkZGVuKClcbiAgICAgICAgICBzaWJsaW5nLnJpZ2h0LmJsYWNrZW4oKVxuICAgICAgICAgIHNpYmxpbmcucm90YXRlTGVmdCh0aGlzKVxuICAgICAgICAgIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgICAgfVxuICAgICAgICBzaWJsaW5nLmNvbG9yID0gbi5wYXJlbnQuY29sb3JcbiAgICAgICAgbi5wYXJlbnQuYmxhY2tlbigpXG4gICAgICAgIGlmIChuID09PSBuLnBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgc2libGluZy5yaWdodC5ibGFja2VuKClcbiAgICAgICAgICBuLnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2libGluZy5sZWZ0LmJsYWNrZW4oKVxuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBwdXQgKHYpIHtcbiAgICAgIGlmICh2ID09IG51bGwgfHwgdi5pZCA9PSBudWxsIHx8IHYuaWQuY29uc3RydWN0b3IgIT09IEFycmF5KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndiBpcyBleHBlY3RlZCB0byBoYXZlIGFuIGlkIHByb3BlcnR5IHdoaWNoIGlzIGFuIEFycmF5IScpXG4gICAgICB9XG4gICAgICB2YXIgbm9kZSA9IG5ldyBOKHYpXG4gICAgICBpZiAodGhpcy5yb290ICE9PSBudWxsKSB7XG4gICAgICAgIHZhciBwID0gdGhpcy5yb290IC8vIHAgYWJicmV2LiBwYXJlbnRcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBpZiAoWS51dGlscy5zbWFsbGVyKG5vZGUudmFsLmlkLCBwLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIGlmIChwLmxlZnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgcC5sZWZ0ID0gbm9kZVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcCA9IHAubGVmdFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoWS51dGlscy5zbWFsbGVyKHAudmFsLmlkLCBub2RlLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIGlmIChwLnJpZ2h0ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHAucmlnaHQgPSBub2RlXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwID0gcC5yaWdodFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwLnZhbCA9IG5vZGUudmFsXG4gICAgICAgICAgICByZXR1cm4gcFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9maXhJbnNlcnQobm9kZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucm9vdCA9IG5vZGVcbiAgICAgIH1cbiAgICAgIHRoaXMubGVuZ3RoKytcbiAgICAgIHRoaXMucm9vdC5ibGFja2VuKClcbiAgICAgIHJldHVybiBub2RlXG4gICAgfVxuICAgIF9maXhJbnNlcnQgKG4pIHtcbiAgICAgIGlmIChuLnBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICBuLmJsYWNrZW4oKVxuICAgICAgICByZXR1cm5cbiAgICAgIH0gZWxzZSBpZiAobi5wYXJlbnQuaXNCbGFjaygpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgdmFyIHVuY2xlID0gbi5nZXRVbmNsZSgpXG4gICAgICBpZiAodW5jbGUgIT09IG51bGwgJiYgdW5jbGUuaXNSZWQoKSkge1xuICAgICAgICAvLyBOb3RlOiBwYXJlbnQ6IHJlZCwgdW5jbGU6IHJlZFxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgICAgdW5jbGUuYmxhY2tlbigpXG4gICAgICAgIG4uZ3JhbmRwYXJlbnQucmVkZGVuKClcbiAgICAgICAgdGhpcy5fZml4SW5zZXJ0KG4uZ3JhbmRwYXJlbnQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOb3RlOiBwYXJlbnQ6IHJlZCwgdW5jbGU6IGJsYWNrIG9yIG51bGxcbiAgICAgICAgLy8gTm93IHdlIHRyYW5zZm9ybSB0aGUgdHJlZSBpbiBzdWNoIGEgd2F5IHRoYXRcbiAgICAgICAgLy8gZWl0aGVyIG9mIHRoZXNlIGhvbGRzOlxuICAgICAgICAvLyAgIDEpIGdyYW5kcGFyZW50LmxlZnQuaXNSZWRcbiAgICAgICAgLy8gICAgIGFuZCBncmFuZHBhcmVudC5sZWZ0LmxlZnQuaXNSZWRcbiAgICAgICAgLy8gICAyKSBncmFuZHBhcmVudC5yaWdodC5pc1JlZFxuICAgICAgICAvLyAgICAgYW5kIGdyYW5kcGFyZW50LnJpZ2h0LnJpZ2h0LmlzUmVkXG4gICAgICAgIGlmIChuID09PSBuLnBhcmVudC5yaWdodCAmJiBuLnBhcmVudCA9PT0gbi5ncmFuZHBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlTGVmdCh0aGlzKVxuICAgICAgICAgIC8vIFNpbmNlIHdlIHJvdGF0ZWQgYW5kIHdhbnQgdG8gdXNlIHRoZSBwcmV2aW91c1xuICAgICAgICAgIC8vIGNhc2VzLCB3ZSBuZWVkIHRvIHNldCBuIGluIHN1Y2ggYSB3YXkgdGhhdFxuICAgICAgICAgIC8vIG4ucGFyZW50LmlzUmVkIGFnYWluXG4gICAgICAgICAgbiA9IG4ubGVmdFxuICAgICAgICB9IGVsc2UgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQgJiYgbi5wYXJlbnQgPT09IG4uZ3JhbmRwYXJlbnQucmlnaHQpIHtcbiAgICAgICAgICBuLnBhcmVudC5yb3RhdGVSaWdodCh0aGlzKVxuICAgICAgICAgIC8vIHNlZSBhYm92ZVxuICAgICAgICAgIG4gPSBuLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2FzZSAxKSBvciAyKSBob2xkIGZyb20gaGVyZSBvbi5cbiAgICAgICAgLy8gTm93IHRyYXZlcnNlIGdyYW5kcGFyZW50LCBtYWtlIHBhcmVudCBhIGJsYWNrIG5vZGVcbiAgICAgICAgLy8gb24gdGhlIGhpZ2hlc3QgbGV2ZWwgd2hpY2ggaG9sZHMgdHdvIHJlZCBub2Rlcy5cbiAgICAgICAgbi5wYXJlbnQuYmxhY2tlbigpXG4gICAgICAgIG4uZ3JhbmRwYXJlbnQucmVkZGVuKClcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQpIHtcbiAgICAgICAgICAvLyBDYXNlIDFcbiAgICAgICAgICBuLmdyYW5kcGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ2FzZSAyXG4gICAgICAgICAgbi5ncmFuZHBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBmbHVzaCAoKSB7fVxuICB9XG5cbiAgWS51dGlscy5SQlRyZWUgPSBSQlRyZWVcbn1cbiIsIi8qIGdsb2JhbCBZLCBFbGVtZW50ICovXG4ndXNlIHN0cmljdCdcblxudmFyIGRpZmYgPSByZXF1aXJlKCdmYXN0LWRpZmYnKVxudmFyIG1vbmFjb0lkZW50aWZpZXJUZW1wbGF0ZSA9IHsgbWFqb3I6IDAsIG1pbm9yOiAwIH1cblxuZnVuY3Rpb24gZXh0ZW5kIChZKSB7XG4gIFkucmVxdWVzdE1vZHVsZXMoWydBcnJheSddKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICBjbGFzcyBZVGV4dCBleHRlbmRzIFkuQXJyYXkudHlwZURlZmluaXRpb25bJ2NsYXNzJ10ge1xuICAgICAgY29uc3RydWN0b3IgKG9zLCBfbW9kZWwsIF9jb250ZW50KSB7XG4gICAgICAgIHN1cGVyKG9zLCBfbW9kZWwsIF9jb250ZW50KVxuICAgICAgICB0aGlzLnRleHRmaWVsZHMgPSBbXVxuICAgICAgICB0aGlzLmFjZUluc3RhbmNlcyA9IFtdXG4gICAgICAgIHRoaXMuY29kZU1pcnJvckluc3RhbmNlcyA9IFtdXG4gICAgICAgIHRoaXMubW9uYWNvSW5zdGFuY2VzID0gW11cbiAgICAgIH1cbiAgICAgIHRvU3RyaW5nICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnQubWFwKGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgcmV0dXJuIGMudmFsXG4gICAgICAgIH0pLmpvaW4oJycpXG4gICAgICB9XG4gICAgICBpbnNlcnQgKHBvcywgY29udGVudCkge1xuICAgICAgICB2YXIgYXJyID0gY29udGVudC5zcGxpdCgnJylcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoL1tcXHVEODAwLVxcdURGRkZdLy50ZXN0KGFycltpXSkpIHtcbiAgICAgICAgICAgIC8vIGlzIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICAgICAgICBhcnJbaV0gPSBhcnJbaV0gKyBhcnJbaSArIDFdXG4gICAgICAgICAgICBhcnJbaSArIDFdID0gJydcbiAgICAgICAgICAgIGkrK1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdXBlci5pbnNlcnQocG9zLCBhcnIpXG4gICAgICB9XG4gICAgICBkZWxldGUgKHBvcywgbGVuZ3RoKSB7XG4gICAgICAgIGlmIChsZW5ndGggPT0gbnVsbCkgeyBsZW5ndGggPSAxIH1cbiAgICAgICAgaWYgKHR5cGVvZiBsZW5ndGggIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdsZW5ndGggbXVzdCBiZSBhIG51bWJlciEnKVxuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgcG9zICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9zIG11c3QgYmUgYSBudW1iZXIhJylcbiAgICAgICAgfVxuICAgICAgICBpZiAocG9zICsgbGVuZ3RoID4gdGhpcy5fY29udGVudC5sZW5ndGggfHwgcG9zIDwgMCB8fCBsZW5ndGggPCAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgZGVsZXRpb24gcmFuZ2UgZXhjZWVkcyB0aGUgcmFuZ2Ugb2YgdGhlIGFycmF5IScpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIFRoaXMgaXMgZm9yIHRoZSBjYXNlIHRoYXQgcGFydCBvZiBhIHN1cnJvZ2F0ZSBwYWlyIGlzIGRlbGV0ZWRcbiAgICAgICAgLy8gd2Ugc3RvcmUgc3Vycm9nYXRlIHBhaXJzIGxpa2UgdGhpczogWy4uLCAn8J+QhycsICcnLCAuLl0gKHN0cmluZywgY29kZSlcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRlbnQubGVuZ3RoID4gcG9zICsgbGVuZ3RoICYmIHRoaXMuX2NvbnRlbnRbcG9zICsgbGVuZ3RoXS52YWwgPT09ICcnICYmIHRoaXMuX2NvbnRlbnRbcG9zICsgbGVuZ3RoIC0gMV0udmFsLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgIC8vIGNhc2Ugb25lLiBmaXJzdCBwYXJ0IG9mIHRoZSBzdXJyb2dhdGUgcGFpciBpcyBkZWxldGVkXG4gICAgICAgICAgbGV0IHRva2VuID0gdGhpcy5fY29udGVudFtwb3MgKyBsZW5ndGggLSAxXS52YWxbMF1cbiAgICAgICAgICBzdXBlci5kZWxldGUocG9zLCBsZW5ndGggKyAxKVxuICAgICAgICAgIHN1cGVyLmluc2VydChwb3MsIFt0b2tlbl0pXG4gICAgICAgIH0gZWxzZSBpZiAocG9zID4gMCAmJiB0aGlzLl9jb250ZW50W3Bvc10udmFsID09PSAnJyAmJiB0aGlzLl9jb250ZW50W3BvcyAtIDFdLnZhbC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAvLyBjYXNlIHR3by4gc2Vjb25kIHBhcnQgb2YgdGhlIHN1cnJvZ2F0ZSBwYWlyIGlzIGRlbGV0ZWRcbiAgICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLl9jb250ZW50W3BvcyAtIDFdLnZhbFsxXVxuICAgICAgICAgIHN1cGVyLmRlbGV0ZShwb3MgLSAxLCBsZW5ndGggKyAxKVxuICAgICAgICAgIHN1cGVyLmluc2VydChwb3MgLSAxLCBbdG9rZW5dKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1cGVyLmRlbGV0ZShwb3MsIGxlbmd0aClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdW5iaW5kQWxsICgpIHtcbiAgICAgICAgdGhpcy51bmJpbmRUZXh0YXJlYUFsbCgpXG4gICAgICAgIHRoaXMudW5iaW5kQWNlQWxsKClcbiAgICAgICAgdGhpcy51bmJpbmRDb2RlTWlycm9yQWxsKClcbiAgICAgICAgdGhpcy51bmJpbmRNb25hY29BbGwoKVxuICAgICAgfVxuICAgICAgLy8gTW9uYWNvIGltcGxlbWVudGF0aW9uXG4gICAgICB1bmJpbmRNb25hY28gKG1vbmFjb0luc3RhbmNlKSB7XG4gICAgICAgIHZhciBpID0gdGhpcy5tb25hY29JbnN0YW5jZXMuZmluZEluZGV4KGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGJpbmRpbmcuZWRpdG9yID09PSBtb25hY29JbnN0YW5jZVxuICAgICAgICB9KVxuICAgICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgICAgdmFyIGJpbmRpbmcgPSB0aGlzLm1vbmFjb0luc3RhbmNlc1tpXVxuICAgICAgICAgIHRoaXMudW5vYnNlcnZlKGJpbmRpbmcueUNhbGxiYWNrKVxuICAgICAgICAgIGJpbmRpbmcuZGlzcG9zZUJpbmRpbmcoKVxuICAgICAgICAgIHRoaXMubW9uYWNvSW5zdGFuY2VzLnNwbGljZShpLCAxKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmJpbmRNb25hY29BbGwgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5tb25hY29JbnN0YW5jZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICB0aGlzLnVuYmluZE1vbmFjbyh0aGlzLm1vbmFjb0luc3RhbmNlc1tpXS5lZGl0b3IpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJpbmRNb25hY28gKG1vbmFjb0luc3RhbmNlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gICAgICAgIC8vIHRoaXMgZnVuY3Rpb24gbWFrZXMgc3VyZSB0aGF0IGVpdGhlciB0aGVcbiAgICAgICAgLy8gbW9uYWNvIGV2ZW50IGlzIGV4ZWN1dGVkLCBvciB0aGUgeWpzIG9ic2VydmVyIGlzIGV4ZWN1dGVkXG4gICAgICAgIHZhciB0b2tlbiA9IHRydWVcbiAgICAgICAgZnVuY3Rpb24gbXV0dWFsRXhjbHVzZSAoZikge1xuICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgdG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBtb25hY29JbnN0YW5jZS5zZXRWYWx1ZSh0aGlzLnRvU3RyaW5nKCkpXG5cbiAgICAgICAgZnVuY3Rpb24gbW9uYWNvQ2FsbGJhY2sgKGV2ZW50KSB7XG4gICAgICAgICAgbXV0dWFsRXhjbHVzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBjb21wdXRlIHN0YXJ0Li4gKGNvbCtyb3cgLT4gaW5kZXggcG9zaXRpb24pXG4gICAgICAgICAgICAvLyBXZSBzaG91bGRuJ3QgY29tcHV0ZSB0aGUgb2Zmc2V0IG9uIHRoZSBvbGQgbW9kZWwuLlxuICAgICAgICAgICAgLy8gICAgdmFyIHN0YXJ0ID0gbW9uYWNvSW5zdGFuY2UubW9kZWwuZ2V0T2Zmc2V0QXQoe2NvbHVtbjogZXZlbnQucmFuZ2Uuc3RhcnRDb2x1bW4sIGxpbmVOdW1iZXI6IGV2ZW50LnJhbmdlLnN0YXJ0TGluZU51bWJlcn0pXG4gICAgICAgICAgICAvLyBTbyB3ZSBjb21wdXRlIHRoZSBvZmZzZXQgdXNpbmcgdGhlIF9jb250ZW50IG9mIHRoaXMgdHlwZVxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxpbmUgPSAxOyBsaW5lIDwgZXZlbnQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyOyBpKyspIHtcbiAgICAgICAgICAgICAgaWYgKHNlbGYuX2NvbnRlbnRbaV0udmFsID09PSAnXFxuJykge1xuICAgICAgICAgICAgICAgIGxpbmUrK1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgc3RhcnQgPSBpICsgZXZlbnQucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxXG5cbiAgICAgICAgICAgIC8vIGFwcGx5IHRoZSBkZWxldGUgb3BlcmF0aW9uIGZpcnN0XG4gICAgICAgICAgICBpZiAoZXZlbnQucmFuZ2VMZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIHNlbGYuZGVsZXRlKHN0YXJ0LCBldmVudC5yYW5nZUxlbmd0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGFwcGx5IGluc2VydCBvcGVyYXRpb25cbiAgICAgICAgICAgIHNlbGYuaW5zZXJ0KHN0YXJ0LCBldmVudC50ZXh0KVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRpc3Bvc2VCaW5kaW5nID0gbW9uYWNvSW5zdGFuY2Uub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQobW9uYWNvQ2FsbGJhY2spLmRpc3Bvc2VcblxuICAgICAgICBmdW5jdGlvbiB5Q2FsbGJhY2sgKGV2ZW50KSB7XG4gICAgICAgICAgbXV0dWFsRXhjbHVzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBsZXQgc3RhcnQgPSBtb25hY29JbnN0YW5jZS5tb2RlbC5nZXRQb3NpdGlvbkF0KGV2ZW50LmluZGV4KVxuICAgICAgICAgICAgdmFyIGVuZCwgdGV4dFxuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICAgIGVuZCA9IHN0YXJ0XG4gICAgICAgICAgICAgIHRleHQgPSBldmVudC52YWx1ZXMuam9pbignJylcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgICAgICAgICAgZW5kID0gbW9uYWNvSW5zdGFuY2UubW9kZWwubW9kaWZ5UG9zaXRpb24oc3RhcnQsIGV2ZW50Lmxlbmd0aClcbiAgICAgICAgICAgICAgdGV4dCA9ICcnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSB7XG4gICAgICAgICAgICAgIHN0YXJ0TGluZU51bWJlcjogc3RhcnQubGluZU51bWJlcixcbiAgICAgICAgICAgICAgc3RhcnRDb2x1bW46IHN0YXJ0LmNvbHVtbixcbiAgICAgICAgICAgICAgZW5kTGluZU51bWJlcjogZW5kLmxpbmVOdW1iZXIsXG4gICAgICAgICAgICAgIGVuZENvbHVtbjogZW5kLmNvbHVtblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGlkID0ge1xuICAgICAgICAgICAgICBtYWpvcjogbW9uYWNvSWRlbnRpZmllclRlbXBsYXRlLm1ham9yLFxuICAgICAgICAgICAgICBtaW5vcjogbW9uYWNvSWRlbnRpZmllclRlbXBsYXRlLm1pbm9yKytcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1vbmFjb0luc3RhbmNlLmV4ZWN1dGVFZGl0cygnWWpzJywgW3tcbiAgICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgICByYW5nZTogcmFuZ2UsXG4gICAgICAgICAgICAgIHRleHQ6IHRleHQsXG4gICAgICAgICAgICAgIGZvcmNlTW92ZU1hcmtlcnM6IHRydWVcbiAgICAgICAgICAgIH1dKVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vYnNlcnZlKHlDYWxsYmFjaylcbiAgICAgICAgdGhpcy5tb25hY29JbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgZWRpdG9yOiBtb25hY29JbnN0YW5jZSxcbiAgICAgICAgICB5Q2FsbGJhY2s6IHlDYWxsYmFjayxcbiAgICAgICAgICBtb25hY29DYWxsYmFjazogbW9uYWNvQ2FsbGJhY2ssXG4gICAgICAgICAgZGlzcG9zZUJpbmRpbmc6IGRpc3Bvc2VCaW5kaW5nXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICAvLyBDb2RlTWlycm9yIGltcGxlbWVudGF0aW9uLi5cbiAgICAgIHVuYmluZENvZGVNaXJyb3IgKGNvZGVNaXJyb3JJbnN0YW5jZSkge1xuICAgICAgICB2YXIgaSA9IHRoaXMuY29kZU1pcnJvckluc3RhbmNlcy5maW5kSW5kZXgoZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICAgICAgICByZXR1cm4gYmluZGluZy5lZGl0b3IgPT09IGNvZGVNaXJyb3JJbnN0YW5jZVxuICAgICAgICB9KVxuICAgICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgICAgdmFyIGJpbmRpbmcgPSB0aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXNbaV1cbiAgICAgICAgICB0aGlzLnVub2JzZXJ2ZShiaW5kaW5nLnlDYWxsYmFjaylcbiAgICAgICAgICBiaW5kaW5nLmVkaXRvci5vZmYoJ2NoYW5nZXMnLCBiaW5kaW5nLmNvZGVNaXJyb3JDYWxsYmFjaylcbiAgICAgICAgICB0aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHVuYmluZENvZGVNaXJyb3JBbGwgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgdGhpcy51bmJpbmRDb2RlTWlycm9yKHRoaXMuY29kZU1pcnJvckluc3RhbmNlc1tpXS5lZGl0b3IpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJpbmRDb2RlTWlycm9yIChjb2RlTWlycm9ySW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cbiAgICAgICAgLy8gdGhpcyBmdW5jdGlvbiBtYWtlcyBzdXJlIHRoYXQgZWl0aGVyIHRoZVxuICAgICAgICAvLyBjb2RlbWlycm9yIGV2ZW50IGlzIGV4ZWN1dGVkLCBvciB0aGUgeWpzIG9ic2VydmVyIGlzIGV4ZWN1dGVkXG4gICAgICAgIHZhciB0b2tlbiA9IHRydWVcbiAgICAgICAgZnVuY3Rpb24gbXV0dWFsRXhjbHVzZSAoZikge1xuICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgdG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb2RlTWlycm9ySW5zdGFuY2Uuc2V0VmFsdWUodGhpcy50b1N0cmluZygpKVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvZGVNaXJyb3JDYWxsYmFjayAoY20sIGRlbHRhcykge1xuICAgICAgICAgIG11dHVhbEV4Y2x1c2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZWx0YXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGRlbHRhID0gZGVsdGFzW2ldXG4gICAgICAgICAgICAgIHZhciBzdGFydCA9IGNvZGVNaXJyb3JJbnN0YW5jZS5pbmRleEZyb21Qb3MoZGVsdGEuZnJvbSlcbiAgICAgICAgICAgICAgLy8gYXBwbHkgdGhlIGRlbGV0ZSBvcGVyYXRpb24gZmlyc3RcbiAgICAgICAgICAgICAgaWYgKGRlbHRhLnJlbW92ZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBkZWxMZW5ndGggPSAwXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBkZWx0YS5yZW1vdmVkLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICBkZWxMZW5ndGggKz0gZGVsdGEucmVtb3ZlZFtqXS5sZW5ndGhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gXCJlbnRlclwiIGlzIGFsc28gYSBjaGFyYWN0ZXIgaW4gb3VyIGNhc2VcbiAgICAgICAgICAgICAgICBkZWxMZW5ndGggKz0gZGVsdGEucmVtb3ZlZC5sZW5ndGggLSAxXG4gICAgICAgICAgICAgICAgc2VsZi5kZWxldGUoc3RhcnQsIGRlbExlbmd0aClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBhcHBseSBpbnNlcnQgb3BlcmF0aW9uXG4gICAgICAgICAgICAgIHNlbGYuaW5zZXJ0KHN0YXJ0LCBkZWx0YS50ZXh0LmpvaW4oJ1xcbicpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgY29kZU1pcnJvckluc3RhbmNlLm9uKCdjaGFuZ2VzJywgY29kZU1pcnJvckNhbGxiYWNrKVxuXG4gICAgICAgIGZ1bmN0aW9uIHlDYWxsYmFjayAoZXZlbnQpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxldCBmcm9tID0gY29kZU1pcnJvckluc3RhbmNlLnBvc0Zyb21JbmRleChldmVudC5pbmRleClcbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICAgICAgICBsZXQgdG8gPSBmcm9tXG4gICAgICAgICAgICAgIGNvZGVNaXJyb3JJbnN0YW5jZS5yZXBsYWNlUmFuZ2UoZXZlbnQudmFsdWVzLmpvaW4oJycpLCBmcm9tLCB0bylcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgICAgICAgICAgbGV0IHRvID0gY29kZU1pcnJvckluc3RhbmNlLnBvc0Zyb21JbmRleChldmVudC5pbmRleCArIGV2ZW50Lmxlbmd0aClcbiAgICAgICAgICAgICAgY29kZU1pcnJvckluc3RhbmNlLnJlcGxhY2VSYW5nZSgnJywgZnJvbSwgdG8pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9ic2VydmUoeUNhbGxiYWNrKVxuICAgICAgICB0aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgZWRpdG9yOiBjb2RlTWlycm9ySW5zdGFuY2UsXG4gICAgICAgICAgeUNhbGxiYWNrOiB5Q2FsbGJhY2ssXG4gICAgICAgICAgY29kZU1pcnJvckNhbGxiYWNrOiBjb2RlTWlycm9yQ2FsbGJhY2tcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIHVuYmluZEFjZSAoYWNlSW5zdGFuY2UpIHtcbiAgICAgICAgdmFyIGkgPSB0aGlzLmFjZUluc3RhbmNlcy5maW5kSW5kZXgoZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICAgICAgICByZXR1cm4gYmluZGluZy5lZGl0b3IgPT09IGFjZUluc3RhbmNlXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChpID49IDApIHtcbiAgICAgICAgICB2YXIgYmluZGluZyA9IHRoaXMuYWNlSW5zdGFuY2VzW2ldXG4gICAgICAgICAgdGhpcy51bm9ic2VydmUoYmluZGluZy55Q2FsbGJhY2spXG4gICAgICAgICAgYmluZGluZy5lZGl0b3Iub2ZmKCdjaGFuZ2UnLCBiaW5kaW5nLmFjZUNhbGxiYWNrKVxuICAgICAgICAgIHRoaXMuYWNlSW5zdGFuY2VzLnNwbGljZShpLCAxKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmJpbmRBY2VBbGwgKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5hY2VJbnN0YW5jZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICB0aGlzLnVuYmluZEFjZSh0aGlzLmFjZUluc3RhbmNlc1tpXS5lZGl0b3IpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJpbmRBY2UgKGFjZUluc3RhbmNlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gICAgICAgIC8vIHRoaXMgZnVuY3Rpb24gbWFrZXMgc3VyZSB0aGF0IGVpdGhlciB0aGVcbiAgICAgICAgLy8gYWNlIGV2ZW50IGlzIGV4ZWN1dGVkLCBvciB0aGUgeWpzIG9ic2VydmVyIGlzIGV4ZWN1dGVkXG4gICAgICAgIHZhciB0b2tlbiA9IHRydWVcbiAgICAgICAgZnVuY3Rpb24gbXV0dWFsRXhjbHVzZSAoZikge1xuICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgdG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhY2VJbnN0YW5jZS5zZXRWYWx1ZSh0aGlzLnRvU3RyaW5nKCkpXG5cbiAgICAgICAgZnVuY3Rpb24gYWNlQ2FsbGJhY2sgKGRlbHRhKSB7XG4gICAgICAgICAgbXV0dWFsRXhjbHVzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc3RhcnRcbiAgICAgICAgICAgIHZhciBsZW5ndGhcblxuICAgICAgICAgICAgdmFyIGFjZURvY3VtZW50ID0gYWNlSW5zdGFuY2UuZ2V0U2Vzc2lvbigpLmdldERvY3VtZW50KClcbiAgICAgICAgICAgIGlmIChkZWx0YS5hY3Rpb24gPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gYWNlRG9jdW1lbnQucG9zaXRpb25Ub0luZGV4KGRlbHRhLnN0YXJ0LCAwKVxuICAgICAgICAgICAgICBzZWxmLmluc2VydChzdGFydCwgZGVsdGEubGluZXMuam9pbignXFxuJykpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhLmFjdGlvbiA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgICAgICAgc3RhcnQgPSBhY2VEb2N1bWVudC5wb3NpdGlvblRvSW5kZXgoZGVsdGEuc3RhcnQsIDApXG4gICAgICAgICAgICAgIGxlbmd0aCA9IGRlbHRhLmxpbmVzLmpvaW4oJ1xcbicpLmxlbmd0aFxuICAgICAgICAgICAgICBzZWxmLmRlbGV0ZShzdGFydCwgbGVuZ3RoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgYWNlSW5zdGFuY2Uub24oJ2NoYW5nZScsIGFjZUNhbGxiYWNrKVxuXG4gICAgICAgIGFjZUluc3RhbmNlLnNlbGVjdGlvbi5jbGVhclNlbGVjdGlvbigpXG5cbiAgICAgICAgLy8gV2UgZG9uJ3QgdGhhdCBhY2UgaXMgYSBnbG9iYWwgdmFyaWFibGVcbiAgICAgICAgLy8gc2VlICMyXG4gICAgICAgIHZhciBhY2VDbGFzc1xuICAgICAgICBpZiAodHlwZW9mIGFjZSAhPT0gJ3VuZGVmaW5lZCcgJiYgb3B0aW9ucy5hY2VDbGFzcyA9PSBudWxsKSB7XG4gICAgICAgICAgYWNlQ2xhc3MgPSBhY2UgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFjZUNsYXNzID0gb3B0aW9ucy5hY2VDbGFzc1xuICAgICAgICB9XG4gICAgICAgIHZhciBhY2VSZXF1aXJlID0gb3B0aW9ucy5hY2VSZXF1aXJlIHx8IGFjZUNsYXNzLnJlcXVpcmVcbiAgICAgICAgdmFyIFJhbmdlID0gYWNlUmVxdWlyZSgnYWNlL3JhbmdlJykuUmFuZ2VcblxuICAgICAgICBmdW5jdGlvbiB5Q2FsbGJhY2sgKGV2ZW50KSB7XG4gICAgICAgICAgdmFyIGFjZURvY3VtZW50ID0gYWNlSW5zdGFuY2UuZ2V0U2Vzc2lvbigpLmdldERvY3VtZW50KClcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICAgICAgICBsZXQgc3RhcnQgPSBhY2VEb2N1bWVudC5pbmRleFRvUG9zaXRpb24oZXZlbnQuaW5kZXgsIDApXG4gICAgICAgICAgICAgIGFjZURvY3VtZW50Lmluc2VydChzdGFydCwgZXZlbnQudmFsdWVzLmpvaW4oJycpKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICBsZXQgc3RhcnQgPSBhY2VEb2N1bWVudC5pbmRleFRvUG9zaXRpb24oZXZlbnQuaW5kZXgsIDApXG4gICAgICAgICAgICAgIGxldCBlbmQgPSBhY2VEb2N1bWVudC5pbmRleFRvUG9zaXRpb24oZXZlbnQuaW5kZXggKyBldmVudC5sZW5ndGgsIDApXG4gICAgICAgICAgICAgIHZhciByYW5nZSA9IG5ldyBSYW5nZShzdGFydC5yb3csIHN0YXJ0LmNvbHVtbiwgZW5kLnJvdywgZW5kLmNvbHVtbilcbiAgICAgICAgICAgICAgYWNlRG9jdW1lbnQucmVtb3ZlKHJhbmdlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vYnNlcnZlKHlDYWxsYmFjaylcbiAgICAgICAgdGhpcy5hY2VJbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgZWRpdG9yOiBhY2VJbnN0YW5jZSxcbiAgICAgICAgICB5Q2FsbGJhY2s6IHlDYWxsYmFjayxcbiAgICAgICAgICBhY2VDYWxsYmFjazogYWNlQ2FsbGJhY2tcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGJpbmQgKCkge1xuICAgICAgICB2YXIgZSA9IGFyZ3VtZW50c1swXVxuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgICB0aGlzLmJpbmRUZXh0YXJlYS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH0gZWxzZSBpZiAoZSAhPSBudWxsICYmIGUuc2Vzc2lvbiAhPSBudWxsICYmIGUuZ2V0U2Vzc2lvbiAhPSBudWxsICYmIGUuc2V0VmFsdWUgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuYmluZEFjZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH0gZWxzZSBpZiAoZSAhPSBudWxsICYmIGUucG9zRnJvbUluZGV4ICE9IG51bGwgJiYgZS5yZXBsYWNlUmFuZ2UgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuYmluZENvZGVNaXJyb3IuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgICB9IGVsc2UgaWYgKGUgIT0gbnVsbCAmJiBlLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICB0aGlzLmJpbmRNb25hY28uYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Nhbm5vdCBiaW5kLCB1bnN1cHBvcnRlZCBlZGl0b3IhJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdW5iaW5kVGV4dGFyZWEgKHRleHRhcmVhKSB7XG4gICAgICAgIHZhciBpID0gdGhpcy50ZXh0ZmllbGRzLmZpbmRJbmRleChmdW5jdGlvbiAoYmluZGluZykge1xuICAgICAgICAgIHJldHVybiBiaW5kaW5nLmVkaXRvciA9PT0gdGV4dGFyZWFcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGkgPj0gMCkge1xuICAgICAgICAgIHZhciBiaW5kaW5nID0gdGhpcy50ZXh0ZmllbGRzW2ldXG4gICAgICAgICAgdGhpcy51bm9ic2VydmUoYmluZGluZy55Q2FsbGJhY2spXG4gICAgICAgICAgdmFyIGUgPSBiaW5kaW5nLmVkaXRvclxuICAgICAgICAgIGUucmVtb3ZlRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBiaW5kaW5nLmV2ZW50TGlzdGVuZXIpXG4gICAgICAgICAgdGhpcy50ZXh0ZmllbGRzLnNwbGljZShpLCAxKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmJpbmRUZXh0YXJlYUFsbCAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLnRleHRmaWVsZHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICB0aGlzLnVuYmluZFRleHRhcmVhKHRoaXMudGV4dGZpZWxkc1tpXS5lZGl0b3IpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJpbmRUZXh0YXJlYSAodGV4dGZpZWxkLCBkb21Sb290KSB7XG4gICAgICAgIGRvbVJvb3QgPSBkb21Sb290IHx8IHdpbmRvdzsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICBpZiAoZG9tUm9vdC5nZXRTZWxlY3Rpb24gPT0gbnVsbCkge1xuICAgICAgICAgIGRvbVJvb3QgPSB3aW5kb3c7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvbid0IGR1cGxpY2F0ZSFcbiAgICAgICAgZm9yICh2YXIgdCA9IDA7IHQgPCB0aGlzLnRleHRmaWVsZHMubGVuZ3RoOyB0KyspIHtcbiAgICAgICAgICBpZiAodGhpcy50ZXh0ZmllbGRzW3RdLmVkaXRvciA9PT0gdGV4dGZpZWxkKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhpcyBmdW5jdGlvbiBtYWtlcyBzdXJlIHRoYXQgZWl0aGVyIHRoZVxuICAgICAgICAvLyB0ZXh0ZmllbGR0IGV2ZW50IGlzIGV4ZWN1dGVkLCBvciB0aGUgeWpzIG9ic2VydmVyIGlzIGV4ZWN1dGVkXG4gICAgICAgIHZhciB0b2tlbiA9IHRydWVcbiAgICAgICAgZnVuY3Rpb24gbXV0dWFsRXhjbHVzZSAoZikge1xuICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgdG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB0aGlzLnRvU3RyaW5nKClcblxuICAgICAgICB2YXIgY3JlYXRlUmFuZ2UsIHdyaXRlUmFuZ2UsIHdyaXRlQ29udGVudCwgZ2V0Q29udGVudFxuICAgICAgICBpZiAodGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0ICE9IG51bGwgJiYgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlICE9IG51bGwpIHtcbiAgICAgICAgICBjcmVhdGVSYW5nZSA9IGZ1bmN0aW9uIChmaXgpIHtcbiAgICAgICAgICAgIHZhciBsZWZ0ID0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgICAgICB2YXIgcmlnaHQgPSB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgICBpZiAoZml4ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbGVmdCA9IGZpeChsZWZ0KVxuICAgICAgICAgICAgICByaWdodCA9IGZpeChyaWdodClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIGxlZnQ6IGxlZnQsXG4gICAgICAgICAgICAgIHJpZ2h0OiByaWdodFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB3cml0ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgICAgICAgICB3cml0ZUNvbnRlbnQoc2VsZi50b1N0cmluZygpKVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlKHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0KVxuICAgICAgICAgIH1cbiAgICAgICAgICB3cml0ZUNvbnRlbnQgPSBmdW5jdGlvbiAoY29udGVudCkge1xuICAgICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gY29udGVudFxuICAgICAgICAgIH1cbiAgICAgICAgICBnZXRDb250ZW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRleHRmaWVsZC52YWx1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjcmVhdGVSYW5nZSA9IGZ1bmN0aW9uIChmaXgpIHtcbiAgICAgICAgICAgIHZhciByYW5nZSA9IHt9XG4gICAgICAgICAgICB2YXIgcyA9IGRvbVJvb3QuZ2V0U2VsZWN0aW9uKClcbiAgICAgICAgICAgIHZhciBjbGVuZ3RoID0gdGV4dGZpZWxkLnRleHRDb250ZW50Lmxlbmd0aFxuICAgICAgICAgICAgcmFuZ2UubGVmdCA9IE1hdGgubWluKHMuYW5jaG9yT2Zmc2V0LCBjbGVuZ3RoKVxuICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSBNYXRoLm1pbihzLmZvY3VzT2Zmc2V0LCBjbGVuZ3RoKVxuICAgICAgICAgICAgaWYgKGZpeCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHJhbmdlLmxlZnQgPSBmaXgocmFuZ2UubGVmdClcbiAgICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSBmaXgocmFuZ2UucmlnaHQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgZWRpdGVkRWxlbWVudCA9IHMuZm9jdXNOb2RlXG4gICAgICAgICAgICBpZiAoZWRpdGVkRWxlbWVudCA9PT0gdGV4dGZpZWxkIHx8IGVkaXRlZEVsZW1lbnQgPT09IHRleHRmaWVsZC5jaGlsZE5vZGVzWzBdKSB7XG4gICAgICAgICAgICAgIHJhbmdlLmlzUmVhbCA9IHRydWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJhbmdlLmlzUmVhbCA9IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmFuZ2VcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB3cml0ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gICAgICAgICAgICB3cml0ZUNvbnRlbnQoc2VsZi50b1N0cmluZygpKVxuICAgICAgICAgICAgdmFyIHRleHRub2RlID0gdGV4dGZpZWxkLmNoaWxkTm9kZXNbMF1cbiAgICAgICAgICAgIGlmIChyYW5nZS5pc1JlYWwgJiYgdGV4dG5vZGUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAocmFuZ2UubGVmdCA8IDApIHtcbiAgICAgICAgICAgICAgICByYW5nZS5sZWZ0ID0gMFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gTWF0aC5tYXgocmFuZ2UubGVmdCwgcmFuZ2UucmlnaHQpXG4gICAgICAgICAgICAgIGlmIChyYW5nZS5yaWdodCA+IHRleHRub2RlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gdGV4dG5vZGUubGVuZ3RoXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmFuZ2UubGVmdCA9IE1hdGgubWluKHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0KVxuICAgICAgICAgICAgICB2YXIgciA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgICAgci5zZXRTdGFydCh0ZXh0bm9kZSwgcmFuZ2UubGVmdClcbiAgICAgICAgICAgICAgci5zZXRFbmQodGV4dG5vZGUsIHJhbmdlLnJpZ2h0KVxuICAgICAgICAgICAgICB2YXIgcyA9IGRvbVJvb3QuZ2V0U2VsZWN0aW9uKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgICAgcy5yZW1vdmVBbGxSYW5nZXMoKVxuICAgICAgICAgICAgICBzLmFkZFJhbmdlKHIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHdyaXRlQ29udGVudCA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gICAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJUZXh0ID0gY29udGVudFxuICAgICAgICAgICAgLypcbiAgICAgICAgICAgIHZhciBjb250ZW50QXJyYXkgPSBjb250ZW50LnJlcGxhY2UobmV3IFJlZ0V4cCgnXFxuJywgJ2cnKSwgJyAnKS5zcGxpdCgnICcpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJUZXh0ID0gJydcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29udGVudEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBjID0gY29udGVudEFycmF5W2ldXG4gICAgICAgICAgICAgIHRleHRmaWVsZC5pbm5lclRleHQgKz0gY1xuICAgICAgICAgICAgICBpZiAoaSAhPT0gY29udGVudEFycmF5Lmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJIVE1MICs9ICcmbmJzcDsnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICovXG4gICAgICAgICAgfVxuICAgICAgICAgIGdldENvbnRlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dGZpZWxkLmlubmVyVGV4dFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3cml0ZUNvbnRlbnQodGhpcy50b1N0cmluZygpKVxuXG4gICAgICAgIGZ1bmN0aW9uIHlDYWxsYmFjayAoZXZlbnQpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKCgpID0+IHtcbiAgICAgICAgICAgIHZhciBvUG9zLCBmaXhcbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICAgICAgICBvUG9zID0gZXZlbnQuaW5kZXhcbiAgICAgICAgICAgICAgZml4ID0gZnVuY3Rpb24gKGN1cnNvcikgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgICAgICAgaWYgKGN1cnNvciA8PSBvUG9zKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGN1cnNvciArPSAxXG4gICAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciByID0gY3JlYXRlUmFuZ2UoZml4KVxuICAgICAgICAgICAgICB3cml0ZVJhbmdlKHIpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdkZWxldGUnKSB7XG4gICAgICAgICAgICAgIG9Qb3MgPSBldmVudC5pbmRleFxuICAgICAgICAgICAgICBmaXggPSBmdW5jdGlvbiAoY3Vyc29yKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgICAgICBpZiAoY3Vyc29yIDwgb1Bvcykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cnNvclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cnNvclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByID0gY3JlYXRlUmFuZ2UoZml4KVxuICAgICAgICAgICAgICB3cml0ZVJhbmdlKHIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9ic2VydmUoeUNhbGxiYWNrKVxuXG4gICAgICAgIHZhciB0ZXh0ZmllbGRPYnNlcnZlciA9IGZ1bmN0aW9uIHRleHRmaWVsZE9ic2VydmVyICgpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciByID0gY3JlYXRlUmFuZ2UoZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHggfSlcbiAgICAgICAgICAgIHZhciBvbGRDb250ZW50ID0gc2VsZi50b1N0cmluZygpXG4gICAgICAgICAgICB2YXIgY29udGVudCA9IGdldENvbnRlbnQoKVxuICAgICAgICAgICAgdmFyIGRpZmZzID0gZGlmZihvbGRDb250ZW50LCBjb250ZW50LCByLmxlZnQpXG4gICAgICAgICAgICB2YXIgcG9zID0gMFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaWZmcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgZCA9IGRpZmZzW2ldXG4gICAgICAgICAgICAgIGlmIChkWzBdID09PSAwKSB7IC8vIEVRVUFMXG4gICAgICAgICAgICAgICAgcG9zICs9IGRbMV0ubGVuZ3RoXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZFswXSA9PT0gLTEpIHsgLy8gREVMRVRFXG4gICAgICAgICAgICAgICAgc2VsZi5kZWxldGUocG9zLCBkWzFdLmxlbmd0aClcbiAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gSU5TRVJUXG4gICAgICAgICAgICAgICAgc2VsZi5pbnNlcnQocG9zLCBkWzFdKVxuICAgICAgICAgICAgICAgIHBvcyArPSBkWzFdLmxlbmd0aFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0ZXh0ZmllbGQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB0ZXh0ZmllbGRPYnNlcnZlcilcbiAgICAgICAgdGhpcy50ZXh0ZmllbGRzLnB1c2goe1xuICAgICAgICAgIGVkaXRvcjogdGV4dGZpZWxkLFxuICAgICAgICAgIHlDYWxsYmFjazogeUNhbGxiYWNrLFxuICAgICAgICAgIGV2ZW50TGlzdGVuZXI6IHRleHRmaWVsZE9ic2VydmVyXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBfZGVzdHJveSAoKSB7XG4gICAgICAgIHRoaXMudW5iaW5kQWxsKClcbiAgICAgICAgdGhpcy50ZXh0ZmllbGRzID0gbnVsbFxuICAgICAgICB0aGlzLmFjZUluc3RhbmNlcyA9IG51bGxcbiAgICAgICAgc3VwZXIuX2Rlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgICBZLmV4dGVuZCgnVGV4dCcsIG5ldyBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKHtcbiAgICAgIG5hbWU6ICdUZXh0JyxcbiAgICAgIGNsYXNzOiBZVGV4dCxcbiAgICAgIHN0cnVjdDogJ0xpc3QnLFxuICAgICAgaW5pdFR5cGU6IGZ1bmN0aW9uICogWVRleHRJbml0aWFsaXplciAob3MsIG1vZGVsKSB7XG4gICAgICAgIHZhciBfY29udGVudCA9IFtdXG4gICAgICAgIHlpZWxkICogWS5TdHJ1Y3QuTGlzdC5tYXAuY2FsbCh0aGlzLCBtb2RlbCwgZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgICAgaWYgKG9wLmhhc093blByb3BlcnR5KCdvcENvbnRlbnQnKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZXh0IG11c3Qgbm90IGNvbnRhaW4gdHlwZXMhJylcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3AuY29udGVudC5mb3JFYWNoKGZ1bmN0aW9uIChjLCBpKSB7XG4gICAgICAgICAgICAgIF9jb250ZW50LnB1c2goe1xuICAgICAgICAgICAgICAgIGlkOiBbb3AuaWRbMF0sIG9wLmlkWzFdICsgaV0sXG4gICAgICAgICAgICAgICAgdmFsOiBvcC5jb250ZW50W2ldXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIG5ldyBZVGV4dChvcywgbW9kZWwuaWQsIF9jb250ZW50KVxuICAgICAgfSxcbiAgICAgIGNyZWF0ZVR5cGU6IGZ1bmN0aW9uIFlUZXh0Q3JlYXRvciAob3MsIG1vZGVsKSB7XG4gICAgICAgIHJldHVybiBuZXcgWVRleHQob3MsIG1vZGVsLmlkLCBbXSlcbiAgICAgIH1cbiAgICB9KSlcbiAgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCJmdW5jdGlvbiBleHRlbmQgKFkpIHtcblxudmFyIFVTRV9BVURJTyA9IHRydWU7XG52YXIgVVNFX1ZJREVPID0gdHJ1ZTtcbnZhciBERUZBVUxUX0NIQU5ORUwgPSAnc29tZS1nbG9iYWwtY2hhbm5lbC1uYW1lJztcbnZhciBNVVRFX0FVRElPX0JZX0RFRkFVTFQgPSBmYWxzZTtcbnZhciBzaWduYWxpbmdfc2VydmVyX3VybCA9ICdodHRwOi8vZmlud2luLmlvOjEyNTYnO1xuXG52YXIgSUNFX1NFUlZFUlMgPSBbXG4gICAge3VybHM6IFwic3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMlwifSxcbiAgICB7dXJsczogXCJ0dXJuOnRyeS5yZWZhY3RvcmVkLmFpOjM0NzhcIiwgdXNlcm5hbWU6IFwidGVzdDk5XCIsIGNyZWRlbnRpYWw6IFwidGVzdFwifVxuXTtcblxuXG52YXIgZGNzID0ge307XG52YXIgc2lnbmFsaW5nX3NvY2tldCA9IG51bGw7ICAgLyogb3VyIHNvY2tldC5pbyBjb25uZWN0aW9uIHRvIG91ciB3ZWJzZXJ2ZXIgKi9cbnZhciBsb2NhbF9tZWRpYV9zdHJlYW0gPSBudWxsOyAvKiBvdXIgb3duIG1pY3JvcGhvbmUgLyB3ZWJjYW0gKi9cbnZhciBwZWVycyA9IHt9OyAgICAgICAgICAgICAgICAvKiBrZWVwIHRyYWNrIG9mIG91ciBwZWVyIGNvbm5lY3Rpb25zLCBpbmRleGVkIGJ5IHBlZXJfaWQgKGFrYSBzb2NrZXQuaW8gaWQpICovXG52YXIgcGVlcl9tZWRpYV9lbGVtZW50cyA9IHt9OyAgLyoga2VlcCB0cmFjayBvZiBvdXIgPHZpZGVvPi88YXVkaW8+IHRhZ3MsIGluZGV4ZWQgYnkgcGVlcl9pZCAqL1xudmFyIGlzX2ZpcnN0ID0gJ3Vua25vd24nO1xuXG5mdW5jdGlvbiBpbml0KHl3ZWJydGMpIHtcbiAgICBzaWduYWxpbmdfc29ja2V0ID0gaW8uY29ubmVjdChzaWduYWxpbmdfc2VydmVyX3VybCk7XG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdjb25uZWN0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGpvaW5fY2hhdF9jaGFubmVsKERFRkFVTFRfQ0hBTk5FTCwgeyd3aGF0ZXZlci15b3Utd2FudC1oZXJlJzogJ3N0dWZmJ30pO1xuICAgIH0pO1xuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignc29ja2V0cycsIGZ1bmN0aW9uIChzb2NrZXRzKSB7XG4gICAgICAgIGlmIChzb2NrZXRzID09PSAwKSB7XG4gICAgICAgICAgICBpc19maXJzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpc19maXJzdCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgZnVuY3Rpb24oKSB7XG4gICAgICAgIC8qIFRlYXIgZG93biBhbGwgb2Ygb3VyIHBlZXIgY29ubmVjdGlvbnMgYW5kIHJlbW92ZSBhbGwgdGhlXG4gICAgICAgICAqIG1lZGlhIGRpdnMgd2hlbiB3ZSBkaXNjb25uZWN0ICovXG4gICAgICAgIGZvciAocGVlcl9pZCBpbiBwZWVyX21lZGlhX2VsZW1lbnRzKSB7XG4gICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzW3BlZXJfaWRdLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAocGVlcl9pZCBpbiBwZWVycykge1xuICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0uY2xvc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBlZXJzID0ge307XG4gICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHMgPSB7fTtcbiAgICB9KTtcbiAgICBmdW5jdGlvbiBqb2luX2NoYXRfY2hhbm5lbChjaGFubmVsLCB1c2VyZGF0YSkge1xuICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ2pvaW4nLCB7XCJjaGFubmVsXCI6IGNoYW5uZWwsIFwidXNlcmRhdGFcIjogdXNlcmRhdGF9KTtcbiAgICAgICAgeXdlYnJ0Yy5zZXRVc2VySWQoc2lnbmFsaW5nX3NvY2tldC5pZCk7XG4gICAgICAgIGZ1bmN0aW9uIGxvYWRfbm90ZWJvb2syKGZpbGVfbmFtZSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBKdXB5dGVyICE9PSAndW5kZWZpbmVkJyl7XG4gICAgICAgICAgICAgICAgaWYgKEp1cHl0ZXIubm90ZWJvb2spIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGVfbmFtZSA9PT0gJ1VudGl0bGVkLmlweW5iJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgSnVweXRlci5ub3RlYm9vay5sb2FkX25vdGVib29rKGZpbGVfbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBKdXB5dGVyLm5vdGVib29rLmxvYWRfbm90ZWJvb2syKGZpbGVfbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQobG9hZF9ub3RlYm9vazIsIDUwMCwgZmlsZV9uYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRfbm90ZWJvb2syLCA1MDAsIGZpbGVfbmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gaW5pdGlhbGl6ZV9kYXRhKCkge1xuICAgICAgICAgICAgaWYgKGlzX2ZpcnN0ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgbG9hZF9ub3RlYm9vazIoJ1VudGl0bGVkLmlweW5iJyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzX2ZpcnN0ID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGxvYWRfbm90ZWJvb2syKCd0ZW1wbGF0ZS5pcHluYicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGluaXRpYWxpemVfZGF0YSwgNTAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpbml0aWFsaXplX2RhdGEoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcGFydF9jaGF0X2NoYW5uZWwoY2hhbm5lbCkge1xuICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3BhcnQnLCBjaGFubmVsKTtcbiAgICB9XG5cblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2FkZFBlZXInLCBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcblxuICAgICAgICB5d2VicnRjLnVzZXJKb2luZWQocGVlcl9pZCwgJ21hc3RlcicpO1xuXG4gICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJzKSB7XG4gICAgICAgICAgICAvKiBUaGlzIGNvdWxkIGhhcHBlbiBpZiB0aGUgdXNlciBqb2lucyBtdWx0aXBsZSBjaGFubmVscyB3aGVyZSB0aGUgb3RoZXIgcGVlciBpcyBhbHNvIGluLiAqL1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHBlZXJfY29ubmVjdGlvbiA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbih7XCJpY2VTZXJ2ZXJzXCI6IElDRV9TRVJWRVJTfSk7XG4gICAgICAgIHBlZXJzW3BlZXJfaWRdID0gcGVlcl9jb25uZWN0aW9uO1xuICAgICAgICB2YXIgZGF0YUNoYW5uZWwgPSBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoJ2RhdGEnKTtcbiAgICAgICAgZGNzW3BlZXJfaWRdID0gZGF0YUNoYW5uZWw7XG4gICAgICAgIGRhdGFDaGFubmVsLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgeXdlYnJ0Yy5yZWNlaXZlTWVzc2FnZShwZWVyX2lkLCBKU09OLnBhcnNlKGUuZGF0YSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBlZXJfY29ubmVjdGlvbi5vbmljZWNhbmRpZGF0ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuY2FuZGlkYXRlKSB7XG4gICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheUlDRUNhbmRpZGF0ZScsIHtcbiAgICAgICAgICAgICAgICAgICAgJ3BlZXJfaWQnOiBwZWVyX2lkLCBcbiAgICAgICAgICAgICAgICAgICAgJ2ljZV9jYW5kaWRhdGUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnc2RwTUxpbmVJbmRleCc6IGV2ZW50LmNhbmRpZGF0ZS5zZHBNTGluZUluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2NhbmRpZGF0ZSc6IGV2ZW50LmNhbmRpZGF0ZS5jYW5kaWRhdGVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbmZpZy5zaG91bGRfY3JlYXRlX29mZmVyKSB7XG4gICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGxvY2FsX2Rlc2NyaXB0aW9uKSB7IFxuICAgICAgICAgICAgICAgICAgICBwZWVyX2Nvbm5lY3Rpb24uc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbF9kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5U2Vzc2lvbkRlc2NyaXB0aW9uJywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsncGVlcl9pZCc6IHBlZXJfaWQsICdzZXNzaW9uX2Rlc2NyaXB0aW9uJzogbG9jYWxfZGVzY3JpcHRpb259KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHsgQWxlcnQoXCJPZmZlciBzZXRMb2NhbERlc2NyaXB0aW9uIGZhaWxlZCFcIik7IH1cbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVycm9yIHNlbmRpbmcgb2ZmZXI6IFwiLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgLyoqIFxuICAgICAqIFBlZXJzIGV4Y2hhbmdlIHNlc3Npb24gZGVzY3JpcHRpb25zIHdoaWNoIGNvbnRhaW5zIGluZm9ybWF0aW9uXG4gICAgICogYWJvdXQgdGhlaXIgYXVkaW8gLyB2aWRlbyBzZXR0aW5ncyBhbmQgdGhhdCBzb3J0IG9mIHN0dWZmLiBGaXJzdFxuICAgICAqIHRoZSAnb2ZmZXJlcicgc2VuZHMgYSBkZXNjcmlwdGlvbiB0byB0aGUgJ2Fuc3dlcmVyJyAod2l0aCB0eXBlXG4gICAgICogXCJvZmZlclwiKSwgdGhlbiB0aGUgYW5zd2VyZXIgc2VuZHMgb25lIGJhY2sgKHdpdGggdHlwZSBcImFuc3dlclwiKS4gIFxuICAgICAqL1xuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3Nlc3Npb25EZXNjcmlwdGlvbicsIGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuICAgICAgICB2YXIgcGVlciA9IHBlZXJzW3BlZXJfaWRdO1xuXG4gICAgICAgIHBlZXIub25kYXRhY2hhbm5lbCA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGFDaGFubmVsID0gZXZlbnQuY2hhbm5lbDtcbiAgICAgICAgICAgIGRhdGFDaGFubmVsLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlKTtcbiAgICAgICAgICAgICAgICB5d2VicnRjLnJlY2VpdmVNZXNzYWdlKHBlZXJfaWQsIEpTT04ucGFyc2UoZS5kYXRhKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciByZW1vdGVfZGVzY3JpcHRpb24gPSBjb25maWcuc2Vzc2lvbl9kZXNjcmlwdGlvbjtcblxuICAgICAgICB2YXIgZGVzYyA9IG5ldyBSVENTZXNzaW9uRGVzY3JpcHRpb24ocmVtb3RlX2Rlc2NyaXB0aW9uKTtcbiAgICAgICAgdmFyIHN0dWZmID0gcGVlci5zZXRSZW1vdGVEZXNjcmlwdGlvbihkZXNjLCBcbiAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChyZW1vdGVfZGVzY3JpcHRpb24udHlwZSA9PSBcIm9mZmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVlci5jcmVhdGVBbnN3ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihsb2NhbF9kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZXIuc2V0TG9jYWxEZXNjcmlwdGlvbihsb2NhbF9kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnbmFsaW5nX3NvY2tldC5lbWl0KCdyZWxheVNlc3Npb25EZXNjcmlwdGlvbicsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsncGVlcl9pZCc6IHBlZXJfaWQsICdzZXNzaW9uX2Rlc2NyaXB0aW9uJzogbG9jYWxfZGVzY3JpcHRpb259KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7IEFsZXJ0KFwiQW5zd2VyIHNldExvY2FsRGVzY3JpcHRpb24gZmFpbGVkIVwiKTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkVycm9yIGNyZWF0aW5nIGFuc3dlcjogXCIsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2V0UmVtb3RlRGVzY3JpcHRpb24gZXJyb3I6IFwiLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICB9KTtcblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2ljZUNhbmRpZGF0ZScsIGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB2YXIgcGVlciA9IHBlZXJzW2NvbmZpZy5wZWVyX2lkXTtcbiAgICAgICAgdmFyIGljZV9jYW5kaWRhdGUgPSBjb25maWcuaWNlX2NhbmRpZGF0ZTtcbiAgICAgICAgcGVlci5hZGRJY2VDYW5kaWRhdGUobmV3IFJUQ0ljZUNhbmRpZGF0ZShpY2VfY2FuZGlkYXRlKSk7XG4gICAgfSk7XG5cblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ3JlbW92ZVBlZXInLCBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdmFyIHBlZXJfaWQgPSBjb25maWcucGVlcl9pZDtcbiAgICAgICAgeXdlYnJ0Yy51c2VyTGVmdChwZWVyX2lkKTtcbiAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcl9tZWRpYV9lbGVtZW50cykge1xuICAgICAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50c1twZWVyX2lkXS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVycykge1xuICAgICAgICAgICAgcGVlcnNbcGVlcl9pZF0uY2xvc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbGV0ZSBwZWVyc1twZWVyX2lkXTtcbiAgICAgICAgZGVsZXRlIHBlZXJfbWVkaWFfZWxlbWVudHNbY29uZmlnLnBlZXJfaWRdO1xuICAgIH0pO1xufVxuXG5cbiAgY2xhc3MgV2ViUlRDIGV4dGVuZHMgWS5BYnN0cmFjdENvbm5lY3RvciB7XG4gICAgY29uc3RydWN0b3IgKHksIG9wdGlvbnMpIHtcbiAgICAgIGlmIChvcHRpb25zID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcHRpb25zIG11c3Qgbm90IGJlIHVuZGVmaW5lZCEnKVxuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMucm9vbSA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgZGVmaW5lIGEgcm9vbSBuYW1lIScpXG4gICAgICB9XG4gICAgICBvcHRpb25zLnJvbGUgPSAnc2xhdmUnXG4gICAgICBzdXBlcih5LCBvcHRpb25zKVxuICAgICAgdGhpcy53ZWJydGNPcHRpb25zID0ge1xuICAgICAgICB1cmw6IG9wdGlvbnMudXJsLFxuICAgICAgICByb29tOiBvcHRpb25zLnJvb21cbiAgICAgIH1cbiAgICAgIHZhciB5d2VicnRjID0gdGhpcztcbiAgICAgIGluaXQoeXdlYnJ0Yyk7XG4gICAgICB2YXIgc3dyID0gc2lnbmFsaW5nX3NvY2tldDtcbiAgICAgIHRoaXMuc3dyID0gc3dyO1xuICAgIH1cbiAgICBkaXNjb25uZWN0ICgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdpbXBsZW1lbnQgZGlzY29ubmVjdCBvZiBjaGFubmVsJyk7XG4gICAgICBzdXBlci5kaXNjb25uZWN0KClcbiAgICB9XG4gICAgcmVjb25uZWN0ICgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdpbXBsZW1lbnQgcmVjb25uZWN0IG9mIGNoYW5uZWwnKTtcbiAgICAgIHN1cGVyLnJlY29ubmVjdCgpXG4gICAgfVxuICAgIHNlbmQgKHVpZCwgbWVzc2FnZSkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgICAgdmFyIHNlbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZGMgPSBkY3NbdWlkXTtcbiAgICAgICAgICAgIGlmIChkYy5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgICAgICAgICBkYy5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoc2VuZCwgNTAwKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHRyeSB0byBzZW5kIHRoZSBtZXNzYWdlXG4gICAgICAgIHNlbmQoKVxuICAgIH1cbiAgICBicm9hZGNhc3QgKG1lc3NhZ2UpIHtcbiAgICAgICAgZm9yICh2YXIgcGVlcl9pZCBpbiBkY3MpIHtcbiAgICAgICAgICAgIHZhciBkYyA9IGRjc1twZWVyX2lkXTtcbiAgICAgICAgICAgIGlmIChkYy5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgICAgICAgICBkYy5zZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdFcnJycnJycnJycnJycnJycnJycnJycnJycnJycnJycicsIHBlZXJfaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGlzRGlzY29ubmVjdGVkICgpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuICBZLmV4dGVuZCgnd2VicnRjJywgV2ViUlRDKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuaWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuICBleHRlbmQoWSlcbn1cbiIsIi8qIGdsb2JhbCBZLCBNdXRhdGlvbk9ic2VydmVyICovXG4ndXNlIHN0cmljdCdcblxuZnVuY3Rpb24gZXh0ZW5kIChZKSB7XG4gIFkucmVxdWVzdE1vZHVsZXMoWydBcnJheScsICdNYXAnXSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgY2xhc3MgWVhtbCBleHRlbmRzIFkuQXJyYXkudHlwZURlZmluaXRpb25bJ2NsYXNzJ10ge1xuICAgICAgY29uc3RydWN0b3IgKG9zLCBfbW9kZWwsIF9jb250ZW50LCBhdHRyaWJ1dGVzLCB0YWduYW1lLCBpbml0KSB7XG4gICAgICAgIHN1cGVyKG9zLCBfbW9kZWwsIF9jb250ZW50KVxuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzXG4gICAgICAgIHRoaXMuZG9tID0gbnVsbFxuICAgICAgICB0aGlzLl9kb21PYnNlcnZlciA9IG51bGxcbiAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIgPSBuZXcgWS51dGlscy5FdmVudExpc3RlbmVySGFuZGxlcigpXG4gICAgICAgIHRoaXMudGFnbmFtZSA9IHRhZ25hbWVcbiAgICAgICAgaWYgKGluaXQgIT0gbnVsbCAmJiBpbml0LmRvbSAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5fc2V0RG9tKGluaXQuZG9tKVxuICAgICAgICB9XG4gICAgICAgIHN1cGVyLm9ic2VydmUoZXZlbnQgPT4ge1xuICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnaW5zZXJ0Jykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2NoaWxkSW5zZXJ0ZWQnLFxuICAgICAgICAgICAgICBpbmRleDogZXZlbnQuaW5kZXgsXG4gICAgICAgICAgICAgIG5vZGVzOiBldmVudC52YWx1ZXNcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2NoaWxkUmVtb3ZlZCcsXG4gICAgICAgICAgICAgIGluZGV4OiBldmVudC5pbmRleCxcbiAgICAgICAgICAgICAgX2NvbnRlbnQ6IGV2ZW50Ll9jb250ZW50LFxuICAgICAgICAgICAgICB2YWx1ZXM6IGV2ZW50LnZhbHVlc1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIGF0dHJpYnV0ZXMub2JzZXJ2ZShldmVudCA9PiB7XG4gICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICd1cGRhdGUnIHx8IGV2ZW50LnR5cGUgPT09ICdhZGQnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMoe1xuICAgICAgICAgICAgICB0eXBlOiAnYXR0cmlidXRlQ2hhbmdlZCcsXG4gICAgICAgICAgICAgIG5hbWU6IGV2ZW50Lm5hbWUsXG4gICAgICAgICAgICAgIHZhbHVlOiBldmVudC52YWx1ZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdkZWxldGUnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMoe1xuICAgICAgICAgICAgICB0eXBlOiAnYXR0cmlidXRlUmVtb3ZlZCcsXG4gICAgICAgICAgICAgIG5hbWU6IGV2ZW50Lm5hbWVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgX2Rlc3Ryb3kgKCkge1xuICAgICAgICBpZiAodGhpcy5fZG9tT2JzZXJ2ZXIgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuX2RvbU9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLmRlc3Ryb3koKVxuICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlciA9IG51bGxcbiAgICAgICAgc3VwZXIuX2Rlc3Ryb3koKVxuICAgICAgfVxuICAgICAgaW5zZXJ0IChwb3MsIHR5cGVzKSB7XG4gICAgICAgIHZhciBfdHlwZXMgPSBbXVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodHlwZXMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBhbiBBcnJheSBvZiBjb250ZW50IScpXG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciB2ID0gdHlwZXNbaV1cbiAgICAgICAgICB2YXIgdCA9IFkudXRpbHMuaXNUeXBlRGVmaW5pdGlvbih2KVxuICAgICAgICAgIGlmICghKHYgIT0gbnVsbCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAodCAmJiB0WzBdLmNsYXNzID09PSBZWG1sKVxuICAgICAgICAgICAgICkpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIFkuWG1sIHR5cGUgb3IgU3RyaW5nIScpXG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgdi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbnRpbnVlIC8vIGlmIGVtcHR5IHN0cmluZ1xuICAgICAgICAgIH1cbiAgICAgICAgICBfdHlwZXMucHVzaCh2KVxuICAgICAgICB9XG4gICAgICAgIHN1cGVyLmluc2VydChwb3MsIHR5cGVzKVxuICAgICAgfVxuICAgICAgLy8gYmluZHMgdG8gYSBkb20gZWxlbWVudFxuICAgICAgLy8gT25seSBjYWxsIGlmIGRvbSBhbmQgWVhtbCBhcmUgaXNvbW9ycGhcbiAgICAgIF9iaW5kVG9Eb20gKGRvbSkge1xuICAgICAgICAvLyB0aGlzIGZ1bmN0aW9uIG1ha2VzIHN1cmUgdGhhdCBlaXRoZXIgdGhlXG4gICAgICAgIC8vIGRvbSBldmVudCBpcyBleGVjdXRlZCwgb3IgdGhlIHlqcyBvYnNlcnZlciBpcyBleGVjdXRlZFxuICAgICAgICB2YXIgdG9rZW4gPSB0cnVlXG4gICAgICAgIHZhciBtdXR1YWxFeGNsdWRlID0gZiA9PiB7XG4gICAgICAgICAgLy8gdGFrZSBhbmQgcHJvY2VzcyBjdXJyZW50IHJlY29yZHNcbiAgICAgICAgICB2YXIgcmVjb3JkcyA9IHRoaXMuX2RvbU9ic2VydmVyLnRha2VSZWNvcmRzKClcbiAgICAgICAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9kb21PYnNlcnZlckxpc3RlbmVyKHJlY29yZHMpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgdG9rZW4gPSBmYWxzZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIC8vIGRpc2NhcmQgY3JlYXRlZCByZWNvcmRzXG4gICAgICAgICAgICAgIHRoaXMuX2RvbU9ic2VydmVyLnRha2VSZWNvcmRzKClcbiAgICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgICAgIHRocm93IGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2RvbU9ic2VydmVyLnRha2VSZWNvcmRzKClcbiAgICAgICAgICAgIHRva2VuID0gdHJ1ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9tdXR1YWxFeGNsdWRlID0gbXV0dWFsRXhjbHVkZVxuICAgICAgICB0aGlzLl9kb21PYnNlcnZlckxpc3RlbmVyID0gbXV0YXRpb25zID0+IHtcbiAgICAgICAgICBtdXR1YWxFeGNsdWRlKCgpID0+IHtcbiAgICAgICAgICAgIG11dGF0aW9ucy5mb3JFYWNoKG11dGF0aW9uID0+IHtcbiAgICAgICAgICAgICAgaWYgKG11dGF0aW9uLnR5cGUgPT09ICdhdHRyaWJ1dGVzJykge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gbXV0YXRpb24uYXR0cmlidXRlTmFtZVxuICAgICAgICAgICAgICAgIHZhciB2YWwgPSBtdXRhdGlvbi50YXJnZXQuZ2V0QXR0cmlidXRlKG11dGF0aW9uLmF0dHJpYnV0ZU5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXR0cmlidXRlcy5nZXQobmFtZSkgIT09IHZhbCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnNldChuYW1lLCB2YWwpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKG11dGF0aW9uLnR5cGUgPT09ICdjaGlsZExpc3QnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtdXRhdGlvbi5hZGRlZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICBsZXQgbiA9IG11dGF0aW9uLmFkZGVkTm9kZXNbaV1cbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jb250ZW50LnNvbWUoZnVuY3Rpb24gKGMpIHsgcmV0dXJuIGMuZG9tID09PSBuIH0pKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGl0IGFscmVhZHkgZXhpc3RzIChzaW5jZSB0aGlzIG1ldGhvZCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAobiBpbnN0YW5jZW9mIHdpbmRvdy5UZXh0ICYmIG4udGV4dENvbnRlbnQgPT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRleHRub2RlIGFuZCBlbXB0eSBjb250ZW50IChzb21ldGltZSBoYXBwZW5zLi4gKVxuICAgICAgICAgICAgICAgICAgICAvLyAgIFRPRE8gLSB5b3UgY291bGQgYWxzbyBjaGVjayBpZiB0aGUgaW5zZXJ0ZWQgbm9kZSBhY3R1YWxseSBleGlzdHMgaW4gdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgIGRvbSAoaW4gb3JkZXIgdG8gY292ZXIgbW9yZSBwb3RlbnRpYWwgY2FzZXMpXG4gICAgICAgICAgICAgICAgICAgIG4ucmVtb3ZlKClcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8vIGNvbXB1dGUgcG9zaXRpb25cbiAgICAgICAgICAgICAgICAgIC8vIHNwZWNpYWwgY2FzZSwgbi5uZXh0U2libGluZyBpcyBub3QgeWV0IGluc2VydGVkLiBTbyB3ZSBmaW5kIHRoZSBuZXh0IGluc2VydGVkIGVsZW1lbnQhXG4gICAgICAgICAgICAgICAgICB2YXIgcG9zID0gLTFcbiAgICAgICAgICAgICAgICAgIHZhciBuZXh0U2libGluZyA9IG4ubmV4dFNpYmxpbmdcbiAgICAgICAgICAgICAgICAgIHdoaWxlIChwb3MgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0U2libGluZyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcG9zID0gdGhpcy5fY29udGVudC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwb3MgPSB0aGlzLl9jb250ZW50LmZpbmRJbmRleChmdW5jdGlvbiAoYykgeyByZXR1cm4gYy5kb20gPT09IG5leHRTaWJsaW5nIH0pXG4gICAgICAgICAgICAgICAgICAgICAgbmV4dFNpYmxpbmcgPSBuZXh0U2libGluZy5uZXh0U2libGluZ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB2YXIgY1xuICAgICAgICAgICAgICAgICAgaWYgKG4gaW5zdGFuY2VvZiB3aW5kb3cuVGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBjID0gbi50ZXh0Q29udGVudFxuICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuIGluc3RhbmNlb2Ygd2luZG93LkVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgYyA9IFkuWG1sKG4pXG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIFhNTCBFbGVtZW50IGZvdW5kLiBTeW5jaHJvbml6YXRpb24gd2lsbCBubyBsb25nZXIgd29yayEnKVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgdGhpcy5pbnNlcnQocG9zLCBbY10pXG4gICAgICAgICAgICAgICAgICB2YXIgY29udGVudCA9IHRoaXMuX2NvbnRlbnRbcG9zXVxuICAgICAgICAgICAgICAgICAgY29udGVudC5kb20gPSBuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobXV0YXRpb24ucmVtb3ZlZE5vZGVzLCBuID0+IHtcbiAgICAgICAgICAgICAgICAgIHZhciBwb3MgPSB0aGlzLl9jb250ZW50LmZpbmRJbmRleChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYy5kb20gPT09IG5cbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICBpZiAocG9zID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGUocG9zKVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbiB1bmV4cGVjdGVkIGNvbmRpdGlvbiBvY2N1cmVkIChkZWxldGVkIG5vZGUgZG9lcyBub3QgZXhpc3QgaW4gdGhlIG1vZGVsKSEnKVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kb21PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIpXG4gICAgICAgIHRoaXMuX2RvbU9ic2VydmVyLm9ic2VydmUoZG9tLCB7IGF0dHJpYnV0ZXM6IHRydWUsIGNoaWxkTGlzdDogdHJ1ZSB9KVxuICAgICAgICAvLyBJbiBvcmRlciB0byBpbnNlcnQgYSBuZXcgbm9kZSwgc3VjY2Vzc29yIG5lZWRzIHRvIGJlIGluc2VydGVkXG4gICAgICAgIC8vIHdoZW4gYy5kb20gY2FuIGJlIGluc2VydGVkLCB0cnkgdG8gaW5zZXJ0IHRoZSBwcmVkZWNlc3NvcnMgdG9vXG4gICAgICAgIHZhciBfdHJ5SW5zZXJ0RG9tID0gKHBvcykgPT4ge1xuICAgICAgICAgIHZhciBjID0gdGhpcy5fY29udGVudFtwb3NdXG4gICAgICAgICAgdmFyIHN1Y2NcbiAgICAgICAgICBpZiAocG9zICsgMSA8IHRoaXMuX2NvbnRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICBzdWNjID0gdGhpcy5fY29udGVudFtwb3MgKyAxXVxuICAgICAgICAgICAgaWYgKHN1Y2MuZG9tID09IG51bGwpIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBiZWhhdmlvcicpIC8vIHNob3VsZG4ndCBoYXBwZW4gYW55bW9yZSFcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcHNldWRvIHN1Y2Nlc3NvclxuICAgICAgICAgICAgc3VjYyA9IHtcbiAgICAgICAgICAgICAgZG9tOiBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGRvbS5pbnNlcnRCZWZvcmUoYy5kb20sIHN1Y2MuZG9tKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RyeUluc2VydERvbSA9IF90cnlJbnNlcnREb21cbiAgICAgICAgdGhpcy5vYnNlcnZlKGV2ZW50ID0+IHtcbiAgICAgICAgICBtdXR1YWxFeGNsdWRlKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnYXR0cmlidXRlQ2hhbmdlZCcpIHtcbiAgICAgICAgICAgICAgZG9tLnNldEF0dHJpYnV0ZShldmVudC5uYW1lLCBldmVudC52YWx1ZSlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2F0dHJpYnV0ZVJlbW92ZWQnKSB7XG4gICAgICAgICAgICAgIGRvbS5yZW1vdmVBdHRyaWJ1dGUoZXZlbnQubmFtZSlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2NoaWxkSW5zZXJ0ZWQnKSB7XG4gICAgICAgICAgICAgIGlmIChldmVudC5ub2Rlcy5sZW5ndGggPT09IDEgJiYgZXZlbnQubm9kZXNbMF0gaW5zdGFuY2VvZiBZWG1sKSB7XG4gICAgICAgICAgICAgICAgLy8gYSBuZXcgeG1sIG5vZGUgd2FzIGluc2VydGVkLlxuICAgICAgICAgICAgICAgIC8vIFRPRE86IGNvbnNpZGVyIHRoZSBjYXNlIHRoYXQgbm9kZXMgY29udGFpbnMgbWl4ZWQgdGV4dCAmIHR5cGVzIChjdXJyZW50bHkgbm90IGltcGxlbWVudGVkIGluIHlqcylcbiAgICAgICAgICAgICAgICB2YXIgdmFsSWQgPSB0aGlzLl9jb250ZW50W2V2ZW50LmluZGV4XS5pZFxuICAgICAgICAgICAgICAgIGlmIChldmVudC5ub2Rlcy5sZW5ndGggPiAxKSB7IHRocm93IG5ldyBFcnJvcignVGhpcyBjYXNlIGlzIG5vdCBoYW5kbGVkLCB5b3VcXCdsbCBydW4gaW50byBjb25zaXN0ZW5jeSBpc3N1ZXMuIENvbnRhY3QgdGhlIGRldmVsb3BlcicpIH1cbiAgICAgICAgICAgICAgICB2YXIgbmV3Tm9kZSA9IGV2ZW50Lm5vZGVzWzBdLmdldERvbSgpXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBjYWxsZWQgYXN5bmMuIFNvIHdlIGhhdmUgdG8gY29tcHV0ZSB0aGUgcG9zaXRpb24gYWdhaW5cbiAgICAgICAgICAgICAgICAvLyBhbHNvIG11dHVhbCBleGNsdXNlIHRoaXNcbiAgICAgICAgICAgICAgICB2YXIgcG9zXG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmluZGV4IDwgdGhpcy5fY29udGVudC5sZW5ndGggJiYgWS51dGlscy5jb21wYXJlSWRzKHRoaXMuX2NvbnRlbnRbZXZlbnQuaW5kZXhdLmlkLCB2YWxJZCkpIHtcbiAgICAgICAgICAgICAgICAgIHBvcyA9IGV2ZW50LmluZGV4XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBvcyA9IHRoaXMuX2NvbnRlbnQuZmluZEluZGV4KGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBZLnV0aWxzLmNvbXBhcmVJZHMoYy5pZCwgdmFsSWQpXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocG9zID49IDApIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbnRlbnRbcG9zXS5kb20gPSBuZXdOb2RlXG4gICAgICAgICAgICAgICAgICBfdHJ5SW5zZXJ0RG9tKHBvcylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IGV2ZW50Lm5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbiA9IGV2ZW50Lm5vZGVzW2ldXG4gICAgICAgICAgICAgICAgICB2YXIgdGV4dE5vZGUgPSBuZXcgd2luZG93LlRleHQobilcbiAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbnRlbnRbZXZlbnQuaW5kZXggKyBpXS5kb20gPSB0ZXh0Tm9kZVxuICAgICAgICAgICAgICAgICAgX3RyeUluc2VydERvbShldmVudC5pbmRleCArIGkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdjaGlsZFJlbW92ZWQnKSB7XG4gICAgICAgICAgICAgIGV2ZW50Ll9jb250ZW50LmZvckVhY2goZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICBpZiAoYy5kb20gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgYy5kb20ucmVtb3ZlKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGRvbVxuICAgICAgfVxuICAgICAgX3NldERvbSAoZG9tKSB7XG4gICAgICAgIGlmICh0aGlzLmRvbSAhPSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IGNhbGwgdGhpcyBtZXRob2QgaWYgeW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nIDspJylcbiAgICAgICAgfSBlbHNlIGlmIChkb20uX195eG1sICE9IG51bGwpIHsgLy8gVE9ETyBkbyBpIG5lZWQgdG8gY2hlY2sgdGhpcz8gLSBuby4uIGJ1dCBmb3IgZGV2IHB1cnBzLi5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FscmVhZHkgYm91bmQgdG8gYW4gWVhtbCB0eXBlJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkb20uX195eG1sID0gdGhpcy5fbW9kZWxcbiAgICAgICAgICAvLyB0YWcgaXMgYWxyZWFkeSBzZXQgaW4gY29uc3RydWN0b3JcbiAgICAgICAgICAvLyBzZXQgYXR0cmlidXRlc1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZG9tLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBhdHRyID0gZG9tLmF0dHJpYnV0ZXNbaV1cbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5zZXQoYXR0ci5uYW1lLCBhdHRyLnZhbHVlKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmluc2VydCgwLCBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoZG9tLmNoaWxkTm9kZXMsIChjLCBpKSA9PiB7XG4gICAgICAgICAgICBpZiAoYyBpbnN0YW5jZW9mIHdpbmRvdy5FbGVtZW50KSB7XG4gICAgICAgICAgICAgIHJldHVybiBZLlhtbChjKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChjIGluc3RhbmNlb2Ygd2luZG93LlRleHQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGMudGV4dENvbnRlbnRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBub2RlIHR5cGUhJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSlcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGRvbS5jaGlsZE5vZGVzLCAoZG9tLCBpKSA9PiB7XG4gICAgICAgICAgICB2YXIgYyA9IHRoaXMuX2NvbnRlbnRbaV1cbiAgICAgICAgICAgIGMuZG9tID0gZG9tXG4gICAgICAgICAgfSlcbiAgICAgICAgICB0aGlzLmRvbSA9IHRoaXMuX2JpbmRUb0RvbShkb20pXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZG9tXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGdldERvbSAoKSB7XG4gICAgICAgIGlmICh0aGlzLmRvbSA9PSBudWxsKSB7XG4gICAgICAgICAgdmFyIGRvbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGhpcy50YWduYW1lKVxuICAgICAgICAgIGRvbS5fX3l4bWwgPSB0aGlzXG4gICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLmtleXNQcmltaXRpdmVzKCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgICAgZG9tLnNldEF0dHJpYnV0ZShrZXksIHRoaXMuYXR0cmlidXRlcy5nZXQoa2V5KSlcbiAgICAgICAgICB9KVxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fY29udGVudC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGV0IGMgPSB0aGlzLl9jb250ZW50W2ldXG4gICAgICAgICAgICBpZiAoYy5oYXNPd25Qcm9wZXJ0eSgndmFsJykpIHtcbiAgICAgICAgICAgICAgYy5kb20gPSBuZXcgd2luZG93LlRleHQoYy52YWwpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjLmRvbSA9IHRoaXMub3MuZ2V0VHlwZShjLnR5cGUpLmdldERvbSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb20uYXBwZW5kQ2hpbGQoYy5kb20pXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuZG9tID0gdGhpcy5fYmluZFRvRG9tKGRvbSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5kb21cbiAgICAgIH1cbiAgICAgIG9ic2VydmUgKGYpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcihmKVxuICAgICAgfVxuICAgICAgdW5vYnNlcnZlIChmKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZilcbiAgICAgIH1cbiAgICAgICogX2NoYW5nZWQgKCkge1xuICAgICAgICBpZiAodGhpcy5fZG9tT2JzZXJ2ZXIgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIodGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKSlcbiAgICAgICAgfVxuICAgICAgICB5aWVsZCogWS5BcnJheS50eXBlRGVmaW5pdGlvblsnY2xhc3MnXS5wcm90b3R5cGUuX2NoYW5nZWQuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgfVxuICAgIH1cbiAgICBZLmV4dGVuZCgnWG1sJywgbmV3IFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe1xuICAgICAgbmFtZTogJ1htbCcsXG4gICAgICBjbGFzczogWVhtbCxcbiAgICAgIHN0cnVjdDogJ0xpc3QnLFxuICAgICAgcGFyc2VBcmd1bWVudHM6IGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIFt0aGlzLCB7XG4gICAgICAgICAgICB0YWduYW1lOiBhcmdcbiAgICAgICAgICB9XVxuICAgICAgICB9IGVsc2UgaWYgKGFyZyBpbnN0YW5jZW9mIHdpbmRvdy5FbGVtZW50KSB7XG4gICAgICAgICAgcmV0dXJuIFt0aGlzLCB7XG4gICAgICAgICAgICB0YWduYW1lOiBhcmcudGFnTmFtZSxcbiAgICAgICAgICAgIGRvbTogYXJnXG4gICAgICAgICAgfV1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1kuWG1sIHJlcXVpcmVzIGFuIGFyZ3VtZW50IHdoaWNoIGlzIGEgc3RyaW5nIScpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBpbml0VHlwZTogZnVuY3Rpb24gKiBZWG1sSW5pdGlhbGl6ZXIgKG9zLCBtb2RlbCwgYXJncykge1xuICAgICAgICB2YXIgX2NvbnRlbnQgPSBbXVxuICAgICAgICB2YXIgX3R5cGVzID0gW11cbiAgICAgICAgeWllbGQqIFkuU3RydWN0Lkxpc3QubWFwLmNhbGwodGhpcywgbW9kZWwsIGZ1bmN0aW9uIChvcCkge1xuICAgICAgICAgIGlmIChvcC5oYXNPd25Qcm9wZXJ0eSgnb3BDb250ZW50JykpIHtcbiAgICAgICAgICAgIF9jb250ZW50LnB1c2goe1xuICAgICAgICAgICAgICBpZDogb3AuaWQsXG4gICAgICAgICAgICAgIHR5cGU6IG9wLm9wQ29udGVudFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF90eXBlcy5wdXNoKG9wLm9wQ29udGVudClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3AuY29udGVudC5mb3JFYWNoKGZ1bmN0aW9uIChjLCBpKSB7XG4gICAgICAgICAgICAgIF9jb250ZW50LnB1c2goe1xuICAgICAgICAgICAgICAgIGlkOiBbb3AuaWRbMF0sIG9wLmlkWzFdICsgaV0sXG4gICAgICAgICAgICAgICAgdmFsOiBvcC5jb250ZW50W2ldXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB5aWVsZCogb3MuaW5pdFR5cGUuY2FsbCh0aGlzLCBfdHlwZXNbaV0pXG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgdGhpcyB0eXBlIGlzIGRlZmluZWQgaW4geS5zaGFyZS4qLCBpbml0VHlwZSBpcyBjYWxsZWQgaW5zdGVhZCBvZiBjcmVhdGVUeXBlIVxuICAgICAgICAvLyBTbyB3ZSBoYXZlIHRvIGluaXRpYWxpemUgaXQgcHJvcGVybHlcbiAgICAgICAgdmFyIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKG1vZGVsLmlkWzBdID09PSAnXycpIHtcbiAgICAgICAgICB2YXIgdHlwZXN0cnVjdCA9IFkuTWFwLnR5cGVEZWZpbml0aW9uLnN0cnVjdFxuICAgICAgICAgIHZhciBpZCA9IFsnXycsIHR5cGVzdHJ1Y3QgKyAnXycgKyAnTWFwXycgKyBtb2RlbC5pZFsxXV1cbiAgICAgICAgICBwcm9wZXJ0aWVzID0geWllbGQqIG9zLmluaXRUeXBlLmNhbGwodGhpcywgaWQpXG5cbiAgICAgICAgICBtb2RlbC5yZXF1aXJlcyA9IFtwcm9wZXJ0aWVzLl9tb2RlbF1cbiAgICAgICAgICBtb2RlbC5pbmZvID0ge1xuICAgICAgICAgICAgdGFnbmFtZTogYXJncy50YWduYW1lXG4gICAgICAgICAgfVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihtb2RlbClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9wZXJ0aWVzID0geWllbGQqIG9zLmluaXRUeXBlLmNhbGwodGhpcywgbW9kZWwucmVxdWlyZXNbMF0pIC8vIGdldCB0aGUgb25seSByZXF1aXJlZCBvcFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgWVhtbChvcywgbW9kZWwuaWQsIF9jb250ZW50LCBwcm9wZXJ0aWVzLCBtb2RlbC5pbmZvLnRhZ25hbWUsIG1vZGVsLmluZm8pXG4gICAgICB9LFxuICAgICAgY3JlYXRlVHlwZTogZnVuY3Rpb24gWVhtbENyZWF0b3IgKG9zLCBtb2RlbCwgYXJncykge1xuICAgICAgICB2YXIgaWQgPSBudWxsXG4gICAgICAgIGlmIChtb2RlbC5pZFswXSA9PT0gJ18nKSB7XG4gICAgICAgICAgdmFyIHR5cGVzdHJ1Y3QgPSBZLk1hcC50eXBlRGVmaW5pdGlvbi5zdHJ1Y3RcbiAgICAgICAgICBpZCA9IFsnXycsIHR5cGVzdHJ1Y3QgKyAnXycgKyAnTWFwXycgKyBtb2RlbC5pZFsxXV1cbiAgICAgICAgfVxuICAgICAgICB2YXIgcHJvcGVydGllcyA9IG9zLmNyZWF0ZVR5cGUoWS5NYXAoKSwgaWQpXG4gICAgICAgIG1vZGVsLmluZm8gPSB7XG4gICAgICAgICAgdGFnbmFtZTogYXJncy50YWduYW1lXG4gICAgICAgIH1cbiAgICAgICAgbW9kZWwucmVxdWlyZXMgPSBbcHJvcGVydGllcy5fbW9kZWxdIC8vIFhNTCByZXF1aXJlcyB0aGF0ICdwcm9wZXJ0aWVzJyBleGlzdHNcbiAgICAgICAgcmV0dXJuIG5ldyBZWG1sKG9zLCBtb2RlbC5pZCwgW10sIHByb3BlcnRpZXMsIG1vZGVsLmluZm8udGFnbmFtZSwgYXJncylcbiAgICAgIH1cbiAgICB9KSlcbiAgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCIvKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kZWJ1ZycpO1xuZXhwb3J0cy5sb2cgPSBsb2c7XG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcbmV4cG9ydHMuc3RvcmFnZSA9ICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWVcbiAgICAgICAgICAgICAgICYmICd1bmRlZmluZWQnICE9IHR5cGVvZiBjaHJvbWUuc3RvcmFnZVxuICAgICAgICAgICAgICAgICAgPyBjaHJvbWUuc3RvcmFnZS5sb2NhbFxuICAgICAgICAgICAgICAgICAgOiBsb2NhbHN0b3JhZ2UoKTtcblxuLyoqXG4gKiBDb2xvcnMuXG4gKi9cblxuZXhwb3J0cy5jb2xvcnMgPSBbXG4gICdsaWdodHNlYWdyZWVuJyxcbiAgJ2ZvcmVzdGdyZWVuJyxcbiAgJ2dvbGRlbnJvZCcsXG4gICdkb2RnZXJibHVlJyxcbiAgJ2RhcmtvcmNoaWQnLFxuICAnY3JpbXNvbidcbl07XG5cbi8qKlxuICogQ3VycmVudGx5IG9ubHkgV2ViS2l0LWJhc2VkIFdlYiBJbnNwZWN0b3JzLCBGaXJlZm94ID49IHYzMSxcbiAqIGFuZCB0aGUgRmlyZWJ1ZyBleHRlbnNpb24gKGFueSBGaXJlZm94IHZlcnNpb24pIGFyZSBrbm93blxuICogdG8gc3VwcG9ydCBcIiVjXCIgQ1NTIGN1c3RvbWl6YXRpb25zLlxuICpcbiAqIFRPRE86IGFkZCBhIGBsb2NhbFN0b3JhZ2VgIHZhcmlhYmxlIHRvIGV4cGxpY2l0bHkgZW5hYmxlL2Rpc2FibGUgY29sb3JzXG4gKi9cblxuZnVuY3Rpb24gdXNlQ29sb3JzKCkge1xuICAvLyBOQjogSW4gYW4gRWxlY3Ryb24gcHJlbG9hZCBzY3JpcHQsIGRvY3VtZW50IHdpbGwgYmUgZGVmaW5lZCBidXQgbm90IGZ1bGx5XG4gIC8vIGluaXRpYWxpemVkLiBTaW5jZSB3ZSBrbm93IHdlJ3JlIGluIENocm9tZSwgd2UnbGwganVzdCBkZXRlY3QgdGhpcyBjYXNlXG4gIC8vIGV4cGxpY2l0bHlcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGUgPT09ICdyZW5kZXJlcicpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIGlzIHdlYmtpdD8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTY0NTk2MDYvMzc2NzczXG4gIC8vIGRvY3VtZW50IGlzIHVuZGVmaW5lZCBpbiByZWFjdC1uYXRpdmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC1uYXRpdmUvcHVsbC8xNjMyXG4gIHJldHVybiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5XZWJraXRBcHBlYXJhbmNlKSB8fFxuICAgIC8vIGlzIGZpcmVidWc/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM5ODEyMC8zNzY3NzNcbiAgICAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmNvbnNvbGUgJiYgKHdpbmRvdy5jb25zb2xlLmZpcmVidWcgfHwgKHdpbmRvdy5jb25zb2xlLmV4Y2VwdGlvbiAmJiB3aW5kb3cuY29uc29sZS50YWJsZSkpKSB8fFxuICAgIC8vIGlzIGZpcmVmb3ggPj0gdjMxP1xuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvVG9vbHMvV2ViX0NvbnNvbGUjU3R5bGluZ19tZXNzYWdlc1xuICAgICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pICYmIHBhcnNlSW50KFJlZ0V4cC4kMSwgMTApID49IDMxKSB8fFxuICAgIC8vIGRvdWJsZSBjaGVjayB3ZWJraXQgaW4gdXNlckFnZW50IGp1c3QgaW4gY2FzZSB3ZSBhcmUgaW4gYSB3b3JrZXJcbiAgICAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goL2FwcGxld2Via2l0XFwvKFxcZCspLykpO1xufVxuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMuaiA9IGZ1bmN0aW9uKHYpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiAnW1VuZXhwZWN0ZWRKU09OUGFyc2VFcnJvcl06ICcgKyBlcnIubWVzc2FnZTtcbiAgfVxufTtcblxuXG4vKipcbiAqIENvbG9yaXplIGxvZyBhcmd1bWVudHMgaWYgZW5hYmxlZC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFyZ3MoYXJncykge1xuICB2YXIgdXNlQ29sb3JzID0gdGhpcy51c2VDb2xvcnM7XG5cbiAgYXJnc1swXSA9ICh1c2VDb2xvcnMgPyAnJWMnIDogJycpXG4gICAgKyB0aGlzLm5hbWVzcGFjZVxuICAgICsgKHVzZUNvbG9ycyA/ICcgJWMnIDogJyAnKVxuICAgICsgYXJnc1swXVxuICAgICsgKHVzZUNvbG9ycyA/ICclYyAnIDogJyAnKVxuICAgICsgJysnICsgZXhwb3J0cy5odW1hbml6ZSh0aGlzLmRpZmYpO1xuXG4gIGlmICghdXNlQ29sb3JzKSByZXR1cm47XG5cbiAgdmFyIGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuICBhcmdzLnNwbGljZSgxLCAwLCBjLCAnY29sb3I6IGluaGVyaXQnKVxuXG4gIC8vIHRoZSBmaW5hbCBcIiVjXCIgaXMgc29tZXdoYXQgdHJpY2t5LCBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG90aGVyXG4gIC8vIGFyZ3VtZW50cyBwYXNzZWQgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgJWMsIHNvIHdlIG5lZWQgdG9cbiAgLy8gZmlndXJlIG91dCB0aGUgY29ycmVjdCBpbmRleCB0byBpbnNlcnQgdGhlIENTUyBpbnRvXG4gIHZhciBpbmRleCA9IDA7XG4gIHZhciBsYXN0QyA9IDA7XG4gIGFyZ3NbMF0ucmVwbGFjZSgvJVthLXpBLVolXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIGlmICgnJSUnID09PSBtYXRjaCkgcmV0dXJuO1xuICAgIGluZGV4Kys7XG4gICAgaWYgKCclYycgPT09IG1hdGNoKSB7XG4gICAgICAvLyB3ZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIHRoZSAqbGFzdCogJWNcbiAgICAgIC8vICh0aGUgdXNlciBtYXkgaGF2ZSBwcm92aWRlZCB0aGVpciBvd24pXG4gICAgICBsYXN0QyA9IGluZGV4O1xuICAgIH1cbiAgfSk7XG5cbiAgYXJncy5zcGxpY2UobGFzdEMsIDAsIGMpO1xufVxuXG4vKipcbiAqIEludm9rZXMgYGNvbnNvbGUubG9nKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5sb2dgIGlzIG5vdCBhIFwiZnVuY3Rpb25cIi5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGxvZygpIHtcbiAgLy8gdGhpcyBoYWNrZXJ5IGlzIHJlcXVpcmVkIGZvciBJRTgvOSwgd2hlcmVcbiAgLy8gdGhlIGBjb25zb2xlLmxvZ2AgZnVuY3Rpb24gZG9lc24ndCBoYXZlICdhcHBseSdcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgY29uc29sZVxuICAgICYmIGNvbnNvbGUubG9nXG4gICAgJiYgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csIGNvbnNvbGUsIGFyZ3VtZW50cyk7XG59XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNhdmUobmFtZXNwYWNlcykge1xuICB0cnkge1xuICAgIGlmIChudWxsID09IG5hbWVzcGFjZXMpIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBvcnRzLnN0b3JhZ2UuZGVidWcgPSBuYW1lc3BhY2VzO1xuICAgIH1cbiAgfSBjYXRjaChlKSB7fVxufVxuXG4vKipcbiAqIExvYWQgYG5hbWVzcGFjZXNgLlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ30gcmV0dXJucyB0aGUgcHJldmlvdXNseSBwZXJzaXN0ZWQgZGVidWcgbW9kZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvYWQoKSB7XG4gIHZhciByO1xuICB0cnkge1xuICAgIHIgPSBleHBvcnRzLnN0b3JhZ2UuZGVidWc7XG4gIH0gY2F0Y2goZSkge31cblxuICAvLyBJZiBkZWJ1ZyBpc24ndCBzZXQgaW4gTFMsIGFuZCB3ZSdyZSBpbiBFbGVjdHJvbiwgdHJ5IHRvIGxvYWQgJERFQlVHXG4gIGlmICghciAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgJ2VudicgaW4gcHJvY2Vzcykge1xuICAgIHIgPSBwcm9jZXNzLmVudi5ERUJVRztcbiAgfVxuXG4gIHJldHVybiByO1xufVxuXG4vKipcbiAqIEVuYWJsZSBuYW1lc3BhY2VzIGxpc3RlZCBpbiBgbG9jYWxTdG9yYWdlLmRlYnVnYCBpbml0aWFsbHkuXG4gKi9cblxuZXhwb3J0cy5lbmFibGUobG9hZCgpKTtcblxuLyoqXG4gKiBMb2NhbHN0b3JhZ2UgYXR0ZW1wdHMgdG8gcmV0dXJuIHRoZSBsb2NhbHN0b3JhZ2UuXG4gKlxuICogVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBzYWZhcmkgdGhyb3dzXG4gKiB3aGVuIGEgdXNlciBkaXNhYmxlcyBjb29raWVzL2xvY2Fsc3RvcmFnZVxuICogYW5kIHlvdSBhdHRlbXB0IHRvIGFjY2VzcyBpdC5cbiAqXG4gKiBAcmV0dXJuIHtMb2NhbFN0b3JhZ2V9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBsb2NhbHN0b3JhZ2UoKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2U7XG4gIH0gY2F0Y2ggKGUpIHt9XG59XG4iLCJcbi8qKlxuICogVGhpcyBpcyB0aGUgY29tbW9uIGxvZ2ljIGZvciBib3RoIHRoZSBOb2RlLmpzIGFuZCB3ZWIgYnJvd3NlclxuICogaW1wbGVtZW50YXRpb25zIG9mIGBkZWJ1ZygpYC5cbiAqXG4gKiBFeHBvc2UgYGRlYnVnKClgIGFzIHRoZSBtb2R1bGUuXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gY3JlYXRlRGVidWcuZGVidWcgPSBjcmVhdGVEZWJ1Z1snZGVmYXVsdCddID0gY3JlYXRlRGVidWc7XG5leHBvcnRzLmNvZXJjZSA9IGNvZXJjZTtcbmV4cG9ydHMuZGlzYWJsZSA9IGRpc2FibGU7XG5leHBvcnRzLmVuYWJsZSA9IGVuYWJsZTtcbmV4cG9ydHMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5leHBvcnRzLmh1bWFuaXplID0gcmVxdWlyZSgnbXMnKTtcblxuLyoqXG4gKiBUaGUgY3VycmVudGx5IGFjdGl2ZSBkZWJ1ZyBtb2RlIG5hbWVzLCBhbmQgbmFtZXMgdG8gc2tpcC5cbiAqL1xuXG5leHBvcnRzLm5hbWVzID0gW107XG5leHBvcnRzLnNraXBzID0gW107XG5cbi8qKlxuICogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuICpcbiAqIFZhbGlkIGtleSBuYW1lcyBhcmUgYSBzaW5nbGUsIGxvd2VyIG9yIHVwcGVyLWNhc2UgbGV0dGVyLCBpLmUuIFwiblwiIGFuZCBcIk5cIi5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdHRlcnMgPSB7fTtcblxuLyoqXG4gKiBQcmV2aW91cyBsb2cgdGltZXN0YW1wLlxuICovXG5cbnZhciBwcmV2VGltZTtcblxuLyoqXG4gKiBTZWxlY3QgYSBjb2xvci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlbGVjdENvbG9yKG5hbWVzcGFjZSkge1xuICB2YXIgaGFzaCA9IDAsIGk7XG5cbiAgZm9yIChpIGluIG5hbWVzcGFjZSkge1xuICAgIGhhc2ggID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBuYW1lc3BhY2UuY2hhckNvZGVBdChpKTtcbiAgICBoYXNoIHw9IDA7IC8vIENvbnZlcnQgdG8gMzJiaXQgaW50ZWdlclxuICB9XG5cbiAgcmV0dXJuIGV4cG9ydHMuY29sb3JzW01hdGguYWJzKGhhc2gpICUgZXhwb3J0cy5jb2xvcnMubGVuZ3RoXTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkZWJ1Z2dlciB3aXRoIHRoZSBnaXZlbiBgbmFtZXNwYWNlYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlRGVidWcobmFtZXNwYWNlKSB7XG5cbiAgZnVuY3Rpb24gZGVidWcoKSB7XG4gICAgLy8gZGlzYWJsZWQ/XG4gICAgaWYgKCFkZWJ1Zy5lbmFibGVkKSByZXR1cm47XG5cbiAgICB2YXIgc2VsZiA9IGRlYnVnO1xuXG4gICAgLy8gc2V0IGBkaWZmYCB0aW1lc3RhbXBcbiAgICB2YXIgY3VyciA9ICtuZXcgRGF0ZSgpO1xuICAgIHZhciBtcyA9IGN1cnIgLSAocHJldlRpbWUgfHwgY3Vycik7XG4gICAgc2VsZi5kaWZmID0gbXM7XG4gICAgc2VsZi5wcmV2ID0gcHJldlRpbWU7XG4gICAgc2VsZi5jdXJyID0gY3VycjtcbiAgICBwcmV2VGltZSA9IGN1cnI7XG5cbiAgICAvLyB0dXJuIHRoZSBgYXJndW1lbnRzYCBpbnRvIGEgcHJvcGVyIEFycmF5XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cblxuICAgIGFyZ3NbMF0gPSBleHBvcnRzLmNvZXJjZShhcmdzWzBdKTtcblxuICAgIGlmICgnc3RyaW5nJyAhPT0gdHlwZW9mIGFyZ3NbMF0pIHtcbiAgICAgIC8vIGFueXRoaW5nIGVsc2UgbGV0J3MgaW5zcGVjdCB3aXRoICVPXG4gICAgICBhcmdzLnVuc2hpZnQoJyVPJyk7XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgYW55IGBmb3JtYXR0ZXJzYCB0cmFuc2Zvcm1hdGlvbnNcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLCBmdW5jdGlvbihtYXRjaCwgZm9ybWF0KSB7XG4gICAgICAvLyBpZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG4gICAgICBpZiAobWF0Y2ggPT09ICclJScpIHJldHVybiBtYXRjaDtcbiAgICAgIGluZGV4Kys7XG4gICAgICB2YXIgZm9ybWF0dGVyID0gZXhwb3J0cy5mb3JtYXR0ZXJzW2Zvcm1hdF07XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvcm1hdHRlcikge1xuICAgICAgICB2YXIgdmFsID0gYXJnc1tpbmRleF07XG4gICAgICAgIG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuICAgICAgICAvLyBub3cgd2UgbmVlZCB0byByZW1vdmUgYGFyZ3NbaW5kZXhdYCBzaW5jZSBpdCdzIGlubGluZWQgaW4gdGhlIGBmb3JtYXRgXG4gICAgICAgIGFyZ3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcblxuICAgIC8vIGFwcGx5IGVudi1zcGVjaWZpYyBmb3JtYXR0aW5nIChjb2xvcnMsIGV0Yy4pXG4gICAgZXhwb3J0cy5mb3JtYXRBcmdzLmNhbGwoc2VsZiwgYXJncyk7XG5cbiAgICB2YXIgbG9nRm4gPSBkZWJ1Zy5sb2cgfHwgZXhwb3J0cy5sb2cgfHwgY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxuXG4gIGRlYnVnLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcbiAgZGVidWcuZW5hYmxlZCA9IGV4cG9ydHMuZW5hYmxlZChuYW1lc3BhY2UpO1xuICBkZWJ1Zy51c2VDb2xvcnMgPSBleHBvcnRzLnVzZUNvbG9ycygpO1xuICBkZWJ1Zy5jb2xvciA9IHNlbGVjdENvbG9yKG5hbWVzcGFjZSk7XG5cbiAgLy8gZW52LXNwZWNpZmljIGluaXRpYWxpemF0aW9uIGxvZ2ljIGZvciBkZWJ1ZyBpbnN0YW5jZXNcbiAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBleHBvcnRzLmluaXQpIHtcbiAgICBleHBvcnRzLmluaXQoZGVidWcpO1xuICB9XG5cbiAgcmV0dXJuIGRlYnVnO1xufVxuXG4vKipcbiAqIEVuYWJsZXMgYSBkZWJ1ZyBtb2RlIGJ5IG5hbWVzcGFjZXMuIFRoaXMgY2FuIGluY2x1ZGUgbW9kZXNcbiAqIHNlcGFyYXRlZCBieSBhIGNvbG9uIGFuZCB3aWxkY2FyZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcbiAgZXhwb3J0cy5zYXZlKG5hbWVzcGFjZXMpO1xuXG4gIGV4cG9ydHMubmFtZXMgPSBbXTtcbiAgZXhwb3J0cy5za2lwcyA9IFtdO1xuXG4gIHZhciBzcGxpdCA9ICh0eXBlb2YgbmFtZXNwYWNlcyA9PT0gJ3N0cmluZycgPyBuYW1lc3BhY2VzIDogJycpLnNwbGl0KC9bXFxzLF0rLyk7XG4gIHZhciBsZW4gPSBzcGxpdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICghc3BsaXRbaV0pIGNvbnRpbnVlOyAvLyBpZ25vcmUgZW1wdHkgc3RyaW5nc1xuICAgIG5hbWVzcGFjZXMgPSBzcGxpdFtpXS5yZXBsYWNlKC9cXCovZywgJy4qPycpO1xuICAgIGlmIChuYW1lc3BhY2VzWzBdID09PSAnLScpIHtcbiAgICAgIGV4cG9ydHMuc2tpcHMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMuc3Vic3RyKDEpICsgJyQnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMubmFtZXMucHVzaChuZXcgUmVnRXhwKCdeJyArIG5hbWVzcGFjZXMgKyAnJCcpKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gIGV4cG9ydHMuZW5hYmxlKCcnKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIG1vZGUgbmFtZSBpcyBlbmFibGVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGVuYWJsZWQobmFtZSkge1xuICB2YXIgaSwgbGVuO1xuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLnNraXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMuc2tpcHNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBmb3IgKGkgPSAwLCBsZW4gPSBleHBvcnRzLm5hbWVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKGV4cG9ydHMubmFtZXNbaV0udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDb2VyY2UgYHZhbGAuXG4gKlxuICogQHBhcmFtIHtNaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvZXJjZSh2YWwpIHtcbiAgaWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSByZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuICByZXR1cm4gdmFsO1xufVxuIiwiZnVuY3Rpb24gY2FuUmVhZCAoYXV0aCkgeyByZXR1cm4gYXV0aCA9PT0gJ3JlYWQnIHx8IGF1dGggPT09ICd3cml0ZScgfVxuZnVuY3Rpb24gY2FuV3JpdGUgKGF1dGgpIHsgcmV0dXJuIGF1dGggPT09ICd3cml0ZScgfVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChZLyogOmFueSAqLykge1xuICBjbGFzcyBBYnN0cmFjdENvbm5lY3RvciB7XG4gICAgLyogOjpcbiAgICB5OiBZQ29uZmlnO1xuICAgIHJvbGU6IFN5bmNSb2xlO1xuICAgIGNvbm5lY3Rpb25zOiBPYmplY3Q7XG4gICAgaXNTeW5jZWQ6IGJvb2xlYW47XG4gICAgdXNlckV2ZW50TGlzdGVuZXJzOiBBcnJheTxGdW5jdGlvbj47XG4gICAgd2hlblN5bmNlZExpc3RlbmVyczogQXJyYXk8RnVuY3Rpb24+O1xuICAgIGN1cnJlbnRTeW5jVGFyZ2V0OiA/VXNlcklkO1xuICAgIHN5bmNpbmdDbGllbnRzOiBBcnJheTxVc2VySWQ+O1xuICAgIGZvcndhcmRUb1N5bmNpbmdDbGllbnRzOiBib29sZWFuO1xuICAgIGRlYnVnOiBib29sZWFuO1xuICAgIHN5bmNTdGVwMjogUHJvbWlzZTtcbiAgICB1c2VySWQ6IFVzZXJJZDtcbiAgICBzZW5kOiBGdW5jdGlvbjtcbiAgICBicm9hZGNhc3Q6IEZ1bmN0aW9uO1xuICAgIGJyb2FkY2FzdE9wQnVmZmVyOiBBcnJheTxPcGVyYXRpb24+O1xuICAgIHByb3RvY29sVmVyc2lvbjogbnVtYmVyO1xuICAgICovXG4gICAgLypcbiAgICAgIG9wdHMgY29udGFpbnMgdGhlIGZvbGxvd2luZyBpbmZvcm1hdGlvbjpcbiAgICAgICByb2xlIDogU3RyaW5nIFJvbGUgb2YgdGhpcyBjbGllbnQgKFwibWFzdGVyXCIgb3IgXCJzbGF2ZVwiKVxuICAgICAgIHVzZXJJZCA6IFN0cmluZyBVbmlxdWVseSBkZWZpbmVzIHRoZSB1c2VyLlxuICAgICAgIGRlYnVnOiBCb29sZWFuIFdoZXRoZXIgdG8gcHJpbnQgZGVidWcgbWVzc2FnZXMgKG9wdGlvbmFsKVxuICAgICovXG4gICAgY29uc3RydWN0b3IgKHksIG9wdHMpIHtcbiAgICAgIHRoaXMueSA9IHlcbiAgICAgIGlmIChvcHRzID09IG51bGwpIHtcbiAgICAgICAgb3B0cyA9IHt9XG4gICAgICB9XG4gICAgICAvLyBQcmVmZXIgdG8gcmVjZWl2ZSB1bnRyYW5zZm9ybWVkIG9wZXJhdGlvbnMuIFRoaXMgZG9lcyBvbmx5IHdvcmsgaWZcbiAgICAgIC8vIHRoaXMgY2xpZW50IHJlY2VpdmVzIG9wZXJhdGlvbnMgZnJvbSBvbmx5IG9uZSBvdGhlciBjbGllbnQuXG4gICAgICAvLyBJbiBwYXJ0aWN1bGFyLCB0aGlzIGRvZXMgbm90IHdvcmsgd2l0aCB5LXdlYnJ0Yy5cbiAgICAgIC8vIEl0IHdpbGwgd29yayB3aXRoIHktd2Vic29ja2V0cy1jbGllbnRcbiAgICAgIGlmIChvcHRzLnJvbGUgPT0gbnVsbCB8fCBvcHRzLnJvbGUgPT09ICdtYXN0ZXInKSB7XG4gICAgICAgIHRoaXMucm9sZSA9ICdtYXN0ZXInXG4gICAgICB9IGVsc2UgaWYgKG9wdHMucm9sZSA9PT0gJ3NsYXZlJykge1xuICAgICAgICB0aGlzLnJvbGUgPSAnc2xhdmUnXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSb2xlIG11c3QgYmUgZWl0aGVyICdtYXN0ZXInIG9yICdzbGF2ZSchXCIpXG4gICAgICB9XG4gICAgICB0aGlzLmxvZyA9IFkuZGVidWcoJ3k6Y29ubmVjdG9yJylcbiAgICAgIHRoaXMubG9nTWVzc2FnZSA9IFkuZGVidWcoJ3k6Y29ubmVjdG9yLW1lc3NhZ2UnKVxuICAgICAgdGhpcy55LmRiLmZvcndhcmRBcHBsaWVkT3BlcmF0aW9ucyA9IG9wdHMuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zIHx8IGZhbHNlXG4gICAgICB0aGlzLnJvbGUgPSBvcHRzLnJvbGVcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fVxuICAgICAgdGhpcy5pc1N5bmNlZCA9IGZhbHNlXG4gICAgICB0aGlzLnVzZXJFdmVudExpc3RlbmVycyA9IFtdXG4gICAgICB0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMgPSBbXVxuICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IG51bGxcbiAgICAgIHRoaXMuc3luY2luZ0NsaWVudHMgPSBbXVxuICAgICAgdGhpcy5mb3J3YXJkVG9TeW5jaW5nQ2xpZW50cyA9IG9wdHMuZm9yd2FyZFRvU3luY2luZ0NsaWVudHMgIT09IGZhbHNlXG4gICAgICB0aGlzLmRlYnVnID0gb3B0cy5kZWJ1ZyA9PT0gdHJ1ZVxuICAgICAgdGhpcy5zeW5jU3RlcDIgPSBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgdGhpcy5icm9hZGNhc3RPcEJ1ZmZlciA9IFtdXG4gICAgICB0aGlzLnByb3RvY29sVmVyc2lvbiA9IDExXG4gICAgICB0aGlzLmF1dGhJbmZvID0gb3B0cy5hdXRoIHx8IG51bGxcbiAgICAgIHRoaXMuY2hlY2tBdXRoID0gb3B0cy5jaGVja0F1dGggfHwgZnVuY3Rpb24gKCkgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCd3cml0ZScpIH0gLy8gZGVmYXVsdCBpcyBldmVyeW9uZSBoYXMgd3JpdGUgYWNjZXNzXG4gICAgICBpZiAob3B0cy5nZW5lcmF0ZVVzZXJJZCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLnNldFVzZXJJZChZLnV0aWxzLmdlbmVyYXRlR3VpZCgpKVxuICAgICAgfVxuICAgIH1cbiAgICByZXNldEF1dGggKGF1dGgpIHtcbiAgICAgIGlmICh0aGlzLmF1dGhJbmZvICE9PSBhdXRoKSB7XG4gICAgICAgIHRoaXMuYXV0aEluZm8gPSBhdXRoXG4gICAgICAgIHRoaXMuYnJvYWRjYXN0KHtcbiAgICAgICAgICB0eXBlOiAnYXV0aCcsXG4gICAgICAgICAgYXV0aDogdGhpcy5hdXRoSW5mb1xuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgICByZWNvbm5lY3QgKCkge1xuICAgICAgdGhpcy5sb2coJ3JlY29ubmVjdGluZy4uJylcbiAgICAgIHJldHVybiB0aGlzLnkuZGIuc3RhcnRHYXJiYWdlQ29sbGVjdG9yKClcbiAgICB9XG4gICAgZGlzY29ubmVjdCAoKSB7XG4gICAgICB0aGlzLmxvZygnZGlzY3Jvbm5lY3RpbmcuLicpXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zID0ge31cbiAgICAgIHRoaXMuaXNTeW5jZWQgPSBmYWxzZVxuICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IG51bGxcbiAgICAgIHRoaXMuc3luY2luZ0NsaWVudHMgPSBbXVxuICAgICAgdGhpcy53aGVuU3luY2VkTGlzdGVuZXJzID0gW11cbiAgICAgIHRoaXMueS5kYi5zdG9wR2FyYmFnZUNvbGxlY3RvcigpXG4gICAgICByZXR1cm4gdGhpcy55LmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpXG4gICAgfVxuICAgIHJlcGFpciAoKSB7XG4gICAgICB0aGlzLmxvZygnUmVwYWlyaW5nIHRoZSBzdGF0ZSBvZiBZanMuIFRoaXMgY2FuIGhhcHBlbiBpZiBtZXNzYWdlcyBnZXQgbG9zdCwgYW5kIFlqcyBkZXRlY3RzIHRoYXQgc29tZXRoaW5nIGlzIHdyb25nLiBJZiB0aGlzIGhhcHBlbnMgb2Z0ZW4sIHBsZWFzZSByZXBvcnQgYW4gaXNzdWUgaGVyZTogaHR0cHM6Ly9naXRodWIuY29tL3ktanMveWpzL2lzc3VlcycpXG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuY29ubmVjdGlvbnMpIHtcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tuYW1lXS5pc1N5bmNlZCA9IGZhbHNlXG4gICAgICB9XG4gICAgICB0aGlzLmlzU3luY2VkID0gZmFsc2VcbiAgICAgIHRoaXMuY3VycmVudFN5bmNUYXJnZXQgPSBudWxsXG4gICAgICB0aGlzLmZpbmROZXh0U3luY1RhcmdldCgpXG4gICAgfVxuICAgIHNldFVzZXJJZCAodXNlcklkKSB7XG4gICAgICBpZiAodGhpcy51c2VySWQgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmxvZygnU2V0IHVzZXJJZCB0byBcIiVzXCInLCB1c2VySWQpXG4gICAgICAgIHRoaXMudXNlcklkID0gdXNlcklkXG4gICAgICAgIHJldHVybiB0aGlzLnkuZGIuc2V0VXNlcklkKHVzZXJJZClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgfVxuICAgIG9uVXNlckV2ZW50IChmKSB7XG4gICAgICB0aGlzLnVzZXJFdmVudExpc3RlbmVycy5wdXNoKGYpXG4gICAgfVxuICAgIHJlbW92ZVVzZXJFdmVudExpc3RlbmVyIChmKSB7XG4gICAgICB0aGlzLnVzZXJFdmVudExpc3RlbmVycyA9IHRoaXMudXNlckV2ZW50TGlzdGVuZXJzLmZpbHRlcihnID0+IHsgZiAhPT0gZyB9KVxuICAgIH1cbiAgICB1c2VyTGVmdCAodXNlcikge1xuICAgICAgaWYgKHRoaXMuY29ubmVjdGlvbnNbdXNlcl0gIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmxvZygnVXNlciBsZWZ0OiAlcycsIHVzZXIpXG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25zW3VzZXJdXG4gICAgICAgIGlmICh1c2VyID09PSB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0KSB7XG4gICAgICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IG51bGxcbiAgICAgICAgICB0aGlzLmZpbmROZXh0U3luY1RhcmdldCgpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zeW5jaW5nQ2xpZW50cyA9IHRoaXMuc3luY2luZ0NsaWVudHMuZmlsdGVyKGZ1bmN0aW9uIChjbGkpIHtcbiAgICAgICAgICByZXR1cm4gY2xpICE9PSB1c2VyXG4gICAgICAgIH0pXG4gICAgICAgIGZvciAodmFyIGYgb2YgdGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMpIHtcbiAgICAgICAgICBmKHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3VzZXJMZWZ0JyxcbiAgICAgICAgICAgIHVzZXI6IHVzZXJcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHVzZXJKb2luZWQgKHVzZXIsIHJvbGUpIHtcbiAgICAgIGlmIChyb2xlID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEnKVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuY29ubmVjdGlvbnNbdXNlcl0gIT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgdXNlciBhbHJlYWR5IGpvaW5lZCEnKVxuICAgICAgfVxuICAgICAgdGhpcy5sb2coJ1VzZXIgam9pbmVkOiAlcycsIHVzZXIpXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3VzZXJdID0ge1xuICAgICAgICBpc1N5bmNlZDogZmFsc2UsXG4gICAgICAgIHJvbGU6IHJvbGVcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGYgb2YgdGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMpIHtcbiAgICAgICAgZih7XG4gICAgICAgICAgYWN0aW9uOiAndXNlckpvaW5lZCcsXG4gICAgICAgICAgdXNlcjogdXNlcixcbiAgICAgICAgICByb2xlOiByb2xlXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jdXJyZW50U3luY1RhcmdldCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuZmluZE5leHRTeW5jVGFyZ2V0KClcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLlxuICAgIC8vIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkXG4gICAgd2hlblN5bmNlZCAoZikge1xuICAgICAgaWYgKHRoaXMuaXNTeW5jZWQpIHtcbiAgICAgICAgZigpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMucHVzaChmKVxuICAgICAgfVxuICAgIH1cbiAgICBmaW5kTmV4dFN5bmNUYXJnZXQgKCkge1xuICAgICAgaWYgKHRoaXMuY3VycmVudFN5bmNUYXJnZXQgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gLy8gXCJUaGUgY3VycmVudCBzeW5jIGhhcyBub3QgZmluaXNoZWQhXCJcbiAgICAgIH1cblxuICAgICAgdmFyIHN5bmNVc2VyID0gbnVsbFxuICAgICAgZm9yICh2YXIgdWlkIGluIHRoaXMuY29ubmVjdGlvbnMpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbm5lY3Rpb25zW3VpZF0uaXNTeW5jZWQpIHtcbiAgICAgICAgICBzeW5jVXNlciA9IHVpZFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhciBjb25uID0gdGhpc1xuICAgICAgaWYgKHN5bmNVc2VyICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IHN5bmNVc2VyXG4gICAgICAgIHRoaXMueS5kYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgICB2YXIgc3RhdGVTZXQgPSB5aWVsZCogdGhpcy5nZXRTdGF0ZVNldCgpXG4gICAgICAgICAgdmFyIGRlbGV0ZVNldCA9IHlpZWxkKiB0aGlzLmdldERlbGV0ZVNldCgpXG4gICAgICAgICAgdmFyIGFuc3dlciA9IHtcbiAgICAgICAgICAgIHR5cGU6ICdzeW5jIHN0ZXAgMScsXG4gICAgICAgICAgICBzdGF0ZVNldDogc3RhdGVTZXQsXG4gICAgICAgICAgICBkZWxldGVTZXQ6IGRlbGV0ZVNldCxcbiAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogY29ubi5wcm90b2NvbFZlcnNpb24sXG4gICAgICAgICAgICBhdXRoOiBjb25uLmF1dGhJbmZvXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbm4uc2VuZChzeW5jVXNlciwgYW5zd2VyKVxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFjb25uLmlzU3luY2VkKSB7XG4gICAgICAgICAgdGhpcy55LmRiLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqKCkge1xuICAgICAgICAgICAgaWYgKCFjb25uLmlzU3luY2VkKSB7XG4gICAgICAgICAgICAgIC8vIGl0IGlzIGNydWNpYWwgdGhhdCBpc1N5bmNlZCBpcyBzZXQgYXQgdGhlIHRpbWUgZ2FyYmFnZUNvbGxlY3RBZnRlclN5bmMgaXMgY2FsbGVkXG4gICAgICAgICAgICAgIGNvbm4uaXNTeW5jZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmdhcmJhZ2VDb2xsZWN0QWZ0ZXJTeW5jKClcbiAgICAgICAgICAgICAgLy8gY2FsbCB3aGVuc3luY2VkIGxpc3RlbmVyc1xuICAgICAgICAgICAgICBmb3IgKHZhciBmIG9mIGNvbm4ud2hlblN5bmNlZExpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIGYoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbm4ud2hlblN5bmNlZExpc3RlbmVycyA9IFtdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzZW5kICh1aWQsIG1lc3NhZ2UpIHtcbiAgICAgIHRoaXMubG9nKCdTZW5kIFxcJyVzXFwnIHRvICVzJywgbWVzc2FnZS50eXBlLCB1aWQpXG4gICAgICB0aGlzLmxvZ01lc3NhZ2UoJ01lc3NhZ2U6ICVqJywgbWVzc2FnZSlcbiAgICB9XG4gICAgYnJvYWRjYXN0IChtZXNzYWdlKSB7XG4gICAgICB0aGlzLmxvZygnQnJvYWRjYXN0IFxcJyVzXFwnJywgbWVzc2FnZS50eXBlKVxuICAgICAgdGhpcy5sb2dNZXNzYWdlKCdNZXNzYWdlOiAlaicsIG1lc3NhZ2UpXG4gICAgfVxuICAgIC8qXG4gICAgICBCdWZmZXIgb3BlcmF0aW9ucywgYW5kIGJyb2FkY2FzdCB0aGVtIHdoZW4gcmVhZHkuXG4gICAgKi9cbiAgICBicm9hZGNhc3RPcHMgKG9wcykge1xuICAgICAgb3BzID0gb3BzLm1hcChmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgcmV0dXJuIFkuU3RydWN0W29wLnN0cnVjdF0uZW5jb2RlKG9wKVxuICAgICAgfSlcbiAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgZnVuY3Rpb24gYnJvYWRjYXN0T3BlcmF0aW9ucyAoKSB7XG4gICAgICAgIGlmIChzZWxmLmJyb2FkY2FzdE9wQnVmZmVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBzZWxmLmJyb2FkY2FzdCh7XG4gICAgICAgICAgICB0eXBlOiAndXBkYXRlJyxcbiAgICAgICAgICAgIG9wczogc2VsZi5icm9hZGNhc3RPcEJ1ZmZlclxuICAgICAgICAgIH0pXG4gICAgICAgICAgc2VsZi5icm9hZGNhc3RPcEJ1ZmZlciA9IFtdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmJyb2FkY2FzdE9wQnVmZmVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLmJyb2FkY2FzdE9wQnVmZmVyID0gb3BzXG4gICAgICAgIGlmICh0aGlzLnkuZGIudHJhbnNhY3Rpb25JblByb2dyZXNzKSB7XG4gICAgICAgICAgdGhpcy55LmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpLnRoZW4oYnJvYWRjYXN0T3BlcmF0aW9ucylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZXRUaW1lb3V0KGJyb2FkY2FzdE9wZXJhdGlvbnMsIDApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYnJvYWRjYXN0T3BCdWZmZXIgPSB0aGlzLmJyb2FkY2FzdE9wQnVmZmVyLmNvbmNhdChvcHMpXG4gICAgICB9XG4gICAgfVxuICAgIC8qXG4gICAgICBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICAgKi9cbiAgICByZWNlaXZlTWVzc2FnZSAoc2VuZGVyLyogOlVzZXJJZCAqLywgbWVzc2FnZS8qIDpNZXNzYWdlICovKSB7XG4gICAgICBpZiAoc2VuZGVyID09PSB0aGlzLnVzZXJJZCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nKCdSZWNlaXZlIFxcJyVzXFwnIGZyb20gJXMnLCBtZXNzYWdlLnR5cGUsIHNlbmRlcilcbiAgICAgIHRoaXMubG9nTWVzc2FnZSgnTWVzc2FnZTogJWonLCBtZXNzYWdlKVxuICAgICAgaWYgKG1lc3NhZ2UucHJvdG9jb2xWZXJzaW9uICE9IG51bGwgJiYgbWVzc2FnZS5wcm90b2NvbFZlcnNpb24gIT09IHRoaXMucHJvdG9jb2xWZXJzaW9uKSB7XG4gICAgICAgIHRoaXMubG9nKFxuICAgICAgICAgIGBZb3UgdHJpZWQgdG8gc3luYyB3aXRoIGEgeWpzIGluc3RhbmNlIHRoYXQgaGFzIGEgZGlmZmVyZW50IHByb3RvY29sIHZlcnNpb25cbiAgICAgICAgICAoWW91OiAke3RoaXMucHJvdG9jb2xWZXJzaW9ufSwgQ2xpZW50OiAke21lc3NhZ2UucHJvdG9jb2xWZXJzaW9ufSkuXG4gICAgICAgICAgVGhlIHN5bmMgd2FzIHN0b3BwZWQuIFlvdSBuZWVkIHRvIHVwZ3JhZGUgeW91ciBkZXBlbmRlbmNpZXMgKGVzcGVjaWFsbHkgWWpzICYgdGhlIENvbm5lY3RvcikhXG4gICAgICAgICAgYClcbiAgICAgICAgdGhpcy5zZW5kKHNlbmRlciwge1xuICAgICAgICAgIHR5cGU6ICdzeW5jIHN0b3AnLFxuICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogdGhpcy5wcm90b2NvbFZlcnNpb25cbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCdJbmNvbXBhdGlibGUgcHJvdG9jb2wgdmVyc2lvbicpXG4gICAgICB9XG4gICAgICBpZiAobWVzc2FnZS5hdXRoICE9IG51bGwgJiYgdGhpcy5jb25uZWN0aW9uc1tzZW5kZXJdICE9IG51bGwpIHtcbiAgICAgICAgLy8gYXV0aGVudGljYXRlIHVzaW5nIGF1dGggaW4gbWVzc2FnZVxuICAgICAgICB2YXIgYXV0aCA9IHRoaXMuY2hlY2tBdXRoKG1lc3NhZ2UuYXV0aCwgdGhpcy55LCBzZW5kZXIpXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbc2VuZGVyXS5hdXRoID0gYXV0aFxuICAgICAgICBhdXRoLnRoZW4oYXV0aCA9PiB7XG4gICAgICAgICAgZm9yICh2YXIgZiBvZiB0aGlzLnVzZXJFdmVudExpc3RlbmVycykge1xuICAgICAgICAgICAgZih7XG4gICAgICAgICAgICAgIGFjdGlvbjogJ3VzZXJBdXRoZW50aWNhdGVkJyxcbiAgICAgICAgICAgICAgdXNlcjogc2VuZGVyLFxuICAgICAgICAgICAgICBhdXRoOiBhdXRoXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jb25uZWN0aW9uc1tzZW5kZXJdICE9IG51bGwgJiYgdGhpcy5jb25uZWN0aW9uc1tzZW5kZXJdLmF1dGggPT0gbnVsbCkge1xuICAgICAgICAvLyBhdXRoZW50aWNhdGUgd2l0aG91dCBvdGhlcndpc2VcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tzZW5kZXJdLmF1dGggPSB0aGlzLmNoZWNrQXV0aChudWxsLCB0aGlzLnksIHNlbmRlcilcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0gIT0gbnVsbCAmJiB0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0uYXV0aCAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0uYXV0aC50aGVuKChhdXRoKSA9PiB7XG4gICAgICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3N5bmMgc3RlcCAxJyAmJiBjYW5SZWFkKGF1dGgpKSB7XG4gICAgICAgICAgICBsZXQgY29ubiA9IHRoaXNcbiAgICAgICAgICAgIGxldCBtID0gbWVzc2FnZVxuXG4gICAgICAgICAgICB0aGlzLnkuZGIucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICooKSB7XG4gICAgICAgICAgICAgIHZhciBjdXJyZW50U3RhdGVTZXQgPSB5aWVsZCogdGhpcy5nZXRTdGF0ZVNldCgpXG4gICAgICAgICAgICAgIGlmIChjYW5Xcml0ZShhdXRoKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmFwcGx5RGVsZXRlU2V0KG0uZGVsZXRlU2V0KVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdmFyIGRzID0geWllbGQqIHRoaXMuZ2V0RGVsZXRlU2V0KClcbiAgICAgICAgICAgICAgdmFyIGFuc3dlciA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3luYyBzdGVwIDInLFxuICAgICAgICAgICAgICAgIHN0YXRlU2V0OiBjdXJyZW50U3RhdGVTZXQsXG4gICAgICAgICAgICAgICAgZGVsZXRlU2V0OiBkcyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbFZlcnNpb246IHRoaXMucHJvdG9jb2xWZXJzaW9uLFxuICAgICAgICAgICAgICAgIGF1dGg6IHRoaXMuYXV0aEluZm9cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhbnN3ZXIub3MgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb25zKG0uc3RhdGVTZXQpXG4gICAgICAgICAgICAgIGNvbm4uc2VuZChzZW5kZXIsIGFuc3dlcilcbiAgICAgICAgICAgICAgaWYgKHRoaXMuZm9yd2FyZFRvU3luY2luZ0NsaWVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25uLnN5bmNpbmdDbGllbnRzLnB1c2goc2VuZGVyKVxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgY29ubi5zeW5jaW5nQ2xpZW50cyA9IGNvbm4uc3luY2luZ0NsaWVudHMuZmlsdGVyKGZ1bmN0aW9uIChjbGkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsaSAhPT0gc2VuZGVyXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgY29ubi5zZW5kKHNlbmRlciwge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3luYyBkb25lJ1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9LCA1MDAwKSAvLyBUT0RPOiBjb25uLnN5bmNpbmdDbGllbnREdXJhdGlvbilcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25uLnNlbmQoc2VuZGVyLCB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3luYyBkb25lJ1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnR5cGUgPT09ICdzeW5jIHN0ZXAgMicgJiYgY2FuV3JpdGUoYXV0aCkpIHtcbiAgICAgICAgICAgIHZhciBkYiA9IHRoaXMueS5kYlxuICAgICAgICAgICAgdmFyIGRlZmVyID0ge31cbiAgICAgICAgICAgIGRlZmVyLnByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlID0gcmVzb2x2ZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHRoaXMuc3luY1N0ZXAyID0gZGVmZXIucHJvbWlzZVxuICAgICAgICAgICAgbGV0IG0gLyogOk1lc3NhZ2VTeW5jU3RlcDIgKi8gPSBtZXNzYWdlXG4gICAgICAgICAgICBkYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmFwcGx5RGVsZXRlU2V0KG0uZGVsZXRlU2V0KVxuICAgICAgICAgICAgICBpZiAobS5vc1VudHJhbnNmb3JtZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmFwcGx5T3BlcmF0aW9uc1VudHJhbnNmb3JtZWQobS5vc1VudHJhbnNmb3JtZWQsIG0uc3RhdGVTZXQpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdG9yZS5hcHBseShtLm9zKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAqIFRoaXMganVzdCBzZW5kcyB0aGUgY29tcGxldGUgaGIgYWZ0ZXIgc29tZSB0aW1lXG4gICAgICAgICAgICAgICAqIE1vc3RseSBmb3IgZGVidWdnaW5nLi5cbiAgICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAgZGIucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogKCkge1xuICAgICAgICAgICAgICAgIHZhciBvcHMgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb25zKG0uc3RhdGVTZXQpXG4gICAgICAgICAgICAgICAgaWYgKG9wcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoIWJyb2FkY2FzdEhCKSB7IC8vIFRPRE86IGNvbnNpZGVyIHRvIGJyb2FkY2FzdCBoZXJlLi5cbiAgICAgICAgICAgICAgICAgICAgY29ubi5zZW5kKHNlbmRlciwge1xuICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICAgICAgICAgICAgICAgIG9wczogb3BzXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBicm9hZGNhc3Qgb25seSBvbmNlIVxuICAgICAgICAgICAgICAgICAgICBjb25uLmJyb2FkY2FzdE9wcyhvcHMpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICBkZWZlci5yZXNvbHZlKClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnR5cGUgPT09ICdzeW5jIGRvbmUnKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgICAgICAgIHRoaXMuc3luY1N0ZXAyLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBzZWxmLl9zZXRTeW5jZWRXaXRoKHNlbmRlcilcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnR5cGUgPT09ICd1cGRhdGUnICYmIGNhbldyaXRlKGF1dGgpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5mb3J3YXJkVG9TeW5jaW5nQ2xpZW50cykge1xuICAgICAgICAgICAgICBmb3IgKHZhciBjbGllbnQgb2YgdGhpcy5zeW5jaW5nQ2xpZW50cykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZChjbGllbnQsIG1lc3NhZ2UpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnkuZGIuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zKSB7XG4gICAgICAgICAgICAgIHZhciBkZWxvcHMgPSBtZXNzYWdlLm9wcy5maWx0ZXIoZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gby5zdHJ1Y3QgPT09ICdEZWxldGUnXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIGlmIChkZWxvcHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYnJvYWRjYXN0T3BzKGRlbG9wcylcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy55LmRiLmFwcGx5KG1lc3NhZ2Uub3BzKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgnVW5hYmxlIHRvIGRlbGl2ZXIgbWVzc2FnZScpXG4gICAgICB9XG4gICAgfVxuICAgIF9zZXRTeW5jZWRXaXRoICh1c2VyKSB7XG4gICAgICB2YXIgY29ubiA9IHRoaXMuY29ubmVjdGlvbnNbdXNlcl1cbiAgICAgIGlmIChjb25uICE9IG51bGwpIHtcbiAgICAgICAgY29ubi5pc1N5bmNlZCA9IHRydWVcbiAgICAgIH1cbiAgICAgIGlmICh1c2VyID09PSB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0KSB7XG4gICAgICAgIHRoaXMuY3VycmVudFN5bmNUYXJnZXQgPSBudWxsXG4gICAgICAgIHRoaXMuZmluZE5leHRTeW5jVGFyZ2V0KClcbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAgICAgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcbiAgICAgIHRvbyBtdWNoIG92ZXJoZWFkLiBZIGlzIHZlcnkgbGlrZWx5IHRvIGdldCBjaGFuZ2VkIGEgbG90IGluIHRoZSBmdXR1cmVcblxuICAgICAgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgICAgIHdlIGVuY29kZSB0aGUgSlNPTiBhcyBYTUwuXG5cbiAgICAgIFdoZW4gdGhlIEhCIHN1cHBvcnQgZW5jb2RpbmcgYXMgWE1MLCB0aGUgZm9ybWF0IHNob3VsZCBsb29rIHByZXR0eSBtdWNoIGxpa2UgdGhpcy5cblxuICAgICAgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICAgICBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XG4gICAgKi9cbiAgICBwYXJzZU1lc3NhZ2VGcm9tWG1sIChtLyogOmFueSAqLykge1xuICAgICAgZnVuY3Rpb24gcGFyc2VBcnJheSAobm9kZSkge1xuICAgICAgICBmb3IgKHZhciBuIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICBpZiAobi5nZXRBdHRyaWJ1dGUoJ2lzQXJyYXknKSA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VBcnJheShuKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VPYmplY3QobilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIHBhcnNlT2JqZWN0IChub2RlLyogOmFueSAqLykge1xuICAgICAgICB2YXIganNvbiA9IHt9XG4gICAgICAgIGZvciAodmFyIGF0dHJOYW1lIGluIG5vZGUuYXR0cnMpIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBub2RlLmF0dHJzW2F0dHJOYW1lXVxuICAgICAgICAgIHZhciBpbnQgPSBwYXJzZUludCh2YWx1ZSwgMTApXG4gICAgICAgICAgaWYgKGlzTmFOKGludCkgfHwgKCcnICsgaW50KSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGpzb25bYXR0ck5hbWVdID0gdmFsdWVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAganNvblthdHRyTmFtZV0gPSBpbnRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgbi8qIDphbnkgKi8gaW4gbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgIHZhciBuYW1lID0gbi5uYW1lXG4gICAgICAgICAgaWYgKG4uZ2V0QXR0cmlidXRlKCdpc0FycmF5JykgPT09ICd0cnVlJykge1xuICAgICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlQXJyYXkobilcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlT2JqZWN0KG4pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBqc29uXG4gICAgICB9XG4gICAgICBwYXJzZU9iamVjdChtKVxuICAgIH1cbiAgICAvKlxuICAgICAgZW5jb2RlIG1lc3NhZ2UgaW4geG1sXG4gICAgICB3ZSB1c2Ugc3RyaW5nIGJlY2F1c2UgU3Ryb3BoZSBvbmx5IGFjY2VwdHMgYW4gXCJ4bWwtc3RyaW5nXCIuLlxuICAgICAgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAgICAgPHkgYT1cIjRcIj5cbiAgICAgICAgPGIgYz1cIjVcIj48L2I+XG4gICAgICA8L3k+XG4gICAgICBtIC0gbHR4IGVsZW1lbnRcbiAgICAgIGpzb24gLSBPYmplY3RcbiAgICAqL1xuICAgIGVuY29kZU1lc3NhZ2VUb1htbCAobXNnLCBvYmopIHtcbiAgICAgIC8vIGF0dHJpYnV0ZXMgaXMgb3B0aW9uYWxcbiAgICAgIGZ1bmN0aW9uIGVuY29kZU9iamVjdCAobSwganNvbikge1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIGpzb24pIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBqc29uW25hbWVdXG4gICAgICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gbm9wXG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICBlbmNvZGVPYmplY3QobS5jKG5hbWUpLCB2YWx1ZSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yID09PSBBcnJheSkge1xuICAgICAgICAgICAgZW5jb2RlQXJyYXkobS5jKG5hbWUpLCB2YWx1ZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBlbmNvZGVBcnJheSAobSwgYXJyYXkpIHtcbiAgICAgICAgbS5zZXRBdHRyaWJ1dGUoJ2lzQXJyYXknLCAndHJ1ZScpXG4gICAgICAgIGZvciAodmFyIGUgb2YgYXJyYXkpIHtcbiAgICAgICAgICBpZiAoZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICBlbmNvZGVPYmplY3QobS5jKCdhcnJheS1lbGVtZW50JyksIGUpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVuY29kZUFycmF5KG0uYygnYXJyYXktZWxlbWVudCcpLCBlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG9iai5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgIGVuY29kZU9iamVjdChtc2cuYygneScsIHsgeG1sbnM6ICdodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphJyB9KSwgb2JqKVxuICAgICAgfSBlbHNlIGlmIChvYmouY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgIGVuY29kZUFycmF5KG1zZy5jKCd5JywgeyB4bWxuczogJ2h0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemEnIH0pLCBvYmopXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCIpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIFkuQWJzdHJhY3RDb25uZWN0b3IgPSBBYnN0cmFjdENvbm5lY3RvclxufVxuIiwiLyogZ2xvYmFsIGdldFJhbmRvbSwgYXN5bmMgKi9cbid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChZKSB7XG4gIHZhciBnbG9iYWxSb29tID0ge1xuICAgIHVzZXJzOiB7fSxcbiAgICBidWZmZXJzOiB7fSxcbiAgICByZW1vdmVVc2VyOiBmdW5jdGlvbiAodXNlcikge1xuICAgICAgZm9yICh2YXIgaSBpbiB0aGlzLnVzZXJzKSB7XG4gICAgICAgIHRoaXMudXNlcnNbaV0udXNlckxlZnQodXNlcilcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLnVzZXJzW3VzZXJdXG4gICAgICBkZWxldGUgdGhpcy5idWZmZXJzW3VzZXJdXG4gICAgfSxcbiAgICBhZGRVc2VyOiBmdW5jdGlvbiAoY29ubmVjdG9yKSB7XG4gICAgICB0aGlzLnVzZXJzW2Nvbm5lY3Rvci51c2VySWRdID0gY29ubmVjdG9yXG4gICAgICB0aGlzLmJ1ZmZlcnNbY29ubmVjdG9yLnVzZXJJZF0gPSB7fVxuICAgICAgZm9yICh2YXIgdW5hbWUgaW4gdGhpcy51c2Vycykge1xuICAgICAgICBpZiAodW5hbWUgIT09IGNvbm5lY3Rvci51c2VySWQpIHtcbiAgICAgICAgICB2YXIgdSA9IHRoaXMudXNlcnNbdW5hbWVdXG4gICAgICAgICAgdS51c2VySm9pbmVkKGNvbm5lY3Rvci51c2VySWQsICdtYXN0ZXInKVxuICAgICAgICAgIGNvbm5lY3Rvci51c2VySm9pbmVkKHUudXNlcklkLCAnbWFzdGVyJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgd2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIC8vIFRoZSBjb25uZWN0b3IgZmlyc3QgaGFzIHRvIHNlbmQgdGhlIG1lc3NhZ2VzIHRvIHRoZSBkYi5cbiAgICAgICAgLy8gV2FpdCBmb3IgdGhlIGNoZWNrQXV0aC1mdW5jdGlvbiB0byByZXNvbHZlXG4gICAgICAgIC8vIFRoZSB0ZXN0IGxpYiBvbmx5IGhhcyBhIHNpbXBsZSBjaGVja0F1dGggZnVuY3Rpb246IGAoKSA9PiBQcm9taXNlLnJlc29sdmUoKWBcbiAgICAgICAgLy8gSnVzdCBhZGQgYSBmdW5jdGlvbiB0byB0aGUgZXZlbnQtcXVldWUsIGluIG9yZGVyIHRvIHdhaXQgZm9yIHRoZSBldmVudC5cbiAgICAgICAgLy8gVE9ETzogdGhpcyBtYXkgYmUgYnVnZ3kgaW4gdGVzdCBhcHBsaWNhdGlvbnMgKGJ1dCBpdCBpc24ndCBiZSBmb3IgcmVhbC1saWZlIGFwcHMpXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBwcyA9IFtdXG4gICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzZWxmLnVzZXJzKSB7XG4gICAgICAgICAgICBwcy5wdXNoKHNlbGYudXNlcnNbbmFtZV0ueS5kYi53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgUHJvbWlzZS5hbGwocHMpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuICAgICAgICB9LCAxMClcbiAgICAgIH0pXG4gICAgfSxcbiAgICBmbHVzaE9uZTogZnVuY3Rpb24gZmx1c2hPbmUgKCkge1xuICAgICAgdmFyIGJ1ZnMgPSBbXVxuICAgICAgZm9yICh2YXIgcmVjZWl2ZXIgaW4gZ2xvYmFsUm9vbS5idWZmZXJzKSB7XG4gICAgICAgIGxldCBidWZmID0gZ2xvYmFsUm9vbS5idWZmZXJzW3JlY2VpdmVyXVxuICAgICAgICB2YXIgcHVzaCA9IGZhbHNlXG4gICAgICAgIGZvciAobGV0IHNlbmRlciBpbiBidWZmKSB7XG4gICAgICAgICAgaWYgKGJ1ZmZbc2VuZGVyXS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBwdXNoID0gdHJ1ZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHB1c2gpIHtcbiAgICAgICAgICBidWZzLnB1c2gocmVjZWl2ZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChidWZzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIHVzZXJJZCA9IGdldFJhbmRvbShidWZzKVxuICAgICAgICBsZXQgYnVmZiA9IGdsb2JhbFJvb20uYnVmZmVyc1t1c2VySWRdXG4gICAgICAgIGxldCBzZW5kZXIgPSBnZXRSYW5kb20oT2JqZWN0LmtleXMoYnVmZikpXG4gICAgICAgIHZhciBtID0gYnVmZltzZW5kZXJdLnNoaWZ0KClcbiAgICAgICAgaWYgKGJ1ZmZbc2VuZGVyXS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgYnVmZltzZW5kZXJdXG4gICAgICAgIH1cbiAgICAgICAgdmFyIHVzZXIgPSBnbG9iYWxSb29tLnVzZXJzW3VzZXJJZF1cbiAgICAgICAgcmV0dXJuIHVzZXIucmVjZWl2ZU1lc3NhZ2UobVswXSwgbVsxXSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIHVzZXIueS5kYi53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKVxuICAgICAgICB9LCBmdW5jdGlvbiAoKSB7fSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0sXG4gICAgZmx1c2hBbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICAvLyBmbHVzaGVzIG1heSByZXN1bHQgaW4gbW9yZSBjcmVhdGVkIG9wZXJhdGlvbnMsXG4gICAgICAgIC8vIGZsdXNoIHVudGlsIHRoZXJlIGlzIG5vdGhpbmcgbW9yZSB0byBmbHVzaFxuICAgICAgICBmdW5jdGlvbiBuZXh0Rmx1c2ggKCkge1xuICAgICAgICAgIHZhciBjID0gZ2xvYmFsUm9vbS5mbHVzaE9uZSgpXG4gICAgICAgICAgaWYgKGMpIHtcbiAgICAgICAgICAgIHdoaWxlIChjKSB7XG4gICAgICAgICAgICAgIGMgPSBnbG9iYWxSb29tLmZsdXNoT25lKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGdsb2JhbFJvb20ud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKCkudGhlbihuZXh0Rmx1c2gpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGMgPSBnbG9iYWxSb29tLmZsdXNoT25lKClcbiAgICAgICAgICAgIGlmIChjKSB7XG4gICAgICAgICAgICAgIGMudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgZ2xvYmFsUm9vbS53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKS50aGVuKG5leHRGbHVzaClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBnbG9iYWxSb29tLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpLnRoZW4obmV4dEZsdXNoKVxuICAgICAgfSlcbiAgICB9XG4gIH1cbiAgWS51dGlscy5nbG9iYWxSb29tID0gZ2xvYmFsUm9vbVxuXG4gIHZhciB1c2VySWRDb3VudGVyID0gMFxuXG4gIGNsYXNzIFRlc3QgZXh0ZW5kcyBZLkFic3RyYWN0Q29ubmVjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAoeSwgb3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09wdGlvbnMgbXVzdCBub3QgYmUgdW5kZWZpbmVkIScpXG4gICAgICB9XG4gICAgICBvcHRpb25zLnJvbGUgPSAnbWFzdGVyJ1xuICAgICAgb3B0aW9ucy5mb3J3YXJkVG9TeW5jaW5nQ2xpZW50cyA9IGZhbHNlXG4gICAgICBzdXBlcih5LCBvcHRpb25zKVxuICAgICAgdGhpcy5zZXRVc2VySWQoKHVzZXJJZENvdW50ZXIrKykgKyAnJykudGhlbigoKSA9PiB7XG4gICAgICAgIGdsb2JhbFJvb20uYWRkVXNlcih0aGlzKVxuICAgICAgfSlcbiAgICAgIHRoaXMuZ2xvYmFsUm9vbSA9IGdsb2JhbFJvb21cbiAgICAgIHRoaXMuc3luY2luZ0NsaWVudER1cmF0aW9uID0gMFxuICAgIH1cbiAgICByZWNlaXZlTWVzc2FnZSAoc2VuZGVyLCBtKSB7XG4gICAgICByZXR1cm4gc3VwZXIucmVjZWl2ZU1lc3NhZ2Uoc2VuZGVyLCBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG0pKSlcbiAgICB9XG4gICAgc2VuZCAodXNlcklkLCBtZXNzYWdlKSB7XG4gICAgICB2YXIgYnVmZmVyID0gZ2xvYmFsUm9vbS5idWZmZXJzW3VzZXJJZF1cbiAgICAgIGlmIChidWZmZXIgIT0gbnVsbCkge1xuICAgICAgICBpZiAoYnVmZmVyW3RoaXMudXNlcklkXSA9PSBudWxsKSB7XG4gICAgICAgICAgYnVmZmVyW3RoaXMudXNlcklkXSA9IFtdXG4gICAgICAgIH1cbiAgICAgICAgYnVmZmVyW3RoaXMudXNlcklkXS5wdXNoKEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoW3RoaXMudXNlcklkLCBtZXNzYWdlXSkpKVxuICAgICAgfVxuICAgIH1cbiAgICBicm9hZGNhc3QgKG1lc3NhZ2UpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBnbG9iYWxSb29tLmJ1ZmZlcnMpIHtcbiAgICAgICAgdmFyIGJ1ZmYgPSBnbG9iYWxSb29tLmJ1ZmZlcnNba2V5XVxuICAgICAgICBpZiAoYnVmZlt0aGlzLnVzZXJJZF0gPT0gbnVsbCkge1xuICAgICAgICAgIGJ1ZmZbdGhpcy51c2VySWRdID0gW11cbiAgICAgICAgfVxuICAgICAgICBidWZmW3RoaXMudXNlcklkXS5wdXNoKEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoW3RoaXMudXNlcklkLCBtZXNzYWdlXSkpKVxuICAgICAgfVxuICAgIH1cbiAgICBpc0Rpc2Nvbm5lY3RlZCAoKSB7XG4gICAgICByZXR1cm4gZ2xvYmFsUm9vbS51c2Vyc1t0aGlzLnVzZXJJZF0gPT0gbnVsbFxuICAgIH1cbiAgICByZWNvbm5lY3QgKCkge1xuICAgICAgaWYgKHRoaXMuaXNEaXNjb25uZWN0ZWQoKSkge1xuICAgICAgICBnbG9iYWxSb29tLmFkZFVzZXIodGhpcylcbiAgICAgICAgc3VwZXIucmVjb25uZWN0KClcbiAgICAgIH1cbiAgICAgIHJldHVybiBZLnV0aWxzLmdsb2JhbFJvb20uZmx1c2hBbGwoKVxuICAgIH1cbiAgICBkaXNjb25uZWN0ICgpIHtcbiAgICAgIHZhciB3YWl0Rm9yTWUgPSBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgaWYgKCF0aGlzLmlzRGlzY29ubmVjdGVkKCkpIHtcbiAgICAgICAgZ2xvYmFsUm9vbS5yZW1vdmVVc2VyKHRoaXMudXNlcklkKVxuICAgICAgICB3YWl0Rm9yTWUgPSBzdXBlci5kaXNjb25uZWN0KClcbiAgICAgIH1cbiAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgcmV0dXJuIHdhaXRGb3JNZS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYueS5kYi53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKVxuICAgICAgfSlcbiAgICB9XG4gICAgZmx1c2ggKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICByZXR1cm4gYXN5bmMoZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgIHZhciBidWZmID0gZ2xvYmFsUm9vbS5idWZmZXJzW3NlbGYudXNlcklkXVxuICAgICAgICB3aGlsZSAoT2JqZWN0LmtleXMoYnVmZikubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHZhciBzZW5kZXIgPSBnZXRSYW5kb20oT2JqZWN0LmtleXMoYnVmZikpXG4gICAgICAgICAgdmFyIG0gPSBidWZmW3NlbmRlcl0uc2hpZnQoKVxuICAgICAgICAgIGlmIChidWZmW3NlbmRlcl0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBkZWxldGUgYnVmZltzZW5kZXJdXG4gICAgICAgICAgfVxuICAgICAgICAgIHlpZWxkIHRoaXMucmVjZWl2ZU1lc3NhZ2UobVswXSwgbVsxXSlcbiAgICAgICAgfVxuICAgICAgICB5aWVsZCBzZWxmLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIFkuVGVzdCA9IFRlc3Rcbn1cbiIsIi8qIEBmbG93ICovXG4ndXNlIHN0cmljdCdcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoWSAvKiA6YW55ICovKSB7XG4gIC8qXG4gICAgUGFydGlhbCBkZWZpbml0aW9uIG9mIGFuIE9wZXJhdGlvblN0b3JlLlxuICAgIFRPRE86IG5hbWUgaXQgRGF0YWJhc2UsIG9wZXJhdGlvbiBzdG9yZSBvbmx5IGhvbGRzIG9wZXJhdGlvbnMuXG5cbiAgICBBIGRhdGFiYXNlIGRlZmluaXRpb24gbXVzdCBhbHNlIGRlZmluZSB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICAgKiBsb2dUYWJsZSgpIChvcHRpb25hbClcbiAgICAgIC0gc2hvdyByZWxldmFudCBpbmZvcm1hdGlvbiBpbmZvcm1hdGlvbiBpbiBhIHRhYmxlXG4gICAgKiByZXF1ZXN0VHJhbnNhY3Rpb24obWFrZUdlbilcbiAgICAgIC0gcmVxdWVzdCBhIHRyYW5zYWN0aW9uXG4gICAgKiBkZXN0cm95KClcbiAgICAgIC0gZGVzdHJveSB0aGUgZGF0YWJhc2VcbiAgKi9cbiAgY2xhc3MgQWJzdHJhY3REYXRhYmFzZSB7XG4gICAgLyogOjpcbiAgICB5OiBZQ29uZmlnO1xuICAgIGZvcndhcmRBcHBsaWVkT3BlcmF0aW9uczogYm9vbGVhbjtcbiAgICBsaXN0ZW5lcnNCeUlkOiBPYmplY3Q7XG4gICAgbGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3c6IEFycmF5PE9iamVjdD47XG4gICAgbGlzdGVuZXJzQnlJZFJlcXVlc3RQZW5kaW5nOiBib29sZWFuO1xuICAgIGluaXRpYWxpemVkVHlwZXM6IE9iamVjdDtcbiAgICB3aGVuVXNlcklkU2V0TGlzdGVuZXI6ID9GdW5jdGlvbjtcbiAgICB3YWl0aW5nVHJhbnNhY3Rpb25zOiBBcnJheTxUcmFuc2FjdGlvbj47XG4gICAgdHJhbnNhY3Rpb25JblByb2dyZXNzOiBib29sZWFuO1xuICAgIGV4ZWN1dGVPcmRlcjogQXJyYXk8T2JqZWN0PjtcbiAgICBnYzE6IEFycmF5PFN0cnVjdD47XG4gICAgZ2MyOiBBcnJheTxTdHJ1Y3Q+O1xuICAgIGdjVGltZW91dDogbnVtYmVyO1xuICAgIGdjSW50ZXJ2YWw6IGFueTtcbiAgICBnYXJiYWdlQ29sbGVjdDogRnVuY3Rpb247XG4gICAgZXhlY3V0ZU9yZGVyOiBBcnJheTxhbnk+OyAvLyBmb3IgZGVidWdnaW5nIG9ubHlcbiAgICB1c2VySWQ6IFVzZXJJZDtcbiAgICBvcENsb2NrOiBudW1iZXI7XG4gICAgdHJhbnNhY3Rpb25zRmluaXNoZWQ6ID97cHJvbWlzZTogUHJvbWlzZSwgcmVzb2x2ZTogYW55fTtcbiAgICB0cmFuc2FjdDogKHg6ID9HZW5lcmF0b3IpID0+IGFueTtcbiAgICAqL1xuICAgIGNvbnN0cnVjdG9yICh5LCBvcHRzKSB7XG4gICAgICB0aGlzLnkgPSB5XG4gICAgICB0aGlzLmRiT3B0cyA9IG9wdHNcbiAgICAgIHZhciBvcyA9IHRoaXNcbiAgICAgIHRoaXMudXNlcklkID0gbnVsbFxuICAgICAgdmFyIHJlc29sdmVcbiAgICAgIHRoaXMudXNlcklkUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyKSB7XG4gICAgICAgIHJlc29sdmUgPSByXG4gICAgICB9KVxuICAgICAgdGhpcy51c2VySWRQcm9taXNlLnJlc29sdmUgPSByZXNvbHZlXG4gICAgICAvLyB3aGV0aGVyIHRvIGJyb2FkY2FzdCBhbGwgYXBwbGllZCBvcGVyYXRpb25zIChpbnNlcnQgJiBkZWxldGUgaG9vaylcbiAgICAgIHRoaXMuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zID0gZmFsc2VcbiAgICAgIC8vIEUuZy4gdGhpcy5saXN0ZW5lcnNCeUlkW2lkXSA6IEFycmF5PExpc3RlbmVyPlxuICAgICAgdGhpcy5saXN0ZW5lcnNCeUlkID0ge31cbiAgICAgIC8vIEV4ZWN1dGUgdGhlIG5leHQgdGltZSBhIHRyYW5zYWN0aW9uIGlzIHJlcXVlc3RlZFxuICAgICAgdGhpcy5saXN0ZW5lcnNCeUlkRXhlY3V0ZU5vdyA9IFtdXG4gICAgICAvLyBBIHRyYW5zYWN0aW9uIGlzIHJlcXVlc3RlZFxuICAgICAgdGhpcy5saXN0ZW5lcnNCeUlkUmVxdWVzdFBlbmRpbmcgPSBmYWxzZVxuICAgICAgLyogVG8gbWFrZSB0aGluZ3MgbW9yZSBjbGVhciwgdGhlIGZvbGxvd2luZyBuYW1pbmcgY29udmVudGlvbnM6XG4gICAgICAgICAqIGxzIDogd2UgcHV0IHRoaXMubGlzdGVuZXJzQnlJZCBvbiBsc1xuICAgICAgICAgKiBsIDogQXJyYXk8TGlzdGVuZXI+XG4gICAgICAgICAqIGlkIDogSWQgKGNhbid0IHVzZSBhcyBwcm9wZXJ0eSBuYW1lKVxuICAgICAgICAgKiBzaWQgOiBTdHJpbmcgKGNvbnZlcnRlZCBmcm9tIGlkIHZpYSBKU09OLnN0cmluZ2lmeVxuICAgICAgICAgICAgICAgICAgICAgICAgIHNvIHdlIGNhbiB1c2UgaXQgYXMgYSBwcm9wZXJ0eSBuYW1lKVxuXG4gICAgICAgIEFsd2F5cyByZW1lbWJlciB0byBmaXJzdCBvdmVyd3JpdGVcbiAgICAgICAgYSBwcm9wZXJ0eSBiZWZvcmUgeW91IGl0ZXJhdGUgb3ZlciBpdCFcbiAgICAgICovXG4gICAgICAvLyBUT0RPOiBVc2UgRVM3IFdlYWsgTWFwcy4gVGhpcyB3YXkgdHlwZXMgdGhhdCBhcmUgbm8gbG9uZ2VyIHVzZXIsXG4gICAgICAvLyB3b250IGJlIGtlcHQgaW4gbWVtb3J5LlxuICAgICAgdGhpcy5pbml0aWFsaXplZFR5cGVzID0ge31cbiAgICAgIHRoaXMud2FpdGluZ1RyYW5zYWN0aW9ucyA9IFtdXG4gICAgICB0aGlzLnRyYW5zYWN0aW9uSW5Qcm9ncmVzcyA9IGZhbHNlXG4gICAgICB0aGlzLnRyYW5zYWN0aW9uSXNGbHVzaGVkID0gZmFsc2VcbiAgICAgIGlmICh0eXBlb2YgWUNvbmN1cnJlbmN5X1Rlc3RpbmdNb2RlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLmV4ZWN1dGVPcmRlciA9IFtdXG4gICAgICB9XG4gICAgICB0aGlzLmdjMSA9IFtdIC8vIGZpcnN0IHN0YWdlXG4gICAgICB0aGlzLmdjMiA9IFtdIC8vIHNlY29uZCBzdGFnZSAtPiBhZnRlciB0aGF0LCByZW1vdmUgdGhlIG9wXG5cbiAgICAgIGZ1bmN0aW9uIGdhcmJhZ2VDb2xsZWN0ICgpIHtcbiAgICAgICAgcmV0dXJuIG9zLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChvcy5nYzEubGVuZ3RoID4gMCB8fCBvcy5nYzIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaWYgKCFvcy55LmNvbm5lY3Rvci5pc1N5bmNlZCkge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2djIHNob3VsZCBiZSBlbXB0eSB3aGVuIG5vdCBzeW5jZWQhJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICBvcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9zLnkuY29ubmVjdG9yICE9IG51bGwgJiYgb3MueS5jb25uZWN0b3IuaXNTeW5jZWQpIHtcbiAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3MuZ2MyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvaWQgPSBvcy5nYzJbaV1cbiAgICAgICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZ2FyYmFnZUNvbGxlY3RPcGVyYXRpb24ob2lkKVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgb3MuZ2MyID0gb3MuZ2MxXG4gICAgICAgICAgICAgICAgICBvcy5nYzEgPSBbXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBVc2Ugc2V0SW50ZXJ2YWwgaGVyZSBpbnN0ZWFkICh3aGVuIGdhcmJhZ2VDb2xsZWN0IGlzIGNhbGxlZCBzZXZlcmFsIHRpbWVzIHRoZXJlIHdpbGwgYmUgc2V2ZXJhbCB0aW1lb3V0cy4uKVxuICAgICAgICAgICAgICAgIGlmIChvcy5nY1RpbWVvdXQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICBvcy5nY0ludGVydmFsID0gc2V0VGltZW91dChnYXJiYWdlQ29sbGVjdCwgb3MuZ2NUaW1lb3V0KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE86IHNlZSBhYm92ZVxuICAgICAgICAgICAgaWYgKG9zLmdjVGltZW91dCA+IDApIHtcbiAgICAgICAgICAgICAgb3MuZ2NJbnRlcnZhbCA9IHNldFRpbWVvdXQoZ2FyYmFnZUNvbGxlY3QsIG9zLmdjVGltZW91dClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIHRoaXMuZ2FyYmFnZUNvbGxlY3QgPSBnYXJiYWdlQ29sbGVjdFxuICAgICAgdGhpcy5zdGFydEdhcmJhZ2VDb2xsZWN0b3IoKVxuXG4gICAgICB0aGlzLnJlcGFpckNoZWNrSW50ZXJ2YWwgPSAhb3B0cy5yZXBhaXJDaGVja0ludGVydmFsID8gNjAwMCA6IG9wdHMucmVwYWlyQ2hlY2tJbnRlcnZhbFxuICAgICAgdGhpcy5vcHNSZWNlaXZlZFRpbWVzdGFtcCA9IG5ldyBEYXRlKClcbiAgICAgIHRoaXMuc3RhcnRSZXBhaXJDaGVjaygpXG4gICAgfVxuICAgIHN0YXJ0R2FyYmFnZUNvbGxlY3RvciAoKSB7XG4gICAgICB0aGlzLmdjID0gdGhpcy5kYk9wdHMuZ2MgPT0gbnVsbCB8fCB0aGlzLmRiT3B0cy5nY1xuICAgICAgaWYgKHRoaXMuZ2MpIHtcbiAgICAgICAgdGhpcy5nY1RpbWVvdXQgPSAhdGhpcy5kYk9wdHMuZ2NUaW1lb3V0ID8gNTAwMDAgOiB0aGlzLmRiT3B0cy5nY1RpbWVvdXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ2NUaW1lb3V0ID0gLTFcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmdjVGltZW91dCA+IDApIHtcbiAgICAgICAgdGhpcy5nYXJiYWdlQ29sbGVjdCgpXG4gICAgICB9XG4gICAgfVxuICAgIHN0YXJ0UmVwYWlyQ2hlY2sgKCkge1xuICAgICAgdmFyIG9zID0gdGhpc1xuICAgICAgaWYgKHRoaXMucmVwYWlyQ2hlY2tJbnRlcnZhbCA+IDApIHtcbiAgICAgICAgdGhpcy5yZXBhaXJDaGVja0ludGVydmFsSGFuZGxlciA9IHNldEludGVydmFsKGZ1bmN0aW9uIHJlcGFpck9uTWlzc2luZ09wZXJhdGlvbnMgKCkge1xuICAgICAgICAgIC8qXG4gICAgICAgICAgICBDYXNlIDEuIE5vIG9wcyBoYXZlIGJlZW4gcmVjZWl2ZWQgaW4gYSB3aGlsZSAobmV3IERhdGUoKSAtIG9zLm9wc1JlY2VpdmVkVGltZXN0YW1wID4gb3MucmVwYWlyQ2hlY2tJbnRlcnZhbClcbiAgICAgICAgICAgICAgLSAxLjEgb3MubGlzdGVuZXJzQnlJZCBpcyBlbXB0eS4gVGhlbiB0aGUgc3RhdGUgd2FzIGNvcnJlY3QgdGhlIHdob2xlIHRpbWUuIC0+IE5vdGhpbmcgdG8gZG8gKG5vciB0byB1cGRhdGUpXG4gICAgICAgICAgICAgIC0gMS4yIG9zLmxpc3RlbmVyc0J5SWQgaXMgbm90IGVtcHR5LlxuICAgICAgICAgICAgICAgICAgICAgICogVGhlbiB0aGUgc3RhdGUgd2FzIGluY29ycmVjdCBmb3IgYXQgbGVhc3Qge29zLnJlcGFpckNoZWNrSW50ZXJ2YWx9IHNlY29uZHMuXG4gICAgICAgICAgICAgICAgICAgICAgKiAtPiBSZW1vdmUgZXZlcnl0aGluZyBpbiBvcy5saXN0ZW5lcnNCeUlkIGFuZCBzeW5jIGFnYWluIChjb25uZWN0b3IucmVwYWlyKCkpXG4gICAgICAgICAgICBDYXNlIDIuIEFuIG9wIGhhcyBiZWVuIHJlY2VpdmVkIGluIHRoZSBsYXN0IHtvcy5yZXBhaXJDaGVja0ludGVydmFsIH0gc2Vjb25kcy5cbiAgICAgICAgICAgICAgICAgICAgSXQgaXMgbm90IHlldCBuZWNlc3NhcnkgdG8gY2hlY2sgZm9yIGZhdWx0eSBiZWhhdmlvci4gRXZlcnl0aGluZyBjYW4gc3RpbGwgcmVzb2x2ZSBpdHNlbGYuIFdhaXQgZm9yIG1vcmUgbWVzc2FnZXMuXG4gICAgICAgICAgICAgICAgICAgIElmIG5vdGhpbmcgd2FzIHJlY2VpdmVkIGZvciBhIHdoaWxlIGFuZCBvcy5saXN0ZW5lcnNCeUlkIGlzIHN0aWxsIG5vdCBlbXR5LCB3ZSBhcmUgaW4gY2FzZSAxLjJcbiAgICAgICAgICAgICAgICAgICAgLT4gRG8gbm90aGluZ1xuXG4gICAgICAgICAgICBCYXNlbGluZSBoZXJlIGlzOiB3ZSByZWFsbHkgb25seSBoYXZlIHRvIGNhdGNoIGNhc2UgMS4yLi5cbiAgICAgICAgICAqL1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIG5ldyBEYXRlKCkgLSBvcy5vcHNSZWNlaXZlZFRpbWVzdGFtcCA+IG9zLnJlcGFpckNoZWNrSW50ZXJ2YWwgJiZcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG9zLmxpc3RlbmVyc0J5SWQpLmxlbmd0aCA+IDAgLy8gb3MubGlzdGVuZXJzQnlJZCBpcyBub3QgZW1wdHlcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIGhhdmVuJ3QgcmVjZWl2ZWQgb3BlcmF0aW9ucyBmb3Igb3ZlciB7b3MucmVwYWlyQ2hlY2tJbnRlcnZhbH0gc2Vjb25kcywgcmVzZW5kIHN0YXRlIHZlY3RvclxuICAgICAgICAgICAgb3MubGlzdGVuZXJzQnlJZCA9IHt9XG4gICAgICAgICAgICBvcy5vcHNSZWNlaXZlZFRpbWVzdGFtcCA9IG5ldyBEYXRlKCkgLy8gdXBkYXRlIHNvIHlvdSBkb24ndCBzZW5kIHJlcGFpciBzZXZlcmFsIHRpbWVzIGluIGEgcm93XG4gICAgICAgICAgICBvcy55LmNvbm5lY3Rvci5yZXBhaXIoKVxuICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcy5yZXBhaXJDaGVja0ludGVydmFsKVxuICAgICAgfVxuICAgIH1cbiAgICBzdG9wUmVwYWlyQ2hlY2sgKCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnJlcGFpckNoZWNrSW50ZXJ2YWxIYW5kbGVyKVxuICAgIH1cbiAgICBxdWV1ZUdhcmJhZ2VDb2xsZWN0b3IgKGlkKSB7XG4gICAgICBpZiAodGhpcy55LmNvbm5lY3Rvci5pc1N5bmNlZCAmJiB0aGlzLmdjKSB7XG4gICAgICAgIHRoaXMuZ2MxLnB1c2goaWQpXG4gICAgICB9XG4gICAgfVxuICAgIGVtcHR5R2FyYmFnZUNvbGxlY3RvciAoKSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIHZhciBjaGVjayA9ICgpID0+IHtcbiAgICAgICAgICBpZiAodGhpcy5nYzEubGVuZ3RoID4gMCB8fCB0aGlzLmdjMi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmdhcmJhZ2VDb2xsZWN0KCkudGhlbihjaGVjaylcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNldFRpbWVvdXQoY2hlY2ssIDApXG4gICAgICB9KVxuICAgIH1cbiAgICBhZGRUb0RlYnVnICgpIHtcbiAgICAgIGlmICh0eXBlb2YgWUNvbmN1cnJlbmN5X1Rlc3RpbmdNb2RlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIgY29tbWFuZCAvKiA6c3RyaW5nICovID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGFyZ3VtZW50cywgZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gc1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocylcbiAgICAgICAgICB9XG4gICAgICAgIH0pLmpvaW4oJycpLnJlcGxhY2UoL1wiL2csIFwiJ1wiKS5yZXBsYWNlKC8sL2csICcsICcpLnJlcGxhY2UoLzovZywgJzogJylcbiAgICAgICAgdGhpcy5leGVjdXRlT3JkZXIucHVzaChjb21tYW5kKVxuICAgICAgfVxuICAgIH1cbiAgICBnZXREZWJ1Z0RhdGEgKCkge1xuICAgICAgY29uc29sZS5sb2codGhpcy5leGVjdXRlT3JkZXIuam9pbignXFxuJykpXG4gICAgfVxuICAgIHN0b3BHYXJiYWdlQ29sbGVjdG9yICgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgdGhpcy5nYyA9IGZhbHNlXG4gICAgICB0aGlzLmdjVGltZW91dCA9IC0xXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgc2VsZi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgdmFyIHVuZ2MgLyogOkFycmF5PFN0cnVjdD4gKi8gPSBzZWxmLmdjMS5jb25jYXQoc2VsZi5nYzIpXG4gICAgICAgICAgc2VsZi5nYzEgPSBbXVxuICAgICAgICAgIHNlbGYuZ2MyID0gW11cbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVuZ2MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBvcCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbih1bmdjW2ldKVxuICAgICAgICAgICAgaWYgKG9wICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgZGVsZXRlIG9wLmdjXG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgIH1cbiAgICAvKlxuICAgICAgVHJ5IHRvIGFkZCB0byBHQy5cblxuICAgICAgVE9ETzogcmVuYW1lIHRoaXMgZnVuY3Rpb25cblxuICAgICAgUnVsZXo6XG4gICAgICAqIE9ubHkgZ2MgaWYgdGhpcyB1c2VyIGlzIG9ubGluZSAmIGdjIHR1cm5lZCBvblxuICAgICAgKiBUaGUgbW9zdCBsZWZ0IGVsZW1lbnQgaW4gYSBsaXN0IG11c3Qgbm90IGJlIGdjJ2QuXG4gICAgICAgID0+IFRoZXJlIGlzIGF0IGxlYXN0IG9uZSBlbGVtZW50IGluIHRoZSBsaXN0XG5cbiAgICAgIHJldHVybnMgdHJ1ZSBpZmYgb3Agd2FzIGFkZGVkIHRvIEdDXG4gICAgKi9cbiAgICAqIGFkZFRvR2FyYmFnZUNvbGxlY3RvciAob3AsIGxlZnQpIHtcbiAgICAgIGlmIChcbiAgICAgICAgb3AuZ2MgPT0gbnVsbCAmJlxuICAgICAgICBvcC5kZWxldGVkID09PSB0cnVlICYmXG4gICAgICAgIHRoaXMuc3RvcmUuZ2MgJiZcbiAgICAgICAgdGhpcy5zdG9yZS55LmNvbm5lY3Rvci5pc1N5bmNlZFxuICAgICAgKSB7XG4gICAgICAgIHZhciBnYyA9IGZhbHNlXG4gICAgICAgIGlmIChsZWZ0ICE9IG51bGwgJiYgbGVmdC5kZWxldGVkID09PSB0cnVlKSB7XG4gICAgICAgICAgZ2MgPSB0cnVlXG4gICAgICAgIH0gZWxzZSBpZiAob3AuY29udGVudCAhPSBudWxsICYmIG9wLmNvbnRlbnQubGVuZ3RoID4gMSkge1xuICAgICAgICAgIG9wID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydChbb3AuaWRbMF0sIG9wLmlkWzFdICsgMV0pXG4gICAgICAgICAgZ2MgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdjKSB7XG4gICAgICAgICAgb3AuZ2MgPSB0cnVlXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9wKVxuICAgICAgICAgIHRoaXMuc3RvcmUucXVldWVHYXJiYWdlQ29sbGVjdG9yKG9wLmlkKVxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICByZW1vdmVGcm9tR2FyYmFnZUNvbGxlY3RvciAob3ApIHtcbiAgICAgIGZ1bmN0aW9uIGZpbHRlciAobykge1xuICAgICAgICByZXR1cm4gIVkudXRpbHMuY29tcGFyZUlkcyhvLCBvcC5pZClcbiAgICAgIH1cbiAgICAgIHRoaXMuZ2MxID0gdGhpcy5nYzEuZmlsdGVyKGZpbHRlcilcbiAgICAgIHRoaXMuZ2MyID0gdGhpcy5nYzIuZmlsdGVyKGZpbHRlcilcbiAgICAgIGRlbGV0ZSBvcC5nY1xuICAgIH1cbiAgICBkZXN0cm95VHlwZXMgKCkge1xuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuaW5pdGlhbGl6ZWRUeXBlcykge1xuICAgICAgICB2YXIgdHlwZSA9IHRoaXMuaW5pdGlhbGl6ZWRUeXBlc1trZXldXG4gICAgICAgIGlmICh0eXBlLl9kZXN0cm95ICE9IG51bGwpIHtcbiAgICAgICAgICB0eXBlLl9kZXN0cm95KClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgdHlwZSB5b3UgaW5jbHVkZWQgZG9lcyBub3QgcHJvdmlkZSBkZXN0cm95IGZ1bmN0aW9uYWxpdHksIGl0IHdpbGwgcmVtYWluIGluIG1lbW9yeSAodXBkYXRpbmcgeW91ciBwYWNrYWdlcyB3aWxsIGhlbHApLicpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBkZXN0cm95ICgpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5nY0ludGVydmFsKVxuICAgICAgdGhpcy5nY0ludGVydmFsID0gbnVsbFxuICAgICAgdGhpcy5zdG9wUmVwYWlyQ2hlY2soKVxuICAgIH1cbiAgICBzZXRVc2VySWQgKHVzZXJJZCkge1xuICAgICAgaWYgKCF0aGlzLnVzZXJJZFByb21pc2UuaW5Qcm9ncmVzcykge1xuICAgICAgICB0aGlzLnVzZXJJZFByb21pc2UuaW5Qcm9ncmVzcyA9IHRydWVcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIHNlbGYucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogKCkge1xuICAgICAgICAgIHNlbGYudXNlcklkID0gdXNlcklkXG4gICAgICAgICAgdmFyIHN0YXRlID0geWllbGQqIHRoaXMuZ2V0U3RhdGUodXNlcklkKVxuICAgICAgICAgIHNlbGYub3BDbG9jayA9IHN0YXRlLmNsb2NrXG4gICAgICAgICAgc2VsZi51c2VySWRQcm9taXNlLnJlc29sdmUodXNlcklkKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMudXNlcklkUHJvbWlzZVxuICAgIH1cbiAgICB3aGVuVXNlcklkU2V0IChmKSB7XG4gICAgICB0aGlzLnVzZXJJZFByb21pc2UudGhlbihmKVxuICAgIH1cbiAgICBnZXROZXh0T3BJZCAobnVtYmVyT2ZJZHMpIHtcbiAgICAgIGlmIChudW1iZXJPZklkcyA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZ2V0TmV4dE9wSWQgZXhwZWN0cyB0aGUgbnVtYmVyIG9mIGNyZWF0ZWQgaWRzIHRvIGNyZWF0ZSEnKVxuICAgICAgfSBlbHNlIGlmICh0aGlzLnVzZXJJZCA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT3BlcmF0aW9uU3RvcmUgbm90IHlldCBpbml0aWFsaXplZCEnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGlkID0gW3RoaXMudXNlcklkLCB0aGlzLm9wQ2xvY2tdXG4gICAgICAgIHRoaXMub3BDbG9jayArPSBudW1iZXJPZklkc1xuICAgICAgICByZXR1cm4gaWRcbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIEFwcGx5IGEgbGlzdCBvZiBvcGVyYXRpb25zLlxuXG4gICAgICAqIHdlIHNhdmUgYSB0aW1lc3RhbXAsIGJlY2F1c2Ugd2UgcmVjZWl2ZWQgbmV3IG9wZXJhdGlvbnMgdGhhdCBjb3VsZCByZXNvbHZlIG9wcyBpbiB0aGlzLmxpc3RlbmVyc0J5SWQgKHNlZSB0aGlzLnN0YXJ0UmVwYWlyQ2hlY2spXG4gICAgICAqIGdldCBhIHRyYW5zYWN0aW9uXG4gICAgICAqIGNoZWNrIHdoZXRoZXIgYWxsIFN0cnVjdC4qLnJlcXVpcmVkT3BzIGFyZSBpbiB0aGUgT1NcbiAgICAgICogY2hlY2sgaWYgaXQgaXMgYW4gZXhwZWN0ZWQgb3AgKG90aGVyd2lzZSB3YWl0IGZvciBpdClcbiAgICAgICogY2hlY2sgaWYgd2FzIGRlbGV0ZWQsIGFwcGx5IGEgZGVsZXRlIG9wZXJhdGlvbiBhZnRlciBvcCB3YXMgYXBwbGllZFxuICAgICovXG4gICAgYXBwbHkgKG9wcykge1xuICAgICAgdGhpcy5vcHNSZWNlaXZlZFRpbWVzdGFtcCA9IG5ldyBEYXRlKClcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvID0gb3BzW2ldXG4gICAgICAgIGlmIChvLmlkID09IG51bGwgfHwgby5pZFswXSAhPT0gdGhpcy55LmNvbm5lY3Rvci51c2VySWQpIHtcbiAgICAgICAgICB2YXIgcmVxdWlyZWQgPSBZLlN0cnVjdFtvLnN0cnVjdF0ucmVxdWlyZWRPcHMobylcbiAgICAgICAgICBpZiAoby5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXF1aXJlZCA9IHJlcXVpcmVkLmNvbmNhdChvLnJlcXVpcmVzKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLndoZW5PcGVyYXRpb25zRXhpc3QocmVxdWlyZWQsIG8pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIG9wIGlzIGV4ZWN1dGVkIGFzIHNvb24gYXMgZXZlcnkgb3BlcmF0aW9uIHJlcXVlc3RlZCBpcyBhdmFpbGFibGUuXG4gICAgICBOb3RlIHRoYXQgVHJhbnNhY3Rpb24gY2FuIChhbmQgc2hvdWxkKSBidWZmZXIgcmVxdWVzdHMuXG4gICAgKi9cbiAgICB3aGVuT3BlcmF0aW9uc0V4aXN0IChpZHMsIG9wKSB7XG4gICAgICBpZiAoaWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbGV0IGxpc3RlbmVyID0ge1xuICAgICAgICAgIG9wOiBvcCxcbiAgICAgICAgICBtaXNzaW5nOiBpZHMubGVuZ3RoXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGxldCBpZCA9IGlkc1tpXVxuICAgICAgICAgIGxldCBzaWQgPSBKU09OLnN0cmluZ2lmeShpZClcbiAgICAgICAgICBsZXQgbCA9IHRoaXMubGlzdGVuZXJzQnlJZFtzaWRdXG4gICAgICAgICAgaWYgKGwgPT0gbnVsbCkge1xuICAgICAgICAgICAgbCA9IFtdXG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVyc0J5SWRbc2lkXSA9IGxcbiAgICAgICAgICB9XG4gICAgICAgICAgbC5wdXNoKGxpc3RlbmVyKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxpc3RlbmVyc0J5SWRFeGVjdXRlTm93LnB1c2goe1xuICAgICAgICAgIG9wOiBvcFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5saXN0ZW5lcnNCeUlkUmVxdWVzdFBlbmRpbmcpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIHRoaXMubGlzdGVuZXJzQnlJZFJlcXVlc3RQZW5kaW5nID0gdHJ1ZVxuICAgICAgdmFyIHN0b3JlID0gdGhpc1xuXG4gICAgICB0aGlzLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgdmFyIGV4ZU5vdyA9IHN0b3JlLmxpc3RlbmVyc0J5SWRFeGVjdXRlTm93XG4gICAgICAgIHN0b3JlLmxpc3RlbmVyc0J5SWRFeGVjdXRlTm93ID0gW11cblxuICAgICAgICB2YXIgbHMgPSBzdG9yZS5saXN0ZW5lcnNCeUlkXG4gICAgICAgIHN0b3JlLmxpc3RlbmVyc0J5SWQgPSB7fVxuXG4gICAgICAgIHN0b3JlLmxpc3RlbmVyc0J5SWRSZXF1ZXN0UGVuZGluZyA9IGZhbHNlXG5cbiAgICAgICAgZm9yIChsZXQga2V5ID0gMDsga2V5IDwgZXhlTm93Lmxlbmd0aDsga2V5KyspIHtcbiAgICAgICAgICBsZXQgbyA9IGV4ZU5vd1trZXldLm9wXG4gICAgICAgICAgeWllbGQqIHN0b3JlLnRyeUV4ZWN1dGUuY2FsbCh0aGlzLCBvKVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgc2lkIGluIGxzKSB7XG4gICAgICAgICAgdmFyIGwgPSBsc1tzaWRdXG4gICAgICAgICAgdmFyIGlkID0gSlNPTi5wYXJzZShzaWQpXG4gICAgICAgICAgdmFyIG9wXG4gICAgICAgICAgaWYgKHR5cGVvZiBpZFsxXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKGlkKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihpZClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wID09IG51bGwpIHtcbiAgICAgICAgICAgIHN0b3JlLmxpc3RlbmVyc0J5SWRbc2lkXSA9IGxcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGxldCBsaXN0ZW5lciA9IGxbaV1cbiAgICAgICAgICAgICAgbGV0IG8gPSBsaXN0ZW5lci5vcFxuICAgICAgICAgICAgICBpZiAoLS1saXN0ZW5lci5taXNzaW5nID09PSAwKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHN0b3JlLnRyeUV4ZWN1dGUuY2FsbCh0aGlzLCBvKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICAvKlxuICAgICAgQWN0dWFsbHkgZXhlY3V0ZSBhbiBvcGVyYXRpb24sIHdoZW4gYWxsIGV4cGVjdGVkIG9wZXJhdGlvbnMgYXJlIGF2YWlsYWJsZS5cbiAgICAqL1xuICAgIC8qIDo6IC8vIFRPRE86IHRoaXMgYmVsb25ncyBzb21laG93IHRvIHRyYW5zYWN0aW9uXG4gICAgc3RvcmU6IE9iamVjdDtcbiAgICBnZXRPcGVyYXRpb246IGFueTtcbiAgICBpc0dhcmJhZ2VDb2xsZWN0ZWQ6IGFueTtcbiAgICBhZGRPcGVyYXRpb246IGFueTtcbiAgICB3aGVuT3BlcmF0aW9uc0V4aXN0OiBhbnk7XG4gICAgKi9cbiAgICAqIHRyeUV4ZWN1dGUgKG9wKSB7XG4gICAgICB0aGlzLnN0b3JlLmFkZFRvRGVidWcoJ3lpZWxkKiB0aGlzLnN0b3JlLnRyeUV4ZWN1dGUuY2FsbCh0aGlzLCAnLCBKU09OLnN0cmluZ2lmeShvcCksICcpJylcbiAgICAgIGlmIChvcC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgIHlpZWxkKiBZLlN0cnVjdC5EZWxldGUuZXhlY3V0ZS5jYWxsKHRoaXMsIG9wKVxuICAgICAgICAvLyB0aGlzIGlzIG5vdyBjYWxsZWQgaW4gVHJhbnNhY3Rpb24uZGVsZXRlT3BlcmF0aW9uIVxuICAgICAgICAvLyB5aWVsZCogdGhpcy5zdG9yZS5vcGVyYXRpb25BZGRlZCh0aGlzLCBvcClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNoZWNrIGlmIHRoaXMgb3Agd2FzIGRlZmluZWRcbiAgICAgICAgdmFyIGRlZmluZWQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24ob3AuaWQpXG4gICAgICAgIHdoaWxlIChkZWZpbmVkICE9IG51bGwgJiYgZGVmaW5lZC5jb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAvLyBjaGVjayBpZiB0aGlzIG9wIGhhcyBhIGxvbmdlciBjb250ZW50IGluIHRoZSBjYXNlIGl0IGlzIGRlZmluZWRcbiAgICAgICAgICBpZiAoZGVmaW5lZC5pZFsxXSArIGRlZmluZWQuY29udGVudC5sZW5ndGggPCBvcC5pZFsxXSArIG9wLmNvbnRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgb3ZlcmxhcFNpemUgPSBkZWZpbmVkLmNvbnRlbnQubGVuZ3RoIC0gKG9wLmlkWzFdIC0gZGVmaW5lZC5pZFsxXSlcbiAgICAgICAgICAgIG9wLmNvbnRlbnQuc3BsaWNlKDAsIG92ZXJsYXBTaXplKVxuICAgICAgICAgICAgb3AuaWQgPSBbb3AuaWRbMF0sIG9wLmlkWzFdICsgb3ZlcmxhcFNpemVdXG4gICAgICAgICAgICBvcC5sZWZ0ID0gWS51dGlscy5nZXRMYXN0SWQoZGVmaW5lZClcbiAgICAgICAgICAgIG9wLm9yaWdpbiA9IG9wLmxlZnRcbiAgICAgICAgICAgIGRlZmluZWQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob3AuaWQpIC8vIGdldE9wZXJhdGlvbiBzdWZmaWNlcyBoZXJlXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZWZpbmVkID09IG51bGwpIHtcbiAgICAgICAgICB2YXIgb3BpZCA9IG9wLmlkXG4gICAgICAgICAgdmFyIGlzR2FyYmFnZUNvbGxlY3RlZCA9IHlpZWxkKiB0aGlzLmlzR2FyYmFnZUNvbGxlY3RlZChvcGlkKVxuICAgICAgICAgIGlmICghaXNHYXJiYWdlQ29sbGVjdGVkKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiByZWR1Y2UgbnVtYmVyIG9mIGdldCAvIHB1dCBjYWxscyBmb3Igb3AgLi5cbiAgICAgICAgICAgIHlpZWxkKiBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmV4ZWN1dGUuY2FsbCh0aGlzLCBvcClcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLmFkZE9wZXJhdGlvbihvcClcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnN0b3JlLm9wZXJhdGlvbkFkZGVkKHRoaXMsIG9wKVxuICAgICAgICAgICAgLy8gb3BlcmF0aW9uQWRkZWQgY2FuIGNoYW5nZSBvcC4uXG4gICAgICAgICAgICBvcCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcGlkKVxuICAgICAgICAgICAgLy8gaWYgaW5zZXJ0aW9uLCB0cnkgdG8gY29tYmluZSB3aXRoIGxlZnRcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnRyeUNvbWJpbmVXaXRoTGVmdChvcClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgKiBDYWxsZWQgYnkgYSB0cmFuc2FjdGlvbiB3aGVuIGFuIG9wZXJhdGlvbiBpcyBhZGRlZC5cbiAgICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGVzcGVjaWFsbHkgaW1wb3J0YW50IGZvciB5LWluZGV4ZWRkYiwgd2hlcmUgc2V2ZXJhbCBpbnN0YW5jZXMgbWF5IHNoYXJlIGEgc2luZ2xlIGRhdGFiYXNlLlxuICAgICAqIEV2ZXJ5IHRpbWUgYW4gb3BlcmF0aW9uIGlzIGNyZWF0ZWQgYnkgb25lIGluc3RhbmNlLCBpdCBpcyBzZW5kIHRvIGFsbCBvdGhlciBpbnN0YW5jZXMgYW5kIG9wZXJhdGlvbkFkZGVkIGlzIGNhbGxlZFxuICAgICAqXG4gICAgICogSWYgaXQncyBub3QgYSBEZWxldGUgb3BlcmF0aW9uOlxuICAgICAqICAgKiBDaGVja3MgaWYgYW5vdGhlciBvcGVyYXRpb24gaXMgZXhlY3V0YWJsZSAobGlzdGVuZXJzQnlJZClcbiAgICAgKiAgICogVXBkYXRlIHN0YXRlLCBpZiBwb3NzaWJsZVxuICAgICAqXG4gICAgICogQWx3YXlzOlxuICAgICAqICAgKiBDYWxsIHR5cGVcbiAgICAgKi9cbiAgICAqIG9wZXJhdGlvbkFkZGVkICh0cmFuc2FjdGlvbiwgb3ApIHtcbiAgICAgIGlmIChvcC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgIHZhciB0eXBlID0gdGhpcy5pbml0aWFsaXplZFR5cGVzW0pTT04uc3RyaW5naWZ5KG9wLnRhcmdldFBhcmVudCldXG4gICAgICAgIGlmICh0eXBlICE9IG51bGwpIHtcbiAgICAgICAgICB5aWVsZCogdHlwZS5fY2hhbmdlZCh0cmFuc2FjdGlvbiwgb3ApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGluY3JlYXNlIFNTXG4gICAgICAgIHlpZWxkKiB0cmFuc2FjdGlvbi51cGRhdGVTdGF0ZShvcC5pZFswXSlcbiAgICAgICAgdmFyIG9wTGVuID0gb3AuY29udGVudCAhPSBudWxsID8gb3AuY29udGVudC5sZW5ndGggOiAxXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3BMZW47IGkrKykge1xuICAgICAgICAgIC8vIG5vdGlmeSB3aGVuT3BlcmF0aW9uIGxpc3RlbmVycyAoYnkgaWQpXG4gICAgICAgICAgdmFyIHNpZCA9IEpTT04uc3RyaW5naWZ5KFtvcC5pZFswXSwgb3AuaWRbMV0gKyBpXSlcbiAgICAgICAgICB2YXIgbCA9IHRoaXMubGlzdGVuZXJzQnlJZFtzaWRdXG4gICAgICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzQnlJZFtzaWRdXG4gICAgICAgICAgaWYgKGwgIT0gbnVsbCkge1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGwpIHtcbiAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gbFtrZXldXG4gICAgICAgICAgICAgIGlmICgtLWxpc3RlbmVyLm1pc3NpbmcgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndoZW5PcGVyYXRpb25zRXhpc3QoW10sIGxpc3RlbmVyLm9wKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciB0ID0gdGhpcy5pbml0aWFsaXplZFR5cGVzW0pTT04uc3RyaW5naWZ5KG9wLnBhcmVudCldXG5cbiAgICAgICAgLy8gaWYgcGFyZW50IGlzIGRlbGV0ZWQsIG1hcmsgYXMgZ2MnZCBhbmQgcmV0dXJuXG4gICAgICAgIGlmIChvcC5wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBwYXJlbnRJc0RlbGV0ZWQgPSB5aWVsZCogdHJhbnNhY3Rpb24uaXNEZWxldGVkKG9wLnBhcmVudClcbiAgICAgICAgICBpZiAocGFyZW50SXNEZWxldGVkKSB7XG4gICAgICAgICAgICB5aWVsZCogdHJhbnNhY3Rpb24uZGVsZXRlTGlzdChvcC5pZClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vdGlmeSBwYXJlbnQsIGlmIGl0IHdhcyBpbnN0YW5jaWF0ZWQgYXMgYSBjdXN0b20gdHlwZVxuICAgICAgICBpZiAodCAhPSBudWxsKSB7XG4gICAgICAgICAgbGV0IG8gPSBZLnV0aWxzLmNvcHlPcGVyYXRpb24ob3ApXG4gICAgICAgICAgeWllbGQqIHQuX2NoYW5nZWQodHJhbnNhY3Rpb24sIG8pXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFvcC5kZWxldGVkKSB7XG4gICAgICAgICAgLy8gRGVsZXRlIGlmIERTIHNheXMgdGhpcyBpcyBhY3R1YWxseSBkZWxldGVkXG4gICAgICAgICAgdmFyIGxlbiA9IG9wLmNvbnRlbnQgIT0gbnVsbCA/IG9wLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgICAgIHZhciBzdGFydElkID0gb3AuaWQgLy8gWW91IG11c3Qgbm90IHVzZSBvcC5pZCBpbiB0aGUgZm9sbG93aW5nIGxvb3AsIGJlY2F1c2Ugb3Agd2lsbCBjaGFuZ2Ugd2hlbiBkZWxldGVkXG4gICAgICAgICAgICAvLyBUT0RPOiAhISBjb25zb2xlLmxvZygnVE9ETzogY2hhbmdlIHRoaXMgYmVmb3JlIGNvbW1pdGluZycpXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFyIGlkID0gW3N0YXJ0SWRbMF0sIHN0YXJ0SWRbMV0gKyBpXVxuICAgICAgICAgICAgdmFyIG9wSXNEZWxldGVkID0geWllbGQqIHRyYW5zYWN0aW9uLmlzRGVsZXRlZChpZClcbiAgICAgICAgICAgIGlmIChvcElzRGVsZXRlZCkge1xuICAgICAgICAgICAgICB2YXIgZGVsb3AgPSB7XG4gICAgICAgICAgICAgICAgc3RydWN0OiAnRGVsZXRlJyxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGlkXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMudHJ5RXhlY3V0ZS5jYWxsKHRyYW5zYWN0aW9uLCBkZWxvcClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkICgpIHtcbiAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9uSW5Qcm9ncmVzcykge1xuICAgICAgICBpZiAodGhpcy50cmFuc2FjdGlvbnNGaW5pc2hlZCA9PSBudWxsKSB7XG4gICAgICAgICAgdmFyIHJlc29sdmVcbiAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICByZXNvbHZlID0gclxuICAgICAgICAgIH0pXG4gICAgICAgICAgdGhpcy50cmFuc2FjdGlvbnNGaW5pc2hlZCA9IHtcbiAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsXG4gICAgICAgICAgICBwcm9taXNlOiBwcm9taXNlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnRyYW5zYWN0aW9uc0ZpbmlzaGVkLnByb21pc2VcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBDaGVjayBpZiB0aGVyZSBpcyBhbm90aGVyIHRyYW5zYWN0aW9uIHJlcXVlc3QuXG4gICAgLy8gKiB0aGUgbGFzdCB0cmFuc2FjdGlvbiBpcyBhbHdheXMgYSBmbHVzaCA6KVxuICAgIGdldE5leHRSZXF1ZXN0ICgpIHtcbiAgICAgIGlmICh0aGlzLndhaXRpbmdUcmFuc2FjdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9uSXNGbHVzaGVkKSB7XG4gICAgICAgICAgdGhpcy50cmFuc2FjdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZVxuICAgICAgICAgIHRoaXMudHJhbnNhY3Rpb25Jc0ZsdXNoZWQgPSBmYWxzZVxuICAgICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9uc0ZpbmlzaGVkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMudHJhbnNhY3Rpb25zRmluaXNoZWQucmVzb2x2ZSgpXG4gICAgICAgICAgICB0aGlzLnRyYW5zYWN0aW9uc0ZpbmlzaGVkID0gbnVsbFxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudHJhbnNhY3Rpb25Jc0ZsdXNoZWQgPSB0cnVlXG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICogKCkge1xuICAgICAgICAgICAgeWllbGQqIHRoaXMuZmx1c2goKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50cmFuc2FjdGlvbklzRmx1c2hlZCA9IGZhbHNlXG4gICAgICAgIHJldHVybiB0aGlzLndhaXRpbmdUcmFuc2FjdGlvbnMuc2hpZnQoKVxuICAgICAgfVxuICAgIH1cbiAgICByZXF1ZXN0VHJhbnNhY3Rpb24gKG1ha2VHZW4vKiA6YW55ICovLCBjYWxsSW1tZWRpYXRlbHkpIHtcbiAgICAgIHRoaXMud2FpdGluZ1RyYW5zYWN0aW9ucy5wdXNoKG1ha2VHZW4pXG4gICAgICBpZiAoIXRoaXMudHJhbnNhY3Rpb25JblByb2dyZXNzKSB7XG4gICAgICAgIHRoaXMudHJhbnNhY3Rpb25JblByb2dyZXNzID0gdHJ1ZVxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLnRyYW5zYWN0KHRoaXMuZ2V0TmV4dFJlcXVlc3QoKSlcbiAgICAgICAgfSwgMClcbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIEdldCBhIGNyZWF0ZWQvaW5pdGlhbGl6ZWQgdHlwZS5cbiAgICAqL1xuICAgIGdldFR5cGUgKGlkKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbml0aWFsaXplZFR5cGVzW0pTT04uc3RyaW5naWZ5KGlkKV1cbiAgICB9XG4gICAgLypcbiAgICAgIEluaXQgdHlwZS4gVGhpcyBpcyBjYWxsZWQgd2hlbiBhIHJlbW90ZSBvcGVyYXRpb24gaXMgcmV0cmlldmVkLCBhbmQgdHJhbnNmb3JtZWQgdG8gYSB0eXBlXG4gICAgICBUT0RPOiBkZWxldGUgdHlwZSBmcm9tIHN0b3JlLmluaXRpYWxpemVkVHlwZXNbaWRdIHdoZW4gY29ycmVzcG9uZGluZyBpZCB3YXMgZGVsZXRlZCFcbiAgICAqL1xuICAgICogaW5pdFR5cGUgKGlkLCBhcmdzKSB7XG4gICAgICB2YXIgc2lkID0gSlNPTi5zdHJpbmdpZnkoaWQpXG4gICAgICB2YXIgdCA9IHRoaXMuc3RvcmUuaW5pdGlhbGl6ZWRUeXBlc1tzaWRdXG4gICAgICBpZiAodCA9PSBudWxsKSB7XG4gICAgICAgIHZhciBvcC8qIDpNYXBTdHJ1Y3QgfCBMaXN0U3RydWN0ICovID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKGlkKVxuICAgICAgICBpZiAob3AgIT0gbnVsbCkge1xuICAgICAgICAgIHQgPSB5aWVsZCogWVtvcC50eXBlXS50eXBlRGVmaW5pdGlvbi5pbml0VHlwZS5jYWxsKHRoaXMsIHRoaXMuc3RvcmUsIG9wLCBhcmdzKVxuICAgICAgICAgIHRoaXMuc3RvcmUuaW5pdGlhbGl6ZWRUeXBlc1tzaWRdID0gdFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdFxuICAgIH1cbiAgICAvKlxuICAgICBDcmVhdGUgdHlwZS4gVGhpcyBpcyBjYWxsZWQgd2hlbiB0aGUgbG9jYWwgdXNlciBjcmVhdGVzIGEgdHlwZSAod2hpY2ggaXMgYSBzeW5jaHJvbm91cyBhY3Rpb24pXG4gICAgKi9cbiAgICBjcmVhdGVUeXBlICh0eXBlZGVmaW5pdGlvbiwgaWQpIHtcbiAgICAgIHZhciBzdHJ1Y3RuYW1lID0gdHlwZWRlZmluaXRpb25bMF0uc3RydWN0XG4gICAgICBpZCA9IGlkIHx8IHRoaXMuZ2V0TmV4dE9wSWQoMSlcbiAgICAgIHZhciBvcCA9IFkuU3RydWN0W3N0cnVjdG5hbWVdLmNyZWF0ZShpZClcbiAgICAgIG9wLnR5cGUgPSB0eXBlZGVmaW5pdGlvblswXS5uYW1lXG5cbiAgICAgIHRoaXMucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogKCkge1xuICAgICAgICBpZiAob3AuaWRbMF0gPT09ICdfJykge1xuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCogdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zKFtvcF0pXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICB2YXIgdCA9IFlbb3AudHlwZV0udHlwZURlZmluaXRpb24uY3JlYXRlVHlwZSh0aGlzLCBvcCwgdHlwZWRlZmluaXRpb25bMV0pXG4gICAgICB0aGlzLmluaXRpYWxpemVkVHlwZXNbSlNPTi5zdHJpbmdpZnkob3AuaWQpXSA9IHRcbiAgICAgIHJldHVybiB0XG4gICAgfVxuICB9XG4gIFkuQWJzdHJhY3REYXRhYmFzZSA9IEFic3RyYWN0RGF0YWJhc2Vcbn1cbiIsIi8qIEBmbG93ICovXG4ndXNlIHN0cmljdCdcblxuLypcbiBBbiBvcGVyYXRpb24gYWxzbyBkZWZpbmVzIHRoZSBzdHJ1Y3R1cmUgb2YgYSB0eXBlLiBUaGlzIGlzIHdoeSBvcGVyYXRpb24gYW5kXG4gc3RydWN0dXJlIGFyZSB1c2VkIGludGVyY2hhbmdlYWJseSBoZXJlLlxuXG4gSXQgbXVzdCBiZSBvZiB0aGUgdHlwZSBPYmplY3QuIEkgaG9wZSB0byBhY2hpZXZlIHNvbWUgcGVyZm9ybWFuY2VcbiBpbXByb3ZlbWVudHMgd2hlbiB3b3JraW5nIG9uIGRhdGFiYXNlcyB0aGF0IHN1cHBvcnQgdGhlIGpzb24gZm9ybWF0LlxuXG4gQW4gb3BlcmF0aW9uIG11c3QgaGF2ZSB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG5cbiAqIGVuY29kZVxuICAgICAtIEVuY29kZSB0aGUgc3RydWN0dXJlIGluIGEgcmVhZGFibGUgZm9ybWF0IChwcmVmZXJhYmx5IHN0cmluZy0gdG9kbylcbiAqIGRlY29kZSAodG9kbylcbiAgICAgLSBkZWNvZGUgc3RydWN0dXJlIHRvIGpzb25cbiAqIGV4ZWN1dGVcbiAgICAgLSBFeGVjdXRlIHRoZSBzZW1hbnRpY3Mgb2YgYW4gb3BlcmF0aW9uLlxuICogcmVxdWlyZWRPcHNcbiAgICAgLSBPcGVyYXRpb25zIHRoYXQgYXJlIHJlcXVpcmVkIHRvIGV4ZWN1dGUgdGhpcyBvcGVyYXRpb24uXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoWS8qIDphbnkgKi8pIHtcbiAgdmFyIFN0cnVjdCA9IHtcbiAgICAvKiBUaGlzIGlzIHRoZSBvbmx5IG9wZXJhdGlvbiB0aGF0IGlzIGFjdHVhbGx5IG5vdCBhIHN0cnVjdHVyZSwgYmVjYXVzZVxuICAgIGl0IGlzIG5vdCBzdG9yZWQgaW4gdGhlIE9TLiBUaGlzIGlzIHdoeSBpdCBfZG9lcyBub3RfIGhhdmUgYW4gaWRcblxuICAgIG9wID0ge1xuICAgICAgdGFyZ2V0OiBJZFxuICAgIH1cbiAgICAqL1xuICAgIERlbGV0ZToge1xuICAgICAgZW5jb2RlOiBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0YXJnZXQ6IG9wLnRhcmdldCxcbiAgICAgICAgICBsZW5ndGg6IG9wLmxlbmd0aCB8fCAwLFxuICAgICAgICAgIHN0cnVjdDogJ0RlbGV0ZSdcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJlcXVpcmVkT3BzOiBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgcmV0dXJuIFtdIC8vIFtvcC50YXJnZXRdXG4gICAgICB9LFxuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgcmV0dXJuIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbihvcC50YXJnZXQsIG9wLmxlbmd0aCB8fCAxKVxuICAgICAgfVxuICAgIH0sXG4gICAgSW5zZXJ0OiB7XG4gICAgICAvKiB7XG4gICAgICAgICAgY29udGVudDogW2FueV0sXG4gICAgICAgICAgb3BDb250ZW50OiBJZCxcbiAgICAgICAgICBpZDogSWQsXG4gICAgICAgICAgbGVmdDogSWQsXG4gICAgICAgICAgb3JpZ2luOiBJZCxcbiAgICAgICAgICByaWdodDogSWQsXG4gICAgICAgICAgcGFyZW50OiBJZCxcbiAgICAgICAgICBwYXJlbnRTdWI6IHN0cmluZyAob3B0aW9uYWwpLCAvLyBjaGlsZCBvZiBNYXAgdHlwZVxuICAgICAgICB9XG4gICAgICAqL1xuICAgICAgZW5jb2RlOiBmdW5jdGlvbiAob3AvKiA6SW5zZXJ0aW9uICovKSAvKiA6SW5zZXJ0aW9uICovIHtcbiAgICAgICAgLy8gVE9ETzogeW91IGNvdWxkIG5vdCBzZW5kIHRoZSBcImxlZnRcIiBwcm9wZXJ0eSwgdGhlbiB5b3UgYWxzbyBoYXZlIHRvXG4gICAgICAgIC8vIFwib3AubGVmdCA9IG51bGxcIiBpbiAkZXhlY3V0ZSBvciAkZGVjb2RlXG4gICAgICAgIHZhciBlLyogOmFueSAqLyA9IHtcbiAgICAgICAgICBpZDogb3AuaWQsXG4gICAgICAgICAgbGVmdDogb3AubGVmdCxcbiAgICAgICAgICByaWdodDogb3AucmlnaHQsXG4gICAgICAgICAgb3JpZ2luOiBvcC5vcmlnaW4sXG4gICAgICAgICAgcGFyZW50OiBvcC5wYXJlbnQsXG4gICAgICAgICAgc3RydWN0OiBvcC5zdHJ1Y3RcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AucGFyZW50U3ViICE9IG51bGwpIHtcbiAgICAgICAgICBlLnBhcmVudFN1YiA9IG9wLnBhcmVudFN1YlxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5oYXNPd25Qcm9wZXJ0eSgnb3BDb250ZW50JykpIHtcbiAgICAgICAgICBlLm9wQ29udGVudCA9IG9wLm9wQ29udGVudFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGUuY29udGVudCA9IG9wLmNvbnRlbnQuc2xpY2UoKVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVcbiAgICAgIH0sXG4gICAgICByZXF1aXJlZE9wczogZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgIHZhciBpZHMgPSBbXVxuICAgICAgICBpZiAob3AubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgaWRzLnB1c2gob3AubGVmdClcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgIGlkcy5wdXNoKG9wLnJpZ2h0KVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5vcmlnaW4gIT0gbnVsbCAmJiAhWS51dGlscy5jb21wYXJlSWRzKG9wLmxlZnQsIG9wLm9yaWdpbikpIHtcbiAgICAgICAgICBpZHMucHVzaChvcC5vcmlnaW4pXG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgKG9wLnJpZ2h0ID09IG51bGwgJiYgb3AubGVmdCA9PSBudWxsKSB7XG4gICAgICAgIGlkcy5wdXNoKG9wLnBhcmVudClcblxuICAgICAgICBpZiAob3Aub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBpZHMucHVzaChvcC5vcENvbnRlbnQpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlkc1xuICAgICAgfSxcbiAgICAgIGdldERpc3RhbmNlVG9PcmlnaW46IGZ1bmN0aW9uICogKG9wKSB7XG4gICAgICAgIGlmIChvcC5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gMFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBkID0gMFxuICAgICAgICAgIHZhciBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG9wLmxlZnQpXG4gICAgICAgICAgd2hpbGUgKCFZLnV0aWxzLm1hdGNoZXNJZChvLCBvcC5vcmlnaW4pKSB7XG4gICAgICAgICAgICBkKytcbiAgICAgICAgICAgIGlmIChvLmxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbyA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvLmxlZnQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAvKlxuICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgKi9cbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uICogKG9wKSB7XG4gICAgICAgIHZhciBpIC8vIGxvb3AgY291bnRlclxuXG4gICAgICAgIC8vIGR1cmluZyB0aGlzIGZ1bmN0aW9uIHNvbWUgb3BzIG1heSBnZXQgc3BsaXQgaW50byB0d28gcGllY2VzIChlLmcuIHdpdGggZ2V0SW5zZXJ0aW9uQ2xlYW5FbmQpXG4gICAgICAgIC8vIFdlIHRyeSB0byBtZXJnZSB0aGVtIGxhdGVyLCBpZiBwb3NzaWJsZVxuICAgICAgICB2YXIgdHJ5VG9SZW1lcmdlTGF0ZXIgPSBbXVxuXG4gICAgICAgIGlmIChvcC5vcmlnaW4gIT0gbnVsbCkgeyAvLyBUT0RPOiAhPT0gaW5zdGVhZCBvZiAhPVxuICAgICAgICAgIC8vIHdlIHNhdmUgaW4gb3JpZ2luIHRoYXQgb3Agb3JpZ2luYXRlcyBpbiBpdFxuICAgICAgICAgIC8vIHdlIG5lZWQgdGhhdCBsYXRlciB3aGVuIHdlIGV2ZW50dWFsbHkgZ2FyYmFnZSBjb2xsZWN0IG9yaWdpbiAoc2VlIHRyYW5zYWN0aW9uKVxuICAgICAgICAgIHZhciBvcmlnaW4gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChvcC5vcmlnaW4pXG4gICAgICAgICAgaWYgKG9yaWdpbi5vcmlnaW5PZiA9PSBudWxsKSB7XG4gICAgICAgICAgICBvcmlnaW4ub3JpZ2luT2YgPSBbXVxuICAgICAgICAgIH1cbiAgICAgICAgICBvcmlnaW4ub3JpZ2luT2YucHVzaChvcC5pZClcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ob3JpZ2luKVxuICAgICAgICAgIGlmIChvcmlnaW4ucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdHJ5VG9SZW1lcmdlTGF0ZXIucHVzaChvcmlnaW4ucmlnaHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBkaXN0YW5jZVRvT3JpZ2luID0gaSA9IHlpZWxkKiBTdHJ1Y3QuSW5zZXJ0LmdldERpc3RhbmNlVG9PcmlnaW4uY2FsbCh0aGlzLCBvcCkgLy8gbW9zdCBjYXNlczogMCAoc3RhcnRzIGZyb20gMClcblxuICAgICAgICAvLyBub3cgd2UgYmVnaW4gdG8gaW5zZXJ0IG9wIGluIHRoZSBsaXN0IG9mIGluc2VydGlvbnMuLlxuICAgICAgICB2YXIgb1xuICAgICAgICB2YXIgcGFyZW50XG4gICAgICAgIHZhciBzdGFydFxuXG4gICAgICAgIC8vIGZpbmQgby4gbyBpcyB0aGUgZmlyc3QgY29uZmxpY3Rpbmcgb3BlcmF0aW9uXG4gICAgICAgIGlmIChvcC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5FbmQob3AubGVmdClcbiAgICAgICAgICBpZiAoIVkudXRpbHMuY29tcGFyZUlkcyhvcC5sZWZ0LCBvcC5vcmlnaW4pICYmIG8ucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gb25seSBpZiBub3QgYWRkZWQgcHJldmlvdXNseVxuICAgICAgICAgICAgdHJ5VG9SZW1lcmdlTGF0ZXIucHVzaChvLnJpZ2h0KVxuICAgICAgICAgIH1cbiAgICAgICAgICBvID0gKG8ucmlnaHQgPT0gbnVsbCkgPyBudWxsIDogeWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG8ucmlnaHQpXG4gICAgICAgIH0gZWxzZSB7IC8vIGxlZnQgPT0gbnVsbFxuICAgICAgICAgIHBhcmVudCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5wYXJlbnQpXG4gICAgICAgICAgbGV0IHN0YXJ0SWQgPSBvcC5wYXJlbnRTdWIgPyBwYXJlbnQubWFwW29wLnBhcmVudFN1Yl0gOiBwYXJlbnQuc3RhcnRcbiAgICAgICAgICBzdGFydCA9IHN0YXJ0SWQgPT0gbnVsbCA/IG51bGwgOiB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oc3RhcnRJZClcbiAgICAgICAgICBvID0gc3RhcnRcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB0byBzcGxpdCBvcC5yaWdodCBpZiBuZWNlc3NhcnkgKGFsc28gYWRkIHRvIHRyeUNvbWJpbmVXaXRoTGVmdClcbiAgICAgICAgaWYgKG9wLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICB0cnlUb1JlbWVyZ2VMYXRlci5wdXNoKG9wLnJpZ2h0KVxuICAgICAgICAgIHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuU3RhcnQob3AucmlnaHQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYW5kbGUgY29uZmxpY3RzXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKG8gIT0gbnVsbCAmJiAhWS51dGlscy5jb21wYXJlSWRzKG8uaWQsIG9wLnJpZ2h0KSkge1xuICAgICAgICAgICAgdmFyIG9PcmlnaW5EaXN0YW5jZSA9IHlpZWxkKiBTdHJ1Y3QuSW5zZXJ0LmdldERpc3RhbmNlVG9PcmlnaW4uY2FsbCh0aGlzLCBvKVxuICAgICAgICAgICAgaWYgKG9PcmlnaW5EaXN0YW5jZSA9PT0gaSkge1xuICAgICAgICAgICAgICAvLyBjYXNlIDFcbiAgICAgICAgICAgICAgaWYgKG8uaWRbMF0gPCBvcC5pZFswXSkge1xuICAgICAgICAgICAgICAgIG9wLmxlZnQgPSBZLnV0aWxzLmdldExhc3RJZChvKVxuICAgICAgICAgICAgICAgIGRpc3RhbmNlVG9PcmlnaW4gPSBpICsgMSAvLyBqdXN0IGlnbm9yZSBvLmNvbnRlbnQubGVuZ3RoLCBkb2Vzbid0IG1ha2UgYSBkaWZmZXJlbmNlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAob09yaWdpbkRpc3RhbmNlIDwgaSkge1xuICAgICAgICAgICAgICAvLyBjYXNlIDJcbiAgICAgICAgICAgICAgaWYgKGkgLSBkaXN0YW5jZVRvT3JpZ2luIDw9IG9PcmlnaW5EaXN0YW5jZSkge1xuICAgICAgICAgICAgICAgIG9wLmxlZnQgPSBZLnV0aWxzLmdldExhc3RJZChvKVxuICAgICAgICAgICAgICAgIGRpc3RhbmNlVG9PcmlnaW4gPSBpICsgMSAvLyBqdXN0IGlnbm9yZSBvLmNvbnRlbnQubGVuZ3RoLCBkb2Vzbid0IG1ha2UgYSBkaWZmZXJlbmNlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKytcbiAgICAgICAgICAgIGlmIChvLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbyA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvLnJpZ2h0KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbyA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWNvbm5lY3QuLlxuICAgICAgICB2YXIgbGVmdCA9IG51bGxcbiAgICAgICAgdmFyIHJpZ2h0ID0gbnVsbFxuICAgICAgICBpZiAocGFyZW50ID09IG51bGwpIHtcbiAgICAgICAgICBwYXJlbnQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob3AucGFyZW50KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVjb25uZWN0IGxlZnQgYW5kIHNldCByaWdodCBvZiBvcFxuICAgICAgICBpZiAob3AubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgbGVmdCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvcC5sZWZ0KVxuICAgICAgICAgIC8vIGxpbmsgbGVmdFxuICAgICAgICAgIG9wLnJpZ2h0ID0gbGVmdC5yaWdodFxuICAgICAgICAgIGxlZnQucmlnaHQgPSBvcC5pZFxuXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKGxlZnQpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc2V0IG9wLnJpZ2h0IGZyb20gcGFyZW50LCBpZiBuZWNlc3NhcnlcbiAgICAgICAgICBvcC5yaWdodCA9IG9wLnBhcmVudFN1YiA/IHBhcmVudC5tYXBbb3AucGFyZW50U3ViXSB8fCBudWxsIDogcGFyZW50LnN0YXJ0XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVjb25uZWN0IHJpZ2h0XG4gICAgICAgIGlmIChvcC5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgLy8gVE9ETzogd2FubmEgY29ubmVjdCByaWdodCB0b28/XG4gICAgICAgICAgcmlnaHQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob3AucmlnaHQpXG4gICAgICAgICAgcmlnaHQubGVmdCA9IFkudXRpbHMuZ2V0TGFzdElkKG9wKVxuXG4gICAgICAgICAgLy8gaWYgcmlnaHQgZXhpc3RzLCBhbmQgaXQgaXMgc3VwcG9zZWQgdG8gYmUgZ2MnZC4gUmVtb3ZlIGl0IGZyb20gdGhlIGdjXG4gICAgICAgICAgaWYgKHJpZ2h0LmdjICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChyaWdodC5jb250ZW50ICE9IG51bGwgJiYgcmlnaHQuY29udGVudC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgIHJpZ2h0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5FbmQocmlnaHQuaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0b3JlLnJlbW92ZUZyb21HYXJiYWdlQ29sbGVjdG9yKHJpZ2h0KVxuICAgICAgICAgIH1cbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocmlnaHQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgcGFyZW50cyAubWFwL3N0YXJ0L2VuZCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChvcC5wYXJlbnRTdWIgIT0gbnVsbCkge1xuICAgICAgICAgIGlmIChsZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICAgIHBhcmVudC5tYXBbb3AucGFyZW50U3ViXSA9IG9wLmlkXG4gICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocGFyZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpcyBhIGNoaWxkIG9mIGEgbWFwIHN0cnVjdC5cbiAgICAgICAgICAvLyBUaGVuIGFsc28gbWFrZSBzdXJlIHRoYXQgb25seSB0aGUgbW9zdCBsZWZ0IGVsZW1lbnQgaXMgbm90IGRlbGV0ZWRcbiAgICAgICAgICAvLyBXZSBkbyBub3QgY2FsbCB0aGUgdHlwZSBpbiB0aGlzIGNhc2UgKHRoaXMgaXMgd2hhdCB0aGUgdGhpcmQgcGFyYW1ldGVyIGlzIGZvcilcbiAgICAgICAgICBpZiAob3AucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKG9wLnJpZ2h0LCAxLCB0cnVlKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3AubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24ob3AuaWQsIDEsIHRydWUpXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChyaWdodCA9PSBudWxsIHx8IGxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKHJpZ2h0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgcGFyZW50LmVuZCA9IFkudXRpbHMuZ2V0TGFzdElkKG9wKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICBwYXJlbnQuc3RhcnQgPSBvcC5pZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHBhcmVudClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0cnkgdG8gbWVyZ2Ugb3JpZ2luYWwgb3AubGVmdCBhbmQgb3Aub3JpZ2luXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0cnlUb1JlbWVyZ2VMYXRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBtID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKHRyeVRvUmVtZXJnZUxhdGVyW2ldKVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnRyeUNvbWJpbmVXaXRoTGVmdChtKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBMaXN0OiB7XG4gICAgICAvKlxuICAgICAge1xuICAgICAgICBzdGFydDogbnVsbCxcbiAgICAgICAgZW5kOiBudWxsLFxuICAgICAgICBzdHJ1Y3Q6IFwiTGlzdFwiLFxuICAgICAgICB0eXBlOiBcIlwiLFxuICAgICAgICBpZDogdGhpcy5vcy5nZXROZXh0T3BJZCgxKVxuICAgICAgfVxuICAgICAgKi9cbiAgICAgIGNyZWF0ZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhcnQ6IG51bGwsXG4gICAgICAgICAgZW5kOiBudWxsLFxuICAgICAgICAgIHN0cnVjdDogJ0xpc3QnLFxuICAgICAgICAgIGlkOiBpZFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZW5jb2RlOiBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgc3RydWN0OiAnTGlzdCcsXG4gICAgICAgICAgaWQ6IG9wLmlkLFxuICAgICAgICAgIHR5cGU6IG9wLnR5cGVcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AucmVxdWlyZXMgIT0gbnVsbCkge1xuICAgICAgICAgIGUucmVxdWlyZXMgPSBvcC5yZXF1aXJlc1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5pbmZvICE9IG51bGwpIHtcbiAgICAgICAgICBlLmluZm8gPSBvcC5pbmZvXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVcbiAgICAgIH0sXG4gICAgICByZXF1aXJlZE9wczogZnVuY3Rpb24gKCkge1xuICAgICAgICAvKlxuICAgICAgICB2YXIgaWRzID0gW11cbiAgICAgICAgaWYgKG9wLnN0YXJ0ICE9IG51bGwpIHtcbiAgICAgICAgICBpZHMucHVzaChvcC5zdGFydClcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuZW5kICE9IG51bGwpe1xuICAgICAgICAgIGlkcy5wdXNoKG9wLmVuZClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaWRzXG4gICAgICAgICovXG4gICAgICAgIHJldHVybiBbXVxuICAgICAgfSxcbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uICogKG9wKSB7XG4gICAgICAgIG9wLnN0YXJ0ID0gbnVsbFxuICAgICAgICBvcC5lbmQgPSBudWxsXG4gICAgICB9LFxuICAgICAgcmVmOiBmdW5jdGlvbiAqIChvcCwgcG9zKSB7XG4gICAgICAgIGlmIChvcC5zdGFydCA9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVzID0gbnVsbFxuICAgICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5zdGFydClcblxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGlmICghby5kZWxldGVkKSB7XG4gICAgICAgICAgICByZXMgPSBvXG4gICAgICAgICAgICBwb3MtLVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocG9zID49IDAgJiYgby5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG8ucmlnaHQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH0sXG4gICAgICBtYXA6IGZ1bmN0aW9uICogKG8sIGYpIHtcbiAgICAgICAgbyA9IG8uc3RhcnRcbiAgICAgICAgdmFyIHJlcyA9IFtdXG4gICAgICAgIHdoaWxlIChvICE9IG51bGwpIHsgLy8gVE9ETzogY2hhbmdlIHRvICE9IChhdCBsZWFzdCBzb21lIGNvbnZlbnRpb24pXG4gICAgICAgICAgdmFyIG9wZXJhdGlvbiA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvKVxuICAgICAgICAgIGlmICghb3BlcmF0aW9uLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGYob3BlcmF0aW9uKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgbyA9IG9wZXJhdGlvbi5yaWdodFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH1cbiAgICB9LFxuICAgIE1hcDoge1xuICAgICAgLypcbiAgICAgICAge1xuICAgICAgICAgIG1hcDoge30sXG4gICAgICAgICAgc3RydWN0OiBcIk1hcFwiLFxuICAgICAgICAgIHR5cGU6IFwiXCIsXG4gICAgICAgICAgaWQ6IHRoaXMub3MuZ2V0TmV4dE9wSWQoMSlcbiAgICAgICAgfVxuICAgICAgKi9cbiAgICAgIGNyZWF0ZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgIG1hcDoge30sXG4gICAgICAgICAgc3RydWN0OiAnTWFwJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZW5jb2RlOiBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgdmFyIGUgPSB7XG4gICAgICAgICAgc3RydWN0OiAnTWFwJyxcbiAgICAgICAgICB0eXBlOiBvcC50eXBlLFxuICAgICAgICAgIGlkOiBvcC5pZCxcbiAgICAgICAgICBtYXA6IHt9IC8vIG92ZXJ3cml0ZSBtYXAhIVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgZS5yZXF1aXJlcyA9IG9wLnJlcXVpcmVzXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmluZm8gIT0gbnVsbCkge1xuICAgICAgICAgIGUuaW5mbyA9IG9wLmluZm9cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZVxuICAgICAgfSxcbiAgICAgIHJlcXVpcmVkT3BzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBbXVxuICAgICAgfSxcbiAgICAgIGV4ZWN1dGU6IGZ1bmN0aW9uICogKCkge30sXG4gICAgICAvKlxuICAgICAgICBHZXQgYSBwcm9wZXJ0eSBieSBuYW1lXG4gICAgICAqL1xuICAgICAgZ2V0OiBmdW5jdGlvbiAqIChvcCwgbmFtZSkge1xuICAgICAgICB2YXIgb2lkID0gb3AubWFwW25hbWVdXG4gICAgICAgIGlmIChvaWQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciByZXMgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob2lkKVxuICAgICAgICAgIGlmIChyZXMgPT0gbnVsbCB8fCByZXMuZGVsZXRlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHZvaWQgMFxuICAgICAgICAgIH0gZWxzZSBpZiAocmVzLm9wQ29udGVudCA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmNvbnRlbnRbMF1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHlpZWxkKiB0aGlzLmdldFR5cGUocmVzLm9wQ29udGVudClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgWS5TdHJ1Y3QgPSBTdHJ1Y3Rcbn1cbiIsIi8qIEBmbG93ICovXG4ndXNlIHN0cmljdCdcblxuLypcbiAgUGFydGlhbCBkZWZpbml0aW9uIG9mIGEgdHJhbnNhY3Rpb25cblxuICBBIHRyYW5zYWN0aW9uIHByb3ZpZGVzIGFsbCB0aGUgdGhlIGFzeW5jIGZ1bmN0aW9uYWxpdHkgb24gYSBkYXRhYmFzZS5cblxuICBCeSBjb252ZW50aW9uLCBhIHRyYW5zYWN0aW9uIGhhcyB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gICogc3MgZm9yIFN0YXRlU2V0XG4gICogb3MgZm9yIE9wZXJhdGlvblN0b3JlXG4gICogZHMgZm9yIERlbGV0ZVN0b3JlXG5cbiAgQSB0cmFuc2FjdGlvbiBtdXN0IGFsc28gZGVmaW5lIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgKiBjaGVja0RlbGV0ZVN0b3JlRm9yU3RhdGUoc3RhdGUpXG4gICAgLSBXaGVuIGluY3JlYXNpbmcgdGhlIHN0YXRlIG9mIGEgdXNlciwgYW4gb3BlcmF0aW9uIHdpdGggYW4gaGlnaGVyIGlkXG4gICAgICBtYXkgYWxyZWFkeSBiZSBnYXJiYWdlIGNvbGxlY3RlZCwgYW5kIHRoZXJlZm9yZSBpdCB3aWxsIG5ldmVyIGJlIHJlY2VpdmVkLlxuICAgICAgdXBkYXRlIHRoZSBzdGF0ZSB0byByZWZsZWN0IHRoaXMga25vd2xlZGdlLiBUaGlzIHdvbid0IGNhbGwgYSBtZXRob2QgdG8gc2F2ZSB0aGUgc3RhdGUhXG4gICogZ2V0RGVsZXRlU2V0KGlkKVxuICAgIC0gR2V0IHRoZSBkZWxldGUgc2V0IGluIGEgcmVhZGFibGUgZm9ybWF0OlxuICAgICAge1xuICAgICAgICBcInVzZXJYXCI6IFtcbiAgICAgICAgICBbNSwxXSwgLy8gc3RhcnRpbmcgZnJvbSBwb3NpdGlvbiA1LCBvbmUgb3BlcmF0aW9ucyBpcyBkZWxldGVkXG4gICAgICAgICAgWzksNF0gIC8vIHN0YXJ0aW5nIGZyb20gcG9zaXRpb24gOSwgZm91ciBvcGVyYXRpb25zIGFyZSBkZWxldGVkXG4gICAgICAgIF0sXG4gICAgICAgIFwidXNlcllcIjogLi4uXG4gICAgICB9XG4gICogZ2V0T3BzRnJvbURlbGV0ZVNldChkcykgLS0gVE9ETzoganVzdCBjYWxsIHRoaXMuZGVsZXRlT3BlcmF0aW9uKGlkKSBoZXJlXG4gICAgLSBnZXQgYSBzZXQgb2YgZGVsZXRpb25zIHRoYXQgbmVlZCB0byBiZSBhcHBsaWVkIGluIG9yZGVyIHRvIGdldCB0b1xuICAgICAgYWNoaWV2ZSB0aGUgc3RhdGUgb2YgdGhlIHN1cHBsaWVkIGRzXG4gICogc2V0T3BlcmF0aW9uKG9wKVxuICAgIC0gd3JpdGUgYG9wYCB0byB0aGUgZGF0YWJhc2UuXG4gICAgICBOb3RlOiB0aGlzIGlzIGFsbG93ZWQgdG8gcmV0dXJuIGFuIGluLW1lbW9yeSBvYmplY3QuXG4gICAgICBFLmcuIHRoZSBNZW1vcnkgYWRhcHRlciByZXR1cm5zIHRoZSBvYmplY3QgdGhhdCBpdCBoYXMgaW4tbWVtb3J5LlxuICAgICAgQ2hhbmdpbmcgdmFsdWVzIG9uIHRoaXMgb2JqZWN0IHdpbGwgYmUgc3RvcmVkIGRpcmVjdGx5IGluIHRoZSBkYXRhYmFzZVxuICAgICAgd2l0aG91dCBjYWxsaW5nIHRoaXMgZnVuY3Rpb24uIFRoZXJlZm9yZSxcbiAgICAgIHNldE9wZXJhdGlvbiBtYXkgaGF2ZSBubyBmdW5jdGlvbmFsaXR5IGluIHNvbWUgYWRhcHRlcnMuIFRoaXMgYWxzbyBoYXNcbiAgICAgIGltcGxpY2F0aW9ucyBvbiB0aGUgd2F5IHdlIHVzZSBvcGVyYXRpb25zIHRoYXQgd2VyZSBzZXJ2ZWQgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAgICBXZSB0cnkgbm90IHRvIGNhbGwgY29weU9iamVjdCwgaWYgbm90IG5lY2Vzc2FyeS5cbiAgKiBhZGRPcGVyYXRpb24ob3ApXG4gICAgLSBhZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBkYXRhYmFzZS5cbiAgICAgIFRoaXMgbWF5IG9ubHkgYmUgY2FsbGVkIG9uY2UgZm9yIGV2ZXJ5IG9wLmlkXG4gICAgICBNdXN0IHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgbmV4dCBvcGVyYXRpb24gaW4gdGhlIGRhdGFiYXNlIChvcmRlcmVkIGJ5IGlkKVxuICAqIGdldE9wZXJhdGlvbihpZClcbiAgKiByZW1vdmVPcGVyYXRpb24oaWQpXG4gICAgLSByZW1vdmUgYW4gb3BlcmF0aW9uIGZyb20gdGhlIGRhdGFiYXNlLiBUaGlzIGlzIGNhbGxlZCB3aGVuIGFuIG9wZXJhdGlvblxuICAgICAgaXMgZ2FyYmFnZSBjb2xsZWN0ZWQuXG4gICogc2V0U3RhdGUoc3RhdGUpXG4gICAgLSBgc3RhdGVgIGlzIG9mIHRoZSBmb3JtXG4gICAgICB7XG4gICAgICAgIHVzZXI6IFwiMVwiLFxuICAgICAgICBjbG9jazogNFxuICAgICAgfSA8LSBtZWFuaW5nIHRoYXQgd2UgaGF2ZSBmb3VyIG9wZXJhdGlvbnMgZnJvbSB1c2VyIFwiMVwiXG4gICAgICAgICAgICh3aXRoIHRoZXNlIGlkJ3MgcmVzcGVjdGl2ZWx5OiAwLCAxLCAyLCBhbmQgMylcbiAgKiBnZXRTdGF0ZSh1c2VyKVxuICAqIGdldFN0YXRlVmVjdG9yKClcbiAgICAtIEdldCB0aGUgc3RhdGUgb2YgdGhlIE9TIGluIHRoZSBmb3JtXG4gICAgW3tcbiAgICAgIHVzZXI6IFwidXNlclhcIixcbiAgICAgIGNsb2NrOiAxMVxuICAgIH0sXG4gICAgIC4uXG4gICAgXVxuICAqIGdldFN0YXRlU2V0KClcbiAgICAtIEdldCB0aGUgc3RhdGUgb2YgdGhlIE9TIGluIHRoZSBmb3JtXG4gICAge1xuICAgICAgXCJ1c2VyWFwiOiAxMSxcbiAgICAgIFwidXNlcllcIjogMjJcbiAgICB9XG4gICAqIGdldE9wZXJhdGlvbnMoc3RhcnRTUylcbiAgICAgLSBHZXQgdGhlIGFsbCB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gYWNoaXZlIHRoZVxuICAgICAgIHN0YXRlU2V0IG9mIHRoaXMgdXNlciwgc3RhcnRpbmcgZnJvbSBhIHN0YXRlU2V0IHN1cHBsaWVkIGJ5IGFub3RoZXIgdXNlclxuICAgKiBtYWtlT3BlcmF0aW9uUmVhZHkoc3MsIG9wKVxuICAgICAtIHRoaXMgaXMgY2FsbGVkIG9ubHkgYnkgYGdldE9wZXJhdGlvbnMoc3RhcnRTUylgLiBJdCBtYWtlcyBhbiBvcGVyYXRpb25cbiAgICAgICBhcHBseWFibGUgb24gYSBnaXZlbiBTUy5cbiovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChZLyogOmFueSAqLykge1xuICBjbGFzcyBUcmFuc2FjdGlvbkludGVyZmFjZSB7XG4gICAgLyogOjpcbiAgICBzdG9yZTogWS5BYnN0cmFjdERhdGFiYXNlO1xuICAgIGRzOiBTdG9yZTtcbiAgICBvczogU3RvcmU7XG4gICAgc3M6IFN0b3JlO1xuICAgICovXG4gICAgLypcbiAgICAgIEFwcGx5IG9wZXJhdGlvbnMgdGhhdCB0aGlzIHVzZXIgY3JlYXRlZCAobm8gcmVtb3RlIG9uZXMhKVxuICAgICAgICAqIGRvZXMgbm90IGNoZWNrIGZvciBTdHJ1Y3QuKi5yZXF1aXJlZE9wcygpXG4gICAgICAgICogYWxzbyBicm9hZGNhc3RzIGl0IHRocm91Z2ggdGhlIGNvbm5lY3RvclxuICAgICovXG4gICAgKiBhcHBseUNyZWF0ZWRPcGVyYXRpb25zIChvcHMpIHtcbiAgICAgIHZhciBzZW5kID0gW11cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvcCA9IG9wc1tpXVxuICAgICAgICB5aWVsZCogdGhpcy5zdG9yZS50cnlFeGVjdXRlLmNhbGwodGhpcywgb3ApXG4gICAgICAgIGlmIChvcC5pZCA9PSBudWxsIHx8IHR5cGVvZiBvcC5pZFsxXSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBzZW5kLnB1c2goWS5TdHJ1Y3Rbb3Auc3RydWN0XS5lbmNvZGUob3ApKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VuZC5sZW5ndGggPiAwKSB7IC8vIFRPRE86ICYmICF0aGlzLnN0b3JlLmZvcndhcmRBcHBsaWVkT3BlcmF0aW9ucyAoYnV0IHRoZW4gaSBkb24ndCBzZW5kIGRlbGV0ZSBvcHMpXG4gICAgICAgIC8vIGlzIGNvbm5lY3RlZCwgYW5kIHRoaXMgaXMgbm90IGdvaW5nIHRvIGJlIHNlbmQgaW4gYWRkT3BlcmF0aW9uXG4gICAgICAgIHRoaXMuc3RvcmUueS5jb25uZWN0b3IuYnJvYWRjYXN0T3BzKHNlbmQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgKiBkZWxldGVMaXN0IChzdGFydCkge1xuICAgICAgd2hpbGUgKHN0YXJ0ICE9IG51bGwpIHtcbiAgICAgICAgc3RhcnQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oc3RhcnQpXG4gICAgICAgIGlmICghc3RhcnQuZ2MpIHtcbiAgICAgICAgICBzdGFydC5nYyA9IHRydWVcbiAgICAgICAgICBzdGFydC5kZWxldGVkID0gdHJ1ZVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihzdGFydClcbiAgICAgICAgICB2YXIgZGVsTGVuZ3RoID0gc3RhcnQuY29udGVudCAhPSBudWxsID8gc3RhcnQuY29udGVudC5sZW5ndGggOiAxXG4gICAgICAgICAgeWllbGQqIHRoaXMubWFya0RlbGV0ZWQoc3RhcnQuaWQsIGRlbExlbmd0aClcbiAgICAgICAgICBpZiAoc3RhcnQub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbihzdGFydC5vcENvbnRlbnQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuc3RvcmUucXVldWVHYXJiYWdlQ29sbGVjdG9yKHN0YXJ0LmlkKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gc3RhcnQucmlnaHRcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgTWFyayBhbiBvcGVyYXRpb24gYXMgZGVsZXRlZCwgYW5kIGFkZCBpdCB0byB0aGUgR0MsIGlmIHBvc3NpYmxlLlxuICAgICovXG4gICAgKiBkZWxldGVPcGVyYXRpb24gKHRhcmdldElkLCBsZW5ndGgsIHByZXZlbnRDYWxsVHlwZSkgLyogOkdlbmVyYXRvcjxhbnksIGFueSwgYW55PiAqLyB7XG4gICAgICBpZiAobGVuZ3RoID09IG51bGwpIHtcbiAgICAgICAgbGVuZ3RoID0gMVxuICAgICAgfVxuICAgICAgeWllbGQqIHRoaXMubWFya0RlbGV0ZWQodGFyZ2V0SWQsIGxlbmd0aClcbiAgICAgIHdoaWxlIChsZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBjYWxsVHlwZSA9IGZhbHNlXG4gICAgICAgIHZhciB0YXJnZXQgPSB5aWVsZCogdGhpcy5vcy5maW5kV2l0aFVwcGVyQm91bmQoW3RhcmdldElkWzBdLCB0YXJnZXRJZFsxXSArIGxlbmd0aCAtIDFdKVxuICAgICAgICB2YXIgdGFyZ2V0TGVuZ3RoID0gdGFyZ2V0ICE9IG51bGwgJiYgdGFyZ2V0LmNvbnRlbnQgIT0gbnVsbCA/IHRhcmdldC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgICAgaWYgKHRhcmdldCA9PSBudWxsIHx8IHRhcmdldC5pZFswXSAhPT0gdGFyZ2V0SWRbMF0gfHwgdGFyZ2V0LmlkWzFdICsgdGFyZ2V0TGVuZ3RoIDw9IHRhcmdldElkWzFdKSB7XG4gICAgICAgICAgLy8gZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IGluIHRoZSByYW5nZSBvZiB0aGUgZGVsZXRpb25cbiAgICAgICAgICB0YXJnZXQgPSBudWxsXG4gICAgICAgICAgbGVuZ3RoID0gMFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGRvZXMgZXhpc3QsIGNoZWNrIGlmIGl0IGlzIHRvbyBsb25nXG4gICAgICAgICAgaWYgKCF0YXJnZXQuZGVsZXRlZCkge1xuICAgICAgICAgICAgaWYgKHRhcmdldC5pZFsxXSA8IHRhcmdldElkWzFdKSB7XG4gICAgICAgICAgICAgIC8vIHN0YXJ0cyB0byB0aGUgbGVmdCBvZiB0aGUgZGVsZXRpb24gcmFuZ2VcbiAgICAgICAgICAgICAgdGFyZ2V0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydCh0YXJnZXRJZClcbiAgICAgICAgICAgICAgdGFyZ2V0TGVuZ3RoID0gdGFyZ2V0LmNvbnRlbnQubGVuZ3RoIC8vIG11c3QgaGF2ZSBjb250ZW50IHByb3BlcnR5IVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldC5pZFsxXSArIHRhcmdldExlbmd0aCA+IHRhcmdldElkWzFdICsgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgIC8vIGVuZHMgdG8gdGhlIHJpZ2h0IG9mIHRoZSBkZWxldGlvbiByYW5nZVxuICAgICAgICAgICAgICB0YXJnZXQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChbdGFyZ2V0SWRbMF0sIHRhcmdldElkWzFdICsgbGVuZ3RoIC0gMV0pXG4gICAgICAgICAgICAgIHRhcmdldExlbmd0aCA9IHRhcmdldC5jb250ZW50Lmxlbmd0aFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZW5ndGggPSB0YXJnZXQuaWRbMV0gLSB0YXJnZXRJZFsxXVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRhcmdldCAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKCF0YXJnZXQuZGVsZXRlZCkge1xuICAgICAgICAgICAgY2FsbFR5cGUgPSB0cnVlXG4gICAgICAgICAgICAvLyBzZXQgZGVsZXRlZCAmIG5vdGlmeSB0eXBlXG4gICAgICAgICAgICB0YXJnZXQuZGVsZXRlZCA9IHRydWVcbiAgICAgICAgICAgIC8vIGRlbGV0ZSBjb250YWluaW5nIGxpc3RzXG4gICAgICAgICAgICBpZiAodGFyZ2V0LnN0YXJ0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gVE9ETzogZG9uJ3QgZG8gaXQgbGlrZSB0aGlzIC4uIC0uLVxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVMaXN0KHRhcmdldC5zdGFydClcbiAgICAgICAgICAgICAgLy8geWllbGQqIHRoaXMuZGVsZXRlTGlzdCh0YXJnZXQuaWQpIC0tIGRvIG5vdCBnYyBpdHNlbGYgYmVjYXVzZSB0aGlzIG1heSBzdGlsbCBnZXQgcmVmZXJlbmNlZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldC5tYXAgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRhcmdldC5tYXApIHtcbiAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVMaXN0KHRhcmdldC5tYXBbbmFtZV0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gVE9ETzogaGVyZSB0by4uICAoc2VlIGFib3ZlKVxuICAgICAgICAgICAgICAvLyB5aWVsZCogdGhpcy5kZWxldGVMaXN0KHRhcmdldC5pZCkgLS0gc2VlIGFib3ZlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFyZ2V0Lm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbih0YXJnZXQub3BDb250ZW50KVxuICAgICAgICAgICAgICAvLyB0YXJnZXQub3BDb250ZW50ID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldC5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0LnJlcXVpcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKHRhcmdldC5yZXF1aXJlc1tpXSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgbGVmdFxuICAgICAgICAgIGlmICh0YXJnZXQubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBsZWZ0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKHRhcmdldC5sZWZ0KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZWZ0ID0gbnVsbFxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHNldCBoZXJlIGJlY2F1c2UgaXQgd2FzIGRlbGV0ZWQgYW5kL29yIGdjJ2RcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24odGFyZ2V0KVxuXG4gICAgICAgICAgLypcbiAgICAgICAgICAgIENoZWNrIGlmIGl0IGlzIHBvc3NpYmxlIHRvIGFkZCByaWdodCB0byB0aGUgZ2MuXG4gICAgICAgICAgICBCZWNhdXNlIHRoaXMgZGVsZXRlIGNhbid0IGJlIHJlc3BvbnNpYmxlIGZvciBsZWZ0IGJlaW5nIGdjJ2QsXG4gICAgICAgICAgICB3ZSBkb24ndCBoYXZlIHRvIGFkZCBsZWZ0IHRvIHRoZSBnYy4uXG4gICAgICAgICAgKi9cbiAgICAgICAgICB2YXIgcmlnaHRcbiAgICAgICAgICBpZiAodGFyZ2V0LnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJpZ2h0ID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKHRhcmdldC5yaWdodClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmlnaHQgPSBudWxsXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjYWxsVHlwZSAmJiAhcHJldmVudENhbGxUeXBlKSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5zdG9yZS5vcGVyYXRpb25BZGRlZCh0aGlzLCB7XG4gICAgICAgICAgICAgIHN0cnVjdDogJ0RlbGV0ZScsXG4gICAgICAgICAgICAgIHRhcmdldDogdGFyZ2V0LmlkLFxuICAgICAgICAgICAgICBsZW5ndGg6IHRhcmdldExlbmd0aCxcbiAgICAgICAgICAgICAgdGFyZ2V0UGFyZW50OiB0YXJnZXQucGFyZW50XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBuZWVkIHRvIGdjIGluIHRoZSBlbmQhXG4gICAgICAgICAgeWllbGQqIHRoaXMuc3RvcmUuYWRkVG9HYXJiYWdlQ29sbGVjdG9yLmNhbGwodGhpcywgdGFyZ2V0LCBsZWZ0KVxuICAgICAgICAgIGlmIChyaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5zdG9yZS5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IuY2FsbCh0aGlzLCByaWdodCwgdGFyZ2V0KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgTWFyayBhbiBvcGVyYXRpb24gYXMgZGVsZXRlZCZnYydkXG4gICAgKi9cbiAgICAqIG1hcmtHYXJiYWdlQ29sbGVjdGVkIChpZCwgbGVuKSB7XG4gICAgICAvLyB0aGlzLm1lbS5wdXNoKFtcImdjXCIsIGlkXSk7XG4gICAgICB0aGlzLnN0b3JlLmFkZFRvRGVidWcoJ3lpZWxkKiB0aGlzLm1hcmtHYXJiYWdlQ29sbGVjdGVkKCcsIGlkLCAnLCAnLCBsZW4sICcpJylcbiAgICAgIHZhciBuID0geWllbGQqIHRoaXMubWFya0RlbGV0ZWQoaWQsIGxlbilcbiAgICAgIGlmIChuLmlkWzFdIDwgaWRbMV0gJiYgIW4uZ2MpIHtcbiAgICAgICAgLy8gdW4tZXh0ZW5kIGxlZnRcbiAgICAgICAgdmFyIG5ld2xlbiA9IG4ubGVuIC0gKGlkWzFdIC0gbi5pZFsxXSlcbiAgICAgICAgbi5sZW4gLT0gbmV3bGVuXG4gICAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKVxuICAgICAgICBuID0ge2lkOiBpZCwgbGVuOiBuZXdsZW4sIGdjOiBmYWxzZX1cbiAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pXG4gICAgICB9XG4gICAgICAvLyBnZXQgcHJldiZuZXh0IGJlZm9yZSBhZGRpbmcgYSBuZXcgb3BlcmF0aW9uXG4gICAgICB2YXIgcHJldiA9IHlpZWxkKiB0aGlzLmRzLmZpbmRQcmV2KGlkKVxuICAgICAgdmFyIG5leHQgPSB5aWVsZCogdGhpcy5kcy5maW5kTmV4dChpZClcblxuICAgICAgaWYgKGlkWzFdICsgbGVuIDwgbi5pZFsxXSArIG4ubGVuICYmICFuLmdjKSB7XG4gICAgICAgIC8vIHVuLWV4dGVuZCByaWdodFxuICAgICAgICB5aWVsZCogdGhpcy5kcy5wdXQoe2lkOiBbaWRbMF0sIGlkWzFdICsgbGVuXSwgbGVuOiBuLmxlbiAtIGxlbiwgZ2M6IGZhbHNlfSlcbiAgICAgICAgbi5sZW4gPSBsZW5cbiAgICAgIH1cbiAgICAgIC8vIHNldCBnYydkXG4gICAgICBuLmdjID0gdHJ1ZVxuICAgICAgLy8gY2FuIGV4dGVuZCBsZWZ0P1xuICAgICAgaWYgKFxuICAgICAgICBwcmV2ICE9IG51bGwgJiZcbiAgICAgICAgcHJldi5nYyAmJlxuICAgICAgICBZLnV0aWxzLmNvbXBhcmVJZHMoW3ByZXYuaWRbMF0sIHByZXYuaWRbMV0gKyBwcmV2Lmxlbl0sIG4uaWQpXG4gICAgICApIHtcbiAgICAgICAgcHJldi5sZW4gKz0gbi5sZW5cbiAgICAgICAgeWllbGQqIHRoaXMuZHMuZGVsZXRlKG4uaWQpXG4gICAgICAgIG4gPSBwcmV2XG4gICAgICAgIC8vIGRzLnB1dCBuIGhlcmU/XG4gICAgICB9XG4gICAgICAvLyBjYW4gZXh0ZW5kIHJpZ2h0P1xuICAgICAgaWYgKFxuICAgICAgICBuZXh0ICE9IG51bGwgJiZcbiAgICAgICAgbmV4dC5nYyAmJlxuICAgICAgICBZLnV0aWxzLmNvbXBhcmVJZHMoW24uaWRbMF0sIG4uaWRbMV0gKyBuLmxlbl0sIG5leHQuaWQpXG4gICAgICApIHtcbiAgICAgICAgbi5sZW4gKz0gbmV4dC5sZW5cbiAgICAgICAgeWllbGQqIHRoaXMuZHMuZGVsZXRlKG5leHQuaWQpXG4gICAgICB9XG4gICAgICB5aWVsZCogdGhpcy5kcy5wdXQobilcbiAgICAgIHlpZWxkKiB0aGlzLnVwZGF0ZVN0YXRlKG4uaWRbMF0pXG4gICAgfVxuICAgIC8qXG4gICAgICBNYXJrIGFuIG9wZXJhdGlvbiBhcyBkZWxldGVkLlxuXG4gICAgICByZXR1cm5zIHRoZSBkZWxldGUgbm9kZVxuICAgICovXG4gICAgKiBtYXJrRGVsZXRlZCAoaWQsIGxlbmd0aCkge1xuICAgICAgaWYgKGxlbmd0aCA9PSBudWxsKSB7XG4gICAgICAgIGxlbmd0aCA9IDFcbiAgICAgIH1cbiAgICAgIC8vIHRoaXMubWVtLnB1c2goW1wiZGVsXCIsIGlkXSk7XG4gICAgICB2YXIgbiA9IHlpZWxkKiB0aGlzLmRzLmZpbmRXaXRoVXBwZXJCb3VuZChpZClcbiAgICAgIGlmIChuICE9IG51bGwgJiYgbi5pZFswXSA9PT0gaWRbMF0pIHtcbiAgICAgICAgaWYgKG4uaWRbMV0gPD0gaWRbMV0gJiYgaWRbMV0gPD0gbi5pZFsxXSArIG4ubGVuKSB7XG4gICAgICAgICAgLy8gaWQgaXMgaW4gbidzIHJhbmdlXG4gICAgICAgICAgdmFyIGRpZmYgPSBpZFsxXSArIGxlbmd0aCAtIChuLmlkWzFdICsgbi5sZW4pIC8vIG92ZXJsYXBwaW5nIHJpZ2h0XG4gICAgICAgICAgaWYgKGRpZmYgPiAwKSB7XG4gICAgICAgICAgICAvLyBpZCtsZW5ndGggb3ZlcmxhcHMgblxuICAgICAgICAgICAgaWYgKCFuLmdjKSB7XG4gICAgICAgICAgICAgIG4ubGVuICs9IGRpZmZcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRpZmYgPSBuLmlkWzFdICsgbi5sZW4gLSBpZFsxXSAvLyBvdmVybGFwcGluZyBsZWZ0IChpZCB0aWxsIG4uZW5kKVxuICAgICAgICAgICAgICBpZiAoZGlmZiA8IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIGEgcGFydGlhbCBkZWxldGlvblxuICAgICAgICAgICAgICAgIG4gPSB7aWQ6IFtpZFswXSwgaWRbMV0gKyBkaWZmXSwgbGVuOiBsZW5ndGggLSBkaWZmLCBnYzogZmFsc2V9XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYWxyZWFkeSBnYydkXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgaGFwcGVuISAoaXQgZGl0IHRob3VnaC4uIDooKScpXG4gICAgICAgICAgICAgICAgLy8gcmV0dXJuIG5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBvdmVybGFwcGluZywgYWxyZWFkeSBkZWxldGVkXG4gICAgICAgICAgICByZXR1cm4gblxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBjYW5ub3QgZXh0ZW5kIGxlZnQgKHRoZXJlIGlzIG5vIGxlZnQhKVxuICAgICAgICAgIG4gPSB7aWQ6IGlkLCBsZW46IGxlbmd0aCwgZ2M6IGZhbHNlfVxuICAgICAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKSAvLyBUT0RPOiB5b3UgZG91YmxlLXB1dCAhIVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjYW5ub3QgZXh0ZW5kIGxlZnRcbiAgICAgICAgbiA9IHtpZDogaWQsIGxlbjogbGVuZ3RoLCBnYzogZmFsc2V9XG4gICAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKVxuICAgICAgfVxuICAgICAgLy8gY2FuIGV4dGVuZCByaWdodD9cbiAgICAgIHZhciBuZXh0ID0geWllbGQqIHRoaXMuZHMuZmluZE5leHQobi5pZClcbiAgICAgIGlmIChcbiAgICAgICAgbmV4dCAhPSBudWxsICYmXG4gICAgICAgIG4uaWRbMF0gPT09IG5leHQuaWRbMF0gJiZcbiAgICAgICAgbi5pZFsxXSArIG4ubGVuID49IG5leHQuaWRbMV1cbiAgICAgICkge1xuICAgICAgICBkaWZmID0gbi5pZFsxXSArIG4ubGVuIC0gbmV4dC5pZFsxXSAvLyBmcm9tIG5leHQuc3RhcnQgdG8gbi5lbmRcbiAgICAgICAgd2hpbGUgKGRpZmYgPj0gMCkge1xuICAgICAgICAgIC8vIG4gb3ZlcmxhcHMgd2l0aCBuZXh0XG4gICAgICAgICAgaWYgKG5leHQuZ2MpIHtcbiAgICAgICAgICAgIC8vIGdjIGlzIHN0cm9uZ2VyLCBzbyByZWR1Y2UgbGVuZ3RoIG9mIG5cbiAgICAgICAgICAgIG4ubGVuIC09IGRpZmZcbiAgICAgICAgICAgIGlmIChkaWZmID49IG5leHQubGVuKSB7XG4gICAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgbWlzc2luZyByYW5nZSBhZnRlciBuZXh0XG4gICAgICAgICAgICAgIGRpZmYgPSBkaWZmIC0gbmV4dC5sZW4gLy8gbWlzc2luZyByYW5nZSBhZnRlciBuZXh0XG4gICAgICAgICAgICAgIGlmIChkaWZmID4gMCkge1xuICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKSAvLyB1bm5lY2Nlc3Nhcnk/IFRPRE8hXG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMubWFya0RlbGV0ZWQoW25leHQuaWRbMF0sIG5leHQuaWRbMV0gKyBuZXh0Lmxlbl0sIGRpZmYpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHdlIGNhbiBleHRlbmQgbiB3aXRoIG5leHRcbiAgICAgICAgICAgIGlmIChkaWZmID4gbmV4dC5sZW4pIHtcbiAgICAgICAgICAgICAgLy8gbiBpcyBldmVuIGxvbmdlciB0aGFuIG5leHRcbiAgICAgICAgICAgICAgLy8gZ2V0IG5leHQubmV4dCwgYW5kIHRyeSB0byBleHRlbmQgaXRcbiAgICAgICAgICAgICAgdmFyIF9uZXh0ID0geWllbGQqIHRoaXMuZHMuZmluZE5leHQobmV4dC5pZClcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZHMuZGVsZXRlKG5leHQuaWQpXG4gICAgICAgICAgICAgIGlmIChfbmV4dCA9PSBudWxsIHx8IG4uaWRbMF0gIT09IF9uZXh0LmlkWzBdKSB7XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0ID0gX25leHRcbiAgICAgICAgICAgICAgICBkaWZmID0gbi5pZFsxXSArIG4ubGVuIC0gbmV4dC5pZFsxXSAvLyBmcm9tIG5leHQuc3RhcnQgdG8gbi5lbmRcbiAgICAgICAgICAgICAgICAvLyBjb250aW51ZSFcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gbiBqdXN0IHBhcnRpYWxseSBvdmVybGFwcyB3aXRoIG5leHQuIGV4dGVuZCBuLCBkZWxldGUgbmV4dCwgYW5kIGJyZWFrIHRoaXMgbG9vcFxuICAgICAgICAgICAgICBuLmxlbiArPSBuZXh0LmxlbiAtIGRpZmZcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZHMuZGVsZXRlKG5leHQuaWQpXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCogdGhpcy5kcy5wdXQobilcbiAgICAgIHJldHVybiBuXG4gICAgfVxuICAgIC8qXG4gICAgICBDYWxsIHRoaXMgbWV0aG9kIHdoZW4gdGhlIGNsaWVudCBpcyBjb25uZWN0ZWQmc3luY2VkIHdpdGggdGhlXG4gICAgICBvdGhlciBjbGllbnRzIChlLmcuIG1hc3RlcikuIFRoaXMgd2lsbCBxdWVyeSB0aGUgZGF0YWJhc2UgZm9yXG4gICAgICBvcGVyYXRpb25zIHRoYXQgY2FuIGJlIGdjJ2QgYW5kIGFkZCB0aGVtIHRvIHRoZSBnYXJiYWdlIGNvbGxlY3Rvci5cbiAgICAqL1xuICAgICogZ2FyYmFnZUNvbGxlY3RBZnRlclN5bmMgKCkge1xuICAgICAgaWYgKHRoaXMuc3RvcmUuZ2MxLmxlbmd0aCA+IDAgfHwgdGhpcy5zdG9yZS5nYzIubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ2djIHNob3VsZCBiZSBlbXB0eSBhZnRlciBzeW5jJylcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5zdG9yZS5nYykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHlpZWxkKiB0aGlzLm9zLml0ZXJhdGUodGhpcywgbnVsbCwgbnVsbCwgZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgaWYgKG9wLmdjKSB7XG4gICAgICAgICAgZGVsZXRlIG9wLmdjXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9wKVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBwYXJlbnREZWxldGVkID0geWllbGQqIHRoaXMuaXNEZWxldGVkKG9wLnBhcmVudClcbiAgICAgICAgICBpZiAocGFyZW50RGVsZXRlZCkge1xuICAgICAgICAgICAgb3AuZ2MgPSB0cnVlXG4gICAgICAgICAgICBpZiAoIW9wLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMubWFya0RlbGV0ZWQob3AuaWQsIG9wLmNvbnRlbnQgIT0gbnVsbCA/IG9wLmNvbnRlbnQubGVuZ3RoIDogMSlcbiAgICAgICAgICAgICAgb3AuZGVsZXRlZCA9IHRydWVcbiAgICAgICAgICAgICAgaWYgKG9wLm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKG9wLm9wQ29udGVudClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAob3AucmVxdWlyZXMgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3AucmVxdWlyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbihvcC5yZXF1aXJlc1tpXSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcClcbiAgICAgICAgICAgIHRoaXMuc3RvcmUuZ2MxLnB1c2gob3AuaWQpIC8vIHRoaXMgaXMgb2sgYmVjYXVlcyBpdHMgc2hvcnRseSBiZWZvcmUgc3luYyAob3RoZXJ3aXNlIHVzZSBxdWV1ZUdhcmJhZ2VDb2xsZWN0b3IhKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5kZWxldGVkKSB7XG4gICAgICAgICAgdmFyIGxlZnQgPSBudWxsXG4gICAgICAgICAgaWYgKG9wLmxlZnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgbGVmdCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvcC5sZWZ0KVxuICAgICAgICAgIH1cbiAgICAgICAgICB5aWVsZCogdGhpcy5zdG9yZS5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IuY2FsbCh0aGlzLCBvcCwgbGVmdClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gICAgLypcbiAgICAgIFJlYWxseSByZW1vdmUgYW4gb3AgYW5kIGFsbCBpdHMgZWZmZWN0cy5cbiAgICAgIFRoZSBjb21wbGljYXRlZCBjYXNlIGhlcmUgaXMgdGhlIEluc2VydCBvcGVyYXRpb246XG4gICAgICAqIHJlc2V0IGxlZnRcbiAgICAgICogcmVzZXQgcmlnaHRcbiAgICAgICogcmVzZXQgcGFyZW50LnN0YXJ0XG4gICAgICAqIHJlc2V0IHBhcmVudC5lbmRcbiAgICAgICogcmVzZXQgb3JpZ2lucyBvZiBhbGwgcmlnaHQgb3BzXG4gICAgKi9cbiAgICAqIGdhcmJhZ2VDb2xsZWN0T3BlcmF0aW9uIChpZCkge1xuICAgICAgdGhpcy5zdG9yZS5hZGRUb0RlYnVnKCd5aWVsZCogdGhpcy5nYXJiYWdlQ29sbGVjdE9wZXJhdGlvbignLCBpZCwgJyknKVxuICAgICAgdmFyIG8gPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oaWQpXG4gICAgICB5aWVsZCogdGhpcy5tYXJrR2FyYmFnZUNvbGxlY3RlZChpZCwgKG8gIT0gbnVsbCAmJiBvLmNvbnRlbnQgIT0gbnVsbCkgPyBvLmNvbnRlbnQubGVuZ3RoIDogMSkgLy8gYWx3YXlzIG1hcmsgZ2MnZFxuICAgICAgLy8gaWYgb3AgZXhpc3RzLCB0aGVuIGNsZWFuIHRoYXQgbWVzcyB1cC4uXG4gICAgICBpZiAobyAhPSBudWxsKSB7XG4gICAgICAgIHZhciBkZXBzID0gW11cbiAgICAgICAgaWYgKG8ub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBkZXBzLnB1c2goby5vcENvbnRlbnQpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG8ucmVxdWlyZXMgIT0gbnVsbCkge1xuICAgICAgICAgIGRlcHMgPSBkZXBzLmNvbmNhdChvLnJlcXVpcmVzKVxuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVwcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBkZXAgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oZGVwc1tpXSlcbiAgICAgICAgICBpZiAoZGVwICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmICghZGVwLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKGRlcC5pZClcbiAgICAgICAgICAgICAgZGVwID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKGRlcC5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlcC5nYyA9IHRydWVcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihkZXApXG4gICAgICAgICAgICB0aGlzLnN0b3JlLnF1ZXVlR2FyYmFnZUNvbGxlY3RvcihkZXAuaWQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLm1hcmtHYXJiYWdlQ29sbGVjdGVkKGRlcHNbaV0sIDEpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGdjJ2Qgb3AgZnJvbSB0aGUgbGVmdCBvcCwgaWYgaXQgZXhpc3RzXG4gICAgICAgIGlmIChvLmxlZnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBsZWZ0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG8ubGVmdClcbiAgICAgICAgICBsZWZ0LnJpZ2h0ID0gby5yaWdodFxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihsZWZ0KVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbW92ZSBnYydkIG9wIGZyb20gdGhlIHJpZ2h0IG9wLCBpZiBpdCBleGlzdHNcbiAgICAgICAgLy8gYWxzbyByZXNldCBvcmlnaW5zIG9mIHJpZ2h0IG9wc1xuICAgICAgICBpZiAoby5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIHJpZ2h0ID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG8ucmlnaHQpXG4gICAgICAgICAgcmlnaHQubGVmdCA9IG8ubGVmdFxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihyaWdodClcblxuICAgICAgICAgIGlmIChvLm9yaWdpbk9mICE9IG51bGwgJiYgby5vcmlnaW5PZi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBmaW5kIG5ldyBvcmlnaW4gb2YgcmlnaHQgb3BzXG4gICAgICAgICAgICAvLyBvcmlnaW4gaXMgdGhlIGZpcnN0IGxlZnQgZGVsZXRlZCBvcGVyYXRpb25cbiAgICAgICAgICAgIHZhciBuZXdvcmlnaW4gPSBvLmxlZnRcbiAgICAgICAgICAgIHZhciBuZXdvcmlnaW5fID0gbnVsbFxuICAgICAgICAgICAgd2hpbGUgKG5ld29yaWdpbiAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIG5ld29yaWdpbl8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24obmV3b3JpZ2luKVxuICAgICAgICAgICAgICBpZiAobmV3b3JpZ2luXy5kZWxldGVkKSB7XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBuZXdvcmlnaW4gPSBuZXdvcmlnaW5fLmxlZnRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVzZXQgb3JpZ2luIG9mIGFsbCByaWdodCBvcHMgKGV4Y2VwdCBmaXJzdCByaWdodCAtIGR1aCEpLFxuXG4gICAgICAgICAgICAvKiAqKiBUaGUgZm9sbG93aW5nIGNvZGUgZG9lcyBub3QgcmVseSBvbiB0aGUgdGhlIG9yaWdpbk9mIHByb3BlcnR5ICoqXG4gICAgICAgICAgICAgICAgICBJIHJlY2VudGx5IGFkZGVkIG9yaWdpbk9mIHRvIGFsbCBJbnNlcnQgT3BlcmF0aW9ucyAoc2VlIFN0cnVjdC5JbnNlcnQuZXhlY3V0ZSksXG4gICAgICAgICAgICAgICAgICB3aGljaCBzYXZlcyB3aGljaCBvcGVyYXRpb25zIG9yaWdpbmF0ZSBpbiBhIEluc2VydCBvcGVyYXRpb24uXG4gICAgICAgICAgICAgICAgICBHYXJiYWdlIGNvbGxlY3Rpbmcgd2l0aG91dCBvcmlnaW5PZiBpcyBtb3JlIG1lbW9yeSBlZmZpY2llbnQsIGJ1dCBpcyBuZWFybHkgaW1wb3NzaWJsZSBmb3IgbGFyZ2UgdGV4dHMsIG9yIGxpc3RzIVxuICAgICAgICAgICAgICAgICAgQnV0IEkga2VlcCB0aGlzIGNvZGUgZm9yIG5vd1xuICAgICAgICAgICAgYGBgXG4gICAgICAgICAgICAvLyByZXNldCBvcmlnaW4gb2YgcmlnaHRcbiAgICAgICAgICAgIHJpZ2h0Lm9yaWdpbiA9IG5ld29yaWdpblxuICAgICAgICAgICAgLy8gc2VhcmNoIHVudGlsIHlvdSBmaW5kIG9yaWdpbiBwb2ludGVyIHRvIHRoZSBsZWZ0IG9mIG9cbiAgICAgICAgICAgIGlmIChyaWdodC5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHZhciBpID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKHJpZ2h0LnJpZ2h0KVxuICAgICAgICAgICAgICB2YXIgaWRzID0gW28uaWQsIG8ucmlnaHRdXG4gICAgICAgICAgICAgIHdoaWxlIChpZHMuc29tZShmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gWS51dGlscy5jb21wYXJlSWRzKGlkLCBpLm9yaWdpbilcbiAgICAgICAgICAgICAgfSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoWS51dGlscy5jb21wYXJlSWRzKGkub3JpZ2luLCBvLmlkKSkge1xuICAgICAgICAgICAgICAgICAgLy8gcmVzZXQgb3JpZ2luIG9mIGlcbiAgICAgICAgICAgICAgICAgIGkub3JpZ2luID0gbmV3b3JpZ2luXG4gICAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24oaSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gZ2V0IG5leHQgaVxuICAgICAgICAgICAgICAgIGlmIChpLnJpZ2h0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGlkcy5wdXNoKGkuaWQpXG4gICAgICAgICAgICAgICAgICBpID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKGkucmlnaHQpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBgYGBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyAqKiBOb3cgdGhlIG5ldyBpbXBsZW1lbnRhdGlvbiBzdGFydHMgKipcbiAgICAgICAgICAgIC8vIHJlc2V0IG5ld29yaWdpbiBvZiBhbGwgb3JpZ2luT2ZbKl1cbiAgICAgICAgICAgIGZvciAodmFyIF9pIGluIG8ub3JpZ2luT2YpIHtcbiAgICAgICAgICAgICAgdmFyIG9yaWdpbnNJbiA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvLm9yaWdpbk9mW19pXSlcbiAgICAgICAgICAgICAgaWYgKG9yaWdpbnNJbiAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luc0luLm9yaWdpbiA9IG5ld29yaWdpblxuICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcmlnaW5zSW4pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXdvcmlnaW4gIT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAobmV3b3JpZ2luXy5vcmlnaW5PZiA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3b3JpZ2luXy5vcmlnaW5PZiA9IG8ub3JpZ2luT2ZcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdvcmlnaW5fLm9yaWdpbk9mID0gby5vcmlnaW5PZi5jb25jYXQobmV3b3JpZ2luXy5vcmlnaW5PZilcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24obmV3b3JpZ2luXylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gc2V0IHJpZ2h0IGhlcmUsIGJlY2F1c2VcbiAgICAgICAgICAgIC8vIHJpZ2h0IHNob3VsZCBiZSBpbiBvLm9yaWdpbk9mID0+IGl0IGlzIHNldCBpdCB0aGUgcHJldmlvdXMgZm9yIGxvb3BcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gbyBtYXkgb3JpZ2luYXRlIGluIGFub3RoZXIgb3BlcmF0aW9uLlxuICAgICAgICAvLyBTaW5jZSBvIGlzIGRlbGV0ZWQsIHdlIGhhdmUgdG8gcmVzZXQgby5vcmlnaW4ncyBgb3JpZ2luT2ZgIHByb3BlcnR5XG4gICAgICAgIGlmIChvLm9yaWdpbiAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIG9yaWdpbiA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvLm9yaWdpbilcbiAgICAgICAgICBvcmlnaW4ub3JpZ2luT2YgPSBvcmlnaW4ub3JpZ2luT2YuZmlsdGVyKGZ1bmN0aW9uIChfaWQpIHtcbiAgICAgICAgICAgIHJldHVybiAhWS51dGlscy5jb21wYXJlSWRzKGlkLCBfaWQpXG4gICAgICAgICAgfSlcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ob3JpZ2luKVxuICAgICAgICB9XG4gICAgICAgIHZhciBwYXJlbnRcbiAgICAgICAgaWYgKG8ucGFyZW50ICE9IG51bGwpIHtcbiAgICAgICAgICBwYXJlbnQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oby5wYXJlbnQpXG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIGdjJ2Qgb3AgZnJvbSBwYXJlbnQsIGlmIGl0IGV4aXN0c1xuICAgICAgICBpZiAocGFyZW50ICE9IG51bGwpIHtcbiAgICAgICAgICB2YXIgc2V0UGFyZW50ID0gZmFsc2UgLy8gd2hldGhlciB0byBzYXZlIHBhcmVudCB0byB0aGUgb3NcbiAgICAgICAgICBpZiAoby5wYXJlbnRTdWIgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKFkudXRpbHMuY29tcGFyZUlkcyhwYXJlbnQubWFwW28ucGFyZW50U3ViXSwgby5pZCkpIHtcbiAgICAgICAgICAgICAgc2V0UGFyZW50ID0gdHJ1ZVxuICAgICAgICAgICAgICBpZiAoby5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50Lm1hcFtvLnBhcmVudFN1Yl0gPSBvLnJpZ2h0XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHBhcmVudC5tYXBbby5wYXJlbnRTdWJdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKFkudXRpbHMuY29tcGFyZUlkcyhwYXJlbnQuc3RhcnQsIG8uaWQpKSB7XG4gICAgICAgICAgICAgIC8vIGdjJ2Qgb3AgaXMgdGhlIHN0YXJ0XG4gICAgICAgICAgICAgIHNldFBhcmVudCA9IHRydWVcbiAgICAgICAgICAgICAgcGFyZW50LnN0YXJ0ID0gby5yaWdodFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKFkudXRpbHMubWF0Y2hlc0lkKG8sIHBhcmVudC5lbmQpKSB7XG4gICAgICAgICAgICAgIC8vIGdjJ2Qgb3AgaXMgdGhlIGVuZFxuICAgICAgICAgICAgICBzZXRQYXJlbnQgPSB0cnVlXG4gICAgICAgICAgICAgIHBhcmVudC5lbmQgPSBvLmxlZnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNldFBhcmVudCkge1xuICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHBhcmVudClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gZmluYWxseSByZW1vdmUgaXQgZnJvbSB0aGUgb3NcbiAgICAgICAgeWllbGQqIHRoaXMucmVtb3ZlT3BlcmF0aW9uKG8uaWQpXG4gICAgICB9XG4gICAgfVxuICAgICogY2hlY2tEZWxldGVTdG9yZUZvclN0YXRlIChzdGF0ZSkge1xuICAgICAgdmFyIG4gPSB5aWVsZCogdGhpcy5kcy5maW5kV2l0aFVwcGVyQm91bmQoW3N0YXRlLnVzZXIsIHN0YXRlLmNsb2NrXSlcbiAgICAgIGlmIChuICE9IG51bGwgJiYgbi5pZFswXSA9PT0gc3RhdGUudXNlciAmJiBuLmdjKSB7XG4gICAgICAgIHN0YXRlLmNsb2NrID0gTWF0aC5tYXgoc3RhdGUuY2xvY2ssIG4uaWRbMV0gKyBuLmxlbilcbiAgICAgIH1cbiAgICB9XG4gICAgKiB1cGRhdGVTdGF0ZSAodXNlcikge1xuICAgICAgdmFyIHN0YXRlID0geWllbGQqIHRoaXMuZ2V0U3RhdGUodXNlcilcbiAgICAgIHlpZWxkKiB0aGlzLmNoZWNrRGVsZXRlU3RvcmVGb3JTdGF0ZShzdGF0ZSlcbiAgICAgIHZhciBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKFt1c2VyLCBzdGF0ZS5jbG9ja10pXG4gICAgICB2YXIgb0xlbmd0aCA9IChvICE9IG51bGwgJiYgby5jb250ZW50ICE9IG51bGwpID8gby5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIHdoaWxlIChvICE9IG51bGwgJiYgdXNlciA9PT0gby5pZFswXSAmJiBvLmlkWzFdIDw9IHN0YXRlLmNsb2NrICYmIG8uaWRbMV0gKyBvTGVuZ3RoID4gc3RhdGUuY2xvY2spIHtcbiAgICAgICAgLy8gZWl0aGVyIGl0cyBhIG5ldyBvcGVyYXRpb24gKDEuIGNhc2UpLCBvciBpdCBpcyBhbiBvcGVyYXRpb24gdGhhdCB3YXMgZGVsZXRlZCwgYnV0IGlzIG5vdCB5ZXQgaW4gdGhlIE9TXG4gICAgICAgIHN0YXRlLmNsb2NrICs9IG9MZW5ndGhcbiAgICAgICAgeWllbGQqIHRoaXMuY2hlY2tEZWxldGVTdG9yZUZvclN0YXRlKHN0YXRlKVxuICAgICAgICBvID0geWllbGQqIHRoaXMub3MuZmluZE5leHQoby5pZClcbiAgICAgICAgb0xlbmd0aCA9IChvICE9IG51bGwgJiYgby5jb250ZW50ICE9IG51bGwpID8gby5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIH1cbiAgICAgIHlpZWxkKiB0aGlzLnNldFN0YXRlKHN0YXRlKVxuICAgIH1cbiAgICAvKlxuICAgICAgYXBwbHkgYSBkZWxldGUgc2V0IGluIG9yZGVyIHRvIGdldFxuICAgICAgdGhlIHN0YXRlIG9mIHRoZSBzdXBwbGllZCBkc1xuICAgICovXG4gICAgKiBhcHBseURlbGV0ZVNldCAoZHMpIHtcbiAgICAgIHZhciBkZWxldGlvbnMgPSBbXVxuXG4gICAgICBmb3IgKHZhciB1c2VyIGluIGRzKSB7XG4gICAgICAgIHZhciBkdiA9IGRzW3VzZXJdXG4gICAgICAgIHZhciBwb3MgPSAwXG4gICAgICAgIHZhciBkID0gZHZbcG9zXVxuICAgICAgICB5aWVsZCogdGhpcy5kcy5pdGVyYXRlKHRoaXMsIFt1c2VyLCAwXSwgW3VzZXIsIE51bWJlci5NQVhfVkFMVUVdLCBmdW5jdGlvbiAqIChuKSB7XG4gICAgICAgICAgLy8gY2FzZXM6XG4gICAgICAgICAgLy8gMS4gZCBkZWxldGVzIHNvbWV0aGluZyB0byB0aGUgcmlnaHQgb2YgblxuICAgICAgICAgIC8vICA9PiBnbyB0byBuZXh0IG4gKGJyZWFrKVxuICAgICAgICAgIC8vIDIuIGQgZGVsZXRlcyBzb21ldGhpbmcgdG8gdGhlIGxlZnQgb2YgblxuICAgICAgICAgIC8vICA9PiBjcmVhdGUgZGVsZXRpb25zXG4gICAgICAgICAgLy8gID0+IHJlc2V0IGQgYWNjb3JkaW5nbHlcbiAgICAgICAgICAvLyAgKik9PiBpZiBkIGRvZXNuJ3QgZGVsZXRlIGFueXRoaW5nIGFueW1vcmUsIGdvIHRvIG5leHQgZCAoY29udGludWUpXG4gICAgICAgICAgLy8gMy4gbm90IDIpIGFuZCBkIGRlbGV0ZXMgc29tZXRoaW5nIHRoYXQgYWxzbyBuIGRlbGV0ZXNcbiAgICAgICAgICAvLyAgPT4gcmVzZXQgZCBzbyB0aGF0IGl0IGRvZXNuJ3QgY29udGFpbiBuJ3MgZGVsZXRpb25cbiAgICAgICAgICAvLyAgKik9PiBpZiBkIGRvZXMgbm90IGRlbGV0ZSBhbnl0aGluZyBhbnltb3JlLCBnbyB0byBuZXh0IGQgKGNvbnRpbnVlKVxuICAgICAgICAgIHdoaWxlIChkICE9IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBkaWZmID0gMCAvLyBkZXNjcmliZSB0aGUgZGlmZiBvZiBsZW5ndGggaW4gMSkgYW5kIDIpXG4gICAgICAgICAgICBpZiAobi5pZFsxXSArIG4ubGVuIDw9IGRbMF0pIHtcbiAgICAgICAgICAgICAgLy8gMSlcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZFswXSA8IG4uaWRbMV0pIHtcbiAgICAgICAgICAgICAgLy8gMilcbiAgICAgICAgICAgICAgLy8gZGVsZXRlIG1heGltdW0gdGhlIGxlbiBvZiBkXG4gICAgICAgICAgICAgIC8vIGVsc2UgZGVsZXRlIGFzIG11Y2ggYXMgcG9zc2libGVcbiAgICAgICAgICAgICAgZGlmZiA9IE1hdGgubWluKG4uaWRbMV0gLSBkWzBdLCBkWzFdKVxuICAgICAgICAgICAgICBkZWxldGlvbnMucHVzaChbdXNlciwgZFswXSwgZGlmZiwgZFsyXV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyAzKVxuICAgICAgICAgICAgICBkaWZmID0gbi5pZFsxXSArIG4ubGVuIC0gZFswXSAvLyBuZXZlciBudWxsIChzZWUgMSlcbiAgICAgICAgICAgICAgaWYgKGRbMl0gJiYgIW4uZ2MpIHtcbiAgICAgICAgICAgICAgICAvLyBkIG1hcmtzIGFzIGdjJ2QgYnV0IG4gZG9lcyBub3RcbiAgICAgICAgICAgICAgICAvLyB0aGVuIGRlbGV0ZSBlaXRoZXIgd2F5XG4gICAgICAgICAgICAgICAgZGVsZXRpb25zLnB1c2goW3VzZXIsIGRbMF0sIE1hdGgubWluKGRpZmYsIGRbMV0pLCBkWzJdXSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRbMV0gPD0gZGlmZikge1xuICAgICAgICAgICAgICAvLyBkIGRvZXNuJ3QgZGVsZXRlIGFueXRoaW5nIGFueW1vcmVcbiAgICAgICAgICAgICAgZCA9IGR2WysrcG9zXVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZFswXSA9IGRbMF0gKyBkaWZmIC8vIHJlc2V0IHBvc1xuICAgICAgICAgICAgICBkWzFdID0gZFsxXSAtIGRpZmYgLy8gcmVzZXQgbGVuZ3RoXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAvLyBmb3IgdGhlIHJlc3QuLiBqdXN0IGFwcGx5IGl0XG4gICAgICAgIGZvciAoOyBwb3MgPCBkdi5sZW5ndGg7IHBvcysrKSB7XG4gICAgICAgICAgZCA9IGR2W3Bvc11cbiAgICAgICAgICBkZWxldGlvbnMucHVzaChbdXNlciwgZFswXSwgZFsxXSwgZFsyXV0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVsZXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBkZWwgPSBkZWxldGlvbnNbaV1cbiAgICAgICAgLy8gYWx3YXlzIHRyeSB0byBkZWxldGUuLlxuICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24oW2RlbFswXSwgZGVsWzFdXSwgZGVsWzJdKVxuICAgICAgICBpZiAoZGVsWzNdKSB7XG4gICAgICAgICAgLy8gZ2MuLlxuICAgICAgICAgIHlpZWxkKiB0aGlzLm1hcmtHYXJiYWdlQ29sbGVjdGVkKFtkZWxbMF0sIGRlbFsxXV0sIGRlbFsyXSkgLy8gYWx3YXlzIG1hcmsgZ2MnZFxuICAgICAgICAgIC8vIHJlbW92ZSBvcGVyYXRpb24uLlxuICAgICAgICAgIHZhciBjb3VudGVyID0gZGVsWzFdICsgZGVsWzJdXG4gICAgICAgICAgd2hpbGUgKGNvdW50ZXIgPj0gZGVsWzFdKSB7XG4gICAgICAgICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLm9zLmZpbmRXaXRoVXBwZXJCb3VuZChbZGVsWzBdLCBjb3VudGVyIC0gMV0pXG4gICAgICAgICAgICBpZiAobyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgb0xlbiA9IG8uY29udGVudCAhPSBudWxsID8gby5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgICAgICAgIGlmIChvLmlkWzBdICE9PSBkZWxbMF0gfHwgby5pZFsxXSArIG9MZW4gPD0gZGVsWzFdKSB7XG4gICAgICAgICAgICAgIC8vIG5vdCBpbiByYW5nZVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG8uaWRbMV0gKyBvTGVuID4gZGVsWzFdICsgZGVsWzJdKSB7XG4gICAgICAgICAgICAgIC8vIG92ZXJsYXBzIHJpZ2h0XG4gICAgICAgICAgICAgIG8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChbZGVsWzBdLCBkZWxbMV0gKyBkZWxbMl0gLSAxXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvLmlkWzFdIDwgZGVsWzFdKSB7XG4gICAgICAgICAgICAgIC8vIG92ZXJsYXBzIGxlZnRcbiAgICAgICAgICAgICAgbyA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuU3RhcnQoW2RlbFswXSwgZGVsWzFdXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvdW50ZXIgPSBvLmlkWzFdXG4gICAgICAgICAgICB5aWVsZCogdGhpcy5nYXJiYWdlQ29sbGVjdE9wZXJhdGlvbihvLmlkKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdG9yZS5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnMpIHtcbiAgICAgICAgICB2YXIgb3BzID0gW11cbiAgICAgICAgICBvcHMucHVzaCh7c3RydWN0OiAnRGVsZXRlJywgdGFyZ2V0OiBbZGVsWzBdLCBkZWxbMV1dLCBsZW5ndGg6IGRlbFsyXX0pXG4gICAgICAgICAgdGhpcy5zdG9yZS55LmNvbm5lY3Rvci5icm9hZGNhc3RPcHMob3BzKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgICogaXNHYXJiYWdlQ29sbGVjdGVkIChpZCkge1xuICAgICAgdmFyIG4gPSB5aWVsZCogdGhpcy5kcy5maW5kV2l0aFVwcGVyQm91bmQoaWQpXG4gICAgICByZXR1cm4gbiAhPSBudWxsICYmIG4uaWRbMF0gPT09IGlkWzBdICYmIGlkWzFdIDwgbi5pZFsxXSArIG4ubGVuICYmIG4uZ2NcbiAgICB9XG4gICAgLypcbiAgICAgIEEgRGVsZXRlU2V0IChkcykgZGVzY3JpYmVzIGFsbCB0aGUgZGVsZXRlZCBvcHMgaW4gdGhlIE9TXG4gICAgKi9cbiAgICAqIGdldERlbGV0ZVNldCAoKSB7XG4gICAgICB2YXIgZHMgPSB7fVxuICAgICAgeWllbGQqIHRoaXMuZHMuaXRlcmF0ZSh0aGlzLCBudWxsLCBudWxsLCBmdW5jdGlvbiAqIChuKSB7XG4gICAgICAgIHZhciB1c2VyID0gbi5pZFswXVxuICAgICAgICB2YXIgY291bnRlciA9IG4uaWRbMV1cbiAgICAgICAgdmFyIGxlbiA9IG4ubGVuXG4gICAgICAgIHZhciBnYyA9IG4uZ2NcbiAgICAgICAgdmFyIGR2ID0gZHNbdXNlcl1cbiAgICAgICAgaWYgKGR2ID09PSB2b2lkIDApIHtcbiAgICAgICAgICBkdiA9IFtdXG4gICAgICAgICAgZHNbdXNlcl0gPSBkdlxuICAgICAgICB9XG4gICAgICAgIGR2LnB1c2goW2NvdW50ZXIsIGxlbiwgZ2NdKVxuICAgICAgfSlcbiAgICAgIHJldHVybiBkc1xuICAgIH1cbiAgICAqIGlzRGVsZXRlZCAoaWQpIHtcbiAgICAgIHZhciBuID0geWllbGQqIHRoaXMuZHMuZmluZFdpdGhVcHBlckJvdW5kKGlkKVxuICAgICAgcmV0dXJuIG4gIT0gbnVsbCAmJiBuLmlkWzBdID09PSBpZFswXSAmJiBpZFsxXSA8IG4uaWRbMV0gKyBuLmxlblxuICAgIH1cbiAgICAqIHNldE9wZXJhdGlvbiAob3ApIHtcbiAgICAgIHlpZWxkKiB0aGlzLm9zLnB1dChvcClcbiAgICAgIHJldHVybiBvcFxuICAgIH1cbiAgICAqIGFkZE9wZXJhdGlvbiAob3ApIHtcbiAgICAgIHlpZWxkKiB0aGlzLm9zLnB1dChvcClcbiAgICAgIGlmICh0aGlzLnN0b3JlLmZvcndhcmRBcHBsaWVkT3BlcmF0aW9ucyAmJiB0eXBlb2Ygb3AuaWRbMV0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIGlzIGNvbm5lY3RlZCwgYW5kIHRoaXMgaXMgbm90IGdvaW5nIHRvIGJlIHNlbmQgaW4gYWRkT3BlcmF0aW9uXG4gICAgICAgIHRoaXMuc3RvcmUueS5jb25uZWN0b3IuYnJvYWRjYXN0T3BzKFtvcF0pXG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIGluc2VydGlvbiwgdHJ5IHRvIGNvbWJpbmUgd2l0aCBsZWZ0IGluc2VydGlvbiAoaWYgYm90aCBoYXZlIGNvbnRlbnQgcHJvcGVydHkpXG4gICAgKiB0cnlDb21iaW5lV2l0aExlZnQgKG9wKSB7XG4gICAgICBpZiAoXG4gICAgICAgIG9wICE9IG51bGwgJiZcbiAgICAgICAgb3AubGVmdCAhPSBudWxsICYmXG4gICAgICAgIG9wLmNvbnRlbnQgIT0gbnVsbCAmJlxuICAgICAgICBvcC5sZWZ0WzBdID09PSBvcC5pZFswXSAmJlxuICAgICAgICBZLnV0aWxzLmNvbXBhcmVJZHMob3AubGVmdCwgb3Aub3JpZ2luKVxuICAgICAgKSB7XG4gICAgICAgIHZhciBsZWZ0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG9wLmxlZnQpXG4gICAgICAgIGlmIChsZWZ0LmNvbnRlbnQgIT0gbnVsbCAmJlxuICAgICAgICAgICAgbGVmdC5pZFsxXSArIGxlZnQuY29udGVudC5sZW5ndGggPT09IG9wLmlkWzFdICYmXG4gICAgICAgICAgICBsZWZ0Lm9yaWdpbk9mLmxlbmd0aCA9PT0gMSAmJlxuICAgICAgICAgICAgIWxlZnQuZ2MgJiYgIWxlZnQuZGVsZXRlZCAmJlxuICAgICAgICAgICAgIW9wLmdjICYmICFvcC5kZWxldGVkXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIGNvbWJpbmUhXG4gICAgICAgICAgaWYgKG9wLm9yaWdpbk9mICE9IG51bGwpIHtcbiAgICAgICAgICAgIGxlZnQub3JpZ2luT2YgPSBvcC5vcmlnaW5PZlxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgbGVmdC5vcmlnaW5PZlxuICAgICAgICAgIH1cbiAgICAgICAgICBsZWZ0LmNvbnRlbnQgPSBsZWZ0LmNvbnRlbnQuY29uY2F0KG9wLmNvbnRlbnQpXG4gICAgICAgICAgbGVmdC5yaWdodCA9IG9wLnJpZ2h0XG4gICAgICAgICAgeWllbGQqIHRoaXMub3MuZGVsZXRlKG9wLmlkKVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihsZWZ0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgICogZ2V0SW5zZXJ0aW9uIChpZCkge1xuICAgICAgdmFyIGlucyA9IHlpZWxkKiB0aGlzLm9zLmZpbmRXaXRoVXBwZXJCb3VuZChpZClcbiAgICAgIGlmIChpbnMgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGxlbiA9IGlucy5jb250ZW50ICE9IG51bGwgPyBpbnMuY29udGVudC5sZW5ndGggOiAxIC8vIGluIGNhc2Ugb2Ygb3BDb250ZW50XG4gICAgICAgIGlmIChpZFswXSA9PT0gaW5zLmlkWzBdICYmIGlkWzFdIDwgaW5zLmlkWzFdICsgbGVuKSB7XG4gICAgICAgICAgcmV0dXJuIGluc1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBnZXRJbnNlcnRpb25DbGVhblN0YXJ0RW5kIChpZCkge1xuICAgICAgeWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydChpZClcbiAgICAgIHJldHVybiB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChpZClcbiAgICB9XG4gICAgLy8gUmV0dXJuIGFuIGluc2VydGlvbiBzdWNoIHRoYXQgaWQgaXMgdGhlIGZpcnN0IGVsZW1lbnQgb2YgY29udGVudFxuICAgIC8vIFRoaXMgZnVuY3Rpb24gbWFuaXB1bGF0ZXMgYW4gb3BlcmF0aW9uLCBpZiBuZWNlc3NhcnlcbiAgICAqIGdldEluc2VydGlvbkNsZWFuU3RhcnQgKGlkKSB7XG4gICAgICB2YXIgaW5zID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKGlkKVxuICAgICAgaWYgKGlucyAhPSBudWxsKSB7XG4gICAgICAgIGlmIChpbnMuaWRbMV0gPT09IGlkWzFdKSB7XG4gICAgICAgICAgcmV0dXJuIGluc1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBsZWZ0ID0gWS51dGlscy5jb3B5T2JqZWN0KGlucylcbiAgICAgICAgICBpbnMuY29udGVudCA9IGxlZnQuY29udGVudC5zcGxpY2UoaWRbMV0gLSBpbnMuaWRbMV0pXG4gICAgICAgICAgaW5zLmlkID0gaWRcbiAgICAgICAgICB2YXIgbGVmdExpZCA9IFkudXRpbHMuZ2V0TGFzdElkKGxlZnQpXG4gICAgICAgICAgaW5zLm9yaWdpbiA9IGxlZnRMaWRcbiAgICAgICAgICBsZWZ0Lm9yaWdpbk9mID0gW2lucy5pZF1cbiAgICAgICAgICBsZWZ0LnJpZ2h0ID0gaW5zLmlkXG4gICAgICAgICAgaW5zLmxlZnQgPSBsZWZ0TGlkXG4gICAgICAgICAgLy8gZGVidWdnZXIgLy8gY2hlY2tcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24obGVmdClcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24oaW5zKVxuICAgICAgICAgIGlmIChsZWZ0LmdjKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3JlLnF1ZXVlR2FyYmFnZUNvbGxlY3RvcihpbnMuaWQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBpbnNcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmV0dXJuIGFuIGluc2VydGlvbiBzdWNoIHRoYXQgaWQgaXMgdGhlIGxhc3QgZWxlbWVudCBvZiBjb250ZW50XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBtYW5pcHVsYXRlcyBhbiBvcGVyYXRpb24sIGlmIG5lY2Vzc2FyeVxuICAgICogZ2V0SW5zZXJ0aW9uQ2xlYW5FbmQgKGlkKSB7XG4gICAgICB2YXIgaW5zID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKGlkKVxuICAgICAgaWYgKGlucyAhPSBudWxsKSB7XG4gICAgICAgIGlmIChpbnMuY29udGVudCA9PSBudWxsIHx8IChpbnMuaWRbMV0gKyBpbnMuY29udGVudC5sZW5ndGggLSAxID09PSBpZFsxXSkpIHtcbiAgICAgICAgICByZXR1cm4gaW5zXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJpZ2h0ID0gWS51dGlscy5jb3B5T2JqZWN0KGlucylcbiAgICAgICAgICByaWdodC5jb250ZW50ID0gaW5zLmNvbnRlbnQuc3BsaWNlKGlkWzFdIC0gaW5zLmlkWzFdICsgMSkgLy8gY3V0IG9mZiByZW1haW5kZXJcbiAgICAgICAgICByaWdodC5pZCA9IFtpZFswXSwgaWRbMV0gKyAxXVxuICAgICAgICAgIHZhciBpbnNMaWQgPSBZLnV0aWxzLmdldExhc3RJZChpbnMpXG4gICAgICAgICAgcmlnaHQub3JpZ2luID0gaW5zTGlkXG4gICAgICAgICAgaW5zLm9yaWdpbk9mID0gW3JpZ2h0LmlkXVxuICAgICAgICAgIGlucy5yaWdodCA9IHJpZ2h0LmlkXG4gICAgICAgICAgcmlnaHQubGVmdCA9IGluc0xpZFxuICAgICAgICAgIC8vIGRlYnVnZ2VyIC8vIGNoZWNrXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHJpZ2h0KVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihpbnMpXG4gICAgICAgICAgaWYgKGlucy5nYykge1xuICAgICAgICAgICAgdGhpcy5zdG9yZS5xdWV1ZUdhcmJhZ2VDb2xsZWN0b3IocmlnaHQuaWQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBpbnNcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG4gICAgKiBnZXRPcGVyYXRpb24gKGlkLyogOmFueSAqLykvKiA6VHJhbnNhY3Rpb248YW55PiAqLyB7XG4gICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLm9zLmZpbmQoaWQpXG4gICAgICBpZiAoaWRbMF0gIT09ICdfJyB8fCBvICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG9cbiAgICAgIH0gZWxzZSB7IC8vIHR5cGUgaXMgc3RyaW5nXG4gICAgICAgIC8vIGdlbmVyYXRlIHRoaXMgb3BlcmF0aW9uP1xuICAgICAgICB2YXIgY29tcCA9IGlkWzFdLnNwbGl0KCdfJylcbiAgICAgICAgaWYgKGNvbXAubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHZhciBzdHJ1Y3QgPSBjb21wWzBdXG4gICAgICAgICAgdmFyIG9wID0gWS5TdHJ1Y3Rbc3RydWN0XS5jcmVhdGUoaWQpXG4gICAgICAgICAgb3AudHlwZSA9IGNvbXBbMV1cbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ob3ApXG4gICAgICAgICAgcmV0dXJuIG9wXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd29uJ3QgYmUgY2FsbGVkLiBidXQganVzdCBpbiBjYXNlLi5cbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdVbmV4cGVjdGVkIGNhc2UuIEhvdyBjYW4gdGhpcyBoYXBwZW4/JylcbiAgICAgICAgICBkZWJ1Z2dlciAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIHJlbW92ZU9wZXJhdGlvbiAoaWQpIHtcbiAgICAgIHlpZWxkKiB0aGlzLm9zLmRlbGV0ZShpZClcbiAgICB9XG4gICAgKiBzZXRTdGF0ZSAoc3RhdGUpIHtcbiAgICAgIHZhciB2YWwgPSB7XG4gICAgICAgIGlkOiBbc3RhdGUudXNlcl0sXG4gICAgICAgIGNsb2NrOiBzdGF0ZS5jbG9ja1xuICAgICAgfVxuICAgICAgeWllbGQqIHRoaXMuc3MucHV0KHZhbClcbiAgICB9XG4gICAgKiBnZXRTdGF0ZSAodXNlcikge1xuICAgICAgdmFyIG4gPSB5aWVsZCogdGhpcy5zcy5maW5kKFt1c2VyXSlcbiAgICAgIHZhciBjbG9jayA9IG4gPT0gbnVsbCA/IG51bGwgOiBuLmNsb2NrXG4gICAgICBpZiAoY2xvY2sgPT0gbnVsbCkge1xuICAgICAgICBjbG9jayA9IDBcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHVzZXI6IHVzZXIsXG4gICAgICAgIGNsb2NrOiBjbG9ja1xuICAgICAgfVxuICAgIH1cbiAgICAqIGdldFN0YXRlVmVjdG9yICgpIHtcbiAgICAgIHZhciBzdGF0ZVZlY3RvciA9IFtdXG4gICAgICB5aWVsZCogdGhpcy5zcy5pdGVyYXRlKHRoaXMsIG51bGwsIG51bGwsIGZ1bmN0aW9uICogKG4pIHtcbiAgICAgICAgc3RhdGVWZWN0b3IucHVzaCh7XG4gICAgICAgICAgdXNlcjogbi5pZFswXSxcbiAgICAgICAgICBjbG9jazogbi5jbG9ja1xuICAgICAgICB9KVxuICAgICAgfSlcbiAgICAgIHJldHVybiBzdGF0ZVZlY3RvclxuICAgIH1cbiAgICAqIGdldFN0YXRlU2V0ICgpIHtcbiAgICAgIHZhciBzcyA9IHt9XG4gICAgICB5aWVsZCogdGhpcy5zcy5pdGVyYXRlKHRoaXMsIG51bGwsIG51bGwsIGZ1bmN0aW9uICogKG4pIHtcbiAgICAgICAgc3Nbbi5pZFswXV0gPSBuLmNsb2NrXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHNzXG4gICAgfVxuICAgIC8qXG4gICAgICBIZXJlLCB3ZSBtYWtlIGFsbCBtaXNzaW5nIG9wZXJhdGlvbnMgZXhlY3V0YWJsZSBmb3IgdGhlIHJlY2VpdmluZyB1c2VyLlxuXG4gICAgICBOb3RlczpcbiAgICAgICAgc3RhcnRTUzogZGVub3RlcyB0byB0aGUgU1YgdGhhdCB0aGUgcmVtb3RlIHVzZXIgc2VudFxuICAgICAgICBjdXJyU1M6ICBkZW5vdGVzIHRvIHRoZSBzdGF0ZSB2ZWN0b3IgdGhhdCB0aGUgdXNlciBzaG91bGQgaGF2ZSBpZiBoZVxuICAgICAgICAgICAgICAgICBhcHBsaWVzIGFsbCBhbHJlYWR5IHNlbnQgb3BlcmF0aW9ucyAoaW5jcmVhc2VzIGlzIGVhY2ggc3RlcClcblxuICAgICAgV2UgZmFjZSBzZXZlcmFsIHByb2JsZW1zOlxuICAgICAgKiBFeGVjdXRlIG9wIGFzIGlzIHdvbid0IHdvcmsgYmVjYXVzZSBvcHMgZGVwZW5kIG9uIGVhY2ggb3RoZXJcbiAgICAgICAtPiBmaW5kIGEgd2F5IHNvIHRoYXQgdGhleSBkbyBub3QgYW55bW9yZVxuICAgICAgKiBXaGVuIGNoYW5naW5nIGxlZnQsIG11c3Qgbm90IGdvIG1vcmUgdG8gdGhlIGxlZnQgdGhhbiB0aGUgb3JpZ2luXG4gICAgICAqIFdoZW4gY2hhbmdpbmcgcmlnaHQsIHlvdSBoYXZlIHRvIGNvbnNpZGVyIHRoYXQgb3RoZXIgb3BzIG1heSBoYXZlIG9wXG4gICAgICAgIGFzIHRoZWlyIG9yaWdpbiwgdGhpcyBtZWFucyB0aGF0IHlvdSBtdXN0IG5vdCBzZXQgb25lIG9mIHRoZXNlIG9wc1xuICAgICAgICBhcyB0aGUgbmV3IHJpZ2h0IChpbnRlcmRlcGVuZGVuY2llcyBvZiBvcHMpXG4gICAgICAqIGNhbid0IGp1c3QgZ28gdG8gdGhlIHJpZ2h0IHVudGlsIHlvdSBmaW5kIHRoZSBmaXJzdCBrbm93biBvcGVyYXRpb24sXG4gICAgICAgIFdpdGggY3VyclNTXG4gICAgICAgICAgLT4gaW50ZXJkZXBlbmRlbmN5IG9mIG9wcyBpcyBhIHByb2JsZW1cbiAgICAgICAgV2l0aCBzdGFydFNTXG4gICAgICAgICAgLT4gbGVhZHMgdG8gaW5jb25zaXN0ZW5jaWVzIHdoZW4gdHdvIHVzZXJzIGpvaW4gYXQgdGhlIHNhbWUgdGltZS5cbiAgICAgICAgICAgICBUaGVuIHRoZSBwb3NpdGlvbiBkZXBlbmRzIG9uIHRoZSBvcmRlciBvZiBleGVjdXRpb24gLT4gZXJyb3IhXG5cbiAgICAgICAgU29sdXRpb246XG4gICAgICAgIC0+IHJlLWNyZWF0ZSBvcmlnaW5pYWwgc2l0dWF0aW9uXG4gICAgICAgICAgLT4gc2V0IG9wLmxlZnQgPSBvcC5vcmlnaW4gKHdoaWNoIG5ldmVyIGNoYW5nZXMpXG4gICAgICAgICAgLT4gc2V0IG9wLnJpZ2h0XG4gICAgICAgICAgICAgICB0byB0aGUgZmlyc3Qgb3BlcmF0aW9uIHRoYXQgaXMga25vd24gKGFjY29yZGluZyB0byBzdGFydFNTKVxuICAgICAgICAgICAgICAgb3IgdG8gdGhlIGZpcnN0IG9wZXJhdGlvbiB0aGF0IGhhcyBhbiBvcmlnaW4gdGhhdCBpcyBub3QgdG8gdGhlXG4gICAgICAgICAgICAgICByaWdodCBvZiBvcC5cbiAgICAgICAgICAtPiBFbmZvcmNlcyB1bmlxdWUgZXhlY3V0aW9uIG9yZGVyIC0+IGhhcHB5IHVzZXJcblxuICAgICAgICBJbXByb3ZlbWVudHM6IFRPRE9cbiAgICAgICAgICAqIENvdWxkIHNldCBsZWZ0IHRvIG9yaWdpbiwgb3IgdGhlIGZpcnN0IGtub3duIG9wZXJhdGlvblxuICAgICAgICAgICAgKHN0YXJ0U1Mgb3IgY3VyclNTLi4gPylcbiAgICAgICAgICAgIC0+IENvdWxkIGJlIG5lY2Vzc2FyeSB3aGVuIEkgdHVybiBHQyBhZ2Fpbi5cbiAgICAgICAgICAgIC0+IElzIGEgYmFkKGlzaCkgaWRlYSBiZWNhdXNlIGl0IHJlcXVpcmVzIG1vcmUgY29tcHV0YXRpb25cblxuICAgICAgV2hhdCB3ZSBkbzpcbiAgICAgICogSXRlcmF0ZSBvdmVyIGFsbCBtaXNzaW5nIG9wZXJhdGlvbnMuXG4gICAgICAqIFdoZW4gdGhlcmUgaXMgYW4gb3BlcmF0aW9uLCB3aGVyZSB0aGUgcmlnaHQgb3AgaXMga25vd24sIHNlbmQgdGhpcyBvcCBhbGwgbWlzc2luZyBvcHMgdG8gdGhlIGxlZnQgdG8gdGhlIHVzZXJcbiAgICAgICogSSBleHBsYWluZWQgYWJvdmUgd2hhdCB3ZSBoYXZlIHRvIGRvIHdpdGggZWFjaCBvcGVyYXRpb24uIEhlcmUgaXMgaG93IHdlIGRvIGl0IGVmZmljaWVudGx5OlxuICAgICAgICAxLiBHbyB0byB0aGUgbGVmdCB1bnRpbCB5b3UgZmluZCBlaXRoZXIgb3Aub3JpZ2luLCBvciBhIGtub3duIG9wZXJhdGlvbiAobGV0IG8gZGVub3RlIGN1cnJlbnQgb3BlcmF0aW9uIGluIHRoZSBpdGVyYXRpb24pXG4gICAgICAgIDIuIEZvdW5kIGEga25vd24gb3BlcmF0aW9uIC0+IHNldCBvcC5sZWZ0ID0gbywgYW5kIHNlbmQgaXQgdG8gdGhlIHVzZXIuIHN0b3BcbiAgICAgICAgMy4gRm91bmQgbyA9IG9wLm9yaWdpbiAtPiBzZXQgb3AubGVmdCA9IG9wLm9yaWdpbiwgYW5kIHNlbmQgaXQgdG8gdGhlIHVzZXIuIHN0YXJ0IGFnYWluIGZyb20gMS4gKHNldCBvcCA9IG8pXG4gICAgICAgIDQuIEZvdW5kIHNvbWUgbyAtPiBzZXQgby5yaWdodCA9IG9wLCBvLmxlZnQgPSBvLm9yaWdpbiwgc2VuZCBpdCB0byB0aGUgdXNlciwgY29udGludWVcbiAgICAqL1xuICAgICogZ2V0T3BlcmF0aW9ucyAoc3RhcnRTUykge1xuICAgICAgLy8gVE9ETzogdXNlIGJvdW5kcyBoZXJlIVxuICAgICAgaWYgKHN0YXJ0U1MgPT0gbnVsbCkge1xuICAgICAgICBzdGFydFNTID0ge31cbiAgICAgIH1cbiAgICAgIHZhciBzZW5kID0gW11cblxuICAgICAgdmFyIGVuZFNWID0geWllbGQqIHRoaXMuZ2V0U3RhdGVWZWN0b3IoKVxuICAgICAgZm9yICh2YXIgZW5kU3RhdGUgb2YgZW5kU1YpIHtcbiAgICAgICAgdmFyIHVzZXIgPSBlbmRTdGF0ZS51c2VyXG4gICAgICAgIGlmICh1c2VyID09PSAnXycpIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIHZhciBzdGFydFBvcyA9IHN0YXJ0U1NbdXNlcl0gfHwgMFxuICAgICAgICBpZiAoc3RhcnRQb3MgPiAwKSB7XG4gICAgICAgICAgLy8gVGhlcmUgaXMgYSBjaGFuZ2UgdGhhdCBbdXNlciwgc3RhcnRQb3NdIGlzIGluIGEgY29tcG9zZWQgSW5zZXJ0aW9uICh3aXRoIGEgc21hbGxlciBjb3VudGVyKVxuICAgICAgICAgIC8vIGZpbmQgb3V0IGlmIHRoYXQgaXMgdGhlIGNhc2VcbiAgICAgICAgICB2YXIgZmlyc3RNaXNzaW5nID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKFt1c2VyLCBzdGFydFBvc10pXG4gICAgICAgICAgaWYgKGZpcnN0TWlzc2luZyAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyB1cGRhdGUgc3RhcnRQb3NcbiAgICAgICAgICAgIHN0YXJ0UG9zID0gZmlyc3RNaXNzaW5nLmlkWzFdXG4gICAgICAgICAgICBzdGFydFNTW3VzZXJdID0gc3RhcnRQb3NcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgeWllbGQqIHRoaXMub3MuaXRlcmF0ZSh0aGlzLCBbdXNlciwgc3RhcnRQb3NdLCBbdXNlciwgTnVtYmVyLk1BWF9WQUxVRV0sIGZ1bmN0aW9uICogKG9wKSB7XG4gICAgICAgICAgb3AgPSBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvcClcbiAgICAgICAgICBpZiAob3Auc3RydWN0ICE9PSAnSW5zZXJ0Jykge1xuICAgICAgICAgICAgc2VuZC5wdXNoKG9wKVxuICAgICAgICAgIH0gZWxzZSBpZiAob3AucmlnaHQgPT0gbnVsbCB8fCBvcC5yaWdodFsxXSA8IChzdGFydFNTW29wLnJpZ2h0WzBdXSB8fCAwKSkge1xuICAgICAgICAgICAgLy8gY2FzZSAxLiBvcC5yaWdodCBpcyBrbm93blxuICAgICAgICAgICAgdmFyIG8gPSBvcFxuICAgICAgICAgICAgLy8gUmVtZW1iZXI6ID9cbiAgICAgICAgICAgIC8vIC0+IHNldCBvcC5yaWdodFxuICAgICAgICAgICAgLy8gICAgMS4gdG8gdGhlIGZpcnN0IG9wZXJhdGlvbiB0aGF0IGlzIGtub3duIChhY2NvcmRpbmcgdG8gc3RhcnRTUylcbiAgICAgICAgICAgIC8vICAgIDIuIG9yIHRvIHRoZSBmaXJzdCBvcGVyYXRpb24gdGhhdCBoYXMgYW4gb3JpZ2luIHRoYXQgaXMgbm90IHRvIHRoZVxuICAgICAgICAgICAgLy8gICAgICByaWdodCBvZiBvcC5cbiAgICAgICAgICAgIC8vIEZvciB0aGlzIHdlIG1haW50YWluIGEgbGlzdCBvZiBvcHMgd2hpY2ggb3JpZ2lucyBhcmUgbm90IGZvdW5kIHlldC5cbiAgICAgICAgICAgIHZhciBtaXNzaW5nX29yaWdpbnMgPSBbb3BdXG4gICAgICAgICAgICB2YXIgbmV3cmlnaHQgPSBvcC5yaWdodFxuICAgICAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgICAgaWYgKG8ubGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgb3AubGVmdCA9IG51bGxcbiAgICAgICAgICAgICAgICBzZW5kLnB1c2gob3ApXG4gICAgICAgICAgICAgICAgaWYgKCFZLnV0aWxzLmNvbXBhcmVJZHMoby5pZCwgb3AuaWQpKSB7XG4gICAgICAgICAgICAgICAgICBvID0gWS5TdHJ1Y3Rbb3Auc3RydWN0XS5lbmNvZGUobylcbiAgICAgICAgICAgICAgICAgIG8ucmlnaHQgPSBtaXNzaW5nX29yaWdpbnNbbWlzc2luZ19vcmlnaW5zLmxlbmd0aCAtIDFdLmlkXG4gICAgICAgICAgICAgICAgICBzZW5kLnB1c2gobylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG8ubGVmdClcbiAgICAgICAgICAgICAgLy8gd2Ugc2V0IGFub3RoZXIgbywgY2hlY2sgaWYgd2UgY2FuIHJlZHVjZSAkbWlzc2luZ19vcmlnaW5zXG4gICAgICAgICAgICAgIHdoaWxlIChtaXNzaW5nX29yaWdpbnMubGVuZ3RoID4gMCAmJiBZLnV0aWxzLm1hdGNoZXNJZChvLCBtaXNzaW5nX29yaWdpbnNbbWlzc2luZ19vcmlnaW5zLmxlbmd0aCAtIDFdLm9yaWdpbikpIHtcbiAgICAgICAgICAgICAgICBtaXNzaW5nX29yaWdpbnMucG9wKClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoby5pZFsxXSA8IChzdGFydFNTW28uaWRbMF1dIHx8IDApKSB7XG4gICAgICAgICAgICAgICAgLy8gY2FzZSAyLiBvIGlzIGtub3duXG4gICAgICAgICAgICAgICAgb3AubGVmdCA9IFkudXRpbHMuZ2V0TGFzdElkKG8pXG4gICAgICAgICAgICAgICAgc2VuZC5wdXNoKG9wKVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoWS51dGlscy5tYXRjaGVzSWQobywgb3Aub3JpZ2luKSkge1xuICAgICAgICAgICAgICAgIC8vIGNhc2UgMy4gbyBpcyBvcC5vcmlnaW5cbiAgICAgICAgICAgICAgICBvcC5sZWZ0ID0gb3Aub3JpZ2luXG4gICAgICAgICAgICAgICAgc2VuZC5wdXNoKG9wKVxuICAgICAgICAgICAgICAgIG9wID0gWS5TdHJ1Y3Rbb3Auc3RydWN0XS5lbmNvZGUobylcbiAgICAgICAgICAgICAgICBvcC5yaWdodCA9IG5ld3JpZ2h0XG4gICAgICAgICAgICAgICAgaWYgKG1pc3Npbmdfb3JpZ2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnVGhpcyBzaG91bGQgbm90IGhhcHBlbiAuLiA6KCBwbGVhc2UgcmVwb3J0IHRoaXMnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtaXNzaW5nX29yaWdpbnMgPSBbb3BdXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY2FzZSA0LiBzZW5kIG8sIGNvbnRpbnVlIHRvIGZpbmQgb3Aub3JpZ2luXG4gICAgICAgICAgICAgICAgdmFyIHMgPSBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvKVxuICAgICAgICAgICAgICAgIHMucmlnaHQgPSBtaXNzaW5nX29yaWdpbnNbbWlzc2luZ19vcmlnaW5zLmxlbmd0aCAtIDFdLmlkXG4gICAgICAgICAgICAgICAgcy5sZWZ0ID0gcy5vcmlnaW5cbiAgICAgICAgICAgICAgICBzZW5kLnB1c2gocylcbiAgICAgICAgICAgICAgICBtaXNzaW5nX29yaWdpbnMucHVzaChvKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuIHNlbmQucmV2ZXJzZSgpXG4gICAgfVxuICAgIC8qXG4gICAgICogR2V0IHRoZSBwbGFpbiB1bnRyYW5zZm9ybWVkIG9wZXJhdGlvbnMgZnJvbSB0aGUgZGF0YWJhc2UuXG4gICAgICogWW91IGNhbiBhcHBseSB0aGVzZSBvcGVyYXRpb25zIHVzaW5nIC5hcHBseU9wZXJhdGlvbnNVbnRyYW5zZm9ybWVkKG9wcylcbiAgICAgKlxuICAgICAqL1xuICAgICogZ2V0T3BlcmF0aW9uc1VudHJhbnNmb3JtZWQgKCkge1xuICAgICAgdmFyIG9wcyA9IFtdXG4gICAgICB5aWVsZCogdGhpcy5vcy5pdGVyYXRlKHRoaXMsIG51bGwsIG51bGwsIGZ1bmN0aW9uICogKG9wKSB7XG4gICAgICAgIGlmIChvcC5pZFswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgb3BzLnB1c2gob3ApXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICByZXR1cm4ge1xuICAgICAgICB1bnRyYW5zZm9ybWVkOiBvcHNcbiAgICAgIH1cbiAgICB9XG4gICAgKiBhcHBseU9wZXJhdGlvbnNVbnRyYW5zZm9ybWVkIChtLCBzdGF0ZVNldCkge1xuICAgICAgdmFyIG9wcyA9IG0udW50cmFuc2Zvcm1lZFxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9wID0gb3BzW2ldXG4gICAgICAgIC8vIGNyZWF0ZSwgYW5kIG1vZGlmeSBwYXJlbnQsIGlmIGl0IGlzIGNyZWF0ZWQgaW1wbGljaXRseVxuICAgICAgICBpZiAob3AucGFyZW50ICE9IG51bGwgJiYgb3AucGFyZW50WzBdID09PSAnXycpIHtcbiAgICAgICAgICBpZiAob3Auc3RydWN0ID09PSAnSW5zZXJ0Jykge1xuICAgICAgICAgICAgLy8gdXBkYXRlIHBhcmVudHMgLm1hcC9zdGFydC9lbmQgcHJvcGVydGllc1xuICAgICAgICAgICAgaWYgKG9wLnBhcmVudFN1YiAhPSBudWxsICYmIG9wLmxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAvLyBvcCBpcyBjaGlsZCBvZiBNYXBcbiAgICAgICAgICAgICAgbGV0IHBhcmVudCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5wYXJlbnQpXG4gICAgICAgICAgICAgIHBhcmVudC5tYXBbb3AucGFyZW50U3ViXSA9IG9wLmlkXG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihwYXJlbnQpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wLnJpZ2h0ID09IG51bGwgfHwgb3AubGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGxldCBwYXJlbnQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ob3AucGFyZW50KVxuICAgICAgICAgICAgICBpZiAob3AucmlnaHQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5lbmQgPSBZLnV0aWxzLmdldExhc3RJZChvcClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAob3AubGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnN0YXJ0ID0gb3AuaWRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocGFyZW50KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB5aWVsZCogdGhpcy5vcy5wdXQob3ApXG4gICAgICB9XG4gICAgICBmb3IgKHZhciB1c2VyIGluIHN0YXRlU2V0KSB7XG4gICAgICAgIHlpZWxkKiB0aGlzLnNzLnB1dCh7XG4gICAgICAgICAgaWQ6IFt1c2VyXSxcbiAgICAgICAgICBjbG9jazogc3RhdGVTZXRbdXNlcl1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gICAgLyogdGhpcyBpcyB3aGF0IHdlIHVzZWQgYmVmb3JlLi4gdXNlIHRoaXMgYXMgYSByZWZlcmVuY2UuLlxuICAgICogbWFrZU9wZXJhdGlvblJlYWR5IChzdGFydFNTLCBvcCkge1xuICAgICAgb3AgPSBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvcClcbiAgICAgIG9wID0gWS51dGlscy5jb3B5T2JqZWN0KG9wKSAtLSB1c2UgY29weW9wZXJhdGlvbiBpbnN0ZWFkIG5vdyFcbiAgICAgIHZhciBvID0gb3BcbiAgICAgIHZhciBpZHMgPSBbb3AuaWRdXG4gICAgICAvLyBzZWFyY2ggZm9yIHRoZSBuZXcgb3AucmlnaHRcbiAgICAgIC8vIGl0IGlzIGVpdGhlciB0aGUgZmlyc3Qga25vd24gb3AgKGFjY29yZGluZyB0byBzdGFydFNTKVxuICAgICAgLy8gb3IgdGhlIG8gdGhhdCBoYXMgbm8gb3JpZ2luIHRvIHRoZSByaWdodCBvZiBvcFxuICAgICAgLy8gKHRoaXMgaXMgd2h5IHdlIHVzZSB0aGUgaWRzIGFycmF5KVxuICAgICAgd2hpbGUgKG8ucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICB2YXIgcmlnaHQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oby5yaWdodClcbiAgICAgICAgaWYgKG8ucmlnaHRbMV0gPCAoc3RhcnRTU1tvLnJpZ2h0WzBdXSB8fCAwKSB8fCAhaWRzLnNvbWUoZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgcmV0dXJuIFkudXRpbHMuY29tcGFyZUlkcyhpZCwgcmlnaHQub3JpZ2luKVxuICAgICAgICB9KSkge1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgaWRzLnB1c2goby5yaWdodClcbiAgICAgICAgbyA9IHJpZ2h0XG4gICAgICB9XG4gICAgICBvcC5yaWdodCA9IG8ucmlnaHRcbiAgICAgIG9wLmxlZnQgPSBvcC5vcmlnaW5cbiAgICAgIHJldHVybiBvcFxuICAgIH1cbiAgICAqL1xuICAgICogZmx1c2ggKCkge1xuICAgICAgeWllbGQqIHRoaXMub3MuZmx1c2goKVxuICAgICAgeWllbGQqIHRoaXMuc3MuZmx1c2goKVxuICAgICAgeWllbGQqIHRoaXMuZHMuZmx1c2goKVxuICAgIH1cbiAgfVxuICBZLlRyYW5zYWN0aW9uID0gVHJhbnNhY3Rpb25JbnRlcmZhY2Vcbn1cbiIsIi8qIEBmbG93ICovXG4ndXNlIHN0cmljdCdcblxuLypcbiAgRXZlbnRIYW5kbGVyIGlzIGFuIGhlbHBlciBjbGFzcyBmb3IgY29uc3RydWN0aW5nIGN1c3RvbSB0eXBlcy5cblxuICBXaHk6IFdoZW4gY29uc3RydWN0aW5nIGN1c3RvbSB0eXBlcywgeW91IHNvbWV0aW1lcyB3YW50IHlvdXIgdHlwZXMgdG8gd29ya1xuICBzeW5jaHJvbm91czogRS5nLlxuICBgYGAgU3luY2hyb25vdXNcbiAgICBteXR5cGUuc2V0U29tZXRoaW5nKFwieWF5XCIpXG4gICAgbXl0eXBlLmdldFNvbWV0aGluZygpID09PSBcInlheVwiXG4gIGBgYFxuICB2ZXJzdXNcbiAgYGBgIEFzeW5jaHJvbm91c1xuICAgIG15dHlwZS5zZXRTb21ldGhpbmcoXCJ5YXlcIilcbiAgICBteXR5cGUuZ2V0U29tZXRoaW5nKCkgPT09IHVuZGVmaW5lZFxuICAgIG15dHlwZS53YWl0Rm9yU29tZXRoaW5nKCkudGhlbihmdW5jdGlvbigpe1xuICAgICAgbXl0eXBlLmdldFNvbWV0aGluZygpID09PSBcInlheVwiXG4gICAgfSlcbiAgYGBgXG5cbiAgVGhlIHN0cnVjdHVyZXMgdXN1YWxseSB3b3JrIGFzeW5jaHJvbm91c2x5ICh5b3UgaGF2ZSB0byB3YWl0IGZvciB0aGVcbiAgZGF0YWJhc2UgcmVxdWVzdCB0byBmaW5pc2gpLiBFdmVudEhhbmRsZXIgaGVscHMgeW91IHRvIG1ha2UgeW91ciB0eXBlXG4gIHN5bmNocm9ub3VzLlxuKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFkgLyogOiBhbnkqLykge1xuICBZLnV0aWxzID0ge31cblxuICBZLnV0aWxzLmJ1YmJsZUV2ZW50ID0gZnVuY3Rpb24gKHR5cGUsIGV2ZW50KSB7XG4gICAgdHlwZS5ldmVudEhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKGV2ZW50KVxuICAgIGV2ZW50LnBhdGggPSBbXVxuICAgIHdoaWxlICh0eXBlICE9IG51bGwgJiYgdHlwZS5fZGVlcEV2ZW50SGFuZGxlciAhPSBudWxsKSB7XG4gICAgICB0eXBlLl9kZWVwRXZlbnRIYW5kbGVyLmNhbGxFdmVudExpc3RlbmVycyhldmVudClcbiAgICAgIHZhciBwYXJlbnQgPSBudWxsXG4gICAgICBpZiAodHlwZS5fcGFyZW50ICE9IG51bGwpIHtcbiAgICAgICAgcGFyZW50ID0gdHlwZS5vcy5nZXRUeXBlKHR5cGUuX3BhcmVudClcbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQuX2dldFBhdGhUb0NoaWxkICE9IG51bGwpIHtcbiAgICAgICAgZXZlbnQucGF0aCA9IFtwYXJlbnQuX2dldFBhdGhUb0NoaWxkKHR5cGUuX21vZGVsKV0uY29uY2F0KGV2ZW50LnBhdGgpXG4gICAgICAgIHR5cGUgPSBwYXJlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHR5cGUgPSBudWxsXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY2xhc3MgRXZlbnRMaXN0ZW5lckhhbmRsZXIge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSBbXVxuICAgIH1cbiAgICBkZXN0cm95ICgpIHtcbiAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSBudWxsXG4gICAgfVxuICAgICAvKlxuICAgICAgQmFzaWMgZXZlbnQgbGlzdGVuZXIgYm9pbGVycGxhdGUuLi5cbiAgICAqL1xuICAgIGFkZEV2ZW50TGlzdGVuZXIgKGYpIHtcbiAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMucHVzaChmKVxuICAgIH1cbiAgICByZW1vdmVFdmVudExpc3RlbmVyIChmKSB7XG4gICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzID0gdGhpcy5ldmVudExpc3RlbmVycy5maWx0ZXIoZnVuY3Rpb24gKGcpIHtcbiAgICAgICAgcmV0dXJuIGYgIT09IGdcbiAgICAgIH0pXG4gICAgfVxuICAgIHJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzICgpIHtcbiAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSBbXVxuICAgIH1cbiAgICBjYWxsRXZlbnRMaXN0ZW5lcnMgKGV2ZW50KSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZXZlbnRMaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgX2V2ZW50ID0ge31cbiAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIGV2ZW50KSB7XG4gICAgICAgICAgICBfZXZlbnRbbmFtZV0gPSBldmVudFtuYW1lXVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzW2ldKF9ldmVudClcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1lvdXIgb2JzZXJ2ZXIgdGhyZXcgYW4gZXJyb3IuIFRoaXMgZXJyb3Igd2FzIGNhdWdodCBzbyB0aGF0IFlqcyBzdGlsbCBjYW4gZW5zdXJlIGRhdGEgY29uc2lzdGVuY3khIEluIG9yZGVyIHRvIGRlYnVnIHRoaXMgZXJyb3IgeW91IGhhdmUgdG8gY2hlY2sgXCJQYXVzZSBPbiBDYXVnaHQgRXhjZXB0aW9uc1wiJywgZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBZLnV0aWxzLkV2ZW50TGlzdGVuZXJIYW5kbGVyID0gRXZlbnRMaXN0ZW5lckhhbmRsZXJcblxuICBjbGFzcyBFdmVudEhhbmRsZXIgZXh0ZW5kcyBFdmVudExpc3RlbmVySGFuZGxlciB7XG4gICAgLyogOjpcbiAgICB3YWl0aW5nOiBBcnJheTxJbnNlcnRpb24gfCBEZWxldGlvbj47XG4gICAgYXdhaXRpbmc6IG51bWJlcjtcbiAgICBvbmV2ZW50OiBGdW5jdGlvbjtcbiAgICBldmVudExpc3RlbmVyczogQXJyYXk8RnVuY3Rpb24+O1xuICAgICovXG4gICAgLypcbiAgICAgIG9uZXZlbnQ6IGlzIGNhbGxlZCB3aGVuIHRoZSBzdHJ1Y3R1cmUgY2hhbmdlcy5cblxuICAgICAgTm90ZTogXCJhd2FpdGluZyBvcGVydGF0aW9uc1wiIGlzIHVzZWQgdG8gZGVub3RlIG9wZXJhdGlvbnMgdGhhdCB3ZXJlXG4gICAgICBwcmVtYXR1cmVseSBjYWxsZWQuIEV2ZW50cyBmb3IgcmVjZWl2ZWQgb3BlcmF0aW9ucyBjYW4gbm90IGJlIGV4ZWN1dGVkIHVudGlsXG4gICAgICBhbGwgcHJlbWF0dXJlbHkgY2FsbGVkIG9wZXJhdGlvbnMgd2VyZSBleGVjdXRlZCAoXCJ3YWl0aW5nIG9wZXJhdGlvbnNcIilcbiAgICAqL1xuICAgIGNvbnN0cnVjdG9yIChvbmV2ZW50IC8qIDogRnVuY3Rpb24gKi8pIHtcbiAgICAgIHN1cGVyKClcbiAgICAgIHRoaXMud2FpdGluZyA9IFtdXG4gICAgICB0aGlzLmF3YWl0aW5nID0gMFxuICAgICAgdGhpcy5vbmV2ZW50ID0gb25ldmVudFxuICAgIH1cbiAgICBkZXN0cm95ICgpIHtcbiAgICAgIHN1cGVyLmRlc3Ryb3koKVxuICAgICAgdGhpcy53YWl0aW5nID0gbnVsbFxuICAgICAgdGhpcy5vbmV2ZW50ID0gbnVsbFxuICAgIH1cbiAgICAvKlxuICAgICAgQ2FsbCB0aGlzIHdoZW4gYSBuZXcgb3BlcmF0aW9uIGFycml2ZXMuIEl0IHdpbGwgYmUgZXhlY3V0ZWQgcmlnaHQgYXdheSBpZlxuICAgICAgdGhlcmUgYXJlIG5vIHdhaXRpbmcgb3BlcmF0aW9ucywgdGhhdCB5b3UgcHJlbWF0dXJlbHkgZXhlY3V0ZWRcbiAgICAqL1xuICAgIHJlY2VpdmVkT3AgKG9wKSB7XG4gICAgICBpZiAodGhpcy5hd2FpdGluZyA8PSAwKSB7XG4gICAgICAgIHRoaXMub25ldmVudChvcClcbiAgICAgIH0gZWxzZSBpZiAob3Auc3RydWN0ID09PSAnRGVsZXRlJykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgICAgdmFyIGNoZWNrRGVsZXRlID0gZnVuY3Rpb24gY2hlY2tEZWxldGUgKGQpIHtcbiAgICAgICAgICBpZiAoZC5sZW5ndGggPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGlzIHNob3VsZG5cXCd0IGhhcHBlbiEgZC5sZW5ndGggbXVzdCBiZSBkZWZpbmVkIScpXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHdlIGNoZWNrIGlmIG8gZGVsZXRlcyBzb21ldGhpbmcgaW4gc2VsZi53YWl0aW5nXG4gICAgICAgICAgLy8gaWYgc28sIHdlIHJlbW92ZSB0aGUgZGVsZXRlZCBvcGVyYXRpb25cbiAgICAgICAgICBmb3IgKHZhciB3ID0gMDsgdyA8IHNlbGYud2FpdGluZy5sZW5ndGg7IHcrKykge1xuICAgICAgICAgICAgdmFyIGkgPSBzZWxmLndhaXRpbmdbd11cbiAgICAgICAgICAgIGlmIChpLnN0cnVjdCA9PT0gJ0luc2VydCcgJiYgaS5pZFswXSA9PT0gZC50YXJnZXRbMF0pIHtcbiAgICAgICAgICAgICAgdmFyIGlMZW5ndGggPSBpLmhhc093blByb3BlcnR5KCdjb250ZW50JykgPyBpLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgICAgICAgICB2YXIgZFN0YXJ0ID0gZC50YXJnZXRbMV1cbiAgICAgICAgICAgICAgdmFyIGRFbmQgPSBkLnRhcmdldFsxXSArIChkLmxlbmd0aCB8fCAxKVxuICAgICAgICAgICAgICB2YXIgaVN0YXJ0ID0gaS5pZFsxXVxuICAgICAgICAgICAgICB2YXIgaUVuZCA9IGkuaWRbMV0gKyBpTGVuZ3RoXG4gICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZXkgZG9uJ3Qgb3ZlcmxhcFxuICAgICAgICAgICAgICBpZiAoaUVuZCA8PSBkU3RhcnQgfHwgZEVuZCA8PSBpU3RhcnQpIHtcbiAgICAgICAgICAgICAgICAvLyBubyBvdmVybGFwcGluZ1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gd2UgY2hlY2sgYWxsIG92ZXJsYXBwaW5nIGNhc2VzLiBBbGwgY2FzZXM6XG4gICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgMSkgIGlpaWlpXG4gICAgICAgICAgICAgICAgICAgICAgZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IG1vZGlmeSBpIGFuZCBkXG4gICAgICAgICAgICAgICAgMikgIGlpaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgICBkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gbW9kaWZ5IGksIHJlbW92ZSBkXG4gICAgICAgICAgICAgICAgMykgIGlpaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgICBkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IHJlbW92ZSBkLCBtb2RpZnkgaSwgYW5kIGNyZWF0ZSBhbm90aGVyIGkgKGZvciB0aGUgcmlnaHQgaGFuZCBzaWRlKVxuICAgICAgICAgICAgICAgIDQpICBpaWlpaVxuICAgICAgICAgICAgICAgICAgICBkZGRkZGRkXG4gICAgICAgICAgICAgICAgICAgIC0tPiByZW1vdmUgaSwgbW9kaWZ5IGRcbiAgICAgICAgICAgICAgICA1KSAgaWlpaWlpaVxuICAgICAgICAgICAgICAgICAgICBkZGRkZGRkXG4gICAgICAgICAgICAgICAgICAgIC0tPiByZW1vdmUgYm90aCBpIGFuZCBkICgqKilcbiAgICAgICAgICAgICAgICA2KSAgaWlpaWlpaVxuICAgICAgICAgICAgICAgICAgICBkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gbW9kaWZ5IGksIHJlbW92ZSBkXG4gICAgICAgICAgICAgICAgNykgICAgaWlpXG4gICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IHJlbW92ZSBpLCBjcmVhdGUgYW5kIGFwcGx5IHR3byBkIHdpdGggY2hlY2tEZWxldGUoZCkgKCoqKVxuICAgICAgICAgICAgICAgIDgpICAgIGlpaWlpXG4gICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IHJlbW92ZSBpLCBtb2RpZnkgZCAoKiopXG4gICAgICAgICAgICAgICAgOSkgICAgaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IG1vZGlmeSBpIGFuZCBkXG4gICAgICAgICAgICAgICAgKCoqKSAoYWxzbyBjaGVjayBpZiBpIGNvbnRhaW5zIGNvbnRlbnQgb3IgdHlwZSlcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgLy8gVE9ETzogSSBsZWZ0IHNvbWUgZGVidWdnZXIgc3RhdGVtZW50cywgYmVjYXVzZSBJIHdhbnQgdG8gZGVidWcgYWxsIGNhc2VzIG9uY2UgaW4gcHJvZHVjdGlvbi4gUkVNRU1CRVIgRU5EIFRPRE9cbiAgICAgICAgICAgICAgaWYgKGlTdGFydCA8IGRTdGFydCkge1xuICAgICAgICAgICAgICAgIGlmIChkU3RhcnQgPCBpRW5kKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaUVuZCA8IGRFbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FzZSAxXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSB0aGUgcmlnaHQgcGFydCBvZiBpJ3MgY29udGVudFxuICAgICAgICAgICAgICAgICAgICBpLmNvbnRlbnQuc3BsaWNlKGRTdGFydCAtIGlTdGFydClcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIHRoZSBzdGFydCBvZiBkJ3MgZGVsZXRpb25cbiAgICAgICAgICAgICAgICAgICAgZC5sZW5ndGggPSBkRW5kIC0gaUVuZFxuICAgICAgICAgICAgICAgICAgICBkLnRhcmdldCA9IFtkLnRhcmdldFswXSwgaUVuZF1cbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaUVuZCA9PT0gZEVuZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDJcbiAgICAgICAgICAgICAgICAgICAgaS5jb250ZW50LnNwbGljZShkU3RhcnQgLSBpU3RhcnQpXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBkLCB3ZSBkbyB0aGF0IGJ5IHNpbXBseSBlbmRpbmcgdGhpcyBmdW5jdGlvblxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIChkRW5kIDwgaUVuZClcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FzZSAzXG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdJID0ge1xuICAgICAgICAgICAgICAgICAgICAgIGlkOiBbaS5pZFswXSwgZEVuZF0sXG4gICAgICAgICAgICAgICAgICAgICAgY29udGVudDogaS5jb250ZW50LnNsaWNlKGRFbmQgLSBpU3RhcnQpLFxuICAgICAgICAgICAgICAgICAgICAgIHN0cnVjdDogJ0luc2VydCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWxmLndhaXRpbmcucHVzaChuZXdJKVxuICAgICAgICAgICAgICAgICAgICBpLmNvbnRlbnQuc3BsaWNlKGRTdGFydCAtIGlTdGFydClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRTdGFydCA9PT0gaVN0YXJ0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGlFbmQgPCBkRW5kKSB7XG4gICAgICAgICAgICAgICAgICAvLyBDYXNlIDRcbiAgICAgICAgICAgICAgICAgIGQubGVuZ3RoID0gZEVuZCAtIGlFbmRcbiAgICAgICAgICAgICAgICAgIGQudGFyZ2V0ID0gW2QudGFyZ2V0WzBdLCBpRW5kXVxuICAgICAgICAgICAgICAgICAgaS5jb250ZW50ID0gW11cbiAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpRW5kID09PSBkRW5kKSB7XG4gICAgICAgICAgICAgICAgICAvLyBDYXNlIDVcbiAgICAgICAgICAgICAgICAgIHNlbGYud2FpdGluZy5zcGxpY2UodywgMSlcbiAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIChkRW5kIDwgaUVuZClcbiAgICAgICAgICAgICAgICAgIC8vIENhc2UgNlxuICAgICAgICAgICAgICAgICAgaS5jb250ZW50ID0gaS5jb250ZW50LnNsaWNlKGRFbmQgLSBpU3RhcnQpXG4gICAgICAgICAgICAgICAgICBpLmlkID0gW2kuaWRbMF0sIGRFbmRdXG4gICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7IC8vIChkU3RhcnQgPCBpU3RhcnQpXG4gICAgICAgICAgICAgICAgaWYgKGlTdGFydCA8IGRFbmQpIHtcbiAgICAgICAgICAgICAgICAgIC8vIHRoZXkgb3ZlcmxhcFxuICAgICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgIDcpICAgIGlpaVxuICAgICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgICAtLT4gcmVtb3ZlIGksIGNyZWF0ZSBhbmQgYXBwbHkgdHdvIGQgd2l0aCBjaGVja0RlbGV0ZShkKSAoKiopXG4gICAgICAgICAgICAgICAgICA4KSAgICBpaWlpaVxuICAgICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgICAtLT4gcmVtb3ZlIGksIG1vZGlmeSBkICgqKilcbiAgICAgICAgICAgICAgICAgIDkpICAgIGlpaWlpXG4gICAgICAgICAgICAgICAgICAgICAgZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgICAtLT4gbW9kaWZ5IGkgYW5kIGRcbiAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICBpZiAoaUVuZCA8IGRFbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FzZSA3XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlYnVnZ2VyIC8vIFRPRE86IFlvdSBkaWQgbm90IHRlc3QgdGhpcyBjYXNlIHlldCEhISEgKGFkZCB0aGUgZGVidWdnZXIgaGVyZSlcbiAgICAgICAgICAgICAgICAgICAgc2VsZi53YWl0aW5nLnNwbGljZSh3LCAxKVxuICAgICAgICAgICAgICAgICAgICBjaGVja0RlbGV0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBbZC50YXJnZXRbMF0sIGRTdGFydF0sXG4gICAgICAgICAgICAgICAgICAgICAgbGVuZ3RoOiBpU3RhcnQgLSBkU3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgc3RydWN0OiAnRGVsZXRlJ1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBjaGVja0RlbGV0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBbZC50YXJnZXRbMF0sIGlFbmRdLFxuICAgICAgICAgICAgICAgICAgICAgIGxlbmd0aDogaUVuZCAtIGRFbmQsXG4gICAgICAgICAgICAgICAgICAgICAgc3RydWN0OiAnRGVsZXRlJ1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaUVuZCA9PT0gZEVuZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDhcbiAgICAgICAgICAgICAgICAgICAgc2VsZi53YWl0aW5nLnNwbGljZSh3LCAxKVxuICAgICAgICAgICAgICAgICAgICB3LS1cbiAgICAgICAgICAgICAgICAgICAgZC5sZW5ndGggLT0gaUxlbmd0aFxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gZEVuZCA8IGlFbmRcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FzZSA5XG4gICAgICAgICAgICAgICAgICAgIGQubGVuZ3RoID0gaVN0YXJ0IC0gZFN0YXJ0XG4gICAgICAgICAgICAgICAgICAgIGkuY29udGVudC5zcGxpY2UoMCwgZEVuZCAtIGlTdGFydClcbiAgICAgICAgICAgICAgICAgICAgaS5pZCA9IFtpLmlkWzBdLCBkRW5kXVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5pc2hlZCB3aXRoIHJlbWFpbmluZyBvcGVyYXRpb25zXG4gICAgICAgICAgc2VsZi53YWl0aW5nLnB1c2goZClcbiAgICAgICAgfVxuICAgICAgICBpZiAob3Aua2V5ID09IG51bGwpIHtcbiAgICAgICAgICAvLyBkZWxldGVzIGluIGxpc3RcbiAgICAgICAgICBjaGVja0RlbGV0ZShvcClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBkZWxldGVzIGluIG1hcFxuICAgICAgICAgIHRoaXMud2FpdGluZy5wdXNoKG9wKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLndhaXRpbmcucHVzaChvcClcbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIFlvdSBjcmVhdGVkIHNvbWUgb3BlcmF0aW9ucywgYW5kIHlvdSB3YW50IHRoZSBgb25ldmVudGAgZnVuY3Rpb24gdG8gYmVcbiAgICAgIGNhbGxlZCByaWdodCBhd2F5LiBSZWNlaXZlZCBvcGVyYXRpb25zIHdpbGwgbm90IGJlIGV4ZWN1dGVkIHVudGlsbCBhbGxcbiAgICAgIHByZW1hdHVyZWx5IGNhbGxlZCBvcGVyYXRpb25zIGFyZSBleGVjdXRlZFxuICAgICovXG4gICAgYXdhaXRBbmRQcmVtYXR1cmVseUNhbGwgKG9wcykge1xuICAgICAgdGhpcy5hd2FpdGluZysrXG4gICAgICBvcHMubWFwKFkudXRpbHMuY29weU9wZXJhdGlvbikuZm9yRWFjaCh0aGlzLm9uZXZlbnQpXG4gICAgfVxuICAgICogYXdhaXRPcHMgKHRyYW5zYWN0aW9uLCBmLCBhcmdzKSB7XG4gICAgICBmdW5jdGlvbiBub3RTb1NtYXJ0U29ydCAoYXJyYXkpIHtcbiAgICAgICAgLy8gdGhpcyBmdW5jdGlvbiBzb3J0cyBpbnNlcnRpb25zIGluIGEgZXhlY3V0YWJsZSBvcmRlclxuICAgICAgICB2YXIgcmVzdWx0ID0gW11cbiAgICAgICAgd2hpbGUgKGFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgaW5kZXBlbmRlbnQgPSB0cnVlXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGFycmF5Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgIGlmIChZLnV0aWxzLm1hdGNoZXNJZChhcnJheVtqXSwgYXJyYXlbaV0ubGVmdCkpIHtcbiAgICAgICAgICAgICAgICAvLyBhcnJheVtpXSBkZXBlbmRzIG9uIGFycmF5W2pdXG4gICAgICAgICAgICAgICAgaW5kZXBlbmRlbnQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmRlcGVuZGVudCkge1xuICAgICAgICAgICAgICByZXN1bHQucHVzaChhcnJheS5zcGxpY2UoaSwgMSlbMF0pXG4gICAgICAgICAgICAgIGktLVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9XG4gICAgICB2YXIgYmVmb3JlID0gdGhpcy53YWl0aW5nLmxlbmd0aFxuICAgICAgLy8gc29tZWhvdyBjcmVhdGUgbmV3IG9wZXJhdGlvbnNcbiAgICAgIHlpZWxkKiBmLmFwcGx5KHRyYW5zYWN0aW9uLCBhcmdzKVxuICAgICAgLy8gcmVtb3ZlIGFsbCBhcHBlbmRlZCBvcHMgLyBhd2FpdGVkIG9wc1xuICAgICAgdGhpcy53YWl0aW5nLnNwbGljZShiZWZvcmUpXG4gICAgICBpZiAodGhpcy5hd2FpdGluZyA+IDApIHRoaXMuYXdhaXRpbmctLVxuICAgICAgLy8gaWYgdGhlcmUgYXJlIG5vIGF3YWl0ZWQgb3BzIGFueW1vcmUsIHdlIGNhbiB1cGRhdGUgYWxsIHdhaXRpbmcgb3BzLCBhbmQgc2VuZCBleGVjdXRlIHRoZW0gKGlmIHRoZXJlIGFyZSBzdGlsbCBubyBhd2FpdGVkIG9wcylcbiAgICAgIGlmICh0aGlzLmF3YWl0aW5nID09PSAwICYmIHRoaXMud2FpdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIHVwZGF0ZSBhbGwgd2FpdGluZyBvcHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLndhaXRpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgbyA9IHRoaXMud2FpdGluZ1tpXVxuICAgICAgICAgIGlmIChvLnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICAgIHZhciBfbyA9IHlpZWxkKiB0cmFuc2FjdGlvbi5nZXRJbnNlcnRpb24oby5pZClcbiAgICAgICAgICAgIGlmIChfby5wYXJlbnRTdWIgIT0gbnVsbCAmJiBfby5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gaWYgbyBpcyBhbiBpbnNlcnRpb24gb2YgYSBtYXAgc3RydWMgKHBhcmVudFN1YiBpcyBkZWZpbmVkKSwgdGhlbiBpdCBzaG91bGRuJ3QgYmUgbmVjZXNzYXJ5IHRvIGNvbXB1dGUgbGVmdFxuICAgICAgICAgICAgICB0aGlzLndhaXRpbmcuc3BsaWNlKGksIDEpXG4gICAgICAgICAgICAgIGktLSAvLyB1cGRhdGUgaW5kZXhcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIVkudXRpbHMuY29tcGFyZUlkcyhfby5pZCwgby5pZCkpIHtcbiAgICAgICAgICAgICAgLy8gbyBnb3QgZXh0ZW5kZWRcbiAgICAgICAgICAgICAgby5sZWZ0ID0gW28uaWRbMF0sIG8uaWRbMV0gLSAxXVxuICAgICAgICAgICAgfSBlbHNlIGlmIChfby5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgby5sZWZ0ID0gbnVsbFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gZmluZCBuZXh0IHVuZGVsZXRlZCBvcFxuICAgICAgICAgICAgICB2YXIgbGVmdCA9IHlpZWxkKiB0cmFuc2FjdGlvbi5nZXRJbnNlcnRpb24oX28ubGVmdClcbiAgICAgICAgICAgICAgd2hpbGUgKGxlZnQuZGVsZXRlZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxlZnQubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICBsZWZ0ID0geWllbGQqIHRyYW5zYWN0aW9uLmdldEluc2VydGlvbihsZWZ0LmxlZnQpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGxlZnQgPSBudWxsXG4gICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBvLmxlZnQgPSBsZWZ0ICE9IG51bGwgPyBZLnV0aWxzLmdldExhc3RJZChsZWZ0KSA6IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhlIHByZXZpb3VzIHN0dWZmIHdhcyBhc3luYywgc28gd2UgaGF2ZSB0byBjaGVjayBhZ2FpbiFcbiAgICAgICAgLy8gV2UgYWxzbyBwdWxsIGNoYW5nZXMgZnJvbSB0aGUgYmluZGluZ3MsIGlmIHRoZXJlIGV4aXN0cyBzdWNoIGEgbWV0aG9kLCB0aGlzIGNvdWxkIGluY3JlYXNlIGF3YWl0aW5nIHRvb1xuICAgICAgICBpZiAodGhpcy5fcHVsbENoYW5nZXMgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuX3B1bGxDaGFuZ2VzKClcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5hd2FpdGluZyA9PT0gMCkge1xuICAgICAgICAgIC8vIHNvcnQgYnkgdHlwZSwgZXhlY3V0ZSBpbnNlcnRzIGZpcnN0XG4gICAgICAgICAgdmFyIGlucyA9IFtdXG4gICAgICAgICAgdmFyIGRlbHMgPSBbXVxuICAgICAgICAgIHRoaXMud2FpdGluZy5mb3JFYWNoKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgICBpZiAoby5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgICAgIGRlbHMucHVzaChvKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaW5zLnB1c2gobylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIHRoaXMud2FpdGluZyA9IFtdXG4gICAgICAgICAgLy8gcHV0IGluIGV4ZWN1dGFibGUgb3JkZXJcbiAgICAgICAgICBpbnMgPSBub3RTb1NtYXJ0U29ydChpbnMpXG4gICAgICAgICAgLy8gdGhpcy5vbmV2ZW50IGNhbiB0cmlnZ2VyIHRoZSBjcmVhdGlvbiBvZiBhbm90aGVyIG9wZXJhdGlvblxuICAgICAgICAgIC8vIC0+IGNoZWNrIGlmIHRoaXMuYXdhaXRpbmcgaW5jcmVhc2VkICYgc3RvcCBjb21wdXRhdGlvbiBpZiBpdCBkb2VzXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmF3YWl0aW5nID09PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMub25ldmVudChpbnNbaV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLndhaXRpbmcgPSB0aGlzLndhaXRpbmcuY29uY2F0KGlucy5zbGljZShpKSlcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGRlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmF3YWl0aW5nID09PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMub25ldmVudChkZWxzW2ldKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy53YWl0aW5nID0gdGhpcy53YWl0aW5nLmNvbmNhdChkZWxzLnNsaWNlKGkpKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBUT0RPOiBSZW1vdmUgYXdhaXRlZEluc2VydHMgYW5kIGF3YWl0ZWREZWxldGVzIGluIGZhdm9yIG9mIGF3YWl0ZWRPcHMsIGFzIHRoZXkgYXJlIGRlcHJlY2F0ZWQgYW5kIGRvIG5vdCBhbHdheXMgd29ya1xuICAgIC8vIERvIHRoaXMgaW4gb25lIG9mIHRoZSBjb21pbmcgcmVsZWFzZXMgdGhhdCBhcmUgYnJlYWtpbmcgYW55d2F5XG4gICAgLypcbiAgICAgIENhbGwgdGhpcyB3aGVuIHlvdSBzdWNjZXNzZnVsbHkgYXdhaXRlZCB0aGUgZXhlY3V0aW9uIG9mIG4gSW5zZXJ0IG9wZXJhdGlvbnNcbiAgICAqL1xuICAgIGF3YWl0ZWRJbnNlcnRzIChuKSB7XG4gICAgICB2YXIgb3BzID0gdGhpcy53YWl0aW5nLnNwbGljZSh0aGlzLndhaXRpbmcubGVuZ3RoIC0gbilcbiAgICAgIGZvciAodmFyIG9pZCA9IDA7IG9pZCA8IG9wcy5sZW5ndGg7IG9pZCsrKSB7XG4gICAgICAgIHZhciBvcCA9IG9wc1tvaWRdXG4gICAgICAgIGlmIChvcC5zdHJ1Y3QgPT09ICdJbnNlcnQnKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMud2FpdGluZy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgbGV0IHcgPSB0aGlzLndhaXRpbmdbaV1cbiAgICAgICAgICAgIC8vIFRPRE86IGRvIEkgaGFuZGxlIHNwbGl0IG9wZXJhdGlvbnMgY29ycmVjdGx5IGhlcmU/IFN1cGVyIHVubGlrZWx5LCBidXQgeWVhaC4uXG4gICAgICAgICAgICAvLyBBbHNvOiBjYW4gdGhpcyBjYXNlIGhhcHBlbj8gQ2FuIG9wIGJlIGluc2VydGVkIGluIHRoZSBtaWRkbGUgb2YgYSBsYXJnZXIgb3AgdGhhdCBpcyBpbiAkd2FpdGluZz9cbiAgICAgICAgICAgIGlmICh3LnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICAgICAgaWYgKFkudXRpbHMubWF0Y2hlc0lkKHcsIG9wLmxlZnQpKSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jbHVkZSB0aGUgZWZmZWN0IG9mIG9wIGluIHdcbiAgICAgICAgICAgICAgICB3LnJpZ2h0ID0gb3AuaWRcbiAgICAgICAgICAgICAgICAvLyBleGNsdWRlIHRoZSBlZmZlY3Qgb2YgdyBpbiBvcFxuICAgICAgICAgICAgICAgIG9wLmxlZnQgPSB3LmxlZnRcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChZLnV0aWxzLmNvbXBhcmVJZHMody5pZCwgb3AucmlnaHQpKSB7XG4gICAgICAgICAgICAgICAgLy8gc2ltaWxhci4uXG4gICAgICAgICAgICAgICAgdy5sZWZ0ID0gWS51dGlscy5nZXRMYXN0SWQob3ApXG4gICAgICAgICAgICAgICAgb3AucmlnaHQgPSB3LnJpZ2h0XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBJbnNlcnQgT3BlcmF0aW9uIScpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyeUNhbGxFdmVudHMobilcbiAgICB9XG4gICAgLypcbiAgICAgIENhbGwgdGhpcyB3aGVuIHlvdSBzdWNjZXNzZnVsbHkgYXdhaXRlZCB0aGUgZXhlY3V0aW9uIG9mIG4gRGVsZXRlIG9wZXJhdGlvbnNcbiAgICAqL1xuICAgIGF3YWl0ZWREZWxldGVzIChuLCBuZXdMZWZ0KSB7XG4gICAgICB2YXIgb3BzID0gdGhpcy53YWl0aW5nLnNwbGljZSh0aGlzLndhaXRpbmcubGVuZ3RoIC0gbilcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgb3BzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHZhciBkZWwgPSBvcHNbal1cbiAgICAgICAgaWYgKGRlbC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgaWYgKG5ld0xlZnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLndhaXRpbmcubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgbGV0IHcgPSB0aGlzLndhaXRpbmdbaV1cbiAgICAgICAgICAgICAgLy8gV2Ugd2lsbCBqdXN0IGNhcmUgYWJvdXQgdy5sZWZ0XG4gICAgICAgICAgICAgIGlmICh3LnN0cnVjdCA9PT0gJ0luc2VydCcgJiYgWS51dGlscy5jb21wYXJlSWRzKGRlbC50YXJnZXQsIHcubGVmdCkpIHtcbiAgICAgICAgICAgICAgICB3LmxlZnQgPSBuZXdMZWZ0XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBEZWxldGUgT3BlcmF0aW9uIScpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyeUNhbGxFdmVudHMobilcbiAgICB9XG4gICAgLyogKHByaXZhdGUpXG4gICAgICBUcnkgdG8gZXhlY3V0ZSB0aGUgZXZlbnRzIGZvciB0aGUgd2FpdGluZyBvcGVyYXRpb25zXG4gICAgKi9cbiAgICBfdHJ5Q2FsbEV2ZW50cyAoKSB7XG4gICAgICBmdW5jdGlvbiBub3RTb1NtYXJ0U29ydCAoYXJyYXkpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdXG4gICAgICAgIHdoaWxlIChhcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGluZGVwZW5kZW50ID0gdHJ1ZVxuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBhcnJheS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICBpZiAoWS51dGlscy5tYXRjaGVzSWQoYXJyYXlbal0sIGFycmF5W2ldLmxlZnQpKSB7XG4gICAgICAgICAgICAgICAgLy8gYXJyYXlbaV0gZGVwZW5kcyBvbiBhcnJheVtqXVxuICAgICAgICAgICAgICAgIGluZGVwZW5kZW50ID0gZmFsc2VcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaW5kZXBlbmRlbnQpIHtcbiAgICAgICAgICAgICAgcmVzdWx0LnB1c2goYXJyYXkuc3BsaWNlKGksIDEpWzBdKVxuICAgICAgICAgICAgICBpLS1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuYXdhaXRpbmcgPiAwKSB0aGlzLmF3YWl0aW5nLS1cbiAgICAgIGlmICh0aGlzLmF3YWl0aW5nID09PSAwICYmIHRoaXMud2FpdGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHZhciBpbnMgPSBbXVxuICAgICAgICB2YXIgZGVscyA9IFtdXG4gICAgICAgIHRoaXMud2FpdGluZy5mb3JFYWNoKGZ1bmN0aW9uIChvKSB7XG4gICAgICAgICAgaWYgKG8uc3RydWN0ID09PSAnRGVsZXRlJykge1xuICAgICAgICAgICAgZGVscy5wdXNoKG8pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlucy5wdXNoKG8pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBpbnMgPSBub3RTb1NtYXJ0U29ydChpbnMpXG4gICAgICAgIGlucy5mb3JFYWNoKHRoaXMub25ldmVudClcbiAgICAgICAgZGVscy5mb3JFYWNoKHRoaXMub25ldmVudClcbiAgICAgICAgdGhpcy53YWl0aW5nID0gW11cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgWS51dGlscy5FdmVudEhhbmRsZXIgPSBFdmVudEhhbmRsZXJcblxuICAvKlxuICAgIERlZmF1bHQgY2xhc3Mgb2YgY3VzdG9tIHR5cGVzIVxuICAqL1xuICBjbGFzcyBDdXN0b21UeXBlIHtcbiAgICBnZXRQYXRoICgpIHtcbiAgICAgIHZhciBwYXJlbnQgPSBudWxsXG4gICAgICBpZiAodGhpcy5fcGFyZW50ICE9IG51bGwpIHtcbiAgICAgICAgcGFyZW50ID0gdGhpcy5vcy5nZXRUeXBlKHRoaXMuX3BhcmVudClcbiAgICAgIH1cbiAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCAmJiBwYXJlbnQuX2dldFBhdGhUb0NoaWxkICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGZpcnN0S2V5ID0gcGFyZW50Ll9nZXRQYXRoVG9DaGlsZCh0aGlzLl9tb2RlbClcbiAgICAgICAgdmFyIHBhcmVudEtleXMgPSBwYXJlbnQuZ2V0UGF0aCgpXG4gICAgICAgIHBhcmVudEtleXMucHVzaChmaXJzdEtleSlcbiAgICAgICAgcmV0dXJuIHBhcmVudEtleXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbXVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBZLnV0aWxzLkN1c3RvbVR5cGUgPSBDdXN0b21UeXBlXG5cbiAgLypcbiAgICBBIHdyYXBwZXIgZm9yIHRoZSBkZWZpbml0aW9uIG9mIGEgY3VzdG9tIHR5cGUuXG4gICAgRXZlcnkgY3VzdG9tIHR5cGUgbXVzdCBoYXZlIHRocmVlIHByb3BlcnRpZXM6XG5cbiAgICAqIHN0cnVjdFxuICAgICAgLSBTdHJ1Y3RuYW1lIG9mIHRoaXMgdHlwZVxuICAgICogaW5pdFR5cGVcbiAgICAgIC0gR2l2ZW4gYSBtb2RlbCwgY3JlYXRlcyBhIGN1c3RvbSB0eXBlXG4gICAgKiBjbGFzc1xuICAgICAgLSB0aGUgY29uc3RydWN0b3Igb2YgdGhlIGN1c3RvbSB0eXBlIChlLmcuIGluIG9yZGVyIHRvIGluaGVyaXQgZnJvbSBhIHR5cGUpXG4gICovXG4gIGNsYXNzIEN1c3RvbVR5cGVEZWZpbml0aW9uIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgIC8qIDo6XG4gICAgc3RydWN0OiBhbnk7XG4gICAgaW5pdFR5cGU6IGFueTtcbiAgICBjbGFzczogRnVuY3Rpb247XG4gICAgbmFtZTogU3RyaW5nO1xuICAgICovXG4gICAgY29uc3RydWN0b3IgKGRlZikge1xuICAgICAgaWYgKGRlZi5zdHJ1Y3QgPT0gbnVsbCB8fFxuICAgICAgICBkZWYuaW5pdFR5cGUgPT0gbnVsbCB8fFxuICAgICAgICBkZWYuY2xhc3MgPT0gbnVsbCB8fFxuICAgICAgICBkZWYubmFtZSA9PSBudWxsIHx8XG4gICAgICAgIGRlZi5jcmVhdGVUeXBlID09IG51bGxcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0N1c3RvbSB0eXBlIHdhcyBub3QgaW5pdGlhbGl6ZWQgY29ycmVjdGx5IScpXG4gICAgICB9XG4gICAgICB0aGlzLnN0cnVjdCA9IGRlZi5zdHJ1Y3RcbiAgICAgIHRoaXMuaW5pdFR5cGUgPSBkZWYuaW5pdFR5cGVcbiAgICAgIHRoaXMuY3JlYXRlVHlwZSA9IGRlZi5jcmVhdGVUeXBlXG4gICAgICB0aGlzLmNsYXNzID0gZGVmLmNsYXNzXG4gICAgICB0aGlzLm5hbWUgPSBkZWYubmFtZVxuICAgICAgaWYgKGRlZi5hcHBlbmRBZGRpdGlvbmFsSW5mbyAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kQWRkaXRpb25hbEluZm8gPSBkZWYuYXBwZW5kQWRkaXRpb25hbEluZm9cbiAgICAgIH1cbiAgICAgIHRoaXMucGFyc2VBcmd1bWVudHMgPSAoZGVmLnBhcnNlQXJndW1lbnRzIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzXVxuICAgICAgfSkuYmluZCh0aGlzKVxuICAgICAgdGhpcy5wYXJzZUFyZ3VtZW50cy50eXBlRGVmaW5pdGlvbiA9IHRoaXNcbiAgICB9XG4gIH1cbiAgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbiA9IEN1c3RvbVR5cGVEZWZpbml0aW9uXG5cbiAgWS51dGlscy5pc1R5cGVEZWZpbml0aW9uID0gZnVuY3Rpb24gaXNUeXBlRGVmaW5pdGlvbiAodikge1xuICAgIGlmICh2ICE9IG51bGwpIHtcbiAgICAgIGlmICh2IGluc3RhbmNlb2YgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbikgcmV0dXJuIFt2XVxuICAgICAgZWxzZSBpZiAodi5jb25zdHJ1Y3RvciA9PT0gQXJyYXkgJiYgdlswXSBpbnN0YW5jZW9mIFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24pIHJldHVybiB2XG4gICAgICBlbHNlIGlmICh2IGluc3RhbmNlb2YgRnVuY3Rpb24gJiYgdi50eXBlRGVmaW5pdGlvbiBpbnN0YW5jZW9mIFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24pIHJldHVybiBbdi50eXBlRGVmaW5pdGlvbl1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvKlxuICAgIE1ha2UgYSBmbGF0IGNvcHkgb2YgYW4gb2JqZWN0XG4gICAgKGp1c3QgY29weSBwcm9wZXJ0aWVzKVxuICAqL1xuICBmdW5jdGlvbiBjb3B5T2JqZWN0IChvKSB7XG4gICAgdmFyIGMgPSB7fVxuICAgIGZvciAodmFyIGtleSBpbiBvKSB7XG4gICAgICBjW2tleV0gPSBvW2tleV1cbiAgICB9XG4gICAgcmV0dXJuIGNcbiAgfVxuICBZLnV0aWxzLmNvcHlPYmplY3QgPSBjb3B5T2JqZWN0XG5cbiAgLypcbiAgICBDb3B5IGFuIG9wZXJhdGlvbiwgc28gdGhhdCBpdCBjYW4gYmUgbWFuaXB1bGF0ZWQuXG4gICAgTm90ZTogWW91IG11c3Qgbm90IGNoYW5nZSBzdWJwcm9wZXJ0aWVzIChleGNlcHQgby5jb250ZW50KSFcbiAgKi9cbiAgZnVuY3Rpb24gY29weU9wZXJhdGlvbiAobykge1xuICAgIG8gPSBjb3B5T2JqZWN0KG8pXG4gICAgaWYgKG8uY29udGVudCAhPSBudWxsKSB7XG4gICAgICBvLmNvbnRlbnQgPSBvLmNvbnRlbnQubWFwKGZ1bmN0aW9uIChjKSB7IHJldHVybiBjIH0pXG4gICAgfVxuICAgIHJldHVybiBvXG4gIH1cblxuICBZLnV0aWxzLmNvcHlPcGVyYXRpb24gPSBjb3B5T3BlcmF0aW9uXG5cbiAgLypcbiAgICBEZWZpbmVzIGEgc21hbGxlciByZWxhdGlvbiBvbiBJZCdzXG4gICovXG4gIGZ1bmN0aW9uIHNtYWxsZXIgKGEsIGIpIHtcbiAgICByZXR1cm4gYVswXSA8IGJbMF0gfHwgKGFbMF0gPT09IGJbMF0gJiYgKGFbMV0gPCBiWzFdIHx8IHR5cGVvZiBhWzFdIDwgdHlwZW9mIGJbMV0pKVxuICB9XG4gIFkudXRpbHMuc21hbGxlciA9IHNtYWxsZXJcblxuICBmdW5jdGlvbiBpbkRlbGV0aW9uUmFuZ2UgKGRlbCwgaW5zKSB7XG4gICAgcmV0dXJuIGRlbC50YXJnZXRbMF0gPT09IGluc1swXSAmJiBkZWwudGFyZ2V0WzFdIDw9IGluc1sxXSAmJiBpbnNbMV0gPCBkZWwudGFyZ2V0WzFdICsgKGRlbC5sZW5ndGggfHwgMSlcbiAgfVxuICBZLnV0aWxzLmluRGVsZXRpb25SYW5nZSA9IGluRGVsZXRpb25SYW5nZVxuXG4gIGZ1bmN0aW9uIGNvbXBhcmVJZHMgKGlkMSwgaWQyKSB7XG4gICAgaWYgKGlkMSA9PSBudWxsIHx8IGlkMiA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gaWQxID09PSBpZDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGlkMVswXSA9PT0gaWQyWzBdICYmIGlkMVsxXSA9PT0gaWQyWzFdXG4gICAgfVxuICB9XG4gIFkudXRpbHMuY29tcGFyZUlkcyA9IGNvbXBhcmVJZHNcblxuICBmdW5jdGlvbiBtYXRjaGVzSWQgKG9wLCBpZCkge1xuICAgIGlmIChpZCA9PSBudWxsIHx8IG9wID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpZCA9PT0gb3BcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlkWzBdID09PSBvcC5pZFswXSkge1xuICAgICAgICBpZiAob3AuY29udGVudCA9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIGlkWzFdID09PSBvcC5pZFsxXVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBpZFsxXSA+PSBvcC5pZFsxXSAmJiBpZFsxXSA8IG9wLmlkWzFdICsgb3AuY29udGVudC5sZW5ndGhcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBZLnV0aWxzLm1hdGNoZXNJZCA9IG1hdGNoZXNJZFxuXG4gIGZ1bmN0aW9uIGdldExhc3RJZCAob3ApIHtcbiAgICBpZiAob3AuY29udGVudCA9PSBudWxsIHx8IG9wLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gb3AuaWRcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFtvcC5pZFswXSwgb3AuaWRbMV0gKyBvcC5jb250ZW50Lmxlbmd0aCAtIDFdXG4gICAgfVxuICB9XG4gIFkudXRpbHMuZ2V0TGFzdElkID0gZ2V0TGFzdElkXG5cbiAgZnVuY3Rpb24gY3JlYXRlRW1wdHlPcHNBcnJheSAobikge1xuICAgIHZhciBhID0gbmV3IEFycmF5KG4pXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhW2ldID0ge1xuICAgICAgICBpZDogW251bGwsIG51bGxdXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhXG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVTbWFsbExvb2t1cEJ1ZmZlciAoU3RvcmUpIHtcbiAgICAvKlxuICAgICAgVGhpcyBidWZmZXIgaW1wbGVtZW50cyBhIHZlcnkgc21hbGwgYnVmZmVyIHRoYXQgdGVtcG9yYXJpbHkgc3RvcmVzIG9wZXJhdGlvbnNcbiAgICAgIGFmdGVyIHRoZXkgYXJlIHJlYWQgLyBiZWZvcmUgdGhleSBhcmUgd3JpdHRlbi5cbiAgICAgIFRoZSBidWZmZXIgYmFzaWNhbGx5IGltcGxlbWVudHMgRklGTy4gT2Z0ZW4gcmVxdWVzdGVkIGxvb2t1cHMgd2lsbCBiZSByZS1xdWV1ZWQgZXZlcnkgdGltZSB0aGV5IGFyZSBsb29rZWQgdXAgLyB3cml0dGVuLlxuXG4gICAgICBJdCBjYW4gc3BlZWQgdXAgbG9va3VwcyBvbiBPcGVyYXRpb24gU3RvcmVzIGFuZCBTdGF0ZSBTdG9yZXMuIEJ1dCBpdCBkb2VzIG5vdCByZXF1aXJlIG5vdGFibGUgdXNlIG9mIG1lbW9yeSBvciBwcm9jZXNzaW5nIHBvd2VyLlxuXG4gICAgICBHb29kIGZvciBvcyBhbmQgc3MsIGJvdCBub3QgZm9yIGRzIChiZWNhdXNlIGl0IG9mdGVuIHVzZXMgbWV0aG9kcyB0aGF0IHJlcXVpcmUgYSBmbHVzaClcblxuICAgICAgSSB0cmllZCB0byBvcHRpbWl6ZSB0aGlzIGZvciBwZXJmb3JtYW5jZSwgdGhlcmVmb3JlIG5vIGhpZ2hsZXZlbCBvcGVyYXRpb25zLlxuICAgICovXG4gICAgY2xhc3MgU21hbGxMb29rdXBCdWZmZXIgZXh0ZW5kcyBTdG9yZSB7XG4gICAgICBjb25zdHJ1Y3RvciAoYXJnMSwgYXJnMikge1xuICAgICAgICAvLyBzdXBlciguLi5hcmd1bWVudHMpIC0tIGRvIHRoaXMgd2hlbiB0aGlzIGlzIHN1cHBvcnRlZCBieSBzdGFibGUgbm9kZWpzXG4gICAgICAgIHN1cGVyKGFyZzEsIGFyZzIpXG4gICAgICAgIHRoaXMud3JpdGVCdWZmZXIgPSBjcmVhdGVFbXB0eU9wc0FycmF5KDUpXG4gICAgICAgIHRoaXMucmVhZEJ1ZmZlciA9IGNyZWF0ZUVtcHR5T3BzQXJyYXkoMTApXG4gICAgICB9XG4gICAgICAqIGZpbmQgKGlkLCBub1N1cGVyQ2FsbCkge1xuICAgICAgICB2YXIgaSwgclxuICAgICAgICBmb3IgKGkgPSB0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICByID0gdGhpcy5yZWFkQnVmZmVyW2ldXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgaGF2ZSB0byB1c2UgY29tcGFyZWlkcywgYmVjYXVzZSBpZCBpcyBhbHdheXMgZGVmaW5lZCFcbiAgICAgICAgICBpZiAoci5pZFsxXSA9PT0gaWRbMV0gJiYgci5pZFswXSA9PT0gaWRbMF0pIHtcbiAgICAgICAgICAgIC8vIGZvdW5kIHJcbiAgICAgICAgICAgIC8vIG1vdmUgciB0byB0aGUgZW5kIG9mIHJlYWRCdWZmZXJcbiAgICAgICAgICAgIGZvciAoOyBpIDwgdGhpcy5yZWFkQnVmZmVyLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICB0aGlzLnJlYWRCdWZmZXJbaV0gPSB0aGlzLnJlYWRCdWZmZXJbaSArIDFdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlYWRCdWZmZXJbdGhpcy5yZWFkQnVmZmVyLmxlbmd0aCAtIDFdID0gclxuICAgICAgICAgICAgcmV0dXJuIHJcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9cbiAgICAgICAgZm9yIChpID0gdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIHIgPSB0aGlzLndyaXRlQnVmZmVyW2ldXG4gICAgICAgICAgaWYgKHIuaWRbMV0gPT09IGlkWzFdICYmIHIuaWRbMF0gPT09IGlkWzBdKSB7XG4gICAgICAgICAgICBvID0gclxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPCAwICYmIG5vU3VwZXJDYWxsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBkaWQgbm90IHJlYWNoIGJyZWFrIGluIGxhc3QgbG9vcFxuICAgICAgICAgIC8vIHJlYWQgaWQgYW5kIHB1dCBpdCB0byB0aGUgZW5kIG9mIHJlYWRCdWZmZXJcbiAgICAgICAgICBvID0geWllbGQqIHN1cGVyLmZpbmQoaWQpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG8gIT0gbnVsbCkge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJlYWRCdWZmZXJbaV0gPSB0aGlzLnJlYWRCdWZmZXJbaSArIDFdXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlclt0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMV0gPSBvXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9cbiAgICAgIH1cbiAgICAgICogcHV0IChvKSB7XG4gICAgICAgIHZhciBpZCA9IG8uaWRcbiAgICAgICAgdmFyIGksIHIgLy8gaGVscGVyIHZhcmlhYmxlc1xuICAgICAgICBmb3IgKGkgPSB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgciA9IHRoaXMud3JpdGVCdWZmZXJbaV1cbiAgICAgICAgICBpZiAoci5pZFsxXSA9PT0gaWRbMV0gJiYgci5pZFswXSA9PT0gaWRbMF0pIHtcbiAgICAgICAgICAgIC8vIGlzIGFscmVhZHkgaW4gYnVmZmVyXG4gICAgICAgICAgICAvLyBmb3JnZXQgciwgYW5kIG1vdmUgbyB0byB0aGUgZW5kIG9mIHdyaXRlQnVmZmVyXG4gICAgICAgICAgICBmb3IgKDsgaSA8IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgIHRoaXMud3JpdGVCdWZmZXJbaV0gPSB0aGlzLndyaXRlQnVmZmVyW2kgKyAxXVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53cml0ZUJ1ZmZlclt0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCAtIDFdID0gb1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGkgPCAwKSB7XG4gICAgICAgICAgLy8gZGlkIG5vdCByZWFjaCBicmVhayBpbiBsYXN0IGxvb3BcbiAgICAgICAgICAvLyB3cml0ZSB3cml0ZUJ1ZmZlclswXVxuICAgICAgICAgIHZhciB3cml0ZSA9IHRoaXMud3JpdGVCdWZmZXJbMF1cbiAgICAgICAgICBpZiAod3JpdGUuaWRbMF0gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHlpZWxkKiBzdXBlci5wdXQod3JpdGUpXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHB1dCBvIHRvIHRoZSBlbmQgb2Ygd3JpdGVCdWZmZXJcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGVCdWZmZXJbaV0gPSB0aGlzLndyaXRlQnVmZmVyW2kgKyAxXVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLndyaXRlQnVmZmVyW3RoaXMud3JpdGVCdWZmZXIubGVuZ3RoIC0gMV0gPSBvXG4gICAgICAgIH1cbiAgICAgICAgLy8gY2hlY2sgcmVhZEJ1ZmZlciBmb3IgZXZlcnkgb2NjdXJlbmNlIG9mIG8uaWQsIG92ZXJ3cml0ZSBpZiBmb3VuZFxuICAgICAgICAvLyB3aGV0aGVyIGZvdW5kIG9yIG5vdCwgd2UnbGwgYXBwZW5kIG8gdG8gdGhlIHJlYWRidWZmZXJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMucmVhZEJ1ZmZlci5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICByID0gdGhpcy5yZWFkQnVmZmVyW2kgKyAxXVxuICAgICAgICAgIGlmIChyLmlkWzFdID09PSBpZFsxXSAmJiByLmlkWzBdID09PSBpZFswXSkge1xuICAgICAgICAgICAgdGhpcy5yZWFkQnVmZmVyW2ldID0gb1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlYWRCdWZmZXJbaV0gPSByXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVhZEJ1ZmZlclt0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMV0gPSBvXG4gICAgICB9XG4gICAgICAqIGRlbGV0ZSAoaWQpIHtcbiAgICAgICAgdmFyIGksIHJcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMucmVhZEJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHIgPSB0aGlzLnJlYWRCdWZmZXJbaV1cbiAgICAgICAgICBpZiAoci5pZFsxXSA9PT0gaWRbMV0gJiYgci5pZFswXSA9PT0gaWRbMF0pIHtcbiAgICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlcltpXSA9IHtcbiAgICAgICAgICAgICAgaWQ6IFtudWxsLCBudWxsXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgIHlpZWxkKiBzdXBlci5kZWxldGUoaWQpXG4gICAgICB9XG4gICAgICAqIGZpbmRXaXRoTG93ZXJCb3VuZCAoaWQpIHtcbiAgICAgICAgdmFyIG8gPSB5aWVsZCogdGhpcy5maW5kKGlkLCB0cnVlKVxuICAgICAgICBpZiAobyAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG9cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgICAgcmV0dXJuIHlpZWxkKiBzdXBlci5maW5kV2l0aExvd2VyQm91bmQuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAqIGZpbmRXaXRoVXBwZXJCb3VuZCAoaWQpIHtcbiAgICAgICAgdmFyIG8gPSB5aWVsZCogdGhpcy5maW5kKGlkLCB0cnVlKVxuICAgICAgICBpZiAobyAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG9cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgICAgcmV0dXJuIHlpZWxkKiBzdXBlci5maW5kV2l0aFVwcGVyQm91bmQuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAqIGZpbmROZXh0ICgpIHtcbiAgICAgICAgeWllbGQqIHRoaXMuZmx1c2goKVxuICAgICAgICByZXR1cm4geWllbGQqIHN1cGVyLmZpbmROZXh0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICAgIH1cbiAgICAgICogZmluZFByZXYgKCkge1xuICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgIHJldHVybiB5aWVsZCogc3VwZXIuZmluZFByZXYuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgfVxuICAgICAgKiBpdGVyYXRlICgpIHtcbiAgICAgICAgeWllbGQqIHRoaXMuZmx1c2goKVxuICAgICAgICB5aWVsZCogc3VwZXIuaXRlcmF0ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICB9XG4gICAgICAqIGZsdXNoICgpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIHdyaXRlID0gdGhpcy53cml0ZUJ1ZmZlcltpXVxuICAgICAgICAgIGlmICh3cml0ZS5pZFswXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgeWllbGQqIHN1cGVyLnB1dCh3cml0ZSlcbiAgICAgICAgICAgIHRoaXMud3JpdGVCdWZmZXJbaV0gPSB7XG4gICAgICAgICAgICAgIGlkOiBbbnVsbCwgbnVsbF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIFNtYWxsTG9va3VwQnVmZmVyXG4gIH1cbiAgWS51dGlscy5jcmVhdGVTbWFsbExvb2t1cEJ1ZmZlciA9IGNyZWF0ZVNtYWxsTG9va3VwQnVmZmVyXG5cbiAgLy8gR2VuZXJhdGVzIGEgdW5pcXVlIGlkLCBmb3IgdXNlIGFzIGEgdXNlciBpZC5cbiAgLy8gVGh4IHRvIEBqZWQgZm9yIHRoaXMgc2NyaXB0IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2plZC85ODI4ODNcbiAgZnVuY3Rpb24gZ2VuZXJhdGVHdWlkKGEpe3JldHVybiBhPyhhXk1hdGgucmFuZG9tKCkqMTY+PmEvNCkudG9TdHJpbmcoMTYpOihbMWU3XSstMWUzKy00ZTMrLThlMystMWUxMSkucmVwbGFjZSgvWzAxOF0vZyxnZW5lcmF0ZUd1aWQpfSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gIFkudXRpbHMuZ2VuZXJhdGVHdWlkID0gZ2VuZXJhdGVHdWlkXG59XG4iLCIvKiBAZmxvdyAqL1xuJ3VzZSBzdHJpY3QnXG5cbnJlcXVpcmUoJy4vQ29ubmVjdG9yLmpzJykoWSlcbnJlcXVpcmUoJy4vRGF0YWJhc2UuanMnKShZKVxucmVxdWlyZSgnLi9UcmFuc2FjdGlvbi5qcycpKFkpXG5yZXF1aXJlKCcuL1N0cnVjdC5qcycpKFkpXG5yZXF1aXJlKCcuL1V0aWxzLmpzJykoWSlcbnJlcXVpcmUoJy4vQ29ubmVjdG9ycy9UZXN0LmpzJykoWSlcblxuWS5kZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJylcblxudmFyIHJlcXVpcmluZ01vZHVsZXMgPSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IFlcblkucmVxdWlyaW5nTW9kdWxlcyA9IHJlcXVpcmluZ01vZHVsZXNcblxuWS5leHRlbmQgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIgJiYgdHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbikge1xuICAgICAgWVtuYW1lXSA9IHZhbHVlLnBhcnNlQXJndW1lbnRzXG4gICAgfSBlbHNlIHtcbiAgICAgIFlbbmFtZV0gPSB2YWx1ZVxuICAgIH1cbiAgICBpZiAocmVxdWlyaW5nTW9kdWxlc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgICByZXF1aXJpbmdNb2R1bGVzW25hbWVdLnJlc29sdmUoKVxuICAgICAgZGVsZXRlIHJlcXVpcmluZ01vZHVsZXNbbmFtZV1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmID0gYXJndW1lbnRzW2ldXG4gICAgICBpZiAodHlwZW9mIGYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZihZKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBmdW5jdGlvbiEnKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5ZLnJlcXVlc3RNb2R1bGVzID0gcmVxdWVzdE1vZHVsZXNcbmZ1bmN0aW9uIHJlcXVlc3RNb2R1bGVzIChtb2R1bGVzKSB7XG4gIHZhciBzb3VyY2VEaXJcbiAgaWYgKFkuc291cmNlRGlyID09PSBudWxsKSB7XG4gICAgc291cmNlRGlyID0gbnVsbFxuICB9IGVsc2Uge1xuICAgIHNvdXJjZURpciA9IFkuc291cmNlRGlyIHx8ICcvYm93ZXJfY29tcG9uZW50cydcbiAgfVxuICAvLyBkZXRlcm1pbmUgaWYgdGhpcyBtb2R1bGUgd2FzIGNvbXBpbGVkIGZvciBlczUgb3IgZXM2ICh5LmpzIHZzLiB5LmVzNilcbiAgLy8gaWYgSW5zZXJ0LmV4ZWN1dGUgaXMgYSBGdW5jdGlvbiwgdGhlbiBpdCBpc250IGEgZ2VuZXJhdG9yLi5cbiAgLy8gdGhlbiBsb2FkIHRoZSBlczUoLmpzKSBmaWxlcy4uXG4gIHZhciBleHRlbnRpb24gPSB0eXBlb2YgcmVnZW5lcmF0b3JSdW50aW1lICE9PSAndW5kZWZpbmVkJyA/ICcuanMnIDogJy5lczYnXG4gIHZhciBwcm9taXNlcyA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBtb2R1bGUgPSBtb2R1bGVzW2ldLnNwbGl0KCcoJylbMF1cbiAgICB2YXIgbW9kdWxlbmFtZSA9ICd5LScgKyBtb2R1bGUudG9Mb3dlckNhc2UoKVxuICAgIGlmIChZW21vZHVsZV0gPT0gbnVsbCkge1xuICAgICAgaWYgKHJlcXVpcmluZ01vZHVsZXNbbW9kdWxlXSA9PSBudWxsKSB7XG4gICAgICAgIC8vIG1vZHVsZSBkb2VzIG5vdCBleGlzdFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LlkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKHNvdXJjZURpciAhPSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgaW1wb3J0ZWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKVxuICAgICAgICAgICAgaW1wb3J0ZWQuc3JjID0gc291cmNlRGlyICsgJy8nICsgbW9kdWxlbmFtZSArICcvJyArIG1vZHVsZW5hbWUgKyBleHRlbnRpb25cbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoaW1wb3J0ZWQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCByZXF1aXJlTW9kdWxlID0ge31cbiAgICAgICAgICByZXF1aXJpbmdNb2R1bGVzW21vZHVsZV0gPSByZXF1aXJlTW9kdWxlXG4gICAgICAgICAgcmVxdWlyZU1vZHVsZS5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICAgIHJlcXVpcmVNb2R1bGUucmVzb2x2ZSA9IHJlc29sdmVcbiAgICAgICAgICB9KVxuICAgICAgICAgIHByb21pc2VzLnB1c2gocmVxdWlyZU1vZHVsZS5wcm9taXNlKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuaW5mbygnWUpTOiBQbGVhc2UgZG8gbm90IGRlcGVuZCBvbiBhdXRvbWF0aWMgcmVxdWlyaW5nIG9mIG1vZHVsZXMgYW55bW9yZSEgRXh0ZW5kIG1vZHVsZXMgYXMgZm9sbG93cyBgcmVxdWlyZShcXCd5LW1vZHVsZW5hbWVcXCcpKFkpYCcpXG4gICAgICAgICAgcmVxdWlyZShtb2R1bGVuYW1lKShZKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlcy5wdXNoKHJlcXVpcmluZ01vZHVsZXNbbW9kdWxlc1tpXV0ucHJvbWlzZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKVxufVxuXG4vKiA6OlxudHlwZSBNZW1vcnlPcHRpb25zID0ge1xuICBuYW1lOiAnbWVtb3J5J1xufVxudHlwZSBJbmRleGVkREJPcHRpb25zID0ge1xuICBuYW1lOiAnaW5kZXhlZGRiJyxcbiAgbmFtZXNwYWNlOiBzdHJpbmdcbn1cbnR5cGUgRGJPcHRpb25zID0gTWVtb3J5T3B0aW9ucyB8IEluZGV4ZWREQk9wdGlvbnNcblxudHlwZSBXZWJSVENPcHRpb25zID0ge1xuICBuYW1lOiAnd2VicnRjJyxcbiAgcm9vbTogc3RyaW5nXG59XG50eXBlIFdlYnNvY2tldHNDbGllbnRPcHRpb25zID0ge1xuICBuYW1lOiAnd2Vic29ja2V0cy1jbGllbnQnLFxuICByb29tOiBzdHJpbmdcbn1cbnR5cGUgQ29ubmVjdGlvbk9wdGlvbnMgPSBXZWJSVENPcHRpb25zIHwgV2Vic29ja2V0c0NsaWVudE9wdGlvbnNcblxudHlwZSBZT3B0aW9ucyA9IHtcbiAgY29ubmVjdG9yOiBDb25uZWN0aW9uT3B0aW9ucyxcbiAgZGI6IERiT3B0aW9ucyxcbiAgdHlwZXM6IEFycmF5PFR5cGVOYW1lPixcbiAgc291cmNlRGlyOiBzdHJpbmcsXG4gIHNoYXJlOiB7W2tleTogc3RyaW5nXTogVHlwZU5hbWV9XG59XG4qL1xuXG5mdW5jdGlvbiBZIChvcHRzLyogOllPcHRpb25zICovKSAvKiA6UHJvbWlzZTxZQ29uZmlnPiAqLyB7XG4gIGlmIChvcHRzLmhhc093blByb3BlcnR5KCdzb3VyY2VEaXInKSkge1xuICAgIFkuc291cmNlRGlyID0gb3B0cy5zb3VyY2VEaXJcbiAgfVxuICBvcHRzLnR5cGVzID0gb3B0cy50eXBlcyAhPSBudWxsID8gb3B0cy50eXBlcyA6IFtdXG4gIHZhciBtb2R1bGVzID0gW29wdHMuZGIubmFtZSwgb3B0cy5jb25uZWN0b3IubmFtZV0uY29uY2F0KG9wdHMudHlwZXMpXG4gIGZvciAodmFyIG5hbWUgaW4gb3B0cy5zaGFyZSkge1xuICAgIG1vZHVsZXMucHVzaChvcHRzLnNoYXJlW25hbWVdKVxuICB9XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgaWYgKG9wdHMgPT0gbnVsbCkgcmVqZWN0KCdBbiBvcHRpb25zIG9iamVjdCBpcyBleHBlY3RlZCEgJylcbiAgICBlbHNlIGlmIChvcHRzLmNvbm5lY3RvciA9PSBudWxsKSByZWplY3QoJ1lvdSBtdXN0IHNwZWNpZnkgYSBjb25uZWN0b3IhIChtaXNzaW5nIGNvbm5lY3RvciBwcm9wZXJ0eSknKVxuICAgIGVsc2UgaWYgKG9wdHMuY29ubmVjdG9yLm5hbWUgPT0gbnVsbCkgcmVqZWN0KCdZb3UgbXVzdCBzcGVjaWZ5IGNvbm5lY3RvciBuYW1lISAobWlzc2luZyBjb25uZWN0b3IubmFtZSBwcm9wZXJ0eSknKVxuICAgIGVsc2UgaWYgKG9wdHMuZGIgPT0gbnVsbCkgcmVqZWN0KCdZb3UgbXVzdCBzcGVjaWZ5IGEgZGF0YWJhc2UhIChtaXNzaW5nIGRiIHByb3BlcnR5KScpXG4gICAgZWxzZSBpZiAob3B0cy5jb25uZWN0b3IubmFtZSA9PSBudWxsKSByZWplY3QoJ1lvdSBtdXN0IHNwZWNpZnkgZGIgbmFtZSEgKG1pc3NpbmcgZGIubmFtZSBwcm9wZXJ0eSknKVxuICAgIGVsc2Uge1xuICAgICAgb3B0cyA9IFkudXRpbHMuY29weU9iamVjdChvcHRzKVxuICAgICAgb3B0cy5jb25uZWN0b3IgPSBZLnV0aWxzLmNvcHlPYmplY3Qob3B0cy5jb25uZWN0b3IpXG4gICAgICBvcHRzLmRiID0gWS51dGlscy5jb3B5T2JqZWN0KG9wdHMuZGIpXG4gICAgICBvcHRzLnNoYXJlID0gWS51dGlscy5jb3B5T2JqZWN0KG9wdHMuc2hhcmUpXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgWS5yZXF1ZXN0TW9kdWxlcyhtb2R1bGVzKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgeWNvbmZpZyA9IG5ldyBZQ29uZmlnKG9wdHMpXG4gICAgICAgICAgeWNvbmZpZy5kYi53aGVuVXNlcklkU2V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHljb25maWcuaW5pdChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUoeWNvbmZpZylcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfSkuY2F0Y2gocmVqZWN0KVxuICAgICAgfSwgMClcbiAgICB9XG4gIH0pXG59XG5cbmNsYXNzIFlDb25maWcge1xuICAvKiA6OlxuICBkYjogWS5BYnN0cmFjdERhdGFiYXNlO1xuICBjb25uZWN0b3I6IFkuQWJzdHJhY3RDb25uZWN0b3I7XG4gIHNoYXJlOiB7W2tleTogc3RyaW5nXTogYW55fTtcbiAgb3B0aW9uczogT2JqZWN0O1xuICAqL1xuICBjb25zdHJ1Y3RvciAob3B0cywgY2FsbGJhY2spIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRzXG4gICAgdGhpcy5kYiA9IG5ldyBZW29wdHMuZGIubmFtZV0odGhpcywgb3B0cy5kYilcbiAgICB0aGlzLmNvbm5lY3RvciA9IG5ldyBZW29wdHMuY29ubmVjdG9yLm5hbWVdKHRoaXMsIG9wdHMuY29ubmVjdG9yKVxuICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZVxuICB9XG4gIGluaXQgKGNhbGxiYWNrKSB7XG4gICAgdmFyIG9wdHMgPSB0aGlzLm9wdGlvbnNcbiAgICB2YXIgc2hhcmUgPSB7fVxuICAgIHRoaXMuc2hhcmUgPSBzaGFyZVxuICAgIHRoaXMuZGIucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogcmVxdWVzdFRyYW5zYWN0aW9uICgpIHtcbiAgICAgIC8vIGNyZWF0ZSBzaGFyZWQgb2JqZWN0XG4gICAgICBmb3IgKHZhciBwcm9wZXJ0eW5hbWUgaW4gb3B0cy5zaGFyZSkge1xuICAgICAgICB2YXIgdHlwZUNvbnN0cnVjdG9yID0gb3B0cy5zaGFyZVtwcm9wZXJ0eW5hbWVdLnNwbGl0KCcoJylcbiAgICAgICAgdmFyIHR5cGVOYW1lID0gdHlwZUNvbnN0cnVjdG9yLnNwbGljZSgwLCAxKVxuICAgICAgICB2YXIgdHlwZSA9IFlbdHlwZU5hbWVdXG4gICAgICAgIHZhciB0eXBlZGVmID0gdHlwZS50eXBlRGVmaW5pdGlvblxuICAgICAgICB2YXIgaWQgPSBbJ18nLCB0eXBlZGVmLnN0cnVjdCArICdfJyArIHR5cGVOYW1lICsgJ18nICsgcHJvcGVydHluYW1lICsgJ18nICsgdHlwZUNvbnN0cnVjdG9yXVxuICAgICAgICB2YXIgYXJncyA9IFtdXG4gICAgICAgIGlmICh0eXBlQ29uc3RydWN0b3IubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFyZ3MgPSBKU09OLnBhcnNlKCdbJyArIHR5cGVDb25zdHJ1Y3RvclswXS5zcGxpdCgnKScpWzBdICsgJ10nKVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignV2FzIG5vdCBhYmxlIHRvIHBhcnNlIHR5cGUgZGVmaW5pdGlvbiEgKHNoYXJlLicgKyBwcm9wZXJ0eW5hbWUgKyAnKScpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0eXBlLnR5cGVEZWZpbml0aW9uLnBhcnNlQXJndW1lbnRzID09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcih0eXBlTmFtZSArICcgZG9lcyBub3QgZXhwZWN0IGFyZ3VtZW50cyEnKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcmdzID0gdHlwZWRlZi5wYXJzZUFyZ3VtZW50cyhhcmdzWzBdKVsxXVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzaGFyZVtwcm9wZXJ0eW5hbWVdID0geWllbGQqIHRoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLCBpZCwgYXJncylcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RvcmUud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKClcbiAgICAgICAgLnRoZW4oY2FsbGJhY2spXG4gICAgfSlcbiAgfVxuICBpc0Nvbm5lY3RlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdG9yLmlzU3luY2VkXG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlXG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0b3IuZGlzY29ubmVjdCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgIH1cbiAgfVxuICByZWNvbm5lY3QgKCkge1xuICAgIGlmICghdGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkID0gdHJ1ZVxuICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdG9yLnJlY29ubmVjdCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgIH1cbiAgfVxuICBkZXN0cm95ICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICByZXR1cm4gdGhpcy5jbG9zZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuZGIuZGVsZXRlREIgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gc2VsZi5kYi5kZWxldGVEQigpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgIH1cbiAgICB9KVxuICB9XG4gIGNsb3NlICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICB0aGlzLnNoYXJlID0gbnVsbFxuICAgIGlmICh0aGlzLmNvbm5lY3Rvci5kZXN0cm95ICE9IG51bGwpIHtcbiAgICAgIHRoaXMuY29ubmVjdG9yLmRlc3Ryb3koKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3Rvci5kaXNjb25uZWN0KClcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZGIud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuZGIuZGVzdHJveVR5cGVzKClcbiAgICAgIC8vIG1ha2Ugc3VyZSB0byB3YWl0IGZvciBhbGwgdHJhbnNhY3Rpb25zIGJlZm9yZSBkZXN0cm95aW5nIHRoZSBkYlxuICAgICAgdGhpcy5kYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgIHlpZWxkKiBzZWxmLmRiLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICAgIHJldHVybiB0aGlzLmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpXG4gICAgfSlcbiAgfVxufVxuIiwiY29uc3QgWSA9IHJlcXVpcmUoJ3lqcycpO1xucmVxdWlyZSgneS1tZW1vcnknKShZKTtcbnJlcXVpcmUoJ3ktd2VicnRjMycpKFkpO1xuLy9yZXF1aXJlKCd5LXdlYnJ0YzInKShZKTtcbi8vcmVxdWlyZSgneS13ZWJzb2NrZXRzLWNsaWVudCcpKFkpO1xucmVxdWlyZSgneS1hcnJheScpKFkpO1xucmVxdWlyZSgneS1tYXAnKShZKTtcbnJlcXVpcmUoJ3ktdGV4dCcpKFkpO1xucmVxdWlyZSgneS14bWwnKShZKTtcblxuWSh7XG4gIGRiOiB7XG4gICAgbmFtZTogJ21lbW9yeSdcbiAgfSxcbiAgY29ubmVjdG9yOiB7XG4gICAgbmFtZTogJ3dlYnJ0YycsXG4gICAgLy9uYW1lOiAnd2Vic29ja2V0cy1jbGllbnQnLFxuICAgIHJvb206ICdyb29tJyxcbiAgICB1cmw6ICdodHRwOi8vZmlud2luLmlvOjEyNTYnXG4gIH0sXG4gIHNoYXJlOiB7XG4gICAgY29kZW1pcnJvcjogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3IyOiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjM6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yNDogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I1OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjY6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yNzogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I4OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjk6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yMTA6ICdUZXh0JyxcbiAgICB4bWw6ICdYbWwnLFxuICAgIHhtbDI6ICdYbWwnLFxuICAgIHhtbDM6ICdYbWwnLFxuICAgIHhtbDQ6ICdYbWwnLFxuICAgIHhtbDU6ICdYbWwnLFxuICAgIHhtbDY6ICdYbWwnLFxuICAgIHhtbDc6ICdYbWwnLFxuICAgIHhtbDg6ICdYbWwnLFxuICAgIHhtbDk6ICdYbWwnLFxuICAgIHhtbDEwOiAnWG1sJ1xuICB9XG59KS50aGVuKGZ1bmN0aW9uICh5KSB7XG4gICAgY29uc29sZS5sb2coJyMjIyMjIyMjIyMjIycpO1xuICAgIHdpbmRvdy55WG1sID0geTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3IuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yJ10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjIuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yMiddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3IzLmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjMnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yNC5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I0J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjUuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yNSddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I2LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjYnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yNy5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I3J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjguYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yOCddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I5LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjknXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yMTAuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yMTAnXSk7XG4gICAgeS5zaGFyZS54bWwuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWwnXSk7XG4gICAgeS5zaGFyZS54bWwyLl9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sMiddKTtcbiAgICB5LnNoYXJlLnhtbDMuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWwzJ10pO1xuICAgIHkuc2hhcmUueG1sNC5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDQnXSk7XG4gICAgeS5zaGFyZS54bWw1Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNSddKTtcbiAgICB5LnNoYXJlLnhtbDYuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw2J10pO1xuICAgIHkuc2hhcmUueG1sNy5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDcnXSk7XG4gICAgeS5zaGFyZS54bWw4Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sOCddKTtcbiAgICB5LnNoYXJlLnhtbDkuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw5J10pO1xuICAgIHkuc2hhcmUueG1sMTAuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWwxMCddKTtcbn0pXG4iXX0=

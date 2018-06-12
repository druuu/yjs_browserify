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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmFzdC1kaWZmL2RpZmYuanMiLCJub2RlX21vZHVsZXMvbXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3ktYXJyYXkvc3JjL0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL3ktbWFwL3NyYy9NYXAuanMiLCJub2RlX21vZHVsZXMveS1tZW1vcnkvc3JjL01lbW9yeS5qcyIsIm5vZGVfbW9kdWxlcy95LW1lbW9yeS9zcmMvUmVkQmxhY2tUcmVlLmpzIiwibm9kZV9tb2R1bGVzL3ktdGV4dC9zcmMvVGV4dC5qcyIsIm5vZGVfbW9kdWxlcy95LXdlYnJ0YzMvc3JjL1dlYlJUQy5qcyIsIm5vZGVfbW9kdWxlcy95LXhtbC9zcmMvWG1sLmpzIiwibm9kZV9tb2R1bGVzL3lqcy9ub2RlX21vZHVsZXMvZGVidWcvc3JjL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMveWpzL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvZGVidWcuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9Db25uZWN0b3IuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9Db25uZWN0b3JzL1Rlc3QuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy9EYXRhYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy95anMvc3JjL1N0cnVjdC5qcyIsIm5vZGVfbW9kdWxlcy95anMvc3JjL1RyYW5zYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3lqcy9zcmMvVXRpbHMuanMiLCJub2RlX21vZHVsZXMveWpzL3NyYy95LmpzIiwic3JjL2FwcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25XQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qKlxuICogVGhpcyBsaWJyYXJ5IG1vZGlmaWVzIHRoZSBkaWZmLXBhdGNoLW1hdGNoIGxpYnJhcnkgYnkgTmVpbCBGcmFzZXJcbiAqIGJ5IHJlbW92aW5nIHRoZSBwYXRjaCBhbmQgbWF0Y2ggZnVuY3Rpb25hbGl0eSBhbmQgY2VydGFpbiBhZHZhbmNlZFxuICogb3B0aW9ucyBpbiB0aGUgZGlmZiBmdW5jdGlvbi4gVGhlIG9yaWdpbmFsIGxpY2Vuc2UgaXMgYXMgZm9sbG93czpcbiAqXG4gKiA9PT1cbiAqXG4gKiBEaWZmIE1hdGNoIGFuZCBQYXRjaFxuICpcbiAqIENvcHlyaWdodCAyMDA2IEdvb2dsZSBJbmMuXG4gKiBodHRwOi8vY29kZS5nb29nbGUuY29tL3AvZ29vZ2xlLWRpZmYtbWF0Y2gtcGF0Y2gvXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5cbi8qKlxuICogVGhlIGRhdGEgc3RydWN0dXJlIHJlcHJlc2VudGluZyBhIGRpZmYgaXMgYW4gYXJyYXkgb2YgdHVwbGVzOlxuICogW1tESUZGX0RFTEVURSwgJ0hlbGxvJ10sIFtESUZGX0lOU0VSVCwgJ0dvb2RieWUnXSwgW0RJRkZfRVFVQUwsICcgd29ybGQuJ11dXG4gKiB3aGljaCBtZWFuczogZGVsZXRlICdIZWxsbycsIGFkZCAnR29vZGJ5ZScgYW5kIGtlZXAgJyB3b3JsZC4nXG4gKi9cbnZhciBESUZGX0RFTEVURSA9IC0xO1xudmFyIERJRkZfSU5TRVJUID0gMTtcbnZhciBESUZGX0VRVUFMID0gMDtcblxuXG4vKipcbiAqIEZpbmQgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdHdvIHRleHRzLiAgU2ltcGxpZmllcyB0aGUgcHJvYmxlbSBieSBzdHJpcHBpbmdcbiAqIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeCBvZmYgdGhlIHRleHRzIGJlZm9yZSBkaWZmaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtJbnR9IGN1cnNvcl9wb3MgRXhwZWN0ZWQgZWRpdCBwb3NpdGlvbiBpbiB0ZXh0MSAob3B0aW9uYWwpXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIGRpZmZfbWFpbih0ZXh0MSwgdGV4dDIsIGN1cnNvcl9wb3MpIHtcbiAgLy8gQ2hlY2sgZm9yIGVxdWFsaXR5IChzcGVlZHVwKS5cbiAgaWYgKHRleHQxID09IHRleHQyKSB7XG4gICAgaWYgKHRleHQxKSB7XG4gICAgICByZXR1cm4gW1tESUZGX0VRVUFMLCB0ZXh0MV1dO1xuICAgIH1cbiAgICByZXR1cm4gW107XG4gIH1cblxuICAvLyBDaGVjayBjdXJzb3JfcG9zIHdpdGhpbiBib3VuZHNcbiAgaWYgKGN1cnNvcl9wb3MgPCAwIHx8IHRleHQxLmxlbmd0aCA8IGN1cnNvcl9wb3MpIHtcbiAgICBjdXJzb3JfcG9zID0gbnVsbDtcbiAgfVxuXG4gIC8vIFRyaW0gb2ZmIGNvbW1vbiBwcmVmaXggKHNwZWVkdXApLlxuICB2YXIgY29tbW9ubGVuZ3RoID0gZGlmZl9jb21tb25QcmVmaXgodGV4dDEsIHRleHQyKTtcbiAgdmFyIGNvbW1vbnByZWZpeCA9IHRleHQxLnN1YnN0cmluZygwLCBjb21tb25sZW5ndGgpO1xuICB0ZXh0MSA9IHRleHQxLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICB0ZXh0MiA9IHRleHQyLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuXG4gIC8vIFRyaW0gb2ZmIGNvbW1vbiBzdWZmaXggKHNwZWVkdXApLlxuICBjb21tb25sZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpO1xuICB2YXIgY29tbW9uc3VmZml4ID0gdGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG4gIHRleHQxID0gdGV4dDEuc3Vic3RyaW5nKDAsIHRleHQxLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG4gIHRleHQyID0gdGV4dDIuc3Vic3RyaW5nKDAsIHRleHQyLmxlbmd0aCAtIGNvbW1vbmxlbmd0aCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgZGlmZiBvbiB0aGUgbWlkZGxlIGJsb2NrLlxuICB2YXIgZGlmZnMgPSBkaWZmX2NvbXB1dGVfKHRleHQxLCB0ZXh0Mik7XG5cbiAgLy8gUmVzdG9yZSB0aGUgcHJlZml4IGFuZCBzdWZmaXguXG4gIGlmIChjb21tb25wcmVmaXgpIHtcbiAgICBkaWZmcy51bnNoaWZ0KFtESUZGX0VRVUFMLCBjb21tb25wcmVmaXhdKTtcbiAgfVxuICBpZiAoY29tbW9uc3VmZml4KSB7XG4gICAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgY29tbW9uc3VmZml4XSk7XG4gIH1cbiAgZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpO1xuICBpZiAoY3Vyc29yX3BvcyAhPSBudWxsKSB7XG4gICAgZGlmZnMgPSBmaXhfY3Vyc29yKGRpZmZzLCBjdXJzb3JfcG9zKTtcbiAgfVxuICBkaWZmcyA9IGZpeF9lbW9qaShkaWZmcyk7XG4gIHJldHVybiBkaWZmcztcbn07XG5cblxuLyoqXG4gKiBGaW5kIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHR3byB0ZXh0cy4gIEFzc3VtZXMgdGhhdCB0aGUgdGV4dHMgZG8gbm90XG4gKiBoYXZlIGFueSBjb21tb24gcHJlZml4IG9yIHN1ZmZpeC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBPbGQgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBOZXcgc3RyaW5nIHRvIGJlIGRpZmZlZC5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jb21wdXRlXyh0ZXh0MSwgdGV4dDIpIHtcbiAgdmFyIGRpZmZzO1xuXG4gIGlmICghdGV4dDEpIHtcbiAgICAvLyBKdXN0IGFkZCBzb21lIHRleHQgKHNwZWVkdXApLlxuICAgIHJldHVybiBbW0RJRkZfSU5TRVJULCB0ZXh0Ml1dO1xuICB9XG5cbiAgaWYgKCF0ZXh0Mikge1xuICAgIC8vIEp1c3QgZGVsZXRlIHNvbWUgdGV4dCAoc3BlZWR1cCkuXG4gICAgcmV0dXJuIFtbRElGRl9ERUxFVEUsIHRleHQxXV07XG4gIH1cblxuICB2YXIgbG9uZ3RleHQgPSB0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGggPyB0ZXh0MSA6IHRleHQyO1xuICB2YXIgc2hvcnR0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDIgOiB0ZXh0MTtcbiAgdmFyIGkgPSBsb25ndGV4dC5pbmRleE9mKHNob3J0dGV4dCk7XG4gIGlmIChpICE9IC0xKSB7XG4gICAgLy8gU2hvcnRlciB0ZXh0IGlzIGluc2lkZSB0aGUgbG9uZ2VyIHRleHQgKHNwZWVkdXApLlxuICAgIGRpZmZzID0gW1tESUZGX0lOU0VSVCwgbG9uZ3RleHQuc3Vic3RyaW5nKDAsIGkpXSxcbiAgICAgICAgICAgICBbRElGRl9FUVVBTCwgc2hvcnR0ZXh0XSxcbiAgICAgICAgICAgICBbRElGRl9JTlNFUlQsIGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgc2hvcnR0ZXh0Lmxlbmd0aCldXTtcbiAgICAvLyBTd2FwIGluc2VydGlvbnMgZm9yIGRlbGV0aW9ucyBpZiBkaWZmIGlzIHJldmVyc2VkLlxuICAgIGlmICh0ZXh0MS5sZW5ndGggPiB0ZXh0Mi5sZW5ndGgpIHtcbiAgICAgIGRpZmZzWzBdWzBdID0gZGlmZnNbMl1bMF0gPSBESUZGX0RFTEVURTtcbiAgICB9XG4gICAgcmV0dXJuIGRpZmZzO1xuICB9XG5cbiAgaWYgKHNob3J0dGV4dC5sZW5ndGggPT0gMSkge1xuICAgIC8vIFNpbmdsZSBjaGFyYWN0ZXIgc3RyaW5nLlxuICAgIC8vIEFmdGVyIHRoZSBwcmV2aW91cyBzcGVlZHVwLCB0aGUgY2hhcmFjdGVyIGNhbid0IGJlIGFuIGVxdWFsaXR5LlxuICAgIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcbiAgfVxuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgcHJvYmxlbSBjYW4gYmUgc3BsaXQgaW4gdHdvLlxuICB2YXIgaG0gPSBkaWZmX2hhbGZNYXRjaF8odGV4dDEsIHRleHQyKTtcbiAgaWYgKGhtKSB7XG4gICAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuICAgIHZhciB0ZXh0MV9hID0gaG1bMF07XG4gICAgdmFyIHRleHQxX2IgPSBobVsxXTtcbiAgICB2YXIgdGV4dDJfYSA9IGhtWzJdO1xuICAgIHZhciB0ZXh0Ml9iID0gaG1bM107XG4gICAgdmFyIG1pZF9jb21tb24gPSBobVs0XTtcbiAgICAvLyBTZW5kIGJvdGggcGFpcnMgb2ZmIGZvciBzZXBhcmF0ZSBwcm9jZXNzaW5nLlxuICAgIHZhciBkaWZmc19hID0gZGlmZl9tYWluKHRleHQxX2EsIHRleHQyX2EpO1xuICAgIHZhciBkaWZmc19iID0gZGlmZl9tYWluKHRleHQxX2IsIHRleHQyX2IpO1xuICAgIC8vIE1lcmdlIHRoZSByZXN1bHRzLlxuICAgIHJldHVybiBkaWZmc19hLmNvbmNhdChbW0RJRkZfRVFVQUwsIG1pZF9jb21tb25dXSwgZGlmZnNfYik7XG4gIH1cblxuICByZXR1cm4gZGlmZl9iaXNlY3RfKHRleHQxLCB0ZXh0Mik7XG59O1xuXG5cbi8qKlxuICogRmluZCB0aGUgJ21pZGRsZSBzbmFrZScgb2YgYSBkaWZmLCBzcGxpdCB0aGUgcHJvYmxlbSBpbiB0d29cbiAqIGFuZCByZXR1cm4gdGhlIHJlY3Vyc2l2ZWx5IGNvbnN0cnVjdGVkIGRpZmYuXG4gKiBTZWUgTXllcnMgMTk4NiBwYXBlcjogQW4gTyhORCkgRGlmZmVyZW5jZSBBbGdvcml0aG0gYW5kIEl0cyBWYXJpYXRpb25zLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHJldHVybiB7QXJyYXl9IEFycmF5IG9mIGRpZmYgdHVwbGVzLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZGlmZl9iaXNlY3RfKHRleHQxLCB0ZXh0Mikge1xuICAvLyBDYWNoZSB0aGUgdGV4dCBsZW5ndGhzIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHMuXG4gIHZhciB0ZXh0MV9sZW5ndGggPSB0ZXh0MS5sZW5ndGg7XG4gIHZhciB0ZXh0Ml9sZW5ndGggPSB0ZXh0Mi5sZW5ndGg7XG4gIHZhciBtYXhfZCA9IE1hdGguY2VpbCgodGV4dDFfbGVuZ3RoICsgdGV4dDJfbGVuZ3RoKSAvIDIpO1xuICB2YXIgdl9vZmZzZXQgPSBtYXhfZDtcbiAgdmFyIHZfbGVuZ3RoID0gMiAqIG1heF9kO1xuICB2YXIgdjEgPSBuZXcgQXJyYXkodl9sZW5ndGgpO1xuICB2YXIgdjIgPSBuZXcgQXJyYXkodl9sZW5ndGgpO1xuICAvLyBTZXR0aW5nIGFsbCBlbGVtZW50cyB0byAtMSBpcyBmYXN0ZXIgaW4gQ2hyb21lICYgRmlyZWZveCB0aGFuIG1peGluZ1xuICAvLyBpbnRlZ2VycyBhbmQgdW5kZWZpbmVkLlxuICBmb3IgKHZhciB4ID0gMDsgeCA8IHZfbGVuZ3RoOyB4KyspIHtcbiAgICB2MVt4XSA9IC0xO1xuICAgIHYyW3hdID0gLTE7XG4gIH1cbiAgdjFbdl9vZmZzZXQgKyAxXSA9IDA7XG4gIHYyW3Zfb2Zmc2V0ICsgMV0gPSAwO1xuICB2YXIgZGVsdGEgPSB0ZXh0MV9sZW5ndGggLSB0ZXh0Ml9sZW5ndGg7XG4gIC8vIElmIHRoZSB0b3RhbCBudW1iZXIgb2YgY2hhcmFjdGVycyBpcyBvZGQsIHRoZW4gdGhlIGZyb250IHBhdGggd2lsbCBjb2xsaWRlXG4gIC8vIHdpdGggdGhlIHJldmVyc2UgcGF0aC5cbiAgdmFyIGZyb250ID0gKGRlbHRhICUgMiAhPSAwKTtcbiAgLy8gT2Zmc2V0cyBmb3Igc3RhcnQgYW5kIGVuZCBvZiBrIGxvb3AuXG4gIC8vIFByZXZlbnRzIG1hcHBpbmcgb2Ygc3BhY2UgYmV5b25kIHRoZSBncmlkLlxuICB2YXIgazFzdGFydCA9IDA7XG4gIHZhciBrMWVuZCA9IDA7XG4gIHZhciBrMnN0YXJ0ID0gMDtcbiAgdmFyIGsyZW5kID0gMDtcbiAgZm9yICh2YXIgZCA9IDA7IGQgPCBtYXhfZDsgZCsrKSB7XG4gICAgLy8gV2FsayB0aGUgZnJvbnQgcGF0aCBvbmUgc3RlcC5cbiAgICBmb3IgKHZhciBrMSA9IC1kICsgazFzdGFydDsgazEgPD0gZCAtIGsxZW5kOyBrMSArPSAyKSB7XG4gICAgICB2YXIgazFfb2Zmc2V0ID0gdl9vZmZzZXQgKyBrMTtcbiAgICAgIHZhciB4MTtcbiAgICAgIGlmIChrMSA9PSAtZCB8fCAoazEgIT0gZCAmJiB2MVtrMV9vZmZzZXQgLSAxXSA8IHYxW2sxX29mZnNldCArIDFdKSkge1xuICAgICAgICB4MSA9IHYxW2sxX29mZnNldCArIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeDEgPSB2MVtrMV9vZmZzZXQgLSAxXSArIDE7XG4gICAgICB9XG4gICAgICB2YXIgeTEgPSB4MSAtIGsxO1xuICAgICAgd2hpbGUgKHgxIDwgdGV4dDFfbGVuZ3RoICYmIHkxIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgdGV4dDEuY2hhckF0KHgxKSA9PSB0ZXh0Mi5jaGFyQXQoeTEpKSB7XG4gICAgICAgIHgxKys7XG4gICAgICAgIHkxKys7XG4gICAgICB9XG4gICAgICB2MVtrMV9vZmZzZXRdID0geDE7XG4gICAgICBpZiAoeDEgPiB0ZXh0MV9sZW5ndGgpIHtcbiAgICAgICAgLy8gUmFuIG9mZiB0aGUgcmlnaHQgb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMWVuZCArPSAyO1xuICAgICAgfSBlbHNlIGlmICh5MSA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSBib3R0b20gb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMXN0YXJ0ICs9IDI7XG4gICAgICB9IGVsc2UgaWYgKGZyb250KSB7XG4gICAgICAgIHZhciBrMl9vZmZzZXQgPSB2X29mZnNldCArIGRlbHRhIC0gazE7XG4gICAgICAgIGlmIChrMl9vZmZzZXQgPj0gMCAmJiBrMl9vZmZzZXQgPCB2X2xlbmd0aCAmJiB2MltrMl9vZmZzZXRdICE9IC0xKSB7XG4gICAgICAgICAgLy8gTWlycm9yIHgyIG9udG8gdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICAgICAgdmFyIHgyID0gdGV4dDFfbGVuZ3RoIC0gdjJbazJfb2Zmc2V0XTtcbiAgICAgICAgICBpZiAoeDEgPj0geDIpIHtcbiAgICAgICAgICAgIC8vIE92ZXJsYXAgZGV0ZWN0ZWQuXG4gICAgICAgICAgICByZXR1cm4gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4MSwgeTEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdhbGsgdGhlIHJldmVyc2UgcGF0aCBvbmUgc3RlcC5cbiAgICBmb3IgKHZhciBrMiA9IC1kICsgazJzdGFydDsgazIgPD0gZCAtIGsyZW5kOyBrMiArPSAyKSB7XG4gICAgICB2YXIgazJfb2Zmc2V0ID0gdl9vZmZzZXQgKyBrMjtcbiAgICAgIHZhciB4MjtcbiAgICAgIGlmIChrMiA9PSAtZCB8fCAoazIgIT0gZCAmJiB2MltrMl9vZmZzZXQgLSAxXSA8IHYyW2syX29mZnNldCArIDFdKSkge1xuICAgICAgICB4MiA9IHYyW2syX29mZnNldCArIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeDIgPSB2MltrMl9vZmZzZXQgLSAxXSArIDE7XG4gICAgICB9XG4gICAgICB2YXIgeTIgPSB4MiAtIGsyO1xuICAgICAgd2hpbGUgKHgyIDwgdGV4dDFfbGVuZ3RoICYmIHkyIDwgdGV4dDJfbGVuZ3RoICYmXG4gICAgICAgICAgICAgdGV4dDEuY2hhckF0KHRleHQxX2xlbmd0aCAtIHgyIC0gMSkgPT1cbiAgICAgICAgICAgICB0ZXh0Mi5jaGFyQXQodGV4dDJfbGVuZ3RoIC0geTIgLSAxKSkge1xuICAgICAgICB4MisrO1xuICAgICAgICB5MisrO1xuICAgICAgfVxuICAgICAgdjJbazJfb2Zmc2V0XSA9IHgyO1xuICAgICAgaWYgKHgyID4gdGV4dDFfbGVuZ3RoKSB7XG4gICAgICAgIC8vIFJhbiBvZmYgdGhlIGxlZnQgb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMmVuZCArPSAyO1xuICAgICAgfSBlbHNlIGlmICh5MiA+IHRleHQyX2xlbmd0aCkge1xuICAgICAgICAvLyBSYW4gb2ZmIHRoZSB0b3Agb2YgdGhlIGdyYXBoLlxuICAgICAgICBrMnN0YXJ0ICs9IDI7XG4gICAgICB9IGVsc2UgaWYgKCFmcm9udCkge1xuICAgICAgICB2YXIgazFfb2Zmc2V0ID0gdl9vZmZzZXQgKyBkZWx0YSAtIGsyO1xuICAgICAgICBpZiAoazFfb2Zmc2V0ID49IDAgJiYgazFfb2Zmc2V0IDwgdl9sZW5ndGggJiYgdjFbazFfb2Zmc2V0XSAhPSAtMSkge1xuICAgICAgICAgIHZhciB4MSA9IHYxW2sxX29mZnNldF07XG4gICAgICAgICAgdmFyIHkxID0gdl9vZmZzZXQgKyB4MSAtIGsxX29mZnNldDtcbiAgICAgICAgICAvLyBNaXJyb3IgeDIgb250byB0b3AtbGVmdCBjb29yZGluYXRlIHN5c3RlbS5cbiAgICAgICAgICB4MiA9IHRleHQxX2xlbmd0aCAtIHgyO1xuICAgICAgICAgIGlmICh4MSA+PSB4Mikge1xuICAgICAgICAgICAgLy8gT3ZlcmxhcCBkZXRlY3RlZC5cbiAgICAgICAgICAgIHJldHVybiBkaWZmX2Jpc2VjdFNwbGl0Xyh0ZXh0MSwgdGV4dDIsIHgxLCB5MSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIERpZmYgdG9vayB0b28gbG9uZyBhbmQgaGl0IHRoZSBkZWFkbGluZSBvclxuICAvLyBudW1iZXIgb2YgZGlmZnMgZXF1YWxzIG51bWJlciBvZiBjaGFyYWN0ZXJzLCBubyBjb21tb25hbGl0eSBhdCBhbGwuXG4gIHJldHVybiBbW0RJRkZfREVMRVRFLCB0ZXh0MV0sIFtESUZGX0lOU0VSVCwgdGV4dDJdXTtcbn07XG5cblxuLyoqXG4gKiBHaXZlbiB0aGUgbG9jYXRpb24gb2YgdGhlICdtaWRkbGUgc25ha2UnLCBzcGxpdCB0aGUgZGlmZiBpbiB0d28gcGFydHNcbiAqIGFuZCByZWN1cnNlLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIE9sZCBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQyIE5ldyBzdHJpbmcgdG8gYmUgZGlmZmVkLlxuICogQHBhcmFtIHtudW1iZXJ9IHggSW5kZXggb2Ygc3BsaXQgcG9pbnQgaW4gdGV4dDEuXG4gKiBAcGFyYW0ge251bWJlcn0geSBJbmRleCBvZiBzcGxpdCBwb2ludCBpbiB0ZXh0Mi5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9iaXNlY3RTcGxpdF8odGV4dDEsIHRleHQyLCB4LCB5KSB7XG4gIHZhciB0ZXh0MWEgPSB0ZXh0MS5zdWJzdHJpbmcoMCwgeCk7XG4gIHZhciB0ZXh0MmEgPSB0ZXh0Mi5zdWJzdHJpbmcoMCwgeSk7XG4gIHZhciB0ZXh0MWIgPSB0ZXh0MS5zdWJzdHJpbmcoeCk7XG4gIHZhciB0ZXh0MmIgPSB0ZXh0Mi5zdWJzdHJpbmcoeSk7XG5cbiAgLy8gQ29tcHV0ZSBib3RoIGRpZmZzIHNlcmlhbGx5LlxuICB2YXIgZGlmZnMgPSBkaWZmX21haW4odGV4dDFhLCB0ZXh0MmEpO1xuICB2YXIgZGlmZnNiID0gZGlmZl9tYWluKHRleHQxYiwgdGV4dDJiKTtcblxuICByZXR1cm4gZGlmZnMuY29uY2F0KGRpZmZzYik7XG59O1xuXG5cbi8qKlxuICogRGV0ZXJtaW5lIHRoZSBjb21tb24gcHJlZml4IG9mIHR3byBzdHJpbmdzLlxuICogQHBhcmFtIHtzdHJpbmd9IHRleHQxIEZpcnN0IHN0cmluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MiBTZWNvbmQgc3RyaW5nLlxuICogQHJldHVybiB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgY29tbW9uIHRvIHRoZSBzdGFydCBvZiBlYWNoXG4gKiAgICAgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBkaWZmX2NvbW1vblByZWZpeCh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fCB0ZXh0MS5jaGFyQXQoMCkgIT0gdGV4dDIuY2hhckF0KDApKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgLy8gQmluYXJ5IHNlYXJjaC5cbiAgLy8gUGVyZm9ybWFuY2UgYW5hbHlzaXM6IGh0dHA6Ly9uZWlsLmZyYXNlci5uYW1lL25ld3MvMjAwNy8xMC8wOS9cbiAgdmFyIHBvaW50ZXJtaW4gPSAwO1xuICB2YXIgcG9pbnRlcm1heCA9IE1hdGgubWluKHRleHQxLmxlbmd0aCwgdGV4dDIubGVuZ3RoKTtcbiAgdmFyIHBvaW50ZXJtaWQgPSBwb2ludGVybWF4O1xuICB2YXIgcG9pbnRlcnN0YXJ0ID0gMDtcbiAgd2hpbGUgKHBvaW50ZXJtaW4gPCBwb2ludGVybWlkKSB7XG4gICAgaWYgKHRleHQxLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpID09XG4gICAgICAgIHRleHQyLnN1YnN0cmluZyhwb2ludGVyc3RhcnQsIHBvaW50ZXJtaWQpKSB7XG4gICAgICBwb2ludGVybWluID0gcG9pbnRlcm1pZDtcbiAgICAgIHBvaW50ZXJzdGFydCA9IHBvaW50ZXJtaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvaW50ZXJtYXggPSBwb2ludGVybWlkO1xuICAgIH1cbiAgICBwb2ludGVybWlkID0gTWF0aC5mbG9vcigocG9pbnRlcm1heCAtIHBvaW50ZXJtaW4pIC8gMiArIHBvaW50ZXJtaW4pO1xuICB9XG4gIHJldHVybiBwb2ludGVybWlkO1xufTtcblxuXG4vKipcbiAqIERldGVybWluZSB0aGUgY29tbW9uIHN1ZmZpeCBvZiB0d28gc3RyaW5ncy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge251bWJlcn0gVGhlIG51bWJlciBvZiBjaGFyYWN0ZXJzIGNvbW1vbiB0byB0aGUgZW5kIG9mIGVhY2ggc3RyaW5nLlxuICovXG5mdW5jdGlvbiBkaWZmX2NvbW1vblN1ZmZpeCh0ZXh0MSwgdGV4dDIpIHtcbiAgLy8gUXVpY2sgY2hlY2sgZm9yIGNvbW1vbiBudWxsIGNhc2VzLlxuICBpZiAoIXRleHQxIHx8ICF0ZXh0MiB8fFxuICAgICAgdGV4dDEuY2hhckF0KHRleHQxLmxlbmd0aCAtIDEpICE9IHRleHQyLmNoYXJBdCh0ZXh0Mi5sZW5ndGggLSAxKSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIC8vIEJpbmFyeSBzZWFyY2guXG4gIC8vIFBlcmZvcm1hbmNlIGFuYWx5c2lzOiBodHRwOi8vbmVpbC5mcmFzZXIubmFtZS9uZXdzLzIwMDcvMTAvMDkvXG4gIHZhciBwb2ludGVybWluID0gMDtcbiAgdmFyIHBvaW50ZXJtYXggPSBNYXRoLm1pbih0ZXh0MS5sZW5ndGgsIHRleHQyLmxlbmd0aCk7XG4gIHZhciBwb2ludGVybWlkID0gcG9pbnRlcm1heDtcbiAgdmFyIHBvaW50ZXJlbmQgPSAwO1xuICB3aGlsZSAocG9pbnRlcm1pbiA8IHBvaW50ZXJtaWQpIHtcbiAgICBpZiAodGV4dDEuc3Vic3RyaW5nKHRleHQxLmxlbmd0aCAtIHBvaW50ZXJtaWQsIHRleHQxLmxlbmd0aCAtIHBvaW50ZXJlbmQpID09XG4gICAgICAgIHRleHQyLnN1YnN0cmluZyh0ZXh0Mi5sZW5ndGggLSBwb2ludGVybWlkLCB0ZXh0Mi5sZW5ndGggLSBwb2ludGVyZW5kKSkge1xuICAgICAgcG9pbnRlcm1pbiA9IHBvaW50ZXJtaWQ7XG4gICAgICBwb2ludGVyZW5kID0gcG9pbnRlcm1pbjtcbiAgICB9IGVsc2Uge1xuICAgICAgcG9pbnRlcm1heCA9IHBvaW50ZXJtaWQ7XG4gICAgfVxuICAgIHBvaW50ZXJtaWQgPSBNYXRoLmZsb29yKChwb2ludGVybWF4IC0gcG9pbnRlcm1pbikgLyAyICsgcG9pbnRlcm1pbik7XG4gIH1cbiAgcmV0dXJuIHBvaW50ZXJtaWQ7XG59O1xuXG5cbi8qKlxuICogRG8gdGhlIHR3byB0ZXh0cyBzaGFyZSBhIHN1YnN0cmluZyB3aGljaCBpcyBhdCBsZWFzdCBoYWxmIHRoZSBsZW5ndGggb2YgdGhlXG4gKiBsb25nZXIgdGV4dD9cbiAqIFRoaXMgc3BlZWR1cCBjYW4gcHJvZHVjZSBub24tbWluaW1hbCBkaWZmcy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0MSBGaXJzdCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gdGV4dDIgU2Vjb25kIHN0cmluZy5cbiAqIEByZXR1cm4ge0FycmF5LjxzdHJpbmc+fSBGaXZlIGVsZW1lbnQgQXJyYXksIGNvbnRhaW5pbmcgdGhlIHByZWZpeCBvZlxuICogICAgIHRleHQxLCB0aGUgc3VmZml4IG9mIHRleHQxLCB0aGUgcHJlZml4IG9mIHRleHQyLCB0aGUgc3VmZml4IG9mXG4gKiAgICAgdGV4dDIgYW5kIHRoZSBjb21tb24gbWlkZGxlLiAgT3IgbnVsbCBpZiB0aGVyZSB3YXMgbm8gbWF0Y2guXG4gKi9cbmZ1bmN0aW9uIGRpZmZfaGFsZk1hdGNoXyh0ZXh0MSwgdGV4dDIpIHtcbiAgdmFyIGxvbmd0ZXh0ID0gdGV4dDEubGVuZ3RoID4gdGV4dDIubGVuZ3RoID8gdGV4dDEgOiB0ZXh0MjtcbiAgdmFyIHNob3J0dGV4dCA9IHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCA/IHRleHQyIDogdGV4dDE7XG4gIGlmIChsb25ndGV4dC5sZW5ndGggPCA0IHx8IHNob3J0dGV4dC5sZW5ndGggKiAyIDwgbG9uZ3RleHQubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG51bGw7ICAvLyBQb2ludGxlc3MuXG4gIH1cblxuICAvKipcbiAgICogRG9lcyBhIHN1YnN0cmluZyBvZiBzaG9ydHRleHQgZXhpc3Qgd2l0aGluIGxvbmd0ZXh0IHN1Y2ggdGhhdCB0aGUgc3Vic3RyaW5nXG4gICAqIGlzIGF0IGxlYXN0IGhhbGYgdGhlIGxlbmd0aCBvZiBsb25ndGV4dD9cbiAgICogQ2xvc3VyZSwgYnV0IGRvZXMgbm90IHJlZmVyZW5jZSBhbnkgZXh0ZXJuYWwgdmFyaWFibGVzLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbG9uZ3RleHQgTG9uZ2VyIHN0cmluZy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHNob3J0dGV4dCBTaG9ydGVyIHN0cmluZy5cbiAgICogQHBhcmFtIHtudW1iZXJ9IGkgU3RhcnQgaW5kZXggb2YgcXVhcnRlciBsZW5ndGggc3Vic3RyaW5nIHdpdGhpbiBsb25ndGV4dC5cbiAgICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59IEZpdmUgZWxlbWVudCBBcnJheSwgY29udGFpbmluZyB0aGUgcHJlZml4IG9mXG4gICAqICAgICBsb25ndGV4dCwgdGhlIHN1ZmZpeCBvZiBsb25ndGV4dCwgdGhlIHByZWZpeCBvZiBzaG9ydHRleHQsIHRoZSBzdWZmaXhcbiAgICogICAgIG9mIHNob3J0dGV4dCBhbmQgdGhlIGNvbW1vbiBtaWRkbGUuICBPciBudWxsIGlmIHRoZXJlIHdhcyBubyBtYXRjaC5cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIGRpZmZfaGFsZk1hdGNoSV8obG9uZ3RleHQsIHNob3J0dGV4dCwgaSkge1xuICAgIC8vIFN0YXJ0IHdpdGggYSAxLzQgbGVuZ3RoIHN1YnN0cmluZyBhdCBwb3NpdGlvbiBpIGFzIGEgc2VlZC5cbiAgICB2YXIgc2VlZCA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpLCBpICsgTWF0aC5mbG9vcihsb25ndGV4dC5sZW5ndGggLyA0KSk7XG4gICAgdmFyIGogPSAtMTtcbiAgICB2YXIgYmVzdF9jb21tb24gPSAnJztcbiAgICB2YXIgYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2I7XG4gICAgd2hpbGUgKChqID0gc2hvcnR0ZXh0LmluZGV4T2Yoc2VlZCwgaiArIDEpKSAhPSAtMSkge1xuICAgICAgdmFyIHByZWZpeExlbmd0aCA9IGRpZmZfY29tbW9uUHJlZml4KGxvbmd0ZXh0LnN1YnN0cmluZyhpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGopKTtcbiAgICAgIHZhciBzdWZmaXhMZW5ndGggPSBkaWZmX2NvbW1vblN1ZmZpeChsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvcnR0ZXh0LnN1YnN0cmluZygwLCBqKSk7XG4gICAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoIDwgc3VmZml4TGVuZ3RoICsgcHJlZml4TGVuZ3RoKSB7XG4gICAgICAgIGJlc3RfY29tbW9uID0gc2hvcnR0ZXh0LnN1YnN0cmluZyhqIC0gc3VmZml4TGVuZ3RoLCBqKSArXG4gICAgICAgICAgICBzaG9ydHRleHQuc3Vic3RyaW5nKGosIGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgICBiZXN0X2xvbmd0ZXh0X2EgPSBsb25ndGV4dC5zdWJzdHJpbmcoMCwgaSAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3RfbG9uZ3RleHRfYiA9IGxvbmd0ZXh0LnN1YnN0cmluZyhpICsgcHJlZml4TGVuZ3RoKTtcbiAgICAgICAgYmVzdF9zaG9ydHRleHRfYSA9IHNob3J0dGV4dC5zdWJzdHJpbmcoMCwgaiAtIHN1ZmZpeExlbmd0aCk7XG4gICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2IgPSBzaG9ydHRleHQuc3Vic3RyaW5nKGogKyBwcmVmaXhMZW5ndGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYmVzdF9jb21tb24ubGVuZ3RoICogMiA+PSBsb25ndGV4dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBbYmVzdF9sb25ndGV4dF9hLCBiZXN0X2xvbmd0ZXh0X2IsXG4gICAgICAgICAgICAgIGJlc3Rfc2hvcnR0ZXh0X2EsIGJlc3Rfc2hvcnR0ZXh0X2IsIGJlc3RfY29tbW9uXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gRmlyc3QgY2hlY2sgaWYgdGhlIHNlY29uZCBxdWFydGVyIGlzIHRoZSBzZWVkIGZvciBhIGhhbGYtbWF0Y2guXG4gIHZhciBobTEgPSBkaWZmX2hhbGZNYXRjaElfKGxvbmd0ZXh0LCBzaG9ydHRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguY2VpbChsb25ndGV4dC5sZW5ndGggLyA0KSk7XG4gIC8vIENoZWNrIGFnYWluIGJhc2VkIG9uIHRoZSB0aGlyZCBxdWFydGVyLlxuICB2YXIgaG0yID0gZGlmZl9oYWxmTWF0Y2hJXyhsb25ndGV4dCwgc2hvcnR0ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmNlaWwobG9uZ3RleHQubGVuZ3RoIC8gMikpO1xuICB2YXIgaG07XG4gIGlmICghaG0xICYmICFobTIpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIGlmICghaG0yKSB7XG4gICAgaG0gPSBobTE7XG4gIH0gZWxzZSBpZiAoIWhtMSkge1xuICAgIGhtID0gaG0yO1xuICB9IGVsc2Uge1xuICAgIC8vIEJvdGggbWF0Y2hlZC4gIFNlbGVjdCB0aGUgbG9uZ2VzdC5cbiAgICBobSA9IGhtMVs0XS5sZW5ndGggPiBobTJbNF0ubGVuZ3RoID8gaG0xIDogaG0yO1xuICB9XG5cbiAgLy8gQSBoYWxmLW1hdGNoIHdhcyBmb3VuZCwgc29ydCBvdXQgdGhlIHJldHVybiBkYXRhLlxuICB2YXIgdGV4dDFfYSwgdGV4dDFfYiwgdGV4dDJfYSwgdGV4dDJfYjtcbiAgaWYgKHRleHQxLmxlbmd0aCA+IHRleHQyLmxlbmd0aCkge1xuICAgIHRleHQxX2EgPSBobVswXTtcbiAgICB0ZXh0MV9iID0gaG1bMV07XG4gICAgdGV4dDJfYSA9IGhtWzJdO1xuICAgIHRleHQyX2IgPSBobVszXTtcbiAgfSBlbHNlIHtcbiAgICB0ZXh0Ml9hID0gaG1bMF07XG4gICAgdGV4dDJfYiA9IGhtWzFdO1xuICAgIHRleHQxX2EgPSBobVsyXTtcbiAgICB0ZXh0MV9iID0gaG1bM107XG4gIH1cbiAgdmFyIG1pZF9jb21tb24gPSBobVs0XTtcbiAgcmV0dXJuIFt0ZXh0MV9hLCB0ZXh0MV9iLCB0ZXh0Ml9hLCB0ZXh0Ml9iLCBtaWRfY29tbW9uXTtcbn07XG5cblxuLyoqXG4gKiBSZW9yZGVyIGFuZCBtZXJnZSBsaWtlIGVkaXQgc2VjdGlvbnMuICBNZXJnZSBlcXVhbGl0aWVzLlxuICogQW55IGVkaXQgc2VjdGlvbiBjYW4gbW92ZSBhcyBsb25nIGFzIGl0IGRvZXNuJ3QgY3Jvc3MgYW4gZXF1YWxpdHkuXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqL1xuZnVuY3Rpb24gZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpIHtcbiAgZGlmZnMucHVzaChbRElGRl9FUVVBTCwgJyddKTsgIC8vIEFkZCBhIGR1bW15IGVudHJ5IGF0IHRoZSBlbmQuXG4gIHZhciBwb2ludGVyID0gMDtcbiAgdmFyIGNvdW50X2RlbGV0ZSA9IDA7XG4gIHZhciBjb3VudF9pbnNlcnQgPSAwO1xuICB2YXIgdGV4dF9kZWxldGUgPSAnJztcbiAgdmFyIHRleHRfaW5zZXJ0ID0gJyc7XG4gIHZhciBjb21tb25sZW5ndGg7XG4gIHdoaWxlIChwb2ludGVyIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgc3dpdGNoIChkaWZmc1twb2ludGVyXVswXSkge1xuICAgICAgY2FzZSBESUZGX0lOU0VSVDpcbiAgICAgICAgY291bnRfaW5zZXJ0Kys7XG4gICAgICAgIHRleHRfaW5zZXJ0ICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBESUZGX0RFTEVURTpcbiAgICAgICAgY291bnRfZGVsZXRlKys7XG4gICAgICAgIHRleHRfZGVsZXRlICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBESUZGX0VRVUFMOlxuICAgICAgICAvLyBVcG9uIHJlYWNoaW5nIGFuIGVxdWFsaXR5LCBjaGVjayBmb3IgcHJpb3IgcmVkdW5kYW5jaWVzLlxuICAgICAgICBpZiAoY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0ID4gMSkge1xuICAgICAgICAgIGlmIChjb3VudF9kZWxldGUgIT09IDAgJiYgY291bnRfaW5zZXJ0ICE9PSAwKSB7XG4gICAgICAgICAgICAvLyBGYWN0b3Igb3V0IGFueSBjb21tb24gcHJlZml4aWVzLlxuICAgICAgICAgICAgY29tbW9ubGVuZ3RoID0gZGlmZl9jb21tb25QcmVmaXgodGV4dF9pbnNlcnQsIHRleHRfZGVsZXRlKTtcbiAgICAgICAgICAgIGlmIChjb21tb25sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgaWYgKChwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0KSA+IDAgJiZcbiAgICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVswXSA9PVxuICAgICAgICAgICAgICAgICAgRElGRl9FUVVBTCkge1xuICAgICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSBjb3VudF9kZWxldGUgLSBjb3VudF9pbnNlcnQgLSAxXVsxXSArPVxuICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkaWZmcy5zcGxpY2UoMCwgMCwgW0RJRkZfRVFVQUwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0X2luc2VydC5zdWJzdHJpbmcoMCwgY29tbW9ubGVuZ3RoKV0pO1xuICAgICAgICAgICAgICAgIHBvaW50ZXIrKztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRfaW5zZXJ0LnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICB0ZXh0X2RlbGV0ZSA9IHRleHRfZGVsZXRlLnN1YnN0cmluZyhjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRmFjdG9yIG91dCBhbnkgY29tbW9uIHN1ZmZpeGllcy5cbiAgICAgICAgICAgIGNvbW1vbmxlbmd0aCA9IGRpZmZfY29tbW9uU3VmZml4KHRleHRfaW5zZXJ0LCB0ZXh0X2RlbGV0ZSk7XG4gICAgICAgICAgICBpZiAoY29tbW9ubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgIGRpZmZzW3BvaW50ZXJdWzFdID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKHRleHRfaW5zZXJ0Lmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICBjb21tb25sZW5ndGgpICsgZGlmZnNbcG9pbnRlcl1bMV07XG4gICAgICAgICAgICAgIHRleHRfaW5zZXJ0ID0gdGV4dF9pbnNlcnQuc3Vic3RyaW5nKDAsIHRleHRfaW5zZXJ0Lmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICBjb21tb25sZW5ndGgpO1xuICAgICAgICAgICAgICB0ZXh0X2RlbGV0ZSA9IHRleHRfZGVsZXRlLnN1YnN0cmluZygwLCB0ZXh0X2RlbGV0ZS5sZW5ndGggLVxuICAgICAgICAgICAgICAgICAgY29tbW9ubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRGVsZXRlIHRoZSBvZmZlbmRpbmcgcmVjb3JkcyBhbmQgYWRkIHRoZSBtZXJnZWQgb25lcy5cbiAgICAgICAgICBpZiAoY291bnRfZGVsZXRlID09PSAwKSB7XG4gICAgICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciAtIGNvdW50X2luc2VydCxcbiAgICAgICAgICAgICAgICBjb3VudF9kZWxldGUgKyBjb3VudF9pbnNlcnQsIFtESUZGX0lOU0VSVCwgdGV4dF9pbnNlcnRdKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50X2luc2VydCA9PT0gMCkge1xuICAgICAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSBjb3VudF9kZWxldGUsXG4gICAgICAgICAgICAgICAgY291bnRfZGVsZXRlICsgY291bnRfaW5zZXJ0LCBbRElGRl9ERUxFVEUsIHRleHRfZGVsZXRlXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyIC0gY291bnRfZGVsZXRlIC0gY291bnRfaW5zZXJ0LFxuICAgICAgICAgICAgICAgIGNvdW50X2RlbGV0ZSArIGNvdW50X2luc2VydCwgW0RJRkZfREVMRVRFLCB0ZXh0X2RlbGV0ZV0sXG4gICAgICAgICAgICAgICAgW0RJRkZfSU5TRVJULCB0ZXh0X2luc2VydF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwb2ludGVyID0gcG9pbnRlciAtIGNvdW50X2RlbGV0ZSAtIGNvdW50X2luc2VydCArXG4gICAgICAgICAgICAgICAgICAgIChjb3VudF9kZWxldGUgPyAxIDogMCkgKyAoY291bnRfaW5zZXJ0ID8gMSA6IDApICsgMTtcbiAgICAgICAgfSBlbHNlIGlmIChwb2ludGVyICE9PSAwICYmIGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0VRVUFMKSB7XG4gICAgICAgICAgLy8gTWVyZ2UgdGhpcyBlcXVhbGl0eSB3aXRoIHRoZSBwcmV2aW91cyBvbmUuXG4gICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdICs9IGRpZmZzW3BvaW50ZXJdWzFdO1xuICAgICAgICAgIGRpZmZzLnNwbGljZShwb2ludGVyLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb2ludGVyKys7XG4gICAgICAgIH1cbiAgICAgICAgY291bnRfaW5zZXJ0ID0gMDtcbiAgICAgICAgY291bnRfZGVsZXRlID0gMDtcbiAgICAgICAgdGV4dF9kZWxldGUgPSAnJztcbiAgICAgICAgdGV4dF9pbnNlcnQgPSAnJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIGlmIChkaWZmc1tkaWZmcy5sZW5ndGggLSAxXVsxXSA9PT0gJycpIHtcbiAgICBkaWZmcy5wb3AoKTsgIC8vIFJlbW92ZSB0aGUgZHVtbXkgZW50cnkgYXQgdGhlIGVuZC5cbiAgfVxuXG4gIC8vIFNlY29uZCBwYXNzOiBsb29rIGZvciBzaW5nbGUgZWRpdHMgc3Vycm91bmRlZCBvbiBib3RoIHNpZGVzIGJ5IGVxdWFsaXRpZXNcbiAgLy8gd2hpY2ggY2FuIGJlIHNoaWZ0ZWQgc2lkZXdheXMgdG8gZWxpbWluYXRlIGFuIGVxdWFsaXR5LlxuICAvLyBlLmc6IEE8aW5zPkJBPC9pbnM+QyAtPiA8aW5zPkFCPC9pbnM+QUNcbiAgdmFyIGNoYW5nZXMgPSBmYWxzZTtcbiAgcG9pbnRlciA9IDE7XG4gIC8vIEludGVudGlvbmFsbHkgaWdub3JlIHRoZSBmaXJzdCBhbmQgbGFzdCBlbGVtZW50IChkb24ndCBuZWVkIGNoZWNraW5nKS5cbiAgd2hpbGUgKHBvaW50ZXIgPCBkaWZmcy5sZW5ndGggLSAxKSB7XG4gICAgaWYgKGRpZmZzW3BvaW50ZXIgLSAxXVswXSA9PSBESUZGX0VRVUFMICYmXG4gICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVswXSA9PSBESUZGX0VRVUFMKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgc2luZ2xlIGVkaXQgc3Vycm91bmRlZCBieSBlcXVhbGl0aWVzLlxuICAgICAgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZyhkaWZmc1twb2ludGVyXVsxXS5sZW5ndGggLVxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgLSAxXVsxXS5sZW5ndGgpID09IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSkge1xuICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBwcmV2aW91cyBlcXVhbGl0eS5cbiAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0gPSBkaWZmc1twb2ludGVyIC0gMV1bMV0gK1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlcl1bMV0uc3Vic3RyaW5nKDAsIGRpZmZzW3BvaW50ZXJdWzFdLmxlbmd0aCAtXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlmZnNbcG9pbnRlciAtIDFdWzFdLmxlbmd0aCk7XG4gICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSA9IGRpZmZzW3BvaW50ZXIgLSAxXVsxXSArIGRpZmZzW3BvaW50ZXIgKyAxXVsxXTtcbiAgICAgICAgZGlmZnMuc3BsaWNlKHBvaW50ZXIgLSAxLCAxKTtcbiAgICAgICAgY2hhbmdlcyA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGRpZmZzW3BvaW50ZXJdWzFdLnN1YnN0cmluZygwLCBkaWZmc1twb2ludGVyICsgMV1bMV0ubGVuZ3RoKSA9PVxuICAgICAgICAgIGRpZmZzW3BvaW50ZXIgKyAxXVsxXSkge1xuICAgICAgICAvLyBTaGlmdCB0aGUgZWRpdCBvdmVyIHRoZSBuZXh0IGVxdWFsaXR5LlxuICAgICAgICBkaWZmc1twb2ludGVyIC0gMV1bMV0gKz0gZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuICAgICAgICBkaWZmc1twb2ludGVyXVsxXSA9XG4gICAgICAgICAgICBkaWZmc1twb2ludGVyXVsxXS5zdWJzdHJpbmcoZGlmZnNbcG9pbnRlciArIDFdWzFdLmxlbmd0aCkgK1xuICAgICAgICAgICAgZGlmZnNbcG9pbnRlciArIDFdWzFdO1xuICAgICAgICBkaWZmcy5zcGxpY2UocG9pbnRlciArIDEsIDEpO1xuICAgICAgICBjaGFuZ2VzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcG9pbnRlcisrO1xuICB9XG4gIC8vIElmIHNoaWZ0cyB3ZXJlIG1hZGUsIHRoZSBkaWZmIG5lZWRzIHJlb3JkZXJpbmcgYW5kIGFub3RoZXIgc2hpZnQgc3dlZXAuXG4gIGlmIChjaGFuZ2VzKSB7XG4gICAgZGlmZl9jbGVhbnVwTWVyZ2UoZGlmZnMpO1xuICB9XG59O1xuXG5cbnZhciBkaWZmID0gZGlmZl9tYWluO1xuZGlmZi5JTlNFUlQgPSBESUZGX0lOU0VSVDtcbmRpZmYuREVMRVRFID0gRElGRl9ERUxFVEU7XG5kaWZmLkVRVUFMID0gRElGRl9FUVVBTDtcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmO1xuXG4vKlxuICogTW9kaWZ5IGEgZGlmZiBzdWNoIHRoYXQgdGhlIGN1cnNvciBwb3NpdGlvbiBwb2ludHMgdG8gdGhlIHN0YXJ0IG9mIGEgY2hhbmdlOlxuICogRS5nLlxuICogICBjdXJzb3Jfbm9ybWFsaXplX2RpZmYoW1tESUZGX0VRVUFMLCAnYWJjJ11dLCAxKVxuICogICAgID0+IFsxLCBbW0RJRkZfRVFVQUwsICdhJ10sIFtESUZGX0VRVUFMLCAnYmMnXV1dXG4gKiAgIGN1cnNvcl9ub3JtYWxpemVfZGlmZihbW0RJRkZfSU5TRVJULCAnbmV3J10sIFtESUZGX0RFTEVURSwgJ3h5eiddXSwgMilcbiAqICAgICA9PiBbMiwgW1tESUZGX0lOU0VSVCwgJ25ldyddLCBbRElGRl9ERUxFVEUsICd4eSddLCBbRElGRl9ERUxFVEUsICd6J11dXVxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKiBAcGFyYW0ge0ludH0gY3Vyc29yX3BvcyBTdWdnZXN0ZWQgZWRpdCBwb3NpdGlvbi4gTXVzdCBub3QgYmUgb3V0IG9mIGJvdW5kcyFcbiAqIEByZXR1cm4ge0FycmF5fSBBIHR1cGxlIFtjdXJzb3IgbG9jYXRpb24gaW4gdGhlIG1vZGlmaWVkIGRpZmYsIG1vZGlmaWVkIGRpZmZdXG4gKi9cbmZ1bmN0aW9uIGN1cnNvcl9ub3JtYWxpemVfZGlmZiAoZGlmZnMsIGN1cnNvcl9wb3MpIHtcbiAgaWYgKGN1cnNvcl9wb3MgPT09IDApIHtcbiAgICByZXR1cm4gW0RJRkZfRVFVQUwsIGRpZmZzXTtcbiAgfVxuICBmb3IgKHZhciBjdXJyZW50X3BvcyA9IDAsIGkgPSAwOyBpIDwgZGlmZnMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgZCA9IGRpZmZzW2ldO1xuICAgIGlmIChkWzBdID09PSBESUZGX0RFTEVURSB8fCBkWzBdID09PSBESUZGX0VRVUFMKSB7XG4gICAgICB2YXIgbmV4dF9wb3MgPSBjdXJyZW50X3BvcyArIGRbMV0ubGVuZ3RoO1xuICAgICAgaWYgKGN1cnNvcl9wb3MgPT09IG5leHRfcG9zKSB7XG4gICAgICAgIHJldHVybiBbaSArIDEsIGRpZmZzXTtcbiAgICAgIH0gZWxzZSBpZiAoY3Vyc29yX3BvcyA8IG5leHRfcG9zKSB7XG4gICAgICAgIC8vIGNvcHkgdG8gcHJldmVudCBzaWRlIGVmZmVjdHNcbiAgICAgICAgZGlmZnMgPSBkaWZmcy5zbGljZSgpO1xuICAgICAgICAvLyBzcGxpdCBkIGludG8gdHdvIGRpZmYgY2hhbmdlc1xuICAgICAgICB2YXIgc3BsaXRfcG9zID0gY3Vyc29yX3BvcyAtIGN1cnJlbnRfcG9zO1xuICAgICAgICB2YXIgZF9sZWZ0ID0gW2RbMF0sIGRbMV0uc2xpY2UoMCwgc3BsaXRfcG9zKV07XG4gICAgICAgIHZhciBkX3JpZ2h0ID0gW2RbMF0sIGRbMV0uc2xpY2Uoc3BsaXRfcG9zKV07XG4gICAgICAgIGRpZmZzLnNwbGljZShpLCAxLCBkX2xlZnQsIGRfcmlnaHQpO1xuICAgICAgICByZXR1cm4gW2kgKyAxLCBkaWZmc107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdXJyZW50X3BvcyA9IG5leHRfcG9zO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ2N1cnNvcl9wb3MgaXMgb3V0IG9mIGJvdW5kcyEnKVxufVxuXG4vKlxuICogTW9kaWZ5IGEgZGlmZiBzdWNoIHRoYXQgdGhlIGVkaXQgcG9zaXRpb24gaXMgXCJzaGlmdGVkXCIgdG8gdGhlIHByb3Bvc2VkIGVkaXQgbG9jYXRpb24gKGN1cnNvcl9wb3NpdGlvbikuXG4gKlxuICogQ2FzZSAxKVxuICogICBDaGVjayBpZiBhIG5haXZlIHNoaWZ0IGlzIHBvc3NpYmxlOlxuICogICAgIFswLCBYXSwgWyAxLCBZXSAtPiBbIDEsIFldLCBbMCwgWF0gICAgKGlmIFggKyBZID09PSBZICsgWClcbiAqICAgICBbMCwgWF0sIFstMSwgWV0gLT4gWy0xLCBZXSwgWzAsIFhdICAgIChpZiBYICsgWSA9PT0gWSArIFgpIC0gaG9sZHMgc2FtZSByZXN1bHRcbiAqIENhc2UgMilcbiAqICAgQ2hlY2sgaWYgdGhlIGZvbGxvd2luZyBzaGlmdHMgYXJlIHBvc3NpYmxlOlxuICogICAgIFswLCAncHJlJ10sIFsgMSwgJ3ByZWZpeCddIC0+IFsgMSwgJ3ByZSddLCBbMCwgJ3ByZSddLCBbIDEsICdmaXgnXVxuICogICAgIFswLCAncHJlJ10sIFstMSwgJ3ByZWZpeCddIC0+IFstMSwgJ3ByZSddLCBbMCwgJ3ByZSddLCBbLTEsICdmaXgnXVxuICogICAgICAgICBeICAgICAgICAgICAgXlxuICogICAgICAgICBkICAgICAgICAgIGRfbmV4dFxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKiBAcGFyYW0ge0ludH0gY3Vyc29yX3BvcyBTdWdnZXN0ZWQgZWRpdCBwb3NpdGlvbi4gTXVzdCBub3QgYmUgb3V0IG9mIGJvdW5kcyFcbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBkaWZmIHR1cGxlc1xuICovXG5mdW5jdGlvbiBmaXhfY3Vyc29yIChkaWZmcywgY3Vyc29yX3Bvcykge1xuICB2YXIgbm9ybSA9IGN1cnNvcl9ub3JtYWxpemVfZGlmZihkaWZmcywgY3Vyc29yX3Bvcyk7XG4gIHZhciBuZGlmZnMgPSBub3JtWzFdO1xuICB2YXIgY3Vyc29yX3BvaW50ZXIgPSBub3JtWzBdO1xuICB2YXIgZCA9IG5kaWZmc1tjdXJzb3JfcG9pbnRlcl07XG4gIHZhciBkX25leHQgPSBuZGlmZnNbY3Vyc29yX3BvaW50ZXIgKyAxXTtcblxuICBpZiAoZCA9PSBudWxsKSB7XG4gICAgLy8gVGV4dCB3YXMgZGVsZXRlZCBmcm9tIGVuZCBvZiBvcmlnaW5hbCBzdHJpbmcsXG4gICAgLy8gY3Vyc29yIGlzIG5vdyBvdXQgb2YgYm91bmRzIGluIG5ldyBzdHJpbmdcbiAgICByZXR1cm4gZGlmZnM7XG4gIH0gZWxzZSBpZiAoZFswXSAhPT0gRElGRl9FUVVBTCkge1xuICAgIC8vIEEgbW9kaWZpY2F0aW9uIGhhcHBlbmVkIGF0IHRoZSBjdXJzb3IgbG9jYXRpb24uXG4gICAgLy8gVGhpcyBpcyB0aGUgZXhwZWN0ZWQgb3V0Y29tZSwgc28gd2UgY2FuIHJldHVybiB0aGUgb3JpZ2luYWwgZGlmZi5cbiAgICByZXR1cm4gZGlmZnM7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRfbmV4dCAhPSBudWxsICYmIGRbMV0gKyBkX25leHRbMV0gPT09IGRfbmV4dFsxXSArIGRbMV0pIHtcbiAgICAgIC8vIENhc2UgMSlcbiAgICAgIC8vIEl0IGlzIHBvc3NpYmxlIHRvIHBlcmZvcm0gYSBuYWl2ZSBzaGlmdFxuICAgICAgbmRpZmZzLnNwbGljZShjdXJzb3JfcG9pbnRlciwgMiwgZF9uZXh0LCBkKVxuICAgICAgcmV0dXJuIG1lcmdlX3R1cGxlcyhuZGlmZnMsIGN1cnNvcl9wb2ludGVyLCAyKVxuICAgIH0gZWxzZSBpZiAoZF9uZXh0ICE9IG51bGwgJiYgZF9uZXh0WzFdLmluZGV4T2YoZFsxXSkgPT09IDApIHtcbiAgICAgIC8vIENhc2UgMilcbiAgICAgIC8vIGRbMV0gaXMgYSBwcmVmaXggb2YgZF9uZXh0WzFdXG4gICAgICAvLyBXZSBjYW4gYXNzdW1lIHRoYXQgZF9uZXh0WzBdICE9PSAwLCBzaW5jZSBkWzBdID09PSAwXG4gICAgICAvLyBTaGlmdCBlZGl0IGxvY2F0aW9ucy4uXG4gICAgICBuZGlmZnMuc3BsaWNlKGN1cnNvcl9wb2ludGVyLCAyLCBbZF9uZXh0WzBdLCBkWzFdXSwgWzAsIGRbMV1dKTtcbiAgICAgIHZhciBzdWZmaXggPSBkX25leHRbMV0uc2xpY2UoZFsxXS5sZW5ndGgpO1xuICAgICAgaWYgKHN1ZmZpeC5sZW5ndGggPiAwKSB7XG4gICAgICAgIG5kaWZmcy5zcGxpY2UoY3Vyc29yX3BvaW50ZXIgKyAyLCAwLCBbZF9uZXh0WzBdLCBzdWZmaXhdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXJnZV90dXBsZXMobmRpZmZzLCBjdXJzb3JfcG9pbnRlciwgMylcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm90IHBvc3NpYmxlIHRvIHBlcmZvcm0gYW55IG1vZGlmaWNhdGlvblxuICAgICAgcmV0dXJuIGRpZmZzO1xuICAgIH1cbiAgfVxufVxuXG4vKlxuICogQ2hlY2sgZGlmZiBkaWQgbm90IHNwbGl0IHN1cnJvZ2F0ZSBwYWlycy5cbiAqIEV4LiBbMCwgJ1xcdUQ4M0QnXSwgWy0xLCAnXFx1REMzNiddLCBbMSwgJ1xcdURDMkYnXSAtPiBbLTEsICdcXHVEODNEXFx1REMzNiddLCBbMSwgJ1xcdUQ4M0RcXHVEQzJGJ11cbiAqICAgICAnXFx1RDgzRFxcdURDMzYnID09PSAn8J+QticsICdcXHVEODNEXFx1REMyRicgPT09ICfwn5CvJ1xuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGRpZmZzIEFycmF5IG9mIGRpZmYgdHVwbGVzXG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXkgb2YgZGlmZiB0dXBsZXNcbiAqL1xuZnVuY3Rpb24gZml4X2Vtb2ppIChkaWZmcykge1xuICB2YXIgY29tcGFjdCA9IGZhbHNlO1xuICB2YXIgc3RhcnRzX3dpdGhfcGFpcl9lbmQgPSBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gc3RyLmNoYXJDb2RlQXQoMCkgPj0gMHhEQzAwICYmIHN0ci5jaGFyQ29kZUF0KDApIDw9IDB4REZGRjtcbiAgfVxuICB2YXIgZW5kc193aXRoX3BhaXJfc3RhcnQgPSBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gc3RyLmNoYXJDb2RlQXQoc3RyLmxlbmd0aC0xKSA+PSAweEQ4MDAgJiYgc3RyLmNoYXJDb2RlQXQoc3RyLmxlbmd0aC0xKSA8PSAweERCRkY7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDI7IGkgPCBkaWZmcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChkaWZmc1tpLTJdWzBdID09PSBESUZGX0VRVUFMICYmIGVuZHNfd2l0aF9wYWlyX3N0YXJ0KGRpZmZzW2ktMl1bMV0pICYmXG4gICAgICAgIGRpZmZzW2ktMV1bMF0gPT09IERJRkZfREVMRVRFICYmIHN0YXJ0c193aXRoX3BhaXJfZW5kKGRpZmZzW2ktMV1bMV0pICYmXG4gICAgICAgIGRpZmZzW2ldWzBdID09PSBESUZGX0lOU0VSVCAmJiBzdGFydHNfd2l0aF9wYWlyX2VuZChkaWZmc1tpXVsxXSkpIHtcbiAgICAgIGNvbXBhY3QgPSB0cnVlO1xuXG4gICAgICBkaWZmc1tpLTFdWzFdID0gZGlmZnNbaS0yXVsxXS5zbGljZSgtMSkgKyBkaWZmc1tpLTFdWzFdO1xuICAgICAgZGlmZnNbaV1bMV0gPSBkaWZmc1tpLTJdWzFdLnNsaWNlKC0xKSArIGRpZmZzW2ldWzFdO1xuXG4gICAgICBkaWZmc1tpLTJdWzFdID0gZGlmZnNbaS0yXVsxXS5zbGljZSgwLCAtMSk7XG4gICAgfVxuICB9XG4gIGlmICghY29tcGFjdCkge1xuICAgIHJldHVybiBkaWZmcztcbiAgfVxuICB2YXIgZml4ZWRfZGlmZnMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBkaWZmcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgIGlmIChkaWZmc1tpXVsxXS5sZW5ndGggPiAwKSB7XG4gICAgICBmaXhlZF9kaWZmcy5wdXNoKGRpZmZzW2ldKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZpeGVkX2RpZmZzO1xufVxuXG4vKlxuICogVHJ5IHRvIG1lcmdlIHR1cGxlcyB3aXRoIHRoZWlyIG5laWdib3JzIGluIGEgZ2l2ZW4gcmFuZ2UuXG4gKiBFLmcuIFswLCAnYSddLCBbMCwgJ2InXSAtPiBbMCwgJ2FiJ11cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaWZmcyBBcnJheSBvZiBkaWZmIHR1cGxlcy5cbiAqIEBwYXJhbSB7SW50fSBzdGFydCBQb3NpdGlvbiBvZiB0aGUgZmlyc3QgZWxlbWVudCB0byBtZXJnZSAoZGlmZnNbc3RhcnRdIGlzIGFsc28gbWVyZ2VkIHdpdGggZGlmZnNbc3RhcnQgLSAxXSkuXG4gKiBAcGFyYW0ge0ludH0gbGVuZ3RoIE51bWJlciBvZiBjb25zZWN1dGl2ZSBlbGVtZW50cyB0byBjaGVjay5cbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheSBvZiBtZXJnZWQgZGlmZiB0dXBsZXMuXG4gKi9cbmZ1bmN0aW9uIG1lcmdlX3R1cGxlcyAoZGlmZnMsIHN0YXJ0LCBsZW5ndGgpIHtcbiAgLy8gQ2hlY2sgZnJvbSAoc3RhcnQtMSkgdG8gKHN0YXJ0K2xlbmd0aCkuXG4gIGZvciAodmFyIGkgPSBzdGFydCArIGxlbmd0aCAtIDE7IGkgPj0gMCAmJiBpID49IHN0YXJ0IC0gMTsgaS0tKSB7XG4gICAgaWYgKGkgKyAxIDwgZGlmZnMubGVuZ3RoKSB7XG4gICAgICB2YXIgbGVmdF9kID0gZGlmZnNbaV07XG4gICAgICB2YXIgcmlnaHRfZCA9IGRpZmZzW2krMV07XG4gICAgICBpZiAobGVmdF9kWzBdID09PSByaWdodF9kWzFdKSB7XG4gICAgICAgIGRpZmZzLnNwbGljZShpLCAyLCBbbGVmdF9kWzBdLCBsZWZ0X2RbMV0gKyByaWdodF9kWzFdXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBkaWZmcztcbn1cbiIsIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgeSA9IGQgKiAzNjUuMjU7XG5cbi8qKlxuICogUGFyc2Ugb3IgZm9ybWF0IHRoZSBnaXZlbiBgdmFsYC5cbiAqXG4gKiBPcHRpb25zOlxuICpcbiAqICAtIGBsb25nYCB2ZXJib3NlIGZvcm1hdHRpbmcgW2ZhbHNlXVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdmFsXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAdGhyb3dzIHtFcnJvcn0gdGhyb3cgYW4gZXJyb3IgaWYgdmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSBudW1iZXJcbiAqIEByZXR1cm4ge1N0cmluZ3xOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsLCBvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWw7XG4gIGlmICh0eXBlID09PSAnc3RyaW5nJyAmJiB2YWwubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBwYXJzZSh2YWwpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIGlzTmFOKHZhbCkgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMubG9uZyA/IGZtdExvbmcodmFsKSA6IGZtdFNob3J0KHZhbCk7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICd2YWwgaXMgbm90IGEgbm9uLWVtcHR5IHN0cmluZyBvciBhIHZhbGlkIG51bWJlci4gdmFsPScgK1xuICAgICAgSlNPTi5zdHJpbmdpZnkodmFsKVxuICApO1xufTtcblxuLyoqXG4gKiBQYXJzZSB0aGUgZ2l2ZW4gYHN0cmAgYW5kIHJldHVybiBtaWxsaXNlY29uZHMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcGFyc2Uoc3RyKSB7XG4gIHN0ciA9IFN0cmluZyhzdHIpO1xuICBpZiAoc3RyLmxlbmd0aCA+IDEwMCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgbWF0Y2ggPSAvXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKFxuICAgIHN0clxuICApO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5cnMnOlxuICAgIGNhc2UgJ3lyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICdkYXlzJzpcbiAgICBjYXNlICdkYXknOlxuICAgIGNhc2UgJ2QnOlxuICAgICAgcmV0dXJuIG4gKiBkO1xuICAgIGNhc2UgJ2hvdXJzJzpcbiAgICBjYXNlICdob3VyJzpcbiAgICBjYXNlICdocnMnOlxuICAgIGNhc2UgJ2hyJzpcbiAgICBjYXNlICdoJzpcbiAgICAgIHJldHVybiBuICogaDtcbiAgICBjYXNlICdtaW51dGVzJzpcbiAgICBjYXNlICdtaW51dGUnOlxuICAgIGNhc2UgJ21pbnMnOlxuICAgIGNhc2UgJ21pbic6XG4gICAgY2FzZSAnbSc6XG4gICAgICByZXR1cm4gbiAqIG07XG4gICAgY2FzZSAnc2Vjb25kcyc6XG4gICAgY2FzZSAnc2Vjb25kJzpcbiAgICBjYXNlICdzZWNzJzpcbiAgICBjYXNlICdzZWMnOlxuICAgIGNhc2UgJ3MnOlxuICAgICAgcmV0dXJuIG4gKiBzO1xuICAgIGNhc2UgJ21pbGxpc2Vjb25kcyc6XG4gICAgY2FzZSAnbWlsbGlzZWNvbmQnOlxuICAgIGNhc2UgJ21zZWNzJzpcbiAgICBjYXNlICdtc2VjJzpcbiAgICBjYXNlICdtcyc6XG4gICAgICByZXR1cm4gbjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG4vKipcbiAqIFNob3J0IGZvcm1hdCBmb3IgYG1zYC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gbXNcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGZtdFNob3J0KG1zKSB7XG4gIGlmIChtcyA+PSBkKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgfVxuICBpZiAobXMgPj0gaCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIH1cbiAgaWYgKG1zID49IG0pIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICB9XG4gIGlmIChtcyA+PSBzKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgfVxuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gZm10TG9uZyhtcykge1xuICByZXR1cm4gcGx1cmFsKG1zLCBkLCAnZGF5JykgfHxcbiAgICBwbHVyYWwobXMsIGgsICdob3VyJykgfHxcbiAgICBwbHVyYWwobXMsIG0sICdtaW51dGUnKSB8fFxuICAgIHBsdXJhbChtcywgcywgJ3NlY29uZCcpIHx8XG4gICAgbXMgKyAnIG1zJztcbn1cblxuLyoqXG4gKiBQbHVyYWxpemF0aW9uIGhlbHBlci5cbiAqL1xuXG5mdW5jdGlvbiBwbHVyYWwobXMsIG4sIG5hbWUpIHtcbiAgaWYgKG1zIDwgbikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAobXMgPCBuICogMS41KSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IobXMgLyBuKSArICcgJyArIG5hbWU7XG4gIH1cbiAgcmV0dXJuIE1hdGguY2VpbChtcyAvIG4pICsgJyAnICsgbmFtZSArICdzJztcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiBnbG9iYWwgWSAqL1xuJ3VzZSBzdHJpY3QnXG5cbmZ1bmN0aW9uIGV4dGVuZCAoWSkge1xuICBjbGFzcyBZQXJyYXkgZXh0ZW5kcyBZLnV0aWxzLkN1c3RvbVR5cGUge1xuICAgIGNvbnN0cnVjdG9yIChvcywgX21vZGVsLCBfY29udGVudCkge1xuICAgICAgc3VwZXIoKVxuICAgICAgdGhpcy5vcyA9IG9zXG4gICAgICB0aGlzLl9tb2RlbCA9IF9tb2RlbFxuICAgICAgLy8gQXJyYXkgb2YgYWxsIHRoZSBuZWNjZXNzYXJ5IGNvbnRlbnRcbiAgICAgIHRoaXMuX2NvbnRlbnQgPSBfY29udGVudFxuXG4gICAgICAvLyB0aGUgcGFyZW50IG9mIHRoaXMgdHlwZVxuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbFxuICAgICAgdGhpcy5fZGVlcEV2ZW50SGFuZGxlciA9IG5ldyBZLnV0aWxzLkV2ZW50TGlzdGVuZXJIYW5kbGVyKClcblxuICAgICAgLy8gdGhpcy5fZGVidWdFdmVudHMgPSBbXSAvLyBUT0RPOiByZW1vdmUhIVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXIgPSBuZXcgWS51dGlscy5FdmVudEhhbmRsZXIoKG9wKSA9PiB7XG4gICAgICAgIC8vIHRoaXMuX2RlYnVnRXZlbnRzLnB1c2goSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvcCkpKVxuICAgICAgICBpZiAob3Auc3RydWN0ID09PSAnSW5zZXJ0Jykge1xuICAgICAgICAgIC8vIHdoZW4gdXNpbmcgaW5kZXhlZGRiIGRiIGFkYXB0ZXIsIHRoZSBvcCBjb3VsZCBhbHJlYWR5IGV4aXN0IChzZWUgeS1qcy95LWluZGV4ZWRkYiMyKVxuICAgICAgICAgIGlmICh0aGlzLl9jb250ZW50LnNvbWUoZnVuY3Rpb24gKGMpIHsgcmV0dXJuIFkudXRpbHMuY29tcGFyZUlkcyhjLmlkLCBvcC5pZCkgfSkpIHtcbiAgICAgICAgICAgIC8vIG9wIGV4aXN0c1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBwb3NcbiAgICAgICAgICAvLyB3ZSBjaGVjayBvcC5sZWZ0IG9ubHkhLFxuICAgICAgICAgIC8vIGJlY2F1c2Ugb3AucmlnaHQgbWlnaHQgbm90IGJlIGRlZmluZWQgd2hlbiB0aGlzIGlzIGNhbGxlZFxuICAgICAgICAgIGlmIChvcC5sZWZ0ID09PSBudWxsKSB7XG4gICAgICAgICAgICBwb3MgPSAwXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvcyA9IDEgKyB0aGlzLl9jb250ZW50LmZpbmRJbmRleChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICByZXR1cm4gWS51dGlscy5jb21wYXJlSWRzKGMuaWQsIG9wLmxlZnQpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHBvcyA8PSAwKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBvcGVyYXRpb24hJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLyogKHNlZSBhYm92ZSBmb3IgbmV3IGFwcHJvYWNoKVxuICAgICAgICAgIHZhciBfZSA9IHRoaXMuX2NvbnRlbnRbcG9zXVxuICAgICAgICAgIC8vIHdoZW4gdXNpbmcgaW5kZXhlZGRiIGRiIGFkYXB0ZXIsIHRoZSBvcCBjb3VsZCBhbHJlYWR5IGV4aXN0IChzZWUgeS1qcy95LWluZGV4ZWRkYiMyKVxuICAgICAgICAgIC8vIElmIHRoZSBhbGdvcml0aG0gd29ya3MgY29ycmVjdGx5LCB0aGUgZG91YmxlIHNob3VsZCBhbHdheXMgZXhpc3Qgb24gdGhlIGNvcnJlY3QgcG9zaXRpb24gKHBvcyAtIHRoZSBjb21wdXRlZCBkZXN0aW5hdGlvbilcbiAgICAgICAgICBpZiAoX2UgIT0gbnVsbCAmJiBZLnV0aWxzLmNvbXBhcmVJZHMoX2UuaWQsIG9wLmlkKSkge1xuICAgICAgICAgICAgLy8gaXMgYWxyZWFkeSBkZWZpbmVkXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9Ki9cbiAgICAgICAgICB2YXIgdmFsdWVzXG4gICAgICAgICAgdmFyIGxlbmd0aFxuICAgICAgICAgIGlmIChvcC5oYXNPd25Qcm9wZXJ0eSgnb3BDb250ZW50JykpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnQuc3BsaWNlKHBvcywgMCwge1xuICAgICAgICAgICAgICBpZDogb3AuaWQsXG4gICAgICAgICAgICAgIHR5cGU6IG9wLm9wQ29udGVudFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGxlbmd0aCA9IDFcbiAgICAgICAgICAgIGxldCB0eXBlID0gdGhpcy5vcy5nZXRUeXBlKG9wLm9wQ29udGVudClcbiAgICAgICAgICAgIHR5cGUuX3BhcmVudCA9IHRoaXMuX21vZGVsXG4gICAgICAgICAgICB2YWx1ZXMgPSBbdHlwZV1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGNvbnRlbnRzID0gb3AuY29udGVudC5tYXAoZnVuY3Rpb24gKGMsIGkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpZDogW29wLmlkWzBdLCBvcC5pZFsxXSArIGldLFxuICAgICAgICAgICAgICAgIHZhbDogY1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLy8gaW5zZXJ0IHZhbHVlIGluIF9jb250ZW50XG4gICAgICAgICAgICAvLyBJdCBpcyBub3QgcG9zc2libGUgdG8gaW5zZXJ0IG1vcmUgdGhhbiB+Ml4xNiBlbGVtZW50cyBpbiBhbiBBcnJheSAoc2VlICM1KS4gV2UgaGFuZGxlIHRoaXMgY2FzZSBleHBsaWNpdGx5XG4gICAgICAgICAgICBpZiAoY29udGVudHMubGVuZ3RoIDwgMzAwMDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fY29udGVudC5zcGxpY2UuYXBwbHkodGhpcy5fY29udGVudCwgW3BvcywgMF0uY29uY2F0KGNvbnRlbnRzKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuX2NvbnRlbnQgPSB0aGlzLl9jb250ZW50LnNsaWNlKDAsIHBvcykuY29uY2F0KGNvbnRlbnRzKS5jb25jYXQodGhpcy5fY29udGVudC5zbGljZShwb3MpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFsdWVzID0gb3AuY29udGVudFxuICAgICAgICAgICAgbGVuZ3RoID0gb3AuY29udGVudC5sZW5ndGhcbiAgICAgICAgICB9XG4gICAgICAgICAgWS51dGlscy5idWJibGVFdmVudCh0aGlzLCB7XG4gICAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICAgIG9iamVjdDogdGhpcyxcbiAgICAgICAgICAgIGluZGV4OiBwb3MsXG4gICAgICAgICAgICB2YWx1ZXM6IHZhbHVlcyxcbiAgICAgICAgICAgIGxlbmd0aDogbGVuZ3RoXG4gICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIGlmIChvcC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgdmFyIGkgPSAwIC8vIGN1cnJlbnQgcG9zaXRpb24gaW4gX2NvbnRlbnRcbiAgICAgICAgICBmb3IgKDsgaSA8IHRoaXMuX2NvbnRlbnQubGVuZ3RoICYmIG9wLmxlbmd0aCA+IDA7IGkrKykge1xuICAgICAgICAgICAgdmFyIGMgPSB0aGlzLl9jb250ZW50W2ldXG4gICAgICAgICAgICBpZiAoWS51dGlscy5pbkRlbGV0aW9uUmFuZ2Uob3AsIGMuaWQpKSB7XG4gICAgICAgICAgICAgIC8vIGlzIGluIGRlbGV0aW9uIHJhbmdlIVxuICAgICAgICAgICAgICB2YXIgZGVsTGVuZ3RoXG4gICAgICAgICAgICAgIC8vIGNoZWNrIGhvdyBtYW55IGNoYXJhY3RlciB0byBkZWxldGUgaW4gb25lIGZsdXNoXG4gICAgICAgICAgICAgIGZvciAoZGVsTGVuZ3RoID0gMTtcbiAgICAgICAgICAgICAgICAgICAgZGVsTGVuZ3RoIDwgb3AubGVuZ3RoICYmIGkgKyBkZWxMZW5ndGggPCB0aGlzLl9jb250ZW50Lmxlbmd0aCAmJiBZLnV0aWxzLmluRGVsZXRpb25SYW5nZShvcCwgdGhpcy5fY29udGVudFtpICsgZGVsTGVuZ3RoXS5pZCk7XG4gICAgICAgICAgICAgICAgICAgIGRlbExlbmd0aCsrKSB7fVxuICAgICAgICAgICAgICAvLyBsYXN0IG9wZXJhdGlvbiB0aGF0IHdpbGwgYmUgZGVsZXRlZFxuICAgICAgICAgICAgICBjID0gdGhpcy5fY29udGVudFtpICsgZGVsTGVuZ3RoIC0gMV1cbiAgICAgICAgICAgICAgLy8gdXBkYXRlIGRlbGV0ZSBvcGVyYXRpb25cbiAgICAgICAgICAgICAgb3AubGVuZ3RoIC09IGMuaWRbMV0gLSBvcC50YXJnZXRbMV0gKyAxXG4gICAgICAgICAgICAgIG9wLnRhcmdldCA9IFtjLmlkWzBdLCBjLmlkWzFdICsgMV1cbiAgICAgICAgICAgICAgLy8gYXBwbHkgZGVsZXRpb24gJiBmaW5kIHNlbmQgZXZlbnRcbiAgICAgICAgICAgICAgbGV0IGNvbnRlbnQgPSB0aGlzLl9jb250ZW50LnNwbGljZShpLCBkZWxMZW5ndGgpXG4gICAgICAgICAgICAgIGxldCB2YWx1ZXMgPSBjb250ZW50Lm1hcCgoYykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjLnZhbCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYy52YWxcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub3MuZ2V0VHlwZShjLnR5cGUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICBZLnV0aWxzLmJ1YmJsZUV2ZW50KHRoaXMsIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZGVsZXRlJyxcbiAgICAgICAgICAgICAgICBvYmplY3Q6IHRoaXMsXG4gICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICAgICAgX2NvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiBkZWxMZW5ndGhcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLy8gd2l0aCB0aGUgZnJlc2ggZGVsZXRlIG9wLCB3ZSBjYW4gY29udGludWVcbiAgICAgICAgICAgICAgLy8gbm90ZTogd2UgZG9uJ3QgaGF2ZSB0byBpbmNyZW1lbnQgaSwgYmVjYXVzZSB0aGUgaS10aCBjb250ZW50IHdhcyBkZWxldGVkXG4gICAgICAgICAgICAgIC8vIGJ1dCBvbiB0aGUgb3RoZXIgaGFkLCB0aGUgKGkrZGVsTGVuZ3RoKS10aCB3YXMgbm90IGluIGRlbGV0aW9uIHJhbmdlXG4gICAgICAgICAgICAgIC8vIFNvIHdlIGRvbid0IGRvIGktLVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc3RydWN0IScpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIF9nZXRQYXRoVG9DaGlsZCAoY2hpbGRJZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnQuZmluZEluZGV4KGMgPT5cbiAgICAgICAgYy50eXBlICE9IG51bGwgJiYgWS51dGlscy5jb21wYXJlSWRzKGMudHlwZSwgY2hpbGRJZClcbiAgICAgIClcbiAgICB9XG4gICAgX2Rlc3Ryb3kgKCkge1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXIuZGVzdHJveSgpXG4gICAgICB0aGlzLmV2ZW50SGFuZGxlciA9IG51bGxcbiAgICAgIHRoaXMuX2NvbnRlbnQgPSBudWxsXG4gICAgICB0aGlzLl9tb2RlbCA9IG51bGxcbiAgICAgIHRoaXMuX3BhcmVudCA9IG51bGxcbiAgICAgIHRoaXMub3MgPSBudWxsXG4gICAgfVxuICAgIGdldCBsZW5ndGggKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnQubGVuZ3RoXG4gICAgfVxuICAgIGdldCAocG9zKSB7XG4gICAgICBpZiAocG9zID09IG51bGwgfHwgdHlwZW9mIHBvcyAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb3MgbXVzdCBiZSBhIG51bWJlciEnKVxuICAgICAgfVxuICAgICAgaWYgKHBvcyA+PSB0aGlzLl9jb250ZW50Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fY29udGVudFtwb3NdLnR5cGUgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGVudFtwb3NdLnZhbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3MuZ2V0VHlwZSh0aGlzLl9jb250ZW50W3Bvc10udHlwZSlcbiAgICAgIH1cbiAgICB9XG4gICAgdG9BcnJheSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY29udGVudC5tYXAoKHgsIGkpID0+IHtcbiAgICAgICAgaWYgKHgudHlwZSAhPSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMub3MuZ2V0VHlwZSh4LnR5cGUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHgudmFsXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIHB1c2ggKGNvbnRlbnRzKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbnNlcnQodGhpcy5fY29udGVudC5sZW5ndGgsIGNvbnRlbnRzKVxuICAgIH1cbiAgICBpbnNlcnQgKHBvcywgY29udGVudHMpIHtcbiAgICAgIGlmICh0eXBlb2YgcG9zICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvcyBtdXN0IGJlIGEgbnVtYmVyIScpXG4gICAgICB9XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29udGVudHMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY29udGVudHMgbXVzdCBiZSBhbiBBcnJheSBvZiBvYmplY3RzIScpXG4gICAgICB9XG4gICAgICBpZiAoY29udGVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYgKHBvcyA+IHRoaXMuX2NvbnRlbnQubGVuZ3RoIHx8IHBvcyA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGlzIHBvc2l0aW9uIGV4Y2VlZHMgdGhlIHJhbmdlIG9mIHRoZSBhcnJheSEnKVxuICAgICAgfVxuICAgICAgdmFyIG1vc3RMZWZ0ID0gcG9zID09PSAwID8gbnVsbCA6IHRoaXMuX2NvbnRlbnRbcG9zIC0gMV0uaWRcblxuICAgICAgdmFyIG9wcyA9IFtdXG4gICAgICB2YXIgcHJldklkID0gbW9zdExlZnRcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29udGVudHMubGVuZ3RoOykge1xuICAgICAgICB2YXIgb3AgPSB7XG4gICAgICAgICAgbGVmdDogcHJldklkLFxuICAgICAgICAgIG9yaWdpbjogcHJldklkLFxuICAgICAgICAgIC8vIHJpZ2h0OiBtb3N0UmlnaHQsXG4gICAgICAgICAgLy8gTk9URTogSSBpbnRlbnRpb25hbGx5IGRvIG5vdCBkZWZpbmUgcmlnaHQgaGVyZSwgYmVjYXVzZSBpdCBjb3VsZCBiZSBkZWxldGVkXG4gICAgICAgICAgLy8gYXQgdGhlIHRpbWUgb2YgaW5zZXJ0aW5nIHRoaXMgb3BlcmF0aW9uICh3aGVuIHdlIGdldCB0aGUgdHJhbnNhY3Rpb24pLFxuICAgICAgICAgIC8vIGFuZCB3b3VsZCB0aGVyZWZvcmUgbm90IGRlZmluZWQgaW4gdGhpcy5fY29udGVudFxuICAgICAgICAgIHBhcmVudDogdGhpcy5fbW9kZWwsXG4gICAgICAgICAgc3RydWN0OiAnSW5zZXJ0J1xuICAgICAgICB9XG4gICAgICAgIHZhciBfY29udGVudCA9IFtdXG4gICAgICAgIHZhciB0eXBlRGVmaW5pdGlvblxuICAgICAgICB3aGlsZSAoaSA8IGNvbnRlbnRzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciB2YWwgPSBjb250ZW50c1tpKytdXG4gICAgICAgICAgdHlwZURlZmluaXRpb24gPSBZLnV0aWxzLmlzVHlwZURlZmluaXRpb24odmFsKVxuICAgICAgICAgIGlmICghdHlwZURlZmluaXRpb24pIHtcbiAgICAgICAgICAgIF9jb250ZW50LnB1c2godmFsKVxuICAgICAgICAgIH0gZWxzZSBpZiAoX2NvbnRlbnQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaS0tIC8vIGNvbWUgYmFjayBhZ2FpbiBsYXRlclxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKF9jb250ZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBjb250ZW50IGlzIGRlZmluZWRcbiAgICAgICAgICBvcC5jb250ZW50ID0gX2NvbnRlbnRcbiAgICAgICAgICBvcC5pZCA9IHRoaXMub3MuZ2V0TmV4dE9wSWQoX2NvbnRlbnQubGVuZ3RoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyd2lzZSBpdHMgYSB0eXBlXG4gICAgICAgICAgdmFyIHR5cGVpZCA9IHRoaXMub3MuZ2V0TmV4dE9wSWQoMSlcbiAgICAgICAgICB0aGlzLm9zLmNyZWF0ZVR5cGUodHlwZURlZmluaXRpb24sIHR5cGVpZClcbiAgICAgICAgICBvcC5vcENvbnRlbnQgPSB0eXBlaWRcbiAgICAgICAgICBvcC5pZCA9IHRoaXMub3MuZ2V0TmV4dE9wSWQoMSlcbiAgICAgICAgfVxuICAgICAgICBvcHMucHVzaChvcClcbiAgICAgICAgcHJldklkID0gb3AuaWRcbiAgICAgIH1cbiAgICAgIHZhciBldmVudEhhbmRsZXIgPSB0aGlzLmV2ZW50SGFuZGxlclxuICAgICAgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgLy8gbm93IHdlIGNhbiBzZXQgdGhlIHJpZ2h0IHJlZmVyZW5jZS5cbiAgICAgICAgdmFyIG1vc3RSaWdodFxuICAgICAgICBpZiAobW9zdExlZnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBtbCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKG1vc3RMZWZ0KVxuICAgICAgICAgIG1vc3RSaWdodCA9IG1sLnJpZ2h0XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbW9zdFJpZ2h0ID0gKHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcHNbMF0ucGFyZW50KSkuc3RhcnRcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG9wcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciBvcCA9IG9wc1tqXVxuICAgICAgICAgIG9wLnJpZ2h0ID0gbW9zdFJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgeWllbGQqIGV2ZW50SGFuZGxlci5hd2FpdE9wcyh0aGlzLCB0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsIFtvcHNdKVxuICAgICAgfSlcbiAgICAgIC8vIGFsd2F5cyByZW1lbWJlciB0byBkbyB0aGF0IGFmdGVyIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uXG4gICAgICAvLyAob3RoZXJ3aXNlIHZhbHVlcyBtaWdodCBjb250YWluIGEgdW5kZWZpbmVkIHJlZmVyZW5jZSB0byB0eXBlKVxuICAgICAgZXZlbnRIYW5kbGVyLmF3YWl0QW5kUHJlbWF0dXJlbHlDYWxsKG9wcylcbiAgICB9XG4gICAgZGVsZXRlIChwb3MsIGxlbmd0aCkge1xuICAgICAgaWYgKGxlbmd0aCA9PSBudWxsKSB7IGxlbmd0aCA9IDEgfVxuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignbGVuZ3RoIG11c3QgYmUgYSBudW1iZXIhJylcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgcG9zICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvcyBtdXN0IGJlIGEgbnVtYmVyIScpXG4gICAgICB9XG4gICAgICBpZiAocG9zICsgbGVuZ3RoID4gdGhpcy5fY29udGVudC5sZW5ndGggfHwgcG9zIDwgMCB8fCBsZW5ndGggPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGRlbGV0aW9uIHJhbmdlIGV4Y2VlZHMgdGhlIHJhbmdlIG9mIHRoZSBhcnJheSEnKVxuICAgICAgfVxuICAgICAgaWYgKGxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHZhciBldmVudEhhbmRsZXIgPSB0aGlzLmV2ZW50SGFuZGxlclxuICAgICAgdmFyIGRlbHMgPSBbXVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgPSBpICsgZGVsTGVuZ3RoKSB7XG4gICAgICAgIHZhciB0YXJnZXRJZCA9IHRoaXMuX2NvbnRlbnRbcG9zICsgaV0uaWRcbiAgICAgICAgdmFyIGRlbExlbmd0aFxuICAgICAgICAvLyBob3cgbWFueSBpbnNlcnRpb25zIGNhbiB3ZSBkZWxldGUgaW4gb25lIGRlbGV0aW9uP1xuICAgICAgICBmb3IgKGRlbExlbmd0aCA9IDE7IGkgKyBkZWxMZW5ndGggPCBsZW5ndGg7IGRlbExlbmd0aCsrKSB7XG4gICAgICAgICAgaWYgKCFZLnV0aWxzLmNvbXBhcmVJZHModGhpcy5fY29udGVudFtwb3MgKyBpICsgZGVsTGVuZ3RoXS5pZCwgW3RhcmdldElkWzBdLCB0YXJnZXRJZFsxXSArIGRlbExlbmd0aF0pKSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBkZWxzLnB1c2goe1xuICAgICAgICAgIHRhcmdldDogdGFyZ2V0SWQsXG4gICAgICAgICAgc3RydWN0OiAnRGVsZXRlJyxcbiAgICAgICAgICBsZW5ndGg6IGRlbExlbmd0aFxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgeWllbGQqIGV2ZW50SGFuZGxlci5hd2FpdE9wcyh0aGlzLCB0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsIFtkZWxzXSlcbiAgICAgIH0pXG4gICAgICAvLyBhbHdheXMgcmVtZW1iZXIgdG8gZG8gdGhhdCBhZnRlciB0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvblxuICAgICAgLy8gKG90aGVyd2lzZSB2YWx1ZXMgbWlnaHQgY29udGFpbiBhIHVuZGVmaW5lZCByZWZlcmVuY2UgdG8gdHlwZSlcbiAgICAgIGV2ZW50SGFuZGxlci5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChkZWxzKVxuICAgIH1cbiAgICBvYnNlcnZlIChmKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIG9ic2VydmVEZWVwIChmKSB7XG4gICAgICB0aGlzLl9kZWVwRXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIoZilcbiAgICB9XG4gICAgdW5vYnNlcnZlIChmKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIHVub2JzZXJ2ZURlZXAgKGYpIHtcbiAgICAgIHRoaXMuX2RlZXBFdmVudEhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihmKVxuICAgIH1cbiAgICAqIF9jaGFuZ2VkICh0cmFuc2FjdGlvbiwgb3ApIHtcbiAgICAgIGlmICghb3AuZGVsZXRlZCkge1xuICAgICAgICBpZiAob3Auc3RydWN0ID09PSAnSW5zZXJ0Jykge1xuICAgICAgICAgIC8vIHVwZGF0ZSBsZWZ0XG4gICAgICAgICAgdmFyIGwgPSBvcC5sZWZ0XG4gICAgICAgICAgdmFyIGxlZnRcbiAgICAgICAgICB3aGlsZSAobCAhPSBudWxsKSB7XG4gICAgICAgICAgICBsZWZ0ID0geWllbGQqIHRyYW5zYWN0aW9uLmdldEluc2VydGlvbihsKVxuICAgICAgICAgICAgaWYgKCFsZWZ0LmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGwgPSBsZWZ0LmxlZnRcbiAgICAgICAgICB9XG4gICAgICAgICAgb3AubGVmdCA9IGxcbiAgICAgICAgICAvLyBpZiBvcCBjb250YWlucyBvcENvbnRlbnQsIGluaXRpYWxpemUgaXRcbiAgICAgICAgICBpZiAob3Aub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0cmFuc2FjdGlvbi5zdG9yZS5pbml0VHlwZS5jYWxsKHRyYW5zYWN0aW9uLCBvcC5vcENvbnRlbnQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyLnJlY2VpdmVkT3Aob3ApXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgWS5leHRlbmQoJ0FycmF5JywgbmV3IFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe1xuICAgIG5hbWU6ICdBcnJheScsXG4gICAgY2xhc3M6IFlBcnJheSxcbiAgICBzdHJ1Y3Q6ICdMaXN0JyxcbiAgICBpbml0VHlwZTogZnVuY3Rpb24gKiBZQXJyYXlJbml0aWFsaXplciAob3MsIG1vZGVsKSB7XG4gICAgICB2YXIgX2NvbnRlbnQgPSBbXVxuICAgICAgdmFyIF90eXBlcyA9IFtdXG4gICAgICB5aWVsZCogWS5TdHJ1Y3QuTGlzdC5tYXAuY2FsbCh0aGlzLCBtb2RlbCwgZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgIGlmIChvcC5oYXNPd25Qcm9wZXJ0eSgnb3BDb250ZW50JykpIHtcbiAgICAgICAgICBfY29udGVudC5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBvcC5pZCxcbiAgICAgICAgICAgIHR5cGU6IG9wLm9wQ29udGVudFxuICAgICAgICAgIH0pXG4gICAgICAgICAgX3R5cGVzLnB1c2gob3Aub3BDb250ZW50KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9wLmNvbnRlbnQuZm9yRWFjaChmdW5jdGlvbiAoYywgaSkge1xuICAgICAgICAgICAgX2NvbnRlbnQucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBbb3AuaWRbMF0sIG9wLmlkWzFdICsgaV0sXG4gICAgICAgICAgICAgIHZhbDogb3AuY29udGVudFtpXVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfdHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHR5cGUgPSB5aWVsZCogdGhpcy5zdG9yZS5pbml0VHlwZS5jYWxsKHRoaXMsIF90eXBlc1tpXSlcbiAgICAgICAgdHlwZS5fcGFyZW50ID0gbW9kZWwuaWRcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgWUFycmF5KG9zLCBtb2RlbC5pZCwgX2NvbnRlbnQpXG4gICAgfSxcbiAgICBjcmVhdGVUeXBlOiBmdW5jdGlvbiBZQXJyYXlDcmVhdGVUeXBlIChvcywgbW9kZWwpIHtcbiAgICAgIHJldHVybiBuZXcgWUFycmF5KG9zLCBtb2RlbC5pZCwgW10pXG4gICAgfVxuICB9KSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCIvKiBnbG9iYWwgWSAqL1xuJ3VzZSBzdHJpY3QnXG5cbmZ1bmN0aW9uIGV4dGVuZCAoWSAvKiA6YW55ICovKSB7XG4gIGNsYXNzIFlNYXAgZXh0ZW5kcyBZLnV0aWxzLkN1c3RvbVR5cGUge1xuICAgIC8qIDo6XG4gICAgX21vZGVsOiBJZDtcbiAgICBvczogWS5BYnN0cmFjdERhdGFiYXNlO1xuICAgIG1hcDogT2JqZWN0O1xuICAgIGNvbnRlbnRzOiBhbnk7XG4gICAgb3BDb250ZW50czogT2JqZWN0O1xuICAgIGV2ZW50SGFuZGxlcjogRnVuY3Rpb247XG4gICAgKi9cbiAgICBjb25zdHJ1Y3RvciAob3MsIG1vZGVsLCBjb250ZW50cywgb3BDb250ZW50cykge1xuICAgICAgc3VwZXIoKVxuICAgICAgdGhpcy5fbW9kZWwgPSBtb2RlbC5pZFxuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbFxuICAgICAgdGhpcy5fZGVlcEV2ZW50SGFuZGxlciA9IG5ldyBZLnV0aWxzLkV2ZW50TGlzdGVuZXJIYW5kbGVyKClcbiAgICAgIHRoaXMub3MgPSBvc1xuICAgICAgdGhpcy5tYXAgPSBZLnV0aWxzLmNvcHlPYmplY3QobW9kZWwubWFwKVxuICAgICAgdGhpcy5jb250ZW50cyA9IGNvbnRlbnRzXG4gICAgICB0aGlzLm9wQ29udGVudHMgPSBvcENvbnRlbnRzXG4gICAgICB0aGlzLmV2ZW50SGFuZGxlciA9IG5ldyBZLnV0aWxzLkV2ZW50SGFuZGxlcihvcCA9PiB7XG4gICAgICAgIHZhciBvbGRWYWx1ZVxuICAgICAgICAvLyBrZXkgaXMgdGhlIG5hbWUgdG8gdXNlIHRvIGFjY2VzcyAob3ApY29udGVudFxuICAgICAgICB2YXIga2V5ID0gb3Auc3RydWN0ID09PSAnRGVsZXRlJyA/IG9wLmtleSA6IG9wLnBhcmVudFN1YlxuXG4gICAgICAgIC8vIGNvbXB1dGUgb2xkVmFsdWVcbiAgICAgICAgaWYgKHRoaXMub3BDb250ZW50c1trZXldICE9IG51bGwpIHtcbiAgICAgICAgICBvbGRWYWx1ZSA9IHRoaXMub3MuZ2V0VHlwZSh0aGlzLm9wQ29udGVudHNba2V5XSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvbGRWYWx1ZSA9IHRoaXMuY29udGVudHNba2V5XVxuICAgICAgICB9XG4gICAgICAgIC8vIGNvbXB1dGUgb3AgZXZlbnRcbiAgICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICBpZiAob3AubGVmdCA9PT0gbnVsbCAmJiAhWS51dGlscy5jb21wYXJlSWRzKG9wLmlkLCB0aGlzLm1hcFtrZXldKSkge1xuICAgICAgICAgICAgdmFyIHZhbHVlXG4gICAgICAgICAgICAvLyBUT0RPOiB3aGF0IGlmIG9wLmRlbGV0ZWQ/Pz8gSSBwYXJ0aWFsbHkgaGFuZGxlcyB0aGlzIGNhc2UgaGVyZS4uIGJ1dCBuZWVkIHRvIHNlbmQgZGVsZXRlIGV2ZW50IGluc3RlYWQuIHNvbWVob3cgcmVsYXRlZCB0byAjNFxuICAgICAgICAgICAgaWYgKG9wLm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5vcy5nZXRUeXBlKG9wLm9wQ29udGVudClcbiAgICAgICAgICAgICAgdmFsdWUuX3BhcmVudCA9IHRoaXMuX21vZGVsXG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRlbnRzW2tleV1cbiAgICAgICAgICAgICAgaWYgKG9wLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5vcENvbnRlbnRzW2tleV1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wQ29udGVudHNba2V5XSA9IG9wLm9wQ29udGVudFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2YWx1ZSA9IG9wLmNvbnRlbnRbMF1cbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMub3BDb250ZW50c1trZXldXG4gICAgICAgICAgICAgIGlmIChvcC5kZWxldGVkKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGVudHNba2V5XVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGVudHNba2V5XSA9IG9wLmNvbnRlbnRbMF1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5tYXBba2V5XSA9IG9wLmlkXG4gICAgICAgICAgICBpZiAob2xkVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBZLnV0aWxzLmJ1YmJsZUV2ZW50KHRoaXMsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgICAgICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGQnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgWS51dGlscy5idWJibGVFdmVudCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgbmFtZToga2V5LFxuICAgICAgICAgICAgICAgIG9iamVjdDogdGhpcyxcbiAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsdWUsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG9wLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICBpZiAoWS51dGlscy5jb21wYXJlSWRzKHRoaXMubWFwW2tleV0sIG9wLnRhcmdldCkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLm9wQ29udGVudHNba2V5XVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGVudHNba2V5XVxuICAgICAgICAgICAgWS51dGlscy5idWJibGVFdmVudCh0aGlzLCB7XG4gICAgICAgICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsdWUsXG4gICAgICAgICAgICAgIHR5cGU6ICdkZWxldGUnXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgT3BlcmF0aW9uIScpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIF9nZXRQYXRoVG9DaGlsZCAoY2hpbGRJZCkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMub3BDb250ZW50cykuZmluZChrZXkgPT5cbiAgICAgICAgWS51dGlscy5jb21wYXJlSWRzKHRoaXMub3BDb250ZW50c1trZXldLCBjaGlsZElkKVxuICAgICAgKVxuICAgIH1cbiAgICBfZGVzdHJveSAoKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5kZXN0cm95KClcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyID0gbnVsbFxuICAgICAgdGhpcy5jb250ZW50cyA9IG51bGxcbiAgICAgIHRoaXMub3BDb250ZW50cyA9IG51bGxcbiAgICAgIHRoaXMuX21vZGVsID0gbnVsbFxuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbFxuICAgICAgdGhpcy5vcyA9IG51bGxcbiAgICAgIHRoaXMubWFwID0gbnVsbFxuICAgIH1cbiAgICBnZXQgKGtleSkge1xuICAgICAgLy8gcmV0dXJuIHByb3BlcnR5LlxuICAgICAgLy8gaWYgcHJvcGVydHkgZG9lcyBub3QgZXhpc3QsIHJldHVybiBudWxsXG4gICAgICAvLyBpZiBwcm9wZXJ0eSBpcyBhIHR5cGUsIHJldHVybiBpdFxuICAgICAgaWYgKGtleSA9PSBudWxsIHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3Qgc3BlY2lmeSBhIGtleSAoYXMgc3RyaW5nKSEnKVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3BDb250ZW50c1trZXldID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudHNba2V5XVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3MuZ2V0VHlwZSh0aGlzLm9wQ29udGVudHNba2V5XSlcbiAgICAgIH1cbiAgICB9XG4gICAga2V5cyAoKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5jb250ZW50cykuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMub3BDb250ZW50cykpXG4gICAgfVxuICAgIGtleXNQcmltaXRpdmVzICgpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmNvbnRlbnRzKVxuICAgIH1cbiAgICBrZXlzVHlwZXMgKCkge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMub3BDb250ZW50cylcbiAgICB9XG4gICAgLypcbiAgICAgIElmIHRoZXJlIGlzIGEgcHJpbWl0aXZlIChub3QgYSBjdXN0b20gdHlwZSksIHRoZW4gcmV0dXJuIGl0LlxuICAgICAgUmV0dXJucyBhbGwgcHJpbWl0aXZlIHZhbHVlcywgaWYgcHJvcGVydHlOYW1lIGlzIHNwZWNpZmllZCFcbiAgICAgIE5vdGU6IG1vZGlmeWluZyB0aGUgcmV0dXJuIHZhbHVlIGNvdWxkIHJlc3VsdCBpbiBpbmNvbnNpc3RlbmNpZXMhXG4gICAgICAgIC0tIHNvIG1ha2Ugc3VyZSB0byBjb3B5IGl0IGZpcnN0IVxuICAgICovXG4gICAgZ2V0UHJpbWl0aXZlIChrZXkpIHtcbiAgICAgIGlmIChrZXkgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gWS51dGlscy5jb3B5T2JqZWN0KHRoaXMuY29udGVudHMpXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignS2V5IGlzIGV4cGVjdGVkIHRvIGJlIGEgc3RyaW5nIScpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5jb250ZW50c1trZXldXG4gICAgICB9XG4gICAgfVxuICAgIGdldFR5cGUgKGtleSkge1xuICAgICAgaWYgKGtleSA9PSBudWxsIHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3Qgc3BlY2lmeSBhIGtleSAoYXMgc3RyaW5nKSEnKVxuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wQ29udGVudHNba2V5XSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9zLmdldFR5cGUodGhpcy5vcENvbnRlbnRzW2tleV0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgIH1cbiAgICBkZWxldGUgKGtleSkge1xuICAgICAgdmFyIHJpZ2h0ID0gdGhpcy5tYXBba2V5XVxuICAgICAgaWYgKHJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGRlbCA9IHtcbiAgICAgICAgICB0YXJnZXQ6IHJpZ2h0LFxuICAgICAgICAgIHN0cnVjdDogJ0RlbGV0ZSdcbiAgICAgICAgfVxuICAgICAgICB2YXIgZXZlbnRIYW5kbGVyID0gdGhpcy5ldmVudEhhbmRsZXJcbiAgICAgICAgdmFyIG1vZERlbCA9IFkudXRpbHMuY29weU9iamVjdChkZWwpXG4gICAgICAgIG1vZERlbC5rZXkgPSBrZXlcbiAgICAgICAgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgICB5aWVsZCogZXZlbnRIYW5kbGVyLmF3YWl0T3BzKHRoaXMsIHRoaXMuYXBwbHlDcmVhdGVkT3BlcmF0aW9ucywgW1tkZWxdXSlcbiAgICAgICAgfSlcbiAgICAgICAgLy8gYWx3YXlzIHJlbWVtYmVyIHRvIGRvIHRoYXQgYWZ0ZXIgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb25cbiAgICAgICAgLy8gKG90aGVyd2lzZSB2YWx1ZXMgbWlnaHQgY29udGFpbiBhIHVuZGVmaW5lZCByZWZlcmVuY2UgdG8gdHlwZSlcbiAgICAgICAgZXZlbnRIYW5kbGVyLmF3YWl0QW5kUHJlbWF0dXJlbHlDYWxsKFttb2REZWxdKVxuICAgICAgfVxuICAgIH1cbiAgICBzZXQgKGtleSwgdmFsdWUpIHtcbiAgICAgIC8vIHNldCBwcm9wZXJ0eS5cbiAgICAgIC8vIGlmIHByb3BlcnR5IGlzIGEgdHlwZSwgcmV0dXJuIGl0XG4gICAgICAvLyBpZiBub3QsIGFwcGx5IGltbWVkaWF0ZWx5IG9uIHRoaXMgdHlwZSBhbiBjYWxsIGV2ZW50XG5cbiAgICAgIHZhciByaWdodCA9IHRoaXMubWFwW2tleV0gfHwgbnVsbFxuICAgICAgdmFyIGluc2VydCAvKiA6YW55ICovID0ge1xuICAgICAgICBpZDogdGhpcy5vcy5nZXROZXh0T3BJZCgxKSxcbiAgICAgICAgbGVmdDogbnVsbCxcbiAgICAgICAgcmlnaHQ6IHJpZ2h0LFxuICAgICAgICBvcmlnaW46IG51bGwsXG4gICAgICAgIHBhcmVudDogdGhpcy5fbW9kZWwsXG4gICAgICAgIHBhcmVudFN1Yjoga2V5LFxuICAgICAgICBzdHJ1Y3Q6ICdJbnNlcnQnXG4gICAgICB9XG4gICAgICB2YXIgZXZlbnRIYW5kbGVyID0gdGhpcy5ldmVudEhhbmRsZXJcbiAgICAgIHZhciB0eXBlRGVmaW5pdGlvbiA9IFkudXRpbHMuaXNUeXBlRGVmaW5pdGlvbih2YWx1ZSlcbiAgICAgIGlmICh0eXBlRGVmaW5pdGlvbiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0aGlzLm9zLmNyZWF0ZVR5cGUodHlwZURlZmluaXRpb24pXG4gICAgICAgIGluc2VydC5vcENvbnRlbnQgPSB0eXBlLl9tb2RlbFxuICAgICAgICAvLyBjb25zdHJ1Y3QgYSBuZXcgdHlwZVxuICAgICAgICB0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqKCkge1xuICAgICAgICAgIHlpZWxkKiBldmVudEhhbmRsZXIuYXdhaXRPcHModGhpcywgdGhpcy5hcHBseUNyZWF0ZWRPcGVyYXRpb25zLCBbW2luc2VydF1dKVxuICAgICAgICB9KVxuICAgICAgICAvLyBhbHdheXMgcmVtZW1iZXIgdG8gZG8gdGhhdCBhZnRlciB0aGlzLm9zLnJlcXVlc3RUcmFuc2FjdGlvblxuICAgICAgICAvLyAob3RoZXJ3aXNlIHZhbHVlcyBtaWdodCBjb250YWluIGEgdW5kZWZpbmVkIHJlZmVyZW5jZSB0byB0eXBlKVxuICAgICAgICBldmVudEhhbmRsZXIuYXdhaXRBbmRQcmVtYXR1cmVseUNhbGwoW2luc2VydF0pXG4gICAgICAgIHJldHVybiB0eXBlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnQuY29udGVudCA9IFt2YWx1ZV1cbiAgICAgICAgdGhpcy5vcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgeWllbGQqIGV2ZW50SGFuZGxlci5hd2FpdE9wcyh0aGlzLCB0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMsIFtbaW5zZXJ0XV0pXG4gICAgICAgIH0pXG4gICAgICAgIC8vIGFsd2F5cyByZW1lbWJlciB0byBkbyB0aGF0IGFmdGVyIHRoaXMub3MucmVxdWVzdFRyYW5zYWN0aW9uXG4gICAgICAgIC8vIChvdGhlcndpc2UgdmFsdWVzIG1pZ2h0IGNvbnRhaW4gYSB1bmRlZmluZWQgcmVmZXJlbmNlIHRvIHR5cGUpXG4gICAgICAgIGV2ZW50SGFuZGxlci5hd2FpdEFuZFByZW1hdHVyZWx5Q2FsbChbaW5zZXJ0XSlcbiAgICAgICAgcmV0dXJuIHZhbHVlXG4gICAgICB9XG4gICAgfVxuICAgIG9ic2VydmUgKGYpIHtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyLmFkZEV2ZW50TGlzdGVuZXIoZilcbiAgICB9XG4gICAgb2JzZXJ2ZURlZXAgKGYpIHtcbiAgICAgIHRoaXMuX2RlZXBFdmVudEhhbmRsZXIuYWRkRXZlbnRMaXN0ZW5lcihmKVxuICAgIH1cbiAgICB1bm9ic2VydmUgKGYpIHtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoZilcbiAgICB9XG4gICAgdW5vYnNlcnZlRGVlcCAoZikge1xuICAgICAgdGhpcy5fZGVlcEV2ZW50SGFuZGxlci5yZW1vdmVFdmVudExpc3RlbmVyKGYpXG4gICAgfVxuICAgIC8qXG4gICAgICBPYnNlcnZlIGEgcGF0aC5cblxuICAgICAgRS5nLlxuICAgICAgYGBgXG4gICAgICBvLnNldCgndGV4dGFyZWEnLCBZLlRleHRCaW5kKVxuICAgICAgby5vYnNlcnZlUGF0aChbJ3RleHRhcmVhJ10sIGZ1bmN0aW9uKHQpe1xuICAgICAgICAvLyBpcyBjYWxsZWQgd2hlbmV2ZXIgdGV4dGFyZWEgaXMgcmVwbGFjZWRcbiAgICAgICAgdC5iaW5kKHRleHRhcmVhKVxuICAgICAgfSlcblxuICAgICAgcmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgcmVtb3ZlcyB0aGUgb2JzZXJ2ZXIgZnJvbSB0aGUgcGF0aC5cbiAgICAqL1xuICAgIG9ic2VydmVQYXRoIChwYXRoLCBmKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgIHZhciBwcm9wZXJ0eU5hbWVcbiAgICAgIGZ1bmN0aW9uIG9ic2VydmVQcm9wZXJ0eSAoZXZlbnQpIHtcbiAgICAgICAgLy8gY2FsbCBmIHdoZW5ldmVyIHBhdGggY2hhbmdlc1xuICAgICAgICBpZiAoZXZlbnQubmFtZSA9PT0gcHJvcGVydHlOYW1lKSB7XG4gICAgICAgICAgLy8gY2FsbCB0aGlzIGFsc28gZm9yIGRlbGV0ZSBldmVudHMhXG4gICAgICAgICAgZihzZWxmLmdldChwcm9wZXJ0eU5hbWUpKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXRoLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgZih0aGlzKVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge31cbiAgICAgIH0gZWxzZSBpZiAocGF0aC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgcHJvcGVydHlOYW1lID0gcGF0aFswXVxuICAgICAgICBmKHNlbGYuZ2V0KHByb3BlcnR5TmFtZSkpXG4gICAgICAgIHRoaXMub2JzZXJ2ZShvYnNlcnZlUHJvcGVydHkpXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgc2VsZi51bm9ic2VydmUoZilcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGRlbGV0ZUNoaWxkT2JzZXJ2ZXJzXG4gICAgICAgIHZhciByZXNldE9ic2VydmVyUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgbWFwID0gc2VsZi5nZXQocGF0aFswXSlcbiAgICAgICAgICBpZiAoIShtYXAgaW5zdGFuY2VvZiBZTWFwKSkge1xuICAgICAgICAgICAgLy8gaXRzIGVpdGhlciBub3QgZGVmaW5lZCBvciBhIHByaW1pdGl2ZSB2YWx1ZSAvIG5vdCBhIG1hcFxuICAgICAgICAgICAgbWFwID0gc2VsZi5zZXQocGF0aFswXSwgWS5NYXApXG4gICAgICAgICAgfVxuICAgICAgICAgIGRlbGV0ZUNoaWxkT2JzZXJ2ZXJzID0gbWFwLm9ic2VydmVQYXRoKHBhdGguc2xpY2UoMSksIGYpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIG9ic2VydmVyID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKGV2ZW50Lm5hbWUgPT09IHBhdGhbMF0pIHtcbiAgICAgICAgICAgIGlmIChkZWxldGVDaGlsZE9ic2VydmVycyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGRlbGV0ZUNoaWxkT2JzZXJ2ZXJzKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnYWRkJyB8fCBldmVudC50eXBlID09PSAndXBkYXRlJykge1xuICAgICAgICAgICAgICByZXNldE9ic2VydmVyUGF0aCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUT0RPOiB3aGF0IGFib3V0IHRoZSBkZWxldGUgZXZlbnRzP1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzZWxmLm9ic2VydmUob2JzZXJ2ZXIpXG4gICAgICAgIHJlc2V0T2JzZXJ2ZXJQYXRoKClcbiAgICAgICAgLy8gcmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgZGVsZXRlcyBhbGwgdGhlIGNoaWxkIG9ic2VydmVyc1xuICAgICAgICAvLyBhbmQgaG93IHRvIHVub2JzZXJ2ZSB0aGUgb2JzZXJ2ZSBmcm9tIHRoaXMgb2JqZWN0XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKGRlbGV0ZUNoaWxkT2JzZXJ2ZXJzICE9IG51bGwpIHtcbiAgICAgICAgICAgIGRlbGV0ZUNoaWxkT2JzZXJ2ZXJzKClcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi51bm9ic2VydmUob2JzZXJ2ZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBfY2hhbmdlZCAodHJhbnNhY3Rpb24sIG9wKSB7XG4gICAgICBpZiAob3Auc3RydWN0ID09PSAnRGVsZXRlJykge1xuICAgICAgICBpZiAob3Aua2V5ID09IG51bGwpIHtcbiAgICAgICAgICB2YXIgdGFyZ2V0ID0geWllbGQqIHRyYW5zYWN0aW9uLmdldE9wZXJhdGlvbihvcC50YXJnZXQpXG4gICAgICAgICAgb3Aua2V5ID0gdGFyZ2V0LnBhcmVudFN1YlxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKG9wLm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgIHlpZWxkKiB0cmFuc2FjdGlvbi5zdG9yZS5pbml0VHlwZS5jYWxsKHRyYW5zYWN0aW9uLCBvcC5vcENvbnRlbnQpXG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlci5yZWNlaXZlZE9wKG9wKVxuICAgIH1cbiAgfVxuICBZLmV4dGVuZCgnTWFwJywgbmV3IFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe1xuICAgIG5hbWU6ICdNYXAnLFxuICAgIGNsYXNzOiBZTWFwLFxuICAgIHN0cnVjdDogJ01hcCcsXG4gICAgaW5pdFR5cGU6IGZ1bmN0aW9uICogWU1hcEluaXRpYWxpemVyIChvcywgbW9kZWwpIHtcbiAgICAgIHZhciBjb250ZW50cyA9IHt9XG4gICAgICB2YXIgb3BDb250ZW50cyA9IHt9XG4gICAgICB2YXIgbWFwID0gbW9kZWwubWFwXG4gICAgICBmb3IgKHZhciBuYW1lIGluIG1hcCkge1xuICAgICAgICB2YXIgb3AgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24obWFwW25hbWVdKVxuICAgICAgICBpZiAob3AuZGVsZXRlZCkgY29udGludWVcbiAgICAgICAgaWYgKG9wLm9wQ29udGVudCAhPSBudWxsKSB7XG4gICAgICAgICAgb3BDb250ZW50c1tuYW1lXSA9IG9wLm9wQ29udGVudFxuICAgICAgICAgIHZhciB0eXBlID0geWllbGQqIHRoaXMuc3RvcmUuaW5pdFR5cGUuY2FsbCh0aGlzLCBvcC5vcENvbnRlbnQpXG4gICAgICAgICAgdHlwZS5fcGFyZW50ID0gbW9kZWwuaWRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250ZW50c1tuYW1lXSA9IG9wLmNvbnRlbnRbMF1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBZTWFwKG9zLCBtb2RlbCwgY29udGVudHMsIG9wQ29udGVudHMpXG4gICAgfSxcbiAgICBjcmVhdGVUeXBlOiBmdW5jdGlvbiBZTWFwQ3JlYXRvciAob3MsIG1vZGVsKSB7XG4gICAgICByZXR1cm4gbmV3IFlNYXAob3MsIG1vZGVsLCB7fSwge30pXG4gICAgfVxuICB9KSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcbmlmICh0eXBlb2YgWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgZXh0ZW5kKFkpXG59XG4iLCIvKiBnbG9iYWwgWSAqL1xuJ3VzZSBzdHJpY3QnXG5cbmZ1bmN0aW9uIGV4dGVuZCAoWSkge1xuICByZXF1aXJlKCcuL1JlZEJsYWNrVHJlZS5qcycpKFkpXG4gIGNsYXNzIFRyYW5zYWN0aW9uIGV4dGVuZHMgWS5UcmFuc2FjdGlvbiB7XG4gICAgY29uc3RydWN0b3IgKHN0b3JlKSB7XG4gICAgICBzdXBlcihzdG9yZSlcbiAgICAgIHRoaXMuc3RvcmUgPSBzdG9yZVxuICAgICAgdGhpcy5zcyA9IHN0b3JlLnNzXG4gICAgICB0aGlzLm9zID0gc3RvcmUub3NcbiAgICAgIHRoaXMuZHMgPSBzdG9yZS5kc1xuICAgIH1cbiAgfVxuICB2YXIgU3RvcmUgPSBZLnV0aWxzLlJCVHJlZVxuICB2YXIgQnVmZmVyZWRTdG9yZSA9IFkudXRpbHMuY3JlYXRlU21hbGxMb29rdXBCdWZmZXIoU3RvcmUpXG5cbiAgY2xhc3MgRGF0YWJhc2UgZXh0ZW5kcyBZLkFic3RyYWN0RGF0YWJhc2Uge1xuICAgIGNvbnN0cnVjdG9yICh5LCBvcHRzKSB7XG4gICAgICBzdXBlcih5LCBvcHRzKVxuICAgICAgdGhpcy5vcyA9IG5ldyBCdWZmZXJlZFN0b3JlKClcbiAgICAgIHRoaXMuZHMgPSBuZXcgU3RvcmUoKVxuICAgICAgdGhpcy5zcyA9IG5ldyBCdWZmZXJlZFN0b3JlKClcbiAgICB9XG4gICAgbG9nVGFibGUgKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICBzZWxmLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1VzZXI6ICcsIHRoaXMuc3RvcmUueS5jb25uZWN0b3IudXNlcklkLCBcIj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVwiKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU3RhdGUgU2V0IChTUyk6XCIsIHlpZWxkKiB0aGlzLmdldFN0YXRlU2V0KCkpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgY29uc29sZS5sb2coXCJPcGVyYXRpb24gU3RvcmUgKE9TKTpcIikgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICB5aWVsZCogdGhpcy5vcy5sb2dUYWJsZSgpIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgY29uc29sZS5sb2coXCJEZWxldGlvbiBTdG9yZSAoRFMpOlwiKSAvL2VzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgeWllbGQqIHRoaXMuZHMubG9nVGFibGUoKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGlmICh0aGlzLnN0b3JlLmdjMS5sZW5ndGggPiAwIHx8IHRoaXMuc3RvcmUuZ2MyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ0dDMXwyIG5vdCBlbXB0eSEnLCB0aGlzLnN0b3JlLmdjMSwgdGhpcy5zdG9yZS5nYzIpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKEpTT04uc3RyaW5naWZ5KHRoaXMuc3RvcmUubGlzdGVuZXJzQnlJZCkgIT09ICd7fScpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ2xpc3RlbmVyc0J5SWQgbm90IGVtcHR5IScpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKEpTT04uc3RyaW5naWZ5KHRoaXMuc3RvcmUubGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3cpICE9PSAnW10nKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdsaXN0ZW5lcnNCeUlkRXhlY3V0ZU5vdyBub3QgZW1wdHkhJylcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdG9yZS50cmFuc2FjdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1RyYW5zYWN0aW9uIHN0aWxsIGluIHByb2dyZXNzIScpXG4gICAgICAgIH1cbiAgICAgIH0sIHRydWUpXG4gICAgfVxuICAgIHRyYW5zYWN0IChtYWtlR2VuKSB7XG4gICAgICB2YXIgdCA9IG5ldyBUcmFuc2FjdGlvbih0aGlzKVxuICAgICAgd2hpbGUgKG1ha2VHZW4gIT09IG51bGwpIHtcbiAgICAgICAgdmFyIGdlbiA9IG1ha2VHZW4uY2FsbCh0KVxuICAgICAgICB2YXIgcmVzID0gZ2VuLm5leHQoKVxuICAgICAgICB3aGlsZSAoIXJlcy5kb25lKSB7XG4gICAgICAgICAgcmVzID0gZ2VuLm5leHQocmVzLnZhbHVlKVxuICAgICAgICB9XG4gICAgICAgIG1ha2VHZW4gPSB0aGlzLmdldE5leHRSZXF1ZXN0KClcbiAgICAgIH1cbiAgICB9XG4gICAgKiBkZXN0cm95ICgpIHtcbiAgICAgIHlpZWxkKiBzdXBlci5kZXN0cm95KClcbiAgICAgIGRlbGV0ZSB0aGlzLm9zXG4gICAgICBkZWxldGUgdGhpcy5zc1xuICAgICAgZGVsZXRlIHRoaXMuZHNcbiAgICB9XG4gIH1cbiAgWS5leHRlbmQoJ21lbW9yeScsIERhdGFiYXNlKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuaWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuICBleHRlbmQoWSlcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG4vKlxuICBUaGlzIGZpbGUgY29udGFpbnMgYSBub3Qgc28gZmFuY3kgaW1wbGVtYW50aW9uIG9mIGEgUmVkIEJsYWNrIFRyZWUuXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoWSkge1xuICBjbGFzcyBOIHtcbiAgICAvLyBBIGNyZWF0ZWQgbm9kZSBpcyBhbHdheXMgcmVkIVxuICAgIGNvbnN0cnVjdG9yICh2YWwpIHtcbiAgICAgIHRoaXMudmFsID0gdmFsXG4gICAgICB0aGlzLmNvbG9yID0gdHJ1ZVxuICAgICAgdGhpcy5fbGVmdCA9IG51bGxcbiAgICAgIHRoaXMuX3JpZ2h0ID0gbnVsbFxuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbFxuICAgICAgaWYgKHZhbC5pZCA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBpZCEnKVxuICAgICAgfVxuICAgIH1cbiAgICBpc1JlZCAoKSB7IHJldHVybiB0aGlzLmNvbG9yIH1cbiAgICBpc0JsYWNrICgpIHsgcmV0dXJuICF0aGlzLmNvbG9yIH1cbiAgICByZWRkZW4gKCkgeyB0aGlzLmNvbG9yID0gdHJ1ZTsgcmV0dXJuIHRoaXMgfVxuICAgIGJsYWNrZW4gKCkgeyB0aGlzLmNvbG9yID0gZmFsc2U7IHJldHVybiB0aGlzIH1cbiAgICBnZXQgZ3JhbmRwYXJlbnQgKCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50LnBhcmVudFxuICAgIH1cbiAgICBnZXQgcGFyZW50ICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9wYXJlbnRcbiAgICB9XG4gICAgZ2V0IHNpYmxpbmcgKCkge1xuICAgICAgcmV0dXJuICh0aGlzID09PSB0aGlzLnBhcmVudC5sZWZ0KVxuICAgICAgICA/IHRoaXMucGFyZW50LnJpZ2h0IDogdGhpcy5wYXJlbnQubGVmdFxuICAgIH1cbiAgICBnZXQgbGVmdCAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbGVmdFxuICAgIH1cbiAgICBnZXQgcmlnaHQgKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3JpZ2h0XG4gICAgfVxuICAgIHNldCBsZWZ0IChuKSB7XG4gICAgICBpZiAobiAhPT0gbnVsbCkge1xuICAgICAgICBuLl9wYXJlbnQgPSB0aGlzXG4gICAgICB9XG4gICAgICB0aGlzLl9sZWZ0ID0gblxuICAgIH1cbiAgICBzZXQgcmlnaHQgKG4pIHtcbiAgICAgIGlmIChuICE9PSBudWxsKSB7XG4gICAgICAgIG4uX3BhcmVudCA9IHRoaXNcbiAgICAgIH1cbiAgICAgIHRoaXMuX3JpZ2h0ID0gblxuICAgIH1cbiAgICByb3RhdGVMZWZ0ICh0cmVlKSB7XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnRcbiAgICAgIHZhciBuZXdQYXJlbnQgPSB0aGlzLnJpZ2h0XG4gICAgICB2YXIgbmV3UmlnaHQgPSB0aGlzLnJpZ2h0LmxlZnRcbiAgICAgIG5ld1BhcmVudC5sZWZ0ID0gdGhpc1xuICAgICAgdGhpcy5yaWdodCA9IG5ld1JpZ2h0XG4gICAgICBpZiAocGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgIHRyZWUucm9vdCA9IG5ld1BhcmVudFxuICAgICAgICBuZXdQYXJlbnQuX3BhcmVudCA9IG51bGxcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50LmxlZnQgPT09IHRoaXMpIHtcbiAgICAgICAgcGFyZW50LmxlZnQgPSBuZXdQYXJlbnRcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50LnJpZ2h0ID09PSB0aGlzKSB7XG4gICAgICAgIHBhcmVudC5yaWdodCA9IG5ld1BhcmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgZWxlbWVudHMgYXJlIHdyb25nbHkgY29ubmVjdGVkIScpXG4gICAgICB9XG4gICAgfVxuICAgIG5leHQgKCkge1xuICAgICAgaWYgKHRoaXMucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gc2VhcmNoIHRoZSBtb3N0IGxlZnQgbm9kZSBpbiB0aGUgcmlnaHQgdHJlZVxuICAgICAgICB2YXIgbyA9IHRoaXMucmlnaHRcbiAgICAgICAgd2hpbGUgKG8ubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzXG4gICAgICAgIHdoaWxlIChwLnBhcmVudCAhPT0gbnVsbCAmJiBwICE9PSBwLnBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgcCA9IHAucGFyZW50XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHAucGFyZW50XG4gICAgICB9XG4gICAgfVxuICAgIHByZXYgKCkge1xuICAgICAgaWYgKHRoaXMubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBzZWFyY2ggdGhlIG1vc3QgcmlnaHQgbm9kZSBpbiB0aGUgbGVmdCB0cmVlXG4gICAgICAgIHZhciBvID0gdGhpcy5sZWZ0XG4gICAgICAgIHdoaWxlIChvLnJpZ2h0ICE9PSBudWxsKSB7XG4gICAgICAgICAgbyA9IG8ucmlnaHRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzXG4gICAgICAgIHdoaWxlIChwLnBhcmVudCAhPT0gbnVsbCAmJiBwICE9PSBwLnBhcmVudC5yaWdodCkge1xuICAgICAgICAgIHAgPSBwLnBhcmVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwLnBhcmVudFxuICAgICAgfVxuICAgIH1cbiAgICByb3RhdGVSaWdodCAodHJlZSkge1xuICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50XG4gICAgICB2YXIgbmV3UGFyZW50ID0gdGhpcy5sZWZ0XG4gICAgICB2YXIgbmV3TGVmdCA9IHRoaXMubGVmdC5yaWdodFxuICAgICAgbmV3UGFyZW50LnJpZ2h0ID0gdGhpc1xuICAgICAgdGhpcy5sZWZ0ID0gbmV3TGVmdFxuICAgICAgaWYgKHBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICB0cmVlLnJvb3QgPSBuZXdQYXJlbnRcbiAgICAgICAgbmV3UGFyZW50Ll9wYXJlbnQgPSBudWxsXG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5sZWZ0ID09PSB0aGlzKSB7XG4gICAgICAgIHBhcmVudC5sZWZ0ID0gbmV3UGFyZW50XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudC5yaWdodCA9PT0gdGhpcykge1xuICAgICAgICBwYXJlbnQucmlnaHQgPSBuZXdQYXJlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGVsZW1lbnRzIGFyZSB3cm9uZ2x5IGNvbm5lY3RlZCEnKVxuICAgICAgfVxuICAgIH1cbiAgICBnZXRVbmNsZSAoKSB7XG4gICAgICAvLyB3ZSBjYW4gYXNzdW1lIHRoYXQgZ3JhbmRwYXJlbnQgZXhpc3RzIHdoZW4gdGhpcyBpcyBjYWxsZWQhXG4gICAgICBpZiAodGhpcy5wYXJlbnQgPT09IHRoaXMucGFyZW50LnBhcmVudC5sZWZ0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5wYXJlbnQucmlnaHRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5wYXJlbnQubGVmdFxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGNsYXNzIFJCVHJlZSB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5yb290ID0gbnVsbFxuICAgICAgdGhpcy5sZW5ndGggPSAwXG4gICAgfVxuICAgICogZmluZE5leHQgKGlkKSB7XG4gICAgICByZXR1cm4geWllbGQqIHRoaXMuZmluZFdpdGhMb3dlckJvdW5kKFtpZFswXSwgaWRbMV0gKyAxXSlcbiAgICB9XG4gICAgKiBmaW5kUHJldiAoaWQpIHtcbiAgICAgIHJldHVybiB5aWVsZCogdGhpcy5maW5kV2l0aFVwcGVyQm91bmQoW2lkWzBdLCBpZFsxXSAtIDFdKVxuICAgIH1cbiAgICBmaW5kTm9kZVdpdGhMb3dlckJvdW5kIChmcm9tKSB7XG4gICAgICBpZiAoZnJvbSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgZGVmaW5lIGZyb20hJylcbiAgICAgIH1cbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICBpZiAobyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBpZiAoKGZyb20gPT09IG51bGwgfHwgWS51dGlscy5zbWFsbGVyKGZyb20sIG8udmFsLmlkKSkgJiYgby5sZWZ0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBvIGlzIGluY2x1ZGVkIGluIHRoZSBib3VuZFxuICAgICAgICAgICAgLy8gdHJ5IHRvIGZpbmQgYW4gZWxlbWVudCB0aGF0IGlzIGNsb3NlciB0byB0aGUgYm91bmRcbiAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICB9IGVsc2UgaWYgKGZyb20gIT09IG51bGwgJiYgWS51dGlscy5zbWFsbGVyKG8udmFsLmlkLCBmcm9tKSkge1xuICAgICAgICAgICAgLy8gbyBpcyBub3Qgd2l0aGluIHRoZSBib3VuZCwgbWF5YmUgb25lIG9mIHRoZSByaWdodCBlbGVtZW50cyBpcy4uXG4gICAgICAgICAgICBpZiAoby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gcmlnaHQgZWxlbWVudC4gU2VhcmNoIGZvciB0aGUgbmV4dCBiaWdnZXIgZWxlbWVudCxcbiAgICAgICAgICAgICAgLy8gdGhpcyBzaG91bGQgYmUgd2l0aGluIHRoZSBib3VuZHNcbiAgICAgICAgICAgICAgcmV0dXJuIG8ubmV4dCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBvXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZpbmROb2RlV2l0aFVwcGVyQm91bmQgKHRvKSB7XG4gICAgICBpZiAodG8gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGRlZmluZSBmcm9tIScpXG4gICAgICB9XG4gICAgICB2YXIgbyA9IHRoaXMucm9vdFxuICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKCh0byA9PT0gbnVsbCB8fCBZLnV0aWxzLnNtYWxsZXIoby52YWwuaWQsIHRvKSkgJiYgby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gbyBpcyBpbmNsdWRlZCBpbiB0aGUgYm91bmRcbiAgICAgICAgICAgIC8vIHRyeSB0byBmaW5kIGFuIGVsZW1lbnQgdGhhdCBpcyBjbG9zZXIgdG8gdGhlIGJvdW5kXG4gICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgIH0gZWxzZSBpZiAodG8gIT09IG51bGwgJiYgWS51dGlscy5zbWFsbGVyKHRvLCBvLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIC8vIG8gaXMgbm90IHdpdGhpbiB0aGUgYm91bmQsIG1heWJlIG9uZSBvZiB0aGUgbGVmdCBlbGVtZW50cyBpcy4uXG4gICAgICAgICAgICBpZiAoby5sZWZ0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIGxlZnQgZWxlbWVudC4gU2VhcmNoIGZvciB0aGUgcHJldiBzbWFsbGVyIGVsZW1lbnQsXG4gICAgICAgICAgICAgIC8vIHRoaXMgc2hvdWxkIGJlIHdpdGhpbiB0aGUgYm91bmRzXG4gICAgICAgICAgICAgIHJldHVybiBvLnByZXYoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmaW5kU21hbGxlc3ROb2RlICgpIHtcbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICB3aGlsZSAobyAhPSBudWxsICYmIG8ubGVmdCAhPSBudWxsKSB7XG4gICAgICAgIG8gPSBvLmxlZnRcbiAgICAgIH1cbiAgICAgIHJldHVybiBvXG4gICAgfVxuICAgICogZmluZFdpdGhMb3dlckJvdW5kIChmcm9tKSB7XG4gICAgICB2YXIgbiA9IHRoaXMuZmluZE5vZGVXaXRoTG93ZXJCb3VuZChmcm9tKVxuICAgICAgcmV0dXJuIG4gPT0gbnVsbCA/IG51bGwgOiBuLnZhbFxuICAgIH1cbiAgICAqIGZpbmRXaXRoVXBwZXJCb3VuZCAodG8pIHtcbiAgICAgIHZhciBuID0gdGhpcy5maW5kTm9kZVdpdGhVcHBlckJvdW5kKHRvKVxuICAgICAgcmV0dXJuIG4gPT0gbnVsbCA/IG51bGwgOiBuLnZhbFxuICAgIH1cbiAgICAqIGl0ZXJhdGUgKHQsIGZyb20sIHRvLCBmKSB7XG4gICAgICB2YXIgb1xuICAgICAgaWYgKGZyb20gPT09IG51bGwpIHtcbiAgICAgICAgbyA9IHRoaXMuZmluZFNtYWxsZXN0Tm9kZSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvID0gdGhpcy5maW5kTm9kZVdpdGhMb3dlckJvdW5kKGZyb20pXG4gICAgICB9XG4gICAgICB3aGlsZSAobyAhPT0gbnVsbCAmJiAodG8gPT09IG51bGwgfHwgWS51dGlscy5zbWFsbGVyKG8udmFsLmlkLCB0bykgfHwgWS51dGlscy5jb21wYXJlSWRzKG8udmFsLmlkLCB0bykpKSB7XG4gICAgICAgIHlpZWxkKiBmLmNhbGwodCwgby52YWwpXG4gICAgICAgIG8gPSBvLm5leHQoKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgKiBsb2dUYWJsZSAoZnJvbSwgdG8sIGZpbHRlcikge1xuICAgICAgaWYgKGZpbHRlciA9PSBudWxsKSB7XG4gICAgICAgIGZpbHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZnJvbSA9PSBudWxsKSB7IGZyb20gPSBudWxsIH1cbiAgICAgIGlmICh0byA9PSBudWxsKSB7IHRvID0gbnVsbCB9XG4gICAgICB2YXIgb3MgPSBbXVxuICAgICAgeWllbGQqIHRoaXMuaXRlcmF0ZSh0aGlzLCBmcm9tLCB0bywgZnVuY3Rpb24gKiAobykge1xuICAgICAgICBpZiAoZmlsdGVyKG8pKSB7XG4gICAgICAgICAgdmFyIG9fID0ge31cbiAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIG9fW2tleV0gPSBKU09OLnN0cmluZ2lmeShvW2tleV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvX1trZXldID0gb1trZXldXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIG9zLnB1c2gob18pXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICBpZiAoY29uc29sZS50YWJsZSAhPSBudWxsKSB7XG4gICAgICAgIGNvbnNvbGUudGFibGUob3MpXG4gICAgICB9XG4gICAgfVxuICAgICogZmluZCAoaWQpIHtcbiAgICAgIHZhciBuXG4gICAgICByZXR1cm4gKG4gPSB0aGlzLmZpbmROb2RlKGlkKSkgPyBuLnZhbCA6IG51bGxcbiAgICB9XG4gICAgZmluZE5vZGUgKGlkKSB7XG4gICAgICBpZiAoaWQgPT0gbnVsbCB8fCBpZC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3QgaWQgdG8gYmUgYW4gYXJyYXkhJylcbiAgICAgIH1cbiAgICAgIHZhciBvID0gdGhpcy5yb290XG4gICAgICBpZiAobyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKG8gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoWS51dGlscy5zbWFsbGVyKGlkLCBvLnZhbC5pZCkpIHtcbiAgICAgICAgICAgIG8gPSBvLmxlZnRcbiAgICAgICAgICB9IGVsc2UgaWYgKFkudXRpbHMuc21hbGxlcihvLnZhbC5pZCwgaWQpKSB7XG4gICAgICAgICAgICBvID0gby5yaWdodFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gb1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGRlbGV0ZSAoaWQpIHtcbiAgICAgIGlmIChpZCA9PSBudWxsIHx8IGlkLmNvbnN0cnVjdG9yICE9PSBBcnJheSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lkIGlzIGV4cGVjdGVkIHRvIGJlIGFuIEFycmF5IScpXG4gICAgICB9XG4gICAgICB2YXIgZCA9IHRoaXMuZmluZE5vZGUoaWQpXG4gICAgICBpZiAoZCA9PSBudWxsKSB7XG4gICAgICAgIC8vIHRocm93IG5ldyBFcnJvcignRWxlbWVudCBkb2VzIG5vdCBleGlzdCEnKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHRoaXMubGVuZ3RoLS1cbiAgICAgIGlmIChkLmxlZnQgIT09IG51bGwgJiYgZC5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBzd2l0Y2ggZCB3aXRoIHRoZSBncmVhdGVzIGVsZW1lbnQgaW4gdGhlIGxlZnQgc3VidHJlZS5cbiAgICAgICAgLy8gbyBzaG91bGQgaGF2ZSBhdCBtb3N0IG9uZSBjaGlsZC5cbiAgICAgICAgdmFyIG8gPSBkLmxlZnRcbiAgICAgICAgLy8gZmluZFxuICAgICAgICB3aGlsZSAoby5yaWdodCAhPT0gbnVsbCkge1xuICAgICAgICAgIG8gPSBvLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3dpdGNoXG4gICAgICAgIGQudmFsID0gby52YWxcbiAgICAgICAgZCA9IG9cbiAgICAgIH1cbiAgICAgIC8vIGQgaGFzIGF0IG1vc3Qgb25lIGNoaWxkXG4gICAgICAvLyBsZXQgbiBiZSB0aGUgbm9kZSB0aGF0IHJlcGxhY2VzIGRcbiAgICAgIHZhciBpc0Zha2VDaGlsZFxuICAgICAgdmFyIGNoaWxkID0gZC5sZWZ0IHx8IGQucmlnaHRcbiAgICAgIGlmIChjaGlsZCA9PT0gbnVsbCkge1xuICAgICAgICBpc0Zha2VDaGlsZCA9IHRydWVcbiAgICAgICAgY2hpbGQgPSBuZXcgTih7aWQ6IDB9KVxuICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgZC5yaWdodCA9IGNoaWxkXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpc0Zha2VDaGlsZCA9IGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGlmIChkLnBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICBpZiAoIWlzRmFrZUNoaWxkKSB7XG4gICAgICAgICAgdGhpcy5yb290ID0gY2hpbGRcbiAgICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgICBjaGlsZC5fcGFyZW50ID0gbnVsbFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucm9vdCA9IG51bGxcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH0gZWxzZSBpZiAoZC5wYXJlbnQubGVmdCA9PT0gZCkge1xuICAgICAgICBkLnBhcmVudC5sZWZ0ID0gY2hpbGRcbiAgICAgIH0gZWxzZSBpZiAoZC5wYXJlbnQucmlnaHQgPT09IGQpIHtcbiAgICAgICAgZC5wYXJlbnQucmlnaHQgPSBjaGlsZFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbXBvc3NpYmxlIScpXG4gICAgICB9XG4gICAgICBpZiAoZC5pc0JsYWNrKCkpIHtcbiAgICAgICAgaWYgKGNoaWxkLmlzUmVkKCkpIHtcbiAgICAgICAgICBjaGlsZC5ibGFja2VuKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9maXhEZWxldGUoY2hpbGQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMucm9vdC5ibGFja2VuKClcbiAgICAgIGlmIChpc0Zha2VDaGlsZCkge1xuICAgICAgICBpZiAoY2hpbGQucGFyZW50LmxlZnQgPT09IGNoaWxkKSB7XG4gICAgICAgICAgY2hpbGQucGFyZW50LmxlZnQgPSBudWxsXG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQucGFyZW50LnJpZ2h0ID09PSBjaGlsZCkge1xuICAgICAgICAgIGNoaWxkLnBhcmVudC5yaWdodCA9IG51bGxcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ltcG9zc2libGUgIzMnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIF9maXhEZWxldGUgKG4pIHtcbiAgICAgIGZ1bmN0aW9uIGlzQmxhY2sgKG5vZGUpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUgIT09IG51bGwgPyBub2RlLmlzQmxhY2soKSA6IHRydWVcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGlzUmVkIChub2RlKSB7XG4gICAgICAgIHJldHVybiBub2RlICE9PSBudWxsID8gbm9kZS5pc1JlZCgpIDogZmFsc2VcbiAgICAgIH1cbiAgICAgIGlmIChuLnBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAvLyB0aGlzIGNhbiBvbmx5IGJlIGNhbGxlZCBhZnRlciB0aGUgZmlyc3QgaXRlcmF0aW9uIG9mIGZpeERlbGV0ZS5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBkIHdhcyBhbHJlYWR5IHJlcGxhY2VkIGJ5IHRoZSBjaGlsZFxuICAgICAgLy8gZCBpcyBub3QgdGhlIHJvb3RcbiAgICAgIC8vIGQgYW5kIGNoaWxkIGFyZSBibGFja1xuICAgICAgdmFyIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgIGlmIChpc1JlZChzaWJsaW5nKSkge1xuICAgICAgICAvLyBtYWtlIHNpYmxpbmcgdGhlIGdyYW5kZmF0aGVyXG4gICAgICAgIG4ucGFyZW50LnJlZGRlbigpXG4gICAgICAgIHNpYmxpbmcuYmxhY2tlbigpXG4gICAgICAgIGlmIChuID09PSBuLnBhcmVudC5sZWZ0KSB7XG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlTGVmdCh0aGlzKVxuICAgICAgICB9IGVsc2UgaWYgKG4gPT09IG4ucGFyZW50LnJpZ2h0KSB7XG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ltcG9zc2libGUgIzInKVxuICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgIH1cbiAgICAgIC8vIHBhcmVudCwgc2libGluZywgYW5kIGNoaWxkcmVuIG9mIG4gYXJlIGJsYWNrXG4gICAgICBpZiAobi5wYXJlbnQuaXNCbGFjaygpICYmXG4gICAgICAgIHNpYmxpbmcuaXNCbGFjaygpICYmXG4gICAgICAgIGlzQmxhY2soc2libGluZy5sZWZ0KSAmJlxuICAgICAgICBpc0JsYWNrKHNpYmxpbmcucmlnaHQpXG4gICAgICApIHtcbiAgICAgICAgc2libGluZy5yZWRkZW4oKVxuICAgICAgICB0aGlzLl9maXhEZWxldGUobi5wYXJlbnQpXG4gICAgICB9IGVsc2UgaWYgKG4ucGFyZW50LmlzUmVkKCkgJiZcbiAgICAgICAgc2libGluZy5pc0JsYWNrKCkgJiZcbiAgICAgICAgaXNCbGFjayhzaWJsaW5nLmxlZnQpICYmXG4gICAgICAgIGlzQmxhY2soc2libGluZy5yaWdodClcbiAgICAgICkge1xuICAgICAgICBzaWJsaW5nLnJlZGRlbigpXG4gICAgICAgIG4ucGFyZW50LmJsYWNrZW4oKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQgJiZcbiAgICAgICAgICBzaWJsaW5nLmlzQmxhY2soKSAmJlxuICAgICAgICAgIGlzUmVkKHNpYmxpbmcubGVmdCkgJiZcbiAgICAgICAgICBpc0JsYWNrKHNpYmxpbmcucmlnaHQpXG4gICAgICAgICkge1xuICAgICAgICAgIHNpYmxpbmcucmVkZGVuKClcbiAgICAgICAgICBzaWJsaW5nLmxlZnQuYmxhY2tlbigpXG4gICAgICAgICAgc2libGluZy5yb3RhdGVSaWdodCh0aGlzKVxuICAgICAgICAgIHNpYmxpbmcgPSBuLnNpYmxpbmdcbiAgICAgICAgfSBlbHNlIGlmIChuID09PSBuLnBhcmVudC5yaWdodCAmJlxuICAgICAgICAgIHNpYmxpbmcuaXNCbGFjaygpICYmXG4gICAgICAgICAgaXNSZWQoc2libGluZy5yaWdodCkgJiZcbiAgICAgICAgICBpc0JsYWNrKHNpYmxpbmcubGVmdClcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2libGluZy5yZWRkZW4oKVxuICAgICAgICAgIHNpYmxpbmcucmlnaHQuYmxhY2tlbigpXG4gICAgICAgICAgc2libGluZy5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgICAgc2libGluZyA9IG4uc2libGluZ1xuICAgICAgICB9XG4gICAgICAgIHNpYmxpbmcuY29sb3IgPSBuLnBhcmVudC5jb2xvclxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LmxlZnQpIHtcbiAgICAgICAgICBzaWJsaW5nLnJpZ2h0LmJsYWNrZW4oKVxuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZUxlZnQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzaWJsaW5nLmxlZnQuYmxhY2tlbigpXG4gICAgICAgICAgbi5wYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIHB1dCAodikge1xuICAgICAgaWYgKHYgPT0gbnVsbCB8fCB2LmlkID09IG51bGwgfHwgdi5pZC5jb25zdHJ1Y3RvciAhPT0gQXJyYXkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd2IGlzIGV4cGVjdGVkIHRvIGhhdmUgYW4gaWQgcHJvcGVydHkgd2hpY2ggaXMgYW4gQXJyYXkhJylcbiAgICAgIH1cbiAgICAgIHZhciBub2RlID0gbmV3IE4odilcbiAgICAgIGlmICh0aGlzLnJvb3QgIT09IG51bGwpIHtcbiAgICAgICAgdmFyIHAgPSB0aGlzLnJvb3QgLy8gcCBhYmJyZXYuIHBhcmVudFxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGlmIChZLnV0aWxzLnNtYWxsZXIobm9kZS52YWwuaWQsIHAudmFsLmlkKSkge1xuICAgICAgICAgICAgaWYgKHAubGVmdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBwLmxlZnQgPSBub2RlXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwID0gcC5sZWZ0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChZLnV0aWxzLnNtYWxsZXIocC52YWwuaWQsIG5vZGUudmFsLmlkKSkge1xuICAgICAgICAgICAgaWYgKHAucmlnaHQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgcC5yaWdodCA9IG5vZGVcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHAgPSBwLnJpZ2h0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHAudmFsID0gbm9kZS52YWxcbiAgICAgICAgICAgIHJldHVybiBwXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2ZpeEluc2VydChub2RlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yb290ID0gbm9kZVxuICAgICAgfVxuICAgICAgdGhpcy5sZW5ndGgrK1xuICAgICAgdGhpcy5yb290LmJsYWNrZW4oKVxuICAgICAgcmV0dXJuIG5vZGVcbiAgICB9XG4gICAgX2ZpeEluc2VydCAobikge1xuICAgICAgaWYgKG4ucGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgIG4uYmxhY2tlbigpXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIGlmIChuLnBhcmVudC5pc0JsYWNrKCkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICB2YXIgdW5jbGUgPSBuLmdldFVuY2xlKClcbiAgICAgIGlmICh1bmNsZSAhPT0gbnVsbCAmJiB1bmNsZS5pc1JlZCgpKSB7XG4gICAgICAgIC8vIE5vdGU6IHBhcmVudDogcmVkLCB1bmNsZTogcmVkXG4gICAgICAgIG4ucGFyZW50LmJsYWNrZW4oKVxuICAgICAgICB1bmNsZS5ibGFja2VuKClcbiAgICAgICAgbi5ncmFuZHBhcmVudC5yZWRkZW4oKVxuICAgICAgICB0aGlzLl9maXhJbnNlcnQobi5ncmFuZHBhcmVudClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vdGU6IHBhcmVudDogcmVkLCB1bmNsZTogYmxhY2sgb3IgbnVsbFxuICAgICAgICAvLyBOb3cgd2UgdHJhbnNmb3JtIHRoZSB0cmVlIGluIHN1Y2ggYSB3YXkgdGhhdFxuICAgICAgICAvLyBlaXRoZXIgb2YgdGhlc2UgaG9sZHM6XG4gICAgICAgIC8vICAgMSkgZ3JhbmRwYXJlbnQubGVmdC5pc1JlZFxuICAgICAgICAvLyAgICAgYW5kIGdyYW5kcGFyZW50LmxlZnQubGVmdC5pc1JlZFxuICAgICAgICAvLyAgIDIpIGdyYW5kcGFyZW50LnJpZ2h0LmlzUmVkXG4gICAgICAgIC8vICAgICBhbmQgZ3JhbmRwYXJlbnQucmlnaHQucmlnaHQuaXNSZWRcbiAgICAgICAgaWYgKG4gPT09IG4ucGFyZW50LnJpZ2h0ICYmIG4ucGFyZW50ID09PSBuLmdyYW5kcGFyZW50LmxlZnQpIHtcbiAgICAgICAgICBuLnBhcmVudC5yb3RhdGVMZWZ0KHRoaXMpXG4gICAgICAgICAgLy8gU2luY2Ugd2Ugcm90YXRlZCBhbmQgd2FudCB0byB1c2UgdGhlIHByZXZpb3VzXG4gICAgICAgICAgLy8gY2FzZXMsIHdlIG5lZWQgdG8gc2V0IG4gaW4gc3VjaCBhIHdheSB0aGF0XG4gICAgICAgICAgLy8gbi5wYXJlbnQuaXNSZWQgYWdhaW5cbiAgICAgICAgICBuID0gbi5sZWZ0XG4gICAgICAgIH0gZWxzZSBpZiAobiA9PT0gbi5wYXJlbnQubGVmdCAmJiBuLnBhcmVudCA9PT0gbi5ncmFuZHBhcmVudC5yaWdodCkge1xuICAgICAgICAgIG4ucGFyZW50LnJvdGF0ZVJpZ2h0KHRoaXMpXG4gICAgICAgICAgLy8gc2VlIGFib3ZlXG4gICAgICAgICAgbiA9IG4ucmlnaHRcbiAgICAgICAgfVxuICAgICAgICAvLyBDYXNlIDEpIG9yIDIpIGhvbGQgZnJvbSBoZXJlIG9uLlxuICAgICAgICAvLyBOb3cgdHJhdmVyc2UgZ3JhbmRwYXJlbnQsIG1ha2UgcGFyZW50IGEgYmxhY2sgbm9kZVxuICAgICAgICAvLyBvbiB0aGUgaGlnaGVzdCBsZXZlbCB3aGljaCBob2xkcyB0d28gcmVkIG5vZGVzLlxuICAgICAgICBuLnBhcmVudC5ibGFja2VuKClcbiAgICAgICAgbi5ncmFuZHBhcmVudC5yZWRkZW4oKVxuICAgICAgICBpZiAobiA9PT0gbi5wYXJlbnQubGVmdCkge1xuICAgICAgICAgIC8vIENhc2UgMVxuICAgICAgICAgIG4uZ3JhbmRwYXJlbnQucm90YXRlUmlnaHQodGhpcylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDYXNlIDJcbiAgICAgICAgICBuLmdyYW5kcGFyZW50LnJvdGF0ZUxlZnQodGhpcylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGZsdXNoICgpIHt9XG4gIH1cblxuICBZLnV0aWxzLlJCVHJlZSA9IFJCVHJlZVxufVxuIiwiLyogZ2xvYmFsIFksIEVsZW1lbnQgKi9cbid1c2Ugc3RyaWN0J1xuXG52YXIgZGlmZiA9IHJlcXVpcmUoJ2Zhc3QtZGlmZicpXG52YXIgbW9uYWNvSWRlbnRpZmllclRlbXBsYXRlID0geyBtYWpvcjogMCwgbWlub3I6IDAgfVxuXG5mdW5jdGlvbiBleHRlbmQgKFkpIHtcbiAgWS5yZXF1ZXN0TW9kdWxlcyhbJ0FycmF5J10pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgIGNsYXNzIFlUZXh0IGV4dGVuZHMgWS5BcnJheS50eXBlRGVmaW5pdGlvblsnY2xhc3MnXSB7XG4gICAgICBjb25zdHJ1Y3RvciAob3MsIF9tb2RlbCwgX2NvbnRlbnQpIHtcbiAgICAgICAgc3VwZXIob3MsIF9tb2RlbCwgX2NvbnRlbnQpXG4gICAgICAgIHRoaXMudGV4dGZpZWxkcyA9IFtdXG4gICAgICAgIHRoaXMuYWNlSW5zdGFuY2VzID0gW11cbiAgICAgICAgdGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzID0gW11cbiAgICAgICAgdGhpcy5tb25hY29JbnN0YW5jZXMgPSBbXVxuICAgICAgfVxuICAgICAgdG9TdHJpbmcgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGVudC5tYXAoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICByZXR1cm4gYy52YWxcbiAgICAgICAgfSkuam9pbignJylcbiAgICAgIH1cbiAgICAgIGluc2VydCAocG9zLCBjb250ZW50KSB7XG4gICAgICAgIHZhciBhcnIgPSBjb250ZW50LnNwbGl0KCcnKVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICgvW1xcdUQ4MDAtXFx1REZGRl0vLnRlc3QoYXJyW2ldKSkge1xuICAgICAgICAgICAgLy8gaXMgc3Vycm9nYXRlIHBhaXJcbiAgICAgICAgICAgIGFycltpXSA9IGFycltpXSArIGFycltpICsgMV1cbiAgICAgICAgICAgIGFycltpICsgMV0gPSAnJ1xuICAgICAgICAgICAgaSsrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN1cGVyLmluc2VydChwb3MsIGFycilcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSAocG9zLCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKGxlbmd0aCA9PSBudWxsKSB7IGxlbmd0aCA9IDEgfVxuICAgICAgICBpZiAodHlwZW9mIGxlbmd0aCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2xlbmd0aCBtdXN0IGJlIGEgbnVtYmVyIScpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBwb3MgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb3MgbXVzdCBiZSBhIG51bWJlciEnKVxuICAgICAgICB9XG4gICAgICAgIGlmIChwb3MgKyBsZW5ndGggPiB0aGlzLl9jb250ZW50Lmxlbmd0aCB8fCBwb3MgPCAwIHx8IGxlbmd0aCA8IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBkZWxldGlvbiByYW5nZSBleGNlZWRzIHRoZSByYW5nZSBvZiB0aGUgYXJyYXkhJylcbiAgICAgICAgfVxuICAgICAgICBpZiAobGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhpcyBpcyBmb3IgdGhlIGNhc2UgdGhhdCBwYXJ0IG9mIGEgc3Vycm9nYXRlIHBhaXIgaXMgZGVsZXRlZFxuICAgICAgICAvLyB3ZSBzdG9yZSBzdXJyb2dhdGUgcGFpcnMgbGlrZSB0aGlzOiBbLi4sICfwn5CHJywgJycsIC4uXSAoc3RyaW5nLCBjb2RlKVxuICAgICAgICBpZiAodGhpcy5fY29udGVudC5sZW5ndGggPiBwb3MgKyBsZW5ndGggJiYgdGhpcy5fY29udGVudFtwb3MgKyBsZW5ndGhdLnZhbCA9PT0gJycgJiYgdGhpcy5fY29udGVudFtwb3MgKyBsZW5ndGggLSAxXS52YWwubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgLy8gY2FzZSBvbmUuIGZpcnN0IHBhcnQgb2YgdGhlIHN1cnJvZ2F0ZSBwYWlyIGlzIGRlbGV0ZWRcbiAgICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLl9jb250ZW50W3BvcyArIGxlbmd0aCAtIDFdLnZhbFswXVxuICAgICAgICAgIHN1cGVyLmRlbGV0ZShwb3MsIGxlbmd0aCArIDEpXG4gICAgICAgICAgc3VwZXIuaW5zZXJ0KHBvcywgW3Rva2VuXSlcbiAgICAgICAgfSBlbHNlIGlmIChwb3MgPiAwICYmIHRoaXMuX2NvbnRlbnRbcG9zXS52YWwgPT09ICcnICYmIHRoaXMuX2NvbnRlbnRbcG9zIC0gMV0udmFsLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgIC8vIGNhc2UgdHdvLiBzZWNvbmQgcGFydCBvZiB0aGUgc3Vycm9nYXRlIHBhaXIgaXMgZGVsZXRlZFxuICAgICAgICAgIGxldCB0b2tlbiA9IHRoaXMuX2NvbnRlbnRbcG9zIC0gMV0udmFsWzFdXG4gICAgICAgICAgc3VwZXIuZGVsZXRlKHBvcyAtIDEsIGxlbmd0aCArIDEpXG4gICAgICAgICAgc3VwZXIuaW5zZXJ0KHBvcyAtIDEsIFt0b2tlbl0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3VwZXIuZGVsZXRlKHBvcywgbGVuZ3RoKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmJpbmRBbGwgKCkge1xuICAgICAgICB0aGlzLnVuYmluZFRleHRhcmVhQWxsKClcbiAgICAgICAgdGhpcy51bmJpbmRBY2VBbGwoKVxuICAgICAgICB0aGlzLnVuYmluZENvZGVNaXJyb3JBbGwoKVxuICAgICAgICB0aGlzLnVuYmluZE1vbmFjb0FsbCgpXG4gICAgICB9XG4gICAgICAvLyBNb25hY28gaW1wbGVtZW50YXRpb25cbiAgICAgIHVuYmluZE1vbmFjbyAobW9uYWNvSW5zdGFuY2UpIHtcbiAgICAgICAgdmFyIGkgPSB0aGlzLm1vbmFjb0luc3RhbmNlcy5maW5kSW5kZXgoZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICAgICAgICByZXR1cm4gYmluZGluZy5lZGl0b3IgPT09IG1vbmFjb0luc3RhbmNlXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChpID49IDApIHtcbiAgICAgICAgICB2YXIgYmluZGluZyA9IHRoaXMubW9uYWNvSW5zdGFuY2VzW2ldXG4gICAgICAgICAgdGhpcy51bm9ic2VydmUoYmluZGluZy55Q2FsbGJhY2spXG4gICAgICAgICAgYmluZGluZy5kaXNwb3NlQmluZGluZygpXG4gICAgICAgICAgdGhpcy5tb25hY29JbnN0YW5jZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHVuYmluZE1vbmFjb0FsbCAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLm1vbmFjb0luc3RhbmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIHRoaXMudW5iaW5kTW9uYWNvKHRoaXMubW9uYWNvSW5zdGFuY2VzW2ldLmVkaXRvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYmluZE1vbmFjbyAobW9uYWNvSW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cbiAgICAgICAgLy8gdGhpcyBmdW5jdGlvbiBtYWtlcyBzdXJlIHRoYXQgZWl0aGVyIHRoZVxuICAgICAgICAvLyBtb25hY28gZXZlbnQgaXMgZXhlY3V0ZWQsIG9yIHRoZSB5anMgb2JzZXJ2ZXIgaXMgZXhlY3V0ZWRcbiAgICAgICAgdmFyIHRva2VuID0gdHJ1ZVxuICAgICAgICBmdW5jdGlvbiBtdXR1YWxFeGNsdXNlIChmKSB7XG4gICAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1vbmFjb0luc3RhbmNlLnNldFZhbHVlKHRoaXMudG9TdHJpbmcoKSlcblxuICAgICAgICBmdW5jdGlvbiBtb25hY29DYWxsYmFjayAoZXZlbnQpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIGNvbXB1dGUgc3RhcnQuLiAoY29sK3JvdyAtPiBpbmRleCBwb3NpdGlvbilcbiAgICAgICAgICAgIC8vIFdlIHNob3VsZG4ndCBjb21wdXRlIHRoZSBvZmZzZXQgb24gdGhlIG9sZCBtb2RlbC4uXG4gICAgICAgICAgICAvLyAgICB2YXIgc3RhcnQgPSBtb25hY29JbnN0YW5jZS5tb2RlbC5nZXRPZmZzZXRBdCh7Y29sdW1uOiBldmVudC5yYW5nZS5zdGFydENvbHVtbiwgbGluZU51bWJlcjogZXZlbnQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfSlcbiAgICAgICAgICAgIC8vIFNvIHdlIGNvbXB1dGUgdGhlIG9mZnNldCB1c2luZyB0aGUgX2NvbnRlbnQgb2YgdGhpcyB0eXBlXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGluZSA9IDE7IGxpbmUgPCBldmVudC5yYW5nZS5zdGFydExpbmVOdW1iZXI7IGkrKykge1xuICAgICAgICAgICAgICBpZiAoc2VsZi5fY29udGVudFtpXS52YWwgPT09ICdcXG4nKSB7XG4gICAgICAgICAgICAgICAgbGluZSsrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBzdGFydCA9IGkgKyBldmVudC5yYW5nZS5zdGFydENvbHVtbiAtIDFcblxuICAgICAgICAgICAgLy8gYXBwbHkgdGhlIGRlbGV0ZSBvcGVyYXRpb24gZmlyc3RcbiAgICAgICAgICAgIGlmIChldmVudC5yYW5nZUxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2VsZi5kZWxldGUoc3RhcnQsIGV2ZW50LnJhbmdlTGVuZ3RoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYXBwbHkgaW5zZXJ0IG9wZXJhdGlvblxuICAgICAgICAgICAgc2VsZi5pbnNlcnQoc3RhcnQsIGV2ZW50LnRleHQpXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGlzcG9zZUJpbmRpbmcgPSBtb25hY29JbnN0YW5jZS5vbkRpZENoYW5nZU1vZGVsQ29udGVudChtb25hY29DYWxsYmFjaykuZGlzcG9zZVxuXG4gICAgICAgIGZ1bmN0aW9uIHlDYWxsYmFjayAoZXZlbnQpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGxldCBzdGFydCA9IG1vbmFjb0luc3RhbmNlLm1vZGVsLmdldFBvc2l0aW9uQXQoZXZlbnQuaW5kZXgpXG4gICAgICAgICAgICB2YXIgZW5kLCB0ZXh0XG4gICAgICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2luc2VydCcpIHtcbiAgICAgICAgICAgICAgZW5kID0gc3RhcnRcbiAgICAgICAgICAgICAgdGV4dCA9IGV2ZW50LnZhbHVlcy5qb2luKCcnKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICBlbmQgPSBtb25hY29JbnN0YW5jZS5tb2RlbC5tb2RpZnlQb3NpdGlvbihzdGFydCwgZXZlbnQubGVuZ3RoKVxuICAgICAgICAgICAgICB0ZXh0ID0gJydcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciByYW5nZSA9IHtcbiAgICAgICAgICAgICAgc3RhcnRMaW5lTnVtYmVyOiBzdGFydC5saW5lTnVtYmVyLFxuICAgICAgICAgICAgICBzdGFydENvbHVtbjogc3RhcnQuY29sdW1uLFxuICAgICAgICAgICAgICBlbmRMaW5lTnVtYmVyOiBlbmQubGluZU51bWJlcixcbiAgICAgICAgICAgICAgZW5kQ29sdW1uOiBlbmQuY29sdW1uXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgaWQgPSB7XG4gICAgICAgICAgICAgIG1ham9yOiBtb25hY29JZGVudGlmaWVyVGVtcGxhdGUubWFqb3IsXG4gICAgICAgICAgICAgIG1pbm9yOiBtb25hY29JZGVudGlmaWVyVGVtcGxhdGUubWlub3IrK1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbW9uYWNvSW5zdGFuY2UuZXhlY3V0ZUVkaXRzKCdZanMnLCBbe1xuICAgICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICAgIHJhbmdlOiByYW5nZSxcbiAgICAgICAgICAgICAgdGV4dDogdGV4dCxcbiAgICAgICAgICAgICAgZm9yY2VNb3ZlTWFya2VyczogdHJ1ZVxuICAgICAgICAgICAgfV0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9ic2VydmUoeUNhbGxiYWNrKVxuICAgICAgICB0aGlzLm1vbmFjb0luc3RhbmNlcy5wdXNoKHtcbiAgICAgICAgICBlZGl0b3I6IG1vbmFjb0luc3RhbmNlLFxuICAgICAgICAgIHlDYWxsYmFjazogeUNhbGxiYWNrLFxuICAgICAgICAgIG1vbmFjb0NhbGxiYWNrOiBtb25hY29DYWxsYmFjayxcbiAgICAgICAgICBkaXNwb3NlQmluZGluZzogZGlzcG9zZUJpbmRpbmdcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIC8vIENvZGVNaXJyb3IgaW1wbGVtZW50YXRpb24uLlxuICAgICAgdW5iaW5kQ29kZU1pcnJvciAoY29kZU1pcnJvckluc3RhbmNlKSB7XG4gICAgICAgIHZhciBpID0gdGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzLmZpbmRJbmRleChmdW5jdGlvbiAoYmluZGluZykge1xuICAgICAgICAgIHJldHVybiBiaW5kaW5nLmVkaXRvciA9PT0gY29kZU1pcnJvckluc3RhbmNlXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChpID49IDApIHtcbiAgICAgICAgICB2YXIgYmluZGluZyA9IHRoaXMuY29kZU1pcnJvckluc3RhbmNlc1tpXVxuICAgICAgICAgIHRoaXMudW5vYnNlcnZlKGJpbmRpbmcueUNhbGxiYWNrKVxuICAgICAgICAgIGJpbmRpbmcuZWRpdG9yLm9mZignY2hhbmdlcycsIGJpbmRpbmcuY29kZU1pcnJvckNhbGxiYWNrKVxuICAgICAgICAgIHRoaXMuY29kZU1pcnJvckluc3RhbmNlcy5zcGxpY2UoaSwgMSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdW5iaW5kQ29kZU1pcnJvckFsbCAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmNvZGVNaXJyb3JJbnN0YW5jZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICB0aGlzLnVuYmluZENvZGVNaXJyb3IodGhpcy5jb2RlTWlycm9ySW5zdGFuY2VzW2ldLmVkaXRvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYmluZENvZGVNaXJyb3IgKGNvZGVNaXJyb3JJbnN0YW5jZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblxuICAgICAgICAvLyB0aGlzIGZ1bmN0aW9uIG1ha2VzIHN1cmUgdGhhdCBlaXRoZXIgdGhlXG4gICAgICAgIC8vIGNvZGVtaXJyb3IgZXZlbnQgaXMgZXhlY3V0ZWQsIG9yIHRoZSB5anMgb2JzZXJ2ZXIgaXMgZXhlY3V0ZWRcbiAgICAgICAgdmFyIHRva2VuID0gdHJ1ZVxuICAgICAgICBmdW5jdGlvbiBtdXR1YWxFeGNsdXNlIChmKSB7XG4gICAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvZGVNaXJyb3JJbnN0YW5jZS5zZXRWYWx1ZSh0aGlzLnRvU3RyaW5nKCkpXG5cbiAgICAgICAgZnVuY3Rpb24gY29kZU1pcnJvckNhbGxiYWNrIChjbSwgZGVsdGFzKSB7XG4gICAgICAgICAgbXV0dWFsRXhjbHVzZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRlbHRhcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgZGVsdGEgPSBkZWx0YXNbaV1cbiAgICAgICAgICAgICAgdmFyIHN0YXJ0ID0gY29kZU1pcnJvckluc3RhbmNlLmluZGV4RnJvbVBvcyhkZWx0YS5mcm9tKVxuICAgICAgICAgICAgICAvLyBhcHBseSB0aGUgZGVsZXRlIG9wZXJhdGlvbiBmaXJzdFxuICAgICAgICAgICAgICBpZiAoZGVsdGEucmVtb3ZlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRlbExlbmd0aCA9IDBcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGRlbHRhLnJlbW92ZWQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgIGRlbExlbmd0aCArPSBkZWx0YS5yZW1vdmVkW2pdLmxlbmd0aFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBcImVudGVyXCIgaXMgYWxzbyBhIGNoYXJhY3RlciBpbiBvdXIgY2FzZVxuICAgICAgICAgICAgICAgIGRlbExlbmd0aCArPSBkZWx0YS5yZW1vdmVkLmxlbmd0aCAtIDFcbiAgICAgICAgICAgICAgICBzZWxmLmRlbGV0ZShzdGFydCwgZGVsTGVuZ3RoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIGFwcGx5IGluc2VydCBvcGVyYXRpb25cbiAgICAgICAgICAgICAgc2VsZi5pbnNlcnQoc3RhcnQsIGRlbHRhLnRleHQuam9pbignXFxuJykpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBjb2RlTWlycm9ySW5zdGFuY2Uub24oJ2NoYW5nZXMnLCBjb2RlTWlycm9yQ2FsbGJhY2spXG5cbiAgICAgICAgZnVuY3Rpb24geUNhbGxiYWNrIChldmVudCkge1xuICAgICAgICAgIG11dHVhbEV4Y2x1c2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbGV0IGZyb20gPSBjb2RlTWlycm9ySW5zdGFuY2UucG9zRnJvbUluZGV4KGV2ZW50LmluZGV4KVxuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICAgIGxldCB0byA9IGZyb21cbiAgICAgICAgICAgICAgY29kZU1pcnJvckluc3RhbmNlLnJlcGxhY2VSYW5nZShldmVudC52YWx1ZXMuam9pbignJyksIGZyb20sIHRvKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICBsZXQgdG8gPSBjb2RlTWlycm9ySW5zdGFuY2UucG9zRnJvbUluZGV4KGV2ZW50LmluZGV4ICsgZXZlbnQubGVuZ3RoKVxuICAgICAgICAgICAgICBjb2RlTWlycm9ySW5zdGFuY2UucmVwbGFjZVJhbmdlKCcnLCBmcm9tLCB0bylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHRoaXMub2JzZXJ2ZSh5Q2FsbGJhY2spXG4gICAgICAgIHRoaXMuY29kZU1pcnJvckluc3RhbmNlcy5wdXNoKHtcbiAgICAgICAgICBlZGl0b3I6IGNvZGVNaXJyb3JJbnN0YW5jZSxcbiAgICAgICAgICB5Q2FsbGJhY2s6IHlDYWxsYmFjayxcbiAgICAgICAgICBjb2RlTWlycm9yQ2FsbGJhY2s6IGNvZGVNaXJyb3JDYWxsYmFja1xuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgdW5iaW5kQWNlIChhY2VJbnN0YW5jZSkge1xuICAgICAgICB2YXIgaSA9IHRoaXMuYWNlSW5zdGFuY2VzLmZpbmRJbmRleChmdW5jdGlvbiAoYmluZGluZykge1xuICAgICAgICAgIHJldHVybiBiaW5kaW5nLmVkaXRvciA9PT0gYWNlSW5zdGFuY2VcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKGkgPj0gMCkge1xuICAgICAgICAgIHZhciBiaW5kaW5nID0gdGhpcy5hY2VJbnN0YW5jZXNbaV1cbiAgICAgICAgICB0aGlzLnVub2JzZXJ2ZShiaW5kaW5nLnlDYWxsYmFjaylcbiAgICAgICAgICBiaW5kaW5nLmVkaXRvci5vZmYoJ2NoYW5nZScsIGJpbmRpbmcuYWNlQ2FsbGJhY2spXG4gICAgICAgICAgdGhpcy5hY2VJbnN0YW5jZXMuc3BsaWNlKGksIDEpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHVuYmluZEFjZUFsbCAoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmFjZUluc3RhbmNlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIHRoaXMudW5iaW5kQWNlKHRoaXMuYWNlSW5zdGFuY2VzW2ldLmVkaXRvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYmluZEFjZSAoYWNlSW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cbiAgICAgICAgLy8gdGhpcyBmdW5jdGlvbiBtYWtlcyBzdXJlIHRoYXQgZWl0aGVyIHRoZVxuICAgICAgICAvLyBhY2UgZXZlbnQgaXMgZXhlY3V0ZWQsIG9yIHRoZSB5anMgb2JzZXJ2ZXIgaXMgZXhlY3V0ZWRcbiAgICAgICAgdmFyIHRva2VuID0gdHJ1ZVxuICAgICAgICBmdW5jdGlvbiBtdXR1YWxFeGNsdXNlIChmKSB7XG4gICAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGFjZUluc3RhbmNlLnNldFZhbHVlKHRoaXMudG9TdHJpbmcoKSlcblxuICAgICAgICBmdW5jdGlvbiBhY2VDYWxsYmFjayAoZGVsdGEpIHtcbiAgICAgICAgICBtdXR1YWxFeGNsdXNlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzdGFydFxuICAgICAgICAgICAgdmFyIGxlbmd0aFxuXG4gICAgICAgICAgICB2YXIgYWNlRG9jdW1lbnQgPSBhY2VJbnN0YW5jZS5nZXRTZXNzaW9uKCkuZ2V0RG9jdW1lbnQoKVxuICAgICAgICAgICAgaWYgKGRlbHRhLmFjdGlvbiA9PT0gJ2luc2VydCcpIHtcbiAgICAgICAgICAgICAgc3RhcnQgPSBhY2VEb2N1bWVudC5wb3NpdGlvblRvSW5kZXgoZGVsdGEuc3RhcnQsIDApXG4gICAgICAgICAgICAgIHNlbGYuaW5zZXJ0KHN0YXJ0LCBkZWx0YS5saW5lcy5qb2luKCdcXG4nKSlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEuYWN0aW9uID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgICBzdGFydCA9IGFjZURvY3VtZW50LnBvc2l0aW9uVG9JbmRleChkZWx0YS5zdGFydCwgMClcbiAgICAgICAgICAgICAgbGVuZ3RoID0gZGVsdGEubGluZXMuam9pbignXFxuJykubGVuZ3RoXG4gICAgICAgICAgICAgIHNlbGYuZGVsZXRlKHN0YXJ0LCBsZW5ndGgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBhY2VJbnN0YW5jZS5vbignY2hhbmdlJywgYWNlQ2FsbGJhY2spXG5cbiAgICAgICAgYWNlSW5zdGFuY2Uuc2VsZWN0aW9uLmNsZWFyU2VsZWN0aW9uKClcblxuICAgICAgICAvLyBXZSBkb24ndCB0aGF0IGFjZSBpcyBhIGdsb2JhbCB2YXJpYWJsZVxuICAgICAgICAvLyBzZWUgIzJcbiAgICAgICAgdmFyIGFjZUNsYXNzXG4gICAgICAgIGlmICh0eXBlb2YgYWNlICE9PSAndW5kZWZpbmVkJyAmJiBvcHRpb25zLmFjZUNsYXNzID09IG51bGwpIHtcbiAgICAgICAgICBhY2VDbGFzcyA9IGFjZSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWNlQ2xhc3MgPSBvcHRpb25zLmFjZUNsYXNzXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGFjZVJlcXVpcmUgPSBvcHRpb25zLmFjZVJlcXVpcmUgfHwgYWNlQ2xhc3MucmVxdWlyZVxuICAgICAgICB2YXIgUmFuZ2UgPSBhY2VSZXF1aXJlKCdhY2UvcmFuZ2UnKS5SYW5nZVxuXG4gICAgICAgIGZ1bmN0aW9uIHlDYWxsYmFjayAoZXZlbnQpIHtcbiAgICAgICAgICB2YXIgYWNlRG9jdW1lbnQgPSBhY2VJbnN0YW5jZS5nZXRTZXNzaW9uKCkuZ2V0RG9jdW1lbnQoKVxuICAgICAgICAgIG11dHVhbEV4Y2x1c2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICAgIGxldCBzdGFydCA9IGFjZURvY3VtZW50LmluZGV4VG9Qb3NpdGlvbihldmVudC5pbmRleCwgMClcbiAgICAgICAgICAgICAgYWNlRG9jdW1lbnQuaW5zZXJ0KHN0YXJ0LCBldmVudC52YWx1ZXMuam9pbignJykpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdkZWxldGUnKSB7XG4gICAgICAgICAgICAgIGxldCBzdGFydCA9IGFjZURvY3VtZW50LmluZGV4VG9Qb3NpdGlvbihldmVudC5pbmRleCwgMClcbiAgICAgICAgICAgICAgbGV0IGVuZCA9IGFjZURvY3VtZW50LmluZGV4VG9Qb3NpdGlvbihldmVudC5pbmRleCArIGV2ZW50Lmxlbmd0aCwgMClcbiAgICAgICAgICAgICAgdmFyIHJhbmdlID0gbmV3IFJhbmdlKHN0YXJ0LnJvdywgc3RhcnQuY29sdW1uLCBlbmQucm93LCBlbmQuY29sdW1uKVxuICAgICAgICAgICAgICBhY2VEb2N1bWVudC5yZW1vdmUocmFuZ2UpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9ic2VydmUoeUNhbGxiYWNrKVxuICAgICAgICB0aGlzLmFjZUluc3RhbmNlcy5wdXNoKHtcbiAgICAgICAgICBlZGl0b3I6IGFjZUluc3RhbmNlLFxuICAgICAgICAgIHlDYWxsYmFjazogeUNhbGxiYWNrLFxuICAgICAgICAgIGFjZUNhbGxiYWNrOiBhY2VDYWxsYmFja1xuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgYmluZCAoKSB7XG4gICAgICAgIHZhciBlID0gYXJndW1lbnRzWzBdXG4gICAgICAgIGlmIChlIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICAgIHRoaXMuYmluZFRleHRhcmVhLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICAgICAgfSBlbHNlIGlmIChlICE9IG51bGwgJiYgZS5zZXNzaW9uICE9IG51bGwgJiYgZS5nZXRTZXNzaW9uICE9IG51bGwgJiYgZS5zZXRWYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5iaW5kQWNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICAgICAgfSBlbHNlIGlmIChlICE9IG51bGwgJiYgZS5wb3NGcm9tSW5kZXggIT0gbnVsbCAmJiBlLnJlcGxhY2VSYW5nZSAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5iaW5kQ29kZU1pcnJvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH0gZWxzZSBpZiAoZSAhPSBudWxsICYmIGUub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuYmluZE1vbmFjby5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignQ2Fubm90IGJpbmQsIHVuc3VwcG9ydGVkIGVkaXRvciEnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmJpbmRUZXh0YXJlYSAodGV4dGFyZWEpIHtcbiAgICAgICAgdmFyIGkgPSB0aGlzLnRleHRmaWVsZHMuZmluZEluZGV4KGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGJpbmRpbmcuZWRpdG9yID09PSB0ZXh0YXJlYVxuICAgICAgICB9KVxuICAgICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgICAgdmFyIGJpbmRpbmcgPSB0aGlzLnRleHRmaWVsZHNbaV1cbiAgICAgICAgICB0aGlzLnVub2JzZXJ2ZShiaW5kaW5nLnlDYWxsYmFjaylcbiAgICAgICAgICB2YXIgZSA9IGJpbmRpbmcuZWRpdG9yXG4gICAgICAgICAgZS5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsIGJpbmRpbmcuZXZlbnRMaXN0ZW5lcilcbiAgICAgICAgICB0aGlzLnRleHRmaWVsZHMuc3BsaWNlKGksIDEpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHVuYmluZFRleHRhcmVhQWxsICgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMudGV4dGZpZWxkcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIHRoaXMudW5iaW5kVGV4dGFyZWEodGhpcy50ZXh0ZmllbGRzW2ldLmVkaXRvcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYmluZFRleHRhcmVhICh0ZXh0ZmllbGQsIGRvbVJvb3QpIHtcbiAgICAgICAgZG9tUm9vdCA9IGRvbVJvb3QgfHwgd2luZG93OyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICAgIGlmIChkb21Sb290LmdldFNlbGVjdGlvbiA9PSBudWxsKSB7XG4gICAgICAgICAgZG9tUm9vdCA9IHdpbmRvdzsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgZHVwbGljYXRlIVxuICAgICAgICBmb3IgKHZhciB0ID0gMDsgdCA8IHRoaXMudGV4dGZpZWxkcy5sZW5ndGg7IHQrKykge1xuICAgICAgICAgIGlmICh0aGlzLnRleHRmaWVsZHNbdF0uZWRpdG9yID09PSB0ZXh0ZmllbGQpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0aGlzIGZ1bmN0aW9uIG1ha2VzIHN1cmUgdGhhdCBlaXRoZXIgdGhlXG4gICAgICAgIC8vIHRleHRmaWVsZHQgZXZlbnQgaXMgZXhlY3V0ZWQsIG9yIHRoZSB5anMgb2JzZXJ2ZXIgaXMgZXhlY3V0ZWRcbiAgICAgICAgdmFyIHRva2VuID0gdHJ1ZVxuICAgICAgICBmdW5jdGlvbiBtdXR1YWxFeGNsdXNlIChmKSB7XG4gICAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHRoaXMudG9TdHJpbmcoKVxuXG4gICAgICAgIHZhciBjcmVhdGVSYW5nZSwgd3JpdGVSYW5nZSwgd3JpdGVDb250ZW50LCBnZXRDb250ZW50XG4gICAgICAgIGlmICh0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQgIT0gbnVsbCAmJiB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgIT0gbnVsbCkge1xuICAgICAgICAgIGNyZWF0ZVJhbmdlID0gZnVuY3Rpb24gKGZpeCkge1xuICAgICAgICAgICAgdmFyIGxlZnQgPSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICAgIHZhciByaWdodCA9IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICAgIGlmIChmaXggIT0gbnVsbCkge1xuICAgICAgICAgICAgICBsZWZ0ID0gZml4KGxlZnQpXG4gICAgICAgICAgICAgIHJpZ2h0ID0gZml4KHJpZ2h0KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgbGVmdDogbGVmdCxcbiAgICAgICAgICAgICAgcmlnaHQ6IHJpZ2h0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHdyaXRlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICAgICAgICAgIHdyaXRlQ29udGVudChzZWxmLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UocmFuZ2UubGVmdCwgcmFuZ2UucmlnaHQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHdyaXRlQ29udGVudCA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gICAgICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSBjb250ZW50XG4gICAgICAgICAgfVxuICAgICAgICAgIGdldENvbnRlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGV4dGZpZWxkLnZhbHVlXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNyZWF0ZVJhbmdlID0gZnVuY3Rpb24gKGZpeCkge1xuICAgICAgICAgICAgdmFyIHJhbmdlID0ge31cbiAgICAgICAgICAgIHZhciBzID0gZG9tUm9vdC5nZXRTZWxlY3Rpb24oKVxuICAgICAgICAgICAgdmFyIGNsZW5ndGggPSB0ZXh0ZmllbGQudGV4dENvbnRlbnQubGVuZ3RoXG4gICAgICAgICAgICByYW5nZS5sZWZ0ID0gTWF0aC5taW4ocy5hbmNob3JPZmZzZXQsIGNsZW5ndGgpXG4gICAgICAgICAgICByYW5nZS5yaWdodCA9IE1hdGgubWluKHMuZm9jdXNPZmZzZXQsIGNsZW5ndGgpXG4gICAgICAgICAgICBpZiAoZml4ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgcmFuZ2UubGVmdCA9IGZpeChyYW5nZS5sZWZ0KVxuICAgICAgICAgICAgICByYW5nZS5yaWdodCA9IGZpeChyYW5nZS5yaWdodClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBlZGl0ZWRFbGVtZW50ID0gcy5mb2N1c05vZGVcbiAgICAgICAgICAgIGlmIChlZGl0ZWRFbGVtZW50ID09PSB0ZXh0ZmllbGQgfHwgZWRpdGVkRWxlbWVudCA9PT0gdGV4dGZpZWxkLmNoaWxkTm9kZXNbMF0pIHtcbiAgICAgICAgICAgICAgcmFuZ2UuaXNSZWFsID0gdHJ1ZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmFuZ2UuaXNSZWFsID0gZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByYW5nZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHdyaXRlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICAgICAgICAgIHdyaXRlQ29udGVudChzZWxmLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICB2YXIgdGV4dG5vZGUgPSB0ZXh0ZmllbGQuY2hpbGROb2Rlc1swXVxuICAgICAgICAgICAgaWYgKHJhbmdlLmlzUmVhbCAmJiB0ZXh0bm9kZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChyYW5nZS5sZWZ0IDwgMCkge1xuICAgICAgICAgICAgICAgIHJhbmdlLmxlZnQgPSAwXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSBNYXRoLm1heChyYW5nZS5sZWZ0LCByYW5nZS5yaWdodClcbiAgICAgICAgICAgICAgaWYgKHJhbmdlLnJpZ2h0ID4gdGV4dG5vZGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSB0ZXh0bm9kZS5sZW5ndGhcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByYW5nZS5sZWZ0ID0gTWF0aC5taW4ocmFuZ2UubGVmdCwgcmFuZ2UucmlnaHQpXG4gICAgICAgICAgICAgIHZhciByID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICAgICAgICByLnNldFN0YXJ0KHRleHRub2RlLCByYW5nZS5sZWZ0KVxuICAgICAgICAgICAgICByLnNldEVuZCh0ZXh0bm9kZSwgcmFuZ2UucmlnaHQpXG4gICAgICAgICAgICAgIHZhciBzID0gZG9tUm9vdC5nZXRTZWxlY3Rpb24oKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICAgICAgICBzLnJlbW92ZUFsbFJhbmdlcygpXG4gICAgICAgICAgICAgIHMuYWRkUmFuZ2UocilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgd3JpdGVDb250ZW50ID0gZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgICAgICAgICAgIHRleHRmaWVsZC5pbm5lclRleHQgPSBjb250ZW50XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgdmFyIGNvbnRlbnRBcnJheSA9IGNvbnRlbnQucmVwbGFjZShuZXcgUmVnRXhwKCdcXG4nLCAnZycpLCAnICcpLnNwbGl0KCcgJyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgIHRleHRmaWVsZC5pbm5lclRleHQgPSAnJ1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb250ZW50QXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGMgPSBjb250ZW50QXJyYXlbaV1cbiAgICAgICAgICAgICAgdGV4dGZpZWxkLmlubmVyVGV4dCArPSBjXG4gICAgICAgICAgICAgIGlmIChpICE9PSBjb250ZW50QXJyYXkubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIHRleHRmaWVsZC5pbm5lckhUTUwgKz0gJyZuYnNwOydcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgKi9cbiAgICAgICAgICB9XG4gICAgICAgICAgZ2V0Q29udGVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0ZmllbGQuaW5uZXJUZXh0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdyaXRlQ29udGVudCh0aGlzLnRvU3RyaW5nKCkpXG5cbiAgICAgICAgZnVuY3Rpb24geUNhbGxiYWNrIChldmVudCkge1xuICAgICAgICAgIG11dHVhbEV4Y2x1c2UoKCkgPT4ge1xuICAgICAgICAgICAgdmFyIG9Qb3MsIGZpeFxuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICAgIG9Qb3MgPSBldmVudC5pbmRleFxuICAgICAgICAgICAgICBmaXggPSBmdW5jdGlvbiAoY3Vyc29yKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICAgICAgICBpZiAoY3Vyc29yIDw9IG9Qb3MpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3JcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3JcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIHIgPSBjcmVhdGVSYW5nZShmaXgpXG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UocilcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgICAgICAgICAgb1BvcyA9IGV2ZW50LmluZGV4XG4gICAgICAgICAgICAgIGZpeCA9IGZ1bmN0aW9uIChjdXJzb3IpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgICAgICAgICAgICAgIGlmIChjdXJzb3IgPCBvUG9zKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGN1cnNvciAtPSAxXG4gICAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHIgPSBjcmVhdGVSYW5nZShmaXgpXG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UocilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHRoaXMub2JzZXJ2ZSh5Q2FsbGJhY2spXG5cbiAgICAgICAgdmFyIHRleHRmaWVsZE9ic2VydmVyID0gZnVuY3Rpb24gdGV4dGZpZWxkT2JzZXJ2ZXIgKCkge1xuICAgICAgICAgIG11dHVhbEV4Y2x1c2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHIgPSBjcmVhdGVSYW5nZShmdW5jdGlvbiAoeCkgeyByZXR1cm4geCB9KVxuICAgICAgICAgICAgdmFyIG9sZENvbnRlbnQgPSBzZWxmLnRvU3RyaW5nKClcbiAgICAgICAgICAgIHZhciBjb250ZW50ID0gZ2V0Q29udGVudCgpXG4gICAgICAgICAgICB2YXIgZGlmZnMgPSBkaWZmKG9sZENvbnRlbnQsIGNvbnRlbnQsIHIubGVmdClcbiAgICAgICAgICAgIHZhciBwb3MgPSAwXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRpZmZzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBkID0gZGlmZnNbaV1cbiAgICAgICAgICAgICAgaWYgKGRbMF0gPT09IDApIHsgLy8gRVFVQUxcbiAgICAgICAgICAgICAgICBwb3MgKz0gZFsxXS5sZW5ndGhcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChkWzBdID09PSAtMSkgeyAvLyBERUxFVEVcbiAgICAgICAgICAgICAgICBzZWxmLmRlbGV0ZShwb3MsIGRbMV0ubGVuZ3RoKVxuICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBJTlNFUlRcbiAgICAgICAgICAgICAgICBzZWxmLmluc2VydChwb3MsIGRbMV0pXG4gICAgICAgICAgICAgICAgcG9zICs9IGRbMV0ubGVuZ3RoXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHRleHRmaWVsZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIHRleHRmaWVsZE9ic2VydmVyKVxuICAgICAgICB0aGlzLnRleHRmaWVsZHMucHVzaCh7XG4gICAgICAgICAgZWRpdG9yOiB0ZXh0ZmllbGQsXG4gICAgICAgICAgeUNhbGxiYWNrOiB5Q2FsbGJhY2ssXG4gICAgICAgICAgZXZlbnRMaXN0ZW5lcjogdGV4dGZpZWxkT2JzZXJ2ZXJcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIF9kZXN0cm95ICgpIHtcbiAgICAgICAgdGhpcy51bmJpbmRBbGwoKVxuICAgICAgICB0aGlzLnRleHRmaWVsZHMgPSBudWxsXG4gICAgICAgIHRoaXMuYWNlSW5zdGFuY2VzID0gbnVsbFxuICAgICAgICBzdXBlci5fZGVzdHJveSgpXG4gICAgICB9XG4gICAgfVxuICAgIFkuZXh0ZW5kKCdUZXh0JywgbmV3IFkudXRpbHMuQ3VzdG9tVHlwZURlZmluaXRpb24oe1xuICAgICAgbmFtZTogJ1RleHQnLFxuICAgICAgY2xhc3M6IFlUZXh0LFxuICAgICAgc3RydWN0OiAnTGlzdCcsXG4gICAgICBpbml0VHlwZTogZnVuY3Rpb24gKiBZVGV4dEluaXRpYWxpemVyIChvcywgbW9kZWwpIHtcbiAgICAgICAgdmFyIF9jb250ZW50ID0gW11cbiAgICAgICAgeWllbGQgKiBZLlN0cnVjdC5MaXN0Lm1hcC5jYWxsKHRoaXMsIG1vZGVsLCBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgICBpZiAob3AuaGFzT3duUHJvcGVydHkoJ29wQ29udGVudCcpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RleHQgbXVzdCBub3QgY29udGFpbiB0eXBlcyEnKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcC5jb250ZW50LmZvckVhY2goZnVuY3Rpb24gKGMsIGkpIHtcbiAgICAgICAgICAgICAgX2NvbnRlbnQucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IFtvcC5pZFswXSwgb3AuaWRbMV0gKyBpXSxcbiAgICAgICAgICAgICAgICB2YWw6IG9wLmNvbnRlbnRbaV1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gbmV3IFlUZXh0KG9zLCBtb2RlbC5pZCwgX2NvbnRlbnQpXG4gICAgICB9LFxuICAgICAgY3JlYXRlVHlwZTogZnVuY3Rpb24gWVRleHRDcmVhdG9yIChvcywgbW9kZWwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBZVGV4dChvcywgbW9kZWwuaWQsIFtdKVxuICAgICAgfVxuICAgIH0pKVxuICB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuaWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuICBleHRlbmQoWSlcbn1cbiIsImZ1bmN0aW9uIGV4dGVuZCAoWSkge1xuXG52YXIgVVNFX0FVRElPID0gdHJ1ZTtcbnZhciBVU0VfVklERU8gPSB0cnVlO1xudmFyIERFRkFVTFRfQ0hBTk5FTCA9ICdzb21lLWdsb2JhbC1jaGFubmVsLW5hbWUnO1xudmFyIE1VVEVfQVVESU9fQllfREVGQVVMVCA9IGZhbHNlO1xudmFyIHNpZ25hbGluZ19zZXJ2ZXJfdXJsID0gJ2h0dHA6Ly9maW53aW4uaW86MTI1Nic7XG5cbnZhciBJQ0VfU0VSVkVSUyA9IFtcbiAgICB7dXJsczogXCJzdHVuOnN0dW4ubC5nb29nbGUuY29tOjE5MzAyXCJ9LFxuICAgIHt1cmxzOiBcInR1cm46dHJ5LnJlZmFjdG9yZWQuYWk6MzQ3OFwiLCB1c2VybmFtZTogXCJ0ZXN0OTlcIiwgY3JlZGVudGlhbDogXCJ0ZXN0XCJ9XG5dO1xuXG5cbnZhciBkY3MgPSB7fTtcbnZhciBzaWduYWxpbmdfc29ja2V0ID0gbnVsbDsgICAvKiBvdXIgc29ja2V0LmlvIGNvbm5lY3Rpb24gdG8gb3VyIHdlYnNlcnZlciAqL1xudmFyIGxvY2FsX21lZGlhX3N0cmVhbSA9IG51bGw7IC8qIG91ciBvd24gbWljcm9waG9uZSAvIHdlYmNhbSAqL1xudmFyIHBlZXJzID0ge307ICAgICAgICAgICAgICAgIC8qIGtlZXAgdHJhY2sgb2Ygb3VyIHBlZXIgY29ubmVjdGlvbnMsIGluZGV4ZWQgYnkgcGVlcl9pZCAoYWthIHNvY2tldC5pbyBpZCkgKi9cbnZhciBwZWVyX21lZGlhX2VsZW1lbnRzID0ge307ICAvKiBrZWVwIHRyYWNrIG9mIG91ciA8dmlkZW8+LzxhdWRpbz4gdGFncywgaW5kZXhlZCBieSBwZWVyX2lkICovXG52YXIgaXNfZmlyc3QgPSAndW5rbm93bic7XG5cbmZ1bmN0aW9uIGluaXQoeXdlYnJ0Yykge1xuICAgIHNpZ25hbGluZ19zb2NrZXQgPSBpby5jb25uZWN0KHNpZ25hbGluZ19zZXJ2ZXJfdXJsKTtcblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgam9pbl9jaGF0X2NoYW5uZWwoREVGQVVMVF9DSEFOTkVMLCB7J3doYXRldmVyLXlvdS13YW50LWhlcmUnOiAnc3R1ZmYnfSk7XG4gICAgfSk7XG5cbiAgICBzaWduYWxpbmdfc29ja2V0Lm9uKCdzb2NrZXRzJywgZnVuY3Rpb24gKHNvY2tldHMpIHtcbiAgICAgICAgaWYgKHNvY2tldHMgPT09IDApIHtcbiAgICAgICAgICAgIGlzX2ZpcnN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlzX2ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHNpZ25hbGluZ19zb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgLyogVGVhciBkb3duIGFsbCBvZiBvdXIgcGVlciBjb25uZWN0aW9ucyBhbmQgcmVtb3ZlIGFsbCB0aGVcbiAgICAgICAgICogbWVkaWEgZGl2cyB3aGVuIHdlIGRpc2Nvbm5lY3QgKi9cbiAgICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJfbWVkaWFfZWxlbWVudHMpIHtcbiAgICAgICAgICAgIHBlZXJfbWVkaWFfZWxlbWVudHNbcGVlcl9pZF0ucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChwZWVyX2lkIGluIHBlZXJzKSB7XG4gICAgICAgICAgICBwZWVyc1twZWVyX2lkXS5jbG9zZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcGVlcnMgPSB7fTtcbiAgICAgICAgcGVlcl9tZWRpYV9lbGVtZW50cyA9IHt9O1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIGpvaW5fY2hhdF9jaGFubmVsKGNoYW5uZWwsIHVzZXJkYXRhKSB7XG4gICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgnam9pbicsIHtcImNoYW5uZWxcIjogY2hhbm5lbCwgXCJ1c2VyZGF0YVwiOiB1c2VyZGF0YX0pO1xuICAgICAgICB5d2VicnRjLnNldFVzZXJJZChzaWduYWxpbmdfc29ja2V0LmlkKTtcbiAgICAgICAgZnVuY3Rpb24gbG9hZF9ub3RlYm9vazIoZmlsZV9uYW1lKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIEp1cHl0ZXIgIT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgICAgICAgICBpZiAoSnVweXRlci5ub3RlYm9vaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZV9uYW1lID09PSAnVW50aXRsZWQuaXB5bmInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBKdXB5dGVyLm5vdGVib29rLmxvYWRfbm90ZWJvb2soZmlsZV9uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2subG9hZF9ub3RlYm9vazIoZmlsZV9uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChsb2FkX25vdGVib29rMiwgNTAwLCBmaWxlX25hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQobG9hZF9ub3RlYm9vazIsIDUwMCwgZmlsZV9uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBpbml0aWFsaXplX2RhdGEoKSB7XG4gICAgICAgICAgICBpZiAoaXNfZmlyc3QgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBsb2FkX25vdGVib29rMignVW50aXRsZWQuaXB5bmInKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNfZmlyc3QgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgbG9hZF9ub3RlYm9vazIoJ3RlbXBsYXRlLmlweW5iJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoaW5pdGlhbGl6ZV9kYXRhLCA1MDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGluaXRpYWxpemVfZGF0YSgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBwYXJ0X2NoYXRfY2hhbm5lbChjaGFubmVsKSB7XG4gICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncGFydCcsIGNoYW5uZWwpO1xuICAgIH1cblxuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignYWRkUGVlcicsIGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuXG4gICAgICAgIHl3ZWJydGMudXNlckpvaW5lZChwZWVyX2lkLCAnbWFzdGVyJyk7XG5cbiAgICAgICAgaWYgKHBlZXJfaWQgaW4gcGVlcnMpIHtcbiAgICAgICAgICAgIC8qIFRoaXMgY291bGQgaGFwcGVuIGlmIHRoZSB1c2VyIGpvaW5zIG11bHRpcGxlIGNoYW5uZWxzIHdoZXJlIHRoZSBvdGhlciBwZWVyIGlzIGFsc28gaW4uICovXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcGVlcl9jb25uZWN0aW9uID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKHtcImljZVNlcnZlcnNcIjogSUNFX1NFUlZFUlN9KTtcbiAgICAgICAgcGVlcnNbcGVlcl9pZF0gPSBwZWVyX2Nvbm5lY3Rpb247XG4gICAgICAgIHZhciBkYXRhQ2hhbm5lbCA9IHBlZXJfY29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgnZGF0YScpO1xuICAgICAgICBkY3NbcGVlcl9pZF0gPSBkYXRhQ2hhbm5lbDtcbiAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICB5d2VicnRjLnJlY2VpdmVNZXNzYWdlKHBlZXJfaWQsIEpTT04ucGFyc2UoZS5kYXRhKSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcGVlcl9jb25uZWN0aW9uLm9uaWNlY2FuZGlkYXRlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGlmIChldmVudC5jYW5kaWRhdGUpIHtcbiAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5SUNFQ2FuZGlkYXRlJywge1xuICAgICAgICAgICAgICAgICAgICAncGVlcl9pZCc6IHBlZXJfaWQsIFxuICAgICAgICAgICAgICAgICAgICAnaWNlX2NhbmRpZGF0ZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdzZHBNTGluZUluZGV4JzogZXZlbnQuY2FuZGlkYXRlLnNkcE1MaW5lSW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAnY2FuZGlkYXRlJzogZXZlbnQuY2FuZGlkYXRlLmNhbmRpZGF0ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZmlnLnNob3VsZF9jcmVhdGVfb2ZmZXIpIHtcbiAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5jcmVhdGVPZmZlcihcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAobG9jYWxfZGVzY3JpcHRpb24pIHsgXG4gICAgICAgICAgICAgICAgICAgIHBlZXJfY29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24oKSB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbGluZ19zb2NrZXQuZW1pdCgncmVsYXlTZXNzaW9uRGVzY3JpcHRpb24nLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeydwZWVyX2lkJzogcGVlcl9pZCwgJ3Nlc3Npb25fZGVzY3JpcHRpb24nOiBsb2NhbF9kZXNjcmlwdGlvbn0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkgeyBBbGVydChcIk9mZmVyIHNldExvY2FsRGVzY3JpcHRpb24gZmFpbGVkIVwiKTsgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3Igc2VuZGluZyBvZmZlcjogXCIsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICAvKiogXG4gICAgICogUGVlcnMgZXhjaGFuZ2Ugc2Vzc2lvbiBkZXNjcmlwdGlvbnMgd2hpY2ggY29udGFpbnMgaW5mb3JtYXRpb25cbiAgICAgKiBhYm91dCB0aGVpciBhdWRpbyAvIHZpZGVvIHNldHRpbmdzIGFuZCB0aGF0IHNvcnQgb2Ygc3R1ZmYuIEZpcnN0XG4gICAgICogdGhlICdvZmZlcmVyJyBzZW5kcyBhIGRlc2NyaXB0aW9uIHRvIHRoZSAnYW5zd2VyZXInICh3aXRoIHR5cGVcbiAgICAgKiBcIm9mZmVyXCIpLCB0aGVuIHRoZSBhbnN3ZXJlciBzZW5kcyBvbmUgYmFjayAod2l0aCB0eXBlIFwiYW5zd2VyXCIpLiAgXG4gICAgICovXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignc2Vzc2lvbkRlc2NyaXB0aW9uJywgZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHZhciBwZWVyX2lkID0gY29uZmlnLnBlZXJfaWQ7XG4gICAgICAgIHZhciBwZWVyID0gcGVlcnNbcGVlcl9pZF07XG5cbiAgICAgICAgcGVlci5vbmRhdGFjaGFubmVsID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YUNoYW5uZWwgPSBldmVudC5jaGFubmVsO1xuICAgICAgICAgICAgZGF0YUNoYW5uZWwub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGUpO1xuICAgICAgICAgICAgICAgIHl3ZWJydGMucmVjZWl2ZU1lc3NhZ2UocGVlcl9pZCwgSlNPTi5wYXJzZShlLmRhdGEpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHJlbW90ZV9kZXNjcmlwdGlvbiA9IGNvbmZpZy5zZXNzaW9uX2Rlc2NyaXB0aW9uO1xuXG4gICAgICAgIHZhciBkZXNjID0gbmV3IFJUQ1Nlc3Npb25EZXNjcmlwdGlvbihyZW1vdGVfZGVzY3JpcHRpb24pO1xuICAgICAgICB2YXIgc3R1ZmYgPSBwZWVyLnNldFJlbW90ZURlc2NyaXB0aW9uKGRlc2MsIFxuICAgICAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlbW90ZV9kZXNjcmlwdGlvbi50eXBlID09IFwib2ZmZXJcIikge1xuICAgICAgICAgICAgICAgICAgICBwZWVyLmNyZWF0ZUFuc3dlcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVlci5zZXRMb2NhbERlc2NyaXB0aW9uKGxvY2FsX2Rlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWduYWxpbmdfc29ja2V0LmVtaXQoJ3JlbGF5U2Vzc2lvbkRlc2NyaXB0aW9uJywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeydwZWVyX2lkJzogcGVlcl9pZCwgJ3Nlc3Npb25fZGVzY3JpcHRpb24nOiBsb2NhbF9kZXNjcmlwdGlvbn0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHsgQWxlcnQoXCJBbnN3ZXIgc2V0TG9jYWxEZXNjcmlwdGlvbiBmYWlsZWQhXCIpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRXJyb3IgY3JlYXRpbmcgYW5zd2VyOiBcIiwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZXRSZW1vdGVEZXNjcmlwdGlvbiBlcnJvcjogXCIsIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgIH0pO1xuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbignaWNlQ2FuZGlkYXRlJywgZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHZhciBwZWVyID0gcGVlcnNbY29uZmlnLnBlZXJfaWRdO1xuICAgICAgICB2YXIgaWNlX2NhbmRpZGF0ZSA9IGNvbmZpZy5pY2VfY2FuZGlkYXRlO1xuICAgICAgICBwZWVyLmFkZEljZUNhbmRpZGF0ZShuZXcgUlRDSWNlQ2FuZGlkYXRlKGljZV9jYW5kaWRhdGUpKTtcbiAgICB9KTtcblxuXG4gICAgc2lnbmFsaW5nX3NvY2tldC5vbigncmVtb3ZlUGVlcicsIGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB2YXIgcGVlcl9pZCA9IGNvbmZpZy5wZWVyX2lkO1xuICAgICAgICB5d2VicnRjLnVzZXJMZWZ0KHBlZXJfaWQpO1xuICAgICAgICBpZiAocGVlcl9pZCBpbiBwZWVyX21lZGlhX2VsZW1lbnRzKSB7XG4gICAgICAgICAgICBwZWVyX21lZGlhX2VsZW1lbnRzW3BlZXJfaWRdLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwZWVyX2lkIGluIHBlZXJzKSB7XG4gICAgICAgICAgICBwZWVyc1twZWVyX2lkXS5jbG9zZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIHBlZXJzW3BlZXJfaWRdO1xuICAgICAgICBkZWxldGUgcGVlcl9tZWRpYV9lbGVtZW50c1tjb25maWcucGVlcl9pZF07XG4gICAgfSk7XG59XG5cblxuICBjbGFzcyBXZWJSVEMgZXh0ZW5kcyBZLkFic3RyYWN0Q29ubmVjdG9yIHtcbiAgICBjb25zdHJ1Y3RvciAoeSwgb3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09wdGlvbnMgbXVzdCBub3QgYmUgdW5kZWZpbmVkIScpXG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5yb29tID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBkZWZpbmUgYSByb29tIG5hbWUhJylcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMucm9sZSA9ICdzbGF2ZSdcbiAgICAgIHN1cGVyKHksIG9wdGlvbnMpXG4gICAgICB0aGlzLndlYnJ0Y09wdGlvbnMgPSB7XG4gICAgICAgIHVybDogb3B0aW9ucy51cmwsXG4gICAgICAgIHJvb206IG9wdGlvbnMucm9vbVxuICAgICAgfVxuICAgICAgdmFyIHl3ZWJydGMgPSB0aGlzO1xuICAgICAgaW5pdCh5d2VicnRjKTtcbiAgICAgIHZhciBzd3IgPSBzaWduYWxpbmdfc29ja2V0O1xuICAgICAgdGhpcy5zd3IgPSBzd3I7XG4gICAgfVxuICAgIGRpc2Nvbm5lY3QgKCkge1xuICAgICAgY29uc29sZS5sb2coJ2ltcGxlbWVudCBkaXNjb25uZWN0IG9mIGNoYW5uZWwnKTtcbiAgICAgIHN1cGVyLmRpc2Nvbm5lY3QoKVxuICAgIH1cbiAgICByZWNvbm5lY3QgKCkge1xuICAgICAgY29uc29sZS5sb2coJ2ltcGxlbWVudCByZWNvbm5lY3Qgb2YgY2hhbm5lbCcpO1xuICAgICAgc3VwZXIucmVjb25uZWN0KClcbiAgICB9XG4gICAgc2VuZCAodWlkLCBtZXNzYWdlKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICB2YXIgc2VuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBkYyA9IGRjc1t1aWRdO1xuICAgICAgICAgICAgaWYgKGRjLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgICAgIGRjLnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChzZW5kLCA1MDApXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gdHJ5IHRvIHNlbmQgdGhlIG1lc3NhZ2VcbiAgICAgICAgc2VuZCgpXG4gICAgfVxuICAgIGJyb2FkY2FzdCAobWVzc2FnZSkge1xuICAgICAgICBmb3IgKHZhciBwZWVyX2lkIGluIGRjcykge1xuICAgICAgICAgICAgdmFyIGRjID0gZGNzW3BlZXJfaWRdO1xuICAgICAgICAgICAgaWYgKGRjLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgICAgIGRjLnNlbmQoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0VycnJycnJycnJycnJycnJycnJycnJycnJycnJycnJyJywgcGVlcl9pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaXNEaXNjb25uZWN0ZWQgKCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG4gIFkuZXh0ZW5kKCd3ZWJydGMnLCBXZWJSVEMpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5pZiAodHlwZW9mIFkgIT09ICd1bmRlZmluZWQnKSB7XG4gIGV4dGVuZChZKVxufVxuIiwiLyogZ2xvYmFsIFksIE11dGF0aW9uT2JzZXJ2ZXIgKi9cbid1c2Ugc3RyaWN0J1xuXG5mdW5jdGlvbiBleHRlbmQgKFkpIHtcbiAgWS5yZXF1ZXN0TW9kdWxlcyhbJ0FycmF5JywgJ01hcCddKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICBjbGFzcyBZWG1sIGV4dGVuZHMgWS5BcnJheS50eXBlRGVmaW5pdGlvblsnY2xhc3MnXSB7XG4gICAgICBjb25zdHJ1Y3RvciAob3MsIF9tb2RlbCwgX2NvbnRlbnQsIGF0dHJpYnV0ZXMsIHRhZ25hbWUsIGluaXQpIHtcbiAgICAgICAgc3VwZXIob3MsIF9tb2RlbCwgX2NvbnRlbnQpXG4gICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXNcbiAgICAgICAgdGhpcy5kb20gPSBudWxsXG4gICAgICAgIHRoaXMuX2RvbU9ic2VydmVyID0gbnVsbFxuICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlciA9IG5ldyBZLnV0aWxzLkV2ZW50TGlzdGVuZXJIYW5kbGVyKClcbiAgICAgICAgdGhpcy50YWduYW1lID0gdGFnbmFtZVxuICAgICAgICBpZiAoaW5pdCAhPSBudWxsICYmIGluaXQuZG9tICE9IG51bGwpIHtcbiAgICAgICAgICB0aGlzLl9zZXREb20oaW5pdC5kb20pXG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIub2JzZXJ2ZShldmVudCA9PiB7XG4gICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMoe1xuICAgICAgICAgICAgICB0eXBlOiAnY2hpbGRJbnNlcnRlZCcsXG4gICAgICAgICAgICAgIGluZGV4OiBldmVudC5pbmRleCxcbiAgICAgICAgICAgICAgbm9kZXM6IGV2ZW50LnZhbHVlc1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LnR5cGUgPT09ICdkZWxldGUnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMoe1xuICAgICAgICAgICAgICB0eXBlOiAnY2hpbGRSZW1vdmVkJyxcbiAgICAgICAgICAgICAgaW5kZXg6IGV2ZW50LmluZGV4LFxuICAgICAgICAgICAgICBfY29udGVudDogZXZlbnQuX2NvbnRlbnQsXG4gICAgICAgICAgICAgIHZhbHVlczogZXZlbnQudmFsdWVzXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgYXR0cmlidXRlcy5vYnNlcnZlKGV2ZW50ID0+IHtcbiAgICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ3VwZGF0ZScgfHwgZXZlbnQudHlwZSA9PT0gJ2FkZCcpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLmNhbGxFdmVudExpc3RlbmVycyh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdHRyaWJ1dGVDaGFuZ2VkJyxcbiAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZSxcbiAgICAgICAgICAgICAgdmFsdWU6IGV2ZW50LnZhbHVlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyLmNhbGxFdmVudExpc3RlbmVycyh7XG4gICAgICAgICAgICAgIHR5cGU6ICdhdHRyaWJ1dGVSZW1vdmVkJyxcbiAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBfZGVzdHJveSAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9kb21PYnNlcnZlciAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5fZG9tT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIuZGVzdHJveSgpXG4gICAgICAgIHRoaXMuX2V2ZW50TGlzdGVuZXJIYW5kbGVyID0gbnVsbFxuICAgICAgICBzdXBlci5fZGVzdHJveSgpXG4gICAgICB9XG4gICAgICBpbnNlcnQgKHBvcywgdHlwZXMpIHtcbiAgICAgICAgdmFyIF90eXBlcyA9IFtdXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheSh0eXBlcykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGFuIEFycmF5IG9mIGNvbnRlbnQhJylcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIHYgPSB0eXBlc1tpXVxuICAgICAgICAgIHZhciB0ID0gWS51dGlscy5pc1R5cGVEZWZpbml0aW9uKHYpXG4gICAgICAgICAgaWYgKCEodiAhPSBudWxsICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHYgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICh0ICYmIHRbMF0uY2xhc3MgPT09IFlYbWwpXG4gICAgICAgICAgICAgKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgWS5YbWwgdHlwZSBvciBTdHJpbmchJylcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJyAmJiB2Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29udGludWUgLy8gaWYgZW1wdHkgc3RyaW5nXG4gICAgICAgICAgfVxuICAgICAgICAgIF90eXBlcy5wdXNoKHYpXG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIuaW5zZXJ0KHBvcywgdHlwZXMpXG4gICAgICB9XG4gICAgICAvLyBiaW5kcyB0byBhIGRvbSBlbGVtZW50XG4gICAgICAvLyBPbmx5IGNhbGwgaWYgZG9tIGFuZCBZWG1sIGFyZSBpc29tb3JwaFxuICAgICAgX2JpbmRUb0RvbSAoZG9tKSB7XG4gICAgICAgIC8vIHRoaXMgZnVuY3Rpb24gbWFrZXMgc3VyZSB0aGF0IGVpdGhlciB0aGVcbiAgICAgICAgLy8gZG9tIGV2ZW50IGlzIGV4ZWN1dGVkLCBvciB0aGUgeWpzIG9ic2VydmVyIGlzIGV4ZWN1dGVkXG4gICAgICAgIHZhciB0b2tlbiA9IHRydWVcbiAgICAgICAgdmFyIG11dHVhbEV4Y2x1ZGUgPSBmID0+IHtcbiAgICAgICAgICAvLyB0YWtlIGFuZCBwcm9jZXNzIGN1cnJlbnQgcmVjb3Jkc1xuICAgICAgICAgIHZhciByZWNvcmRzID0gdGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKVxuICAgICAgICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIocmVjb3JkcylcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgICB0b2tlbiA9IGZhbHNlXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgLy8gZGlzY2FyZCBjcmVhdGVkIHJlY29yZHNcbiAgICAgICAgICAgICAgdGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKVxuICAgICAgICAgICAgICB0b2tlbiA9IHRydWVcbiAgICAgICAgICAgICAgdGhyb3cgZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZG9tT2JzZXJ2ZXIudGFrZVJlY29yZHMoKVxuICAgICAgICAgICAgdG9rZW4gPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX211dHVhbEV4Y2x1ZGUgPSBtdXR1YWxFeGNsdWRlXG4gICAgICAgIHRoaXMuX2RvbU9ic2VydmVyTGlzdGVuZXIgPSBtdXRhdGlvbnMgPT4ge1xuICAgICAgICAgIG11dHVhbEV4Y2x1ZGUoKCkgPT4ge1xuICAgICAgICAgICAgbXV0YXRpb25zLmZvckVhY2gobXV0YXRpb24gPT4ge1xuICAgICAgICAgICAgICBpZiAobXV0YXRpb24udHlwZSA9PT0gJ2F0dHJpYnV0ZXMnKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lXG4gICAgICAgICAgICAgICAgdmFyIHZhbCA9IG11dGF0aW9uLnRhcmdldC5nZXRBdHRyaWJ1dGUobXV0YXRpb24uYXR0cmlidXRlTmFtZSlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hdHRyaWJ1dGVzLmdldChuYW1lKSAhPT0gdmFsKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMuc2V0KG5hbWUsIHZhbClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobXV0YXRpb24udHlwZSA9PT0gJ2NoaWxkTGlzdCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG11dGF0aW9uLmFkZGVkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIGxldCBuID0gbXV0YXRpb24uYWRkZWROb2Rlc1tpXVxuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NvbnRlbnQuc29tZShmdW5jdGlvbiAoYykgeyByZXR1cm4gYy5kb20gPT09IG4gfSkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgaXQgYWxyZWFkeSBleGlzdHMgKHNpbmNlIHRoaXMgbWV0aG9kIGlzIGNhbGxlZCBhc3luY2hyb25vdXNseSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChuIGluc3RhbmNlb2Ygd2luZG93LlRleHQgJiYgbi50ZXh0Q29udGVudCA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGV4dG5vZGUgYW5kIGVtcHR5IGNvbnRlbnQgKHNvbWV0aW1lIGhhcHBlbnMuLiApXG4gICAgICAgICAgICAgICAgICAgIC8vICAgVE9ETyAtIHlvdSBjb3VsZCBhbHNvIGNoZWNrIGlmIHRoZSBpbnNlcnRlZCBub2RlIGFjdHVhbGx5IGV4aXN0cyBpbiB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgZG9tIChpbiBvcmRlciB0byBjb3ZlciBtb3JlIHBvdGVudGlhbCBjYXNlcylcbiAgICAgICAgICAgICAgICAgICAgbi5yZW1vdmUoKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgLy8gY29tcHV0ZSBwb3NpdGlvblxuICAgICAgICAgICAgICAgICAgLy8gc3BlY2lhbCBjYXNlLCBuLm5leHRTaWJsaW5nIGlzIG5vdCB5ZXQgaW5zZXJ0ZWQuIFNvIHdlIGZpbmQgdGhlIG5leHQgaW5zZXJ0ZWQgZWxlbWVudCFcbiAgICAgICAgICAgICAgICAgIHZhciBwb3MgPSAtMVxuICAgICAgICAgICAgICAgICAgdmFyIG5leHRTaWJsaW5nID0gbi5uZXh0U2libGluZ1xuICAgICAgICAgICAgICAgICAgd2hpbGUgKHBvcyA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5leHRTaWJsaW5nID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwb3MgPSB0aGlzLl9jb250ZW50Lmxlbmd0aFxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBvcyA9IHRoaXMuX2NvbnRlbnQuZmluZEluZGV4KGZ1bmN0aW9uIChjKSB7IHJldHVybiBjLmRvbSA9PT0gbmV4dFNpYmxpbmcgfSlcbiAgICAgICAgICAgICAgICAgICAgICBuZXh0U2libGluZyA9IG5leHRTaWJsaW5nLm5leHRTaWJsaW5nXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHZhciBjXG4gICAgICAgICAgICAgICAgICBpZiAobiBpbnN0YW5jZW9mIHdpbmRvdy5UZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIGMgPSBuLnRleHRDb250ZW50XG4gICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG4gaW5zdGFuY2VvZiB3aW5kb3cuRWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBjID0gWS5YbWwobilcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgWE1MIEVsZW1lbnQgZm91bmQuIFN5bmNocm9uaXphdGlvbiB3aWxsIG5vIGxvbmdlciB3b3JrIScpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB0aGlzLmluc2VydChwb3MsIFtjXSlcbiAgICAgICAgICAgICAgICAgIHZhciBjb250ZW50ID0gdGhpcy5fY29udGVudFtwb3NdXG4gICAgICAgICAgICAgICAgICBjb250ZW50LmRvbSA9IG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChtdXRhdGlvbi5yZW1vdmVkTm9kZXMsIG4gPT4ge1xuICAgICAgICAgICAgICAgICAgdmFyIHBvcyA9IHRoaXMuX2NvbnRlbnQuZmluZEluZGV4KGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjLmRvbSA9PT0gblxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIGlmIChwb3MgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZShwb3MpXG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FuIHVuZXhwZWN0ZWQgY29uZGl0aW9uIG9jY3VyZWQgKGRlbGV0ZWQgbm9kZSBkb2VzIG5vdCBleGlzdCBpbiB0aGUgbW9kZWwpIScpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RvbU9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIodGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcilcbiAgICAgICAgdGhpcy5fZG9tT2JzZXJ2ZXIub2JzZXJ2ZShkb20sIHsgYXR0cmlidXRlczogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlIH0pXG4gICAgICAgIC8vIEluIG9yZGVyIHRvIGluc2VydCBhIG5ldyBub2RlLCBzdWNjZXNzb3IgbmVlZHMgdG8gYmUgaW5zZXJ0ZWRcbiAgICAgICAgLy8gd2hlbiBjLmRvbSBjYW4gYmUgaW5zZXJ0ZWQsIHRyeSB0byBpbnNlcnQgdGhlIHByZWRlY2Vzc29ycyB0b29cbiAgICAgICAgdmFyIF90cnlJbnNlcnREb20gPSAocG9zKSA9PiB7XG4gICAgICAgICAgdmFyIGMgPSB0aGlzLl9jb250ZW50W3Bvc11cbiAgICAgICAgICB2YXIgc3VjY1xuICAgICAgICAgIGlmIChwb3MgKyAxIDwgdGhpcy5fY29udGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHN1Y2MgPSB0aGlzLl9jb250ZW50W3BvcyArIDFdXG4gICAgICAgICAgICBpZiAoc3VjYy5kb20gPT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGJlaGF2aW9yJykgLy8gc2hvdWxkbid0IGhhcHBlbiBhbnltb3JlIVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBwc2V1ZG8gc3VjY2Vzc29yXG4gICAgICAgICAgICBzdWNjID0ge1xuICAgICAgICAgICAgICBkb206IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZG9tLmluc2VydEJlZm9yZShjLmRvbSwgc3VjYy5kb20pXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdHJ5SW5zZXJ0RG9tID0gX3RyeUluc2VydERvbVxuICAgICAgICB0aGlzLm9ic2VydmUoZXZlbnQgPT4ge1xuICAgICAgICAgIG11dHVhbEV4Y2x1ZGUoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdhdHRyaWJ1dGVDaGFuZ2VkJykge1xuICAgICAgICAgICAgICBkb20uc2V0QXR0cmlidXRlKGV2ZW50Lm5hbWUsIGV2ZW50LnZhbHVlKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnYXR0cmlidXRlUmVtb3ZlZCcpIHtcbiAgICAgICAgICAgICAgZG9tLnJlbW92ZUF0dHJpYnV0ZShldmVudC5uYW1lKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC50eXBlID09PSAnY2hpbGRJbnNlcnRlZCcpIHtcbiAgICAgICAgICAgICAgaWYgKGV2ZW50Lm5vZGVzLmxlbmd0aCA9PT0gMSAmJiBldmVudC5ub2Rlc1swXSBpbnN0YW5jZW9mIFlYbWwpIHtcbiAgICAgICAgICAgICAgICAvLyBhIG5ldyB4bWwgbm9kZSB3YXMgaW5zZXJ0ZWQuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogY29uc2lkZXIgdGhlIGNhc2UgdGhhdCBub2RlcyBjb250YWlucyBtaXhlZCB0ZXh0ICYgdHlwZXMgKGN1cnJlbnRseSBub3QgaW1wbGVtZW50ZWQgaW4geWpzKVxuICAgICAgICAgICAgICAgIHZhciB2YWxJZCA9IHRoaXMuX2NvbnRlbnRbZXZlbnQuaW5kZXhdLmlkXG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50Lm5vZGVzLmxlbmd0aCA+IDEpIHsgdGhyb3cgbmV3IEVycm9yKCdUaGlzIGNhc2UgaXMgbm90IGhhbmRsZWQsIHlvdVxcJ2xsIHJ1biBpbnRvIGNvbnNpc3RlbmN5IGlzc3Vlcy4gQ29udGFjdCB0aGUgZGV2ZWxvcGVyJykgfVxuICAgICAgICAgICAgICAgIHZhciBuZXdOb2RlID0gZXZlbnQubm9kZXNbMF0uZ2V0RG9tKClcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIGNhbGxlZCBhc3luYy4gU28gd2UgaGF2ZSB0byBjb21wdXRlIHRoZSBwb3NpdGlvbiBhZ2FpblxuICAgICAgICAgICAgICAgIC8vIGFsc28gbXV0dWFsIGV4Y2x1c2UgdGhpc1xuICAgICAgICAgICAgICAgIHZhciBwb3NcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuaW5kZXggPCB0aGlzLl9jb250ZW50Lmxlbmd0aCAmJiBZLnV0aWxzLmNvbXBhcmVJZHModGhpcy5fY29udGVudFtldmVudC5pbmRleF0uaWQsIHZhbElkKSkge1xuICAgICAgICAgICAgICAgICAgcG9zID0gZXZlbnQuaW5kZXhcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcG9zID0gdGhpcy5fY29udGVudC5maW5kSW5kZXgoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFkudXRpbHMuY29tcGFyZUlkcyhjLmlkLCB2YWxJZClcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwb3MgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5fY29udGVudFtwb3NdLmRvbSA9IG5ld05vZGVcbiAgICAgICAgICAgICAgICAgIF90cnlJbnNlcnREb20ocG9zKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gZXZlbnQubm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICAgIHZhciBuID0gZXZlbnQubm9kZXNbaV1cbiAgICAgICAgICAgICAgICAgIHZhciB0ZXh0Tm9kZSA9IG5ldyB3aW5kb3cuVGV4dChuKVxuICAgICAgICAgICAgICAgICAgdGhpcy5fY29udGVudFtldmVudC5pbmRleCArIGldLmRvbSA9IHRleHROb2RlXG4gICAgICAgICAgICAgICAgICBfdHJ5SW5zZXJ0RG9tKGV2ZW50LmluZGV4ICsgaSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQudHlwZSA9PT0gJ2NoaWxkUmVtb3ZlZCcpIHtcbiAgICAgICAgICAgICAgZXZlbnQuX2NvbnRlbnQuZm9yRWFjaChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICAgIGlmIChjLmRvbSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICBjLmRvbS5yZW1vdmUoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gZG9tXG4gICAgICB9XG4gICAgICBfc2V0RG9tIChkb20pIHtcbiAgICAgICAgaWYgKHRoaXMuZG9tICE9IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09ubHkgY2FsbCB0aGlzIG1ldGhvZCBpZiB5b3Uga25vdyB3aGF0IHlvdSBhcmUgZG9pbmcgOyknKVxuICAgICAgICB9IGVsc2UgaWYgKGRvbS5fX3l4bWwgIT0gbnVsbCkgeyAvLyBUT0RPIGRvIGkgbmVlZCB0byBjaGVjayB0aGlzPyAtIG5vLi4gYnV0IGZvciBkZXYgcHVycHMuLlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQWxyZWFkeSBib3VuZCB0byBhbiBZWG1sIHR5cGUnKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRvbS5fX3l4bWwgPSB0aGlzLl9tb2RlbFxuICAgICAgICAgIC8vIHRhZyBpcyBhbHJlYWR5IHNldCBpbiBjb25zdHJ1Y3RvclxuICAgICAgICAgIC8vIHNldCBhdHRyaWJ1dGVzXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkb20uYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGF0dHIgPSBkb20uYXR0cmlidXRlc1tpXVxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzLnNldChhdHRyLm5hbWUsIGF0dHIudmFsdWUpXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuaW5zZXJ0KDAsIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChkb20uY2hpbGROb2RlcywgKGMsIGkpID0+IHtcbiAgICAgICAgICAgIGlmIChjIGluc3RhbmNlb2Ygd2luZG93LkVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFkuWG1sKGMpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGMgaW5zdGFuY2VvZiB3aW5kb3cuVGV4dCkge1xuICAgICAgICAgICAgICByZXR1cm4gYy50ZXh0Q29udGVudFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG5vZGUgdHlwZSEnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pKVxuICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoZG9tLmNoaWxkTm9kZXMsIChkb20sIGkpID0+IHtcbiAgICAgICAgICAgIHZhciBjID0gdGhpcy5fY29udGVudFtpXVxuICAgICAgICAgICAgYy5kb20gPSBkb21cbiAgICAgICAgICB9KVxuICAgICAgICAgIHRoaXMuZG9tID0gdGhpcy5fYmluZFRvRG9tKGRvbSlcbiAgICAgICAgICByZXR1cm4gdGhpcy5kb21cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZ2V0RG9tICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9tID09IG51bGwpIHtcbiAgICAgICAgICB2YXIgZG9tID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLnRhZ25hbWUpXG4gICAgICAgICAgZG9tLl9feXhtbCA9IHRoaXNcbiAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMua2V5c1ByaW1pdGl2ZXMoKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgICAgICBkb20uc2V0QXR0cmlidXRlKGtleSwgdGhpcy5hdHRyaWJ1dGVzLmdldChrZXkpKVxuICAgICAgICAgIH0pXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9jb250ZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYyA9IHRoaXMuX2NvbnRlbnRbaV1cbiAgICAgICAgICAgIGlmIChjLmhhc093blByb3BlcnR5KCd2YWwnKSkge1xuICAgICAgICAgICAgICBjLmRvbSA9IG5ldyB3aW5kb3cuVGV4dChjLnZhbClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGMuZG9tID0gdGhpcy5vcy5nZXRUeXBlKGMudHlwZSkuZ2V0RG9tKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvbS5hcHBlbmRDaGlsZChjLmRvbSlcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5kb20gPSB0aGlzLl9iaW5kVG9Eb20oZG9tKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmRvbVxuICAgICAgfVxuICAgICAgb2JzZXJ2ZSAoZikge1xuICAgICAgICB0aGlzLl9ldmVudExpc3RlbmVySGFuZGxlci5hZGRFdmVudExpc3RlbmVyKGYpXG4gICAgICB9XG4gICAgICB1bm9ic2VydmUgKGYpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRMaXN0ZW5lckhhbmRsZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcihmKVxuICAgICAgfVxuICAgICAgKiBfY2hhbmdlZCAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9kb21PYnNlcnZlciAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5fZG9tT2JzZXJ2ZXJMaXN0ZW5lcih0aGlzLl9kb21PYnNlcnZlci50YWtlUmVjb3JkcygpKVxuICAgICAgICB9XG4gICAgICAgIHlpZWxkKiBZLkFycmF5LnR5cGVEZWZpbml0aW9uWydjbGFzcyddLnByb3RvdHlwZS5fY2hhbmdlZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICB9XG4gICAgfVxuICAgIFkuZXh0ZW5kKCdYbWwnLCBuZXcgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbih7XG4gICAgICBuYW1lOiAnWG1sJyxcbiAgICAgIGNsYXNzOiBZWG1sLFxuICAgICAgc3RydWN0OiAnTGlzdCcsXG4gICAgICBwYXJzZUFyZ3VtZW50czogZnVuY3Rpb24gKGFyZykge1xuICAgICAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gW3RoaXMsIHtcbiAgICAgICAgICAgIHRhZ25hbWU6IGFyZ1xuICAgICAgICAgIH1dXG4gICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2Ygd2luZG93LkVsZW1lbnQpIHtcbiAgICAgICAgICByZXR1cm4gW3RoaXMsIHtcbiAgICAgICAgICAgIHRhZ25hbWU6IGFyZy50YWdOYW1lLFxuICAgICAgICAgICAgZG9tOiBhcmdcbiAgICAgICAgICB9XVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignWS5YbWwgcmVxdWlyZXMgYW4gYXJndW1lbnQgd2hpY2ggaXMgYSBzdHJpbmchJylcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGluaXRUeXBlOiBmdW5jdGlvbiAqIFlYbWxJbml0aWFsaXplciAob3MsIG1vZGVsLCBhcmdzKSB7XG4gICAgICAgIHZhciBfY29udGVudCA9IFtdXG4gICAgICAgIHZhciBfdHlwZXMgPSBbXVxuICAgICAgICB5aWVsZCogWS5TdHJ1Y3QuTGlzdC5tYXAuY2FsbCh0aGlzLCBtb2RlbCwgZnVuY3Rpb24gKG9wKSB7XG4gICAgICAgICAgaWYgKG9wLmhhc093blByb3BlcnR5KCdvcENvbnRlbnQnKSkge1xuICAgICAgICAgICAgX2NvbnRlbnQucHVzaCh7XG4gICAgICAgICAgICAgIGlkOiBvcC5pZCxcbiAgICAgICAgICAgICAgdHlwZTogb3Aub3BDb250ZW50XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgX3R5cGVzLnB1c2gob3Aub3BDb250ZW50KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcC5jb250ZW50LmZvckVhY2goZnVuY3Rpb24gKGMsIGkpIHtcbiAgICAgICAgICAgICAgX2NvbnRlbnQucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IFtvcC5pZFswXSwgb3AuaWRbMV0gKyBpXSxcbiAgICAgICAgICAgICAgICB2YWw6IG9wLmNvbnRlbnRbaV1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IF90eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHlpZWxkKiBvcy5pbml0VHlwZS5jYWxsKHRoaXMsIF90eXBlc1tpXSlcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiB0aGlzIHR5cGUgaXMgZGVmaW5lZCBpbiB5LnNoYXJlLiosIGluaXRUeXBlIGlzIGNhbGxlZCBpbnN0ZWFkIG9mIGNyZWF0ZVR5cGUhXG4gICAgICAgIC8vIFNvIHdlIGhhdmUgdG8gaW5pdGlhbGl6ZSBpdCBwcm9wZXJseVxuICAgICAgICB2YXIgcHJvcGVydGllc1xuICAgICAgICBpZiAobW9kZWwuaWRbMF0gPT09ICdfJykge1xuICAgICAgICAgIHZhciB0eXBlc3RydWN0ID0gWS5NYXAudHlwZURlZmluaXRpb24uc3RydWN0XG4gICAgICAgICAgdmFyIGlkID0gWydfJywgdHlwZXN0cnVjdCArICdfJyArICdNYXBfJyArIG1vZGVsLmlkWzFdXVxuICAgICAgICAgIHByb3BlcnRpZXMgPSB5aWVsZCogb3MuaW5pdFR5cGUuY2FsbCh0aGlzLCBpZClcblxuICAgICAgICAgIG1vZGVsLnJlcXVpcmVzID0gW3Byb3BlcnRpZXMuX21vZGVsXVxuICAgICAgICAgIG1vZGVsLmluZm8gPSB7XG4gICAgICAgICAgICB0YWduYW1lOiBhcmdzLnRhZ25hbWVcbiAgICAgICAgICB9XG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG1vZGVsKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByb3BlcnRpZXMgPSB5aWVsZCogb3MuaW5pdFR5cGUuY2FsbCh0aGlzLCBtb2RlbC5yZXF1aXJlc1swXSkgLy8gZ2V0IHRoZSBvbmx5IHJlcXVpcmVkIG9wXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBZWG1sKG9zLCBtb2RlbC5pZCwgX2NvbnRlbnQsIHByb3BlcnRpZXMsIG1vZGVsLmluZm8udGFnbmFtZSwgbW9kZWwuaW5mbylcbiAgICAgIH0sXG4gICAgICBjcmVhdGVUeXBlOiBmdW5jdGlvbiBZWG1sQ3JlYXRvciAob3MsIG1vZGVsLCBhcmdzKSB7XG4gICAgICAgIHZhciBpZCA9IG51bGxcbiAgICAgICAgaWYgKG1vZGVsLmlkWzBdID09PSAnXycpIHtcbiAgICAgICAgICB2YXIgdHlwZXN0cnVjdCA9IFkuTWFwLnR5cGVEZWZpbml0aW9uLnN0cnVjdFxuICAgICAgICAgIGlkID0gWydfJywgdHlwZXN0cnVjdCArICdfJyArICdNYXBfJyArIG1vZGVsLmlkWzFdXVxuICAgICAgICB9XG4gICAgICAgIHZhciBwcm9wZXJ0aWVzID0gb3MuY3JlYXRlVHlwZShZLk1hcCgpLCBpZClcbiAgICAgICAgbW9kZWwuaW5mbyA9IHtcbiAgICAgICAgICB0YWduYW1lOiBhcmdzLnRhZ25hbWVcbiAgICAgICAgfVxuICAgICAgICBtb2RlbC5yZXF1aXJlcyA9IFtwcm9wZXJ0aWVzLl9tb2RlbF0gLy8gWE1MIHJlcXVpcmVzIHRoYXQgJ3Byb3BlcnRpZXMnIGV4aXN0c1xuICAgICAgICByZXR1cm4gbmV3IFlYbWwob3MsIG1vZGVsLmlkLCBbXSwgcHJvcGVydGllcywgbW9kZWwuaW5mby50YWduYW1lLCBhcmdzKVxuICAgICAgfVxuICAgIH0pKVxuICB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuaWYgKHR5cGVvZiBZICE9PSAndW5kZWZpbmVkJykge1xuICBleHRlbmQoWSlcbn1cbiIsIi8qKlxuICogVGhpcyBpcyB0aGUgd2ViIGJyb3dzZXIgaW1wbGVtZW50YXRpb24gb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2RlYnVnJyk7XG5leHBvcnRzLmxvZyA9IGxvZztcbmV4cG9ydHMuZm9ybWF0QXJncyA9IGZvcm1hdEFyZ3M7XG5leHBvcnRzLnNhdmUgPSBzYXZlO1xuZXhwb3J0cy5sb2FkID0gbG9hZDtcbmV4cG9ydHMudXNlQ29sb3JzID0gdXNlQ29sb3JzO1xuZXhwb3J0cy5zdG9yYWdlID0gJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZVxuICAgICAgICAgICAgICAgJiYgJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIGNocm9tZS5zdG9yYWdlXG4gICAgICAgICAgICAgICAgICA/IGNocm9tZS5zdG9yYWdlLmxvY2FsXG4gICAgICAgICAgICAgICAgICA6IGxvY2Fsc3RvcmFnZSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcbiAgJ2xpZ2h0c2VhZ3JlZW4nLFxuICAnZm9yZXN0Z3JlZW4nLFxuICAnZ29sZGVucm9kJyxcbiAgJ2RvZGdlcmJsdWUnLFxuICAnZGFya29yY2hpZCcsXG4gICdjcmltc29uJ1xuXTtcblxuLyoqXG4gKiBDdXJyZW50bHkgb25seSBXZWJLaXQtYmFzZWQgV2ViIEluc3BlY3RvcnMsIEZpcmVmb3ggPj0gdjMxLFxuICogYW5kIHRoZSBGaXJlYnVnIGV4dGVuc2lvbiAoYW55IEZpcmVmb3ggdmVyc2lvbikgYXJlIGtub3duXG4gKiB0byBzdXBwb3J0IFwiJWNcIiBDU1MgY3VzdG9taXphdGlvbnMuXG4gKlxuICogVE9ETzogYWRkIGEgYGxvY2FsU3RvcmFnZWAgdmFyaWFibGUgdG8gZXhwbGljaXRseSBlbmFibGUvZGlzYWJsZSBjb2xvcnNcbiAqL1xuXG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG4gIC8vIE5COiBJbiBhbiBFbGVjdHJvbiBwcmVsb2FkIHNjcmlwdCwgZG9jdW1lbnQgd2lsbCBiZSBkZWZpbmVkIGJ1dCBub3QgZnVsbHlcbiAgLy8gaW5pdGlhbGl6ZWQuIFNpbmNlIHdlIGtub3cgd2UncmUgaW4gQ2hyb21lLCB3ZSdsbCBqdXN0IGRldGVjdCB0aGlzIGNhc2VcbiAgLy8gZXhwbGljaXRseVxuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnByb2Nlc3MgJiYgd2luZG93LnByb2Nlc3MudHlwZSA9PT0gJ3JlbmRlcmVyJykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gaXMgd2Via2l0PyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNjQ1OTYwNi8zNzY3NzNcbiAgLy8gZG9jdW1lbnQgaXMgdW5kZWZpbmVkIGluIHJlYWN0LW5hdGl2ZTogaHR0cHM6Ly9naXRodWIuY29tL2ZhY2Vib29rL3JlYWN0LW5hdGl2ZS9wdWxsLzE2MzJcbiAgcmV0dXJuICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2UpIHx8XG4gICAgLy8gaXMgZmlyZWJ1Zz8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMzk4MTIwLzM3Njc3M1xuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuY29uc29sZSAmJiAod2luZG93LmNvbnNvbGUuZmlyZWJ1ZyB8fCAod2luZG93LmNvbnNvbGUuZXhjZXB0aW9uICYmIHdpbmRvdy5jb25zb2xlLnRhYmxlKSkpIHx8XG4gICAgLy8gaXMgZmlyZWZveCA+PSB2MzE/XG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Ub29scy9XZWJfQ29uc29sZSNTdHlsaW5nX21lc3NhZ2VzXG4gICAgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9maXJlZm94XFwvKFxcZCspLykgJiYgcGFyc2VJbnQoUmVnRXhwLiQxLCAxMCkgPj0gMzEpIHx8XG4gICAgLy8gZG91YmxlIGNoZWNrIHdlYmtpdCBpbiB1c2VyQWdlbnQganVzdCBpbiBjYXNlIHdlIGFyZSBpbiBhIHdvcmtlclxuICAgICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvYXBwbGV3ZWJraXRcXC8oXFxkKykvKSk7XG59XG5cbi8qKlxuICogTWFwICVqIHRvIGBKU09OLnN0cmluZ2lmeSgpYCwgc2luY2Ugbm8gV2ViIEluc3BlY3RvcnMgZG8gdGhhdCBieSBkZWZhdWx0LlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycy5qID0gZnVuY3Rpb24odikge1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuICdbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogJyArIGVyci5tZXNzYWdlO1xuICB9XG59O1xuXG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncyhhcmdzKSB7XG4gIHZhciB1c2VDb2xvcnMgPSB0aGlzLnVzZUNvbG9ycztcblxuICBhcmdzWzBdID0gKHVzZUNvbG9ycyA/ICclYycgOiAnJylcbiAgICArIHRoaXMubmFtZXNwYWNlXG4gICAgKyAodXNlQ29sb3JzID8gJyAlYycgOiAnICcpXG4gICAgKyBhcmdzWzBdXG4gICAgKyAodXNlQ29sb3JzID8gJyVjICcgOiAnICcpXG4gICAgKyAnKycgKyBleHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cbiAgaWYgKCF1c2VDb2xvcnMpIHJldHVybjtcblxuICB2YXIgYyA9ICdjb2xvcjogJyArIHRoaXMuY29sb3I7XG4gIGFyZ3Muc3BsaWNlKDEsIDAsIGMsICdjb2xvcjogaW5oZXJpdCcpXG5cbiAgLy8gdGhlIGZpbmFsIFwiJWNcIiBpcyBzb21ld2hhdCB0cmlja3ksIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb3RoZXJcbiAgLy8gYXJndW1lbnRzIHBhc3NlZCBlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHRoZSAlYywgc28gd2UgbmVlZCB0b1xuICAvLyBmaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGluZGV4IHRvIGluc2VydCB0aGUgQ1NTIGludG9cbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxhc3RDID0gMDtcbiAgYXJnc1swXS5yZXBsYWNlKC8lW2EtekEtWiVdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgaWYgKCclJScgPT09IG1hdGNoKSByZXR1cm47XG4gICAgaW5kZXgrKztcbiAgICBpZiAoJyVjJyA9PT0gbWF0Y2gpIHtcbiAgICAgIC8vIHdlIG9ubHkgYXJlIGludGVyZXN0ZWQgaW4gdGhlICpsYXN0KiAlY1xuICAgICAgLy8gKHRoZSB1c2VyIG1heSBoYXZlIHByb3ZpZGVkIHRoZWlyIG93bilcbiAgICAgIGxhc3RDID0gaW5kZXg7XG4gICAgfVxuICB9KTtcblxuICBhcmdzLnNwbGljZShsYXN0QywgMCwgYyk7XG59XG5cbi8qKlxuICogSW52b2tlcyBgY29uc29sZS5sb2coKWAgd2hlbiBhdmFpbGFibGUuXG4gKiBOby1vcCB3aGVuIGBjb25zb2xlLmxvZ2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gbG9nKCkge1xuICAvLyB0aGlzIGhhY2tlcnkgaXMgcmVxdWlyZWQgZm9yIElFOC85LCB3aGVyZVxuICAvLyB0aGUgYGNvbnNvbGUubG9nYCBmdW5jdGlvbiBkb2Vzbid0IGhhdmUgJ2FwcGx5J1xuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBjb25zb2xlXG4gICAgJiYgY29uc29sZS5sb2dcbiAgICAmJiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgYXJndW1lbnRzKTtcbn1cblxuLyoqXG4gKiBTYXZlIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2F2ZShuYW1lc3BhY2VzKSB7XG4gIHRyeSB7XG4gICAgaWYgKG51bGwgPT0gbmFtZXNwYWNlcykge1xuICAgICAgZXhwb3J0cy5zdG9yYWdlLnJlbW92ZUl0ZW0oJ2RlYnVnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZyA9IG5hbWVzcGFjZXM7XG4gICAgfVxuICB9IGNhdGNoKGUpIHt9XG59XG5cbi8qKlxuICogTG9hZCBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfSByZXR1cm5zIHRoZSBwcmV2aW91c2x5IHBlcnNpc3RlZCBkZWJ1ZyBtb2Rlc1xuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbG9hZCgpIHtcbiAgdmFyIHI7XG4gIHRyeSB7XG4gICAgciA9IGV4cG9ydHMuc3RvcmFnZS5kZWJ1ZztcbiAgfSBjYXRjaChlKSB7fVxuXG4gIC8vIElmIGRlYnVnIGlzbid0IHNldCBpbiBMUywgYW5kIHdlJ3JlIGluIEVsZWN0cm9uLCB0cnkgdG8gbG9hZCAkREVCVUdcbiAgaWYgKCFyICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAnZW52JyBpbiBwcm9jZXNzKSB7XG4gICAgciA9IHByb2Nlc3MuZW52LkRFQlVHO1xuICB9XG5cbiAgcmV0dXJuIHI7XG59XG5cbi8qKlxuICogRW5hYmxlIG5hbWVzcGFjZXMgbGlzdGVkIGluIGBsb2NhbFN0b3JhZ2UuZGVidWdgIGluaXRpYWxseS5cbiAqL1xuXG5leHBvcnRzLmVuYWJsZShsb2FkKCkpO1xuXG4vKipcbiAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cbiAqXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3NcbiAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG4gKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuICpcbiAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gd2luZG93LmxvY2FsU3RvcmFnZTtcbiAgfSBjYXRjaCAoZSkge31cbn1cbiIsIlxuLyoqXG4gKiBUaGlzIGlzIHRoZSBjb21tb24gbG9naWMgZm9yIGJvdGggdGhlIE5vZGUuanMgYW5kIHdlYiBicm93c2VyXG4gKiBpbXBsZW1lbnRhdGlvbnMgb2YgYGRlYnVnKClgLlxuICpcbiAqIEV4cG9zZSBgZGVidWcoKWAgYXMgdGhlIG1vZHVsZS5cbiAqL1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVEZWJ1Zy5kZWJ1ZyA9IGNyZWF0ZURlYnVnWydkZWZhdWx0J10gPSBjcmVhdGVEZWJ1ZztcbmV4cG9ydHMuY29lcmNlID0gY29lcmNlO1xuZXhwb3J0cy5kaXNhYmxlID0gZGlzYWJsZTtcbmV4cG9ydHMuZW5hYmxlID0gZW5hYmxlO1xuZXhwb3J0cy5lbmFibGVkID0gZW5hYmxlZDtcbmV4cG9ydHMuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuICovXG5cbmV4cG9ydHMubmFtZXMgPSBbXTtcbmV4cG9ydHMuc2tpcHMgPSBbXTtcblxuLyoqXG4gKiBNYXAgb2Ygc3BlY2lhbCBcIiVuXCIgaGFuZGxpbmcgZnVuY3Rpb25zLCBmb3IgdGhlIGRlYnVnIFwiZm9ybWF0XCIgYXJndW1lbnQuXG4gKlxuICogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXIgb3IgdXBwZXItY2FzZSBsZXR0ZXIsIGkuZS4gXCJuXCIgYW5kIFwiTlwiLlxuICovXG5cbmV4cG9ydHMuZm9ybWF0dGVycyA9IHt9O1xuXG4vKipcbiAqIFByZXZpb3VzIGxvZyB0aW1lc3RhbXAuXG4gKi9cblxudmFyIHByZXZUaW1lO1xuXG4vKipcbiAqIFNlbGVjdCBhIGNvbG9yLlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZVxuICogQHJldHVybiB7TnVtYmVyfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gc2VsZWN0Q29sb3IobmFtZXNwYWNlKSB7XG4gIHZhciBoYXNoID0gMCwgaTtcblxuICBmb3IgKGkgaW4gbmFtZXNwYWNlKSB7XG4gICAgaGFzaCAgPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIG5hbWVzcGFjZS5jaGFyQ29kZUF0KGkpO1xuICAgIGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG4gIH1cblxuICByZXR1cm4gZXhwb3J0cy5jb2xvcnNbTWF0aC5hYnMoaGFzaCkgJSBleHBvcnRzLmNvbG9ycy5sZW5ndGhdO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGRlYnVnZ2VyIHdpdGggdGhlIGdpdmVuIGBuYW1lc3BhY2VgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVEZWJ1ZyhuYW1lc3BhY2UpIHtcblxuICBmdW5jdGlvbiBkZWJ1ZygpIHtcbiAgICAvLyBkaXNhYmxlZD9cbiAgICBpZiAoIWRlYnVnLmVuYWJsZWQpIHJldHVybjtcblxuICAgIHZhciBzZWxmID0gZGVidWc7XG5cbiAgICAvLyBzZXQgYGRpZmZgIHRpbWVzdGFtcFxuICAgIHZhciBjdXJyID0gK25ldyBEYXRlKCk7XG4gICAgdmFyIG1zID0gY3VyciAtIChwcmV2VGltZSB8fCBjdXJyKTtcbiAgICBzZWxmLmRpZmYgPSBtcztcbiAgICBzZWxmLnByZXYgPSBwcmV2VGltZTtcbiAgICBzZWxmLmN1cnIgPSBjdXJyO1xuICAgIHByZXZUaW1lID0gY3VycjtcblxuICAgIC8vIHR1cm4gdGhlIGBhcmd1bWVudHNgIGludG8gYSBwcm9wZXIgQXJyYXlcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuXG4gICAgYXJnc1swXSA9IGV4cG9ydHMuY29lcmNlKGFyZ3NbMF0pO1xuXG4gICAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgYXJnc1swXSkge1xuICAgICAgLy8gYW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJU9cbiAgICAgIGFyZ3MudW5zaGlmdCgnJU8nKTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYXJnc1swXSA9IGFyZ3NbMF0ucmVwbGFjZSgvJShbYS16QS1aJV0pL2csIGZ1bmN0aW9uKG1hdGNoLCBmb3JtYXQpIHtcbiAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhbiBlc2NhcGVkICUgdGhlbiBkb24ndCBpbmNyZWFzZSB0aGUgYXJyYXkgaW5kZXhcbiAgICAgIGlmIChtYXRjaCA9PT0gJyUlJykgcmV0dXJuIG1hdGNoO1xuICAgICAgaW5kZXgrKztcbiAgICAgIHZhciBmb3JtYXR0ZXIgPSBleHBvcnRzLmZvcm1hdHRlcnNbZm9ybWF0XTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9ybWF0dGVyKSB7XG4gICAgICAgIHZhciB2YWwgPSBhcmdzW2luZGV4XTtcbiAgICAgICAgbWF0Y2ggPSBmb3JtYXR0ZXIuY2FsbChzZWxmLCB2YWwpO1xuXG4gICAgICAgIC8vIG5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcbiAgICAgICAgYXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBpbmRleC0tO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuXG4gICAgLy8gYXBwbHkgZW52LXNwZWNpZmljIGZvcm1hdHRpbmcgKGNvbG9ycywgZXRjLilcbiAgICBleHBvcnRzLmZvcm1hdEFyZ3MuY2FsbChzZWxmLCBhcmdzKTtcblxuICAgIHZhciBsb2dGbiA9IGRlYnVnLmxvZyB8fCBleHBvcnRzLmxvZyB8fCBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGxvZ0ZuLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICB9XG5cbiAgZGVidWcubmFtZXNwYWNlID0gbmFtZXNwYWNlO1xuICBkZWJ1Zy5lbmFibGVkID0gZXhwb3J0cy5lbmFibGVkKG5hbWVzcGFjZSk7XG4gIGRlYnVnLnVzZUNvbG9ycyA9IGV4cG9ydHMudXNlQ29sb3JzKCk7XG4gIGRlYnVnLmNvbG9yID0gc2VsZWN0Q29sb3IobmFtZXNwYWNlKTtcblxuICAvLyBlbnYtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gbG9naWMgZm9yIGRlYnVnIGluc3RhbmNlc1xuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV4cG9ydHMuaW5pdCkge1xuICAgIGV4cG9ydHMuaW5pdChkZWJ1Zyk7XG4gIH1cblxuICByZXR1cm4gZGVidWc7XG59XG5cbi8qKlxuICogRW5hYmxlcyBhIGRlYnVnIG1vZGUgYnkgbmFtZXNwYWNlcy4gVGhpcyBjYW4gaW5jbHVkZSBtb2Rlc1xuICogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlc1xuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBlbmFibGUobmFtZXNwYWNlcykge1xuICBleHBvcnRzLnNhdmUobmFtZXNwYWNlcyk7XG5cbiAgZXhwb3J0cy5uYW1lcyA9IFtdO1xuICBleHBvcnRzLnNraXBzID0gW107XG5cbiAgdmFyIHNwbGl0ID0gKHR5cGVvZiBuYW1lc3BhY2VzID09PSAnc3RyaW5nJyA/IG5hbWVzcGFjZXMgOiAnJykuc3BsaXQoL1tcXHMsXSsvKTtcbiAgdmFyIGxlbiA9IHNwbGl0Lmxlbmd0aDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKCFzcGxpdFtpXSkgY29udGludWU7IC8vIGlnbm9yZSBlbXB0eSBzdHJpbmdzXG4gICAgbmFtZXNwYWNlcyA9IHNwbGl0W2ldLnJlcGxhY2UoL1xcKi9nLCAnLio/Jyk7XG4gICAgaWYgKG5hbWVzcGFjZXNbMF0gPT09ICctJykge1xuICAgICAgZXhwb3J0cy5za2lwcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcy5zdWJzdHIoMSkgKyAnJCcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwb3J0cy5uYW1lcy5wdXNoKG5ldyBSZWdFeHAoJ14nICsgbmFtZXNwYWNlcyArICckJykpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERpc2FibGUgZGVidWcgb3V0cHV0LlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgZXhwb3J0cy5lbmFibGUoJycpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZW5hYmxlZChuYW1lKSB7XG4gIHZhciBpLCBsZW47XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMuc2tpcHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5za2lwc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGZvciAoaSA9IDAsIGxlbiA9IGV4cG9ydHMubmFtZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoZXhwb3J0cy5uYW1lc1tpXS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENvZXJjZSBgdmFsYC5cbiAqXG4gKiBAcGFyYW0ge01peGVkfSB2YWxcbiAqIEByZXR1cm4ge01peGVkfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29lcmNlKHZhbCkge1xuICBpZiAodmFsIGluc3RhbmNlb2YgRXJyb3IpIHJldHVybiB2YWwuc3RhY2sgfHwgdmFsLm1lc3NhZ2U7XG4gIHJldHVybiB2YWw7XG59XG4iLCJmdW5jdGlvbiBjYW5SZWFkIChhdXRoKSB7IHJldHVybiBhdXRoID09PSAncmVhZCcgfHwgYXV0aCA9PT0gJ3dyaXRlJyB9XG5mdW5jdGlvbiBjYW5Xcml0ZSAoYXV0aCkgeyByZXR1cm4gYXV0aCA9PT0gJ3dyaXRlJyB9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFkvKiA6YW55ICovKSB7XG4gIGNsYXNzIEFic3RyYWN0Q29ubmVjdG9yIHtcbiAgICAvKiA6OlxuICAgIHk6IFlDb25maWc7XG4gICAgcm9sZTogU3luY1JvbGU7XG4gICAgY29ubmVjdGlvbnM6IE9iamVjdDtcbiAgICBpc1N5bmNlZDogYm9vbGVhbjtcbiAgICB1c2VyRXZlbnRMaXN0ZW5lcnM6IEFycmF5PEZ1bmN0aW9uPjtcbiAgICB3aGVuU3luY2VkTGlzdGVuZXJzOiBBcnJheTxGdW5jdGlvbj47XG4gICAgY3VycmVudFN5bmNUYXJnZXQ6ID9Vc2VySWQ7XG4gICAgc3luY2luZ0NsaWVudHM6IEFycmF5PFVzZXJJZD47XG4gICAgZm9yd2FyZFRvU3luY2luZ0NsaWVudHM6IGJvb2xlYW47XG4gICAgZGVidWc6IGJvb2xlYW47XG4gICAgc3luY1N0ZXAyOiBQcm9taXNlO1xuICAgIHVzZXJJZDogVXNlcklkO1xuICAgIHNlbmQ6IEZ1bmN0aW9uO1xuICAgIGJyb2FkY2FzdDogRnVuY3Rpb247XG4gICAgYnJvYWRjYXN0T3BCdWZmZXI6IEFycmF5PE9wZXJhdGlvbj47XG4gICAgcHJvdG9jb2xWZXJzaW9uOiBudW1iZXI7XG4gICAgKi9cbiAgICAvKlxuICAgICAgb3B0cyBjb250YWlucyB0aGUgZm9sbG93aW5nIGluZm9ybWF0aW9uOlxuICAgICAgIHJvbGUgOiBTdHJpbmcgUm9sZSBvZiB0aGlzIGNsaWVudCAoXCJtYXN0ZXJcIiBvciBcInNsYXZlXCIpXG4gICAgICAgdXNlcklkIDogU3RyaW5nIFVuaXF1ZWx5IGRlZmluZXMgdGhlIHVzZXIuXG4gICAgICAgZGVidWc6IEJvb2xlYW4gV2hldGhlciB0byBwcmludCBkZWJ1ZyBtZXNzYWdlcyAob3B0aW9uYWwpXG4gICAgKi9cbiAgICBjb25zdHJ1Y3RvciAoeSwgb3B0cykge1xuICAgICAgdGhpcy55ID0geVxuICAgICAgaWYgKG9wdHMgPT0gbnVsbCkge1xuICAgICAgICBvcHRzID0ge31cbiAgICAgIH1cbiAgICAgIC8vIFByZWZlciB0byByZWNlaXZlIHVudHJhbnNmb3JtZWQgb3BlcmF0aW9ucy4gVGhpcyBkb2VzIG9ubHkgd29yayBpZlxuICAgICAgLy8gdGhpcyBjbGllbnQgcmVjZWl2ZXMgb3BlcmF0aW9ucyBmcm9tIG9ubHkgb25lIG90aGVyIGNsaWVudC5cbiAgICAgIC8vIEluIHBhcnRpY3VsYXIsIHRoaXMgZG9lcyBub3Qgd29yayB3aXRoIHktd2VicnRjLlxuICAgICAgLy8gSXQgd2lsbCB3b3JrIHdpdGggeS13ZWJzb2NrZXRzLWNsaWVudFxuICAgICAgaWYgKG9wdHMucm9sZSA9PSBudWxsIHx8IG9wdHMucm9sZSA9PT0gJ21hc3RlcicpIHtcbiAgICAgICAgdGhpcy5yb2xlID0gJ21hc3RlcidcbiAgICAgIH0gZWxzZSBpZiAob3B0cy5yb2xlID09PSAnc2xhdmUnKSB7XG4gICAgICAgIHRoaXMucm9sZSA9ICdzbGF2ZSdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlJvbGUgbXVzdCBiZSBlaXRoZXIgJ21hc3Rlcicgb3IgJ3NsYXZlJyFcIilcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nID0gWS5kZWJ1ZygneTpjb25uZWN0b3InKVxuICAgICAgdGhpcy5sb2dNZXNzYWdlID0gWS5kZWJ1ZygneTpjb25uZWN0b3ItbWVzc2FnZScpXG4gICAgICB0aGlzLnkuZGIuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zID0gb3B0cy5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnMgfHwgZmFsc2VcbiAgICAgIHRoaXMucm9sZSA9IG9wdHMucm9sZVxuICAgICAgdGhpcy5jb25uZWN0aW9ucyA9IHt9XG4gICAgICB0aGlzLmlzU3luY2VkID0gZmFsc2VcbiAgICAgIHRoaXMudXNlckV2ZW50TGlzdGVuZXJzID0gW11cbiAgICAgIHRoaXMud2hlblN5bmNlZExpc3RlbmVycyA9IFtdXG4gICAgICB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0ID0gbnVsbFxuICAgICAgdGhpcy5zeW5jaW5nQ2xpZW50cyA9IFtdXG4gICAgICB0aGlzLmZvcndhcmRUb1N5bmNpbmdDbGllbnRzID0gb3B0cy5mb3J3YXJkVG9TeW5jaW5nQ2xpZW50cyAhPT0gZmFsc2VcbiAgICAgIHRoaXMuZGVidWcgPSBvcHRzLmRlYnVnID09PSB0cnVlXG4gICAgICB0aGlzLnN5bmNTdGVwMiA9IFByb21pc2UucmVzb2x2ZSgpXG4gICAgICB0aGlzLmJyb2FkY2FzdE9wQnVmZmVyID0gW11cbiAgICAgIHRoaXMucHJvdG9jb2xWZXJzaW9uID0gMTFcbiAgICAgIHRoaXMuYXV0aEluZm8gPSBvcHRzLmF1dGggfHwgbnVsbFxuICAgICAgdGhpcy5jaGVja0F1dGggPSBvcHRzLmNoZWNrQXV0aCB8fCBmdW5jdGlvbiAoKSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUoJ3dyaXRlJykgfSAvLyBkZWZhdWx0IGlzIGV2ZXJ5b25lIGhhcyB3cml0ZSBhY2Nlc3NcbiAgICAgIGlmIChvcHRzLmdlbmVyYXRlVXNlcklkID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc2V0VXNlcklkKFkudXRpbHMuZ2VuZXJhdGVHdWlkKCkpXG4gICAgICB9XG4gICAgfVxuICAgIHJlc2V0QXV0aCAoYXV0aCkge1xuICAgICAgaWYgKHRoaXMuYXV0aEluZm8gIT09IGF1dGgpIHtcbiAgICAgICAgdGhpcy5hdXRoSW5mbyA9IGF1dGhcbiAgICAgICAgdGhpcy5icm9hZGNhc3Qoe1xuICAgICAgICAgIHR5cGU6ICdhdXRoJyxcbiAgICAgICAgICBhdXRoOiB0aGlzLmF1dGhJbmZvXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICAgIHJlY29ubmVjdCAoKSB7XG4gICAgICB0aGlzLmxvZygncmVjb25uZWN0aW5nLi4nKVxuICAgICAgcmV0dXJuIHRoaXMueS5kYi5zdGFydEdhcmJhZ2VDb2xsZWN0b3IoKVxuICAgIH1cbiAgICBkaXNjb25uZWN0ICgpIHtcbiAgICAgIHRoaXMubG9nKCdkaXNjcm9ubmVjdGluZy4uJylcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fVxuICAgICAgdGhpcy5pc1N5bmNlZCA9IGZhbHNlXG4gICAgICB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0ID0gbnVsbFxuICAgICAgdGhpcy5zeW5jaW5nQ2xpZW50cyA9IFtdXG4gICAgICB0aGlzLndoZW5TeW5jZWRMaXN0ZW5lcnMgPSBbXVxuICAgICAgdGhpcy55LmRiLnN0b3BHYXJiYWdlQ29sbGVjdG9yKClcbiAgICAgIHJldHVybiB0aGlzLnkuZGIud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKClcbiAgICB9XG4gICAgcmVwYWlyICgpIHtcbiAgICAgIHRoaXMubG9nKCdSZXBhaXJpbmcgdGhlIHN0YXRlIG9mIFlqcy4gVGhpcyBjYW4gaGFwcGVuIGlmIG1lc3NhZ2VzIGdldCBsb3N0LCBhbmQgWWpzIGRldGVjdHMgdGhhdCBzb21ldGhpbmcgaXMgd3JvbmcuIElmIHRoaXMgaGFwcGVucyBvZnRlbiwgcGxlYXNlIHJlcG9ydCBhbiBpc3N1ZSBoZXJlOiBodHRwczovL2dpdGh1Yi5jb20veS1qcy95anMvaXNzdWVzJylcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcy5jb25uZWN0aW9ucykge1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW25hbWVdLmlzU3luY2VkID0gZmFsc2VcbiAgICAgIH1cbiAgICAgIHRoaXMuaXNTeW5jZWQgPSBmYWxzZVxuICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IG51bGxcbiAgICAgIHRoaXMuZmluZE5leHRTeW5jVGFyZ2V0KClcbiAgICB9XG4gICAgc2V0VXNlcklkICh1c2VySWQpIHtcbiAgICAgIGlmICh0aGlzLnVzZXJJZCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMubG9nKCdTZXQgdXNlcklkIHRvIFwiJXNcIicsIHVzZXJJZClcbiAgICAgICAgdGhpcy51c2VySWQgPSB1c2VySWRcbiAgICAgICAgcmV0dXJuIHRoaXMueS5kYi5zZXRVc2VySWQodXNlcklkKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICB9XG4gICAgb25Vc2VyRXZlbnQgKGYpIHtcbiAgICAgIHRoaXMudXNlckV2ZW50TGlzdGVuZXJzLnB1c2goZilcbiAgICB9XG4gICAgcmVtb3ZlVXNlckV2ZW50TGlzdGVuZXIgKGYpIHtcbiAgICAgIHRoaXMudXNlckV2ZW50TGlzdGVuZXJzID0gdGhpcy51c2VyRXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGcgPT4geyBmICE9PSBnIH0pXG4gICAgfVxuICAgIHVzZXJMZWZ0ICh1c2VyKSB7XG4gICAgICBpZiAodGhpcy5jb25uZWN0aW9uc1t1c2VyXSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMubG9nKCdVc2VyIGxlZnQ6ICVzJywgdXNlcilcbiAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbdXNlcl1cbiAgICAgICAgaWYgKHVzZXIgPT09IHRoaXMuY3VycmVudFN5bmNUYXJnZXQpIHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0ID0gbnVsbFxuICAgICAgICAgIHRoaXMuZmluZE5leHRTeW5jVGFyZ2V0KClcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN5bmNpbmdDbGllbnRzID0gdGhpcy5zeW5jaW5nQ2xpZW50cy5maWx0ZXIoZnVuY3Rpb24gKGNsaSkge1xuICAgICAgICAgIHJldHVybiBjbGkgIT09IHVzZXJcbiAgICAgICAgfSlcbiAgICAgICAgZm9yICh2YXIgZiBvZiB0aGlzLnVzZXJFdmVudExpc3RlbmVycykge1xuICAgICAgICAgIGYoe1xuICAgICAgICAgICAgYWN0aW9uOiAndXNlckxlZnQnLFxuICAgICAgICAgICAgdXNlcjogdXNlclxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdXNlckpvaW5lZCAodXNlciwgcm9sZSkge1xuICAgICAgaWYgKHJvbGUgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHNwZWNpZnkgdGhlIHJvbGUgb2YgdGhlIGpvaW5lZCB1c2VyIScpXG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jb25uZWN0aW9uc1t1c2VyXSAhPSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhpcyB1c2VyIGFscmVhZHkgam9pbmVkIScpXG4gICAgICB9XG4gICAgICB0aGlzLmxvZygnVXNlciBqb2luZWQ6ICVzJywgdXNlcilcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbdXNlcl0gPSB7XG4gICAgICAgIGlzU3luY2VkOiBmYWxzZSxcbiAgICAgICAgcm9sZTogcm9sZVxuICAgICAgfVxuICAgICAgZm9yICh2YXIgZiBvZiB0aGlzLnVzZXJFdmVudExpc3RlbmVycykge1xuICAgICAgICBmKHtcbiAgICAgICAgICBhY3Rpb246ICd1c2VySm9pbmVkJyxcbiAgICAgICAgICB1c2VyOiB1c2VyLFxuICAgICAgICAgIHJvbGU6IHJvbGVcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0ID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5maW5kTmV4dFN5bmNUYXJnZXQoKVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuXG4gICAgLy8gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWRcbiAgICB3aGVuU3luY2VkIChmKSB7XG4gICAgICBpZiAodGhpcy5pc1N5bmNlZCkge1xuICAgICAgICBmKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMud2hlblN5bmNlZExpc3RlbmVycy5wdXNoKGYpXG4gICAgICB9XG4gICAgfVxuICAgIGZpbmROZXh0U3luY1RhcmdldCAoKSB7XG4gICAgICBpZiAodGhpcy5jdXJyZW50U3luY1RhcmdldCAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiAvLyBcIlRoZSBjdXJyZW50IHN5bmMgaGFzIG5vdCBmaW5pc2hlZCFcIlxuICAgICAgfVxuXG4gICAgICB2YXIgc3luY1VzZXIgPSBudWxsXG4gICAgICBmb3IgKHZhciB1aWQgaW4gdGhpcy5jb25uZWN0aW9ucykge1xuICAgICAgICBpZiAoIXRoaXMuY29ubmVjdGlvbnNbdWlkXS5pc1N5bmNlZCkge1xuICAgICAgICAgIHN5bmNVc2VyID0gdWlkXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFyIGNvbm4gPSB0aGlzXG4gICAgICBpZiAoc3luY1VzZXIgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmN1cnJlbnRTeW5jVGFyZ2V0ID0gc3luY1VzZXJcbiAgICAgICAgdGhpcy55LmRiLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqKCkge1xuICAgICAgICAgIHZhciBzdGF0ZVNldCA9IHlpZWxkKiB0aGlzLmdldFN0YXRlU2V0KClcbiAgICAgICAgICB2YXIgZGVsZXRlU2V0ID0geWllbGQqIHRoaXMuZ2V0RGVsZXRlU2V0KClcbiAgICAgICAgICB2YXIgYW5zd2VyID0ge1xuICAgICAgICAgICAgdHlwZTogJ3N5bmMgc3RlcCAxJyxcbiAgICAgICAgICAgIHN0YXRlU2V0OiBzdGF0ZVNldCxcbiAgICAgICAgICAgIGRlbGV0ZVNldDogZGVsZXRlU2V0LFxuICAgICAgICAgICAgcHJvdG9jb2xWZXJzaW9uOiBjb25uLnByb3RvY29sVmVyc2lvbixcbiAgICAgICAgICAgIGF1dGg6IGNvbm4uYXV0aEluZm9cbiAgICAgICAgICB9XG4gICAgICAgICAgY29ubi5zZW5kKHN5bmNVc2VyLCBhbnN3ZXIpXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWNvbm4uaXNTeW5jZWQpIHtcbiAgICAgICAgICB0aGlzLnkuZGIucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICooKSB7XG4gICAgICAgICAgICBpZiAoIWNvbm4uaXNTeW5jZWQpIHtcbiAgICAgICAgICAgICAgLy8gaXQgaXMgY3J1Y2lhbCB0aGF0IGlzU3luY2VkIGlzIHNldCBhdCB0aGUgdGltZSBnYXJiYWdlQ29sbGVjdEFmdGVyU3luYyBpcyBjYWxsZWRcbiAgICAgICAgICAgICAgY29ubi5pc1N5bmNlZCA9IHRydWVcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZ2FyYmFnZUNvbGxlY3RBZnRlclN5bmMoKVxuICAgICAgICAgICAgICAvLyBjYWxsIHdoZW5zeW5jZWQgbGlzdGVuZXJzXG4gICAgICAgICAgICAgIGZvciAodmFyIGYgb2YgY29ubi53aGVuU3luY2VkTGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgZigpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29ubi53aGVuU3luY2VkTGlzdGVuZXJzID0gW11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHNlbmQgKHVpZCwgbWVzc2FnZSkge1xuICAgICAgdGhpcy5sb2coJ1NlbmQgXFwnJXNcXCcgdG8gJXMnLCBtZXNzYWdlLnR5cGUsIHVpZClcbiAgICAgIHRoaXMubG9nTWVzc2FnZSgnTWVzc2FnZTogJWonLCBtZXNzYWdlKVxuICAgIH1cbiAgICBicm9hZGNhc3QgKG1lc3NhZ2UpIHtcbiAgICAgIHRoaXMubG9nKCdCcm9hZGNhc3QgXFwnJXNcXCcnLCBtZXNzYWdlLnR5cGUpXG4gICAgICB0aGlzLmxvZ01lc3NhZ2UoJ01lc3NhZ2U6ICVqJywgbWVzc2FnZSlcbiAgICB9XG4gICAgLypcbiAgICAgIEJ1ZmZlciBvcGVyYXRpb25zLCBhbmQgYnJvYWRjYXN0IHRoZW0gd2hlbiByZWFkeS5cbiAgICAqL1xuICAgIGJyb2FkY2FzdE9wcyAob3BzKSB7XG4gICAgICBvcHMgPSBvcHMubWFwKGZ1bmN0aW9uIChvcCkge1xuICAgICAgICByZXR1cm4gWS5TdHJ1Y3Rbb3Auc3RydWN0XS5lbmNvZGUob3ApXG4gICAgICB9KVxuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICBmdW5jdGlvbiBicm9hZGNhc3RPcGVyYXRpb25zICgpIHtcbiAgICAgICAgaWYgKHNlbGYuYnJvYWRjYXN0T3BCdWZmZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHNlbGYuYnJvYWRjYXN0KHtcbiAgICAgICAgICAgIHR5cGU6ICd1cGRhdGUnLFxuICAgICAgICAgICAgb3BzOiBzZWxmLmJyb2FkY2FzdE9wQnVmZmVyXG4gICAgICAgICAgfSlcbiAgICAgICAgICBzZWxmLmJyb2FkY2FzdE9wQnVmZmVyID0gW11cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuYnJvYWRjYXN0T3BCdWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuYnJvYWRjYXN0T3BCdWZmZXIgPSBvcHNcbiAgICAgICAgaWYgKHRoaXMueS5kYi50cmFuc2FjdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgICB0aGlzLnkuZGIud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKCkudGhlbihicm9hZGNhc3RPcGVyYXRpb25zKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldFRpbWVvdXQoYnJvYWRjYXN0T3BlcmF0aW9ucywgMClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5icm9hZGNhc3RPcEJ1ZmZlciA9IHRoaXMuYnJvYWRjYXN0T3BCdWZmZXIuY29uY2F0KG9wcylcbiAgICAgIH1cbiAgICB9XG4gICAgLypcbiAgICAgIFlvdSByZWNlaXZlZCBhIHJhdyBtZXNzYWdlLCBhbmQgeW91IGtub3cgdGhhdCBpdCBpcyBpbnRlbmRlZCBmb3IgWWpzLiBUaGVuIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgICAqL1xuICAgIHJlY2VpdmVNZXNzYWdlIChzZW5kZXIvKiA6VXNlcklkICovLCBtZXNzYWdlLyogOk1lc3NhZ2UgKi8pIHtcbiAgICAgIGlmIChzZW5kZXIgPT09IHRoaXMudXNlcklkKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgfVxuICAgICAgdGhpcy5sb2coJ1JlY2VpdmUgXFwnJXNcXCcgZnJvbSAlcycsIG1lc3NhZ2UudHlwZSwgc2VuZGVyKVxuICAgICAgdGhpcy5sb2dNZXNzYWdlKCdNZXNzYWdlOiAlaicsIG1lc3NhZ2UpXG4gICAgICBpZiAobWVzc2FnZS5wcm90b2NvbFZlcnNpb24gIT0gbnVsbCAmJiBtZXNzYWdlLnByb3RvY29sVmVyc2lvbiAhPT0gdGhpcy5wcm90b2NvbFZlcnNpb24pIHtcbiAgICAgICAgdGhpcy5sb2coXG4gICAgICAgICAgYFlvdSB0cmllZCB0byBzeW5jIHdpdGggYSB5anMgaW5zdGFuY2UgdGhhdCBoYXMgYSBkaWZmZXJlbnQgcHJvdG9jb2wgdmVyc2lvblxuICAgICAgICAgIChZb3U6ICR7dGhpcy5wcm90b2NvbFZlcnNpb259LCBDbGllbnQ6ICR7bWVzc2FnZS5wcm90b2NvbFZlcnNpb259KS5cbiAgICAgICAgICBUaGUgc3luYyB3YXMgc3RvcHBlZC4gWW91IG5lZWQgdG8gdXBncmFkZSB5b3VyIGRlcGVuZGVuY2llcyAoZXNwZWNpYWxseSBZanMgJiB0aGUgQ29ubmVjdG9yKSFcbiAgICAgICAgICBgKVxuICAgICAgICB0aGlzLnNlbmQoc2VuZGVyLCB7XG4gICAgICAgICAgdHlwZTogJ3N5bmMgc3RvcCcsXG4gICAgICAgICAgcHJvdG9jb2xWZXJzaW9uOiB0aGlzLnByb3RvY29sVmVyc2lvblxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoJ0luY29tcGF0aWJsZSBwcm90b2NvbCB2ZXJzaW9uJylcbiAgICAgIH1cbiAgICAgIGlmIChtZXNzYWdlLmF1dGggIT0gbnVsbCAmJiB0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0gIT0gbnVsbCkge1xuICAgICAgICAvLyBhdXRoZW50aWNhdGUgdXNpbmcgYXV0aCBpbiBtZXNzYWdlXG4gICAgICAgIHZhciBhdXRoID0gdGhpcy5jaGVja0F1dGgobWVzc2FnZS5hdXRoLCB0aGlzLnksIHNlbmRlcilcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tzZW5kZXJdLmF1dGggPSBhdXRoXG4gICAgICAgIGF1dGgudGhlbihhdXRoID0+IHtcbiAgICAgICAgICBmb3IgKHZhciBmIG9mIHRoaXMudXNlckV2ZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBmKHtcbiAgICAgICAgICAgICAgYWN0aW9uOiAndXNlckF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICAgICAgICB1c2VyOiBzZW5kZXIsXG4gICAgICAgICAgICAgIGF1dGg6IGF1dGhcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIGlmICh0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0gIT0gbnVsbCAmJiB0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0uYXV0aCA9PSBudWxsKSB7XG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZSB3aXRob3V0IG90aGVyd2lzZVxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW3NlbmRlcl0uYXV0aCA9IHRoaXMuY2hlY2tBdXRoKG51bGwsIHRoaXMueSwgc2VuZGVyKVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuY29ubmVjdGlvbnNbc2VuZGVyXSAhPSBudWxsICYmIHRoaXMuY29ubmVjdGlvbnNbc2VuZGVyXS5hdXRoICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29ubmVjdGlvbnNbc2VuZGVyXS5hdXRoLnRoZW4oKGF1dGgpID0+IHtcbiAgICAgICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnc3luYyBzdGVwIDEnICYmIGNhblJlYWQoYXV0aCkpIHtcbiAgICAgICAgICAgIGxldCBjb25uID0gdGhpc1xuICAgICAgICAgICAgbGV0IG0gPSBtZXNzYWdlXG5cbiAgICAgICAgICAgIHRoaXMueS5kYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKigpIHtcbiAgICAgICAgICAgICAgdmFyIGN1cnJlbnRTdGF0ZVNldCA9IHlpZWxkKiB0aGlzLmdldFN0YXRlU2V0KClcbiAgICAgICAgICAgICAgaWYgKGNhbldyaXRlKGF1dGgpKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuYXBwbHlEZWxldGVTZXQobS5kZWxldGVTZXQpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB2YXIgZHMgPSB5aWVsZCogdGhpcy5nZXREZWxldGVTZXQoKVxuICAgICAgICAgICAgICB2YXIgYW5zd2VyID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzeW5jIHN0ZXAgMicsXG4gICAgICAgICAgICAgICAgc3RhdGVTZXQ6IGN1cnJlbnRTdGF0ZVNldCxcbiAgICAgICAgICAgICAgICBkZWxldGVTZXQ6IGRzLFxuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogdGhpcy5wcm90b2NvbFZlcnNpb24sXG4gICAgICAgICAgICAgICAgYXV0aDogdGhpcy5hdXRoSW5mb1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFuc3dlci5vcyA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbnMobS5zdGF0ZVNldClcbiAgICAgICAgICAgICAgY29ubi5zZW5kKHNlbmRlciwgYW5zd2VyKVxuICAgICAgICAgICAgICBpZiAodGhpcy5mb3J3YXJkVG9TeW5jaW5nQ2xpZW50cykge1xuICAgICAgICAgICAgICAgIGNvbm4uc3luY2luZ0NsaWVudHMucHVzaChzZW5kZXIpXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICBjb25uLnN5bmNpbmdDbGllbnRzID0gY29ubi5zeW5jaW5nQ2xpZW50cy5maWx0ZXIoZnVuY3Rpb24gKGNsaSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2xpICE9PSBzZW5kZXJcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICBjb25uLnNlbmQoc2VuZGVyLCB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzeW5jIGRvbmUnXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0sIDUwMDApIC8vIFRPRE86IGNvbm4uc3luY2luZ0NsaWVudER1cmF0aW9uKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbm4uc2VuZChzZW5kZXIsIHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdzeW5jIGRvbmUnXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3N5bmMgc3RlcCAyJyAmJiBjYW5Xcml0ZShhdXRoKSkge1xuICAgICAgICAgICAgdmFyIGRiID0gdGhpcy55LmRiXG4gICAgICAgICAgICB2YXIgZGVmZXIgPSB7fVxuICAgICAgICAgICAgZGVmZXIucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUgPSByZXNvbHZlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgdGhpcy5zeW5jU3RlcDIgPSBkZWZlci5wcm9taXNlXG4gICAgICAgICAgICBsZXQgbSAvKiA6TWVzc2FnZVN5bmNTdGVwMiAqLyA9IG1lc3NhZ2VcbiAgICAgICAgICAgIGRiLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuYXBwbHlEZWxldGVTZXQobS5kZWxldGVTZXQpXG4gICAgICAgICAgICAgIGlmIChtLm9zVW50cmFuc2Zvcm1lZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuYXBwbHlPcGVyYXRpb25zVW50cmFuc2Zvcm1lZChtLm9zVW50cmFuc2Zvcm1lZCwgbS5zdGF0ZVNldClcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3JlLmFwcGx5KG0ub3MpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICogVGhpcyBqdXN0IHNlbmRzIHRoZSBjb21wbGV0ZSBoYiBhZnRlciBzb21lIHRpbWVcbiAgICAgICAgICAgICAgICogTW9zdGx5IGZvciBkZWJ1Z2dpbmcuLlxuICAgICAgICAgICAgICAgKlxuICAgICAgICAgICAgICBkYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wcyA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbnMobS5zdGF0ZVNldClcbiAgICAgICAgICAgICAgICBpZiAob3BzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIGlmICghYnJvYWRjYXN0SEIpIHsgLy8gVE9ETzogY29uc2lkZXIgdG8gYnJvYWRjYXN0IGhlcmUuLlxuICAgICAgICAgICAgICAgICAgICBjb25uLnNlbmQoc2VuZGVyLCB7XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgb3BzOiBvcHNcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJyb2FkY2FzdCBvbmx5IG9uY2UhXG4gICAgICAgICAgICAgICAgICAgIGNvbm4uYnJvYWRjYXN0T3BzKG9wcylcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgIGRlZmVyLnJlc29sdmUoKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3N5bmMgZG9uZScpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICAgICAgdGhpcy5zeW5jU3RlcDIudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHNlbGYuX3NldFN5bmNlZFdpdGgoc2VuZGVyKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3VwZGF0ZScgJiYgY2FuV3JpdGUoYXV0aCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmZvcndhcmRUb1N5bmNpbmdDbGllbnRzKSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIGNsaWVudCBvZiB0aGlzLnN5bmNpbmdDbGllbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kKGNsaWVudCwgbWVzc2FnZSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMueS5kYi5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnMpIHtcbiAgICAgICAgICAgICAgdmFyIGRlbG9wcyA9IG1lc3NhZ2Uub3BzLmZpbHRlcihmdW5jdGlvbiAobykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvLnN0cnVjdCA9PT0gJ0RlbGV0ZSdcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgaWYgKGRlbG9wcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5icm9hZGNhc3RPcHMoZGVsb3BzKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnkuZGIuYXBwbHkobWVzc2FnZS5vcHMpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCdVbmFibGUgdG8gZGVsaXZlciBtZXNzYWdlJylcbiAgICAgIH1cbiAgICB9XG4gICAgX3NldFN5bmNlZFdpdGggKHVzZXIpIHtcbiAgICAgIHZhciBjb25uID0gdGhpcy5jb25uZWN0aW9uc1t1c2VyXVxuICAgICAgaWYgKGNvbm4gIT0gbnVsbCkge1xuICAgICAgICBjb25uLmlzU3luY2VkID0gdHJ1ZVxuICAgICAgfVxuICAgICAgaWYgKHVzZXIgPT09IHRoaXMuY3VycmVudFN5bmNUYXJnZXQpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50U3luY1RhcmdldCA9IG51bGxcbiAgICAgICAgdGhpcy5maW5kTmV4dFN5bmNUYXJnZXQoKVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgQ3VycmVudGx5LCB0aGUgSEIgZW5jb2RlcyBvcGVyYXRpb25zIGFzIEpTT04uIEZvciB0aGUgbW9tZW50IEkgd2FudCB0byBrZWVwIGl0XG4gICAgICB0aGF0IHdheS4gTWF5YmUgd2Ugc3VwcG9ydCBlbmNvZGluZyBpbiB0aGUgSEIgYXMgWE1MIGluIHRoZSBmdXR1cmUsIGJ1dCBmb3Igbm93IEkgZG9uJ3Qgd2FudFxuICAgICAgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuXG4gICAgICBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxuICAgICAgd2UgZW5jb2RlIHRoZSBKU09OIGFzIFhNTC5cblxuICAgICAgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICAgICBkb2VzIG5vdCBzdXBwb3J0IHByaW1pdGl2ZSB2YWx1ZXMgYXMgYXJyYXkgZWxlbWVudHNcbiAgICAgIGV4cGVjdHMgYW4gbHR4IChsZXNzIHRoYW4geG1sKSBvYmplY3RcbiAgICAqL1xuICAgIHBhcnNlTWVzc2FnZUZyb21YbWwgKG0vKiA6YW55ICovKSB7XG4gICAgICBmdW5jdGlvbiBwYXJzZUFycmF5IChub2RlKSB7XG4gICAgICAgIGZvciAodmFyIG4gb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgIGlmIChuLmdldEF0dHJpYnV0ZSgnaXNBcnJheScpID09PSAndHJ1ZScpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUFycmF5KG4pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZU9iamVjdChuKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZnVuY3Rpb24gcGFyc2VPYmplY3QgKG5vZGUvKiA6YW55ICovKSB7XG4gICAgICAgIHZhciBqc29uID0ge31cbiAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gbm9kZS5hdHRycykge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IG5vZGUuYXR0cnNbYXR0ck5hbWVdXG4gICAgICAgICAgdmFyIGludCA9IHBhcnNlSW50KHZhbHVlLCAxMClcbiAgICAgICAgICBpZiAoaXNOYU4oaW50KSB8fCAoJycgKyBpbnQpICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAganNvblthdHRyTmFtZV0gPSB2YWx1ZVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBqc29uW2F0dHJOYW1lXSA9IGludFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBuLyogOmFueSAqLyBpbiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgdmFyIG5hbWUgPSBuLm5hbWVcbiAgICAgICAgICBpZiAobi5nZXRBdHRyaWJ1dGUoJ2lzQXJyYXknKSA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VBcnJheShuKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VPYmplY3QobilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGpzb25cbiAgICAgIH1cbiAgICAgIHBhcnNlT2JqZWN0KG0pXG4gICAgfVxuICAgIC8qXG4gICAgICBlbmNvZGUgbWVzc2FnZSBpbiB4bWxcbiAgICAgIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICAgICBTbyB7YTo0LGI6e2M6NX19IHdpbGwgbG9vayBsaWtlXG4gICAgICA8eSBhPVwiNFwiPlxuICAgICAgICA8YiBjPVwiNVwiPjwvYj5cbiAgICAgIDwveT5cbiAgICAgIG0gLSBsdHggZWxlbWVudFxuICAgICAganNvbiAtIE9iamVjdFxuICAgICovXG4gICAgZW5jb2RlTWVzc2FnZVRvWG1sIChtc2csIG9iaikge1xuICAgICAgLy8gYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgICAgZnVuY3Rpb24gZW5jb2RlT2JqZWN0IChtLCBqc29uKSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4ganNvbikge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGpzb25bbmFtZV1cbiAgICAgICAgICBpZiAobmFtZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBub3BcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIGVuY29kZU9iamVjdChtLmMobmFtZSksIHZhbHVlKVxuICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgICAgICAgICBlbmNvZGVBcnJheShtLmMobmFtZSksIHZhbHVlKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGVuY29kZUFycmF5IChtLCBhcnJheSkge1xuICAgICAgICBtLnNldEF0dHJpYnV0ZSgnaXNBcnJheScsICd0cnVlJylcbiAgICAgICAgZm9yICh2YXIgZSBvZiBhcnJheSkge1xuICAgICAgICAgIGlmIChlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIGVuY29kZU9iamVjdChtLmMoJ2FycmF5LWVsZW1lbnQnKSwgZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW5jb2RlQXJyYXkobS5jKCdhcnJheS1lbGVtZW50JyksIGUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAob2JqLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgZW5jb2RlT2JqZWN0KG1zZy5jKCd5JywgeyB4bWxuczogJ2h0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemEnIH0pLCBvYmopXG4gICAgICB9IGVsc2UgaWYgKG9iai5jb25zdHJ1Y3RvciA9PT0gQXJyYXkpIHtcbiAgICAgICAgZW5jb2RlQXJyYXkobXNnLmMoJ3knLCB7IHhtbG5zOiAnaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YScgfSksIG9iailcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkkgY2FuJ3QgZW5jb2RlIHRoaXMganNvbiFcIilcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgWS5BYnN0cmFjdENvbm5lY3RvciA9IEFic3RyYWN0Q29ubmVjdG9yXG59XG4iLCIvKiBnbG9iYWwgZ2V0UmFuZG9tLCBhc3luYyAqL1xuJ3VzZSBzdHJpY3QnXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFkpIHtcbiAgdmFyIGdsb2JhbFJvb20gPSB7XG4gICAgdXNlcnM6IHt9LFxuICAgIGJ1ZmZlcnM6IHt9LFxuICAgIHJlbW92ZVVzZXI6IGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICBmb3IgKHZhciBpIGluIHRoaXMudXNlcnMpIHtcbiAgICAgICAgdGhpcy51c2Vyc1tpXS51c2VyTGVmdCh1c2VyKVxuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMudXNlcnNbdXNlcl1cbiAgICAgIGRlbGV0ZSB0aGlzLmJ1ZmZlcnNbdXNlcl1cbiAgICB9LFxuICAgIGFkZFVzZXI6IGZ1bmN0aW9uIChjb25uZWN0b3IpIHtcbiAgICAgIHRoaXMudXNlcnNbY29ubmVjdG9yLnVzZXJJZF0gPSBjb25uZWN0b3JcbiAgICAgIHRoaXMuYnVmZmVyc1tjb25uZWN0b3IudXNlcklkXSA9IHt9XG4gICAgICBmb3IgKHZhciB1bmFtZSBpbiB0aGlzLnVzZXJzKSB7XG4gICAgICAgIGlmICh1bmFtZSAhPT0gY29ubmVjdG9yLnVzZXJJZCkge1xuICAgICAgICAgIHZhciB1ID0gdGhpcy51c2Vyc1t1bmFtZV1cbiAgICAgICAgICB1LnVzZXJKb2luZWQoY29ubmVjdG9yLnVzZXJJZCwgJ21hc3RlcicpXG4gICAgICAgICAgY29ubmVjdG9yLnVzZXJKb2luZWQodS51c2VySWQsICdtYXN0ZXInKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICB3aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgLy8gVGhlIGNvbm5lY3RvciBmaXJzdCBoYXMgdG8gc2VuZCB0aGUgbWVzc2FnZXMgdG8gdGhlIGRiLlxuICAgICAgICAvLyBXYWl0IGZvciB0aGUgY2hlY2tBdXRoLWZ1bmN0aW9uIHRvIHJlc29sdmVcbiAgICAgICAgLy8gVGhlIHRlc3QgbGliIG9ubHkgaGFzIGEgc2ltcGxlIGNoZWNrQXV0aCBmdW5jdGlvbjogYCgpID0+IFByb21pc2UucmVzb2x2ZSgpYFxuICAgICAgICAvLyBKdXN0IGFkZCBhIGZ1bmN0aW9uIHRvIHRoZSBldmVudC1xdWV1ZSwgaW4gb3JkZXIgdG8gd2FpdCBmb3IgdGhlIGV2ZW50LlxuICAgICAgICAvLyBUT0RPOiB0aGlzIG1heSBiZSBidWdneSBpbiB0ZXN0IGFwcGxpY2F0aW9ucyAoYnV0IGl0IGlzbid0IGJlIGZvciByZWFsLWxpZmUgYXBwcylcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIHBzID0gW11cbiAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNlbGYudXNlcnMpIHtcbiAgICAgICAgICAgIHBzLnB1c2goc2VsZi51c2Vyc1tuYW1lXS55LmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBQcm9taXNlLmFsbChwcykudGhlbihyZXNvbHZlLCByZWplY3QpXG4gICAgICAgIH0sIDEwKVxuICAgICAgfSlcbiAgICB9LFxuICAgIGZsdXNoT25lOiBmdW5jdGlvbiBmbHVzaE9uZSAoKSB7XG4gICAgICB2YXIgYnVmcyA9IFtdXG4gICAgICBmb3IgKHZhciByZWNlaXZlciBpbiBnbG9iYWxSb29tLmJ1ZmZlcnMpIHtcbiAgICAgICAgbGV0IGJ1ZmYgPSBnbG9iYWxSb29tLmJ1ZmZlcnNbcmVjZWl2ZXJdXG4gICAgICAgIHZhciBwdXNoID0gZmFsc2VcbiAgICAgICAgZm9yIChsZXQgc2VuZGVyIGluIGJ1ZmYpIHtcbiAgICAgICAgICBpZiAoYnVmZltzZW5kZXJdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHB1c2ggPSB0cnVlXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocHVzaCkge1xuICAgICAgICAgIGJ1ZnMucHVzaChyZWNlaXZlcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGJ1ZnMubGVuZ3RoID4gMCkge1xuICAgICAgICB2YXIgdXNlcklkID0gZ2V0UmFuZG9tKGJ1ZnMpXG4gICAgICAgIGxldCBidWZmID0gZ2xvYmFsUm9vbS5idWZmZXJzW3VzZXJJZF1cbiAgICAgICAgbGV0IHNlbmRlciA9IGdldFJhbmRvbShPYmplY3Qua2V5cyhidWZmKSlcbiAgICAgICAgdmFyIG0gPSBidWZmW3NlbmRlcl0uc2hpZnQoKVxuICAgICAgICBpZiAoYnVmZltzZW5kZXJdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGRlbGV0ZSBidWZmW3NlbmRlcl1cbiAgICAgICAgfVxuICAgICAgICB2YXIgdXNlciA9IGdsb2JhbFJvb20udXNlcnNbdXNlcklkXVxuICAgICAgICByZXR1cm4gdXNlci5yZWNlaXZlTWVzc2FnZShtWzBdLCBtWzFdKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gdXNlci55LmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpXG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHt9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSxcbiAgICBmbHVzaEFsbDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgIC8vIGZsdXNoZXMgbWF5IHJlc3VsdCBpbiBtb3JlIGNyZWF0ZWQgb3BlcmF0aW9ucyxcbiAgICAgICAgLy8gZmx1c2ggdW50aWwgdGhlcmUgaXMgbm90aGluZyBtb3JlIHRvIGZsdXNoXG4gICAgICAgIGZ1bmN0aW9uIG5leHRGbHVzaCAoKSB7XG4gICAgICAgICAgdmFyIGMgPSBnbG9iYWxSb29tLmZsdXNoT25lKClcbiAgICAgICAgICBpZiAoYykge1xuICAgICAgICAgICAgd2hpbGUgKGMpIHtcbiAgICAgICAgICAgICAgYyA9IGdsb2JhbFJvb20uZmx1c2hPbmUoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZ2xvYmFsUm9vbS53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKS50aGVuKG5leHRGbHVzaClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYyA9IGdsb2JhbFJvb20uZmx1c2hPbmUoKVxuICAgICAgICAgICAgaWYgKGMpIHtcbiAgICAgICAgICAgICAgYy50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBnbG9iYWxSb29tLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpLnRoZW4obmV4dEZsdXNoKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGdsb2JhbFJvb20ud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKCkudGhlbihuZXh0Rmx1c2gpXG4gICAgICB9KVxuICAgIH1cbiAgfVxuICBZLnV0aWxzLmdsb2JhbFJvb20gPSBnbG9iYWxSb29tXG5cbiAgdmFyIHVzZXJJZENvdW50ZXIgPSAwXG5cbiAgY2xhc3MgVGVzdCBleHRlbmRzIFkuQWJzdHJhY3RDb25uZWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yICh5LCBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT3B0aW9ucyBtdXN0IG5vdCBiZSB1bmRlZmluZWQhJylcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMucm9sZSA9ICdtYXN0ZXInXG4gICAgICBvcHRpb25zLmZvcndhcmRUb1N5bmNpbmdDbGllbnRzID0gZmFsc2VcbiAgICAgIHN1cGVyKHksIG9wdGlvbnMpXG4gICAgICB0aGlzLnNldFVzZXJJZCgodXNlcklkQ291bnRlcisrKSArICcnKS50aGVuKCgpID0+IHtcbiAgICAgICAgZ2xvYmFsUm9vbS5hZGRVc2VyKHRoaXMpXG4gICAgICB9KVxuICAgICAgdGhpcy5nbG9iYWxSb29tID0gZ2xvYmFsUm9vbVxuICAgICAgdGhpcy5zeW5jaW5nQ2xpZW50RHVyYXRpb24gPSAwXG4gICAgfVxuICAgIHJlY2VpdmVNZXNzYWdlIChzZW5kZXIsIG0pIHtcbiAgICAgIHJldHVybiBzdXBlci5yZWNlaXZlTWVzc2FnZShzZW5kZXIsIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobSkpKVxuICAgIH1cbiAgICBzZW5kICh1c2VySWQsIG1lc3NhZ2UpIHtcbiAgICAgIHZhciBidWZmZXIgPSBnbG9iYWxSb29tLmJ1ZmZlcnNbdXNlcklkXVxuICAgICAgaWYgKGJ1ZmZlciAhPSBudWxsKSB7XG4gICAgICAgIGlmIChidWZmZXJbdGhpcy51c2VySWRdID09IG51bGwpIHtcbiAgICAgICAgICBidWZmZXJbdGhpcy51c2VySWRdID0gW11cbiAgICAgICAgfVxuICAgICAgICBidWZmZXJbdGhpcy51c2VySWRdLnB1c2goSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShbdGhpcy51c2VySWQsIG1lc3NhZ2VdKSkpXG4gICAgICB9XG4gICAgfVxuICAgIGJyb2FkY2FzdCAobWVzc2FnZSkge1xuICAgICAgZm9yICh2YXIga2V5IGluIGdsb2JhbFJvb20uYnVmZmVycykge1xuICAgICAgICB2YXIgYnVmZiA9IGdsb2JhbFJvb20uYnVmZmVyc1trZXldXG4gICAgICAgIGlmIChidWZmW3RoaXMudXNlcklkXSA9PSBudWxsKSB7XG4gICAgICAgICAgYnVmZlt0aGlzLnVzZXJJZF0gPSBbXVxuICAgICAgICB9XG4gICAgICAgIGJ1ZmZbdGhpcy51c2VySWRdLnB1c2goSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShbdGhpcy51c2VySWQsIG1lc3NhZ2VdKSkpXG4gICAgICB9XG4gICAgfVxuICAgIGlzRGlzY29ubmVjdGVkICgpIHtcbiAgICAgIHJldHVybiBnbG9iYWxSb29tLnVzZXJzW3RoaXMudXNlcklkXSA9PSBudWxsXG4gICAgfVxuICAgIHJlY29ubmVjdCAoKSB7XG4gICAgICBpZiAodGhpcy5pc0Rpc2Nvbm5lY3RlZCgpKSB7XG4gICAgICAgIGdsb2JhbFJvb20uYWRkVXNlcih0aGlzKVxuICAgICAgICBzdXBlci5yZWNvbm5lY3QoKVxuICAgICAgfVxuICAgICAgcmV0dXJuIFkudXRpbHMuZ2xvYmFsUm9vbS5mbHVzaEFsbCgpXG4gICAgfVxuICAgIGRpc2Nvbm5lY3QgKCkge1xuICAgICAgdmFyIHdhaXRGb3JNZSA9IFByb21pc2UucmVzb2x2ZSgpXG4gICAgICBpZiAoIXRoaXMuaXNEaXNjb25uZWN0ZWQoKSkge1xuICAgICAgICBnbG9iYWxSb29tLnJlbW92ZVVzZXIodGhpcy51c2VySWQpXG4gICAgICAgIHdhaXRGb3JNZSA9IHN1cGVyLmRpc2Nvbm5lY3QoKVxuICAgICAgfVxuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICByZXR1cm4gd2FpdEZvck1lLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc2VsZi55LmRiLndoZW5UcmFuc2FjdGlvbnNGaW5pc2hlZCgpXG4gICAgICB9KVxuICAgIH1cbiAgICBmbHVzaCAoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgIHJldHVybiBhc3luYyhmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgdmFyIGJ1ZmYgPSBnbG9iYWxSb29tLmJ1ZmZlcnNbc2VsZi51c2VySWRdXG4gICAgICAgIHdoaWxlIChPYmplY3Qua2V5cyhidWZmKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdmFyIHNlbmRlciA9IGdldFJhbmRvbShPYmplY3Qua2V5cyhidWZmKSlcbiAgICAgICAgICB2YXIgbSA9IGJ1ZmZbc2VuZGVyXS5zaGlmdCgpXG4gICAgICAgICAgaWYgKGJ1ZmZbc2VuZGVyXS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGRlbGV0ZSBidWZmW3NlbmRlcl1cbiAgICAgICAgICB9XG4gICAgICAgICAgeWllbGQgdGhpcy5yZWNlaXZlTWVzc2FnZShtWzBdLCBtWzFdKVxuICAgICAgICB9XG4gICAgICAgIHlpZWxkIHNlbGYud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKClcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgWS5UZXN0ID0gVGVzdFxufVxuIiwiLyogQGZsb3cgKi9cbid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChZIC8qIDphbnkgKi8pIHtcbiAgLypcbiAgICBQYXJ0aWFsIGRlZmluaXRpb24gb2YgYW4gT3BlcmF0aW9uU3RvcmUuXG4gICAgVE9ETzogbmFtZSBpdCBEYXRhYmFzZSwgb3BlcmF0aW9uIHN0b3JlIG9ubHkgaG9sZHMgb3BlcmF0aW9ucy5cblxuICAgIEEgZGF0YWJhc2UgZGVmaW5pdGlvbiBtdXN0IGFsc2UgZGVmaW5lIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgICAqIGxvZ1RhYmxlKCkgKG9wdGlvbmFsKVxuICAgICAgLSBzaG93IHJlbGV2YW50IGluZm9ybWF0aW9uIGluZm9ybWF0aW9uIGluIGEgdGFibGVcbiAgICAqIHJlcXVlc3RUcmFuc2FjdGlvbihtYWtlR2VuKVxuICAgICAgLSByZXF1ZXN0IGEgdHJhbnNhY3Rpb25cbiAgICAqIGRlc3Ryb3koKVxuICAgICAgLSBkZXN0cm95IHRoZSBkYXRhYmFzZVxuICAqL1xuICBjbGFzcyBBYnN0cmFjdERhdGFiYXNlIHtcbiAgICAvKiA6OlxuICAgIHk6IFlDb25maWc7XG4gICAgZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zOiBib29sZWFuO1xuICAgIGxpc3RlbmVyc0J5SWQ6IE9iamVjdDtcbiAgICBsaXN0ZW5lcnNCeUlkRXhlY3V0ZU5vdzogQXJyYXk8T2JqZWN0PjtcbiAgICBsaXN0ZW5lcnNCeUlkUmVxdWVzdFBlbmRpbmc6IGJvb2xlYW47XG4gICAgaW5pdGlhbGl6ZWRUeXBlczogT2JqZWN0O1xuICAgIHdoZW5Vc2VySWRTZXRMaXN0ZW5lcjogP0Z1bmN0aW9uO1xuICAgIHdhaXRpbmdUcmFuc2FjdGlvbnM6IEFycmF5PFRyYW5zYWN0aW9uPjtcbiAgICB0cmFuc2FjdGlvbkluUHJvZ3Jlc3M6IGJvb2xlYW47XG4gICAgZXhlY3V0ZU9yZGVyOiBBcnJheTxPYmplY3Q+O1xuICAgIGdjMTogQXJyYXk8U3RydWN0PjtcbiAgICBnYzI6IEFycmF5PFN0cnVjdD47XG4gICAgZ2NUaW1lb3V0OiBudW1iZXI7XG4gICAgZ2NJbnRlcnZhbDogYW55O1xuICAgIGdhcmJhZ2VDb2xsZWN0OiBGdW5jdGlvbjtcbiAgICBleGVjdXRlT3JkZXI6IEFycmF5PGFueT47IC8vIGZvciBkZWJ1Z2dpbmcgb25seVxuICAgIHVzZXJJZDogVXNlcklkO1xuICAgIG9wQ2xvY2s6IG51bWJlcjtcbiAgICB0cmFuc2FjdGlvbnNGaW5pc2hlZDogP3twcm9taXNlOiBQcm9taXNlLCByZXNvbHZlOiBhbnl9O1xuICAgIHRyYW5zYWN0OiAoeDogP0dlbmVyYXRvcikgPT4gYW55O1xuICAgICovXG4gICAgY29uc3RydWN0b3IgKHksIG9wdHMpIHtcbiAgICAgIHRoaXMueSA9IHlcbiAgICAgIHRoaXMuZGJPcHRzID0gb3B0c1xuICAgICAgdmFyIG9zID0gdGhpc1xuICAgICAgdGhpcy51c2VySWQgPSBudWxsXG4gICAgICB2YXIgcmVzb2x2ZVxuICAgICAgdGhpcy51c2VySWRQcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgcmVzb2x2ZSA9IHJcbiAgICAgIH0pXG4gICAgICB0aGlzLnVzZXJJZFByb21pc2UucmVzb2x2ZSA9IHJlc29sdmVcbiAgICAgIC8vIHdoZXRoZXIgdG8gYnJvYWRjYXN0IGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMgKGluc2VydCAmIGRlbGV0ZSBob29rKVxuICAgICAgdGhpcy5mb3J3YXJkQXBwbGllZE9wZXJhdGlvbnMgPSBmYWxzZVxuICAgICAgLy8gRS5nLiB0aGlzLmxpc3RlbmVyc0J5SWRbaWRdIDogQXJyYXk8TGlzdGVuZXI+XG4gICAgICB0aGlzLmxpc3RlbmVyc0J5SWQgPSB7fVxuICAgICAgLy8gRXhlY3V0ZSB0aGUgbmV4dCB0aW1lIGEgdHJhbnNhY3Rpb24gaXMgcmVxdWVzdGVkXG4gICAgICB0aGlzLmxpc3RlbmVyc0J5SWRFeGVjdXRlTm93ID0gW11cbiAgICAgIC8vIEEgdHJhbnNhY3Rpb24gaXMgcmVxdWVzdGVkXG4gICAgICB0aGlzLmxpc3RlbmVyc0J5SWRSZXF1ZXN0UGVuZGluZyA9IGZhbHNlXG4gICAgICAvKiBUbyBtYWtlIHRoaW5ncyBtb3JlIGNsZWFyLCB0aGUgZm9sbG93aW5nIG5hbWluZyBjb252ZW50aW9uczpcbiAgICAgICAgICogbHMgOiB3ZSBwdXQgdGhpcy5saXN0ZW5lcnNCeUlkIG9uIGxzXG4gICAgICAgICAqIGwgOiBBcnJheTxMaXN0ZW5lcj5cbiAgICAgICAgICogaWQgOiBJZCAoY2FuJ3QgdXNlIGFzIHByb3BlcnR5IG5hbWUpXG4gICAgICAgICAqIHNpZCA6IFN0cmluZyAoY29udmVydGVkIGZyb20gaWQgdmlhIEpTT04uc3RyaW5naWZ5XG4gICAgICAgICAgICAgICAgICAgICAgICAgc28gd2UgY2FuIHVzZSBpdCBhcyBhIHByb3BlcnR5IG5hbWUpXG5cbiAgICAgICAgQWx3YXlzIHJlbWVtYmVyIHRvIGZpcnN0IG92ZXJ3cml0ZVxuICAgICAgICBhIHByb3BlcnR5IGJlZm9yZSB5b3UgaXRlcmF0ZSBvdmVyIGl0IVxuICAgICAgKi9cbiAgICAgIC8vIFRPRE86IFVzZSBFUzcgV2VhayBNYXBzLiBUaGlzIHdheSB0eXBlcyB0aGF0IGFyZSBubyBsb25nZXIgdXNlcixcbiAgICAgIC8vIHdvbnQgYmUga2VwdCBpbiBtZW1vcnkuXG4gICAgICB0aGlzLmluaXRpYWxpemVkVHlwZXMgPSB7fVxuICAgICAgdGhpcy53YWl0aW5nVHJhbnNhY3Rpb25zID0gW11cbiAgICAgIHRoaXMudHJhbnNhY3Rpb25JblByb2dyZXNzID0gZmFsc2VcbiAgICAgIHRoaXMudHJhbnNhY3Rpb25Jc0ZsdXNoZWQgPSBmYWxzZVxuICAgICAgaWYgKHR5cGVvZiBZQ29uY3VycmVuY3lfVGVzdGluZ01vZGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuZXhlY3V0ZU9yZGVyID0gW11cbiAgICAgIH1cbiAgICAgIHRoaXMuZ2MxID0gW10gLy8gZmlyc3Qgc3RhZ2VcbiAgICAgIHRoaXMuZ2MyID0gW10gLy8gc2Vjb25kIHN0YWdlIC0+IGFmdGVyIHRoYXQsIHJlbW92ZSB0aGUgb3BcblxuICAgICAgZnVuY3Rpb24gZ2FyYmFnZUNvbGxlY3QgKCkge1xuICAgICAgICByZXR1cm4gb3Mud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKG9zLmdjMS5sZW5ndGggPiAwIHx8IG9zLmdjMi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBpZiAoIW9zLnkuY29ubmVjdG9yLmlzU3luY2VkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybignZ2Mgc2hvdWxkIGJlIGVtcHR5IHdoZW4gbm90IHN5bmNlZCEnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgIG9zLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgICAgICAgICBpZiAob3MueS5jb25uZWN0b3IgIT0gbnVsbCAmJiBvcy55LmNvbm5lY3Rvci5pc1N5bmNlZCkge1xuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcy5nYzIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG9pZCA9IG9zLmdjMltpXVxuICAgICAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5nYXJiYWdlQ29sbGVjdE9wZXJhdGlvbihvaWQpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBvcy5nYzIgPSBvcy5nYzFcbiAgICAgICAgICAgICAgICAgIG9zLmdjMSA9IFtdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFRPRE86IFVzZSBzZXRJbnRlcnZhbCBoZXJlIGluc3RlYWQgKHdoZW4gZ2FyYmFnZUNvbGxlY3QgaXMgY2FsbGVkIHNldmVyYWwgdGltZXMgdGhlcmUgd2lsbCBiZSBzZXZlcmFsIHRpbWVvdXRzLi4pXG4gICAgICAgICAgICAgICAgaWYgKG9zLmdjVGltZW91dCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIG9zLmdjSW50ZXJ2YWwgPSBzZXRUaW1lb3V0KGdhcmJhZ2VDb2xsZWN0LCBvcy5nY1RpbWVvdXQpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVE9ETzogc2VlIGFib3ZlXG4gICAgICAgICAgICBpZiAob3MuZ2NUaW1lb3V0ID4gMCkge1xuICAgICAgICAgICAgICBvcy5nY0ludGVydmFsID0gc2V0VGltZW91dChnYXJiYWdlQ29sbGVjdCwgb3MuZ2NUaW1lb3V0KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgdGhpcy5nYXJiYWdlQ29sbGVjdCA9IGdhcmJhZ2VDb2xsZWN0XG4gICAgICB0aGlzLnN0YXJ0R2FyYmFnZUNvbGxlY3RvcigpXG5cbiAgICAgIHRoaXMucmVwYWlyQ2hlY2tJbnRlcnZhbCA9ICFvcHRzLnJlcGFpckNoZWNrSW50ZXJ2YWwgPyA2MDAwIDogb3B0cy5yZXBhaXJDaGVja0ludGVydmFsXG4gICAgICB0aGlzLm9wc1JlY2VpdmVkVGltZXN0YW1wID0gbmV3IERhdGUoKVxuICAgICAgdGhpcy5zdGFydFJlcGFpckNoZWNrKClcbiAgICB9XG4gICAgc3RhcnRHYXJiYWdlQ29sbGVjdG9yICgpIHtcbiAgICAgIHRoaXMuZ2MgPSB0aGlzLmRiT3B0cy5nYyA9PSBudWxsIHx8IHRoaXMuZGJPcHRzLmdjXG4gICAgICBpZiAodGhpcy5nYykge1xuICAgICAgICB0aGlzLmdjVGltZW91dCA9ICF0aGlzLmRiT3B0cy5nY1RpbWVvdXQgPyA1MDAwMCA6IHRoaXMuZGJPcHRzLmdjVGltZW91dFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nY1RpbWVvdXQgPSAtMVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuZ2NUaW1lb3V0ID4gMCkge1xuICAgICAgICB0aGlzLmdhcmJhZ2VDb2xsZWN0KClcbiAgICAgIH1cbiAgICB9XG4gICAgc3RhcnRSZXBhaXJDaGVjayAoKSB7XG4gICAgICB2YXIgb3MgPSB0aGlzXG4gICAgICBpZiAodGhpcy5yZXBhaXJDaGVja0ludGVydmFsID4gMCkge1xuICAgICAgICB0aGlzLnJlcGFpckNoZWNrSW50ZXJ2YWxIYW5kbGVyID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gcmVwYWlyT25NaXNzaW5nT3BlcmF0aW9ucyAoKSB7XG4gICAgICAgICAgLypcbiAgICAgICAgICAgIENhc2UgMS4gTm8gb3BzIGhhdmUgYmVlbiByZWNlaXZlZCBpbiBhIHdoaWxlIChuZXcgRGF0ZSgpIC0gb3Mub3BzUmVjZWl2ZWRUaW1lc3RhbXAgPiBvcy5yZXBhaXJDaGVja0ludGVydmFsKVxuICAgICAgICAgICAgICAtIDEuMSBvcy5saXN0ZW5lcnNCeUlkIGlzIGVtcHR5LiBUaGVuIHRoZSBzdGF0ZSB3YXMgY29ycmVjdCB0aGUgd2hvbGUgdGltZS4gLT4gTm90aGluZyB0byBkbyAobm9yIHRvIHVwZGF0ZSlcbiAgICAgICAgICAgICAgLSAxLjIgb3MubGlzdGVuZXJzQnlJZCBpcyBub3QgZW1wdHkuXG4gICAgICAgICAgICAgICAgICAgICAgKiBUaGVuIHRoZSBzdGF0ZSB3YXMgaW5jb3JyZWN0IGZvciBhdCBsZWFzdCB7b3MucmVwYWlyQ2hlY2tJbnRlcnZhbH0gc2Vjb25kcy5cbiAgICAgICAgICAgICAgICAgICAgICAqIC0+IFJlbW92ZSBldmVyeXRoaW5nIGluIG9zLmxpc3RlbmVyc0J5SWQgYW5kIHN5bmMgYWdhaW4gKGNvbm5lY3Rvci5yZXBhaXIoKSlcbiAgICAgICAgICAgIENhc2UgMi4gQW4gb3AgaGFzIGJlZW4gcmVjZWl2ZWQgaW4gdGhlIGxhc3Qge29zLnJlcGFpckNoZWNrSW50ZXJ2YWwgfSBzZWNvbmRzLlxuICAgICAgICAgICAgICAgICAgICBJdCBpcyBub3QgeWV0IG5lY2Vzc2FyeSB0byBjaGVjayBmb3IgZmF1bHR5IGJlaGF2aW9yLiBFdmVyeXRoaW5nIGNhbiBzdGlsbCByZXNvbHZlIGl0c2VsZi4gV2FpdCBmb3IgbW9yZSBtZXNzYWdlcy5cbiAgICAgICAgICAgICAgICAgICAgSWYgbm90aGluZyB3YXMgcmVjZWl2ZWQgZm9yIGEgd2hpbGUgYW5kIG9zLmxpc3RlbmVyc0J5SWQgaXMgc3RpbGwgbm90IGVtdHksIHdlIGFyZSBpbiBjYXNlIDEuMlxuICAgICAgICAgICAgICAgICAgICAtPiBEbyBub3RoaW5nXG5cbiAgICAgICAgICAgIEJhc2VsaW5lIGhlcmUgaXM6IHdlIHJlYWxseSBvbmx5IGhhdmUgdG8gY2F0Y2ggY2FzZSAxLjIuLlxuICAgICAgICAgICovXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgbmV3IERhdGUoKSAtIG9zLm9wc1JlY2VpdmVkVGltZXN0YW1wID4gb3MucmVwYWlyQ2hlY2tJbnRlcnZhbCAmJlxuICAgICAgICAgICAgT2JqZWN0LmtleXMob3MubGlzdGVuZXJzQnlJZCkubGVuZ3RoID4gMCAvLyBvcy5saXN0ZW5lcnNCeUlkIGlzIG5vdCBlbXB0eVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gaGF2ZW4ndCByZWNlaXZlZCBvcGVyYXRpb25zIGZvciBvdmVyIHtvcy5yZXBhaXJDaGVja0ludGVydmFsfSBzZWNvbmRzLCByZXNlbmQgc3RhdGUgdmVjdG9yXG4gICAgICAgICAgICBvcy5saXN0ZW5lcnNCeUlkID0ge31cbiAgICAgICAgICAgIG9zLm9wc1JlY2VpdmVkVGltZXN0YW1wID0gbmV3IERhdGUoKSAvLyB1cGRhdGUgc28geW91IGRvbid0IHNlbmQgcmVwYWlyIHNldmVyYWwgdGltZXMgaW4gYSByb3dcbiAgICAgICAgICAgIG9zLnkuY29ubmVjdG9yLnJlcGFpcigpXG4gICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzLnJlcGFpckNoZWNrSW50ZXJ2YWwpXG4gICAgICB9XG4gICAgfVxuICAgIHN0b3BSZXBhaXJDaGVjayAoKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMucmVwYWlyQ2hlY2tJbnRlcnZhbEhhbmRsZXIpXG4gICAgfVxuICAgIHF1ZXVlR2FyYmFnZUNvbGxlY3RvciAoaWQpIHtcbiAgICAgIGlmICh0aGlzLnkuY29ubmVjdG9yLmlzU3luY2VkICYmIHRoaXMuZ2MpIHtcbiAgICAgICAgdGhpcy5nYzEucHVzaChpZClcbiAgICAgIH1cbiAgICB9XG4gICAgZW1wdHlHYXJiYWdlQ29sbGVjdG9yICgpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgdmFyIGNoZWNrID0gKCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmdjMS5sZW5ndGggPiAwIHx8IHRoaXMuZ2MyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuZ2FyYmFnZUNvbGxlY3QoKS50aGVuKGNoZWNrKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc2V0VGltZW91dChjaGVjaywgMClcbiAgICAgIH0pXG4gICAgfVxuICAgIGFkZFRvRGVidWcgKCkge1xuICAgICAgaWYgKHR5cGVvZiBZQ29uY3VycmVuY3lfVGVzdGluZ01vZGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBjb21tYW5kIC8qIDpzdHJpbmcgKi8gPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoYXJndW1lbnRzLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgIGlmICh0eXBlb2YgcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBzXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShzKVxuICAgICAgICAgIH1cbiAgICAgICAgfSkuam9pbignJykucmVwbGFjZSgvXCIvZywgXCInXCIpLnJlcGxhY2UoLywvZywgJywgJykucmVwbGFjZSgvOi9nLCAnOiAnKVxuICAgICAgICB0aGlzLmV4ZWN1dGVPcmRlci5wdXNoKGNvbW1hbmQpXG4gICAgICB9XG4gICAgfVxuICAgIGdldERlYnVnRGF0YSAoKSB7XG4gICAgICBjb25zb2xlLmxvZyh0aGlzLmV4ZWN1dGVPcmRlci5qb2luKCdcXG4nKSlcbiAgICB9XG4gICAgc3RvcEdhcmJhZ2VDb2xsZWN0b3IgKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICB0aGlzLmdjID0gZmFsc2VcbiAgICAgIHRoaXMuZ2NUaW1lb3V0ID0gLTFcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICBzZWxmLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgICB2YXIgdW5nYyAvKiA6QXJyYXk8U3RydWN0PiAqLyA9IHNlbGYuZ2MxLmNvbmNhdChzZWxmLmdjMilcbiAgICAgICAgICBzZWxmLmdjMSA9IFtdXG4gICAgICAgICAgc2VsZi5nYzIgPSBbXVxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdW5nYy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG9wID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKHVuZ2NbaV0pXG4gICAgICAgICAgICBpZiAob3AgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBkZWxldGUgb3AuZ2NcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9wKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfVxuICAgIC8qXG4gICAgICBUcnkgdG8gYWRkIHRvIEdDLlxuXG4gICAgICBUT0RPOiByZW5hbWUgdGhpcyBmdW5jdGlvblxuXG4gICAgICBSdWxlejpcbiAgICAgICogT25seSBnYyBpZiB0aGlzIHVzZXIgaXMgb25saW5lICYgZ2MgdHVybmVkIG9uXG4gICAgICAqIFRoZSBtb3N0IGxlZnQgZWxlbWVudCBpbiBhIGxpc3QgbXVzdCBub3QgYmUgZ2MnZC5cbiAgICAgICAgPT4gVGhlcmUgaXMgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIGxpc3RcblxuICAgICAgcmV0dXJucyB0cnVlIGlmZiBvcCB3YXMgYWRkZWQgdG8gR0NcbiAgICAqL1xuICAgICogYWRkVG9HYXJiYWdlQ29sbGVjdG9yIChvcCwgbGVmdCkge1xuICAgICAgaWYgKFxuICAgICAgICBvcC5nYyA9PSBudWxsICYmXG4gICAgICAgIG9wLmRlbGV0ZWQgPT09IHRydWUgJiZcbiAgICAgICAgdGhpcy5zdG9yZS5nYyAmJlxuICAgICAgICB0aGlzLnN0b3JlLnkuY29ubmVjdG9yLmlzU3luY2VkXG4gICAgICApIHtcbiAgICAgICAgdmFyIGdjID0gZmFsc2VcbiAgICAgICAgaWYgKGxlZnQgIT0gbnVsbCAmJiBsZWZ0LmRlbGV0ZWQgPT09IHRydWUpIHtcbiAgICAgICAgICBnYyA9IHRydWVcbiAgICAgICAgfSBlbHNlIGlmIChvcC5jb250ZW50ICE9IG51bGwgJiYgb3AuY29udGVudC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgb3AgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhblN0YXJ0KFtvcC5pZFswXSwgb3AuaWRbMV0gKyAxXSlcbiAgICAgICAgICBnYyA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoZ2MpIHtcbiAgICAgICAgICBvcC5nYyA9IHRydWVcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ob3ApXG4gICAgICAgICAgdGhpcy5zdG9yZS5xdWV1ZUdhcmJhZ2VDb2xsZWN0b3Iob3AuaWQpXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIHJlbW92ZUZyb21HYXJiYWdlQ29sbGVjdG9yIChvcCkge1xuICAgICAgZnVuY3Rpb24gZmlsdGVyIChvKSB7XG4gICAgICAgIHJldHVybiAhWS51dGlscy5jb21wYXJlSWRzKG8sIG9wLmlkKVxuICAgICAgfVxuICAgICAgdGhpcy5nYzEgPSB0aGlzLmdjMS5maWx0ZXIoZmlsdGVyKVxuICAgICAgdGhpcy5nYzIgPSB0aGlzLmdjMi5maWx0ZXIoZmlsdGVyKVxuICAgICAgZGVsZXRlIG9wLmdjXG4gICAgfVxuICAgIGRlc3Ryb3lUeXBlcyAoKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5pbml0aWFsaXplZFR5cGVzKSB7XG4gICAgICAgIHZhciB0eXBlID0gdGhpcy5pbml0aWFsaXplZFR5cGVzW2tleV1cbiAgICAgICAgaWYgKHR5cGUuX2Rlc3Ryb3kgIT0gbnVsbCkge1xuICAgICAgICAgIHR5cGUuX2Rlc3Ryb3koKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RoZSB0eXBlIHlvdSBpbmNsdWRlZCBkb2VzIG5vdCBwcm92aWRlIGRlc3Ryb3kgZnVuY3Rpb25hbGl0eSwgaXQgd2lsbCByZW1haW4gaW4gbWVtb3J5ICh1cGRhdGluZyB5b3VyIHBhY2thZ2VzIHdpbGwgaGVscCkuJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGRlc3Ryb3kgKCkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmdjSW50ZXJ2YWwpXG4gICAgICB0aGlzLmdjSW50ZXJ2YWwgPSBudWxsXG4gICAgICB0aGlzLnN0b3BSZXBhaXJDaGVjaygpXG4gICAgfVxuICAgIHNldFVzZXJJZCAodXNlcklkKSB7XG4gICAgICBpZiAoIXRoaXMudXNlcklkUHJvbWlzZS5pblByb2dyZXNzKSB7XG4gICAgICAgIHRoaXMudXNlcklkUHJvbWlzZS5pblByb2dyZXNzID0gdHJ1ZVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgICAgc2VsZi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgc2VsZi51c2VySWQgPSB1c2VySWRcbiAgICAgICAgICB2YXIgc3RhdGUgPSB5aWVsZCogdGhpcy5nZXRTdGF0ZSh1c2VySWQpXG4gICAgICAgICAgc2VsZi5vcENsb2NrID0gc3RhdGUuY2xvY2tcbiAgICAgICAgICBzZWxmLnVzZXJJZFByb21pc2UucmVzb2x2ZSh1c2VySWQpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy51c2VySWRQcm9taXNlXG4gICAgfVxuICAgIHdoZW5Vc2VySWRTZXQgKGYpIHtcbiAgICAgIHRoaXMudXNlcklkUHJvbWlzZS50aGVuKGYpXG4gICAgfVxuICAgIGdldE5leHRPcElkIChudW1iZXJPZklkcykge1xuICAgICAgaWYgKG51bWJlck9mSWRzID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdnZXROZXh0T3BJZCBleHBlY3RzIHRoZSBudW1iZXIgb2YgY3JlYXRlZCBpZHMgdG8gY3JlYXRlIScpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMudXNlcklkID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPcGVyYXRpb25TdG9yZSBub3QgeWV0IGluaXRpYWxpemVkIScpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaWQgPSBbdGhpcy51c2VySWQsIHRoaXMub3BDbG9ja11cbiAgICAgICAgdGhpcy5vcENsb2NrICs9IG51bWJlck9mSWRzXG4gICAgICAgIHJldHVybiBpZFxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgQXBwbHkgYSBsaXN0IG9mIG9wZXJhdGlvbnMuXG5cbiAgICAgICogd2Ugc2F2ZSBhIHRpbWVzdGFtcCwgYmVjYXVzZSB3ZSByZWNlaXZlZCBuZXcgb3BlcmF0aW9ucyB0aGF0IGNvdWxkIHJlc29sdmUgb3BzIGluIHRoaXMubGlzdGVuZXJzQnlJZCAoc2VlIHRoaXMuc3RhcnRSZXBhaXJDaGVjaylcbiAgICAgICogZ2V0IGEgdHJhbnNhY3Rpb25cbiAgICAgICogY2hlY2sgd2hldGhlciBhbGwgU3RydWN0LioucmVxdWlyZWRPcHMgYXJlIGluIHRoZSBPU1xuICAgICAgKiBjaGVjayBpZiBpdCBpcyBhbiBleHBlY3RlZCBvcCAob3RoZXJ3aXNlIHdhaXQgZm9yIGl0KVxuICAgICAgKiBjaGVjayBpZiB3YXMgZGVsZXRlZCwgYXBwbHkgYSBkZWxldGUgb3BlcmF0aW9uIGFmdGVyIG9wIHdhcyBhcHBsaWVkXG4gICAgKi9cbiAgICBhcHBseSAob3BzKSB7XG4gICAgICB0aGlzLm9wc1JlY2VpdmVkVGltZXN0YW1wID0gbmV3IERhdGUoKVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG8gPSBvcHNbaV1cbiAgICAgICAgaWYgKG8uaWQgPT0gbnVsbCB8fCBvLmlkWzBdICE9PSB0aGlzLnkuY29ubmVjdG9yLnVzZXJJZCkge1xuICAgICAgICAgIHZhciByZXF1aXJlZCA9IFkuU3RydWN0W28uc3RydWN0XS5yZXF1aXJlZE9wcyhvKVxuICAgICAgICAgIGlmIChvLnJlcXVpcmVzICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJlcXVpcmVkID0gcmVxdWlyZWQuY29uY2F0KG8ucmVxdWlyZXMpXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMud2hlbk9wZXJhdGlvbnNFeGlzdChyZXF1aXJlZCwgbylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgb3AgaXMgZXhlY3V0ZWQgYXMgc29vbiBhcyBldmVyeSBvcGVyYXRpb24gcmVxdWVzdGVkIGlzIGF2YWlsYWJsZS5cbiAgICAgIE5vdGUgdGhhdCBUcmFuc2FjdGlvbiBjYW4gKGFuZCBzaG91bGQpIGJ1ZmZlciByZXF1ZXN0cy5cbiAgICAqL1xuICAgIHdoZW5PcGVyYXRpb25zRXhpc3QgKGlkcywgb3ApIHtcbiAgICAgIGlmIChpZHMubGVuZ3RoID4gMCkge1xuICAgICAgICBsZXQgbGlzdGVuZXIgPSB7XG4gICAgICAgICAgb3A6IG9wLFxuICAgICAgICAgIG1pc3Npbmc6IGlkcy5sZW5ndGhcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbGV0IGlkID0gaWRzW2ldXG4gICAgICAgICAgbGV0IHNpZCA9IEpTT04uc3RyaW5naWZ5KGlkKVxuICAgICAgICAgIGxldCBsID0gdGhpcy5saXN0ZW5lcnNCeUlkW3NpZF1cbiAgICAgICAgICBpZiAobCA9PSBudWxsKSB7XG4gICAgICAgICAgICBsID0gW11cbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzQnlJZFtzaWRdID0gbFxuICAgICAgICAgIH1cbiAgICAgICAgICBsLnB1c2gobGlzdGVuZXIpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3cucHVzaCh7XG4gICAgICAgICAgb3A6IG9wXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLmxpc3RlbmVyc0J5SWRSZXF1ZXN0UGVuZGluZykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgdGhpcy5saXN0ZW5lcnNCeUlkUmVxdWVzdFBlbmRpbmcgPSB0cnVlXG4gICAgICB2YXIgc3RvcmUgPSB0aGlzXG5cbiAgICAgIHRoaXMucmVxdWVzdFRyYW5zYWN0aW9uKGZ1bmN0aW9uICogKCkge1xuICAgICAgICB2YXIgZXhlTm93ID0gc3RvcmUubGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3dcbiAgICAgICAgc3RvcmUubGlzdGVuZXJzQnlJZEV4ZWN1dGVOb3cgPSBbXVxuXG4gICAgICAgIHZhciBscyA9IHN0b3JlLmxpc3RlbmVyc0J5SWRcbiAgICAgICAgc3RvcmUubGlzdGVuZXJzQnlJZCA9IHt9XG5cbiAgICAgICAgc3RvcmUubGlzdGVuZXJzQnlJZFJlcXVlc3RQZW5kaW5nID0gZmFsc2VcblxuICAgICAgICBmb3IgKGxldCBrZXkgPSAwOyBrZXkgPCBleGVOb3cubGVuZ3RoOyBrZXkrKykge1xuICAgICAgICAgIGxldCBvID0gZXhlTm93W2tleV0ub3BcbiAgICAgICAgICB5aWVsZCogc3RvcmUudHJ5RXhlY3V0ZS5jYWxsKHRoaXMsIG8pXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBzaWQgaW4gbHMpIHtcbiAgICAgICAgICB2YXIgbCA9IGxzW3NpZF1cbiAgICAgICAgICB2YXIgaWQgPSBKU09OLnBhcnNlKHNpZClcbiAgICAgICAgICB2YXIgb3BcbiAgICAgICAgICBpZiAodHlwZW9mIGlkWzFdID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgb3AgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oaWQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKGlkKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3AgPT0gbnVsbCkge1xuICAgICAgICAgICAgc3RvcmUubGlzdGVuZXJzQnlJZFtzaWRdID0gbFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgbGV0IGxpc3RlbmVyID0gbFtpXVxuICAgICAgICAgICAgICBsZXQgbyA9IGxpc3RlbmVyLm9wXG4gICAgICAgICAgICAgIGlmICgtLWxpc3RlbmVyLm1pc3NpbmcgPT09IDApIHtcbiAgICAgICAgICAgICAgICB5aWVsZCogc3RvcmUudHJ5RXhlY3V0ZS5jYWxsKHRoaXMsIG8pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIC8qXG4gICAgICBBY3R1YWxseSBleGVjdXRlIGFuIG9wZXJhdGlvbiwgd2hlbiBhbGwgZXhwZWN0ZWQgb3BlcmF0aW9ucyBhcmUgYXZhaWxhYmxlLlxuICAgICovXG4gICAgLyogOjogLy8gVE9ETzogdGhpcyBiZWxvbmdzIHNvbWVob3cgdG8gdHJhbnNhY3Rpb25cbiAgICBzdG9yZTogT2JqZWN0O1xuICAgIGdldE9wZXJhdGlvbjogYW55O1xuICAgIGlzR2FyYmFnZUNvbGxlY3RlZDogYW55O1xuICAgIGFkZE9wZXJhdGlvbjogYW55O1xuICAgIHdoZW5PcGVyYXRpb25zRXhpc3Q6IGFueTtcbiAgICAqL1xuICAgICogdHJ5RXhlY3V0ZSAob3ApIHtcbiAgICAgIHRoaXMuc3RvcmUuYWRkVG9EZWJ1ZygneWllbGQqIHRoaXMuc3RvcmUudHJ5RXhlY3V0ZS5jYWxsKHRoaXMsICcsIEpTT04uc3RyaW5naWZ5KG9wKSwgJyknKVxuICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgeWllbGQqIFkuU3RydWN0LkRlbGV0ZS5leGVjdXRlLmNhbGwodGhpcywgb3ApXG4gICAgICAgIC8vIHRoaXMgaXMgbm93IGNhbGxlZCBpbiBUcmFuc2FjdGlvbi5kZWxldGVPcGVyYXRpb24hXG4gICAgICAgIC8vIHlpZWxkKiB0aGlzLnN0b3JlLm9wZXJhdGlvbkFkZGVkKHRoaXMsIG9wKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgdGhpcyBvcCB3YXMgZGVmaW5lZFxuICAgICAgICB2YXIgZGVmaW5lZCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihvcC5pZClcbiAgICAgICAgd2hpbGUgKGRlZmluZWQgIT0gbnVsbCAmJiBkZWZpbmVkLmNvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHRoaXMgb3AgaGFzIGEgbG9uZ2VyIGNvbnRlbnQgaW4gdGhlIGNhc2UgaXQgaXMgZGVmaW5lZFxuICAgICAgICAgIGlmIChkZWZpbmVkLmlkWzFdICsgZGVmaW5lZC5jb250ZW50Lmxlbmd0aCA8IG9wLmlkWzFdICsgb3AuY29udGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBvdmVybGFwU2l6ZSA9IGRlZmluZWQuY29udGVudC5sZW5ndGggLSAob3AuaWRbMV0gLSBkZWZpbmVkLmlkWzFdKVxuICAgICAgICAgICAgb3AuY29udGVudC5zcGxpY2UoMCwgb3ZlcmxhcFNpemUpXG4gICAgICAgICAgICBvcC5pZCA9IFtvcC5pZFswXSwgb3AuaWRbMV0gKyBvdmVybGFwU2l6ZV1cbiAgICAgICAgICAgIG9wLmxlZnQgPSBZLnV0aWxzLmdldExhc3RJZChkZWZpbmVkKVxuICAgICAgICAgICAgb3Aub3JpZ2luID0gb3AubGVmdFxuICAgICAgICAgICAgZGVmaW5lZCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5pZCkgLy8gZ2V0T3BlcmF0aW9uIHN1ZmZpY2VzIGhlcmVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlZmluZWQgPT0gbnVsbCkge1xuICAgICAgICAgIHZhciBvcGlkID0gb3AuaWRcbiAgICAgICAgICB2YXIgaXNHYXJiYWdlQ29sbGVjdGVkID0geWllbGQqIHRoaXMuaXNHYXJiYWdlQ29sbGVjdGVkKG9waWQpXG4gICAgICAgICAgaWYgKCFpc0dhcmJhZ2VDb2xsZWN0ZWQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IHJlZHVjZSBudW1iZXIgb2YgZ2V0IC8gcHV0IGNhbGxzIGZvciBvcCAuLlxuICAgICAgICAgICAgeWllbGQqIFkuU3RydWN0W29wLnN0cnVjdF0uZXhlY3V0ZS5jYWxsKHRoaXMsIG9wKVxuICAgICAgICAgICAgeWllbGQqIHRoaXMuYWRkT3BlcmF0aW9uKG9wKVxuICAgICAgICAgICAgeWllbGQqIHRoaXMuc3RvcmUub3BlcmF0aW9uQWRkZWQodGhpcywgb3ApXG4gICAgICAgICAgICAvLyBvcGVyYXRpb25BZGRlZCBjYW4gY2hhbmdlIG9wLi5cbiAgICAgICAgICAgIG9wID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG9waWQpXG4gICAgICAgICAgICAvLyBpZiBpbnNlcnRpb24sIHRyeSB0byBjb21iaW5lIHdpdGggbGVmdFxuICAgICAgICAgICAgeWllbGQqIHRoaXMudHJ5Q29tYmluZVdpdGhMZWZ0KG9wKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAqIENhbGxlZCBieSBhIHRyYW5zYWN0aW9uIHdoZW4gYW4gb3BlcmF0aW9uIGlzIGFkZGVkLlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgZXNwZWNpYWxseSBpbXBvcnRhbnQgZm9yIHktaW5kZXhlZGRiLCB3aGVyZSBzZXZlcmFsIGluc3RhbmNlcyBtYXkgc2hhcmUgYSBzaW5nbGUgZGF0YWJhc2UuXG4gICAgICogRXZlcnkgdGltZSBhbiBvcGVyYXRpb24gaXMgY3JlYXRlZCBieSBvbmUgaW5zdGFuY2UsIGl0IGlzIHNlbmQgdG8gYWxsIG90aGVyIGluc3RhbmNlcyBhbmQgb3BlcmF0aW9uQWRkZWQgaXMgY2FsbGVkXG4gICAgICpcbiAgICAgKiBJZiBpdCdzIG5vdCBhIERlbGV0ZSBvcGVyYXRpb246XG4gICAgICogICAqIENoZWNrcyBpZiBhbm90aGVyIG9wZXJhdGlvbiBpcyBleGVjdXRhYmxlIChsaXN0ZW5lcnNCeUlkKVxuICAgICAqICAgKiBVcGRhdGUgc3RhdGUsIGlmIHBvc3NpYmxlXG4gICAgICpcbiAgICAgKiBBbHdheXM6XG4gICAgICogICAqIENhbGwgdHlwZVxuICAgICAqL1xuICAgICogb3BlcmF0aW9uQWRkZWQgKHRyYW5zYWN0aW9uLCBvcCkge1xuICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0aGlzLmluaXRpYWxpemVkVHlwZXNbSlNPTi5zdHJpbmdpZnkob3AudGFyZ2V0UGFyZW50KV1cbiAgICAgICAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgICAgICAgIHlpZWxkKiB0eXBlLl9jaGFuZ2VkKHRyYW5zYWN0aW9uLCBvcClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaW5jcmVhc2UgU1NcbiAgICAgICAgeWllbGQqIHRyYW5zYWN0aW9uLnVwZGF0ZVN0YXRlKG9wLmlkWzBdKVxuICAgICAgICB2YXIgb3BMZW4gPSBvcC5jb250ZW50ICE9IG51bGwgPyBvcC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcExlbjsgaSsrKSB7XG4gICAgICAgICAgLy8gbm90aWZ5IHdoZW5PcGVyYXRpb24gbGlzdGVuZXJzIChieSBpZClcbiAgICAgICAgICB2YXIgc2lkID0gSlNPTi5zdHJpbmdpZnkoW29wLmlkWzBdLCBvcC5pZFsxXSArIGldKVxuICAgICAgICAgIHZhciBsID0gdGhpcy5saXN0ZW5lcnNCeUlkW3NpZF1cbiAgICAgICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNCeUlkW3NpZF1cbiAgICAgICAgICBpZiAobCAhPSBudWxsKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbCkge1xuICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIgPSBsW2tleV1cbiAgICAgICAgICAgICAgaWYgKC0tbGlzdGVuZXIubWlzc2luZyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2hlbk9wZXJhdGlvbnNFeGlzdChbXSwgbGlzdGVuZXIub3ApXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHQgPSB0aGlzLmluaXRpYWxpemVkVHlwZXNbSlNPTi5zdHJpbmdpZnkob3AucGFyZW50KV1cblxuICAgICAgICAvLyBpZiBwYXJlbnQgaXMgZGVsZXRlZCwgbWFyayBhcyBnYydkIGFuZCByZXR1cm5cbiAgICAgICAgaWYgKG9wLnBhcmVudCAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIHBhcmVudElzRGVsZXRlZCA9IHlpZWxkKiB0cmFuc2FjdGlvbi5pc0RlbGV0ZWQob3AucGFyZW50KVxuICAgICAgICAgIGlmIChwYXJlbnRJc0RlbGV0ZWQpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0cmFuc2FjdGlvbi5kZWxldGVMaXN0KG9wLmlkKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm90aWZ5IHBhcmVudCwgaWYgaXQgd2FzIGluc3RhbmNpYXRlZCBhcyBhIGN1c3RvbSB0eXBlXG4gICAgICAgIGlmICh0ICE9IG51bGwpIHtcbiAgICAgICAgICBsZXQgbyA9IFkudXRpbHMuY29weU9wZXJhdGlvbihvcClcbiAgICAgICAgICB5aWVsZCogdC5fY2hhbmdlZCh0cmFuc2FjdGlvbiwgbylcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW9wLmRlbGV0ZWQpIHtcbiAgICAgICAgICAvLyBEZWxldGUgaWYgRFMgc2F5cyB0aGlzIGlzIGFjdHVhbGx5IGRlbGV0ZWRcbiAgICAgICAgICB2YXIgbGVuID0gb3AuY29udGVudCAhPSBudWxsID8gb3AuY29udGVudC5sZW5ndGggOiAxXG4gICAgICAgICAgdmFyIHN0YXJ0SWQgPSBvcC5pZCAvLyBZb3UgbXVzdCBub3QgdXNlIG9wLmlkIGluIHRoZSBmb2xsb3dpbmcgbG9vcCwgYmVjYXVzZSBvcCB3aWxsIGNoYW5nZSB3aGVuIGRlbGV0ZWRcbiAgICAgICAgICAgIC8vIFRPRE86ICEhIGNvbnNvbGUubG9nKCdUT0RPOiBjaGFuZ2UgdGhpcyBiZWZvcmUgY29tbWl0aW5nJylcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgaWQgPSBbc3RhcnRJZFswXSwgc3RhcnRJZFsxXSArIGldXG4gICAgICAgICAgICB2YXIgb3BJc0RlbGV0ZWQgPSB5aWVsZCogdHJhbnNhY3Rpb24uaXNEZWxldGVkKGlkKVxuICAgICAgICAgICAgaWYgKG9wSXNEZWxldGVkKSB7XG4gICAgICAgICAgICAgIHZhciBkZWxvcCA9IHtcbiAgICAgICAgICAgICAgICBzdHJ1Y3Q6ICdEZWxldGUnLFxuICAgICAgICAgICAgICAgIHRhcmdldDogaWRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy50cnlFeGVjdXRlLmNhbGwodHJhbnNhY3Rpb24sIGRlbG9wKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB3aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQgKCkge1xuICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25JblByb2dyZXNzKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9uc0ZpbmlzaGVkID09IG51bGwpIHtcbiAgICAgICAgICB2YXIgcmVzb2x2ZVxuICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIHJlc29sdmUgPSByXG4gICAgICAgICAgfSlcbiAgICAgICAgICB0aGlzLnRyYW5zYWN0aW9uc0ZpbmlzaGVkID0ge1xuICAgICAgICAgICAgcmVzb2x2ZTogcmVzb2x2ZSxcbiAgICAgICAgICAgIHByb21pc2U6IHByb21pc2VcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNhY3Rpb25zRmluaXNoZWQucHJvbWlzZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICB9XG4gICAgfVxuICAgIC8vIENoZWNrIGlmIHRoZXJlIGlzIGFub3RoZXIgdHJhbnNhY3Rpb24gcmVxdWVzdC5cbiAgICAvLyAqIHRoZSBsYXN0IHRyYW5zYWN0aW9uIGlzIGFsd2F5cyBhIGZsdXNoIDopXG4gICAgZ2V0TmV4dFJlcXVlc3QgKCkge1xuICAgICAgaWYgKHRoaXMud2FpdGluZ1RyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25Jc0ZsdXNoZWQpIHtcbiAgICAgICAgICB0aGlzLnRyYW5zYWN0aW9uSW5Qcm9ncmVzcyA9IGZhbHNlXG4gICAgICAgICAgdGhpcy50cmFuc2FjdGlvbklzRmx1c2hlZCA9IGZhbHNlXG4gICAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25zRmluaXNoZWQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy50cmFuc2FjdGlvbnNGaW5pc2hlZC5yZXNvbHZlKClcbiAgICAgICAgICAgIHRoaXMudHJhbnNhY3Rpb25zRmluaXNoZWQgPSBudWxsXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy50cmFuc2FjdGlvbklzRmx1c2hlZCA9IHRydWVcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uSXNGbHVzaGVkID0gZmFsc2VcbiAgICAgICAgcmV0dXJuIHRoaXMud2FpdGluZ1RyYW5zYWN0aW9ucy5zaGlmdCgpXG4gICAgICB9XG4gICAgfVxuICAgIHJlcXVlc3RUcmFuc2FjdGlvbiAobWFrZUdlbi8qIDphbnkgKi8sIGNhbGxJbW1lZGlhdGVseSkge1xuICAgICAgdGhpcy53YWl0aW5nVHJhbnNhY3Rpb25zLnB1c2gobWFrZUdlbilcbiAgICAgIGlmICghdGhpcy50cmFuc2FjdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgICAgdGhpcy50cmFuc2FjdGlvbkluUHJvZ3Jlc3MgPSB0cnVlXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHRoaXMudHJhbnNhY3QodGhpcy5nZXROZXh0UmVxdWVzdCgpKVxuICAgICAgICB9LCAwKVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgR2V0IGEgY3JlYXRlZC9pbml0aWFsaXplZCB0eXBlLlxuICAgICovXG4gICAgZ2V0VHlwZSAoaWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmluaXRpYWxpemVkVHlwZXNbSlNPTi5zdHJpbmdpZnkoaWQpXVxuICAgIH1cbiAgICAvKlxuICAgICAgSW5pdCB0eXBlLiBUaGlzIGlzIGNhbGxlZCB3aGVuIGEgcmVtb3RlIG9wZXJhdGlvbiBpcyByZXRyaWV2ZWQsIGFuZCB0cmFuc2Zvcm1lZCB0byBhIHR5cGVcbiAgICAgIFRPRE86IGRlbGV0ZSB0eXBlIGZyb20gc3RvcmUuaW5pdGlhbGl6ZWRUeXBlc1tpZF0gd2hlbiBjb3JyZXNwb25kaW5nIGlkIHdhcyBkZWxldGVkIVxuICAgICovXG4gICAgKiBpbml0VHlwZSAoaWQsIGFyZ3MpIHtcbiAgICAgIHZhciBzaWQgPSBKU09OLnN0cmluZ2lmeShpZClcbiAgICAgIHZhciB0ID0gdGhpcy5zdG9yZS5pbml0aWFsaXplZFR5cGVzW3NpZF1cbiAgICAgIGlmICh0ID09IG51bGwpIHtcbiAgICAgICAgdmFyIG9wLyogOk1hcFN0cnVjdCB8IExpc3RTdHJ1Y3QgKi8gPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oaWQpXG4gICAgICAgIGlmIChvcCAhPSBudWxsKSB7XG4gICAgICAgICAgdCA9IHlpZWxkKiBZW29wLnR5cGVdLnR5cGVEZWZpbml0aW9uLmluaXRUeXBlLmNhbGwodGhpcywgdGhpcy5zdG9yZSwgb3AsIGFyZ3MpXG4gICAgICAgICAgdGhpcy5zdG9yZS5pbml0aWFsaXplZFR5cGVzW3NpZF0gPSB0XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0XG4gICAgfVxuICAgIC8qXG4gICAgIENyZWF0ZSB0eXBlLiBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBsb2NhbCB1c2VyIGNyZWF0ZXMgYSB0eXBlICh3aGljaCBpcyBhIHN5bmNocm9ub3VzIGFjdGlvbilcbiAgICAqL1xuICAgIGNyZWF0ZVR5cGUgKHR5cGVkZWZpbml0aW9uLCBpZCkge1xuICAgICAgdmFyIHN0cnVjdG5hbWUgPSB0eXBlZGVmaW5pdGlvblswXS5zdHJ1Y3RcbiAgICAgIGlkID0gaWQgfHwgdGhpcy5nZXROZXh0T3BJZCgxKVxuICAgICAgdmFyIG9wID0gWS5TdHJ1Y3Rbc3RydWN0bmFtZV0uY3JlYXRlKGlkKVxuICAgICAgb3AudHlwZSA9IHR5cGVkZWZpbml0aW9uWzBdLm5hbWVcblxuICAgICAgdGhpcy5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiAoKSB7XG4gICAgICAgIGlmIChvcC5pZFswXSA9PT0gJ18nKSB7XG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9wKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkKiB0aGlzLmFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMoW29wXSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIHZhciB0ID0gWVtvcC50eXBlXS50eXBlRGVmaW5pdGlvbi5jcmVhdGVUeXBlKHRoaXMsIG9wLCB0eXBlZGVmaW5pdGlvblsxXSlcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZWRUeXBlc1tKU09OLnN0cmluZ2lmeShvcC5pZCldID0gdFxuICAgICAgcmV0dXJuIHRcbiAgICB9XG4gIH1cbiAgWS5BYnN0cmFjdERhdGFiYXNlID0gQWJzdHJhY3REYXRhYmFzZVxufVxuIiwiLyogQGZsb3cgKi9cbid1c2Ugc3RyaWN0J1xuXG4vKlxuIEFuIG9wZXJhdGlvbiBhbHNvIGRlZmluZXMgdGhlIHN0cnVjdHVyZSBvZiBhIHR5cGUuIFRoaXMgaXMgd2h5IG9wZXJhdGlvbiBhbmRcbiBzdHJ1Y3R1cmUgYXJlIHVzZWQgaW50ZXJjaGFuZ2VhYmx5IGhlcmUuXG5cbiBJdCBtdXN0IGJlIG9mIHRoZSB0eXBlIE9iamVjdC4gSSBob3BlIHRvIGFjaGlldmUgc29tZSBwZXJmb3JtYW5jZVxuIGltcHJvdmVtZW50cyB3aGVuIHdvcmtpbmcgb24gZGF0YWJhc2VzIHRoYXQgc3VwcG9ydCB0aGUganNvbiBmb3JtYXQuXG5cbiBBbiBvcGVyYXRpb24gbXVzdCBoYXZlIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcblxuICogZW5jb2RlXG4gICAgIC0gRW5jb2RlIHRoZSBzdHJ1Y3R1cmUgaW4gYSByZWFkYWJsZSBmb3JtYXQgKHByZWZlcmFibHkgc3RyaW5nLSB0b2RvKVxuICogZGVjb2RlICh0b2RvKVxuICAgICAtIGRlY29kZSBzdHJ1Y3R1cmUgdG8ganNvblxuICogZXhlY3V0ZVxuICAgICAtIEV4ZWN1dGUgdGhlIHNlbWFudGljcyBvZiBhbiBvcGVyYXRpb24uXG4gKiByZXF1aXJlZE9wc1xuICAgICAtIE9wZXJhdGlvbnMgdGhhdCBhcmUgcmVxdWlyZWQgdG8gZXhlY3V0ZSB0aGlzIG9wZXJhdGlvbi5cbiovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChZLyogOmFueSAqLykge1xuICB2YXIgU3RydWN0ID0ge1xuICAgIC8qIFRoaXMgaXMgdGhlIG9ubHkgb3BlcmF0aW9uIHRoYXQgaXMgYWN0dWFsbHkgbm90IGEgc3RydWN0dXJlLCBiZWNhdXNlXG4gICAgaXQgaXMgbm90IHN0b3JlZCBpbiB0aGUgT1MuIFRoaXMgaXMgd2h5IGl0IF9kb2VzIG5vdF8gaGF2ZSBhbiBpZFxuXG4gICAgb3AgPSB7XG4gICAgICB0YXJnZXQ6IElkXG4gICAgfVxuICAgICovXG4gICAgRGVsZXRlOiB7XG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRhcmdldDogb3AudGFyZ2V0LFxuICAgICAgICAgIGxlbmd0aDogb3AubGVuZ3RoIHx8IDAsXG4gICAgICAgICAgc3RydWN0OiAnRGVsZXRlJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcmVxdWlyZWRPcHM6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICByZXR1cm4gW10gLy8gW29wLnRhcmdldF1cbiAgICAgIH0sXG4gICAgICBleGVjdXRlOiBmdW5jdGlvbiAqIChvcCkge1xuICAgICAgICByZXR1cm4geWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKG9wLnRhcmdldCwgb3AubGVuZ3RoIHx8IDEpXG4gICAgICB9XG4gICAgfSxcbiAgICBJbnNlcnQ6IHtcbiAgICAgIC8qIHtcbiAgICAgICAgICBjb250ZW50OiBbYW55XSxcbiAgICAgICAgICBvcENvbnRlbnQ6IElkLFxuICAgICAgICAgIGlkOiBJZCxcbiAgICAgICAgICBsZWZ0OiBJZCxcbiAgICAgICAgICBvcmlnaW46IElkLFxuICAgICAgICAgIHJpZ2h0OiBJZCxcbiAgICAgICAgICBwYXJlbnQ6IElkLFxuICAgICAgICAgIHBhcmVudFN1Yjogc3RyaW5nIChvcHRpb25hbCksIC8vIGNoaWxkIG9mIE1hcCB0eXBlXG4gICAgICAgIH1cbiAgICAgICovXG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uIChvcC8qIDpJbnNlcnRpb24gKi8pIC8qIDpJbnNlcnRpb24gKi8ge1xuICAgICAgICAvLyBUT0RPOiB5b3UgY291bGQgbm90IHNlbmQgdGhlIFwibGVmdFwiIHByb3BlcnR5LCB0aGVuIHlvdSBhbHNvIGhhdmUgdG9cbiAgICAgICAgLy8gXCJvcC5sZWZ0ID0gbnVsbFwiIGluICRleGVjdXRlIG9yICRkZWNvZGVcbiAgICAgICAgdmFyIGUvKiA6YW55ICovID0ge1xuICAgICAgICAgIGlkOiBvcC5pZCxcbiAgICAgICAgICBsZWZ0OiBvcC5sZWZ0LFxuICAgICAgICAgIHJpZ2h0OiBvcC5yaWdodCxcbiAgICAgICAgICBvcmlnaW46IG9wLm9yaWdpbixcbiAgICAgICAgICBwYXJlbnQ6IG9wLnBhcmVudCxcbiAgICAgICAgICBzdHJ1Y3Q6IG9wLnN0cnVjdFxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5wYXJlbnRTdWIgIT0gbnVsbCkge1xuICAgICAgICAgIGUucGFyZW50U3ViID0gb3AucGFyZW50U3ViXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmhhc093blByb3BlcnR5KCdvcENvbnRlbnQnKSkge1xuICAgICAgICAgIGUub3BDb250ZW50ID0gb3Aub3BDb250ZW50XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZS5jb250ZW50ID0gb3AuY29udGVudC5zbGljZSgpXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZVxuICAgICAgfSxcbiAgICAgIHJlcXVpcmVkT3BzOiBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgdmFyIGlkcyA9IFtdXG4gICAgICAgIGlmIChvcC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICBpZHMucHVzaChvcC5sZWZ0KVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgaWRzLnB1c2gob3AucmlnaHQpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLm9yaWdpbiAhPSBudWxsICYmICFZLnV0aWxzLmNvbXBhcmVJZHMob3AubGVmdCwgb3Aub3JpZ2luKSkge1xuICAgICAgICAgIGlkcy5wdXNoKG9wLm9yaWdpbilcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiAob3AucmlnaHQgPT0gbnVsbCAmJiBvcC5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgaWRzLnB1c2gob3AucGFyZW50KVxuXG4gICAgICAgIGlmIChvcC5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIGlkcy5wdXNoKG9wLm9wQ29udGVudClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaWRzXG4gICAgICB9LFxuICAgICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgaWYgKG9wLmxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiAwXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGQgPSAwXG4gICAgICAgICAgdmFyIG8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24ob3AubGVmdClcbiAgICAgICAgICB3aGlsZSAoIVkudXRpbHMubWF0Y2hlc0lkKG8sIG9wLm9yaWdpbikpIHtcbiAgICAgICAgICAgIGQrK1xuICAgICAgICAgICAgaWYgKG8ubGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG8ubGVmdClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGRcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIC8qXG4gICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxuICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAqL1xuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgdmFyIGkgLy8gbG9vcCBjb3VudGVyXG5cbiAgICAgICAgLy8gZHVyaW5nIHRoaXMgZnVuY3Rpb24gc29tZSBvcHMgbWF5IGdldCBzcGxpdCBpbnRvIHR3byBwaWVjZXMgKGUuZy4gd2l0aCBnZXRJbnNlcnRpb25DbGVhbkVuZClcbiAgICAgICAgLy8gV2UgdHJ5IHRvIG1lcmdlIHRoZW0gbGF0ZXIsIGlmIHBvc3NpYmxlXG4gICAgICAgIHZhciB0cnlUb1JlbWVyZ2VMYXRlciA9IFtdXG5cbiAgICAgICAgaWYgKG9wLm9yaWdpbiAhPSBudWxsKSB7IC8vIFRPRE86ICE9PSBpbnN0ZWFkIG9mICE9XG4gICAgICAgICAgLy8gd2Ugc2F2ZSBpbiBvcmlnaW4gdGhhdCBvcCBvcmlnaW5hdGVzIGluIGl0XG4gICAgICAgICAgLy8gd2UgbmVlZCB0aGF0IGxhdGVyIHdoZW4gd2UgZXZlbnR1YWxseSBnYXJiYWdlIGNvbGxlY3Qgb3JpZ2luIChzZWUgdHJhbnNhY3Rpb24pXG4gICAgICAgICAgdmFyIG9yaWdpbiA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKG9wLm9yaWdpbilcbiAgICAgICAgICBpZiAob3JpZ2luLm9yaWdpbk9mID09IG51bGwpIHtcbiAgICAgICAgICAgIG9yaWdpbi5vcmlnaW5PZiA9IFtdXG4gICAgICAgICAgfVxuICAgICAgICAgIG9yaWdpbi5vcmlnaW5PZi5wdXNoKG9wLmlkKVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcmlnaW4pXG4gICAgICAgICAgaWYgKG9yaWdpbi5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0cnlUb1JlbWVyZ2VMYXRlci5wdXNoKG9yaWdpbi5yaWdodClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRpc3RhbmNlVG9PcmlnaW4gPSBpID0geWllbGQqIFN0cnVjdC5JbnNlcnQuZ2V0RGlzdGFuY2VUb09yaWdpbi5jYWxsKHRoaXMsIG9wKSAvLyBtb3N0IGNhc2VzOiAwIChzdGFydHMgZnJvbSAwKVxuXG4gICAgICAgIC8vIG5vdyB3ZSBiZWdpbiB0byBpbnNlcnQgb3AgaW4gdGhlIGxpc3Qgb2YgaW5zZXJ0aW9ucy4uXG4gICAgICAgIHZhciBvXG4gICAgICAgIHZhciBwYXJlbnRcbiAgICAgICAgdmFyIHN0YXJ0XG5cbiAgICAgICAgLy8gZmluZCBvLiBvIGlzIHRoZSBmaXJzdCBjb25mbGljdGluZyBvcGVyYXRpb25cbiAgICAgICAgaWYgKG9wLmxlZnQgIT0gbnVsbCkge1xuICAgICAgICAgIG8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChvcC5sZWZ0KVxuICAgICAgICAgIGlmICghWS51dGlscy5jb21wYXJlSWRzKG9wLmxlZnQsIG9wLm9yaWdpbikgJiYgby5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICAvLyBvbmx5IGlmIG5vdCBhZGRlZCBwcmV2aW91c2x5XG4gICAgICAgICAgICB0cnlUb1JlbWVyZ2VMYXRlci5wdXNoKG8ucmlnaHQpXG4gICAgICAgICAgfVxuICAgICAgICAgIG8gPSAoby5yaWdodCA9PSBudWxsKSA/IG51bGwgOiB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oby5yaWdodClcbiAgICAgICAgfSBlbHNlIHsgLy8gbGVmdCA9PSBudWxsXG4gICAgICAgICAgcGFyZW50ID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG9wLnBhcmVudClcbiAgICAgICAgICBsZXQgc3RhcnRJZCA9IG9wLnBhcmVudFN1YiA/IHBhcmVudC5tYXBbb3AucGFyZW50U3ViXSA6IHBhcmVudC5zdGFydFxuICAgICAgICAgIHN0YXJ0ID0gc3RhcnRJZCA9PSBudWxsID8gbnVsbCA6IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihzdGFydElkKVxuICAgICAgICAgIG8gPSBzdGFydFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIHNwbGl0IG9wLnJpZ2h0IGlmIG5lY2Vzc2FyeSAoYWxzbyBhZGQgdG8gdHJ5Q29tYmluZVdpdGhMZWZ0KVxuICAgICAgICBpZiAob3AucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgIHRyeVRvUmVtZXJnZUxhdGVyLnB1c2gob3AucmlnaHQpXG4gICAgICAgICAgeWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydChvcC5yaWdodClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhhbmRsZSBjb25mbGljdHNcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBpZiAobyAhPSBudWxsICYmICFZLnV0aWxzLmNvbXBhcmVJZHMoby5pZCwgb3AucmlnaHQpKSB7XG4gICAgICAgICAgICB2YXIgb09yaWdpbkRpc3RhbmNlID0geWllbGQqIFN0cnVjdC5JbnNlcnQuZ2V0RGlzdGFuY2VUb09yaWdpbi5jYWxsKHRoaXMsIG8pXG4gICAgICAgICAgICBpZiAob09yaWdpbkRpc3RhbmNlID09PSBpKSB7XG4gICAgICAgICAgICAgIC8vIGNhc2UgMVxuICAgICAgICAgICAgICBpZiAoby5pZFswXSA8IG9wLmlkWzBdKSB7XG4gICAgICAgICAgICAgICAgb3AubGVmdCA9IFkudXRpbHMuZ2V0TGFzdElkKG8pXG4gICAgICAgICAgICAgICAgZGlzdGFuY2VUb09yaWdpbiA9IGkgKyAxIC8vIGp1c3QgaWdub3JlIG8uY29udGVudC5sZW5ndGgsIGRvZXNuJ3QgbWFrZSBhIGRpZmZlcmVuY2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChvT3JpZ2luRGlzdGFuY2UgPCBpKSB7XG4gICAgICAgICAgICAgIC8vIGNhc2UgMlxuICAgICAgICAgICAgICBpZiAoaSAtIGRpc3RhbmNlVG9PcmlnaW4gPD0gb09yaWdpbkRpc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgb3AubGVmdCA9IFkudXRpbHMuZ2V0TGFzdElkKG8pXG4gICAgICAgICAgICAgICAgZGlzdGFuY2VUb09yaWdpbiA9IGkgKyAxIC8vIGp1c3QgaWdub3JlIG8uY29udGVudC5sZW5ndGgsIGRvZXNuJ3QgbWFrZSBhIGRpZmZlcmVuY2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgaWYgKG8ucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG8ucmlnaHQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlY29ubmVjdC4uXG4gICAgICAgIHZhciBsZWZ0ID0gbnVsbFxuICAgICAgICB2YXIgcmlnaHQgPSBudWxsXG4gICAgICAgIGlmIChwYXJlbnQgPT0gbnVsbCkge1xuICAgICAgICAgIHBhcmVudCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5wYXJlbnQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWNvbm5lY3QgbGVmdCBhbmQgc2V0IHJpZ2h0IG9mIG9wXG4gICAgICAgIGlmIChvcC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICBsZWZ0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG9wLmxlZnQpXG4gICAgICAgICAgLy8gbGluayBsZWZ0XG4gICAgICAgICAgb3AucmlnaHQgPSBsZWZ0LnJpZ2h0XG4gICAgICAgICAgbGVmdC5yaWdodCA9IG9wLmlkXG5cbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24obGVmdClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzZXQgb3AucmlnaHQgZnJvbSBwYXJlbnQsIGlmIG5lY2Vzc2FyeVxuICAgICAgICAgIG9wLnJpZ2h0ID0gb3AucGFyZW50U3ViID8gcGFyZW50Lm1hcFtvcC5wYXJlbnRTdWJdIHx8IG51bGwgOiBwYXJlbnQuc3RhcnRcbiAgICAgICAgfVxuICAgICAgICAvLyByZWNvbm5lY3QgcmlnaHRcbiAgICAgICAgaWYgKG9wLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAvLyBUT0RPOiB3YW5uYSBjb25uZWN0IHJpZ2h0IHRvbz9cbiAgICAgICAgICByaWdodCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5yaWdodClcbiAgICAgICAgICByaWdodC5sZWZ0ID0gWS51dGlscy5nZXRMYXN0SWQob3ApXG5cbiAgICAgICAgICAvLyBpZiByaWdodCBleGlzdHMsIGFuZCBpdCBpcyBzdXBwb3NlZCB0byBiZSBnYydkLiBSZW1vdmUgaXQgZnJvbSB0aGUgZ2NcbiAgICAgICAgICBpZiAocmlnaHQuZ2MgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKHJpZ2h0LmNvbnRlbnQgIT0gbnVsbCAmJiByaWdodC5jb250ZW50Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgcmlnaHQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhbkVuZChyaWdodC5pZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RvcmUucmVtb3ZlRnJvbUdhcmJhZ2VDb2xsZWN0b3IocmlnaHQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihyaWdodClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBwYXJlbnRzIC5tYXAvc3RhcnQvZW5kIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKG9wLnBhcmVudFN1YiAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKGxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgcGFyZW50Lm1hcFtvcC5wYXJlbnRTdWJdID0gb3AuaWRcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihwYXJlbnQpXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlzIGEgY2hpbGQgb2YgYSBtYXAgc3RydWN0LlxuICAgICAgICAgIC8vIFRoZW4gYWxzbyBtYWtlIHN1cmUgdGhhdCBvbmx5IHRoZSBtb3N0IGxlZnQgZWxlbWVudCBpcyBub3QgZGVsZXRlZFxuICAgICAgICAgIC8vIFdlIGRvIG5vdCBjYWxsIHRoZSB0eXBlIGluIHRoaXMgY2FzZSAodGhpcyBpcyB3aGF0IHRoZSB0aGlyZCBwYXJhbWV0ZXIgaXMgZm9yKVxuICAgICAgICAgIGlmIChvcC5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24ob3AucmlnaHQsIDEsIHRydWUpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbihvcC5pZCwgMSwgdHJ1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHJpZ2h0ID09IG51bGwgfHwgbGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAocmlnaHQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICBwYXJlbnQuZW5kID0gWS51dGlscy5nZXRMYXN0SWQob3ApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIHBhcmVudC5zdGFydCA9IG9wLmlkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocGFyZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyeSB0byBtZXJnZSBvcmlnaW5hbCBvcC5sZWZ0IGFuZCBvcC5vcmlnaW5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRyeVRvUmVtZXJnZUxhdGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIG0gPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24odHJ5VG9SZW1lcmdlTGF0ZXJbaV0pXG4gICAgICAgICAgeWllbGQqIHRoaXMudHJ5Q29tYmluZVdpdGhMZWZ0KG0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIExpc3Q6IHtcbiAgICAgIC8qXG4gICAgICB7XG4gICAgICAgIHN0YXJ0OiBudWxsLFxuICAgICAgICBlbmQ6IG51bGwsXG4gICAgICAgIHN0cnVjdDogXCJMaXN0XCIsXG4gICAgICAgIHR5cGU6IFwiXCIsXG4gICAgICAgIGlkOiB0aGlzLm9zLmdldE5leHRPcElkKDEpXG4gICAgICB9XG4gICAgICAqL1xuICAgICAgY3JlYXRlOiBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGFydDogbnVsbCxcbiAgICAgICAgICBlbmQ6IG51bGwsXG4gICAgICAgICAgc3RydWN0OiAnTGlzdCcsXG4gICAgICAgICAgaWQ6IGlkXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICB2YXIgZSA9IHtcbiAgICAgICAgICBzdHJ1Y3Q6ICdMaXN0JyxcbiAgICAgICAgICBpZDogb3AuaWQsXG4gICAgICAgICAgdHlwZTogb3AudHlwZVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgZS5yZXF1aXJlcyA9IG9wLnJlcXVpcmVzXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmluZm8gIT0gbnVsbCkge1xuICAgICAgICAgIGUuaW5mbyA9IG9wLmluZm9cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZVxuICAgICAgfSxcbiAgICAgIHJlcXVpcmVkT3BzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qXG4gICAgICAgIHZhciBpZHMgPSBbXVxuICAgICAgICBpZiAob3Auc3RhcnQgIT0gbnVsbCkge1xuICAgICAgICAgIGlkcy5wdXNoKG9wLnN0YXJ0KVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5lbmQgIT0gbnVsbCl7XG4gICAgICAgICAgaWRzLnB1c2gob3AuZW5kKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpZHNcbiAgICAgICAgKi9cbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9LFxuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgb3Auc3RhcnQgPSBudWxsXG4gICAgICAgIG9wLmVuZCA9IG51bGxcbiAgICAgIH0sXG4gICAgICByZWY6IGZ1bmN0aW9uICogKG9wLCBwb3MpIHtcbiAgICAgICAgaWYgKG9wLnN0YXJ0ID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG4gICAgICAgIHZhciByZXMgPSBudWxsXG4gICAgICAgIHZhciBvID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG9wLnN0YXJ0KVxuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgaWYgKCFvLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgIHJlcyA9IG9cbiAgICAgICAgICAgIHBvcy0tXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwb3MgPj0gMCAmJiBvLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIG8gPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oby5yaWdodClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfSxcbiAgICAgIG1hcDogZnVuY3Rpb24gKiAobywgZikge1xuICAgICAgICBvID0gby5zdGFydFxuICAgICAgICB2YXIgcmVzID0gW11cbiAgICAgICAgd2hpbGUgKG8gIT0gbnVsbCkgeyAvLyBUT0RPOiBjaGFuZ2UgdG8gIT0gKGF0IGxlYXN0IHNvbWUgY29udmVudGlvbilcbiAgICAgICAgICB2YXIgb3BlcmF0aW9uID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG8pXG4gICAgICAgICAgaWYgKCFvcGVyYXRpb24uZGVsZXRlZCkge1xuICAgICAgICAgICAgcmVzLnB1c2goZihvcGVyYXRpb24pKVxuICAgICAgICAgIH1cbiAgICAgICAgICBvID0gb3BlcmF0aW9uLnJpZ2h0XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfVxuICAgIH0sXG4gICAgTWFwOiB7XG4gICAgICAvKlxuICAgICAgICB7XG4gICAgICAgICAgbWFwOiB7fSxcbiAgICAgICAgICBzdHJ1Y3Q6IFwiTWFwXCIsXG4gICAgICAgICAgdHlwZTogXCJcIixcbiAgICAgICAgICBpZDogdGhpcy5vcy5nZXROZXh0T3BJZCgxKVxuICAgICAgICB9XG4gICAgICAqL1xuICAgICAgY3JlYXRlOiBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgbWFwOiB7fSxcbiAgICAgICAgICBzdHJ1Y3Q6ICdNYXAnXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlbmNvZGU6IGZ1bmN0aW9uIChvcCkge1xuICAgICAgICB2YXIgZSA9IHtcbiAgICAgICAgICBzdHJ1Y3Q6ICdNYXAnLFxuICAgICAgICAgIHR5cGU6IG9wLnR5cGUsXG4gICAgICAgICAgaWQ6IG9wLmlkLFxuICAgICAgICAgIG1hcDoge30gLy8gb3ZlcndyaXRlIG1hcCEhXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLnJlcXVpcmVzICE9IG51bGwpIHtcbiAgICAgICAgICBlLnJlcXVpcmVzID0gb3AucmVxdWlyZXNcbiAgICAgICAgfVxuICAgICAgICBpZiAob3AuaW5mbyAhPSBudWxsKSB7XG4gICAgICAgICAgZS5pbmZvID0gb3AuaW5mb1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlXG4gICAgICB9LFxuICAgICAgcmVxdWlyZWRPcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9LFxuICAgICAgZXhlY3V0ZTogZnVuY3Rpb24gKiAoKSB7fSxcbiAgICAgIC8qXG4gICAgICAgIEdldCBhIHByb3BlcnR5IGJ5IG5hbWVcbiAgICAgICovXG4gICAgICBnZXQ6IGZ1bmN0aW9uICogKG9wLCBuYW1lKSB7XG4gICAgICAgIHZhciBvaWQgPSBvcC5tYXBbbmFtZV1cbiAgICAgICAgaWYgKG9pZCAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIHJlcyA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvaWQpXG4gICAgICAgICAgaWYgKHJlcyA9PSBudWxsIHx8IHJlcy5kZWxldGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdm9pZCAwXG4gICAgICAgICAgfSBlbHNlIGlmIChyZXMub3BDb250ZW50ID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiByZXMuY29udGVudFswXVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4geWllbGQqIHRoaXMuZ2V0VHlwZShyZXMub3BDb250ZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBZLlN0cnVjdCA9IFN0cnVjdFxufVxuIiwiLyogQGZsb3cgKi9cbid1c2Ugc3RyaWN0J1xuXG4vKlxuICBQYXJ0aWFsIGRlZmluaXRpb24gb2YgYSB0cmFuc2FjdGlvblxuXG4gIEEgdHJhbnNhY3Rpb24gcHJvdmlkZXMgYWxsIHRoZSB0aGUgYXN5bmMgZnVuY3Rpb25hbGl0eSBvbiBhIGRhdGFiYXNlLlxuXG4gIEJ5IGNvbnZlbnRpb24sIGEgdHJhbnNhY3Rpb24gaGFzIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAgKiBzcyBmb3IgU3RhdGVTZXRcbiAgKiBvcyBmb3IgT3BlcmF0aW9uU3RvcmVcbiAgKiBkcyBmb3IgRGVsZXRlU3RvcmVcblxuICBBIHRyYW5zYWN0aW9uIG11c3QgYWxzbyBkZWZpbmUgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAqIGNoZWNrRGVsZXRlU3RvcmVGb3JTdGF0ZShzdGF0ZSlcbiAgICAtIFdoZW4gaW5jcmVhc2luZyB0aGUgc3RhdGUgb2YgYSB1c2VyLCBhbiBvcGVyYXRpb24gd2l0aCBhbiBoaWdoZXIgaWRcbiAgICAgIG1heSBhbHJlYWR5IGJlIGdhcmJhZ2UgY29sbGVjdGVkLCBhbmQgdGhlcmVmb3JlIGl0IHdpbGwgbmV2ZXIgYmUgcmVjZWl2ZWQuXG4gICAgICB1cGRhdGUgdGhlIHN0YXRlIHRvIHJlZmxlY3QgdGhpcyBrbm93bGVkZ2UuIFRoaXMgd29uJ3QgY2FsbCBhIG1ldGhvZCB0byBzYXZlIHRoZSBzdGF0ZSFcbiAgKiBnZXREZWxldGVTZXQoaWQpXG4gICAgLSBHZXQgdGhlIGRlbGV0ZSBzZXQgaW4gYSByZWFkYWJsZSBmb3JtYXQ6XG4gICAgICB7XG4gICAgICAgIFwidXNlclhcIjogW1xuICAgICAgICAgIFs1LDFdLCAvLyBzdGFydGluZyBmcm9tIHBvc2l0aW9uIDUsIG9uZSBvcGVyYXRpb25zIGlzIGRlbGV0ZWRcbiAgICAgICAgICBbOSw0XSAgLy8gc3RhcnRpbmcgZnJvbSBwb3NpdGlvbiA5LCBmb3VyIG9wZXJhdGlvbnMgYXJlIGRlbGV0ZWRcbiAgICAgICAgXSxcbiAgICAgICAgXCJ1c2VyWVwiOiAuLi5cbiAgICAgIH1cbiAgKiBnZXRPcHNGcm9tRGVsZXRlU2V0KGRzKSAtLSBUT0RPOiBqdXN0IGNhbGwgdGhpcy5kZWxldGVPcGVyYXRpb24oaWQpIGhlcmVcbiAgICAtIGdldCBhIHNldCBvZiBkZWxldGlvbnMgdGhhdCBuZWVkIHRvIGJlIGFwcGxpZWQgaW4gb3JkZXIgdG8gZ2V0IHRvXG4gICAgICBhY2hpZXZlIHRoZSBzdGF0ZSBvZiB0aGUgc3VwcGxpZWQgZHNcbiAgKiBzZXRPcGVyYXRpb24ob3ApXG4gICAgLSB3cml0ZSBgb3BgIHRvIHRoZSBkYXRhYmFzZS5cbiAgICAgIE5vdGU6IHRoaXMgaXMgYWxsb3dlZCB0byByZXR1cm4gYW4gaW4tbWVtb3J5IG9iamVjdC5cbiAgICAgIEUuZy4gdGhlIE1lbW9yeSBhZGFwdGVyIHJldHVybnMgdGhlIG9iamVjdCB0aGF0IGl0IGhhcyBpbi1tZW1vcnkuXG4gICAgICBDaGFuZ2luZyB2YWx1ZXMgb24gdGhpcyBvYmplY3Qgd2lsbCBiZSBzdG9yZWQgZGlyZWN0bHkgaW4gdGhlIGRhdGFiYXNlXG4gICAgICB3aXRob3V0IGNhbGxpbmcgdGhpcyBmdW5jdGlvbi4gVGhlcmVmb3JlLFxuICAgICAgc2V0T3BlcmF0aW9uIG1heSBoYXZlIG5vIGZ1bmN0aW9uYWxpdHkgaW4gc29tZSBhZGFwdGVycy4gVGhpcyBhbHNvIGhhc1xuICAgICAgaW1wbGljYXRpb25zIG9uIHRoZSB3YXkgd2UgdXNlIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHNlcnZlZCBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICAgIFdlIHRyeSBub3QgdG8gY2FsbCBjb3B5T2JqZWN0LCBpZiBub3QgbmVjZXNzYXJ5LlxuICAqIGFkZE9wZXJhdGlvbihvcClcbiAgICAtIGFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIGRhdGFiYXNlLlxuICAgICAgVGhpcyBtYXkgb25seSBiZSBjYWxsZWQgb25jZSBmb3IgZXZlcnkgb3AuaWRcbiAgICAgIE11c3QgcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBuZXh0IG9wZXJhdGlvbiBpbiB0aGUgZGF0YWJhc2UgKG9yZGVyZWQgYnkgaWQpXG4gICogZ2V0T3BlcmF0aW9uKGlkKVxuICAqIHJlbW92ZU9wZXJhdGlvbihpZClcbiAgICAtIHJlbW92ZSBhbiBvcGVyYXRpb24gZnJvbSB0aGUgZGF0YWJhc2UuIFRoaXMgaXMgY2FsbGVkIHdoZW4gYW4gb3BlcmF0aW9uXG4gICAgICBpcyBnYXJiYWdlIGNvbGxlY3RlZC5cbiAgKiBzZXRTdGF0ZShzdGF0ZSlcbiAgICAtIGBzdGF0ZWAgaXMgb2YgdGhlIGZvcm1cbiAgICAgIHtcbiAgICAgICAgdXNlcjogXCIxXCIsXG4gICAgICAgIGNsb2NrOiA0XG4gICAgICB9IDwtIG1lYW5pbmcgdGhhdCB3ZSBoYXZlIGZvdXIgb3BlcmF0aW9ucyBmcm9tIHVzZXIgXCIxXCJcbiAgICAgICAgICAgKHdpdGggdGhlc2UgaWQncyByZXNwZWN0aXZlbHk6IDAsIDEsIDIsIGFuZCAzKVxuICAqIGdldFN0YXRlKHVzZXIpXG4gICogZ2V0U3RhdGVWZWN0b3IoKVxuICAgIC0gR2V0IHRoZSBzdGF0ZSBvZiB0aGUgT1MgaW4gdGhlIGZvcm1cbiAgICBbe1xuICAgICAgdXNlcjogXCJ1c2VyWFwiLFxuICAgICAgY2xvY2s6IDExXG4gICAgfSxcbiAgICAgLi5cbiAgICBdXG4gICogZ2V0U3RhdGVTZXQoKVxuICAgIC0gR2V0IHRoZSBzdGF0ZSBvZiB0aGUgT1MgaW4gdGhlIGZvcm1cbiAgICB7XG4gICAgICBcInVzZXJYXCI6IDExLFxuICAgICAgXCJ1c2VyWVwiOiAyMlxuICAgIH1cbiAgICogZ2V0T3BlcmF0aW9ucyhzdGFydFNTKVxuICAgICAtIEdldCB0aGUgYWxsIHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBhY2hpdmUgdGhlXG4gICAgICAgc3RhdGVTZXQgb2YgdGhpcyB1c2VyLCBzdGFydGluZyBmcm9tIGEgc3RhdGVTZXQgc3VwcGxpZWQgYnkgYW5vdGhlciB1c2VyXG4gICAqIG1ha2VPcGVyYXRpb25SZWFkeShzcywgb3ApXG4gICAgIC0gdGhpcyBpcyBjYWxsZWQgb25seSBieSBgZ2V0T3BlcmF0aW9ucyhzdGFydFNTKWAuIEl0IG1ha2VzIGFuIG9wZXJhdGlvblxuICAgICAgIGFwcGx5YWJsZSBvbiBhIGdpdmVuIFNTLlxuKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKFkvKiA6YW55ICovKSB7XG4gIGNsYXNzIFRyYW5zYWN0aW9uSW50ZXJmYWNlIHtcbiAgICAvKiA6OlxuICAgIHN0b3JlOiBZLkFic3RyYWN0RGF0YWJhc2U7XG4gICAgZHM6IFN0b3JlO1xuICAgIG9zOiBTdG9yZTtcbiAgICBzczogU3RvcmU7XG4gICAgKi9cbiAgICAvKlxuICAgICAgQXBwbHkgb3BlcmF0aW9ucyB0aGF0IHRoaXMgdXNlciBjcmVhdGVkIChubyByZW1vdGUgb25lcyEpXG4gICAgICAgICogZG9lcyBub3QgY2hlY2sgZm9yIFN0cnVjdC4qLnJlcXVpcmVkT3BzKClcbiAgICAgICAgKiBhbHNvIGJyb2FkY2FzdHMgaXQgdGhyb3VnaCB0aGUgY29ubmVjdG9yXG4gICAgKi9cbiAgICAqIGFwcGx5Q3JlYXRlZE9wZXJhdGlvbnMgKG9wcykge1xuICAgICAgdmFyIHNlbmQgPSBbXVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9wID0gb3BzW2ldXG4gICAgICAgIHlpZWxkKiB0aGlzLnN0b3JlLnRyeUV4ZWN1dGUuY2FsbCh0aGlzLCBvcClcbiAgICAgICAgaWYgKG9wLmlkID09IG51bGwgfHwgdHlwZW9mIG9wLmlkWzFdICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHNlbmQucHVzaChZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvcCkpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZW5kLmxlbmd0aCA+IDApIHsgLy8gVE9ETzogJiYgIXRoaXMuc3RvcmUuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zIChidXQgdGhlbiBpIGRvbid0IHNlbmQgZGVsZXRlIG9wcylcbiAgICAgICAgLy8gaXMgY29ubmVjdGVkLCBhbmQgdGhpcyBpcyBub3QgZ29pbmcgdG8gYmUgc2VuZCBpbiBhZGRPcGVyYXRpb25cbiAgICAgICAgdGhpcy5zdG9yZS55LmNvbm5lY3Rvci5icm9hZGNhc3RPcHMoc2VuZClcbiAgICAgIH1cbiAgICB9XG5cbiAgICAqIGRlbGV0ZUxpc3QgKHN0YXJ0KSB7XG4gICAgICB3aGlsZSAoc3RhcnQgIT0gbnVsbCkge1xuICAgICAgICBzdGFydCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihzdGFydClcbiAgICAgICAgaWYgKCFzdGFydC5nYykge1xuICAgICAgICAgIHN0YXJ0LmdjID0gdHJ1ZVxuICAgICAgICAgIHN0YXJ0LmRlbGV0ZWQgPSB0cnVlXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHN0YXJ0KVxuICAgICAgICAgIHZhciBkZWxMZW5ndGggPSBzdGFydC5jb250ZW50ICE9IG51bGwgPyBzdGFydC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgICAgICB5aWVsZCogdGhpcy5tYXJrRGVsZXRlZChzdGFydC5pZCwgZGVsTGVuZ3RoKVxuICAgICAgICAgIGlmIChzdGFydC5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKHN0YXJ0Lm9wQ29udGVudClcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5zdG9yZS5xdWV1ZUdhcmJhZ2VDb2xsZWN0b3Ioc3RhcnQuaWQpXG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQgPSBzdGFydC5yaWdodFxuICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICBNYXJrIGFuIG9wZXJhdGlvbiBhcyBkZWxldGVkLCBhbmQgYWRkIGl0IHRvIHRoZSBHQywgaWYgcG9zc2libGUuXG4gICAgKi9cbiAgICAqIGRlbGV0ZU9wZXJhdGlvbiAodGFyZ2V0SWQsIGxlbmd0aCwgcHJldmVudENhbGxUeXBlKSAvKiA6R2VuZXJhdG9yPGFueSwgYW55LCBhbnk+ICovIHtcbiAgICAgIGlmIChsZW5ndGggPT0gbnVsbCkge1xuICAgICAgICBsZW5ndGggPSAxXG4gICAgICB9XG4gICAgICB5aWVsZCogdGhpcy5tYXJrRGVsZXRlZCh0YXJnZXRJZCwgbGVuZ3RoKVxuICAgICAgd2hpbGUgKGxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIGNhbGxUeXBlID0gZmFsc2VcbiAgICAgICAgdmFyIHRhcmdldCA9IHlpZWxkKiB0aGlzLm9zLmZpbmRXaXRoVXBwZXJCb3VuZChbdGFyZ2V0SWRbMF0sIHRhcmdldElkWzFdICsgbGVuZ3RoIC0gMV0pXG4gICAgICAgIHZhciB0YXJnZXRMZW5ndGggPSB0YXJnZXQgIT0gbnVsbCAmJiB0YXJnZXQuY29udGVudCAhPSBudWxsID8gdGFyZ2V0LmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgICBpZiAodGFyZ2V0ID09IG51bGwgfHwgdGFyZ2V0LmlkWzBdICE9PSB0YXJnZXRJZFswXSB8fCB0YXJnZXQuaWRbMV0gKyB0YXJnZXRMZW5ndGggPD0gdGFyZ2V0SWRbMV0pIHtcbiAgICAgICAgICAvLyBkb2VzIG5vdCBleGlzdCBvciBpcyBub3QgaW4gdGhlIHJhbmdlIG9mIHRoZSBkZWxldGlvblxuICAgICAgICAgIHRhcmdldCA9IG51bGxcbiAgICAgICAgICBsZW5ndGggPSAwXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gZG9lcyBleGlzdCwgY2hlY2sgaWYgaXQgaXMgdG9vIGxvbmdcbiAgICAgICAgICBpZiAoIXRhcmdldC5kZWxldGVkKSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0LmlkWzFdIDwgdGFyZ2V0SWRbMV0pIHtcbiAgICAgICAgICAgICAgLy8gc3RhcnRzIHRvIHRoZSBsZWZ0IG9mIHRoZSBkZWxldGlvbiByYW5nZVxuICAgICAgICAgICAgICB0YXJnZXQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhblN0YXJ0KHRhcmdldElkKVxuICAgICAgICAgICAgICB0YXJnZXRMZW5ndGggPSB0YXJnZXQuY29udGVudC5sZW5ndGggLy8gbXVzdCBoYXZlIGNvbnRlbnQgcHJvcGVydHkhXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFyZ2V0LmlkWzFdICsgdGFyZ2V0TGVuZ3RoID4gdGFyZ2V0SWRbMV0gKyBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgLy8gZW5kcyB0byB0aGUgcmlnaHQgb2YgdGhlIGRlbGV0aW9uIHJhbmdlXG4gICAgICAgICAgICAgIHRhcmdldCA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKFt0YXJnZXRJZFswXSwgdGFyZ2V0SWRbMV0gKyBsZW5ndGggLSAxXSlcbiAgICAgICAgICAgICAgdGFyZ2V0TGVuZ3RoID0gdGFyZ2V0LmNvbnRlbnQubGVuZ3RoXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxlbmd0aCA9IHRhcmdldC5pZFsxXSAtIHRhcmdldElkWzFdXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGFyZ2V0ICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoIXRhcmdldC5kZWxldGVkKSB7XG4gICAgICAgICAgICBjYWxsVHlwZSA9IHRydWVcbiAgICAgICAgICAgIC8vIHNldCBkZWxldGVkICYgbm90aWZ5IHR5cGVcbiAgICAgICAgICAgIHRhcmdldC5kZWxldGVkID0gdHJ1ZVxuICAgICAgICAgICAgLy8gZGVsZXRlIGNvbnRhaW5pbmcgbGlzdHNcbiAgICAgICAgICAgIGlmICh0YXJnZXQuc3RhcnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAvLyBUT0RPOiBkb24ndCBkbyBpdCBsaWtlIHRoaXMgLi4gLS4tXG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZUxpc3QodGFyZ2V0LnN0YXJ0KVxuICAgICAgICAgICAgICAvLyB5aWVsZCogdGhpcy5kZWxldGVMaXN0KHRhcmdldC5pZCkgLS0gZG8gbm90IGdjIGl0c2VsZiBiZWNhdXNlIHRoaXMgbWF5IHN0aWxsIGdldCByZWZlcmVuY2VkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFyZ2V0Lm1hcCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGFyZ2V0Lm1hcCkge1xuICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZUxpc3QodGFyZ2V0Lm1hcFtuYW1lXSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBUT0RPOiBoZXJlIHRvLi4gIChzZWUgYWJvdmUpXG4gICAgICAgICAgICAgIC8vIHlpZWxkKiB0aGlzLmRlbGV0ZUxpc3QodGFyZ2V0LmlkKSAtLSBzZWUgYWJvdmVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0YXJnZXQub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKHRhcmdldC5vcENvbnRlbnQpXG4gICAgICAgICAgICAgIC8vIHRhcmdldC5vcENvbnRlbnQgPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGFyZ2V0LnJlcXVpcmVzICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXQucmVxdWlyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24odGFyZ2V0LnJlcXVpcmVzW2ldKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBsZWZ0XG4gICAgICAgICAgaWYgKHRhcmdldC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGxlZnQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24odGFyZ2V0LmxlZnQpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxlZnQgPSBudWxsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gc2V0IGhlcmUgYmVjYXVzZSBpdCB3YXMgZGVsZXRlZCBhbmQvb3IgZ2MnZFxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbih0YXJnZXQpXG5cbiAgICAgICAgICAvKlxuICAgICAgICAgICAgQ2hlY2sgaWYgaXQgaXMgcG9zc2libGUgdG8gYWRkIHJpZ2h0IHRvIHRoZSBnYy5cbiAgICAgICAgICAgIEJlY2F1c2UgdGhpcyBkZWxldGUgY2FuJ3QgYmUgcmVzcG9uc2libGUgZm9yIGxlZnQgYmVpbmcgZ2MnZCxcbiAgICAgICAgICAgIHdlIGRvbid0IGhhdmUgdG8gYWRkIGxlZnQgdG8gdGhlIGdjLi5cbiAgICAgICAgICAqL1xuICAgICAgICAgIHZhciByaWdodFxuICAgICAgICAgIGlmICh0YXJnZXQucmlnaHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmlnaHQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24odGFyZ2V0LnJpZ2h0KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByaWdodCA9IG51bGxcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNhbGxUeXBlICYmICFwcmV2ZW50Q2FsbFR5cGUpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnN0b3JlLm9wZXJhdGlvbkFkZGVkKHRoaXMsIHtcbiAgICAgICAgICAgICAgc3RydWN0OiAnRGVsZXRlJyxcbiAgICAgICAgICAgICAgdGFyZ2V0OiB0YXJnZXQuaWQsXG4gICAgICAgICAgICAgIGxlbmd0aDogdGFyZ2V0TGVuZ3RoLFxuICAgICAgICAgICAgICB0YXJnZXRQYXJlbnQ6IHRhcmdldC5wYXJlbnRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIG5lZWQgdG8gZ2MgaW4gdGhlIGVuZCFcbiAgICAgICAgICB5aWVsZCogdGhpcy5zdG9yZS5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IuY2FsbCh0aGlzLCB0YXJnZXQsIGxlZnQpXG4gICAgICAgICAgaWYgKHJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLnN0b3JlLmFkZFRvR2FyYmFnZUNvbGxlY3Rvci5jYWxsKHRoaXMsIHJpZ2h0LCB0YXJnZXQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8qXG4gICAgICBNYXJrIGFuIG9wZXJhdGlvbiBhcyBkZWxldGVkJmdjJ2RcbiAgICAqL1xuICAgICogbWFya0dhcmJhZ2VDb2xsZWN0ZWQgKGlkLCBsZW4pIHtcbiAgICAgIC8vIHRoaXMubWVtLnB1c2goW1wiZ2NcIiwgaWRdKTtcbiAgICAgIHRoaXMuc3RvcmUuYWRkVG9EZWJ1ZygneWllbGQqIHRoaXMubWFya0dhcmJhZ2VDb2xsZWN0ZWQoJywgaWQsICcsICcsIGxlbiwgJyknKVxuICAgICAgdmFyIG4gPSB5aWVsZCogdGhpcy5tYXJrRGVsZXRlZChpZCwgbGVuKVxuICAgICAgaWYgKG4uaWRbMV0gPCBpZFsxXSAmJiAhbi5nYykge1xuICAgICAgICAvLyB1bi1leHRlbmQgbGVmdFxuICAgICAgICB2YXIgbmV3bGVuID0gbi5sZW4gLSAoaWRbMV0gLSBuLmlkWzFdKVxuICAgICAgICBuLmxlbiAtPSBuZXdsZW5cbiAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pXG4gICAgICAgIG4gPSB7aWQ6IGlkLCBsZW46IG5ld2xlbiwgZ2M6IGZhbHNlfVxuICAgICAgICB5aWVsZCogdGhpcy5kcy5wdXQobilcbiAgICAgIH1cbiAgICAgIC8vIGdldCBwcmV2Jm5leHQgYmVmb3JlIGFkZGluZyBhIG5ldyBvcGVyYXRpb25cbiAgICAgIHZhciBwcmV2ID0geWllbGQqIHRoaXMuZHMuZmluZFByZXYoaWQpXG4gICAgICB2YXIgbmV4dCA9IHlpZWxkKiB0aGlzLmRzLmZpbmROZXh0KGlkKVxuXG4gICAgICBpZiAoaWRbMV0gKyBsZW4gPCBuLmlkWzFdICsgbi5sZW4gJiYgIW4uZ2MpIHtcbiAgICAgICAgLy8gdW4tZXh0ZW5kIHJpZ2h0XG4gICAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dCh7aWQ6IFtpZFswXSwgaWRbMV0gKyBsZW5dLCBsZW46IG4ubGVuIC0gbGVuLCBnYzogZmFsc2V9KVxuICAgICAgICBuLmxlbiA9IGxlblxuICAgICAgfVxuICAgICAgLy8gc2V0IGdjJ2RcbiAgICAgIG4uZ2MgPSB0cnVlXG4gICAgICAvLyBjYW4gZXh0ZW5kIGxlZnQ/XG4gICAgICBpZiAoXG4gICAgICAgIHByZXYgIT0gbnVsbCAmJlxuICAgICAgICBwcmV2LmdjICYmXG4gICAgICAgIFkudXRpbHMuY29tcGFyZUlkcyhbcHJldi5pZFswXSwgcHJldi5pZFsxXSArIHByZXYubGVuXSwgbi5pZClcbiAgICAgICkge1xuICAgICAgICBwcmV2LmxlbiArPSBuLmxlblxuICAgICAgICB5aWVsZCogdGhpcy5kcy5kZWxldGUobi5pZClcbiAgICAgICAgbiA9IHByZXZcbiAgICAgICAgLy8gZHMucHV0IG4gaGVyZT9cbiAgICAgIH1cbiAgICAgIC8vIGNhbiBleHRlbmQgcmlnaHQ/XG4gICAgICBpZiAoXG4gICAgICAgIG5leHQgIT0gbnVsbCAmJlxuICAgICAgICBuZXh0LmdjICYmXG4gICAgICAgIFkudXRpbHMuY29tcGFyZUlkcyhbbi5pZFswXSwgbi5pZFsxXSArIG4ubGVuXSwgbmV4dC5pZClcbiAgICAgICkge1xuICAgICAgICBuLmxlbiArPSBuZXh0LmxlblxuICAgICAgICB5aWVsZCogdGhpcy5kcy5kZWxldGUobmV4dC5pZClcbiAgICAgIH1cbiAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKVxuICAgICAgeWllbGQqIHRoaXMudXBkYXRlU3RhdGUobi5pZFswXSlcbiAgICB9XG4gICAgLypcbiAgICAgIE1hcmsgYW4gb3BlcmF0aW9uIGFzIGRlbGV0ZWQuXG5cbiAgICAgIHJldHVybnMgdGhlIGRlbGV0ZSBub2RlXG4gICAgKi9cbiAgICAqIG1hcmtEZWxldGVkIChpZCwgbGVuZ3RoKSB7XG4gICAgICBpZiAobGVuZ3RoID09IG51bGwpIHtcbiAgICAgICAgbGVuZ3RoID0gMVxuICAgICAgfVxuICAgICAgLy8gdGhpcy5tZW0ucHVzaChbXCJkZWxcIiwgaWRdKTtcbiAgICAgIHZhciBuID0geWllbGQqIHRoaXMuZHMuZmluZFdpdGhVcHBlckJvdW5kKGlkKVxuICAgICAgaWYgKG4gIT0gbnVsbCAmJiBuLmlkWzBdID09PSBpZFswXSkge1xuICAgICAgICBpZiAobi5pZFsxXSA8PSBpZFsxXSAmJiBpZFsxXSA8PSBuLmlkWzFdICsgbi5sZW4pIHtcbiAgICAgICAgICAvLyBpZCBpcyBpbiBuJ3MgcmFuZ2VcbiAgICAgICAgICB2YXIgZGlmZiA9IGlkWzFdICsgbGVuZ3RoIC0gKG4uaWRbMV0gKyBuLmxlbikgLy8gb3ZlcmxhcHBpbmcgcmlnaHRcbiAgICAgICAgICBpZiAoZGlmZiA+IDApIHtcbiAgICAgICAgICAgIC8vIGlkK2xlbmd0aCBvdmVybGFwcyBuXG4gICAgICAgICAgICBpZiAoIW4uZ2MpIHtcbiAgICAgICAgICAgICAgbi5sZW4gKz0gZGlmZlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGlmZiA9IG4uaWRbMV0gKyBuLmxlbiAtIGlkWzFdIC8vIG92ZXJsYXBwaW5nIGxlZnQgKGlkIHRpbGwgbi5lbmQpXG4gICAgICAgICAgICAgIGlmIChkaWZmIDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gYSBwYXJ0aWFsIGRlbGV0aW9uXG4gICAgICAgICAgICAgICAgbiA9IHtpZDogW2lkWzBdLCBpZFsxXSArIGRpZmZdLCBsZW46IGxlbmd0aCAtIGRpZmYsIGdjOiBmYWxzZX1cbiAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kcy5wdXQobilcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhbHJlYWR5IGdjJ2RcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBoYXBwZW4hIChpdCBkaXQgdGhvdWdoLi4gOigpJylcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIG92ZXJsYXBwaW5nLCBhbHJlYWR5IGRlbGV0ZWRcbiAgICAgICAgICAgIHJldHVybiBuXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGNhbm5vdCBleHRlbmQgbGVmdCAodGhlcmUgaXMgbm8gbGVmdCEpXG4gICAgICAgICAgbiA9IHtpZDogaWQsIGxlbjogbGVuZ3RoLCBnYzogZmFsc2V9XG4gICAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pIC8vIFRPRE86IHlvdSBkb3VibGUtcHV0ICEhXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNhbm5vdCBleHRlbmQgbGVmdFxuICAgICAgICBuID0ge2lkOiBpZCwgbGVuOiBsZW5ndGgsIGdjOiBmYWxzZX1cbiAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pXG4gICAgICB9XG4gICAgICAvLyBjYW4gZXh0ZW5kIHJpZ2h0P1xuICAgICAgdmFyIG5leHQgPSB5aWVsZCogdGhpcy5kcy5maW5kTmV4dChuLmlkKVxuICAgICAgaWYgKFxuICAgICAgICBuZXh0ICE9IG51bGwgJiZcbiAgICAgICAgbi5pZFswXSA9PT0gbmV4dC5pZFswXSAmJlxuICAgICAgICBuLmlkWzFdICsgbi5sZW4gPj0gbmV4dC5pZFsxXVxuICAgICAgKSB7XG4gICAgICAgIGRpZmYgPSBuLmlkWzFdICsgbi5sZW4gLSBuZXh0LmlkWzFdIC8vIGZyb20gbmV4dC5zdGFydCB0byBuLmVuZFxuICAgICAgICB3aGlsZSAoZGlmZiA+PSAwKSB7XG4gICAgICAgICAgLy8gbiBvdmVybGFwcyB3aXRoIG5leHRcbiAgICAgICAgICBpZiAobmV4dC5nYykge1xuICAgICAgICAgICAgLy8gZ2MgaXMgc3Ryb25nZXIsIHNvIHJlZHVjZSBsZW5ndGggb2YgblxuICAgICAgICAgICAgbi5sZW4gLT0gZGlmZlxuICAgICAgICAgICAgaWYgKGRpZmYgPj0gbmV4dC5sZW4pIHtcbiAgICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBtaXNzaW5nIHJhbmdlIGFmdGVyIG5leHRcbiAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgLSBuZXh0LmxlbiAvLyBtaXNzaW5nIHJhbmdlIGFmdGVyIG5leHRcbiAgICAgICAgICAgICAgaWYgKGRpZmYgPiAwKSB7XG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZHMucHV0KG4pIC8vIHVubmVjY2Vzc2FyeT8gVE9ETyFcbiAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5tYXJrRGVsZXRlZChbbmV4dC5pZFswXSwgbmV4dC5pZFsxXSArIG5leHQubGVuXSwgZGlmZilcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gd2UgY2FuIGV4dGVuZCBuIHdpdGggbmV4dFxuICAgICAgICAgICAgaWYgKGRpZmYgPiBuZXh0Lmxlbikge1xuICAgICAgICAgICAgICAvLyBuIGlzIGV2ZW4gbG9uZ2VyIHRoYW4gbmV4dFxuICAgICAgICAgICAgICAvLyBnZXQgbmV4dC5uZXh0LCBhbmQgdHJ5IHRvIGV4dGVuZCBpdFxuICAgICAgICAgICAgICB2YXIgX25leHQgPSB5aWVsZCogdGhpcy5kcy5maW5kTmV4dChuZXh0LmlkKVxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kcy5kZWxldGUobmV4dC5pZClcbiAgICAgICAgICAgICAgaWYgKF9uZXh0ID09IG51bGwgfHwgbi5pZFswXSAhPT0gX25leHQuaWRbMF0pIHtcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5leHQgPSBfbmV4dFxuICAgICAgICAgICAgICAgIGRpZmYgPSBuLmlkWzFdICsgbi5sZW4gLSBuZXh0LmlkWzFdIC8vIGZyb20gbmV4dC5zdGFydCB0byBuLmVuZFxuICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBuIGp1c3QgcGFydGlhbGx5IG92ZXJsYXBzIHdpdGggbmV4dC4gZXh0ZW5kIG4sIGRlbGV0ZSBuZXh0LCBhbmQgYnJlYWsgdGhpcyBsb29wXG4gICAgICAgICAgICAgIG4ubGVuICs9IG5leHQubGVuIC0gZGlmZlxuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kcy5kZWxldGUobmV4dC5pZClcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkKiB0aGlzLmRzLnB1dChuKVxuICAgICAgcmV0dXJuIG5cbiAgICB9XG4gICAgLypcbiAgICAgIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB0aGUgY2xpZW50IGlzIGNvbm5lY3RlZCZzeW5jZWQgd2l0aCB0aGVcbiAgICAgIG90aGVyIGNsaWVudHMgKGUuZy4gbWFzdGVyKS4gVGhpcyB3aWxsIHF1ZXJ5IHRoZSBkYXRhYmFzZSBmb3JcbiAgICAgIG9wZXJhdGlvbnMgdGhhdCBjYW4gYmUgZ2MnZCBhbmQgYWRkIHRoZW0gdG8gdGhlIGdhcmJhZ2UgY29sbGVjdG9yLlxuICAgICovXG4gICAgKiBnYXJiYWdlQ29sbGVjdEFmdGVyU3luYyAoKSB7XG4gICAgICBpZiAodGhpcy5zdG9yZS5nYzEubGVuZ3RoID4gMCB8fCB0aGlzLnN0b3JlLmdjMi5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignZ2Mgc2hvdWxkIGJlIGVtcHR5IGFmdGVyIHN5bmMnKVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLnN0b3JlLmdjKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgeWllbGQqIHRoaXMub3MuaXRlcmF0ZSh0aGlzLCBudWxsLCBudWxsLCBmdW5jdGlvbiAqIChvcCkge1xuICAgICAgICBpZiAob3AuZ2MpIHtcbiAgICAgICAgICBkZWxldGUgb3AuZ2NcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ob3ApXG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLnBhcmVudCAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIHBhcmVudERlbGV0ZWQgPSB5aWVsZCogdGhpcy5pc0RlbGV0ZWQob3AucGFyZW50KVxuICAgICAgICAgIGlmIChwYXJlbnREZWxldGVkKSB7XG4gICAgICAgICAgICBvcC5nYyA9IHRydWVcbiAgICAgICAgICAgIGlmICghb3AuZGVsZXRlZCkge1xuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5tYXJrRGVsZXRlZChvcC5pZCwgb3AuY29udGVudCAhPSBudWxsID8gb3AuY29udGVudC5sZW5ndGggOiAxKVxuICAgICAgICAgICAgICBvcC5kZWxldGVkID0gdHJ1ZVxuICAgICAgICAgICAgICBpZiAob3Aub3BDb250ZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24ob3Aub3BDb250ZW50KVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChvcC5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcC5yZXF1aXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuZGVsZXRlT3BlcmF0aW9uKG9wLnJlcXVpcmVzW2ldKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9wKVxuICAgICAgICAgICAgdGhpcy5zdG9yZS5nYzEucHVzaChvcC5pZCkgLy8gdGhpcyBpcyBvayBiZWNhdWVzIGl0cyBzaG9ydGx5IGJlZm9yZSBzeW5jIChvdGhlcndpc2UgdXNlIHF1ZXVlR2FyYmFnZUNvbGxlY3RvciEpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wLmRlbGV0ZWQpIHtcbiAgICAgICAgICB2YXIgbGVmdCA9IG51bGxcbiAgICAgICAgICBpZiAob3AubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBsZWZ0ID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG9wLmxlZnQpXG4gICAgICAgICAgfVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnN0b3JlLmFkZFRvR2FyYmFnZUNvbGxlY3Rvci5jYWxsKHRoaXMsIG9wLCBsZWZ0KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICAvKlxuICAgICAgUmVhbGx5IHJlbW92ZSBhbiBvcCBhbmQgYWxsIGl0cyBlZmZlY3RzLlxuICAgICAgVGhlIGNvbXBsaWNhdGVkIGNhc2UgaGVyZSBpcyB0aGUgSW5zZXJ0IG9wZXJhdGlvbjpcbiAgICAgICogcmVzZXQgbGVmdFxuICAgICAgKiByZXNldCByaWdodFxuICAgICAgKiByZXNldCBwYXJlbnQuc3RhcnRcbiAgICAgICogcmVzZXQgcGFyZW50LmVuZFxuICAgICAgKiByZXNldCBvcmlnaW5zIG9mIGFsbCByaWdodCBvcHNcbiAgICAqL1xuICAgICogZ2FyYmFnZUNvbGxlY3RPcGVyYXRpb24gKGlkKSB7XG4gICAgICB0aGlzLnN0b3JlLmFkZFRvRGVidWcoJ3lpZWxkKiB0aGlzLmdhcmJhZ2VDb2xsZWN0T3BlcmF0aW9uKCcsIGlkLCAnKScpXG4gICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihpZClcbiAgICAgIHlpZWxkKiB0aGlzLm1hcmtHYXJiYWdlQ29sbGVjdGVkKGlkLCAobyAhPSBudWxsICYmIG8uY29udGVudCAhPSBudWxsKSA/IG8uY29udGVudC5sZW5ndGggOiAxKSAvLyBhbHdheXMgbWFyayBnYydkXG4gICAgICAvLyBpZiBvcCBleGlzdHMsIHRoZW4gY2xlYW4gdGhhdCBtZXNzIHVwLi5cbiAgICAgIGlmIChvICE9IG51bGwpIHtcbiAgICAgICAgdmFyIGRlcHMgPSBbXVxuICAgICAgICBpZiAoby5vcENvbnRlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIGRlcHMucHVzaChvLm9wQ29udGVudClcbiAgICAgICAgfVxuICAgICAgICBpZiAoby5yZXF1aXJlcyAhPSBudWxsKSB7XG4gICAgICAgICAgZGVwcyA9IGRlcHMuY29uY2F0KG8ucmVxdWlyZXMpXG4gICAgICAgIH1cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgdmFyIGRlcCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihkZXBzW2ldKVxuICAgICAgICAgIGlmIChkZXAgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKCFkZXAuZGVsZXRlZCkge1xuICAgICAgICAgICAgICB5aWVsZCogdGhpcy5kZWxldGVPcGVyYXRpb24oZGVwLmlkKVxuICAgICAgICAgICAgICBkZXAgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oZGVwLmlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVwLmdjID0gdHJ1ZVxuICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKGRlcClcbiAgICAgICAgICAgIHRoaXMuc3RvcmUucXVldWVHYXJiYWdlQ29sbGVjdG9yKGRlcC5pZClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeWllbGQqIHRoaXMubWFya0dhcmJhZ2VDb2xsZWN0ZWQoZGVwc1tpXSwgMSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZ2MnZCBvcCBmcm9tIHRoZSBsZWZ0IG9wLCBpZiBpdCBleGlzdHNcbiAgICAgICAgaWYgKG8ubGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgdmFyIGxlZnQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oby5sZWZ0KVxuICAgICAgICAgIGxlZnQucmlnaHQgPSBvLnJpZ2h0XG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKGxlZnQpXG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIGdjJ2Qgb3AgZnJvbSB0aGUgcmlnaHQgb3AsIGlmIGl0IGV4aXN0c1xuICAgICAgICAvLyBhbHNvIHJlc2V0IG9yaWdpbnMgb2YgcmlnaHQgb3BzXG4gICAgICAgIGlmIChvLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICB2YXIgcmlnaHQgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oby5yaWdodClcbiAgICAgICAgICByaWdodC5sZWZ0ID0gby5sZWZ0XG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHJpZ2h0KVxuXG4gICAgICAgICAgaWYgKG8ub3JpZ2luT2YgIT0gbnVsbCAmJiBvLm9yaWdpbk9mLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGZpbmQgbmV3IG9yaWdpbiBvZiByaWdodCBvcHNcbiAgICAgICAgICAgIC8vIG9yaWdpbiBpcyB0aGUgZmlyc3QgbGVmdCBkZWxldGVkIG9wZXJhdGlvblxuICAgICAgICAgICAgdmFyIG5ld29yaWdpbiA9IG8ubGVmdFxuICAgICAgICAgICAgdmFyIG5ld29yaWdpbl8gPSBudWxsXG4gICAgICAgICAgICB3aGlsZSAobmV3b3JpZ2luICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgbmV3b3JpZ2luXyA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbihuZXdvcmlnaW4pXG4gICAgICAgICAgICAgIGlmIChuZXdvcmlnaW5fLmRlbGV0ZWQpIHtcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIG5ld29yaWdpbiA9IG5ld29yaWdpbl8ubGVmdFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXNldCBvcmlnaW4gb2YgYWxsIHJpZ2h0IG9wcyAoZXhjZXB0IGZpcnN0IHJpZ2h0IC0gZHVoISksXG5cbiAgICAgICAgICAgIC8qICoqIFRoZSBmb2xsb3dpbmcgY29kZSBkb2VzIG5vdCByZWx5IG9uIHRoZSB0aGUgb3JpZ2luT2YgcHJvcGVydHkgKipcbiAgICAgICAgICAgICAgICAgIEkgcmVjZW50bHkgYWRkZWQgb3JpZ2luT2YgdG8gYWxsIEluc2VydCBPcGVyYXRpb25zIChzZWUgU3RydWN0Lkluc2VydC5leGVjdXRlKSxcbiAgICAgICAgICAgICAgICAgIHdoaWNoIHNhdmVzIHdoaWNoIG9wZXJhdGlvbnMgb3JpZ2luYXRlIGluIGEgSW5zZXJ0IG9wZXJhdGlvbi5cbiAgICAgICAgICAgICAgICAgIEdhcmJhZ2UgY29sbGVjdGluZyB3aXRob3V0IG9yaWdpbk9mIGlzIG1vcmUgbWVtb3J5IGVmZmljaWVudCwgYnV0IGlzIG5lYXJseSBpbXBvc3NpYmxlIGZvciBsYXJnZSB0ZXh0cywgb3IgbGlzdHMhXG4gICAgICAgICAgICAgICAgICBCdXQgSSBrZWVwIHRoaXMgY29kZSBmb3Igbm93XG4gICAgICAgICAgICBgYGBcbiAgICAgICAgICAgIC8vIHJlc2V0IG9yaWdpbiBvZiByaWdodFxuICAgICAgICAgICAgcmlnaHQub3JpZ2luID0gbmV3b3JpZ2luXG4gICAgICAgICAgICAvLyBzZWFyY2ggdW50aWwgeW91IGZpbmQgb3JpZ2luIHBvaW50ZXIgdG8gdGhlIGxlZnQgb2Ygb1xuICAgICAgICAgICAgaWYgKHJpZ2h0LnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgdmFyIGkgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24ocmlnaHQucmlnaHQpXG4gICAgICAgICAgICAgIHZhciBpZHMgPSBbby5pZCwgby5yaWdodF1cbiAgICAgICAgICAgICAgd2hpbGUgKGlkcy5zb21lKGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBZLnV0aWxzLmNvbXBhcmVJZHMoaWQsIGkub3JpZ2luKVxuICAgICAgICAgICAgICB9KSkge1xuICAgICAgICAgICAgICAgIGlmIChZLnV0aWxzLmNvbXBhcmVJZHMoaS5vcmlnaW4sIG8uaWQpKSB7XG4gICAgICAgICAgICAgICAgICAvLyByZXNldCBvcmlnaW4gb2YgaVxuICAgICAgICAgICAgICAgICAgaS5vcmlnaW4gPSBuZXdvcmlnaW5cbiAgICAgICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihpKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBnZXQgbmV4dCBpXG4gICAgICAgICAgICAgICAgaWYgKGkucmlnaHQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgaWRzLnB1c2goaS5pZClcbiAgICAgICAgICAgICAgICAgIGkgPSB5aWVsZCogdGhpcy5nZXRPcGVyYXRpb24oaS5yaWdodClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGBgYFxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIC8vICoqIE5vdyB0aGUgbmV3IGltcGxlbWVudGF0aW9uIHN0YXJ0cyAqKlxuICAgICAgICAgICAgLy8gcmVzZXQgbmV3b3JpZ2luIG9mIGFsbCBvcmlnaW5PZlsqXVxuICAgICAgICAgICAgZm9yICh2YXIgX2kgaW4gby5vcmlnaW5PZikge1xuICAgICAgICAgICAgICB2YXIgb3JpZ2luc0luID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG8ub3JpZ2luT2ZbX2ldKVxuICAgICAgICAgICAgICBpZiAob3JpZ2luc0luICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBvcmlnaW5zSW4ub3JpZ2luID0gbmV3b3JpZ2luXG4gICAgICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKG9yaWdpbnNJbilcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5ld29yaWdpbiAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChuZXdvcmlnaW5fLm9yaWdpbk9mID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBuZXdvcmlnaW5fLm9yaWdpbk9mID0gby5vcmlnaW5PZlxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld29yaWdpbl8ub3JpZ2luT2YgPSBvLm9yaWdpbk9mLmNvbmNhdChuZXdvcmlnaW5fLm9yaWdpbk9mKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihuZXdvcmlnaW5fKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2UgZG9uJ3QgbmVlZCB0byBzZXQgcmlnaHQgaGVyZSwgYmVjYXVzZVxuICAgICAgICAgICAgLy8gcmlnaHQgc2hvdWxkIGJlIGluIG8ub3JpZ2luT2YgPT4gaXQgaXMgc2V0IGl0IHRoZSBwcmV2aW91cyBmb3IgbG9vcFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBvIG1heSBvcmlnaW5hdGUgaW4gYW5vdGhlciBvcGVyYXRpb24uXG4gICAgICAgIC8vIFNpbmNlIG8gaXMgZGVsZXRlZCwgd2UgaGF2ZSB0byByZXNldCBvLm9yaWdpbidzIGBvcmlnaW5PZmAgcHJvcGVydHlcbiAgICAgICAgaWYgKG8ub3JpZ2luICE9IG51bGwpIHtcbiAgICAgICAgICB2YXIgb3JpZ2luID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uKG8ub3JpZ2luKVxuICAgICAgICAgIG9yaWdpbi5vcmlnaW5PZiA9IG9yaWdpbi5vcmlnaW5PZi5maWx0ZXIoZnVuY3Rpb24gKF9pZCkge1xuICAgICAgICAgICAgcmV0dXJuICFZLnV0aWxzLmNvbXBhcmVJZHMoaWQsIF9pZClcbiAgICAgICAgICB9KVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcmlnaW4pXG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBhcmVudFxuICAgICAgICBpZiAoby5wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIHBhcmVudCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvLnBhcmVudClcbiAgICAgICAgfVxuICAgICAgICAvLyByZW1vdmUgZ2MnZCBvcCBmcm9tIHBhcmVudCwgaWYgaXQgZXhpc3RzXG4gICAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICAgIHZhciBzZXRQYXJlbnQgPSBmYWxzZSAvLyB3aGV0aGVyIHRvIHNhdmUgcGFyZW50IHRvIHRoZSBvc1xuICAgICAgICAgIGlmIChvLnBhcmVudFN1YiAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoWS51dGlscy5jb21wYXJlSWRzKHBhcmVudC5tYXBbby5wYXJlbnRTdWJdLCBvLmlkKSkge1xuICAgICAgICAgICAgICBzZXRQYXJlbnQgPSB0cnVlXG4gICAgICAgICAgICAgIGlmIChvLnJpZ2h0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQubWFwW28ucGFyZW50U3ViXSA9IG8ucmlnaHRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgcGFyZW50Lm1hcFtvLnBhcmVudFN1Yl1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoWS51dGlscy5jb21wYXJlSWRzKHBhcmVudC5zdGFydCwgby5pZCkpIHtcbiAgICAgICAgICAgICAgLy8gZ2MnZCBvcCBpcyB0aGUgc3RhcnRcbiAgICAgICAgICAgICAgc2V0UGFyZW50ID0gdHJ1ZVxuICAgICAgICAgICAgICBwYXJlbnQuc3RhcnQgPSBvLnJpZ2h0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoWS51dGlscy5tYXRjaGVzSWQobywgcGFyZW50LmVuZCkpIHtcbiAgICAgICAgICAgICAgLy8gZ2MnZCBvcCBpcyB0aGUgZW5kXG4gICAgICAgICAgICAgIHNldFBhcmVudCA9IHRydWVcbiAgICAgICAgICAgICAgcGFyZW50LmVuZCA9IG8ubGVmdFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2V0UGFyZW50KSB7XG4gICAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocGFyZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBmaW5hbGx5IHJlbW92ZSBpdCBmcm9tIHRoZSBvc1xuICAgICAgICB5aWVsZCogdGhpcy5yZW1vdmVPcGVyYXRpb24oby5pZClcbiAgICAgIH1cbiAgICB9XG4gICAgKiBjaGVja0RlbGV0ZVN0b3JlRm9yU3RhdGUgKHN0YXRlKSB7XG4gICAgICB2YXIgbiA9IHlpZWxkKiB0aGlzLmRzLmZpbmRXaXRoVXBwZXJCb3VuZChbc3RhdGUudXNlciwgc3RhdGUuY2xvY2tdKVxuICAgICAgaWYgKG4gIT0gbnVsbCAmJiBuLmlkWzBdID09PSBzdGF0ZS51c2VyICYmIG4uZ2MpIHtcbiAgICAgICAgc3RhdGUuY2xvY2sgPSBNYXRoLm1heChzdGF0ZS5jbG9jaywgbi5pZFsxXSArIG4ubGVuKVxuICAgICAgfVxuICAgIH1cbiAgICAqIHVwZGF0ZVN0YXRlICh1c2VyKSB7XG4gICAgICB2YXIgc3RhdGUgPSB5aWVsZCogdGhpcy5nZXRTdGF0ZSh1c2VyKVxuICAgICAgeWllbGQqIHRoaXMuY2hlY2tEZWxldGVTdG9yZUZvclN0YXRlKHN0YXRlKVxuICAgICAgdmFyIG8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oW3VzZXIsIHN0YXRlLmNsb2NrXSlcbiAgICAgIHZhciBvTGVuZ3RoID0gKG8gIT0gbnVsbCAmJiBvLmNvbnRlbnQgIT0gbnVsbCkgPyBvLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgd2hpbGUgKG8gIT0gbnVsbCAmJiB1c2VyID09PSBvLmlkWzBdICYmIG8uaWRbMV0gPD0gc3RhdGUuY2xvY2sgJiYgby5pZFsxXSArIG9MZW5ndGggPiBzdGF0ZS5jbG9jaykge1xuICAgICAgICAvLyBlaXRoZXIgaXRzIGEgbmV3IG9wZXJhdGlvbiAoMS4gY2FzZSksIG9yIGl0IGlzIGFuIG9wZXJhdGlvbiB0aGF0IHdhcyBkZWxldGVkLCBidXQgaXMgbm90IHlldCBpbiB0aGUgT1NcbiAgICAgICAgc3RhdGUuY2xvY2sgKz0gb0xlbmd0aFxuICAgICAgICB5aWVsZCogdGhpcy5jaGVja0RlbGV0ZVN0b3JlRm9yU3RhdGUoc3RhdGUpXG4gICAgICAgIG8gPSB5aWVsZCogdGhpcy5vcy5maW5kTmV4dChvLmlkKVxuICAgICAgICBvTGVuZ3RoID0gKG8gIT0gbnVsbCAmJiBvLmNvbnRlbnQgIT0gbnVsbCkgPyBvLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgfVxuICAgICAgeWllbGQqIHRoaXMuc2V0U3RhdGUoc3RhdGUpXG4gICAgfVxuICAgIC8qXG4gICAgICBhcHBseSBhIGRlbGV0ZSBzZXQgaW4gb3JkZXIgdG8gZ2V0XG4gICAgICB0aGUgc3RhdGUgb2YgdGhlIHN1cHBsaWVkIGRzXG4gICAgKi9cbiAgICAqIGFwcGx5RGVsZXRlU2V0IChkcykge1xuICAgICAgdmFyIGRlbGV0aW9ucyA9IFtdXG5cbiAgICAgIGZvciAodmFyIHVzZXIgaW4gZHMpIHtcbiAgICAgICAgdmFyIGR2ID0gZHNbdXNlcl1cbiAgICAgICAgdmFyIHBvcyA9IDBcbiAgICAgICAgdmFyIGQgPSBkdltwb3NdXG4gICAgICAgIHlpZWxkKiB0aGlzLmRzLml0ZXJhdGUodGhpcywgW3VzZXIsIDBdLCBbdXNlciwgTnVtYmVyLk1BWF9WQUxVRV0sIGZ1bmN0aW9uICogKG4pIHtcbiAgICAgICAgICAvLyBjYXNlczpcbiAgICAgICAgICAvLyAxLiBkIGRlbGV0ZXMgc29tZXRoaW5nIHRvIHRoZSByaWdodCBvZiBuXG4gICAgICAgICAgLy8gID0+IGdvIHRvIG5leHQgbiAoYnJlYWspXG4gICAgICAgICAgLy8gMi4gZCBkZWxldGVzIHNvbWV0aGluZyB0byB0aGUgbGVmdCBvZiBuXG4gICAgICAgICAgLy8gID0+IGNyZWF0ZSBkZWxldGlvbnNcbiAgICAgICAgICAvLyAgPT4gcmVzZXQgZCBhY2NvcmRpbmdseVxuICAgICAgICAgIC8vICAqKT0+IGlmIGQgZG9lc24ndCBkZWxldGUgYW55dGhpbmcgYW55bW9yZSwgZ28gdG8gbmV4dCBkIChjb250aW51ZSlcbiAgICAgICAgICAvLyAzLiBub3QgMikgYW5kIGQgZGVsZXRlcyBzb21ldGhpbmcgdGhhdCBhbHNvIG4gZGVsZXRlc1xuICAgICAgICAgIC8vICA9PiByZXNldCBkIHNvIHRoYXQgaXQgZG9lc24ndCBjb250YWluIG4ncyBkZWxldGlvblxuICAgICAgICAgIC8vICAqKT0+IGlmIGQgZG9lcyBub3QgZGVsZXRlIGFueXRoaW5nIGFueW1vcmUsIGdvIHRvIG5leHQgZCAoY29udGludWUpXG4gICAgICAgICAgd2hpbGUgKGQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIGRpZmYgPSAwIC8vIGRlc2NyaWJlIHRoZSBkaWZmIG9mIGxlbmd0aCBpbiAxKSBhbmQgMilcbiAgICAgICAgICAgIGlmIChuLmlkWzFdICsgbi5sZW4gPD0gZFswXSkge1xuICAgICAgICAgICAgICAvLyAxKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkWzBdIDwgbi5pZFsxXSkge1xuICAgICAgICAgICAgICAvLyAyKVxuICAgICAgICAgICAgICAvLyBkZWxldGUgbWF4aW11bSB0aGUgbGVuIG9mIGRcbiAgICAgICAgICAgICAgLy8gZWxzZSBkZWxldGUgYXMgbXVjaCBhcyBwb3NzaWJsZVxuICAgICAgICAgICAgICBkaWZmID0gTWF0aC5taW4obi5pZFsxXSAtIGRbMF0sIGRbMV0pXG4gICAgICAgICAgICAgIGRlbGV0aW9ucy5wdXNoKFt1c2VyLCBkWzBdLCBkaWZmLCBkWzJdXSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIDMpXG4gICAgICAgICAgICAgIGRpZmYgPSBuLmlkWzFdICsgbi5sZW4gLSBkWzBdIC8vIG5ldmVyIG51bGwgKHNlZSAxKVxuICAgICAgICAgICAgICBpZiAoZFsyXSAmJiAhbi5nYykge1xuICAgICAgICAgICAgICAgIC8vIGQgbWFya3MgYXMgZ2MnZCBidXQgbiBkb2VzIG5vdFxuICAgICAgICAgICAgICAgIC8vIHRoZW4gZGVsZXRlIGVpdGhlciB3YXlcbiAgICAgICAgICAgICAgICBkZWxldGlvbnMucHVzaChbdXNlciwgZFswXSwgTWF0aC5taW4oZGlmZiwgZFsxXSksIGRbMl1dKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZFsxXSA8PSBkaWZmKSB7XG4gICAgICAgICAgICAgIC8vIGQgZG9lc24ndCBkZWxldGUgYW55dGhpbmcgYW55bW9yZVxuICAgICAgICAgICAgICBkID0gZHZbKytwb3NdXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBkWzBdID0gZFswXSArIGRpZmYgLy8gcmVzZXQgcG9zXG4gICAgICAgICAgICAgIGRbMV0gPSBkWzFdIC0gZGlmZiAvLyByZXNldCBsZW5ndGhcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC8vIGZvciB0aGUgcmVzdC4uIGp1c3QgYXBwbHkgaXRcbiAgICAgICAgZm9yICg7IHBvcyA8IGR2Lmxlbmd0aDsgcG9zKyspIHtcbiAgICAgICAgICBkID0gZHZbcG9zXVxuICAgICAgICAgIGRlbGV0aW9ucy5wdXNoKFt1c2VyLCBkWzBdLCBkWzFdLCBkWzJdXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZWxldGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGRlbCA9IGRlbGV0aW9uc1tpXVxuICAgICAgICAvLyBhbHdheXMgdHJ5IHRvIGRlbGV0ZS4uXG4gICAgICAgIHlpZWxkKiB0aGlzLmRlbGV0ZU9wZXJhdGlvbihbZGVsWzBdLCBkZWxbMV1dLCBkZWxbMl0pXG4gICAgICAgIGlmIChkZWxbM10pIHtcbiAgICAgICAgICAvLyBnYy4uXG4gICAgICAgICAgeWllbGQqIHRoaXMubWFya0dhcmJhZ2VDb2xsZWN0ZWQoW2RlbFswXSwgZGVsWzFdXSwgZGVsWzJdKSAvLyBhbHdheXMgbWFyayBnYydkXG4gICAgICAgICAgLy8gcmVtb3ZlIG9wZXJhdGlvbi4uXG4gICAgICAgICAgdmFyIGNvdW50ZXIgPSBkZWxbMV0gKyBkZWxbMl1cbiAgICAgICAgICB3aGlsZSAoY291bnRlciA+PSBkZWxbMV0pIHtcbiAgICAgICAgICAgIHZhciBvID0geWllbGQqIHRoaXMub3MuZmluZFdpdGhVcHBlckJvdW5kKFtkZWxbMF0sIGNvdW50ZXIgLSAxXSlcbiAgICAgICAgICAgIGlmIChvID09IG51bGwpIHtcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBvTGVuID0gby5jb250ZW50ICE9IG51bGwgPyBvLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgICAgICAgaWYgKG8uaWRbMF0gIT09IGRlbFswXSB8fCBvLmlkWzFdICsgb0xlbiA8PSBkZWxbMV0pIHtcbiAgICAgICAgICAgICAgLy8gbm90IGluIHJhbmdlXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoby5pZFsxXSArIG9MZW4gPiBkZWxbMV0gKyBkZWxbMl0pIHtcbiAgICAgICAgICAgICAgLy8gb3ZlcmxhcHMgcmlnaHRcbiAgICAgICAgICAgICAgbyA9IHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKFtkZWxbMF0sIGRlbFsxXSArIGRlbFsyXSAtIDFdKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG8uaWRbMV0gPCBkZWxbMV0pIHtcbiAgICAgICAgICAgICAgLy8gb3ZlcmxhcHMgbGVmdFxuICAgICAgICAgICAgICBvID0geWllbGQqIHRoaXMuZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydChbZGVsWzBdLCBkZWxbMV1dKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY291bnRlciA9IG8uaWRbMV1cbiAgICAgICAgICAgIHlpZWxkKiB0aGlzLmdhcmJhZ2VDb2xsZWN0T3BlcmF0aW9uKG8uaWQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0b3JlLmZvcndhcmRBcHBsaWVkT3BlcmF0aW9ucykge1xuICAgICAgICAgIHZhciBvcHMgPSBbXVxuICAgICAgICAgIG9wcy5wdXNoKHtzdHJ1Y3Q6ICdEZWxldGUnLCB0YXJnZXQ6IFtkZWxbMF0sIGRlbFsxXV0sIGxlbmd0aDogZGVsWzJdfSlcbiAgICAgICAgICB0aGlzLnN0b3JlLnkuY29ubmVjdG9yLmJyb2FkY2FzdE9wcyhvcHMpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBpc0dhcmJhZ2VDb2xsZWN0ZWQgKGlkKSB7XG4gICAgICB2YXIgbiA9IHlpZWxkKiB0aGlzLmRzLmZpbmRXaXRoVXBwZXJCb3VuZChpZClcbiAgICAgIHJldHVybiBuICE9IG51bGwgJiYgbi5pZFswXSA9PT0gaWRbMF0gJiYgaWRbMV0gPCBuLmlkWzFdICsgbi5sZW4gJiYgbi5nY1xuICAgIH1cbiAgICAvKlxuICAgICAgQSBEZWxldGVTZXQgKGRzKSBkZXNjcmliZXMgYWxsIHRoZSBkZWxldGVkIG9wcyBpbiB0aGUgT1NcbiAgICAqL1xuICAgICogZ2V0RGVsZXRlU2V0ICgpIHtcbiAgICAgIHZhciBkcyA9IHt9XG4gICAgICB5aWVsZCogdGhpcy5kcy5pdGVyYXRlKHRoaXMsIG51bGwsIG51bGwsIGZ1bmN0aW9uICogKG4pIHtcbiAgICAgICAgdmFyIHVzZXIgPSBuLmlkWzBdXG4gICAgICAgIHZhciBjb3VudGVyID0gbi5pZFsxXVxuICAgICAgICB2YXIgbGVuID0gbi5sZW5cbiAgICAgICAgdmFyIGdjID0gbi5nY1xuICAgICAgICB2YXIgZHYgPSBkc1t1c2VyXVxuICAgICAgICBpZiAoZHYgPT09IHZvaWQgMCkge1xuICAgICAgICAgIGR2ID0gW11cbiAgICAgICAgICBkc1t1c2VyXSA9IGR2XG4gICAgICAgIH1cbiAgICAgICAgZHYucHVzaChbY291bnRlciwgbGVuLCBnY10pXG4gICAgICB9KVxuICAgICAgcmV0dXJuIGRzXG4gICAgfVxuICAgICogaXNEZWxldGVkIChpZCkge1xuICAgICAgdmFyIG4gPSB5aWVsZCogdGhpcy5kcy5maW5kV2l0aFVwcGVyQm91bmQoaWQpXG4gICAgICByZXR1cm4gbiAhPSBudWxsICYmIG4uaWRbMF0gPT09IGlkWzBdICYmIGlkWzFdIDwgbi5pZFsxXSArIG4ubGVuXG4gICAgfVxuICAgICogc2V0T3BlcmF0aW9uIChvcCkge1xuICAgICAgeWllbGQqIHRoaXMub3MucHV0KG9wKVxuICAgICAgcmV0dXJuIG9wXG4gICAgfVxuICAgICogYWRkT3BlcmF0aW9uIChvcCkge1xuICAgICAgeWllbGQqIHRoaXMub3MucHV0KG9wKVxuICAgICAgaWYgKHRoaXMuc3RvcmUuZm9yd2FyZEFwcGxpZWRPcGVyYXRpb25zICYmIHR5cGVvZiBvcC5pZFsxXSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gaXMgY29ubmVjdGVkLCBhbmQgdGhpcyBpcyBub3QgZ29pbmcgdG8gYmUgc2VuZCBpbiBhZGRPcGVyYXRpb25cbiAgICAgICAgdGhpcy5zdG9yZS55LmNvbm5lY3Rvci5icm9hZGNhc3RPcHMoW29wXSlcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgaW5zZXJ0aW9uLCB0cnkgdG8gY29tYmluZSB3aXRoIGxlZnQgaW5zZXJ0aW9uIChpZiBib3RoIGhhdmUgY29udGVudCBwcm9wZXJ0eSlcbiAgICAqIHRyeUNvbWJpbmVXaXRoTGVmdCAob3ApIHtcbiAgICAgIGlmIChcbiAgICAgICAgb3AgIT0gbnVsbCAmJlxuICAgICAgICBvcC5sZWZ0ICE9IG51bGwgJiZcbiAgICAgICAgb3AuY29udGVudCAhPSBudWxsICYmXG4gICAgICAgIG9wLmxlZnRbMF0gPT09IG9wLmlkWzBdICYmXG4gICAgICAgIFkudXRpbHMuY29tcGFyZUlkcyhvcC5sZWZ0LCBvcC5vcmlnaW4pXG4gICAgICApIHtcbiAgICAgICAgdmFyIGxlZnQgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24ob3AubGVmdClcbiAgICAgICAgaWYgKGxlZnQuY29udGVudCAhPSBudWxsICYmXG4gICAgICAgICAgICBsZWZ0LmlkWzFdICsgbGVmdC5jb250ZW50Lmxlbmd0aCA9PT0gb3AuaWRbMV0gJiZcbiAgICAgICAgICAgIGxlZnQub3JpZ2luT2YubGVuZ3RoID09PSAxICYmXG4gICAgICAgICAgICAhbGVmdC5nYyAmJiAhbGVmdC5kZWxldGVkICYmXG4gICAgICAgICAgICAhb3AuZ2MgJiYgIW9wLmRlbGV0ZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gY29tYmluZSFcbiAgICAgICAgICBpZiAob3Aub3JpZ2luT2YgIT0gbnVsbCkge1xuICAgICAgICAgICAgbGVmdC5vcmlnaW5PZiA9IG9wLm9yaWdpbk9mXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsZWZ0Lm9yaWdpbk9mXG4gICAgICAgICAgfVxuICAgICAgICAgIGxlZnQuY29udGVudCA9IGxlZnQuY29udGVudC5jb25jYXQob3AuY29udGVudClcbiAgICAgICAgICBsZWZ0LnJpZ2h0ID0gb3AucmlnaHRcbiAgICAgICAgICB5aWVsZCogdGhpcy5vcy5kZWxldGUob3AuaWQpXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKGxlZnQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgKiBnZXRJbnNlcnRpb24gKGlkKSB7XG4gICAgICB2YXIgaW5zID0geWllbGQqIHRoaXMub3MuZmluZFdpdGhVcHBlckJvdW5kKGlkKVxuICAgICAgaWYgKGlucyA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbGVuID0gaW5zLmNvbnRlbnQgIT0gbnVsbCA/IGlucy5jb250ZW50Lmxlbmd0aCA6IDEgLy8gaW4gY2FzZSBvZiBvcENvbnRlbnRcbiAgICAgICAgaWYgKGlkWzBdID09PSBpbnMuaWRbMF0gJiYgaWRbMV0gPCBpbnMuaWRbMV0gKyBsZW4pIHtcbiAgICAgICAgICByZXR1cm4gaW5zXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAqIGdldEluc2VydGlvbkNsZWFuU3RhcnRFbmQgKGlkKSB7XG4gICAgICB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb25DbGVhblN0YXJ0KGlkKVxuICAgICAgcmV0dXJuIHlpZWxkKiB0aGlzLmdldEluc2VydGlvbkNsZWFuRW5kKGlkKVxuICAgIH1cbiAgICAvLyBSZXR1cm4gYW4gaW5zZXJ0aW9uIHN1Y2ggdGhhdCBpZCBpcyB0aGUgZmlyc3QgZWxlbWVudCBvZiBjb250ZW50XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBtYW5pcHVsYXRlcyBhbiBvcGVyYXRpb24sIGlmIG5lY2Vzc2FyeVxuICAgICogZ2V0SW5zZXJ0aW9uQ2xlYW5TdGFydCAoaWQpIHtcbiAgICAgIHZhciBpbnMgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oaWQpXG4gICAgICBpZiAoaW5zICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGlucy5pZFsxXSA9PT0gaWRbMV0pIHtcbiAgICAgICAgICByZXR1cm4gaW5zXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGxlZnQgPSBZLnV0aWxzLmNvcHlPYmplY3QoaW5zKVxuICAgICAgICAgIGlucy5jb250ZW50ID0gbGVmdC5jb250ZW50LnNwbGljZShpZFsxXSAtIGlucy5pZFsxXSlcbiAgICAgICAgICBpbnMuaWQgPSBpZFxuICAgICAgICAgIHZhciBsZWZ0TGlkID0gWS51dGlscy5nZXRMYXN0SWQobGVmdClcbiAgICAgICAgICBpbnMub3JpZ2luID0gbGVmdExpZFxuICAgICAgICAgIGxlZnQub3JpZ2luT2YgPSBbaW5zLmlkXVxuICAgICAgICAgIGxlZnQucmlnaHQgPSBpbnMuaWRcbiAgICAgICAgICBpbnMubGVmdCA9IGxlZnRMaWRcbiAgICAgICAgICAvLyBkZWJ1Z2dlciAvLyBjaGVja1xuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihsZWZ0KVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihpbnMpXG4gICAgICAgICAgaWYgKGxlZnQuZ2MpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcmUucXVldWVHYXJiYWdlQ29sbGVjdG9yKGlucy5pZClcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZXR1cm4gYW4gaW5zZXJ0aW9uIHN1Y2ggdGhhdCBpZCBpcyB0aGUgbGFzdCBlbGVtZW50IG9mIGNvbnRlbnRcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIG1hbmlwdWxhdGVzIGFuIG9wZXJhdGlvbiwgaWYgbmVjZXNzYXJ5XG4gICAgKiBnZXRJbnNlcnRpb25DbGVhbkVuZCAoaWQpIHtcbiAgICAgIHZhciBpbnMgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oaWQpXG4gICAgICBpZiAoaW5zICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGlucy5jb250ZW50ID09IG51bGwgfHwgKGlucy5pZFsxXSArIGlucy5jb250ZW50Lmxlbmd0aCAtIDEgPT09IGlkWzFdKSkge1xuICAgICAgICAgIHJldHVybiBpbnNcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgcmlnaHQgPSBZLnV0aWxzLmNvcHlPYmplY3QoaW5zKVxuICAgICAgICAgIHJpZ2h0LmNvbnRlbnQgPSBpbnMuY29udGVudC5zcGxpY2UoaWRbMV0gLSBpbnMuaWRbMV0gKyAxKSAvLyBjdXQgb2ZmIHJlbWFpbmRlclxuICAgICAgICAgIHJpZ2h0LmlkID0gW2lkWzBdLCBpZFsxXSArIDFdXG4gICAgICAgICAgdmFyIGluc0xpZCA9IFkudXRpbHMuZ2V0TGFzdElkKGlucylcbiAgICAgICAgICByaWdodC5vcmlnaW4gPSBpbnNMaWRcbiAgICAgICAgICBpbnMub3JpZ2luT2YgPSBbcmlnaHQuaWRdXG4gICAgICAgICAgaW5zLnJpZ2h0ID0gcmlnaHQuaWRcbiAgICAgICAgICByaWdodC5sZWZ0ID0gaW5zTGlkXG4gICAgICAgICAgLy8gZGVidWdnZXIgLy8gY2hlY2tcbiAgICAgICAgICB5aWVsZCogdGhpcy5zZXRPcGVyYXRpb24ocmlnaHQpXG4gICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKGlucylcbiAgICAgICAgICBpZiAoaW5zLmdjKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3JlLnF1ZXVlR2FyYmFnZUNvbGxlY3RvcihyaWdodC5pZClcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgIH1cbiAgICAqIGdldE9wZXJhdGlvbiAoaWQvKiA6YW55ICovKS8qIDpUcmFuc2FjdGlvbjxhbnk+ICovIHtcbiAgICAgIHZhciBvID0geWllbGQqIHRoaXMub3MuZmluZChpZClcbiAgICAgIGlmIChpZFswXSAhPT0gJ18nIHx8IG8gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gb1xuICAgICAgfSBlbHNlIHsgLy8gdHlwZSBpcyBzdHJpbmdcbiAgICAgICAgLy8gZ2VuZXJhdGUgdGhpcyBvcGVyYXRpb24/XG4gICAgICAgIHZhciBjb21wID0gaWRbMV0uc3BsaXQoJ18nKVxuICAgICAgICBpZiAoY29tcC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdmFyIHN0cnVjdCA9IGNvbXBbMF1cbiAgICAgICAgICB2YXIgb3AgPSBZLlN0cnVjdFtzdHJ1Y3RdLmNyZWF0ZShpZClcbiAgICAgICAgICBvcC50eXBlID0gY29tcFsxXVxuICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihvcClcbiAgICAgICAgICByZXR1cm4gb3BcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3b24ndCBiZSBjYWxsZWQuIGJ1dCBqdXN0IGluIGNhc2UuLlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuZXhwZWN0ZWQgY2FzZS4gSG93IGNhbiB0aGlzIGhhcHBlbj8nKVxuICAgICAgICAgIGRlYnVnZ2VyIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgICogcmVtb3ZlT3BlcmF0aW9uIChpZCkge1xuICAgICAgeWllbGQqIHRoaXMub3MuZGVsZXRlKGlkKVxuICAgIH1cbiAgICAqIHNldFN0YXRlIChzdGF0ZSkge1xuICAgICAgdmFyIHZhbCA9IHtcbiAgICAgICAgaWQ6IFtzdGF0ZS51c2VyXSxcbiAgICAgICAgY2xvY2s6IHN0YXRlLmNsb2NrXG4gICAgICB9XG4gICAgICB5aWVsZCogdGhpcy5zcy5wdXQodmFsKVxuICAgIH1cbiAgICAqIGdldFN0YXRlICh1c2VyKSB7XG4gICAgICB2YXIgbiA9IHlpZWxkKiB0aGlzLnNzLmZpbmQoW3VzZXJdKVxuICAgICAgdmFyIGNsb2NrID0gbiA9PSBudWxsID8gbnVsbCA6IG4uY2xvY2tcbiAgICAgIGlmIChjbG9jayA9PSBudWxsKSB7XG4gICAgICAgIGNsb2NrID0gMFxuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdXNlcjogdXNlcixcbiAgICAgICAgY2xvY2s6IGNsb2NrXG4gICAgICB9XG4gICAgfVxuICAgICogZ2V0U3RhdGVWZWN0b3IgKCkge1xuICAgICAgdmFyIHN0YXRlVmVjdG9yID0gW11cbiAgICAgIHlpZWxkKiB0aGlzLnNzLml0ZXJhdGUodGhpcywgbnVsbCwgbnVsbCwgZnVuY3Rpb24gKiAobikge1xuICAgICAgICBzdGF0ZVZlY3Rvci5wdXNoKHtcbiAgICAgICAgICB1c2VyOiBuLmlkWzBdLFxuICAgICAgICAgIGNsb2NrOiBuLmNsb2NrXG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHN0YXRlVmVjdG9yXG4gICAgfVxuICAgICogZ2V0U3RhdGVTZXQgKCkge1xuICAgICAgdmFyIHNzID0ge31cbiAgICAgIHlpZWxkKiB0aGlzLnNzLml0ZXJhdGUodGhpcywgbnVsbCwgbnVsbCwgZnVuY3Rpb24gKiAobikge1xuICAgICAgICBzc1tuLmlkWzBdXSA9IG4uY2xvY2tcbiAgICAgIH0pXG4gICAgICByZXR1cm4gc3NcbiAgICB9XG4gICAgLypcbiAgICAgIEhlcmUsIHdlIG1ha2UgYWxsIG1pc3Npbmcgb3BlcmF0aW9ucyBleGVjdXRhYmxlIGZvciB0aGUgcmVjZWl2aW5nIHVzZXIuXG5cbiAgICAgIE5vdGVzOlxuICAgICAgICBzdGFydFNTOiBkZW5vdGVzIHRvIHRoZSBTViB0aGF0IHRoZSByZW1vdGUgdXNlciBzZW50XG4gICAgICAgIGN1cnJTUzogIGRlbm90ZXMgdG8gdGhlIHN0YXRlIHZlY3RvciB0aGF0IHRoZSB1c2VyIHNob3VsZCBoYXZlIGlmIGhlXG4gICAgICAgICAgICAgICAgIGFwcGxpZXMgYWxsIGFscmVhZHkgc2VudCBvcGVyYXRpb25zIChpbmNyZWFzZXMgaXMgZWFjaCBzdGVwKVxuXG4gICAgICBXZSBmYWNlIHNldmVyYWwgcHJvYmxlbXM6XG4gICAgICAqIEV4ZWN1dGUgb3AgYXMgaXMgd29uJ3Qgd29yayBiZWNhdXNlIG9wcyBkZXBlbmQgb24gZWFjaCBvdGhlclxuICAgICAgIC0+IGZpbmQgYSB3YXkgc28gdGhhdCB0aGV5IGRvIG5vdCBhbnltb3JlXG4gICAgICAqIFdoZW4gY2hhbmdpbmcgbGVmdCwgbXVzdCBub3QgZ28gbW9yZSB0byB0aGUgbGVmdCB0aGFuIHRoZSBvcmlnaW5cbiAgICAgICogV2hlbiBjaGFuZ2luZyByaWdodCwgeW91IGhhdmUgdG8gY29uc2lkZXIgdGhhdCBvdGhlciBvcHMgbWF5IGhhdmUgb3BcbiAgICAgICAgYXMgdGhlaXIgb3JpZ2luLCB0aGlzIG1lYW5zIHRoYXQgeW91IG11c3Qgbm90IHNldCBvbmUgb2YgdGhlc2Ugb3BzXG4gICAgICAgIGFzIHRoZSBuZXcgcmlnaHQgKGludGVyZGVwZW5kZW5jaWVzIG9mIG9wcylcbiAgICAgICogY2FuJ3QganVzdCBnbyB0byB0aGUgcmlnaHQgdW50aWwgeW91IGZpbmQgdGhlIGZpcnN0IGtub3duIG9wZXJhdGlvbixcbiAgICAgICAgV2l0aCBjdXJyU1NcbiAgICAgICAgICAtPiBpbnRlcmRlcGVuZGVuY3kgb2Ygb3BzIGlzIGEgcHJvYmxlbVxuICAgICAgICBXaXRoIHN0YXJ0U1NcbiAgICAgICAgICAtPiBsZWFkcyB0byBpbmNvbnNpc3RlbmNpZXMgd2hlbiB0d28gdXNlcnMgam9pbiBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgICAgICAgIFRoZW4gdGhlIHBvc2l0aW9uIGRlcGVuZHMgb24gdGhlIG9yZGVyIG9mIGV4ZWN1dGlvbiAtPiBlcnJvciFcblxuICAgICAgICBTb2x1dGlvbjpcbiAgICAgICAgLT4gcmUtY3JlYXRlIG9yaWdpbmlhbCBzaXR1YXRpb25cbiAgICAgICAgICAtPiBzZXQgb3AubGVmdCA9IG9wLm9yaWdpbiAod2hpY2ggbmV2ZXIgY2hhbmdlcylcbiAgICAgICAgICAtPiBzZXQgb3AucmlnaHRcbiAgICAgICAgICAgICAgIHRvIHRoZSBmaXJzdCBvcGVyYXRpb24gdGhhdCBpcyBrbm93biAoYWNjb3JkaW5nIHRvIHN0YXJ0U1MpXG4gICAgICAgICAgICAgICBvciB0byB0aGUgZmlyc3Qgb3BlcmF0aW9uIHRoYXQgaGFzIGFuIG9yaWdpbiB0aGF0IGlzIG5vdCB0byB0aGVcbiAgICAgICAgICAgICAgIHJpZ2h0IG9mIG9wLlxuICAgICAgICAgIC0+IEVuZm9yY2VzIHVuaXF1ZSBleGVjdXRpb24gb3JkZXIgLT4gaGFwcHkgdXNlclxuXG4gICAgICAgIEltcHJvdmVtZW50czogVE9ET1xuICAgICAgICAgICogQ291bGQgc2V0IGxlZnQgdG8gb3JpZ2luLCBvciB0aGUgZmlyc3Qga25vd24gb3BlcmF0aW9uXG4gICAgICAgICAgICAoc3RhcnRTUyBvciBjdXJyU1MuLiA/KVxuICAgICAgICAgICAgLT4gQ291bGQgYmUgbmVjZXNzYXJ5IHdoZW4gSSB0dXJuIEdDIGFnYWluLlxuICAgICAgICAgICAgLT4gSXMgYSBiYWQoaXNoKSBpZGVhIGJlY2F1c2UgaXQgcmVxdWlyZXMgbW9yZSBjb21wdXRhdGlvblxuXG4gICAgICBXaGF0IHdlIGRvOlxuICAgICAgKiBJdGVyYXRlIG92ZXIgYWxsIG1pc3Npbmcgb3BlcmF0aW9ucy5cbiAgICAgICogV2hlbiB0aGVyZSBpcyBhbiBvcGVyYXRpb24sIHdoZXJlIHRoZSByaWdodCBvcCBpcyBrbm93biwgc2VuZCB0aGlzIG9wIGFsbCBtaXNzaW5nIG9wcyB0byB0aGUgbGVmdCB0byB0aGUgdXNlclxuICAgICAgKiBJIGV4cGxhaW5lZCBhYm92ZSB3aGF0IHdlIGhhdmUgdG8gZG8gd2l0aCBlYWNoIG9wZXJhdGlvbi4gSGVyZSBpcyBob3cgd2UgZG8gaXQgZWZmaWNpZW50bHk6XG4gICAgICAgIDEuIEdvIHRvIHRoZSBsZWZ0IHVudGlsIHlvdSBmaW5kIGVpdGhlciBvcC5vcmlnaW4sIG9yIGEga25vd24gb3BlcmF0aW9uIChsZXQgbyBkZW5vdGUgY3VycmVudCBvcGVyYXRpb24gaW4gdGhlIGl0ZXJhdGlvbilcbiAgICAgICAgMi4gRm91bmQgYSBrbm93biBvcGVyYXRpb24gLT4gc2V0IG9wLmxlZnQgPSBvLCBhbmQgc2VuZCBpdCB0byB0aGUgdXNlci4gc3RvcFxuICAgICAgICAzLiBGb3VuZCBvID0gb3Aub3JpZ2luIC0+IHNldCBvcC5sZWZ0ID0gb3Aub3JpZ2luLCBhbmQgc2VuZCBpdCB0byB0aGUgdXNlci4gc3RhcnQgYWdhaW4gZnJvbSAxLiAoc2V0IG9wID0gbylcbiAgICAgICAgNC4gRm91bmQgc29tZSBvIC0+IHNldCBvLnJpZ2h0ID0gb3AsIG8ubGVmdCA9IG8ub3JpZ2luLCBzZW5kIGl0IHRvIHRoZSB1c2VyLCBjb250aW51ZVxuICAgICovXG4gICAgKiBnZXRPcGVyYXRpb25zIChzdGFydFNTKSB7XG4gICAgICAvLyBUT0RPOiB1c2UgYm91bmRzIGhlcmUhXG4gICAgICBpZiAoc3RhcnRTUyA9PSBudWxsKSB7XG4gICAgICAgIHN0YXJ0U1MgPSB7fVxuICAgICAgfVxuICAgICAgdmFyIHNlbmQgPSBbXVxuXG4gICAgICB2YXIgZW5kU1YgPSB5aWVsZCogdGhpcy5nZXRTdGF0ZVZlY3RvcigpXG4gICAgICBmb3IgKHZhciBlbmRTdGF0ZSBvZiBlbmRTVikge1xuICAgICAgICB2YXIgdXNlciA9IGVuZFN0YXRlLnVzZXJcbiAgICAgICAgaWYgKHVzZXIgPT09ICdfJykge1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgICAgdmFyIHN0YXJ0UG9zID0gc3RhcnRTU1t1c2VyXSB8fCAwXG4gICAgICAgIGlmIChzdGFydFBvcyA+IDApIHtcbiAgICAgICAgICAvLyBUaGVyZSBpcyBhIGNoYW5nZSB0aGF0IFt1c2VyLCBzdGFydFBvc10gaXMgaW4gYSBjb21wb3NlZCBJbnNlcnRpb24gKHdpdGggYSBzbWFsbGVyIGNvdW50ZXIpXG4gICAgICAgICAgLy8gZmluZCBvdXQgaWYgdGhhdCBpcyB0aGUgY2FzZVxuICAgICAgICAgIHZhciBmaXJzdE1pc3NpbmcgPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oW3VzZXIsIHN0YXJ0UG9zXSlcbiAgICAgICAgICBpZiAoZmlyc3RNaXNzaW5nICE9IG51bGwpIHtcbiAgICAgICAgICAgIC8vIHVwZGF0ZSBzdGFydFBvc1xuICAgICAgICAgICAgc3RhcnRQb3MgPSBmaXJzdE1pc3NpbmcuaWRbMV1cbiAgICAgICAgICAgIHN0YXJ0U1NbdXNlcl0gPSBzdGFydFBvc1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB5aWVsZCogdGhpcy5vcy5pdGVyYXRlKHRoaXMsIFt1c2VyLCBzdGFydFBvc10sIFt1c2VyLCBOdW1iZXIuTUFYX1ZBTFVFXSwgZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgICBvcCA9IFkuU3RydWN0W29wLnN0cnVjdF0uZW5jb2RlKG9wKVxuICAgICAgICAgIGlmIChvcC5zdHJ1Y3QgIT09ICdJbnNlcnQnKSB7XG4gICAgICAgICAgICBzZW5kLnB1c2gob3ApXG4gICAgICAgICAgfSBlbHNlIGlmIChvcC5yaWdodCA9PSBudWxsIHx8IG9wLnJpZ2h0WzFdIDwgKHN0YXJ0U1Nbb3AucmlnaHRbMF1dIHx8IDApKSB7XG4gICAgICAgICAgICAvLyBjYXNlIDEuIG9wLnJpZ2h0IGlzIGtub3duXG4gICAgICAgICAgICB2YXIgbyA9IG9wXG4gICAgICAgICAgICAvLyBSZW1lbWJlcjogP1xuICAgICAgICAgICAgLy8gLT4gc2V0IG9wLnJpZ2h0XG4gICAgICAgICAgICAvLyAgICAxLiB0byB0aGUgZmlyc3Qgb3BlcmF0aW9uIHRoYXQgaXMga25vd24gKGFjY29yZGluZyB0byBzdGFydFNTKVxuICAgICAgICAgICAgLy8gICAgMi4gb3IgdG8gdGhlIGZpcnN0IG9wZXJhdGlvbiB0aGF0IGhhcyBhbiBvcmlnaW4gdGhhdCBpcyBub3QgdG8gdGhlXG4gICAgICAgICAgICAvLyAgICAgIHJpZ2h0IG9mIG9wLlxuICAgICAgICAgICAgLy8gRm9yIHRoaXMgd2UgbWFpbnRhaW4gYSBsaXN0IG9mIG9wcyB3aGljaCBvcmlnaW5zIGFyZSBub3QgZm91bmQgeWV0LlxuICAgICAgICAgICAgdmFyIG1pc3Npbmdfb3JpZ2lucyA9IFtvcF1cbiAgICAgICAgICAgIHZhciBuZXdyaWdodCA9IG9wLnJpZ2h0XG4gICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgICBpZiAoby5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBvcC5sZWZ0ID0gbnVsbFxuICAgICAgICAgICAgICAgIHNlbmQucHVzaChvcClcbiAgICAgICAgICAgICAgICBpZiAoIVkudXRpbHMuY29tcGFyZUlkcyhvLmlkLCBvcC5pZCkpIHtcbiAgICAgICAgICAgICAgICAgIG8gPSBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvKVxuICAgICAgICAgICAgICAgICAgby5yaWdodCA9IG1pc3Npbmdfb3JpZ2luc1ttaXNzaW5nX29yaWdpbnMubGVuZ3RoIC0gMV0uaWRcbiAgICAgICAgICAgICAgICAgIHNlbmQucHVzaChvKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIG8gPSB5aWVsZCogdGhpcy5nZXRJbnNlcnRpb24oby5sZWZ0KVxuICAgICAgICAgICAgICAvLyB3ZSBzZXQgYW5vdGhlciBvLCBjaGVjayBpZiB3ZSBjYW4gcmVkdWNlICRtaXNzaW5nX29yaWdpbnNcbiAgICAgICAgICAgICAgd2hpbGUgKG1pc3Npbmdfb3JpZ2lucy5sZW5ndGggPiAwICYmIFkudXRpbHMubWF0Y2hlc0lkKG8sIG1pc3Npbmdfb3JpZ2luc1ttaXNzaW5nX29yaWdpbnMubGVuZ3RoIC0gMV0ub3JpZ2luKSkge1xuICAgICAgICAgICAgICAgIG1pc3Npbmdfb3JpZ2lucy5wb3AoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChvLmlkWzFdIDwgKHN0YXJ0U1Nbby5pZFswXV0gfHwgMCkpIHtcbiAgICAgICAgICAgICAgICAvLyBjYXNlIDIuIG8gaXMga25vd25cbiAgICAgICAgICAgICAgICBvcC5sZWZ0ID0gWS51dGlscy5nZXRMYXN0SWQobylcbiAgICAgICAgICAgICAgICBzZW5kLnB1c2gob3ApXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChZLnV0aWxzLm1hdGNoZXNJZChvLCBvcC5vcmlnaW4pKSB7XG4gICAgICAgICAgICAgICAgLy8gY2FzZSAzLiBvIGlzIG9wLm9yaWdpblxuICAgICAgICAgICAgICAgIG9wLmxlZnQgPSBvcC5vcmlnaW5cbiAgICAgICAgICAgICAgICBzZW5kLnB1c2gob3ApXG4gICAgICAgICAgICAgICAgb3AgPSBZLlN0cnVjdFtvcC5zdHJ1Y3RdLmVuY29kZShvKVxuICAgICAgICAgICAgICAgIG9wLnJpZ2h0ID0gbmV3cmlnaHRcbiAgICAgICAgICAgICAgICBpZiAobWlzc2luZ19vcmlnaW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdUaGlzIHNob3VsZCBub3QgaGFwcGVuIC4uIDooIHBsZWFzZSByZXBvcnQgdGhpcycpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1pc3Npbmdfb3JpZ2lucyA9IFtvcF1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBjYXNlIDQuIHNlbmQgbywgY29udGludWUgdG8gZmluZCBvcC5vcmlnaW5cbiAgICAgICAgICAgICAgICB2YXIgcyA9IFkuU3RydWN0W29wLnN0cnVjdF0uZW5jb2RlKG8pXG4gICAgICAgICAgICAgICAgcy5yaWdodCA9IG1pc3Npbmdfb3JpZ2luc1ttaXNzaW5nX29yaWdpbnMubGVuZ3RoIC0gMV0uaWRcbiAgICAgICAgICAgICAgICBzLmxlZnQgPSBzLm9yaWdpblxuICAgICAgICAgICAgICAgIHNlbmQucHVzaChzKVxuICAgICAgICAgICAgICAgIG1pc3Npbmdfb3JpZ2lucy5wdXNoKG8pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm4gc2VuZC5yZXZlcnNlKClcbiAgICB9XG4gICAgLypcbiAgICAgKiBHZXQgdGhlIHBsYWluIHVudHJhbnNmb3JtZWQgb3BlcmF0aW9ucyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICAgKiBZb3UgY2FuIGFwcGx5IHRoZXNlIG9wZXJhdGlvbnMgdXNpbmcgLmFwcGx5T3BlcmF0aW9uc1VudHJhbnNmb3JtZWQob3BzKVxuICAgICAqXG4gICAgICovXG4gICAgKiBnZXRPcGVyYXRpb25zVW50cmFuc2Zvcm1lZCAoKSB7XG4gICAgICB2YXIgb3BzID0gW11cbiAgICAgIHlpZWxkKiB0aGlzLm9zLml0ZXJhdGUodGhpcywgbnVsbCwgbnVsbCwgZnVuY3Rpb24gKiAob3ApIHtcbiAgICAgICAgaWYgKG9wLmlkWzBdICE9PSAnXycpIHtcbiAgICAgICAgICBvcHMucHVzaChvcClcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHVudHJhbnNmb3JtZWQ6IG9wc1xuICAgICAgfVxuICAgIH1cbiAgICAqIGFwcGx5T3BlcmF0aW9uc1VudHJhbnNmb3JtZWQgKG0sIHN0YXRlU2V0KSB7XG4gICAgICB2YXIgb3BzID0gbS51bnRyYW5zZm9ybWVkXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgb3AgPSBvcHNbaV1cbiAgICAgICAgLy8gY3JlYXRlLCBhbmQgbW9kaWZ5IHBhcmVudCwgaWYgaXQgaXMgY3JlYXRlZCBpbXBsaWNpdGx5XG4gICAgICAgIGlmIChvcC5wYXJlbnQgIT0gbnVsbCAmJiBvcC5wYXJlbnRbMF0gPT09ICdfJykge1xuICAgICAgICAgIGlmIChvcC5zdHJ1Y3QgPT09ICdJbnNlcnQnKSB7XG4gICAgICAgICAgICAvLyB1cGRhdGUgcGFyZW50cyAubWFwL3N0YXJ0L2VuZCBwcm9wZXJ0aWVzXG4gICAgICAgICAgICBpZiAob3AucGFyZW50U3ViICE9IG51bGwgJiYgb3AubGVmdCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIC8vIG9wIGlzIGNoaWxkIG9mIE1hcFxuICAgICAgICAgICAgICBsZXQgcGFyZW50ID0geWllbGQqIHRoaXMuZ2V0T3BlcmF0aW9uKG9wLnBhcmVudClcbiAgICAgICAgICAgICAgcGFyZW50Lm1hcFtvcC5wYXJlbnRTdWJdID0gb3AuaWRcbiAgICAgICAgICAgICAgeWllbGQqIHRoaXMuc2V0T3BlcmF0aW9uKHBhcmVudClcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3AucmlnaHQgPT0gbnVsbCB8fCBvcC5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgbGV0IHBhcmVudCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvcC5wYXJlbnQpXG4gICAgICAgICAgICAgIGlmIChvcC5yaWdodCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LmVuZCA9IFkudXRpbHMuZ2V0TGFzdElkKG9wKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChvcC5sZWZ0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuc3RhcnQgPSBvcC5pZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHlpZWxkKiB0aGlzLnNldE9wZXJhdGlvbihwYXJlbnQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHlpZWxkKiB0aGlzLm9zLnB1dChvcClcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIHVzZXIgaW4gc3RhdGVTZXQpIHtcbiAgICAgICAgeWllbGQqIHRoaXMuc3MucHV0KHtcbiAgICAgICAgICBpZDogW3VzZXJdLFxuICAgICAgICAgIGNsb2NrOiBzdGF0ZVNldFt1c2VyXVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgICAvKiB0aGlzIGlzIHdoYXQgd2UgdXNlZCBiZWZvcmUuLiB1c2UgdGhpcyBhcyBhIHJlZmVyZW5jZS4uXG4gICAgKiBtYWtlT3BlcmF0aW9uUmVhZHkgKHN0YXJ0U1MsIG9wKSB7XG4gICAgICBvcCA9IFkuU3RydWN0W29wLnN0cnVjdF0uZW5jb2RlKG9wKVxuICAgICAgb3AgPSBZLnV0aWxzLmNvcHlPYmplY3Qob3ApIC0tIHVzZSBjb3B5b3BlcmF0aW9uIGluc3RlYWQgbm93IVxuICAgICAgdmFyIG8gPSBvcFxuICAgICAgdmFyIGlkcyA9IFtvcC5pZF1cbiAgICAgIC8vIHNlYXJjaCBmb3IgdGhlIG5ldyBvcC5yaWdodFxuICAgICAgLy8gaXQgaXMgZWl0aGVyIHRoZSBmaXJzdCBrbm93biBvcCAoYWNjb3JkaW5nIHRvIHN0YXJ0U1MpXG4gICAgICAvLyBvciB0aGUgbyB0aGF0IGhhcyBubyBvcmlnaW4gdG8gdGhlIHJpZ2h0IG9mIG9wXG4gICAgICAvLyAodGhpcyBpcyB3aHkgd2UgdXNlIHRoZSBpZHMgYXJyYXkpXG4gICAgICB3aGlsZSAoby5yaWdodCAhPSBudWxsKSB7XG4gICAgICAgIHZhciByaWdodCA9IHlpZWxkKiB0aGlzLmdldE9wZXJhdGlvbihvLnJpZ2h0KVxuICAgICAgICBpZiAoby5yaWdodFsxXSA8IChzdGFydFNTW28ucmlnaHRbMF1dIHx8IDApIHx8ICFpZHMuc29tZShmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICByZXR1cm4gWS51dGlscy5jb21wYXJlSWRzKGlkLCByaWdodC5vcmlnaW4pXG4gICAgICAgIH0pKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBpZHMucHVzaChvLnJpZ2h0KVxuICAgICAgICBvID0gcmlnaHRcbiAgICAgIH1cbiAgICAgIG9wLnJpZ2h0ID0gby5yaWdodFxuICAgICAgb3AubGVmdCA9IG9wLm9yaWdpblxuICAgICAgcmV0dXJuIG9wXG4gICAgfVxuICAgICovXG4gICAgKiBmbHVzaCAoKSB7XG4gICAgICB5aWVsZCogdGhpcy5vcy5mbHVzaCgpXG4gICAgICB5aWVsZCogdGhpcy5zcy5mbHVzaCgpXG4gICAgICB5aWVsZCogdGhpcy5kcy5mbHVzaCgpXG4gICAgfVxuICB9XG4gIFkuVHJhbnNhY3Rpb24gPSBUcmFuc2FjdGlvbkludGVyZmFjZVxufVxuIiwiLyogQGZsb3cgKi9cbid1c2Ugc3RyaWN0J1xuXG4vKlxuICBFdmVudEhhbmRsZXIgaXMgYW4gaGVscGVyIGNsYXNzIGZvciBjb25zdHJ1Y3RpbmcgY3VzdG9tIHR5cGVzLlxuXG4gIFdoeTogV2hlbiBjb25zdHJ1Y3RpbmcgY3VzdG9tIHR5cGVzLCB5b3Ugc29tZXRpbWVzIHdhbnQgeW91ciB0eXBlcyB0byB3b3JrXG4gIHN5bmNocm9ub3VzOiBFLmcuXG4gIGBgYCBTeW5jaHJvbm91c1xuICAgIG15dHlwZS5zZXRTb21ldGhpbmcoXCJ5YXlcIilcbiAgICBteXR5cGUuZ2V0U29tZXRoaW5nKCkgPT09IFwieWF5XCJcbiAgYGBgXG4gIHZlcnN1c1xuICBgYGAgQXN5bmNocm9ub3VzXG4gICAgbXl0eXBlLnNldFNvbWV0aGluZyhcInlheVwiKVxuICAgIG15dHlwZS5nZXRTb21ldGhpbmcoKSA9PT0gdW5kZWZpbmVkXG4gICAgbXl0eXBlLndhaXRGb3JTb21ldGhpbmcoKS50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICBteXR5cGUuZ2V0U29tZXRoaW5nKCkgPT09IFwieWF5XCJcbiAgICB9KVxuICBgYGBcblxuICBUaGUgc3RydWN0dXJlcyB1c3VhbGx5IHdvcmsgYXN5bmNocm9ub3VzbHkgKHlvdSBoYXZlIHRvIHdhaXQgZm9yIHRoZVxuICBkYXRhYmFzZSByZXF1ZXN0IHRvIGZpbmlzaCkuIEV2ZW50SGFuZGxlciBoZWxwcyB5b3UgdG8gbWFrZSB5b3VyIHR5cGVcbiAgc3luY2hyb25vdXMuXG4qL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoWSAvKiA6IGFueSovKSB7XG4gIFkudXRpbHMgPSB7fVxuXG4gIFkudXRpbHMuYnViYmxlRXZlbnQgPSBmdW5jdGlvbiAodHlwZSwgZXZlbnQpIHtcbiAgICB0eXBlLmV2ZW50SGFuZGxlci5jYWxsRXZlbnRMaXN0ZW5lcnMoZXZlbnQpXG4gICAgZXZlbnQucGF0aCA9IFtdXG4gICAgd2hpbGUgKHR5cGUgIT0gbnVsbCAmJiB0eXBlLl9kZWVwRXZlbnRIYW5kbGVyICE9IG51bGwpIHtcbiAgICAgIHR5cGUuX2RlZXBFdmVudEhhbmRsZXIuY2FsbEV2ZW50TGlzdGVuZXJzKGV2ZW50KVxuICAgICAgdmFyIHBhcmVudCA9IG51bGxcbiAgICAgIGlmICh0eXBlLl9wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICBwYXJlbnQgPSB0eXBlLm9zLmdldFR5cGUodHlwZS5fcGFyZW50KVxuICAgICAgfVxuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5fZ2V0UGF0aFRvQ2hpbGQgIT0gbnVsbCkge1xuICAgICAgICBldmVudC5wYXRoID0gW3BhcmVudC5fZ2V0UGF0aFRvQ2hpbGQodHlwZS5fbW9kZWwpXS5jb25jYXQoZXZlbnQucGF0aClcbiAgICAgICAgdHlwZSA9IHBhcmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHlwZSA9IG51bGxcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjbGFzcyBFdmVudExpc3RlbmVySGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgdGhpcy5ldmVudExpc3RlbmVycyA9IFtdXG4gICAgfVxuICAgIGRlc3Ryb3kgKCkge1xuICAgICAgdGhpcy5ldmVudExpc3RlbmVycyA9IG51bGxcbiAgICB9XG4gICAgIC8qXG4gICAgICBCYXNpYyBldmVudCBsaXN0ZW5lciBib2lsZXJwbGF0ZS4uLlxuICAgICovXG4gICAgYWRkRXZlbnRMaXN0ZW5lciAoZikge1xuICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5wdXNoKGYpXG4gICAgfVxuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXIgKGYpIHtcbiAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbiAoZykge1xuICAgICAgICByZXR1cm4gZiAhPT0gZ1xuICAgICAgfSlcbiAgICB9XG4gICAgcmVtb3ZlQWxsRXZlbnRMaXN0ZW5lcnMgKCkge1xuICAgICAgdGhpcy5ldmVudExpc3RlbmVycyA9IFtdXG4gICAgfVxuICAgIGNhbGxFdmVudExpc3RlbmVycyAoZXZlbnQpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5ldmVudExpc3RlbmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciBfZXZlbnQgPSB7fVxuICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gZXZlbnQpIHtcbiAgICAgICAgICAgIF9ldmVudFtuYW1lXSA9IGV2ZW50W25hbWVdXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnNbaV0oX2V2ZW50KVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignWW91ciBvYnNlcnZlciB0aHJldyBhbiBlcnJvci4gVGhpcyBlcnJvciB3YXMgY2F1Z2h0IHNvIHRoYXQgWWpzIHN0aWxsIGNhbiBlbnN1cmUgZGF0YSBjb25zaXN0ZW5jeSEgSW4gb3JkZXIgdG8gZGVidWcgdGhpcyBlcnJvciB5b3UgaGF2ZSB0byBjaGVjayBcIlBhdXNlIE9uIENhdWdodCBFeGNlcHRpb25zXCInLCBlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFkudXRpbHMuRXZlbnRMaXN0ZW5lckhhbmRsZXIgPSBFdmVudExpc3RlbmVySGFuZGxlclxuXG4gIGNsYXNzIEV2ZW50SGFuZGxlciBleHRlbmRzIEV2ZW50TGlzdGVuZXJIYW5kbGVyIHtcbiAgICAvKiA6OlxuICAgIHdhaXRpbmc6IEFycmF5PEluc2VydGlvbiB8IERlbGV0aW9uPjtcbiAgICBhd2FpdGluZzogbnVtYmVyO1xuICAgIG9uZXZlbnQ6IEZ1bmN0aW9uO1xuICAgIGV2ZW50TGlzdGVuZXJzOiBBcnJheTxGdW5jdGlvbj47XG4gICAgKi9cbiAgICAvKlxuICAgICAgb25ldmVudDogaXMgY2FsbGVkIHdoZW4gdGhlIHN0cnVjdHVyZSBjaGFuZ2VzLlxuXG4gICAgICBOb3RlOiBcImF3YWl0aW5nIG9wZXJ0YXRpb25zXCIgaXMgdXNlZCB0byBkZW5vdGUgb3BlcmF0aW9ucyB0aGF0IHdlcmVcbiAgICAgIHByZW1hdHVyZWx5IGNhbGxlZC4gRXZlbnRzIGZvciByZWNlaXZlZCBvcGVyYXRpb25zIGNhbiBub3QgYmUgZXhlY3V0ZWQgdW50aWxcbiAgICAgIGFsbCBwcmVtYXR1cmVseSBjYWxsZWQgb3BlcmF0aW9ucyB3ZXJlIGV4ZWN1dGVkIChcIndhaXRpbmcgb3BlcmF0aW9uc1wiKVxuICAgICovXG4gICAgY29uc3RydWN0b3IgKG9uZXZlbnQgLyogOiBGdW5jdGlvbiAqLykge1xuICAgICAgc3VwZXIoKVxuICAgICAgdGhpcy53YWl0aW5nID0gW11cbiAgICAgIHRoaXMuYXdhaXRpbmcgPSAwXG4gICAgICB0aGlzLm9uZXZlbnQgPSBvbmV2ZW50XG4gICAgfVxuICAgIGRlc3Ryb3kgKCkge1xuICAgICAgc3VwZXIuZGVzdHJveSgpXG4gICAgICB0aGlzLndhaXRpbmcgPSBudWxsXG4gICAgICB0aGlzLm9uZXZlbnQgPSBudWxsXG4gICAgfVxuICAgIC8qXG4gICAgICBDYWxsIHRoaXMgd2hlbiBhIG5ldyBvcGVyYXRpb24gYXJyaXZlcy4gSXQgd2lsbCBiZSBleGVjdXRlZCByaWdodCBhd2F5IGlmXG4gICAgICB0aGVyZSBhcmUgbm8gd2FpdGluZyBvcGVyYXRpb25zLCB0aGF0IHlvdSBwcmVtYXR1cmVseSBleGVjdXRlZFxuICAgICovXG4gICAgcmVjZWl2ZWRPcCAob3ApIHtcbiAgICAgIGlmICh0aGlzLmF3YWl0aW5nIDw9IDApIHtcbiAgICAgICAgdGhpcy5vbmV2ZW50KG9wKVxuICAgICAgfSBlbHNlIGlmIChvcC5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICB2YXIgY2hlY2tEZWxldGUgPSBmdW5jdGlvbiBjaGVja0RlbGV0ZSAoZCkge1xuICAgICAgICAgIGlmIChkLmxlbmd0aCA9PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgc2hvdWxkblxcJ3QgaGFwcGVuISBkLmxlbmd0aCBtdXN0IGJlIGRlZmluZWQhJylcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gd2UgY2hlY2sgaWYgbyBkZWxldGVzIHNvbWV0aGluZyBpbiBzZWxmLndhaXRpbmdcbiAgICAgICAgICAvLyBpZiBzbywgd2UgcmVtb3ZlIHRoZSBkZWxldGVkIG9wZXJhdGlvblxuICAgICAgICAgIGZvciAodmFyIHcgPSAwOyB3IDwgc2VsZi53YWl0aW5nLmxlbmd0aDsgdysrKSB7XG4gICAgICAgICAgICB2YXIgaSA9IHNlbGYud2FpdGluZ1t3XVxuICAgICAgICAgICAgaWYgKGkuc3RydWN0ID09PSAnSW5zZXJ0JyAmJiBpLmlkWzBdID09PSBkLnRhcmdldFswXSkge1xuICAgICAgICAgICAgICB2YXIgaUxlbmd0aCA9IGkuaGFzT3duUHJvcGVydHkoJ2NvbnRlbnQnKSA/IGkuY29udGVudC5sZW5ndGggOiAxXG4gICAgICAgICAgICAgIHZhciBkU3RhcnQgPSBkLnRhcmdldFsxXVxuICAgICAgICAgICAgICB2YXIgZEVuZCA9IGQudGFyZ2V0WzFdICsgKGQubGVuZ3RoIHx8IDEpXG4gICAgICAgICAgICAgIHZhciBpU3RhcnQgPSBpLmlkWzFdXG4gICAgICAgICAgICAgIHZhciBpRW5kID0gaS5pZFsxXSArIGlMZW5ndGhcbiAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhleSBkb24ndCBvdmVybGFwXG4gICAgICAgICAgICAgIGlmIChpRW5kIDw9IGRTdGFydCB8fCBkRW5kIDw9IGlTdGFydCkge1xuICAgICAgICAgICAgICAgIC8vIG5vIG92ZXJsYXBwaW5nXG4gICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyB3ZSBjaGVjayBhbGwgb3ZlcmxhcHBpbmcgY2FzZXMuIEFsbCBjYXNlczpcbiAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAxKSAgaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgICBkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gbW9kaWZ5IGkgYW5kIGRcbiAgICAgICAgICAgICAgICAyKSAgaWlpaWlpaVxuICAgICAgICAgICAgICAgICAgICAgIGRkZGRkXG4gICAgICAgICAgICAgICAgICAgIC0tPiBtb2RpZnkgaSwgcmVtb3ZlIGRcbiAgICAgICAgICAgICAgICAzKSAgaWlpaWlpaVxuICAgICAgICAgICAgICAgICAgICAgIGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gcmVtb3ZlIGQsIG1vZGlmeSBpLCBhbmQgY3JlYXRlIGFub3RoZXIgaSAoZm9yIHRoZSByaWdodCBoYW5kIHNpZGUpXG4gICAgICAgICAgICAgICAgNCkgIGlpaWlpXG4gICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IHJlbW92ZSBpLCBtb2RpZnkgZFxuICAgICAgICAgICAgICAgIDUpICBpaWlpaWlpXG4gICAgICAgICAgICAgICAgICAgIGRkZGRkZGRcbiAgICAgICAgICAgICAgICAgICAgLS0+IHJlbW92ZSBib3RoIGkgYW5kIGQgKCoqKVxuICAgICAgICAgICAgICAgIDYpICBpaWlpaWlpXG4gICAgICAgICAgICAgICAgICAgIGRkZGRkXG4gICAgICAgICAgICAgICAgICAgIC0tPiBtb2RpZnkgaSwgcmVtb3ZlIGRcbiAgICAgICAgICAgICAgICA3KSAgICBpaWlcbiAgICAgICAgICAgICAgICAgICAgZGRkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gcmVtb3ZlIGksIGNyZWF0ZSBhbmQgYXBwbHkgdHdvIGQgd2l0aCBjaGVja0RlbGV0ZShkKSAoKiopXG4gICAgICAgICAgICAgICAgOCkgICAgaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgZGRkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gcmVtb3ZlIGksIG1vZGlmeSBkICgqKilcbiAgICAgICAgICAgICAgICA5KSAgICBpaWlpaVxuICAgICAgICAgICAgICAgICAgICBkZGRkZFxuICAgICAgICAgICAgICAgICAgICAtLT4gbW9kaWZ5IGkgYW5kIGRcbiAgICAgICAgICAgICAgICAoKiopIChhbHNvIGNoZWNrIGlmIGkgY29udGFpbnMgY29udGVudCBvciB0eXBlKVxuICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAvLyBUT0RPOiBJIGxlZnQgc29tZSBkZWJ1Z2dlciBzdGF0ZW1lbnRzLCBiZWNhdXNlIEkgd2FudCB0byBkZWJ1ZyBhbGwgY2FzZXMgb25jZSBpbiBwcm9kdWN0aW9uLiBSRU1FTUJFUiBFTkQgVE9ET1xuICAgICAgICAgICAgICBpZiAoaVN0YXJ0IDwgZFN0YXJ0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGRTdGFydCA8IGlFbmQpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChpRW5kIDwgZEVuZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDFcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIHRoZSByaWdodCBwYXJ0IG9mIGkncyBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgIGkuY29udGVudC5zcGxpY2UoZFN0YXJ0IC0gaVN0YXJ0KVxuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgdGhlIHN0YXJ0IG9mIGQncyBkZWxldGlvblxuICAgICAgICAgICAgICAgICAgICBkLmxlbmd0aCA9IGRFbmQgLSBpRW5kXG4gICAgICAgICAgICAgICAgICAgIGQudGFyZ2V0ID0gW2QudGFyZ2V0WzBdLCBpRW5kXVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpRW5kID09PSBkRW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENhc2UgMlxuICAgICAgICAgICAgICAgICAgICBpLmNvbnRlbnQuc3BsaWNlKGRTdGFydCAtIGlTdGFydClcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGQsIHdlIGRvIHRoYXQgYnkgc2ltcGx5IGVuZGluZyB0aGlzIGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gKGRFbmQgPCBpRW5kKVxuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDNcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0kgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IFtpLmlkWzBdLCBkRW5kXSxcbiAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBpLmNvbnRlbnQuc2xpY2UoZEVuZCAtIGlTdGFydCksXG4gICAgICAgICAgICAgICAgICAgICAgc3RydWN0OiAnSW5zZXJ0J1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlbGYud2FpdGluZy5wdXNoKG5ld0kpXG4gICAgICAgICAgICAgICAgICAgIGkuY29udGVudC5zcGxpY2UoZFN0YXJ0IC0gaVN0YXJ0KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZFN0YXJ0ID09PSBpU3RhcnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaUVuZCA8IGRFbmQpIHtcbiAgICAgICAgICAgICAgICAgIC8vIENhc2UgNFxuICAgICAgICAgICAgICAgICAgZC5sZW5ndGggPSBkRW5kIC0gaUVuZFxuICAgICAgICAgICAgICAgICAgZC50YXJnZXQgPSBbZC50YXJnZXRbMF0sIGlFbmRdXG4gICAgICAgICAgICAgICAgICBpLmNvbnRlbnQgPSBbXVxuICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlFbmQgPT09IGRFbmQpIHtcbiAgICAgICAgICAgICAgICAgIC8vIENhc2UgNVxuICAgICAgICAgICAgICAgICAgc2VsZi53YWl0aW5nLnNwbGljZSh3LCAxKVxuICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gKGRFbmQgPCBpRW5kKVxuICAgICAgICAgICAgICAgICAgLy8gQ2FzZSA2XG4gICAgICAgICAgICAgICAgICBpLmNvbnRlbnQgPSBpLmNvbnRlbnQuc2xpY2UoZEVuZCAtIGlTdGFydClcbiAgICAgICAgICAgICAgICAgIGkuaWQgPSBbaS5pZFswXSwgZEVuZF1cbiAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gKGRTdGFydCA8IGlTdGFydClcbiAgICAgICAgICAgICAgICBpZiAoaVN0YXJ0IDwgZEVuZCkge1xuICAgICAgICAgICAgICAgICAgLy8gdGhleSBvdmVybGFwXG4gICAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAgNykgICAgaWlpXG4gICAgICAgICAgICAgICAgICAgICAgZGRkZGRkZFxuICAgICAgICAgICAgICAgICAgICAgIC0tPiByZW1vdmUgaSwgY3JlYXRlIGFuZCBhcHBseSB0d28gZCB3aXRoIGNoZWNrRGVsZXRlKGQpICgqKilcbiAgICAgICAgICAgICAgICAgIDgpICAgIGlpaWlpXG4gICAgICAgICAgICAgICAgICAgICAgZGRkZGRkZFxuICAgICAgICAgICAgICAgICAgICAgIC0tPiByZW1vdmUgaSwgbW9kaWZ5IGQgKCoqKVxuICAgICAgICAgICAgICAgICAgOSkgICAgaWlpaWlcbiAgICAgICAgICAgICAgICAgICAgICBkZGRkZFxuICAgICAgICAgICAgICAgICAgICAgIC0tPiBtb2RpZnkgaSBhbmQgZFxuICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgIGlmIChpRW5kIDwgZEVuZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDdcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVidWdnZXIgLy8gVE9ETzogWW91IGRpZCBub3QgdGVzdCB0aGlzIGNhc2UgeWV0ISEhISAoYWRkIHRoZSBkZWJ1Z2dlciBoZXJlKVxuICAgICAgICAgICAgICAgICAgICBzZWxmLndhaXRpbmcuc3BsaWNlKHcsIDEpXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrRGVsZXRlKHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IFtkLnRhcmdldFswXSwgZFN0YXJ0XSxcbiAgICAgICAgICAgICAgICAgICAgICBsZW5ndGg6IGlTdGFydCAtIGRTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICBzdHJ1Y3Q6ICdEZWxldGUnXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrRGVsZXRlKHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IFtkLnRhcmdldFswXSwgaUVuZF0sXG4gICAgICAgICAgICAgICAgICAgICAgbGVuZ3RoOiBpRW5kIC0gZEVuZCxcbiAgICAgICAgICAgICAgICAgICAgICBzdHJ1Y3Q6ICdEZWxldGUnXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpRW5kID09PSBkRW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENhc2UgOFxuICAgICAgICAgICAgICAgICAgICBzZWxmLndhaXRpbmcuc3BsaWNlKHcsIDEpXG4gICAgICAgICAgICAgICAgICAgIHctLVxuICAgICAgICAgICAgICAgICAgICBkLmxlbmd0aCAtPSBpTGVuZ3RoXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBkRW5kIDwgaUVuZFxuICAgICAgICAgICAgICAgICAgICAvLyBDYXNlIDlcbiAgICAgICAgICAgICAgICAgICAgZC5sZW5ndGggPSBpU3RhcnQgLSBkU3RhcnRcbiAgICAgICAgICAgICAgICAgICAgaS5jb250ZW50LnNwbGljZSgwLCBkRW5kIC0gaVN0YXJ0KVxuICAgICAgICAgICAgICAgICAgICBpLmlkID0gW2kuaWRbMF0sIGRFbmRdXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmlzaGVkIHdpdGggcmVtYWluaW5nIG9wZXJhdGlvbnNcbiAgICAgICAgICBzZWxmLndhaXRpbmcucHVzaChkKVxuICAgICAgICB9XG4gICAgICAgIGlmIChvcC5rZXkgPT0gbnVsbCkge1xuICAgICAgICAgIC8vIGRlbGV0ZXMgaW4gbGlzdFxuICAgICAgICAgIGNoZWNrRGVsZXRlKG9wKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGRlbGV0ZXMgaW4gbWFwXG4gICAgICAgICAgdGhpcy53YWl0aW5nLnB1c2gob3ApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMud2FpdGluZy5wdXNoKG9wKVxuICAgICAgfVxuICAgIH1cbiAgICAvKlxuICAgICAgWW91IGNyZWF0ZWQgc29tZSBvcGVyYXRpb25zLCBhbmQgeW91IHdhbnQgdGhlIGBvbmV2ZW50YCBmdW5jdGlvbiB0byBiZVxuICAgICAgY2FsbGVkIHJpZ2h0IGF3YXkuIFJlY2VpdmVkIG9wZXJhdGlvbnMgd2lsbCBub3QgYmUgZXhlY3V0ZWQgdW50aWxsIGFsbFxuICAgICAgcHJlbWF0dXJlbHkgY2FsbGVkIG9wZXJhdGlvbnMgYXJlIGV4ZWN1dGVkXG4gICAgKi9cbiAgICBhd2FpdEFuZFByZW1hdHVyZWx5Q2FsbCAob3BzKSB7XG4gICAgICB0aGlzLmF3YWl0aW5nKytcbiAgICAgIG9wcy5tYXAoWS51dGlscy5jb3B5T3BlcmF0aW9uKS5mb3JFYWNoKHRoaXMub25ldmVudClcbiAgICB9XG4gICAgKiBhd2FpdE9wcyAodHJhbnNhY3Rpb24sIGYsIGFyZ3MpIHtcbiAgICAgIGZ1bmN0aW9uIG5vdFNvU21hcnRTb3J0IChhcnJheSkge1xuICAgICAgICAvLyB0aGlzIGZ1bmN0aW9uIHNvcnRzIGluc2VydGlvbnMgaW4gYSBleGVjdXRhYmxlIG9yZGVyXG4gICAgICAgIHZhciByZXN1bHQgPSBbXVxuICAgICAgICB3aGlsZSAoYXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBpbmRlcGVuZGVudCA9IHRydWVcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgYXJyYXkubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgaWYgKFkudXRpbHMubWF0Y2hlc0lkKGFycmF5W2pdLCBhcnJheVtpXS5sZWZ0KSkge1xuICAgICAgICAgICAgICAgIC8vIGFycmF5W2ldIGRlcGVuZHMgb24gYXJyYXlbal1cbiAgICAgICAgICAgICAgICBpbmRlcGVuZGVudCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGluZGVwZW5kZW50KSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGFycmF5LnNwbGljZShpLCAxKVswXSlcbiAgICAgICAgICAgICAgaS0tXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgIH1cbiAgICAgIHZhciBiZWZvcmUgPSB0aGlzLndhaXRpbmcubGVuZ3RoXG4gICAgICAvLyBzb21laG93IGNyZWF0ZSBuZXcgb3BlcmF0aW9uc1xuICAgICAgeWllbGQqIGYuYXBwbHkodHJhbnNhY3Rpb24sIGFyZ3MpXG4gICAgICAvLyByZW1vdmUgYWxsIGFwcGVuZGVkIG9wcyAvIGF3YWl0ZWQgb3BzXG4gICAgICB0aGlzLndhaXRpbmcuc3BsaWNlKGJlZm9yZSlcbiAgICAgIGlmICh0aGlzLmF3YWl0aW5nID4gMCkgdGhpcy5hd2FpdGluZy0tXG4gICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gYXdhaXRlZCBvcHMgYW55bW9yZSwgd2UgY2FuIHVwZGF0ZSBhbGwgd2FpdGluZyBvcHMsIGFuZCBzZW5kIGV4ZWN1dGUgdGhlbSAoaWYgdGhlcmUgYXJlIHN0aWxsIG5vIGF3YWl0ZWQgb3BzKVxuICAgICAgaWYgKHRoaXMuYXdhaXRpbmcgPT09IDAgJiYgdGhpcy53YWl0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gdXBkYXRlIGFsbCB3YWl0aW5nIG9wc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMud2FpdGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciBvID0gdGhpcy53YWl0aW5nW2ldXG4gICAgICAgICAgaWYgKG8uc3RydWN0ID09PSAnSW5zZXJ0Jykge1xuICAgICAgICAgICAgdmFyIF9vID0geWllbGQqIHRyYW5zYWN0aW9uLmdldEluc2VydGlvbihvLmlkKVxuICAgICAgICAgICAgaWYgKF9vLnBhcmVudFN1YiAhPSBudWxsICYmIF9vLmxlZnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAvLyBpZiBvIGlzIGFuIGluc2VydGlvbiBvZiBhIG1hcCBzdHJ1YyAocGFyZW50U3ViIGlzIGRlZmluZWQpLCB0aGVuIGl0IHNob3VsZG4ndCBiZSBuZWNlc3NhcnkgdG8gY29tcHV0ZSBsZWZ0XG4gICAgICAgICAgICAgIHRoaXMud2FpdGluZy5zcGxpY2UoaSwgMSlcbiAgICAgICAgICAgICAgaS0tIC8vIHVwZGF0ZSBpbmRleFxuICAgICAgICAgICAgfSBlbHNlIGlmICghWS51dGlscy5jb21wYXJlSWRzKF9vLmlkLCBvLmlkKSkge1xuICAgICAgICAgICAgICAvLyBvIGdvdCBleHRlbmRlZFxuICAgICAgICAgICAgICBvLmxlZnQgPSBbby5pZFswXSwgby5pZFsxXSAtIDFdXG4gICAgICAgICAgICB9IGVsc2UgaWYgKF9vLmxlZnQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICBvLmxlZnQgPSBudWxsXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBmaW5kIG5leHQgdW5kZWxldGVkIG9wXG4gICAgICAgICAgICAgIHZhciBsZWZ0ID0geWllbGQqIHRyYW5zYWN0aW9uLmdldEluc2VydGlvbihfby5sZWZ0KVxuICAgICAgICAgICAgICB3aGlsZSAobGVmdC5kZWxldGVkICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAobGVmdC5sZWZ0ICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGxlZnQgPSB5aWVsZCogdHJhbnNhY3Rpb24uZ2V0SW5zZXJ0aW9uKGxlZnQubGVmdClcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbGVmdCA9IG51bGxcbiAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIG8ubGVmdCA9IGxlZnQgIT0gbnVsbCA/IFkudXRpbHMuZ2V0TGFzdElkKGxlZnQpIDogbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0aGUgcHJldmlvdXMgc3R1ZmYgd2FzIGFzeW5jLCBzbyB3ZSBoYXZlIHRvIGNoZWNrIGFnYWluIVxuICAgICAgICAvLyBXZSBhbHNvIHB1bGwgY2hhbmdlcyBmcm9tIHRoZSBiaW5kaW5ncywgaWYgdGhlcmUgZXhpc3RzIHN1Y2ggYSBtZXRob2QsIHRoaXMgY291bGQgaW5jcmVhc2UgYXdhaXRpbmcgdG9vXG4gICAgICAgIGlmICh0aGlzLl9wdWxsQ2hhbmdlcyAhPSBudWxsKSB7XG4gICAgICAgICAgdGhpcy5fcHVsbENoYW5nZXMoKVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmF3YWl0aW5nID09PSAwKSB7XG4gICAgICAgICAgLy8gc29ydCBieSB0eXBlLCBleGVjdXRlIGluc2VydHMgZmlyc3RcbiAgICAgICAgICB2YXIgaW5zID0gW11cbiAgICAgICAgICB2YXIgZGVscyA9IFtdXG4gICAgICAgICAgdGhpcy53YWl0aW5nLmZvckVhY2goZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICAgIGlmIChvLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICAgICAgZGVscy5wdXNoKG8pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpbnMucHVzaChvKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgdGhpcy53YWl0aW5nID0gW11cbiAgICAgICAgICAvLyBwdXQgaW4gZXhlY3V0YWJsZSBvcmRlclxuICAgICAgICAgIGlucyA9IG5vdFNvU21hcnRTb3J0KGlucylcbiAgICAgICAgICAvLyB0aGlzLm9uZXZlbnQgY2FuIHRyaWdnZXIgdGhlIGNyZWF0aW9uIG9mIGFub3RoZXIgb3BlcmF0aW9uXG4gICAgICAgICAgLy8gLT4gY2hlY2sgaWYgdGhpcy5hd2FpdGluZyBpbmNyZWFzZWQgJiBzdG9wIGNvbXB1dGF0aW9uIGlmIGl0IGRvZXNcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGlucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXdhaXRpbmcgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5vbmV2ZW50KGluc1tpXSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMud2FpdGluZyA9IHRoaXMud2FpdGluZy5jb25jYXQoaW5zLnNsaWNlKGkpKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZGVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXdhaXRpbmcgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5vbmV2ZW50KGRlbHNbaV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLndhaXRpbmcgPSB0aGlzLndhaXRpbmcuY29uY2F0KGRlbHMuc2xpY2UoaSkpXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFRPRE86IFJlbW92ZSBhd2FpdGVkSW5zZXJ0cyBhbmQgYXdhaXRlZERlbGV0ZXMgaW4gZmF2b3Igb2YgYXdhaXRlZE9wcywgYXMgdGhleSBhcmUgZGVwcmVjYXRlZCBhbmQgZG8gbm90IGFsd2F5cyB3b3JrXG4gICAgLy8gRG8gdGhpcyBpbiBvbmUgb2YgdGhlIGNvbWluZyByZWxlYXNlcyB0aGF0IGFyZSBicmVha2luZyBhbnl3YXlcbiAgICAvKlxuICAgICAgQ2FsbCB0aGlzIHdoZW4geW91IHN1Y2Nlc3NmdWxseSBhd2FpdGVkIHRoZSBleGVjdXRpb24gb2YgbiBJbnNlcnQgb3BlcmF0aW9uc1xuICAgICovXG4gICAgYXdhaXRlZEluc2VydHMgKG4pIHtcbiAgICAgIHZhciBvcHMgPSB0aGlzLndhaXRpbmcuc3BsaWNlKHRoaXMud2FpdGluZy5sZW5ndGggLSBuKVxuICAgICAgZm9yICh2YXIgb2lkID0gMDsgb2lkIDwgb3BzLmxlbmd0aDsgb2lkKyspIHtcbiAgICAgICAgdmFyIG9wID0gb3BzW29pZF1cbiAgICAgICAgaWYgKG9wLnN0cnVjdCA9PT0gJ0luc2VydCcpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gdGhpcy53YWl0aW5nLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBsZXQgdyA9IHRoaXMud2FpdGluZ1tpXVxuICAgICAgICAgICAgLy8gVE9ETzogZG8gSSBoYW5kbGUgc3BsaXQgb3BlcmF0aW9ucyBjb3JyZWN0bHkgaGVyZT8gU3VwZXIgdW5saWtlbHksIGJ1dCB5ZWFoLi5cbiAgICAgICAgICAgIC8vIEFsc286IGNhbiB0aGlzIGNhc2UgaGFwcGVuPyBDYW4gb3AgYmUgaW5zZXJ0ZWQgaW4gdGhlIG1pZGRsZSBvZiBhIGxhcmdlciBvcCB0aGF0IGlzIGluICR3YWl0aW5nP1xuICAgICAgICAgICAgaWYgKHcuc3RydWN0ID09PSAnSW5zZXJ0Jykge1xuICAgICAgICAgICAgICBpZiAoWS51dGlscy5tYXRjaGVzSWQodywgb3AubGVmdCkpIHtcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRlIHRoZSBlZmZlY3Qgb2Ygb3AgaW4gd1xuICAgICAgICAgICAgICAgIHcucmlnaHQgPSBvcC5pZFxuICAgICAgICAgICAgICAgIC8vIGV4Y2x1ZGUgdGhlIGVmZmVjdCBvZiB3IGluIG9wXG4gICAgICAgICAgICAgICAgb3AubGVmdCA9IHcubGVmdFxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKFkudXRpbHMuY29tcGFyZUlkcyh3LmlkLCBvcC5yaWdodCkpIHtcbiAgICAgICAgICAgICAgICAvLyBzaW1pbGFyLi5cbiAgICAgICAgICAgICAgICB3LmxlZnQgPSBZLnV0aWxzLmdldExhc3RJZChvcClcbiAgICAgICAgICAgICAgICBvcC5yaWdodCA9IHcucmlnaHRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIEluc2VydCBPcGVyYXRpb24hJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fdHJ5Q2FsbEV2ZW50cyhuKVxuICAgIH1cbiAgICAvKlxuICAgICAgQ2FsbCB0aGlzIHdoZW4geW91IHN1Y2Nlc3NmdWxseSBhd2FpdGVkIHRoZSBleGVjdXRpb24gb2YgbiBEZWxldGUgb3BlcmF0aW9uc1xuICAgICovXG4gICAgYXdhaXRlZERlbGV0ZXMgKG4sIG5ld0xlZnQpIHtcbiAgICAgIHZhciBvcHMgPSB0aGlzLndhaXRpbmcuc3BsaWNlKHRoaXMud2FpdGluZy5sZW5ndGggLSBuKVxuICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBvcHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmFyIGRlbCA9IG9wc1tqXVxuICAgICAgICBpZiAoZGVsLnN0cnVjdCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICBpZiAobmV3TGVmdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMud2FpdGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBsZXQgdyA9IHRoaXMud2FpdGluZ1tpXVxuICAgICAgICAgICAgICAvLyBXZSB3aWxsIGp1c3QgY2FyZSBhYm91dCB3LmxlZnRcbiAgICAgICAgICAgICAgaWYgKHcuc3RydWN0ID09PSAnSW5zZXJ0JyAmJiBZLnV0aWxzLmNvbXBhcmVJZHMoZGVsLnRhcmdldCwgdy5sZWZ0KSkge1xuICAgICAgICAgICAgICAgIHcubGVmdCA9IG5ld0xlZnRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIERlbGV0ZSBPcGVyYXRpb24hJylcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fdHJ5Q2FsbEV2ZW50cyhuKVxuICAgIH1cbiAgICAvKiAocHJpdmF0ZSlcbiAgICAgIFRyeSB0byBleGVjdXRlIHRoZSBldmVudHMgZm9yIHRoZSB3YWl0aW5nIG9wZXJhdGlvbnNcbiAgICAqL1xuICAgIF90cnlDYWxsRXZlbnRzICgpIHtcbiAgICAgIGZ1bmN0aW9uIG5vdFNvU21hcnRTb3J0IChhcnJheSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW11cbiAgICAgICAgd2hpbGUgKGFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgaW5kZXBlbmRlbnQgPSB0cnVlXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGFycmF5Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgIGlmIChZLnV0aWxzLm1hdGNoZXNJZChhcnJheVtqXSwgYXJyYXlbaV0ubGVmdCkpIHtcbiAgICAgICAgICAgICAgICAvLyBhcnJheVtpXSBkZXBlbmRzIG9uIGFycmF5W2pdXG4gICAgICAgICAgICAgICAgaW5kZXBlbmRlbnQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmRlcGVuZGVudCkge1xuICAgICAgICAgICAgICByZXN1bHQucHVzaChhcnJheS5zcGxpY2UoaSwgMSlbMF0pXG4gICAgICAgICAgICAgIGktLVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5hd2FpdGluZyA+IDApIHRoaXMuYXdhaXRpbmctLVxuICAgICAgaWYgKHRoaXMuYXdhaXRpbmcgPT09IDAgJiYgdGhpcy53YWl0aW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIGlucyA9IFtdXG4gICAgICAgIHZhciBkZWxzID0gW11cbiAgICAgICAgdGhpcy53YWl0aW5nLmZvckVhY2goZnVuY3Rpb24gKG8pIHtcbiAgICAgICAgICBpZiAoby5zdHJ1Y3QgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgICBkZWxzLnB1c2gobylcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zLnB1c2gobylcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIGlucyA9IG5vdFNvU21hcnRTb3J0KGlucylcbiAgICAgICAgaW5zLmZvckVhY2godGhpcy5vbmV2ZW50KVxuICAgICAgICBkZWxzLmZvckVhY2godGhpcy5vbmV2ZW50KVxuICAgICAgICB0aGlzLndhaXRpbmcgPSBbXVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBZLnV0aWxzLkV2ZW50SGFuZGxlciA9IEV2ZW50SGFuZGxlclxuXG4gIC8qXG4gICAgRGVmYXVsdCBjbGFzcyBvZiBjdXN0b20gdHlwZXMhXG4gICovXG4gIGNsYXNzIEN1c3RvbVR5cGUge1xuICAgIGdldFBhdGggKCkge1xuICAgICAgdmFyIHBhcmVudCA9IG51bGxcbiAgICAgIGlmICh0aGlzLl9wYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICBwYXJlbnQgPSB0aGlzLm9zLmdldFR5cGUodGhpcy5fcGFyZW50KVxuICAgICAgfVxuICAgICAgaWYgKHBhcmVudCAhPSBudWxsICYmIHBhcmVudC5fZ2V0UGF0aFRvQ2hpbGQgIT0gbnVsbCkge1xuICAgICAgICB2YXIgZmlyc3RLZXkgPSBwYXJlbnQuX2dldFBhdGhUb0NoaWxkKHRoaXMuX21vZGVsKVxuICAgICAgICB2YXIgcGFyZW50S2V5cyA9IHBhcmVudC5nZXRQYXRoKClcbiAgICAgICAgcGFyZW50S2V5cy5wdXNoKGZpcnN0S2V5KVxuICAgICAgICByZXR1cm4gcGFyZW50S2V5c1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG4gICAgfVxuICB9XG4gIFkudXRpbHMuQ3VzdG9tVHlwZSA9IEN1c3RvbVR5cGVcblxuICAvKlxuICAgIEEgd3JhcHBlciBmb3IgdGhlIGRlZmluaXRpb24gb2YgYSBjdXN0b20gdHlwZS5cbiAgICBFdmVyeSBjdXN0b20gdHlwZSBtdXN0IGhhdmUgdGhyZWUgcHJvcGVydGllczpcblxuICAgICogc3RydWN0XG4gICAgICAtIFN0cnVjdG5hbWUgb2YgdGhpcyB0eXBlXG4gICAgKiBpbml0VHlwZVxuICAgICAgLSBHaXZlbiBhIG1vZGVsLCBjcmVhdGVzIGEgY3VzdG9tIHR5cGVcbiAgICAqIGNsYXNzXG4gICAgICAtIHRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgY3VzdG9tIHR5cGUgKGUuZy4gaW4gb3JkZXIgdG8gaW5oZXJpdCBmcm9tIGEgdHlwZSlcbiAgKi9cbiAgY2xhc3MgQ3VzdG9tVHlwZURlZmluaXRpb24geyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgLyogOjpcbiAgICBzdHJ1Y3Q6IGFueTtcbiAgICBpbml0VHlwZTogYW55O1xuICAgIGNsYXNzOiBGdW5jdGlvbjtcbiAgICBuYW1lOiBTdHJpbmc7XG4gICAgKi9cbiAgICBjb25zdHJ1Y3RvciAoZGVmKSB7XG4gICAgICBpZiAoZGVmLnN0cnVjdCA9PSBudWxsIHx8XG4gICAgICAgIGRlZi5pbml0VHlwZSA9PSBudWxsIHx8XG4gICAgICAgIGRlZi5jbGFzcyA9PSBudWxsIHx8XG4gICAgICAgIGRlZi5uYW1lID09IG51bGwgfHxcbiAgICAgICAgZGVmLmNyZWF0ZVR5cGUgPT0gbnVsbFxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ3VzdG9tIHR5cGUgd2FzIG5vdCBpbml0aWFsaXplZCBjb3JyZWN0bHkhJylcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RydWN0ID0gZGVmLnN0cnVjdFxuICAgICAgdGhpcy5pbml0VHlwZSA9IGRlZi5pbml0VHlwZVxuICAgICAgdGhpcy5jcmVhdGVUeXBlID0gZGVmLmNyZWF0ZVR5cGVcbiAgICAgIHRoaXMuY2xhc3MgPSBkZWYuY2xhc3NcbiAgICAgIHRoaXMubmFtZSA9IGRlZi5uYW1lXG4gICAgICBpZiAoZGVmLmFwcGVuZEFkZGl0aW9uYWxJbmZvICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5hcHBlbmRBZGRpdGlvbmFsSW5mbyA9IGRlZi5hcHBlbmRBZGRpdGlvbmFsSW5mb1xuICAgICAgfVxuICAgICAgdGhpcy5wYXJzZUFyZ3VtZW50cyA9IChkZWYucGFyc2VBcmd1bWVudHMgfHwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gW3RoaXNdXG4gICAgICB9KS5iaW5kKHRoaXMpXG4gICAgICB0aGlzLnBhcnNlQXJndW1lbnRzLnR5cGVEZWZpbml0aW9uID0gdGhpc1xuICAgIH1cbiAgfVxuICBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uID0gQ3VzdG9tVHlwZURlZmluaXRpb25cblxuICBZLnV0aWxzLmlzVHlwZURlZmluaXRpb24gPSBmdW5jdGlvbiBpc1R5cGVEZWZpbml0aW9uICh2KSB7XG4gICAgaWYgKHYgIT0gbnVsbCkge1xuICAgICAgaWYgKHYgaW5zdGFuY2VvZiBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKSByZXR1cm4gW3ZdXG4gICAgICBlbHNlIGlmICh2LmNvbnN0cnVjdG9yID09PSBBcnJheSAmJiB2WzBdIGluc3RhbmNlb2YgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbikgcmV0dXJuIHZcbiAgICAgIGVsc2UgaWYgKHYgaW5zdGFuY2VvZiBGdW5jdGlvbiAmJiB2LnR5cGVEZWZpbml0aW9uIGluc3RhbmNlb2YgWS51dGlscy5DdXN0b21UeXBlRGVmaW5pdGlvbikgcmV0dXJuIFt2LnR5cGVEZWZpbml0aW9uXVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8qXG4gICAgTWFrZSBhIGZsYXQgY29weSBvZiBhbiBvYmplY3RcbiAgICAoanVzdCBjb3B5IHByb3BlcnRpZXMpXG4gICovXG4gIGZ1bmN0aW9uIGNvcHlPYmplY3QgKG8pIHtcbiAgICB2YXIgYyA9IHt9XG4gICAgZm9yICh2YXIga2V5IGluIG8pIHtcbiAgICAgIGNba2V5XSA9IG9ba2V5XVxuICAgIH1cbiAgICByZXR1cm4gY1xuICB9XG4gIFkudXRpbHMuY29weU9iamVjdCA9IGNvcHlPYmplY3RcblxuICAvKlxuICAgIENvcHkgYW4gb3BlcmF0aW9uLCBzbyB0aGF0IGl0IGNhbiBiZSBtYW5pcHVsYXRlZC5cbiAgICBOb3RlOiBZb3UgbXVzdCBub3QgY2hhbmdlIHN1YnByb3BlcnRpZXMgKGV4Y2VwdCBvLmNvbnRlbnQpIVxuICAqL1xuICBmdW5jdGlvbiBjb3B5T3BlcmF0aW9uIChvKSB7XG4gICAgbyA9IGNvcHlPYmplY3QobylcbiAgICBpZiAoby5jb250ZW50ICE9IG51bGwpIHtcbiAgICAgIG8uY29udGVudCA9IG8uY29udGVudC5tYXAoZnVuY3Rpb24gKGMpIHsgcmV0dXJuIGMgfSlcbiAgICB9XG4gICAgcmV0dXJuIG9cbiAgfVxuXG4gIFkudXRpbHMuY29weU9wZXJhdGlvbiA9IGNvcHlPcGVyYXRpb25cblxuICAvKlxuICAgIERlZmluZXMgYSBzbWFsbGVyIHJlbGF0aW9uIG9uIElkJ3NcbiAgKi9cbiAgZnVuY3Rpb24gc21hbGxlciAoYSwgYikge1xuICAgIHJldHVybiBhWzBdIDwgYlswXSB8fCAoYVswXSA9PT0gYlswXSAmJiAoYVsxXSA8IGJbMV0gfHwgdHlwZW9mIGFbMV0gPCB0eXBlb2YgYlsxXSkpXG4gIH1cbiAgWS51dGlscy5zbWFsbGVyID0gc21hbGxlclxuXG4gIGZ1bmN0aW9uIGluRGVsZXRpb25SYW5nZSAoZGVsLCBpbnMpIHtcbiAgICByZXR1cm4gZGVsLnRhcmdldFswXSA9PT0gaW5zWzBdICYmIGRlbC50YXJnZXRbMV0gPD0gaW5zWzFdICYmIGluc1sxXSA8IGRlbC50YXJnZXRbMV0gKyAoZGVsLmxlbmd0aCB8fCAxKVxuICB9XG4gIFkudXRpbHMuaW5EZWxldGlvblJhbmdlID0gaW5EZWxldGlvblJhbmdlXG5cbiAgZnVuY3Rpb24gY29tcGFyZUlkcyAoaWQxLCBpZDIpIHtcbiAgICBpZiAoaWQxID09IG51bGwgfHwgaWQyID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpZDEgPT09IGlkMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaWQxWzBdID09PSBpZDJbMF0gJiYgaWQxWzFdID09PSBpZDJbMV1cbiAgICB9XG4gIH1cbiAgWS51dGlscy5jb21wYXJlSWRzID0gY29tcGFyZUlkc1xuXG4gIGZ1bmN0aW9uIG1hdGNoZXNJZCAob3AsIGlkKSB7XG4gICAgaWYgKGlkID09IG51bGwgfHwgb3AgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGlkID09PSBvcFxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaWRbMF0gPT09IG9wLmlkWzBdKSB7XG4gICAgICAgIGlmIChvcC5jb250ZW50ID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gaWRbMV0gPT09IG9wLmlkWzFdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGlkWzFdID49IG9wLmlkWzFdICYmIGlkWzFdIDwgb3AuaWRbMV0gKyBvcC5jb250ZW50Lmxlbmd0aFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFkudXRpbHMubWF0Y2hlc0lkID0gbWF0Y2hlc0lkXG5cbiAgZnVuY3Rpb24gZ2V0TGFzdElkIChvcCkge1xuICAgIGlmIChvcC5jb250ZW50ID09IG51bGwgfHwgb3AuY29udGVudC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBvcC5pZFxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gW29wLmlkWzBdLCBvcC5pZFsxXSArIG9wLmNvbnRlbnQubGVuZ3RoIC0gMV1cbiAgICB9XG4gIH1cbiAgWS51dGlscy5nZXRMYXN0SWQgPSBnZXRMYXN0SWRcblxuICBmdW5jdGlvbiBjcmVhdGVFbXB0eU9wc0FycmF5IChuKSB7XG4gICAgdmFyIGEgPSBuZXcgQXJyYXkobilcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFbaV0gPSB7XG4gICAgICAgIGlkOiBbbnVsbCwgbnVsbF1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVNtYWxsTG9va3VwQnVmZmVyIChTdG9yZSkge1xuICAgIC8qXG4gICAgICBUaGlzIGJ1ZmZlciBpbXBsZW1lbnRzIGEgdmVyeSBzbWFsbCBidWZmZXIgdGhhdCB0ZW1wb3JhcmlseSBzdG9yZXMgb3BlcmF0aW9uc1xuICAgICAgYWZ0ZXIgdGhleSBhcmUgcmVhZCAvIGJlZm9yZSB0aGV5IGFyZSB3cml0dGVuLlxuICAgICAgVGhlIGJ1ZmZlciBiYXNpY2FsbHkgaW1wbGVtZW50cyBGSUZPLiBPZnRlbiByZXF1ZXN0ZWQgbG9va3VwcyB3aWxsIGJlIHJlLXF1ZXVlZCBldmVyeSB0aW1lIHRoZXkgYXJlIGxvb2tlZCB1cCAvIHdyaXR0ZW4uXG5cbiAgICAgIEl0IGNhbiBzcGVlZCB1cCBsb29rdXBzIG9uIE9wZXJhdGlvbiBTdG9yZXMgYW5kIFN0YXRlIFN0b3Jlcy4gQnV0IGl0IGRvZXMgbm90IHJlcXVpcmUgbm90YWJsZSB1c2Ugb2YgbWVtb3J5IG9yIHByb2Nlc3NpbmcgcG93ZXIuXG5cbiAgICAgIEdvb2QgZm9yIG9zIGFuZCBzcywgYm90IG5vdCBmb3IgZHMgKGJlY2F1c2UgaXQgb2Z0ZW4gdXNlcyBtZXRob2RzIHRoYXQgcmVxdWlyZSBhIGZsdXNoKVxuXG4gICAgICBJIHRyaWVkIHRvIG9wdGltaXplIHRoaXMgZm9yIHBlcmZvcm1hbmNlLCB0aGVyZWZvcmUgbm8gaGlnaGxldmVsIG9wZXJhdGlvbnMuXG4gICAgKi9cbiAgICBjbGFzcyBTbWFsbExvb2t1cEJ1ZmZlciBleHRlbmRzIFN0b3JlIHtcbiAgICAgIGNvbnN0cnVjdG9yIChhcmcxLCBhcmcyKSB7XG4gICAgICAgIC8vIHN1cGVyKC4uLmFyZ3VtZW50cykgLS0gZG8gdGhpcyB3aGVuIHRoaXMgaXMgc3VwcG9ydGVkIGJ5IHN0YWJsZSBub2RlanNcbiAgICAgICAgc3VwZXIoYXJnMSwgYXJnMilcbiAgICAgICAgdGhpcy53cml0ZUJ1ZmZlciA9IGNyZWF0ZUVtcHR5T3BzQXJyYXkoNSlcbiAgICAgICAgdGhpcy5yZWFkQnVmZmVyID0gY3JlYXRlRW1wdHlPcHNBcnJheSgxMClcbiAgICAgIH1cbiAgICAgICogZmluZCAoaWQsIG5vU3VwZXJDYWxsKSB7XG4gICAgICAgIHZhciBpLCByXG4gICAgICAgIGZvciAoaSA9IHRoaXMucmVhZEJ1ZmZlci5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIHIgPSB0aGlzLnJlYWRCdWZmZXJbaV1cbiAgICAgICAgICAvLyB3ZSBkb24ndCBoYXZlIHRvIHVzZSBjb21wYXJlaWRzLCBiZWNhdXNlIGlkIGlzIGFsd2F5cyBkZWZpbmVkIVxuICAgICAgICAgIGlmIChyLmlkWzFdID09PSBpZFsxXSAmJiByLmlkWzBdID09PSBpZFswXSkge1xuICAgICAgICAgICAgLy8gZm91bmQgclxuICAgICAgICAgICAgLy8gbW92ZSByIHRvIHRoZSBlbmQgb2YgcmVhZEJ1ZmZlclxuICAgICAgICAgICAgZm9yICg7IGkgPCB0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlcltpXSA9IHRoaXMucmVhZEJ1ZmZlcltpICsgMV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlclt0aGlzLnJlYWRCdWZmZXIubGVuZ3RoIC0gMV0gPSByXG4gICAgICAgICAgICByZXR1cm4gclxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgb1xuICAgICAgICBmb3IgKGkgPSB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgciA9IHRoaXMud3JpdGVCdWZmZXJbaV1cbiAgICAgICAgICBpZiAoci5pZFsxXSA9PT0gaWRbMV0gJiYgci5pZFswXSA9PT0gaWRbMF0pIHtcbiAgICAgICAgICAgIG8gPSByXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaSA8IDAgJiYgbm9TdXBlckNhbGwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIGRpZCBub3QgcmVhY2ggYnJlYWsgaW4gbGFzdCBsb29wXG4gICAgICAgICAgLy8gcmVhZCBpZCBhbmQgcHV0IGl0IHRvIHRoZSBlbmQgb2YgcmVhZEJ1ZmZlclxuICAgICAgICAgIG8gPSB5aWVsZCogc3VwZXIuZmluZChpZClcbiAgICAgICAgfVxuICAgICAgICBpZiAobyAhPSBudWxsKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMucmVhZEJ1ZmZlci5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlcltpXSA9IHRoaXMucmVhZEJ1ZmZlcltpICsgMV1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yZWFkQnVmZmVyW3RoaXMucmVhZEJ1ZmZlci5sZW5ndGggLSAxXSA9IG9cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb1xuICAgICAgfVxuICAgICAgKiBwdXQgKG8pIHtcbiAgICAgICAgdmFyIGlkID0gby5pZFxuICAgICAgICB2YXIgaSwgciAvLyBoZWxwZXIgdmFyaWFibGVzXG4gICAgICAgIGZvciAoaSA9IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICByID0gdGhpcy53cml0ZUJ1ZmZlcltpXVxuICAgICAgICAgIGlmIChyLmlkWzFdID09PSBpZFsxXSAmJiByLmlkWzBdID09PSBpZFswXSkge1xuICAgICAgICAgICAgLy8gaXMgYWxyZWFkeSBpbiBidWZmZXJcbiAgICAgICAgICAgIC8vIGZvcmdldCByLCBhbmQgbW92ZSBvIHRvIHRoZSBlbmQgb2Ygd3JpdGVCdWZmZXJcbiAgICAgICAgICAgIGZvciAoOyBpIDwgdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgICAgdGhpcy53cml0ZUJ1ZmZlcltpXSA9IHRoaXMud3JpdGVCdWZmZXJbaSArIDFdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLndyaXRlQnVmZmVyW3RoaXMud3JpdGVCdWZmZXIubGVuZ3RoIC0gMV0gPSBvXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaSA8IDApIHtcbiAgICAgICAgICAvLyBkaWQgbm90IHJlYWNoIGJyZWFrIGluIGxhc3QgbG9vcFxuICAgICAgICAgIC8vIHdyaXRlIHdyaXRlQnVmZmVyWzBdXG4gICAgICAgICAgdmFyIHdyaXRlID0gdGhpcy53cml0ZUJ1ZmZlclswXVxuICAgICAgICAgIGlmICh3cml0ZS5pZFswXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgeWllbGQqIHN1cGVyLnB1dCh3cml0ZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcHV0IG8gdG8gdGhlIGVuZCBvZiB3cml0ZUJ1ZmZlclxuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgdGhpcy53cml0ZUJ1ZmZlcltpXSA9IHRoaXMud3JpdGVCdWZmZXJbaSArIDFdXG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMud3JpdGVCdWZmZXJbdGhpcy53cml0ZUJ1ZmZlci5sZW5ndGggLSAxXSA9IG9cbiAgICAgICAgfVxuICAgICAgICAvLyBjaGVjayByZWFkQnVmZmVyIGZvciBldmVyeSBvY2N1cmVuY2Ugb2Ygby5pZCwgb3ZlcndyaXRlIGlmIGZvdW5kXG4gICAgICAgIC8vIHdoZXRoZXIgZm91bmQgb3Igbm90LCB3ZSdsbCBhcHBlbmQgbyB0byB0aGUgcmVhZGJ1ZmZlclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5yZWFkQnVmZmVyLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgIHIgPSB0aGlzLnJlYWRCdWZmZXJbaSArIDFdXG4gICAgICAgICAgaWYgKHIuaWRbMV0gPT09IGlkWzFdICYmIHIuaWRbMF0gPT09IGlkWzBdKSB7XG4gICAgICAgICAgICB0aGlzLnJlYWRCdWZmZXJbaV0gPSBvXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVhZEJ1ZmZlcltpXSA9IHJcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWFkQnVmZmVyW3RoaXMucmVhZEJ1ZmZlci5sZW5ndGggLSAxXSA9IG9cbiAgICAgIH1cbiAgICAgICogZGVsZXRlIChpZCkge1xuICAgICAgICB2YXIgaSwgclxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5yZWFkQnVmZmVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgciA9IHRoaXMucmVhZEJ1ZmZlcltpXVxuICAgICAgICAgIGlmIChyLmlkWzFdID09PSBpZFsxXSAmJiByLmlkWzBdID09PSBpZFswXSkge1xuICAgICAgICAgICAgdGhpcy5yZWFkQnVmZmVyW2ldID0ge1xuICAgICAgICAgICAgICBpZDogW251bGwsIG51bGxdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHlpZWxkKiB0aGlzLmZsdXNoKClcbiAgICAgICAgeWllbGQqIHN1cGVyLmRlbGV0ZShpZClcbiAgICAgIH1cbiAgICAgICogZmluZFdpdGhMb3dlckJvdW5kIChpZCkge1xuICAgICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLmZpbmQoaWQsIHRydWUpXG4gICAgICAgIGlmIChvICE9IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gb1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkKiB0aGlzLmZsdXNoKClcbiAgICAgICAgICByZXR1cm4geWllbGQqIHN1cGVyLmZpbmRXaXRoTG93ZXJCb3VuZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgICogZmluZFdpdGhVcHBlckJvdW5kIChpZCkge1xuICAgICAgICB2YXIgbyA9IHlpZWxkKiB0aGlzLmZpbmQoaWQsIHRydWUpXG4gICAgICAgIGlmIChvICE9IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gb1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkKiB0aGlzLmZsdXNoKClcbiAgICAgICAgICByZXR1cm4geWllbGQqIHN1cGVyLmZpbmRXaXRoVXBwZXJCb3VuZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgICogZmluZE5leHQgKCkge1xuICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgIHJldHVybiB5aWVsZCogc3VwZXIuZmluZE5leHQuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgfVxuICAgICAgKiBmaW5kUHJldiAoKSB7XG4gICAgICAgIHlpZWxkKiB0aGlzLmZsdXNoKClcbiAgICAgICAgcmV0dXJuIHlpZWxkKiBzdXBlci5maW5kUHJldi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICB9XG4gICAgICAqIGl0ZXJhdGUgKCkge1xuICAgICAgICB5aWVsZCogdGhpcy5mbHVzaCgpXG4gICAgICAgIHlpZWxkKiBzdXBlci5pdGVyYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICAgIH1cbiAgICAgICogZmx1c2ggKCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgd3JpdGUgPSB0aGlzLndyaXRlQnVmZmVyW2ldXG4gICAgICAgICAgaWYgKHdyaXRlLmlkWzBdICE9PSBudWxsKSB7XG4gICAgICAgICAgICB5aWVsZCogc3VwZXIucHV0KHdyaXRlKVxuICAgICAgICAgICAgdGhpcy53cml0ZUJ1ZmZlcltpXSA9IHtcbiAgICAgICAgICAgICAgaWQ6IFtudWxsLCBudWxsXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gU21hbGxMb29rdXBCdWZmZXJcbiAgfVxuICBZLnV0aWxzLmNyZWF0ZVNtYWxsTG9va3VwQnVmZmVyID0gY3JlYXRlU21hbGxMb29rdXBCdWZmZXJcblxuICAvLyBHZW5lcmF0ZXMgYSB1bmlxdWUgaWQsIGZvciB1c2UgYXMgYSB1c2VyIGlkLlxuICAvLyBUaHggdG8gQGplZCBmb3IgdGhpcyBzY3JpcHQgaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vamVkLzk4Mjg4M1xuICBmdW5jdGlvbiBnZW5lcmF0ZUd1aWQoYSl7cmV0dXJuIGE/KGFeTWF0aC5yYW5kb20oKSoxNj4+YS80KS50b1N0cmluZygxNik6KFsxZTddKy0xZTMrLTRlMystOGUzKy0xZTExKS5yZXBsYWNlKC9bMDE4XS9nLGdlbmVyYXRlR3VpZCl9IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgWS51dGlscy5nZW5lcmF0ZUd1aWQgPSBnZW5lcmF0ZUd1aWRcbn1cbiIsIi8qIEBmbG93ICovXG4ndXNlIHN0cmljdCdcblxucmVxdWlyZSgnLi9Db25uZWN0b3IuanMnKShZKVxucmVxdWlyZSgnLi9EYXRhYmFzZS5qcycpKFkpXG5yZXF1aXJlKCcuL1RyYW5zYWN0aW9uLmpzJykoWSlcbnJlcXVpcmUoJy4vU3RydWN0LmpzJykoWSlcbnJlcXVpcmUoJy4vVXRpbHMuanMnKShZKVxucmVxdWlyZSgnLi9Db25uZWN0b3JzL1Rlc3QuanMnKShZKVxuXG5ZLmRlYnVnID0gcmVxdWlyZSgnZGVidWcnKVxuXG52YXIgcmVxdWlyaW5nTW9kdWxlcyA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gWVxuWS5yZXF1aXJpbmdNb2R1bGVzID0gcmVxdWlyaW5nTW9kdWxlc1xuXG5ZLmV4dGVuZCA9IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMiAmJiB0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBZLnV0aWxzLkN1c3RvbVR5cGVEZWZpbml0aW9uKSB7XG4gICAgICBZW25hbWVdID0gdmFsdWUucGFyc2VBcmd1bWVudHNcbiAgICB9IGVsc2Uge1xuICAgICAgWVtuYW1lXSA9IHZhbHVlXG4gICAgfVxuICAgIGlmIChyZXF1aXJpbmdNb2R1bGVzW25hbWVdICE9IG51bGwpIHtcbiAgICAgIHJlcXVpcmluZ01vZHVsZXNbbmFtZV0ucmVzb2x2ZSgpXG4gICAgICBkZWxldGUgcmVxdWlyaW5nTW9kdWxlc1tuYW1lXVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGYgPSBhcmd1bWVudHNbaV1cbiAgICAgIGlmICh0eXBlb2YgZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmKFkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGZ1bmN0aW9uIScpXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cblkucmVxdWVzdE1vZHVsZXMgPSByZXF1ZXN0TW9kdWxlc1xuZnVuY3Rpb24gcmVxdWVzdE1vZHVsZXMgKG1vZHVsZXMpIHtcbiAgdmFyIHNvdXJjZURpclxuICBpZiAoWS5zb3VyY2VEaXIgPT09IG51bGwpIHtcbiAgICBzb3VyY2VEaXIgPSBudWxsXG4gIH0gZWxzZSB7XG4gICAgc291cmNlRGlyID0gWS5zb3VyY2VEaXIgfHwgJy9ib3dlcl9jb21wb25lbnRzJ1xuICB9XG4gIC8vIGRldGVybWluZSBpZiB0aGlzIG1vZHVsZSB3YXMgY29tcGlsZWQgZm9yIGVzNSBvciBlczYgKHkuanMgdnMuIHkuZXM2KVxuICAvLyBpZiBJbnNlcnQuZXhlY3V0ZSBpcyBhIEZ1bmN0aW9uLCB0aGVuIGl0IGlzbnQgYSBnZW5lcmF0b3IuLlxuICAvLyB0aGVuIGxvYWQgdGhlIGVzNSguanMpIGZpbGVzLi5cbiAgdmFyIGV4dGVudGlvbiA9IHR5cGVvZiByZWdlbmVyYXRvclJ1bnRpbWUgIT09ICd1bmRlZmluZWQnID8gJy5qcycgOiAnLmVzNidcbiAgdmFyIHByb21pc2VzID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1vZHVsZSA9IG1vZHVsZXNbaV0uc3BsaXQoJygnKVswXVxuICAgIHZhciBtb2R1bGVuYW1lID0gJ3ktJyArIG1vZHVsZS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKFlbbW9kdWxlXSA9PSBudWxsKSB7XG4gICAgICBpZiAocmVxdWlyaW5nTW9kdWxlc1ttb2R1bGVdID09IG51bGwpIHtcbiAgICAgICAgLy8gbW9kdWxlIGRvZXMgbm90IGV4aXN0XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuWSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBpZiAoc291cmNlRGlyICE9IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBpbXBvcnRlZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpXG4gICAgICAgICAgICBpbXBvcnRlZC5zcmMgPSBzb3VyY2VEaXIgKyAnLycgKyBtb2R1bGVuYW1lICsgJy8nICsgbW9kdWxlbmFtZSArIGV4dGVudGlvblxuICAgICAgICAgICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChpbXBvcnRlZClcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IHJlcXVpcmVNb2R1bGUgPSB7fVxuICAgICAgICAgIHJlcXVpcmluZ01vZHVsZXNbbW9kdWxlXSA9IHJlcXVpcmVNb2R1bGVcbiAgICAgICAgICByZXF1aXJlTW9kdWxlLnByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICAgICAgcmVxdWlyZU1vZHVsZS5yZXNvbHZlID0gcmVzb2x2ZVxuICAgICAgICAgIH0pXG4gICAgICAgICAgcHJvbWlzZXMucHVzaChyZXF1aXJlTW9kdWxlLnByb21pc2UpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5pbmZvKCdZSlM6IFBsZWFzZSBkbyBub3QgZGVwZW5kIG9uIGF1dG9tYXRpYyByZXF1aXJpbmcgb2YgbW9kdWxlcyBhbnltb3JlISBFeHRlbmQgbW9kdWxlcyBhcyBmb2xsb3dzIGByZXF1aXJlKFxcJ3ktbW9kdWxlbmFtZVxcJykoWSlgJylcbiAgICAgICAgICByZXF1aXJlKG1vZHVsZW5hbWUpKFkpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByb21pc2VzLnB1c2gocmVxdWlyaW5nTW9kdWxlc1ttb2R1bGVzW2ldXS5wcm9taXNlKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpXG59XG5cbi8qIDo6XG50eXBlIE1lbW9yeU9wdGlvbnMgPSB7XG4gIG5hbWU6ICdtZW1vcnknXG59XG50eXBlIEluZGV4ZWREQk9wdGlvbnMgPSB7XG4gIG5hbWU6ICdpbmRleGVkZGInLFxuICBuYW1lc3BhY2U6IHN0cmluZ1xufVxudHlwZSBEYk9wdGlvbnMgPSBNZW1vcnlPcHRpb25zIHwgSW5kZXhlZERCT3B0aW9uc1xuXG50eXBlIFdlYlJUQ09wdGlvbnMgPSB7XG4gIG5hbWU6ICd3ZWJydGMnLFxuICByb29tOiBzdHJpbmdcbn1cbnR5cGUgV2Vic29ja2V0c0NsaWVudE9wdGlvbnMgPSB7XG4gIG5hbWU6ICd3ZWJzb2NrZXRzLWNsaWVudCcsXG4gIHJvb206IHN0cmluZ1xufVxudHlwZSBDb25uZWN0aW9uT3B0aW9ucyA9IFdlYlJUQ09wdGlvbnMgfCBXZWJzb2NrZXRzQ2xpZW50T3B0aW9uc1xuXG50eXBlIFlPcHRpb25zID0ge1xuICBjb25uZWN0b3I6IENvbm5lY3Rpb25PcHRpb25zLFxuICBkYjogRGJPcHRpb25zLFxuICB0eXBlczogQXJyYXk8VHlwZU5hbWU+LFxuICBzb3VyY2VEaXI6IHN0cmluZyxcbiAgc2hhcmU6IHtba2V5OiBzdHJpbmddOiBUeXBlTmFtZX1cbn1cbiovXG5cbmZ1bmN0aW9uIFkgKG9wdHMvKiA6WU9wdGlvbnMgKi8pIC8qIDpQcm9taXNlPFlDb25maWc+ICovIHtcbiAgaWYgKG9wdHMuaGFzT3duUHJvcGVydHkoJ3NvdXJjZURpcicpKSB7XG4gICAgWS5zb3VyY2VEaXIgPSBvcHRzLnNvdXJjZURpclxuICB9XG4gIG9wdHMudHlwZXMgPSBvcHRzLnR5cGVzICE9IG51bGwgPyBvcHRzLnR5cGVzIDogW11cbiAgdmFyIG1vZHVsZXMgPSBbb3B0cy5kYi5uYW1lLCBvcHRzLmNvbm5lY3Rvci5uYW1lXS5jb25jYXQob3B0cy50eXBlcylcbiAgZm9yICh2YXIgbmFtZSBpbiBvcHRzLnNoYXJlKSB7XG4gICAgbW9kdWxlcy5wdXNoKG9wdHMuc2hhcmVbbmFtZV0pXG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAob3B0cyA9PSBudWxsKSByZWplY3QoJ0FuIG9wdGlvbnMgb2JqZWN0IGlzIGV4cGVjdGVkISAnKVxuICAgIGVsc2UgaWYgKG9wdHMuY29ubmVjdG9yID09IG51bGwpIHJlamVjdCgnWW91IG11c3Qgc3BlY2lmeSBhIGNvbm5lY3RvciEgKG1pc3NpbmcgY29ubmVjdG9yIHByb3BlcnR5KScpXG4gICAgZWxzZSBpZiAob3B0cy5jb25uZWN0b3IubmFtZSA9PSBudWxsKSByZWplY3QoJ1lvdSBtdXN0IHNwZWNpZnkgY29ubmVjdG9yIG5hbWUhIChtaXNzaW5nIGNvbm5lY3Rvci5uYW1lIHByb3BlcnR5KScpXG4gICAgZWxzZSBpZiAob3B0cy5kYiA9PSBudWxsKSByZWplY3QoJ1lvdSBtdXN0IHNwZWNpZnkgYSBkYXRhYmFzZSEgKG1pc3NpbmcgZGIgcHJvcGVydHkpJylcbiAgICBlbHNlIGlmIChvcHRzLmNvbm5lY3Rvci5uYW1lID09IG51bGwpIHJlamVjdCgnWW91IG11c3Qgc3BlY2lmeSBkYiBuYW1lISAobWlzc2luZyBkYi5uYW1lIHByb3BlcnR5KScpXG4gICAgZWxzZSB7XG4gICAgICBvcHRzID0gWS51dGlscy5jb3B5T2JqZWN0KG9wdHMpXG4gICAgICBvcHRzLmNvbm5lY3RvciA9IFkudXRpbHMuY29weU9iamVjdChvcHRzLmNvbm5lY3RvcilcbiAgICAgIG9wdHMuZGIgPSBZLnV0aWxzLmNvcHlPYmplY3Qob3B0cy5kYilcbiAgICAgIG9wdHMuc2hhcmUgPSBZLnV0aWxzLmNvcHlPYmplY3Qob3B0cy5zaGFyZSlcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBZLnJlcXVlc3RNb2R1bGVzKG1vZHVsZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciB5Y29uZmlnID0gbmV3IFlDb25maWcob3B0cylcbiAgICAgICAgICB5Y29uZmlnLmRiLndoZW5Vc2VySWRTZXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgeWNvbmZpZy5pbml0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh5Y29uZmlnKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9KS5jYXRjaChyZWplY3QpXG4gICAgICB9LCAwKVxuICAgIH1cbiAgfSlcbn1cblxuY2xhc3MgWUNvbmZpZyB7XG4gIC8qIDo6XG4gIGRiOiBZLkFic3RyYWN0RGF0YWJhc2U7XG4gIGNvbm5lY3RvcjogWS5BYnN0cmFjdENvbm5lY3RvcjtcbiAgc2hhcmU6IHtba2V5OiBzdHJpbmddOiBhbnl9O1xuICBvcHRpb25zOiBPYmplY3Q7XG4gICovXG4gIGNvbnN0cnVjdG9yIChvcHRzLCBjYWxsYmFjaykge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdHNcbiAgICB0aGlzLmRiID0gbmV3IFlbb3B0cy5kYi5uYW1lXSh0aGlzLCBvcHRzLmRiKVxuICAgIHRoaXMuY29ubmVjdG9yID0gbmV3IFlbb3B0cy5jb25uZWN0b3IubmFtZV0odGhpcywgb3B0cy5jb25uZWN0b3IpXG4gICAgdGhpcy5jb25uZWN0ZWQgPSB0cnVlXG4gIH1cbiAgaW5pdCAoY2FsbGJhY2spIHtcbiAgICB2YXIgb3B0cyA9IHRoaXMub3B0aW9uc1xuICAgIHZhciBzaGFyZSA9IHt9XG4gICAgdGhpcy5zaGFyZSA9IHNoYXJlXG4gICAgdGhpcy5kYi5yZXF1ZXN0VHJhbnNhY3Rpb24oZnVuY3Rpb24gKiByZXF1ZXN0VHJhbnNhY3Rpb24gKCkge1xuICAgICAgLy8gY3JlYXRlIHNoYXJlZCBvYmplY3RcbiAgICAgIGZvciAodmFyIHByb3BlcnR5bmFtZSBpbiBvcHRzLnNoYXJlKSB7XG4gICAgICAgIHZhciB0eXBlQ29uc3RydWN0b3IgPSBvcHRzLnNoYXJlW3Byb3BlcnR5bmFtZV0uc3BsaXQoJygnKVxuICAgICAgICB2YXIgdHlwZU5hbWUgPSB0eXBlQ29uc3RydWN0b3Iuc3BsaWNlKDAsIDEpXG4gICAgICAgIHZhciB0eXBlID0gWVt0eXBlTmFtZV1cbiAgICAgICAgdmFyIHR5cGVkZWYgPSB0eXBlLnR5cGVEZWZpbml0aW9uXG4gICAgICAgIHZhciBpZCA9IFsnXycsIHR5cGVkZWYuc3RydWN0ICsgJ18nICsgdHlwZU5hbWUgKyAnXycgKyBwcm9wZXJ0eW5hbWUgKyAnXycgKyB0eXBlQ29uc3RydWN0b3JdXG4gICAgICAgIHZhciBhcmdzID0gW11cbiAgICAgICAgaWYgKHR5cGVDb25zdHJ1Y3Rvci5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXJncyA9IEpTT04ucGFyc2UoJ1snICsgdHlwZUNvbnN0cnVjdG9yWzBdLnNwbGl0KCcpJylbMF0gKyAnXScpXG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXYXMgbm90IGFibGUgdG8gcGFyc2UgdHlwZSBkZWZpbml0aW9uISAoc2hhcmUuJyArIHByb3BlcnR5bmFtZSArICcpJylcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHR5cGUudHlwZURlZmluaXRpb24ucGFyc2VBcmd1bWVudHMgPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHR5cGVOYW1lICsgJyBkb2VzIG5vdCBleHBlY3QgYXJndW1lbnRzIScpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFyZ3MgPSB0eXBlZGVmLnBhcnNlQXJndW1lbnRzKGFyZ3NbMF0pWzFdXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNoYXJlW3Byb3BlcnR5bmFtZV0gPSB5aWVsZCogdGhpcy5zdG9yZS5pbml0VHlwZS5jYWxsKHRoaXMsIGlkLCBhcmdzKVxuICAgICAgfVxuICAgICAgdGhpcy5zdG9yZS53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoKVxuICAgICAgICAudGhlbihjYWxsYmFjaylcbiAgICB9KVxuICB9XG4gIGlzQ29ubmVjdGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25uZWN0b3IuaXNTeW5jZWRcbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2VcbiAgICAgIHJldHVybiB0aGlzLmNvbm5lY3Rvci5kaXNjb25uZWN0KClcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgfVxuICB9XG4gIHJlY29ubmVjdCAoKSB7XG4gICAgaWYgKCF0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgdGhpcy5jb25uZWN0ZWQgPSB0cnVlXG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0b3IucmVjb25uZWN0KClcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgfVxuICB9XG4gIGRlc3Ryb3kgKCkge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIHJldHVybiB0aGlzLmNsb3NlKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5kYi5kZWxldGVEQiAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmRiLmRlbGV0ZURCKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgfVxuICAgIH0pXG4gIH1cbiAgY2xvc2UgKCkge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIHRoaXMuc2hhcmUgPSBudWxsXG4gICAgaWYgKHRoaXMuY29ubmVjdG9yLmRlc3Ryb3kgIT0gbnVsbCkge1xuICAgICAgdGhpcy5jb25uZWN0b3IuZGVzdHJveSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdG9yLmRpc2Nvbm5lY3QoKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5kYi53aGVuVHJhbnNhY3Rpb25zRmluaXNoZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdGhpcy5kYi5kZXN0cm95VHlwZXMoKVxuICAgICAgLy8gbWFrZSBzdXJlIHRvIHdhaXQgZm9yIGFsbCB0cmFuc2FjdGlvbnMgYmVmb3JlIGRlc3Ryb3lpbmcgdGhlIGRiXG4gICAgICB0aGlzLmRiLnJlcXVlc3RUcmFuc2FjdGlvbihmdW5jdGlvbiAqICgpIHtcbiAgICAgICAgeWllbGQqIHNlbGYuZGIuZGVzdHJveSgpXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHRoaXMuZGIud2hlblRyYW5zYWN0aW9uc0ZpbmlzaGVkKClcbiAgICB9KVxuICB9XG59XG4iLCJjb25zdCBZID0gcmVxdWlyZSgneWpzJyk7XG5yZXF1aXJlKCd5LW1lbW9yeScpKFkpO1xucmVxdWlyZSgneS13ZWJydGMzJykoWSk7XG5yZXF1aXJlKCd5LWFycmF5JykoWSk7XG5yZXF1aXJlKCd5LW1hcCcpKFkpO1xucmVxdWlyZSgneS10ZXh0JykoWSk7XG5yZXF1aXJlKCd5LXhtbCcpKFkpO1xuXG5ZKHtcbiAgZGI6IHtcbiAgICBuYW1lOiAnbWVtb3J5J1xuICB9LFxuICBjb25uZWN0b3I6IHtcbiAgICBuYW1lOiAnd2VicnRjJyxcbiAgICAvL25hbWU6ICd3ZWJzb2NrZXRzLWNsaWVudCcsXG4gICAgcm9vbTogJ3Jvb20nLFxuICAgIHVybDogJ2h0dHA6Ly9maW53aW4uaW86MTI1NidcbiAgfSxcbiAgc2hhcmU6IHtcbiAgICBjb2RlbWlycm9yOiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjI6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yMzogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I0OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjU6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yNjogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3I3OiAnVGV4dCcsXG4gICAgY29kZW1pcnJvcjg6ICdUZXh0JyxcbiAgICBjb2RlbWlycm9yOTogJ1RleHQnLFxuICAgIGNvZGVtaXJyb3IxMDogJ1RleHQnLFxuICAgIHhtbDogJ1htbCcsXG4gICAgeG1sMjogJ1htbCcsXG4gICAgeG1sMzogJ1htbCcsXG4gICAgeG1sNDogJ1htbCcsXG4gICAgeG1sNTogJ1htbCcsXG4gICAgeG1sNjogJ1htbCcsXG4gICAgeG1sNzogJ1htbCcsXG4gICAgeG1sODogJ1htbCcsXG4gICAgeG1sOTogJ1htbCcsXG4gICAgeG1sMTA6ICdYbWwnXG4gIH1cbn0pLnRoZW4oZnVuY3Rpb24gKHkpIHtcbiAgICBjb25zb2xlLmxvZygnIyMjIyMjIyMjIyMjJyk7XG4gICAgd2luZG93LnlYbWwgPSB5O1xuICAgIHkuc2hhcmUuY29kZW1pcnJvci5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3InXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yMi5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3IyJ10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjMuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yMyddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I0LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjQnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yNS5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I1J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjYuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yNiddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3I3LmJpbmQod2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjcnXSk7XG4gICAgeS5zaGFyZS5jb2RlbWlycm9yOC5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I4J10pO1xuICAgIHkuc2hhcmUuY29kZW1pcnJvcjkuYmluZCh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yOSddKTtcbiAgICB5LnNoYXJlLmNvZGVtaXJyb3IxMC5iaW5kKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3IxMCddKTtcbiAgICB5LnNoYXJlLnhtbC5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbCddKTtcbiAgICB5LnNoYXJlLnhtbDIuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWwyJ10pO1xuICAgIHkuc2hhcmUueG1sMy5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDMnXSk7XG4gICAgeS5zaGFyZS54bWw0Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNCddKTtcbiAgICB5LnNoYXJlLnhtbDUuX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw1J10pO1xuICAgIHkuc2hhcmUueG1sNi5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDYnXSk7XG4gICAgeS5zaGFyZS54bWw3Ll9iaW5kVG9Eb20od2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNyddKTtcbiAgICB5LnNoYXJlLnhtbDguX2JpbmRUb0RvbSh3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWyd4bWw4J10pO1xuICAgIHkuc2hhcmUueG1sOS5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDknXSk7XG4gICAgeS5zaGFyZS54bWwxMC5fYmluZFRvRG9tKHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDEwJ10pO1xufSlcbiJdfQ==

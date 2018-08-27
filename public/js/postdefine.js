(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function load_ynotebook() {
    var url = new URL(window.location.href);
    var total_cells = url.searchParams.get('total_cells') || 150;
    if (typeof window.sockets !== 'undefined' && typeof window.shared_elements_available !== 'undefined') {
        load_ynotebook2();
    } else {
        setTimeout(load_ynotebook, 0);
    }

    function load_ynotebook2() {
        if (
            typeof window.ymap !== 'undefined'
            && typeof window.Jupyter !== 'undefined'
            && typeof window.Jupyter.notebook !== 'undefined'
            && window.Jupyter.notebook.get_cells().length === total_cells
            ) {
            load_ynotebook3();
        } else {
            setTimeout(load_ynotebook2, 0);
        }
    }

    function get_inactive_cell(type) {
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

    function load_ynotebook3() {
        function load_ynotebook4(data) {
            $('#nbload_status').text('Loading Notebook');
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<total_cells; i++) {
                var new_cell = new_cells[i];
                if (new_cell) {
                    var cell = get_inactive_cell(new_cell.cell_type);
                    cell.fromJSON(new_cell);
                    var id = cell.element.find('.input_area').data('id');
                    cell.element.find('.input_area').data('active', 'yes');
                    ymap.set(id, {'index': i, 'active': 'yes'});
                }
            }
            $('#nbload').hide();
        }

        if (window.sockets === 0) {
            $('#nbload_status').text('Downloading Notebook');
            Jupyter.notebook.contents.get(Jupyter.notebook.notebook_path, {type: 'notebook'}).then(
                $.proxy(load_ynotebook4, this)
            );
        } else {
            $('#nbload_status').text('Syncing Notebook');
            setTimeout(function () {
                $('#nbload').hide();
            }, 3000);
        }
    }
}

load_ynotebook();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJmdW5jdGlvbiBsb2FkX3lub3RlYm9vaygpIHtcbiAgICB2YXIgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgdmFyIHRvdGFsX2NlbGxzID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3RvdGFsX2NlbGxzJykgfHwgMTUwO1xuICAgIGlmICh0eXBlb2Ygd2luZG93LnNvY2tldHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzX2F2YWlsYWJsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9hZF95bm90ZWJvb2syKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0VGltZW91dChsb2FkX3lub3RlYm9vaywgMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2syKCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0eXBlb2Ygd2luZG93LnltYXAgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIubm90ZWJvb2sgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB3aW5kb3cuSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKS5sZW5ndGggPT09IHRvdGFsX2NlbGxzXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgIGxvYWRfeW5vdGVib29rMygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0VGltZW91dChsb2FkX3lub3RlYm9vazIsIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0X2luYWN0aXZlX2NlbGwodHlwZSkge1xuICAgICAgICB2YXIgY2VsbHMgPSBKdXB5dGVyLm5vdGVib29rLmdldF9jZWxscygpO1xuICAgICAgICBmb3IgKHZhciBpPTA7IGk8Y2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBjZWxsc1tpXS5lbGVtZW50LmZpbmQoJy5pbnB1dF9hcmVhJykuZGF0YSgnYWN0aXZlJykgPT09ICdubydcbiAgICAgICAgICAgICAgICAmJiBjZWxsc1tpXS5jZWxsX3R5cGUgPT09IHR5cGVcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2VsbHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazMoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rNChkYXRhKSB7XG4gICAgICAgICAgICAkKCcjbmJsb2FkX3N0YXR1cycpLnRleHQoJ0xvYWRpbmcgTm90ZWJvb2snKTtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0b3RhbF9jZWxsczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld19jZWxsID0gbmV3X2NlbGxzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IGdldF9pbmFjdGl2ZV9jZWxsKG5ld19jZWxsLmNlbGxfdHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZnJvbUpTT04obmV3X2NlbGwpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWQgPSBjZWxsLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdpZCcpO1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdhY3RpdmUnLCAneWVzJyk7XG4gICAgICAgICAgICAgICAgICAgIHltYXAuc2V0KGlkLCB7J2luZGV4JzogaSwgJ2FjdGl2ZSc6ICd5ZXMnfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJCgnI25ibG9hZCcpLmhpZGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3aW5kb3cuc29ja2V0cyA9PT0gMCkge1xuICAgICAgICAgICAgJCgnI25ibG9hZF9zdGF0dXMnKS50ZXh0KCdEb3dubG9hZGluZyBOb3RlYm9vaycpO1xuICAgICAgICAgICAgSnVweXRlci5ub3RlYm9vay5jb250ZW50cy5nZXQoSnVweXRlci5ub3RlYm9vay5ub3RlYm9va19wYXRoLCB7dHlwZTogJ25vdGVib29rJ30pLnRoZW4oXG4gICAgICAgICAgICAgICAgJC5wcm94eShsb2FkX3lub3RlYm9vazQsIHRoaXMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJCgnI25ibG9hZF9zdGF0dXMnKS50ZXh0KCdTeW5jaW5nIE5vdGVib29rJyk7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkKCcjbmJsb2FkJykuaGlkZSgpO1xuICAgICAgICAgICAgfSwgMzAwMCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmxvYWRfeW5vdGVib29rKCk7XG4iXX0=

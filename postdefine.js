(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function load_ynotebook() {
    if (typeof window.sockets !== 'undefined') {
        load_ynotebook2();
    } else {
        setTimeout(load_ynotebook, 0);
    }

    function load_ynotebook2() {
        if (typeof window.ymap !== 'undefined' && typeof window.Jupyter !== 'undefined' && typeof window.Jupyter.notebook !== 'undefined') {
            load_ynotebook3();
        } else {
            setTimeout(load_ynotebook2, 0);
        }
    }

    function load_ynotebook3() {
        function load_ynotebook4(data) {
            var new_cells = data.content.cells;
            ncells = new_cells.length;
            for (var i=0; i<ncells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                cell.fromJSON(new_cells[i]);
                if (cell.metadata.active) {
                    cell.element.removeClass('hidden');
                    cell.focus_cell();
                }
            }
        }
        function load_ynotebook5(data) {
            var new_cells = data.content.cells;
            ncells = new_cells.length;
            for (var i=0; i<ncells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                cell.metadata = new_cells[i].metadata;
                if (new_cells[i].metadata.active) {
                    cell.element.removeClass('hidden');
                    cell.focus_cell();
                }
            }
        }

        if (window.sockets === 0) {
            Jupyter.notebook.contents.get(Jupyter.notebook.notebook_path, {type: 'notebook'}).then(
                $.proxy(load_ynotebook4, this)
            );
        } else if (window.sockets > 0) {
            Jupyter.notebook.contents.get(Jupyter.notebook.notebook_path, {type: 'notebook'}).then(
                $.proxy(load_ynotebook5, this)
            );
        }
    }
}

load_ynotebook();


},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJmdW5jdGlvbiBsb2FkX3lub3RlYm9vaygpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdy5zb2NrZXRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2FkX3lub3RlYm9vazIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rLCAwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazIoKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93LnltYXAgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuSnVweXRlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5KdXB5dGVyLm5vdGVib29rICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgbG9hZF95bm90ZWJvb2szKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rMiwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazMoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rNChkYXRhKSB7XG4gICAgICAgICAgICB2YXIgbmV3X2NlbGxzID0gZGF0YS5jb250ZW50LmNlbGxzO1xuICAgICAgICAgICAgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxuY2VsbHM7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjZWxsID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbChpKTtcbiAgICAgICAgICAgICAgICBjZWxsLmZyb21KU09OKG5ld19jZWxsc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGNlbGwubWV0YWRhdGEuYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZm9jdXNfY2VsbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazUoZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5ld19jZWxscyA9IGRhdGEuY29udGVudC5jZWxscztcbiAgICAgICAgICAgIG5jZWxscyA9IG5ld19jZWxscy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8bmNlbGxzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGwoaSk7XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YSA9IG5ld19jZWxsc1tpXS5tZXRhZGF0YTtcbiAgICAgICAgICAgICAgICBpZiAobmV3X2NlbGxzW2ldLm1ldGFkYXRhLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmZvY3VzX2NlbGwoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2luZG93LnNvY2tldHMgPT09IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMuZ2V0KEp1cHl0ZXIubm90ZWJvb2subm90ZWJvb2tfcGF0aCwge3R5cGU6ICdub3RlYm9vayd9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s0LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc29ja2V0cyA+IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMuZ2V0KEp1cHl0ZXIubm90ZWJvb2subm90ZWJvb2tfcGF0aCwge3R5cGU6ICdub3RlYm9vayd9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s1LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9hZF95bm90ZWJvb2soKTtcblxuIl19

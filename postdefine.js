(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function load_ynotebook() {
    if (typeof window.sockets !== 'undefined' && typeof window.shared_elements_available !== 'undefined') {
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
            var ncells = new_cells.length;
            for (var i=0; i<100; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                cell.element.removeClass('hidden');
                if (new_cells[i]) {
                    cell.fromJSON(new_cells[i]);
                }
                cell.metadata['active'] = true;
                cell.metadata['id'] = i;
            }
        }
        function load_ynotebook5(data) {
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<100; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                cell.element.removeClass('hidden');
                if (new_cells[i]) {
                    cell.fromJSON(new_cells[i]);
                }
                cell.metadata['active'] = true;
                cell.metadata['id'] = i;
            }
        }

        var url = new URL(window.location.href);
        url = url.searchParams.get('url');
        if (window.sockets === 0) {
            Jupyter.notebook.contents.remote_get(Jupyter.notebook.notebook_path, {type: 'notebook', url: url}).then(
                $.proxy(load_ynotebook4, this)
            );
        } else if (window.sockets > 0) {
            Jupyter.notebook.contents.remote_get(Jupyter.notebook.notebook_path, {type: 'notebook', url: url}).then(
                $.proxy(load_ynotebook5, this)
            );
        }
    }
}

load_ynotebook();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJmdW5jdGlvbiBsb2FkX3lub3RlYm9vaygpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdy5zb2NrZXRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93LnNoYXJlZF9lbGVtZW50c19hdmFpbGFibGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGxvYWRfeW5vdGVib29rMigpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQobG9hZF95bm90ZWJvb2ssIDApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rMigpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cueW1hcCAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5KdXB5dGVyICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIubm90ZWJvb2sgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBsb2FkX3lub3RlYm9vazMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQobG9hZF95bm90ZWJvb2syLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rMygpIHtcbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s0KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTwxMDA7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjZWxsID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbChpKTtcbiAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5mcm9tSlNPTihuZXdfY2VsbHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnaWQnXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s1KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTwxMDA7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjZWxsID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbChpKTtcbiAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5mcm9tSlNPTihuZXdfY2VsbHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnaWQnXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgICAgIHVybCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCd1cmwnKTtcbiAgICAgICAgaWYgKHdpbmRvdy5zb2NrZXRzID09PSAwKSB7XG4gICAgICAgICAgICBKdXB5dGVyLm5vdGVib29rLmNvbnRlbnRzLnJlbW90ZV9nZXQoSnVweXRlci5ub3RlYm9vay5ub3RlYm9va19wYXRoLCB7dHlwZTogJ25vdGVib29rJywgdXJsOiB1cmx9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s0LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc29ja2V0cyA+IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMucmVtb3RlX2dldChKdXB5dGVyLm5vdGVib29rLm5vdGVib29rX3BhdGgsIHt0eXBlOiAnbm90ZWJvb2snLCB1cmw6IHVybH0pLnRoZW4oXG4gICAgICAgICAgICAgICAgJC5wcm94eShsb2FkX3lub3RlYm9vazUsIHRoaXMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5sb2FkX3lub3RlYm9vaygpO1xuIl19

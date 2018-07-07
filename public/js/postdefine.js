(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function load_ynotebook() {
    var total_cells = 500;
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

    function load_ynotebook3() {
        function load_ynotebook4(data) {
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<total_cells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                if (new_cells[i]) {
                    cell.fromJSON(new_cells[i]);
                    if (new_cells[i].source === '' || new_cells[i].source === []) {
                        cell.metadata['active'] = false;
                    } else {
                        cell.metadata['active'] = true;
                        cell.element.removeClass('hidden');
                    }
                } else {
                    cell.metadata['active'] = false;
                }
                cell.metadata['id'] = i;
            }
            window.metadata_loaded = true;
        }

        function load_ynotebook5(data) {
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<total_cells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                if (new_cells[i]) {
                    if (new_cells[i].source === '' || new_cells[i].source === []) {
                        cell.metadata['active'] = false;
                    } else {
                        cell.metadata['active'] = true;
                        cell.element.removeClass('hidden');
                    }
                } else {
                    cell.metadata['active'] = false;
                }
                cell.metadata['id'] = i;
            }
            window.metadata_loaded = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiZnVuY3Rpb24gbG9hZF95bm90ZWJvb2soKSB7XG4gICAgdmFyIHRvdGFsX2NlbGxzID0gNTAwO1xuICAgIGlmICh0eXBlb2Ygd2luZG93LnNvY2tldHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzX2F2YWlsYWJsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9hZF95bm90ZWJvb2syKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0VGltZW91dChsb2FkX3lub3RlYm9vaywgMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2syKCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0eXBlb2Ygd2luZG93LnltYXAgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIubm90ZWJvb2sgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB3aW5kb3cuSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKS5sZW5ndGggPT09IHRvdGFsX2NlbGxzXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgIGxvYWRfeW5vdGVib29rMygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0VGltZW91dChsb2FkX3lub3RlYm9vazIsIDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2szKCkge1xuICAgICAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazQoZGF0YSkge1xuICAgICAgICAgICAgdmFyIG5ld19jZWxscyA9IGRhdGEuY29udGVudC5jZWxscztcbiAgICAgICAgICAgIHZhciBuY2VsbHMgPSBuZXdfY2VsbHMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRvdGFsX2NlbGxzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGwoaSk7XG4gICAgICAgICAgICAgICAgaWYgKG5ld19jZWxsc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmZyb21KU09OKG5ld19jZWxsc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbHNbaV0uc291cmNlID09PSAnJyB8fCBuZXdfY2VsbHNbaV0uc291cmNlID09PSBbXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnYWN0aXZlJ10gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2FjdGl2ZSddID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydpZCddID0gaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpbmRvdy5tZXRhZGF0YV9sb2FkZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s1KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0b3RhbF9jZWxsczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNlbGwgPSBKdXB5dGVyLm5vdGVib29rLmdldF9jZWxsKGkpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld19jZWxsc1tpXS5zb3VyY2UgPT09ICcnIHx8IG5ld19jZWxsc1tpXS5zb3VyY2UgPT09IFtdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnYWN0aXZlJ10gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5lbGVtZW50LnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2FjdGl2ZSddID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2lkJ10gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2luZG93Lm1ldGFkYXRhX2xvYWRlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgICAgIHVybCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCd1cmwnKTtcbiAgICAgICAgaWYgKHdpbmRvdy5zb2NrZXRzID09PSAwKSB7XG4gICAgICAgICAgICBKdXB5dGVyLm5vdGVib29rLmNvbnRlbnRzLnJlbW90ZV9nZXQoSnVweXRlci5ub3RlYm9vay5ub3RlYm9va19wYXRoLCB7dHlwZTogJ25vdGVib29rJywgdXJsOiB1cmx9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s0LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc29ja2V0cyA+IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMucmVtb3RlX2dldChKdXB5dGVyLm5vdGVib29rLm5vdGVib29rX3BhdGgsIHt0eXBlOiAnbm90ZWJvb2snLCB1cmw6IHVybH0pLnRoZW4oXG4gICAgICAgICAgICAgICAgJC5wcm94eShsb2FkX3lub3RlYm9vazUsIHRoaXMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5sb2FkX3lub3RlYm9vaygpO1xuIl19

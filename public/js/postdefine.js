(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
function load_ynotebook() {
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
            && window.Jupyter.notebook.get_cells().length === 100
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
            for (var i=0; i<100; i++) {
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
        }
        function load_ynotebook5(data) {
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<100; i++) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImZ1bmN0aW9uIGxvYWRfeW5vdGVib29rKCkge1xuICAgIGlmICh0eXBlb2Ygd2luZG93LnNvY2tldHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzX2F2YWlsYWJsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9hZF95bm90ZWJvb2syKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2V0VGltZW91dChsb2FkX3lub3RlYm9vaywgMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2syKCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0eXBlb2Ygd2luZG93LnltYXAgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB0eXBlb2Ygd2luZG93Lkp1cHl0ZXIubm90ZWJvb2sgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAmJiB3aW5kb3cuSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbHMoKS5sZW5ndGggPT09IDEwMFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICBsb2FkX3lub3RlYm9vazMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQobG9hZF95bm90ZWJvb2syLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rMygpIHtcbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s0KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTwxMDA7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjZWxsID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbChpKTtcbiAgICAgICAgICAgICAgICBpZiAobmV3X2NlbGxzW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZnJvbUpTT04obmV3X2NlbGxzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld19jZWxsc1tpXS5zb3VyY2UgPT09ICcnIHx8IG5ld19jZWxsc1tpXS5zb3VyY2UgPT09IFtdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnYWN0aXZlJ10gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5lbGVtZW50LnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2FjdGl2ZSddID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2lkJ10gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rNShkYXRhKSB7XG4gICAgICAgICAgICB2YXIgbmV3X2NlbGxzID0gZGF0YS5jb250ZW50LmNlbGxzO1xuICAgICAgICAgICAgdmFyIG5jZWxscyA9IG5ld19jZWxscy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8MTAwOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGwoaSk7XG4gICAgICAgICAgICAgICAgaWYgKG5ld19jZWxsc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAobmV3X2NlbGxzW2ldLnNvdXJjZSA9PT0gJycgfHwgbmV3X2NlbGxzW2ldLnNvdXJjZSA9PT0gW10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNlbGwubWV0YWRhdGFbJ2FjdGl2ZSddID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhWydhY3RpdmUnXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnYWN0aXZlJ10gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2VsbC5tZXRhZGF0YVsnaWQnXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG4gICAgICAgIHVybCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCd1cmwnKTtcbiAgICAgICAgaWYgKHdpbmRvdy5zb2NrZXRzID09PSAwKSB7XG4gICAgICAgICAgICBKdXB5dGVyLm5vdGVib29rLmNvbnRlbnRzLnJlbW90ZV9nZXQoSnVweXRlci5ub3RlYm9vay5ub3RlYm9va19wYXRoLCB7dHlwZTogJ25vdGVib29rJywgdXJsOiB1cmx9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s0LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc29ja2V0cyA+IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMucmVtb3RlX2dldChKdXB5dGVyLm5vdGVib29rLm5vdGVib29rX3BhdGgsIHt0eXBlOiAnbm90ZWJvb2snLCB1cmw6IHVybH0pLnRoZW4oXG4gICAgICAgICAgICAgICAgJC5wcm94eShsb2FkX3lub3RlYm9vazUsIHRoaXMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5sb2FkX3lub3RlYm9vaygpO1xuIl19

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
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<total_cells; i++) {
                var new_cell = new_cells[i];
                if (new_cell) {
                    var cell = get_inactive_cell(new_cell.cell_type);
                    cell.fromJSON(new_cell);
                    var id = cell.element.find('.input_area').data('id');
                    cell.element.find('.input_area').data('active', 'yes');
                    ymap.set(id, {'index': id, 'active': 'yes'});
                }
            }
        }

        if (window.sockets === 0) {
            Jupyter.notebook.contents.get(Jupyter.notebook.notebook_path, {type: 'notebook'}).then(
                $.proxy(load_ynotebook4, this)
            );
        } 
    }
}

load_ynotebook();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImZ1bmN0aW9uIGxvYWRfeW5vdGVib29rKCkge1xuICAgIHZhciB1cmwgPSBuZXcgVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcbiAgICB2YXIgdG90YWxfY2VsbHMgPSB1cmwuc2VhcmNoUGFyYW1zLmdldCgndG90YWxfY2VsbHMnKSB8fCAxNTA7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cuc29ja2V0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNfYXZhaWxhYmxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2FkX3lub3RlYm9vazIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rLCAwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazIoKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHR5cGVvZiB3aW5kb3cueW1hcCAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICYmIHR5cGVvZiB3aW5kb3cuSnVweXRlciAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICYmIHR5cGVvZiB3aW5kb3cuSnVweXRlci5ub3RlYm9vayAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICYmIHdpbmRvdy5KdXB5dGVyLm5vdGVib29rLmdldF9jZWxscygpLmxlbmd0aCA9PT0gdG90YWxfY2VsbHNcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgbG9hZF95bm90ZWJvb2szKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rMiwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRfaW5hY3RpdmVfY2VsbCh0eXBlKSB7XG4gICAgICAgIHZhciBjZWxscyA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGxzKCk7XG4gICAgICAgIGZvciAodmFyIGk9MDsgaTxjZWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGNlbGxzW2ldLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdhY3RpdmUnKSA9PT0gJ25vJ1xuICAgICAgICAgICAgICAgICYmIGNlbGxzW2ldLmNlbGxfdHlwZSA9PT0gdHlwZVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjZWxsc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rMygpIHtcbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s0KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTx0b3RhbF9jZWxsczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld19jZWxsID0gbmV3X2NlbGxzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IGdldF9pbmFjdGl2ZV9jZWxsKG5ld19jZWxsLmNlbGxfdHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZnJvbUpTT04obmV3X2NlbGwpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWQgPSBjZWxsLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdpZCcpO1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQuZmluZCgnLmlucHV0X2FyZWEnKS5kYXRhKCdhY3RpdmUnLCAneWVzJyk7XG4gICAgICAgICAgICAgICAgICAgIHltYXAuc2V0KGlkLCB7J2luZGV4JzogaWQsICdhY3RpdmUnOiAneWVzJ30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh3aW5kb3cuc29ja2V0cyA9PT0gMCkge1xuICAgICAgICAgICAgSnVweXRlci5ub3RlYm9vay5jb250ZW50cy5nZXQoSnVweXRlci5ub3RlYm9vay5ub3RlYm9va19wYXRoLCB7dHlwZTogJ25vdGVib29rJ30pLnRoZW4oXG4gICAgICAgICAgICAgICAgJC5wcm94eShsb2FkX3lub3RlYm9vazQsIHRoaXMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9IFxuICAgIH1cbn1cblxubG9hZF95bm90ZWJvb2soKTtcbiJdfQ==

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
            var ncells = new_cells.length;
            for (var i=0; i<ncells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                cell.metadata = new_cells[i].metadata;
                if (new_cells[i].metadata.active) {
                    cell.element.removeClass('hidden');
                    cell.focus_cell();
                }
            }
        }

        //function convert_notebook(path) {
        //    var ncells = content.cells.length;
        //    for (var i=0; i<ncells; i++) {
        //        content.cells[i].metadata['id'] = i;
        //    }
        //    for (var i=ncells; i<100; i++) {
        //        if (i%2 === 0) {
        //            var cell = {'cell_type': 'code', 'execution_count': '', 'metadata': {'id': i}, 'outputs': [], 'source': []}
        //        } else {
        //            var cell = {'cell_type': 'markdown', 'execution_count': '', 'metadata': {'id': i}, 'outputs': [], 'source': []}
        //        }
        //        content.cells.push(cell);
        //    }
        //    content.metadata['ynotebook'] = true;
        //    console.log(content);
        //    return content;
        //}

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvcG9zdGRlZmluZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiZnVuY3Rpb24gbG9hZF95bm90ZWJvb2soKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cuc29ja2V0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNfYXZhaWxhYmxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2FkX3lub3RlYm9vazIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rLCAwKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazIoKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93LnltYXAgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuSnVweXRlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5KdXB5dGVyLm5vdGVib29rICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgbG9hZF95bm90ZWJvb2szKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGxvYWRfeW5vdGVib29rMiwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkX3lub3RlYm9vazMoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGxvYWRfeW5vdGVib29rNChkYXRhKSB7XG4gICAgICAgICAgICB2YXIgbmV3X2NlbGxzID0gZGF0YS5jb250ZW50LmNlbGxzO1xuICAgICAgICAgICAgdmFyIG5jZWxscyA9IG5ld19jZWxscy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8bmNlbGxzOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IEp1cHl0ZXIubm90ZWJvb2suZ2V0X2NlbGwoaSk7XG4gICAgICAgICAgICAgICAgY2VsbC5mcm9tSlNPTihuZXdfY2VsbHNbaV0pO1xuICAgICAgICAgICAgICAgIGlmIChjZWxsLm1ldGFkYXRhLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmVsZW1lbnQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgICAgICAgICBjZWxsLmZvY3VzX2NlbGwoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gbG9hZF95bm90ZWJvb2s1KGRhdGEpIHtcbiAgICAgICAgICAgIHZhciBuZXdfY2VsbHMgPSBkYXRhLmNvbnRlbnQuY2VsbHM7XG4gICAgICAgICAgICB2YXIgbmNlbGxzID0gbmV3X2NlbGxzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxuY2VsbHM7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjZWxsID0gSnVweXRlci5ub3RlYm9vay5nZXRfY2VsbChpKTtcbiAgICAgICAgICAgICAgICBjZWxsLm1ldGFkYXRhID0gbmV3X2NlbGxzW2ldLm1ldGFkYXRhO1xuICAgICAgICAgICAgICAgIGlmIChuZXdfY2VsbHNbaV0ubWV0YWRhdGEuYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZWxlbWVudC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAgICAgICAgIGNlbGwuZm9jdXNfY2VsbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vZnVuY3Rpb24gY29udmVydF9ub3RlYm9vayhwYXRoKSB7XG4gICAgICAgIC8vICAgIHZhciBuY2VsbHMgPSBjb250ZW50LmNlbGxzLmxlbmd0aDtcbiAgICAgICAgLy8gICAgZm9yICh2YXIgaT0wOyBpPG5jZWxsczsgaSsrKSB7XG4gICAgICAgIC8vICAgICAgICBjb250ZW50LmNlbGxzW2ldLm1ldGFkYXRhWydpZCddID0gaTtcbiAgICAgICAgLy8gICAgfVxuICAgICAgICAvLyAgICBmb3IgKHZhciBpPW5jZWxsczsgaTwxMDA7IGkrKykge1xuICAgICAgICAvLyAgICAgICAgaWYgKGklMiA9PT0gMCkge1xuICAgICAgICAvLyAgICAgICAgICAgIHZhciBjZWxsID0geydjZWxsX3R5cGUnOiAnY29kZScsICdleGVjdXRpb25fY291bnQnOiAnJywgJ21ldGFkYXRhJzogeydpZCc6IGl9LCAnb3V0cHV0cyc6IFtdLCAnc291cmNlJzogW119XG4gICAgICAgIC8vICAgICAgICB9IGVsc2Uge1xuICAgICAgICAvLyAgICAgICAgICAgIHZhciBjZWxsID0geydjZWxsX3R5cGUnOiAnbWFya2Rvd24nLCAnZXhlY3V0aW9uX2NvdW50JzogJycsICdtZXRhZGF0YSc6IHsnaWQnOiBpfSwgJ291dHB1dHMnOiBbXSwgJ3NvdXJjZSc6IFtdfVxuICAgICAgICAvLyAgICAgICAgfVxuICAgICAgICAvLyAgICAgICAgY29udGVudC5jZWxscy5wdXNoKGNlbGwpO1xuICAgICAgICAvLyAgICB9XG4gICAgICAgIC8vICAgIGNvbnRlbnQubWV0YWRhdGFbJ3lub3RlYm9vayddID0gdHJ1ZTtcbiAgICAgICAgLy8gICAgY29uc29sZS5sb2coY29udGVudCk7XG4gICAgICAgIC8vICAgIHJldHVybiBjb250ZW50O1xuICAgICAgICAvL31cblxuICAgICAgICBpZiAod2luZG93LnNvY2tldHMgPT09IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMuZ2V0KEp1cHl0ZXIubm90ZWJvb2subm90ZWJvb2tfcGF0aCwge3R5cGU6ICdub3RlYm9vayd9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s0LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh3aW5kb3cuc29ja2V0cyA+IDApIHtcbiAgICAgICAgICAgIEp1cHl0ZXIubm90ZWJvb2suY29udGVudHMuZ2V0KEp1cHl0ZXIubm90ZWJvb2subm90ZWJvb2tfcGF0aCwge3R5cGU6ICdub3RlYm9vayd9KS50aGVuKFxuICAgICAgICAgICAgICAgICQucHJveHkobG9hZF95bm90ZWJvb2s1LCB0aGlzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9hZF95bm90ZWJvb2soKTtcbiJdfQ==

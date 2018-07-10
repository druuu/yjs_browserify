var Y = require('yjs');
window.Y = Y;
require('y-webrtc3')(Y);

var url = new URL(window.location.href);
var yid = url.searchParams.get("id");
var y = new Y(yid, {
    connector: {
        name: 'webrtc',
        room: yid,
        url: 'http://finplane.com:1256'
    }
});
window.y = y;

function start_ybindings() {
    if (typeof window.shared_elements_available !== 'undefined'
        && typeof Jupyter !== 'undefined'
        && typeof Jupyter.notebook !== 'undefined'
        && Jupyter.notebook._fully_loaded) {

        for (var id in shared_elements) {
            var codemirror = shared_elements[id]['codemirror'];
            var output = shared_elements[id]['output'];
            new Y.CodeMirrorBinding(y.define('codemirror'+id, Y.Text), codemirror);
            new Y.DomBinding(y.define('xml'+id, Y.XmlFragment), output);
        }
        
        window.get_inactive_cell = function(type) {
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
        
        window.get_cell = function (id) {
            var cells = Jupyter.notebook.get_cells();
            for (var i=0; i<cells.length; i++) {
                if (cells[i].element.find('.input_area').data('id') === id) {
                    return cells[i];
                }
            }
        }
        
        window.set_cell = function (id, index, active) {
            function set_element(element, index) {
                var to = $('#notebook-container');
                if (index === 0) {
                    to.prepend(element);
                } else {
                    to.children().eq(index-1).after(element);
                }
            }
        
            var cell = get_cell(parseInt(id));
            if (parseInt(id) !== parseInt(index)) {
                set_element(cell.element, index);
            }
            if (active === 'yes') {
                cell.element.find('.input_area').data('active', 'yes');
                cell.element.removeClass('hidden');
                cell.focus_cell();
            } else {
                cell.element.addClass('hidden');
                cell.set_text('');
                if (cell.cell_type === 'code') {
                    cell.output_area.clear_output();
                }
                cell.element.find('.input_area').data('active', 'no');
            }

            if (cell.cell_type === 'markdown') {
                cell.unrender();
                cell.render();
            }
        }

        window.resolve_ymap = true;
        var ymap = y.define('ymap', Y.Map);
        ymap.observe(function (e) {
            for (let key of e.keysChanged) {
                set_cell(key, ymap.get(key)['index'], ymap.get(key)['active']);
            }
        });
        if (window.resolve_ymap) {
            window.resolve_ymap = false;
            exec_ymap();
        }
        window.ymap = ymap;
        
        function exec_ymap() {
            if (typeof Jupyter !== 'undefined' && typeof Jupyter.notebook !== 'undefined') {
                var keys = ymap.keys();
                for (var index in keys) {
                    var id = keys[index];
                    set_cell(id, ymap.get(id)['index'], ymap.get(id)['active']);
                }
            } else {
                setTimeout(exec_ymap, 0);
            }
        }
    } else {
        setTimeout(start_ybindings, 0);
    }
}
start_ybindings();

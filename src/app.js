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
    if (typeof window.shared_elements_available !== 'undefined') {
        for (var id in shared_elements) {
            var codemirror = shared_elements[id]['codemirror'];
            var output = shared_elements[id]['output'];
            new Y.CodeMirrorBinding(y.define('codemirror'+id, Y.Text), codemirror);
            new Y.DomBinding(y.define('xml'+id, Y.XmlFragment), output);
        }
        
        window.resolve_ymap = true;
        var ymap = y.define('ymap', Y.Map);
        ymap.observe(function (e) {
            exec_ymap();
            if (window.resolve_ymap) {
                window.resolve_ymap = false;
                exec_ymap();
            }
        });
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
        
        window.get_inactive_cell = function (type) {
            var cells = Jupyter.notebook.get_cells();
            for (var i=0; i<cells.length; i++) {
                if (cells[i].cell_type === type && cells[i].metadata.active === false) {
                    return cells[i];
                }
            }
        }
        
        window.get_cell = function (id) {
            var cells = Jupyter.notebook.get_cells();
            for (var i=0; i<cells.length; i++) {
                if (cells[i].metadata.id === id) {
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
            set_element(cell.element, index);
            if (active) {
                cell.metadata.active = true;
                cell.element.removeClass('hidden');
                cell.focus_cell();
            } else {
                cell.element.addClass('hidden');
                cell.set_text('');
                if (cell.cell_type === 'code') {
                    cell.output_area.clear_output();
                }
                cell.metadata.active = false;
            }
        }
    } else {
        setTimeout(start_ybindings, 0);
    }
}
start_ybindings();

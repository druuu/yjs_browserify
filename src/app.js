var Y = require('yjs');
window.Y = Y;
require('y-webrtc3')(Y);

var Y2 = require('yjs2');
window.Y2 = Y2;
require('y-webrtc3')(Y2);

let y = new Y('ynotebook', {
    connector: {
        name: 'webrtc',
        room: 'dinesh',
        url: 'http://finwin.io:1256'
    }
});
window.y = y;

let y2 = new Y2('ynotebook2', {
    connector: {
        name: 'webrtc',
        room: 'dinesh2',
        url: 'http://finwin.io:1257'
    }
});
window.y2 = y2;

function load_ynotebook(y) {
    function load_ynotebook2(y) {
        if (typeof Jupyter !== 'undefined') {
            if (typeof Jupyter.notebook !== 'undefined') {
                load_ynotebook3(y);
            } else {
                setTimeout(load_ynotebook2, 0, y);
            }
        } else {
            setTimeout(load_ynotebook2, 0, y);
        }
    }

    function load_ynotebook3(y) {
        var ymap = y.define('ymap', Y.Map);
        Jupyter.notebook.y = y;
        Jupyter.notebook.ymap = ymap;
        ymap.observe(function (e) {
            console.log(e);
            for (let index of e.keysChanged) {
                let data = ymap.get(index);
                var cell = Jupyter.notebook.insert_cell_at_index(data.cell_data.cell_type, index);
                new Y.CodeMirrorBinding(y.define('ycodemirror'+data.id, Y.Text), cell.code_mirror);
                if (y.connector.sockets === 0) {
                    cell.fromJSON(data.cell_data);
                }
                if (data.cell_data.cell_type !== 'markdown') {
                    new Y.DomBinding(y.define('yxml'+data.id, Y.XmlFragment), cell.output_area.element[0]);
                }
                console.log(index);
            }
        });

        if (y.connector.sockets === 0) {
            Jupyter.notebook.is_first = true;
            Jupyter.notebook.load_notebook(Jupyter.notebook.notebook_path);
        } else {
            Jupyter.notebook.is_first = false;
            Jupyter.notebook.load_notebook(Jupyter.notebook.notebook_path);
        }
    }

    load_ynotebook2(y);
}

function load_ynotebook4(y) {
    if (y.connector.sockets >= 0) {
        load_ynotebook(y);
    } else {
        setTimeout(load_ynotebook4, 0, y);
    }
}

//load_ynotebook4(y);

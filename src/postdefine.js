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

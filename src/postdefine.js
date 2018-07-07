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

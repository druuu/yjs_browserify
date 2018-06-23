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
                $.extend(cell.metadata, new_cells[i].metadata);
                cell.metadata['active'] = true;
                cell.element.removeClass('hidden');
                cell.fromJSON(new_cells[i]);
            }
        }
        function load_ynotebook5(data) {
            var new_cells = data.content.cells;
            var ncells = new_cells.length;
            for (var i=0; i<ncells; i++) {
                var cell = Jupyter.notebook.get_cell(i);
                $.extend(cell.metadata, new_cells[i].metadata);
                cell.metadata['active'] = true;
                cell.element.removeClass('hidden');
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

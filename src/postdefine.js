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

        var url = new URL(window.location.href);
        url = url.searchParams.get('url');
        if (window.sockets === 0) {
            Jupyter.notebook.contents.remote_get(Jupyter.notebook.notebook_path, {type: 'notebook', url: url}).then(
                $.proxy(load_ynotebook4, this)
            );
        } 
    }
}

load_ynotebook();

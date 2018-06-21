CodeMirror = require('codemirror');

var total_cells = 100;
//var total_code_cells = 100;
//var total_markdown_cells = 100;
var cm_config = {
    "indentUnit":4,
    "readOnly":false,
    "theme":"ipython",
    "extraKeys":{
        "Cmd-Right":"goLineRight",
        "End":"goLineRight",
        "Cmd-Left":"goLineLeft",
        "Tab":"indentMore",
        "Shift-Tab":"indentLess",
        "Cmd-/":"toggleComment",
        "Ctrl-/":"toggleComment",
        "Backspace":"delSpaceToPrevTabStop"
    },
    "mode":{
        "name":"ipython",
        "version":3
    },
    "matchBrackets":true,
    "autoCloseBrackets":true
};

var cm_config2 = {
    "indentUnit": 4,
    "readOnly": false,
    "theme": "default",
    "extraKeys": {
        "Cmd-Right": "goLineRight",
        "End": "goLineRight",
        "Cmd-Left": "goLineLeft",
        "Tab": "indentMore",
        "Shift-Tab": "indentLess",
        "Cmd-/": "toggleComment",
        "Ctrl-/": "toggleComment"
    },
    "mode": "ipythongfm",
    "lineWrapping": true
};


window.shared_elements = {};
for (var i=0; i<total_cells; i++) {
    var output = document.createElement('div');
    var input_area = document.createElement('div');
    input_area.className = 'input_area';
    //var codemirror = CodeMirror(input_area, cm_config); 
    var codemirror = CodeMirror(input_area); 
    window.shared_elements[i] = {
        'output': output,
        'input_area': input_area,
        'codemirror': codemirror,
    };
}

window.shared_elements_available = true;

//for (var i=total_code_cells; i<total_code_cells+total_markdown_cells; i++) {
//    var input_area = document.createElement('div');
//    input_area.className = 'input_area';
//    var codemirror = CodeMirror(input_area, cm_config2); 
//    window.shared_elements[i] = {
//        'input_area': input_area,
//        'codemirror': codemirror
//    };
//}

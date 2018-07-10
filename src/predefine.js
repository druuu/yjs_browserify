CodeMirror = require('./codemirror.js');
CodeMirror.defineMode("ipython", function(conf, parserConf) {
    var pythonConf = {};
    for (var prop in parserConf) {
        if (parserConf.hasOwnProperty(prop)) {
            pythonConf[prop] = parserConf[prop];
        }
    }
    pythonConf.name = 'python';
    pythonConf.singleOperators = new RegExp("^[\\+\\-\\*/%&|@\\^~<>!\\?]");
    if (pythonConf.version === 3) {
        pythonConf.identifiers = new RegExp("^[_A-Za-z\u00A1-\uFFFF][_A-Za-z0-9\u00A1-\uFFFF]*");
    } else if (pythonConf.version === 2) {
        pythonConf.identifiers = new RegExp("^[_A-Za-z][_A-Za-z0-9]*");
    }
    return CodeMirror.getMode(conf, pythonConf);
}, 'python');

CodeMirror.defineMIME("text/x-ipython", "ipython");

var url = new URL(window.location.href);
var total_cells = url.searchParams.get('total_cells') || 150;
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

window.shared_elements = {};
for (var i=0; i<total_cells; i++) {
    var output = document.createElement('div');
    var input_area = document.createElement('div');
    input_area.setAttribute('data-id', i);
    input_area.setAttribute('data-active', 'no');
    input_area.className = 'input_area';
    //var codemirror = CodeMirror(input_area, cm_config); 
    var codemirror = new CodeMirror(input_area, cm_config); 
    window.shared_elements[i] = {
        'output': output,
        'input_area': input_area,
        'codemirror': codemirror,
    };
}

window.shared_elements_available = true;

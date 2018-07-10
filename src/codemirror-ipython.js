define('./codemirror.js', function(CodeMirror) {
    console.log(CodeMirror);
    console.log('111111');
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

    console.log(CodeMirror);
    console.log('2222222');
    return CodeMirror;
})

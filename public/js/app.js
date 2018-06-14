(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
let y = new Y('htmleditor', {
  connector: {
    name: 'webrtc',
    room: 'dinesh',
    url: 'http://finwin.io:1256'
  }
});

new Y.DomBinding(y.define('xml', Y.XmlFragment), window.shared_elements['xml']);
new Y.DomBinding(y.define('xml2', Y.XmlFragment), window.shared_elements['xml2']);
new Y.DomBinding(y.define('xml3', Y.XmlFragment), window.shared_elements['xml3']);
new Y.DomBinding(y.define('xml4', Y.XmlFragment), window.shared_elements['xml4']);
new Y.DomBinding(y.define('xml5', Y.XmlFragment), window.shared_elements['xml5']);
new Y.DomBinding(y.define('xml6', Y.XmlFragment), window.shared_elements['xml6']);
new Y.DomBinding(y.define('xml7', Y.XmlFragment), window.shared_elements['xml7']);
new Y.DomBinding(y.define('xml8', Y.XmlFragment), window.shared_elements['xml8']);
new Y.DomBinding(y.define('xml9', Y.XmlFragment), window.shared_elements['xml9']);
new Y.DomBinding(y.define('xml10', Y.XmlFragment), window.shared_elements['xml10']);

new Y.CodeMirrorBinding(y.define('codemirror', Y.Text), window.shared_elements['codemirror']);
new Y.CodeMirrorBinding(y.define('codemirror2', Y.Text), window.shared_elements['codemirror2']);
new Y.CodeMirrorBinding(y.define('codemirror3', Y.Text), window.shared_elements['codemirror3']);
new Y.CodeMirrorBinding(y.define('codemirror4', Y.Text), window.shared_elements['codemirror4']);
new Y.CodeMirrorBinding(y.define('codemirror5', Y.Text), window.shared_elements['codemirror5']);
new Y.CodeMirrorBinding(y.define('codemirror6', Y.Text), window.shared_elements['codemirror6']);
new Y.CodeMirrorBinding(y.define('codemirror7', Y.Text), window.shared_elements['codemirror7']);
new Y.CodeMirrorBinding(y.define('codemirror8', Y.Text), window.shared_elements['codemirror8']);
new Y.CodeMirrorBinding(y.define('codemirror9', Y.Text), window.shared_elements['codemirror9']);
new Y.CodeMirrorBinding(y.define('codemirror10', Y.Text), window.shared_elements['codemirror10']);

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwibGV0IHkgPSBuZXcgWSgnaHRtbGVkaXRvcicsIHtcbiAgY29ubmVjdG9yOiB7XG4gICAgbmFtZTogJ3dlYnJ0YycsXG4gICAgcm9vbTogJ2RpbmVzaCcsXG4gICAgdXJsOiAnaHR0cDovL2Zpbndpbi5pbzoxMjU2J1xuICB9XG59KTtcblxubmV3IFkuRG9tQmluZGluZyh5LmRlZmluZSgneG1sJywgWS5YbWxGcmFnbWVudCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbCddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDInLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sMiddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDMnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sMyddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDQnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNCddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDUnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNSddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDYnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNiddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDcnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sNyddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDgnLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sOCddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDknLCBZLlhtbEZyYWdtZW50KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1sneG1sOSddKTtcbm5ldyBZLkRvbUJpbmRpbmcoeS5kZWZpbmUoJ3htbDEwJywgWS5YbWxGcmFnbWVudCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ3htbDEwJ10pO1xuXG5uZXcgWS5Db2RlTWlycm9yQmluZGluZyh5LmRlZmluZSgnY29kZW1pcnJvcicsIFkuVGV4dCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3InXSk7XG5uZXcgWS5Db2RlTWlycm9yQmluZGluZyh5LmRlZmluZSgnY29kZW1pcnJvcjInLCBZLlRleHQpLCB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yMiddKTtcbm5ldyBZLkNvZGVNaXJyb3JCaW5kaW5nKHkuZGVmaW5lKCdjb2RlbWlycm9yMycsIFkuVGV4dCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3IzJ10pO1xubmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3I0JywgWS5UZXh0KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjQnXSk7XG5uZXcgWS5Db2RlTWlycm9yQmluZGluZyh5LmRlZmluZSgnY29kZW1pcnJvcjUnLCBZLlRleHQpLCB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yNSddKTtcbm5ldyBZLkNvZGVNaXJyb3JCaW5kaW5nKHkuZGVmaW5lKCdjb2RlbWlycm9yNicsIFkuVGV4dCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I2J10pO1xubmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3I3JywgWS5UZXh0KSwgd2luZG93LnNoYXJlZF9lbGVtZW50c1snY29kZW1pcnJvcjcnXSk7XG5uZXcgWS5Db2RlTWlycm9yQmluZGluZyh5LmRlZmluZSgnY29kZW1pcnJvcjgnLCBZLlRleHQpLCB3aW5kb3cuc2hhcmVkX2VsZW1lbnRzWydjb2RlbWlycm9yOCddKTtcbm5ldyBZLkNvZGVNaXJyb3JCaW5kaW5nKHkuZGVmaW5lKCdjb2RlbWlycm9yOScsIFkuVGV4dCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3I5J10pO1xubmV3IFkuQ29kZU1pcnJvckJpbmRpbmcoeS5kZWZpbmUoJ2NvZGVtaXJyb3IxMCcsIFkuVGV4dCksIHdpbmRvdy5zaGFyZWRfZWxlbWVudHNbJ2NvZGVtaXJyb3IxMCddKTtcbiJdfQ==

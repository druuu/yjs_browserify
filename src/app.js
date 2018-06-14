let y = new Y('htmleditor', {
  connector: {
    name: 'webrtc',
    //name: 'websockets-client',
    room: 'dinesh',
    url: 'http://finwin.io:1256'
  },
  share: {
    codemirror: 'Text',
    codemirror2: 'Text',
    codemirror3: 'Text',
    codemirror4: 'Text',
    codemirror5: 'Text',
    codemirror6: 'Text',
    codemirror7: 'Text',
    codemirror8: 'Text',
    codemirror9: 'Text',
    codemirror10: 'Text',
    xml: 'Xml',
    xml2: 'Xml',
    xml3: 'Xml',
    xml4: 'Xml',
    xml5: 'Xml',
    xml6: 'Xml',
    xml7: 'Xml',
    xml8: 'Xml',
    xml9: 'Xml',
    xml10: 'Xml'
  }
});

window.y = y;

var xml = y.define('xml', Y.XmlFragment);
new Y.DomBinding(xml, window.shared_elements['xml']);

var xml2 = y.define('xml', Y.XmlFragment);
new Y.DomBinding(xml2, window.shared_elements['xml2']);


var codemirror = y.define('text');
new Y.DomBinding(codemirror, window.shared_elements['codemirror']);

var codemirror2 = y.define('text');
new Y.DomBinding(codemirror2, window.shared_elements['codemirror2']);
//
console.log('############');
//window.yXml = y;
//y.share.codemirror.bind(window.shared_elements['codemirror']);
//y.share.codemirror2.bind(window.shared_elements['codemirror2']);
//y.share.codemirror3.bind(window.shared_elements['codemirror3']);
//y.share.codemirror4.bind(window.shared_elements['codemirror4']);
//y.share.codemirror5.bind(window.shared_elements['codemirror5']);
//y.share.codemirror6.bind(window.shared_elements['codemirror6']);
//y.share.codemirror7.bind(window.shared_elements['codemirror7']);
//y.share.codemirror8.bind(window.shared_elements['codemirror8']);
//y.share.codemirror9.bind(window.shared_elements['codemirror9']);
//y.share.codemirror10.bind(window.shared_elements['codemirror10']);
//y.share.xml._bindToDom(window.shared_elements['xml']);
//y.share.xml2._bindToDom(window.shared_elements['xml2']);
//y.share.xml3._bindToDom(window.shared_elements['xml3']);
//y.share.xml4._bindToDom(window.shared_elements['xml4']);
//y.share.xml5._bindToDom(window.shared_elements['xml5']);
//y.share.xml6._bindToDom(window.shared_elements['xml6']);
//y.share.xml7._bindToDom(window.shared_elements['xml7']);
//y.share.xml8._bindToDom(window.shared_elements['xml8']);
//y.share.xml9._bindToDom(window.shared_elements['xml9']);
//y.share.xml10._bindToDom(window.shared_elements['xml10']);


//window.undoManager = new Y.utils.UndoManager(window.yXmlType, {
//  captureTimeout: 500
//})
//
//document.onkeydown = function interceptUndoRedo (e) {
//  if (e.keyCode === 90 && (e.metaKey || e.ctrlKey)) {
//    if (!e.shiftKey) {
//      window.undoManager.undo()
//    } else {
//      window.undoManager.redo()
//    }
//    e.preventDefault()
//  }
//}

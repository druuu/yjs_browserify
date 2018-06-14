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

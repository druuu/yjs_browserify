const Y = require('yjs');
require('y-memory')(Y);
require('y-webrtc')(Y);
require('y-array')(Y);
require('y-map')(Y);
require('y-text')(Y);
require('y-xml')(Y);

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'webrtc',
    room: 'rfmp',
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
}).then(function (y) {
    console.log('############');
    window.yXml = y;
    y.share.codemirror.bind(window.shared_elements['codemirror']);
    y.share.codemirror2.bind(window.shared_elements['codemirror2']);
    y.share.codemirror3.bind(window.shared_elements['codemirror3']);
    y.share.codemirror4.bind(window.shared_elements['codemirror4']);
    y.share.codemirror5.bind(window.shared_elements['codemirror5']);
    y.share.codemirror6.bind(window.shared_elements['codemirror6']);
    y.share.codemirror7.bind(window.shared_elements['codemirror7']);
    y.share.codemirror8.bind(window.shared_elements['codemirror8']);
    y.share.codemirror9.bind(window.shared_elements['codemirror9']);
    y.share.codemirror10.bind(window.shared_elements['codemirror10']);
    y.share.xml._bindToDom(window.shared_elements['xml']);
    y.share.xml2._bindToDom(window.shared_elements['xml2']);
    y.share.xml3._bindToDom(window.shared_elements['xml3']);
    y.share.xml4._bindToDom(window.shared_elements['xml4']);
    y.share.xml5._bindToDom(window.shared_elements['xml5']);
    y.share.xml6._bindToDom(window.shared_elements['xml6']);
    y.share.xml7._bindToDom(window.shared_elements['xml7']);
    y.share.xml8._bindToDom(window.shared_elements['xml8']);
    y.share.xml9._bindToDom(window.shared_elements['xml9']);
    y.share.xml10._bindToDom(window.shared_elements['xml10']);
})

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
    xml: 'Xml("div")'
  }
}).then(function (y) {
    console.log('############');
    window.yXml = y;
    // bind xml type to a dom, and put it in body
    //console.log(y.share.xml);
    //y.share.xml.bindToDom(document.querySelector('.example'));
    window.sharedDom = y.share.xml.getDom();
    //document.body.appendChild(window.sharedDom);
    //map.set('myOtherXmlType', y.XmlElement());
})

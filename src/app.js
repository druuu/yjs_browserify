const IPFS = require('ipfs');
const d3 = require('d3');

const ipfs = new IPFS({
  repo:repo(),
  EXPERIMENTAL:{
    pubsub:true
  }
});

const Y = require('yjs');
require('y-memory')(Y);
require('y-array')(Y);
require('y-map')(Y);
require('y-text')(Y);
require('y-xml')(Y);
require('y-ipfs-connector')(Y);

ipfs.once('ready', ()=> ipfs.id((err,info) =>{
  if (err) throw err;

  console.log('IPFS ready', info.id)

  Y({
    db: {
      name: 'memory'
    },
    connector: {
      name: 'ipfs',
      room: 'collab',
      ipfs:ipfs
    },
    share: {
      drawing: 'Array'
    }
  }).then(function (y) {
    window.yDrawing = y
    var drawing = y.share.drawing
    var renderPath = d3.svg.line()
      .x(function (d) { return d[0] })
      .y(function (d) { return d[1] })
      .interpolate('basis')

    var svg = d3.select('#drawingCanvas')
      .call(d3.behavior.drag()
        .on('dragstart', dragstart)
        .on('drag', drag)
        .on('dragend', dragend))

    // create line from a shared array object and update the line when the array changes
    function drawLine (yarray) {
      var line = svg.append('path').datum(yarray.toArray())
      line.attr('d', renderPath)
      yarray.observe(function (event) {
        // implement insert events that are appended to the end of the array
        event.values.forEach(function (value) {
          line.datum().push(value)
        })
        line.attr('d', renderPath)
      })
    }
    // call every time array is appended
    y.share.drawing.observe(function (event) {
      if (event.type === 'insert') {
        event.values.forEach(drawLine)
      } else {
        // remove all elements
        svg.selectAll('path').remove()
      }
    })
    // draw all existing content
    for (var i = 0; i < drawing.length; i++) {
      drawLine(drawing.get(i))
    }

    // clear canvas on click
    document.querySelector('#clearCanvas').onclick = function () {
      drawing.delete(0, drawing.length)
    }

    var sharedLine = null
    function dragstart () {
      drawing.insert(drawing.length, [Y.Array])
      sharedLine = drawing.get(drawing.length - 1)
    }

    // we ignore drag for 33ms before next drag.
    var ignoreDrag = null
    function drag () {
      if (sharedLine != null && ignoreDrag == null) {
        ignoreDrag = window.setTimeout(function () {
          ignoreDrag = null
        }, 33)
        sharedLine.push([d3.mouse(this)])
      }
    }

    function dragend () {
      sharedLine = null
      window.clearTimeout(ignoreDrag)
      ignoreDrag = null
    }
  })
}));

function repo(){
  return 'ipfs/collab/'+ Math.random()
}

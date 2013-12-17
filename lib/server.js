var path       = require('path')
  , http       = require('http')
  , shoe       = require('shoe')
  , fs         = require('fs')
  , formidable = require('formidable')
  , st         = require('st')
  , staticPath = path.join(__dirname, '../static')


function PSVGServer( file ) {
  if (!(this instanceof PSVGServer)) return new PSVGServer(file)
  this.file = file

  // static resources
  this.mount = st({
      path  : staticPath
    , url   : '/'
    , cache : false
    , passthrough : false
  })

  this.server = http.createServer(function (req, res) {
    this.handler(req, res)
  }.bind(this))
}

PSVGServer.prototype = { 

  listen : function () {
    var sock

    this.server.listen.apply(this.server, arguments)

    if (!this.watching)
      return

    sock = shoe(function (stream) {
      var opts = { persistent: true, interval: 100 }
      fs.watchFile(this.file, opts, function () {
        fs.readFile(this.file, function (err, data) {
          brucedown(data, function (err, content) {
            stream.write(JSON.stringify({ content: content }))
          })
        })
      }.bind(this))

      stream.on('end', function () {
        fs.unwatchFile(this.file)
      }.bind(this))

    }.bind(this))

    sock.install(this.server, '/output')
  },

  handle_index : function(req, res) {
    var that = this
    fs.readFile(path.join(staticPath, 'index.html'), 'utf8', function (err, index) {      
      res.writeHead(200, {
          'Content-Type': 'text/html'
        , 'Cache-Control': 'no-cache'
      })
      index = index
        .replace('{file}', that.file)
      res.end(index)
    })
  },

  handle_file : function(req, res) {
    fs.readFile(path.join(this.file), 'utf8', function (err, fileContents) {
      res.writeHead(200, {
          'Content-Type': 'text/xml'
        , 'Cache-Control': 'no-cache'
      })
      res.end(fileContents)
    });
  },

  handle_save : function(req, res) {
    that = this
    var form = new formidable.IncomingForm()
    form.parse(req, function(err, fields, files) {
      fs.writeFile( fields.filename, fields.code, function(err) {
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end( err.message || err )
        } else {
          that.file = fields.filename
          res.writeHead(302, { 'Location': '/' })
          res.end()
        }
      })
    })
  },

  handler : function(req, res) {
    if ( req.url == '/' )
      return this.handle_index(req, res)
    if ( req.url == '/file' )
      return this.handle_file(req, res)
    if ( req.url == '/save' )
      return this.handle_save(req, res)
    this.mount(req, res)
  }

}

module.exports = PSVGServer
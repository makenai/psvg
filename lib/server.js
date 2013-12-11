var path       = require('path')
  , http       = require('http')
  , shoe       = require('shoe')
  , st         = require('st')
  , staticPath = path.join(__dirname, '../static')


function PSVGServer( file ) {
  if (!(this instanceof PSVGServer)) return new PSVGServer(file)
  this.file  = file

  // static resources
  this.mount = st({
      path  : staticPath
    , index : 'index.html'
    , url   : '/'
    , cache : false
    , passthrough : false
  })

  this.server = http.createServer(function (req, res) {
    this.handler(req, res)
  }.bind(this))
}

PSVGServer.prototype.listen = function () {
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
}

PSVGServer.prototype.handler = function(req, res) {
  this.mount(req, res)
}

module.exports = PSVGServer
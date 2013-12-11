#!/usr/bin/env node

var me     = require('..')
  , spawn  = require('child_process').spawn
  , os     = require('os')
  , fs     = require('fs')
  , path   = require('path')
  , argv   = require('optimist').argv
  , file   = argv._[0]
  , port   = 2000 + Math.round(Math.random() * 5000)

  , bin    = 'google-chrome'
  , args   = [
        '--app=http://localhost:' + port
      , '--disk-cache-size 0'
      , '--no-proxy-server'
      , '--app-window-size=1024,540'
    ]

if (file && fs.existsSync(file) && !fs.statSync(file).isFile()) {
  console.error('File [' + file + '] is not a regular file')
  file = null
}

if (file && !fs.existsSync(file))
  fs.writeFileSync(file, '', 'utf8')

if (!file) {
  console.error('Usage: psvg <path to file.psvg>')
  process.exit(-1)
}

me(file).listen(port)

if (os.platform() == 'darwin') {
  if (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
    bin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if(fs.existsSync('/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary')) {
      bin = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
  } else {
    throw('chrome or canary were not found');
  }
}

if (process.env.HOME)
  args.push('--user-data-dir=' + path.join(process.env.HOME, '.md'))

spawn(bin, args)
  .on('exit', process.exit.bind(process, 0))
  .stderr.pipe(process.stderr)
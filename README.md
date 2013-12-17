#psvg

***Parametric SVG template creator and interpreter.***

[![NPM](https://nodei.co/npm/psvg.png?compact=true)](https://nodei.co/npm/psvg/)

psvg is a parametric SVG editor that lets you parameterize SVG files and swap out with user selectable values and calculations in a way that is similar to [OpenSCAD](http://www.openscad.org/) but more interoperable with the 2d file formats used with laser cutters and CNC mills.

The original parametric-SVG-editor was written in 2011 by Harmen G. Zijp and Peter Uithoven. This is my attempt to modenize the code, make it a convenient client side application like [Morkdown](https://github.com/rvagg/morkdown), fix some bugs and add some new featues.

![PSVG](http://makenai.net.s3.amazonaws.com/github/psvg.png)

## Installing & Using

You'll need Google Chrome installed to use this.

`npm install psvg -g`

Once installed, you can run:

`psvg <path to file.svg or file.psvg>`

## Contributors

  * [Pawel Szymczykowski](http://makenai.net)
  * [Harmen G. Zijp](http://www.giplt.nl/)
  * [Peter Uithoven](http://www.peteruithoven.nl)

Additionally, much of the client wrapper code was borrowed from [Morkdown](https://github.com/rvagg/morkdown)

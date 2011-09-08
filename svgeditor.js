// parametric SVG editor
// by Harmen G. Zijp (2011)
// distributed under the Simple Public License: http://www.opensource.org/licenses/simpl-2.0
// code available at git.giplt.nl
//
// TODO
// check cross browser behaviour
// add tools (rotate, scale, translate) & guides (rulers, axes, crossmark)
// autocombine milling paths
// mill optional parameter symmetricA, symmetricB, asymmetric
// joint variable string of extension parameters for polyline element
// check use of official SVG param(x)
// validate code on the fly
// svg load/insert preview

var code; // parametric svg code (xml) //used for code fields
var svg; //  concrete svg code? (used for preview) (xml)
var index; // object with all parametric svg objects, listed by their id (xml)
var selected; // id of selected. For example: "smiley,eyes,lefteye"
var drag;
var dragnode; // concrete svg node that is draged (set during p2c, thus buildsvg)
var offset = null;
var translate;
var viewbox;
var extraData = []; // array with extra data per object, content: {collapsed,hasChildren}
var ieV;
var psvgE = ".psvg"; // parametric svg file extension
var svgE = ".svg"; // svg file extension
var selectionPSVG; // svg node that shows selection (that's put into code)

const RESULT_STATE_SVG = "svg";
const RESULT_STATE_HELP = "help";
const RESULT_STATE_EXPORT = "export";
const RESULT_STATE_LOAD = "load";
const RESULT_STATE_SAVE = "save";
var resultState = RESULT_STATE_SVG; 

var selectedCode = ""; // selected code from code textarea
var storedCode = ""; // code stored for the memory button
var codeCursorPos = -1; // cursor position in code edit field
var keepCodeCursorPos = false; // boolean that prevents alterations to codeCursorPos

// we store the following seperatly since we need to overrulde them to display the svg properly in the editor
var units;
var docWidth;
var docHeight;


function init(demo) {
	//console.group("init");
	ieV = getInternetExplorerVersion();
	if(ieV > -1)
	{
		var ieError = document.getElementById('ieerror');
		ieError.style.display = "block";
		ieError.innerHTML = ieError.innerHTML.replace("{version}",ieV);
	}
	if(ieV == -1 || ieV >= 9.0)
	{
		// setup example code, build index and setup svg image
		code = loadxml(demo ? '<svg width="210mm" height="297mm" transform=""><defs><ref param="size" default="100"/><ref param="dist" default="0.4*size"/><ref param="mood" default="0"/><ref param="x" default="105"/></defs><title>smiley</title><desc>example code for parametric SVG editor</desc><rect x="0" y="0" width="210" height="297" style="fill:none;stroke:#87cccc;"/>\n\n<circle cx="{x}" cy="105" r="{size}" style="fill:yellow;stroke:black;stroke-width:3"/><g transform="translate({x} 95)"><title>eyes</title><circle cx="{-dist}" cy="0" r="{size/10}" style="fill:black; stroke:black;"/>\n\n<circle cx="{dist}" cy="0" r="{size/10}" style="fill:black; stroke:black;"/></g><g transform="translate({x} 105)"><title>mouth</title><path d="M{-size/2},{+size/2} a 2 1 0 0 {mood} {size},0" style="fill:none;stroke:black;stroke-width:3"/></g></svg>' : '<svg width="210mm" height="297mm" transform=""><defs></defs><title>new project</title><desc></desc></svg>');
		buildindex();
		setupsvg();
		createSelectionSVG();
		select('project');
		
		//console.log("code: ",code);
		//var codeStr = getNodeXML(code)
		//console.log("codeStr: ",codeStr);
	}
	//console.groupEnd();
}

function buildindex() 
{	
	//if(//console) console.log("buildindex");
	index = addToIndex(code.documentElement, new Array());
	document.getElementById('title').innerHTML = getNodeTitle(code.documentElement);
	document.getElementById('index_title').innerHTML = 'index';
	var html = '<div class="indexItem" id="project" onclick="select(\'project\');">project settings</div>';
	html += '<div class="indexItem" id="parameters" onclick="select(\'parameters\');">&#160;&#160;parameters</div>';
	html += '<hr/>';
	for (var id in index) 
	{
		var itemExtraData = getExtraData(id);
		var indent = new Array(id.split(',').length).join('&#160;&#160;');
		var collapseIcon = "&nbsp;&nbsp;";
		if(itemExtraData.hasChildren) collapseIcon = (itemExtraData.collapsed)? "+&nbsp;" : "-&nbsp;";
		var name = id.substr(id.lastIndexOf(',')+1);
		
		var classes = "indexItem";
		classes += (selected == id)? ' selected' : '';
		html += '<div class="'+classes+'" id="' + id + '" onclick="clickedIndexItem(\'' + id + '\');">' + indent + collapseIcon + name + '</div>'
	}
	document.getElementById('index').innerHTML = html;
}
function clickedIndexItem(id)
{
	//if(//console) console.log("clickedIndexItem, id: ",id, "was selected: ",(selected == id));
	if(selected == id)
	{	
		var selectedExtraData = getExtraData(id);
		selectedExtraData.collapsed = !selectedExtraData.collapsed;
		buildindex();
	}
	else
	{
		select(id);
	}
	//console.groupEnd();
}

function addToIndex(node, index) {
	var id = getId(node);
	index[id] = node;
	var itemExtraData = getExtraData(id);
	if(!itemExtraData.collapsed)
	{
		itemExtraData.hasChildren = false;
		for (var i=0;i<node.childNodes.length;i++)
		{
			if (node.childNodes[i].tagName=='g') 
		  	{
		  		index = addToIndex(node.childNodes[i], index);
		  		itemExtraData.hasChildren = true;
		  	}
		}
	}
	return index;
}

// generates nested id. For example: "smiley,eyes,lefteye"
function getId(node) {
	var id = getNodeTitle(node);
	var parent = node.parentNode;
	while (parent!=node.ownerDocument) {
		id = getNodeTitle(parent) + ',' + id;
		parent = parent.parentNode;
	}
	return node == node.ownerDocument.documentElement ? 'root element' : id;
}

function setupsvg() {
	//console.group("setupsvg");
	// create svg object
	svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	//svg = document.createElement('svg');
	
	svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
	svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	
	// store original values
	docWidth = parseFloat(code.documentElement.getAttribute('width'));
	docHeight = parseFloat(code.documentElement.getAttribute('height'));
	units = code.documentElement.getAttribute('width').replace(/[0-9 ]*/ig,"");
	
	//console.log("docWidth: ",docWidth);
	//console.log("docHeight: ",docHeight);
	//console.log("units: ",units);
	var size = Math.max(docWidth, docHeight);
	//console.log("maxsize: ",size);
	//var size = "400";
	//svg.setAttribute('viewBox', '100px 100px 400px 400px');
	//svg.setAttribute('viewBox', '50px 50px 20px 20px');
	//svg.setAttribute('viewBox', '0 0 ' + size + units + ' ' + size + units);
	//svg.setAttribute('viewBox', '0mm 0mm 50mm 50mm');
	//svg.setAttribute('viewBox', '0 0 50 50');
	//svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
	//svg.setAttribute('width', size + units);
	//svg.setAttribute('height', size + units);
	
	svg.setAttribute('width','400px');
	svg.setAttribute('height','400px');
	//svg.setAttribute('viewBox', '0 0 400 400');
	svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
	//svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
	svg.setAttribute('preserveAspectRatio', 'xMinYMin');
	svg.setAttribute('style', 'cursor:pointer;');
	
	// setup routines for dragging image (parts)
	svg.onmousedown = function(e) {
		//console.group("onmousedown");
		drag = true;
		if (selected.indexOf(',')!=-1) {
			//console.log("selected.indexOf(',')!=-1");
			//console.log("dragnode: ",dragnode);
			update('transform');
			//console.log("dragnode: ",dragnode);
			translate = getTranslate(index[selected]);
			//console.log("dragnode: ",dragnode);
		}
		else 
		{	
			//console.log("else");
			dragnode = svg;
		}
		//console.log("dragnode: ",dragnode);
		//console.log("svg: ",svg);
		
		offset = mouseCoords(e);
		viewbox = getViewbox(svg);
		//console.groupEnd();
		return false;
	}
	svg.onmouseup = function(e) {
		drag = false;
	}
	svg.onmousemove = function(e){
		if(drag) 
		{
			e = e || window.event;
			var pos = mouseCoords(e);
			var dx = (pos.x - offset.x) * viewbox.w/document.getElementById('result').offsetWidth;
			var dy = (pos.y - offset.y) * viewbox.h/document.getElementById('result').offsetHeight;
			
			//console.log("dragnode: ",dragnode);
			
			if (dragnode==svg) 
			{
				var vx = (viewbox.x - dx).toPrecision(3);
				var vy = (viewbox.y - dy).toPrecision(3);
				var vw = viewbox.w;
				var vh = viewbox.h;
				svg.setAttribute('viewBox', vx + ' ' + vy + ' ' + vw + ' ' + vh);
				document.getElementById('viewbox').innerHTML = svg.getAttribute('viewBox');
			}
			else 
			{
				//console.log("else");
				dx = (translate.x + dx).toPrecision(3);
				dy = (translate.y + dy).toPrecision(3);
				
				transform = document.getElementById('edittransform').value.replace(/translate\(.*?\)/, 'translate(' + (translate.px!=''?'{'+translate.px+'}':'') + (dx<0?'':'+') + dx + ' ' + (translate.py!=''?'{'+translate.py+'}':'') + (dy<0?'':'+') + dy + ')');
				index[selected].setAttribute('transform', transform);
				document.getElementById('edittransform').value = transform;
				
				transform = document.getElementById('edittransform').value.replace(/translate\(.*?\)/, 'translate({' + translate.px + (dx<0?'':'+') + dx + '} {' + translate.py + (dy<0?'':'+') + dy + '})');
				transform = transform.replace(/({.*?})/g, function(match) { return eval(match); } );
				dragnode.setAttribute('transform', transform);
			}
			return false;
		}
	}
	//console.groupEnd();
}

function getViewbox(e) 
{
	viewbox = e.getAttribute('viewBox').split(" ");
	var obj = { x: parseInt(viewbox[0]), y: parseInt(viewbox[1]), w: parseInt(viewbox[2]), h: parseInt(viewbox[3]) };
	return obj
}

function mouseCoords(e) {
	if(e.pageX || e.pageY) {
		return { x:e.pageX, y:e.pageY };
	}
	return {
		x:e.clientX + document.body.scrollLeft - document.body.clientLeft,
		y:e.clientY + document.body.scrollTop  - document.body.clientTop
	};
}

function zoom(type) {
	//console.group("zoom");
	//console.log("type: ",type);
	viewbox = getViewbox(svg);
	//console.log("viewbox: ",viewbox);
	var vx, vy, vw, vh;
	switch(type) {
		case -1: 
			vx = (viewbox.x - 0.1*viewbox.w/2).toPrecision(3);
			vy = (viewbox.y - 0.1*viewbox.h/2).toPrecision(3);
			vw = (viewbox.w*1.1).toPrecision(3);
			vh = (viewbox.h*1.1).toPrecision(3);
			break;
		case 0:
			var size = Math.max(parseFloat(code.documentElement.getAttribute('width')), parseFloat(code.documentElement.getAttribute('height')));
			//console.log("width: ",code.documentElement.getAttribute('width'));
			vx = 0;
			vy = 0;
			vw = size;
			vh = size;
			break;
		case 1: 
			vx = (viewbox.x + 0.1*viewbox.w/2).toPrecision(3);
			vy = (viewbox.y + 0.1*viewbox.h/2).toPrecision(3);
			vw = (viewbox.w/1.1).toPrecision(3);
			vh = (viewbox.h/1.1).toPrecision(3);
			break;
	}
	svg.setAttribute('viewBox',vx+' '+vy+' '+vw+' '+vh); 
	document.getElementById('viewbox').innerHTML = svg.getAttribute('viewBox');
	//console.groupEnd();
}

function select(id) {
	//console.group("select");
	//if(//console) console.log("select, id: "+id);
	var html = '';
	var menu = '';
	switch(id) {
		case 'project':
			document.getElementById('edit_title').innerHTML = 'project settings';
			html+= '<h3>title</h3><br/><input id="edittitle" type="text" class="text" value="' + getNodeTitle(code.documentElement) + '" onblur="update(\'title\');" /><br/>';
			html+= '<h3>description</h3><br/><textarea id="editdesc" onblur="update(\'description\');">' + getDescription(code.documentElement) + '</textarea><br/>';
			
			var doc = code.documentElement;
			var width = doc.getAttribute('width').replace(/[a-z ]*/ig,"");
			var height = doc.getAttribute('height').replace(/[a-z ]*/ig,"");
			//var units = doc.getAttribute('width').replace(/[0-9 ]*/ig,"");
			
			//console.log("width: ",width);
			//console.log("height: ",height);
			//console.log("units: ",units);
			html+= '<h3>document size (width &#215; height)</h3><br/><input id="editwidth" type="text" class="text" value="' + width + '" onblur="update(\'width\');" /> &#215;<input id="editheight" type="text" class="text" value="' + height + '" onblur="update(\'height\');" /><select id="units" onblur="update(\'units\');"><option>em</option><option>ex</option><option>px</option><option>pt</option><option>pc</option><option>cm</option><option>mm</option><option>in</option></select>';
			
			menu = '<input type="button" class="button" value="new" onclick="init();" title="new project" />';
			menu+= '<input type="button" class="button" value="load" onclick="gotoLoad();" title="load code" />';
			menu+= '<input type="button" class="button" value="save" onclick="gotoSave();" title="save code" />';
			document.getElementById('edit').innerHTML = html;
			document.getElementById('edit_menu').innerHTML = menu;
			document.getElementById('index_menu').innerHTML = '';
			
			var unitsSelect = document.getElementById('units');
			var options = unitsSelect.options;
			for(var i=0;i<options.length;i++)
			{
				if(options[i].value == units)
				{
					unitsSelect.selectedIndex = i;
				}
			}
			
			break;
		case 'parameters':
			var params = '';
			var defs = code.getElementsByTagName('defs')[0];
			if (defs) for(var i=0; i<defs.childNodes.length; i++) if(defs.childNodes[i].tagName == 'ref') params+= defs.childNodes[i].getAttribute('param') + '=' + defs.childNodes[i].getAttribute('default') + '\n';
			document.getElementById('edit_title').innerHTML = 'parameters';
			html+= '<textarea id="params" class="code" onfocus="disableRenderButton(false);" onblur="update(\'params\');">' + params +'</textarea>'
			document.getElementById('edit').innerHTML = html;
			document.getElementById('edit_menu').innerHTML = '';
			document.getElementById('index_menu').innerHTML = '';
			break;
		default:
			node = index[id];
			document.getElementById('edit_title').innerHTML = "code";
			
			codeCursorPos = -1;
			//console.log("codeCursorPos: ",codeCursorPos);
			
			html+= '<h3 class="codeTitle">'+getNodeTitle(node)+'</h3><textarea id="editcode" class="code" onfocus="disableRenderButton(false);" onblur="update(\'code\');" onselect="onCodeSelect(this)" onmousedown="onCodeMouseDown(this)">' + getCode(node) + '</textarea><br/>';
			if (node!=code.documentElement) html+= '<h3>transform</h3><br/><input id="edittransform" class="code text" type="text" value="' + node.getAttribute('transform') + '" onfocus="disableRenderButton(false);" onblur="update(\'transform\');" />';
			document.getElementById('edit').innerHTML = html;
			var indexmenu = '';
			if (node!=code.documentElement) {
			
				// code menu
				menu+= '<input type="button" class="button" value="rename" onclick="renameobject();" title="rename group" />';
				menu+= '<input type="button" class="button" value="duplicate" onclick="duplicateObject();" title="duplicate group" />';
				menu+= '<input type="button" class="button" value="remove" onclick="removeobject();" title="remove group" />';
				
				// index menu
				var prev = '';
				var next = node;
				var siblings = node.parentNode.childNodes;
				for (var i=0; i<siblings.length; i++) if(siblings[i].tagName == 'g') {
					if (siblings[i] == node) next = '';
					else if (next) prev = siblings[i];
					else {
						next = siblings[i];
						break; 
					}
				}
				
				//indexmenu+= '<input type="button" class="button" value="<"' + (prev ? ' onclick="moveUp(\'' + id + '\');"' : ' disabled="disabled"') + '"/>';
				indexmenu+= '<input type="button" class="button" value="&#8743;"' + (prev ? ' onclick="swapobjects(\'' + id + '\', \'' + getId(prev) + '\');"' : ' disabled="disabled"') + '"/>';
				indexmenu+= '<input type="button" class="button" value="&#8744;"' + (next ? ' onclick="swapobjects(\'' + id + '\', \'' + getId(next) + '\');"' : ' disabled="disabled"') + '"/>';
			}
			// code menu
			menu+= '<input type="button" class="button" value="add new" onclick="addobject();" title="add new group" />';
			menu+= '<input type="button" class="button" value="load into" onclick="gotoLoad();" title="load svg into project" />';
			menu+= '<br/><h3>add: <\/h3>'
			menu+= '<input type="button" class="button" value="&#111;" onclick="addCode(\'circle\');" title="add circle code" />';
			menu+= '<input type="button" class="button" value="[]" onclick="addCode(\'rect\');" style="letter-spacing:-0.2em" title="add rectangle code" />';
			menu+= '<input type="button" class="button" value="&#48;" onclick="addCode(\'ellipse\');" title="add ellipse code" />';
			menu+= '<input type="button" class="button" value="/" onclick="addCode(\'line\');" title="add line code" />'; //&#8260;
			menu+= '<input type="button" class="button" value="&#8736;" onclick="addCode(\'path\');" title="add path code" />';
			menu+= '<input type="button" class="button" id="memoryButton" value="M" title="" onClick="onMemoryClicked()" '+((storedCode == "")? 'disabled="true"' : '')+' />';
			
			document.getElementById('edit_menu').innerHTML = menu;
			document.getElementById('index_menu').innerHTML = indexmenu;
			
			updateMemoryButtonLabel();
	}
	//if (selected) document.getElementById(selected).style.fontWeight = 'normal';
	if (selected) document.getElementById(selected).setAttribute("class","indexItem");
	selected = id;
	//document.getElementById(selected).style.fontWeight = 'bold';
	document.getElementById(selected).setAttribute("class","indexItem selected");
	
	
	
	updateVisualSelect();
	
	buildsvg();
	
	//console.groupEnd();
}
function createSelectionSVG()
{
	selectionPSVG = code.createElement('rect');
	selectionPSVG.setAttributeNS(null,'id', "selector");
	selectionPSVG.setAttributeNS(null,'fill', "none");
	selectionPSVG.setAttributeNS(null,'stroke', "#84CAFF");
	selectionPSVG.setAttributeNS(null,'stroke-width', "2");
	selectionPSVG.setAttributeNS(null,'stroke-dasharray', "5,5");	
	selectionPSVG.setAttributeNS(null,'opacity', "0.9");
	selectionPSVG.setAttributeNS(null,'transform', 'translate(0 0)');
	selectionPSVG.setAttributeNS(null,'width', '100');
	selectionPSVG.setAttributeNS(null,'height', '100');
}
function updateVisualSelect()
{
	var selectedNode = index[selected];
	//console.log("selectedNode: ",selectedNode);
	if(selectedNode == undefined)
	{
		if(selectionPSVG.parentNode != undefined)
			selectionPSVG.parentNode.removeChild(selectionPSVG);
		selectedSVG = null;
	}
	else
	{
		var selectedSVG = getSelectedSVG();
		
		//var bb = dragnode.getBBox();
		//var bb = selectedSVG.getBounds();
		//var bb = selectedSVG.getBoundingClientRect();
		var bb = selectedSVG.getBBox();
		
		var strokeWidth = parseFloat(selectionPSVG.getAttributeNS(null,'stroke-width'));
		//console.log("strokeWidth: ",strokeWidth);
		selectionPSVG.setAttributeNS(null,'x', bb.x-strokeWidth/2);
		selectionPSVG.setAttributeNS(null,'y', bb.y-strokeWidth/2);
		selectionPSVG.setAttributeNS(null,'width', bb.width+strokeWidth);
		selectionPSVG.setAttributeNS(null,'height', bb.height+strokeWidth);
		
		selectedNode.appendChild(selectionPSVG); // insertBefore
	}
	
	//console.log("selectionPSVG: ",selectionPSVG);
	
	//buildsvg();
}
function getSelectedSVG()
{
	//console.group("getSelectedSVG");
	var titles = selected.split(',');
	//console.log("titles: ",titles);
	var svgNode;
	if(titles.length > 0)
	{
		svgNode = svg;
	}
	if(titles.length > 1)
	{
		for(var i=1;i<titles.length;i++)
		{
			svgNode = getChildByTitle(svgNode,titles[i]);
		}
	}
	//console.log("svgNode: ",svgNode);
	//console.groupEnd();
	return svgNode;
}
function getChildByTitle(svgNode,title)
{
	//console.group("getChildByTitle");
	var childNodes = svgNode.childNodes;
	for(var i=0;i<childNodes.length;i++)
	{
		var child = childNodes[i];
		if(child.tagName != "g" && child.tagName != "svg:g") continue;
		var groupChildNodes = child.childNodes;
		for(var j=0;j<groupChildNodes.length;j++)
		{
			var groupChild = groupChildNodes[j];
			if(groupChild.tagName == "title" || groupChild.tagName == "svg:title")
			{
				var textContent = groupChild.firstChild.textContent;
				if(textContent == title)
				{
					//console.groupEnd();
					return child;
				}
			}
		}
	}
	//console.groupEnd();
}

function update(element) {
	//console.group("update");
	//console.log("element: ",element);
	switch(element) {
		case 'title':
		
			var editTitleNode = document.getElementById('edittitle');
			// update parametric svg code
			setNodeXML(code.getElementsByTagName('title')[0], editTitleNode.value);
			// update title 
			document.getElementById('title').innerHTML = editTitleNode.value;
			
			if(resultState == RESULT_STATE_SAVE)
			{
				var filenameLibrary = document.getElementById('filenameLibrary');
				filenameLibrary.value = editTitleNode.value+psvgE;
				//console.log("filenameLibrary.value: ",filenameLibrary.value);
				validateSaveForm();
			}
			//@@@
			//console.log("resultState: ",resultState);
			if(resultState != RESULT_STATE_SAVE)
			{
				buildindex();
				select('project');
			}
			break;
		case 'description':
			setNodeXML(code.getElementsByTagName('desc')[0], document.getElementById('editdesc').value);
			break;
		case 'width':
			//code.documentElement.setAttribute('width', document.getElementById('editwidth').value);
			docWidth = document.getElementById('editwidth').value;
			code.firstChild.setAttribute("width",docWidth+units);
			//console.log("code: ",code);
			//console.log("code.firstChild: ",code.firstChild);
			break;
		case 'height':
			//code.documentElement.setAttribute('height', document.getElementById('editheight').value);
			docHeight = document.getElementById('editheight').value;
			code.firstChild.setAttribute("height",docHeight+units);
			break;
		case 'units':
			var unitsSelect = document.getElementById('units');
			units = unitsSelect.options[unitsSelect.selectedIndex].value;
			code.firstChild.setAttribute("width",docWidth+units);
			code.firstChild.setAttribute("height",docHeight+units);
			//setupsvg();
			break;
		case 'params':
			defs = code.getElementsByTagName('defs')[0];
			while(defs.childNodes.length) defs.removeChild(defs.childNodes[0]);
			lines = document.getElementById('params').value.replace(/ /g,'').split("\n");
			for (var i=0; i<lines.length; i++) if (lines[i]) {
				newnode = code.createElement('ref');
				attributes = lines[i].split("=");
				newnode.setAttribute('param', attributes[0])
				newnode.setAttribute('default', attributes[1])
				defs.appendChild(newnode)
			}
			break;
		case 'transform':
			index[selected].setAttribute('transform', document.getElementById('edittransform').value);
			break;
		case 'code':
			var editCodeNode = document.getElementById('editcode');
			// store cursor position so we can add code from memory at that location
			
			if(!keepCodeCursorPos)
			{			
				codeCursorPos = editCodeNode.selectionStart;
				//console.log("codeCursorPos: ",codeCursorPos);
			}
			
			setNodeXML(index[selected], editCodeNode.value);
			break;
	}
	//console.log("dragnode: ",dragnode);
	if(!((element == 'title' || element == 'description') && resultState == RESULT_STATE_SAVE))
	{
		buildsvg();
	}
	//console.log("dragnode: ",dragnode);
	//console.groupEnd();
}

function swapobjects(idA, idB) {
	var svgA = index[idA];
	var svgB = index[idB];
	cloneB = svgB.cloneNode(true);
	var parentSVG = svgA.parentNode;
	parentSVG.insertBefore(cloneB, svgA);
	parentSVG.replaceChild(svgA, svgB);
	
	buildindex();
	select(selected);
}

function addobject(name) {
	var parentNode = index[selected];
	if(!name) name = prompt('please enter name for new object', 'newobject');
	while(parentNode.childNodes.length > 0 && nameExists(parentNode.childNodes[0],name)) name = prompt('name exists, please try a different name', name);
	if (name) {
		newgroup = code.createElement('g');
		newgroup.setAttribute('transform', 'translate(0 0)');
		var title = code.createElement('title')
		title.appendChild(code.createTextNode(name));
		newgroup.appendChild(title);
		parentNode.appendChild(newgroup);
		selected = getId(newgroup);
		buildindex();
		select(selected);
		return newgroup;
	}
}

function removeobject() {
	if (confirm('Are you sure you want to remove \'' + getNodeTitle(index[selected]) + '\'?')) {
		var node = index[selected];
		selected = getId(node.parentNode);
		node.parentNode.removeChild(node);
		buildindex();
		select(selected);
	}
}

function renameobject() {
	var selectedSVG = index[selected];
	var name = prompt('enter new name', getNodeTitle(selectedSVG));
	while(nameExists(selectedSVG,name) && name != getNodeTitle(selectedSVG)) name = prompt('name exists, please try a different name', name);
	if (name) {
		setNodeTitle(selectedSVG,name);
		selected = getId(selectedSVG);
		buildindex();
		select(selected);
	}
}
function duplicateObject() {
	var selectedSVG = index[selected];
	var cloneSVG = selectedSVG.cloneNode(true);
	
	var selectedName = getNodeTitle(cloneSVG);
	
	var cloneName = prompt('enter new name',selectedName+" copy");
	while(nameExists(selectedSVG,cloneName)) cloneName = prompt('name exists, please try a different name', cloneName);
	if (name) {
		setNodeTitle(cloneSVG,cloneName);
		selectedSVG.parentNode.appendChild(cloneSVG);
		buildindex();
		//selected = getId(cloneSVG);
		//select(selected);
		select(getId(cloneSVG));
	}
}
// adds basic shapes code to edit code field.
function addCode(type)
{
	var newCode = "";
	
	if(type != "memory") newCode += "\r\n\r\n";
	
	switch(type)
	{
		case "circle":
			newCode += '<circle cx="50" cy="50" r="25" style="fill:none;stroke:black;stroke-width:1"/>';
			break;
		case "rect":
			newCode += '<rect x="10" y="10" height="100" width="100" style="fill:none;stroke:black;stroke-width:1"/>';
			break;
		case "ellipse":
			newCode += '<ellipse cx="50" cy="50" rx="20" ry="30" style="fill:none;stroke:black;stroke-width:1"/>';
			break;
		case "line":
			newCode += '<line x1="10" y1="10" x2="70" y2="30" style="fill:none;stroke:black;stroke-width:1"/>';
			break;
		case "path":
			newCode += '<path d="M50,50 100,50 75,75 Z" style="fill:none;stroke:black;stroke-width:1"/>';
			break;
		case "memory":
			//console.log("storedCode: ",storedCode);
			newCode += storedCode;
			break;
	}
	codeField = document.getElementById('editcode');
	
	//console.log("codeCursorPos: ",codeCursorPos);
	if(codeCursorPos == -1)
	{
		codeField.value += newCode;
	}
	else
	{
		var before = codeField.value.slice(0,codeCursorPos);
		var after = codeField.value.slice(codeCursorPos);
		codeField.value = before+newCode+after;
	}
	
	keepCodeCursorPos = true;
	update('code');
	keepCodeCursorPos = false;
}

// update svg code for display
function buildsvg() 
{
	resultState = RESULT_STATE_SVG;
	//console.log("resultState: ",resultState);

	//console.group("buildsvg");
	// set parameters, i.e. evaluate names and values for variables defined in the 'defs' node
	var defs = code.getElementsByTagName('defs')[0];
	if (defs) for (var i=0; i<defs.childNodes.length; i++) if (defs.childNodes[i].nodeType == 1) eval(defs.childNodes[i].getAttribute('param') + '=' + defs.childNodes[i].getAttribute('default') +';');
	
	// empty svg node
	while(svg.childNodes.length) svg.removeChild(svg.childNodes[0]);
	
	// convert all non-defs node to svgnodes
	var nodelist = code.documentElement.childNodes;
	for (var i=0; i<nodelist.length;i++) if(nodelist[i].tagName!='defs') svg.appendChild(p2c(nodelist[i]));
	
	// setup image in html
	document.getElementById('result_title').innerHTML = 'image';
	html = '<h3>viewbox</h3> <span id="viewbox" style="font-family:sans; font-size:small;">' + svg.getAttribute('viewBox');
//	html+= '</span><span style="float:right;"><input id="tools" type="checkbox" value="" disabled="disabled"/><h3>tools<h3><input id="guides" type="checkbox" value="" disabled="disabled"/><h3>guides<h3></span>';
	menu = '<input type="button" class="button" value="render" id="render" onclick="buildsvg();" title="render code" />';
	menu+= '<input type="button" class="button" value="export" onclick="gotoExport();" title="export result as concrete svg file" />';
	menu+= '<input type="button" class="button" value="+" onclick="zoom(1);" title="zoom in" />';
	menu+= '<input type="button" class="button" value="&#8853;" onclick="zoom(0);" title="default viewbox" />';
	menu+= '<input type="button" class="button" value="&#8722;" onclick="zoom(-1);" title="zoom out" />';
	menu+= '<input type="button" class="button" value="?" onclick="gotoHelp();" title="click for help" />';
	document.getElementById('result_menu').innerHTML = menu;
	document.getElementById('result_footer').innerHTML = html;
	disableRenderButton(true);
	
	document.getElementById('result').setAttribute('class', 'image');
	document.getElementById('result').innerHTML = '';
	document.getElementById('result').appendChild(svg);
	
	// trying to support SVGWEB
	/*//document.getElementById('result').innerHTML = '<script type="image/svg+xml"></script>';
	//var resultNode = document.getElementById('result')
	//var scriptNode = resultNode.childNodes[0];
	//scriptNode.appendChild(svg);*/
	
	/*//document.getElementById('result').innerHTML = "<script type='image/svg+xml' id='resultSVGScript'></script>";
	document.getElementById('result').innerHTML = "<div id='resultSVGScript' class='image'></div>";
	//document.getElementById('resultSVGScript').setAttribute('class', 'image');
	//document.getElementById('resultSVGScript').innerHTML = 'test';
	//document.getElementById('resultSVGScript').appendChild(svg);
	//document.getElementById('resultSVGScript') = svg;*/
	
	/*document.getElementById('result').setAttribute('class', 'image');
	document.getElementById('result').innerHTML = '<object data="svgweb/samples/svg-files/helloworld.svg" type="image/svg+xml" width="200" height="200" id="mySVGObject">';
	var doc = document.getElementById('mySVGObject').contentDocument;
	//doc.appendChild(svg);*/
	
	/*document.getElementById('result').setAttribute('class', 'image');
	document.getElementById('result').innerHTML = ''
	var container = document.getElementById('result');
	currentSVGObject = svgweb.appendChild(svg, container);*/
	
	if(ieV >= 9.0)
	{
		setupsvg();
	}
	//console.groupEnd();
}

function gotoHelp() 
{
	resultState = RESULT_STATE_HELP;
	//console.log("resultState: ",resultState);

	var ajaxRequest = ( window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP") );
	ajaxRequest.onreadystatechange = function() {
		if(ajaxRequest.readyState == 4) document.getElementById('result').innerHTML = ajaxRequest.responseText;
	}
	ajaxRequest.open("GET", "help.html", true);
	ajaxRequest.send(null);
	menu = '<input type="button" class="button" value="&#215;" onclick="buildsvg();" title="close help" />';
	document.getElementById('result_title').innerHTML = 'help';
	document.getElementById('result_footer').innerHTML = '';
	document.getElementById('result_menu').innerHTML = menu;
	document.getElementById('result').setAttribute('class', 'help');
	document.getElementById('result').innerHTML = 'loading...';
}

function checkTitles(node, id) {
	if (!getNodeTitle(node)) {
		var title = node.ownerDocument.createElement('title')
		title.appendChild(node.ownerDocument.createTextNode(id ? 'sub' + id : 'new'));
		node.appendChild(title);
	}
	var id = 1;
	for (var i=0;i<node.childNodes.length; i++) if (node.childNodes[i].tagName == 'g') checkTitles(node.childNodes[i], id++);
}

function loadFileFromServer(filename) {
	if (!filename) document.getElementById('progressbar').innerHTML = 'no file';
	else {
		var ajaxRequest = ( window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP") );
		ajaxRequest.onreadystatechange = function() {
			if(ajaxRequest.readyState == 4) {
				document.getElementById('progressbar').innerHTML = '';
				if (selected == 'project') {
					code = loadxml(ajaxRequest.responseText);
					checkTitles(code.documentElement);
					if (!getDescription(code.documentElement)) {
						var desc = code.createElement('title')
						desc.appendChild(code.createTextNode(''));
						code.documentElement.appendChild(desc);
					}
					if (!code.documentElement.getAttribute('width')) code.documentElement.setAttribute('width', "210mm"); //Q why 210mm? 
					if (!code.documentElement.getAttribute('height')) code.documentElement.setAttribute('height', "297mm"); //Q why 297mm? 
					setupsvg();
				}
				else {
					var loadnode = loadxml(ajaxRequest.responseText).documentElement;
					checkTitles(loadnode);
					var newnode = addobject(getNodeTitle(loadnode));
					for(var i=0; i<loadnode.childNodes.length; i++) switch(loadnode.childNodes[i].tagName) {
						case 'defs': while (loadnode.childNodes[i].childNodes.length) code.getElementsByTagName('defs')[0].appendChild(loadnode.childNodes[i].childNodes[0]); break;
						default: newnode.appendChild(loadnode.childNodes[i].cloneNode(true)); break;
					}
					selected = getId(newnode);
				}
				buildindex();
				select(selected);
				buildsvg();
			}
		}
		document.getElementById('progressbar').innerHTML = 'loading...';
		ajaxRequest.open("GET", "svg.php?id=loadFile&filename=" + filename, true);
		ajaxRequest.send(null);
	}
}

function saveFileToServer(html) {
	document.getElementById('progressbar').innerHTML = html;
}

function startUpload(){
	//console.group("startUpload");
	//console.log("code: ",code);
	document.getElementById('uploadcode').value = getNodeXML(code);
	document.getElementById('svgcode').value = getNodeXML(svg);
	document.getElementById('progressbar').innerHTML = 'uploading...';
	document.getElementById('uploadform').style.visibility = 'hidden';
	document.getElementById('uploadform').target = 'upload_target';
	document.getElementById('uploadform').submit();
	//console.groupEnd();
	return true;
}

function ajaxGet(param, id) {
	var request = ( window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP") );
	request.onreadystatechange = function() {
		if(request.readyState == 4) document.getElementById(id).innerHTML = request.responseText;
	}
	request.open('GET', param, true);
	request.send(null);
}

function gotoLoad() 
{
	resultState = RESULT_STATE_LOAD;
	//console.log("resultState: ",resultState);

	html = '<div>';
	html+= '<h3>load svg code from disk</h3>';
	html+= '<form id="uploadform" action="svg.php?id=uploadFile&destination=client" method="post" enctype="multipart/form-data">';
	html+= '<input type="file" name="loadfile" size="20" onchange="startUpload();"/>';
	html+= '<input type="hidden" id="uploadcode" name="uploadcode" value=""/>';
	html+= '<input type="hidden" id="svgcode" name="svgcode" value=""/>';
	html+= '<iframe id="upload_target" name="upload_target" src="" style="width:0;height:0;border:0px solid #fff;"></iframe>';
	html+= '</form>';
	html+= '</div>';
	html+= '<hr/>';
	html+= '<div>';
	html+= '<h3>load svg code from online template library</h3>';
	html+= '';
	html+= '<label>category</label> <span id="libraryCategories">loading...</span>';
	html+= '<div id="libraryFiles">';
	//html+= '<tr><th></th><td id="libraryFiles"><input type="submit" id="load" value="load" onclick="loadFileFromServer(\'library/\' + document.getElementById(\'loadCategory\').value + \'/\' +document.getElementById(\'loadFile\').value);"  title="import file" disabled="true"/></td></tr>';
	html+= '</div>';
	html+= '<span id="progressbar"></span>';
	menu = '<input type="button" class="button" value="&#215;" onclick="buildsvg();" title="close load menu" />';
	document.getElementById('result_title').innerHTML = 'load code';
	document.getElementById('result_menu').innerHTML = menu;
	document.getElementById('result').setAttribute('class', 'help');
	document.getElementById('result').innerHTML = html;
	ajaxGet('svg.php?id=getLibraryCategories&purpose=load', 'libraryCategories');
}



function saveFile() {
	//console.group("saveFile");
	var svgNode = code.firstChild;
	///console.log("download code",svgNode);
	
	downloadCode(code);
	//console.groupEnd();
}
function exportFile() {
	//console.group("exportFile");
	//console.log("svg",svg);
	
	// locate selector inside svg and temporarily remove it
	var selectedSVG = getSelectedSVG();
	var selectionSVGParent;
	if(selectedSVG != null)
	{
		var selectionSVG;
		var selectionPSVGID = selectionPSVG.getAttribute('id');
		var childNodes = selectedSVG.childNodes;
		for(var i=0;i<childNodes.length;i++)
		{
			var child = childNodes[i];
			if(child.id == selectionPSVGID)
			{
				selectionSVG = child;
			}
		}
		if(selectionSVG != undefined)
		{
			var selectionSVGParent = selectionSVG.parentNode;
			selectionSVGParent.removeChild(selectionSVG);
		}
	}
	
	var vb = getViewbox(svg);
	svg.setAttribute("width",docWidth+units);
	svg.setAttribute("height",docHeight+units);
	svg.setAttribute("viewBox","0 0 "+docWidth+" "+docHeight);
	//console.log(" download code:",svg);
	downloadCode(svg);
	svg.setAttribute("width","400px");
	svg.setAttribute("height","400px");
	svg.setAttribute("viewBox",vb.x+" "+vb.y+" "+vb.w+" "+vb.h);
	//console.log(" restored code",svg);
	
	// restore removed selector
	if(selectionSVGParent != undefined)
	{
		selectionSVGParent.appendChild(selectionSVG);
	}
	
	//console.groupEnd();
}
function downloadCode(downloadCode) {
	//console.group("downloadCode");
	var filenameDisk = document.getElementById('filenameDisk').value;
	document.getElementById('filenameDownload').value = filenameDisk;
	
	document.getElementById('downloadcode').value = getNodeXML(downloadCode);
	//console.log("document.getElementById('downloadcode').value: ",document.getElementById('downloadcode').value);
	document.getElementById('downloadform').submit();
	//console.groupEnd();
}

// input validation (check if file is orginal etc)
function validateSaveForm() 
{
	var name = document.getElementById('name').value;
	var email = document.getElementById('email').value;
	var categorySelector = document.getElementById('loadCategory');
	//console.log("categorySelector: ",categorySelector);
	var loadCategory = '';
	if(document.getElementById('loadCategory') != undefined)
		loadCategory = categorySelector.value;
	
	var message = "";
	
	var saveButton = document.getElementById('save');
	saveButton.disabled = true;
	
	if(name == '')
	{
		message += 'please enter a name<br/>';
	}
	if(email == '')
	{
		message += 'please enter email address<br/>';
	}
	if(loadCategory == '' || loadCategory == 'choose category')
	{
		message += 'please choose a category<br/>';
	}
	document.getElementById('progressbar').innerHTML = message;
	
	if(name == '' || email == '' || loadCategory == '' || loadCategory == 'choose category' || categorySelector == undefined)
		saveButton.disabled = true;
	else
		saveButton.disabled = false;
		
	if(categorySelector != undefined)
	{
		var request = ( window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP") );
		request.onreadystatechange = function() {
			if(request.readyState == 4) {
				var fileExists = request.responseText == 'true' ? true: false;
				
				var message = document.getElementById('progressbar').innerHTML;
				if(fileExists)
				{
					message += 'A file with this name already exists in this category! Please choose another filename.<br/>';
					document.getElementById('progressbar').innerHTML = message;
					
					saveButton.disabled = true
				}
			}
		}
		
		request.open('GET', 'svg.php?id=checkFileInCategory&category=' + categorySelector.value + '&filename=' + document.getElementById('filenameLibrary').value, true);
		request.send(null);
	}
}


function gotoExport() 
{
	//console.group("gotoExport");
	
	resultState = RESULT_STATE_EXPORT;
	//console.log("resultState: ",resultState);
	
	html = '<p>export svg code to disk</p>';
	html+= '<label>filename</label><input type="text" name="filename" id="filenameDisk" value="' + getNodeTitle(code.documentElement) + svgE+'"/><input type="button" class="button" value="save to disk" onclick="exportFile();"/>';
	
	html+= '<form id="downloadform" action="svg.php?id=downloadFile" method="post">';
	html+= '<input type="hidden" name="filename" id="filenameDownload" value="' + getNodeTitle(code.documentElement) + svgE+'"/>';
	html+= '<input type="hidden" id="downloadcode" name="code" value=""/>';
	html+= '</form>';
	
	html+= '<span id="progressbar"></span>';
	menu = '<input type="button" class="button" value="&#215;" onclick="buildsvg();" title="close save menu" />';
	document.getElementById('result_title').innerHTML = 'export svg';
	document.getElementById('result_menu').innerHTML = menu;
	document.getElementById('result').setAttribute('class', 'help');
	document.getElementById('result').innerHTML = html;
	
	var filenameDiskNode = document.getElementById('filenameDisk');
	var filenameDisk = filenameDiskNode.value;
	//console.log("filenameDiskNode: ",filenameDiskNode);
	//console.log("filenameDisk: ",filenameDisk);
	
	//ajaxGet('svg.php?id=getLibraryCategories&purpose=save', 'libraryCategories');
	//console.groupEnd();
}

function gotoSave(filetype) 
{

	resultState = RESULT_STATE_SAVE;
	//console.log("resultState: ",resultState);

	html = '<div>';
	html+= '<h3>save parametric svg code to disk</h3>';
	html+= '<label>filename</label><input type="text" name="filename" id="filenameDisk" value="' + getNodeTitle(code.documentElement) + psvgE+'"/><input type="button" class="button" value="save to disk" onclick="saveFile();"/>';
	html+= '<form id="downloadform" action="svg.php?id=downloadFile" method="post">';
	html+= '<input type="hidden" name="filename" id="filenameDownload" value="' + getNodeTitle(code.documentElement) + psvgE+'"/>';
	html+= '<input type="hidden" id="downloadcode" name="code" value=""/>';
	html+= '</form>';
	html+= '</div>';
	html+= '<hr/>';
	html+= '<div>';
	html+= '<h3>save svg code to online template library</h3>';
	html+= '<form id="uploadform" action="svg.php?id=uploadFile&destination=server" method="post" enctype="multipart/form-data">';
	html+= '<label>name</label><input type="text" name="name" id="name" value="" onchange="validateSaveForm();"/>';
	html+= '<label>email address</label><input type="text" name="email" id="email" value="" onchange="validateSaveForm();"/>';
	html+= '<label>&nbsp;</label><input type="checkbox" class="checkbox" name="newsletter" value="newsletter" /><span>inform me about updates</span>';

	//html+= '<label>filename</label><input type="text" name="filename" id="filenameLibrary" value="' + getNodeTitle(code.documentElement) + psvgE+'" onchange="validateSaveForm();"/>';
	html+= '<label>category</label><span id="libraryCategories">loading...</span>';
	html+= '<label>&nbsp;</label>';
	html+= '<input type="button" class="button" id="save" value="save to library" onclick="startUpload();" disabled="disabled"/>';
	
	html+= '<input type="hidden" name="filename" id="filenameLibrary" value="' + getNodeTitle(code.documentElement) + psvgE+'" />';
	html+= '<input type="hidden" id="uploadcode" name="uploadcode" value=""/>';
	html+= '<input type="hidden" id="svgcode" name="svgcode" value=""/>';
	html+= '<iframe id="upload_target" name="upload_target" src="" style="width:0;height:0;border:0px solid #fff;"></iframe>';
	html+= '</form>';
		
	html+= '<span id="progressbar"></span>';
	html+= '</div>';
	menu = '<input type="button" class="button" value="&#215;" onclick="buildsvg();" title="close save menu" />';
	document.getElementById('result_title').innerHTML = 'save code';
	document.getElementById('result_menu').innerHTML = menu;
	document.getElementById('result').setAttribute('class', 'help');
	document.getElementById('result').innerHTML = html;
	ajaxGet('svg.php?id=getLibraryCategories&purpose=save', 'libraryCategories');
	
	validateSaveForm();
}

// convert text into DOM XML object
function loadxml(txt) {
	//console.group("loadxml");
	//console.log("txt",txt);
	
	if (window.DOMParser) {
		parser = new DOMParser();
		xml = parser.parseFromString(txt,"text/xml");
	}
	else {
		xml = new ActiveXObject("Microsoft.XMLDOM");
		xml.async = "false";
		xml.loadXML(txt);
	} 
	//console.groupEnd();
	return xml;
}

// convert XML node content into string
function getNodeXML (node) {
	if (node)
	{
		return (node.xml || (new XMLSerializer()).serializeToString(node) || "");//.replace(/(.*)( xmlns=\".*?\")(.*)/g, "$1$3");
	}
	else
	{
		return '';
	}
}

// parse string into XML node
function setNodeXML (node, contents) {
	contents = '<svg>' + contents + '</svg>';
	if (window.DOMParser) {
		parser = new DOMParser();
		xml = parser.parseFromString(contents, "text/xml");
	}
	else {
		xml = new ActiveXObject("Microsoft.XMLDOM");
		xml.async = "false";
		xml.loadXML(contents);
	}
	// remove drawing code from node (but leave group elements and other information), keep track of first group element
	var pos = '';
	for (i=node.childNodes.length-1;i>=0;i--) switch(node.childNodes[i].tagName) {
		case 'g': pos = node.childNodes[i]; break;
		case 'desc': break;
		case 'title': break;
		case 'defs': break;
		default: node.removeChild(node.childNodes[i]);
	}
	// insert new code before first subgroup element to keep proper layering
	importlist = xml.documentElement.childNodes;
	for(var i=0; i<importlist.length; i++) {
		newnode = node.ownerDocument.importNode(importlist[i], true);
		if (pos) node.insertBefore(newnode, pos);
		else node.appendChild(newnode, true);
	}
}

function jointpath(path, joint) {
	var points = path.split(' ');
	var joint = joint.split(' ');
	var path = '';
	for (var j=0; j<points.length-1; j++) {
		var a = points[j].split(',');
		var b = points[j+1].split(',');
		var x1 = parseFloat(a[0]);
		var y1 = parseFloat(a[1]);
		var x2 = parseFloat(b[0]);
		var y2 = parseFloat(b[1]);
		for (var i=0; i<joint.length; i++) joint[i] = parseFloat(joint[i]);
		var material = Math.abs(parseFloat(joint[0]));
		var length = Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2)) - joint[2] - joint[3];
		var theta = Math.atan2(y2-y1, x2-x1);
		var N = Math.round(length/Math.abs(joint[1]));
		if (!(N%2)) N--;
		var direction = (joint[0]<0 ? 1 : 0);
		for (var i=0; i<N; i++) {
			var xa = i*length/N + (i==0 ? 0 : joint[2]);
			var xb = joint[2] + (i+1)*length/N + (i==N-1 ? joint[3] : 0);
			var ya = ((i+1)%2 ? 0 : (direction ? -1 : 1)*material);
			var yb = (direction ? - material : 0);
			if (!j || i) path+= (path ? ' ' : '') + ((x1 + xa*Math.cos(theta) - ya*Math.sin(theta))).toPrecision(3) + ',' + ((y1 + xa*Math.sin(theta) + ya*Math.cos(theta))).toPrecision(3);
			path+= ' ' + ((x1 + xb*Math.cos(theta) - ya*Math.sin(theta))).toPrecision(3) + ',' + ((y1 + xb*Math.sin(theta) + ya*Math.cos(theta))).toPrecision(3);
		}
	}
	return path;
}

function millpath(path, mill) {
	var points = path.split(' ');
	var path = '';
	var test = points[0].split(',').concat(points[points.length-1].split(','));
	var closed = ((parseFloat(test[0])-parseFloat(test[2])).toFixed(6) == 0 && (parseFloat(test[1])-parseFloat(test[3])).toFixed(6) == 0 ? true : false);
	for (var i=0; i<points.length; i++) {
		var a = (i == 0 ? (closed ? points[points.length-2].split(',') : null) : points[i-1].split(','));
		var b = points[i].split(',');
		var c = (i==points.length-1 ? (closed ? points[0].split(',') : null) : points[i+1].split(','));
		var alpha = a ? Math.atan2(parseFloat(b[1]) - parseFloat(a[1]), parseFloat(b[0]) - parseFloat(a[0])) : null;
		var beta = c ? Math.atan2(parseFloat(c[1]) - parseFloat(b[1]), parseFloat(c[0]) - parseFloat(b[0])) : null;
		var gamma = (alpha!=null && beta!=null) ? (mill<0 ? 1 : +1)*(Math.PI - beta + alpha) : 0;
		var m1x = parseFloat(b[0]) + 0.5*mill*Math.cos((a ? alpha : beta) - 0.5*Math.PI);
		var m1y = parseFloat(b[1]) + 0.5*mill*Math.sin((a ? alpha : beta) - 0.5*Math.PI);
		if (gamma >= 0) path+= (path ? ' ' : '') + m1x.toPrecision(3) + ',' + m1y.toPrecision(3);
		if (gamma != 0) {
			var m2x = parseFloat(b[0]) + 0.5*mill*Math.cos(beta - 0.5*Math.PI);
			var m2y = parseFloat(b[1]) + 0.5*mill*Math.sin(beta - 0.5*Math.PI);
			var x1 = m1x;
			var y1 = m1y;
			var x2 = m1x + parseFloat(b[0]) - parseFloat(a[0]);
			var y2 = m1y + parseFloat(b[1]) - parseFloat(a[1]);
			var x3 = m2x;
			var y3 = m2y;
			var x4 = m2x + parseFloat(c[0]) - parseFloat(b[0]);
			var y4 = m2y + parseFloat(c[1]) - parseFloat(b[1]);
			var px = ((x1*y2-y1*x2)*(x3-x4) - (x1-x2)*(x3*y4-y3*x4)) / ((x1-x2)*(y3-y4) - (y1-y2)*(x3-x4));
			var py = ((x1*y2-y1*x2)*(y3-y4) - (y1-y2)*(x3*y4-y3*x4)) / ((x1-x2)*(y3-y4) - (y1-y2)*(x3-x4));
			path+= (path ? ' ' : '') + px.toPrecision(3) + ',' + py.toPrecision(3);
		}
	}
	return path;
}

// parametric to concrete 
function p2c(node) {
	//console.group("p2c");
	var element = node.tagName;
	var attributes = new Array();
	
	// replace all curly brackets with their evaluated content
	if (node.attributes) if (node.attributes.length) for (var i=0; i<node.attributes.length; i++) {
		if (node.attributes[i].name == 'transform') {
			var translate = getTranslate(node);
			var transform = (translate ? node.attributes[i].value.replace(/translate\(.*?\)/, 'translate({' + translate.px + (translate.x<0?'':'+') + translate.x + '} {' + translate.py + (translate.y<0?'':'+') + translate.y + '})') : node.attributes[i].value);
			attributes[node.attributes[i].name] = transform.replace(/({.*?})/g, function(match) { return eval(match); } );
		}
		else attributes[node.attributes[i].name] = node.attributes[i].value.replace(/({.*?})/g, function(match) { return eval(match); } );
	}
	
	// check elements for non standard attributes: fingerjoint, mill
	switch(element) {
		case 'rect':
			if (attributes['mill']) {
				attributes['x'] = parseFloat(attributes['x']) - parseFloat(attributes['mill'])/2;
				attributes['y'] = parseFloat(attributes['y']) - parseFloat(attributes['mill'])/2;
				if (attributes['rx']) attributes['rx'] = parseFloat(attributes['rx']) + parseFloat(attributes['mill'])/2;
				if (attributes['ry']) attributes['ry'] = parseFloat(attributes['ry']) + parseFloat(attributes['mill'])/2;
				attributes['width'] = parseFloat(attributes['width']) + parseFloat(attributes['mill']);
				attributes['height'] = parseFloat(attributes['height']) + parseFloat(attributes['mill']);
			}
			break;
		case 'circle':
			if (attributes['mill']) attributes['r'] = parseFloat(attributes['r']) + parseFloat(attributes['mill'])/2;
			break;
		case 'ellipse':
			if (attributes['mill']) {
				attributes['rx'] = parseFloat(attributes['rx']) + parseFloat(attributes['mill'])/2;
				attributes['ry'] = parseFloat(attributes['ry']) + parseFloat(attributes['mill'])/2;
			}
			break;
		case 'line':
			var points = attributes['x1'] + ',' + attributes['y1'] + ' ' + attributes['x2'] + ',' + attributes['y2'];
			if (attributes['joint']) {
				element = 'path';
				points = jointpath(points, attributes['joint']);
			}
			if (attributes['mill']) {
				element = 'path';
				points = millpath(points, attributes['mill']);
			}
			if (element = 'path') attributes['d'] = 'M' + points;
			break;
		case 'polyline':
			var points = attributes['points'];
			if (attributes['joint']) {
				element = 'path';
				points = jointpath(points, attributes['joint']);
			}
			if (attributes['mill']) {
				element = 'path';
				points = millpath(points, attributes['mill']);
			}
			if (element = 'path') attributes['d'] = 'M' + points;
			break;
		case 'polygon':
			var points = attributes['points'].split(' ');
			points = attributes['points'] + ' ' + points[0];
			if (attributes['joint']) {
				element = 'path';
				points = jointpath(points, attributes['joint']);
			}
			if (attributes['mill']) {
				element = 'path';
				points = millpath(points, attributes['mill']);
			}
			if (element = 'path') attributes['d'] = 'M' + points;
			break;
		default:
	}
	
	// create svg node
	var svgnode = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg:' + element);
	for (name in attributes) svgnode.setAttributeNS(null, name, attributes[name]);
	
	// convert the node's children to svgnodes
	if (node.childNodes) if (node.childNodes.length) for(var i=0; i<node.childNodes.length; i++) switch(node.childNodes[i].nodeType) {
		case 1: svgnode.appendChild(p2c(node.childNodes[i])); break;
		case 3: svgnode.appendChild(svg.ownerDocument.createTextNode(node.childNodes[i].nodeValue));
	}
	if (index[selected]==node) dragnode = svgnode;
	//console.log("node: ",node);
	//console.log("svgnode: ",svgnode);
	//console.groupEnd();
	
	return svgnode;
}

function loadedSvgPreview(currentPreview,fileURL)
{
	//alert("loadedSvgPreview");
	
	//console.group("loadedSvgPreview");
	//console.log("currentPreview: ",currentPreview);
	//console.log("currentPreview.childNodes: ",currentPreview.childNodes);

	var svgDoc = currentPreview.getSVGDocument();
	var svg = svgDoc.firstChild;
	//console.log("svg: ",svg);
	
	var title = "";
	var desc = "";
	
	for(var i=0;i<svg.childNodes.length;i++)
	{
		var childNode = svg.childNodes[i];
		switch(childNode.tagName)
		{
			case "title":
				if(childNode.childNodes.length > 0)
					title = childNode.firstChild.nodeValue;
				break;
			case "desc":
				if(childNode.childNodes.length > 0)
					desc = childNode.firstChild.nodeValue;
				break;
		}
	}
	//console.log("title: ", title);
	//console.log("desc: ", desc);
	
	var libraryItem = currentPreview.parentNode;
	var titleNode = libraryItem.getElementsByTagName("h3")[0];
	var aNode = titleNode.firstChild;
	aNode.firstChild.nodeValue = title;
	var pNode = libraryItem.getElementsByTagName("p")[0];
	pNode.firstChild.nodeValue = desc;
	
	svg.setAttribute("width","100px");
	svg.setAttribute("height","100px");
	
	
	svg.setAttribute("onclick","parent.loadFileFromServer('"+fileURL+"');");
	
	//console.groupEnd();
}

// Returns the version of Internet Explorer or a -1
// (indicating the use of another browser).
function getInternetExplorerVersion()
{
  var rv = -1; // Return value assumes failure.
  if (navigator.appName == 'Microsoft Internet Explorer')
  {
    var ua = navigator.userAgent;
    var re  = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
    if (re.exec(ua) != null)
      rv = parseFloat( RegExp.$1 );
  }
  return rv;
}

function disableRenderButton(disable)
{
	var renderButton = document.getElementById('render');
	if(disable)
	{
		renderButton.setAttribute("disabled","disabled");
	}
	else
	{
		renderButton.removeAttribute("disabled");
	}
}

////////////////// Memory button //////////////////
function onCodeSelect(textArea)
{
	//console.group("onCodeSelect");
	
	// enable memory button
	var memoryButton = document.getElementById("memoryButton");
	memoryButton.removeAttribute("disabled");
	
	//console.log("memoryButton: ",memoryButton);
	//console.log("textArea: ",textArea);
	
	// store selected code
	selectedCode = textArea.value.slice(textArea.selectionStart,textArea.selectionEnd);
	//console.log("selectedCode: ",selectedCode);
	
	updateMemoryButtonLabel();
	
	//console.groupEnd();
}

function onCodeMouseDown(textArea)
{
	//console.group("onCodeMouseDown");
	
	// empty selected code
	selectedCode = "";
	
	if(storedCode == "")
	{	
		// disable memory button
		var memoryButton = document.getElementById("memoryButton");
		memoryButton.setAttribute("disabled","disabled");
		updateMemoryButtonLabel()
	}
	
	//console.groupEnd();
}
function onMemoryClicked()
{
	//console.group("onCodeMouseDown");
	//console.log("selectedCode: ",selectedCode);
	if(selectedCode != "")
	{
		storedCode = selectedCode;
		selectedCode = "";
		updateMemoryButtonLabel();
	}
	else
	{
		addCode('memory');
	}	
	//console.groupEnd();		
}
function updateMemoryButtonLabel()
{
	var title; // = "";
	
	//"add code from memory"
	
	if(storedCode == "" && selectedCode == "")
	{
		title = "first select code to store";
	}
	else if(selectedCode == "" && storedCode != "")
	{
		title = "add code from memory";
	}
	else if(selectedCode != "")
	{
		title = "store selected code";
	}
	
	var memoryButton = document.getElementById("memoryButton");
	memoryButton.title = title;
}

////////////////// SVG getters setters //////////////////
function nameExists(node,name) 
{
	var siblings = node.parentNode.childNodes;
	for (var i=0; i<siblings.length; i++) 
	{
		if(getNodeTitle(siblings[i]) == name) // not needed?: && siblings[i] != node)
			return true;
	}
	return false;
}
function getNodeTitle(node)
{
	var titleNodes = getFirstChildrenByTagName(node,"title");
	if(titleNodes.length > 0)
		return titleNodes[0].childNodes[0].nodeValue;
	return "";
}
function setNodeTitle(node, title)
{
	getFirstChildrenByTagName(node,"title")[0].childNodes[0].nodeValue = title;
}
function getFirstChildrenByTagName(node, tagName)
{
	var childrenWithTagName = new Array();
	var children = node.childNodes;
	for (var i=0; i<children.length; i++)
	{
		if (children[i].tagName == tagName)
			childrenWithTagName.push(children[i]);
	}
	return childrenWithTagName;
}

function getDescription(node) {
	for (var i=0; i<node.childNodes.length; i++) if (node.childNodes[i].tagName == 'desc') return getNodeXML(node.childNodes[i].childNodes[0]);
	return '';
}
function getCode(node) {
	var code = '';
	for(var i=0;i<node.childNodes.length;i++) {
		subnode = node.childNodes[i];
		switch(subnode.tagName) {
			case 'title': break;
			case 'desc': break;
			case 'defs': break;
			case 'g': break;
			default: code+= getNodeXML(subnode);
		}
	}
	return code;
}
function getTranslate(node) {
	if (node!=code.documentElement && node.getAttribute('id')!='project' && node.getAttribute('id')!='parameters') {
		transform = node.getAttribute('transform');
		if  (transform.indexOf('translate')==-1) {
			if (transform=='') transform = 'translate(' + 0 + ' ' + 0 + ')';
			else transform+= ' translate(' + 0 + ' ' + 0 + ')';
		}
		t = transform ? transform.match(/translate\(({(.*?)}(.*?)|(.*?))[ |,]({(.*?)}(.*?)|(.*?))\)/) : '';
		return { x: parseFloat(t[2] ? (t[3]?t[3]:0) : (t[4]?t[4]:0)), y: parseFloat(t[6] ? (t[7]?t[7]:0) : (t[8]?t[8]:0)), px: (t[2]?t[2]:''), py: (t[6]?t[6]:'') };
	}
	else return '';
}



////////////////// extraData getters setters//////////////////

function getExtraData(id) 
{
	if(extraData[id] === undefined)
		extraData[id] = {collapsed:false};
	return extraData[id];
}
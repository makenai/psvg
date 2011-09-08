<?php

	$psvgE = '.psvg'; // parametric svg file extension
	$svgE = '.svg'; // svg file extension

	if(!isset($_GET['id'])) return;

	switch($_GET['id']) {
		case 'getLibraryCategories':
			$handle = opendir('library/');
			$options = '';
			$other = '';
			while ($folder = readdir($handle))
			{
				if (!in_array($folder, array(".", "..")))
				{
					$option = '<option value="'.$folder.'">'.$folder.'</option>';
					if($folder == "other") 
						$other = $option;
					else
						$options .= $option;
				} 
			} 
			if($other != "")
			{
				$options .= $other;
			}
			closedir($handle);
			switch($_GET['purpose']) {
				case 'load': $html = '<select id="loadCategory" onchange="ajaxGet(\'svg.php?id=getLibraryFiles&category=\' + document.getElementById(\'loadCategory\').value, \'libraryFiles\');">'; break;
				case 'save': $html = '<select id="loadCategory" name="loadCategory" onchange="checkSaveToLibrary();">'; break;
			}
			$html.= '<option disabled="disabled" selected="selected">choose category</options>';
			$html.= $options;
			$html.= '</select><br/>';
			echo $html;
			break;
		case 'getLibraryFiles':
			$handle = opendir('library/'.$_GET['category'].'/');
			$options = '';
			while ($file = readdir($handle))
			{ 
				$position = strpos($file, $psvgE);
				if (!in_array($file, array(".", "..")) && $position !== false)
				{
					$fileURL = 'library/'.$_GET['category'].'/'.$file;
					$svgFileURL = str_replace($psvgE,$svgE,$fileURL);
					
					//loadFileFromServer(\'library/\' + document.getElementById(\'loadCategory\').value + \'/\' +document.getElementById(\'loadFile\').value);
					$onclick = ''; 
					$options.= '<div class="libraryitem" onclick="loadFileFromServer(\''.$fileURL.'\');">';
					$options.= 	'<object data="'.$svgFileURL.'" type="image/svg+xml" width="100" height="100" onload="loadedSvgPreview(this);"></object>';
					//$options.= 	'<embed src="'.$svgFileURL.'" type="image/svg+xml" width="100" height="100" onload="loadedSvgPreview(this);" />';
					$options.= 	'<h3><a href="#">'.$file.'</a></h3>';
					$options.= 	'<p>...</p>';
					$options.= 	'<div class="clear"></div>';
					$options.= '</div>';
					//echo $options;
					//echo '<br/>';
				 }
			}
			closedir($handle);
			if ($options)
				$html = $options;
			else 
				$html = 'no files in this category';
			echo $html;
			break;
		case 'loadFile':
			echo file_get_contents($_GET['filename']);
			if (dirname($_GET['filename']) == 'temp') unlink($_GET['filename']);
			break;
		case 'uploadFile':
			switch($_GET['destination']) {
				case 'client':
					if ($_FILES['loadfile']) {
						$filename = 'temp/'.basename($_FILES['loadfile']['tmp_name']);
						if(@move_uploaded_file($_FILES['loadfile']['tmp_name'], $filename)) sleep(1);
						else $filename = '';
						echo '<script language="javascript" type="text/javascript">window.top.window.loadFileFromServer(\''.$filename.'\');</script>';
					}
					break;
				case 'server':
					$check = uniqid();
					file_put_contents('temp/'.$check.$psvgE, $_POST['uploadcode']);
					file_put_contents('temp/'.$check.$svgE, $_POST['svgcode']);
					$headers = 'MIME-Version: 1.0'. "\r\n";
					$headers .= 'Content-type: text/html; charset=iso-8859-1' . "\r\n";
					$headers .= 'From: parametric SVG library <svg@giplt.nl>' . "\r\n";
					$headers .= 'Reply-To: parametric SVG library <svg@giplt.nl>' . "\r\n";
					$email = $_POST['email'];
					$link = 'http://www.fablabamersfoort.nl/svgbeta/svg.php?id=addToLibrary&category='.$_POST['loadCategory'].'&filename='.$_POST['filename'].'&email='.$email.'&check='.$check;
					$message = 'Thank you for contribution your design! Please click the following link to confirm your upload<br/><a href="'.$link.'">'.$link.'</a>';
					if (mail($email, 'confim template upload \''.$_POST['filename'].'\'', '<html><body>'.$message.'</body></html>', $headers.'To: ' . $email . "\r\n")) $html = 'Upload successful. A confirmation message has been sent to your email address. Please click the link in that email to add your contribution to the template library.';
					else $html = 'Failed to send confirmation email to '.$email;
					echo '<script language="javascript" type="text/javascript">window.top.window.saveFileToServer(\''.$html.'\');</script>';
					break;
			}
			break;
		case 'downloadFile':
			header('Content-type: image/svg+xml');
			header('Content-Disposition: attachment; filename="'.$_POST['filename'].'"');
			echo $_POST['code'];
			break;
		case 'checkFileInCategory': // does it already exist? 
			$result = 'false';
			$handle = opendir('library/'.$_GET['category'].'/');
			while ($file = readdir($handle))
			{
				if(!in_array($file, array(".", "..")) && $file==$_GET['filename']) $result = 'true';
			} 
			closedir($handle);
			echo $result;
			break;
		case 'addToLibrary':
			$tempPSVGURL = 'temp/'.$_GET['check'].$psvgE;
			$tempSVGURL = 'temp/'.$_GET['check'].$svgE;
			$categoryURL = 'library/'.$_GET['category'].'/';
			if (copy($tempPSVGURL, $categoryURL.$_GET['filename'])) 
			{
				unlink($tempPSVGURL);
				$svgFileName = str_replace($psvgE,$svgE,$_GET['filename']);
				if(copy($tempSVGURL, $categoryURL.$svgFileName))
				{
					unlink($tempSVGURL);
					echo '<html><head><title>parametric SVG editor</title><meta http-equiv="refresh" content="0; url=http://www.fablabamersfoort.nl/svgbeta"></head><body>Thank you for your contribution!<br/>You will be directed to the parametric SVG editor in a few seconds...</body></html>';
				}
			}
			break;
	}
?>

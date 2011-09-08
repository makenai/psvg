<?php

$file = "data/contributors.csv";
$fileHandle = fopen($file, 'a+') or die("can't open file");

//$data = "Bobby Bopper\n";
//fwrite($fileHandle, $data);
//$data = "Tracy Tanner\n";
//fwrite($fileHandle, $data);

$contributor = array("Diana","diana@spullenmannen.nl");
fputcsv($fileHandle,$contributor);

fclose($fileHandle);

?>
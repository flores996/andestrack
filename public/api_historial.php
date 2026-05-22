<?php
$host = "localhost";
$user = "root";
$pass = "";
$db = "andestrack";

$conn = new mysqli($host, $user, $pass, $db);
if($conn->connect_error){
    die("Error: " . $conn->connect_error);
}

$placa = $_GET['placa'];
$sql = "SELECT lat, lng FROM historial WHERE placa='$placa' ORDER BY id ASC";
$result = $conn->query($sql);

$historial = [];
while($row = $result->fetch_assoc()){
    $historial[] = [floatval($row['lat']), floatval($row['lng'])];
}

echo json_encode($historial);
$conn->close();
?>
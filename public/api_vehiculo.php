<?php
$host = "localhost";
$user = "root";
$pass = ""; // Si tu MySQL tiene contraseña, ponla aquí
$db = "andestrack";

$conn = new mysqli($host, $user, $pass, $db);
if($conn->connect_error){
    die("Error: " . $conn->connect_error);
}

// Obtenemos la última posición de un vehículo
$placa = $_GET['placa']; // recibimos la placa por URL
$sql = "SELECT * FROM historial WHERE placa='$placa' ORDER BY id DESC LIMIT 1";
$result = $conn->query($sql);

if($result->num_rows > 0){
    $row = $result->fetch_assoc();
    echo json_encode($row);
}else{
    echo json_encode(["error" => "No se encontró el vehículo"]);
}

$conn->close();
?>
/*
  Arduino Nano 33 BLE Sense - Sensor Data Reader
  
  Este código lee los sensores integrados del Arduino Nano 33 BLE Sense y 
  envía los datos vía Serial al Raspberry Pi en formato JSON.
  
  Sensores incluidos:
  - HTS221: Temperatura y Humedad
  - LPS22HB: Presión barométrica
  - LSM9DS1: Acelerómetro y Giroscopio
  
  Dependencias:
  - Arduino_HTS221
  - Arduino_LPS22HB
  - Arduino_LSM9DS1
  
  Instalación de librerías:
  1. Ir a Herramientas -> Administrar Bibliotecas
  2. Buscar e instalar: Arduino_HTS221, Arduino_LPS22HB, Arduino_LSM9DS1
  
  Conexión:
  - Conectar Arduino Nano 33 BLE Sense al Raspberry Pi vía USB
  - El puerto serial aparecerá como /dev/ttyUSB0 o /dev/ttyACM0
  
  Autor: Tu nombre
  Fecha: Octubre 2025
*/

#include <Arduino_HTS221.h>  // Temperatura y Humedad
#include <Arduino_LPS22HB.h> // Presión
#include <Arduino_LSM9DS1.h> // Acelerómetro y Giroscopio

// Variables para almacenar datos de sensores
float temperature = 0;
float humidity = 0;
float pressure = 0;
float ax = 0, ay = 0, az = 0;  // Aceleración
float gx = 0, gy = 0, gz = 0;  // Giroscopio

// Intervalo de envío de datos (ms)
const unsigned long SEND_INTERVAL = 2000; // 2 segundos
unsigned long lastSendTime = 0;

// LED integrado para indicar estado
const int LED_PIN = LED_BUILTIN;
bool ledState = false;

void setup() {
  // Inicializar comunicación serial
  Serial.begin(9600);
  while (!Serial); // Esperar a que se abra el puerto serial
  
  // Configurar LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Encender LED durante inicialización
  
  Serial.println("Iniciando Arduino Nano 33 BLE Sense...");
  
  // Inicializar sensores
  bool allSensorsOK = true;
  
  // Inicializar sensor de temperatura y humedad
  if (!HTS.begin()) {
    Serial.println("Error: No se pudo inicializar el sensor HTS221!");
    allSensorsOK = false;
  } else {
    Serial.println("Sensor HTS221 (Temp/Hum) inicializado correctamente");
  }
  
  // Inicializar sensor de presión
  if (!BARO.begin()) {
    Serial.println("Error: No se pudo inicializar el sensor LPS22HB!");
    allSensorsOK = false;
  } else {
    Serial.println("Sensor LPS22HB (Presión) inicializado correctamente");
  }
  
  // Inicializar acelerómetro y giroscopio
  if (!IMU.begin()) {
    Serial.println("Error: No se pudo inicializar el sensor LSM9DS1!");
    allSensorsOK = false;
  } else {
    Serial.println("Sensor LSM9DS1 (IMU) inicializado correctamente");
  }
  
  if (allSensorsOK) {
    Serial.println("Todos los sensores inicializados correctamente");
    digitalWrite(LED_PIN, LOW); // Apagar LED - todo OK
  } else {
    Serial.println("Algunos sensores fallaron al inicializar");
    // Parpadear LED para indicar error
    for (int i = 0; i < 10; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }
  
  delay(1000);
  Serial.println("Iniciando transmisión de datos...");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Verificar si es tiempo de enviar datos
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    
    // Leer datos de los sensores
    readSensorData();
    
    // Enviar datos en formato JSON
    sendSensorDataJSON();
    
    // Actualizar tiempo de último envío
    lastSendTime = currentTime;
    
    // Parpadear LED para indicar transmisión
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
  }
  
  delay(10); // Pequeña pausa para estabilidad
}

void readSensorData() {
  // Leer temperatura y humedad
  temperature = HTS.readTemperature();
  humidity = HTS.readHumidity();
  
  // Leer presión
  pressure = BARO.readPressure();
  
  // Leer acelerómetro
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);
  }
  
  // Leer giroscopio
  if (IMU.gyroscopeAvailable()) {
    IMU.readGyroscope(gx, gy, gz);
  }
}

void sendSensorDataJSON() {
  // Crear JSON con los datos del sensor
  Serial.print("{");
  
  // Datos ambientales
  Serial.print("\"temperature\":");
  Serial.print(temperature, 2);
  Serial.print(",\"humidity\":");
  Serial.print(humidity, 2);
  Serial.print(",\"pressure\":");
  Serial.print(pressure, 2);
  
  // Datos del acelerómetro
  Serial.print(",\"acceleration\":{");
  Serial.print("\"x\":");
  Serial.print(ax, 3);
  Serial.print(",\"y\":");
  Serial.print(ay, 3);
  Serial.print(",\"z\":");
  Serial.print(az, 3);
  Serial.print("}");
  
  // Datos del giroscopio
  Serial.print(",\"gyroscope\":{");
  Serial.print("\"x\":");
  Serial.print(gx, 3);
  Serial.print(",\"y\":");
  Serial.print(gy, 3);
  Serial.print(",\"z\":");
  Serial.print(gz, 3);
  Serial.print("}");
  
  // Timestamp local (millis desde inicio)
  Serial.print(",\"arduino_millis\":");
  Serial.print(millis());
  
  Serial.println("}");
}

void sendSensorDataSimple() {
  // Formato alternativo más simple (comentado por defecto)
  /*
  Serial.print("temp:");
  Serial.print(temperature, 2);
  Serial.print(",hum:");
  Serial.print(humidity, 2);
  Serial.print(",press:");
  Serial.print(pressure, 2);
  Serial.print(",acc_x:");
  Serial.print(ax, 3);
  Serial.print(",acc_y:");
  Serial.print(ay, 3);
  Serial.print(",acc_z:");
  Serial.print(az, 3);
  Serial.print(",gyro_x:");
  Serial.print(gx, 3);
  Serial.print(",gyro_y:");
  Serial.print(gy, 3);
  Serial.print(",gyro_z:");
  Serial.print(gz, 3);
  Serial.println();
  */
}

// Función para debugging - mostrar datos en formato legible
void printSensorDataDebug() {
  Serial.println("=== DATOS SENSORES ===");
  Serial.print("Temperatura: ");
  Serial.print(temperature);
  Serial.println(" °C");
  
  Serial.print("Humedad: ");
  Serial.print(humidity);
  Serial.println(" %");
  
  Serial.print("Presión: ");
  Serial.print(pressure);
  Serial.println(" kPa");
  
  Serial.print("Aceleración (g): X=");
  Serial.print(ax);
  Serial.print(", Y=");
  Serial.print(ay);
  Serial.print(", Z=");
  Serial.println(az);
  
  Serial.print("Giroscopio (°/s): X=");
  Serial.print(gx);
  Serial.print(", Y=");
  Serial.print(gy);
  Serial.print(", Z=");
  Serial.println(gz);
  
  Serial.println("======================");
}
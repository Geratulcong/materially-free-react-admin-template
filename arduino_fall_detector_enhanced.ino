/*
  Arduino Nano 33 BLE Sense - Detector de Caídas Mejorado
  
  Este código detecta caídas usando el acelerómetro integrado y envía alertas
  vía BLE al Raspberry Pi. También incluye datos adicionales del sensor.
  
  Sensores incluidos:
  - LSM9DS1: Acelerómetro y Giroscopio para detección de caídas
  - HTS221: Temperatura y Humedad (opcional)
  - LPS22HB: Presión barométrica (opcional)
  
  Características:
  - Detección de caída con umbral configurable
  - Envío de datos de contexto con cada alerta
  - Indicadores LED de estado
  - Monitoreo continuo de sensores
  - Protocolo BLE optimizado
  
  Dependencias:
  - ArduinoBLE
  - Arduino_LSM9DS1
  - Arduino_HTS221 (opcional)
  - Arduino_LPS22HB (opcional)
  
  Autor: Tu nombre
  Fecha: Octubre 2025
*/

#include <ArduinoBLE.h>
#include <Arduino_LSM9DS1.h>
#include <Arduino_HTS221.h>  // Opcional
#include <Arduino_LPS22HB.h> // Opcional

// Configuración BLE
BLEService uartService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic txChar(
  "6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
  BLENotify, 
  200  // Aumentamos el tamaño para mensajes más largos
);

// Configuración de detección de caídas
const float FALL_THRESHOLD = 2.5;    // Umbral de caída (ajustar según pruebas)
const float HIGH_IMPACT_THRESHOLD = 3.5;  // Umbral de impacto alto
const unsigned long FALL_COOLDOWN = 3000; // Tiempo entre detecciones (ms)
const int SAMPLES_FOR_BASELINE = 50;      // Muestras para calcular línea base

// Variables para detección de caídas
unsigned long lastFallTime = 0;
float accelBaseline = 1.0;  // Línea base de aceleración (aproximadamente 1g)
int fallCount = 0;
bool systemActive = true;

// Variables para datos de sensores
float ax = 0, ay = 0, az = 0;  // Aceleración
float gx = 0, gy = 0, gz = 0;  // Giroscopio
float temperature = 0;         // Temperatura (opcional)
float humidity = 0;            // Humedad (opcional)
float pressure = 0;            // Presión (opcional)

// Configuración de envío de datos
const unsigned long DATA_SEND_INTERVAL = 5000; // Enviar datos cada 5 segundos
unsigned long lastDataSend = 0;

// LED y estado
const int LED_PIN = LED_BUILTIN;
bool ledState = false;
unsigned long lastLedBlink = 0;
const unsigned long LED_BLINK_INTERVAL = 1000;

// Configuración de sensores opcionales
bool hasEnvironmentalSensors = false;

void setup() {
  Serial.begin(9600);
  
  // Configurar LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Encender durante inicialización
  
  Serial.println("Iniciando Detector de Caídas BLE...");
  
  // Inicializar BLE
  if (!BLE.begin()) {
    Serial.println("Error: No se pudo inicializar BLE");
    errorBlink();
    while (1);
  }
  Serial.println("BLE inicializado correctamente");
  
  // Inicializar IMU (acelerómetro/giroscopio)
  if (!IMU.begin()) {
    Serial.println("Error: No se pudo inicializar IMU");
    errorBlink();
    while (1);
  }
  Serial.println("IMU inicializado correctamente");
  
  // Intentar inicializar sensores ambientales (opcional)
  bool hts_ok = HTS.begin();
  bool baro_ok = BARO.begin();
  
  if (hts_ok && baro_ok) {
    hasEnvironmentalSensors = true;
    Serial.println("Sensores ambientales inicializados");
  } else {
    Serial.println("Sensores ambientales no disponibles (modo básico)");
  }
  
  // Configurar servicio BLE
  uartService.addCharacteristic(txChar);
  BLE.setLocalName("Nano33BLE-FallDetector");
  BLE.setAdvertisedService(uartService);
  BLE.addService(uartService);
  
  // Mensaje inicial
  txChar.writeValue("INIT");
  
  BLE.advertise();
  Serial.println("Esperando conexión BLE...");
  Serial.println("Dispositivo: Nano33BLE-FallDetector");
  
  // Calcular línea base de aceleración
  calculateBaseline();
  
  digitalWrite(LED_PIN, LOW); // Apagar LED - inicialización completa
  Serial.println("Sistema listo para detectar caídas");
}

void loop() {
  // Manejar conexiones BLE
  BLEDevice central = BLE.central();
  
  if (central) {
    Serial.print("Dispositivo conectado: ");
    Serial.println(central.address());
    
    // Enviar confirmación de conexión
    sendMessage("CONNECTED");
    
    // Mientras esté conectado
    while (central.connected()) {
      unsigned long currentTime = millis();
      
      // Leer datos de sensores
      readSensorData();
      
      // Detectar caídas
      checkForFall(currentTime);
      
      // Enviar datos periódicos
      if (currentTime - lastDataSend >= DATA_SEND_INTERVAL) {
        sendPeriodicData();
        lastDataSend = currentTime;
      }
      
      // Actualizar LED de estado
      updateStatusLED(currentTime);
      
      delay(50); // Pausa pequeña para estabilidad
    }
    
    Serial.print("Dispositivo desconectado: ");
    Serial.println(central.address());
  }
  
  // Parpadear LED cuando no hay conexión
  unsigned long currentTime = millis();
  if (currentTime - lastLedBlink >= LED_BLINK_INTERVAL * 2) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastLedBlink = currentTime;
  }
}

void calculateBaseline() {
  Serial.println("Calculando línea base de aceleración...");
  float sum = 0;
  int validSamples = 0;
  
  for (int i = 0; i < SAMPLES_FOR_BASELINE; i++) {
    if (IMU.accelerationAvailable()) {
      float ax, ay, az;
      IMU.readAcceleration(ax, ay, az);
      float magnitude = sqrt(ax*ax + ay*ay + az*az);
      sum += magnitude;
      validSamples++;
    }
    delay(20);
  }
  
  if (validSamples > 0) {
    accelBaseline = sum / validSamples;
    Serial.print("Línea base calculada: ");
    Serial.println(accelBaseline);
  } else {
    Serial.println("Advertencia: No se pudo calcular línea base");
    accelBaseline = 1.0; // Valor por defecto
  }
}

void readSensorData() {
  // Leer acelerómetro y giroscopio
  if (IMU.accelerationAvailable()) {
    IMU.readAcceleration(ax, ay, az);
  }
  
  if (IMU.gyroscopeAvailable()) {
    IMU.readGyroscope(gx, gy, gz);
  }
  
  // Leer sensores ambientales si están disponibles
  if (hasEnvironmentalSensors) {
    temperature = HTS.readTemperature();
    humidity = HTS.readHumidity();
    pressure = BARO.readPressure();
  }
}

void checkForFall(unsigned long currentTime) {
  // Evitar detecciones múltiples muy seguidas
  if (currentTime - lastFallTime < FALL_COOLDOWN) {
    return;
  }
  
  // Calcular magnitud de aceleración
  float magnitude = sqrt(ax*ax + ay*ay + az*az);
  
  // Detectar caída
  bool fallDetected = false;
  String severity = "medium";
  
  if (magnitude > HIGH_IMPACT_THRESHOLD) {
    fallDetected = true;
    severity = "high";
  } else if (magnitude > FALL_THRESHOLD) {
    fallDetected = true;
    severity = "medium";
  }
  
  if (fallDetected) {
    fallCount++;
    lastFallTime = currentTime;
    
    Serial.println("¡CAÍDA DETECTADA!");
    Serial.print("Magnitud: ");
    Serial.println(magnitude);
    Serial.print("Severidad: ");
    Serial.println(severity);
    
    // Enviar alerta detallada
    sendFallAlert(magnitude, severity);
    
    // Parpadear LED rápidamente para indicar detección
    for (int i = 0; i < 6; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }
}

void sendFallAlert(float magnitude, String severity) {
  // Crear mensaje JSON compacto para alerta de caída
  String message = "{";
  message += "\"t\":\"FALL\","; // type abreviado
  message += "\"ts\":" + String(millis()) + ","; // timestamp
  message += "\"fc\":" + String(fallCount) + ","; // fall_count
  message += "\"sev\":\"" + severity + "\","; // severity
  message += "\"mag\":" + String(magnitude, 2) + ","; // magnitude
  message += "\"acc\":[" + String(ax, 2) + "," + String(ay, 2) + "," + String(az, 2) + "]"; // acceleration array
  
  if (hasEnvironmentalSensors) {
    message += ",\"env\":[" + String(temperature, 1) + "," + String(humidity, 1) + "," + String(pressure, 1) + "]"; // environment array [temp, hum, press]
  }
  
  message += "}";
  
  sendMessage(message);
  
  // También enviar mensaje simple para compatibilidad
  sendMessage("CAIDA");
}

void sendPeriodicData() {
  // Crear mensaje de estado compacto
  String message = "{";
  message += "\"t\":\"STATUS\","; // type
  message += "\"ts\":" + String(millis()) + ","; // timestamp
  message += "\"sa\":" + String(systemActive ? 1 : 0) + ","; // system_active (1/0 más corto que true/false)
  message += "\"fc\":" + String(fallCount) + ","; // fall_count
  message += "\"bl\":" + String(accelBaseline, 2) + ","; // baseline
  message += "\"ca\":" + String(sqrt(ax*ax + ay*ay + az*az), 2); // current_accel
  
  if (hasEnvironmentalSensors) {
    message += ",\"env\":[" + String(temperature, 1) + "," + String(humidity, 1) + "," + String(pressure, 1) + "]"; // environment array
  }
  
  message += "}";
  
  sendMessage(message);
}

void sendMessage(String message) {
  if (message.length() <= 200) {
    txChar.writeValue(message.c_str());
    Serial.print("Enviado: ");
    Serial.println(message);
  } else {
    // Si el mensaje es muy largo, enviarlo en partes
    Serial.println("Advertencia: Mensaje muy largo, truncando");
    String truncated = message.substring(0, 195) + "...}";
    txChar.writeValue(truncated.c_str());
    Serial.print("Enviado (truncado): ");
    Serial.println(truncated);
  }
}

void updateStatusLED(unsigned long currentTime) {
  // Parpadear LED lentamente cuando está conectado y activo
  if (currentTime - lastLedBlink >= LED_BLINK_INTERVAL) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastLedBlink = currentTime;
  }
}

void errorBlink() {
  // Parpadear LED rápidamente para indicar error
  for (int i = 0; i < 20; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}

// Función para debugging
void printSensorData() {
  Serial.println("=== DATOS SENSORES ===");
  Serial.print("Aceleración: X=");
  Serial.print(ax, 3);
  Serial.print(", Y=");
  Serial.print(ay, 3);
  Serial.print(", Z=");
  Serial.print(az, 3);
  Serial.print(", Mag=");
  Serial.println(sqrt(ax*ax + ay*ay + az*az), 3);
  
  Serial.print("Giroscopio: X=");
  Serial.print(gx, 3);
  Serial.print(", Y=");
  Serial.print(gy, 3);
  Serial.print(", Z=");
  Serial.println(gz, 3);
  
  if (hasEnvironmentalSensors) {
    Serial.print("Temperatura: ");
    Serial.print(temperature);
    Serial.println(" °C");
    
    Serial.print("Humedad: ");
    Serial.print(humidity);
    Serial.println(" %");
    
    Serial.print("Presión: ");
    Serial.print(pressure);
    Serial.println(" kPa");
  }
  
  Serial.print("Caídas detectadas: ");
  Serial.println(fallCount);
  Serial.println("======================");
}
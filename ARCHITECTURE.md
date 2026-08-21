# System Architecture: Smart IoT-Based Industrial Equipment Monitoring & Fault Detection System

## 1. Abstract
Modern industrial automation relies heavily on **Predictive Maintenance (PdM)** and **Condition-Based Monitoring (CBM)** to minimize catastrophic downtime, reduce maintenance overheads, and guarantee worker safety. This project implements an end-to-end **Industrial Internet of Things (IIoT)** framework for continuous health tracking, vibration spectrum classification (ISO 10816-3 standard), thermal runaway prevention, and automated SCADA alarm dispatching.

---

## 2. Four-Layer IoT Architectural Framework

In standard Electronics and Telecommunication Engineering (ENTC) paradigms, this system is divided into four distinct abstraction layers:

```
+-------------------------------------------------------------------------+
|                       1. PERCEPTION / SENSING LAYER                     |
|  • Virtual ESP32 Node (Dual-core 32-bit Xtensa FreeRTOS simulation)     |
|  • PT100 RTD Temperature Sensor (First-order thermal inertia model)     |
|  • MPU6050 3-Axis Accelerometer (RMS Velocity & harmonic vibration)    |
|  • SCT-013-000 Non-invasive AC Current Transformer (Amperage draw)     |
|  • Optical Tachometer (Rotational shaft RPM feedback)                   |
+-------------------------------------------------------------------------+
                                     |
                                     v (JSON Telemetry Frame over WebSockets)
+-------------------------------------------------------------------------+
|                       2. NETWORK & TRANSPORT LAYER                      |
|  • Full-Duplex WebSockets / Simulated MQTT Broker (TCP Port 1883/8080)   |
|  • Asynchronous event-driven publish-subscribe model                    |
|  • 2.0 Hz high-fidelity sampling frequency (500 ms cycle time)          |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  3. EDGE PROCESSING & ANALYTICS LAYER                   |
|  • ISO 10816-3 Vibration Severity Evaluator (Zones A, B, C, D)          |
|  • Thermal Derivative Anomaly Detector (dT/dt rate of rise monitoring)  |
|  • Tri-State Machine Status Classifier: NORMAL | WARNING | CRITICAL     |
|  • Dynamic Health Index (0-100%) & MTBF / Uptime Calculator             |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                 4. APPLICATION / SCADA DASHBOARD LAYER                  |
|  • Dark-Mode Glassmorphism SCADA / HMI Web Dashboard (60 FPS Canvas)    |
|  • Real-Time Oscilloscope & Waveform Spectrogram                        |
|  • Audio-Visual Alarm Matrix (Web Audio API Synthesized Siren)          |
|  • Time-Series Historical Logger with One-Click CSV Export              |
|  • Interactive Fault Injection Simulation Suite                         |
+-------------------------------------------------------------------------+
```

---

## 3. Physical Hardware to Software Simulation Mapping

For academic demonstration and viva examinations, here is how physical components correspond to the software simulation engine:

| Physical Industrial Component | Simulated Software Equivalent | Operating Parameters |
| :--- | :--- | :--- |
| **ESP32-WROOM-32 Microcontroller** | `VirtualESP32` JavaScript Engine | Dual-core 240 MHz clock, FreeRTOS task loop @ 2 Hz |
| **PT100 RTD / DHT22 Temp Sensor** | Thermal differential physics model | Ambient 27.5°C, Normal 42-65°C, Warn >75°C, Crit >88°C |
| **MPU6050 / ADXL345 Accelerometer** | ISO 10816-3 RMS & Waveform Engine | Baseline 1.45 mm/s, Bearing defect >4.5, Unbalance >7.1 |
| **SCT-013-000 Current Sensor** | AC Power equation engine | $P = \sqrt{3} \cdot V \cdot I \cdot \cos\phi$ (7.5 kW motor) |
| **Physical Alarm Buzzer** | Web Audio API Oscillator | Dual-tone siren (440 Hz / 880 Hz) & warning chime |
| **Industrial SCADA Screen** | HTML5 / Canvas Modern Dashboard | 60 FPS responsive dark-mode monitoring center |

---

## 4. Telemetry Data Serialization Protocol
Each telemetry packet emitted by the virtual node adheres to strict industrial JSON payloads:

```json
{
  "metadata": {
    "deviceId": "ESP32-IND-NODE-01",
    "chipModel": "ESP32-WROOM-32D",
    "macAddress": "24:6F:28:B4:8E:1A",
    "wifiRSSI": "-58 dBm",
    "uptime": 142,
    "timestamp": "2026-08-21T23:50:00.000Z"
  },
  "sensors": {
    "temperature": { "value": 45.8, "unit": "°C", "status": "NORMAL" },
    "vibration": {
      "rms": 1.45,
      "peak": 2.10,
      "frequencyHz": 24.1,
      "status": "NORMAL",
      "waveform": [0.12, -0.45, 1.2, 0.8, -1.1]
    },
    "electrical": {
      "current": 11.4,
      "voltage": 415.2,
      "powerKW": 6.92,
      "powerFactor": 0.86,
      "rpm": 1448
    }
  },
  "diagnostics": {
    "operationalMode": "RUNNING",
    "healthScore": 98.5,
    "activeFaults": []
  }
}
```

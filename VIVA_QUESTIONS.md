# Engineering Project Viva: Comprehensive Q&A Guide

Use this guide to prepare for your final-year project defense, external viva, and technical review.

---

### Q1: What is the main objective of your project?
**Answer:** The objective of this project is to implement an end-to-end **Smart Industrial IoT Monitoring and Fault Detection System** for predictive condition monitoring of heavy rotating machinery (e.g., 3-phase induction motors). The system continuously monitors thermal, vibrational, and electrical parameters, evaluates them against international standards like **ISO 10816-3**, and triggers multi-tier alarms to prevent costly industrial breakdowns.

---

### Q2: Why did you use a software simulation instead of physical hardware?
**Answer:** 
1. **Safety & High-Risk Fault Testing:** In real factories, intentionally causing severe bearing destruction, stator overheating (>100°C), or mechanical unbalance on a 7.5 kW machine can cause catastrophic physical injury and fire hazards. Simulation allows high-stress edge case validation safely.
2. **Deterministic Mathematical Modeling:** The virtual ESP32 engine accurately simulates physical differential thermal inertia, white noise, and harmonic vibration frequencies based on real mathematical equations.
3. **High Scalability & Zero Hardware Bottleneck:** It allows rapid deployment, testing, and multi-node telemetry stream analysis without hardware component lead times.

---

### Q3: How is the IoT 4-layer architecture implemented here?
**Answer:**
1. **Perception/Sensing Layer:** The `VirtualESP32` engine simulates PT100 RTD temperature sensors, MPU6050 3-axis vibration sensors, and SCT-013-000 current sensors with ADC quantization noise.
2. **Network/Transport Layer:** Real-time bi-directional streaming protocols (WebSockets/MQTT packet format) transporting structured JSON telemetry.
3. **Processing Layer:** Anomaly detection algorithms evaluating ISO 10816-3 vibration limits, thermal rate-of-rise ($dT/dt$), and machine health index.
4. **Application/SCADA Layer:** A web-based SCADA/HMI dashboard displaying real-time 60 FPS Canvas oscilloscopes, trend charts, acoustic sirens, and time-series historical data.

---

### Q4: What is ISO 10816-3, and how is it used in your project?
**Answer:** **ISO 10816-3** is the international engineering standard for evaluating mechanical vibration severity in industrial rotating machinery. It categorizes vibration velocity RMS into 4 operational zones:
- **Zone A ($< 1.8\text{ mm/s}$):** Good condition (newly commissioned).
- **Zone B ($1.8 - 2.8\text{ mm/s}$):** Acceptable for continuous long-term operation.
- **Zone C ($4.5 - 7.1\text{ mm/s}$):** Warning state; maintenance required within 48 hours.
- **Zone D ($> 7.1\text{ mm/s}$):** Critical hazard; causes immediate bearing or shaft damage.

Our anomaly engine uses these exact thresholds to classify vibration levels and trigger acoustic warnings.

---

### Q5: How does your system detect thermal anomalies?
**Answer:** Thermal anomalies are detected using two metrics:
1. **Absolute Thresholds:** Warning threshold at $75^\circ\text{C}$ and Critical threshold at $88^\circ\text{C}$ (based on NEMA Class F insulation limits).
2. **Thermal Derivative ($dT/dt$):** If temperature rises faster than $0.8^\circ\text{C}/\text{second}$, the system flags a sudden cooling fan blockage or severe mechanical friction before high temperatures are reached.

---

### Q6: What happens when you inject a "Bearing Defect" fault during the demo?
**Answer:**
1. High-frequency micro-impact spikes appear on the time-domain oscilloscope.
2. The RMS vibration rises past $4.5\text{ mm/s}$ into ISO Zone C/D.
3. The dashboard status updates to **WARNING / CRITICAL**.
4. The Web Audio API synthesizes a two-tone SCADA warning siren.
5. The alert matrix provides an actionable prescription: *"Re-grease bearings or replace bearing assembly within 48 hours."*

---

### Q7: How does your system compute the Equipment Health Score?
**Answer:** The Health Score is a composite percentage (0-100%) calculated dynamically using weighted penalty factors based on deviations from nominal baseline parameters (temperature above $50^\circ\text{C}$, vibration RMS above $2.5\text{ mm/s}$, and voltage sag deviations).

---

### Q8: How can this system be connected to physical hardware in the future?
**Answer:** The architecture is designed to be **hardware-agnostic**. To deploy on physical hardware:
1. Flash an actual ESP32 microcontroller with FreeRTOS and connect physical PT100 (via MAX31865 amplifier) and MPU6050 (via I2C).
2. Direct the ESP32's MQTT/WebSocket client to publish JSON payloads using the exact data schema established in our project.
3. The dashboard and anomaly engine will process physical telemetry with zero modifications!

---

### Q9: What are the Key Performance Indicators (KPIs) shown on the dashboard?
**Answer:**
1. **Equipment Health Score (%):** Overall asset condition index.
2. **Availability / Uptime (%):** Ratio of normal operational cycles to total cycles.
3. **Estimated MTBF (Hours):** Mean Time Between Failures computed from fault event frequency.
4. **Active Faults & Anomalies Logged:** Historical counter of all threshold violations.

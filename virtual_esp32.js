/**
 * ==============================================================================
 * VIRTUAL ESP32 SENSOR NODE & INDUSTRIAL PHYSICS ENGINE
 * ==============================================================================
 * Simulates a 32-bit Dual-Core ESP32 Microcontroller running FreeRTOS with:
 *  - Sensor 1: PT100 RTD Temperature Sensor with thermal inertia & convection
 *  - Sensor 2: MPU6050 3-Axis Accelerometer / Vibration Sensor (ISO 10816-3 RMS)
 *  - Sensor 3: Current CT Sensor (SCT-013-000) measuring Motor Load Amperage
 *  - Sensor 4: Optical Tachometer (RPM speed sensor)
 *  - Synthetic ADC Quantization Noise, Drift, and Fault Injections
 * ==============================================================================
 */

class VirtualESP32 {
    constructor() {
        // Hardware simulation parameters (ESP32 specs)
        this.chipModel = "ESP32-WROOM-32D";
        this.clockSpeedMHz = 240;
        this.firmwareVersion = "v2.4.1-IIoT-FreeRTOS";
        this.macAddress = "24:6F:28:B4:8E:1A";
        this.wifiSSID = "Factory_IIoT_Mesh_5G";
        this.wifiSignalRSSI = -58; // dBm
        this.uptimeSeconds = 0;
        this.sampleRateHz = 2; // 2 readings per second (500ms cycle)
        this.isRunning = true;

        // Physical machine parameters (Three-Phase Induction Motor 7.5 kW)
        this.ratedPowerKW = 7.5;
        this.ratedRPM = 1450;
        this.ambientTemp = 27.5; // °C
        this.motorThermalConstant = 120.0; // Seconds for thermal rise/fall

        // Current simulated physical state
        this.state = {
            rpm: 1445,
            temperature: 42.0, // °C
            vibrationRMS: 1.45, // mm/s RMS (ISO 10816-3 Class II standard)
            vibrationPeak: 2.10, // mm/s Peak
            vibrationFrequencyHz: 24.1, // 1X rotational frequency (1445 / 60)
            currentAmps: 11.2, // A
            voltageVolts: 415.0, // 3-phase Line-to-Line V
            powerFactor: 0.86,
            powerKW: 6.88,
            healthScore: 98.5, // 0 - 100%
            operationalMode: "RUNNING", // RUNNING, IDLE, STRESSED, FAULT, STOPPED
            activeFaults: []
        };

        // Active fault injection states
        this.faults = {
            overheat: false,
            bearingDefect: false,
            mechanicalUnbalance: false,
            coolingFanFailure: false,
            voltageSag: false,
            emergencyStop: false
        };

        // Telemetry history for rolling waveform generation
        this.vibrationWaveformBuffer = [];
        this.temperatureBuffer = [];
        this.historySize = 40;

        // Telemetry listeners (Subscribers)
        this.listeners = [];

        // Internal ticker
        this.timer = null;
        this.init();
    }

    init() {
        // Pre-fill initial waveform buffer
        for (let i = 0; i < this.historySize; i++) {
            this.vibrationWaveformBuffer.push(0);
        }
        this.startTelemetryLoop();
    }

    startTelemetryLoop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.isRunning) {
                this.uptimeSeconds += (1 / this.sampleRateHz);
                this.computePhysicsStep();
                this.broadcastTelemetry();
            }
        }, 1000 / this.sampleRateHz);
    }

    stopTelemetryLoop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    // Set interactive fault simulation mode
    setFault(faultName, isActive) {
        if (this.faults.hasOwnProperty(faultName)) {
            this.faults[faultName] = isActive;
        }
    }

    clearAllFaults() {
        for (let key in this.faults) {
            this.faults[key] = false;
        }
    }

    // Physical simulation calculations using mathematical models
    computePhysicsStep() {
        const dt = 1 / this.sampleRateHz;

        // 1. Emergency Stop overrides everything
        if (this.faults.emergencyStop) {
            this.state.operationalMode = "STOPPED";
            this.state.rpm = Math.max(0, this.state.rpm - 150 * dt);
            this.state.currentAmps = 0.0;
            this.state.powerKW = 0.0;
            this.state.vibrationRMS = Math.max(0.05, this.state.vibrationRMS * 0.85);
            this.state.vibrationPeak = this.state.vibrationRMS * 1.414;
            // Cool down slowly towards ambient
            this.state.temperature = Math.max(
                this.ambientTemp,
                this.state.temperature - ((this.state.temperature - this.ambientTemp) / this.motorThermalConstant) * dt * 2
            );
            this.state.activeFaults = ["EMERGENCY_STOP_ENGAGED"];
            return;
        }

        let targetTemp = 52.0; // Normal equilibrium running temp
        let targetVibRMS = 1.35; // Normal baseline vibration
        let targetCurrent = 11.5; // Normal 7.5kW motor current
        let targetRPM = 1450;
        let activeFaultsList = [];

        // 2. Cooling Fan Failure Fault
        if (this.faults.coolingFanFailure) {
            targetTemp += 48.0; // Can reach up to 100°C
            activeFaultsList.push("COOLING_SYSTEM_FAILURE");
        }

        // 3. Overheating / Electrical Overload Fault
        if (this.faults.overheat) {
            targetTemp += 42.0;
            targetCurrent += 7.5; // High draw
            activeFaultsList.push("STATOR_OVERHEATING_WARNING");
        }

        // 4. Bearing Defect (Outer/Inner Race Flaw)
        if (this.faults.bearingDefect) {
            targetVibRMS += 5.2; // Exceeds ISO 10816-3 Warning Threshold (4.5 mm/s)
            targetTemp += 12.0; // Friction causes temperature rise
            activeFaultsList.push("BEARING_MICRO_CRACK_DETECTED");
        }

        // 5. Mechanical Unbalance / Shaft Misalignment
        if (this.faults.mechanicalUnbalance) {
            targetVibRMS += 6.8; // Exceeds ISO 10816-3 Critical Threshold (7.1 mm/s)
            targetRPM -= 45; // Friction drags RPM
            activeFaultsList.push("ROTOR_MECHANICAL_UNBALANCE");
        }

        // 6. Voltage Sag / Low Grid Voltage
        if (this.faults.voltageSag) {
            this.state.voltageVolts = 345.0; // Normal is 415V
            targetCurrent += 4.5; // Motor draws more current to maintain torque
            activeFaultsList.push("GRID_VOLTAGE_SAG");
        } else {
            // Normal fluctuation
            this.state.voltageVolts = 415.0 + (Math.sin(this.uptimeSeconds * 0.4) * 3.5);
        }

        // --- Realistic Physics Smooth Convergence (Differential Equations) ---
        
        // Temperature first-order thermal inertia: dT/dt = (T_target - T) / tau
        const tempTau = this.faults.coolingFanFailure ? 35.0 : 70.0;
        const tempNoise = (Math.random() - 0.5) * 0.25;
        this.state.temperature += ((targetTemp - this.state.temperature) / tempTau) * dt + tempNoise;

        // Vibration RMS convergence + white noise
        const vibNoise = (Math.random() - 0.5) * 0.15;
        this.state.vibrationRMS += ((targetVibRMS - this.state.vibrationRMS) / 4.0) * dt + vibNoise;
        this.state.vibrationRMS = Math.max(0.2, this.state.vibrationRMS);
        
        // Peak vibration calculation (Crest factor typically 1.414 to 2.8)
        const crestFactor = this.faults.bearingDefect ? 2.4 : 1.55;
        this.state.vibrationPeak = this.state.vibrationRMS * crestFactor + (Math.random() * 0.2);

        // RPM fluctuations
        const rpmNoise = (Math.random() - 0.5) * 4.0;
        this.state.rpm += ((targetRPM - this.state.rpm) / 3.0) * dt + rpmNoise;

        // Current & Power Calculations (P = √3 * V * I * PF)
        const currentNoise = (Math.random() - 0.5) * 0.18;
        this.state.currentAmps += ((targetCurrent - this.state.currentAmps) / 2.0) * dt + currentNoise;
        this.state.powerFactor = 0.84 + (Math.sin(this.uptimeSeconds * 0.1) * 0.02);
        this.state.powerKW = (Math.sqrt(3) * this.state.voltageVolts * this.state.currentAmps * this.state.powerFactor) / 1000;

        // Fundamental Rotational Frequency (Hz)
        this.state.vibrationFrequencyHz = this.state.rpm / 60;

        // Update active faults list
        this.state.activeFaults = activeFaultsList;

        // Determine Operational State
        if (this.state.vibrationRMS > 7.1 || this.state.temperature > 85.0) {
            this.state.operationalMode = "CRITICAL";
        } else if (this.state.vibrationRMS > 4.5 || this.state.temperature > 72.0 || this.faults.voltageSag) {
            this.state.operationalMode = "WARNING";
        } else {
            this.state.operationalMode = "RUNNING";
        }

        // Calculate dynamic health score
        let penalty = 0;
        if (this.state.temperature > 50) penalty += (this.state.temperature - 50) * 1.2;
        if (this.state.vibrationRMS > 2.5) penalty += (this.state.vibrationRMS - 2.5) * 8.5;
        if (this.faults.voltageSag) penalty += 15;
        this.state.healthScore = Math.max(12.0, Math.min(100.0, 100.0 - penalty));

        // Generate dynamic instantaneous vibration waveform point (Time-domain signal)
        const t = this.uptimeSeconds * 2 * Math.PI;
        let wavePoint = Math.sin(t * this.state.vibrationFrequencyHz * 0.05) * this.state.vibrationRMS;
        if (this.faults.bearingDefect) {
            // High-frequency impact spikes (BPFO / BPFI bearing fault harmonics)
            wavePoint += Math.sin(t * 12.5) * 1.8 + (Math.random() > 0.8 ? (Math.random() * 3.5) : 0);
        }
        if (this.faults.mechanicalUnbalance) {
            // Strong 1X rotational unbalance wave
            wavePoint += Math.sin(t * 3.2) * 3.0;
        }

        this.vibrationWaveformBuffer.push(parseFloat(wavePoint.toFixed(3)));
        if (this.vibrationWaveformBuffer.length > this.historySize) {
            this.vibrationWaveformBuffer.shift();
        }
    }

    // Generate JSON packet formatted exactly like real ESP32 MQTT/JSON telemetry
    getTelemetryPacket() {
        return {
            metadata: {
                deviceId: "ESP32-IND-NODE-01",
                chipModel: this.chipModel,
                macAddress: this.macAddress,
                firmware: this.firmwareVersion,
                wifiRSSI: `${this.wifiSignalRSSI} dBm`,
                uptime: Math.floor(this.uptimeSeconds),
                timestamp: new Date().toISOString(),
                protocol: "WSS/MQTT-Simulated"
            },
            sensors: {
                temperature: {
                    value: parseFloat(this.state.temperature.toFixed(2)),
                    unit: "°C",
                    sensorType: "PT100 RTD Class A",
                    status: this.state.temperature > 85 ? "CRITICAL" : (this.state.temperature > 72 ? "WARNING" : "NORMAL")
                },
                vibration: {
                    rms: parseFloat(this.state.vibrationRMS.toFixed(2)),
                    peak: parseFloat(this.state.vibrationPeak.toFixed(2)),
                    frequencyHz: parseFloat(this.state.vibrationFrequencyHz.toFixed(1)),
                    unit: "mm/s",
                    sensorType: "MPU6050 3-Axis IMU (ISO 10816-3)",
                    status: this.state.vibrationRMS > 7.1 ? "CRITICAL" : (this.state.vibrationRMS > 4.5 ? "WARNING" : "NORMAL"),
                    waveform: [...this.vibrationWaveformBuffer]
                },
                electrical: {
                    current: parseFloat(this.state.currentAmps.toFixed(2)),
                    voltage: parseFloat(this.state.voltageVolts.toFixed(1)),
                    powerKW: parseFloat(this.state.powerKW.toFixed(2)),
                    powerFactor: parseFloat(this.state.powerFactor.toFixed(2)),
                    rpm: Math.round(this.state.rpm)
                }
            },
            diagnostics: {
                operationalMode: this.state.operationalMode,
                healthScore: parseFloat(this.state.healthScore.toFixed(1)),
                activeFaults: [...this.state.activeFaults]
            }
        };
    }

    subscribe(callback) {
        if (typeof callback === "function") {
            this.listeners.push(callback);
        }
    }

    unsubscribe(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    broadcastTelemetry() {
        const packet = this.getTelemetryPacket();
        this.listeners.forEach(cb => {
            try {
                cb(packet);
            } catch (err) {
                console.error("Telemetry subscriber error:", err);
            }
        });
    }
}

// Attach globally for browser access
window.VirtualESP32 = VirtualESP32;

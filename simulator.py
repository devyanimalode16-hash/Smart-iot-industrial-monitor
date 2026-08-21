"""
==============================================================================
VIRTUAL ESP32 MICROCONTROLLER & INDUSTRIAL SENSOR SIMULATOR
==============================================================================
Simulates an industrial edge microcontroller (ESP32) running FreeRTOS tasks:
 - Task 1: PT100 RTD Temperature Sampling with first-order thermal inertia
 - Task 2: MPU6050 3-Axis Vibration Sensor with ISO 10816-3 RMS calculation
 - Task 3: Current CT Sensor (SCT-013) measuring motor load amperage
 - Task 4: Optical Tachometer measuring shaft RPM
 - Telemetry Packeting with timestamp, checksum, and diagnostic flags
==============================================================================
"""

import time
import math
import random
from typing import Dict, Any, List

class VirtualESP32:
    def __init__(self, node_id: str = "ESP32-IND-01"):
        self.node_id = node_id
        self.chip_model = "ESP32-WROOM-32D (Dual-Core 240MHz)"
        self.firmware_version = "v2.4.1-IIoT-FreeRTOS"
        self.mac_address = "24:6F:28:B4:8E:1A"
        self.wifi_rssi = -58 # dBm
        self.start_time = time.time()
        self.sample_count = 0

        # Physical machine parameters (7.5 kW 3-Phase Induction Motor)
        self.rated_power_kw = 7.5
        self.rated_rpm = 1450.0
        self.ambient_temp = 27.5 # °C
        
        # State variables
        self.temperature = 42.0 # °C
        self.vibration_rms = 1.45 # mm/s
        self.vibration_peak = 2.10 # mm/s
        self.rpm = 1445.0
        self.current_amps = 11.2 # A
        self.voltage_volts = 415.0 # V
        self.power_factor = 0.86
        self.power_kw = 6.88
        self.health_score = 98.5

        # Active fault flags
        self.faults = {
            "overheat": False,
            "bearingDefect": False,
            "mechanicalUnbalance": False,
            "coolingFanFailure": False,
            "voltageSag": False,
            "emergencyStop": False
        }

    def set_fault(self, fault_type: str, state: bool):
        if fault_type in self.faults:
            self.faults[fault_type] = state

    def clear_all_faults(self):
        for k in self.faults:
            self.faults[k] = False

    def generate_telemetry(self) -> Dict[str, Any]:
        """
        Calculates one telemetry cycle (1-2 Hz sampling rate) using mathematical physics models.
        """
        self.sample_count += 1
        uptime_seconds = int(time.time() - self.start_time)
        t = uptime_seconds

        # 1. Emergency Stop Check
        if self.faults["emergencyStop"]:
            self.rpm = max(0.0, self.rpm * 0.75 - 50.0)
            self.current_amps = 0.0
            self.power_kw = 0.0
            self.vibration_rms = max(0.05, self.vibration_rms * 0.7)
            self.vibration_peak = self.vibration_rms * 1.4
            self.temperature = max(self.ambient_temp, self.temperature - 0.3)
            self.health_score = 15.0
            operational_mode = "STOPPED_ESTOP"
        else:
            operational_mode = "RUNNING"
            
            # 2. Temperature Simulation (Thermal Inertia Model)
            target_temp = 50.0 + 3.0 * math.sin(t * 0.05) # Normal steady state
            
            if self.faults["coolingFanFailure"]:
                target_temp += 32.0 # Fan blockage drives heat
            if self.faults["overheat"]:
                target_temp += 45.0 # Severe thermal runaway

            # Smooth exponential approach to target temperature (simulating thermal mass)
            temp_step = (target_temp - self.temperature) * 0.08
            noise_temp = (random.random() - 0.5) * 0.25
            self.temperature = round(self.temperature + temp_step + noise_temp, 2)

            # 3. Vibration Simulation (ISO 10816-3 RMS Velocity)
            base_vib = 1.35 + 0.15 * math.sin(t * 0.1)
            
            if self.faults["bearingDefect"]:
                # High frequency bearing impact bursts
                base_vib += 4.2 + random.random() * 2.8
            if self.faults["mechanicalUnbalance"]:
                # 1X rotational unbalance oscillation
                base_vib += 3.5 + 1.2 * math.sin(t * 1.5)

            noise_vib = (random.random() - 0.5) * 0.1
            self.vibration_rms = round(max(0.1, base_vib + noise_vib), 2)
            self.vibration_peak = round(self.vibration_rms * (1.414 + random.random() * 0.5), 2)

            # 4. Electrical Parameters
            if self.faults["voltageSag"]:
                self.voltage_volts = round(340.0 + (random.random() - 0.5) * 8.0, 1)
                # Lower voltage causes motor current to surge for constant torque
                self.current_amps = round(16.8 + (random.random() - 0.5) * 0.8, 2)
            else:
                self.voltage_volts = round(415.0 + (random.random() - 0.5) * 3.0, 1)
                load_factor = 1.0
                if self.faults["bearingDefect"] or self.faults["mechanicalUnbalance"]:
                    load_factor += 0.25
                self.current_amps = round((11.2 * load_factor) + (random.random() - 0.5) * 0.4, 2)

            # Active Power P = sqrt(3) * V * I * cos(phi) / 1000
            self.power_kw = round((math.sqrt(3) * self.voltage_volts * self.current_amps * self.power_factor) / 1000.0, 2)

            # RPM with slip variation
            slip_rpm = (self.current_amps / 11.2) * 8.0
            self.rpm = round(1455.0 - slip_rpm + (random.random() - 0.5) * 4.0, 0)

            # 5. Dynamic Health Score (0 - 100%)
            vib_penalty = max(0.0, (self.vibration_rms - 1.8) * 12.0)
            temp_penalty = max(0.0, (self.temperature - 55.0) * 1.5)
            curr_penalty = max(0.0, (self.current_amps - 13.5) * 8.0)
            
            calculated_health = max(5.0, 100.0 - (vib_penalty + temp_penalty + curr_penalty))
            self.health_score = round(calculated_health, 1)

        # Generate 32-point rolling vibration time-domain waveform for oscilloscope
        waveform = self._generate_waveform()

        # Telemetry packet structure conforming to industrial IoT payload standards
        packet = {
            "metadata": {
                "node_id": self.node_id,
                "chip": self.chip_model,
                "firmware": self.firmware_version,
                "mac": self.mac_address,
                "wifi_rssi_dbm": self.wifi_rssi,
                "uptime_seconds": uptime_seconds,
                "sample_id": self.sample_count,
                "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "timestamp_local": time.strftime("%H:%M:%S")
            },
            "sensors": {
                "temperature": {
                    "sensor_type": "PT100 RTD (Class A)",
                    "value": self.temperature,
                    "unit": "°C",
                    "status": "CRITICAL" if self.temperature > 85.0 else ("WARNING" if self.temperature > 70.0 else "NORMAL")
                },
                "vibration": {
                    "sensor_type": "MPU6050 3-Axis MEMS",
                    "rms": self.vibration_rms,
                    "peak": self.vibration_peak,
                    "frequency_hz": round(self.rpm / 60.0, 1),
                    "unit": "mm/s",
                    "waveform": waveform
                },
                "electrical": {
                    "current": self.current_amps,
                    "voltage": self.voltage_volts,
                    "power_kw": self.power_kw,
                    "power_factor": self.power_factor,
                    "rpm": int(self.rpm)
                }
            },
            "diagnostics": {
                "health_score": self.health_score,
                "operational_mode": operational_mode,
                "active_faults": [k for k, v in self.faults.items() if v]
            }
        }
        return packet

    def _generate_waveform(self) -> List[float]:
        """Generates real-time 32-sample time-domain waveform."""
        points = []
        base_freq = (self.rpm / 60.0) if self.rpm > 0 else 0
        amp = self.vibration_rms
        for i in range(32):
            phase = (i / 32.0) * 2 * math.pi
            val = amp * math.sin(phase)
            if self.faults["bearingDefect"]:
                # High frequency 3X harmonic spikes
                val += (amp * 0.5) * math.sin(phase * 3.5 + 0.4)
            val += (random.random() - 0.5) * 0.15
            points.append(round(val, 3))
        return points

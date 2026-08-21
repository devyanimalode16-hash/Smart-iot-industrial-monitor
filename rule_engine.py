"""
==============================================================================
INDUSTRIAL ANOMALY DETECTION & RULE CLASSIFIER ENGINE
==============================================================================
Implements:
 1. ISO 10816-3 Machine Vibration Severity Standards (Class II)
 2. First-Order Thermal Rate of Rise (dT/dt) Anomaly Detection
 3. Tri-Level State Classification: NORMAL, WARNING, CRITICAL
 4. Multi-Sensor Correlation & Root-Cause Prescriptions
==============================================================================
"""

import time
from typing import Dict, Any, List, Tuple

class IndustrialRuleEngine:
    def __init__(self):
        # ISO 10816-3 Vibration Limits for Class II Rigid Industrial Machines
        self.vib_limits = {
            "zoneA_Good": 1.8,     # mm/s RMS (Newly commissioned)
            "zoneB_Acceptable": 2.8, # mm/s RMS (Unrestricted continuous run)
            "zoneC_Warning": 4.5,    # mm/s RMS (Advisory / Action required)
            "zoneD_Critical": 7.1    # mm/s RMS (Immediate mechanical damage)
        }

        # Temperature Limits (°C) for NEMA Class F Insulation
        self.temp_limits = {
            "optimal": 55.0,
            "warning": 75.0,
            "critical": 88.0,
            "rate_of_rise_threshold": 0.8 # °C / sec
        }

        # Current Limits (Amps)
        self.current_limits = {
            "rated": 13.5,
            "overload": 16.0
        }

        self.last_temp = None
        self.last_time = time.time()
        self.alert_history: List[Dict[str, Any]] = []

    def evaluate_telemetry(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates a telemetry frame against engineering standards and returns diagnosis.
        """
        now = time.time()
        dt = max(0.1, now - self.last_time)
        self.last_time = now

        temp = packet["sensors"]["temperature"]["value"]
        vib_rms = packet["sensors"]["vibration"]["rms"]
        current = packet["sensors"]["electrical"]["current"]
        voltage = packet["sensors"]["electrical"]["voltage"]
        rpm = packet["sensors"]["electrical"]["rpm"]

        # Calculate thermal derivative
        dt_dt = 0.0
        if self.last_temp is not None:
            dt_dt = round((temp - self.last_temp) / dt, 2)
        self.last_temp = temp

        anomalies = []
        overall_severity = "NORMAL"

        # 1. Vibration Severity Classification (ISO 10816-3)
        if vib_rms >= self.vib_limits["zoneD_Critical"]:
            overall_severity = "CRITICAL"
            anomalies.append({
                "code": "ERR_VIB_ZONE_D",
                "type": "CRITICAL_VIBRATION",
                "severity": "CRITICAL",
                "parameter": f"Vibration: {vib_rms} mm/s",
                "standard": f"ISO 10816-3 Zone D (> {self.vib_limits['zoneD_Critical']} mm/s)",
                "message": "Dangerous mechanical vibration level.",
                "prescription": "Immediately trip motor breaker. Inspect bearings, shaft alignment, and foundation anchor bolts."
            })
        elif vib_rms >= self.vib_limits["zoneC_Warning"]:
            if overall_severity != "CRITICAL":
                overall_severity = "WARNING"
            anomalies.append({
                "code": "WARN_VIB_ZONE_C",
                "type": "WARNING_VIBRATION",
                "severity": "WARNING",
                "parameter": f"Vibration: {vib_rms} mm/s",
                "standard": f"ISO 10816-3 Zone C (> {self.vib_limits['zoneC_Warning']} mm/s)",
                "message": "Elevated vibration exceeding continuous operating limit.",
                "prescription": "Schedule maintenance within 48 hours. Check bearing lubrication and dynamic balance."
            })

        # 2. Thermal Anomaly Classification
        if temp >= self.temp_limits["critical"]:
            overall_severity = "CRITICAL"
            anomalies.append({
                "code": "ERR_TEMP_CRITICAL",
                "type": "STATOR_OVERHEAT",
                "severity": "CRITICAL",
                "parameter": f"Temperature: {temp} °C",
                "standard": f"Max Limit: {self.temp_limits['critical']} °C",
                "message": "Stator thermal threshold breach. Insulation breakdown imminent.",
                "prescription": "Stop motor to prevent stator winding burnout. Check cooling fan and ventilation ducts."
            })
        elif temp >= self.temp_limits["warning"]:
            if overall_severity != "CRITICAL":
                overall_severity = "WARNING"
            anomalies.append({
                "code": "WARN_TEMP_HIGH",
                "type": "HIGH_TEMPERATURE",
                "severity": "WARNING",
                "parameter": f"Temperature: {temp} °C",
                "standard": f"Warning Limit: {self.temp_limits['warning']} °C",
                "message": "Motor running abnormally hot.",
                "prescription": "Verify ambient cooling airflow and check motor load profile."
            })

        # 3. Thermal Derivative (Thermal Runaway detection)
        if dt_dt >= self.temp_limits["rate_of_rise_threshold"]:
            if overall_severity != "CRITICAL":
                overall_severity = "WARNING"
            anomalies.append({
                "code": "WARN_THERMAL_RUNAWAY",
                "type": "FAST_TEMP_RISE",
                "severity": "WARNING",
                "parameter": f"Rate of Rise: {dt_dt} °C/s",
                "standard": f"Max Slope: {self.temp_limits['rate_of_rise_threshold']} °C/s",
                "message": "Rapid temperature surge detected.",
                "prescription": "Check for sudden mechanical bind or stalled cooling fan."
            })

        # 4. Electrical Overload
        if current >= self.current_limits["overload"]:
            if overall_severity != "CRITICAL":
                overall_severity = "WARNING"
            anomalies.append({
                "code": "WARN_ELECTRICAL_OVERLOAD",
                "type": "CURRENT_OVERLOAD",
                "severity": "WARNING",
                "parameter": f"Current: {current} A",
                "standard": f"Overload Threshold: {self.current_limits['overload']} A",
                "message": "Line current exceeds full load nameplate rating.",
                "prescription": "Inspect driven load for mechanical jamming or check for voltage drop."
            })

        # 5. Multi-Sensor Smart Diagnostic
        if current > 14.0 and vib_rms > 5.0 and rpm < 1350:
            overall_severity = "CRITICAL"
            anomalies.append({
                "code": "CRIT_MECHANICAL_JAM",
                "type": "LOCKED_ROTOR_SEIZURE",
                "severity": "CRITICAL",
                "parameter": "Multi-Sensor Pattern",
                "standard": "Combined Telemetry Diagnostic",
                "message": "Rotor stall / mechanical seizure in progress.",
                "prescription": "Emergency power cutoff mandatory. Disengage coupling."
            })

        # ISO Zone Determination
        if vib_rms < self.vib_limits["zoneA_Good"]:
            iso_zone = "Zone A (Good)"
        elif vib_rms < self.vib_limits["zoneB_Acceptable"]:
            iso_zone = "Zone B (Acceptable)"
        elif vib_rms < self.vib_limits["zoneC_Warning"]:
            iso_zone = "Zone C (Warning)"
        else:
            iso_zone = "Zone D (Critical)"

        result = {
            "overall_severity": overall_severity,
            "iso_vibration_zone": iso_zone,
            "temperature_rate_of_rise": dt_dt,
            "anomalies": anomalies,
            "anomaly_count": len(anomalies)
        }

        # Keep history of top alerts
        for a in anomalies:
            self.alert_history.insert(0, {
                "timestamp": packet["metadata"]["timestamp_local"],
                "code": a["code"],
                "type": a["type"],
                "severity": a["severity"],
                "parameter": a["parameter"],
                "message": a["message"]
            })
        self.alert_history = self.alert_history[:100]

        return result

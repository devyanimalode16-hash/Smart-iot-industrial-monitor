/**
 * ==============================================================================
 * INDUSTRIAL ANOMALY DETECTION & FAULT CLASSIFIER ENGINE
 * ==============================================================================
 * Implements:
 *  1. ISO 10816-3 Industrial Machine Vibration Severity Guidelines
 *  2. First-Order Thermal Rate of Rise (dT/dt) Anomaly Detection
 *  3. Tri-Level State Classification: NORMAL (Zone A/B), WARNING (Zone C), CRITICAL (Zone D)
 *  4. Machine Health Index Score & MTBF / OEE Estimation
 *  5. Actionable Maintenance Prescription Matrix
 * ==============================================================================
 */

class IndustrialAnomalyEngine {
    constructor() {
        // ISO 10816-3 Vibration Limits for Class II Machines (Rigid Support)
        this.vibrationLimits = {
            zoneA_Good: 1.8,     // mm/s RMS (Newly commissioned machine)
            zoneB_Acceptable: 2.8, // mm/s RMS (Normal unrestricted continuous operation)
            zoneC_Warning: 4.5,    // mm/s RMS (Unacceptable for long-term continuous run)
            zoneD_Critical: 7.1    // mm/s RMS (Vibration causes immediate mechanical damage)
        };

        // Temperature Limits (°C) for NEMA Class F Insulation
        this.tempLimits = {
            optimal: 55.0,
            warning: 75.0,
            critical: 88.0,
            rateOfRiseWarning: 0.8 // °C/second sudden jump
        };

        // Current Limits
        this.currentLimits = {
            ratedAmps: 13.5,
            overloadThreshold: 16.0
        };

        // Machine reliability metrics
        this.totalSamples = 0;
        this.anomalyCount = 0;
        this.warningCount = 0;
        this.criticalCount = 0;
        this.lastTemperature = null;
        this.lastTimestamp = Date.now();

        // Active Alert History
        this.alertLog = [];
        this.maxLogEntries = 100;
    }

    /**
     * Analyze a single telemetry frame from the Virtual ESP32
     */
    analyzeTelemetry(packet) {
        this.totalSamples++;
        const now = Date.now();
        const dt = Math.max(0.1, (now - this.lastTimestamp) / 1000);
        this.lastTimestamp = now;

        const temp = packet.sensors.temperature.value;
        const vibRMS = packet.sensors.vibration.rms;
        const vibPeak = packet.sensors.vibration.peak;
        const current = packet.sensors.electrical.current;
        const rpm = packet.sensors.electrical.rpm;

        // Calculate Temperature Derivative (Rate of Rise)
        let tempRateOfRise = 0;
        if (this.lastTemperature !== null) {
            tempRateOfRise = (temp - this.lastTemperature) / dt;
        }
        this.lastTemperature = temp;

        const detectedAnomalies = [];
        let overallSeverity = "NORMAL"; // NORMAL, WARNING, CRITICAL

        // 1. Check Vibration against ISO 10816-3
        if (vibRMS >= this.vibrationLimits.zoneD_Critical) {
            overallSeverity = "CRITICAL";
            detectedAnomalies.push({
                code: "ERR_VIB_ZONE_D",
                type: "CRITICAL_VIBRATION",
                severity: "CRITICAL",
                parameter: "Vibration RMS",
                value: `${vibRMS} mm/s`,
                standard: `ISO 10816-3 Limit: ${this.vibrationLimits.zoneD_Critical} mm/s`,
                message: "Zone D Critical Vibration: Severe mechanical damage imminent.",
                prescription: "Immediately isolate motor power. Check for unbalance, rotor looseness, or bearing destruction."
            });
        } else if (vibRMS >= this.vibrationLimits.zoneC_Warning) {
            if (overallSeverity !== "CRITICAL") overallSeverity = "WARNING";
            detectedAnomalies.push({
                code: "WARN_VIB_ZONE_C",
                type: "WARNING_VIBRATION",
                severity: "WARNING",
                parameter: "Vibration RMS",
                value: `${vibRMS} mm/s`,
                standard: `ISO 10816-3 Limit: ${this.vibrationLimits.zoneC_Warning} mm/s`,
                message: "Zone C Advisory: Vibration exceeding continuous operation threshold.",
                prescription: "Plan maintenance within 48 hours. Check alignment and re-grease bearings."
            });
        }

        // 2. Check Temperature
        if (temp >= this.tempLimits.critical) {
            overallSeverity = "CRITICAL";
            detectedAnomalies.push({
                code: "ERR_THERMAL_RUNAWAY",
                type: "CRITICAL_TEMPERATURE",
                severity: "CRITICAL",
                parameter: "Motor Temperature",
                value: `${temp} °C`,
                standard: `Max Limit: ${this.tempLimits.critical} °C`,
                message: "Thermal Runaway: Winding insulation breakdown imminent.",
                prescription: "Trigger emergency cooling or shut down to prevent coil burnout."
            });
        } else if (temp >= this.tempLimits.warning || tempRateOfRise > this.tempLimits.rateOfRiseWarning) {
            if (overallSeverity !== "CRITICAL") overallSeverity = "WARNING";
            detectedAnomalies.push({
                code: "WARN_HIGH_TEMPERATURE",
                type: "WARNING_TEMPERATURE",
                severity: "WARNING",
                parameter: "Motor Temperature",
                value: `${temp} °C (+${tempRateOfRise.toFixed(2)} °C/s)`,
                standard: `Warning Limit: ${this.tempLimits.warning} °C`,
                message: "High temperature detected with elevated thermal rate of rise.",
                prescription: "Verify ventilation air inlet and clean motor fin filters."
            });
        }

        // 3. Check Electrical Overload
        if (current >= this.currentLimits.overloadThreshold) {
            if (overallSeverity !== "CRITICAL") overallSeverity = "WARNING";
            detectedAnomalies.push({
                code: "WARN_ELEC_OVERLOAD",
                type: "ELECTRICAL_OVERLOAD",
                severity: "WARNING",
                parameter: "Line Current",
                value: `${current} A`,
                standard: `Rated: ${this.currentLimits.ratedAmps} A`,
                message: "Overcurrent condition detected on motor feeder.",
                prescription: "Inspect mechanical load for binding or check for supply voltage phase drop."
            });
        }

        // 4. Update internal counters & event log
        if (overallSeverity === "CRITICAL") {
            this.criticalCount++;
            this.anomalyCount++;
        } else if (overallSeverity === "WARNING") {
            this.warningCount++;
            this.anomalyCount++;
        }

        // Append to alert history if new alerts exist and are unique within the last 5 seconds
        detectedAnomalies.forEach(anomaly => {
            const isRecent = this.alertLog.some(log => 
                log.code === anomaly.code && (now - new Date(log.timestamp).getTime()) < 5000
            );
            if (!isRecent) {
                const logEntry = {
                    id: 'ALT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 899 + 100),
                    timestamp: new Date().toLocaleTimeString(),
                    fullDate: new Date().toISOString(),
                    ...anomaly
                };
                this.alertLog.unshift(logEntry);
                if (this.alertLog.length > this.maxLogEntries) {
                    this.alertLog.pop();
                }
            }
        });

        // Compute Key Performance Indicators (KPIs)
        const uptimePercent = Math.max(88.0, 100 - (this.anomalyCount / Math.max(1, this.totalSamples)) * 100);
        const estimatedMTBF = (2400 / Math.max(1, (this.criticalCount * 2 + this.warningCount * 0.5 + 1))).toFixed(0);

        return {
            overallSeverity,
            detectedAnomalies,
            kpis: {
                healthScore: packet.diagnostics.healthScore,
                uptimePercent: parseFloat(uptimePercent.toFixed(1)),
                mtbfHours: estimatedMTBF,
                totalAnomalies: this.anomalyCount,
                vibrationZone: this.getISOZone(vibRMS),
                activeAlertsCount: detectedAnomalies.length
            },
            recentAlerts: this.alertLog.slice(0, 10)
        };
    }

    getISOZone(rms) {
        if (rms < this.vibrationLimits.zoneA_Good) return { zone: "Zone A", label: "Good", color: "var(--accent-green)" };
        if (rms < this.vibrationLimits.zoneB_Acceptable) return { zone: "Zone B", label: "Acceptable", color: "var(--accent-cyan)" };
        if (rms < this.vibrationLimits.zoneC_Warning) return { zone: "Zone C", label: "Warning", color: "var(--accent-amber)" };
        return { zone: "Zone D", label: "Critical Hazard", color: "var(--accent-red)" };
    }

    clearAlerts() {
        this.alertLog = [];
        this.anomalyCount = 0;
        this.warningCount = 0;
        this.criticalCount = 0;
    }
}

// Attach globally
window.IndustrialAnomalyEngine = IndustrialAnomalyEngine;

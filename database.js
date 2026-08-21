/**
 * ==============================================================================
 * TIME-SERIES HISTORICAL DATA LOGGER & CSV REPORT EXPORTER
 * ==============================================================================
 * Manages chronological sensor telemetry logs in browser memory/LocalStorage.
 * Provides:
 *  - Automated historical batch generation for instant presentation
 *  - Live filtering (Severity, Date, Parameter)
 *  - One-Click CSV Export for Engineering Reports & Excel Analysis
 * ==============================================================================
 */

class TelemetryDatabase {
    constructor(storageKey = "iiot_telemetry_logs_v1") {
        this.storageKey = storageKey;
        this.maxRecords = 300;
        this.records = [];
        this.init();
    }

    init() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.records = JSON.parse(saved);
            }
        } catch (e) {
            console.warn("Storage load error:", e);
        }

        // If no records exist, pre-generate realistic historical records
        if (!this.records || this.records.length < 15) {
            this.generateHistoricalBaseline();
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.records.slice(0, this.maxRecords)));
        } catch (e) {
            // Storage quota fallback
            this.records = this.records.slice(0, 100);
        }
    }

    generateHistoricalBaseline() {
        this.records = [];
        const baseTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
        let temp = 48.2;
        let vib = 1.35;

        for (let i = 0; i < 60; i++) {
            const timestamp = new Date(baseTime + (i * 60 * 1000)).toISOString();
            temp += (Math.random() - 0.48) * 0.4;
            vib += (Math.random() - 0.48) * 0.08;
            temp = Math.max(40, Math.min(65, temp));
            vib = Math.max(0.8, Math.min(2.4, vib));

            const isStress = i > 40 && i < 48;
            const currentTemp = isStress ? temp + 22.0 : temp;
            const currentVib = isStress ? vib + 3.8 : vib;
            const status = (currentVib > 7.1 || currentTemp > 85) ? "CRITICAL" : 
                           (currentVib > 4.5 || currentTemp > 72) ? "WARNING" : "NORMAL";

            this.records.push({
                id: "LOG-" + (1000 + i),
                timestamp: timestamp,
                displayTime: new Date(timestamp).toLocaleTimeString(),
                temperature: parseFloat(currentTemp.toFixed(2)),
                vibrationRMS: parseFloat(currentVib.toFixed(2)),
                vibrationPeak: parseFloat((currentVib * 1.5).toFixed(2)),
                current: parseFloat((11.2 + (Math.random() * 0.8)).toFixed(2)),
                voltage: parseFloat((415.0 + (Math.random() * 4.0 - 2.0)).toFixed(1)),
                powerKW: parseFloat((6.9 + (Math.random() * 0.4)).toFixed(2)),
                rpm: Math.round(1445 + (Math.random() * 10 - 5)),
                healthScore: status === "CRITICAL" ? 45.0 : (status === "WARNING" ? 74.0 : 98.2),
                status: status,
                faultNotes: status === "CRITICAL" ? "Severe Unbalance Detected" : (status === "WARNING" ? "Elevated Stator Temperature" : "Optimal Run")
            });
        }
        this.save();
    }

    addRecord(packet, analysis) {
        const record = {
            id: "LOG-" + Date.now().toString(36).toUpperCase(),
            timestamp: new Date().toISOString(),
            displayTime: new Date().toLocaleTimeString(),
            temperature: packet.sensors.temperature.value,
            vibrationRMS: packet.sensors.vibration.rms,
            vibrationPeak: packet.sensors.vibration.peak,
            current: packet.sensors.electrical.current,
            voltage: packet.sensors.electrical.voltage,
            powerKW: packet.sensors.electrical.powerKW,
            rpm: packet.sensors.electrical.rpm,
            healthScore: packet.diagnostics.healthScore,
            status: analysis.overallSeverity,
            faultNotes: analysis.detectedAnomalies.length > 0 
                ? analysis.detectedAnomalies.map(a => a.type).join(", ") 
                : "Nominal Operating Profile"
        };

        this.records.unshift(record);
        if (this.records.length > this.maxRecords) {
            this.records.pop();
        }

        // Throttle disk writes
        if (this.records.length % 5 === 0) {
            this.save();
        }

        return record;
    }

    getRecords(filterStatus = "ALL", limit = 50) {
        let list = this.records;
        if (filterStatus && filterStatus !== "ALL") {
            list = list.filter(r => r.status === filterStatus);
        }
        return list.slice(0, limit);
    }

    clearDatabase() {
        this.records = [];
        localStorage.removeItem(this.storageKey);
        this.generateHistoricalBaseline();
    }

    exportToCSV() {
        if (!this.records || this.records.length === 0) {
            alert("No records available to export.");
            return;
        }

        const headers = [
            "Log ID",
            "ISO Timestamp",
            "Local Time",
            "Motor Temp (°C)",
            "Vibration RMS (mm/s)",
            "Vibration Peak (mm/s)",
            "Line Current (A)",
            "3-Phase Voltage (V)",
            "Active Power (kW)",
            "Motor Speed (RPM)",
            "Health Score (%)",
            "Operational Status",
            "Diagnostic / Fault Notes"
        ];

        const rows = this.records.map(r => [
            `"${r.id}"`,
            `"${r.timestamp}"`,
            `"${r.displayTime}"`,
            r.temperature,
            r.vibrationRMS,
            r.vibrationPeak,
            r.current,
            r.voltage,
            r.powerKW,
            r.rpm,
            r.healthScore,
            `"${r.status}"`,
            `"${r.faultNotes.replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `IoT_Industrial_Equipment_Report_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Attach globally
window.TelemetryDatabase = TelemetryDatabase;

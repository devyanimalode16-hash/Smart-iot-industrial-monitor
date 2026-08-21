/**
 * ==============================================================================
 * MAIN INDUSTRIAL SCADA DASHBOARD CONTROLLER
 * ==============================================================================
 * Connects Virtual ESP32 Node, Anomaly Detector, Charts, Database, Audio, and UI.
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Subsystems
    const esp32 = new VirtualESP32();
    const anomalyEngine = new IndustrialAnomalyEngine();
    const soundAlerts = new IndustrialSoundAlerts();
    const database = new TelemetryDatabase();
    const charts = new IndustrialCharts();

    // 2. Initialize Fault Injector
    const faultInjector = new FaultInjector(esp32, (activeFaults) => {
        updateFaultButtonUI(activeFaults);
    });

    // Audio & Telemetry Pause State
    let isTelemetryPaused = false;
    let isTerminalAutoScroll = true;
    let isAudioEnabled = true;

    // DOM Elements Cache
    const el = {
        // Status and Health
        overallStatusBadge: document.getElementById("overallStatusBadge"),
        statusPulseDot: document.getElementById("statusPulseDot"),
        healthScoreText: document.getElementById("healthScoreText"),
        healthScoreBar: document.getElementById("healthScoreBar"),
        healthStatusLabel: document.getElementById("healthStatusLabel"),
        
        // Machine Metrics
        tempValue: document.getElementById("tempValue"),
        tempStatusBadge: document.getElementById("tempStatusBadge"),
        tempGaugeFill: document.getElementById("tempGaugeFill"),

        vibRMSValue: document.getElementById("vibRMSValue"),
        vibPeakValue: document.getElementById("vibPeakValue"),
        vibFreqValue: document.getElementById("vibFreqValue"),
        vibZoneBadge: document.getElementById("vibZoneBadge"),
        vibGaugeFill: document.getElementById("vibGaugeFill"),

        rpmValue: document.getElementById("rpmValue"),
        currentValue: document.getElementById("currentValue"),
        voltageValue: document.getElementById("voltageValue"),
        powerValue: document.getElementById("powerValue"),
        powerFactorValue: document.getElementById("powerFactorValue"),

        // KPIs
        kpiUptime: document.getElementById("kpiUptime"),
        kpiMTBF: document.getElementById("kpiMTBF"),
        kpiAnomalies: document.getElementById("kpiAnomalies"),
        kpiSamples: document.getElementById("kpiSamples"),

        // Device Metadata
        deviceUptime: document.getElementById("deviceUptime"),
        systemClock: document.getElementById("systemClock"),
        wifiRSSI: document.getElementById("wifiRSSI"),

        // Logs & Terminal
        terminalContent: document.getElementById("terminalContent"),
        alertsContainer: document.getElementById("alertsContainer"),
        historyTableBody: document.getElementById("historyTableBody"),

        // Audio Toggle
        btnMuteAudio: document.getElementById("btnMuteAudio"),
        btnPauseTelemetry: document.getElementById("btnPauseTelemetry"),
        btnExportCSV: document.getElementById("btnExportCSV"),
        btnResetFaults: document.getElementById("btnResetFaults"),
        scenarioSelect: document.getElementById("scenarioSelect")
    };

    // 3. Telemetry Stream Subscriber Loop
    esp32.subscribe((packet) => {
        if (isTelemetryPaused) return;

        // Perform Anomaly & ISO 10816 Analysis
        const analysis = anomalyEngine.analyzeTelemetry(packet);

        // Store to time-series DB
        const savedRecord = database.addRecord(packet, analysis);

        // Update Charts
        charts.update(
            packet.sensors.temperature.value,
            packet.sensors.vibration.rms,
            packet.sensors.vibration.waveform,
            analysis.overallSeverity
        );

        // Update UI components
        updateDashboardUI(packet, analysis);

        // Update Audio Siren / Warning
        handleAudioFeedback(analysis.overallSeverity);

        // Update JSON Terminal Stream
        updateTerminalStream(packet);
    });

    // Render Historical Table initially
    renderHistoryTable();

    // 4. Update UI Functions
    function updateDashboardUI(packet, analysis) {
        const sensors = packet.sensors;
        const meta = packet.metadata;

        // System Clocks & Metadata
        if (el.systemClock) el.systemClock.textContent = new Date().toLocaleTimeString();
        if (el.deviceUptime) el.deviceUptime.textContent = formatUptime(meta.uptime);
        if (el.wifiRSSI) el.wifiRSSI.textContent = meta.wifiRSSI;

        // Machine Status Badge
        const status = analysis.overallSeverity;
        if (el.overallStatusBadge) {
            el.overallStatusBadge.textContent = status === "NORMAL" ? "OPTIMAL OPERATIONAL" : (status === "WARNING" ? "STRESSED / ADVISORY" : "CRITICAL HAZARD");
            el.overallStatusBadge.className = `status-pill status-${status.toLowerCase()}`;
        }
        if (el.statusPulseDot) {
            el.statusPulseDot.className = `pulse-dot pulse-${status.toLowerCase()}`;
        }

        // Health Score
        const health = packet.diagnostics.healthScore;
        if (el.healthScoreText) el.healthScoreText.textContent = `${health.toFixed(1)}%`;
        if (el.healthScoreBar) {
            el.healthScoreBar.style.width = `${health}%`;
            el.healthScoreBar.style.backgroundColor = health > 80 ? 'var(--accent-green)' : (health > 50 ? 'var(--accent-amber)' : 'var(--accent-red)');
        }
        if (el.healthStatusLabel) {
            el.healthStatusLabel.textContent = health > 80 ? "Condition: Excellent" : (health > 50 ? "Condition: Degrading" : "Condition: Immediate Service");
        }

        // Temperature Gauge & Display
        if (el.tempValue) el.tempValue.textContent = sensors.temperature.value.toFixed(1);
        if (el.tempStatusBadge) {
            el.tempStatusBadge.textContent = sensors.temperature.status;
            el.tempStatusBadge.className = `badge badge-${sensors.temperature.status.toLowerCase()}`;
        }
        if (el.tempGaugeFill) {
            // Map 20°C - 100°C to 0% - 100%
            const tempPct = Math.max(0, Math.min(100, ((sensors.temperature.value - 20) / 80) * 100));
            el.tempGaugeFill.style.width = `${tempPct}%`;
        }

        // Vibration Gauges & Display
        if (el.vibRMSValue) el.vibRMSValue.textContent = sensors.vibration.rms.toFixed(2);
        if (el.vibPeakValue) el.vibPeakValue.textContent = sensors.vibration.peak.toFixed(2);
        if (el.vibFreqValue) el.vibFreqValue.textContent = sensors.vibration.frequencyHz.toFixed(1);
        if (el.vibZoneBadge) {
            const zoneInfo = analysis.kpis.vibrationZone;
            el.vibZoneBadge.textContent = `${zoneInfo.zone} (${zoneInfo.label})`;
            el.vibZoneBadge.className = `badge badge-${sensors.vibration.status.toLowerCase()}`;
        }
        if (el.vibGaugeFill) {
            // Map 0 - 10 mm/s to 0% - 100%
            const vibPct = Math.max(0, Math.min(100, (sensors.vibration.rms / 10.0) * 100));
            el.vibGaugeFill.style.width = `${vibPct}%`;
        }

        // Electrical Parameters
        if (el.rpmValue) el.rpmValue.textContent = sensors.electrical.rpm;
        if (el.currentValue) el.currentValue.textContent = sensors.electrical.current.toFixed(1);
        if (el.voltageValue) el.voltageValue.textContent = sensors.electrical.voltage.toFixed(0);
        if (el.powerValue) el.powerValue.textContent = sensors.electrical.powerKW.toFixed(2);
        if (el.powerFactorValue) el.powerFactorValue.textContent = sensors.electrical.powerFactor.toFixed(2);

        // KPIs
        if (el.kpiUptime) el.kpiUptime.textContent = `${analysis.kpis.uptimePercent}%`;
        if (el.kpiMTBF) el.kpiMTBF.textContent = `${analysis.kpis.mtbfHours} hrs`;
        if (el.kpiAnomalies) el.kpiAnomalies.textContent = analysis.kpis.totalAnomalies;
        if (el.kpiSamples) el.kpiSamples.textContent = anomalyEngine.totalSamples;

        // Render Alert Cards
        renderAlertCards(analysis);
    }

    function renderAlertCards(analysis) {
        if (!el.alertsContainer) return;
        if (analysis.recentAlerts.length === 0) {
            el.alertsContainer.innerHTML = `
                <div class="empty-alert-state">
                    <div class="empty-icon">✓</div>
                    <div>All industrial telemetry parameters within nominal ISO & NEMA limits.</div>
                </div>
            `;
            return;
        }

        let html = "";
        analysis.recentAlerts.forEach(alert => {
            const isCrit = alert.severity === "CRITICAL";
            html += `
                <div class="alert-card alert-card-${alert.severity.toLowerCase()} animate-slide-in">
                    <div class="alert-header">
                        <span class="alert-badge badge-${alert.severity.toLowerCase()}">${alert.severity}</span>
                        <span class="alert-time">${alert.timestamp}</span>
                    </div>
                    <div class="alert-title">${alert.message}</div>
                    <div class="alert-meta">
                        <span><strong>Observed:</strong> ${alert.value}</span>
                        <span><strong>Standard:</strong> ${alert.standard}</span>
                    </div>
                    <div class="alert-action">
                        <strong>Prescription:</strong> ${alert.prescription}
                    </div>
                </div>
            `;
        });
        el.alertsContainer.innerHTML = html;
    }

    function updateTerminalStream(packet) {
        if (!el.terminalContent) return;
        const jsonString = JSON.stringify(packet, null, 2);
        el.terminalContent.textContent = jsonString;
    }

    let lastSeverity = "NORMAL";
    function handleAudioFeedback(severity) {
        if (!isAudioEnabled) return;
        if (severity === "CRITICAL") {
            soundAlerts.startCriticalSiren();
        } else {
            soundAlerts.stopCriticalSiren();
            if (severity === "WARNING" && lastSeverity !== "WARNING") {
                soundAlerts.playWarningBeep();
            } else if (severity === "NORMAL" && lastSeverity !== "NORMAL") {
                soundAlerts.playNormalChime();
            }
        }
        lastSeverity = severity;
    }

    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function renderHistoryTable(filter = "ALL") {
        if (!el.historyTableBody) return;
        const records = database.getRecords(filter, 25);
        if (records.length === 0) {
            el.historyTableBody.innerHTML = `<tr><td colspan="8" class="text-center">No matching historical logs found.</td></tr>`;
            return;
        }

        let rows = "";
        records.forEach(r => {
            rows += `
                <tr>
                    <td class="font-mono">${r.displayTime}</td>
                    <td>${r.temperature.toFixed(1)} °C</td>
                    <td>${r.vibrationRMS.toFixed(2)} mm/s</td>
                    <td>${r.current.toFixed(1)} A</td>
                    <td>${r.powerKW.toFixed(2)} kW</td>
                    <td>${r.rpm}</td>
                    <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
                    <td class="text-muted text-small">${r.faultNotes}</td>
                </tr>
            `;
        });
        el.historyTableBody.innerHTML = rows;
    }

    // 5. Interactive Fault Injection Handlers
    const faultButtons = document.querySelectorAll("[data-fault]");
    faultButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const faultType = btn.getAttribute("data-fault");
            const isActive = btn.classList.contains("active");
            faultInjector.toggleFault(faultType, !isActive);
        });
    });

    function updateFaultButtonUI(activeFaults) {
        faultButtons.forEach(btn => {
            const faultType = btn.getAttribute("data-fault");
            if (activeFaults[faultType]) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    if (el.btnResetFaults) {
        el.btnResetFaults.addEventListener("click", () => {
            faultInjector.resetAll();
            if (el.scenarioSelect) el.scenarioSelect.value = "NORMAL_BASELINE";
            soundAlerts.stopCriticalSiren();
            soundAlerts.playNormalChime();
        });
    }

    if (el.scenarioSelect) {
        el.scenarioSelect.addEventListener("change", (e) => {
            faultInjector.applyScenario(e.target.value);
        });
    }

    // 6. UI Controls (Audio, Pause, Export, Filters)
    if (el.btnMuteAudio) {
        el.btnMuteAudio.addEventListener("click", () => {
            isAudioEnabled = !soundAlerts.toggleMute();
            el.btnMuteAudio.textContent = isAudioEnabled ? "🔔 Siren: Active" : "🔕 Siren: Muted";
            el.btnMuteAudio.classList.toggle("btn-muted", !isAudioEnabled);
        });
    }

    if (el.btnPauseTelemetry) {
        el.btnPauseTelemetry.addEventListener("click", () => {
            isTelemetryPaused = !isTelemetryPaused;
            el.btnPauseTelemetry.textContent = isTelemetryPaused ? "▶ Resume Stream" : "⏸ Pause Stream";
            el.btnPauseTelemetry.classList.toggle("btn-warning", isTelemetryPaused);
        });
    }

    if (el.btnExportCSV) {
        el.btnExportCSV.addEventListener("click", () => {
            database.exportToCSV();
        });
    }

    // Table Filter Buttons
    const filterButtons = document.querySelectorAll(".table-filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const filter = btn.getAttribute("data-filter");
            renderHistoryTable(filter);
        });
    });

    // Refresh historical table every 5 seconds
    setInterval(() => {
        const activeFilter = document.querySelector(".table-filter-btn.active")?.getAttribute("data-filter") || "ALL";
        renderHistoryTable(activeFilter);
    }, 4000);
});

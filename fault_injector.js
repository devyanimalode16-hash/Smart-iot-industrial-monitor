/**
 * ==============================================================================
 * INTERACTIVE FAULT INJECTION CONTROLLER & DEMO SCENARIOS
 * ==============================================================================
 * Enables real-time simulation of industrial failure modes for project viva:
 *  - Bearing Mechanical Flaw (Vibration Harmonic Spike)
 *  - Cooling Blockage (Thermal Climb)
 *  - Mechanical Unbalance (1X Rotational Peak)
 *  - Grid Voltage Sag (Current Surge)
 *  - Emergency Stop Interlock
 * ==============================================================================
 */

class FaultInjector {
    constructor(esp32Node, uiCallback) {
        this.esp32 = esp32Node;
        this.onFaultChange = uiCallback || (() => {});
    }

    toggleFault(faultType, isActive) {
        if (!this.esp32) return;
        this.esp32.setFault(faultType, isActive);
        this.onFaultChange(this.esp32.faults);
    }

    applyScenario(scenarioName) {
        if (!this.esp32) return;
        this.esp32.clearAllFaults();

        switch (scenarioName) {
            case "NORMAL_BASELINE":
                // All faults off
                break;
            case "BEARING_DEGRADATION":
                this.esp32.setFault("bearingDefect", true);
                break;
            case "THERMAL_OVERLOAD":
                this.esp32.setFault("coolingFanFailure", true);
                this.esp32.setFault("overheat", true);
                break;
            case "SHAFT_UNBALANCE":
                this.esp32.setFault("mechanicalUnbalance", true);
                break;
            case "GRID_ANOMALY":
                this.esp32.setFault("voltageSag", true);
                break;
            case "CATASTROPHIC_TRIP":
                this.esp32.setFault("bearingDefect", true);
                this.esp32.setFault("coolingFanFailure", true);
                this.esp32.setFault("mechanicalUnbalance", true);
                break;
            case "EMERGENCY_SHUTDOWN":
                this.esp32.setFault("emergencyStop", true);
                break;
            default:
                break;
        }

        this.onFaultChange(this.esp32.faults);
    }

    resetAll() {
        if (!this.esp32) return;
        this.esp32.clearAllFaults();
        this.onFaultChange(this.esp32.faults);
    }
}

// Attach globally
window.FaultInjector = FaultInjector;

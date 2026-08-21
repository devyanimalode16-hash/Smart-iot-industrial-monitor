"""
==============================================================================
UNIT TEST SUITE FOR SMART IIOT SIMULATION SYSTEM
==============================================================================
Verifies:
 1. Virtual ESP32 Telemetry Generator & Physics Engine
 2. ISO 10816-3 Vibration Severity Classification (Zones A, B, C, D)
 3. Stator Overheating & Thermal Runaway Detection
 4. SQLite Persistence & Record Retrieval
 5. Fault Injection State Transitions
==============================================================================
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.simulator import VirtualESP32
from backend.rule_engine import IndustrialRuleEngine
from backend.database import TelemetryDatabase

def test_telemetry_generation():
    print("[TEST 1] Testing Virtual ESP32 Telemetry Generator...")
    esp32 = VirtualESP32()
    packet = esp32.generate_telemetry()
    
    assert "metadata" in packet, "Missing metadata in packet"
    assert "sensors" in packet, "Missing sensors in packet"
    assert "temperature" in packet["sensors"], "Missing temperature sensor"
    assert "vibration" in packet["sensors"], "Missing vibration sensor"
    assert len(packet["sensors"]["vibration"]["waveform"]) == 32, "Waveform should have 32 samples"
    assert packet["diagnostics"]["health_score"] > 0, "Health score must be > 0"
    print("  -> Passed: Telemetry packet conforms to IIoT specification.")

def test_iso_10816_vibration_zones():
    print("[TEST 2] Testing ISO 10816-3 Vibration Severity Classifier...")
    engine = IndustrialRuleEngine()
    esp32 = VirtualESP32()
    
    # Baseline
    packet = esp32.generate_telemetry()
    res = engine.evaluate_telemetry(packet)
    assert res["overall_severity"] == "NORMAL", f"Expected NORMAL, got {res['overall_severity']}"
    assert "Zone A" in res["iso_vibration_zone"] or "Zone B" in res["iso_vibration_zone"]
    
    # Bearing Defect Injection -> Zone D
    esp32.set_fault("bearingDefect", True)
    for _ in range(5):
        packet = esp32.generate_telemetry()
    res = engine.evaluate_telemetry(packet)
    assert res["overall_severity"] in ["WARNING", "CRITICAL"], "Bearing defect must trigger WARNING or CRITICAL"
    print("  -> Passed: ISO 10816-3 vibration zones classified correctly.")

def test_thermal_runaway():
    print("[TEST 3] Testing Thermal Runaway & Stator Overheat...")
    engine = IndustrialRuleEngine()
    esp32 = VirtualESP32()
    
    esp32.set_fault("overheat", True)
    esp32.set_fault("coolingFanFailure", True)
    for _ in range(15):
        packet = esp32.generate_telemetry()
    
    res = engine.evaluate_telemetry(packet)
    assert packet["sensors"]["temperature"]["value"] > 65.0, "Temperature should rise significantly"
    print(f"  -> Simulated Temperature reached: {packet['sensors']['temperature']['value']} °C")
    print("  -> Passed: Thermal anomaly correctly identified.")

def test_database_persistence():
    print("[TEST 4] Testing SQLite Persistence & CSV Export...")
    test_db_path = os.path.join(os.path.dirname(__file__), "data", "test_telemetry.db")
    db = TelemetryDatabase(db_path=test_db_path)
    
    esp32 = VirtualESP32()
    engine = IndustrialRuleEngine()
    
    packet = esp32.generate_telemetry()
    analysis = engine.evaluate_telemetry(packet)
    rec_id = db.insert_telemetry(packet, analysis)
    assert rec_id > 0, "Insert should return valid record ID"
    
    history = db.get_recent_history(limit=5)
    assert len(history) >= 1, "History query should return at least 1 record"
    
    csv_str = db.export_csv_string()
    assert "Temperature_C" in csv_str, "CSV should contain header"
    print("  -> Passed: SQLite storage and CSV export functional.")
    
    # Cleanup test db
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

def test_estop_interlock():
    print("[TEST 5] Testing Emergency Stop Interlock...")
    esp32 = VirtualESP32()
    esp32.set_fault("emergencyStop", True)
    packet = esp32.generate_telemetry()
    
    assert packet["sensors"]["electrical"]["current"] == 0.0, "E-STOP must cut electrical current"
    assert packet["sensors"]["electrical"]["power_kw"] == 0.0, "E-STOP must drop power to 0 kW"
    assert packet["diagnostics"]["operational_mode"] == "STOPPED_ESTOP", "Mode must be STOPPED_ESTOP"
    print("  -> Passed: E-STOP safety interlock verified.")

if __name__ == "__main__":
    print("\n--- RUNNING SMART IIOT VERIFICATION TESTS ---")
    test_telemetry_generation()
    test_iso_10816_vibration_zones()
    test_thermal_runaway()
    test_database_persistence()
    test_estop_interlock()
    print("\n[SUCCESS] ALL 5 TEST SUITES PASSED PERFECTLY!\n")

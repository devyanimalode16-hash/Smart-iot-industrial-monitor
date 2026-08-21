"""
==============================================================================
SQLITE HISTORICAL TELEMETRY DATABASE & TIME-SERIES LOGGER
==============================================================================
Manages local persistent storage of high-frequency IIoT telemetry frames,
fault alarm logs, and CSV report export queries.
==============================================================================
"""

import sqlite3
import os
import csv
import io
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "iot_telemetry.db")

class TelemetryDatabase:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Telemetry Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node_id TEXT NOT NULL,
                    timestamp_iso TEXT NOT NULL,
                    temperature REAL NOT NULL,
                    vibration_rms REAL NOT NULL,
                    vibration_peak REAL NOT NULL,
                    current_amps REAL NOT NULL,
                    voltage_volts REAL NOT NULL,
                    power_kw REAL NOT NULL,
                    rpm REAL NOT NULL,
                    health_score REAL NOT NULL,
                    severity TEXT NOT NULL,
                    iso_zone TEXT NOT NULL
                )
            """)

            # Fault Alert Log Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS fault_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp_iso TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    fault_code TEXT NOT NULL,
                    fault_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    parameter_value TEXT NOT NULL,
                    diagnostic_message TEXT NOT NULL
                )
            """)
            conn.commit()

    def insert_telemetry(self, packet: Dict[str, Any], analysis: Dict[str, Any]) -> int:
        """Inserts one sampled telemetry frame and any associated alerts."""
        meta = packet["metadata"]
        sensors = packet["sensors"]
        diag = packet["diagnostics"]

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO telemetry (
                    node_id, timestamp_iso, temperature, vibration_rms, vibration_peak,
                    current_amps, voltage_volts, power_kw, rpm, health_score,
                    severity, iso_zone
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                meta["node_id"],
                meta["timestamp_iso"],
                sensors["temperature"]["value"],
                sensors["vibration"]["rms"],
                sensors["vibration"]["peak"],
                sensors["electrical"]["current"],
                sensors["electrical"]["voltage"],
                sensors["electrical"]["power_kw"],
                sensors["electrical"]["rpm"],
                diag["health_score"],
                analysis["overall_severity"],
                analysis.get("iso_vibration_zone", "Zone A")
            ))
            record_id = cursor.lastrowid

            # Insert alerts if any
            for a in analysis.get("anomalies", []):
                cursor.execute("""
                    INSERT INTO fault_alerts (
                        timestamp_iso, node_id, fault_code, fault_type,
                        severity, parameter_value, diagnostic_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    meta["timestamp_iso"],
                    meta["node_id"],
                    a["code"],
                    a["type"],
                    a["severity"],
                    a["parameter"],
                    a["message"]
                ))
            conn.commit()
            return record_id

    def get_recent_history(self, limit: int = 60) -> List[Dict[str, Any]]:
        """Retrieves the most recent N telemetry records."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM telemetry 
                ORDER BY id DESC LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves latest fault alerts."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM fault_alerts 
                ORDER BY id DESC LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def export_csv_string(self, limit: int = 500) -> str:
        """Exports historical telemetry records formatted as CSV string."""
        records = self.get_recent_history(limit)
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "ID", "Node_ID", "Timestamp_ISO", "Temperature_C", "Vibration_RMS_mms",
            "Vibration_Peak_mms", "Current_A", "Voltage_V", "Active_Power_kW",
            "Speed_RPM", "Health_Score_Pct", "Operational_Severity", "ISO_Zone"
        ])

        for r in reversed(records):
            writer.writerow([
                r["id"], r["node_id"], r["timestamp_iso"], r["temperature"],
                r["vibration_rms"], r["vibration_peak"], r["current_amps"],
                r["voltage_volts"], r["power_kw"], r["rpm"], r["health_score"],
                r["severity"], r["iso_zone"]
            ])

        return output.getvalue()

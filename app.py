"""
==============================================================================
SMART IIOT BACKEND APPLICATION (FASTAPI + WEBSOCKETS)
==============================================================================
Provides:
 1. WebSocket Streaming Endpoint (`/ws/telemetry`) broadcasting 1 Hz live frames
 2. REST API for fault injection, historical data, and CSV download
 3. Static File Server for the SCADA Dashboard
==============================================================================
"""

import os
import asyncio
import json
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .simulator import VirtualESP32
from .rule_engine import IndustrialRuleEngine
from .database import TelemetryDatabase

app = FastAPI(
    title="Smart IoT Industrial Equipment Monitor API",
    description="Software-Simulated IIoT SCADA Backend with ISO 10816-3 Fault Diagnostics",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Core Services
esp32_simulator = VirtualESP32()
rule_engine = IndustrialRuleEngine()
database = TelemetryDatabase()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# Background telemetry generator loop
async def telemetry_background_worker():
    while True:
        try:
            # 1. Generate virtual sensor telemetry
            packet = esp32_simulator.generate_telemetry()
            
            # 2. Run ISO 10816-3 condition monitoring analysis
            analysis = rule_engine.evaluate_telemetry(packet)
            
            # 3. Store to SQLite DB
            database.insert_telemetry(packet, analysis)

            # 4. Package combined payload for SCADA UI
            combined_payload = {
                "telemetry": packet,
                "diagnostics": analysis
            }

            # 5. Broadcast to all active WebSocket clients
            await manager.broadcast(json.dumps(combined_payload))
        except Exception as e:
            print(f"[Telemetry Worker Error]: {e}")
            
        await asyncio.sleep(1.0) # 1 Hz sampling rate

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_background_worker())

# WebSocket Endpoint
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive any incoming commands from UI
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "set_fault":
                    esp32_simulator.set_fault(cmd.get("fault_type"), cmd.get("state", True))
                elif cmd.get("action") == "clear_faults":
                    esp32_simulator.clear_all_faults()
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# REST API Endpoints
class FaultInjectionRequest(BaseModel):
    fault_type: str
    state: bool

@app.post("/api/fault/set")
def set_fault(req: FaultInjectionRequest):
    esp32_simulator.set_fault(req.fault_type, req.state)
    return {"status": "ok", "active_faults": [k for k, v in esp32_simulator.faults.items() if v]}

@app.post("/api/fault/clear-all")
def clear_faults():
    esp32_simulator.clear_all_faults()
    return {"status": "ok", "message": "All simulated faults cleared."}

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    packet = esp32_simulator.generate_telemetry()
    analysis = rule_engine.evaluate_telemetry(packet)
    return {"telemetry": packet, "diagnostics": analysis}

@app.get("/api/history")
def get_historical_telemetry(limit: int = 60):
    return {"records": database.get_recent_history(limit)}

@app.get("/api/alerts")
def get_alert_history(limit: int = 50):
    return {"alerts": database.get_recent_alerts(limit)}

@app.get("/api/export/csv")
def export_csv_report():
    csv_data = database.export_csv_string(limit=500)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=iot_equipment_telemetry_log.csv"}
    )

# Static & UI files mount
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
app.mount("/css", StaticFiles(directory=os.path.join(PROJECT_ROOT, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(PROJECT_ROOT, "js")), name="js")

@app.get("/", response_class=HTMLResponse)
def serve_dashboard():
    index_file = os.path.join(PROJECT_ROOT, "index.html")
    return FileResponse(index_file)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)

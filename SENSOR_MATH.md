# Mathematical & Physics Models for Sensor Simulation

This document provides the mathematical derivations and physics equations implemented in the simulation engine.

---

## 1. Motor Thermal Dissipation & Differential Equation

An electric induction motor generates heat through internal stator/rotor copper losses ($I^2 R$) and core magnetic hysteresis losses. The temperature rise follows a **first-order differential thermal model**:

$$\frac{dT(t)}{dt} = \frac{T_{\text{target}}(L) - T(t)}{\tau_{\text{thermal}}} + \mathcal{N}(0, \sigma^2)$$

Where:
- $T(t)$ = Current instantaneous motor stator temperature (°C)
- $T_{\text{ambient}}$ = Ambient air temperature ($27.5^\circ\text{C}$)
- $\tau_{\text{thermal}}$ = Thermal time constant of the motor housing ($\sim 70\text{ s}$ under forced cooling, $\sim 35\text{ s}$ under fan failure)
- $T_{\text{target}}(L) = T_{\text{ambient}} + k_{\text{load}} \cdot I^2_{\text{motor}}$
- $\mathcal{N}(0, \sigma^2)$ = Gaussian ADC thermal measurement noise ($\sigma = 0.25^\circ\text{C}$)

### Thermal Alarm Thresholds:
- **Zone 1 (Optimal Operating Band):** $40^\circ\text{C} \le T \le 65^\circ\text{C}$
- **Zone 2 (Warning Band - NEMA Insulation Degradation):** $75^\circ\text{C} \le T \le 88^\circ\text{C}$
- **Zone 3 (Critical Thermal Runaway / Trip Condition):** $T > 88^\circ\text{C}$

---

## 2. Vibration Dynamics & ISO 10816-3 Classification

Mechanical vibration velocity is measured in root-mean-square (**RMS**) amplitude in millimeters per second ($\text{mm/s}$):

$$v_{\text{RMS}} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} v(t_i)^2}$$

### Instantaneous Time-Domain Signal Model:
$$v(t) = A_1 \sin(2\pi f_0 t) + \sum_{k=2}^{m} A_k \sin(2\pi \cdot k f_0 t + \phi_k) + \eta(t)$$

Where:
- $f_0 = \frac{\text{RPM}}{60} = \frac{1450}{60} \approx 24.17\text{ Hz}$ (Fundamental 1X rotational frequency)
- $A_1$ = Fundamental shaft rotational unbalance amplitude
- $k f_0$ = Higher-order harmonics (e.g. 2X misalignment, Ball Pass Frequency Outer Race - BPFO)
- $\eta(t)$ = High-frequency broadband stochastic noise

### ISO 10816-3 Severity Matrix for Class II Industrial Machines (15 kW - 300 kW):
| Zone | RMS Velocity Range | Condition Evaluation | Action Required |
| :--- | :--- | :--- | :--- |
| **Zone A** | $v_{\text{RMS}} < 1.8\text{ mm/s}$ | **Good (Newly Commissioned)** | Normal operation |
| **Zone B** | $1.8 \le v_{\text{RMS}} < 2.8\text{ mm/s}$ | **Acceptable (Continuous Run)** | Normal operation |
| **Zone C** | $4.5 \le v_{\text{RMS}} < 7.1\text{ mm/s}$ | **Warning (Unsatisfactory)** | Plan maintenance within 48h |
| **Zone D** | $v_{\text{RMS}} \ge 7.1\text{ mm/s}$ | **Critical (Damaging Hazard)** | Emergency shutdown / lockout |

---

## 3. Electrical Power & Current Physics

For a symmetrical 3-phase AC squirrel-cage induction motor:

$$P_{\text{active}} = \frac{\sqrt{3} \cdot V_{\text{LL}} \cdot I_{\text{line}} \cdot \cos(\phi)}{1000} \quad [\text{kW}]$$

- $V_{\text{LL}}$ = Line-to-Line 3-phase RMS Voltage ($415\text{ V AC}$)
- $I_{\text{line}}$ = RMS Phase Current ($11.2\text{ A}$ nominal)
- $\cos(\phi)$ = Operating power factor ($\approx 0.86$)

When a **Grid Voltage Sag** occurs ($V_{\text{LL}} \downarrow 345\text{ V}$), the motor draws higher current ($I_{\text{line}} \uparrow 15.5\text{ A}$) to maintain electromagnetic output torque $T_e = \frac{P}{\omega_m}$, triggering an **Electrical Overload Advisory**.

---

## 4. Machine Health Index Scoring Algorithm

The composite machine health index $H(t) \in [0\%, 100\%]$ is computed as:

$$H(t) = 100 - \left[ w_T \cdot \max(0, T - 50) + w_V \cdot \max(0, v_{\text{RMS}} - 2.5) + w_E \cdot \Delta V_{\text{sag}} \right]$$

Where:
- $w_T = 1.2$ (Thermal penalty weighting)
- $w_V = 8.5$ (Vibration penalty weighting)
- $w_E = 15.0$ (Electrical grid deviation penalty)

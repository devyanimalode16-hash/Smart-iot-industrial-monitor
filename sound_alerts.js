/**
 * ==============================================================================
 * INDUSTRIAL SCADA AUDIO SYNTHESIZER (WEB AUDIO API)
 * ==============================================================================
 * Generates synthetic acoustic alarms:
 *  - Warning Alert: Dual-frequency soft pulse (600Hz / 800Hz)
 *  - Critical Emergency Siren: Two-tone alternating industrial alarm (440Hz / 880Hz)
 *  - Fault Cleared Chime: Ascending tri-tone notification
 * Zero external audio files required!
 * ==============================================================================
 */

class IndustrialSoundAlerts {
    constructor() {
        this.audioCtx = null;
        this.isMuted = false;
        this.isPlayingSiren = false;
        this.sirenInterval = null;
    }

    initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopCriticalSiren();
        }
        return this.isMuted;
    }

    playTone(freq, type = 'sine', duration = 0.25, gainLevel = 0.15) {
        if (this.isMuted) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(gainLevel, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn("Audio play prevented:", e);
        }
    }

    playWarningBeep() {
        if (this.isMuted || this.isPlayingSiren) return;
        this.playTone(650, 'triangle', 0.2, 0.12);
        setTimeout(() => this.playTone(850, 'triangle', 0.2, 0.12), 120);
    }

    startCriticalSiren() {
        if (this.isMuted || this.isPlayingSiren) return;
        this.isPlayingSiren = true;
        this.initAudioContext();

        let toggle = false;
        this.sirenInterval = setInterval(() => {
            if (this.isMuted || !this.isPlayingSiren) {
                this.stopCriticalSiren();
                return;
            }
            this.playTone(toggle ? 920 : 640, 'sawtooth', 0.35, 0.18);
            toggle = !toggle;
        }, 380);
    }

    stopCriticalSiren() {
        this.isPlayingSiren = false;
        if (this.sirenInterval) {
            clearInterval(this.sirenInterval);
            this.sirenInterval = null;
        }
    }

    playNormalChime() {
        if (this.isMuted) return;
        this.playTone(523.25, 'sine', 0.18, 0.1); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.18, 0.1), 100); // E5
        setTimeout(() => this.playTone(783.99, 'sine', 0.28, 0.12), 200); // G5
    }
}

// Attach globally
window.IndustrialSoundAlerts = IndustrialSoundAlerts;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Could not initialize AudioContext:', e);
    return null;
  }
}

/**
 * Plays a synthesized, high-quality Web Audio API sound effect.
 * Designed to be clean, subtle, and premium with perfect volume envelopes.
 */
export function playSound(type: 'deposit_submitted' | 'withdrawal_approved' | 'new_referral') {
  try {
    // Intercept if sounds are muted globally
    if (typeof window !== 'undefined' && localStorage.getItem('sound_muted') === 'true') {
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'deposit_submitted') {
      // Warm upward double-oscillator glide (harmonic and friendly)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(329.63, now); // E4
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.35); // E5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440.00, now); // A4
      osc2.frequency.exponentialRampToValueAtTime(554.37, now + 0.35); // C#5

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.03); // Soft fade-in
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // Gentle decay

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.38);
      osc2.stop(now + 0.38);
    } 
    else if (type === 'withdrawal_approved') {
      // Elegant crystal arpeggio (G5 -> B5 -> D6) representing payout wealth
      const playChime = (freq: number, startTime: number, duration: number) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.08, startTime + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      };

      playChime(783.99, now, 0.32);         // G5
      playChime(987.77, now + 0.08, 0.36);  // B5
      playChime(1174.66, now + 0.16, 0.45); // D6
    } 
    else if (type === 'new_referral') {
      // Bright, cheerful leap (E5 -> A5) celebrating new partners on boarding
      const playPluck = (freq: number, startTime: number, duration: number, vol: number) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      };

      playPluck(659.25, now, 0.18, 0.1);       // E5
      playPluck(880.00, now + 0.06, 0.28, 0.1); // A5
    }
  } catch (err) {
    console.warn('Audio playSound Web Audio API failure:', err);
  }
}

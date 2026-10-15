// Sistema de Efectos Sonoros y Vibración Háptica (Web Audio API)
// Diseñado para feedback instantáneo en puertas y puntos de acceso

const Sonidos = (function() {
  let audioCtx = null;

  function obtenerAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Reproducir un tono sintetizado
  function reproducirTono(frecuencia, tipo, duracion, retardo = 0, volumen = 0.25) {
    try {
      const ctx = obtenerAudioContext();
      if (!ctx) return;

      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = tipo; // 'sine', 'square', 'triangle', 'sawtooth'
        osc.frequency.setValueAtTime(frecuencia, ctx.currentTime);

        gain.gain.setValueAtTime(volumen, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duracion);
      }, retardo);
    } catch (e) {
      console.warn('Audio no disponible en este dispositivo:', e);
    }
  }

  return {
    // Acceso Aprobado: Tono doble ascendente armónico y vibración corta
    accesoAprobado() {
      reproducirTono(587.33, 'sine', 0.12, 0, 0.3);   // Re5 (D5)
      reproducirTono(880.00, 'sine', 0.25, 120, 0.3); // La5 (A5)
      if ('vibrate' in navigator) {
        try { navigator.vibrate([150]); } catch (e) {}
      }
    },

    // Reingreso Aprobado: Tono triple armónico
    reingresoAprobado() {
      reproducirTono(523.25, 'triangle', 0.1, 0, 0.3);   // Do5 (C5)
      reproducirTono(659.25, 'triangle', 0.1, 100, 0.3); // Mi5 (E5)
      reproducirTono(783.99, 'triangle', 0.2, 200, 0.3); // Sol5 (G5)
      if ('vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (e) {}
      }
    },

    // Acceso Denegado / Bloqueado: Bocina de alarma grave y estridente
    accesoDenegado() {
      reproducirTono(150, 'sawtooth', 0.25, 0, 0.4);
      reproducirTono(130, 'sawtooth', 0.45, 260, 0.45);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
      }
    },

    // Salida Registrada: Tono suave descendente
    salidaRegistrada() {
      reproducirTono(659.25, 'sine', 0.12, 0, 0.25);
      reproducirTono(440.00, 'sine', 0.2, 120, 0.25);
      if ('vibrate' in navigator) {
        try { navigator.vibrate([80]); } catch (e) {}
      }
    },

    // Clic / Acción de botón
    clic() {
      reproducirTono(800, 'sine', 0.04, 0, 0.1);
    }
  };
})();

// Inicializar AudioContext en el primer toque de pantalla
window.addEventListener('touchstart', function() {
  if (typeof Sonidos !== 'undefined') {
    // Activa el contexto de audio en iOS y Android
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !window.__audioIniciado) {
      window.__audioIniciado = true;
    }
  }
}, { once: true });

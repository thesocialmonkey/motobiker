/**
 * APLICACIÓN OFICIAL: PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS
 * Control de Acceso, Validación QR, Regla de 3 Usos y Generación de Entradas
 * 100% en Español, Arquitectura PWA Offline
 */

(function () {
  'use strict';

  // ========================================================
  // 1. CONSTANTES Y ESTADO GLOBAL
  // ========================================================
  const STORAGE_KEY_TICKETS = 'MTB_BARINAS_TICKETS_DB_v1';
  const STORAGE_KEY_FEED = 'MTB_BARINAS_LIVE_FEED_v1';

  // Modos de escaneo
  const MODOS = {
    ENTRADA: 'MODO_ENTRADA',
    SALIDA: 'MODO_SALIDA'
  };

  // Estados oficiales de una entrada
  const ESTADOS = {
    PENDIENTE: 'Pendiente por validar',
    DENTRO: 'Dentro del recinto',
    FUERA: 'Fuera del recinto',
    BLOQUEADO: 'BLOQUEADO'
  };

  // Estado de la aplicación
  let appState = {
    modoScanner: MODOS.ENTRADA, // 'MODO_ENTRADA' o 'MODO_SALIDA'
    filtroEstadoDB: 'todos',
    busquedaDB: '',
    html5QrCode: null,
    camaraActiva: false,
    dispositivosCamara: [],
    indiceCamaraActual: 0,
    ultimoEscaneoTimestamp: 0,
    ultimoTicketGenerado: null,
    deferredPrompt: null
  };

  // ========================================================
  // 2. SERVICIO DE ALMACENAMIENTO LOCAL (BASE DE DATOS)
  // ========================================================
  const DB = {
    obtenerTodos() {
      try {
        const data = localStorage.getItem(STORAGE_KEY_TICKETS);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        console.error('Error al leer tickets de localStorage:', e);
        return [];
      }
    },

    guardarTodos(tickets) {
      try {
        localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(tickets));
      } catch (e) {
        console.error('Error al guardar tickets en localStorage:', e);
        alert('Error: Espacio de almacenamiento local lleno o no disponible');
      }
    },

    buscarPorId(id) {
      if (!id) return null;
      const cleanId = id.toString().trim().toUpperCase();
      const tickets = DB.obtenerTodos();
      return tickets.find(t => t.id.toUpperCase() === cleanId) || null;
    },

    guardarTicket(ticket) {
      const tickets = DB.obtenerTodos();
      const index = tickets.findIndex(t => t.id === ticket.id);
      if (index >= 0) {
        tickets[index] = ticket;
      } else {
        tickets.unshift(ticket);
      }
      DB.guardarTodos(tickets);
      return ticket;
    },

    eliminarTicket(id) {
      let tickets = DB.obtenerTodos();
      tickets = tickets.filter(t => t.id !== id);
      DB.guardarTodos(tickets);
    },

    // Feed de Actividad en Vivo
    obtenerFeed() {
      try {
        const data = localStorage.getItem(STORAGE_KEY_FEED);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        return [];
      }
    },

    agregarEventoFeed(texto, tipo = 'info', badge = '') {
      const feed = DB.obtenerFeed();
      const ahora = new Date();
      
      // Formato de hora en español (Ej: "10:14 PM")
      let horas = ahora.getHours();
      const minutos = ahora.getMinutes().toString().padStart(2, '0');
      const ampm = horas >= 12 ? 'PM' : 'AM';
      horas = horas % 12;
      horas = horas ? horas : 12; // Hora '0' se convierte en '12'
      const horaFormateada = `${horas}:${minutos} ${ampm}`;

      const nuevoEvento = {
        id: 'EVT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        hora: horaFormateada,
        texto: texto,
        tipo: tipo, // 'ingreso', 'salida', 'denegado', 'creado'
        badge: badge,
        timestamp: ahora.toISOString()
      };

      feed.unshift(nuevoEvento);
      // Mantener los últimos 80 eventos
      if (feed.length > 80) feed.pop();

      try {
        localStorage.setItem(STORAGE_KEY_FEED, JSON.stringify(feed));
      } catch (e) {}

      renderizarFeed();
      actualizarMetricasDashboard();
      actualizarContadoresDB();
    },

    limpiarFeed() {
      localStorage.removeItem(STORAGE_KEY_FEED);
      renderizarFeed();
    }
  };

  // ========================================================
  // 3. UTILIDADES Y GENERACIÓN DE IDS
  // ========================================================
  function generarIdUnicoTicket() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const idGenerado = `MTB-${code}`;
    // Verificar si ya existe en la base de datos
    if (DB.buscarPorId(idGenerado)) {
      return generarIdUnicoTicket();
    }
    return idGenerado;
  }

  function limpiarNumeroTelefono(telefonoCompleto) {
    // Eliminar todo caracter que no sea dígito
    return (telefonoCompleto || '').replace(/\D/g, '');
  }

  function construirMensajeWhatsApp(ticket) {
    // Estructura oficial requerida en la especificación
    return `EVENTO: PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS
Titular: ${ticket.nombre}
Cédula/ID: ${ticket.cedula}
Teléfono: ${ticket.telefono}
Tipo de entrada: ${ticket.tipoEntrada}
Estado: ${ticket.estado}
ID de Entrada: ${ticket.id}Nota: Se ha generado la entrada digital con tu codigo QR, por favor conservarla para el dia del evento y presentar en la puerta, esta entrada es intransferible, si la pierde, debe adquirir una nueva entrada, esa entrada no se podrá compartir a otra persona.`;
  }

  function abrirWhatsApp(ticket) {
    const mensaje = construirMensajeWhatsApp(ticket);
    const numeroLimpio = limpiarNumeroTelefono(ticket.telefono);
    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }

  function renderizarCodigoQR(elementoContenedor, textoId, tamanio = 180) {
    elementoContenedor.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(elementoContenedor, {
        text: textoId, // Incrusta únicamente el Ticket ID
        width: tamanio,
        height: tamanio,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      elementoContenedor.innerHTML = `<div style="font-family: monospace; font-size: 16px; font-weight: bold; padding: 20px;">${textoId}</div>`;
    }
  }

  // ========================================================
  // 4. MÓDULO 1: GENERADOR DE ENTRADAS (GENERAR)
  // ========================================================
  const formGenerar = document.getElementById('form-generar-entrada');
  const contenedorTicketGenerado = document.getElementById('contenedor-ticket-generado');

  function inicializarModuloGenerador() {
    formGenerar.addEventListener('submit', function (e) {
      e.preventDefault();

      const nombre = document.getElementById('campo-nombre').value.trim();
      const cedula = document.getElementById('campo-cedula').value.trim();
      const codigoPais = document.getElementById('campo-codigo-pais').value.trim();
      const telefonoSinCodigo = document.getElementById('campo-telefono').value.trim();
      const tipoEntrada = document.getElementById('campo-tipo-entrada').value;

      if (!nombre || !cedula || !telefonoSinCodigo) {
        alert('Por favor complete todos los campos obligatorios.');
        return;
      }

      const telefonoCompleto = `${codigoPais} ${telefonoSinCodigo}`;

      // Backend Logic (On Submit):
      // 1. Generate Unique Ticket ID
      const idTicket = generarIdUnicoTicket();
      // 2. Set default Estado to "Pendiente por validar"
      // 3. Set default Contador de usos to 0
      const nuevoTicket = {
        id: idTicket,
        nombre: nombre,
        cedula: cedula,
        telefono: telefonoCompleto,
        tipoEntrada: tipoEntrada,
        estado: ESTADOS.PENDIENTE,
        contadorUsos: 0,
        fechaCreacion: new Date().toISOString(),
        historial: [
          {
            accion: 'Emisión de Entrada',
            timestamp: new Date().toISOString(),
            modo: 'Sistema'
          }
        ]
      };

      // Guardar en base de datos local
      DB.guardarTicket(nuevoTicket);
      appState.ultimoTicketGenerado = nuevoTicket;

      // Registrar evento en la Actividad en Vivo
      DB.agregarEventoFeed(
        `${nuevoTicket.nombre} - Entrada generada (${nuevoTicket.id})`,
        'creado',
        'GENERADA'
      );

      // Mostrar pase digital en pantalla con QR que incrusta solo el ID
      mostrarPaseDigital(nuevoTicket);

      // Automated Action (WhatsApp Sharing integration)
      abrirWhatsApp(nuevoTicket);

      // Limpiar campos del formulario
      document.getElementById('campo-nombre').value = '';
      document.getElementById('campo-cedula').value = '';
      document.getElementById('campo-telefono').value = '';

      Sonidos.accesoAprobado();
    });

    // Botones de acción del pase digital
    document.getElementById('btn-enviar-whatsapp').addEventListener('click', function () {
      if (appState.ultimoTicketGenerado) {
        abrirWhatsApp(appState.ultimoTicketGenerado);
      }
    });

    document.getElementById('btn-copiar-mensaje').addEventListener('click', function () {
      if (appState.ultimoTicketGenerado) {
        const texto = construirMensajeWhatsApp(appState.ultimoTicketGenerado);
        navigator.clipboard.writeText(texto).then(() => {
          alert('¡Mensaje para WhatsApp copiado al portapapeles!');
        }).catch(() => {
          alert('No se pudo copiar automáticamente.');
        });
      }
    });

    document.getElementById('btn-descargar-qr').addEventListener('click', function () {
      descargarPaseEnImagen();
    });
  }

  function mostrarPaseDigital(ticket) {
    document.getElementById('disp-ticket-id').textContent = ticket.id;
    document.getElementById('disp-ticket-nombre').textContent = ticket.nombre;
    document.getElementById('disp-ticket-cedula').textContent = ticket.cedula;
    document.getElementById('disp-ticket-telefono').textContent = ticket.telefono;
    document.getElementById('disp-ticket-tipo').textContent = ticket.tipoEntrada;
    document.getElementById('disp-ticket-estado').textContent = ticket.estado;
    document.getElementById('disp-ticket-usos').textContent = `${ticket.contadorUsos} de 3`;

    // Renderizar QR con Únicamente el ID
    const qrContenedor = document.getElementById('qr-canvas-contenedor');
    renderizarCodigoQR(qrContenedor, ticket.id, 190);

    contenedorTicketGenerado.style.display = 'block';
    contenedorTicketGenerado.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function descargarPaseEnImagen() {
    const qrCanvas = document.querySelector('#qr-canvas-contenedor canvas');
    if (!qrCanvas) {
      alert('El código QR aún no está listo para descargar.');
      return;
    }
    const link = document.createElement('a');
    link.download = `ENTRADA-${appState.ultimoTicketGenerado.id}.png`;
    link.href = qrCanvas.toDataURL('image/png');
    link.click();
  }

  // ========================================================
  // 5. MÓDULO 2: SCANNER & MANUAL CHECK (SCANNER)
  // ========================================================
  const btnModoEntrada = document.getElementById('btn-modo-entrada');
  const btnModoSalida = document.getElementById('btn-modo-salida');
  const bannerModoIndicador = document.getElementById('banner-modo-indicador');
  const textoBannerModo = document.getElementById('texto-banner-modo');
  const badgeBannerModo = document.getElementById('badge-banner-modo');

  const btnProcesarManual = document.getElementById('btn-procesar-manual');
  const campoIdManual = document.getElementById('campo-id-manual');

  const tarjetaResultado = document.getElementById('resultado-escaneo');
  const resTitulo = document.getElementById('resultado-titulo');
  const resMensaje = document.getElementById('resultado-mensaje');
  const resNombre = document.getElementById('res-nombre');
  const resCedula = document.getElementById('res-cedula');
  const resId = document.getElementById('res-id');
  const resTipo = document.getElementById('res-tipo');
  const resEstado = document.getElementById('res-estado');
  const resUsos = document.getElementById('res-usos');
  const resultadoIcono = document.getElementById('resultado-icono');

  function inicializarModuloScanner() {
    // Modo Selección: Dos botones explícitos obligatorios
    btnModoEntrada.addEventListener('click', function () {
      establecerModoScanner(MODOS.ENTRADA);
      Sonidos.clic();
    });

    btnModoSalida.addEventListener('click', function () {
      establecerModoScanner(MODOS.SALIDA);
      Sonidos.clic();
    });

    // Validación Manual (Botón y Enter)
    btnProcesarManual.addEventListener('click', function () {
      procesarIdManual();
    });

    campoIdManual.addEventListener('keyup', function (e) {
      if (e.key === 'Enter') {
        procesarIdManual();
      }
    });

    // Controles de cámara
    document.getElementById('btn-toggle-camara').addEventListener('click', alternarCamara);
    document.getElementById('btn-cambiar-camara').addEventListener('click', cambiarLenteCamara);
    document.getElementById('input-archivo-qr').addEventListener('change', procesarArchivoImagenQR);
  }

  function establecerModoScanner(nuevoModo) {
    appState.modoScanner = nuevoModo;

    if (nuevoModo === MODOS.ENTRADA) {
      btnModoEntrada.classList.add('activo');
      btnModoSalida.classList.remove('activo');

      bannerModoIndicador.className = 'banner-modo-actual entrada';
      textoBannerModo.textContent = 'MODO ACTIVO: INGRESO DE PERSONAS (MODO ENTRADA)';
      badgeBannerModo.textContent = 'ENTRADA';
      badgeBannerModo.className = 'badge-estado dentro';
    } else {
      btnModoEntrada.classList.remove('activo');
      btnModoSalida.classList.add('activo');

      bannerModoIndicador.className = 'banner-modo-actual salida';
      textoBannerModo.textContent = 'MODO ACTIVO: SALIDA DE PERSONAS (MODO SALIDA)';
      badgeBannerModo.textContent = 'SALIDA';
      badgeBannerModo.className = 'badge-estado fuera';
    }
  }

  function procesarIdManual() {
    const idIngresado = campoIdManual.value.trim().toUpperCase();
    if (!idIngresado) {
      alert('Por favor ingrese un ID de Entrada para validar.');
      return;
    }
    validarTicketSegunReglas(idIngresado);
    campoIdManual.value = '';
  }

  // ========================================================
  // REGLAS ESTRICTAS DE ACCESO Y STRIKES (THE 3-ENTRY RULE)
  // ========================================================
  /**
   * Access & Strike Logic (The 3-Entry Rule):
   * 1. ID procesado bajo "Modo Entrada" por primera vez:
   *    Increment Contador de usos by 1. Change Estado to "Dentro del recinto". Approve access.
   * 2. ID procesado bajo "Modo Salida":
   *    Change Estado to "Fuera del recinto".
   * 3. ID procesado bajo "Modo Entrada" como reingreso:
   *    Increment Contador de usos by 1.
   * 4. Lock Condition:
   *    If Contador de usos > 3, immediately update record Estado to "BLOQUEADO".
   *    Deny entry and trigger on-screen warning alert: "Acceso denegado: Límite de reingresos superado".
   */
  function validarTicketSegunReglas(idTicketEscaneado) {
    const ahora = Date.now();
    // Evitar escaneos duplicados en menos de 1.8 segundos para el mismo ID
    if (ahora - appState.ultimoEscaneoTimestamp < 1800) {
      return;
    }
    appState.ultimoEscaneoTimestamp = ahora;

    const ticket = DB.buscarPorId(idTicketEscaneado);

    // CASO 1: TICKET NO ENCONTRADO EN BASE DE DATOS
    if (!ticket) {
      mostrarFeedbackAcceso({
        tipo: 'denegado',
        titulo: 'Acceso Denegado',
        mensaje: `Entrada "${idTicketEscaneado}" no encontrada en la base de datos local.`,
        ticket: {
          id: idTicketEscaneado,
          nombre: 'DESCONOCIDO',
          cedula: 'N/A',
          tipoEntrada: 'N/A',
          estado: 'NO REGISTRADA',
          contadorUsos: '-'
        }
      });
      Sonidos.accesoDenegado();
      DB.agregarEventoFeed(`ID #${idTicketEscaneado} ACCESO DENEGADO (No encontrado)`, 'denegado', 'ERROR');
      return;
    }

    const modoActual = appState.modoScanner;

    // CASO 2: TICKET YA BLOQUEADO PREVIAMENTE
    if (ticket.estado === ESTADOS.BLOQUEADO) {
      mostrarFeedbackAcceso({
        tipo: 'denegado',
        titulo: 'Acceso Denegado: Límite Superado',
        mensaje: 'Acceso denegado: Límite de reingresos superado (Entrada BLOQUEADA)',
        ticket: ticket
      });
      Sonidos.accesoDenegado();
      DB.agregarEventoFeed(`ID #${ticket.id} ACCESO DENEGADO (Bloqueado)`, 'bloqueado', 'BLOQUEADO');
      return;
    }

    // ========================================================
    // EVALUACIÓN EN MODO ENTRADA
    // ========================================================
    if (modoActual === MODOS.ENTRADA) {
      // 1. Incrementar contador de usos
      ticket.contadorUsos = (Number(ticket.contadorUsos) || 0) + 1;

      // 4. LOCK CONDITION: Si Contador de usos > 3
      if (ticket.contadorUsos > 3) {
        ticket.estado = ESTADOS.BLOQUEADO;
        ticket.historial = ticket.historial || [];
        ticket.historial.push({
          accion: 'Bloqueo automático por límite de reingresos',
          usos: ticket.contadorUsos,
          timestamp: new Date().toISOString()
        });

        DB.guardarTicket(ticket);

        mostrarFeedbackAcceso({
          tipo: 'denegado',
          titulo: 'Acceso Denegado: Límite Superado',
          mensaje: 'Acceso denegado: Límite de reingresos superado',
          ticket: ticket
        });

        Sonidos.accesoDenegado();
        DB.agregarEventoFeed(`ID #${ticket.id} ACCESO DENEGADO: Límite de reingresos superado`, 'bloqueado', 'BLOQUEADO');
        return;
      }

      // Si Contador de usos es 1 (Primera Entrada)
      if (ticket.contadorUsos === 1) {
        ticket.estado = ESTADOS.DENTRO;
        ticket.historial = ticket.historial || [];
        ticket.historial.push({
          accion: 'Primer Ingreso',
          usos: ticket.contadorUsos,
          timestamp: new Date().toISOString()
        });

        DB.guardarTicket(ticket);

        mostrarFeedbackAcceso({
          tipo: 'aprobado',
          titulo: 'Acceso Aprobado',
          mensaje: `Primer ingreso registrado exitosamente (Uso 1 de 3). ¡Bienvenido al evento!`,
          ticket: ticket
        });

        Sonidos.accesoAprobado();
        DB.agregarEventoFeed(`${ticket.nombre} ingresó (Uso 1 de 3)`, 'ingreso', 'INGRESO');
        return;
      }

      // Si Contador de usos es 2 o 3 (Reingreso Permitido)
      if (ticket.contadorUsos <= 3) {
        ticket.estado = ESTADOS.DENTRO;
        ticket.historial = ticket.historial || [];
        ticket.historial.push({
          accion: 'Reingreso Autorizado',
          usos: ticket.contadorUsos,
          timestamp: new Date().toISOString()
        });

        DB.guardarTicket(ticket);

        mostrarFeedbackAcceso({
          tipo: 'aprobado',
          titulo: 'Reingreso Aprobado',
          mensaje: `Reingreso autorizado. Uso ${ticket.contadorUsos} de 3 permitidos.`,
          ticket: ticket
        });

        Sonidos.reingresoAprobado();
        DB.agregarEventoFeed(`${ticket.nombre} reingresó (Uso ${ticket.contadorUsos} de 3)`, 'ingreso', 'REINGRESO');
        return;
      }
    }

    // ========================================================
    // EVALUACIÓN EN MODO SALIDA
    // ========================================================
    if (modoActual === MODOS.SALIDA) {
      ticket.estado = ESTADOS.FUERA;
      ticket.historial = ticket.historial || [];
      ticket.historial.push({
        accion: 'Salida del Recinto',
        timestamp: new Date().toISOString()
      });

      DB.guardarTicket(ticket);

      mostrarFeedbackAcceso({
        tipo: 'salida',
        titulo: 'Salida Registrada',
        mensaje: `Salida registrada para ${ticket.nombre}. Estado actualizado a "Fuera del recinto".`,
        ticket: ticket
      });

      Sonidos.salidaRegistrada();
      DB.agregarEventoFeed(`ID #${ticket.id} (${ticket.nombre}) salió`, 'salida', 'SALIDA');
      return;
    }
  }

  function mostrarFeedbackAcceso({ tipo, titulo, mensaje, ticket }) {
    tarjetaResultado.className = `resultado-escaneo activo ${tipo}`;
    resTitulo.textContent = titulo;
    resMensaje.textContent = mensaje;

    resNombre.textContent = ticket.nombre || '-';
    resCedula.textContent = ticket.cedula || '-';
    resId.textContent = ticket.id || '-';
    resTipo.textContent = ticket.tipoEntrada || '-';
    resEstado.textContent = ticket.estado || '-';
    resUsos.textContent = `${ticket.contadorUsos} de 3`;

    // Icono correspondiente
    if (tipo === 'aprobado') {
      resultadoIcono.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (tipo === 'denegado') {
      resultadoIcono.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    } else if (tipo === 'salida') {
      resultadoIcono.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    }

    tarjetaResultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ========================================================
  // CÁMARA Y ESCÁNER HTML5
  // ========================================================
  async function alternarCamara() {
    if (appState.camaraActiva) {
      detenerCamara();
    } else {
      iniciarCamara();
    }
  }

  async function iniciarCamara() {
    if (typeof Html5Qrcode === 'undefined') {
      alert('La librería del escáner no se ha cargado todavía.');
      return;
    }

    try {
      if (!appState.html5QrCode) {
        appState.html5QrCode = new Html5Qrcode("lector-qr");
      }

      // Obtener cámaras disponibles
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        alert('No se detectaron cámaras en este dispositivo.');
        return;
      }

      appState.dispositivosCamara = devices;
      const btnCambiarLente = document.getElementById('btn-cambiar-camara');
      if (devices.length > 1) {
        btnCambiarLente.style.display = 'inline-flex';
      }

      // Preferir la cámara trasera
      const cameraId = devices[appState.indiceCamaraActual].id;
      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await appState.html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          // Callback de lectura exitosa de QR
          validarTicketSegunReglas(decodedText);
        },
        () => {
          // Error de frame (ignorar para no saturar consola)
        }
      );

      appState.camaraActiva = true;
      document.getElementById('texto-btn-camara').textContent = 'Detener Cámara';
      document.getElementById('scanner-placeholder').style.display = 'none';
    } catch (err) {
      console.error('Error al iniciar la cámara:', err);
      alert('Permiso de cámara denegado o error al acceder a la cámara. Puedes ingresar el ID manualmente en "Ingresar ID Manual".');
    }
  }

  async function detenerCamara() {
    if (appState.html5QrCode && appState.camaraActiva) {
      try {
        await appState.html5QrCode.stop();
      } catch (e) {
        console.warn('Error al detener cámara:', e);
      }
      appState.camaraActiva = false;
      document.getElementById('texto-btn-camara').textContent = 'Iniciar Cámara';
      document.getElementById('scanner-placeholder').style.display = 'block';
    }
  }

  async function cambiarLenteCamara() {
    if (appState.dispositivosCamara.length <= 1) return;
    await detenerCamara();
    appState.indiceCamaraActual = (appState.indiceCamaraActual + 1) % appState.dispositivosCamara.length;
    await iniciarCamara();
  }

  function procesarArchivoImagenQR(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!appState.html5QrCode) {
      appState.html5QrCode = new Html5Qrcode("lector-qr");
    }

    appState.html5QrCode.scanFile(file, true)
      .then(decodedText => {
        validarTicketSegunReglas(decodedText);
      })
      .catch(err => {
        alert('No se detectó ningún código QR en la imagen seleccionada.');
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  // ========================================================
  // 6. MÓDULO 3: LIVE CONTROL PANEL (DASHBOARD)
  // ========================================================
  const metricaGeneradas = document.getElementById('metrica-generadas');
  const metricaDentro = document.getElementById('metrica-dentro');
  const metricaFuera = document.getElementById('metrica-fuera');
  const metricaPendientes = document.getElementById('metrica-pendientes');
  const feedListaStream = document.getElementById('feed-lista-stream');

  function actualizarMetricasDashboard() {
    const tickets = DB.obtenerTodos();

    const totalGeneradas = tickets.length;
    const totalDentro = tickets.filter(t => t.estado === ESTADOS.DENTRO).length;
    const totalFuera = tickets.filter(t => t.estado === ESTADOS.FUERA).length;
    const totalPendientes = tickets.filter(t => t.estado === ESTADOS.PENDIENTE).length;

    metricaGeneradas.textContent = totalGeneradas;
    metricaDentro.textContent = totalDentro;
    metricaFuera.textContent = totalFuera;
    metricaPendientes.textContent = totalPendientes;
  }

  function renderizarFeed() {
    const feed = DB.obtenerFeed();
    if (!feed || feed.length === 0) {
      feedListaStream.innerHTML = `
        <div class="feed-item" style="color: var(--text-muted); font-size: 12px; justify-content: center;">
          Esperando escaneos o emisiones de entradas...
        </div>
      `;
      return;
    }

    feedListaStream.innerHTML = feed.map(ev => {
      let claseBadge = 'ingreso';
      if (ev.tipo === 'salida') claseBadge = 'salida';
      if (ev.tipo === 'denegado' || ev.tipo === 'bloqueado') claseBadge = 'denegado';
      if (ev.tipo === 'creado') claseBadge = 'creado';

      return `
        <div class="feed-item ${ev.tipo}">
          <span class="feed-hora">${ev.hora}</span>
          <span class="feed-texto">${ev.texto}</span>
          ${ev.badge ? `<span class="feed-badge ${claseBadge}">${ev.badge}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  // ========================================================
  // 7. MÓDULO 4: LOCAL RECORDS MANAGEMENT (BASE DE DATOS)
  // ========================================================
  const campoBusquedaDB = document.getElementById('campo-busqueda-db');
  const cuerpoTablaDB = document.getElementById('cuerpo-tabla-db');
  const contadorFilasTotal = document.getElementById('contador-filas-total');

  function inicializarModuloDatabase() {
    // Barra de Búsqueda instantánea (3 campos: Cédula, Nombre o Teléfono)
    campoBusquedaDB.addEventListener('input', function (e) {
      appState.busquedaDB = e.target.value.toLowerCase().trim();
      renderizarTablaDB();
    });

    // Filtros por Estado
    const chipsFiltro = document.querySelectorAll('.chip-filtro');
    chipsFiltro.forEach(chip => {
      chip.addEventListener('click', function () {
        chipsFiltro.forEach(c => c.classList.remove('activo'));
        chip.classList.add('activo');
        appState.filtroEstadoDB = chip.getAttribute('data-filtro');
        renderizarTablaDB();
      });
    });

    // Exportar Base de Datos
    document.getElementById('btn-exportar-db').addEventListener('click', exportarBaseDeDatos);

    // Importar Base de Datos
    const inputArchivoDB = document.getElementById('input-archivo-db');
    document.getElementById('btn-importar-db').addEventListener('click', () => {
      inputArchivoDB.click();
    });

    inputArchivoDB.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        try {
          const contenido = event.target.result;
          let registrosImportados = [];

          if (file.name.endsWith('.csv')) {
            registrosImportados = parsearCSV(contenido);
          } else {
            registrosImportados = JSON.parse(contenido);
          }

          if (!Array.isArray(registrosImportados)) {
            throw new Error('El formato del archivo no es una lista de registros válida.');
          }

          // Guardar contenido temporal y abrir modal de confirmación
          window.__datosAImportar = registrosImportados;
          abrirModalImportacion();
        } catch (err) {
          alert('Error al leer el archivo: ' + err.message);
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    });

    // Modal Importar: Combinar
    document.getElementById('btn-import-merge').addEventListener('click', function () {
      if (window.__datosAImportar) {
        combinarRegistrosDB(window.__datosAImportar);
        cerrarModalImportacion();
        alert('Registros importados y combinados con éxito.');
      }
    });

    // Modal Importar: Reemplazar
    document.getElementById('btn-import-replace').addEventListener('click', function () {
      if (window.__datosAImportar) {
        if (confirm('¿Está seguro de que desea SOBRESCRIBIR todos los datos locales? Esta acción no se puede deshacer.')) {
          DB.guardarTodos(window.__datosAImportar);
          cerrarModalImportacion();
          renderizarTablaDB();
          actualizarMetricasDashboard();
          actualizarContadoresDB();
          DB.agregarEventoFeed('Base de datos reemplazada por importación externa', 'creado', 'SYNC');
          alert('Base de datos reemplazada con éxito.');
        }
      }
    });

    // Datos Demo
    document.getElementById('btn-demo-datos').addEventListener('click', cargarDatosDemostracion);

    // Limpiar feed
    document.getElementById('btn-limpiar-feed').addEventListener('click', function () {
      if (confirm('¿Desea limpiar el feed de actividad en vivo?')) {
        DB.limpiarFeed();
      }
    });

    // Modales: Cerrar
    document.getElementById('btn-cerrar-modal-qr').addEventListener('click', cerrarModalQR);
    document.getElementById('btn-cerrar-modal-editar').addEventListener('click', cerrarModalEditar);
    document.getElementById('btn-cerrar-modal-importar').addEventListener('click', cerrarModalImportacion);

    // Formulario de Edición
    document.getElementById('form-editar-registro').addEventListener('submit', guardarEdicionRegistro);
    document.getElementById('btn-eliminar-registro').addEventListener('click', eliminarRegistroDesdeModal);
  }

  function renderizarTablaDB() {
    const tickets = DB.obtenerTodos();
    const query = appState.busquedaDB;
    const filtro = appState.filtroEstadoDB;

    // Filtrar por texto (Cédula, Nombre o Teléfono)
    let filtrados = tickets.filter(t => {
      const matchQuery = !query ||
        (t.nombre && t.nombre.toLowerCase().includes(query)) ||
        (t.cedula && t.cedula.toLowerCase().includes(query)) ||
        (t.telefono && t.telefono.toLowerCase().includes(query)) ||
        (t.id && t.id.toLowerCase().includes(query));

      const matchFiltro = filtro === 'todos' || t.estado === filtro;

      return matchQuery && matchFiltro;
    });

    contadorFilasTotal.textContent = filtrados.length;

    if (filtrados.length === 0) {
      cuerpoTablaDB.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
            No se encontraron entradas que coincidan con la búsqueda o filtro.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTablaDB.innerHTML = filtrados.map(t => {
      // Clase para el badge de estado
      let claseEstado = 'pendiente';
      if (t.estado === ESTADOS.DENTRO) claseEstado = 'dentro';
      if (t.estado === ESTADOS.FUERA) claseEstado = 'fuera';
      if (t.estado === ESTADOS.BLOQUEADO) claseEstado = 'bloqueado';

      // Badge de usos
      let claseUsos = 'strike-1';
      if (t.contadorUsos === 2) claseUsos = 'strike-2';
      if (t.contadorUsos === 3) claseUsos = 'strike-3';
      if (t.contadorUsos > 3) claseUsos = 'strike-max';

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 800; color: var(--primary);">${t.id}</td>
          <td style="font-weight: 700;">${t.nombre}</td>
          <td>${t.cedula}</td>
          <td>${t.telefono}</td>
          <td><span style="font-size: 11px; font-weight: 700; color: #cbd5e1;">${t.tipoEntrada}</span></td>
          <td><span class="badge-estado ${claseEstado}">${t.estado}</span></td>
          <td><span class="badge-contador ${claseUsos}">${t.contadorUsos} / 3</span></td>
          <td style="text-align: right;">
            <div class="acciones-fila" style="justify-content: flex-end;">
              <button type="button" class="btn-accion-fila" onclick="window.abrirModalQR('${t.id}')" title="Ver Código QR">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01"/></svg>
                Ver QR
              </button>
              <button type="button" class="btn-accion-fila whatsapp" onclick="window.reenviarWhatsAppDesdeFila('${t.id}')" title="Reenviar por WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-5.805 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.316 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.717-.981zm11.233-7.518c-.09-.15-.33-.24-.69-.42-.36-.18-2.13-1.05-2.46-1.17-.33-.12-.57-.18-.81.18-.24.36-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.79-1.07-.96-1.8-2.14-2.01-2.5-.21-.36-.02-.56.16-.74.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.3-.72-.6-1.12-.81-1.13-.21-.01-.45-.01-.69-.01-.24 0-.63.09-.96.45s-1.26 1.23-1.26 3c0 1.77 1.29 3.48 1.47 3.72.18.24 2.54 3.88 6.16 5.44.86.37 1.53.59 2.06.76.87.28 1.66.24 2.29.15.7-.1 2.13-.87 2.43-1.71.3-.84.3-1.56.21-1.71z"/></svg>
                Reenviar
              </button>
              <button type="button" class="btn-accion-fila" onclick="window.abrirModalEditar('${t.id}')" title="Editar Registro">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Editar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function actualizarContadoresDB() {
    const tickets = DB.obtenerTodos();
    document.getElementById('cont-filtro-todos').textContent = tickets.length;
    document.getElementById('cont-filtro-dentro').textContent = tickets.filter(t => t.estado === ESTADOS.DENTRO).length;
    document.getElementById('cont-filtro-fuera').textContent = tickets.filter(t => t.estado === ESTADOS.FUERA).length;
    document.getElementById('cont-filtro-pendientes').textContent = tickets.filter(t => t.estado === ESTADOS.PENDIENTE).length;
    document.getElementById('cont-filtro-bloqueados').textContent = tickets.filter(t => t.estado === ESTADOS.BLOQUEADO).length;
  }

  // ========================================================
  // EXPORTACIÓN / IMPORTACIÓN (SINCRONIZACIÓN)
  // ========================================================
  function exportarBaseDeDatos() {
    const tickets = DB.obtenerTodos();
    if (tickets.length === 0) {
      alert('No hay registros en la base de datos para exportar.');
      return;
    }

    const formato = confirm('¿Desea exportar en formato JSON (Recomendado para sincronización entre teléfonos)?\n\nPresione [Aceptar] para JSON, o [Cancelar] para CSV (Excel).') ? 'json' : 'csv';

    let contenido = '';
    let nombreArchivo = '';
    let mimeType = '';

    const timestamp = new Date().toISOString().slice(0, 10);

    if (formato === 'json') {
      contenido = JSON.stringify(tickets, null, 2);
      nombreArchivo = `MTB-BARINAS-BASE-DATOS-${timestamp}.json`;
      mimeType = 'application/json';
    } else {
      // Exportar en CSV
      const headers = ['ID', 'Nombre Completo', 'Cedula', 'Telefono', 'Tipo Entrada', 'Estado', 'Contador Usos', 'Fecha Creacion'];
      const rows = tickets.map(t => [
        `"${t.id}"`,
        `"${(t.nombre || '').replace(/"/g, '""')}"`,
        `"${(t.cedula || '').replace(/"/g, '""')}"`,
        `"${(t.telefono || '').replace(/"/g, '""')}"`,
        `"${t.tipoEntrada || ''}"`,
        `"${t.estado || ''}"`,
        t.contadorUsos || 0,
        `"${t.fechaCreacion || ''}"`
      ]);
      contenido = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      nombreArchivo = `MTB-BARINAS-BASE-DATOS-${timestamp}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
    }

    const blob = new Blob([contenido], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parsearCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/(^"|"$)/g, '').trim());
    const resultados = [];

    for (let i = 1; i < lines.length; i++) {
      // Regex para separar por coma respetando comillas
      const valores = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      if (valores.length >= 4) {
        const clean = valores.map(v => v.replace(/^"|"$/g, '').trim());
        resultados.push({
          id: clean[0] || generarIdUnicoTicket(),
          nombre: clean[1] || 'Sin Nombre',
          cedula: clean[2] || 'S/C',
          telefono: clean[3] || '',
          tipoEntrada: clean[4] || 'General',
          estado: clean[5] || ESTADOS.PENDIENTE,
          contadorUsos: Number(clean[6]) || 0,
          fechaCreacion: clean[7] || new Date().toISOString()
        });
      }
    }
    return resultados;
  }

  function combinarRegistrosDB(nuevosRegistros) {
    const existentes = DB.obtenerTodos();
    const mapa = new Map();

    existentes.forEach(t => mapa.set(t.id, t));
    nuevosRegistros.forEach(t => {
      if (t.id) {
        // Si ya existe, combinar dando preferencia al que tenga mayor avance en estado/usos
        if (mapa.has(t.id)) {
          const anterior = mapa.get(t.id);
          mapa.set(t.id, {
            ...anterior,
            ...t,
            contadorUsos: Math.max(anterior.contadorUsos || 0, t.contadorUsos || 0),
            estado: (t.estado === ESTADOS.BLOQUEADO || anterior.estado === ESTADOS.BLOQUEADO) ? ESTADOS.BLOQUEADO : t.estado
          });
        } else {
          mapa.set(t.id, t);
        }
      }
    });

    const listaFinal = Array.from(mapa.values());
    DB.guardarTodos(listaFinal);

    renderizarTablaDB();
    actualizarMetricasDashboard();
    actualizarContadoresDB();
    DB.agregarEventoFeed(`Base de datos sincronizada (+${nuevosRegistros.length} registros combinados)`, 'creado', 'SYNC');
  }

  function abrirModalImportacion() {
    document.getElementById('modal-importar-modo').classList.add('activo');
  }
  function cerrarModalImportacion() {
    document.getElementById('modal-importar-modo').classList.remove('activo');
    window.__datosAImportar = null;
  }

  // ========================================================
  // MODALES: VER QR Y EDITAR
  // ========================================================
  window.abrirModalQR = function (id) {
    const ticket = DB.buscarPorId(id);
    if (!ticket) return;

    document.getElementById('modal-qr-id').textContent = ticket.id;
    document.getElementById('modal-qr-nombre').textContent = ticket.nombre;
    document.getElementById('modal-qr-cedula').textContent = ticket.cedula;
    document.getElementById('modal-qr-tipo').textContent = ticket.tipoEntrada;
    document.getElementById('modal-qr-estado').textContent = ticket.estado;

    const qrBox = document.getElementById('modal-qr-box');
    renderizarCodigoQR(qrBox, ticket.id, 200);

    document.getElementById('modal-btn-whatsapp').onclick = function () {
      abrirWhatsApp(ticket);
    };

    document.getElementById('modal-btn-descargar').onclick = function () {
      const qrCanvas = qrBox.querySelector('canvas');
      if (qrCanvas) {
        const a = document.createElement('a');
        a.download = `QR-${ticket.id}.png`;
        a.href = qrCanvas.toDataURL('image/png');
        a.click();
      }
    };

    document.getElementById('modal-ver-qr').classList.add('activo');
  };

  function cerrarModalQR() {
    document.getElementById('modal-ver-qr').classList.remove('activo');
  }

  window.reenviarWhatsAppDesdeFila = function (id) {
    const ticket = DB.buscarPorId(id);
    if (ticket) {
      abrirWhatsApp(ticket);
    }
  };

  window.abrirModalEditar = function (id) {
    const ticket = DB.buscarPorId(id);
    if (!ticket) return;

    document.getElementById('edit-ticket-id').value = ticket.id;
    document.getElementById('edit-nombre').value = ticket.nombre;
    document.getElementById('edit-cedula').value = ticket.cedula;
    document.getElementById('edit-telefono').value = ticket.telefono;
    document.getElementById('edit-tipo').value = ticket.tipoEntrada;
    document.getElementById('edit-estado').value = ticket.estado;
    document.getElementById('edit-usos').value = ticket.contadorUsos;

    document.getElementById('modal-editar').classList.add('activo');
  };

  function cerrarModalEditar() {
    document.getElementById('modal-editar').classList.remove('activo');
  }

  function guardarEdicionRegistro(e) {
    e.preventDefault();
    const id = document.getElementById('edit-ticket-id').value;
    const ticket = DB.buscarPorId(id);
    if (!ticket) return;

    ticket.nombre = document.getElementById('edit-nombre').value.trim();
    ticket.cedula = document.getElementById('edit-cedula').value.trim();
    ticket.telefono = document.getElementById('edit-telefono').value.trim();
    ticket.tipoEntrada = document.getElementById('edit-tipo').value;
    ticket.estado = document.getElementById('edit-estado').value;
    ticket.contadorUsos = Number(document.getElementById('edit-usos').value) || 0;

    DB.guardarTicket(ticket);
    cerrarModalEditar();

    renderizarTablaDB();
    actualizarMetricasDashboard();
    actualizarContadoresDB();
    DB.agregarEventoFeed(`Ticket #${ticket.id} modificado por el operador`, 'creado', 'EDIT');
  }

  function eliminarRegistroDesdeModal() {
    const id = document.getElementById('edit-ticket-id').value;
    if (confirm(`¿Está seguro de que desea eliminar permanentemente la entrada #${id}?`)) {
      DB.eliminarTicket(id);
      cerrarModalEditar();
      renderizarTablaDB();
      actualizarMetricasDashboard();
      actualizarContadoresDB();
      DB.agregarEventoFeed(`Ticket #${id} eliminado de la base de datos`, 'denegado', 'BORRADO');
    }
  }

  // ========================================================
  // DATOS DE DEMOSTRACIÓN
  // ========================================================
  function cargarDatosDemostracion() {
    const datosDemo = [
      {
        id: 'MTB-DEMO1',
        nombre: 'Carlos Eduardo Mendoza',
        cedula: 'V-18.456.789',
        telefono: '+58 4141234567',
        tipoEntrada: 'VIP',
        estado: ESTADOS.PENDIENTE,
        contadorUsos: 0,
        fechaCreacion: new Date().toISOString()
      },
      {
        id: 'MTB-DEMO2',
        nombre: 'Valeria Sofía Rivas',
        cedula: 'V-22.109.876',
        telefono: '+58 4129876543',
        tipoEntrada: 'Piloto',
        estado: ESTADOS.DENTRO,
        contadorUsos: 1,
        fechaCreacion: new Date().toISOString()
      },
      {
        id: 'MTB-DEMO3',
        nombre: 'Alejandro Morales',
        cedula: 'V-15.342.112',
        telefono: '+58 4245558899',
        tipoEntrada: 'General',
        estado: ESTADOS.FUERA,
        contadorUsos: 2,
        fechaCreacion: new Date().toISOString()
      },
      {
        id: 'MTB-DEMO4',
        nombre: 'José Antonio Páez',
        cedula: 'V-12.876.543',
        telefono: '+58 4160001122',
        tipoEntrada: 'Invitado Especial',
        estado: ESTADOS.BLOQUEADO,
        contadorUsos: 4,
        fechaCreacion: new Date().toISOString()
      }
    ];

    combinarRegistrosDB(datosDemo);
    alert('Se han cargado 4 entradas de demostración con diferentes estados y usos para pruebas.');
  }

  // ========================================================
  // 8. NAVEGACIÓN ENTRE MÓDULOS (TABS)
  // ========================================================
  function inicializarNavegacion() {
    const botonesNav = document.querySelectorAll('.barra-navegacion .nav-item');
    const vistas = document.querySelectorAll('.vista-modulo');

    botonesNav.forEach(boton => {
      boton.addEventListener('click', function () {
        const targetModuloId = boton.getAttribute('data-modulo');

        // Actualizar botones de barra de navegación
        botonesNav.forEach(b => b.classList.remove('activo'));
        boton.classList.add('activo');

        // Mostrar módulo activo
        vistas.forEach(vista => {
          if (vista.id === targetModuloId) {
            vista.classList.add('activa');
          } else {
            vista.classList.remove('activa');
          }
        });

        // Acciones específicas al entrar a una vista
        if (targetModuloId === 'modulo-scanner') {
          // Si entra a scanner y no está activa la cámara, opcionalmente sugerir o enfocar input manual
          document.getElementById('campo-id-manual').focus();
        } else {
          // Si sale de scanner, apagar cámara para ahorrar batería
          detenerCamara();
        }

        if (targetModuloId === 'modulo-dashboard') {
          actualizarMetricasDashboard();
          renderizarFeed();
        }

        if (targetModuloId === 'modulo-database') {
          renderizarTablaDB();
          actualizarContadoresDB();
        }

        Sonidos.clic();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ========================================================
  // 9. RELOJ EN VIVO Y PWA
  // ========================================================
  function inicializarReloj() {
    const relojEl = document.getElementById('reloj-vivo');
    function tick() {
      const ahora = new Date();
      let horas = ahora.getHours();
      const minutos = ahora.getMinutes().toString().padStart(2, '0');
      const segundos = ahora.getSeconds().toString().padStart(2, '0');
      const ampm = horas >= 12 ? 'PM' : 'AM';
      horas = horas % 12;
      horas = horas ? horas : 12;
      relojEl.textContent = `${horas}:${minutos}:${segundos} ${ampm}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  function inicializarPWA() {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('[PWA] Service Worker registrado con éxito:', reg.scope);
        }).catch(err => {
          console.warn('[PWA] Fallo al registrar Service Worker:', err);
        });
      });
    }

    // Instalación PWA en pantalla de inicio
    const btnInstalar = document.getElementById('btn-instalar');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      appState.deferredPrompt = e;
      btnInstalar.classList.add('activo');
    });

    btnInstalar.addEventListener('click', async () => {
      if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        const { outcome } = await appState.deferredPrompt.userChoice;
        console.log('[PWA] Elección de instalación del usuario:', outcome);
        appState.deferredPrompt = null;
        btnInstalar.classList.remove('activo');
      }
    });

    window.addEventListener('appinstalled', () => {
      btnInstalar.classList.remove('activo');
      console.log('[PWA] Aplicación instalada satisfactoriamente');
    });
  }

  // ========================================================
  // 10. ARRANQUE DEL SISTEMA
  // ========================================================
  document.addEventListener('DOMContentLoaded', function () {
    inicializarReloj();
    inicializarNavegacion();
    inicializarModuloGenerador();
    inicializarModuloScanner();
    inicializarModuloDatabase();
    inicializarPWA();

    // Renderizar datos iniciales
    actualizarMetricasDashboard();
    renderizarFeed();
    actualizarContadoresDB();
    renderizarTablaDB();

    console.log('Sistema MOTO TEAM BIKER BARINAS inicializado.');
  });

})();

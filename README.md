# PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS
## Aplicación Móvil / PWA de Generación de Entradas y Control de Acceso

Sistema oficial para la emisión de boletos digitales con código QR y validación de acceso en puertas para el evento **"PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS"**.

Desarrollado bajo arquitectura **Progressive Web App (PWA)**, 100% en idioma Español, con funcionamiento completamente **offline** (sin necesidad de internet en el recinto una vez cargada) y almacenamiento local con sincronización por importación/exportación.

---

## 📋 Módulos del Sistema

### 1. Módulo: Generador de Entradas (Botón: `GENERAR`)
- **Formulario de Registro:**
  - `Nombre Completo`: Campo de texto.
  - `Número de Identificación`: Cédula de Identidad o Pasaporte.
  - `Número Telefónico`: Selector de código de país (por defecto `+58 Venezuela`, Colombia, EE.UU., España, etc.) y número local.
  - `Tipo de Entrada`: Lista desplegable con opciones: General, VIP, Piloto, Acompañante, Invitado Especial, Prensa / Medios.
- **Lógica de Generación:**
  - Generación automática de **ID Único** (Ej: `MTB-A8K92`).
  - Generación de **Código QR único** que incrusta **exclusivamente el ID de la Entrada**.
  - Parámetro `Estado` por defecto: **"Pendiente por validar"**.
  - Parámetro `Contador de usos` inicial: **0**.
- **Acción Automatizada (Integración WhatsApp):**
  - Redirección automática al WhatsApp del número registrado con la estructura oficial exacta:
  ```text
  EVENTO: PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS
  Titular: [Nombre Completo]
  Cédula/ID: [Número de Identificación]
  Teléfono: [Número Telefónico]
  Tipo de entrada: [Tipo de Entrada]
  Estado: [Estado]
  ID de Entrada: [ID]Nota: Se ha generado la entrada digital con tu codigo QR, por favor conservarla para el dia del evento y presentar en la puerta, esta entrada es intransferible, si la pierde, debe adquirir una nueva entrada, esa entrada no se podrá compartir a otra persona.
  ```
  - Visualización del pase digital en pantalla con descarga del QR en formato imagen PNG y opción de copiar texto.

---

### 2. Módulo: Scanner & Manual Check (Botón: `SCANNER`)
- **Selector Obligatorio de Modos (Dos botones explícitos en pantalla):**
  - **`Modo Entrada`**: Establece el sistema para registrar ingresos y reingresos (botón e indicador verde activo).
  - **`Modo Salida`**: Establece el sistema para registrar salidas del recinto (botón e indicador azul/naranja activo).
- **Visor de Cámara:**
  - Solicitud de permisos de cámara y escaneo en tiempo real de códigos QR.
  - Selector de lentes (cámara trasera / delantera).
  - Escaneo alternativo de capturas de pantalla / imágenes QR desde la galería del dispositivo.
- **Validación Manual:**
  - Campo de texto obligatorio etiquetado **`Ingresar ID Manual`** con validación por botón o tecla Enter (en caso de fallo en la cámara o pantalla rota del asistente).
- **Lógica de Acceso y Regla de 3 Usos (The 3-Entry Rule):**
  - **Primer Ingreso en "Modo Entrada"**:
    - Se incrementa `Contador de usos` a 1.
    - Se actualiza `Estado` a **"Dentro del recinto"**.
    - Acceso Aprobado con sonido armónico y tarjeta verde de confirmación.
  - **Procesamiento en "Modo Salida"**:
    - Se actualiza `Estado` a **"Fuera del recinto"**.
    - Confirmación visual y sonora de salida registrada.
  - **Reingreso en "Modo Entrada"**:
    - Se incrementa `Contador de usos` en 1.
    - Si el uso es menor o igual a 3 (uso 2 o 3): Acceso permitido con aviso de reingreso (Ej: "Uso 2 de 3").
  - **Condición de Bloqueo (Lock Condition)**:
    - Si el `Contador de usos` supera 3 (> 3):
    - Se actualiza inmediatamente el `Estado` a **"BLOQUEADO"**.
    - Se deniega el acceso con alarma sonora estridente y alerta en pantalla:
      **"Acceso denegado: Límite de reingresos superado"**.

---

### 3. Módulo: Live Control Panel (Botón: `DASHBOARD`)
- **Cuatro Tarjetas Computacionales Analíticas en Tiempo Real:**
  1. `Entradas Generadas`: Conteo total de filas en la base de datos de entradas.
  2. `Personas Dentro`: Conteo de entradas donde `Estado == "Dentro del recinto"`.
  3. `Personas Fuera`: Conteo de entradas donde `Estado == "Fuera del recinto"`.
  4. `Pendientes por Validar`: Conteo de entradas donde `Estado == "Pendiente por validar"`.
- **Feed de Actividad en Vivo (`Actividad en Vivo`):**
  - Componente de flujo continuo con scroll que registra eventos en tiempo real con marca de tiempo:
    - *Ejemplo: "10:14 PM - Carlos Mendoza ingresó (Uso 1 de 3)"*
    - *Ejemplo: "10:16 PM - ID #MTB-A8K92 salió"*
    - *Ejemplo: "10:20 PM - ID #MTB-X1Y2Z ACCESO DENEGADO: Límite de reingresos superado"*

---

### 4. Módulo: Local Records Management (Botón: `BASE DE DATOS`)
- **Tabla Integral de Registros:**
  - Columnas: ID Entrada, Nombre Completo, Cédula / ID, Teléfono, Tipo de Entrada, Estado, Usos (0 a 3) y Acciones.
- **Barra de Búsqueda Instantánea:**
  - Filtrado en vivo sin recargar la página que coincide simultáneamente contra:
    - `Número de Identificación` (Cédula)
    - `Nombre Completo`
    - `Número Telefónico`
- **Filtros Rápidos por Pestañas:**
  - Todos, Dentro, Fuera, Pendientes, Bloqueados.
- **Acciones por Fila:**
  - `Editar`: Permite modificar nombres, teléfonos, tipo de entrada o ajustar manualmente el estado/contador.
  - `Ver QR`: Abre modal overlay con el código QR en alta definición, detalles del titular y descarga en PNG.
  - `Reenviar por WhatsApp`: Dispara nuevamente el mensaje estructurado oficial al número del titular.

---

### 5. Sincronización y Despliegue Multi-Dispositivo
- **Exportación de Base de Datos (Botón `Exportar Base de Datos`):**
  - Genera y descarga un archivo externo (`.json` o `.csv` compatible con Excel) con todos los registros y su historial.
- **Importación de Base de Datos (Botón `Importar Base de Datos`):**
  - Permite cargar un archivo (`.json` o `.csv`).
  - Ofrece modal con dos opciones de seguridad:
    1. **Combinar / Añadir Nuevos**: Mezcla los registros sin borrar los existentes (ideal para consolidar datos entre varios teléfonos de puertas).
    2. **Reemplazar Base de Datos Completa**: Sobrescribe el almacenamiento local.
- **Botón `+ Datos Demo`:**
  - Carga al instante 4 entradas de prueba para validar el funcionamiento de cada estado y regla de acceso sin necesidad de teclear datos manualmente.

---

## 🚀 Cómo Iniciar y Probar la Aplicación

### Opción A: Servidor Local Incluido (Recomendado para PC y Móviles)
1. Abra PowerShell en la carpeta del proyecto:
   ```powershell
   cd "C:\Users\Usuario\.gemini\antigravity\scratch\moto-team-biker-tickets"
   powershell -ExecutionPolicy Bypass -File .\servidor.ps1
   ```
2. La terminal mostrará las URLs de acceso:
   - En la misma computadora: `http://localhost:8080`
   - En cualquier teléfono conectado al mismo Wi-Fi o punto de acceso móvil: `http://[IP-DE-TU-PC]:8080` (ej: `http://192.168.1.15:8080`).

### Opción B: Abrir Directamente en el Navegador
- Simplemente haga doble clic en el archivo `index.html` para abrirlo en Google Chrome, Microsoft Edge, Safari o Firefox.

---

## 📱 Instalación como App Nativa / PWA en Teléfonos
1. Abra la URL en Google Chrome (Android) o Safari (iOS).
2. Presione el botón **"INSTALAR APP"** en la parte superior o seleccione el menú del navegador:
   - **Android (Chrome):** Presione los 3 puntos verticales > **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
   - **iPhone (Safari):** Presione el botón Compartir (cuadrado con flecha hacia arriba) > **"Agregar al inicio"**.
3. La aplicación se instalará como un ícono independiente en la pantalla de su teléfono y funcionará a pantalla completa y sin conexión a internet.

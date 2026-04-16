# Garoo Portal Platform - Architecture & State Document

> [!WARNING]
> **ESTE ES UN SISTEMA DE DOS PARTES CONECTADAS E INSEPARABLES**
> Para que el Garoo Portal funcione, es estrictamente necesario que **ambos repositorios** estén en ejecución:
> 1. `garoo-portal-backend` (Node.js/Express)
> 2. `garoo-services-v3` (React/Vite)
> 
> *Nunca analices uno de estos repositorios de manera aislada asumiendo que es toda la aplicación.*

---

## 1. Introducción y Propósito
Este documento describe el estado actual, la arquitectura tecnológica, el diseño y las funcionalidades principales del **Garoo Portal**, una plataforma conformada por un Frontend (React/Vite) y un Backend (Node.js/Express) respaldado por **MongoDB** y flujos automatizados en **n8n**.

Su propósito es servir como punto de partida estructurado para cualquier desarrollador (o IA) que retome el proyecto, entendiendo el flujo de datos y los estándares implementados.

---

## 2. Stack Tecnológico

### Backend (`garoo-portal-backend`)
*   **Entorno:** Node.js, Express (ES Modules).
*   **Base de Datos:** MongoDB vía `mongoose`. Arquitectura Multi-Tenant (Multi-inquilino) utilizando modelos dinámicos (`utils/connectionManager.js`).
*   **Autenticación:** JWT (`jsonwebtoken`), validación de contraseñas con `bcryptjs`.
*   **Conexiones Externas:** Proxies dinámicos con `axios`.

### Frontend (`garoo-services-v3`)
*   **Core:** React 19, Vite. Enrutamiento mediante `react-router-dom` v7.
*   **UI y Estilos:** Bootstrap (y `react-bootstrap`), iconos de Bootstrap (`bootstrap-icons`), SweetAlert2 para notificaciones. Estilización global altamente cuidada orientada a "Premium Look" en `index.css`.
*   **Herramientas adicionales:** `chart.js` para visualización, `react-hook-form` para validaciones robustas, `jsPDF`/`moment`/`date-fns` para reportaría.

### Motores Externos
*   **Autenticación API:** El backend se comporta como un Proxy inverso para servicios de **n8n** (Redtec).
*   **Flujos (n8n):** Orquestador de la lógica asíncrona subyacente alojado usualmente como webhook.

---

## 3. Arquitectura y Componentes Clave

### A. Backend - Gestión de Servicios y Proxies (`serviceController.js`)
El backend de Garoo no solo sirve datos propios, sino que actúa fundamentalmente como un puente seguro hacia los Webhooks de n8n.
*   **`proxyService`**: Método clave que intercepta la petición al endpoint `/api/services/:serviceId`. Verifica si el usuario y la organización tienen acceso (RBAC). Re-direcciona el flujo (y streams/archivos si existen) hacia `N8N_BASE_URL` (ej. `https://agentsprod.redtec.ai/webhook/:serviceId`).
*   **Inyección de metadatos:** Inyecta en el proxy cabeceras como `x-portal-user-id` o `x-portal-user-email` para informarle al webhook de n8n quién ejecutó la acción.
*   **Historial Global (`History.js`)**: El backend registra cada ejecución exitosa o fallida del proxy en su propia base de datos (Colección `History`), guardando los `inputData` y `outputData`.

### B. Bases de Datos Multi-Tenant (Organizaciones)
*   **Colección `Organization`**: Contiene la definición de cada cliente (ej. *MundoVerde*, *RocknRolla*) y sus servicios activos.
*   **Conexiones Dinámicas:** A través de variables como `databaseConfig.mongoUri` de cada Organización, código interno como `getFacturasSat` utiliza `getDynamicModel()` que se conecta *al vuelo* al clúster MongoDB del cliente final en vez de la DB maestra. Esto aísla los datos entre inquilinos.

### C. Frontend - Estructura y Módulos
El desarrollo frontend prioriza la modularidad agrupando pantallas (pages) según el cliente en `.src/clients/`.
*   **Aislamiento Comercial**: Los proyectos varían desde Módulos de Facturación (`MundoVerde`), Sistemas de Llamadas Outbound (`Ficohsa/CallsPange`), Análisis de Video (`Pepsi`), Leads (`Spectrum`) o Formularios Abiertos como `RegistroProveedor`.
*   **Protección de Rutas (`ProtectedRoute.jsx`)**: Envoltorio inteligente en React Router que valida que el JWT exista y además cruza la pertenencia del módulo a la organización del usuario (`serviceId` o `requiredRole="admin"`). Si el usuario es de MundoVerde, no puede acceder a las rutas de RocknRolla.
*   **Gestores de Estado Globales**: Multiples "Context" ubicados en `/src/context` (e.g. `AuthProvider`, `ServicesProvider`, `FormProvider`).

---

## 4. Diseño y UX (Styling & Guidelines)

El equipo ha invertido fuertemente en estandarizar componentes de React hacia un "Premium Vibe" muy moderno y limpio:

*   **Tipografía**: "Plus Jakarta Sans" e "Inter", asegurando modernidad y alta legibilidad.
*   **Microinteracciones**: Definidas globalmente, e.j., clase `.animate-in` llama a `@keyframes slideUpFade` (una animación sutil de subida más desvanecimiento).
*   **Diseño Base**:
    *   Fuerte uso de Glassmorphism (Tarjetas de cristal). Clase unificada `.glass-card`.
    *   Tablas de lectura espaciosa con estandarización estricta (`table th` `height: 48px`, `table td` `height: 64px`).
*   **Desarrollo de Botones**: Gradientes unificados e.j. `.btn-modern-primary` (`linear-gradient(135deg, #4f46e5, #2563eb)`), eliminando bordes crudos y añadiendo sutiles elevaciones (sombras) tipo flotante en `:hover`.

---

## 5. Implementación de Nuevos Servicios (Guía para Desarrolladores)

Si se necesita agregar un flujo / cliente nuevo:

1.  **Frontend (`garoo-services-v3/src/clients`)**: Crear nueva carpeta (e.g. `NuevoCliente/MiServicio`).
2.  **Rutas (`App.jsx`)**: Añadir ruta dentro de `<ProtectedRoute serviceId="id-del-servicio">`.
3.  **Backend (`garoo-portal-backend`)**: En la colección `Organization`, asegurarse de agregar `"id-del-servicio"` al arreglo `activeServices`.
4.  **n8n Webhook**: Crear en n8n un webhook mapeado al id exacto `"id-del-servicio"` (URL final será interceptada automágicamente por el Proxy en el `garoo-portal-backend`).
5.  **Permisos del usuario / admin**: Asignar el usuario a la Organización o configurar el `allowedServices`.

---

## 6. Scripts y Herramientas Adicionales Integradas ("Under the Hood")

El backend cuenta con scripts ejecutables en node bajo `/scripts/`:
*   Validaciones de conexión a nuevas bases de datos clientes: `test-remote-connection.js`
*   Migración de data y facturas asociadas a sus autores de Garoo Portal: `migrate-invoices-user.js`

Estos scripts son vitales al momento del "onboarding" de un nuevo cliente SaaS/Enterprise dentro del Garoo Portal, para certificar que el puente proxy <> DB remota se establezca sin errores de timeout.

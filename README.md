# El Jueguito — primer avance

Pantalla de creación/unión de sala en tiempo real vía Firebase. Sin registro, sin instalar nada.

## Cómo probarlo

1. Crea un proyecto en https://console.firebase.google.com (gratis)
2. Agrega una app Web dentro del proyecto y copia el `firebaseConfig` que te dan
3. Pégalo en `js/firebase-config.js` (reemplaza los valores `TU_...`)
4. Activa **Realtime Database** en el menú lateral (Build > Realtime Database > Crear base de datos, modo de prueba)
5. Abre `index.html` con Live Server (VS Code) o súbelo a Firebase Hosting / GitHub Pages
6. Abre el link en dos pestañas o dos dispositivos para probar el flujo crear → unirse

## Reglas de seguridad (importante antes de compartirlo con alguien real)

Por defecto, el "modo de prueba" de Firebase deja la base de datos abierta a cualquiera por 30 días. Antes de usarlo con Tati o con más gente, en Realtime Database > Reglas, pon algo como:

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": true,
        ".write": "!data.exists() || !data.child('player2').exists()"
      }
    }
  }
}
```

Esto evita que cualquiera sobrescriba una sala que ya tiene a los dos jugadores.

## Lo que ya funciona
- Crear sala → genera código de 4 caracteres → muestra "ticket" para compartir
- Unirse con código → valida que exista y que no esté llena
- Ambos quedan sincronizados en tiempo real (sin refrescar la página)

## Siguiente paso
Pantalla del juego de preguntas (nivel 1, "modo conocerse") — la armamos en la próxima sesión.

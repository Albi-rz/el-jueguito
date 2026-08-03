// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto nuevo (o usa el mismo de "Tú Decides" si quieres, son independientes igual)
// 3. Dentro del proyecto: ⚙️ > Project settings > baja hasta "Tus apps" > agrega una app Web
// 4. Copia el objeto firebaseConfig que te da y pégalo aquí abajo
// 5. Activa Realtime Database: menú lateral > Build > Realtime Database > Crear base de datos
//    (modo de prueba está bien para empezar, luego ajustamos las reglas de seguridad)

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Realtime Database: si "TU_PROYECTO" abajo en databaseURL sigue así,
// es porque falta crear la Realtime Database (ver instrucciones abajo).

const firebaseConfig = {
  apiKey: "AIzaSyC1WojcTMGM53wQeOWhjfRzDLqhg62NDpg",
  authDomain: "el-jueguito-ea2e0.firebaseapp.com",
  databaseURL: "https://el-jueguito-ea2e0-default-rtdb.firebaseio.com",
  projectId: "el-jueguito-ea2e0",
  storageBucket: "el-jueguito-ea2e0.firebasestorage.app",
  messagingSenderId: "415870159185",
  appId: "1:415870159185:web:8211907bb658bb6dbd2b70"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();


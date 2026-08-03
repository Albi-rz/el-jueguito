// ---------- Navegación entre pantallas ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.getElementById('btn-go-create').onclick = () => showScreen('screen-create');
document.getElementById('btn-go-join').onclick = () => showScreen('screen-join');
document.querySelectorAll('.back').forEach(btn => {
  btn.onclick = () => showScreen(btn.dataset.back);
});

// ---------- Estado local de esta sesión de navegador ----------
let currentCode = null;
let currentRole = null; // 'player1' o 'player2'
let sessionRef = null;

// ---------- Generar código corto (4 letras/números, sin caracteres confusos) ----------
function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin O, 0, I, 1 para evitar confusión
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ---------- Crear sala ----------
document.getElementById('btn-create-session').onclick = async () => {
  const nameInput = document.getElementById('input-name-create');
  const errorEl = document.getElementById('error-create');
  const name = nameInput.value.trim();

  if (!name) {
    errorEl.textContent = 'Escribe tu nombre para continuar.';
    return;
  }
  errorEl.textContent = '';

  const code = generateCode();
  sessionRef = db.ref('sessions/' + code);

  try {
    await sessionRef.set({
      createdAt: Date.now(),
      status: 'waiting',
      player1: { name: name },
      player2: null
    });

    currentCode = code;
    currentRole = 'player1';
    document.getElementById('display-code').textContent = code.split('').join(' ');
    showScreen('screen-waiting');
    listenForPartner(code);
  } catch (err) {
    errorEl.textContent = 'No se pudo crear la sala. Revisa tu conexión.';
    console.error(err);
  }
};

// ---------- Copiar código ----------
document.getElementById('btn-copy-code').onclick = () => {
  navigator.clipboard.writeText(currentCode).then(() => {
    const btn = document.getElementById('btn-copy-code');
    const original = btn.textContent;
    btn.textContent = '¡Copiado!';
    setTimeout(() => btn.textContent = original, 1500);
  });
};

// ---------- Escuchar cuando el player2 entra ----------
function listenForPartner(code) {
  db.ref('sessions/' + code).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.player1 && data.player2) {
      document.getElementById('ready-names').textContent =
        `${data.player1.name} y ${data.player2.name}`;
      showScreen('screen-ready');
    }
  });
}

// ---------- Unirse a sala existente ----------
document.getElementById('btn-join-session').onclick = async () => {
  const codeInput = document.getElementById('input-code-join');
  const nameInput = document.getElementById('input-name-join');
  const errorEl = document.getElementById('error-join');

  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!code || code.length !== 4) {
    errorEl.textContent = 'Ingresa el código de 4 caracteres.';
    return;
  }
  if (!name) {
    errorEl.textContent = 'Escribe tu nombre para continuar.';
    return;
  }
  errorEl.textContent = '';

  const ref = db.ref('sessions/' + code);

  try {
    const snapshot = await ref.get();
    const data = snapshot.val();

    if (!data) {
      errorEl.textContent = 'Ese código no existe. Revísalo con la otra persona.';
      return;
    }
    if (data.player2) {
      errorEl.textContent = 'Esta sala ya tiene a dos personas.';
      return;
    }

    await ref.child('player2').set({ name: name });
    await ref.child('status').set('active');

    currentCode = code;
    currentRole = 'player2';

    document.getElementById('ready-names').textContent =
      `${data.player1.name} y ${name}`;
    showScreen('screen-ready');

  } catch (err) {
    errorEl.textContent = 'Algo falló. Revisa tu conexión e intenta de nuevo.';
    console.error(err);
  }
};

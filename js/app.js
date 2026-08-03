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
let playerNames = { player1: null, player2: null };
let currentQIndex = 0;

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
      playerNames.player1 = data.player1.name;
      playerNames.player2 = data.player2.name;
      document.getElementById('ready-names').textContent =
        `${data.player1.name} y ${data.player2.name}`;
      // Solo cambiamos a screen-ready si el juego todavía no empezó
      if (!data.game) showScreen('screen-ready');
    }
  });
  listenForGame(code);
}

// ---------- Empezar juego ----------
document.getElementById('btn-start-game').onclick = () => {
  db.ref('sessions/' + currentCode + '/game').set({
    currentQuestion: 0,
    answers: {}
  });
};

// ---------- Escuchar el estado del juego (sincroniza a ambos) ----------
function listenForGame(code) {
  db.ref('sessions/' + code + '/game').on('value', (snapshot) => {
    const game = snapshot.val();
    if (!game) return; // aún no empieza

    const qIndex = game.currentQuestion || 0;
    currentQIndex = qIndex;

    if (qIndex >= QUESTIONS.length) {
      showScreen('screen-done');
      return;
    }

    showScreen('screen-game');
    document.getElementById('game-progress').textContent =
      `pregunta ${qIndex + 1} de ${QUESTIONS.length}`;
    document.getElementById('game-question').textContent = QUESTIONS[qIndex];

    const answers = (game.answers && game.answers[qIndex]) || {};
    const otherRole = currentRole === 'player1' ? 'player2' : 'player1';
    const myAnswer = answers[currentRole];
    const otherAnswer = answers[otherRole];

    const answeringBox = document.getElementById('game-answering');
    const revealBox = document.getElementById('game-reveal');
    const waitStatus = document.getElementById('game-wait-status');
    const input = document.getElementById('game-answer-input');

    if (myAnswer && otherAnswer) {
      // los dos respondieron: revelar
      answeringBox.style.display = 'none';
      revealBox.style.display = 'block';
      document.getElementById('reveal-name-a').textContent = playerNames.player1;
      document.getElementById('reveal-text-a').textContent = answers.player1;
      document.getElementById('reveal-name-b').textContent = playerNames.player2;
      document.getElementById('reveal-text-b').textContent = answers.player2;
    } else if (myAnswer && !otherAnswer) {
      // yo ya respondí, esperando al otro
      answeringBox.style.display = 'block';
      revealBox.style.display = 'none';
      input.style.display = 'none';
      document.getElementById('btn-submit-answer').style.display = 'none';
      waitStatus.style.display = 'block';
    } else {
      // todavía no respondo
      answeringBox.style.display = 'block';
      revealBox.style.display = 'none';
      input.style.display = 'block';
      input.value = '';
      document.getElementById('btn-submit-answer').style.display = 'block';
      waitStatus.style.display = 'none';
    }
  });
}

// ---------- Enviar respuesta ----------
document.getElementById('btn-submit-answer').onclick = () => {
  const text = document.getElementById('game-answer-input').value.trim();
  if (!text) return;
  db.ref(`sessions/${currentCode}/game/answers/${currentQIndex}/${currentRole}`).set(text);
};

// ---------- Siguiente pregunta (avance seguro con transaction) ----------
document.getElementById('btn-next-question').onclick = () => {
  db.ref(`sessions/${currentCode}/game/currentQuestion`).transaction(current => (current || 0) + 1);
};

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
    playerNames.player1 = data.player1.name;
    playerNames.player2 = name;

    document.getElementById('ready-names').textContent =
      `${data.player1.name} y ${name}`;
    showScreen('screen-ready');
    listenForGame(code);

  } catch (err) {
    errorEl.textContent = 'Algo falló. Revisa tu conexión e intenta de nuevo.';
    console.error(err);
  }
};

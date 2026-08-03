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
let gamePath = null;
let activeQuestions = QUESTIONS;
let coupleModeStarted = false;

// Cada cuánto se desbloquea la siguiente pregunta.
// Para PROBAR más rápido, cambia esto temporalmente, ej: 60 * 1000 (1 minuto).
const UNLOCK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

let unlockTimerId = null; // referencia al setInterval del countdown activo

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

    // Detecta la transición a modo pareja (dispara en ambos navegadores)
    if (data.coupleStartDate && data.coupleLevel && !coupleModeStarted) {
      coupleModeStarted = true;
      document.body.classList.add('couple-theme');
      attachGameListener(`sessions/${code}/couple/game`, LEVEL_QUESTIONS[data.coupleLevel]);
    }
  });
  attachGameListener(`sessions/${code}/game`, QUESTIONS);
}

// ---------- Empezar juego (nivel 1) ----------
document.getElementById('btn-start-game').onclick = () => {
  db.ref('sessions/' + currentCode + '/game').set({
    currentQuestion: 0,
    answers: {}
  });
};

// ---------- Motor de juego: escucha el estado y sincroniza a ambos ----------
// path: ruta en Firebase donde vive este round (nivel 1 o modo pareja)
// questions: el set de preguntas correspondiente a ese nivel
function attachGameListener(path, questions) {
  if (gamePath) db.ref(gamePath).off(); // deja de escuchar el round anterior
  gamePath = path;
  activeQuestions = questions;

  db.ref(gamePath).on('value', (snapshot) => {
    const game = snapshot.val();
    if (!game) return; // aún no empieza este round

    const qIndex = game.currentQuestion || 0;
    currentQIndex = qIndex;

    if (qIndex >= activeQuestions.length) {
      renderRecap(game.answers || {});
      showScreen('screen-done');
      return;
    }

    showScreen('screen-game');
    document.getElementById('game-progress').textContent =
      `pregunta ${qIndex + 1} de ${activeQuestions.length}`;
    document.getElementById('game-question').textContent = activeQuestions[qIndex];

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

      scheduleUnlock(qIndex);
      updateUnlockUI(game.unlock);
    } else if (myAnswer && !otherAnswer) {
      // yo ya respondí, esperando al otro
      clearUnlockTimer();
      answeringBox.style.display = 'block';
      revealBox.style.display = 'none';
      input.style.display = 'none';
      document.getElementById('btn-submit-answer').style.display = 'none';
      waitStatus.style.display = 'block';
    } else {
      // todavía no respondo
      clearUnlockTimer();
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
  db.ref(`${gamePath}/answers/${currentQIndex}/${currentRole}`).set(text);
};

// ---------- Siguiente pregunta (avance seguro con transaction) ----------
document.getElementById('btn-next-question').onclick = () => {
  db.ref(`${gamePath}/currentQuestion`).transaction(current => (current || 0) + 1);
};

// ---------- Desbloqueo semanal de la siguiente pregunta ----------

// Programa la hora de desbloqueo SOLO la primera vez que se revela esta pregunta
// (la transaction evita que se reprograme si el otro jugador también dispara esto)
function scheduleUnlock(qIndex) {
  db.ref(`${gamePath}/unlock`).transaction(current => {
    if (current && current.forQuestion === qIndex) return; // ya estaba programado
    return { forQuestion: qIndex, availableAt: Date.now() + UNLOCK_INTERVAL_MS };
  });
}

function clearUnlockTimer() {
  if (unlockTimerId) {
    clearInterval(unlockTimerId);
    unlockTimerId = null;
  }
}

function formatCountdown(msRemaining) {
  const totalMinutes = Math.ceil(msRemaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
}

function updateUnlockUI(unlock) {
  clearUnlockTimer();

  const countdownEl = document.getElementById('unlock-countdown');
  const nextBtn = document.getElementById('btn-next-question');

  function render() {
    const remaining = (unlock ? unlock.availableAt : 0) - Date.now();
    if (!unlock || remaining <= 0) {
      countdownEl.textContent = '¡Ya pueden seguir!';
      nextBtn.disabled = false;
      nextBtn.classList.remove('btn-disabled');
      clearUnlockTimer();
    } else {
      countdownEl.textContent = `Siguiente pregunta en ${formatCountdown(remaining)}`;
      nextBtn.disabled = true;
      nextBtn.classList.add('btn-disabled');
    }
  }

  render();
  if (unlock && unlock.availableAt - Date.now() > 0) {
    unlockTimerId = setInterval(render, 1000);
  }
}

// ---------- Pasar a modo pareja ----------
document.getElementById('btn-go-couple').onclick = () => {
  showScreen('screen-couple-date');
};

document.getElementById('btn-confirm-couple-date').onclick = () => {
  const dateValue = document.getElementById('input-couple-date').value;
  if (!dateValue) return;

  const level = computeLevel(dateValue);

  // Escribe la fecha y el nivel en la sesión: esto dispara la transición
  // en AMBOS navegadores a través del listener raíz (listenForPartner)
  db.ref('sessions/' + currentCode).update({
    coupleStartDate: dateValue,
    coupleLevel: level
  });
  db.ref(`sessions/${currentCode}/couple/game`).set({
    currentQuestion: 0,
    answers: {}
  });
};

// ---------- Recap final: arma la lista de preguntas y respuestas ----------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderRecap(answers) {
  const container = document.getElementById('recap-list');
  container.innerHTML = '';

  activeQuestions.forEach((question, i) => {
    const pair = answers[i] || {};
    const a = pair.player1 || '(sin responder)';
    const b = pair.player2 || '(sin responder)';

    const item = document.createElement('div');
    item.className = 'recap-item';
    item.innerHTML = `
      <p class="recap-question">${escapeHTML(question)}</p>
      <p class="recap-answers"><b>${escapeHTML(playerNames.player1)}:</b> ${escapeHTML(a)}</p>
      <p class="recap-answers"><b>${escapeHTML(playerNames.player2)}:</b> ${escapeHTML(b)}</p>
    `;
    container.appendChild(item);
  });

  document.getElementById('done-title').textContent =
    coupleModeStarted ? '¡Un poco más cerca!' : '¡Ya se conocen un poco más!';

  document.getElementById('done-match-summary').textContent =
    `Respondieron ${activeQuestions.length} preguntas juntos.`;

  // En modo pareja no tiene sentido seguir ofreciendo "Ya somos pareja"
  document.getElementById('btn-go-couple').style.display =
    coupleModeStarted ? 'none' : 'inline-block';
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
    playerNames.player1 = data.player1.name;
    playerNames.player2 = name;

    document.getElementById('ready-names').textContent =
      `${data.player1.name} y ${name}`;
    showScreen('screen-ready');
    listenForPartner(code);

  } catch (err) {
    errorEl.textContent = 'Algo falló. Revisa tu conexión e intenta de nuevo.';
    console.error(err);
  }
};

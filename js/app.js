// ---------- Navegación entre pantallas ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.getElementById('btn-go-create').onclick = () => checkExistingRelationshipThenGo('screen-create');
document.getElementById('btn-go-join').onclick = () => checkExistingRelationshipThenGo('screen-join');

// Antes de dejar crear/unirse a una sala nueva, avisa si ya hay una relación activa guardada en este navegador
function checkExistingRelationshipThenGo(nextScreen) {
  const raw = localStorage.getItem('activeCoupleSession');
  if (!raw) { showScreen(nextScreen); return; }

  let saved;
  try { saved = JSON.parse(raw); } catch (e) { showScreen(nextScreen); return; }

  db.ref('sessions/' + saved.code).get().then(snap => {
    const data = snap.val();
    if (data && data.coupleStartDate) {
      const proceed = confirm(
        `Ya tienes una relación activa con ${saved.partnerName}. ¿Seguro que quieres iniciar otra sesión?`
      );
      if (!proceed) return;
    }
    showScreen(nextScreen);
  }).catch(() => showScreen(nextScreen)); // si falla la consulta, no bloqueamos al usuario
}

function saveActiveRelationship(code, partnerName) {
  localStorage.setItem('activeCoupleSession', JSON.stringify({ code, partnerName, savedAt: Date.now() }));
}
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
let inGameFlow = true; // si false, el motor de juego no fuerza la pantalla (estamos en el hub)
let pendingCoupleDate = null;
let pendingCoupleLevel = null;

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
      document.body.classList.add('theme-' + (data.coupleTheme || 'terracota'));
      document.getElementById('btn-back-to-hub').style.display = 'inline-block';
      document.getElementById('btn-back-to-hub-2').style.display = 'inline-block';
      inGameFlow = false;
      attachGameListener(`sessions/${code}/couple/game`, LEVEL_QUESTIONS[data.coupleLevel]);
      showScreen('screen-couple-hub');

      const partnerName = currentRole === 'player1' ? data.player2.name : data.player1.name;
      saveActiveRelationship(code, partnerName);
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

    if (inGameFlow) showScreen('screen-game');
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

  pendingCoupleDate = dateValue;
  pendingCoupleLevel = computeLevel(dateValue);
  renderPaletteGrid();
  showScreen('screen-couple-palette');
};

function renderPaletteGrid() {
  const grid = document.getElementById('palette-grid');
  grid.innerHTML = '';
  PALETTES.forEach(p => {
    const card = document.createElement('button');
    card.className = 'palette-card';
    card.innerHTML = `
      <div class="palette-swatches">
        ${p.colors.map(c => `<span class="palette-dot" style="background:${c}"></span>`).join('')}
      </div>
      <p class="palette-name">${p.label}</p>
    `;
    card.onclick = () => confirmCoupleMode(p.id);
    grid.appendChild(card);
  });
}

function confirmCoupleMode(themeId) {
  db.ref('sessions/' + currentCode).update({
    coupleStartDate: pendingCoupleDate,
    coupleLevel: pendingCoupleLevel,
    coupleTheme: themeId
  });
  db.ref(`sessions/${currentCode}/couple/game`).set({
    currentQuestion: 0,
    answers: {}
  });
}

// ---------- Hub del modo pareja ----------
document.getElementById('btn-hub-questions').onclick = () => {
  inGameFlow = true;
  // Muestra done si ya terminaron, o el juego si no
  showScreen(currentQIndex >= activeQuestions.length ? 'screen-done' : 'screen-game');
};
document.getElementById('btn-hub-lovelang').onclick = () => openLoveQuiz();
document.getElementById('btn-hub-checkin').onclick = () => openCheckin();

document.getElementById('btn-back-to-hub').onclick = () => {
  inGameFlow = false;
  showScreen('screen-couple-hub');
};
document.getElementById('btn-back-to-hub-2').onclick = () => {
  inGameFlow = false;
  showScreen('screen-couple-hub');
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

// ================= TEST DE LENGUAJES DEL AMOR =================
let llIndex = 0;
let llScores = { words: 0, quality_time: 0, acts: 0, gifts: 0, touch: 0 };
let llListenerAttached = false;

function openLoveQuiz() {
  showScreen('screen-love-quiz');

  // Si ya respondió antes, no lo hacemos repetir: vamos directo a esperar/revelar
  db.ref(`sessions/${currentCode}/loveLanguage/${currentRole}`).get().then(snap => {
    if (snap.exists()) {
      document.getElementById('ll-answering').style.display = 'none';
      showLoveLanguageWaitOrReveal();
    } else {
      llIndex = 0;
      llScores = { words: 0, quality_time: 0, acts: 0, gifts: 0, touch: 0 };
      document.getElementById('ll-answering').style.display = 'block';
      document.getElementById('ll-wait-status').style.display = 'none';
      document.getElementById('ll-reveal').style.display = 'none';
      renderLoveLanguageQuestion();
    }
  });

  if (!llListenerAttached) {
    llListenerAttached = true;
    db.ref(`sessions/${currentCode}/loveLanguage`).on('value', () => {
      // Si estamos en la pantalla del test esperando, refresca el estado
      if (document.getElementById('screen-love-quiz').classList.contains('active')) {
        showLoveLanguageWaitOrReveal();
      }
    });
  }
}

function renderLoveLanguageQuestion() {
  const pair = LOVE_LANGUAGE_PAIRS[llIndex];
  document.getElementById('ll-progress').textContent =
    `pregunta ${llIndex + 1} de ${LOVE_LANGUAGE_PAIRS.length}`;
  const optA = document.getElementById('ll-option-a');
  const optB = document.getElementById('ll-option-b');
  optA.textContent = pair.a.text;
  optB.textContent = pair.b.text;
  optA.onclick = () => answerLoveLanguage(pair.a.lang);
  optB.onclick = () => answerLoveLanguage(pair.b.lang);
}

function answerLoveLanguage(lang) {
  llScores[lang]++;
  llIndex++;
  if (llIndex < LOVE_LANGUAGE_PAIRS.length) {
    renderLoveLanguageQuestion();
  } else {
    const top = Object.keys(llScores).reduce((a, b) => llScores[b] > llScores[a] ? b : a);
    db.ref(`sessions/${currentCode}/loveLanguage/${currentRole}`).set({ scores: llScores, top: top });
    document.getElementById('ll-answering').style.display = 'none';
    showLoveLanguageWaitOrReveal();
  }
}

function showLoveLanguageWaitOrReveal() {
  db.ref(`sessions/${currentCode}/loveLanguage`).get().then(snap => {
    const data = snap.val() || {};
    if (data.player1 && data.player2) {
      document.getElementById('ll-wait-status').style.display = 'none';
      document.getElementById('ll-reveal').style.display = 'block';
      document.getElementById('ll-name-a').textContent = playerNames.player1;
      document.getElementById('ll-result-a').textContent = LOVE_LANG_LABELS[data.player1.top];
      document.getElementById('ll-name-b').textContent = playerNames.player2;
      document.getElementById('ll-result-b').textContent = LOVE_LANG_LABELS[data.player2.top];
    } else {
      document.getElementById('ll-wait-status').style.display = 'block';
      document.getElementById('ll-reveal').style.display = 'none';
    }
  });
}

// ================= CHEQUEO MENSUAL =================
let checkinListenerAttached = false;

function openCheckin() {
  showScreen('screen-checkin');
  renderCheckinForm();

  document.getElementById('checkin-form').style.display = 'block';
  document.getElementById('btn-submit-checkin').style.display = 'block';
  document.getElementById('checkin-wait-status').style.display = 'none';
  document.getElementById('checkin-reveal').style.display = 'none';

  db.ref(`sessions/${currentCode}/checkin/${currentRole}`).get().then(snap => {
    if (snap.exists()) {
      document.getElementById('checkin-form').style.display = 'none';
      document.getElementById('btn-submit-checkin').style.display = 'none';
      showCheckinWaitOrReveal();
    }
  });

  if (!checkinListenerAttached) {
    checkinListenerAttached = true;
    db.ref(`sessions/${currentCode}/checkin`).on('value', () => {
      if (document.getElementById('screen-checkin').classList.contains('active')) {
        showCheckinWaitOrReveal();
      }
    });
  }
}

function renderCheckinForm() {
  const form = document.getElementById('checkin-form');
  form.innerHTML = CHECKIN_AREAS.map(area => `
    <div class="checkin-row">
      <label>${area.label} <span class="checkin-value" id="checkin-val-${area.key}">5</span></label>
      <input type="range" min="1" max="10" value="5" id="checkin-input-${area.key}">
    </div>
  `).join('');

  CHECKIN_AREAS.forEach(area => {
    const input = document.getElementById(`checkin-input-${area.key}`);
    const label = document.getElementById(`checkin-val-${area.key}`);
    input.oninput = () => label.textContent = input.value;
  });
}

document.getElementById('btn-submit-checkin').onclick = () => {
  const scores = {};
  CHECKIN_AREAS.forEach(area => {
    scores[area.key] = parseInt(document.getElementById(`checkin-input-${area.key}`).value, 10);
  });
  db.ref(`sessions/${currentCode}/checkin/${currentRole}`).set(scores);
  document.getElementById('checkin-form').style.display = 'none';
  document.getElementById('btn-submit-checkin').style.display = 'none';
  showCheckinWaitOrReveal();
};

function showCheckinWaitOrReveal() {
  db.ref(`sessions/${currentCode}/checkin`).get().then(snap => {
    const data = snap.val() || {};
    if (data.player1 && data.player2) {
      document.getElementById('checkin-wait-status').style.display = 'none';
      const revealList = document.getElementById('checkin-reveal-list');
      document.getElementById('checkin-reveal').style.display = 'block';
      revealList.innerHTML = CHECKIN_AREAS.map(area => {
        const a = data.player1[area.key];
        const b = data.player2[area.key];
        const gap = Math.abs(a - b);
        return `
          <div class="checkin-row">
            <label>${area.label}</label>
            <p class="recap-answers">
              <b>${escapeHTML(playerNames.player1)}:</b> ${a}/10 &nbsp;
              <b>${escapeHTML(playerNames.player2)}:</b> ${b}/10
            </p>
            ${gap >= 3 ? '<span class="checkin-gap-flag">vale la pena conversarlo — hay una brecha</span>' : ''}
          </div>
        `;
      }).join('');
    } else {
      document.getElementById('checkin-wait-status').style.display = 'block';
      document.getElementById('checkin-reveal').style.display = 'none';
    }
  });
}

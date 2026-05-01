const socket = io();

let playerName = '';
let currentState = '';
let localTimer = null;

const lobby = document.getElementById('lobby');
const question = document.getElementById('question');
const result = document.getElementById('result');
const final = document.getElementById('final');

const readyBtn = document.getElementById('readyBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const observerBtn = document.getElementById('observerBtn');

playerName = prompt('Введите ваше имя:') || 'Аноним';
socket.emit('register', playerName);

function hideAll() {
  [lobby, question, result, final].forEach(el => el.classList.add('hidden'));
}

function showScreen(screen) {
  hideAll();
  screen.classList.remove('hidden');
}

function formatTime(seconds) {
  const s = Math.ceil(seconds);
  return `${s} сек`;
}

function startLocalTimer(seconds, elementId, onEnd) {
  clearInterval(localTimer);
  let remaining = Math.ceil(seconds);
  const el = document.getElementById(elementId);

  if (el) el.textContent = formatTime(remaining);

  localTimer = setInterval(() => {
    remaining--;
    if (el) el.textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(localTimer);
      if (onEnd) onEnd();
    }
  }, 1000);
}

socket.on('gameState', (state) => {
  clearInterval(localTimer);
  currentState = state.state;

  switch (state.state) {
    case 'lobby':
      showScreen(lobby);
      document.getElementById('testName').textContent = state.testName;
      document.getElementById('totalQuestions').textContent = state.totalQuestions;
      updatePlayersList(state.players);
      updateReadyButton();
      break;

    case 'question':
      showScreen(question);
      document.getElementById('questionText').textContent = state.question.text;
      document.getElementById('questionCounter').textContent =
        `Вопрос ${state.question.index + 1} из ${state.question.total}`;

      document.getElementById('timeLeft').textContent = formatTime(state.timeLeft);
      startLocalTimer(state.timeLeft, 'timeLeft');

      const optionsDiv = document.getElementById('options');
      optionsDiv.innerHTML = '';

      if (state.observer || state.players[socket.id]?.observer) {
        document.getElementById('observerMsg').classList.remove('hidden');
        document.getElementById('answerStatus').classList.add('hidden');
        observerBtn.classList.add('hidden');
        state.question.options.forEach((opt) => {
          const btn = document.createElement('button');
          btn.textContent = opt;
          btn.disabled = true;
          btn.classList.add('option-btn', 'disabled');
          optionsDiv.appendChild(btn);
        });
      } else {
        document.getElementById('observerMsg').classList.add('hidden');
        document.getElementById('answerStatus').classList.add('hidden');
        observerBtn.classList.remove('hidden');
        observerBtn.onclick = () => {
          if (confirm('Вы станете наблюдателем и больше не сможете отвечать на вопросы. Продолжить?')) {
            socket.emit('becomeObserver');
            observerBtn.classList.add('hidden');
            document.getElementById('options').querySelectorAll('button').forEach(btn => {
              btn.disabled = true;
              btn.classList.add('disabled');
            });
            document.getElementById('observerMsg').classList.remove('hidden');
          }
        };
        state.question.options.forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.textContent = opt;
          btn.classList.add('option-btn');
          btn.onclick = () => submitAnswer(i);
          optionsDiv.appendChild(btn);
        });
      }
      break;

    case 'result':
      showScreen(result);
      observerBtn.classList.add('hidden');
      document.getElementById('resultQuestion').textContent = state.question.text;
      document.getElementById('resultCounter').textContent =
        `Вопрос ${state.question.index + 1} из ${state.question.total} — правильный ответ выделен`;

      const resultOptionsDiv = document.getElementById('resultOptions');
      resultOptionsDiv.innerHTML = '';
      state.question.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.classList.add('option-btn');
        btn.disabled = true;
        if (i === state.question.correct) {
          btn.classList.add('correct');
        } else if (state.answers?.some(a => a.answer === i && !a.correct)) {
          btn.classList.add('wrong');
        }
        resultOptionsDiv.appendChild(btn);
      });

      const scoresDiv = document.getElementById('scores');
      scoresDiv.innerHTML = '<h4>Баллы за вопрос:</h4>';
      if (state.scores && state.scores.length > 0) {
        state.scores.forEach(s => {
          scoresDiv.innerHTML += `<p>${s.name}: +${s.points}</p>`;
        });
      } else {
        scoresDiv.innerHTML += '<p>Никто не ответил правильно</p>';
      }

      updateScoreboard(state.players);

      const resultTime = state.resultTime || 5;
      document.getElementById('nextTimer').textContent =
        `Следующий вопрос через ${formatTime(resultTime)}...`;
      startLocalTimer(resultTime, 'nextTimer');
      break;

    case 'final':
      showScreen(final);
      document.getElementById('finalCounter').textContent =
        `Пройдено ${state.totalQuestions} вопросов`;

      const rankingsDiv = document.getElementById('rankings');
      rankingsDiv.innerHTML = '<h3>Рейтинг:</h3>';
      state.rankings.forEach((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        rankingsDiv.innerHTML += `<p>${medal} ${player.name}: ${player.score} баллов</p>`;
      });
      break;
  }
});

socket.on('playersUpdate', (players) => {
  updatePlayersList(players);
  updateReadyButton();
});

socket.on('answerAccepted', () => {
  document.getElementById('answerStatus').classList.remove('hidden');
  document.getElementById('options').querySelectorAll('button').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('disabled');
  });
  observerBtn.classList.add('hidden');
});

function submitAnswer(index) {
  socket.emit('submitAnswer', index);
}

readyBtn.onclick = () => {
  socket.emit('toggleReady');
};

playAgainBtn.onclick = () => {
  socket.emit('playAgain');
};

function updatePlayersList(players) {
  const playersList = document.getElementById('playersList');
  if (!playersList) return;

  playersList.innerHTML = '<h3>Игроки:</h3>';
  const me = socket.id;

  Object.entries(players).forEach(([id, player]) => {
    const div = document.createElement('div');
    div.classList.add('player-item');

    let status = '';
    if (player.observer) {
      status = '👁 Наблюдатель';
    } else if (currentState === 'lobby') {
      status = player.ready ? '✅ Готов' : '⏳ Не готов';
    }

    div.innerHTML = `
      <span class="player-name">${player.name} ${id === me ? '(вы)' : ''}</span>
      <span class="player-status">${status}</span>
      ${currentState !== 'lobby' ? `<span class="player-score">${player.score} баллов</span>` : ''}
    `;
    playersList.appendChild(div);
  });

  if (currentState === 'lobby') {
    const total = Object.values(players).filter(p => !p.observer).length;
    const ready = Object.values(players).filter(p => !p.observer && p.ready).length;
    const readyCount = document.getElementById('readyCount');
    if (readyCount) {
      readyCount.textContent = `Готовы: ${ready} из ${total}`;
    }
  }
}

function updateReadyButton() {
  if (currentState === 'lobby') {
    readyBtn.classList.remove('hidden');
  } else {
    readyBtn.classList.add('hidden');
  }
}

function updateScoreboard(players) {
  const scoreboard = document.getElementById('scoreboard');
  if (!scoreboard) return;

  scoreboard.innerHTML = '<h4>Общий счёт:</h4>';
  const sorted = Object.entries(players)
    .filter(([_, p]) => !p.observer || p.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  sorted.forEach(([id, player]) => {
    const me = id === socket.id ? ' (вы)' : '';
    scoreboard.innerHTML += `<p>${player.name}${me}: ${player.score} баллов</p>`;
  });
}
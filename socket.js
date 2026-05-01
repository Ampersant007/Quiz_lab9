import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILE = 'tests/test1.json';

function loadTest() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'public', TEST_FILE), 'utf-8');
    const json = JSON.parse(raw);

    const name = json.name || 'Безымянная викторина';
    const settings = json.settings || {};
    const timeLimit = settings.timeLimit || 10;
    const points = settings.points || [10, 7, 5, 3];
    const resultTime = settings.resultTime || 5;

    const questions = (json.questions || [])
      .filter(q =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correct === 'number' &&
        q.correct >= 0 &&
        q.correct < q.options.length
      )
      .map(q => ({
        question: q.question,
        options: q.options,
        correct: q.correct
      }));

    return { name, timeLimit, points, resultTime, questions };
  } catch (err) {
    console.error('Ошибка загрузки теста:', err.message);
    return null;
  }
}

export function initSocket(httpServer) {
  const io = new Server(httpServer);

  let test = loadTest();
  if (!test) {
    console.error('Не удалось загрузить тест. Сервер запущен, но игра не будет работать.');
    test = {
      name: 'Ошибка загрузки',
      timeLimit: 10,
      points: [10, 7, 5, 3],
      resultTime: 5,
      questions: []
    };
  }

  let gameState = 'lobby';
  let players = {};
  let currentQuestion = 0;
  let questionStartTime = null;
  let answers = [];
  let timers = {};

  function clearTimers() {
    if (timers.questionTimer) clearTimeout(timers.questionTimer);
    if (timers.resultTimer) clearTimeout(timers.resultTimer);
  }

  function getPlayersList() {
    const list = {};
    Object.entries(players).forEach(([id, p]) => {
      list[id] = {
        name: p.name,
        ready: p.ready,
        score: p.score,
        observer: p.observer
      };
    });
    return list;
  }

  function allReady() {
    const activePlayers = Object.values(players).filter(p => !p.observer);
    if (activePlayers.length === 0) return false;
    return activePlayers.every(p => p.ready);
  }

  function allAnswered() {
    const activePlayers = Object.values(players).filter(p => !p.observer);
    return activePlayers.every(p => answers.some(a => a.socketId === Object.keys(players).find(k => players[k] === p)));
  }

  function startQuestion() {
    if (currentQuestion >= test.questions.length) {
      endGame();
      return;
    }

    clearTimers();
    gameState = 'question';
    questionStartTime = Date.now();
    answers = [];

    const q = test.questions[currentQuestion];
    const timeLimit = test.timeLimit;

    io.emit('gameState', {
      state: 'question',
      question: {
        text: q.question,
        options: q.options,
        index: currentQuestion,
        total: test.questions.length
      },
      timeLimit: timeLimit,
      timeLeft: timeLimit,
      players: getPlayersList()
    });

    timers.questionTimer = setTimeout(() => {
      showResult();
    }, timeLimit * 1000);
  }

  function showResult() {
    clearTimers();
    gameState = 'result';

    const q = test.questions[currentQuestion];

    const correctAnswers = answers
      .filter(a => a.answer === q.correct)
      .sort((a, b) => a.time - b.time);

    correctAnswers.forEach((a, index) => {
      const pointsIndex = Math.min(index, test.points.length - 1);
      const points = test.points[pointsIndex];
      if (players[a.socketId] && !players[a.socketId].observer) {
        players[a.socketId].score += points;
      }
    });

    const answerDetails = answers.map(a => ({
      name: players[a.socketId]?.name || 'Неизвестный',
      answer: a.answer,
      correct: a.answer === q.correct,
      time: a.time
    }));

    const scores = correctAnswers.map((a, i) => ({
      name: players[a.socketId]?.name || 'Неизвестный',
      points: test.points[Math.min(i, test.points.length - 1)]
    }));

    io.emit('gameState', {
      state: 'result',
      question: {
        text: q.question,
        options: q.options,
        correct: q.correct,
        index: currentQuestion,
        total: test.questions.length
      },
      answers: answerDetails,
      scores: scores,
      players: getPlayersList(),
      resultTime: test.resultTime
    });

    timers.resultTimer = setTimeout(() => {
      currentQuestion++;
      startQuestion();
    }, test.resultTime * 1000);
  }

  function endGame() {
    clearTimers();
    gameState = 'final';

    const sortedPlayers = Object.entries(players)
      .filter(([_, p]) => !p.observer || p.score > 0)
      .map(([id, p]) => ({ id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    io.emit('gameState', {
      state: 'final',
      players: getPlayersList(),
      rankings: sortedPlayers,
      totalQuestions: test.questions.length
    });
  }

  function resetGame() {
    clearTimers();
    gameState = 'lobby';
    currentQuestion = 0;
    questionStartTime = null;
    answers = [];

    Object.values(players).forEach(p => {
      p.ready = false;
      p.score = 0;
      p.observer = false;
    });

    io.emit('gameState', {
      state: 'lobby',
      players: getPlayersList(),
      testName: test.name,
      totalQuestions: test.questions.length
    });
  }

  io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    socket.on('register', (name) => {
      const isObserver = gameState !== 'lobby' && gameState !== 'final';

      players[socket.id] = {
        name: name || 'Аноним',
        ready: false,
        score: 0,
        observer: isObserver
      };

      console.log(`Registered: ${name} (observer: ${isObserver})`);

      switch (gameState) {
        case 'lobby':
          socket.emit('gameState', {
            state: 'lobby',
            players: getPlayersList(),
            testName: test.name,
            totalQuestions: test.questions.length
          });
          io.emit('playersUpdate', getPlayersList());
          break;

        case 'question':
          const q = test.questions[currentQuestion];
          const elapsed = (Date.now() - questionStartTime) / 1000;
          const timeLeft = Math.max(0, Math.ceil(test.timeLimit - elapsed));

          socket.emit('gameState', {
            state: 'question',
            question: {
              text: q.question,
              options: q.options,
              index: currentQuestion,
              total: test.questions.length
            },
            timeLimit: test.timeLimit,
            timeLeft: timeLeft,
            players: getPlayersList(),
            observer: isObserver
          });
          io.emit('playersUpdate', getPlayersList());
          break;

        case 'result':
          const rq = test.questions[currentQuestion];
          socket.emit('gameState', {
            state: 'result',
            question: {
              text: rq.question,
              options: rq.options,
              correct: rq.correct,
              index: currentQuestion,
              total: test.questions.length
            },
            answers: answers.map(a => ({
              name: players[a.socketId]?.name || 'Неизвестный',
              answer: a.answer,
              correct: a.answer === rq.correct,
              time: a.time
            })),
            players: getPlayersList(),
            resultTime: Math.ceil((test.resultTime || 5) - ((Date.now() - (questionStartTime + test.timeLimit * 1000)) / 1000))
          });
          io.emit('playersUpdate', getPlayersList());
          break;

        case 'final':
          const sortedPlayers = Object.entries(players)
            .filter(([_, p]) => !p.observer || p.score > 0)
            .map(([id, p]) => ({ id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

          socket.emit('gameState', {
            state: 'final',
            players: getPlayersList(),
            rankings: sortedPlayers,
            totalQuestions: test.questions.length
          });
          io.emit('playersUpdate', getPlayersList());
          break;
      }
    });

    socket.on('toggleReady', () => {
      if (gameState !== 'lobby') return;
      if (!players[socket.id] || players[socket.id].observer) return;

      players[socket.id].ready = !players[socket.id].ready;
      io.emit('playersUpdate', getPlayersList());

      if (allReady()) {
        startGame();
      }
    });

    socket.on('submitAnswer', (answerIndex) => {
      if (gameState !== 'question') return;
      if (!players[socket.id] || players[socket.id].observer) return;
      if (answers.some(a => a.socketId === socket.id)) return;

      const answerTime = (Date.now() - questionStartTime) / 1000;

      answers.push({
        socketId: socket.id,
        answer: answerIndex,
        time: answerTime
      });

      socket.emit('answerAccepted');

      if (allAnswered()) {
        clearTimers();
        showResult();
      }
    });

    socket.on('becomeObserver', () => {
      if (!players[socket.id]) return;
      if (players[socket.id].observer) return;
      if (gameState !== 'question' && gameState !== 'result') return;

      players[socket.id].observer = true;
      io.emit('playersUpdate', getPlayersList());

      const activePlayers = Object.values(players).filter(p => !p.observer);
      if (activePlayers.length === 0) {
        clearTimers();
        endGame();
      } else if (gameState === 'question' && allAnswered()) {
        clearTimers();
        showResult();
      }
    });

    socket.on('playAgain', () => {
      if (gameState !== 'final') return;
      resetGame();
    });

    socket.on('disconnect', () => {
      if (players[socket.id]) {
        console.log(`Disconnected: ${players[socket.id].name}`);
      }
      delete players[socket.id];

      if (gameState === 'lobby') {
        io.emit('playersUpdate', getPlayersList());
        if (allReady()) {
          startGame();
        }
      } else if (gameState === 'question') {
        io.emit('playersUpdate', getPlayersList());
        const activeLeft = Object.values(players).filter(p => !p.observer);
        if (activeLeft.length === 0) {
          clearTimers();
          endGame();
        } else if (allAnswered()) {
          clearTimers();
          showResult();
        }
      } else if (gameState === 'result') {
        io.emit('playersUpdate', getPlayersList());
        const activeLeft = Object.values(players).filter(p => !p.observer);
        if (activeLeft.length === 0) {
          clearTimers();
          endGame();
        }
      } else if (gameState === 'final') {
        io.emit('playersUpdate', getPlayersList());
      }
    });
  });

  function startGame() {
    currentQuestion = 0;
    Object.values(players).forEach(p => {
      if (!p.observer) {
        p.score = 0;
        p.ready = true;
      }
    });
    startQuestion();
  }
}
import { createServer } from 'http';
import { app } from './rest.js';
import { initSocket } from './socket.js';

const server = createServer(app);
initSocket(server);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});
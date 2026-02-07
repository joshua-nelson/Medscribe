import http from 'http';
import app from './app';
import { initSocket } from './socket';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});


const { Server } = require('socket.io');

function initializeSocket(server) {
  const io = new Server(server, { cors: { origin: "*" } });
  io.on('connection', (socket) => {
    console.log("Client connected:", socket.id);
  });
  return io;
}

module.exports = initializeSocket;

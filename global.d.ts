declare module "*.css";

import type { Server as SocketIOServer } from "socket.io";

declare global {
  var _socketIoServer: SocketIOServer | undefined;
}

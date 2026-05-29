import { WebSocketGateway, WebSocketServer, SubscribeMessage } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("join")
  handleJoin(client: Socket, room: string) {
    client.join(room);
  }

  emitKitchenTicket(branchId: string, ticket: unknown) {
    this.server.to(`kitchen:${branchId}`).emit("kitchen.ticket", ticket);
  }

  emitOrderUpdate(branchId: string, order: unknown) {
    this.server.to(`kitchen:${branchId}`).emit("order.updated", order);
  }

  emitRoomStatus(branchId: string, roomId: string, status: string) {
    this.server.to(`branch:${branchId}`).emit("room.status", { roomId, status });
  }
}

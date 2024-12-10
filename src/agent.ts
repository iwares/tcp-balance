import { createServer, Server, Socket } from 'net';
import { Balancer } from './balancer';
import { Connection } from './connection';
import { Logger } from './logger';

export class Agent {

  private readonly balancer: Balancer;
  private server?: Server;

  public constructor(balancer: Balancer) {
    this.balancer = balancer;
  }

  public start(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server)
        return reject(new Error('Agent already started'));
      Logger.log(`Agent is listening on ${host}:${port}`);
      this.server = createServer((socket) => this.onNewConnection(socket));
      this.server.listen(port, host, () => resolve());
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server)
        return reject(new Error('Agent not started'));
      Logger.log('Agent is stopping');
      this.server.close(error => error ? reject(error) : resolve());
      this.server = undefined;
    })
  }

  public async onNewConnection(socket: Socket): Promise<void> {
    const connection = new Connection(socket);

    Logger.log(`New connection #${connection.id} from ${socket.remoteAddress}:${socket.remotePort}`);
    const remote = await this.balancer.resolve();
    if (!remote)
      return connection.close();

    Logger.log(`Forwarding connection #${connection.id} to ${remote.remoteAddress}:${remote.remotePort}`);
    connection.bridge(remote);
  }

}

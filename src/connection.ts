import { Socket } from 'net';

export class Connection {

  private static sequence: number = 0;

  public readonly id: number;

  private readonly buffers: Buffer[] = [];

  private client: Socket;
  private server?: Socket;

  constructor(client: Socket) {
    if (++Connection.sequence > Number.MAX_SAFE_INTEGER)
      Connection.sequence = 1;
    this.id = Connection.sequence;

    this.client = client;

    client.on('error', this.close.bind(this));
    client.on('data', (msg: string) => {
      if (!this.server)
        return this.buffers.push(Buffer.from(msg));
      this.server.write(msg);
    })
  }

  public bridge(server: Socket) {
    this.server = server;

    server.on('error', this.close.bind(this));
    server.on('data', (msg: string) => this.client.write(msg));
    server.on('close', this.close.bind(this));
    this.client.on('close', this.close.bind(this));

    for (let buffer of this.buffers)
      server.write(buffer);
    this.buffers.length = 0;
  }

  public close() {
    this.client.end();
    this.server?.end();
  }

}

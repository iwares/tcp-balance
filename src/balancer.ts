import { Socket } from "net";
import { Logger } from "./logger";

class Upstream {

  public readonly host: string;
  public readonly port: number;
  public weight: number;

  private timeout?: NodeJS.Timeout;
  private available: boolean = false;
  private running: boolean = false;

  public constructor(host: string, port: number, weight: number) {
    this.host = host;
    this.port = port;
    this.weight = weight;
  }

  public start(): void {
    if (this.running)
      return;

    this.running = true;
    this.check();
  }

  public end(): void {
    if (!this.running)
      return;

    this.running = false;
    clearTimeout(this.timeout);
  }

  public async connect(): Promise<Socket | undefined> {
    if (!this.running)
      return undefined;

    clearTimeout(this.timeout);

    const socket = await this.createSocket();

    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.check(), 5 * 60 * 1000);

    this.available = !!socket;
    if (!this.available)
      Logger.log(`Upstream ${this.host}:${this.port} is down`);
    return socket;
  }

  public get alive(): number {
    return this.available ? 1 : 0;
  }

  private createSocket(): Promise<Socket | undefined> {
    return new Promise(resolve => {
      const socket = new Socket();
      socket.connect(this.port, this.host, () => resolve(socket));
      socket.on("error", () => resolve(undefined));
    });
  }

  private async check(): Promise<void> {
    if (!this.running)
      return;

    clearTimeout(this.timeout);

    Logger.log(`Checking upstream ${this.host}:${this.port} ...`);
    const socket = await this.createSocket();

    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.check(), 5 * 60 * 1000);

    this.available = !!socket;
    Logger.log(`Upstream ${this.host}:${this.port} is ${this.available ? 'up' : 'down'}`);
    socket?.destroy();
  }

}

export abstract class Balancer {

  public readonly upstreams: Upstream[] = [];

  public abstract resolve(): Promise<Socket | undefined>;

  public putUpstream(host: string, port: number, weight: number = 100) {
    let upstream = this.upstreams.find(u => u.host === host && u.port === port);
    if (!upstream)
      this.upstreams.push(upstream = new Upstream(host, port, weight));

    upstream.weight = weight;
    upstream.start();
  }

  public removeUpstream(host: string, port: number) {
    const index = this.upstreams.findIndex(u => u.host === host && u.port === port);
    if (index < 0)
      return;

    const upstream = this.upstreams[index];
    upstream.end();

    this.upstreams.splice(index, 1);
  }

  public clearUpstreams() {
    for (let upstream of this.upstreams)
      upstream.end();

    this.upstreams.length = 0;
  }

}

export class SingleBalancer extends Balancer {

  public async resolve(): Promise<Socket | undefined> {
    this.upstreams.sort((a, b) => a.alive == b.alive ? b.weight - a.weight : b.alive - a.alive);
    let socket: Socket | undefined = undefined;

    for (const upstream of this.upstreams) {
      if (!upstream.alive)
        continue;

      Logger.log(`Trying upstream ${upstream.host}:${upstream.port} ...`);
      socket = await upstream.connect();
      if (socket)
        break;
    }

    return socket;
  }

}

export class RobinBalancer extends Balancer {

  private index: number = 0;

  public async resolve(): Promise<Socket | undefined> {
    let socket: Socket | undefined = undefined;

    for (let i = 0; i < this.upstreams.length; ++i) {
      const upstream = this.upstreams[this.index++ % this.upstreams.length];
      if (!upstream.alive)
        continue;

      Logger.log(`Trying upstream ${upstream.host}:${upstream.port} ...`);
      socket = await upstream.connect();
      if (socket)
        break;
    }

    return socket;
  }

}

export class RandomBalancer extends Balancer {

  public async resolve(): Promise<Socket | undefined> {
    const upstreams = this.upstreams.filter(upstream => upstream.alive);
    let socket: Socket | undefined = undefined;

    while (upstreams.length > 0) {
      const index = Math.floor(Math.random() * upstreams.length);
      const upstream = upstreams[index];
      Logger.log(`Trying upstream ${upstream.host}:${upstream.port} ...`);
      socket = await upstream.connect();
      if (socket)
        break;

      upstreams.splice(index, 1);
    }

    return socket;
  }

}

export class WeightedBalancer extends Balancer {

  private readonly weights: { [key: string]: number } = {};

  public putUpstream(host: string, port: number, weight: number = 100) {
    super.putUpstream(host, port, weight);
    const key = `${host}:${port}`;
    if (this.weights[key] !== undefined)
      return;
    this.weights[key] = 0;
  }

  public removeUpstream(host: string, port: number) {
    super.removeUpstream(host, port);
    delete this.weights[host];
  }

  public async resolve(): Promise<Socket | undefined> {
    const upstreams = this.upstreams.filter(upstream => upstream.alive);
    let socket: Socket | undefined = undefined;

    while (upstreams.length > 0) {
      let totalWeight = 0;
      for (const upstream of upstreams) {
        totalWeight += upstream.weight;
        this.weights[`${upstream.host}:${upstream.port}`] += upstream.weight;
      }

      let index = 0;
      let selected: Upstream = upstreams[index];
      let max = this.weights[`${selected.host}:${selected.port}`];
      for (let i = index + 1; i < upstreams.length; ++i) {
        const upstream = upstreams[i];
        const weight = this.weights[`${upstream.host}:${upstream.port}`];
        if (weight > max) {
          index = i;
          selected = upstream;
          max = weight;
        }
      }

      this.weights[`${selected.host}:${selected.port}`] -= totalWeight;

      Logger.log(`Trying upstream ${selected.host}:${selected.port} ...`);
      socket = await selected.connect();

      if (socket)
        break;

      upstreams.splice(index, 1);
    }

    return socket;
  }

}

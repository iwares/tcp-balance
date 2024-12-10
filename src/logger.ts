export interface Channel {
  log: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
}

export class NullChannel implements Channel {
  log(msg: string): void { /** noop */ }
  error(msg: string): void { /** noop */ }
  warn(msg: string): void { /** noop */ }
}

export class Logger {

  private static channel: Channel = new NullChannel();

  public static setChannel(channel: Channel): void {
    Logger.channel = channel;
  }

  public static log(msg: string): void {
    Logger.channel.log(msg);
  }

  public static error(msg: string): void {
    Logger.channel.error(msg);
  }

  public static warn(msg: string): void {
    Logger.channel.warn(msg);
  }

}

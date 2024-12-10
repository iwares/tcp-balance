#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Agent } from './agent';
import { Balancer, RandomBalancer, RobinBalancer, SingleBalancer, WeightedBalancer } from './balancer';
import { Logger } from './logger';

function bindParser(value: string): { ip: string, port: number } {
  const matches = value.match(/^(?:(.+)?:)?(\d+)$/);
  if (!matches)
    throw new Error(`Invalid bind address: ${value}`);
  const ip: string = matches[1] || '0.0.0.0';
  const port: number = parseInt(matches[2]);
  return { ip, port };
}

function createBalancer(name: string): Balancer {
  switch (name) {
    case 'single':
      return new SingleBalancer();
    case 'robin':
      return new RobinBalancer();
    case 'random':
      return new RandomBalancer();
    case 'weighted':
      return new WeightedBalancer();
    default:
      throw new Error(`Invalid balancer: ${name}`);
  }
}

function upstreamParser(values: string[]): Array<{ host: string, port: number, weight: number }> {
  const results: Array<{ host: string, port: number, weight: number }> = [];
  for (const value of values) {
    const matches = value.match(/^(.*):(\d+)(?:%(\d+))?$/);
    if (!matches)
      throw new Error(`Invalid upstream: ${value}`);
    const host: string = matches[1];
    const port: number = parseInt(matches[2]);
    const weight: number = parseInt(matches[3] || '100');
    results.push({ host, port, weight });
  }
  return results;
}

async function bootstrap(): Promise<void> {
  // 解析参数
  const args = await yargs(hideBin(process.argv))
    .usage('Usage: tcp-balance [options] host:port[%weight] [host:port[%weight] ...]')
    .example('tcp-balance -b :3721 h1.example.com:3721 h2.example.com:3721', 'Balance connections to h1.example.com:3721 and h2.example.com:3721')
    .option('b', {
      alias: 'bind',
      describe: 'Bind address',
      type: 'string',
      default: '127.0.0.1:8080',
      coerce: bindParser,
    })
    .option('a', {
      alias: 'algorithm',
      describe: 'Load balancing algorithm',
      type: 'string',
      choices: ['single', 'robin', 'random', 'weighted'],
      default: 'robin',
    })
    .option('_', {
      alias: 'upstream',
      describe: 'Upstream servers',
      type: 'array',
      coerce: upstreamParser,
    })
    .help().alias('h', 'help')
    .argv;

  // 设置日志输出
  Logger.setChannel(console);

  // 创建负载均衡器
  const balancer = createBalancer(args.a);
  for (let u of args._)
    balancer.putUpstream(u.host, u.port, u.weight);

  // 创建代理
  const agent = new Agent(balancer);

  // 启动函数
  const startup = async () => {
    agent.start(args.b.ip, args.b.port);
  };

  // 清理函数
  const cleanup = async () => {
    await agent.stop();
    balancer.clearUpstreams();
    process.exit(0);
  };

  // 注册清理函数
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // 启动
  await startup();
}

bootstrap();

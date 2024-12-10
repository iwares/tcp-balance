# tcp-balance

A simple TCP load balancer.<br/>
一个简单的TCP负载均衡器。

## Installation

```bash
$ npm install -g tcp-balance
```

## Usage

```bash
$ tcp-balance [-b [host:]port] [-a single|robin|random|weighted] host:port[%weight] [host:port[%weight]...]
```

-b, --bind<br/>
Bind to the specified address and port. Default: 127.0.0.1:8080.<br/>
绑定到指定的地址和端口。默认：127.0.0.1:8080。

-a, --algorithm<br/>
Load balancing algorithm. Algorithms: single, robin, random, weighted. Default: robin.<br/>
负载均衡算法。可选值：single, robin, random, weighted。默认：robin。

host:port[%weight]<br/>
Upstream server address and port. Weight is a optional numeric leading with percentage sign. If not specified, the default weight is 100. It's only effective when algorithm is weighted.<br/>
上游服务的地址和端口。权重是一个可选的数值，以百分号开头。如果未指定，默认权重为100。仅在weighted算法下有效。

## Examples

Single. Load balance to the first available server only. For example: Failover.<br/>
Single. 只负载到第一个可用的服务器。例如：故障转移。
```bash
$ tcp-balance -b 0.0.0.0:1883 -a single s1.example.com:1883 s2.example.com:1883
```

Weighted round robin. For example: HTTP load balancing.<br/>
权重轮询。例如：HTTP负载均衡。
```bash
$ tcp-balance -b 0.0.0.0:80 -a weighted s1.example.com:80%30 s2.example.com:80%70
```

## Programing

Install tcp-balance as npm dependency.<br/>
安装tcp-balance为npm依赖。

```bash
$ npm i tcp-balance
```

Import and use it.<br/>
引入并使用。

```typescript
// Import tcp-balance components
// 导入tcp-balance组件
import { Agent } from 'tcp-balance/bin/agent';
import { SingleBalancer } from 'tcp-balance/bin/balancer';
import { Logger } from 'tcp-balance/bin/logger';

// Optional, using console for log output.
// 可选的，使用console输出日志。
Logger.setChannel(console);

// Create a balancer and register upstream servers.
// 创建一个负载均衡器并注册上游服务器。
const balancer = new SingleBalancer();
balancer.putUpstream('s1.example.com', 80);
balancer.putUpstream('s2.example.com', 80);

// Create an agent and start it.
// 创建一个代理并启动。
const agent = new Agent(balancer);
agent.start(0.0.0.0, 80);
```

## Build
```bash
$ npm i -g typescript
$ git clone https://github.com/iwares/tcp-balance.git
$ cd tcp-balance
$ npm i
$ npm run build
```

## License
MIT

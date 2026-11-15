export interface BoardQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  codexIds: string[];
  reward: number;
}

export const QUESTIONS: BoardQuestion[] = [
  {
    id: 'q-guess-capacity',
    prompt: 'During the rush we had to buy a server days in advance, without knowing how much traffic would really come. What is this problem called?',
    options: ['Guessing capacity', 'Shared responsibility', 'High latency', 'Data residency'],
    answer: 0,
    explanation: 'With your own hardware, you have to guess how much capacity you’ll need. One of the cloud’s big advantages is that you can stop guessing and add or remove capacity in minutes.',
    codexIds: [],
    reward: 300,
  },
  {
    id: 'q-dns',
    prompt: 'Which AWS service is a DNS service that turns domain names into addresses computers can use?',
    options: ['Amazon S3', 'Amazon Route 53', 'Amazon CloudFront', 'AWS Shield'],
    answer: 1,
    explanation: 'Amazon Route 53 is AWS’s highly available DNS service. It can also register domain names and route users based on health checks, latency, or location.',
    codexIds: ['route53'],
    reward: 150,
  },
  {
    id: 'q-cache',
    prompt: 'Which AWS service keeps frequently read data in memory to take load off a database?',
    options: ['Amazon ElastiCache', 'Amazon S3 Glacier', 'AWS Snowball', 'Amazon Route 53'],
    answer: 0,
    explanation: 'Amazon ElastiCache is a managed in-memory cache (Redis-compatible or Memcached). Answering repeat reads from memory cuts database load and latency.',
    codexIds: ['elasticache'],
    reward: 300,
  },
  {
    id: 'q-benefits',
    prompt: 'An investor asks why other startups use the cloud instead of buying servers. Which is an advantage of the AWS Cloud?',
    options: [
      'Trade fixed expense for variable expense',
      'Every service is guaranteed 100% uptime',
      'AWS secures your application code for you',
      'Data transfer is free in every direction',
    ],
    answer: 0,
    explanation: 'Instead of paying upfront for data centers and servers, you pay only for the computing you consume. It’s one of the six advantages of cloud computing.',
    codexIds: ['six-benefits', 'capex-opex'],
    reward: 500,
  },
  {
    id: 'q-static-hosting',
    prompt: 'What is the most cost-effective AWS service for hosting a static website (HTML, CSS, images)?',
    options: ['Amazon RDS', 'Amazon S3', 'EC2 Dedicated Hosts', 'AWS Snowball'],
    answer: 1,
    explanation: 'Amazon S3 can host static websites directly, scales automatically, and you pay only for storage, requests, and data transfer.',
    codexIds: ['s3'],
    reward: 100,
  },
  {
    id: 'q-edge',
    prompt: 'What does Amazon CloudFront use to deliver content to users worldwide with low latency?',
    options: ['Availability Zones', 'Edge locations', 'VPC subnets', 'Dedicated Hosts'],
    answer: 1,
    explanation: 'CloudFront caches content at edge locations in hundreds of cities, so requests are answered close to the user.',
    codexIds: ['edge-locations', 'cloudfront'],
    reward: 100,
  },
  {
    id: 'q-shared',
    prompt: 'Under the AWS shared responsibility model, which task belongs to the customer?',
    options: [
      'Physical security of data centers',
      'Patching the hypervisor',
      'Configuring security groups',
      'Replacing failed storage hardware',
    ],
    answer: 2,
    explanation: 'AWS handles security OF the cloud (facilities, hardware, hypervisor). Customers handle security IN the cloud, including firewall configuration like security groups.',
    codexIds: ['shared-responsibility', 'security-groups'],
    reward: 200,
  },
  {
    id: 'q-rds',
    prompt: 'What is a benefit of using Amazon RDS instead of installing a database on EC2?',
    options: [
      'You get full OS-level access to the database host',
      'AWS handles patching, backups, and failover',
      'It is always free',
      'It only stores key-value data',
    ],
    answer: 1,
    explanation: 'RDS is a managed service: AWS takes care of provisioning, OS and engine patching, automated backups, and Multi-AZ failover.',
    codexIds: ['rds', 'managed-services-economics'],
    reward: 200,
  },
  {
    id: 'q-elasticity',
    prompt: 'Which AWS feature automatically adds EC2 instances when demand rises and removes them when it falls?',
    options: ['Elastic Load Balancing', 'Amazon EC2 Auto Scaling', 'Amazon CloudFront', 'Amazon Route 53'],
    answer: 1,
    explanation: 'EC2 Auto Scaling adjusts the number of instances between a minimum and maximum to match demand. A load balancer spreads traffic but doesn’t add capacity.',
    codexIds: ['auto-scaling', 'elasticity'],
    reward: 300,
  },
  {
    id: 'q-multi-az',
    prompt: 'What is the recommended way to make an application highly available within one AWS Region?',
    options: [
      'Use a larger instance type',
      'Deploy across multiple Availability Zones',
      'Deploy to more edge locations',
      'Take daily snapshots in a single AZ',
    ],
    answer: 1,
    explanation: 'Availability Zones are isolated from each other’s failures. Running across several of them, behind a load balancer with a Multi-AZ database, keeps you up when one fails.',
    codexIds: ['availability-zones', 'high-availability'],
    reward: 300,
  },
  {
    id: 'q-shield',
    prompt: 'Which AWS service provides DDoS protection to all customers automatically at no additional cost?',
    options: ['AWS Shield Standard', 'AWS Shield Advanced', 'AWS WAF', 'Amazon GuardDuty'],
    answer: 0,
    explanation: 'Shield Standard is automatically enabled for every AWS customer and defends against common network and transport layer DDoS attacks. Shield Advanced is a paid upgrade.',
    codexIds: ['shield'],
    reward: 300,
  },
];

export function getQuestion(id: string): BoardQuestion | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

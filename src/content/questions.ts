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

  // ── Chapter 4 ──
  {
    id: 'q-acm', prompt: 'Which AWS service provides free SSL/TLS certificates for use with CloudFront and Elastic Load Balancing?',
    options: ['AWS Certificate Manager', 'AWS KMS', 'AWS Secrets Manager', 'Amazon Inspector'], answer: 0,
    explanation: 'AWS Certificate Manager (ACM) provisions and automatically renews public SSL/TLS certificates at no cost when used with integrated services.',
    codexIds: ['acm'], reward: 300,
  },
  {
    id: 'q-artifact', prompt: 'An auditor asks for AWS’s PCI DSS and SOC compliance reports. Where do you get them?',
    options: ['AWS Artifact', 'AWS Config', 'Amazon Macie', 'AWS Trusted Advisor'], answer: 0,
    explanation: 'AWS Artifact is the self-service portal for AWS compliance reports and agreements.',
    codexIds: ['artifact'], reward: 300,
  },
  {
    id: 'q-waf', prompt: 'Which service protects a web application from SQL injection and cross-site scripting attacks?',
    options: ['AWS Shield Standard', 'AWS WAF', 'Amazon GuardDuty', 'Security groups'], answer: 1,
    explanation: 'AWS WAF inspects HTTP requests and blocks common web exploits. Shield protects against DDoS; GuardDuty detects threats; security groups filter ports, not request contents.',
    codexIds: ['waf'], reward: 300,
  },
  {
    id: 'q-sqs', prompt: 'Which service decouples components by letting one part of an application send messages that another processes later?',
    options: ['Amazon SNS', 'Amazon SQS', 'Amazon Kinesis', 'AWS Step Functions'], answer: 1,
    explanation: 'Amazon SQS is a message queue: producers and consumers work at their own pace, so spikes don’t overwhelm the consumers.',
    codexIds: ['sqs'], reward: 300,
  },
  {
    id: 'q-lambda', prompt: 'Which compute service runs code without provisioning or managing servers, charging only for the compute time used?',
    options: ['Amazon EC2', 'AWS Lambda', 'Amazon Lightsail', 'AWS Batch'], answer: 1,
    explanation: 'AWS Lambda is serverless: it scales automatically per request and bills per invocation and duration.',
    codexIds: ['lambda'], reward: 300,
  },
  {
    id: 'q-support', prompt: 'What is the lowest-cost AWS Support plan that offers 24/7 phone support and a response time under 1 hour for a production system outage?',
    options: ['Basic', 'Developer', 'Business', 'Enterprise'], answer: 2,
    explanation: 'Business Support adds 24/7 phone, chat, and email, a <1 hour response for production system down, and all Trusted Advisor checks.',
    codexIds: ['support-plans'], reward: 300,
  },
  // ── Chapter 5 ──
  {
    id: 'q-least-privilege', prompt: 'A finance employee needs to view the bill. What permissions should they get?',
    options: ['AdministratorAccess, so they’re never blocked', 'Only billing read access (least privilege)', 'The root user password', 'Permissions to launch EC2 instances'], answer: 1,
    explanation: 'Least privilege means granting only the permissions needed for the job.',
    codexIds: ['least-privilege', 'iam'], reward: 300,
  },
  {
    id: 'q-roles', prompt: 'What is the most secure way to let an application on EC2 access an S3 bucket?',
    options: ['Store an IAM user’s access keys on the instance', 'Attach an IAM role to the instance', 'Use the root user’s credentials', 'Make the bucket public'], answer: 1,
    explanation: 'An IAM role gives the instance temporary, automatically rotated credentials, so there are no long-term keys to leak.',
    codexIds: ['iam-roles'], reward: 300,
  },
  {
    id: 'q-cloudtrail', prompt: 'Which service records who made which API call in your AWS account, and when?',
    options: ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Config', 'Amazon Inspector'], answer: 1,
    explanation: 'CloudTrail logs API activity for auditing. CloudWatch is metrics and logs; Config tracks resource configurations.',
    codexIds: ['cloudtrail'], reward: 300,
  },
  {
    id: 'q-organizations', prompt: 'Which feature lets a company get one bill for many AWS accounts and share volume discounts?',
    options: ['Consolidated billing in AWS Organizations', 'AWS Cost Explorer', 'Cost allocation tags', 'AWS Budgets'], answer: 0,
    explanation: 'AWS Organizations’ consolidated billing combines accounts into one bill and pools usage for volume pricing.',
    codexIds: ['organizations', 'consolidated-billing'], reward: 300,
  },
  // ── Chapter 6 ──
  {
    id: 'q-cost-explorer', prompt: 'Which tool visualizes past AWS spending by service and forecasts future costs?',
    options: ['AWS Pricing Calculator', 'AWS Cost Explorer', 'AWS Budgets', 'AWS Artifact'], answer: 1,
    explanation: 'Cost Explorer analyzes historical cost and usage and forecasts. The Pricing Calculator estimates costs before you build; Budgets alerts on thresholds.',
    codexIds: ['cost-explorer'], reward: 300,
  },
  {
    id: 'q-storage-class', prompt: 'Which S3 storage class is the cheapest for data that must be kept for years but is almost never read?',
    options: ['S3 Standard', 'S3 Standard-IA', 'S3 Intelligent-Tiering', 'S3 Glacier Deep Archive'], answer: 3,
    explanation: 'Glacier Deep Archive has the lowest storage price, with retrieval times of hours. It’s built for long-term archives.',
    codexIds: ['s3-storage-classes'], reward: 300,
  },
  {
    id: 'q-spot', prompt: 'Which EC2 pricing option is best for fault-tolerant batch jobs that can be interrupted?',
    options: ['On-Demand', 'Reserved Instances', 'Spot Instances', 'Dedicated Hosts'], answer: 2,
    explanation: 'Spot Instances are up to 90% off but can be reclaimed with a two-minute warning, which is fine for interruptible work.',
    codexIds: ['spot'], reward: 300,
  },
  {
    id: 'q-savings', prompt: 'A company runs a steady amount of compute across EC2 and Lambda all year. Which option gives a discount while staying flexible across instance types?',
    options: ['Compute Savings Plans', 'Spot Instances', 'On-Demand Capacity Reservations', 'Dedicated Instances'], answer: 0,
    explanation: 'Compute Savings Plans discount a committed $/hour of compute and apply across instance families, Regions, Fargate, and Lambda.',
    codexIds: ['savings-plans'], reward: 300,
  },
  // ── Chapter 7 ──
  {
    id: 'q-region-choice', prompt: 'Which factors should you consider when choosing an AWS Region?',
    options: ['Compliance, latency to customers, service availability, and pricing', 'Only the cheapest price', 'The Region closest to AWS headquarters', 'The Region with the most Availability Zones only'], answer: 0,
    explanation: 'Data residency/compliance, proximity to users, which services are offered, and price all vary by Region.',
    codexIds: ['regions', 'data-residency'], reward: 300,
  },
  {
    id: 'q-cloudformation', prompt: 'Which service lets you define infrastructure in templates and deploy it repeatably to other Regions or accounts?',
    options: ['AWS CloudFormation', 'AWS Systems Manager', 'AWS Config', 'Amazon CloudWatch'], answer: 0,
    explanation: 'CloudFormation is infrastructure as code: the same template creates the same resources every time.',
    codexIds: ['cloudformation'], reward: 300,
  },
  {
    id: 'q-dr', prompt: 'Which disaster recovery strategy has the lowest recovery time, with full capacity running in two Regions at once?',
    options: ['Backup and restore', 'Pilot light', 'Warm standby', 'Multi-site active-active'], answer: 3,
    explanation: 'Multi-site active-active serves traffic from both Regions all the time: fastest recovery, highest cost.',
    codexIds: ['multi-region-dr'], reward: 300,
  },
  // ── Chapter 8 ──
  {
    id: 'q-7rs', prompt: 'Moving an application to AWS without changing it (“lift and shift”) is which migration strategy?',
    options: ['Refactor', 'Rehost', 'Repurchase', 'Retire'], answer: 1,
    explanation: 'Rehosting moves servers as they are, often with AWS Application Migration Service.',
    codexIds: ['migration-7rs'], reward: 300,
  },
  {
    id: 'q-snowball', prompt: 'A company must move 400 TB to AWS but has a slow internet connection. What should it use?',
    options: ['AWS Snowball Edge', 'AWS Site-to-Site VPN', 'Amazon S3 Transfer Acceleration only', 'AWS DataSync over the internet'], answer: 0,
    explanation: 'Snow Family devices ship your data physically when the network would take months.',
    codexIds: ['snow-family'], reward: 300,
  },
  {
    id: 'q-dx', prompt: 'Which option provides a dedicated private network connection from an on-premises data center to AWS?',
    options: ['AWS Direct Connect', 'AWS Site-to-Site VPN', 'Amazon CloudFront', 'An internet gateway'], answer: 0,
    explanation: 'Direct Connect is a dedicated line that doesn’t traverse the public internet. VPN is encrypted but runs over the internet.',
    codexIds: ['direct-connect'], reward: 300,
  },
  // ── Chapter 9 ──
  {
    id: 'q-athena', prompt: 'Which service lets you run SQL queries directly against data stored in Amazon S3 without managing servers?',
    options: ['Amazon Redshift', 'Amazon Athena', 'Amazon RDS', 'Amazon EMR'], answer: 1,
    explanation: 'Athena is serverless interactive SQL over S3; you pay per query.',
    codexIds: ['athena'], reward: 300,
  },
  {
    id: 'q-rekognition', prompt: 'Which service can detect inappropriate content in images uploaded by users?',
    options: ['Amazon Comprehend', 'Amazon Rekognition', 'Amazon Textract', 'Amazon Polly'], answer: 1,
    explanation: 'Rekognition analyzes images and video, including content moderation.',
    codexIds: ['rekognition'], reward: 300,
  },
  {
    id: 'q-bedrock', prompt: 'Which service provides API access to foundation models for building generative AI applications?',
    options: ['Amazon SageMaker', 'Amazon Bedrock', 'Amazon Lex', 'Amazon Kendra'], answer: 1,
    explanation: 'Amazon Bedrock offers foundation models from Amazon and other AI companies through one API, fully managed.',
    codexIds: ['bedrock'], reward: 300,
  },
  {
    id: 'q-redshift', prompt: 'Which service is a fully managed, petabyte-scale data warehouse?',
    options: ['Amazon DynamoDB', 'Amazon Redshift', 'Amazon Aurora', 'Amazon ElastiCache'], answer: 1,
    explanation: 'Amazon Redshift is AWS’s data warehouse for analytics.',
    codexIds: ['redshift'], reward: 300,
  },
  // ── Chapter 10 ──
  {
    id: 'q-macie', prompt: 'Which service uses machine learning to discover sensitive data such as personal information in Amazon S3?',
    options: ['Amazon GuardDuty', 'Amazon Macie', 'Amazon Inspector', 'AWS Shield'], answer: 1,
    explanation: 'Macie finds and classifies sensitive data in S3.',
    codexIds: ['macie'], reward: 300,
  },
  {
    id: 'q-inspector', prompt: 'Which service automatically scans EC2 instances and container images for software vulnerabilities?',
    options: ['Amazon Inspector', 'Amazon Detective', 'AWS Config', 'AWS Trusted Advisor'], answer: 0,
    explanation: 'Amazon Inspector continuously scans for CVEs and unintended network exposure.',
    codexIds: ['inspector'], reward: 300,
  },
  {
    id: 'q-shared-managed', prompt: 'With AWS Lambda, which task is still the customer’s responsibility?',
    options: ['Patching the operating system', 'Securing their function code and its permissions', 'Maintaining the physical servers', 'Scaling the underlying fleet'], answer: 1,
    explanation: 'For serverless services AWS manages the OS and infrastructure; you remain responsible for your code, data, and IAM permissions.',
    codexIds: ['shared-responsibility-by-service', 'lambda'], reward: 300,
  },
];

export function getQuestion(id: string): BoardQuestion | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

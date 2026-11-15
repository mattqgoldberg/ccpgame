/** Player-facing Codex text, keyed by coverage-matrix id. */
export const CODEX_TEXT: Record<string, string> = {
  'six-benefits':
    'AWS lists six advantages of cloud computing: trade fixed expense for variable expense; benefit from massive economies of scale; stop guessing capacity; increase speed and agility; stop spending money running and maintaining data centers; and go global in minutes.',
  'capex-opex':
    'Capital expenditure (CapEx) is paying upfront for physical assets like servers. Operational expenditure (OpEx) is paying as you go for what you use. The cloud turns most IT CapEx into OpEx.',
  agility:
    'In the cloud, new resources are an API call away, so teams can experiment and ship in minutes instead of waiting weeks for hardware.',
  regions:
    'A Region is a physical location in the world containing multiple Availability Zones. Choose a Region based on compliance and data residency, proximity to customers (latency), which services are available, and pricing.',
  'availability-zones':
    'An Availability Zone (AZ) is one or more discrete data centers with redundant power, networking, and connectivity in a Region. AZs are isolated from each other’s failures but linked with low-latency connections.',
  'edge-locations':
    'Edge locations are sites in hundreds of cities that CloudFront (and Route 53) use to serve users with low latency. There are far more edge locations than Regions.',
  'high-availability':
    'A highly available system keeps working when a component fails. On AWS the standard pattern is resources in multiple Availability Zones behind a load balancer, with a Multi-AZ database.',
  elasticity:
    'Elasticity is automatically acquiring resources when you need them and releasing them when you don’t. Scalability is the ability to handle growth. Auto Scaling delivers both.',
  'well-architected':
    'The AWS Well-Architected Framework evaluates architectures against six pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability.',
  route53:
    'Amazon Route 53 is a highly available DNS service. It registers domain names, translates names to IP addresses, runs health checks, and supports routing policies such as simple, weighted, latency-based, failover, and geolocation.',
  cloudfront:
    'Amazon CloudFront is a content delivery network (CDN). It caches content at edge locations near users, cutting latency and load on your origin (S3, a load balancer, or EC2), and absorbs a lot of DDoS traffic.',
  s3:
    'Amazon S3 is object storage designed for 99.999999999% (11 nines) durability. Files live in buckets, it scales automatically, and it can host static websites. You pay for storage, requests, and data transfer.',
  lightsail:
    'Amazon Lightsail offers simple virtual private servers at a predictable monthly price that bundles compute, storage, and data transfer. Great for simple sites; less flexible than EC2.',
  ec2:
    'Amazon EC2 provides resizable virtual servers called instances. You pick the instance type, operating system, and network settings, and you’re responsible for patching the guest OS and configuring security groups.',
  'instance-types':
    'EC2 instance families fit different workloads: general purpose (balanced), compute optimized (CPU-heavy), memory optimized (large in-memory data), storage optimized (high disk I/O), and accelerated computing (GPUs).',
  elb:
    'Elastic Load Balancing spreads incoming traffic across targets such as EC2 instances in multiple AZs. Health checks make sure only healthy targets get traffic. Types include Application, Network, and Gateway Load Balancers.',
  'auto-scaling':
    'Amazon EC2 Auto Scaling adds instances when demand rises and removes them when it falls, staying between a minimum and maximum. It replaces unhealthy instances and can spread them across Availability Zones.',
  rds:
    'Amazon RDS is a managed relational database service (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, and Aurora). AWS handles provisioning, patching, and backups. Multi-AZ keeps a standby in another AZ for automatic failover; read replicas scale reads.',
  elasticache:
    'Amazon ElastiCache is a managed in-memory cache (Redis-compatible or Memcached). Caching frequently read data cuts database load and gives sub-millisecond responses.',
  cloudwatch:
    'Amazon CloudWatch collects metrics and logs from AWS resources and applications. Basic metrics are collected automatically; alarms watch metrics and notify you, or take actions like scaling, when thresholds are crossed.',
  'health-dashboard':
    'The AWS Health Dashboard shows the status of AWS services and events that affect your specific resources, such as a hardware problem in an AZ you use.',
  shield:
    'AWS Shield protects against DDoS attacks. Shield Standard is automatic and free for all customers and covers common network and transport layer (layer 3/4) attacks. Shield Advanced is paid: it adds protection against larger and application-layer attacks, a 24/7 response team, and cost protection.',
  'security-groups':
    'Security groups are virtual firewalls for instances. They’re stateful (return traffic is automatically allowed) and support allow rules only. All inbound traffic is denied by default.',
  'shared-responsibility':
    'AWS is responsible for security OF the cloud: the hardware, software, networking, and facilities that run AWS services. Customers are responsible for security IN the cloud: their data, IAM, guest operating systems, application code, and firewall configuration.',
  'shared-responsibility-by-service':
    'How much you manage depends on the service. On EC2 (infrastructure as a service) you patch the guest OS. On RDS, AWS patches the database OS and engine. With S3 or Lambda, AWS manages even more. Your data and access controls are always yours.',
  'managed-services-economics':
    'Managed services remove “undifferentiated heavy lifting” like patching, backups, and failover, so your team spends its time on the product instead of infrastructure. That lowers total cost of ownership.',
  mfa:
    'Multi-factor authentication (MFA) requires a second factor, such as an authenticator app or security key, in addition to a password. Enable it on the root user and every human user.',
  'root-user':
    'The root user comes with the AWS account and has complete access to everything. Protect it with MFA, don’t create access keys for it, and use it only for the few tasks that require it, like changing the support plan or closing the account.',
  'free-tier':
    'The AWS Free Tier includes Always Free offers plus free trials or credits for new accounts. Historically, new accounts got 750 hours a month of small EC2 and RDS instances for 12 months. AWS revised the Free Tier in 2025, so check the current terms.',
  'on-demand':
    'With On-Demand pricing you pay for compute by the hour or second with no long-term commitment. It’s the most flexible option and has the highest unit price, which makes it a good fit for short-term, spiky, or unpredictable workloads.',
  'data-transfer-pricing':
    'Data transfer into AWS from the internet is free. Data transfer out to the internet is charged per GB, and traffic between AZs or Regions also costs money. CloudFront can reduce what you pay to move data out of your origin.',
  'trusted-advisor':
    'AWS Trusted Advisor checks your account against best practices for cost optimization, performance, security, fault tolerance, service limits, and operational excellence. Basic and Developer Support get core security checks and service quotas; Business Support and higher unlock every check.',
};

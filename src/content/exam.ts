// Structure of the AWS Certified Cloud Practitioner exam (CLF-C02).
// Re-check against the official exam guide when AWS revises it.

export type DomainId = 'cloud-concepts' | 'security' | 'technology' | 'billing';

export interface Domain {
  id: DomainId;
  number: 1 | 2 | 3 | 4;
  name: string;
  /** Percentage of scored exam content. */
  weight: number;
}

export const DOMAINS: Domain[] = [
  { id: 'cloud-concepts', number: 1, name: 'Cloud Concepts', weight: 24 },
  { id: 'security', number: 2, name: 'Security and Compliance', weight: 30 },
  { id: 'technology', number: 3, name: 'Cloud Technology and Services', weight: 34 },
  { id: 'billing', number: 4, name: 'Billing, Pricing, and Support', weight: 12 },
];

export const TASKS = {
  '1.1': 'Define the benefits of the AWS Cloud',
  '1.2': 'Identify design principles of the AWS Cloud',
  '1.3': 'Understand the benefits of and strategies for migration to the AWS Cloud',
  '1.4': 'Understand concepts of cloud economics',
  '2.1': 'Understand the AWS shared responsibility model',
  '2.2': 'Understand AWS Cloud security, governance, and compliance concepts',
  '2.3': 'Identify AWS access management capabilities',
  '2.4': 'Identify components and resources for security',
  '3.1': 'Define methods of deploying and operating in the AWS Cloud',
  '3.2': 'Define the AWS global infrastructure',
  '3.3': 'Identify AWS compute services',
  '3.4': 'Identify AWS database services',
  '3.5': 'Identify AWS network services',
  '3.6': 'Identify AWS storage services',
  '3.7': 'Identify AWS artificial intelligence and machine learning (AI/ML) services and analytics services',
  '3.8': 'Identify services from other in-scope AWS service categories',
  '4.1': 'Compare AWS pricing models',
  '4.2': 'Understand resources for billing, budget, and cost management',
  '4.3': 'Identify AWS technical resources and AWS Support options',
} as const;

export type TaskId = keyof typeof TASKS;

export function domainOfTask(task: TaskId): Domain {
  const n = Number(task[0]);
  return DOMAINS.find((d) => d.number === n)!;
}

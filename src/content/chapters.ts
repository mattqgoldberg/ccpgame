export interface Chapter {
  id: number;
  title: string;
  premise: string;
}

export const CHAPTERS: Chapter[] = [
  { id: 0, title: 'The Garage', premise: 'Run a site on a server you bought. Guess capacity wrong, then discover the cloud.' },
  { id: 1, title: 'Static Site', premise: 'Launch a blog cheaply and make it fast worldwide.' },
  { id: 2, title: 'Dynamic App', premise: 'Add logins and a database. Learn what AWS manages and what you do.' },
  { id: 3, title: 'Going Viral', premise: 'Traffic explodes. Scale out, survive an AZ outage, keep customers happy.' },
  { id: 4, title: 'E-Commerce', premise: 'Take payments. Attackers notice. Auditors want PCI evidence.' },
  { id: 5, title: 'Growing Team', premise: 'Hire people, split into accounts, and keep everyone on least privilege.' },
  { id: 6, title: 'Cost Crunch', premise: 'Investors demand profit. Cut the bill without breaking the site.' },
  { id: 7, title: 'Go Global', premise: 'Expand to new continents with low latency, data residency, and DR.' },
  { id: 8, title: 'The Acquisition', premise: 'Buy a company with a legacy data center and migrate it.' },
  { id: 9, title: 'Data & AI', premise: 'Turn clickstreams into insight and ship AI-powered features.' },
  { id: 10, title: 'Health-Tech Finale', premise: 'Launch a HIPAA-eligible product and pass the final architecture review.' },
];

import type { ServiceKind } from '../../sim/types';
import { missionOver, type Mission } from '../tutorial';
import { DAY, decide, storeStack } from './shared';

const base = {
  chapter: 9, available: [] as ServiceKind[], latencyTargetMs: 150, requireDns: true, freeTier: false, cloud: true, strikes: true,
  requireHttps: true, revenue: { static: 0.000004, dynamic: 0.00002 },
};
const carriedOver = {
  secretsManager: true, support: 'business' as const, ec2Roles: true, organizations: true, scp: true,
  identityCenter: true, cloudtrail: true, config: true, guardduty: true, costTags: true, budget: 5000, backup: true,
};
const stack = storeStack({ https: true, encrypted: true, waf: true, orders: true });
const boost = { revenueBoost: 1.03 };

// ── 9-1 ───────────────────────────────────────────────────────────────────

const knowYourCustomers: Mission = {
  ...base,
  id: '9-1', title: 'Know Your Customers',
  summary: 'We have years of data and no idea what it says. Build an analytics pipeline, one request at a time.',
  lengthHours: 14 * DAY, startingCash: 3000,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 260, endPeak: 340, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    decide('k-stream', 1 * DAY, 'Every click, live', 'Marketing wants to capture every click on the site as it happens and react in real time.',
      'Amazon Kinesis', 'Right. Kinesis ingests and processes real-time streaming data like clickstreams.',
      [['Amazon SQS', 'SQS queues tasks for workers. For high-volume streaming data that many consumers analyze, use Kinesis.'], ['AWS Snowball', 'Snowball moves data offline in bulk, the opposite of real time.']],
      ['kinesis'], boost),
    decide('k-glue', 2 * DAY, 'Messy data', 'The raw click data lands in S3 as messy JSON. We need it cleaned, converted, and cataloged so other tools can find it.',
      'AWS Glue', 'Right. Glue is serverless ETL (extract, transform, load) with a Data Catalog that other services like Athena can query.',
      [['Amazon QuickSight', 'QuickSight draws dashboards; it doesn’t clean data.'], ['Amazon Route 53', 'That’s DNS!']],
      ['glue'], boost),
    decide('k-athena', 3 * DAY, 'A quick question', 'Morgan just wants to know which tent sold best last month, using SQL on the files already in S3, with nothing to set up.',
      'Amazon Athena', 'Right. Athena runs SQL directly against S3 with no servers, and you pay per query.',
      [['Amazon Redshift', 'Redshift is a full data warehouse: powerful, but more than a quick question needs.'], ['Amazon RDS', 'RDS runs our app’s database; the click data is in S3.']],
      ['athena'], boost),
    decide('k-redshift', 5 * DAY, 'Serious analytics', 'Finance wants fast, complex reports across five years of sales and inventory, run all day by many analysts.',
      'Amazon Redshift', 'Right. Redshift is a petabyte-scale data warehouse built for complex analytical queries (OLAP).',
      [['Amazon DynamoDB', 'DynamoDB is great for fast lookups by key, not big analytical joins.'], ['Amazon ElastiCache', 'ElastiCache is an in-memory cache, not a warehouse.']],
      ['redshift'], boost),
    decide('k-quicksight', 7 * DAY, 'Dashboards for the board', 'The board wants interactive sales dashboards they can explore on their tablets.',
      'Amazon QuickSight', 'Right. QuickSight is serverless business intelligence: dashboards and visualizations.',
      [['CloudWatch dashboards', 'CloudWatch dashboards show system metrics, not business sales data.'], ['AWS Cost Explorer', 'Cost Explorer shows our AWS bill, not our sales.']],
      ['quicksight'], boost),
    decide('k-emr', 9 * DAY, 'Big data science', 'Our new data scientist wants to run Apache Spark jobs over terabytes of history.',
      'Amazon EMR', 'Right. EMR runs big data frameworks like Spark and Hadoop on managed clusters.',
      [['AWS Lambda', 'Lambda functions run for up to 15 minutes, not big Spark jobs.'], ['Amazon Lightsail', 'Lightsail is for simple servers and websites.']],
      ['emr'], boost),
    decide('k-search', 11 * DAY, 'A better search box', 'Customers want a product search that handles typos and ranks the best matches first.',
      'Amazon OpenSearch Service', 'Right. OpenSearch is built for full-text search and log analytics.',
      [['Amazon Athena', 'Athena is for analysts running SQL over S3, not a live search box.'], ['Amazon Neptune', 'Neptune is a graph database.']],
      ['opensearch'], boost),
    { id: 'k-board', at: 6 * DAY, kind: 'board', questionId: 'q-athena' },
    { id: 'k-board-2', at: 12 * DAY, kind: 'board', questionId: 'q-redshift' },
  ],
  steps: [
    {
      id: 'intro', title: 'What does the data say?',
      body: [
        'We’ve sold gear to a lot of people. I have a hunch our data could tell us what to stock, when to run sales, and who to email. But nobody can read it.',
        'Over the next two weeks the team will come to you with requests. Pick the right AWS service each time, and every good pick makes the business smarter.',
      ],
    },
    {
      id: 'pipeline', speaker: 'guide', title: 'A data pipeline', codex: ['s3'],
      body: [
        'Analytics on AWS usually flows through stages:',
        '• Ingest: get data in (Kinesis for streams).',
        '• Store: keep it cheaply in S3 (a “data lake”).',
        '• Prepare and catalog: Glue.',
        '• Query and analyze: Athena for ad-hoc SQL, Redshift for a warehouse, EMR for big data frameworks.',
        '• Visualize: QuickSight.',
        'Each correct pick gives a small permanent revenue boost for the rest of the mission.',
      ],
    },
    {
      id: 'run', title: 'Requests incoming', highlight: 'play',
      body: ['Here they come.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['batch', 'step-functions'],
  outro: ['From clicks to dashboards: data now drives what we stock and when we run sales.'],
};

// ── 9-2 ───────────────────────────────────────────────────────────────────

const smartStore: Mission = {
  ...base,
  id: '9-2', title: 'Smart Store',
  summary: 'Everyone wants AI. Pick the right service for each idea.',
  lengthHours: 14 * DAY, startingCash: 3000,
  initialNodes: stack.nodes, initialEdges: stack.edges,
  initialAccount: carriedOver,
  traffic: { startPeak: 300, endPeak: 360, staticShare: 0.3 },
  objectives: [
    { kind: 'availability', label: 'Serve 99.5% of requests', target: 0.995 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    decide('s-rekognition', 1 * DAY, 'Photo moderation', 'Customers can now upload photos with their reviews. We need to catch inappropriate images automatically.',
      'Amazon Rekognition', 'Right. Rekognition analyzes images and video, including detecting unsafe content.',
      [['Amazon Textract', 'Textract reads text from documents, not image content.'], ['Amazon Comprehend', 'Comprehend analyzes text, not images.']],
      ['rekognition'], boost),
    decide('s-comprehend', 2 * DAY, 'What do reviews say?', 'We have 50,000 written reviews. Which products make people happy, and which make them angry?',
      'Amazon Comprehend', 'Right. Comprehend does sentiment analysis and key-phrase extraction on text.',
      [['Amazon Polly', 'Polly speaks text aloud; it doesn’t analyze it.'], ['Amazon Kinesis', 'Kinesis streams data; Comprehend understands language.']],
      ['comprehend'], boost),
    decide('s-lex', 3 * DAY, 'A support chatbot', 'Half our support emails ask “where’s my order?”. Let’s answer them with a chatbot on the site.',
      'Amazon Lex', 'Right. Lex builds conversational chatbots and voice bots.',
      [['Amazon Connect', 'Connect is a full call center. For a website chatbot, Lex is the building block.'], ['Amazon SNS', 'SNS sends notifications; it can’t hold a conversation.']],
      ['lex', 'connect'], boost),
    decide('s-personalize', 4 * DAY, 'Customers also bought…', 'We want “recommended for you” products on every page, like the big stores have.',
      'Amazon Personalize', 'Right. Personalize builds real-time recommendations without machine learning expertise.',
      [['Amazon Rekognition', 'Rekognition is for images and video.'], ['Amazon Athena', 'Athena answers SQL questions; it doesn’t make live recommendations.']],
      ['personalize'], { revenueBoost: 1.06 }),
    decide('s-bedrock', 5 * DAY, 'Generative product descriptions', 'Writing descriptions for 4,000 products takes forever. Let’s generate first drafts with a large language model.',
      'Amazon Bedrock', 'Right. Bedrock gives API access to foundation models from Amazon and other AI companies for generative AI, with nothing to manage.',
      [['Amazon SageMaker', 'You could train your own model in SageMaker, but foundation models in Bedrock do this out of the box.'], ['Amazon Translate', 'Translate converts between languages; it doesn’t write new text.']],
      ['bedrock'], boost),
    decide('s-polly', 6 * DAY, 'Listen to the trail guides', 'Hikers want to listen to our trail guides while they walk.',
      'Amazon Polly', 'Right. Polly turns text into lifelike speech.',
      [['Amazon Transcribe', 'Transcribe goes the other way: speech to text.']],
      ['polly'], boost),
    decide('s-transcribe', 7 * DAY, 'Searchable support calls', 'We record support calls. We want them as text so we can search and analyze them.',
      'Amazon Transcribe', 'Right. Transcribe converts speech into text.',
      [['Amazon Polly', 'Polly is text-to-speech, the opposite direction.']],
      ['transcribe'], boost),
    decide('s-textract', 8 * DAY, 'Rental waivers', 'Summit Rentals has boxes of scanned paper waivers. We need the names, dates, and signatures as data.',
      'Amazon Textract', 'Right. Textract extracts text, forms, and tables from scanned documents.',
      [['Amazon Rekognition', 'Rekognition can find text in photos, but Textract understands forms and tables in documents.']],
      ['textract'], boost),
    decide('s-kendra', 9 * DAY, 'Find it in the wiki', 'Staff waste hours searching our internal wiki, manuals, and policies.',
      'Amazon Kendra', 'Right. Kendra is intelligent enterprise search: ask a question in plain English, get answers from company documents.',
      [['Amazon OpenSearch Service', 'OpenSearch can power search, but Kendra is the managed, ML-powered answer engine for company documents.']],
      ['kendra'], boost),
    decide('s-sagemaker', 10 * DAY, 'Forecasting demand', 'Our data scientist wants to build, train, and deploy a custom model that predicts which gear will sell next season.',
      'Amazon SageMaker', 'Right. SageMaker is the platform to build, train, and deploy your own machine learning models.',
      [['Amazon Personalize', 'Personalize makes recommendations; a custom forecasting model is a SageMaker job.']],
      ['sagemaker'], boost),
    decide('s-q', 11 * DAY, 'A coding assistant', 'Priya asks for an AI assistant that helps write and explain code, and answers questions about AWS.',
      'Amazon Q Developer', 'Right. Amazon Q Developer is a generative AI assistant for software development and AWS.',
      [['Amazon Lex', 'Lex builds chatbots for your customers, not a coding assistant.']],
      ['amazon-q'], boost),
    decide('s-neptune', 12 * DAY, 'Trip buddies', 'We want a “hikers like you also went to…” feature based on who hiked which trails with whom.',
      'Amazon Neptune', 'Right. Neptune is a graph database, ideal for relationships between people, places, and trips.',
      [['Amazon Redshift', 'Redshift is great at aggregates but not at following chains of relationships.']],
      ['neptune'], boost),
    { id: 's-board', at: 6 * DAY + 12, kind: 'board', questionId: 'q-rekognition' },
    { id: 's-board-2', at: 12 * DAY + 12, kind: 'board', questionId: 'q-bedrock' },
  ],
  steps: [
    {
      id: 'intro', title: 'Everyone wants AI',
      body: [
        'Every meeting now ends with “…and we should use AI for that.” Fine! But let’s use the right tool each time.',
        'I’ll bring you one idea a day for the next two weeks.',
      ],
    },
    {
      id: 'layers', speaker: 'guide', title: 'Three ways to do AI on AWS',
      body: [
        '• AI services: ready-made, no ML skills needed. Rekognition (images), Comprehend (text), Lex (chatbots), Polly (text to speech), Transcribe (speech to text), Translate, Textract (documents), Personalize (recommendations), Kendra (search).',
        '• Amazon SageMaker: build, train, and deploy your own models.',
        '• Generative AI: Amazon Bedrock for foundation models, and Amazon Q as an assistant.',
      ],
    },
    {
      id: 'run', title: 'Idea of the day', highlight: 'play',
      body: ['Let’s hear the first one.'],
      task: 'Run until the end of the mission.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: ['iot', 'device-farm', 'ground-station', 'appsync', 'amplify', 'ses', 'xray'],
  outro: ['A smarter store: moderated photos, a chatbot, recommendations, and generated descriptions, each built on the right service.'],
};

export const CHAPTER_9: Mission[] = [knowYourCustomers, smartStore];

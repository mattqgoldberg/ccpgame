import {
  allLinked,
  has,
  hourAtLeast,
  missionOver,
  playing,
  selected,
  tabOpen,
  type Mission,
} from '../tutorial';

import {
  COMPANY,
  DAY,
  edge,
  users,
} from './shared';

// ── Chapter 0: The Garage ─────────────────────────────────────────────────

const firstDay: Mission = {
  id: '0-1', chapter: 0, title: 'First Day',
  summary: 'Meet your boss and the one server that runs the whole store.',
  lengthHours: 5 * DAY, startingCash: 4000, available: [],
  initialNodes: [users, { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 160 } }],
  initialEdges: [edge('users', 'server1')],
  traffic: { startPeak: 8, endPeak: 10, staticShare: 0.5 },
  revenue: { static: 0.000025, dynamic: 0.00015 },
  latencyTargetMs: 200, requireDns: false, freeTier: false, cloud: false, strikes: false,
  objectives: [{ kind: 'availability', label: 'Keep the store up (95% of requests served)', target: 0.95 }],
  events: [],
  steps: [
    {
      id: 'welcome', title: `Welcome to ${COMPANY.name}`,
      body: [
        `Hi, I’m Morgan. I started ${COMPANY.name} in my garage, selling hiking and camping gear online. You’re our first engineer. Welcome aboard!`,
        'This screen is a map of our system. Customers are on the left. On the right is the server that runs the whole store. It lives in a closet next to my water heater.',
      ],
    },
    {
      id: 'select-server', title: 'Meet the server',
      body: ['Every time a customer loads a page or adds a tent to their cart, that request goes to our server.'],
      task: 'Click the Physical Server on the map.',
      done: selected('onprem'), unlock: ['tab-inspect'], highlight: 'node-onprem',
      success: 'The Inspect panel on the right shows details about whatever you select.',
      solve: (a) => a.select('onprem'),
    },
    {
      id: 'read-inspector', title: 'Reading the inspector', highlight: 'inspect-metrics',
      body: [
        'Load is how much work the server is doing right now. Capacity is the most it can handle: about 25 requests per second for this one.',
        'On the map, the bar labeled “Load” on the server fills up as it gets busier. Green is fine, yellow is busy, and red means it’s full and extra requests are failing.',
      ],
    },
    {
      id: 'press-play', speaker: 'guide', title: 'Start the clock',
      body: [
        'The game is paused. Time only moves when you press Play, and it pauses on its own whenever something important happens.',
        'One second of real time is about two hours at the store.',
      ],
      task: 'Press ▶ Play at the top of the screen.',
      done: playing, unlock: ['play'], highlight: 'play', clock: true, auto: true,
      solve: (a) => a.play(),
    },
    {
      id: 'watch-day', title: 'Watch the traffic',
      body: [
        'Each dot moving along the line is a request: blue for pages, green for files like photos. Red dots are requests that are failing. The number on the line is requests per second.',
        'Customers react above the Customers box. Mornings are quiet, and traffic peaks in the evening when people shop after work.',
      ],
      task: 'Let one full day go by.',
      done: hourAtLeast(DAY), clock: true,
    },
    {
      id: 'money', title: 'Keeping score', unlock: ['stat-cash', 'stat-traffic'], highlight: 'stat-cash',
      body: [
        'That was a normal day: busy evening, quiet morning. Two numbers just appeared at the top.',
        'Cash is the company’s money. Every order earns a little; electricity and the internet line for the closet cost a little.',
        'Traffic is requests per second, plus the percentage we served successfully. 100% means nobody saw an error.',
      ],
    },
    {
      id: 'finish', speaker: 'guide', title: 'Speed it up', highlight: 'play', unlock: ['speed-2x', 'speed-4x'],
      body: [
        'You can now run time at 2× or 4× speed. Pause whenever you like with ⏸ or the Space bar.',
        'Things pause on their own when something happens, so it’s safe to go fast.',
      ],
      task: 'Press 4× and finish the week.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: [],
  outro: ['A quiet first week. The server handled everything with room to spare… for now.'],
};

const theRush: Mission = {
  id: '0-2', chapter: 0, title: 'The Rush',
  summary: 'A blog is about to send a wave of customers. Is one server enough?',
  lengthHours: 21 * DAY, startingCash: 4000, available: [],
  initialNodes: [users, { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 100 } }],
  initialEdges: [edge('users', 'server1')],
  traffic: { startPeak: 10, endPeak: 18, staticShare: 0.5 },
  revenue: { static: 0.00005, dynamic: 0.0003 },
  latencyTargetMs: 200, requireDns: false, freeTier: false, cloud: false, strikes: true,
  objectives: [
    { kind: 'availability', label: 'Serve at least 97% of requests', target: 0.97 },
    { kind: 'cash', label: 'Finish with at least $3,000', target: 3000 },
  ],
  events: [
    {
      id: 'rush-spike', at: 11 * DAY + 14, kind: 'traffic-spike', multiplier: 3, duration: 3 * DAY,
      title: 'We’re on the front page!',
      body: ['The hiking blog published its feature. Customers are pouring in.'],
      debrief: [
        'Owning hardware means guessing capacity in advance. Guess low and customers get errors. Guess high and expensive servers sit idle for the rest of the year.',
      ],
    },
    { id: 'rush-board', at: 16 * DAY, kind: 'board', questionId: 'q-guess-capacity' },
  ],
  steps: [
    {
      id: 'goals', title: 'Goals for the month',
      body: ['Big month ahead. I’ve written our goals down for you.'],
      task: 'Open the Goals tab on the right.',
      done: tabOpen('goals'), unlock: ['tab-goals'], highlight: 'tab-goals',
      success: 'Goals turn green while you’re on track. They’re checked for real at the end of the mission.',
      solve: (a) => a.tab('goals'),
    },
    {
      id: 'strikes', title: 'How I work', unlock: ['boss'], highlight: 'boss',
      body: [
        'One more thing, and I’ll be straight with you.',
        'If the store is failing for 3 hours in a row, that’s a strike. If someone hacks us, that’s a strike. Three strikes in one month and I’ll have to let you go.',
        'Your strikes are shown at the top. When the store starts failing, a countdown shows how long you have to fix it before I notice.',
      ],
    },
    {
      id: 'run-1', speaker: 'guide', title: 'Business as usual', highlight: 'play', unlock: ['speed-8x'],
      body: ['Run the store for a few days. 8× speed is unlocked for quiet stretches like this.'],
      task: 'Press Play and run until Morgan has news.',
      done: hourAtLeast(5 * DAY), clock: true,
    },
    {
      id: 'news', title: 'Big news!',
      body: [
        'A popular hiking blog is featuring us around day 12! Traffic could triple for a few days.',
        'Our server handles about 25 requests per second and we already peak around 15. Triple that and we’re in trouble.',
        'A new server costs $2,500 and takes 3 days to arrive. Once we buy it, it’s ours, even if we never need it again.',
      ],
    },
    {
      id: 'buy', speaker: 'guide', title: 'Buy a server', unlock: ['svc:onprem'], highlight: 'palette-onprem',
      body: ['The Supplier panel on the left lists what you can buy.'],
      task: 'Buy a Physical Server from the Supplier panel.',
      done: has('onprem', 2),
      why: 'It takes three days to arrive, so you have to decide before the rush. That’s what “guessing capacity” means.',
      success: 'Ordered! It shows “Shipping” until it arrives.',
      solve: (a) => a.add('onprem', 'server2'),
    },
    {
      id: 'connect', speaker: 'guide', title: 'Plug it in', unlock: ['connect'], highlight: 'node-users',
      body: ['Traffic only flows along connections. Every service has a dot on its right side (traffic out) and on its left side (traffic in).'],
      task: 'Drag from the dot on the right of Customers to the dot on the left of the new server.',
      done: allLinked('users', 'onprem'),
      why: 'Without a connection, the new server just sits in the closet doing nothing.',
      success: 'Customers are now split between both servers. Until the new one arrives, the old one handles everything.',
      solve: (a) => a.link('users', 'server2'),
    },
    {
      id: 'run-2', speaker: 'guide', title: 'Ride the wave', unlock: ['speed-16x', 'chart', 'report-card'], highlight: 'chart',
      body: [
        'The Goals tab now has a chart of demand versus requests served. If the lines split apart, customers are getting errors.',
        '16× speed is unlocked too. The game still pauses when something happens.',
      ],
      task: 'Run until the end of the month.',
      done: missionOver, clock: true,
    },
  ],
  teachReport: true,
  codexOnStart: [], codexOnComplete: [],
  outro: [
    'We survived the rush. But look at what it cost: two servers, and for most of the month the second one sat idle.',
    'That’s the problem with owning hardware. You pay up front, wait days for it, and have to guess how much you’ll need.',
  ],
};

const theOutage: Mission = {
  id: '0-3', chapter: 0, title: 'The Outage',
  summary: 'A TV show features the store tomorrow. New servers take three days.',
  lengthHours: 5 * DAY, startingCash: 5000, available: [],
  initialNodes: [
    users,
    { id: 'server1', kind: 'onprem', config: {}, position: { x: 320, y: 60 } },
    { id: 'server2', kind: 'onprem', config: {}, position: { x: 320, y: 260 } },
  ],
  initialEdges: [edge('users', 'server1'), edge('users', 'server2')],
  traffic: { startPeak: 16, endPeak: 18, staticShare: 0.5 },
  revenue: { static: 0.00005, dynamic: 0.0003 },
  latencyTargetMs: 200, requireDns: false, freeTier: false, cloud: false, strikes: true,
  expectedStrikes: 1,
  objectives: [{ kind: 'availability', label: 'Serve at least 90% of requests this week', target: 0.9 }],
  events: [
    {
      id: 'tv-spike', at: 3 * DAY + 18, kind: 'traffic-spike', multiplier: 5, duration: 8,
      title: 'We’re on TV!',
      body: ['“Gear Up” just showed our tents to millions of viewers. Everyone is grabbing their phone at once.'],
      debrief: [
        'Morgan: “That was a disaster. Thousands of people saw our name on TV, and half of them got an error page.”',
        '“Two more outages like that and I’ll have to shut down the business. There has to be a better way to do this.”',
      ],
    },
  ],
  hide: ['svc:onprem'],
  steps: [
    {
      id: 'intro', title: 'Feeling good',
      body: [
        'Two servers, and the rush is behind us. I feel like we can handle anything now.',
        'Let’s have a quiet week.',
      ],
    },
    {
      id: 'run-1', title: 'A quiet week', highlight: 'play',
      body: ['Run the store for a couple of days.'],
      task: 'Press Play.',
      done: hourAtLeast(2 * DAY + 16), clock: true,
    },
    {
      id: 'news', title: 'We’re going to be on TV!',
      body: [
        '“Gear Up”, the outdoor show, is featuring us TOMORROW night. Millions of viewers!',
        'Our two servers handle about 50 requests per second. A TV mention could bring several times that.',
      ],
    },
    {
      id: 'no-time', speaker: 'guide', title: 'Out of time',
      body: [
        'A new server takes 3 days to arrive. The show airs in about a day. There’s no way to get more capacity in time.',
        'This is the real cost of owning hardware: capacity has to be bought before you need it, and you can’t react when something unexpected happens.',
        'All you can do is watch. The store will probably go down, and Morgan will notice.',
      ],
    },
    {
      id: 'brace', title: 'Brace yourself', highlight: 'play',
      body: ['Fingers crossed.'],
      task: 'Run until the end of the week.',
      done: missionOver, clock: true,
    },
  ],
  codexOnStart: [], codexOnComplete: [],
  outro: [
    'The store survived, barely. Morgan spent the weekend reading about something called “the cloud”: renting servers by the hour, and getting more in minutes instead of days.',
    'Next: Chapter 1, Into the Cloud.',
  ],
};

export const CHAPTER_0: Mission[] = [firstDay, theRush, theOutage];

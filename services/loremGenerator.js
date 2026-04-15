'use strict';

/**
 * Lorem Ipsum & Fake Data Generator
 * Pure function exports — no external dependencies.
 */

// ---------------------------------------------------------------------------
// Word pool (~200 lorem ipsum words)
// ---------------------------------------------------------------------------
const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'viverra', 'maecenas',
  'accumsan', 'lacus', 'vel', 'facilisis', 'volutpat', 'blandit', 'cursus',
  'risus', 'ultrices', 'gravida', 'dictum', 'fusce', 'placerat', 'orci',
  'semper', 'auctor', 'neque', 'vitae', 'sapien', 'pellentesque', 'habitant',
  'morbi', 'tristique', 'senectus', 'netus', 'fames', 'turpis', 'egestas',
  'praesent', 'elementum', 'facilisi', 'nullam', 'vehicula', 'ipsum', 'arcu',
  'bibendum', 'condimentum', 'mattis', 'pulvinar', 'nunc', 'faucibus', 'interdum',
  'posuere', 'urna', 'nec', 'tincidunt', 'integer', 'feugiat', 'scelerisque',
  'varius', 'morbi', 'enim', 'nunc', 'faucibus', 'tortor', 'dignissim',
  'convallis', 'aenean', 'pretium', 'vulputate', 'suspendisse', 'potenti',
  'donec', 'massa', 'ultricies', 'mi', 'quis', 'hendrerit', 'pharetra',
  'magna', 'ac', 'libero', 'mauris', 'cras', 'fermentum', 'odio', 'nibh',
  'proin', 'sagittis', 'nisl', 'rhoncus', 'diam', 'phasellus', 'vestibulum',
  'leo', 'lectus', 'malesuada', 'fringilla', 'ante', 'primis', 'porta',
  'imperdiet', 'dui', 'accumsan', 'augue', 'suscipit', 'tellus', 'luctus',
  'felis', 'sollicitudin', 'dapibus', 'euismod', 'lacinia', 'aliquet', 'porttitor',
  'molestie', 'aliquam', 'etiam', 'erat', 'nam', 'at', 'quam', 'tortor',
  'commodo', 'ornare', 'aenean', 'euismod', 'purus', 'iaculis', 'ligula',
  'hac', 'habitasse', 'platea', 'dictumst', 'quisque', 'eget', 'justo',
  'natoque', 'penatibus', 'magnis', 'dis', 'parturient', 'montes', 'nascetur',
  'ridiculus', 'mus', 'congue', 'nisi', 'venenatis', 'curabitur', 'tempus',
];

// ---------------------------------------------------------------------------
// Name pools (~50 each)
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa',
  'Timothy', 'Deborah',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts',
];

const DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'example.com',
  'mail.com', 'protonmail.com', 'icloud.com', 'aol.com', 'fastmail.com',
];

const STREETS = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr',
  'Pine St', 'Washington Ave', 'Lake Rd', 'Hill St', 'River Rd', 'Sunset Blvd',
  'Broadway', 'Forest Ave', 'Church St', 'Spring St', 'Highland Ave', 'Center St',
  'Valley Rd', 'Meadow Ln',
];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle',
  'Denver', 'Nashville', 'Portland', 'Memphis', 'Louisville', 'Baltimore',
  'Milwaukee', 'Tucson', 'Fresno', 'Sacramento', 'Mesa', 'Atlanta',
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const COMPANIES = [
  'Acme Corp', 'Globex', 'Initech', 'Hooli', 'Pied Piper', 'Umbrella Corp',
  'Stark Industries', 'Wayne Enterprises', 'Cyberdyne Systems', 'Soylent Corp',
  'Wonka Industries', 'Aperture Science', 'Oscorp', 'LexCorp', 'Weyland-Yutani',
  'Massive Dynamic', 'Tyrell Corp', 'Rekall', 'Nakatomi Trading', 'Genco Pura',
  'Dunder Mifflin', 'Sterling Cooper', 'Prestige Worldwide', 'Vandelay Industries',
  'Bluth Company', 'TechNova', 'Pinnacle Systems', 'Vertex Solutions', 'Summit Labs',
  'Helix Analytics', 'Cobalt Dynamics', 'Iron Gate Software', 'NorthStar AI',
  'Cascade Technologies', 'Redwood Digital', 'BrightPath Inc', 'Coral Ventures',
  'Meridian Data', 'Flint & Steel Co', 'Atlas Engineering',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _pick(arr) {
  return arr[_randInt(0, arr.length - 1)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate n random lorem ipsum words.
 * @param {number} n - number of words
 * @returns {string}
 */
function words(n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(_pick(LOREM_WORDS));
  }
  return result.join(' ');
}

/**
 * Generate n random sentences (8-15 words each).
 * @param {number} n - number of sentences
 * @returns {string}
 */
function sentences(n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    const count = _randInt(8, 15);
    const w = words(count);
    const sentence = w.charAt(0).toUpperCase() + w.slice(1) + '.';
    result.push(sentence);
  }
  return result.join(' ');
}

/**
 * Generate n paragraphs (3-6 sentences each), separated by double newlines.
 * @param {number} n - number of paragraphs
 * @returns {string}
 */
function paragraphs(n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    const count = _randInt(3, 6);
    result.push(sentences(count));
  }
  return result.join('\n\n');
}

/**
 * Generate a random full name.
 * @returns {string}
 */
function name() {
  return _pick(FIRST_NAMES) + ' ' + _pick(LAST_NAMES);
}

/**
 * Generate a random email address.
 * @returns {string}
 */
function email() {
  const first = _pick(FIRST_NAMES).toLowerCase();
  const last = _pick(LAST_NAMES).toLowerCase();
  const sep = _pick(['.', '_', '']);
  const num = _randInt(1, 999);
  const domain = _pick(DOMAINS);
  return first + sep + last + num + '@' + domain;
}

/**
 * Generate a random US phone number: (XXX) XXX-XXXX.
 * @returns {string}
 */
function phone() {
  const area = _randInt(200, 999);
  const pre = _randInt(200, 999);
  const line = _randInt(1000, 9999);
  return '(' + area + ') ' + pre + '-' + line;
}

/**
 * Generate a random US address.
 * @returns {string}
 */
function address() {
  const num = _randInt(1, 9999);
  const street = _pick(STREETS);
  const city = _pick(CITIES);
  const state = _pick(STATES);
  const zip = String(_randInt(10000, 99999));
  return num + ' ' + street + ', ' + city + ', ' + state + ' ' + zip;
}

/**
 * Generate a random company name.
 * @returns {string}
 */
function company() {
  return _pick(COMPANIES);
}

/**
 * Generate a random Date between `from` and `to`.
 * @param {string|Date} [from='2020-01-01'] - start date
 * @param {string|Date} [to] - end date (defaults to now)
 * @returns {Date}
 */
function date(from, to) {
  const start = from ? new Date(from).getTime() : new Date('2020-01-01').getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const ts = _randInt(start, end);
  return new Date(ts);
}

/**
 * Generate a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function number(min, max) {
  return _randInt(min ?? 0, max ?? 1000);
}

module.exports = {
  words,
  sentences,
  paragraphs,
  name,
  email,
  phone,
  address,
  company,
  date,
  number,
};

#!/usr/bin/env node
/**
 * Script to populate Zotero library with test data
 * Adds various types of real academic items for testing the zotero-roam extension
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envFile = readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    const env = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
    return env;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    process.exit(1);
  }
}

const env = loadEnv();
const ZOTERO_USER_ID = env.ZOTORO_USER;
const ZOTERO_API_KEY = env.ZOTORO_API_KEY;

if (!ZOTERO_USER_ID || !ZOTERO_API_KEY) {
  console.error('Missing ZOTORO_USER or ZOTORO_API_KEY in .env file');
  process.exit(1);
}

// Rate limiting configuration
// Zotero API limits: 120 requests/minute for authenticated users
const RATE_LIMIT_DELAY_MS = 1000; // 1 second between requests (well under the limit)

const zoteroClient = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': ZOTERO_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Add response interceptor to handle rate limiting
zoteroClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response) {
      const { status, headers } = error.response;

      // Handle rate limiting (429) or server errors (5xx)
      if (status === 429 || status >= 500) {
        const retryAfter = headers['retry-after'] || headers['backoff'] || 5;
        const delayMs = Number(retryAfter) * 1000;

        console.log(`⏸️  Rate limited or server error. Waiting ${retryAfter}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Retry the request
        return zoteroClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);

// Collection of diverse, real academic items
const testItems = [
  // Journal Article - Psychology
  {
    itemType: 'journalArticle',
    title: 'Attention Is All You Need',
    creators: [
      { creatorType: 'author', firstName: 'Ashish', lastName: 'Vaswani' },
      { creatorType: 'author', firstName: 'Noam', lastName: 'Shazeer' },
      { creatorType: 'author', firstName: 'Niki', lastName: 'Parmar' },
      { creatorType: 'author', firstName: 'Jakob', lastName: 'Uszkoreit' },
      { creatorType: 'author', firstName: 'Llion', lastName: 'Jones' }
    ],
    abstractNote: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    publicationTitle: 'Advances in Neural Information Processing Systems',
    date: '2017',
    pages: '5998-6008',
    url: 'https://arxiv.org/abs/1706.03762',
    DOI: '10.48550/arXiv.1706.03762',
    tags: [{ tag: 'machine learning' }, { tag: 'transformers' }, { tag: 'NLP' }]
  },

  // Journal Article - Medicine
  {
    itemType: 'journalArticle',
    title: 'CRISPR-Cas9 structures and mechanisms',
    creators: [
      { creatorType: 'author', firstName: 'Haiyan', lastName: 'Jiang' },
      { creatorType: 'author', firstName: 'Jennifer A.', lastName: 'Doudna' }
    ],
    abstractNote: 'The CRISPR-Cas9 system has transformed genome engineering, but a mechanistic understanding of how Cas9 locates and processes its DNA target remains elusive.',
    publicationTitle: 'Annual Review of Biophysics',
    volume: '46',
    issue: '1',
    date: '2017-05-22',
    pages: '505-529',
    DOI: '10.1146/annurev-biophys-062215-010822',
    ISSN: '1936-122X',
    tags: [{ tag: 'CRISPR' }, { tag: 'gene editing' }, { tag: 'biology' }]
  },

  // Book
  {
    itemType: 'book',
    title: 'Deep Learning',
    creators: [
      { creatorType: 'author', firstName: 'Ian', lastName: 'Goodfellow' },
      { creatorType: 'author', firstName: 'Yoshua', lastName: 'Bengio' },
      { creatorType: 'author', firstName: 'Aaron', lastName: 'Courville' }
    ],
    abstractNote: 'An introduction to a broad range of topics in deep learning, covering mathematical and conceptual background, deep learning techniques used in industry, and research perspectives.',
    publisher: 'MIT Press',
    place: 'Cambridge, MA',
    date: '2016',
    ISBN: '978-0-262-03561-3',
    url: 'https://www.deeplearningbook.org/',
    numPages: '800',
    tags: [{ tag: 'deep learning' }, { tag: 'textbook' }, { tag: 'AI' }]
  },

  // Conference Paper
  {
    itemType: 'conferencePaper',
    title: 'ImageNet Classification with Deep Convolutional Neural Networks',
    creators: [
      { creatorType: 'author', firstName: 'Alex', lastName: 'Krizhevsky' },
      { creatorType: 'author', firstName: 'Ilya', lastName: 'Sutskever' },
      { creatorType: 'author', firstName: 'Geoffrey E.', lastName: 'Hinton' }
    ],
    abstractNote: 'We trained a large, deep convolutional neural network to classify the 1.2 million high-resolution images in the ImageNet LSVRC-2010 contest into the 1000 different classes.',
    proceedingsTitle: 'Advances in Neural Information Processing Systems',
    date: '2012',
    pages: '1097-1105',
    url: 'https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks',
    tags: [{ tag: 'computer vision' }, { tag: 'CNN' }, { tag: 'AlexNet' }]
  },

  // Journal Article - Climate Science
  {
    itemType: 'journalArticle',
    title: 'The Physical Science Basis: Climate Change 2021',
    creators: [
      { creatorType: 'author', firstName: 'Valérie', lastName: 'Masson-Delmotte' },
      { creatorType: 'author', firstName: 'Panmao', lastName: 'Zhai' },
      { creatorType: 'author', firstName: 'Anna', lastName: 'Pirani' }
    ],
    abstractNote: 'The Working Group I contribution to the Sixth Assessment Report addresses the most up-to-date physical understanding of the climate system and climate change.',
    publicationTitle: 'IPCC Sixth Assessment Report',
    date: '2021',
    url: 'https://www.ipcc.ch/report/ar6/wg1/',
    tags: [{ tag: 'climate change' }, { tag: 'IPCC' }, { tag: 'environment' }]
  },

  // Book Chapter
  {
    itemType: 'bookSection',
    title: 'Reinforcement Learning: An Introduction',
    creators: [
      { creatorType: 'author', firstName: 'Richard S.', lastName: 'Sutton' },
      { creatorType: 'author', firstName: 'Andrew G.', lastName: 'Barto' }
    ],
    bookTitle: 'Reinforcement Learning: An Introduction',
    publisher: 'MIT Press',
    date: '2018',
    edition: '2nd',
    pages: '1-26',
    ISBN: '978-0-262-03924-6',
    tags: [{ tag: 'reinforcement learning' }, { tag: 'AI' }]
  },

  // Preprint
  {
    itemType: 'preprint',
    title: 'Language Models are Few-Shot Learners',
    creators: [
      { creatorType: 'author', firstName: 'Tom B.', lastName: 'Brown' },
      { creatorType: 'author', firstName: 'Benjamin', lastName: 'Mann' },
      { creatorType: 'author', firstName: 'Nick', lastName: 'Ryder' }
    ],
    abstractNote: 'We demonstrate that scaling up language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches.',
    repository: 'arXiv',
    archiveID: '2005.14165',
    date: '2020-05-28',
    url: 'https://arxiv.org/abs/2005.14165',
    tags: [{ tag: 'GPT-3' }, { tag: 'language models' }, { tag: 'few-shot learning' }]
  },

  // Report
  {
    itemType: 'report',
    title: 'Artificial Intelligence and Life in 2030',
    creators: [
      { creatorType: 'author', firstName: 'Peter', lastName: 'Stone' }
    ],
    abstractNote: 'One Hundred Year Study on Artificial Intelligence: Report of the 2015-2016 Study Panel',
    institution: 'Stanford University',
    reportType: 'Technical Report',
    date: '2016-09',
    url: 'https://ai100.stanford.edu/2016-report',
    tags: [{ tag: 'AI policy' }, { tag: 'future of AI' }]
  },

  // Thesis
  {
    itemType: 'thesis',
    title: 'Generative Adversarial Networks',
    creators: [
      { creatorType: 'author', firstName: 'Ian', lastName: 'Goodfellow' }
    ],
    abstractNote: 'A framework for estimating generative models via an adversarial process.',
    thesisType: 'Ph.D. Thesis',
    university: 'Université de Montréal',
    date: '2014',
    tags: [{ tag: 'GANs' }, { tag: 'generative models' }]
  },

  // Journal Article - Economics
  {
    itemType: 'journalArticle',
    title: 'The Economics of Artificial Intelligence: An Agenda',
    creators: [
      { creatorType: 'author', firstName: 'Ajay', lastName: 'Agrawal' },
      { creatorType: 'author', firstName: 'Joshua', lastName: 'Gans' },
      { creatorType: 'author', firstName: 'Avi', lastName: 'Goldfarb' }
    ],
    publicationTitle: 'National Bureau of Economic Research',
    date: '2019',
    url: 'https://www.nber.org/books-and-chapters/economics-artificial-intelligence-agenda',
    tags: [{ tag: 'economics' }, { tag: 'AI policy' }]
  },

  // Webpage
  {
    itemType: 'webpage',
    title: 'The Illustrated Transformer',
    creators: [
      { creatorType: 'author', firstName: 'Jay', lastName: 'Alammar' }
    ],
    abstractNote: 'A visual and intuitive explanation of how the Transformer model works.',
    websiteTitle: 'Jay Alammar Blog',
    date: '2018-06-27',
    url: 'https://jalammar.github.io/illustrated-transformer/',
    accessDate: '2024-01-15',
    tags: [{ tag: 'tutorial' }, { tag: 'transformers' }, { tag: 'visualization' }]
  },

  // Journal Article - Neuroscience
  {
    itemType: 'journalArticle',
    title: 'Playing Atari with Deep Reinforcement Learning',
    creators: [
      { creatorType: 'author', firstName: 'Volodymyr', lastName: 'Mnih' },
      { creatorType: 'author', firstName: 'Koray', lastName: 'Kavukcuoglu' },
      { creatorType: 'author', firstName: 'David', lastName: 'Silver' }
    ],
    abstractNote: 'We present the first deep learning model to successfully learn control policies directly from high-dimensional sensory input using reinforcement learning.',
    publicationTitle: 'arXiv preprint',
    date: '2013',
    archiveID: '1312.5602',
    url: 'https://arxiv.org/abs/1312.5602',
    tags: [{ tag: 'DQN' }, { tag: 'reinforcement learning' }, { tag: 'Atari' }]
  },

  // Book - Philosophy
  {
    itemType: 'book',
    title: 'Superintelligence: Paths, Dangers, Strategies',
    creators: [
      { creatorType: 'author', firstName: 'Nick', lastName: 'Bostrom' }
    ],
    abstractNote: 'Superintelligence asks the questions: What happens when machines surpass humans in general intelligence? Will artificial agents save or destroy us?',
    publisher: 'Oxford University Press',
    place: 'Oxford',
    date: '2014',
    ISBN: '978-0-19-873983-8',
    tags: [{ tag: 'AI safety' }, { tag: 'philosophy' }, { tag: 'existential risk' }]
  },

  // Journal Article - Social Science
  {
    itemType: 'journalArticle',
    title: 'The Social Dilemma of Autonomous Vehicles',
    creators: [
      { creatorType: 'author', firstName: 'Jean-François', lastName: 'Bonnefon' },
      { creatorType: 'author', firstName: 'Azim', lastName: 'Shariff' },
      { creatorType: 'author', firstName: 'Iyad', lastName: 'Rahwan' }
    ],
    abstractNote: 'Autonomous vehicles might reduce traffic accidents, but they will sometimes have to choose between the lives of their passengers and the lives of others.',
    publicationTitle: 'Science',
    volume: '352',
    issue: '6293',
    date: '2016-06-24',
    pages: '1573-1576',
    DOI: '10.1126/science.aaf2654',
    tags: [{ tag: 'autonomous vehicles' }, { tag: 'ethics' }, { tag: 'AI ethics' }]
  },

  // Patent
  {
    itemType: 'patent',
    title: 'Neural Network for Speaker Recognition',
    creators: [
      { creatorType: 'inventor', firstName: 'Geoffrey', lastName: 'Hinton' }
    ],
    patentNumber: 'US8775341B1',
    issueDate: '2014-07-08',
    country: 'United States',
    tags: [{ tag: 'patent' }, { tag: 'neural networks' }]
  }
];

async function addItemsToZotero() {
  console.log(`🚀 Starting Zotero population script...`);
  console.log(`📚 Will add ${testItems.length} items to library\n`);

  try {
    // Add items in batches of 50 (Zotero API limit)
    const batchSize = 50;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < testItems.length; i += batchSize) {
      const batch = testItems.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(testItems.length / batchSize)}...`);

      try {
        const response = await zoteroClient.post(
          `users/${ZOTERO_USER_ID}/items`,
          batch
        );

        const { success = {}, failed = {}, unchanged = {} } = response.data;
        const successKeys = Object.keys(success);
        const failedKeys = Object.keys(failed);

        successCount += successKeys.length;
        failCount += failedKeys.length;

        console.log(`  ✅ Successfully added: ${successKeys.length} items`);
        if (failedKeys.length > 0) {
          console.log(`  ❌ Failed: ${failedKeys.length} items`);
        }
        if (Object.keys(unchanged).length > 0) {
          console.log(`  ⚠️  Unchanged: ${Object.keys(unchanged).length} items`);
        }

        // Show titles of added items
        for (const idx of successKeys) {
          const item = batch[idx];
          console.log(`     • ${item.title}`);
        }

      } catch (error) {
        console.error(`❌ Error adding batch:`, error.response?.data || error.message);
        failCount += batch.length;
      }

      // Rate limiting: wait between batches to respect API limits
      if (i + batchSize < testItems.length) {
        console.log(`⏳ Waiting ${RATE_LIMIT_DELAY_MS}ms to respect rate limits...\n`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    console.log(`\n✨ Done!`);
    console.log(`📊 Summary:`);
    console.log(`   • Total items attempted: ${testItems.length}`);
    console.log(`   • Successfully added: ${successCount}`);
    console.log(`   • Failed: ${failCount}`);
    console.log(`\n🔗 View your library at: https://www.zotero.org/`);

  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the script
addItemsToZotero();

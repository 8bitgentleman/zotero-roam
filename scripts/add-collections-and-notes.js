#!/usr/bin/env node
/**
 * Script to add collections and notes to Zotero library
 * Run after populate-zotero.js to add organizational structure and notes
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

const RATE_LIMIT_DELAY_MS = 1000;

const zoteroClient = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': ZOTERO_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Rate limiting interceptor
zoteroClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response) {
      const { status, headers } = error.response;
      if (status === 429 || status >= 500) {
        const retryAfter = headers['retry-after'] || headers['backoff'] || 5;
        const delayMs = Number(retryAfter) * 1000;
        console.log(`⏸️  Rate limited. Waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return zoteroClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);

// Collections to create
const collections = [
  {
    name: 'Machine Learning & AI',
    parentCollection: false
  },
  {
    name: 'Biology & Medicine',
    parentCollection: false
  },
  {
    name: 'Climate & Environment',
    parentCollection: false
  },
  {
    name: 'Ethics & Philosophy',
    parentCollection: false
  },
  {
    name: 'To Read',
    parentCollection: false
  }
];

async function createCollections() {
  console.log('📁 Creating collections...\n');

  try {
    const response = await zoteroClient.post(
      `users/${ZOTERO_USER_ID}/collections`,
      collections
    );

    const { success = {}, successful = {} } = response.data;
    const successKeys = Object.keys(success);

    console.log(`✅ Created ${successKeys.length} collections:`);

    // Map collection names to their keys for organizing items later
    const collectionMap = {};
    for (const idx of successKeys) {
      const collectionKey = success[idx];
      const collection = successful[idx];
      collectionMap[collection.data.name] = collectionKey;
      console.log(`   • ${collection.data.name} (${collectionKey})`);
    }

    return collectionMap;
  } catch (error) {
    console.error('❌ Error creating collections:', error.response?.data || error.message);
    return {};
  }
}

async function getItems() {
  console.log('\n📚 Fetching existing items...\n');

  try {
    const response = await zoteroClient.get(
      `users/${ZOTERO_USER_ID}/items/top`,
      {
        params: {
          limit: 100
        }
      }
    );

    const items = response.data;
    console.log(`✅ Found ${items.length} items\n`);

    return items;
  } catch (error) {
    console.error('❌ Error fetching items:', error.response?.data || error.message);
    return [];
  }
}

async function organizeItemsIntoCollections(items, collectionMap) {
  console.log('🗂️  Organizing items into collections...\n');

  // Define which items should go into which collections
  const itemCollectionMapping = {
    'Machine Learning & AI': [
      'Attention Is All You Need',
      'Deep Learning',
      'ImageNet Classification',
      'Language Models are Few-Shot Learners',
      'Reinforcement Learning',
      'Generative Adversarial Networks',
      'Playing Atari'
    ],
    'Biology & Medicine': [
      'CRISPR-Cas9'
    ],
    'Climate & Environment': [
      'Climate Change 2021',
      'Physical Science Basis'
    ],
    'Ethics & Philosophy': [
      'Superintelligence',
      'Social Dilemma of Autonomous Vehicles'
    ]
  };

  const updates = [];

  for (const item of items) {
    const itemTitle = item.data.title;

    for (const [collectionName, titlePatterns] of Object.entries(itemCollectionMapping)) {
      const collectionKey = collectionMap[collectionName];
      if (!collectionKey) continue;

      // Check if item title matches any pattern
      const matches = titlePatterns.some(pattern =>
        itemTitle.toLowerCase().includes(pattern.toLowerCase())
      );

      if (matches) {
        // Add collection to item's collections array
        const currentCollections = item.data.collections || [];
        if (!currentCollections.includes(collectionKey)) {
          updates.push({
            key: item.key,
            version: item.version,
            collections: [...currentCollections, collectionKey]
          });
        }
      }
    }
  }

  if (updates.length === 0) {
    console.log('⚠️  No items to organize');
    return;
  }

  try {
    const response = await zoteroClient.post(
      `users/${ZOTERO_USER_ID}/items`,
      updates
    );

    const { success = {} } = response.data;
    console.log(`✅ Organized ${Object.keys(success).length} items into collections\n`);
  } catch (error) {
    console.error('❌ Error organizing items:', error.response?.data || error.message);
  }
}

async function addNotesToItems(items) {
  console.log('📝 Adding notes to items...\n');

  // Select a few items to add notes to
  const notesToAdd = [];

  for (const item of items.slice(0, 5)) {
    // Create 1-2 notes per item
    const numNotes = Math.random() > 0.5 ? 2 : 1;

    for (let i = 0; i < numNotes; i++) {
      const noteTexts = [
        `<p><strong>Key Insight:</strong> This paper introduces fundamental concepts that have shaped the field. The methodology is particularly noteworthy for its rigor and reproducibility.</p>`,
        `<p><strong>TODO:</strong> Read the methodology section more carefully. Pay attention to the experimental setup and control variables.</p><p><em>Related:</em> Compare with Smith et al. (2020)</p>`,
        `<p><strong>Critical Analysis:</strong> While the results are impressive, there are some limitations in the sample size that should be considered when interpreting the findings.</p>`,
        `<div style="background-color: #ffffcc; padding: 10px;"><strong>Important Quote:</strong> "${item.data.title}" - This finding challenges conventional wisdom in the field.</div>`,
        `<p><strong>Summary:</strong> Main contributions include:</p><ul><li>Novel approach to problem formulation</li><li>Empirical validation on multiple datasets</li><li>Theoretical framework that unifies previous work</li></ul>`,
        `<p><strong>Questions for further research:</strong></p><ol><li>How does this scale to larger datasets?</li><li>What are the computational requirements?</li><li>Can this be applied to other domains?</li></ol>`,
        `<p><strong>Connection to my research:</strong> This directly relates to my work on optimization methods. The approach here could be adapted for use in reinforcement learning scenarios.</p>`,
        `<p>📌 <em>Read this again before the seminar next week!</em></p><p>Main takeaway: The trade-off between computational efficiency and model accuracy is a central theme.</p>`
      ];

      const randomNote = noteTexts[Math.floor(Math.random() * noteTexts.length)];

      notesToAdd.push({
        itemType: 'note',
        parentItem: item.key,
        note: randomNote,
        tags: i === 0 ? [{ tag: 'Important' }] : [{ tag: 'Review' }]
      });
    }
  }

  if (notesToAdd.length === 0) {
    console.log('⚠️  No notes to add');
    return;
  }

  try {
    const response = await zoteroClient.post(
      `users/${ZOTERO_USER_ID}/items`,
      notesToAdd
    );

    const { success = {} } = response.data;
    console.log(`✅ Added ${Object.keys(success).length} notes to items\n`);
  } catch (error) {
    console.error('❌ Error adding notes:', error.response?.data || error.message);
  }
}

async function addStandaloneNotes() {
  console.log('📄 Adding standalone notes...\n');

  const standaloneNotes = [
    {
      itemType: 'note',
      note: '<h2>Research Ideas</h2><p>Potential directions for future work:</p><ul><li>Combine transformer architectures with reinforcement learning</li><li>Explore applications in healthcare</li><li>Investigate ethical implications of AI systems</li></ul>',
      tags: [{ tag: 'Ideas' }, { tag: 'Future Work' }]
    },
    {
      itemType: 'note',
      note: '<h2>Meeting Notes - Lab Discussion 2024-01-15</h2><p>Discussed recent papers on deep learning. Team consensus is to focus on interpretability methods next quarter.</p><p><strong>Action items:</strong></p><ol><li>Review SHAP and LIME papers</li><li>Set up experiment tracking</li><li>Schedule follow-up meeting</li></ol>',
      tags: [{ tag: 'Meeting Notes' }]
    }
  ];

  try {
    const response = await zoteroClient.post(
      `users/${ZOTERO_USER_ID}/items`,
      standaloneNotes
    );

    const { success = {} } = response.data;
    console.log(`✅ Added ${Object.keys(success).length} standalone notes\n`);
  } catch (error) {
    console.error('❌ Error adding standalone notes:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 Enhancing Zotero library with collections and notes...\n');

  // Step 1: Create collections
  const collectionMap = await createCollections();
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  // Step 2: Fetch existing items
  const items = await getItems();
  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  // Step 3: Organize items into collections
  if (Object.keys(collectionMap).length > 0 && items.length > 0) {
    await organizeItemsIntoCollections(items, collectionMap);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }

  // Step 4: Add notes to items
  if (items.length > 0) {
    await addNotesToItems(items);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }

  // Step 5: Add standalone notes
  await addStandaloneNotes();

  console.log('✨ Done! Your library now has:');
  console.log('   • Collections for organizing items');
  console.log('   • Notes attached to items');
  console.log('   • Standalone research notes');
  console.log('\n🔗 View at: https://www.zotero.org/');
}

main();

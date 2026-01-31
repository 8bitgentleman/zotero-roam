#!/usr/bin/env node
/**
 * Script to check if Zotero items have Better BibTeX citekeys
 * Verifies that items have "Citation Key: XXX" in their Extra field
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

const zoteroClient = axios.create({
  baseURL: `https://api.zotero.org/users/${ZOTERO_USER_ID}`,
  headers: {
    'Authorization': `Bearer ${ZOTERO_API_KEY}`,
    'Zotero-API-Version': '3'
  }
});

async function checkCitekeys() {
  console.log('Checking Zotero items for Better BibTeX citekeys...\n');

  try {
    // Fetch items from Zotero
    const response = await zoteroClient.get('/items', {
      params: {
        limit: 20,
        itemType: '-attachment || note' // Only get top-level items
      }
    });

    const items = response.data;
    console.log(`Found ${items.length} items in library\n`);

    let itemsWithCitekeys = 0;
    let itemsWithoutCitekeys = 0;

    console.log('Item Analysis:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    items.forEach((item, index) => {
      const title = item.data.title || '(No title)';
      const extra = item.data.extra || '';
      const hasCitekey = extra.includes('Citation Key:');

      let citekey = null;
      if (hasCitekey) {
        const match = extra.match(/Citation Key:\s*(\S+)/);
        citekey = match ? match[1] : '(found but could not parse)';
        itemsWithCitekeys++;
      } else {
        itemsWithoutCitekeys++;
      }

      console.log(`${index + 1}. ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);
      console.log(`   Key: ${item.key}`);
      console.log(`   Citekey: ${citekey ? `✓ ${citekey}` : '✗ MISSING'}`);
      if (!hasCitekey && extra) {
        console.log(`   Extra field: ${extra.substring(0, 50)}${extra.length > 50 ? '...' : ''}`);
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\nSummary:');
    console.log(`  Items with citekeys:    ${itemsWithCitekeys} ✓`);
    console.log(`  Items without citekeys: ${itemsWithoutCitekeys} ${itemsWithoutCitekeys > 0 ? '✗' : ''}`);

    if (itemsWithoutCitekeys > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   Some items are missing citekeys. In Zotero:');
      console.log('   1. Select all items (Cmd/Ctrl+A)');
      console.log('   2. Right-click → "Better BibTeX" → "Pin BibTeX key"');
      console.log('   3. Wait for processing to complete');
      console.log('   4. Re-run this script to verify');
    } else {
      console.log('\n✓ All items have citekeys! The page menus should work now.');
      console.log('  Rebuild the extension and test: npm run build:roam');
    }

  } catch (error) {
    console.error('Error checking items:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

checkCitekeys();

#!/usr/bin/env node
/**
 * Add annotations (highlights and comments) to PDFs in Zotero
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
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
}

const env = loadEnv();
const ZOTERO_USER_ID = env.ZOTORO_USER;
const ZOTERO_API_KEY = env.ZOTORO_API_KEY;
const RATE_LIMIT_DELAY_MS = 1000;

const zoteroClient = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: {
    'Zotero-API-Version': '3',
    'Zotero-API-Key': ZOTERO_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Annotation colors from Zotero
const colors = {
  red: '#ff6666',
  yellow: '#ffd400',
  green: '#5fb236',
  blue: '#2ea8e5',
  purple: '#a28ae5',
  magenta: '#ff6ab3',
  orange: '#ff8c19',
  gray: '#aaaaaa'
};

async function getPDFs() {
  const response = await zoteroClient.get(
    `users/${ZOTERO_USER_ID}/items`,
    { params: { limit: 100 } }
  );

  const items = response.data;
  return items.filter(item =>
    item.data.itemType === 'attachment' &&
    item.data.contentType === 'application/pdf'
  );
}

async function addAnnotationsToPDF(pdfKey) {
  console.log(`\n📝 Adding annotations to PDF (${pdfKey})...\n`);

  // Sample annotations with different types
  const annotations = [
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'This study demonstrates that ceiling height can influence the type of cognitive processing people engage in.',
      annotationComment: 'Key finding - relates to embodied cognition theory',
      annotationColor: colors.yellow,
      annotationPageLabel: '1',
      annotationSortIndex: '00001|001234|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'Important' }, { tag: 'Key Finding' }]
    },
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'Higher ceilings prime concepts related to freedom and abstraction, whereas lower ceilings prime confinement and concrete processing.',
      annotationComment: 'This is the core mechanism - very interesting! Compare with Meyers-Levy & Zhu (2007)',
      annotationColor: colors.green,
      annotationPageLabel: '2',
      annotationSortIndex: '00002|002345|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'TODO' }]
    },
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'Participants in high-ceiling conditions showed greater preference for abstract thinking tasks.',
      annotationComment: '',
      annotationColor: colors.blue,
      annotationPageLabel: '3',
      annotationSortIndex: '00003|003456|00000',
      parentItem: pdfKey,
      tags: []
    },
    {
      itemType: 'annotation',
      annotationType: 'note',
      annotationComment: 'Question: How does this interact with individual differences in working memory capacity? Would be interesting to test.',
      annotationColor: colors.red,
      annotationPageLabel: '4',
      annotationSortIndex: '00004|004567|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'Research Question' }]
    },
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'The effect was consistent across multiple experimental paradigms.',
      annotationComment: 'Good methodological rigor - multiple studies strengthen the findings',
      annotationColor: colors.yellow,
      annotationPageLabel: '5',
      annotationSortIndex: '00005|005678|00000',
      parentItem: pdfKey,
      tags: []
    },
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'Implications for workspace design and creativity.',
      annotationComment: 'Practical applications! This could be useful for designing our new lab space.',
      annotationColor: colors.purple,
      annotationPageLabel: '8',
      annotationSortIndex: '00008|008901|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'Application' }]
    },
    {
      itemType: 'annotation',
      annotationType: 'note',
      annotationComment: 'Limitations: Sample was mostly university students. Need to replicate with more diverse population. Also, effect sizes were modest.',
      annotationColor: colors.orange,
      annotationPageLabel: '9',
      annotationSortIndex: '00009|009012|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'Critical Analysis' }]
    },
    {
      itemType: 'annotation',
      annotationType: 'highlight',
      annotationText: 'Future research should examine whether the effect persists over time or if there is habituation.',
      annotationComment: 'Good point for future work',
      annotationColor: colors.green,
      annotationPageLabel: '10',
      annotationSortIndex: '00010|010123|00000',
      parentItem: pdfKey,
      tags: [{ tag: 'Future Work' }]
    }
  ];

  try {
    const response = await zoteroClient.post(
      `users/${ZOTERO_USER_ID}/items`,
      annotations
    );

    const { success = {}, successful = {} } = response.data;
    const successCount = Object.keys(success).length;

    console.log(`✅ Added ${successCount} annotations:`);

    for (const idx of Object.keys(success)) {
      const annot = successful[idx];
      const type = annot.data.annotationType;
      const text = annot.data.annotationText
        ? `"${annot.data.annotationText.substring(0, 50)}..."`
        : annot.data.annotationComment.substring(0, 50) + '...';

      console.log(`   • [${type}] ${text}`);
    }

    console.log(`\n💡 Types of annotations added:`);
    console.log(`   • Highlights with comments (yellow/green/blue)`);
    console.log(`   • Standalone note annotations (red/orange)`);
    console.log(`   • Tagged annotations for organization`);

  } catch (error) {
    console.error('❌ Error adding annotations:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 Adding annotations to PDFs...');

  try {
    const pdfs = await getPDFs();

    if (pdfs.length === 0) {
      console.log('\n⚠️  No PDFs found. Upload PDFs through Zotero desktop/web first.');
      return;
    }

    console.log(`\n📄 Found ${pdfs.length} PDF(s):`);
    for (const pdf of pdfs) {
      console.log(`   • ${pdf.data.title || pdf.data.filename}`);
    }

    // Add annotations to each PDF
    for (const pdf of pdfs) {
      await addAnnotationsToPDF(pdf.key);

      // Rate limiting
      if (pdfs.indexOf(pdf) < pdfs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    console.log('\n✨ Done! Your PDF now has:');
    console.log('   • Highlighted passages');
    console.log('   • Comments and insights');
    console.log('   • Research questions and critical analysis');
    console.log('   • Tagged annotations for filtering');
    console.log('\n🔗 View at: https://www.zotero.org/');

  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Test script to validate Wikipedia and Wikidata modules
 * for artist/track information extraction
 * 
 * Usage: node scripts/test-wikidata-search.js
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(color, label, message) {
  console.log(`${colors[color]}${label}${colors.reset} ${message}`);
}

function section(title) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

async function testWikipediaSearch() {
  section('Testing wtf_wikipedia Module');

  try {
    // Dynamically check if wtf_wikipedia is installed
    let wtf;
    try {
      wtf = require('wtf_wikipedia');
    } catch (e) {
      log('yellow', '[SKIP]', 'wtf_wikipedia not installed. Run: npm install wtf_wikipedia');
      return { available: false };
    }

    const results = {
      available: true,
      searches: {}
    };

    // Test 1: Search for "Bohemian Rhapsody"
    log('cyan', '[TEST 1]', 'Searching Wikipedia for "Bohemian Rhapsody"...');
    try {
      const song = await wtf.fetch('Bohemian Rhapsody');
      results.searches['Bohemian Rhapsody'] = {
        success: true,
        data: {
          title: song.title(),
          categories: song.categories().slice(0, 5),
          infobox: song.infobox(),
          sections: song.sections().map(s => s.title()).slice(0, 8),
          rawText: song.text().substring(0, 300)
        }
      };
      log('green', '✓', 'Successfully retrieved Bohemian Rhapsody data');
      console.log('   Title:', song.title());
      console.log('   Categories:', song.categories().slice(0, 3).join(', '));
      if (song.infobox()) {
        console.log('   Infobox available:', true);
        const infoboxData = song.infobox();
        if (infoboxData) {
          Object.entries(infoboxData).slice(0, 5).forEach(([key, val]) => {
            console.log(`     - ${key}: ${String(val).substring(0, 50)}`);
          });
        }
      }
    } catch (err) {
      results.searches['Bohemian Rhapsody'] = {
        success: false,
        error: err.message
      };
      log('red', '✗', `Error: ${err.message}`);
    }

    // Test 2: Search for "Queen band"
    log('cyan', '[TEST 2]', 'Searching Wikipedia for "Queen (band)"...');
    try {
      const artist = await wtf.fetch('Queen (band)');
      results.searches['Queen (band)'] = {
        success: true,
        data: {
          title: artist.title(),
          categories: artist.categories().slice(0, 5),
          infobox: artist.infobox(),
          sections: artist.sections().map(s => s.title()).slice(0, 8),
          members: artist.sections().find(s => s.title().toLowerCase().includes('member'))
        }
      };
      log('green', '✓', 'Successfully retrieved Queen band data');
      console.log('   Title:', artist.title());
      console.log('   Categories:', artist.categories().slice(0, 3).join(', '));
      if (artist.infobox()) {
        console.log('   Infobox available:', true);
        const infoboxData = artist.infobox();
        if (infoboxData) {
          Object.entries(infoboxData).slice(0, 5).forEach(([key, val]) => {
            console.log(`     - ${key}: ${String(val).substring(0, 60)}`);
          });
        }
      }
    } catch (err) {
      results.searches['Queen (band)'] = {
        success: false,
        error: err.message
      };
      log('red', '✗', `Error: ${err.message}`);
    }

    return results;
  } catch (err) {
    log('red', '[ERROR]', `wtf_wikipedia test failed: ${err.message}`);
    return { available: false, error: err.message };
  }
}

async function testWikidataSearch() {
  section('Testing Wikidata API (Direct HTTP Calls)');

  const results = {
    available: true,
    searches: {}
  };

  // Test 1: Search for "Bohemian Rhapsody" on Wikidata
  log('cyan', '[TEST 1]', 'Searching Wikidata for "Bohemian Rhapsody"...');
  try {
    const searchUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Bohemian%20Rhapsody&format=json&language=en';
    const response = await fetch(searchUrl);
    const data = await response.json();
    results.searches['Bohemian Rhapsody'] = {
      success: true,
      resultCount: data.search ? data.search.length : 0,
      data: data
    };
    log('green', '✓', `Found ${data.search ? data.search.length : 0} results`);
    if (data.search) {
      data.search.slice(0, 3).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.label} (${item.id})`);
        if (item.description) console.log(`      → ${item.description}`);
      });

      // If we found results, get detailed data for the first one
      if (data.search.length > 0) {
        const firstQid = data.search[0].id;
        log('cyan', '[TEST 1b]', `Getting detailed properties for "${data.search[0].label}"...`);
        try {
          const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${firstQid}.json`;
          const entityResponse = await fetch(entityUrl);
          const entityData = await entityResponse.json();
          const entity = entityData.entities[firstQid];
          if (entity && entity.claims) {
            const propKeys = Object.keys(entity.claims).slice(0, 8);
            console.log(`   Available properties (${Object.keys(entity.claims).length} total): ${propKeys.join(', ')}`);
            results.searches['Bohemian Rhapsody'].detailedData = {
              qid: firstQid,
              propertyCount: Object.keys(entity.claims).length,
              properties: propKeys
            };
          }
        } catch (err) {
          console.log(`   Could not fetch detailed data: ${err.message}`);
        }
      }
    }
  } catch (err) {
    results.searches['Bohemian Rhapsody'] = {
      success: false,
      error: err.message
    };
    log('red', '✗', `Error: ${err.message}`);
  }

  // Test 2: Search for "Queen" band on Wikidata
  log('cyan', '[TEST 2]', 'Searching Wikidata for "Queen" band...');
  try {
    const searchUrl = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Queen%20band&format=json&language=en';
    const response = await fetch(searchUrl);
    const data = await response.json();
    results.searches['Queen band'] = {
      success: true,
      resultCount: data.search ? data.search.length : 0,
      data: data
    };
    log('green', '✓', `Found ${data.search ? data.search.length : 0} results`);
    if (data.search) {
      data.search.slice(0, 3).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.label} (${item.id})`);
        if (item.description) console.log(`      → ${item.description}`);
      });

      // If we found results, get detailed data for the first one
      if (data.search.length > 0) {
        const firstQid = data.search[0].id;
        log('cyan', '[TEST 2b]', `Getting detailed properties for "${data.search[0].label}"...`);
        try {
          const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${firstQid}.json`;
          const entityResponse = await fetch(entityUrl);
          const entityData = await entityResponse.json();
          const entity = entityData.entities[firstQid];
          if (entity && entity.claims) {
            const propKeys = Object.keys(entity.claims).slice(0, 8);
            console.log(`   Available properties (${Object.keys(entity.claims).length} total): ${propKeys.join(', ')}`);
            
            // Try to extract specific music-related properties
            const hasInception = entity.claims.P571 ? '✓ Inception date (P571)' : '';
            const hasCountry = entity.claims.P17 ? '✓ Country (P17)' : '';
            const hasMembers = entity.claims.P527 ? '✓ Members (P527)' : '';
            const hasGenre = entity.claims.P136 ? '✓ Genre (P136)' : '';
            const hasMusic = entity.claims.P131 ? '✓ Location (P131)' : '';
            
            const musicProps = [hasInception, hasCountry, hasMembers, hasGenre, hasMusic].filter(p => p);
            if (musicProps.length > 0) {
              console.log(`   Music-related properties:\n     ${musicProps.join('\n     ')}`);
            }
            results.searches['Queen band'].detailedData = {
              qid: firstQid,
              propertyCount: Object.keys(entity.claims).length,
              properties: propKeys,
              musicProperties: musicProps
            };
          }
        } catch (err) {
          console.log(`   Could not fetch detailed data: ${err.message}`);
        }
      }
    }
  } catch (err) {
    results.searches['Queen band'] = {
      success: false,
      error: err.message
    };
    log('red', '✗', `Error: ${err.message}`);
  }

  return results;
}

async function testMusicBrainzSearch() {
  section('Testing MusicBrainz API (Direct HTTP Calls)');

  const results = {
    available: true,
    searches: {}
  };

  // Test 1: Search for "Bohemian Rhapsody"
  log('cyan', '[TEST 1]', 'Searching MusicBrainz for recording "Bohemian Rhapsody"...');
  try {
    const searchUrl = 'https://musicbrainz.org/ws/2/recording?query=Bohemian%20Rhapsody&fmt=json&limit=5';
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'mrRoboto/1.4.1 (contact@example.com)' }
    });
    const data = await response.json();
    results.searches['Bohemian Rhapsody'] = {
      success: true,
      count: data['recording-count'] || 0,
      data: data.recordings?.slice(0, 3) || []
    };
    log('green', '✓', `Found ${data['recording-count'] || 0} total results, showing first 3`);
    data.recordings?.slice(0, 3).forEach((recording, idx) => {
      console.log(`   ${idx + 1}. ${recording.title}`);
      if (recording['artist-credit'] && recording['artist-credit'][0]) {
        console.log(`      → Artist: ${recording['artist-credit'][0].artist.name}`);
      }
      if (recording['first-release-date']) {
        console.log(`      → First release: ${recording['first-release-date']}`);
      }
    });
  } catch (err) {
    results.searches['Bohemian Rhapsody'] = {
      success: false,
      error: err.message
    };
    log('red', '✗', `Error: ${err.message}`);
  }

  // Test 2: Search for "Queen" artist
  log('cyan', '[TEST 2]', 'Searching MusicBrainz for artist "Queen"...');
  try {
    const searchUrl = 'https://musicbrainz.org/ws/2/artist?query=Queen&fmt=json&limit=5';
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'mrRoboto/1.4.1 (contact@example.com)' }
    });
    const data = await response.json();
    results.searches['Queen artist'] = {
      success: true,
      count: data['artist-count'] || 0,
      data: data.artists?.slice(0, 3) || []
    };
    log('green', '✓', `Found ${data['artist-count'] || 0} total results, showing first 3`);
    data.artists?.slice(0, 3).forEach((artist, idx) => {
      console.log(`   ${idx + 1}. ${artist.name}`);
      if (artist['sort-name']) console.log(`      → Sort name: ${artist['sort-name']}`);
      if (artist['life-span']) {
        const lifespan = artist['life-span'];
        console.log(`      → Active: ${lifespan.begin}${lifespan.end ? ' to ' + lifespan.end : ''}`);
      }
      if (artist.country) console.log(`      → Country: ${artist.country}`);
    });
  } catch (err) {
    results.searches['Queen artist'] = {
      success: false,
      error: err.message
    };
    log('red', '✗', `Error: ${err.message}`);
  }

  return results;
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}Mr. Roboto V3 - Wikidata Search Test Script${colors.reset}`);
  console.log(`${colors.cyan}Testing Wikipedia, Wikidata, and MusicBrainz data quality${colors.reset}\n`);

  const allResults = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  allResults.tests.wikipedia = await testWikipediaSearch();
  allResults.tests.wikidata = await testWikidataSearch();
  allResults.tests.musicbrainz = await testMusicBrainzSearch();

  // Summary
  section('Summary');
  const available = [];
  const unavailable = [];

  if (allResults.tests.wikipedia.available) available.push('wtf_wikipedia');
  else unavailable.push('wtf_wikipedia');

  if (allResults.tests.wikidata.available) available.push('Wikidata API');
  else unavailable.push('Wikidata API');

  if (allResults.tests.musicbrainz.available) available.push('MusicBrainz API');
  else unavailable.push('MusicBrainz API');

  if (available.length > 0) {
    log('green', '✓ Data sources:', available.join(', '));
  }
  if (unavailable.length > 0) {
    log('red', '✗ Failed:', unavailable.join(', '));
  }

  console.log(`\n${colors.cyan}Analysis:${colors.reset}`);
  if (allResults.tests.wikipedia.available) {
    console.log(`  • ${colors.green}✓${colors.reset} wtf_wikipedia provides CLEAN structured Wikipedia data`);
    console.log(`    → Great for artist backgrounds, history, and biographical info`);
  }
  if (allResults.tests.wikidata.available) {
    console.log(`  • ${colors.green}✓${colors.reset} Wikidata provides machine-readable semantic data`);
    console.log(`    → Best for structured fields (dates, countries, relationships)`);
  }
  if (allResults.tests.musicbrainz.available) {
    console.log(`  • ${colors.green}✓${colors.reset} MusicBrainz provides music-specific metadata`);
    console.log(`    → Excellent for track release dates and artist info`);
  }

  console.log(`\n${colors.cyan}Full test results saved to: scripts/test-wikidata-results.json${colors.reset}`);
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'test-wikidata-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));

  console.log(`${colors.green}✓ Test complete!${colors.reset}\n`);
}

main().catch(err => {
  log('red', '[FATAL]', err.message);
  process.exit(1);
});

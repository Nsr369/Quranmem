/**
 * Fetches Malayalam translations for Juz 30 surahs (78–114) from al-quran.cloud
 * and injects them into js/data/juz30.js
 *
 * Usage: node scripts/inject_ml_translations.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EDITION = 'ml.abdulhameed';
const JUZ30_SURAHS = Array.from({ length: 37 }, (_, i) => 78 + i); // 78 to 114
const DATA_FILE = path.join(__dirname, '..', 'js', 'data', 'juz30.js');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error: ' + e.message + '\nRaw: ' + data.substring(0, 200))); }
            });
        }).on('error', reject);
    });
}

async function fetchMlTranslations() {
    // Map: surahId -> { ayahNumber -> mlText }
    const mlMap = {};

    for (const surahId of JUZ30_SURAHS) {
        const url = `https://api.alquran.cloud/v1/surah/${surahId}/${EDITION}`;
        console.log(`Fetching Surah ${surahId}...`);
        try {
            const resp = await fetchJson(url);
            if (resp.code !== 200) {
                console.warn(`  ⚠️  Surah ${surahId}: API returned code ${resp.code}`);
                continue;
            }
            mlMap[surahId] = {};
            for (const ayah of resp.data.ayahs) {
                mlMap[surahId][ayah.numberInSurah] = ayah.text;
            }
            console.log(`  ✅  Surah ${surahId}: ${resp.data.ayahs.length} ayahs`);
        } catch (e) {
            console.error(`  ❌  Surah ${surahId} error:`, e.message);
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 120));
    }
    return mlMap;
}

async function main() {
    console.log('📥 Fetching Malayalam translations from al-quran.cloud...\n');
    const mlMap = await fetchMlTranslations();

    console.log('\n📝 Reading juz30.js...');
    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    // Parse the JS by extracting the JSON object (strip trailing semicolon if present)
    const jsonStart = raw.indexOf('{');
    let jsonEnd = raw.lastIndexOf('}');
    // Walk back past any trailing whitespace/semicolons after the last }
    let jsonStr = raw.slice(jsonStart, jsonEnd + 1);
    // Trim anything after the closing brace of the data object
    // The file has: const quranData = {...};\n\nwindow.quranData = quranData;\n
    // So we need only up to the first top-level closing brace
    jsonStr = jsonStr.trim().replace(/;$/, '');

    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse juz30.js as JSON:', e.message);
        process.exit(1);
    }

    let updatedAyahs = 0;
    for (const surah of data.surahs) {
        const surahMl = mlMap[surah.id];
        if (!surahMl) { console.warn(`No ML data for Surah ${surah.id}`); continue; }

        for (const ayah of surah.ayahs) {
            const mlText = surahMl[ayah.number];
            if (mlText) {
                ayah.translation_ml = mlText;
                updatedAyahs++;
            }
        }
    }

    console.log(`✅ Updated ${updatedAyahs} ayahs with Malayalam translations.`);

    // Write back as const quranData = {...}
    const newContent = 'const quranData = ' + JSON.stringify(data, null, 4) + ';\n\nwindow.quranData = quranData;\n';
    fs.writeFileSync(DATA_FILE, newContent, 'utf8');
    console.log('💾 juz30.js updated successfully!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

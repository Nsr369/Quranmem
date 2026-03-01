const fs = require('fs');
const path = require('path');
const https = require('https');

const outputJsPath = path.join(__dirname, 'js', 'data', 'juz30.js');

// Helper to fetch JSON
const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
};

const compileJuz30 = async () => {
    try {
        console.log("Fetching Juz 30 metadata from Alquran.cloud API...");
        // Alquran.cloud Juz 30
        const result = await fetchJson('https://api.alquran.cloud/v1/juz/30/quran-uthmani');

        const juzData = result.data;
        const metadataMap = {};

        // Fetch meta for surah names
        const surahsMeta = await fetchJson('https://api.alquran.cloud/v1/surah');
        surahsMeta.data.forEach(s => {
            metadataMap[s.number] = s;
        });

        const surahs = [];

        let currentSurahObj = null;

        // Ayahs in Juz 30 span across multiple Surahs (78 to 114)
        juzData.ayahs.forEach(ayah => {
            const surahNum = ayah.surah.number;

            if (!currentSurahObj || currentSurahObj.id !== surahNum) {
                if (currentSurahObj) {
                    surahs.push(currentSurahObj);
                }
                const meta = metadataMap[surahNum] || ayah.surah;
                currentSurahObj = {
                    id: surahNum,
                    name: meta.englishName || ayah.surah.englishName,
                    englishName: meta.englishNameTranslation || meta.englishName,
                    arabicName: meta.name || ayah.surah.name,
                    ayahCount: meta.numberOfAyahs,
                    ayahs: []
                };
            }

            // Mock words mapping by splitting space
            const rawText = ayah.text;
            // Clean up Bismillah from Surah starts (except Fatiha, but this is Juz 30)
            let ayahText = rawText;
            if (ayah.numberInSurah === 1 && surahNum !== 1 && ayahText.startsWith('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ')) {
                ayahText = ayahText.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
            }

            const wordsText = ayahText.split(" ").filter(w => w.trim().length > 0);
            const words = wordsText.map(w => ({ text: w, startMs: 0, endMs: 0 }));

            currentSurahObj.ayahs.push({
                number: ayah.numberInSurah,
                text: ayahText,
                translation: "Follow recited text for meaning.", // Mocking translation for now
                words: words,
                audioUrl: `https://everyayah.com/data/Alafasy_128kbps/${String(surahNum).padStart(3, '0')}${String(ayah.numberInSurah).padStart(3, '0')}.mp3`
            });
        });

        // Push the last one
        if (currentSurahObj) {
            surahs.push(currentSurahObj);
        }

        const finalOutput = `const quranData = ${JSON.stringify({ surahs: surahs }, null, 4)};\n\nwindow.quranData = quranData;`;
        fs.writeFileSync(outputJsPath, finalOutput);
        console.log(`Successfully generated full Juz 30 data with ${surahs.length} Surahs (from 78 to 114).`);

    } catch (err) {
        console.error("Failed to build Juz 30 data", err);
    }
};

compileJuz30();

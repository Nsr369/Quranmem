const fs = require('fs');
const path = require('path');
const https = require('https');

// Dynamic import for ESM package 'music-metadata'
const loadMusicMetadata = async () => {
    return await import('music-metadata');
};

const outputJsPath = path.join(__dirname, 'js', 'data', 'juz30.js');

const fetchJson = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const compileJuz30 = async () => {
    try {
        console.log("Fetching Juz 30 metadata from API V4...");
        const surahs = [];
        const mm = await loadMusicMetadata();

        for (let surahNum = 78; surahNum <= 114; surahNum++) {
            console.log(`Processing Surah ${surahNum}...`);

            // 1. Fetch Surah Meta
            const chapterRes = await fetchJson(`https://api.quran.com/api/v4/chapters/${surahNum}?language=en`);
            const chapter = chapterRes.chapter;

            // 2. Fetch Verses Text + Words
            const versesRes = await fetchJson(`https://api.quran.com/api/v4/verses/by_chapter/${surahNum}?words=true&word_fields=text_uthmani,translation&language=en&per_page=100`);
            const verses = versesRes.verses;

            // 3. Fetch Audio Timestamps (Reciter 7 = Mishari)
            const audioRes = await fetchJson(`https://api.quran.com/api/v4/chapter_recitations/7/${surahNum}?segments=true`);
            const audioData = audioRes.audio_file;

            // 4. Calculate Bismillah Offset by measuring the true MP3 over the API's 'text' timestamps
            let bismillahOffsetMs = 0;
            if (audioData.audio_url) {
                try {
                    const trueDurationMs = await new Promise((resolve, reject) => {
                        https.get(audioData.audio_url, async (res) => {
                            try {
                                const metadata = await mm.parseStream(res, { mimeType: 'audio/mpeg' });
                                resolve(metadata.format.duration * 1000);
                            } catch (streamErr) {
                                reject(streamErr);
                            }
                        }).on('error', reject);
                    });

                    // Sum up the total timestamp range given by the API
                    const textStartMs = audioData.timestamps.length > 0 ? audioData.timestamps[0].timestamp_from : 0;
                    const textEndMs = audioData.timestamps.length > 0 ? audioData.timestamps[audioData.timestamps.length - 1].timestamp_to : 0;
                    const textDurationMs = textEndMs - textStartMs;

                    // If the true MP3 is over 3.5 seconds longer than the text timestamps, it has a Bismillah padding
                    const delta = trueDurationMs - textDurationMs;
                    if (delta > 3500) {
                        bismillahOffsetMs = Math.round(delta);
                        console.log(`   -> Detected Bismillah Intro Padding: +${bismillahOffsetMs}ms`);
                    }
                } catch (e) {
                    console.error(`   -> Failed to parse audio duration for ${surahNum}. Offset is 0.`);
                }
            }

            const surahObj = {
                id: chapter.id,
                name: chapter.name_simple,
                englishName: chapter.translated_name.name,
                arabicName: chapter.name_arabic,
                ayahCount: chapter.verses_count,
                audioUrl: audioData.audio_url,
                bismillahOffsetMs: bismillahOffsetMs,
                ayahs: []
            };

            // Map each Ayah
            verses.forEach((verse, vIdx) => {
                const audioVerse = audioData.timestamps.find(t => t.verse_key === verse.verse_key);

                const ayahObj = {
                    number: verse.verse_number,
                    text: verse.words.filter(w => w.char_type_name === 'word').map(w => w.text_uthmani).join(' '),
                    translation: verse.words.filter(w => w.char_type_name === 'word').map(w => w.translation.text).join(' '),
                    timestampFrom: audioVerse ? audioVerse.timestamp_from + bismillahOffsetMs : 0,
                    timestampTo: audioVerse ? audioVerse.timestamp_to + bismillahOffsetMs : 0,
                    words: []
                };

                const segments = audioVerse ? audioVerse.segments : [];

                verse.words.forEach(wordObj => {
                    if (wordObj.char_type_name !== 'word') return; // Skip end markers

                    // Find matching segment using the word position
                    const mapping = segments.find(seg => seg[0] === wordObj.position);

                    // Add the padding offset to every single word
                    ayahObj.words.push({
                        text: wordObj.text_uthmani,
                        translation: wordObj.translation.text,
                        startMs: mapping ? mapping[1] + bismillahOffsetMs : 0,
                        endMs: mapping ? mapping[2] + bismillahOffsetMs : 0
                    });
                });

                surahObj.ayahs.push(ayahObj);
            });

            surahs.push(surahObj);
        }

        const finalOutput = `const quranData = ${JSON.stringify({ surahs: surahs }, null, 4)};\n\nwindow.quranData = quranData;`;
        fs.writeFileSync(outputJsPath, finalOutput);
        console.log(`Successfully generated full Juz 30 data with precise word-level timestamps and offsets!`);

    } catch (err) {
        console.error("Failed to build Juz 30 data", err);
    }
};

compileJuz30();

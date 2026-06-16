import json

data_file = './js/data/juz30.js'
with open(data_file, 'r', encoding='utf-8') as f:
    data = f.read()

json_str = data.replace('const quranData = ', '').split(';\n\nwindow.quranData')[0]
quran = json.loads(json_str)

with open('ml_backup.json', 'r', encoding='utf-8') as f:
    translation_map = json.load(f)

for s in quran['surahs']:
    for a in s['ayahs']:
        a['translation_ml'] = translation_map.get(a['translation'], a['translation'])
        for w in a['words']:
            w['translation_ml'] = translation_map.get(w['translation'], w['translation'])

final_output = f"const quranData = {json.dumps(quran, indent=4, ensure_ascii=False)};\n\nwindow.quranData = quranData;"
with open(data_file, 'w', encoding='utf-8') as f:
    f.write(final_output)

print("Restored translations from backup.")

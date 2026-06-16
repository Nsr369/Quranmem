import json

data_file = './js/data/juz30.js'
with open(data_file, 'r', encoding='utf-8') as f:
    data = f.read()

json_str = data.replace('const quranData = ', '').split(';\n\nwindow.quranData')[0]
quran = json.loads(json_str)

translation_map = {}

for s in quran['surahs']:
    for a in s['ayahs']:
        if 'translation_ml' in a:
            translation_map[a['translation']] = a['translation_ml']
        for w in a['words']:
            if 'translation_ml' in w:
                translation_map[w['translation']] = w['translation_ml']

with open('ml_backup.json', 'w', encoding='utf-8') as f:
    
    f.write(json.dumps(translation_map, ensure_ascii=False))

print("Backed up translations.")

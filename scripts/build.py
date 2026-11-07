"""Build the offline, one-file application with Python's standard library."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
text = (root / 'src/shell.html').read_text(encoding='utf-8')
for marker, file in [('STYLES','styles.css'),('THEORY','theory.js'),('SYNTH','synth.js'),('TRACK','track.js'),('APP','app.js')]:
    text = text.replace('/*__' + marker + '__*/', (root / 'src' / file).read_text(encoding='utf-8'))
(root / 'index.html').write_text(text, encoding='utf-8')
print(f'Built index.html ({len(text.encode()):,} bytes; no external assets)')

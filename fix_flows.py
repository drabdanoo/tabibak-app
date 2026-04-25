from pathlib import Path
import re
root = Path('maestro_flows')
fixed = []
for p in root.glob('*.yaml'):
    lines = p.read_text(encoding='utf-8').splitlines()
    out = []
    in_runflow = False
    runflow_indent = ''
    changed = False
    for line in lines:
        m = re.match(r"(\s*)-\s*runFlow:\s*$", line)
        if m:
            in_runflow = True
            runflow_indent = m.group(1)
            out.append(line)
            continue
        if in_runflow:
            if (line.strip() and len(line) - len(line.lstrip(' ')) <= len(runflow_indent)):
                in_runflow = False
            if re.match(rf"^{re.escape(runflow_indent)}\s+timeout:\s*\d+\s*$", line):
                changed = True
                continue
        out.append(line)
    if changed:
        p.write_text('\n'.join(out) + '\n', encoding='utf-8')
        fixed.append(p.name)
print('fixed:', ', '.join(fixed) or 'none')

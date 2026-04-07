import re
import os

fp = r"d:\Steller\gravityflow\contracts\prediction_market\src\lib.rs"
with open(fp, "r", encoding="utf-8") as f:
    content = f.read()

# The regex matches instances of env.storage().persistent().set(&key, &val);
# and replaces it with setting the value and extending its TTL immediately.

pattern = re.compile(
    r'(?P<indent>[ \t]*)env\.storage\(\)\s*\.persistent\(\)\s*\.set\(\s*&(?P<key>[^,]+),\s*&(?P<val>[^)]+)\s*\);',
    re.MULTILINE
)

def replacer(match):
    indent = match.group('indent')
    key = match.group('key').strip()
    val = match.group('val').strip()
    
    # If the key is an inline enum like DataKey::EscrowBal(user.clone()),
    # we should extract it to a variable first so we can take its reference twice.
    # But wait, we can just instantiate it twice or save it explicitly.
    # Actually, saving it:
    # let key = KEY;
    # env.storage().persistent().set(&key, &val);
    # env.storage().persistent().extend_ttl(&key, 17_280, 17_280);
    
    return f"{indent}let k = {key};\n{indent}env.storage().persistent().set(&k, &{val});\n{indent}env.storage().persistent().extend_ttl(&k, 17_280, 17_280);"

new_content = pattern.sub(replacer, content)

with open(fp, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Patch applied.")

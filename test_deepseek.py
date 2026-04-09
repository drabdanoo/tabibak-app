#!/usr/bin/env python3
"""Quick DeepSeek API test — run before ios_review_agent.py"""

import os
import sys

# ── 1. Check key exists ───────────────────────────────────────────────────────
key = os.environ.get("DEEPSEEK_API_KEY")
if not key:
    print("❌  DEEPSEEK_API_KEY not found in environment variables.")
    print("    Set it with:  set DEEPSEEK_API_KEY=sk-...")
    sys.exit(1)

print(f"✅  Key found: {key[:8]}{'*' * (len(key) - 8)}")

# ── 2. Check openai package ───────────────────────────────────────────────────
try:
    from openai import OpenAI
    print("✅  openai package installed")
except ImportError:
    print("❌  openai package not installed.")
    print("    Run:  pip install openai")
    sys.exit(1)

# ── 3. Test DeepSeek-V3 (Engineer model) ─────────────────────────────────────
print("\n⏳  Testing deepseek-chat (V3 — Engineer model)...")
try:
    client = OpenAI(api_key=key, base_url="https://api.deepseek.com")
    resp = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "Reply with exactly: DeepSeek V3 ready ✓"}],
        max_tokens=20,
    )
    reply = resp.choices[0].message.content.strip()
    print(f"✅  Response: {reply}")
except Exception as e:
    print(f"❌  deepseek-chat failed: {e}")
    sys.exit(1)

# ── 4. Test DeepSeek-R1 (Builder model) ──────────────────────────────────────
print("\n⏳  Testing deepseek-reasoner (R1 — Builder model)...")
try:
    resp = client.chat.completions.create(
        model="deepseek-reasoner",
        messages=[{"role": "user", "content": "Reply with exactly: DeepSeek R1 ready ✓"}],
        max_tokens=100,
    )
    msg = resp.choices[0].message

    # R1 has two fields: content (final answer) and reasoning_content (thinking)
    content   = (msg.content or "").strip()
    reasoning = (getattr(msg, "reasoning_content", None) or "").strip()

    if content:
        print(f"✅  content          : {content}")
    else:
        print(f"⚠️   content is empty  (R1 quirk — script handles this automatically)")

    if reasoning:
        preview = reasoning[:80] + ("..." if len(reasoning) > 80 else "")
        print(f"✅  reasoning_content: {preview}")

    if not content and not reasoning:
        print("❌  Both content and reasoning_content are empty — unexpected error")
        sys.exit(1)

except Exception as e:
    print(f"❌  deepseek-reasoner failed: {e}")
    sys.exit(1)

# ── 5. All good ───────────────────────────────────────────────────────────────
print("\n" + "─" * 40)
print("✅  All checks passed — you can run ios_review_agent.py")
print("─" * 40)

# Remove API Keys from Git History

## Step 1: Commit current changes first
```bash
git commit -m "Extract API keys to config.json and add to gitignore"
```

## Step 2: Use git filter-branch to remove API keys from history

**⚠️ Warning: This will rewrite git history. Make sure all team members are aware and re-clone the repo after this.**

### Method 1: Using git filter-branch (older method)
```bash
# Remove lines containing your Google API key
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch MCP/server/src/index.ts || true; \
   if [ -f MCP/server/src/index.ts ]; then \
     sed -i.bak "/AIzaSyC9yaQUsLTxUEyxv6i8M1IcMPkIWJto6RY/d" MCP/server/src/index.ts && \
     git add MCP/server/src/index.ts; \
   fi' \
  --tag-name-filter cat -- --all

# Remove lines containing your ElevenLabs API key  
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch MCP/server/src/index.ts || true; \
   if [ -f MCP/server/src/index.ts ]; then \
     sed -i.bak "/sk_15d6f23c93bf4d768f210fbbfc07f68105f0870aa8aa0198/d" MCP/server/src/index.ts && \
     git add MCP/server/src/index.ts; \
   fi' \
  --tag-name-filter cat -- --all
```

### Method 2: Using BFG Repo-Cleaner (recommended, faster)

1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
2. Create a text file with your secrets:

```bash
# Create secrets.txt
echo "AIzaSyC9yaQUsLTxUEyxv6i8M1IcMPkIWJto6RY" > secrets.txt
echo "sk_15d6f23c93bf4d768f210fbbfc07f68105f0870aa8aa0198" >> secrets.txt
```

3. Run BFG:
```bash
java -jar bfg.jar --replace-text secrets.txt .
```

4. Clean up:
```bash
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

## Step 3: Force push (⚠️ Dangerous!)
```bash
git push --force-with-lease origin --all
git push --force-with-lease origin --tags
```

## Step 4: Team coordination
- All team members need to delete their local clones and re-clone
- Any forks or mirrors need the same treatment

## Alternative: Simpler approach if this is a new repo
If you haven't shared this repo yet or it's still early in development:

1. Create a completely new repo
2. Copy only the current cleaned version
3. Start fresh without the API keys in history

## Verification
After cleaning, search for the keys:
```bash
git log -p --all | grep -E "(AIzaSyC|sk_15d6)"
```

If this returns nothing, you're clean!

## Prevention for future
- Add pre-commit hooks to scan for API keys
- Use tools like `git-secrets` or `gitleaks`
- Always use config files for secrets from the start
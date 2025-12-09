# Remove API Keys from Git History

## Situation
API keys were accidentally committed in `MCP/server/src/index.ts` from the beginning of the repo through commit `0754e28`.
Starting from commit `71234a9`, the file is clean (uses config.json instead).
We need to remove the file's history from the beginning through commit `0754e28`.

## Solution: Remove file history for specific commits (No Java needed!)

### Method 1: Using git filter-branch (Native Git)

```bash
# Remove MCP/server/src/index.ts from the beginning through commit 0754e28
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch MCP/server/src/index.ts' \
  --prune-empty --tag-name-filter cat -- --all ^71234a9

# Or if you want to target specific range more precisely:
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch MCP/server/src/index.ts' \
  --prune-empty -- $(git rev-list --reverse HEAD)..0754e28

# Clean up git objects
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Method 2: Using git filter-repo (Modern, No Java - Recommended!)

1. **Install git-filter-repo**:
```bash
# Windows (if you have Python/pip)
pip install git-filter-repo

# Or download the single script:
# https://github.com/newren/git-filter-repo/blob/main/git-filter-repo
```

2. **Create a commit-map file** (optional, for precise control):
```bash
# Remove the file only from commits before 71234a9
git filter-repo --path MCP/server/src/index.ts --invert-paths \
  --commit-callback '
    if commit.original_id <= b"0754e28":
        # Remove this commit
        return None
    return commit
  ' --force
```

### Method 3: Interactive Rebase (Manual but Precise)

If the commits are relatively recent and not too many:

```bash
# Find the parent of the first commit with API keys
git rebase -i --root

# In the editor, for each commit up to 0754e28:
# - Change "pick" to "edit"
# - Then for each stopped commit:
git rm --cached MCP/server/src/index.ts
git commit --amend --no-edit
git rebase --continue
```

### Method 4: Replace file contents in history (Keep commits, clean content)

If you want to keep the commit history but just remove the API keys from the file:

```bash
# Create a script to replace API keys
git filter-branch --force --tree-filter '
  if [ -f MCP/server/src/index.ts ]; then
    sed -i "s/sk_REDACTED_ELEVENLABS_KEY/YOUR_ELEVENLABS_API_KEY/g" MCP/server/src/index.ts
    sed -i "s/AIza_REDACTED_GOOGLE_KEY/YOUR_GOOGLE_API_KEY/g" MCP/server/src/index.ts
  fi
' --prune-empty --tag-name-filter cat -- --all ^71234a9

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Simplest Approach (Recommended)

**Remove the file from all commits in the branch until 71234a9:**

```bash
# Step 1: Remove the file from early history
git filter-branch --force --index-filter \
  'if git rev-list 71234a9..HEAD | grep -q $(git rev-parse HEAD 2>/dev/null); then
    : # Keep the file in commits from 71234a9 onwards
  else
    git rm --cached --ignore-unmatch MCP/server/src/index.ts
  fi' \
  --prune-empty --tag-name-filter cat -- usingLLM

# Step 2: Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Step 3: Force push
git push --force-with-lease origin usingLLM
```

## Even Simpler: Just scrub the API keys from all history

```bash
# Replace API keys with placeholders throughout history
git filter-branch --force --tree-filter '
  if [ -f MCP/server/src/index.ts ]; then
    sed -i.bak "s/sk_REDACTED_ELEVENLABS_KEY/YOUR_ELEVENLABS_API_KEY/g" MCP/server/src/index.ts
    sed -i.bak "s/AIza_REDACTED_GOOGLE_KEY/YOUR_GOOGLE_API_KEY/g" MCP/server/src/index.ts
    rm -f MCP/server/src/index.ts.bak
  fi
' --tag-name-filter cat -- --all

git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### If you get "stale info" error when pushing:

```bash
# Option 1: Force push (after verifying your changes are correct)
git push --force origin usingLLM

# Option 2: If --force-with-lease fails, backup first then force
git branch backup-before-force
git push --force origin usingLLM
```

### Alternative: Remove file from commits before 71234a9

```bash
# Remove the file completely from all commits before the clean one
git filter-branch --force --index-filter \
  'COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "");
   if [ -n "$COMMIT_HASH" ] && ! git merge-base --is-ancestor 71234a9 $COMMIT_HASH 2>/dev/null; then
     git rm --cached --ignore-unmatch MCP/server/src/index.ts;
   fi' \
  --tag-name-filter cat -- --all

git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force origin usingLLM
```

## Verification

Check that the API keys are gone:
```bash
# Search for the API keys in git history
git log -p --all | grep -E "(sk_REDACTED_ELEVENLABS_KEY|AIza_REDACTED_GOOGLE_KEY)"

# Should return nothing if successfully removed
```

## After Cleaning

1. **Force push the cleaned branch**:
   ```bash
   git push --force-with-lease origin usingLLM
   ```

2. **Anyone else working on this branch** needs to:
   ```bash
   git fetch origin
   git reset --hard origin/usingLLM
   ```

## Prevention
- ✅ Use config.json for API keys (already done in commit 71234a9+)
- ✅ Add config.json to .gitignore
- ✅ Use config.json.template for version control
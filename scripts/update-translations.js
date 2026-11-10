#!/usr/bin/env node

/*
  Translation updater CLI

  Usage examples:
  - Copy value of a key from en to all languages (dry run):
    node scripts/update-translations.js --key 5chan_description --from en --dry

  - Set a specific value for all languages (including en):
    node scripts/update-translations.js --key no_global_rules_info --value "Your value" --include-en --write

  - Use a mapping file with per-language values (JSON object of { langCode: value, ... }):
    node scripts/update-translations.js --key my_key --map ./path/to/map.json --write

  - Delete a key from all languages (dry run):
    node scripts/update-translations.js --key obsolete_key --delete --dry

  - Delete a key from all languages (actually delete):
    node scripts/update-translations.js --key obsolete_key --delete --write

  - Audit for unused keys (dry run):
    node scripts/update-translations.js --audit --dry

  - Remove all unused keys:
    node scripts/update-translations.js --audit --write

  - Force removal even when dynamic keys detected:
    node scripts/update-translations.js --audit --write --force

  Flags:
    --key <name>                 Required (except for --audit). The translation key to update/delete.
    --audit                      Scan codebase for unused translation keys and report/remove them.
    --delete                     Delete the key from all languages instead of updating.
    --from <lang>                Source language to read value from if --value/--map are not provided (default: en).
    --value <string>             Literal value to set for targets (use with caution, no auto-translate).
    --map <file>                 JSON file mapping of { langCode: string } to set per language.
    --only <langs>               Comma-separated list of language codes to update (e.g. "es,fr,it").
    --exclude <langs>            Comma-separated list of language codes to skip.
    --include-en                 Include the source language (e.g. en) in updates.
    --dry|--dry-run              Show changes but do not write files (default).
    --write                      Actually write the files.
    --force                      Force --audit --write even when dynamic translation keys are detected.
                                 Use with caution: dynamic keys (e.g. t(`prefix_${var}`)) cannot be
                                 statically analyzed, so some "unused" keys may actually be in use.

  ⚠️  LIMITATIONS (audit mode):
  This script uses static analysis to find translation keys. It can only detect string literals like:
    - t('key') or t("key")
    - i18nKey="key" or i18nKey={'key'}

  It CANNOT detect dynamic keys such as:
    - t(`prefix_${variable}`)
    - t(someVariable)
    - i18nKey={dynamicValue}

  When dynamic key usage is detected, the script will:
    1. Warn you about the files/lines containing dynamic keys
    2. Block --write unless --force is also passed
    3. Recommend manual review before deletion

  Always review the dynamic key warnings before using --force!
*/

import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Set by a signal received while writing; see main().
let interruptedBy

function parseArgs(argv) {
  const out = { flags: new Set() }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = i + 1 < argv.length ? argv[i + 1] : undefined
    if (arg.startsWith('--')) {
      if (['--dry', '--dry-run', '--write', '--include-en', '--delete', '--audit', '--force'].includes(arg)) {
        out.flags.add(arg)
        continue
      }
      const key = arg
      let value
      if (next && !next.startsWith('--')) {
        value = next
        i++
      }
      out[key] = value ?? ''
    }
  }
  return out
}

function usage(msg) {
  throw new Error(
    `${msg}\nUsage: node scripts/update-translations.js --key <name> [--delete] [--from <lang>] [--value <string> | --map <file>] [--only <langs>] [--exclude <langs>] [--include-en] [--dry|--write]`
  )
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function parseCsv(val) {
  if (!val) return new Set()
  return new Set(
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

async function loadJson(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${filePath}: ${err.message}`)
  }
}

async function writeJson(filePath, data) {
  // Stop between whole-file replacements so every locale file stays valid.
  if (interruptedBy) throw new Error(`Interrupted by ${interruptedBy} before writing ${filePath}. Files written before it keep their changes.`)
  const json = JSON.stringify(data, null, 2) + '\n'
  const tempDir = await fs.mkdtemp(path.join(path.dirname(filePath), '.update-translations-'))
  try {
    const tempPath = path.join(tempDir, 'default.json')
    await fs.writeFile(tempPath, json, 'utf8')
    await fs.rename(tempPath, filePath)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

async function acquireWriteLock(translationsRoot) {
  const lockPath = path.join(translationsRoot, '.update-translations.lock')
  let lock
  try {
    lock = await fs.open(lockPath, 'wx')
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new Error(
        `Translation writer lock exists: ${lockPath}. No files were written. Retry after the active writer finishes. If it was interrupted, verify no writer is active before removing this lock.`
      )
    }
    throw err
  }

  return async () => {
    try {
      const owned = await lock.stat()
      const current = await fs.lstat(lockPath).catch((err) => {
        if (err.code === 'ENOENT') return undefined
        throw err
      })
      if (current?.dev === owned.dev && current?.ino === owned.ino) await fs.unlink(lockPath)
    } finally {
      await lock.close()
    }
  }
}

async function handleDelete(key, translationsRoot, only, exclude, dryRun, write) {
  const dirents = await fs.readdir(translationsRoot, { withFileTypes: true })
  const langs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)

  const planned = []

  for (const lang of langs) {
    if (only.size && !only.has(lang)) continue
    if (exclude.size && exclude.has(lang)) continue

    const filePath = path.join(translationsRoot, lang, 'default.json')
    if (!(await fileExists(filePath))) continue

    const json = await loadJson(filePath)

    if (!Object.prototype.hasOwnProperty.call(json, key)) {
      // Key does not exist in this language, skip
      continue
    }

    const prevVal = json[key]
    planned.push({ lang, filePath, prevVal, json })
  }

  if (!planned.length) {
    console.log('No changes planned.')
    return
  }

  for (const change of planned) {
    const { lang, filePath, prevVal } = change
    const prevPreview = typeof prevVal === 'undefined' ? '<missing>' : String(prevVal).substring(0, 60)
    console.log(`[${lang}] ${key}:`)
    console.log(`  - deleted: ${prevPreview}${String(prevVal).length > 60 ? '...' : ''}`)
    if (!dryRun) {
      delete change.json[key]
      await writeJson(filePath, change.json)
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. ${planned.length} file(s) would change. Re-run with --write to apply.`)
  } else if (write) {
    console.log(`\nWrote ${planned.length} file(s).`)
  }
}

/**
 * Recursively get all files in a directory matching given extensions
 */
async function getFilesRecursive(dir, extensions) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      files.push(...(await getFilesRecursive(fullPath, extensions)))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

/**
 * Scan source files and extract all translation keys used in the codebase.
 * Also detects dynamic key usage that cannot be statically analyzed.
 *
 * Returns: { usedKeys: Set<string>, dynamicUsages: Array<{file, line, code, type}> }
 */
async function extractUsedKeys(srcDir) {
  const usedKeys = new Set()
  const dynamicUsages = []
  const extensions = ['.ts', '.tsx', '.js', '.jsx']
  const files = await getFilesRecursive(srcDir, extensions)

  // Patterns to match static translation key usage:
  // - t('key') or t("key") with optional params
  // - i18nKey="key" or i18nKey={'key'} or i18nKey={"key"} for Trans components
  const staticPatterns = [
    /\bt\(\s*['"]([^'"]+)['"]/g, // t('key') or t("key")
    /i18nKey\s*=\s*['"]([^'"]+)['"]/g, // i18nKey="key"
    /i18nKey\s*=\s*\{\s*['"]([^'"]+)['"]\s*\}/g, // i18nKey={'key'}
  ]

  // Patterns to detect dynamic/unknown key usage (cannot extract concrete keys):
  // - t(`...`) template literals with interpolations
  // - t(variable) where variable is not a string literal
  // - i18nKey={variable} where variable is not a string literal
  // Note: We use (?<![a-zA-Z]) negative lookbehind to avoid matching clearTimeout(), parseInt(), etc.
  const dynamicPatterns = [
    { pattern: /(?<![a-zA-Z])t\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g, type: 't() with template literal interpolation' },
    { pattern: /(?<![a-zA-Z])t\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[,)]/g, type: 't() with variable', checkCapture: true },
    { pattern: /i18nKey\s*=\s*\{\s*([a-zA-Z_$][a-zA-Z0-9_$.]*)\s*\}/g, type: 'i18nKey with variable', checkCapture: true },
  ]

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')
    const lines = content.split('\n')

    // Extract static keys
    for (const pattern of staticPatterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(content)) !== null) {
        usedKeys.add(match[1])
      }
    }

    // Detect dynamic key usage
    for (const { pattern, type, checkCapture } of dynamicPatterns) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(content)) !== null) {
        // For variable patterns, skip if the captured group is a string literal indicator
        // (already handled by static patterns)
        if (checkCapture) {
          const captured = match[1]
          // Skip common false positives: the match is actually a string literal we already caught
          if (!captured || captured.startsWith("'") || captured.startsWith('"')) continue
        }

        // Find line number
        const matchStart = match.index
        let lineNum = 1
        let charCount = 0
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1 // +1 for newline
          if (charCount > matchStart) {
            lineNum = i + 1
            break
          }
        }

        dynamicUsages.push({
          file,
          line: lineNum,
          code: match[0].trim().substring(0, 60),
          type,
        })
      }
    }
  }

  return { usedKeys, dynamicUsages }
}

async function handleAudit(translationsRoot, srcDir, dryRun, write, force) {
  console.log('Scanning codebase for translation key usage...\n')

  // Get all keys used in the codebase (and dynamic usage warnings)
  const { usedKeys, dynamicUsages } = await extractUsedKeys(srcDir)
  console.log(`Found ${usedKeys.size} static translation keys used in the codebase.`)

  // Report dynamic key usages (these could reference any key at runtime)
  const hasDynamicUsages = dynamicUsages.length > 0
  if (hasDynamicUsages) {
    console.log(`\n⚠️  WARNING: Found ${dynamicUsages.length} dynamic translation key usage(s):\n`)
    console.log('These use variables or template literals, so the actual keys cannot be determined statically.')
    console.log('Some "unused" keys below may actually be used at runtime!\n')

    // Group by file for cleaner output
    const byFile = new Map()
    for (const usage of dynamicUsages) {
      if (!byFile.has(usage.file)) byFile.set(usage.file, [])
      byFile.get(usage.file).push(usage)
    }

    for (const [file, usages] of byFile) {
      const relPath = path.relative(process.cwd(), file)
      console.log(`  ${relPath}:`)
      for (const u of usages) {
        console.log(`    Line ${u.line}: ${u.code}${u.code.length >= 60 ? '...' : ''}`)
        console.log(`             (${u.type})`)
      }
    }
    console.log('')
  }

  // Load the English translation file as the reference
  const enPath = path.join(translationsRoot, 'en', 'default.json')
  if (!(await fileExists(enPath))) {
    throw new Error(`English translation file not found: ${enPath}`)
  }
  const enJson = await loadJson(enPath)
  const definedKeys = Object.keys(enJson)

  // Find unused keys (defined but not used statically)
  const unusedKeys = definedKeys.filter((key) => !usedKeys.has(key))

  if (unusedKeys.length === 0) {
    console.log('No unused translation keys found. All keys are in use.')
    return
  }

  console.log(`Found ${unusedKeys.length} unused translation key(s):\n`)
  for (const key of unusedKeys) {
    const value = enJson[key]
    const preview = String(value).substring(0, 50)
    console.log(`  - ${key}: "${preview}${String(value).length > 50 ? '...' : ''}"`)
  }

  if (dryRun) {
    console.log(`\nDry run complete. ${unusedKeys.length} key(s) would be removed from all language files.`)
    if (hasDynamicUsages) {
      console.log('\n⚠️  Dynamic key usage detected! Review the warnings above before removing keys.')
      console.log('Re-run with --write --force to remove them anyway (after manual review).')
    } else {
      console.log('Re-run with --write to remove them.')
    }
    return
  }

  // Block --write if dynamic usages detected and --force not provided
  if (hasDynamicUsages && !force) {
    console.log('\n❌ BLOCKED: Cannot remove keys automatically when dynamic key usage is detected.')
    console.log('Some "unused" keys may actually be referenced by dynamic expressions at runtime.')
    console.log('')
    console.log('Please:')
    console.log('  1. Review the dynamic key warnings above')
    console.log('  2. Manually verify that the "unused" keys are truly not needed')
    console.log('  3. Re-run with --write --force to proceed with deletion')
    console.log('')
    console.log('Alternatively, refactor dynamic keys to use static strings where possible.')
    throw new Error('Audit aborted because dynamic translation keys require --force.')
  }

  if (hasDynamicUsages && force) {
    console.log('\n⚠️  Proceeding with --force despite dynamic key usage warnings...')
  }

  // Remove unused keys from all language files
  const dirents = await fs.readdir(translationsRoot, { withFileTypes: true })
  const langs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)

  let filesChanged = 0
  for (const lang of langs) {
    const filePath = path.join(translationsRoot, lang, 'default.json')
    if (!(await fileExists(filePath))) continue

    const json = await loadJson(filePath)
    let changed = false

    for (const key of unusedKeys) {
      if (Object.prototype.hasOwnProperty.call(json, key)) {
        delete json[key]
        changed = true
      }
    }

    if (changed) {
      await writeJson(filePath, json)
      filesChanged++
      console.log(`\n[${lang}] Removed ${unusedKeys.length} unused key(s).`)
    }
  }

  console.log(`\nRemoved unused keys from ${filesChanged} language file(s).`)
}

async function handleUpdate(key, translationsRoot, fromLang, includeEn, only, exclude, literalValue, mapFile, map, dryRun, write) {
  let sourceValue = undefined
  if (!literalValue && !map) {
    // default to --from
    const srcPath = path.join(translationsRoot, fromLang, 'default.json')
    if (!(await fileExists(srcPath))) usage(`Source file not found for --from ${fromLang}: ${srcPath}`)
    const srcJson = await loadJson(srcPath)
    sourceValue = srcJson[key]
    if (typeof sourceValue === 'undefined') usage(`Key "${key}" not found in source language ${fromLang}`)
  }

  const dirents = await fs.readdir(translationsRoot, { withFileTypes: true })
  const langs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)

  const planned = []

  for (const lang of langs) {
    if (!includeEn && lang === fromLang) continue
    if (only.size && !only.has(lang)) continue
    if (exclude.size && exclude.has(lang)) continue

    const filePath = path.join(translationsRoot, lang, 'default.json')
    if (!(await fileExists(filePath))) continue

    const json = await loadJson(filePath)

    let nextVal
    if (map && Object.prototype.hasOwnProperty.call(map, lang)) {
      nextVal = map[lang]
    } else if (typeof literalValue !== 'undefined') {
      nextVal = literalValue
    } else {
      nextVal = sourceValue
    }

    if (typeof nextVal === 'undefined') {
      // No value for this lang in the chosen mode; skip
      continue
    }

    const prevVal = json[key]
    if (prevVal === nextVal) continue

    planned.push({ lang, filePath, prevVal, nextVal, json })
  }

  if (!planned.length) {
    console.log('No changes planned.')
    return
  }

  for (const change of planned) {
    const { lang, filePath, prevVal, nextVal } = change
    const prevPreview = typeof prevVal === 'undefined' ? '<missing>' : String(prevVal).substring(0, 60)
    const nextPreview = String(nextVal).substring(0, 60)
    console.log(`[${lang}] ${key}:`)
    console.log(`  - from: ${prevPreview}${String(prevVal).length > 60 ? '...' : ''}`)
    console.log(`  + to  : ${nextPreview}${String(nextVal).length > 60 ? '...' : ''}`)
    if (!dryRun) {
      change.json[key] = nextVal
      await writeJson(filePath, change.json)
    }
  }

  if (dryRun) {
    console.log(`\nDry run complete. ${planned.length} file(s) would change. Re-run with --write to apply.`)
  } else if (write) {
    console.log(`\nWrote ${planned.length} file(s).`)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  const translationsRoot = path.join(process.cwd(), 'public', 'translations')
  if (!(await fileExists(translationsRoot))) {
    usage(`Translations directory not found: ${translationsRoot}`)
  }

  const isAudit = args.flags.has('--audit')
  const isDelete = args.flags.has('--delete')
  const dryRun = args.flags.has('--dry') || args.flags.has('--dry-run') || !args.flags.has('--write')
  const write = args.flags.has('--write')
  const force = args.flags.has('--force')

  // An unhandled signal would end the process without the finally below and leave the lock behind.
  const signals = dryRun ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP']
  const stopOnSignal = (signal) => {
    interruptedBy = signal
  }
  for (const signal of signals) process.on(signal, stopOnSignal)

  // Hold the lock from the first read through the final write to avoid lost updates.
  const releaseLock = dryRun ? undefined : await acquireWriteLock(translationsRoot)
  try {
    if (isAudit) {
      // Audit mode: scan codebase and remove unused keys
      const srcDir = path.join(process.cwd(), 'src')
      await handleAudit(translationsRoot, srcDir, dryRun, write, force)
      return
    }

    const key = args['--key']
    if (!key) usage('Missing required --key')

    const fromLang = args['--from'] || 'en'
    const includeEn = args.flags.has('--include-en')
    const only = parseCsv(args['--only'])
    const exclude = parseCsv(args['--exclude'])

    if (isDelete) {
      // Delete mode
      await handleDelete(key, translationsRoot, only, exclude, dryRun, write)
    } else {
      // Update mode
      let literalValue = args['--value']
      let mapFile = args['--map']
      let map = undefined

      if (mapFile) {
        const absMap = path.isAbsolute(mapFile) ? mapFile : path.join(process.cwd(), mapFile)
        if (!(await fileExists(absMap))) usage(`--map not found: ${absMap}`)
        map = await loadJson(absMap)
        if (typeof map !== 'object' || map === null) usage('--map must be a JSON object of { lang: value }')
      }

      await handleUpdate(key, translationsRoot, fromLang, includeEn, only, exclude, literalValue, mapFile, map, dryRun, write)
    }
  } finally {
    await releaseLock?.()
    for (const signal of signals) process.off(signal, stopOnSignal)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = interruptedBy ? 128 + os.constants.signals[interruptedBy] : 1
})

# AGENTS.md

Conventions for AI coding assistants working in this repo.

## Tech Stack

- **Framework**: Vue 3 (Composition API, `<script setup lang="ts">`)
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Package Manager**: bun — do NOT use npm/yarn/pnpm
- **Styling**: CSS with CSS Variables, modular files
- **Data**: js-yaml, papaparse, xlsx, decimal.js

## Commands

```bash
bun run dev        # Dev server (HMR)
bun run build      # Type check (vue-tsc -b) then vite build
bun run preview    # Preview production build
bun run lint       # ESLint with --fix
bun run deploy     # Run deploy.sh
```

No test framework is configured. If tests are needed, add vitest first.

## Project Structure

```
src/
├── components/    # Vue SFCs (PascalCase: ScoreTable.vue)
├── router/        # Vue Router config
├── styles/        # CSS modules (theme, components, layout, animations)
├── types/         # TypeScript interfaces/types
├── utils/         # Helper functions
└── App.vue        # Root component
public/data/       # Static data (CSV, JSON, YAML, Markdown)
```

## Code Style

### Formatting

From `.editorconfig` and `eslint.config.js`:

- **Indent**: 2 spaces for all files
- **Charset**: UTF-8, insert final newline
- **Object braces**: always a space inside `{ a }` not `{a}`
- **Curly braces**: required for multi-line statements
- **Max empty lines**: 1, no trailing blank line
- **Trailing spaces**: forbidden
- **Semicolons / quotes / commas**: no enforcement
- **Linebreak style**: no enforcement (Windows-style OK)

### Imports

Order: 1) external libs, 2) internal utils/types, 3) Vue components.

```typescript
import { ref, computed, watch } from 'vue'
import { Decimal } from 'decimal.js'
import { loadRoundScoreData, type ScoreRecord } from '../utils/scoreCalculator'
import ScoreTable from './ScoreTable.vue'
```

Use `import type` for type-only imports.

### Vue Components

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  year: string
  round: string
}>()

const scoreData = ref<RoundScoreData | null>(null)

const filteredData = computed(() => {
  if (!scoreData.value) return []
  return scoreData.value.filter(...)
})

onMounted(() => { /* init logic */ })
</script>
```

Enforced Vue ESLint rules:
- Max 3 attributes on single-line; 1 per line in multi-line
- HTML indent: 2 spaces
- Mustache interpolation: `{{ value }}` not `{{value}}`
- `prop-name-casing` and `multi-word-component-names` are off

### TypeScript

- `strict: true`; `any` is allowed
- Unused vars: prefix with `_` to suppress warnings
- Optional props use `?`

```typescript
interface ScoreRecord {
  playerCode: string
  playerName: string
  totalScore: Decimal
  isRevoked?: boolean
}
```

### Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ScoreTable.vue` |
| Functions | camelCase | `loadRoundScoreData` |
| Constants | UPPER_SNAKE_CASE | `SCORING_SCHEMES` |
| Variables | camelCase | `selectedYear` |
| Types/Interfaces | PascalCase | `ScoreRecord` |

### Comparisons

Use `===`/`!==`. Exception: `== null`/`== undefined` is allowed (smart mode).

### Variables

Always `const`, never `var`. Use `let` only when mutation is needed.

### Error Handling

Wrap async operations in try-catch. Use Chinese error messages. Maintain an `error` ref in components for UI display.

```typescript
try {
  const res = await fetch(url)
  if (!res.ok) throw new Error('网络错误: 无法加载数据')
} catch (error) {
  console.error('加载失败:', error)
  throw error
}
```

Empty catch blocks are allowed.

## Numeric Precision

Use `decimal.js` for all score calculations:

```typescript
import { Decimal } from 'decimal.js'
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP })
const avg = new Decimal(score).div(count).toDecimalPlaces(1)
```

## Data Loading

Static assets live in `public/data/`. Fetch with `Promise.all` for parallel loads:

```typescript
const [levels, maxScore, config] = await Promise.all([
  fetch('/data/levels/index.json').then(r => r.json()),
  fetch('/data/maxScore.json').then(r => r.json()),
  fetch('/data/mwcup.yaml').then(r => r.text()),
])
```

## Type Definitions

- Complex types go in `src/types/`
- Use `.d.ts` for extending third-party library types
- Export types with `export interface` or `export type`

## CSS Conventions

- Theme colors via CSS variables: `--primary-color`, `--text-primary`
- Modular: theme.css, components.css, layout.css, animations.css
- Responsive: `@media (max-width: 768px)` breakpoint
- Animation classes: `animate-fadeInUp`, `hover-scale`

## Routing

Config in `src/router/index.ts`. Use Vue Router composables:

```typescript
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const year = route.params.year as string
```

## Scoring Schemes

Supports schemes A/B/C/D/E/S defined in YAML:
- A: ['欣赏性', '娱乐性', '挑战性', '创新性', '加分项', '扣分项']
- C/E: degree-based scoring
- D: judge/public mixed scoring
- S: total score system

Check `scoringScheme` before applying score logic — each has different categories.

## Data Sources

- `public/data/docs/*.md` - Event documentation
- `public/data/levels/index.json` - Level index
- `public/data/scores/*.csv` - Round scores
- `public/data/subjects/*.md` - Competition problems
- `public/data/votes/*.csv` - Public votes
- `public/data/maxScore.json` - Max score per round
- `public/data/mwcup.yaml` - Competition config
- `public/data/specialLevels.json` - Special level mapping
- `public/data/levelSubjects.json` - Level-to-subject mapping (2026+)
- `public/data/users.csv` - User list

## Notes

- **Language**: Use Chinese for comments and error messages
- **Browser**: Target modern browsers
- **Responsive**: Support mobile (768px breakpoint)
- **Performance**: Use pagination or lazy loading for large datasets
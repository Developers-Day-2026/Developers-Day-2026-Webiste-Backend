import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

export interface CompetitionCsvRow {
    category: string
    name: string
    earlyBirdPrice: number
    normalPrice: number
    teamCountRaw: string
    description: string
}

export function loadCompetitionCsvRows(): CompetitionCsvRow[] {
    const csvPath = path.join(process.cwd(), 'Devday 26 Competitions - Details.csv')
    const content = fs.readFileSync(csvPath, 'utf-8')

    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as any[]

    return records.map((record) => ({
        category: String(record['Category'] ?? '').trim(),
        name: String(record['Competition Name'] ?? '').trim(),
        earlyBirdPrice: Number(record['Early Bird Price'] ?? 0) || 0,
        normalPrice: Number(record['Normal Price'] ?? 0) || 0,
        teamCountRaw: String(record['Team Count'] ?? '').trim(),
        description: String(record['Description'] ?? '').trim(),
    }))
}

export function getTeamSizeFromRaw(raw: string): { min: number; max: number } {
    const matchRange = raw.match(/(\d+)\s*-\s*(\d+)/)
    if (matchRange) {
        return { min: Number(matchRange[1]), max: Number(matchRange[2]) }
    }

    const matchSingle = raw.match(/(\d+)/)
    if (matchSingle) {
        const value = Number(matchSingle[1])
        return { min: value, max: value }
    }

    return { min: 1, max: 1 }
}

export function buildCompetitionCategoryMap(): Map<string, string> {
    const rows = loadCompetitionCsvRows()
    const map = new Map<string, string>()

    for (const row of rows) {
        if (row.name) {
            map.set(row.name, row.category)
        }
    }

    return map
}


import type { MappingState } from './types.ts'
export const NETWORK_STEP = 's-prereq-trusted-location'
export const NETWORK_NAME = 'Office Network Name'
export const NETWORK_RANGES = 'Public IP Ranges'
export function validNetworkRanges(text: string): boolean {
  const ranges = text.split(/[\s,;]+/).filter(Boolean)
  return ranges.length > 0 && ranges.every(range => {
    const parts = range.split('/')
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return false
    const prefix = Number(parts[1])
    if (parts[0].includes(':')) {
      try { new URL(`https://[${parts[0]}]/`) } catch { return false }
      return prefix > 0 && prefix <= 128
    }
    const octets = parts[0].split('.')
    return octets.length === 4 && octets.every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255) && prefix > 0 && prefix <= 32
  })
}
export function networkDraftOf(mapping: MappingState): {name: string; ranges: string[]} | null {
  const name = mapping.questionAnswers?.[`${NETWORK_STEP}:${NETWORK_NAME}`]?.trim()
  const ranges = mapping.questionAnswers?.[`${NETWORK_STEP}:${NETWORK_RANGES}`] ?? ''
  return name && validNetworkRanges(ranges) ? {name, ranges: [...new Set(ranges.split(/[\s,;]+/).filter(Boolean))]} : null
}

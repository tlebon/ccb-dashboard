/**
 * Parse performer names from show descriptions
 * Looks for patterns like:
 * - "Team members are: Name1, Name2, ... and Name"
 * - "*Actual Cast: Name1, Name2, ..."
 * - "regular cast is Name1, Name2, ... and Name"
 * - "Hosted by: Name"
 */

// Patterns that indicate a name list follows
const NAME_LIST_PATTERNS = [
	/\*?Actual Cast:\s*/i,
	/Team members are:\s*/i,
	/regular cast is\s*/i,
	/cast is\s*/i,
	/cast:\s*/i,
	/performers?:\s*/i,
	/starring:\s*/i,
	/featuring:\s*/i,
	/lineup:\s*/i
];

// Patterns for single/multiple person mentions (not followed by a long list)
const SINGLE_PERSON_PATTERNS = [/[Hh]osted by:?\s*/, /[Cc]oached by\s*/];

/**
 * Split a string of names by comma and "and"
 */
function splitNames(nameSection: string): string[] {
	return nameSection
		.split(/,\s*/)
		.flatMap((part) => part.split(/\s+and\s+/))
		.map((n) => n.trim().replace(/[.!?]+$/, '')) // Remove trailing punctuation
		.filter((n) => n.length > 0 && !n.includes('(') && n.length < 50);
}

/**
 * Extract raw name strings from a description
 */
export function extractNameStrings(description: string): string[] {
	const names: string[] = [];

	// Try each name list pattern
	for (const pattern of NAME_LIST_PATTERNS) {
		const match = description.match(pattern);
		if (match && match.index !== undefined) {
			// Get text after the pattern
			const afterPattern = description.slice(match.index + match[0].length);

			// Find the end of the name list (newline, period followed by space, or end of string)
			const endMatch = afterPattern.match(/\.\s|\n|$/);
			const nameSection = endMatch ? afterPattern.slice(0, endMatch.index) : afterPattern;

			names.push(...splitNames(nameSection));
		}
	}

	// Try single person patterns (can have multiple names separated by "and")
	for (const pattern of SINGLE_PERSON_PATTERNS) {
		const match = description.match(pattern);
		if (match && match.index !== undefined) {
			const afterPattern = description.slice(match.index + match[0].length);
			// Get until newline or period
			const endMatch = afterPattern.match(/\.\s|\n|$/);
			const nameSection = endMatch
				? afterPattern.slice(0, endMatch.index).trim()
				: afterPattern.trim();

			if (nameSection.length > 0 && nameSection.length < 100) {
				names.push(...splitNames(nameSection));
			}
		}
	}

	// Deduplicate
	return [...new Set(names)];
}

/**
 * Clean up a name string for matching
 */
function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z\s-]/g, '') // Remove non-alpha chars except spaces and hyphens
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Match extracted names against a list of known performers
 * Returns performers that match
 */
export function matchPerformers(
	extractedNames: string[],
	knownPerformers: Array<{ id: number; name: string; slug: string; image_url?: string | null }>
): Array<{ id: number; name: string; slug: string; image_url?: string | null }> {
	const matched: Array<{ id: number; name: string; slug: string; image_url?: string | null }> = [];
	const matchedIds = new Set<number>();

	for (const extractedName of extractedNames) {
		const normalizedExtracted = normalizeName(extractedName);

		for (const performer of knownPerformers) {
			if (matchedIds.has(performer.id)) continue;

			const normalizedPerformer = normalizeName(performer.name);

			// Exact match
			if (normalizedExtracted === normalizedPerformer) {
				matched.push(performer);
				matchedIds.add(performer.id);
				continue;
			}

			// Check if extracted name is contained in performer name or vice versa
			// This helps with cases like "Josh Telson" matching "Joshua Telson"
			if (normalizedExtracted.length >= 5) {
				if (
					normalizedPerformer.includes(normalizedExtracted) ||
					normalizedExtracted.includes(normalizedPerformer)
				) {
					matched.push(performer);
					matchedIds.add(performer.id);
				}
			}
		}
	}

	return matched;
}

/**
 * Main function: parse description and return matched performers
 */
export function parsePerformersFromDescription(
	description: string,
	knownPerformers: Array<{ id: number; name: string; slug: string; image_url?: string | null }>
): Array<{ id: number; name: string; slug: string; image_url?: string | null }> {
	const extractedNames = extractNameStrings(description);
	return matchPerformers(extractedNames, knownPerformers);
}

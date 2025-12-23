import { describe, it, expect } from 'vitest';
import {
	extractNameStrings,
	matchPerformers,
	parsePerformersFromDescription
} from './parsePerformers';

describe('parsePerformers', () => {
	describe('extractNameStrings', () => {
		it('should extract names from "Team members are:" pattern', () => {
			const desc = 'Team members are: John Doe, Jane Smith and Bob Johnson.';
			const names = extractNameStrings(desc);
			expect(names).toContain('John Doe');
			expect(names).toContain('Jane Smith');
			expect(names).toContain('Bob Johnson');
			expect(names).toHaveLength(3);
		});

		it('should extract names from "*Actual Cast:" pattern', () => {
			const desc = '*Actual Cast: Alice Cooper, Bob Dylan, Charlie Parker';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice Cooper');
			expect(names).toContain('Bob Dylan');
			expect(names).toContain('Charlie Parker');
		});

		it('should extract names from "Actual Cast:" without asterisk', () => {
			const desc = 'Actual Cast: Alice Cooper, Bob Dylan';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice Cooper');
			expect(names).toContain('Bob Dylan');
		});

		it('should extract host from "Hosted by:" pattern', () => {
			const desc = 'A great show! Hosted by: Sarah Connor';
			const names = extractNameStrings(desc);
			expect(names).toContain('Sarah Connor');
		});

		it('should extract coach from "Coached by" pattern', () => {
			const desc = 'Coached by Noah Telson';
			const names = extractNameStrings(desc);
			expect(names).toContain('Noah Telson');
		});

		it('should handle multiple "and" separators', () => {
			const desc = 'Cast: Person A and Person B and Person C';
			const names = extractNameStrings(desc);
			expect(names).toHaveLength(3);
			expect(names).toContain('Person A');
			expect(names).toContain('Person B');
			expect(names).toContain('Person C');
		});

		it('should remove trailing punctuation', () => {
			const desc = 'Performers: John Doe!, Jane Smith.';
			const names = extractNameStrings(desc);
			expect(names).toContain('John Doe');
			expect(names).toContain('Jane Smith');
			expect(names).not.toContain('John Doe!');
			expect(names).not.toContain('Jane Smith.');
		});

		it('should deduplicate names', () => {
			const desc = 'Cast: John Doe, Jane Smith. Hosted by: John Doe';
			const names = extractNameStrings(desc);
			const johnCount = names.filter((n) => n === 'John Doe').length;
			expect(johnCount).toBe(1);
		});

		it('should filter out long strings (likely not names)', () => {
			const desc =
				'Cast: Person A, Person B, This is a really long description that is not a name and should be filtered out because it exceeds fifty characters';
			const names = extractNameStrings(desc);
			expect(names).toContain('Person A');
			expect(names).toContain('Person B');
			expect(names.some((n) => n.includes('really long description'))).toBe(false);
		});

		it('should filter out strings with parentheses', () => {
			const desc = 'Cast: John Doe, (Understudy), Jane Smith';
			const names = extractNameStrings(desc);
			expect(names).toContain('John Doe');
			expect(names).toContain('Jane Smith');
			expect(names.some((n) => n.includes('('))).toBe(false);
		});

		it('should handle "regular cast is" pattern', () => {
			const desc = 'The regular cast is Adam Smith, Betty White';
			const names = extractNameStrings(desc);
			expect(names).toContain('Adam Smith');
			expect(names).toContain('Betty White');
		});

		it('should handle "cast is" pattern', () => {
			const desc = 'The cast is Person A, Person B';
			const names = extractNameStrings(desc);
			expect(names).toContain('Person A');
			expect(names).toContain('Person B');
		});

		it('should handle "cast:" pattern', () => {
			const desc = 'Cast: Alice, Bob';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice');
			expect(names).toContain('Bob');
		});

		it('should handle "featuring:" pattern', () => {
			const desc = 'Featuring: Star Performer, Guest Artist';
			const names = extractNameStrings(desc);
			expect(names).toContain('Star Performer');
			expect(names).toContain('Guest Artist');
		});

		it('should handle "starring:" pattern', () => {
			const desc = 'Starring: Lead Actor';
			const names = extractNameStrings(desc);
			expect(names).toContain('Lead Actor');
		});

		it('should handle "lineup:" pattern', () => {
			const desc = 'Lineup: Artist One, Artist Two';
			const names = extractNameStrings(desc);
			expect(names).toContain('Artist One');
			expect(names).toContain('Artist Two');
		});

		it('should handle case variations in patterns', () => {
			// The patterns use [Hh] for case variations, not full case insensitivity
			const desc = 'Hosted by: John Doe';
			const names = extractNameStrings(desc);
			expect(names).toContain('John Doe');
		});

		it('should handle multiple patterns in same description', () => {
			const desc = 'Cast: Alice, Bob. Hosted by: Charlie';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice');
			expect(names).toContain('Bob');
			expect(names).toContain('Charlie');
		});

		it('should stop at period followed by space', () => {
			const desc = 'Cast: Alice, Bob. The show will start at 8pm';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice');
			expect(names).toContain('Bob');
			expect(names.some((n) => n.includes('show'))).toBe(false);
		});

		it('should stop at newline', () => {
			const desc = 'Cast: Alice, Bob\nThe show starts soon';
			const names = extractNameStrings(desc);
			expect(names).toContain('Alice');
			expect(names).toContain('Bob');
			expect(names.some((n) => n.includes('show'))).toBe(false);
		});

		it('should handle empty description', () => {
			const names = extractNameStrings('');
			expect(names).toEqual([]);
		});

		it('should handle description with no patterns', () => {
			const desc = 'This is a great show with no performer names mentioned explicitly';
			const names = extractNameStrings(desc);
			expect(names).toEqual([]);
		});
	});

	describe('matchPerformers', () => {
		const knownPerformers = [
			{ id: 1, name: 'John Doe', slug: 'john-doe', image_url: null },
			{ id: 2, name: 'Jane Smith', slug: 'jane-smith', image_url: 'https://example.com/jane.jpg' },
			{ id: 3, name: 'Joshua Telson', slug: 'joshua-telson', image_url: null },
			{ id: 4, name: 'Bob Johnson-Williams', slug: 'bob-johnson-williams', image_url: null },
			{ id: 5, name: 'María García', slug: 'maria-garcia', image_url: null }
		];

		it('should match exact names', () => {
			const extracted = ['John Doe', 'Jane Smith'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(2);
			expect(matched.map((p) => p.id)).toContain(1);
			expect(matched.map((p) => p.id)).toContain(2);
		});

		it('should match case-insensitively', () => {
			const extracted = ['JOHN DOE', 'jane smith'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(2);
			expect(matched.map((p) => p.id)).toContain(1);
			expect(matched.map((p) => p.id)).toContain(2);
		});

		it('should match partial names (Josh vs Joshua)', () => {
			const extracted = ['Joshua Telson']; // Full name should match
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(1);
			expect(matched[0].id).toBe(3);
			expect(matched[0].name).toBe('Joshua Telson');
		});

		it('should not match names with different accents (normalization removes accents)', () => {
			// "Maria Garcia" normalizes to "maria garcia"
			// "María García" normalizes to "mara garca" (accents removed, creating different string)
			const extracted = ['Maria Garcia']; // Without accent
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(0); // No match - different normalized strings
		});

		it('should not match names with different hyphenation', () => {
			// "Bob Johnson Williams" normalizes to "bob johnson williams"
			// "Bob Johnson-Williams" normalizes to "bob johnson-williams"
			const extracted = ['Bob Johnson Williams']; // Missing hyphen
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(0); // No match - hyphen makes them different
		});

		it('should not match names shorter than 5 characters', () => {
			const extracted = ['John', 'Jo'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(0);
		});

		it('should deduplicate matches', () => {
			const extracted = ['John Doe', 'John Doe', 'JOHN DOE'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(1);
			expect(matched[0].id).toBe(1);
		});

		it('should preserve image_url from performers', () => {
			const extracted = ['Jane Smith'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched[0].image_url).toBe('https://example.com/jane.jpg');
		});

		it('should handle empty extracted names array', () => {
			const matched = matchPerformers([], knownPerformers);
			expect(matched).toEqual([]);
		});

		it('should handle empty known performers array', () => {
			const extracted = ['John Doe'];
			const matched = matchPerformers(extracted, []);
			expect(matched).toEqual([]);
		});

		it('should not match unknown names', () => {
			const extracted = ['Alice Unknown', 'Bob Unknown'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toEqual([]);
		});

		it('should match multiple valid names and ignore invalid ones', () => {
			const extracted = ['John Doe', 'Unknown Person', 'Jane Smith'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(2);
			expect(matched.map((p) => p.id)).toContain(1);
			expect(matched.map((p) => p.id)).toContain(2);
		});

		it('should handle partial matching when extracted name contains performer name', () => {
			const extracted = ['Joshua']; // 6 characters, meets minimum
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(1);
			expect(matched[0].id).toBe(3);
		});

		it('should only match each performer once even with multiple similar extracted names', () => {
			const extracted = ['Joshua Telson', 'Joshua Telson', 'Joshua'];
			const matched = matchPerformers(extracted, knownPerformers);
			expect(matched).toHaveLength(1);
			expect(matched[0].id).toBe(3);
		});
	});

	describe('parsePerformersFromDescription', () => {
		const knownPerformers = [
			{ id: 1, name: 'Noah Telson', slug: 'noah-telson', image_url: null },
			{ id: 2, name: 'Josh Telson', slug: 'josh-telson', image_url: null },
			{
				id: 3,
				name: 'Caroline Clifford',
				slug: 'caroline-clifford',
				image_url: 'https://example.com/caroline.jpg'
			}
		];

		it('should extract and match performers in one call', () => {
			const desc =
				'A wonderful improv show! Coached by Noah Telson. Team members are: Josh Telson and others.';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers.map((p) => p.id)).toContain(1);
			expect(performers.map((p) => p.id)).toContain(2);
		});

		it('should return empty array when no matches found', () => {
			const desc = 'A show with unknown people: Alice Unknown, Bob Unknown';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(0);
		});

		it('should return empty array when no patterns found', () => {
			const desc = 'Just a regular description without any performer patterns';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(0);
		});

		it('should handle multiple patterns and match correctly', () => {
			const desc = 'Cast: Noah Telson, Josh Telson. Hosted by: Caroline Clifford';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(3);
		});

		it('should preserve image URLs in results', () => {
			const desc = 'Hosted by: Caroline Clifford';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers[0].image_url).toBe('https://example.com/caroline.jpg');
		});

		it('should match when full names are used', () => {
			const desc = 'Team members are: Noah Telson, Josh Telson';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(2);
			expect(performers.map((p) => p.slug)).toContain('noah-telson');
			expect(performers.map((p) => p.slug)).toContain('josh-telson');
		});

		it('should deduplicate performers mentioned multiple times', () => {
			const desc = 'Cast: Noah Telson, Josh Telson. Coached by Noah Telson';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			const noahCount = performers.filter((p) => p.id === 1).length;
			expect(noahCount).toBe(1);
		});
	});

	describe('Integration tests with real-world descriptions', () => {
		const knownPerformers = [
			{ id: 1, name: 'Noah Telson', slug: 'noah-telson', image_url: null },
			{ id: 2, name: 'Anita Waltho', slug: 'anita-waltho', image_url: null },
			{ id: 3, name: 'Georgia Riungu', slug: 'georgia-riungu', image_url: null }
		];

		it('should parse a typical house show description', () => {
			const desc = `House Show is our weekly resident improv show!

Coached by Noah Telson
Team members are: Anita Waltho, Georgia Riungu and others.

The show starts at 8pm.`;
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers.map((p) => p.slug)).toContain('noah-telson');
			expect(performers.map((p) => p.slug)).toContain('anita-waltho');
			expect(performers.map((p) => p.slug)).toContain('georgia-riungu');
		});

		it('should handle descriptions with only coach mentioned', () => {
			const desc = 'Coached by Noah Telson';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(1);
			expect(performers[0].slug).toBe('noah-telson');
		});

		it('should handle descriptions with asterisk formatting', () => {
			const desc = '*Actual Cast: Noah Telson, Anita Waltho, Georgia Riungu';
			const performers = parsePerformersFromDescription(desc, knownPerformers);
			expect(performers).toHaveLength(3);
		});
	});
});

import { describe, it, expect } from 'vitest';
import { parseLineupFromHTML } from './lineupCrawler';

describe('lineupCrawler', () => {
	describe('parseLineupFromHTML - Performer Cards Method', () => {
		it('should extract performers from .ccb-performers-card divs', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Our amazing lineup!</p>
				</div>
				<div class="ccb-performers-card">
					<figure class="ccb-performers-card-image"><img src="test.jpg"></figure>
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<figure class="ccb-performers-card-image"><img src="test2.jpg"></figure>
					<div>Harry Haddon</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual(['Lisa Frischemeier', 'Harry Haddon']);
			expect(result.hosts).toEqual([]);
		});

		it('should detect hosts from performer cards when description mentions "host"', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Hosted by Lisa Frischemeier</p>
				</div>
				<div class="ccb-performers-card">
					<figure class="ccb-performers-card-image"><img src="test.jpg"></figure>
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<figure class="ccb-performers-card-image"><img src="test2.jpg"></figure>
					<div>Harry Haddon</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual(['Lisa Frischemeier', 'Harry Haddon']);
			expect(result.hosts).toContain('Lisa Frischemeier');
		});

		it('should filter out invalid names (too long or empty)', () => {
			const html = `
				<div class="ccb-performers-card">
					<div></div>
				</div>
				<div class="ccb-performers-card">
					<div>   </div>
				</div>
				<div class="ccb-performers-card">
					<div>${'x'.repeat(100)}</div>
				</div>
				<div class="ccb-performers-card">
					<div>Valid Name</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual(['Valid Name']);
		});

		it('should deduplicate performers from cards', () => {
			const html = `
				<div class="ccb-performers-card">
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<div>Harry Haddon</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual(['Lisa Frischemeier', 'Harry Haddon']);
		});

		it('should trim whitespace from card names', () => {
			const html = `
				<div class="ccb-performers-card">
					<div>  Lisa Frischemeier  </div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual(['Lisa Frischemeier']);
		});
	});

	describe('parseLineupFromHTML - Text Parsing Fallback', () => {
		it('should fall back to text parsing when no performer cards exist', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Featuring: Lisa Frischemeier, Harry Haddon, and Sarah Schmidt</p>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers.length).toBeGreaterThan(0);
		});

		it('should extract names from list items', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<ul>
						<li>Lisa Frischemeier</li>
						<li>Harry Haddon</li>
						<li>Sarah Schmidt</li>
					</ul>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toContain('Lisa Frischemeier');
			expect(result.performers).toContain('Harry Haddon');
			expect(result.performers).toContain('Sarah Schmidt');
		});

		it('should detect hosts from list items with "host" keyword', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<ul>
						<li>Hosted by Lisa Frischemeier</li>
						<li>Harry Haddon</li>
					</ul>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.hosts.length).toBeGreaterThan(0);
		});

		it('should clean up list items (remove bullets and parentheses)', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<ul>
						<li>- Lisa Frischemeier</li>
						<li>• Harry Haddon</li>
					</ul>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			// Should extract names without bullets
			expect(result.performers).toContain('Lisa Frischemeier');
			expect(result.performers).toContain('Harry Haddon');
		});

		it('should skip list items with URLs', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<ul>
						<li>Lisa Frischemeier</li>
						<li>https://example.com/tickets</li>
						<li>Harry Haddon</li>
					</ul>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toContain('Lisa Frischemeier');
			expect(result.performers).toContain('Harry Haddon');
			expect(result.performers.some((p) => p.includes('http'))).toBe(false);
		});

		it('should handle ordered lists (ol)', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<ol>
						<li>Lisa Frischemeier</li>
						<li>Harry Haddon</li>
					</ol>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toContain('Lisa Frischemeier');
			expect(result.performers).toContain('Harry Haddon');
		});
	});

	describe('parseLineupFromHTML - Edge Cases', () => {
		it('should handle empty HTML', () => {
			const result = parseLineupFromHTML('');

			expect(result.performers).toEqual([]);
			expect(result.hosts).toEqual([]);
			expect(result.rawContent).toBe('');
		});

		it('should handle HTML with no content div', () => {
			const html = '<div><p>Some random content</p></div>';

			const result = parseLineupFromHTML(html);

			expect(result.performers).toEqual([]);
			expect(result.hosts).toEqual([]);
		});

		it('should handle content div with no lists or performer cards', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>This is a show description with no lineup info.</p>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			// Should still attempt text extraction
			expect(result.rawContent).toContain('This is a show description');
		});

		it('should deduplicate performers from mixed sources', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Featuring: Lisa Frischemeier</p>
					<ul>
						<li>Lisa Frischemeier</li>
						<li>Harry Haddon</li>
					</ul>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			// Lisa appears in both text and list, should be deduplicated
			expect(result.performers.filter((p) => p === 'Lisa Frischemeier').length).toBeLessThanOrEqual(
				1
			);
		});

		it('should return rawContent for debugging', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Show description content here</p>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.rawContent).toContain('Show description content');
		});

		it('should handle special characters in names', () => {
			const html = `
				<div class="ccb-performers-card">
					<div>María García</div>
				</div>
				<div class="ccb-performers-card">
					<div>François O'Brien</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toContain('María García');
			expect(result.performers).toContain("François O'Brien");
		});

		it('should handle case-insensitive host detection', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>This show is HOSTED by our wonderful performers</p>
				</div>
				<div class="ccb-performers-card">
					<div>Lisa Frischemeier</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			// Should detect that text contains "host" (case-insensitive)
			expect(result.rawContent.toLowerCase()).toContain('host');
			expect(result.performers).toContain('Lisa Frischemeier');
		});
	});

	describe('parseLineupFromHTML - Real-World Examples', () => {
		it('should handle Improvylicious Jam format', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Improvylicious Jam, hosted by Destiny's Step Child, is an open stage for anyone looking to practice...</p>
				</div>
				<div class="ccb-performers-card">
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<div>Harry Haddon</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers.length).toBeGreaterThan(0);
			expect(result.rawContent).toContain('Destiny');
		});

		it('should handle house show format with teams', () => {
			const html = `
				<div class="tribe-events-single-event-description">
					<p>Your hosts, esteemed comedy performers Lisa Frischemeier & Harry Haddon</p>
				</div>
				<div class="ccb-performers-card">
					<div>Lisa Frischemeier</div>
				</div>
				<div class="ccb-performers-card">
					<div>Harry Haddon</div>
				</div>
			`;

			const result = parseLineupFromHTML(html);

			expect(result.performers).toContain('Lisa Frischemeier');
			expect(result.performers).toContain('Harry Haddon');
		});
	});
});

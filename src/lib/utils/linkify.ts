/**
 * Utility to convert URLs in text to clickable links
 */

/**
 * Convert URLs in text to HTML anchor tags
 * @param text - Plain text that may contain URLs
 * @returns HTML string with clickable links
 */
export function linkifyText(text: string): string {
	// Match URLs that start with http:// or https://
	const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

	return text.replace(urlRegex, (url) => {
		// Clean up trailing punctuation that's likely not part of the URL
		let cleanUrl = url;
		const trailingPunctuation = /[.,;:!?)]+$/;
		const match = url.match(trailingPunctuation);
		let suffix = '';
		if (match) {
			suffix = match[0];
			cleanUrl = url.slice(0, -suffix.length);
		}

		return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-[var(--tw-electric-cyan)] hover:text-[var(--tw-neon-pink)] hover:underline">${cleanUrl}</a>${suffix}`;
	});
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
	const htmlEscapes: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};
	return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Safely linkify text (escape HTML first, then add links)
 */
export function safeLinkifyText(text: string): string {
	return linkifyText(escapeHtml(text));
}

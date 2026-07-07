/**
 * Highlights all text within single quotes by wrapping them in a styled span.
 * Excludes matches inside HTML tags to prevent breaking HTML attributes.
 */
export const highlightSingleQuotes = (text: string): string => {
  if (!text) return "";
  const regex = /(<[^>]+>)|(?<=^|[\s\(\[\{\-"])'([^']*)'(?=$|[\s\)\]\}\-.,;:!?"])/g;
  return text.replace(regex, (match, tag, quotedText) => {
    if (tag) {
      return tag;
    }
    return `<span class="text-blue-600 font-semibold" style="color: #2563eb;">'${quotedText}'</span>`;
  });
};

/**
 * Extract the function code from a URL path.
 * The function code follows the pattern /f/<CODE>.
 * @param {string} url - The URL to parse
 * @returns {string} The function code, or empty string if not found or malformed
 */
function functionCodeFromUrl(url) {
  const match = /\/f\/([^/?#]+)/.exec(url);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

module.exports = { functionCodeFromUrl };